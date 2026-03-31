/**
 * Tier Promoter — automated governance engine for motif tier promotion.
 *
 * Three governance levels:
 *   T0 → T1: Auto-promote (no human approval)
 *   T1 → T2: Generate review packet for human batch review
 *   T2 → T3: Flag only (full sovereignty gate)
 */

import { Database } from 'bun:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { aggregateMotifEvidence } from './evidence-aggregator.ts';
import { readMotifLibrary, motifIdFromFileName } from './motif-library-reader.ts';
import type {
  MotifFrontmatter,
  MotifEvidence,
  T0T1PromotionResult,
  T1T2ReviewPacket,
  T2T3Flag,
  DemotionResult,
  ValidationProtocolResult,
  PromotionLogEntry,
} from './types.ts';

// ── Thresholds ──────────────────────────────────────────────────────

const T0_T1_THRESHOLDS = {
  domainCount: 3,
  sourceTypes: 2,
  evidenceQuality: 0.3,
} as const;

const T1_T2_THRESHOLDS = {
  domainCount: 5,
  sourceTypes: 3,
  evidenceQuality: 0.6,
} as const;

const T2_T3_THRESHOLDS = {
  domainCount: 8,
  relationshipEdges: 3,
  evidenceQuality: 0.8,
  preliminaryCount: 2,
} as const;

const DEMOTION_HYSTERESIS = {
  domainCount: 1,
  evidenceQuality: 0.1,
} as const;

/**
 * Parse derivative order from frontmatter, handling non-integer values
 * like "1-2" or "1.5". Returns ceiling for threshold calculation.
 */
function parseDerivativeOrder(value: number | string): number {
  if (typeof value === 'number') return Math.ceil(value);
  // Handle range notation like "1-2" → take the higher end
  if (value.includes('-')) {
    const parts = value.split('-').map(s => parseFloat(s.trim()));
    return Math.ceil(Math.max(...parts.filter(n => !isNaN(n))));
  }
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : Math.ceil(parsed);
}

/**
 * D/I/R-derived: derivative order adjustment for evidence quality thresholds.
 * Higher-order motifs (d2, d3) make stronger structural claims and require
 * proportionally more evidence.
 */
function adjustedQualityThreshold(baseThreshold: number, derivativeOrder: number): number {
  return baseThreshold * (1 + 0.1 * derivativeOrder);
}

// ── Promotion Engine ────────────────────────────────────────────────

export interface TierPromoterConfig {
  db: Database;
  motifLibraryPath: string;
  promotionQueuePath: string;
  /** When true, no filesystem writes or DB inserts. Evaluations run normally. */
  dryRun?: boolean;
}

export interface PromotionRunResult {
  autoPromotions: T0T1PromotionResult[];
  demotions: DemotionResult[];
  reviewPackets: T1T2ReviewPacket[];
  t2t3Flags: T2T3Flag[];
  logEntries: PromotionLogEntry[];
}

export class TierPromoter {
  private db: Database;
  private motifLibraryPath: string;
  private promotionQueuePath: string;
  private dryRun: boolean;

  constructor(config: TierPromoterConfig) {
    this.db = config.db;
    this.motifLibraryPath = config.motifLibraryPath;
    this.promotionQueuePath = config.promotionQueuePath;
    this.dryRun = config.dryRun ?? false;
    this.ensurePromotionLogTable();
  }

