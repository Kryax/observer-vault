#!/usr/bin/env python3
"""Phase 1 D(R): Extract dominant motif signatures for all 9 composition basins.

Reads:
  - data/composition_labels_297k.jsonl (basin assignment per record)
  - data/motif_rescored_297k.jsonl (motif assignment per record)
  - data/vectors_297k_v3.jsonl (6D vectors per record)
  - dataset-processor/output/paired-structured-all.jsonl (operators + lexical)
  - data/motifs.json (motif definitions)

Outputs:
  - data/basin_signatures_phase1.json
"""

import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
import re

DATA = Path(__file__).resolve().parent.parent / "data"
PAIRED = Path(__file__).resolve().parent.parent.parent / "dataset-processor" / "output" / "paired-structured-all.jsonl"

BASINS_OF_INTEREST = {"D(D)", "D(I)", "D(R)", "I(D)", "I(I)", "I(R)", "R(D)", "R(I)", "R(R)"}

# Short code to full motif ID mapping (built from motifs.json names)
SHORT_CODE_MAP = {
    "ESMB": "explicit-state-machine-backbone",
    "SCGS": "structural-coupling-ground-state",
    "RB": "reconstruction-burden",
    "TAC": "trust-as-curation",
    "PF": "progressive-formalization",
    "DSG": "dual-speed-governance",
    "OFL": "observer-feedback-loop",
    "BBWOP": "bounded-buffer-with-overflow-policy",
    "CDRI": "cross-domain-recursive-integration",
    "RWAF": "ratchet-with-asymmetric-friction",
    "TDC": "template-driven-classification",
    "CPA": "composable-plugin-architecture",
    "IBP": "instrument-before-product",
    "PUE": "propagated-uncertainty-envelope",
    "RST": "reflexive-structural-transition",
    "SLD": "safety-liveness-duality",
    "SFA": "scaffold-first-architecture",
    "RRT": "redundancy-as-resilience-tax",
    "BD": "boundary-drift",
    "NSSH": "nested-self-similar-hierarchy",
    "PEPS": "prediction-error-as-primary-signal",
    "ISC": "idempotent-state-convergence",
    "PC": "punctuated-crystallisation",
    "RG": "recursive-generativity",
    "PSR": "primitive-self-reference",
    "TAM": "two-antagonistic-modes",
    "HSSFS": "hidden-structure-surface-form-separation",
    "ECS": "estimation-control-separation",
    "RR": "redundancy-as-resilience-tax",
    "DTR": "drift-toward-regularity",
    "MS": "metacognitive-steering",
    "CU": "consilient-unification",
    "RAF": "ratchet-with-asymmetric-friction",
}


def load_motifs():
    with open(DATA / "motifs.json") as f:
        data = json.load(f)
    by_id = {}
    for m in data["motifs"]:
        by_id[m["id"]] = m
    return by_id


def extract_lexical_terms(shape_text):
    """Extract meaningful terms from process shape text."""
    if not shape_text or not isinstance(shape_text, str):
        return []
    # Lowercase, split on non-alpha, filter short/stop words
    tokens = re.findall(r'[a-z]{3,}', shape_text.lower())
    stop = {
        'the', 'and', 'that', 'this', 'with', 'from', 'for', 'are', 'was',
        'were', 'been', 'being', 'have', 'has', 'had', 'having', 'does',
        'did', 'doing', 'will', 'would', 'could', 'should', 'may', 'might',
        'shall', 'can', 'need', 'must', 'not', 'but', 'which', 'who',
        'whom', 'what', 'when', 'where', 'how', 'why', 'all', 'each',
        'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such',
        'than', 'too', 'very', 'also', 'just', 'about', 'above', 'after',
        'again', 'any', 'because', 'before', 'between', 'into', 'its',
        'only', 'own', 'same', 'then', 'there', 'these', 'they', 'those',
        'through', 'under', 'until', 'while', 'during', 'over', 'per',
        'process', 'upon', 'used', 'use', 'using', 'one', 'two', 'three',
        'new', 'first', 'well', 'way', 'many', 'like', 'long', 'make',
        'made', 'still', 'since', 'back', 'much', 'take', 'come', 'good',
        'give', 'get', 'got', 'say', 'said', 'see', 'seen', 'set', 'know',
        'known', 'part', 'time', 'year', 'years', 'case', 'work', 'right',
        'even', 'however', 'therefore', 'thus', 'hence', 'yet', 'rather',
        'whether', 'either', 'neither', 'nor', 'without', 'within',
        'among', 'along', 'across', 'around', 'against', 'near', 'toward',
        'another', 'different', 'given', 'based', 'general', 'often',
        'particular', 'include', 'including', 'following', 'result',
        'results', 'several', 'possible', 'found', 'form', 'forms',
        'called', 'number', 'example', 'order', 'point', 'large', 'small',
        'high', 'low', 'level', 'levels', 'show', 'shown', 'shows',
        'various', 'certain', 'specific', 'single', 'related', 'present',
        'similar', 'important', 'provide', 'provides', 'significant',
    }
    return [t for t in tokens if t not in stop]


