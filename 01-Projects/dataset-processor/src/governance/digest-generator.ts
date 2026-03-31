/**
 * Digest Generator — produces per-run markdown summaries.
 *
 * Each digest covers:
 *   - Per-shard processing summary (candidates, yield, domain distribution)
 *   - Auto-promotions executed since last digest
 *   - T2 review queue additions
 *   - Anomalies (conflicting evidence, outlier yield, blind novel patterns)
 */

import { Database } from 'bun:sqlite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  DigestEntry,
  ShardSummary,
  AnomalyEntry,
  T0T1PromotionResult,
  DemotionResult,
  T1T2ReviewPacket,
  T2T3Flag,
} from './types.ts';

// ── Row types ───────────────────────────────────────────────────────

interface ShardStateRow {
  shard_id: string;
  candidates_produced: number;
  documents_processed: number;
}

interface DomainDistRow {
  domain: string;
  cnt: number;
}

interface BlindNovelRow {
  motif_id: string;
  domain: string;
  cnt: number;
}

interface ConflictMotifRow {
  motif_id: string;
  conflict_count: number;
}

// ── Digest Generator ────────────────────────────────────────────────

export interface DigestConfig {
  db: Database;
  outputDir: string;
}

export class DigestGenerator {
  private db: Database;
  private outputDir: string;

  constructor(config: DigestConfig) {
    this.db = config.db;
    this.outputDir = config.outputDir;
    mkdirSync(this.outputDir, { recursive: true });
  }

  /**
   * Generate a digest from the current run's results.
   */
  generate(
    autoPromotions: T0T1PromotionResult[],
    demotions: DemotionResult[],
    reviewPackets: T1T2ReviewPacket[],
    t2t3Flags: T2T3Flag[],
  ): DigestEntry {
    const shardSummaries = this.buildShardSummaries();
    const anomalies = this.detectAnomalies(shardSummaries, autoPromotions);

    const digest: DigestEntry = {
      generatedAt: new Date().toISOString(),
      shardSummaries,
      autoPromotions,
      demotions,
      t2QueueAdditions: reviewPackets,
      t2t3Flags,
      anomalies,
    };

    this.writeDigestMarkdown(digest);

    return digest;
  }

  // ── Shard summaries ───────────────────────────────────────────────

  private buildShardSummaries(): ShardSummary[] {
    const shardRows = this.db.prepare(`
      SELECT shard_id, candidates_produced, documents_processed
      FROM processing_state
      WHERE status = 'completed'
      ORDER BY shard_id
    `).all() as ShardStateRow[];

    const summaries: ShardSummary[] = [];

    for (const row of shardRows) {
      const yieldRate = row.documents_processed > 0
        ? (row.candidates_produced / row.documents_processed) * 100
        : 0;

      // Domain distribution for this shard's candidates
      const domainDist = this.getShardDomainDistribution(row.shard_id);

      summaries.push({
        shardId: row.shard_id,
        candidatesFound: row.candidates_produced,
        yieldRate,
        domainDistribution: domainDist,
      });
    }

    return summaries;
  }

  private getShardDomainDistribution(shardId: string): Record<string, number> {
    const rows = this.db.prepare(`
      SELECT domain, COUNT(*) as cnt
      FROM verb_records
      WHERE source_document_id LIKE ? AND domain IS NOT NULL AND domain != ''
      GROUP BY domain
      ORDER BY cnt DESC
    `).all(`%${shardId}%`) as DomainDistRow[];

    const dist: Record<string, number> = {};
    for (const row of rows) {
      dist[row.domain] = row.cnt;
    }
    return dist;
  }

  // ── Anomaly detection ─────────────────────────────────────────────

