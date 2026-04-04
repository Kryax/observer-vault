/**
 * S2 Classifier — assigns a 6D vector to a D/I/R composition cluster.
 *
 * Takes either raw text (via vectorizeFn) or a pre-computed 6D vector,
 * normalizes, computes cosine distance to each centroid, and returns
 * the nearest cluster's composition with confidence and axis.
 */

import type {
  Vector6D,
  ClassificationResult,
  CentroidManifest,
  IndicatorVocabulary,
} from "../types/index.ts";
import { cosineDistance } from "./distance.ts";
import { detectSubstrate } from "./substrate.ts";

export interface ClassifyInput {
  text?: string;
  vector?: number[];
  space?: "ideal" | "applied" | "auto";
}

/**
 * L2-normalize a vector in place and return it as Vector6D.
 */
function l2Normalize(v: number[]): Vector6D {
  let norm = 0;
  for (let i = 0; i < v.length; i++) {
    norm += v[i] * v[i];
  }
  norm = Math.sqrt(norm);

  if (norm === 0) {
    return v.slice() as Vector6D;
  }

  const result: number[] = new Array(v.length);
  for (let i = 0; i < v.length; i++) {
    result[i] = v[i] / norm;
  }
  return result as unknown as Vector6D;
}

/**
 * Determine the primary axis from the first 3 components (D, I, R).
 */
function resolveAxis(
  vector: Vector6D,
): "differentiate" | "integrate" | "recurse" {
  const labels = ["differentiate", "integrate", "recurse"] as const;
  let maxIdx = 0;
  for (let i = 1; i < 3; i++) {
    if (vector[i] > vector[maxIdx]) {
      maxIdx = i;
    }
  }
  return labels[maxIdx];
}

/**
 * Determine the space classification.
 */
function resolveSpace(
  input: ClassifyInput,
  text: string | undefined,
): "ideal" | "applied" | "unknown" {
  // Explicit non-auto space always wins
  if (input.space && input.space !== "auto") {
    return input.space;
  }

  // Auto-detect from text
  if (text != null) {
    const substrate = detectSubstrate(text);
    return substrate.detected ? "applied" : "ideal";
  }

  // Vector-only with no explicit space -> ideal default
  return "ideal";
}

export function classify(
  input: ClassifyInput,
  centroids: CentroidManifest,
  vocab: IndicatorVocabulary,
  vectorizeFn: (text: string, vocab: IndicatorVocabulary) => Vector6D,
): ClassificationResult {
  // --- Validate input: exactly one of text/vector ---
  const hasText = input.text != null && input.text !== "";
  const hasVector = input.vector != null;

  if (hasText && hasVector) {
    throw new Error(
      "Exactly one of text or vector must be provided, got both",
    );
  }
  if (!hasText && !hasVector) {
    throw new Error(
      "Exactly one of text or vector must be provided, got neither",
    );
  }

  // --- Get raw vector ---
  let raw: number[];

  if (hasText) {
    const v6d = vectorizeFn(input.text!, vocab);
    raw = Array.from(v6d);
  } else {
    if (input.vector!.length !== 6) {
      throw new Error(`Vector must have 6 dimensions, got ${input.vector!.length}`);
    }
    raw = Array.from(input.vector!);
  }

  // --- L2 normalize ---
  const normalized = l2Normalize(raw);

  // --- Compute distances to all centroids ---
  const distances: { index: number; distance: number }[] = [];
  for (let i = 0; i < centroids.centroids.length; i++) {
    distances.push({
      index: i,
      distance: cosineDistance(Array.from(normalized), centroids.centroids[i]),
    });
  }

  // Sort by distance ascending
  distances.sort((a, b) => a.distance - b.distance);

  const nearest = distances[0];
  const secondNearest = distances.length > 1 ? distances[1] : nearest;

  // --- Confidence: 1 - (nearest / second_nearest), clipped [0, 1] ---
  let confidence: number;
  if (secondNearest.distance === 0) {
    // Edge case: if second nearest is also 0 distance, confidence is 0
    confidence = nearest.distance === 0 ? 1 : 0;
  } else {
    confidence = 1 - nearest.distance / secondNearest.distance;
  }
  confidence = Math.max(0, Math.min(1, confidence));

  // --- Composition from mapping ---
  const clusterId = nearest.index;
  const composition =
    centroids.mapping[String(clusterId)] ?? "unknown";

  // --- Space ---
  const space = resolveSpace(input, hasText ? input.text : undefined);

  // --- Axis ---
  const axis = resolveAxis(normalized);

  return {
    vector: normalized,
    composition,
    confidence,
    space,
    axis,
    cluster_id: clusterId,
  };
}
