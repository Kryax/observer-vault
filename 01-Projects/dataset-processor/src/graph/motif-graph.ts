import { Database } from 'bun:sqlite';
import type { MotifGraphEdge } from '../types/motif-graph';
import type { VerbRecord } from '../types/verb-record';

export interface MotifNeighborhood {
  motifId: string;
  edges: MotifGraphEdge[];
  neighborIds: string[];
}

export interface MotifMetadata {
  motifId: string;
  axis: 'differentiate' | 'integrate' | 'recurse';
  derivativeOrder: number;
}

/** Row shape returned from motif_graph_edges table. */
interface EdgeRow {
  source_motif_id: string;
  target_motif_id: string;
  relationship_type: string;
  strength: number;
  evidence_count: number;
  evidence_ids: string | null;
  discovered_at: string;
  last_updated: string;
}

/**
 * MotifGraph — typed graph with evidence-tracked edges between motifs.
 *
 * Edges are discovered through co-occurrence in verb-records.
 * Neighborhood scoping ensures only structurally-related motifs
 * (same axis, +/- 1 derivative order) are compared.
 */
export class MotifGraph {
  private metadataByMotif: Map<string, MotifMetadata>;

  constructor(private db: Database, private motifMetadata: MotifMetadata[]) {
    this.metadataByMotif = new Map();
    for (const m of motifMetadata) {
      this.metadataByMotif.set(m.motifId, m);
    }
  }

  /**
   * Process a verb-record for graph updates.
   * When a verb-record matches motif A and scores >0.3 for motif B,
   * create/update a co-occurrence edge between A and B.
   * Only evaluates against neighborhood motifs (same axis +/- 1 derivative order).
   */
  processVerbRecord(
    record: VerbRecord,
    allMotifScores: Array<{ motifId: string; score: number }>,
  ): void {
    const primaryMotifId = record.motifMatch?.motifId;
    if (!primaryMotifId) return;

    const neighborIds = new Set(this.getNeighborhoodMotifIds(primaryMotifId));

    for (const { motifId, score } of allMotifScores) {
      // Skip self
      if (motifId === primaryMotifId) continue;
      // Only evaluate neighborhood motifs
      if (!neighborIds.has(motifId)) continue;
      // Threshold: strictly above 0.3
      if (score <= 0.3) continue;

      const existingEdge = this.getEdge(primaryMotifId, motifId, 'co-occurrence');
      if (existingEdge) {
        this.addEvidence(primaryMotifId, motifId, 'co-occurrence', record.id);
      } else {
        this.upsertEdge({
          sourceMotifId: primaryMotifId,
          targetMotifId: motifId,
          relationshipType: 'co-occurrence',
          strength: 1 / (1 + 5), // evidenceCount=1 -> 1/6
          evidenceCount: 1,
          evidenceIds: [record.id],
        });
      }
    }
  }

  /** Get all edges for a motif (both directions). */
  getNeighborhood(motifId: string): MotifNeighborhood {
    const rows = this.db.prepare(`
      SELECT * FROM motif_graph_edges
      WHERE source_motif_id = ? OR target_motif_id = ?
    `).all(motifId, motifId) as EdgeRow[];

    const edges = rows.map(r => this.rowToEdge(r));
    const neighborIdSet = new Set<string>();
    for (const edge of edges) {
      if (edge.sourceMotifId === motifId) {
        neighborIdSet.add(edge.targetMotifId);
      } else {
        neighborIdSet.add(edge.sourceMotifId);
      }
    }

    return {
      motifId,
      edges,
      neighborIds: Array.from(neighborIdSet),
    };
  }

  /** Get a specific edge. */
  getEdge(
    sourceMotifId: string,
    targetMotifId: string,
    relationshipType: string,
  ): MotifGraphEdge | null {
    const row = this.db.prepare(`
      SELECT * FROM motif_graph_edges
      WHERE source_motif_id = ? AND target_motif_id = ? AND relationship_type = ?
    `).get(sourceMotifId, targetMotifId, relationshipType) as EdgeRow | null;

    return row ? this.rowToEdge(row) : null;
  }

  /** Upsert an edge with evidence tracking. */
  upsertEdge(
    edge: Omit<MotifGraphEdge, 'discoveredAt' | 'lastUpdated'>,
  ): void {
    const evidenceJson = JSON.stringify(edge.evidenceIds);
    this.db.prepare(`
      INSERT INTO motif_graph_edges
        (source_motif_id, target_motif_id, relationship_type, strength, evidence_count, evidence_ids)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (source_motif_id, target_motif_id, relationship_type) DO UPDATE SET
        strength = excluded.strength,
        evidence_count = excluded.evidence_count,
        evidence_ids = excluded.evidence_ids,
        last_updated = datetime('now')
    `).run(
      edge.sourceMotifId,
      edge.targetMotifId,
      edge.relationshipType,
      edge.strength,
      edge.evidenceCount,
      evidenceJson,
    );
  }

  /** Add evidence to an existing edge. Deduplicates by verb-record ID. */
  addEvidence(
    sourceMotifId: string,
    targetMotifId: string,
    relationshipType: string,
    verbRecordId: string,
  ): void {
    const existing = this.getEdge(sourceMotifId, targetMotifId, relationshipType);
    if (!existing) return;

    // Deduplicate
    if (existing.evidenceIds.includes(verbRecordId)) return;

    const newIds = [...existing.evidenceIds, verbRecordId];
    const newCount = newIds.length;
    const newStrength = newCount / (newCount + 5);

    this.db.prepare(`
      UPDATE motif_graph_edges
      SET evidence_ids = ?, evidence_count = ?, strength = ?, last_updated = datetime('now')
      WHERE source_motif_id = ? AND target_motif_id = ? AND relationship_type = ?
    `).run(
      JSON.stringify(newIds),
      newCount,
      newStrength,
      sourceMotifId,
      targetMotifId,
      relationshipType,
    );
  }

  /** Get all edges in the graph. */
  getAllEdges(): MotifGraphEdge[] {
    const rows = this.db.prepare(
      'SELECT * FROM motif_graph_edges',
    ).all() as EdgeRow[];

    return rows.map(r => this.rowToEdge(r));
  }

  /**
   * Get neighborhood motif IDs (same axis +/- 1 derivative order).
   * Excludes the motif itself.
   */
  getNeighborhoodMotifIds(motifId: string): string[] {
    const meta = this.metadataByMotif.get(motifId);
    if (!meta) return [];

    const result: string[] = [];
    for (const m of this.motifMetadata) {
      if (m.motifId === motifId) continue;
      if (m.axis !== meta.axis) continue;
      if (Math.abs(m.derivativeOrder - meta.derivativeOrder) <= 1) {
        result.push(m.motifId);
      }
    }

    return result;
  }

  /** Map a SQLite row to a MotifGraphEdge. */
  private rowToEdge(row: EdgeRow): MotifGraphEdge {
    let evidenceIds: string[] = [];
    if (row.evidence_ids) {
      try {
        evidenceIds = JSON.parse(row.evidence_ids) as string[];
      } catch {
        evidenceIds = [];
      }
    }

    return {
      sourceMotifId: row.source_motif_id,
      targetMotifId: row.target_motif_id,
      relationshipType: row.relationship_type as MotifGraphEdge['relationshipType'],
      strength: row.strength,
      evidenceCount: row.evidence_count,
      evidenceIds,
      discoveredAt: row.discovered_at,
      lastUpdated: row.last_updated,
    };
  }
}
