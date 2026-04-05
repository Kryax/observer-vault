#!/usr/bin/env python3
"""
Markov+VPVR Strategy Pipeline (v5)

Walk-forward backtest: v3.1 (baseline) vs v5 (survival filter barbell entry)
on all 5 tokens with W=168.

v5 change: barbell entry — 25% probe on D-bar 1, 75% conviction on D-bar 5+.
All exit parameters are v3.1 exact.

Also computes empirical D-regime survival curves to validate the 5-bar threshold.
"""

from __future__ import annotations

import json
import sys
import warnings
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.features.indicators_fast import compute_all_features
from src.features.vectorizer import vectorize_pipeline
from src.classifier.price_landscape import PriceLandscape, _estimate_barrier
from src.backtest.engine import BacktestEngine
from src.backtest.baselines import BuyAndHold, MACrossover
from src.strategy.markov_vpvr_strategy import MarkovVPVRStrategy

DATA_DIR = PROJECT_ROOT / "data"
WINDOW = 168

TOKEN_FILES = {
    "BTC": DATA_DIR / "btc_ohlcv_1h_extended.csv",
    "ETH": DATA_DIR / "eth_ohlcv_1h.csv",
    "SOL": DATA_DIR / "sol_ohlcv_1h.csv",
    "BNB": DATA_DIR / "bnb_ohlcv_1h.csv",
    "ADA": DATA_DIR / "ada_ohlcv_1h.csv",
}


# ============================================================================
# Data
# ============================================================================

def load_token_data(filepath: Path) -> pd.DataFrame:
    df = pd.read_csv(filepath, parse_dates=["timestamp"], index_col="timestamp")
    df = df[~df.index.duplicated(keep="first")].sort_index()
    return df


def compute_vectors(df: pd.DataFrame, window: int = WINDOW) -> pd.DataFrame:
    features = compute_all_features(df, window)
    vectors = vectorize_pipeline(features)
    return vectors.dropna()


# ============================================================================
# Classification
# ============================================================================

def precompute_classification(
    landscape: PriceLandscape, vectors: pd.DataFrame,
) -> pd.DataFrame:
    results = []
    X = vectors.values
    basins = landscape.landscape.basins

    max_barrier = 0.0
    for i, b1 in enumerate(basins):
        for j, b2 in enumerate(basins):
            if i == j:
                continue
            barrier = _estimate_barrier(
                b1.centroid, b2.centroid, basins,
                landscape.landscape.adjacency, b1, b2,
            )
            base_e = min(
                landscape._compute_energy(b1.centroid)["energy"],
                landscape._compute_energy(b2.centroid)["energy"],
            )
            max_barrier = max(max_barrier, barrier - base_e)
    if max_barrier <= 0:
        max_barrier = 1.0

    d_basin = None
    for b in basins:
        if landscape.get_regime_for_label(b.label) == "D":
            d_basin = b
            break

    for i in range(len(X)):
        vec = X[i]
        er = landscape._compute_energy(vec)
        cls = landscape.classify(vec)
        nearest_label = er["nearest_basin"]
        regime = landscape.get_regime_for_label(nearest_label)

        gradient = er["gradient"]
        gradient_mag = float(np.linalg.norm(gradient))
        nearest_obj = next((b for b in basins if b.label == nearest_label), basins[0])
        to_center = nearest_obj.centroid - vec
        if np.linalg.norm(to_center) > 0 and gradient_mag > 0:
            gradient_direction = float(
                np.dot(gradient, to_center) / (np.linalg.norm(to_center) * gradient_mag)
            )
        else:
            gradient_direction = 0.0

        barrier_height = max(0, er["barrier_to_second"])
        normalised_barrier = min(1.0, barrier_height / max_barrier)

        barrier_to_d = 1.0
        if d_basin is not None and regime != "D":
            b_to_d = _estimate_barrier(
                vec, d_basin.centroid, basins,
                landscape.landscape.adjacency, nearest_obj, d_basin,
            )
            barrier_to_d = max(0, (b_to_d - er["energy"]) / max_barrier)

        results.append({
            "regime": regime,
            "label": nearest_label,
            "confidence": cls["confidence"],
            "energy": er["energy"],
            "transition_score": er["transition_score"],
            "basin_depth": er["basin_depth"],
            "barrier_height": barrier_height,
            "normalised_barrier": normalised_barrier,
            "gradient_mag": gradient_mag,
            "gradient_direction": gradient_direction,
            "barrier_to_d": barrier_to_d,
        })

    return pd.DataFrame(results, index=vectors.index)


