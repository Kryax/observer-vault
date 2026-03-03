/**
 * SolutionRecord -- Full OCP schema type definition
 * 7 required facets: problemSolved, domains, validation,
 * implementation, composability, provenance, trust
 */

import type { TrustVector } from './trust-vector';

// ---------------------------------------------------------------------------
// Enums & Primitives
// ---------------------------------------------------------------------------

/** Cynefin domain classification */
export type CynefinDomain =
  | 'clear'
  | 'complicated'
  | 'complex'
  | 'chaotic'
  | 'disorder';

/** Validation method enum */
export type ValidationMethod =
  | 'test-suite'
  | 'peer-review'
  | 'production-use'
  | 'formal-proof'
  | 'community-consensus'
  | 'automated-analysis';

/** Implementation type */
export type ImplementationType =
  | 'library'
  | 'framework'
  | 'tool'
  | 'service'
  | 'pattern'
  | 'algorithm'
  | 'configuration';

// ---------------------------------------------------------------------------
// Supporting Interfaces
// ---------------------------------------------------------------------------

/** Validation evidence */
export interface ValidationEvidence {
  type: string;
  description: string;
  uri?: string;
}

/** Implementation reference */
export interface ImplementationRef {
  type: string; // 'repository' | 'package' | 'documentation'
  uri: string;
  description?: string;
}

/** Dependency reference */
export interface DependencyRef {
  name: string;
  version?: string;
  type: 'runtime' | 'dev' | 'peer' | 'optional';
  uri?: string;
}

/** Composability interface */
export interface ComposabilityInfo {
  inputs: string[];
  outputs: string[];
  dependencies: DependencyRef[];
  composableWith: string[]; // URIs of compatible solutions
  interfaceContract?: string;
}

/** Author/contributor */
export interface ActorRef {
  name: string;
  type: 'human' | 'ai' | 'system';
  uri?: string;
  org?: string;
}

// ---------------------------------------------------------------------------
// SolutionRecord
// ---------------------------------------------------------------------------

/** The full Solution Record -- 7 required facets */
export interface SolutionRecord {
  '@context': string | Record<string, unknown>;
  '@type': 'SolutionRecord';
  '@id': string;

  // Record metadata
  meta: {
    title: string;
    description: string;
    version: string;
    dateCreated: string; // ISO 8601
    dateModified: string;
    datePublished?: string;
    keywords?: string[];
    license?: string;
  };

  // Facet 1: Problem Solved
  problemSolved: {
    statement: string;
    context?: string;
    cynefinDomain: CynefinDomain;
    priorAttempts?: string[];
  };

  // Facet 2: Domains
  domains: string[];

  // Facet 3: Validation
  validation: {
    method: ValidationMethod;
    evidence: ValidationEvidence[];
    reproducibility?:
      | 'deterministic'
      | 'statistical'
      | 'contextual'
      | 'unreproducible';
    validatedBy?: ActorRef[];
    validationDate?: string;
  };

  // Facet 4: Implementation
  implementation: {
    type: ImplementationType;
    refs: ImplementationRef[];
    solutionApproach?: string;
    language?: string | string[];
    runtime?: string;
  };

  // Facet 5: Composability
  composability: ComposabilityInfo;

  // Facet 6: Provenance
  provenance: {
    authors: ActorRef[];
    contributors?: ActorRef[];
    sourceType: 'original' | 'scraped' | 'curated' | 'forked';
    derivedFrom?: string[];
    generatedBy?: string;
  };

  // Facet 7: Trust Indicators
  trust: {
    vector: TrustVector;
    confidence:
      | 'speculative'
      | 'provisional'
      | 'tested'
      | 'proven'
      | 'foundational';
    authority: 'low' | 'medium' | 'high';
    status: 'draft' | 'active' | 'deprecated' | 'superseded';
    endorsements?: string[];
    disputes?: string[];
    trustScore?: number; // Composite Trust Score (CTS)
  };

  // Optional sections
  governance?: {
    owner?: string;
    approvedBy?: string;
    approvalDate?: string;
  };

  federation?: {
    originNode?: string;
    mirroredAt?: string[];
    canonicalUri?: string;
  };

  extensions?: Record<string, unknown>;
}
