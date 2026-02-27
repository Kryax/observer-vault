/**
 * Observer Governance Plugin — cssclasses Auto-Sync (PRD Section 4.3)
 *
 * Pure logic module. No Obsidian API imports.
 *
 * Ensures the frontmatter `cssclasses` array contains exactly one
 * `status-{current_status}` class matching the document's `status` field.
 * Preserves all non-status classes. Removes stale `status-*` entries.
 */

import { SCHEMA, type Status } from './schema';

const STATUS_CLASS_PREFIX = 'status-';
const STATUS_CLASS_PATTERN = /^status-.+$/;

export interface CssSyncResult {
  needsUpdate: boolean;
  cssclasses: string[];
}

/**
 * Compute the correct cssclasses array based on the document's current status.
 *
 * Rules:
 * - If `frontmatter.status` is missing or not a valid schema status,
 *   return existing cssclasses unchanged with `needsUpdate: false`.
 * - Strip ALL `status-*` classes from the existing array.
 * - Append `status-{current_status}`.
 * - If the result differs from the input, `needsUpdate: true`.
 */
export function syncCssClasses(
  frontmatter: Record<string, any>,
): CssSyncResult {
  const existing: string[] = normalizeCssclasses(frontmatter.cssclasses);
  const status: unknown = frontmatter.status;

  // No status field or invalid status — nothing to sync
  if (
    typeof status !== 'string' ||
    !(SCHEMA.enums.status as readonly string[]).includes(status)
  ) {
    return { needsUpdate: false, cssclasses: existing };
  }

  const validStatus = status as Status;
  const targetClass = `${STATUS_CLASS_PREFIX}${validStatus}`;

  // Preserve non-status classes, strip all status-* classes
  const preserved = existing.filter(
    (cls) => !STATUS_CLASS_PATTERN.test(cls),
  );

  // Build the correct array: preserved classes + the one correct status class
  const corrected = [...preserved, targetClass];

  // Determine if an update is needed by comparing arrays
  const needsUpdate = !arraysEqual(existing, corrected);

  return { needsUpdate, cssclasses: corrected };
}

/**
 * Normalize the raw cssclasses value from frontmatter.
 * Handles: undefined, null, string, string[], or unexpected types.
 */
function normalizeCssclasses(raw: unknown): string[] {
  if (raw == null) return [];
  if (typeof raw === 'string') return raw.trim() ? [raw.trim()] : [];
  if (Array.isArray(raw)) {
    return raw
      .filter((item): item is string => typeof item === 'string')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return [];
}

/**
 * Shallow array equality check for string arrays (order-sensitive).
 */
function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
