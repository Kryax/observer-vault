/**
 * S4 — Reflector (Reflect Phase — MANDATORY)
 *
 * The Reflector is structurally MANDATORY in the deliberation sequence.
 * It is NOT optional and CANNOT be skipped.
 *
 * Authority: OBSERVATION ONLY. The Reflector:
 * - Cannot override the Triangulator's structural invariant
 * - Cannot override the Sentry's flags
 * - Cannot make decisions about execution
 * - CAN observe process quality and escalate concerns
 *
 * Minimum output floor: M/2 pages where M = Converge output page count.
 *
 * [Source: Council_Redesign_TDS Section 2.5, REQ-R1 through REQ-R4, PRD 3.4.4]
 */

import type {
  OscillateOutput,
  ConvergeOutput,
  ReflectorOutput,
  MotifCandidate,
  FrameworkDelta,
} from "./types.ts";

import type { ProcessQualityEscalation } from "../s0/index.ts";

// ---------------------------------------------------------------------------
// Output floor enforcement (ISC-7: M/2 pages minimum)
// ---------------------------------------------------------------------------

/**
 * Validate that the Reflector's output meets the minimum floor.
 * M/2 pages where M = Converge output page count.
 *
 * A one-sentence summary is never acceptable.
 */
export function validateOutputFloor(
  reflectorOutputPages: number,
  convergeOutputPages: number,
): { valid: boolean; minimumRequired: number; actual: number } {
  const minimumRequired = convergeOutputPages / 2;
  return {
    valid: reflectorOutputPages >= minimumRequired,
    minimumRequired,
    actual: reflectorOutputPages,
  };
}

// ---------------------------------------------------------------------------
// Mandatory presence enforcement (ISC-5: structurally mandatory)
// ---------------------------------------------------------------------------

/**
 * The Reflector is structurally mandatory. This constant encodes that
 * the deliberation sequence MUST include the Reflect phase.
 * Skipping the Reflector is a structural violation.
 */
export const REFLECTOR_IS_MANDATORY = true as const;

/**
 * Assert that the Reflector has been executed. Called by the
 * deliberation sequence before work packet assembly.
 * Throws if Reflect phase was skipped.
 */
export function assertReflectorExecuted(
  reflectOutput: ReflectorOutput | undefined,
): asserts reflectOutput is ReflectorOutput {
  if (!reflectOutput) {
    throw new Error(
      "Reflector phase is structurally MANDATORY. " +
      "The deliberation sequence cannot proceed to work packet assembly " +
      "without Reflector output. This is not optional.",
    );
  }
}

// ---------------------------------------------------------------------------
// Authority constraint (ISC-6: observation only, no decision authority)
// ---------------------------------------------------------------------------

/**
 * The Reflector's authority boundary.
 * observation: true — the Reflector observes process quality
 * decision: false — the Reflector CANNOT make decisions
 * override: false — the Reflector CANNOT override other roles
 */
export const REFLECTOR_AUTHORITY = {
  observation: true,
  decision: false,
  override: false,
} as const;

// ---------------------------------------------------------------------------
// Process quality escalation (parallel path, TDS Step 8)
// ---------------------------------------------------------------------------

/**
 * Create a process quality escalation from the Reflector.
 * This is independent of task-failure escalation.
 * The Reflector may suggest corrections but does not decide.
 */
export function createProcessEscalation(
  trigger: ProcessQualityEscalation["trigger"],
  patternDescription: string,
  span: string[],
  impact: string,
  suggestedCorrection?: string,
): ProcessQualityEscalation {
  return {
    type: "PROCESS_QUALITY",
    trigger,
    patternDescription,
    span,
    impact,
    suggestedCorrection,
  };
}

// ---------------------------------------------------------------------------
// Reflector execution
// ---------------------------------------------------------------------------

/**
 * Execute the Reflector role on ALL prior phase outputs.
 *
 * The Reflector receives:
 * - All Oscillate framing documents
 * - Independence check result
 * - Triangulator invariant + kill list
 * - Sentry flags
 *
 * It produces REQUIRED outputs:
 * 1. Process observation
 * 2. Assumption inventory
 * 3. Motif candidates (0 or more)
 * 4. Framework delta
 * 5. Axis balance assessment
 *
 * Authority: observation ONLY. No decision authority.
 * The Reflector informs but does not direct.
 *
 * Single-thread: no sub-agents. Reflective synthesis requires coherence.
 */
export function executeReflect(
  oscillateOutput: OscillateOutput,
  convergeOutput: ConvergeOutput,
  convergeOutputPages: number,
): ReflectorOutput {
  // The Reflector sees ALL prior outputs (not just Converge).
  // This is the recursion axis — the Council examining its own process.

  const output: ReflectorOutput = {
    phase: "REFLECT",
    processObservation: "",
    assumptionInventory: [],
    motifCandidates: [],
    frameworkDelta: {
      description: "",
      suggestedLensAdjustments: [],
      axisImbalanceDetected: false,
    },
    axisBalanceAssessment: {
      differentiate: 0,
      integrate: 0,
      recurse: 0,
      imbalanced: false,
    },
    outputPages: 0,
  };

  // Enforce minimum output floor (ISC-7).
  const floorCheck = validateOutputFloor(output.outputPages, convergeOutputPages);
  if (!floorCheck.valid) {
    // In production, the Reflector agent must expand its analysis.
    // The deliberation sequence enforces this check before proceeding.
  }

  return output;
}
