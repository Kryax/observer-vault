#!/usr/bin/env python3
"""
Cross-shard K=9 replication test.

Runs structural-only clustering on each enriched shard independently,
then reports whether K=9 consistently wins across shards.

This is the falsification test for the wave equation's 9-basin prediction.
If K=9 wins on structural features across multiple independent shards,
the prediction is confirmed. If it doesn't, we learn where it breaks.
"""

import argparse
import json
import os
import sqlite3
import sys
import time
from collections import Counter, defaultdict

import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import normalize, StandardScaler
from sklearn.metrics import silhouette_score


def load_structural_features(db_path: str) -> tuple[np.ndarray, list[str], int]:
    """
    Load Tier B structural features from an enriched shard.
    Returns (feature_matrix, axis_labels, total_records).
    """
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)

    total = conn.execute("SELECT COUNT(*) FROM verb_records").fetchone()[0]

    rows = conn.execute("""
        SELECT process_axis, tier_b_score, process_temporal_structure,
               process_operators, process_shape
        FROM verb_records
        WHERE process_shape IS NOT NULL
          AND process_shape != 'unanalyzed'
          AND process_shape != 'No structural process detected'
          AND tier_b_score > 0
    """).fetchall()
    conn.close()

    TEMPORAL_MAP = {"sequential": 0, "concurrent": 1, "cyclic": 2, "recursive": 3}

    vectors = []
    axes = []

    for axis, tb_score, temp_struct, ops_json, proc_shape in rows:
        # Feature vector: [tb_score, T_seq, T_conc, T_cyc, T_rec, op_count, governance, proc_richness]
        temp_onehot = [0.0, 0.0, 0.0, 0.0]
        if temp_struct and temp_struct in TEMPORAL_MAP:
            temp_onehot[TEMPORAL_MAP[temp_struct]] = 1.0

        try:
            ops = json.loads(ops_json) if ops_json else []
        except (json.JSONDecodeError, TypeError):
            ops = []

        has_gov = 1.0 if proc_shape and "Governance:" in proc_shape else 0.0
        proc_rich = proc_shape.count(";") + 1 if proc_shape else 0

        vec = [tb_score or 0.0] + temp_onehot + [len(ops), has_gov, proc_rich]
        vectors.append(vec)
        axes.append(axis or "unknown")

    return np.array(vectors) if vectors else np.array([]).reshape(0, 8), axes, total


