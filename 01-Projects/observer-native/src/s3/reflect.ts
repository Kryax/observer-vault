/**
 * S3 — Reflect (with Operation 8)
 *
 * Examine the deliberation itself. What did the system learn about
 * its own process?
 *
 * Sub-agent policy: SINGLE-THREAD. Reflection requires a single
 * coherent reasoning thread that examines the entire deliberation
 * process holistically.
 *
 * Operations:
 *   Op 5: Recognition — "What shape is this?"
 *   Op 6: Motif Extraction — domain-independent structural patterns
 *   Op 7: Motif-of-Motif — higher-order patterns (gated to Tier 2+)
 *   Op 8: Process Reflection — "What shaped my seeing?" (gated)
 *
 * [Source: G3 - recursive self-modeling produces categorically new
 * information; Reflect_Operation8_Proposal]
 */

import type { MotifAxis, MotifReference } from "../s0/index.ts";
import type {
  ReflectInput,
  ReflectOutput,
  Op5Recognition,
  Op6MotifExtraction,
  Op7MotifOfMotif,
  Op8Output,
  Op8Gate,
  AxisBalanceReport,
  MotifCandidate,
  SeedMaterial,
  OscillateOutput,
  ConvergenceResult,
} from "./types.ts";

// ---------------------------------------------------------------------------
// Core Reflect function
// ---------------------------------------------------------------------------

/**
 * Reflect: single-thread process self-modeling.
 *
 * Runs all four operations sequentially in a single coherent
 * reasoning thread. Op 8 is gated — it runs ONLY after full triad
 * completion (Oscillate + Converge + Reflect Ops 5-7).
 *
 * Output feeds the next Oscillate cycle as seed material (closed loop).
 */
export function reflect(input: ReflectInput): ReflectOutput {
  // Ops 5-7 always run
  const op5 = executeOp5Recognition(input.sessionContent);
  const op6 = executeOp6MotifExtraction(input.sessionContent);
  const op7 = executeOp7MotifOfMotif(op6);

  // Op 8 gate: only runs after full triad completion
  const gate = evaluateOp8Gate(input);
  const op8 = gate.oscillateComplete &&
    gate.convergeComplete &&
    gate.reflectOps5to7Complete
    ? executeOp8ProcessReflection(input, op5, op6, op7)
    : null;

  // Build seed material for next Oscillate (closed loop)
  const seedForNextCycle = buildSeedMaterial(op5, op6, op7, op8);

  return {
    op5,
    op6,
    op7,
    op8,
    op8Gate: gate,
    seedForNextCycle,
  };
}

// ---------------------------------------------------------------------------
// Op 5: Recognition — "What shape is this?"
// ---------------------------------------------------------------------------

function executeOp5Recognition(sessionContent: string): Op5Recognition {
  return {
    shapeDescription: `Shape recognition for session content (${sessionContent.length} chars)`,
    patterns: [],
  };
}

// ---------------------------------------------------------------------------
// Op 6: Motif Extraction — domain-independent structural patterns
// ---------------------------------------------------------------------------

function executeOp6MotifExtraction(sessionContent: string): Op6MotifExtraction {
  // Extract motif candidates from session content
  // In production, this uses LLM-based structural analysis
  return {
    motifCandidates: [],
  };
}

// ---------------------------------------------------------------------------
// Op 7: Motif-of-Motif — higher-order patterns (Tier 2+)
// ---------------------------------------------------------------------------

function executeOp7MotifOfMotif(op6: Op6MotifExtraction): Op7MotifOfMotif {
  // Gated to Tier 2+: looks for patterns across motif candidates
  return {
    metaMotifCandidates: [],
  };
}

// ---------------------------------------------------------------------------
// Op 8: Process Reflection — "What shaped my seeing?"
// ---------------------------------------------------------------------------

/**
 * Operation 8: Process self-modeling.
 *
 * Runs ONLY after full triad completion (gate condition).
 *
 * Produces all five specified outputs:
 * 1. Transfer function summary
 * 2. Independence score
 * 3. Axis balance report
 * 4. Framework delta
 * 5. Process motif candidates
 *
 * [Source: Reflect_Operation8_Proposal]
 */
