/**
 * River Interface — R1: The contract all three rivers implement
 *
 * Defines accept, route, query, and emit operations.
 * Implementable by Intake, Processing, and Reflection rivers.
 */

import type { PairedRecord, RiverName, DegenerateForm } from './types.ts';

// ---------------------------------------------------------------------------
// River State Query
// ---------------------------------------------------------------------------

export interface RiverStateQuery {
  readonly river: RiverName;
  readonly bufferDepth: number;
  readonly bufferCapacity: number;
  readonly recordCount: number;
  readonly stageDistribution: Readonly<Record<string, number>>;
}

// ---------------------------------------------------------------------------
// Route Decision
// ---------------------------------------------------------------------------

export interface RouteDecision {
  readonly target: RiverName | "pairing_service" | "store" | "discard";
  readonly channel: "fast" | "slow";
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// River Interface
// ---------------------------------------------------------------------------

export interface River {
  readonly name: RiverName;

  /** Accept a PairedRecord into this river's buffer. Returns false if rejected. */
  accept(record: PairedRecord): boolean;

  /** Route a record to its next destination based on classification. */
  route(record: PairedRecord): RouteDecision;

  /** Emit records that have completed processing in this river. */
  emit(): readonly PairedRecord[];

  /** Query the current state of this river. */
  queryState(): RiverStateQuery;

  /** Classify a record's degenerate form. */
  classify(record: PairedRecord): DegenerateForm;
}
