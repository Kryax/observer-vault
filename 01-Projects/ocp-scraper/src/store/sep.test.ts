import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import type { SolutionRecord } from '../types/solution-record';
import {
  buildSepGraphEdges,
  extractSepBibliographyTargets,
  extractSepRelatedEntries,
  extractSepSearchText,
  SearchIndex,
} from './index';

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('SEP store helpers', () => {
  test('derives related-entry edges and only bibliography edges with explicit SEP targets', () => {
    const record = createSepRecord();

    expect(extractSepRelatedEntries(record)).toEqual([
      {
        slug: 'phenomenology',
        title: 'Phenomenology',
        uri: 'https://plato.stanford.edu/entries/phenomenology/',
      },
      {
        slug: 'artificial-intelligence',
        title: 'Artificial Intelligence',
        uri: 'https://plato.stanford.edu/entries/artificial-intelligence/',
      },
    ]);

    expect(extractSepBibliographyTargets(record)).toEqual([
      {
        slug: 'enactivism',
        title: 'Enactivism',
        uri: 'https://plato.stanford.edu/entries/enactivism/',
      },
    ]);

    expect(buildSepGraphEdges(record)).toEqual([
      {
        targetId: 'ocp:sep/phenomenology',
        edgeType: 'related_to',
        weight: 0.85,
        metadata: {
          source: 'sep',
          relation: 'related_entry',
          slug: 'phenomenology',
          title: 'Phenomenology',
          uri: 'https://plato.stanford.edu/entries/phenomenology/',
        },
      },
      {
        targetId: 'ocp:sep/artificial-intelligence',
        edgeType: 'related_to',
        weight: 0.85,
        metadata: {
          source: 'sep',
          relation: 'related_entry',
          slug: 'artificial-intelligence',
          title: 'Artificial Intelligence',
          uri: 'https://plato.stanford.edu/entries/artificial-intelligence/',
        },
      },
      {
        targetId: 'ocp:sep/enactivism',
        edgeType: 'references',
        weight: 0.35,
        metadata: {
          source: 'sep',
          relation: 'bibliography',
          slug: 'enactivism',
          title: 'Enactivism',
          uri: 'https://plato.stanford.edu/entries/enactivism/',
        },
      },
    ]);
  });
});

describe('SearchIndex SEP indexing', () => {
  test('indexes title and SEP preamble text for search and persists related-entry edges', () => {
    const index = createIndex();

    try {
      index.index(createSepRecord());

      expect(index.search('embodied cognition').map((result) => result.id)).toEqual(['ocp:sep/embodied-cognition']);
      expect(index.search('sensorimotor coupling').map((result) => result.id)).toEqual(['ocp:sep/embodied-cognition']);

      expect(index.getNeighbors('ocp:sep/embodied-cognition')).toEqual(expect.arrayContaining([
        {
          target_id: 'ocp:sep/phenomenology',
          edge_type: 'related_to',
          weight: 0.85,
          metadata: JSON.stringify({
            source: 'sep',
            relation: 'related_entry',
            slug: 'phenomenology',
            title: 'Phenomenology',
            uri: 'https://plato.stanford.edu/entries/phenomenology/',
          }),
        },
      ]));
    } finally {
      index.close();
    }
  });

  test('surfaces extension search text without requiring bibliography fallback text', () => {
    const record = createSepRecord();

    expect(extractSepSearchText(record)).toContain('Sensorimotor coupling changes what cognition can be.');
    expect(extractSepSearchText(record)).toContain('Embodied approaches reject cognition as detached symbol shuffling.');
    expect(extractSepSearchText(record)).not.toContain('Merleau-Ponty 1945');
  });
});

function createIndex(): SearchIndex {
  const dir = mkdtempSync(join(tmpdir(), 'ocp-sep-store-'));
  tempDirs.push(dir);
  return new SearchIndex(join(dir, 'index.db'));
}

function createSepRecord(): SolutionRecord {
  const now = '2026-03-11T00:00:00.000Z';

  return {
    '@context': 'https://observer-commons.org/schema/v1',
    '@type': 'SolutionRecord',
    '@id': 'ocp:sep/embodied-cognition',
    meta: {
      title: 'Embodied Cognition',
      description: 'SEP entry overview.',
      version: '1.0.0',
      dateCreated: now,
      dateModified: now,
      keywords: ['embodiment', 'mind', 'cognition'],
      license: 'CC-BY-NC-ND-4.0',
    },
    problemSolved: {
      statement: 'A survey of the philosophical program around embodied cognition.',
      cynefinDomain: 'complex',
    },
    domains: ['philosophy', 'cognitive-science'],
    validation: {
      method: 'peer-review',
      evidence: [
        {
          type: 'editorial-review',
          description: 'Reviewed by the Stanford Encyclopedia of Philosophy editorial board.',
        },
      ],
      reproducibility: 'deterministic',
    },
    implementation: {
      type: 'pattern',
      refs: [
        {
          type: 'documentation',
          uri: 'https://plato.stanford.edu/entries/embodied-cognition/',
        },
      ],
    },
    composability: {
      inputs: [],
      outputs: [],
      dependencies: [],
      composableWith: [],
    },
    provenance: {
      authors: [{ name: 'Test Author', type: 'human' }],
      sourceType: 'scraped',
      generatedBy: 'sep-test-fixture',
    },
    trust: {
      vector: {
        validation_count: 1,
        validation_diversity: 0.8,
        context_breadth: 0.9,
        temporal_stability: 0.8,
        test_coverage: 0,
        documentation_quality: 0.95,
      },
      confidence: 'tested',
      authority: 'high',
      status: 'active',
      trustScore: 0.91,
    },
    extensions: {
      sep: {
        slug: 'embodied-cognition',
        preamble: 'Sensorimotor coupling changes what cognition can be.',
        firstSectionTitle: '1. The Foils and Inspirations for Embodied Cognition',
        firstSectionText: 'Embodied approaches reject cognition as detached symbol shuffling.',
        relatedEntries: [
          {
            slug: 'phenomenology',
            title: 'Phenomenology',
            uri: 'https://plato.stanford.edu/entries/phenomenology/',
          },
          {
            uri: 'https://plato.stanford.edu/entries/artificial-intelligence/',
            title: 'Artificial Intelligence',
          },
        ],
        bibliography: [
          {
            uri: 'https://plato.stanford.edu/entries/enactivism/',
            title: 'Enactivism',
          },
          {
            title: 'Merleau-Ponty 1945',
          },
        ],
      },
    },
  };
}
