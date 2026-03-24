/**
 * P6 — Runtime Orchestrator
 *
 * Wires state machine, governance, buffers, and plugin registry into
 * a single unified runtime API. Cross-pillar reinforcement.
 *
 * ISC-P39 through ISC-P45.
 */

import { RuntimeStateMachine, IllegalRuntimeTransitionError } from './state-machine.ts';
import { TransitionLedger } from './transition-ledger.ts';
import { GovernancePolicy } from './governance-policy.ts';
import { RuntimeBoundedBuffer } from './bounded-buffer.ts';
import { PluginRegistry } from './plugin-registry.ts';
import { dispatchHook } from './plugin-contract.ts';
import {
  ingestionQueueConfig,
  processingQueueConfig,
  governanceQueueConfig,
  receiptQueueConfig,
  overflowSummaryQueueConfig,
} from './overflow-policy.ts';
import type { RuntimeState, RuntimeEvent, TransitionReceipt, QueueSnapshot } from './state-types.ts';
import type { GovernanceActionClass, GovernanceDecisionSlow } from './governance-types.ts';
import type { PluginHook } from './plugin-types.ts';

// ---------------------------------------------------------------------------
// Hook-to-State mapping (ISC-P41)
// ---------------------------------------------------------------------------

const HOOK_STATE_MAP: ReadonlyMap<PluginHook, RuntimeState> = new Map([
  ['onIntake', 'INTAKE'],
  ['onSynthesis', 'SYNTHESIS'],
  ['onReflection', 'REFLECTION'],
  ['onHalt', 'HALTED'],
  ['onSessionStart', 'IDLE'],
  ['onSessionEnd', 'COMPLETE'],
]);

// ---------------------------------------------------------------------------
// Runtime Health
// ---------------------------------------------------------------------------

export interface RuntimeHealth {
  readonly state: RuntimeState;
  readonly queueDepths: Record<string, { depth: number; capacity: number }>;
  readonly activePlugins: readonly string[];
  readonly policyVersion: string;
}

// ---------------------------------------------------------------------------
// Runtime Orchestrator
// ---------------------------------------------------------------------------

export class RuntimeOrchestrator {
  readonly stateMachine: RuntimeStateMachine;
  readonly ledger: TransitionLedger;
  readonly governance: GovernancePolicy;
  readonly pluginRegistry: PluginRegistry;

  // ISC-P39: 5 queue instances
  readonly queues: {
    ingestion: RuntimeBoundedBuffer<unknown>;
    processing: RuntimeBoundedBuffer<unknown>;
    governance: RuntimeBoundedBuffer<unknown>;
    receipt: RuntimeBoundedBuffer<TransitionReceipt>;
    overflowSummary: RuntimeBoundedBuffer<unknown>;
  };

  private readonly workspacePath: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;

    // Initialize state machine
    this.stateMachine = new RuntimeStateMachine('IDLE');
    this.ledger = new TransitionLedger(workspacePath);

    // Wire state machine to ledger
    this.stateMachine.onTransition((receipt) => {
      this.ledger.append(receipt);
    });

    // Initialize governance
    this.governance = new GovernancePolicy();

    // ISC-P39: Initialize 5 queue instances
    this.queues = {
      ingestion: new RuntimeBoundedBuffer(ingestionQueueConfig()),
      processing: new RuntimeBoundedBuffer(processingQueueConfig()),
      governance: new RuntimeBoundedBuffer(governanceQueueConfig()),
      receipt: new RuntimeBoundedBuffer(receiptQueueConfig()),
      overflowSummary: new RuntimeBoundedBuffer(overflowSummaryQueueConfig()),
    };

    // ISC-P43: Wire governance queue overflow to HALTED
    this.queues.governance.onOverflow((event) => {
      if (event.threshold === 'hard' && this.stateMachine.state !== 'HALTED') {
        try {
          this.stateMachine.transition(
            'HALTED',
            {
              type: 'governance_overflow',
              actor: 'system:overflow-monitor',
              timestamp: new Date().toISOString(),
              payload: { queue: event.queueName, depth: event.depth },
            },
            this.getQueueSnapshots(),
            this.governance.policyVersion,
          );
        } catch {
          // May fail if already in a state that can't transition to HALTED
        }
      }
    });

    // Initialize plugin registry
    this.pluginRegistry = new PluginRegistry();

