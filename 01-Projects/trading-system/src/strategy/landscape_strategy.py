"""
Landscape-Aware Trading Strategy

D/I/R composition-aware strategy with orthogonal signal integration.
Uses energy landscape as primary signal, Volume Profile for spatial
entry/exit structure, and CVD as confidence modifier.

Signal hierarchy:
  1. Primary: D/I/R energy landscape (state)
  2. Secondary: VPVR (geometry)
  3. Tertiary: CVD (confidence modifier)

No banned indicators: RSI, MACD, MA crossovers, Bollinger signals, Stochastic.
ATR allowed as price-space bridge function only.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import pandas as pd

from src.backtest.engine import Signal
from src.features.volume_profile import VolumeProfile, PriceLevel
from src.features.cvd import compute_cvd, cvd_trend


# ---------------------------------------------------------------------------
# Trade context for logging
# ---------------------------------------------------------------------------

@dataclass
class TradeContext:
    regime: str = ""
    basin_depth: float = 0.0
    barrier_height: float = 0.0
    transition_score: float = 0.0
    hvn_level: float = 0.0
    cvd_state: str = ""
    gradient_mag: float = 0.0
    entry_type: str = ""  # "limit_hvn", "momentum_bypass", "i_preposition"
    normalised_barrier: float = 0.0


# ---------------------------------------------------------------------------
# Pending order tracking
# ---------------------------------------------------------------------------

@dataclass
class PendingOrder:
    price: float
    size: float
    placed_bar: int
    context: TradeContext
    stop_price: float
    target_price: float


# ---------------------------------------------------------------------------
# Strategy
# ---------------------------------------------------------------------------

class LandscapeStrategy:
    """
    Landscape-native strategy with archetype templates.

    Consumes pre-computed classification data (regime, confidence,
    transition_score, barrier heights, gradient) and OHLCV for
    VPVR + CVD computation.
    """

    def __init__(
        self,
        confidence_threshold: float = 0.5,
        transition_entry_max: float = 0.3,
        momentum_bypass_ts: float = 0.15,
        momentum_bypass_depth: float = 1.5,
        momentum_size_fraction: float = 0.50,
        gradient_trim_threshold: float = 0.5,
        gate1_transition_score: float = 0.8,
        gate2_scale_out_frac: float = 0.50,
        pregate_trim_frac: float = 0.25,
        min_order_life: int = 12,
        order_cooldown: int = 6,
        max_position_frac: float = 0.30,
        min_stop_atr_mult: float = 1.0,
        momentum_stop_atr_mult: float = 1.5,
        vpvr_lookback: int = 500,
        cvd_window: int = 24,
        atr_period: int = 14,
        warmup_bars: int = 100,
        i_barrier_threshold: float = 0.2,
        i_preposition_size: float = 0.25,
    ):
        self.confidence_threshold = confidence_threshold
        self.transition_entry_max = transition_entry_max
        self.momentum_bypass_ts = momentum_bypass_ts
        self.momentum_bypass_depth = momentum_bypass_depth
        self.momentum_size_fraction = momentum_size_fraction
        self.gradient_trim_threshold = gradient_trim_threshold
        self.gate1_transition_score = gate1_transition_score
        self.gate2_scale_out_frac = gate2_scale_out_frac
        self.pregate_trim_frac = pregate_trim_frac
        self.min_order_life = min_order_life
        self.order_cooldown = order_cooldown
        self.max_position_frac = max_position_frac
        self.min_stop_atr_mult = min_stop_atr_mult
        self.momentum_stop_atr_mult = momentum_stop_atr_mult
        self.vpvr_lookback = vpvr_lookback
        self.cvd_window = cvd_window
        self.atr_period = atr_period
        self.warmup_bars = warmup_bars
        self.i_barrier_threshold = i_barrier_threshold
        self.i_preposition_size = i_preposition_size

        # State
        self._position_size = 0.0  # fraction of capital currently deployed
        self._entry_price = 0.0
        self._entry_bar = 0
        self._entry_context: Optional[TradeContext] = None
        self._target_price = 0.0
        self._stop_price = 0.0
        self._scaled_out = False
        self._pre_gate_fired = False

        self._pending_order: Optional[PendingOrder] = None
        self._last_cancel_bar = -999
        self._trade_log: list[dict] = []

        # Pre-computed series
        self._atr: Optional[pd.Series] = None
        self._cvd: Optional[pd.Series] = None
        self._cvd_slope: Optional[pd.Series] = None
        self._vpvr = VolumeProfile(lookback=vpvr_lookback)

    def name(self) -> str:
        return "Landscape-VPVR"

    def precompute(self, data: pd.DataFrame) -> None:
        """Pre-compute ATR and CVD for the full dataset."""
        high, low, close = data["high"], data["low"], data["close"]
        prev_close = close.shift(1)
        tr = pd.concat([
            high - low,
            (high - prev_close).abs(),
            (low - prev_close).abs(),
        ], axis=1).max(axis=1)
        self._atr = tr.rolling(self.atr_period, min_periods=1).mean()

        self._cvd = compute_cvd(data)
        self._cvd_slope = cvd_trend(self._cvd, window=self.cvd_window)

    def on_bar(self, idx: int, row: pd.Series, history: pd.DataFrame) -> Signal:
        """Process a bar. Returns Signal for the backtest engine."""
        if idx < self.warmup_bars:
            return Signal(action="hold", reason="warmup")

        regime = row.get("regime", "I")
        confidence = float(row.get("confidence", 0.0))
        transition_score = float(row.get("transition_score", 0.5))
        basin_depth = float(row.get("basin_depth", 1.0))
        barrier_height = float(row.get("barrier_height", 0.5))
        gradient_mag = float(row.get("gradient_mag", 0.0))
        gradient_direction = float(row.get("gradient_direction", 0.0))
        normalised_barrier = float(row.get("normalised_barrier", 0.5))
        price = row["close"]
        base_atr = float(self._atr.iloc[idx]) if self._atr is not None else 0.0

        # Check if pending limit order fills
        if self._pending_order is not None:
            fill_signal = self._check_pending_fill(idx, row, base_atr)
            if fill_signal is not None:
                return fill_signal
            # Check order expiry
            bars_alive = idx - self._pending_order.placed_bar
            if bars_alive >= self.min_order_life and regime != "D":
                self._cancel_order(idx)
                return Signal(action="hold", reason="order_cancelled_regime_change")

        # If in position, check exits
        if self._position_size > 0:
            return self._check_exits(idx, row, regime, transition_score,
                                     gradient_mag, gradient_direction,
                                     price, base_atr, normalised_barrier)

        # Not in position — check entries
        return self._check_entries(idx, row, history, regime, confidence,
                                   transition_score, basin_depth, barrier_height,
                                   gradient_mag, normalised_barrier, price, base_atr)

    # ------------------------------------------------------------------
    # Entry logic
    # ------------------------------------------------------------------

    def _check_entries(
        self, idx: int, row: pd.Series, history: pd.DataFrame,
        regime: str, confidence: float, transition_score: float,
        basin_depth: float, barrier_height: float, gradient_mag: float,
        normalised_barrier: float, price: float, base_atr: float,
    ) -> Signal:
        # Cooldown after cancel
        if idx - self._last_cancel_bar < self.order_cooldown:
            return Signal(action="hold", reason="order_cooldown")

        # Already have pending order
        if self._pending_order is not None:
            return Signal(action="hold", reason="pending_order_active")

        # D-regime entry
        if regime == "D" and confidence > self.confidence_threshold and transition_score < self.transition_entry_max:
            return self._d_regime_entry(idx, row, history, basin_depth,
                                        barrier_height, transition_score,
                                        normalised_barrier, gradient_mag,
                                        price, base_atr)

        # I-regime exception: pre-position if barrier to D is very low
        if regime == "I":
            barrier_to_d = float(row.get("barrier_to_d", 1.0))
            if barrier_to_d < self.i_barrier_threshold:
                return self._i_regime_preposition(idx, row, history, price, base_atr,
                                                   barrier_height, normalised_barrier,
                                                   gradient_mag)

        return Signal(action="hold", reason=f"{regime}_no_entry")

    def _d_regime_entry(
        self, idx: int, row: pd.Series, history: pd.DataFrame,
        basin_depth: float, barrier_height: float, transition_score: float,
        normalised_barrier: float, gradient_mag: float,
        price: float, base_atr: float,
    ) -> Signal:
        # Compute VPVR
        if len(history) >= 50:
            self._vpvr.compute(history)

        # CVD confidence modifier
        cvd_mod = 1.0
        if self._cvd_slope is not None and idx < len(self._cvd_slope):
            slope = float(self._cvd_slope.iloc[idx])
            cvd_mod = max(0.8, min(1.2, 1.0 + (np.clip(slope, -3, 3) / 3.0) * 0.20))

        cvd_state = "rising" if cvd_mod > 1.0 else ("falling" if cvd_mod < 1.0 else "neutral")

        # Target price
        target = price + base_atr * (1.0 + 3.0 * normalised_barrier)

        ctx = TradeContext(
            regime="D",
            basin_depth=basin_depth,
            barrier_height=barrier_height,
            transition_score=transition_score,
            cvd_state=cvd_state,
            gradient_mag=gradient_mag,
            normalised_barrier=normalised_barrier,
        )

        # Momentum bypass: extremely stable regime
        if transition_score < self.momentum_bypass_ts and basin_depth > self.momentum_bypass_depth:
            stop = price - self.momentum_stop_atr_mult * base_atr
            distance_to_stop = max(price - stop, base_atr * self.min_stop_atr_mult)

            size = self._compute_size(basin_depth, barrier_height, distance_to_stop,
                                      base_atr, cvd_mod)
            size *= self.momentum_size_fraction  # 50% for riskier entry

            ctx.entry_type = "momentum_bypass"
            ctx.hvn_level = price
            self._enter_position(price, size, idx, ctx, stop, target)

            return Signal(
                action="buy", size=size,
                reason="D_momentum_bypass",
                stop_loss=stop,
            )

        # Default: limit order at nearest HVN below
        hvn_below = self._vpvr.get_hvn_below(price, n=2)
        if not hvn_below:
            # No HVN below — use price - 1 ATR as fallback entry level
            entry_level = price - base_atr
            zone_low = entry_level * 0.995
            zone_high = entry_level * 1.005
        else:
            entry_level = hvn_below[0].price
            zone_low = hvn_below[0].zone_low
            zone_high = hvn_below[0].zone_high

        # Stop placement: barrier-aware
        stop = self._compute_stop(price, entry_level, barrier_height,
                                  base_atr, hvn_below)
        distance_to_stop = max(entry_level - stop, base_atr * self.min_stop_atr_mult)

        size = self._compute_size(basin_depth, barrier_height, distance_to_stop,
                                  base_atr, cvd_mod)

        ctx.entry_type = "limit_hvn"
        ctx.hvn_level = entry_level

        self._pending_order = PendingOrder(
            price=entry_level,
            size=size,
            placed_bar=idx,
            context=ctx,
            stop_price=stop,
            target_price=target,
        )

        return Signal(action="hold", reason="D_limit_order_placed")

    def _i_regime_preposition(
        self, idx: int, row: pd.Series, history: pd.DataFrame,
        price: float, base_atr: float, barrier_height: float,
        normalised_barrier: float, gradient_mag: float,
    ) -> Signal:
        if len(history) >= 50:
            self._vpvr.compute(history)

        hvn_below = self._vpvr.get_hvn_below(price, n=1)
        if not hvn_below:
            return Signal(action="hold", reason="I_no_hvn")

        entry_level = hvn_below[0].price
        stop = entry_level - base_atr * self.min_stop_atr_mult
        target = price + base_atr * (1.0 + 3.0 * normalised_barrier)

        ctx = TradeContext(
            regime="I",
            barrier_height=barrier_height,
            transition_score=float(row.get("transition_score", 0.5)),
            hvn_level=entry_level,
            entry_type="i_preposition",
            gradient_mag=gradient_mag,
            normalised_barrier=normalised_barrier,
        )

        self._pending_order = PendingOrder(
            price=entry_level,
            size=self.i_preposition_size,
            placed_bar=idx,
            context=ctx,
            stop_price=stop,
            target_price=target,
        )

        return Signal(action="hold", reason="I_preposition_order_placed")

    # ------------------------------------------------------------------
    # Exit logic
    # ------------------------------------------------------------------

    def _check_exits(
        self, idx: int, row: pd.Series, regime: str,
        transition_score: float, gradient_mag: float,
        gradient_direction: float, price: float,
        base_atr: float, normalised_barrier: float,
    ) -> Signal:
        # Gate 1: Structural failure — immediate full exit
        if transition_score > self.gate1_transition_score:
            self._log_trade(idx, "gate1_structural_exit", price)
            return self._exit_all("gate1_structural_exit")

        # Stop loss hit
        if price <= self._stop_price:
            self._log_trade(idx, "stop_loss", price)
            return self._exit_all("stop_loss")

        # Pre-gate: gradient early warning — trim 25%
        if (not self._pre_gate_fired
            and gradient_mag > self.gradient_trim_threshold
            and gradient_direction < 0):
            self._pre_gate_fired = True
            trim_size = self._position_size * self.pregate_trim_frac
            self._position_size -= trim_size
            self._log_trade(idx, "pre_gate_gradient_trim", price)
            return Signal(
                action="sell", size=trim_size,
                reason="pre_gate_gradient_trim",
            )

        # Gate 2: Spatial target — 50% scale-out
        if not self._scaled_out and price >= self._target_price:
            self._scaled_out = True
            scale_size = self._position_size * self.gate2_scale_out_frac
            self._position_size -= scale_size
            self._log_trade(idx, "gate2_target_scaleout", price)
            return Signal(
                action="sell", size=scale_size,
                reason="gate2_target_scaleout",
            )

        return Signal(action="hold", reason="hold_position")

    def _exit_all(self, reason: str) -> Signal:
        size = self._position_size
        self._reset_position()
        return Signal(action="sell", size=size, reason=reason)

    # ------------------------------------------------------------------
    # Position sizing
    # ------------------------------------------------------------------

    def _compute_size(
        self, basin_depth: float, barrier_height: float,
        distance_to_stop: float, base_atr: float, cvd_mod: float,
    ) -> float:
        distance_to_stop = max(distance_to_stop, base_atr * self.min_stop_atr_mult)
        raw = (basin_depth * barrier_height) / distance_to_stop
        # Normalize: typical basin_depth ~ 0.5-2.0, barrier ~ 0-5, dist ~ 1-5 ATR
        # Raw range ~ 0-2. Scale to reasonable position fraction.
        size = min(raw * 0.15, self.max_position_frac)
        size = max(size, 0.05)  # minimum 5%
        size *= cvd_mod
        return min(size, self.max_position_frac)

    def _compute_stop(
        self, current_price: float, entry_level: float,
        barrier_height: float, base_atr: float,
        hvn_below: list[PriceLevel],
    ) -> float:
        if barrier_height > 0.7 and len(hvn_below) >= 2:
            # Deep basin: wide stop below second HVN
            stop = hvn_below[1].zone_low
        elif len(hvn_below) >= 1:
            # Moderate/shallow: below nearest HVN
            stop = hvn_below[0].zone_low
        else:
            stop = entry_level - base_atr

        # Floor: minimum 1 ATR below entry
        max_stop = entry_level - base_atr * self.min_stop_atr_mult
        stop = min(stop, max_stop)
        return stop

    # ------------------------------------------------------------------
    # Order management
    # ------------------------------------------------------------------

    def _check_pending_fill(self, idx: int, row: pd.Series,
                            base_atr: float) -> Optional[Signal]:
        order = self._pending_order
        if order is None:
            return None

        # Fill if bar's low reached order price
        if row["low"] <= order.price:
            self._enter_position(order.price, order.size, idx,
                                 order.context, order.stop_price,
                                 order.target_price)
            self._pending_order = None
            return Signal(
                action="buy", size=order.size,
                reason=f"{order.context.entry_type}_fill",
                stop_loss=order.stop_price,
            )
        return None

    def _cancel_order(self, idx: int) -> None:
        self._pending_order = None
        self._last_cancel_bar = idx

    def _enter_position(self, price: float, size: float, idx: int,
                        ctx: TradeContext, stop: float, target: float) -> None:
        self._position_size = size
        self._entry_price = price
        self._entry_bar = idx
        self._entry_context = ctx
        self._target_price = target
        self._stop_price = stop
        self._scaled_out = False
        self._pre_gate_fired = False

    def _reset_position(self) -> None:
        self._position_size = 0.0
        self._entry_price = 0.0
        self._entry_bar = 0
        self._entry_context = None
        self._target_price = 0.0
        self._stop_price = 0.0
        self._scaled_out = False
        self._pre_gate_fired = False

    def _log_trade(self, idx: int, event: str, price: float) -> None:
        ctx = self._entry_context
        self._trade_log.append({
            "bar": idx,
            "event": event,
            "price": price,
            "position_size": self._position_size,
            "regime": ctx.regime if ctx else "",
            "barrier_height": ctx.barrier_height if ctx else 0,
            "transition_score": ctx.transition_score if ctx else 0,
            "hvn_level": ctx.hvn_level if ctx else 0,
            "cvd_state": ctx.cvd_state if ctx else "",
            "gradient_mag": ctx.gradient_mag if ctx else 0,
            "entry_type": ctx.entry_type if ctx else "",
        })

    def get_trade_log(self) -> list[dict]:
        return self._trade_log
