import type { TrustVector } from '../types/trust-vector';
import { CTS_WEIGHTS } from '../types/trust-vector';
import type { RepoMetadata } from '../extract/metadata';
import type { ParsedReadme } from '../extract/readme';

/**
 * Trust Vector Calculator
 * Maps GitHub signals to the 6-dimension OCP Trust Vector.
 * Deterministic — no LLM calls.
 */

/**
 * Compute the 6-dimension Trust Vector from GitHub signals.
 *
 * Mapping strategy:
 * - validation_count: stars + forks (proxy for independent validations)
 * - validation_diversity: contributors diversity (more contributors = more diverse validation)
 * - context_breadth: topic count + language diversity (more topics = broader context)
 * - temporal_stability: age and maintenance regularity
 * - test_coverage: presence of CI indicators in topics/description
 * - documentation_quality: README quality score from fine filter
 */
export function computeTrustVector(
  metadata: RepoMetadata,
  readme: ParsedReadme | null,
  contributorsCount: number,
): TrustVector {
  return {
    validation_count: computeValidationCount(metadata),
    validation_diversity: computeValidationDiversity(metadata, contributorsCount),
    context_breadth: computeContextBreadth(metadata),
    temporal_stability: computeTemporalStability(metadata),
    test_coverage: computeTestCoverage(metadata),
    documentation_quality: computeDocumentationQuality(metadata, readme),
  };
}

/**
 * Validation count: stars + forks as proxy for independent validations.
 * Returns raw count (not normalized to 0-1).
 */
function computeValidationCount(metadata: RepoMetadata): number {
  // Stars and forks are the best available proxy for "people found this useful"
  // Weight stars more (passive validation) and forks (active reuse)
  return metadata.stars + (metadata.forks * 2);
}

/**
 * Validation diversity: how diverse are the contributors?
 * Normalized 0.0-1.0.
 */
function computeValidationDiversity(metadata: RepoMetadata, contributorsCount: number): number {
  const count = contributorsCount || metadata.contributorsCount || 1;

  // Logarithmic scale: 1 contributor = 0.0, 10 = 0.5, 100 = 0.75, 1000 = 1.0
  if (count <= 1) return 0.0;
  const score = Math.log10(count) / 3; // log10(1000) = 3
  return Math.min(Math.round(score * 100) / 100, 1.0);
}

/**
 * Context breadth: how many different contexts has this been applied in?
 * Proxied by topic count, language diversity, and fork count.
 * Normalized 0.0-1.0.
 */
function computeContextBreadth(metadata: RepoMetadata): number {
  let score = 0;

  // Topic count (up to 0.4)
  const topicScore = Math.min(metadata.topics.length / 10, 1.0) * 0.4;
  score += topicScore;

  // Language diversity (up to 0.3)
  const langCount = Object.keys(metadata.languages).length;
  const langScore = Math.min(langCount / 5, 1.0) * 0.3;
  score += langScore;

  // Forks as proxy for different-context reuse (up to 0.3)
  const forkScore = Math.min(Math.log10(Math.max(metadata.forks, 1)) / 3, 1.0) * 0.3;
  score += forkScore;

  return Math.round(score * 100) / 100;
}

/**
 * Temporal stability: how consistently maintained over time?
 * Considers age, recency of updates, and ratio of issues to stars.
 * Normalized 0.0-1.0.
 */
function computeTemporalStability(metadata: RepoMetadata): number {
  let score = 0;

  // Age contribution (up to 0.4): older = more stable, logarithmic
  // 30 days = low, 365 = medium, 1825 (5yr) = high
  const ageScore = Math.min(Math.log10(Math.max(metadata.ageInDays, 1)) / Math.log10(1825), 1.0) * 0.4;
  score += ageScore;

  // Recency contribution (up to 0.4): recently pushed = actively maintained
  // 0-30 days = high, 30-180 = medium, 180-730 = low, 730+ = very low
  let recencyScore = 0;
  if (metadata.daysSinceLastPush <= 30) recencyScore = 1.0;
  else if (metadata.daysSinceLastPush <= 180) recencyScore = 0.7;
  else if (metadata.daysSinceLastPush <= 730) recencyScore = 0.3;
  else recencyScore = 0.1;
  score += recencyScore * 0.4;

  // Issue ratio contribution (up to 0.2): low open issues relative to stars = healthy
  const issueRatio = metadata.stars > 0 ? metadata.openIssues / metadata.stars : 1;
  const issueScore = issueRatio < 0.05 ? 1.0 : issueRatio < 0.1 ? 0.7 : issueRatio < 0.3 ? 0.4 : 0.1;
  score += issueScore * 0.2;

  return Math.round(score * 100) / 100;
}

/**
 * Test coverage: evidence of automated testing.
 * Proxied by CI indicators in topics, badges, and description.
 * Normalized 0.0-1.0.
 */
