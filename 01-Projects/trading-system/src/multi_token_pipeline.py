#!/usr/bin/env python3
"""
Multi-Token Pipeline: Phase A validation, price-native backtesting,
portfolio simulation, and chart generation.

Tasks 4-7 in one script.

Performance note: classifications are pre-computed once per landscape fit,
not per-bar inside strategy loops.
"""

from __future__ import annotations

import json
import math
import os
import sys
import warnings
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.features.indicators_fast import compute_all_features, D_FEATURES, I_FEATURES, R_FEATURES
from src.features.vectorizer import vectorize_pipeline
from src.classifier.price_landscape import PriceLandscape
from src.backtest.engine import BacktestEngine, Signal
from src.backtest.baselines import BuyAndHold, MACrossover

DATA_DIR = PROJECT_ROOT / "data"
CHARTS_DIR = DATA_DIR / "charts" / "multi_token"
CHARTS_DIR.mkdir(parents=True, exist_ok=True)

WINDOW = 72

TOKEN_FILES = {
    "BTC": DATA_DIR / "btc_ohlcv_1h_extended.csv",
    "ETH": DATA_DIR / "eth_ohlcv_1h.csv",
    "SOL": DATA_DIR / "sol_ohlcv_1h.csv",
    "BNB": DATA_DIR / "bnb_ohlcv_1h.csv",
    "ADA": DATA_DIR / "ada_ohlcv_1h.csv",
}


# ============================================================================
# Data loading
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
# Pre-compute classifications for all bars
# ============================================================================

def precompute_classifications(
    landscape: PriceLandscape, vectors: pd.DataFrame,
) -> pd.DataFrame:
    """
    Pre-compute regime, confidence, energy, transition_score for every bar.
    This avoids O(bars * basins) work inside strategy loops.
    """
    results = []
    X = vectors.values
    basins = landscape.landscape.basins
    adjacency = landscape.landscape.adjacency

    for i in range(len(X)):
        vec = X[i]
        # Inline fast classification (avoid dict overhead)
        dists = [float(np.sum((vec - b.centroid) ** 2)) for b in basins]
        nearest_idx = int(np.argmin(dists))
        nearest = basins[nearest_idx]
        regime = landscape.get_regime_for_label(nearest.label)

        # Fast energy
        energy = 0.0
        for b in basins:
            dist_sq = float(np.sum((vec - b.centroid) ** 2))
            energy -= b.depth * math.exp(-dist_sq / (2.0 * b.width * b.width))

        # Simple transition score: distance ratio to nearest vs second
        sorted_d = sorted(dists)
        if len(sorted_d) > 1 and sorted_d[1] > 0:
            trans_score = sorted_d[0] / sorted_d[1]
        else:
            trans_score = 0.0

        min_d = math.sqrt(sorted_d[0])
        max_d = math.sqrt(sorted_d[-1]) if sorted_d[-1] > 0 else 1.0
        confidence = 1.0 - (min_d / max_d) if max_d > 0 else 0.0

        results.append({
            "label": nearest.label,
            "regime": regime,
            "confidence": confidence,
            "energy": energy,
            "transition_score": trans_score,
        })

    return pd.DataFrame(results, index=vectors.index)


# ============================================================================
# Task 4: Phase A — K sweep per token
# ============================================================================

def phase_a_k_sweep(token_vectors: dict[str, pd.DataFrame]) -> dict:
    print("\n" + "=" * 60)
    print("TASK 4: Phase A — K-sweep per token")
    print("=" * 60)

    ks = [3, 5, 7, 9, 12]
    results = {}

    for symbol, vecs in token_vectors.items():
        X = vecs.values
        print(f"\n  {symbol}: {len(X)} vectors")

        scores = {}
        for k in ks:
            if k >= len(X):
                continue
            km = KMeans(n_clusters=k, init="k-means++", n_init=10,
                        max_iter=300, random_state=42)
            labels = km.fit_predict(X)
            n_pop = len(set(labels))
            if n_pop < 2:
                scores[k] = -1.0
                continue
            sil = silhouette_score(X, labels, sample_size=min(10000, len(X)))
            scores[k] = float(sil)
            print(f"    K={k:2d}: silhouette={sil:.4f}")

        best_k = max(scores, key=scores.get)
        print(f"    BEST: K={best_k} (sil={scores[best_k]:.4f})")

        results[symbol] = {
            "n_vectors": len(X),
            "silhouette_scores": {str(k): v for k, v in scores.items()},
            "best_k": best_k,
            "best_silhouette": scores[best_k],
        }

    return results


