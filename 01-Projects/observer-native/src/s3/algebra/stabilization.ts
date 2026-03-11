import type {
  CandidateRecord,
  ComparisonReport,
  ComparisonTargetSummary,
  MotifRecord,
} from "./types.ts";

export interface PredicateCResult {
  kind: "c";
  distinctDomainCount: number;
  distinctDomains: string[];
  threshold: number;
  eligible: boolean;
  notes: string[];
}

export interface PredicateIPairScore {
  instanceIds: [string, string];
  operatorOverlap: number;
  invariantSimilarity: number;
  combinedScore: number;
}

export interface PredicateIResult {
  kind: "i";
  score: number;
  threshold: number;
  stable: boolean;
  pairScores: PredicateIPairScore[];
  notes: string[];
}

export interface PredicateDResult {
  kind: "d";
  strongestMatchScore: number;
  similarityThreshold: number;
  reviewThreshold: number;
  derivationConflict: boolean;
  reviewRequired: boolean;
  comparisonReport: ComparisonReport;
}

export interface StabilizationEvaluation {
  c: PredicateCResult;
  i: PredicateIResult;
  d: PredicateDResult;
}

export interface StabilizationOptions {
  minDistinctDomains?: number;
  invarianceThreshold?: number;
  derivationConflictThreshold?: number;
  humanReviewThreshold?: number;
}

const DEFAULTS = {
  minDistinctDomains: 2,
  invarianceThreshold: 0.55,
  derivationConflictThreshold: 0.7,
  humanReviewThreshold: 0.45,
} satisfies Required<StabilizationOptions>;

export function evaluatePredicateC(
  candidate: CandidateRecord,
  options: StabilizationOptions = {},
): PredicateCResult {
  const threshold = options.minDistinctDomains ?? DEFAULTS.minDistinctDomains;
  const distinctDomains = uniqueStrings(candidate.instances.map((instance) => instance.domain));
  const eligible = distinctDomains.length >= threshold;

  return {
    kind: "c",
    distinctDomainCount: distinctDomains.length,
    distinctDomains,
    threshold,
    eligible,
    notes: eligible
      ? [
          `Candidate spans ${distinctDomains.length} distinct domains and clears the Tier 0 -> 1 threshold of ${threshold}.`,
        ]
      : [
          `Candidate spans ${distinctDomains.length} distinct domains and remains below the Tier 0 -> 1 threshold of ${threshold}.`,
        ],
  };
}

export function evaluatePredicateI(
  candidate: CandidateRecord,
  options: StabilizationOptions = {},
): PredicateIResult {
  const threshold = options.invarianceThreshold ?? DEFAULTS.invarianceThreshold;
  const pairScores = buildPairScores(candidate);

  if (pairScores.length === 0) {
    return {
      kind: "i",
      score: 0,
      threshold,
      stable: false,
      pairScores: [],
      notes: ["At least two instances are required to evaluate structural invariance."],
    };
  }

  const score = average(pairScores.map((pairScore) => pairScore.combinedScore));

  return {
    kind: "i",
    score,
    threshold,
    stable: score >= threshold,
    pairScores,
    notes:
      score >= threshold
        ? [
            `Cross-instance invariance score ${formatScore(score)} clears the stabilization threshold of ${formatScore(threshold)}.`,
          ]
        : [
            `Cross-instance invariance score ${formatScore(score)} remains below the stabilization threshold of ${formatScore(threshold)}.`,
          ],
  };
}

export function evaluatePredicateD(
  candidate: CandidateRecord,
  motifLibrary: MotifRecord[],
  options: StabilizationOptions = {},
): PredicateDResult {
  const similarityThreshold =
    options.derivationConflictThreshold ?? DEFAULTS.derivationConflictThreshold;
  const reviewThreshold = options.humanReviewThreshold ?? DEFAULTS.humanReviewThreshold;
  const comparedAgainst = motifLibrary.map((motif) => summarizeComparison(candidate, motif));
  const strongestMatch = comparedAgainst.reduce<ComparisonTargetSummary | null>(
    (best, current) => {
      if (best === null || current.similarityScore > best.similarityScore) {
        return current;
      }

      return best;
    },
    null,
  );
  const derivationConflict =
    strongestMatch !== null && strongestMatch.similarityScore >= similarityThreshold;
  const reviewRequired =
    derivationConflict ||
    (strongestMatch !== null && strongestMatch.similarityScore >= reviewThreshold) ||
    candidate.relationships.some((relationship) => relationship.kind === "possible_derivation");

  const comparisonReport: ComparisonReport = {
    comparedAgainst,
    strongestMatch,
    derivationConflict,
    reviewRequired,
    notes: buildComparisonNotes(
      strongestMatch,
      similarityThreshold,
      reviewThreshold,
      candidate.relationships.some((relationship) => relationship.kind === "possible_derivation"),
    ),
  };

  return {
    kind: "d",
    strongestMatchScore: strongestMatch?.similarityScore ?? 0,
    similarityThreshold,
    reviewThreshold,
    derivationConflict,
    reviewRequired,
    comparisonReport,
  };
}

