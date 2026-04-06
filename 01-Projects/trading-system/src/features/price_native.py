"""
Price-native D/I/R feature engine.

Three features for HMM regime classification:
  1. Log returns — direction + magnitude
  2. Realized volatility — regime energy (I-axis)
  3. Efficiency ratio — trend cleanness vs chop (D vs I discriminator)
"""

import numpy as np
import pandas as pd


def compute_price_native_features(
    data: pd.DataFrame,
    return_window: int = 24,
    vol_window: int = 24,
    er_window: int = 24,
) -> pd.DataFrame:
    """
    Compute 3 price-native features for each bar.

    Returns DataFrame with columns: log_return, realized_vol, efficiency_ratio
    """
    prices = data["close"].values.astype(np.float64)
    log_prices = np.log(np.maximum(prices, 1e-12))
    log_rets = np.diff(log_prices)

    n = len(data)

    # --- Log return: vectorised ---
    lr_arr = np.zeros(n)
    lr_arr[return_window:] = log_prices[return_window:] - log_prices[:-return_window]

    # --- Realized vol: rolling std via cumsum ---
    rv_arr = np.zeros(n)
    if n > vol_window + 1:
        cs = np.cumsum(log_rets)
        cs2 = np.cumsum(log_rets ** 2)
        for i in range(vol_window, len(log_rets)):
            s = cs[i] - cs[i - vol_window]
            s2 = cs2[i] - cs2[i - vol_window]
            var = s2 / vol_window - (s / vol_window) ** 2
            rv_arr[i + 1] = np.sqrt(max(var, 0)) * np.sqrt(24 * 365)

    # --- Efficiency ratio: vectorised ---
    er_arr = np.zeros(n)
    if n > er_window:
        abs_bar_changes = np.abs(np.diff(prices))
        # Cumsum for rolling sum of abs changes
        cs_abs = np.cumsum(abs_bar_changes)
        for i in range(er_window, n):
            # i indexes into prices; bar_changes are offset by 1
            net_change = abs(prices[i] - prices[i - er_window])
            path_length = cs_abs[i - 1] - (cs_abs[i - er_window - 1] if i - er_window - 1 >= 0 else 0.0)
            if path_length > 0:
                er_arr[i] = min(net_change / path_length, 1.0)

    return pd.DataFrame(
        {
            "log_return": lr_arr,
            "realized_vol": rv_arr,
            "efficiency_ratio": er_arr,
        },
        index=data.index,
    )
