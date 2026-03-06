/**
 * S6 — Sub-Agent Orchestration
 *
 * Makes parallelism work. Manages dispatch, collection, merge, retry,
 * and escalation for sub-agent work.
 *
 * DEFAULT RULE: If work can be parallelised, it MUST be.
 * The orchestrator REJECTS sequential execution of parallelisable work.
 */

// Types
export type {
  ParallelRejection,
  ParallelCheckResult,
  DispatchMode,
  TaskBatch,
  ContextBudget,
  OutputClassification,
  ValidatedOutput,
  BatchResult,
  MergeConflictKind,
  MergeConflict,
  MergeResolution,
  MergeResult,
  RetryState,
  RetryEscalationTarget,
  RetryDecision,
  EscalationTrigger,
} from "./types.ts";

// Dispatch
export {
  checkParallelisability,
  enforceDefaultRule,
  buildContextBudget,
  createBatch,
  dispatch,
} from "./dispatch.ts";

// Collection
export {
  validateAgainstISC,
  collectBatch,
  reportBatchStatus,
} from "./collection.ts";

// Merge
export {
  detectConflicts,
  resolveConflict,
  executeMerge,
} from "./merge.ts";

// Retry
export {
  DEFAULT_MAX_RETRIES,
  SYSTEMIC_FAILURE_THRESHOLD,
  createRetryState,
  recordFailure,
  decideRetry,
  escalateToHuman,
  checkEscalationTriggers,
} from "./retry.ts";