def cluster_shard(X: np.ndarray, axes: list[str], k_values: list[int]) -> list[dict]:
    """Run K-means for each k on a single shard's features."""
    if len(X) < max(k_values):
        return []

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    X_norm = normalize(X_scaled)

    results = []
    for k in k_values:
        km = KMeans(n_clusters=k, n_init=10, random_state=42, max_iter=300)
        labels = km.fit_predict(X_norm)
        sil = silhouette_score(X_norm, labels)

        # Cluster purity
        purities = []
        for cl in range(k):
            mask = labels == cl
            if mask.sum() == 0:
                continue
            cl_axes = [axes[i] for i in range(len(axes)) if mask[i]]
            counts = Counter(cl_axes)
            dominant = counts.most_common(1)[0][1]
            purities.append(dominant / len(cl_axes))

        results.append({
            "k": k,
            "silhouette": round(sil, 4),
            "inertia": round(km.inertia_, 2),
            "avg_purity": round(np.mean(purities), 4) if purities else 0,
        })

    return results


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--shards", default="0,1,2,3,4,5,6,7,8,9",
                        help="Comma-separated shard numbers")
    parser.add_argument("--k-values", default="3,5,7,9,12")
    parser.add_argument("--output-json", default="output/cross-shard-replication.json")
    args = parser.parse_args()

    shard_nums = [int(x) for x in args.shards.split(",")]
    k_values = [int(x) for x in args.k_values.split(",")]

    print(f"Cross-Shard K=9 Replication Test")
    print(f"Shards: {shard_nums}")
    print(f"K values: {k_values}")
    print(f"{'='*80}\n")

    all_results = {}
    all_vectors = []
    all_axes = []

    for sn in shard_nums:
        shard_id = f"{sn:02d}"
        db_path = f"output/shard-{shard_id}.db"

        if not os.path.exists(db_path):
            print(f"shard-{shard_id}: SKIP (not found)")
            continue

        X, axes, total = load_structural_features(db_path)

        if len(X) == 0:
            print(f"shard-{shard_id}: SKIP (no enriched records)")
            continue

        print(f"shard-{shard_id}: {len(X):,} enriched / {total:,} total "
              f"({len(X)/total:.0%} enriched)")

        t0 = time.time()
        results = cluster_shard(X, axes, k_values)
        elapsed = time.time() - t0

        if not results:
            print(f"  Too few records for clustering")
            continue

        best = max(results, key=lambda r: r["silhouette"])
        k9 = next((r for r in results if r["k"] == 9), None)
        k3 = next((r for r in results if r["k"] == 3), None)

        all_results[shard_id] = results
        all_vectors.append(X)
        all_axes.extend(axes)

        # Per-shard summary line
        sils = {r["k"]: r["silhouette"] for r in results}
        line = "  " + "  ".join(f"K={r['k']}:{r['silhouette']:.3f}" for r in results)
        line += f"  → Best: K={best['k']}"
        if k9 and k3:
            line += f"  Δ(9v3)={k9['silhouette']-k3['silhouette']:+.3f}"
        print(line)

    if not all_results:
        print("\nNo shards had enriched data. Run enrich-tier-b.py first.")
        sys.exit(1)

    # ── Aggregate analysis ──────────────────────────────────────────────────

    print(f"\n{'='*80}")
    print(f"AGGREGATE RESULTS — {len(all_results)} shards")
    print(f"{'='*80}\n")

    # Which K wins most often?
    best_k_counts = Counter()
    k9_wins = 0
    k9_better_than_3 = 0
    deltas = []

    for shard_id, results in sorted(all_results.items()):
        best = max(results, key=lambda r: r["silhouette"])
        best_k_counts[best["k"]] += 1

        k9 = next((r for r in results if r["k"] == 9), None)
        k3 = next((r for r in results if r["k"] == 3), None)

        if k9 and best["k"] == 9:
            k9_wins += 1
        if k9 and k3:
            delta = k9["silhouette"] - k3["silhouette"]
            deltas.append(delta)
            if delta > 0:
                k9_better_than_3 += 1

    print("Best K distribution across shards:")
    for k, cnt in sorted(best_k_counts.items()):
        bar = "█" * cnt
        print(f"  K={k:>2}: {cnt} shards {bar}")

    print(f"\nK=9 wins: {k9_wins}/{len(all_results)} shards")
    print(f"K=9 > K=3: {k9_better_than_3}/{len(all_results)} shards")

    if deltas:
        print(f"\nΔ(K=9 vs K=3) across shards:")
        print(f"  Mean:   {np.mean(deltas):+.4f}")
        print(f"  Median: {np.median(deltas):+.4f}")
        print(f"  Min:    {min(deltas):+.4f}")
        print(f"  Max:    {max(deltas):+.4f}")
        print(f"  Std:    {np.std(deltas):.4f}")

    # Summary table
    print(f"\n{'Shard':>6}", end="")
    for k in k_values:
        print(f"  {'K='+str(k):>8}", end="")
    print(f"  {'Best':>6}  {'Δ(9v3)':>8}")
    print(f"{'-'*6}", end="")
    for _ in k_values:
        print(f"  {'-'*8}", end="")
    print(f"  {'-'*6}  {'-'*8}")

    for shard_id, results in sorted(all_results.items()):
        sils = {r["k"]: r["silhouette"] for r in results}
        best = max(results, key=lambda r: r["silhouette"])
        k9 = sils.get(9, 0)
        k3 = sils.get(3, 0)

        print(f"{shard_id:>6}", end="")
        for k in k_values:
            s = sils.get(k, 0)
            marker = " *" if k == best["k"] else "  "
            print(f"  {s:>6.4f}{marker}", end="")
        print(f"  {'K='+str(best['k']):>6}  {k9-k3:>+8.4f}")

    # ── Combined clustering ────────────────────────────────────────────────

    print(f"\n{'='*80}")
    print(f"COMBINED: All shards pooled ({sum(len(v) for v in all_vectors):,} records)")
    print(f"{'='*80}\n")

    X_all = np.vstack(all_vectors)
    combined_results = cluster_shard(X_all, all_axes, k_values)

    if combined_results:
        best_combined = max(combined_results, key=lambda r: r["silhouette"])
        for r in combined_results:
            marker = " ← BEST" if r["k"] == best_combined["k"] else ""
            print(f"  K={r['k']:>2}: silhouette={r['silhouette']:.4f}  "
                  f"purity={r['avg_purity']:.3f}{marker}")

        k9c = next((r for r in combined_results if r["k"] == 9), None)
        k3c = next((r for r in combined_results if r["k"] == 3), None)
        if k9c and k3c:
            delta = k9c["silhouette"] - k3c["silhouette"]
            print(f"\n  Δ(K=9 vs K=3) combined: {delta:+.4f}")

    # ── Verdict ────────────────────────────────────────────────────────────

    print(f"\n{'='*80}")
    print(f"VERDICT")
    print(f"{'='*80}\n")

    n_shards = len(all_results)
    if k9_wins >= n_shards * 0.7:
        print(f"  CONFIRMED: K=9 wins on {k9_wins}/{n_shards} shards (≥70%).")
        print(f"  The structural feature space has a natural 9-basin topology.")
        print(f"  The wave equation's prediction of 3×3 attractor basins is supported.")
    elif k9_wins >= n_shards * 0.5:
        print(f"  PARTIALLY CONFIRMED: K=9 wins on {k9_wins}/{n_shards} shards (≥50%).")
        print(f"  Sub-axis structure exists but K=9 is not universally dominant.")
    elif k9_better_than_3 >= n_shards * 0.8:
        print(f"  WEAK SUPPORT: K=9 > K=3 on {k9_better_than_3}/{n_shards} shards,")
        print(f"  but K=9 is best on only {k9_wins}/{n_shards}.")
        print(f"  Sub-axis structure present; 9 basins may not be the exact count.")
    else:
        print(f"  NOT CONFIRMED: K=9 wins on only {k9_wins}/{n_shards} shards.")
        if best_k_counts:
            modal_k = best_k_counts.most_common(1)[0]
            print(f"  Modal best K = {modal_k[0]} ({modal_k[1]} shards).")

    # Save
    output = {
        "test": "cross-shard-replication",
        "date": time.strftime("%Y-%m-%d %H:%M"),
        "n_shards": n_shards,
        "k_values": k_values,
        "k9_wins": k9_wins,
        "k9_better_than_3": k9_better_than_3,
        "delta_mean": round(float(np.mean(deltas)), 4) if deltas else None,
        "delta_std": round(float(np.std(deltas)), 4) if deltas else None,
        "per_shard": {
            sid: [{"k": r["k"], "silhouette": r["silhouette"], "purity": r["avg_purity"]}
                  for r in results]
            for sid, results in all_results.items()
        },
        "combined": [{"k": r["k"], "silhouette": r["silhouette"], "purity": r["avg_purity"]}
                     for r in combined_results] if combined_results else [],
    }
    with open(args.output_json, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\nResults saved to {args.output_json}")


if __name__ == "__main__":
    main()
