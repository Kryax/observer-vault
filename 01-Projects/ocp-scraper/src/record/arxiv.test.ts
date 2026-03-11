import { describe, expect, test } from 'bun:test';

import {
  assembleArxivSolutionRecord,
  computeArxivTrustVector,
  inferArxivDomains,
  type ArxivPaperMetadata,
} from './arxiv';

const COMPLETE_PAPER: ArxivPaperMetadata = {
  id: '2403.01234',
  title: 'Adaptive Retrieval for Scientific Workflows',
  abstract: 'We present a retrieval architecture for scientific workflows that improves literature-grounded planning, reduces hallucination, and supports reproducible evaluation across multiple benchmark settings with explicit ablations and error analysis.',
  authors: ['Ada Lovelace', 'Grace Hopper', 'Katherine Johnson'],
  categories: ['cs.LG', 'stat.ML'],
  published: '2024-03-02T00:00:00Z',
  updated: '2026-02-10T00:00:00Z',
  doi: '10.48550/arXiv.2403.01234',
  absUrl: 'https://arxiv.org/abs/2403.01234',
  pdfUrl: 'https://arxiv.org/pdf/2403.01234.pdf',
  comment: 'Accepted at a workshop on reproducible AI systems.',
  journalRef: 'Reproducible AI Systems Workshop 2025',
};

describe('arXiv record assembly', () => {
  test('assembles a SolutionRecord with DOI-aware provenance and refs', () => {
    const record = assembleArxivSolutionRecord(COMPLETE_PAPER, {
      generatedAt: '2026-03-11T12:00:00Z',
    });

    expect(record['@id']).toBe('ocp:arxiv/2403.01234');
    expect(record.problemSolved.statement).toBe(COMPLETE_PAPER.abstract);
    expect(record.domains).toEqual(['machine-learning', 'statistics']);
    expect(record.validation.method).toBe('peer-review');
    expect(record.provenance.contributors).toEqual([
      {
        name: 'arXiv',
        type: 'system',
        uri: 'https://arxiv.org',
      },
    ]);
    expect(record.implementation.refs.some((ref) => ref.uri === 'https://doi.org/10.48550/arXiv.2403.01234')).toBe(true);
    expect(record.extensions).toEqual({
      arxiv: {
        id: '2403.01234',
        source: 'arXiv',
        categories: ['cs.LG', 'stat.ML'],
        doi: '10.48550/arXiv.2403.01234',
        journalRef: 'Reproducible AI Systems Workshop 2025',
        comment: 'Accepted at a workshop on reproducible AI systems.',
        absUrl: 'https://arxiv.org/abs/2403.01234',
        pdfUrl: 'https://arxiv.org/pdf/2403.01234.pdf',
      },
    });
  });

  test('omits DOI ref when DOI is absent', () => {
    const record = assembleArxivSolutionRecord({
      ...COMPLETE_PAPER,
      doi: null,
      journalRef: null,
    });

    expect(record.validation.method).toBe('automated-analysis');
    expect(record.implementation.refs.some((ref) => ref.uri.startsWith('https://doi.org/'))).toBe(false);
    expect(record.provenance.derivedFrom).toEqual([
      'https://arxiv.org/abs/2403.01234',
      'https://arxiv.org/pdf/2403.01234.pdf',
    ]);
  });
});

describe('arXiv trust adaptation', () => {
  test('handles sparse metadata conservatively', () => {
    const sparsePaper: ArxivPaperMetadata = {
      id: '1501.00001',
      title: 'Sparse Note',
      abstract: '',
      authors: ['Solo Author'],
      categories: [],
      published: '2015-01-01T00:00:00Z',
    };

    const record = assembleArxivSolutionRecord(sparsePaper, {
      generatedAt: '2026-03-11T12:00:00Z',
    });

    expect(record.problemSolved.statement).toBe('Sparse Note — abstract unavailable');
    expect(record.domains).toEqual(['general']);
    expect(record.trust.vector.documentation_quality).toBeLessThanOrEqual(0.3);
    expect(record.trust.trustScore).toBeLessThan(0.35);
  });

  test('trust rewards recency, completeness, and category specificity', () => {
    const strongTrust = computeArxivTrustVector(COMPLETE_PAPER);
    const weakTrust = computeArxivTrustVector({
      id: '0901.00001',
      title: 'Legacy Draft',
      abstract: 'Short abstract.',
      authors: ['Single Author'],
      categories: ['misc.XX'],
      published: '2009-01-01T00:00:00Z',
      updated: '2010-01-01T00:00:00Z',
      doi: null,
      comment: null,
      journalRef: null,
    });

    expect(strongTrust.validation_count).toBeGreaterThan(weakTrust.validation_count);
    expect(strongTrust.context_breadth).toBeGreaterThan(weakTrust.context_breadth);
    expect(strongTrust.temporal_stability).toBeGreaterThan(weakTrust.temporal_stability);
    expect(strongTrust.test_coverage).toBeGreaterThan(weakTrust.test_coverage);
  });

  test('maps categories to domains deterministically', () => {
    expect(inferArxivDomains(['stat.ML', 'cs.LG', 'q-fin.TR'])).toEqual([
      'machine-learning',
      'finance',
      'statistics',
    ]);
  });
});
