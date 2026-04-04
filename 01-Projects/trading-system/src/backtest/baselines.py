"""
Baseline strategies for comparison against DIR regime strategy.

1. BuyAndHold — enter at first bar, hold until end
2. MACrossover — 50/200 MA crossover (classic trend-following)
3. StaticTrendFollow — always use D-regime trend-follow logic (no regime switching)
4. StaticMeanRevert — always use I-regime mean-revert logic (no regime switching)
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from src.backtest.engine import Signal


class BuyAndHold:
    """Enter at first bar, hold until end."""

    def __init__(self):
        self._entered = False

    def name(self) -> str:
        return "Buy-and-Hold"

    def precompute(self, data: pd.DataFrame) -> None:
        pass

    def on_bar(self, idx: int, row: pd.Series, history: pd.DataFrame) -> Signal:
        if not self._entered and idx >= 1:
            self._entered = True
            return Signal(action="buy", size=0.95, reason="buy_and_hold_entry")
        return Signal(action="hold")


class MACrossover:
    """
    50/200 MA crossover strategy.
    Buy when MA50 crosses above MA200, sell when it crosses below.
    """

    def __init__(self, fast: int = 50, slow: int = 200):
        self.fast = fast
        self.slow = slow
        self._in_position = False
        self._ma_fast: pd.Series | None = None
        self._ma_slow: pd.Series | None = None

    def name(self) -> str:
        return f"MA-Crossover-{self.fast}/{self.slow}"

    def precompute(self, data: pd.DataFrame) -> None:
        close = data["close"]
        self._ma_fast = close.rolling(self.fast, min_periods=1).mean()
        self._ma_slow = close.rolling(self.slow, min_periods=1).mean()

    def on_bar(self, idx: int, row: pd.Series, history: pd.DataFrame) -> Signal:
        if idx < self.slow:
            return Signal(action="hold", reason="warmup")

        ma_f = float(self._ma_fast.iloc[idx])
        ma_s = float(self._ma_slow.iloc[idx])
        ma_f_prev = float(self._ma_fast.iloc[idx - 1])
        ma_s_prev = float(self._ma_slow.iloc[idx - 1])

        # Golden cross: buy
        if not self._in_position and ma_f > ma_s and ma_f_prev <= ma_s_prev:
            self._in_position = True
            return Signal(action="buy", size=0.9, reason="golden_cross",
                          trailing_stop_pct=0.05)

        # Death cross: sell
        if self._in_position and ma_f < ma_s and ma_f_prev >= ma_s_prev:
            self._in_position = False
            return Signal(action="sell", reason="death_cross")

        return Signal(action="hold")


class StaticTrendFollow:
    """
    Always trend-follow (D-regime logic) regardless of actual regime.
    Tests whether regime awareness adds value over static trend-following.
    """

    def __init__(self):
        self._in_position = False
        self._bars_in_trade = 0
        self._ma_fast: pd.Series | None = None
        self._ma_slow: pd.Series | None = None
        self._rsi: pd.Series | None = None

    def name(self) -> str:
        return "Static-Trend-Follow"

    def precompute(self, data: pd.DataFrame) -> None:
        close = data["close"]
        self._ma_fast = close.rolling(20, min_periods=1).mean()
        self._ma_slow = close.rolling(50, min_periods=1).mean()
        delta = close.diff()
        gain = delta.clip(lower=0).rolling(14, min_periods=1).mean()
        loss = (-delta.clip(upper=0)).rolling(14, min_periods=1).mean()
        rs = gain / loss.replace(0, np.nan)
        self._rsi = (100.0 - (100.0 / (1.0 + rs))).fillna(50.0)

    def on_bar(self, idx: int, row: pd.Series, history: pd.DataFrame) -> Signal:
        if idx < 50:
            return Signal(action="hold", reason="warmup")

        close = row["close"]
        ma_f = float(self._ma_fast.iloc[idx])
        ma_s = float(self._ma_slow.iloc[idx])
        rsi = float(self._rsi.iloc[idx])

        if self._in_position:
            self._bars_in_trade += 1
            if ma_f < ma_s and self._bars_in_trade > 6:
                self._in_position = False
                return Signal(action="sell", reason="ma_cross_exit")
            return Signal(action="hold")
        else:
            if close > ma_f and ma_f > ma_s and rsi < 70:
                if len(history) >= 48:
                    recent_high = history["high"].iloc[-48:].max()
                    if close >= recent_high * 0.97:
                        self._in_position = True
                        self._bars_in_trade = 0
                        return Signal(action="buy", size=0.9, reason="trend_breakout",
                                      trailing_stop_pct=0.06)
            return Signal(action="hold")


class StaticMeanRevert:
    """
    Always mean-revert (I-regime logic) regardless of actual regime.
    Tests whether regime awareness adds value over static mean-reversion.
    """

    def __init__(self):
        self._in_position = False
        self._bars_in_trade = 0
        self._ma_slow: pd.Series | None = None
        self._rsi: pd.Series | None = None

    def name(self) -> str:
        return "Static-Mean-Revert"

    def precompute(self, data: pd.DataFrame) -> None:
        close = data["close"]
        self._ma_slow = close.rolling(50, min_periods=1).mean()
        delta = close.diff()
        gain = delta.clip(lower=0).rolling(14, min_periods=1).mean()
        loss = (-delta.clip(upper=0)).rolling(14, min_periods=1).mean()
        rs = gain / loss.replace(0, np.nan)
        self._rsi = (100.0 - (100.0 / (1.0 + rs))).fillna(50.0)

    def on_bar(self, idx: int, row: pd.Series, history: pd.DataFrame) -> Signal:
        if idx < 50:
            return Signal(action="hold", reason="warmup")

        close = row["close"]
        ma_s = float(self._ma_slow.iloc[idx])
        rsi = float(self._rsi.iloc[idx])

        if self._in_position:
            self._bars_in_trade += 1
            if rsi > 55 or close > ma_s * 1.01:
                self._in_position = False
                return Signal(action="sell", reason="mean_revert_target")
            return Signal(action="hold")
        else:
            if rsi < 35 and close < ma_s:
                self._in_position = True
                self._bars_in_trade = 0
                return Signal(action="buy", size=0.7, reason="oversold_entry",
                              trailing_stop_pct=0.03)
            return Signal(action="hold")
