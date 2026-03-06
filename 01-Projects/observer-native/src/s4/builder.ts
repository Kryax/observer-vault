/**
 * S4 — Builder (Post-Triad Execution)
 *
 * The Builder receives a work packet containing triad receipts from
 * ALL THREE phases (Oscillate, Converge, Reflect) and executes
 * deterministically.
 *
 * May fan out to sub-agents via S6 for parallel work packets.
 *
 * [Source: Council_Redesign_TDS Section 2.6, PRD 3.4.5]
 */

import type {
  WorkPacket,
  BuilderResult,
  TriadReceipts,
  OscillateOutput,
  ConvergeOutput,
  ReflectorOutput,
  SentryFlag,
} from "./types.ts";

import type { TaskFailureEscalation, StructuralDiagnosis } from "../s0/index.ts";

// ---------------------------------------------------------------------------
// Work packet assembly (ISC-8: includes triad receipts from all 3 phases)
// ---------------------------------------------------------------------------

/**
 * Assemble a work packet for the Builder.
 *
 * The work packet MUST include triad receipts from all three phases:
 * - Oscillate output (perspective framings + independence check)
 * - Converge output (Triangulator invariant + Sentry flags)
 * - Reflect output (process observation + assumption inventory + framework delta)
 *
 * This ensures the Builder has full triad context for execution.
 */
export function assembleWorkPacket(
  oscillateOutput: OscillateOutput,
  convergeOutput: ConvergeOutput,
  reflectOutput: ReflectorOutput,
  scope: string,
  constraints: string[],
  successCriteria: string[],
  acceptanceTests: string[],
  paths: string[],
  environmentContext: Record<string, string>,
): WorkPacket {
  // Triad receipts from ALL THREE phases (ISC-8).
  const triadReceipts: TriadReceipts = {
    oscillate: oscillateOutput,
    converge: convergeOutput,
    reflect: reflectOutput,
  };

  return {
    structuralInvariant: convergeOutput.triangulator.structuralInvariant,
    sentryFlags: convergeOutput.sentry.flags,
    reflectObservations: reflectOutput.processObservation,
    scope,
    constraints,
    successCriteria,
    acceptanceTests,
    paths,
    environmentContext,
    triadReceipts,
  };
}

/**
 * Validate that a work packet contains all three triad receipts.
 * This is a structural check — the Builder cannot proceed without
 * evidence from all three phases.
 */
export function validateWorkPacket(
  workPacket: WorkPacket,
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!workPacket.triadReceipts.oscillate) missing.push("oscillate");
  if (!workPacket.triadReceipts.converge) missing.push("converge");
  if (!workPacket.triadReceipts.reflect) missing.push("reflect");
  return { valid: missing.length === 0, missing };
}

// ---------------------------------------------------------------------------
// Builder execution
// ---------------------------------------------------------------------------

/** Maximum retry budget before escalation to Council. */
const MAX_RETRIES = 3;

/**
 * Execute the Builder role with a validated work packet.
 *
 * The Builder:
 * 1. Receives the work packet (with triad receipts from all three phases)
 * 2. Executes deterministically
 * 3. Runs proof gates
 * 4. On PASS: returns receipts
 * 5. On FAIL: retries up to MAX_RETRIES
 * 6. On exhausted retries: escalates to Council (S7)
 *
 * May fan out to sub-agents via S6 for parallel work packets.
 */
export function executeBuilder(
  workPacket: WorkPacket,
): BuilderResult {
  // Validate work packet has all triad receipts.
  const validation = validateWorkPacket(workPacket);
  if (!validation.valid) {
    throw new Error(
      `Work packet missing triad receipts: ${validation.missing.join(", ")}. ` +
      "Builder cannot execute without evidence from all three phases.",
    );
  }

  // In production, the Builder dispatches execution (possibly via S6).
  return {
    passed: false,
    artifacts: [],
    proofGateResults: [],
    receipts: [],
    retryCount: 0,
  };
}

/**
 * Create a task failure escalation when the Builder exhausts retries.
 */
export function createTaskFailureEscalation(
  source: string,
  failureEvidence: string,
  retryCount: number,
  diagnosis: StructuralDiagnosis,
  impact: string,
): TaskFailureEscalation {
  return {
    type: "TASK_FAILURE",
    source,
    failureEvidence,
    retryCount,
    structuralDiagnosis: diagnosis,
    impact,
  };
}
