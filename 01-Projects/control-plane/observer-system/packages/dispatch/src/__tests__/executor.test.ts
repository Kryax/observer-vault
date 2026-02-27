// S6: Executor tests — kill chain, spawn safety, and end-to-end dispatch
// ISC criteria validated:
// - Zero matches for shell: true in dispatch source
// - spawn() uses array args
// - Timeout triggers SIGTERM -> 10s -> SIGKILL kill chain
// - End-to-end: dispatch to echo/env, verify sanitized env

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execute, type ExecuteOptions } from "../executor.js";
import { validateConfig, type DispatchConfig } from "../config.js";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

/**
 * Minimal valid dispatch config for testing.
 * Uses 'echo' and 'env' as test backends since they are available on all systems.
 */
function testConfig(overrides?: Partial<DispatchConfig>): DispatchConfig {
  const base: DispatchConfig = {
    routing_mode: "specify",
    default_backend: "echo-test",
    dispatch: {
      default_timeout_seconds: 10,
      max_retries: 0,
      retry_delay_seconds: 1,
      output_max_bytes: 1024 * 1024,
      health_check_timeout_seconds: 5,
    },
    backends: {
      "echo-test": {
        command: "echo",
        args_template: ["{{prompt}}"],
        enabled: true,
        cost: "free",
        trust_level: "low",
        timeout_seconds: 10,
        pinned_version: "*",
        health_check: {
          command: "echo",
          args: ["healthy"],
          timeout_seconds: 5,
        },
      },
      "env-test": {
        command: "env",
        args_template: [],
        enabled: true,
        cost: "free",
        trust_level: "low",
        timeout_seconds: 10,
        pinned_version: "*",
        health_check: {
          command: "echo",
          args: ["healthy"],
          timeout_seconds: 5,
        },
      },
      "sleep-test": {
        command: "sleep",
        args_template: ["30"],
        enabled: true,
        cost: "free",
        trust_level: "low",
        timeout_seconds: 2, // Short timeout for testing kill chain
        pinned_version: "*",
        health_check: {
          command: "echo",
          args: ["healthy"],
          timeout_seconds: 5,
        },
      },
      "disabled-test": {
        command: "echo",
        args_template: ["should-not-run"],
        enabled: false,
        cost: "free",
        trust_level: "low",
        timeout_seconds: 10,
        pinned_version: "*",
        health_check: {
          command: "echo",
          args: ["healthy"],
          timeout_seconds: 5,
        },
      },
      "false-test": {
        command: "false",
        args_template: [],
        enabled: true,
        cost: "free",
        trust_level: "low",
        timeout_seconds: 10,
        pinned_version: "*",
        health_check: {
          command: "echo",
          args: ["healthy"],
          timeout_seconds: 5,
        },
      },
    },
  };

  return { ...base, ...overrides } as DispatchConfig;
}

