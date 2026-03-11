import { describe, expect, test } from 'bun:test';

import {
  buildArxivSearchQuery,
  normalizeArxivId,
  parseTopicQuery,
} from './arxiv';

describe('ArxivAdapter query helpers', () => {
  test('normalizes canonical arXiv identifiers', () => {
    expect(normalizeArxivId('arXiv:2301.07041')).toBe('2301.07041');
    expect(normalizeArxivId('https://arxiv.org/abs/2301.07041')).toBe('2301.07041');
    expect(normalizeArxivId('https://arxiv.org/pdf/2301.07041.pdf')).toBe('2301.07041');
  });

  test('builds deterministic category query', () => {
    expect(buildArxivSearchQuery({ category: 'cs.AI' })).toBe('cat:cs.AI');
  });

  test('parses explicit mixed arXiv query syntax', () => {
    expect(parseTopicQuery('category:cs.AI; author:Yann LeCun; keyword:diffusion')).toEqual({
      category: 'cs.AI',
      author: 'Yann LeCun',
      keyword: 'diffusion',
    });
  });

  test('builds date-bounded query terms', () => {
    expect(buildArxivSearchQuery({ category: 'cs.AI', dateFrom: '2025-01-01', dateTo: '2025-01-31' })).toBe(
      'cat:cs.AI+AND+submittedDate:[202501010000+TO+202501312359]',
    );
  });

  test('treats bare category as category and bare text as keyword', () => {
    expect(parseTopicQuery('cs.LG')).toEqual({ category: 'cs.LG' });
    expect(parseTopicQuery('transformer scaling laws')).toEqual({ keyword: 'transformer scaling laws' });
  });
});
