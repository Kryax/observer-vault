// S6: Execution Dispatch — child process spawning and kill chain
// SECURITY INVARIANTS:
// - Shell mode is FORBIDDEN (T5 — non-negotiable)
// - NEVER pass process.env to child processes
// - Always use sanitizedEnv() for child process environment
// - Kill chain: SIGTERM -> 10s grace -> SIGKILL (process group)

import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import type { DispatchResult } from "@observer/shared";
import { sanitizedEnv, validateArgs, sanitizeOutput } from "./sanitize.js";
import type { DispatchConfig, BackendConfig } from "./config.js";
import { resolveTimeout, getBackend, resolveArgs } from "./config.js";
import pino from "pino";

const logger = pino({ name: "dispatch:executor" });

/**
 * Grace period between SIGTERM and SIGKILL in milliseconds.
 */
const KILL_GRACE_MS = 10_000;

/**
 * Options for a single dispatch execution.
 */
export interface ExecuteOptions {
  /** Dispatch ID for correlation */
  dispatchId: string;
  /** Backend name to execute against */
  backendName: string;
  /** The prompt/message to send to the backend */
  prompt: string;
  /** Working directory for the child process */
  workingDirectory: string;
  /** Context files to pass to the backend */
  contextFiles?: string[];
  /** Additional environment variables specific to this backend */
  extraEnv?: Record<string, string>;
  /** Override timeout in seconds (uses config default if not set) */
  timeoutSeconds?: number;
}

/**
 * Result of tracking a running child process, used internally.
 */
interface ProcessHandle {
  child: ChildProcess;
  stdout: string[];
  stderr: string[];
  startTime: number;
  killed: boolean;
  killTimer: ReturnType<typeof setTimeout> | null;
  timeoutTimer: ReturnType<typeof setTimeout> | null;
}

/**
 * Execute a backend command with full sanitization and kill chain management.
 *
 * Flow:
 * 1. Resolve backend config and validate
 * 2. Build sanitized env and validated args
 * 3. Spawn child process (shell mode FORBIDDEN)
 * 4. Capture stdout/stderr with sanitized output
 * 5. Kill chain on timeout: SIGTERM -> 10s -> SIGKILL
 * 6. Return DispatchResult
 *
 * @param config The full dispatch configuration
 * @param options Execution options for this dispatch
 * @returns DispatchResult with sanitized output
 */
export async function execute(
  config: DispatchConfig,
  options: ExecuteOptions,
): Promise<DispatchResult> {
  const {
    dispatchId,
    backendName,
    prompt,
    workingDirectory,
    contextFiles,
    extraEnv,
    timeoutSeconds,
  } = options;

  // 1. Resolve backend
  const backend = getBackend(config, backendName);
  if (!backend) {
    logger.error({ backendName, dispatchId }, "Backend not found or disabled");
    return buildResult(dispatchId, backendName, {
      status: "failed",
      exitCode: -1,
      stdout: "",
      stderr: `Backend "${backendName}" not found or disabled`,
      executionTime: 0,
      truncated: false,
    });
  }

  // 2. Build args from template
  const args = resolveArgs(backend.args_template, {
    prompt,
    working_dir: workingDirectory,
    context_files: contextFiles,
  });

  // 3. Validate args for credential leaks
  try {
    validateArgs(args);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Argument validation failed";
    logger.error({ dispatchId, backendName, error: msg }, "Arg validation failed");
    return buildResult(dispatchId, backendName, {
      status: "failed",
      exitCode: -1,
      stdout: "",
      stderr: msg,
      executionTime: 0,
      truncated: false,
    });
  }

  // 4. Build sanitized environment
  const env = sanitizedEnv(extraEnv);

  // 5. Resolve timeout
  const timeout = (timeoutSeconds ?? resolveTimeout(config, backendName)) * 1000;
  const maxBytes = config.dispatch.output_max_bytes;

  // 6. Spawn and manage the child process
  return spawnAndManage(
    dispatchId,
    backendName,
    backend.command,
    args,
    env,
    workingDirectory,
    timeout,
    maxBytes,
  );
}

/**
 * Spawn a child process with full lifecycle management.
 * Handles stdout/stderr capture, timeout, and kill chain.
 */
