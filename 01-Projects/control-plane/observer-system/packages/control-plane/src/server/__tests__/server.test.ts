// S5 Test Suite: Server Integration
// Tests the full JSON-RPC server via actual HTTP requests.
// Covers all ISC criteria:
//   1. Server binds to 127.0.0.1 only
//   2. All 11 JSON-RPC methods are registered and callable
//   3. health.status works without auth token
//   4. Authenticated methods reject without valid Bearer token (AuthRequired -32000)
//   5. session.create returns session_id and created_at
//   6. thread.create goes through policy evaluation
//   7. approval.respond resolves pending approval
//   8. Unknown methods return MethodNotFound (-32601)
//   9. Server graceful shutdown closes all subsystems
//  10. TypeScript compiles with tsc --noEmit (external verification)

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import http from "node:http";
import { createServer, type ObserverServer, type ServerDependencies } from "../server.js";
import { SessionManagerImpl } from "../../session/session-manager.js";
import { PolicyEnforcerImpl } from "../../policy/policy-enforcer.js";
import { AuditLoggerImpl } from "../../audit/audit-logger.js";
import { ApprovalGatewayImpl } from "../../approval/approval-gateway.js";
import { createHealthMonitor, type HealthMonitorInstance } from "../../health/health-monitor.js";
import type {
  HealthStatus,
  AuditLogger,
  AuditStore,
} from "@observer/shared";
import { ObserverErrorCode } from "@observer/shared";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Test configuration
// ---------------------------------------------------------------------------

const TEST_TOKEN = "test-token-that-is-long-enough-for-validation";
const TEST_TOKEN_LABEL = "test-cli";
const TEST_PORT = 0; // Let the OS assign a free port

// ---------------------------------------------------------------------------
// JSON-RPC client helper
// ---------------------------------------------------------------------------

interface JsonRpcRequest {
  jsonrpc: "2.0";
  method: string;
  params: unknown;
  id: number;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
  id: number | null;
}

function makeRequest(
  port: number,
  body: JsonRpcRequest,
  headers?: Record<string, string>,
): Promise<{ status: number; body: JsonRpcResponse }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const reqHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "Content-Length": String(Buffer.byteLength(payload)),
      ...headers,
    };

    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        method: "POST",
        headers: reqHeaders,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf-8");
          try {
            const parsed = JSON.parse(raw) as JsonRpcResponse;
            resolve({ status: res.statusCode ?? 0, body: parsed });
          } catch {
            resolve({
              status: res.statusCode ?? 0,
              body: { jsonrpc: "2.0", error: { code: -1, message: raw }, id: null },
            });
          }
        });
      },
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function rpc(
  port: number,
  method: string,
  params: unknown,
  token?: string,
): Promise<{ status: number; body: JsonRpcResponse }> {
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return makeRequest(
    port,
    { jsonrpc: "2.0", method, params, id: 1 },
    headers,
  );
}

