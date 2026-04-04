"""
Fast D/I/R feature computation from OHLCV data.

Drop-in replacement for indicators.py that avoids expensive per-window
DFA Hurst and GARCH calls. Uses vectorized approximations that preserve
relative ordering (suitable for clustering) while running ~100x faster.

12 features across three axes:
  D-axis (4): boundary creation / distinction-making
  I-axis (4): convergence / mean-reversion / integration
  R-axis (4): self-reinforcing feedback / recursion
"""

from __future__ import annotations
import numpy as np
import pandas as pd


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _log_returns(close: pd.Series) -> pd.Series:
    return np.log(close / close.shift(1))


def _atr(high: pd.Series, low: pd.Series, close: pd.Series, n: int) -> pd.Series:
    prev_close = close.shift(1)
    tr = pd.concat([
        high - low,
        (high - prev_close).abs(),
        (low - prev_close).abs(),
    ], axis=1).max(axis=1)
    return tr.rolling(n, min_periods=1).mean()


def _bollinger_width(close: pd.Series, n: int) -> pd.Series:
    mid = close.rolling(n, min_periods=1).mean()
    std = close.rolling(n, min_periods=1).std()
    upper = mid + 2 * std
    lower = mid - 2 * std
    return (upper - lower) / mid


def _vwap(close: pd.Series, volume: pd.Series, n: int) -> pd.Series:
    cumvol = volume.rolling(n, min_periods=1).sum()
    cumtp = (close * volume).rolling(n, min_periods=1).sum()
    return cumtp / cumvol.replace(0, np.nan)


# ---------------------------------------------------------------------------
# Fast Hurst approximation via rescaled range (R/S)
# Fully vectorized — no .apply()
# ---------------------------------------------------------------------------