# ============================================================================
# Transition matrix
# ============================================================================

REGIMES = ["D", "I", "R"]

def compute_transition_matrix(labels: list[str]) -> dict:
    from collections import defaultdict
    counts = defaultdict(lambda: defaultdict(int))
    for i in range(len(labels) - 1):
        fr, to = labels[i], labels[i + 1]
        if fr in REGIMES and to in REGIMES:
            counts[fr][to] += 1
    matrix = {}
    for fr in REGIMES:
        total = sum(counts[fr][to] for to in REGIMES)
        matrix[fr] = {to: counts[fr][to] / total if total > 0 else 0.0 for to in REGIMES}
    return matrix


# ============================================================================
# D-regime survival curves
# ============================================================================

def compute_survival_curves(all_labels: dict[str, list[str]], max_bars: int = 50) -> dict:
    """Compute empirical survival curves for D-regimes per token.

    Returns dict with per-token survival_curve, hazard_rate, and summary stats.
    """
    results = {}
    for sym, labels in all_labels.items():
        d_durations = []
        current_run = 0
        for lbl in labels:
            if lbl == "D":
                current_run += 1
            else:
                if current_run > 0:
                    d_durations.append(current_run)
                current_run = 0
        if current_run > 0:
            d_durations.append(current_run)

        total = len(d_durations)
        if total == 0:
            results[sym] = {
                "total_d_regimes": 0,
                "survival_curve": {},
                "hazard_rate": {},
            }
            continue

        survival = {}
        for n in range(1, max_bars + 1):
            survival[n] = sum(1 for d in d_durations if d >= n) / total

        hazard = {}
        for n in range(1, max_bars):
            if survival[n] > 0:
                hazard[n] = 1.0 - survival[n + 1] / survival[n]
            else:
                hazard[n] = 0.0

        results[sym] = {
            "total_d_regimes": total,
            "d_durations": d_durations,
            "mean_duration": float(np.mean(d_durations)),
            "median_duration": float(np.median(d_durations)),
            "survival_curve": {str(k): round(v, 4) for k, v in survival.items()},
            "hazard_rate": {str(k): round(v, 4) for k, v in hazard.items()},
            "pct_dead_by_5": round(1.0 - survival.get(5, 0), 4),
            "pct_dead_by_10": round(1.0 - survival.get(10, 0), 4),
        }

    return results


# ============================================================================
# Walk-forward engine
# ============================================================================

def walk_forward(
    data: pd.DataFrame, vectors: pd.DataFrame,
    strategy_factory,
    train_bars: int = 2000, step_bars: int = 500,
    warmup_bars: int = 100,
) -> dict:
    engine = BacktestEngine(initial_capital=10_000)
    all_trades = []
    equity_pieces = []
    all_trade_logs = []
    all_labels = []

    n = len(data)
    if n < train_bars + step_bars:
        train_bars = int(n * 0.6)
        step_bars = n - train_bars

    start = 0
    fold = 0
    while start + train_bars + step_bars <= n:
        train_end = start + train_bars
        test_end = min(train_end + step_bars, n)
        train_data = data.iloc[start:train_end]
        test_data = data.iloc[train_end:test_end]
        train_vecs = vectors.loc[vectors.index.isin(train_data.index)]
        test_vecs = vectors.loc[vectors.index.isin(test_data.index)]

        if len(train_vecs) < 200 or len(test_vecs) < 50:
            start += step_bars
            fold += 1
            continue

        ls = PriceLandscape()
        ls.fit(train_vecs.values, k=3)
        clf_df = precompute_classification(ls, test_vecs)
        all_labels.extend(clf_df["regime"].tolist())

        test_enriched = test_data.copy()
        for col in clf_df.columns:
            test_enriched[col] = clf_df[col].reindex(test_enriched.index)
        test_enriched = test_enriched.ffill().fillna(0)

        tm = compute_transition_matrix(all_labels) if all_labels else None
        strat = strategy_factory(tm)
        result = engine.run(strat, test_enriched)
        all_trades.extend(result.trades)
        all_trade_logs.extend(result.trade_log)
        equity_pieces.append(result.equity_curve)

        fold += 1
        start += step_bars

    if not equity_pieces:
        return {
            "trades": [], "trade_log": [], "labels": all_labels,
            "metrics": {"total_return": 0, "sharpe_ratio": 0, "max_drawdown": 0,
                        "n_trades": 0, "win_rate": 0, "profit_factor": 0,
                        "initial_capital": 10000, "final_capital": 10000,
                        "avg_pnl": 0, "avg_win": 0, "avg_loss": 0},
            "transition_matrix": {},
        }

    combined = pd.concat(equity_pieces)
    combined = combined[~combined.index.duplicated(keep="first")]
    metrics = engine._compute_metrics(combined, all_trades)
    tm = compute_transition_matrix(all_labels) if all_labels else {}

    return {
        "trades": all_trades,
        "trade_log": all_trade_logs,
        "labels": all_labels,
        "metrics": metrics,
        "transition_matrix": tm,
        "n_folds": fold,
    }


