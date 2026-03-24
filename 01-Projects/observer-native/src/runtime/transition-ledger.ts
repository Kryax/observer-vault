/**
 * P2 — Transition Ledger
 *
 * Append-only receipt store. Hot path: tmp/runtime-ledger.ndjson.
 * ISC-P13: No receipt modification or deletion.
 * ISC-P14: NDJSON format.
 * ISC-P55: Compaction on COMPLETE→IDLE.
 */

import { mkdirSync, appendFileSync, readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import type { TransitionReceipt } from './state-types.ts';

// ---------------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------------

export class TransitionLedger {
  private readonly hotPath: string;
  private readonly dailyRoot: string;

  constructor(
    workspacePath: string,
    hotPathOverride?: string,
  ) {
    this.hotPath = hotPathOverride ?? `${workspacePath}/tmp/runtime-ledger.ndjson`;
    this.dailyRoot = `${workspacePath}/03-Daily`;
    this.ensureDirectory(this.hotPath);
  }

  /** Append a receipt to the hot file. ISC-P11, ISC-P13, ISC-P14. */
  append(receipt: TransitionReceipt): void {
    const line = JSON.stringify(receipt) + '\n';
    appendFileSync(this.hotPath, line, 'utf-8');
  }

  /** Read all receipts from the hot file. */
  readAll(): TransitionReceipt[] {
    if (!existsSync(this.hotPath)) return [];
    const raw = readFileSync(this.hotPath, 'utf-8');
    const receipts: TransitionReceipt[] = [];
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        receipts.push(JSON.parse(line) as TransitionReceipt);
      } catch {
        // Skip malformed lines
      }
    }
    return receipts;
  }

  /** Get the last receipt (for crash recovery). ISC-P53. */
  lastReceipt(): TransitionReceipt | null {
    const receipts = this.readAll();
    return receipts.length > 0 ? receipts[receipts.length - 1]! : null;
  }

  /** Check if the hot file exists and has content. */
  hasHotFile(): boolean {
    if (!existsSync(this.hotPath)) return false;
    const content = readFileSync(this.hotPath, 'utf-8');
    return content.trim().length > 0;
  }

  /**
   * Compact the ledger. ISC-P55.
   * Copies hot file to 03-Daily/{date}/runtime-ledger/{sessionId}.json,
   * then truncates the hot file.
   */
  compact(sessionId: string): string {
    const date = new Date().toISOString().slice(0, 10);
    const targetDir = `${this.dailyRoot}/${date}/runtime-ledger`;
    mkdirSync(targetDir, { recursive: true });

    const targetPath = `${targetDir}/${sessionId}.json`;

    // Read receipts and write as JSON array
    const receipts = this.readAll();
    writeFileSync(targetPath, JSON.stringify(receipts, null, 2), 'utf-8');

    // Truncate hot file
    writeFileSync(this.hotPath, '', 'utf-8');

    return targetPath;
  }

  /** Get the hot file path (for testing). */
  getHotPath(): string {
    return this.hotPath;
  }

  private ensureDirectory(filePath: string): void {
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));
    mkdirSync(dir, { recursive: true });
  }
}
