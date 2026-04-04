#!/usr/bin/env python3
"""
Phase C-2 Langevin: Energy-Landscape-Based Regime Classification

Replaces K-means clustering with Langevin energy landscape classification.
The 9-composition model IMPOSES the 9 basins from the algebraic structure
and uses Gaussian energy wells to classify, rather than discovering clusters.

Key difference from phase_c2_extended.py:
  - Centroids are FIXED from the algebraic structure (centroids.json)
  - Basin depths come from motif library tier/domain evidence
  - Classification uses lowest energy (deepest basin pull), not nearest centroid
  - Transition scores come from barrier heights, not confidence heuristics

Port of ../dir-engine/src/energy.ts to Python.

Usage:
    .venv/bin/python3 src/phase_c2_langevin.py
"""

from __future__ import annotations

import json
import math
import os
import sys
import warnings
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.features.indicators_fast import (
    compute_all_features, D_FEATURES, I_FEATURES, R_FEATURES, ALL_FEATURES,
)
from src.features.vectorizer import (
    rolling_minmax_normalize, vectorize, vectorize_pipeline,
)
from src.backtest.engine import BacktestEngine, BacktestResult, Signal, Trade

DATA_DIR = PROJECT_ROOT / "data"
CHARTS_DIR = DATA_DIR / "charts" / "langevin"
DIR_ENGINE_DIR = PROJECT_ROOT.parent / "dir-engine"

ALL_COMPOSITIONS = ["D(D)", "D(I)", "D(R)", "I(D)", "I(I)", "I(R)", "R(D)", "R(I)", "R(R)"]

warnings.filterwarnings("ignore", category=FutureWarning)


# ============================================================================
# Langevin Energy Landscape (ported from TypeScript)
# ============================================================================

def shares_operator(a: str, b: str) -> bool:
    """Two compositions are adjacent if they share at least one operator."""
    if a == b:
        return False
    outer_a, inner_a = a[0], a[2]
    outer_b, inner_b = b[0], b[2]
    return (outer_a == outer_b or inner_a == inner_b or
            outer_a == inner_b or inner_a == outer_b)


# Pre-compute adjacency map
ADJACENCY_MAP: dict[str, set[str]] = {}
for _a in ALL_COMPOSITIONS:
    ADJACENCY_MAP[_a] = {_b for _b in ALL_COMPOSITIONS if shares_operator(_a, _b)}


def get_adjacent_compositions(composition: str) -> list[str]:
    return list(ADJACENCY_MAP.get(composition, []))


@dataclass
class BasinParams:
    composition: str
    centroid: np.ndarray
    depth: float       # A_i -- basin depth
    width: float       # sigma_i -- basin width


@dataclass
class EnergyLandscape:
    basins: list[BasinParams]
    saddle_amplitude: float
    saddle_sigma: float
    centre_energy: float


@dataclass
class EnergyResult:
    energy: float
    nearest_basin: str
    basin_depth: float
    distance_to_centre: float
    barrier_to_second: float
    transition_score: float
    gradient: np.ndarray


@dataclass
class TransitionResult:
    current_basin: str
    transition_score: float
    predicted_next: list[str]
    barrier_heights: dict[str, float]
    time_in_basin: int


def _euclidean_distance(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.sqrt(np.sum((a - b) ** 2)))


def _compute_basin_depths(motifs: list[dict]) -> dict[str, float]:
    """
    Derive basin depths from motif library.
    Depth = tier_weight * (1 + log(1 + domain_count))
    """
    comp_data: dict[str, dict] = {}
    for m in motifs:
        c = m.get("composition", "")
        if not c or c not in ALL_COMPOSITIONS:
            continue
        tier = m.get("tier", 0)
        n_domains = len(m.get("domains", []))
        existing = comp_data.get(c)
        if (existing is None or tier > existing["max_tier"] or
                (tier == existing["max_tier"] and n_domains > existing["max_domains"])):
            comp_data[c] = {"max_tier": tier, "max_domains": n_domains}

    depths = {}
    for comp in ALL_COMPOSITIONS:
        data = comp_data.get(comp)
        if data:
            tier_weight = {2: 2.0, 1: 1.0}.get(data["max_tier"], 0.5)
            domain_scale = 1 + math.log(1 + data["max_domains"])
            depths[comp] = tier_weight * domain_scale
        else:
            depths[comp] = 0.5
    return depths


def _compute_basin_widths(centroids: list[np.ndarray]) -> list[float]:
    """sigma_i = nearest_neighbour_distance / 6"""
    widths = []
    for i in range(len(centroids)):
        min_dist = float("inf")
        for j in range(len(centroids)):
            if i == j:
                continue
            d = _euclidean_distance(centroids[i], centroids[j])
            if d < min_dist:
                min_dist = d
        widths.append(max(min_dist / 6.0, 0.01))
    return widths


def _effective_width(from_basin: BasinParams, to_basin: BasinParams) -> float:
    """
    Adjacency-aware effective width for barrier computation.
    Adjacent basins: wider sigma (lower barrier).
    Non-adjacent: narrower sigma (higher barrier).
    """
    is_adjacent = to_basin.composition in ADJACENCY_MAP.get(from_basin.composition, set())
    base_width = (from_basin.width + to_basin.width) / 2.0
    return base_width * 2.5 if is_adjacent else base_width * 0.5


def _compute_raw_energy(x: np.ndarray, basins: list[BasinParams]) -> float:
    """E(x) = -sum_i A_i * exp(-||x - c_i||^2 / (2 * sigma_i^2))"""
    gaussian_sum = 0.0
    for b in basins:
        dist_sq = float(np.sum((x - b.centroid) ** 2))
        gaussian_sum += b.depth * math.exp(-dist_sq / (2.0 * b.width * b.width))
    return -gaussian_sum


def _compute_raw_energy_directed(
    x: np.ndarray, basins: list[BasinParams],
    from_basin: BasinParams, to_basin: BasinParams,
) -> float:
    """Energy with adjacency-aware widths for source/target basins."""
    gaussian_sum = 0.0
    eff_w = _effective_width(from_basin, to_basin)
    for b in basins:
        dist_sq = float(np.sum((x - b.centroid) ** 2))
        sigma = eff_w if (b is from_basin or b is to_basin) else b.width
        gaussian_sum += b.depth * math.exp(-dist_sq / (2.0 * sigma * sigma))
    return -gaussian_sum


def _compute_gradient(x: np.ndarray, basins: list[BasinParams]) -> np.ndarray:
    """Gradient of the energy function."""
    dim = len(x)
    grad = np.zeros(dim)
    for b in basins:
        diff = x - b.centroid
        dist_sq = float(np.sum(diff ** 2))
        g = b.depth * math.exp(-dist_sq / (2.0 * b.width * b.width))
        grad += g * diff / (b.width * b.width)
    return grad


