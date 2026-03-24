/**
 * R8 — Governance Adapter
 *
 * Maps dataset processor governance events to runtime governance types.
 * This is the integration debt adapter flagged in build plan §8.
 *
 * ISC-R52: Governance auto-promotions operate within Processing fast channel.
 * ISC-R53: Sovereignty gate reviews operate within Processing slow channel.
 * ISC-R54: Governance digests generate Reflection river entries.
 */

import type { GovernanceDecision } from '../../runtime/governance-types.ts';
import type { TransitionReceipt, RuntimeEvent } from '../../runtime/state-types.ts';
import type { PairedRecord } from '../types.ts';

// ---------------------------------------------------------------------------
// Dataset Processor Governance Event Types
// (Mirror of the dataset processor's governance system)
// ---------------------------------------------------------------------------

export type DatasetProcessorTier = 'T0' | 'T1' | 'T2' | 'T3';

export interface DatasetProcessorGovernanceEvent {
  readonly type: 'auto_promote' | 'batch_review' | 'sovereignty_gate';
  readonly fromTier: DatasetProcessorTier;
  readonly toTier: DatasetProcessorTier;
  readonly recordId: string;
  readonly confidence: number;
  readonly evidence: readonly string[];
  readonly timestamp: string;
}

// ---------------------------------------------------------------------------
// Translation Layer
// ---------------------------------------------------------------------------

/**
 * Map a dataset processor governance event to a runtime GovernanceDecision.
 *
 * T0→T1 auto-promote: FAST_ALLOWED (ISC-R52)
 * T1→T2 batch review: SLOW_REQUIRED (ISC-R53)
 * T2→T3 sovereignty gate: SLOW_REQUIRED with human approval (ISC-R53)
 */
export function mapToGovernanceDecision(
  event: DatasetProcessorGovernanceEvent,
  policyVersion: string,
): GovernanceDecision {
  switch (event.type) {
    case 'auto_promote':
      return {
        speed: 'FAST_ALLOWED',
        actionClass: 'TASK_EXECUTION',
        policyVersion,
      };

    case 'batch_review':
      return {
        speed: 'SLOW_REQUIRED',
        actionClass: 'SOVEREIGNTY_DECISION',
        policyVersion,
        gateType: 'batch-review',
      };

    case 'sovereignty_gate':
      return {
        speed: 'SLOW_REQUIRED',
        actionClass: 'SOVEREIGNTY_DECISION',
        policyVersion,
        gateType: 'sovereignty-gate',
      };
  }
}

/**
 * Produce a TransitionReceipt from a dataset processor governance event.
 * This makes the dataset processor's decisions legible to the runtime spine.
 */
export function mapToTransitionReceipt(
  event: DatasetProcessorGovernanceEvent,
  policyVersion: string,
): TransitionReceipt {
  const runtimeEvent: RuntimeEvent = {
    type: `dataset-processor:${event.type}`,
    actor: 'dataset-processor',
    timestamp: event.timestamp,
    payload: {
      fromTier: event.fromTier,
      toTier: event.toTier,
      recordId: event.recordId,
      confidence: event.confidence,
    },
  };

  return {
    id: `tr-dp-${event.recordId}-${Date.now()}`,
    priorState: 'INTAKE',
    nextState: event.type === 'auto_promote' ? 'SYNTHESIS' : 'HUMAN_REVIEW',
    actor: 'dataset-processor',
    timestamp: event.timestamp,
    guardResults: [],
    policyVersion,
    queueSnapshot: [],
    event: runtimeEvent,
  };
}

/**
 * Determine the processing channel for a governance event.
 * ISC-R52: Auto-promotes → fast channel.
 * ISC-R53: Reviews and sovereignty gates → slow channel.
 */
export function determineChannel(event: DatasetProcessorGovernanceEvent): 'fast' | 'slow' {
  return event.type === 'auto_promote' ? 'fast' : 'slow';
}

/**
 * Create a reflection record from a governance digest.
 * ISC-R54: Governance digests generate Reflection river entries.
 */
export function createGovernanceDigestReflection(
  events: readonly DatasetProcessorGovernanceEvent[],
  sessionId: string,
): PairedRecord {
  const autoPromotes = events.filter((e) => e.type === 'auto_promote').length;
  const batchReviews = events.filter((e) => e.type === 'batch_review').length;
  const sovereigntyGates = events.filter((e) => e.type === 'sovereignty_gate').length;

  return {
    id: `governance-digest-${sessionId}-${Date.now()}`,
    sourceProvenance: `session:${sessionId}`,
    timestamp: new Date().toISOString(),
    noun: {
      entityType: 'governance-digest',
      domain: 'observer-governance',
      description: `Governance digest: ${autoPromotes} auto-promotes, ${batchReviews} batch reviews, ${sovereigntyGates} sovereignty gates`,
      rawContent: JSON.stringify({ autoPromotes, batchReviews, sovereigntyGates }),
    },
    verb: {
      processShape: 'governance classification',
      operators: ['classify', 'gate', 'audit'],
      axis: 'recurse',
      derivativeOrder: 1,
    },
    alignment: {
      confidence: 1.0,
      method: 'provenance',
    },
    position: {
      river: 'reflection',
      channel: 'slow',
      stage: 'governance_digest',
      enteredAt: new Date().toISOString(),
    },
  };
}
