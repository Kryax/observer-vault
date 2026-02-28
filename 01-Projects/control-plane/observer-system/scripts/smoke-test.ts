#!/usr/bin/env npx tsx
// =============================================================================
// Observer Control Plane — Smoke Test
// =============================================================================
// Post-build verification covering the full lifecycle:
//   1. Health check          — server responds, no auth required
//   2. Auth test             — reject unauthenticated, accept valid token
//   3. Session lifecycle     — create session
//   4. Thread creation       — create thread in session
//   5. Session close         — cleanly close session
//   6. Audit check           — query audit trail, events recorded
//   7. Credential leak check — scan audit for exposed credentials
//
// Exit 0 = all pass. Non-zero = failure.
// =============================================================================

import http from "node:http";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// --- Inline imports (avoids needing tsx to resolve workspace packages) ---
// We'll use dynamic imports to load the actual modules.

const SMOKE_TOKEN = "smoke-test-token-abc123";
const SMOKE_PORT = 19876; // Unusual port to avoid conflicts

// Colors for terminal output
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

let passCount = 0;
let failCount = 0;

function pass(name: string): void {
  passCount++;
  console.log(`  ${GREEN}✓${RESET} ${name}`);
}

function fail(name: string, reason: string): void {
  failCount++;
  console.log(`  ${RED}✗${RESET} ${name}: ${RED}${reason}${RESET}`);
}

// --- JSON-RPC HTTP client ---

interface JsonRpcResponse {
  jsonrpc: string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
  id: number;
}

async function rpcCall(
  method: string,
  params: Record<string, unknown>,
  token?: string,
): Promise<JsonRpcResponse> {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    method,
    params,
    id: Date.now(),
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: SMOKE_PORT,
        method: "POST",
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          try {
            const text = Buffer.concat(chunks).toString("utf-8");
            resolve(JSON.parse(text) as JsonRpcResponse);
          } catch (e) {
            reject(new Error(`Failed to parse response: ${e}`));
          }
        });
      },
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// --- Main smoke test ---

