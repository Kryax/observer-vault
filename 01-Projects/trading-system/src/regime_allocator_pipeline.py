#!/usr/bin/env python3
"""
Model 1 v2: Regime Allocator — Daily-Only + Persistence Filter

Two approaches to fix the hourly noise problem:
  1. Daily-only: use macro (daily) regime, rebalance once per day max
  2. Persistence: hourly regime but require 72 consecutive bars to confirm

Variants:
  A: Daily-only, D=100% I=50% R=0%
  B: Daily-only, D=100% I=100% R=0% (hold through I)
  C: Hourly + 72-bar persistence, D=100% I=50% R=0%
  D: Hourly + 72-bar persistence, D=100% I=100% R=0%

Architecture: walk-forward classify → single continuous backtest (capital compounds)
"""

from __future__ import annotations

import json
import sys
import warnings
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.features.indicators_fast import compute_all_features
from src.features.vectorizer import vectorize_pipeline
from src.classifier.price_landscape import PriceLandscape
from src.classifier.multi_timeframe import MultiTimeframeClassifier
from src.backtest.engine import BacktestEngine
from src.backtest.baselines import BuyAndHold
from src.strategy.regime_allocator import RegimeAllocator

DATA_DIR = PROJECT_ROOT / "data"
WINDOW = 168

TOKEN_FILES = {
    "BTC": DATA_DIR / "btc_ohlcv_1h_extended.csv",
    "ETH": DATA_DIR / "eth_ohlcv_1h.csv",
    "SOL": DATA_DIR / "sol_ohlcv_1h.csv",
    "BNB": DATA_DIR / "bnb_ohlcv_1h.csv",
    "ADA": DATA_DIR / "ada_ohlcv_1h.csv",
}

VARIANTS = {
    "A_daily": {
        "d_allocation": 1.0, "i_allocation": 0.5, "r_allocation": 0.0,
        "rebalance_mode": "daily", "persistence_bars": 0,
        "desc": "Daily-only, D=100% I=50% R=0%",
    },
    "B_daily_holdI": {
        "d_allocation": 1.0, "i_allocation": 1.0, "r_allocation": 0.0,
        "rebalance_mode": "daily", "persistence_bars": 0,
        "desc": "Daily-only, D=100% I=100% R=0% (hold through I)",
    },
    "C_persist72": {
        "d_allocation": 1.0, "i_allocation": 0.5, "r_allocation": 0.0,
        "rebalance_mode": "hourly", "persistence_bars": 72,
        "desc": "Hourly + 72-bar persistence, D=100% I=50% R=0%",
    },
    "D_persist72_holdI": {
        "d_allocation": 1.0, "i_allocation": 1.0, "r_allocation": 0.0,
        "rebalance_mode": "hourly", "persistence_bars": 72,
        "desc": "Hourly + 72-bar persistence, D=100% I=100% R=0%",
    },
}


# ============================================================================
# Data loading + features
# ============================================================================

def load_token_data(symbol: str, filepath: Path) -> pd.DataFrame:
    df = pd.read_csv(filepath, parse_dates=["timestamp"], index_col="timestamp")
    df = df[~df.index.duplicated(keep="first")].sort_index()
    return df


def compute_vectors(df: pd.DataFrame, window: int = WINDOW) -> pd.DataFrame:
    features = compute_all_features(df, window)
    vectors = vectorize_pipeline(features)
    return vectors.dropna()


# ============================================================================
# Walk-forward classification (continuous regime series)
# ============================================================================

