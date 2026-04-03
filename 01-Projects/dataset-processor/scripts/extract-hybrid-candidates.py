#!/usr/bin/env python3
"""
Extract hybrid-cluster records where K-means cluster axis disagrees with
the pipeline's Tier A axis label. These are I(R) promotion candidates —
records likely misclassified by argmax keyword scoring.

Outputs a reviewable markdown file with record details and text excerpts.
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
from sklearn.preprocessing import normalize

# Import the vectorizer from the clustering script
sys.path.insert(0, "scripts")
from importlib.machinery import SourceFileLoader
vec_mod = SourceFileLoader("vec", "scripts/dir-vectorize-cluster.py").load_module()

vectorize_text = vec_mod.vectorize_text


def dominant_axis_from_centroid(centroid_dir: np.ndarray) -> str:
    """Determine the dominant axis from the D/I/R portion of a centroid."""
    axes = ["differentiate", "integrate", "recurse"]
    idx = np.argmax(centroid_dir[:3])
    return axes[idx]


def axis_mix_label(centroid_dir: np.ndarray) -> str:
    """Human-readable label for the centroid's axis mix."""
    axes = ["D", "I", "R"]
    total = centroid_dir[:3].sum()
    if total == 0:
        return "zero"
    fracs = centroid_dir[:3] / total
    parts = []
    for i, ax in enumerate(axes):
        if fracs[i] > 0.1:
            parts.append(f"{ax}={fracs[i]:.0%}")
    return " ".join(parts)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--shard", default="output/shard-01.db")
    parser.add_argument("--k", type=int, default=9, help="K for clustering")
    parser.add_argument("--output", default="output/ir-candidates-shard01.md")
    parser.add_argument("--excerpt-len", type=int, default=500, help="Text excerpt length")
    args = parser.parse_args()

    print(f"Loading records from {args.shard}...")
    conn = sqlite3.connect(f"file:{args.shard}?mode=ro", uri=True)
    rows = conn.execute(
        "SELECT id, process_axis, source_raw_text, tier_a_score, domain, motif_id "
        "FROM verb_records"
    ).fetchall()
    conn.close()
    print(f"  Loaded {len(rows):,} records")

    # Vectorize
    print("Vectorizing...")
    t0 = time.time()
    records = []
    for rec_id, axis, raw_text, tier_a, domain, motif_id in rows:
        if not raw_text or len(raw_text) < 50:
            continue
        vec = vectorize_text(raw_text)
        if vec[:3].sum() == 0:
            continue
        records.append({
            "id": rec_id,
            "pipeline_axis": axis or "unknown",
            "raw_text": raw_text,
            "tier_a_score": tier_a,
            "domain": domain,
            "motif_id": motif_id,
            "vector": vec,
        })
    print(f"  {len(records):,} usable records in {time.time()-t0:.1f}s")

    # Cluster
    X = np.array([r["vector"] for r in records])
    X_norm = normalize(X)

    km = KMeans(n_clusters=args.k, n_init=10, random_state=42, max_iter=300)
    cluster_labels = km.fit_predict(X_norm)
    centroids = km.cluster_centers_

    # Determine dominant axis per cluster from centroid D/I/R values
    cluster_axis = {}
    for cl_id in range(args.k):
        cluster_axis[cl_id] = dominant_axis_from_centroid(centroids[cl_id])

    # Find disagreements
    candidates = []
    for i, rec in enumerate(records):
        cl = cluster_labels[i]
        cluster_dom = cluster_axis[cl]
        pipeline_ax = rec["pipeline_axis"]

        if cluster_dom != pipeline_ax:
            rec["cluster_id"] = cl
            rec["cluster_axis"] = cluster_dom
            rec["cluster_mix"] = axis_mix_label(centroids[cl])
            rec["centroid"] = centroids[cl]
            candidates.append(rec)

    print(f"\nFound {len(candidates):,} disagreements out of {len(records):,} records")

    # Categorize by type of disagreement
    disagree_types = Counter()
    for c in candidates:
        key = f"{c['pipeline_axis'][:5]}→{c['cluster_axis'][:5]}"
        disagree_types[key] += 1

    print("Disagreement types:")
    for dtype, cnt in disagree_types.most_common():
        print(f"  {dtype}: {cnt}")

    # Sort candidates by: recurse-related first, then by tier_a_score descending
    def sort_key(c):
        # Prioritize records that involve recurse axis
        recurse_involved = "recurse" in (c["pipeline_axis"], c["cluster_axis"])
        return (not recurse_involved, -c["vector"][2], -c["tier_a_score"])

    candidates.sort(key=sort_key)

    # Write output
    with open(args.output, "w") as f:
        f.write(f"# I(R) Candidate Records — Hybrid Cluster Extraction\n\n")
        f.write(f"**Source:** `{args.shard}`  \n")
        f.write(f"**K:** {args.k}  \n")
        f.write(f"**Total records vectorized:** {len(records):,}  \n")
        f.write(f"**Disagreements found:** {len(candidates):,}  \n")
        f.write(f"**Date:** {time.strftime('%Y-%m-%d %H:%M')}  \n\n")

        f.write("## Disagreement Summary\n\n")
        f.write("| Pipeline Label → Cluster Axis | Count |\n")
        f.write("|------|-------|\n")
        for dtype, cnt in disagree_types.most_common():
            f.write(f"| {dtype} | {cnt} |\n")
        f.write(f"| **Total** | **{len(candidates)}** |\n\n")

        # Cluster overview
        f.write("## Cluster Centroids\n\n")
        f.write("| Cluster | Dominant | D | I | R | T | ρ | H | Size |\n")
        f.write("|---------|----------|---|---|---|---|---|---|------|\n")
        cluster_sizes = Counter(cluster_labels)
        for cl_id in range(args.k):
            c = centroids[cl_id]
            f.write(f"| {cl_id} | {cluster_axis[cl_id][:5]} | "
                    f"{c[0]:.3f} | {c[1]:.3f} | {c[2]:.3f} | "
                    f"{c[3]:.3f} | {c[4]:.3f} | {c[5]:.3f} | "
                    f"{cluster_sizes[cl_id]} |\n")

        # I(R) specific section: records labeled D or I by pipeline but clustering as R
        ir_candidates = [c for c in candidates if c["cluster_axis"] == "recurse"]
        f.write(f"\n## I(R) Promotion Candidates (pipeline≠recurse, cluster=recurse)\n\n")
        f.write(f"**Count:** {len(ir_candidates)}\n\n")
        f.write("These records were classified as differentiate or integrate by Tier A "
                "but cluster with recurse-dominant centroids. They are the strongest "
                "candidates for axis misclassification.\n\n")

        for i, c in enumerate(ir_candidates[:50]):  # cap at 50 for reviewability
            excerpt = c["raw_text"][:args.excerpt_len].replace("\n", " ").strip()
            f.write(f"### Candidate {i+1}: {c['pipeline_axis']}→{c['cluster_axis']}\n\n")
            f.write(f"- **ID:** `{c['id'][:16]}…`\n")
            f.write(f"- **Pipeline axis:** {c['pipeline_axis']} (tier_a={c['tier_a_score']:.3f})\n")
            f.write(f"- **Cluster:** {c['cluster_id']} ({c['cluster_mix']})\n")
            f.write(f"- **Motif:** {c['motif_id']}\n")
            f.write(f"- **Domain:** {c['domain']}\n")
            f.write(f"- **D/I/R vector:** D={c['vector'][0]:.3f} I={c['vector'][1]:.3f} R={c['vector'][2]:.3f}\n")
            f.write(f"- **Excerpt:**\n\n")
            f.write(f"  > {excerpt}\n\n")

        # Other disagreements section
        other = [c for c in candidates if c["cluster_axis"] != "recurse"]
        f.write(f"\n## Other Axis Disagreements\n\n")
        f.write(f"**Count:** {len(other)}\n\n")

        # Group by disagreement type
        by_type = defaultdict(list)
        for c in other:
            key = f"{c['pipeline_axis']}→{c['cluster_axis']}"
            by_type[key].append(c)

        for dtype, recs in sorted(by_type.items(), key=lambda x: -len(x[1])):
            f.write(f"### {dtype} ({len(recs)} records)\n\n")
            for c in recs[:10]:  # 10 examples per type
                excerpt = c["raw_text"][:300].replace("\n", " ").strip()
                f.write(f"- `{c['id'][:16]}…` | tier_a={c['tier_a_score']:.3f} | "
                        f"motif={c['motif_id']} | {c['domain']}\n")
                f.write(f"  D={c['vector'][0]:.3f} I={c['vector'][1]:.3f} R={c['vector'][2]:.3f}\n")
                f.write(f"  > {excerpt[:200]}…\n\n")
            if len(recs) > 10:
                f.write(f"  *…and {len(recs)-10} more*\n\n")

    print(f"\nWritten to {args.output}")
    print(f"  I(R) candidates: {len(ir_candidates)}")
    print(f"  Other disagreements: {len(other)}")


if __name__ == "__main__":
    main()
