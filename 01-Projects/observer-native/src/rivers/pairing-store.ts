/**
 * R5 — Pairing Store
 *
 * Pending-pair storage: noun-pending and verb-dominant queues.
 * ISC-R34: Unmatched records stored with explicit status.
 */

import type { PairedRecord } from './types.ts';

export type PendingStatus = 'noun_pending' | 'verb_dominant' | 'paired';

export interface PendingRecord {
  readonly record: PairedRecord;
  readonly status: PendingStatus;
  readonly arrivedAt: string;
  readonly pairedWith?: string;
}

export class PairingStore {
  private readonly nounPending: Map<string, PendingRecord> = new Map();
  private readonly verbDominant: Map<string, PendingRecord> = new Map();
  private readonly paired: Map<string, PendingRecord> = new Map();

  /** Store a noun-pending record. */
  storeNounPending(record: PairedRecord): void {
    this.nounPending.set(record.id, {
      record,
      status: 'noun_pending',
      arrivedAt: new Date().toISOString(),
    });
  }

  /** Store a verb-dominant record. */
  storeVerbDominant(record: PairedRecord): void {
    this.verbDominant.set(record.id, {
      record,
      status: 'verb_dominant',
      arrivedAt: new Date().toISOString(),
    });
  }

  /** Mark a record as paired. */
  markPaired(recordId: string, pairedWithId: string): void {
    const fromNoun = this.nounPending.get(recordId);
    const fromVerb = this.verbDominant.get(recordId);
    const source = fromNoun ?? fromVerb;

    if (source) {
      this.paired.set(recordId, {
        ...source,
        status: 'paired',
        pairedWith: pairedWithId,
      });
      this.nounPending.delete(recordId);
      this.verbDominant.delete(recordId);
    }
  }

  /** Search noun-pending records by domain + entity type. */
  searchNounByDomain(domain: string, entityType?: string): readonly PendingRecord[] {
    return [...this.nounPending.values()].filter((pr) => {
      if (!pr.record.noun) return false;
      if (pr.record.noun.domain !== domain) return false;
      if (entityType && pr.record.noun.entityType !== entityType) return false;
      return true;
    });
  }

  /** Search verb-dominant records by source provenance. */
  searchVerbByProvenance(provenance: string): readonly PendingRecord[] {
    return [...this.verbDominant.values()].filter(
      (pr) => pr.record.sourceProvenance === provenance,
    );
  }

  /** ISC-R36: Metrics. */
  metrics() {
    return {
      nounPendingCount: this.nounPending.size,
      verbDominantCount: this.verbDominant.size,
      pairedCount: this.paired.size,
    };
  }

  /** Get all noun-pending records. */
  getNounPending(): readonly PendingRecord[] {
    return [...this.nounPending.values()];
  }

  /** Get all verb-dominant records. */
  getVerbDominant(): readonly PendingRecord[] {
    return [...this.verbDominant.values()];
  }
}
