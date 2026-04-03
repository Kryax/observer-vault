#!/usr/bin/env python3
"""
D/I/R Keyword Vectorizer + K-means Clustering

Reads source_raw_text from shard SQLite DBs, computes continuous D/I/R scores
from weighted keyword matching (using the pipeline's own indicator vocabulary),
then runs K-means clustering to test for attractor basin structure.

Usage:
    python3 scripts/dir-vectorize-cluster.py [--shard output/shard-01.db] [--limit 10000]
"""

import argparse
import json
import re
import sqlite3
import sys
import time
from collections import defaultdict
from dataclasses import dataclass, field

import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import normalize
from sklearn.metrics import silhouette_score

# ── Indicator vocabulary (extracted from indicator-sets.ts) ──────────────────
# Each entry: (term, weight, axis, motif_id)
# Axis mapping: differentiate=0, integrate=1, recurse=2

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

# Pre-compile regex patterns for multi-word terms, plain lookup for single words
# Sort by length descending so longer phrases match first
INDICATORS.sort(key=lambda x: -len(x[0]))

# Build compiled patterns
COMPILED_INDICATORS = []
for term, weight, axis in INDICATORS:
    # Use word boundaries for single words, looser match for phrases
    if ' ' in term or '-' in term:
        pattern = re.compile(re.escape(term), re.IGNORECASE)
    else:
        pattern = re.compile(r'\b' + re.escape(term) + r'\b', re.IGNORECASE)
    COMPILED_INDICATORS.append((pattern, weight, axis))

# Also add temporal markers for a 4th dimension (structural complexity proxy)
TEMPORAL_SEQUENTIAL = re.compile(r'\b(?:then|next|subsequently|afterward|following|finally)\b', re.IGNORECASE)
TEMPORAL_CONCURRENT = re.compile(r'\b(?:while|during|meanwhile|simultaneously|concurrently|parallel)\b', re.IGNORECASE)
TEMPORAL_CYCLIC = re.compile(r'\b(?:cycle|loop|iterate|periodic|recurring|repeat)\b', re.IGNORECASE)
TEMPORAL_RECURSIVE = re.compile(r'\b(?:recursive|meta|nested|self-referential|reflexive|introspect)\b', re.IGNORECASE)


def vectorize_text(text: str, max_chars: int = 8000) -> np.ndarray:
    """
    Compute a continuous D/I/R vector from text using weighted keyword matching.

    Returns a 6-dimensional vector:
      [D_raw, I_raw, R_raw, temporal_complexity, text_density, axis_entropy]

    D_raw, I_raw, R_raw are the weighted sum of indicator matches per axis.
    temporal_complexity = mix of sequential/concurrent/cyclic/recursive markers.
    text_density = total indicator weight / text length (how indicator-rich).
    axis_entropy = Shannon entropy of the D/I/R distribution (how mixed).
    """
    # Truncate very long texts — most signal is in the first few KB
    text = text[:max_chars]
    text_len = max(len(text), 1)

    scores = np.zeros(3, dtype=np.float64)  # D, I, R

    for pattern, weight, axis in COMPILED_INDICATORS:
        matches = len(pattern.findall(text))
        if matches > 0:
            # Diminishing returns: log(1 + count) * weight
            scores[axis] += np.log1p(matches) * weight

    # Temporal complexity (4 sub-scores averaged)
    t_seq = len(TEMPORAL_SEQUENTIAL.findall(text))
    t_con = len(TEMPORAL_CONCURRENT.findall(text))
    t_cyc = len(TEMPORAL_CYCLIC.findall(text))
    t_rec = len(TEMPORAL_RECURSIVE.findall(text))
    temporal = np.log1p(t_seq + t_con + t_cyc + t_rec)

    # Text density: how indicator-rich is this text?
    total_weight = scores.sum()
    density = total_weight / (text_len / 1000.0)  # per 1K chars

    # Axis entropy: how mixed are the axes?
    if total_weight > 0:
        probs = scores / total_weight
        probs = probs[probs > 0]
        entropy = -np.sum(probs * np.log2(probs))
    else:
        entropy = 0.0

    return np.array([scores[0], scores[1], scores[2], temporal, density, entropy])


def load_records(db_path: str, limit: int = 0) -> list[tuple[str, str, str, float, str]]:
    """Load (id, process_axis, source_raw_text, tier_a_score, domain) from DB."""
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    query = "SELECT id, process_axis, source_raw_text, tier_a_score, domain FROM verb_records"
    if limit > 0:
        query += f" LIMIT {limit}"
    rows = conn.execute(query).fetchall()
    conn.close()
    return rows


