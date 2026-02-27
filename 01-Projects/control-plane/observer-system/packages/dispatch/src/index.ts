// S6: Dispatch package — public API barrel export
// Execution dispatch, environment sanitization, health checks, and config.

// Executor — the core dispatch engine
export { execute } from "./executor.js";
export type { ExecuteOptions } from "./executor.js";

// Sanitization — the #1 security guarantee
export {
  sanitizedEnv,
  validateArgs,
  sanitizeOutput,
  shannonEntropy,
} from "./sanitize.js";

// Health checks — backend availability monitoring
export { checkBackend, checkAllBackends } from "./health-check.js";
export { parseVersion, checkVersionRange } from "./health-check.js";
export type { HealthCheckResult } from "./health-check.js";

// Config — dispatch configuration types and validation
export {
  validateConfig,
  resolveTimeout,
  getBackend,
  listEnabledBackends,
  resolveArgs,
} from "./config.js";
export type { DispatchConfig, BackendConfig } from "./config.js";
