/**
 * S7 — Sovereignty Boundary (PRD 3.7.3)
 *
 * "AI articulates, humans decide" is NOT a guideline — it is a
 * structural hard stop enforced by this layer's architecture.
 *
 * - Escalation events are TYPED (S0)
 * - Payloads are STRUCTURED
 * - Resolution REQUIRES human input before execution resumes
 * - The system CANNOT override, dismiss, or bypass human gates
 */

import type {
  TaskFailureEscalation,
  ProcessQualityEscalation,
  EscalationEvent,
} from "../s0/index.ts";
import type {
  TaskFailureGate,
  ProcessQualityGate,
  TaskFailureResolution,
  ProcessQualityResolution,
} from "./types.ts";

/**
 * The sovereignty principle as code.
 *
 * AI capabilities:
 * - Produce analysis, options, recommendations, evidence
 *
 * AI prohibitions:
 * - Make decisions affecting scope, governance, or authority
 * - Override human gates
 * - Dismiss escalation events
 * - Bypass blocking gates
 */
export const SOVEREIGNTY_PRINCIPLE = {
  aiCapabilities: [
    "produce_analysis",
    "produce_options",
    "produce_recommendations",
    "produce_evidence",
  ] as const,
  aiProhibitions: [
    "decide_scope",
    "decide_governance",
    "decide_authority",
    "override_human_gate",
    "dismiss_escalation",
    "bypass_blocking_gate",
  ] as const,
  humanAuthority: "LEVEL_1" as const,
  enforcement: "STRUCTURAL" as const,
} as const;

/**
 * Assert that a gate is resolved before allowing execution to continue.
 *
 * This is the structural enforcement — not a prompt, not a guideline.
 * If the gate is BLOCKED, this throws. Execution CANNOT proceed.
 */
export function assertGateResolved(
  gate: TaskFailureGate | ProcessQualityGate,
): void {
  if (gate.status === "BLOCKED") {
    throw new Error(
      `Sovereignty violation: Gate ${gate.id} is BLOCKED. ` +
      `Execution cannot proceed without human resolution. ` +
      `Blocked since: ${gate.blockedAt}`
    );
  }
}

/**
 * Check if an escalation event requires human intervention.
 *
 * Both escalation types ALWAYS require human intervention.
 * This function exists to make the structural constraint explicit.
 */
export function requiresHumanIntervention(
  _event: EscalationEvent,
): true {
  // All escalation events require human intervention.
  // This is not conditional. It is a structural hard stop.
  return true;
}

/**
 * Validate that a resolution is legitimate.
 *
 * A resolution must include:
 * 1. A valid resolution type
 * 2. A non-empty human response
 * 3. A timestamp
 */
export function validateResolution(
  gate: TaskFailureGate | ProcessQualityGate,
): boolean {
  return (
    gate.status === "RESOLVED" &&
    gate.resolution !== undefined &&
    gate.humanResponse !== undefined &&
    gate.humanResponse.length > 0 &&
    gate.resolvedAt !== undefined
  );
}

/**
 * Create an audit record for an escalation event.
 *
 * Every escalation is recorded for transparency and accountability.
 */
export function createEscalationAuditRecord(
  gate: TaskFailureGate | ProcessQualityGate,
): {
  gateId: string;
  escalationType: "TASK_FAILURE" | "PROCESS_QUALITY";
  status: string;
  blockedAt: string;
  resolvedAt?: string;
  resolution?: string;
  hasEvidence: boolean;
  hasImpact: boolean;
} {
  return {
    gateId: gate.id,
    escalationType: gate.payload.type,
    status: gate.status,
    blockedAt: gate.blockedAt,
    resolvedAt: gate.resolvedAt,
    resolution: gate.resolution,
    hasEvidence: "failureEvidence" in gate.payload || "patternDescription" in gate.payload,
    hasImpact: gate.payload.impact.length > 0,
  };
}
