#!/usr/bin/env python3
"""
Backfill compositionExpression on verb_records using K=9 D/I/R clustering.

1. Vectorize shard-00 records with the same D/I/R keyword method as dir-vectorize-cluster.py
2. Run K=9 K-means to get centroids
3. For each shard (00-09), assign every record to its nearest centroid's composition

Cluster → Composition mapping (from cluster-composition-mapping-20260403-DRAFT.md):
  0 → I(D),  1 → D(D),  2 → R(R),  3 → I(I),  4 → R(I),
  5 → R(D),  6 → D(I),  7 → D(R),  8 → I(R)

Usage:
    python3 scripts/backfill-compositions.py [--shards 0-9] [--dry-run]
"""

import argparse
import re
import sqlite3
import sys
import time
from collections import Counter

import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import normalize

# ── Cluster → Composition mapping ─────────────────────────────────────────────

CLUSTER_TO_COMPOSITION = {
    0: "I(D)",
    1: "D(D)",
    2: "R(R)",
    3: "I(I)",
    4: "R(I)",
    5: "R(D)",
    6: "D(I)",
    7: "D(R)",
    8: "I(R)",
}

# ── Indicator vocabulary (same as dir-vectorize-cluster.py) ───────────────────

INDICATORS = [
    # DSG — integrate
    ("dual-speed", 1.0, 1), ("two-speed", 1.0, 1), ("operational cycle", 0.9, 1),
    ("constitutional", 0.8, 1), ("governance", 0.6, 1), ("oversight", 0.5, 1),
    ("regulate", 0.5, 1), ("constraint", 0.4, 1), ("fast and slow", 0.9, 1),
    ("slow cycle", 0.8, 1), ("fast cycle", 0.8, 1),
    # CPA — differentiate
    ("composable", 0.9, 0), ("plugin", 0.9, 0), ("extension point", 0.9, 0),
    ("middleware", 0.8, 0), ("extensible", 0.7, 0), ("modular", 0.6, 0),
    ("registry", 0.6, 0), ("hook", 0.5, 0), ("add-on", 0.8, 0),
    ("loadable", 0.7, 0), ("adapter", 0.5, 0),
    # ESMB — differentiate
    ("state machine", 1.0, 0), ("finite state", 1.0, 0), ("state transition", 0.9, 0),
    ("state diagram", 0.9, 0), ("automaton", 0.8, 0), ("guard condition", 0.8, 0),
    ("workflow state", 0.7, 0), ("fsm", 0.9, 0),
    # BBWOP — differentiate
    ("backpressure", 1.0, 0), ("overflow", 0.8, 0), ("bounded buffer", 1.0, 0),
    ("ring buffer", 0.9, 0), ("circular buffer", 0.9, 0), ("evict", 0.7, 0),
    ("rate limit", 0.7, 0), ("throttle", 0.6, 0), ("congestion", 0.6, 0),
    # ISC — integrate
    ("idempotent", 1.0, 1), ("convergence", 0.7, 1), ("desired state", 0.9, 1),
    ("declarative", 0.6, 1), ("reconcile", 0.8, 1), ("self-healing", 0.9, 1),
    ("eventual consistency", 0.9, 1), ("drift detection", 0.9, 1),
    ("converge", 0.6, 1), ("target state", 0.7, 1),
    # OFL — recurse
    ("feedback loop", 0.8, 2), ("self-modifying", 0.9, 2), ("co-evolution", 0.8, 2),
    ("reflexive", 0.7, 2), ("frame of reference", 0.7, 2), ("hermeneutic", 0.9, 2),
    ("recursive observation", 1.0, 2), ("meta-observation", 1.0, 2),
    ("self-referential", 0.7, 2),
    # RAF — recurse
    ("ratchet", 1.0, 2), ("irreversible", 0.7, 2), ("path dependence", 0.9, 2),
    ("lock-in", 0.8, 2), ("sunk cost", 0.7, 2), ("ossify", 0.8, 2),
    ("hard to reverse", 0.8, 2), ("backward compatibility", 0.7, 2),
    # PF — integrate
    ("formalize", 0.8, 1), ("crystallize", 0.8, 1), ("solidify", 0.6, 1),
    ("provisional", 0.6, 1), ("canonical", 0.6, 1), ("amorphous", 0.7, 1),
    ("increasing structure", 0.9, 1), ("structural order", 0.8, 1),
    # RB — differentiate
    ("reconstruction", 0.9, 0), ("lossy", 0.8, 0), ("information loss", 0.9, 0),
    ("downstream cost", 0.8, 0), ("abstraction leak", 0.9, 0),
    ("quantization", 0.7, 0),
    # TAC — integrate
    ("reputation", 0.7, 1), ("credibility", 0.7, 1), ("curate", 0.7, 1),
    ("quality signal", 0.8, 1), ("endorsement", 0.6, 1), ("peer review", 0.7, 1),
    # RST — recurse
    ("apoptosis", 1.0, 2), ("dissolution", 0.7, 2), ("metamorphosis", 0.8, 2),
    ("phase transition", 0.8, 2), ("structural transformation", 0.8, 2),
    ("controlled demolition", 0.9, 2), ("self-destruct", 0.8, 2), ("molt", 0.8, 2),
    # BD — differentiate
    ("boundary drift", 1.0, 0), ("semantic shift", 0.8, 0), ("scope creep", 0.8, 0),
    ("mission creep", 0.8, 0),
    # SCGS — integrate
    ("structural coupling", 1.0, 1), ("mutual constraint", 0.9, 1),
    ("co-adaptation", 0.9, 1), ("symbiosis", 0.7, 1),
    # SLD — differentiate
    ("safety property", 1.0, 0), ("liveness property", 1.0, 0), ("liveness", 0.8, 0),
    ("deadlock", 0.7, 0), ("starvation", 0.7, 0), ("constraint satisfaction", 0.7, 0),
    # RG — recurse
    ("recursive generativity", 1.0, 2), ("novel structure", 0.8, 2),
    ("self-organizing", 0.7, 2), ("meta-level", 0.6, 2), ("higher-order", 0.5, 2),
    ("autogenesis", 1.0, 2), ("autopoiesis", 0.9, 2),
    # PSR — recurse
    ("self-reference", 0.9, 2), ("quine", 1.0, 2), ("fixed point", 0.8, 2),
    ("self-describing", 0.9, 2), ("metacircular", 1.0, 2), ("introspection", 0.6, 2),
    ("self-representation", 0.8, 2),
    # TDC — differentiate
    ("taxonomy", 0.8, 0), ("ontology", 0.8, 0), ("type system", 0.7, 0),
    ("categorize", 0.6, 0),
    # SFA — differentiate
    ("scaffold", 0.7, 0), ("skeleton", 0.6, 0), ("boilerplate", 0.7, 0),
    ("minimum viable", 0.7, 0), ("infrastructure first", 0.9, 0),
    ("structure before content", 0.9, 0),
    # CU — integrate
    ("consilience", 1.0, 1), ("convergent evidence", 0.9, 1), ("unification", 0.6, 1),
    ("disparate domains", 0.8, 1), ("independent lines of evidence", 0.9, 1),
    ("structural isomorphism", 0.9, 1), ("cross-disciplinary", 0.7, 1),
    # PBR — differentiate
    ("paradigm shift", 0.9, 0), ("boundary revision", 1.0, 0),
    ("meta-framework", 0.9, 0), ("distinction apparatus", 1.0, 0),
    ("reconceptualize", 0.7, 0), ("ontological shift", 0.8, 0),
    ("category error", 0.7, 0), ("epistemic rupture", 0.9, 0),
    # TAM — integrate
    ("antagonistic", 0.8, 1), ("mutual suppression", 1.0, 1),
    ("parasympathetic", 0.7, 1), ("two modes", 0.7, 1),
    ("mutually exclusive", 0.7, 1), ("mode switching", 0.8, 1), ("bistable", 0.9, 1),
    # PEPS — recurse
    ("prediction error", 1.0, 2), ("forward model", 0.9, 2),
    ("predictive coding", 1.0, 2), ("free energy", 0.8, 2),
    ("bayesian brain", 0.9, 2), ("error signal", 0.7, 2),
    ("deviation from expectation", 0.9, 2),
    # MS — recurse
    ("metacognition", 0.9, 2), ("learning priority", 0.8, 2),
    ("gap awareness", 0.9, 2), ("self-directed learning", 0.8, 2),
    ("meta-learning", 0.9, 2), ("active learning", 0.7, 2),
    ("value of information", 0.9, 2), ("uncertainty reduction", 0.7, 2),
    ("information gain", 0.7, 2),
    # HSSFS — differentiate
    ("deep structure", 0.9, 0), ("surface structure", 0.9, 0),
    ("surface form", 0.8, 0), ("generative grammar", 0.9, 0),
    ("underlying representation", 0.8, 0), ("hidden variable", 0.8, 0),
    # ECS — differentiate
    ("kalman filter", 1.0, 0), ("state estimation", 0.9, 0),
    ("separation principle", 1.0, 0), ("state observer", 0.9, 0),
    ("noisy observation", 0.7, 0), ("plant model", 0.8, 0),
    # DTR — recurse
    ("iterated learning", 1.0, 2), ("compressibility", 0.8, 2),
    ("repeated transmission", 0.9, 2), ("cultural transmission", 0.8, 2),
    ("lossy copying", 0.9, 2), ("description length", 0.8, 2),
    ("generational drift", 0.9, 2),
    # PC — recurse
    ("incubation", 0.7, 2), ("crystallization", 0.8, 2),
    ("punctuated equilibrium", 0.9, 2), ("accumulation phase", 0.8, 2),
    ("silent period", 0.7, 2), ("sudden coherence", 0.9, 2),
    # RRT — integrate
    ("error correction", 0.8, 1), ("fault tolerance", 0.8, 1),
    ("coding theory", 0.8, 1), ("replication factor", 0.8, 1),
    ("shannon", 0.7, 1), ("channel capacity", 0.9, 1),
    # NSSH — recurse
    ("fractal", 0.9, 2), ("self-similar", 1.0, 2), ("scale invariant", 0.9, 2),
    ("recursive structure", 0.7, 2), ("power law", 0.6, 2),
    ("multi-scale", 0.7, 2), ("holarchy", 1.0, 2), ("holon", 0.9, 2),
    # PUE — integrate
    ("uncertainty propagation", 1.0, 1), ("belief distribution", 0.8, 1),
    ("confidence interval", 0.6, 1), ("error propagation", 0.8, 1),
    ("monte carlo", 0.6, 1), ("particle filter", 0.8, 1),
    ("credible interval", 0.8, 1),
    # KRHS — integrate
    ("kill ratio", 1.0, 1), ("discard rate", 0.9, 1), ("selectivity", 0.6, 1),
    ("triage", 0.6, 1), ("quality filter", 0.7, 1), ("rejection rate", 0.8, 1),
    ("culling", 0.8, 1),
    # IBP — differentiate
    ("observability", 0.7, 0), ("measure first", 0.9, 0), ("telemetry", 0.6, 0),
    ("diagnostic", 0.5, 0), ("instrument before", 1.0, 0),
]