# ============================================================================
# Task 5: Strategies using pre-computed classifications
# ============================================================================

class PrecomputedStrategy:
    """Base class for strategies using pre-computed regime data."""
    def __init__(self, clf_df: pd.DataFrame, data_index: pd.DatetimeIndex):
        self.clf = clf_df
        self.data_index = data_index
        self._in_position = False

    def _get_clf(self, idx: int) -> Optional[pd.Series]:
        ts = self.data_index[idx]
        if ts in self.clf.index:
            return self.clf.loc[ts]
        return None

    def precompute(self, data: pd.DataFrame) -> None:
        pass


class Strat3E1(PrecomputedStrategy):
    """3E-1: D-Only energy transition. Exit when transition_score high."""
    def name(self) -> str:
        return "3E-1-DOnly-EnergyTrans"

    def on_bar(self, idx: int, row: pd.Series, history: pd.DataFrame) -> Signal:
        c = self._get_clf(idx)
        if c is None:
            return Signal(action="hold")
        if not self._in_position:
            if c["regime"] == "D" and c["confidence"] > 0.3:
                self._in_position = True
                return Signal(action="buy", size=0.9, reason="D_entry",
                              trailing_stop_pct=0.06)
        else:
            if c["regime"] == "R" or c["transition_score"] > 0.8:
                self._in_position = False
                return Signal(action="sell", reason="R_transition")
        return Signal(action="hold")


class Strat3E2(PrecomputedStrategy):
    """3E-2: D-Only barrier-scaled position sizing."""
    def name(self) -> str:
        return "3E-2-DOnly-BarrierScaled"

    def on_bar(self, idx: int, row: pd.Series, history: pd.DataFrame) -> Signal:
        c = self._get_clf(idx)
        if c is None:
            return Signal(action="hold")
        if not self._in_position:
            if c["regime"] == "D" and c["confidence"] > 0.3:
                size = min(0.95, max(0.3, 0.3 + 0.65 * (1.0 - c["transition_score"])))
                self._in_position = True
                return Signal(action="buy", size=size, reason="D_barrier_entry",
                              trailing_stop_pct=0.06)
        else:
            if c["regime"] == "R":
                self._in_position = False
                return Signal(action="sell", reason="R_exit")
        return Signal(action="hold")


class Strat9P1(PrecomputedStrategy):
    """9P-1: D-primary conservative."""
    def name(self) -> str:
        return "9P-1-DPrimary-Conservative"

    def on_bar(self, idx: int, row: pd.Series, history: pd.DataFrame) -> Signal:
        c = self._get_clf(idx)
        if c is None:
            return Signal(action="hold")
        if not self._in_position:
            if c["regime"] == "D":
                self._in_position = True
                return Signal(action="buy", size=0.9, reason=f"D_entry",
                              trailing_stop_pct=0.06)
        else:
            if c["regime"] == "R":
                self._in_position = False
                return Signal(action="sell", reason="R_exit")
        return Signal(action="hold")


class Strat9P2(PrecomputedStrategy):
    """9P-2: Full 9-composition map."""
    def name(self) -> str:
        return "9P-2-Full9Map"

    def on_bar(self, idx: int, row: pd.Series, history: pd.DataFrame) -> Signal:
        c = self._get_clf(idx)
        if c is None:
            return Signal(action="hold")
        if not self._in_position:
            if c["regime"] == "D":
                size = 0.95 if "D(D)" in str(c["label"]) else 0.8
                self._in_position = True
                return Signal(action="buy", size=size, reason="entry",
                              trailing_stop_pct=0.05)
        else:
            if c["regime"] == "R":
                self._in_position = False
                return Signal(action="sell", reason="R_exit")
        return Signal(action="hold")


