/**
 * Batch Template Generator -- Phase 2a Problem Template System
 *
 * Generates TemplateProposals (NOT approved templates) from multiple
 * repository metadata bundles. Uses deterministic clustering by default;
 * LLM batch enrichment is an opt-in feature for future use.
 *
 * This is the ONLY module in the template system that may make LLM calls.
 */

import type { TemplateProposal, PatternRule } from './types';
import type { RepoMetadata } from '../extract/metadata';
import type { DependencyRef } from '../types/solution-record';
import type { CynefinDomain } from '../types/solution-record';

// ---------------------------------------------------------------------------
// Public Types
// ---------------------------------------------------------------------------

/** Input bundle for batch generation -- one per repo */
export interface GeneratorInput {
  metadata: RepoMetadata;
  dependencies: DependencyRef[];
}

/** Options for the batch generator */
export interface GeneratorOptions {
  /** Enable LLM-based generation (default: false -- deterministic fallback) */
  llmEnabled?: boolean;
  /** Minimum cluster size to generate a proposal (default: 2) */
  minClusterSize?: number;
  /** Minimum topic overlap fraction to cluster repos together (default: 0.3) */
  overlapThreshold?: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Batch generate template proposals from multiple repo metadata bundles.
 * Returns TemplateProposal[] -- these are NOT approved templates.
 * A human must review and approve them via the governance CLI.
 *
 * Default: deterministic clustering by topic similarity.
 * Optional: LLM enrichment via batch call (single call for all inputs).
 */
export async function batchGenerateTemplates(
  inputs: GeneratorInput[],
  options?: GeneratorOptions,
): Promise<TemplateProposal[]> {
  const llmEnabled = options?.llmEnabled ?? false;
  const minClusterSize = options?.minClusterSize ?? 2;
  const overlapThreshold = options?.overlapThreshold ?? 0.3;

  if (inputs.length === 0) {
    return [];
  }

  // Step 1: Cluster repos by topic overlap
  const clusters = clusterByTopicOverlap(inputs, overlapThreshold);

  // Step 2: Filter clusters below minimum size
  const viableClusters = clusters.filter((c) => c.length >= minClusterSize);

  if (viableClusters.length === 0) {
    return [];
  }

  // Step 3: Generate proposals from clusters
  if (llmEnabled) {
    // Future: LLM enrichment in a SINGLE batch call
    // For now, fall through to deterministic
    return generateDeterministicProposals(viableClusters, inputs.length);
  }

  return generateDeterministicProposals(viableClusters, inputs.length);
}

// ---------------------------------------------------------------------------
// Deterministic Clustering
// ---------------------------------------------------------------------------

/** A cluster is a group of GeneratorInput indices that share topic overlap */
type Cluster = GeneratorInput[];

/**
 * Cluster inputs by topic overlap using single-linkage-like approach.
 * Two repos are linked if their Jaccard similarity on topics >= threshold.
 */
function clusterByTopicOverlap(
  inputs: GeneratorInput[],
  threshold: number,
): Cluster[] {
  const n = inputs.length;
  // Union-Find for clustering
  const parent = Array.from({ length: n }, (_, i) => i);

  function find(x: number): number {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]!]!; // path compression
      x = parent[x]!;
    }
    return x;
  }

  function union(a: number, b: number): void {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  // Compare each pair and union if overlap is above threshold
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const topicsA = new Set(inputs[i]!.metadata.topics.map((t) => t.toLowerCase()));
      const topicsB = new Set(inputs[j]!.metadata.topics.map((t) => t.toLowerCase()));

      if (topicsA.size === 0 && topicsB.size === 0) continue;

      const intersection = new Set([...topicsA].filter((t) => topicsB.has(t)));
      const unionSize = new Set([...topicsA, ...topicsB]).size;
      const jaccard = unionSize > 0 ? intersection.size / unionSize : 0;

      if (jaccard >= threshold) {
        union(i, j);
      }
    }
  }

  // Group by root
  const groups = new Map<number, Cluster>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(inputs[i]!);
  }

  return Array.from(groups.values());
}

// ---------------------------------------------------------------------------
// Deterministic Proposal Generation
// ---------------------------------------------------------------------------

/**
 * Generate proposals from clusters deterministically.
 * Extracts common patterns from each cluster to form a TemplateProposal.
 */
function generateDeterministicProposals(
  clusters: Cluster[],
  totalInputs: number,
): TemplateProposal[] {
  const proposals: TemplateProposal[] = [];

  for (const cluster of clusters) {
    const proposal = clusterToProposal(cluster, totalInputs);
    if (proposal) {
      proposals.push(proposal);
    }
  }

  return proposals;
}

/**
 * Convert a cluster of repos into a single TemplateProposal.
 * Extracts the common topic patterns, dependency patterns,
 * and description keywords shared by repos in the cluster.
 */