  /**
   * Run the full promotion governance pass.
   * Returns all promotions, review packets, and flags generated.
   */
  run(): PromotionRunResult {
    const motifs = readMotifLibrary(this.motifLibraryPath);
    const result: PromotionRunResult = {
      autoPromotions: [],
      demotions: [],
      reviewPackets: [],
      t2t3Flags: [],
      logEntries: [],
    };

    for (const motif of motifs) {
      // Use the abbreviated ID that the pipeline writes to the DB (e.g. "TAC"),
      // falling back to filename-derived ID for motifs not in INDICATOR_SETS.
      const motifId = motif.abbreviation ?? motifIdFromFileName(motif.fileName);
      const evidence = aggregateMotifEvidence(this.db, motifId);

      // --- Promotions ---
      if (motif.tier === 0) {
        const promotion = this.evaluateT0T1(motif, motifId, evidence);
        if (promotion) {
          result.autoPromotions.push(promotion);
          result.logEntries.push(this.buildLogEntry(promotion, 'auto-promoted'));
        }
      } else if (motif.tier === 1) {
        const packet = this.evaluateT1T2(motif, motifId, evidence);
        if (packet) {
          result.reviewPackets.push(packet);
          result.logEntries.push(this.buildLogEntryFromPacket(packet));
        }
      } else if (motif.tier === 2) {
        const flag = this.evaluateT2T3(motif, motifId, evidence);
        if (flag) {
          result.t2t3Flags.push(flag);
          result.logEntries.push(this.buildLogEntryFromFlag(flag));
        }
      }

      // --- Demotions (↓ operator) ---
      // Only evaluate demotion for motifs that were auto-promoted by the processor.
      // Manually curated motifs (promoted before processor existed) should not be
      // demoted based on incomplete processor evidence — their evidence base includes
      // manually catalogued domains not yet in the verb_record store.
      if (motif.tier >= 1 && this.wasAutoPromoted(motifId, motif.tier)) {
        const demotion = this.evaluateDemotion(motif, motifId, evidence);
        if (demotion) {
          result.demotions.push(demotion);
          result.logEntries.push(this.buildDemotionLogEntry(demotion));
        }
      }
    }

    if (!this.dryRun) {
      // Persist: auto-promotions update frontmatter + MOTIF_INDEX
      for (const promotion of result.autoPromotions) {
        this.applyT0T1Promotion(promotion);
      }

      // Persist: demotions update frontmatter
      for (const demotion of result.demotions) {
        this.applyDemotion(demotion);
      }

      // Persist: T1→T2 review packets to queue directory
      for (const packet of result.reviewPackets) {
        this.writeReviewPacket(packet);
      }

      // Persist: log all entries
      for (const entry of result.logEntries) {
        this.insertPromotionLog(entry);
      }
    }

    return result;
  }

  // ── T0 → T1: Auto-Promote ──────────────────────────────────────────

  private evaluateT0T1(
    motif: MotifFrontmatter,
    motifId: string,
    evidence: MotifEvidence,
  ): T0T1PromotionResult | null {
    // Check all thresholds (D/I/R-derived hierarchical evidence quality)
    if (evidence.domainCount < T0_T1_THRESHOLDS.domainCount) return null;
    if (evidence.sourceTypeCount < T0_T1_THRESHOLDS.sourceTypes) return null;
    if (evidence.evidenceQuality < T0_T1_THRESHOLDS.evidenceQuality) return null;
    // Conflicting evidence is logged as a warning in the digest but does not
    // block T0→T1 promotion. At scale, some motif overlap is expected — broad
    // structural patterns naturally co-occur across source passages.

    // Already promoted in a prior run?
    if (this.wasAlreadyPromoted(motifId, 0, 1)) return null;

    const now = new Date().toISOString();

    return {
      motifId,
      motifName: motif.name,
      previousTier: 0,
      newTier: 1,
      evidence,
      timestamp: now,
      fileName: motif.fileName,
      frontmatterUpdates: {
        tier: 1,
        status: 'provisional',
        confidence: Math.min(1.0, motif.confidence + 0.1 * evidence.domainCount),
        domain_count: evidence.domainCount,
        source: evidence.sourceTypes.has('triangulated') ? 'triangulated' : motif.source,
        updated: now.split('T')[0],
      },
    };
  }

  // ── T1 → T2: Batch Review Queue ────────────────────────────────────

  private evaluateT1T2(
    motif: MotifFrontmatter,
    motifId: string,
    evidence: MotifEvidence,
  ): T1T2ReviewPacket | null {
    // Threshold checks (D/I/R-derived with derivative order adjustment)
    if (evidence.domainCount < T1_T2_THRESHOLDS.domainCount) return null;
    if (evidence.sourceTypeCount < T1_T2_THRESHOLDS.sourceTypes) return null;
    const dOrder = parseDerivativeOrder(motif.derivative_order);
    const qualityThreshold = adjustedQualityThreshold(T1_T2_THRESHOLDS.evidenceQuality, dOrder);
    if (evidence.evidenceQuality < qualityThreshold) return null;
    if (!evidence.hasCrossTemporalEvidence) return null;

    // Validation protocol assessment
    const validation = this.assessValidationProtocol(motif, evidence);
    if (!validation.allPass) return null;

    // Already queued in a prior run?
    if (this.wasAlreadyPromoted(motifId, 1, 2)) return null;

    const now = new Date().toISOString();

    return {
      motifId,
      motifName: motif.name,
      currentTier: 1,
      proposedTier: 2,
      evidence,
      validationProtocol: validation,
      evidenceSummary: this.buildEvidenceSummary(motif, evidence),
      domainList: evidence.domains,
      relationshipEdges: evidence.relationshipEdges,
      counterEvidence: this.collectCounterEvidence(motifId),
      generatedAt: now,
    };
  }

