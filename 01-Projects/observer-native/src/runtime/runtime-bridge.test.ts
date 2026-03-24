/**
 * P7 Tests — Module Migration (Runtime Bridge)
 * ISC-P46 through ISC-P52
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { mkdirSync, rmSync } from 'node:fs';
import { RuntimeOrchestrator } from './runtime-orchestrator.ts';
import {
  translateAdapterEventToRuntime,
  processAdapterEvent,
  mapEscalationToActionClass,
  assertDeliberationState,
  createSessionCapturePluginManifest,
  createTensionTrackerPluginManifest,
  triggerSessionComplete,
} from './runtime-bridge.ts';
import { validateManifest } from './plugin-validator.ts';
import type { ObserverEvent } from '../s0/events.ts';

const TEST_WORKSPACE = '/tmp/observer-native-test-bridge';

describe('Runtime Bridge — Module Migration', () => {
  beforeEach(() => {
    rmSync(TEST_WORKSPACE, { recursive: true, force: true });
    mkdirSync(TEST_WORKSPACE, { recursive: true });
  });

  // ISC-P46: Adapter events route to INTAKE
  test('ISC-P46: adapter events transition to INTAKE and queue', () => {
    const orch = new RuntimeOrchestrator(TEST_WORKSPACE);

    const event: ObserverEvent = {
      type: 'ObserverSessionStart',
      sessionId: 'sess-001',
      timestamp: new Date().toISOString(),
      workingDirectory: '/tmp',
    };

    processAdapterEvent(orch, event);
    expect(orch.stateMachine.state).toBe('INTAKE');
    expect(orch.queues.ingestion.depth()).toBe(1);
  });

  // ISC-P47: Escalations produce SLOW_REQUIRED gates
  test('ISC-P47: escalation types map to governance action classes', () => {
    expect(mapEscalationToActionClass('TASK_FAILURE')).toBe('HUMAN_GATE_RESOLUTION');
    expect(mapEscalationToActionClass('PROCESS_QUALITY')).toBe('SOVEREIGNTY_DECISION');
    expect(mapEscalationToActionClass('ALGEBRA_REVIEW')).toBe('ALGEBRA_REVIEW');

    // All three should classify as SLOW_REQUIRED
    const orch = new RuntimeOrchestrator(TEST_WORKSPACE);
    const gov = orch.governance;
    expect(gov.classify('HUMAN_GATE_RESOLUTION').speed).toBe('SLOW_REQUIRED');
    expect(gov.classify('SOVEREIGNTY_DECISION').speed).toBe('SLOW_REQUIRED');
    expect(gov.classify('ALGEBRA_REVIEW').speed).toBe('SLOW_REQUIRED');
  });

  // ISC-P48: Deliberation only in SYNTHESIS/REFLECTION
  test('ISC-P48: deliberation rejected outside SYNTHESIS/REFLECTION', () => {
    const orch = new RuntimeOrchestrator(TEST_WORKSPACE);
    // IDLE state
    expect(() => assertDeliberationState(orch)).toThrow('SYNTHESIS or REFLECTION');

    // INTAKE state
    orch.transition('INTAKE', { type: 'test', actor: 'test', timestamp: '', payload: {} });
    expect(() => assertDeliberationState(orch)).toThrow('SYNTHESIS or REFLECTION');
  });

  test('ISC-P48: deliberation allowed in SYNTHESIS', () => {
    const orch = new RuntimeOrchestrator(TEST_WORKSPACE);
    orch.transition('INTAKE', { type: 'test', actor: 'test', timestamp: '', payload: {} });
    orch.transition('SYNTHESIS', { type: 'test', actor: 'test', timestamp: '', payload: {} });
    expect(() => assertDeliberationState(orch)).not.toThrow();
  });

  // ISC-P49: Session capture plugin manifest
  test('ISC-P49: session capture plugin conforms to contract', () => {
    const manifest = createSessionCapturePluginManifest();
    expect(manifest.capabilities).toContain('observe_events');
    expect(manifest.capabilities).toContain('emit_receipts');
    expect(validateManifest(manifest).valid).toBe(true);
  });

  test('ISC-P49: tension tracker plugin conforms to contract', () => {
    const manifest = createTensionTrackerPluginManifest();
    expect(validateManifest(manifest).valid).toBe(true);
  });

  // ISC-P50: Stop orchestrator triggers COMPLETE
  test('ISC-P50: session complete transition and ledger flush', () => {
    const orch = new RuntimeOrchestrator(TEST_WORKSPACE);
    const event = { type: 'test', actor: 'test', timestamp: '', payload: {} };

    orch.transition('INTAKE', event);
    orch.transition('SYNTHESIS', event);
    orch.transition('REFLECTION', event);

    const result = triggerSessionComplete(orch, 'sess-001');
    expect(orch.stateMachine.state).toBe('IDLE');
    expect(result.compactedPath).not.toBeNull();
  });

  // ISC-P51: Existing tests still pass (verified by running full suite)
  // ISC-P52: No domain logic modified (verified by code review — bridge only)

  test('translateAdapterEventToRuntime preserves event data', () => {
    const event: ObserverEvent = {
      type: 'ObserverSessionStart',
      sessionId: 'sess-001',
      timestamp: '2026-03-24T00:00:00Z',
      workingDirectory: '/tmp',
    };

    const runtimeEvent = translateAdapterEventToRuntime(event);
    expect(runtimeEvent.type).toBe('ObserverSessionStart');
    expect(runtimeEvent.actor).toBe('s1-adapter');
    expect(runtimeEvent.timestamp).toBe('2026-03-24T00:00:00Z');
  });
});