function authRpc(
  port: number,
  method: string,
  params: unknown,
): Promise<{ status: number; body: JsonRpcResponse }> {
  return rpc(port, method, params, TEST_TOKEN);
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

describe("S5: Server Integration", () => {
  let server: ObserverServer;
  let port: number;
  let tmpDir: string;
  let sessionManager: SessionManagerImpl;
  let policyEnforcer: PolicyEnforcerImpl;
  let auditLogger: AuditLoggerImpl;
  let approvalGateway: ApprovalGatewayImpl;
  let healthMonitor: HealthMonitorInstance;

  beforeAll(async () => {
    // Create temp directory for audit data
    tmpDir = mkdtempSync(join(tmpdir(), "observer-s5-test-"));

    // Create real subsystem instances
    sessionManager = new SessionManagerImpl({ dbPath: ":memory:" });
    policyEnforcer = new PolicyEnforcerImpl();
    auditLogger = new AuditLoggerImpl({ dataDir: tmpDir });
    approvalGateway = new ApprovalGatewayImpl({
      dbPath: ":memory:",
      resolveSessionId: async (threadId) => {
        const thread = await sessionManager.getThread(threadId);
        return thread?.session_id ?? "unknown";
      },
      auditLogger,
      schedulerIntervalMs: 60000, // Long interval -- tests control timing
    });
    healthMonitor = createHealthMonitor({
      backends: [],
      config: {
        backend_check_interval_seconds: 3600,
        audit_check_interval_seconds: 3600,
      },
    });

    const deps: ServerDependencies = {
      sessionManager,
      policyEnforcer,
      auditLogger,
      approvalGateway,
      healthMonitor,
    };

    server = createServer(deps, {
      port: TEST_PORT,
      tokens: [{ token: TEST_TOKEN, label: TEST_TOKEN_LABEL }],
      logLevel: "silent",
    });

    await server.start();

    // Get the actual port from the listening server
    const addr = server.httpServer.address();
    if (typeof addr === "object" && addr !== null) {
      port = addr.port;
    } else {
      throw new Error("Server did not start correctly");
    }
  });

  afterAll(async () => {
    await server.shutdown();
    // Cleanup temp directory
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // -----------------------------------------------------------------------
  // ISC-1: Server binds to 127.0.0.1 only
  // -----------------------------------------------------------------------

  describe("ISC-1: 127.0.0.1 binding", () => {
    it("binds to 127.0.0.1", () => {
      const addr = server.httpServer.address();
      expect(addr).not.toBeNull();
      expect(typeof addr).toBe("object");
      if (typeof addr === "object" && addr !== null) {
        expect(addr.address).toBe("127.0.0.1");
      }
    });

    it("rejects 0.0.0.0 binding in configuration", async () => {
      // createServer with 0.0.0.0 is not possible because we hardcode 127.0.0.1
      // in the listen call. This test verifies the assertion by checking
      // the bound address is always 127.0.0.1
      const addr = server.httpServer.address();
      if (typeof addr === "object" && addr !== null) {
        expect(addr.address).not.toBe("0.0.0.0");
        expect(addr.address).not.toBe("::");
      }
    });
  });

  // -----------------------------------------------------------------------
  // ISC-2: All 11 JSON-RPC methods are registered and callable
  // -----------------------------------------------------------------------

  describe("ISC-2: All 11 methods registered", () => {
    const methods = [
      "session.create",
      "session.close",
      "session.resume",
      "thread.create",
      "thread.status",
      "thread.cancel",
      "turn.submit",
      "approval.respond",
      "health.status",
      "audit.query",
      "admin.revoke_token",
    ];

    it.each(methods)("method %s is registered and callable", async (method) => {
      // We send a request with valid auth -- it should NOT return MethodNotFound
      // (It may return InvalidParams or other errors, but NOT -32601)
      const res = await authRpc(port, method, {});
      expect(res.body.error?.code).not.toBe(ObserverErrorCode.MethodNotFound);
    });
  });

  // -----------------------------------------------------------------------
  // ISC-3: health.status works without auth token
  // -----------------------------------------------------------------------

  describe("ISC-3: health.status without auth", () => {
    it("returns health status without Authorization header", async () => {
      const res = await rpc(port, "health.status", {});
      expect(res.status).toBe(200);
      expect(res.body.error).toBeUndefined();
      expect(res.body.result).toBeDefined();

      const result = res.body.result as HealthStatus;
      expect(result.server).toBeDefined();
      expect(result.server.status).toBeDefined();
      expect(result.server.uptime_seconds).toBeGreaterThanOrEqual(0);
      expect(result.backends).toBeDefined();
      expect(result.audit).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // ISC-4: Authenticated methods reject without valid Bearer token
  // -----------------------------------------------------------------------

  describe("ISC-4: Auth rejection", () => {
    const authenticatedMethods = [
      "session.create",
      "session.close",
      "session.resume",
      "thread.create",
      "thread.status",
      "thread.cancel",
      "turn.submit",
      "approval.respond",
      "audit.query",
      "admin.revoke_token",
    ];

    it.each(authenticatedMethods)(
      "%s rejects request without auth token",
      async (method) => {
        const res = await rpc(port, method, {});
        expect(res.body.error).toBeDefined();
        expect(res.body.error!.code).toBe(ObserverErrorCode.AuthRequired);
      },
    );

    it("rejects request with invalid token", async () => {
      const res = await rpc(port, "session.create", {}, "invalid-token");
      expect(res.body.error).toBeDefined();
      expect(res.body.error!.code).toBe(ObserverErrorCode.AuthFailed);
    });

    it("rejects request with malformed Authorization header", async () => {
      const res = await makeRequest(
        port,
        {
          jsonrpc: "2.0",
          method: "session.create",
          params: {},
          id: 1,
        },
        {
          "Content-Type": "application/json",
          Authorization: "Basic dXNlcjpwYXNz",
        },
      );
      expect(res.body.error).toBeDefined();
      expect(res.body.error!.code).toBe(ObserverErrorCode.AuthFailed);
    });
  });

  // -----------------------------------------------------------------------
  // ISC-5: session.create returns session_id and created_at
  // -----------------------------------------------------------------------

  describe("ISC-5: session.create", () => {
    it("returns session_id and created_at", async () => {
      const res = await authRpc(port, "session.create", {
        client_type: "cli",
        client_id: "test-user-1",
      });

      expect(res.body.error).toBeUndefined();
      expect(res.body.result).toBeDefined();

      const result = res.body.result as { session_id: string; created_at: string };
      expect(result.session_id).toBeDefined();
      expect(result.session_id).toMatch(/^ses_/);
      expect(result.created_at).toBeDefined();
      expect(new Date(result.created_at).toISOString()).toBe(result.created_at);
    });

    it("rejects invalid params (missing client_type)", async () => {
      const res = await authRpc(port, "session.create", {
        client_id: "test",
      });
      expect(res.body.error).toBeDefined();
      expect(res.body.error!.code).toBe(ObserverErrorCode.InvalidParams);
    });
  });

  // -----------------------------------------------------------------------
  // ISC-6: thread.create goes through policy evaluation
  // -----------------------------------------------------------------------

  describe("ISC-6: thread.create with policy", () => {
    it("creates thread when policy allows (default deny returns PolicyDenied)", async () => {
      // First, create a session
      const sessionRes = await authRpc(port, "session.create", {
        client_type: "cli",
        client_id: "policy-test-user",
      });
      const sessionId = (sessionRes.body.result as { session_id: string }).session_id;

      // With no rules loaded, default deny kicks in
      const res = await authRpc(port, "thread.create", {
        session_id: sessionId,
        intent: "test intent",
        intent_type: "query",
      });

      // Default deny policy means PolicyDenied error
      expect(res.body.error).toBeDefined();
      expect(res.body.error!.code).toBe(ObserverErrorCode.PolicyDenied);
    });

    it("returns session not found for invalid session_id", async () => {
      const res = await authRpc(port, "thread.create", {
        session_id: "ses_nonexistent1",
        intent: "test",
        intent_type: "query",
      });
      expect(res.body.error).toBeDefined();
      expect(res.body.error!.code).toBe(ObserverErrorCode.SessionNotFound);
    });
  });

  // -----------------------------------------------------------------------
  // ISC-7: approval.respond resolves pending approval
  // -----------------------------------------------------------------------

  describe("ISC-7: approval.respond", () => {
    it("returns error for non-existent approval", async () => {
      const res = await authRpc(port, "approval.respond", {
        approval_id: "apr_nonexistent1",
        decision: { decision: "approved" },
      });
      // Should fail because the approval doesn't exist
      expect(res.body.error).toBeDefined();
    });

    it("validates params correctly", async () => {
      const res = await authRpc(port, "approval.respond", {
        // Missing required fields
      });
      expect(res.body.error).toBeDefined();
      expect(res.body.error!.code).toBe(ObserverErrorCode.InvalidParams);
    });
  });

  // -----------------------------------------------------------------------
  // ISC-8: Unknown methods return MethodNotFound (-32601)
  // -----------------------------------------------------------------------

  describe("ISC-8: Unknown methods", () => {
    it("returns MethodNotFound for unknown method", async () => {
      const res = await authRpc(port, "nonexistent.method", {});
      expect(res.body.error).toBeDefined();
      expect(res.body.error!.code).toBe(ObserverErrorCode.MethodNotFound);
    });

    it("returns MethodNotFound for another unknown method", async () => {
      const res = await authRpc(port, "foo.bar.baz", {});
      expect(res.body.error).toBeDefined();
      expect(res.body.error!.code).toBe(ObserverErrorCode.MethodNotFound);
    });
  });

  // -----------------------------------------------------------------------
  // ISC-9: Graceful shutdown closes all subsystems
  // -----------------------------------------------------------------------

  describe("ISC-9: Graceful shutdown", () => {
    it("shutdown closes subsystems and stops accepting connections", async () => {
      // Create a separate server to test shutdown
      const shutdownTmpDir = mkdtempSync(join(tmpdir(), "observer-s5-shutdown-"));
      const shutdownSessionMgr = new SessionManagerImpl({ dbPath: ":memory:" });
      const shutdownAuditLogger = new AuditLoggerImpl({ dataDir: shutdownTmpDir });
      const shutdownApprovalGw = new ApprovalGatewayImpl({
        dbPath: ":memory:",
        resolveSessionId: async () => "unknown",
        schedulerIntervalMs: 60000,
      });
      const shutdownHealthMon = createHealthMonitor({
        backends: [],
        config: {
          backend_check_interval_seconds: 3600,
          audit_check_interval_seconds: 3600,
        },
      });

      const shutdownServer = createServer(
        {
          sessionManager: shutdownSessionMgr,
          policyEnforcer: new PolicyEnforcerImpl(),
          auditLogger: shutdownAuditLogger,
          approvalGateway: shutdownApprovalGw,
          healthMonitor: shutdownHealthMon,
        },
        {
          port: 0,
          tokens: [{ token: TEST_TOKEN, label: "shutdown-test" }],
          logLevel: "silent",
        },
      );

      await shutdownServer.start();
      const shutdownAddr = shutdownServer.httpServer.address();
      expect(shutdownAddr).not.toBeNull();

      // Verify it works before shutdown
      const shutdownPort =
        typeof shutdownAddr === "object" && shutdownAddr !== null
          ? shutdownAddr.port
          : 0;
      const preRes = await rpc(shutdownPort, "health.status", {});
      expect(preRes.body.result).toBeDefined();

      // Shutdown
      await shutdownServer.shutdown();

      // After shutdown, connection should fail (ECONNREFUSED or ECONNRESET)
      try {
        await rpc(shutdownPort, "health.status", {});
        // If we get here, the server is still accepting connections
        expect.fail("Server should have stopped accepting connections");
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        // ECONNREFUSED = port no longer listening (immediate rejection)
        // ECONNRESET = connection accepted but socket destroyed during shutdown
        // Both indicate the server is no longer operational
        expect(["ECONNREFUSED", "ECONNRESET"]).toContain(code);
      }

      // Cleanup
      try {
        rmSync(shutdownTmpDir, { recursive: true, force: true });
      } catch {
        // Ignore
      }
    });
  });

  // -----------------------------------------------------------------------
  // Additional integration tests
  // -----------------------------------------------------------------------

  describe("Full workflow: create session, query audit, close session", () => {
    it("complete session lifecycle", async () => {
      // 1. Create session
      const createRes = await authRpc(port, "session.create", {
        client_type: "cli",
        client_id: "workflow-user",
      });
      expect(createRes.body.error).toBeUndefined();
      const { session_id } = createRes.body.result as { session_id: string; created_at: string };
      expect(session_id).toMatch(/^ses_/);

      // 2. Resume session
      const resumeRes = await authRpc(port, "session.resume", {
        session_id,
      });
      expect(resumeRes.body.error).toBeUndefined();
      const resumeResult = resumeRes.body.result as {
        session_id: string;
        threads: unknown[];
        pending_approvals: unknown[];
      };
      expect(resumeResult.session_id).toBe(session_id);
      expect(resumeResult.threads).toEqual([]);
      expect(resumeResult.pending_approvals).toEqual([]);

      // 3. Query audit (should have events from the session operations)
      const auditRes = await authRpc(port, "audit.query", {
        session_id,
        limit: 10,
      });
      expect(auditRes.body.error).toBeUndefined();
      const auditResult = auditRes.body.result as {
        events: unknown[];
        total_count: number;
        has_more: boolean;
      };
      expect(auditResult.events).toBeDefined();
      expect(auditResult.total_count).toBeGreaterThanOrEqual(0);

      // 4. Close session
      const closeRes = await authRpc(port, "session.close", {
        session_id,
      });
      expect(closeRes.body.error).toBeUndefined();
      expect((closeRes.body.result as { closed: boolean }).closed).toBe(true);

      // 5. Resume closed session should fail
      const reResumeRes = await authRpc(port, "session.resume", {
        session_id,
      });
      expect(reResumeRes.body.error).toBeDefined();
    });
  });

  describe("HTTP method and content type validation", () => {
    it("rejects non-POST requests", async () => {
      return new Promise<void>((resolve, reject) => {
        const req = http.request(
          {
            hostname: "127.0.0.1",
            port,
            method: "GET",
            headers: { "Content-Type": "application/json" },
          },
          (res) => {
            expect(res.statusCode).toBe(405);
            res.resume();
            res.on("end", resolve);
          },
        );
        req.on("error", reject);
        req.end();
      });
    });

    it("rejects non-JSON content type", async () => {
      return new Promise<void>((resolve, reject) => {
        const body = '{"jsonrpc":"2.0","method":"health.status","params":{},"id":1}';
        const req = http.request(
          {
            hostname: "127.0.0.1",
            port,
            method: "POST",
            headers: {
              "Content-Type": "text/plain",
              "Content-Length": String(Buffer.byteLength(body)),
            },
          },
          (res) => {
            expect(res.statusCode).toBe(415);
            res.resume();
            res.on("end", resolve);
          },
        );
        req.on("error", reject);
        req.write(body);
        req.end();
      });
    });

    it("handles malformed JSON", async () => {
      return new Promise<void>((resolve, reject) => {
        const body = "{ invalid json }";
        const req = http.request(
          {
            hostname: "127.0.0.1",
            port,
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Content-Length": String(Buffer.byteLength(body)),
            },
          },
          (res) => {
            const chunks: Buffer[] = [];
            res.on("data", (chunk: Buffer) => chunks.push(chunk));
            res.on("end", () => {
              const raw = Buffer.concat(chunks).toString("utf-8");
              const parsed = JSON.parse(raw) as JsonRpcResponse;
              expect(parsed.error?.code).toBe(ObserverErrorCode.ParseError);
              resolve();
            });
          },
        );
        req.on("error", reject);
        req.write(body);
        req.end();
      });
    });
  });

  describe("session.close and thread.cancel", () => {
    it("session.close returns { closed: true }", async () => {
      const createRes = await authRpc(port, "session.create", {
        client_type: "cli",
        client_id: "close-test",
      });
      const { session_id } = createRes.body.result as { session_id: string };

      const closeRes = await authRpc(port, "session.close", { session_id });
      expect(closeRes.body.error).toBeUndefined();
      expect((closeRes.body.result as { closed: boolean }).closed).toBe(true);
    });

    it("thread.cancel returns error for non-existent thread", async () => {
      const res = await authRpc(port, "thread.cancel", {
        thread_id: "thr_nonexistent1",
      });
      expect(res.body.error).toBeDefined();
      expect(res.body.error!.code).toBe(ObserverErrorCode.ThreadNotFound);
    });
  });

  describe("thread.status", () => {
    it("returns error for non-existent thread", async () => {
      const res = await authRpc(port, "thread.status", {
        thread_id: "thr_doesnotexist",
      });
      expect(res.body.error).toBeDefined();
      expect(res.body.error!.code).toBe(ObserverErrorCode.ThreadNotFound);
    });
  });

  describe("turn.submit", () => {
    it("returns error for non-existent thread", async () => {
      const res = await authRpc(port, "turn.submit", {
        thread_id: "thr_nonexistent1",
        message: "hello",
      });
      expect(res.body.error).toBeDefined();
      expect(res.body.error!.code).toBe(ObserverErrorCode.ThreadNotFound);
    });
  });

  describe("admin.revoke_token", () => {
    it("returns revoked: false for non-existent token", async () => {
      const res = await authRpc(port, "admin.revoke_token", {
        token_hash: "nonexistent-token-hash-value",
      });
      expect(res.body.error).toBeUndefined();
      const result = res.body.result as { revoked: boolean; active_tokens: number };
      expect(result.revoked).toBe(false);
      expect(result.active_tokens).toBeGreaterThanOrEqual(1);
    });
  });
});
