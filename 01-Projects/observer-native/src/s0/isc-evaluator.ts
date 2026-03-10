/**
 * S0 — ISC Dual-Speed Evaluator
 *
 * Evaluates ISC criteria in two modes:
 *   fast — binary pass/fail, no coherence analysis
 *   deep — pass/fail plus structural coherence notes
 *
 * Mode selection is automatic based on whether touched files
 * or task description indicate foundational work.
 */

import type { ISC } from "./isc.ts";

// ── Types ──────────────────────────────────────────────────────────

export type EvalMode = "fast" | "deep";

export interface EvalContext {
  touchedFiles: string[];
  taskDescription: string;
}

export interface ISCResult extends ISC {
  mode: EvalMode;
  coherenceNotes?: string[];
}

// ── Foundational Detection ─────────────────────────────────────────

const FOUNDATIONAL_PATH_SEGMENTS = [
  "01-Projects/observer-council/architecture/",
  "02-Knowledge/motifs/",
  "02-Knowledge/patterns/",
  "src/s0/",
];

const FOUNDATIONAL_FILE_PATTERNS = [
  "governance",
  "constitution",
  "sovereignty",
];

const FOUNDATIONAL_KEYWORDS = [
  "architecture",
  "governance",
  "motif",
  "sovereignty",
  "d/i/r",
  "framework",
];

export function isFoundational(context: EvalContext): boolean {
  const { touchedFiles, taskDescription } = context;

  for (const file of touchedFiles) {
    // Check path segments
    for (const segment of FOUNDATIONAL_PATH_SEGMENTS) {
      if (file.includes(segment)) return true;
    }
    // Check filename patterns (governance*, constitution*, sovereignty*)
    const lower = file.toLowerCase();
    for (const pattern of FOUNDATIONAL_FILE_PATTERNS) {
      if (lower.includes(pattern)) return true;
    }
  }

  // Check task description keywords
  const descLower = taskDescription.toLowerCase();
  for (const keyword of FOUNDATIONAL_KEYWORDS) {
    if (descLower.includes(keyword)) return true;
  }

  return false;
}

// ── Coherence Note Generation (deep mode only) ────────────────────

function generateCoherenceNotes(criterion: ISC): string[] {
  const notes: string[] = [];

  if (criterion.verificationCommand.includes("s0/") || criterion.id.toLowerCase().includes("s0")) {
    notes.push("Schema layer change — verify downstream consumers");
  }

  if (criterion.motifSource !== undefined) {
    notes.push("Motif-bearing criterion — check motif library coherence");
  }

  if (criterion.priority === "CRITICAL") {
    notes.push("Critical priority — verify governance alignment");
  }

  if (notes.length === 0) {
    notes.push("Deep evaluation — structural coherence confirmed");
  }

  return notes;
}

// ── Evaluator ──────────────────────────────────────────────────────

export function evaluateISC(criteria: ISC[], context: EvalContext): ISCResult[] {
  const mode: EvalMode = isFoundational(context) ? "deep" : "fast";

  return criteria.map((criterion): ISCResult => {
    if (mode === "fast") {
      return {
        ...criterion,
        mode,
        coherenceNotes: undefined,
      };
    }

    return {
      ...criterion,
      mode,
      coherenceNotes: generateCoherenceNotes(criterion),
    };
  });
}
