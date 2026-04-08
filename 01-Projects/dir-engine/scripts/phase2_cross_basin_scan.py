#!/usr/bin/env python3
"""Phase 2 D(I): Cross-basin signature scan.

For each of the 9 basin signatures from Phase 1, scan all 262K basin-assigned
records and flag matches to signatures outside the record's home basin.

Match criteria (union):
  - Vector cosine similarity >= 0.85 with signature centroid, OR
  - At least 3 of the signature's top-10 operators appear in the record

Reads:
  - data/basin_signatures_phase1.json
  - data/vectors_297k_v3.jsonl
  - data/composition_labels_297k.jsonl
  - dataset-processor/output/paired-structured-all.jsonl (for operators)
  - data/composition_distribution.json (for domain info)

Outputs:
  - data/cross_basin_matches_phase2.json
"""

import json
import math
import sys
from collections import Counter, defaultdict
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
PAIRED = Path(__file__).resolve().parent.parent.parent / "dataset-processor" / "output" / "paired-structured-all.jsonl"

BASINS = ["D(D)", "D(I)", "D(R)", "I(D)", "I(I)", "I(R)", "R(D)", "R(I)", "R(R)"]
VECTOR_THRESHOLD = 0.85
OPERATOR_MIN = 3


def cosine_sim(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(x * x for x in b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


def main():
    # Load Phase 1 signatures
    print("Loading Phase 1 signatures...", file=sys.stderr)
    with open(DATA / "basin_signatures_phase1.json") as f:
        sigs = json.load(f)

    # Build signature lookup: basin -> (centroid, top10_operators_set)
    sig_data = {}
    for basin in BASINS:
        b = sigs["basins"][basin]
        centroid = b["vector_centroid"]
        top10_ops = set(b["top_operators"][:10])
        sig_data[basin] = {
            "centroid": centroid,
            "top10_ops": top10_ops,
            "motif": b["dominant_motif"],
        }

    # Pass 1: Read composition labels
    print("Reading composition labels...", file=sys.stderr)
    compositions = {}
    with open(DATA / "composition_labels_297k.jsonl") as f:
        for line in f:
            rec = json.loads(line)
            comp = rec["composition"]
            if comp in sig_data:
                compositions[rec["record_idx"]] = comp
    print(f"  {len(compositions)} records in 9 basins", file=sys.stderr)

    # Track cross-basin matches
    # matches[home_sig_basin] -> list of (record_idx, record_home_basin, match_type)
    foreign_by_sig = {b: [] for b in BASINS}

    # Pass 2: Stream vectors + operators together (both 297900 lines, aligned by index)
    print("Scanning all records against 9 signatures...", file=sys.stderr)
    vec_file = open(DATA / "vectors_297k_v3.jsonl")
    paired_file = open(PAIRED)

    checked = 0
    total_foreign = 0

    for idx, (vec_line, paired_line) in enumerate(zip(vec_file, paired_file)):
        if idx not in compositions:
            continue

        home_basin = compositions[idx]
        vec = json.loads(vec_line)

        # Extract operators from paired-structured
        try:
            paired_rec = json.loads(paired_line)
            vr = paired_rec.get("verb_record", {})
            proc = vr.get("process", {})
            record_ops = set(proc.get("operators", []))
            record_domain = vr.get("domain", "unknown")
        except (json.JSONDecodeError, KeyError):
            record_ops = set()
            record_domain = "unknown"

        checked += 1

        # Check against all 9 signatures
        for sig_basin in BASINS:
            if sig_basin == home_basin:
                continue  # skip home basin

            sd = sig_data[sig_basin]

            # Vector match
            cos = cosine_sim(vec, sd["centroid"])
            vec_match = cos >= VECTOR_THRESHOLD

            # Operator match
            op_overlap = record_ops & sd["top10_ops"]
            op_match = len(op_overlap) >= OPERATOR_MIN

            if vec_match or op_match:
                match_type = []
                if vec_match:
                    match_type.append("vector")
                if op_match:
                    match_type.append("operator")

                foreign_by_sig[sig_basin].append({
                    "record_idx": idx,
                    "home_basin": home_basin,
                    "domain": record_domain,
                    "match_type": match_type,
                    "cosine": round(cos, 4),
                    "op_overlap_count": len(op_overlap),
                })
                total_foreign += 1

        if checked % 50000 == 0:
            print(f"  checked {checked} records, {total_foreign} foreign matches so far", file=sys.stderr)

    vec_file.close()
    paired_file.close()
    print(f"  Done: {checked} records checked, {total_foreign} total foreign matches", file=sys.stderr)

    # Build output
    output = {
        "version": "phase2-di-v1",
        "threshold": {"vector_cosine": VECTOR_THRESHOLD, "operator_min": OPERATOR_MIN},
        "records_scanned": checked,
        "matches": {},
        "summary": {},
    }

    all_match_counts = {}
    all_basin_sources = {}

    for sig_basin in BASINS:
        motif = sig_data[sig_basin]["motif"]
        matches = foreign_by_sig[sig_basin]
        n = len(matches)
        all_match_counts[motif] = n

        # Count by source basin
        by_basin = Counter(m["home_basin"] for m in matches)
        # Count by domain
        by_domain = Counter(m["domain"] for m in matches)
        # Count by match type
        vec_only = sum(1 for m in matches if m["match_type"] == ["vector"])
        op_only = sum(1 for m in matches if m["match_type"] == ["operator"])
        both = sum(1 for m in matches if len(m["match_type"]) == 2)
        # Unique basins matched
        basins_matched = len(by_basin)

        all_basin_sources[sig_basin] = set(by_basin.keys())

        output["matches"][motif] = {
            "home_basin": sig_basin,
            "foreign_match_count": n,
            "basins_matched": basins_matched,
            "foreign_matches_by_basin": dict(by_basin.most_common()),
            "foreign_matches_by_domain": dict(by_domain.most_common(10)),
            "match_type_breakdown": {
                "vector_only": vec_only,
                "operator_only": op_only,
                "both": both,
            },
            "top3_source_basins": [b for b, _ in by_basin.most_common(3)],
            "top3_source_domains": [d for d, _ in by_domain.most_common(3)],
        }

    # Find mutual overlaps
    mutual_pairs = []
    for i, b1 in enumerate(BASINS):
        for b2 in BASINS[i+1:]:
            m1 = sig_data[b1]["motif"]
            m2 = sig_data[b2]["motif"]
            # b1's signature matches in b2, AND b2's signature matches in b1
            b1_in_b2 = b2 in all_basin_sources[b1]
            b2_in_b1 = b1 in all_basin_sources[b2]
            if b1_in_b2 and b2_in_b1:
                mutual_pairs.append([m1, m2])

    # Also add mutual_overlaps to each signature entry
    for sig_basin in BASINS:
        motif = sig_data[sig_basin]["motif"]
        mutuals = []
        for pair in mutual_pairs:
            if motif in pair:
                other = pair[0] if pair[1] == motif else pair[1]
                mutuals.append(other)
        output["matches"][motif]["mutual_overlaps"] = mutuals

    # Summary
    broadest = max(all_match_counts, key=all_match_counts.get)
    narrowest = min(all_match_counts, key=all_match_counts.get)
    broadest_basin = output["matches"][broadest]["home_basin"]
    narrowest_basin = output["matches"][narrowest]["home_basin"]

    output["summary"] = {
        "total_cross_basin_matches": total_foreign,
        "broadest_signature": broadest,
        "broadest_count": all_match_counts[broadest],
        "broadest_basins_matched": output["matches"][broadest]["basins_matched"],
        "narrowest_signature": narrowest,
        "narrowest_count": all_match_counts[narrowest],
        "narrowest_basins_matched": output["matches"][narrowest]["basins_matched"],
        "mutual_pairs": mutual_pairs,
        "mutual_pair_count": len(mutual_pairs),
    }

    # Print summary table
    print("\n" + "=" * 140)
    print(f"{'Signature (Basin)':<20} | {'Foreign':>7} | {'Basins':>6} | {'Vec-only':>8} | {'Op-only':>7} | {'Both':>6} | {'Top 3 Source Basins':<35} | Top 3 Domains")
    print("-" * 140)
    for sig_basin in BASINS:
        motif = sig_data[sig_basin]["motif"]
        m = output["matches"][motif]
        label = f"{motif} ({sig_basin})"
        top_b = ", ".join(m["top3_source_basins"])
        top_d = ", ".join(m["top3_source_domains"][:3])
        mtb = m["match_type_breakdown"]
        print(f"{label:<20} | {m['foreign_match_count']:>7} | {m['basins_matched']:>6} | {mtb['vector_only']:>8} | {mtb['operator_only']:>7} | {mtb['both']:>6} | {top_b:<35} | {top_d}")
    print("=" * 140)

    print(f"\nTotal cross-basin matches: {total_foreign}")
    print(f"Broadest: {broadest} ({all_match_counts[broadest]} matches across {output['matches'][broadest]['basins_matched']} basins)")
    print(f"Narrowest: {narrowest} ({all_match_counts[narrowest]} matches across {output['matches'][narrowest]['basins_matched']} basins)")
    print(f"Mutual overlap pairs: {len(mutual_pairs)}")
    for pair in mutual_pairs:
        print(f"  {pair[0]} <-> {pair[1]}")

    # Per-signature detail: foreign matches by basin
    print("\n--- Per-signature foreign match breakdown ---")
    for sig_basin in BASINS:
        motif = sig_data[sig_basin]["motif"]
        m = output["matches"][motif]
        print(f"\n{motif} ({sig_basin}): {m['foreign_match_count']} foreign matches")
        for b, c in sorted(m["foreign_matches_by_basin"].items(), key=lambda x: -x[1]):
            print(f"  from {b}: {c}")

    # Save
    out_path = DATA / "cross_basin_matches_phase2.json"
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\nSaved to {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
