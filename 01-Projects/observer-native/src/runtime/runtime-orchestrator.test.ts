/**
 * P6 Tests — Runtime Orchestrator + Cross-Pillar Integration
 * ISC-P39 through ISC-P45
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { RuntimeOrchestrator } from './runtime-orchestrator.ts';
import { mkdirSync, rmSync } from 'node:fs';
import type { RuntimeEvent } from './state-types.ts';

const TEST_WORKSPACE = '/tmp/observer-native-test-orchestrator';

function makeEvent(type: string = 'test', actor: string = 'test-actor'): RuntimeEvent {
  return { type, actor, timestamp: new Date().toISOString(), payload: {} };
}

describe('Runtime Orchestrator', () => {
  beforeEach(() => {
    rmSync(TEST_WORKSPACE, { recursive: true, force: true });
    mkdirSync(TEST_WORKSPACE, { recursive: true });
  });

  // ISC-P39: Initialises all components
  test('ISC-P39: initialises state machine, governance, 5 queues, plugin registry', () => {
    const orch = new RuntimeOrchestrator(TEST_WORKSPACE);
    expect(orch.stateMachine.state).toBe('IDLE');
    expect(orch.governance.policyVersion).toBeTruthy();
    expect(orch.queues.ingestion.capacity()).toBe(128);
    expect(orch.queues.processing.capacity()).toBe(24);
    expect(orch.queues.governance.capacity()).toBe(10);
    expect(orch.queues.receipt.capacity()).toBe(256);
    expect(orch.queues.overflowSummary.capacity()).toBe(32);
    expect(orch.pluginRegistry.getActive().length).toBe(0);
  });

  // ISC-P40: DSG × ESMB — SLOW_REQUIRED blocks and redirects to HUMAN_REVIEW
  test('ISC-P40: SLOW_REQUIRED redirects to HUMAN_REVIEW', () => {
    const orch = new RuntimeOrchestrator(TEST_WORKSPACE);
    orch.transition('INTAKE', makeEvent('start'));

    // PLUGIN_REGISTRATION is SLOW_REQUIRED — should redirect to HUMAN_REVIEW
    const receipt = orch.transition('SYNTHESIS', makeEvent('register-plugin'), 'PLUGIN_REGISTRATION');
    expect(receipt.nextState).toBe('HUMAN_REVIEW');
  });

  // ISC-P43: BBWOP × DSG — governance queue overflow triggers HALTED
  test('ISC-P43: governance queue overflow triggers HALTED', () => {
    const orch = new RuntimeOrchestrator(TEST_WORKSPACE);
    orch.transition('INTAKE', makeEvent('start'));

    // Fill governance queue to hard limit
    for (let i = 0; i < 10; i++) {
      orch.queues.governance.accept({ gate: `gate-${i}` });
    }

    // One more should trigger HALTED via overflow handler
    orch.queues.governance.accept({ gate: 'overflow' });

    expect(orch.stateMachine.state).toBe('HALTED');
  });

  // ISC-P44: Health query
  test('ISC-P44: health query returns all required fields', () => {
    const orch = new RuntimeOrchestrator(TEST_WORKSPACE);
    const health = orch.health();

    expect(health.state).toBe('IDLE');
    expect(health.queueDepths.ingestion).toBeDefined();
    expect(health.queueDepths.processing).toBeDefined();
    expect(health.queueDepths.governance).toBeDefined();
    expect(health.queueDepths.receipt).toBeDefined();
    expect(health.queueDepths.overflowSummary).toBeDefined();
    expect(Array.isArray(health.activePlugins)).toBe(true);
    expect(health.policyVersion).toBeTruthy();
  });

  // ISC-P45: Full lifecycle
  test('ISC-P45: full lifecycle IDLE→INTAKE→SYNTHESIS→REFLECTION→COMPLETE→IDLE', () => {
    const orch = new RuntimeOrchestrator(TEST_WORKSPACE);

    const r1 = orch.transition('INTAKE', makeEvent('start'));
    expect(r1.priorState).toBe('IDLE');
    expect(r1.nextState).toBe('INTAKE');

    const r2 = orch.transition('SYNTHESIS', makeEvent('process'));
    expect(r2.nextState).toBe('SYNTHESIS');

    const r3 = orch.transition('REFLECTION', makeEvent('reflect'));
    expect(r3.nextState).toBe('REFLECTION');

    const r4 = orch.transition('COMPLETE', makeEvent('done'));
    expect(r4.nextState).toBe('COMPLETE');

    const r5 = orch.transition('IDLE', makeEvent('reset'));
    expect(r5.nextState).toBe('IDLE');

    // Verify all receipts are in ledger
    const receipts = orch.ledger.readAll();
    expect(receipts.length).toBe(5);
    expect(receipts.map((r) => r.nextState)).toEqual([
      'INTAKE', 'SYNTHESIS', 'REFLECTION', 'COMPLETE', 'IDLE',
    ]);
  });
});
