import type { AlgebraDecision, CandidateRecord } from "./types.ts";

export const DEFAULT_PROCESS_PATHOLOGY_THRESHOLD = 2;

export type CollapseReviewReason =
  | "derivation_conflict"
  | "failed_falsification"
  | "process_pathology";

export interface CollapseDetectionInput {
  candidate: CandidateRecord;
  failedFalsificationSignals?: string[];
  processPathologyIndicators?: string[];
  routineAmbiguitySignals?: string[];
  processPathologyThreshold?: number;
}

export interface CollapseDetectionResult {
  decision: Extract<AlgebraDecision, "collapse_review"> | null;
  triggered: boolean;
  reasons: CollapseReviewReason[];
  notes: string[];
}

export function detectCollapseReview(
  input: CollapseDetectionInput,
): CollapseDetectionResult {
  const failedFalsificationSignals = normalizeSignals(
    input.failedFalsificationSignals,
  );
  const processPathologyIndicators = normalizeSignals(
    input.processPathologyIndicators,
  );
  const routineAmbiguitySignals = normalizeSignals(
    input.routineAmbiguitySignals,
  );
  const processPathologyThreshold = Math.max(
    1,
    input.processPathologyThreshold ?? DEFAULT_PROCESS_PATHOLOGY_THRESHOLD,
  );

  const reasons: CollapseReviewReason[] = [];
  const notes: string[] = [];

  if (input.candidate.comparisonReport.derivationConflict) {
    reasons.push("derivation_conflict");
    notes.push("Derivation conflict present in comparison report.");
  }

  if (failedFalsificationSignals.length > 0) {
    reasons.push("failed_falsification");
    notes.push(
      `Falsification failed across ${failedFalsificationSignals.length} signal(s).`,
    );
  }

  if (processPathologyIndicators.length >= processPathologyThreshold) {
    reasons.push("process_pathology");
    notes.push(
      `Process pathology threshold met (${processPathologyIndicators.length}/${processPathologyThreshold}).`,
    );
  }

  if (reasons.length === 0 && routineAmbiguitySignals.length > 0) {
    notes.push(
      `Routine ambiguity observed (${routineAmbiguitySignals.length} signal(s)) without collapse trigger.`,
    );
  }

  if (reasons.length === 0) {
    return {
      decision: null,
      triggered: false,
      reasons,
      notes,
    };
  }

  return {
    decision: "collapse_review",
    triggered: true,
    reasons,
    notes,
  };
}

function normalizeSignals(signals: string[] | undefined): string[] {
  if (!signals) {
    return [];
  }

  return signals
    .map((signal) => signal.trim())
    .filter((signal, index, values) => signal.length > 0 && values.indexOf(signal) === index);
}
