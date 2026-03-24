/**
 * P4 Tests — Bounded Buffer + Overflow Policy
 * ISC-P23 through ISC-P30
 */

import { describe, test, expect } from 'bun:test';
import { RuntimeBoundedBuffer } from './bounded-buffer.ts';
import type { QueueConfig, OverflowEvent } from './buffer-types.ts';
import {
  ingestionQueueConfig,
  processingQueueConfig,
  governanceQueueConfig,
  receiptQueueConfig,
  overflowSummaryQueueConfig,
  createDefaultQueueConfigs,
} from './overflow-policy.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function smallConfig(name: string = 'test'): QueueConfig {
  return {
    name,
    queueClass: 'ingestion',
    softThreshold: 3,
    hardThreshold: 5,
    overflowPolicy: {
      softAction: 'summarize_and_defer',
      hardAction: 'stop_intake',
      preserveCritical: false,
      artifactPath: 'tmp/test-overflow',
    },
  };
}

// ---------------------------------------------------------------------------
// ISC-P23: Hard capacity enforcement
// ---------------------------------------------------------------------------

describe('ISC-P23: Hard capacity', () => {
  test('accept returns false at hard limit', () => {
    const buf = new RuntimeBoundedBuffer<number>(smallConfig());
    for (let i = 0; i < 5; i++) {
      expect(buf.accept(i)).toBe(true);
    }
    expect(buf.accept(99)).toBe(false);
    expect(buf.depth()).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// ISC-P24: Soft threshold overflow warning
// ---------------------------------------------------------------------------

describe('ISC-P24: Soft threshold warning', () => {
  test('emits overflow_warning at soft threshold', () => {
    const buf = new RuntimeBoundedBuffer<number>(smallConfig());
    const events: OverflowEvent[] = [];
    buf.onOverflow((e) => events.push(e));

    buf.accept(1); // depth 1
    buf.accept(2); // depth 2
    expect(events.length).toBe(0);

    buf.accept(3); // depth 3 = soft threshold
    expect(events.length).toBe(1);
    expect(events[0].threshold).toBe('soft');
    expect(events[0].action).toBe('summarize_and_defer');
  });
});

// ---------------------------------------------------------------------------
// ISC-P25: All 5 queue classes configurable
// ---------------------------------------------------------------------------

describe('ISC-P25: Queue classes', () => {
  test('all 5 queue classes are instantiable', () => {
    const configs = [
      ingestionQueueConfig(),
      processingQueueConfig(),
      governanceQueueConfig(),
      receiptQueueConfig(),
      overflowSummaryQueueConfig(),
    ];

    for (const config of configs) {
      const buf = new RuntimeBoundedBuffer<string>(config);
      expect(buf.capacity()).toBe(config.hardThreshold);
      expect(buf.config().queueClass).toBe(config.queueClass);
    }
  });

  test('createDefaultQueueConfigs returns all 5', () => {
    const configs = createDefaultQueueConfigs();
    expect(Object.keys(configs).length).toBe(5);
    expect(configs.ingestion.queueClass).toBe('ingestion');
    expect(configs.processing.queueClass).toBe('processing');
    expect(configs.governance.queueClass).toBe('governance');
    expect(configs.receipt.queueClass).toBe('receipt');
    expect(configs.overflowSummary.queueClass).toBe('overflowSummary');
  });
});

// ---------------------------------------------------------------------------
// ISC-P26: Ingestion overflow policy
// ---------------------------------------------------------------------------

describe('ISC-P26: Ingestion overflow', () => {
  test('summarize_and_defer at soft, stop_intake at hard', () => {
    const config = ingestionQueueConfig();
    expect(config.overflowPolicy.softAction).toBe('summarize_and_defer');
    expect(config.overflowPolicy.hardAction).toBe('stop_intake');
  });
});

// ---------------------------------------------------------------------------
// ISC-P27: Governance queue — never drop a gate
// ---------------------------------------------------------------------------

describe('ISC-P27: Governance queue', () => {
  test('saturation_warning at soft, halt_runtime at hard', () => {
    const config = governanceQueueConfig();
    expect(config.overflowPolicy.softAction).toBe('saturation_warning');
    expect(config.overflowPolicy.hardAction).toBe('halt_runtime');
    expect(config.overflowPolicy.preserveCritical).toBe(true);
  });

  test('gate items survive overflow — evict does not remove below soft', () => {
    const buf = new RuntimeBoundedBuffer<string>({
      ...governanceQueueConfig(),
      softThreshold: 3,
      hardThreshold: 5,
    });
    for (let i = 0; i < 5; i++) buf.accept(`gate-${i}`);

    const evicted = buf.evict();
    // Evict removes down to soft threshold (3), so evicts 2
    expect(evicted.length).toBe(2);
    expect(buf.depth()).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// ISC-P28: Receipt queue — critical vs non-critical
// ---------------------------------------------------------------------------

describe('ISC-P28: Receipt queue', () => {
  test('spill_to_file at hard', () => {
    const config = receiptQueueConfig();
    expect(config.overflowPolicy.hardAction).toBe('spill_to_file');
    expect(config.overflowPolicy.preserveCritical).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ISC-P29: Overflow produces artifacts
// ---------------------------------------------------------------------------

describe('ISC-P29: Overflow artifacts', () => {
  test('overflow events include artifact path', () => {
    const buf = new RuntimeBoundedBuffer<number>(smallConfig());
    const events: OverflowEvent[] = [];
    buf.onOverflow((e) => events.push(e));

    // Fill to hard limit
    for (let i = 0; i < 5; i++) buf.accept(i);
    // One more triggers hard overflow event
    buf.accept(99);

    const hardEvent = events.find((e) => e.threshold === 'hard');
    expect(hardEvent).toBeDefined();
    expect(hardEvent!.artifactPath).toBe('tmp/test-overflow');
  });
});

// ---------------------------------------------------------------------------
// ISC-P30: Depth and capacity queryable
// ---------------------------------------------------------------------------

describe('ISC-P30: Queryable', () => {
  test('depth, capacity, soft/hard thresholds queryable', () => {
    const buf = new RuntimeBoundedBuffer<number>(smallConfig());
    expect(buf.depth()).toBe(0);
    expect(buf.capacity()).toBe(5);
    expect(buf.aboveSoftThreshold()).toBe(false);
    expect(buf.atHardThreshold()).toBe(false);

    for (let i = 0; i < 3; i++) buf.accept(i);
    expect(buf.depth()).toBe(3);
    expect(buf.aboveSoftThreshold()).toBe(true);
    expect(buf.atHardThreshold()).toBe(false);

    for (let i = 0; i < 2; i++) buf.accept(i);
    expect(buf.depth()).toBe(5);
    expect(buf.atHardThreshold()).toBe(true);
  });
});
