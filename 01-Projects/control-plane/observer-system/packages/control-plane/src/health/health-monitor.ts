// S7: Health Monitor — periodic health checks, status tracking, transition detection
//
// Implements the HealthMonitor interface from @observer/shared with extensions:
//   - getStatus()        -> full HealthStatus (authenticated callers)
//   - getLivenessStatus() -> { status, uptime_seconds } (unauthenticated)
//   - checkBackend(name)  -> BackendHealthState (on-demand single check)
//   - onStatusChange(cb)  -> register transition callback
//   - start() / stop()    -> periodic check lifecycle
//
// Security: All backend checks use spawn with array args and shell: false.
// No shell: true -- ever. (Project Rule #4)
// The spawnFn is dependency-injected to enable testing without real processes.

import type {
  HealthStatus,
  HealthChange,
  BackendHealthState,
} from "@observer/shared";
import { aggregateServerStatus, detectTransition } from "./status-aggregator.js";

// ---------------------------------------------------------------------------
// Configuration types (accepted as parsed objects -- no file I/O here)
// ---------------------------------------------------------------------------

export interface BackendConfig {
  name: string;
  command: string;
  args: string[];
  enabled: boolean;
  pinned_version?: string;
}

export interface HealthConfig {
  backend_check_interval_seconds: number;
  audit_check_interval_seconds: number;
}

// ---------------------------------------------------------------------------
// Internal state per backend
// ---------------------------------------------------------------------------

interface BackendState {
  config: BackendConfig;
  status: BackendHealthState;
  last_check: string;
  response_time_ms: number | null;
  version: string | null;
  uptime_checks: number;
  healthy_checks: number;
}

// ---------------------------------------------------------------------------
// SpawnFn type -- injectable for testing (mirrors child_process.spawn shape)
// ---------------------------------------------------------------------------

interface ChildProcessLike {
  stdout: { on(event: string, cb: (data: Buffer) => void): void };
  stderr: { on(event: string, cb: (data: Buffer) => void): void };
  on(event: string, cb: (arg: unknown) => void): void;
  kill(): void;
}

type SpawnFn = (
  command: string,
  args: string[],
  options: { shell: boolean; env: Record<string, string> },
) => ChildProcessLike;

// ---------------------------------------------------------------------------
// Factory options
// ---------------------------------------------------------------------------

export interface HealthMonitorOptions {
  backends: BackendConfig[];
  config: HealthConfig;
  spawnFn?: SpawnFn;
}

// ---------------------------------------------------------------------------
// Public interface returned by createHealthMonitor
// ---------------------------------------------------------------------------

export interface HealthMonitorInstance {
  getStatus(): HealthStatus;
  getLivenessStatus(): { status: string; uptime_seconds: number };
  checkBackend(name: string): Promise<BackendHealthState>;
  onStatusChange(cb: (change: HealthChange) => void): void;
  start(): void;
  stop(): void;
}

// ---------------------------------------------------------------------------
// Version parsing and comparison
// ---------------------------------------------------------------------------

const VERSION_REGEX = /(\d+\.\d+\.\d+)/;

/**
 * Extract a semver version string from command output.
 * Scans all lines for a pattern like "1.2.3".
 */
function parseVersion(output: string): string | null {
  const match = VERSION_REGEX.exec(output);
  return match ? match[1] : null;
}

/**
 * Simple major.x matching: "1.x" means major version must be 1.
 * Returns true if version matches the pinned range, false otherwise.
 */
