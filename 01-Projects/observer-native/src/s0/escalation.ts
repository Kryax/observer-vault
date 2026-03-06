/**
 * S0 — Escalation Event Types (PRD 3.0.4)
 *
 * Two distinct escalation types with non-overlapping payloads:
 * - TaskFailureEscalation: Builder/slice failures
 * - ProcessQualityEscalation: Reflector-detected process issues
 */

export type StructuralDiagnosis =
  | "missing_info"
  | "conflicting_constraints"
  | "environmental_failure"
  | "structural_disharmony";

export interface TaskFailureEscalation {
  type: "TASK_FAILURE";
  source: string;
  failureEvidence: string;
  retryCount: number;
  structuralDiagnosis: StructuralDiagnosis;
  impact: string;
}

export type ProcessQualityTrigger =
  | "RECURRING_BIAS"
  | "SYSTEMATIC_ABSENCE"
  | "CONVERGENCE_DEGRADATION"
  | "AXIS_IMBALANCE_PERSISTENCE";

export interface ProcessQualityEscalation {
  type: "PROCESS_QUALITY";
  trigger: ProcessQualityTrigger;
  patternDescription: string;
  span: string[];
  impact: string;
  suggestedCorrection?: string;
}

export type EscalationEvent =
  | TaskFailureEscalation
  | ProcessQualityEscalation;
