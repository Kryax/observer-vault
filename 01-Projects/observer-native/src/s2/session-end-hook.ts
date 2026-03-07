#!/usr/bin/env bun
/**
 * S2 — Session-End Hook
 *
 * Invoked when a Claude Code session ends (Stop event).
 * Reads the current session's events from events.ndjson,
 * constructs a SessionRecord, and writes it via captureSession().
 *
 * Fail-silent: errors never propagate to the CLI.
 */

import { readFileSync, existsSync } from "node:fs";
import { captureSession } from "./session-capture.ts";
import type { SessionRecord, ISCOutcome } from "./session-capture.ts";
import type { ObserverEvent } from "../s0/events.ts";

const WORKSPACE =
  "/mnt/zfs-host/backup/projects/observer-vault/01-Projects/observer-native";
const EVENTS_PATH = `${WORKSPACE}/tmp/events.ndjson`;

/** Minimum event count to consider a session non-trivial. */
const TRIVIAL_THRESHOLD = 2;

/**
 * Reads all events from events.ndjson for a given session ID.
 */
function readSessionEvents(sessionId: string): ObserverEvent[] {
  if (!existsSync(EVENTS_PATH)) return [];

  const raw = readFileSync(EVENTS_PATH, "utf-8");
  const events: ObserverEvent[] = [];

  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line) as ObserverEvent;
      // Match events belonging to this session
      const eventSessionId = getSessionId(event);
      if (eventSessionId === sessionId) {
        events.push(event);
      }
    } catch {
      // Skip malformed lines
    }
  }

  return events;
}

/**
 * Extracts the session ID from any Observer event type.
 */
function getSessionId(event: ObserverEvent): string | null {
  switch (event.type) {
    case "ObserverSessionStart":
    case "ObserverSessionStop":
      return event.sessionId;
    case "ObserverPreToolUse":
    case "ObserverPostToolUse":
      return event.sessionContext.sessionId;
    default:
      return null;
  }
}

/**
 * Generates a mechanical summary from session events.
 * Deterministic — no LLM call (per PRD key decision).
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
    const toolSummary = sorted.map(([name, count]) => `${name}(${count})`).join(", ");
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
 * Main: construct SessionRecord and write it.
 */
async function main() {
  // Read stdin to get the Stop event from Claude Code
  const reader = Bun.stdin.stream().getReader();
  let raw = "";
  const read = (async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      raw += new TextDecoder().decode(value, { stream: true });
    }
  })();
  await Promise.race([read, new Promise<void>((r) => setTimeout(r, 200))]);

  if (!raw.trim()) return;

  const stopEvent = JSON.parse(raw.trim());
  const sessionId: string = stopEvent.session_id ?? "unknown";

  // Read all events for this session
  const events = readSessionEvents(sessionId);

  // Handle trivial sessions: skip if fewer than TRIVIAL_THRESHOLD events
  if (events.length < TRIVIAL_THRESHOLD) return;

  // Find timestamps
  const startEvent = events.find((e) => e.type === "ObserverSessionStart");
  const stopEvt = events.find((e) => e.type === "ObserverSessionStop");
  const now = new Date().toISOString();

  const record: SessionRecord = {
    sessionId,
    startedAt: startEvent?.type === "ObserverSessionStart"
      ? startEvent.timestamp
      : now,
    endedAt: stopEvt?.type === "ObserverSessionStop"
      ? stopEvt.timestamp
      : now,
    workingDirectory: startEvent?.type === "ObserverSessionStart"
      ? startEvent.workingDirectory
      : process.cwd(),
    exitReason: mapExitReason(stopEvent.reason),
    summary: generateSummary(events),
    iscOutcomes: [],
    // reflectOutput, motifCandidates, tensions: undefined initially (honest state)
  };

  captureSession(record);
}

// Hook entry point — output continue signal, then process
console.log(JSON.stringify({ continue: true }));

try {
  await main();
} catch {
  // Fail-silent: never break the CLI session
}