function computeTestCoverage(metadata: RepoMetadata): number {
  let score = 0;
  const combined = (metadata.description + ' ' + metadata.topics.join(' ')).toLowerCase();

  // CI/testing indicators in topics or description
  const ciIndicators = ['ci', 'cd', 'github-actions', 'travis', 'circleci', 'jenkins', 'testing', 'test', 'coverage', 'codecov', 'coveralls'];
  const matches = ciIndicators.filter(ind => combined.includes(ind));
  score += Math.min(matches.length / 3, 1.0) * 0.5;

  // TypeScript/Rust/Go tend to have better type-safety (proxy for code quality)
  const typedLanguages = ['typescript', 'rust', 'go', 'java', 'kotlin', 'swift', 'c#'];
  if (metadata.language && typedLanguages.includes(metadata.language.toLowerCase())) {
    score += 0.2;
  }

  // Having a decent star-to-issue ratio suggests quality
  if (metadata.stars > 100 && metadata.openIssues / metadata.stars < 0.05) {
    score += 0.3;
  }

  return Math.min(Math.round(score * 100) / 100, 1.0);
}

/**
 * Documentation quality: how complete are the docs?
 * Uses README quality analysis if available, falls back to heuristics.
 * Normalized 0.0-1.0.
 */
function computeDocumentationQuality(metadata: RepoMetadata, readme: ParsedReadme | null): number {
  if (!readme) return 0.1; // No README = minimal docs

  let score = 0;

  // Has meaningful title (0.1)
  if (readme.title) score += 0.1;

  // Has problem statement / description (0.2)
  if (readme.problemStatement && readme.problemStatement.length > 30) score += 0.2;

  // Has installation section (0.15)
  if (readme.installSnippet) score += 0.15;

  // Has usage section (0.15)
  if (readme.usageSnippet) score += 0.15;

  // Has feature list (0.1)
  if (readme.featureList.length >= 3) score += 0.1;

  // Section count (up to 0.2)
  const sectionScore = Math.min(readme.sections.length / 8, 1.0) * 0.2;
  score += sectionScore;

  // Has homepage/docs link (0.1)
  if (metadata.homepage) score += 0.1;

  return Math.min(Math.round(score * 100) / 100, 1.0);
}

/**
 * Compute Composite Trust Score using weighted geometric mean.
 * Formula from Trust & Governance Framework.
 *
 * CTS = (v1^w1 * v2^w2 * ... * v6^w6) ^ (1 / sum(w1..w6))
 *
 * Default weights:
 *   validation_count: 0.25
 *   validation_diversity: 0.30
 *   context_breadth: 0.20
 *   temporal_stability: 0.10
 *   test_coverage: 0.10
 *   documentation_quality: 0.05
 */
export function computeCTS(vector: TrustVector): number {
  // Normalize validation_count to 0-1 range for geometric mean
  // Use logarithmic normalization: log10(count+1) / log10(10001)
  // This maps 0->0, 10->0.25, 100->0.50, 1000->0.75, 10000->1.0
  const normalizedCount = Math.log10(vector.validation_count + 1) / Math.log10(10001);

  const values: Record<string, number> = {
    validation_count: Math.max(normalizedCount, 0.001), // Avoid zero
    validation_diversity: Math.max(vector.validation_diversity, 0.001),
    context_breadth: Math.max(vector.context_breadth, 0.001),
    temporal_stability: Math.max(vector.temporal_stability, 0.001),
    test_coverage: Math.max(vector.test_coverage, 0.001),
    documentation_quality: Math.max(vector.documentation_quality, 0.001),
  };

  // Weighted geometric mean
  let logSum = 0;
  let weightSum = 0;

  for (const [key, weight] of Object.entries(CTS_WEIGHTS)) {
    const value = values[key];
    logSum += weight * Math.log(value);
    weightSum += weight;
  }

  const cts = Math.exp(logSum / weightSum);
  return Math.round(cts * 1000) / 1000; // 3 decimal places
}

/**
 * Update trust vector's search_validation dimension based on validation events.
 * Uses ratio of positive validations to total validations, with logarithmic scaling.
 * Returns a new TrustVector with the search_validation field populated.
 */
export function applyValidationToTrust(
  vector: TrustVector,
  positiveCount: number,
  negativeCount: number,
): TrustVector {
  const total = positiveCount + negativeCount;
  if (total === 0) return { ...vector, search_validation: 0 };

  // Positive ratio with confidence weighting
  // More validations = more confidence in the ratio
  const ratio = positiveCount / total;
  const confidenceWeight = Math.min(Math.log10(total + 1) / 2, 1.0); // log scale, caps at ~100 validations
  const score = Math.round(ratio * confidenceWeight * 100) / 100;

  return { ...vector, search_validation: score };
}
