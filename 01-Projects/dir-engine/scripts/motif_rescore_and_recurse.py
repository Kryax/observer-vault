#!/usr/bin/env python3
"""Phase 2 Steps 2 & 3: Composition-aware motif re-scoring + recurse recovery."""

import json
import numpy as np
from pathlib import Path
from collections import defaultdict, Counter

DATA = Path(__file__).resolve().parent.parent / "data"
DATASET = Path("/mnt/zfs-host/backup/projects/observer-vault/01-Projects/dataset-processor/output/paired-structured-all.jsonl")

# R-axis operator signatures for recurse recovery
R_OPERATORS = {
    "observe", "reflect", "monitor", "self-modify", "recurse", "iterate",
    "bootstrap", "meta-observe", "meta-evaluate", "self-reference",
    "co-evolve", "feedback", "ratchet", "calibrate", "introspect",
    "self-correct", "adapt", "reframe", "revise", "refine"
}

# R-axis process shape keywords
R_SHAPE_KEYWORDS = [
    "feedback", "self-referential", "recursive", "loop", "cyclic",
    "self-modifying", "meta-", "co-evolution", "reflexive", "bootstrap",
    "ratchet", "introspect", "observe itself", "frame of reference"
]

def load_motifs():
    """Load 45 motifs, build abbreviation map, assign compositions to uncomposed."""
    with open(DATA / "motifs.json") as f:
        obj = json.load(f)
    motifs = obj["motifs"]

    # Build abbreviation -> motif map
    abbr_map = {}
    for mot in motifs:
        words = mot["id"].replace("-", " ").split()
        abbr = "".join(w[0].upper() for w in words if w)
        mot["abbr"] = abbr
        abbr_map[abbr] = mot

    # Assign default compositions to uncomposed motifs based on primary_axis
    axis_to_default_comp = {
        "differentiate": "D",
        "integrate": "I",
        "recurse": "R"
    }
    for mot in motifs:
        if not mot.get("composition"):
            axis = mot.get("primary_axis", "")
            mot["composition"] = axis_to_default_comp.get(axis, "")

    return motifs, abbr_map


def composition_distance(record_comp, motif_comp):
    """Score how well a record composition matches a motif's composition.

    Returns 0.0 (no match) to 1.0 (exact match).
    Partial matches for shared primary or secondary axis.
    """
    if not record_comp or not motif_comp:
        return 0.0

    # Handle bare axis labels (D, I, R) for uncomposed motifs
    if len(motif_comp) == 1:
        # Motif has only primary axis
        primary_map = {"D": "D", "I": "I", "R": "R"}
        rec_primary = record_comp[0] if record_comp else ""
        if rec_primary == motif_comp:
            return 0.7  # Primary axis match, but no secondary to compare
        return 0.0

    # Handle composed labels like D(I), R(R), R(I(D))
    # Extract primary and secondary
    def parse_comp(c):
        if "(" in c:
            primary = c[0]
            secondary = c[2] if len(c) > 2 else ""
            return primary, secondary
        return c[0] if c else "", ""

    rec_p, rec_s = parse_comp(record_comp)
    mot_p, mot_s = parse_comp(motif_comp)

    score = 0.0
    if rec_p == mot_p:
        score += 0.6
    if rec_s and mot_s and rec_s == mot_s:
        score += 0.4
    elif rec_p == mot_s or rec_s == mot_p:
        score += 0.15  # Partial cross-match

    return min(score, 1.0)


def operator_overlap(record_ops, motif_indicators):
    """Compute Jaccard-like overlap between record operators and motif indicators."""
    if not record_ops or not motif_indicators:
        return 0.0
    rec_set = set(str(o).lower() for o in record_ops)
    mot_set = set(str(i).lower() for i in motif_indicators)
    intersection = rec_set & mot_set
    union = rec_set | mot_set
    if not union:
        return 0.0
    return len(intersection) / len(union)


def shape_similarity(record_shape, motif_axis):
    """Score process shape alignment with motif axis.

    Uses structural keywords in the shape string.
    """
    if not record_shape:
        return 0.0

    shape_lower = record_shape.lower()

    # Axis-specific shape keywords
    axis_keywords = {
        "D": ["differentiat", "classif", "categor", "boundar", "separat",
              "distinguish", "type", "taxonom", "partition", "decompos",
              "state machine", "finite state", "composable", "modular"],
        "I": ["integrat", "unif", "converg", "synthes", "combin", "merg",
              "govern", "consensus", "dual-speed", "two-speed", "constitutional",
              "reconcil", "harmoniz", "consolidat"],
        "R": ["recurs", "feedback", "self-referent", "reflect", "meta-",
              "bootstrap", "co-evolv", "ratchet", "loop", "cycl",
              "self-modif", "observ", "introspect", "reflex"]
    }

    # Score for each axis
    scores = {}
    for axis, keywords in axis_keywords.items():
        hits = sum(1 for kw in keywords if kw in shape_lower)
        scores[axis] = hits / len(keywords)

    # Return score for the motif's primary axis
    primary = motif_axis[0].upper() if motif_axis else ""
    axis_map = {"differentiate": "D", "integrate": "I", "recurse": "R"}
    mapped = axis_map.get(motif_axis, primary)

    return scores.get(mapped, 0.0)


