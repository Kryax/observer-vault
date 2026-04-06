"""
HMM v5 Pipeline — 3-feature (log_return + realized_vol + efficiency_ratio)
with forward-return labelling and asymmetric persistence.
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
RESULTS_PATH = DATA_DIR / "hmm_momentum_v5_results.json"

TOKEN_FILES = {
    "BTC": "btc_ohlcv_1h_extended.csv",
    "ETH": "eth_ohlcv_1h.csv",
    "SOL": "sol_ohlcv_1h.csv",
    "BNB": "bnb_ohlcv_1h.csv",
    "ADA": "ada_ohlcv_1h.csv",
}

TRAIN_BARS = 365 * 24
TEST_BARS = 180 * 24

PERSISTENCE_THRESHOLDS = {"D": 24, "I": 24, "R": 3}
FEATURE_COLS = ["log_return", "realized_vol", "efficiency_ratio"]


def load_data(token: str) -> pd.DataFrame:
    path = DATA_DIR / TOKEN_FILES[token]
    df = pd.read_csv(path, parse_dates=["timestamp"])
    df = df.sort_values("timestamp").reset_index(drop=True)
    df.set_index("timestamp", inplace=True)
    return df


def walk_forward_classify(features: np.ndarray, prices: np.ndarray) -> tuple[list[str], HMMRegimeClassifier]:
    n = len(features)
    regimes = ["I"] * n
    last_model = None

    start = 0
    fold = 0
    while start + TRAIN_BARS < n:
        fold += 1
        train_end = start + TRAIN_BARS
        test_end = min(train_end + TEST_BARS, n)

        train_feat = features[start:train_end]
        train_prices = prices[start:train_end]
        test_feat = features[train_end:test_end]

        print(f"    Fold {fold}: train [{start}:{train_end}] test [{train_end}:{test_end}]")

        clf = HMMRegimeClassifier(n_states=3, n_iter=100)
        clf.fit(train_feat, train_prices)

        test_labels = clf.predict(test_feat)
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


def sanity_checks(token, features, regimes, data, clf):
    print(f"\n{'='*60}")
    print(f"SANITY CHECKS: {token}")
    print(f"{'='*60}")

    # Feature distributions
    print(f"\n--- Feature distributions ---")
    for col in FEATURE_COLS:
        vals = features[col].values
        print(f"  {col:20s}  mean={np.mean(vals):+.4f}  std={np.std(vals):.4f}  "
              f"min={np.min(vals):+.4f}  max={np.max(vals):+.4f}")

    # State means
    if clf is not None:
        print(f"\n--- HMM learned state means ---")
        sm = clf.state_means()
        for label in ["D", "I", "R"]:
            m = sm[label]
            parts = [f"{k}={v:+.4f}" for k, v in m.items()]
            print(f"  {label}: {', '.join(parts)}")

    # Mean ER by confirmed regime
    print(f"\n--- Mean ER by confirmed regime ---")
    er_vals = features["efficiency_ratio"].values
    for label in ["D", "I", "R"]:
        idx = [i for i in range(len(regimes)) if regimes[i] == label]
        if idx:
            mean_er = np.mean(er_vals[idx])
            print(f"  {label}: ER={mean_er:.4f}  (n={len(idx)})")

    # Regime distribution
    counts = Counter(regimes)
    total = len(regimes)
    print(f"\n--- Regime distribution ---")
    for label in ["D", "I", "R"]:
        pct = counts.get(label, 0) / total * 100
        print(f"  {label}: {counts.get(label, 0):>6d} bars ({pct:.1f}%)")

    # Transition frequency
    transitions = sum(1 for i in range(1, len(regimes)) if regimes[i] != regimes[i-1])
    avg_run = total / transitions if transitions > 0 else total
    print(f"\n--- Transition frequency ---")
    print(f"  {transitions} transitions, avg run {avg_run:.0f} bars ({avg_run/24:.1f} days)")

    # Forward returns by regime
    closes = data["close"].values
    print(f"\n--- 24h forward returns by regime ---")
    d_fwd = r_fwd = 0
    for label in ["D", "I", "R"]:
        idx = [i for i in range(len(regimes) - 24) if regimes[i] == label]
        if not idx:
            print(f"  {label}: no bars")
            continue
        fwd = [np.log(closes[i+24] / closes[i]) for i in idx]
        mean_fwd = np.mean(fwd)
        print(f"  {label}: mean={mean_fwd*100:+.3f}%  std={np.std(fwd)*100:.3f}%  n={len(idx)}")
        if label == "D": d_fwd = mean_fwd
        if label == "R": r_fwd = mean_fwd

    passed = d_fwd > r_fwd
    if passed:
        print(f"\n  OK: D ({d_fwd*100:+.3f}%) > R ({r_fwd*100:+.3f}%)")
    else:
        print(f"\n  *** WARN: D ({d_fwd*100:+.3f}%) <= R ({r_fwd*100:+.3f}%)")

    return passed


def main():
    print("=" * 60)
    print("HMM V5 — 3-FEATURE + EFFICIENCY RATIO + FWD-RETURN LABELS")
    print("=" * 60)

    all_data = {}
    all_features = {}
    all_regimes = {}
    all_classifiers = {}
    all_passed = True

    for token in TOKEN_FILES:
        print(f"\n>>> Loading {token}...")
        data = load_data(token)
        all_data[token] = data
        print(f"    {len(data)} bars: {data.index[0]} to {data.index[-1]}")

        print(f"    Computing features...")
        features = compute_price_native_features(data)
        all_features[token] = features

        # Quick ER distribution check
        er = features["efficiency_ratio"].values
        print(f"    ER: mean={np.mean(er):.3f} std={np.std(er):.3f} "
              f"min={np.min(er):.3f} max={np.max(er):.3f}")

        print(f"    Walk-forward HMM (3 features + fwd-return labelling)...")
        feat_arr = features[FEATURE_COLS].values
        prices = data["close"].values.astype(np.float64)
        raw_regimes, clf = walk_forward_classify(feat_arr, prices)
        all_classifiers[token] = clf

        regimes = apply_persistence_filter(raw_regimes)
        all_regimes[token] = regimes

        passed = sanity_checks(token, features, regimes, data, clf)
        if not passed:
            all_passed = False

    if not all_passed:
        print("\n*** SANITY CHECK WARNINGS detected. Proceeding with backtest. ***")

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

    # D>R summary table
    print(f"\n--- D>R Directional Check ---")
    d_r_pass = 0
    for token in TOKEN_FILES:
        closes = all_data[token]["close"].values
        regimes = all_regimes[token]
        d_idx = [i for i in range(len(regimes) - 24) if regimes[i] == "D"]
        r_idx = [i for i in range(len(regimes) - 24) if regimes[i] == "R"]
        d_fwd = np.mean([np.log(closes[i+24]/closes[i]) for i in d_idx]) if d_idx else 0
        r_fwd = np.mean([np.log(closes[i+24]/closes[i]) for i in r_idx]) if r_idx else 0
        ok = d_fwd > r_fwd
        if ok: d_r_pass += 1

        er_vals = all_features[token]["efficiency_ratio"].values
        d_er = np.mean([er_vals[i] for i in range(len(regimes)) if regimes[i] == "D"]) if d_idx else 0
        i_er = np.mean([er_vals[i] for i in range(len(regimes)) if regimes[i] == "I"]) if any(r == "I" for r in regimes) else 0
        print(f"  {token}: D_fwd={d_fwd*100:+.3f}% R_fwd={r_fwd*100:+.3f}%  "
              f"ER(D)={d_er:.3f} ER(I)={i_er:.3f}  {'OK' if ok else 'FAIL'}")
    print(f"  Result: {d_r_pass}/5 pass")

    print(f"\n--- Last 20 trades ---")
    for trade in results["trades"][-20:]:
        print(f"  {trade['timestamp'][:10]} {trade['action']:4s} {trade.get('token',''):4s} "
              f"eq=${trade['equity']:,.0f}  {trade.get('reason','')}")

    # Save
    save = {k: v for k, v in results.items() if k not in ("equity_curve", "timestamps")}
    save["version"] = "v5"
    save["features_used"] = FEATURE_COLS
    save["labelling"] = "forward_return_24h"
    save["persistence_thresholds"] = PERSISTENCE_THRESHOLDS
    save["sanity_checks_passed"] = all_passed
    save["d_r_pass_count"] = d_r_pass

    save["regime_summary"] = {}
    for token in TOKEN_FILES:
        c = Counter(all_regimes[token])
        total = len(all_regimes[token])
        save["regime_summary"][token] = {
            label: {"count": c.get(label, 0), "pct": round(c.get(label, 0) / total * 100, 1)}
            for label in ["D", "I", "R"]
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
