/**
 * R8 — OCP Scraper → Intake Adapter
 *
 * Translates OCP scraper output (SolutionRecords) into
 * noun-only PairedRecords for the Intake river.
 *
 * ISC-R51: OCP scraper records enter Intake as noun-only PairedRecords.
 */

import type { PairedRecord } from '../types.ts';
import { pairedRecordFromSolutionRecord } from '../degenerate.ts';
import type { SolutionRecordInput } from '../degenerate.ts';

// ---------------------------------------------------------------------------
// Scraper Adapter
// ---------------------------------------------------------------------------

export class ScraperAdapter {
  private _converted = 0;

  /**
   * Convert a SolutionRecord from the OCP scraper into a noun-only PairedRecord.
   * ISC-R51.
   */
  convert(solution: SolutionRecordInput): PairedRecord {
    this._converted++;
    return pairedRecordFromSolutionRecord(solution);
  }

  /**
   * Batch convert multiple SolutionRecords.
   */
  convertBatch(records: readonly SolutionRecordInput[]): PairedRecord[] {
    return records.map((r) => this.convert(r));
  }

  /** Count of records converted. */
  convertedCount(): number {
    return this._converted;
  }
}
