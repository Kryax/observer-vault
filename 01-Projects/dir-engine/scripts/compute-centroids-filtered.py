#!/usr/bin/env python3
"""
Compute K=9 centroids from records WITH D/I/R signal only.
Filters out records where D=I=R=0 (temporal-only).
"""

import json
import time
import numpy as np
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

INPUT = "data/vectors_297k.jsonl"
OUTPUT = "data/centroids-v2.json"
K = 9

print(f"[centroids] Loading vectors from {INPUT}")
t0 = time.time()

vectors = []
with open(INPUT) as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        vectors.append(json.loads(line))

X = np.array(vectors, dtype=np.float64)
print(f"[centroids] Total: {X.shape[0]:,} vectors")

# Filter: keep only vectors with D/I/R signal (dims 0-2 not all zero)
dir_signal = np.abs(X[:, :3]).sum(axis=1) > 1e-10
X_dir = X[dir_signal]
print(f"[centroids] With D/I/R signal: {X_dir.shape[0]:,} ({X_dir.shape[0]/X.shape[0]*100:.1f}%)")
print(f"[centroids] Temporal-only (dropped): {X.shape[0] - X_dir.shape[0]:,}")

# Also filter out full zero vectors
norms = np.linalg.norm(X_dir, axis=1)
X_dir = X_dir[norms > 1e-10]
print(f"[centroids] After zero-vector filter: {X_dir.shape[0]:,}")

# Stats
dim_names = ["D", "I", "R", "temporal", "density", "entropy"]
print(f"\n[centroids] Dimension statistics (D/I/R-bearing records):")
for i, name in enumerate(dim_names):
    vals = X_dir[:, i]
    print(f"  {name:10s}: mean={vals.mean():.4f}  std={vals.std():.4f}  "
          f"min={vals.min():.4f}  max={vals.max():.4f}  "
          f"nonzero={np.sum(vals > 1e-10):,}")

# K-Means
print(f"\n[centroids] Running K-Means: K={K}, n_init=50")
t1 = time.time()
km = KMeans(n_clusters=K, n_init=50, max_iter=300, random_state=42)
labels = km.fit_predict(X_dir)
centroids = km.cluster_centers_
print(f"[centroids] K-Means complete ({time.time()-t1:.1f}s), inertia={km.inertia_:.2f}")

# Silhouette
sample_n = min(50000, X_dir.shape[0])
rng = np.random.RandomState(42)
idx = rng.choice(X_dir.shape[0], sample_n, replace=False)
sil = silhouette_score(X_dir[idx], labels[idx])
print(f"[centroids] Silhouette score (n={sample_n:,}): {sil:.4f}")

# Print centroid table
print(f"\n[centroids] Centroid table:")
print(f"{'Cluster':>8} {'Count':>8} {'Pct':>6}  {'D':>7} {'I':>7} {'R':>7} | {'T':>7} {'Den':>7} {'Ent':>7}  {'→ Composition'}")
print("-" * 95)

mapping = {}
compositions_used = {}

for i in range(K):
    c = centroids[i]
    count = int(np.sum(labels == i))
    pct = count / len(labels) * 100

    # Determine composition: outer = argmax(D,I,R), inner = second-highest
    dir_vals = [(c[0], "D", 0), (c[1], "I", 1), (c[2], "R", 2)]
    dir_vals.sort(key=lambda x: -x[0])
    outer = dir_vals[0][1]
    inner = dir_vals[1][1]
    composition = f"{outer}({inner})"

    # Handle collisions
    if composition in compositions_used:
        # Try outer(third)
        third = dir_vals[2][1]
        alt = f"{outer}({third})"
        if alt not in compositions_used:
            composition = alt
        else:
            # Use outer(outer) = self-application
            self_comp = f"{outer}({outer})"
            if self_comp not in compositions_used:
                composition = self_comp

    compositions_used[composition] = i
    mapping[str(i)] = composition

    print(f"{i:>8} {count:>8,} {pct:>5.1f}%  "
          f"{c[0]:>7.4f} {c[1]:>7.4f} {c[2]:>7.4f} | "
          f"{c[3]:>7.4f} {c[4]:>7.4f} {c[5]:>7.4f}  → {composition}")

# Coverage check
all_9 = {"D(D)", "D(I)", "D(R)", "I(D)", "I(I)", "I(R)", "R(D)", "R(I)", "R(R)"}
found = set(mapping.values())
missing = all_9 - found
extra = found - all_9
print(f"\nCoverage: {len(found & all_9)}/9 compositions")
if missing:
    print(f"  Missing: {missing}")
if extra:
    print(f"  Non-standard: {extra}")

# Save
manifest = {
    "version": "20260408-v2-weighted-dironly",
    "k": K,
    "dim": 6,
    "centroids": centroids.tolist(),
    "mapping": mapping,
    "meta": {
        "source": "paired-structured-all.jsonl — D/I/R-bearing records only",
        "total_records": int(X.shape[0]),
        "dir_bearing": int(X_dir.shape[0]),
        "temporal_only_dropped": int(X.shape[0] - X_dir.shape[0]),
        "vectorizer": "DIR_AXIS_WEIGHT=5.0, log-compressed density",
        "silhouette": round(sil, 4),
        "n_init": 50,
    },
}

with open(OUTPUT, "w") as f:
    json.dump(manifest, f, indent=2)
print(f"\n[centroids] Saved to {OUTPUT}")
print(f"[centroids] Total time: {time.time()-t0:.1f}s")
