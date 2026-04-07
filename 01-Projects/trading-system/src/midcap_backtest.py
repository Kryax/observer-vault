"""
Mid-Cap Token Backtests — v6.2c and Markov v3 over 2022-2026.

Runs basket configurations A-D and per-token individual runs for all new tokens.
Reuses infrastructure from expanded_roster_comparison.py.
"""

import json
import sys
from collections import Counter
from pathlib import Path

sys.stdout.reconfigure(line_buffering=True)

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))

from features.price_native import compute_price_native_features
from classifier.hmm_regime import HMMRegimeClassifier
from expanded_roster_comparison import (
    DATA_DIR, MOMENTUM_WINDOW, DEADBAND, TRAIN_BARS, TEST_BARS,
    PERSISTENCE_THRESHOLDS,
    walk_forward_classify, apply_persistence_filter,
    compute_6d_features_for_token, classify_basins, compute_sizing_series,
    MarkovV3Allocator,
)
from strategy.dual_momentum import DualMomentumAllocator

RESULTS_PATH = DATA_DIR / "midcap_backtest_results.json"

START = pd.Timestamp("2022-04-01", tz="UTC")
END = pd.Timestamp("2026-04-01", tz="UTC")

# Token file mapping — all tokens we need
TOKEN_FILES = {
    "BTC": "btc_ohlcv_1h.csv",
    "BNB": "bnb_ohlcv_1h.csv",
    "SOL": "sol_ohlcv_1h.csv",
    "DOGE": "doge_ohlcv_1h.csv",
    "LINK": "link_ohlcv_1h.csv",
    "FET": "fet_ohlcv_1h.csv",
    "FTM": "ftm_ohlcv_1h.csv",
    "TRX": "trx_ohlcv_1h.csv",
    "PEPE": "pepe_ohlcv_1h.csv",
    "BONK": "bonk_ohlcv_1h.csv",
    "SHIB": "shib_ohlcv_1h.csv",
    "HBAR": "hbar_ohlcv_1h.csv",
    "LTC": "ltc_ohlcv_1h.csv",
    "XLM": "xlm_ohlcv_1h.csv",
    "EOS": "eos_ohlcv_1h.csv",
    "UNI": "uni_ohlcv_1h.csv",
    "ALGO": "algo_ohlcv_1h.csv",
    "AAVE": "aave_ohlcv_1h.csv",
    "MATIC": "matic_ohlcv_1h.csv",
    "ENA": "ena_ohlcv_1h.csv",
}

# Basket configurations
BASKETS = {
    "A_new_optimal_7": ["BTC", "BNB", "DOGE", "LINK", "SOL", "FET", "FTM"],
    "B_full_9": ["BTC", "BNB", "LINK", "FET", "FTM", "DOGE", "SOL", "BONK", "TRX"],
    "C_stabilizers_5": ["BTC", "BNB", "LINK", "FET", "FTM"],
    "D_amplifiers_6": ["BTC", "DOGE", "SOL", "BONK", "TRX", "PEPE"],
}

# Per-token individual run tokens
INDIVIDUAL_TOKENS = [
    "FET", "FTM", "TRX", "PEPE", "BONK", "SHIB", "HBAR",
    "LTC", "XLM", "EOS", "UNI", "ALGO", "AAVE", "MATIC", "ENA",
]


def load_data(token: str) -> pd.DataFrame:
    path = DATA_DIR / "raw" / TOKEN_FILES[token]
    df = pd.read_csv(path, parse_dates=["timestamp"])
    df = df.sort_values("timestamp").reset_index(drop=True)
    df.set_index("timestamp", inplace=True)
    return df


def prepare_token(token: str, all_data, all_regimes, all_basins, all_scalars):
    """Load, classify regimes, compute 6D features + basins + sizing for a token."""
    if token in all_data:
        return
    print(f"  Loading {token}...", end=" ")
    data = load_data(token)
    all_data[token] = data
    print(f"{len(data)} bars: {data.index[0].date()} to {data.index[-1].date()}")

    features = compute_price_native_features(data)
    feat_arr = features[["log_return", "realized_vol"]].values
    raw_regimes = walk_forward_classify(feat_arr)
    regimes = apply_persistence_filter(raw_regimes)
    all_regimes[token] = regimes

    data_feat = compute_6d_features_for_token(data.copy(), token)
    basin_series = classify_basins(data_feat)
    all_basins[token] = basin_series

    atr_z = data_feat["atr_z"].values
    rsi_z = data_feat["rsi_z"].values
    sizing = compute_sizing_series(basin_series.values, atr_z, rsi_z)
    all_scalars[token] = sizing


