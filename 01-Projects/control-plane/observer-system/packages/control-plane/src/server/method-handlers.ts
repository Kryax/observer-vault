// S5: JSON-RPC method handler factory
// Creates jayson-compatible method handlers that wire to slice implementations.
// Each handler validates params with Zod, delegates to the appropriate subsystem,
// and returns the result or a structured JSON-RPC error.
//
// The audit logger is invoked for every method call (except health.status).
// SECURITY: Audit writes block requests -- if audit fails, the request fails.
// Exception: health.status and session.close bypass audit blocking.

import type {
  SessionManager,
  PolicyEnforcer,
  ApprovalGateway,
  AuditLogger,
  AuditStore,
  AuditEvent,
  HealthStatus,
  PolicyRequest,
  Session,
  VaultConnector,
} from "@observer/shared";
import {
  generateId,
  ObserverErrorCode,
  SessionCreateParamsSchema,
  SessionCloseParamsSchema,
  SessionResumeParamsSchema,
  ThreadCreateParamsSchema,
  ThreadStatusParamsSchema,
  ThreadCancelParamsSchema,
  TurnSubmitParamsSchema,
  ApprovalRespondParamsSchema,
  AuditQueryParamsSchema,
  AdminRevokeTokenParamsSchema,
  VaultQueryParamsSchema,
} from "@observer/shared";
import type { JsonRpcError } from "@observer/shared";
import type { TokenAuthenticator } from "./auth.js";
import type { Logger } from "pino";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Jayson-compatible method handler signature */
export type JaysonHandler = (
  args: unknown,
  callback: (err: JsonRpcError | null, result?: unknown) => void,
) => void;

/** Map of method name -> jayson handler */
export type MethodMap = Record<string, JaysonHandler>;

/** Dependencies needed to create all method handlers */
export interface MethodHandlerDeps {
  sessionManager: SessionManager;
  policyEnforcer: PolicyEnforcer;
  auditLogger: AuditLogger & AuditStore;
  approvalGateway: ApprovalGateway;
  healthMonitor: {
    getStatus(): HealthStatus;
    getLivenessStatus(): { status: string; uptime_seconds: number };
  };
  tokenAuth: TokenAuthenticator;
  logger: Logger;
  /** Optional — vault methods return an error if not configured */
  vaultConnector?: VaultConnector;
}

// ---------------------------------------------------------------------------
// Audit helper
// ---------------------------------------------------------------------------

