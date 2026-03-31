/**
 * Governance module — automated tier promotion for the motif library.
 *
 * Public API:
 *   runGovernance(config) — execute a full promotion pass with digest output.
 */

export { TierPromoter, type TierPromoterConfig, type PromotionRunResult } from './tier-promoter.ts';
export { DigestGenerator, type DigestConfig } from './digest-generator.ts';
export { aggregateMotifEvidence, aggregateAllMotifEvidence } from './evidence-aggregator.ts';
export { readMotifLibrary, motifIdFromFileName } from './motif-library-reader.ts';
export type {
  MotifFrontmatter,
  MotifEvidence,
  T0T1PromotionResult,
  DemotionResult,
  T1T2ReviewPacket,
  T2T3Flag,
  ValidationProtocolResult,
  PromotionLogEntry,
  DigestEntry,
  ShardSummary,
  AnomalyEntry,
} from './types.ts';

import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import { TierPromoter } from './tier-promoter.ts';
import { DigestGenerator } from './digest-generator.ts';
import type { PromotionRunResult } from './tier-promoter.ts';
import type { DigestEntry } from './types.ts';

export interface GovernanceConfig {
  dbPath: string;
  motifLibraryPath: string;
  promotionQueuePath: string;
  digestOutputPath: string;
  /** When true, no filesystem writes or DB inserts. Evaluations run normally. */
  dryRun?: boolean;
}

export interface GovernanceResult {
  promotions: PromotionRunResult;
  digest: DigestEntry;
}

/**
 * Run the full governance pass: tier promotion evaluation + digest generation.
 *
 * Opens a database connection, runs promotions, generates the digest,
 * and returns both results. Caller is responsible for the database lifecycle
 * when using the TierPromoter/DigestGenerator classes directly.
 */
export function runGovernance(config: GovernanceConfig): GovernanceResult {
  const db = new Database(config.dbPath);
  db.run('PRAGMA journal_mode=WAL');

  try {
    const promoter = new TierPromoter({
      db,
      motifLibraryPath: config.motifLibraryPath,
      promotionQueuePath: config.promotionQueuePath,
      dryRun: config.dryRun,
    });

    const promotions = promoter.run();

    const digestGen = new DigestGenerator({
      db,
      outputDir: config.dryRun
        ? join(config.digestOutputPath, 'sandbox')
        : config.digestOutputPath,
    });

    const digest = digestGen.generate(
      promotions.autoPromotions,
      promotions.demotions,
      promotions.reviewPackets,
      promotions.t2t3Flags,
    );

    const mode = config.dryRun ? '[SANDBOX] ' : '';
    console.error(
      `[governance] ${mode}Complete: ${promotions.autoPromotions.length} auto-promotions, ` +
      `${promotions.demotions.length} demotions, ` +
      `${promotions.reviewPackets.length} T2 review packets, ` +
      `${promotions.t2t3Flags.length} T2→T3 flags, ` +
      `${digest.anomalies.length} anomalies`,
    );

    return { promotions, digest };
  } finally {
    db.close();
  }
}
