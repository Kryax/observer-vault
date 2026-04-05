"""
Multi-Timeframe D/I/R Classifier

Classifies regime at two timeframes:
  Layer 1 — Macro: daily candles, 30-bar window (30 days)
  Layer 2 — Decision: hourly candles, 168-bar window (7 days)

Alignment signals:
  ALIGNED_BULLISH: both D → highest conviction (full size)
  PARTIAL:         hourly D, daily I → moderate conviction (50% size)
  COUNTER_TREND:   hourly D, daily R → skip entry
  ALIGNED_BEARISH: both R → no trades

Macro regime is resampled from hourly data. Features are precomputed once,
then per-fold classification just slices the precomputed vectors.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from src.features.indicators_fast import compute_all_features
from src.features.vectorizer import vectorize_pipeline
from src.classifier.price_landscape import PriceLandscape


def resample_to_daily(hourly: pd.DataFrame) -> pd.DataFrame:
    """Resample hourly OHLCV to daily."""
    daily = hourly.resample("1D").agg({
        "open": "first",
        "high": "max",
        "low": "min",
        "close": "last",
        "volume": "sum",
    }).dropna()
    return daily


class MultiTimeframeClassifier:
    """
    Two-layer regime classifier with precomputed daily features.

    Usage:
        mtf = MultiTimeframeClassifier()
        mtf.precompute(hourly_data)  # once per token
        macro_series = mtf.get_macro_for_fold(train_end_ts, test_end_ts)
    """

    def __init__(self, macro_window: int = 30, k: int = 3):
        self.macro_window = macro_window
        self.k = k
        self._daily = None
        self._daily_vecs = None
        self._precomputed = False

    def precompute(self, hourly_data: pd.DataFrame) -> None:
        """Precompute daily candles and feature vectors once."""
        self._daily = resample_to_daily(hourly_data)
        if len(self._daily) < self.macro_window + 50:
            self._daily_vecs = None
            self._precomputed = True
            return

        daily_features = compute_all_features(self._daily, self.macro_window)
        self._daily_vecs = vectorize_pipeline(daily_features).dropna()
        self._precomputed = True

    def compute_macro_regimes(
        self,
        hourly_data: pd.DataFrame,
        train_start: int,
        train_end: int,
        test_end: int,
    ) -> pd.Series:
        """
        Compute macro D/I/R regimes for the test period of this fold.

        Uses precomputed daily vectors — only fits PriceLandscape per fold.
        """
        hourly_idx = hourly_data.iloc[train_end:test_end].index
        fallback = pd.Series("I", index=hourly_idx, name="macro_regime")

        if not self._precomputed or self._daily_vecs is None:
            return fallback

        if len(self._daily_vecs) < 100:
            return fallback

        train_end_ts = hourly_data.index[min(train_end, len(hourly_data) - 1)]
        test_end_ts = hourly_data.index[min(test_end - 1, len(hourly_data) - 1)]

        daily_train = self._daily_vecs.loc[self._daily_vecs.index <= train_end_ts]
        daily_test = self._daily_vecs.loc[
            (self._daily_vecs.index > train_end_ts) &
            (self._daily_vecs.index <= test_end_ts)
        ]

        if len(daily_train) < 50 or len(daily_test) < 5:
            return fallback

        # Fit landscape on daily train data
        ls = PriceLandscape()
        ls.fit(daily_train.values, k=self.k)

        # Classify daily test bars
        daily_regimes = {}
        for i in range(len(daily_test)):
            vec = daily_test.values[i]
            er = ls._compute_energy(vec)
            nearest_label = er["nearest_basin"]
            regime = ls.get_regime_for_label(nearest_label)
            daily_regimes[daily_test.index[i]] = regime

        daily_regime_series = pd.Series(daily_regimes, name="macro_regime").sort_index()

        # Forward-fill daily regime to hourly index
        macro = daily_regime_series.reindex(hourly_idx, method="ffill")
        macro = macro.fillna("I")

        return macro


def macro_size_multiplier(macro_regime: str) -> float:
    """Position size multiplier based on macro regime."""
    if macro_regime == "D":
        return 1.0
    elif macro_regime == "I":
        return 0.5
    else:
        return 0.0
