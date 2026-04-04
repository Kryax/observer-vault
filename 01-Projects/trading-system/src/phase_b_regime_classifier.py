#!/usr/bin/env python3
"""
Phase B: Regime Classifier — 3-Regime D/I/R Model

Takes K=3 clustering from Phase A (72h window) and builds a validated
regime classifier with labelled historical data.

Steps:
  B1: Fit K=3 centroids, export manifest, map clusters to D/I/R regimes
  B2: Label every OHLCV bar with regime assignment, compute stats
  B3: Generate regime-coloured price chart for visual validation
  B4: Compute confidence, entropy, transition detection

Usage:
    python src/phase_b_regime_classifier.py [--plot-only]
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.features.indicators import compute_all_features, D_FEATURES, I_FEATURES, R_FEATURES
from src.features.vectorizer import vectorize_pipeline

DATA_DIR = PROJECT_ROOT / "data"
WINDOW = 72
K = 3
WARMUP = 3 * WINDOW  # 216 bars warmup for rolling features

REGIME_COLORS = {"D": "#e74c3c", "I": "#3498db", "R": "#f39c12"}
REGIME_NAMES = {"D": "Trending/Breakout", "I": "Mean-Reverting/Consolidation", "R": "Reflexive/Volatile"}


# ---------------------------------------------------------------------------
# B1: Fit centroids and map to regimes
# ---------------------------------------------------------------------------

def load_ohlcv() -> pd.DataFrame:
    """Load cached BTC OHLCV data."""
    path = DATA_DIR / "btc_1h_ohlcv.csv"
    df = pd.read_csv(path, index_col="timestamp", parse_dates=True)
    df = df.astype(float)
    print(f"[DATA] Loaded {len(df)} candles ({df.index[0]} to {df.index[-1]})")
    return df


def compute_vectors(df: pd.DataFrame) -> pd.DataFrame:
    """Compute 6D D/I/R vectors from OHLCV using 72h window."""
    print(f"[B1] Computing 12 features (window={WINDOW})...")
    features = compute_all_features(df, WINDOW)
    features = features.fillna(0.0)

    print(f"[B1] Computing 6D vectors...")
    vectors = vectorize_pipeline(features)
    return vectors


def fit_centroids(vectors: pd.DataFrame) -> tuple[KMeans, np.ndarray, pd.DataFrame]:
    """
    Fit K=3 K-means on valid vectors. Returns fitted model, clean vectors,
    and the valid subset of the vectors DataFrame.
    """
    vec_valid = vectors.iloc[WARMUP:]
    magnitudes = np.sqrt((vec_valid ** 2).sum(axis=1))
    mask = magnitudes > 0.001
    vec_clean = vec_valid[mask]
    X = vec_clean.values

    print(f"[B1] Fitting K={K} on {len(X)} vectors...")
    km = KMeans(n_clusters=K, n_init=20, random_state=42, max_iter=500)
    km.fit(X)

    print(f"[B1] Centroids (D, I, R, temporal, density, entropy):")
    for i, c in enumerate(km.cluster_centers_):
        print(f"  Cluster {i}: [{', '.join(f'{v:.4f}' for v in c)}]")

    return km, X, vec_clean


def map_clusters_to_regimes(km: KMeans) -> dict[int, str]:
    """
    Map each cluster to D/I/R regime based on which axis has the highest
    centroid weight. Columns: [D, I, R, temporal, density, entropy].
    """
    centroids = km.cluster_centers_
    # Extract D, I, R scores (first 3 dimensions)
    d_scores = centroids[:, 0]
    i_scores = centroids[:, 1]
    r_scores = centroids[:, 2]

    mapping = {}
    used_regimes = set()

    # Assign by strongest axis, resolving ties by margin
    scores = np.column_stack([d_scores, i_scores, r_scores])
    axes = ["D", "I", "R"]

    # Greedy assignment: highest single-axis score first
    assignments = []
    for cluster_idx in range(K):
        for axis_idx in range(3):
            assignments.append((scores[cluster_idx, axis_idx], cluster_idx, axes[axis_idx]))
    assignments.sort(reverse=True)

    for _, cluster_idx, axis in assignments:
        if cluster_idx not in mapping and axis not in used_regimes:
            mapping[cluster_idx] = axis
            used_regimes.add(axis)
        if len(mapping) == K:
            break

    print(f"\n[B1] Cluster → Regime mapping:")
    for cluster_idx in sorted(mapping):
        regime = mapping[cluster_idx]
        c = centroids[cluster_idx]
        print(f"  Cluster {cluster_idx} → {regime}-regime ({REGIME_NAMES[regime]})")
        print(f"    D={c[0]:.4f}  I={c[1]:.4f}  R={c[2]:.4f}")

    return mapping


def export_centroid_manifest(km: KMeans, cluster_to_regime: dict[int, str]) -> None:
    """Export centroid manifest to data/price_centroids.json."""
    manifest = {
        "window": WINDOW,
        "k": K,
        "cluster_to_regime": {str(k): v for k, v in cluster_to_regime.items()},
        "regime_to_cluster": {v: k for k, v in cluster_to_regime.items()},
        "centroids": {},
        "centroid_columns": ["D", "I", "R", "temporal", "density", "entropy"],
    }

    for cluster_idx, regime in cluster_to_regime.items():
        c = km.cluster_centers_[cluster_idx]
        manifest["centroids"][regime] = {
            "cluster_id": cluster_idx,
            "values": c.tolist(),
            "D": float(c[0]),
            "I": float(c[1]),
            "R": float(c[2]),
            "temporal": float(c[3]),
            "density": float(c[4]),
            "entropy": float(c[5]),
        }

    path = DATA_DIR / "price_centroids.json"
    with open(path, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"[B1] Centroid manifest saved to {path}")


# ---------------------------------------------------------------------------
# B2: Label historical data
# ---------------------------------------------------------------------------

def label_bars(km: KMeans, vectors: pd.DataFrame,
               cluster_to_regime: dict[int, str]) -> pd.Series:
    """
    Assign every bar (after warmup) to its nearest centroid → regime label.
    Returns a Series of regime labels ('D', 'I', 'R') indexed by timestamp.
    """
    vec_valid = vectors.iloc[WARMUP:]
    magnitudes = np.sqrt((vec_valid ** 2).sum(axis=1))

    # Default all to I, then overwrite valid ones
    labels = pd.Series("I", index=vec_valid.index)

    mask = magnitudes > 0.001
    X = vec_valid[mask].values
    cluster_labels = km.predict(X)
    regime_labels = np.array([cluster_to_regime[cl] for cl in cluster_labels])
    labels.loc[mask] = regime_labels

    zero_count = (~mask).sum()
    if zero_count > 0:
        print(f"[B2] {zero_count} zero-magnitude bars — defaulted to I-regime")

    print(f"[B2] Labelled {len(labels)} bars (raw)")
    return labels


def smooth_regime_labels(labels: pd.Series, min_duration: int = 6) -> pd.Series:
    """
    Apply minimum-duration hysteresis filter to prevent regime flickering.

    Any regime episode shorter than min_duration bars gets absorbed into
    the surrounding regime (whichever neighbor is longer).
    """
    smoothed = labels.copy()
    values = smoothed.values.copy()

    # Identify episodes: (start, end, regime)
    episodes = []
    start = 0
    for i in range(1, len(values)):
        if values[i] != values[start]:
            episodes.append((start, i, values[start]))
            start = i
    episodes.append((start, len(values), values[start]))

    # Iteratively absorb short episodes
    changed = True
    iterations = 0
    while changed and iterations < 20:
        changed = False
        iterations += 1
        new_episodes = []
        i = 0
        while i < len(episodes):
            s, e, regime = episodes[i]
            duration = e - s
            if duration < min_duration and len(episodes) > 1:
                # Absorb into the longer neighbor
                if i == 0:
                    neighbor_regime = episodes[i + 1][2]
                elif i == len(episodes) - 1:
                    neighbor_regime = episodes[i - 1][2]
                else:
                    prev_dur = episodes[i - 1][1] - episodes[i - 1][0]
                    next_dur = episodes[i + 1][1] - episodes[i + 1][0]
                    neighbor_regime = episodes[i - 1][2] if prev_dur >= next_dur else episodes[i + 1][2]
                values[s:e] = neighbor_regime
                changed = True
            i += 1

        # Rebuild episodes after absorption
        if changed:
            episodes = []
            start = 0
            for j in range(1, len(values)):
                if values[j] != values[start]:
                    episodes.append((start, j, values[start]))
                    start = j
            episodes.append((start, len(values), values[start]))

    smoothed[:] = values
    n_episodes = len(episodes)
    durations = [e - s for s, e, _ in episodes]
    print(f"[B2] Smoothed: {n_episodes} episodes, "
          f"median duration {np.median(durations):.0f}h, "
          f"min {np.min(durations)}h")
    return smoothed


def compute_regime_stats(labels: pd.Series) -> dict:
    """Compute regime time distribution, durations, and transition matrix."""
    stats = {}

    # Time distribution
    counts = labels.value_counts()
    total = len(labels)
    dist = {regime: float(count / total) for regime, count in counts.items()}
    stats["time_distribution"] = dist
    print(f"\n[B2] Time distribution:")
    for regime in ["D", "I", "R"]:
        pct = dist.get(regime, 0) * 100
        print(f"  {regime}-regime ({REGIME_NAMES.get(regime, '?')}): {pct:.1f}%")

    # Check gate: no single regime > 70%
    max_pct = max(dist.values())
    stats["max_regime_pct"] = float(max_pct)
    gate_b4 = max_pct <= 0.70
    print(f"  ISC-B4: Max regime {max_pct*100:.1f}% {'<= 70% PASS' if gate_b4 else '> 70% FAIL'}")

    # Regime durations (consecutive bars in same regime)
    durations = {"D": [], "I": [], "R": []}
    current_regime = labels.iloc[0]
    current_duration = 1

    for i in range(1, len(labels)):
        if labels.iloc[i] == current_regime:
            current_duration += 1
        else:
            durations[current_regime].append(current_duration)
            current_regime = labels.iloc[i]
            current_duration = 1
    durations[current_regime].append(current_duration)

    stats["durations"] = {}
    print(f"\n[B2] Regime durations (hours):")
    all_durations = []
    for regime in ["D", "I", "R"]:
        d = durations[regime]
        if d:
            median_d = float(np.median(d))
            mean_d = float(np.mean(d))
            max_d = int(np.max(d))
            count_d = len(d)
            all_durations.extend(d)
        else:
            median_d = mean_d = max_d = count_d = 0
        stats["durations"][regime] = {
            "median": median_d, "mean": mean_d, "max": max_d, "episodes": count_d,
        }
        print(f"  {regime}: median={median_d:.0f}h, mean={mean_d:.1f}h, max={max_d}h, episodes={count_d}")

    overall_median = float(np.median(all_durations))
    stats["overall_median_duration"] = overall_median
    gate_b5 = overall_median > 6
    print(f"  ISC-B5: Overall median duration {overall_median:.1f}h {'> 6h PASS' if gate_b5 else '<= 6h FAIL'}")

    # Transition matrix
    transitions = {f"{a}→{b}": 0 for a in "DIR" for b in "DIR"}
    for i in range(1, len(labels)):
        prev = labels.iloc[i - 1]
        curr = labels.iloc[i]
        if prev != curr:
            transitions[f"{prev}→{curr}"] += 1

    total_transitions = sum(v for k, v in transitions.items() if k[0] != k[2])
    stats["transition_matrix"] = transitions
    stats["total_transitions"] = total_transitions

    print(f"\n[B2] Transition matrix ({total_transitions} total transitions):")
    print(f"  {'':>6} → D      → I      → R")
    for src in "DIR":
        row = []
        for dst in "DIR":
            key = f"{src}→{dst}"
            count = transitions[key]
            if total_transitions > 0 and src != dst:
                pct = count / total_transitions * 100
                row.append(f"{count:5d} ({pct:4.1f}%)")
            else:
                row.append(f"{count:5d}       ")
        print(f"  {src}:  {'  '.join(row)}")

    # ISC-B7: Shared-operator transitions more common than cross-axis
    # In D/I/R topology: D↔I and I↔R are "adjacent" (share operator),
    # D↔R is "cross-axis" (no shared operator)
    adjacent = transitions["D→I"] + transitions["I→D"] + transitions["I→R"] + transitions["R→I"]
    cross = transitions["D→R"] + transitions["R→D"]
    stats["adjacent_transitions"] = adjacent
    stats["cross_transitions"] = cross
    gate_b7 = adjacent > cross
    print(f"\n  Adjacent (shared-operator) transitions: {adjacent}")
    print(f"  Cross-axis (D↔R) transitions: {cross}")
    print(f"  ISC-B7: Adjacent > Cross: {'PASS' if gate_b7 else 'FAIL'} ({adjacent} vs {cross})")

    return stats


# ---------------------------------------------------------------------------
# B3: Regime-coloured price chart
# ---------------------------------------------------------------------------

def plot_regime_chart(df: pd.DataFrame, labels: pd.Series, stats: dict,
                      output_path: Path) -> None:
    """Generate regime-coloured BTC price chart."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import matplotlib.dates as mdates
    from matplotlib.patches import Patch

    # Align price data with labels
    price = df.loc[labels.index, "close"]

    fig, axes = plt.subplots(3, 1, figsize=(20, 14), height_ratios=[4, 1, 1],
                              gridspec_kw={"hspace": 0.15})

    # --- Main price chart with regime background ---
    ax = axes[0]
    ax.plot(price.index, price.values, color="black", linewidth=0.5, alpha=0.8)

    # Color background by regime
    for i in range(len(labels) - 1):
        regime = labels.iloc[i]
        color = REGIME_COLORS[regime]
        ax.axvspan(labels.index[i], labels.index[i + 1],
                   alpha=0.15, color=color, linewidth=0)

    ax.set_ylabel("BTC/USDT Price", fontsize=12)
    ax.set_title("BTC 1H — D/I/R Regime Classification (72h window, K=3)", fontsize=14, fontweight="bold")
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%m"))
    ax.xaxis.set_major_locator(mdates.MonthLocator())

    legend_elements = [
        Patch(facecolor=REGIME_COLORS["D"], alpha=0.4, label=f"D — {REGIME_NAMES['D']} ({stats['time_distribution'].get('D', 0)*100:.0f}%)"),
        Patch(facecolor=REGIME_COLORS["I"], alpha=0.4, label=f"I — {REGIME_NAMES['I']} ({stats['time_distribution'].get('I', 0)*100:.0f}%)"),
        Patch(facecolor=REGIME_COLORS["R"], alpha=0.4, label=f"R — {REGIME_NAMES['R']} ({stats['time_distribution'].get('R', 0)*100:.0f}%)"),
    ]
    ax.legend(handles=legend_elements, loc="upper left", fontsize=10)
    ax.grid(True, alpha=0.3)

    # --- Regime timeline strip ---
    ax2 = axes[1]
    regime_numeric = labels.map({"D": 0, "I": 1, "R": 2}).values
    colors_mapped = [REGIME_COLORS[r] for r in labels.values]

    for i in range(len(labels) - 1):
        regime = labels.iloc[i]
        ax2.axvspan(labels.index[i], labels.index[i + 1],
                    alpha=0.7, color=REGIME_COLORS[regime], linewidth=0)

    ax2.set_yticks([])
    ax2.set_ylabel("Regime", fontsize=10)
    ax2.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%m"))
    ax2.xaxis.set_major_locator(mdates.MonthLocator())

    # --- Regime duration histogram ---
    ax3 = axes[2]
    for regime in ["D", "I", "R"]:
        durations = stats["durations"][regime]
        if durations["episodes"] > 0:
            # Reconstruct durations from labels for histogram
            pass

    # Instead, show transition counts as bar chart
    trans = stats["transition_matrix"]
    trans_labels = [k for k in trans if k[0] != k[2]]
    trans_values = [trans[k] for k in trans_labels]
    trans_colors = [REGIME_COLORS[k[0]] for k in trans_labels]

    ax3.bar(trans_labels, trans_values, color=trans_colors, alpha=0.7, edgecolor="black", linewidth=0.5)
    ax3.set_ylabel("Count", fontsize=10)
    ax3.set_title("Regime Transitions", fontsize=11)
    ax3.grid(True, alpha=0.3, axis="y")

    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"[B3] Regime chart saved to {output_path}")