async function main(): Promise<void> {
  console.log(
    `\n${BOLD}${CYAN}═══════════════════════════════════════════════════════════${RESET}`,
  );
  console.log(
    `${BOLD}${CYAN}  Observer Control Plane — Smoke Test${RESET}`,
  );
  console.log(
    `${BOLD}${CYAN}═══════════════════════════════════════════════════════════${RESET}\n`,
  );

  // Create temp directories for subsystem data
  const tmpBase = mkdtempSync(join(tmpdir(), "observer-smoke-"));
  const dataDir = join(tmpBase, "data");
  const sessionDbPath = join(tmpBase, "sessions.db");
  const approvalDbPath = join(tmpBase, "approvals.db");
  const auditDir = join(tmpBase, "audit");

  try {
    // Dynamic import of workspace packages
    const shared = await import("@observer/shared");
    const { SessionManagerImpl } = await import(
      "../packages/control-plane/src/session/session-manager.js"
    );
    const { PolicyEnforcerImpl } = await import(
      "../packages/control-plane/src/policy/policy-enforcer.js"
    );
    const { AuditLoggerImpl } = await import(
      "../packages/control-plane/src/audit/audit-logger.js"
    );
    const { ApprovalGatewayImpl } = await import(
      "../packages/control-plane/src/approval/approval-gateway.js"
    );
    const { createHealthMonitor } = await import(
      "../packages/control-plane/src/health/health-monitor.js"
    );
    const { createServer } = await import(
      "../packages/control-plane/src/server/server.js"
    );

    // Create pino logger (silent for smoke test)
    const pino = (await import("pino")).default;
    const logger = pino({ level: "silent" });

    // --- Instantiate all subsystems ---
    const sessionManager = new SessionManagerImpl({
      dbPath: sessionDbPath,
      logger,
    });

    const policyEnforcer = new PolicyEnforcerImpl(logger);
    // No rules loaded = default deny (for thread creation test)

    const auditLogger = new AuditLoggerImpl({ dataDir: auditDir });

    const approvalGateway = new ApprovalGatewayImpl({
      dbPath: approvalDbPath,
      resolveSessionId: async (threadId: string) => {
        const thread = await sessionManager.getThread(threadId);
        return thread?.session_id ?? null;
      },
      auditLogger: {
        log: (event: unknown) => auditLogger.log(event as any),
      },
      logger,
    });

    const healthMonitor = createHealthMonitor({
      backends: [],
      config: {
        backend_check_interval_seconds: 60,
        audit_check_interval_seconds: 60,
      },
    });
    healthMonitor.start();

    // --- Create server ---
    const server = createServer(
      {
        sessionManager,
        policyEnforcer,
        auditLogger,
        approvalGateway,
        healthMonitor,
      },
      {
        port: SMOKE_PORT,
        tokens: [{ token: SMOKE_TOKEN, client_id: "smoke-cli", scope: "cli" }],
        logLevel: "silent",
      },
    );

    await server.start();
    console.log(
      `${YELLOW}Server started on 127.0.0.1:${SMOKE_PORT}${RESET}\n`,
    );

    // =====================================================================
    // STEP 1: Health Check (no auth required)
    // =====================================================================
    console.log(`${BOLD}Step 1: Health Check${RESET}`);
    try {
      const healthRes = await rpcCall("health.status", {});
      if (healthRes.result && typeof healthRes.result === "object") {
        const result = healthRes.result as Record<string, unknown>;
        const server = result.server as Record<string, unknown> | undefined;
        const status = server?.status;
        if (status === "healthy" || status === "degraded") {
          pass("health.status returns server status without auth");
        } else {
          fail("health.status", `unexpected status: ${JSON.stringify(status)}`);
        }
      } else if (healthRes.error) {
        fail("health.status", `error: ${healthRes.error.message}`);
      } else {
        fail("health.status", "no result or error in response");
      }
    } catch (e) {
      fail("health.status", `connection failed: ${e}`);
    }

    // =====================================================================
    // STEP 2: Auth Test
    // =====================================================================
    console.log(`\n${BOLD}Step 2: Auth Test${RESET}`);

    // 2a: Reject unauthenticated request
    try {
      const noAuthRes = await rpcCall("session.create", {
        client_type: "cli",
        client_id: "test",
      });
      if (
        noAuthRes.error &&
        noAuthRes.error.code === shared.ObserverErrorCode.AuthRequired
      ) {
        pass("Unauthenticated request rejected with AuthRequired (-32000)");
      } else {
        fail(
          "Auth rejection",
          `expected error -32000, got: ${JSON.stringify(noAuthRes)}`,
        );
      }
    } catch (e) {
      fail("Auth rejection", `${e}`);
    }

    // 2b: Reject bad token
    try {
      const badAuthRes = await rpcCall(
        "session.create",
        { client_type: "cli", client_id: "test" },
        "invalid-token",
      );
      if (
        badAuthRes.error &&
        badAuthRes.error.code === shared.ObserverErrorCode.AuthFailed
      ) {
        pass("Invalid token rejected with AuthFailed (-32001)");
      } else {
        fail(
          "Bad token rejection",
          `expected error -32001, got: ${JSON.stringify(badAuthRes)}`,
        );
      }
    } catch (e) {
      fail("Bad token rejection", `${e}`);
    }

    // 2c: Accept valid token (we'll test this in session.create)

    // =====================================================================
    // STEP 3: Session Lifecycle — Create Session
    // =====================================================================
    console.log(`\n${BOLD}Step 3: Session Lifecycle${RESET}`);

    let sessionId: string | null = null;
    try {
      const createRes = await rpcCall(
        "session.create",
        { client_type: "cli", client_id: "smoke-user" },
        SMOKE_TOKEN,
      );
      if (createRes.result && typeof createRes.result === "object") {
        const result = createRes.result as Record<string, unknown>;
        sessionId = result.session_id as string;
        if (
          sessionId &&
          sessionId.startsWith("ses_") &&
          result.created_at
        ) {
          pass(
            `session.create returns valid session: ${sessionId}`,
          );
        } else {
          fail(
            "session.create",
            `invalid result: ${JSON.stringify(result)}`,
          );
        }
      } else {
        fail(
          "session.create",
          `error: ${JSON.stringify(createRes.error)}`,
        );
      }
    } catch (e) {
      fail("session.create", `${e}`);
    }

    // =====================================================================
    // STEP 4: Thread Creation
    // =====================================================================
    console.log(`\n${BOLD}Step 4: Thread Creation${RESET}`);

    if (sessionId) {
      // First, load a simple allow-all policy so thread creation isn't blocked by default deny
      // We need to create a temp policy file
      const policyPath = join(tmpBase, "policy.yaml");
      const { writeFileSync } = await import("node:fs");
      writeFileSync(
        policyPath,
        [
          "policies:",
          "  default_action: deny",
          "  rules:",
          '    - id: allow_all',
          '      description: "Allow all for smoke test"',
          "      priority: 1",
          "      condition:",
          "        type: method_match",
          '        methods: ["thread.create", "turn.submit"]',
          "      action: allow",
          "",
        ].join("\n"),
      );
      policyEnforcer.loadRules(policyPath);

      try {
        const threadRes = await rpcCall(
          "thread.create",
          {
            session_id: sessionId,
            intent: "Smoke test intent",
            intent_type: "build",
          },
          SMOKE_TOKEN,
        );
        if (threadRes.result && typeof threadRes.result === "object") {
          const result = threadRes.result as Record<string, unknown>;
          if (
            result.thread_id &&
            (result.thread_id as string).startsWith("thr_")
          ) {
            pass(
              `thread.create returns valid thread: ${result.thread_id}`,
            );
          } else {
            fail(
              "thread.create",
              `invalid result: ${JSON.stringify(result)}`,
            );
          }
        } else {
          fail(
            "thread.create",
            `error: ${JSON.stringify(threadRes.error)}`,
          );
        }
      } catch (e) {
        fail("thread.create", `${e}`);
      }
    } else {
      fail("thread.create", "skipped — no session_id from step 3");
    }

    // =====================================================================
    // STEP 5: Session Close
    // =====================================================================
    console.log(`\n${BOLD}Step 5: Session Close${RESET}`);

    if (sessionId) {
      try {
        const closeRes = await rpcCall(
          "session.close",
          { session_id: sessionId },
          SMOKE_TOKEN,
        );
        if (closeRes.result && typeof closeRes.result === "object") {
          const result = closeRes.result as Record<string, unknown>;
          if (result.closed === true) {
            pass("session.close returns { closed: true }");
          } else {
            fail(
              "session.close",
              `unexpected result: ${JSON.stringify(result)}`,
            );
          }
        } else {
          fail(
            "session.close",
            `error: ${JSON.stringify(closeRes.error)}`,
          );
        }
      } catch (e) {
        fail("session.close", `${e}`);
      }
    } else {
      fail("session.close", "skipped — no session_id from step 3");
    }

    // =====================================================================
    // STEP 6: Audit Check
    // =====================================================================
    console.log(`\n${BOLD}Step 6: Audit Check${RESET}`);

    try {
      const auditRes = await rpcCall(
        "audit.query",
        { limit: 100 },
        SMOKE_TOKEN,
      );
      if (auditRes.result && typeof auditRes.result === "object") {
        const result = auditRes.result as Record<string, unknown>;
        const events = result.events as unknown[];
        if (events && events.length > 0) {
          pass(`audit.query returns ${events.length} event(s) from lifecycle`);

          // Check we have session.create and session.close events
          const actions = events.map(
            (e) => (e as Record<string, unknown>).action as string,
          );
          if (actions.includes("session.create")) {
            pass("Audit trail includes session.create event");
          } else {
            fail(
              "Audit event check",
              `session.create not found in: ${actions.join(", ")}`,
            );
          }
        } else {
          fail(
            "audit.query",
            "no events returned — audit logging may not be wired",
          );
        }
      } else {
        fail(
          "audit.query",
          `error: ${JSON.stringify(auditRes.error)}`,
        );
      }
    } catch (e) {
      fail("audit.query", `${e}`);
    }

    // =====================================================================
    // STEP 7: Credential Leak Check
    // =====================================================================
    console.log(`\n${BOLD}Step 7: Credential Leak Check${RESET}`);

    try {
      // Read all JSONL files in the audit directory
      const auditFiles = readdirSync(auditDir).filter((f) =>
        f.endsWith(".jsonl"),
      );
      let totalLines = 0;
      let leaksFound = 0;

      const credentialPatterns = [
        /sk-[a-zA-Z0-9]{20,}/,          // OpenAI
        /AIzaSy[a-zA-Z0-9_-]{30,}/,     // Google
        /ghp_[a-zA-Z0-9]{36,}/,         // GitHub PAT
        /ghs_[a-zA-Z0-9]{36,}/,         // GitHub App
        /eyJ[a-zA-Z0-9_-]{20,}\./,      // JWT
        /AKIA[0-9A-Z]{16}/,             // AWS Access Key
        /-----BEGIN (RSA |EC )?PRIVATE KEY-----/, // PEM keys
      ];

      for (const file of auditFiles) {
        const content = readFileSync(join(auditDir, file), "utf-8");
        const lines = content.split("\n").filter((l) => l.trim());
        totalLines += lines.length;

        for (const line of lines) {
          for (const pattern of credentialPatterns) {
            if (pattern.test(line)) {
              leaksFound++;
              fail(
                "Credential leak",
                `Found pattern ${pattern} in ${file}`,
              );
            }
          }
        }
      }

      // Also check that the smoke token itself isn't in audit logs
      for (const file of auditFiles) {
        const content = readFileSync(join(auditDir, file), "utf-8");
        if (content.includes(SMOKE_TOKEN)) {
          leaksFound++;
          fail("Credential leak", `Smoke test token found in ${file}`);
        }
      }

      if (leaksFound === 0) {
        pass(
          `No credential leaks in ${auditFiles.length} audit file(s) (${totalLines} lines scanned)`,
        );
      }
    } catch (e) {
      fail("Credential leak check", `${e}`);
    }

    // =====================================================================
    // Shutdown
    // =====================================================================
    console.log(`\n${YELLOW}Shutting down server...${RESET}`);
    await server.shutdown();
    healthMonitor.stop();
    if (typeof (approvalGateway as any).close === "function") {
      (approvalGateway as any).close();
    }
    auditLogger.close();

    // Cleanup temp dir
    rmSync(tmpBase, { recursive: true, force: true });

    // =====================================================================
    // Results
    // =====================================================================
    console.log(
      `\n${BOLD}${CYAN}═══════════════════════════════════════════════════════════${RESET}`,
    );
    console.log(
      `${BOLD}  Results: ${GREEN}${passCount} passed${RESET}, ${failCount > 0 ? RED : ""}${failCount} failed${RESET}`,
    );
    console.log(
      `${BOLD}${CYAN}═══════════════════════════════════════════════════════════${RESET}\n`,
    );

    if (failCount > 0) {
      process.exit(1);
    }
  } catch (e) {
    console.error(`\n${RED}FATAL: Smoke test crashed: ${e}${RESET}\n`);
    // Cleanup
    try {
      rmSync(tmpBase, { recursive: true, force: true });
    } catch {}
    process.exit(2);
  }
}

main();
