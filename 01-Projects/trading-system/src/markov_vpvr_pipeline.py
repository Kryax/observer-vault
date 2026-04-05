#!/usr/bin/env python3
"""
Markov+VPVR Strategy Pipeline (v3)

Walk-forward backtest on all 5 tokens with W=168.
Compares: MarkovVPVR vs LangevinNative vs LandscapeStrategy vs Buy&Hold vs MA-Cross

Key metrics: win/loss size ratio (target >1.3x), exit distribution,
scale-in completion rate.
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
from src.strategy.landscape_strategy import LandscapeStrategy
from src.strategy.langevin_native import LangevinNativeStrategy
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
# Classification (minimal — only what MarkovVPVR needs)
# ============================================================================

def precompute_classification(
    landscape: PriceLandscape, vectors: pd.DataFrame,
) -> pd.DataFrame:
    """Compute regime, energy, confidence for each bar."""
    results = []
    X = vectors.values
    basins = landscape.landscape.basins

    # Max barrier for normalisation (used by LandscapeStrategy)
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
# Transition matrix from labels
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
# Walk-forward engine
# ============================================================================

def walk_forward(
    data: pd.DataFrame, vectors: pd.DataFrame,
    strategy_factory,  # callable(transition_matrix) -> Strategy
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

        # Build transition matrix from labels so far
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
            "trades": [], "trade_log": [],
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
        "metrics": metrics,
        "transition_matrix": tm,
        "n_folds": fold,
    }


# ============================================================================
# Simple strategy runner (no walk-forward classification needed)
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


def scale_in_stats(trade_log: list[dict]) -> dict:
    """Compute scale-in completion rate from trade log."""
    fills = [t for t in trade_log if t.get("event", "").startswith("fill_t")]
    t1 = sum(1 for t in fills if t["event"] == "fill_t1")
    t2 = sum(1 for t in fills if t["event"] == "fill_t2")
    t3 = sum(1 for t in fills if t["event"] == "fill_t3")
    return {
        "t1_fills": t1, "t2_fills": t2, "t3_fills": t3,
        "completion_rate": t3 / t1 if t1 > 0 else 0.0,
    }


def exit_dist(trade_log: list[dict]) -> dict:
    exits = [t for t in trade_log if t.get("event") == "exit"]
    reasons = Counter(t.get("reason", "unknown") for t in exits)
    return dict(reasons)


# ============================================================================
# Main
# ============================================================================

def main():
    print("=" * 110)
    print("MARKOV+VPVR STRATEGY PIPELINE (v3)")
    print(f"  Window: {WINDOW} bars ({WINDOW // 24} days)")
    print(f"  Tokens: {list(TOKEN_FILES.keys())}")
    print(f"  Walk-forward: train=2000, step=500")
    print(f"  Key change: 2% spatial stops, VPVR limit entries, scale-in, dynamic MFPT")
    print("=" * 110, flush=True)

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

    for sym in TOKEN_FILES:
        print(f"\n{'=' * 70}")
        print(f"  {sym}")
        print(f"{'=' * 70}", flush=True)

        data = all_data[sym]
        vecs = all_vectors[sym]
        pre_tm = precomputed_tm.get(sym, None)

        # --- MarkovVPVR ---
        print("  MarkovVPVR...", flush=True)
        mv_result = walk_forward(
            data, vecs,
            strategy_factory=lambda tm: MarkovVPVRStrategy(
                transition_matrix=tm or pre_tm,
            ),
        )
        mv_m = mv_result["metrics"]
        mv_h = avg_hold(mv_result["trades"])
        mv_aw, mv_al, mv_ratio = win_loss(mv_result["trades"])
        mv_scale = scale_in_stats(mv_result["trade_log"])
        mv_exits = exit_dist(mv_result["trade_log"])

        print(f"    ret={mv_m['total_return']:.2%}, sharpe={mv_m['sharpe_ratio']:.2f}, "
              f"trades={mv_m['n_trades']}, win={mv_m['win_rate']:.1%}, "
              f"dd={mv_m['max_drawdown']:.1%}, hold={mv_h:.0f}h")
        print(f"    avg_win=${mv_aw:.2f}, avg_loss=${mv_al:.2f}, ratio={mv_ratio:.2f}x")
        print(f"    scale-in: {mv_scale}")
        print(f"    exits: {mv_exits}")

        # --- LangevinNative ---
        print("  LangevinNative...", flush=True)
        ln_result = walk_forward(
            data, vecs,
            strategy_factory=lambda tm: LangevinNativeStrategy(
                transition_matrix=tm or pre_tm,
            ),
        )
        ln_m = ln_result["metrics"]
        ln_h = avg_hold(ln_result["trades"])
        ln_aw, ln_al, ln_ratio = win_loss(ln_result["trades"])

        print(f"    ret={ln_m['total_return']:.2%}, sharpe={ln_m['sharpe_ratio']:.2f}, "
              f"trades={ln_m['n_trades']}, win={ln_m['win_rate']:.1%}, "
              f"dd={ln_m['max_drawdown']:.1%}, hold={ln_h:.0f}h")
        print(f"    avg_win=${ln_aw:.2f}, avg_loss=${ln_al:.2f}, ratio={ln_ratio:.2f}x")

        # --- LandscapeStrategy ---
        print("  LandscapeStrategy...", flush=True)
        ls_result = walk_forward(
            data, vecs,
            strategy_factory=lambda tm: LandscapeStrategy(
                min_hold_bars=12, gate1_persistence=6,
            ),
        )
        ls_m = ls_result["metrics"]
        ls_h = avg_hold(ls_result["trades"])
        ls_aw, ls_al, ls_ratio = win_loss(ls_result["trades"])

        print(f"    ret={ls_m['total_return']:.2%}, sharpe={ls_m['sharpe_ratio']:.2f}, "
              f"trades={ls_m['n_trades']}, win={ls_m['win_rate']:.1%}, "
              f"dd={ls_m['max_drawdown']:.1%}, hold={ls_h:.0f}h")
        print(f"    avg_win=${ls_aw:.2f}, avg_loss=${ls_al:.2f}, ratio={ls_ratio:.2f}x")

        # --- Baselines ---
        print("  Baselines...", flush=True)
        bh = run_simple(data, BuyAndHold())
        ma = run_simple(data, MACrossover())
        bh_m = bh["metrics"]
        ma_m = ma["metrics"]
        ma_h = avg_hold(ma["trades"])
        ma_aw, ma_al, ma_ratio = win_loss(ma["trades"])

        print(f"    Buy&Hold: ret={bh_m['total_return']:.2%}, sharpe={bh_m['sharpe_ratio']:.2f}, "
              f"dd={bh_m['max_drawdown']:.1%}")
        print(f"    MA-Cross: ret={ma_m['total_return']:.2%}, trades={ma_m['n_trades']}, "
              f"win={ma_m['win_rate']:.1%}, ratio={ma_ratio:.2f}x")

        results[sym] = {
            "markov_vpvr": {
                "metrics": mv_m, "avg_hold": mv_h,
                "avg_win": mv_aw, "avg_loss": mv_al, "wl_ratio": mv_ratio,
                "scale_in": mv_scale, "exit_dist": mv_exits,
            },
            "langevin_native": {
                "metrics": ln_m, "avg_hold": ln_h,
                "avg_win": ln_aw, "avg_loss": ln_al, "wl_ratio": ln_ratio,
            },
            "landscape_vpvr": {
                "metrics": ls_m, "avg_hold": ls_h,
                "avg_win": ls_aw, "avg_loss": ls_al, "wl_ratio": ls_ratio,
            },
            "buy_hold": {"metrics": bh_m},
            "ma_crossover": {
                "metrics": ma_m, "avg_hold": ma_h,
                "avg_win": ma_aw, "avg_loss": ma_al, "wl_ratio": ma_ratio,
            },
        }

    # ============================================================================
    # Summary
    # ============================================================================

    print("\n" + "=" * 120)
    print("STRATEGY COMPARISON — v3")
    print("=" * 120)
    print(f"{'Token':<6} {'Strategy':<18} {'Return':>9} {'Sharpe':>8} {'MaxDD':>8} "
          f"{'Trades':>7} {'WinRate':>8} {'AvgHold':>8} {'AvgWin':>9} {'AvgLoss':>9} {'W/L':>6}")
    print("-" * 120)

    for sym in TOKEN_FILES:
        r = results[sym]
        for key, label in [
            ("markov_vpvr", "MarkovVPVR"),
            ("langevin_native", "Langevin"),
            ("landscape_vpvr", "Landscape"),
            ("buy_hold", "Buy&Hold"),
            ("ma_crossover", "MA-Cross"),
        ]:
            s = r[key]
            m = s["metrics"]
            h = s.get("avg_hold", 0)
            aw = s.get("avg_win", 0)
            al = s.get("avg_loss", 0)
            ratio = s.get("wl_ratio", 0)
            print(f"{sym:<6} {label:<18} {m['total_return']:>8.1%} {m['sharpe_ratio']:>7.2f} "
                  f"{m['max_drawdown']:>7.1%} {m['n_trades']:>7} {m['win_rate']:>7.1%} "
                  f"{h:>7.0f}h ${aw:>8.2f} ${al:>8.2f} {ratio:>5.2f}x")
        print("-" * 120)

    # Win/loss ratio comparison
    print("\nWIN/LOSS SIZE RATIO (target >1.3x):")
    for sym in TOKEN_FILES:
        r = results[sym]
        for key, label in [("markov_vpvr", "MarkovVPVR"), ("langevin_native", "Langevin"),
                           ("landscape_vpvr", "Landscape")]:
            ratio = r[key].get("wl_ratio", 0)
            marker = " ✓" if ratio > 1.3 else ""
            print(f"  {sym} {label}: {ratio:.2f}x{marker}")

    # Exit distribution for MarkovVPVR
    print("\nMARKOV-VPVR EXIT DISTRIBUTION:")
    for sym in TOKEN_FILES:
        ed = results[sym]["markov_vpvr"].get("exit_dist", {})
        print(f"  {sym}: {ed}")

    # Scale-in stats
    print("\nSCALE-IN COMPLETION:")
    for sym in TOKEN_FILES:
        si = results[sym]["markov_vpvr"].get("scale_in", {})
        print(f"  {sym}: T1={si.get('t1_fills',0)}, T2={si.get('t2_fills',0)}, "
              f"T3={si.get('t3_fills',0)}, completion={si.get('completion_rate',0):.1%}")

    # Save
    output = DATA_DIR / "markov_vpvr_v4_results.json"
    with open(output, "w") as f:
        json.dump(results, f, indent=2, default=str)
    print(f"\nResults saved to {output}")


if __name__ == "__main__":
    main()
