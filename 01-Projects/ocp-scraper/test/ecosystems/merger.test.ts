/**
 * Ecosyste.ms merger tests — TDD Red phase.
 * Tests: extractEnrichment, mergeEnrichment (supplements, never replaces).
 */
import { describe, test, expect } from 'bun:test';
import {
  extractEnrichment,
  mergeEnrichment,
  type EcosystemsEnrichment,
} from '../../src/ecosystems/merger';
import type { EcosystemsPackage } from '../../src/ecosystems/client';
import type { SolutionRecord } from '../../src/types/solution-record';
import type { TrustVector } from '../../src/types/trust-vector';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTrustVector(overrides?: Partial<TrustVector>): TrustVector {
  return {
    validation_count: 3,
    validation_diversity: 0.4,
    context_breadth: 0.3,
    temporal_stability: 0.5,
    test_coverage: 0.6,
    documentation_quality: 0.5,
    ...overrides,
  };
}

function makeRecord(overrides?: Partial<SolutionRecord>): SolutionRecord {
  return {
    '@context': 'https://schema.observercommons.org/v1',
    '@type': 'SolutionRecord',
    '@id': 'ocp:test/express',
    meta: {
      title: 'Express.js',
      description: 'Fast web framework',
      version: '1.0.0',
      dateCreated: '2024-01-01T00:00:00Z',
      dateModified: '2024-06-01T00:00:00Z',
      keywords: ['web', 'http'],
      license: 'MIT',
    },
    problemSolved: {
      statement: 'Building HTTP servers in Node.js',
      cynefinDomain: 'clear',
    },
    domains: ['web-development'],
    validation: {
      method: 'production-use',
      evidence: [
        { type: 'stars', description: '60000 GitHub stars' },
        { type: 'ci', description: 'CI pipeline passing' },
      ],
    },
    implementation: {
      type: 'framework',
      refs: [{ type: 'repository', uri: 'https://github.com/expressjs/express' }],
      language: 'JavaScript',
    },
    composability: {
      inputs: ['HTTP request'],
      outputs: ['HTTP response'],
      dependencies: [],
      composableWith: [],
    },
    provenance: {
      authors: [{ name: 'TJ Holowaychuk', type: 'human' }],
      sourceType: 'scraped',
    },
    trust: {
      vector: makeTrustVector(),
      confidence: 'tested',
      authority: 'high',
      status: 'active',
    },
    ...overrides,
  };
}

const MOCK_PKG: EcosystemsPackage = {
  name: 'express',
  ecosystem: 'npm',
  description: 'Fast, unopinionated, minimalist web framework',
  downloads: 50_000_000,
  downloads_period: 'last-month',
  dependent_packages_count: 75_000,
  dependent_repos_count: 2_500_000,
  latest_release_number: '4.21.0',
  latest_stable_release_number: '4.21.0',
  repository_url: 'https://github.com/expressjs/express',
  licenses: 'MIT',
  maintainers_count: 12,
  first_release_published_at: '2010-12-29T00:00:00Z',
  latest_release_published_at: '2024-10-01T00:00:00Z',
  keywords: ['web', 'framework', 'http', 'rest', 'api'],
};

// ---------------------------------------------------------------------------
// extractEnrichment
// ---------------------------------------------------------------------------

