#!/usr/bin/env python3
"""Download BTC/USDT historical klines from Binance public API."""

import csv
import time
import sys
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests

BASE_URL = "https://api.binance.com/api/v3/klines"
SYMBOL = "BTCUSDT"
LIMIT = 1000

# Binance BTCUSDT listing date
START_MS = int(datetime(2017, 8, 17, tzinfo=timezone.utc).timestamp() * 1000)
END_MS = int(datetime.now(timezone.utc).timestamp() * 1000)

HEADER = [
    "open_time", "open", "high", "low", "close", "volume",
    "close_time", "quote_volume", "trades", "taker_buy_base", "taker_buy_quote"
]


def ms_to_iso(ms: int) -> str:
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def fetch_chunk(interval: str, start_time: int) -> list:
    """Fetch one chunk of up to 1000 candles."""
    for attempt in range(5):
        try:
            r = requests.get(BASE_URL, params={
                "symbol": SYMBOL,
                "interval": interval,
                "startTime": start_time,
                "limit": LIMIT,
            }, timeout=30)
            if r.status_code == 429:
                wait = int(r.headers.get("Retry-After", 10))
                print(f"  Rate limited, waiting {wait}s...")
                time.sleep(wait)
                continue
            r.raise_for_status()
            return r.json()
        except Exception as e:
            if attempt < 4:
                time.sleep(2 ** attempt)
            else:
                raise
    return []


def compute_chunk_starts(interval: str) -> list[int]:
    """Pre-compute all pagination start times."""
    if interval == "1h":
        step_ms = 1000 * 3600 * LIMIT  # 1000 hours
    elif interval == "1d":
        step_ms = 1000 * 86400 * LIMIT  # 1000 days
    else:
        raise ValueError(f"Unknown interval: {interval}")

    starts = []
    t = START_MS
    while t < END_MS:
        starts.append(t)
        t += step_ms
    return starts


def download_interval(interval: str, output_path: str):
    """Download all candles for a given interval using thread pool."""
    chunk_starts = compute_chunk_starts(interval)
    total_chunks = len(chunk_starts)
    print(f"\n[{interval}] Downloading {total_chunks} chunks...")

    all_rows = []

    # Use 4 threads to stay under rate limits
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {
            pool.submit(fetch_chunk, interval, s): i
            for i, s in enumerate(chunk_starts)
        }
        done = 0
        for future in as_completed(futures):
            done += 1
            idx = futures[future]
            try:
                data = future.result()
                for candle in data:
                    all_rows.append((candle[0], candle))  # (open_time_ms, raw)
                if done % 10 == 0 or done == total_chunks:
                    print(f"  [{interval}] {done}/{total_chunks} chunks done")
            except Exception as e:
                print(f"  [{interval}] Chunk {idx} failed: {e}")

    # Sort by open_time
    all_rows.sort(key=lambda x: x[0])

    # Deduplicate by open_time
    seen = set()
    unique_rows = []
    for ot, candle in all_rows:
        if ot not in seen:
            seen.add(ot)
            unique_rows.append(candle)

    # Write CSV
    with open(output_path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(HEADER)
        for c in unique_rows:
            w.writerow([
                ms_to_iso(c[0]),   # open_time
                c[1],              # open
                c[2],              # high
                c[3],              # low
                c[4],              # close
                c[5],              # volume
                ms_to_iso(c[6]),   # close_time
                c[7],              # quote_volume
                c[8],              # trades
                c[9],              # taker_buy_base
                c[10],             # taker_buy_quote
            ])

    first = ms_to_iso(unique_rows[0][0]) if unique_rows else "N/A"
    last = ms_to_iso(unique_rows[-1][0]) if unique_rows else "N/A"
    print(f"\n[{interval}] Complete:")
    print(f"  File: {output_path}")
    print(f"  Candles: {len(unique_rows)}")
    print(f"  Range: {first} -> {last}")
    return len(unique_rows), first, last


if __name__ == "__main__":
    data_dir = "/mnt/zfs-host/backup/projects/observer-vault/01-Projects/trading-system/data"

    results = {}
    for iv, fname in [("1h", "btc_1h_full.csv"), ("1d", "btc_1d_full.csv")]:
        path = f"{data_dir}/{fname}"
        count, first, last = download_interval(iv, path)
        results[iv] = {"count": count, "first": first, "last": last}

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    for iv, r in results.items():
        print(f"  {iv}: {r['count']} candles, {r['first']} -> {r['last']}")
