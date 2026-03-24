/**
 * P4 — Overflow Policy Implementations
 *
 * Per-queue overflow policies for the 5 queue classes.
 * ISC-P25 through ISC-P29.
 */

import type { QueueConfig, OverflowPolicy } from './buffer-types.ts';

// ---------------------------------------------------------------------------
// Default Queue Configurations (5 queue classes from design memo)
// ---------------------------------------------------------------------------

/** ISC-P26: ingestion — summarize+defer at soft, stop intake at hard. */
export function ingestionQueueConfig(name: string = 'ingestion'): QueueConfig {
  return {
    name,
    queueClass: 'ingestion',
    softThreshold: 96,
    hardThreshold: 128,
    overflowPolicy: {
      softAction: 'summarize_and_defer',
      hardAction: 'stop_intake',
      preserveCritical: false,
      artifactPath: 'tmp/overflow/ingestion',
    },
  };
}

/** Processing queue — defer at soft, stop at hard. */
export function processingQueueConfig(name: string = 'processing'): QueueConfig {
  return {
    name,
    queueClass: 'processing',
    softThreshold: 16,
    hardThreshold: 24,
    overflowPolicy: {
      softAction: 'summarize_and_defer',
      hardAction: 'stop_intake',
      preserveCritical: true,
      artifactPath: 'tmp/overflow/processing',
    },
  };
}

/** ISC-P27: governance — saturation warning at soft, HALT at hard, never drop a gate. */
export function governanceQueueConfig(name: string = 'governance'): QueueConfig {
  return {
    name,
    queueClass: 'governance',
    softThreshold: 7,
    hardThreshold: 10,
    overflowPolicy: {
      softAction: 'saturation_warning',
      hardAction: 'halt_runtime',
      preserveCritical: true,
    },
  };
}

/** ISC-P28: receipt — flush at soft, halt-or-spill at hard. */
export function receiptQueueConfig(name: string = 'receipt'): QueueConfig {
  return {
    name,
    queueClass: 'receipt',
    softThreshold: 192,
    hardThreshold: 256,
    overflowPolicy: {
      softAction: 'summarize_and_defer',
      hardAction: 'spill_to_file',
      preserveCritical: true,
      artifactPath: 'tmp/receipt-spool',
    },
  };
}

/** Overflow summary queue — receives compacted summaries for reflection. */
export function overflowSummaryQueueConfig(name: string = 'overflowSummary'): QueueConfig {
  return {
    name,
    queueClass: 'overflowSummary',
    softThreshold: 24,
    hardThreshold: 32,
    overflowPolicy: {
      softAction: 'summarize_and_defer',
      hardAction: 'drop_oldest_non_critical',
      preserveCritical: false,
      artifactPath: 'tmp/overflow/summary',
    },
  };
}

/**
 * Create default queue configurations for all 5 queue classes. ISC-P25.
 */
export function createDefaultQueueConfigs(): Record<string, QueueConfig> {
  return {
    ingestion: ingestionQueueConfig(),
    processing: processingQueueConfig(),
    governance: governanceQueueConfig(),
    receipt: receiptQueueConfig(),
    overflowSummary: overflowSummaryQueueConfig(),
  };
}

/**
 * Determine if an overflow artifact should be written. ISC-P29.
 * Overflow ALWAYS produces artifacts — not silent data loss.
 */
export function shouldWriteArtifact(policy: OverflowPolicy, threshold: 'soft' | 'hard'): boolean {
  // Overflow always produces artifacts for traceability
  return policy.artifactPath !== undefined;
}

/**
 * Check if a receipt is governance-critical (for ISC-P28).
 * Governance-critical receipts halt runtime on overflow rather than spilling.
 */
export function isGovernanceCriticalReceipt(receipt: { policyVersion?: string; haltReason?: string }): boolean {
  return receipt.haltReason !== undefined || receipt.policyVersion !== undefined;
}