INDICATORS.sort(key=lambda x: -len(x[0]))

COMPILED_INDICATORS = []
for term, weight, axis in INDICATORS:
    if ' ' in term or '-' in term:
        pattern = re.compile(re.escape(term), re.IGNORECASE)
    else:
        pattern = re.compile(r'\b' + re.escape(term) + r'\b', re.IGNORECASE)
    COMPILED_INDICATORS.append((pattern, weight, axis))

TEMPORAL_SEQUENTIAL = re.compile(r'\b(?:then|next|subsequently|afterward|following|finally)\b', re.IGNORECASE)
TEMPORAL_CONCURRENT = re.compile(r'\b(?:while|during|meanwhile|simultaneously|concurrently|parallel)\b', re.IGNORECASE)
TEMPORAL_CYCLIC = re.compile(r'\b(?:cycle|loop|iterate|periodic|recurring|repeat)\b', re.IGNORECASE)
TEMPORAL_RECURSIVE = re.compile(r'\b(?:recursive|meta|nested|self-referential|reflexive|introspect)\b', re.IGNORECASE)


def vectorize_text(text: str, max_chars: int = 8000) -> np.ndarray:
    """Compute 6D D/I/R vector from text (same as dir-vectorize-cluster.py)."""
    text = text[:max_chars]
    text_len = max(len(text), 1)

    scores = np.zeros(3, dtype=np.float64)
    for pattern, weight, axis in COMPILED_INDICATORS:
        matches = len(pattern.findall(text))
        if matches > 0:
            scores[axis] += np.log1p(matches) * weight

    t_seq = len(TEMPORAL_SEQUENTIAL.findall(text))
    t_con = len(TEMPORAL_CONCURRENT.findall(text))
    t_cyc = len(TEMPORAL_CYCLIC.findall(text))
    t_rec = len(TEMPORAL_RECURSIVE.findall(text))
    temporal = np.log1p(t_seq + t_con + t_cyc + t_rec)

    total_weight = scores.sum()
    density = total_weight / (text_len / 1000.0)

    if total_weight > 0:
        probs = scores / total_weight
        probs = probs[probs > 0]
        entropy = -np.sum(probs * np.log2(probs))
    else:
        entropy = 0.0

    return np.array([scores[0], scores[1], scores[2], temporal, density, entropy])