function executeOp8ProcessReflection(
  input: ReflectInput,
  op5: Op5Recognition,
  op6: Op6MotifExtraction,
  op7: Op7MotifOfMotif,
): Op8Output {
  // 1. Transfer function analysis: what did convergence pass/reject?
  const transferFunctionSummary = analyzeTransferFunction(input.convergeOutput);

  // 2. Independence audit: were perspectives genuinely independent?
  const independenceScore = auditIndependence(input.oscillateOutput);

  // 3. Axis balance check: D/I/R distribution, flag zero recurse
  const axisBalanceReport = checkAxisBalance(
    op6.motifCandidates,
    input.motifLibraryState,
  );

  // 4. Observation perturbation: how did this session change the frame?
  const frameworkDelta = computeFrameworkDelta(
    op5,
    op6,
    op7,
    input.motifLibraryState,
  );

  // 5. Process motif candidates: patterns in the process itself
  const processMotifCandidates = extractProcessMotifs(input, op5, op6);

  return {
    transferFunctionSummary,
    independenceScore,
    axisBalanceReport,
    frameworkDelta,
    processMotifCandidates,
  };
}

// ---------------------------------------------------------------------------
// Op 8 sub-operations
// ---------------------------------------------------------------------------

/**
 * Transfer function analysis: what did the convergence filter
 * pass and reject? Systematic blind spots?
 */
function analyzeTransferFunction(
  convergeOutput: ConvergenceResult | null,
): string {
  if (!convergeOutput) {
    return "No convergence data available for transfer function analysis.";
  }

  const passed = convergeOutput.structuralInvariant;
  const rejected = convergeOutput.killList.length;
  const sentryIssues = convergeOutput.sentryFlags.length;

  return (
    `Transfer function: ${rejected} items rejected, ` +
    `convergence quality ${convergeOutput.convergenceQualityScore.toFixed(2)}. ` +
    `Sentry raised ${sentryIssues} flag(s). ` +
    `Structural invariant: ${passed}`
  );
}

/**
 * Independence audit: were perspectives genuinely independent?
 * Shared unstated assumptions?
 */
function auditIndependence(oscillateOutput: OscillateOutput | null): number {
  if (!oscillateOutput) {
    return 0;
  }
  return oscillateOutput.independenceCheck.overallScore;
}

/**
 * Axis balance check: D/I/R distribution of session's motif outputs.
 * Flags imbalance if no recurse-axis content.
 *
 * [Source: G5 - recursion axis underpopulated]
 */
function checkAxisBalance(
  sessionMotifs: MotifCandidate[],
  libraryMotifs: MotifReference[],
): AxisBalanceReport {
  let differentiateCount = 0;
  let integrateCount = 0;
  let recurseCount = 0;

  // Count session motifs by axis
  for (const motif of sessionMotifs) {
    switch (motif.primaryAxis) {
      case "differentiate":
        differentiateCount++;
        break;
      case "integrate":
        integrateCount++;
        break;
      case "recurse":
        recurseCount++;
        break;
    }
  }

  const totalOutputs = differentiateCount + integrateCount + recurseCount;
  const zeroRecurseFlag = recurseCount === 0;

  const imbalanceNotes: string[] = [];
  if (zeroRecurseFlag) {
    imbalanceNotes.push(
      "ZERO_RECURSE: No recurse-axis output in this session. " +
      "The recursion axis is systematically underpopulated (G5).",
    );
  }

  if (totalOutputs > 0) {
    const dRatio = differentiateCount / totalOutputs;
    const iRatio = integrateCount / totalOutputs;
    if (dRatio > 0.7) {
      imbalanceNotes.push(
        `HIGH_DIFFERENTIATE: ${(dRatio * 100).toFixed(0)}% differentiate output. ` +
        "Consider whether integration is being underweighted.",
      );
    }
    if (iRatio > 0.7) {
      imbalanceNotes.push(
        `HIGH_INTEGRATE: ${(iRatio * 100).toFixed(0)}% integrate output. ` +
        "Consider whether differentiation is being underweighted.",
      );
    }
  }

  return {
    differentiateCount,
    integrateCount,
    recurseCount,
    totalOutputs,
    zeroRecurseFlag,
    imbalanceNotes,
  };
}

/**
 * Observation perturbation accounting: how did this session
 * change the observation framework?
 *
 * [Source: G2 - observation modifies the observer's frame]
 */
