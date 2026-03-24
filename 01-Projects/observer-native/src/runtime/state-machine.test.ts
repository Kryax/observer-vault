/**
 * P2 Tests — State Machine + Transition Ledger
 * ISC-P08 through ISC-P15, ISC-P53, ISC-P54, ISC-P55
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  RuntimeStateMachine,
  IllegalRuntimeTransitionError,
  TRANSITION_TABLE,
} from './state-machine.ts';
import { TransitionLedger } from './transition-ledger.ts';
import type { RuntimeState, RuntimeEvent, TransitionReceipt } from './state-types.ts';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(type: string = 'test', actor: string = 'test-actor'): RuntimeEvent {
  return { type, actor, timestamp: new Date().toISOString(), payload: {} };
}

const ALL_STATES: RuntimeState[] = [
  'IDLE', 'INTAKE', 'SYNTHESIS', 'REFLECTION',
  'HUMAN_REVIEW', 'HALTED', 'FAILED', 'COMPLETE',
];

// ---------------------------------------------------------------------------
// ISC-P08: All legal transitions are executable
// ---------------------------------------------------------------------------

describe('ISC-P08: Legal transitions', () => {
  for (const [from, toSet] of TRANSITION_TABLE) {
    for (const to of toSet) {
      test(`${from} → ${to} is executable`, () => {
        const sm = new RuntimeStateMachine(from);
        const receipt = sm.transition(to, makeEvent());
        expect(receipt.priorState).toBe(from);
        expect(receipt.nextState).toBe(to);
        expect(sm.state).toBe(to);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// ISC-P09: Illegal transitions throw
// ---------------------------------------------------------------------------

describe('ISC-P09: Illegal transitions', () => {
  const illegalPairs: [RuntimeState, RuntimeState][] = [
    ['IDLE', 'COMPLETE'],
    ['IDLE', 'SYNTHESIS'],
    ['IDLE', 'REFLECTION'],
    ['IDLE', 'HUMAN_REVIEW'],
    ['IDLE', 'HALTED'],
    ['IDLE', 'FAILED'],
    ['SYNTHESIS', 'COMPLETE'],
    ['SYNTHESIS', 'INTAKE'],
    ['HALTED', 'COMPLETE'],
    ['HALTED', 'SYNTHESIS'],
    ['HALTED', 'REFLECTION'],
    ['FAILED', 'SYNTHESIS'],
    ['FAILED', 'REFLECTION'],
    ['FAILED', 'HUMAN_REVIEW'],
    ['FAILED', 'HALTED'],
    ['COMPLETE', 'INTAKE'],
    ['COMPLETE', 'SYNTHESIS'],
    ['COMPLETE', 'HALTED'],
    ['COMPLETE', 'FAILED'],
    ['REFLECTION', 'INTAKE'],
    ['REFLECTION', 'SYNTHESIS'],
  ];

  for (const [from, to] of illegalPairs) {
    test(`${from} → ${to} throws IllegalRuntimeTransitionError`, () => {
      const sm = new RuntimeStateMachine(from);
      expect(() => sm.transition(to, makeEvent())).toThrow(IllegalRuntimeTransitionError);
    });
  }
});

// ---------------------------------------------------------------------------
// ISC-P10: No self-transitions
// ---------------------------------------------------------------------------

describe('ISC-P10: No self-transitions', () => {
  for (const state of ALL_STATES) {
    test(`${state} → ${state} is illegal`, () => {
      const sm = new RuntimeStateMachine(state);
      expect(() => sm.transition(state, makeEvent())).toThrow(IllegalRuntimeTransitionError);
    });
  }
});

// ---------------------------------------------------------------------------
// ISC-P11: Every committed transition produces a receipt
// ---------------------------------------------------------------------------

describe('ISC-P11: Transition receipts', () => {
  test('receipt is produced on every transition', () => {
    const sm = new RuntimeStateMachine('IDLE');
    const receipts: TransitionReceipt[] = [];
    sm.onTransition((r) => receipts.push(r));

    sm.transition('INTAKE', makeEvent());
    sm.transition('SYNTHESIS', makeEvent());
    sm.transition('REFLECTION', makeEvent());

    expect(receipts.length).toBe(3);
    expect(receipts[0].priorState).toBe('IDLE');
    expect(receipts[0].nextState).toBe('INTAKE');
    expect(receipts[2].nextState).toBe('REFLECTION');
  });
});

// ---------------------------------------------------------------------------
// ISC-P12: Guards receive correct arguments
// ---------------------------------------------------------------------------

describe('ISC-P12: Guard arguments', () => {
  test('guard receives current state, proposed state, and event', () => {
    const sm = new RuntimeStateMachine('IDLE');
    let capturedArgs: { current: RuntimeState; proposed: RuntimeState; event: RuntimeEvent } | null = null;

    sm.addGuard((current, proposed, event) => {
      capturedArgs = { current, proposed, event };
      return { allowed: true, guardId: 'test-guard', reason: '' };
    });

    const event = makeEvent('intake-start');
    sm.transition('INTAKE', event);

    expect(capturedArgs).not.toBeNull();
    expect(capturedArgs!.current).toBe('IDLE');
    expect(capturedArgs!.proposed).toBe('INTAKE');
    expect(capturedArgs!.event.type).toBe('intake-start');
  });

  test('blocked guard prevents transition', () => {
    const sm = new RuntimeStateMachine('IDLE');
    sm.addGuard(() => ({
      allowed: false,
      guardId: 'blocking-guard',
      reason: 'Test block',
    }));

    expect(() => sm.transition('INTAKE', makeEvent())).toThrow('blocked by guard');
  });
});

// ---------------------------------------------------------------------------
// ISC-P15: Current state query
// ---------------------------------------------------------------------------

describe('ISC-P15: State query', () => {
  test('state is synchronous with no side effects', () => {
    const sm = new RuntimeStateMachine('IDLE');
    expect(sm.state).toBe('IDLE');
    sm.transition('INTAKE', makeEvent());
    expect(sm.state).toBe('INTAKE');
  });
});

// ---------------------------------------------------------------------------
// ISC-P53: Crash recovery from ledger
// ---------------------------------------------------------------------------

describe('ISC-P53: Crash recovery', () => {
  test('recovery from COMPLETE state — stays in COMPLETE', () => {
    const sm = new RuntimeStateMachine();
    const receipt: TransitionReceipt = {
      id: 'tr-1',
      priorState: 'REFLECTION',
      nextState: 'COMPLETE',
      actor: 'test',
      timestamp: new Date().toISOString(),
      guardResults: [],
      policyVersion: 'v1',
      queueSnapshot: [],
      event: makeEvent(),
    };

    sm.recoverFromReceipt(receipt);
    expect(sm.state).toBe('COMPLETE');
  });

  test('recovery from HUMAN_REVIEW — stays in HUMAN_REVIEW', () => {
    const sm = new RuntimeStateMachine();
    const receipt: TransitionReceipt = {
      id: 'tr-1',
      priorState: 'INTAKE',
      nextState: 'HUMAN_REVIEW',
      actor: 'test',
      timestamp: new Date().toISOString(),
      guardResults: [],
      policyVersion: 'v1',
      queueSnapshot: [],
      event: makeEvent(),
    };

    sm.recoverFromReceipt(receipt);
    expect(sm.state).toBe('HUMAN_REVIEW');
  });
});

// ---------------------------------------------------------------------------
// ISC-P54: SYNTHESIS/REFLECTION → HALTED on crash recovery
// ---------------------------------------------------------------------------

describe('ISC-P54: Active work crash recovery', () => {
  test('SYNTHESIS recovery → HALTED', () => {
    const sm = new RuntimeStateMachine();
    const recoveryReceipt = sm.recoverFromReceipt({
      id: 'tr-crash',
      priorState: 'INTAKE',
      nextState: 'SYNTHESIS',
      actor: 'test',
      timestamp: new Date().toISOString(),
      guardResults: [],
      policyVersion: 'v1',
      queueSnapshot: [],
      event: makeEvent(),
    });

    expect(sm.state).toBe('HALTED');
    expect(recoveryReceipt).not.toBeNull();
    expect(recoveryReceipt!.haltReason).toBe('crash_recovery_active_work');
  });

  test('REFLECTION recovery → HALTED', () => {
    const sm = new RuntimeStateMachine();
    const recoveryReceipt = sm.recoverFromReceipt({
      id: 'tr-crash',
      priorState: 'SYNTHESIS',
      nextState: 'REFLECTION',
      actor: 'test',
      timestamp: new Date().toISOString(),
      guardResults: [],
      policyVersion: 'v1',
      queueSnapshot: [],
      event: makeEvent(),
    });

    expect(sm.state).toBe('HALTED');
    expect(recoveryReceipt!.nextState).toBe('HALTED');
  });
});

// ---------------------------------------------------------------------------
// Transition Ledger Tests (ISC-P13, ISC-P14, ISC-P55)
// ---------------------------------------------------------------------------

const TEST_WORKSPACE = '/tmp/observer-native-test-ledger';

describe('TransitionLedger', () => {
  beforeEach(() => {
    rmSync(TEST_WORKSPACE, { recursive: true, force: true });
    mkdirSync(TEST_WORKSPACE, { recursive: true });
  });

  test('ISC-P13: Append-only — readAll returns appended receipts', () => {
    const ledger = new TransitionLedger(TEST_WORKSPACE);
    const receipt1: TransitionReceipt = {
      id: 'tr-1', priorState: 'IDLE', nextState: 'INTAKE',
      actor: 'test', timestamp: new Date().toISOString(),
      guardResults: [], policyVersion: 'v1', queueSnapshot: [],
      event: makeEvent(),
    };
    const receipt2: TransitionReceipt = {
      ...receipt1, id: 'tr-2', priorState: 'INTAKE', nextState: 'SYNTHESIS',
    };

    ledger.append(receipt1);
    ledger.append(receipt2);

    const all = ledger.readAll();
    expect(all.length).toBe(2);
    expect(all[0].id).toBe('tr-1');
    expect(all[1].id).toBe('tr-2');
  });

  test('ISC-P14: NDJSON format', () => {
    const ledger = new TransitionLedger(TEST_WORKSPACE);
    ledger.append({
      id: 'tr-1', priorState: 'IDLE', nextState: 'INTAKE',
      actor: 'test', timestamp: '2026-03-24T00:00:00Z',
      guardResults: [], policyVersion: 'v1', queueSnapshot: [],
      event: makeEvent(),
    });

    const raw = readFileSync(ledger.getHotPath(), 'utf-8');
    const lines = raw.split('\n').filter((l) => l.trim());
    expect(lines.length).toBe(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.id).toBe('tr-1');
  });

  test('ISC-P53: lastReceipt returns the final receipt', () => {
    const ledger = new TransitionLedger(TEST_WORKSPACE);
    ledger.append({
      id: 'tr-1', priorState: 'IDLE', nextState: 'INTAKE',
      actor: 'test', timestamp: '2026-03-24T00:00:00Z',
      guardResults: [], policyVersion: 'v1', queueSnapshot: [],
      event: makeEvent(),
    });
    ledger.append({
      id: 'tr-2', priorState: 'INTAKE', nextState: 'SYNTHESIS',
      actor: 'test', timestamp: '2026-03-24T00:00:01Z',
      guardResults: [], policyVersion: 'v1', queueSnapshot: [],
      event: makeEvent(),
    });

    expect(ledger.lastReceipt()?.id).toBe('tr-2');
  });

  test('ISC-P55: Compaction copies to daily dir and truncates', () => {
    const ledger = new TransitionLedger(TEST_WORKSPACE);
    ledger.append({
      id: 'tr-1', priorState: 'IDLE', nextState: 'INTAKE',
      actor: 'test', timestamp: '2026-03-24T00:00:00Z',
      guardResults: [], policyVersion: 'v1', queueSnapshot: [],
      event: makeEvent(),
    });

    const targetPath = ledger.compact('session-001');
    expect(existsSync(targetPath)).toBe(true);

    // Hot file should be empty after compaction
    expect(ledger.hasHotFile()).toBe(false);

    // Target file should contain the receipt
    const compacted = JSON.parse(readFileSync(targetPath, 'utf-8'));
    expect(compacted.length).toBe(1);
    expect(compacted[0].id).toBe('tr-1');
  });
});

// ---------------------------------------------------------------------------
// Integration: State Machine + Ledger
// ---------------------------------------------------------------------------

describe('State Machine + Ledger integration', () => {
  beforeEach(() => {
    rmSync(TEST_WORKSPACE, { recursive: true, force: true });
    mkdirSync(TEST_WORKSPACE, { recursive: true });
  });

  test('ISC-P11+P14: Transitions produce receipts in NDJSON ledger', () => {
    const sm = new RuntimeStateMachine();
    const ledger = new TransitionLedger(TEST_WORKSPACE);
    sm.onTransition((receipt) => ledger.append(receipt));

    sm.transition('INTAKE', makeEvent('start'));
    sm.transition('SYNTHESIS', makeEvent('process'));
    sm.transition('REFLECTION', makeEvent('reflect'));
    sm.transition('COMPLETE', makeEvent('done'));

    const receipts = ledger.readAll();
    expect(receipts.length).toBe(4);
    expect(receipts.map((r) => r.nextState)).toEqual([
      'INTAKE', 'SYNTHESIS', 'REFLECTION', 'COMPLETE',
    ]);
  });

  test('ISC-P53+P54: Full crash recovery cycle', () => {
    // Simulate session that crashes during SYNTHESIS
    const ledger = new TransitionLedger(TEST_WORKSPACE);
    const sm1 = new RuntimeStateMachine();
    sm1.onTransition((r) => ledger.append(r));

    sm1.transition('INTAKE', makeEvent());
    sm1.transition('SYNTHESIS', makeEvent());
    // crash here — sm1 is gone

    // Recovery: new state machine reads from ledger
    const sm2 = new RuntimeStateMachine();
    sm2.onTransition((r) => ledger.append(r));
    const lastReceipt = ledger.lastReceipt();
    expect(lastReceipt).not.toBeNull();
    expect(lastReceipt!.nextState).toBe('SYNTHESIS');

    const recoveryReceipt = sm2.recoverFromReceipt(lastReceipt!);
    expect(sm2.state).toBe('HALTED');
    expect(recoveryReceipt).not.toBeNull();
    expect(recoveryReceipt!.haltReason).toBe('crash_recovery_active_work');
  });
});
