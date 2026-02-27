// S4: SQLite persistence for approval records
// WAL mode for concurrent reads during writes
// Stores pending, approved, denied, and expired approvals

import Database from "better-sqlite3";
import type { Database as DatabaseType, Statement } from "better-sqlite3";
import type { ApprovalTier, PendingApproval } from "@observer/shared";

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS approvals (
  approval_id TEXT PRIMARY KEY,
  thread_id   TEXT NOT NULL,
  session_id  TEXT NOT NULL,
  description TEXT NOT NULL,
  risk_level  TEXT NOT NULL,
  tier        TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  timeout_at  TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',
  decided_by  TEXT,
  decided_at  TEXT,
  reason      TEXT,
  context     TEXT NOT NULL DEFAULT '{}'
)`;

const CREATE_INDEXES = [
  "CREATE INDEX IF NOT EXISTS idx_approvals_session_id ON approvals (session_id)",
  "CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals (status)",
  "CREATE INDEX IF NOT EXISTS idx_approvals_timeout_at ON approvals (timeout_at)",
  "CREATE INDEX IF NOT EXISTS idx_approvals_thread_id ON approvals (thread_id)",
];

export interface ApprovalStoreOptions {
  /** Path to SQLite file, or ":memory:" for testing */
  dbPath: string;
}

export interface ApprovalRow {
  approval_id: string;
  thread_id: string;
  session_id: string;
  description: string;
  risk_level: string;
  tier: string;
  created_at: string;
  timeout_at: string;
  status: string;
  decided_by: string | null;
  decided_at: string | null;
  reason: string | null;
  context: string;
}

export class ApprovalStore {
  private readonly db: DatabaseType;
  private readonly stmtInsert: Statement;
  private readonly stmtGetById: Statement;
  private readonly stmtUpdateDecision: Statement;
  private readonly stmtGetPendingBySession: Statement;
  private readonly stmtGetAllPending: Statement;
  private readonly stmtGetExpiredPending: Statement;
  private readonly stmtExpireBatch: Statement;

  constructor(options: ApprovalStoreOptions) {
    this.db = new Database(options.dbPath);

    // WAL mode for better concurrency
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");

    // Create schema
    this.db.exec(CREATE_TABLE);
    for (const idx of CREATE_INDEXES) {
      this.db.exec(idx);
    }

    // Prepare statements
    this.stmtInsert = this.db.prepare(`
      INSERT INTO approvals (
        approval_id, thread_id, session_id, description,
        risk_level, tier, created_at, timeout_at, status, context
      ) VALUES (
        @approval_id, @thread_id, @session_id, @description,
        @risk_level, @tier, @created_at, @timeout_at, @status, @context
      )
    `);

    this.stmtGetById = this.db.prepare(
      "SELECT * FROM approvals WHERE approval_id = ?",
    );

    this.stmtUpdateDecision = this.db.prepare(`
      UPDATE approvals
         SET status     = @status,
             decided_by = @decided_by,
             decided_at = @decided_at,
             reason     = @reason
       WHERE approval_id = @approval_id
    `);

    this.stmtGetPendingBySession = this.db.prepare(
      "SELECT * FROM approvals WHERE session_id = ? AND status = 'pending' ORDER BY created_at ASC",
    );

    this.stmtGetAllPending = this.db.prepare(
      "SELECT * FROM approvals WHERE status = 'pending' ORDER BY created_at ASC",
    );

    this.stmtGetExpiredPending = this.db.prepare(
      "SELECT * FROM approvals WHERE status = 'pending' AND timeout_at <= ?",
    );

    this.stmtExpireBatch = this.db.prepare(`
      UPDATE approvals
         SET status     = 'expired',
             decided_by = 'system:timeout',
             decided_at = @decided_at,
             reason     = 'Approval timed out (fail safe: timeout = denied)'
       WHERE approval_id = @approval_id AND status = 'pending'
    `);
  }

  /**
   * Insert a new approval record.
   */
  insert(approval: {
    approval_id: string;
    thread_id: string;
    session_id: string;
    description: string;
    risk_level: string;
    tier: ApprovalTier;
    created_at: string;
    timeout_at: string;
    context: Record<string, unknown>;
  }): void {
    this.stmtInsert.run({
      approval_id: approval.approval_id,
      thread_id: approval.thread_id,
      session_id: approval.session_id,
      description: approval.description,
      risk_level: approval.risk_level,
      tier: approval.tier,
      created_at: approval.created_at,
      timeout_at: approval.timeout_at,
      status: "pending",
      context: JSON.stringify(approval.context),
    });
  }

  /**
   * Get a single approval by ID.
   */
  getById(approvalId: string): ApprovalRow | null {
    const row = this.stmtGetById.get(approvalId) as ApprovalRow | undefined;
    return row ?? null;
  }

  /**
   * Update an approval with a decision (approved or denied).
   */
  updateDecision(params: {
    approval_id: string;
    status: "approved" | "denied";
    decided_by: string;
    decided_at: string;
    reason: string | null;
  }): void {
    this.stmtUpdateDecision.run(params);
  }

  /**
   * Get all pending approvals for a specific session.
   */
  getPendingBySession(sessionId: string): PendingApproval[] {
    const rows = this.stmtGetPendingBySession.all(sessionId) as ApprovalRow[];
    return rows.map(rowToPendingApproval);
  }

  /**
   * Get all pending approvals across all sessions.
   */
  getAllPending(): PendingApproval[] {
    const rows = this.stmtGetAllPending.all() as ApprovalRow[];
    return rows.map(rowToPendingApproval);
  }

  /**
   * Find all pending approvals that have passed their timeout.
   * Returns the rows so the caller can process them.
   */
  getExpiredPending(now: string): ApprovalRow[] {
    return this.stmtGetExpiredPending.all(now) as ApprovalRow[];
  }

  /**
   * Expire a batch of approvals in a single transaction.
   * Returns the count of expired approvals.
   */
  expireBatch(approvalIds: string[], decidedAt: string): number {
    let count = 0;
    const txn = this.db.transaction((ids: string[]) => {
      for (const id of ids) {
        const result = this.stmtExpireBatch.run({
          approval_id: id,
          decided_at: decidedAt,
        });
        count += result.changes;
      }
    });
    txn(approvalIds);
    return count;
  }

  /**
   * Close the database connection.
   */
  close(): void {
    this.db.close();
  }
}

function rowToPendingApproval(row: ApprovalRow): PendingApproval {
  return {
    approval_id: row.approval_id,
    thread_id: row.thread_id,
    session_id: row.session_id,
    description: row.description,
    risk_level: row.risk_level,
    tier: row.tier as ApprovalTier,
    created_at: row.created_at,
    timeout_at: row.timeout_at,
    status: row.status as PendingApproval["status"],
  };
}