function clusterToProposal(
  cluster: Cluster,
  totalInputs: number,
): TemplateProposal | null {
  if (cluster.length === 0) return null;

  // Extract common topics (appearing in >= 50% of cluster repos)
  const topicCounts = new Map<string, number>();
  for (const input of cluster) {
    for (const topic of input.metadata.topics) {
      const lower = topic.toLowerCase();
      topicCounts.set(lower, (topicCounts.get(lower) ?? 0) + 1);
    }
  }

  const commonTopicThreshold = Math.max(1, Math.floor(cluster.length * 0.5));
  const commonTopics = [...topicCounts.entries()]
    .filter(([_, count]) => count >= commonTopicThreshold)
    .sort((a, b) => b[1] - a[1])
    .map(([topic]) => topic);

  if (commonTopics.length === 0) return null;

  // Extract common dependencies (appearing in >= 50% of cluster repos)
  const depCounts = new Map<string, number>();
  for (const input of cluster) {
    const seen = new Set<string>();
    for (const dep of input.dependencies) {
      const lower = dep.name.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        depCounts.set(lower, (depCounts.get(lower) ?? 0) + 1);
      }
    }
  }

  const commonDepThreshold = Math.max(1, Math.floor(cluster.length * 0.5));
  const commonDeps = [...depCounts.entries()]
    .filter(([_, count]) => count >= commonDepThreshold)
    .sort((a, b) => b[1] - a[1])
    .map(([dep]) => dep);

  // Extract common description keywords (simple word frequency)
  const descKeywords = extractCommonKeywords(
    cluster.map((c) => c.metadata.description),
    commonTopicThreshold,
  );

  // Derive category from common topics
  const category = deriveCategory(commonTopics);

  // Derive Cynefin domain from cluster characteristics
  const cynefinDomain = deriveCynefinDomain(cluster);

  // Build name from category
  const name = commonTopics.slice(0, 3).join(' + ');

  // Build description
  const description = `Repos sharing patterns: ${commonTopics.join(', ')}. ` +
    `Based on ${cluster.length} repositories.`;

  // Build pattern rule
  const patterns: PatternRule = {
    topicPatterns: commonTopics,
    dependencyPatterns: commonDeps,
    descriptionPatterns: descKeywords,
    minScore: 0.3,
  };

  // Confidence: higher when cluster covers more of the total input
  const confidence = Math.min(1, cluster.length / Math.max(1, totalInputs));

  // Evidence repos
  const evidenceRepos = cluster.map((c) => c.metadata.fullName);

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

/** Stop words to exclude from keyword extraction */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
  'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'this',
  'that', 'these', 'those', 'it', 'its', 'not', 'no', 'so', 'if',
  'about', 'up', 'out', 'all', 'also', 'just', 'than', 'very',
]);

/**
 * Extract common keywords from multiple description strings.
 * Returns words appearing in >= threshold descriptions.
 */
function extractCommonKeywords(
  descriptions: string[],
  threshold: number,
): string[] {
  const wordCounts = new Map<string, number>();

  for (const desc of descriptions) {
    const words = new Set(
      desc
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2 && !STOP_WORDS.has(w)),
    );

    for (const word of words) {
      wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1);
    }
  }

  return [...wordCounts.entries()]
    .filter(([_, count]) => count >= threshold)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10) // Cap at 10 keywords
    .map(([word]) => word);
}

/**
 * Derive a category path from common topics.
 * Uses simple heuristic mapping from topic keywords to category hierarchy.
 */
function deriveCategory(topics: string[]): string {
  const topicSet = new Set(topics);

  // Infrastructure patterns
  if (topicSet.has('cache') || topicSet.has('caching') || topicSet.has('redis'))
    return 'infrastructure/caching';
  if (topicSet.has('database') || topicSet.has('sql') || topicSet.has('nosql'))
    return 'infrastructure/database';
  if (topicSet.has('queue') || topicSet.has('messaging') || topicSet.has('kafka'))
    return 'infrastructure/messaging';
  if (topicSet.has('docker') || topicSet.has('kubernetes') || topicSet.has('container'))
    return 'infrastructure/containerization';
  if (topicSet.has('monitoring') || topicSet.has('observability') || topicSet.has('metrics'))
    return 'infrastructure/observability';

  // Web patterns
  if (topicSet.has('react') || topicSet.has('vue') || topicSet.has('angular') || topicSet.has('frontend'))
    return 'web/frontend';
  if (topicSet.has('api') || topicSet.has('rest') || topicSet.has('graphql'))
    return 'web/api';
  if (topicSet.has('web') || topicSet.has('http'))
    return 'web/general';

  // Data patterns
  if (topicSet.has('machine-learning') || topicSet.has('ml') || topicSet.has('deep-learning'))
    return 'data/machine-learning';
  if (topicSet.has('data') || topicSet.has('analytics') || topicSet.has('pipeline'))
    return 'data/processing';

  // DevOps patterns
  if (topicSet.has('ci') || topicSet.has('cd') || topicSet.has('cicd') || topicSet.has('deployment'))
    return 'devops/cicd';
  if (topicSet.has('devops') || topicSet.has('automation'))
    return 'devops/general';

  // Security
  if (topicSet.has('security') || topicSet.has('auth') || topicSet.has('authentication'))
    return 'security/general';

  // Testing
  if (topicSet.has('testing') || topicSet.has('test') || topicSet.has('e2e'))
    return 'testing/general';

  // Fallback: use first topic as category
  return topics.length > 0 ? `general/${topics[0]}` : 'uncategorized';
}

/**
 * Derive Cynefin domain from cluster characteristics.
 * Heuristic based on cluster diversity and common patterns.
 */
function deriveCynefinDomain(cluster: Cluster): CynefinDomain {
  // Count unique languages
  const languages = new Set(
    cluster
      .map((c) => c.metadata.language)
      .filter((l): l is string => l !== null),
  );

  // Count average dependency count
  const avgDeps =
    cluster.reduce((sum, c) => sum + c.dependencies.length, 0) /
    cluster.length;

  // Simple heuristic:
  // - Few deps, single language, well-known topics -> 'clear'
  // - Moderate deps, some variation -> 'complicated'
  // - High variation, many deps -> 'complex'
  if (avgDeps < 5 && languages.size <= 1) return 'clear';
  if (avgDeps < 20 && languages.size <= 3) return 'complicated';
  return 'complex';
}
