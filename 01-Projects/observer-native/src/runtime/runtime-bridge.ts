/**
 * P7 — Runtime Bridge (Module Migration)
 *
 * Wires existing s1, s2, s4, s7, s8 modules as runtime clients.
 * Domain logic unchanged — routing/wiring only.
 *
 * ISC-P46 through ISC-P52.
 */

import type { RuntimeOrchestrator } from './runtime-orchestrator.ts';
import type { RuntimeEvent } from './state-types.ts';
import type { ObserverEvent } from '../s0/events.ts';
import type { ObserverPluginManifest, PluginHook, PluginContext, PluginResult, ObserverPlugin } from './plugin-types.ts';

// ---------------------------------------------------------------------------
// ISC-P46: s1/adapter.ts — Emit normalized runtime intake events
// ---------------------------------------------------------------------------

/**
 * Translate an ObserverEvent from the s1 adapter into a RuntimeEvent
 * that the runtime orchestrator's INTAKE state can process.
 */
export function translateAdapterEventToRuntime(event: ObserverEvent): RuntimeEvent {
  return {
    type: event.type,
    actor: 's1-adapter',
    timestamp: 'timestamp' in event ? event.timestamp :
      'sessionContext' in event ? (event as { sessionContext: { timestamp: string } }).sessionContext.timestamp :
      new Date().toISOString(),
    payload: event as unknown as Record<string, unknown>,
  };
}

/**
 * Process an adapter event through the runtime orchestrator.
 * ISC-P46: Events route to the orchestrator's INTAKE state.
 */
export function processAdapterEvent(
  orchestrator: RuntimeOrchestrator,
  event: ObserverEvent,
): void {
  const runtimeEvent = translateAdapterEventToRuntime(event);

  // If runtime is IDLE, transition to INTAKE first
  if (orchestrator.stateMachine.state === 'IDLE') {
    orchestrator.transition('INTAKE', runtimeEvent, 'SESSION_OPERATION');
  }

  // Accept into ingestion queue
  orchestrator.queues.ingestion.accept(runtimeEvent);
}

// ---------------------------------------------------------------------------
// ISC-P47: s7 modules — Produce SLOW_REQUIRED gates via governance
// ---------------------------------------------------------------------------

/**
 * Map s7 escalation types to governance action classes.
 * ISC-P47: task-failure, process-quality, and algebra-review
 * produce SLOW_REQUIRED gates.
 */
export function mapEscalationToActionClass(
  escalationType: 'TASK_FAILURE' | 'PROCESS_QUALITY' | 'ALGEBRA_REVIEW',
): 'HUMAN_GATE_RESOLUTION' | 'SOVEREIGNTY_DECISION' | 'ALGEBRA_REVIEW' {
  switch (escalationType) {
    case 'TASK_FAILURE':
      return 'HUMAN_GATE_RESOLUTION';
    case 'PROCESS_QUALITY':
      return 'SOVEREIGNTY_DECISION';
    case 'ALGEBRA_REVIEW':
      return 'ALGEBRA_REVIEW';
  }
}

/**
 * Route an escalation through the runtime.
 * The governance policy will classify it as SLOW_REQUIRED,
 * triggering a HUMAN_REVIEW transition.
 */
export function routeEscalationThroughRuntime(
  orchestrator: RuntimeOrchestrator,
  escalationType: 'TASK_FAILURE' | 'PROCESS_QUALITY' | 'ALGEBRA_REVIEW',
  evidence: Record<string, unknown>,
): void {
  const actionClass = mapEscalationToActionClass(escalationType);
  const event: RuntimeEvent = {
    type: `escalation:${escalationType}`,
    actor: 's7-sovereignty',
    timestamp: new Date().toISOString(),
    payload: evidence,
  };

  // This will classify as SLOW_REQUIRED and redirect to HUMAN_REVIEW
  orchestrator.transition('HUMAN_REVIEW', event, actionClass);
}

// ---------------------------------------------------------------------------
// ISC-P48: s4/deliberation.ts — Execute within SYNTHESIS/REFLECTION
// ---------------------------------------------------------------------------

/**
 * Guard that ensures deliberation only executes in SYNTHESIS or REFLECTION.
 * ISC-P48: Execution rejected in other states.
 */
export function assertDeliberationState(orchestrator: RuntimeOrchestrator): void {
  const state = orchestrator.stateMachine.state;
  if (state !== 'SYNTHESIS' && state !== 'REFLECTION') {
    throw new Error(
      `Deliberation can only execute in SYNTHESIS or REFLECTION state. Current: ${state}`,
    );
  }
}

// ---------------------------------------------------------------------------
// ISC-P49: s2/session-capture.ts — Plugin contract adapter
// ---------------------------------------------------------------------------

/**
 * SessionCapture as a runtime plugin.
 * Capabilities: observe_events + emit_receipts.
 */
export function createSessionCapturePluginManifest(): ObserverPluginManifest {
  return {
    id: 'session-capture',
    version: '1.0.0',
    hooks: ['onSessionStart', 'onSessionEnd'] as PluginHook[],
    capabilities: ['observe_events', 'emit_receipts'],
    produces: ['session-records'],
    requiresSlowPathApproval: false,
    description: 'Captures session metadata as vault records',
  };
}

/**
 * TensionTracker as a runtime plugin.
 */
export function createTensionTrackerPluginManifest(): ObserverPluginManifest {
  return {
    id: 'tension-tracker',
    version: '1.0.0',
    hooks: ['onSessionEnd'] as PluginHook[],
    capabilities: ['observe_events', 'emit_receipts'],
    produces: ['tension-records'],
    requiresSlowPathApproval: false,
    description: 'Tracks tensions across sessions',
  };
}

// ---------------------------------------------------------------------------
// ISC-P50: s8/stop-orchestrator.ts — COMPLETE transition
// ---------------------------------------------------------------------------

/**
 * Trigger the COMPLETE transition and compact the ledger.
 * ISC-P50: stop-orchestrator triggers COMPLETE + receipt flush.
 */
export function triggerSessionComplete(
  orchestrator: RuntimeOrchestrator,
  sessionId: string,
): { compactedPath: string | null } {
  const event: RuntimeEvent = {
    type: 'session_complete',
    actor: 's8-stop-orchestrator',
    timestamp: new Date().toISOString(),
    payload: { sessionId },
  };

  // Transition to COMPLETE
  const state = orchestrator.stateMachine.state;
  if (state === 'REFLECTION') {
    orchestrator.transition('COMPLETE', event);
  }

  // Transition to IDLE (triggers compaction per ISC-P55)
  if (orchestrator.stateMachine.state === 'COMPLETE') {
    orchestrator.transition('IDLE', event);
    const compactedPath = orchestrator.completeSession(sessionId);
    return { compactedPath };
  }

  return { compactedPath: null };
}
