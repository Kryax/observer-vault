#!/usr/bin/env python3
"""Phase 2 Step 1: Batch composition labelling of 297,900 records."""

import json
import numpy as np
from pathlib import Path
from collections import defaultdict

DATA = Path(__file__).resolve().parent.parent / "data"
DATASET = Path("/mnt/zfs-host/backup/projects/observer-vault/01-Projects/dataset-processor/output/paired-structured-all.jsonl")

def load_centroids():
    with open(DATA / "centroids-v3.json") as f:
        obj = json.load(f)
    centroids = np.array(obj["centroids"])  # (9, 6)
    mapping = {int(k): v for k, v in obj["mapping"].items()}
    return centroids, mapping

def classify_batch(vectors, centroids, mapping):
    """Classify all vectors against centroids. Returns labels list."""
    # vectors: (N, 6), centroids: (9, 6)
    # Compute distances to all centroids
    # Using broadcasting: (N, 1, 6) - (1, 9, 6) -> (N, 9, 6) -> sum -> (N, 9)
    dists = np.sqrt(np.sum((vectors[:, None, :] - centroids[None, :, :]) ** 2, axis=2))

    nearest_idx = np.argmin(dists, axis=1)
    nearest_dist = dists[np.arange(len(dists)), nearest_idx]

    # Second nearest for confidence
    sorted_dists = np.sort(dists, axis=1)
    second_dist = sorted_dists[:, 1]

    # Confidence: 1 - nearest/second (higher = more separated)
    with np.errstate(divide='ignore', invalid='ignore'):
        confidence = 1.0 - (nearest_dist / second_dist)
        confidence = np.where(np.isfinite(confidence), confidence, 0.0)
        confidence = np.clip(confidence, 0.0, 1.0)

    labels = []
    for i in range(len(vectors)):
        vec = vectors[i]
        d, ir, r = vec[0], vec[1], vec[2]
        dir_signal = d + ir + r

        if np.sum(np.abs(vec)) < 1e-9:
            comp = "unclassified"
            conf = 0.0
            cluster = -1
            dist = 0.0
        elif dir_signal < 1e-9:
            comp = "temporal_only"
            conf = 0.0
            cluster = -2
            dist = 0.0
        else:
            cluster = int(nearest_idx[i])
            comp = mapping[cluster]
            conf = float(confidence[i])
            dist = float(nearest_dist[i])

        labels.append({
            "record_idx": i,
            "cluster": cluster,
            "composition": comp,
            "confidence": round(conf, 4),
            "distance": round(dist, 4),
            "vector": [round(float(x), 6) for x in vec]
        })

    return labels

def load_source_components():
    """Load source component for each record from the original dataset."""
    print("Loading source components from paired-structured-all.jsonl...")
    components = []
    with open(DATASET) as f:
        for line in f:
            obj = json.loads(line)
            vr = obj.get("verb_record", {})
            src = vr.get("source", {})
            comp = src.get("component", "unknown")
            components.append(comp)
    print(f"  Loaded {len(components)} source components")
    return components

