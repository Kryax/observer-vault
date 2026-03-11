import { describe, expect, test } from 'bun:test';

import {
  assembleSepSolutionRecord,
  computeSepTrustVector,
  inferSepDomains,
  inferSepTopics,
  type SepEntryMetadata,
} from './sep';

const COMPLETE_ENTRY: SepEntryMetadata = {
  slug: 'embodied-cognition',
  title: 'Embodied Cognition',
  preamble: 'Embodied cognition addresses how intelligent activity depends on the body, environment, and situated forms of reasoning rather than treating cognition as a purely disembodied symbolic process.',
  authors: ['Lawrence Shapiro', 'Shannon Spaulding'],
  relatedEntries: ['phenomenology', 'artificial-intelligence', 'extended-mind'],
  publishedAt: '2021-06-25T00:00:00Z',
  revisedAt: '2026-01-09T00:00:00Z',
  firstSectionTitle: '1. The Foils and Inspirations for Embodied Cognition',
  firstSectionText: 'The entry contrasts computational cognitivism with ecological and phenomenological approaches.',
  bibliographyCount: 42,
  categoryStructure: {
    Philosophy: {
      Mind: ['Embodied Cognition'],
      Science: ['Cognitive Science'],
    },
  },
  entryUrl: 'https://plato.stanford.edu/entries/embodied-cognition/',
};

describe('SEP record assembly', () => {
  test('assembles a SolutionRecord with SEP provenance and topic derivation', () => {
    const record = assembleSepSolutionRecord(COMPLETE_ENTRY, {
      generatedAt: '2026-03-11T12:00:00Z',
    });

    expect(record['@id']).toBe('ocp:sep/embodied-cognition');
    expect(record.problemSolved.statement).toBe(COMPLETE_ENTRY.preamble);
    expect(record.meta.keywords).toEqual([
      'Philosophy / Mind / Embodied Cognition',
      'Philosophy / Science / Cognitive Science',
      'artificial intelligence',
      'extended mind',
      'phenomenology',
    ]);
    expect(record.domains).toEqual(['mind', 'philosophy-of-science', 'general-philosophy']);
    expect(record.provenance.contributors).toEqual([
      {
        name: 'Stanford Encyclopedia of Philosophy',
        type: 'system',
        uri: 'https://plato.stanford.edu',
      },
    ]);
    expect(record.implementation.refs).toEqual([
      {
        type: 'documentation',
        uri: 'https://plato.stanford.edu/entries/embodied-cognition/',
        description: 'SEP entry for embodied-cognition',
      },
    ]);
    expect(record.extensions).toMatchObject({
      sep: {
        slug: 'embodied-cognition',
        source: 'SEP',
        entryUrl: 'https://plato.stanford.edu/entries/embodied-cognition/',
        relatedEntries: ['phenomenology', 'artificial-intelligence', 'extended-mind'],
        categoryPaths: [
          'Philosophy / Mind / Embodied Cognition',
          'Philosophy / Science / Cognitive Science',
        ],
        bibliographyCount: 42,
        publishedAt: '2021-06-25T00:00:00.000Z',
        revisedAt: '2026-01-09T00:00:00.000Z',
      },
    });
  });

  test('handles sparse metadata conservatively', () => {
    const sparseEntry: SepEntryMetadata = {
      slug: 'bare-entry',
      title: 'Bare Entry',
      preamble: '',
      authors: [],
      relatedEntries: [],
      bibliographyCount: 0,
    };

    const record = assembleSepSolutionRecord(sparseEntry, {
      generatedAt: '2026-03-11T12:00:00Z',
    });

    expect(record.problemSolved.statement).toBe('Bare Entry — SEP preamble unavailable');
    expect(record.meta.keywords).toEqual([]);
    expect(record.domains).toEqual(['general-philosophy']);
    expect(record.trust.authority).toBe('low');
    expect(record.trust.vector.documentation_quality).toBeLessThanOrEqual(0.25);
    expect(record.trust.trustScore).toBeLessThan(0.25);
  });
});

describe('SEP trust adaptation', () => {
  test('trust rewards structural depth, bibliography, and revision signals', () => {
    const strongTrust = computeSepTrustVector(COMPLETE_ENTRY);
    const weakTrust = computeSepTrustVector({
      slug: 'legacy-note',
      title: 'Legacy Note',
      preamble: 'A short note.',
      authors: ['Single Author'],
      relatedEntries: [],
      publishedAt: '2001-01-01T00:00:00Z',
      revisedAt: '2001-01-01T00:00:00Z',
      bibliographyCount: 2,
      categoryStructure: null,
      firstSectionTitle: null,
      firstSectionText: '',
    });

    expect(strongTrust.validation_count).toBeGreaterThan(weakTrust.validation_count);
    expect(strongTrust.validation_diversity).toBeGreaterThan(weakTrust.validation_diversity);
    expect(strongTrust.context_breadth).toBeGreaterThan(weakTrust.context_breadth);
    expect(strongTrust.test_coverage).toBeGreaterThan(weakTrust.test_coverage);
    expect(strongTrust.documentation_quality).toBeGreaterThan(weakTrust.documentation_quality);
  });

  test('derives topics and domains from related entries and category structure', () => {
    const topics = inferSepTopics({
      relatedEntries: ['social-epistemology', 'virtue-ethics'],
      categoryPaths: ['Philosophy / Ethics', 'Philosophy / Epistemology'],
    });

    expect(topics).toEqual([
      'Philosophy / Epistemology',
      'Philosophy / Ethics',
      'social epistemology',
      'virtue ethics',
    ]);

    expect(inferSepDomains({
      title: 'Social Epistemology',
      relatedEntries: ['virtue-epistemology'],
      categoryPaths: ['Philosophy / Epistemology'],
    })).toEqual(['epistemology', 'general-philosophy']);
  });
});
