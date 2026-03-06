/**
 * S5 — Motif Application Protocol (PRD 3.5.6)
 *
 * From Theory_To_Architecture Section 3: motifs as ISC-generating lenses.
 *
 * Step 1: Motif Selection — query motif library for relevant motifs (0-3 per PRD)
 * Step 2: Lens Application — each motif generates ISC criteria with Motif: tag
 * Step 3: Axis Coverage Check — flag if no recurse-axis criteria exist
 */

import type { ISC, ConfidenceTag, ISCPriority, VerificationMethod } from "../s0/isc.ts";
import type { MotifReference, MotifAxis } from "../s0/motif.ts";
import type { MotifCriterion, MotifApplicationResult, AxisCoverageResult } from "./types.ts";

/**
 * Apply a motif as an ISC-generating lens.
 * For each motif, the generating question produces an ISC criterion
 * tagged with `Motif: <motifName>`.
 *
 * ISC Criterion 6: Motif application protocol generates criteria with Motif tag format
 */
export function applyMotifLens(
  motif: MotifReference,
  criterionId: string,
  description: string,
  options?: {
    verificationMethod?: VerificationMethod;
    verificationCommand?: string;
    confidenceTag?: ConfidenceTag;
    priority?: ISCPriority;
  },
): MotifCriterion {
  const motifTag = `Motif: ${motif.motifName}`;

  const criterion: ISC = {
    id: criterionId,
    description,
    status: "pending",
    verificationMethod: options?.verificationMethod ?? "Grep",
    verificationCommand: options?.verificationCommand ?? "",
    confidenceTag: options?.confidenceTag ?? "I",
    priority: options?.priority ?? "IMPORTANT",
    motifSource: motif,
    evidence: undefined,
  };

  return {
    criterion,
    motifTag,
  };
}

/**
 * Apply multiple motifs to generate ISC criteria.
 * PRD spec: 0-3 applicable motifs per PRD.
 *
 * ISC Criterion 6: Motif application protocol generates criteria with Motif tag format
 */
export function applyMotifs(
  motifs: MotifReference[],
  generatedCriteria: Array<{
    motif: MotifReference;
    criterionId: string;
    description: string;
    verificationMethod?: VerificationMethod;
    verificationCommand?: string;
  }>,
): MotifApplicationResult {
  const criteria: MotifCriterion[] = [];
  const motifTags: string[] = [];

  for (const entry of generatedCriteria) {
    const result = applyMotifLens(entry.motif, entry.criterionId, entry.description, {
      verificationMethod: entry.verificationMethod,
      verificationCommand: entry.verificationCommand,
    });
    criteria.push(result);

    if (!motifTags.includes(result.motifTag)) {
      motifTags.push(result.motifTag);
    }
  }

  return { criteria, motifTags };
}

/**
 * Check axis coverage of motif-sourced criteria.
 * Flags ISC sets with no recurse-axis criteria.
 *
 * ISC Criterion 7: Axis coverage check flags ISC sets with no recurse-axis criteria
 */
export function checkAxisCoverage(criteria: MotifCriterion[]): AxisCoverageResult {
  const axes: Record<MotifAxis, number> = {
    differentiate: 0,
    integrate: 0,
    recurse: 0,
  };

  for (const entry of criteria) {
    const motif = entry.criterion.motifSource;
    if (motif) {
      axes[motif.primaryAxis]++;
    }
  }

  const hasRecurseAxis = axes.recurse > 0;
  const flagged = criteria.length > 0 && !hasRecurseAxis;

  return {
    hasRecurseAxis,
    axes,
    flagged,
    message: flagged
      ? "WARNING: No recurse-axis criteria found. Consider whether a recurse-axis motif applies."
      : "Axis coverage includes recurse-axis criteria.",
  };
}

/**
 * Format a motif-sourced criterion as a PRD checklist line with Motif: tag.
 * Format: `- [ ] ISC-C12: Description | Verify: CLI | Motif: MotifName`
 *
 * ISC Criterion 6: Motif application protocol generates criteria with Motif tag format
 */
export function formatMotifCriterion(entry: MotifCriterion): string {
  const c = entry.criterion;
  return `- [ ] ${c.id}: ${c.description} | Verify: ${c.verificationMethod} | ${entry.motifTag}`;
}
