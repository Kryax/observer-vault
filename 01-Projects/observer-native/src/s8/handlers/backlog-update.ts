/**
 * S8 Handler — Living Backlog Update
 *
 * Reads open tensions from the S2 tension tracker and updates
 * BACKLOG.md in the observer-council directory. Manual sections
 * are preserved across updates — only Auto-tracked Tensions and
 * Resolved sections are rewritten.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { readOpenTensions } from "../../s2/tension-tracker.ts";
import type { ObserverEvent } from "../../s0/events.ts";
import type { StopContext } from "../stop-orchestrator.ts";
import type { TensionGap } from "../../s2/session-capture.ts";

const BACKLOG_PATH =
  "/mnt/zfs-host/backup/projects/observer-vault/01-Projects/observer-council/BACKLOG.md";

const SCAFFOLD = `# Observer Council — Living Backlog

> Auto-updated by session-end hook. Manual items are preserved across updates.

## Priorities

<!-- Add manual priority items here. This section is never modified by automation. -->

## Auto-tracked Tensions

<!-- This section is auto-updated from the tension tracker. Do not edit manually. -->

## Resolved

<!-- Resolved tensions are moved here for audit trail. -->
`;

/**
 * Format a single tension as a markdown bullet.
 */
function formatTensionItem(t: TensionGap): string {
  const datePart = t.firstSeen.slice(0, 10);
  const motifSuffix =
    t.relatedMotifs && t.relatedMotifs.length > 0
      ? ` | motifs: ${t.relatedMotifs.join(", ")}`
      : "";
  return `- **[${t.id}]** ${t.description} — first seen ${datePart}, seen ${t.sessionCount}x${motifSuffix}`;
}

/**
 * Parse a backlog file into sections keyed by header text.
 * Returns an ordered list of { header, body } pairs where
 * header is the full `## ...` line and body is everything until
 * the next `## ` header.
 */
interface Section {
  header: string; // empty string for content before first ##
  body: string;
}

function parseSections(content: string): Section[] {
  const lines = content.split("\n");
  const sections: Section[] = [];
  let currentHeader = "";
  let currentBody: string[] = [];

  for (const line of lines) {
    if (line.startsWith("## ")) {
      sections.push({ header: currentHeader, body: currentBody.join("\n") });
      currentHeader = line;
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }
  sections.push({ header: currentHeader, body: currentBody.join("\n") });

  return sections;
}

/**
 * Extract tension IDs from a markdown section body.
 * Looks for **[t-XXXXXXXX-NNN]** patterns.
 */
function extractTensionIds(body: string): Set<string> {
  const ids = new Set<string>();
  const re = /\*\*\[([^\]]+)\]\*\*/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    ids.add(match[1]);
  }
  return ids;
}

/**
 * Updates the living backlog from open tensions.
 * Safe merge: only rewrites Auto-tracked and Resolved sections.
 */
export async function updateBacklog(
  events: ObserverEvent[],
  context: StopContext,
): Promise<void> {
  // Read open tensions (generous limit for backlog)
  const openTensions = readOpenTensions(20);

  // Ensure file exists with scaffold
  if (!existsSync(BACKLOG_PATH)) {
    writeFileSync(BACKLOG_PATH, SCAFFOLD, "utf-8");
  }

  const existing = readFileSync(BACKLOG_PATH, "utf-8");
  const sections = parseSections(existing);

  // Find indices of Auto-tracked and Resolved sections
  const autoIdx = sections.findIndex((s) =>
    s.header.includes("Auto-tracked Tensions"),
  );
  const resolvedIdx = sections.findIndex((s) =>
    s.header.includes("Resolved"),
  );

  // If structure is missing, bail out rather than corrupt the file
  if (autoIdx === -1 || resolvedIdx === -1) {
    return;
  }

  // Determine which tension IDs were previously tracked
  const previousIds = extractTensionIds(sections[autoIdx].body);
  const currentIds = new Set(openTensions.map((t) => t.id));

  // Tensions that were in Auto-tracked but are no longer open -> moved to Resolved
  const today = new Date().toISOString().slice(0, 10);
  const newlyResolved: string[] = [];
  for (const id of previousIds) {
    if (!currentIds.has(id)) {
      newlyResolved.push(`- **[${id}]** resolved ${today}`);
    }
  }

  // Build new Auto-tracked body
  const autoComment =
    "\n<!-- This section is auto-updated from the tension tracker. Do not edit manually. -->\n";
  const tensionLines =
    openTensions.length > 0
      ? "\n" + openTensions.map(formatTensionItem).join("\n") + "\n"
      : "";
  sections[autoIdx].body = autoComment + tensionLines;

  // Append newly resolved to Resolved section (preserve existing entries)
  if (newlyResolved.length > 0) {
    const existingResolved = sections[resolvedIdx].body;
    const resolvedComment =
      "\n<!-- Resolved tensions are moved here for audit trail. -->\n";
    // Strip the comment from existing body to avoid duplication
    const existingEntries = existingResolved
      .replace(
        /\n?<!-- Resolved tensions are moved here for audit trail\. -->\n?/,
        "",
      )
      .trim();
    const allResolved = [existingEntries, ...newlyResolved]
      .filter((s) => s.length > 0)
      .join("\n");
    sections[resolvedIdx].body = resolvedComment + "\n" + allResolved + "\n";
  }

  // Reassemble file
  const output = sections
    .map((s) => (s.header ? s.header + s.body : s.body))
    .join("\n");

  writeFileSync(BACKLOG_PATH, output, "utf-8");
}
