#!/usr/bin/env python3
"""
Landscape Strategy Pipeline: Walk-forward backtest with VPVR entries,
dual-gate exits, barrier-scaled sizing.

Runs the converged PRD strategy on all 5 tokens, compares to buy-and-hold
and the old regime strategies.
"""

from __future__ import annotations

import json
import math
import sys
import warnings
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.features.indicators_fast import compute_all_features
from src.features.vectorizer import vectorize_pipeline
from src.classifier.price_landscape import PriceLandscape
from src.backtest.engine import BacktestEngine, Signal
from src.backtest.baselines import BuyAndHold
from src.strategy.landscape_strategy import LandscapeStrategy

DATA_DIR = PROJECT_ROOT / "data"
WINDOW = 72

TOKEN_FILES = {
    "BTC": DATA_DIR / "btc_ohlcv_1h_extended.csv",
    "ETH": DATA_DIR / "eth_ohlcv_1h.csv",
    "SOL": DATA_DIR / "sol_ohlcv_1h.csv",
    "BNB": DATA_DIR / "bnb_ohlcv_1h.csv",
    "ADA": DATA_DIR / "ada_ohlcv_1h.csv",
}


# ============================================================================
# Data loading + feature computation
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
# Pre-compute full classification with all fields needed by strategy
# ============================================================================

