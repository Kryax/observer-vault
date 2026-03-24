/**
 * R3 — Processing River Implementation
 *
 * Multi-tier evaluation pipeline with dual-speed channels.
 * Persistent in store. Each PairedRecord has trackable state.
 *
 * ISC-R17 through ISC-R24.
 */

import type { PairedRecord, DegenerateForm, RiverName } from './types.ts';
import type { River, RiverStateQuery, RouteDecision } from './river.ts';
import { classifyDegenerateForm } from './degenerate.ts';
import { RecordStateTracker } from './processing-state.ts';
import type { RecordProcessingState } from './processing-state.ts';
import { ProcessingBuffer } from './processing-buffer.ts';
import { ProcessingStore } from './processing-store.ts';

// ---------------------------------------------------------------------------
// Processing River
// ---------------------------------------------------------------------------

export class ProcessingRiver implements River {
  readonly name: RiverName = 'processing';
  private readonly buffer: ProcessingBuffer;
  private readonly stateTracker: RecordStateTracker;
  private readonly store: ProcessingStore | null;
  private readonly outbox: PairedRecord[] = [];
  private readonly stageMap: Map<string, number> = new Map();

  constructor(storeDir?: string) {
    this.buffer = new ProcessingBuffer();
    this.stateTracker = new RecordStateTracker();
    this.store = storeDir ? new ProcessingStore(storeDir) : null;
  }

  /**
   * Accept a PairedRecord. Initializes tracking. ISC-R17, ISC-R18.
   */
  accept(record: PairedRecord): boolean {
    const accepted = this.buffer.accept(record);
    if (accepted) {
      this.stateTracker.initialize(record.id, 'RAW');
      this.incrementStage('RAW');
    }
    return accepted;
  }

  /**
   * Route a record through the processing pipeline.
   * ISC-R21: Fast channel for Tier A/B.
   * ISC-R22: Slow channel for Tier C and sovereignty gates.
   */
  route(record: PairedRecord): RouteDecision {
    const form = this.classify(record);

    // Unaligned pairs go to slow channel
    if (form === 'unaligned_pair') {
      return {
        target: 'processing',
        channel: 'slow',
        reason: 'Unaligned pair requires model evaluation',
      };
    }

    // Full pairs and degenerate forms with verb go to fast channel
    if (record.alignment.confidence >= 0.5) {
      return {
        target: 'store',
        channel: 'fast',
        reason: `High confidence (${record.alignment.confidence}) — fast channel`,
      };
    }

    return {
      target: 'processing',
      channel: 'slow',
      reason: `Low confidence (${record.alignment.confidence}) — slow channel for review`,
    };
  }

  /**
   * Process a record through tiers.
   * ISC-R21: Fast path (Tier A/B) without human intervention.
   * ISC-R22: Slow path blocks at sovereignty gates.
   */
  processRecord(
    record: PairedRecord,
    channel: 'fast' | 'slow',
  ): { state: RecordProcessingState; governanceRequired: boolean } {
    const id = record.id;

    // Tier A scoring
    this.stateTracker.transition(id, 'TIER_A_SCORED', 'Tier A automated scoring');
    this.incrementStage('TIER_A_SCORED');

    // Tier B scoring (fast channel only auto-advances)
    if (channel === 'fast') {
      this.stateTracker.transition(id, 'TIER_B_SCORED', 'Tier B automated scoring');
      this.incrementStage('TIER_B_SCORED');

      // Store directly
      this.stateTracker.transition(id, 'BUFFER_HELD', 'Holding in buffer');
      this.stateTracker.transition(id, 'STORED', 'Fast channel storage');
      this.incrementStage('STORED');

      if (this.store) {
        this.store.upsert(record, 'STORED', channel);
      }

      return { state: 'STORED', governanceRequired: false };
    }

    // Slow channel — goes through full pipeline
    this.stateTracker.transition(id, 'TIER_B_SCORED', 'Tier B scoring');
    this.stateTracker.transition(id, 'BUFFER_HELD', 'Holding for Tier C');
    this.stateTracker.transition(id, 'TIER_C_EVALUATED', 'Tier C model evaluation');
    this.incrementStage('TIER_C_EVALUATED');

    // Governance queue for sovereignty review
    this.stateTracker.transition(id, 'GOVERNANCE_QUEUED', 'Sovereignty review required');
    this.incrementStage('GOVERNANCE_QUEUED');

    if (this.store) {
      this.store.upsert(record, 'GOVERNANCE_QUEUED', channel);
    }

    return { state: 'GOVERNANCE_QUEUED', governanceRequired: true };
  }

  /**
   * Promote or reject a governance-queued record.
   */
  resolveGovernance(recordId: string, decision: 'PROMOTED' | 'HELD' | 'REJECTED'): boolean {
    return this.stateTracker.transition(recordId, decision, `Governance decision: ${decision}`);
  }

  /** Process all buffered records. */
  processBuffer(): Array<{ record: PairedRecord; channel: 'fast' | 'slow'; governanceRequired: boolean }> {
    const results: Array<{ record: PairedRecord; channel: 'fast' | 'slow'; governanceRequired: boolean }> = [];
    let record: PairedRecord | undefined;

    while ((record = this.buffer.dequeue()) !== undefined) {
      const decision = this.route(record);
      const channel = decision.channel;
      const { governanceRequired } = this.processRecord(record, channel);
      results.push({ record, channel, governanceRequired });
    }

    return results;
  }

  emit(): readonly PairedRecord[] {
    const emitted = [...this.outbox];
    this.outbox.length = 0;
    return emitted;
  }

  /** ISC-R20: State distribution query. */
  queryState(): RiverStateQuery {
    return {
      river: 'processing',
      bufferDepth: this.buffer.depth(),
      bufferCapacity: this.buffer.capacity(),
      recordCount: this.buffer.stats().accepted,
      stageDistribution: this.stateTracker.stateDistribution(),
    };
  }

  classify(record: PairedRecord): DegenerateForm {
    return classifyDegenerateForm(record);
  }

  /** ISC-R24: Metrics. */
  metrics() {
    return {
      ...this.buffer.stats(),
      stateDistribution: this.stateTracker.stateDistribution(),
      transitionCount: this.stateTracker.transitionCount(),
      errorCount: this.stateTracker.errorCount(),
    };
  }

  /** Get the record state tracker (for testing). */
  getStateTracker(): RecordStateTracker {
    return this.stateTracker;
  }

  /** Get the store (for testing). */
  getStore(): ProcessingStore | null {
    return this.store;
  }

  private incrementStage(stage: string): void {
    this.stageMap.set(stage, (this.stageMap.get(stage) ?? 0) + 1);
  }
}