def walk_forward_classify(
    data: pd.DataFrame,
    vectors: pd.DataFrame,
    mtf: MultiTimeframeClassifier,
    train_bars: int = 2000,
    step_bars: int = 500,
) -> pd.DataFrame:
    """
    Walk-forward regime classification. Produces continuous hourly regime
    + daily macro regime columns over the full dataset.
    """
    n = len(data)
    if n < train_bars + step_bars:
        train_bars = int(n * 0.6)
        step_bars = n - train_bars

    all_clf = []
    all_macro = []

    start = 0
    while start + train_bars < n:
        train_end = start + train_bars
        test_end = min(train_end + step_bars, n)

        train_data = data.iloc[start:train_end]
        test_data = data.iloc[train_end:test_end]
        train_vecs = vectors.loc[vectors.index.isin(train_data.index)]
        test_vecs = vectors.loc[vectors.index.isin(test_data.index)]

        if len(train_vecs) < 200 or len(test_vecs) < 10:
            start += step_bars
            continue

        # Fit hourly landscape
        ls = PriceLandscape()
        ls.fit(train_vecs.values, k=3)

        # Classify test bars (hourly)
        X = test_vecs.values
        results = []
        for i in range(len(X)):
            vec = X[i]
            er = ls._compute_energy(vec)
            cls = ls.classify(vec)
            regime = ls.get_regime_for_label(er["nearest_basin"])
            results.append({"regime": regime, "confidence": cls["confidence"]})

        clf_df = pd.DataFrame(results, index=test_vecs.index)
        all_clf.append(clf_df)

        # Compute macro (daily) regime
        macro = mtf.compute_macro_regimes(data, start, train_end, test_end)
        all_macro.append(macro)

        start += step_bars

    if not all_clf:
        return pd.DataFrame(columns=["regime", "confidence", "macro_regime"])

    combined = pd.concat(all_clf)
    combined = combined[~combined.index.duplicated(keep="first")].sort_index()
    combined = combined.reindex(data.index).ffill()

    macro_combined = pd.concat(all_macro)
    macro_combined = macro_combined[~macro_combined.index.duplicated(keep="first")].sort_index()
    combined["macro_regime"] = macro_combined.reindex(data.index, method="ffill")
    combined["macro_regime"] = combined["macro_regime"].fillna("I")

    return combined


# ============================================================================
# Regime transition analysis
# ============================================================================

def analyze_transitions(transition_log: list[dict], total_bars: int) -> dict:
    """Compute transition frequency stats from the strategy's log."""
    n = len(transition_log)
    if n < 2:
        return {
            "total_transitions": n,
            "avg_days_between": 0,
            "longest_D_bars": 0, "longest_I_bars": 0, "longest_R_bars": 0,
        }

    # Gaps between transitions
    gaps = []
    for i in range(1, n):
        gap = transition_log[i]["idx"] - transition_log[i - 1]["idx"]
        gaps.append(gap)

    avg_bars = np.mean(gaps) if gaps else total_bars
    avg_days = avg_bars / 24

    # Longest continuous stretch per regime
    longest = {"D": 0, "I": 0, "R": 0}
    for i in range(len(transition_log)):
        regime = transition_log[i]["to"]
        if i + 1 < len(transition_log):
            stretch = transition_log[i + 1]["idx"] - transition_log[i]["idx"]
        else:
            stretch = total_bars - transition_log[i]["idx"]
        if regime in longest and stretch > longest[regime]:
            longest[regime] = stretch

    return {
        "total_transitions": n,
        "avg_days_between": float(avg_days),
        "longest_D_bars": longest["D"],
        "longest_I_bars": longest["I"],
        "longest_R_bars": longest["R"],
        "longest_D_days": longest["D"] / 24,
        "longest_I_days": longest["I"] / 24,
        "longest_R_days": longest["R"] / 24,
    }


# ============================================================================
# Run single continuous backtest
# ============================================================================

