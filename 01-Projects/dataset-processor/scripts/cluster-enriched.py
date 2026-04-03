#!/usr/bin/env python3
"""
Clustering on Tier B enriched records.

Uses both keyword D/I/R vectors AND structural features from Tier B enrichment:
  - tier_b_score (structural match quality)
  - temporal structure (one-hot: sequential/concurrent/cyclic/recursive)
  - operator count
  - governance presence
  - process relationship richness (proxy from process_shape length)

This tests whether structural analysis reveals sub-axis attractor basins
that keyword-only vectors cannot see.
"""

import argparse
import json
import re
import sqlite3
import sys
import time
from collections import Counter, defaultdict

import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import normalize, StandardScaler
from sklearn.metrics import silhouette_score

# Import keyword vectorizer
sys.path.insert(0, "scripts")
from importlib.machinery import SourceFileLoader
vec_mod = SourceFileLoader("vec", "scripts/dir-vectorize-cluster.py").load_module()
vectorize_text = vec_mod.vectorize_text


TEMPORAL_MAP = {
    "sequential": 0,
    "concurrent": 1,
    "cyclic": 2,
    "recursive": 3,
}


def build_enriched_vector(
    raw_text: str,
    tier_b_score: float,
    process_shape: str,
    operators_json: str,
    temporal_structure: str | None,
) -> np.ndarray:
    """
    Build a feature vector combining keyword D/I/R with structural features.

    Returns 12-dimensional vector:
      [0-2]  D, I, R keyword scores (from vectorize_text)
      [3]    temporal complexity (from keywords)
      [4]    text density (indicator richness)
      [5]    axis entropy
      [6]    tier_b_score
      [7-10] temporal structure one-hot (seq/conc/cyc/rec)
      [11]   operator count
      [12]   governance indicator (from process_shape containing "Governance:")
      [13]   process richness (relationship count proxy)
    """
    # Keyword features (6D)
    kw_vec = vectorize_text(raw_text)

    # Tier B structural features
    tb_score = tier_b_score or 0.0

    # Temporal one-hot
    temp_onehot = np.zeros(4)
    if temporal_structure and temporal_structure in TEMPORAL_MAP:
        temp_onehot[TEMPORAL_MAP[temporal_structure]] = 1.0

    # Operator count
    try:
        ops = json.loads(operators_json) if operators_json else []
    except (json.JSONDecodeError, TypeError):
        ops = []
    op_count = len(ops)

    # Governance indicator
    has_governance = 1.0 if process_shape and "Governance:" in process_shape else 0.0

    # Process richness: count semicolons in process_shape as proxy for relationship count
    if process_shape and process_shape != "unanalyzed" and process_shape != "No structural process detected":
        proc_richness = process_shape.count(";") + 1
    else:
        proc_richness = 0

    return np.concatenate([
        kw_vec,                     # [0-5] keyword features
        [tb_score],                 # [6]
        temp_onehot,                # [7-10]
        [op_count],                 # [11]
        [has_governance],           # [12]
        [proc_richness],            # [13]
    ])


