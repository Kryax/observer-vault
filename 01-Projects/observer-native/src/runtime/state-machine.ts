/**
 * P2 — Runtime State Machine + Transition Executor
 *
 * Implements the full transition table from the design memo.
 * Illegal transitions throw IllegalRuntimeTransitionError.
 * Every committed transition produces a TransitionReceipt.
 */

import type {
  RuntimeState,
  RuntimeEvent,
  TransitionGuard,
  TransitionGuardResult,
  TransitionReceipt,
  QueueSnapshot,
  HaltReason,
} from './state-types.ts';

// ---------------------------------------------------------------------------
// Error Types
// ---------------------------------------------------------------------------

export class IllegalRuntimeTransitionError extends Error {
  constructor(
    public readonly from: RuntimeState,
    public readonly to: RuntimeState,
  ) {
    super(`Illegal runtime transition: ${from} → ${to}`);
    this.name = 'IllegalRuntimeTransitionError';
  }
}

// ---------------------------------------------------------------------------
// Transition Table — all legal transitions
// ---------------------------------------------------------------------------

const TRANSITION_TABLE: ReadonlyMap<RuntimeState, ReadonlySet<RuntimeState>> = new Map([
  ["IDLE", new Set<RuntimeState>(["INTAKE"])],
  ["INTAKE", new Set<RuntimeState>(["SYNTHESIS", "HUMAN_REVIEW", "HALTED", "FAILED"])],
  ["SYNTHESIS", new Set<RuntimeState>(["REFLECTION", "HUMAN_REVIEW", "HALTED", "FAILED"])],
  ["REFLECTION", new Set<RuntimeState>(["COMPLETE", "HUMAN_REVIEW", "HALTED", "FAILED"])],
  ["HUMAN_REVIEW", new Set<RuntimeState>(["INTAKE", "SYNTHESIS", "HALTED", "FAILED", "COMPLETE"])],
  ["HALTED", new Set<RuntimeState>(["INTAKE", "HUMAN_REVIEW", "FAILED"])],
  ["FAILED", new Set<RuntimeState>(["INTAKE", "COMPLETE"])],
  ["COMPLETE", new Set<RuntimeState>(["IDLE"])],
]);

// States that require HALTED on crash recovery (ISC-P54)
const CRASH_RECOVERY_HALT_STATES: ReadonlySet<RuntimeState> = new Set([
  "SYNTHESIS",
  "REFLECTION",
]);

// ---------------------------------------------------------------------------
// State Machine
// ---------------------------------------------------------------------------

export class RuntimeStateMachine {
  private _state: RuntimeState;
  private _guards: TransitionGuard[] = [];
  private _onTransition: ((receipt: TransitionReceipt) => void) | null = null;

  constructor(initialState: RuntimeState = "IDLE") {
    this._state = initialState;
  }

  /** Current state (synchronous, no side effects). ISC-P15. */
  get state(): RuntimeState {
    return this._state;
  }

  /** Register a transition guard. */
  addGuard(guard: TransitionGuard): void {
    this._guards.push(guard);
  }

  /** Register a transition callback (for ledger integration). */
  onTransition(callback: (receipt: TransitionReceipt) => void): void {
    this._onTransition = callback;
  }

  /**
   * Check if a transition is legal (in the table).
   */
  isLegalTransition(from: RuntimeState, to: RuntimeState): boolean {
    if (from === to) return false; // No self-transitions (ISC-P10)
    const allowed = TRANSITION_TABLE.get(from);
    return allowed !== undefined && allowed.has(to);
  }

  /**
   * Attempt a state transition. Evaluates guards, commits if all pass.
   * Returns the TransitionReceipt on success.
   * Throws IllegalRuntimeTransitionError for illegal transitions.
   */
  transition(
    to: RuntimeState,
    event: RuntimeEvent,
    queueSnapshots: readonly QueueSnapshot[] = [],
    policyVersion: string = "",
  ): TransitionReceipt {
    const from = this._state;

    // ISC-P09: Reject illegal transitions
    if (!this.isLegalTransition(from, to)) {
      throw new IllegalRuntimeTransitionError(from, to);
    }

    // ISC-P12: Evaluate guards with current state, proposed state, and event
    const guardResults: TransitionGuardResult[] = this._guards.map(
      (guard) => guard(from, to, event),
    );

    // If any guard disallows, throw
    const blocked = guardResults.find((r) => !r.allowed);
    if (blocked) {
      throw new Error(
        `Transition ${from} → ${to} blocked by guard "${blocked.guardId}": ${blocked.reason}`,
      );
    }

    // Commit transition
    this._state = to;

    // ISC-P11: Produce TransitionReceipt
    const receipt: TransitionReceipt = {
      id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      priorState: from,
      nextState: to,
      actor: event.actor,
      timestamp: new Date().toISOString(),
      guardResults,
      policyVersion,
      queueSnapshot: queueSnapshots,
      event,
    };

    // Notify ledger
    if (this._onTransition) {
      this._onTransition(receipt);
    }

    return receipt;
  }

  /**
   * Re-initialise from a transition ledger receipt (crash recovery).
   * ISC-P53: Recovers last committed state.
   * ISC-P54: SYNTHESIS/REFLECTION → HALTED on recovery.
   */
  recoverFromReceipt(lastReceipt: TransitionReceipt): TransitionReceipt | null {
    const recoveredState = lastReceipt.nextState;

    // ISC-P54: Active work states transition to HALTED
    if (CRASH_RECOVERY_HALT_STATES.has(recoveredState)) {
      this._state = "HALTED";

      const recoveryReceipt: TransitionReceipt = {
        id: `tr-recovery-${Date.now()}`,
        priorState: recoveredState,
        nextState: "HALTED",
        actor: "system:crash-recovery",
        timestamp: new Date().toISOString(),
        guardResults: [],
        policyVersion: lastReceipt.policyVersion,
        queueSnapshot: [],
        event: {
          type: "RECOVERY",
          actor: "system:crash-recovery",
          timestamp: new Date().toISOString(),
          payload: { recoveredFrom: recoveredState },
        },
        haltReason: "crash_recovery_active_work",
      };

      if (this._onTransition) {
        this._onTransition(recoveryReceipt);
      }

      return recoveryReceipt;
    }

    // For HUMAN_REVIEW, HALTED, COMPLETE — stay in that state
    this._state = recoveredState;

    // For COMPLETE, proceed to IDLE normally
    if (recoveredState === "COMPLETE") {
      this._state = recoveredState;
    }

    return null;
  }

  /**
   * Get all legal transitions from current state.
   */
  legalTransitions(): readonly RuntimeState[] {
    const allowed = TRANSITION_TABLE.get(this._state);
    return allowed ? [...allowed] : [];
  }
}

/** Export the transition table for testing. */
export { TRANSITION_TABLE };