def fit_centroids(db_path: str) -> tuple[np.ndarray, KMeans]:
    """Fit K=9 K-means on a reference shard. Returns (centroids_norm, model)."""
    print(f"  Fitting centroids from {db_path}...")
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    rows = conn.execute(
        "SELECT id, source_raw_text FROM verb_records WHERE source_raw_text IS NOT NULL AND LENGTH(source_raw_text) >= 50"
    ).fetchall()
    conn.close()

    vectors = []
    for rec_id, raw_text in rows:
        vec = vectorize_text(raw_text)
        if vec[:3].sum() > 0:
            vectors.append(vec)

    X = np.array(vectors)
    X_norm = normalize(X)

    km = KMeans(n_clusters=9, n_init=10, random_state=42, max_iter=300)
    km.fit(X_norm)

    print(f"  Fitted on {len(vectors)} vectors (silhouette computed during original analysis)")
    return km.cluster_centers_, km


def backfill_shard(db_path: str, km: KMeans, dry_run: bool = False) -> Counter:
    """Label every verb_record in a shard with its nearest composition."""
    conn = sqlite3.connect(db_path)
    rows = conn.execute(
        "SELECT id, source_raw_text FROM verb_records WHERE source_raw_text IS NOT NULL AND LENGTH(source_raw_text) >= 50"
    ).fetchall()

    updates = []
    dist = Counter()

    for rec_id, raw_text in rows:
        vec = vectorize_text(raw_text)
        if vec[:3].sum() == 0:
            # No indicator matches — label as None
            updates.append((None, rec_id))
            dist["NONE"] += 1
            continue

        vec_norm = normalize(vec.reshape(1, -1))
        cluster = km.predict(vec_norm)[0]
        composition = CLUSTER_TO_COMPOSITION[cluster]
        updates.append((composition, rec_id))
        dist[composition] += 1

    if not dry_run:
        conn.execute("BEGIN")
        conn.executemany(
            "UPDATE verb_records SET compositionExpression = ? WHERE id = ?",
            updates,
        )
        conn.commit()

    conn.close()
    return dist