describe('extractEnrichment', () => {
  test('extracts download count', () => {
    const enrichment = extractEnrichment(MOCK_PKG);
    expect(enrichment.downloads).toBe(50_000_000);
  });

  test('extracts dependent package counts', () => {
    const enrichment = extractEnrichment(MOCK_PKG);
    expect(enrichment.dependentPackages).toBe(75_000);
    expect(enrichment.dependentRepos).toBe(2_500_000);
  });

  test('extracts latest version', () => {
    const enrichment = extractEnrichment(MOCK_PKG);
    expect(enrichment.latestVersion).toBe('4.21.0');
  });

  test('extracts ecosystem name', () => {
    const enrichment = extractEnrichment(MOCK_PKG);
    expect(enrichment.ecosystem).toBe('npm');
  });

  test('extracts maintainers count', () => {
    const enrichment = extractEnrichment(MOCK_PKG);
    expect(enrichment.maintainersCount).toBe(12);
  });

  test('extracts additional keywords', () => {
    const enrichment = extractEnrichment(MOCK_PKG);
    expect(enrichment.additionalKeywords).toEqual(['web', 'framework', 'http', 'rest', 'api']);
  });

  test('handles missing optional fields gracefully', () => {
    const minimal: EcosystemsPackage = {
      name: 'tiny',
      ecosystem: 'npm',
      downloads: 0,
      dependent_packages_count: 0,
      dependent_repos_count: 0,
    };
    const enrichment = extractEnrichment(minimal);
    expect(enrichment.downloads).toBe(0);
    expect(enrichment.latestVersion).toBeUndefined();
    expect(enrichment.maintainersCount).toBeUndefined();
    expect(enrichment.additionalKeywords).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// mergeEnrichment — the critical "supplement not replace" contract
// ---------------------------------------------------------------------------

describe('mergeEnrichment', () => {
  test('adds download evidence to validation.evidence', () => {
    const record = makeRecord();
    const enrichment = extractEnrichment(MOCK_PKG);
    const merged = mergeEnrichment(record, enrichment);

    const dlEvidence = merged.validation.evidence.find((e) => e.type === 'ecosystems:downloads');
    expect(dlEvidence).toBeDefined();
    expect(dlEvidence!.description).toContain('50000000');
  });

  test('adds dependent-packages evidence to validation.evidence', () => {
    const record = makeRecord();
    const enrichment = extractEnrichment(MOCK_PKG);
    const merged = mergeEnrichment(record, enrichment);

    const depEvidence = merged.validation.evidence.find(
      (e) => e.type === 'ecosystems:dependent-packages',
    );
    expect(depEvidence).toBeDefined();
    expect(depEvidence!.description).toContain('75000');
  });

  test('preserves ALL existing validation evidence (never overwrites)', () => {
    const record = makeRecord();
    const originalEvidenceCount = record.validation.evidence.length;
    const enrichment = extractEnrichment(MOCK_PKG);
    const merged = mergeEnrichment(record, enrichment);

    // Original evidence still present
    expect(merged.validation.evidence.length).toBeGreaterThan(originalEvidenceCount);
    const starEvidence = merged.validation.evidence.find((e) => e.type === 'stars');
    expect(starEvidence).toBeDefined();
    expect(starEvidence!.description).toBe('60000 GitHub stars');
  });

  test('NEVER modifies trust vector', () => {
    const record = makeRecord();
    const originalVector = { ...record.trust.vector };
    const enrichment = extractEnrichment(MOCK_PKG);
    const merged = mergeEnrichment(record, enrichment);

    expect(merged.trust.vector.validation_count).toBe(originalVector.validation_count);
    expect(merged.trust.vector.validation_diversity).toBe(originalVector.validation_diversity);
    expect(merged.trust.vector.context_breadth).toBe(originalVector.context_breadth);
    expect(merged.trust.vector.temporal_stability).toBe(originalVector.temporal_stability);
    expect(merged.trust.vector.test_coverage).toBe(originalVector.test_coverage);
    expect(merged.trust.vector.documentation_quality).toBe(originalVector.documentation_quality);
  });

  test('NEVER modifies trust confidence/authority/status', () => {
    const record = makeRecord();
    const enrichment = extractEnrichment(MOCK_PKG);
    const merged = mergeEnrichment(record, enrichment);

    expect(merged.trust.confidence).toBe('tested');
    expect(merged.trust.authority).toBe('high');
    expect(merged.trust.status).toBe('active');
  });

  test('NEVER overwrites meta fields', () => {
    const record = makeRecord();
    const enrichment = extractEnrichment(MOCK_PKG);
    const merged = mergeEnrichment(record, enrichment);

    expect(merged.meta.title).toBe('Express.js');
    expect(merged.meta.description).toBe('Fast web framework');
    expect(merged.meta.license).toBe('MIT');
  });

  test('merges keywords with deduplication', () => {
    const record = makeRecord();
    // Record has ['web', 'http'], enrichment has ['web', 'framework', 'http', 'rest', 'api']
    const enrichment = extractEnrichment(MOCK_PKG);
    const merged = mergeEnrichment(record, enrichment);

    const kw = merged.meta.keywords!;
    expect(kw).toContain('web');
    expect(kw).toContain('http');
    expect(kw).toContain('framework');
    expect(kw).toContain('rest');
    expect(kw).toContain('api');
    // No duplicates
    expect(kw.filter((k) => k === 'web').length).toBe(1);
    expect(kw.filter((k) => k === 'http').length).toBe(1);
  });

  test('adds ecosystem info to extensions', () => {
    const record = makeRecord();
    const enrichment = extractEnrichment(MOCK_PKG);
    const merged = mergeEnrichment(record, enrichment);

    expect(merged.extensions).toBeDefined();
    const eco = merged.extensions!['ecosystems'] as Record<string, unknown>;
    expect(eco).toBeDefined();
    expect(eco.ecosystem).toBe('npm');
    expect(eco.latestVersion).toBe('4.21.0');
    expect(eco.maintainersCount).toBe(12);
  });

  test('returns new object (does not mutate original)', () => {
    const record = makeRecord();
    const originalEvidence = [...record.validation.evidence];
    const enrichment = extractEnrichment(MOCK_PKG);
    const merged = mergeEnrichment(record, enrichment);

    expect(record.validation.evidence.length).toBe(originalEvidence.length);
    expect(merged).not.toBe(record);
  });

  test('handles empty enrichment gracefully', () => {
    const record = makeRecord();
    const emptyEnrichment: EcosystemsEnrichment = {};
    const merged = mergeEnrichment(record, emptyEnrichment);

    // Should return record essentially unchanged (but as new object)
    expect(merged.validation.evidence.length).toBe(record.validation.evidence.length);
    expect(merged.meta.keywords).toEqual(record.meta.keywords);
  });

  test('preserves existing extensions when adding ecosystem data', () => {
    const record = makeRecord({
      extensions: { custom: 'data', existing: 42 },
    });
    const enrichment = extractEnrichment(MOCK_PKG);
    const merged = mergeEnrichment(record, enrichment);

    expect(merged.extensions!['custom']).toBe('data');
    expect(merged.extensions!['existing']).toBe(42);
    expect(merged.extensions!['ecosystems']).toBeDefined();
  });
});
