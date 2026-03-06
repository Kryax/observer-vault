/**
 * S5 — Slice Decomposition (PRD 3.5.2, 3.5.3)
 *
 * How a PRD is broken into parallel build slices:
 * 1. Dependency analysis — identify independent criteria
 * 2. Slice grouping — group into slices (one concern per slice)
 * 3. Dependency graph — order slices by dependency
 * 4. ISC assignment — each slice carries its own exit criteria
 * 5. Fan-out readiness — check all slices are packagable
 */

import type { Slice } from "../s0/prd.ts";
import type { ISC } from "../s0/isc.ts";
import type {
  DependencyEdge,
  DependencyGraph,
  SliceDecompositionResult,
} from "./types.ts";

/**
 * Build a dependency graph from slices.
 * Implements the Slice Dependency Graph Pattern (PRD 3.5.3):
 *   Foundation -> Parallel group -> Integration -> Smoke test
 *
 * ISC Criterion 2: Slice decomposition produces dependency graph before fan-out
 * ISC Criterion 3: Each slice carries its own ISC exit criteria as acceptance tests
 */
export function buildDependencyGraph(slices: Slice[]): DependencyGraph {
  const edges: DependencyEdge[] = [];

  for (const slice of slices) {
    for (const dep of slice.dependencies) {
      edges.push({ from: dep, to: slice.id });
    }
  }

  const topologicalOrder = topologicalSort(slices, edges);

  return {
    slices,
    edges,
    topologicalOrder,
  };
}

/**
 * Topological sort of slices respecting dependency edges.
 * Throws if a cycle is detected.
 */
function topologicalSort(
  slices: Slice[],
  edges: DependencyEdge[],
): string[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const slice of slices) {
    inDegree.set(slice.id, 0);
    adjacency.set(slice.id, []);
  }

  for (const edge of edges) {
    const current = inDegree.get(edge.to) ?? 0;
    inDegree.set(edge.to, current + 1);
    const adj = adjacency.get(edge.from) ?? [];
    adj.push(edge.to);
    adjacency.set(edge.from, adj);
  }

  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) {
      queue.push(id);
    }
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    for (const neighbor of adjacency.get(current) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  if (sorted.length !== slices.length) {
    throw new Error(
      "Cycle detected in slice dependency graph. " +
      `Sorted ${sorted.length} of ${slices.length} slices.`,
    );
  }

  return sorted;
}

/**
 * Decompose a set of slices into a dependency graph and check fan-out readiness.
 *
 * ISC Criterion 2: Slice decomposition produces dependency graph before fan-out
 * ISC Criterion 3: Each slice carries its own ISC exit criteria as acceptance tests
 */
export function decomposeSlices(slices: Slice[]): SliceDecompositionResult {
  // Validate each slice carries its own ISC criteria
  const allHaveCriteria = slices.every(
    (s) => s.iscCriteria.length > 0,
  );

  const graph = buildDependencyGraph(slices);

  return {
    graph,
    fanOutReady: allHaveCriteria && graph.topologicalOrder.length === slices.length,
  };
}

/**
 * Identify which slices can run in parallel (no mutual dependencies).
 * Returns groups of slice IDs that can execute concurrently.
 */
export function identifyParallelGroups(graph: DependencyGraph): string[][] {
  const groups: string[][] = [];
  const completed = new Set<string>();

  while (completed.size < graph.slices.length) {
    const ready: string[] = [];
    for (const sliceId of graph.topologicalOrder) {
      if (completed.has(sliceId)) continue;

      const slice = graph.slices.find((s) => s.id === sliceId);
      if (!slice) continue;

      const depsReady = slice.dependencies.every((d) => completed.has(d));
      if (depsReady) {
        ready.push(sliceId);
      }
    }

    if (ready.length === 0) break;

    groups.push(ready);
    for (const id of ready) {
      completed.add(id);
    }
  }

  return groups;
}
