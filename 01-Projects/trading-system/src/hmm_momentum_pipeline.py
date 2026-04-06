"""
HMM v6.2 Pipeline — Gatekeeper Update.

K=2 HMM (Kinetic/Quiet). Gatekeeper uses avg_momentum with hysteresis deadband.
Quiet = unconditional Hold. Three deadband widths tested.
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
RESULTS_PATH = DATA_DIR / "hmm_momentum_v6_2_results.json"

TOKEN_FILES = {
    "BTC": "btc_ohlcv_1h_extended.csv",
    "ETH": "eth_ohlcv_1h.csv",
    "SOL": "sol_ohlcv_1h.csv",
    "BNB": "bnb_ohlcv_1h.csv",
    "ADA": "ada_ohlcv_1h.csv",
}

TRAIN_BARS = 365 * 24
TEST_BARS = 180 * 24
PERSISTENCE_THRESHOLDS = {"Kinetic": 3, "Quiet": 24}

VARIANTS = {
    "v6.2a": 0.005,   # ±0.5%
    "v6.2b": 0.01,    # ±1.0%
    "v6.2c": 0.02,    # ±2.0%
}


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


def apply_persistence_filter(regimes: list[str], thresholds: dict | None = None) -> list[str]:
    if thresholds is None:
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


def run_variant(name, deadband, all_data, all_regimes):
    print(f"\n{'='*60}")
    print(f"VARIANT {name}: deadband = +/-{deadband*100:.1f}% on avg_momentum")
    print(f"{'='*60}")

    allocator = DualMomentumAllocator(
        momentum_window=720, rebalance_bars=168,
        switch_threshold=0.05, deadband=deadband,
    )
    results = allocator.run(all_data, all_regimes, initial_capital=10_000.0)

    print(f"  Total Return:     {results['total_return']*100:+.1f}%")
    print(f"  Final Equity:     ${results['final_equity']:,.0f}")
    print(f"  CAGR:             {results['cagr']*100:.1f}%")
    print(f"  Max Drawdown:     {results['max_drawdown']*100:.1f}%")
    print(f"  Sharpe Ratio:     {results['sharpe']:.2f}")
    print(f"  Calmar Ratio:     {results['calmar']:.2f}")
    print(f"  Time in Market:   {results['pct_in_market']*100:.1f}%")
    print(f"  Token Switches:   {results['n_token_switches']}")

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

    print(f"\n  --- Last 15 trades ---")
    for trade in results["trades"][-15:]:
        print(f"    {trade['timestamp'][:10]} {trade['action']:4s} {trade.get('token',''):4s} "
              f"eq=${trade['equity']:,.0f}  {trade.get('reason','')}")

    return results


def main():
    print("=" * 60)
    print("HMM V6.2 — GATEKEEPER (avg_momentum deadband)")
    print("=" * 60)

    # Phase 1: Load + classify (shared)
    all_data = {}
    all_regimes = {}

    for token in TOKEN_FILES:
        print(f"\n>>> Loading {token}...")
        data = load_data(token)
        all_data[token] = data
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

    # Phase 2: Run variants
    all_results = {}
    for name, deadband in VARIANTS.items():
        results = run_variant(name, deadband, all_data, all_regimes)
        save = {k: v for k, v in results.items() if k not in ("equity_curve", "timestamps")}
        save["variant"] = name
        save["deadband"] = deadband
        all_results[name] = save

    # Phase 3: Comparison
    print(f"\n{'='*60}")
    print("COMPARISON")
    print(f"{'='*60}")
    print(f"  {'Variant':<10s} {'Return':>10s} {'CAGR':>8s} {'MaxDD':>8s} {'Sharpe':>8s} "
          f"{'Calmar':>8s} {'2021':>8s} {'2022':>8s} {'2025':>8s} {'Switches':>10s}")
    for name, r in all_results.items():
        ar = r.get("annual_returns", {})
        print(f"  {name:<10s} {r['total_return']*100:>+9.0f}% {r['cagr']*100:>7.1f}% "
              f"{r['max_drawdown']*100:>7.1f}% {r['sharpe']:>8.2f} {r['calmar']:>8.2f} "
              f"{ar.get('2021',0)*100:>+7.0f}% {ar.get('2022',0)*100:>+7.1f}% "
              f"{ar.get('2025',0)*100:>+7.1f}% {r['n_token_switches']:>10d}")
    print(f"  {'v6 base':<10s} {'  +1242':>9s}% {'  58.4':>7s}% {' -66.3':>7s}% "
          f"{'    0.62':>8s} {'    0.88':>8s} {'  +491':>7s}% {'  -3.7':>7s}% {' -12.4':>7s}% {'       161':>10s}")

    # 2022 constraint
    print(f"\n  2022 constraint (must be > -10%):")
    for name, r in all_results.items():
        yr2022 = r.get("annual_returns", {}).get("2022", 0) * 100
        status = "PASS" if yr2022 > -10 else "FAIL"
        print(f"    {name}: {yr2022:+.1f}% -- {status}")

    # Pick winner
    passing = {n: r for n, r in all_results.items()
               if r.get("annual_returns", {}).get("2022", -1) > -0.10}
    if passing:
        # Among passing: prefer fewest switches, then highest return
        winner = min(passing, key=lambda n: (passing[n]["n_token_switches"], -passing[n]["total_return"]))
        print(f"\n  RECOMMENDED: {winner} "
              f"(switches={passing[winner]['n_token_switches']}, "
              f"return={passing[winner]['total_return']*100:+.1f}%)")
    else:
        print(f"\n  NO VARIANT PASSES 2022 CONSTRAINT")

    with open(RESULTS_PATH, "w") as f:
        json.dump(all_results, f, indent=2, default=str)
    print(f"\nResults saved to {RESULTS_PATH}")

    return all_results


if __name__ == "__main__":
    main()
