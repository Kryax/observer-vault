import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { VAULT_ROOT } from "../../s2/vault-writer.ts";
import type { MotifCandidate } from "../types.ts";
import { detectCollapseReview } from "./collapse.ts";
import {
  resolveDecision,
  type CollapseReviewSignal,
  type DecisionResolution,
  type StabilizationAssessment,
} from "./decision.ts";
import { normalizeCandidateNote, normalizeLibraryMotifMarkdown } from "./normalization.ts";
import { evaluateStabilization } from "./stabilization.ts";
import type { CandidateRecord, MotifRecord } from "./types.ts";

const MOTIFS_DIR = join(VAULT_ROOT, "02-Knowledge/motifs");

export interface CandidateEvaluation {
  candidate: CandidateRecord;
  stabilization: StabilizationAssessment;
  decision: DecisionResolution;
  collapseSignals: CollapseReviewSignal[];
}

export function loadNormalizedMotifLibrary(options: {
  excludePaths?: string[];
} = {}): MotifRecord[] {
  const exclude = new Set(
    (options.excludePaths ?? []).map((filePath) => normalizeAbsolutePath(filePath)),
  );

  return readdirSync(MOTIFS_DIR)
    .filter((filename) => filename.endsWith(".md"))
    .filter((filename) => !filename.startsWith("_"))
    .filter((filename) => filename !== "MOTIF_INDEX.md")
    .filter((filename) => filename !== "codex-dir-metamorphosis-language-20260311.md")
    .map((filename) => join(MOTIFS_DIR, filename))
    .filter((filePath) => !exclude.has(normalizeAbsolutePath(filePath)))
    .map((filePath) => ({
      filePath,
      markdown: readFileSync(filePath, "utf8"),
    }))
    .map(({ filePath, markdown }) => normalizeLibraryMotifMarkdown(markdown, {
      filePath: relative(VAULT_ROOT, filePath),
    }).record);
}

export function loadNormalizedMotifLibraryAsync(options: {
  excludePaths?: string[];
} = {}): MotifRecord[] {
  return loadNormalizedMotifLibrary(options);
}

export function evaluateCandidate(
  candidate: CandidateRecord,
  motifLibrary: MotifRecord[],
): CandidateEvaluation {
  const stabilizationRaw = evaluateStabilization(candidate, motifLibrary, {
    minDistinctDomains: 2,
    invarianceThreshold: 0.5,
    derivationConflictThreshold: 0.32,
    humanReviewThreshold: 0.24,
  });

  candidate.comparisonReport = stabilizationRaw.d.comparisonReport;

  const stabilization: StabilizationAssessment = {
    c: {
      eligible: stabilizationRaw.c.eligible,
      distinctDomainCount: stabilizationRaw.c.distinctDomainCount,
      unrelatedDomainCount: stabilizationRaw.c.distinctDomainCount,
      minimumDistinctDomains: stabilizationRaw.c.threshold,
      minimumUnrelatedDomains: stabilizationRaw.c.threshold,
    },
    i: {
      eligible: stabilizationRaw.i.stable,
      score: stabilizationRaw.i.score,
      threshold: stabilizationRaw.i.threshold,
    },
    d: {
      derivationConflict: stabilizationRaw.d.derivationConflict,
      strongestMatch: stabilizationRaw.d.comparisonReport.strongestMatch,
      threshold: stabilizationRaw.d.similarityThreshold,
      notes: stabilizationRaw.d.comparisonReport.notes,
    },
  };

  const collapse = detectCollapseReview({
    candidate,
    failedFalsificationSignals: candidate.falsifiers.length === 0
      ? ["Candidate is missing falsifiers."]
      : [],
    processPathologyIndicators: candidate.normalizationWarnings.filter((warning) =>
      /missing|invalid/i.test(warning)
    ),
  });

  const collapseSignals: CollapseReviewSignal[] = collapse.triggered
    ? collapse.reasons.map((reason) => ({
        kind: reason === "failed_falsification"
          ? "falsifier_failure"
          : reason,
        detail: collapse.notes.join(" "),
        evidence: [candidate.id],
      }))
    : [];

  const decision = resolveDecision({
    candidate,
    targetTier: determineTargetTier(candidate),
    stabilization,
    collapseSignals,
  });

  return {
    candidate,
    stabilization,
    decision,
    collapseSignals,
  };
}

export function evaluateCandidateNote(
  markdown: string,
  options: { filePath?: string } = {},
): CandidateEvaluation[] {
  const candidates = normalizeCandidateNote(markdown, options);
  const motifLibrary = loadNormalizedMotifLibraryAsync({
    excludePaths: options.filePath ? [options.filePath] : [],
  });

  return candidates.map((candidate) => evaluateCandidate(candidate, motifLibrary));
}

export function extractMotifCandidatesFromSessionContent(
  sessionContent: string,
): MotifCandidate[] {
  if (!looksLikeCandidateNote(sessionContent)) {
    return [];
  }

  const evaluations = evaluateCandidateNote(sessionContent);

  return evaluations.map(({ candidate, decision, stabilization }) => ({
    name: candidate.name,
    description: candidate.invariants[0] ?? candidate.name,
    primaryAxis: dominantAxis(candidate),
    derivativeOrder: coerceDerivativeOrder(candidate.derivativeOrder),
    evidence:
      `decision=${decision.decision}; c=${stabilization.c.distinctDomainCount}; ` +
      `i=${stabilization.i.score.toFixed(2)}; d=${stabilization.d.strongestMatch?.motifName ?? "none"}`,
  }));
}

function looksLikeCandidateNote(sessionContent: string): boolean {
  return sessionContent.includes("## R - Motif Candidates") &&
    sessionContent.includes("### Motif 1:");
}

function determineTargetTier(candidate: CandidateRecord): 1 | 2 {
  const distinctDomainCount = new Set(candidate.instances.map((instance) => instance.domain)).size;
  return distinctDomainCount >= 3 ? 2 : 1;
}

function dominantAxis(candidate: CandidateRecord): MotifCandidate["primaryAxis"] {
  const entries = Object.entries(candidate.axisVector) as Array<
    [MotifCandidate["primaryAxis"], number]
  >;

  entries.sort((left, right) => right[1] - left[1]);
  return entries[0]?.[0] ?? "integrate";
}

function coerceDerivativeOrder(value: CandidateRecord["derivativeOrder"]): number {
  if (typeof value === "number") {
    return value;
  }

  const numeric = Number.parseFloat(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeAbsolutePath(filePath: string): string {
  return filePath.startsWith(VAULT_ROOT) ? filePath : join(VAULT_ROOT, filePath);
}
