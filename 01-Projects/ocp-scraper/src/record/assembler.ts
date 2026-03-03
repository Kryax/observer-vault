import { randomUUID } from 'crypto';
import type { SolutionRecord, DependencyRef } from '../types/solution-record';
import type { TrustVector } from '../types/trust-vector';
import type { RepoMetadata } from '../extract/metadata';
import type { ParsedReadme } from '../extract/readme';
import { OCP_CONTEXT } from './schema';
import { computeTrustVector, computeCTS } from './trust';
import { inferImplementationType, inferDomains } from '../extract/metadata';

/** Input data for assembling a Solution Record */
export interface AssemblerInput {
  metadata: RepoMetadata;
  readme: ParsedReadme | null;
  dependencies: DependencyRef[];
  contributorsCount: number;
  forgeName?: string; // 'github', 'codeberg.org', etc. — defaults to 'github'
}

/**
 * Generate a stable record ID from repo URL.
 * Uses the repo fullName to ensure idempotent IDs.
 * @param forge - Forge name prefix (e.g., 'github', 'codeberg.org'). Defaults to 'github'.
 */
export function generateRecordId(fullName: string, forge: string = 'github'): string {
  // Normalize: lowercase, replace / with --
  const slug = fullName.toLowerCase().replace(/\//g, '--');
  return `ocp:${forge}/${slug}`;
}

/**
 * Determine the primary domain directory for file storage.
 */
export function getPrimaryDomain(domains: string[]): string {
  // Filter out lang: prefixed domains
  const nonLang = domains.filter(d => !d.startsWith('lang:'));
  return nonLang[0] || domains[0] || 'general';
}

/**
 * Assemble a complete Solution Record from extracted data.
 */
export function assembleSolutionRecord(input: AssemblerInput): SolutionRecord {
  const { metadata, readme, dependencies, contributorsCount, forgeName } = input;
  const now = new Date().toISOString();
  const domains = inferDomains(metadata);
  const implType = inferImplementationType(metadata);

  // Compute trust vector from GitHub signals
  const trustVector = computeTrustVector(metadata, readme, contributorsCount);
  const trustScore = computeCTS(trustVector);

  // Determine confidence level based on signals
  const confidence = trustScore >= 0.7 ? 'tested' :
    trustScore >= 0.4 ? 'provisional' : 'speculative';

  // Build problem statement
  const problemStatement = readme?.problemStatement ||
    metadata.description ||
    `${metadata.name} — problem statement not available in README`;

  const record: SolutionRecord = {
    '@context': OCP_CONTEXT,
    '@type': 'SolutionRecord',
    '@id': generateRecordId(metadata.fullName, forgeName),

    meta: {
      title: readme?.title || metadata.name,
      description: metadata.description || readme?.description || '',
      version: '1.0.0',
      dateCreated: now,
      dateModified: now,
      keywords: metadata.topics,
      license: metadata.license || undefined,
    },

    // Facet 1: Problem Solved
    problemSolved: {
      statement: problemStatement,
      context: readme?.description || undefined,
      cynefinDomain: 'complex', // Default for scraped repos — most GitHub projects
    },

    // Facet 2: Domains
    domains,

    // Facet 3: Validation
    validation: {
      method: 'community-consensus',
      evidence: [
        {
          type: 'github-stars',
          description: `${metadata.stars} GitHub stars indicating community adoption`,
        },
        {
          type: 'github-forks',
          description: `${metadata.forks} forks indicating reuse`,
        },
      ],
      reproducibility: 'contextual',
      validationDate: now,
    },

    // Facet 4: Implementation
    implementation: {
      type: implType,
      refs: [
        {
          type: 'repository',
          uri: metadata.url,
          description: `GitHub repository: ${metadata.fullName}`,
        },
      ],
      solutionApproach: readme?.usageSnippet ? 'See usage section in README' : undefined,
      language: metadata.language || undefined,
    },

    // Facet 5: Composability
    composability: {
      inputs: [],
      outputs: [],
      dependencies: dependencies.filter(d => d.type === 'runtime'),
      composableWith: [],
    },

    // Facet 6: Provenance
    provenance: {
      authors: [{
        name: metadata.fullName.split('/')[0] || 'unknown',
        type: 'human',
        uri: `https://github.com/${metadata.fullName.split('/')[0]}`,
      }],
      sourceType: 'scraped',
      generatedBy: 'ocp-scraper/0.1.0',
    },

    // Facet 7: Trust Indicators
    trust: {
      vector: trustVector,
      confidence,
      authority: 'low', // Scraped records always start low
      status: 'draft',
      trustScore,
    },
  };

  // Add homepage if available
  if (metadata.homepage) {
    record.implementation.refs.push({
      type: 'documentation',
      uri: metadata.homepage,
      description: 'Project homepage',
    });
  }

  return record;
}
