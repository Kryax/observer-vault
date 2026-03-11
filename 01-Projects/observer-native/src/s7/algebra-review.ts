import type { ProcessQualityGate } from "./types.ts";
import { assertGateResolved } from "./sovereignty.ts";
import {
  collectCandidateEvidence,
  type CollapseReviewSignal,
  type DecisionResolution,
  type StabilizationAssessment,
} from "../s3/algebra/decision.ts";
import type {
  CandidateRecord,
  EvidenceReference,
  MotifTier,
} from "../s3/algebra/types.ts";

export type AlgebraReviewResolution =
  | "APPROVED_FOR_T2"
  | "RETURN_TO_T0"
  | "REQUEST_MORE_EVIDENCE"
  | "COLLAPSE_REVIEW_REQUIRED";

export interface AlgebraReviewEvidence {
  candidate: {
    id: string;
    name: string;
    currentTier: MotifTier;
    requestedTier: 2;
    sourceType: CandidateRecord["sourceType"];
    confidence: number;
  };
  stabilization: StabilizationAssessment;
  comparisonReport: CandidateRecord["comparisonReport"];
  evidenceRefs: EvidenceReference[];
  invariants: string[];
  falsifiers: string[];
  rationale: string[];
  collapseSignals: CollapseReviewSignal[];
}

export interface AlgebraReviewEscalation {
  type: "ALGEBRA_REVIEW";
  decision: "review_for_t2";
  impact: string;
  evidence: AlgebraReviewEvidence;
}

export interface AlgebraReviewGate {
  id: string;
  status: "BLOCKED" | "RESOLVED";
  payload: AlgebraReviewEscalation;
  blockedAt: string;
  resolvedAt?: string;
  resolution?: AlgebraReviewResolution;
  humanResponse?: string;
}

export function createAlgebraReviewEscalation(
  resolution: DecisionResolution,
): AlgebraReviewEscalation {
  if (resolution.decision !== "review_for_t2" || resolution.targetTier !== 2) {
    throw new Error(
      "Algebra review escalation can only be created from a review_for_t2 decision.",
    );
  }

  return {
    type: "ALGEBRA_REVIEW",
    decision: "review_for_t2",
    impact: "Tier 2 promotion is blocked pending human review.",
    evidence: {
      candidate: {
        id: resolution.candidate.id,
        name: resolution.candidate.name,
        currentTier: resolution.candidate.tier,
        requestedTier: 2,
        sourceType: resolution.candidate.sourceType,
        confidence: resolution.candidate.confidence,
      },
      stabilization: resolution.stabilization,
      comparisonReport: resolution.candidate.comparisonReport,
      evidenceRefs: collectCandidateEvidence(resolution.candidate),
      invariants: resolution.candidate.invariants,
      falsifiers: resolution.candidate.falsifiers,
      rationale: resolution.rationale,
      collapseSignals: resolution.collapseSignals,
    },
  };
}

export function createAlgebraReviewGate(
  escalation: AlgebraReviewEscalation,
): AlgebraReviewGate {
  return {
    id: `gate-ar-${Date.now()}`,
    status: "BLOCKED",
    payload: escalation,
    blockedAt: new Date().toISOString(),
  };
}

export function createAlgebraReviewGateFromDecision(
  resolution: DecisionResolution,
): AlgebraReviewGate {
  return createAlgebraReviewGate(createAlgebraReviewEscalation(resolution));
}

export function resolveAlgebraReviewGate(
  gate: AlgebraReviewGate,
  resolution: AlgebraReviewResolution,
  humanResponse: string,
): AlgebraReviewGate {
  return {
    ...gate,
    status: "RESOLVED",
    resolvedAt: new Date().toISOString(),
    resolution,
    humanResponse,
  };
}

export function assertAlgebraReviewGateResolved(
  gate: AlgebraReviewGate,
): void {
  assertGateResolved(gate as unknown as ProcessQualityGate);
}