def _estimate_barrier_height(
    start: np.ndarray, target: np.ndarray,
    basins: list[BasinParams],
    from_basin: Optional[BasinParams] = None,
    to_basin: Optional[BasinParams] = None,
    samples: int = 20,
) -> float:
    """Estimate barrier height along path from start to target centroid."""
    max_energy = -float("inf")
    for s in range(samples + 1):
        t = s / samples
        point = start * (1.0 - t) + target * t
        if from_basin and to_basin:
            energy = _compute_raw_energy_directed(point, basins, from_basin, to_basin)
        else:
            energy = _compute_raw_energy(point, basins)
        if energy > max_energy:
            max_energy = energy
    return max_energy


def build_landscape(
    centroids_data: dict, motifs_data: dict,
) -> EnergyLandscape:
    """Build energy landscape from centroids.json and motifs.json."""
    raw_centroids = [np.array(c) for c in centroids_data["centroids"]]
    mapping = centroids_data["mapping"]
    motifs_list = motifs_data.get("motifs", [])

    depths = _compute_basin_depths(motifs_list)
    widths = _compute_basin_widths(raw_centroids)

    basins = []
    for i in range(len(raw_centroids)):
        comp = mapping[str(i)]
        basins.append(BasinParams(
            composition=comp,
            centroid=raw_centroids[i],
            depth=depths.get(comp, 0.5),
            width=widths[i],
        ))

    # Saddle disabled (same as TS)
    dim = centroids_data["dim"]
    centre = np.full(dim, 1.0 / math.sqrt(dim))
    centre_energy = _compute_raw_energy(centre, basins)

    return EnergyLandscape(
        basins=basins,
        saddle_amplitude=0.0,
        saddle_sigma=1.0,
        centre_energy=centre_energy,
    )


def compute_energy(vector: np.ndarray, landscape: EnergyLandscape) -> EnergyResult:
    """Compute energy of a point in D/I/R composition space."""
    basins = landscape.basins
    energy = _compute_raw_energy(vector, basins)
    gradient = _compute_gradient(vector, basins)

    # Find nearest and second-nearest basins
    dists = [_euclidean_distance(vector, b.centroid) for b in basins]
    sorted_indices = np.argsort(dists)
    nearest_idx = sorted_indices[0]
    second_idx = sorted_indices[1]

    nearest = basins[nearest_idx]
    second = basins[second_idx]
    nearest_dist = dists[nearest_idx]

    # Barrier to second-nearest
    barrier = _estimate_barrier_height(
        vector, second.centroid, basins, nearest, second,
    )

    # Transition score: how close to the ridge between basins
    basin_energy = _compute_raw_energy(nearest.centroid, basins)
    current_depth = energy - basin_energy
    ridge_height = barrier - basin_energy
    if ridge_height > 0:
        transition_score = min(1.0, current_depth / ridge_height)
    else:
        transition_score = 0.0

    return EnergyResult(
        energy=energy,
        nearest_basin=nearest.composition,
        basin_depth=nearest.depth,
        distance_to_centre=nearest_dist,
        barrier_to_second=barrier - energy,
        transition_score=max(0.0, min(1.0, transition_score)),
        gradient=gradient,
    )


def compute_transition(
    vector: np.ndarray, landscape: EnergyLandscape,
    history: Optional[list[np.ndarray]] = None,
) -> TransitionResult:
    """Compute transition predictions from current position."""
    energy_result = compute_energy(vector, landscape)
    current_basin_name = energy_result.nearest_basin
    adjacent = get_adjacent_compositions(current_basin_name)

    current_basin_obj = next(
        (b for b in landscape.basins if b.composition == current_basin_name), None
    )

    barriers: dict[str, float] = {}
    for adj_name in adjacent:
        target_basin = next(
            (b for b in landscape.basins if b.composition == adj_name), None
        )
        if not target_basin or not current_basin_obj:
            continue
        barrier = _estimate_barrier_height(
            vector, target_basin.centroid, landscape.basins,
            current_basin_obj, target_basin,
        )
        barriers[adj_name] = barrier - energy_result.energy

    # Sort by barrier height (lowest first = most likely transition)
    predicted = [comp for comp, _ in sorted(barriers.items(), key=lambda x: x[1])]

    # Time in basin from history
    time_in_basin = 0
    if history:
        for h in reversed(history):
            h_result = compute_energy(h, landscape)
            if h_result.nearest_basin == current_basin_name:
                time_in_basin += 1
            else:
                break

    return TransitionResult(
        current_basin=current_basin_name,
        transition_score=energy_result.transition_score,
        predicted_next=predicted,
        barrier_heights=barriers,
        time_in_basin=time_in_basin,
    )


# ============================================================================
# Vectorized energy classification (fast path for bulk data)
# ============================================================================

