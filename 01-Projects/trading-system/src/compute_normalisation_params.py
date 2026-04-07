#!/usr/bin/env python3
"""
Compute per-token normalisation params (mean, std) for the 6 raw indicators
used in the K=9 topology. These are needed at runtime to Z-score new candles
against the training distribution.

Also saves centroids in the same file for single-file strategy config.
"""

import json
import pathlib
import numpy as np
import pandas as pd
import pandas_ta as ta

TRADING_DIR = pathlib.Path(__file__).resolve().parent.parent
DATA_DIR = TRADING_DIR / "data"
OHLCV_DIR = DATA_DIR / "ohlcv_1h"

TOKENS = ["BTC_USDT", "ETH_USDT", "SOL_USDT", "BNB_USDT", "ADA_USDT"]
RAW_FEATURES = ["atr", "bbw", "rsi", "vwap_dist", "adx", "obv"]


def compute_raw_features(df):
    """Same indicator logic as build_6d_features.py"""
    df = df.copy()
    df["atr"] = ta.atr(df["high"], df["low"], df["close"], length=14)
    bbands = ta.bbands(df["close"], length=20, std=2)
    df["bbw"] = (bbands["BBU_20_2.0"] - bbands["BBL_20_2.0"]) / bbands["BBM_20_2.0"]
    df["rsi"] = ta.rsi(df["close"], length=14)
    tp = (df["high"] + df["low"] + df["close"]) / 3
    tp_vol = tp * df["volume"]
    rolling_tpv = tp_vol.rolling(24, min_periods=1).sum()
    rolling_vol = df["volume"].rolling(24, min_periods=1).sum()
    vwap_24h = rolling_tpv / rolling_vol
    df["vwap_dist"] = (df["close"] - vwap_24h) / vwap_24h * 100
    df["adx"] = ta.adx(df["high"], df["low"], df["close"], length=14)["ADX_14"]
    df["obv"] = ta.obv(df["close"], df["volume"])
    return df


def main():
    params = {}
    for token in TOKENS:
        path = OHLCV_DIR / f"{token}.parquet"
        df = pd.read_parquet(path)
        df = compute_raw_features(df)
        df = df.dropna(subset=RAW_FEATURES)

        token_params = {}
        for feat in RAW_FEATURES:
            token_params[feat] = {
                "mean": round(float(df[feat].mean()), 8),
                "std": round(float(df[feat].std()), 8),
            }
        params[token] = token_params
        print(f"{token}: {len(df)} rows")
        for feat in RAW_FEATURES:
            m, s = token_params[feat]["mean"], token_params[feat]["std"]
            print(f"  {feat:>12}: mean={m:>14.6f}  std={s:>14.6f}")

    # Load centroids from topology
    with open(DATA_DIR / "topology_9basin.json") as f:
        topo = json.load(f)

    centroids = {}
    for cid, info in topo["clusters"].items():
        centroids[cid] = info["centroid"]

    output = {
        "normalisation": params,
        "centroids": centroids,
        "feature_order": ["atr_z", "bbw_z", "rsi_z", "vwap_dist_z", "adx_z", "obv_z"],
        "tokens": TOKENS,
    }

    out_path = DATA_DIR / "normalisation_params.json"
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\nSaved {out_path}")


if __name__ == "__main__":
    main()