async function spawnAndManage(
  dispatchId: string,
  backendName: string,
  command: string,
  args: string[],
  env: Record<string, string>,
  cwd: string,
  timeoutMs: number,
  maxBytes: number,
): Promise<DispatchResult> {
  const startTime = Date.now();

  return new Promise<DispatchResult>((resolve) => {
    let resolved = false;

    const safeResolve = (result: DispatchResult): void => {
      if (resolved) return;
      resolved = true;
      if (handle.timeoutTimer) clearTimeout(handle.timeoutTimer);
      if (handle.killTimer) clearTimeout(handle.killTimer);
      resolve(result);
    };

    // SECURITY: spawn with array args, shell mode FORBIDDEN, NEVER process.env
    const child = spawn(command, args, {
      cwd,
      env, // sanitizedEnv() output — never process.env
      stdio: ["pipe", "pipe", "pipe"],
      detached: true, // Enable process group for clean kill
    });

    const handle: ProcessHandle = {
      child,
      stdout: [],
      stderr: [],
      startTime,
      killed: false,
      killTimer: null,
      timeoutTimer: null,
    };

    // Capture stdout
    child.stdout?.on("data", (chunk: Buffer) => {
      handle.stdout.push(chunk.toString("utf-8"));
    });

    // Capture stderr
    child.stderr?.on("data", (chunk: Buffer) => {
      handle.stderr.push(chunk.toString("utf-8"));
    });

    // Handle process exit
    child.on("close", (code, signal) => {
      const executionTime = (Date.now() - startTime) / 1000;
      const rawStdout = handle.stdout.join("");
      const rawStderr = handle.stderr.join("");

      const sanitizedStdout = sanitizeOutput(rawStdout, maxBytes);
      const sanitizedStderr = sanitizeOutput(rawStderr, maxBytes);

      let status: DispatchResult["status"];
      if (handle.killed) {
        status = "timeout";
      } else if (code === 0) {
        status = "completed";
      } else {
        status = "failed";
      }

      logger.info(
        {
          dispatchId,
          backendName,
          exitCode: code,
          signal,
          executionTime,
          status,
        },
        "Process exited",
      );

      safeResolve(
        buildResult(dispatchId, backendName, {
          status,
          exitCode: code ?? -1,
          stdout: sanitizedStdout.text,
          stderr: sanitizedStderr.text,
          executionTime,
          truncated: sanitizedStdout.truncated || sanitizedStderr.truncated,
        }),
      );
    });

    // Handle spawn errors (command not found, permission denied, etc.)
    child.on("error", (err) => {
      const executionTime = (Date.now() - startTime) / 1000;
      logger.error(
        { dispatchId, backendName, error: err.message },
        "Spawn error",
      );

      safeResolve(
        buildResult(dispatchId, backendName, {
          status: "failed",
          exitCode: -1,
          stdout: "",
          stderr: `Spawn error: ${err.message}`,
          executionTime,
          truncated: false,
        }),
      );
    });

    // Timeout and kill chain
    handle.timeoutTimer = setTimeout(() => {
      if (resolved) return;
      handle.killed = true;
      logger.warn(
        { dispatchId, backendName, timeoutMs },
        "Timeout reached — starting kill chain",
      );
      killChain(handle);
    }, timeoutMs);
  });
}

/**
 * Kill chain: SIGTERM -> 10s grace -> SIGKILL
 * Uses process group kill (-pid) to terminate the entire child tree.
 */
function killChain(handle: ProcessHandle): void {
  const { child } = handle;
  const pid = child.pid;

  if (!pid) {
    logger.warn("No PID available for kill chain");
    return;
  }

  // Phase 1: SIGTERM to process group
  try {
    process.kill(-pid, "SIGTERM");
    logger.info({ pid }, "Sent SIGTERM to process group");
  } catch {
    // Process may have already exited
    logger.debug({ pid }, "SIGTERM failed — process may have exited");
    return;
  }

  // Phase 2: SIGKILL after grace period
  handle.killTimer = setTimeout(() => {
    try {
      process.kill(-pid, "SIGKILL");
      logger.warn({ pid }, "Sent SIGKILL to process group after grace period");
    } catch {
      // Process already exited during grace period — that is fine
      logger.debug({ pid }, "SIGKILL failed — process already exited");
    }
  }, KILL_GRACE_MS);
}

/**
 * Build a DispatchResult from execution data.
 */
function buildResult(
  dispatchId: string,
  backendUsed: string,
  data: {
    status: DispatchResult["status"];
    exitCode: number;
    stdout: string;
    stderr: string;
    executionTime: number;
    truncated: boolean;
  },
): DispatchResult {
  return {
    dispatch_id: dispatchId,
    backend_used: backendUsed,
    backend_version: null,
    model_used: null,
    execution_time_seconds: data.executionTime,
    tokens_used: null,
    cost_estimate: "subscription",
    status: data.status,
    exit_code: data.exitCode,
    artifacts: [],
    stdout_log: data.stdout,
    stderr_log: data.stderr,
    truncated: data.truncated,
    validation_pending: true,
  };
}

// Export for testing
export const _testing = {
  KILL_GRACE_MS,
  killChain,
  spawnAndManage,
  buildResult,
} as const;