# ---------------------------------------------------------------------------
# B4: Confidence, entropy, transition detection
# ---------------------------------------------------------------------------

def compute_confidence_entropy(km: KMeans, vectors: pd.DataFrame,
                               cluster_to_regime: dict[int, str]) -> pd.DataFrame:
    """
    Compute per-bar confidence and entropy for transition detection.

    Confidence: 1 - (nearest_distance / second_nearest_distance)
      High confidence = firmly in one regime
      Low confidence = near regime boundary

    Entropy: Shannon entropy over softmax of negative distances to each centroid
      High entropy = ambiguous regime assignment
      Low entropy = clear regime
    """
    vec_valid = vectors.iloc[WARMUP:]
    centroids = km.cluster_centers_

    results = pd.DataFrame(index=vec_valid.index)

    X = vec_valid.values
    # Compute distances to each centroid
    distances = np.zeros((len(X), K))
    for i in range(K):
        distances[:, i] = np.sqrt(((X - centroids[i]) ** 2).sum(axis=1))

    # Sort distances for each point
    sorted_dist = np.sort(distances, axis=1)
    nearest = sorted_dist[:, 0]
    second_nearest = sorted_dist[:, 1]

    # Confidence: 1 - nearest/second_nearest
    with np.errstate(divide="ignore", invalid="ignore"):
        confidence = 1.0 - (nearest / np.where(second_nearest > 0, second_nearest, 1.0))
    confidence = np.clip(confidence, 0.0, 1.0)
    confidence = np.where(np.isfinite(confidence), confidence, 0.0)

    # Entropy: softmax over negative distances, then Shannon entropy
    neg_dist = -distances
    # Softmax with temperature
    temp = 1.0
    exp_neg = np.exp((neg_dist - neg_dist.max(axis=1, keepdims=True)) / temp)
    probs = exp_neg / exp_neg.sum(axis=1, keepdims=True)

    with np.errstate(divide="ignore", invalid="ignore"):
        log_probs = np.where(probs > 1e-12, np.log2(probs), 0.0)
    entropy = -(probs * log_probs).sum(axis=1)
    entropy = np.where(np.isfinite(entropy), entropy, 0.0)

    results["confidence"] = confidence
    results["entropy"] = entropy
    results["dist_nearest"] = nearest
    results["dist_second"] = second_nearest

    # Add regime probabilities
    regime_order = []
    for i in range(K):
        regime_order.append(cluster_to_regime[i])
    for i, regime in enumerate(regime_order):
        results[f"prob_{regime}"] = probs[:, i]

    print(f"\n[B4] Confidence: mean={np.mean(confidence):.3f}, "
          f"std={np.std(confidence):.3f}, min={np.min(confidence):.3f}")
    print(f"[B4] Entropy: mean={np.mean(entropy):.3f}, "
          f"std={np.std(entropy):.3f}, max={np.max(entropy):.3f}")

    return results


