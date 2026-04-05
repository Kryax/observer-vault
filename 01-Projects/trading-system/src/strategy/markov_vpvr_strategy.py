"""
Markov + VPVR Strategy (v4)

Trade energy dynamics with spatial precision.

v4 changes (from triad convergence):
  1. Immediate entry on first D-bar (no persistence wait)
  2. Forced scale-in: tranches 2/3 fire if D persists, ignore dE/dt
  3. Dampened destab: dE/dt > 0.02 for 3 bars (was > 0 for 2)
  4. Hold through I-regime unless dE/dt > 0.02
  5. Time-decay exit REMOVED (fired on 1% — dead code)
  6. Max position 50% (proven 2% DD earns larger sizing)
  7. 2% spatial stop UNCHANGED (sacred — source of W/L ratio)

Exit gates:
  Gate 1 — Spatial stop (2% hard, non-negotiable)
  Gate 2 — R-regime immediate exit
  Gate 3 — Destab exit (dE/dt > 0.02 for 3 consecutive bars)
  (I-regime: hold unless dE/dt > threshold)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np
import pandas as pd

from src.backtest.engine import Signal
from src.features.volume_profile import VolumeProfile


@dataclass
class PendingEntry:
    price: float
    size: float
    placed_bar: int
    stop_price: float
    tranche: int


class MarkovVPVRStrategy:

    def __init__(
        self,
        # Entry
        max_position_frac: float = 0.50,
        dE_dt_norm: float = 0.05,
        dE_dt_window: int = 6,
        min_confidence: float = 0.4,
        vpvr_lookback: int = 500,
        scale_tranches: int = 3,
        min_hvn_depth_pct: float = 0.02,
        # Exits
        spatial_stop_pct: float = 0.02,
        destab_threshold: float = 0.02,
        destab_persistence: int = 3,
        # Transition matrix (kept for future use, not used for time-decay)
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
        self.warmup_bars = warmup_bars
        self.atr_period = atr_period
        self.min_order_life = min_order_life
        self.order_cooldown = order_cooldown

        self._transition_matrix = transition_matrix

        # Position state
        self._in_position = False
        self._position_size = 0.0
        self._entry_price = 0.0
        self._avg_entry_price = 0.0
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

        # Pre-computed
        self._atr: Optional[pd.Series] = None
        self._vpvr = VolumeProfile(lookback=vpvr_lookback)

        # Logging
        self._trade_log: list[dict] = []
        self._exit_reasons: dict[str, int] = {}

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
            fill = self._check_fill(idx, row)
            if fill is not None:
                return fill
            # Cancel if regime flipped to R or order too old
            bars_alive = idx - self._pending.placed_bar
            if regime == "R" or bars_alive >= self.min_order_life:
                self._cancel(idx)
            # Keep pending through I-regime (don't cancel on I)

        # --- EXIT CHECKS (if in position) ---
        if self._in_position:
            exit_signal = self._check_exits(idx, regime, dE_dt, price)
            if exit_signal is not None:
                return exit_signal

            # --- SCALE-IN (tranches 2 and 3) ---
            # v4: force scale-in as long as D persists, ignore dE/dt
            if self._tranches_filled < self.scale_tranches and regime == "D":
                scale_signal = self._try_scale_in(idx, history, price, atr)
                if scale_signal is not None:
                    return scale_signal

            return Signal(action="hold", reason="holding")

        # --- ENTRY TRIGGER ---
        # v4: enter on first D-bar immediately (no persistence wait)
        if (regime == "D"
                and self._consecutive_d_bars == 1
                and confidence >= self.min_confidence
                and self._pending is None
                and idx - self._last_cancel_bar >= self.order_cooldown):
            return self._place_entry(idx, history, price, atr, tranche=1)

        return Signal(action="hold", reason=f"{regime}_no_entry")

    # ------------------------------------------------------------------
    # Entry
    # ------------------------------------------------------------------

    def _place_entry(self, idx: int, history: pd.DataFrame,
                     price: float, atr: float, tranche: int) -> Signal:
        if len(history) >= 50:
            self._vpvr.compute(history)

        hvn_below = self._vpvr.get_hvn_below(price, n=3)

        max_depth = price * self.min_hvn_depth_pct
        entry_level = price - 0.5 * atr  # fallback

        for hvn in hvn_below:
            if price - hvn.price <= max_depth:
                entry_level = hvn.price
                break

        entry_level = min(entry_level, price * 0.999)

        if tranche == 1:
            stop = entry_level * (1 - self.spatial_stop_pct)
        else:
            stop = self._stop_price

        # Tranche size: dE/dt modulated
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

    def _check_fill(self, idx: int, row: pd.Series) -> Optional[Signal]:
        order = self._pending
        if order is None:
            return None

        if row["low"] <= order.price:
            fill_price = order.price

            if order.tranche == 1:
                self._in_position = True
                self._entry_price = fill_price
                self._avg_entry_price = fill_price
                self._entry_bar = idx
                self._position_size = order.size
                self._tranches_filled = 1
                self._stop_price = order.stop_price
                self._destab_counter = 0
            else:
                total_cost = (self._avg_entry_price * self._position_size
                              + fill_price * order.size)
                self._position_size += order.size
                self._avg_entry_price = total_cost / self._position_size
                self._tranches_filled = order.tranche

            self._pending = None

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

    def _try_scale_in(self, idx: int, history: pd.DataFrame,
                      price: float, atr: float) -> Optional[Signal]:
        """v4: force scale-in while D persists. No dE/dt or confidence gate."""
        if self._pending is not None:
            return None

        next_tranche = self._tranches_filled + 1
        if next_tranche > self.scale_tranches:
            return None

        # Min bars between tranches
        if idx - self._entry_bar < self._tranches_filled * 2:
            return None

        return self._place_entry(idx, history, price, atr, tranche=next_tranche)

    def _cancel(self, idx: int) -> None:
        self._pending = None
        self._last_cancel_bar = idx

    # ------------------------------------------------------------------
    # Exits
    # ------------------------------------------------------------------

    def _check_exits(self, idx: int, regime: str,
                     dE_dt: float, price: float) -> Optional[Signal]:
        # GATE 1 — Spatial stop (2% hard stop, always active)
        if price <= self._stop_price:
            return self._exit_all(idx, price, "spatial_stop")

        # GATE 2 — R-regime: immediate exit
        if regime == "R":
            return self._exit_all(idx, price, "R_regime_exit")

        # GATE 3 — Destab: dE/dt > threshold for N consecutive bars
        # v4: threshold=0.02, persistence=3
        if dE_dt > self.destab_threshold:
            self._destab_counter += 1
            if self._destab_counter >= self.destab_persistence:
                return self._exit_all(idx, price, "destab_exit")
        else:
            self._destab_counter = 0

        # I-regime: HOLD as long as dE/dt is not strongly positive
        # (destab gate above handles the exit case)
        # No separate I-regime exit — let destab or spatial stop handle it

        # No time-decay exit (removed in v4 — fired on 1%, dead code)

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

        self._pending = None
        self._in_position = False
        self._position_size = 0.0
        self._entry_price = 0.0
        self._avg_entry_price = 0.0
        self._entry_bar = 0
        self._tranches_filled = 0
        self._stop_price = 0.0
        self._destab_counter = 0

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

    def get_trade_log(self) -> list[dict]:
        return self._trade_log

    def get_exit_distribution(self) -> dict[str, int]:
        return self._exit_reasons
