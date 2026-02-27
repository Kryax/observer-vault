// S1 Test Suite: Session Manager
// Covers all ISC criteria:
//   1. createSession() returns Session with valid ses_ ID and active status
//   2. createThread() returns Thread with valid thr_ ID and open status
//   3. Invalid state transitions throw errors
//   4. SQLite persistence survives simulated restart
//   5. Idle cleanup closes sessions with last_active_at > 72h (configurable)
//   6. Cleanup skips sessions with active threads

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SessionManagerImpl } from "../session-manager.js";
import { SqliteSessionStore } from "../session-store.js";
import {
  isValidTransition,
  assertTransition,
  validNextStatuses,
  TERMINAL_STATUSES,
  ACTIVE_THREAD_STATUSES,
} from "../state-machine.js";
import type { ThreadStatus } from "@observer/shared";
import { ObserverErrorCode } from "@observer/shared";
import type { JsonRpcError } from "@observer/shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Temporary in-memory DB path for isolation between tests */
function createManager(
  opts?: Partial<{ idleTimeoutMs: number }>,
): SessionManagerImpl {
  return new SessionManagerImpl({
    dbPath: ":memory:",
    ...opts,
  });
}

// ---------------------------------------------------------------------------
// State Machine Tests
// ---------------------------------------------------------------------------

