#!/usr/bin/env python3
"""
Debug: check what populate_entry_trend actually sees.
Load the Freqtrade data the same way backtester does and simulate.
"""
import sys
sys.path.insert(0, "freqtrade/user_data/strategies")

import numpy as np
import pandas as pd
from pathlib import Path

# Manually load data the way Freqtrade does
DATA_DIR = Path("freqtrade/user_data/data/binance")

pairs = ["BTC_USDT", "ETH_USDT", "SOL_USDT", "BNB_USDT", "ADA_USDT"]
dfs = {}
for pair in pairs:
    # Freqtrade stores as feather
    path = DATA_DIR / f"{pair.replace('_', '-')}-1h-spot.feather"
    if not path.exists():
        # Try json
        path = DATA_DIR / f"{pair.replace('_', '-')}-1h-spot.json"
    if not path.exists():
        print(f"  {pair}: no data file found")
        continue
    df = pd.read_feather(path) if path.suffix == '.feather' else pd.read_json(path)
    dfs[pair] = df
    print(f"  {pair}: {len(df)} rows, cols: {list(df.columns)[:5]}...")

# Check lengths
for p, d in dfs.items():
    print(f"  {p}: {len(d)} rows, range: {d.iloc[0]['date']} → {d.iloc[-1]['date']}")
