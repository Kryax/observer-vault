/**
 * S7 — Process Quality Escalation (PRD 3.7.2)
 *
 * NEW escalation path from Council Redesign TDS.
 * Independent of task failure escalation. Runs in parallel.
 *
 * Source: ONLY the Reflector role can trigger this path.
 * The human gate BLOCKS further deliberation until human responds.
 */

import type {
  ProcessQualityEscalation,
  ProcessQualityTrigger,
} from "../s0/index.ts";
import type {
  ProcessQualityGate,
  ProcessQualityResolution,
  ProcessQualityEscalationSource,
} from "./types.ts";

/**
 * The four trigger conditions (any one sufficient):
 *
 * - RECURRING_BIAS: Same assumption in 3+ consecutive deliberations
 *   without explicit lens assignment
 * - SYSTEMATIC_ABSENCE: A domain or stakeholder absent from Oscillate
 *   for 3+ consecutive deliberations
 * - CONVERGENCE_DEGRADATION: Independence check flags redundancy in
 *   3+ consecutive deliberations
 * - AXIS_IMBALANCE_PERSISTENCE: Same D/I/R imbalance pattern across
 *   3+ consecutive deliberations
 */
const VALID_TRIGGERS: readonly ProcessQualityTrigger[] = [
  "RECURRING_BIAS",
  "SYSTEMATIC_ABSENCE",
  "CONVERGENCE_DEGRADATION",
  "AXIS_IMBALANCE_PERSISTENCE",
] as const;

/**
 * Create a process quality escalation.
 *
 * CONSTRAINT: Only the Reflector role can call this function.
 * The source parameter is typed to enforce this structurally.
 */
export function createProcessQualityEscalation(params: {
  source: ProcessQualityEscalationSource;
  trigger: ProcessQualityTrigger;
  patternDescription: string;
  span: string[];
  impact: string;
  suggestedCorrection?: string;
}): ProcessQualityEscalation {
  if (params.source !== "Reflector") {
    throw new Error(
      `Process quality escalation can only be triggered by the Reflector role. ` +
      `Received source: "${params.source}"`
    );
  }

  if (!VALID_TRIGGERS.includes(params.trigger)) {
    throw new Error(
      `Invalid process quality trigger: "${params.trigger}". ` +
      `Valid triggers: ${VALID_TRIGGERS.join(", ")}`
    );
  }

  return {
    type: "PROCESS_QUALITY",
    trigger: params.trigger,
    patternDescription: params.patternDescription,
    span: params.span,
    impact: params.impact,
    suggestedCorrection: params.suggestedCorrection,
  };
}

/**
 * Create a human gate that BLOCKS further deliberation.
 *
 * This is a hard stop — the system does not dismiss process-quality
 * concerns autonomously. The Reflector articulates a process
 * observation. The human decides whether to act.
 */
export function createProcessQualityGate(
  escalation: ProcessQualityEscalation,
): ProcessQualityGate {
  return {
    id: `gate-pq-${Date.now()}`,
    status: "BLOCKED",
    payload: escalation,
    blockedAt: new Date().toISOString(),
  };
}

/**
 * Resolve a process quality gate with human input.
 *
 * Resolution paths (PRD 3.7.2):
 * 1. Human adjusts lens assignment defaults
 * 2. Human adds a required perspective type
 * 3. Human modifies independence check criteria
 * 4. Human acknowledges and dismisses (with reason recorded)
 */
export function resolveProcessQualityGate(
  gate: ProcessQualityGate,
  resolution: ProcessQualityResolution,
  humanResponse: string,
): ProcessQualityGate {
  return {
    ...gate,
    status: "RESOLVED",
    resolvedAt: new Date().toISOString(),
    resolution,
    humanResponse,
  };
}

/**
 * Check if a process quality trigger condition is met.
 *
 * All triggers require 3+ consecutive deliberations exhibiting the pattern.
 */
export function checkProcessQualityTrigger(params: {
  trigger: ProcessQualityTrigger;
  deliberationSpan: string[];
  consecutiveCount: number;
}): boolean {
  return params.consecutiveCount >= 3 && params.deliberationSpan.length >= 3;
}
