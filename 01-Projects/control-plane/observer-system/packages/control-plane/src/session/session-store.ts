// S1: SQLite-backed session, thread, and turn persistence
// Uses better-sqlite3 with prepared statements for performance.
// All public methods are async (returns Promises) per the SessionStore interface,
// but the underlying SQLite calls are synchronous -- the async wrapper keeps
// the contract compatible with future migration to async drivers.

import Database from "better-sqlite3";
import type { Database as DatabaseType, Statement } from "better-sqlite3";
import type { Session, Thread, Turn, Attachment, ThreadStatus } from "@observer/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionStoreOptions {
  /** Path to SQLite file, or ":memory:" for testing */
  dbPath: string;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export class SqliteSessionStore {
  private readonly db: DatabaseType;

  // Prepared statements -- initialised in constructor after schema migration
  private readonly stmtInsertSession: Statement;
  private readonly stmtUpdateSession: Statement;
  private readonly stmtLoadSession: Statement;
  private readonly stmtListActiveSessions: Statement;

  private readonly stmtInsertThread: Statement;
  private readonly stmtUpdateThread: Statement;
  private readonly stmtLoadThread: Statement;
  private readonly stmtListThreadsBySession: Statement;

  private readonly stmtInsertTurn: Statement;
  private readonly stmtUpdateTurn: Statement;
  private readonly stmtLoadTurn: Statement;
  private readonly stmtListTurnsByThread: Statement;

  constructor(options: SessionStoreOptions) {
    this.db = new Database(options.dbPath);

    // WAL mode for better concurrency; foreign keys for referential integrity
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");

    this.migrate();

    // --- Sessions -----------------------------------------------------------
    this.stmtInsertSession = this.db.prepare(`
      INSERT INTO sessions (id, client_type, client_id, created_at, last_active_at, status, thread_ids)
      VALUES (@id, @client_type, @client_id, @created_at, @last_active_at, @status, @thread_ids)
    `);

    this.stmtUpdateSession = this.db.prepare(`
      UPDATE sessions
         SET last_active_at = @last_active_at,
             status         = @status,
             thread_ids     = @thread_ids
       WHERE id = @id
    `);

    this.stmtLoadSession = this.db.prepare(`
      SELECT id, client_type, client_id, created_at, last_active_at, status, thread_ids
        FROM sessions WHERE id = ?
    `);

    this.stmtListActiveSessions = this.db.prepare(`
      SELECT id, client_type, client_id, created_at, last_active_at, status, thread_ids
        FROM sessions WHERE status != 'closed'
    `);

    // --- Threads ------------------------------------------------------------
    this.stmtInsertThread = this.db.prepare(`
      INSERT INTO threads (id, session_id, intent, intent_type, status, created_at, updated_at, turn_ids, metadata)
      VALUES (@id, @session_id, @intent, @intent_type, @status, @created_at, @updated_at, @turn_ids, @metadata)
    `);

    this.stmtUpdateThread = this.db.prepare(`
      UPDATE threads
         SET status     = @status,
             updated_at = @updated_at,
             turn_ids   = @turn_ids,
             metadata   = @metadata
       WHERE id = @id
    `);

    this.stmtLoadThread = this.db.prepare(`
      SELECT id, session_id, intent, intent_type, status, created_at, updated_at, turn_ids, metadata
        FROM threads WHERE id = ?
    `);

    this.stmtListThreadsBySession = this.db.prepare(`
      SELECT id, session_id, intent, intent_type, status, created_at, updated_at, turn_ids, metadata
        FROM threads WHERE session_id = ?
    `);

    // --- Turns --------------------------------------------------------------
    this.stmtInsertTurn = this.db.prepare(`
      INSERT INTO turns (id, thread_id, message, attachments, status, created_at, completed_at, item_ids)
      VALUES (@id, @thread_id, @message, @attachments, @status, @created_at, @completed_at, @item_ids)
    `);

    this.stmtUpdateTurn = this.db.prepare(`
      UPDATE turns
         SET status       = @status,
             completed_at = @completed_at,
             item_ids     = @item_ids
       WHERE id = @id
    `);

    this.stmtLoadTurn = this.db.prepare(`
      SELECT id, thread_id, message, attachments, status, created_at, completed_at, item_ids
        FROM turns WHERE id = ?
    `);

    this.stmtListTurnsByThread = this.db.prepare(`
      SELECT id, thread_id, message, attachments, status, created_at, completed_at, item_ids
        FROM turns WHERE thread_id = ?
    `);
  }

  // -------------------------------------------------------------------------
  // Schema
  // -------------------------------------------------------------------------

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id              TEXT PRIMARY KEY,
        client_type     TEXT NOT NULL,
        client_id       TEXT NOT NULL,
        created_at      TEXT NOT NULL,
        last_active_at  TEXT NOT NULL,
        status          TEXT NOT NULL,
        thread_ids      TEXT NOT NULL DEFAULT '[]'
      );

      CREATE TABLE IF NOT EXISTS threads (
        id          TEXT PRIMARY KEY,
        session_id  TEXT NOT NULL REFERENCES sessions(id),
        intent      TEXT NOT NULL,
        intent_type TEXT NOT NULL,
        status      TEXT NOT NULL,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        turn_ids    TEXT NOT NULL DEFAULT '[]',
        metadata    TEXT NOT NULL DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS turns (
        id           TEXT PRIMARY KEY,
        thread_id    TEXT NOT NULL REFERENCES threads(id),
        message      TEXT NOT NULL,
        attachments  TEXT NOT NULL DEFAULT '[]',
        status       TEXT NOT NULL,
        created_at   TEXT NOT NULL,
        completed_at TEXT,
        item_ids     TEXT NOT NULL DEFAULT '[]'
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_client_status
        ON sessions(client_id, status);

      CREATE INDEX IF NOT EXISTS idx_threads_session_status
        ON threads(session_id, status);

      CREATE INDEX IF NOT EXISTS idx_sessions_last_active
        ON sessions(last_active_at);

      CREATE INDEX IF NOT EXISTS idx_turns_thread
        ON turns(thread_id);
    `);
  }

  // -------------------------------------------------------------------------
  // Session CRUD
  // -------------------------------------------------------------------------

  async saveSession(session: Session): Promise<void> {
    const row = this.sessionToRow(session);
    // Upsert: try insert, fall back to update
    const existing = this.stmtLoadSession.get(session.id) as object | undefined;
    if (existing) {
      this.stmtUpdateSession.run(row);
    } else {
      this.stmtInsertSession.run(row);
    }
  }

  async loadSession(id: string): Promise<Session | null> {
    const row = this.stmtLoadSession.get(id) as SessionRow | undefined;
    if (!row) return null;
    return this.rowToSession(row);
  }

  async listActiveSessions(): Promise<Session[]> {
    const rows = this.stmtListActiveSessions.all() as SessionRow[];
    return rows.map((r) => this.rowToSession(r));
  }

  // -------------------------------------------------------------------------
  // Thread CRUD
  // -------------------------------------------------------------------------

  async saveThread(thread: Thread): Promise<void> {
    const row = this.threadToRow(thread);
    const existing = this.stmtLoadThread.get(thread.id) as object | undefined;
    if (existing) {
      this.stmtUpdateThread.run(row);
    } else {
      this.stmtInsertThread.run(row);
    }
  }

  async loadThread(id: string): Promise<Thread | null> {
    const row = this.stmtLoadThread.get(id) as ThreadRow | undefined;
    if (!row) return null;
    return this.rowToThread(row);
  }

  async listThreadsBySession(sessionId: string): Promise<Thread[]> {
    const rows = this.stmtListThreadsBySession.all(sessionId) as ThreadRow[];
    return rows.map((r) => this.rowToThread(r));
  }

  // -------------------------------------------------------------------------
  // Turn CRUD
  // -------------------------------------------------------------------------

  async saveTurn(turn: Turn): Promise<void> {
    const row = this.turnToRow(turn);
    const existing = this.stmtLoadTurn.get(turn.id) as object | undefined;
    if (existing) {
      this.stmtUpdateTurn.run(row);
    } else {
      this.stmtInsertTurn.run(row);
    }
  }

  async loadTurn(id: string): Promise<Turn | null> {
    const row = this.stmtLoadTurn.get(id) as TurnRow | undefined;
    if (!row) return null;
    return this.rowToTurn(row);
  }

  async listTurnsByThread(threadId: string): Promise<Turn[]> {
    const rows = this.stmtListTurnsByThread.all(threadId) as TurnRow[];
    return rows.map((r) => this.rowToTurn(r));
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  close(): void {
    this.db.close();
  }

  // -------------------------------------------------------------------------
  // Row to/from Domain mapping
  // -------------------------------------------------------------------------

  private sessionToRow(s: Session): SessionRow {
    return {
      id: s.id,
      client_type: s.client_type,
      client_id: s.client_id,
      created_at: s.created_at,
      last_active_at: s.last_active_at,
      status: s.status,
      thread_ids: JSON.stringify(s.thread_ids),
    };
  }

  private rowToSession(r: SessionRow): Session {
    return {
      id: r.id,
      client_type: r.client_type as Session["client_type"],
      client_id: r.client_id,
      created_at: r.created_at,
      last_active_at: r.last_active_at,
      status: r.status as Session["status"],
      thread_ids: JSON.parse(r.thread_ids) as string[],
    };
  }

  private threadToRow(t: Thread): ThreadRow {
    return {
      id: t.id,
      session_id: t.session_id,
      intent: t.intent,
      intent_type: t.intent_type,
      status: t.status,
      created_at: t.created_at,
      updated_at: t.updated_at,
      turn_ids: JSON.stringify(t.turn_ids),
      metadata: JSON.stringify(t.metadata),
    };
  }

  private rowToThread(r: ThreadRow): Thread {
    return {
      id: r.id,
      session_id: r.session_id,
      intent: r.intent,
      intent_type: r.intent_type as Thread["intent_type"],
      status: r.status as ThreadStatus,
      created_at: r.created_at,
      updated_at: r.updated_at,
      turn_ids: JSON.parse(r.turn_ids) as string[],
      metadata: JSON.parse(r.metadata) as Record<string, unknown>,
    };
  }

  private turnToRow(t: Turn): TurnRow {
    return {
      id: t.id,
      thread_id: t.thread_id,
      message: t.message,
      attachments: JSON.stringify(t.attachments),
      status: t.status,
      created_at: t.created_at,
      completed_at: t.completed_at,
      item_ids: JSON.stringify(t.item_ids),
    };
  }

  private rowToTurn(r: TurnRow): Turn {
    return {
      id: r.id,
      thread_id: r.thread_id,
      message: r.message,
      attachments: JSON.parse(r.attachments) as Attachment[],
      status: r.status as Turn["status"],
      created_at: r.created_at,
      completed_at: r.completed_at,
      item_ids: JSON.parse(r.item_ids) as string[],
    };
  }
}

// ---------------------------------------------------------------------------
// Row types (SQLite string serialisation of JSON columns)
// ---------------------------------------------------------------------------

interface SessionRow {
  id: string;
  client_type: string;
  client_id: string;
  created_at: string;
  last_active_at: string;
  status: string;
  thread_ids: string; // JSON array
}

interface ThreadRow {
  id: string;
  session_id: string;
  intent: string;
  intent_type: string;
  status: string;
  created_at: string;
  updated_at: string;
  turn_ids: string; // JSON array
  metadata: string; // JSON object
}

interface TurnRow {
  id: string;
  thread_id: string;
  message: string;
  attachments: string; // JSON array
  status: string;
  created_at: string;
  completed_at: string | null;
  item_ids: string; // JSON array
}
