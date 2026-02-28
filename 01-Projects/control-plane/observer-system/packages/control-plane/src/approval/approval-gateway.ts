// S4: Main Approval Gateway implementation
// Implements the ApprovalGateway interface from @observer/shared
// Handles tier-based approval routing, timeout enforcement, and decision submission
//
// SECURITY INVARIANT: timeout = denied (fail safe, NOT fail open)
// SECURITY INVARIANT: "block" tier = immediate deny, no persistence
// SECURITY INVARIANT: "escalate" tier = CLI-only channel restriction noted

import type {
  ApprovalGateway,
  ApprovalRequestParams,
  ApprovalResult,
  ApprovalDecision,
  PendingApproval,
  AuditLogger,
  AuditEvent,
} from "@observer/shared";
import { ObserverErrorCode, generateId } from "@observer/shared";
import { ApprovalStore } from "./approval-store.js";
import { TimeoutScheduler } from "./timeout-scheduler.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApprovalGatewayOptions {
  /** Path to SQLite file, or ":memory:" for testing */
  dbPath: string;
  /** Function to look up session_id from thread_id */
  resolveSessionId: (threadId: string) => Promise<string>;
  /** Optional audit logger for approval events */
  auditLogger?: AuditLogger;
  /** Default timeout in seconds if not specified in request (default: 300) */
  defaultTimeoutSeconds?: number;
  /** Timeout scheduler check interval in ms (default: 5000) */
  schedulerIntervalMs?: number;
}

// Custom error class for approval-specific errors
export class ApprovalError extends Error {
  constructor(
    message: string,
    public readonly code: ObserverErrorCode,
  ) {
    super(message);
    this.name = "ApprovalError";
  }
}

// ---------------------------------------------------------------------------
// In-flight waiters for pending approvals
// ---------------------------------------------------------------------------

interface Waiter {
  resolve: (result: ApprovalResult) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class ApprovalGatewayImpl implements ApprovalGateway {
  private readonly store: ApprovalStore;
  private readonly scheduler: TimeoutScheduler;
  private readonly resolveSessionId: (threadId: string) => Promise<string>;
  private readonly auditLogger: AuditLogger | undefined;
  private readonly defaultTimeoutSeconds: number;

  /** Map of approval_id -> waiter for in-flight "approve"/"escalate" requests */
  private readonly waiters = new Map<string, Waiter>();

  constructor(options: ApprovalGatewayOptions) {
    this.store = new ApprovalStore({ dbPath: options.dbPath });
    this.resolveSessionId = options.resolveSessionId;
    this.auditLogger = options.auditLogger;
    this.defaultTimeoutSeconds = options.defaultTimeoutSeconds ?? 300;

    this.scheduler = new TimeoutScheduler({
      store: this.store,
      intervalMs: options.schedulerIntervalMs ?? 5000,
      onExpired: (ids) => this.handleExpired(ids),
    });
    this.scheduler.start();
  }

  // -----------------------------------------------------------------------
  // ApprovalGateway interface
  // -----------------------------------------------------------------------

  async requestApproval(params: ApprovalRequestParams): Promise<ApprovalResult> {
    const now = new Date().toISOString();

    // --- Tier: block -> immediate deny, no persistence ---
    if (params.tier === "block") {
      const result: ApprovalResult = {
        approval_id: generateId("approval"),
        decision: "denied",
        reason: "Blocked by policy (tier: block)",
        decided_by: "system:policy",
        decided_at: now,
      };
      this.logAuditEvent("approval.blocked", params.thread_id, null, {
        tier: params.tier,
        description: params.description,
        risk_level: params.risk_level,
      });
      return result;
    }

    // --- Tier: auto_approve / notify -> immediate approve ---
    if (params.tier === "auto_approve" || params.tier === "notify") {
      const approvalId = generateId("approval");
      const result: ApprovalResult = {
        approval_id: approvalId,
        decision: "approved",
        reason: `Auto-approved (tier: ${params.tier})`,
        decided_by: "system:auto",
        decided_at: now,
      };
      this.logAuditEvent("approval.auto_approved", params.thread_id, null, {
        approval_id: approvalId,
        tier: params.tier,
        description: params.description,
        risk_level: params.risk_level,
      });
      return result;
    }

    // --- Tier: approve / escalate -> create pending, wait for decision ---
    const approvalId = generateId("approval");
    const timeoutSeconds = params.timeout_seconds || this.defaultTimeoutSeconds;
    const timeoutAt = new Date(Date.now() + timeoutSeconds * 1000).toISOString();
    const sessionId = await this.resolveSessionId(params.thread_id);

    // Persist in SQLite
    this.store.insert({
      approval_id: approvalId,
      thread_id: params.thread_id,
      session_id: sessionId,
      description: params.description,
      risk_level: params.risk_level,
      tier: params.tier,
      created_at: now,
      timeout_at: timeoutAt,
      context: params.context,
    });

    this.logAuditEvent("approval.requested", params.thread_id, sessionId, {
      approval_id: approvalId,
      tier: params.tier,
      description: params.description,
      risk_level: params.risk_level,
      timeout_seconds: timeoutSeconds,
      channel_restriction: params.tier === "escalate" ? "cli_only" : "any",
    });

    // Create a promise that resolves when the decision arrives or times out
    return new Promise<ApprovalResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        // Timeout reached -- expire the approval
        const expireNow = new Date().toISOString();
        const row = this.store.getById(approvalId);
        if (row && row.status === "pending") {
          this.store.expireBatch([approvalId], expireNow);
        }

        this.waiters.delete(approvalId);

        const result: ApprovalResult = {
          approval_id: approvalId,
          decision: "timeout",
          reason: "Approval timed out (fail safe: timeout = denied)",
          decided_by: "system:timeout",
          decided_at: expireNow,
        };

        this.logAuditEvent("approval.timeout", params.thread_id, sessionId, {
          approval_id: approvalId,
          timeout_seconds: timeoutSeconds,
        });

        resolve(result);
      }, timeoutSeconds * 1000);