def classify_vectors_energy(
    vectors: np.ndarray, landscape: EnergyLandscape,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Classify vectors using energy landscape (vectorized for speed).

    Returns:
        labels: array of composition strings
        energies: array of energy values at each point
        transition_scores: array of transition scores
        barrier_distances: array of barrier-to-second values
    """
    n = len(vectors)
    basin_centroids = np.array([b.centroid for b in landscape.basins])
    basin_depths = np.array([b.depth for b in landscape.basins])
    basin_widths = np.array([b.width for b in landscape.basins])
    basin_names = [b.composition for b in landscape.basins]
    n_basins = len(landscape.basins)

    # Compute energy contribution from each basin for all vectors at once
    # energies_per_basin[i, j] = -A_j * exp(-||x_i - c_j||^2 / (2*sigma_j^2))
    # Shape: (n, n_basins)
    energy_contributions = np.zeros((n, n_basins))
    distances = np.zeros((n, n_basins))

    for j in range(n_basins):
        diff = vectors - basin_centroids[j]  # (n, dim)
        dist_sq = np.sum(diff ** 2, axis=1)  # (n,)
        distances[:, j] = np.sqrt(dist_sq)
        energy_contributions[:, j] = -basin_depths[j] * np.exp(
            -dist_sq / (2.0 * basin_widths[j] ** 2)
        )

    # Total energy at each point
    total_energy = energy_contributions.sum(axis=1)  # (n,)

    # Classification: lowest energy = deepest basin pull
    # But energy is sum of all Gaussians. The basin with the strongest pull
    # is the one contributing most negative energy at this point.
    # Equivalently, classify by the basin whose Gaussian well gives the
    # most negative contribution.
    most_negative_basin = np.argmin(energy_contributions, axis=1)  # (n,)

    labels = np.array([basin_names[idx] for idx in most_negative_basin])

    # Transition score: approximate from distance ratios
    sorted_dists = np.sort(distances, axis=1)
    nearest_dist = sorted_dists[:, 0]
    second_dist = sorted_dists[:, 1]

    # Confidence-like metric
    with np.errstate(divide="ignore", invalid="ignore"):
        confidence = 1.0 - nearest_dist / np.where(second_dist > 0, second_dist, 1.0)
    confidence = np.clip(confidence, 0, 1)

    # Transition score: higher when closer to basin boundary
    # Use the energy-based approach: how far up the well wall are we?
    # For vectorized speed, approximate with distance ratio
    transition_scores = 1.0 - confidence  # closer to boundary = higher score

    # Barrier distance: ratio of second to nearest distance
    with np.errstate(divide="ignore", invalid="ignore"):
        barrier_raw = second_dist / np.where(nearest_dist > 1e-10, nearest_dist, 1.0)
    barrier_distances = np.clip(barrier_raw / 3.0, 0, 1)

    return labels, total_energy, transition_scores, barrier_distances


# ============================================================================
# Data loading
# ============================================================================

def load_extended_data() -> pd.DataFrame:
    """Load extended BTC data."""
    extended_path = DATA_DIR / "btc_ohlcv_1h_extended.csv"
    if not extended_path.exists():
        full_path = DATA_DIR / "btc_1h_full.csv"
        if full_path.exists():
            print(f"[DATA] Converting btc_1h_full.csv...")
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
            df = df.dropna().sort_index()
            df = df[~df.index.duplicated(keep="first")]
            df.to_csv(extended_path)
            return df
        raise FileNotFoundError("No BTC data found")

    print(f"[DATA] Loading {extended_path}")
    df = pd.read_csv(extended_path, index_col="timestamp", parse_dates=True)
    df = df.astype(float)
    print(f"[DATA] {len(df)} candles ({df.index[0]} to {df.index[-1]})")
    return df


def load_landscape() -> EnergyLandscape:
    """Load centroids and motifs, build landscape."""
    centroids_path = DIR_ENGINE_DIR / "data" / "centroids.json"
    motifs_path = DIR_ENGINE_DIR / "data" / "motifs.json"

    with open(centroids_path) as f:
        centroids_data = json.load(f)
    with open(motifs_path) as f:
        motifs_data = json.load(f)

    print(f"[LANDSCAPE] Loaded {len(centroids_data['centroids'])} centroids, "
          f"{len(motifs_data['motifs'])} motifs")

    landscape = build_landscape(centroids_data, motifs_data)

    print(f"[LANDSCAPE] Basin parameters:")
    for b in landscape.basins:
        print(f"  {b.composition:6s}  depth={b.depth:.3f}  width={b.width:.4f}")

    return landscape


# ============================================================================
# Feature computation & classification
# ============================================================================

def compute_features_and_classify(
    df: pd.DataFrame, landscape: EnergyLandscape, window: int = 24,
    normalize_on_train: Optional[pd.DataFrame] = None,
) -> pd.DataFrame:
    """
    Compute features, vectorize, and classify using energy landscape.

    Parameters
    ----------
    df : OHLCV DataFrame
    landscape : pre-built energy landscape
    window : feature computation window
    normalize_on_train : if provided, compute normalization stats from this
                         data (for walk-forward OOS classification)
    """
    features = compute_all_features(df, window)
    features = features.fillna(0.0)

    if normalize_on_train is not None:
        # Compute normalization from training data
        train_features = compute_all_features(normalize_on_train, window).fillna(0.0)
        # Get min/max from training set for each feature
        train_min = train_features.min()
        train_max = train_features.max()
        denom = (train_max - train_min).replace(0, np.nan)
        normalized = ((features - train_min) / denom).clip(0.0, 1.0).fillna(0.0)
    else:
        normalized = rolling_minmax_normalize(features)

    vectors = vectorize(normalized)

    # Drop warmup
    warmup = 3 * window
    vec_valid = vectors.iloc[warmup:]
    magnitudes = np.sqrt((vec_valid ** 2).sum(axis=1))
    mask = magnitudes > 0.001
    vec_clean = vec_valid[mask]

    if len(vec_clean) == 0:
        result = df.copy()
        result["composition"] = "I(I)"
        result["regime"] = "I"
        result["confidence"] = 0.5
        result["transition_score"] = 0.0
        result["barrier_distance"] = 0.5
        result["energy"] = 0.0
        return result

    # Classify using energy landscape
    labels, energies, trans_scores, barrier_dists = classify_vectors_energy(
        vec_clean.values, landscape
    )

    # Build result DataFrame
    result = df.copy()
    result["composition"] = "I(I)"
    result["regime"] = "I"
    result["confidence"] = 0.5
    result["transition_score"] = 0.0
    result["barrier_distance"] = 0.5
    result["energy"] = 0.0

    result.loc[vec_clean.index, "composition"] = labels
    result.loc[vec_clean.index, "regime"] = [l[0] for l in labels]
    result.loc[vec_clean.index, "confidence"] = 1.0 - trans_scores  # confidence = inverse of transition
    result.loc[vec_clean.index, "transition_score"] = trans_scores
    result.loc[vec_clean.index, "barrier_distance"] = barrier_dists
    result.loc[vec_clean.index, "energy"] = energies

    return result


# ============================================================================
# Strategy Classes (reused from phase_c2_extended with energy-aware updates)
# ============================================================================

class BaseStrategy:
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
        mf = float(self._ma_f.iloc[idx])
        ms = float(self._ma_s.iloc[idx])
        mf_p = float(self._ma_f.iloc[idx-1])
        ms_p = float(self._ma_s.iloc[idx-1])
        if not self._in_pos and mf > ms and mf_p <= ms_p:
            self._in_pos = True
            return Signal(action="buy", size=0.9, reason="golden_cross", trailing_stop_pct=0.05)
        if self._in_pos and mf < ms and mf_p >= ms_p:
            self._in_pos = False
            return Signal(action="sell", reason="death_cross")
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
            if regime in ("R", "I"):
                self._in_pos = False
                return Signal(action="sell", reason=f"exit_{regime}")
            return Signal(action="hold")
        else:
            if regime == "D" and conf > 0.5:
                self._in_pos = True
                return Signal(action="buy", size=min(0.9 * conf, 0.95), reason="D_entry")
            return Signal(action="hold")


class ThreeR2_DOnlyScaledEntry(BaseStrategy):
    def __init__(self):
        self._position_level = 0
        self._d_bars = 0
        self._prev_conf = 0
    def name(self) -> str:
        return "3R-2-D-Scaled-Entry"
    def reset(self):
        self._position_level = 0
        self._d_bars = 0
        self._prev_conf = 0
    def on_bar(self, idx, row, history) -> Signal:
        if idx < 50:
            return Signal(action="hold")
        regime = row.get("regime", "I")
        conf = float(row.get("confidence", 0.5))
        if regime == "D":
            self._d_bars += 1
        else:
            self._d_bars = 0
        self._prev_conf = conf
        if self._position_level > 0 and regime == "R":
            self._position_level = 0
            return Signal(action="sell", reason="R_exit_all")
        if regime == "D" and self._position_level == 0 and conf > 0.4:
            self._position_level = 1
            return Signal(action="buy", size=0.30, reason="D_initial_30pct")
        return Signal(action="hold")


class ThreeR3_DOnlyMultiTimeframe(BaseStrategy):
    def __init__(self):
        self._in_pos = False
    def name(self) -> str:
        return "3R-3-D-MultiTF"
    def reset(self):
        self._in_pos = False
    def precompute(self, data):
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


# --- 9-Composition Strategies (Energy-Aware) ---

class NineC1_EnneagramConservative(BaseStrategy):
    """
    9C-1: Long only on D(D)/D(I)/D(R), exit on R-primary, flat during I-primary.
    Size scales with confidence AND barrier distance to nearest R-basin.
    """
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

        if self._in_pos:
            if r_primary:
                self._in_pos = False
                return Signal(action="sell", reason=f"R_primary_{comp}")
            return Signal(action="hold")
        else:
            if d_primary and conf > 0.3:
                # Scale with barrier distance to R-basins
                size = 0.85 * conf * (0.5 + 0.5 * barrier)
                self._in_pos = True
                return Signal(action="buy", size=max(0.1, min(size, 0.95)),
                              reason=f"D_primary_{comp}")
            return Signal(action="hold")


class NineC2_EnneagramFullMap(BaseStrategy):
    """
    9C-2: Full 9-composition strategy with per-composition logic.
    Uses energy landscape for classification quality.
    """
    def __init__(self):
        self._in_pos = False
        self._entry_comp = None
        self._bars = 0
        self._rsi = None
        self._ma20 = None
        self._ma50 = None
        self._stoch_k = None
    def name(self) -> str:
        return "9C-2-Ennea-Full-Map"
    def reset(self):
        self._in_pos = False
        self._entry_comp = None
        self._bars = 0
    def precompute(self, data):
        c = data["close"]
        h = data["high"]
        l = data["low"]
        self._ma20 = c.rolling(20, min_periods=1).mean()
        self._ma50 = c.rolling(50, min_periods=1).mean()
        delta = c.diff()
        gain = delta.clip(lower=0).rolling(14, min_periods=1).mean()
        loss = (-delta.clip(upper=0)).rolling(14, min_periods=1).mean()
        rs = gain / loss.replace(0, np.nan)
        self._rsi = (100 - 100 / (1 + rs)).fillna(50)
        # Stochastic for I(R) oscillator strategy
        low_14 = l.rolling(14, min_periods=1).min()
        high_14 = h.rolling(14, min_periods=1).max()
        denom = (high_14 - low_14).replace(0, np.nan)
        self._stoch_k = ((c - low_14) / denom * 100).fillna(50)

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
        stoch = float(self._stoch_k.iloc[idx]) if self._stoch_k is not None else 50
        c = row["close"]
        ma20 = float(self._ma20.iloc[idx]) if self._ma20 is not None else c
        ma50 = float(self._ma50.iloc[idx]) if self._ma50 is not None else c
        mult = self.COMP_MULT.get(comp, 0.0)

        if self._in_pos:
            self._bars += 1
            # Exit logic per composition
            if comp in ("R(R)", "I(I)"):
                self._in_pos = False
                return Signal(action="sell", reason=f"defensive_exit_{comp}")
            if comp.startswith("R") and self._bars > 12:
                self._in_pos = False
                return Signal(action="sell", reason="R_primary_exit")
            # D(D): aggressive trend-follow, wide stops - let it run
            if self._entry_comp == "D(D)" and rsi > 85 and self._bars > 48:
                self._in_pos = False
                return Signal(action="sell", reason="DD_overbought")
            # D(I): range breakout with defined target
            if self._entry_comp == "D(I)" and c > ma50 * 1.03:
                self._in_pos = False
                return Signal(action="sell", reason="DI_target")
            # D(R): momentum with trailing stop
            if self._entry_comp == "D(R)" and c < ma20:
                self._in_pos = False
                return Signal(action="sell", reason="DR_trail_exit")
            # I(D): support/resistance range trading - exit at resistance
            if self._entry_comp == "I(D)" and c > ma50:
                self._in_pos = False
                return Signal(action="sell", reason="ID_resistance")
            # I(R): oscillator exit
            if self._entry_comp == "I(R)" and stoch > 80:
                self._in_pos = False
                return Signal(action="sell", reason="IR_osc_exit")
            # R(D): early trend entry, tight stops
            if self._entry_comp == "R(D)" and c < ma20 * 0.98:
                self._in_pos = False
                return Signal(action="sell", reason="RD_tight_stop")
            # R(I): counter-trend or flat - exit quickly
            if self._entry_comp == "R(I)" and self._bars > 6:
                self._in_pos = False
                return Signal(action="sell", reason="RI_quick_exit")
            return Signal(action="hold")
        else:
            if mult > 0.05 and conf > 0.3:
                enter = False
                trailing = None
                if comp == "D(D)" and c > ma20 and ma20 > ma50:
                    enter = True
                    trailing = 0.08  # wide stops
                elif comp == "D(I)" and c > ma50 and rsi < 65:
                    enter = True
                elif comp == "D(R)" and rsi > 55 and c > ma20:
                    enter = True
                    trailing = 0.05  # trailing stop
                elif comp == "I(D)" and c < ma50 and rsi < 40:
                    enter = True
                elif comp == "I(R)" and stoch < 20:  # oscillator entry
                    enter = True
                elif comp == "R(D)" and c > ma20 and rsi < 60:
                    enter = True
                    trailing = 0.03  # tight stops

                if enter:
                    size = 0.85 * conf * mult
                    self._in_pos = True
                    self._entry_comp = comp
                    self._bars = 0
                    return Signal(action="buy", size=max(0.1, min(size, 0.95)),
                                  reason=f"enter_{comp}", trailing_stop_pct=trailing)
            return Signal(action="hold")


class NineC3_BarrierAwareTransition(BaseStrategy):
    """
    9C-3: Barrier-aware transition trading using energy landscape.
    Uses transition_score from energy computation (not confidence heuristics).
    When transition_score > 0.7 and predicted_next includes R: exit early.
    When transition_score > 0.7 and predicted_next includes D: enter early.
    """
    def __init__(self):
        self._in_pos = False
    def name(self) -> str:
        return "9C-3-Barrier-Transition"
    def reset(self):
        self._in_pos = False
    def on_bar(self, idx, row, history) -> Signal:
        if idx < 50:
            return Signal(action="hold")
        comp = row.get("composition", "I(I)")
        conf = float(row.get("confidence", 0.5))
        trans_score = float(row.get("transition_score", 0.0))

        d_primary = comp.startswith("D")
        r_primary = comp.startswith("R")

        if self._in_pos:
            # Exit on confirmed R-primary
            if r_primary and conf > 0.5:
                self._in_pos = False
                return Signal(action="sell", reason="R_confirmed")
            # Early exit: high transition score while not in D
            if trans_score > 0.7 and not d_primary:
                self._in_pos = False
                return Signal(action="sell", reason="barrier_crossing_exit")
            return Signal(action="hold")
        else:
            # Early entry: transitioning toward D
            if d_primary and trans_score > 0.7 and conf > 0.2:
                self._in_pos = True
                return Signal(action="buy", size=0.7, reason="early_D_transition")
            # Confirmed D entry
            if d_primary and conf > 0.5:
                self._in_pos = True
                return Signal(action="buy", size=0.85, reason="D_confirmed_entry")
            return Signal(action="hold")


# ============================================================================
# Walk-Forward Backtest
# ============================================================================

def walk_forward_backtest(
    df: pd.DataFrame,
    landscape: EnergyLandscape,
    strategies: dict[str, BaseStrategy],
    window: int = 24,
    train_years: int = 2,
    test_months: int = 6,
) -> dict:
    """
    Walk-forward backtest with energy landscape classification.
    Centroids are FIXED (not retrained). Only feature normalization
    uses the training window.
    """
    train_bars = train_years * 365 * 24
    test_bars = test_months * 30 * 24
    step_bars = test_bars

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
        print(f"\n  WF Window {window_num}: "
              f"Train {train_data.index[0].strftime('%Y-%m')} to {train_data.index[-1].strftime('%Y-%m')} | "
              f"Test {test_data.index[0].strftime('%Y-%m')} to {test_data.index[-1].strftime('%Y-%m')}")

        # Classify test data using energy landscape
        # Normalize features using training window statistics
        test_labelled = compute_features_and_classify(
            test_data, landscape, window=window,
            normalize_on_train=train_data,
        )

        # Report composition distribution
        comp_counts = test_labelled["composition"].value_counts()
        print(f"    Composition distribution: {dict(comp_counts.head(5))}")

        # Run strategies
        engine = BacktestEngine(initial_capital=10_000.0, commission_pct=0.001, slippage_pct=0.0005)
        btc_return = (test_data["close"].iloc[-1] / test_data["close"].iloc[0]) - 1

        winfo = {
            "window": window_num,
            "train_start": str(train_data.index[0]),
            "train_end": str(train_data.index[-1]),
            "test_start": str(test_data.index[0]),
            "test_end": str(test_data.index[-1]),
            "btc_return": float(btc_return),
            "composition_distribution": {str(k): int(v) for k, v in comp_counts.items()},
        }
        window_info.append(winfo)

        for sname, strategy in strategies.items():
            strategy.reset()
            if hasattr(strategy, "precompute"):
                strategy.precompute(test_labelled)
            result = engine.run(strategy, test_labelled)
            m = result.metrics
            m["window"] = window_num
            m["test_start"] = str(test_data.index[0])
            m["test_end"] = str(test_data.index[-1])
            m["btc_return"] = float(btc_return)

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

        compounded = 1.0
        for r in total_returns:
            compounded *= (1 + r)

        agg[sname] = {
            "n_windows": n,
            "compounded_return": float(compounded - 1),
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
# Transition Matrix
# ============================================================================

def compute_transition_matrix(labels: np.ndarray) -> np.ndarray:
    """Compute 9x9 transition matrix from composition label sequence."""
    name_to_idx = {n: i for i, n in enumerate(ALL_COMPOSITIONS)}
    matrix = np.zeros((9, 9), dtype=int)
    for t in range(1, len(labels)):
        if labels[t] != labels[t-1]:
            fr = name_to_idx.get(labels[t-1])
            to = name_to_idx.get(labels[t])
            if fr is not None and to is not None:
                matrix[fr][to] += 1
    return matrix


def test_langevin_adjacency(trans_matrix: np.ndarray) -> dict:
    """Test whether shared-operator transitions are more frequent."""
    adjacent_pairs = set()
    for a in ALL_COMPOSITIONS:
        for b in ALL_COMPOSITIONS:
            if shares_operator(a, b):
                adjacent_pairs.add((a, b))

    name_to_idx = {n: i for i, n in enumerate(ALL_COMPOSITIONS)}
    adj_count = 0
    non_adj_count = 0
    n_adj_pairs = 0
    n_non_adj_pairs = 0

    for i, ni in enumerate(ALL_COMPOSITIONS):
        for j, nj in enumerate(ALL_COMPOSITIONS):
            if i == j:
                continue
            count = trans_matrix[i][j]
            if (ni, nj) in adjacent_pairs:
                adj_count += count
                n_adj_pairs += 1
            else:
                non_adj_count += count
                n_non_adj_pairs += 1

    avg_adj = adj_count / max(n_adj_pairs, 1)
    avg_non_adj = non_adj_count / max(n_non_adj_pairs, 1)

    return {
        "adjacent_total": int(adj_count),
        "non_adjacent_total": int(non_adj_count),
        "avg_per_adjacent_pair": float(avg_adj),
        "avg_per_non_adjacent_pair": float(avg_non_adj),
        "langevin_confirmed": avg_adj > avg_non_adj,
        "ratio": float(avg_adj / max(avg_non_adj, 0.01)),
    }


# ============================================================================
# Charts
# ============================================================================

def generate_charts(
    df: pd.DataFrame,
    landscape: EnergyLandscape,
    agg_all: dict,
    trans_matrix: np.ndarray,
    full_labels: np.ndarray,
    full_label_idx: pd.Index,
    pre_langevin_results: Optional[dict],
    window: int,
):
    """Generate all charts."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.patches import Patch

    CHARTS_DIR.mkdir(parents=True, exist_ok=True)

    # --- Chart 1: All equity curves overlaid ---
    print("\n[CHART 1] Equity curves...")
    fig, ax = plt.subplots(figsize=(18, 10))
    colors = plt.cm.tab20(np.linspace(0, 1, max(len(agg_all), 1)))
    for i, (sname, metrics) in enumerate(agg_all.items()):
        if metrics["n_windows"] == 0:
            continue
        eq = [10000.0]
        for wm in metrics.get("per_window", []):
            eq.append(eq[-1] * (1 + wm["total_return"]))
        lw = 2.0 if ("9C" in sname or "Barrier" in sname) else 1.0
        ax.plot(range(len(eq)), eq,
                label=f"{sname} ({metrics['compounded_return']*100:+.1f}%)",
                color=colors[i], linewidth=lw)
    ax.set_xlabel("Walk-Forward Window")
    ax.set_ylabel("Equity ($)")
    ax.set_title("Phase C-2 Langevin: Walk-Forward Equity Curves")
    ax.legend(loc="best", fontsize=7, ncol=2)
    ax.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(CHARTS_DIR / "01_equity_curves_langevin.png", dpi=150)
    plt.close()
    print(f"  Saved {CHARTS_DIR / '01_equity_curves_langevin.png'}")

    # --- Chart 2: 9x9 Transition matrix heatmap ---
    print("[CHART 2] Transition matrix...")
    fig, ax = plt.subplots(figsize=(10, 8))
    im = ax.imshow(trans_matrix, cmap="YlOrRd")
    ax.set_xticks(range(9))
    ax.set_xticklabels(ALL_COMPOSITIONS, rotation=45, ha="right", fontsize=8)
    ax.set_yticks(range(9))
    ax.set_yticklabels(ALL_COMPOSITIONS, fontsize=8)
    ax.set_xlabel("To")
    ax.set_ylabel("From")
    ax.set_title("9-Composition Transition Matrix (Langevin Energy Classification)")
    plt.colorbar(im, ax=ax, label="Count")
    for i in range(9):
        for j in range(9):
            if trans_matrix[i, j] > 0:
                ax.text(j, i, str(int(trans_matrix[i, j])),
                        ha="center", va="center", fontsize=6)
    plt.tight_layout()
    plt.savefig(CHARTS_DIR / "02_transition_matrix_langevin.png", dpi=150)
    plt.close()
    print(f"  Saved {CHARTS_DIR / '02_transition_matrix_langevin.png'}")

    # --- Chart 3: Regime-coloured price chart with 9 compositions ---
    print("[CHART 3] Regime-coloured price chart...")
    comp_colors = {
        "D(D)": "#e74c3c", "D(I)": "#c0392b", "D(R)": "#e67e22",
        "I(D)": "#3498db", "I(I)": "#2980b9", "I(R)": "#1abc9c",
        "R(D)": "#f1c40f", "R(I)": "#e67e22", "R(R)": "#d35400",
    }
    fig, ax = plt.subplots(figsize=(24, 8))
    price = df["close"]
    price_valid = price.loc[full_label_idx]
    ax.plot(price_valid.index, price_valid.values, color="black", linewidth=0.3, alpha=0.8)

    for idx_i in range(len(full_label_idx) - 1):
        comp = full_labels[idx_i]
        color = comp_colors.get(comp, "#cccccc")
        ax.axvspan(full_label_idx[idx_i], full_label_idx[idx_i + 1],
                   alpha=0.08, color=color, linewidth=0)

    ax.set_yscale("log")
    ax.set_ylabel("BTC/USDT (log)")
    ax.set_title(f"BTC Full History - 9-Composition Classification (Langevin Energy, W={window}h)")
    legend_elements = [
        Patch(facecolor=comp_colors[c], alpha=0.5, label=c)
        for c in ALL_COMPOSITIONS
    ]
    ax.legend(handles=legend_elements, loc="upper left", fontsize=7, ncol=3)
    ax.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(CHARTS_DIR / "03_regime_price_9comp_langevin.png", dpi=150)
    plt.close()
    print(f"  Saved {CHARTS_DIR / '03_regime_price_9comp_langevin.png'}")

    # --- Chart 4: Walk-forward comparison: pre-Langevin vs post-Langevin ---
    print("[CHART 4] Pre-Langevin vs post-Langevin comparison...")
    if pre_langevin_results:
        fig, axes = plt.subplots(1, 2, figsize=(18, 8))

        # Pre-Langevin results
        ax = axes[0]
        pre_ranking = pre_langevin_results.get("ranking", [])
        if pre_ranking:
            names_pre = [r["strategy"] for r in pre_ranking[:10]]
            sharpes_pre = [r["mean_sharpe"] for r in pre_ranking[:10]]
            colors_bar = ["#e74c3c" if "9C" in n else "#3498db" if "3R" in n else "#95a5a6"
                          for n in names_pre]
            ax.barh(range(len(names_pre)), sharpes_pre, color=colors_bar, alpha=0.8)
            ax.set_yticks(range(len(names_pre)))
            ax.set_yticklabels(names_pre, fontsize=7)
            ax.set_xlabel("Mean Sharpe")
            ax.set_title("Pre-Langevin (K-means)")
            ax.invert_yaxis()
            ax.axvline(x=0, color="black", linestyle="--", alpha=0.5)
            ax.grid(True, alpha=0.3, axis="x")

        # Post-Langevin results
        ax = axes[1]
        post_ranking = sorted(
            [(name, m) for name, m in agg_all.items() if m["n_windows"] > 0],
            key=lambda x: x[1].get("mean_sharpe", -999),
            reverse=True,
        )[:10]
        if post_ranking:
            names_post = [r[0] for r in post_ranking]
            sharpes_post = [r[1]["mean_sharpe"] for r in post_ranking]
            colors_bar = ["#e74c3c" if "9C" in n else "#3498db" if "3R" in n else "#95a5a6"
                          for n in names_post]
            ax.barh(range(len(names_post)), sharpes_post, color=colors_bar, alpha=0.8)
            ax.set_yticks(range(len(names_post)))
            ax.set_yticklabels(names_post, fontsize=7)
            ax.set_xlabel("Mean Sharpe")
            ax.set_title("Post-Langevin (Energy Landscape)")
            ax.invert_yaxis()
            ax.axvline(x=0, color="black", linestyle="--", alpha=0.5)
            ax.grid(True, alpha=0.3, axis="x")

        plt.suptitle("Phase C-2: K-means vs Energy Landscape Classification", fontsize=14)
        plt.tight_layout()
        plt.savefig(CHARTS_DIR / "04_pre_vs_post_langevin.png", dpi=150)
        plt.close()
        print(f"  Saved {CHARTS_DIR / '04_pre_vs_post_langevin.png'}")
    else:
        print("  [SKIP] No pre-Langevin results found for comparison")

    # --- Chart 5: Basin depth / width visualization ---
    print("[CHART 5] Basin parameters...")
    fig, axes = plt.subplots(1, 2, figsize=(14, 6))

    basin_names = [b.composition for b in landscape.basins]
    basin_depths = [b.depth for b in landscape.basins]
    basin_widths = [b.width for b in landscape.basins]

    ax = axes[0]
    bars = ax.bar(basin_names, basin_depths, color=["#e74c3c" if n.startswith("D") else
                  "#3498db" if n.startswith("I") else "#f39c12" for n in basin_names], alpha=0.8)
    ax.set_ylabel("Basin Depth (A_i)")
    ax.set_title("Basin Depths from Motif Library")
    ax.grid(True, alpha=0.3, axis="y")

    ax = axes[1]
    ax.bar(basin_names, basin_widths, color=["#e74c3c" if n.startswith("D") else
           "#3498db" if n.startswith("I") else "#f39c12" for n in basin_names], alpha=0.8)
    ax.set_ylabel("Basin Width (sigma_i)")
    ax.set_title("Basin Widths from Centroid Spacing")
    ax.grid(True, alpha=0.3, axis="y")

    plt.tight_layout()
    plt.savefig(CHARTS_DIR / "05_basin_parameters.png", dpi=150)
    plt.close()
    print(f"  Saved {CHARTS_DIR / '05_basin_parameters.png'}")


# ============================================================================
# Main
# ============================================================================

def main():
    print("=" * 70)
    print("  PHASE C-2 LANGEVIN: Energy Landscape Classification")
    print("=" * 70)
    print(f"  Key change: IMPOSING 9 basins from algebraic structure")
    print(f"  Classification: lowest energy (deepest basin pull), not K-means")

    DATA_DIR.mkdir(exist_ok=True)
    CHARTS_DIR.mkdir(parents=True, exist_ok=True)

    # ---- Load data ----
    print("\n" + "=" * 70)
    print("  LOADING DATA")
    print("=" * 70)

    df = load_extended_data()
    landscape = load_landscape()

    # Load pre-Langevin results for comparison
    pre_langevin_path = DATA_DIR / "phase_c2_pre_langevin_results.json"
    pre_langevin = None
    if pre_langevin_path.exists():
        with open(pre_langevin_path) as f:
            pre_langevin = json.load(f)
        print(f"[DATA] Loaded pre-Langevin results for comparison")

    # ---- Classify full dataset ----
    print("\n" + "=" * 70)
    print("  FULL DATASET CLASSIFICATION (Energy Landscape)")
    print("=" * 70)

    window = 24  # best performing in Phase A2
    print(f"  Computing features with window={window}...")
    full_classified = compute_features_and_classify(df, landscape, window=window)

    # Composition distribution
    warmup = 3 * window
    valid_mask = full_classified.index >= df.index[warmup]
    comp_dist = full_classified.loc[valid_mask, "composition"].value_counts()
    print(f"\n  Composition distribution (full dataset):")
    for comp, count in comp_dist.items():
        pct = count / comp_dist.sum() * 100
        print(f"    {comp:6s}: {count:6d} ({pct:5.1f}%)")

    # Transition matrix on full dataset
    full_labels = full_classified.loc[valid_mask, "composition"].values
    full_label_idx = full_classified.loc[valid_mask].index
    trans_matrix = compute_transition_matrix(full_labels)
    langevin_test = test_langevin_adjacency(trans_matrix)

    print(f"\n  Langevin adjacency test:")
    print(f"    Adjacent transitions (avg/pair): {langevin_test['avg_per_adjacent_pair']:.2f}")
    print(f"    Non-adjacent (avg/pair):         {langevin_test['avg_per_non_adjacent_pair']:.2f}")
    print(f"    Ratio:                           {langevin_test['ratio']:.2f}x")
    print(f"    Langevin confirmed:              {langevin_test['langevin_confirmed']}")

    # ---- Walk-Forward Backtest ----
    print("\n" + "=" * 70)
    print("  WALK-FORWARD BACKTEST (All Strategies)")
    print("=" * 70)

    # All strategies together - baselines, 3-regime, and 9-composition
    all_strategies = {
        # Baselines
        "Buy-and-Hold": BuyAndHoldStrategy(),
        "MA-Cross-50/200": MACrossoverStrategy(50, 200),
        "DIR-Original": OriginalDIRRegimeStrategy(),
        # 3-regime
        "3R-1-D-Only-Conservative": ThreeR1_DOnlyConservative(),
        "3R-2-D-Scaled-Entry": ThreeR2_DOnlyScaledEntry(),
        "3R-3-D-MultiTF": ThreeR3_DOnlyMultiTimeframe(),
        # 9-composition
        "9C-1-Ennea-Conservative": NineC1_EnneagramConservative(),
        "9C-2-Ennea-Full-Map": NineC2_EnneagramFullMap(),
        "9C-3-Barrier-Transition": NineC3_BarrierAwareTransition(),
    }

    wf_results = walk_forward_backtest(
        df, landscape, all_strategies,
        window=window, train_years=2, test_months=6,
    )
    agg_all = aggregate_wf_metrics(wf_results)

    # ---- Print Summary ----
    print(f"\n{'='*70}")
    print("  STRATEGY SUMMARY (Walk-Forward, Langevin Energy Classification)")
    print(f"{'='*70}")
    print(f"  {'Strategy':35s} | {'Return':>10s} | {'Sharpe':>8s} | {'MaxDD':>8s} | {'Trades':>8s} | {'WinRate':>8s}")
    print(f"  {'-'*35}-+-{'-'*10}-+-{'-'*8}-+-{'-'*8}-+-{'-'*8}-+-{'-'*8}")

    ranked = sorted(
        [(name, m) for name, m in agg_all.items() if m["n_windows"] > 0],
        key=lambda x: x[1].get("mean_sharpe", -999),
        reverse=True,
    )
    for sname, m in ranked:
        print(f"  {sname:35s} | {m['compounded_return']*100:+9.1f}% | {m['mean_sharpe']:+7.3f} | "
              f"{m['worst_drawdown']*100:7.1f}% | {m['total_trades']:7d} | {m['mean_win_rate']*100:6.1f}%")

    # ---- Charts ----
    print("\n" + "=" * 70)
    print("  GENERATING CHARTS")
    print("=" * 70)

    try:
        generate_charts(
            df, landscape, agg_all, trans_matrix,
            full_labels, full_label_idx, pre_langevin, window,
        )
    except Exception as e:
        print(f"[WARN] Chart generation error: {e}")
        import traceback
        traceback.print_exc()

    # ---- Save Results ----
    print("\n" + "=" * 70)
    print("  SAVING RESULTS")
    print("=" * 70)

    # Compare with pre-Langevin
    comparison = {}
    if pre_langevin:
        pre_ranking_map = {r["strategy"]: r for r in pre_langevin.get("ranking", [])}
        for sname, m in agg_all.items():
            if m["n_windows"] == 0:
                continue
            pre = pre_ranking_map.get(sname)
            if pre:
                comparison[sname] = {
                    "pre_langevin_sharpe": pre.get("mean_sharpe", 0),
                    "post_langevin_sharpe": m["mean_sharpe"],
                    "sharpe_delta": m["mean_sharpe"] - pre.get("mean_sharpe", 0),
                    "pre_langevin_return": pre.get("compounded_return", 0),
                    "post_langevin_return": m["compounded_return"],
                }

    # Determine if energy landscape adds edge
    best_strat_name = ranked[0][0] if ranked else "None"
    best_strat_sharpe = ranked[0][1]["mean_sharpe"] if ranked else 0
    bh_sharpe = agg_all.get("Buy-and-Hold", {}).get("mean_sharpe", 0)

    best_9c = max(
        [(n, m) for n, m in agg_all.items() if "9C" in n and m["n_windows"] > 0],
        key=lambda x: x[1].get("mean_sharpe", -999),
        default=(None, {"mean_sharpe": -999}),
    )
    best_3r = max(
        [(n, m) for n, m in agg_all.items() if "3R" in n and m["n_windows"] > 0],
        key=lambda x: x[1].get("mean_sharpe", -999),
        default=(None, {"mean_sharpe": -999}),
    )

    recommendation = []
    if best_strat_sharpe > bh_sharpe:
        recommendation.append(f"Best strategy ({best_strat_name}) beats buy-and-hold on Sharpe.")
    else:
        recommendation.append("No strategy consistently beats buy-and-hold on Sharpe.")

    if best_9c[0] and best_3r[0]:
        if best_9c[1]["mean_sharpe"] > best_3r[1]["mean_sharpe"]:
            recommendation.append(
                f"9-composition ({best_9c[0]}) beats 3-regime ({best_3r[0]}) -- "
                f"energy landscape adds granularity edge."
            )
        else:
            recommendation.append(
                f"3-regime ({best_3r[0]}) still beats 9-composition ({best_9c[0]}) -- "
                f"energy landscape does NOT add edge over simpler model."
            )

    if comparison:
        improved = sum(1 for v in comparison.values() if v["sharpe_delta"] > 0)
        total = len(comparison)
        recommendation.append(
            f"Langevin improved {improved}/{total} strategies vs K-means."
        )

    recommendation.append(f"Proceed to Phase D with: {best_strat_name}")

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
        "phase": "C2-Langevin",
        "classification_method": "langevin_energy_landscape",
        "classification_detail": (
            "9 basins IMPOSED from algebraic structure. "
            "Classification by lowest energy (deepest Gaussian well pull). "
            "Basin depths from motif library tier/domains. "
            "Basin widths from centroid spacing (nn_dist/6)."
        ),
        "data": {
            "source": "binance_btc_1h_full",
            "candles": len(df),
            "date_range": f"{df.index[0]} to {df.index[-1]}",
            "years": round((df.index[-1] - df.index[0]).days / 365, 1),
        },
        "energy_landscape": {
            "n_basins": len(landscape.basins),
            "basins": [
                {
                    "composition": b.composition,
                    "depth": float(b.depth),
                    "width": float(b.width),
                    "centroid": b.centroid.tolist(),
                }
                for b in landscape.basins
            ],
            "centre_energy": float(landscape.centre_energy),
        },
        "composition_distribution": {
            str(k): int(v) for k, v in comp_dist.items()
        },
        "transition_matrix": trans_matrix.tolist(),
        "langevin_adjacency_test": langevin_test,
        "walk_forward_config": {
            "train_years": 2,
            "test_months": 6,
            "step_months": 6,
            "feature_window": window,
        },
        "strategy_results": {
            k: {kk: clean_for_json(vv) for kk, vv in v.items() if kk != "per_window"}
            for k, v in agg_all.items()
        },
        "ranking": [
            {
                "rank": i + 1,
                "strategy": name,
                "mean_sharpe": float(m.get("mean_sharpe", 0)),
                "compounded_return": float(m.get("compounded_return", 0)),
                "worst_drawdown": float(m.get("worst_drawdown", 0)),
            }
            for i, (name, m) in enumerate(ranked)
        ],
        "pre_vs_post_langevin": comparison,
        "recommendation": recommendation,
        "phase_d_candidate": best_strat_name,
        "windows": wf_results["windows"],
    }

    results_path = DATA_DIR / "phase_c2_langevin_results.json"
    with open(results_path, "w") as f:
        json.dump(results, f, indent=2, default=str)
    print(f"\n  Results saved to {results_path}")

    # Final summary
    print(f"\n{'='*70}")
    print("  PHASE C-2 LANGEVIN: FINAL SUMMARY")
    print(f"{'='*70}")
    print(f"  Data: {len(df)} candles ({df.index[0].year}-{df.index[-1].year})")
    print(f"  Classification: Langevin energy landscape (9 imposed basins)")
    print(f"  Feature window: {window}h")
    print(f"\n  Strategy Ranking (by mean Sharpe):")
    for i, (name, m) in enumerate(ranked[:10]):
        print(f"    {i+1}. {name:35s} Sharpe={m.get('mean_sharpe', 0):+.3f}  "
              f"Return={m.get('compounded_return', 0)*100:+.1f}%  "
              f"MaxDD={m.get('worst_drawdown', 0)*100:.1f}%")

    print(f"\n  Recommendation:")
    for r in recommendation:
        print(f"    - {r}")

    if comparison:
        print(f"\n  Pre- vs Post-Langevin Comparison:")
        for sname, comp in comparison.items():
            delta = comp["sharpe_delta"]
            direction = "+" if delta > 0 else ""
            print(f"    {sname:35s} Sharpe: {comp['pre_langevin_sharpe']:+.3f} -> "
                  f"{comp['post_langevin_sharpe']:+.3f} ({direction}{delta:.3f})")

    print(f"\n  Charts saved to: {CHARTS_DIR}/")
    print(f"  Results saved to: {results_path}")


if __name__ == "__main__":
    main()
