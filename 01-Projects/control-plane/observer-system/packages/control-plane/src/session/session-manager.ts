// S1: Session Manager -- Session/thread/turn CRUD with state machine enforcement
// Implements the SessionManager interface from @observer/shared.
// Delegates persistence to SqliteSessionStore and transition validation
// to the state machine module.

import type {
  Session,
  Thread,
  Turn,
  Attachment,
  ClientType,
  IntentType,
  ThreadStatus,
  SessionManager,
} from "@observer/shared";
import {
  generateId,
  ObserverErrorCode,
  createError,
} from "@observer/shared";

import { SqliteSessionStore } from "./session-store.js";
import { assertTransition, ACTIVE_THREAD_STATUSES } from "./state-machine.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface SessionManagerOptions {
  /** Path to SQLite database, or ":memory:" for testing */
  dbPath: string;
  /** Idle session timeout in milliseconds (default: 72 hours) */
  idleTimeoutMs?: number;
}

const DEFAULT_IDLE_TIMEOUT_MS = 72 * 60 * 60 * 1000; // 72 hours

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class SessionManagerImpl implements SessionManager {
  private readonly store: SqliteSessionStore;
  private readonly idleTimeoutMs: number;

  constructor(options: SessionManagerOptions) {
    this.store = new SqliteSessionStore({ dbPath: options.dbPath });
    this.idleTimeoutMs = options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
  }

  // -----------------------------------------------------------------------
  // Session operations
  // -----------------------------------------------------------------------

  async createSession(
    clientType: ClientType,
    clientId: string,
  ): Promise<Session> {
    const now = new Date().toISOString();
    const session: Session = {
      id: generateId("session"),
      client_type: clientType,
      client_id: clientId,
      created_at: now,
      last_active_at: now,
      status: "active",
      thread_ids: [],
    };
    await this.store.saveSession(session);
    return session;
  }

  async getSession(id: string): Promise<Session | null> {
    return this.store.loadSession(id);
  }

  async resumeSession(id: string): Promise<Session> {
    const session = await this.store.loadSession(id);
    if (!session) {
      throw createError(
        ObserverErrorCode.SessionNotFound,
        `Session not found: ${id}`,
        { type: "session_not_found", session_id: id },
      );
    }
    if (session.status === "closed") {
      throw createError(
        ObserverErrorCode.InvalidParams,
        `Cannot resume closed session: ${id}`,
        {
          type: "validation_failed",
          field: "session_id",
          message: "Session is closed and cannot be resumed",
        },
      );
    }
    // Touch last_active and ensure status is active
    session.last_active_at = new Date().toISOString();
    session.status = "active";
    await this.store.saveSession(session);
    return session;
  }

  async closeSession(id: string): Promise<void> {
    const session = await this.store.loadSession(id);
    if (!session) {
      throw createError(
        ObserverErrorCode.SessionNotFound,
        `Session not found: ${id}`,
        { type: "session_not_found", session_id: id },
      );
    }
    session.status = "closed";
    session.last_active_at = new Date().toISOString();
    await this.store.saveSession(session);
  }

  // -----------------------------------------------------------------------
  // Thread operations
  // -----------------------------------------------------------------------

  async createThread(
    sessionId: string,
    intent: string,
    intentType: IntentType,
    _context?: Record<string, unknown>,
    metadata?: Record<string, unknown>,
  ): Promise<Thread> {
    const session = await this.store.loadSession(sessionId);
    if (!session) {
      throw createError(
        ObserverErrorCode.SessionNotFound,
        `Session not found: ${sessionId}`,
        { type: "session_not_found", session_id: sessionId },
      );
    }
    if (session.status === "closed") {
      throw createError(
        ObserverErrorCode.InvalidParams,
        `Cannot create thread on closed session: ${sessionId}`,
        {
          type: "validation_failed",
          field: "session_id",
          message: "Session is closed",
        },
      );
    }

    const now = new Date().toISOString();
    const thread: Thread = {
      id: generateId("thread"),
      session_id: sessionId,
      intent,
      intent_type: intentType,
      status: "open",
      created_at: now,
      updated_at: now,
      turn_ids: [],
      metadata: metadata ?? {},
    };

    await this.store.saveThread(thread);

    // Update session with new thread reference
    session.thread_ids.push(thread.id);
    session.last_active_at = now;
    await this.store.saveSession(session);

    return thread;
  }

  async getThread(id: string): Promise<Thread | null> {
    return this.store.loadThread(id);
  }

  async updateThreadStatus(id: string, status: ThreadStatus): Promise<void> {
    const thread = await this.store.loadThread(id);
    if (!thread) {
      throw createError(
        ObserverErrorCode.ThreadNotFound,
        `Thread not found: ${id}`,
        { type: "thread_not_found", thread_id: id },
      );
    }

    // State machine enforcement -- throws on invalid transition
    assertTransition(thread.status, status, id);

    thread.status = status;
    thread.updated_at = new Date().toISOString();
    await this.store.saveThread(thread);
  }

  async cancelThread(id: string): Promise<void> {
    const thread = await this.store.loadThread(id);
    if (!thread) {
      throw createError(
        ObserverErrorCode.ThreadNotFound,
        `Thread not found: ${id}`,
        { type: "thread_not_found", thread_id: id },
      );
    }

    // "cancelled" is reachable from any non-cancelled state
    assertTransition(thread.status, "cancelled", id);

    thread.status = "cancelled";
    thread.updated_at = new Date().toISOString();
    await this.store.saveThread(thread);
  }

  // -----------------------------------------------------------------------
  // Turn operations
  // -----------------------------------------------------------------------

  async createTurn(
    threadId: string,
    message: string,
    attachments?: Attachment[],
  ): Promise<Turn> {
    const thread = await this.store.loadThread(threadId);
    if (!thread) {
      throw createError(
        ObserverErrorCode.ThreadNotFound,
        `Thread not found: ${threadId}`,
        { type: "thread_not_found", thread_id: threadId },
      );
    }

    const now = new Date().toISOString();
    const turn: Turn = {
      id: generateId("turn"),
      thread_id: threadId,
      message,
      attachments: attachments ?? [],
      status: "submitted",
      created_at: now,
      completed_at: null,
      item_ids: [],
    };

    await this.store.saveTurn(turn);

    // Update thread with new turn reference
    thread.turn_ids.push(turn.id);
    thread.updated_at = now;
    await this.store.saveThread(thread);

    return turn;
  }

  async completeTurn(id: string, _summary: string): Promise<void> {
    const turn = await this.store.loadTurn(id);
    if (!turn) {
      throw createError(
        ObserverErrorCode.InvalidParams,
        `Turn not found: ${id}`,
        { type: "validation_failed", field: "turn_id", message: "Turn not found" },
      );
    }

    turn.status = "completed";
    turn.completed_at = new Date().toISOString();
    await this.store.saveTurn(turn);
  }

  // -----------------------------------------------------------------------
  // Idle session cleanup
  // -----------------------------------------------------------------------

  /**
   * Close sessions whose last_active_at exceeds the idle timeout,
   * but SKIP sessions that have threads in active statuses
   * (processing, executing, awaiting_approval).
   *
   * Returns the number of sessions closed.
   */
  async cleanupIdleSessions(): Promise<number> {
    const cutoff = new Date(Date.now() - this.idleTimeoutMs).toISOString();
    const activeSessions = await this.store.listActiveSessions();
    let closedCount = 0;

    for (const session of activeSessions) {
      if (session.last_active_at >= cutoff) continue;

      // Check if any thread is still active
      const threads = await this.store.listThreadsBySession(session.id);
      const hasActiveThread = threads.some((t) =>
        ACTIVE_THREAD_STATUSES.has(t.status),
      );

      if (hasActiveThread) continue;

      session.status = "closed";
      await this.store.saveSession(session);
      closedCount++;
    }

    return closedCount;
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /**
   * Expose the underlying store for direct access in tests or for
   * the SessionStore interface contract.
   */
  getStore(): SqliteSessionStore {
    return this.store;
  }

  close(): void {
    this.store.close();
  }
}