class Strat9P3(PrecomputedStrategy):
    """9P-3: Barrier transition."""
    def name(self) -> str:
        return "9P-3-BarrierTransition"

    def on_bar(self, idx: int, row: pd.Series, history: pd.DataFrame) -> Signal:
        c = self._get_clf(idx)
        if c is None:
            return Signal(action="hold")
        if not self._in_position:
            if c["regime"] == "D" and c["transition_score"] < 0.5:
                self._in_position = True
                return Signal(action="buy", size=0.9, reason="D_low_trans",
                              trailing_stop_pct=0.06)
        else:
            if c["regime"] == "R" or c["transition_score"] > 0.8:
                self._in_position = False
                return Signal(action="sell", reason="high_trans_exit")
        return Signal(action="hold")


# ============================================================================
# Walk-forward backtest
# ============================================================================

def walk_forward_backtest(
    data: pd.DataFrame, vectors: pd.DataFrame,
    strategy_cls, landscape_k: int, use_adjacency: bool = False,
    train_hours: int = 2 * 365 * 24,
    test_hours: int = 6 * 30 * 24,
) -> dict:
    engine = BacktestEngine(initial_capital=10_000)
    all_trades = []
    equity_pieces = []

    n = len(data)
    if n < train_hours + test_hours:
        train_hours = int(n * 0.6)
        test_hours = n - train_hours

    start = 0
    while start + train_hours + test_hours <= n:
        train_end = start + train_hours
        test_end = min(train_end + test_hours, n)

        train_data = data.iloc[start:train_end]
        test_data = data.iloc[train_end:test_end]

        train_vecs = vectors.loc[vectors.index.isin(train_data.index)]
        test_vecs = vectors.loc[vectors.index.isin(test_data.index)]

        if len(train_vecs) < 100 or len(test_vecs) < 50:
            start += test_hours
            continue

        # Fit landscape on training data
        ls = PriceLandscape()
        ls.fit(train_vecs.values, k=landscape_k, use_adjacency_prior=use_adjacency)

        # Pre-compute classifications for test period
        clf_df = precompute_classifications(ls, test_vecs)

        # Build and run strategy
        strat = strategy_cls(clf_df, test_data.index)
        result = engine.run(strat, test_data)
        all_trades.extend(result.trades)
        equity_pieces.append(result.equity_curve)

        start += test_hours

    if not equity_pieces:
        return {
            "strategy_name": strategy_cls.__name__ if hasattr(strategy_cls, '__name__') else "N/A",
            "trades": [],
            "metrics": {"total_return": 0, "sharpe_ratio": 0, "max_drawdown": 0,
                        "n_trades": 0, "win_rate": 0, "profit_factor": 0,
                        "initial_capital": 10000, "final_capital": 10000,
                        "avg_pnl": 0, "avg_win": 0, "avg_loss": 0},
            "equity_curve": pd.Series(dtype=float),
        }

    combined = pd.concat(equity_pieces)
    combined = combined[~combined.index.duplicated(keep="first")]
    metrics = engine._compute_metrics(combined, all_trades)

    return {
        "strategy_name": strategy_cls(pd.DataFrame(), pd.DatetimeIndex([])).name(),
        "trades": all_trades,
        "metrics": metrics,
        "equity_curve": combined,
    }


def run_baseline(data: pd.DataFrame, strategy_cls, **kwargs) -> dict:
    engine = BacktestEngine(initial_capital=10_000)
    strat = strategy_cls(**kwargs)
    if hasattr(strat, 'precompute'):
        strat.precompute(data)
    result = engine.run(strat, data)
    return {
        "strategy_name": result.strategy_name,
        "trades": result.trades,
        "metrics": result.metrics,
        "equity_curve": result.equity_curve,
    }