function createAuditEvent(
  category: AuditEvent["category"],
  action: string,
  sessionId: string | null,
  threadId: string | null,
  details: Record<string, unknown>,
): AuditEvent {
  return {
    event_id: generateId("audit_event"),
    timestamp: new Date().toISOString(),
    category,
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
}

/**
 * Try to log an audit event. If it fails, return an error.
 * SECURITY: Audit writes block requests (except health.status and session.close).
 */
function tryAuditLog(
  auditLogger: AuditLogger,
  event: AuditEvent,
  logger: Logger,
): JsonRpcError | null {
  try {
    auditLogger.log(event);
    return null;
  } catch (err) {
    logger.error({ err, event_id: event.event_id }, "Audit write failed");
    return {
      code: ObserverErrorCode.InternalError,
      message: "Audit subsystem unavailable -- request blocked",
    };
  }
}

// ---------------------------------------------------------------------------
// Error helper
// ---------------------------------------------------------------------------

function toJsonRpcError(err: unknown): JsonRpcError {
  if (
    err &&
    typeof err === "object" &&
    "code" in err &&
    "message" in err &&
    typeof (err as JsonRpcError).code === "number" &&
    typeof (err as JsonRpcError).message === "string"
  ) {
    return err as JsonRpcError;
  }
  if (err instanceof Error) {
    return {
      code: ObserverErrorCode.InternalError,
      message: err.message,
    };
  }
  return {
    code: ObserverErrorCode.InternalError,
    message: "Unknown internal error",
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create all 11 JSON-RPC method handlers wired to the slice implementations.
 */
export function createMethodHandlers(deps: MethodHandlerDeps): MethodMap {
  const {
    sessionManager,
    policyEnforcer,
    auditLogger,
    approvalGateway,
    healthMonitor,
    tokenAuth,
    logger,
    vaultConnector,
  } = deps;

  const methods: MethodMap = {};

  // -----------------------------------------------------------------------
  // session.create
  // -----------------------------------------------------------------------
  methods["session.create"] = (args, callback) => {
    const parsed = SessionCreateParamsSchema.safeParse(args);
    if (!parsed.success) {
      return callback({
        code: ObserverErrorCode.InvalidParams,
        message: `Invalid params: ${parsed.error.message}`,
      });
    }
    const { client_type, client_id } = parsed.data;

    const auditErr = tryAuditLog(
      auditLogger,
      createAuditEvent("session", "session.create", null, null, {
        client_type,
        client_id,
      }),
      logger,
    );
    if (auditErr) return callback(auditErr);

    sessionManager
      .createSession(client_type, client_id)
      .then((session) => {
        callback(null, {
          session_id: session.id,
          created_at: session.created_at,
        });
      })
      .catch((err) => callback(toJsonRpcError(err)));
  };

  // -----------------------------------------------------------------------
  // session.close
  // -----------------------------------------------------------------------
  methods["session.close"] = (args, callback) => {
    const parsed = SessionCloseParamsSchema.safeParse(args);
    if (!parsed.success) {
      return callback({
        code: ObserverErrorCode.InvalidParams,
        message: `Invalid params: ${parsed.error.message}`,
      });
    }
    const { session_id } = parsed.data;

    // session.close bypasses audit blocking (can close even if audit is down)
    try {
      auditLogger.log(
        createAuditEvent("session", "session.close", session_id, null, {}),
      );
    } catch {
      logger.warn("Audit write failed during session.close (non-blocking)");
    }

    sessionManager
      .closeSession(session_id)
      .then(() => {
        callback(null, { closed: true });
      })
      .catch((err) => callback(toJsonRpcError(err)));
  };

  // -----------------------------------------------------------------------
  // session.resume
  // -----------------------------------------------------------------------
  methods["session.resume"] = (args, callback) => {
    const parsed = SessionResumeParamsSchema.safeParse(args);
    if (!parsed.success) {
      return callback({
        code: ObserverErrorCode.InvalidParams,
        message: `Invalid params: ${parsed.error.message}`,
      });
    }
    const { session_id } = parsed.data;

    const auditErr = tryAuditLog(
      auditLogger,
      createAuditEvent("session", "session.resume", session_id, null, {}),
      logger,
    );
    if (auditErr) return callback(auditErr);

    Promise.all([
      sessionManager.resumeSession(session_id),
      approvalGateway.getPendingApprovals(session_id),
    ])
      .then(([session, pendingApprovals]) => {
        // Build thread summary from session.thread_ids
        // We need to fetch each thread to get its details
        const threadPromises = session.thread_ids.map((tid) =>
          sessionManager.getThread(tid),
        );
        return Promise.all(threadPromises).then((threads) => {
          const threadSummaries = threads
            .filter((t): t is NonNullable<typeof t> => t !== null)
            .map((t) => ({
              thread_id: t.id,
              intent: t.intent,
              status: t.status,
              updated_at: t.updated_at,
            }));
          callback(null, {
            session_id: session.id,
            threads: threadSummaries,
            pending_approvals: pendingApprovals,
          });
        });
      })
      .catch((err) => callback(toJsonRpcError(err)));
  };

  // -----------------------------------------------------------------------
  // thread.create  (policy evaluation BEFORE creation)
  // -----------------------------------------------------------------------
  methods["thread.create"] = (args, callback) => {
    const parsed = ThreadCreateParamsSchema.safeParse(args);
    if (!parsed.success) {
      return callback({
        code: ObserverErrorCode.InvalidParams,
        message: `Invalid params: ${parsed.error.message}`,
      });
    }
    const { session_id, intent, intent_type, context, metadata } = parsed.data;

    const auditErr = tryAuditLog(
      auditLogger,
      createAuditEvent("thread", "thread.create", session_id, null, {
        intent,
        intent_type,
      }),
      logger,
    );
    if (auditErr) return callback(auditErr);

    // Fetch session for policy evaluation
    sessionManager
      .getSession(session_id)
      .then((session) => {
        if (!session) {
          return callback({
            code: ObserverErrorCode.SessionNotFound,
            message: `Session not found: ${session_id}`,
            data: { type: "session_not_found", session_id },
          } as JsonRpcError);
        }

        // Policy evaluation
        const policyReq: PolicyRequest = {
          method: "thread.create",
          params: parsed.data,
          session,
          thread: null,
        };
        const decision = policyEnforcer.evaluate(policyReq);

        if (decision.action === "deny") {
          return callback({
            code: ObserverErrorCode.PolicyDenied,
            message: `Policy denied: ${decision.reason}`,
            data: {
              type: "policy_denied",
              rule_id: decision.rule_id,
              reason: decision.reason,
            },
          } as JsonRpcError);
        }

        if (decision.action === "rate_limit") {
          return callback({
            code: ObserverErrorCode.RateLimited,
            message: "Rate limited",
            data: {
              type: "rate_limited",
              retry_after_seconds: decision.retry_after_seconds,
            },
          } as JsonRpcError);
        }

        // Allow or require_approval -- create the thread
        return sessionManager
          .createThread(session_id, intent, intent_type, context, metadata)
          .then((thread) => {
            callback(null, {
              thread_id: thread.id,
              status: thread.status,
            });
          });
      })
      .catch((err) => callback(toJsonRpcError(err)));
  };

  // -----------------------------------------------------------------------
  // thread.status
  // -----------------------------------------------------------------------
  methods["thread.status"] = (args, callback) => {
    const parsed = ThreadStatusParamsSchema.safeParse(args);
    if (!parsed.success) {
      return callback({
        code: ObserverErrorCode.InvalidParams,
        message: `Invalid params: ${parsed.error.message}`,
      });
    }
    const { thread_id } = parsed.data;

    const auditErr = tryAuditLog(
      auditLogger,
      createAuditEvent("thread", "thread.status", null, thread_id, {}),
      logger,
    );
    if (auditErr) return callback(auditErr);

    sessionManager
      .getThread(thread_id)
      .then((thread) => {
        if (!thread) {
          return callback({
            code: ObserverErrorCode.ThreadNotFound,
            message: `Thread not found: ${thread_id}`,
            data: { type: "thread_not_found", thread_id },
          } as JsonRpcError);
        }

        return approvalGateway
          .getPendingApprovals(thread.session_id)
          .then((allPending) => {
            // Filter to approvals relevant to this thread
            const threadApprovals = allPending.filter(
              (a) => a.thread_id === thread_id,
            );

            callback(null, {
              thread_id: thread.id,
              status: thread.status,
              turns: [], // Turns are loaded via turn IDs -- simplified for Phase 1
              pending_approvals: threadApprovals,
            });
          });
      })
      .catch((err) => callback(toJsonRpcError(err)));
  };

  // -----------------------------------------------------------------------
  // thread.cancel
  // -----------------------------------------------------------------------
  methods["thread.cancel"] = (args, callback) => {
    const parsed = ThreadCancelParamsSchema.safeParse(args);
    if (!parsed.success) {
      return callback({
        code: ObserverErrorCode.InvalidParams,
        message: `Invalid params: ${parsed.error.message}`,
      });
    }
    const { thread_id } = parsed.data;

    const auditErr = tryAuditLog(
      auditLogger,
      createAuditEvent("thread", "thread.cancel", null, thread_id, {}),
      logger,
    );
    if (auditErr) return callback(auditErr);

    sessionManager
      .cancelThread(thread_id)
      .then(() => {
        callback(null, { cancelled: true });
      })
      .catch((err) => callback(toJsonRpcError(err)));
  };

  // -----------------------------------------------------------------------
  // turn.submit  (policy evaluation BEFORE creating turn)
  // -----------------------------------------------------------------------
  methods["turn.submit"] = (args, callback) => {
    const parsed = TurnSubmitParamsSchema.safeParse(args);
    if (!parsed.success) {
      return callback({
        code: ObserverErrorCode.InvalidParams,
        message: `Invalid params: ${parsed.error.message}`,
      });
    }
    const { thread_id, message, attachments } = parsed.data;

    const auditErr = tryAuditLog(
      auditLogger,
      createAuditEvent("turn", "turn.submit", null, thread_id, {
        message_length: message.length,
      }),
      logger,
    );
    if (auditErr) return callback(auditErr);

    // Fetch thread and session for policy evaluation
    sessionManager
      .getThread(thread_id)
      .then((thread) => {
        if (!thread) {
          return callback({
            code: ObserverErrorCode.ThreadNotFound,
            message: `Thread not found: ${thread_id}`,
            data: { type: "thread_not_found", thread_id },
          } as JsonRpcError);
        }

        return sessionManager.getSession(thread.session_id).then((session) => {
          if (!session) {
            return callback({
              code: ObserverErrorCode.SessionNotFound,
              message: `Session not found: ${thread.session_id}`,
              data: {
                type: "session_not_found",
                session_id: thread.session_id,
              },
            } as JsonRpcError);
          }

          // Policy evaluation
          const policyReq: PolicyRequest = {
            method: "turn.submit",
            params: parsed.data,
            session,
            thread,
          };
          const decision = policyEnforcer.evaluate(policyReq);

          if (decision.action === "deny") {
            return callback({
              code: ObserverErrorCode.PolicyDenied,
              message: `Policy denied: ${decision.reason}`,
              data: {
                type: "policy_denied",
                rule_id: decision.rule_id,
                reason: decision.reason,
              },
            } as JsonRpcError);
          }

          if (decision.action === "rate_limit") {
            return callback({
              code: ObserverErrorCode.RateLimited,
              message: "Rate limited",
              data: {
                type: "rate_limited",
                retry_after_seconds: decision.retry_after_seconds,
              },
            } as JsonRpcError);
          }

          return sessionManager
            .createTurn(thread_id, message, attachments)
            .then((turn) => {
              callback(null, {
                turn_id: turn.id,
                status: turn.status,
              });
            });
        });
      })
      .catch((err) => callback(toJsonRpcError(err)));
  };

  // -----------------------------------------------------------------------
  // approval.respond
  // -----------------------------------------------------------------------
  methods["approval.respond"] = (args, callback) => {
    const parsed = ApprovalRespondParamsSchema.safeParse(args);
    if (!parsed.success) {
      return callback({
        code: ObserverErrorCode.InvalidParams,
        message: `Invalid params: ${parsed.error.message}`,
      });
    }
    const { approval_id, decision } = parsed.data;

    const auditErr = tryAuditLog(
      auditLogger,
      createAuditEvent("approval", "approval.respond", null, null, {
        approval_id,
        decision: decision.decision,
      }),
      logger,
    );
    if (auditErr) return callback(auditErr);

    approvalGateway
      .submitDecision(approval_id, decision)
      .then(() => {
        callback(null, { acknowledged: true });
      })
      .catch((err) => callback(toJsonRpcError(err)));
  };

  // -----------------------------------------------------------------------
  // health.status  (NO AUTH, NO AUDIT BLOCKING)
  // -----------------------------------------------------------------------
  methods["health.status"] = (_args, callback) => {
    try {
      const status = healthMonitor.getStatus();
      callback(null, status);
    } catch (err) {
      callback(toJsonRpcError(err));
    }
  };

  // -----------------------------------------------------------------------
  // audit.query
  // -----------------------------------------------------------------------
  methods["audit.query"] = (args, callback) => {
    const parsed = AuditQueryParamsSchema.safeParse(args);
    if (!parsed.success) {
      return callback({
        code: ObserverErrorCode.InvalidParams,
        message: `Invalid params: ${parsed.error.message}`,
      });
    }

    try {
      const result = auditLogger.query(parsed.data);
      callback(null, result);
    } catch (err) {
      callback(toJsonRpcError(err));
    }
  };

  // -----------------------------------------------------------------------
  // admin.revoke_token
  // -----------------------------------------------------------------------
  methods["admin.revoke_token"] = (args, callback) => {
    const parsed = AdminRevokeTokenParamsSchema.safeParse(args);
    if (!parsed.success) {
      return callback({
        code: ObserverErrorCode.InvalidParams,
        message: `Invalid params: ${parsed.error.message}`,
      });
    }
    const { token_hash } = parsed.data;

    const auditErr = tryAuditLog(
      auditLogger,
      createAuditEvent("security", "admin.revoke_token", null, null, {
        token_hash_prefix: token_hash.substring(0, 8) + "...",
      }),
      logger,
    );
    if (auditErr) return callback(auditErr);

    const revoked = tokenAuth.revokeToken(token_hash);
    callback(null, {
      revoked,
      active_tokens: tokenAuth.activeTokenCount(),
    });
  };

  // -----------------------------------------------------------------------
  // vault.query  (requires auth, audit logged)
  // -----------------------------------------------------------------------
  methods["vault.query"] = (args, callback) => {
    if (!vaultConnector) {
      return callback({
        code: ObserverErrorCode.ConfigInvalid,
        message: "Vault not configured — set vault.path in control-plane.yaml or OBSERVER_VAULT_PATH env var",
      });
    }

    const parsed = VaultQueryParamsSchema.safeParse(args ?? {});
    if (!parsed.success) {
      return callback({
        code: ObserverErrorCode.InvalidParams,
        message: `Invalid params: ${parsed.error.message}`,
      });
    }

    const auditErr = tryAuditLog(
      auditLogger,
      createAuditEvent("system", "vault.query", null, null, {
        path_prefix: parsed.data.path_prefix ?? null,
        status_filter: parsed.data.status_filter ?? null,
        limit: parsed.data.limit ?? null,
        offset: parsed.data.offset ?? null,
      }),
      logger,
    );
    if (auditErr) return callback(auditErr);

    vaultConnector
      .query(parsed.data)
      .then((result) => {
        callback(null, result);
      })
      .catch((err) => callback(toJsonRpcError(err)));
  };

  // -----------------------------------------------------------------------
  // vault.status  (requires auth, no audit needed)
  // -----------------------------------------------------------------------
  methods["vault.status"] = (_args, callback) => {
    if (!vaultConnector) {
      return callback({
        code: ObserverErrorCode.ConfigInvalid,
        message: "Vault not configured — set vault.path in control-plane.yaml or OBSERVER_VAULT_PATH env var",
      });
    }

    vaultConnector
      .getStatus()
      .then((result) => {
        callback(null, result);
      })
      .catch((err) => callback(toJsonRpcError(err)));
  };

  return methods;
}
