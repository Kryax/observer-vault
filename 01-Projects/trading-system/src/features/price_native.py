"""
Price-native D/I/R feature engine.

Four features grounded in financial mathematics:
  1. Hurst exponent — trend persistence (D-axis)
  2. Log returns — direction/drift
  3. Realized volatility — consolidation/expansion (I-axis)
  4. Serial autocorrelation — reflexivity/feedback (R-axis)
"""

import numpy as np
import pandas as pd


def hurst_exponent(prices: np.ndarray, max_lag: int = 50) -> float:
    """
    Hurst exponent via R/S analysis (vectorised per lag).
    H > 0.5: trending, H = 0.5: random walk, H < 0.5: mean-reverting.
    """
    n = len(prices)
    lags = np.arange(2, min(max_lag, n // 2))
    if len(lags) < 10:
        return 0.5

    log_tau = np.empty(len(lags))
    valid = 0
    for idx, lag in enumerate(lags):
        n_blocks = n // lag
        pp = prices[:n_blocks * lag].reshape(n_blocks, lag)
        means = pp.mean(axis=1, keepdims=True)
        stds = pp.std(axis=1)
        mask = stds > 0
        if not mask.any():
            continue
        cumdev = np.cumsum(pp[mask] - means[mask], axis=1)
        rs = (cumdev.max(axis=1) - cumdev.min(axis=1)) / stds[mask]
        log_tau[valid] = np.log(rs.mean())
        valid += 1

    if valid < 10:
        return 0.5

    log_lags = np.log(lags[:valid].astype(float))
    poly = np.polyfit(log_lags, log_tau[:valid], 1)
    return float(poly[0])


def compute_price_native_features(
    data: pd.DataFrame,
    hurst_window: int = 168,
    return_window: int = 24,
    vol_window: int = 24,
    autocorr_window: int = 48,
    hurst_stride: int = 6,
) -> pd.DataFrame:
    """
    Compute all 4 price-native features for each bar.

    Hurst is computed every `hurst_stride` bars and forward-filled for speed.
    Other features are fully vectorised.
    """
    prices = data["close"].values.astype(np.float64)
    log_prices = np.log(np.maximum(prices, 1e-12))
    log_rets = np.diff(log_prices)

    n = len(data)

    # --- Log return: vectorised ---
    lr_arr = np.zeros(n)
    lr_arr[return_window:] = log_prices[return_window:] - log_prices[:-return_window]

    # --- Realized vol: vectorised rolling std ---
    rv_arr = np.zeros(n)
    if n > vol_window + 1:
        # Compute rolling std of log_rets using cumsum trick
        cs = np.cumsum(log_rets)
        cs2 = np.cumsum(log_rets ** 2)
        for i in range(vol_window, len(log_rets)):
            s = cs[i] - cs[i - vol_window]
            s2 = cs2[i] - cs2[i - vol_window]
            var = s2 / vol_window - (s / vol_window) ** 2
            rv_arr[i + 1] = np.sqrt(max(var, 0)) * np.sqrt(24 * 365)

    # --- Autocorrelation: vectorised via strided views ---
    ac_arr = np.zeros(n)
    if len(log_rets) > autocorr_window:
        w = autocorr_window - 1  # lag-1 pairs within window
        for i in range(autocorr_window + 1, len(log_rets)):
            x = log_rets[i - autocorr_window:i - 1]
            y = log_rets[i - autocorr_window + 1:i]
            mx, my = x.mean(), y.mean()
            dx, dy = x - mx, y - my
            denom = np.sqrt((dx * dx).sum() * (dy * dy).sum())
            if denom > 0:
                ac_arr[i + 1] = (dx * dy).sum() / denom

    # --- Hurst: rolling with stride + forward-fill ---
    hurst_arr = np.full(n, 0.5)
    computed = set()
    for i in range(hurst_window, n, hurst_stride):
        hurst_arr[i] = hurst_exponent(prices[i - hurst_window:i + 1])
        computed.add(i)
    # Forward-fill between computed points
    last_val = 0.5
    for i in range(hurst_window, n):
        if i in computed:
            last_val = hurst_arr[i]
        else:
            hurst_arr[i] = last_val

    return pd.DataFrame(
        {
            "hurst": hurst_arr,
            "log_return": lr_arr,
            "realized_vol": rv_arr,
            "autocorrelation": ac_arr,
        },
        index=data.index,
    )
