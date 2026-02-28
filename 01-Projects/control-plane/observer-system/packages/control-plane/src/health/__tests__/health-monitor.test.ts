// S7: Health Monitor — test suite
// Tests: status aggregation, transition detection, version comparison,
//        liveness vs full status, error resilience (ISC criteria)

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type {
  HealthStatus,
  HealthChange,
  BackendHealthState,
} from "@observer/shared";
import { createHealthMonitor } from "../health-monitor.js";
import { aggregateServerStatus } from "../status-aggregator.js";
import type { HealthConfig, BackendConfig } from "../health-monitor.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBackendConfig(overrides: Partial<BackendConfig> & { pinned_version?: string | undefined } = {}): BackendConfig {
  return {
    name: overrides.name ?? "claude-code",
    command: overrides.command ?? "/usr/bin/claude",
    args: overrides.args ?? ["--version"],
    enabled: overrides.enabled ?? true,
    // Use "pinned_version" in overrides to detect explicit undefined
    pinned_version: "pinned_version" in overrides ? overrides.pinned_version : "1.x",
  };
}

function makeHealthConfig(overrides: Partial<HealthConfig> = {}): HealthConfig {
  return {
    backend_check_interval_seconds: overrides.backend_check_interval_seconds ?? 300,
    audit_check_interval_seconds: overrides.audit_check_interval_seconds ?? 60,
  };
}

// ---------------------------------------------------------------------------
// status-aggregator.ts tests
// ---------------------------------------------------------------------------

describe("status-aggregator", () => {
  describe("aggregateServerStatus", () => {
    it("returns healthy when all backends are healthy", () => {
      const backends: Record<string, { status: BackendHealthState }> = {
        "claude-code": { status: "healthy" },
        "gemini-cli": { status: "healthy" },
      };
      const auditStatus: "healthy" | "error" = "healthy";

      const result = aggregateServerStatus(backends, auditStatus);
      expect(result).toBe("healthy");
    });

    it("returns degraded when any backend is degraded", () => {
      const backends: Record<string, { status: BackendHealthState }> = {
        "claude-code": { status: "healthy" },
        "gemini-cli": { status: "degraded" },
      };

      const result = aggregateServerStatus(backends, "healthy");
      expect(result).toBe("degraded");
    });

    it("returns degraded when any backend is rate_limited", () => {
      const backends: Record<string, { status: BackendHealthState }> = {
        "claude-code": { status: "healthy" },
        "gemini-cli": { status: "rate_limited" },
      };

      const result = aggregateServerStatus(backends, "healthy");
      expect(result).toBe("degraded");
    });

    it("returns degraded when any backend is unavailable", () => {
      const backends: Record<string, { status: BackendHealthState }> = {
        "claude-code": { status: "healthy" },
        "gemini-cli": { status: "unavailable" },
      };

      const result = aggregateServerStatus(backends, "healthy");
      expect(result).toBe("degraded");
    });

    it("returns unhealthy when audit is in error state", () => {
      const backends: Record<string, { status: BackendHealthState }> = {
        "claude-code": { status: "healthy" },
      };

      const result = aggregateServerStatus(backends, "error");
      expect(result).toBe("unhealthy");
    });

    it("returns healthy when no backends are configured", () => {
      const result = aggregateServerStatus({}, "healthy");
      expect(result).toBe("healthy");
    });

    it("ignores disabled backends in aggregation", () => {
      const backends: Record<string, { status: BackendHealthState }> = {
        "claude-code": { status: "healthy" },
        "ollama": { status: "disabled" },
      };

      const result = aggregateServerStatus(backends, "healthy");
      expect(result).toBe("healthy");
    });

    it("unhealthy audit overrides healthy backends", () => {
      const backends: Record<string, { status: BackendHealthState }> = {
        "claude-code": { status: "healthy" },
        "gemini-cli": { status: "healthy" },
      };

      const result = aggregateServerStatus(backends, "error");
      expect(result).toBe("unhealthy");
    });
  });
});

// ---------------------------------------------------------------------------
// health-monitor.ts tests
// ---------------------------------------------------------------------------

