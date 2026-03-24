import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { PriorityBuffer } from './priority-buffer';
import { runMigrations } from '../store/migrations';
import type { VerbRecord } from '../types/verb-record';

function makeVerbRecord(overrides: Partial<VerbRecord> = {}): VerbRecord {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    process: {
      shape: 'transform',
      operators: ['apply'],
      axis: 'differentiate',
      derivativeOrder: 1,
    },
    source: {
      dataset: 'test-ds',
      component: 'test-comp',
      documentId: 'doc-1',
      charOffset: [0, 100],
      contentHash: 'abc123',
      rawText: 'Test raw text for buffer candidate.',
    },
    stage: 'amorphous',
    quality: {
      tierAScore: 0.8,
      tierBScore: 0.7,
      extractionMethod: 'primed',
    },
    domain: 'testing',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    extractorVersion: '0.1.0',
    ...overrides,
  };
}

describe('PriorityBuffer', () => {
  let db: Database;
  let buffer: PriorityBuffer;

  beforeEach(() => {
    db = new Database(':memory:');
    db.run('PRAGMA journal_mode=WAL');
    runMigrations(db);
    buffer = new PriorityBuffer(db, 10, 72);
  });

  afterEach(() => {
    db.close();
  });

  // S5-2: Priority score is composite: tierBScore * gapRelevance * noveltyBonus
  describe('priority scoring', () => {
    it('computes priority as tierBScore * gapRelevance * noveltyBonus (primed=1.0)', () => {
      const vr = makeVerbRecord();
      buffer.enqueue({ id: vr.id, verbRecord: vr, tierBScore: 0.8, gapRelevance: 0.5, isBlindExtraction: false });
      const stats = buffer.getStats();
      // 0.8 * 0.5 * 1.0 = 0.4
      expect(stats.maxPriority).toBeCloseTo(0.4, 5);
    });

    it('applies noveltyBonus 1.5 for blind extractions', () => {
      const vr = makeVerbRecord({ quality: { tierAScore: 0.8, tierBScore: 0.7, extractionMethod: 'blind' } });
      buffer.enqueue({ id: vr.id, verbRecord: vr, tierBScore: 0.8, gapRelevance: 0.5, isBlindExtraction: true });
      const stats = buffer.getStats();
      // 0.8 * 0.5 * 1.5 = 0.6
      expect(stats.maxPriority).toBeCloseTo(0.6, 5);
    });
  });

  // S5-1: Buffer enforces capacity limit
  describe('capacity enforcement', () => {
    it('evicts lowest-priority candidate when at capacity', () => {
      // Fill buffer to capacity (10)
      for (let i = 0; i < 10; i++) {
        const vr = makeVerbRecord();
        buffer.enqueue({ id: vr.id, verbRecord: vr, tierBScore: (i + 1) * 0.1, gapRelevance: 1.0, isBlindExtraction: false });
      }
      expect(buffer.count()).toBe(10);

      // Insert candidate 11 with high priority
      const vr = makeVerbRecord();
      buffer.enqueue({ id: vr.id, verbRecord: vr, tierBScore: 0.95, gapRelevance: 1.0, isBlindExtraction: false });
      expect(buffer.count()).toBe(10);

      // The lowest priority (0.1 * 1.0 * 1.0 = 0.1) should have been evicted
      const stats = buffer.getStats();
      expect(stats.minPriority).toBeCloseTo(0.2, 5);
    });

    it('does not insert candidate lower than current minimum when at capacity', () => {
      // Fill with high-priority candidates
      for (let i = 0; i < 10; i++) {
        const vr = makeVerbRecord();
        buffer.enqueue({ id: vr.id, verbRecord: vr, tierBScore: 0.9, gapRelevance: 1.0, isBlindExtraction: false });
      }

      // Try to insert a very low priority candidate
      const vr = makeVerbRecord();
      buffer.enqueue({ id: vr.id, verbRecord: vr, tierBScore: 0.01, gapRelevance: 0.01, isBlindExtraction: false });

      // Count should still be 10 - the new low-priority one should have been the one evicted
      // or not inserted at all (implementation may vary, but count must stay at capacity)
      expect(buffer.count()).toBe(10);
    });
  });

  // S5-3: Time-based expiry
  describe('maintenance and expiry', () => {
    it('evicts candidates older than expiryHours', () => {
      // Insert a candidate with an already-expired expires_at
      const vr = makeVerbRecord();
      // Directly insert an expired row
      db.prepare(`
        INSERT INTO priority_buffer (id, priority_score, verb_record_json, enqueued_at, expires_at)
        VALUES (?, ?, ?, datetime('now', '-80 hours'), datetime('now', '-8 hours'))
      `).run(vr.id, 0.5, JSON.stringify(vr));

      expect(buffer.count()).toBe(1);
      const evicted = buffer.maintenance();
      expect(evicted).toBe(1);
      expect(buffer.count()).toBe(0);
    });

    it('does not evict non-expired candidates', () => {
      const vr = makeVerbRecord();
      buffer.enqueue({ id: vr.id, verbRecord: vr, tierBScore: 0.8, gapRelevance: 1.0, isBlindExtraction: false });

      const evicted = buffer.maintenance();
      expect(evicted).toBe(0);
      expect(buffer.count()).toBe(1);
    });
  });

  // S5-4: Draw-from-top: dequeue(n) returns n highest-priority and removes them
  describe('dequeue', () => {
    it('returns highest-priority candidates first', () => {
      const scores = [0.3, 0.9, 0.1, 0.7, 0.5];
      for (const score of scores) {
        const vr = makeVerbRecord({
          quality: { tierAScore: 0.8, tierBScore: score, extractionMethod: 'primed' },
        });
        buffer.enqueue({ id: vr.id, verbRecord: vr, tierBScore: score, gapRelevance: 1.0, isBlindExtraction: false });
      }

      const top2 = buffer.dequeue(2);
      expect(top2).toHaveLength(2);
      // Highest priority should be 0.9, then 0.7
      expect(top2[0].quality.tierBScore).toBe(0.9);
      expect(top2[1].quality.tierBScore).toBe(0.7);

      // Buffer should have 3 remaining
      expect(buffer.count()).toBe(3);
    });

    it('returns fewer than n if buffer has fewer candidates', () => {
      const vr = makeVerbRecord();
      buffer.enqueue({ id: vr.id, verbRecord: vr, tierBScore: 0.5, gapRelevance: 1.0, isBlindExtraction: false });

      const results = buffer.dequeue(5);
      expect(results).toHaveLength(1);
      expect(buffer.count()).toBe(0);
    });

    it('returns empty array from empty buffer', () => {
      const results = buffer.dequeue(3);
      expect(results).toHaveLength(0);
    });
  });

  // S5-5: Buffer statistics
  describe('getStats', () => {
    it('returns correct stats for populated buffer', () => {
      const scores = [0.2, 0.5, 0.8];
      for (const score of scores) {
        const vr = makeVerbRecord();
        buffer.enqueue({ id: vr.id, verbRecord: vr, tierBScore: score, gapRelevance: 1.0, isBlindExtraction: false });
      }

      const stats = buffer.getStats();
      expect(stats.count).toBe(3);
      expect(stats.minPriority).toBeCloseTo(0.2, 5);
      expect(stats.maxPriority).toBeCloseTo(0.8, 5);
      expect(stats.avgPriority).toBeCloseTo(0.5, 5);
      expect(stats.oldestAge).toBeGreaterThanOrEqual(0);
    });

    it('returns zero stats for empty buffer', () => {
      const stats = buffer.getStats();
      expect(stats.count).toBe(0);
      expect(stats.minPriority).toBe(0);
      expect(stats.maxPriority).toBe(0);
      expect(stats.avgPriority).toBe(0);
      expect(stats.oldestAge).toBe(0);
    });
  });
});
