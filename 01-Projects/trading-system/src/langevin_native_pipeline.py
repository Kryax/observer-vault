#!/usr/bin/env python3
"""
Langevin-Native Strategy Pipeline

Walk-forward backtest on all 5 tokens with W=168.
Compares:
  - LangevinNative (energy-native continuous allocation)
  - LandscapeStrategy (current VPVR-based)
  - Buy-and-Hold
  - MA-Crossover

Key metric: avg win size vs avg loss size.
The Langevin strategy should have larger wins (holding through D->I->D)
and smaller losses (MFPT time-decay cutting losers early).
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
from src.backtest.engine import BacktestEngine, Signal
from src.backtest.baselines import BuyAndHold, MACrossover
from src.strategy.landscape_strategy import LandscapeStrategy
from src.strategy.langevin_native import LangevinNativeStrategy

DATA_DIR = PROJECT_ROOT / "data"
WINDOW = 168

TOKEN_FILES = {
    "BTC": DATA_DIR / "btc_ohlcv_1h_extended.csv",
    "ETH": DATA_DIR / "eth_ohlcv_1h.csv",
    "SOL": DATA_DIR / "sol_ohlcv_1h.csv",
    "BNB": DATA_DIR / "bnb_ohlcv_1h.csv",
    "ADA": DATA_DIR / "ada_ohlcv_1h.csv",
}

REGIMES = ["D", "I", "R"]


# ============================================================================
# Data loading
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
# Extended classification (adds barrier_to_r for Langevin strategy)
# ============================================================================

def precompute_langevin_classification(
    landscape: PriceLandscape, vectors: pd.DataFrame,
) -> pd.DataFrame:
    """
    Pre-compute all fields needed by both strategies, plus barrier_to_r.
    """
    results = []
    X = vectors.values
    basins = landscape.landscape.basins

    # Find max barrier for normalisation
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

    # Find D-basin and R-basin centroids
    d_basin = r_basin = None
    for b in basins:
        regime = landscape.get_regime_for_label(b.label)
        if regime == "D":
            d_basin = b
        elif regime == "R":
            r_basin = b

    for i in range(len(X)):
        vec = X[i]
        er = landscape._compute_energy(vec)
        cls = landscape.classify(vec)

        gradient = er["gradient"]
        gradient_mag = float(np.linalg.norm(gradient))

        nearest_label = er["nearest_basin"]
        nearest_basin_obj = next((b for b in basins if b.label == nearest_label), basins[0])
        to_center = nearest_basin_obj.centroid - vec
        if np.linalg.norm(to_center) > 0 and gradient_mag > 0:
            gradient_direction = float(
                np.dot(gradient, to_center) / (np.linalg.norm(to_center) * gradient_mag)
            )
        else:
            gradient_direction = 0.0

        barrier_height = max(0, er["barrier_to_second"])
        normalised_barrier = min(1.0, barrier_height / max_barrier)

        regime = landscape.get_regime_for_label(nearest_label)

        # Barrier to D
        barrier_to_d = 1.0
        if d_basin is not None and regime != "D":
            b_to_d = _estimate_barrier(
                vec, d_basin.centroid, basins,
                landscape.landscape.adjacency, nearest_basin_obj, d_basin,
            )
            barrier_to_d = max(0, (b_to_d - er["energy"]) / max_barrier)

        # Barrier to R
        barrier_to_r = 1.0
        if r_basin is not None and regime != "R":
            b_to_r = _estimate_barrier(
                vec, r_basin.centroid, basins,
                landscape.landscape.adjacency, nearest_basin_obj, r_basin,
            )
            barrier_to_r = max(0, (b_to_r - er["energy"]) / max_barrier)

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
            "barrier_to_r": barrier_to_r,
        })

    return pd.DataFrame(results, index=vectors.index)


# ============================================================================
# Compute transition matrix from walk-forward labels
# ============================================================================

def compute_transition_matrix_from_labels(labels: pd.Series) -> dict:
    """Build 3x3 transition probability matrix."""
    from collections import defaultdict
    counts = defaultdict(lambda: defaultdict(int))
    for i in range(len(labels) - 1):
        fr = labels.iloc[i]
        to = labels.iloc[i + 1]
        if fr in REGIMES and to in REGIMES:
            counts[fr][to] += 1

    matrix = {}
    for fr in REGIMES:
        total = sum(counts[fr][to] for to in REGIMES)
        matrix[fr] = {
            to: counts[fr][to] / total if total > 0 else 0.0
            for to in REGIMES
        }
    return matrix


# ============================================================================
# Walk-forward backtest
# ============================================================================

def walk_forward(
    data: pd.DataFrame, vectors: pd.DataFrame,
    strategy_cls, strategy_kwargs: dict,
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

        # Fit landscape
        ls = PriceLandscape()
        ls.fit(train_vecs.values, k=3)

        # Pre-compute classifications
        clf_df = precompute_langevin_classification(ls, test_vecs)

        # Collect regime labels for transition matrix
        all_labels.extend(clf_df["regime"].tolist())

        # Merge into test data
        test_enriched = test_data.copy()
        for col in clf_df.columns:
            test_enriched[col] = clf_df[col].reindex(test_enriched.index)
        test_enriched = test_enriched.ffill().fillna(0)

        # Build and run strategy
        strat = strategy_cls(warmup_bars=warmup_bars, **strategy_kwargs)
        result = engine.run(strat, test_enriched)
        all_trades.extend(result.trades)
        all_trade_logs.extend(result.trade_log)
        equity_pieces.append(result.equity_curve)

        fold += 1
        start += step_bars

    if not equity_pieces:
        return {
            "strategy_name": strategy_cls.__name__,
            "trades": [],
            "metrics": {
                "total_return": 0, "sharpe_ratio": 0, "max_drawdown": 0,
                "n_trades": 0, "win_rate": 0, "profit_factor": 0,
                "initial_capital": 10000, "final_capital": 10000,
                "avg_pnl": 0, "avg_win": 0, "avg_loss": 0,
            },
            "equity_curve": pd.Series(dtype=float),
            "trade_log": [],
            "transition_matrix": {},
        }

    combined = pd.concat(equity_pieces)
    combined = combined[~combined.index.duplicated(keep="first")]
    metrics = engine._compute_metrics(combined, all_trades)

    # Build transition matrix from all classified labels
    tm = {}
    if all_labels:
        label_series = pd.Series(all_labels)
        tm = compute_transition_matrix_from_labels(label_series)

    return {
        "strategy_name": strategy_cls.__name__ if hasattr(strategy_cls, '__name__') else str(strategy_cls),
        "trades": all_trades,
        "metrics": metrics,
        "equity_curve": combined,
        "trade_log": all_trade_logs,
        "n_folds": fold,
        "transition_matrix": tm,
    }


# ============================================================================
# Helpers
# ============================================================================

def compute_avg_hold(trades: list) -> float:
    durations = []
    for t in trades:
        if t.entry_time is not None and t.exit_time is not None:
            delta = (t.exit_time - t.entry_time).total_seconds() / 3600.0
            durations.append(delta)
    return float(np.mean(durations)) if durations else 0.0


def compute_avg_win_loss(trades: list) -> tuple[float, float]:
    wins = [t.pnl for t in trades if t.pnl > 0]
    losses = [t.pnl for t in trades if t.pnl <= 0]
    avg_win = float(np.mean(wins)) if wins else 0.0
    avg_loss = float(np.mean(losses)) if losses else 0.0
    return avg_win, avg_loss


def run_simple_strategy(data: pd.DataFrame, strategy) -> dict:
    engine = BacktestEngine(initial_capital=10_000)
    if hasattr(strategy, 'precompute'):
        strategy.precompute(data)
    result = engine.run(strategy, data)
    return {
        "strategy_name": result.strategy_name,
        "metrics": result.metrics,
        "trades": result.trades,
    }


# ============================================================================
# Main
# ============================================================================

def main():
    print("=" * 80)
    print("LANGEVIN-NATIVE STRATEGY PIPELINE")
    print(f"  Window: {WINDOW} bars ({WINDOW // 24} days)")
    print(f"  Tokens: {list(TOKEN_FILES.keys())}")
    print(f"  Walk-forward: train=2000, step=500")
    print("=" * 80, flush=True)

    # Load data
    all_data = {}
    all_vectors = {}
    for symbol, filepath in TOKEN_FILES.items():
        print(f"Loading {symbol}...", end=" ", flush=True)
        df = load_token_data(filepath)
        all_data[symbol] = df
        vecs = compute_vectors(df, window=WINDOW)
        all_vectors[symbol] = vecs
        print(f"{len(df)} bars, {len(vecs)} vectors")

    results = {}

    for symbol in TOKEN_FILES:
        print(f"\n{'=' * 60}")
        print(f"  {symbol}")
        print(f"{'=' * 60}", flush=True)

        data = all_data[symbol]
        vecs = all_vectors[symbol]

        # --- Phase 1: Run LandscapeStrategy to get transition matrix ---
        print("  Running LandscapeStrategy (baseline)...", flush=True)
        ls_result = walk_forward(
            data, vecs,
            strategy_cls=LandscapeStrategy,
            strategy_kwargs={
                "min_hold_bars": 12,
                "gate1_persistence": 6,
            },
        )
        ls_m = ls_result["metrics"]
        ls_hold = compute_avg_hold(ls_result["trades"])
        ls_win, ls_loss = compute_avg_win_loss(ls_result["trades"])

        print(f"    Landscape: ret={ls_m['total_return']:.2%}, sharpe={ls_m['sharpe_ratio']:.2f}, "
              f"trades={ls_m['n_trades']}, win={ls_m['win_rate']:.1%}, "
              f"dd={ls_m['max_drawdown']:.1%}, hold={ls_hold:.0f}h")
        print(f"    Avg win=${ls_win:.2f}, avg loss=${ls_loss:.2f}")

        # Extract transition matrix for Langevin strategy
        tm = ls_result.get("transition_matrix", {})
        if tm:
            p_id = tm.get("I", {}).get("D", 0)
            p_ir = tm.get("I", {}).get("R", 0)
            print(f"    Transition matrix: P(I->D)={p_id:.3f}, P(I->R)={p_ir:.3f}, "
                  f"D->I->D safe={p_id > p_ir}")

        # --- Phase 2: Run LangevinNative with the token's transition matrix ---
        print("  Running LangevinNative...", flush=True)
        ln_result = walk_forward(
            data, vecs,
            strategy_cls=LangevinNativeStrategy,
            strategy_kwargs={
                "transition_matrix": tm,
            },
        )
        ln_m = ln_result["metrics"]
        ln_hold = compute_avg_hold(ln_result["trades"])
        ln_win, ln_loss = compute_avg_win_loss(ln_result["trades"])

        print(f"    Langevin:  ret={ln_m['total_return']:.2%}, sharpe={ln_m['sharpe_ratio']:.2f}, "
              f"trades={ln_m['n_trades']}, win={ln_m['win_rate']:.1%}, "
              f"dd={ln_m['max_drawdown']:.1%}, hold={ln_hold:.0f}h")
        print(f"    Avg win=${ln_win:.2f}, avg loss=${ln_loss:.2f}")

        # --- Phase 3: Baselines ---
        print("  Running baselines...", flush=True)
        bh_result = run_simple_strategy(data, BuyAndHold())
        ma_result = run_simple_strategy(data, MACrossover())

        bh_m = bh_result["metrics"]
        ma_m = ma_result["metrics"]
        ma_hold = compute_avg_hold(ma_result["trades"])
        ma_win, ma_loss = compute_avg_win_loss(ma_result["trades"])

        print(f"    Buy&Hold:  ret={bh_m['total_return']:.2%}, sharpe={bh_m['sharpe_ratio']:.2f}, "
              f"dd={bh_m['max_drawdown']:.1%}")
        print(f"    MA-Cross:  ret={ma_m['total_return']:.2%}, sharpe={ma_m['sharpe_ratio']:.2f}, "
              f"trades={ma_m['n_trades']}, win={ma_m['win_rate']:.1%}, "
              f"dd={ma_m['max_drawdown']:.1%}, hold={ma_hold:.0f}h")
        print(f"    MA Avg win=${ma_win:.2f}, avg loss=${ma_loss:.2f}")

        # --- Collect ---
        results[symbol] = {
            "langevin_native": {
                "metrics": ln_m,
                "avg_hold_hours": ln_hold,
                "avg_win": ln_win,
                "avg_loss": ln_loss,
                "trade_events": dict(Counter(
                    t.get("event", "") for t in ln_result.get("trade_log", [])
                )),
            },
            "landscape_vpvr": {
                "metrics": ls_m,
                "avg_hold_hours": ls_hold,
                "avg_win": ls_win,
                "avg_loss": ls_loss,
            },
            "buy_hold": {"metrics": bh_m},
            "ma_crossover": {
                "metrics": ma_m,
                "avg_hold_hours": ma_hold,
                "avg_win": ma_win,
                "avg_loss": ma_loss,
            },
            "transition_matrix": tm,
            "d_i_d_safe": tm.get("I", {}).get("D", 0) > tm.get("I", {}).get("R", 0) if tm else False,
        }

    # ============================================================================
    # Summary table
    # ============================================================================

    print("\n" + "=" * 110)
    print("STRATEGY COMPARISON")
    print("=" * 110)
    print(f"{'Token':<6} {'Strategy':<18} {'Return':>9} {'Sharpe':>8} {'MaxDD':>8} "
          f"{'Trades':>7} {'WinRate':>8} {'AvgHold':>8} {'AvgWin':>9} {'AvgLoss':>9}")
    print("-" * 110)

    for sym in TOKEN_FILES:
        r = results[sym]
        for strat_key, label in [
            ("langevin_native", "Langevin"),
            ("landscape_vpvr", "Landscape"),
            ("buy_hold", "Buy&Hold"),
            ("ma_crossover", "MA-Cross"),
        ]:
            s = r[strat_key]
            m = s["metrics"]
            hold = s.get("avg_hold_hours", 0)
            aw = s.get("avg_win", 0)
            al = s.get("avg_loss", 0)
            print(f"{sym:<6} {label:<18} {m['total_return']:>8.1%} {m['sharpe_ratio']:>7.2f} "
                  f"{m['max_drawdown']:>7.1%} {m['n_trades']:>7} {m['win_rate']:>7.1%} "
                  f"{hold:>7.0f}h ${aw:>8.2f} ${al:>8.2f}")
        print("-" * 110)

    # D->I->D macro-basin status
    print("\nD->I->D MACRO-BASIN STATUS:")
    for sym in TOKEN_FILES:
        r = results[sym]
        safe = r.get("d_i_d_safe", False)
        tm = r.get("transition_matrix", {})
        pid = tm.get("I", {}).get("D", 0)
        pir = tm.get("I", {}).get("R", 0)
        print(f"  {sym}: {'SAFE' if safe else 'UNSAFE'} — P(I->D)={pid:.3f}, P(I->R)={pir:.3f}")

    # Win/loss ratio comparison
    print("\nWIN/LOSS SIZE RATIO (key metric):")
    for sym in TOKEN_FILES:
        r = results[sym]
        for strat_key, label in [("langevin_native", "Langevin"), ("landscape_vpvr", "Landscape")]:
            s = r[strat_key]
            aw = s.get("avg_win", 0)
            al = abs(s.get("avg_loss", 1))
            ratio = aw / al if al > 0 else float("inf")
            print(f"  {sym} {label}: avg_win/avg_loss = {ratio:.2f}x")

    # Save results
    output_path = DATA_DIR / "langevin_native_results.json"

    # Make serialisable
    serialisable = {}
    for sym, r in results.items():
        sr = {}
        for k, v in r.items():
            if isinstance(v, dict) and "metrics" in v:
                sr[k] = {
                    "metrics": v["metrics"],
                    "avg_hold_hours": v.get("avg_hold_hours", 0),
                    "avg_win": v.get("avg_win", 0),
                    "avg_loss": v.get("avg_loss", 0),
                }
            else:
                sr[k] = v
        serialisable[sym] = sr

    with open(output_path, "w") as f:
        json.dump(serialisable, f, indent=2, default=str)
    print(f"\nResults saved to {output_path}")


if __name__ == "__main__":
    main()
