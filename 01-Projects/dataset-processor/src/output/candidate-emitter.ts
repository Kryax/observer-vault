/**
 * Candidate Emitter — writes candidate passages as JSONL records.
 *
 * Uses Bun's native crypto for SHA-256 content hashing.
 * Outputs one JSON object per line to stdout or a file.
 */

import { type MotifScore } from "../filter/lexical-engine.ts";
import path from "node:path";

export interface CandidateRecord {
  sourceDataset: string;         // 'the-pile'
  sourceComponent: string;       // from meta.pile_set_name
  documentId: string;            // shard filename + line number
  charOffset: [number, number];
  contentHash: string;           // SHA-256 of passage text
  rawText: string;
  motifScores: MotifScore[];
  topMotifId: string;
  topScore: number;
  timestamp: string;             // ISO 8601
}

function computeHash(text: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(text);
  return hasher.digest("hex");
}

export class CandidateEmitter {
  private writer: WritableStreamDefaultWriter | null = null;
  private encoder = new TextEncoder();
  private outputFile: Bun.FileSink | null = null;
  private count = 0;

  constructor(private outputPath: string | null) {}

  async open(): Promise<void> {
    if (this.outputPath) {
      // Truncate file before writing by writing empty content first
      await Bun.write(this.outputPath, "");
      this.outputFile = Bun.file(this.outputPath).writer();
    }
  }

  emit(record: Omit<CandidateRecord, "contentHash" | "timestamp" | "sourceDataset">): void {
    const full: CandidateRecord = {
      sourceDataset: "the-pile",
      sourceComponent: record.sourceComponent,
      documentId: record.documentId,
      charOffset: record.charOffset,
      contentHash: computeHash(record.rawText),
      rawText: record.rawText,
      motifScores: record.motifScores,
      topMotifId: record.topMotifId,
      topScore: record.topScore,
      timestamp: new Date().toISOString(),
    };

    const line = JSON.stringify(full) + "\n";

    if (this.outputFile) {
      this.outputFile.write(line);
    } else {
      process.stdout.write(line);
    }

    this.count++;
  }

  async close(): Promise<void> {
    if (this.outputFile) {
      await this.outputFile.end();
    }
  }

  getCount(): number {
    return this.count;
  }

  /**
   * Build a document ID from shard path and line number.
   */
  static makeDocumentId(shardPath: string, lineNumber: number): string {
    const basename = path.basename(shardPath, ".jsonl.zst");
    return `${basename}:${lineNumber}`;
  }
}
