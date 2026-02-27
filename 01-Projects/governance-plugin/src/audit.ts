/**
 * Observer Governance Plugin -- JSONL Audit Log Writer
 *
 * Append-only audit log. Each line is a self-contained JSON object
 * terminated by a newline. Uses app.vault.adapter.append() to guarantee
 * atomic appends without read-modify-write.
 *
 * PRD Section 5: Audit Trail
 */

import { App } from 'obsidian';
import type { Status } from './schema';

// ---------------------------------------------------------------------------
// Audit entry types (PRD 5.2)
// ---------------------------------------------------------------------------

export interface PromoteEntry {
  action: 'promote';
  file: string;
  from: Status;
  to: Status;
  by: string;
  rationale: string;
}

export interface DemoteEntry {
  action: 'demote';
  file: string;
  from: Status;
  to: Status;
  by: string;
  rationale: string;
}

export interface ValidateFailEntry {
  action: 'validate_fail';
  file: string;
  errors: string[];
}

export interface FrontmatterFixEntry {
  action: 'frontmatter_fix';
  file: string;
  field: string;
  old: string;
  new: string;
}

export interface ManifestGenEntry {
  action: 'manifest_gen';
  version: number;
  doc_count: number;
}

export interface PrimingRefreshEntry {
  action: 'priming_refresh';
  canonical_count: number;
  project_count: number;
}

/**
 * Union of all audit entry payloads. The `ts` field is injected
 * automatically by appendAuditEntry -- callers never set it.
 */
export type AuditEntry =
  | PromoteEntry
  | DemoteEntry
  | ValidateFailEntry
  | FrontmatterFixEntry
  | ManifestGenEntry
  | PrimingRefreshEntry;

/** A stored audit record (entry + auto-generated timestamp). */
export type AuditRecord = AuditEntry & { ts: string };

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

const PLUGIN_DIR = '.obsidian/plugins/observer-governance';

/**
 * Resolve the audit log path from settings.
 * settings.auditLogPath is a bare filename (e.g. "audit.jsonl").
 * Returns the full vault-relative path inside the plugin folder.
 */
export function getAuditPath(settings: { auditLogPath: string }): string {
  return `${PLUGIN_DIR}/${settings.auditLogPath}`;
}

// ---------------------------------------------------------------------------
// Writer
// ---------------------------------------------------------------------------

/**
 * Append a single audit entry to the JSONL log file.
 *
 * - Injects `ts` (ISO 8601 UTC) automatically.
 * - Uses adapter.append() for atomic, append-only writes.
 * - Creates the file if it does not yet exist.
 *
 * @param app     Obsidian App instance
 * @param entry   The audit event payload (without timestamp)
 * @param path    Vault-relative path to the audit log file.
 *                Defaults to the standard plugin audit path.
 */
export async function appendAuditEntry(
  app: App,
  entry: AuditEntry,
  path: string = `${PLUGIN_DIR}/audit.jsonl`,
): Promise<void> {
  const record: AuditRecord = {
    ts: new Date().toISOString(),
    ...entry,
  };

  const line = JSON.stringify(record) + '\n';

  // Ensure file exists before appending. adapter.append() on a
  // non-existent file throws in some Obsidian versions.
  const exists = await app.vault.adapter.exists(path);
  if (!exists) {
    await app.vault.adapter.write(path, line);
  } else {
    await app.vault.adapter.append(path, line);
  }
}
