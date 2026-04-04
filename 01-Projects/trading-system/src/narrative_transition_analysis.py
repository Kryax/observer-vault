#!/usr/bin/env python3
"""
Non-Equilibrium Enneagram Test — Narrative Sequence Transitions

Hypothesis: The Enneagram describes NON-equilibrium dynamics — directed
trajectories that only appear in narrative sequences, not static topology.

This script:
1. Reads enriched shard databases (00-09) with compositionExpression
2. Filters for narrative-sequence records (sequential temporal structure + text markers)
3. Computes a 9x9 DIRECTED transition matrix from filtered sequences only
4. Compares asymmetry ratios against the equilibrium matrix (max 1.22x)
5. Maps dominant flows to known Enneagram integration/disintegration lines
"""

import json
import re
import sqlite3
import sys
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np

# ── Configuration ────────────────────────────────────────────────────────────

SHARD_DIR = Path("/mnt/zfs-host/backup/projects/observer-vault/01-Projects/dataset-processor/output")
OUTPUT_DIR = Path("/mnt/zfs-host/backup/projects/observer-vault/01-Projects/trading-system/data")
EQUILIBRIUM_PATH = OUTPUT_DIR / "composition_transition_matrix.json"

COMPOSITIONS = ["D(D)", "D(I)", "D(R)", "I(D)", "I(I)", "I(R)", "R(D)", "R(I)", "R(R)"]
COMP_TO_IDX = {c: i for i, c in enumerate(COMPOSITIONS)}

# Sequential/narrative text markers — regex patterns
NARRATIVE_MARKERS = [
    r"\bfirst\b.{1,80}\bthen\b",
    r"\bbegan\b.{1,120}\b(?:led to|resulted in)\b",
    r"\bphase\s*[1-3]\b",
    r"\bstep\s*[1-3]\b",
    r"\bbefore\b.{1,80}\bafter\b",
    r"\binitially\b.{1,120}\beventually\b",
    r"\bstart(?:ed|ing)\b.{1,120}\bend(?:ed|ing)\b",
    r"\bfirst\b.{1,80}\bfinally\b",
    r"\bprocess\b.{1,80}\b(?:stage|phase|step)\b",
    r"\btransition(?:ed|ing)?\b.{1,80}\b(?:from|to|into)\b",
    r"\bevolved?\b.{1,80}\b(?:from|into|toward)\b",
    r"\bsequence\b.{1,80}\b(?:of|from|through)\b",
    r"\bprogress(?:ed|ion|ing)\b",
    r"\btransform(?:ed|ation|ing)\b.{1,60}\b(?:from|into|to)\b",
    r"\bcause[ds]?\b.{1,60}\b(?:effect|result|outcome)\b",
    r"\bconsequen(?:ce|tly)\b",
    r"\bsubsequent(?:ly)?\b",
    r"\btherefore\b",
    r"\baccordingly\b",
    r"\bhence\b",
    r"\bthus\b.{1,40}\b(?:led|caused|resulted)\b",
]

# Compile once
NARRATIVE_PATTERNS = [re.compile(p, re.IGNORECASE | re.DOTALL) for p in NARRATIVE_MARKERS]

# Enneagram lines mapped to D/I/R compositions
# Classic Enneagram types 1-9 → we map to the 9 compositions in order:
# Type 1=D(D), 2=D(I), 3=D(R), 4=I(D), 5=I(I), 6=I(R), 7=R(D), 8=R(I), 9=R(R)
ENNEAGRAM_TYPE_TO_COMP = {
    1: "D(D)", 2: "D(I)", 3: "D(R)",
    4: "I(D)", 5: "I(I)", 6: "I(R)",
    7: "R(D)", 8: "R(I)", 9: "R(R)",
}
COMP_TO_TYPE = {v: k for k, v in ENNEAGRAM_TYPE_TO_COMP.items()}

# Integration lines: 1→7→5→8→2→4→1 and 9→3→6→9
INTEGRATION_LINES = [
    (1, 7), (7, 5), (5, 8), (8, 2), (2, 4), (4, 1),  # hexad
    (9, 3), (3, 6), (6, 9),  # triangle
]

