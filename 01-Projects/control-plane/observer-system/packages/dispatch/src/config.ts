// S6: Dispatch configuration types and loader
// Accepts a parsed JavaScript object — does NOT parse YAML itself.
// The server layer is responsible for parsing config files.

import type { BackendHealthState } from "@observer/shared";

// ---------------------------------------------------------------------------
// Configuration Types
// ---------------------------------------------------------------------------

/**
 * Configuration for a single backend engine (Claude, Gemini, Codex, Ollama).
 */
export interface BackendConfig {
  /** The executable command (e.g., "claude", "gemini", "codex") */
  command: string;
  /** Template arguments — {{prompt}} and {{working_dir}} are replaced at dispatch time */
  args_template: string[];
  /** Whether this backend is enabled for dispatching */
  enabled: boolean;
  /** Cost model for this backend */
  cost: string;
  /** Trust level governs what operations this backend can perform */
  trust_level: "high" | "medium" | "low";
  /** Per-backend timeout in seconds (overrides dispatch.default_timeout_seconds) */
  timeout_seconds: number;
  /** Semver range for version pinning (e.g., ">=1.0.0 <2.0.0") */
  pinned_version: string;
  /** Health check configuration */
  health_check: {
    command: string;
    args: string[];
    timeout_seconds: number;
  };
}

/**
 * Top-level dispatch configuration.
 * This is the parsed form of the YAML dispatch section.
 */
