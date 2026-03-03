/**
 * CLI Command: ocp feedback — Phase 2c Query Feedback Loop
 *
 * Analyzes zero-match query logs, identifies clusters, and generates
 * template proposals that enter the Phase 2a governance pipeline.
 *
 * ISC-Feedback-2: Batch analysis identifies clusters from zero-match query logs
 * ISC-Feedback-3: Clustered query patterns generate template proposals automatically
 * ISC-Feedback-4: Generated proposals enter same governance pipeline as Phase 2a
 * ISC-Feedback-5: Human approval required before any proposed template becomes active
 * ISC-Dual-2:     Slow loop connects query patterns to template governance proposals
 */

import { Command } from 'commander';
import { existsSync } from 'fs';
import { SearchIndex } from '../store/index';
import { TemplateStore } from '../template/store';
import { analyzeFeedback } from '../feedback/analyzer';
import type { ProblemTemplate, TemplateProposal } from '../template/types';

const BASE_DIR = process.cwd();
const DB_PATH = `${BASE_DIR}/.ocp/index.db`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a slug-safe template ID from a name */
function nameToId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `template:${slug}`;
}

/** Pad a string to a fixed width */
function pad(s: string, width: number): string {
  return s.length >= width ? s.slice(0, width) : s + ' '.repeat(width - s.length);
}

/**
 * Convert a TemplateProposal from the feedback analyzer into a pending
 * ProblemTemplate. Enters the same governance pipeline as Phase 2a.
 *
 * CRITICAL: status is always 'pending' -- never auto-approve (ISC-Feedback-5).
 * proposedBy is 'feedback-analyzer' to distinguish from batch-generator proposals.
 */
function proposalToTemplate(proposal: TemplateProposal): ProblemTemplate {
  const now = new Date().toISOString();
  return {
    id: nameToId(proposal.name),
    name: proposal.name,
    description: proposal.description,
    category: proposal.category,
    cynefinDomain: proposal.cynefinDomain,
    version: '0.1.0',
    patterns: proposal.patterns,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    proposedBy: 'feedback-analyzer',
    reviewedBy: null,
    rejectionReason: null,
  };
}

// ---------------------------------------------------------------------------
// Command: ocp feedback
// ---------------------------------------------------------------------------

export const feedbackCommand = new Command('feedback')
  .description('Query feedback analysis and template evolution');

// ---------------------------------------------------------------------------
// Subcommand: ocp feedback analyze
// ---------------------------------------------------------------------------

feedbackCommand
  .command('analyze')
  .description('Analyze zero-match queries, cluster patterns, and propose new templates')
  .option('--since <date>', 'Only analyze queries since date (ISO 8601)')
  .option('--min-cluster <n>', 'Minimum cluster size to generate a proposal (default: 2)', '2')
  .action(async (opts) => {
    if (!existsSync(DB_PATH)) {
      console.log('\n  Index not found. Run "ocp scrape" first to populate the index.\n');
      return;
    }

    const minCluster = parseInt(opts.minCluster as string, 10) || 2;
    const index = new SearchIndex(DB_PATH);

    try {
      // Step 1: Read zero-match queries from the index
      const zeroQueries = index.getZeroMatchQueries(opts.since);

      console.log('\n  Feedback Analysis\n');

      if (zeroQueries.length === 0) {
        console.log('  No zero-match queries found.');
        if (opts.since) {
          console.log(`  (filtered to queries since ${opts.since})`);
        }
        console.log('  Zero-match queries are logged automatically during search.\n');
        return;
      }

      console.log(`  Found ${zeroQueries.length} zero-match queries.`);
      console.log(`  Minimum cluster size: ${minCluster}`);
      console.log('  Clustering and analyzing...\n');

      // Step 2: Run the feedback analyzer (ISC-Feedback-2, ISC-Feedback-3)
      const queryEntries = zeroQueries.map(q => ({
        query: q.query,
        timestamp: q.timestamp,
      }));

      const proposals = analyzeFeedback(queryEntries, {
        minClusterSize: minCluster,
      });

      if (proposals.length === 0) {
        console.log('  No clusters large enough to generate proposals.');
        console.log(`  Try lowering --min-cluster (currently ${minCluster}).\n`);
        return;
      }

      // Step 3: Save proposals as pending templates (ISC-Feedback-4, ISC-Feedback-5)
      const templateStore = new TemplateStore(BASE_DIR);
      let created = 0;
      let skipped = 0;

      console.log(`  Generated ${proposals.length} proposal(s):\n`);

      // Table header
      const header = `  ${pad('ID', 35)} ${pad('Category', 24)} ${pad('Queries', 8)} ${pad('Confidence', 11)} ${pad('Status', 8)}`;
      console.log(header);
      console.log('  ' + '-'.repeat(header.length - 2));

      for (const proposal of proposals) {
        const template = proposalToTemplate(proposal);

        if (templateStore.exists(template.id)) {
          console.log(
            `  ${pad(template.id, 35)} ${pad(template.category, 24)} ${pad(String(proposal.evidenceRepos.length), 8)} ${pad(proposal.confidence.toFixed(2), 11)} skipped`
          );
          skipped++;
          continue;
        }

        templateStore.save(template);
        created++;
        console.log(
          `  ${pad(template.id, 35)} ${pad(template.category, 24)} ${pad(String(proposal.evidenceRepos.length), 8)} ${pad(proposal.confidence.toFixed(2), 11)} created`
        );
      }

      console.log('');
      console.log(`  Summary: ${created} proposal(s) created, ${skipped} skipped (already exist)`);
      console.log('');
      console.log('  All proposals require human approval before becoming active.');
      console.log("  Use 'ocp template list --status pending' to review.");
      console.log("  Use 'ocp template approve <id>' to approve.\n");
    } finally {
      index.close();
    }
  });
