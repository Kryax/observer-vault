/**
 * R8 — Dataset Processor → Intake Adapter
 *
 * Translates dataset processor output (VerbRecords) into
 * verb-only PairedRecords for the Intake river.
 *
 * ISC-R50: Dataset processor candidates enter Intake as verb-only PairedRecords.
 */

import type { PairedRecord } from '../types.ts';
import { pairedRecordFromVerbRecord } from '../degenerate.ts';
import type { VerbRecordInput } from '../degenerate.ts';

// ---------------------------------------------------------------------------
// Dataset Processor Adapter
// ---------------------------------------------------------------------------

export class DatasetProcessorAdapter {
  private _converted = 0;

  /**
   * Convert a VerbRecord from the dataset processor into a verb-only PairedRecord.
   * ISC-R50.
   */
  convert(verbRecord: VerbRecordInput): PairedRecord {
    this._converted++;
    return pairedRecordFromVerbRecord(verbRecord);
  }

  /**
   * Batch convert multiple VerbRecords.
   */
  convertBatch(records: readonly VerbRecordInput[]): PairedRecord[] {
    return records.map((r) => this.convert(r));
  }

  /** Count of records converted. */
  convertedCount(): number {
    return this._converted;
  }
}
