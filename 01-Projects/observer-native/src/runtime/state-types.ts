/**
 * Runtime State Machine Types — Pillar 2 (Explicit State Machine Backbone)
 *
 * Defines the 8 runtime states, events, transition guards, halt reasons,
 * and the TransitionReceipt that forms the audit trail.
 */

// ---------------------------------------------------------------------------
// Runtime States (8 states per design memo §Pillar 2)
// ---------------------------------------------------------------------------

export type RuntimeState =
  | "IDLE"
  | "INTAKE"
  | "SYNTHESIS"
  | "REFLECTION"
  | "HUMAN_REVIEW"
  | "HALTED"
  | "FAILED"
  | "COMPLETE";

// ---------------------------------------------------------------------------
// Events that drive transitions
// ---------------------------------------------------------------------------

export interface RuntimeEvent {
  readonly type: string;
  readonly actor: string;
  readonly timestamp: string;
  readonly payload: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Transition Guards
// ---------------------------------------------------------------------------

export interface TransitionGuardResult {
  readonly allowed: boolean;
  readonly guardId: string;
  readonly reason: string;
}

export type TransitionGuard = (
  current: RuntimeState,
  proposed: RuntimeState,
  event: RuntimeEvent,
) => TransitionGuardResult;

// ---------------------------------------------------------------------------
// Halt Reasons
// ---------------------------------------------------------------------------

export type HaltReason =
  | "governance_queue_overflow"
  | "critical_receipt_loss"
  | "illegal_transition_attempted"
  | "crash_recovery_active_work"
  | "manual_halt";

// ---------------------------------------------------------------------------
// Queue Snapshot (embedded in TransitionReceipt for observability)
// ---------------------------------------------------------------------------

export interface QueueSnapshot {
  readonly name: string;
  readonly depth: number;
  readonly capacity: number;
  readonly softThreshold: number;
  readonly hardThreshold: number;
}

// ---------------------------------------------------------------------------
// TransitionReceipt — the atomic audit record
// ---------------------------------------------------------------------------

export interface TransitionReceipt {
  readonly id: string;
  readonly priorState: RuntimeState;
  readonly nextState: RuntimeState;
  readonly actor: string;
  readonly timestamp: string;
  readonly guardResults: readonly TransitionGuardResult[];
  readonly policyVersion: string;
  readonly queueSnapshot: readonly QueueSnapshot[];
  readonly event: RuntimeEvent;
  readonly haltReason?: HaltReason;
}