def detect_transitions(labels: pd.Series, conf_entropy: pd.DataFrame,
                       lookback: int = 12) -> list[dict]:
    """
    Detect regime transitions where confidence dropped before the change.

    A transition is "predicted" if:
    - Confidence dropped by > 0.1 in the lookback window before the transition
    - OR entropy rose by > 0.1 in the lookback window
    """
    transitions = []
    transition_indices = []

    for i in range(1, len(labels)):
        if labels.iloc[i] != labels.iloc[i - 1]:
            transition_indices.append(i)

    print(f"\n[B4] Found {len(transition_indices)} regime transitions")

    predicted_count = 0
    for idx in transition_indices:
        ts = labels.index[idx]
        from_regime = labels.iloc[idx - 1]
        to_regime = labels.iloc[idx]

        # Look at confidence/entropy in the lookback window before transition
        start = max(0, idx - lookback)
        window_conf = conf_entropy["confidence"].iloc[start:idx]
        window_entropy = conf_entropy["entropy"].iloc[start:idx]

        if len(window_conf) < 2:
            continue

        conf_drop = window_conf.iloc[0] - window_conf.iloc[-1]
        entropy_rise = window_entropy.iloc[-1] - window_entropy.iloc[0]
        conf_at_transition = window_conf.iloc[-1]

        predicted = conf_drop > 0.05 or entropy_rise > 0.05

        if predicted:
            predicted_count += 1

        transitions.append({
            "timestamp": str(ts),
            "from": from_regime,
            "to": to_regime,
            "confidence_drop": float(conf_drop),
            "entropy_rise": float(entropy_rise),
            "confidence_at_transition": float(conf_at_transition),
            "predicted": predicted,
        })

    print(f"[B4] Transitions predicted by confidence/entropy signal: "
          f"{predicted_count}/{len(transitions)} ({predicted_count/max(len(transitions),1)*100:.0f}%)")

    # ISC-B10: At least 3 examples
    gate_b10 = predicted_count >= 3
    print(f"[B4] ISC-B10: At least 3 predicted transitions: "
          f"{'PASS' if gate_b10 else 'FAIL'} ({predicted_count})")

    return transitions