def main():
    centroids, mapping = load_centroids()
    print(f"Loaded {len(centroids)} centroids (v3)")
    for k, v in sorted(mapping.items()):
        print(f"  Cluster {k} -> {v}")

    # Load vectors
    print("\nLoading vectors...")
    vectors = []
    with open(DATA / "vectors_297k_v3.jsonl") as f:
        for line in f:
            vectors.append(json.loads(line))
    vectors = np.array(vectors)
    print(f"  Loaded {len(vectors)} vectors, shape {vectors.shape}")

    # Classify
    print("\nClassifying...")
    labels = classify_batch(vectors, centroids, mapping)

    # Save labels
    out_path = DATA / "composition_labels_297k.jsonl"
    print(f"\nSaving labels to {out_path}...")
    with open(out_path, "w") as f:
        for lab in labels:
            f.write(json.dumps(lab) + "\n")
    print(f"  Wrote {len(labels)} records")

    # Load source components
    source_components = load_source_components()

    # Build distribution
    comp_counts = defaultdict(int)
    comp_confidences = defaultdict(list)
    comp_sources = defaultdict(lambda: defaultdict(int))

    for lab in labels:
        comp = lab["composition"]
        comp_counts[comp] += 1
        if lab["confidence"] > 0:
            comp_confidences[comp].append(lab["confidence"])
        # Track source components
        idx = lab["record_idx"]
        if idx < len(source_components):
            comp_sources[comp][source_components[idx]] += 1

    total = len(labels)

    # Print distribution table
    order = ["D(D)", "D(I)", "D(R)", "I(D)", "I(I)", "I(R)", "R(D)", "R(I)", "R(R)", "temporal_only", "unclassified"]
    print("\n" + "=" * 65)
    print(f"{'Composition':<14} | {'Count':>8} | {'Pct':>7} | {'Mean Confidence':>15}")
    print("-" * 65)
    for comp in order:
        cnt = comp_counts.get(comp, 0)
        pct = cnt / total * 100
        confs = comp_confidences.get(comp, [])
        mean_conf = np.mean(confs) if confs else 0.0
        print(f"{comp:<14} | {cnt:>8,} | {pct:>6.2f}% | {mean_conf:>14.4f}")
    print("-" * 65)
    print(f"{'TOTAL':<14} | {total:>8,} |        |")
    print("=" * 65)

    # Print source component breakdown
    print("\n" + "=" * 80)
    print(f"{'Composition':<14} | Top 3 Source Components")
    print("-" * 80)
    for comp in order:
        src_counts = comp_sources.get(comp, {})
        if not src_counts:
            print(f"{comp:<14} | (none)")
            continue
        total_src = sum(src_counts.values())
        top3 = sorted(src_counts.items(), key=lambda x: -x[1])[:3]
        parts = [f"{name} ({cnt/total_src*100:.1f}%)" for name, cnt in top3]
        print(f"{comp:<14} | {', '.join(parts)}")
    print("=" * 80)

    # Build summary JSON
    dist_summary = {
        "version": "20260408-phase2-step1",
        "total_records": total,
        "compositions": {}
    }
    for comp in order:
        cnt = comp_counts.get(comp, 0)
        confs = comp_confidences.get(comp, [])
        src_counts = comp_sources.get(comp, {})
        total_src = sum(src_counts.values()) if src_counts else 1
        top_sources = sorted(src_counts.items(), key=lambda x: -x[1])[:5]

        dist_summary["compositions"][comp] = {
            "count": cnt,
            "percentage": round(cnt / total * 100, 2),
            "mean_confidence": round(float(np.mean(confs)) if confs else 0.0, 4),
            "top_sources": {name: {"count": c, "pct": round(c/total_src*100, 1)} for name, c in top_sources}
        }

    dist_path = DATA / "composition_distribution.json"
    with open(dist_path, "w") as f:
        json.dump(dist_summary, f, indent=2)
    print(f"\nSaved distribution to {dist_path}")

    # Analysis
    print("\n" + "=" * 65)
    print("ANALYSIS")
    print("=" * 65)

    # Axis distribution at composition level
    d_total = sum(comp_counts.get(f"D({x})", 0) for x in "DIR")
    i_total = sum(comp_counts.get(f"I({x})", 0) for x in "DIR")
    r_total = sum(comp_counts.get(f"R({x})", 0) for x in "DIR")
    classified = d_total + i_total + r_total

    if classified > 0:
        print(f"\nPrimary axis distribution (classified records only, n={classified:,}):")
        print(f"  D-primary: {d_total:>8,} ({d_total/classified*100:.1f}%)")
        print(f"  I-primary: {i_total:>8,} ({i_total/classified*100:.1f}%)")
        print(f"  R-primary: {r_total:>8,} ({r_total/classified*100:.1f}%)")
        print(f"\n  Prior axis distribution: D=30.0%, I=68.6%, R=1.4%")
        print(f"  Composition-level:       D={d_total/classified*100:.1f}%, I={i_total/classified*100:.1f}%, R={r_total/classified*100:.1f}%")

    # I-sharing confusion (Langevin prediction)
    i_confs = []
    non_i_confs = []
    for comp in order:
        confs = comp_confidences.get(comp, [])
        if not confs:
            continue
        if comp.startswith("I(") or comp.endswith("(I)"):
            i_confs.extend(confs)
        elif comp not in ("temporal_only", "unclassified"):
            non_i_confs.extend(confs)

    if i_confs and non_i_confs:
        print(f"\nLangevin I-sharing confusion test:")
        print(f"  I-sharing compositions mean confidence: {np.mean(i_confs):.4f}")
        print(f"  Non-I-sharing compositions mean confidence: {np.mean(non_i_confs):.4f}")
        if np.mean(i_confs) < np.mean(non_i_confs):
            print(f"  -> CONFIRMED: I-sharing basins show more confusion (lower confidence)")
        else:
            print(f"  -> NOT CONFIRMED: I-sharing basins do not show more confusion")

    # Basin depth (count correlates with predicted stability)
    print(f"\nBasin depth ranking (count = empirical basin depth):")
    ranked = sorted(
        [(comp, comp_counts.get(comp, 0)) for comp in order[:9]],
        key=lambda x: -x[1]
    )
    for rank, (comp, cnt) in enumerate(ranked, 1):
        print(f"  {rank}. {comp}: {cnt:,}")

if __name__ == "__main__":
    main()
