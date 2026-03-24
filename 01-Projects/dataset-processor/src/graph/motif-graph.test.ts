import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { MotifGraph } from './motif-graph';
import type { MotifMetadata } from './motif-graph';
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
      rawText: 'Test raw text for graph processing.',
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
    motifMatch: {
      motifId: 'CPA',
      confidence: 0.8,
      matchEvidence: 'plugin composable',
      isNovel: false,
    },
    ...overrides,
  };
}

/** Test metadata: 3 motifs on differentiate axis at orders 1, 2, 2 + 1 on integrate axis. */
const TEST_METADATA: MotifMetadata[] = [
  { motifId: 'BD', axis: 'differentiate', derivativeOrder: 1 },
  { motifId: 'CPA', axis: 'differentiate', derivativeOrder: 2 },
  { motifId: 'ESMB', axis: 'differentiate', derivativeOrder: 2 },
  { motifId: 'ISC', axis: 'integrate', derivativeOrder: 1 },
  { motifId: 'DSG', axis: 'integrate', derivativeOrder: 2 },
  { motifId: 'RG', axis: 'recurse', derivativeOrder: 3 },
];

describe('MotifGraph', () => {
  let db: Database;
  let graph: MotifGraph;

  beforeEach(() => {
    db = new Database(':memory:');
    db.run('PRAGMA journal_mode=WAL');
    runMigrations(db);
    graph = new MotifGraph(db, TEST_METADATA);
  });

  afterEach(() => {
    db.close();
  });

  // S7-3: Neighborhood scoping: only compares against motifs at same axis +/- 1 derivative order
  describe('getNeighborhoodMotifIds', () => {
    it('returns motifs on same axis within +/- 1 derivative order', () => {
      // CPA is differentiate, order 2. Neighbors: BD (diff, 1), ESMB (diff, 2)
      const neighbors = graph.getNeighborhoodMotifIds('CPA');
      expect(neighbors).toContain('BD');
      expect(neighbors).toContain('ESMB');
      // Should NOT contain ISC (integrate axis) or DSG (integrate axis) or RG (recurse axis)
      expect(neighbors).not.toContain('ISC');
      expect(neighbors).not.toContain('DSG');
      expect(neighbors).not.toContain('RG');
    });

    it('excludes self from neighborhood', () => {
      const neighbors = graph.getNeighborhoodMotifIds('CPA');
      expect(neighbors).not.toContain('CPA');
    });

    it('returns empty for unknown motif', () => {
      const neighbors = graph.getNeighborhoodMotifIds('UNKNOWN');
      expect(neighbors).toHaveLength(0);
    });

    it('handles motifs with no neighbors on same axis', () => {
      // RG is recurse, order 3. No other recurse motifs within +/- 1.
      const neighbors = graph.getNeighborhoodMotifIds('RG');
      expect(neighbors).toHaveLength(0);
    });
  });

  // S7-1: When verb-record matches motif A and same passage scores >0.3 for motif B, co-occurrence edge created
  describe('processVerbRecord', () => {
    it('creates co-occurrence edge when score > 0.3 for neighborhood motif', () => {
      const vr = makeVerbRecord({
        motifMatch: { motifId: 'CPA', confidence: 0.8, matchEvidence: 'plugin', isNovel: false },
      });

      // CPA is differentiate order 2. BD is differentiate order 1 (neighbor).
      // Score for BD is 0.5 (above threshold).
      graph.processVerbRecord(vr, [
        { motifId: 'CPA', score: 0.8 },
        { motifId: 'BD', score: 0.5 },
        { motifId: 'ISC', score: 0.6 }, // not a neighbor of CPA, should be ignored
      ]);

      const edge = graph.getEdge('CPA', 'BD', 'co-occurrence');
      expect(edge).not.toBeNull();
      expect(edge!.strength).toBeGreaterThan(0);
      expect(edge!.evidenceCount).toBe(1);
      expect(edge!.evidenceIds).toContain(vr.id);
    });

    it('does NOT create edge for score <= 0.3', () => {
      const vr = makeVerbRecord({
        motifMatch: { motifId: 'CPA', confidence: 0.8, matchEvidence: 'plugin', isNovel: false },
      });

      graph.processVerbRecord(vr, [
        { motifId: 'CPA', score: 0.8 },
        { motifId: 'BD', score: 0.3 }, // exactly at threshold, not above
      ]);

      const edge = graph.getEdge('CPA', 'BD', 'co-occurrence');
      expect(edge).toBeNull();
    });

    it('does NOT create edge for non-neighborhood motif even with high score', () => {
      const vr = makeVerbRecord({
        motifMatch: { motifId: 'CPA', confidence: 0.8, matchEvidence: 'plugin', isNovel: false },
      });

      // ISC is integrate axis, not in CPA's neighborhood
      graph.processVerbRecord(vr, [
        { motifId: 'CPA', score: 0.8 },
        { motifId: 'ISC', score: 0.9 },
      ]);

      const edge = graph.getEdge('CPA', 'ISC', 'co-occurrence');
      expect(edge).toBeNull();
    });

    it('skips verb-record with no motif match', () => {
      const vr = makeVerbRecord({ motifMatch: undefined });

      graph.processVerbRecord(vr, [{ motifId: 'CPA', score: 0.5 }]);

      const edges = graph.getAllEdges();
      expect(edges).toHaveLength(0);
    });
  });

  // S7-2: Evidence tracking: edge's evidence_ids contains verb-record IDs, evidence_count is accurate
  describe('evidence tracking', () => {
    it('accumulates evidence across multiple verb-records', () => {
      const vr1 = makeVerbRecord({
        id: 'vr-1',
        motifMatch: { motifId: 'CPA', confidence: 0.8, matchEvidence: 'plugin', isNovel: false },
      });
      const vr2 = makeVerbRecord({
        id: 'vr-2',
        motifMatch: { motifId: 'CPA', confidence: 0.7, matchEvidence: 'composable', isNovel: false },
      });

      graph.processVerbRecord(vr1, [
        { motifId: 'CPA', score: 0.8 },
        { motifId: 'BD', score: 0.5 },
      ]);
      graph.processVerbRecord(vr2, [
        { motifId: 'CPA', score: 0.7 },
        { motifId: 'BD', score: 0.6 },
      ]);

      const edge = graph.getEdge('CPA', 'BD', 'co-occurrence');
      expect(edge).not.toBeNull();
      expect(edge!.evidenceCount).toBe(2);
      expect(edge!.evidenceIds).toContain('vr-1');
      expect(edge!.evidenceIds).toContain('vr-2');
    });

    it('updates strength as evidence accumulates (sigmoid-like)', () => {
      // strength = evidenceCount / (evidenceCount + 5)
      // 1 record: 1/6 ~= 0.1667
      // 2 records: 2/7 ~= 0.2857
      const vr1 = makeVerbRecord({
        id: 'vr-1',
        motifMatch: { motifId: 'CPA', confidence: 0.8, matchEvidence: 'plugin', isNovel: false },
      });

      graph.processVerbRecord(vr1, [
        { motifId: 'CPA', score: 0.8 },
        { motifId: 'BD', score: 0.5 },
      ]);

      let edge = graph.getEdge('CPA', 'BD', 'co-occurrence');
      expect(edge!.strength).toBeCloseTo(1 / 6, 4);

      const vr2 = makeVerbRecord({
        id: 'vr-2',
        motifMatch: { motifId: 'CPA', confidence: 0.7, matchEvidence: 'composable', isNovel: false },
      });
      graph.processVerbRecord(vr2, [
        { motifId: 'CPA', score: 0.7 },
        { motifId: 'BD', score: 0.4 },
      ]);

      edge = graph.getEdge('CPA', 'BD', 'co-occurrence');
      expect(edge!.strength).toBeCloseTo(2 / 7, 4);
    });

    it('does not duplicate evidence IDs', () => {
      const vr = makeVerbRecord({
        id: 'vr-dup',
        motifMatch: { motifId: 'CPA', confidence: 0.8, matchEvidence: 'plugin', isNovel: false },
      });

      graph.processVerbRecord(vr, [
        { motifId: 'CPA', score: 0.8 },
        { motifId: 'BD', score: 0.5 },
      ]);
      // Process same verb-record again
      graph.processVerbRecord(vr, [
        { motifId: 'CPA', score: 0.8 },
        { motifId: 'BD', score: 0.5 },
      ]);

      const edge = graph.getEdge('CPA', 'BD', 'co-occurrence');
      expect(edge!.evidenceIds).toHaveLength(1);
      expect(edge!.evidenceCount).toBe(1);
    });
  });

  // S7-4: getNeighborhood(motifId) returns all edges with types, strengths, evidence counts
  describe('getNeighborhood', () => {
    it('returns all edges for a motif in both directions', () => {
      // Create edge CPA -> BD
      graph.upsertEdge({
        sourceMotifId: 'CPA',
        targetMotifId: 'BD',
        relationshipType: 'co-occurrence',
        strength: 0.5,
        evidenceCount: 3,
        evidenceIds: ['vr-1', 'vr-2', 'vr-3'],
      });

      // Create edge ESMB -> CPA (CPA is target)
      graph.upsertEdge({
        sourceMotifId: 'ESMB',
        targetMotifId: 'CPA',
        relationshipType: 'co-occurrence',
        strength: 0.3,
        evidenceCount: 2,
        evidenceIds: ['vr-4', 'vr-5'],
      });

      const neighborhood = graph.getNeighborhood('CPA');
      expect(neighborhood.motifId).toBe('CPA');
      expect(neighborhood.edges).toHaveLength(2);
      expect(neighborhood.neighborIds).toContain('BD');
      expect(neighborhood.neighborIds).toContain('ESMB');
    });

    it('returns empty neighborhood for motif with no edges', () => {
      const neighborhood = graph.getNeighborhood('RG');
      expect(neighborhood.motifId).toBe('RG');
      expect(neighborhood.edges).toHaveLength(0);
      expect(neighborhood.neighborIds).toHaveLength(0);
    });
  });

  // S7-5: Incremental update: adding new verb-record only evaluates neighborhood-sized set
  describe('incremental update (neighborhood scoping)', () => {
    it('only creates edges within the primary motif neighborhood', () => {
      // Process a verb-record for CPA (differentiate, order 2)
      // Provide high scores for all motifs
      const vr = makeVerbRecord({
        motifMatch: { motifId: 'CPA', confidence: 0.8, matchEvidence: 'plugin', isNovel: false },
      });

      graph.processVerbRecord(vr, [
        { motifId: 'CPA', score: 0.8 },
        { motifId: 'BD', score: 0.6 },    // differentiate order 1 -> neighbor
        { motifId: 'ESMB', score: 0.5 },  // differentiate order 2 -> neighbor
        { motifId: 'ISC', score: 0.9 },   // integrate order 1 -> NOT neighbor
        { motifId: 'DSG', score: 0.8 },   // integrate order 2 -> NOT neighbor
        { motifId: 'RG', score: 0.7 },    // recurse order 3 -> NOT neighbor
      ]);

      const edges = graph.getAllEdges();
      // Only BD and ESMB should have edges with CPA
      expect(edges).toHaveLength(2);

      const edgeMotifs = edges.map(e =>
        e.sourceMotifId === 'CPA' ? e.targetMotifId : e.sourceMotifId
      );
      expect(edgeMotifs).toContain('BD');
      expect(edgeMotifs).toContain('ESMB');
      expect(edgeMotifs).not.toContain('ISC');
      expect(edgeMotifs).not.toContain('DSG');
      expect(edgeMotifs).not.toContain('RG');
    });
  });

  describe('upsertEdge', () => {
    it('inserts a new edge', () => {
      graph.upsertEdge({
        sourceMotifId: 'CPA',
        targetMotifId: 'BD',
        relationshipType: 'complement',
        strength: 0.6,
        evidenceCount: 3,
        evidenceIds: ['vr-1', 'vr-2', 'vr-3'],
      });

      const edge = graph.getEdge('CPA', 'BD', 'complement');
      expect(edge).not.toBeNull();
      expect(edge!.strength).toBe(0.6);
      expect(edge!.evidenceCount).toBe(3);
      expect(edge!.evidenceIds).toEqual(['vr-1', 'vr-2', 'vr-3']);
      expect(edge!.discoveredAt).toBeTruthy();
      expect(edge!.lastUpdated).toBeTruthy();
    });

    it('updates existing edge on upsert', () => {
      graph.upsertEdge({
        sourceMotifId: 'CPA',
        targetMotifId: 'BD',
        relationshipType: 'complement',
        strength: 0.4,
        evidenceCount: 2,
        evidenceIds: ['vr-1', 'vr-2'],
      });

      graph.upsertEdge({
        sourceMotifId: 'CPA',
        targetMotifId: 'BD',
        relationshipType: 'complement',
        strength: 0.7,
        evidenceCount: 5,
        evidenceIds: ['vr-1', 'vr-2', 'vr-3', 'vr-4', 'vr-5'],
      });

      const edge = graph.getEdge('CPA', 'BD', 'complement');
      expect(edge!.strength).toBe(0.7);
      expect(edge!.evidenceCount).toBe(5);
    });
  });

  describe('addEvidence', () => {
    it('increments evidence count and appends ID', () => {
      graph.upsertEdge({
        sourceMotifId: 'CPA',
        targetMotifId: 'BD',
        relationshipType: 'co-occurrence',
        strength: 1 / 6,
        evidenceCount: 1,
        evidenceIds: ['vr-1'],
      });

      graph.addEvidence('CPA', 'BD', 'co-occurrence', 'vr-2');

      const edge = graph.getEdge('CPA', 'BD', 'co-occurrence');
      expect(edge!.evidenceCount).toBe(2);
      expect(edge!.evidenceIds).toContain('vr-1');
      expect(edge!.evidenceIds).toContain('vr-2');
      // Strength should be recalculated: 2/(2+5) = 2/7
      expect(edge!.strength).toBeCloseTo(2 / 7, 4);
    });

    it('does not add duplicate evidence ID', () => {
      graph.upsertEdge({
        sourceMotifId: 'CPA',
        targetMotifId: 'BD',
        relationshipType: 'co-occurrence',
        strength: 1 / 6,
        evidenceCount: 1,
        evidenceIds: ['vr-1'],
      });

      graph.addEvidence('CPA', 'BD', 'co-occurrence', 'vr-1');

      const edge = graph.getEdge('CPA', 'BD', 'co-occurrence');
      expect(edge!.evidenceCount).toBe(1);
      expect(edge!.evidenceIds).toHaveLength(1);
    });
  });

  describe('getAllEdges', () => {
    it('returns all edges in the graph', () => {
      graph.upsertEdge({
        sourceMotifId: 'CPA',
        targetMotifId: 'BD',
        relationshipType: 'co-occurrence',
        strength: 0.3,
        evidenceCount: 2,
        evidenceIds: ['vr-1', 'vr-2'],
      });
      graph.upsertEdge({
        sourceMotifId: 'ESMB',
        targetMotifId: 'CPA',
        relationshipType: 'complement',
        strength: 0.5,
        evidenceCount: 3,
        evidenceIds: ['vr-3', 'vr-4', 'vr-5'],
      });

      const edges = graph.getAllEdges();
      expect(edges).toHaveLength(2);
    });

    it('returns empty array for empty graph', () => {
      expect(graph.getAllEdges()).toHaveLength(0);
    });
  });
});
