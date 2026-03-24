/**
 * R4 — Reflection Store (Vault Record Persistence)
 *
 * Reflection records persist as vault records across sessions.
 * ISC-R29: Reflection records persist as vault records.
 */

import { mkdirSync, appendFileSync, readFileSync, existsSync } from 'node:fs';
import type { PairedRecord } from './types.ts';

// ---------------------------------------------------------------------------
// Reflection Record (vault format)
// ---------------------------------------------------------------------------

export interface ReflectionVaultRecord {
  readonly id: string;
  readonly type: 'template_update' | 'config_delta' | 'anomaly_observation' | 'session_trace';
  readonly sourceRecord: PairedRecord;
  readonly observation: string;
  readonly sessionId: string;
  readonly timestamp: string;
}

// ---------------------------------------------------------------------------
// Reflection Store
// ---------------------------------------------------------------------------

export class ReflectionStore {
  private readonly storePath: string;

  constructor(vaultRoot: string) {
    this.storePath = `${vaultRoot}/02-Knowledge/reflections`;
    mkdirSync(this.storePath, { recursive: true });
  }

  /** Write a reflection record as JSONL. ISC-R29. */
  write(record: ReflectionVaultRecord): void {
    const date = record.timestamp.slice(0, 10);
    const filePath = `${this.storePath}/${date}.jsonl`;
    const line = JSON.stringify(record) + '\n';
    appendFileSync(filePath, line, 'utf-8');
  }

  /** Read all reflection records for a given date. */
  readByDate(date: string): ReflectionVaultRecord[] {
    const filePath = `${this.storePath}/${date}.jsonl`;
    if (!existsSync(filePath)) return [];

    const raw = readFileSync(filePath, 'utf-8');
    const records: ReflectionVaultRecord[] = [];
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        records.push(JSON.parse(line) as ReflectionVaultRecord);
      } catch {
        // Skip malformed lines
      }
    }
    return records;
  }

  /** Read all reflection records (all dates). */
  readAll(): ReflectionVaultRecord[] {
    // In production, would scan directory. For now, return empty.
    return [];
  }

  /** Query by type. */
  queryByType(date: string, type: ReflectionVaultRecord['type']): ReflectionVaultRecord[] {
    return this.readByDate(date).filter((r) => r.type === type);
  }

  /** Get the store path (for testing). */
  getStorePath(): string {
    return this.storePath;
  }
}
