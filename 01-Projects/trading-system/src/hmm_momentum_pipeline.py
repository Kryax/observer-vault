"""
HMM + Dual Momentum Pipeline.

Walk-forward architecture:
  1. For each fold: fit HMM on training data, classify test data
  2. Produce continuous regime classification across the full dataset
  3. Run dual momentum strategy with full equity compounding
  4. Report comprehensive metrics and sanity checks
"""

import json
import sys
from pathlib import Path

# Unbuffered output for progress tracking
sys.stdout.reconfigure(line_buffering=True)

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))

from features.price_native import compute_price_native_features
from classifier.hmm_regime import HMMRegimeClassifier
from strategy.dual_momentum import DualMomentumAllocator


DATA_DIR = Path(__file__).parent.parent / "data"
RESULTS_PATH = DATA_DIR / "hmm_momentum_results.json"

TOKEN_FILES = {
    "BTC": "btc_ohlcv_1h_extended.csv",
    "ETH": "eth_ohlcv_1h.csv",
    "SOL": "sol_ohlcv_1h.csv",
    "BNB": "bnb_ohlcv_1h.csv",
    "ADA": "ada_ohlcv_1h.csv",
}

# Walk-forward: 1-year training, 6-month test, rolling
TRAIN_BARS = 365 * 24   # ~1 year
TEST_BARS = 180 * 24    # ~6 months


def load_data(token: str) -> pd.DataFrame:
    path = DATA_DIR / TOKEN_FILES[token]
    df = pd.read_csv(path, parse_dates=["timestamp"])
    df = df.sort_values("timestamp").reset_index(drop=True)
    df.set_index("timestamp", inplace=True)
    return df


def walk_forward_classify(features: np.ndarray) -> tuple[list[str], HMMRegimeClassifier]:
    """Walk-forward HMM classification. Returns full regime sequence + last fitted model."""
    n = len(features)
    regimes = ["I"] * n  # default until classified
    last_model = None

    start = 0
    while start + TRAIN_BARS < n:
        train_end = start + TRAIN_BARS
        test_end = min(train_end + TEST_BARS, n)

        train_feat = features[start:train_end]
        test_feat = features[train_end:test_end]

        clf = HMMRegimeClassifier(n_states=3, n_iter=100)
        clf.fit(train_feat)

        test_labels = clf.predict(test_feat)
        for j, label in enumerate(test_labels):
            regimes[train_end + j] = label

        last_model = clf
        start += TEST_BARS  # roll forward

    return regimes, last_model


def sanity_checks(
    token: str,
    features: pd.DataFrame,
    regimes: list[str],
    data: pd.DataFrame,
    clf: HMMRegimeClassifier,
):
    """Print sanity checks before running backtest."""
    feat_arr = features[["hurst", "log_return", "realized_vol", "autocorrelation"]].values
    print(f"\n{'='*60}")
    print(f"SANITY CHECKS: {token}")
    print(f"{'='*60}")

    # 1. Feature distributions
    print(f"\n--- Feature distributions ---")
    for col in ["hurst", "log_return", "realized_vol", "autocorrelation"]:
        vals = features[col].values
        print(f"  {col:20s}  mean={np.mean(vals):+.4f}  std={np.std(vals):.4f}  "
              f"min={np.min(vals):+.4f}  max={np.max(vals):+.4f}")

    # 2. HMM state means
    if clf is not None:
        print(f"\n--- HMM learned state means ---")
        sm = clf.state_means()
        for label in ["D", "I", "R"]:
            m = sm[label]
            print(f"  {label}: hurst={m['hurst']:.3f}  log_ret={m['log_return']:+.4f}  "
                  f"vol={m['realized_vol']:.3f}  autocorr={m['autocorrelation']:+.3f}")

    # 3. Regime distribution
    from collections import Counter
    counts = Counter(regimes)
    total = len(regimes)
    print(f"\n--- Regime distribution ---")
    for label in ["D", "I", "R"]:
        pct = counts.get(label, 0) / total * 100
        print(f"  {label}: {counts.get(label, 0):>6d} bars ({pct:.1f}%)")

    # 4. Transition frequency
    transitions = sum(1 for i in range(1, len(regimes)) if regimes[i] != regimes[i-1])
    avg_run = total / transitions if transitions > 0 else total
    print(f"\n--- Transition frequency ---")
    print(f"  {transitions} transitions in {total} bars")
    print(f"  Average run length: {avg_run:.1f} bars ({avg_run/24:.1f} days)")

    # 5. Forward returns by regime
    closes = data["close"].values
    print(f"\n--- 24h forward returns by regime ---")
    for label in ["D", "I", "R"]:
        indices = [i for i in range(len(regimes) - 24) if regimes[i] == label]
        if not indices:
            print(f"  {label}: no bars")
            continue
        fwd = [np.log(closes[i+24] / closes[i]) for i in indices]
        print(f"  {label}: mean={np.mean(fwd)*100:+.3f}%  std={np.std(fwd)*100:.3f}%  n={len(indices)}")

    passed = True
    # Check: D should have higher mean forward return than R
    d_indices = [i for i in range(len(regimes) - 24) if regimes[i] == "D"]
    r_indices = [i for i in range(len(regimes) - 24) if regimes[i] == "R"]
    if d_indices and r_indices:
        d_fwd = np.mean([np.log(closes[i+24] / closes[i]) for i in d_indices])
        r_fwd = np.mean([np.log(closes[i+24] / closes[i]) for i in r_indices])
        if d_fwd <= r_fwd:
            print(f"\n  *** WARNING: D forward return ({d_fwd*100:+.3f}%) <= R ({r_fwd*100:+.3f}%)")
            print(f"  *** Classifier may lack directional value for {token}")
            passed = False
        else:
            print(f"\n  OK: D ({d_fwd*100:+.3f}%) > R ({r_fwd*100:+.3f}%) — directional value confirmed")

    return passed


