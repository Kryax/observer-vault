"""
v6.2c Universe Expansion — run frozen strategy on expanded token sets.

Universe A: 12 tokens (baseline 5 + 7 mid-caps)
Universe B: 10 tokens (no BTC/ETH, mid-caps only)
Universe C: per-token individual backtests
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
from strategy.dual_momentum import DualMomentumAllocator

DATA_DIR = Path(__file__).parent.parent / "data"

ALL_TOKEN_FILES = {
    "BTC": "btc_ohlcv_1h_extended.csv",
    "ETH": "eth_ohlcv_1h.csv",
    "SOL": "sol_ohlcv_1h.csv",
    "BNB": "bnb_ohlcv_1h.csv",
    "ADA": "ada_ohlcv_1h.csv",
    "DOGE": "doge_ohlcv_1h.csv",
    "AVAX": "avax_ohlcv_1h.csv",
    "LINK": "link_ohlcv_1h.csv",
    "SUI": "sui_ohlcv_1h.csv",
    "DOT": "dot_ohlcv_1h.csv",
    "NEAR": "near_ohlcv_1h.csv",
    "XRP": "xrp_ohlcv_1h.csv",
}

UNIVERSE_A = ["BTC", "ETH", "SOL", "BNB", "ADA", "DOGE", "AVAX", "LINK", "SUI", "DOT", "NEAR", "XRP"]
UNIVERSE_B = ["SOL", "BNB", "ADA", "DOGE", "AVAX", "LINK", "SUI", "DOT", "NEAR", "XRP"]
BASELINE = ["BTC", "ETH", "SOL", "BNB", "ADA"]

TRAIN_BARS = 365 * 24
TEST_BARS = 180 * 24
PERSISTENCE_THRESHOLDS = {"Kinetic": 3, "Quiet": 24}
DEADBAND = 0.02  # v6.2c frozen


def load_data(token: str) -> pd.DataFrame:
    path = DATA_DIR / ALL_TOKEN_FILES[token]
    df = pd.read_csv(path, parse_dates=["timestamp"])
    df = df.sort_values("timestamp").reset_index(drop=True)
    df.set_index("timestamp", inplace=True)
    return df


def walk_forward_classify(features: np.ndarray) -> tuple[list[str], HMMRegimeClassifier]:
    n = len(features)
    regimes = ["Quiet"] * n
    last_model = None
    start = 0
    fold = 0
    while start + TRAIN_BARS < n:
        fold += 1
        train_end = start + TRAIN_BARS
        test_end = min(train_end + TEST_BARS, n)
        clf = HMMRegimeClassifier(n_states=2, n_iter=100)
        clf.fit(features[start:train_end])
        for j, label in enumerate(clf.predict(features[train_end:test_end])):
            regimes[train_end + j] = label
        last_model = clf
        start += TEST_BARS
    return regimes, last_model


def apply_persistence_filter(regimes: list[str]) -> list[str]:
    thresholds = PERSISTENCE_THRESHOLDS
    confirmed = list(regimes)
    current = regimes[0]
    pending = current
    pending_count = 0
    for i in range(len(regimes)):
        raw = regimes[i]
        if raw == current:
            confirmed[i] = current
            pending = current
            pending_count = 0
        elif raw == pending:
            pending_count += 1
            if pending_count >= thresholds.get(raw, 24):
                current = pending
            confirmed[i] = current
        else:
            pending = raw
            pending_count = 1
            confirmed[i] = current
    return confirmed


def run_backtest(universe_name, token_list, all_data, all_regimes):
    """Run v6.2c backtest on a given token universe."""
    data_subset = {t: all_data[t] for t in token_list if t in all_data}
    regime_subset = {t: all_regimes[t] for t in token_list if t in all_regimes}

    allocator = DualMomentumAllocator(
        momentum_window=720, rebalance_bars=168,
        switch_threshold=0.05, deadband=DEADBAND,
    )
    results = allocator.run(data_subset, regime_subset, initial_capital=10_000.0)

    # Token selection frequency from trades
    buys = [t for t in results["trades"] if t["action"] == "buy"]
    token_counts = Counter(t["token"] for t in buys)
    total_buys = len(buys) or 1

    # Compute hold durations per token
    hold_durations = {t: [] for t in token_list}
    for idx in range(len(results["trades"])):
        trade = results["trades"][idx]
        if trade["action"] == "buy":
            # Find matching sell
            for j in range(idx + 1, len(results["trades"])):
                if results["trades"][j]["action"] == "sell" and results["trades"][j]["token"] == trade["token"]:
                    hold_durations[trade["token"]].append(results["trades"][j]["bar"] - trade["bar"])
                    break

    return results, token_counts, total_buys, hold_durations


def print_results(name, results, token_counts, total_buys, hold_durations, token_list):
    print(f"\n{'='*70}")
    print(f"  {name}")
    print(f"{'='*70}")
    print(f"  Total Return:     {results['total_return']*100:+.1f}%")
    print(f"  Final Equity:     ${results['final_equity']:,.0f}")
    print(f"  CAGR:             {results['cagr']*100:.1f}%")
    print(f"  Max Drawdown:     {results['max_drawdown']*100:.1f}%")
    print(f"  Sharpe Ratio:     {results['sharpe']:.2f}")
    print(f"  Calmar Ratio:     {results['calmar']:.2f}")
    print(f"  Time in Market:   {results['pct_in_market']*100:.1f}%")
    print(f"  Token Switches:   {results['n_token_switches']}")
    print(f"  Period:           {results['years']:.1f} years")

    print(f"\n  --- Annual Returns ---")
    for year, ret in sorted(results["annual_returns"].items()):
        print(f"    {year}: {ret*100:+.1f}%")

    print(f"\n  --- Token Selection Frequency ---")
    print(f"    {'Token':<8s} {'% Selected':>12s} {'Avg Hold (h)':>14s}")
    for t in token_list:
        pct = token_counts.get(t, 0) / total_buys * 100
        durations = hold_durations.get(t, [])
        avg_hold = np.mean(durations) if durations else 0
        if pct > 0:
            print(f"    {t:<8s} {pct:>11.1f}%  {avg_hold:>13.0f}")

    print(f"\n  --- Buy-and-Hold ---")
    for token, ret in results["buy_and_hold"].items():
        print(f"    {token}: {ret*100:+.1f}%")
    print(f"    Basket: {results['buy_and_hold_basket']*100:+.1f}%")


def main():
    print("=" * 70)
    print("V6.2c UNIVERSE EXPANSION")
    print("=" * 70)

    # Phase 1: Load all tokens and classify
    all_data = {}
    all_regimes = {}

    for token, filename in ALL_TOKEN_FILES.items():
        filepath = DATA_DIR / filename
        if not filepath.exists():
            print(f"  {token}: FILE NOT FOUND — skipping")
            continue

        data = load_data(token)
        all_data[token] = data
        print(f"  {token}: {len(data)} bars, {data.index[0]} to {data.index[-1]}")

        features = compute_price_native_features(data)
        feat_arr = features[["log_return", "realized_vol"]].values
        raw_regimes, _ = walk_forward_classify(feat_arr)
        regimes = apply_persistence_filter(raw_regimes)
        all_regimes[token] = regimes

        counts = Counter(regimes)
        total = len(regimes)
        print(f"         Kinetic: {counts.get('Kinetic',0)/total*100:.1f}%  "
              f"Quiet: {counts.get('Quiet',0)/total*100:.1f}%")

    # Phase 2: Universe A (12 tokens)
    print(f"\n\n{'#'*70}")
    print(f"UNIVERSE A — 12 TOKENS (baseline + 7 mid-caps)")
    print(f"{'#'*70}")
    a_tokens = [t for t in UNIVERSE_A if t in all_data]
    res_a, tc_a, tb_a, hd_a = run_backtest("Universe A", a_tokens, all_data, all_regimes)
    print_results("Universe A (12 tokens)", res_a, tc_a, tb_a, hd_a, a_tokens)

    # Phase 3: Universe B (10 tokens, no BTC/ETH)
    print(f"\n\n{'#'*70}")
    print(f"UNIVERSE B — 10 TOKENS (mid-caps only, no BTC/ETH)")
    print(f"{'#'*70}")
    b_tokens = [t for t in UNIVERSE_B if t in all_data]
    res_b, tc_b, tb_b, hd_b = run_backtest("Universe B", b_tokens, all_data, all_regimes)
    print_results("Universe B (10 tokens)", res_b, tc_b, tb_b, hd_b, b_tokens)

    # Phase 4: Universe C — per-token individual backtests
    print(f"\n\n{'#'*70}")
    print(f"UNIVERSE C — PER-TOKEN INDIVIDUAL BACKTESTS")
    print(f"{'#'*70}")
    per_token = {}
    for token in ALL_TOKEN_FILES:
        if token not in all_data:
            continue
        res_c, _, _, _ = run_backtest(f"Solo-{token}", [token], all_data, all_regimes)
        ar = res_c.get("annual_returns", {})
        per_token[token] = {
            "data_from": str(all_data[token].index[0])[:10],
            "bars": len(all_data[token]),
            "total_return": res_c["total_return"],
            "cagr": res_c["cagr"],
            "max_drawdown": res_c["max_drawdown"],
            "sharpe": res_c["sharpe"],
            "calmar": res_c["calmar"],
            "2022": ar.get("2022", None),
            "2025": ar.get("2025", None),
            "n_switches": res_c["n_token_switches"],
        }

    print(f"\n  {'Token':<6s} {'From':<12s} {'Return':>10s} {'CAGR':>8s} {'MaxDD':>8s} "
          f"{'Sharpe':>8s} {'Calmar':>8s} {'2022':>8s} {'2025':>8s}")
    for t, m in per_token.items():
        y22 = f"{m['2022']*100:+.1f}%" if m['2022'] is not None else "  n/a"
        y25 = f"{m['2025']*100:+.1f}%" if m['2025'] is not None else "  n/a"
        print(f"  {t:<6s} {m['data_from']:<12s} {m['total_return']*100:>+9.0f}% {m['cagr']*100:>7.1f}% "
              f"{m['max_drawdown']*100:>7.1f}% {m['sharpe']:>8.2f} {m['calmar']:>8.2f} "
              f"{y22:>8s} {y25:>8s}")

    # Phase 5: Comparison table
    print(f"\n\n{'='*70}")
    print("UNIVERSE COMPARISON")
    print(f"{'='*70}")
    print(f"  {'Metric':<16s} {'Baseline(5)':>12s} {'Univ A(12)':>12s} {'Univ B(10)':>12s}")

    def fmt_r(r, key):
        return f"{r[key]*100:+.1f}%" if key in r else "n/a"

    for label, key in [("Total Return", "total_return"), ("CAGR", "cagr"),
                       ("Max Drawdown", "max_drawdown"), ("Sharpe", "sharpe"),
                       ("Calmar", "calmar")]:
        row = f"  {label:<16s}"
        row += f" {'+1662.3%':>12s}"  # baseline
        row += f" {res_a[key]*100:>+11.1f}%"
        row += f" {res_b[key]*100:>+11.1f}%"
        if key in ("sharpe", "calmar"):
            row = f"  {label:<16s}"
            row += f" {'0.68' if key == 'sharpe' else '0.99':>12s}"
            row += f" {res_a[key]:>12.2f}"
            row += f" {res_b[key]:>12.2f}"
        print(row)

    for year_label in ["2022", "2025"]:
        row = f"  {year_label:<16s}"
        base_val = "-29.4%" if year_label == "2022" else "+17.7%"
        row += f" {base_val:>12s}"
        a_val = res_a["annual_returns"].get(year_label, 0)
        b_val = res_b["annual_returns"].get(year_label, 0)
        row += f" {a_val*100:>+11.1f}%"
        row += f" {b_val*100:>+11.1f}%"
        print(row)

    row = f"  {'Switches':<16s}"
    row += f" {'73':>12s}"
    row += f" {res_a['n_token_switches']:>12d}"
    row += f" {res_b['n_token_switches']:>12d}"
    print(row)

    row = f"  {'Time in Market':<16s}"
    row += f" {'48.6%':>12s}"
    row += f" {res_a['pct_in_market']*100:>11.1f}%"
    row += f" {res_b['pct_in_market']*100:>11.1f}%"
    print(row)

    # Recommendation
    results_map = {"Baseline (5)": {"calmar": 0.99, "sharpe": 0.68},
                   "Universe A (12)": {"calmar": res_a["calmar"], "sharpe": res_a["sharpe"]},
                   "Universe B (10)": {"calmar": res_b["calmar"], "sharpe": res_b["sharpe"]}}
    best = max(results_map, key=lambda k: results_map[k]["calmar"])
    print(f"\n  RECOMMENDATION: {best} (highest Calmar)")

    # Save all results
    save_a = {k: v for k, v in res_a.items() if k not in ("equity_curve", "timestamps")}
    save_a["universe"] = "A"
    save_a["tokens"] = a_tokens
    save_a["token_selection"] = {t: tc_a.get(t, 0) / tb_a * 100 for t in a_tokens}

    save_b = {k: v for k, v in res_b.items() if k not in ("equity_curve", "timestamps")}
    save_b["universe"] = "B"
    save_b["tokens"] = b_tokens
    save_b["token_selection"] = {t: tc_b.get(t, 0) / tb_b * 100 for t in b_tokens}

    with open(DATA_DIR / "hmm_momentum_v6_2c_universe_a_results.json", "w") as f:
        json.dump(save_a, f, indent=2, default=str)
    with open(DATA_DIR / "hmm_momentum_v6_2c_universe_b_results.json", "w") as f:
        json.dump(save_b, f, indent=2, default=str)
    with open(DATA_DIR / "hmm_momentum_v6_2c_universe_c_results.json", "w") as f:
        json.dump(per_token, f, indent=2, default=str)

    print(f"\nResults saved to data/hmm_momentum_v6_2c_universe_*.json")
    return res_a, res_b, per_token


if __name__ == "__main__":
    main()
