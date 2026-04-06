"""
v6.2c Purified Basket — BTC, BNB, DOGE, XRP.

Substrate purification: only tokens with Calmar > 0.79 and 2022 resilience.
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
RESULTS_PATH = DATA_DIR / "hmm_momentum_v6_2c_purified_basket_results.json"

TOKEN_FILES = {
    "BTC": "btc_ohlcv_1h_extended.csv",
    "BNB": "bnb_ohlcv_1h.csv",
    "DOGE": "doge_ohlcv_1h.csv",
    "XRP": "xrp_ohlcv_1h.csv",
}

TRAIN_BARS = 365 * 24
TEST_BARS = 180 * 24
PERSISTENCE_THRESHOLDS = {"Kinetic": 3, "Quiet": 24}
DEADBAND = 0.02


def load_data(token: str) -> pd.DataFrame:
    path = DATA_DIR / TOKEN_FILES[token]
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
        print(f"    Fold {fold}: [{start}:{train_end}] -> [{train_end}:{test_end}]")
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


def main():
    print("=" * 70)
    print("V6.2c PURIFIED BASKET — BTC, BNB, DOGE, XRP")
    print("=" * 70)

    all_data = {}
    all_regimes = {}

    for token in TOKEN_FILES:
        print(f"\n>>> Loading {token}...")
        data = load_data(token)
        all_data[token] = data
        print(f"    {len(data)} bars: {data.index[0]} to {data.index[-1]}")

        features = compute_price_native_features(data)
        feat_arr = features[["log_return", "realized_vol"]].values
        raw_regimes, clf = walk_forward_classify(feat_arr)
        regimes = apply_persistence_filter(raw_regimes)
        all_regimes[token] = regimes

        counts = Counter(regimes)
        total = len(regimes)
        transitions = sum(1 for i in range(1, len(regimes)) if regimes[i] != regimes[i-1])
        print(f"    Kinetic: {counts.get('Kinetic',0)/total*100:.1f}%  "
              f"Quiet: {counts.get('Quiet',0)/total*100:.1f}%  transitions={transitions}")

    # Run backtest
    print(f"\n{'='*70}")
    print("RUNNING V6.2c BACKTEST — PURIFIED BASKET")
    print(f"{'='*70}")

    allocator = DualMomentumAllocator(
        momentum_window=720, rebalance_bars=168,
        switch_threshold=0.05, deadband=DEADBAND,
    )
    results = allocator.run(all_data, all_regimes, initial_capital=10_000.0)

    # Find common index range for reporting
    tokens = sorted(all_data.keys())
    common_idx = all_data[tokens[0]].index
    for t in tokens[1:]:
        common_idx = common_idx.intersection(all_data[t].index)
    common_idx = common_idx.sort_values()
    print(f"\n  Common index: {common_idx[0]} to {common_idx[-1]} ({len(common_idx)} bars)")

    print(f"\n{'='*70}")
    print("RESULTS")
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

    print(f"\n  --- State/Gate Time + Flips ---")
    print(f"    {'Year':<6s} {'Kin+ON':<9s} {'Kin+OFF':<9s} {'Quiet':<9s} {'Flips':<6s}")
    gf = results.get("gate_flips_by_year", {})
    for year, st in sorted(results.get("state_time_by_year", {}).items()):
        print(f"    {year:<6s} {st.get('kinetic_on',0):>7.1f}%  {st.get('kinetic_off',0):>7.1f}%  "
              f"{st.get('quiet',0):>7.1f}%  {gf.get(year,0):>4d}")

    print(f"\n  --- Buy-and-Hold ---")
    for token, ret in results["buy_and_hold"].items():
        print(f"    {token}: {ret*100:+.1f}%")
    print(f"    Basket: {results['buy_and_hold_basket']*100:+.1f}%")

    # Token selection frequency
    buys = [t for t in results["trades"] if t["action"] == "buy"]
    total_buys = len(buys) or 1
    token_counts = Counter(t["token"] for t in buys)

    # Per-year token selections
    year_token_counts = {}
    for trade in buys:
        yr = trade["timestamp"][:4]
        if yr not in year_token_counts:
            year_token_counts[yr] = Counter()
        year_token_counts[yr][trade["token"]] += 1

    # Hold durations per token
    hold_durations = {t: [] for t in TOKEN_FILES}
    for idx in range(len(results["trades"])):
        trade = results["trades"][idx]
        if trade["action"] == "buy":
            for j in range(idx + 1, len(results["trades"])):
                if results["trades"][j]["action"] == "sell" and results["trades"][j]["token"] == trade["token"]:
                    hold_durations[trade["token"]].append(results["trades"][j]["bar"] - trade["bar"])
                    break

    print(f"\n  --- Token Selection Frequency ---")
    print(f"    {'Token':<8s} {'% Selected':>12s} {'Avg Hold(h)':>14s} {'2022 sel%':>10s}")
    yr2022_buys = year_token_counts.get("2022", Counter())
    yr2022_total = sum(yr2022_buys.values()) or 1
    for t in TOKEN_FILES:
        pct = token_counts.get(t, 0) / total_buys * 100
        durations = hold_durations.get(t, [])
        avg_hold = np.mean(durations) if durations else 0
        pct_2022 = yr2022_buys.get(t, 0) / yr2022_total * 100
        print(f"    {t:<8s} {pct:>11.1f}%  {avg_hold:>13.0f}  {pct_2022:>9.1f}%")

    # Per-year top token
    print(f"\n  --- Per-Year Top Token ---")
    for yr in sorted(year_token_counts.keys()):
        counts_yr = year_token_counts[yr]
        if counts_yr:
            top = counts_yr.most_common(1)[0]
            print(f"    {yr}: {top[0]} ({top[1]} selections)")
        else:
            print(f"    {yr}: no selections")

    # Comparison table
    print(f"\n{'='*70}")
    print("COMPARISON: BASELINE vs PURIFIED")
    print(f"{'='*70}")
    print(f"  {'Metric':<16s} {'Baseline (5)':>14s} {'Purified (4)':>14s} {'Delta':>10s}")
    metrics = [
        ("Total Return", 16.623, results["total_return"]),
        ("CAGR", 0.662, results["cagr"]),
        ("Max Drawdown", -0.666, results["max_drawdown"]),
        ("Sharpe", 0.68, results["sharpe"]),
        ("Calmar", 0.99, results["calmar"]),
    ]
    for label, base, val in metrics:
        if label in ("Sharpe", "Calmar"):
            print(f"  {label:<16s} {base:>13.2f}  {val:>13.2f}  {val-base:>+9.2f}")
        else:
            print(f"  {label:<16s} {base*100:>+12.1f}%  {val*100:>+12.1f}%  {(val-base)*100:>+9.1f}%")

    yr_compare = [
        ("2022", -0.294, results["annual_returns"].get("2022", 0)),
        ("2025", 0.177, results["annual_returns"].get("2025", 0)),
    ]
    for label, base, val in yr_compare:
        print(f"  {label:<16s} {base*100:>+12.1f}%  {val*100:>+12.1f}%  {(val-base)*100:>+9.1f}%")
    print(f"  {'Switches':<16s} {'73':>13s}  {results['n_token_switches']:>13d}")

    # Hypothesis validation
    print(f"\n{'='*70}")
    print("HYPOTHESIS VALIDATION")
    print(f"{'='*70}")
    calmar_improved = results["calmar"] > 0.99
    print(f"  1. Calmar improved vs baseline (0.99)?  {results['calmar']:.2f} — "
          f"{'YES' if calmar_improved else 'NO'}")

    doge_xrp_2022 = yr2022_buys.get("DOGE", 0) + yr2022_buys.get("XRP", 0)
    print(f"  2. DOGE/XRP selected during 2022 Kinetic+RiskOn?  "
          f"{doge_xrp_2022} selections — {'YES' if doge_xrp_2022 > 0 else 'NO'}")

    yr2022_ret = results["annual_returns"].get("2022", 0)
    dd_better = yr2022_ret > -0.294
    print(f"  3. 2022 drawdown better than -29.4%?  {yr2022_ret*100:+.1f}% — "
          f"{'YES' if dd_better else 'NO'}")

    print(f"\n  --- Last 20 trades ---")
    for trade in results["trades"][-20:]:
        print(f"    {trade['timestamp'][:10]} {trade['action']:4s} {trade.get('token',''):4s} "
              f"eq=${trade['equity']:,.0f}  {trade.get('reason','')}")

    # Save
    save = {k: v for k, v in results.items() if k not in ("equity_curve", "timestamps")}
    save["universe"] = "purified"
    save["tokens"] = list(TOKEN_FILES.keys())
    save["common_index_start"] = str(common_idx[0])
    save["common_index_end"] = str(common_idx[-1])
    save["token_selection"] = {t: token_counts.get(t, 0) / total_buys * 100 for t in TOKEN_FILES}
    save["token_selection_2022"] = {t: yr2022_buys.get(t, 0) for t in TOKEN_FILES}

    with open(RESULTS_PATH, "w") as f:
        json.dump(save, f, indent=2, default=str)
    print(f"\nResults saved to {RESULTS_PATH}")


if __name__ == "__main__":
    main()
