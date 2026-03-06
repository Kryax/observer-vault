/**
 * S6 — Sub-Agent Orchestration Types
 *
 * Types specific to the orchestration layer: batch management,
 * merge conflict detection, retry state, context budgets, and
 * escalation triggers.
 */

import type {
  SubAgentTask,
  SubAgentOutput,
  SubAgentResult,
  ISC,
  TaskFailureEscalation,
  StructuralDiagnosis,
} from "../s0/index.ts";

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

/** Why a sequential submission was rejected. */
export interface ParallelRejection {
  rejectedTaskIds: string[];
  reason: string;
  independentGroups: string[][];
}

/** Result of the parallelisability check. */
export type ParallelCheckResult =
  | { parallel: true; groups: string[][] }
  | { parallel: false; reason: string };

/** Execution mode after dispatch analysis. */
export type DispatchMode = "parallel" | "sequential";

/** A batch of tasks submitted together. */
export interface TaskBatch {
  batchId: string;
  tasks: SubAgentTask[];
  submittedAt: number;
}

// ---------------------------------------------------------------------------
// Context Budgeting
// ---------------------------------------------------------------------------

/**
 * The scoped context a sub-agent receives. Explicitly excludes full session
 * transcript and other agents' work-in-progress.
 */
export interface ContextBudget {
  taskDescription: string;
  iscCriteria: ISC[];
  prdContext: string;
  s0Types: string;
  fileContents: Record<string, string>;
  // Explicitly NOT included:
  // - fullSessionTranscript
  // - otherAgentsWIP
}

// ---------------------------------------------------------------------------
// Collection
// ---------------------------------------------------------------------------

/** Classification of a single sub-agent's output. */
export type OutputClassification = SubAgentResult; // "PASSING" | "FAILING" | "TIMED_OUT"

/** Validated output with classification. */
export interface ValidatedOutput {
  output: SubAgentOutput;
  classification: OutputClassification;
  iscValidation: Array<{
    criterionId: string;
    met: boolean;
    evidence?: string;
  }>;
}

/** Aggregate status for a completed batch. */
export interface BatchResult {
  batchId: string;
  passing: ValidatedOutput[];
  failing: ValidatedOutput[];
  timedOut: ValidatedOutput[];
  totalTasks: number;
  completedAt: number;
}

// ---------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------

/** Types of merge conflict per PRD 3.6.3. */
export type MergeConflictKind =
  | "no_overlap"
  | "compatible_overlap"
  | "incompatible_overlap"
  | "type_conflict"
  | "isc_conflict";

/** A detected merge conflict between two sub-agent outputs. */
export interface MergeConflict {
  kind: MergeConflictKind;
  taskIdA: string;
  taskIdB: string;
  filePath?: string;
  description: string;
}

/** Resolution action for a conflict. */
export type MergeResolution =
  | { action: "apply"; description: string }
  | { action: "auto_merge"; description: string }
  | { action: "escalate_council"; conflict: MergeConflict }
  | { action: "escalate_human"; conflict: MergeConflict };

/** Result of running the merge protocol on a batch. */
export interface MergeResult {
  applied: string[];
  autoMerged: string[];
  escalatedToCouncil: MergeConflict[];
  escalatedToHuman: MergeConflict[];
}

// ---------------------------------------------------------------------------
// Retry
// ---------------------------------------------------------------------------

/** Retry state tracking for a single sub-agent task. */
export interface RetryState {
  taskId: string;
  retriesAttempted: number;
  maxRetries: number;
  failureHistory: Array<{
    attempt: number;
    error: string;
    timestamp: number;
  }>;
  escalated: boolean;
}

/** Where the retry policy decided to escalate. */
export type RetryEscalationTarget = "council" | "human";

/** Result of a retry policy decision. */
export type RetryDecision =
  | { action: "retry"; attempt: number; expandedContext: boolean }
  | { action: "escalate"; target: RetryEscalationTarget; escalation: TaskFailureEscalation };

// ---------------------------------------------------------------------------
// Escalation Triggers (PRD 3.6.5)
// ---------------------------------------------------------------------------

/** Conditions that trigger escalation from S6. */
export type EscalationTrigger =
  | { kind: "retry_exhaustion"; taskId: string; retryState: RetryState }
  | { kind: "merge_conflict"; conflict: MergeConflict }
  | { kind: "systemic_batch_failure"; batchId: string; failureRate: number; threshold: number };