# Disintegration lines: 1→4→2→8→5→7→1 and 9→6→3→9
DISINTEGRATION_LINES = [
    (1, 4), (4, 2), (2, 8), (8, 5), (5, 7), (7, 1),  # hexad
    (9, 6), (6, 3), (3, 9),  # triangle
]


def has_narrative_markers(text: str) -> bool:
    """Check if text contains sequential/narrative markers."""
    for pat in NARRATIVE_PATTERNS:
        if pat.search(text):
            return True
    return False


def load_narrative_sequences(shard_path: Path) -> list[list[str]]:
    """
    Load narrative-sequence records from a shard database.
    Returns sequences of compositionExpression values, grouped by document.
    """
    conn = sqlite3.connect(str(shard_path))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # Get records with composition, ordered by document and position
    cur.execute("""
        SELECT source_document_id, compositionExpression, process_temporal_structure,
               source_raw_text, source_char_start
        FROM verb_records
        WHERE compositionExpression IS NOT NULL
          AND compositionExpression != ''
        ORDER BY source_document_id, source_char_start
    """)

    # Group by document, filter for narrative sequences
    doc_sequences = defaultdict(list)
    stats = {"total_with_comp": 0, "temporal_match": 0, "text_match": 0, "both_match": 0}

    for row in cur:
        stats["total_with_comp"] += 1
        comp = row["compositionExpression"]
        temporal = row["process_temporal_structure"] or ""
        text = row["source_raw_text"] or ""
        doc_id = row["source_document_id"]
        char_start = row["source_char_start"]

        # Filter: high temporal score (sequential/cyclic) OR text markers
        is_temporal = temporal in ("sequential", "cyclic")
        is_text_narrative = has_narrative_markers(text)

        if is_temporal:
            stats["temporal_match"] += 1
        if is_text_narrative:
            stats["text_match"] += 1
        if is_temporal and is_text_narrative:
            stats["both_match"] += 1

        if is_temporal or is_text_narrative:
            doc_sequences[doc_id].append((char_start, comp))

    conn.close()

    # Sort each document's records by position and extract composition sequence
    sequences = []
    for doc_id, records in doc_sequences.items():
        records.sort(key=lambda x: x[0])
        seq = [r[1] for r in records]
        if len(seq) >= 2:  # Need at least 2 for a transition
            sequences.append(seq)

    return sequences, stats


def compute_transition_matrix(all_sequences: list[list[str]]) -> np.ndarray:
    """Compute 9x9 directed transition count matrix from sequences."""
    matrix = np.zeros((9, 9), dtype=int)
    for seq in all_sequences:
        for i in range(len(seq) - 1):
            from_idx = COMP_TO_IDX.get(seq[i])
            to_idx = COMP_TO_IDX.get(seq[i + 1])
            if from_idx is not None and to_idx is not None:
                matrix[from_idx][to_idx] += 1
    return matrix


def compute_asymmetry_ratios(matrix: np.ndarray) -> list[dict]:
    """Compute asymmetry ratio for each pair (i,j): max(M[i,j], M[j,i]) / min(...)."""
    ratios = []
    for i in range(9):
        for j in range(i + 1, 9):
            a, b = matrix[i][j], matrix[j][i]
            if a == 0 and b == 0:
                continue
            min_val = max(min(a, b), 1)  # avoid division by zero
            ratio = max(a, b) / min_val
            direction = f"{COMPOSITIONS[i]} -> {COMPOSITIONS[j]}" if a >= b else f"{COMPOSITIONS[j]} -> {COMPOSITIONS[i]}"
            ratios.append({
                "pair": f"{COMPOSITIONS[i]} <-> {COMPOSITIONS[j]}",
                "forward": int(a),
                "reverse": int(b),
                "ratio": round(ratio, 3),
                "dominant_direction": direction,
                "dominant_count": int(max(a, b)),
                "subordinate_count": int(min(a, b)),
            })
    ratios.sort(key=lambda x: x["ratio"], reverse=True)
    return ratios


