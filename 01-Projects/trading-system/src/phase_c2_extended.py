#!/usr/bin/env python3
"""
Phase C-2: Extended Revalidation + Strategy Comparison

Comprehensive revalidation of K=9 clustering on full BTC history (2017-2026)
with walk-forward backtesting across multiple strategy variants.

Tasks:
  1. Load/download max BTC data (2017-present)
  2. Revalidate K=9 with extended data across window sizes
  3. Build strategy variants (3-regime + 9-composition)
  4. Walk-forward backtest with 2yr train / 6mo OOS windows
  5. Generate comprehensive charts
  6. Save results

Usage:
    python src/phase_c2_extended.py [--skip-download] [--skip-features]
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import warnings
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from scipy.spatial.distance import cdist
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.features.indicators_fast import (
    compute_all_features, D_FEATURES, I_FEATURES, R_FEATURES, ALL_FEATURES,
)
from src.features.vectorizer import vectorize_pipeline, rolling_minmax_normalize, vectorize
from src.backtest.engine import BacktestEngine, BacktestResult, Signal, Trade

DATA_DIR = PROJECT_ROOT / "data"
CHARTS_DIR = DATA_DIR / "charts"

# Composition names for K=9
COMPOSITIONS_9 = ["D(D)", "D(I)", "D(R)", "I(D)", "I(I)", "I(R)", "R(D)", "R(I)", "R(R)"]

# Adjacency: compositions sharing an operator
ADJACENT_PAIRS = {
    ("D(D)", "D(I)"), ("D(D)", "D(R)"), ("D(I)", "D(R)"),  # D-primary
    ("I(D)", "I(I)"), ("I(D)", "I(R)"), ("I(I)", "I(R)"),  # I-primary
    ("R(D)", "R(I)"), ("R(D)", "R(R)"), ("R(I)", "R(R)"),  # R-primary
    ("D(D)", "I(D)"), ("D(D)", "R(D)"),  # D-secondary
    ("D(I)", "I(I)"), ("D(I)", "R(I)"),  # I-secondary
    ("D(R)", "I(R)"), ("D(R)", "R(R)"),  # R-secondary
    ("I(D)", "R(D)"), ("I(I)", "R(I)"), ("I(R)", "R(R)"),
}
# Make symmetric
ADJACENT_PAIRS = ADJACENT_PAIRS | {(b, a) for a, b in ADJACENT_PAIRS}


# ============================================================================
# Task 1: Data Loading
# ============================================================================

def load_or_download_extended_data(skip_download: bool = False) -> pd.DataFrame:
    """Load extended BTC data. Use existing btc_1h_full.csv or download."""
    extended_path = DATA_DIR / "btc_ohlcv_1h_extended.csv"
    full_path = DATA_DIR / "btc_1h_full.csv"

    # Check if we already have extended data
    if extended_path.exists():
        print(f"[DATA] Loading cached extended data from {extended_path}")
        df = pd.read_csv(extended_path, index_col="timestamp", parse_dates=True)
        df = df.astype(float)
        print(f"[DATA] Loaded {len(df)} candles ({df.index[0]} to {df.index[-1]})")
        return df

    # Use the already-downloaded full data
    if full_path.exists():
        print(f"[DATA] Converting btc_1h_full.csv to extended format...")
        raw = pd.read_csv(full_path)
        df = pd.DataFrame({
            "open": pd.to_numeric(raw["open"], errors="coerce"),
            "high": pd.to_numeric(raw["high"], errors="coerce"),
            "low": pd.to_numeric(raw["low"], errors="coerce"),
            "close": pd.to_numeric(raw["close"], errors="coerce"),
            "volume": pd.to_numeric(raw["volume"], errors="coerce"),
        })
        df.index = pd.to_datetime(raw["open_time"])
        df.index.name = "timestamp"
        df = df.dropna()
        df = df.sort_index()
        # Remove duplicates
        df = df[~df.index.duplicated(keep="first")]
        df.to_csv(extended_path)
        print(f"[DATA] Saved {len(df)} candles to {extended_path}")
        print(f"[DATA] Date range: {df.index[0]} to {df.index[-1]}")
        return df

    if skip_download:
        raise FileNotFoundError("No BTC data found and --skip-download specified")

    # Download via ccxt
    print("[DATA] Downloading BTC/USDT 1h from Binance via ccxt (full history)...")
    try:
        import ccxt
        exchange = ccxt.binance({"enableRateLimit": True})
        # Start from Binance listing
        since = exchange.parse8601("2017-08-17T00:00:00Z")
        all_ohlcv = []
        limit = 1000

        while True:
            ohlcv = exchange.fetch_ohlcv("BTC/USDT", "1h", since=since, limit=limit)
            if not ohlcv:
                break
            all_ohlcv.extend(ohlcv)
            since = ohlcv[-1][0] + 1
            if len(all_ohlcv) % 10000 < limit:
                print(f"  fetched {len(all_ohlcv)} candles...")
            if len(ohlcv) < limit:
                break
            time.sleep(0.3)

        df = pd.DataFrame(all_ohlcv, columns=["timestamp", "open", "high", "low", "close", "volume"])
        df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms")
        df = df.set_index("timestamp").astype(float)
        df = df[~df.index.duplicated(keep="first")]
        df.to_csv(extended_path)
        print(f"[DATA] Downloaded {len(df)} candles ({df.index[0]} to {df.index[-1]})")
        return df
    except Exception as e:
        raise RuntimeError(f"Failed to download BTC data: {e}")


# ============================================================================
# Task 2: K=9 Revalidation
# ============================================================================

def compute_features_for_window(df: pd.DataFrame, window: int) -> pd.DataFrame:
    """Compute 6D vectors for a given window size."""
    print(f"  Computing 12 features (window={window})...", flush=True)
    features = compute_all_features(df, window)
    features = features.fillna(0.0)
    print(f"  Computing 6D vectors...", flush=True)
    vectors = vectorize_pipeline(features)
    return vectors


def run_clustering(vectors_clean: np.ndarray, k_values: list[int],
                   random_state: int = 42,
                   silhouette_sample: int = 10000) -> dict:
    """Run K-means for multiple K values, return silhouette scores and models.

    Uses subsampling for silhouette computation when n > silhouette_sample
    to avoid O(n^2) blowup on large datasets.
    """
    results = {}
    n = len(vectors_clean)
    use_sample = n > silhouette_sample

    for k in k_values:
        km = KMeans(n_clusters=k, n_init=10, random_state=random_state, max_iter=500)
        labels = km.fit_predict(vectors_clean)

        if use_sample:
            # Subsample for silhouette to avoid O(n^2)
            rng = np.random.default_rng(random_state)
            idx = rng.choice(n, size=silhouette_sample, replace=False)
            sil = silhouette_score(vectors_clean[idx], labels[idx])
        else:
            sil = silhouette_score(vectors_clean, labels)

        results[k] = {
            "model": km,
            "labels": labels,
            "silhouette": float(sil),
            "inertia": float(km.inertia_),
            "centroids": km.cluster_centers_,
        }
        print(f"    K={k:2d}: silhouette={sil:.4f}  inertia={km.inertia_:.2f}", flush=True)
    return results


def map_clusters_to_compositions_9(centroids: np.ndarray) -> dict[int, str]:
    """
    Map 9 clusters to D/I/R compositions based on axis weights.
    Primary axis = highest of D,I,R; secondary = second highest.
    """
    mapping = {}
    axes = ["D", "I", "R"]

    for cluster_idx in range(len(centroids)):
        c = centroids[cluster_idx]
        d, i, r = c[0], c[1], c[2]
        scores = [("D", d), ("I", i), ("R", r)]
        scores.sort(key=lambda x: x[1], reverse=True)
        primary = scores[0][0]
        secondary = scores[1][0]
        comp = f"{primary}({secondary})"
        mapping[cluster_idx] = comp

    return mapping


def map_clusters_to_regimes_3(centroids: np.ndarray) -> dict[int, str]:
    """Map 3 clusters to D/I/R regimes."""
    mapping = {}
    used = set()
    axes = ["D", "I", "R"]

    scores = []
    for ci in range(3):
        for ai, ax in enumerate(axes):
            scores.append((centroids[ci][ai], ci, ax))
    scores.sort(reverse=True)

    for _, ci, ax in scores:
        if ci not in mapping and ax not in used:
            mapping[ci] = ax
            used.add(ax)
        if len(mapping) == 3:
            break
    return mapping


def compute_transition_matrix(labels: np.ndarray, label_names: list[str]) -> dict:
    """Compute transition matrix from label sequence."""
    n_labels = len(label_names)
    matrix = np.zeros((n_labels, n_labels), dtype=int)
    name_to_idx = {n: i for i, n in enumerate(label_names)}

    for t in range(1, len(labels)):
        if labels[t] != labels[t-1]:
            fr = name_to_idx.get(labels[t-1])
            to = name_to_idx.get(labels[t])
            if fr is not None and to is not None:
                matrix[fr][to] += 1

    return {
        "matrix": matrix,
        "labels": label_names,
        "total_transitions": int(matrix.sum()),
    }


def test_langevin_adjacency(trans_matrix: np.ndarray, label_names: list[str]) -> dict:
    """Test whether shared-operator transitions occur more frequently."""
    adjacent_count = 0
    non_adjacent_count = 0
    adjacent_pairs_found = []
    non_adjacent_pairs_found = []

    for i, name_i in enumerate(label_names):
        for j, name_j in enumerate(label_names):
            if i == j:
                continue
            count = trans_matrix[i][j]
            if (name_i, name_j) in ADJACENT_PAIRS:
                adjacent_count += count
                if count > 0:
                    adjacent_pairs_found.append((name_i, name_j, int(count)))
            else:
                non_adjacent_count += count
                if count > 0:
                    non_adjacent_pairs_found.append((name_i, name_j, int(count)))

    n_adjacent_pairs = sum(1 for i, ni in enumerate(label_names)
                           for j, nj in enumerate(label_names)
                           if i != j and (ni, nj) in ADJACENT_PAIRS)
    n_non_adjacent = sum(1 for i, ni in enumerate(label_names)
                         for j, nj in enumerate(label_names)
                         if i != j and (ni, nj) not in ADJACENT_PAIRS)

    avg_adjacent = adjacent_count / max(n_adjacent_pairs, 1)
    avg_non_adjacent = non_adjacent_count / max(n_non_adjacent, 1)

    return {
        "adjacent_total": int(adjacent_count),
        "non_adjacent_total": int(non_adjacent_count),
        "avg_per_adjacent_pair": float(avg_adjacent),
        "avg_per_non_adjacent_pair": float(avg_non_adjacent),
        "langevin_confirmed": avg_adjacent > avg_non_adjacent,
        "ratio": float(avg_adjacent / max(avg_non_adjacent, 0.01)),
    }


def compute_regime_durations(labels: np.ndarray, label_names: list[str]) -> dict:
    """Compute median duration per composition/regime."""
    durations = defaultdict(list)
    current = labels[0]
    count = 1
    for i in range(1, len(labels)):
        if labels[i] == current:
            count += 1
        else:
            durations[current].append(count)
            current = labels[i]
            count = 1
    durations[current].append(count)

    result = {}
    for name in label_names:
        d = durations.get(name, [0])
        result[name] = {
            "median": float(np.median(d)),
            "mean": float(np.mean(d)),
            "max": int(np.max(d)) if d else 0,
            "episodes": len(d),
        }
    return result


def revalidate_k9(df: pd.DataFrame, windows: list[int],
                  k_values: list[int]) -> dict:
    """Task 2: Full K=9 revalidation across window sizes."""
    print("\n" + "=" * 70)
    print("  TASK 2: K=9 Revalidation with Extended Data")
    print("=" * 70)

    results = {"windows": {}, "decision": None}
    best_k9_window = None
    best_k9_sil = -1

    for window in windows:
        print(f"\n{'='*60}")
        print(f"  Window = {window}h")
        print(f"{'='*60}")

        vectors = compute_features_for_window(df, window)
        warmup = 3 * window
        vec_valid = vectors.iloc[warmup:]
        magnitudes = np.sqrt((vec_valid ** 2).sum(axis=1))
        mask = magnitudes > 0.001
        vec_clean = vec_valid[mask].values
        print(f"  Valid vectors: {len(vec_clean)}")

        # Run clustering
        cluster_results = run_clustering(vec_clean, k_values)

        # Find best K
        sils = {k: cr["silhouette"] for k, cr in cluster_results.items()}
        best_k = max(sils, key=sils.get)
        k9_sil = sils.get(9, 0)
        best_sil = sils[best_k]

        k9_competitive = (best_k == 9) or (best_sil - k9_sil <= 0.02)

        print(f"\n  Best K: {best_k} (silhouette={best_sil:.4f})")
        print(f"  K=9 silhouette: {k9_sil:.4f}")
        print(f"  K=9 competitive (within 0.02 of best): {k9_competitive}")

        window_result = {
            "silhouette_scores": sils,
            "best_k": best_k,
            "best_silhouette": best_sil,
            "k9_silhouette": k9_sil,
            "k9_competitive": k9_competitive,
            "n_vectors": len(vec_clean),
        }

        # If K=9 competitive, do composition mapping
        if k9_competitive and 9 in cluster_results:
            k9_data = cluster_results[9]
            comp_mapping = map_clusters_to_compositions_9(k9_data["centroids"])
            comp_labels = np.array([comp_mapping[l] for l in k9_data["labels"]])
            unique_comps = set(comp_labels)

            print(f"\n  Composition mapping:")
            for ci in sorted(comp_mapping):
                print(f"    Cluster {ci} -> {comp_mapping[ci]}")
            print(f"  Unique compositions found: {len(unique_comps)} / 9")
            print(f"  Missing: {set(COMPOSITIONS_9) - unique_comps}")

            # Transition matrix
            trans = compute_transition_matrix(comp_labels, COMPOSITIONS_9)
            window_result["transition_matrix"] = trans["matrix"].tolist()

            # Langevin adjacency test
            langevin = test_langevin_adjacency(trans["matrix"], COMPOSITIONS_9)
            window_result["langevin_test"] = langevin
            print(f"\n  Langevin adjacency test:")
            print(f"    Adjacent transitions (avg/pair): {langevin['avg_per_adjacent_pair']:.2f}")
            print(f"    Non-adjacent (avg/pair): {langevin['avg_per_non_adjacent_pair']:.2f}")
            print(f"    Ratio: {langevin['ratio']:.2f}x")
            print(f"    Confirmed: {langevin['langevin_confirmed']}")

            # Regime durations
            durations = compute_regime_durations(comp_labels, COMPOSITIONS_9)
            window_result["composition_durations"] = durations

            # All 9 found?
            window_result["all_9_found"] = len(unique_comps) == 9
            window_result["compositions_found"] = list(unique_comps)
            window_result["composition_mapping"] = comp_mapping

            # Save centroids
            window_result["centroids_k9"] = k9_data["centroids"].tolist()

        # Also compute K=3 mapping for baseline
        if 3 in cluster_results:
            k3_data = cluster_results[3]
            regime_mapping = map_clusters_to_regimes_3(k3_data["centroids"])
            regime_labels = np.array([regime_mapping[l] for l in k3_data["labels"]])
            window_result["k3_regime_mapping"] = regime_mapping
            window_result["k3_centroids"] = k3_data["centroids"].tolist()

        results["windows"][window] = window_result

        if k9_sil > best_k9_sil:
            best_k9_sil = k9_sil
            best_k9_window = window

    # Decision gate
    best_window_data = results["windows"][best_k9_window]
    k9_competitive_any = any(
        wd.get("k9_competitive", False) for wd in results["windows"].values()
    )

    if k9_competitive_any:
        results["decision"] = "K9_CONFIRMED"
        results["best_window"] = best_k9_window
        results["detail"] = (
            f"K=9 is competitive at window={best_k9_window}h "
            f"(silhouette={best_k9_sil:.4f}). Building both 3-regime and 9-composition strategies."
        )
        # Save centroids
        if "centroids_k9" in best_window_data:
            centroids_path = DATA_DIR / "centroids_k9_extended.json"
            with open(centroids_path, "w") as f:
                json.dump({
                    "window": best_k9_window,
                    "centroids": best_window_data["centroids_k9"],
                    "composition_mapping": best_window_data.get("composition_mapping", {}),
                }, f, indent=2)
            print(f"\n  Saved K=9 centroids to {centroids_path}")
    else:
        results["decision"] = "K3_FALLBACK"
        results["best_window"] = best_k9_window
        results["detail"] = (
            f"K=9 not competitive. Falling back to K=3."
        )

    print(f"\n  DECISION: {results['decision']}")
    print(f"  {results['detail']}")

    return results


# ============================================================================
# Task 3: Strategy Variants
# ============================================================================

class BaseStrategy:
    """Base class with common utilities."""
    def precompute(self, data: pd.DataFrame) -> None:
        pass
    def reset(self):
        pass


# --- Baselines ---

class BuyAndHoldStrategy(BaseStrategy):
    def __init__(self):
        self._entered = False
    def name(self) -> str:
        return "Buy-and-Hold"
    def reset(self):
        self._entered = False
    def on_bar(self, idx: int, row: pd.Series, history: pd.DataFrame) -> Signal:
        if not self._entered and idx >= 1:
            self._entered = True
            return Signal(action="buy", size=0.95, reason="bh_entry")
        return Signal(action="hold")


class MACrossoverStrategy(BaseStrategy):
    def __init__(self, fast=50, slow=200):
        self.fast, self.slow = fast, slow
        self._in_pos = False
        self._ma_f = self._ma_s = None
    def name(self) -> str:
        return f"MA-Cross-{self.fast}/{self.slow}"
    def reset(self):
        self._in_pos = False
        self._ma_f = self._ma_s = None
    def precompute(self, data: pd.DataFrame):
        c = data["close"]
        self._ma_f = c.rolling(self.fast, min_periods=1).mean()
        self._ma_s = c.rolling(self.slow, min_periods=1).mean()
    def on_bar(self, idx, row, history) -> Signal:
        if idx < self.slow:
            return Signal(action="hold", reason="warmup")
        mf, ms = float(self._ma_f.iloc[idx]), float(self._ma_s.iloc[idx])
        mf_p, ms_p = float(self._ma_f.iloc[idx-1]), float(self._ma_s.iloc[idx-1])
        if not self._in_pos and mf > ms and mf_p <= ms_p:
            self._in_pos = True
            return Signal(action="buy", size=0.9, reason="golden_cross", trailing_stop_pct=0.05)
        if self._in_pos and mf < ms and mf_p >= ms_p:
            self._in_pos = False
            return Signal(action="sell", reason="death_cross")
        return Signal(action="hold")


class StaticTrendFollowStrategy(BaseStrategy):
    def __init__(self):
        self._in_pos = False
        self._bars = 0
        self._ma_f = self._ma_s = self._rsi = None
    def name(self) -> str:
        return "Static-Trend-Follow"
    def reset(self):
        self._in_pos = False
        self._bars = 0
    def precompute(self, data):
        c = data["close"]
        self._ma_f = c.rolling(20, min_periods=1).mean()
        self._ma_s = c.rolling(50, min_periods=1).mean()
        delta = c.diff()
        gain = delta.clip(lower=0).rolling(14, min_periods=1).mean()
        loss = (-delta.clip(upper=0)).rolling(14, min_periods=1).mean()
        rs = gain / loss.replace(0, np.nan)
        self._rsi = (100 - 100 / (1 + rs)).fillna(50)
    def on_bar(self, idx, row, history) -> Signal:
        if idx < 50:
            return Signal(action="hold", reason="warmup")
        c = row["close"]
        mf = float(self._ma_f.iloc[idx])
        ms = float(self._ma_s.iloc[idx])
        rsi = float(self._rsi.iloc[idx])
        if self._in_pos:
            self._bars += 1
            if mf < ms and self._bars > 6:
                self._in_pos = False
                return Signal(action="sell", reason="ma_exit")
            return Signal(action="hold")
        else:
            if c > mf and mf > ms and rsi < 70 and len(history) >= 48:
                rh = history["high"].iloc[-48:].max()
                if c >= rh * 0.97:
                    self._in_pos = True
                    self._bars = 0
                    return Signal(action="buy", size=0.9, reason="trend_breakout", trailing_stop_pct=0.06)
            return Signal(action="hold")


class StaticMeanRevertStrategy(BaseStrategy):
    def __init__(self):
        self._in_pos = False
        self._bars = 0
        self._ma_s = self._rsi = None
    def name(self) -> str:
        return "Static-Mean-Revert"
    def reset(self):
        self._in_pos = False
        self._bars = 0
    def precompute(self, data):
        c = data["close"]
        self._ma_s = c.rolling(50, min_periods=1).mean()
        delta = c.diff()
        gain = delta.clip(lower=0).rolling(14, min_periods=1).mean()
        loss = (-delta.clip(upper=0)).rolling(14, min_periods=1).mean()
        rs = gain / loss.replace(0, np.nan)
        self._rsi = (100 - 100 / (1 + rs)).fillna(50)
    def on_bar(self, idx, row, history) -> Signal:
        if idx < 50:
            return Signal(action="hold", reason="warmup")
        c = row["close"]
        ms = float(self._ma_s.iloc[idx])
        rsi = float(self._rsi.iloc[idx])
        if self._in_pos:
            self._bars += 1
            if rsi > 55 or c > ms * 1.01:
                self._in_pos = False
                return Signal(action="sell", reason="mr_target")
            return Signal(action="hold")
        else:
            if rsi < 35 and c < ms:
                self._in_pos = True
                self._bars = 0
                return Signal(action="buy", size=0.7, reason="oversold", trailing_stop_pct=0.03)
            return Signal(action="hold")


class OriginalDIRRegimeStrategy(BaseStrategy):
    """Phase C original: long in D+I, flat in R."""
    def __init__(self):
        self._in_pos = False
        self._entry_regime = None
        self._consecutive_r = 0
        self._consecutive_non_r = 0
        self._rsi = None
        self.r_exit_grace = 36
        self.r_reentry_grace = 6
    def name(self) -> str:
        return "DIR-Original"
    def reset(self):
        self._in_pos = False
        self._entry_regime = None
        self._consecutive_r = 0
        self._consecutive_non_r = 0
    def precompute(self, data):
        c = data["close"]
        delta = c.diff()
        gain = delta.clip(lower=0).rolling(14, min_periods=1).mean()
        loss = (-delta.clip(upper=0)).rolling(14, min_periods=1).mean()
        rs = gain / loss.replace(0, np.nan)
        self._rsi = (100 - 100 / (1 + rs)).fillna(50)
    def on_bar(self, idx, row, history) -> Signal:
        regime = row.get("regime", "I")
        conf = float(row.get("confidence", 0.5))
        rsi = float(self._rsi.iloc[idx]) if self._rsi is not None else 50
        if regime == "R":
            self._consecutive_r += 1
            self._consecutive_non_r = 0
        else:
            self._consecutive_r = 0
            self._consecutive_non_r += 1
        if self._in_pos:
            if self._consecutive_r >= self.r_exit_grace:
                self._in_pos = False
                return Signal(action="sell", reason="confirmed_R")
            if conf < 0.03:
                self._in_pos = False
                return Signal(action="sell", reason="conf_collapse")
            if regime in ("D", "I") and regime != self._entry_regime:
                self._entry_regime = regime
            return Signal(action="hold")
        else:
            if idx < 50:
                return Signal(action="hold")
            if regime == "R":
                return Signal(action="hold")
            if self._consecutive_non_r < self.r_reentry_grace:
                return Signal(action="hold")
            if rsi > 80:
                return Signal(action="hold")
            mult = {"D": 1.0, "I": 0.6}.get(regime, 0)
            size = 0.9 * max(conf, 0.15) * mult
            size = max(0.1, min(size, 0.95))
            self._in_pos = True
            self._entry_regime = regime
            return Signal(action="buy", size=size, reason=f"{regime}_entry")


# --- 3-Regime Strategies ---

class ThreeR1_DOnlyConservative(BaseStrategy):
    """3R-1: ONLY long in D-regime (conf > 0.5), exit on R, flat in I/R."""
    def __init__(self):
        self._in_pos = False
    def name(self) -> str:
        return "3R-1-D-Only-Conservative"
    def reset(self):
        self._in_pos = False
    def on_bar(self, idx, row, history) -> Signal:
        if idx < 50:
            return Signal(action="hold")
        regime = row.get("regime", "I")
        conf = float(row.get("confidence", 0.5))
        if self._in_pos:
            if regime == "R" or regime == "I":
                self._in_pos = False
                return Signal(action="sell", reason=f"exit_{regime}")
            return Signal(action="hold")
        else:
            if regime == "D" and conf > 0.5:
                size = 0.9 * conf
                self._in_pos = True
                return Signal(action="buy", size=min(size, 0.95), reason="D_entry")
            return Signal(action="hold")


class ThreeR2_DOnlyScaledEntry(BaseStrategy):
    """3R-2: Scaled entry in D-regime. 30% on D detection, add on sustained D."""
    def __init__(self):
        self._position_level = 0  # 0, 1, 2, 3
        self._d_bars = 0
        self._rising_conf_bars = 0
        self._prev_conf = 0
    def name(self) -> str:
        return "3R-2-D-Scaled-Entry"
    def reset(self):
        self._position_level = 0
        self._d_bars = 0
        self._rising_conf_bars = 0
        self._prev_conf = 0
    def on_bar(self, idx, row, history) -> Signal:
        if idx < 50:
            return Signal(action="hold")
        regime = row.get("regime", "I")
        conf = float(row.get("confidence", 0.5))

        if regime == "D":
            self._d_bars += 1
            if conf > self._prev_conf:
                self._rising_conf_bars += 1
        else:
            self._d_bars = 0
            self._rising_conf_bars = 0

        self._prev_conf = conf

        if self._position_level > 0 and regime == "R":
            self._position_level = 0
            return Signal(action="sell", reason="R_exit_all")

        if regime == "D":
            if self._position_level == 0 and conf > 0.4:
                self._position_level = 1
                return Signal(action="buy", size=0.30, reason="D_initial_30pct")
            # Note: engine doesn't support adding to positions, so we treat
            # higher levels as hold decisions (the initial entry captures it)

        return Signal(action="hold")


class ThreeR3_DOnlyMultiTimeframe(BaseStrategy):
    """3R-3: Multi-timeframe. Enter when 1h AND 4h agree on D."""
    def __init__(self):
        self._in_pos = False
    def name(self) -> str:
        return "3R-3-D-MultiTF"
    def reset(self):
        self._in_pos = False
    def precompute(self, data):
        # Compute 4h regime by resampling
        # Use 4-bar rolling majority for the 4h regime
        if "regime" in data.columns:
            regime_numeric = data["regime"].map({"D": 0, "I": 1, "R": 2})
            self._regime_4h = regime_numeric.rolling(4, min_periods=1).apply(
                lambda x: pd.Series(x).mode().iloc[0] if len(x) > 0 else 1, raw=False
            )
            self._regime_4h_map = {0: "D", 1: "I", 2: "R"}
    def on_bar(self, idx, row, history) -> Signal:
        if idx < 50:
            return Signal(action="hold")
        regime_1h = row.get("regime", "I")
        conf = float(row.get("confidence", 0.5))

        if hasattr(self, "_regime_4h") and self._regime_4h is not None:
            r4h_num = int(self._regime_4h.iloc[idx]) if idx < len(self._regime_4h) else 1
            regime_4h = self._regime_4h_map.get(r4h_num, "I")
        else:
            regime_4h = regime_1h

        if self._in_pos:
            if regime_1h == "R" or regime_4h == "R":
                self._in_pos = False
                return Signal(action="sell", reason="R_either_tf")
            return Signal(action="hold")
        else:
            if regime_1h == "D" and regime_4h == "D" and conf > 0.4:
                self._in_pos = True
                return Signal(action="buy", size=0.85, reason="D_both_tf")
            return Signal(action="hold")


# --- 9-Composition Strategies ---

class NineC1_EnneagramConservative(BaseStrategy):
    """9C-1: Long only on D-primary compositions, exit on R-primary."""
    def __init__(self):
        self._in_pos = False
    def name(self) -> str:
        return "9C-1-Ennea-Conservative"
    def reset(self):
        self._in_pos = False
    def on_bar(self, idx, row, history) -> Signal:
        if idx < 50:
            return Signal(action="hold")
        comp = row.get("composition", "I(I)")
        conf = float(row.get("confidence", 0.5))
        barrier = float(row.get("barrier_distance", 0.5))

        d_primary = comp.startswith("D")
        r_primary = comp.startswith("R")
        i_primary = comp.startswith("I")

        if self._in_pos:
            if r_primary:
                self._in_pos = False
                return Signal(action="sell", reason=f"R_primary_{comp}")
            return Signal(action="hold")
        else:
            if d_primary and conf > 0.3:
                size = 0.85 * conf * (0.5 + 0.5 * barrier)
                self._in_pos = True
                return Signal(action="buy", size=max(0.1, min(size, 0.95)),
                              reason=f"D_primary_{comp}")
            return Signal(action="hold")


class NineC2_EnneagramFullMap(BaseStrategy):
    """9C-2: Full 9-composition strategy with per-composition logic."""
    def __init__(self):
        self._in_pos = False
        self._entry_comp = None
        self._bars = 0
        self._rsi = None
        self._ma20 = None
        self._ma50 = None
    def name(self) -> str:
        return "9C-2-Ennea-Full-Map"
    def reset(self):
        self._in_pos = False
        self._entry_comp = None
        self._bars = 0
    def precompute(self, data):
        c = data["close"]
        self._ma20 = c.rolling(20, min_periods=1).mean()
        self._ma50 = c.rolling(50, min_periods=1).mean()
        delta = c.diff()
        gain = delta.clip(lower=0).rolling(14, min_periods=1).mean()
        loss = (-delta.clip(upper=0)).rolling(14, min_periods=1).mean()
        rs = gain / loss.replace(0, np.nan)
        self._rsi = (100 - 100 / (1 + rs)).fillna(50)

    # Composition multipliers
    COMP_MULT = {
        "D(D)": 1.0, "D(I)": 0.8, "D(R)": 0.7,
        "I(D)": 0.3, "I(I)": 0.0, "I(R)": 0.2,
        "R(D)": 0.4, "R(I)": 0.1, "R(R)": 0.0,
    }

    def on_bar(self, idx, row, history) -> Signal:
        if idx < 50:
            return Signal(action="hold")
        comp = row.get("composition", "I(I)")
        conf = float(row.get("confidence", 0.5))
        rsi = float(self._rsi.iloc[idx]) if self._rsi is not None else 50
        c = row["close"]
        ma20 = float(self._ma20.iloc[idx]) if self._ma20 is not None else c
        ma50 = float(self._ma50.iloc[idx]) if self._ma50 is not None else c
        mult = self.COMP_MULT.get(comp, 0.0)

        if self._in_pos:
            self._bars += 1
            # Exit logic per composition type
            if comp in ("R(R)", "I(I)"):
                self._in_pos = False
                return Signal(action="sell", reason=f"defensive_exit_{comp}")
            if comp.startswith("R") and self._bars > 12:
                self._in_pos = False
                return Signal(action="sell", reason=f"R_primary_exit")
            # Trailing logic for D(D) - wide stop, let it run
            if self._entry_comp == "D(D)" and rsi > 85 and self._bars > 48:
                self._in_pos = False
                return Signal(action="sell", reason="DD_overbought")
            # D(I) - defined target
            if self._entry_comp == "D(I)" and c > ma50 * 1.03:
                self._in_pos = False
                return Signal(action="sell", reason="DI_target")
            # D(R) - momentum trailing
            if self._entry_comp == "D(R)" and c < ma20:
                self._in_pos = False
                return Signal(action="sell", reason="DR_trail_exit")
            return Signal(action="hold")
        else:
            if mult > 0.05 and conf > 0.3:
                # Entry conditions per composition
                enter = False
                if comp == "D(D)" and c > ma20 and ma20 > ma50:
                    enter = True
                elif comp == "D(I)" and c > ma50 and rsi < 65:
                    enter = True
                elif comp == "D(R)" and rsi > 55 and c > ma20:
                    enter = True
                elif comp == "I(D)" and c < ma50 and rsi < 40:
                    enter = True
                elif comp == "I(R)" and rsi < 30:
                    enter = True
                elif comp == "R(D)" and c > ma20 and rsi < 60:
                    enter = True

                if enter:
                    size = 0.85 * conf * mult
                    self._in_pos = True
                    self._entry_comp = comp
                    self._bars = 0
                    return Signal(action="buy", size=max(0.1, min(size, 0.95)),
                                  reason=f"enter_{comp}")
            return Signal(action="hold")


class NineC3_BarrierAwareTransition(BaseStrategy):
    """9C-3: Barrier-aware transition trading. Monitor transition scores."""
    def __init__(self):
        self._in_pos = False
        self._prev_conf = 0.5
        self._prev_entropy = 0.0
        self._conf_trend = []
    def name(self) -> str:
        return "9C-3-Barrier-Transition"
    def reset(self):
        self._in_pos = False
        self._prev_conf = 0.5
        self._prev_entropy = 0.0
        self._conf_trend = []
    def on_bar(self, idx, row, history) -> Signal:
        if idx < 50:
            return Signal(action="hold")
        comp = row.get("composition", "I(I)")
        conf = float(row.get("confidence", 0.5))
        entropy = float(row.get("entropy", 0.0))

        # Transition score: confidence drop + entropy rise
        conf_drop = self._prev_conf - conf
        entropy_rise = entropy - self._prev_entropy
        transition_score = max(0, conf_drop) + max(0, entropy_rise)
        self._prev_conf = conf
        self._prev_entropy = entropy

        self._conf_trend.append(conf)
        if len(self._conf_trend) > 24:
            self._conf_trend = self._conf_trend[-24:]
        conf_slope = 0
        if len(self._conf_trend) >= 6:
            recent = self._conf_trend[-6:]
            conf_slope = recent[-1] - recent[0]

        d_primary = comp.startswith("D")
        r_primary = comp.startswith("R")

        if self._in_pos:
            # Early exit on D->R crossing signal
            if transition_score > 0.15 and not d_primary:
                self._in_pos = False
                return Signal(action="sell", reason="barrier_crossing_exit")
            if r_primary and conf > 0.5:
                self._in_pos = False
                return Signal(action="sell", reason="R_confirmed")
            return Signal(action="hold")
        else:
            # Early entry on R->D crossing signal
            if d_primary and conf_slope > 0.05 and conf > 0.3:
                self._in_pos = True
                return Signal(action="buy", size=0.8, reason="early_D_entry")
            if d_primary and conf > 0.5:
                self._in_pos = True
                return Signal(action="buy", size=0.85, reason="D_confirmed_entry")
            return Signal(action="hold")


# ============================================================================
# Task 4: Walk-Forward Backtest
# ============================================================================

def assign_labels_from_vectors(df: pd.DataFrame, vectors: pd.DataFrame,
                               km_model, cluster_to_label: dict,
                               warmup: int, label_col: str = "regime",
                               is_9comp: bool = False) -> pd.DataFrame:
    """Assign regime/composition labels using pre-computed vectors and fitted centroids."""
    result = df.copy()
    result[label_col] = "I" if not is_9comp else "I(I)"
    result["confidence"] = 0.5
    result["entropy"] = 0.0
    result["barrier_distance"] = 0.5

    # Align vectors to df index
    common_idx = df.index.intersection(vectors.index)
    if len(common_idx) == 0:
        return result

    vec_aligned = vectors.loc[common_idx]
    magnitudes = np.sqrt((vec_aligned ** 2).sum(axis=1))
    mask = magnitudes > 0.001
    X = vec_aligned[mask].values

    if len(X) == 0:
        return result

    centroids = km_model.cluster_centers_
    k = len(centroids)

    # Compute distances
    dists = cdist(X, centroids)
    nearest_idx = dists.argmin(axis=1)
    sorted_dists = np.sort(dists, axis=1)
    nearest_dist = sorted_dists[:, 0]
    second_dist = sorted_dists[:, 1]

    # Confidence
    with np.errstate(divide="ignore", invalid="ignore"):
        confidence = 1.0 - nearest_dist / np.where(second_dist > 0, second_dist, 1.0)
    confidence = np.clip(confidence, 0, 1)

    # Entropy via softmax
    neg_dists = -dists
    exp_neg = np.exp(neg_dists - neg_dists.max(axis=1, keepdims=True))
    probs = exp_neg / exp_neg.sum(axis=1, keepdims=True)
    with np.errstate(divide="ignore"):
        log_p = np.where(probs > 1e-12, np.log2(probs), 0)
    entropy = -(probs * log_p).sum(axis=1)

    # Barrier distance
    barrier = second_dist / np.where(nearest_dist > 0, nearest_dist, 1.0)
    barrier = np.clip(barrier / 3.0, 0, 1)

    labels = np.array([cluster_to_label[idx] for idx in nearest_idx])

    valid_idx = vec_aligned[mask].index
    result.loc[valid_idx, label_col] = labels
    result.loc[valid_idx, "confidence"] = confidence
    result.loc[valid_idx, "entropy"] = entropy
    result.loc[valid_idx, "barrier_distance"] = barrier

    return result


def walk_forward_backtest(
    df: pd.DataFrame,
    vectors: pd.DataFrame,
    strategies: dict[str, BaseStrategy],
    window: int,
    train_years: int = 2,
    test_months: int = 6,
    k_value: int = 3,
    is_9comp: bool = False,
) -> dict:
    """
    Walk-forward backtest with retraining.
    Uses pre-computed vectors (features computed once on full dataset).
    Returns per-strategy aggregated metrics across all OOS windows.
    """
    train_bars = train_years * 365 * 24  # approximate
    test_bars = test_months * 30 * 24    # approximate
    step_bars = test_bars
    warmup = 3 * window

    all_results = {name: [] for name in strategies}
    window_info = []

    start = 0
    window_num = 0

    while start + train_bars + test_bars <= len(df):
        train_end = start + train_bars
        test_end = min(train_end + test_bars, len(df))

        train_data = df.iloc[start:train_end]
        test_data = df.iloc[train_end:test_end]

        if len(test_data) < 100:
            break

        window_num += 1
        train_start_date = train_data.index[0]
        train_end_date = train_data.index[-1]
        test_start_date = test_data.index[0]
        test_end_date = test_data.index[-1]

        print(f"\n  WF Window {window_num}: "
              f"Train {train_start_date.strftime('%Y-%m')} to {train_end_date.strftime('%Y-%m')} | "
              f"Test {test_start_date.strftime('%Y-%m')} to {test_end_date.strftime('%Y-%m')}")

        # Slice pre-computed vectors for training period
        train_vecs = vectors.loc[vectors.index.isin(train_data.index)]
        mags = np.sqrt((train_vecs ** 2).sum(axis=1))
        vec_clean = train_vecs[mags > 0.001].values

        if len(vec_clean) < k_value * 10:
            print(f"    Skipping window {window_num} - insufficient training data")
            start += step_bars
            continue

        km = KMeans(n_clusters=k_value, n_init=10, random_state=42, max_iter=500)
        km.fit(vec_clean)

        # Map clusters
        if is_9comp:
            cluster_map = map_clusters_to_compositions_9(km.cluster_centers_)
            label_col = "composition"
        else:
            cluster_map = map_clusters_to_regimes_3(km.cluster_centers_)
            label_col = "regime"

        # Assign labels to test data using pre-computed vectors
        test_vecs = vectors.loc[vectors.index.isin(test_data.index)]
        test_labelled = assign_labels_from_vectors(
            test_data, test_vecs, km, cluster_map, warmup,
            label_col=label_col, is_9comp=is_9comp
        )

        # For 9-comp strategies, also compute 3-regime labels
        if is_9comp:
            test_labelled["regime"] = test_labelled["composition"].str[0]
            # Also get K=3 confidence
            km3 = KMeans(n_clusters=3, n_init=10, random_state=42, max_iter=500)
            km3.fit(vec_clean)
            map3 = map_clusters_to_regimes_3(km3.cluster_centers_)
            test_3r = assign_labels_from_vectors(
                test_data, test_vecs, km3, map3, warmup,
                label_col="regime", is_9comp=False
            )
            test_labelled["regime"] = test_3r["regime"]

        # Run each strategy
        engine = BacktestEngine(initial_capital=10_000.0, commission_pct=0.001, slippage_pct=0.0005)

        btc_return = (test_data["close"].iloc[-1] / test_data["close"].iloc[0]) - 1

        winfo = {
            "window": window_num,
            "train_start": str(train_start_date),
            "train_end": str(train_end_date),
            "test_start": str(test_start_date),
            "test_end": str(test_end_date),
            "btc_return": float(btc_return),
        }
        window_info.append(winfo)

        for sname, strategy in strategies.items():
            strategy.reset()
            if hasattr(strategy, "precompute"):
                strategy.precompute(test_labelled)
            result = engine.run(strategy, test_labelled)
            m = result.metrics
            m["window"] = window_num
            m["test_start"] = str(test_start_date)
            m["test_end"] = str(test_end_date)
            m["btc_return"] = float(btc_return)

            # Time in market
            in_market_bars = sum(
                max(0, (t.exit_time - t.entry_time).total_seconds() / 3600)
                for t in result.trades if t.exit_time is not None
            )
            total_bars = len(test_data)
            m["time_in_market_pct"] = float(in_market_bars / max(total_bars, 1))
            m["return_per_time_in_market"] = (
                m["total_return"] / max(m["time_in_market_pct"], 0.01)
            )

            all_results[sname].append(m)
            print(f"    {sname:30s} | Ret={m['total_return']*100:+6.1f}%  "
                  f"Sharpe={m['sharpe_ratio']:+.2f}  DD={m['max_drawdown']*100:.1f}%  "
                  f"Trades={m['n_trades']:3d}")

        start += step_bars

    return {"strategy_results": all_results, "windows": window_info}


def aggregate_wf_metrics(wf_results: dict) -> dict:
    """Aggregate walk-forward results per strategy."""
    agg = {}
    for sname, window_metrics in wf_results["strategy_results"].items():
        if not window_metrics:
            agg[sname] = {"n_windows": 0}
            continue

        n = len(window_metrics)
        total_returns = [m["total_return"] for m in window_metrics]
        sharpes = [m["sharpe_ratio"] for m in window_metrics]
        max_dds = [m["max_drawdown"] for m in window_metrics]
        trades = [m["n_trades"] for m in window_metrics]
        win_rates = [m["win_rate"] for m in window_metrics if m["n_trades"] > 0]
        profit_factors = [m["profit_factor"] for m in window_metrics
                          if m["n_trades"] > 0 and np.isfinite(m["profit_factor"])]
        time_in_market = [m.get("time_in_market_pct", 0) for m in window_metrics]

        # Compounded return
        compounded = 1.0
        for r in total_returns:
            compounded *= (1 + r)
        compounded_return = compounded - 1

        agg[sname] = {
            "n_windows": n,
            "compounded_return": float(compounded_return),
            "mean_return": float(np.mean(total_returns)),
            "median_return": float(np.median(total_returns)),
            "mean_sharpe": float(np.mean(sharpes)),
            "median_sharpe": float(np.median(sharpes)),
            "worst_drawdown": float(min(max_dds)),
            "mean_drawdown": float(np.mean(max_dds)),
            "total_trades": int(sum(trades)),
            "mean_trades_per_window": float(np.mean(trades)),
            "mean_win_rate": float(np.mean(win_rates)) if win_rates else 0,
            "mean_profit_factor": float(np.mean(profit_factors)) if profit_factors else 0,
            "mean_time_in_market": float(np.mean(time_in_market)),
            "per_window": window_metrics,
        }
    return agg


# ============================================================================
# Task 5: Charts
# ============================================================================

def generate_charts(df: pd.DataFrame, agg_3r: dict, agg_9c: dict,
                    wf_3r: dict, wf_9c: dict,
                    phase_a2: dict, k9_confirmed: bool):
    """Generate all charts."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import matplotlib.dates as mdates
    from matplotlib.patches import Patch
    from matplotlib.colors import LinearSegmentedColormap

    CHARTS_DIR.mkdir(parents=True, exist_ok=True)

    # --- Chart 1: Equity curves overlaid ---
    print("\n[CHART 1] Equity curves...")
    fig, ax = plt.subplots(figsize=(18, 10))
    all_agg = {**agg_3r}
    if k9_confirmed:
        all_agg.update(agg_9c)

    colors = plt.cm.tab20(np.linspace(0, 1, len(all_agg)))
    for i, (sname, metrics) in enumerate(all_agg.items()):
        if metrics["n_windows"] == 0:
            continue
        # Build compounded equity from per-window returns
        eq = [10000.0]
        for wm in metrics.get("per_window", []):
            eq.append(eq[-1] * (1 + wm["total_return"]))
        ax.plot(range(len(eq)), eq, label=f"{sname} ({metrics['compounded_return']*100:+.1f}%)",
                color=colors[i], linewidth=1.5 if "DIR" in sname or "9C" in sname or "3R" in sname else 0.8)
    ax.set_xlabel("Walk-Forward Window")
    ax.set_ylabel("Equity ($)")
    ax.set_title("Phase C-2: Walk-Forward Equity Curves (All Strategies)")
    ax.legend(loc="best", fontsize=7, ncol=2)
    ax.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(CHARTS_DIR / "01_equity_curves.png", dpi=150)
    plt.close()
    print(f"  Saved {CHARTS_DIR / '01_equity_curves.png'}")

    # --- Chart 2: Drawdown comparison ---
    print("[CHART 2] Drawdown comparison...")
    fig, ax = plt.subplots(figsize=(14, 8))
    names = list(all_agg.keys())
    worst_dds = [all_agg[n]["worst_drawdown"] * 100 for n in names if all_agg[n]["n_windows"] > 0]
    mean_dds = [all_agg[n]["mean_drawdown"] * 100 for n in names if all_agg[n]["n_windows"] > 0]
    valid_names = [n for n in names if all_agg[n]["n_windows"] > 0]
    x = np.arange(len(valid_names))
    w = 0.35
    ax.bar(x - w/2, worst_dds, w, label="Worst DD", color="#e74c3c", alpha=0.7)
    ax.bar(x + w/2, mean_dds, w, label="Mean DD", color="#f39c12", alpha=0.7)
    ax.set_xticks(x)
    ax.set_xticklabels(valid_names, rotation=45, ha="right", fontsize=7)
    ax.set_ylabel("Drawdown (%)")
    ax.set_title("Walk-Forward Drawdown Comparison")
    ax.legend()
    ax.grid(True, alpha=0.3, axis="y")
    plt.tight_layout()
    plt.savefig(CHARTS_DIR / "02_drawdown_comparison.png", dpi=150)
    plt.close()
    print(f"  Saved {CHARTS_DIR / '02_drawdown_comparison.png'}")

    # --- Chart 3: Regime-coloured BTC price chart ---
    print("[CHART 3] Regime-coloured price chart...")
    # Use K=3 clustering on full data for visualization
    best_window = phase_a2.get("best_window", 72)
    features = compute_all_features(df, best_window)
    features = features.fillna(0.0)
    vectors = vectorize_pipeline(features)
    warmup = 3 * best_window
    vec_valid = vectors.iloc[warmup:]
    mags = np.sqrt((vec_valid ** 2).sum(axis=1))
    vec_clean = vec_valid[mags > 0.001]

    km3 = KMeans(n_clusters=3, n_init=10, random_state=42)
    km3.fit(vec_clean.values)
    cluster_map_3 = map_clusters_to_regimes_3(km3.cluster_centers_)
    labels_3 = np.array([cluster_map_3[l] for l in km3.predict(vec_clean.values)])

    regime_colors = {"D": "#e74c3c", "I": "#3498db", "R": "#f39c12"}
    fig, ax = plt.subplots(figsize=(24, 8))
    price = df["close"].iloc[warmup:]
    price_valid = price.loc[vec_clean.index]
    ax.plot(price_valid.index, price_valid.values, color="black", linewidth=0.3, alpha=0.8)

    for idx_i in range(len(vec_clean) - 1):
        regime = labels_3[idx_i]
        ax.axvspan(vec_clean.index[idx_i], vec_clean.index[idx_i + 1],
                   alpha=0.08, color=regime_colors[regime], linewidth=0)

    ax.set_yscale("log")
    ax.set_ylabel("BTC/USDT (log)")
    ax.set_title(f"BTC Full History — D/I/R Regime Classification (W={best_window}h, K=3)")
    legend_elements = [
        Patch(facecolor=regime_colors["D"], alpha=0.4, label="D — Trending"),
        Patch(facecolor=regime_colors["I"], alpha=0.4, label="I — Consolidation"),
        Patch(facecolor=regime_colors["R"], alpha=0.4, label="R — Volatile"),
    ]
    ax.legend(handles=legend_elements, loc="upper left")
    ax.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(CHARTS_DIR / "03_regime_price_full.png", dpi=150)
    plt.close()
    print(f"  Saved {CHARTS_DIR / '03_regime_price_full.png'}")

    # --- Chart 4: Trade entry/exit markers for D-only strategies ---
    print("[CHART 4] Skipping trade markers (requires per-trade data from WF)...")

    # --- Chart 5: Monthly returns heatmap ---
    print("[CHART 5] Monthly returns heatmap...")
    strats_to_heatmap = {k: v for k, v in all_agg.items()
                         if v["n_windows"] > 0 and v.get("per_window")}
    if strats_to_heatmap:
        fig, ax = plt.subplots(figsize=(16, max(6, len(strats_to_heatmap) * 0.6)))
        heatmap_data = []
        hm_labels_y = []
        hm_labels_x = []
        for sname, metrics in strats_to_heatmap.items():
            returns = [m["total_return"] * 100 for m in metrics["per_window"]]
            heatmap_data.append(returns)
            hm_labels_y.append(sname)
            if not hm_labels_x:
                hm_labels_x = [f"W{m['window']}" for m in metrics["per_window"]]

        # Pad to same length
        max_len = max(len(r) for r in heatmap_data)
        for r in heatmap_data:
            while len(r) < max_len:
                r.append(0)

        data = np.array(heatmap_data)
        vmax = max(abs(data.min()), abs(data.max()), 10)
        im = ax.imshow(data, aspect="auto", cmap="RdYlGn", vmin=-vmax, vmax=vmax)
        ax.set_yticks(range(len(hm_labels_y)))
        ax.set_yticklabels(hm_labels_y, fontsize=7)
        ax.set_xticks(range(len(hm_labels_x)))
        ax.set_xticklabels(hm_labels_x, fontsize=8, rotation=45)
        ax.set_title("Walk-Forward Window Returns (%)")
        plt.colorbar(im, ax=ax, label="Return %")

        # Annotate cells
        for i in range(data.shape[0]):
            for j in range(data.shape[1]):
                ax.text(j, i, f"{data[i,j]:.1f}", ha="center", va="center", fontsize=6)

        plt.tight_layout()
        plt.savefig(CHARTS_DIR / "05_returns_heatmap.png", dpi=150)
        plt.close()
        print(f"  Saved {CHARTS_DIR / '05_returns_heatmap.png'}")

    # --- Chart 6: 9x9 transition matrix heatmap (if K=9) ---
    if k9_confirmed:
        print("[CHART 6] 9x9 transition matrix...")
        best_w = phase_a2.get("best_window", 72)
        wd = phase_a2["windows"].get(best_w, {})
        trans = wd.get("transition_matrix")
        if trans is not None:
            fig, ax = plt.subplots(figsize=(10, 8))
            trans_arr = np.array(trans)
            im = ax.imshow(trans_arr, cmap="YlOrRd")
            ax.set_xticks(range(9))
            ax.set_xticklabels(COMPOSITIONS_9, rotation=45, ha="right", fontsize=8)
            ax.set_yticks(range(9))
            ax.set_yticklabels(COMPOSITIONS_9, fontsize=8)
            ax.set_xlabel("To")
            ax.set_ylabel("From")
            ax.set_title("9-Composition Transition Matrix")
            plt.colorbar(im, ax=ax, label="Count")
            for i in range(9):
                for j in range(9):
                    if trans_arr[i, j] > 0:
                        ax.text(j, i, str(int(trans_arr[i, j])),
                                ha="center", va="center", fontsize=6)
            plt.tight_layout()
            plt.savefig(CHARTS_DIR / "06_transition_matrix_9x9.png", dpi=150)
            plt.close()
            print(f"  Saved {CHARTS_DIR / '06_transition_matrix_9x9.png'}")

    # --- Chart 7: Barrier height visualization ---
    if k9_confirmed:
        print("[CHART 7] Barrier heights...")
        best_w = phase_a2.get("best_window", 72)
        wd = phase_a2["windows"].get(best_w, {})
        centroids = wd.get("centroids_k9")
        if centroids is not None:
            centroids_arr = np.array(centroids)
            dist_matrix = cdist(centroids_arr, centroids_arr)
            fig, ax = plt.subplots(figsize=(10, 8))
            comp_labels = [wd.get("composition_mapping", {}).get(str(i), f"C{i}")
                           for i in range(len(centroids_arr))]
            im = ax.imshow(dist_matrix, cmap="viridis_r")
            ax.set_xticks(range(len(comp_labels)))
            ax.set_xticklabels(comp_labels, rotation=45, ha="right", fontsize=8)
            ax.set_yticks(range(len(comp_labels)))
            ax.set_yticklabels(comp_labels, fontsize=8)
            ax.set_title("Inter-Basin Distance (Barrier Height Proxy)")
            plt.colorbar(im, ax=ax, label="L2 Distance")
            for i in range(len(comp_labels)):
                for j in range(len(comp_labels)):
                    ax.text(j, i, f"{dist_matrix[i,j]:.2f}",
                            ha="center", va="center", fontsize=6,
                            color="white" if dist_matrix[i,j] < dist_matrix.mean() else "black")
            plt.tight_layout()
            plt.savefig(CHARTS_DIR / "07_barrier_heights.png", dpi=150)
            plt.close()
            print(f"  Saved {CHARTS_DIR / '07_barrier_heights.png'}")

    # --- Chart 8: Walk-forward window performance comparison ---
    print("[CHART 8] Walk-forward window performance...")
    fig, axes = plt.subplots(2, 1, figsize=(16, 10), sharex=True)

    # Returns per window
    ax = axes[0]
    for i, (sname, metrics) in enumerate(all_agg.items()):
        if metrics["n_windows"] == 0:
            continue
        returns = [m["total_return"] * 100 for m in metrics.get("per_window", [])]
        windows_x = [m["window"] for m in metrics.get("per_window", [])]
        ax.plot(windows_x, returns, marker="o", markersize=3,
                label=sname, color=colors[i % len(colors)], linewidth=1.2)
    ax.axhline(y=0, color="black", linestyle="--", alpha=0.5)
    ax.set_ylabel("Return (%)")
    ax.set_title("Walk-Forward Performance by Window")
    ax.legend(loc="best", fontsize=6, ncol=2)
    ax.grid(True, alpha=0.3)

    # Sharpe per window
    ax = axes[1]
    for i, (sname, metrics) in enumerate(all_agg.items()):
        if metrics["n_windows"] == 0:
            continue
        sharpes = [m["sharpe_ratio"] for m in metrics.get("per_window", [])]
        windows_x = [m["window"] for m in metrics.get("per_window", [])]
        ax.plot(windows_x, sharpes, marker="s", markersize=3,
                label=sname, color=colors[i % len(colors)], linewidth=1.2)
    ax.axhline(y=0, color="black", linestyle="--", alpha=0.5)
    ax.set_xlabel("Walk-Forward Window")
    ax.set_ylabel("Sharpe Ratio")
    ax.legend(loc="best", fontsize=6, ncol=2)
    ax.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig(CHARTS_DIR / "08_wf_performance.png", dpi=150)
    plt.close()
    print(f"  Saved {CHARTS_DIR / '08_wf_performance.png'}")