def run_variant(
    data: pd.DataFrame,
    clf: pd.DataFrame,
    variant_key: str,
    variant_cfg: dict,
) -> dict:
    """Run a single continuous backtest on pre-classified data."""
    enriched = data.copy()
    for col in clf.columns:
        enriched[col] = clf[col]
    enriched = enriched.ffill().fillna(0)

    # Drop bars before first valid classification
    first_valid = clf["regime"].first_valid_index()
    if first_valid is not None:
        enriched = enriched.loc[first_valid:]

    # Build strategy
    strat_kwargs = {
        k: v for k, v in variant_cfg.items()
        if k in ("d_allocation", "i_allocation", "r_allocation",
                 "rebalance_mode", "persistence_bars", "min_confidence")
    }
    strat = RegimeAllocator(warmup_bars=50, **strat_kwargs)
    strat.set_variant_name(f"Allocator-{variant_key}")

    # Run backtest
    engine = BacktestEngine(initial_capital=10_000)
    result = engine.run(strat, enriched)
    m = result.metrics

    # CAGR
    hours = (result.equity_curve.index[-1] - result.equity_curve.index[0]).total_seconds() / 3600
    years = hours / 8760 if hours > 0 else 1
    if years > 0 and m["final_capital"] > 0:
        cagr = (m["final_capital"] / m["initial_capital"]) ** (1 / years) - 1
    else:
        cagr = 0.0
    calmar = abs(cagr / m["max_drawdown"]) if m["max_drawdown"] < -0.001 else 0.0

    # Friction cost estimate
    friction_pct = m["n_trades"] * 0.0015  # 0.15% per trade (commission + slippage)

    # Transition analysis
    trans = analyze_transitions(strat.transition_log, len(enriched))

    # Time in market (from strategy state)
    # Approximate: count bars where confirmed regime would be invested
    regime_col = enriched.get("regime", pd.Series("I", index=enriched.index))
    d_alloc = variant_cfg["d_allocation"]
    i_alloc = variant_cfg["i_allocation"]
    invested_bars = sum(
        1 for r in regime_col
        if (r == "D" and d_alloc > 0) or (r == "I" and i_alloc > 0)
    )
    time_in_market = invested_bars / len(enriched) if len(enriched) > 0 else 0

    m.update({
        "cagr": float(cagr),
        "calmar_ratio": float(calmar),
        "years": float(years),
        "time_in_market": float(time_in_market),
        "friction_cost_pct": float(friction_pct),
    })

    return {
        "variant": variant_key,
        "metrics": m,
        "transitions": trans,
    }


# ============================================================================
# Buy-and-hold baseline
# ============================================================================

def run_baseline(data: pd.DataFrame) -> dict:
    engine = BacktestEngine(initial_capital=10_000)
    strat = BuyAndHold()
    strat.precompute(data)
    result = engine.run(strat, data)
    m = result.metrics

    hours = (result.equity_curve.index[-1] - result.equity_curve.index[0]).total_seconds() / 3600
    years = hours / 8760 if hours > 0 else 1
    if years > 0 and m["final_capital"] > 0:
        cagr = (m["final_capital"] / m["initial_capital"]) ** (1 / years) - 1
    else:
        cagr = 0.0
    calmar = abs(cagr / m["max_drawdown"]) if m["max_drawdown"] < -0.001 else 0.0

    m.update({
        "cagr": float(cagr),
        "calmar_ratio": float(calmar),
        "years": float(years),
        "time_in_market": 1.0,
        "friction_cost_pct": 0.0,
    })
    return m


# ============================================================================
# Main
# ============================================================================