def run_backtests_for_token(symbol: str, data: pd.DataFrame,
                            vectors: pd.DataFrame) -> dict:
    print(f"\n  Backtesting {symbol}...", flush=True)
    results = {}

    # --- K=3 strategies ---
    for cls, key in [(Strat3E1, "3E-1"), (Strat3E2, "3E-2")]:
        r = walk_forward_backtest(data, vectors, cls, landscape_k=3)
        results[key] = r
        m = r["metrics"]
        print(f"    {key}: ret={m['total_return']:.2%}, sharpe={m['sharpe_ratio']:.2f}, trades={m['n_trades']}", flush=True)

    # --- K=9 quality check ---
    ls9 = PriceLandscape()
    ls9.fit(vectors.values, k=9, use_adjacency_prior=True)
    k9_sil = silhouette_score(vectors.values, ls9.labels_, sample_size=min(10000, len(vectors)))

    km_unc = KMeans(n_clusters=9, init="k-means++", n_init=10, max_iter=300, random_state=42)
    k9_unc_labels = km_unc.fit_predict(vectors.values)
    k9_unc_sil = silhouette_score(vectors.values, k9_unc_labels, sample_size=min(10000, len(vectors)))

    comp_dist = Counter(ls9.basin_labels_[l] for l in ls9.labels_)
    max_pct = max(comp_dist.values()) / len(ls9.labels_) * 100
    print(f"    K=9: adj_sil={k9_sil:.4f} vs unc_sil={k9_unc_sil:.4f}, max_basin={max_pct:.1f}%", flush=True)

    results["k9_quality"] = {
        "adjacency_silhouette": float(k9_sil),
        "unconstrained_silhouette": float(k9_unc_sil),
        "composition_distribution": {k: v for k, v in comp_dist.items()},
        "max_basin_pct": float(max_pct),
    }

    # --- K=9 strategies ---
    for cls, key in [(Strat9P1, "9P-1"), (Strat9P2, "9P-2"), (Strat9P3, "9P-3")]:
        r = walk_forward_backtest(data, vectors, cls, landscape_k=9, use_adjacency=True)
        results[key] = r
        m = r["metrics"]
        print(f"    {key}: ret={m['total_return']:.2%}, sharpe={m['sharpe_ratio']:.2f}, trades={m['n_trades']}", flush=True)

    # --- Baselines ---
    r = run_baseline(data, BuyAndHold)
    results["BuyHold"] = r
    print(f"    BuyHold: ret={r['metrics']['total_return']:.2%}", flush=True)

    r = run_baseline(data, MACrossover)
    results["MACross"] = r
    print(f"    MACross: ret={r['metrics']['total_return']:.2%}, sharpe={r['metrics']['sharpe_ratio']:.2f}", flush=True)

    return results


# ============================================================================
# Task 6: Portfolio simulation
# ============================================================================

