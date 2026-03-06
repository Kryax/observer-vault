/**
 * S3 — Cognitive Skills
 *
 * The three triad skills as Observer-native components:
 *   Oscillate (differentiate) -> Converge (integrate) -> Reflect (recurse)
 *
 * Closed loop: Reflect output feeds next Oscillate as seed material.
 */

export { oscillateAndGenerate } from "./oscillate.ts";
export { convergeAndEvaluate } from "./converge.ts";
export { reflect } from "./reflect.ts";

export type {
  // Oscillate types
  LensAssignment,
  Framing,
  IndependenceCheckResult,
  PairwiseComparison,
  OscillateOutput,
  OscillateInput,
  // Converge types
  KillListEntry,
  ConvergenceResult,
  ConvergeInput,
  // Reflect types
  Op5Recognition,
  Op6MotifExtraction,
  Op7MotifOfMotif,
  Op8Output,
  Op8Gate,
  AxisBalanceReport,
  MotifCandidate,
  MetaMotifCandidate,
  SeedMaterial,
  ReflectOutput,
  ReflectInput,
} from "./types.ts";