  /**
   * Assess the 5 T2 validation protocol conditions.
   *
   * From _SCHEMA.md:
   *   1. Domain-independent description — can be described without domain-specific vocabulary
   *   2. Cross-domain recurrence — 3+ unrelated domains with documented instances
   *   3. Predictive power — knowing this motif changes design decisions
   *   4. Adversarial survival — genuine structural pattern, not superficial similarity
   *   5. Clean failure — specific, testable falsification conditions
   *
   * Conditions 1, 4, 5 require human judgment. The automated system uses
   * heuristic proxies and flags uncertainty in notes.
   */
  private assessValidationProtocol(
    motif: MotifFrontmatter,
    evidence: MotifEvidence,
  ): ValidationProtocolResult {
    const notes: string[] = [];

    // 1. Domain-independent description
    // Proxy: the motif file exists and has a "Structural Description" section
    // (actual assessment requires human reading)
    const hasStructuralDescription = this.motifFileHasSection(
      motif.fileName,
      '## Structural Description',
    );
    if (!hasStructuralDescription) {
      notes.push('VP1: Missing ## Structural Description section — cannot verify domain-independence');
    }

    // 2. Cross-domain recurrence — hard check: 3+ unrelated domains
    const crossDomainRecurrence = evidence.domainCount >= 3;
    if (!crossDomainRecurrence) {
      notes.push(`VP2: Only ${evidence.domainCount} domains (need 3+)`);
    }

    // 3. Predictive power — proxy: evidence of the motif being matched with
    // high confidence (>= 0.7) across multiple domains suggests predictive utility
    const highConfidenceDomains = this.countHighConfidenceDomains(evidence.motifId, 0.7);
    const predictivePower = highConfidenceDomains >= 2;
    if (!predictivePower) {
      notes.push(`VP3: Only ${highConfidenceDomains} domains with confidence >= 0.7 (need 2+) — predictive power unclear`);
    }

    // 4. Adversarial survival — proxy: motif has both top-down and bottom-up
    // evidence (triangulated), suggesting it's not just a pattern-matching artifact
    const adversarialSurvival = evidence.sourceTypes.has('triangulated');
    if (!adversarialSurvival) {
      notes.push('VP4: Not yet triangulated — adversarial survival unverified (needs both top-down + bottom-up evidence)');
    }

    // 5. Clean failure — proxy: motif file has a "Falsification Conditions" section
    const hasFalsification = this.motifFileHasSection(
      motif.fileName,
      '## Falsification Conditions',
    );
    if (!hasFalsification) {
      notes.push('VP5: Missing ## Falsification Conditions section');
    }

    const allPass = hasStructuralDescription &&
      crossDomainRecurrence &&
      predictivePower &&
      adversarialSurvival &&
      hasFalsification;

    return {
      domainIndependentDescription: hasStructuralDescription,
      crossDomainRecurrence,
      predictivePower,
      adversarialSurvival,
      cleanFailure: hasFalsification,
      allPass,
      notes,
    };
  }

  // ── T2 → T3: Sovereignty Gate (flag only) ─────────────────────────

  private evaluateT2T3(
    motif: MotifFrontmatter,
    motifId: string,
    evidence: MotifEvidence,
  ): T2T3Flag | null {
    const dOrder = parseDerivativeOrder(motif.derivative_order);
    const qualityThreshold = adjustedQualityThreshold(T2_T3_THRESHOLDS.evidenceQuality, dOrder);
    const thresholdsMet: string[] = [];

    if (evidence.relationshipEdges.length >= T2_T3_THRESHOLDS.relationshipEdges) {
      thresholdsMet.push(`${evidence.relationshipEdges.length} relationship edges (>= ${T2_T3_THRESHOLDS.relationshipEdges})`);
    }

    if (evidence.domainCount >= T2_T3_THRESHOLDS.domainCount) {
      thresholdsMet.push(`${evidence.domainCount} domains (>= ${T2_T3_THRESHOLDS.domainCount})`);
    }

    if (evidence.evidenceQuality >= qualityThreshold) {
      thresholdsMet.push(`evidence quality ${evidence.evidenceQuality.toFixed(2)} (>= ${qualityThreshold.toFixed(2)}, d${dOrder})`);
    }

    // Only flag if at least 2 preliminary thresholds are met
    if (thresholdsMet.length < T2_T3_THRESHOLDS.preliminaryCount) return null;

    // Already flagged?
    if (this.wasAlreadyPromoted(motifId, 2, 3)) return null;

    return {
      motifId,
      motifName: motif.name,
      reason: `Meets ${thresholdsMet.length} preliminary T3 thresholds. Full sovereignty gate applies — no automation beyond this flag.`,
      preliminaryThresholdsMet: thresholdsMet,
      generatedAt: new Date().toISOString(),
    };
  }

