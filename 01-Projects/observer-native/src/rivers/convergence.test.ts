/**
 * R7 Tests — Convergence Detection
 * ISC-R44 through ISC-R49
 */

import { describe, test, expect } from 'bun:test';
import { ConvergenceDetector } from './convergence.ts';
import type { PairedRecord } from './types.ts';

function makeRecord(
  id: string,
  entityType: string,
  domain: string,
  processShape: string,
): PairedRecord {
  return {
    id,
    sourceProvenance: `hash://${id}`,
    timestamp: new Date().toISOString(),
    noun: { entityType, domain, description: 'test', rawContent: 'test' },
    verb: { processShape, operators: ['constrain'], axis: 'integrate', derivativeOrder: 1 },
    alignment: { confidence: 0.8, method: 'structural' },
    position: { river: 'processing', channel: 'fast', stage: 'stored', enteredAt: new Date().toISOString() },
  };
}

// ---------------------------------------------------------------------------
// ISC-R44: Noun-convergence
// ---------------------------------------------------------------------------

describe('ISC-R44: Noun-convergence', () => {
  test('detected when entityType has 3+ verb patterns across 2+ domains', () => {
    const detector = new ConvergenceDetector();

    // Same entityType, different verb patterns and domains
    detector.ingest(makeRecord('r1', 'finite-capacity-channel', 'networking', 'negative feedback'));
    detector.ingest(makeRecord('r2', 'finite-capacity-channel', 'biology', 'resource allocation'));
    const events = detector.ingest(makeRecord('r3', 'finite-capacity-channel', 'economics', 'bounded accumulation'));

    const nounEvents = events.filter((e) => e.type === 'noun');
    expect(nounEvents.length).toBe(1);
    expect(nounEvents[0].type).toBe('noun');
  });

  test('not detected with fewer than 3 verb patterns', () => {
    const detector = new ConvergenceDetector();
    detector.ingest(makeRecord('r1', 'channel', 'net', 'feedback'));
    const events = detector.ingest(makeRecord('r2', 'channel', 'bio', 'allocation'));

    expect(events.filter((e) => e.type === 'noun').length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// ISC-R45: Verb-convergence
// ---------------------------------------------------------------------------

describe('ISC-R45: Verb-convergence', () => {
  test('detected when processShape appears across 3+ entity types in 2+ domains', () => {
    const detector = new ConvergenceDetector();

    detector.ingest(makeRecord('r1', 'thermostat', 'engineering', 'negative feedback'));
    detector.ingest(makeRecord('r2', 'immune-system', 'biology', 'negative feedback'));
    const events = detector.ingest(makeRecord('r3', 'governance-body', 'politics', 'negative feedback'));

    const verbEvents = events.filter((e) => e.type === 'verb');
    expect(verbEvents.length).toBe(1);
    expect(verbEvents[0].type).toBe('verb');
  });
});

// ---------------------------------------------------------------------------
// ISC-R46: Cross-stream convergence
// ---------------------------------------------------------------------------

describe('ISC-R46: Cross-stream convergence', () => {
  test('detected when noun and verb convergence co-occur', () => {
    const detector = new ConvergenceDetector();

    // Build up both noun and verb convergence for the same entityType + processShape
    detector.ingest(makeRecord('r1', 'bounded-channel', 'networking', 'negative feedback'));
    detector.ingest(makeRecord('r2', 'bounded-channel', 'biology', 'resource allocation'));
    detector.ingest(makeRecord('r3', 'bounded-channel', 'economics', 'bounded accumulation'));

    // Now add records with same processShape but different entity types
    detector.ingest(makeRecord('r4', 'thermostat', 'engineering', 'negative feedback'));
    detector.ingest(makeRecord('r5', 'immune-response', 'medicine', 'negative feedback'));

    // This record completes both noun AND verb convergence at the intersection
    const events = detector.ingest(makeRecord('r6', 'bounded-channel', 'governance', 'negative feedback'));

    const crossEvents = events.filter((e) => e.type === 'cross_stream');
    expect(crossEvents.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// ISC-R48: Configurable thresholds
// ---------------------------------------------------------------------------

describe('ISC-R48: Configurable thresholds', () => {
  test('custom thresholds change detection sensitivity', () => {
    // Lower thresholds — detect with fewer records
    const detector = new ConvergenceDetector({ minVerbPatterns: 2, minEntityTypes: 2, minDomains: 1 });

    const events = detector.ingest(makeRecord('r1', 'channel', 'net', 'feedback'));
    expect(events.length).toBe(0); // Only 1 verb pattern so far

    const events2 = detector.ingest(makeRecord('r2', 'channel', 'net', 'allocation'));
    expect(events2.filter((e) => e.type === 'noun').length).toBe(1); // 2 verb patterns, 1 domain
  });
});

// ---------------------------------------------------------------------------
// ISC-R49: False positive management
// ---------------------------------------------------------------------------

describe('ISC-R49: False positive management', () => {
  test('noise data does not trigger convergence at default thresholds', () => {
    const detector = new ConvergenceDetector();

    // Random diverse records — no entity type repeats enough
    for (let i = 0; i < 20; i++) {
      const events = detector.ingest(
        makeRecord(`noise-${i}`, `type-${i}`, `domain-${i % 3}`, `shape-${i}`),
      );
      expect(events.length).toBe(0);
    }
  });
});
