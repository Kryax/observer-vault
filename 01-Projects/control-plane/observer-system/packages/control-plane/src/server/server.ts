// S5: Main JSON-RPC HTTP Server
// Creates the HTTP server, wires jayson, handles auth header extraction,
// binds to 127.0.0.1 ONLY, and provides graceful shutdown.
//
// SECURITY NON-NEGOTIABLES:
// - 127.0.0.1 binding asserted at startup (never 0.0.0.0)
// - Bearer token auth on every request (except health.status)
// - Audit writes block requests
// - Default deny for unknown methods
//
// Architecture: We use a custom Node.js HTTP handler that:
// 1. Extracts the Authorization header from the incoming request
// 2. Determines the JSON-RPC method from the parsed body
// 3. Checks auth requirements (public vs authenticated methods)
// 4. If auth is needed and fails, returns a JSON-RPC error without calling jayson
// 5. Otherwise, delegates to jayson for method dispatch

import http from "node:http";
import jayson from "jayson";
import pino from "pino";

import type {
  SessionManager,
  PolicyEnforcer,
  ApprovalGateway,
  AuditLogger,
  AuditStore,
  HealthStatus,
} from "@observer/shared";
import { ObserverErrorCode } from "@observer/shared";

import { TokenAuthenticator, type TokenEntry } from "./auth.js";
import { createMethodHandlers, type MethodMap } from "./method-handlers.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ServerDependencies {
  sessionManager: SessionManager;
  policyEnforcer: PolicyEnforcer;
  auditLogger: AuditLogger & AuditStore;
  approvalGateway: ApprovalGateway;
  healthMonitor: {
    getStatus(): HealthStatus;
    getLivenessStatus(): { status: string; uptime_seconds: number };
  };
}

export interface ServerConfig {
  /** Port to bind to (default: 9000) */
  port?: number;
  /** Bearer tokens for authentication */
  tokens: TokenEntry[];
  /** Log level (default: "info") */
  logLevel?: string;
}

export interface ObserverServer {
  /** Start the server and begin accepting connections */
  start(): Promise<void>;
  /** Graceful shutdown -- close all subsystems */
  shutdown(): Promise<void>;
  /** The underlying http.Server (for testing) */
  httpServer: http.Server;
  /** Port the server is listening on */
  port: number;
}

// ---------------------------------------------------------------------------
// JSON-RPC error response helper
// ---------------------------------------------------------------------------

function jsonRpcErrorResponse(
  id: string | number | null,
  code: number,
  message: string,
): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    error: { code, message },
    id,
  });
}

// ---------------------------------------------------------------------------
// Body parser (simple, no streaming -- control plane requests are small)
// ---------------------------------------------------------------------------

function parseBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const MAX_BODY = 1024 * 1024; // 1MB limit

    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        req.destroy();
        reject(new Error("Request body too large"));
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf-8"));
    });

    req.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// Extract method name from JSON-RPC body
// Handles both single requests and batch requests (returns first method)
// ---------------------------------------------------------------------------

function extractMethodName(body: unknown): string | null {
  if (Array.isArray(body)) {
    // Batch request -- extract first method for auth check
    // (In practice, all methods in a batch should share the same auth requirement)
    if (body.length > 0 && typeof body[0] === "object" && body[0] !== null) {
      return (body[0] as Record<string, unknown>).method as string ?? null;
    }
    return null;
  }
  if (typeof body === "object" && body !== null) {
    return (body as Record<string, unknown>).method as string ?? null;
  }
  return null;
}

