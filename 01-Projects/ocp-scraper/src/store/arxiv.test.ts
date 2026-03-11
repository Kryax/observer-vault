import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import type { SolutionRecord } from '../types/solution-record';
import { buildArxivCategoryEdges, extractArxivCategories, SearchIndex } from './index';

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('arXiv store helpers', () => {
  test('extracts deterministic categories and co-occurrence edges', () => {
    const record = createArxivRecord({
      id: 'ocp:arxiv/2401.00001',
      title: 'Planning with diffusion world models',
      description: 'A deterministic abstract.',
      keywords: ['diffusion', 'cs.AI', 'cs.LG'],
      categories: ['cs.AI', 'cs.LG'],
    });

    expect(extractArxivCategories(record)).toEqual(['cs.AI', 'cs.LG']);
    expect(buildArxivCategoryEdges(record)).toEqual([
      {
        targetId: 'arxiv:category:cs.AI',
        edgeType: 'classified_as',
        weight: 0.9,
        metadata: { source: 'arxiv', category: 'cs.AI', role: 'primary' },
      },
      {
        targetId: 'arxiv:category:cs.LG',
        edgeType: 'classified_as',
        weight: 0.7,
        metadata: { source: 'arxiv', category: 'cs.LG', role: 'secondary' },
      },
      {
        targetId: 'arxiv:category:cs.AI__cs.LG',
        edgeType: 'category_cooccurs_with',
        weight: 0.5,
        metadata: {
          source: 'arxiv',
          categories: ['cs.AI', 'cs.LG'],
          primaryCategory: 'cs.AI',
        },
      },
    ]);
  });
});

describe('SearchIndex arXiv indexing', () => {
  test('indexes arXiv-style title and abstract text for search', () => {
    const index = createIndex();
    try {
      index.index(createArxivRecord({
        id: 'ocp:arxiv/2401.00002',
        title: 'Diffusion Planning for Embodied Agents',
        description: 'We study in-context adaptation with world models for long-horizon control.',
        keywords: ['diffusion', 'world-models', 'cs.AI'],
        categories: ['cs.AI'],
      }));

      expect(index.search('diffusion').map((result) => result.id)).toEqual(['ocp:arxiv/2401.00002']);
      expect(index.search('world models').map((result) => result.id)).toEqual(['ocp:arxiv/2401.00002']);
      expect(index.search('in-context adaptation').map((result) => result.id)).toEqual(['ocp:arxiv/2401.00002']);
    } finally {
      index.close();
    }
  });

  test('reindexing the same arXiv record refreshes FTS content', () => {
    const index = createIndex();
    try {
      index.index(createArxivRecord({
        id: 'ocp:arxiv/2401.00003',
        title: 'Transformer Circuit Analysis',
        description: 'Mechanistic interpretability with transformer circuits.',
        keywords: ['transformers', 'cs.LG'],
        categories: ['cs.LG'],
      }));

      index.index(createArxivRecord({
        id: 'ocp:arxiv/2401.00003',
        title: 'Diffusion Planning Update',
        description: 'Planning with diffusion policies and latent world models.',
        keywords: ['diffusion', 'cs.AI'],
        categories: ['cs.AI'],
      }));

      expect(index.search('transformer circuits')).toHaveLength(0);
      expect(index.search('diffusion policies').map((result) => result.id)).toEqual(['ocp:arxiv/2401.00003']);
    } finally {
      index.close();
    }
  });
});

function createIndex(): SearchIndex {
  const dir = mkdtempSync(join(tmpdir(), 'ocp-arxiv-store-'));
  tempDirs.push(dir);
  return new SearchIndex(join(dir, 'index.db'));
}

function createArxivRecord(input: {
  id: string;
  title: string;
  description: string;
  keywords: string[];
  categories: string[];
}): SolutionRecord {
  const now = '2026-03-11T00:00:00.000Z';

  return {
    '@context': 'https://observer-commons.org/schema/v1',
    '@type': 'SolutionRecord',
    '@id': input.id,
    meta: {
      title: input.title,
      description: input.description,
      version: '1.0.0',
      dateCreated: now,
      dateModified: now,
      keywords: input.keywords,
      license: 'CC-BY-4.0',
    },
    problemSolved: {
      statement: input.description,
      cynefinDomain: 'complicated',
    },
    domains: ['machine-learning'],
    validation: {
      method: 'peer-review',
      evidence: [
        {
          type: 'citation-count',
          description: '12 citations',
        },
      ],
      reproducibility: 'deterministic',
    },
    implementation: {
      type: 'pattern',
      refs: [
        {
          type: 'documentation',
          uri: `https://arxiv.org/abs/${input.id.split('/').pop()}`,
        },
      ],
      language: input.categories,
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
      generatedBy: 'arxiv-test-fixture',
    },
    trust: {
      vector: {
        validation_count: 1,
        validation_diversity: 0.6,
        context_breadth: 0.5,
        temporal_stability: 0.7,
        test_coverage: 0.2,
        documentation_quality: 0.9,
      },
      confidence: 'provisional',
      authority: 'medium',
      status: 'active',
      trustScore: 0.75,
    },
    extensions: {
      arxiv: {
        primaryCategory: input.categories[0],
        categories: input.categories,
      },
    },
  };
}
