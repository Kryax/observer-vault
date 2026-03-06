/**
 * S6 — Collection and Validation Module
 *
 * Waits for sub-agent outputs, validates each against its ISC exit criteria,
 * classifies results, and produces aggregate batch status.
 */

import type { SubAgentTask, SubAgentOutput, ISC } from "../s0/index.ts";
import type {
  ValidatedOutput,
  OutputClassification,
  BatchResult,
  TaskBatch,
} from "./types.ts";

// ---------------------------------------------------------------------------
// ISC Validation (ISC #3)
// ---------------------------------------------------------------------------

/**
 * Validate a single sub-agent output against its ISC exit criteria.
 * Each criterion is checked against the output's iscResults array.
 */
export function validateAgainstISC(
  output: SubAgentOutput,
  criteria: ISC[],
): ValidatedOutput {
  const iscValidation = criteria.map((criterion) => {
    const result = output.iscResults.find(
      (r) => r.criterionId === criterion.id,
    );
    return {
      criterionId: criterion.id,
      met: result?.passed ?? false,
      evidence: result?.evidence,
    };
  });

  // Classification: all met = PASSING, timed out stays TIMED_OUT, else FAILING
  let classification: OutputClassification;
  if (output.result === "TIMED_OUT") {
    classification = "TIMED_OUT";
  } else if (iscValidation.every((v) => v.met)) {
    classification = "PASSING";
  } else {
    classification = "FAILING";
  }

  return {
    output,
    classification,
    iscValidation,
  };
}

// ---------------------------------------------------------------------------
// Batch Collection
// ---------------------------------------------------------------------------

/**
 * Collect and validate all sub-agent outputs for a batch.
 * Each output is validated against the ISC from its originating task.
 */
export function collectBatch(
  batch: TaskBatch,
  outputs: SubAgentOutput[],
): BatchResult {
  const taskMap = new Map(batch.tasks.map((t) => [t.taskId, t]));

  const validated: ValidatedOutput[] = outputs.map((output) => {
    const task = taskMap.get(output.taskId);
    const criteria = task?.iscCriteria ?? [];
    return validateAgainstISC(output, criteria);
  });

  // Check for tasks that never reported (treat as TIMED_OUT)
  const reportedIds = new Set(outputs.map((o) => o.taskId));
  for (const task of batch.tasks) {
    if (!reportedIds.has(task.taskId)) {
      validated.push({
        output: {
          taskId: task.taskId,
          result: "TIMED_OUT",
          iscResults: [],
          error: "Sub-agent did not report output within batch collection window.",
        },
        classification: "TIMED_OUT",
        iscValidation: task.iscCriteria.map((c) => ({
          criterionId: c.id,
          met: false,
          evidence: "No output received.",
        })),
      });
    }
  }

  const passing = validated.filter((v) => v.classification === "PASSING");
  const failing = validated.filter((v) => v.classification === "FAILING");
  const timedOut = validated.filter((v) => v.classification === "TIMED_OUT");

  return {
    batchId: batch.batchId,
    passing,
    failing,
    timedOut,
    totalTasks: batch.tasks.length,
    completedAt: Date.now(),
  };
}

/**
 * Report aggregate status for a batch result.
 */
export function reportBatchStatus(result: BatchResult): string {
  return (
    `Batch ${result.batchId}: ` +
    `${result.passing.length} passing, ` +
    `${result.failing.length} failing, ` +
    `${result.timedOut.length} timed out ` +
    `(${result.totalTasks} total)`
  );
}
