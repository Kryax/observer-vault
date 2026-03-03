/**
 * Template Matching Engine -- Phase 2a Problem Template System
 *
 * Pure, deterministic matching function. Scores a repository's metadata
 * and dependencies against a set of ProblemTemplates using weighted
 * pattern matching (topic 0.4, dependency 0.4, description 0.2).
 *
 * ZERO LLM/AI imports. No fetch, no API calls, no randomness.
 */

import type { ProblemTemplate, MatchResult, PatternRule } from './types';
import type { RepoMetadata } from '../extract/metadata';
import type { DependencyRef } from '../types/solution-record';

// ---------------------------------------------------------------------------
// Weights
// ---------------------------------------------------------------------------

const TOPIC_WEIGHT = 0.4;
const DEPENDENCY_WEIGHT = 0.4;
const DESCRIPTION_WEIGHT = 0.2;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Match a repository against a set of templates.
 * Returns the best match (highest scoring above threshold) or a null result.
 *
 * Only considers templates with status === 'approved'.
 * DETERMINISTIC -- no randomness, no LLM calls.
 */
export function matchTemplate(
  metadata: RepoMetadata,
  dependencies: DependencyRef[],
  templates: ProblemTemplate[],
): MatchResult {
  const depNames = dependencies.map((d) => d.name);
  const approvedTemplates = templates.filter((t) => t.status === 'approved');

  let bestResult: MatchResult = nullMatchResult();

  for (const template of approvedTemplates) {
    const ruleScore = scorePatternRule(
      template.patterns,
      metadata.topics,
      depNames,
      metadata.description,
    );

    if (
      ruleScore.score >= template.patterns.minScore &&
      ruleScore.score > bestResult.score
    ) {
      bestResult = {
        template,
        score: ruleScore.score,
        matchedRules: {
          topicMatches: ruleScore.topicMatches,
          dependencyMatches: ruleScore.dependencyMatches,
          descriptionMatches: ruleScore.descriptionMatches,
        },
      };
    }
  }

  return bestResult;
}

/**
 * Match a repository against a single template. Useful for targeted matching
 * or testing individual template patterns.
 */
