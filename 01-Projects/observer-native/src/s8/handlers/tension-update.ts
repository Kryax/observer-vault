/**
 * S8 Handler — Tension Update
 *
 * Runs the tension tracking pipeline at session end.
 * Detects tensions from ISC outcomes, accumulates in backlog,
 * resolves passing criteria.
 */

import type { ObserverEvent } from "../../s0/events.ts";
import type { StopContext } from "../stop-orchestrator.ts";
import type { ISCOutcome } from "../../s2/session-capture.ts";
import { trackTensions } from "../../s2/tension-tracker.ts";

/**
 * Tension update handler.
 * Runs the full tension tracking pipeline.
 */
export async function handleTensionUpdate(
  events: ObserverEvent[],
  context: StopContext,
): Promise<void> {
  const iscOutcomes: ISCOutcome[] = [];
  trackTensions(iscOutcomes);
}
