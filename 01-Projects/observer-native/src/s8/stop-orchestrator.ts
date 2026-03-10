#!/usr/bin/env bun
/**
 * S8 — Stop Orchestrator
 *
 * Central dispatcher for session-end processing. Reads stdin once,
 * parses the stop event, loads session events, and delegates to
 * registered handlers via Promise.allSettled.
 *
 * Outputs { continue: true } to stdout FIRST, before any processing.
 * All handlers fail-silent with try-catch isolation.
 */

import { readFileSync, existsSync } from "node:fs";
import type { ObserverEvent } from "../s0/events.ts";

const WORKSPACE =
  "/mnt/zfs-host/backup/projects/observer-vault/01-Projects/observer-native";
const EVENTS_PATH = `${WORKSPACE}/tmp/events.ndjson`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StopContext {
  sessionId: string;
  events: ObserverEvent[];
  stopEvent: any;
  startedAt: string;
  endedAt: string;
  workingDirectory: string;
}

export type StopHandler = (
  events: ObserverEvent[],
  context: StopContext,
) => Promise<void>;

// ---------------------------------------------------------------------------
// Stdin reading (200ms timeout, same pattern as adapter.ts)
// ---------------------------------------------------------------------------

async function readStdin(): Promise<string> {
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
  return raw;
}

// ---------------------------------------------------------------------------
// Event reading (same pattern as old session-end-hook.ts)
// ---------------------------------------------------------------------------

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

function readSessionEvents(sessionId: string): ObserverEvent[] {
  if (!existsSync(EVENTS_PATH)) return [];

  const raw = readFileSync(EVENTS_PATH, "utf-8");
  const events: ObserverEvent[] = [];

  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line) as ObserverEvent;
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

// ---------------------------------------------------------------------------
// Handler registry
// ---------------------------------------------------------------------------

import { handleSessionCapture } from "./handlers/session-capture.ts";
import { handleTensionUpdate } from "./handlers/tension-update.ts";
import { handleEventCleanup } from "./handlers/event-cleanup.ts";
import { updateBacklog } from "./handlers/backlog-update.ts";

const handlers: StopHandler[] = [
  handleSessionCapture,
  handleTensionUpdate,
  updateBacklog,
  handleEventCleanup,  // cleanup last — after all readers are done
];

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export async function runStopOrchestrator(): Promise<void> {
  // Read stdin ONCE
  const raw = await readStdin();
  if (!raw.trim()) return;

  const stopEvent = JSON.parse(raw.trim());
  const sessionId: string = stopEvent.session_id ?? "unknown";

  // Read all events for this session
  const events = readSessionEvents(sessionId);

  // Build context
  const now = new Date().toISOString();
  const startEvent = events.find((e) => e.type === "ObserverSessionStart");
  const stopEvt = events.find((e) => e.type === "ObserverSessionStop");

  const context: StopContext = {
    sessionId,
    events,
    stopEvent,
    startedAt:
      startEvent?.type === "ObserverSessionStart"
        ? startEvent.timestamp
        : now,
    endedAt:
      stopEvt?.type === "ObserverSessionStop" ? stopEvt.timestamp : now,
    workingDirectory:
      startEvent?.type === "ObserverSessionStart"
        ? startEvent.workingDirectory
        : process.cwd(),
  };

  // Delegate to all handlers — fail-silent isolation via Promise.allSettled
  await Promise.allSettled(
    handlers.map(async (handler) => {
      try {
        await handler(events, context);
      } catch {
        // Fail-silent: no handler failure propagates
      }
    }),
  );
}