def check_enneagram_lines(matrix: np.ndarray) -> dict:
    """Check if dominant flows match Enneagram integration/disintegration patterns."""
    results = {"integration": [], "disintegration": []}

    for from_type, to_type in INTEGRATION_LINES:
        from_comp = ENNEAGRAM_TYPE_TO_COMP[from_type]
        to_comp = ENNEAGRAM_TYPE_TO_COMP[to_type]
        i, j = COMP_TO_IDX[from_comp], COMP_TO_IDX[to_comp]
        forward = int(matrix[i][j])
        reverse = int(matrix[j][i])
        ratio = round(forward / max(reverse, 1), 3)
        results["integration"].append({
            "line": f"Type {from_type}({from_comp}) -> Type {to_type}({to_comp})",
            "forward_count": forward,
            "reverse_count": reverse,
            "ratio": ratio,
            "matches_direction": bool(forward > reverse),
        })

    for from_type, to_type in DISINTEGRATION_LINES:
        from_comp = ENNEAGRAM_TYPE_TO_COMP[from_type]
        to_comp = ENNEAGRAM_TYPE_TO_COMP[to_type]
        i, j = COMP_TO_IDX[from_comp], COMP_TO_IDX[to_comp]
        forward = int(matrix[i][j])
        reverse = int(matrix[j][i])
        ratio = round(forward / max(reverse, 1), 3)
        results["disintegration"].append({
            "line": f"Type {from_type}({from_comp}) -> Type {to_type}({to_comp})",
            "forward_count": forward,
            "reverse_count": reverse,
            "ratio": ratio,
            "matches_direction": bool(forward > reverse),
        })

    # Summary stats
    int_matches = sum(1 for l in results["integration"] if l["matches_direction"])
    dis_matches = sum(1 for l in results["disintegration"] if l["matches_direction"])
    results["summary"] = {
        "integration_lines_matching": f"{int_matches}/{len(results['integration'])}",
        "disintegration_lines_matching": f"{dis_matches}/{len(results['disintegration'])}",
        "integration_avg_ratio": round(np.mean([l["ratio"] for l in results["integration"]]), 3),
        "disintegration_avg_ratio": round(np.mean([l["ratio"] for l in results["disintegration"]]), 3),
    }

    return results


