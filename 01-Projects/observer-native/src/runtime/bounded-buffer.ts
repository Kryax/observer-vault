/**
 * P4 — Bounded Buffer Implementation
 *
 * Generic BoundedBuffer<T> with soft/hard thresholds and overflow events.
 * ISC-P23 through ISC-P30.
 */

import type {
  BoundedBuffer,
  QueueConfig,
  OverflowEvent,
  OverflowAction,
} from './buffer-types.ts';

// ---------------------------------------------------------------------------
// Overflow Event Emitter
// ---------------------------------------------------------------------------

export type OverflowListener = (event: OverflowEvent) => void;

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class RuntimeBoundedBuffer<T> implements BoundedBuffer<T> {
  private readonly items: T[] = [];
  private readonly _config: QueueConfig;
  private readonly listeners: OverflowListener[] = [];
  private readonly rejections: Array<{ item: T; reason: string }> = [];

  constructor(config: QueueConfig) {
    this._config = config;
  }

  /** Register an overflow event listener. */
  onOverflow(listener: OverflowListener): void {
    this.listeners.push(listener);
  }

  /**
   * Accept an item. Returns false at hard limit. ISC-P23.
   * Emits overflow_warning at soft threshold. ISC-P24.
   */
  accept(item: T): boolean {
    // ISC-P23: Hard capacity enforcement
    if (this.items.length >= this._config.hardThreshold) {
      this.emitOverflowEvent('hard', this._config.overflowPolicy.hardAction);
      return false;
    }

    this.items.push(item);

    // ISC-P24: Soft threshold warning
    if (this.items.length >= this._config.softThreshold) {
      this.emitOverflowEvent('soft', this._config.overflowPolicy.softAction);
    }

    return true;
  }

  /** Reject an item explicitly. */
  reject(item: T, reason: string): void {
    this.rejections.push({ item, reason });
  }

  /**
   * Evict items according to overflow policy. Returns evicted items.
   * Evicts from the front (oldest first) down to soft threshold.
   */
  evict(): readonly T[] {
    if (this.items.length <= this._config.softThreshold) return [];

    const evictCount = this.items.length - this._config.softThreshold;
    const evicted = this.items.splice(0, evictCount);
    return evicted;
  }

  /** Current depth. ISC-P30. */
  depth(): number {
    return this.items.length;
  }

  /** Hard capacity. ISC-P30. */
  capacity(): number {
    return this._config.hardThreshold;
  }

  /** Above soft threshold? ISC-P30. */
  aboveSoftThreshold(): boolean {
    return this.items.length >= this._config.softThreshold;
  }

  /** At hard threshold? ISC-P30. */
  atHardThreshold(): boolean {
    return this.items.length >= this._config.hardThreshold;
  }

  /** Queue configuration. */
  config(): QueueConfig {
    return this._config;
  }

  /** Peek at all items (read-only). */
  peek(): readonly T[] {
    return [...this.items];
  }

  /** Drain all items (removes from buffer). */
  drain(): readonly T[] {
    return this.items.splice(0, this.items.length);
  }

  /** Remove and return the first item, or undefined. */
  dequeue(): T | undefined {
    return this.items.shift();
  }

  private emitOverflowEvent(threshold: 'soft' | 'hard', action: OverflowAction): void {
    const event: OverflowEvent = {
      queueName: this._config.name,
      queueClass: this._config.queueClass,
      depth: this.items.length,
      threshold,
      action,
      artifactPath: this._config.overflowPolicy.artifactPath,
      timestamp: new Date().toISOString(),
    };
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
