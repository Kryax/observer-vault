/**
 * Evidence Aggregator — collects promotion evidence from the VerbRecordStore.
 *
 * Queries the SQLite store to compute domain counts, source type diversity,
 * confidence scores, and relationship edges for each motif.
 */

import { Database } from 'bun:sqlite';
import type { MotifEvidence, SourceType } from './types.ts';

interface DomainRow {
  domain: string;
  cnt: number;
}

interface SourceTypeRow {
  extraction_method: string;
  cnt: number;
}

interface ConfidenceRow {
  avg_confidence: number;
  avg_tier_b: number;
  total: number;
}

interface TopRecordRow {
  id: string;
}

interface EdgeRow {
  target_motif_id: string;
  relationship_type: string;
  strength: number;
}

interface ConflictRow {
  cnt: number;
}

interface CrossTemporalRow {
  cnt: number;
}

/**
 * Aggregate evidence for a single motif from the verb-record store.
 */
export function aggregateMotifEvidence(db: Database, motifId: string): MotifEvidence {
  // Domain count and list
  const domainRows = db.prepare(`
    SELECT domain, COUNT(*) as cnt
    FROM verb_records
    WHERE motif_id = ? AND domain IS NOT NULL AND domain != ''
    GROUP BY domain
    ORDER BY cnt DESC
  `).all(motifId) as DomainRow[];

  const domains = domainRows.map(r => r.domain);
  const domainCount = domains.length;

  // Source types (extraction_method maps to source type)
  // 'primed' = top-down (template-driven), 'blind' = bottom-up (corpus discovery)
  const sourceTypeRows = db.prepare(`
    SELECT extraction_method, COUNT(*) as cnt
    FROM verb_records
    WHERE motif_id = ?
    GROUP BY extraction_method
  `).all(motifId) as SourceTypeRow[];

  const sourceTypes = new Set<SourceType>();
  for (const row of sourceTypeRows) {
    if (row.extraction_method === 'primed') sourceTypes.add('top-down');
    if (row.extraction_method === 'blind') sourceTypes.add('bottom-up');
  }
  if (sourceTypes.has('top-down') && sourceTypes.has('bottom-up')) {
    sourceTypes.add('triangulated');
  }

  // Confidence and scores
  const confRow = db.prepare(`
    SELECT
      AVG(motif_confidence) as avg_confidence,
      AVG(tier_b_score) as avg_tier_b,
      COUNT(*) as total
    FROM verb_records
    WHERE motif_id = ?
  `).get(motifId) as ConfidenceRow | null;

  const confidence = confRow?.avg_confidence ?? 0;
  const averageTierBScore = confRow?.avg_tier_b ?? 0;
  const verbRecordCount = confRow?.total ?? 0;

  // Top verb records by score
  const topRecords = db.prepare(`
    SELECT id FROM verb_records
    WHERE motif_id = ?
    ORDER BY tier_b_score DESC, tier_a_score DESC
    LIMIT 10
  `).all(motifId) as TopRecordRow[];

  const topVerbRecordIds = topRecords.map(r => r.id);

  // Relationship edges from motif graph
  const edgeRows = db.prepare(`
    SELECT target_motif_id, relationship_type, strength
    FROM motif_graph_edges
    WHERE source_motif_id = ?
    UNION
    SELECT source_motif_id as target_motif_id, relationship_type, strength
    FROM motif_graph_edges
    WHERE target_motif_id = ?
  `).all(motifId, motifId) as EdgeRow[];

  const relationshipEdges = edgeRows.map(r => ({
    targetMotifId: r.target_motif_id,
    type: r.relationship_type,
    strength: r.strength,
  }));

  // Conflicting evidence: records where the same source text matches a different
  // motif with higher confidence
  const conflictRow = db.prepare(`
    SELECT COUNT(*) as cnt
    FROM verb_records v1
    JOIN verb_records v2 ON v1.source_content_hash = v2.source_content_hash
    WHERE v1.motif_id = ? AND v2.motif_id != ? AND v2.motif_confidence > v1.motif_confidence
  `).get(motifId, motifId) as ConflictRow;

  const hasConflictingEvidence = (conflictRow?.cnt ?? 0) > 0;

  // Cross-temporal evidence: records from different datasets/components
  // that span different time periods or publication eras
  const crossTemporalRow = db.prepare(`
    SELECT COUNT(DISTINCT source_component) as cnt
    FROM verb_records
    WHERE motif_id = ?
  `).get(motifId) as CrossTemporalRow;

  // If the motif appears across 3+ distinct source components, we consider
  // that as evidence of cross-temporal recurrence
  const hasCrossTemporalEvidence = (crossTemporalRow?.cnt ?? 0) >= 3;

  return {
    motifId,
    domainCount,
    domains,
    sourceTypes,
    sourceTypeCount: sourceTypes.size,
    confidence,
    verbRecordCount,
    hasConflictingEvidence,
    hasCrossTemporalEvidence,
    averageTierBScore,
    topVerbRecordIds,
    relationshipEdges,
  };
}

/**
 * Aggregate evidence for all motifs that have verb-records.
 */
export function aggregateAllMotifEvidence(db: Database): Map<string, MotifEvidence> {
  const motifIdRows = db.prepare(`
    SELECT DISTINCT motif_id FROM verb_records WHERE motif_id IS NOT NULL
  `).all() as Array<{ motif_id: string }>;

  const result = new Map<string, MotifEvidence>();
  for (const row of motifIdRows) {
    result.set(row.motif_id, aggregateMotifEvidence(db, row.motif_id));
  }

  return result;
}
