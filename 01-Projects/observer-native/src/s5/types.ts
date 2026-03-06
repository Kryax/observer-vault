/**
 * S5 — ISC and PRD Pipeline Types
 *
 * S5-specific types for the specification-to-execution pipeline.
 * Cross-component types come from S0.
 */

import type { ISC } from "../s0/isc.ts";
import type { PRD, PRDStatus, Slice } from "../s0/prd.ts";
import type { MotifReference, MotifAxis } from "../s0/motif.ts";
import type { SubAgentTask } from "../s0/sub-agent.ts";

// --- PRD Creation ---

export interface ProblemInput {
  intent: string;
  context: string;
  constraints: string[];
}

export interface PRDCreationResult {
  prd: PRD;
  requiresHumanReview: true;
}

// --- Slice Decomposition ---

export interface DependencyEdge {
  from: string;
  to: string;
}

export interface DependencyGraph {
  slices: Slice[];
  edges: DependencyEdge[];
  topologicalOrder: string[];
}

export interface SliceDecompositionResult {
  graph: DependencyGraph;
  fanOutReady: boolean;
}

// --- Fan-Out ---

export interface FanOutPackage {
  tasks: SubAgentTask[];
  dependencyOrder: string[];
}

// --- Merge ---

export interface FileModification {
  taskId: string;
  filePath: string;
  operation: "create" | "modify" | "delete";
}

export interface MergeConflict {
  filePath: string;
  conflictingTasks: string[];
  operations: FileModification[];
}

export interface MergeCheckResult {
  hasConflicts: boolean;
  conflicts: MergeConflict[];
  safeModifications: FileModification[];
}

// --- Motif Application ---

export interface MotifCriterion {
  criterion: ISC;
  motifTag: string;
}

export interface MotifApplicationResult {
  criteria: MotifCriterion[];
  motifTags: string[];
}

export interface AxisCoverageResult {
  hasRecurseAxis: boolean;
  axes: Record<MotifAxis, number>;
  flagged: boolean;
  message: string;
}

// --- PRD Lifecycle ---

export const PRD_STATUS_TRANSITIONS: Record<PRDStatus, PRDStatus[]> = {
  DRAFT: ["CRITERIA_DEFINED"],
  CRITERIA_DEFINED: ["PLANNED"],
  PLANNED: ["IN_PROGRESS"],
  IN_PROGRESS: ["VERIFYING", "BLOCKED"],
  VERIFYING: ["COMPLETE", "FAILED", "IN_PROGRESS"],
  COMPLETE: [],
  FAILED: ["IN_PROGRESS"],
  BLOCKED: ["IN_PROGRESS"],
};

export type {
  ISC,
  PRD,
  PRDStatus,
  Slice,
  MotifReference,
  MotifAxis,
  SubAgentTask,
};