  // ── Demotion Engine (↓ operator with hysteresis) ──────────────────

  private evaluateDemotion(
    motif: MotifFrontmatter,
    motifId: string,
    evidence: MotifEvidence,
  ): DemotionResult | null {
    // Already demoted in a prior run?
    if (this.wasAlreadyDemoted(motifId, motif.tier)) return null;

    const dOrder = parseDerivativeOrder(motif.derivative_order);
    const failedConditions: string[] = [];
    const now = new Date().toISOString();

    if (motif.tier === 1) {
      // T1 → T0 demotion: c_threshold(T1) - Δc = 3 - 1 = 2
      const domainFloor = T0_T1_THRESHOLDS.domainCount - DEMOTION_HYSTERESIS.domainCount;
      const qualityFloor = T0_T1_THRESHOLDS.evidenceQuality - DEMOTION_HYSTERESIS.evidenceQuality;

      if (evidence.domainCount < domainFloor) {
        failedConditions.push(`domain count ${evidence.domainCount} < ${domainFloor} (T1 floor with hysteresis)`);
      }
      if (evidence.evidenceQuality < qualityFloor) {
        failedConditions.push(`evidence quality ${evidence.evidenceQuality.toFixed(3)} < ${qualityFloor} (T1 floor with hysteresis)`);
      }
    } else if (motif.tier === 2) {
      // T2 → T1 demotion
      const domainFloor = T1_T2_THRESHOLDS.domainCount - DEMOTION_HYSTERESIS.domainCount;
      const qualityFloor = adjustedQualityThreshold(
        T1_T2_THRESHOLDS.evidenceQuality - DEMOTION_HYSTERESIS.evidenceQuality, dOrder,
      );

      if (evidence.domainCount < domainFloor) {
        failedConditions.push(`domain count ${evidence.domainCount} < ${domainFloor} (T2 floor with hysteresis)`);
      }
      if (evidence.evidenceQuality < qualityFloor) {
        failedConditions.push(`evidence quality ${evidence.evidenceQuality.toFixed(3)} < ${qualityFloor.toFixed(3)} (T2 floor, d${dOrder})`);
      }
      // Triangulation loss check
      if (!evidence.sourceTypes.has('triangulated') && evidence.sourceTypeCount < T1_T2_THRESHOLDS.sourceTypes) {
        failedConditions.push(`triangulation lost and source types ${evidence.sourceTypeCount} < ${T1_T2_THRESHOLDS.sourceTypes}`);
      }
    } else if (motif.tier === 3) {
      // T3 → T2 demotion
      const domainFloor = T2_T3_THRESHOLDS.domainCount - DEMOTION_HYSTERESIS.domainCount;
      const qualityFloor = adjustedQualityThreshold(
        T2_T3_THRESHOLDS.evidenceQuality - DEMOTION_HYSTERESIS.evidenceQuality, dOrder,
      );
      const edgeFloor = T2_T3_THRESHOLDS.relationshipEdges - DEMOTION_HYSTERESIS.domainCount;

      if (evidence.domainCount < domainFloor) {
        failedConditions.push(`domain count ${evidence.domainCount} < ${domainFloor} (T3 floor with hysteresis)`);
      }
      if (evidence.evidenceQuality < qualityFloor) {
        failedConditions.push(`evidence quality ${evidence.evidenceQuality.toFixed(3)} < ${qualityFloor.toFixed(3)} (T3 floor, d${dOrder})`);
      }
      if (evidence.relationshipEdges.length < edgeFloor) {
        failedConditions.push(`relationship edges ${evidence.relationshipEdges.length} < ${edgeFloor} (T3 floor with hysteresis)`);
      }
    }

    if (failedConditions.length === 0) return null;

    const newTier = motif.tier - 1;
    const statusForTier: Record<number, string> = { 0: 'draft', 1: 'provisional', 2: 'validated' };

    return {
      motifId,
      motifName: motif.name,
      previousTier: motif.tier,
      newTier,
      reason: `↓ operator: ${failedConditions.length} stabilisation condition(s) failed below hysteresis margin.`,
      failedConditions,
      evidence,
      timestamp: now,
      fileName: motif.fileName,
      frontmatterUpdates: {
        tier: newTier,
        status: statusForTier[newTier] ?? 'draft',
        updated: now.split('T')[0],
      },
    };
  }

