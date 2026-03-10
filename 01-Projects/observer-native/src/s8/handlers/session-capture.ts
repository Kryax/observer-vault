/**
 * S8 Handler — Session Capture
 *
 * Extracts session capture logic: generates mechanical summary,
 * runs salience filter, builds SessionRecord, calls captureSession().
 * Skips trivial sessions (< 2 events).
 */

import type { ObserverEvent } from "../../s0/events.ts";
import type { StopContext } from "../stop-orchestrator.ts";
import { captureSession } from "../../s2/session-capture.ts";
import type { SessionRecord, ISCOutcome } from "../../s2/session-capture.ts";
import {
  filterForSalience,
  formatHighlightSummary,
} from "../../s2/salience-filter.ts";
import { readActiveMotifs } from "../../s2/context-hydration.ts";

/** Minimum event count to consider a session non-trivial. */
const TRIVIAL_THRESHOLD = 2;

/**
 * Generates a mechanical summary from session events.
 * Deterministic — no LLM call.
 */
function generateSummary(events: ObserverEvent[]): string {
  const toolUses = events.filter((e) => e.type === "ObserverPreToolUse");
  const toolCounts: Record<string, number> = {};

  for (const event of toolUses) {
    if (event.type === "ObserverPreToolUse") {
      const name = event.toolName;
      toolCounts[name] = (toolCounts[name] ?? 0) + 1;
    }
  }

  const parts: string[] = [];
  parts.push(`${events.length} events`);

  if (Object.keys(toolCounts).length > 0) {
    const sorted = Object.entries(toolCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const toolSummary = sorted
      .map(([name, count]) => `${name}(${count})`)
      .join(", ");
    parts.push(`tools: ${toolSummary}`);
  }

  return parts.join("; ");
}

/**
 * Maps a Stop event reason to SessionRecord exitReason.
 */
function mapExitReason(
  reason: string | undefined,
): SessionRecord["exitReason"] {
  const map: Record<string, SessionRecord["exitReason"]> = {
    user_exit: "user_exit",
    timeout: "timeout",
    error: "error",
    completed: "completed",
  };
  return map[reason ?? ""] ?? "completed";
}

/**
 * Session capture handler.
 * Builds a SessionRecord from events and context, writes to vault.
 */
export async function handleSessionCapture(
  events: ObserverEvent[],
  context: StopContext,
): Promise<void> {
  // Skip trivial sessions
  if (events.length < TRIVIAL_THRESHOLD) return;

  // Run salience filter to produce highlights
  const activeMotifs = readActiveMotifs();
  const highlights = filterForSalience(events, { activeMotifs });
  const highlightSuffix = formatHighlightSummary(highlights);

  // Build summary: mechanical base + highlight enrichment
  const baseSummary = generateSummary(events);
  const summary = highlightSuffix
    ? `${baseSummary}. ${highlightSuffix}`
    : baseSummary;

  const iscOutcomes: ISCOutcome[] = [];

  const record: SessionRecord = {
    sessionId: context.sessionId,
    startedAt: context.startedAt,
    endedAt: context.endedAt,
    workingDirectory: context.workingDirectory,
    exitReason: mapExitReason(context.stopEvent.reason),
    summary,
    iscOutcomes,
  };

  captureSession(record);
}