function computeFrameworkDelta(
  op5: Op5Recognition,
  op6: Op6MotifExtraction,
  op7: Op7MotifOfMotif,
  libraryMotifs: MotifReference[],
): string {
  const newMotifCount = op6.motifCandidates.length;
  const metaMotifCount = op7.metaMotifCandidates.length;
  const existingCount = libraryMotifs.length;

  return (
    `Framework delta: ${newMotifCount} new motif candidate(s), ` +
    `${metaMotifCount} meta-motif candidate(s), ` +
    `against ${existingCount} existing library motifs. ` +
    `Shape: ${op5.shapeDescription}`
  );
}

/**
 * Extract process motifs: patterns in the process itself.
 */
function extractProcessMotifs(
  input: ReflectInput,
  _op5: Op5Recognition,
  _op6: Op6MotifExtraction,
): MotifCandidate[] {
  // Process motifs describe patterns in HOW the system deliberated,
  // not WHAT it deliberated about. These are always recurse-axis.
  const candidates: MotifCandidate[] = [];

  if (input.oscillateOutput && input.convergeOutput) {
    const agentCount = input.oscillateOutput.agentCount;
    const killCount = input.convergeOutput.killList.length;
    const independence = input.oscillateOutput.independenceCheck.overallScore;

    if (independence < 0.3) {
      candidates.push({
        name: "Convergent Framing Bias",
        description:
          "Perspective agents produced highly overlapping assumptions despite isolation. " +
          "The framing of the problem itself may be constraining independent thought.",
        primaryAxis: "recurse" as MotifAxis,
        derivativeOrder: 2,
        evidence: `Independence score ${independence.toFixed(2)} across ${agentCount} agents`,
      });
    }

    if (killCount === 0 && agentCount >= 3) {
      candidates.push({
        name: "Zero-Kill Convergence",
        description:
          "All items survived convergence despite multiple perspectives. " +
          "Either the problem space is genuinely convergent or the kill criteria are too weak.",
        primaryAxis: "recurse" as MotifAxis,
        derivativeOrder: 2,
        evidence: `${agentCount} perspectives, 0 items killed`,
      });
    }
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// Op 8 Gate
// ---------------------------------------------------------------------------

/**
 * Evaluate whether Op 8 should run.
 *
 * Gate condition: Op 8 runs ONLY after full triad completion:
 * - Oscillate output present
 * - Converge output present
 * - Reflect Ops 5-7 have been executed (always true if we reach here)
 */
function evaluateOp8Gate(input: ReflectInput): Op8Gate {
  return {
    oscillateComplete: input.oscillateOutput !== null,
    convergeComplete: input.convergeOutput !== null,
    reflectOps5to7Complete: true, // Always true: ops 5-7 run before gate check
  };
}

// ---------------------------------------------------------------------------
// Seed Material (Closed Loop)
// ---------------------------------------------------------------------------

/**
 * Build seed material for the next Oscillate cycle.
 *
 * Reflect output feeds next Oscillate as seed material (closed loop).
 * Without this, Reflect is a dead end — observed but not integrated.
 *
 * [Source: Theory_To_Architecture Design Principle 3;
 *  Council_Redesign_TDS REQ-R2]
 */
function buildSeedMaterial(
  op5: Op5Recognition,
  op6: Op6MotifExtraction,
  _op7: Op7MotifOfMotif,
  op8: Op8Output | null,
): SeedMaterial {
  const frameworkDelta = op8?.frameworkDelta ?? "";
  const motifCandidates = [
    ...op6.motifCandidates,
    ...(op8?.processMotifCandidates ?? []),
  ];

  const processObservations: string[] = [];

  if (op5.patterns.length > 0) {
    processObservations.push(`Shape patterns: ${op5.patterns.join(", ")}`);
  }

  if (op8) {
    processObservations.push(op8.transferFunctionSummary);

    if (op8.axisBalanceReport.zeroRecurseFlag) {
      processObservations.push(
        "Previous session had zero recurse-axis output — prioritize recursive perspectives.",
      );
    }
  }

  return {
    frameworkDelta,
    motifCandidates,
    processObservations,
    axisBalance: op8?.axisBalanceReport ?? {
      differentiateCount: 0,
      integrateCount: 0,
      recurseCount: 0,
      totalOutputs: 0,
      zeroRecurseFlag: true,
      imbalanceNotes: [],
    },
  };
}
