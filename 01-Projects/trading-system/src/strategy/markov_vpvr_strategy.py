"""
Markov + VPVR Strategy (v5.2) — Survival Filter Barbell + Asymmetric Exits

v5.1b base: barbell entry (25% probe / 75% conviction at bar 8 with dE/dt < 0)

v5.2 additions:
  A. Profit ratchet — one-way floor that locks in gains at milestones
     +2% unrealised → lock +1%, +4% → lock +2%, +6% → lock +4%
     If price drops to floor: exit with locked profit
  B. Asymmetric destab — winners get 2x destab threshold (relaxed exit)
     Losers keep tight 0.02 threshold, winners need 0.04 to trigger destab

Entry unchanged: barbell (25/75), 8-bar survival, dE/dt < 0 gate
Sacred: 2% spatial stop, R-regime exit
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
    phase: int  # 1 = probe, 2 = conviction


class MarkovVPVRStrategy:

    def __init__(
        self,
        # v3.1 parameters (sacred)
        max_position_frac: float = 0.35,
        dE_dt_norm: float = 0.05,
        dE_dt_window: int = 6,
        min_confidence: float = 0.4,
        vpvr_lookback: int = 500,
        min_hvn_depth_pct: float = 0.02,
        # Exits (v3.1)
        spatial_stop_pct: float = 0.02,
        destab_threshold: float = 0.02,
        destab_persistence: int = 4,
        time_decay_K: float = 1.0,
        # Barbell parameters (v5)
        probe_frac: float = 0.25,       # Phase 1: 25% of max position
        conviction_frac: float = 0.75,   # Phase 2: 75% of max position
        survival_bars: int = 5,           # D-regime must survive this many bars
        require_dE_negative: bool = False,  # v5.1b: require dE/dt < 0 at conviction
        # Profit ratchet (v5.2)
        ratchet_milestones: Optional[list[tuple[float, float]]] = None,
        # Asymmetric destab (v5.2)
        asymmetric_destab: bool = False,  # 2x threshold when in profit
        # Multi-timeframe (v5.3)
        use_macro_regime: bool = False,  # gate entries by macro_regime column
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
        self.min_hvn_depth_pct = min_hvn_depth_pct
        self.spatial_stop_pct = spatial_stop_pct
        self.destab_threshold = destab_threshold
        self.destab_persistence = destab_persistence
        self.time_decay_K = time_decay_K
        self.probe_frac = probe_frac
        self.conviction_frac = conviction_frac
        self.survival_bars = survival_bars
        self.require_dE_negative = require_dE_negative
        # Default ratchet: +2%→lock+1%, +4%→lock+2%, +6%→lock+4%
        self.ratchet_milestones = ratchet_milestones or [
            (0.02, 0.01), (0.04, 0.02), (0.06, 0.04),
        ]
        self.asymmetric_destab = asymmetric_destab
        self.use_macro_regime = use_macro_regime
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
        self._phase_filled = 0  # 0=none, 1=probe, 2=conviction
        self._stop_price = 0.0
        self._profit_floor = 0.0  # ratchet floor (fraction of entry price)
        self._macro_size_mult = 1.0  # macro regime size multiplier

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
        return "Markov-VPVR-v5"

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

        # --- EXIT CHECKS (if in position) ---
        if self._in_position:
            # If D-regime dies before survival threshold and only probe filled: exit
            if self._phase_filled == 1 and regime != "D":
                return self._exit_all(idx, price, "probe_abort")

            exit_signal = self._check_exits(idx, regime, dE_dt, price)
            if exit_signal is not None:
                return exit_signal

            # --- Phase 2: Conviction add-on ---
            if (self._phase_filled == 1
                    and regime == "D"
                    and self._consecutive_d_bars >= self.survival_bars
                    and self._pending is None
                    and (not self.require_dE_negative or dE_dt < 0)):
                return self._place_entry(idx, history, price, atr, phase=2)

            return Signal(action="hold", reason="holding")

        # --- ENTRY TRIGGER: Phase 1 probe on first D-bar ---
        if (regime == "D"
                and self._consecutive_d_bars == 1
                and confidence >= self.min_confidence
                and self._pending is None
                and idx - self._last_cancel_bar >= self.order_cooldown):
            # v5.3: macro regime gating
            if self.use_macro_regime:
                macro = str(row.get("macro_regime", "I"))
                if macro == "R":
                    return Signal(action="hold", reason="macro_R_skip")
                # Macro I: reduce size by 50%
                self._macro_size_mult = 0.5 if macro == "I" else 1.0
            else:
                self._macro_size_mult = 1.0
            return self._place_entry(idx, history, price, atr, phase=1)

        return Signal(action="hold", reason=f"{regime}_no_entry")

    # ------------------------------------------------------------------
    # Entry
    # ------------------------------------------------------------------

    def _place_entry(self, idx: int, history: pd.DataFrame,
                     price: float, atr: float, phase: int) -> Signal:
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

        if phase == 1:
            stop = entry_level * (1 - self.spatial_stop_pct)
            size = self.max_position_frac * self.probe_frac
        else:
            # Phase 2: stop stays at original entry's stop
            stop = self._stop_price
            size = self.max_position_frac * self.conviction_frac

        # dE/dt modulated sizing
        dE_dt = self._smoothed_dE_dt()
        normalised_dE = max(0.0, -dE_dt / self.dE_dt_norm)
        size_scalar = max(0.3, min(1.0, normalised_dE))
        sized = size * size_scalar * self._macro_size_mult

        self._pending = PendingEntry(
            price=entry_level,
            size=sized,
            placed_bar=idx,
            stop_price=stop,
            phase=phase,
        )

        self._trade_log.append({
            "bar": idx, "event": f"order_placed_p{phase}",
            "level": entry_level, "size": sized,
            "dE_dt": dE_dt, "size_scalar": size_scalar,
        })

        return Signal(action="hold", reason=f"limit_order_p{phase}")

    def _check_fill(self, idx: int, row: pd.Series) -> Optional[Signal]:
        order = self._pending
        if order is None:
            return None

        if row["low"] <= order.price:
            fill_price = order.price

            if order.phase == 1:
                self._in_position = True
                self._entry_price = fill_price
                self._avg_entry_price = fill_price
                self._entry_bar = idx
                self._position_size = order.size
                self._phase_filled = 1
                self._stop_price = order.stop_price
                self._destab_counter = 0
            else:
                # Phase 2 conviction add-on
                total_cost = (self._avg_entry_price * self._position_size
                              + fill_price * order.size)
                self._position_size += order.size
                self._avg_entry_price = total_cost / self._position_size
                self._phase_filled = 2

            self._pending = None

            self._trade_log.append({
                "bar": idx, "event": f"fill_p{order.phase}",
                "price": fill_price, "size": order.size,
                "position_total": self._position_size,
                "phase": self._phase_filled,
            })

            return Signal(
                action="buy",
                size=order.size,
                reason=f"vpvr_fill_p{order.phase}",
                stop_loss=self._stop_price,
            )

        return None

    def _cancel(self, idx: int) -> None:
        self._pending = None
        self._last_cancel_bar = idx

    # ------------------------------------------------------------------
    # Exits (v3.1 exact)
    # ------------------------------------------------------------------

    def _check_exits(self, idx: int, regime: str,
                     dE_dt: float, price: float) -> Optional[Signal]:
        unrealised_pnl_pct = ((price - self._avg_entry_price) / self._avg_entry_price
                              if self._avg_entry_price > 0 else 0.0)

        # GATE 1 — Spatial stop (2% hard stop, always active)
        if price <= self._stop_price:
            return self._exit_all(idx, price, "spatial_stop")

        # GATE 1.5 — Profit ratchet (v5.2)
        if self.ratchet_milestones:
            for threshold, floor in self.ratchet_milestones:
                if unrealised_pnl_pct >= threshold:
                    self._profit_floor = max(self._profit_floor, floor)
            if self._profit_floor > 0:
                floor_price = self._avg_entry_price * (1 + self._profit_floor)
                if price <= floor_price:
                    return self._exit_all(idx, price, "profit_ratchet")

        # GATE 2 — R-regime: immediate exit
        if regime == "R":
            return self._exit_all(idx, price, "R_regime_exit")

        # GATE 3 — Destab: dE/dt > threshold for N consecutive bars
        # v5.2: asymmetric — 2x threshold when in profit
        if self.asymmetric_destab and unrealised_pnl_pct > 0:
            effective_threshold = self.destab_threshold * 2
        else:
            effective_threshold = self.destab_threshold

        if dE_dt > effective_threshold:
            self._destab_counter += 1
            if self._destab_counter >= self.destab_persistence:
                return self._exit_all(idx, price, "destab_exit")
        else:
            self._destab_counter = 0

        # GATE 4 — Time decay (v3.1): exit if held too long relative to MFPT
        if self._transition_matrix and self._in_position:
            bars_held = idx - self._entry_bar
            d_self = self._transition_matrix.get("D", {}).get("D", 0.5)
            if d_self < 1.0:
                mfpt = 1.0 / (1.0 - d_self)
                if bars_held > self.time_decay_K * mfpt:
                    return self._exit_all(idx, price, "time_decay")

        return None

    def _exit_all(self, idx: int, price: float, reason: str) -> Signal:
        self._exit_reasons[reason] = self._exit_reasons.get(reason, 0) + 1

        self._trade_log.append({
            "bar": idx, "event": "exit", "reason": reason,
            "price": price, "position": self._position_size,
            "bars_held": idx - self._entry_bar,
            "phase_filled": self._phase_filled,
            "entry_price": self._entry_price,
            "avg_entry": self._avg_entry_price,
        })

        self._pending = None
        self._in_position = False
        self._position_size = 0.0
        self._entry_price = 0.0
        self._avg_entry_price = 0.0
        self._entry_bar = 0
        self._phase_filled = 0
        self._stop_price = 0.0
        self._profit_floor = 0.0
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