def subset_to_period(tokens, all_data, all_regimes, all_basins, all_scalars,
                     start_ts=START, end_ts=END):
    """Subset data to [start_ts, end_ts] period."""
    sub_data, sub_regimes, sub_basins, sub_scalars = {}, {}, {}, {}
    for t in tokens:
        d = all_data[t]
        d = d[(d.index >= start_ts) & (d.index <= end_ts)]
        sub_data[t] = d
        full_idx = all_data[t].index
        idx_map = {ts: i for i, ts in enumerate(full_idx)}
        sub_regimes[t] = [all_regimes[t][idx_map[ts]] for ts in d.index if ts in idx_map]
        sub_basins[t] = all_basins[t].loc[d.index]
        full_sc = all_scalars[t]
        sub_scalars[t] = np.array([full_sc[idx_map[ts]] if ts in idx_map else 1.0
                                   for ts in d.index])
    return sub_data, sub_regimes, sub_basins, sub_scalars


def run_basket(name, tokens, all_data, all_regimes, all_basins, all_scalars):
    """Run v6.2c and Markov v3 on a basket, return result dict."""
    sub_data, sub_regimes, sub_basins, sub_scalars = subset_to_period(
        tokens, all_data, all_regimes, all_basins, all_scalars)

    # Check we have data
    common_idx = sub_data[tokens[0]].index
    for t in tokens[1:]:
        common_idx = common_idx.intersection(sub_data[t].index)
    common_idx = common_idx.sort_values()
    if len(common_idx) < 1000:
        return {"error": f"Insufficient common bars: {len(common_idx)}", "tokens": tokens}

    period_str = f"{common_idx[0].date()} to {common_idx[-1].date()}"

    # v6.2c
    v62c = DualMomentumAllocator(
        momentum_window=MOMENTUM_WINDOW, rebalance_bars=168,
        switch_threshold=0.05, deadband=DEADBAND,
    )
    v62c_r = v62c.run(sub_data, sub_regimes, initial_capital=10_000.0)

    # Markov v3
    v3 = MarkovV3Allocator(
        deadband=DEADBAND, momentum_window=MOMENTUM_WINDOW,
        rebalance_bars=168, switch_threshold=0.05,
    )
    v3_r = v3.run(sub_data, sub_regimes, sub_basins, sub_scalars, initial_capital=10_000.0)

    # BTC B&H
    btc_p = sub_data["BTC"]["close"]
    btc_common = btc_p.loc[btc_p.index.intersection(common_idx)]
    btc_bh = float(btc_common.iloc[-1] / btc_common.iloc[0] - 1.0) if len(btc_common) > 0 else 0

    return {
        "tokens": tokens,
        "period": period_str,
        "n_bars": len(common_idx),
        "v62c": {
            "return_pct": round(v62c_r["total_return"] * 100, 1),
            "max_dd_pct": round(v62c_r["max_drawdown"] * 100, 1),
            "sharpe": round(v62c_r["sharpe"], 3),
            "calmar": round(v62c_r["calmar"], 3),
            "cagr_pct": round(v62c_r["cagr"] * 100, 1),
            "n_trades": v62c_r["n_trades"],
            "annual_returns": {k: round(v * 100, 1) for k, v in v62c_r["annual_returns"].items()},
        },
        "markov_v3": {
            "return_pct": round(v3_r["total_return"] * 100, 1),
            "max_dd_pct": round(v3_r["max_drawdown"] * 100, 1),
            "sharpe": round(v3_r["sharpe"], 3),
            "calmar": round(v3_r["calmar"], 3),
            "cagr_pct": round(v3_r["cagr"] * 100, 1),
            "n_trades": v3_r["n_trades"],
            "win_rate": v3_r["win_rate"],
            "token_pnl": v3_r["token_pnl"],
            "annual_returns": {k: round(v * 100, 1) for k, v in v3_r["annual_returns"].items()},
        },
        "btc_buy_hold_pct": round(btc_bh * 100, 1),
    }


