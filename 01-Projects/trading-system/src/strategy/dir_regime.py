"""
DIR Regime Strategy — regime-timing with confidence-based position sizing.

Core idea: Be long BTC when regime is favorable (D/I), flat when dangerous (R).
Exit to cash only when R-regime is confirmed stable (long grace period to avoid
short whipsaw exits from fleeting R classifications).

Position sizing: base_size * confidence_adj * regime_multiplier
  D: multiplier 1.0 (full conviction)
  I: multiplier 0.6 (moderate)
  R: multiplier 0.0 (flat — but only after R is confirmed stable)

D↔I transitions do NOT trigger exits (both favorable).
Only R-regime transitions trigger exits, after grace period.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from src.backtest.engine import Signal


class DIRRegimeStrategy:
    """
    Regime-timing DIR strategy. Long in D/I, flat in confirmed R.
    Requires data columns: close, high, low, volume, regime, confidence
    """

    def __init__(self,
                 base_size: float = 0.90,
                 confidence_floor: float = 0.15,
                 d_trailing_stop: float = 0.15,
                 i_trailing_stop: float = 0.12,
                 rsi_period: int = 14,
                 rsi_overbought: float = 80.0,
                 r_exit_grace: int = 36,
                 r_reentry_grace: int = 6,
                 ):
        self.base_size = base_size
        self.confidence_floor = confidence_floor
        self.d_trailing_stop = d_trailing_stop
        self.i_trailing_stop = i_trailing_stop
        self.rsi_period = rsi_period
        self.rsi_overbought = rsi_overbought
        self.r_exit_grace = r_exit_grace
        self.r_reentry_grace = r_reentry_grace

        self._in_position = False
        self._entry_regime = None
        self._bars_in_trade = 0
        self._bars_since_last_exit = 999
        self._consecutive_r_bars = 0
        self._consecutive_non_r_bars = 0

        self._rsi_cache: pd.Series | None = None

    def name(self) -> str:
        return "DIR-Regime"

    def precompute(self, data: pd.DataFrame) -> None:
        close = data["close"]
        delta = close.diff()
        gain = delta.clip(lower=0).rolling(self.rsi_period, min_periods=1).mean()
        loss = (-delta.clip(upper=0)).rolling(self.rsi_period, min_periods=1).mean()
        rs = gain / loss.replace(0, np.nan)
        self._rsi_cache = (100.0 - (100.0 / (1.0 + rs))).fillna(50.0)

    def _position_size(self, regime: str, confidence: float) -> float:
        multipliers = {"D": 1.0, "I": 0.6, "R": 0.0}
        mult = multipliers.get(regime, 0.0)
        conf_adj = max(confidence, self.confidence_floor)
        size = self.base_size * conf_adj * mult
        return max(0.1, min(size, 0.95))

    def _trailing_stop_for_regime(self, regime: str) -> float:
        return {"D": self.d_trailing_stop, "I": self.i_trailing_stop}.get(regime, 0.12)

    def on_bar(self, idx: int, row: pd.Series, history: pd.DataFrame) -> Signal:
        regime = row.get("regime", "I")
        confidence = float(row.get("confidence", 0.0))
        rsi = float(self._rsi_cache.iloc[idx]) if self._rsi_cache is not None else 50.0

        # Track consecutive R / non-R bars
        if regime == "R":
            self._consecutive_r_bars += 1
            self._consecutive_non_r_bars = 0
        else:
            self._consecutive_r_bars = 0
            self._consecutive_non_r_bars += 1

        if self._in_position:
            self._bars_in_trade += 1
            return self._check_exit(regime, confidence, rsi, row)
        else:
            self._bars_since_last_exit += 1
            return self._check_entry(idx, regime, confidence, rsi, row)

    def _check_entry(self, idx: int, regime: str, confidence: float,
                     rsi: float, row: pd.Series) -> Signal:
        # Wait for warmup
        if idx < 50:
            return Signal(action="hold", reason="warmup")

        # Don't enter during R-regime
        if regime == "R":
            return Signal(action="hold", reason="R_flat")

        # After exiting R, wait for non-R regime to stabilize
        if self._consecutive_non_r_bars < self.r_reentry_grace:
            return Signal(action="hold", reason="reentry_cooldown")

        # Don't enter at extreme overbought
        if rsi > self.rsi_overbought:
            return Signal(action="hold", reason="overbought")

        size = self._position_size(regime, confidence)
        self._in_position = True
        self._entry_regime = regime
        self._bars_in_trade = 0
        return Signal(
            action="buy", size=size,
            reason=f"{regime}_regime_entry",
            trailing_stop_pct=None,  # regime detector IS the risk management
        )

    def _check_exit(self, regime: str, confidence: float,
                    rsi: float, row: pd.Series) -> Signal:
        # Only exit when R-regime is CONFIRMED stable (not a flicker)
        if self._consecutive_r_bars >= self.r_exit_grace:
            self._in_position = False
            self._bars_since_last_exit = 0
            self._entry_regime = None
            return Signal(action="sell", reason="confirmed_R_exit")

        # Confidence total collapse (very rare)
        if confidence < 0.03:
            self._in_position = False
            self._bars_since_last_exit = 0
            self._entry_regime = None
            return Signal(action="sell", reason="confidence_collapse")

        # D↔I transitions: both favorable, update tracking but stay in
        if regime in ("D", "I") and regime != self._entry_regime:
            self._entry_regime = regime

        return Signal(action="hold", reason="hold_position")
