"""
HMM v6 Pipeline — K=2 (Kinetic/Quiet) + momentum direction.

Two HMM states (vol-based), momentum handles direction.
Kinetic+up → risk on, Kinetic+down → cash, Quiet → hold.
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
RESULTS_PATH = DATA_DIR / "hmm_momentum_v6_results.json"

TOKEN_FILES = {
    "BTC": "btc_ohlcv_1h_extended.csv",
    "ETH": "eth_ohlcv_1h.csv",
    "SOL": "sol_ohlcv_1h.csv",
    "BNB": "bnb_ohlcv_1h.csv",
    "ADA": "ada_ohlcv_1h.csv",
}

TRAIN_BARS = 365 * 24
TEST_BARS = 180 * 24

# Asymmetric persistence: fast Kinetic detection, stable Quiet hold
PERSISTENCE_THRESHOLDS = {"Kinetic": 3, "Quiet": 24}


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

        print(f"    Fold {fold}: train [{start}:{train_end}] test [{train_end}:{test_end}]")

        clf = HMMRegimeClassifier(n_states=2, n_iter=100)
        clf.fit(features[start:train_end])

        test_labels = clf.predict(features[train_end:test_end])
        for j, label in enumerate(test_labels):
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
                confirmed[i] = current
        else:
            pending = raw
            pending_count = 1
            confirmed[i] = current

    return confirmed


def analyze_2022_momentum_lag(token, data, regimes, momentum_window=720):
    """Analyze how quickly momentum goes negative after Kinetic detection in 2022."""
    prices = data["close"].values
    timestamps = data.index
    log_prices = np.log(np.maximum(prices, 1e-12))

    # Find 2022 bars
    mask_2022 = [(hasattr(t, 'year') and t.year == 2022) or
                 ('2022' in str(t)) for t in timestamps]

    # Find first Kinetic bar in 2022 (or late 2021)
    first_kinetic_2022 = None
    first_neg_momentum = None

    for i in range(len(regimes)):
        if not mask_2022[i]:
            continue
        if regimes[i] == "Kinetic" and first_kinetic_2022 is None:
            first_kinetic_2022 = i

        if i >= momentum_window:
            mom = log_prices[i] - log_prices[i - momentum_window]
            if mom < 0 and first_neg_momentum is None and mask_2022[i]:
                first_neg_momentum = i

    if first_kinetic_2022 is not None and first_neg_momentum is not None:
        lag_bars = first_neg_momentum - first_kinetic_2022
        # Drawdown in the lag window
        if lag_bars > 0:
            peak = np.max(prices[first_kinetic_2022:first_neg_momentum+1])
            trough = prices[first_neg_momentum]
            dd = (trough - peak) / peak * 100
        else:
            dd = 0
        print(f"    {token} 2022 lag: Kinetic@{timestamps[first_kinetic_2022]} "
              f"→ neg_mom@{timestamps[first_neg_momentum]} "
              f"({lag_bars} bars / {lag_bars/24:.1f} days)  DD in lag: {dd:.1f}%")
    else:
        print(f"    {token} 2022: no clear Kinetic→neg_momentum sequence found")


def main():
    print("=" * 60)
    print("HMM V6 — K=2 (KINETIC/QUIET) + MOMENTUM DIRECTION")
    print("=" * 60)

    all_data = {}
    all_features = {}
    all_regimes = {}
    all_classifiers = {}

    for token in TOKEN_FILES:
        print(f"\n>>> Loading {token}...")
        data = load_data(token)
        all_data[token] = data
        print(f"    {len(data)} bars: {data.index[0]} to {data.index[-1]}")

        print(f"    Computing features...")
        features = compute_price_native_features(data)
        all_features[token] = features

        print(f"    Walk-forward HMM (K=2)...")
        feat_arr = features[["log_return", "realized_vol"]].values
        raw_regimes, clf = walk_forward_classify(feat_arr)
        all_classifiers[token] = clf

        regimes = apply_persistence_filter(raw_regimes)
        all_regimes[token] = regimes

        # Sanity checks
        counts = Counter(regimes)
        total = len(regimes)
        transitions = sum(1 for i in range(1, len(regimes)) if regimes[i] != regimes[i-1])
        avg_run = total / transitions if transitions > 0 else total

        print(f"    Kinetic: {counts.get('Kinetic',0)/total*100:.1f}%  "
              f"Quiet: {counts.get('Quiet',0)/total*100:.1f}%  "
              f"transitions={transitions}  avg_run={avg_run/24:.1f}d")

        if clf is not None:
            sm = clf.state_means()
            for label in ["Kinetic", "Quiet"]:
                m = sm[label]
                print(f"    {label}: log_ret={m['log_return']:+.4f}  vol={m['realized_vol']:.4f}")

    # 2022 momentum lag analysis
    print(f"\n{'='*60}")
    print("2022 MOMENTUM LAG ANALYSIS")
    print(f"{'='*60}")
    for token in TOKEN_FILES:
        analyze_2022_momentum_lag(token, all_data[token], all_regimes[token])

    # Backtest
    print(f"\n{'='*60}")
    print("RUNNING DUAL MOMENTUM BACKTEST")
    print(f"{'='*60}")

    allocator = DualMomentumAllocator(momentum_window=720, rebalance_bars=168, switch_threshold=0.05)
    results = allocator.run(all_data, all_regimes, initial_capital=10_000.0)

    print(f"\n{'='*60}")
    print("RESULTS")
    print(f"{'='*60}")
    print(f"  Total Return:     {results['total_return']*100:+.1f}%")
    print(f"  Final Equity:     ${results['final_equity']:,.0f}")
    print(f"  CAGR:             {results['cagr']*100:.1f}%")
    print(f"  Max Drawdown:     {results['max_drawdown']*100:.1f}%")
    print(f"  Sharpe Ratio:     {results['sharpe']:.2f}")
    print(f"  Calmar Ratio:     {results['calmar']:.2f}")
    print(f"  Time in Market:   {results['pct_in_market']*100:.1f}%")
    print(f"  Token Switches:   {results['n_token_switches']}")
    print(f"  Period:           {results['years']:.1f} years")

    print(f"\n--- Annual Returns ---")
    for year, ret in sorted(results["annual_returns"].items()):
        print(f"  {year}: {ret*100:+.1f}%")

    print(f"\n--- Buy-and-Hold Comparison ---")
    for token, ret in results["buy_and_hold"].items():
        print(f"  {token}: {ret*100:+.1f}%")
    print(f"  Equal-weight basket: {results['buy_and_hold_basket']*100:+.1f}%")

    print(f"\n--- State Time by Year ---")
    print(f"  {'Year':<6s} {'Kinetic+':<10s} {'Kinetic-':<10s} {'Quiet':<10s}")
    for year, st in sorted(results.get("state_time_by_year", {}).items()):
        print(f"  {year:<6s} {st['kinetic_pos']:>8.1f}%  {st['kinetic_neg']:>8.1f}%  {st['quiet']:>8.1f}%")

    print(f"\n--- Last 20 trades ---")
    for trade in results["trades"][-20:]:
        print(f"  {trade['timestamp'][:10]} {trade['action']:4s} {trade.get('token',''):4s} "
              f"eq=${trade['equity']:,.0f}  {trade.get('reason','')}")

    # Save
    save = {k: v for k, v in results.items() if k not in ("equity_curve", "timestamps")}
    save["version"] = "v6"
    save["features_used"] = ["log_return", "realized_vol"]
    save["hmm_states"] = 2
    save["labelling"] = "vol_based"
    save["persistence_thresholds"] = PERSISTENCE_THRESHOLDS

    save["regime_summary"] = {}
    for token in TOKEN_FILES:
        c = Counter(all_regimes[token])
        total = len(all_regimes[token])
        save["regime_summary"][token] = {
            label: {"count": c.get(label, 0), "pct": round(c.get(label, 0) / total * 100, 1)}
            for label in ["Kinetic", "Quiet"]
        }

    save["transition_matrices"] = {}
    for token in TOKEN_FILES:
        if all_classifiers[token] is not None:
            save["transition_matrices"][token] = all_classifiers[token].get_transition_matrix()

    with open(RESULTS_PATH, "w") as f:
        json.dump(save, f, indent=2, default=str)

    print(f"\nResults saved to {RESULTS_PATH}")
    return results


if __name__ == "__main__":
    main()
