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

interface SourceComponentRow {
  source_component: string;
  cnt: number;
}

interface ExtractionMethodRow {
  extraction_method: string;
  cnt: number;
}

interface ConfidenceRow {
  avg_confidence: number;
  avg_tier_b: number;
  total: number;
}

interface DomainEvidenceRow {
  domain: string;
  mean_evidence: number;
  mean_tier_b: number;
  record_count: number;
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

  // Source types: count distinct source_component values (e.g. Pile sub-components)
  // Each sub-component (PubMed Central, FreeLaw, ArXiv, etc.) is an independent source.
  const sourceComponentRows = db.prepare(`
    SELECT source_component, COUNT(*) as cnt
    FROM verb_records
    WHERE motif_id = ? AND source_component IS NOT NULL AND source_component != ''
    GROUP BY source_component
    ORDER BY cnt DESC
  `).all(motifId) as SourceComponentRow[];

  // Extraction method diversity tracked separately (primed vs blind = triangulation signal)
  const extractionMethodRows = db.prepare(`
    SELECT extraction_method, COUNT(*) as cnt
    FROM verb_records
    WHERE motif_id = ?
    GROUP BY extraction_method
  `).all(motifId) as ExtractionMethodRow[];

  const sourceTypes = new Set<SourceType>();
  for (const row of extractionMethodRows) {
    if (row.extraction_method === 'primed') sourceTypes.add('top-down');
    if (row.extraction_method === 'blind') sourceTypes.add('bottom-up');
  }
  if (sourceTypes.has('top-down') && sourceTypes.has('bottom-up')) {
    sourceTypes.add('triangulated');
  }

  // Confidence and scores — flat average (backward compat)
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

  // Hierarchical aggregation — D/I/R-derived: mean of per-domain means
  const domainEvidenceRows = db.prepare(`
    SELECT
      domain,
      AVG(motif_confidence) as mean_evidence,
      AVG(tier_b_score) as mean_tier_b,
      COUNT(*) as record_count
    FROM verb_records
    WHERE motif_id = ? AND domain IS NOT NULL AND domain != ''
    GROUP BY domain
    ORDER BY record_count DESC
  `).all(motifId) as DomainEvidenceRow[];

  const domainEvidence = domainEvidenceRows.map(r => ({
    domain: r.domain,
    meanEvidence: r.mean_evidence,
    recordCount: r.record_count,
  }));

  const evidenceQuality = domainEvidence.length > 0
    ? domainEvidence.reduce((sum, d) => sum + d.meanEvidence, 0) / domainEvidence.length
    : 0;

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

  // Conflicting evidence: check if any source_content_hash for this motif also
  // appears under a different motif with higher confidence. Uses EXISTS + LIMIT 1
  // to short-circuit instead of a full self-join.
  const conflictRow = db.prepare(`
    SELECT EXISTS(
      SELECT 1
      FROM verb_records v1
      WHERE v1.motif_id = ?
        AND EXISTS (
          SELECT 1 FROM verb_records v2
          WHERE v2.source_content_hash = v1.source_content_hash
            AND v2.motif_id != v1.motif_id
            AND v2.motif_confidence > v1.motif_confidence
          LIMIT 1
        )
      LIMIT 1
    ) as cnt
  `).get(motifId) as ConflictRow;

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
    sourceTypeCount: sourceComponentRows.length,
    confidence,
    evidenceQuality,
    domainEvidence,
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
