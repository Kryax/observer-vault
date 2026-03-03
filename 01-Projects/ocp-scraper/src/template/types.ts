/**
 * Template Type Definitions — Phase 2a Problem Template System
 *
 * Defines the schema for Problem Templates, which are the unit of
 * classification in the OCP knowledge graph. Templates represent
 * problem categories (e.g., "infrastructure/caching") and contain
 * pattern rules for deterministic repo-to-template matching.
 */

import type { CynefinDomain } from '../types/solution-record';

// ---------------------------------------------------------------------------
// Pattern Matching
// ---------------------------------------------------------------------------

/** Pattern rule for matching repos to templates */
export interface PatternRule {
  /** Topic patterns to match against repo topics (glob-like) */
  topicPatterns: string[];
  /** Dependency name patterns to match against repo dependencies */
  dependencyPatterns: string[];
  /** Description keyword patterns */
  descriptionPatterns: string[];
  /** Minimum match score threshold (0-1) to qualify */
  minScore: number;
}

// ---------------------------------------------------------------------------
// Problem Template
// ---------------------------------------------------------------------------

/** A Problem Template -- the unit of classification */
export interface ProblemTemplate {
  /** Unique template ID: template:<slug> */
  id: string;
  /** Human-readable template name */
  name: string;
  /** Description of the problem category */
  description: string;
  /** Category path: e.g., "infrastructure/caching" */
  category: string;
  /** Cynefin domain classification */
  cynefinDomain: CynefinDomain;
  /** Semantic version of this template */
  version: string;
  /** Pattern rules for deterministic matching */
  patterns: PatternRule;
  /** Template status */
  status: 'pending' | 'approved' | 'rejected';
  /** ISO 8601 creation timestamp */
  createdAt: string;
  /** ISO 8601 last update timestamp */
  updatedAt: string;
  /** Who proposed it */
  proposedBy: string;
  /** Who approved/rejected it (null if pending) */
  reviewedBy: string | null;
  /** Rejection reason if rejected */
  rejectionReason: string | null;
}

// ---------------------------------------------------------------------------
// Template Proposal
// ---------------------------------------------------------------------------

/** Template proposal from batch generation -- NOT yet a template */
export interface TemplateProposal {
  /** Suggested template name */
  name: string;
  /** Suggested description */
  description: string;
  /** Suggested category path */
  category: string;
  /** Suggested Cynefin domain */
  cynefinDomain: CynefinDomain;
  /** Suggested pattern rules */
  patterns: PatternRule;
  /** Evidence: which repos inspired this proposal */
  evidenceRepos: string[];
  /** Confidence score from generator (0-1) */
  confidence: number;
}

// ---------------------------------------------------------------------------
// Match Result
// ---------------------------------------------------------------------------

/** Result of matching a repo against templates */
export interface MatchResult {
  /** The matched template (null if no match) */
  template: ProblemTemplate | null;
  /** Match score (0-1) */
  score: number;
  /** Which pattern rules contributed to the match */
  matchedRules: {
    topicMatches: string[];
    dependencyMatches: string[];
    descriptionMatches: string[];
  };
}
