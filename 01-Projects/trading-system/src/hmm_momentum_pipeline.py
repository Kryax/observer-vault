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
RESULTS_PATH = DATA_DIR / "hmm_momentum_v3_results.json"

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

# Asymmetric persistence: enter slowly, exit fast
PERSISTENCE_THRESHOLDS = {
    "D": 24,  # 1 day to confirm trend
    "I": 24,  # 1 day to confirm consolidation
    "R": 3,   # 3 hours to confirm crash — fast eject
}


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


def apply_persistence_filter(regimes: list[str], thresholds: dict | None = None) -> list[str]:
    """
    Asymmetric persistence: each regime has its own confirmation threshold.
    D and I need slow confirmation (prevent head-fakes).
    R needs near-instant confirmation (survive crashes).
    """
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
            required = thresholds.get(raw, 24)
            if pending_count >= required:
                current = pending
                confirmed[i] = current
            else:
                confirmed[i] = current
        else:
            pending = raw
            pending_count = 1
            confirmed[i] = current

    return confirmed


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


VARIANTS = {
    "v3a": {"D": 24, "I": 24, "R": 3},
    "v3b": {"D": 48, "I": 24, "R": 6},
    "v3c": {"D": 12, "I": 12, "R": 1},
}


def run_variant(
    variant_name: str,
    thresholds: dict,
    all_data: dict,
    all_raw_regimes: dict,
    all_classifiers: dict,
    all_features: dict,
):
    """Run a single persistence variant and return results."""
    print(f"\n{'='*60}")
    print(f"VARIANT {variant_name}: D={thresholds['D']}, I={thresholds['I']}, R={thresholds['R']}")
    print(f"{'='*60}")

    all_regimes = {}
    all_passed = True
    for token in TOKEN_FILES:
        regimes = apply_persistence_filter(all_raw_regimes[token], thresholds)
        all_regimes[token] = regimes

        # Quick sanity: regime distribution + transition frequency + directional check
        from collections import Counter
        counts = Counter(regimes)
        total = len(regimes)
        transitions = sum(1 for i in range(1, len(regimes)) if regimes[i] != regimes[i-1])
        avg_run = total / transitions if transitions > 0 else total

        closes = all_data[token]["close"].values
        d_idx = [i for i in range(len(regimes) - 24) if regimes[i] == "D"]
        r_idx = [i for i in range(len(regimes) - 24) if regimes[i] == "R"]
        d_fwd = np.mean([np.log(closes[i+24] / closes[i]) for i in d_idx]) if d_idx else 0
        r_fwd = np.mean([np.log(closes[i+24] / closes[i]) for i in r_idx]) if r_idx else 0
        passed = d_fwd > r_fwd

        print(f"  {token}: D={counts.get('D',0)/total*100:.0f}% I={counts.get('I',0)/total*100:.0f}% "
              f"R={counts.get('R',0)/total*100:.0f}%  "
              f"transitions={transitions}  avg_run={avg_run/24:.1f}d  "
              f"D_fwd={d_fwd*100:+.3f}% R_fwd={r_fwd*100:+.3f}% {'OK' if passed else 'WARN'}")
        if not passed:
            all_passed = False

    allocator = DualMomentumAllocator(momentum_window=720, rebalance_bars=168, switch_threshold=0.05)
    results = allocator.run(all_data, all_regimes, initial_capital=10_000.0)

    print(f"\n  Total Return:     {results['total_return']*100:+.1f}%")
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

    print(f"\n  --- Buy-and-Hold ---")
    for token, ret in results["buy_and_hold"].items():
        print(f"    {token}: {ret*100:+.1f}%")
    print(f"    Equal-weight basket: {results['buy_and_hold_basket']*100:+.1f}%")

    print(f"\n  --- Last 10 trades ---")
    for trade in results["trades"][-10:]:
        print(f"    {trade['timestamp'][:10]} {trade['action']:4s} {trade.get('token',''):4s} "
              f"eq=${trade['equity']:,.0f}  {trade.get('reason','')}")

    # Build save dict
    save = {k: v for k, v in results.items() if k not in ("equity_curve", "timestamps")}
    save["sanity_checks_passed"] = all_passed
    save["thresholds"] = thresholds
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

    return save


def main():
    print("=" * 60)
    print("HMM + DUAL MOMENTUM PIPELINE — V3 ASYMMETRIC PERSISTENCE")
    print("=" * 60)

    # Phase 1: Load data, compute features, raw HMM classification (shared across variants)
    all_data = {}
    all_features = {}
    all_raw_regimes = {}
    all_classifiers = {}

    for token in TOKEN_FILES:
        print(f"\n>>> Loading {token}...")
        data = load_data(token)
        all_data[token] = data
        print(f"    {len(data)} bars from {data.index[0]} to {data.index[-1]}")

        print(f"    Computing features...")
        features = compute_price_native_features(data)
        all_features[token] = features

        # Hurst distribution check (once, shared)
        h = features["hurst"].values
        print(f"    Hurst: mean={np.mean(h):.3f} std={np.std(h):.3f} "
              f"min={np.min(h):.3f} max={np.max(h):.3f}")

        print(f"    Walk-forward HMM classification...")
        feat_arr = features[["hurst", "log_return", "realized_vol", "autocorrelation"]].values
        raw_regimes, clf = walk_forward_classify(feat_arr)
        all_raw_regimes[token] = raw_regimes
        all_classifiers[token] = clf

    # Phase 2: Run all three variants
    all_variant_results = {}
    for name, thresholds in VARIANTS.items():
        result = run_variant(name, thresholds, all_data, all_raw_regimes, all_classifiers, all_features)
        all_variant_results[name] = result

    # Phase 3: Comparison summary
    print(f"\n{'='*60}")
    print("COMPARISON SUMMARY")
    print(f"{'='*60}")
    print(f"  {'Variant':<8s} {'Return':>10s} {'CAGR':>8s} {'MaxDD':>8s} {'Sharpe':>8s} "
          f"{'Calmar':>8s} {'Switches':>10s} {'2022':>8s}")
    for name, r in all_variant_results.items():
        yr2022 = r.get("annual_returns", {}).get("2022", 0)
        print(f"  {name:<8s} {r['total_return']*100:>+9.0f}% {r['cagr']*100:>7.1f}% "
              f"{r['max_drawdown']*100:>7.1f}% {r['sharpe']:>8.2f} {r['calmar']:>8.2f} "
              f"{r['n_token_switches']:>10d} {yr2022*100:>+7.1f}%")

    # Save all results
    with open(RESULTS_PATH, "w") as f:
        json.dump(all_variant_results, f, indent=2, default=str)
    print(f"\nResults saved to {RESULTS_PATH}")

    return all_variant_results


if __name__ == "__main__":
    main()