# ============================================================================
# Simple strategy runner
# ============================================================================

def run_simple(data: pd.DataFrame, strategy) -> dict:
    engine = BacktestEngine(initial_capital=10_000)
    if hasattr(strategy, 'precompute'):
        strategy.precompute(data)
    result = engine.run(strategy, data)
    return {"trades": result.trades, "metrics": result.metrics}


# ============================================================================
# Metrics helpers
# ============================================================================

def avg_hold(trades) -> float:
    durs = []
    for t in trades:
        if t.entry_time and t.exit_time:
            durs.append((t.exit_time - t.entry_time).total_seconds() / 3600.0)
    return float(np.mean(durs)) if durs else 0.0


def win_loss(trades) -> tuple[float, float, float]:
    wins = [t.pnl for t in trades if t.pnl > 0]
    losses = [t.pnl for t in trades if t.pnl <= 0]
    aw = float(np.mean(wins)) if wins else 0.0
    al = float(np.mean(losses)) if losses else 0.0
    ratio = aw / abs(al) if al != 0 else float("inf")
    return aw, al, ratio


def ev_per_trade(trades) -> float:
    if not trades:
        return 0.0
    return float(np.mean([t.pnl for t in trades]))


def barbell_stats(trade_log: list[dict]) -> dict:
    """Compute v5 barbell-specific metrics."""
    p1_fills = [t for t in trade_log if t.get("event") == "fill_p1"]
    p2_fills = [t for t in trade_log if t.get("event") == "fill_p2"]
    exits = [t for t in trade_log if t.get("event") == "exit"]
    probe_aborts = [t for t in exits if t.get("reason") == "probe_abort"]

    n_p1 = len(p1_fills)
    n_p2 = len(p2_fills)
    n_aborts = len(probe_aborts)

    # Hold times for probe-only vs full-position trades
    probe_only_holds = []
    full_holds = []
    for ex in exits:
        phase = ex.get("phase_filled", 0)
        bars = ex.get("bars_held", 0)
        if phase == 1:
            probe_only_holds.append(bars)
        elif phase == 2:
            full_holds.append(bars)

    return {
        "phase1_fills": n_p1,
        "phase2_fills": n_p2,
        "probe_aborts": n_aborts,
        "phase1_abort_rate": n_aborts / n_p1 if n_p1 > 0 else 0.0,
        "phase2_fill_rate": n_p2 / n_p1 if n_p1 > 0 else 0.0,
        "avg_hold_probe_only": float(np.mean(probe_only_holds)) if probe_only_holds else 0.0,
        "avg_hold_full_position": float(np.mean(full_holds)) if full_holds else 0.0,
    }


def exit_dist(trade_log: list[dict]) -> dict:
    exits = [t for t in trade_log if t.get("event") == "exit"]
    reasons = Counter(t.get("reason", "unknown") for t in exits)
    return dict(reasons)


# ============================================================================
# Main
# ============================================================================

