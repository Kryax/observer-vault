/**
 * S4 — Council Role Types
 *
 * Types specific to the Council role layer. Cross-component types
 * are imported from S0; this file defines S4-internal structures.
 */

import type {
  ProcessQualityEscalation,
  TaskFailureEscalation,
} from "../s0/index.ts";

// ---------------------------------------------------------------------------
// Phase assignments
// ---------------------------------------------------------------------------

/** The three cognitive triad phases plus post-triad execution. */
export type CouncilPhase = "OSCILLATE" | "CONVERGE" | "REFLECT" | "EXECUTE";

/** Problem complexity tiers that determine Perspective Agent count. */
export type ProblemComplexity = "SIMPLE" | "MULTI_FACETED" | "HIGH_STAKES";

// ---------------------------------------------------------------------------
// Perspective Agent types
// ---------------------------------------------------------------------------

/** Lens types for Perspective Agents (not exhaustive). */
export type PerspectiveLens =
  | "TECHNICAL_FEASIBILITY"
  | "USER_IMPACT"
  | "SECURITY_ADVERSARIAL"
  | "OPERATIONAL_MAINTENANCE"
  | "TEMPORAL"
  | "DOMAIN_SPECIFIC";

/** Output of a single Perspective Agent during Oscillate. */
export interface PerspectiveFraming {
  agentId: string;
  lens: PerspectiveLens;
  restatement: string;
  constraints: string[];
  risks: string[];
  approach: string;
  foundationalAssumptions: string[];
}

/** Result of the mandatory independence check across Perspective framings. */
export interface IndependenceCheckResult {
  checked: true;
  redundantPairs: Array<{
    agentA: string;
    agentB: string;
    sharedAssumptions: string[];
  }>;
  overallQuality: "HIGH" | "MODERATE" | "LOW";
}

/** Full Oscillate phase output. */
export interface OscillateOutput {
  phase: "OSCILLATE";
  framings: PerspectiveFraming[];
  independenceCheck: IndependenceCheckResult;
  agentCount: number;
}

// ---------------------------------------------------------------------------
// Triangulator types
// ---------------------------------------------------------------------------

/** A single item in the kill list (rejected from convergence). */
export interface KillListItem {
  item: string;
  sourceAgent: string;
  reason: string;
}

/** Triangulator output: structural invariant from convergence. */
export interface TriangulatorOutput {
  structuralInvariant: string;
  killList: KillListItem[];
  perspectiveSpecificItems: Array<{
    item: string;
    sourceAgent: string;
  }>;
  convergenceQualityScore: number;
}

// ---------------------------------------------------------------------------
// Sentry types
// ---------------------------------------------------------------------------

/** Individual flag raised by the Sentry. */
export interface SentryFlag {
  category: "HIDDEN_ASSUMPTION" | "INCORRECT_KILL" | "MISSED_CONVERGENCE" | "UNRESOLVED_RISK";
  description: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  evidence: string;
}

/** Full Sentry output after adversarial review. */
export interface SentryOutput {
  stressTestedInvariant: string;
  flags: SentryFlag[];
  unresolvedRisks: string[];
}

/** Combined Converge phase output (Triangulator + Sentry). */
export interface ConvergeOutput {
  phase: "CONVERGE";
  triangulator: TriangulatorOutput;
  sentry: SentryOutput;
}

// ---------------------------------------------------------------------------
// Reflector types
// ---------------------------------------------------------------------------

/** Motif candidate identified during Reflect. */
export interface MotifCandidate {
  name: string;
  description: string;
  axis: "differentiate" | "integrate" | "recurse";
}

/** Framework delta: what changed in the Council's understanding. */
export interface FrameworkDelta {
  description: string;
  suggestedLensAdjustments: string[];
  axisImbalanceDetected: boolean;
}

/** Full Reflector output. Observation only, no decision authority. */
export interface ReflectorOutput {
  phase: "REFLECT";
  processObservation: string;
  assumptionInventory: string[];
  motifCandidates: MotifCandidate[];
  frameworkDelta: FrameworkDelta;
  axisBalanceAssessment: {
    differentiate: number;
    integrate: number;
    recurse: number;
    imbalanced: boolean;
  };
  /** Output length in pages. Must be >= convergeOutputPages / 2. */
  outputPages: number;
}

// ---------------------------------------------------------------------------
// Builder / Work Packet types
// ---------------------------------------------------------------------------

/** Triad receipts from all three cognitive phases. */
export interface TriadReceipts {
  oscillate: OscillateOutput;
  converge: ConvergeOutput;
  reflect: ReflectorOutput;
}

/** Work packet assembled for the Builder after triad completion. */
export interface WorkPacket {
  structuralInvariant: string;
  sentryFlags: SentryFlag[];
  reflectObservations: string;
  scope: string;
  constraints: string[];
  successCriteria: string[];
  acceptanceTests: string[];
  paths: string[];
  environmentContext: Record<string, string>;
  triadReceipts: TriadReceipts;
}

/** Builder execution result. */
export interface BuilderResult {
  passed: boolean;
  artifacts: string[];
  proofGateResults: Array<{
    gate: string;
    passed: boolean;
    evidence: string;
  }>;
  receipts: string[];
  retryCount: number;
  failureEscalation?: TaskFailureEscalation;
}

// ---------------------------------------------------------------------------
// Deliberation sequence
// ---------------------------------------------------------------------------

/** The nine steps of the Council deliberation sequence. */
export type DeliberationStep =
  | "INTAKE"
  | "OSCILLATE"
  | "CONVERGE_TRIANGULATE"
  | "CONVERGE_SENTRY"
  | "REFLECT"
  | "WORK_PACKET_ASSEMBLY"
  | "EXECUTE"
  | "COUNCIL_REENTRY"
  | "REFLECTOR_ESCALATION"
  | "FEEDBACK_LOOP";

/** Full deliberation record. */
export interface DeliberationRecord {
  deliberationId: string;
  problemStatement: string;
  complexity: ProblemComplexity;
  currentStep: DeliberationStep;
  oscillateOutput?: OscillateOutput;
  convergeOutput?: ConvergeOutput;
  reflectOutput?: ReflectorOutput;
  workPacket?: WorkPacket;
  builderResult?: BuilderResult;
  processEscalation?: ProcessQualityEscalation;
  completed: boolean;
  timestamp: string;
}