def portfolio_simulation(
    all_data: dict[str, pd.DataFrame],
    all_vectors: dict[str, pd.DataFrame],
    initial_capital: float = 50_000,
) -> dict:
    print("\n" + "=" * 60)
    print("TASK 6: Multi-Token Portfolio Simulation")
    print("=" * 60, flush=True)

    # Pre-compute K=3 classifications for each token
    token_clf: dict[str, pd.DataFrame] = {}
    for sym, vecs in all_vectors.items():
        ls = PriceLandscape()
        ls.fit(vecs.values, k=3)
        token_clf[sym] = precompute_classifications(ls, vecs)
        print(f"  {sym}: classified {len(token_clf[sym])} bars", flush=True)

    # Common date range
    all_indices = [d.index for d in all_data.values()]
    common_start = max(idx[0] for idx in all_indices)
    common_end = min(idx[-1] for idx in all_indices)
    print(f"  Common range: {common_start} to {common_end}", flush=True)

    ref = list(all_data.keys())[0]
    timeline = all_data[ref].loc[common_start:common_end].index

    capital = initial_capital
    positions: dict[str, float] = {}  # sym -> qty
    equity_curve = []
    allocation_history = []
    regime_history: dict[str, list[str]] = {sym: [] for sym in all_data}
    prev_d_set: set[str] = set()  # track previous D-regime set

    commission = 0.001
    slippage = 0.0005

    for ts in timeline:
        # Determine D-regime tokens
        d_tokens = set()
        for sym in all_data:
            if ts in token_clf[sym].index:
                regime = token_clf[sym].loc[ts, "regime"]
                regime_history[sym].append(regime)
                if regime == "D":
                    d_tokens.add(sym)
            else:
                regime_history[sym].append("?")

        # Only trade on regime CHANGES (not every bar)
        regime_changed = (d_tokens != prev_d_set)

        if regime_changed:
            # Exit tokens that left D-regime
            for sym in list(positions.keys()):
                if sym not in d_tokens:
                    if ts in all_data[sym].index:
                        price = all_data[sym].loc[ts, "close"] * (1 - slippage)
                        capital += positions[sym] * price * (1 - commission)
                        del positions[sym]

            # Portfolio value after exits
            total_value = capital
            for sym, qty in positions.items():
                if ts in all_data[sym].index:
                    total_value += qty * all_data[sym].loc[ts, "close"]

            # Enter new D-regime tokens (don't touch existing positions)
            new_d = d_tokens - set(positions.keys())
            if new_d and capital > 100:
                per_new = (capital * 0.95) / len(new_d)
                for sym in new_d:
                    if ts not in all_data[sym].index:
                        continue
                    invest = min(capital * 0.95, per_new)
                    if invest > 100:
                        buy_price = all_data[sym].loc[ts, "close"] * (1 + slippage)
                        qty = invest * (1 - commission) / buy_price
                        positions[sym] = qty
                        capital -= invest

            prev_d_set = d_tokens

        # MTM
        mtm = capital
        for sym, qty in positions.items():
            if ts in all_data[sym].index:
                mtm += qty * all_data[sym].loc[ts, "close"]
        equity_curve.append(mtm)

        alloc = {}
        for sym in all_data:
            if ts in all_data[sym].index and mtm > 0:
                alloc[sym] = positions.get(sym, 0) * all_data[sym].loc[ts, "close"] / mtm
            else:
                alloc[sym] = 0
        allocation_history.append(alloc)

    equity_series = pd.Series(equity_curve, index=timeline, name="portfolio")

    # Baselines
    # Equal-weight B&H
    eq_positions = {}
    per_token = initial_capital / len(all_data)
    eq_equity = []
    for i, ts in enumerate(timeline):
        if i == 1:
            for sym in all_data:
                if ts in all_data[sym].index:
                    eq_positions[sym] = per_token / all_data[sym].loc[ts, "close"]
        mtm = sum(eq_positions.get(sym, 0) * all_data[sym].loc[ts, "close"]
                  for sym in all_data if ts in all_data[sym].index)
        eq_equity.append(mtm if mtm > 0 else initial_capital)
    eq_series = pd.Series(eq_equity, index=timeline, name="eq_bh")

    # BTC-only B&H
    btc_pos = 0
    btc_cap = initial_capital
    btc_equity = []
    for i, ts in enumerate(timeline):
        if i == 1 and ts in all_data["BTC"].index:
            btc_pos = btc_cap / all_data["BTC"].loc[ts, "close"]
            btc_cap = 0
        mtm = btc_cap + (btc_pos * all_data["BTC"].loc[ts, "close"] if ts in all_data["BTC"].index else 0)
        btc_equity.append(mtm)
    btc_series = pd.Series(btc_equity, index=timeline, name="btc_bh")

    def calc_metrics(eq):
        daily = eq.resample("1D").last().dropna()
        dr = daily.pct_change().dropna()
        sharpe = (dr.mean() / dr.std()) * np.sqrt(365) if len(dr) > 1 and dr.std() > 0 else 0
        dd = ((eq - eq.cummax()) / eq.cummax()).min()
        ret = (eq.iloc[-1] / eq.iloc[0]) - 1
        return {"total_return": float(ret), "sharpe_ratio": float(sharpe), "max_drawdown": float(dd)}

    pm = calc_metrics(equity_series)
    em = calc_metrics(eq_series)
    bm = calc_metrics(btc_series)

    print(f"\n  Portfolio:    ret={pm['total_return']:.2%}, sharpe={pm['sharpe_ratio']:.2f}, dd={pm['max_drawdown']:.2%}")
    print(f"  EQ-Weight BH: ret={em['total_return']:.2%}, sharpe={em['sharpe_ratio']:.2f}")
    print(f"  BTC-Only BH:  ret={bm['total_return']:.2%}, sharpe={bm['sharpe_ratio']:.2f}", flush=True)

    return {
        "portfolio": {"equity_curve": equity_series, "metrics": pm,
                      "allocation_history": allocation_history, "regime_history": regime_history},
        "equal_weight_bh": {"equity_curve": eq_series, "metrics": em},
        "btc_only_bh": {"equity_curve": btc_series, "metrics": bm},
    }


