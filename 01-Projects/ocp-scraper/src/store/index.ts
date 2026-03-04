import { Database } from 'bun:sqlite';
import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import type { SolutionRecord } from '../types/solution-record';

/**
 * SQLite Index — FTS5 search + graph edges for solution discovery.
 * Stored at .ocp/index.db (gitignored, rebuilt from records).
 */
export class SearchIndex {
  private db: Database;

  constructor(dbPath: string) {
    const dir = dirname(dbPath);
    mkdirSync(dir, { recursive: true });

    this.db = new Database(dbPath);
    this.db.exec('PRAGMA journal_mode=WAL');
    this.db.exec('PRAGMA foreign_keys=ON');
    this.initSchema();
  }

  private initSchema(): void {
    // Main records table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS records (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        problem_statement TEXT,
        domains TEXT, -- JSON array
        language TEXT,
        keywords TEXT, -- space-separated keywords
        impl_type TEXT,
        stars INTEGER DEFAULT 0,
        forks INTEGER DEFAULT 0,
        trust_score REAL DEFAULT 0,
        confidence TEXT DEFAULT 'speculative',
        source_url TEXT,
        license TEXT,
        created_at TEXT,
        updated_at TEXT,
        record_json TEXT -- Full JSON-LD for retrieval
      )
    `);

    // FTS5 virtual table for full-text search
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS records_fts USING fts5(
        id,
        title,
        description,
        problem_statement,
        domains,
        language,
        keywords,
        content=records,
        content_rowid=rowid
      )
    `);

    // Graph edges table (from dependency relationships)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS edges (
        source_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        edge_type TEXT NOT NULL, -- 'depends_on', 'composed_with', 'related_to'
        weight REAL DEFAULT 1.0,
        metadata TEXT, -- JSON
        PRIMARY KEY (source_id, target_id, edge_type)
      )
    `);

    // Zero-match query log for negative space analysis (Phase 2b)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS zero_match_queries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT NOT NULL,
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Validation events — append-only immutable ledger (Phase 2b)
    // CRITICAL: No UPDATE or DELETE statements on this table. Ever.
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS validation_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT NOT NULL,
        record_id TEXT NOT NULL,
        outcome INTEGER NOT NULL, -- 1 = solved, 0 = not solved
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Query log — ALL queries with match count (Phase 2c)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS query_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT NOT NULL,
        match_count INTEGER NOT NULL DEFAULT 0,
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
      CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);
      CREATE INDEX IF NOT EXISTS idx_records_domain ON records(domains);
      CREATE INDEX IF NOT EXISTS idx_records_trust ON records(trust_score DESC);
      CREATE INDEX IF NOT EXISTS idx_zero_match_timestamp ON zero_match_queries(timestamp);
      CREATE INDEX IF NOT EXISTS idx_validation_record ON validation_events(record_id);
      CREATE INDEX IF NOT EXISTS idx_query_log_timestamp ON query_log(timestamp);
    `);
  }

  /**
   * Index a Solution Record.
   * Idempotent: upserts if record with same ID exists.
   */
  index(record: SolutionRecord): void {
    const sourceUrl = record.implementation.refs.find(r => r.type === 'repository')?.uri || '';
    const stars = record.validation.evidence.find(e => e.type === 'github-stars');
    const forks = record.validation.evidence.find(e => e.type === 'github-forks');
    const keywords = (record.meta.keywords || []).join(' ');

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO records
        (id, title, description, problem_statement, domains, language, keywords, impl_type,
         stars, forks, trust_score, confidence, source_url, license, created_at, updated_at, record_json)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      record['@id'],
      record.meta.title,
      record.meta.description,
      record.problemSolved.statement,
      JSON.stringify(record.domains),
      Array.isArray(record.implementation.language) ? record.implementation.language[0] : record.implementation.language || null,
      keywords,
      record.implementation.type,
      parseInt(stars?.description?.match(/(\d+)/)?.[1] || '0'),
      parseInt(forks?.description?.match(/(\d+)/)?.[1] || '0'),
      record.trust.trustScore || 0,
      record.trust.confidence,
      sourceUrl,
      record.meta.license || null,
      record.meta.dateCreated,
      record.meta.dateModified,
      JSON.stringify(record),
    );

    // Sync FTS index — delete stale entry first, then re-insert from content table.
    // INSERT OR REPLACE on the records table can change rowid, leaving orphan FTS entries.
    // The FTS5 'delete' command requires the OLD values; rebuild approach is more reliable.
    const existingFts = this.db.prepare(
      `SELECT rowid, id, title, description, problem_statement, domains, language, keywords FROM records_fts WHERE id = ?`
    ).get(record['@id']) as Record<string, unknown> | null;
    if (existingFts) {
      this.db.prepare(
        `INSERT INTO records_fts(records_fts, rowid, id, title, description, problem_statement, domains, language, keywords)
         VALUES('delete', ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(existingFts.rowid, existingFts.id, existingFts.title, existingFts.description, existingFts.problem_statement, existingFts.domains, existingFts.language, existingFts.keywords);
    }
    this.db.prepare(`
      INSERT INTO records_fts(rowid, id, title, description, problem_statement, domains, language, keywords)
      SELECT rowid, id, title, description, problem_statement, domains, language, keywords
      FROM records WHERE id = ?
    `).run(record['@id']);

    // Index dependency edges
    this.indexEdges(record);
  }

  /**
   * Index dependency relationships as graph edges.
   */
  private indexEdges(record: SolutionRecord): void {
    const deps = record.composability.dependencies || [];
    const edgeStmt = this.db.prepare(`
      INSERT OR REPLACE INTO edges (source_id, target_id, edge_type, weight, metadata)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const dep of deps) {
      // Create an edge from this record to each dependency
      // Target ID is a best-effort URI for the dependency
      const targetId = dep.uri || `pkg:${dep.name}`;
      edgeStmt.run(
        record['@id'],
        targetId,
        'depends_on',
        1.0,
        JSON.stringify({ name: dep.name, version: dep.version, type: dep.type }),
      );
    }
  }

  /**
   * Full-text search across indexed records.
   */
  search(query: string, limit: number = 20): SearchResult[] {
    const stmt = this.db.prepare(`
      SELECT r.id, r.title, r.description, r.problem_statement, r.domains,
             r.language, r.impl_type, r.stars, r.trust_score, r.confidence,
             r.source_url, r.license
      FROM records_fts fts
      JOIN records r ON fts.id = r.id
      WHERE records_fts MATCH ?
      ORDER BY r.trust_score DESC
      LIMIT ?
    `);

    const rows = stmt.all(query, limit) as SearchResultRow[];
    return rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      problemStatement: row.problem_statement,
      domains: JSON.parse(row.domains || '[]'),
      language: row.language,
      implType: row.impl_type,
      stars: row.stars,
      trustScore: row.trust_score,
      confidence: row.confidence,
      sourceUrl: row.source_url,
      license: row.license,
    }));
  }

  /**
   * Get full record JSON by ID.
   */
  getRecord(id: string): SolutionRecord | null {
    const stmt = this.db.prepare('SELECT record_json FROM records WHERE id = ?');
    const row = stmt.get(id) as { record_json: string } | null;
    if (!row) return null;
    return JSON.parse(row.record_json) as SolutionRecord;
  }

  /**
   * Get graph neighbors (records connected by edges).
   */
  getNeighbors(id: string): EdgeResult[] {
    const stmt = this.db.prepare(`
      SELECT target_id, edge_type, weight, metadata
      FROM edges WHERE source_id = ?
      UNION
      SELECT source_id, edge_type, weight, metadata
      FROM edges WHERE target_id = ?
    `);
    return stmt.all(id, id) as EdgeResult[];
  }

  /**
   * Get index statistics.
   */
  getStats(): IndexStats {
    const recordCount = (this.db.prepare('SELECT COUNT(*) as count FROM records').get() as { count: number }).count;
    const edgeCount = (this.db.prepare('SELECT COUNT(*) as count FROM edges').get() as { count: number }).count;

    const domainRows = this.db.prepare(`
      SELECT domains, COUNT(*) as count FROM records GROUP BY domains ORDER BY count DESC
    `).all() as { domains: string; count: number }[];

    const domains: Record<string, number> = {};
    for (const row of domainRows) {
      try {
        const parsed = JSON.parse(row.domains) as string[];
        for (const d of parsed) {
          domains[d] = (domains[d] || 0) + row.count;
        }
      } catch { /* skip */ }
    }

    const languageRows = this.db.prepare(`
      SELECT language, COUNT(*) as count FROM records WHERE language IS NOT NULL GROUP BY language ORDER BY count DESC
    `).all() as { language: string; count: number }[];

    const languages: Record<string, number> = {};
    for (const row of languageRows) {
      languages[row.language] = row.count;
    }

    return {
      totalRecords: recordCount,
      totalEdges: edgeCount,
      domains,
      languages,
    };
  }

  // ===========================================================================
  // Phase 2c: Query Logging (all queries)
  // ===========================================================================

  /**
   * Log any search query with its result count (Phase 2c feedback loop).
   */
  logQuery(query: string, matchCount: number): void {
    this.db.prepare(
      'INSERT INTO query_log (query, match_count, timestamp) VALUES (?, ?, datetime(\'now\'))'
    ).run(query, matchCount);
  }

  /**
   * Get query log entries, optionally filtered by date range.
   */
  getQueryLog(since?: string): QueryLogEntry[] {
    if (since) {
      return this.db.prepare(
        'SELECT id, query, match_count, timestamp FROM query_log WHERE timestamp >= ? ORDER BY timestamp DESC'
      ).all(since) as QueryLogEntry[];
    }
    return this.db.prepare(
      'SELECT id, query, match_count, timestamp FROM query_log ORDER BY timestamp DESC'
    ).all() as QueryLogEntry[];
  }

  /**
   * Get query statistics for coverage analysis.
   */
  getQueryStats(): { totalQueries: number; zeroMatchQueries: number; avgMatchCount: number } {
    const row = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN match_count = 0 THEN 1 ELSE 0 END) as zero_match,
        AVG(match_count) as avg_match
      FROM query_log
    `).get() as { total: number; zero_match: number; avg_match: number | null } | null;
    return {
      totalQueries: row?.total || 0,
      zeroMatchQueries: row?.zero_match || 0,
      avgMatchCount: row?.avg_match || 0,
    };
  }

  // ===========================================================================
  // Phase 2b: Negative Space
  // ===========================================================================

  /**
   * Log a zero-match query for negative space analysis.
   */
  logZeroMatch(query: string): void {
    this.db.prepare(
      'INSERT INTO zero_match_queries (query, timestamp) VALUES (?, datetime(\'now\'))'
    ).run(query);
  }

  /**
   * Get all zero-match queries, optionally since a given timestamp.
   */
  getZeroMatchQueries(since?: string): ZeroMatchQuery[] {
    if (since) {
      return this.db.prepare(
        'SELECT id, query, timestamp FROM zero_match_queries WHERE timestamp >= ? ORDER BY timestamp DESC'
      ).all(since) as ZeroMatchQuery[];
    }
    return this.db.prepare(
      'SELECT id, query, timestamp FROM zero_match_queries ORDER BY timestamp DESC'
    ).all() as ZeroMatchQuery[];
  }

  // ===========================================================================
  // Phase 2b: Validation Events
  // ===========================================================================

  /**
   * Log a validation event. Append-only — never update or delete.
   */
  logValidation(query: string, recordId: string, outcome: boolean): void {
    this.db.prepare(
      'INSERT INTO validation_events (query, record_id, outcome, timestamp) VALUES (?, ?, ?, datetime(\'now\'))'
    ).run(query, recordId, outcome ? 1 : 0);
  }

  /**
   * Get validation events for a specific record.
   */
  getValidationEvents(recordId: string): ValidationEvent[] {
    return this.db.prepare(
      'SELECT id, query, record_id, outcome, timestamp FROM validation_events WHERE record_id = ? ORDER BY timestamp DESC'
    ).all(recordId) as ValidationEvent[];
  }

  /**
   * Count positive validations for a record (for trust vector updates).
   */
  getValidationCount(recordId: string): { positive: number; negative: number } {
    const row = this.db.prepare(`
      SELECT
        SUM(CASE WHEN outcome = 1 THEN 1 ELSE 0 END) as positive,
        SUM(CASE WHEN outcome = 0 THEN 1 ELSE 0 END) as negative
      FROM validation_events WHERE record_id = ?
    `).get(recordId) as { positive: number | null; negative: number | null } | null;
    return {
      positive: row?.positive || 0,
      negative: row?.negative || 0,
    };
  }

  // ===========================================================================
  // Phase 2b: Graph Enrichment
  // ===========================================================================

  /**
   * Add shared-domain edges between records with the same template classification.
   * Records sharing a template category are related in the problem domain.
   */
  addDomainEdges(recordId: string, templateId: string): void {
    // Find all other records with the same template classification
    const sameTemplate = this.db.prepare(`
      SELECT DISTINCT e2.source_id
      FROM edges e2
      WHERE e2.edge_type = 'shared_domain'
        AND e2.metadata LIKE ?
        AND e2.source_id != ?
    `).all(`%${templateId}%`, recordId) as { source_id: string }[];

    const edgeStmt = this.db.prepare(`
      INSERT OR IGNORE INTO edges (source_id, target_id, edge_type, weight, metadata)
      VALUES (?, ?, 'shared_domain', 0.8, ?)
    `);

    const meta = JSON.stringify({ templateId });

    // Add bidirectional edges to all records with same template
    for (const row of sameTemplate) {
      edgeStmt.run(recordId, row.source_id, meta);
      edgeStmt.run(row.source_id, recordId, meta);
    }

    // Also register this record as having this template domain
    edgeStmt.run(recordId, `template:${templateId}`, meta);
  }

  /**
   * Add compatible-port edges between records with complementary dependency profiles.
   * If record A depends on something that record B provides (or vice versa), they are complementary.
   */
  addPortEdges(recordId: string, depNames: string[]): void {
    if (depNames.length === 0) return;

    // Find records whose title/keywords match this record's dependencies
    // (i.e., this record depends on something that other record IS)
    const placeholders = depNames.map(() => '?').join(',');
    const complementary = this.db.prepare(`
      SELECT DISTINCT id FROM records
      WHERE id != ?
        AND (${depNames.map(() => 'keywords LIKE ?').join(' OR ')})
    `).all(recordId, ...depNames.map(d => `%${d}%`)) as { id: string }[];

    const edgeStmt = this.db.prepare(`
      INSERT OR IGNORE INTO edges (source_id, target_id, edge_type, weight, metadata)
      VALUES (?, ?, 'compatible_port', 0.6, ?)
    `);

    for (const row of complementary) {
      const meta = JSON.stringify({ reason: 'dependency_complement' });
      edgeStmt.run(recordId, row.id, meta);
    }
  }

  /**
   * Get related records via graph edges (all types).
   * Returns records connected by any edge type with their relationship.
   */
  getRelatedRecords(id: string, limit: number = 5): RelatedRecord[] {
    const stmt = this.db.prepare(`
      SELECT r.id, r.title, r.trust_score, r.source_url, e.edge_type, e.weight
      FROM edges e
      JOIN records r ON (
        (e.target_id = r.id AND e.source_id = ?) OR
        (e.source_id = r.id AND e.target_id = ?)
      )
      WHERE r.id IS NOT NULL
        AND e.edge_type IN ('shared_domain', 'compatible_port', 'depends_on')
      GROUP BY r.id
      ORDER BY e.weight DESC, r.trust_score DESC
      LIMIT ?
    `);
    return stmt.all(id, id, limit) as RelatedRecord[];
  }

  /**
   * Get all records (for batch operations like graph enrichment).
   */
  getAllRecordIds(): string[] {
    return (this.db.prepare('SELECT id FROM records').all() as { id: string }[]).map(r => r.id);
  }

  /**
   * Get record count by template classification (for gap analysis).
   */
  getRecordCountByTemplate(): Map<string, number> {
    const rows = this.db.prepare(`
      SELECT metadata, COUNT(*) as count
      FROM edges
      WHERE edge_type = 'shared_domain' AND target_id LIKE 'template:%'
      GROUP BY metadata
    `).all() as { metadata: string; count: number }[];

    const counts = new Map<string, number>();
    for (const row of rows) {
      try {
        const meta = JSON.parse(row.metadata);
        if (meta.templateId) {
          counts.set(meta.templateId, row.count);
        }
      } catch { /* skip */ }
    }
    return counts;
  }

  /**
   * Get total record count (for unclassified calculation).
   */
  getTotalRecordCount(): number {
    return (this.db.prepare('SELECT COUNT(*) as count FROM records').get() as { count: number }).count;
  }

  /**
   * Rebuild the index from a list of records.
   */
  rebuild(records: SolutionRecord[]): void {
    this.db.exec('DELETE FROM records');
    this.db.exec('DELETE FROM edges');

    for (const record of records) {
      this.index(record);
    }

    // Rebuild FTS5 from content table to ensure full consistency
    this.db.exec(`INSERT INTO records_fts(records_fts) VALUES('rebuild')`);
  }

  /**
   * Close the database connection.
   */
  close(): void {
    this.db.close();
  }
}

/** Search result shape */
export interface SearchResult {
  id: string;
  title: string;
  description: string;
  problemStatement: string;
  domains: string[];
  language: string | null;
  implType: string;
  stars: number;
  trustScore: number;
  confidence: string;
  sourceUrl: string;
  license: string | null;
}

interface SearchResultRow {
  id: string;
  title: string;
  description: string;
  problem_statement: string;
  domains: string;
  language: string | null;
  impl_type: string;
  stars: number;
  trust_score: number;
  confidence: string;
  source_url: string;
  license: string | null;
}

export interface EdgeResult {
  target_id: string;
  edge_type: string;
  weight: number;
  metadata: string;
}

export interface IndexStats {
  totalRecords: number;
  totalEdges: number;
  domains: Record<string, number>;
  languages: Record<string, number>;
}

/** Query log entry (Phase 2c — all queries) */
export interface QueryLogEntry {
  id: number;
  query: string;
  match_count: number;
  timestamp: string;
}

/** Zero-match query from negative space log */
export interface ZeroMatchQuery {
  id: number;
  query: string;
  timestamp: string;
}

/** Validation event record */
export interface ValidationEvent {
  id: number;
  query: string;
  record_id: string;
  outcome: number; // 1 = solved, 0 = not solved
  timestamp: string;
}

/** Related record from graph traversal */
export interface RelatedRecord {
  id: string;
  title: string;
  trust_score: number;
  source_url: string;
  edge_type: string;
  weight: number;
}
