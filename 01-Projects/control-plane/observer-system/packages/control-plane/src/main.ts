// main.ts — Production bootstrap entry point for the Observer Control Plane
// Reads config from environment, creates all subsystem instances, starts the server.
// This is the process entry point invoked by systemd.

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse } from "yaml";
import { spawn } from "node:child_process";
import pino from "pino";

import { createServer, type ServerConfig, type ServerDependencies } from "./server/server.js";
import { type TokenEntry } from "./server/auth.js";
import { SessionManagerImpl } from "./session/session-manager.js";
import { PolicyEnforcerImpl } from "./policy/policy-enforcer.js";
import { AuditLoggerImpl } from "./audit/audit-logger.js";
import { ApprovalGatewayImpl } from "./approval/approval-gateway.js";
import { createHealthMonitor, type BackendConfig, type HealthConfig } from "./health/health-monitor.js";
import { VaultConnectorImpl } from "./vault/vault-connector.js";

// ---------------------------------------------------------------------------
// Logger (early, for startup diagnostics)
// ---------------------------------------------------------------------------

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

// ---------------------------------------------------------------------------
// Config loading
// ---------------------------------------------------------------------------

function loadYamlFile(path: string): unknown {
  const content = readFileSync(path, "utf-8");
  return parse(content);
}

interface RawConfig {
  server: {
    host: string;
    http_port: number;
    log_level: string;
  };
  sessions: {
    idle_timeout_hours: number;
  };
  audit: {
    jsonl_dir: string;
    jsonl_max_size_mb: number;
    index_database_path: string;
  };
  health: {
    backend_check_interval_seconds: number;
    audit_check_interval_seconds: number;
  };
  vault?: {
    path: string;
  };
}

interface RawBackendsConfig {
  backends: Record<string, {
    command: string;
    args_template: string[];
    enabled: boolean;
    health_check?: {
      command: string;
      args: string[];
    };
    pinned_version?: string;
  }>;
}

interface RawTokenFile {
  tokens: Array<{
    token: string;
    client_id: string;
    scope?: string;
  }>;
}

