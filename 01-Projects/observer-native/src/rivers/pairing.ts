/**
 * R5 — Pairing Service
 *
 * Matches noun-only and verb-only records into full PairedRecords.
 * Sits at the Intake/Processing boundary.
 *
 * ISC-R32 through ISC-R36.
 */

import type {
  PairedRecord,
  NounComponent,
  VerbComponent,
  AlignmentComponent,
  AlignmentMethod,
} from './types.ts';
import { classifyDegenerateForm } from './degenerate.ts';
import { PairingStore } from './pairing-store.ts';

// ---------------------------------------------------------------------------
// Pairing Result
// ---------------------------------------------------------------------------

export interface PairingResult {
  readonly paired: boolean;
  readonly record: PairedRecord;
  readonly method: AlignmentMethod | null;
}

// ---------------------------------------------------------------------------
// Pairing Service
// ---------------------------------------------------------------------------

export class PairingService {
  private readonly store: PairingStore;
  private _pairsFormed = 0;

  constructor(store?: PairingStore) {
    this.store = store ?? new PairingStore();
  }

  /**
   * Attempt to pair a record.
   * ISC-R32: Noun-only → search verbs by provenance.
   * ISC-R33: Verb-only → search nouns by domain + entity type.
   * ISC-R34: Unmatched → stored as pending.
   */
  pair(record: PairedRecord): PairingResult {
    const form = classifyDegenerateForm(record);

    if (form === 'full_pair' || form === 'unaligned_pair') {
      // Already has both components — pass through
      return { paired: form === 'full_pair', record, method: record.alignment.method };
    }

    if (form === 'noun_only') {
      return this.matchNounOnly(record);
    }

    if (form === 'verb_only') {
      return this.matchVerbOnly(record);
    }

    return { paired: false, record, method: null };
  }

  /**
   * ISC-R32: Noun-only → search verb store by source provenance.
   */
  private matchNounOnly(record: PairedRecord): PairingResult {
    // Search verb-dominant records by provenance
    const candidates = this.store.searchVerbByProvenance(record.sourceProvenance);

    if (candidates.length > 0) {
      const match = candidates[0];
      const pairedRecord = this.merge(record, match.record);
      this.store.markPaired(record.id, match.record.id);
      this.store.markPaired(match.record.id, record.id);
      this._pairsFormed++;
      return { paired: true, record: pairedRecord, method: 'provenance' };
    }

    // ISC-R34: No match — store as pending
    this.store.storeNounPending(record);
    return { paired: false, record, method: null };
  }

  /**
   * ISC-R33: Verb-only → search noun store by domain + entity type.
   */
  private matchVerbOnly(record: PairedRecord): PairingResult {
    // Extract domain from verb's provenance or use a default search
    const domain = record.verb?.operators[0] ?? '';

    // Search noun-pending by domain
    const candidates = this.store.searchNounByDomain(domain);

    // Also try structural matching via provenance
    const provenanceCandidates = this.store.getNounPending().filter(
      (pr) => pr.record.sourceProvenance === record.sourceProvenance,
    );

    const allCandidates = [...provenanceCandidates, ...candidates];

    if (allCandidates.length > 0) {
      const match = allCandidates[0];
      const pairedRecord = this.merge(match.record, record);
      this.store.markPaired(record.id, match.record.id);
      this.store.markPaired(match.record.id, record.id);
      this._pairsFormed++;
      return { paired: true, record: pairedRecord, method: 'structural' };
    }

    // ISC-R34: No match — store as verb-dominant
    this.store.storeVerbDominant(record);
    return { paired: false, record, method: null };
  }

  /** Merge a noun-bearing record with a verb-bearing record. ISC-R35. */
  private merge(nounRecord: PairedRecord, verbRecord: PairedRecord): PairedRecord {
    const alignment: AlignmentComponent = {
      confidence: 0.5,
      method: nounRecord.sourceProvenance === verbRecord.sourceProvenance
        ? 'provenance'
        : 'structural',
    };

    return {
      id: `paired-${nounRecord.id}-${verbRecord.id}`,
      sourceProvenance: nounRecord.sourceProvenance,
      timestamp: new Date().toISOString(),
      noun: nounRecord.noun,
      verb: verbRecord.verb,
      alignment,
      position: {
        river: 'processing',
        channel: 'fast',
        stage: 'paired',
        enteredAt: new Date().toISOString(),
      },
    };
  }

  /** ISC-R36: Metrics. */
  metrics() {
    return {
      pairsFormed: this._pairsFormed,
      ...this.store.metrics(),
    };
  }

  /** Get the underlying store (for testing). */
  getStore(): PairingStore {
    return this.store;
  }
}