def run_clustering(vectors: np.ndarray, k_values: list[int], labels_axis: list[str]):
    """Run K-means for each k, report results."""
    # Normalize vectors for clustering (L2)
    vectors_norm = normalize(vectors)

    results = []
    for k in k_values:
        km = KMeans(n_clusters=k, n_init=10, random_state=42, max_iter=300)
        cluster_labels = km.fit_predict(vectors_norm)

        sil = silhouette_score(vectors_norm, cluster_labels) if k > 1 else 0.0
        inertia = km.inertia_

        # Cross-tab: cluster vs axis label
        crosstab = defaultdict(lambda: defaultdict(int))
        for cl, ax in zip(cluster_labels, labels_axis):
            crosstab[cl][ax] += 1

        results.append({
            "k": k,
            "silhouette": round(sil, 4),
            "inertia": round(inertia, 2),
            "clusters": dict(crosstab),
            "centroids": km.cluster_centers_,
        })

    return results


def print_results(results: list[dict], dim_names: list[str], n_records: int):
    """Pretty-print clustering results."""
    print(f"\n{'='*80}")
    print(f"D/I/R KEYWORD VECTORIZER + K-MEANS CLUSTERING RESULTS")
    print(f"{'='*80}")
    print(f"Records: {n_records}")
    print(f"Dimensions: {', '.join(dim_names)}")
    print()

    # Summary table
    print(f"{'K':>3}  {'Silhouette':>11}  {'Inertia':>10}  Interpretation")
    print(f"{'-'*3}  {'-'*11}  {'-'*10}  {'-'*40}")
    for r in results:
        k = r["k"]
        sil = r["silhouette"]
        # Simple interpretation
        if sil > 0.5:
            interp = "STRONG structure"
        elif sil > 0.35:
            interp = "Moderate structure"
        elif sil > 0.25:
            interp = "Weak structure"
        else:
            interp = "No clear structure"
        print(f"{k:>3}  {sil:>11.4f}  {r['inertia']:>10.2f}  {interp}")

    # Best K
    best = max(results, key=lambda r: r["silhouette"])
    print(f"\nBest K = {best['k']} (silhouette = {best['silhouette']:.4f})")

    # Detailed cluster breakdown for each K
    for r in results:
        print(f"\n{'─'*60}")
        print(f"K = {r['k']}  (silhouette = {r['silhouette']:.4f})")
        print(f"{'─'*60}")

        centroids = r["centroids"]
        clusters = r["clusters"]

        for cl_id in sorted(clusters.keys()):
            axis_counts = clusters[cl_id]
            total = sum(axis_counts.values())
            dominant = max(axis_counts, key=axis_counts.get)
            purity = axis_counts[dominant] / total

            # Centroid values (first 3 dims = D, I, R)
            c = centroids[cl_id]
            dir_str = f"D={c[0]:.3f} I={c[1]:.3f} R={c[2]:.3f}"
            if len(c) > 3:
                dir_str += f" T={c[3]:.3f} ρ={c[4]:.3f} H={c[5]:.3f}"

            print(f"\n  Cluster {cl_id} ({total:,} records)")
            print(f"    Centroid: {dir_str}")
            print(f"    Dominant axis: {dominant} ({purity:.0%} purity)")
            print(f"    Breakdown: ", end="")
            parts = []
            for ax in ["differentiate", "integrate", "recurse"]:
                cnt = axis_counts.get(ax, 0)
                if cnt > 0:
                    parts.append(f"{ax[:5]}={cnt}")
            print(", ".join(parts))

    # Hypothesis test: does K=9 beat K=3?
    print(f"\n{'='*80}")
    print("HYPOTHESIS TEST: Wave equation predicts 9 attractor basins")
    print(f"{'='*80}")
    k3 = next(r for r in results if r["k"] == 3)
    k9 = next(r for r in results if r["k"] == 9)
    delta = k9["silhouette"] - k3["silhouette"]
    print(f"  K=3 silhouette: {k3['silhouette']:.4f}")
    print(f"  K=9 silhouette: {k9['silhouette']:.4f}")
    print(f"  Delta: {delta:+.4f}")
    if delta > 0.05:
        print(f"  → K=9 substantially better. Supports sub-axis structure.")
    elif delta > 0:
        print(f"  → K=9 marginally better. Weak evidence for sub-structure.")
    elif delta > -0.05:
        print(f"  → K=3 ≈ K=9. No evidence for sub-axis structure in keyword vectors.")
    else:
        print(f"  → K=3 clearly better. Data clusters along primary axes only.")

    # Check: is the best K something other than 3?
    if best["k"] != 3:
        print(f"\n  NOTE: Best K={best['k']} suggests structure beyond 3 primary axes.")
        # Check if any cluster in best K is a D/I or I/R hybrid
        for cl_id in sorted(best["clusters"].keys()):
            axis_counts = best["clusters"][cl_id]
            total = sum(axis_counts.values())
            dominant = max(axis_counts, key=axis_counts.get)
            purity = axis_counts[dominant] / total
            if purity < 0.6:
                axes = sorted(axis_counts, key=axis_counts.get, reverse=True)
                print(f"  → Cluster {cl_id} is a HYBRID: {axes[0][:5]}/{axes[1][:5]} "
                      f"({axis_counts[axes[0]]}/{axis_counts[axes[1]]})")


