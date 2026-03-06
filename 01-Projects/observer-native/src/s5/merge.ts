/**
 * S5 — Merge and Integration (PRD 3.5.5)
 *
 * How slice outputs are combined:
 * 1. Collect sub-agent outputs
 * 2. Conflict check — detect overlapping file modifications
 * 3. Merge — apply non-conflicting outputs
 * 4. Conflict resolution — conflicting outputs escalate
 * 5. Integration test — run integration ISC against merged output
 */

import type { SubAgentOutput } from "../s0/sub-agent.ts";
import type {
  FileModification,
  MergeConflict,
  MergeCheckResult,
} from "./types.ts";

/**
 * Detect overlapping file modifications across sub-agent outputs.
 * A conflict occurs when two or more tasks modify the same file.
 *
 * ISC Criterion 5: Merge process detects overlapping modifications before applying
 */
export function detectConflicts(
  modifications: FileModification[],
): MergeCheckResult {
  const byFile = new Map<string, FileModification[]>();

  for (const mod of modifications) {
    const existing = byFile.get(mod.filePath) ?? [];
    existing.push(mod);
    byFile.set(mod.filePath, existing);
  }

  const conflicts: MergeConflict[] = [];
  const safeModifications: FileModification[] = [];

  for (const [filePath, mods] of byFile) {
    if (mods.length > 1) {
      // Multiple tasks touching the same file is a conflict
      conflicts.push({
        filePath,
        conflictingTasks: mods.map((m) => m.taskId),
        operations: mods,
      });
    } else {
      safeModifications.push(mods[0]!);
    }
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
    safeModifications,
  };
}

/**
 * Collect file modifications from sub-agent outputs.
 * Maps artifacts (file paths) from each output to FileModification records.
 */
export function collectModifications(
  outputs: SubAgentOutput[],
  operationMap: Record<string, "create" | "modify" | "delete">,
): FileModification[] {
  const modifications: FileModification[] = [];

  for (const output of outputs) {
    if (!output.artifacts) continue;

    for (const filePath of output.artifacts) {
      modifications.push({
        taskId: output.taskId,
        filePath,
        operation: operationMap[filePath] ?? "modify",
      });
    }
  }

  return modifications;
}

/**
 * Check whether all sub-agent outputs passed before attempting merge.
 */
export function allOutputsPassing(outputs: SubAgentOutput[]): boolean {
  return outputs.every((o) => o.result === "PASSING");
}

/**
 * Merge check gate: detects conflicts BEFORE applying any changes.
 * Returns the full check result including safe and conflicting modifications.
 *
 * ISC Criterion 5: Merge process detects overlapping modifications before applying
 */
export function mergeCheckGate(
  outputs: SubAgentOutput[],
  operationMap: Record<string, "create" | "modify" | "delete">,
): MergeCheckResult {
  const modifications = collectModifications(outputs, operationMap);
  return detectConflicts(modifications);
}
