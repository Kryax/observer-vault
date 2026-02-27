// S4: Comprehensive test suite for the Approval Gateway subsystem
// Covers: ApprovalStore, TimeoutScheduler, ApprovalGatewayImpl
// ISC criteria: 1-10 as specified in the PRD

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { ApprovalDecision, AuditEvent, AuditLogger } from "@observer/shared";
import { ObserverErrorCode } from "@observer/shared";

import { ApprovalStore } from "../approval-store.js";
import { TimeoutScheduler } from "../timeout-scheduler.js";
import { ApprovalGatewayImpl, ApprovalError } from "../approval-gateway.js";

// --- Test Helpers ---

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), "approval-test-"));
}

/** Stub session resolver: thread_id -> session_id */
function stubSessionResolver(
  mapping?: Record<string, string>,
): (threadId: string) => Promise<string> {
  return async (threadId: string) => {
    if (mapping && mapping[threadId]) {
      return mapping[threadId]!;
    }
    return `ses_for_${threadId.replace("thr_", "")}`;
  };
}

/** Create a minimal audit logger spy */
function createAuditSpy(): AuditLogger & { events: AuditEvent[] } {
  const events: AuditEvent[] = [];
  return {
    events,
    log(event: AuditEvent): void {
      events.push(event);
    },
    query() {
      return { events: [], total_count: 0, has_more: false };
    },
    tail() {
      return [];
    },
  };
}

// ============================================================
// ApprovalStore Tests
// ============================================================

