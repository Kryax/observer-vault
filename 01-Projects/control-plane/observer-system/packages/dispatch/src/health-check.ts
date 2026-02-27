// S6: Backend health check runner
// Runs backend health commands, parses version output,
// and compares against pinned semver ranges.

import { spawn } from "node:child_process";
import type { BackendHealthState } from "@observer/shared";
import { sanitizedEnv } from "./sanitize.js";
import type { BackendConfig, DispatchConfig } from "./config.js";
import pino from "pino";

const logger = pino({ name: "dispatch:health-check" });

/**
 * Result of a health check for a single backend.
 */
export interface HealthCheckResult {
  /** Backend name */
  name: string;
  /** Health state after the check */
  state: BackendHealthState;
  /** Detected version string (null if check failed) */
  version: string | null;
  /** Time taken for the check in milliseconds */
  responseTimeMs: number;
  /** Human-readable detail/error message */
  detail: string;
}

/**
 * Run a health check against a single backend.
 *
 * Flow:
 * 1. Spawn the health check command with sanitized env
 * 2. Capture stdout for version parsing
 * 3. Compare version against pinned_version range
 * 4. Return health state: healthy, degraded (version mismatch), or unavailable
 *
 * @param name Backend name
 * @param backend Backend configuration
 * @param globalTimeout Fallback timeout from dispatch config (milliseconds)
 * @returns HealthCheckResult
 */
export async function checkBackend(
  name: string,
  backend: BackendConfig,
  globalTimeout?: number,
): Promise<HealthCheckResult> {
  const startTime = Date.now();

  // Disabled backends are reported as disabled, not checked
  if (!backend.enabled) {
    return {
      name,
      state: "disabled",
      version: null,
      responseTimeMs: 0,
      detail: "Backend is disabled in configuration",
    };
  }

  const { command, args, timeout_seconds } = backend.health_check;
  const timeoutMs = (timeout_seconds || (globalTimeout ?? 30)) * 1000;
  const env = sanitizedEnv();

  return new Promise<HealthCheckResult>((resolve) => {
    let resolved = false;
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

    const finish = (result: HealthCheckResult): void => {
      if (resolved) return;
      resolved = true;
      if (timeoutTimer) clearTimeout(timeoutTimer);
      resolve(result);
    };

    // SECURITY: spawn with array args, shell mode FORBIDDEN
    const child = spawn(command, args, {
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const stdout: string[] = [];
    const stderr: string[] = [];

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout.push(chunk.toString("utf-8"));
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      stderr.push(chunk.toString("utf-8"));
    });

    child.on("close", (code) => {
      const responseTimeMs = Date.now() - startTime;
      const output = stdout.join("");

      if (code !== 0) {
        logger.warn(
          { name, code, stderr: stderr.join("") },
          "Health check failed",
        );
        finish({
          name,
          state: "unavailable",
          version: null,
          responseTimeMs,
          detail: `Health check exited with code ${code}`,
        });
        return;
      }

      // Parse version from output
      const version = parseVersion(output);

      // Compare against pinned version
      const versionMatch = version
        ? checkVersionRange(version, backend.pinned_version)
        : false;

      const state: BackendHealthState = version
        ? versionMatch
          ? "healthy"
          : "degraded"
        : "healthy"; // If no version found but exit code 0, treat as healthy

      const detail = !version
        ? "Health check passed but no version detected"
        : versionMatch
          ? `Version ${version} matches pinned range ${backend.pinned_version}`
          : `Version ${version} does not match pinned range ${backend.pinned_version}`;

      logger.info({ name, version, state, responseTimeMs }, "Health check complete");

      finish({
        name,
        state,
        version,
        responseTimeMs,
        detail,
      });
    });

    child.on("error", (err) => {
      const responseTimeMs = Date.now() - startTime;
      logger.error(
        { name, error: err.message },
        "Health check spawn error",
      );
      finish({
        name,
        state: "unavailable",
        version: null,
        responseTimeMs,
        detail: `Spawn error: ${err.message}`,
      });
    });

    // Timeout
    timeoutTimer = setTimeout(() => {
      if (resolved) return;
      logger.warn({ name, timeoutMs }, "Health check timed out");
      try {
        child.kill("SIGKILL");
      } catch {
        // Already exited
      }
      finish({
        name,
        state: "unavailable",
        version: null,
        responseTimeMs: Date.now() - startTime,
        detail: `Health check timed out after ${timeoutMs}ms`,
      });
    }, timeoutMs);
  });
}

/**
 * Run health checks against all configured backends.
 *
 * @param config Full dispatch configuration
 * @returns Map of backend name to health check result
 */
export async function checkAllBackends(
  config: DispatchConfig,
): Promise<Map<string, HealthCheckResult>> {
  const globalTimeoutMs = config.dispatch.health_check_timeout_seconds;
  const results = new Map<string, HealthCheckResult>();

  const checks = Object.entries(config.backends).map(
    async ([name, backend]) => {
      const result = await checkBackend(name, backend, globalTimeoutMs);
      results.set(name, result);
    },
  );

  await Promise.all(checks);
  return results;
}

/**
 * Parse a version string from command output.
 * Looks for common version patterns like "1.2.3", "v1.2.3", etc.
 *
 * @param output Raw stdout from health check command
 * @returns Extracted version string or null
 */
export function parseVersion(output: string): string | null {
  // Match semver-like patterns: v1.2.3, 1.2.3, 1.2.3-beta.1
  const match = output.match(
    /v?(\d+\.\d+\.\d+(?:-[a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)*)?)/,
  );
  return match ? match[1] : null;
}

/**
 * Simple semver range check.
 * Supports basic patterns: exact match, >=x.y.z, ^x.y.z, ~x.y.z
 *
 * For Phase 1, this is a simplified check. Phase 2 should use the
 * full `semver` package for comprehensive range evaluation.
 *
 * @param version The actual version string (e.g., "1.2.3")
 * @param range The pinned version range (e.g., ">=1.0.0", "^1.2.0")
 * @returns Whether the version satisfies the range
 */
export function checkVersionRange(version: string, range: string): boolean {
  const parsed = parseSemver(version);
  if (!parsed) return false;

  // Exact match
  const exactParsed = parseSemver(range);
  if (exactParsed) {
    return (
      parsed.major === exactParsed.major &&
      parsed.minor === exactParsed.minor &&
      parsed.patch === exactParsed.patch
    );
  }

  // >= range
  if (range.startsWith(">=")) {
    const minParsed = parseSemver(range.slice(2));
    if (!minParsed) return false;
    return compareSemver(parsed, minParsed) >= 0;
  }

  // ^ (compatible with version — same major)
  if (range.startsWith("^")) {
    const baseParsed = parseSemver(range.slice(1));
    if (!baseParsed) return false;
    if (parsed.major !== baseParsed.major) return false;
    return compareSemver(parsed, baseParsed) >= 0;
  }

  // ~ (approximately equivalent — same major.minor)
  if (range.startsWith("~")) {
    const baseParsed = parseSemver(range.slice(1));
    if (!baseParsed) return false;
    if (parsed.major !== baseParsed.major) return false;
    if (parsed.minor !== baseParsed.minor) return false;
    return parsed.patch >= baseParsed.patch;
  }

  // Wildcard match: "*" matches anything
  if (range === "*") return true;

  // Fallback: no match
  return false;
}

interface SemverParts {
  major: number;
  minor: number;
  patch: number;
}

function parseSemver(version: string): SemverParts | null {
  const clean = version.replace(/^v/, "").split("-")[0];
  const match = clean.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

function compareSemver(a: SemverParts, b: SemverParts): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}