      // Prevent timer from keeping process alive
      if (timer && typeof timer === "object" && "unref" in timer) {
        timer.unref();
      }

      this.waiters.set(approvalId, { resolve, reject, timer });
    });
  }

  async submitDecision(id: string, decision: ApprovalDecision): Promise<void> {
    const row = this.store.getById(id);

    if (!row) {
      throw new ApprovalError(
        `Approval ${id} not found`,
        ObserverErrorCode.InvalidParams,
      );
    }

    // Already resolved (approved, denied, or expired)
    if (row.status !== "pending") {
      throw new ApprovalError(
        `Approval ${id} already resolved with status: ${row.status}`,
        ObserverErrorCode.ApprovalAlreadyResolved,
      );
    }

    const now = new Date().toISOString();

    // Update the store
    this.store.updateDecision({
      approval_id: id,
      status: decision.decision,
      decided_by: "human",
      decided_at: now,
      reason: decision.reason ?? null,
    });

    this.logAuditEvent("approval.decided", row.thread_id, row.session_id, {
      approval_id: id,
      decision: decision.decision,
      reason: decision.reason ?? null,
    });

    // Resolve the waiting promise if one exists
    const waiter = this.waiters.get(id);
    if (waiter) {
      clearTimeout(waiter.timer);
      this.waiters.delete(id);

      const result: ApprovalResult = {
        approval_id: id,
        decision: decision.decision,
        reason: decision.reason ?? null,
        decided_by: "human",
        decided_at: now,
      };

      waiter.resolve(result);
    }
  }

  async getPendingApprovals(sessionId: string): Promise<PendingApproval[]> {
    return this.store.getPendingBySession(sessionId);
  }

  async getAllPending(): Promise<PendingApproval[]> {
    return this.store.getAllPending();
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /**
   * Shut down the gateway: stop scheduler, clear waiters, close store.
   */
  close(): void {
    this.scheduler.stop();

    // Reject all in-flight waiters
    for (const [id, waiter] of this.waiters) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error(`Gateway shutting down, approval ${id} cancelled`));
    }
    this.waiters.clear();

    this.store.close();
  }

  /**
   * Get the underlying store (for testing / advanced usage).
   */
  getStore(): ApprovalStore {
    return this.store;
  }

  /**
   * Get the scheduler (for testing).
   */
  getScheduler(): TimeoutScheduler {
    return this.scheduler;
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  /**
   * Called by the timeout scheduler when approvals expire via periodic sweep.
   */
  private handleExpired(ids: string[]): void {
    const now = new Date().toISOString();
    for (const id of ids) {
      const waiter = this.waiters.get(id);
      if (waiter) {
        clearTimeout(waiter.timer);
        this.waiters.delete(id);

        const result: ApprovalResult = {
          approval_id: id,
          decision: "timeout",
          reason: "Approval timed out (fail safe: timeout = denied)",
          decided_by: "system:timeout",
          decided_at: now,
        };
        waiter.resolve(result);
      }
    }
  }

  /**
   * Log an audit event if an audit logger is configured.
   */
  private logAuditEvent(
    action: string,
    threadId: string | null,
    sessionId: string | null,
    details: Record<string, unknown>,
  ): void {
    if (!this.auditLogger) return;

    const event: AuditEvent = {
      event_id: generateId("audit_event"),
      timestamp: new Date().toISOString(),
      category: "approval",
      action,
      session_id: sessionId,
      thread_id: threadId,
      turn_id: null,
      item_id: null,
      client_id: null,
      details,
      policy_rule_id: null,
      risk_level: null,
    };

    this.auditLogger.log(event);
  }
}
