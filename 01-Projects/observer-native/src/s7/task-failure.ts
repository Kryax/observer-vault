/**
 * S7 — Task Failure Escalation (PRD 3.7.1)
 *
 * Preserved from the council-builder escalation loop:
 * Builder fails → retries (bounded) → Council diagnosis → Human gate
 *
 * The human gate BLOCKS execution until human responds.
 */

import type {
  TaskFailureEscalation,
  StructuralDiagnosis,
} from "../s0/index.ts";
import type {
  TaskFailureGate,
  TaskFailureResolution,
  CouncilDiagnosisRequest,
  CouncilDiagnosisResult,
} from "./types.ts";

/**
 * Build a typed TaskFailureEscalation payload.
 * All fields are required — evidence and impact are mandatory, not optional.
 */
export function createTaskFailureEscalation(params: {
  source: string;
  failureEvidence: string;
  retryCount: number;
  structuralDiagnosis: StructuralDiagnosis;
  impact: string;
}): TaskFailureEscalation {
  return {
    type: "TASK_FAILURE",
    source: params.source,
    failureEvidence: params.failureEvidence,
    retryCount: params.retryCount,
    structuralDiagnosis: params.structuralDiagnosis,
    impact: params.impact,
  };
}

/**
 * Request Council structural diagnosis before escalating to human.
 *
 * Council classifies the failure as one of:
 * - missing_info
 * - conflicting_constraints
 * - environmental_failure
 * - structural_disharmony
 */
export function requestCouncilDiagnosis(
  request: CouncilDiagnosisRequest,
): CouncilDiagnosisResult {
  // Council performs structural diagnosis.
  // In production, this dispatches to the Council's deliberation sequence.
  // The interface is typed; the implementation is injected at integration time.
  return {
    resolvable: false,
    diagnosis: `Structural diagnosis pending for failure after ${request.retryCount} retries`,
  };
}

/**
 * Create a human gate that BLOCKS execution.
 *
 * This is the sovereignty boundary — execution halts here until
 * the human provides a resolution. The system does NOT proceed
 * without human input.
 */
export function createTaskFailureGate(
  escalation: TaskFailureEscalation,
): TaskFailureGate {
  return {
    id: `gate-tf-${Date.now()}`,
    status: "BLOCKED",
    payload: escalation,
    blockedAt: new Date().toISOString(),
  };
}

/**
 * Resolve a task failure gate with human input.
 *
 * Resolution paths (PRD 3.7.1):
 * 1. Human provides missing information
 * 2. Human adjusts constraint
 * 3. Human approves retry with guidance
 * 4. Human takes over directly
 */
export function resolveTaskFailureGate(
  gate: TaskFailureGate,
  resolution: TaskFailureResolution,
  humanResponse: string,
): TaskFailureGate {
  return {
    ...gate,
    status: "RESOLVED",
    resolvedAt: new Date().toISOString(),
    resolution,
    humanResponse,
  };
}

/**
 * The full task failure escalation loop:
 *
 * 1. Builder fails proof gates
 * 2. Builder retries (bounded by S6 retry policy, max 3)
 * 3. Still failing → Builder escalates to Council with evidence
 * 4. Council performs structural diagnosis
 * 5. If resolvable → Council updates work packet, Builder retries
 * 6. If not resolvable → Council escalates to Human (gate BLOCKS)
 */
export function executeTaskFailureLoop(params: {
  source: string;
  failureEvidence: string;
  retryCount: number;
  structuralDiagnosis: StructuralDiagnosis;
  impact: string;
}): { gate: TaskFailureGate; councilResult: CouncilDiagnosisResult } {
  // Step 1-2: Retries already exhausted (handled by S6 retry policy)

  // Step 3: Request Council diagnosis
  const councilResult = requestCouncilDiagnosis({
    failureEvidence: params.failureEvidence,
    retryCount: params.retryCount,
  });

  // Step 4-5: If Council can resolve, it returns an updated work packet
  if (councilResult.resolvable) {
    // Council resolved — no human gate needed
    // Return a resolved gate for audit trail
    const escalation = createTaskFailureEscalation(params);
    const gate = createTaskFailureGate(escalation);
    return {
      gate: { ...gate, status: "RESOLVED", resolvedAt: new Date().toISOString() },
      councilResult,
    };
  }

  // Step 6: Council cannot resolve → escalate to Human
  const escalation = createTaskFailureEscalation(params);
  const gate = createTaskFailureGate(escalation);
  // Gate is BLOCKED — execution halts until human responds
  return { gate, councilResult };
}
