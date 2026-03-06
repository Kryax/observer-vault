/**
 * S3 — Cognitive Skills Types
 *
 * Types specific to the cognitive triad: Oscillate, Converge, Reflect.
 * Imports foundation types from S0.
 */

import type { MotifAxis, MotifReference } from "../s0/index.ts";

// ---------------------------------------------------------------------------
// Oscillate types
// ---------------------------------------------------------------------------

/** A lens assignment given to a Perspective Agent during Oscillate. */
export interface LensAssignment {
  perspectiveId: string;
  domain: string;
  stakeholder: string;
  timeHorizon: string;
  abstractionLevel: string;
}

/** Output from a single Perspective Agent. */
export interface Framing {
  perspectiveId: string;
  lens: LensAssignment;
  content: string;
  foundationalAssumptions: string[];
}

/** Result of comparing foundational assumptions across agent pairs. */
export interface IndependenceCheckResult {
  pairwiseComparisons: PairwiseComparison[];
  overallScore: number; // 0.0 (identical) to 1.0 (fully independent)
  redundancyFlags: string[];
}

export interface PairwiseComparison {
  agentA: string;
  agentB: string;
  sharedAssumptions: string[];
  independenceScore: number;
}

/** Full output from OscillateAndGenerate. */
export interface OscillateOutput {
  framings: Framing[]; // 2-4 framing documents
  independenceCheck: IndependenceCheckResult;
  agentCount: number;
}

/** Input to OscillateAndGenerate. */
export interface OscillateInput {
  problemStatement: string;
  lensAssignments: LensAssignment[]; // 2-4 lenses
  seedMaterial: ReflectOutput | null; // from prior Reflect (closed loop)
}

// ---------------------------------------------------------------------------
// Converge types
// ---------------------------------------------------------------------------

/** An item killed during convergence with reasoning. */
export interface KillListEntry {
  item: string;
  source: string; // which framing(s) it came from
  reason: string; // why it was killed
}

/** Output from ConvergeAndEvaluate. */
export interface ConvergenceResult {
  structuralInvariant: string;
  killList: KillListEntry[]; // MUST be non-empty with 3+ perspectives
  perspectiveSpecificItems: Record<string, string[]>;
  convergenceQualityScore: number; // 0.0 to 1.0
  sentryFlags: string[];
}

/** Input to ConvergeAndEvaluate. */
export interface ConvergeInput {
  framings: Framing[];
  independenceCheck: IndependenceCheckResult;
}

// ---------------------------------------------------------------------------
// Reflect types
// ---------------------------------------------------------------------------

/** Op 5 output: shape recognition. */
export interface Op5Recognition {
  shapeDescription: string;
  patterns: string[];
}

/** Op 6 output: motif extraction from session content. */
export interface Op6MotifExtraction {
  motifCandidates: MotifCandidate[];
}

export interface MotifCandidate {
  name: string;
  description: string;
  primaryAxis: MotifAxis;
  derivativeOrder: number;
  evidence: string;
}

/** Op 7 output: higher-order patterns (gated to Tier 2+). */
export interface Op7MotifOfMotif {
  metaMotifCandidates: MetaMotifCandidate[];
}

export interface MetaMotifCandidate {
  name: string;
  description: string;
  constituentMotifs: string[];
  primaryAxis: MotifAxis;
}

/** Axis balance report for D/I/R distribution. */
export interface AxisBalanceReport {
  differentiateCount: number;
  integrateCount: number;
  recurseCount: number;
  totalOutputs: number;
  zeroRecurseFlag: boolean; // true if recurse count is 0
  imbalanceNotes: string[];
}

/** Op 8 output: process self-modeling (5 specified outputs). */
export interface Op8Output {
  transferFunctionSummary: string;
  independenceScore: number;
  axisBalanceReport: AxisBalanceReport;
  frameworkDelta: string;
  processMotifCandidates: MotifCandidate[];
}

/** Gate condition: Op 8 runs ONLY after full triad completion. */
export interface Op8Gate {
  oscillateComplete: boolean;
  convergeComplete: boolean;
  reflectOps5to7Complete: boolean;
}

/** Full output from Reflect. */
export interface ReflectOutput {
  op5: Op5Recognition;
  op6: Op6MotifExtraction;
  op7: Op7MotifOfMotif;
  op8: Op8Output | null; // null if gate not met
  op8Gate: Op8Gate;
  /** Seed material for next Oscillate cycle (closed loop). */
  seedForNextCycle: SeedMaterial;
}

/** Seed material that feeds the next Oscillate as input. */
export interface SeedMaterial {
  frameworkDelta: string;
  motifCandidates: MotifCandidate[];
  processObservations: string[];
  axisBalance: AxisBalanceReport;
}

/** Input to Reflect. */
export interface ReflectInput {
  sessionContent: string;
  oscillateOutput: OscillateOutput | null;
  convergeOutput: ConvergenceResult | null;
  motifLibraryState: MotifReference[];
}
