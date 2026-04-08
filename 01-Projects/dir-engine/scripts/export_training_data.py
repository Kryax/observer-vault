#!/usr/bin/env python3
"""Phase 2 Step 6: Export unified training dataset with composition labels."""

import json
import gzip
import os
import numpy as np
from pathlib import Path
from collections import defaultdict, Counter

DATA = Path(__file__).resolve().parent.parent / "data"
OUTPUT = Path(__file__).resolve().parent.parent / "output"
DATASET = Path("/mnt/zfs-host/backup/projects/observer-vault/01-Projects/dataset-processor/output/paired-structured-all.jsonl")

MIN_CONFIDENCE = 0.1


def main():
    # Load composition labels
    print("Loading composition labels...")
    comp_labels = []
    with open(DATA / "composition_labels_297k.jsonl") as f:
        for line in f:
            comp_labels.append(json.loads(line))
    print(f"  {len(comp_labels):,} labels loaded")

    # Load rescored motifs (gzipped)
    print("Loading rescored motifs...")
    rescored = []
    gz_path = DATA / "motif_rescored_297k.jsonl.gz"
    raw_path = DATA / "motif_rescored_297k.jsonl"
    if gz_path.exists():
        with gzip.open(gz_path, "rt") as f:
            for line in f:
                rescored.append(json.loads(line))
    elif raw_path.exists():
        with open(raw_path) as f:
            for line in f:
                rescored.append(json.loads(line))
    print(f"  {len(rescored):,} rescored records loaded")

    # Load vectors
    print("Loading vectors...")
    vectors = []
    with open(DATA / "vectors_297k_v3.jsonl") as f:
        for line in f:
            vectors.append(json.loads(line))
    print(f"  {len(vectors):,} vectors loaded")

    # Process and export
    print("\nExporting training data...")
    out_path = OUTPUT / "training_data_dir_v1.jsonl"

    # Stats accumulators
    exported = 0
    skipped_unclassified = 0
    skipped_temporal = 0
    skipped_low_conf = 0
    comp_counts = Counter()
    axis_counts = Counter()
    source_counts = Counter()
    motif_counts = Counter()
    confidences = []
    comp_confidences = defaultdict(list)

    with open(out_path, "w") as out_f, open(DATASET) as src_f:
        for i, src_line in enumerate(src_f):
            cl = comp_labels[i]
            composition = cl["composition"]
            confidence = cl["confidence"]

            # Filter
            if composition == "unclassified":
                skipped_unclassified += 1
                continue
            if composition == "temporal_only":
                skipped_temporal += 1
                continue
            if confidence < MIN_CONFIDENCE:
                skipped_low_conf += 1
                continue

            # Parse source record
            src_obj = json.loads(src_line)
            vr = src_obj["verb_record"]
            proc = vr.get("process", {})

            # Get rescored motif
            rs = rescored[i]
            top_motifs = rs.get("new_top3_motifs", [])
            best_motif = top_motifs[0]["motif_id"] if top_motifs else "none"
            best_score = top_motifs[0]["score"] if top_motifs else 0.0

            # Primary axis from composition
            axis_map = {"D": "differentiate", "I": "integrate", "R": "recurse"}
            primary_axis = axis_map.get(composition[0], "unknown")

            # Source component
            source_component = vr.get("source", {}).get("component", "unknown")

            # Shard from document ID
            doc_id = vr.get("source", {}).get("documentId", "")
            shard = doc_id.split(":")[0] if ":" in doc_id else "unknown"

            # Build training record
            record = {
                "text": src_obj.get("source", ""),
                "composition": composition,
                "axis": primary_axis,
                "confidence": round(confidence, 4),
                "motif": best_motif,
                "motif_score": round(best_score, 4),
                "operators": proc.get("operators", []),
                "process_shape": proc.get("shape", ""),
                "vector": [round(float(x), 6) for x in vectors[i]],
                "source_component": source_component,
                "shard": shard
            }

            out_f.write(json.dumps(record) + "\n")
            exported += 1

            # Accumulate stats
            comp_counts[composition] += 1
            axis_counts[primary_axis] += 1
            source_counts[source_component] += 1
            motif_counts[best_motif] += 1
            confidences.append(confidence)
            comp_confidences[composition].append(confidence)

            if (i + 1) % 50000 == 0:
                print(f"  ...processed {i + 1:,}, exported {exported:,}")

    print(f"\nExported {exported:,} records to {out_path}")
    print(f"Skipped: {skipped_unclassified:,} unclassified, "
          f"{skipped_temporal:,} temporal_only, "
          f"{skipped_low_conf:,} low confidence (<{MIN_CONFIDENCE})")

    # File size
    raw_size = os.path.getsize(out_path)
    raw_mb = raw_size / (1024 * 1024)
    print(f"Raw file size: {raw_mb:.1f} MB")

    # Gzip if over 100MB
    gz_out = OUTPUT / "training_data_dir_v1.jsonl.gz"
    print(f"Compressing to {gz_out}...")
    with open(out_path, "rb") as f_in, gzip.open(gz_out, "wb", compresslevel=6) as f_out:
        while True:
            chunk = f_in.read(8 * 1024 * 1024)
            if not chunk:
                break
            f_out.write(chunk)
    gz_size = os.path.getsize(gz_out)
    gz_mb = gz_size / (1024 * 1024)
    print(f"Compressed: {gz_mb:.1f} MB ({gz_size/raw_size*100:.0f}% of raw)")

    # Print stats
    print("\n" + "=" * 70)
    print("TRAINING DATA STATISTICS")
    print("=" * 70)

    print(f"\nTotal records exported: {exported:,}")
    print(f"Mean confidence: {np.mean(confidences):.4f}")

    # Per composition
    order = ["D(D)", "D(I)", "D(R)", "I(D)", "I(I)", "I(R)", "R(D)", "R(I)", "R(R)"]
    print(f"\n{'Composition':<12} | {'Count':>8} | {'Pct':>7} | {'Mean Conf':>9}")
    print("-" * 48)
    for comp in order:
        cnt = comp_counts.get(comp, 0)
        pct = cnt / exported * 100 if exported else 0
        confs = comp_confidences.get(comp, [])
        mc = np.mean(confs) if confs else 0
        print(f"{comp:<12} | {cnt:>8,} | {pct:>6.1f}% | {mc:>9.4f}")

    # Per axis
    print(f"\n{'Axis':<15} | {'Count':>8} | {'Pct':>7}")
    print("-" * 36)
    for axis in ["differentiate", "integrate", "recurse"]:
        cnt = axis_counts.get(axis, 0)
        pct = cnt / exported * 100 if exported else 0
        print(f"{axis:<15} | {cnt:>8,} | {pct:>6.1f}%")

    # Per source component
    print(f"\n{'Source Component':<25} | {'Count':>8} | {'Pct':>7}")
    print("-" * 46)
    for src, cnt in source_counts.most_common():
        pct = cnt / exported * 100
        print(f"{src:<25} | {cnt:>8,} | {pct:>6.1f}%")

    # Motif distribution
    print(f"\n{'Motif':<12} | {'Count':>8} | {'Pct':>7}")
    print("-" * 33)
    for mid, cnt in motif_counts.most_common(15):
        pct = cnt / exported * 100
        print(f"{mid:<12} | {cnt:>8,} | {pct:>6.1f}%")
    if len(motif_counts) > 15:
        print(f"  ... +{len(motif_counts) - 15} more")

    # Top-2 motif concentration
    top2 = motif_counts.most_common(2)
    top2_total = sum(c for _, c in top2)
    top2_pct = top2_total / exported * 100

    # Comparison with original
    print("\n" + "=" * 70)
    print("COMPARISON: ORIGINAL vs NEW EXPORT")
    print("=" * 70)
    print(f"{'Metric':<35} | {'Original':>15} | {'New':>15}")
    print("-" * 70)
    print(f"{'Total records':<35} | {'297,900':>15} | {exported:>15,}")
    print(f"{'Axis labels':<35} | {'D/I/R only':>15} | {'9 compositions':>15}")
    print(f"{'TAC+TDC concentration':<35} | {'85.1%':>15} | {'N/A (rescored)':>15}")
    print(f"{'Top-2 motif concentration':<35} | {'85.1%':>15} | {top2_pct:>14.1f}%")
    print(f"{'Motifs with >1% share':<35} | {'5':>15} | {sum(1 for _,c in motif_counts.items() if c/exported*100 > 1):>15}")
    print(f"{'Composition labels':<35} | {'No':>15} | {'Yes':>15}")
    print(f"{'6D vectors included':<35} | {'No':>15} | {'Yes':>15}")
    print(f"{'Confidence scores':<35} | {'No':>15} | {'Yes':>15}")

    # Save stats JSON
    stats = {
        "version": "training_data_dir_v1",
        "date": "2026-04-08",
        "total_exported": exported,
        "total_source": 297900,
        "skipped": {
            "unclassified": skipped_unclassified,
            "temporal_only": skipped_temporal,
            "low_confidence": skipped_low_conf,
        },
        "min_confidence_threshold": MIN_CONFIDENCE,
        "mean_confidence": round(float(np.mean(confidences)), 4),
        "file_size_raw_mb": round(raw_mb, 1),
        "file_size_gz_mb": round(gz_mb, 1),
        "compositions": {
            comp: {
                "count": comp_counts.get(comp, 0),
                "pct": round(comp_counts.get(comp, 0) / exported * 100, 2),
                "mean_confidence": round(float(np.mean(comp_confidences.get(comp, [0]))), 4)
            }
            for comp in order
        },
        "axes": {axis: {"count": cnt, "pct": round(cnt / exported * 100, 2)}
                 for axis, cnt in axis_counts.items()},
        "source_components": {src: {"count": cnt, "pct": round(cnt / exported * 100, 2)}
                              for src, cnt in source_counts.most_common()},
        "motif_distribution": {mid: {"count": cnt, "pct": round(cnt / exported * 100, 2)}
                               for mid, cnt in motif_counts.most_common()},
        "top2_motif_concentration_pct": round(top2_pct, 1),
        "motifs_above_1pct": sum(1 for _, c in motif_counts.items() if c / exported * 100 > 1),
        "comparison_original": {
            "original_tac_tdc_pct": 85.1,
            "new_top2_pct": round(top2_pct, 1),
            "original_motifs_above_1pct": 5,
            "new_motifs_above_1pct": sum(1 for _, c in motif_counts.items() if c / exported * 100 > 1)
        }
    }

    stats_path = OUTPUT / "training_data_dir_v1_stats.json"
    with open(stats_path, "w") as f:
        json.dump(stats, f, indent=2)
    print(f"\nSaved stats to {stats_path}")

    # Return key values for commit message
    print(f"\n--- COMMIT VALUES ---")
    print(f"RECORDS={exported}")
    print(f"TOP2_PCT={top2_pct:.1f}")
    print(f"COMPOSITIONS={len([c for c in order if comp_counts.get(c, 0) > 0])}")


if __name__ == "__main__":
    main()
