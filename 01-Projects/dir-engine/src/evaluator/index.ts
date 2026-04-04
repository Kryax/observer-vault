import type {
  EvaluationResult,
  MotifLibrary,
  PredicateResult,
  Vector6D,
} from "../types/index.js";
import { predicateC, predicateI, predicateD } from "./predicates.js";
import { checkVolume, checkNonDegeneracy } from "./stability.js";

export interface EvaluateInput {
  text?: string;
  composition?: string;
  motif_id?: string;
  thresholds?: {
    c?: number;
    i?: number;
    d?: number;
  };
}

const DEFAULT_THRESHOLDS = { c: 3, i: 0.6, d: 0.8 };

/**
 * Extract indicators from text by simple tokenization.
 * This is a lightweight extraction for evaluation purposes --
 * the candidate's indicator terms are matched against library motifs.
 */
function extractIndicators(text: string, library: MotifLibrary): string[] {
  const lower = text.toLowerCase();
  const allIndicators = new Set<string>();
  for (const motif of library.motifs) {
    for (const ind of motif.indicators) {
      if (lower.includes(ind.toLowerCase())) {
        allIndicators.add(ind);
      }
    }
  }
  return [...allIndicators];
}

/**
 * Evaluate a candidate against the motif library.
 *
 * Accepts text, composition, or motif_id (at least one required).
 * Returns predicates (c/i/d), volume, stability, and degeneracy checks.
 */
export function evaluate(
  input: EvaluateInput,
  library: MotifLibrary,
  vectorizeFn?: (text: string) => Vector6D,
): EvaluationResult {
  const hasText = input.text !== undefined && input.text !== "";
  const hasComposition =
    input.composition !== undefined && input.composition !== "";
  const hasMotifId = input.motif_id !== undefined && input.motif_id !== "";

  if (!hasText && !hasComposition && !hasMotifId) {
    throw new Error(
      "At least one of text, composition, or motif_id is required",
    );
  }

  const thresholds = {
    ...DEFAULT_THRESHOLDS,
    ...input.thresholds,
  };

  // Composition-only path: stability check without predicates
  if (hasComposition && !hasText && !hasMotifId) {
    const nonDegenerate = checkNonDegeneracy(input.composition!);
    // Look up motif by composition for volume info
    const matchingMotif = library.motifs.find(
      (m) => m.composition === input.composition,
    );

    // Default predicate result for composition-only evaluation
    const neutralPredicate: PredicateResult = {
      pass: true,
      score: 0,
      threshold: 0,
      detail: "Not evaluated (composition-only input)",
    };

    return {
      predicates: {
        c: neutralPredicate,
        i: neutralPredicate,
        d: neutralPredicate,
      },
      volume: 0,
      stable: nonDegenerate && (matchingMotif !== undefined),
      non_degenerate: nonDegenerate,
    };
  }

  // Motif-ID path: look up motif and evaluate its indicators
  let candidateIndicators: string[];
  let vector: Vector6D = [0, 0, 0, 0, 0, 0];

  if (hasMotifId) {
    const motif = library.motifs.find((m) => m.id === input.motif_id);
    if (!motif) {
      throw new Error(`Motif not found: ${input.motif_id}`);
    }
    candidateIndicators = motif.indicators;
  } else {
    // Text path
    candidateIndicators = extractIndicators(input.text!, library);
    if (vectorizeFn) {
      vector = vectorizeFn(input.text!);
    }
  }

  const { volume, nonzero } = checkVolume(vector);
  const composition = hasComposition
    ? input.composition!
    : hasMotifId
      ? library.motifs.find((m) => m.id === input.motif_id)?.composition ?? ""
      : "";
  const nonDegenerate = composition
    ? checkNonDegeneracy(composition)
    : true;

  const c = predicateC(candidateIndicators, library, thresholds.c);
  const i = predicateI(candidateIndicators, library, thresholds.i);
  const d = predicateD(candidateIndicators, library, thresholds.d);

  return {
    predicates: { c, i, d },
    volume,
    stable: nonzero,
    non_degenerate: nonDegenerate,
  };
}
