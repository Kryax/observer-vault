"""
Price-Native Energy Landscape Classifier

Fits centroids FROM price data, then builds an energy landscape
using the same Gaussian well mathematics as the D/I/R engine.

Two modes:
  - K=3: Three basins (D-dominant, I-dominant, R-dominant).
    Labels from axis dominance.
  - K=9 constrained: Use D/I/R algebraic adjacency as a prior
    that penalises non-adjacent transitions during fitting.

Energy computation replicates energy-core.ts:
  E(x) = -Σ Aᵢ exp(-||x-cᵢ||²/2σᵢ²)
  Basin depths from cluster density
  Basin widths from nearest-neighbour distance / 6
  Adjacency-aware effective widths for barrier computation
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import numpy as np
from sklearn.cluster import KMeans


# ---------------------------------------------------------------------------
# D/I/R adjacency (shared operator rule)
# ---------------------------------------------------------------------------

ALL_COMPOSITIONS = [
    "D(D)", "D(I)", "D(R)", "I(D)", "I(I)", "I(R)", "R(D)", "R(I)", "R(R)",
]


def _shares_operator(a: str, b: str) -> bool:
    if a == b:
        return False
    return (a[0] == b[0] or a[2] == b[2] or
            a[0] == b[2] or a[2] == b[0])


ADJACENCY_MAP: dict[str, set[str]] = {}
for _a in ALL_COMPOSITIONS:
    ADJACENCY_MAP[_a] = {_b for _b in ALL_COMPOSITIONS if _shares_operator(_a, _b)}


# ---------------------------------------------------------------------------
# Basin data structures
# ---------------------------------------------------------------------------

@dataclass
class Basin:
    centroid: np.ndarray
    depth: float
    width: float
    label: str


@dataclass
class Landscape:
    basins: list[Basin]
    adjacency: dict[str, set[str]]
    centre_energy: float


# ---------------------------------------------------------------------------
# Core energy mathematics (port of energy-core.ts)
# ---------------------------------------------------------------------------

def _euclidean_distance(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.sqrt(np.sum((a - b) ** 2)))


def _compute_raw_energy(x: np.ndarray, basins: list[Basin]) -> float:
    """E(x) = -Σ Aᵢ exp(-||x - cᵢ||² / 2σᵢ²)"""
    total = 0.0
    for b in basins:
        dist_sq = float(np.sum((x - b.centroid) ** 2))
        total += b.depth * math.exp(-dist_sq / (2.0 * b.width * b.width))
    return -total


def _effective_width(from_b: Basin, to_b: Basin,
                     adjacency: dict[str, set[str]]) -> float:
    is_adj = to_b.label in adjacency.get(from_b.label, set())
    base = (from_b.width + to_b.width) / 2.0
    return base * 2.5 if is_adj else base * 0.5


def _compute_raw_energy_directed(
    x: np.ndarray, basins: list[Basin],
    from_b: Basin, to_b: Basin,
    adjacency: dict[str, set[str]],
) -> float:
    total = 0.0
    eff_w = _effective_width(from_b, to_b, adjacency)
    for b in basins:
        dist_sq = float(np.sum((x - b.centroid) ** 2))
        sigma = eff_w if (b is from_b or b is to_b) else b.width
        total += b.depth * math.exp(-dist_sq / (2.0 * sigma * sigma))
    return -total


def _compute_gradient(x: np.ndarray, basins: list[Basin]) -> np.ndarray:
    dim = len(x)
    grad = np.zeros(dim)
    for b in basins:
        diff = x - b.centroid
        dist_sq = float(np.sum(diff ** 2))
        g = b.depth * math.exp(-dist_sq / (2.0 * b.width * b.width))
        grad += g * diff / (b.width * b.width)
    return grad


def _estimate_barrier(
    start: np.ndarray, target: np.ndarray,
    basins: list[Basin], adjacency: dict[str, set[str]],
    from_b: Optional[Basin] = None, to_b: Optional[Basin] = None,
    samples: int = 20,
) -> float:
    max_e = -float("inf")
    for s in range(samples + 1):
        t = s / samples
        point = start * (1.0 - t) + target * t
        if from_b and to_b:
            e = _compute_raw_energy_directed(point, basins, from_b, to_b, adjacency)
        else:
            e = _compute_raw_energy(point, basins)
        if e > max_e:
            max_e = e
    return max_e


# ---------------------------------------------------------------------------
# Label assignment for K=3 and K=9
# ---------------------------------------------------------------------------

# 6D vector: [D, I, R, temporal, density, entropy]
# D-axis = dims 0, I-axis = dims 1, R-axis = dims 2

def _label_k3(centroid: np.ndarray) -> str:
    """Label by dominant axis."""
    d, i, r = centroid[0], centroid[1], centroid[2]
    dominant = max((d, "D"), (i, "I"), (r, "R"), key=lambda x: x[0])
    return dominant[1]


def _label_k3_relative(centroids: np.ndarray) -> list[str]:
    """
    Label K=3 centroids by relative role, not absolute axis dominance.
    Assign D, I, R such that:
      - D = highest D/I ratio (most D-dominant relative to I)
      - I = highest I/D ratio (most I-dominant relative to D)
      - R = remaining (the transitional / recursive state)
    This ensures all three labels are used even when R-axis is universally low.
    """
    n = len(centroids)
    if n != 3:
        # Fallback for non-3 clusters
        return [_label_k3(c) for c in centroids]

    d_vals = centroids[:, 0]
    i_vals = centroids[:, 1]

    # Ratio-based assignment
    d_ratio = d_vals / (i_vals + 1e-10)  # high = more D-like
    i_ratio = i_vals / (d_vals + 1e-10)  # high = more I-like

    labels = [""] * 3
    used = set()

    # Assign D to highest d_ratio
    d_idx = int(np.argmax(d_ratio))
    labels[d_idx] = "D"
    used.add(d_idx)

    # Assign I to highest i_ratio among remaining
    remaining = [j for j in range(3) if j not in used]
    i_idx = max(remaining, key=lambda j: i_ratio[j])
    labels[i_idx] = "I"
    used.add(i_idx)

    # Remaining = R
    r_idx = [j for j in range(3) if j not in used][0]
    labels[r_idx] = "R"

    return labels


def _label_k9(centroid: np.ndarray, idx: int) -> str:
    """
    Label by dominant outer and inner operator from 6D vector.
    Outer = strongest of D/I/R, inner = second strongest.
    """
    scores = {"D": centroid[0], "I": centroid[1], "R": centroid[2]}
    ranked = sorted(scores.items(), key=lambda x: -x[1])
    outer = ranked[0][0]
    inner = ranked[1][0]
    label = f"{outer}({inner})"
    return label


def _assign_k9_labels(centroids: np.ndarray) -> list[str]:
    """
    Assign 9-composition labels to K=9 centroids.
    Uses a greedy assignment to avoid duplicate labels.
    """
    n = len(centroids)
    # Score each centroid for each composition
    scores = np.zeros((n, 9))
    for i in range(n):
        d, ix, r = centroids[i, 0], centroids[i, 1], centroids[i, 2]
        vals = {"D": d, "I": ix, "R": r}
        for j, comp in enumerate(ALL_COMPOSITIONS):
            outer, inner = comp[0], comp[2]
            # Score = outer_val * 2 + inner_val (outer matters more)
            scores[i, j] = vals[outer] * 2.0 + vals[inner]

    # Greedy assignment: best score first
    labels = [""] * n
    used_comps: set[int] = set()
    used_centroids: set[int] = set()

    flat_order = np.argsort(-scores.ravel())
    for flat_idx in flat_order:
        ci = int(flat_idx // 9)
        cj = int(flat_idx % 9)
        if ci in used_centroids or cj in used_comps:
            continue
        labels[ci] = ALL_COMPOSITIONS[cj]
        used_centroids.add(ci)
        used_comps.add(cj)
        if len(used_centroids) == n:
            break

    # Fill any remaining with index-based fallback
    for i in range(n):
        if not labels[i]:
            for j in range(9):
                if j not in used_comps:
                    labels[i] = ALL_COMPOSITIONS[j]
                    used_comps.add(j)
                    break
            if not labels[i]:
                labels[i] = f"C{i}"

    return labels


# ---------------------------------------------------------------------------
# Constrained K-means with adjacency prior
# ---------------------------------------------------------------------------

def _adjacency_constrained_kmeans(
    vectors: np.ndarray, k: int = 9,
    max_iter: int = 30, n_init: int = 3,
) -> tuple[np.ndarray, np.ndarray]:
    """
    K-means with adjacency-aware transition penalty (vectorized).

    1. Standard K-means++ init
    2. Vectorized distance computation with adjacency penalty on transitions
    """
    from scipy.spatial.distance import cdist

    best_inertia = float("inf")
    best_centers = None
    best_labels = None

    for _ in range(n_init):
        km = KMeans(n_clusters=k, init="k-means++", n_init=1,
                    max_iter=max_iter, random_state=None)
        km.fit(vectors)
        centers = km.cluster_centers_.copy()

        # Build adjacency penalty matrix (k x k)
        comp_labels = _assign_k9_labels(centers)
        penalty = np.ones((k, k))
        for ci in range(k):
            for cj in range(k):
                if ci == cj:
                    continue
                li, lj = comp_labels[ci], comp_labels[cj]
                adj = ADJACENCY_MAP.get(li, set())
                if lj not in adj and li != lj:
                    penalty[ci, cj] = 1.2  # 20% penalty for non-adjacent

        # Vectorized assignment with adjacency penalty
        for iteration in range(max_iter):
            # All pairwise distances: (n, k)
            dists = cdist(vectors, centers, metric="sqeuclidean")

            # Apply adjacency penalty based on previous row's assignment
            labels = np.argmin(dists, axis=1)

            # One pass: apply penalty and re-assign
            for i in range(1, len(vectors)):
                prev = labels[i - 1]
                dists[i] *= penalty[prev]
                labels[i] = np.argmin(dists[i])

            # Update centroids
            new_centers = np.zeros_like(centers)
            for c in range(k):
                mask = labels == c
                if mask.sum() > 0:
                    new_centers[c] = vectors[mask].mean(axis=0)
                else:
                    new_centers[c] = centers[c]

            if np.allclose(centers, new_centers, atol=1e-6):
                centers = new_centers
                break
            centers = new_centers

        inertia = sum(
            np.sum((vectors[labels == c] - centers[c]) ** 2)
            for c in range(k) if (labels == c).sum() > 0
        )
        if inertia < best_inertia:
            best_inertia = inertia
            best_centers = centers
            best_labels = labels

    return best_centers, best_labels


# ---------------------------------------------------------------------------
# PriceLandscape
# ---------------------------------------------------------------------------

class PriceLandscape:
    """
    Fits centroids FROM price data, then builds energy landscape
    using the same mathematics as the D/I/R engine.
    """

    def __init__(self):
        self.landscape: Optional[Landscape] = None
        self.k: int = 3
        self.labels_: Optional[np.ndarray] = None
        self.centroids_: Optional[np.ndarray] = None
        self.basin_labels_: Optional[list[str]] = None
        self.use_adjacency: bool = False

    def fit(self, vectors: np.ndarray, k: int = 3,
            use_adjacency_prior: bool = False) -> 'PriceLandscape':
        """
        Fit centroids from price 6D vectors.

        If k=3: standard K-means, label by dominant axis
        If k=9 + adjacency_prior: constrained K-means with adjacency penalty
        """
        self.k = k
        self.use_adjacency = use_adjacency_prior

        if k == 9 and use_adjacency_prior:
            centers, labels = _adjacency_constrained_kmeans(vectors, k=9)
            self.centroids_ = centers
            self.labels_ = labels
            self.basin_labels_ = _assign_k9_labels(centers)
        else:
            km = KMeans(n_clusters=k, init="k-means++", n_init=10,
                        max_iter=300, random_state=42)
            km.fit(vectors)
            self.centroids_ = km.cluster_centers_
            self.labels_ = km.labels_

            if k == 3:
                self.basin_labels_ = _label_k3_relative(self.centroids_)
            elif k == 9:
                self.basin_labels_ = _assign_k9_labels(self.centroids_)
            else:
                self.basin_labels_ = [_label_k3(c) for c in self.centroids_]
                # Disambiguate
                seen = {}
                for i, lbl in enumerate(self.basin_labels_):
                    if lbl in seen:
                        seen[lbl] += 1
                        self.basin_labels_[i] = f"{lbl}_{seen[lbl]}"
                    else:
                        seen[lbl] = 1

        # Build energy landscape
        self._build_landscape(vectors)
        return self

    def _build_landscape(self, vectors: np.ndarray) -> None:
        """Construct Gaussian wells from fitted centroids."""
        n_basins = len(self.centroids_)

        # Basin depths from cluster density (denser = deeper)
        counts = np.bincount(self.labels_, minlength=n_basins).astype(float)
        max_count = max(counts.max(), 1.0)
        depths = 0.5 + 1.5 * (counts / max_count)  # range [0.5, 2.0]

        # Basin widths from nearest-neighbour distance / 6
        widths = []
        for i in range(n_basins):
            min_dist = float("inf")
            for j in range(n_basins):
                if i == j:
                    continue
                d = _euclidean_distance(self.centroids_[i], self.centroids_[j])
                if d < min_dist:
                    min_dist = d
            widths.append(max(min_dist / 6.0, 0.01))

        # Build basins
        basins = []
        for i in range(n_basins):
            basins.append(Basin(
                centroid=self.centroids_[i],
                depth=float(depths[i]),
                width=widths[i],
                label=self.basin_labels_[i],
            ))

        # Adjacency: use D/I/R adjacency if K=9, else all-pairs
        if self.k == 9 and self.use_adjacency:
            adjacency = ADJACENCY_MAP
        else:
            # All basins equidistant (no adjacency structure)
            adjacency = {}
            for b in basins:
                adjacency[b.label] = {b2.label for b2 in basins if b2.label != b.label}

        dim = len(self.centroids_[0])
        centre = np.full(dim, 1.0 / math.sqrt(dim))
        centre_energy = _compute_raw_energy(centre, basins)

        self.landscape = Landscape(
            basins=basins,
            adjacency=adjacency,
            centre_energy=centre_energy,
        )

    def classify(self, vector: np.ndarray) -> dict:
        """Returns basin label, confidence, energy, transition_score."""
        assert self.landscape is not None, "Must call fit() first"
        er = self._compute_energy(vector)
        # Confidence: inverse distance to nearest centroid, normalized
        dists = [_euclidean_distance(vector, b.centroid) for b in self.landscape.basins]
        min_d = min(dists)
        max_d = max(dists) if max(dists) > 0 else 1.0
        confidence = 1.0 - (min_d / max_d)
        return {
            "label": er["nearest_basin"],
            "confidence": confidence,
            "energy": er["energy"],
            "transition_score": er["transition_score"],
        }

    def classify_batch(self, vectors: np.ndarray) -> list[dict]:
        """Classify all vectors at once."""
        return [self.classify(vectors[i]) for i in range(len(vectors))]

    def energy(self, vector: np.ndarray) -> dict:
        """Full energy computation."""
        return self._compute_energy(vector)

    def transition(self, vector: np.ndarray,
                   history: Optional[list[np.ndarray]] = None) -> dict:
        """Barrier-aware transition prediction."""
        assert self.landscape is not None
        basins = self.landscape.basins
        adjacency = self.landscape.adjacency
        er = self._compute_energy(vector)
        current = er["nearest_basin"]

        adj_set = adjacency.get(current, set())
        barriers: dict[str, float] = {}
        current_obj = next((b for b in basins if b.label == current), None)
        for adj_label in adj_set:
            target = next((b for b in basins if b.label == adj_label), None)
            if not target or not current_obj:
                continue
            barrier = _estimate_barrier(
                vector, target.centroid, basins, adjacency,
                current_obj, target,
            )
            barriers[adj_label] = barrier - er["energy"]

        predicted = [k for k, _ in sorted(barriers.items(), key=lambda x: x[1])]

        time_in_basin = 0
        if history:
            for h in reversed(history):
                hr = self._compute_energy(h)
                if hr["nearest_basin"] == current:
                    time_in_basin += 1
                else:
                    break

        return {
            "current_basin": current,
            "transition_score": er["transition_score"],
            "predicted_next": predicted,
            "barrier_heights": barriers,
            "time_in_basin": time_in_basin,
        }

    def _compute_energy(self, vector: np.ndarray) -> dict:
        """Core energy computation — port of computeEnergy from energy-core.ts."""
        basins = self.landscape.basins
        adjacency = self.landscape.adjacency
        energy = _compute_raw_energy(vector, basins)
        gradient = _compute_gradient(vector, basins)

        dists = [_euclidean_distance(vector, b.centroid) for b in basins]
        sorted_idx = np.argsort(dists)
        nearest_idx = sorted_idx[0]
        second_idx = sorted_idx[1]
        nearest = basins[nearest_idx]
        second = basins[second_idx]

        barrier = _estimate_barrier(
            vector, second.centroid, basins, adjacency, nearest, second,
        )

        basin_energy = _compute_raw_energy(nearest.centroid, basins)
        current_depth = energy - basin_energy
        ridge_height = barrier - basin_energy
        if ridge_height > 0:
            transition_score = min(1.0, current_depth / ridge_height)
        else:
            transition_score = 0.0

        return {
            "energy": energy,
            "nearest_basin": nearest.label,
            "basin_depth": nearest.depth,
            "distance_to_centre": dists[nearest_idx],
            "barrier_to_second": barrier - energy,
            "transition_score": max(0.0, min(1.0, transition_score)),
            "gradient": gradient,
        }

    def get_regime_for_label(self, label: str) -> str:
        """Map any label to its primary regime (D, I, or R)."""
        if not label:
            return "I"  # default
        if self.k == 3:
            return label[0]  # "D", "I", or "R"
        # K=9: outer operator is the primary regime
        if len(label) >= 4 and label[1] == "(":
            return label[0]
        return label[0]

    def save(self, path: str) -> None:
        """Save fitted landscape to JSON."""
        assert self.landscape is not None
        data = {
            "k": self.k,
            "use_adjacency": self.use_adjacency,
            "centroids": [c.tolist() for c in self.centroids_],
            "labels": self.basin_labels_,
            "basin_depths": [b.depth for b in self.landscape.basins],
            "basin_widths": [b.width for b in self.landscape.basins],
        }
        Path(path).write_text(json.dumps(data, indent=2))

    @classmethod
    def load(cls, path: str) -> 'PriceLandscape':
        """Load a saved landscape."""
        data = json.loads(Path(path).read_text())
        obj = cls()
        obj.k = data["k"]
        obj.use_adjacency = data.get("use_adjacency", False)
        obj.centroids_ = np.array(data["centroids"])
        obj.basin_labels_ = data["labels"]

        n_basins = len(obj.centroids_)
        depths = data.get("basin_depths", [1.0] * n_basins)
        widths = data.get("basin_widths", [0.1] * n_basins)

        basins = []
        for i in range(n_basins):
            basins.append(Basin(
                centroid=obj.centroids_[i],
                depth=depths[i],
                width=widths[i],
                label=obj.basin_labels_[i],
            ))

        if obj.k == 9 and obj.use_adjacency:
            adjacency = ADJACENCY_MAP
        else:
            adjacency = {}
            for b in basins:
                adjacency[b.label] = {b2.label for b2 in basins if b2.label != b.label}

        dim = len(obj.centroids_[0])
        centre = np.full(dim, 1.0 / math.sqrt(dim))
        centre_energy = _compute_raw_energy(centre, basins)

        obj.landscape = Landscape(basins=basins, adjacency=adjacency, centre_energy=centre_energy)
        return obj
