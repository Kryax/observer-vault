/**
 * PairedExporter — exports aligned (source text, verb-record) pairs as JSONL
 * for dual-stream training pipelines.
 *
 * Each JSONL line: {"source": "<raw text>", "verb_record": <VerbRecord>}
 *
 * ISC: S6-1 through S6-4.
 */

import type { VerbRecord } from "../types/verb-record.ts";
import type { VerbRecordStore } from "../store/verb-record-store.ts";

/** A single paired record: raw source text aligned with its verb-record. */
export interface PairedRecord {
  source: string;
  verb_record: VerbRecord;
}

/** Options controlling which records to export. */
export interface ExportOptions {
  /** Which formalization stages to include (default: ['typed', 'crystallized']). */
  stages?: Array<"typed" | "crystallized">;
  /** Filter to a specific motif ID. */
  motifId?: string;
  /** Maximum number of records to export. */
  limit?: number;
}

/**
 * PairedExporter — streams verb-records as (source, verb_record) JSONL pairs.
 *
 * Accepts a VerbRecordStore and queries it using existing list methods.
 * Supports stage filtering, motif filtering, limits, and integrity verification.
 */
export class PairedExporter {
  constructor(private store: VerbRecordStore) {}

  /**
   * Export paired records to a JSONL file.
   * Returns the count of records exported.
   */
  async exportToFile(outputPath: string, options?: ExportOptions): Promise<number> {
    // Truncate then open writer
    await Bun.write(outputPath, "");
    const file = Bun.file(outputPath);
    const sink = file.writer();

    let count = 0;
    for await (const pair of this.stream(options)) {
      sink.write(JSON.stringify(pair) + "\n");
      count++;
    }

    await sink.end();
    return count;
  }

  /**
   * Export paired records as an async generator for streaming consumption.
   */
  async *stream(options?: ExportOptions): AsyncGenerator<PairedRecord> {
    const records = this.queryRecords(options);
    const limit = options?.limit;
    let emitted = 0;

    for (const record of records) {
      if (limit !== undefined && emitted >= limit) break;

      yield {
        source: record.source.rawText,
        verb_record: record,
      };
      emitted++;
    }
  }

  /**
   * Verify content hash integrity for an exported JSONL file.
   * Re-computes SHA-256 of each source field and compares against the stored hash.
   */
  async verifyIntegrity(
    outputPath: string,
  ): Promise<{ total: number; valid: number; mismatched: number }> {
    const content = await Bun.file(outputPath).text();
    const lines = content.trim().split("\n").filter((l) => l.length > 0);

    let valid = 0;
    let mismatched = 0;

    for (const line of lines) {
      const pair = JSON.parse(line) as PairedRecord;
      const hasher = new Bun.CryptoHasher("sha256");
      hasher.update(pair.source);
      const computed = hasher.digest("hex");

      if (computed === pair.verb_record.source.contentHash) {
        valid++;
      } else {
        mismatched++;
      }
    }

    return { total: lines.length, valid, mismatched };
  }

  /**
   * Query records from the store based on export options.
   * Uses VerbRecordStore's existing listByStage and listByMotif methods.
   */
  private queryRecords(options?: ExportOptions): VerbRecord[] {
    const stages = options?.stages ?? ["typed", "crystallized"];
    const limit = options?.limit ?? 10000;

    // If filtering by motif, use listByMotif and then filter by stage
    if (options?.motifId) {
      const motifRecords = this.store.listByMotif(options.motifId, limit);
      return motifRecords.filter((r) => stages.includes(r.stage as "typed" | "crystallized"));
    }

    // Query each requested stage and merge
    const allRecords: VerbRecord[] = [];
    for (const stage of stages) {
      const stageRecords = this.store.listByStage(stage, limit);
      allRecords.push(...stageRecords);
    }

    // Deduplicate by ID (shouldn't happen, but defensive)
    const seen = new Set<string>();
    const deduped: VerbRecord[] = [];
    for (const rec of allRecords) {
      if (!seen.has(rec.id)) {
        seen.add(rec.id);
        deduped.push(rec);
      }
    }

    return deduped;
  }
}