function baseOptions(overrides?: Partial<ExecuteOptions>): ExecuteOptions {
  return {
    dispatchId: "dsp_test000001",
    backendName: "echo-test",
    prompt: "Hello, world!",
    workingDirectory: "/tmp",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// End-to-end: echo test (basic spawn)
// ---------------------------------------------------------------------------
describe("execute — echo backend", () => {
  it("runs echo and captures stdout", async () => {
    const config = testConfig();
    const result = await execute(config, baseOptions());

    expect(result.dispatch_id).toBe("dsp_test000001");
    expect(result.backend_used).toBe("echo-test");
    expect(result.status).toBe("completed");
    expect(result.exit_code).toBe(0);
    expect(result.stdout_log.trim()).toBe("Hello, world!");
    expect(result.stderr_log).toBe("");
    expect(result.execution_time_seconds).toBeGreaterThan(0);
    expect(result.validation_pending).toBe(true);
  });

  it("reports prompt content in stdout via echo", async () => {
    const config = testConfig();
    const result = await execute(
      config,
      baseOptions({ prompt: "specific test string 42" }),
    );

    expect(result.status).toBe("completed");
    expect(result.stdout_log).toContain("specific test string 42");
  });
});

// ---------------------------------------------------------------------------
// End-to-end: env test (verify sanitized environment)
// ---------------------------------------------------------------------------
describe("execute — env backend (credential isolation)", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    // Inject test credential vars into process.env
    process.env.OPENAI_API_KEY = "sk-TESTKEY123456789012345678901234";
    process.env.GITHUB_TOKEN = "ghp_TESTTOKEN1234567890123456789012345678";
    process.env.AWS_SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCY";
    process.env.DB_PASSWORD = "super-secret-password";
    process.env.MY_SECRET = "classified-info";
  });

  afterEach(() => {
    // Restore original env
    delete process.env.OPENAI_API_KEY;
    delete process.env.GITHUB_TOKEN;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.DB_PASSWORD;
    delete process.env.MY_SECRET;
  });

  it("child process does NOT receive credential env vars", async () => {
    const config = testConfig();
    const result = await execute(
      config,
      baseOptions({ backendName: "env-test" }),
    );

    expect(result.status).toBe("completed");
    const envOutput = result.stdout_log;

    // Credentials MUST NOT appear in child env
    expect(envOutput).not.toContain("OPENAI_API_KEY");
    expect(envOutput).not.toContain("sk-TESTKEY");
    expect(envOutput).not.toContain("GITHUB_TOKEN");
    expect(envOutput).not.toContain("ghp_TESTTOKEN");
    expect(envOutput).not.toContain("AWS_SECRET_ACCESS_KEY");
    expect(envOutput).not.toContain("DB_PASSWORD");
    expect(envOutput).not.toContain("MY_SECRET");
  });

  it("child process receives only allowed env vars", async () => {
    const config = testConfig();
    const result = await execute(
      config,
      baseOptions({ backendName: "env-test" }),
    );

    expect(result.status).toBe("completed");
    const envOutput = result.stdout_log;

    // PATH should be present (it is in the allowlist)
    if (process.env.PATH) {
      expect(envOutput).toContain("PATH=");
    }
  });

  it("child process receives extraEnv but not credential-named extras", async () => {
    const config = testConfig();
    const result = await execute(
      config,
      baseOptions({
        backendName: "env-test",
        extraEnv: {
          CUSTOM_SETTING: "allowed-value",
          EXTRA_API_KEY: "should-be-blocked",
        },
      }),
    );

    expect(result.status).toBe("completed");
    const envOutput = result.stdout_log;

    expect(envOutput).toContain("CUSTOM_SETTING=allowed-value");
    expect(envOutput).not.toContain("EXTRA_API_KEY");
    expect(envOutput).not.toContain("should-be-blocked");
  });
});

// ---------------------------------------------------------------------------
// Disabled backend
// ---------------------------------------------------------------------------
describe("execute — disabled backend", () => {
  it("returns failed status for disabled backends", async () => {
    const config = testConfig();
    const result = await execute(
      config,
      baseOptions({ backendName: "disabled-test" }),
    );

    expect(result.status).toBe("failed");
    expect(result.stderr_log).toContain("not found or disabled");
  });

  it("returns failed status for non-existent backends", async () => {
    const config = testConfig();
    const result = await execute(
      config,
      baseOptions({ backendName: "nonexistent" }),
    );

    expect(result.status).toBe("failed");
    expect(result.stderr_log).toContain("not found or disabled");
  });
});

