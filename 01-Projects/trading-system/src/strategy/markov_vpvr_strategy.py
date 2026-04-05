"""
Markov + VPVR Strategy (v3)

Trade energy dynamics with spatial precision.

Authorization: Markov regime state + dE/dt (thermodynamic signal)
Execution: VPVR limit entries at High Volume Nodes (spatial precision)
Risk: 2% spatial stops + dynamic time-decay exits

Strips all Gaussian well metrics (broken for K=3 price data).
Consumes only: regime label, dE/dt, transition matrix, confidence, VPVR.

Entry: D-regime trigger → limit buy at nearest HVN → scale in over 3 bars
Exit triad:
  Gate 1 — Spatial stop (2% hard stop, non-negotiable)
  Gate 2 — State stop (R-regime or sustained positive dE/dt)
  Gate 3 — Dynamic time-decay (MFPT modulated by dE/dt)
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional

import numpy as np
import pandas as pd

from src.backtest.engine import Signal
from src.features.volume_profile import VolumeProfile


# ---------------------------------------------------------------------------
# Pending limit order
# ---------------------------------------------------------------------------

@dataclass
class PendingEntry:
    price: float
    size: float
    placed_bar: int
    stop_price: float
    tranche: int  # 1, 2, or 3


class MarkovVPVRStrategy:
    """
    Trade energy dynamics with spatial precision.

    Consumes:
      - regime (D/I/R label from K=3 classifier)
      - energy (raw energy value for dE/dt computation)
      - confidence (classification confidence)
      - OHLCV (for VPVR and ATR)
    """

    def __init__(
        self,
        # Entry
        max_position_frac: float = 0.35,
        dE_dt_norm: float = 0.05,
        dE_dt_window: int = 6,
        min_confidence: float = 0.4,
        vpvr_lookback: int = 500,
        scale_tranches: int = 3,
        min_hvn_depth_pct: float = 0.02,
        # Exits
        spatial_stop_pct: float = 0.02,
        destab_threshold: float = 0.02,
        destab_persistence: int = 4,
        time_decay_K: float = 1.0,
        # Transition matrix
        transition_matrix: Optional[dict] = None,
        # General
        warmup_bars: int = 100,
        atr_period: int = 14,
        min_order_life: int = 12,
        order_cooldown: int = 4,
    ):
        self.max_position_frac = max_position_frac
        self.dE_dt_norm = dE_dt_norm
        self.dE_dt_window = dE_dt_window
        self.min_confidence = min_confidence
        self.vpvr_lookback = vpvr_lookback
        self.scale_tranches = scale_tranches
        self.min_hvn_depth_pct = min_hvn_depth_pct
        self.spatial_stop_pct = spatial_stop_pct
        self.destab_threshold = destab_threshold
        self.destab_persistence = destab_persistence
        self.time_decay_K = time_decay_K
        self.warmup_bars = warmup_bars
        self.atr_period = atr_period
        self.min_order_life = min_order_life
        self.order_cooldown = order_cooldown

        # Transition matrix derived
        self._transition_matrix = transition_matrix
        self._tau_base = self._expected_duration(transition_matrix, "D")

        # Position state
        self._in_position = False
        self._position_size = 0.0
        self._entry_price = 0.0  # first tranche entry price (stop reference)
        self._avg_entry_price = 0.0  # volume-weighted average
        self._entry_bar = 0
        self._tranches_filled = 0
        self._stop_price = 0.0

        # Pending order
        self._pending: Optional[PendingEntry] = None
        self._last_cancel_bar = -999

        # Signal state
        self._energy_history: list[float] = []
        self._consecutive_d_bars = 0
        self._destab_counter = 0
        self._d_entry_triggered = False  # first D-bar seen, awaiting fill

        # Pre-computed
        self._atr: Optional[pd.Series] = None
        self._vpvr = VolumeProfile(lookback=vpvr_lookback)

        # Logging
        self._trade_log: list[dict] = []
        self._exit_reasons: dict[str, int] = {}

    @staticmethod
    def _expected_duration(tm: Optional[dict], regime: str) -> float:
        if tm is None:
            return 33.0
        p_stay = tm.get(regime, {}).get(regime, 0.97)
        if p_stay >= 1.0:
            return 10000.0
        return 1.0 / (1.0 - p_stay)

    def name(self) -> str:
        return "Markov-VPVR"

    def precompute(self, data: pd.DataFrame) -> None:
        high, low, close = data["high"], data["low"], data["close"]
        prev_close = close.shift(1)
        tr = pd.concat([
            high - low,
            (high - prev_close).abs(),
            (low - prev_close).abs(),
        ], axis=1).max(axis=1)
        self._atr = tr.rolling(self.atr_period, min_periods=1).mean()

    def on_bar(self, idx: int, row: pd.Series, history: pd.DataFrame) -> Signal:
        if idx < self.warmup_bars:
            return Signal(action="hold", reason="warmup")

        energy = float(row.get("energy", 0.0))
        regime = str(row.get("regime", "I"))
        confidence = float(row.get("confidence", 0.0))
        price = float(row["close"])
        atr = float(self._atr.iloc[idx]) if self._atr is not None else 0.0

        self._energy_history.append(energy)
        dE_dt = self._smoothed_dE_dt()

        # Track consecutive D-bars
        if regime == "D":
            self._consecutive_d_bars += 1
        else:
            self._consecutive_d_bars = 0

        # --- Check pending order fill ---
        if self._pending is not None:
            fill = self._check_fill(idx, row, dE_dt, regime)
            if fill is not None:
                return fill
            # Cancel if regime lost or order too old
            bars_alive = idx - self._pending.placed_bar
            if regime != "D" or bars_alive >= self.min_order_life:
                self._cancel(idx)

        # --- EXIT CHECKS (if in position) ---
        if self._in_position:
            exit_signal = self._check_exits(idx, row, regime, dE_dt, price)
            if exit_signal is not None:
                return exit_signal

            # --- SCALE-IN (tranches 2 and 3) ---
            if self._tranches_filled < self.scale_tranches and regime == "D":
                scale_signal = self._try_scale_in(idx, row, history, dE_dt,
                                                   confidence, price, atr)
                if scale_signal is not None:
                    return scale_signal

            return Signal(action="hold", reason="holding")

        # --- ENTRY TRIGGER ---
        if (regime == "D"
                and self._consecutive_d_bars == 1  # first D-bar
                and confidence >= self.min_confidence
                and self._pending is None
                and idx - self._last_cancel_bar >= self.order_cooldown):
            self._d_entry_triggered = True
            return self._place_entry(idx, history, price, atr, tranche=1)

        return Signal(action="hold", reason=f"{regime}_no_entry")

    # ------------------------------------------------------------------
    # Entry
    # ------------------------------------------------------------------

    def _place_entry(self, idx: int, history: pd.DataFrame,
                     price: float, atr: float, tranche: int) -> Signal:
        # Compute VPVR
        if len(history) >= 50:
            self._vpvr.compute(history)

        # Find nearest HVN below
        hvn_below = self._vpvr.get_hvn_below(price, n=3)

        # Entry level: nearest HVN within min_hvn_depth_pct below price
        max_depth = price * self.min_hvn_depth_pct
        entry_level = price - 0.5 * atr  # fallback

        for hvn in hvn_below:
            if price - hvn.price <= max_depth:
                entry_level = hvn.price
                break

        # Don't place order above current price
        entry_level = min(entry_level, price * 0.999)

        # Stop: 2% below first entry
        if tranche == 1:
            stop = entry_level * (1 - self.spatial_stop_pct)
        else:
            stop = self._stop_price  # maintain original stop

        # Tranche size
        base_tranche = self.max_position_frac / self.scale_tranches
        dE_dt = self._smoothed_dE_dt()
        normalised_dE = max(0.0, -dE_dt / self.dE_dt_norm)
        size_scalar = max(0.3, min(1.0, normalised_dE))
        tranche_size = base_tranche * size_scalar

        self._pending = PendingEntry(
            price=entry_level,
            size=tranche_size,
            placed_bar=idx,
            stop_price=stop,
            tranche=tranche,
        )

        self._trade_log.append({
            "bar": idx, "event": f"order_placed_t{tranche}",
            "level": entry_level, "size": tranche_size,
            "dE_dt": dE_dt, "size_scalar": size_scalar,
        })

        return Signal(action="hold", reason=f"limit_order_t{tranche}")

    def _check_fill(self, idx: int, row: pd.Series,
                    dE_dt: float, regime: str) -> Optional[Signal]:
        order = self._pending
        if order is None:
            return None

        # Fill if bar's low reached order price
        if row["low"] <= order.price:
            fill_price = order.price

            if order.tranche == 1:
                # First tranche: new position
                self._in_position = True
                self._entry_price = fill_price
                self._avg_entry_price = fill_price
                self._entry_bar = idx
                self._position_size = order.size
                self._tranches_filled = 1
                self._stop_price = order.stop_price
                self._destab_counter = 0
            else:
                # Scale-in: add to position
                total_cost = (self._avg_entry_price * self._position_size
                              + fill_price * order.size)
                self._position_size += order.size
                self._avg_entry_price = total_cost / self._position_size
                self._tranches_filled = order.tranche

            self._pending = None
            self._d_entry_triggered = False

            self._trade_log.append({
                "bar": idx, "event": f"fill_t{order.tranche}",
                "price": fill_price, "size": order.size,
                "position_total": self._position_size,
                "tranches": self._tranches_filled,
            })

            return Signal(
                action="buy",
                size=order.size,
                reason=f"vpvr_fill_t{order.tranche}",
                stop_loss=self._stop_price,
            )

        return None

    def _try_scale_in(self, idx: int, row: pd.Series, history: pd.DataFrame,
                      dE_dt: float, confidence: float,
                      price: float, atr: float) -> Optional[Signal]:
        """Place next tranche if conditions hold."""
        if self._pending is not None:
            return None  # already have a pending order

        next_tranche = self._tranches_filled + 1
        if next_tranche > self.scale_tranches:
            return None

        # Abort scaling if dE/dt turned materially positive
        if dE_dt > self.destab_threshold:
            return None

        # Abort if confidence dropped
        if confidence < self.min_confidence:
            return None

        # Min bars between tranches
        if idx - self._entry_bar < self._tranches_filled * 2:
            return None

        return self._place_entry(idx, history, price, atr, tranche=next_tranche)

    def _cancel(self, idx: int) -> None:
        self._pending = None
        self._last_cancel_bar = idx
        self._d_entry_triggered = False

    # ------------------------------------------------------------------
    # Exits
    # ------------------------------------------------------------------

    def _check_exits(self, idx: int, row: pd.Series,
                     regime: str, dE_dt: float, price: float) -> Optional[Signal]:
        # GATE 1 — Spatial stop (2% hard stop, always active)
        if price <= self._stop_price:
            return self._exit_all(idx, price, "spatial_stop")

        # GATE 2a — R-regime: immediate exit
        if regime == "R":
            return self._exit_all(idx, price, "R_regime_exit")

        # GATE 2b — Sustained positive dE/dt above threshold (energy destabilising)
        if dE_dt > self.destab_threshold:
            self._destab_counter += 1
            if self._destab_counter >= self.destab_persistence:
                return self._exit_all(idx, price, "destab_exit")
        else:
            self._destab_counter = 0

        # I-regime: hold if dE/dt is negative (stabilising back toward D)
        # Exit I only if dE/dt is also positive (handled by gate 2b above)

        # GATE 3 — Dynamic time-decay
        bars_held = idx - self._entry_bar
        # Modulate tau by current dE/dt
        normalised_dE = -dE_dt / self.dE_dt_norm  # positive when stabilising
        tau_dynamic = self._tau_base * (1.0 + self.time_decay_K * max(0, normalised_dE))
        # Floor: never shorter than tau_base * 0.5
        tau_dynamic = max(tau_dynamic, self._tau_base * 0.5)

        if bars_held > tau_dynamic:
            return self._exit_all(idx, price, "time_decay")

        return None

    def _exit_all(self, idx: int, price: float, reason: str) -> Signal:
        self._exit_reasons[reason] = self._exit_reasons.get(reason, 0) + 1

        self._trade_log.append({
            "bar": idx, "event": "exit", "reason": reason,
            "price": price, "position": self._position_size,
            "bars_held": idx - self._entry_bar,
            "tranches_filled": self._tranches_filled,
            "entry_price": self._entry_price,
            "avg_entry": self._avg_entry_price,
        })

        # Cancel any pending scale-in
        self._pending = None
        self._in_position = False
        self._position_size = 0.0
        self._entry_price = 0.0
        self._avg_entry_price = 0.0
        self._entry_bar = 0
        self._tranches_filled = 0
        self._stop_price = 0.0
        self._destab_counter = 0
        self._d_entry_triggered = False

        return Signal(action="sell", size=1.0, reason=reason)

    # ------------------------------------------------------------------
    # dE/dt
    # ------------------------------------------------------------------

    def _smoothed_dE_dt(self) -> float:
        if len(self._energy_history) < 2:
            return 0.0
        window = min(self.dE_dt_window, len(self._energy_history) - 1)
        energies = self._energy_history[-(window + 1):]
        diffs = [energies[i + 1] - energies[i] for i in range(len(energies) - 1)]
        alpha = 2.0 / (len(diffs) + 1)
        ema = diffs[0]
        for d in diffs[1:]:
            ema = alpha * d + (1 - alpha) * ema
        return ema

    # ------------------------------------------------------------------
    # Accessors
    # ------------------------------------------------------------------

    def get_trade_log(self) -> list[dict]:
        return self._trade_log

    def get_exit_distribution(self) -> dict[str, int]:
        return self._exit_reasons