def main():
    print("=" * 70)
    print("MODEL 1 v2: REGIME ALLOCATOR — DAILY + PERSISTENCE FILTER")
    print(f"  Window: {WINDOW} bars ({WINDOW // 24} days)")
    print(f"  Architecture: walk-forward classify → single continuous backtest")
    print(f"  Tokens: {list(TOKEN_FILES.keys())}")
    print(f"  Variants: {list(VARIANTS.keys())}")
    print("=" * 70, flush=True)

    # Load data + compute features
    all_data = {}
    all_vectors = {}
    all_mtf = {}

    for symbol, filepath in TOKEN_FILES.items():
        print(f"\nLoading {symbol}...", end=" ", flush=True)
        df = load_token_data(symbol, filepath)
        all_data[symbol] = df
        print(f"{len(df)} bars", end=" ", flush=True)

        vecs = compute_vectors(df, window=WINDOW)
        all_vectors[symbol] = vecs
        print(f"→ {len(vecs)} vectors", end=" ", flush=True)

        mtf = MultiTimeframeClassifier(macro_window=30, k=3)
        mtf.precompute(df)
        all_mtf[symbol] = mtf
        print("✓", flush=True)

    # Walk-forward classify
    print("\n" + "-" * 70)
    print("WALK-FORWARD CLASSIFICATION")
    print("-" * 70)
    all_clf = {}
    for symbol in TOKEN_FILES:
        print(f"  {symbol}...", end=" ", flush=True)
        clf = walk_forward_classify(
            all_data[symbol], all_vectors[symbol], all_mtf[symbol],
        )
        all_clf[symbol] = clf

        # Hourly regime distribution
        h_valid = clf["regime"].dropna()
        h_dist = Counter(str(r) for r in h_valid)
        h_total = sum(h_dist.values())

        # Daily macro regime distribution
        m_valid = clf["macro_regime"].dropna()
        m_dist = Counter(str(r) for r in m_valid)
        m_total = sum(m_dist.values())

        print(f"hourly: {_pct_dict(h_dist, h_total)}  "
              f"daily: {_pct_dict(m_dist, m_total)}", flush=True)

    # Baselines
    print("\n" + "-" * 70)
    print("BUY-AND-HOLD BASELINES")
    print("-" * 70)
    baselines = {}
    for symbol in TOKEN_FILES:
        bh = run_baseline(all_data[symbol])
        baselines[symbol] = bh
        print(f"  {symbol}: return={bh['total_return']:.1%}, "
              f"CAGR={bh['cagr']:.1%}, maxDD={bh['max_drawdown']:.1%}, "
              f"sharpe={bh['sharpe_ratio']:.2f}")

    # Run variants
    results = {}
    for vk, vcfg in VARIANTS.items():
        print(f"\n{'=' * 70}")
        print(f"VARIANT {vk}: {vcfg['desc']}")
        print(f"{'=' * 70}", flush=True)
        results[vk] = {}

        for symbol in TOKEN_FILES:
            print(f"  {symbol}...", end=" ", flush=True)
            r = run_variant(all_data[symbol], all_clf[symbol], vk, vcfg)
            m = r["metrics"]
            t = r["transitions"]
            print(f"return={m['total_return']:.1%}, CAGR={m['cagr']:.1%}, "
                  f"sharpe={m['sharpe_ratio']:.2f}, maxDD={m['max_drawdown']:.1%}, "
                  f"trades={m['n_trades']}, transitions={t['total_transitions']}, "
                  f"avg_gap={t['avg_days_between']:.1f}d")
            results[vk][symbol] = r

    # ========================================================================
    # Summary
    # ========================================================================
    print("\n" + "=" * 115)
    print("PERFORMANCE SUMMARY")
    print("=" * 115)
    header = (f"{'Variant':<20} {'Token':<6} {'Return':>10} {'CAGR':>8} "
              f"{'Sharpe':>8} {'MaxDD':>8} {'Calmar':>8} {'Trades':>7} "
              f"{'Friction':>9} {'Transitions':>12}")
    print(header)
    print("-" * 115)

    for vk in VARIANTS:
        for sym in TOKEN_FILES:
            m = results[vk][sym]["metrics"]
            t = results[vk][sym]["transitions"]
            print(f"{vk:<20} {sym:<6} {m['total_return']:>9.1%} "
                  f"{m['cagr']:>7.1%} {m['sharpe_ratio']:>7.2f} "
                  f"{m['max_drawdown']:>7.1%} {m['calmar_ratio']:>7.2f} "
                  f"{m['n_trades']:>7} {m['friction_cost_pct']:>8.1%} "
                  f"{t['total_transitions']:>12}")
        print("-" * 115)

    print("\nBUY-AND-HOLD REFERENCE:")
    for sym in TOKEN_FILES:
        bh = baselines[sym]
        print(f"  {'buy_hold':<20} {sym:<6} {bh['total_return']:>9.1%} "
              f"{bh['cagr']:>7.1%} {bh['sharpe_ratio']:>7.2f} "
              f"{bh['max_drawdown']:>7.1%} {bh['calmar_ratio']:>7.2f}")

    # ========================================================================
    # Transition frequency report
    # ========================================================================
    print("\n" + "=" * 115)
    print("TRANSITION FREQUENCY ANALYSIS")
    print("=" * 115)
    header2 = (f"{'Variant':<20} {'Token':<6} {'Transitions':>12} "
               f"{'AvgGap(d)':>10} {'LongestD(d)':>12} "
               f"{'LongestI(d)':>12} {'LongestR(d)':>12}")
    print(header2)
    print("-" * 115)

    for vk in VARIANTS:
        for sym in TOKEN_FILES:
            t = results[vk][sym]["transitions"]
            print(f"{vk:<20} {sym:<6} {t['total_transitions']:>12} "
                  f"{t['avg_days_between']:>9.1f} "
                  f"{t.get('longest_D_days', 0):>11.1f} "
                  f"{t.get('longest_I_days', 0):>11.1f} "
                  f"{t.get('longest_R_days', 0):>11.1f}")
        print("-" * 115)

    # ========================================================================
    # Verdict
    # ========================================================================
    print("\n" + "=" * 115)
    print("THE VERDICT")
    print("=" * 115)

    for sym in TOKEN_FILES:
        bh = baselines[sym]
        best_vk = None
        best_calmar = -999
        for vk in VARIANTS:
            m = results[vk][sym]["metrics"]
            c = m["calmar_ratio"] if m["total_return"] > -0.5 else -999
            if c > best_calmar:
                best_calmar = c
                best_vk = vk

        if best_vk is None:
            best_vk = list(VARIANTS.keys())[0]
        bm = results[best_vk][sym]["metrics"]
        bt = results[best_vk][sym]["transitions"]

        print(f"\n  {sym}:")
        print(f"    Buy-and-hold: {bh['total_return']:>10.1%} return, "
              f"{bh['max_drawdown']:.1%} DD, calmar={bh['calmar_ratio']:.2f}")
        print(f"    Best variant: {best_vk}")
        print(f"      Return:     {bm['total_return']:>10.1%}")
        print(f"      MaxDD:      {bm['max_drawdown']:>10.1%} (vs {bh['max_drawdown']:.1%} B&H)")
        print(f"      Calmar:     {bm['calmar_ratio']:>10.2f} (vs {bh['calmar_ratio']:.2f} B&H)")
        print(f"      Trades:     {bm['n_trades']:>10}")
        print(f"      Transitions:{bt['total_transitions']:>10} "
              f"(avg {bt['avg_days_between']:.1f} days apart)")
        print(f"      Friction:   {bm['friction_cost_pct']:>10.1%}")

    # Save
    output = {
        "run_date": datetime.now(timezone.utc).isoformat(),
        "window": WINDOW,
        "architecture": "walk-forward classify → single continuous backtest",
        "baselines": {s: baselines[s] for s in TOKEN_FILES},
        "variants": {},
    }
    for vk in VARIANTS:
        output["variants"][vk] = {
            "config": {k: v for k, v in VARIANTS[vk].items() if k != "desc"},
            "description": VARIANTS[vk]["desc"],
            "results": {
                sym: {
                    "metrics": results[vk][sym]["metrics"],
                    "transitions": results[vk][sym]["transitions"],
                }
                for sym in TOKEN_FILES
            },
        }

    output_path = DATA_DIR / "regime_allocator_v2_results.json"
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2, default=str)
    print(f"\nResults saved to {output_path}")


def _pct_dict(counter: Counter, total: int) -> str:
    return " ".join(f"{k}={v/total:.0%}" for k, v in sorted(counter.items()))


if __name__ == "__main__":
    main()