describe("ApprovalStore", () => {
  let tmpDir: string;
  let store: ApprovalStore;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    store = new ApprovalStore({ dbPath: join(tmpDir, "approvals.db") });
  });

  afterEach(() => {
    store.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should insert and retrieve an approval by ID", () => {
    store.insert({
      approval_id: "apr_test000001",
      thread_id: "thr_aaaaaaaaaaaa",
      session_id: "ses_bbbbbbbbbbbb",
      description: "Test approval",
      risk_level: "medium",
      tier: "approve",
      created_at: "2026-01-01T00:00:00Z",
      timeout_at: "2026-01-01T00:05:00Z",
      context: { key: "value" },
    });

    const row = store.getById("apr_test000001");
    expect(row).not.toBeNull();
    expect(row!.approval_id).toBe("apr_test000001");
    expect(row!.thread_id).toBe("thr_aaaaaaaaaaaa");
    expect(row!.session_id).toBe("ses_bbbbbbbbbbbb");
    expect(row!.status).toBe("pending");
    expect(row!.tier).toBe("approve");
    expect(JSON.parse(row!.context)).toEqual({ key: "value" });
  });

  it("should return null for non-existent approval", () => {
    const row = store.getById("apr_nonexistent");
    expect(row).toBeNull();
  });

  it("should update decision to approved", () => {
    store.insert({
      approval_id: "apr_test000002",
      thread_id: "thr_aaaaaaaaaaaa",
      session_id: "ses_bbbbbbbbbbbb",
      description: "Approve me",
      risk_level: "low",
      tier: "approve",
      created_at: "2026-01-01T00:00:00Z",
      timeout_at: "2026-01-01T00:05:00Z",
      context: {},
    });

    store.updateDecision({
      approval_id: "apr_test000002",
      status: "approved",
      decided_by: "human",
      decided_at: "2026-01-01T00:01:00Z",
      reason: "Looks good",
    });

    const row = store.getById("apr_test000002");
    expect(row!.status).toBe("approved");
    expect(row!.decided_by).toBe("human");
    expect(row!.reason).toBe("Looks good");
  });

  it("should update decision to denied", () => {
    store.insert({
      approval_id: "apr_test000003",
      thread_id: "thr_aaaaaaaaaaaa",
      session_id: "ses_bbbbbbbbbbbb",
      description: "Deny me",
      risk_level: "high",
      tier: "escalate",
      created_at: "2026-01-01T00:00:00Z",
      timeout_at: "2026-01-01T00:05:00Z",
      context: {},
    });

    store.updateDecision({
      approval_id: "apr_test000003",
      status: "denied",
      decided_by: "human",
      decided_at: "2026-01-01T00:02:00Z",
      reason: "Too risky",
    });

    const row = store.getById("apr_test000003");
    expect(row!.status).toBe("denied");
    expect(row!.reason).toBe("Too risky");
  });

  it("should get pending approvals by session", () => {
    store.insert({
      approval_id: "apr_a1",
      thread_id: "thr_111",
      session_id: "ses_AAA",
      description: "First",
      risk_level: "low",
      tier: "approve",
      created_at: "2026-01-01T00:00:00Z",
      timeout_at: "2026-01-01T00:05:00Z",
      context: {},
    });
    store.insert({
      approval_id: "apr_a2",
      thread_id: "thr_222",
      session_id: "ses_BBB",
      description: "Second",
      risk_level: "medium",
      tier: "approve",
      created_at: "2026-01-01T00:00:01Z",
      timeout_at: "2026-01-01T00:05:01Z",
      context: {},
    });
    store.insert({
      approval_id: "apr_a3",
      thread_id: "thr_333",
      session_id: "ses_AAA",
      description: "Third",
      risk_level: "high",
      tier: "escalate",
      created_at: "2026-01-01T00:00:02Z",
      timeout_at: "2026-01-01T00:05:02Z",
      context: {},
    });

    const pending = store.getPendingBySession("ses_AAA");
    expect(pending).toHaveLength(2);
    expect(pending[0]!.approval_id).toBe("apr_a1");
    expect(pending[1]!.approval_id).toBe("apr_a3");
  });

  it("should not return resolved approvals in pending queries", () => {
    store.insert({
      approval_id: "apr_resolved",
      thread_id: "thr_111",
      session_id: "ses_AAA",
      description: "Resolved",
      risk_level: "low",
      tier: "approve",
      created_at: "2026-01-01T00:00:00Z",
      timeout_at: "2026-01-01T00:05:00Z",
      context: {},
    });
    store.updateDecision({
      approval_id: "apr_resolved",
      status: "approved",
      decided_by: "human",
      decided_at: "2026-01-01T00:01:00Z",
      reason: null,
    });

    const pending = store.getPendingBySession("ses_AAA");
    expect(pending).toHaveLength(0);
  });

  it("should get all pending approvals", () => {
    store.insert({
      approval_id: "apr_p1",
      thread_id: "thr_111",
      session_id: "ses_AAA",
      description: "P1",
      risk_level: "low",
      tier: "approve",
      created_at: "2026-01-01T00:00:00Z",
      timeout_at: "2026-01-01T00:05:00Z",
      context: {},
    });
    store.insert({
      approval_id: "apr_p2",
      thread_id: "thr_222",
      session_id: "ses_BBB",
      description: "P2",
      risk_level: "medium",
      tier: "escalate",
      created_at: "2026-01-01T00:00:01Z",
      timeout_at: "2026-01-01T00:05:01Z",
      context: {},
    });

    const all = store.getAllPending();
    expect(all).toHaveLength(2);
  });

  it("should find expired pending approvals", () => {
    store.insert({
      approval_id: "apr_exp1",
      thread_id: "thr_111",
      session_id: "ses_AAA",
      description: "Expired",
      risk_level: "low",
      tier: "approve",
      created_at: "2026-01-01T00:00:00Z",
      timeout_at: "2026-01-01T00:01:00Z", // expires at 1 min
      context: {},
    });
    store.insert({
      approval_id: "apr_notexp",
      thread_id: "thr_222",
      session_id: "ses_BBB",
      description: "Not expired",
      risk_level: "medium",
      tier: "approve",
      created_at: "2026-01-01T00:00:00Z",
      timeout_at: "2026-12-31T23:59:59Z", // far future
      context: {},
    });

    const expired = store.getExpiredPending("2026-01-01T00:02:00Z");
    expect(expired).toHaveLength(1);
    expect(expired[0]!.approval_id).toBe("apr_exp1");
  });

  it("should expire batch and return count", () => {
    store.insert({
      approval_id: "apr_batch1",
      thread_id: "thr_111",
      session_id: "ses_AAA",
      description: "Batch 1",
      risk_level: "low",
      tier: "approve",
      created_at: "2026-01-01T00:00:00Z",
      timeout_at: "2026-01-01T00:01:00Z",
      context: {},
    });
    store.insert({
      approval_id: "apr_batch2",
      thread_id: "thr_222",
      session_id: "ses_BBB",
      description: "Batch 2",
      risk_level: "low",
      tier: "approve",
      created_at: "2026-01-01T00:00:00Z",
      timeout_at: "2026-01-01T00:01:00Z",
      context: {},
    });

    const count = store.expireBatch(
      ["apr_batch1", "apr_batch2"],
      "2026-01-01T00:02:00Z",
    );
    expect(count).toBe(2);

    const row1 = store.getById("apr_batch1");
    expect(row1!.status).toBe("expired");
    expect(row1!.decided_by).toBe("system:timeout");

    const row2 = store.getById("apr_batch2");
    expect(row2!.status).toBe("expired");
  });

  it("should survive close and reopen (persistence test)", () => {
    const dbPath = join(tmpDir, "persist-test.db");
    const store1 = new ApprovalStore({ dbPath });

    store1.insert({
      approval_id: "apr_persist",
      thread_id: "thr_111",
      session_id: "ses_AAA",
      description: "Persistent",
      risk_level: "low",
      tier: "approve",
      created_at: "2026-01-01T00:00:00Z",
      timeout_at: "2026-01-01T00:05:00Z",
      context: { survives: true },
    });
    store1.close();

    // Reopen the database
    const store2 = new ApprovalStore({ dbPath });
    const row = store2.getById("apr_persist");
    expect(row).not.toBeNull();
    expect(row!.description).toBe("Persistent");
    expect(JSON.parse(row!.context)).toEqual({ survives: true });

    const pending = store2.getAllPending();
    expect(pending).toHaveLength(1);
    expect(pending[0]!.approval_id).toBe("apr_persist");

    store2.close();
  });
});

