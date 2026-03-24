/**
 * R9 — Vault Writer (River Event → Vault Record)
 *
 * Produces vault records from significant river events.
 * ISC-R55: Every significant river event produces a vault record.
 * ISC-R57: Vault queries can retrieve river history by time range and river type.
 * ISC-R58: Process traces are machine-readable D/I/R records.
 */

import { mkdirSync, appendFileSync, readFileSync, existsSync } from 'node:fs';
import type { PairedRecord, RiverName } from './types.ts';
import type { ConvergenceEvent } from './convergence-types.ts';

// ---------------------------------------------------------------------------
// Vault Record Types
// ---------------------------------------------------------------------------

export type RiverVaultEventType =
  | 'record_ingested'
  | 'record_processed'
  | 'record_reflected'
  | 'record_paired'
  | 'convergence_detected'
  | 'governance_decision'
  | 'overflow_event'
  | 'session_summary';

export interface RiverVaultRecord {
  readonly id: string;
  readonly type: RiverVaultEventType;
  readonly river: RiverName | 'system';
  readonly recordId?: string;
  readonly dir: 'distinguish' | 'integrate' | 'recurse';
  readonly summary: string;
  readonly data: Record<string, unknown>;
  readonly timestamp: string;
  readonly sessionId: string;
}

// ---------------------------------------------------------------------------
// River Vault Writer
// ---------------------------------------------------------------------------

export class RiverVaultWriter {
  private readonly basePath: string;
  private readonly sessionId: string;

  constructor(vaultRoot: string, sessionId: string) {
    this.basePath = `${vaultRoot}/02-Knowledge/river-traces`;
    this.sessionId = sessionId;
    mkdirSync(this.basePath, { recursive: true });
  }

  /** Write a river event to vault. ISC-R55. */
  write(record: RiverVaultRecord): void {
    const date = record.timestamp.slice(0, 10);
    const filePath = `${this.basePath}/${date}.jsonl`;
    appendFileSync(filePath, JSON.stringify(record) + '\n', 'utf-8');
  }

  /** Record a PairedRecord ingestion event. */
  recordIngestion(record: PairedRecord, river: RiverName): void {
    this.write({
      id: `rv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'record_ingested',
      river,
      recordId: record.id,
      dir: 'distinguish',
      summary: `Record ${record.id} ingested into ${river} river`,
      data: { sourceProvenance: record.sourceProvenance },
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
    });
  }

  /** Record a convergence event. */
  recordConvergence(event: ConvergenceEvent): void {
    this.write({
      id: `rv-conv-${Date.now()}`,
      type: 'convergence_detected',
      river: 'system',
      dir: 'integrate',
      summary: `${event.type} convergence detected`,
      data: event as unknown as Record<string, unknown>,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
    });
  }

  /**
   * Query vault records by date and optionally by river.
   * ISC-R57.
   */
  query(date: string, river?: RiverName): RiverVaultRecord[] {
    const filePath = `${this.basePath}/${date}.jsonl`;
    if (!existsSync(filePath)) return [];

    const raw = readFileSync(filePath, 'utf-8');
    const records: RiverVaultRecord[] = [];
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        const record = JSON.parse(line) as RiverVaultRecord;
        if (!river || record.river === river) {
          records.push(record);
        }
      } catch {}
    }
    return records;
  }
}
