"""
Langevin-Native Trading Strategy

Trade energy dynamics, not price labels.

The K=3 energy landscape has a fundamental property: D-classified points
sit at high energy relative to the Gaussian wells. gradient_direction
and barrier_height are not useful for allocation. Instead, we trade:

1. dE/dt — the RATE of energy change. Falling energy = market stabilising
   into a D-basin. This is a leading indicator: dE/dt goes positive
   BEFORE the regime label flips.
2. Regime persistence — how long we've been in D, relative to the
   expected D-duration from the empirical transition matrix.
3. Confidence — classification confidence as signal quality.
4. Smoothed energy level — relative to recent history.

Time-decay exit: expected D-duration from transition matrix replaces
energy-based MFPT (since barrier heights are unreliable).

D->I->D macro-basin: empirically NOT the dominant cycle for any token
(P(I->R) > P(I->D) universally). Strategy correctly exits on I-regime.
"""

from __future__ import annotations

import math
from typing import Optional

import numpy as np
import pandas as pd

from src.backtest.engine import Signal


class LangevinNativeStrategy:

    def __init__(
        self,
        # Allocation
        entry_threshold: float = 0.30,
        exit_threshold: float = 0.10,
        max_position_frac: float = 0.35,
        # Energy smoothing
        dE_dt_window: int = 6,
        dE_dt_norm: float = 0.05,
        # Confidence
        min_confidence: float = 0.4,
        # Time-decay (MFPT proxy from transition matrix)
        transition_matrix: Optional[dict] = None,
        time_decay_multiple: float = 2.0,
        # Destabilisation exit
        destab_dE_dt_threshold: float = 0.08,
        destab_persistence: int = 3,
        # Capital preservation
        max_loss_pct: float = 0.05,
        # Position scaling
        scale_up_rate: float = 0.25,
        scale_down_rate: float = 0.40,
        # Macro-basin
        macro_basin_hold: bool = False,
        # General
        warmup_bars: int = 100,
        atr_period: int = 14,
        # D-regime dip buy (consecutive D-bars signal)
        d_persistence_entry: int = 3,
    ):
        self.entry_threshold = entry_threshold
        self.exit_threshold = exit_threshold
        self.max_position_frac = max_position_frac
        self.dE_dt_window = dE_dt_window
        self.dE_dt_norm = dE_dt_norm
        self.min_confidence = min_confidence
        self.time_decay_multiple = time_decay_multiple
        self.destab_dE_dt_threshold = destab_dE_dt_threshold
        self.destab_persistence = destab_persistence
        self.max_loss_pct = max_loss_pct
        self.scale_up_rate = scale_up_rate
        self.scale_down_rate = scale_down_rate
        self.macro_basin_hold = macro_basin_hold
        self.warmup_bars = warmup_bars
        self.atr_period = atr_period
        self.d_persistence_entry = d_persistence_entry

        # Transition matrix derived values
        self._transition_matrix = transition_matrix
        self._expected_d_duration = self._compute_expected_duration(transition_matrix, "D")
        self._d_i_d_safe = self._check_macro_basin(transition_matrix)
        if macro_basin_hold:
            self._d_i_d_safe = True  # force override

        # State
        self._current_w = 0.0
        self._position_size = 0.0
        self._entry_price = 0.0
        self._entry_bar = 0
        self._in_position = False
        self._energy_history: list[float] = []
        self._regime_history: list[str] = []
        self._consecutive_d_bars = 0
        self._destab_counter = 0

        # Pre-computed
        self._atr: Optional[pd.Series] = None

        # Logging
        self._trade_log: list[dict] = []
        self._diagnostics: list[dict] = []

    @staticmethod
    def _compute_expected_duration(tm: Optional[dict], regime: str) -> float:
        if tm is None:
            return 30.0  # default
        p_stay = tm.get(regime, {}).get(regime, 0.95)
        if p_stay >= 1.0:
            return 10000.0
        return 1.0 / (1.0 - p_stay)

    @staticmethod
    def _check_macro_basin(tm: Optional[dict]) -> bool:
        if tm is None:
            return False
        p_i_to_d = tm.get("I", {}).get("D", 0.0)
        p_i_to_r = tm.get("I", {}).get("R", 0.0)
        return p_i_to_d > p_i_to_r

    def name(self) -> str:
        return "Langevin-Native"

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
        transition_score = float(row.get("transition_score", 0.5))
        price = float(row["close"])

        self._energy_history.append(energy)
        self._regime_history.append(regime)

        # Track consecutive D-bars
        if regime == "D":
            self._consecutive_d_bars += 1
        else:
            self._consecutive_d_bars = 0

        # --- Compute smoothed dE/dt ---
        dE_dt_smooth = self._smoothed_dE_dt()

        # --- Compute allocation scalar w(t) ---
        w = self._compute_w(regime, confidence, dE_dt_smooth)

        # --- EXIT CHECKS (before entry) ---

        if self._in_position:
            # 1. Capital preservation stop
            if self._entry_price > 0:
                loss_pct = (self._entry_price - price) / self._entry_price
                if loss_pct > self.max_loss_pct:
                    return self._exit_full(idx, price, "capital_stop")

            # 2. Regime exit: not in D (and not in I with macro-basin safe)
            if regime == "R":
                return self._exit_full(idx, price, "R_regime_exit")
            if regime == "I" and not self._d_i_d_safe:
                return self._exit_full(idx, price, "I_regime_exit")

            # 3. Time-decay exit (MFPT proxy)
            bars_held = idx - self._entry_bar
            if bars_held > self._expected_d_duration * self.time_decay_multiple:
                return self._exit_full(idx, price, "time_decay")

            # 4. Energy destabilisation: sustained positive dE/dt
            if dE_dt_smooth > self.destab_dE_dt_threshold:
                self._destab_counter += 1
                if self._destab_counter >= self.destab_persistence:
                    return self._exit_full(idx, price, "energy_destabilisation")
            else:
                self._destab_counter = 0

        # --- Smooth w transition ---
        if w > self._current_w:
            self._current_w += (w - self._current_w) * self.scale_up_rate
        else:
            self._current_w += (w - self._current_w) * self.scale_down_rate
        self._current_w = max(0.0, min(1.0, self._current_w))

        target_position = self._current_w * self.max_position_frac

        # Log diagnostics
        if idx % 10 == 0 or self._in_position:
            self._diagnostics.append({
                "bar": idx, "energy": round(energy, 4),
                "dE_dt_smooth": round(dE_dt_smooth, 6),
                "w": round(self._current_w, 4),
                "regime": regime, "confidence": round(confidence, 3),
                "consecutive_d": self._consecutive_d_bars,
            })

        # --- ENTRY ---
        if not self._in_position and self._current_w > self.entry_threshold:
            if regime == "D" and self._consecutive_d_bars >= self.d_persistence_entry:
                self._in_position = True
                self._entry_price = price
                self._entry_bar = idx
                self._position_size = target_position
                self._destab_counter = 0

                self._trade_log.append({
                    "bar": idx, "event": "entry", "price": price,
                    "w": self._current_w, "regime": regime,
                    "dE_dt": dE_dt_smooth, "confidence": confidence,
                    "expected_d_dur": self._expected_d_duration,
                    "consecutive_d": self._consecutive_d_bars,
                })

                return Signal(
                    action="buy",
                    size=target_position,
                    reason=f"langevin_entry_w={self._current_w:.2f}",
                    stop_loss=price * (1 - self.max_loss_pct),
                )

        # --- SCALE position ---
        if self._in_position:
            # Scale up
            if (target_position > self._position_size * 1.25
                    and target_position - self._position_size > 0.03):
                add = target_position - self._position_size
                self._position_size = target_position
                self._trade_log.append({
                    "bar": idx, "event": "scale_up",
                    "price": price, "add": add,
                })
                return Signal(action="buy", size=add,
                              reason=f"scale_up_w={self._current_w:.2f}")

            # Scale down (partial exit)
            if (self._position_size > target_position * 1.4
                    and self._position_size - target_position > 0.03):
                trim = self._position_size - target_position
                frac = trim / self._position_size
                self._position_size = target_position
                self._trade_log.append({
                    "bar": idx, "event": "scale_down",
                    "price": price, "trim": trim,
                })
                return Signal(action="sell", size=frac,
                              reason=f"scale_down_w={self._current_w:.2f}")

            # Exit on low w
            if self._current_w < self.exit_threshold:
                return self._exit_full(idx, price,
                                       f"w_exit_{self._current_w:.2f}")

        return Signal(action="hold", reason=f"w={self._current_w:.2f}")

    # ------------------------------------------------------------------
    # Allocation computation
    # ------------------------------------------------------------------

    def _compute_w(self, regime: str, confidence: float,
                   dE_dt_smooth: float) -> float:
        """
        Continuous allocation scalar [0, 1].

        Components:
          1. stabilisation_score: how fast energy is falling (negative dE/dt)
          2. confidence_score: classification quality
          3. freshness: how early in the D-regime we are
        """
        # Only allocate in D-regime (or I with macro-basin)
        if regime == "R":
            return 0.0
        if regime == "I" and not self._d_i_d_safe:
            return 0.0

        # 1. Stabilisation: negative dE/dt = energy falling = good
        # Normalise: typical dE/dt magnitudes are 0.001 to 0.1
        stab_raw = -dE_dt_smooth / self.dE_dt_norm
        stabilisation = max(0.0, min(1.0, stab_raw))

        # Boost: if energy is already low (stabilised), maintain allocation
        # even when dE/dt is near zero (flat at basin floor)
        if self._in_position and abs(dE_dt_smooth) < self.dE_dt_norm * 0.3:
            stabilisation = max(stabilisation, 0.5)  # floor when flat

        # 2. Confidence
        conf_score = max(0.0, min(1.0,
                                  (confidence - self.min_confidence)
                                  / (1.0 - self.min_confidence)))

        # 3. Freshness: early D-regimes are better opportunities
        if self._expected_d_duration > 0:
            time_ratio = self._consecutive_d_bars / self._expected_d_duration
            freshness = max(0.0, 1.0 - time_ratio * 0.5)  # slow decay
        else:
            freshness = 1.0

        # Combine: multiplicative for entry, but additive floor for holding
        w = stabilisation * conf_score * freshness

        # D-regime persistence bonus: if we've been in D for a while,
        # the regime is validated — boost w
        if regime == "D" and self._consecutive_d_bars >= self.d_persistence_entry:
            persistence_bonus = min(0.3, self._consecutive_d_bars * 0.05)
            w = max(w, conf_score * freshness * persistence_bonus / 0.3)

        return w

    def _smoothed_dE_dt(self) -> float:
        """EMA-smoothed rate of energy change."""
        if len(self._energy_history) < 2:
            return 0.0
        window = min(self.dE_dt_window, len(self._energy_history) - 1)
        energies = self._energy_history[-(window + 1):]
        # Simple differences
        diffs = [energies[i + 1] - energies[i] for i in range(len(energies) - 1)]
        # EMA weighting
        alpha = 2.0 / (len(diffs) + 1)
        ema = diffs[0]
        for d in diffs[1:]:
            ema = alpha * d + (1 - alpha) * ema
        return ema

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _exit_full(self, idx: int, price: float, reason: str) -> Signal:
        self._trade_log.append({
            "bar": idx, "event": "exit", "price": price,
            "reason": reason, "w": self._current_w,
            "bars_held": idx - self._entry_bar,
        })
        self._in_position = False
        self._position_size = 0.0
        self._entry_price = 0.0
        self._entry_bar = 0
        self._current_w = 0.0
        self._destab_counter = 0
        return Signal(action="sell", size=1.0, reason=reason)

    def get_trade_log(self) -> list[dict]:
        return self._trade_log

    def get_diagnostics(self) -> list[dict]:
        return self._diagnostics