def main():
    print("=" * 60)
    print("HMM + DUAL MOMENTUM PIPELINE")
    print("=" * 60)

    # Phase 1: Load data and compute features
    all_data = {}
    all_features = {}
    all_regimes = {}
    all_classifiers = {}
    all_passed = True

    for token in TOKEN_FILES:
        print(f"\n>>> Loading {token}...")
        data = load_data(token)
        all_data[token] = data
        print(f"    {len(data)} bars from {data.index[0]} to {data.index[-1]}")

        print(f"    Computing features...")
        features = compute_price_native_features(data)
        all_features[token] = features

        print(f"    Walk-forward HMM classification...")
        feat_arr = features[["hurst", "log_return", "realized_vol", "autocorrelation"]].values
        regimes, clf = walk_forward_classify(feat_arr)
        all_regimes[token] = regimes
        all_classifiers[token] = clf

        passed = sanity_checks(token, features, regimes, data, clf)
        if not passed:
            all_passed = False

    if not all_passed:
        print("\n*** SANITY CHECK WARNINGS detected. Proceeding with backtest anyway. ***")

    # Phase 2: Run dual momentum backtest
    print(f"\n{'='*60}")
    print("RUNNING DUAL MOMENTUM BACKTEST")
    print(f"{'='*60}")

    allocator = DualMomentumAllocator(momentum_window=720, rebalance_bars=24)
    results = allocator.run(all_data, all_regimes, initial_capital=10_000.0)

    # Print results
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

    # Print rotation log (summary)
    print(f"\n--- Rotation Log (last 20 trades) ---")
    for trade in results["trades"][-20:]:
        print(f"  {trade['timestamp'][:10]} {trade['action']:4s} {trade.get('token', ''):4s} "
              f"eq=${trade['equity']:,.0f}  {trade.get('reason', '')}")

    # Save results (without equity curve for readability)
    save_results = {k: v for k, v in results.items() if k not in ("equity_curve", "timestamps")}
    save_results["sanity_checks_passed"] = all_passed

    # Add regime summaries per token
    save_results["regime_summary"] = {}
    for token in TOKEN_FILES:
        from collections import Counter
        c = Counter(all_regimes[token])
        total = len(all_regimes[token])
        save_results["regime_summary"][token] = {
            label: {"count": c.get(label, 0), "pct": round(c.get(label, 0) / total * 100, 1)}
            for label in ["D", "I", "R"]
        }

    # Add transition matrices
    save_results["transition_matrices"] = {}
    for token in TOKEN_FILES:
        if all_classifiers[token] is not None:
            save_results["transition_matrices"][token] = all_classifiers[token].get_transition_matrix()

    with open(RESULTS_PATH, "w") as f:
        json.dump(save_results, f, indent=2, default=str)

    print(f"\nResults saved to {RESULTS_PATH}")
    return results


if __name__ == "__main__":
    main()
