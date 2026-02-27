// S3: INSERT-only SQLite audit index
// WAL mode for concurrent reads during writes
// No UPDATE, no DELETE — structurally append-only
// Indexed on session_id, thread_id, timestamp, category

import Database from "better-sqlite3";
import type { AuditEvent, AuditFilter, AuditQueryResult } from "@observer/shared";

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS audit_events (
  event_id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  category TEXT NOT NULL,
  action TEXT NOT NULL,
  session_id TEXT,
  thread_id TEXT,
  turn_id TEXT,
  item_id TEXT,
  client_id TEXT,
  details TEXT NOT NULL,
  policy_rule_id TEXT,
  risk_level TEXT
)`;

const CREATE_INDEXES = [
  "CREATE INDEX IF NOT EXISTS idx_audit_session_id ON audit_events (session_id)",
  "CREATE INDEX IF NOT EXISTS idx_audit_thread_id ON audit_events (thread_id)",
  "CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_events (timestamp)",
  "CREATE INDEX IF NOT EXISTS idx_audit_category ON audit_events (category)",
];

const INSERT_EVENT = `
INSERT OR IGNORE INTO audit_events (
  event_id, timestamp, category, action,
  session_id, thread_id, turn_id, item_id,
  client_id, details, policy_rule_id, risk_level
) VALUES (
  @event_id, @timestamp, @category, @action,
  @session_id, @thread_id, @turn_id, @item_id,
  @client_id, @details, @policy_rule_id, @risk_level
)`;

export interface SqliteIndexOptions {
  dbPath: string;
}

export class SqliteIndex {
  private db: Database.Database;
  private insertStmt: Database.Statement;

  constructor(options: SqliteIndexOptions) {
    this.db = new Database(options.dbPath);

    // WAL mode for concurrent reads
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");

    // Create schema
    this.db.exec(CREATE_TABLE);
    for (const idx of CREATE_INDEXES) {
      this.db.exec(idx);
    }

    // Prepare insert statement
    this.insertStmt = this.db.prepare(INSERT_EVENT);
  }

  /**
   * INSERT a single event. INSERT OR IGNORE to handle duplicates gracefully.
   * No UPDATE, no DELETE — structurally append-only.
   */
  insert(event: AuditEvent): void {
    this.insertStmt.run({
      event_id: event.event_id,
      timestamp: event.timestamp,
      category: event.category,
      action: event.action,
      session_id: event.session_id,
      thread_id: event.thread_id,
      turn_id: event.turn_id,
      item_id: event.item_id,
      client_id: event.client_id,
      details: JSON.stringify(event.details),
      policy_rule_id: event.policy_rule_id,
      risk_level: event.risk_level,
    });
  }

  /**
   * Query events with flexible filtering.
   * Supports session_id, thread_id, category, time range, limit, and cursor pagination.
   */
  query(filter: AuditFilter): AuditQueryResult {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (filter.session_id) {
      conditions.push("session_id = @session_id");
      params.session_id = filter.session_id;
    }

    if (filter.thread_id) {
      conditions.push("thread_id = @thread_id");
      params.thread_id = filter.thread_id;
    }

    if (filter.category) {
      conditions.push("category = @category");
      params.category = filter.category;
    }

    if (filter.since) {
      conditions.push("timestamp >= @since");
      params.since = filter.since;
    }

    if (filter.until) {
      conditions.push("timestamp <= @until");
      params.until = filter.until;
    }

    if (filter.cursor) {
      conditions.push("timestamp > @cursor");
      params.cursor = filter.cursor;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = filter.limit ?? 100;

    // Count total matching events (without limit)
    const countSql = `SELECT COUNT(*) as cnt FROM audit_events ${where}`;
    const countRow = this.db.prepare(countSql).get(params) as { cnt: number };
    const totalCount = countRow.cnt;

    // Fetch events with limit + 1 to detect has_more
    const fetchSql = `SELECT * FROM audit_events ${where} ORDER BY timestamp ASC LIMIT @limit`;
    params.limit = limit + 1;

    const rows = this.db.prepare(fetchSql).all(params) as Array<Record<string, unknown>>;

    const hasMore = rows.length > limit;
    const resultRows = hasMore ? rows.slice(0, limit) : rows;

    const events: AuditEvent[] = resultRows.map((row) => ({
      event_id: row.event_id as string,
      timestamp: row.timestamp as string,
      category: row.category as string as AuditEvent["category"],
      action: row.action as string,
      session_id: (row.session_id as string) ?? null,
      thread_id: (row.thread_id as string) ?? null,
      turn_id: (row.turn_id as string) ?? null,
      item_id: (row.item_id as string) ?? null,
      client_id: (row.client_id as string) ?? null,
      details: JSON.parse(row.details as string) as Record<string, unknown>,
      policy_rule_id: (row.policy_rule_id as string) ?? null,
      risk_level: (row.risk_level as string) ?? null,
    }));

    const result: AuditQueryResult = {
      events,
      total_count: totalCount,
      has_more: hasMore,
    };

    if (hasMore && events.length > 0) {
      result.next_cursor = events[events.length - 1]!.timestamp;
    }

    return result;
  }

  /**
   * Get total event count.
   */
  getEventCount(): number {
    const row = this.db.prepare("SELECT COUNT(*) as cnt FROM audit_events").get() as { cnt: number };
    return row.cnt;
  }

  /**
   * Drop and recreate the table. Used before rebuild from JSONL.
   */
  dropAndRecreate(): void {
    this.db.exec("DROP TABLE IF EXISTS audit_events");
    this.db.exec(CREATE_TABLE);
    for (const idx of CREATE_INDEXES) {
      this.db.exec(idx);
    }
    // Re-prepare statement after table recreation
    this.insertStmt = this.db.prepare(INSERT_EVENT);
  }

  /**
   * Bulk insert events within a transaction (used by rebuild).
   */
  bulkInsert(events: AuditEvent[]): void {
    const transaction = this.db.transaction((evts: AuditEvent[]) => {
      for (const event of evts) {
        this.insert(event);
      }
    });
    transaction(events);
  }

  /**
   * Get the SQLite database file size in bytes.
   */
  getDbSizeBytes(): number {
    // Use pragma to get page count and page size
    const pageCount = (this.db.pragma("page_count", { simple: true }) as number) ?? 0;
    const pageSize = (this.db.pragma("page_size", { simple: true }) as number) ?? 4096;
    return pageCount * pageSize;
  }

  /**
   * Close the database connection. Must be called during shutdown.
   */
  close(): void {
    this.db.close();
  }
}
