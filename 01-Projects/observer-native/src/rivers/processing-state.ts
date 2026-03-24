/**
 * R3 — Processing Record State Machine
 *
 * Record-level state machine, orthogonal to the runtime state machine.
 * Governs a PairedRecord's lifecycle within the Processing river.
 *
 * ISC-R17: Explicit, logged state transitions.
 * ISC-R18: No record in undefined state.
 * ISC-R19: Failed transitions produce error records.
 */

// ---------------------------------------------------------------------------
// Record Processing States
// ---------------------------------------------------------------------------

export type RecordProcessingState =
  | 'RAW'
  | 'TIER_A_SCORED'
  | 'TIER_B_SCORED'
  | 'BUFFER_HELD'
  | 'TIER_C_EVALUATED'
  | 'STORED'
  | 'GOVERNANCE_QUEUED'
  | 'PROMOTED'
  | 'HELD'
  | 'REJECTED';

// ---------------------------------------------------------------------------
// Legal Transitions
// ---------------------------------------------------------------------------

const RECORD_TRANSITIONS: ReadonlyMap<RecordProcessingState, ReadonlySet<RecordProcessingState>> = new Map([
  ['RAW', new Set<RecordProcessingState>(['TIER_A_SCORED', 'REJECTED'])],
  ['TIER_A_SCORED', new Set<RecordProcessingState>(['TIER_B_SCORED', 'BUFFER_HELD', 'REJECTED'])],
  ['TIER_B_SCORED', new Set<RecordProcessingState>(['BUFFER_HELD', 'TIER_C_EVALUATED', 'REJECTED'])],
  ['BUFFER_HELD', new Set<RecordProcessingState>(['TIER_C_EVALUATED', 'STORED', 'REJECTED'])],
  ['TIER_C_EVALUATED', new Set<RecordProcessingState>(['STORED', 'GOVERNANCE_QUEUED', 'REJECTED'])],
  ['STORED', new Set<RecordProcessingState>(['GOVERNANCE_QUEUED'])],
  ['GOVERNANCE_QUEUED', new Set<RecordProcessingState>(['PROMOTED', 'HELD', 'REJECTED'])],
  ['PROMOTED', new Set<RecordProcessingState>([])],
  ['HELD', new Set<RecordProcessingState>(['GOVERNANCE_QUEUED', 'REJECTED'])],
  ['REJECTED', new Set<RecordProcessingState>([])],
]);

// ---------------------------------------------------------------------------
// Transition Log Entry
// ---------------------------------------------------------------------------

export interface RecordTransitionLog {
  readonly recordId: string;
  readonly from: RecordProcessingState;
  readonly to: RecordProcessingState;
  readonly timestamp: string;
  readonly reason: string;
  readonly success: boolean;
  readonly error?: string;
}

// ---------------------------------------------------------------------------
// Record State Tracker
// ---------------------------------------------------------------------------

export class RecordStateTracker {
  private readonly states: Map<string, RecordProcessingState> = new Map();
  private readonly log: RecordTransitionLog[] = [];

  /** Set initial state for a record. ISC-R18. */
  initialize(recordId: string, state: RecordProcessingState = 'RAW'): void {
    this.states.set(recordId, state);
    this.log.push({
      recordId,
      from: state,
      to: state,
      timestamp: new Date().toISOString(),
      reason: 'initialized',
      success: true,
    });
  }

  /** Get current state. ISC-R20. */
  getState(recordId: string): RecordProcessingState | undefined {
    return this.states.get(recordId);
  }

  /**
   * Attempt a state transition. ISC-R17, ISC-R19.
   * Returns true on success, false on failure (with error logged).
   */
  transition(recordId: string, to: RecordProcessingState, reason: string): boolean {
    const from = this.states.get(recordId);
    if (from === undefined) {
      this.log.push({
        recordId,
        from: 'RAW',
        to,
        timestamp: new Date().toISOString(),
        reason,
        success: false,
        error: `Record ${recordId} not found in state tracker`,
      });
      return false;
    }

    const allowed = RECORD_TRANSITIONS.get(from);
    if (!allowed || !allowed.has(to)) {
      // ISC-R19: Failed transitions produce error records
      this.log.push({
        recordId,
        from,
        to,
        timestamp: new Date().toISOString(),
        reason,
        success: false,
        error: `Illegal record transition: ${from} → ${to}`,
      });
      return false;
    }

    // Commit transition
    this.states.set(recordId, to);
    this.log.push({
      recordId,
      from,
      to,
      timestamp: new Date().toISOString(),
      reason,
      success: true,
    });
    return true;
  }

  /** ISC-R20: State distribution query. */
  stateDistribution(): Record<string, number> {
    const dist: Record<string, number> = {};
    for (const state of this.states.values()) {
      dist[state] = (dist[state] ?? 0) + 1;
    }
    return dist;
  }

  /** Get transition log (for metrics). */
  getLog(): readonly RecordTransitionLog[] {
    return this.log;
  }

  /** Count errors (ISC-R24). */
  errorCount(): number {
    return this.log.filter((e) => !e.success).length;
  }

  /** Total transition count (ISC-R24). */
  transitionCount(): number {
    return this.log.filter((e) => e.success && e.from !== e.to).length;
  }

  /** ISC-R18: Invariant check — no record in undefined state. */
  invariantCheck(): boolean {
    for (const [recordId, state] of this.states) {
      if (!RECORD_TRANSITIONS.has(state)) return false;
    }
    return true;
  }
}

export { RECORD_TRANSITIONS };
