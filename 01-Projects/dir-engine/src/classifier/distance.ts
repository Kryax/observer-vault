/**
 * Cosine distance and nearest-centroid utilities for the D/I/R classifier.
 *
 * Cosine distance = 1 - cos(theta)
 *   0 = identical direction
 *   1 = orthogonal
 *   2 = opposite direction
 */

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