    // Attempt crash recovery
    this.attemptRecovery();
  }

  /**
   * Transition the runtime with governance check.
   * ISC-P40: SLOW_REQUIRED blocks and redirects to HUMAN_REVIEW.
   */
  transition(
    to: RuntimeState,
    event: RuntimeEvent,
    actionClass?: GovernanceActionClass,
  ): TransitionReceipt {
    // Governance check if action class provided
    if (actionClass) {
      const decision = this.governance.classify(actionClass);

      if (decision.speed === 'DISALLOWED') {
        throw new Error(`Action ${actionClass} is DISALLOWED: ${(decision as any).reason}`);
      }

      // ISC-P40: SLOW_REQUIRED redirects to HUMAN_REVIEW
      if (decision.speed === 'SLOW_REQUIRED') {
        const legalToHR = this.stateMachine.isLegalTransition(this.stateMachine.state, 'HUMAN_REVIEW');
        if (legalToHR) {
          return this.stateMachine.transition(
            'HUMAN_REVIEW',
            {
              ...event,
              payload: {
                ...event.payload,
                originalTarget: to,
                gateType: (decision as GovernanceDecisionSlow).gateType,
              },
            },
            this.getQueueSnapshots(),
            this.governance.policyVersion,
          );
        }
      }
    }

    return this.stateMachine.transition(
      to,
      event,
      this.getQueueSnapshots(),
      this.governance.policyVersion,
    );
  }

  /**
   * Dispatch plugin hooks for the current state.
   * ISC-P41: Hooks fire only in their declared states.
   * ISC-P42: Plugin-produced artifacts count against queue capacity.
   */
  async dispatchHooks(hook: PluginHook): Promise<void> {
    // ISC-P41: Verify hook matches current state
    const expectedState = HOOK_STATE_MAP.get(hook);
    if (expectedState && expectedState !== this.stateMachine.state) {
      // onTransition and onOverflow fire in any state
      if (hook !== 'onTransition' && hook !== 'onOverflow') {
        return; // Wrong state — skip dispatch
      }
    }

    const plugins = this.pluginRegistry.getByHook(hook);
    for (const reg of plugins) {
      const { result, valid, collectedArtifacts } = await dispatchHook(
        reg.plugin,
        hook,
        {
          sessionId: 'current',
          workUnitId: `hook-${hook}`,
          state: this.stateMachine.state,
          policyVersion: this.governance.policyVersion,
          queueSnapshots: this.getQueueSnapshots(),
          artifactDir: `${this.workspacePath}/tmp/plugin-artifacts`,
        },
      );

      // ISC-P42: Artifacts count against queue capacity
      if (valid && collectedArtifacts.length > 0) {
        for (const artifact of collectedArtifacts) {
          this.queues.processing.accept(artifact);
        }
      }
    }
  }

  /**
   * ISC-P44: Runtime health query.
   */
  health(): RuntimeHealth {
    return {
      state: this.stateMachine.state,
      queueDepths: {
        ingestion: { depth: this.queues.ingestion.depth(), capacity: this.queues.ingestion.capacity() },
        processing: { depth: this.queues.processing.depth(), capacity: this.queues.processing.capacity() },
        governance: { depth: this.queues.governance.depth(), capacity: this.queues.governance.capacity() },
        receipt: { depth: this.queues.receipt.depth(), capacity: this.queues.receipt.capacity() },
        overflowSummary: { depth: this.queues.overflowSummary.depth(), capacity: this.queues.overflowSummary.capacity() },
      },
      activePlugins: this.pluginRegistry.getActive().map((p) => p.manifest.id),
      policyVersion: this.governance.policyVersion,
    };
  }

  /**
   * ISC-P55: Compact ledger on COMPLETE→IDLE.
   */
  completeSession(sessionId: string): string | null {
    if (this.stateMachine.state === 'IDLE') {
      return this.ledger.compact(sessionId);
    }
    return null;
  }

  /** Get queue snapshots for receipts. */
  getQueueSnapshots(): QueueSnapshot[] {
    return [
      { name: 'ingestion', depth: this.queues.ingestion.depth(), capacity: this.queues.ingestion.capacity(), softThreshold: 96, hardThreshold: 128 },
      { name: 'processing', depth: this.queues.processing.depth(), capacity: this.queues.processing.capacity(), softThreshold: 16, hardThreshold: 24 },
      { name: 'governance', depth: this.queues.governance.depth(), capacity: this.queues.governance.capacity(), softThreshold: 7, hardThreshold: 10 },
      { name: 'receipt', depth: this.queues.receipt.depth(), capacity: this.queues.receipt.capacity(), softThreshold: 192, hardThreshold: 256 },
      { name: 'overflowSummary', depth: this.queues.overflowSummary.depth(), capacity: this.queues.overflowSummary.capacity(), softThreshold: 24, hardThreshold: 32 },
    ];
  }

  private attemptRecovery(): void {
    if (!this.ledger.hasHotFile()) return;
    const lastReceipt = this.ledger.lastReceipt();
    if (lastReceipt) {
      this.stateMachine.recoverFromReceipt(lastReceipt);
    }
  }
}