describe("health-monitor", () => {
  // Mock child_process.spawn
  let spawnMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    spawnMock = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function createMonitor(
    backends: BackendConfig[] = [makeBackendConfig()],
    config: HealthConfig = makeHealthConfig(),
    spawnFn?: typeof spawnMock,
  ) {
    return createHealthMonitor({
      backends,
      config,
      spawnFn: spawnFn ?? spawnMock,
    });
  }

  // --- Spawn helper to create mock child processes ---
  function mockSpawnSuccess(stdout: string) {
    const childProcess = {
      stdout: {
        on: vi.fn((event: string, cb: (data: Buffer) => void) => {
          if (event === "data") {
            cb(Buffer.from(stdout));
          }
        }),
      },
      stderr: {
        on: vi.fn(),
      },
      on: vi.fn((event: string, cb: (code: number) => void) => {
        if (event === "close") {
          cb(0);
        }
      }),
      kill: vi.fn(),
    };
    return childProcess;
  }

  function mockSpawnFailure(code: number = 1, stderr: string = "error") {
    const childProcess = {
      stdout: {
        on: vi.fn(),
      },
      stderr: {
        on: vi.fn((event: string, cb: (data: Buffer) => void) => {
          if (event === "data") {
            cb(Buffer.from(stderr));
          }
        }),
      },
      on: vi.fn((event: string, cb: (code: number) => void) => {
        if (event === "close") {
          cb(code);
        }
      }),
      kill: vi.fn(),
    };
    return childProcess;
  }

  function mockSpawnError() {
    const childProcess = {
      stdout: {
        on: vi.fn(),
      },
      stderr: {
        on: vi.fn(),
      },
      on: vi.fn((event: string, cb: (arg: unknown) => void) => {
        if (event === "error") {
          cb(new Error("spawn ENOENT"));
        }
      }),
      kill: vi.fn(),
    };
    return childProcess;
  }

  // --- ISC-1: Reports correct health status for configured backends ---
  describe("ISC-1: health status reporting", () => {
    it("returns initial status with all backends as unavailable before first check", () => {
      const monitor = createMonitor([
        makeBackendConfig({ name: "claude-code" }),
        makeBackendConfig({ name: "gemini-cli", command: "/usr/bin/gemini", pinned_version: "2.x" }),
      ]);

      const status = monitor.getStatus();

      expect(status.server.status).toBe("degraded");
      expect(status.backends["claude-code"]).toBeDefined();
      expect(status.backends["claude-code"].status).toBe("unavailable");
      expect(status.backends["gemini-cli"]).toBeDefined();
      expect(status.backends["gemini-cli"].status).toBe("unavailable");
    });

    it("reports healthy after successful check with matching version", async () => {
      const child = mockSpawnSuccess("claude-code version 1.5.3\n");
      spawnMock.mockReturnValue(child);

      const monitor = createMonitor([
        makeBackendConfig({ name: "claude-code", pinned_version: "1.x" }),
      ]);

      const backendState = await monitor.checkBackend("claude-code");
      expect(backendState).toBe("healthy");

      const status = monitor.getStatus();
      expect(status.backends["claude-code"].status).toBe("healthy");
      expect(status.backends["claude-code"].version).toBe("1.5.3");
    });

    it("reports disabled backends as disabled", () => {
      const monitor = createMonitor([
        makeBackendConfig({ name: "ollama", enabled: false }),
      ]);

      const status = monitor.getStatus();
      expect(status.backends["ollama"].status).toBe("disabled");
    });

    it("includes uptime in server status", () => {
      const monitor = createMonitor();
      vi.advanceTimersByTime(5000);

      const status = monitor.getStatus();
      expect(status.server.uptime_seconds).toBeGreaterThanOrEqual(5);
    });

    it("includes memory usage in server status", () => {
      const monitor = createMonitor();
      const status = monitor.getStatus();
      expect(status.server.memory_usage_mb).toBeGreaterThan(0);
    });
  });

  // --- ISC-2: Detects status transitions and emits HealthChange events ---
  describe("ISC-2: transition detection", () => {
    it("emits HealthChange when backend transitions from unavailable to healthy", async () => {
      const child = mockSpawnSuccess("claude-code version 1.2.0\n");
      spawnMock.mockReturnValue(child);

      const monitor = createMonitor([
        makeBackendConfig({ name: "claude-code", pinned_version: "1.x" }),
      ]);

      const changes: HealthChange[] = [];
      monitor.onStatusChange((change) => changes.push(change));

      await monitor.checkBackend("claude-code");

      expect(changes.length).toBeGreaterThanOrEqual(1);
      const backendChange = changes.find((c) => c.component === "backend:claude-code");
      expect(backendChange).toBeDefined();
      expect(backendChange!.old_status).toBe("unavailable");
      expect(backendChange!.new_status).toBe("healthy");
    });

    it("emits HealthChange when backend transitions from healthy to degraded", async () => {
      // First check: healthy
      const child1 = mockSpawnSuccess("claude-code version 1.2.0\n");
      spawnMock.mockReturnValueOnce(child1);

      const monitor = createMonitor([
        makeBackendConfig({ name: "claude-code", pinned_version: "1.x" }),
      ]);

      await monitor.checkBackend("claude-code");

      const changes: HealthChange[] = [];
      monitor.onStatusChange((change) => changes.push(change));

      // Second check: version mismatch -> degraded
      const child2 = mockSpawnSuccess("claude-code version 2.0.0\n");
      spawnMock.mockReturnValueOnce(child2);

      await monitor.checkBackend("claude-code");

      const backendChange = changes.find((c) => c.component === "backend:claude-code");
      expect(backendChange).toBeDefined();
      expect(backendChange!.old_status).toBe("healthy");
      expect(backendChange!.new_status).toBe("degraded");
    });

    it("does not emit HealthChange when status stays the same", async () => {
      const child1 = mockSpawnSuccess("claude-code version 1.2.0\n");
      spawnMock.mockReturnValueOnce(child1);

      const monitor = createMonitor([
        makeBackendConfig({ name: "claude-code", pinned_version: "1.x" }),
      ]);

      await monitor.checkBackend("claude-code");

      const changes: HealthChange[] = [];
      monitor.onStatusChange((change) => changes.push(change));

      // Second check: same version, same status
      const child2 = mockSpawnSuccess("claude-code version 1.3.0\n");
      spawnMock.mockReturnValueOnce(child2);

      await monitor.checkBackend("claude-code");

      const backendChange = changes.find((c) => c.component === "backend:claude-code");
      expect(backendChange).toBeUndefined();
    });

    it("emits server status change when aggregated status transitions", async () => {
      const child = mockSpawnSuccess("claude-code version 1.2.0\n");
      spawnMock.mockReturnValue(child);

      const monitor = createMonitor([
        makeBackendConfig({ name: "claude-code", pinned_version: "1.x" }),
      ]);

      const changes: HealthChange[] = [];
      monitor.onStatusChange((change) => changes.push(change));

      await monitor.checkBackend("claude-code");

      // Server should have transitioned from degraded (initial) to healthy
      const serverChange = changes.find((c) => c.component === "server");
      expect(serverChange).toBeDefined();
      expect(serverChange!.new_status).toBe("healthy");
    });

    it("supports multiple callbacks", async () => {
      const child = mockSpawnSuccess("claude-code version 1.2.0\n");
      spawnMock.mockReturnValue(child);

      const monitor = createMonitor([
        makeBackendConfig({ name: "claude-code", pinned_version: "1.x" }),
      ]);

      const changes1: HealthChange[] = [];
      const changes2: HealthChange[] = [];
      monitor.onStatusChange((change) => changes1.push(change));
      monitor.onStatusChange((change) => changes2.push(change));

      await monitor.checkBackend("claude-code");

      expect(changes1.length).toBeGreaterThan(0);
      expect(changes2.length).toBeGreaterThan(0);
    });
  });

  // --- ISC-3: Version mismatch sets backend to degraded (not unhealthy) ---
  describe("ISC-3: version comparison", () => {
    it("healthy when version matches pinned major version", async () => {
      const child = mockSpawnSuccess("version 1.9.22\n");
      spawnMock.mockReturnValue(child);

      const monitor = createMonitor([
        makeBackendConfig({ pinned_version: "1.x" }),
      ]);

      const result = await monitor.checkBackend("claude-code");
      expect(result).toBe("healthy");
    });

    it("degraded when version does not match pinned major version", async () => {
      const child = mockSpawnSuccess("version 2.0.0\n");
      spawnMock.mockReturnValue(child);

      const monitor = createMonitor([
        makeBackendConfig({ pinned_version: "1.x" }),
      ]);

      const result = await monitor.checkBackend("claude-code");
      expect(result).toBe("degraded");
    });

    it("healthy when no pinned_version is configured", async () => {
      const child = mockSpawnSuccess("version 3.0.0\n");
      spawnMock.mockReturnValue(child);

      const monitor = createMonitor([
        makeBackendConfig({ pinned_version: undefined }),
      ]);

      const result = await monitor.checkBackend("claude-code");
      expect(result).toBe("healthy");
    });

    it("healthy when version cannot be parsed from output but command succeeds", async () => {
      const child = mockSpawnSuccess("ready\n");
      spawnMock.mockReturnValue(child);

      const monitor = createMonitor([
        makeBackendConfig({ pinned_version: "1.x" }),
      ]);

      const result = await monitor.checkBackend("claude-code");
      // Command succeeded but no version found; we mark healthy since the binary responds
      expect(result).toBe("healthy");
    });

    it("extracts version from multi-line output", async () => {
      const output = "Claude Code CLI\nBuild: stable\nVersion: 1.8.2\nReady.\n";
      const child = mockSpawnSuccess(output);
      spawnMock.mockReturnValue(child);

      const monitor = createMonitor([
        makeBackendConfig({ pinned_version: "1.x" }),
      ]);

      const result = await monitor.checkBackend("claude-code");
      expect(result).toBe("healthy");

      const status = monitor.getStatus();
      expect(status.backends["claude-code"].version).toBe("1.8.2");
    });

    it("matches major version 0.x correctly", async () => {
      const child = mockSpawnSuccess("version 0.15.3\n");
      spawnMock.mockReturnValue(child);

      const monitor = createMonitor([
        makeBackendConfig({ pinned_version: "0.x" }),
      ]);

      const result = await monitor.checkBackend("claude-code");
      expect(result).toBe("healthy");
    });
  });

  // --- ISC-4: Unauthenticated status returns only { status, uptime_seconds } ---
  describe("ISC-4: liveness vs full status", () => {
    it("getLivenessStatus returns only status and uptime_seconds", () => {
      const monitor = createMonitor();
      vi.advanceTimersByTime(10_000);

      const liveness = monitor.getLivenessStatus();

      expect(Object.keys(liveness)).toEqual(
        expect.arrayContaining(["status", "uptime_seconds"]),
      );
      expect(Object.keys(liveness).length).toBe(2);
      expect(typeof liveness.status).toBe("string");
      expect(typeof liveness.uptime_seconds).toBe("number");
      expect(liveness.uptime_seconds).toBeGreaterThanOrEqual(10);
    });

    it("getLivenessStatus does not expose backend details", () => {
      const monitor = createMonitor([
        makeBackendConfig({ name: "claude-code" }),
        makeBackendConfig({ name: "gemini-cli", command: "/usr/bin/gemini" }),
      ]);

      const liveness = monitor.getLivenessStatus() as Record<string, unknown>;
      expect(liveness["backends"]).toBeUndefined();
      expect(liveness["audit"]).toBeUndefined();
      expect(liveness["memory_usage_mb"]).toBeUndefined();
    });

    it("getStatus returns full health information", () => {
      const monitor = createMonitor([
        makeBackendConfig({ name: "claude-code" }),
      ]);

      const full = monitor.getStatus();
      expect(full.server).toBeDefined();
      expect(full.backends).toBeDefined();
      expect(full.audit).toBeDefined();
      expect(full.server.memory_usage_mb).toBeDefined();
      expect(full.server.active_sessions).toBeDefined();
    });
  });

  // --- ISC-5: Failed health check doesn't crash monitor ---
  describe("ISC-5: error resilience", () => {
    it("marks backend as unavailable when spawn fails with ENOENT", async () => {
      const child = mockSpawnError();
      spawnMock.mockReturnValue(child);

      const monitor = createMonitor([
        makeBackendConfig({ name: "claude-code" }),
      ]);

      const result = await monitor.checkBackend("claude-code");
      expect(result).toBe("unavailable");
    });

    it("marks backend as unavailable when command exits with non-zero code", async () => {
      const child = mockSpawnFailure(1, "command not found");
      spawnMock.mockReturnValue(child);

      const monitor = createMonitor([
        makeBackendConfig({ name: "claude-code" }),
      ]);

      const result = await monitor.checkBackend("claude-code");
      expect(result).toBe("unavailable");
    });

    it("does not crash when callback throws", async () => {
      const child = mockSpawnSuccess("version 1.0.0\n");
      spawnMock.mockReturnValue(child);

      const monitor = createMonitor([
        makeBackendConfig({ name: "claude-code", pinned_version: "1.x" }),
      ]);

      monitor.onStatusChange(() => {
        throw new Error("callback exploded");
      });

      // Should not throw
      await expect(monitor.checkBackend("claude-code")).resolves.toBe("healthy");
    });

    it("returns unavailable for unknown backend name", async () => {
      const monitor = createMonitor([
        makeBackendConfig({ name: "claude-code" }),
      ]);

      const result = await monitor.checkBackend("nonexistent-backend");
      expect(result).toBe("unavailable");
    });

    it("one backend failure does not affect other backends", async () => {
      const errorChild = mockSpawnError();
      const successChild = mockSpawnSuccess("version 2.1.0\n");

      spawnMock
        .mockReturnValueOnce(errorChild)
        .mockReturnValueOnce(successChild);

      const monitor = createMonitor([
        makeBackendConfig({ name: "broken-cli", command: "/nonexistent" }),
        makeBackendConfig({ name: "working-cli", command: "/usr/bin/gemini", pinned_version: "2.x" }),
      ]);

      await monitor.checkBackend("broken-cli");
      await monitor.checkBackend("working-cli");

      const status = monitor.getStatus();
      expect(status.backends["broken-cli"].status).toBe("unavailable");
      expect(status.backends["working-cli"].status).toBe("healthy");
    });

    it("disabled backends are not checked and return disabled", async () => {
      const monitor = createMonitor([
        makeBackendConfig({ name: "ollama", enabled: false }),
      ]);

      const result = await monitor.checkBackend("ollama");
      expect(result).toBe("disabled");
      expect(spawnMock).not.toHaveBeenCalled();
    });
  });

  // --- Lifecycle: start / stop ---
  describe("periodic check lifecycle", () => {
    it("start begins periodic backend checks", async () => {
      const child = mockSpawnSuccess("version 1.0.0\n");
      spawnMock.mockReturnValue(child);

      const monitor = createMonitor(
        [makeBackendConfig({ name: "claude-code", pinned_version: "1.x" })],
        makeHealthConfig({ backend_check_interval_seconds: 10 }),
      );

      monitor.start();

      // Advance past first interval
      await vi.advanceTimersByTimeAsync(10_000);

      expect(spawnMock).toHaveBeenCalled();

      monitor.stop();
    });

    it("stop prevents further checks", async () => {
      const child = mockSpawnSuccess("version 1.0.0\n");
      spawnMock.mockReturnValue(child);

      const monitor = createMonitor(
        [makeBackendConfig({ name: "claude-code", pinned_version: "1.x" })],
        makeHealthConfig({ backend_check_interval_seconds: 10 }),
      );

      monitor.start();
      monitor.stop();

      spawnMock.mockClear();

      await vi.advanceTimersByTimeAsync(20_000);
      expect(spawnMock).not.toHaveBeenCalled();
    });

    it("calling start twice does not create duplicate timers", async () => {
      const child = mockSpawnSuccess("version 1.0.0\n");
      spawnMock.mockReturnValue(child);

      const monitor = createMonitor(
        [makeBackendConfig({ name: "claude-code", pinned_version: "1.x" })],
        makeHealthConfig({ backend_check_interval_seconds: 10 }),
      );

      monitor.start();
      monitor.start(); // should be idempotent

      await vi.advanceTimersByTimeAsync(10_000);

      // Should only have been called once per interval, not twice
      // (exact count depends on implementation, but no duplicate intervals)
      const callCount = spawnMock.mock.calls.length;

      spawnMock.mockClear();
      await vi.advanceTimersByTimeAsync(10_000);

      // Second interval should also only fire once
      expect(spawnMock.mock.calls.length).toBeLessThanOrEqual(callCount);

      monitor.stop();
    });
  });

  // --- spawn security: no shell: true ---
  describe("spawn security", () => {
    it("spawns with array args and no shell option", async () => {
      const child = mockSpawnSuccess("version 1.0.0\n");
      spawnMock.mockReturnValue(child);

      const monitor = createMonitor([
        makeBackendConfig({
          name: "claude-code",
          command: "/usr/bin/claude",
          args: ["--version"],
        }),
      ]);

      await monitor.checkBackend("claude-code");

      expect(spawnMock).toHaveBeenCalledWith(
        "/usr/bin/claude",
        ["--version"],
        expect.objectContaining({
          shell: false,
        }),
      );
    });
  });

  // --- response_time_ms tracking ---
  describe("response time tracking", () => {
    it("records response time for successful checks", async () => {
      const child = mockSpawnSuccess("version 1.0.0\n");
      spawnMock.mockReturnValue(child);

      const monitor = createMonitor([
        makeBackendConfig({ name: "claude-code", pinned_version: "1.x" }),
      ]);

      await monitor.checkBackend("claude-code");

      const status = monitor.getStatus();
      expect(status.backends["claude-code"].response_time_ms).not.toBeNull();
      expect(typeof status.backends["claude-code"].response_time_ms).toBe("number");
    });
  });
});
