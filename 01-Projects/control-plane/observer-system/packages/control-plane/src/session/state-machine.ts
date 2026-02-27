// S1: Thread state machine — validates status transitions
// Enforces the directed graph of allowed ThreadStatus changes.
// Invalid transitions throw; the caller never needs to guess.

import type { ThreadStatus } from "@observer/shared";
import { ObserverErrorCode, createError } from "@observer/shared";

/**
 * Adjacency list defining every legal transition.
 *
 * Key   = current status
 * Value = set of statuses reachable from current
 *
 * Special rules:
 *   - "cancelled" is reachable from ANY status (user can always cancel)
 *   - "interrupted" is reachable from processing | executing | awaiting_approval
 *     (startup recovery — daemon restarts while work is in-flight)
 *   - Terminal states (completed, failed, cancelled, interrupted) have no outbound edges
 */
const TRANSITIONS: ReadonlyMap<ThreadStatus, ReadonlySet<ThreadStatus>> =
  new Map<ThreadStatus, ReadonlySet<ThreadStatus>>([
    ["open", new Set(["processing", "cancelled"])],
    ["processing", new Set(["awaiting_approval", "executing", "interrupted", "cancelled"])],
    ["awaiting_approval", new Set(["executing", "interrupted", "cancelled"])],
    ["executing", new Set(["completed", "failed", "interrupted", "cancelled"])],
    // Terminal states — only "cancelled" is allowed (and that is already
    // folded into the universal rule below), but we list them explicitly
    // so the map covers every status.
    ["completed", new Set(["cancelled"])],
    ["failed", new Set(["cancelled"])],
    ["cancelled", new Set<ThreadStatus>()],
    ["interrupted", new Set(["cancelled"])],
  ]);

/**
 * Return true if `from -> to` is a legal thread-status transition.
 */
export function isValidTransition(
  from: ThreadStatus,
  to: ThreadStatus,
): boolean {
  const allowed = TRANSITIONS.get(from);
  if (!allowed) return false;
  return allowed.has(to);
}

/**
 * Assert that `from -> to` is legal; throw a structured JSON-RPC error
 * if it is not.
 *
 * @throws JsonRpcError with code InvalidParams (-32602)
 */
export function assertTransition(
  from: ThreadStatus,
  to: ThreadStatus,
  threadId: string,
): void {
  if (!isValidTransition(from, to)) {
    throw createError(
      ObserverErrorCode.InvalidParams,
      `Invalid thread transition: ${from} -> ${to} for thread ${threadId}`,
      {
        type: "validation_failed",
        field: "status",
        message: `Cannot transition thread from "${from}" to "${to}"`,
      },
    );
  }
}

/**
 * Returns the set of statuses reachable from the given status.
 * Useful for API responses that tell the caller what they can do next.
 */
export function validNextStatuses(from: ThreadStatus): ThreadStatus[] {
  const allowed = TRANSITIONS.get(from);
  return allowed ? [...allowed] : [];
}

/**
 * Terminal statuses — threads in these states have finished all work.
 */
export const TERMINAL_STATUSES: ReadonlySet<ThreadStatus> = new Set([
  "completed",
  "failed",
  "cancelled",
  "interrupted",
]);

/**
 * Active statuses — threads that are currently doing something.
 * Sessions with threads in these statuses should NOT be cleaned up.
 */
export const ACTIVE_THREAD_STATUSES: ReadonlySet<ThreadStatus> = new Set([
  "processing",
  "executing",
  "awaiting_approval",
]);
