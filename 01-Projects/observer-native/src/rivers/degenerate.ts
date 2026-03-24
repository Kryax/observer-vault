/**
 * Degenerate Form Handling — R1
 *
 * Classifies PairedRecords into their degenerate form and provides
 * constructors from existing VerbRecord and SolutionRecord types.
 */

import type {
  PairedRecord,
  DegenerateForm,
  NounComponent,
  VerbComponent,
  AlignmentComponent,
  RiverPosition,
} from './types.ts';

// ---------------------------------------------------------------------------
// Classifier
// ---------------------------------------------------------------------------

/**
 * Classify a PairedRecord into its degenerate form.
 *
 * - full_pair: both noun and verb present, alignment > 0
 * - noun_only: verb is null
 * - verb_only: noun is null
 * - unaligned_pair: both present but alignment.confidence === 0
 */
export function classifyDegenerateForm(record: PairedRecord): DegenerateForm {
  const hasNoun = record.noun !== null;
  const hasVerb = record.verb !== null;

  if (hasNoun && hasVerb) {
    return record.alignment.confidence > 0 ? "full_pair" : "unaligned_pair";
  }
  if (hasNoun && !hasVerb) return "noun_only";
  if (!hasNoun && hasVerb) return "verb_only";

  // Both null — treat as unaligned (degenerate edge case)
  return "unaligned_pair";
}

// ---------------------------------------------------------------------------
// VerbRecord → PairedRecord (verb-only degenerate)
// ---------------------------------------------------------------------------

/**
 * Construct a verb-only PairedRecord from a VerbRecord.
 * The VerbRecord's source provenance becomes the PairedRecord's provenance.
 * Noun is null — this record routes to the pairing service.
 */
export interface VerbRecordInput {
  readonly id: string;
  readonly process: {
    readonly shape: string;
    readonly operators: readonly string[];
    readonly axis: "differentiate" | "integrate" | "recurse";
    readonly derivativeOrder: number;
  };
  readonly source: {
    readonly contentHash: string;
    readonly rawText: string;
  };
  readonly domain: string;
  readonly createdAt: string;
}

export function pairedRecordFromVerbRecord(verb: VerbRecordInput): PairedRecord {
  const verbComponent: VerbComponent = {
    processShape: verb.process.shape,
    operators: verb.process.operators,
    axis: verb.process.axis,
    derivativeOrder: verb.process.derivativeOrder,
  };

  const alignment: AlignmentComponent = {
    confidence: 0,
    method: "provenance",
  };

  const position: RiverPosition = {
    river: "intake",
    channel: "fast",
    stage: "pairing_pending",
    enteredAt: new Date().toISOString(),
  };

  return {
    id: verb.id,
    sourceProvenance: verb.source.contentHash,
    timestamp: verb.createdAt,
    noun: null,
    verb: verbComponent,
    alignment,
    position,
  };
}

// ---------------------------------------------------------------------------
// SolutionRecord → PairedRecord (noun-only degenerate)
// ---------------------------------------------------------------------------

/**
 * Construct a noun-only PairedRecord from a SolutionRecord.
 * The SolutionRecord's @id becomes provenance.
 * Verb is null — this record routes to the pairing service.
 */
export interface SolutionRecordInput {
  readonly "@id": string;
  readonly meta: {
    readonly title: string;
    readonly description: string;
    readonly dateCreated: string;
  };
  readonly domains: readonly string[];
  readonly problemSolved: {
    readonly statement: string;
  };
}

export function pairedRecordFromSolutionRecord(
  solution: SolutionRecordInput,
): PairedRecord {
  const nounComponent: NounComponent = {
    entityType: "solution",
    domain: solution.domains[0] ?? "unknown",
    description: solution.meta.description,
    rawContent: solution.problemSolved.statement,
  };

  const alignment: AlignmentComponent = {
    confidence: 0,
    method: "provenance",
  };

  const position: RiverPosition = {
    river: "intake",
    channel: "fast",
    stage: "pairing_pending",
    enteredAt: new Date().toISOString(),
  };

  return {
    id: solution["@id"],
    sourceProvenance: solution["@id"],
    timestamp: solution.meta.dateCreated,
    noun: nounComponent,
    verb: null,
    alignment,
    position,
  };
}
