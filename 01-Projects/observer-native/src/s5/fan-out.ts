/**
 * S5 — Fan-Out (PRD 3.5.4)
 *
 * Packages slices as SubAgentTask per S0 schema for dispatch to sub-agents.
 * Each sub-agent receives: slice PRD, ISC exit criteria, context.
 * Slice closes ONLY when its ISC criteria pass.
 */

import type { Slice } from "../s0/prd.ts";
import type { SubAgentTask } from "../s0/sub-agent.ts";
import type { DependencyGraph, FanOutPackage } from "./types.ts";

/**
 * Package a single slice as a SubAgentTask per S0 schema.
 *
 * ISC Criterion 4: Fan-out packages slices as Sub-Agent Tasks per S0 schema
 */
export function packageSliceAsTask(
  slice: Slice,
  context: string,
  options?: { timeout?: number; retryBudget?: number },
): SubAgentTask {
  return {
    taskId: `task-${slice.id}`,
    sliceId: slice.id,
    description: slice.description,
    context,
    iscCriteria: slice.iscCriteria,
    dependencies: slice.dependencies,
    timeout: options?.timeout ?? 600_000,
    retryBudget: options?.retryBudget ?? 3,
  };
}

/**
 * Package all slices from a dependency graph as a FanOutPackage.
 * Tasks are ordered by the topological sort from the dependency graph.
 *
 * ISC Criterion 4: Fan-out packages slices as Sub-Agent Tasks per S0 schema
 */
export function packageFanOut(
  graph: DependencyGraph,
  contextPerSlice: Record<string, string>,
  options?: { timeout?: number; retryBudget?: number },
): FanOutPackage {
  const tasks: SubAgentTask[] = [];

  for (const sliceId of graph.topologicalOrder) {
    const slice = graph.slices.find((s) => s.id === sliceId);
    if (!slice) {
      throw new Error(`Slice ${sliceId} in topological order but not in graph`);
    }

    const context = contextPerSlice[sliceId];
    if (context === undefined) {
      throw new Error(`No context provided for slice ${sliceId}`);
    }

    tasks.push(packageSliceAsTask(slice, context, options));
  }

  return {
    tasks,
    dependencyOrder: graph.topologicalOrder,
  };
}

/**
 * Validate that a FanOutPackage conforms to S0 SubAgentTask schema.
 * Every task must have: taskId, sliceId, description, context, iscCriteria, dependencies.
 */
export function validateFanOutPackage(pkg: FanOutPackage): boolean {
  return pkg.tasks.every((task) =>
    task.taskId.length > 0 &&
    task.sliceId.length > 0 &&
    task.description.length > 0 &&
    task.context.length > 0 &&
    task.iscCriteria.length > 0 &&
    Array.isArray(task.dependencies) &&
    task.timeout > 0 &&
    task.retryBudget >= 0
  );
}
