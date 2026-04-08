#!/usr/bin/env python3
"""Phase 3 D(R)↔D(I) Oscillation.

Iteratively tightens basin signatures by:
  D(R) pass: recompute centroids from foreign-matched records only
  D(I) pass: re-scan all records against tightened signatures

Convergence: total match count changes < 5%, or threshold reaches 0.95, or 10 cycles.

Reads:
  - data/basin_signatures_phase1.json (initial signatures)
  - data/vectors_297k_v3.jsonl (6D vectors)
  - data/composition_labels_297k.jsonl (basin assignments)
  - dataset-processor/output/paired-structured-all.jsonl (operators + domains)
  - data/motifs.json (tier/domain info for promotion candidates)

Outputs:
  - data/oscillation_phase3.json
"""

import json
import math
import sys
from collections import Counter, defaultdict
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
PAIRED = Path(__file__).resolve().parent.parent.parent / "dataset-processor" / "output" / "paired-structured-all.jsonl"

BASINS = ["D(D)", "D(I)", "D(R)", "I(D)", "I(I)", "I(R)", "R(D)", "R(I)", "R(R)"]
INITIAL_VEC_THRESHOLD = 0.85
THRESHOLD_STEP = 0.02
MAX_THRESHOLD = 0.95
OPERATOR_MIN = 2
MAX_CYCLES = 10
CONVERGENCE_PCT = 0.05

SHORT_TO_FULL = {
    "ESMB": "explicit-state-machine-backbone",
    "RB": "reconstruction-burden",
    "BBWOP": "bounded-buffer-with-overflow-policy",
    "DSG": "dual-speed-governance",
    "SCGS": "structural-coupling-ground-state",
    "CDRI": "cross-domain-recursive-integration",
    "RWAF": "ratchet-with-asymmetric-friction",
    "PF": "progressive-formalization",
    "OFL": "observer-feedback-loop",
}


