#!/usr/bin/env python3
"""
Build 6D Market-Native Feature Space for D/I/R Topology

D-axis (boundary/expansion):  ATR(14), BBW(20,2)
I-axis (convergence/equilibrium): RSI(14), VWAP_dist(24H rolling)
R-axis (feedback/persistence): ADX(14), OBV (Z-scored)
"""

import time
import pathlib
import ccxt
import pandas as pd
import pandas_ta as ta
import numpy as np

TRADING_DIR = pathlib.Path(__file__).resolve().parent.parent
DATA_DIR = TRADING_DIR / "data"
OHLCV_DIR = DATA_DIR / "ohlcv_1h"
OHLCV_DIR.mkdir(parents=True, exist_ok=True)

TOKENS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "ADA/USDT"]
TIMEFRAME = "1h"
SINCE_MS = int(pd.Timestamp("2022-04-07").timestamp() * 1000)  # 4 years back
LIMIT = 1000

# ── Step 1: Pull OHLCV ──────────────────────────────────────────────

def fetch_ohlcv(exchange, symbol):
    """Paginate through CCXT to get full history."""
    all_candles = []
    since = SINCE_MS
    print(f"  Fetching {symbol}...", end="", flush=True)
    while True:
        candles = exchange.fetch_ohlcv(symbol, TIMEFRAME, since=since, limit=LIMIT)
        if not candles:
            break
        all_candles.extend(candles)
        since = candles[-1][0] + 1  # next ms after last candle
        print(f"\r  Fetching {symbol}... {len(all_candles)} candles", end="", flush=True)
        time.sleep(exchange.rateLimit / 1000)
    print()

    df = pd.DataFrame(all_candles, columns=["timestamp", "open", "high", "low", "close", "volume"])
    df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms", utc=True)
    df = df.drop_duplicates(subset="timestamp").sort_values("timestamp").reset_index(drop=True)
    return df


def pull_all_ohlcv():
    exchange = ccxt.binance({"enableRateLimit": True})
    for symbol in TOKENS:
        slug = symbol.replace("/", "_")
        out_path = OHLCV_DIR / f"{slug}.parquet"
        if out_path.exists():
            print(f"  {slug} already on disk, skipping.")
            continue
        df = fetch_ohlcv(exchange, symbol)
        df.to_parquet(out_path, index=False)
        print(f"  Saved {slug}: {len(df)} rows, {df['timestamp'].min()} → {df['timestamp'].max()}")


# ── Step 2: Compute 6D indicators ───────────────────────────────────

def compute_features(df):
    """Compute 6 indicators on a single token's OHLCV dataframe."""
    # D-axis
    df["atr"] = ta.atr(df["high"], df["low"], df["close"], length=14)

    bbands = ta.bbands(df["close"], length=20, std=2)
    df["bbw"] = (bbands["BBU_20_2.0"] - bbands["BBL_20_2.0"]) / bbands["BBM_20_2.0"]

    # I-axis
    df["rsi"] = ta.rsi(df["close"], length=14)

    # Rolling 24H VWAP (24 candles for 1H data)
    tp = (df["high"] + df["low"] + df["close"]) / 3
    tp_vol = tp * df["volume"]
    rolling_tpv = tp_vol.rolling(24, min_periods=1).sum()
    rolling_vol = df["volume"].rolling(24, min_periods=1).sum()
    vwap_24h = rolling_tpv / rolling_vol
    df["vwap_dist"] = (df["close"] - vwap_24h) / vwap_24h * 100

    # R-axis
    df["adx"] = ta.adx(df["high"], df["low"], df["close"], length=14)["ADX_14"]
    df["obv"] = ta.obv(df["close"], df["volume"])

    return df


# ── Step 3: Z-score normalize per token ─────────────────────────────

FEATURE_COLS = ["atr", "bbw", "rsi", "vwap_dist", "adx", "obv"]
Z_COLS = [f"{c}_z" for c in FEATURE_COLS]


def zscore_features(df):
    """Z-score standardize features within a single token."""
    for col in FEATURE_COLS:
        mean = df[col].mean()
        std = df[col].std()
        df[f"{col}_z"] = (df[col] - mean) / std if std > 0 else 0.0
    return df


# ── Main pipeline ───────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("Step 1: Pulling OHLCV data from Binance")
    print("=" * 60)
    pull_all_ohlcv()

    print("\n" + "=" * 60)
    print("Step 2+3: Computing 6D features + Z-score normalization")
    print("=" * 60)
    frames = []
    for symbol in TOKENS:
        slug = symbol.replace("/", "_")
        path = OHLCV_DIR / f"{slug}.parquet"
        df = pd.read_parquet(path)
        print(f"\n  {slug}: {len(df)} candles loaded")

        df = compute_features(df)

        # Drop warmup NaN rows
        pre_len = len(df)
        df = df.dropna(subset=FEATURE_COLS).reset_index(drop=True)
        print(f"  Dropped {pre_len - len(df)} warmup rows → {len(df)} remaining")

        df = zscore_features(df)
        df["token"] = slug
        frames.append(df[["timestamp", "token"] + Z_COLS])

    combined = pd.concat(frames, ignore_index=True)
    out_path = DATA_DIR / "features_6d.parquet"
    combined.to_parquet(out_path, index=False)
    print(f"\nSaved {out_path}: {len(combined)} rows")

    # ── Step 4: Sanity check ────────────────────────────────────────
    print("\n" + "=" * 60)
    print("Step 4: Sanity Check — Per-token Z-score stats")
    print("=" * 60)

    for token in combined["token"].unique():
        sub = combined[combined["token"] == token]
        print(f"\n  {token} ({len(sub)} rows):")
        stats = sub[Z_COLS].describe().loc[["mean", "std", "min", "max"]]
        print(stats.to_string(float_format=lambda x: f"{x:+.4f}"))

    nans = combined[Z_COLS].isna().sum()
    print(f"\n  NaN counts per feature:\n{nans.to_string()}")
    print(f"\n  Total rows: {len(combined)}")
    print("  Done.")


if __name__ == "__main__":
    main()