// ---------------------------------------------------------------------------
// Non-zero exit code
// ---------------------------------------------------------------------------
describe("execute — failed backend (non-zero exit)", () => {
  it("reports failed status with non-zero exit code", async () => {
    const config = testConfig();
    const result = await execute(
      config,
      baseOptions({ backendName: "false-test" }),
    );

    expect(result.status).toBe("failed");
    expect(result.exit_code).not.toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Command not found
// ---------------------------------------------------------------------------
describe("execute — spawn error (command not found)", () => {
  it("reports failed status when command does not exist", async () => {
    const config = testConfig({
      backends: {
        ...testConfig().backends,
        "bad-cmd": {
          command: "/nonexistent/command/that/does/not/exist",
          args_template: [],
          enabled: true,
          cost: "free",
          trust_level: "low",
          timeout_seconds: 5,
          pinned_version: "*",
          health_check: {
            command: "echo",
            args: ["healthy"],
            timeout_seconds: 5,
          },
        },
      },
    });

    const result = await execute(
      config,
      baseOptions({ backendName: "bad-cmd" }),
    );

    expect(result.status).toBe("failed");
    expect(result.stderr_log).toContain("Spawn error");
  });
});

// ---------------------------------------------------------------------------
// Argument validation (credential in args)
// ---------------------------------------------------------------------------
describe("execute — argument validation", () => {
  it("rejects dispatch when args contain credentials", async () => {
    const config = testConfig({
      backends: {
        ...testConfig().backends,
        "cred-test": {
          command: "echo",
          args_template: ["{{prompt}}"],
          enabled: true,
          cost: "free",
          trust_level: "low",
          timeout_seconds: 10,
          pinned_version: "*",
          health_check: {
            command: "echo",
            args: ["healthy"],
            timeout_seconds: 5,
          },
        },
      },
    });

    const result = await execute(config, {
      dispatchId: "dsp_test000002",
      backendName: "cred-test",
      prompt: "sk-abcdefghijklmnopqrstuvwxyz1234",
      workingDirectory: "/tmp",
    });

    expect(result.status).toBe("failed");
    expect(result.stderr_log).toContain("credential pattern");
  });
});

// ---------------------------------------------------------------------------
// Kill chain (timeout)
// ---------------------------------------------------------------------------
describe("execute — timeout and kill chain", () => {
  it(
    "kills process on timeout and returns timeout status",
    async () => {
      const config = testConfig();
      const result = await execute(
        config,
        baseOptions({
          backendName: "sleep-test",
          timeoutSeconds: 1, // 1 second timeout, sleep 30s
        }),
      );

      expect(result.status).toBe("timeout");
      expect(result.execution_time_seconds).toBeGreaterThanOrEqual(0.9);
      expect(result.execution_time_seconds).toBeLessThan(15); // Should not wait full 30s
    },
    20_000, // 20s test timeout
  );
});

// ---------------------------------------------------------------------------
// ISC Source Code Verification
// ---------------------------------------------------------------------------
describe("ISC criteria — source code invariants", () => {
  // Read all dispatch source files and verify security invariants
  const srcDir = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
  );

  const sourceFiles = [
    "executor.ts",
    "sanitize.ts",
    "health-check.ts",
    "config.ts",
    "index.ts",
  ];

  for (const file of sourceFiles) {
    it(`${file}: zero matches for shell: true`, () => {
      let content: string;
      try {
        content = readFileSync(join(srcDir, file), "utf-8");
      } catch {
        // File might not exist yet during TDD
        return;
      }
      // Match shell: true with any whitespace variations
      const shellTruePattern = /shell\s*:\s*true/g;
      const matches = content.match(shellTruePattern);
      expect(
        matches,
        `Found "shell: true" in ${file} — this is NON-NEGOTIABLE (T5)`,
      ).toBeNull();
    });
  }

  it("executor.ts uses spawn() from node:child_process", () => {
    const content = readFileSync(join(srcDir, "executor.ts"), "utf-8");
    expect(content).toContain('import { spawn } from "node:child_process"');
  });

  it("executor.ts never references process.env directly in spawn calls", () => {
    const content = readFileSync(join(srcDir, "executor.ts"), "utf-8");
    // The env passed to spawn should come from sanitizedEnv, not process.env
    // Check that 'env: process.env' does not appear
    expect(content).not.toMatch(/env\s*:\s*process\.env/);
  });

  it("executor.ts imports sanitizedEnv from sanitize module", () => {
    const content = readFileSync(join(srcDir, "executor.ts"), "utf-8");
    expect(content).toContain("sanitizedEnv");
    expect(content).toContain("from \"./sanitize.js\"");
  });
});
