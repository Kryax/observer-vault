import type { SolutionRecord } from '../types/solution-record';

const ARXIV_CATEGORY_PATTERN = /^[a-z-]+\.[A-Z-]+$/;
const ARXIV_CATEGORY_NODE_PREFIX = 'arxiv:category:';

export interface DerivedEdge {
  targetId: string;
  edgeType: string;
  weight: number;
  metadata: Record<string, unknown>;
}

export function isArxivRecord(record: SolutionRecord): boolean {
  if ((record.extensions as { arxiv?: unknown } | undefined)?.arxiv) {
    return true;
  }

  if (record['@id'].toLowerCase().includes('arxiv')) {
    return true;
  }

  return record.implementation.refs.some((ref) => /arxiv\.org\//i.test(ref.uri));
}

export function extractArxivCategories(record: SolutionRecord): string[] {
  const categories: string[] = [];
  const seen = new Set<string>();

  const pushCategory = (value: unknown): void => {
    if (typeof value !== 'string') {
      return;
    }

    const normalized = value.trim();
    if (!ARXIV_CATEGORY_PATTERN.test(normalized) || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    categories.push(normalized);
  };

  const arxivExtension = (record.extensions as { arxiv?: { primaryCategory?: unknown; categories?: unknown } } | undefined)?.arxiv;
  pushCategory(arxivExtension?.primaryCategory);

  if (Array.isArray(arxivExtension?.categories)) {
    for (const category of arxivExtension.categories) {
      pushCategory(category);
    }
  }

  const language = record.implementation.language;
  if (typeof language === 'string') {
    pushCategory(language);
  } else if (Array.isArray(language)) {
    for (const value of language) {
      pushCategory(value);
    }
  }

  for (const keyword of record.meta.keywords ?? []) {
    pushCategory(keyword);
  }

  return categories;
}

export function buildArxivCategoryEdges(record: SolutionRecord): DerivedEdge[] {
  if (!isArxivRecord(record)) {
    return [];
  }

  const categories = extractArxivCategories(record);
  if (categories.length === 0) {
    return [];
  }

  const primaryCategory = categories[0];
  const edges: DerivedEdge[] = categories.map((category, index) => ({
    targetId: `${ARXIV_CATEGORY_NODE_PREFIX}${category}`,
    edgeType: 'classified_as',
    weight: index === 0 ? 0.9 : 0.7,
    metadata: {
      source: 'arxiv',
      category,
      role: index === 0 ? 'primary' : 'secondary',
    },
  }));

  for (const category of categories.slice(1)) {
    const pair = [primaryCategory, category].sort();
    edges.push({
      targetId: `${ARXIV_CATEGORY_NODE_PREFIX}${pair.join('__')}`,
      edgeType: 'category_cooccurs_with',
      weight: 0.5,
      metadata: {
        source: 'arxiv',
        categories: pair,
        primaryCategory,
      },
    });
  }

  return edges;
}