def main():
    parser = argparse.ArgumentParser(description="Backfill compositionExpression using K=9 clustering")
    parser.add_argument("--shards", default="0-9", help="Shard range, e.g., '0-9' or '0,1,5'")
    parser.add_argument("--output-dir", default="output", help="Directory containing shard DBs")
    parser.add_argument("--dry-run", action="store_true", help="Don't write to DB")
    args = parser.parse_args()

    # Parse shard range
    if "-" in args.shards:
        start, end = args.shards.split("-")
        shard_ids = list(range(int(start), int(end) + 1))
    else:
        shard_ids = [int(x) for x in args.shards.split(",")]

    shard_paths = [f"{args.output_dir}/shard-{i:02d}.db" for i in shard_ids]

    print(f"Backfill compositionExpression on {len(shard_paths)} shards")
    if args.dry_run:
        print("  (DRY RUN — no DB writes)")

    # Step 1: Fit centroids on shard-00
    t0 = time.time()
    ref_shard = f"{args.output_dir}/shard-00.db"
    centroids, km = fit_centroids(ref_shard)
    print(f"  Centroid fitting took {time.time()-t0:.1f}s\n")

    # Step 2: Label all shards
    total_dist = Counter()
    total_records = 0

    for shard_path in shard_paths:
        t0 = time.time()
        print(f"Processing {shard_path}...")
        dist = backfill_shard(shard_path, km, dry_run=args.dry_run)
        elapsed = time.time() - t0
        shard_total = sum(dist.values())
        total_records += shard_total
        total_dist += dist
        print(f"  {shard_total:,} records in {elapsed:.1f}s")
        for comp in sorted(dist, key=dist.get, reverse=True):
            print(f"    {comp:>5}: {dist[comp]:>5} ({dist[comp]/shard_total:.1%})")
        print()

    # Step 3: Summary
    print(f"{'='*60}")
    print(f"TOTAL: {total_records:,} records across {len(shard_paths)} shards")
    print(f"{'='*60}")
    print(f"\n{'Composition':>12} {'Count':>8} {'Pct':>7}")
    print(f"{'-'*12:>12} {'-'*8:>8} {'-'*7:>7}")
    for comp in sorted(total_dist, key=total_dist.get, reverse=True):
        pct = total_dist[comp] / total_records if total_records > 0 else 0
        print(f"{comp:>12} {total_dist[comp]:>8,} {pct:>7.1%}")

    # Composition family summary
    print(f"\n{'Family':>12} {'Count':>8} {'Pct':>7}")
    print(f"{'-'*12:>12} {'-'*8:>8} {'-'*7:>7}")
    families = Counter()
    for comp, cnt in total_dist.items():
        if comp == "NONE":
            families["NONE"] += cnt
        else:
            families[f"{comp[0]}-outer"] += cnt
    for fam in sorted(families, key=families.get, reverse=True):
        pct = families[fam] / total_records if total_records > 0 else 0
        print(f"{fam:>12} {families[fam]:>8,} {pct:>7.1%}")


if __name__ == "__main__":
    main()