def precompute_full_classification(
    landscape: PriceLandscape, vectors: pd.DataFrame,
) -> pd.DataFrame:
    """
    Pre-compute regime, confidence, transition_score, basin_depth,
    barrier_height, gradient magnitude/direction, normalised_barrier,
    and barrier_to_d for every bar.
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
            from src.classifier.price_landscape import _estimate_barrier
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

    # Find D-basin centroid for barrier_to_d computation
    d_basin = None
    for b in basins:
        regime = landscape.get_regime_for_label(b.label)
        if regime == "D":
            d_basin = b
            break

    for i in range(len(X)):
        vec = X[i]
        er = landscape._compute_energy(vec)
        cls = landscape.classify(vec)

        # Gradient info
        gradient = er["gradient"]
        gradient_mag = float(np.linalg.norm(gradient))

        # Direction: positive = toward basin center, negative = away
        nearest_label = er["nearest_basin"]
        nearest_basin_obj = next((b for b in basins if b.label == nearest_label), basins[0])
        to_center = nearest_basin_obj.centroid - vec
        if np.linalg.norm(to_center) > 0 and gradient_mag > 0:
            gradient_direction = float(np.dot(gradient, to_center) / (np.linalg.norm(to_center) * gradient_mag))
        else:
            gradient_direction = 0.0

        # Barrier height (to nearest neighbor basin)
        barrier_height = max(0, er["barrier_to_second"])
        normalised_barrier = min(1.0, barrier_height / max_barrier) if max_barrier > 0 else 0.0

        # Barrier to D
        barrier_to_d = 1.0
        regime = landscape.get_regime_for_label(nearest_label)
        if d_basin is not None and regime != "D":
            from src.classifier.price_landscape import _estimate_barrier
            b_to_d = _estimate_barrier(
                vec, d_basin.centroid, basins,
                landscape.landscape.adjacency, nearest_basin_obj, d_basin,
            )
            barrier_to_d = max(0, (b_to_d - er["energy"]) / max_barrier) if max_barrier > 0 else 1.0

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
# Walk-forward backtest for landscape strategy
# ============================================================================

def walk_forward_landscape(
    data: pd.DataFrame, vectors: pd.DataFrame,
    train_bars: int = 2000, step_bars: int = 500,
    warmup_bars: int = 100,
) -> dict:
    engine = BacktestEngine(initial_capital=10_000)
    all_trades = []
    equity_pieces = []
    all_trade_logs = []

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

        # Fit landscape on training data
        ls = PriceLandscape()
        ls.fit(train_vecs.values, k=3)

        # Pre-compute full classifications for test period
        clf_df = precompute_full_classification(ls, test_vecs)

        # Merge classification columns into test data
        test_enriched = test_data.copy()
        for col in clf_df.columns:
            test_enriched[col] = clf_df[col].reindex(test_enriched.index)
        test_enriched = test_enriched.ffill().fillna(0)

        # Build and run strategy
        strat = LandscapeStrategy(warmup_bars=warmup_bars)
        result = engine.run(strat, test_enriched)
        all_trades.extend(result.trades)
        all_trade_logs.extend(result.trade_log)
        equity_pieces.append(result.equity_curve)

        fold += 1
        start += step_bars

    if not equity_pieces:
        return {
            "strategy_name": "Landscape-VPVR",
            "trades": [],
            "metrics": {"total_return": 0, "sharpe_ratio": 0, "max_drawdown": 0,
                        "n_trades": 0, "win_rate": 0, "profit_factor": 0,
                        "initial_capital": 10000, "final_capital": 10000,
                        "avg_pnl": 0, "avg_win": 0, "avg_loss": 0},
            "equity_curve": pd.Series(dtype=float),
            "trade_log": [],
        }

    combined = pd.concat(equity_pieces)
    combined = combined[~combined.index.duplicated(keep="first")]
    metrics = engine._compute_metrics(combined, all_trades)

    return {
        "strategy_name": "Landscape-VPVR",
        "trades": all_trades,
        "metrics": metrics,
        "equity_curve": combined,
        "trade_log": all_trade_logs,
        "n_folds": fold,
    }


# ============================================================================
# Run baseline
# ============================================================================

def run_baseline(data: pd.DataFrame) -> dict:
    engine = BacktestEngine(initial_capital=10_000)
    strat = BuyAndHold()
    if hasattr(strat, 'precompute'):
        strat.precompute(data)
    result = engine.run(strat, data)
    return {
        "strategy_name": result.strategy_name,
        "metrics": result.metrics,
    }


# ============================================================================
# Portfolio simulation
# ============================================================================

def portfolio_simulation(
    all_data: dict[str, pd.DataFrame],
    all_vectors: dict[str, pd.DataFrame],
    initial_capital: float = 50_000,
) -> dict:
    print("\n" + "=" * 60)
    print("PORTFOLIO SIMULATION — Landscape Strategy")
    print("=" * 60, flush=True)

    # Pre-fit landscapes and classify
    token_clf: dict[str, pd.DataFrame] = {}
    token_landscapes: dict[str, PriceLandscape] = {}

    for sym, vecs in all_vectors.items():
        ls = PriceLandscape()
        ls.fit(vecs.values, k=3)
        token_landscapes[sym] = ls
        token_clf[sym] = precompute_full_classification(ls, vecs)
        print(f"  {sym}: classified {len(token_clf[sym])} bars", flush=True)

    # Common date range
    all_indices = [d.index for d in all_data.values()]
    common_start = max(idx[0] for idx in all_indices)
    common_end = min(idx[-1] for idx in all_indices)
    print(f"  Common range: {common_start} to {common_end}", flush=True)

    ref = list(all_data.keys())[0]
    timeline = all_data[ref].loc[common_start:common_end].index

    capital = initial_capital
    positions: dict[str, float] = {}
    equity_curve = []
    commission = 0.001
    slippage = 0.0005
    prev_d_set: set[str] = set()

    for ts in timeline:
        # Score qualifying tokens
        scored = []
        for sym in all_data:
            if ts not in token_clf[sym].index:
                continue
            clf = token_clf[sym].loc[ts]
            regime = clf.get("regime", "I")
            ts_score = clf.get("transition_score", 0.5)
            conf = clf.get("confidence", 0.0)
            basin_depth = clf.get("basin_depth", 1.0)
            barrier = clf.get("barrier_height", 0.5)

            if regime == "D" and conf > 0.5 and ts_score < 0.3:
                score = basin_depth * max(barrier, 0.01)
                scored.append((sym, score))

        scored.sort(key=lambda x: -x[1])
        d_set = set(s for s, _ in scored)

        if d_set != prev_d_set:
            # Exit tokens no longer qualifying
            for sym in list(positions.keys()):
                if sym not in d_set and ts in all_data[sym].index:
                    price = all_data[sym].loc[ts, "close"] * (1 - slippage)
                    capital += positions[sym] * price * (1 - commission)
                    del positions[sym]

            # Enter/rebalance qualifying tokens
            if scored:
                total_mtm = capital + sum(
                    positions.get(s, 0) * all_data[s].loc[ts, "close"]
                    for s in positions if ts in all_data[s].index
                )
                per_token = total_mtm / len(scored) * 0.90  # 90% deployed

                for sym, score in scored:
                    if sym not in positions and ts in all_data[sym].index:
                        alloc = min(per_token, capital * 0.30)  # 30% cap
                        if alloc > 100:
                            price = all_data[sym].loc[ts, "close"] * (1 + slippage)
                            qty = (alloc * (1 - commission)) / price
                            capital -= alloc
                            positions[sym] = qty

            prev_d_set = d_set

        # Mark to market
        mtm = capital
        for sym, qty in positions.items():
            if ts in all_data[sym].index:
                mtm += qty * all_data[sym].loc[ts, "close"]
        equity_curve.append({"timestamp": ts, "equity": mtm})

    eq_df = pd.DataFrame(equity_curve).set_index("timestamp")
    eq_series = eq_df["equity"]

    total_return = (eq_series.iloc[-1] / initial_capital) - 1.0
    daily_eq = eq_series.resample("1D").last().dropna()
    daily_ret = daily_eq.pct_change().dropna()
    sharpe = (daily_ret.mean() / daily_ret.std()) * np.sqrt(365) if daily_ret.std() > 0 else 0
    cummax = eq_series.cummax()
    max_dd = float(((eq_series - cummax) / cummax).min())

    return {
        "total_return": float(total_return),
        "sharpe_ratio": float(sharpe),
        "max_drawdown": float(max_dd),
        "initial_capital": initial_capital,
        "final_capital": float(eq_series.iloc[-1]),
    }


# ============================================================================
# Main
# ============================================================================

def main():
    print("=" * 60)
    print("LANDSCAPE STRATEGY PIPELINE")
    print(f"  Tokens: {list(TOKEN_FILES.keys())}")
    print(f"  Walk-forward: train=2000, step=500, warmup=100")
    print("=" * 60, flush=True)

    # Load all data
    all_data = {}
    all_vectors = {}

    for symbol, filepath in TOKEN_FILES.items():
        print(f"\nLoading {symbol}...", end=" ", flush=True)
        df = load_token_data(symbol, filepath)
        vecs = compute_vectors(df)
        all_data[symbol] = df
        all_vectors[symbol] = vecs
        print(f"{len(df)} bars, {len(vecs)} vectors")

    # Per-token backtests
    all_results = {}

    for symbol in TOKEN_FILES:
        print(f"\n{'=' * 40}")
        print(f"  {symbol} — Walk-Forward Landscape Backtest")
        print(f"{'=' * 40}", flush=True)

        data = all_data[symbol]
        vecs = all_vectors[symbol]

        # Landscape strategy
        ls_result = walk_forward_landscape(data, vecs)
        m = ls_result["metrics"]
        print(f"  Landscape-VPVR: ret={m['total_return']:.2%}, sharpe={m['sharpe_ratio']:.2f}, "
              f"trades={m['n_trades']}, win_rate={m['win_rate']:.1%}, max_dd={m['max_drawdown']:.2%}")

        # Buy and hold baseline
        bh = run_baseline(data)
        print(f"  Buy-and-Hold:   ret={bh['metrics']['total_return']:.2%}")

        # Trade log summary
        trade_log = ls_result.get("trade_log", [])
        if trade_log:
            events = Counter(t["event"] for t in trade_log)
            print(f"  Trade events: {dict(events)}")

        all_results[symbol] = {
            "landscape": ls_result["metrics"],
            "buy_hold": bh["metrics"],
            "n_folds": ls_result.get("n_folds", 0),
            "n_trade_log_entries": len(trade_log),
        }

    # Portfolio simulation
    portfolio = portfolio_simulation(all_data, all_vectors)
    all_results["portfolio"] = portfolio

    # Summary table
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"{'Token':<8} {'Landscape':>12} {'Buy&Hold':>12} {'Sharpe':>8} {'MaxDD':>8} {'Trades':>7}")
    print("-" * 60)
    for sym in TOKEN_FILES:
        r = all_results[sym]
        ls = r["landscape"]
        bh = r["buy_hold"]
        print(f"{sym:<8} {ls['total_return']:>11.1%} {bh['total_return']:>11.1%} "
              f"{ls['sharpe_ratio']:>7.2f} {ls['max_drawdown']:>7.1%} {ls['n_trades']:>7}")

    print("-" * 60)
    p = all_results["portfolio"]
    print(f"{'PORTF':<8} {p['total_return']:>11.1%} {'—':>12} {p['sharpe_ratio']:>7.2f} {p['max_drawdown']:>7.1%}")

    # Save results
    output_path = DATA_DIR / "landscape_strategy_results.json"
    serializable = {}
    for k, v in all_results.items():
        if isinstance(v, dict):
            serializable[k] = {
                kk: (float(vv) if isinstance(vv, (np.floating, float)) else
                     int(vv) if isinstance(vv, (np.integer, int)) else vv)
                for kk, vv in (v if not any(isinstance(vv, dict) for vv in v.values()) else
                               {kk: vv for kk, vv in v.items() if not isinstance(vv, dict)}).items()
            }
    # Simpler serialization
    with open(output_path, "w") as f:
        json.dump(all_results, f, indent=2, default=str)
    print(f"\nResults saved to {output_path}")


if __name__ == "__main__":
    main()