def score_record_against_motif(record, motif):
    """Compute composite match score for a record against a motif."""
    comp = record.get("composition", "")
    motif_comp = motif.get("composition", "")

    # Component 1: Composition alignment (weight: 0.40)
    comp_score = composition_distance(comp, motif_comp)

    # Component 2: Operator overlap (weight: 0.25)
    ops = record.get("operators", [])
    indicators = motif.get("indicators", [])
    op_score = operator_overlap(ops, indicators)

    # Component 3: Process shape similarity (weight: 0.20)
    shape = record.get("process_shape", "")
    shape_score = shape_similarity(shape, motif.get("primary_axis", ""))

    # Component 4: Tier B score baseline (weight: 0.15)
    tier_b = record.get("tier_b_score", 0.0)

    composite = (0.40 * comp_score +
                 0.25 * op_score +
                 0.20 * shape_score +
                 0.15 * tier_b)

    return {
        "score": round(composite, 4),
        "composition_match": round(comp_score, 4),
        "operator_overlap": round(op_score, 4),
        "shape_similarity": round(shape_score, 4),
        "tier_b": round(tier_b, 4)
    }


def has_r_axis_signature(record):
    """Check if a record has recursive process signatures."""
    ops = set(str(o).lower() for o in record.get("operators", []))
    r_ops_found = ops & R_OPERATORS

    shape = (record.get("process_shape", "") or "").lower()
    r_shape_hits = sum(1 for kw in R_SHAPE_KEYWORDS if kw in shape)

    temporal = (record.get("temporal_structure", "") or "").lower()
    cyclic_temporal = any(kw in temporal for kw in ["cyclic", "recursive", "feedback", "loop"])

    # Require at least one strong signal
    has_signature = (len(r_ops_found) >= 1 or r_shape_hits >= 2 or cyclic_temporal)

    return has_signature, {
        "r_operators": list(r_ops_found),
        "r_shape_hits": r_shape_hits,
        "cyclic_temporal": cyclic_temporal
    }