export function matchSingleTemplate(
  metadata: RepoMetadata,
  dependencies: DependencyRef[],
  template: ProblemTemplate,
): MatchResult {
  const depNames = dependencies.map((d) => d.name);
  const ruleScore = scorePatternRule(
    template.patterns,
    metadata.topics,
    depNames,
    metadata.description,
  );

  if (ruleScore.score >= template.patterns.minScore) {
    return {
      template,
      score: ruleScore.score,
      matchedRules: {
        topicMatches: ruleScore.topicMatches,
        dependencyMatches: ruleScore.dependencyMatches,
        descriptionMatches: ruleScore.descriptionMatches,
      },
    };
  }

  return nullMatchResult();
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/** Score a single pattern rule against repo data */
function scorePatternRule(
  rule: PatternRule,
  topics: string[],
  depNames: string[],
  description: string,
): {
  score: number;
  topicMatches: string[];
  dependencyMatches: string[];
  descriptionMatches: string[];
} {
  const topicMatches = findMatches(rule.topicPatterns, topics);
  const dependencyMatches = findMatches(rule.dependencyPatterns, depNames);
  const descriptionMatches = findDescriptionMatches(
    rule.descriptionPatterns,
    description,
  );

  // Calculate fraction matched for each category.
  // If a pattern list is empty, that category contributes 0 (not penalized).
  const topicFraction = safeFraction(
    topicMatches.length,
    rule.topicPatterns.length,
  );
  const depFraction = safeFraction(
    dependencyMatches.length,
    rule.dependencyPatterns.length,
  );
  const descFraction = safeFraction(
    descriptionMatches.length,
    rule.descriptionPatterns.length,
  );

  // Weighted score calculation.
  // When a pattern list is empty, redistribute its weight proportionally
  // to the non-empty categories so the score stays fair.
  const weights = redistributeWeights(
    rule.topicPatterns.length > 0,
    rule.dependencyPatterns.length > 0,
    rule.descriptionPatterns.length > 0,
  );

  const score =
    topicFraction * weights.topic +
    depFraction * weights.dependency +
    descFraction * weights.description;

  return {
    score: clamp01(score),
    topicMatches,
    dependencyMatches,
    descriptionMatches,
  };
}

// ---------------------------------------------------------------------------
// Pattern Matching Helpers
// ---------------------------------------------------------------------------

/**
 * Simple glob match supporting * wildcard.
 * - "*" matches any substring
 * - Exact match otherwise
 * - Case-insensitive
 */
function globMatch(pattern: string, value: string): boolean {
  const lowerPattern = pattern.toLowerCase();
  const lowerValue = value.toLowerCase();

  if (!lowerPattern.includes('*')) {
    return lowerValue === lowerPattern;
  }

  // Escape regex special characters except *, then replace * with .*
  const escaped = lowerPattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp('^' + escaped.replace(/\*/g, '.*') + '$');
  return regex.test(lowerValue);
}

/** Find which values match any of the given patterns. Returns matched values. */
function findMatches(patterns: string[], values: string[]): string[] {
  const matched: string[] = [];
  for (const pattern of patterns) {
    for (const value of values) {
      if (globMatch(pattern, value) && !matched.includes(pattern)) {
        matched.push(pattern);
        break; // One value matching is enough for this pattern
      }
    }
  }
  return matched;
}

/**
 * Find which description patterns are present in the description text.
 * Uses substring containment (case-insensitive) since descriptions
 * are freeform text, not discrete tokens like topics or dep names.
 */
function findDescriptionMatches(
  patterns: string[],
  description: string,
): string[] {
  const lowerDesc = description.toLowerCase();
  const matched: string[] = [];

  for (const pattern of patterns) {
    const lowerPattern = pattern.toLowerCase();
    if (lowerPattern.includes('*')) {
      // Glob match against the whole description
      // For descriptions, we check if the pattern appears anywhere (not anchored)
      const escaped = lowerPattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped.replace(/\*/g, '.*'));
      if (regex.test(lowerDesc)) {
        matched.push(pattern);
      }
    } else {
      if (lowerDesc.includes(lowerPattern)) {
        matched.push(pattern);
      }
    }
  }

  return matched;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/** Safe fraction: 0/0 = 0, otherwise numerator/denominator */
function safeFraction(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return numerator / denominator;
}

/** Clamp a number to [0, 1] */
function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Construct a null (no-match) result */
function nullMatchResult(): MatchResult {
  return {
    template: null,
    score: 0,
    matchedRules: {
      topicMatches: [],
      dependencyMatches: [],
      descriptionMatches: [],
    },
  };
}

/**
 * Redistribute weights when some pattern categories are empty.
 * If a category has no patterns, its weight gets redistributed
 * proportionally to the non-empty categories.
 */
function redistributeWeights(
  hasTopics: boolean,
  hasDeps: boolean,
  hasDesc: boolean,
): { topic: number; dependency: number; description: number } {
  const active: { key: 'topic' | 'dependency' | 'description'; weight: number }[] = [];

  if (hasTopics) active.push({ key: 'topic', weight: TOPIC_WEIGHT });
  if (hasDeps) active.push({ key: 'dependency', weight: DEPENDENCY_WEIGHT });
  if (hasDesc) active.push({ key: 'description', weight: DESCRIPTION_WEIGHT });

  // If no patterns at all, return zeroes
  if (active.length === 0) {
    return { topic: 0, dependency: 0, description: 0 };
  }

  const totalActive = active.reduce((sum, a) => sum + a.weight, 0);
  const result = { topic: 0, dependency: 0, description: 0 };

  for (const a of active) {
    result[a.key] = a.weight / totalActive;
  }

  return result;
}