def run_and_report(X: np.ndarray, k_values: list[int], axes: list[str],
                   dim_names: list[str], label: str):
    """Run K-means and print results."""
    # Standardize features (important when mixing different scales)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    X_norm = normalize(X_scaled)

    print(f"\n{'='*80}")
    print(f"{label}")
    print(f"{'='*80}")
    print(f"Records: {len(X):,}")
    print(f"Dimensions: {len(dim_names)} ({', '.join(dim_names)})")

    results = []
    for k in k_values:
        km = KMeans(n_clusters=k, n_init=10, random_state=42, max_iter=300)
        labels = km.fit_predict(X_norm)
        sil = silhouette_score(X_norm, labels) if k > 1 else 0.0
        inertia = km.inertia_

        # Cross-tab
        crosstab = defaultdict(lambda: defaultdict(int))
        for cl, ax in zip(labels, axes):
            crosstab[cl][ax] += 1

        results.append({
            "k": k, "silhouette": round(sil, 4), "inertia": round(inertia, 2),
            "clusters": dict(crosstab), "labels": labels,
            "centroids": scaler.inverse_transform(
                km.cluster_centers_ / np.linalg.norm(km.cluster_centers_, axis=1, keepdims=True)
            ),
        })

    # Summary table
    print(f"\n{'K':>3}  {'Silhouette':>11}  {'Inertia':>10}")
    print(f"{'-'*3}  {'-'*11}  {'-'*10}")
    for r in results:
        print(f"{r['k']:>3}  {r['silhouette']:>11.4f}  {r['inertia']:>10.2f}")

    best = max(results, key=lambda r: r["silhouette"])
    print(f"\nBest K = {best['k']} (silhouette = {best['silhouette']:.4f})")

    # Detailed breakdown for K=3, K=9, and best K
    show_ks = sorted(set([3, 9, best["k"]]))
    for r in results:
        if r["k"] not in show_ks:
            continue

        print(f"\n{'─'*60}")
        print(f"K = {r['k']}  (silhouette = {r['silhouette']:.4f})")
        print(f"{'─'*60}")

        centroids = r["centroids"]
        for cl_id in sorted(r["clusters"].keys()):
            axis_counts = r["clusters"][cl_id]
            total = sum(axis_counts.values())
            dominant = max(axis_counts, key=axis_counts.get)
            purity = axis_counts[dominant] / total

            # Centroid key dims — adapt to dimensionality
            c = centroids[cl_id]
            ndim = len(c)
            if ndim >= 6:
                dir_str = f"D={c[0]:.2f} I={c[1]:.2f} R={c[2]:.2f}"
            else:
                dir_str = " ".join(f"{dim_names[i]}={c[i]:.2f}" for i in range(min(3, ndim)))

            struct_str = ""
            temp_str = ""
            if ndim > 6:
                struct_str = f"tb={c[6]:.2f}"
            if ndim > 10:
                temp_labels = ["seq", "conc", "cyc", "rec"]
                max_temp = np.argmax(c[7:11])
                if c[7 + max_temp] > 0.1:
                    temp_str = f" temp={temp_labels[max_temp]}"
            if ndim > 12 and c[12] > 0.1:
                struct_str += " +gov"
            if ndim > 13 and c[13] > 0.5:
                struct_str += f" rel={c[13]:.1f}"

            print(f"\n  Cluster {cl_id} ({total:,} records, {purity:.0%} {dominant[:5]})")
            print(f"    {dir_str} | {struct_str}{temp_str}")
            ax_parts = []
            for ax in ["differentiate", "integrate", "recurse"]:
                cnt = axis_counts.get(ax, 0)
                if cnt > 0:
                    ax_parts.append(f"{ax[:5]}={cnt}")
            print(f"    {', '.join(ax_parts)}")

    # Hypothesis test
    k3 = next(r for r in results if r["k"] == 3)
    k9 = next(r for r in results if r["k"] == 9)
    delta = k9["silhouette"] - k3["silhouette"]
    print(f"\n{'─'*60}")
    print(f"HYPOTHESIS: K=9 vs K=3")
    print(f"  K=3: {k3['silhouette']:.4f}  |  K=9: {k9['silhouette']:.4f}  |  Δ={delta:+.4f}")
    if delta > 0.05:
        print(f"  → K=9 substantially better. Sub-axis structure present.")
    elif delta > 0:
        print(f"  → K=9 marginally better.")
    else:
        print(f"  → K=3 ≥ K=9. Primary axes dominant.")

    return results


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default="output/shard-00.db")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--k-values", default="3,5,7,9,12")
    parser.add_argument("--output-json", default=None)
    args = parser.parse_args()

    k_values = [int(x) for x in args.k_values.split(",")]

    print(f"Loading enriched records from {args.db}...")
    conn = sqlite3.connect(f"file:{args.db}?mode=ro", uri=True)
    query = """
        SELECT id, process_axis, source_raw_text, tier_a_score, tier_b_score,
               process_shape, process_operators, process_temporal_structure, domain
        FROM verb_records
        WHERE process_shape IS NOT NULL AND process_shape != 'unanalyzed'
    """
    if args.limit > 0:
        query += f" LIMIT {args.limit}"
    rows = conn.execute(query).fetchall()
    conn.close()
    print(f"  Loaded {len(rows):,} enriched records")

    # Build vectors
    print("Building feature vectors...")
    t0 = time.time()
    vectors = []
    axes = []
    skipped = 0

    for (rec_id, axis, raw_text, tier_a, tier_b, proc_shape,
         ops_json, temp_struct, domain) in rows:
        if not raw_text or len(raw_text) < 50:
            skipped += 1
            continue

        vec = build_enriched_vector(raw_text, tier_b, proc_shape, ops_json, temp_struct)
        if vec[:3].sum() == 0:
            skipped += 1
            continue

        vectors.append(vec)
        axes.append(axis or "unknown")

    print(f"  {len(vectors):,} vectors in {time.time()-t0:.1f}s (skipped {skipped})")

    X = np.array(vectors)

    # Print feature statistics
    dim_names = [
        "D", "I", "R", "Temporal", "Density", "Entropy",
        "TB_score", "T_seq", "T_conc", "T_cyc", "T_rec",
        "OpCount", "Governance", "ProcRich",
    ]
    print(f"\nFeature statistics:")
    for i, name in enumerate(dim_names):
        col = X[:, i]
        nz = np.count_nonzero(col)
        print(f"  {name:>12}: mean={col.mean():.3f}  std={col.std():.3f}  "
              f"nonzero={nz:,}/{len(col):,} ({nz/len(col):.0%})")

    # Axis distribution
    ax_counts = Counter(axes)
    print(f"\nAxis distribution:")
    for ax, cnt in ax_counts.most_common():
        print(f"  {ax}: {cnt:,} ({cnt/len(axes):.1%})")

    # Run clustering experiments
    print(f"\nClustering with K={k_values}...")

    # Experiment 1: Full 14D (keywords + structural)
    r_full = run_and_report(X, k_values, axes, dim_names,
                            "FULL 14D: Keywords + Structural Features")

    # Experiment 2: Structural only (tier_b + temporal + operators + governance + richness)
    X_struct = X[:, 6:]  # columns 6-13
    struct_names = dim_names[6:]
    r_struct = run_and_report(X_struct, k_values, axes, struct_names,
                              "STRUCTURAL ONLY (8D): Tier B features without keywords")

    # Experiment 3: Keywords only (for comparison with shard-01 results)
    X_kw = X[:, :6]
    kw_names = dim_names[:6]
    r_kw = run_and_report(X_kw, k_values, axes, kw_names,
                          "KEYWORDS ONLY (6D): Same as original vectorizer")

    # Save results
    if args.output_json:
        out = {
            "db": args.db,
            "n_records": len(vectors),
            "full_14d": [{"k": r["k"], "silhouette": r["silhouette"]} for r in r_full],
            "structural_8d": [{"k": r["k"], "silhouette": r["silhouette"]} for r in r_struct],
            "keywords_6d": [{"k": r["k"], "silhouette": r["silhouette"]} for r in r_kw],
        }
        with open(args.output_json, "w") as f:
            json.dump(out, f, indent=2)
        print(f"\nResults saved to {args.output_json}")


if __name__ == "__main__":
    main()