def main():
    # Load motifs
    motifs, abbr_map = load_motifs()
    print(f"Loaded {len(motifs)} motifs")

    # Count motifs with explicit compositions
    composed = sum(1 for m in motifs if len(m.get("composition", "")) > 1)
    print(f"  {composed} with explicit compositions, {len(motifs) - composed} with axis-only")

    # Load composition labels from Step 1
    print("\nLoading composition labels...")
    comp_labels = []
    with open(DATA / "composition_labels_297k.jsonl") as f:
        for line in f:
            comp_labels.append(json.loads(line))
    print(f"  Loaded {len(comp_labels)} composition labels")

    # Load verb records (source text + process data)
    print("Loading verb records from paired-structured-all.jsonl...")
    records = []
    with open(DATASET) as f:
        for i, line in enumerate(f):
            obj = json.loads(line)
            vr = obj["verb_record"]
            proc = vr.get("process", {})
            records.append({
                "operators": proc.get("operators", []),
                "process_shape": proc.get("shape", ""),
                "axis": proc.get("axis", ""),
                "temporal_structure": proc.get("temporalStructure", ""),
                "original_motif": vr.get("motifMatch", {}).get("motifId", "none"),
                "original_confidence": vr.get("motifMatch", {}).get("confidence", 0.0),
                "tier_b_score": vr.get("quality", {}).get("tierBScore", 0.0),
                "source_component": vr.get("source", {}).get("component", "unknown"),
                "composition": comp_labels[i]["composition"],
                "comp_confidence": comp_labels[i]["confidence"],
                "comp_distance": comp_labels[i]["distance"]
            })
            if (i + 1) % 50000 == 0:
                print(f"  ...{i + 1:,} records loaded")
    print(f"  Loaded {len(records):,} records total")

    # =========================================================================
    # STEP 2: Composition-aware motif re-scoring
    # =========================================================================
    print("\n" + "=" * 70)
    print("STEP 2: COMPOSITION-AWARE MOTIF RE-SCORING")
    print("=" * 70)

    old_dist = Counter()
    new_dist = Counter()
    reclassified_count = 0
    rescored_records = []

    for i, rec in enumerate(records):
        old_motif = rec["original_motif"]
        old_dist[old_motif] += 1

        # Skip unclassified / temporal_only
        if rec["composition"] in ("unclassified", "temporal_only"):
            # Keep original assignment
            new_dist[old_motif] += 1
            rescored_records.append({
                "record_idx": i,
                "composition": rec["composition"],
                "original_motif": old_motif,
                "new_top3_motifs": [{"motif_id": old_motif, "score": 0.0,
                                     "composition_match": 0.0, "operator_overlap": 0.0}],
                "reclassified": False
            })
            continue

        # Score against all 45 motifs
        scores = []
        for mot in motifs:
            result = score_record_against_motif(rec, mot)
            scores.append((mot["abbr"], result))

        # Sort by composite score, descending
        scores.sort(key=lambda x: -x[1]["score"])
        top3 = scores[:3]

        new_motif = top3[0][0]
        reclassified = (new_motif != old_motif)
        if reclassified:
            reclassified_count += 1

        new_dist[new_motif] += 1

        rescored_records.append({
            "record_idx": i,
            "composition": rec["composition"],
            "original_motif": old_motif,
            "new_top3_motifs": [
                {"motif_id": mid, "score": s["score"],
                 "composition_match": s["composition_match"],
                 "operator_overlap": s["operator_overlap"]}
                for mid, s in top3
            ],
            "reclassified": reclassified
        })

        if (i + 1) % 50000 == 0:
            print(f"  ...{i + 1:,} records scored")

    print(f"\nTotal reclassified: {reclassified_count:,} / {len(records):,} "
          f"({reclassified_count / len(records) * 100:.1f}%)")

    # Save rescored records
    out_path = DATA / "motif_rescored_297k.jsonl"
    print(f"\nSaving rescored records to {out_path}...")
    with open(out_path, "w") as f:
        for rec in rescored_records:
            f.write(json.dumps(rec) + "\n")
    print(f"  Wrote {len(rescored_records):,} records")

    # Print old vs new distribution
    all_motifs_seen = sorted(set(list(old_dist.keys()) + list(new_dist.keys())),
                             key=lambda x: -(new_dist.get(x, 0)))

    print(f"\n{'Motif':<12} | {'Old Count':>10} | {'Old %':>7} | {'New Count':>10} | {'New %':>7} | {'Delta':>8}")
    print("-" * 72)

    old_tac_tdc = old_dist.get("TAC", 0) + old_dist.get("TDC", 0)
    new_tac_tdc = new_dist.get("TAC", 0) + new_dist.get("TDC", 0)

    total = len(records)
    for mid in all_motifs_seen[:25]:
        oc = old_dist.get(mid, 0)
        nc = new_dist.get(mid, 0)
        delta = nc - oc
        sign = "+" if delta > 0 else ""
        print(f"{mid:<12} | {oc:>10,} | {oc/total*100:>6.1f}% | {nc:>10,} | {nc/total*100:>6.1f}% | {sign}{delta:>7,}")

    if len(all_motifs_seen) > 25:
        print(f"  ... and {len(all_motifs_seen) - 25} more motifs")

    print(f"\n{'TAC+TDC concentration:':.<40} {old_tac_tdc/total*100:.1f}% -> {new_tac_tdc/total*100:.1f}%")
    print(f"{'Unique motifs with >100 records:':.<40} "
          f"{sum(1 for v in old_dist.values() if v > 100)} -> "
          f"{sum(1 for v in new_dist.values() if v > 100)}")

    # =========================================================================
    # STEP 3: RECURSE RECOVERY
    # =========================================================================
    print("\n" + "=" * 70)
    print("STEP 3: RECURSE RECOVERY")
    print("=" * 70)

    r_signature_records = []
    for i, rec in enumerate(records):
        has_sig, details = has_r_axis_signature(rec)
        if has_sig:
            r_signature_records.append({
                "record_idx": i,
                "composition": rec["composition"],
                "comp_confidence": rec["comp_confidence"],
                "original_motif": rec["original_motif"],
                "source_component": rec["source_component"],
                "axis": rec["axis"],
                **details
            })

    total_r_sig = len(r_signature_records)
    print(f"\nTotal records with R-axis operator signatures: {total_r_sig:,}")

    # Breakdown by composition
    r_by_comp = Counter(r["composition"] for r in r_signature_records)
    r_primary = sum(r_by_comp.get(c, 0) for c in ["R(D)", "R(I)", "R(R)"])
    d_or_i = total_r_sig - r_primary

    # Reclassification candidates: in D/I composition + low confidence
    reclass_candidates = [
        r for r in r_signature_records
        if r["composition"] not in ("R(D)", "R(I)", "R(R)", "temporal_only", "unclassified")
    ]
    low_conf_candidates = [r for r in reclass_candidates if r["comp_confidence"] < 0.4]

    print(f"  Already R-classified: {r_primary:,} ({r_primary/total_r_sig*100:.1f}%)")
    print(f"  In D/I compositions (reclass candidates): {len(reclass_candidates):,} ({len(reclass_candidates)/total_r_sig*100:.1f}%)")
    print(f"  Low confidence + R operators (strong candidates): {len(low_conf_candidates):,}")

    # Breakdown by composition
    print(f"\n  {'Composition':<14} | {'R-sig count':>11} | {'% of comp':>9}")
    print("  " + "-" * 42)
    comp_totals = Counter(rec["composition"] for rec in records)
    for comp in ["D(D)", "D(I)", "D(R)", "I(D)", "I(I)", "I(R)", "R(D)", "R(I)", "R(R)", "temporal_only", "unclassified"]:
        cnt = r_by_comp.get(comp, 0)
        total_comp = comp_totals.get(comp, 1)
        print(f"  {comp:<14} | {cnt:>11,} | {cnt/total_comp*100:>8.1f}%")

    # Source component breakdown for reclass candidates
    reclass_sources = Counter(r["source_component"] for r in reclass_candidates)
    print(f"\n  Reclassification candidates by source component:")
    for src, cnt in reclass_sources.most_common(10):
        print(f"    {src:<25} {cnt:>6,} ({cnt/len(reclass_candidates)*100:.1f}%)")

    # shard-01 found 16% genuine — check ratio across all
    # "Genuine" = has both R operators AND R shape hits
    genuine_r = [
        r for r in reclass_candidates
        if len(r["r_operators"]) >= 1 and r["r_shape_hits"] >= 1
    ]
    genuine_pct = len(genuine_r) / len(reclass_candidates) * 100 if reclass_candidates else 0

    print(f"\n  Shard-01 baseline: 16% genuine recurse among candidates")
    print(f"  Full corpus: {len(genuine_r):,} / {len(reclass_candidates):,} = {genuine_pct:.1f}% genuine")
    print(f"  {'CONSISTENT' if 10 <= genuine_pct <= 25 else 'DIVERGENT'} with shard-01 finding")

    # Save recurse recovery analysis
    recurse_analysis = {
        "version": "20260408-phase2-step3",
        "total_r_signatures": total_r_sig,
        "already_r_classified": r_primary,
        "reclassification_candidates": len(reclass_candidates),
        "low_confidence_candidates": len(low_conf_candidates),
        "genuine_r_ratio": round(genuine_pct, 1),
        "shard01_baseline": 16.0,
        "by_composition": {comp: r_by_comp.get(comp, 0)
                          for comp in ["D(D)", "D(I)", "D(R)", "I(D)", "I(I)", "I(R)",
                                       "R(D)", "R(I)", "R(R)", "temporal_only", "unclassified"]},
        "reclass_by_source": dict(reclass_sources.most_common(15)),
        "genuine_candidates": [
            {"record_idx": r["record_idx"], "composition": r["composition"],
             "r_operators": r["r_operators"], "r_shape_hits": r["r_shape_hits"],
             "comp_confidence": r["comp_confidence"]}
            for r in genuine_r[:500]  # Sample
        ]
    }

    with open(DATA / "recurse_recovery_analysis.json", "w") as f:
        json.dump(recurse_analysis, f, indent=2)
    print(f"\n  Saved recurse_recovery_analysis.json")

    # Save re-score summary
    rescore_summary = {
        "version": "20260408-phase2-step2",
        "total_records": len(records),
        "reclassified_count": reclassified_count,
        "reclassified_pct": round(reclassified_count / len(records) * 100, 1),
        "old_tac_tdc_pct": round(old_tac_tdc / total * 100, 1),
        "new_tac_tdc_pct": round(new_tac_tdc / total * 100, 1),
        "old_distribution": {k: v for k, v in old_dist.most_common()},
        "new_distribution": {k: v for k, v in new_dist.most_common()},
        "unique_motifs_old": sum(1 for v in old_dist.values() if v > 100),
        "unique_motifs_new": sum(1 for v in new_dist.values() if v > 100),
        "scoring_weights": {
            "composition_alignment": 0.40,
            "operator_overlap": 0.25,
            "process_shape_similarity": 0.20,
            "tier_b_baseline": 0.15
        }
    }

    with open(DATA / "motif_rescore_summary.json", "w") as f:
        json.dump(rescore_summary, f, indent=2)
    print(f"  Saved motif_rescore_summary.json")

    # Final summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"  TAC+TDC: {old_tac_tdc/total*100:.1f}% -> {new_tac_tdc/total*100:.1f}%")
    print(f"  Reclassified: {reclassified_count:,} records ({reclassified_count/total*100:.1f}%)")
    print(f"  Recurse candidates recovered: {len(reclass_candidates):,}")
    print(f"  Strong R candidates (low conf + R ops): {len(low_conf_candidates):,}")


if __name__ == "__main__":
    main()