// ============================================================
// TimeoutScheduler Tests
// ============================================================

describe("TimeoutScheduler", () => {
  let tmpDir: string;
  let store: ApprovalStore;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    store = new ApprovalStore({ dbPath: join(tmpDir, "scheduler.db") });
  });

  afterEach(() => {
    store.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should expire overdue approvals on tick()", () => {
    store.insert({
      approval_id: "apr_overdue",
      thread_id: "thr_111",
      session_id: "ses_AAA",
      description: "Overdue",
      risk_level: "low",
      tier: "approve",
      created_at: "2020-01-01T00:00:00Z",
      timeout_at: "2020-01-01T00:01:00Z", // long past
      context: {},
    });

    const onExpired = vi.fn();
    const scheduler = new TimeoutScheduler({
      store,
      onExpired,
    });

    const count = scheduler.tick();
    expect(count).toBe(1);
    expect(onExpired).toHaveBeenCalledOnce();

    const row = store.getById("apr_overdue");
    expect(row!.status).toBe("expired");
  });

  it("should not expire future approvals", () => {
    store.insert({
      approval_id: "apr_future",
      thread_id: "thr_111",
      session_id: "ses_AAA",
      description: "Future",
      risk_level: "low",
      tier: "approve",
      created_at: "2026-01-01T00:00:00Z",
      timeout_at: "2099-12-31T23:59:59Z",
      context: {},
    });

    const scheduler = new TimeoutScheduler({ store });
    const count = scheduler.tick();
    expect(count).toBe(0);

    const row = store.getById("apr_future");
    expect(row!.status).toBe("pending");
  });

  it("should start and stop the timer", () => {
    const scheduler = new TimeoutScheduler({
      store,
      intervalMs: 100_000, // large interval so it doesn't fire during test
    });

    expect(scheduler.isRunning()).toBe(false);
    scheduler.start();
    expect(scheduler.isRunning()).toBe(true);
    scheduler.start(); // double start should be safe
    expect(scheduler.isRunning()).toBe(true);
    scheduler.stop();
    expect(scheduler.isRunning()).toBe(false);
    scheduler.stop(); // double stop should be safe
    expect(scheduler.isRunning()).toBe(false);
  });
});

