/**
 * S6 — Dispatch Module
 *
 * Parallelisability check, rejection gate, context budgeting, and spawn.
 *
 * DEFAULT RULE: If work can be parallelised, it MUST be.
 * Sequential submission of parallelisable tasks is REJECTED with explanation.
 */

import type { SubAgentTask, ISC } from "../s0/index.ts";
import type {
  ParallelCheckResult,
  ParallelRejection,
  TaskBatch,
  ContextBudget,
} from "./types.ts";

// ---------------------------------------------------------------------------
// Parallelisability Check (ISC #2, #8)
// ---------------------------------------------------------------------------

/**
 * Analyse a set of tasks for parallelisability by checking their dependency
 * graphs. Tasks with no mutual dependencies are independent and MUST be
 * executed in parallel.
 */
export function checkParallelisability(
  tasks: SubAgentTask[],
): ParallelCheckResult {
  if (tasks.length <= 1) {
    return { parallel: false, reason: "Single task — no parallelisation needed." };
  }

  const taskIds = new Set(tasks.map((t) => t.taskId));
  const groups = buildIndependentGroups(tasks, taskIds);

  // Parallel only if any single group contains more than one task.
  // Multiple groups = sequential stages, NOT parallelisable.
  // A group with 2+ tasks = those tasks can run simultaneously.
  const hasParallelGroup = groups.some((g) => g.length > 1);
  if (hasParallelGroup) {
    return { parallel: true, groups };
  }

  return { parallel: false, reason: "All tasks form a strict dependency chain — sequential execution justified." };
}

/**
 * Build groups of tasks that can execute in parallel. Tasks within the same
 * group have no mutual dependencies. Groups themselves are ordered by
 * dependency (group N+1 depends on group N).
 */
function buildIndependentGroups(
  tasks: SubAgentTask[],
  validIds: Set<string>,
): string[][] {
  const remaining = new Map(tasks.map((t) => [t.taskId, t]));
  const completed = new Set<string>();
  const groups: string[][] = [];

  while (remaining.size > 0) {
    const group: string[] = [];

    for (const [taskId, task] of remaining) {
      // A task is ready if all its dependencies are in completed set
      const depsResolved = task.dependencies.every(
        (dep) => !validIds.has(dep) || completed.has(dep),
      );
      if (depsResolved) {
        group.push(taskId);
      }
    }

    if (group.length === 0) {
      // Circular dependency — dump remaining as a single group to avoid infinite loop
      groups.push([...remaining.keys()]);
      break;
    }

    for (const id of group) {
      remaining.delete(id);
      completed.add(id);
    }
    groups.push(group);
  }

  return groups;
}

// ---------------------------------------------------------------------------
// Rejection Gate (ISC #1, #8 — DEFAULT RULE enforcement)
// ---------------------------------------------------------------------------

/**
 * The rejection gate. If tasks are parallelisable but were submitted as
 * sequential (one at a time or in strict order when they have no deps),
 * the orchestrator REJECTS with explanation.
 *
 * Returns null if submission is acceptable, or a ParallelRejection if
 * the caller must resubmit as parallel.
 */
export function enforceDefaultRule(
  tasks: SubAgentTask[],
  requestedMode: "parallel" | "sequential",
): ParallelRejection | null {
  const check = checkParallelisability(tasks);

  if (check.parallel && requestedMode === "sequential") {
    return {
      rejectedTaskIds: tasks.map((t) => t.taskId),
      reason:
        "These tasks have no dependencies and must be executed in parallel. " +
        "Sequential execution of parallelisable work is a policy violation. " +
        "Resubmit as parallel dispatch.",
      independentGroups: check.groups,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Context Budgeting (ISC #6)
// ---------------------------------------------------------------------------

/**
 * Build a scoped context for a sub-agent. The context is limited to what
 * the task needs — NOT the full session transcript, NOT other agents' WIP.
 */
export function buildContextBudget(
  task: SubAgentTask,
  prdContext: string,
  s0Types: string,
  fileContents: Record<string, string>,
): ContextBudget {
  return {
    taskDescription: task.description,
    iscCriteria: task.iscCriteria,
    prdContext,
    s0Types,
    fileContents,
    // fullSessionTranscript: EXCLUDED by design
    // otherAgentsWIP: EXCLUDED by design
  };
}

// ---------------------------------------------------------------------------
// Spawn (batch creation)
// ---------------------------------------------------------------------------

/**
 * Create a dispatch batch after passing the rejection gate and
 * parallelisability check. Returns the batch ready for execution.
 */
export function createBatch(
  batchId: string,
  tasks: SubAgentTask[],
): TaskBatch {
  return {
    batchId,
    tasks,
    submittedAt: Date.now(),
  };
}

/**
 * Full dispatch pipeline: check parallelisability, enforce default rule,
 * create batch. Throws if the default rule is violated.
 */
export function dispatch(
  batchId: string,
  tasks: SubAgentTask[],
  requestedMode: "parallel" | "sequential",
): { batch: TaskBatch; groups: string[][] } | { rejected: ParallelRejection } {
  // Step 1: Parallelisability check (ISC #2)
  const check = checkParallelisability(tasks);

  // Step 2: Rejection gate — DEFAULT RULE enforcement (ISC #1, #8)
  const rejection = enforceDefaultRule(tasks, requestedMode);
  if (rejection) {
    return { rejected: rejection };
  }

  // Step 3: Create batch
  const batch = createBatch(batchId, tasks);
  const groups = check.parallel ? check.groups : [tasks.map((t) => t.taskId)];

  return { batch, groups };
}