  private detectAnomalies(
    shardSummaries: ShardSummary[],
    autoPromotions: T0T1PromotionResult[],
  ): AnomalyEntry[] {
    const anomalies: AnomalyEntry[] = [];

    // 1. Conflicting evidence
    const conflictMotifs = this.db.prepare(`
      SELECT v1.motif_id, COUNT(*) as conflict_count
      FROM verb_records v1
      JOIN verb_records v2 ON v1.source_content_hash = v2.source_content_hash
      WHERE v1.motif_id IS NOT NULL AND v2.motif_id IS NOT NULL
        AND v1.motif_id != v2.motif_id
      GROUP BY v1.motif_id
      HAVING conflict_count > 5
      ORDER BY conflict_count DESC
      LIMIT 10
    `).all() as ConflictMotifRow[];

    for (const row of conflictMotifs) {
      anomalies.push({
        type: 'conflicting-evidence',
        description: `Motif '${row.motif_id}' has ${row.conflict_count} source passages that also match other motifs`,
        motifId: row.motif_id,
        severity: row.conflict_count > 20 ? 'critical' : 'warning',
      });
    }

    // 2. Outlier yield rates
    if (shardSummaries.length > 1) {
      const yields = shardSummaries
        .map(s => s.yieldRate)
        .filter(y => y > 0);

      if (yields.length > 1) {
        const mean = yields.reduce((a, b) => a + b, 0) / yields.length;
        const stdDev = Math.sqrt(
          yields.reduce((sum, y) => sum + (y - mean) ** 2, 0) / yields.length,
        );

        for (const shard of shardSummaries) {
          if (stdDev > 0 && Math.abs(shard.yieldRate - mean) > 2 * stdDev) {
            const direction = shard.yieldRate > mean ? 'high' : 'low';
            anomalies.push({
              type: 'outlier-yield',
              description: `Shard '${shard.shardId}' has ${direction} yield rate (${shard.yieldRate.toFixed(2)}%) — ${(Math.abs(shard.yieldRate - mean) / stdDev).toFixed(1)}σ from mean`,
              shardId: shard.shardId,
              severity: 'warning',
            });
          }
        }
      }
    }

    // 3. Blind extraction novel patterns
    const blindNovels = this.db.prepare(`
      SELECT motif_id, domain, COUNT(*) as cnt
      FROM verb_records
      WHERE extraction_method = 'blind' AND motif_is_novel = 1
      GROUP BY motif_id, domain
      HAVING cnt >= 3
      ORDER BY cnt DESC
      LIMIT 10
    `).all() as BlindNovelRow[];

    for (const row of blindNovels) {
      anomalies.push({
        type: 'blind-novel-pattern',
        description: `Blind extraction found ${row.cnt} novel instances for motif '${row.motif_id}' in domain '${row.domain}'`,
        motifId: row.motif_id,
        severity: 'info',
      });
    }

    // 4. Domain concentration
    for (const promotion of autoPromotions) {
      const domains = promotion.evidence.domains;
      if (domains.length > 0) {
        // Check if one domain dominates (>60% of records)
        const domainCounts = new Map<string, number>();
        // We already have the domain list; check the actual distribution from the store
        const rows = this.db.prepare(`
          SELECT domain, COUNT(*) as cnt
          FROM verb_records
          WHERE motif_id = ? AND domain IS NOT NULL
          GROUP BY domain
          ORDER BY cnt DESC
        `).all(promotion.motifId) as DomainDistRow[];

        const total = rows.reduce((sum, r) => sum + r.cnt, 0);
        if (rows.length > 0 && total > 0) {
          const topDomainPct = (rows[0]!.cnt / total) * 100;
          if (topDomainPct > 60) {
            anomalies.push({
              type: 'domain-concentration',
              description: `Auto-promoted motif '${promotion.motifId}' has ${topDomainPct.toFixed(0)}% of records in domain '${rows[0]!.domain}' — cross-domain breadth may be narrow`,
              motifId: promotion.motifId,
              severity: 'warning',
            });
          }
        }
      }
    }

    return anomalies;
  }

  // ── Markdown output ───────────────────────────────────────────────

