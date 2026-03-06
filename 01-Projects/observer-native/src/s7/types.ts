/**
 * S7 — Escalation Layer Types
 *
 * Types specific to the escalation layer. Foundation escalation types
 * (TaskFailureEscalation, ProcessQualityEscalation) are in S0.
 */

import type {
  TaskFailureEscalation,
  ProcessQualityEscalation,
} from "../s0/index.ts";

// -- Resolution paths for task failure (PRD 3.7.1) --

export type TaskFailureResolution =
  | "HUMAN_PROVIDED_INFO"
  | "HUMAN_ADJUSTED_CONSTRAINT"
  | "HUMAN_APPROVED_RETRY"
  | "HUMAN_TOOK_OVER";

// -- Resolution paths for process quality (PRD 3.7.2) --

export type ProcessQualityResolution =
  | "ADJUSTED_LENS_DEFAULTS"
  | "ADDED_REQUIRED_PERSPECTIVE"
  | "MODIFIED_INDEPENDENCE_CRITERIA"
  | "ACKNOWLEDGED_AND_DISMISSED";

// -- Human gate state --

export type GateStatus = "BLOCKED" | "RESOLVED";

export interface HumanGate<
  TPayload extends TaskFailureEscalation | ProcessQualityEscalation,
  TResolution extends TaskFailureResolution | ProcessQualityResolution,
> {
  id: string;
  status: GateStatus;
  payload: TPayload;
  blockedAt: string;
  resolvedAt?: string;
  resolution?: TResolution;
  humanResponse?: string;
}

export type TaskFailureGate = HumanGate<
  TaskFailureEscalation,
  TaskFailureResolution
>;

export type ProcessQualityGate = HumanGate<
  ProcessQualityEscalation,
  ProcessQualityResolution
>;

// -- Council structural diagnosis request --

export interface CouncilDiagnosisRequest {
  failureEvidence: string;
  retryCount: number;
  relatedSliceOutputs?: string[];
}

export interface CouncilDiagnosisResult {
  resolvable: boolean;
  diagnosis: string;
  updatedWorkPacket?: string;
}

// -- Escalation source constraint --

export type ProcessQualityEscalationSource = "Reflector";