  // ── Persistence: apply demotion ──────────────────────────────────

  private applyDemotion(demotion: DemotionResult): void {
    const filePath = join(this.motifLibraryPath, demotion.fileName);

    try {
      let content = readFileSync(filePath, 'utf-8');

      for (const [key, value] of Object.entries(demotion.frontmatterUpdates)) {
        const regex = new RegExp(`^(${key}:\\s*).*$`, 'm');
        const formatted = typeof value === 'number' ? parseFloat(value.toFixed(3)) : value;
        const replacement = `${key}: ${formatted}`;
        if (regex.test(content)) {
          content = content.replace(regex, replacement);
        }
      }

      writeFileSync(filePath, content);
    } catch (err) {
      console.error(`[governance] Failed to update motif file for demotion ${filePath}: ${err}`);
    }
  }

  // ── Persistence: apply T0→T1 promotion ────────────────────────────

  private applyT0T1Promotion(promotion: T0T1PromotionResult): void {
    const filePath = join(this.motifLibraryPath, promotion.fileName);

    try {
      let content = readFileSync(filePath, 'utf-8');

      // Update frontmatter fields
      for (const [key, value] of Object.entries(promotion.frontmatterUpdates)) {
        const regex = new RegExp(`^(${key}:\\s*).*$`, 'm');
        const formatted = typeof value === 'number' ? parseFloat(value.toFixed(3)) : value;
        const replacement = `${key}: ${formatted}`;
        if (regex.test(content)) {
          content = content.replace(regex, replacement);
        }
      }

      writeFileSync(filePath, content);
    } catch (err) {
      console.error(`[governance] Failed to update motif file ${filePath}: ${err}`);
    }
  }

  // ── Persistence: write T1→T2 review packet ────────────────────────

  private writeReviewPacket(packet: T1T2ReviewPacket): void {
    const fileName = `${packet.motifId}-review-${packet.generatedAt.split('T')[0]}.md`;
    const filePath = join(this.promotionQueuePath, fileName);

    const domainLines = packet.domainList.map(d => `- ${d}`).join('\n');
    const edgeLines = packet.relationshipEdges
      .map(e => `- → ${e.targetMotifId} (${e.type}, strength: ${e.strength.toFixed(2)})`)
      .join('\n');
    const counterLines = packet.counterEvidence.length > 0
      ? packet.counterEvidence.map(c => `- ${c}`).join('\n')
      : '- None identified';
    const vpLines = [
      `1. Domain-independent description: ${packet.validationProtocol.domainIndependentDescription ? 'PASS' : 'FAIL'}`,
      `2. Cross-domain recurrence: ${packet.validationProtocol.crossDomainRecurrence ? 'PASS' : 'FAIL'}`,
      `3. Predictive power: ${packet.validationProtocol.predictivePower ? 'PASS' : 'FAIL'}`,
      `4. Adversarial survival: ${packet.validationProtocol.adversarialSurvival ? 'PASS' : 'FAIL'}`,
      `5. Clean failure: ${packet.validationProtocol.cleanFailure ? 'PASS' : 'FAIL'}`,
    ].join('\n');
    const noteLines = packet.validationProtocol.notes.length > 0
      ? packet.validationProtocol.notes.map(n => `- ${n}`).join('\n')
      : '- All conditions met cleanly';

    const markdown = `---
motif: ${packet.motifId}
name: "${packet.motifName}"
current_tier: ${packet.currentTier}
proposed_tier: ${packet.proposedTier}
generated: ${packet.generatedAt}
status: pending-review
---

# T1 → T2 Review Packet: ${packet.motifName}

## Evidence Summary

${packet.evidenceSummary}

## Domains (${packet.domainList.length})

${domainLines}

## Validation Protocol

${vpLines}

### Notes

${noteLines}

## Relationship Edges

${edgeLines || '- No edges discovered'}

## Counter-Evidence

${counterLines}

## Verb-Record Evidence (top 10)

${packet.evidence.topVerbRecordIds.map(id => `- \`${id}\``).join('\n') || '- None'}

