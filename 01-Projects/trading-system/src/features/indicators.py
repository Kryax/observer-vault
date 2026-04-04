"""
D/I/R feature computation from OHLCV data.

12 features across three axes:
  D-axis (4): boundary creation / distinction-making
  I-axis (4): convergence / mean-reversion / integration
  R-axis (4): self-reinforcing feedback / recursion

Each function operates on a pandas DataFrame with columns:
  open, high, low, close, volume
and a window parameter N (number of bars).
"""

from __future__ import annotations

import warnings
from typing import Optional

import numpy as np
import pandas as pd


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _log_returns(close: pd.Series) -> pd.Series:
    """Compute log returns from close prices."""
    return np.log(close / close.shift(1))


def _atr(high: pd.Series, low: pd.Series, close: pd.Series, n: int) -> pd.Series:
    """Average True Range over n bars."""
    prev_close = close.shift(1)
    tr = pd.concat([
        high - low,
        (high - prev_close).abs(),
        (low - prev_close).abs(),
    ], axis=1).max(axis=1)
    return tr.rolling(n, min_periods=1).mean()


def _bollinger_width(close: pd.Series, n: int) -> pd.Series:
    """Bollinger Band width (upper - lower) / middle."""
    mid = close.rolling(n, min_periods=1).mean()
    std = close.rolling(n, min_periods=1).std()
    upper = mid + 2 * std
    lower = mid - 2 * std
    # Width as fraction of middle band
    return (upper - lower) / mid


def _vwap(close: pd.Series, volume: pd.Series, n: int) -> pd.Series:
    """Rolling VWAP over n bars."""
    tp = close  # simplified: typical price = close
    cumvol = volume.rolling(n, min_periods=1).sum()
    cumtp = (tp * volume).rolling(n, min_periods=1).sum()
    return cumtp / cumvol.replace(0, np.nan)


def hurst_exponent(series: pd.Series, max_lag: Optional[int] = None) -> float:
    """
    Hurst exponent via Detrended Fluctuation Analysis (DFA).

    Expects a time series of returns or increments (stationary-ish).
    If given price levels, will difference first.

    Returns H in ~[0, 1]:
      H < 0.5 -> anti-persistent (mean-reverting)
      H = 0.5 -> random walk
      H > 0.5 -> persistent (trending)
    """
    data = series.dropna().values.astype(float)
    n = len(data)
    if n < 20:
        return 0.5  # not enough data, assume random walk

    # DFA works on the cumulative sum of the (mean-subtracted) series.
    # If the input looks like prices (all positive, monotonic-ish),
    # difference it first to get returns.
    # For returns or mixed-sign data, use directly.
    data_centered = data - np.mean(data)
    profile = np.cumsum(data_centered)

    # Choose box sizes (log-spaced)
    min_box = 4
    max_box = n // 4
    if max_box < min_box + 2:
        return 0.5

    box_sizes = np.unique(np.logspace(
        np.log10(min_box), np.log10(max_box), num=20
    ).astype(int))
    box_sizes = box_sizes[box_sizes >= min_box]

    if len(box_sizes) < 4:
        return 0.5

    fluctuations = []
    valid_boxes = []

    for box in box_sizes:
        n_boxes = n // box
        if n_boxes < 1:
            continue

        rms_list = []
        for i in range(n_boxes):
            segment = profile[i * box:(i + 1) * box]
            # Linear detrend
            x = np.arange(box, dtype=float)
            coeffs = np.polyfit(x, segment, 1)
            trend = np.polyval(coeffs, x)
            residual = segment - trend
            rms = np.sqrt(np.mean(residual ** 2))
            rms_list.append(rms)

        if rms_list:
            fluctuations.append(np.mean(rms_list))
            valid_boxes.append(box)

    if len(valid_boxes) < 4:
        return 0.5

    log_boxes = np.log(np.array(valid_boxes, dtype=float))
    log_fluct = np.log(np.array(fluctuations, dtype=float))

    mask = np.isfinite(log_boxes) & np.isfinite(log_fluct)
    if mask.sum() < 3:
        return 0.5

    # DFA exponent: slope of log(F) vs log(n)
    coeffs = np.polyfit(log_boxes[mask], log_fluct[mask], 1)
    h = float(coeffs[0])
    return np.clip(h, 0.0, 1.0)