def cosine_sim(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    ma = math.sqrt(sum(x * x for x in a))
    mb = math.sqrt(sum(x * x for x in b))
    if ma == 0 or mb == 0:
        return 0.0
    return dot / (ma * mb)


def normalize(v):
    mag = math.sqrt(sum(x * x for x in v))
    if mag == 0:
        return v[:]
    return [x / mag for x in v]


def midpoint_normalized(a, b):
    mid = [(x + y) / 2.0 for x, y in zip(a, b)]
    return normalize(mid)


def load_records():
    """Load all record data into memory for fast iteration."""
    # Compositions
    print("  Loading compositions...", file=sys.stderr)
    compositions = {}
    with open(DATA / "composition_labels_297k.jsonl") as f:
        for line in f:
            rec = json.loads(line)
            if rec["composition"] in set(BASINS):
                compositions[rec["record_idx"]] = rec["composition"]

    # Vectors
    print("  Loading vectors...", file=sys.stderr)
    vectors = {}
    with open(DATA / "vectors_297k_v3.jsonl") as f:
        for idx, line in enumerate(f):
            if idx in compositions:
                vectors[idx] = json.loads(line)

    # Operators and domains from paired-structured
    print("  Loading operators + domains...", file=sys.stderr)
    operators = {}
    domains = {}
    with open(PAIRED) as f:
        for idx, line in enumerate(f):
            if idx in compositions:
                try:
                    rec = json.loads(line)
                    vr = rec.get("verb_record", {})
                    proc = vr.get("process", {})
                    operators[idx] = set(proc.get("operators", []))
                    domains[idx] = vr.get("domain", "unknown")
                except (json.JSONDecodeError, KeyError):
                    operators[idx] = set()
                    domains[idx] = "unknown"

    return compositions, vectors, operators, domains


def scan_foreign_matches(compositions, vectors, operators, domains,
                         sig_centroids, sig_operators, vec_threshold, op_min):
    """Scan all records against all signatures, return foreign matches per signature."""
    # foreign_matches[sig_basin] = list of (idx, home_basin, domain, vec)
    foreign = {b: [] for b in BASINS}
    total = 0

    for idx, home in compositions.items():
        vec = vectors[idx]
        ops = operators.get(idx, set())

        for sig_basin in BASINS:
            if sig_basin == home:
                continue

            cos = cosine_sim(vec, sig_centroids[sig_basin])
            vec_match = cos >= vec_threshold

            op_overlap = len(ops & sig_operators[sig_basin])
            op_match = op_overlap >= op_min

            if vec_match or op_match:
                foreign[sig_basin].append({
                    "idx": idx,
                    "home": home,
                    "domain": domains.get(idx, "unknown"),
                    "vec": vec,
                })
                total += 1

    return foreign, total


def main():
    print("Phase 3: D(R)↔D(I) Oscillation", file=sys.stderr)
    print("=" * 80, file=sys.stderr)

    # Load Phase 1 signatures
    with open(DATA / "basin_signatures_phase1.json") as f:
        phase1 = json.load(f)

    # Load motif definitions for promotion candidate assessment
    with open(DATA / "motifs.json") as f:
        motif_defs = {m["id"]: m for m in json.load(f)["motifs"]}

    # Initial centroids and operators from Phase 1
    home_centroids = {}
    sig_centroids = {}
    sig_operators = {}
    basin_to_motif = {}
    for basin in BASINS:
        b = phase1["basins"][basin]
        home_centroids[basin] = b["vector_centroid"]
        sig_centroids[basin] = b["vector_centroid"][:]
        sig_operators[basin] = set(b["top_operators"][:10])
        basin_to_motif[basin] = b["dominant_motif"]

    # Load all records into memory
    print("\nLoading records into memory...", file=sys.stderr)
    compositions, vectors, operators, domains = load_records()
    print(f"  {len(compositions)} records loaded\n", file=sys.stderr)

    # Oscillation loop
    threshold = INITIAL_VEC_THRESHOLD
    prev_total = 234840  # Phase 2 initial count
    cycle_log = []
    converged_at = None

    print(f"{'Cycle':<7} | {'Threshold':<10} | {'Total matches':>13} | {'Delta':>10} | Converged?")
    print("-" * 70)
    # Log cycle 0 (Phase 2 baseline)
    print(f"{'0 (P2)':<7} | {0.85:<10.2f} | {234840:>13} | {'—':>10} | No")

    for cycle in range(1, MAX_CYCLES + 1):
        # --- D(R) pass: recompute centroids from foreign matches ---
        foreign, total = scan_foreign_matches(
            compositions, vectors, operators, domains,
            sig_centroids, sig_operators, threshold, OPERATOR_MIN
        )

        # Compute cross-domain centroids from foreign matches
        for basin in BASINS:
            matches = foreign[basin]
            if len(matches) == 0:
                # No foreign matches — keep current centroid
                continue

            # Mean vector of foreign-matched records
            cross_centroid = [0.0] * 6
            for m in matches:
                for d in range(6):
                    cross_centroid[d] += m["vec"][d]
            n = len(matches)
            cross_centroid = [x / n for x in cross_centroid]

            # Tightened signature = midpoint(home, cross-domain), normalized
            sig_centroids[basin] = midpoint_normalized(
                home_centroids[basin], cross_centroid
            )

        # --- D(I) pass: re-scan with tightened centroids and increased threshold ---
        threshold = min(INITIAL_VEC_THRESHOLD + cycle * THRESHOLD_STEP, MAX_THRESHOLD)

        foreign, total = scan_foreign_matches(
            compositions, vectors, operators, domains,
            sig_centroids, sig_operators, threshold, OPERATOR_MIN
        )

        delta_pct = abs(total - prev_total) / max(prev_total, 1)
        converged = delta_pct < CONVERGENCE_PCT or threshold >= MAX_THRESHOLD

        print(f"{cycle:<7} | {threshold:<10.2f} | {total:>13} | {delta_pct:>9.1%} | {'YES' if converged else 'No'}")

        cycle_log.append({
            "cycle": cycle,
            "threshold": threshold,
            "total_matches": total,
            "delta_pct": round(delta_pct, 4),
            "converged": converged,
        })

        if converged:
            converged_at = cycle
            break

        prev_total = total

    if converged_at is None:
        converged_at = MAX_CYCLES

    # Final scan data is in `foreign` and `total`
    final_total = total
    compression = round((1 - final_total / 234840) * 100, 1)

    print(f"\nConverged at cycle {converged_at}, threshold {threshold:.2f}")
    print(f"Matches: 234,840 → {final_total} ({compression}% reduction)")

    # Build per-signature output
    print("\n" + "=" * 130)
    print(f"{'Signature (Basin)':<20} | {'Initial':>7} | {'Final':>7} | {'Basins':>6} | {'Surviving Source Basins':<40} | Top 3 Domains")
    print("-" * 130)

    per_sig = {}
    for basin in BASINS:
        motif = basin_to_motif[basin]
        matches = foreign[basin]
        initial_count = phase1["basins"][basin].get("record_count", 0)

        by_basin = Counter(m["home"] for m in matches)
        by_domain = Counter(m["domain"] for m in matches)
        surviving_basins = sorted(by_basin.keys())

        label = f"{motif} ({basin})"
        top_d = ", ".join(d for d, _ in by_domain.most_common(3))
        surv_b = ", ".join(f"{b}:{c}" for b, c in by_basin.most_common())
        print(f"{label:<20} | {28330 if motif == 'ESMB' else '—':>7} | {len(matches):>7} | {len(by_basin):>6} | {surv_b:<40} | {top_d}")

        per_sig[motif] = {
            "home_basin": basin,
            "initial_foreign_matches": {
                "ESMB": 28330, "RB": 51172, "BBWOP": 20816,
                "DSG": 39698, "SCGS": 32624, "CDRI": 16592,
                "RWAF": 5151, "PF": 26602, "OFL": 13855,
            }.get(motif, 0),
            "final_foreign_matches": len(matches),
            "tightened_centroid": [round(x, 6) for x in sig_centroids[basin]],
            "surviving_source_basins": surviving_basins,
            "surviving_source_basin_counts": dict(by_basin.most_common()),
            "surviving_source_domains": dict(by_domain.most_common(10)),
        }

    print("=" * 130)

    # Mutual pairs surviving
    mutual_pairs = []
    for i, b1 in enumerate(BASINS):
        for b2 in BASINS[i + 1:]:
            m1 = basin_to_motif[b1]
            m2 = basin_to_motif[b2]
            b1_sources = set(per_sig[m1]["surviving_source_basins"])
            b2_sources = set(per_sig[m2]["surviving_source_basins"])
            if b2 in b1_sources and b1 in b2_sources:
                mutual_pairs.append([m1, m2])

    print(f"\nMutual overlap pairs surviving: {len(mutual_pairs)}")
    for pair in mutual_pairs:
        print(f"  {pair[0]} <-> {pair[1]}")

    # Promotion candidates
    # Check which motifs gained cross-domain evidence from the oscillation
    print("\n--- Promotion Candidates ---")
    t0_to_t1 = []
    t1_to_t2 = []

    for basin in BASINS:
        motif_short = basin_to_motif[basin]
        full_id = SHORT_TO_FULL.get(motif_short, motif_short)
        mdef = motif_defs.get(full_id, {})
        current_tier = mdef.get("tier", -1)
        existing_domains = set(mdef.get("domains", []))

        # Domains from surviving foreign matches
        match_domains = per_sig[motif_short]["surviving_source_domains"]
        surviving_basins = per_sig[motif_short]["surviving_source_basins"]
        final_matches = per_sig[motif_short]["final_foreign_matches"]

        # Count unique data-source domains from cross-basin matches
        unique_source_domains = len(match_domains)

        candidate = {
            "motif": motif_short,
            "full_id": full_id,
            "name": mdef.get("name", motif_short),
            "current_tier": current_tier,
            "existing_domain_count": len(existing_domains),
            "cross_basin_sources": len(surviving_basins),
            "final_foreign_matches": final_matches,
            "top_foreign_domains": list(match_domains.keys())[:5],
        }

        if current_tier == 0 and unique_source_domains >= 2:
            t0_to_t1.append(candidate)
            print(f"  T0→T1: {motif_short} ({full_id}) — {unique_source_domains} domains, {final_matches} matches")
        elif current_tier == 1 and unique_source_domains >= 3:
            t1_to_t2.append(candidate)
            print(f"  T1→T2: {motif_short} ({full_id}) — {unique_source_domains} domains, {final_matches} matches, {len(surviving_basins)} basins")

    if not t0_to_t1 and not t1_to_t2:
        print("  (No promotion candidates — all 9 dominant motifs are already T1+ with sufficient domains)")

    # Build output
    output = {
        "version": "phase3-oscillation-v1",
        "cycles_run": converged_at,
        "converged_at_cycle": converged_at,
        "final_threshold": threshold,
        "initial_matches": 234840,
        "final_matches": final_total,
        "compression_ratio": round(234840 / max(final_total, 1), 2),
        "compression_pct": compression,
        "cycle_log": cycle_log,
        "per_signature": per_sig,
        "mutual_pairs_surviving": mutual_pairs,
        "mutual_pair_count": len(mutual_pairs),
        "promotion_candidates": {
            "T0_to_T1": t0_to_t1,
            "T1_to_T2": t1_to_t2,
        },
    }

    out_path = DATA / "oscillation_phase3.json"
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\nSaved to {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
