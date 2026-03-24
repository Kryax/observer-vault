/**
 * R2 — Intake-specific BBWOP Buffer Configuration
 *
 * Wraps RuntimeBoundedBuffer with intake-specific overflow policy.
 * ISC-R14: Buffer respects capacity limits; overflow evicts lowest-priority.
 * ISC-R15: Buffer depth and flow rate are queryable.
 */

import { RuntimeBoundedBuffer } from '../runtime/bounded-buffer.ts';
import type { QueueConfig } from '../runtime/buffer-types.ts';
import type { PairedRecord } from './types.ts';

// ---------------------------------------------------------------------------
// Intake Buffer Configuration
// ---------------------------------------------------------------------------

const INTAKE_BUFFER_CONFIG: QueueConfig = {
  name: 'intake-river',
  queueClass: 'ingestion',
  softThreshold: 96,
  hardThreshold: 128,
  overflowPolicy: {
    softAction: 'summarize_and_defer',
    hardAction: 'stop_intake',
    preserveCritical: false,
    artifactPath: 'tmp/overflow/intake-river',
  },
};

// ---------------------------------------------------------------------------
// Intake Buffer with Metrics
// ---------------------------------------------------------------------------

export interface IntakeMetrics {
  accepted: number;
  rejected: number;
  blindExtracted: number;
  overflowEvicted: number;
}

export class IntakeBuffer {
  private readonly buffer: RuntimeBoundedBuffer<PairedRecord>;
  private readonly _metrics: IntakeMetrics = {
    accepted: 0,
    rejected: 0,
    blindExtracted: 0,
    overflowEvicted: 0,
  };

  constructor(configOverride?: QueueConfig) {
    this.buffer = new RuntimeBoundedBuffer(configOverride ?? INTAKE_BUFFER_CONFIG);
  }

  accept(record: PairedRecord): boolean {
    const result = this.buffer.accept(record);
    if (result) {
      this._metrics.accepted++;
    } else {
      this._metrics.rejected++;
    }
    return result;
  }

  evict(): readonly PairedRecord[] {
    const evicted = this.buffer.evict();
    this._metrics.overflowEvicted += evicted.length;
    return evicted;
  }

  recordBlindExtraction(): void {
    this._metrics.blindExtracted++;
  }

  depth(): number {
    return this.buffer.depth();
  }

  capacity(): number {
    return this.buffer.capacity();
  }

  aboveSoftThreshold(): boolean {
    return this.buffer.aboveSoftThreshold();
  }

  drain(): readonly PairedRecord[] {
    return this.buffer.drain();
  }

  dequeue(): PairedRecord | undefined {
    return this.buffer.dequeue();
  }

  metrics(): IntakeMetrics {
    return { ...this._metrics };
  }

  peek(): readonly PairedRecord[] {
    return this.buffer.peek();
  }
}
