/**
 * Cosine distance and nearest-centroid utilities for the D/I/R classifier.
 *
 * Cosine distance = 1 - cos(theta)
 *   0 = identical direction
 *   1 = orthogonal
 *   2 = opposite direction
 *
 * D/I/R axis weighting: dimensions 0-2 (D, I, R) are scaled by DIR_AXIS_WEIGHT
 * before distance computation. This ensures the primary composition axes dominate
 * classification over auxiliary dimensions (temporal, density, entropy) which
 * naturally produce larger magnitudes in the vectorizer.
 */

/**
 * Weight multiplier for D, I, R axes (dims 0-2) relative to auxiliary axes.
 * Applied symmetrically to both input vectors and centroids during distance
 * computation. Value chosen empirically: 3x is sufficient to make D/I/R
 * dominate classification while still allowing auxiliaries to break ties.
 */
export const DIR_AXIS_WEIGHT = 5.0;

/**
 * Apply D/I/R axis weighting to a vector. Returns a new weighted copy.
 * Dimensions 0-2 (D, I, R) are multiplied by DIR_AXIS_WEIGHT.
 * Dimensions 3-5 (temporal, density, entropy) are unchanged.
 */
export function applyAxisWeights(v: number[]): number[] {
  const w = new Array(v.length);
  for (let i = 0; i < v.length; i++) {
    w[i] = i < 3 ? v[i] * DIR_AXIS_WEIGHT : v[i];
  }
  return w;
}

export function cosineDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 1; // zero vector treated as orthogonal

  const similarity = dot / denom;
  // Clamp to [-1, 1] to handle floating point rounding
  const clamped = Math.max(-1, Math.min(1, similarity));
  return 1 - clamped;
}

/**
 * Unweighted cosine distance — used by tests that verify raw geometric
 * properties (identical vectors = 0, orthogonal = 1, opposite = 2).
 */
export function rawCosineDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 1;

  const similarity = dot / denom;
  const clamped = Math.max(-1, Math.min(1, similarity));
  return 1 - clamped;
}

export function nearestCentroid(
  vector: number[],
  centroids: number[][],
): { index: number; distance: number } {
  if (centroids.length === 0) {
    throw new Error("No centroids provided");
  }

  let bestIndex = 0;
  let bestDistance = cosineDistance(vector, centroids[0]);

  for (let i = 1; i < centroids.length; i++) {
    const d = cosineDistance(vector, centroids[i]);
    if (d < bestDistance) {
      bestDistance = d;
      bestIndex = i;
    }
  }

  return { index: bestIndex, distance: bestDistance };
}