  private writeDigestMarkdown(digest: DigestEntry): void {
    const date = digest.generatedAt.split('T')[0];
    const time = digest.generatedAt.split('T')[1]?.split('.')[0] ?? '';
    const fileName = `digest-${date}-${time.replace(/:/g, '')}.md`;
    const filePath = join(this.outputDir, fileName);

    const sections: string[] = [];

    // Header
    sections.push(`# Processing Digest — ${date}`);
    sections.push(`\n> Generated at ${digest.generatedAt}\n`);

    // Shard summaries
    sections.push(`## Shard Processing Summary\n`);
    if (digest.shardSummaries.length === 0) {
      sections.push('No completed shards in this run.\n');
    } else {
      sections.push('| Shard | Candidates | Yield Rate | Top Domains |');
      sections.push('|-------|-----------|------------|-------------|');
      for (const shard of digest.shardSummaries) {
        const topDomains = Object.entries(shard.domainDistribution)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([d, n]) => `${d} (${n})`)
          .join(', ');
        sections.push(
          `| ${shard.shardId} | ${shard.candidatesFound} | ${shard.yieldRate.toFixed(2)}% | ${topDomains || '—'} |`,
        );
      }
      sections.push('');
    }

    // Auto-promotions
    sections.push(`## Auto-Promotions (T0 → T1): ${digest.autoPromotions.length}\n`);
    if (digest.autoPromotions.length === 0) {
      sections.push('No auto-promotions this run.\n');
    } else {
      for (const p of digest.autoPromotions) {
        sections.push(`### ${p.motifName}`);
        sections.push(`- **Domains:** ${p.evidence.domainCount} (${p.evidence.domains.join(', ')})`);
        sections.push(`- **Source types:** ${p.evidence.sourceTypeCount}`);
        sections.push(`- **Confidence:** ${p.evidence.confidence.toFixed(3)}`);
        sections.push(`- **Verb-records:** ${p.evidence.verbRecordCount}`);
        sections.push('');
      }
    }

    // Demotions
    sections.push(`## Demotions (↓): ${digest.demotions.length}\n`);
    if (digest.demotions.length === 0) {
      sections.push('No demotions this run.\n');
    } else {
      for (const d of digest.demotions) {
        sections.push(`### ${d.motifName} (T${d.previousTier} → T${d.newTier})`);
        sections.push(`- **Reason:** ${d.reason}`);
        for (const fc of d.failedConditions) {
          sections.push(`  - ${fc}`);
        }
        sections.push(`- **Evidence quality:** ${d.evidence.evidenceQuality.toFixed(3)}`);
        sections.push(`- **Domains:** ${d.evidence.domainCount}`);
        sections.push('');
      }
    }

    // T2 review queue
    sections.push(`## T2 Review Queue Additions: ${digest.t2QueueAdditions.length}\n`);
    if (digest.t2QueueAdditions.length === 0) {
      sections.push('No T2 review candidates this run.\n');
    } else {
      for (const p of digest.t2QueueAdditions) {
        sections.push(`### ${p.motifName}`);
        sections.push(`- **Domains:** ${p.evidence.domainCount}`);
        sections.push(`- **Confidence:** ${p.evidence.confidence.toFixed(3)}`);
        sections.push(`- **Validation:** all 5 conditions pass`);
        sections.push(`- **Review packet:** promotion-queue-t2/${p.motifId}-review-${p.generatedAt.split('T')[0]}.md`);
        sections.push('');
      }
    }

    // T2 → T3 flags
    if (digest.t2t3Flags.length > 0) {
      sections.push(`## T2 → T3 Candidates Flagged: ${digest.t2t3Flags.length}\n`);
      for (const f of digest.t2t3Flags) {
        sections.push(`### ${f.motifName}`);
        sections.push(`- ${f.reason}`);
        for (const t of f.preliminaryThresholdsMet) {
          sections.push(`  - ${t}`);
        }
        sections.push('');
      }
    }

    // Anomalies
    sections.push(`## Anomalies: ${digest.anomalies.length}\n`);
    if (digest.anomalies.length === 0) {
      sections.push('No anomalies detected.\n');
    } else {
      for (const a of digest.anomalies) {
        const icon = a.severity === 'critical' ? '[CRITICAL]'
          : a.severity === 'warning' ? '[WARNING]'
          : '[INFO]';
        sections.push(`- ${icon} **${a.type}**: ${a.description}`);
      }
      sections.push('');
    }

    writeFileSync(filePath, sections.join('\n'));
  }
}
