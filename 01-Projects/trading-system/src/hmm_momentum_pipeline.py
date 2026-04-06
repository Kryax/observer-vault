"""
HMM v6.1 Pipeline — Fluid Dynamic State Machine.

K=2 HMM (Kinetic/Quiet) + deadband hysteresis + quiet-trend permeability.
Three variants tested: quiet_threshold = 5%, 10%, 15%.
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
RESULTS_PATH = DATA_DIR / "hmm_momentum_v6_1_results.json"

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
    "v6.1a": {"quiet_threshold": 0.05, "deadband": 0.02},
    "v6.1b": {"quiet_threshold": 0.10, "deadband": 0.02},
    "v6.1c": {"quiet_threshold": 0.15, "deadband": 0.02},
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
        print(f"    Fold {fold}: [{start}:{train_end}] → [{train_end}:{test_end}]")
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


def run_variant(name, params, all_data, all_regimes):
    """Run one quiet_threshold variant."""
    print(f"\n{'='*60}")
    print(f"VARIANT {name}: quiet_threshold={params['quiet_threshold']:.0%}, deadband={params['deadband']:.0%}")
    print(f"{'='*60}")

    allocator = DualMomentumAllocator(
        momentum_window=720, rebalance_bars=168, switch_threshold=0.05,
        deadband=params["deadband"], quiet_threshold=params["quiet_threshold"],
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

    print(f"\n  --- State Time by Year ---")
    print(f"    {'Year':<6s} {'Kin+':<8s} {'Kin-':<8s} {'Q-hold':<8s} {'Q-deploy':<8s}")
    for year, st in sorted(results.get("state_time_by_year", {}).items()):
        print(f"    {year:<6s} {st.get('kinetic_pos',0):>6.1f}%  {st.get('kinetic_neg',0):>6.1f}%  "
              f"{st.get('quiet_hold',0):>6.1f}%  {st.get('quiet_deployed',0):>6.1f}%")

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
    print("HMM V6.1 — FLUID DYNAMIC STATE MACHINE")
    print("=" * 60)

    # Phase 1: Load data + classify (shared across variants)
    all_data = {}
    all_regimes = {}
    all_classifiers = {}

    for token in TOKEN_FILES:
        print(f"\n>>> Loading {token}...")
        data = load_data(token)
        all_data[token] = data
        print(f"    {len(data)} bars: {data.index[0]} to {data.index[-1]}")

        features = compute_price_native_features(data)
        feat_arr = features[["log_return", "realized_vol"]].values
        raw_regimes, clf = walk_forward_classify(feat_arr)
        all_classifiers[token] = clf
        regimes = apply_persistence_filter(raw_regimes)
        all_regimes[token] = regimes

        counts = Counter(regimes)
        total = len(regimes)
        transitions = sum(1 for i in range(1, len(regimes)) if regimes[i] != regimes[i-1])
        print(f"    Kinetic: {counts.get('Kinetic',0)/total*100:.1f}%  "
              f"Quiet: {counts.get('Quiet',0)/total*100:.1f}%  transitions={transitions}")

    # Phase 2: Run all three variants
    all_results = {}
    for name, params in VARIANTS.items():
        results = run_variant(name, params, all_data, all_regimes)
        save = {k: v for k, v in results.items() if k not in ("equity_curve", "timestamps")}
        save["variant"] = name
        save["params"] = params
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

    # v6 baseline for reference
    print(f"  {'v6 base':<10s} {'  +1242':>9s}% {'  58.4':>7s}% {' -66.3':>7s}% "
          f"{'    0.62':>8s} {'    0.88':>8s} {'  +491':>7s}% {'  -3.7':>7s}% {' -12.4':>7s}% {'       161':>10s}")

    # Check 2022 constraint
    print(f"\n  2022 constraint check (must be > -10%):")
    for name, r in all_results.items():
        yr2022 = r.get("annual_returns", {}).get("2022", 0) * 100
        status = "PASS" if yr2022 > -10 else "FAIL"
        print(f"    {name}: {yr2022:+.1f}% — {status}")

    with open(RESULTS_PATH, "w") as f:
        json.dump(all_results, f, indent=2, default=str)
    print(f"\nResults saved to {RESULTS_PATH}")

    return all_results


if __name__ == "__main__":
    main()
