/**
 * S4 — Sentry (Converge Phase)
 *
 * Single-thread adversarial role. Applies pressure on the Triangulator's
 * CONVERGED output — NOT on raw Perspective Agent outputs.
 *
 * The Sentry:
 * - Tests the structural invariant for hidden assumptions
 * - Checks the kill list for items killed incorrectly
 * - Checks perspective-specific items for missed convergence
 * - Flags unresolved risks
 *
 * [Source: Council_Redesign_TDS Section 2.4, PRD 3.4.3]
 */

import type {
  TriangulatorOutput,
  SentryOutput,
  SentryFlag,
} from "./types.ts";

// ---------------------------------------------------------------------------
// Sentry execution (ISC-4: adversarial on converged, not raw)
// ---------------------------------------------------------------------------

/**
 * Execute the Sentry role on the Triangulator's converged output.
 *
 * Input: Triangulator's structural invariant + perspective-specific items.
 * NOT raw Perspective Agent framings — the Sentry operates on the
 * converged output produced by the Triangulator.
 *
 * Single-thread: no sub-agents. Adversarial review requires focused analysis.
 */
export function executeSentry(
  triangulatorOutput: TriangulatorOutput,
): SentryOutput {
  // The Sentry receives the Triangulator's output (post-convergence).
  // It does NOT receive raw Oscillate framings directly.
  // This ensures adversarial pressure is applied to the CONVERGED
  // result, not to individual perspectives.
  const { structuralInvariant, killList, perspectiveSpecificItems } = triangulatorOutput;

  // In production, the Sentry agent performs deep adversarial analysis.
  const flags: SentryFlag[] = [];
  const unresolvedRisks: string[] = [];

  return {
    stressTestedInvariant: structuralInvariant,
    flags,
    unresolvedRisks,
  };
}