def run_individual(token, all_data, all_regimes, all_basins, all_scalars):
    """Run v6.2c on a single token (paired with BTC for the allocator)."""
    # Single-token run: use [BTC, token] basket so the allocator can rotate
    tokens = ["BTC", token] if token != "BTC" else ["BTC"]

    sub_data, sub_regimes, sub_basins, sub_scalars = subset_to_period(
        tokens, all_data, all_regimes, all_basins, all_scalars)

    # Check available period
    if token != "BTC":
        common_idx = sub_data["BTC"].index.intersection(sub_data[token].index).sort_values()
    else:
        common_idx = sub_data["BTC"].index.sort_values()

    if len(common_idx) < 1000:
        return {"token": token, "error": f"Insufficient bars: {len(common_idx)}"}

    period_str = f"{common_idx[0].date()} to {common_idx[-1].date()}"

    # v6.2c
    v62c = DualMomentumAllocator(
        momentum_window=MOMENTUM_WINDOW, rebalance_bars=168,
        switch_threshold=0.05, deadband=DEADBAND,
    )
    v62c_r = v62c.run(sub_data, sub_regimes, initial_capital=10_000.0)

    # Token B&H
    tp = sub_data[token]["close"]
    tp_common = tp.loc[tp.index.intersection(common_idx)]
    token_bh = float(tp_common.iloc[-1] / tp_common.iloc[0] - 1.0) if len(tp_common) > 0 else 0

    # Compute year sub-returns for 2022 performance
    years = {}
    timestamps = pd.DatetimeIndex(common_idx)
    eq = v62c_r.get("equity_curve", [])
    if eq:
        eq_arr = np.array(eq)
        for yr in range(timestamps[0].year, timestamps[-1].year + 1):
            mask = timestamps.year == yr
            if mask.sum() < 48:
                continue
            year_eq = eq_arr[mask]
            years[str(yr)] = round(float(year_eq[-1] / year_eq[0] - 1.0) * 100, 1)

    return {
        "token": token,
        "period": period_str,
        "n_bars": len(common_idx),
        "v62c_return_pct": round(v62c_r["total_return"] * 100, 1),
        "max_dd_pct": round(v62c_r["max_drawdown"] * 100, 1),
        "calmar": round(v62c_r["calmar"], 3),
        "sharpe": round(v62c_r["sharpe"], 3),
        "n_trades": v62c_r["n_trades"],
        "token_buy_hold_pct": round(token_bh * 100, 1),
        "annual_returns": years,
        "year_2022_pct": years.get("2022", "N/A"),
    }


