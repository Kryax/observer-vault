/**
 * S4 — Perspective Agent (Oscillate Phase)
 *
 * Perspective Agents operate in ISOLATION during Oscillate.
 * Each agent generates a structurally independent framing.
 * Agents do NOT see each other's output.
 *
 * Count scales 2-4 based on problem complexity:
 * - Simple/well-defined: 2 agents
 * - Multi-faceted: 3 agents
 * - High-stakes or cross-domain: 4 agents
 *
 * [Source: Council_Redesign_TDS Section 2.2, PRD 3.4.1]
 */

import type {
  PerspectiveLens,
  PerspectiveFraming,
  IndependenceCheckResult,
  OscillateOutput,
  ProblemComplexity,
} from "./types.ts";

// ---------------------------------------------------------------------------
// Agent count selection (ISC-9: scales 2-4 with complexity)
// ---------------------------------------------------------------------------

const AGENT_COUNT: Record<ProblemComplexity, number> = {
  SIMPLE: 2,
  MULTI_FACETED: 3,
  HIGH_STAKES: 4,
};

/**
 * Select Perspective Agent count based on problem complexity.
 * Always returns 2, 3, or 4. Never outside that range.
 */
export function selectAgentCount(complexity: ProblemComplexity): number {
  const count = AGENT_COUNT[complexity];
  if (count < 2 || count > 4) {
    throw new Error(`Agent count out of range: ${count}. Must be 2-4.`);
  }
  return count;
}

// ---------------------------------------------------------------------------
// Lens assignment
// ---------------------------------------------------------------------------

/** Default lens assignments per complexity tier. */
const DEFAULT_LENSES: Record<ProblemComplexity, PerspectiveLens[]> = {
  SIMPLE: ["TECHNICAL_FEASIBILITY", "USER_IMPACT"],
  MULTI_FACETED: ["TECHNICAL_FEASIBILITY", "USER_IMPACT", "OPERATIONAL_MAINTENANCE"],
  HIGH_STAKES: [
    "TECHNICAL_FEASIBILITY",
    "USER_IMPACT",
    "SECURITY_ADVERSARIAL",
    "OPERATIONAL_MAINTENANCE",
  ],
};

/**
 * Assign lenses to Perspective Agents. Uses defaults unless overridden.
 * The number of lenses always matches the agent count for the complexity tier.
 */
export function assignLenses(
  complexity: ProblemComplexity,
  overrides?: PerspectiveLens[],
): PerspectiveLens[] {
  if (overrides) {
    const expectedCount = selectAgentCount(complexity);
    if (overrides.length !== expectedCount) {
      throw new Error(
        `Lens override count (${overrides.length}) does not match agent count (${expectedCount}) for ${complexity}`,
      );
    }
    return overrides;
  }
  return DEFAULT_LENSES[complexity];
}

// ---------------------------------------------------------------------------
// Isolation enforcement (ISC-2: agents operate in isolation)
// ---------------------------------------------------------------------------

/**
 * Create a single Perspective Agent framing.
 *
 * This function represents ONE agent's isolated execution.
 * It receives only the problem statement and its assigned lens.
 * It does NOT receive other agents' outputs — isolation is structural.
 */
export function createPerspectiveFraming(
  agentId: string,
  lens: PerspectiveLens,
  problemStatement: string,
): PerspectiveFraming {
  // In production, this dispatches to a sub-agent via S6.
  // The sub-agent receives ONLY:
  //   - problemStatement
  //   - lens assignment
  // It does NOT receive other agents' framings (isolation guarantee).
  return {
    agentId,
    lens,
    restatement: "",
    constraints: [],
    risks: [],
    approach: "",
    foundationalAssumptions: [],
  };
}

// ---------------------------------------------------------------------------
// Independence check (mandatory per TDS Step 2b)
// ---------------------------------------------------------------------------

/**
 * Perform the mandatory independence check across all framings.
 *
 * Compares foundational assumptions across all agent pairs.
 * Shared assumptions not derivable from the problem statement
 * indicate reduced independence (and thus reduced convergence quality).
 */
export function checkIndependence(
  framings: PerspectiveFraming[],
): IndependenceCheckResult {
  const redundantPairs: IndependenceCheckResult["redundantPairs"] = [];

  for (let i = 0; i < framings.length; i++) {
    for (let j = i + 1; j < framings.length; j++) {
      const sharedAssumptions = framings[i].foundationalAssumptions.filter(
        (assumption) => framings[j].foundationalAssumptions.includes(assumption),
      );
      if (sharedAssumptions.length > 0) {
        redundantPairs.push({
          agentA: framings[i].agentId,
          agentB: framings[j].agentId,
          sharedAssumptions,
        });
      }
    }
  }

  const quality: IndependenceCheckResult["overallQuality"] =
    redundantPairs.length === 0
      ? "HIGH"
      : redundantPairs.length <= 1
        ? "MODERATE"
        : "LOW";

  return { checked: true, redundantPairs, overallQuality: quality };
}

// ---------------------------------------------------------------------------
// Full Oscillate phase execution
// ---------------------------------------------------------------------------

/**
 * Execute the full Oscillate phase.
 *
 * 1. Select agent count based on complexity (2-4)
 * 2. Assign lenses
 * 3. Execute each agent IN ISOLATION (no shared state)
 * 4. Run mandatory independence check
 * 5. Return OscillateOutput
 *
 * Isolation guarantee: each createPerspectiveFraming call receives only
 * the problem statement and its lens. No agent sees another's output.
 */
export function executeOscillate(
  problemStatement: string,
  complexity: ProblemComplexity,
  lensOverrides?: PerspectiveLens[],
): OscillateOutput {
  const agentCount = selectAgentCount(complexity);
  const lenses = assignLenses(complexity, lensOverrides);

  // Execute each agent in isolation (ISC-2).
  // In production, these are parallel sub-agent dispatches via S6.
  const framings: PerspectiveFraming[] = lenses.map((lens, index) =>
    createPerspectiveFraming(`perspective-${index}`, lens, problemStatement),
  );

  const independenceCheck = checkIndependence(framings);

  return {
    phase: "OSCILLATE",
    framings,
    independenceCheck,
    agentCount,
  };
}
