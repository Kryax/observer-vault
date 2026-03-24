import { Database } from 'bun:sqlite';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import type { VerbRecord } from '../types/verb-record';
import { runMigrations } from './migrations';

/** Store statistics shape. */
export interface StoreStats {
  totalRecords: number;
  byStage: Record<string, number>;
  byMotif: Record<string, number>;
  byDataset: Record<string, number>;
  byAxis: Record<string, number>;
}

/** Generate a content-addressed ID from source text and extraction params. */
export function generateVerbRecordId(sourceText: string, extractionParams: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(sourceText);
  hasher.update(extractionParams);
  return hasher.digest("hex");
}

/** Row shape returned from verb_records table. */
interface VerbRecordRow {
  id: string;
  stage: string;
  process_shape: string;
  process_operators: string | null;
  process_axis: string | null;
  process_derivative_order: number | null;
  process_temporal_structure: string | null;
  source_dataset: string;
  source_component: string;
  source_document_id: string;
  source_char_start: number;
  source_char_end: number;
  source_content_hash: string;
  source_raw_text: string;
  motif_id: string | null;
  motif_confidence: number | null;
  motif_match_evidence: string | null;
  motif_is_novel: number | null;
  tier_a_score: number;
  tier_b_score: number;
  tier_c_score: number | null;
  extraction_method: string;
  domain: string | null;
  created_at: string;
  updated_at: string;
  extractor_version: string;
  rowid: number;
}

/**
 * VerbRecordStore -- SQLite-backed store for verb-records with FTS5 search.
 * Follows the OCP scraper SearchIndex pattern (bun:sqlite, WAL, prepare/run/get/all).
 *
 * Accepts either a file path (opens its own connection) or an existing Database
 * instance (shares the caller's connection — used by the pipeline to avoid the
 * dual-connection WAL race on NFS).
 */
export class VerbRecordStore {
  private db: Database;
  private ownsConnection: boolean;

  constructor(dbPathOrDb: string | Database) {
    if (typeof dbPathOrDb === 'string') {
      const dir = dirname(dbPathOrDb);
      mkdirSync(dir, { recursive: true });

      this.db = new Database(dbPathOrDb);
      this.db.run('PRAGMA journal_mode=WAL');
      this.db.run('PRAGMA foreign_keys=ON');
      runMigrations(this.db);
      this.ownsConnection = true;
    } else {
      this.db = dbPathOrDb;
      this.ownsConnection = false;
    }
  }

  /** Insert a verb-record. Updates FTS index. */
  insert(record: VerbRecord): void {
    // Delete old row if exists (handles FTS external content sync)
    const oldRow = this.db.prepare(
      'SELECT rowid FROM verb_records WHERE id = ?'
    ).get(record.id) as { rowid: number } | null;

    if (oldRow) {
      this.db.prepare('DELETE FROM verb_records_fts WHERE rowid = ?').run(oldRow.rowid);
      this.db.prepare('DELETE FROM verb_records WHERE id = ?').run(record.id);
    }

    this.db.prepare(`
      INSERT INTO verb_records (
        id, stage, process_shape, process_operators, process_axis,
        process_derivative_order, process_temporal_structure,
        source_dataset, source_component, source_document_id,
        source_char_start, source_char_end, source_content_hash, source_raw_text,
        motif_id, motif_confidence, motif_match_evidence, motif_is_novel,
        tier_a_score, tier_b_score, tier_c_score, extraction_method,
        domain, created_at, updated_at, extractor_version
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?
      )
    `).run(
      record.id,
      record.stage,
      record.process.shape,
      JSON.stringify(record.process.operators),
      record.process.axis,
      record.process.derivativeOrder,
      record.process.temporalStructure ?? null,
      record.source.dataset,
      record.source.component,
      record.source.documentId,
      record.source.charOffset[0],
      record.source.charOffset[1],
      record.source.contentHash,
      record.source.rawText,
      record.motifMatch?.motifId ?? null,
      record.motifMatch?.confidence ?? null,
      record.motifMatch?.matchEvidence ?? null,
      record.motifMatch ? (record.motifMatch.isNovel ? 1 : 0) : null,
      record.quality.tierAScore,
      record.quality.tierBScore,
      record.quality.tierCScore ?? null,
      record.quality.extractionMethod,
      record.domain,
      record.createdAt,
      record.updatedAt,
      record.extractorVersion,
    );

    // Insert into FTS index
    this.db.prepare(`
      INSERT INTO verb_records_fts(rowid, id, process_shape, source_raw_text, domain, motif_id)
      SELECT rowid, id, process_shape, source_raw_text, domain, motif_id
      FROM verb_records WHERE id = ?
    `).run(record.id);
  }

  /** Get a verb-record by its content-addressed ID. */
  getById(id: string): VerbRecord | null {
    const row = this.db.prepare(
      'SELECT *, rowid FROM verb_records WHERE id = ?'
    ).get(id) as VerbRecordRow | null;

    if (!row) return null;
    return this.rowToRecord(row);
  }