function versionMatchesPinned(
  version: string,
  pinnedVersion: string,
): boolean {
  const majorMatch = /^(\d+)\.x$/i.exec(pinnedVersion);
  if (!majorMatch) return true; // unknown pin format -- pass through
  const pinnedMajor = parseInt(majorMatch[1], 10);
  const versionMajor = parseInt(version.split(".")[0], 10);
  return versionMajor === pinnedMajor;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createHealthMonitor(
  options: HealthMonitorOptions,
): HealthMonitorInstance {
  const { backends: backendConfigs, config } = options;
  const spawnFn = options.spawnFn as SpawnFn | undefined;

  const startTime = Date.now();
  const callbacks: Array<(change: HealthChange) => void> = [];

  // Initialize per-backend state
  const backendStates = new Map<string, BackendState>();
  for (const bc of backendConfigs) {
    backendStates.set(bc.name, {
      config: bc,
      status: bc.enabled ? "unavailable" : "disabled",
      last_check: new Date().toISOString(),
      response_time_ms: null,
      version: null,
      uptime_checks: 0,
      healthy_checks: 0,
    });
  }

  // Audit subsystem status -- defaults to healthy; wired externally in S5
  const auditStatus: "healthy" | "error" = "healthy";

  // Track overall server status for transition detection
  let currentServerStatus: "healthy" | "degraded" | "unhealthy" =
    computeServerStatus();

  // Periodic timer handle
  let intervalHandle: ReturnType<typeof setInterval> | null = null;

  // --- Internal helpers ---

  function computeServerStatus(): "healthy" | "degraded" | "unhealthy" {
    const backendsForAgg: Record<string, { status: BackendHealthState }> = {};
    for (const [name, state] of backendStates) {
      backendsForAgg[name] = { status: state.status };
    }
    return aggregateServerStatus(backendsForAgg, auditStatus);
  }

  function emitChange(change: HealthChange): void {
    for (const cb of callbacks) {
      try {
        cb(change);
      } catch {
        // ISC-5: callback errors must never crash the monitor
      }
    }
  }

  function emitIfTransitioned(
    component: string,
    oldStatus: string,
    newStatus: string,
    details: string,
  ): void {
    if (detectTransition(oldStatus, newStatus)) {
      emitChange({
        component,
        old_status: oldStatus,
        new_status: newStatus,
        timestamp: new Date().toISOString(),
        details,
      });
    }
  }

  function checkServerTransition(): void {
    const newServerStatus = computeServerStatus();
    emitIfTransitioned(
      "server",
      currentServerStatus,
      newServerStatus,
      `Server status changed from ${currentServerStatus} to ${newServerStatus}`,
    );
    currentServerStatus = newServerStatus;
  }

  /**
   * Run the health check command for a single backend.
   * Returns a promise that resolves to the new BackendHealthState.
   *
   * Security: uses array args, shell: false, sanitized empty env.
   * No shell: true -- ever. (Project Rule #4)
   */
  async function runCheck(state: BackendState): Promise<BackendHealthState> {
    if (!spawnFn) {
      // No spawn function provided -- cannot check
      return state.status;
    }

    const checkStart = Date.now();

    return new Promise<BackendHealthState>((resolve) => {
      let stdout = "";
      let resolved = false;

      const safeResolve = (result: BackendHealthState) => {
        if (resolved) return;
        resolved = true;

        const elapsed = Date.now() - checkStart;
        state.response_time_ms = elapsed;
        state.last_check = new Date().toISOString();
        state.uptime_checks++;

        const oldStatus = state.status;

        if (result === "healthy") {
          state.healthy_checks++;
        }

        state.status = result;

        emitIfTransitioned(
          `backend:${state.config.name}`,
          oldStatus,
          result,
          `Backend ${state.config.name} check: ${oldStatus} -> ${result}`,
        );

        checkServerTransition();

        resolve(result);
      };

      try {
        // Security: empty env, array args, no shell
        const child = spawnFn(
          state.config.command,
          state.config.args,
          { shell: false, env: {} },
        );

        child.stdout.on("data", (data: Buffer) => {
          stdout += data.toString();
        });

        child.stderr.on("data", () => {
          // Collect but don't use -- stderr is diagnostic, not version data
        });

        child.on("error", () => {
          safeResolve("unavailable");
        });

        child.on("close", (code: unknown) => {
          if (typeof code === "number" && code !== 0) {
            safeResolve("unavailable");
            return;
          }

          // Parse version from stdout
          const version = parseVersion(stdout);
          state.version = version;

          // Version comparison
          if (
            version &&
            state.config.pinned_version &&
            !versionMatchesPinned(version, state.config.pinned_version)
          ) {
            // ISC-3: version mismatch = degraded, NOT unhealthy
            safeResolve("degraded");
            return;
          }

          safeResolve("healthy");
        });
      } catch {
        safeResolve("unavailable");
      }
    });
  }

  async function checkAllBackends(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const state of backendStates.values()) {
      if (state.config.enabled) {
        promises.push(
          runCheck(state).then(() => {
            // result is already applied inside runCheck
          }),
        );
      }
    }
    await Promise.allSettled(promises);
  }

  // --- Public API ---

  function getStatus(): HealthStatus {
    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
    const memUsage = process.memoryUsage();

    const backends: HealthStatus["backends"] = {};
    for (const [name, state] of backendStates) {
      backends[name] = {
        status: state.status,
        last_check: state.last_check,
        response_time_ms: state.response_time_ms,
        uptime_ratio:
          state.uptime_checks > 0
            ? state.healthy_checks / state.uptime_checks
            : 0,
        version: state.version,
      };
    }

    return {
      server: {
        status: currentServerStatus,
        uptime_seconds: uptimeSeconds,
        memory_usage_mb: Math.round(memUsage.rss / 1024 / 1024),
        active_sessions: 0, // wired in S5
        active_threads: 0, // wired in S5
        pending_approvals: 0, // wired in S5
      },
      backends,
      audit: {
        status: auditStatus,
        jsonl_size_mb: 0, // wired in S5
        sqlite_size_mb: 0, // wired in S5
        event_count: 0, // wired in S5
      },
    };
  }

  function getLivenessStatus(): { status: string; uptime_seconds: number } {
    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
    return {
      status: currentServerStatus,
      uptime_seconds: uptimeSeconds,
    };
  }

  async function checkBackend(name: string): Promise<BackendHealthState> {
    const state = backendStates.get(name);
    if (!state) {
      return "unavailable";
    }
    if (!state.config.enabled) {
      return "disabled";
    }
    return runCheck(state);
  }

  function onStatusChange(cb: (change: HealthChange) => void): void {
    callbacks.push(cb);
  }

  function start(): void {
    if (intervalHandle !== null) {
      return; // idempotent
    }
    intervalHandle = setInterval(() => {
      void checkAllBackends();
    }, config.backend_check_interval_seconds * 1000);
  }

  function stop(): void {
    if (intervalHandle !== null) {
      clearInterval(intervalHandle);
      intervalHandle = null;
    }
  }

  return {
    getStatus,
    getLivenessStatus,
    checkBackend,
    onStatusChange,
    start,
    stop,
  };
}
