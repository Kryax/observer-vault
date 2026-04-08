#!/usr/bin/env python3
"""
Compute K=9 centroids from vectorized shard data using K-Means.

Usage: python3 scripts/compute-centroids.py [--input <path>] [--output <path>] [--k 9] [--n-init 50]
"""

import argparse
import json
import sys
import time
import numpy as np

def main():
    parser = argparse.ArgumentParser(description="K-Means centroid computation for D/I/R vectors")
    parser.add_argument("--input", default="data/vectors_297k.jsonl", help="Input vectors JSONL")
    parser.add_argument("--output", default="data/centroids-v2.json", help="Output centroids JSON")
    parser.add_argument("--k", type=int, default=9, help="Number of clusters")
    parser.add_argument("--n-init", type=int, default=50, help="Number of K-Means initializations")
    parser.add_argument("--max-iter", type=int, default=300, help="Max iterations per init")
    args = parser.parse_args()

    print(f"[centroids] Loading vectors from {args.input}")
    t0 = time.time()

    vectors = []
    with open(args.input) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            vec = json.loads(line)
            vectors.append(vec)

    X = np.array(vectors, dtype=np.float64)
    print(f"[centroids] Loaded {X.shape[0]:,} vectors × {X.shape[1]} dimensions ({time.time()-t0:.1f}s)")

    # Filter out zero vectors
    norms = np.linalg.norm(X, axis=1)
    nonzero_mask = norms > 1e-10
    X_nonzero = X[nonzero_mask]
    print(f"[centroids] Non-zero vectors: {X_nonzero.shape[0]:,} ({X_nonzero.shape[0]/X.shape[0]*100:.1f}%)")
    print(f"[centroids] Zero vectors dropped: {X.shape[0] - X_nonzero.shape[0]:,}")

    # Dimension statistics
    dim_names = ["D", "I", "R", "temporal", "density", "entropy"]
    print(f"\n[centroids] Dimension statistics (non-zero vectors):")
    for i, name in enumerate(dim_names):
        vals = X_nonzero[:, i]
        print(f"  {name:10s}: mean={vals.mean():.4f}  std={vals.std():.4f}  min={vals.min():.4f}  max={vals.max():.4f}")

    # K-Means
    print(f"\n[centroids] Running K-Means: K={args.k}, n_init={args.n_init}, max_iter={args.max_iter}")
    from sklearn.cluster import KMeans
    from sklearn.metrics import silhouette_score

    t1 = time.time()
    km = KMeans(
        n_clusters=args.k,
        n_init=args.n_init,
        max_iter=args.max_iter,
        random_state=42,
        verbose=0,
    )
    labels = km.fit_predict(X_nonzero)
    centroids = km.cluster_centers_
    inertia = km.inertia_
    print(f"[centroids] K-Means complete ({time.time()-t1:.1f}s), inertia={inertia:.4f}")

    # Silhouette score (sample for speed)
    sample_size = min(50000, X_nonzero.shape[0])
    rng = np.random.RandomState(42)
    sample_idx = rng.choice(X_nonzero.shape[0], sample_size, replace=False)
    sil = silhouette_score(X_nonzero[sample_idx], labels[sample_idx])
    print(f"[centroids] Silhouette score (n={sample_size:,}): {sil:.4f}")

    # Cluster sizes
    print(f"\n[centroids] Cluster distribution:")
    for i in range(args.k):
        count = np.sum(labels == i)
        pct = count / len(labels) * 100
        c = centroids[i]
        # Determine composition from D/I/R profile
        dir_vals = [(c[0], "D"), (c[1], "I"), (c[2], "R")]
        dir_vals.sort(key=lambda x: -x[0])
        outer = dir_vals[0][1]
        inner = dir_vals[1][1]
        composition = f"{outer}({inner})"

        print(f"  Cluster {i}: {count:>7,} ({pct:5.1f}%)  "
              f"D={c[0]:.4f} I={c[1]:.4f} R={c[2]:.4f} | "
              f"T={c[3]:.4f} Den={c[4]:.4f} Ent={c[5]:.4f}  → {composition}")

    # Build composition mapping
    mapping = {}
    compositions_used = set()
    centroid_list = []

    for i in range(args.k):
        c = centroids[i]
        dir_vals = [(c[0], "D"), (c[1], "I"), (c[2], "R")]
        dir_vals.sort(key=lambda x: -x[0])
        outer = dir_vals[0][1]
        inner = dir_vals[1][1]
        composition = f"{outer}({inner})"

        # Handle duplicates: if composition already taken, use third-choice inner
        if composition in compositions_used:
            # Try outer(third)
            third = dir_vals[2][1]
            alt = f"{outer}({third})"
            if alt not in compositions_used:
                composition = alt
            else:
                # Fallback: assign by auxiliary features
                if c[3] > 0.3:  # temporal dominant
                    composition = f"{outer}(T)"  # will be caught and handled
                else:
                    composition = f"{outer}({inner})*"

        compositions_used.add(composition)
        mapping[str(i)] = composition
        centroid_list.append(c.tolist())

    # Check coverage
    all_9 = {"D(D)", "D(I)", "D(R)", "I(D)", "I(I)", "I(R)", "R(D)", "R(I)", "R(R)"}
    found = set(mapping.values())
    missing = all_9 - found
    extra = found - all_9
    print(f"\n[centroids] Composition mapping:")
    for i in range(args.k):
        print(f"  {i} → {mapping[str(i)]}")
    if missing:
        print(f"\n  WARNING: Missing compositions: {missing}")
    if extra:
        print(f"\n  WARNING: Non-standard compositions: {extra}")

    # Save
    manifest = {
        "version": "20260408-v2-weighted",
        "k": args.k,
        "dim": 6,
        "centroids": centroid_list,
        "mapping": mapping,
        "meta": {
            "source": "paired-structured-all.jsonl (297,900 records)",
            "vectorizer": "DIR_AXIS_WEIGHT=5.0, log-compressed density",
            "silhouette": round(sil, 4),
            "n_init": args.n_init,
            "nonzero_vectors": int(X_nonzero.shape[0]),
        },
    }

    with open(args.output, "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"\n[centroids] Saved to {args.output}")
    print(f"[centroids] Total time: {time.time()-t0:.1f}s")


if __name__ == "__main__":
    main()