# ============================================================================
# Main
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description="Phase C-2: Extended Revalidation")
    parser.add_argument("--skip-download", action="store_true")
    parser.add_argument("--skip-features", action="store_true",
                        help="Skip feature recomputation, load cached vectors")
    args = parser.parse_args()

    print("=" * 70)
    print("  PHASE C-2: Extended Revalidation + Strategy Comparison")
    print("=" * 70)

    DATA_DIR.mkdir(exist_ok=True)
    CHARTS_DIR.mkdir(parents=True, exist_ok=True)

    # ---- Task 1: Load data ----
    print("\n" + "=" * 70)
    print("  TASK 1: Load Extended BTC Data")
    print("=" * 70)

    df = load_or_download_extended_data(skip_download=args.skip_download)
    print(f"\n  Date range: {df.index[0]} to {df.index[-1]}")
    print(f"  Candle count: {len(df)}")
    print(f"  Duration: ~{(df.index[-1] - df.index[0]).days / 365:.1f} years")

    # ---- Task 2: K=9 Revalidation ----
    windows = [24, 48, 72]
    k_values = [3, 5, 7, 9, 12]
    phase_a2 = revalidate_k9(df, windows, k_values)

    k9_confirmed = phase_a2["decision"] == "K9_CONFIRMED"
    best_window = phase_a2.get("best_window", 72)

    # Save Phase A2 results
    a2_results_path = DATA_DIR / "phase_a2_results.json"
    # Remove non-serializable items
    a2_serializable = json.loads(json.dumps(phase_a2, default=str))
    with open(a2_results_path, "w") as f:
        json.dump(a2_serializable, f, indent=2)
    print(f"\n  Phase A2 results saved to {a2_results_path}")

    # ---- Pre-compute vectors once for walk-forward ----
    print("\n" + "=" * 70)
    print("  PRE-COMPUTING FEATURES (once, for walk-forward)")
    print("=" * 70)
    print(f"  Computing features with window={best_window} on {len(df)} candles...")
    print(f"  This will take several minutes (Hurst/GARCH are expensive)...")
    sys.stdout.flush()

    vectors_full = compute_features_for_window(df, best_window)
    warmup = 3 * best_window
    vectors_valid = vectors_full.iloc[warmup:]
    print(f"  Done. {len(vectors_valid)} valid vectors.")
    sys.stdout.flush()

    # ---- Task 3+4: Build strategies and run walk-forward ----
    print("\n" + "=" * 70)
    print("  TASK 3+4: Strategy Variants + Walk-Forward Backtest")
    print("=" * 70)

    # 3-regime strategies (always run)
    strategies_3r = {
        "Buy-and-Hold": BuyAndHoldStrategy(),
        "MA-Cross-50/200": MACrossoverStrategy(50, 200),
        "Static-Trend-Follow": StaticTrendFollowStrategy(),
        "Static-Mean-Revert": StaticMeanRevertStrategy(),
        "DIR-Original": OriginalDIRRegimeStrategy(),
        "3R-1-D-Only-Conservative": ThreeR1_DOnlyConservative(),
        "3R-2-D-Scaled-Entry": ThreeR2_DOnlyScaledEntry(),
        "3R-3-D-MultiTF": ThreeR3_DOnlyMultiTimeframe(),
    }

    print("\n--- Walk-Forward: 3-Regime Strategies ---")
    sys.stdout.flush()
    wf_3r = walk_forward_backtest(
        df, vectors_valid, strategies_3r, window=best_window,
        train_years=2, test_months=6, k_value=3, is_9comp=False
    )
    agg_3r = aggregate_wf_metrics(wf_3r)

    # Print summary
    print(f"\n{'='*70}")
    print("  3-REGIME STRATEGY SUMMARY (Walk-Forward)")
    print(f"{'='*70}")
    print(f"  {'Strategy':35s} | {'Return':>10s} | {'Sharpe':>8s} | {'MaxDD':>8s} | {'Trades':>8s} | {'WinRate':>8s}")
    print(f"  {'-'*35}-+-{'-'*10}-+-{'-'*8}-+-{'-'*8}-+-{'-'*8}-+-{'-'*8}")
    for sname in sorted(agg_3r, key=lambda x: agg_3r[x].get("compounded_return", -999), reverse=True):
        m = agg_3r[sname]
        if m["n_windows"] == 0:
            continue
        print(f"  {sname:35s} | {m['compounded_return']*100:+9.1f}% | {m['mean_sharpe']:+7.3f} | "
              f"{m['worst_drawdown']*100:7.1f}% | {m['total_trades']:7d} | {m['mean_win_rate']*100:6.1f}%")
    sys.stdout.flush()

    # 9-composition strategies (only if K=9 confirmed)
    agg_9c = {}
    wf_9c = {"strategy_results": {}, "windows": []}
    if k9_confirmed:
        strategies_9c = {
            "9C-1-Ennea-Conservative": NineC1_EnneagramConservative(),
            "9C-2-Ennea-Full-Map": NineC2_EnneagramFullMap(),
            "9C-3-Barrier-Transition": NineC3_BarrierAwareTransition(),
        }

        print("\n--- Walk-Forward: 9-Composition Strategies ---")
        sys.stdout.flush()
        wf_9c = walk_forward_backtest(
            df, vectors_valid, strategies_9c, window=best_window,
            train_years=2, test_months=6, k_value=9, is_9comp=True
        )
        agg_9c = aggregate_wf_metrics(wf_9c)

        print(f"\n{'='*70}")
        print("  9-COMPOSITION STRATEGY SUMMARY (Walk-Forward)")
        print(f"{'='*70}")
        print(f"  {'Strategy':35s} | {'Return':>10s} | {'Sharpe':>8s} | {'MaxDD':>8s} | {'Trades':>8s} | {'WinRate':>8s}")
        print(f"  {'-'*35}-+-{'-'*10}-+-{'-'*8}-+-{'-'*8}-+-{'-'*8}-+-{'-'*8}")
        for sname in sorted(agg_9c, key=lambda x: agg_9c[x].get("compounded_return", -999), reverse=True):
            m = agg_9c[sname]
            if m["n_windows"] == 0:
                continue
            print(f"  {sname:35s} | {m['compounded_return']*100:+9.1f}% | {m['mean_sharpe']:+7.3f} | "
                  f"{m['worst_drawdown']*100:7.1f}% | {m['total_trades']:7d} | {m['mean_win_rate']*100:6.1f}%")
    sys.stdout.flush()

    # ---- Task 5: Charts ----
    print("\n" + "=" * 70)
    print("  TASK 5: Generate Charts")
    print("=" * 70)

    try:
        generate_charts(df, agg_3r, agg_9c, wf_3r, wf_9c, phase_a2, k9_confirmed)
    except Exception as e:
        print(f"[WARN] Chart generation error: {e}")
        import traceback
        traceback.print_exc()

    # ---- Task 6: Save results ----
    print("\n" + "=" * 70)
    print("  TASK 6: Save Results")
    print("=" * 70)

    # Determine recommendations
    all_agg = {**agg_3r, **agg_9c}
    ranked = sorted(
        [(name, m) for name, m in all_agg.items() if m["n_windows"] > 0],
        key=lambda x: x[1].get("mean_sharpe", -999),
        reverse=True,
    )

    best_strat_name = ranked[0][0] if ranked else "None"
    best_strat_sharpe = ranked[0][1]["mean_sharpe"] if ranked else 0
    bh_sharpe = all_agg.get("Buy-and-Hold", {}).get("mean_sharpe", 0)

    edge_over_bh = best_strat_sharpe > bh_sharpe
    nine_comp_edge = False
    if k9_confirmed and agg_9c:
        best_9c = max(agg_9c.values(), key=lambda x: x.get("mean_sharpe", -999))
        best_3r = max(agg_3r.values(), key=lambda x: x.get("mean_sharpe", -999))
        nine_comp_edge = best_9c.get("mean_sharpe", -999) > best_3r.get("mean_sharpe", -999)

    recommendation = []
    if edge_over_bh:
        recommendation.append(f"Best strategy ({best_strat_name}) beats buy-and-hold on Sharpe.")
    else:
        recommendation.append("No strategy consistently beats buy-and-hold on Sharpe.")

    if k9_confirmed:
        if nine_comp_edge:
            recommendation.append("9-composition model adds edge over 3-regime.")
        else:
            recommendation.append("9-composition model does NOT add edge. Stick with 3-regime.")
    else:
        recommendation.append("K=9 not confirmed. 3-regime model is the baseline.")

    recommendation.append(f"Proceed to Phase D with: {best_strat_name}")

    # Clean results for JSON
    def clean_for_json(obj):
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, pd.Timestamp):
            return str(obj)
        if isinstance(obj, float) and (np.isinf(obj) or np.isnan(obj)):
            return None
        return obj

    results = {
        "phase": "C2",
        "data": {
            "source": "binance_btc_1h_full",
            "candles": len(df),
            "date_range": f"{df.index[0]} to {df.index[-1]}",
            "years": round((df.index[-1] - df.index[0]).days / 365, 1),
        },
        "phase_a2_revalidation": a2_serializable,
        "k9_confirmed": k9_confirmed,
        "best_window": best_window,
        "walk_forward_config": {
            "train_years": 2,
            "test_months": 6,
            "step_months": 6,
        },
        "strategy_results_3r": {
            k: {kk: clean_for_json(vv) for kk, vv in v.items() if kk != "per_window"}
            for k, v in agg_3r.items()
        },
        "strategy_results_9c": {
            k: {kk: clean_for_json(vv) for kk, vv in v.items() if kk != "per_window"}
            for k, v in agg_9c.items()
        } if agg_9c else {},
        "ranking": [
            {"rank": i+1, "strategy": name, "mean_sharpe": float(m.get("mean_sharpe", 0)),
             "compounded_return": float(m.get("compounded_return", 0)),
             "worst_drawdown": float(m.get("worst_drawdown", 0))}
            for i, (name, m) in enumerate(ranked)
        ],
        "recommendation": recommendation,
        "phase_d_candidate": best_strat_name,
    }

    results_path = DATA_DIR / "phase_c2_results.json"
    with open(results_path, "w") as f:
        json.dump(results, f, indent=2, default=str)
    print(f"\n  Results saved to {results_path}")

    # Final summary
    print(f"\n{'='*70}")
    print("  PHASE C-2: FINAL SUMMARY")
    print(f"{'='*70}")
    print(f"  Data: {len(df)} candles ({df.index[0].year}-{df.index[-1].year})")
    print(f"  K=9 confirmed: {k9_confirmed}")
    print(f"  Best window: {best_window}h")
    print(f"\n  Strategy Ranking (by mean Sharpe):")
    for i, (name, m) in enumerate(ranked[:10]):
        print(f"    {i+1}. {name:35s} Sharpe={m.get('mean_sharpe', 0):+.3f}  "
              f"Return={m.get('compounded_return', 0)*100:+.1f}%  "
              f"MaxDD={m.get('worst_drawdown', 0)*100:.1f}%")

    print(f"\n  Recommendation:")
    for r in recommendation:
        print(f"    - {r}")

    print(f"\n  Charts saved to: {CHARTS_DIR}/")
    print(f"  Results saved to: {results_path}")


if __name__ == "__main__":
    main()
