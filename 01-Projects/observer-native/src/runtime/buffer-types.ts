/**
 * Buffer Types — Pillar 4 (Bounded Buffer With Overflow Policy)
 *
 * Defines the BoundedBuffer<T> interface, overflow policies, queue classes,
 * and queue configuration. Every queue has finite capacity and explicit
 * overflow behavior — overflow produces artifacts, not silent data loss.
 */

// ---------------------------------------------------------------------------
// Overflow Actions
// ---------------------------------------------------------------------------

export type OverflowAction =
  | "summarize_and_defer"
  | "stop_intake"
  | "saturation_warning"
  | "halt_runtime"
  | "spill_to_file"
  | "drop_oldest_non_critical";

// ---------------------------------------------------------------------------
// Overflow Policy
// ---------------------------------------------------------------------------

export interface OverflowPolicy {
  readonly softAction: OverflowAction;
  readonly hardAction: OverflowAction;
  readonly preserveCritical: boolean;
  readonly artifactPath?: string;
}

// ---------------------------------------------------------------------------
// Queue Classes (5 from design memo)
// ---------------------------------------------------------------------------

export type QueueClass =
  | "ingestion"
  | "processing"
  | "governance"
  | "receipt"
  | "overflowSummary";

// ---------------------------------------------------------------------------
// Queue Configuration
// ---------------------------------------------------------------------------

export interface QueueConfig {
  readonly name: string;
  readonly queueClass: QueueClass;
  readonly softThreshold: number;
  readonly hardThreshold: number;
  readonly overflowPolicy: OverflowPolicy;
}

// ---------------------------------------------------------------------------
// Overflow Event
// ---------------------------------------------------------------------------

export interface OverflowEvent {
  readonly queueName: string;
  readonly queueClass: QueueClass;
  readonly depth: number;
  readonly threshold: "soft" | "hard";
  readonly action: OverflowAction;
  readonly artifactPath?: string;
  readonly timestamp: string;
}

// ---------------------------------------------------------------------------
// BoundedBuffer<T> — the generic bounded queue interface
// ---------------------------------------------------------------------------

export interface BoundedBuffer<T> {
  /** Attempt to add an item. Returns false if at hard limit. */
  accept(item: T): boolean;

  /** Reject an item explicitly (e.g., governance rejection). */
  reject(item: T, reason: string): void;

  /** Evict items according to overflow policy. Returns evicted items. */
  evict(): readonly T[];

  /** Current number of items in the buffer. */
  depth(): number;

  /** Maximum capacity (hard threshold). */
  capacity(): number;

  /** Whether the buffer has crossed the soft threshold. */
  aboveSoftThreshold(): boolean;

  /** Whether the buffer has reached the hard threshold. */
  atHardThreshold(): boolean;

  /** The queue configuration for this buffer. */
  config(): QueueConfig;
}
