"""
Cumulative Volume Delta (CVD) from OHLCV data.

Approximates buy/sell volume from bar direction:
  close > open: bar volume = buy
  close < open: bar volume = sell
  close == open: split 50/50

CVD = cumulative sum of (buy_volume - sell_volume)
"""

from __future__ import annotations

import numpy as np
import pandas as pd


def compute_cvd(df: pd.DataFrame) -> pd.Series:
    """
    Compute Cumulative Volume Delta from OHLCV.

    Returns pd.Series of cumulative delta values aligned to df.index.
    """
    close = df["close"].values
    open_ = df["open"].values
    volume = df["volume"].values

    delta = np.where(
        close > open_, volume,
        np.where(close < open_, -volume, 0.0)
    )
    return pd.Series(np.cumsum(delta), index=df.index, name="cvd")


def cvd_trend(cvd: pd.Series, window: int = 24) -> pd.Series:
    """
    Rolling slope of CVD over window using linear regression slope.

    Positive = buying pressure (CVD rising).
    Negative = selling pressure (CVD falling).

    Returns normalized slope (slope / std of CVD in window) for comparability.
    """
    # Simple approach: difference over window, normalized
    cvd_diff = cvd.diff(window)
    cvd_std = cvd.rolling(window, min_periods=max(1, window // 2)).std()
    cvd_std = cvd_std.replace(0, np.nan)
    slope = (cvd_diff / cvd_std).fillna(0.0)
    return slope


def cvd_confidence_modifier(
    cvd_slope: pd.Series,
    regime: str,
    max_modifier: float = 0.20,
) -> pd.Series:
    """
    Compute confidence modifier from CVD trend.

    In D-regime:
      rising CVD -> positive modifier (up to +max_modifier)
      falling CVD -> negative modifier (down to -max_modifier)

    In I/R regime: modifier is 0 (CVD not used for entry decisions).

    Returns Series of multipliers centered at 1.0.
    """
    if regime != "D":
        return pd.Series(1.0, index=cvd_slope.index)

    # Clip slope to [-3, 3] range, then scale to [-max_modifier, +max_modifier]
    clipped = cvd_slope.clip(-3.0, 3.0) / 3.0
    modifier = 1.0 + clipped * max_modifier
    return modifier
