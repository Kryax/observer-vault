/**
 * S2 — Vault Writer (PRD 3.2.2)
 *
 * Vault-aware file operations. Respects the established directory structure
 * and write rules. Atlas can create in 00-Inbox (auto-approved), update
 * draft/inbox status documents, and write to designated directories.
 *
 * Does NOT reference or use PAI's MEMORY/ directory.
 */

import { existsSync, mkdirSync, appendFileSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** The vault root — resolved from environment or default. */
const VAULT_ROOT =
  process.env.OBSERVER_VAULT_ROOT ??
  "/mnt/zfs-host/backup/projects/observer-vault";

/**
 * Allowed write targets within the vault. Each maps to the PRD 3.2.2 table.
 * The vault writer refuses writes outside these paths.
 */
const ALLOWED_PREFIXES = [
  "00-Inbox/",
  "01-Projects/",
  "02-Knowledge/motifs/",
  "02-Knowledge/framework/",
  "03-Daily/",
] as const;

export interface VaultWriteResult {
  success: boolean;
  path: string;
  error?: string;
}

/**
 * Validates that a relative vault path falls within allowed write targets.
 */
export function isAllowedVaultPath(relativePath: string): boolean {
  return ALLOWED_PREFIXES.some((prefix) => relativePath.startsWith(prefix));
}

/**
 * Resolves a relative vault path to an absolute path.
 */
export function resolveVaultPath(relativePath: string): string {
  return join(VAULT_ROOT, relativePath);
}

/**
 * Ensures the parent directory exists, creating it recursively if needed.
 */
function ensureDir(absolutePath: string): void {
  const dir = dirname(absolutePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Appends a line to a file in the vault. Creates the file if it does not exist.
 * Used for JSONL session logs and similar append-only writes.
 */
export function vaultAppend(
  relativePath: string,
  content: string,
): VaultWriteResult {
  if (!isAllowedVaultPath(relativePath)) {
    return {
      success: false,
      path: relativePath,
      error: `Write denied: ${relativePath} is not within allowed vault paths`,
    };
  }

  const abs = resolveVaultPath(relativePath);
  ensureDir(abs);
  appendFileSync(abs, content.endsWith("\n") ? content : content + "\n", "utf8");
  return { success: true, path: abs };
}

/**
 * Writes (or overwrites) a file in the vault.
 * Used for motif entries, framework deltas, and other discrete documents.
 */
export function vaultWrite(
  relativePath: string,
  content: string,
): VaultWriteResult {
  if (!isAllowedVaultPath(relativePath)) {
    return {
      success: false,
      path: relativePath,
      error: `Write denied: ${relativePath} is not within allowed vault paths`,
    };
  }

  const abs = resolveVaultPath(relativePath);
  ensureDir(abs);
  writeFileSync(abs, content, "utf8");
  return { success: true, path: abs };
}

/**
 * Reads a file from the vault. Returns null if the file does not exist.
 */
export function vaultRead(relativePath: string): string | null {
  const abs = resolveVaultPath(relativePath);
  if (!existsSync(abs)) return null;
  return readFileSync(abs, "utf8");
}

/**
 * Checks whether a vault path exists.
 */
export function vaultExists(relativePath: string): boolean {
  return existsSync(resolveVaultPath(relativePath));
}

export { VAULT_ROOT };