def main():
    print("=" * 120)
    print("MARKOV+VPVR STRATEGY PIPELINE — v3.1 vs v5 (Survival Filter Barbell)")
    print(f"  Window: {WINDOW} bars ({WINDOW // 24} days)")
    print(f"  Tokens: {list(TOKEN_FILES.keys())}")
    print(f"  Walk-forward: train=2000, step=500")
    print(f"  v5 change: 25% probe on D-bar 1, 75% conviction on D-bar 5+")
    print(f"  All exits: v3.1 exact (2% stop, R-exit, destab 0.02/4-bar, time-decay K=1.0)")
    print("=" * 120, flush=True)

    # Load data
    all_data = {}
    all_vectors = {}
    for sym, fp in TOKEN_FILES.items():
        print(f"Loading {sym}...", end=" ", flush=True)
        df = load_token_data(fp)
        all_data[sym] = df
        vecs = compute_vectors(df, window=WINDOW)
        all_vectors[sym] = vecs
        print(f"{len(df)} bars, {len(vecs)} vectors")

    # Load pre-computed transition matrices
    tm_path = DATA_DIR / "transition_analysis_k3.json"
    precomputed_tm = {}
    if tm_path.exists():
        with open(tm_path) as f:
            raw_tm = json.load(f)
        for sym in TOKEN_FILES:
            if sym in raw_tm:
                precomputed_tm[sym] = raw_tm[sym].get("transition_matrix", {})

    results = {}
    all_regime_labels = {}  # For survival curves

    for sym in TOKEN_FILES:
        print(f"\n{'=' * 80}")
        print(f"  {sym}")
        print(f"{'=' * 80}", flush=True)

        data = all_data[sym]
        vecs = all_vectors[sym]
        pre_tm = precomputed_tm.get(sym, None)

        # --- v3.1 Baseline ---
        print("  v3.1 (baseline)...", flush=True)
        v31_result = walk_forward(
            data, vecs,
            strategy_factory=lambda tm: MarkovVPVRStrategy(
                transition_matrix=tm or pre_tm,
                # v3.1: no barbell, full position on entry
                probe_frac=1.0,
                conviction_frac=0.0,
                survival_bars=999,  # effectively disabled
            ),
        )
        v31_m = v31_result["metrics"]
        v31_h = avg_hold(v31_result["trades"])
        v31_aw, v31_al, v31_ratio = win_loss(v31_result["trades"])
        v31_ev = ev_per_trade(v31_result["trades"])

        print(f"    ret={v31_m['total_return']:.2%}, sharpe={v31_m['sharpe_ratio']:.2f}, "
              f"trades={v31_m['n_trades']}, win={v31_m['win_rate']:.1%}, "
              f"dd={v31_m['max_drawdown']:.1%}")
        print(f"    W/L={v31_ratio:.2f}x, EV/trade=${v31_ev:.2f}")

        # --- v5 Barbell ---
        print("  v5 (barbell)...", flush=True)
        v5_result = walk_forward(
            data, vecs,
            strategy_factory=lambda tm: MarkovVPVRStrategy(
                transition_matrix=tm or pre_tm,
            ),
        )
        v5_m = v5_result["metrics"]
        v5_h = avg_hold(v5_result["trades"])
        v5_aw, v5_al, v5_ratio = win_loss(v5_result["trades"])
        v5_ev = ev_per_trade(v5_result["trades"])
        v5_bb = barbell_stats(v5_result["trade_log"])
        v5_exits = exit_dist(v5_result["trade_log"])

        print(f"    ret={v5_m['total_return']:.2%}, sharpe={v5_m['sharpe_ratio']:.2f}, "
              f"trades={v5_m['n_trades']}, win={v5_m['win_rate']:.1%}, "
              f"dd={v5_m['max_drawdown']:.1%}")
        print(f"    W/L={v5_ratio:.2f}x, EV/trade=${v5_ev:.2f}")
        print(f"    barbell: {v5_bb}")
        print(f"    exits: {v5_exits}")

        # Collect regime labels for survival curves
        all_regime_labels[sym] = v5_result.get("labels", [])

        # --- Buy & Hold ---
        print("  Buy&Hold...", flush=True)
        bh = run_simple(data, BuyAndHold())
        bh_m = bh["metrics"]

        results[sym] = {
            "v3.1": {
                "metrics": v31_m, "avg_hold": v31_h,
                "avg_win": v31_aw, "avg_loss": v31_al, "wl_ratio": v31_ratio,
                "ev_per_trade": v31_ev,
                "exit_dist": exit_dist(v31_result["trade_log"]),
            },
            "v5": {
                "metrics": v5_m, "avg_hold": v5_h,
                "avg_win": v5_aw, "avg_loss": v5_al, "wl_ratio": v5_ratio,
                "ev_per_trade": v5_ev,
                "barbell": v5_bb, "exit_dist": v5_exits,
            },
            "buy_hold": {"metrics": bh_m},
        }

    # ============================================================================
    # Survival curves
    # ============================================================================

    print("\n" + "=" * 120)
    print("D-REGIME SURVIVAL CURVES")
    print("=" * 120)

    survival_data = compute_survival_curves(all_regime_labels)

    for sym, sc in survival_data.items():
        if sc["total_d_regimes"] == 0:
            print(f"  {sym}: no D-regimes")
            continue
        print(f"\n  {sym}: {sc['total_d_regimes']} D-regimes, "
              f"mean={sc['mean_duration']:.1f} bars, median={sc['median_duration']:.0f} bars")
        print(f"    Dead by bar 5: {sc['pct_dead_by_5']:.1%}, Dead by bar 10: {sc['pct_dead_by_10']:.1%}")

        # Show survival at key thresholds
        surv = sc["survival_curve"]
        haz = sc["hazard_rate"]
        print(f"    Survival: ", end="")
        for n in [1, 2, 3, 4, 5, 7, 10, 15, 20]:
            s = surv.get(str(n), 0)
            print(f"bar{n}={s:.0%} ", end="")
        print()

        # Find hazard inflection (peak hazard)
        if haz:
            peak_bar = max(haz.keys(), key=lambda k: haz[k])
            print(f"    Peak hazard at bar {peak_bar}: {haz[peak_bar]:.1%}")

    # Save survival curves
    surv_path = DATA_DIR / "survival_curves.json"
    with open(surv_path, "w") as f:
        # Remove raw durations list for cleaner JSON
        clean = {}
        for sym, sc in survival_data.items():
            clean[sym] = {k: v for k, v in sc.items() if k != "d_durations"}
        json.dump(clean, f, indent=2)
    print(f"\nSurvival curves saved to {surv_path}")

    # ============================================================================
    # Summary — v3.1 vs v5 side-by-side
    # ============================================================================

    print("\n" + "=" * 130)
    print("v3.1 vs v5 COMPARISON")
    print("=" * 130)
    print(f"{'Token':<6} {'Version':<8} {'Return':>9} {'Sharpe':>8} {'MaxDD':>8} "
          f"{'Trades':>7} {'WinRate':>8} {'W/L':>6} {'EV/trade':>10} {'AvgHold':>8}")
    print("-" * 130)

    for sym in TOKEN_FILES:
        r = results[sym]
        for ver_key, ver_label in [("v3.1", "v3.1"), ("v5", "v5"), ("buy_hold", "B&H")]:
            s = r[ver_key]
            m = s["metrics"]
            h = s.get("avg_hold", 0)
            ratio = s.get("wl_ratio", 0)
            ev = s.get("ev_per_trade", 0)
            print(f"{sym:<6} {ver_label:<8} {m['total_return']:>8.1%} {m['sharpe_ratio']:>7.2f} "
                  f"{m['max_drawdown']:>7.1%} {m['n_trades']:>7} {m['win_rate']:>7.1%} "
                  f"{ratio:>5.2f}x ${ev:>8.2f} {h:>7.0f}h")
        print("-" * 130)

    # v5 barbell stats
    print("\nv5 BARBELL METRICS:")
    print(f"{'Token':<6} {'P1 Fills':>9} {'P2 Fills':>9} {'Aborts':>8} "
          f"{'Abort%':>8} {'P2 Fill%':>9} {'Hold(P1)':>9} {'Hold(Full)':>11}")
    print("-" * 80)
    for sym in TOKEN_FILES:
        bb = results[sym]["v5"]["barbell"]
        print(f"{sym:<6} {bb['phase1_fills']:>9} {bb['phase2_fills']:>9} "
              f"{bb['probe_aborts']:>8} {bb['phase1_abort_rate']:>7.1%} "
              f"{bb['phase2_fill_rate']:>8.1%} {bb['avg_hold_probe_only']:>8.0f}h "
              f"{bb['avg_hold_full_position']:>10.0f}h")

    # Exit distribution
    print("\nv5 EXIT DISTRIBUTION:")
    for sym in TOKEN_FILES:
        ed = results[sym]["v5"]["exit_dist"]
        print(f"  {sym}: {ed}")

    # Targets check
    print("\nTARGETS CHECK:")
    for sym in TOKEN_FILES:
        v5 = results[sym]["v5"]
        wr = v5["metrics"]["win_rate"]
        ratio = v5["wl_ratio"]
        wr_ok = "OK" if wr > 0.45 else "MISS"
        ratio_ok = "OK" if ratio > 1.5 else "MISS"
        print(f"  {sym}: win_rate={wr:.1%} [{wr_ok}], W/L={ratio:.2f}x [{ratio_ok}]")

    # Save results
    output = DATA_DIR / "markov_vpvr_v5_results.json"
    with open(output, "w") as f:
        json.dump(results, f, indent=2, default=str)
    print(f"\nResults saved to {output}")


if __name__ == "__main__":
    main()
