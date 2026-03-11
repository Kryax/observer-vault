/**
 * S2 — Tension/Gap Tracker (PRD step 5)
 *
 * Detects tensions from failing ISC outcomes, accumulates them in a
 * persistent JSONL backlog, tracks recurrence across sessions, and
 * marks tensions resolved when their generating ISC criteria pass.
 *
 * Backlog: {WORKSPACE}/tensions.jsonl (project-level, not per-day)
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import type { TensionGap, ISCOutcome } from "./session-capture.ts";

const WORKSPACE =
  "/mnt/zfs-host/backup/projects/observer-vault/01-Projects/observer-native";
const BACKLOG_PATH = `${WORKSPACE}/tensions.jsonl`;

/**
 * Normalizes a description for deduplication: lowercase, collapse whitespace.
 */
function normalize(desc: string): string {
  return desc.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Generates a tension ID: t-YYYYMMDD-NNN (zero-padded sequential).
 */
function generateTensionId(date: string, index: number): string {
  const dateStr = date.slice(0, 10).replace(/-/g, "");
  return `t-${dateStr}-${String(index + 1).padStart(3, "0")}`;
}

/**
 * Detects tensions from failing ISC outcomes.
 * Each failing criterion becomes a candidate tension.
 */
export function detectTensions(
  outcomes: ISCOutcome[],
  existingBacklog: TensionGap[],
): TensionGap[] {
  const now = new Date().toISOString();
  const failing = outcomes.filter(
    (o) => o.status === "pending" || o.status === "in_progress",
  );

  if (failing.length === 0) return [];

  // Count existing tensions created today for sequential numbering
  const today = now.slice(0, 10);
  const todayExisting = existingBacklog.filter(
    (t) => t.firstSeen.slice(0, 10) === today,
  ).length;

  return failing.map((outcome, i) => ({
    id: generateTensionId(now, todayExisting + i),
    description: outcome.description,
    firstSeen: now,
    sessionCount: 1,
    relatedMotifs: undefined,
    status: "open" as const,
  }));
}

/**
 * Reads the tension backlog from tensions.jsonl.
 * Returns empty array if file doesn't exist (graceful cold start).
 */
export function readBacklog(): TensionGap[] {
  if (!existsSync(BACKLOG_PATH)) return [];

  const raw = readFileSync(BACKLOG_PATH, "utf-8");
  const tensions: TensionGap[] = [];

  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      tensions.push(JSON.parse(line) as TensionGap);
    } catch {
      // Skip malformed lines
    }
  }

  return tensions;
}

/**
 * Writes the full tension backlog to tensions.jsonl.
 */
export function writeBacklog(tensions: TensionGap[]): void {
  const content = tensions.map((t) => JSON.stringify(t)).join("\n") + "\n";
  writeFileSync(BACKLOG_PATH, content, "utf-8");
}

/**
 * Accumulates new tensions into the existing backlog.
 * - Matching tensions (by normalized description): increment sessionCount, union relatedMotifs
 * - New tensions: append with sessionCount=1
 * Returns the updated backlog.
 */
export function accumulateTensions(
  backlog: TensionGap[],
  newTensions: TensionGap[],
): TensionGap[] {
  const updated = [...backlog];
  const normalizedIndex = new Map<string, number>();

  // Build index of existing tensions by normalized description
  for (let i = 0; i < updated.length; i++) {
    normalizedIndex.set(normalize(updated[i].description), i);
  }

  for (const tension of newTensions) {
    const key = normalize(tension.description);
    const existingIdx = normalizedIndex.get(key);

    if (existingIdx !== undefined) {
      // Recurrence: increment sessionCount, preserve original id and firstSeen
      const existing = updated[existingIdx];
      existing.sessionCount += 1;
      // Union relatedMotifs
      if (tension.relatedMotifs) {
        const current = new Set(existing.relatedMotifs ?? []);
        for (const m of tension.relatedMotifs) current.add(m);
        existing.relatedMotifs = [...current];
      }
      // Re-open if it was resolved but recurred
      if (existing.status === "resolved") {
        existing.status = "open";
      }
    } else {
      // New tension
      updated.push(tension);
      normalizedIndex.set(key, updated.length - 1);
    }
  }

  return updated;
}

/**
 * Marks tensions as resolved when their generating ISC criteria now pass.
 * Matches by normalized description against passing outcomes.
 */
export function resolveTensions(
  backlog: TensionGap[],
  outcomes: ISCOutcome[],
): TensionGap[] {
  const passingDescriptions = new Set(
    outcomes
      .filter((o) => o.status === "passing")
      .map((o) => normalize(o.description)),
  );

  return backlog.map((t) => {
    if (t.status === "open" && passingDescriptions.has(normalize(t.description))) {
      return { ...t, status: "resolved" as const };
    }
    return t;
  });
}

/**
 * Full tension tracking pipeline for session-end:
 * detect → read backlog → accumulate → resolve → write backlog.
 * Returns the tensions detected this session (for SessionRecord).
 */
export function trackTensions(outcomes: ISCOutcome[]): TensionGap[] {
  const backlog = readBacklog();
  const detected = detectTensions(outcomes, backlog);

  if (detected.length === 0 && outcomes.length === 0) {
    return [];
  }

  let updated = accumulateTensions(backlog, detected);
  updated = resolveTensions(updated, outcomes);
  writeBacklog(updated);

  return detected;
}

/**
 * Reads open tensions from the backlog, sorted by sessionCount descending.
 * Capped at `limit` entries for context budget.
 */
export function readOpenTensions(limit: number = 5): TensionGap[] {
  return readBacklog()
    .filter((t) => t.status === "open")
    .sort((a, b) => b.sessionCount - a.sessionCount)
    .slice(0, limit);
}

/**
 * Formats open tensions for session-start priming context.
 */
export function formatTensionSummary(tensions: TensionGap[]): string {
  if (tensions.length === 0) return "";

  const lines = tensions.map(
    (t) => `  [${t.id}] ${t.description} (seen ${t.sessionCount}x)`,
  );

  return `Open tensions (${tensions.length}):\n${lines.join("\n")}`;
}