# ============================================================================
# Task 7: Charts
# ============================================================================

def generate_charts(token_data, token_vectors, backtest_results, portfolio_results, phase_a):
    print("\n" + "=" * 60)
    print("TASK 7: Charts and reports")
    print("=" * 60, flush=True)

    for symbol in token_data:
        vecs = token_vectors[symbol]
        bt = backtest_results.get(symbol, {})

        # Equity curves
        fig, ax = plt.subplots(figsize=(14, 6))
        for key, label in [("3E-1", "3E-1 Energy Trans"), ("3E-2", "3E-2 Barrier Scaled"),
                           ("9P-1", "9P-1 Conservative"), ("9P-2", "9P-2 Full Map"),
                           ("9P-3", "9P-3 Barrier Trans"),
                           ("BuyHold", "Buy & Hold"), ("MACross", "MA Cross")]:
            if key in bt and len(bt[key].get("equity_curve", [])) > 0:
                ec = bt[key]["equity_curve"]
                ax.plot(ec.index, ec.values, label=label, alpha=0.8)
        ax.set_title(f"{symbol} — Strategy Equity Curves")
        ax.set_ylabel("Equity ($)")
        ax.legend(fontsize=8)
        ax.grid(True, alpha=0.3)
        fig.tight_layout()
        fig.savefig(CHARTS_DIR / f"{symbol.lower()}_equity_curves.png", dpi=150)
        plt.close(fig)

        # Regime-coloured price chart (K=3)
        data = token_data[symbol]
        ls = PriceLandscape()
        ls.fit(vecs.values, k=3)
        clf = precompute_classifications(ls, vecs)
        aligned = data.loc[data.index.isin(clf.index)]

        fig, ax = plt.subplots(figsize=(14, 5))
        colors = {"D": "#2196F3", "I": "#4CAF50", "R": "#F44336"}
        # Batch plot by regime for speed
        for regime, color in colors.items():
            mask = clf.loc[aligned.index, "regime"] == regime
            indices = aligned.index[mask]
            ax.scatter(indices, aligned.loc[indices, "close"],
                       c=color, s=0.1, alpha=0.6, label=f"{regime}-regime")
        ax.set_title(f"{symbol} — Price by Regime (K=3)")
        ax.set_ylabel("Price")
        ax.legend(markerscale=20)
        ax.grid(True, alpha=0.3)
        fig.tight_layout()
        fig.savefig(CHARTS_DIR / f"{symbol.lower()}_regime_price.png", dpi=150)
        plt.close(fig)

        # K=9 composition distribution
        if "k9_quality" in bt:
            dist = bt["k9_quality"]["composition_distribution"]
            fig, ax = plt.subplots(figsize=(10, 5))
            labels_sorted = sorted(dist.keys())
            vals = [dist[l] for l in labels_sorted]
            ax.bar(labels_sorted, vals,
                   color=["#2196F3" if l[0] == "D" else "#4CAF50" if l[0] == "I" else "#F44336"
                          for l in labels_sorted])
            ax.set_title(f"{symbol} — K=9 Composition Distribution")
            ax.set_ylabel("Count")
            ax.tick_params(axis="x", rotation=45)
            fig.tight_layout()
            fig.savefig(CHARTS_DIR / f"{symbol.lower()}_k9_distribution.png", dpi=150)
            plt.close(fig)

        print(f"  {symbol}: charts saved", flush=True)

    # Portfolio charts
    if portfolio_results:
        # Equity
        fig, ax = plt.subplots(figsize=(14, 6))
        for key, label, color in [
            ("portfolio", "D-Regime Portfolio", "#2196F3"),
            ("equal_weight_bh", "Equal-Weight B&H", "#999999"),
            ("btc_only_bh", "BTC-Only B&H", "#FF9800"),
        ]:
            ec = portfolio_results[key]["equity_curve"]
            ax.plot(ec.index, ec.values, label=label, color=color, linewidth=1.5)
        ax.set_title("Multi-Token Portfolio — Equity Curves")
        ax.set_ylabel("Equity ($)")
        ax.legend()
        ax.grid(True, alpha=0.3)
        fig.tight_layout()
        fig.savefig(CHARTS_DIR / "portfolio_equity.png", dpi=150)
        plt.close(fig)

        # Allocation
        alloc = portfolio_results["portfolio"]["allocation_history"]
        ec = portfolio_results["portfolio"]["equity_curve"]
        alloc_df = pd.DataFrame(alloc, index=ec.index).fillna(0)
        alloc_daily = alloc_df.resample("1D").last().dropna()
        if len(alloc_daily) > 0:
            fig, ax = plt.subplots(figsize=(14, 5))
            c_map = {"BTC": "#F7931A", "ETH": "#627EEA", "SOL": "#9945FF",
                     "BNB": "#F3BA2F", "ADA": "#0033AD"}
            alloc_daily.plot.area(ax=ax, stacked=True,
                                  color=[c_map.get(c, "#999") for c in alloc_daily.columns],
                                  alpha=0.7)
            ax.set_title("Portfolio — Capital Allocation")
            ax.set_ylabel("Weight")
            ax.set_ylim(0, 1.1)
            ax.legend(fontsize=8)
            fig.tight_layout()
            fig.savefig(CHARTS_DIR / "portfolio_allocation.png", dpi=150)
            plt.close(fig)

        # Regime correlation
        regimes = portfolio_results["portfolio"]["regime_history"]
        regime_df = pd.DataFrame(regimes)
        encoded = regime_df.replace({"D": 1, "I": 0, "R": -1, "?": np.nan}).dropna()
        if len(encoded) > 100:
            corr = encoded.corr()
            fig, ax = plt.subplots(figsize=(8, 6))
            im = ax.imshow(corr.values, cmap="RdYlBu", vmin=-1, vmax=1)
            ax.set_xticks(range(len(corr.columns)))
            ax.set_yticks(range(len(corr.columns)))
            ax.set_xticklabels(corr.columns)
            ax.set_yticklabels(corr.columns)
            plt.colorbar(im, ax=ax)
            for i in range(len(corr)):
                for j in range(len(corr)):
                    ax.text(j, i, f"{corr.iloc[i,j]:.2f}", ha="center", va="center", fontsize=10)
            ax.set_title("Regime Correlation Matrix")
            fig.tight_layout()
            fig.savefig(CHARTS_DIR / "regime_correlation.png", dpi=150)
            plt.close(fig)

        # Monthly returns
        daily_eq = ec.resample("1D").last().dropna()
        monthly = daily_eq.resample("ME").last().pct_change().dropna()
        if len(monthly) > 6:
            mdf = pd.DataFrame({"year": monthly.index.year, "month": monthly.index.month,
                                 "return": monthly.values})
            pivot = mdf.pivot_table(index="year", columns="month", values="return")
            fig, ax = plt.subplots(figsize=(12, 6))
            im = ax.imshow(pivot.values * 100, cmap="RdYlGn", aspect="auto", vmin=-30, vmax=30)
            ax.set_xticks(range(pivot.shape[1]))
            ax.set_xticklabels(pivot.columns)
            ax.set_yticks(range(pivot.shape[0]))
            ax.set_yticklabels(pivot.index)
            plt.colorbar(im, ax=ax, label="Return %")
            for i in range(pivot.shape[0]):
                for j in range(pivot.shape[1]):
                    v = pivot.iloc[i, j]
                    if not np.isnan(v):
                        ax.text(j, i, f"{v*100:.1f}", ha="center", va="center", fontsize=7)
            ax.set_title("Portfolio Monthly Returns (%)")
            fig.tight_layout()
            fig.savefig(CHARTS_DIR / "portfolio_monthly_returns.png", dpi=150)
            plt.close(fig)

        print("  Portfolio charts saved", flush=True)

    # Cross-token tables
    print("\n  ── Cross-Token Summary ──")
    print(f"\n  Best K per Token:")
    print(f"  {'Token':>6} | {'Best K':>6} | {'Silhouette':>10}")
    print(f"  {'-'*6}-+-{'-'*6}-+-{'-'*10}")
    for sym, info in phase_a.items():
        print(f"  {sym:>6} | {info['best_k']:>6} | {info['best_silhouette']:>10.4f}")

    print(f"\n  Best Strategy per Token:")
    print(f"  {'Token':>6} | {'Strategy':>25} | {'Return':>10} | {'Sharpe':>8}")
    print(f"  {'-'*6}-+-{'-'*25}-+-{'-'*10}-+-{'-'*8}")
    for sym in token_data:
        bt = backtest_results.get(sym, {})
        best_key, best_ret = None, -999
        for key in ["3E-1", "3E-2", "9P-1", "9P-2", "9P-3"]:
            if key in bt and bt[key]["metrics"]["total_return"] > best_ret:
                best_ret = bt[key]["metrics"]["total_return"]
                best_key = key
        if best_key:
            m = bt[best_key]["metrics"]
            print(f"  {sym:>6} | {bt[best_key]['strategy_name']:>25} | {m['total_return']:>10.2%} | {m['sharpe_ratio']:>8.2f}")

    print(f"\n  Regime Duration (mean bars, K=3):")
    print(f"  {'Token':>6} | {'D mean':>8} | {'I mean':>8} | {'R mean':>8}")
    print(f"  {'-'*6}-+-{'-'*8}-+-{'-'*8}-+-{'-'*8}")
    for sym in token_data:
        vecs = token_vectors[sym]
        ls = PriceLandscape()
        ls.fit(vecs.values, k=3)
        clf = precompute_classifications(ls, vecs)
        regimes = clf["regime"].tolist()

        durations = {"D": [], "I": [], "R": []}
        cur, cnt = regimes[0], 1
        for r in regimes[1:]:
            if r == cur:
                cnt += 1
            else:
                if cur in durations:
                    durations[cur].append(cnt)
                cur, cnt = r, 1
        if cur in durations:
            durations[cur].append(cnt)

        d_m = np.mean(durations["D"]) if durations["D"] else 0
        i_m = np.mean(durations["I"]) if durations["I"] else 0
        r_m = np.mean(durations["R"]) if durations["R"] else 0
        print(f"  {sym:>6} | {d_m:>8.1f} | {i_m:>8.1f} | {r_m:>8.1f}")

    sys.stdout.flush()


