/**
 * Feedback Analyzer -- Phase 2c Query Feedback Loop
 *
 * Analyzes zero-match query logs to identify knowledge gaps, clusters them
 * by word overlap, and generates TemplateProposal objects that enter the
 * same governance pipeline as Phase 2a batch-generated proposals.
 *
 * ISC-Feedback-2: Batch analysis identifies clusters from zero-match query logs
 * ISC-Feedback-3: Clustered query patterns generate template proposals automatically
 * ISC-Feedback-4: Generated proposals enter same governance pipeline as Phase 2a
 * ISC-Dual-2:     Slow loop connects query patterns to template governance proposals
 *
 * All proposals are generated with status 'pending' -- human approval is required
 * before any proposed template becomes active (ISC-Feedback-5).
 */

import { clusterQueries, type Cluster } from '../cli/gaps';
import type { TemplateProposal, PatternRule } from '../template/types';
import type { CynefinDomain } from '../types/solution-record';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface AnalyzerOptions {
  /** Minimum cluster size to generate a proposal (default: 2) */
  minClusterSize?: number;
  /** Jaccard similarity threshold for clustering (default: 0.3) */
  clusterThreshold?: number;
}

/**
 * Analyze zero-match queries and generate template proposals.
 *
 * Takes raw zero-match query entries, clusters them by word overlap using
 * the same Jaccard clustering from gaps.ts, then converts viable clusters
 * into TemplateProposal objects ready for the governance pipeline.
 *
 * @returns TemplateProposal[] -- proposals with proposedBy 'feedback-analyzer'
 */
export function analyzeFeedback(
  queries: { query: string; timestamp: string }[],
  options?: AnalyzerOptions,
): TemplateProposal[] {
  const minClusterSize = options?.minClusterSize ?? 2;
  const threshold = options?.clusterThreshold ?? 0.3;

  if (queries.length === 0) {
    return [];
  }

  // Step 1: Cluster queries by word overlap (ISC-Feedback-2)
  const clusters = clusterQueries(queries, threshold);

  // Step 2: Filter clusters below minimum size
  const viableClusters = clusters.filter(c => c.queries.length >= minClusterSize);

  if (viableClusters.length === 0) {
    return [];
  }

  // Step 3: Convert each viable cluster into a TemplateProposal (ISC-Feedback-3)
  const proposals: TemplateProposal[] = [];

  for (const cluster of viableClusters) {
    const proposal = clusterToProposal(cluster, queries.length);
    if (proposal) {
      proposals.push(proposal);
    }
  }

  return proposals;
}

// ---------------------------------------------------------------------------
// Cluster-to-Proposal Conversion
// ---------------------------------------------------------------------------

/**
 * Convert a query cluster into a TemplateProposal.
 *
 * Derives category, patterns, and confidence from the cluster's keywords
 * and query count. Mirrors the deterministic approach in template/generator.ts.
 */
function clusterToProposal(
  cluster: Cluster,
  totalQueries: number,
): TemplateProposal | null {
  const { keywords, queries } = cluster;

  if (keywords.length === 0) {
    return null;
  }

  // Derive category from cluster keywords using same heuristic as generator.ts
  const category = deriveCategory(keywords);

  // Build a human-readable name from top keywords
  const name = keywords.slice(0, 3).join(' + ');

  // Build description with evidence
  const description =
    `Feedback-driven proposal from ${queries.length} zero-match queries ` +
    `sharing keywords: ${keywords.join(', ')}.`;

  // Pattern rules: keywords become topic patterns for matching
  const patterns: PatternRule = {
    topicPatterns: keywords,
    dependencyPatterns: [],
    descriptionPatterns: keywords,
    minScore: 0.3,
  };

  // Confidence: based on cluster size relative to total queries, capped at 1.0
  const confidence = Math.min(1.0, queries.length / Math.max(1, totalQueries));

  // Evidence: the actual queries that formed this cluster
  const evidenceRepos = queries.map(q => q.query);

  // Cynefin domain: feedback-driven proposals are inherently exploratory
  const cynefinDomain: CynefinDomain = deriveCynefinDomain(queries.length);

  return {
    name,
    description,
    category,
    cynefinDomain,
    patterns,
    evidenceRepos,
    confidence,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive a category path from cluster keywords.
 * Uses the same heuristic mapping as template/generator.ts.
 */
function deriveCategory(keywords: string[]): string {
  const keywordSet = new Set(keywords);

  // Infrastructure patterns
  if (keywordSet.has('cache') || keywordSet.has('caching') || keywordSet.has('redis'))
    return 'infrastructure/caching';
  if (keywordSet.has('database') || keywordSet.has('sql') || keywordSet.has('nosql'))
    return 'infrastructure/database';
  if (keywordSet.has('queue') || keywordSet.has('messaging') || keywordSet.has('kafka'))
    return 'infrastructure/messaging';
  if (keywordSet.has('docker') || keywordSet.has('kubernetes') || keywordSet.has('container'))
    return 'infrastructure/containerization';
  if (keywordSet.has('monitoring') || keywordSet.has('observability') || keywordSet.has('metrics'))
    return 'infrastructure/observability';

  // Web patterns
  if (keywordSet.has('react') || keywordSet.has('vue') || keywordSet.has('angular') || keywordSet.has('frontend'))
    return 'web/frontend';
  if (keywordSet.has('api') || keywordSet.has('rest') || keywordSet.has('graphql'))
    return 'web/api';
  if (keywordSet.has('web') || keywordSet.has('http'))
    return 'web/general';

  // Data patterns
  if (keywordSet.has('machine-learning') || keywordSet.has('ml') || keywordSet.has('deep-learning'))
    return 'data/machine-learning';
  if (keywordSet.has('data') || keywordSet.has('analytics') || keywordSet.has('pipeline'))
    return 'data/processing';

  // DevOps patterns
  if (keywordSet.has('ci') || keywordSet.has('cd') || keywordSet.has('cicd') || keywordSet.has('deployment'))
    return 'devops/cicd';
  if (keywordSet.has('devops') || keywordSet.has('automation'))
    return 'devops/general';

  // Security
  if (keywordSet.has('security') || keywordSet.has('auth') || keywordSet.has('authentication'))
    return 'security/general';

  // Testing
  if (keywordSet.has('testing') || keywordSet.has('test') || keywordSet.has('e2e'))
    return 'testing/general';

  // Fallback: use first keyword as category
  return keywords.length > 0 ? `general/${keywords[0]}` : 'uncategorized';
}

/**
 * Derive Cynefin domain from cluster characteristics.
 * Feedback-driven proposals are exploratory by nature -- we use query
 * volume as a rough signal of how well-understood the domain is.
 */
function deriveCynefinDomain(queryCount: number): CynefinDomain {
  // Many queries suggest a well-known gap (people keep searching for it)
  if (queryCount >= 10) return 'complicated';
  // Moderate queries suggest an emerging pattern
  if (queryCount >= 5) return 'complex';
  // Few queries -- still exploratory
  return 'complex';
}
