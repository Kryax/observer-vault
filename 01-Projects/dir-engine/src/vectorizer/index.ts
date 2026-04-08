import type { Vector6D, IndicatorVocabulary } from "../types/index.js";
import { TEMPORAL_MARKERS } from "./temporal.js";
import { DIR_AXIS_WEIGHT } from "../classifier/distance.js";

const MAX_TEXT_LENGTH = 8000;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Vectorize text into a 6D D/I/R vector.
 *
 * Dimensions: [D, I, R, temporal, density, entropy]
 *
 * 1. Truncate to 8000 chars
 * 2. Score each indicator: score[axis] += log(1 + count) * weight
 * 3. Temporal: log(1 + total temporal marker matches)
 * 4. Density: total_indicator_weight / (text.length / 1000)
 * 5. Entropy: Shannon entropy over D/I/R proportions
 * 6. L2-normalize the full 6D vector
 */
export function vectorize(text: string, vocab: IndicatorVocabulary): Vector6D {
  if (text.length === 0) return [0, 0, 0, 0, 0, 0];

  const t = text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text;
  const lower = t.toLowerCase();

  const scores = [0, 0, 0]; // D, I, R
  let totalIndicatorWeight = 0;

  // Sort indicators by term length descending to avoid partial matches
  const sorted = [...vocab.indicators].sort(
    (a, b) => b.term.length - a.term.length,
  );

  for (const ind of sorted) {
    const pattern = ind.term.includes(" ")
      ? new RegExp(escapeRegex(ind.term), "gi")
      : new RegExp(`\\b${escapeRegex(ind.term)}\\b`, "gi");
    const matches = lower.match(pattern);
    if (matches) {
      const count = matches.length;
      scores[ind.axis] += Math.log(1 + count) * ind.weight;
      totalIndicatorWeight += count * ind.weight;
    }
  }

  // Temporal
  const markers = vocab.temporal_markers ?? TEMPORAL_MARKERS;
  let temporalCount = 0;
  for (const group of Object.values(markers)) {
    for (const m of group) {
      const pat = new RegExp(`\\b${escapeRegex(m)}\\b`, "gi");
      const hits = lower.match(pat);
      if (hits) temporalCount += hits.length;
    }
  }
  const temporal = Math.log(1 + temporalCount);

  // Density
  const density = t.length > 0 ? totalIndicatorWeight / (t.length / 1000) : 0;

  // Entropy (Shannon over D/I/R proportions)
  const total = scores[0] + scores[1] + scores[2];
  let entropy = 0;
  if (total > 0) {
    for (const s of scores) {
      const p = s / total;
      if (p > 0) entropy -= p * Math.log2(p);
    }
  }

  // Apply D/I/R axis boost and log-compress density so that primary axes
  // dominate classification. Without this, raw density (~7.7) overwhelms
  // D/I/R scores (~1.2) after L2 normalization, causing the classifier to
  // sort by indicator density rather than D/I/R composition.
  const raw: Vector6D = [
    scores[0] * DIR_AXIS_WEIGHT,
    scores[1] * DIR_AXIS_WEIGHT,
    scores[2] * DIR_AXIS_WEIGHT,
    temporal,
    Math.log(1 + density),
    entropy,
  ];

  // L2 normalize
  const mag = Math.sqrt(raw.reduce((sum, x) => sum + x * x, 0));
  if (mag === 0) return [0, 0, 0, 0, 0, 0];
  return raw.map((x) => x / mag) as Vector6D;
}
