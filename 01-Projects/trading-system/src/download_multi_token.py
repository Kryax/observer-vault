#!/usr/bin/env python3
"""
Download 1h OHLCV data for multiple tokens from Binance via ccxt.
BTC already exists — skip if present.
"""

import time
from datetime import datetime, timezone
from pathlib import Path

import ccxt
import pandas as pd

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

TOKENS = {
    "ETH/USDT": "eth_ohlcv_1h.csv",
    "SOL/USDT": "sol_ohlcv_1h.csv",
    "BNB/USDT": "bnb_ohlcv_1h.csv",
    "ADA/USDT": "ada_ohlcv_1h.csv",
}

# BTC already exists
BTC_FILE = DATA_DIR / "btc_ohlcv_1h_extended.csv"


def fetch_all_ohlcv(exchange, symbol: str, timeframe: str = "1h",
                    since_ms: int = None) -> list:
    """Fetch all available OHLCV data by paginating."""
    all_candles = []
    limit = 1000

    if since_ms is None:
        # Start from 2017-01-01
        since_ms = int(datetime(2017, 1, 1, tzinfo=timezone.utc).timestamp() * 1000)

    while True:
        try:
            candles = exchange.fetch_ohlcv(symbol, timeframe, since=since_ms, limit=limit)
        except Exception as e:
            print(f"  Error fetching {symbol} at {since_ms}: {e}")
            time.sleep(5)
            continue

        if not candles:
            break

        all_candles.extend(candles)
        last_ts = candles[-1][0]

        if len(candles) < limit:
            break

        since_ms = last_ts + 1
        time.sleep(0.2)  # Rate limiting

        if len(all_candles) % 10000 < limit:
            print(f"  {symbol}: {len(all_candles)} candles so far...")

    return all_candles


def candles_to_df(candles: list) -> pd.DataFrame:
    df = pd.DataFrame(candles, columns=["timestamp", "open", "high", "low", "close", "volume"])
    df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms", utc=True)
    df = df.set_index("timestamp")
    df = df[~df.index.duplicated(keep="first")]
    df = df.sort_index()
    return df


def main():
    exchange = ccxt.binance({"enableRateLimit": True})

    results = {}

    # Report BTC
    if BTC_FILE.exists():
        btc_df = pd.read_csv(BTC_FILE, parse_dates=["timestamp"], index_col="timestamp")
        print(f"BTC/USDT: EXISTING — {len(btc_df)} candles, {btc_df.index[0]} to {btc_df.index[-1]}")
        results["BTC/USDT"] = {
            "candles": len(btc_df),
            "start": str(btc_df.index[0]),
            "end": str(btc_df.index[-1]),
            "file": str(BTC_FILE),
        }

    for symbol, filename in TOKENS.items():
        filepath = DATA_DIR / filename
        print(f"\nDownloading {symbol}...")

        candles = fetch_all_ohlcv(exchange, symbol)
        if not candles:
            print(f"  WARNING: No data for {symbol}")
            continue

        df = candles_to_df(candles)
        df.to_csv(filepath)

        print(f"  {symbol}: {len(df)} candles, {df.index[0]} to {df.index[-1]}")
        results[symbol] = {
            "candles": len(df),
            "start": str(df.index[0]),
            "end": str(df.index[-1]),
            "file": str(filepath),
        }

    # Summary
    print("\n" + "=" * 60)
    print("DOWNLOAD SUMMARY")
    print("=" * 60)
    for sym, info in results.items():
        print(f"  {sym:12s}: {info['candles']:>7,} candles  |  {info['start'][:10]} → {info['end'][:10]}")


if __name__ == "__main__":
    main()