export function evaluateStabilization(
  candidate: CandidateRecord,
  motifLibrary: MotifRecord[],
  options: StabilizationOptions = {},
): StabilizationEvaluation {
  return {
    c: evaluatePredicateC(candidate, options),
    i: evaluatePredicateI(candidate, options),
    d: evaluatePredicateD(candidate, motifLibrary, options),
  };
}

function buildPairScores(candidate: CandidateRecord): PredicateIPairScore[] {
  const pairScores: PredicateIPairScore[] = [];

  for (let leftIndex = 0; leftIndex < candidate.instances.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < candidate.instances.length; rightIndex += 1) {
      const left = candidate.instances[leftIndex];
      const right = candidate.instances[rightIndex];
      const operatorOverlap = jaccard(left.operatorTags, right.operatorTags);
      const invariantSimilarity = textSimilarity(left.invariants, right.invariants);
      const combinedScore = average([operatorOverlap, invariantSimilarity]);

      pairScores.push({
        instanceIds: [left.id, right.id],
        operatorOverlap,
        invariantSimilarity,
        combinedScore,
      });
    }
  }

  return pairScores;
}

function summarizeComparison(
  candidate: CandidateRecord,
  motif: MotifRecord,
): ComparisonTargetSummary {
  const candidateOperators = uniqueStrings(
    candidate.instances.flatMap((instance) => instance.operatorTags),
  );
  const motifOperators = uniqueStrings(motif.instances.flatMap((instance) => instance.operatorTags));
  const overlappingOperators = intersect(candidateOperators, motifOperators);
  const operatorScore = jaccard(candidateOperators, motifOperators);
  const overlappingInvariants = intersect(
    normalizePhrases(candidate.invariants),
    normalizePhrases(motif.invariants),
  );
  const invariantScore = textSimilarity(candidate.invariants, motif.invariants);
  const similarityScore = average([operatorScore, invariantScore]);

  return {
    motifId: motif.id,
    motifName: motif.name,
    similarityScore,
    overlappingOperators,
    overlappingInvariants,
    notes: [
      `Operator overlap ${formatScore(operatorScore)} via ${overlappingOperators.length} shared tags.`,
      `Invariant similarity ${formatScore(invariantScore)} across motif-level claims.`,
    ],
  };
}

function buildComparisonNotes(
  strongestMatch: ComparisonTargetSummary | null,
  similarityThreshold: number,
  reviewThreshold: number,
  hasPossibleDerivationRelation: boolean,
): string[] {
  if (strongestMatch === null) {
    return ["No comparison motifs were provided; derivation conflict cannot be established."];
  }

  const notes = [
    `Strongest match is ${strongestMatch.motifName} at similarity ${formatScore(strongestMatch.similarityScore)}.`,
  ];

  if (strongestMatch.similarityScore >= similarityThreshold) {
    notes.push(
      `Similarity clears the derivation-conflict threshold of ${formatScore(similarityThreshold)}.`,
    );
  } else if (strongestMatch.similarityScore >= reviewThreshold) {
    notes.push(
      `Similarity clears the human-review threshold of ${formatScore(reviewThreshold)} without forcing a derivation conflict.`,
    );
  } else {
    notes.push(`Similarity remains below the review threshold of ${formatScore(reviewThreshold)}.`);
  }

  if (hasPossibleDerivationRelation) {
    notes.push("Candidate already carries a possible_derivation relationship and should remain reviewable.");
  }

  return notes;
}

function textSimilarity(left: string[], right: string[]): number {
  return jaccard(tokenize(left.join(" ")), tokenize(right.join(" ")));
}

function tokenize(value: string): string[] {
  const tokens = value.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return uniqueStrings(tokens);
}

function normalizePhrases(values: string[]): string[] {
  return uniqueStrings(
    values.map((value) => value.trim().toLowerCase()).filter((value) => value.length > 0),
  );
}

function intersect<T extends string>(left: T[], right: T[]): T[] {
  const rightSet = new Set(right);
  return uniqueStrings(left.filter((value) => rightSet.has(value)));
}

function jaccard(left: string[], right: string[]): number {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const union = new Set([...leftSet, ...rightSet]);

  if (union.size === 0) {
    return 0;
  }

  let intersectionCount = 0;

  for (const value of leftSet) {
    if (rightSet.has(value)) {
      intersectionCount += 1;
    }
  }

  return intersectionCount / union.size;
}

function uniqueStrings<T extends string>(values: T[]): T[] {
  return [...new Set(values)].sort();
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatScore(value: number): string {
  return value.toFixed(2);
}
