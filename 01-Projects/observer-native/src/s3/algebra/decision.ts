import type { AlgebraDecision, CandidateRecord, EvidenceReference } from "./types.ts";

export const ALGEBRA_DECISION_SET = [
  "reject",
  "hold_t0",
  "auto_promote_t1",
  "review_for_t2",
  "collapse_review",
] as const satisfies readonly AlgebraDecision[];

export interface DomainStabilizationScore {
  eligible: boolean;
  distinctDomainCount: number;
  unrelatedDomainCount: number;
  minimumDistinctDomains: number;
  minimumUnrelatedDomains: number;
}

export interface InvarianceStabilizationScore {
  eligible: boolean;
  score: number;
  threshold: number;
}

export interface DerivationAssessment {
  derivationConflict: boolean;
  strongestMatch: CandidateRecord["comparisonReport"]["strongestMatch"];
  threshold: number;
  notes: string[];
}

export interface StabilizationAssessment {
  c: DomainStabilizationScore;
  i: InvarianceStabilizationScore;
  d: DerivationAssessment;
}

export interface CollapseReviewSignal {
  kind: "derivation_conflict" | "falsifier_failure" | "process_pathology";
  detail: string;
  evidence: string[];
}

export interface DecisionResolverInput {
  candidate: CandidateRecord;
  targetTier: 1 | 2;
  stabilization: StabilizationAssessment;
  collapseSignals?: CollapseReviewSignal[];
}

export interface DecisionResolution {
  decision: AlgebraDecision;
  candidate: CandidateRecord;
  targetTier: 1 | 2;
  stabilization: StabilizationAssessment;
  collapseSignals: CollapseReviewSignal[];
  rationale: string[];
}

function hasMinimumEvidence(candidate: CandidateRecord): boolean {
  if (candidate.instances.length === 0) {
    return false;
  }

  const evidenceRefCount = candidate.instances.reduce(
    (total, instance) => total + instance.evidenceRefs.length,
    0,
  );

  return (
    evidenceRefCount > 0 &&
    candidate.invariants.length > 0 &&
    candidate.falsifiers.length > 0 &&
    candidate.instances.every(
      (instance) =>
        instance.structuralClaims.length > 0 &&
        instance.invariants.length > 0 &&
        instance.falsifiers.length > 0,
    )
  );
}

export function collectCandidateEvidence(
  candidate: CandidateRecord,
): EvidenceReference[] {
  const seen = new Set<string>();
  const evidence: EvidenceReference[] = [];

  for (const instance of candidate.instances) {
    for (const ref of instance.evidenceRefs) {
      const key = JSON.stringify(ref);
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      evidence.push(ref);
    }
  }

  return evidence;
}

export function resolveDecision(
  input: DecisionResolverInput,
): DecisionResolution {
  const collapseSignals = input.collapseSignals ?? [];
  const rationale: string[] = [];

  if (!hasMinimumEvidence(input.candidate)) {
    rationale.push(
      "Candidate is missing the structured evidence required for algebraic evaluation.",
    );

    return {
      decision: "reject",
      candidate: input.candidate,
      targetTier: input.targetTier,
      stabilization: input.stabilization,
      collapseSignals,
      rationale,
    };
  }

  if (collapseSignals.length > 0) {
    rationale.push(
      "Collapse review is required before any promotion path can continue.",
    );

    return {
      decision: "collapse_review",
      candidate: input.candidate,
      targetTier: input.targetTier,
      stabilization: input.stabilization,
      collapseSignals,
      rationale,
    };
  }

  if (!input.stabilization.c.eligible || !input.stabilization.i.eligible) {
    rationale.push(
      "Candidate remains below the stabilization threshold and stays at Tier 0.",
    );

    return {
      decision: "hold_t0",
      candidate: input.candidate,
      targetTier: input.targetTier,
      stabilization: input.stabilization,
      collapseSignals,
      rationale,
    };
  }

  if (input.targetTier === 1 && !input.stabilization.d.derivationConflict) {
    rationale.push(
      "Candidate meets Tier 1 stabilization thresholds without a derivation conflict.",
    );

    return {
      decision: "auto_promote_t1",
      candidate: input.candidate,
      targetTier: input.targetTier,
      stabilization: input.stabilization,
      collapseSignals,
      rationale,
    };
  }

  if (input.targetTier === 2) {
    rationale.push(
      "Tier 2 promotion remains human-sovereign and requires a blocked review gate.",
    );

    if (input.stabilization.d.derivationConflict) {
      rationale.push(
        "Review packet includes a derivation conflict for human adjudication.",
      );
    }

    return {
      decision: "review_for_t2",
      candidate: input.candidate,
      targetTier: input.targetTier,
      stabilization: input.stabilization,
      collapseSignals,
      rationale,
    };
  }

  rationale.push(
    "Candidate is stabilizing but remains at Tier 0 pending more evidence.",
  );

  return {
    decision: "hold_t0",
    candidate: input.candidate,
    targetTier: input.targetTier,
    stabilization: input.stabilization,
    collapseSignals,
    rationale,
  };
}
