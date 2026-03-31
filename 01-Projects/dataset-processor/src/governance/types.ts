/**
 * Tier Promotion Governance — types.
 *
 * Defines the data shapes for automated motif tier promotion,
 * review queue packets, and processing digests.
 */

// ── Motif frontmatter (parsed from vault .md files) ─────────────────

export interface MotifFrontmatter {
  name: string;
  tier: number;
  status: string;
  confidence: number;
  source: string;
  domain_count: number;
  created: string;
  updated: string;
  promoted?: string;
  promotion_justification?: string;
  derivative_order: number | string;
  primary_axis: 'differentiate' | 'integrate' | 'recurse';
  fileName: string;
  /** Abbreviated motif ID as stored in the DB (e.g. "TAC" for Trust-as-Curation) */
  abbreviation?: string;
}

// ── Source type tracking ─────────────────────────────────────────────

export type SourceType = 'top-down' | 'bottom-up' | 'triangulated';

// ── Evidence aggregated from VerbRecordStore ─────────────────────────

export interface MotifEvidence {
  motifId: string;
  domainCount: number;
  domains: string[];
  sourceTypes: Set<SourceType>;
  sourceTypeCount: number;
  /** @deprecated Use evidenceQuality instead. Flat AVG(motif_confidence). */
  confidence: number;
  /** D/I/R-derived: mean of per-domain mean evidence scores. Bounded [0,1]. */
  evidenceQuality: number;
  /** Per-domain evidence breakdown for inspection. */
  domainEvidence: Array<{
    domain: string;
    meanEvidence: number;
    recordCount: number;
  }>;
  verbRecordCount: number;
  hasConflictingEvidence: boolean;
  hasCrossTemporalEvidence: boolean;
  averageTierBScore: number;
  topVerbRecordIds: string[];
  relationshipEdges: Array<{
    targetMotifId: string;
    type: string;
    strength: number;
  }>;
}

// ── T0 → T1 auto-promotion ─────────────────────────────────────────

export interface T0T1PromotionResult {
  motifId: string;
  motifName: string;
  previousTier: 0;
  newTier: 1;
  evidence: MotifEvidence;
  timestamp: string;
  frontmatterUpdates: Record<string, unknown>;
  /** Original library filename (e.g. "trust-as-curation.md") for frontmatter updates */
  fileName: string;
}

// ── T1 → T2 review packet ──────────────────────────────────────────

export interface ValidationProtocolResult {
  domainIndependentDescription: boolean;
  crossDomainRecurrence: boolean;
  predictivePower: boolean;
  adversarialSurvival: boolean;
  cleanFailure: boolean;
  allPass: boolean;
  notes: string[];
}

export interface T1T2ReviewPacket {
  motifId: string;
  motifName: string;
  currentTier: 1;
  proposedTier: 2;
  evidence: MotifEvidence;
  validationProtocol: ValidationProtocolResult;
  evidenceSummary: string;
  domainList: string[];
  relationshipEdges: Array<{
    targetMotifId: string;
    type: string;
    strength: number;
  }>;
  counterEvidence: string[];
  generatedAt: string;
}

// ── Demotion (↓ operator) ──────────────────────────────────────────

export interface DemotionResult {
  motifId: string;
  motifName: string;
  previousTier: number;
  newTier: number;
  reason: string;
  failedConditions: string[];
  evidence: MotifEvidence;
  timestamp: string;
  fileName: string;
  frontmatterUpdates: Record<string, unknown>;
}

// ── T2 → T3 flag ───────────────────────────────────────────────────

export interface T2T3Flag {
  motifId: string;
  motifName: string;
  reason: string;
  preliminaryThresholdsMet: string[];
  generatedAt: string;
}

// ── Promotion log entry ─────────────────────────────────────────────

export interface PromotionLogEntry {
  id: string;
  motifId: string;
  motifName: string;
  fromTier: number;
  toTier: number;
  action: 'auto-promoted' | 'queued-for-review' | 'flagged' | 'demoted';
  evidenceSnapshot: string;
  timestamp: string;
}

// ── Digest ──────────────────────────────────────────────────────────

export interface ShardSummary {
  shardId: string;
  candidatesFound: number;
  yieldRate: number;
  domainDistribution: Record<string, number>;
}

export interface DigestEntry {
  generatedAt: string;
  shardSummaries: ShardSummary[];
  autoPromotions: T0T1PromotionResult[];
  demotions: DemotionResult[];
  t2QueueAdditions: T1T2ReviewPacket[];
  t2t3Flags: T2T3Flag[];
  anomalies: AnomalyEntry[];
}

export interface AnomalyEntry {
  type: 'conflicting-evidence' | 'outlier-yield' | 'blind-novel-pattern' | 'domain-concentration';
  description: string;
  motifId?: string;
  shardId?: string;
  severity: 'info' | 'warning' | 'critical';
}
