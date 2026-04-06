"""
Price-native feature engine — v6 (2 features only).

1. Log returns — direction + magnitude
2. Realized volatility — regime energy
"""

import numpy as np
import pandas as pd


def compute_price_native_features(
    data: pd.DataFrame,
    return_window: int = 24,
    vol_window: int = 24,
) -> pd.DataFrame:
    prices = data["close"].values.astype(np.float64)
    log_prices = np.log(np.maximum(prices, 1e-12))
    log_rets = np.diff(log_prices)

    n = len(data)

    # Log return: vectorised
    lr_arr = np.zeros(n)
    lr_arr[return_window:] = log_prices[return_window:] - log_prices[:-return_window]

    # Realized vol: rolling std via cumsum
    rv_arr = np.zeros(n)
    if n > vol_window + 1:
        cs = np.cumsum(log_rets)
        cs2 = np.cumsum(log_rets ** 2)
        for i in range(vol_window, len(log_rets)):
            s = cs[i] - cs[i - vol_window]
            s2 = cs2[i] - cs2[i - vol_window]
            var = s2 / vol_window - (s / vol_window) ** 2
            rv_arr[i + 1] = np.sqrt(max(var, 0)) * np.sqrt(24 * 365)

    return pd.DataFrame(
        {"log_return": lr_arr, "realized_vol": rv_arr},
        index=data.index,
    )
