// S7: Status Aggregator — derives overall server health from component states
// Pure function, no side effects, easily testable.

import type { BackendHealthState } from "@observer/shared";

/**
 * Aggregate individual component statuses into an overall server status.
 *
 * Rules (from TDS v2 Section 4.7):
 *   - "healthy"   — all components healthy
 *   - "degraded"  — any backend is degraded / rate_limited / unavailable
 *   - "unhealthy" — any critical component fails (audit subsystem)
 *
 * Disabled backends are excluded from aggregation (they are intentionally off).
 */
export function aggregateServerStatus(
  backends: Record<string, { status: BackendHealthState }>,
  auditStatus: "healthy" | "error",
): "healthy" | "degraded" | "unhealthy" {
  // Critical: audit failure is always unhealthy — audit writes block requests
  if (auditStatus === "error") {
    return "unhealthy";
  }

  // Check enabled backends only (disabled = intentionally off, not a problem)
  const degradedStates: BackendHealthState[] = [
    "degraded",
    "rate_limited",
    "unavailable",
  ];

  for (const backend of Object.values(backends)) {
    if (backend.status === "disabled") continue;
    if (degradedStates.includes(backend.status)) {
      return "degraded";
    }
  }

  return "healthy";
}

/**
 * Detect a transition between two statuses.
 * Returns true when old and new differ, meaning a HealthChange event should fire.
 */
export function detectTransition(
  oldStatus: string,
  newStatus: string,
): boolean {
  return oldStatus !== newStatus;
}
