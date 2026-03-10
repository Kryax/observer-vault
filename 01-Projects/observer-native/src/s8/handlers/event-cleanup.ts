/**
 * S8 Handler — Event Cleanup
 *
 * After capture, truncates tmp/events.ndjson to empty.
 * Bounded buffer — prevents unbounded growth across sessions.
 * Only truncates if events were successfully read.
 */

import { writeFileSync } from "node:fs";
import type { ObserverEvent } from "../../s0/events.ts";
import type { StopContext } from "../stop-orchestrator.ts";

const WORKSPACE =
  "/mnt/zfs-host/backup/projects/observer-vault/01-Projects/observer-native";
const EVENTS_PATH = `${WORKSPACE}/tmp/events.ndjson`;

/**
 * Event cleanup handler.
 * Truncates events.ndjson after successful read.
 */
export async function handleEventCleanup(
  events: ObserverEvent[],
  context: StopContext,
): Promise<void> {
  // Only truncate if events were successfully read (array exists, even if empty)
  // The orchestrator already read events — if we got here, the read succeeded
  if (events !== undefined) {
    writeFileSync(EVENTS_PATH, "", "utf-8");
  }
}