# ---------------------------------------------------------------------------
# D-axis features (Distinction / boundary creation)
# ---------------------------------------------------------------------------

def realized_vol(close: pd.Series, n: int, annualize: float = np.sqrt(8760)) -> pd.Series:
    """
    Realized volatility: std(log_returns) * sqrt(annualization_factor).
    annualize default assumes 1h bars -> 8760 hours/year.
    """
    lr = _log_returns(close)
    return lr.rolling(n, min_periods=max(2, n // 2)).std() * annualize


def atr_ratio(high: pd.Series, low: pd.Series, close: pd.Series, n: int) -> pd.Series:
    """ATR(N) / ATR(3*N) -- range expansion vs contraction."""
    atr_short = _atr(high, low, close, n)
    atr_long = _atr(high, low, close, 3 * n)
    return atr_short / atr_long.replace(0, np.nan)


def new_extremes(high: pd.Series, low: pd.Series, n: int) -> pd.Series:
    """
    Fraction of bars in window that set new N-bar highs or lows.
    count(new_high or new_low over N) / N.
    """
    roll_high = high.rolling(n, min_periods=1).max()
    roll_low = low.rolling(n, min_periods=1).min()

    is_new_high = (high == roll_high).astype(float)
    is_new_low = (low == roll_low).astype(float)
    new_extreme = ((is_new_high + is_new_low) > 0).astype(float)

    return new_extreme.rolling(n, min_periods=1).mean()


def range_expansion(high: pd.Series, low: pd.Series, n: int) -> pd.Series:
    """(max-min over N) / (max-min over 3*N)."""
    range_short = high.rolling(n, min_periods=1).max() - low.rolling(n, min_periods=1).min()
    range_long = high.rolling(3 * n, min_periods=1).max() - low.rolling(3 * n, min_periods=1).min()
    return range_short / range_long.replace(0, np.nan)


# ---------------------------------------------------------------------------
# I-axis features (Integration / convergence)
# ---------------------------------------------------------------------------

def mean_reversion(close: pd.Series, n: int) -> pd.Series:
    """
    -autocorrelation(log_returns, lag=1), clipped >= 0.
    Negative autocorrelation = mean-reverting behavior.
    """
    lr = _log_returns(close)
    ac = lr.rolling(n, min_periods=max(10, n // 2)).apply(
        lambda x: pd.Series(x).autocorr(lag=1) if len(x) > 1 else 0.0,
        raw=False,
    )
    return (-ac).clip(lower=0.0)


def hurst_mr(close: pd.Series, n: int) -> pd.Series:
    """max(0, 0.5 - hurst_exponent) -- anti-persistent component."""
    lr = _log_returns(close)
    result = lr.rolling(n, min_periods=max(20, n // 2)).apply(
        lambda x: max(0.0, 0.5 - hurst_exponent(pd.Series(x))),
        raw=False,
    )
    return result.fillna(0.0)


def vwap_proximity(close: pd.Series, volume: pd.Series,
                   high: pd.Series, low: pd.Series, n: int) -> pd.Series:
    """1 - |close - VWAP| / ATR, clipped [0, 1]."""
    vw = _vwap(close, volume, n)
    atr_val = _atr(high, low, close, n)
    deviation = (close - vw).abs() / atr_val.replace(0, np.nan)
    return (1.0 - deviation).clip(0.0, 1.0)


def band_compression(close: pd.Series, n: int) -> pd.Series:
    """1 - BB_width / max(BB_width over 3*N)."""
    bb_w = _bollinger_width(close, n)
    bb_max = bb_w.rolling(3 * n, min_periods=1).max()
    return (1.0 - bb_w / bb_max.replace(0, np.nan)).clip(0.0, 1.0)


# ---------------------------------------------------------------------------
# R-axis features (Recursion / self-reinforcing feedback)
# ---------------------------------------------------------------------------

def autocorr(close: pd.Series, n: int) -> pd.Series:
    """max(0, autocorrelation(log_returns, lag=1)) -- positive persistence."""
    lr = _log_returns(close)
    ac = lr.rolling(n, min_periods=max(10, n // 2)).apply(
        lambda x: pd.Series(x).autocorr(lag=1) if len(x) > 1 else 0.0,
        raw=False,
    )
    return ac.clip(lower=0.0)


def hurst_persist(close: pd.Series, n: int) -> pd.Series:
    """max(0, hurst_exponent - 0.5) -- persistent component."""
    lr = _log_returns(close)
    result = lr.rolling(n, min_periods=max(20, n // 2)).apply(
        lambda x: max(0.0, hurst_exponent(pd.Series(x)) - 0.5),
        raw=False,
    )
    return result.fillna(0.0)


def vol_clustering(close: pd.Series, n: int) -> pd.Series:
    """
    GARCH(1,1) alpha+beta, clipped [0,1].
    Fallback: corr(sigma_t, sigma_{t-1}) on convergence failure.
    """
    lr = _log_returns(close)

    def _garch_or_fallback(x: np.ndarray) -> float:
        x = np.asarray(x, dtype=float)
        x = x[np.isfinite(x)]
        if len(x) < 30:
            return _vol_autocorr_fallback(x)

        try:
            from arch import arch_model
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                am = arch_model(x * 100, vol="Garch", p=1, q=1, mean="Zero",
                                rescale=False)
                res = am.fit(disp="off", show_warning=False)
                alpha = res.params.get("alpha[1]", 0.0)
                beta = res.params.get("beta[1]", 0.0)
                val = alpha + beta
                if np.isfinite(val):
                    return float(np.clip(val, 0.0, 1.0))
                return _vol_autocorr_fallback(x)
        except Exception:
            return _vol_autocorr_fallback(x)

    def _vol_autocorr_fallback(x: np.ndarray) -> float:
        """corr(sigma_t, sigma_{t-1}) using rolling realized vol."""
        if len(x) < 10:
            return 0.0
        # Use absolute returns as volatility proxy
        abs_ret = np.abs(x)
        if len(abs_ret) < 2:
            return 0.0
        corr = np.corrcoef(abs_ret[:-1], abs_ret[1:])[0, 1]
        if np.isfinite(corr):
            return float(np.clip(corr, 0.0, 1.0))
        return 0.0

    return lr.rolling(n, min_periods=min(n, max(10, n // 2))).apply(
        _garch_or_fallback, raw=True
    ).fillna(0.0)


def momentum_persist(close: pd.Series, n: int) -> pd.Series:
    """
    correlation(returns[t], returns[t+1]) over N, clipped >= 0.
    Serial return correlation = recursion in returns.
    """
    lr = _log_returns(close)

    def _serial_corr(x: np.ndarray) -> float:
        x = np.asarray(x, dtype=float)
        x = x[np.isfinite(x)]
        if len(x) < 5:
            return 0.0
        corr = np.corrcoef(x[:-1], x[1:])[0, 1]
        if np.isfinite(corr):
            return float(max(0.0, corr))
        return 0.0

    return lr.rolling(n, min_periods=max(5, n // 2)).apply(
        _serial_corr, raw=True
    ).fillna(0.0)


# ---------------------------------------------------------------------------
# Compute all 12 features
# ---------------------------------------------------------------------------

def compute_all_features(df: pd.DataFrame, n: int) -> pd.DataFrame:
    """
    Compute all 12 D/I/R features from an OHLCV DataFrame.

    Parameters
    ----------
    df : DataFrame with columns: open, high, low, close, volume
    n  : rolling window size (bars)

    Returns
    -------
    DataFrame with 12 feature columns, indexed same as input.
    """
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


# Feature grouping for axis aggregation
D_FEATURES = ["realized_vol", "atr_ratio", "new_extremes", "range_expansion"]
I_FEATURES = ["mean_reversion", "hurst_mr", "vwap_proximity", "band_compression"]
R_FEATURES = ["autocorr", "hurst_persist", "vol_clustering", "momentum_persist"]
ALL_FEATURES = D_FEATURES + I_FEATURES + R_FEATURES
