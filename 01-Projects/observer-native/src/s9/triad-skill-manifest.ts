/**
 * S9 — Triad Skill Manifest
 *
 * Documents the wiring between the Claude Code skill at
 * ~/.claude/skills/Triad/SKILL.md and the observer-native source tree.
 *
 * The Triad skill is the callable interface to the two-speed cognitive
 * triad (Oscillate → Converge → Reflect). It does not re-implement
 * s3/ or s4/ — it orchestrates them as a unified workflow.
 *
 * Two speeds:
 *   fast — inline D/I/R, no sub-agents, single pass
 *   slow — full triad with 2-4 perspective sub-agents via Agent tool
 *
 * Speed selection reuses foundational-trigger patterns from
 * s0/isc-evaluator.ts.
 */

// ── Source Wiring ─────────────────────────────────────────────────

/** Components wired by the Triad skill. */
export const TRIAD_WIRING = {
  skill: "~/.claude/skills/Triad/SKILL.md",

  /** S3 primitives — the triad operations themselves */
  primitives: {
    oscillate: "src/s3/oscillate.ts",
    converge: "src/s3/converge.ts",
    reflect: "src/s3/reflect.ts",
  },

  /** S4 council roles — the agents that execute the triad */
  councilRoles: {
    perspectiveAgent: "src/s4/perspective-agent.ts",
    triangulator: "src/s4/triangulator.ts",
    sentry: "src/s4/sentry.ts",
    reflector: "src/s4/reflector.ts",
    builder: "src/s4/builder.ts",
    deliberation: "src/s4/deliberation.ts",
  },

  /** S0 speed detection */
  speedDetection: "src/s0/isc-evaluator.ts",
} as const;

// ── Speed Types ───────────────────────────────────────────────────

export type TriadSpeed = "fast" | "slow";

export interface SpeedDecision {
  speed: TriadSpeed;
  reason: string;
  triggers: string[];
}

// ── Foundational Triggers (mirrored from s0/isc-evaluator.ts) ────

export const FOUNDATIONAL_PATH_SEGMENTS = [
  "01-Projects/observer-council/architecture/",
  "02-Knowledge/motifs/",
  "02-Knowledge/patterns/",
  "src/s0/",
] as const;

export const FOUNDATIONAL_FILE_PATTERNS = [
  "governance",
  "constitution",
  "sovereignty",
] as const;

export const FOUNDATIONAL_KEYWORDS = [
  "architecture",
  "governance",
  "motif",
  "sovereignty",
  "d/i/r",
  "framework",
] as const;

/** Determine triad speed from task context. */
export function determineSpeed(
  touchedFiles: string[],
  taskDescription: string,
): SpeedDecision {
  const triggers: string[] = [];
  const descLower = taskDescription.toLowerCase();

  for (const file of touchedFiles) {
    for (const segment of FOUNDATIONAL_PATH_SEGMENTS) {
      if (file.includes(segment)) {
        triggers.push(`path: ${segment}`);
      }
    }
    const lower = file.toLowerCase();
    for (const pattern of FOUNDATIONAL_FILE_PATTERNS) {
      if (lower.includes(pattern)) {
        triggers.push(`file: ${pattern}`);
      }
    }
  }

  for (const keyword of FOUNDATIONAL_KEYWORDS) {
    if (descLower.includes(keyword)) {
      triggers.push(`keyword: ${keyword}`);
    }
  }

  // Explicit slow triggers
  for (const term of ["slow", "triad", "full triad", "deep", "oscillate"]) {
    if (descLower.includes(term)) {
      triggers.push(`explicit: ${term}`);
    }
  }

  if (triggers.length > 0) {
    return {
      speed: "slow",
      reason: `Foundational triggers detected: ${triggers.join(", ")}`,
      triggers,
    };
  }

  return {
    speed: "fast",
    reason: "No foundational triggers — routine task",
    triggers: [],
  };
}