def main():
    print("=" * 70)
    print("Non-Equilibrium Enneagram Test — Narrative Sequence Transitions")
    print("=" * 70)

    # 1. Load equilibrium matrix
    print("\n[1] Loading equilibrium transition matrix...")
    with open(EQUILIBRIUM_PATH) as f:
        eq_data = json.load(f)
    eq_matrix = np.array(eq_data["transition_counts"])
    print(f"    Equilibrium total transitions: {eq_data['total_transitions']}")

    # Compute equilibrium asymmetry
    eq_ratios = compute_asymmetry_ratios(eq_matrix)
    eq_max_ratio = max(r["ratio"] for r in eq_ratios)
    print(f"    Equilibrium max asymmetry ratio: {eq_max_ratio:.3f}x")

    # 2. Load narrative sequences from all shards
    print("\n[2] Loading narrative-sequence records from shards 00-09...")
    all_sequences = []
    total_stats = Counter()

    for shard_idx in range(10):
        shard_path = SHARD_DIR / f"shard-{shard_idx:02d}.db"
        if not shard_path.exists() or shard_path.stat().st_size == 0:
            print(f"    Shard {shard_idx:02d}: skipped (empty/missing)")
            continue

        sequences, stats = load_narrative_sequences(shard_path)
        all_sequences.extend(sequences)
        for k, v in stats.items():
            total_stats[k] += v

        print(f"    Shard {shard_idx:02d}: {len(sequences)} doc-sequences, "
              f"{stats['total_with_comp']} records with comp, "
              f"{stats['temporal_match']} temporal, {stats['text_match']} text markers")

    total_transitions = sum(len(seq) - 1 for seq in all_sequences)
    print(f"\n    TOTAL: {len(all_sequences)} document-sequences")
    print(f"    TOTAL transitions: {total_transitions}")
    print(f"    Records with composition: {total_stats['total_with_comp']}")
    print(f"    Temporal structure match: {total_stats['temporal_match']}")
    print(f"    Text narrative match: {total_stats['text_match']}")
    print(f"    Both match: {total_stats['both_match']}")

    # 3. Compute narrative transition matrix
    print("\n[3] Computing narrative transition matrix...")
    narr_matrix = compute_transition_matrix(all_sequences)
    print(f"    Matrix sum: {narr_matrix.sum()}")

    # 4. Compute asymmetry ratios
    print("\n[4] Computing asymmetry ratios...")
    narr_ratios = compute_asymmetry_ratios(narr_matrix)
    narr_max_ratio = max(r["ratio"] for r in narr_ratios) if narr_ratios else 0

    print(f"    Narrative max asymmetry ratio: {narr_max_ratio:.3f}x")
    print(f"    Equilibrium max asymmetry ratio: {eq_max_ratio:.3f}x")
    print(f"    Ratio increase: {narr_max_ratio / eq_max_ratio:.2f}x")

    print("\n    Top 5 most asymmetric transitions (narrative):")
    for r in narr_ratios[:5]:
        print(f"      {r['pair']}: {r['ratio']:.3f}x — dominant: {r['dominant_direction']} "
              f"({r['dominant_count']} vs {r['subordinate_count']})")

    # 5. Enneagram line analysis
    print("\n[5] Enneagram integration/disintegration line analysis...")
    enn_results = check_enneagram_lines(narr_matrix)

    print("\n    Integration lines (growth direction):")
    for line in enn_results["integration"]:
        marker = "MATCH" if line["matches_direction"] else "REVERSE"
        print(f"      {line['line']}: {line['forward_count']} → {line['reverse_count']} "
              f"(ratio {line['ratio']:.2f}x) [{marker}]")

    print("\n    Disintegration lines (stress direction):")
    for line in enn_results["disintegration"]:
        marker = "MATCH" if line["matches_direction"] else "REVERSE"
        print(f"      {line['line']}: {line['forward_count']} → {line['reverse_count']} "
              f"(ratio {line['ratio']:.2f}x) [{marker}]")

    print(f"\n    Summary:")
    print(f"      Integration lines matching: {enn_results['summary']['integration_lines_matching']}")
    print(f"      Disintegration lines matching: {enn_results['summary']['disintegration_lines_matching']}")
    print(f"      Integration avg ratio: {enn_results['summary']['integration_avg_ratio']:.3f}")
    print(f"      Disintegration avg ratio: {enn_results['summary']['disintegration_avg_ratio']:.3f}")

    # 6. Equilibrium vs narrative comparison
    print("\n[6] Equilibrium vs Narrative comparison...")

    # Compute per-pair comparison
    eq_ratio_map = {r["pair"]: r for r in eq_ratios}
    comparison_pairs = []
    for nr in narr_ratios:
        eq_r = eq_ratio_map.get(nr["pair"], {})
        comparison_pairs.append({
            "pair": nr["pair"],
            "equilibrium_ratio": eq_r.get("ratio", 0),
            "narrative_ratio": nr["ratio"],
            "ratio_increase": round(nr["ratio"] / max(eq_r.get("ratio", 1), 0.001), 3),
            "equilibrium_direction": eq_r.get("dominant_direction", "N/A"),
            "narrative_direction": nr["dominant_direction"],
            "direction_changed": bool(eq_r.get("dominant_direction", "") != nr["dominant_direction"]),
        })
    comparison_pairs.sort(key=lambda x: x["ratio_increase"], reverse=True)

    # Normalize matrices for KL divergence
    eq_norm = eq_matrix / eq_matrix.sum()
    narr_norm = narr_matrix / max(narr_matrix.sum(), 1)

    # Compute overall asymmetry score: mean of |M[i,j] - M[j,i]| / (M[i,j] + M[j,i])
    def asymmetry_score(m):
        score = 0
        count = 0
        for i in range(9):
            for j in range(i + 1, 9):
                s = m[i][j] + m[j][i]
                if s > 0:
                    score += abs(m[i][j] - m[j][i]) / s
                    count += 1
        return score / max(count, 1)

    eq_asym_score = asymmetry_score(eq_matrix)
    narr_asym_score = asymmetry_score(narr_matrix)

    print(f"    Overall asymmetry score (equilibrium): {eq_asym_score:.4f}")
    print(f"    Overall asymmetry score (narrative):   {narr_asym_score:.4f}")
    print(f"    Asymmetry increase factor:             {narr_asym_score / max(eq_asym_score, 0.001):.2f}x")

    print("\n    Top 5 pairs with greatest asymmetry increase:")
    for cp in comparison_pairs[:5]:
        dir_note = " [DIR CHANGED]" if cp["direction_changed"] else ""
        print(f"      {cp['pair']}: eq={cp['equilibrium_ratio']:.3f}x → narr={cp['narrative_ratio']:.3f}x "
              f"(+{cp['ratio_increase']:.2f}x){dir_note}")

    # 7. Save results
    print("\n[7] Saving results...")

    # Narrative transition matrix
    narr_matrix_out = {
        "compositions": COMPOSITIONS,
        "transition_counts": narr_matrix.tolist(),
        "total_transitions": int(narr_matrix.sum()),
        "total_document_sequences": len(all_sequences),
        "filter_stats": dict(total_stats),
        "description": "Row i -> Col j = count of composition i followed by composition j in NARRATIVE sequences only",
    }
    with open(OUTPUT_DIR / "narrative_transition_matrix.json", "w") as f:
        json.dump(narr_matrix_out, f, indent=2)
    print(f"    Saved: narrative_transition_matrix.json")

    # Narrative analysis
    analysis_out = {
        "max_asymmetry_ratio": narr_max_ratio,
        "overall_asymmetry_score": round(narr_asym_score, 6),
        "top_5_asymmetric_pairs": narr_ratios[:5],
        "all_asymmetric_pairs": narr_ratios,
        "enneagram_analysis": enn_results,
        "enneagram_type_to_composition_mapping": {str(k): v for k, v in ENNEAGRAM_TYPE_TO_COMP.items()},
    }
    with open(OUTPUT_DIR / "narrative_transition_analysis.json", "w") as f:
        json.dump(analysis_out, f, indent=2)
    print(f"    Saved: narrative_transition_analysis.json")

    # Comparison
    comparison_out = {
        "equilibrium": {
            "total_transitions": int(eq_matrix.sum()),
            "max_asymmetry_ratio": eq_max_ratio,
            "overall_asymmetry_score": round(eq_asym_score, 6),
        },
        "narrative": {
            "total_transitions": int(narr_matrix.sum()),
            "max_asymmetry_ratio": narr_max_ratio,
            "overall_asymmetry_score": round(narr_asym_score, 6),
        },
        "comparison": {
            "max_ratio_increase": round(narr_max_ratio / max(eq_max_ratio, 0.001), 3),
            "asymmetry_score_increase": round(narr_asym_score / max(eq_asym_score, 0.001), 3),
            "hypothesis_supported": bool(narr_max_ratio > eq_max_ratio),
        },
        "per_pair_comparison": comparison_pairs,
        "direction_changes": [cp for cp in comparison_pairs if cp["direction_changed"]],
    }
    with open(OUTPUT_DIR / "narrative_vs_equilibrium_comparison.json", "w") as f:
        json.dump(comparison_out, f, indent=2)
    print(f"    Saved: narrative_vs_equilibrium_comparison.json")

    # Final verdict
    print("\n" + "=" * 70)
    print("VERDICT")
    print("=" * 70)
    if narr_max_ratio > eq_max_ratio:
        print(f"  HYPOTHESIS SUPPORTED: Narrative sequences show HIGHER asymmetry")
        print(f"  Max asymmetry: {eq_max_ratio:.3f}x (equilibrium) → {narr_max_ratio:.3f}x (narrative)")
        print(f"  Overall asymmetry score: {eq_asym_score:.4f} → {narr_asym_score:.4f} "
              f"({narr_asym_score / max(eq_asym_score, 0.001):.2f}x increase)")
    else:
        print(f"  HYPOTHESIS NOT SUPPORTED: Narrative sequences do NOT show higher asymmetry")
        print(f"  Max asymmetry: {eq_max_ratio:.3f}x (equilibrium) → {narr_max_ratio:.3f}x (narrative)")

    int_match_count = int(enn_results["summary"]["integration_lines_matching"].split("/")[0])
    dis_match_count = int(enn_results["summary"]["disintegration_lines_matching"].split("/")[0])

    if int_match_count >= 5 or dis_match_count >= 5:
        print(f"\n  ENNEAGRAM SIGNAL: Directional flows show {max(int_match_count, dis_match_count)}/9 "
              f"line matches — suggestive of Enneagram-like directed structure")
    else:
        print(f"\n  ENNEAGRAM SIGNAL: Weak — only {max(int_match_count, dis_match_count)}/9 "
              f"line matches — insufficient for Enneagram pattern claim")

    print()


if __name__ == "__main__":
    main()
