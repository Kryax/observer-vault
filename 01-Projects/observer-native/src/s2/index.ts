/**
 * S2 — Memory System
 *
 * Cross-session persistence. Captures what happens in each session and
 * makes it available to future sessions. Integrates with the observer-vault's
 * established structure, NOT PAI's MEMORY/ directory.
 */

// Session capture — recording session metadata as JSONL
export {
  captureSession,
  extractISCOutcomes,
} from "./session-capture.ts";

export type {
  SessionRecord,
  ISCOutcome,
  ReflectSeed,
  MotifCandidate,
  TensionGap,
} from "./session-capture.ts";

// Context hydration — startup context loading
export { hydrateContext, readActiveMotifs } from "./context-hydration.ts";

export type {
  HydratedContext,
  ProjectState,
  MotifEntry,
} from "./context-hydration.ts";

// Framework delta — observation frame change tracking
export {
  storeFrameworkDelta,
  retrieveLatestDelta,
  retrieveAllDeltas,
} from "./framework-delta.ts";

export type { FrameworkDelta } from "./framework-delta.ts";

// Salience filter — highlight layer above S1 events
export { filterForSalience, formatHighlightSummary } from "./salience-filter.ts";

export type {
  Highlight,
  SalienceTrigger,
  SalienceContext,
} from "./salience-filter.ts";

// Vault writer — vault-aware file operations
export {
  vaultAppend,
  vaultWrite,
  vaultRead,
  vaultExists,
  isAllowedVaultPath,
  resolveVaultPath,
  VAULT_ROOT,
} from "./vault-writer.ts";

export type { VaultWriteResult } from "./vault-writer.ts";