  /** Update the formalization stage of a verb-record. */
  updateStage(id: string, stage: VerbRecord['stage']): void {
    const oldRow = this.db.prepare(
      'SELECT rowid FROM verb_records WHERE id = ?'
    ).get(id) as { rowid: number } | null;

    this.db.prepare(
      "UPDATE verb_records SET stage = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(stage, id);

    // Rebuild FTS row for this record
    if (oldRow) {
      this.db.prepare('DELETE FROM verb_records_fts WHERE rowid = ?').run(oldRow.rowid);
      this.db.prepare(`
        INSERT INTO verb_records_fts(rowid, id, process_shape, source_raw_text, domain, motif_id)
        SELECT rowid, id, process_shape, source_raw_text, domain, motif_id
        FROM verb_records WHERE id = ?
      `).run(id);
    }
  }

  /** List verb-records matching a motif ID. */
  listByMotif(motifId: string, limit: number = 100): VerbRecord[] {
    const rows = this.db.prepare(
      'SELECT *, rowid FROM verb_records WHERE motif_id = ? ORDER BY created_at DESC LIMIT ?'
    ).all(motifId, limit) as VerbRecordRow[];

    return rows.map((row) => this.rowToRecord(row));
  }

  /** List verb-records at a given formalization stage. */
  listByStage(stage: VerbRecord['stage'], limit: number = 100): VerbRecord[] {
    const rows = this.db.prepare(
      'SELECT *, rowid FROM verb_records WHERE stage = ? ORDER BY created_at DESC LIMIT ?'
    ).all(stage, limit) as VerbRecordRow[];

    return rows.map((row) => this.rowToRecord(row));
  }

  /** Full-text search across verb-records. */
  search(query: string, limit: number = 20): VerbRecord[] {
    const trimmed = query.trim();
    if (!trimmed) return [];

    try {
      return this.runFtsSearch(trimmed, limit);
    } catch (error: unknown) {
      if (error instanceof Error && /fts5|syntax/i.test(error.message)) {
        // Escape to literal token query
        const tokens = trimmed.match(/[\p{L}\p{N}]+/gu);
        if (!tokens || tokens.length === 0) throw error;
        const escaped = tokens.map((t) => `"${t}"`).join(' AND ');
        return this.runFtsSearch(escaped, limit);
      }
      throw error;
    }
  }

  private runFtsSearch(query: string, limit: number): VerbRecord[] {
    const rows = this.db.prepare(`
      SELECT vr.*, vr.rowid
      FROM verb_records_fts fts
      JOIN verb_records vr ON fts.id = vr.id
      WHERE verb_records_fts MATCH ?
      ORDER BY vr.tier_a_score DESC
      LIMIT ?
    `).all(query, limit) as VerbRecordRow[];

    return rows.map((row) => this.rowToRecord(row));
  }

  /** Get store statistics. */
  getStats(): StoreStats {
    const totalRecords = (this.db.prepare(
      'SELECT COUNT(*) as count FROM verb_records'
    ).get() as { count: number }).count;

    const stageRows = this.db.prepare(
      'SELECT stage, COUNT(*) as count FROM verb_records GROUP BY stage'
    ).all() as { stage: string; count: number }[];
    const byStage: Record<string, number> = {};
    for (const row of stageRows) {
      byStage[row.stage] = row.count;
    }

    const motifRows = this.db.prepare(
      'SELECT motif_id, COUNT(*) as count FROM verb_records WHERE motif_id IS NOT NULL GROUP BY motif_id'
    ).all() as { motif_id: string; count: number }[];
    const byMotif: Record<string, number> = {};
    for (const row of motifRows) {
      byMotif[row.motif_id] = row.count;
    }

    const datasetRows = this.db.prepare(
      'SELECT source_dataset, COUNT(*) as count FROM verb_records GROUP BY source_dataset'
    ).all() as { source_dataset: string; count: number }[];
    const byDataset: Record<string, number> = {};
    for (const row of datasetRows) {
      byDataset[row.source_dataset] = row.count;
    }

    const axisRows = this.db.prepare(
      'SELECT process_axis, COUNT(*) as count FROM verb_records WHERE process_axis IS NOT NULL GROUP BY process_axis'
    ).all() as { process_axis: string; count: number }[];
    const byAxis: Record<string, number> = {};
    for (const row of axisRows) {
      byAxis[row.process_axis] = row.count;
    }

    return { totalRecords, byStage, byMotif, byDataset, byAxis };
  }

  /** Close the database connection (only if this store owns it). */
  close(): void {
    if (this.ownsConnection) {
      this.db.close();
    }
  }

  /** Map a SQLite row to a VerbRecord interface. */
  private rowToRecord(row: VerbRecordRow): VerbRecord {
    const record: VerbRecord = {
      id: row.id,
      process: {
        shape: row.process_shape,
        operators: row.process_operators ? JSON.parse(row.process_operators) as string[] : [],
        axis: row.process_axis as VerbRecord['process']['axis'],
        derivativeOrder: row.process_derivative_order as VerbRecord['process']['derivativeOrder'],
        temporalStructure: row.process_temporal_structure as VerbRecord['process']['temporalStructure'],
      },
      source: {
        dataset: row.source_dataset,
        component: row.source_component,
        documentId: row.source_document_id,
        charOffset: [row.source_char_start, row.source_char_end],
        contentHash: row.source_content_hash,
        rawText: row.source_raw_text,
      },
      stage: row.stage as VerbRecord['stage'],
      quality: {
        tierAScore: row.tier_a_score,
        tierBScore: row.tier_b_score,
        tierCScore: row.tier_c_score ?? undefined,
        extractionMethod: row.extraction_method as VerbRecord['quality']['extractionMethod'],
      },
      domain: row.domain ?? '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      extractorVersion: row.extractor_version,
    };

    if (row.motif_id !== null) {
      record.motifMatch = {
        motifId: row.motif_id,
        confidence: row.motif_confidence ?? 0,
        matchEvidence: row.motif_match_evidence ?? '',
        isNovel: row.motif_is_novel === 1,
      };
    }

    return record;
  }
}
