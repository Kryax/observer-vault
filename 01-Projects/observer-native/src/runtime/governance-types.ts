/**
 * Governance Types — Pillar 1 (Dual-Speed Governance)
 *
 * Defines the speed classification model: every action is classified as
 * FAST_ALLOWED, SLOW_REQUIRED, or DISALLOWED. No module self-classifies.
 */

// ---------------------------------------------------------------------------
// Speed Classification
// ---------------------------------------------------------------------------

export type GovernanceSpeed =
  | "FAST_ALLOWED"
  | "SLOW_REQUIRED"
  | "DISALLOWED";

// ---------------------------------------------------------------------------
// Action Classes (9 total: 8 from design memo + ALGEBRA_REVIEW per §8.5)
// ---------------------------------------------------------------------------

export type GovernanceActionClass =
  | "SESSION_OPERATION"
  | "TASK_EXECUTION"
  | "BUFFER_MANAGEMENT"
  | "RECEIPT_GENERATION"
  | "PLUGIN_REGISTRATION"
  | "HUMAN_GATE_RESOLUTION"
  | "ARCHITECTURAL_CHANGE"
  | "SOVEREIGNTY_DECISION"
  | "ALGEBRA_REVIEW";

// ---------------------------------------------------------------------------
// GovernanceDecision — discriminated union on speed
// ---------------------------------------------------------------------------

export type GovernanceDecision =
  | GovernanceDecisionFast
  | GovernanceDecisionSlow
  | GovernanceDecisionDisallowed;

export interface GovernanceDecisionFast {
  readonly speed: "FAST_ALLOWED";
  readonly actionClass: GovernanceActionClass;
  readonly policyVersion: string;
}

export interface GovernanceDecisionSlow {
  readonly speed: "SLOW_REQUIRED";
  readonly actionClass: GovernanceActionClass;
  readonly policyVersion: string;
  readonly gateType: string;
}

export interface GovernanceDecisionDisallowed {
  readonly speed: "DISALLOWED";
  readonly actionClass: GovernanceActionClass;
  readonly policyVersion: string;
  readonly reason: string;
}