// ============================================================
// ApprovalGatewayImpl Tests
// ============================================================

describe("ApprovalGatewayImpl", () => {
  let tmpDir: string;
  let gateway: ApprovalGatewayImpl;
  let auditSpy: ReturnType<typeof createAuditSpy>;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    auditSpy = createAuditSpy();
    gateway = new ApprovalGatewayImpl({
      dbPath: join(tmpDir, "gateway.db"),
      resolveSessionId: stubSessionResolver(),
      auditLogger: auditSpy,
      defaultTimeoutSeconds: 300,
      schedulerIntervalMs: 60_000, // large interval -- we'll tick manually
    });
  });

  afterEach(() => {
    gateway.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // --- ISC-1: tier "block" returns immediate deny without persisting ---
  describe("ISC-1: block tier", () => {
    it("should return immediate deny for block tier", async () => {
      const result = await gateway.requestApproval({
        thread_id: "thr_block_test",
        description: "Dangerous operation",
        risk_level: "critical",
        tier: "block",
        timeout_seconds: 60,
        context: {},
      });

      expect(result.decision).toBe("denied");
      expect(result.reason).toContain("block");
      expect(result.decided_by).toBe("system:policy");

      // Verify nothing was persisted
      const pending = await gateway.getAllPending();
      expect(pending).toHaveLength(0);
    });

    it("should log audit event for block", async () => {
      await gateway.requestApproval({
        thread_id: "thr_block_audit",
        description: "Blocked",
        risk_level: "critical",
        tier: "block",
        timeout_seconds: 60,
        context: {},
      });

      const blockEvents = auditSpy.events.filter(
        (e) => e.action === "approval.blocked",
      );
      expect(blockEvents).toHaveLength(1);
    });
  });

  // --- ISC-2: tier "auto_approve" / "notify" returns immediate approve ---
  describe("ISC-2: auto_approve and notify tiers", () => {
    it("should auto-approve for auto_approve tier", async () => {
      const result = await gateway.requestApproval({
        thread_id: "thr_auto_test",
        description: "Low risk op",
        risk_level: "low",
        tier: "auto_approve",
        timeout_seconds: 60,
        context: {},
      });

      expect(result.decision).toBe("approved");
      expect(result.reason).toContain("auto_approve");
      expect(result.decided_by).toBe("system:auto");
    });

    it("should auto-approve for notify tier", async () => {
      const result = await gateway.requestApproval({
        thread_id: "thr_notify_test",
        description: "Notification op",
        risk_level: "low",
        tier: "notify",
        timeout_seconds: 60,
        context: {},
      });

      expect(result.decision).toBe("approved");
      expect(result.reason).toContain("notify");
      expect(result.decided_by).toBe("system:auto");
    });

    it("should log audit event for auto-approve", async () => {
      await gateway.requestApproval({
        thread_id: "thr_auto_audit",
        description: "Auto",
        risk_level: "low",
        tier: "auto_approve",
        timeout_seconds: 60,
        context: {},
      });

      const autoEvents = auditSpy.events.filter(
        (e) => e.action === "approval.auto_approved",
      );
      expect(autoEvents).toHaveLength(1);
    });
  });

  // --- ISC-3: tier "approve" / "escalate" creates pending and waits ---
  describe("ISC-3: approve and escalate tiers create pending", () => {
    it("should create pending approval for approve tier", async () => {
      // Don't await -- it'll block waiting for decision
      const promise = gateway.requestApproval({
        thread_id: "thr_approve_test",
        description: "Needs human review",
        risk_level: "medium",
        tier: "approve",
        timeout_seconds: 10,
        context: { reason: "test" },
      });

      // Give it a moment to persist
      await new Promise((r) => setTimeout(r, 50));

      const pending = await gateway.getAllPending();
      expect(pending).toHaveLength(1);
      expect(pending[0]!.tier).toBe("approve");
      expect(pending[0]!.description).toBe("Needs human review");

      // Resolve it so the test can clean up
      await gateway.submitDecision(pending[0]!.approval_id, {
        decision: "approved",
        reason: "OK",
      });

      const result = await promise;
      expect(result.decision).toBe("approved");
    });

    it("should create pending approval for escalate tier", async () => {
      const promise = gateway.requestApproval({
        thread_id: "thr_escalate_test",
        description: "High risk, needs CLI approval",
        risk_level: "high",
        tier: "escalate",
        timeout_seconds: 10,
        context: {},
      });

      await new Promise((r) => setTimeout(r, 50));

      const pending = await gateway.getAllPending();
      expect(pending).toHaveLength(1);
      expect(pending[0]!.tier).toBe("escalate");

      // Resolve
      await gateway.submitDecision(pending[0]!.approval_id, {
        decision: "approved",
      });

      const result = await promise;
      expect(result.decision).toBe("approved");
    });

    it("should log audit events for escalate with channel restriction", async () => {
      const promise = gateway.requestApproval({
        thread_id: "thr_escalate_audit",
        description: "Escalated",
        risk_level: "high",
        tier: "escalate",
        timeout_seconds: 10,
        context: {},
      });

      await new Promise((r) => setTimeout(r, 50));

      const requestEvents = auditSpy.events.filter(
        (e) => e.action === "approval.requested",
      );
      expect(requestEvents).toHaveLength(1);
      expect(requestEvents[0]!.details.channel_restriction).toBe("cli_only");

      // Clean up
      const pending = await gateway.getAllPending();
      await gateway.submitDecision(pending[0]!.approval_id, {
        decision: "denied",
      });
      await promise;
    });
  });

  // --- ISC-4: submitDecision on pending resolves it ---
  describe("ISC-4: submitDecision resolves pending", () => {
    it("should resolve pending approval with approved decision", async () => {
      const promise = gateway.requestApproval({
        thread_id: "thr_decide_test",
        description: "Decide me",
        risk_level: "medium",
        tier: "approve",
        timeout_seconds: 10,
        context: {},
      });

      await new Promise((r) => setTimeout(r, 50));

      const pending = await gateway.getAllPending();
      expect(pending).toHaveLength(1);

      await gateway.submitDecision(pending[0]!.approval_id, {
        decision: "approved",
        reason: "Reviewed and approved",
      });

      const result = await promise;
      expect(result.decision).toBe("approved");
      expect(result.reason).toBe("Reviewed and approved");
      expect(result.decided_by).toBe("human");
    });

    it("should resolve pending approval with denied decision", async () => {
      const promise = gateway.requestApproval({
        thread_id: "thr_deny_test",
        description: "Deny me",
        risk_level: "high",
        tier: "approve",
        timeout_seconds: 10,
        context: {},
      });

      await new Promise((r) => setTimeout(r, 50));

      const pending = await gateway.getAllPending();
      await gateway.submitDecision(pending[0]!.approval_id, {
        decision: "denied",
        reason: "Nope",
      });

      const result = await promise;
      expect(result.decision).toBe("denied");
      expect(result.reason).toBe("Nope");
    });
  });

  // --- ISC-5: submitDecision on already-resolved throws ApprovalAlreadyResolved ---
  describe("ISC-5: duplicate submitDecision throws", () => {
    it("should throw ApprovalAlreadyResolved on double-submit", async () => {
      const promise = gateway.requestApproval({
        thread_id: "thr_double_test",
        description: "Double submit",
        risk_level: "medium",
        tier: "approve",
        timeout_seconds: 10,
        context: {},
      });

      await new Promise((r) => setTimeout(r, 50));

      const pending = await gateway.getAllPending();
      const id = pending[0]!.approval_id;

      // First submit -- should succeed
      await gateway.submitDecision(id, { decision: "approved" });
      await promise;

      // Second submit -- should throw
      await expect(
        gateway.submitDecision(id, { decision: "denied" }),
      ).rejects.toThrow(ApprovalError);

      try {
        await gateway.submitDecision(id, { decision: "denied" });
      } catch (err) {
        expect(err).toBeInstanceOf(ApprovalError);
        expect((err as ApprovalError).code).toBe(
          ObserverErrorCode.ApprovalAlreadyResolved,
        );
      }
    });
  });

  // --- ISC-6: timeout = denied (fail safe) ---
  describe("ISC-6: timeout = denied", () => {
    it("should timeout with denied decision after timeout_seconds", async () => {
      // Use a very short timeout
      const result = await gateway.requestApproval({
        thread_id: "thr_timeout_test",
        description: "Will timeout",
        risk_level: "medium",
        tier: "approve",
        timeout_seconds: 0.1, // 100ms
        context: {},
      });

      expect(result.decision).toBe("timeout");
      expect(result.reason).toContain("timeout");
      expect(result.decided_by).toBe("system:timeout");
    });

    it("should log audit event for timeout", async () => {
      await gateway.requestApproval({
        thread_id: "thr_timeout_audit",
        description: "Will timeout for audit",
        risk_level: "medium",
        tier: "approve",
        timeout_seconds: 0.1,
        context: {},
      });

      const timeoutEvents = auditSpy.events.filter(
        (e) => e.action === "approval.timeout",
      );
      expect(timeoutEvents).toHaveLength(1);
    });
  });

  // --- ISC-7: getPendingApprovals(sessionId) returns only pending for that session ---
  describe("ISC-7: getPendingApprovals by session", () => {
    it("should return only pending approvals for specified session", async () => {
      const resolver = stubSessionResolver({
        thr_s1: "ses_session_A",
        thr_s2: "ses_session_B",
        thr_s3: "ses_session_A",
      });

      const gw = new ApprovalGatewayImpl({
        dbPath: join(tmpDir, "session-filter.db"),
        resolveSessionId: resolver,
        schedulerIntervalMs: 60_000,
      });

      // Create 3 approvals: 2 for session A, 1 for session B
      const p1 = gw.requestApproval({
        thread_id: "thr_s1",
        description: "Session A #1",
        risk_level: "low",
        tier: "approve",
        timeout_seconds: 10,
        context: {},
      });
      const p2 = gw.requestApproval({
        thread_id: "thr_s2",
        description: "Session B #1",
        risk_level: "low",
        tier: "approve",
        timeout_seconds: 10,
        context: {},
      });
      const p3 = gw.requestApproval({
        thread_id: "thr_s3",
        description: "Session A #2",
        risk_level: "low",
        tier: "approve",
        timeout_seconds: 10,
        context: {},
      });

      await new Promise((r) => setTimeout(r, 50));

      const sessionAPending = await gw.getPendingApprovals("ses_session_A");
      expect(sessionAPending).toHaveLength(2);
      expect(
        sessionAPending.every((a) => a.session_id === "ses_session_A"),
      ).toBe(true);

      const sessionBPending = await gw.getPendingApprovals("ses_session_B");
      expect(sessionBPending).toHaveLength(1);
      expect(sessionBPending[0]!.session_id).toBe("ses_session_B");

      // Clean up
      const all = await gw.getAllPending();
      for (const a of all) {
        await gw.submitDecision(a.approval_id, { decision: "denied" });
      }
      await Promise.all([p1, p2, p3]);
      gw.close();
    });
  });

  // --- ISC-8: getAllPending returns all pending ---
  describe("ISC-8: getAllPending", () => {
    it("should return all pending approvals across sessions", async () => {
      const p1 = gateway.requestApproval({
        thread_id: "thr_all1",
        description: "All #1",
        risk_level: "low",
        tier: "approve",
        timeout_seconds: 10,
        context: {},
      });
      const p2 = gateway.requestApproval({
        thread_id: "thr_all2",
        description: "All #2",
        risk_level: "medium",
        tier: "escalate",
        timeout_seconds: 10,
        context: {},
      });

      await new Promise((r) => setTimeout(r, 50));

      const all = await gateway.getAllPending();
      expect(all).toHaveLength(2);

      // Clean up
      for (const a of all) {
        await gateway.submitDecision(a.approval_id, { decision: "denied" });
      }
      await Promise.all([p1, p2]);
    });
  });

  // --- ISC-9: SQLite persistence survives gateway restart ---
  describe("ISC-9: persistence across restart", () => {
    it("should persist approvals across gateway close/reopen", async () => {
      const dbPath = join(tmpDir, "restart-test.db");

      // Create gateway #1 and insert an approval
      const gw1 = new ApprovalGatewayImpl({
        dbPath,
        resolveSessionId: stubSessionResolver(),
        schedulerIntervalMs: 60_000,
      });

      const promise = gw1.requestApproval({
        thread_id: "thr_persist",
        description: "Survives restart",
        risk_level: "medium",
        tier: "approve",
        timeout_seconds: 10,
        context: { data: "survives" },
      });

      await new Promise((r) => setTimeout(r, 50));

      const pending1 = await gw1.getAllPending();
      expect(pending1).toHaveLength(1);

      // Close without resolving -- the promise will reject
      gw1.close();
      try {
        await promise;
      } catch {
        // Expected: gateway shutdown cancels in-flight waiters
      }

      // Create gateway #2 on the same DB
      const gw2 = new ApprovalGatewayImpl({
        dbPath,
        resolveSessionId: stubSessionResolver(),
        schedulerIntervalMs: 60_000,
      });

      const pending2 = await gw2.getAllPending();
      expect(pending2).toHaveLength(1);
      expect(pending2[0]!.description).toBe("Survives restart");
      expect(pending2[0]!.status).toBe("pending");

      // Can still submit decision on the persisted approval
      await gw2.submitDecision(pending2[0]!.approval_id, {
        decision: "approved",
        reason: "Approved after restart",
      });

      const afterDecision = await gw2.getAllPending();
      expect(afterDecision).toHaveLength(0);

      gw2.close();
    });
  });

  // --- ISC-10: TypeScript compiles ---
  // (This is verified by tsc --noEmit, not a runtime test)

  // --- Additional edge cases ---

  describe("Edge cases", () => {
    it("should use default timeout when timeout_seconds is 0", async () => {
      // timeout_seconds = 0 should use default; we set it very short to not block
      const gw = new ApprovalGatewayImpl({
        dbPath: join(tmpDir, "default-timeout.db"),
        resolveSessionId: stubSessionResolver(),
        defaultTimeoutSeconds: 0.1,
        schedulerIntervalMs: 60_000,
      });

      const result = await gw.requestApproval({
        thread_id: "thr_default_timeout",
        description: "Default timeout",
        risk_level: "low",
        tier: "approve",
        timeout_seconds: 0, // falsy, should use default
        context: {},
      });

      expect(result.decision).toBe("timeout");
      gw.close();
    });

    it("should resolve session_id from thread_id via injected resolver", async () => {
      const resolver = stubSessionResolver({
        thr_custom: "ses_resolved_session",
      });

      const gw = new ApprovalGatewayImpl({
        dbPath: join(tmpDir, "resolver.db"),
        resolveSessionId: resolver,
        schedulerIntervalMs: 60_000,
      });

      const promise = gw.requestApproval({
        thread_id: "thr_custom",
        description: "Custom session",
        risk_level: "low",
        tier: "approve",
        timeout_seconds: 10,
        context: {},
      });

      await new Promise((r) => setTimeout(r, 50));

      const pending = await gw.getPendingApprovals("ses_resolved_session");
      expect(pending).toHaveLength(1);
      expect(pending[0]!.session_id).toBe("ses_resolved_session");

      // Clean up
      await gw.submitDecision(pending[0]!.approval_id, {
        decision: "approved",
      });
      await promise;
      gw.close();
    });

    it("should submit decision on non-existent approval throws", async () => {
      await expect(
        gateway.submitDecision("apr_nonexistent", { decision: "approved" }),
      ).rejects.toThrow("not found");
    });
  });
});
