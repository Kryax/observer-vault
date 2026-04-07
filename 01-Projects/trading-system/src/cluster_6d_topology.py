#!/usr/bin/env python3
"""
K=9 Clustering on 6D Market Feature Space + Centroid Labelling

Steps:
1. KMeans vs GMM comparison, pick best silhouette
2. Centroid table
3. D/I/R archetype labelling
4. Transition matrix
5. Basin stability (dwell times)
"""

import json
import pathlib
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.mixture import GaussianMixture
from sklearn.metrics import silhouette_score

TRADING_DIR = pathlib.Path(__file__).resolve().parent.parent
DATA_DIR = TRADING_DIR / "data"
FEATURE_COLS = ["atr_z", "bbw_z", "rsi_z", "vwap_dist_z", "adx_z", "obv_z"]
AXIS_MAP = {
    "D": ["atr_z", "bbw_z"],
    "I": ["rsi_z", "vwap_dist_z"],
    "R": ["adx_z", "obv_z"],
}


def main():
    df = pd.read_parquet(DATA_DIR / "features_6d.parquet")
    X = df[FEATURE_COLS].values
    print(f"Loaded {len(df)} rows, {X.shape[1]} features\n")

    # ── Step 1: KMeans vs GMM ────────────────────────────────────────
    print("=" * 70)
    print("Step 1: KMeans vs GMM — K=9")
    print("=" * 70)

    km = KMeans(n_clusters=9, n_init=50, random_state=42)
    km_labels = km.fit_predict(X)
    km_sil = silhouette_score(X, km_labels, sample_size=50000, random_state=42)
    print(f"  KMeans  silhouette: {km_sil:.4f}")

    gmm = GaussianMixture(n_components=9, n_init=10, random_state=42)
    gmm_labels = gmm.fit_predict(X)
    gmm_sil = silhouette_score(X, gmm_labels, sample_size=50000, random_state=42)
    print(f"  GMM     silhouette: {gmm_sil:.4f}")

    if km_sil >= gmm_sil:
        print(f"  → Using KMeans (silhouette {km_sil:.4f})")
        labels = km_labels
        centroids = km.cluster_centers_
        method = "KMeans"
    else:
        print(f"  → Using GMM (silhouette {gmm_sil:.4f})")
        labels = gmm_labels
        centroids = gmm.means_
        method = "GMM"

    df["cluster"] = labels

    # ── Step 2: Centroid table ───────────────────────────────────────
    print("\n" + "=" * 70)
    print(f"Step 2: Centroid Table ({method}, K=9)")
    print("=" * 70)

    counts = pd.Series(labels).value_counts().sort_index()
    total = len(df)

    # Sort clusters by highest absolute D-axis magnitude
    d_mag = np.sqrt(centroids[:, 0] ** 2 + centroids[:, 1] ** 2)
    sort_order = np.argsort(-d_mag)

    header = f"{'Cluster':>7} | {'ATR_z':>7} | {'BBW_z':>7} | {'RSI_z':>7} | {'VWAP_z':>7} | {'ADX_z':>7} | {'OBV_z':>7} | {'Count':>7} | {'%':>5} | Flag"
    sep = "-" * len(header)
    print(header)
    print(sep)

    cluster_info = {}
    for idx in sort_order:
        c = centroids[idx]
        cnt = counts[idx]
        pct = cnt / total * 100
        flag = " ⚠ <5%" if pct < 5 else ""
        print(f"  {idx:>5} | {c[0]:>+7.3f} | {c[1]:>+7.3f} | {c[2]:>+7.3f} | {c[3]:>+7.3f} | {c[4]:>+7.3f} | {c[5]:>+7.3f} | {cnt:>7} | {pct:>5.1f}{flag}")
        cluster_info[int(idx)] = {
            "centroid": {col: round(float(c[i]), 4) for i, col in enumerate(FEATURE_COLS)},
            "count": int(cnt),
            "pct": round(float(pct), 2),
        }

    # ── Step 3: D/I/R archetype labelling ────────────────────────────
    print("\n" + "=" * 70)
    print("Step 3: D/I/R Archetype Labels")
    print("=" * 70)

    archetype_names = {
        ("D", "R"): "Breakout Momentum",
        ("D", "I"): "Volatile Reversion",
        ("R", "D"): "Trending Expansion",
        ("R", "I"): "Persistent Equilibrium",
        ("I", "D"): "Mean-Revert Volatile",
        ("I", "R"): "Equilibrium Drift",
        # Same-axis dominant (rare but possible)
        ("D", "D"): "Pure Expansion",
        ("I", "I"): "Pure Equilibrium",
        ("R", "R"): "Pure Persistence",
    }

    def label_cluster(centroid):
        axis_mags = {}
        for axis, cols in AXIS_MAP.items():
            idxs = [FEATURE_COLS.index(c) for c in cols]
            axis_mags[axis] = np.mean([abs(centroid[i]) for i in idxs])
        ranked = sorted(axis_mags, key=axis_mags.get, reverse=True)
        primary, secondary = ranked[0], ranked[1]
        return primary, secondary, axis_mags

    print(f"{'Cluster':>7} | {'Label':>6} | {'D-mag':>6} | {'I-mag':>6} | {'R-mag':>6} | {'Archetype':<25} | Sign")
    print("-" * 90)

    for idx in sort_order:
        c = centroids[idx]
        primary, secondary, mags = label_cluster(c)
        label = f"{primary}({secondary})"
        name = archetype_names.get((primary, secondary), "Mixed")

        # Determine sign direction for the dominant axis
        dom_cols = AXIS_MAP[primary]
        dom_idxs = [FEATURE_COLS.index(col) for col in dom_cols]
        dom_mean = np.mean([c[i] for i in dom_idxs])
        sign = "+" if dom_mean > 0 else "-"

        print(f"  {idx:>5} | {label:>6} | {mags['D']:>6.3f} | {mags['I']:>6.3f} | {mags['R']:>6.3f} | {name:<25} | {sign}")

        cluster_info[int(idx)]["label"] = label
        cluster_info[int(idx)]["archetype"] = name
        cluster_info[int(idx)]["sign"] = sign
        cluster_info[int(idx)]["axis_magnitudes"] = {k: round(float(v), 4) for k, v in mags.items()}

    # ── Step 4: Transition matrix ────────────────────────────────────
    print("\n" + "=" * 70)
    print("Step 4: 9x9 Transition Matrix (row → col, %)")
    print("=" * 70)

    trans = np.zeros((9, 9), dtype=int)
    for token in df["token"].unique():
        sub = df[df["token"] == token].sort_values("timestamp")
        cl = sub["cluster"].values
        for i in range(len(cl) - 1):
            trans[cl[i], cl[i + 1]] += 1

    row_sums = trans.sum(axis=1, keepdims=True)
    row_sums[row_sums == 0] = 1  # avoid div by zero
    trans_pct = trans / row_sums * 100

    # Print matrix
    header = "From\\To |" + "|".join(f"  {i:>3}  " for i in range(9)) + "|"
    print(header)
    print("-" * len(header))
    for i in range(9):
        row = f"    {i:>2}  |" + "|".join(f" {trans_pct[i, j]:>5.1f} " for j in range(9)) + "|"
        print(row)

    # Find top 5 most common and rarest transitions (off-diagonal)
    flat = []
    for i in range(9):
        for j in range(9):
            if i != j:
                flat.append((i, j, trans[i, j], trans_pct[i, j]))
    flat.sort(key=lambda x: x[2], reverse=True)

    print("\n  Top 5 most common transitions:")
    for i, j, cnt, pct in flat[:5]:
        print(f"    {i} → {j}: {cnt:>6} ({pct:.1f}%)")

    print("\n  Top 5 rarest transitions:")
    for i, j, cnt, pct in flat[-5:]:
        print(f"    {i} → {j}: {cnt:>6} ({pct:.2f}%)")

    trans_matrix = {f"{i}->{j}": round(float(trans_pct[i, j]), 2) for i in range(9) for j in range(9)}

    # ── Step 5: Basin stability — dwell times ────────────────────────
    print("\n" + "=" * 70)
    print("Step 5: Basin Stability — Mean Dwell Time (hours)")
    print("=" * 70)

    dwell_times = {i: [] for i in range(9)}
    for token in df["token"].unique():
        sub = df[df["token"] == token].sort_values("timestamp")
        cl = sub["cluster"].values
        if len(cl) == 0:
            continue
        current = cl[0]
        run_len = 1
        for k in range(1, len(cl)):
            if cl[k] == current:
                run_len += 1
            else:
                dwell_times[current].append(run_len)
                current = cl[k]
                run_len = 1
        dwell_times[current].append(run_len)  # final run

    dwell_stats = {}
    for i in range(9):
        runs = dwell_times[i]
        if runs:
            dwell_stats[i] = {
                "mean": round(float(np.mean(runs)), 2),
                "median": round(float(np.median(runs)), 2),
                "max": int(np.max(runs)),
                "n_visits": len(runs),
            }
        else:
            dwell_stats[i] = {"mean": 0, "median": 0, "max": 0, "n_visits": 0}

    sorted_dwell = sorted(dwell_stats.items(), key=lambda x: x[1]["mean"], reverse=True)
    print(f"{'Cluster':>7} | {'Mean':>6} | {'Median':>6} | {'Max':>6} | {'Visits':>6} | Flag")
    print("-" * 60)
    for idx, s in sorted_dwell:
        flag = " ⚠ transition state?" if s["mean"] < 3 else ""
        print(f"  {idx:>5} | {s['mean']:>6.1f} | {s['median']:>6.1f} | {s['max']:>6} | {s['n_visits']:>6}{flag}")
        cluster_info[int(idx)]["dwell"] = s

    # ── Save all outputs ─────────────────────────────────────────────
    output = {
        "method": method,
        "silhouette": {"kmeans": round(float(km_sil), 4), "gmm": round(float(gmm_sil), 4)},
        "clusters": cluster_info,
        "transition_matrix": trans_matrix,
        "total_rows": int(total),
    }

    out_path = DATA_DIR / "topology_9basin.json"
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\nSaved {out_path}")

    # Save clustered parquet
    out_parquet = DATA_DIR / "features_6d_clustered.parquet"
    df.to_parquet(out_parquet, index=False)
    print(f"Saved {out_parquet}")
    print("\nDone.")


if __name__ == "__main__":
    main()