def main():
    parser = argparse.ArgumentParser(description="D/I/R vectorizer + K-means clustering")
    parser.add_argument("--shard", default="output/shard-01.db", help="Path to shard DB")
    parser.add_argument("--limit", type=int, default=0, help="Max records (0=all)")
    parser.add_argument("--k-values", default="3,5,7,9,12", help="Comma-separated K values")
    parser.add_argument("--output-json", default=None, help="Write results JSON to file")
    args = parser.parse_args()

    k_values = [int(x) for x in args.k_values.split(",")]

    print(f"Loading records from {args.shard}...")
    t0 = time.time()
    records = load_records(args.shard, args.limit)
    print(f"  Loaded {len(records):,} records in {time.time()-t0:.1f}s")

    if not records:
        print("No records found. Exiting.")
        sys.exit(1)

    print(f"Vectorizing {len(records):,} records...")
    t0 = time.time()
    vectors = []
    axes = []
    ids = []
    skipped = 0

    for rec_id, axis, raw_text, tier_a, domain in records:
        if not raw_text or len(raw_text) < 50:
            skipped += 1
            continue
        vec = vectorize_text(raw_text)
        # Skip zero vectors (no indicator matches at all)
        if vec[:3].sum() == 0:
            skipped += 1
            continue
        vectors.append(vec)
        axes.append(axis or "unknown")
        ids.append(rec_id)

    print(f"  Vectorized {len(vectors):,} records in {time.time()-t0:.1f}s (skipped {skipped})")

    if len(vectors) < max(k_values):
        print(f"Too few vectors ({len(vectors)}) for clustering. Need at least {max(k_values)}.")
        sys.exit(1)

    X = np.array(vectors)

    # Print vector statistics
    print(f"\nVector statistics (raw, pre-normalization):")
    dim_names = ["D(iff)", "I(nteg)", "R(ecur)", "Temporal", "Density", "Entropy"]
    for i, name in enumerate(dim_names):
        col = X[:, i]
        print(f"  {name:>10}: mean={col.mean():.3f}  std={col.std():.3f}  "
              f"min={col.min():.3f}  max={col.max():.3f}  "
              f"nonzero={np.count_nonzero(col):,}/{len(col):,}")

    # Axis distribution
    from collections import Counter
    ax_counts = Counter(axes)
    print(f"\nAxis label distribution:")
    for ax, cnt in ax_counts.most_common():
        print(f"  {ax}: {cnt:,} ({cnt/len(axes):.1%})")

    # Run clustering
    print(f"\nRunning K-means for K={k_values}...")
    t0 = time.time()
    results = run_clustering(X, k_values, axes)
    print(f"  Clustering complete in {time.time()-t0:.1f}s")

    print_results(results, dim_names, len(vectors))

    # Optional: also run on just the 3 D/I/R dimensions
    print(f"\n\n{'#'*80}")
    print(f"CONTROL: Clustering on D/I/R dimensions only (no temporal/density/entropy)")
    print(f"{'#'*80}")
    results_3d = run_clustering(X[:, :3], k_values, axes)
    print_results(results_3d, dim_names[:3], len(vectors))

    # Save JSON if requested
    if args.output_json:
        out = {
            "shard": args.shard,
            "n_records": len(vectors),
            "skipped": skipped,
            "dim_names": dim_names,
            "results_6d": [
                {"k": r["k"], "silhouette": r["silhouette"], "inertia": r["inertia"]}
                for r in results
            ],
            "results_3d": [
                {"k": r["k"], "silhouette": r["silhouette"], "inertia": r["inertia"]}
                for r in results_3d
            ],
        }
        with open(args.output_json, "w") as f:
            json.dump(out, f, indent=2)
        print(f"\nResults written to {args.output_json}")


if __name__ == "__main__":
    main()
