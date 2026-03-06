/**
 * S6 — Retry Policy
 *
 * Maximum 3 retries per task, then Council escalation, then human escalation.
 * Also detects systemic batch failure (>50% failing).
 *
 * Per PRD 3.6.4:
 * - 1st retry: same context, failure evidence appended
 * - 2nd retry: expanded context (include related slice outputs)
 * - 3rd retry: escalate to Council with full diagnosis
 * - Council cannot resolve: escalate to human (S7)
 */

import type { SubAgentTask, TaskFailureEscalation } from "../s0/index.ts";
import type {
  RetryState,
  RetryDecision,
  RetryEscalationTarget,
  EscalationTrigger,
  BatchResult,
} from "./types.ts";

/** Default maximum retries per PRD 3.6.4. */
export const DEFAULT_MAX_RETRIES = 3;

/** Systemic batch failure threshold per PRD 3.6.5. */
export const SYSTEMIC_FAILURE_THRESHOLD = 0.5;

// ---------------------------------------------------------------------------
// Retry State Management
// ---------------------------------------------------------------------------

/**
 * Create initial retry state for a task.
 */
export function createRetryState(task: SubAgentTask): RetryState {
  return {
    taskId: task.taskId,
    retriesAttempted: 0,
    maxRetries: Math.min(task.retryBudget, DEFAULT_MAX_RETRIES),
    failureHistory: [],
    escalated: false,
  };
}

/**
 * Record a failure in the retry state.
 */
export function recordFailure(
  state: RetryState,
  error: string,
): RetryState {
  return {
    ...state,
    retriesAttempted: state.retriesAttempted + 1,
    failureHistory: [
      ...state.failureHistory,
      {
        attempt: state.retriesAttempted + 1,
        error,
        timestamp: Date.now(),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Retry Decision (ISC #5, #7)
// ---------------------------------------------------------------------------

/**
 * Determine the next action for a failed task based on retry policy.
 *
 * - Retry 1: same context, failure evidence appended
 * - Retry 2: expanded context (include related slice outputs)
 * - Retry 3 (budget exhausted): escalate to Council
 */
export function decideRetry(
  state: RetryState,
  taskSource: string,
): RetryDecision {
  if (state.retriesAttempted < state.maxRetries) {
    // Retries 1-2: retry with progressively expanded context
    const expandedContext = state.retriesAttempted >= 1; // 2nd+ retry gets expanded context
    return {
      action: "retry",
      attempt: state.retriesAttempted + 1,
      expandedContext,
    };
  }

  // Budget exhausted — escalate to Council (ISC #5, #7)
  const failureEvidence = state.failureHistory
    .map((f) => `Attempt ${f.attempt}: ${f.error}`)
    .join("\n");

  const escalation: TaskFailureEscalation = {
    type: "TASK_FAILURE",
    source: taskSource,
    failureEvidence,
    retryCount: state.retriesAttempted,
    structuralDiagnosis: "missing_info", // default — Council will reclassify
    impact: `Task ${state.taskId} failed after ${state.retriesAttempted} retries. Blocking downstream work.`,
  };

  return {
    action: "escalate",
    target: "council",
    escalation,
  };
}

/**
 * Escalate from Council to human when Council cannot resolve.
 */
export function escalateToHuman(
  state: RetryState,
  councilDiagnosis: string,
): RetryDecision {
  const failureEvidence = state.failureHistory
    .map((f) => `Attempt ${f.attempt}: ${f.error}`)
    .join("\n");

  const escalation: TaskFailureEscalation = {
    type: "TASK_FAILURE",
    source: `Council re-entry for ${state.taskId}`,
    failureEvidence: `${failureEvidence}\n\nCouncil diagnosis: ${councilDiagnosis}`,
    retryCount: state.retriesAttempted,
    structuralDiagnosis: "conflicting_constraints",
    impact: `Task ${state.taskId} unresolvable by Council. Requires human intervention.`,
  };

  return {
    action: "escalate",
    target: "human",
    escalation,
  };
}

// ---------------------------------------------------------------------------
// Escalation Triggers (ISC #7)
// ---------------------------------------------------------------------------

/**
 * Check for escalation triggers on a batch result.
 * Returns all applicable triggers.
 */
export function checkEscalationTriggers(
  batchResult: BatchResult,
  retryStates: Map<string, RetryState>,
): EscalationTrigger[] {
  const triggers: EscalationTrigger[] = [];

  // Trigger: retry exhaustion for any task
  for (const [taskId, state] of retryStates) {
    if (state.retriesAttempted >= state.maxRetries && !state.escalated) {
      triggers.push({
        kind: "retry_exhaustion",
        taskId,
        retryState: state,
      });
    }
  }

  // Trigger: systemic batch failure (>50% failing)
  const failureCount = batchResult.failing.length + batchResult.timedOut.length;
  const failureRate = failureCount / batchResult.totalTasks;
  if (failureRate > SYSTEMIC_FAILURE_THRESHOLD) {
    triggers.push({
      kind: "systemic_batch_failure",
      batchId: batchResult.batchId,
      failureRate,
      threshold: SYSTEMIC_FAILURE_THRESHOLD,
    });
  }

  return triggers;
}