# ============================================================================
# Main
# ============================================================================

def main():
    print("=" * 60)
    print("MULTI-TOKEN PIPELINE")
    print("=" * 60, flush=True)

    token_data = {}
    token_vectors = {}
    for symbol, filepath in TOKEN_FILES.items():
        if not filepath.exists():
            print(f"  WARNING: {filepath} not found", flush=True)
            continue
        print(f"  Loading {symbol}...", flush=True)
        df = load_token_data(symbol, filepath)
        vecs = compute_vectors(df, WINDOW)
        token_data[symbol] = df
        token_vectors[symbol] = vecs
        print(f"    {len(df)} bars → {len(vecs)} vectors", flush=True)

    # Task 4
    phase_a = phase_a_k_sweep(token_vectors)
    (DATA_DIR / "multi_token_phase_a_results.json").write_text(json.dumps(phase_a, indent=2))

    # Task 5
    print("\n" + "=" * 60)
    print("TASK 5: Per-Token Backtests")
    print("=" * 60, flush=True)
    backtest_results = {}
    for symbol in token_data:
        backtest_results[symbol] = run_backtests_for_token(
            symbol, token_data[symbol], token_vectors[symbol])

    # Task 6
    portfolio_results = portfolio_simulation(token_data, token_vectors)

    # Save results
    pj = {"portfolio": portfolio_results["portfolio"]["metrics"],
          "equal_weight_bh": portfolio_results["equal_weight_bh"]["metrics"],
          "btc_only_bh": portfolio_results["btc_only_bh"]["metrics"],
          "per_token": {}}
    for sym in backtest_results:
        pj["per_token"][sym] = {}
        for key in ["3E-1", "3E-2", "9P-1", "9P-2", "9P-3", "BuyHold", "MACross"]:
            if key in backtest_results[sym]:
                pj["per_token"][sym][key] = backtest_results[sym][key]["metrics"]
    (DATA_DIR / "multi_token_portfolio_results.json").write_text(json.dumps(pj, indent=2))

    # Task 7
    generate_charts(token_data, token_vectors, backtest_results, portfolio_results, phase_a)

    print("\n" + "=" * 60)
    print("PIPELINE COMPLETE")
    print("=" * 60, flush=True)


if __name__ == "__main__":
    main()
