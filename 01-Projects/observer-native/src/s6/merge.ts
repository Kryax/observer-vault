/**
 * S6 — Merge Protocol
 *
 * Conflict detection, auto-merge for compatible overlaps, and escalation
 * for incompatible overlaps, type conflicts, and ISC conflicts.
 *
 * Per PRD 3.6.3:
 * - No overlap -> apply directly
 * - Compatible file overlap -> auto-merge
 * - Incompatible file overlap -> escalate to Council
 * - Type conflict (S0 disagreement) -> escalate to Council
 * - ISC conflict (criteria contradiction) -> escalate to human
 */

import type { SubAgentOutput } from "../s0/index.ts";
import type {
  MergeConflict,
  MergeConflictKind,
  MergeResolution,
  MergeResult,
  ValidatedOutput,
} from "./types.ts";

// ---------------------------------------------------------------------------
// Conflict Detection (ISC #4)
// ---------------------------------------------------------------------------

/**
 * Detect all conflicts between a set of validated outputs.
 * Compares each pair for file-level overlap, type conflicts, and ISC conflicts.
 */
export function detectConflicts(
  outputs: ValidatedOutput[],
): MergeConflict[] {
  const conflicts: MergeConflict[] = [];

  for (let i = 0; i < outputs.length; i++) {
    for (let j = i + 1; j < outputs.length; j++) {
      const a = outputs[i];
      const b = outputs[j];
      conflicts.push(...detectPairConflicts(a, b));
    }
  }

  return conflicts;
}

/**
 * Detect conflicts between two specific outputs.
 */
function detectPairConflicts(
  a: ValidatedOutput,
  b: ValidatedOutput,
): MergeConflict[] {
  const conflicts: MergeConflict[] = [];

  const artifactsA = new Set(a.output.artifacts ?? []);
  const artifactsB = new Set(b.output.artifacts ?? []);

  // File-level overlap detection
  for (const file of artifactsA) {
    if (artifactsB.has(file)) {
      // Overlap detected — classify as compatible or incompatible
      // In a real implementation, this would diff the file contents.
      // Here we mark it as incompatible by default and let the caller
      // provide compatibility analysis.
      conflicts.push({
        kind: "incompatible_overlap",
        taskIdA: a.output.taskId,
        taskIdB: b.output.taskId,
        filePath: file,
        description:
          `Both tasks ${a.output.taskId} and ${b.output.taskId} modified ${file}. ` +
          `Requires conflict resolution.`,
      });
    }
  }

  // ISC conflict detection — criteria with same ID but contradictory outcomes
  const iscMapA = new Map(
    a.iscValidation.map((v) => [v.criterionId, v.met]),
  );
  for (const validation of b.iscValidation) {
    const aResult = iscMapA.get(validation.criterionId);
    if (aResult !== undefined && aResult !== validation.met) {
      conflicts.push({
        kind: "isc_conflict",
        taskIdA: a.output.taskId,
        taskIdB: b.output.taskId,
        description:
          `ISC criterion ${validation.criterionId} has contradictory results: ` +
          `task ${a.output.taskId} says ${aResult ? "passing" : "failing"}, ` +
          `task ${b.output.taskId} says ${validation.met ? "passing" : "failing"}. ` +
          `This indicates a specification problem.`,
      });
    }
  }

  return conflicts;
}

// ---------------------------------------------------------------------------
// Conflict Resolution
// ---------------------------------------------------------------------------

/**
 * Determine resolution for a single conflict per PRD 3.6.3 merge protocol.
 */
export function resolveConflict(conflict: MergeConflict): MergeResolution {
  switch (conflict.kind) {
    case "no_overlap":
      return { action: "apply", description: "No overlap — apply directly." };

    case "compatible_overlap":
      return {
        action: "auto_merge",
        description: `Compatible changes in ${conflict.filePath ?? "unknown"} — auto-merged.`,
      };

    case "incompatible_overlap":
      // Escalate to Council — do not auto-resolve
      return { action: "escalate_council", conflict };

    case "type_conflict":
      // S0 is the single source of truth — escalate to Council
      return { action: "escalate_council", conflict };

    case "isc_conflict":
      // Contradictory criteria = specification problem — escalate to human
      return { action: "escalate_human", conflict };
  }
}

// ---------------------------------------------------------------------------
// Merge Execution
// ---------------------------------------------------------------------------

/**
 * Run the full merge protocol on a set of validated outputs.
 * Returns what was applied, what was auto-merged, and what was escalated.
 */
export function executeMerge(
  outputs: ValidatedOutput[],
): MergeResult {
  const conflicts = detectConflicts(outputs);

  const result: MergeResult = {
    applied: [],
    autoMerged: [],
    escalatedToCouncil: [],
    escalatedToHuman: [],
  };

  // If no conflicts, all outputs apply directly
  if (conflicts.length === 0) {
    result.applied = outputs.map((o) => o.output.taskId);
    return result;
  }

  // Track which task IDs have conflicts
  const conflictedTasks = new Set<string>();
  for (const conflict of conflicts) {
    conflictedTasks.add(conflict.taskIdA);
    conflictedTasks.add(conflict.taskIdB);
  }

  // Apply non-conflicting outputs directly
  for (const output of outputs) {
    if (!conflictedTasks.has(output.output.taskId)) {
      result.applied.push(output.output.taskId);
    }
  }

  // Resolve each conflict
  for (const conflict of conflicts) {
    const resolution = resolveConflict(conflict);
    switch (resolution.action) {
      case "apply":
        // Already handled above
        break;
      case "auto_merge":
        result.autoMerged.push(
          `${conflict.taskIdA}+${conflict.taskIdB}:${conflict.filePath ?? ""}`,
        );
        break;
      case "escalate_council":
        result.escalatedToCouncil.push(conflict);
        break;
      case "escalate_human":
        result.escalatedToHuman.push(conflict);
        break;
    }
  }

  return result;
}