function extractRequestId(body: unknown): string | number | null {
  if (typeof body === "object" && body !== null && "id" in body) {
    const id = (body as Record<string, unknown>).id;
    if (typeof id === "string" || typeof id === "number") return id;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create and configure the Observer JSON-RPC server.
 *
 * @param deps - Subsystem implementations (session, policy, audit, approval, health)
 * @param config - Server configuration (port, tokens, log level)
 * @returns ObserverServer with start() and shutdown() methods
 */
export function createServer(
  deps: ServerDependencies,
  config: ServerConfig,
): ObserverServer {
  const port = config.port ?? 9000;
  const logger = pino({ level: config.logLevel ?? "info" });

  // Create token authenticator
  const tokenAuth = new TokenAuthenticator(config.tokens);

  // Create method handlers
  const methods: MethodMap = createMethodHandlers({
    ...deps,
    tokenAuth,
    logger,
  });

  // Create jayson server with the method handlers
  const jaysonServer = new jayson.Server(
    methods as Record<string, jayson.MethodLike>,
    { version: 2 },
  );

  // -----------------------------------------------------------------------
  // Custom HTTP handler with auth header extraction
  // -----------------------------------------------------------------------

  const httpServer = http.createServer(async (req, res) => {
    // Only accept POST
    if (req.method !== "POST") {
      res.writeHead(405, { Allow: "POST", "Content-Type": "application/json" });
      res.end(
        jsonRpcErrorResponse(
          null,
          ObserverErrorCode.InvalidRequest,
          "Method Not Allowed",
        ),
      );
      return;
    }

    // Content-Type check
    const contentType = req.headers["content-type"] ?? "";
    if (!contentType.includes("application/json")) {
      res.writeHead(415, { "Content-Type": "application/json" });
      res.end(
        jsonRpcErrorResponse(
          null,
          ObserverErrorCode.InvalidRequest,
          "Unsupported Media Type (expected application/json)",
        ),
      );
      return;
    }

    // Parse body
    let rawBody: string;
    try {
      rawBody = await parseBody(req);
    } catch {
      res.writeHead(413, { "Content-Type": "application/json" });
      res.end(
        jsonRpcErrorResponse(
          null,
          ObserverErrorCode.ParseError,
          "Request body too large",
        ),
      );
      return;
    }

    // Parse JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(
        jsonRpcErrorResponse(null, ObserverErrorCode.ParseError, "Parse error"),
      );
      return;
    }

    // Extract method for auth check
    const method = extractMethodName(parsed);
    const requestId = extractRequestId(parsed);

    // Auth check (before jayson sees it)
    if (method && tokenAuth.requiresAuth(method)) {
      const authHeader = req.headers["authorization"];
      const authResult = tokenAuth.authenticate(authHeader);

      if (!authResult.authenticated) {
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
        });
        res.end(
          jsonRpcErrorResponse(
            requestId,
            authResult.error.code,
            authResult.error.message,
          ),
        );
        return;
      }

      logger.debug(
        { method, token_label: authResult.token_label },
        "Authenticated request",
      );
    }

    // Delegate to jayson
    // Cast is safe: jayson internally handles malformed requests and returns Parse Error
    jaysonServer.call(
      parsed as Parameters<typeof jaysonServer.call>[0],
      (error: unknown, success: unknown) => {
      const response = error || success;

      if (!response) {
        // Notification -- no response needed
        res.writeHead(204);
        res.end();
        return;
      }

      let body: string;
      try {
        body = JSON.stringify(response);
      } catch {
        res.writeHead(500, {
          "Content-Type": "application/json; charset=utf-8",
        });
        res.end(
          jsonRpcErrorResponse(
            requestId,
            ObserverErrorCode.InternalError,
            "Failed to serialize response",
          ),
        );
        return;
      }

      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(body, "utf-8"),
      });
      res.end(body);
    });
  });

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  async function start(): Promise<void> {
    return new Promise((resolve, reject) => {
      // SECURITY: Bind to 127.0.0.1 ONLY -- never 0.0.0.0
      httpServer.listen(port, "127.0.0.1", () => {
        const addr = httpServer.address();

        // Assert binding correctness at startup
        if (
          addr === null ||
          typeof addr === "string" ||
          addr.address !== "127.0.0.1"
        ) {
          httpServer.close();
          reject(
            new Error(
              `SECURITY VIOLATION: Server bound to ${JSON.stringify(addr)} instead of 127.0.0.1. Aborting.`,
            ),
          );
          return;
        }

        logger.info(
          { port, address: addr.address },
          "Observer control plane server started",
        );
        resolve();
      });

      httpServer.on("error", reject);
    });
  }

  async function shutdown(): Promise<void> {
    logger.info("Shutting down server...");

    return new Promise<void>((resolve, reject) => {
      httpServer.close((err) => {
        if (err) {
          logger.error({ err }, "Error closing HTTP server");
        }

        // Close all subsystems
        try {
          if ("close" in deps.sessionManager) {
            (deps.sessionManager as { close(): void }).close();
          }
          if ("close" in deps.auditLogger) {
            (deps.auditLogger as { close(): void }).close();
          }
          if ("close" in deps.approvalGateway) {
            (deps.approvalGateway as { close(): void }).close();
          }
          if ("stop" in deps.healthMonitor) {
            (deps.healthMonitor as { stop(): void }).stop();
          }
        } catch (closeErr) {
          logger.error({ err: closeErr }, "Error closing subsystems");
        }

        logger.info("Server shutdown complete");

        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  return {
    start,
    shutdown,
    httpServer,
    port,
  };
}