def main():
    print("=" * 80)
    print("MID-CAP TOKEN BACKTESTS — v6.2c and Markov v3 (2022-2026)")
    print("=" * 80)

    all_data, all_regimes, all_basins, all_scalars = {}, {}, {}, {}

    # Gather all needed tokens
    all_tokens = set()
    for basket in BASKETS.values():
        all_tokens.update(basket)
    all_tokens.update(INDIVIDUAL_TOKENS)
    all_tokens.add("BTC")

    print(f"\nPreparing {len(all_tokens)} tokens...")
    for token in sorted(all_tokens):
        prepare_token(token, all_data, all_regimes, all_basins, all_scalars)

    # ── Basket runs ──
    results = {
        "metadata": {
            "analysis": "Mid-Cap Token Backtests — v6.2c and Markov v3 over 2022-2026",
            "period": "2022-04-01 to 2026-04-01",
            "date": "2026-04-07",
        },
        "baskets": {},
        "individual": {},
    }

    print(f"\n{'='*80}")
    print("BASKET CONFIGURATIONS")
    print(f"{'='*80}")

    for name, tokens in BASKETS.items():
        print(f"\n>>> {name}: {tokens}")
        r = run_basket(name, tokens, all_data, all_regimes, all_basins, all_scalars)
        results["baskets"][name] = r
        if "error" not in r:
            print(f"    v6.2c: {r['v62c']['return_pct']:+.1f}% (DD {r['v62c']['max_dd_pct']:.1f}%)")
            print(f"    v3:    {r['markov_v3']['return_pct']:+.1f}% (DD {r['markov_v3']['max_dd_pct']:.1f}%, Calmar {r['markov_v3']['calmar']:.3f})")
            print(f"    BTC B&H: {r['btc_buy_hold_pct']:+.1f}%")
        else:
            print(f"    ERROR: {r['error']}")

    # ── Individual token runs ──
    print(f"\n{'='*80}")
    print("PER-TOKEN INDIVIDUAL RUNS (v6.2c)")
    print(f"{'='*80}")

    for token in INDIVIDUAL_TOKENS:
        print(f"\n>>> {token}...")
        r = run_individual(token, all_data, all_regimes, all_basins, all_scalars)
        results["individual"][token] = r
        if "error" not in r:
            print(f"    Period: {r['period']}")
            print(f"    Return: {r['v62c_return_pct']:+.1f}%, DD: {r['max_dd_pct']:.1f}%, "
                  f"Calmar: {r['calmar']:.3f}, 2022: {r['year_2022_pct']}")
        else:
            print(f"    ERROR: {r['error']}")

    # ── Master comparison table ──
    print(f"\n{'='*100}")
    print("MASTER COMPARISON TABLE")
    print(f"{'='*100}")
    header = f"{'Config':<22s} | {'v6.2c Ret':>10s} | {'v6.2c DD':>9s} | {'v3 Ret':>10s} | {'v3 DD':>8s} | {'v3 Calmar':>9s} | {'BTC B&H':>8s}"
    print(header)
    print("-" * len(header))
    print(f"{'Original 5 (ref)':.<22s} | {'+375.5%':>10s} | {'-55.2%':>9s} | {'+64.3%':>10s} | {'-26.5%':>8s} | {'0.500':>9s} | {'+50.0%':>8s}")

    for name, r in results["baskets"].items():
        if "error" in r:
            print(f"{name:.<22s} | {'ERROR':>10s}")
            continue
        print(f"{name:.<22s} | {r['v62c']['return_pct']:>+9.1f}% | {r['v62c']['max_dd_pct']:>8.1f}% | "
              f"{r['markov_v3']['return_pct']:>+9.1f}% | {r['markov_v3']['max_dd_pct']:>7.1f}% | "
              f"{r['markov_v3']['calmar']:>9.3f} | {r['btc_buy_hold_pct']:>+7.1f}%")

    # ── Per-token table sorted by Calmar ──
    print(f"\n{'='*100}")
    print("PER-TOKEN INDIVIDUAL RESULTS (sorted by Calmar)")
    print(f"{'='*100}")
    indiv_header = f"{'Token':>6s} | {'Period':<25s} | {'v6.2c Ret':>10s} | {'Max DD':>8s} | {'Calmar':>7s} | {'2022 Perf':>10s} | {'Flag':>6s}"
    print(indiv_header)
    print("-" * len(indiv_header))

    # Sort by calmar descending
    sorted_indiv = sorted(
        [(t, r) for t, r in results["individual"].items() if "error" not in r],
        key=lambda x: -x[1]["calmar"]
    )

    for token, r in sorted_indiv:
        flag = " ***" if r["calmar"] >= 0.80 else ""
        y2022 = f"{r['year_2022_pct']:+.1f}%" if isinstance(r["year_2022_pct"], (int, float)) else r["year_2022_pct"]
        print(f"{token:>6s} | {r['period']:<25s} | {r['v62c_return_pct']:>+9.1f}% | "
              f"{r['max_dd_pct']:>7.1f}% | {r['calmar']:>7.3f} | {y2022:>10s} | {flag}")

    # Print any errors
    errors = [(t, r) for t, r in results["individual"].items() if "error" in r]
    if errors:
        print(f"\nTokens with errors:")
        for token, r in errors:
            print(f"  {token}: {r['error']}")

    # ── Save ──
    with open(RESULTS_PATH, "w") as f:
        json.dump(results, f, indent=2, default=str)
    print(f"\nSaved to {RESULTS_PATH}")


if __name__ == "__main__":
    main()