describe("StateMachine", () => {
  describe("isValidTransition", () => {
    // --- Valid transitions ---
    const validPairs: Array<[ThreadStatus, ThreadStatus]> = [
      ["open", "processing"],
      ["processing", "awaiting_approval"],
      ["processing", "executing"],
      ["processing", "interrupted"],
      ["awaiting_approval", "executing"],
      ["awaiting_approval", "interrupted"],
      ["executing", "completed"],
      ["executing", "failed"],
      ["executing", "interrupted"],
    ];

    it.each(validPairs)(
      "allows %s -> %s",
      (from, to) => {
        expect(isValidTransition(from, to)).toBe(true);
      },
    );

    // --- Cancel from any non-cancelled state ---
    const cancellableStates: ThreadStatus[] = [
      "open",
      "processing",
      "awaiting_approval",
      "executing",
      "completed",
      "failed",
      "interrupted",
    ];

    it.each(cancellableStates)(
      "allows %s -> cancelled",
      (from) => {
        expect(isValidTransition(from, "cancelled")).toBe(true);
      },
    );

    it("disallows cancelled -> cancelled", () => {
      expect(isValidTransition("cancelled", "cancelled")).toBe(false);
    });

    // --- Invalid transitions ---
    const invalidPairs: Array<[ThreadStatus, ThreadStatus]> = [
      ["open", "completed"],
      ["open", "failed"],
      ["open", "awaiting_approval"],
      ["open", "executing"],
      ["open", "interrupted"],
      ["processing", "open"],
      ["processing", "completed"],
      ["awaiting_approval", "open"],
      ["awaiting_approval", "completed"],
      ["awaiting_approval", "failed"],
      ["executing", "open"],
      ["executing", "processing"],
      ["executing", "awaiting_approval"],
      ["completed", "open"],
      ["completed", "processing"],
      ["completed", "executing"],
      ["failed", "open"],
      ["failed", "processing"],
      ["interrupted", "open"],
      ["interrupted", "processing"],
    ];

    it.each(invalidPairs)(
      "rejects %s -> %s",
      (from, to) => {
        expect(isValidTransition(from, to)).toBe(false);
      },
    );
  });

  describe("assertTransition", () => {
    it("does not throw for valid transitions", () => {
      expect(() =>
        assertTransition("open", "processing", "thr_test123"),
      ).not.toThrow();
    });

    it("throws JsonRpcError for invalid transitions", () => {
      try {
        assertTransition("open", "completed", "thr_test123");
        expect.fail("Should have thrown");
      } catch (err) {
        const error = err as JsonRpcError;
        expect(error.code).toBe(ObserverErrorCode.InvalidParams);
        expect(error.message).toContain("open");
        expect(error.message).toContain("completed");
        expect(error.message).toContain("thr_test123");
      }
    });
  });

  describe("validNextStatuses", () => {
    it("returns processing and cancelled for open", () => {
      const next = validNextStatuses("open");
      expect(next).toContain("processing");
      expect(next).toContain("cancelled");
      expect(next).toHaveLength(2);
    });

    it("returns empty array for cancelled (terminal)", () => {
      expect(validNextStatuses("cancelled")).toHaveLength(0);
    });
  });

  describe("constants", () => {
    it("TERMINAL_STATUSES contains correct values", () => {
      expect(TERMINAL_STATUSES.has("completed")).toBe(true);
      expect(TERMINAL_STATUSES.has("failed")).toBe(true);
      expect(TERMINAL_STATUSES.has("cancelled")).toBe(true);
      expect(TERMINAL_STATUSES.has("interrupted")).toBe(true);
      expect(TERMINAL_STATUSES.has("open")).toBe(false);
    });

    it("ACTIVE_THREAD_STATUSES contains correct values", () => {
      expect(ACTIVE_THREAD_STATUSES.has("processing")).toBe(true);
      expect(ACTIVE_THREAD_STATUSES.has("executing")).toBe(true);
      expect(ACTIVE_THREAD_STATUSES.has("awaiting_approval")).toBe(true);
      expect(ACTIVE_THREAD_STATUSES.has("open")).toBe(false);
      expect(ACTIVE_THREAD_STATUSES.has("completed")).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Session CRUD Tests
// ---------------------------------------------------------------------------

describe("SessionManager", () => {
  let mgr: SessionManagerImpl;

  beforeEach(() => {
    mgr = createManager();
  });

  afterEach(() => {
    mgr.close();
  });

  // --- ISC-1: createSession returns valid Session ---
  describe("createSession", () => {
    it("returns a Session with ses_ prefixed ID and active status", async () => {
      const session = await mgr.createSession("cli", "user-1");

      expect(session.id).toMatch(/^ses_[a-z0-9]{12}$/);
      expect(session.client_type).toBe("cli");
      expect(session.client_id).toBe("user-1");
      expect(session.status).toBe("active");
      expect(session.thread_ids).toEqual([]);
      expect(session.created_at).toBeTruthy();
      expect(session.last_active_at).toBeTruthy();
    });

    it("creates unique IDs for each session", async () => {
      const s1 = await mgr.createSession("cli", "user-1");
      const s2 = await mgr.createSession("cli", "user-1");
      expect(s1.id).not.toBe(s2.id);
    });

    it("supports all client types", async () => {
      const cli = await mgr.createSession("cli", "c1");
      const telegram = await mgr.createSession("telegram", "c2");
      const gui = await mgr.createSession("gui", "c3");
      const internal = await mgr.createSession("internal", "c4");

      expect(cli.client_type).toBe("cli");
      expect(telegram.client_type).toBe("telegram");
      expect(gui.client_type).toBe("gui");
      expect(internal.client_type).toBe("internal");
    });
  });

  describe("getSession", () => {
    it("returns null for non-existent session", async () => {
      const result = await mgr.getSession("ses_nonexistent");
      expect(result).toBeNull();
    });

    it("returns the session after creation", async () => {
      const session = await mgr.createSession("cli", "user-1");
      const loaded = await mgr.getSession(session.id);

      expect(loaded).not.toBeNull();
      expect(loaded!.id).toBe(session.id);
      expect(loaded!.client_type).toBe("cli");
      expect(loaded!.status).toBe("active");
    });
  });

  describe("resumeSession", () => {
    it("updates last_active_at and sets status to active", async () => {
      const session = await mgr.createSession("cli", "user-1");
      const originalTime = session.last_active_at;

      // Small delay to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      const resumed = await mgr.resumeSession(session.id);
      expect(resumed.status).toBe("active");
      expect(resumed.last_active_at >= originalTime).toBe(true);
    });

    it("throws for non-existent session", async () => {
      try {
        await mgr.resumeSession("ses_nonexistent");
        expect.fail("Should have thrown");
      } catch (err) {
        const error = err as JsonRpcError;
        expect(error.code).toBe(ObserverErrorCode.SessionNotFound);
      }
    });

    it("throws for closed session", async () => {
      const session = await mgr.createSession("cli", "user-1");
      await mgr.closeSession(session.id);

      try {
        await mgr.resumeSession(session.id);
        expect.fail("Should have thrown");
      } catch (err) {
        const error = err as JsonRpcError;
        expect(error.code).toBe(ObserverErrorCode.InvalidParams);
        expect(error.message).toContain("closed");
      }
    });
  });

  describe("closeSession", () => {
    it("sets session status to closed", async () => {
      const session = await mgr.createSession("cli", "user-1");
      await mgr.closeSession(session.id);

      const loaded = await mgr.getSession(session.id);
      expect(loaded!.status).toBe("closed");
    });

    it("throws for non-existent session", async () => {
      try {
        await mgr.closeSession("ses_nonexistent");
        expect.fail("Should have thrown");
      } catch (err) {
        const error = err as JsonRpcError;
        expect(error.code).toBe(ObserverErrorCode.SessionNotFound);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Thread CRUD Tests
// ---------------------------------------------------------------------------

describe("SessionManager threads", () => {
  let mgr: SessionManagerImpl;

  beforeEach(() => {
    mgr = createManager();
  });

  afterEach(() => {
    mgr.close();
  });

  // --- ISC-2: createThread returns valid Thread ---
  describe("createThread", () => {
    it("returns a Thread with thr_ prefixed ID and open status", async () => {
      const session = await mgr.createSession("cli", "user-1");
      const thread = await mgr.createThread(
        session.id,
        "Build authentication module",
        "build",
      );

      expect(thread.id).toMatch(/^thr_[a-z0-9]{12}$/);
      expect(thread.session_id).toBe(session.id);
      expect(thread.intent).toBe("Build authentication module");
      expect(thread.intent_type).toBe("build");
      expect(thread.status).toBe("open");
      expect(thread.turn_ids).toEqual([]);
      expect(thread.metadata).toEqual({});
    });

    it("adds thread ID to session.thread_ids", async () => {
      const session = await mgr.createSession("cli", "user-1");
      const thread = await mgr.createThread(session.id, "test", "query");

      const updated = await mgr.getSession(session.id);
      expect(updated!.thread_ids).toContain(thread.id);
    });

    it("accepts optional metadata", async () => {
      const session = await mgr.createSession("cli", "user-1");
      const thread = await mgr.createThread(
        session.id,
        "test",
        "build",
        undefined,
        { priority: "high" },
      );

      expect(thread.metadata).toEqual({ priority: "high" });
    });

    it("throws for non-existent session", async () => {
      try {
        await mgr.createThread("ses_nonexistent", "test", "query");
        expect.fail("Should have thrown");
      } catch (err) {
        const error = err as JsonRpcError;
        expect(error.code).toBe(ObserverErrorCode.SessionNotFound);
      }
    });

    it("throws for closed session", async () => {
      const session = await mgr.createSession("cli", "user-1");
      await mgr.closeSession(session.id);

      try {
        await mgr.createThread(session.id, "test", "query");
        expect.fail("Should have thrown");
      } catch (err) {
        const error = err as JsonRpcError;
        expect(error.code).toBe(ObserverErrorCode.InvalidParams);
      }
    });
  });

  describe("getThread", () => {
    it("returns null for non-existent thread", async () => {
      const result = await mgr.getThread("thr_nonexistent");
      expect(result).toBeNull();
    });
  });

  // --- ISC-3: Invalid state transitions throw errors ---
  describe("updateThreadStatus", () => {
    it("allows valid transition: open -> processing", async () => {
      const session = await mgr.createSession("cli", "user-1");
      const thread = await mgr.createThread(session.id, "test", "build");

      await mgr.updateThreadStatus(thread.id, "processing");

      const updated = await mgr.getThread(thread.id);
      expect(updated!.status).toBe("processing");
    });

    it("allows full valid lifecycle: open -> processing -> executing -> completed", async () => {
      const session = await mgr.createSession("cli", "user-1");
      const thread = await mgr.createThread(session.id, "test", "build");

      await mgr.updateThreadStatus(thread.id, "processing");
      await mgr.updateThreadStatus(thread.id, "executing");
      await mgr.updateThreadStatus(thread.id, "completed");

      const final = await mgr.getThread(thread.id);
      expect(final!.status).toBe("completed");
    });

    it("allows approval path: open -> processing -> awaiting_approval -> executing -> completed", async () => {
      const session = await mgr.createSession("cli", "user-1");
      const thread = await mgr.createThread(session.id, "test", "build");

      await mgr.updateThreadStatus(thread.id, "processing");
      await mgr.updateThreadStatus(thread.id, "awaiting_approval");
      await mgr.updateThreadStatus(thread.id, "executing");
      await mgr.updateThreadStatus(thread.id, "completed");

      const final = await mgr.getThread(thread.id);
      expect(final!.status).toBe("completed");
    });

    it("throws for invalid transition: open -> completed", async () => {
      const session = await mgr.createSession("cli", "user-1");
      const thread = await mgr.createThread(session.id, "test", "build");

      try {
        await mgr.updateThreadStatus(thread.id, "completed");
        expect.fail("Should have thrown");
      } catch (err) {
        const error = err as JsonRpcError;
        expect(error.code).toBe(ObserverErrorCode.InvalidParams);
        expect(error.message).toContain("open");
        expect(error.message).toContain("completed");
      }
    });

    it("throws for invalid transition: open -> executing", async () => {
      const session = await mgr.createSession("cli", "user-1");
      const thread = await mgr.createThread(session.id, "test", "build");

      try {
        await mgr.updateThreadStatus(thread.id, "executing");
        expect.fail("Should have thrown");
      } catch (err) {
        const error = err as JsonRpcError;
        expect(error.code).toBe(ObserverErrorCode.InvalidParams);
      }
    });

    it("throws for non-existent thread", async () => {
      try {
        await mgr.updateThreadStatus("thr_nonexistent", "processing");
        expect.fail("Should have thrown");
      } catch (err) {
        const error = err as JsonRpcError;
        expect(error.code).toBe(ObserverErrorCode.ThreadNotFound);
      }
    });

    it("updates updated_at timestamp on transition", async () => {
      const session = await mgr.createSession("cli", "user-1");
      const thread = await mgr.createThread(session.id, "test", "build");
      const originalTime = thread.updated_at;

      await new Promise((resolve) => setTimeout(resolve, 10));
      await mgr.updateThreadStatus(thread.id, "processing");

      const updated = await mgr.getThread(thread.id);
      expect(updated!.updated_at >= originalTime).toBe(true);
    });
  });

  describe("cancelThread", () => {
    it("cancels an open thread", async () => {
      const session = await mgr.createSession("cli", "user-1");
      const thread = await mgr.createThread(session.id, "test", "build");

      await mgr.cancelThread(thread.id);

      const updated = await mgr.getThread(thread.id);
      expect(updated!.status).toBe("cancelled");
    });

    it("cancels a processing thread", async () => {
      const session = await mgr.createSession("cli", "user-1");
      const thread = await mgr.createThread(session.id, "test", "build");
      await mgr.updateThreadStatus(thread.id, "processing");

      await mgr.cancelThread(thread.id);

      const updated = await mgr.getThread(thread.id);
      expect(updated!.status).toBe("cancelled");
    });

    it("throws for non-existent thread", async () => {
      try {
        await mgr.cancelThread("thr_nonexistent");
        expect.fail("Should have thrown");
      } catch (err) {
        const error = err as JsonRpcError;
        expect(error.code).toBe(ObserverErrorCode.ThreadNotFound);
      }
    });

    it("throws when cancelling an already-cancelled thread", async () => {
      const session = await mgr.createSession("cli", "user-1");
      const thread = await mgr.createThread(session.id, "test", "build");
      await mgr.cancelThread(thread.id);

      try {
        await mgr.cancelThread(thread.id);
        expect.fail("Should have thrown");
      } catch (err) {
        const error = err as JsonRpcError;
        expect(error.code).toBe(ObserverErrorCode.InvalidParams);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Turn Tests
// ---------------------------------------------------------------------------

describe("SessionManager turns", () => {
  let mgr: SessionManagerImpl;

  beforeEach(() => {
    mgr = createManager();
  });

  afterEach(() => {
    mgr.close();
  });

  describe("createTurn", () => {
    it("returns a Turn with trn_ prefixed ID and submitted status", async () => {
      const session = await mgr.createSession("cli", "user-1");
      const thread = await mgr.createThread(session.id, "test", "build");
      const turn = await mgr.createTurn(thread.id, "Please build the auth module");

      expect(turn.id).toMatch(/^trn_[a-z0-9]{12}$/);
      expect(turn.thread_id).toBe(thread.id);
      expect(turn.message).toBe("Please build the auth module");
      expect(turn.status).toBe("submitted");
      expect(turn.attachments).toEqual([]);
      expect(turn.completed_at).toBeNull();
      expect(turn.item_ids).toEqual([]);
    });

    it("adds turn ID to thread.turn_ids", async () => {
      const session = await mgr.createSession("cli", "user-1");
      const thread = await mgr.createThread(session.id, "test", "build");
      const turn = await mgr.createTurn(thread.id, "msg");

      const updated = await mgr.getThread(thread.id);
      expect(updated!.turn_ids).toContain(turn.id);
    });

    it("throws for non-existent thread", async () => {
      try {
        await mgr.createTurn("thr_nonexistent", "msg");
        expect.fail("Should have thrown");
      } catch (err) {
        const error = err as JsonRpcError;
        expect(error.code).toBe(ObserverErrorCode.ThreadNotFound);
      }
    });

    it("accepts attachments", async () => {
      const session = await mgr.createSession("cli", "user-1");
      const thread = await mgr.createThread(session.id, "test", "build");
      const turn = await mgr.createTurn(thread.id, "msg", [
        {
          id: "att_1",
          type: "text",
          content: "hello",
          sanitized: true,
          contains_sensitive: false,
        },
      ]);

      expect(turn.attachments).toHaveLength(1);
      expect(turn.attachments[0].content).toBe("hello");
    });
  });

  describe("completeTurn", () => {
    it("sets status to completed and sets completed_at", async () => {
      const session = await mgr.createSession("cli", "user-1");
      const thread = await mgr.createThread(session.id, "test", "build");
      const turn = await mgr.createTurn(thread.id, "msg");

      await mgr.completeTurn(turn.id, "Done");

      const store = mgr.getStore();
      const loaded = await store.loadTurn(turn.id);
      expect(loaded!.status).toBe("completed");
      expect(loaded!.completed_at).toBeTruthy();
    });

    it("throws for non-existent turn", async () => {
      try {
        await mgr.completeTurn("trn_nonexistent", "Done");
        expect.fail("Should have thrown");
      } catch (err) {
        const error = err as JsonRpcError;
        expect(error.code).toBe(ObserverErrorCode.InvalidParams);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// ISC-4: SQLite Persistence Survives Simulated Restart
// ---------------------------------------------------------------------------

describe("SQLite persistence round-trip", () => {
  it("survives simulated restart using file-based DB", async () => {
    const os = await import("node:os");
    const path = await import("node:path");
    const fs = await import("node:fs");

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "observer-s1-"));
    const dbPath = path.join(tmpDir, "test.db");

    try {
      // Phase 1: Create data with first manager instance
      const mgr1 = new SessionManagerImpl({ dbPath });
      const session = await mgr1.createSession("cli", "user-1");
      const thread = await mgr1.createThread(
        session.id,
        "persist test",
        "build",
      );
      await mgr1.updateThreadStatus(thread.id, "processing");
      const turn = await mgr1.createTurn(thread.id, "round-trip message");
      mgr1.close(); // Simulate shutdown

      // Phase 2: New manager instance loads from same DB file
      const mgr2 = new SessionManagerImpl({ dbPath });

      const loadedSession = await mgr2.getSession(session.id);
      expect(loadedSession).not.toBeNull();
      expect(loadedSession!.id).toBe(session.id);
      expect(loadedSession!.client_type).toBe("cli");
      expect(loadedSession!.thread_ids).toContain(thread.id);

      const loadedThread = await mgr2.getThread(thread.id);
      expect(loadedThread).not.toBeNull();
      expect(loadedThread!.status).toBe("processing");
      expect(loadedThread!.intent).toBe("persist test");
      expect(loadedThread!.turn_ids).toContain(turn.id);

      const store = mgr2.getStore();
      const loadedTurn = await store.loadTurn(turn.id);
      expect(loadedTurn).not.toBeNull();
      expect(loadedTurn!.message).toBe("round-trip message");
      expect(loadedTurn!.status).toBe("submitted");

      mgr2.close();
    } finally {
      // Cleanup temp files
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// ISC-5 & ISC-6: Idle Session Cleanup
// ---------------------------------------------------------------------------

describe("Idle session cleanup", () => {
  it("ISC-5: closes sessions idle beyond the configured timeout", async () => {
    // Use a 1ms timeout so all sessions appear idle immediately
    const mgr = createManager({ idleTimeoutMs: 1 });

    const session = await mgr.createSession("cli", "user-1");
    // Ensure time passes beyond the 1ms threshold
    await new Promise((resolve) => setTimeout(resolve, 10));

    const closed = await mgr.cleanupIdleSessions();
    expect(closed).toBe(1);

    const loaded = await mgr.getSession(session.id);
    expect(loaded!.status).toBe("closed");

    mgr.close();
  });

  it("does NOT close sessions that are still within timeout", async () => {
    // 1 hour timeout -- session was just created, so it is fresh
    const mgr = createManager({ idleTimeoutMs: 60 * 60 * 1000 });

    await mgr.createSession("cli", "user-1");

    const closed = await mgr.cleanupIdleSessions();
    expect(closed).toBe(0);

    mgr.close();
  });

  it("ISC-6: skips sessions with active threads (processing)", async () => {
    const mgr = createManager({ idleTimeoutMs: 1 });

    const session = await mgr.createSession("cli", "user-1");
    const thread = await mgr.createThread(session.id, "work", "build");
    await mgr.updateThreadStatus(thread.id, "processing");

    await new Promise((resolve) => setTimeout(resolve, 10));

    const closed = await mgr.cleanupIdleSessions();
    expect(closed).toBe(0);

    const loaded = await mgr.getSession(session.id);
    expect(loaded!.status).toBe("active");

    mgr.close();
  });

  it("ISC-6: skips sessions with active threads (executing)", async () => {
    const mgr = createManager({ idleTimeoutMs: 1 });

    const session = await mgr.createSession("cli", "user-1");
    const thread = await mgr.createThread(session.id, "work", "build");
    await mgr.updateThreadStatus(thread.id, "processing");
    await mgr.updateThreadStatus(thread.id, "executing");

    await new Promise((resolve) => setTimeout(resolve, 10));

    const closed = await mgr.cleanupIdleSessions();
    expect(closed).toBe(0);

    mgr.close();
  });

  it("ISC-6: skips sessions with active threads (awaiting_approval)", async () => {
    const mgr = createManager({ idleTimeoutMs: 1 });

    const session = await mgr.createSession("cli", "user-1");
    const thread = await mgr.createThread(session.id, "work", "build");
    await mgr.updateThreadStatus(thread.id, "processing");
    await mgr.updateThreadStatus(thread.id, "awaiting_approval");

    await new Promise((resolve) => setTimeout(resolve, 10));

    const closed = await mgr.cleanupIdleSessions();
    expect(closed).toBe(0);

    mgr.close();
  });

  it("closes idle session when all threads are terminal", async () => {
    const mgr = createManager({ idleTimeoutMs: 1 });

    const session = await mgr.createSession("cli", "user-1");
    const thread = await mgr.createThread(session.id, "work", "build");
    await mgr.updateThreadStatus(thread.id, "processing");
    await mgr.updateThreadStatus(thread.id, "executing");
    await mgr.updateThreadStatus(thread.id, "completed");

    await new Promise((resolve) => setTimeout(resolve, 10));

    const closed = await mgr.cleanupIdleSessions();
    expect(closed).toBe(1);

    mgr.close();
  });
});

// ---------------------------------------------------------------------------
// SessionStore Direct Tests
// ---------------------------------------------------------------------------

describe("SqliteSessionStore", () => {
  let store: SqliteSessionStore;

  beforeEach(() => {
    store = new SqliteSessionStore({ dbPath: ":memory:" });
  });

  afterEach(() => {
    store.close();
  });

  it("listActiveSessions returns only non-closed sessions", async () => {
    const now = new Date().toISOString();
    await store.saveSession({
      id: "ses_active000001",
      client_type: "cli",
      client_id: "u1",
      created_at: now,
      last_active_at: now,
      status: "active",
      thread_ids: [],
    });
    await store.saveSession({
      id: "ses_closed000001",
      client_type: "cli",
      client_id: "u2",
      created_at: now,
      last_active_at: now,
      status: "closed",
      thread_ids: [],
    });
    await store.saveSession({
      id: "ses_idle00000001",
      client_type: "gui",
      client_id: "u3",
      created_at: now,
      last_active_at: now,
      status: "idle",
      thread_ids: [],
    });

    const active = await store.listActiveSessions();
    const ids = active.map((s) => s.id);

    expect(ids).toContain("ses_active000001");
    expect(ids).toContain("ses_idle00000001");
    expect(ids).not.toContain("ses_closed000001");
  });

  it("preserves JSON arrays through save/load round-trip", async () => {
    const now = new Date().toISOString();
    await store.saveSession({
      id: "ses_json00000001",
      client_type: "cli",
      client_id: "u1",
      created_at: now,
      last_active_at: now,
      status: "active",
      thread_ids: ["thr_aaa", "thr_bbb"],
    });

    const loaded = await store.loadSession("ses_json00000001");
    expect(loaded!.thread_ids).toEqual(["thr_aaa", "thr_bbb"]);
  });

  it("handles thread metadata round-trip", async () => {
    const now = new Date().toISOString();

    // Need to save session first (FK constraint)
    await store.saveSession({
      id: "ses_meta00000001",
      client_type: "cli",
      client_id: "u1",
      created_at: now,
      last_active_at: now,
      status: "active",
      thread_ids: [],
    });

    await store.saveThread({
      id: "thr_meta00000001",
      session_id: "ses_meta00000001",
      intent: "test",
      intent_type: "build",
      status: "open",
      created_at: now,
      updated_at: now,
      turn_ids: [],
      metadata: { key: "value", nested: { deep: true } },
    });

    const loaded = await store.loadThread("thr_meta00000001");
    expect(loaded!.metadata).toEqual({ key: "value", nested: { deep: true } });
  });

  it("handles turn attachments round-trip", async () => {
    const now = new Date().toISOString();

    // Set up FK chain: session -> thread -> turn
    await store.saveSession({
      id: "ses_turn00000001",
      client_type: "cli",
      client_id: "u1",
      created_at: now,
      last_active_at: now,
      status: "active",
      thread_ids: [],
    });

    await store.saveThread({
      id: "thr_turn00000001",
      session_id: "ses_turn00000001",
      intent: "test",
      intent_type: "build",
      status: "open",
      created_at: now,
      updated_at: now,
      turn_ids: [],
      metadata: {},
    });

    await store.saveTurn({
      id: "trn_att000000001",
      thread_id: "thr_turn00000001",
      message: "msg",
      attachments: [
        {
          id: "att_1",
          type: "text",
          content: "hello world",
          sanitized: true,
          contains_sensitive: false,
        },
      ],
      status: "submitted",
      created_at: now,
      completed_at: null,
      item_ids: ["itm_1"],
    });

    const loaded = await store.loadTurn("trn_att000000001");
    expect(loaded!.attachments).toHaveLength(1);
    expect(loaded!.attachments[0].content).toBe("hello world");
    expect(loaded!.item_ids).toEqual(["itm_1"]);
    expect(loaded!.completed_at).toBeNull();
  });
});