export interface DispatchConfig {
  /** Routing mode — currently only "specify" is supported */
  routing_mode: "specify";
  /** Default backend to use if none specified in the request */
  default_backend: string;
  /** Global dispatch settings */
  dispatch: {
    default_timeout_seconds: number;
    max_retries: number;
    retry_delay_seconds: number;
    output_max_bytes: number;
    health_check_timeout_seconds: number;
  };
  /** Backend configurations keyed by name */
  backends: Record<string, BackendConfig>;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate a parsed dispatch config object.
 * Throws descriptive errors for invalid configuration.
 *
 * @param config The parsed config object to validate
 * @returns The validated config (same reference, typed)
 * @throws Error with descriptive message if config is invalid
 */
export function validateConfig(config: unknown): DispatchConfig {
  if (!config || typeof config !== "object") {
    throw new Error("Dispatch config must be a non-null object");
  }

  const c = config as Record<string, unknown>;

  // routing_mode
  if (c.routing_mode !== "specify") {
    throw new Error(
      `Invalid routing_mode: ${String(c.routing_mode)}. Only "specify" is supported.`,
    );
  }

  // default_backend
  if (typeof c.default_backend !== "string" || c.default_backend.length === 0) {
    throw new Error("default_backend must be a non-empty string");
  }

  // dispatch settings
  if (!c.dispatch || typeof c.dispatch !== "object") {
    throw new Error("dispatch settings must be a non-null object");
  }
  const d = c.dispatch as Record<string, unknown>;
  assertPositiveNumber(d, "default_timeout_seconds");
  assertNonNegativeInt(d, "max_retries");
  assertNonNegativeNumber(d, "retry_delay_seconds");
  assertPositiveNumber(d, "output_max_bytes");
  assertPositiveNumber(d, "health_check_timeout_seconds");

  // backends
  if (!c.backends || typeof c.backends !== "object") {
    throw new Error("backends must be a non-null object");
  }

  const backends = c.backends as Record<string, unknown>;
  if (Object.keys(backends).length === 0) {
    throw new Error("At least one backend must be configured");
  }

  for (const [name, backend] of Object.entries(backends)) {
    validateBackendConfig(name, backend);
  }

  // Verify default_backend exists in backends
  if (!(c.default_backend as string in backends)) {
    throw new Error(
      `default_backend "${c.default_backend}" not found in backends`,
    );
  }

  return config as DispatchConfig;
}

function validateBackendConfig(name: string, backend: unknown): void {
  if (!backend || typeof backend !== "object") {
    throw new Error(`Backend "${name}" must be a non-null object`);
  }

  const b = backend as Record<string, unknown>;

  if (typeof b.command !== "string" || b.command.length === 0) {
    throw new Error(`Backend "${name}": command must be a non-empty string`);
  }

  if (!Array.isArray(b.args_template)) {
    throw new Error(`Backend "${name}": args_template must be an array`);
  }

  if (typeof b.enabled !== "boolean") {
    throw new Error(`Backend "${name}": enabled must be a boolean`);
  }

  if (typeof b.cost !== "string") {
    throw new Error(`Backend "${name}": cost must be a string`);
  }

  const validTrust = ["high", "medium", "low"];
  if (!validTrust.includes(b.trust_level as string)) {
    throw new Error(
      `Backend "${name}": trust_level must be one of: ${validTrust.join(", ")}`,
    );
  }

  assertPositiveNumber(b, "timeout_seconds", `Backend "${name}"`);

  if (typeof b.pinned_version !== "string") {
    throw new Error(`Backend "${name}": pinned_version must be a string`);
  }

  // health_check
  if (!b.health_check || typeof b.health_check !== "object") {
    throw new Error(
      `Backend "${name}": health_check must be a non-null object`,
    );
  }
  const hc = b.health_check as Record<string, unknown>;
  if (typeof hc.command !== "string" || hc.command.length === 0) {
    throw new Error(
      `Backend "${name}": health_check.command must be a non-empty string`,
    );
  }
  if (!Array.isArray(hc.args)) {
    throw new Error(
      `Backend "${name}": health_check.args must be an array`,
    );
  }
  assertPositiveNumber(
    hc,
    "timeout_seconds",
    `Backend "${name}".health_check`,
  );
}

function assertPositiveNumber(
  obj: Record<string, unknown>,
  field: string,
  prefix: string = "",
): void {
  const label = prefix ? `${prefix}.${field}` : field;
  if (typeof obj[field] !== "number" || (obj[field] as number) <= 0) {
    throw new Error(`${label} must be a positive number`);
  }
}

function assertNonNegativeInt(
  obj: Record<string, unknown>,
  field: string,
  prefix: string = "",
): void {
  const label = prefix ? `${prefix}.${field}` : field;
  if (
    typeof obj[field] !== "number" ||
    !Number.isInteger(obj[field] as number) ||
    (obj[field] as number) < 0
  ) {
    throw new Error(`${label} must be a non-negative integer`);
  }
}

function assertNonNegativeNumber(
  obj: Record<string, unknown>,
  field: string,
  prefix: string = "",
): void {
  const label = prefix ? `${prefix}.${field}` : field;
  if (typeof obj[field] !== "number" || (obj[field] as number) < 0) {
    throw new Error(`${label} must be a non-negative number`);
  }
}

// ---------------------------------------------------------------------------
// Defaults and Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the effective timeout for a backend dispatch.
 * Backend-specific timeout takes precedence over global default.
 */
export function resolveTimeout(
  config: DispatchConfig,
  backendName: string,
): number {
  const backend = config.backends[backendName];
  if (backend?.timeout_seconds) {
    return backend.timeout_seconds;
  }
  return config.dispatch.default_timeout_seconds;
}

/**
 * Get a backend config by name, or null if not found/disabled.
 */
export function getBackend(
  config: DispatchConfig,
  name: string,
): BackendConfig | null {
  const backend = config.backends[name];
  if (!backend || !backend.enabled) {
    return null;
  }
  return backend;
}

/**
 * List all enabled backend names.
 */
export function listEnabledBackends(config: DispatchConfig): string[] {
  return Object.entries(config.backends)
    .filter(([_, b]) => b.enabled)
    .map(([name]) => name);
}

/**
 * Build the resolved command arguments from a template.
 * Replaces {{prompt}}, {{working_dir}}, and {{context_files}} placeholders.
 */
export function resolveArgs(
  template: readonly string[],
  vars: {
    prompt?: string;
    working_dir?: string;
    context_files?: string[];
  },
): string[] {
  return template.map((arg) => {
    let resolved = arg;
    if (vars.prompt !== undefined) {
      resolved = resolved.replace("{{prompt}}", vars.prompt);
    }
    if (vars.working_dir !== undefined) {
      resolved = resolved.replace("{{working_dir}}", vars.working_dir);
    }
    if (vars.context_files !== undefined) {
      resolved = resolved.replace(
        "{{context_files}}",
        vars.context_files.join(","),
      );
    }
    return resolved;
  });
}