def _rolling_hurst_fast(close: pd.Series, n: int) -> pd.Series:
    """
    Fast rolling Hurst exponent approximation.
    Uses the ratio of range/std as a proxy for R/S Hurst.

    H > 0.5 -> persistent (trending)
    H < 0.5 -> anti-persistent (mean-reverting)
    H = 0.5 -> random walk

    This is an approximation. The relative ordering across windows
    is preserved well enough for clustering.
    """
    lr = _log_returns(close)

    # Range and std of log returns
    roll_max = lr.rolling(n, min_periods=max(10, n // 2)).max()
    roll_min = lr.rolling(n, min_periods=max(10, n // 2)).min()
    roll_std = lr.rolling(n, min_periods=max(10, n // 2)).std()

    # R/S = range / std
    rs = (roll_max - roll_min) / roll_std.replace(0, np.nan)

    # H ≈ log(R/S) / log(n) — simplified R/S analysis
    h = np.log(rs.clip(lower=1e-10)) / np.log(n)

    return h.clip(0.0, 1.0).fillna(0.5)


# ---------------------------------------------------------------------------
# Fast vol clustering approximation
# Uses rolling absolute return autocorrelation instead of GARCH
# ---------------------------------------------------------------------------

def _rolling_vol_clustering_fast(close: pd.Series, n: int) -> pd.Series:
    """
    Fast volatility clustering proxy.
    corr(|r_t|, |r_{t-1}|) over rolling window.
    High correlation = GARCH-like clustering.
    """
    lr = _log_returns(close)
    abs_ret = lr.abs()
    abs_ret_lag = abs_ret.shift(1)

    # Rolling correlation of |r_t| and |r_{t-1}|
    cov = (abs_ret * abs_ret_lag).rolling(n, min_periods=max(10, n // 2)).mean() - \
          abs_ret.rolling(n, min_periods=max(10, n // 2)).mean() * \
          abs_ret_lag.rolling(n, min_periods=max(10, n // 2)).mean()

    std1 = abs_ret.rolling(n, min_periods=max(10, n // 2)).std()
    std2 = abs_ret_lag.rolling(n, min_periods=max(10, n // 2)).std()

    corr = cov / (std1 * std2).replace(0, np.nan)
    return corr.clip(0.0, 1.0).fillna(0.0)


# ---------------------------------------------------------------------------
# D-axis features
# ---------------------------------------------------------------------------

def realized_vol(close: pd.Series, n: int, annualize: float = np.sqrt(8760)) -> pd.Series:
    lr = _log_returns(close)
    return lr.rolling(n, min_periods=max(2, n // 2)).std() * annualize


def atr_ratio(high: pd.Series, low: pd.Series, close: pd.Series, n: int) -> pd.Series:
    atr_short = _atr(high, low, close, n)
    atr_long = _atr(high, low, close, 3 * n)
    return atr_short / atr_long.replace(0, np.nan)


def new_extremes(high: pd.Series, low: pd.Series, n: int) -> pd.Series:
    roll_high = high.rolling(n, min_periods=1).max()
    roll_low = low.rolling(n, min_periods=1).min()
    is_new_high = (high == roll_high).astype(float)
    is_new_low = (low == roll_low).astype(float)
    new_extreme = ((is_new_high + is_new_low) > 0).astype(float)
    return new_extreme.rolling(n, min_periods=1).mean()


def range_expansion(high: pd.Series, low: pd.Series, n: int) -> pd.Series:
    range_short = high.rolling(n, min_periods=1).max() - low.rolling(n, min_periods=1).min()
    range_long = high.rolling(3 * n, min_periods=1).max() - low.rolling(3 * n, min_periods=1).min()
    return range_short / range_long.replace(0, np.nan)


# ---------------------------------------------------------------------------
# I-axis features
# ---------------------------------------------------------------------------

def mean_reversion(close: pd.Series, n: int) -> pd.Series:
    """Fast mean reversion: uses vectorized lag-1 autocorrelation."""
    lr = _log_returns(close)
    lr_lag = lr.shift(1)

    cov = (lr * lr_lag).rolling(n, min_periods=max(10, n // 2)).mean() - \
          lr.rolling(n, min_periods=max(10, n // 2)).mean() * \
          lr_lag.rolling(n, min_periods=max(10, n // 2)).mean()

    std1 = lr.rolling(n, min_periods=max(10, n // 2)).std()
    std2 = lr_lag.rolling(n, min_periods=max(10, n // 2)).std()

    ac = cov / (std1 * std2).replace(0, np.nan)
    return (-ac).clip(lower=0.0).fillna(0.0)


def hurst_mr(close: pd.Series, n: int) -> pd.Series:
    """max(0, 0.5 - hurst) — anti-persistent component."""
    h = _rolling_hurst_fast(close, n)
    return (0.5 - h).clip(lower=0.0)


def vwap_proximity(close: pd.Series, volume: pd.Series,
                   high: pd.Series, low: pd.Series, n: int) -> pd.Series:
    vw = _vwap(close, volume, n)
    atr_val = _atr(high, low, close, n)
    deviation = (close - vw).abs() / atr_val.replace(0, np.nan)
    return (1.0 - deviation).clip(0.0, 1.0)


def band_compression(close: pd.Series, n: int) -> pd.Series:
    bb_w = _bollinger_width(close, n)
    bb_max = bb_w.rolling(3 * n, min_periods=1).max()
    return (1.0 - bb_w / bb_max.replace(0, np.nan)).clip(0.0, 1.0)


# ---------------------------------------------------------------------------
# R-axis features
# ---------------------------------------------------------------------------

def autocorr(close: pd.Series, n: int) -> pd.Series:
    """Fast positive autocorrelation via vectorized computation."""
    lr = _log_returns(close)
    lr_lag = lr.shift(1)

    cov = (lr * lr_lag).rolling(n, min_periods=max(10, n // 2)).mean() - \
          lr.rolling(n, min_periods=max(10, n // 2)).mean() * \
          lr_lag.rolling(n, min_periods=max(10, n // 2)).mean()

    std1 = lr.rolling(n, min_periods=max(10, n // 2)).std()
    std2 = lr_lag.rolling(n, min_periods=max(10, n // 2)).std()

    ac = cov / (std1 * std2).replace(0, np.nan)
    return ac.clip(lower=0.0).fillna(0.0)


def hurst_persist(close: pd.Series, n: int) -> pd.Series:
    """max(0, hurst - 0.5) — persistent component."""
    h = _rolling_hurst_fast(close, n)
    return (h - 0.5).clip(lower=0.0)


def vol_clustering(close: pd.Series, n: int) -> pd.Series:
    return _rolling_vol_clustering_fast(close, n)


def momentum_persist(close: pd.Series, n: int) -> pd.Series:
    """Serial return correlation, vectorized."""
    lr = _log_returns(close)
    lr_lag = lr.shift(1)

    cov = (lr * lr_lag).rolling(n, min_periods=max(5, n // 2)).mean() - \
          lr.rolling(n, min_periods=max(5, n // 2)).mean() * \
          lr_lag.rolling(n, min_periods=max(5, n // 2)).mean()

    std1 = lr.rolling(n, min_periods=max(5, n // 2)).std()
    std2 = lr_lag.rolling(n, min_periods=max(5, n // 2)).std()

    corr = cov / (std1 * std2).replace(0, np.nan)
    return corr.clip(lower=0.0).fillna(0.0)


# ---------------------------------------------------------------------------
# Compute all 12 features
# ---------------------------------------------------------------------------

def compute_all_features(df: pd.DataFrame, n: int) -> pd.DataFrame:
    o, h, l, c, v = df["open"], df["high"], df["low"], df["close"], df["volume"]
    features = pd.DataFrame(index=df.index)

    # D-axis
    features["realized_vol"] = realized_vol(c, n)
    features["atr_ratio"] = atr_ratio(h, l, c, n)
    features["new_extremes"] = new_extremes(h, l, n)
    features["range_expansion"] = range_expansion(h, l, n)

    # I-axis
    features["mean_reversion"] = mean_reversion(c, n)
    features["hurst_mr"] = hurst_mr(c, n)
    features["vwap_proximity"] = vwap_proximity(c, v, h, l, n)
    features["band_compression"] = band_compression(c, n)

    # R-axis
    features["autocorr"] = autocorr(c, n)
    features["hurst_persist"] = hurst_persist(c, n)
    features["vol_clustering"] = vol_clustering(c, n)
    features["momentum_persist"] = momentum_persist(c, n)

    return features


# Feature grouping
D_FEATURES = ["realized_vol", "atr_ratio", "new_extremes", "range_expansion"]
I_FEATURES = ["mean_reversion", "hurst_mr", "vwap_proximity", "band_compression"]
R_FEATURES = ["autocorr", "hurst_persist", "vol_clustering", "momentum_persist"]
ALL_FEATURES = D_FEATURES + I_FEATURES + R_FEATURES
