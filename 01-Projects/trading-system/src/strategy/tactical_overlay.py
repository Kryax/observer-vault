"""
Tactical Overlay: Dip-buying within confirmed D-regimes.

Macro layer: 72-bar persistence regime filter (pre-computed via walk-forward)
Tactical layer: buy pullbacks to EMA, sell rallies above EMA

Long only. No leverage. No shorting.
Multiple trades per D-regime to capture price oscillations.

Entry: price < EMA - entry_atr_mult × ATR during confirmed D-regime
Exit:  price > EMA + exit_atr_mult × ATR (take profit)
       OR macro regime flips to R (hard exit)
Stop:  entry_price - stop_atr_mult × ATR
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from src.backtest.engine import Signal


class TacticalOverlay:
    """
    Tactical dip-buying within confirmed D-regimes.

    Parameters
    ----------
    persistence_bars : bars required to confirm regime (applied to macro_regime)
    ema_period : EMA lookback for mean
    entry_atr_mult : buy when price < EMA - mult*ATR
    exit_atr_mult : sell when price > EMA + mult*ATR
    stop_atr_mult : stop loss at entry - mult*ATR
    position_frac : fraction of capital per trade
    min_confidence : min classifier confidence for D
    warmup_bars : skip first N bars
    atr_period : ATR lookback
    """

    def __init__(
        self,
        persistence_bars: int = 72,
        ema_period: int = 24,
        entry_atr_mult: float = 0.5,
        exit_atr_mult: float = 1.0,
        stop_atr_mult: float = 2.0,
        position_frac: float = 0.90,
        min_confidence: float = 0.3,
        warmup_bars: int = 100,
        atr_period: int = 14,
    ):
        self.persistence_bars = persistence_bars
        self.ema_period = ema_period
        self.entry_atr_mult = entry_atr_mult
        self.exit_atr_mult = exit_atr_mult
        self.stop_atr_mult = stop_atr_mult
        self.position_frac = position_frac
        self.min_confidence = min_confidence
        self.warmup_bars = warmup_bars
        self.atr_period = atr_period

        # Pre-computed series (set in precompute)
        self._ema: pd.Series | None = None
        self._atr: pd.Series | None = None

        # State
        self._in_position = False
        self._entry_price = 0.0
        self._confirmed_regime = "I"
        self._pending_regime = "I"
        self._pending_count = 0
        self._variant_name = ""

        # Diagnostics
        self.transition_log: list[dict] = []

    def name(self) -> str:
        return self._variant_name or "TacticalOverlay"

    def set_variant_name(self, name: str) -> None:
        self._variant_name = name

    def precompute(self, data: pd.DataFrame) -> None:
        """Pre-compute EMA and ATR over the full dataset."""
        close = data["close"]
        high = data["high"]
        low = data["low"]

        self._ema = close.ewm(span=self.ema_period, adjust=False).mean()

        # True range → ATR
        prev_close = close.shift(1)
        tr = pd.concat([
            high - low,
            (high - prev_close).abs(),
            (low - prev_close).abs(),
        ], axis=1).max(axis=1)
        self._atr = tr.ewm(span=self.atr_period, adjust=False).mean()

    def _update_regime(self, idx: int, row: pd.Series) -> str:
        """Apply persistence filter to macro_regime and return confirmed regime."""
        raw = str(row.get("macro_regime", "I"))

        if self.persistence_bars > 0:
            if raw == self._pending_regime:
                self._pending_count += 1
            else:
                self._pending_regime = raw
                self._pending_count = 1

            if self._pending_count >= self.persistence_bars and raw != self._confirmed_regime:
                old = self._confirmed_regime
                self._confirmed_regime = raw
                self.transition_log.append({
                    "idx": idx, "from": old, "to": raw,
                    "after_bars": self._pending_count,
                })
        else:
            if raw != self._confirmed_regime:
                old = self._confirmed_regime
                self._confirmed_regime = raw
                self.transition_log.append({
                    "idx": idx, "from": old, "to": raw,
                })

        return self._confirmed_regime

    def on_bar(self, idx: int, row: pd.Series, history: pd.DataFrame) -> Signal:
        if idx < self.warmup_bars:
            return Signal(action="hold", reason="warmup")

        if self._ema is None or self._atr is None:
            return Signal(action="hold", reason="no_precompute")

        regime = self._update_regime(idx, row)
        price = row["close"]
        ema = self._ema.iloc[idx]
        atr = self._atr.iloc[idx]

        if np.isnan(ema) or np.isnan(atr) or atr < 1e-10:
            return Signal(action="hold", reason="nan_indicator")

        # --- R-regime: hard exit, no trading ---
        if regime == "R":
            if self._in_position:
                self._in_position = False
                self._entry_price = 0.0
                return Signal(action="sell", size=1.0, reason="regime_R_exit")
            return Signal(action="hold", reason="regime_R_flat")

        # --- I-regime: hold existing, don't open new ---
        if regime == "I":
            if self._in_position:
                # Still check stop loss during I
                stop = self._entry_price - self.stop_atr_mult * atr
                if price <= stop:
                    self._in_position = False
                    self._entry_price = 0.0
                    return Signal(action="sell", size=1.0, reason="stop_in_I")
                # Check take profit during I too
                if price > ema + self.exit_atr_mult * atr:
                    self._in_position = False
                    self._entry_price = 0.0
                    return Signal(action="sell", size=1.0, reason="take_profit_in_I")
            return Signal(action="hold", reason="regime_I")

        # --- D-regime: active tactical trading ---
        confidence = float(row.get("confidence", 0.5))

        if self._in_position:
            # Check stop loss
            stop = self._entry_price - self.stop_atr_mult * atr
            if price <= stop:
                self._in_position = False
                self._entry_price = 0.0
                return Signal(action="sell", size=1.0, reason="stop_loss")

            # Check take profit: price above EMA + exit_atr_mult * ATR
            if price > ema + self.exit_atr_mult * atr:
                self._in_position = False
                self._entry_price = 0.0
                return Signal(action="sell", size=1.0, reason="take_profit")

            return Signal(action="hold", reason="in_position_D")

        else:
            # Look for entry: price below EMA - entry_atr_mult * ATR
            if confidence >= self.min_confidence and price < ema - self.entry_atr_mult * atr:
                self._in_position = True
                self._entry_price = price
                stop_price = price - self.stop_atr_mult * atr
                return Signal(
                    action="buy",
                    size=self.position_frac,
                    reason="dip_buy_D",
                    stop_loss=stop_price,
                )

            return Signal(action="hold", reason="waiting_dip_D")
