/**
 * R3 — Processing-specific BBWOP Buffer
 *
 * Convergence-aware priority buffer for the Processing river.
 */

import { RuntimeBoundedBuffer } from '../runtime/bounded-buffer.ts';
import type { QueueConfig } from '../runtime/buffer-types.ts';
import type { PairedRecord } from './types.ts';

const PROCESSING_BUFFER_CONFIG: QueueConfig = {
  name: 'processing-river',
  queueClass: 'processing',
  softThreshold: 16,
  hardThreshold: 24,
  overflowPolicy: {
    softAction: 'summarize_and_defer',
    hardAction: 'stop_intake',
    preserveCritical: true,
    artifactPath: 'tmp/overflow/processing-river',
  },
};

export interface ProcessingMetrics {
  recordsPerStage: Record<string, number>;
  transitionCount: number;
  errorCount: number;
}

export class ProcessingBuffer {
  private readonly buffer: RuntimeBoundedBuffer<PairedRecord>;
  private _accepted = 0;
  private _rejected = 0;

  constructor(configOverride?: QueueConfig) {
    this.buffer = new RuntimeBoundedBuffer(configOverride ?? PROCESSING_BUFFER_CONFIG);
  }

  accept(record: PairedRecord): boolean {
    const result = this.buffer.accept(record);
    if (result) this._accepted++;
    else this._rejected++;
    return result;
  }

  depth(): number { return this.buffer.depth(); }
  capacity(): number { return this.buffer.capacity(); }

  drain(): readonly PairedRecord[] { return this.buffer.drain(); }
  dequeue(): PairedRecord | undefined { return this.buffer.dequeue(); }
  peek(): readonly PairedRecord[] { return this.buffer.peek(); }

  stats() {
    return { accepted: this._accepted, rejected: this._rejected };
  }
}