---

**Action required:** Approve or reject this promotion. Edit status to \`approved\` or \`rejected\`.
`;

    writeFileSync(filePath, markdown);
  }

  // ── Helpers ───────────────────────────────────────────────────────

  private motifFileHasSection(fileName: string, sectionHeader: string): boolean {
    const filePath = join(this.motifLibraryPath, fileName);
    try {
      const content = readFileSync(filePath, 'utf-8');
      return content.includes(sectionHeader);
    } catch {
      return false;
    }
  }

  private countHighConfidenceDomains(motifId: string, threshold: number): number {
    const row = this.db.prepare(`
      SELECT COUNT(DISTINCT domain) as cnt
      FROM verb_records
      WHERE motif_id = ? AND motif_confidence >= ? AND domain IS NOT NULL AND domain != ''
    `).get(motifId, threshold) as { cnt: number } | null;
    return row?.cnt ?? 0;
  }

  private collectCounterEvidence(motifId: string): string[] {
    const counter: string[] = [];

    // Look for verb-records where same source text matched different motif
    const conflicts = this.db.prepare(`
      SELECT v2.motif_id, COUNT(*) as cnt
      FROM verb_records v1
      JOIN verb_records v2 ON v1.source_content_hash = v2.source_content_hash
      WHERE v1.motif_id = ? AND v2.motif_id != ? AND v2.motif_id IS NOT NULL
      GROUP BY v2.motif_id
      ORDER BY cnt DESC
      LIMIT 5
    `).all(motifId, motifId) as Array<{ motif_id: string; cnt: number }>;

    for (const c of conflicts) {
      counter.push(
        `${c.cnt} source passages also match motif '${c.motif_id}' — potential overlap or subsumption`,
      );
    }

    // Check for low-confidence domains
    const weakDomains = this.db.prepare(`
      SELECT domain, AVG(motif_confidence) as avg_conf, COUNT(*) as cnt
      FROM verb_records
      WHERE motif_id = ? AND domain IS NOT NULL AND domain != ''
      GROUP BY domain
      HAVING avg_conf < 0.3
      ORDER BY avg_conf ASC
      LIMIT 3
    `).all(motifId) as Array<{ domain: string; avg_conf: number; cnt: number }>;

    for (const w of weakDomains) {
      counter.push(
        `Domain '${w.domain}' has weak average confidence (${w.avg_conf.toFixed(2)}) across ${w.cnt} records`,
      );
    }

    return counter;
  }

  private buildEvidenceSummary(motif: MotifFrontmatter, evidence: MotifEvidence): string {
    const sourceTypeList = Array.from(evidence.sourceTypes).join(', ');
    return [
      `**${motif.name}** — current tier ${motif.tier}, proposed tier 2.`,
      ``,
      `- **Verb-record count:** ${evidence.verbRecordCount}`,
      `- **Domain count:** ${evidence.domainCount}`,
      `- **Source types:** ${sourceTypeList} (${evidence.sourceTypeCount} distinct)`,
      `- **Average confidence:** ${evidence.confidence.toFixed(3)}`,
      `- **Average Tier B score:** ${evidence.averageTierBScore.toFixed(3)}`,
      `- **Relationship edges:** ${evidence.relationshipEdges.length}`,
      `- **Cross-temporal evidence:** ${evidence.hasCrossTemporalEvidence ? 'Yes' : 'No'}`,
      `- **Conflicting evidence:** ${evidence.hasConflictingEvidence ? 'Yes — review required' : 'None'}`,
    ].join('\n');
  }

  // ── Promotion log (SQLite) ────────────────────────────────────────

  private ensurePromotionLogTable(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS promotion_log (
        id TEXT PRIMARY KEY,
        motif_id TEXT NOT NULL,
        motif_name TEXT NOT NULL,
        from_tier INTEGER NOT NULL,
        to_tier INTEGER NOT NULL,
        action TEXT NOT NULL,
        evidence_snapshot TEXT NOT NULL,
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_pl_motif ON promotion_log(motif_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_pl_action ON promotion_log(action)`);
  }

  private wasAlreadyPromoted(motifId: string, fromTier: number, toTier: number): boolean {
    const row = this.db.prepare(`
      SELECT COUNT(*) as cnt FROM promotion_log
      WHERE motif_id = ? AND from_tier = ? AND to_tier = ?
    `).get(motifId, fromTier, toTier) as { cnt: number };
    return row.cnt > 0;
  }

  /**
   * Check if a motif was promoted to its current tier by the processor
   * (vs. being manually curated at that tier before the processor existed).
   */
  private wasAutoPromoted(motifId: string, currentTier: number): boolean {
    const row = this.db.prepare(`
      SELECT COUNT(*) as cnt FROM promotion_log
      WHERE motif_id = ? AND to_tier = ? AND action IN ('auto-promoted', 'queued-for-review')
    `).get(motifId, currentTier) as { cnt: number };
    return row.cnt > 0;
  }

  private wasAlreadyDemoted(motifId: string, fromTier: number): boolean {
    const row = this.db.prepare(`
      SELECT COUNT(*) as cnt FROM promotion_log
      WHERE motif_id = ? AND from_tier = ? AND action = 'demoted'
    `).get(motifId, fromTier) as { cnt: number };
    return row.cnt > 0;
  }

  private insertPromotionLog(entry: PromotionLogEntry): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO promotion_log (id, motif_id, motif_name, from_tier, to_tier, action, evidence_snapshot, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.id,
      entry.motifId,
      entry.motifName,
      entry.fromTier,
      entry.toTier,
      entry.action,
      entry.evidenceSnapshot,
      entry.timestamp,
    );
  }

  private buildLogEntry(promotion: T0T1PromotionResult, action: PromotionLogEntry['action']): PromotionLogEntry {
    const id = `promo-${promotion.motifId}-t0t1-${Date.now()}`;
    return {
      id,
      motifId: promotion.motifId,
      motifName: promotion.motifName,
      fromTier: 0,
      toTier: 1,
      action,
      evidenceSnapshot: JSON.stringify({
        domainCount: promotion.evidence.domainCount,
        domains: promotion.evidence.domains,
        sourceTypeCount: promotion.evidence.sourceTypeCount,
        confidence: promotion.evidence.confidence,
        verbRecordCount: promotion.evidence.verbRecordCount,
      }),
      timestamp: promotion.timestamp,
    };
  }

  private buildLogEntryFromPacket(packet: T1T2ReviewPacket): PromotionLogEntry {
    const id = `promo-${packet.motifId}-t1t2-${Date.now()}`;
    return {
      id,
      motifId: packet.motifId,
      motifName: packet.motifName,
      fromTier: 1,
      toTier: 2,
      action: 'queued-for-review',
      evidenceSnapshot: JSON.stringify({
        domainCount: packet.evidence.domainCount,
        domains: packet.evidence.domains,
        sourceTypeCount: packet.evidence.sourceTypeCount,
        confidence: packet.evidence.confidence,
        validationProtocol: packet.validationProtocol,
      }),
      timestamp: packet.generatedAt,
    };
  }

  private buildLogEntryFromFlag(flag: T2T3Flag): PromotionLogEntry {
    const id = `promo-${flag.motifId}-t2t3-${Date.now()}`;
    return {
      id,
      motifId: flag.motifId,
      motifName: flag.motifName,
      fromTier: 2,
      toTier: 3,
      action: 'flagged',
      evidenceSnapshot: JSON.stringify({
        reason: flag.reason,
        thresholdsMet: flag.preliminaryThresholdsMet,
      }),
      timestamp: flag.generatedAt,
    };
  }

  private buildDemotionLogEntry(demotion: DemotionResult): PromotionLogEntry {
    const id = `demo-${demotion.motifId}-t${demotion.previousTier}t${demotion.newTier}-${Date.now()}`;
    return {
      id,
      motifId: demotion.motifId,
      motifName: demotion.motifName,
      fromTier: demotion.previousTier,
      toTier: demotion.newTier,
      action: 'demoted',
      evidenceSnapshot: JSON.stringify({
        reason: demotion.reason,
        failedConditions: demotion.failedConditions,
        domainCount: demotion.evidence.domainCount,
        evidenceQuality: demotion.evidence.evidenceQuality,
      }),
      timestamp: demotion.timestamp,
    };
  }
}
