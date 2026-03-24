/**
 * R4 — Reflection-specific BBWOP Buffer
 *
 * Novelty-prioritized buffer for meta-observations.
 * ISC-R30: Bounded recursion enforcement (max depth 3 per session).
 */

import { RuntimeBoundedBuffer } from '../runtime/bounded-buffer.ts';
import type { QueueConfig } from '../runtime/buffer-types.ts';
import type { PairedRecord } from './types.ts';

// ---------------------------------------------------------------------------
// Reflection Buffer Configuration
// ---------------------------------------------------------------------------

const REFLECTION_BUFFER_CONFIG: QueueConfig = {
  name: 'reflection-river',
  queueClass: 'processing',
  softThreshold: 16,
  hardThreshold: 24,
  overflowPolicy: {
    softAction: 'summarize_and_defer',
    hardAction: 'stop_intake',
    preserveCritical: true,
    artifactPath: 'tmp/overflow/reflection-river',
  },
};

// ---------------------------------------------------------------------------
// Reflection Metrics
// ---------------------------------------------------------------------------

export interface ReflectionMetrics {
  observationsCaptured: number;
  templatesUpdated: number;
  configDeltasEmitted: number;
  recursionDepth: number;
  maxRecursionDepth: number;
}

// ---------------------------------------------------------------------------
// Reflection Buffer
// ---------------------------------------------------------------------------

export class ReflectionBuffer {
  private readonly buffer: RuntimeBoundedBuffer<PairedRecord>;
  private readonly _metrics: ReflectionMetrics;
  private readonly _maxRecursionDepth: number;

  constructor(maxRecursionDepth: number = 3, configOverride?: QueueConfig) {
    this.buffer = new RuntimeBoundedBuffer(configOverride ?? REFLECTION_BUFFER_CONFIG);
    this._maxRecursionDepth = maxRecursionDepth;
    this._metrics = {
      observationsCaptured: 0,
      templatesUpdated: 0,
      configDeltasEmitted: 0,
      recursionDepth: 0,
      maxRecursionDepth,
    };
  }

  accept(record: PairedRecord): boolean {
    const result = this.buffer.accept(record);
    if (result) {
      this._metrics.observationsCaptured++;
    }
    return result;
  }

  /** Check if recursion bound is exceeded. ISC-R30. */
  canRecurse(): boolean {
    return this._metrics.recursionDepth < this._maxRecursionDepth;
  }

  /** Increment recursion depth. */
  incrementRecursion(): boolean {
    if (!this.canRecurse()) return false;
    this._metrics.recursionDepth++;
    return true;
  }

  recordTemplateUpdate(): void {
    this._metrics.templatesUpdated++;
  }

  recordConfigDelta(): void {
    this._metrics.configDeltasEmitted++;
  }

  depth(): number {
    return this.buffer.depth();
  }

  capacity(): number {
    return this.buffer.capacity();
  }

  drain(): readonly PairedRecord[] {
    return this.buffer.drain();
  }

  dequeue(): PairedRecord | undefined {
    return this.buffer.dequeue();
  }

  peek(): readonly PairedRecord[] {
    return this.buffer.peek();
  }

  metrics(): ReflectionMetrics {
    return { ...this._metrics };
  }
}
