import type { MotifLibrary, PredicateResult } from "../types/index.js";

/**
 * Jaccard similarity: |A intersect B| / |A union B|
 */
function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  if (union === 0) return 0;
  return intersection / union;
}

/**
 * Predicate c (cross-domain validation):
 * Count distinct domains in which the candidate's indicators appear across motifs.
 * A motif "matches" if it shares at least one indicator with the candidate.
 * Pass if distinct domain count >= threshold.
 */
export function predicateC(
  candidateIndicators: string[],
  library: MotifLibrary,
  threshold: number,
): PredicateResult {
  const candidateSet = new Set(candidateIndicators);
  const domains = new Set<string>();

  for (const motif of library.motifs) {
    const hasOverlap = motif.indicators.some((ind) => candidateSet.has(ind));
    if (hasOverlap) {
      for (const d of motif.domains) {
        domains.add(d);
      }
    }
  }

  const score = domains.size;
  return {
    pass: score >= threshold,
    score,
    threshold,
    detail: `Cross-domain: ${score} domains (threshold: ${threshold}). Domains: ${[...domains].join(", ") || "none"}`,
  };
}

/**
 * Predicate i (structural invariance):
 * Compute average Jaccard similarity of candidate indicators vs each motif's indicators.
 * Only considers motifs that share at least one indicator (matching motifs).
 * Pass if average Jaccard >= threshold.
 */
export function predicateI(
  candidateIndicators: string[],
  library: MotifLibrary,
  threshold: number,
): PredicateResult {
  const similarities: number[] = [];

  for (const motif of library.motifs) {
    const j = jaccard(candidateIndicators, motif.indicators);
    if (j > 0) {
      similarities.push(j);
    }
  }

  const avgJaccard =
    similarities.length > 0
      ? similarities.reduce((s, v) => s + v, 0) / similarities.length
      : 0;

  return {
    pass: avgJaccard >= threshold,
    score: avgJaccard,
    threshold,
    detail: `Structural invariance: avg Jaccard ${avgJaccard.toFixed(3)} across ${similarities.length} matching motifs (threshold: ${threshold})`,
  };
}

/**
 * Predicate d (non-derivability):
 * Check candidate against ALL existing motifs.
 * Pass if NO motif has Jaccard similarity > threshold.
 * i.e., the candidate is NOT a near-duplicate of any existing motif.
 */
export function predicateD(
  candidateIndicators: string[],
  library: MotifLibrary,
  threshold: number,
): PredicateResult {
  let maxJaccard = 0;
  let maxMotifId = "";

  for (const motif of library.motifs) {
    const j = jaccard(candidateIndicators, motif.indicators);
    if (j > maxJaccard) {
      maxJaccard = j;
      maxMotifId = motif.id;
    }
  }

  return {
    pass: maxJaccard <= threshold,
    score: maxJaccard,
    threshold,
    detail:
      maxJaccard > threshold
        ? `Near-duplicate: max Jaccard ${maxJaccard.toFixed(3)} with ${maxMotifId} (threshold: ${threshold})`
        : `Non-derivable: max Jaccard ${maxJaccard.toFixed(3)} (threshold: ${threshold})`,
  };
}

/**
 * Predicate p (substrate signature):
 * Check if candidate has substrate indicators absent in ideal parent.
 * Pass if the candidate has at least one indicator not present in the parent.
 */
export function predicateP(
  candidateIndicators: string[],
  idealParentIndicators: string[],
): PredicateResult {
  const parentSet = new Set(idealParentIndicators);
  const uniqueToCandidate = candidateIndicators.filter(
    (ind) => !parentSet.has(ind),
  );

  const score = uniqueToCandidate.length;
  return {
    pass: score > 0,
    score,
    threshold: 1,
    detail:
      score > 0
        ? `Substrate signature: ${score} indicator(s) absent in parent: ${uniqueToCandidate.join(", ")}`
        : "No substrate-unique indicators found",
  };
}