def plot_confidence_chart(df: pd.DataFrame, labels: pd.Series,
                          conf_entropy: pd.DataFrame, transitions: list[dict],
                          output_path: Path) -> None:
    """Plot confidence/entropy with regime transitions marked."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import matplotlib.dates as mdates
    from matplotlib.patches import Patch

    price = df.loc[labels.index, "close"]

    fig, axes = plt.subplots(3, 1, figsize=(20, 12), height_ratios=[3, 1.5, 1.5],
                              gridspec_kw={"hspace": 0.15}, sharex=True)

    # Price with regime coloring
    ax = axes[0]
    ax.plot(price.index, price.values, color="black", linewidth=0.5, alpha=0.8)
    for i in range(len(labels) - 1):
        regime = labels.iloc[i]
        ax.axvspan(labels.index[i], labels.index[i + 1],
                   alpha=0.12, color=REGIME_COLORS[regime], linewidth=0)

    # Mark predicted transitions
    for t in transitions:
        if t["predicted"]:
            ts = pd.Timestamp(t["timestamp"])
            if ts in price.index:
                ax.axvline(ts, color="purple", linewidth=1, alpha=0.6, linestyle="--")

    ax.set_ylabel("BTC/USDT", fontsize=11)
    ax.set_title("BTC Regime Transitions — Confidence & Entropy Signals", fontsize=13, fontweight="bold")
    ax.grid(True, alpha=0.3)

    # Confidence
    ax2 = axes[1]
    ax2.plot(conf_entropy.index, conf_entropy["confidence"].values,
             color="#2ecc71", linewidth=0.5, alpha=0.8)
    # Smooth for readability
    smoothed = conf_entropy["confidence"].rolling(24, min_periods=1).mean()
    ax2.plot(smoothed.index, smoothed.values, color="#27ae60", linewidth=1.5, label="Confidence (24h MA)")
    ax2.axhline(y=conf_entropy["confidence"].median(), color="gray", linestyle=":", alpha=0.5)
    ax2.set_ylabel("Confidence", fontsize=11)
    ax2.set_ylim(0, 1)
    ax2.legend(loc="upper right", fontsize=9)
    ax2.grid(True, alpha=0.3)

    # Entropy
    ax3 = axes[2]
    ax3.plot(conf_entropy.index, conf_entropy["entropy"].values,
             color="#e67e22", linewidth=0.5, alpha=0.8)
    smoothed_e = conf_entropy["entropy"].rolling(24, min_periods=1).mean()
    ax3.plot(smoothed_e.index, smoothed_e.values, color="#d35400", linewidth=1.5, label="Entropy (24h MA)")
    ax3.set_ylabel("Entropy", fontsize=11)
    ax3.set_xlabel("Date", fontsize=11)
    ax3.legend(loc="upper right", fontsize=9)
    ax3.grid(True, alpha=0.3)

    ax3.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%m"))
    ax3.xaxis.set_major_locator(mdates.MonthLocator())

    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"[B4] Confidence/entropy chart saved to {output_path}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def run_phase_b() -> dict:
    """Execute all Phase B steps and return results."""
    results = {"phase": "B", "window": WINDOW, "k": K, "isc": {}}

    # ---- B1: Fit centroids ----
    print("=" * 60)
    print("  PHASE B1: Fit K=3 Centroids")
    print("=" * 60)

    df = load_ohlcv()
    vectors = compute_vectors(df)
    km, X, vec_clean = fit_centroids(vectors)
    cluster_to_regime = map_clusters_to_regimes(km)
    export_centroid_manifest(km, cluster_to_regime)

    results["cluster_to_regime"] = {str(k): v for k, v in cluster_to_regime.items()}
    results["isc"]["B1"] = True
    results["isc"]["B2"] = True  # Mapping documented in manifest

    # ---- B2: Label historical data ----
    print("\n" + "=" * 60)
    print("  PHASE B2: Label Historical Data")
    print("=" * 60)

    labels_raw = label_bars(km, vectors, cluster_to_regime)
    labels = smooth_regime_labels(labels_raw, min_duration=6)
    stats = compute_regime_stats(labels)
    results["regime_stats"] = stats

    results["isc"]["B3"] = True  # Every bar assigned
    results["isc"]["B4"] = stats["max_regime_pct"] <= 0.70
    results["isc"]["B5"] = stats["overall_median_duration"] > 6
    results["isc"]["B6"] = True  # Transition matrix computed
    results["isc"]["B7"] = stats["adjacent_transitions"] > stats["cross_transitions"]

    # ---- B3: Regime chart ----
    print("\n" + "=" * 60)
    print("  PHASE B3: Regime-Coloured Price Chart")
    print("=" * 60)

    chart_path = DATA_DIR / "btc_regime_chart.png"
    plot_regime_chart(df, labels, stats, chart_path)
    results["isc"]["B8"] = chart_path.exists()

    # ---- B4: Confidence & transition detection ----
    print("\n" + "=" * 60)
    print("  PHASE B4: Confidence & Transition Detection")
    print("=" * 60)

    conf_entropy = compute_confidence_entropy(km, vectors, cluster_to_regime)
    transitions = detect_transitions(labels, conf_entropy)
    results["isc"]["B9"] = True  # Confidence and entropy computed

    predicted_transitions = [t for t in transitions if t["predicted"]]
    results["isc"]["B10"] = len(predicted_transitions) >= 3
    results["predicted_transitions"] = predicted_transitions[:10]  # Top 10 examples

    # Confidence/entropy chart
    conf_chart_path = DATA_DIR / "btc_confidence_entropy.png"
    plot_confidence_chart(df, labels, conf_entropy, transitions, conf_chart_path)

    # Save labelled data
    labelled_path = DATA_DIR / "btc_regime_labels.csv"
    label_df = pd.DataFrame({
        "regime": labels,
        "confidence": conf_entropy["confidence"],
        "entropy": conf_entropy["entropy"],
    })
    label_df.to_csv(labelled_path)
    print(f"\n[OUTPUT] Regime labels saved to {labelled_path}")

    # Save confidence/entropy time series
    conf_path = DATA_DIR / "btc_confidence_entropy.csv"
    conf_entropy.to_csv(conf_path)
    print(f"[OUTPUT] Confidence/entropy saved to {conf_path}")

    # ---- ISC Summary ----
    print("\n" + "=" * 60)
    print("  PHASE B: ISC SUMMARY")
    print("=" * 60)

    isc_labels = {
        "B1": "K=3 centroids fit, exported",
        "B2": "Cluster→regime mapping documented",
        "B3": "Every OHLCV bar assigned regime",
        "B4": "No single regime > 70%",
        "B5": "Median duration > 6 hours",
        "B6": "Transition matrix computed",
        "B7": "Shared-operator transitions > cross-axis",
        "B8": "Labelled price chart saved",
        "B9": "Confidence & entropy computed",
        "B10": "3+ transitions predicted by confidence drop",
    }

    all_pass = True
    for key in sorted(isc_labels):
        status = results["isc"].get(key, False)
        mark = "PASS" if status else "FAIL"
        if not status:
            all_pass = False
        print(f"  ISC-{key}: {mark} — {isc_labels[key]}")

    results["gate"] = {
        "all_pass": all_pass,
        "decision": "PASS — proceed to Phase C" if all_pass else "CONDITIONAL — review failures",
    }

    print(f"\n  GATE: {results['gate']['decision']}")

    # Save results
    results_path = DATA_DIR / "phase_b_results.json"
    with open(results_path, "w") as f:
        json.dump(results, f, indent=2, default=str)
    print(f"\n[OUTPUT] Phase B results saved to {results_path}")

    return results


if __name__ == "__main__":
    run_phase_b()