def main():
    print("Loading motif definitions...", file=sys.stderr)
    motifs_by_id = load_motifs()

    # Pass 1: Read composition labels and motif assignments
    print("Reading composition labels...", file=sys.stderr)
    compositions = {}  # record_idx -> composition
    with open(DATA / "composition_labels_297k.jsonl") as f:
        for line in f:
            rec = json.loads(line)
            comp = rec["composition"]
            if comp in BASINS_OF_INTEREST:
                compositions[rec["record_idx"]] = comp

    print(f"  {len(compositions)} records in 9 basins", file=sys.stderr)

    print("Reading motif rescores...", file=sys.stderr)
    motif_assignments = {}  # record_idx -> motif_id (short code)
    with open(DATA / "motif_rescored_297k.jsonl") as f:
        for line in f:
            rec = json.loads(line)
            idx = rec["record_idx"]
            if idx in compositions:
                top = rec["new_top3_motifs"][0]
                motif_assignments[idx] = top["motif_id"]

    # Per-basin: count motifs, accumulate vectors
    basin_motif_counts = defaultdict(Counter)
    basin_vectors = defaultdict(list)
    basin_indices = defaultdict(list)

    for idx, comp in compositions.items():
        if idx in motif_assignments:
            basin_motif_counts[comp][motif_assignments[idx]] += 1
            basin_indices[comp].append(idx)

    # Find dominant motif per basin
    dominant = {}
    for basin in sorted(BASINS_OF_INTEREST):
        counts = basin_motif_counts[basin]
        top_motif = counts.most_common(1)[0]
        dominant[basin] = {
            "motif_short": top_motif[0],
            "count": top_motif[1],
            "total": sum(counts.values()),
            "top5_motifs": counts.most_common(5),
        }
        print(f"  {basin}: dominant={top_motif[0]} ({top_motif[1]}/{sum(counts.values())})", file=sys.stderr)

    # Build index set for fast lookup
    relevant_indices = set(compositions.keys())

    # Pass 2: Read vectors
    print("Reading vectors...", file=sys.stderr)
    basin_vector_sums = defaultdict(lambda: [0.0]*6)
    basin_vector_counts = defaultdict(int)
    with open(DATA / "vectors_297k_v3.jsonl") as f:
        for idx, line in enumerate(f):
            if idx in relevant_indices:
                vec = json.loads(line)
                comp = compositions[idx]
                for d in range(6):
                    basin_vector_sums[comp][d] += vec[d]
                basin_vector_counts[comp] += 1

    # Compute centroids
    centroids = {}
    for basin in sorted(BASINS_OF_INTEREST):
        n = basin_vector_counts[basin]
        if n > 0:
            centroids[basin] = [round(basin_vector_sums[basin][d] / n, 6) for d in range(6)]
        else:
            centroids[basin] = [0.0]*6
        print(f"  {basin}: centroid={centroids[basin]} (n={n})", file=sys.stderr)

    # Pass 3: Read paired-structured for operators and lexical
    print("Reading paired-structured for operators + lexical...", file=sys.stderr)
    basin_operators = defaultdict(Counter)
    basin_lexical = defaultdict(Counter)
    with open(PAIRED) as f:
        for idx, line in enumerate(f):
            if idx in relevant_indices:
                rec = json.loads(line)
                comp = compositions[idx]
                vr = rec.get("verb_record", {})
                proc = vr.get("process", {})
                # Operators
                ops = proc.get("operators", [])
                if isinstance(ops, list):
                    for op in ops:
                        basin_operators[comp][op] += 1
                # Lexical from shape
                shape = proc.get("shape", "")
                terms = extract_lexical_terms(shape)
                for t in terms:
                    basin_lexical[comp][t] += 1

    # Build output
    print("\nAssembling signatures...", file=sys.stderr)
    output = {
        "version": "phase1-dr-v1",
        "basins": {}
    }

    dim_names = ["D", "I", "R", "T", "Den", "Ent"]

    for basin in sorted(BASINS_OF_INTEREST):
        d = dominant[basin]
        short_code = d["motif_short"]
        full_id = SHORT_CODE_MAP.get(short_code, short_code)
        motif_def = motifs_by_id.get(full_id, {})

        top_ops = [op for op, _ in basin_operators[basin].most_common(20)]
        top_lex = [term for term, _ in basin_lexical[basin].most_common(20)]

        output["basins"][basin] = {
            "dominant_motif": short_code,
            "dominant_motif_full_id": full_id,
            "record_count": d["total"],
            "dominant_count": d["count"],
            "dominant_pct": round(100 * d["count"] / d["total"], 1),
            "vector_centroid": centroids[basin],
            "vector_centroid_labeled": {dim_names[i]: centroids[basin][i] for i in range(6)},
            "top_operators": top_ops[:20],
            "top_lexical": top_lex[:20],
            "operator_counts": dict(basin_operators[basin].most_common(20)),
            "lexical_counts": dict(basin_lexical[basin].most_common(20)),
            "motif_definition": {
                "id": motif_def.get("id", full_id),
                "name": motif_def.get("name", short_code),
                "composition": motif_def.get("composition", ""),
                "tier": motif_def.get("tier", -1),
                "domains": motif_def.get("domains", []),
                "indicators": motif_def.get("indicators", []),
                "primary_axis": motif_def.get("primary_axis", ""),
            },
            "top5_motif_distribution": [
                {"motif": m, "count": c} for m, c in d["top5_motifs"]
            ],
        }

    # Print summary table
    print("\n" + "="*120)
    print(f"{'Basin':<8} | {'Dominant Motif':<8} | {'Records':>7} | {'Dom%':>5} | {'Vector Centroid [D,I,R,T,Den,Ent]':<42} | {'Top-5 Operators':<40} | Top-5 Lexical")
    print("-"*120)
    for basin in sorted(BASINS_OF_INTEREST):
        b = output["basins"][basin]
        vec_str = "[" + ", ".join(f"{v:.3f}" for v in b["vector_centroid"]) + "]"
        ops_str = ", ".join(b["top_operators"][:5])
        lex_str = ", ".join(b["top_lexical"][:5])
        print(f"{basin:<8} | {b['dominant_motif']:<8} | {b['record_count']:>7} | {b['dominant_pct']:>4.1f}% | {vec_str:<42} | {ops_str:<40} | {lex_str}")
    print("="*120)

    # Print full lexical signatures
    for basin in sorted(BASINS_OF_INTEREST):
        b = output["basins"][basin]
        print(f"\n--- {basin} ({b['dominant_motif']}: {b['motif_definition']['name']}) ---")
        print(f"  Operators (top 20): {b['operator_counts']}")
        print(f"  Lexical  (top 20): {b['lexical_counts']}")

    # Save
    out_path = DATA / "basin_signatures_phase1.json"
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\nSaved to {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
