/**
 * S3 — ConvergeAndEvaluate
 *
 * Find what survives triangulation across perspectives. Kill what
 * doesn't. Produce the structural invariant.
 *
 * Sub-agent policy: SINGLE-THREAD. Convergence is synthesis — it
 * requires a single coherent reasoning thread to detect structural
 * invariants across all perspectives simultaneously.
 *
 * [Source: G1 - the mechanism by which signal separates from noise
 * requires seeing all measurements at once]
 */

import type {
  ConvergeInput,
  ConvergenceResult,
  KillListEntry,
  Framing,
} from "./types.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Kill list MUST be non-empty when there are 3+ perspectives. */
const MIN_PERSPECTIVES_FOR_KILL_LIST = 3;

// ---------------------------------------------------------------------------
// Core Converge function
// ---------------------------------------------------------------------------

/**
 * ConvergeAndEvaluate: single-thread synthesis (NOT fan-out).
 *
 * A single agent reads ALL Oscillate outputs simultaneously and:
 * 1. Identifies convergent items (appear in 2+ independent framings)
 * 2. Produces kill list (items that failed cross-framing)
 * 3. Applies Sentry adversarial pressure on converged output
 * 4. Produces structural invariant + quality score
 *
 * This runs as a SINGLE coherent reasoning thread, never fan-out.
 */
export function convergeAndEvaluate(input: ConvergeInput): ConvergenceResult {
  validateInput(input);

  const { framings, independenceCheck } = input;

  // Single-thread: read ALL framings simultaneously
  const convergentItems = findConvergentItems(framings);
  const perspectiveSpecificItems = findPerspectiveSpecificItems(framings, convergentItems);
  const killList = buildKillList(framings, convergentItems);

  // Enforce: kill list MUST be non-empty with 3+ perspectives
  if (framings.length >= MIN_PERSPECTIVES_FOR_KILL_LIST && killList.length === 0) {
    killList.push({
      item: "[No items killed — this itself is a flag]",
      source: "convergence-gate",
      reason:
        "With 3+ independent perspectives, zero-kill convergence indicates " +
        "either insufficiently independent framings or overly broad problem scope. " +
        "Independence score: " + independenceCheck.overallScore.toFixed(2),
    });
  }

  // Structural invariant: what survives triangulation
  const structuralInvariant = synthesizeInvariant(convergentItems, framings);

  // Sentry adversarial check
  const sentryFlags = applySentryPressure(
    structuralInvariant,
    killList,
    independenceCheck.overallScore,
  );

  // Convergence quality: weighted by independence and kill-list coverage
  const convergenceQualityScore = computeQualityScore(
    convergentItems.length,
    killList.length,
    framings.length,
    independenceCheck.overallScore,
  );

  return {
    structuralInvariant,
    killList,
    perspectiveSpecificItems,
    convergenceQualityScore,
    sentryFlags,
  };
}

// ---------------------------------------------------------------------------
// Convergence analysis (single-thread)
// ---------------------------------------------------------------------------

/**
 * Identify items that appear in 2+ framings (convergent).
 * Single-thread: reads all framings at once.
 */
function findConvergentItems(framings: Framing[]): string[] {
  // Extract content tokens/concepts from each framing
  const framingConcepts = framings.map((f) => extractConcepts(f));

  const conceptCounts = new Map<string, number>();
  for (const concepts of framingConcepts) {
    for (const concept of concepts) {
      conceptCounts.set(concept, (conceptCounts.get(concept) ?? 0) + 1);
    }
  }

  // Convergent: appears in 2+ framings
  return Array.from(conceptCounts.entries())
    .filter(([, count]) => count >= 2)
    .map(([concept]) => concept);
}

/**
 * Items unique to a single perspective.
 */
function findPerspectiveSpecificItems(
  framings: Framing[],
  convergentItems: string[],
): Record<string, string[]> {
  const convergentSet = new Set(convergentItems);
  const result: Record<string, string[]> = {};

  for (const framing of framings) {
    const concepts = extractConcepts(framing);
    result[framing.perspectiveId] = concepts.filter((c) => !convergentSet.has(c));
  }

  return result;
}

/**
 * Build kill list: items that failed cross-framing validation.
 * With 3+ perspectives, this MUST be non-empty.
 */
function buildKillList(
  framings: Framing[],
  convergentItems: string[],
): KillListEntry[] {
  const convergentSet = new Set(convergentItems);
  const killList: KillListEntry[] = [];

  for (const framing of framings) {
    const concepts = extractConcepts(framing);
    for (const concept of concepts) {
      if (!convergentSet.has(concept)) {
        killList.push({
          item: concept,
          source: framing.perspectiveId,
          reason: `Failed cross-framing: appeared only in ${framing.perspectiveId}`,
        });
      }
    }
  }

  return killList;
}

/**
 * Synthesize structural invariant from convergent items.
 */
function synthesizeInvariant(convergentItems: string[], framings: Framing[]): string {
  if (convergentItems.length === 0) {
    return `No structural invariant found across ${framings.length} perspectives. ` +
      `This suggests either highly independent (good) or highly divergent (review needed) framings.`;
  }

  return `Structural invariant across ${framings.length} perspectives: ` +
    convergentItems.join(", ");
}

/**
 * Sentry adversarial pressure on converged output.
 */
function applySentryPressure(
  structuralInvariant: string,
  killList: KillListEntry[],
  independenceScore: number,
): string[] {
  const flags: string[] = [];

  if (independenceScore < 0.3) {
    flags.push(
      "LOW_INDEPENDENCE: Perspectives share >70% assumptions. " +
      "Convergence may reflect shared bias, not genuine structural invariant.",
    );
  }

  if (killList.length === 0) {
    flags.push(
      "ZERO_KILL: No items rejected. Possible groupthink or " +
      "insufficiently differentiated perspectives.",
    );
  }

  if (!structuralInvariant.trim()) {
    flags.push("EMPTY_INVARIANT: No structural invariant produced.");
  }

  return flags;
}

/**
 * Compute convergence quality score.
 */
function computeQualityScore(
  convergentCount: number,
  killCount: number,
  framingCount: number,
  independenceScore: number,
): number {
  // Quality improves with: higher independence, non-zero kill list,
  // reasonable convergent-to-total ratio
  const killFactor = killCount > 0 ? 1.0 : 0.5;
  const convergenceFactor = framingCount > 0
    ? Math.min(convergentCount / framingCount, 1.0)
    : 0;

  return Math.min(
    1.0,
    (independenceScore * 0.4 + convergenceFactor * 0.3 + killFactor * 0.3),
  );
}

/**
 * Extract concepts from a framing for convergence analysis.
 * In production, this would use semantic analysis.
 */
function extractConcepts(framing: Framing): string[] {
  // Structural extraction: use foundational assumptions as concept proxy
  // Real implementation would use LLM-based semantic extraction
  return [...framing.foundationalAssumptions];
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateInput(input: ConvergeInput): void {
  if (input.framings.length < 2) {
    throw new Error(
      `ConvergeAndEvaluate requires at least 2 framings, got ${input.framings.length}`,
    );
  }
}
