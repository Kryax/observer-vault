/**
 * R5+R6 Tests — Pairing Service + Cross-River Wiring
 * ISC-R32 through ISC-R43
 */

import { describe, test, expect } from 'bun:test';
import { PairingService } from './pairing.ts';
import { PairingStore } from './pairing-store.ts';
import { CrossRiverRouter } from './router.ts';
import { RecursionGuard } from './recursion-guard.ts';
import { IntakeRiver } from './intake.ts';
import { ProcessingRiver } from './processing.ts';
import { ReflectionRiver } from './reflection.ts';
import type { PairedRecord } from './types.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNounOnly(id: string, domain: string = 'test', provenance: string = 'hash://abc'): PairedRecord {
  return {
    id,
    sourceProvenance: provenance,
    timestamp: new Date().toISOString(),
    noun: { entityType: 'solution', domain, description: 'Test', rawContent: 'test' },
    verb: null,
    alignment: { confidence: 0, method: 'provenance' },
    position: { river: 'intake', channel: 'fast', stage: 'initial', enteredAt: new Date().toISOString() },
  };
}

function makeVerbOnly(id: string, provenance: string = 'hash://abc'): PairedRecord {
  return {
    id,
    sourceProvenance: provenance,
    timestamp: new Date().toISOString(),
    noun: null,
    verb: { processShape: 'feedback', operators: ['constrain'], axis: 'integrate', derivativeOrder: 1 },
    alignment: { confidence: 0, method: 'provenance' },
    position: { river: 'intake', channel: 'fast', stage: 'initial', enteredAt: new Date().toISOString() },
  };
}

function makeFullPair(id: string): PairedRecord {
  return {
    id,
    sourceProvenance: 'hash://full',
    timestamp: new Date().toISOString(),
    noun: { entityType: 'channel', domain: 'networking', description: 'TCP', rawContent: 'tcp' },
    verb: { processShape: 'negative feedback', operators: ['constrain', 'buffer'], axis: 'integrate', derivativeOrder: 1 },
    alignment: { confidence: 0.8, method: 'structural' },
    position: { river: 'intake', channel: 'fast', stage: 'initial', enteredAt: new Date().toISOString() },
  };
}

// ---------------------------------------------------------------------------
// R5: Pairing Service
// ---------------------------------------------------------------------------

describe('PairingService', () => {
  test('ISC-R32: noun-only matched by provenance', () => {
    const store = new PairingStore();
    const service = new PairingService(store);

    // First, add a verb-only record
    const verbRecord = makeVerbOnly('verb-1', 'hash://shared');
    service.pair(verbRecord); // Stores as verb-dominant

    // Now add a noun-only with same provenance
    const nounRecord = makeNounOnly('noun-1', 'test', 'hash://shared');
    const result = service.pair(nounRecord);

    expect(result.paired).toBe(true);
    expect(result.record.noun).not.toBeNull();
    expect(result.record.verb).not.toBeNull();
  });

  test('ISC-R34: unmatched records stored as pending', () => {
    const store = new PairingStore();
    const service = new PairingService(store);

    service.pair(makeNounOnly('noun-1'));
    service.pair(makeVerbOnly('verb-1', 'hash://different'));

    const metrics = service.metrics();
    expect(metrics.nounPendingCount).toBe(1);
    expect(metrics.verbDominantCount).toBe(1);
  });

  test('ISC-R35: paired records have provenance or structural method', () => {
    const store = new PairingStore();
    const service = new PairingService(store);

    const verbRecord = makeVerbOnly('verb-1', 'hash://shared');
    service.pair(verbRecord);

    const nounRecord = makeNounOnly('noun-1', 'test', 'hash://shared');
    const result = service.pair(nounRecord);

    expect(result.method).toBe('provenance');
  });

  test('ISC-R36: metrics', () => {
    const service = new PairingService();
    service.pair(makeNounOnly('n1'));
    service.pair(makeVerbOnly('v1', 'different'));

    const m = service.metrics();
    expect(m.nounPendingCount).toBe(1);
    expect(m.verbDominantCount).toBe(1);
    expect(m.pairsFormed).toBe(0);
  });

  test('full pair passes through', () => {
    const service = new PairingService();
    const result = service.pair(makeFullPair('fp-1'));
    expect(result.paired).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// R6: Recursion Guard
// ---------------------------------------------------------------------------

describe('RecursionGuard', () => {
  test('ISC-R42: enforces max recursion depth', () => {
    const guard = new RecursionGuard(3);
    expect(guard.canRecurse()).toBe(true);
    expect(guard.recordCycle('reflection', 'intake')).toBe(true); // depth 1
    expect(guard.recordCycle('reflection', 'processing')).toBe(true); // depth 2
    expect(guard.recordCycle('reflection', 'intake')).toBe(true); // depth 3
    expect(guard.recordCycle('reflection', 'intake')).toBe(false); // blocked
    expect(guard.depth()).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// R6: Cross-River Router
// ---------------------------------------------------------------------------

describe('CrossRiverRouter', () => {
  test('ISC-R37: material flows intake → pairing → processing', () => {
    const intake = new IntakeRiver();
    const processing = new ProcessingRiver();
    const reflection = new ReflectionRiver('test-session');
    const pairingService = new PairingService();

    const router = new CrossRiverRouter({
      intake, processing, reflection, pairingService,
    });

    // Ingest a noun-only and verb-only with same provenance — pairing service matches them
    const store = new PairingStore();
    const pairingServiceWithStore = new PairingService(store);
    const routerWithStore = new CrossRiverRouter({
      intake: new IntakeRiver(),
      processing: new ProcessingRiver(),
      reflection: new ReflectionRiver('test-session'),
      pairingService: pairingServiceWithStore,
    });

    // First ingest verb-only (goes to pairing, stored as pending)
    routerWithStore.ingest(makeVerbOnly('verb-1', 'hash://shared'));
    routerWithStore.processIntake();

    // Now ingest noun-only with same provenance (pairing matches → processing)
    routerWithStore.ingest(makeNounOnly('noun-1', 'test', 'hash://shared'));
    routerWithStore.processIntake();

    const log = routerWithStore.getRouteLog();
    // Should have ingest + pairing + processing entries
    expect(log.some((e) => e.to === 'processing')).toBe(true);
  });

  test('ISC-R41: routing is logged', () => {
    const router = new CrossRiverRouter({
      intake: new IntakeRiver(),
      processing: new ProcessingRiver(),
      reflection: new ReflectionRiver('test'),
      pairingService: new PairingService(),
    });

    router.ingest(makeFullPair('fp-1'));
    const log = router.getRouteLog();
    expect(log.length).toBeGreaterThan(0);
    expect(log[0].recordId).toBe('fp-1');
    expect(log[0].from).toBe('external');
    expect(log[0].to).toBe('intake');
  });

  test('ISC-R43: flow rate queryable', () => {
    const router = new CrossRiverRouter({
      intake: new IntakeRiver(),
      processing: new ProcessingRiver(),
      reflection: new ReflectionRiver('test'),
      pairingService: new PairingService(),
    });

    router.ingest(makeFullPair('fp-1'));
    router.ingest(makeFullPair('fp-2'));
    router.processIntake();

    const flow = router.flowRate();
    expect(flow.total).toBeGreaterThanOrEqual(2);
  });
});