// ---------------------------------------------------------------------------
// Main bootstrap
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  logger.info("Observer Control Plane starting...");

  // --- Read environment variables ---
  const configPath = process.env.OBSERVER_CONFIG;
  if (!configPath) {
    throw new Error("OBSERVER_CONFIG environment variable is required");
  }

  const backendsPath = process.env.OBSERVER_BACKENDS;
  if (!backendsPath) {
    throw new Error("OBSERVER_BACKENDS environment variable is required");
  }

  const secretsDir = process.env.OBSERVER_SECRETS_DIR;
  if (!secretsDir) {
    throw new Error("OBSERVER_SECRETS_DIR environment variable is required");
  }

  // --- Load config files ---
  logger.info({ configPath, backendsPath }, "Loading configuration files");

  const rawConfig = loadYamlFile(configPath) as RawConfig;
  const rawBackends = loadYamlFile(backendsPath) as RawBackendsConfig;

  // --- Load bearer tokens from secrets directory ---
  const tokensPath = join(secretsDir, "bearer-tokens.json");
  const rawTokens = JSON.parse(readFileSync(tokensPath, "utf-8")) as RawTokenFile;

  const tokens: TokenEntry[] = rawTokens.tokens.map((t) => ({
    token: t.token,
    label: t.client_id,
    scopes: t.scope ? [t.scope] : undefined,
  }));

  logger.info({ tokenCount: tokens.length }, "Loaded bearer tokens");

  // --- Resolve paths relative to working directory ---
  const workDir = process.cwd();
  const resolveRelative = (p: string): string =>
    p.startsWith("/") ? p : resolve(workDir, p);

  // --- Create subsystem instances ---

  // 1. Session Manager
  const sessionDbPath = resolveRelative("./data/sessions.db");
  const sessionManager = new SessionManagerImpl({
    dbPath: sessionDbPath,
    idleTimeoutMs: rawConfig.sessions.idle_timeout_hours * 60 * 60 * 1000,
  });
  logger.info({ dbPath: sessionDbPath }, "Session manager created");

  // 2. Policy Enforcer
  const policyEnforcer = new PolicyEnforcerImpl();
  policyEnforcer.loadRules(configPath);
  logger.info("Policy enforcer loaded rules from config");

  // 3. Audit Logger (implements both AuditLogger and AuditStore)
  const auditDataDir = resolveRelative(rawConfig.audit.jsonl_dir);
  const auditLogger = new AuditLoggerImpl({
    dataDir: auditDataDir,
    maxFileSizeBytes: rawConfig.audit.jsonl_max_size_mb * 1024 * 1024,
  });
  logger.info({ dataDir: auditDataDir }, "Audit logger created");

  // 4. Approval Gateway
  const approvalDbPath = resolveRelative("./data/approvals.db");
  const approvalGateway = new ApprovalGatewayImpl({
    dbPath: approvalDbPath,
    resolveSessionId: async (threadId: string): Promise<string> => {
      const thread = await sessionManager.getThread(threadId);
      if (!thread) {
        throw new Error(`Thread not found for approval resolution: ${threadId}`);
      }
      return thread.session_id;
    },
    auditLogger,
  });
  logger.info({ dbPath: approvalDbPath }, "Approval gateway created");

  // 5. Health Monitor
  const backendConfigs: BackendConfig[] = Object.entries(
    rawBackends.backends ?? {},
  ).map(([name, cfg]) => ({
    name,
    command: cfg.health_check?.command ?? cfg.command,
    args: cfg.health_check?.args ?? ["--version"],
    enabled: cfg.enabled,
    pinned_version: cfg.pinned_version,
  }));

  const healthConfig: HealthConfig = {
    backend_check_interval_seconds: rawConfig.health.backend_check_interval_seconds,
    audit_check_interval_seconds: rawConfig.health.audit_check_interval_seconds,
  };

  const healthMonitor = createHealthMonitor({
    backends: backendConfigs,
    config: healthConfig,
    spawnFn: (command, args, options) => spawn(command, args, options) as ReturnType<typeof spawn> & {
      stdout: { on(event: string, cb: (data: Buffer) => void): void };
      stderr: { on(event: string, cb: (data: Buffer) => void): void };
      on(event: string, cb: (arg: unknown) => void): void;
      kill(): void;
    },
  });
  healthMonitor.start();
  logger.info({ backends: backendConfigs.map((b) => b.name) }, "Health monitor started");

  // 6. Vault Connector (optional)
  const vaultPath = rawConfig.vault?.path ?? process.env.OBSERVER_VAULT_PATH;
  let vaultConnector: import("./vault/vault-connector.js").VaultConnectorImpl | undefined;
  if (vaultPath) {
    vaultConnector = new VaultConnectorImpl({
      vaultPath,
      logger,
    });
    logger.info({ vaultPath }, "Vault connector created");
  } else {
    logger.info("Vault connector not configured (vault.path not set) — vault methods disabled");
  }

  // --- Assemble dependencies and server config ---
  const deps: ServerDependencies = {
    sessionManager,
    policyEnforcer,
    auditLogger,
    approvalGateway,
    healthMonitor,
    vaultConnector,
  };

  const serverConfig: ServerConfig = {
    port: rawConfig.server.http_port,
    tokens,
    logLevel: rawConfig.server.log_level,
  };

  // --- Create and start the server ---
  const server = createServer(deps, serverConfig);

  await server.start();
  logger.info(
    { port: server.port, pid: process.pid },
    "Observer Control Plane is ready",
  );

  // --- Graceful shutdown handlers ---
  let shutdownInProgress = false;

  const gracefulShutdown = async (signal: string): Promise<void> => {
    if (shutdownInProgress) return;
    shutdownInProgress = true;

    logger.info({ signal }, "Received shutdown signal, shutting down gracefully...");

    try {
      await server.shutdown();
      logger.info("Shutdown complete");
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "Error during shutdown");
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => void gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => void gracefulShutdown("SIGINT"));

  // Catch uncaught errors to ensure clean shutdown
  process.on("uncaughtException", (err) => {
    logger.fatal({ err }, "Uncaught exception — shutting down");
    void gracefulShutdown("uncaughtException");
  });

  process.on("unhandledRejection", (reason) => {
    logger.fatal({ reason }, "Unhandled rejection — shutting down");
    void gracefulShutdown("unhandledRejection");
  });
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

main().catch((err) => {
  logger.fatal({ err }, "Fatal error during startup");
  process.exit(1);
});
