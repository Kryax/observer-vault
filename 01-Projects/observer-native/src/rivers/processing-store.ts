/**
 * R3 — Processing Store (SQLite Persistence)
 *
 * Records survive session boundaries.
 * ISC-R23: Write, close, reopen, read.
 *
 * Uses a simple JSON file store as a portable fallback.
 * In production, would use SQLite via bun:sqlite.
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import type { PairedRecord } from './types.ts';
import type { RecordProcessingState } from './processing-state.ts';

// ---------------------------------------------------------------------------
// Stored Record (with processing state)
// ---------------------------------------------------------------------------

export interface StoredProcessingRecord {
  readonly record: PairedRecord;
  readonly processingState: RecordProcessingState;
  readonly channel: 'fast' | 'slow';
  readonly storedAt: string;
  readonly updatedAt: string;
}

// ---------------------------------------------------------------------------
// Processing Store
// ---------------------------------------------------------------------------

export class ProcessingStore {
  private readonly storePath: string;
  private records: Map<string, StoredProcessingRecord> = new Map();

  constructor(storeDir: string) {
    this.storePath = `${storeDir}/processing-records.json`;
    mkdirSync(storeDir, { recursive: true });
    this.load();
  }

  /** Store or update a record. */
  upsert(record: PairedRecord, state: RecordProcessingState, channel: 'fast' | 'slow'): void {
    const existing = this.records.get(record.id);
    const now = new Date().toISOString();
    this.records.set(record.id, {
      record,
      processingState: state,
      channel,
      storedAt: existing?.storedAt ?? now,
      updatedAt: now,
    });
    this.save();
  }

  /** Get a record by ID. */
  get(recordId: string): StoredProcessingRecord | undefined {
    return this.records.get(recordId);
  }

  /** Get all records. */
  getAll(): readonly StoredProcessingRecord[] {
    return [...this.records.values()];
  }

  /** Query by processing state. */
  queryByState(state: RecordProcessingState): readonly StoredProcessingRecord[] {
    return [...this.records.values()].filter((r) => r.processingState === state);
  }

  /** Query by channel. */
  queryByChannel(channel: 'fast' | 'slow'): readonly StoredProcessingRecord[] {
    return [...this.records.values()].filter((r) => r.channel === channel);
  }

  /** Count records. */
  count(): number {
    return this.records.size;
  }

  /** Persist to disk. ISC-R23. */
  private save(): void {
    const data = Object.fromEntries(this.records);
    writeFileSync(this.storePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /** Load from disk. ISC-R23. */
  private load(): void {
    if (!existsSync(this.storePath)) return;
    try {
      const raw = readFileSync(this.storePath, 'utf-8');
      const data = JSON.parse(raw) as Record<string, StoredProcessingRecord>;
      this.records = new Map(Object.entries(data));
    } catch {
      // Fresh start on corruption
    }
  }
}
