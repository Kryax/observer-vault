import { Database } from 'bun:sqlite';

/**
 * Run all schema migrations for the verb-record store.
 * Idempotent -- safe to call on every startup.
 */
export function runMigrations(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS verb_records (
      id TEXT PRIMARY KEY,
      stage TEXT NOT NULL DEFAULT 'amorphous',
      process_shape TEXT NOT NULL,
      process_operators TEXT,
      process_axis TEXT,
      process_derivative_order INTEGER,
      process_temporal_structure TEXT,
      source_dataset TEXT NOT NULL,
      source_component TEXT NOT NULL,
      source_document_id TEXT NOT NULL,
      source_char_start INTEGER NOT NULL,
      source_char_end INTEGER NOT NULL,
      source_content_hash TEXT NOT NULL,
      source_raw_text TEXT NOT NULL,
      motif_id TEXT,
      motif_confidence REAL,
      motif_match_evidence TEXT,
      motif_is_novel INTEGER DEFAULT 0,
      tier_a_score REAL NOT NULL DEFAULT 0,
      tier_b_score REAL NOT NULL DEFAULT 0,
      tier_c_score REAL,
      extraction_method TEXT NOT NULL DEFAULT 'primed',
      domain TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      extractor_version TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE VIRTUAL TABLE IF NOT EXISTS verb_records_fts USING fts5(
      id,
      process_shape,
      source_raw_text,
      domain,
      motif_id,
      content=verb_records,
      content_rowid=rowid
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS motif_graph_edges (
      source_motif_id TEXT NOT NULL,
      target_motif_id TEXT NOT NULL,
      relationship_type TEXT NOT NULL,
      strength REAL NOT NULL DEFAULT 0,
      evidence_count INTEGER NOT NULL DEFAULT 0,
      evidence_ids TEXT,
      discovered_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_updated TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (source_motif_id, target_motif_id, relationship_type)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS processing_state (
      dataset TEXT NOT NULL,
      component TEXT NOT NULL,
      shard_id TEXT NOT NULL,
      tier TEXT NOT NULL,
      documents_processed INTEGER NOT NULL DEFAULT 0,
      candidates_produced INTEGER NOT NULL DEFAULT 0,
      verb_records_produced INTEGER NOT NULL DEFAULT 0,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      status TEXT NOT NULL DEFAULT 'running',
      PRIMARY KEY (dataset, component, shard_id, tier)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS priority_buffer (
      id TEXT PRIMARY KEY,
      priority_score REAL NOT NULL,
      verb_record_json TEXT NOT NULL,
      enqueued_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    )
  `);

  // Migration: add compositionExpression, space, idealParent columns (idempotent)
  const vrCols = db.prepare(`PRAGMA table_info(verb_records)`).all() as { name: string }[];
  const colNames = new Set(vrCols.map((c) => c.name));
  if (!colNames.has('compositionExpression')) {
    db.run(`ALTER TABLE verb_records ADD COLUMN compositionExpression TEXT`);
  }
  if (!colNames.has('space')) {
    db.run(`ALTER TABLE verb_records ADD COLUMN space TEXT`);
  }
  if (!colNames.has('idealParent')) {
    db.run(`ALTER TABLE verb_records ADD COLUMN idealParent TEXT`);
  }

  // Indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_vr_composition ON verb_records(compositionExpression)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_vr_space ON verb_records(space)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_vr_stage ON verb_records(stage)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_vr_motif ON verb_records(motif_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_vr_dataset ON verb_records(source_dataset, source_component)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_vr_axis ON verb_records(process_axis)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_vr_order ON verb_records(process_derivative_order)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_vr_created ON verb_records(created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_vr_content_hash ON verb_records(source_content_hash)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_vr_motif_domain ON verb_records(motif_id, domain)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_mge_source ON motif_graph_edges(source_motif_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_mge_target ON motif_graph_edges(target_motif_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_mge_type ON motif_graph_edges(relationship_type)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_pb_priority ON priority_buffer(priority_score DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_pb_expires ON priority_buffer(expires_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_ps_status ON processing_state(status)`);
}
