/**
 * S5 — ISC and PRD Pipeline
 *
 * The specification-to-execution pipeline. How problems become PRDs,
 * how PRDs decompose into slices, and how slices fan out to sub-agents.
 */

// Types
export type {
  ProblemInput,
  PRDCreationResult,
  DependencyEdge,
  DependencyGraph,
  SliceDecompositionResult,
  FanOutPackage,
  FileModification,
  MergeConflict,
  MergeCheckResult,
  MotifCriterion,
  MotifApplicationResult,
  AxisCoverageResult,
} from "./types.ts";

export { PRD_STATUS_TRANSITIONS } from "./types.ts";

// PRD Creation (3.5.1)
export {
  createPRD,
  transitionPRDStatus,
  hasPassedHumanReview,
} from "./prd-creation.ts";

// Slice Decomposition (3.5.2, 3.5.3)
export {
  buildDependencyGraph,
  decomposeSlices,
  identifyParallelGroups,
} from "./slice-decomposition.ts";

// Fan-Out (3.5.4)
export {
  packageSliceAsTask,
  packageFanOut,
  validateFanOutPackage,
} from "./fan-out.ts";

// Merge and Integration (3.5.5)
export {
  detectConflicts,
  collectModifications,
  allOutputsPassing,
  mergeCheckGate,
} from "./merge.ts";

// Motif Application Protocol (3.5.6)
export {
  applyMotifLens,
  applyMotifs,
  checkAxisCoverage,
  formatMotifCriterion,
} from "./motif-application.ts";
