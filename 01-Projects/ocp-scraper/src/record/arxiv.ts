import { generateRecordId } from './assembler';
import { OCP_CONTEXT } from './schema';
import { computeCTS } from './trust';
import type { SolutionRecord } from '../types/solution-record';
import type { TrustVector } from '../types/trust-vector';

const ARXIV_ABS_BASE_URL = 'https://arxiv.org/abs';
const ARXIV_PDF_BASE_URL = 'https://arxiv.org/pdf';
const ARXIV_SYSTEM_URI = 'https://arxiv.org';

const EXACT_CATEGORY_DOMAIN_MAP: Record<string, string[]> = {
  'cs.AI': ['machine-learning'],
  'cs.CL': ['machine-learning'],
  'cs.CV': ['machine-learning'],
  'cs.CR': ['security'],
  'cs.DB': ['data-management'],
  'cs.DC': ['systems'],
  'cs.IR': ['data-management'],
  'cs.LG': ['machine-learning'],
  'cs.NI': ['systems'],
  'cs.RO': ['robotics'],
  'cs.SE': ['software'],
  'q-bio.BM': ['biology', 'machine-learning'],
  'quant-ph': ['physics', 'quantum-computing'],
  'stat.ML': ['machine-learning', 'statistics'],
};

const CATEGORY_PREFIX_DOMAIN_MAP: Array<[prefix: string, domains: string[]]> = [
  ['astro-ph', ['physics']],
  ['cond-mat', ['physics']],
  ['cs.', ['software']],
  ['econ.', ['economics']],
  ['eess.', ['electrical-engineering']],
  ['gr-qc', ['physics']],
  ['hep-', ['physics']],
  ['math.', ['mathematics']],
  ['nlin.', ['physics']],
  ['nucl-', ['physics']],
  ['physics.', ['physics']],
  ['q-bio.', ['biology']],
  ['q-fin.', ['finance']],
  ['stat.', ['statistics']],
];

export interface ArxivPaperMetadata {
  id: string;
  title: string;
  abstract: string;
  authors: string[];
  categories: string[];
  published: string;
  updated?: string;
  doi?: string | null;
  pdfUrl?: string | null;
  absUrl?: string | null;
  comment?: string | null;
  journalRef?: string | null;
}

export interface ArxivRecordAssemblyOptions {
  generatedAt?: string;
  generatedBy?: string;
}

export function assembleArxivSolutionRecord(
  paper: ArxivPaperMetadata,
  options: ArxivRecordAssemblyOptions = {},
): SolutionRecord {
  const normalized = normalizeArxivPaperMetadata(paper);
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const domains = inferArxivDomains(normalized.categories);
  const trustVector = computeArxivTrustVector(normalized);
  const trustScore = computeCTS(trustVector);

  return {
    '@context': OCP_CONTEXT,
    '@type': 'SolutionRecord',
    '@id': generateRecordId(normalized.id, 'arxiv'),
    meta: {
      title: normalized.title,
      description: normalized.abstract,
      version: '1.0.0',
      dateCreated: generatedAt,
      dateModified: generatedAt,
      datePublished: normalized.published,
      keywords: normalized.categories,
    },
    problemSolved: {
      statement: normalized.abstract || `${normalized.title} — abstract unavailable`,
      context: buildProblemContext(normalized),
      cynefinDomain: 'complicated',
    },
    domains,
    validation: {
      method: normalized.journalRef ? 'peer-review' : 'automated-analysis',
      evidence: buildValidationEvidence(normalized),
      reproducibility: 'contextual',
      validationDate: normalized.updated,
    },
    implementation: {
      type: 'algorithm',
      refs: buildImplementationRefs(normalized),
      solutionApproach: normalized.comment ?? normalized.journalRef ?? undefined,
    },
    composability: {
      inputs: [],
      outputs: [],
      dependencies: [],
      composableWith: [],
    },
    provenance: {
      authors: normalized.authors.map((author) => ({ name: author, type: 'human' as const })),
      contributors: [
        {
          name: 'arXiv',
          type: 'system',
          uri: ARXIV_SYSTEM_URI,
        },
      ],
      sourceType: 'scraped',
      derivedFrom: [normalized.absUrl, normalized.pdfUrl].filter((value): value is string => Boolean(value)),
      generatedBy: options.generatedBy ?? 'ocp-scraper/arxiv-adapter',
    },
    trust: {
      vector: trustVector,
      confidence: getConfidenceLevel(trustScore),
      authority: normalized.journalRef || normalized.doi ? 'medium' : 'low',
      status: 'draft',
      trustScore,
    },
    extensions: {
      arxiv: {
        id: normalized.id,
        source: 'arXiv',
        categories: normalized.categories,
        doi: normalized.doi ?? undefined,
        journalRef: normalized.journalRef ?? undefined,
        comment: normalized.comment ?? undefined,
        absUrl: normalized.absUrl,
        pdfUrl: normalized.pdfUrl ?? undefined,
      },
    },
  };
}

export function inferArxivDomains(categories: string[]): string[] {
  const normalizedCategories = [...new Set(categories.map((category) => category.trim()).filter(Boolean))].sort();
  if (normalizedCategories.length === 0) {
    return ['general'];
  }

  const domains: string[] = [];
  for (const category of normalizedCategories) {
    for (const domain of mapArxivCategoryToDomains(category)) {
      if (!domains.includes(domain)) {
        domains.push(domain);
      }
    }
  }

  return domains.length > 0 ? domains : ['general'];
}

export function computeArxivTrustVector(paper: ArxivPaperMetadata): TrustVector {
  const normalized = normalizeArxivPaperMetadata(paper);
  const completeness = computeMetadataCompleteness(normalized);
  const recency = computeRecencyScore(normalized);
  const maturity = computeMaturityScore(normalized.published);
  const categoryRelevance = computeCategoryRelevance(normalized.categories);
  const traceability = computeTraceabilityScore(normalized);
  const abstractQuality = computeAbstractQuality(normalized.abstract);
  const authorDiversity = computeAuthorDiversity(normalized.authors.length);
  const categoryDiversity = Math.min(normalized.categories.length / 4, 1);

  return {
    validation_count: Math.max(1, Math.round((completeness * 30) + (traceability * 20))),
    validation_diversity: round2((authorDiversity * 0.7) + (categoryDiversity * 0.3)),
    context_breadth: round2(categoryRelevance),
    temporal_stability: round2((recency * 0.7) + (maturity * 0.3)),
    test_coverage: round2(traceability),
    documentation_quality: round2((abstractQuality * 0.65) + (completeness * 0.35)),
  };
}

export function mapArxivCategoryToDomains(category: string): string[] {
  const normalizedCategory = category.trim();
  if (!normalizedCategory) {
    return [];
  }

  const exactDomains = EXACT_CATEGORY_DOMAIN_MAP[normalizedCategory];
  if (exactDomains) {
    return [...exactDomains];
  }

  for (const [prefix, domains] of CATEGORY_PREFIX_DOMAIN_MAP) {
    if (normalizedCategory.startsWith(prefix)) {
      return [...domains];
    }
  }

  return ['research'];
}

function normalizeArxivPaperMetadata(paper: ArxivPaperMetadata): Required<ArxivPaperMetadata> {
  const normalizedId = paper.id.trim();
  const absUrl = paper.absUrl?.trim() || `${ARXIV_ABS_BASE_URL}/${normalizedId}`;
  const pdfUrl = paper.pdfUrl?.trim() || `${ARXIV_PDF_BASE_URL}/${normalizedId}.pdf`;
  const published = normalizeIsoDate(paper.published);
  const updated = normalizeIsoDate(paper.updated || paper.published);

  return {
    id: normalizedId,
    title: paper.title.trim() || normalizedId,
    abstract: paper.abstract.trim(),
    authors: paper.authors.map((author) => author.trim()).filter(Boolean),
    categories: [...new Set(paper.categories.map((category) => category.trim()).filter(Boolean))],
    published,
    updated,
    doi: paper.doi?.trim() || null,
    pdfUrl,
    absUrl,
    comment: paper.comment?.trim() || null,
    journalRef: paper.journalRef?.trim() || null,
  };
}

function buildProblemContext(paper: Required<ArxivPaperMetadata>): string | undefined {
  const parts = [
    paper.categories.length > 0 ? `arXiv categories: ${paper.categories.join(', ')}` : null,
    paper.journalRef,
    paper.comment,
  ].filter((value): value is string => Boolean(value));

  return parts.length > 0 ? parts.join(' | ') : undefined;
}

function buildValidationEvidence(paper: Required<ArxivPaperMetadata>) {
  const evidence: SolutionRecord['validation']['evidence'] = [
    {
      type: 'arxiv-record',
      description: `Indexed from arXiv paper ${paper.id}`,
      uri: paper.absUrl ?? undefined,
    },
    {
      type: 'category-classification',
      description: `Classified in arXiv categories: ${paper.categories.join(', ') || 'none listed'}`,
    },
    {
      type: 'submission-recency',
      description: `Published ${paper.published} and last updated ${paper.updated}`,
    },
  ];

  if (paper.doi) {
    evidence.push({
      type: 'doi',
      description: `DOI assigned: ${paper.doi}`,
      uri: `https://doi.org/${paper.doi}`,
    });
  }

  if (paper.journalRef) {
    evidence.push({
      type: 'journal-reference',
      description: `Journal or venue reference: ${paper.journalRef}`,
    });
  }

  return evidence;
}

function buildImplementationRefs(paper: Required<ArxivPaperMetadata>) {
  const refs: SolutionRecord['implementation']['refs'] = [
    {
      type: 'publication',
      uri: paper.absUrl ?? `${ARXIV_ABS_BASE_URL}/${paper.id}`,
      description: `arXiv abstract page for ${paper.id}`,
    },
  ];

  if (paper.pdfUrl) {
    refs.push({
      type: 'publication',
      uri: paper.pdfUrl,
      description: 'arXiv PDF',
    });
  }

  if (paper.doi) {
    refs.push({
      type: 'publication',
      uri: `https://doi.org/${paper.doi}`,
      description: 'DOI landing page',
    });
  }

  return refs;
}

function computeMetadataCompleteness(paper: Required<ArxivPaperMetadata>): number {
  const presentSignals = [
    paper.title.length > 0,
    paper.abstract.length > 0,
    paper.authors.length > 0,
    paper.categories.length > 0,
    isValidDate(paper.published),
    isValidDate(paper.updated),
    Boolean(paper.absUrl),
    Boolean(paper.pdfUrl),
    Boolean(paper.doi || paper.journalRef || paper.comment),
  ].filter(Boolean).length;

  return round2(presentSignals / 9);
}

function computeRecencyScore(paper: Required<ArxivPaperMetadata>): number {
  const daysSinceUpdate = getDaysSince(paper.updated);
  if (daysSinceUpdate <= 180) return 1;
  if (daysSinceUpdate <= 365) return 0.85;
  if (daysSinceUpdate <= 730) return 0.65;
  if (daysSinceUpdate <= 1825) return 0.4;
  return 0.2;
}

function computeMaturityScore(date: string): number {
  const ageInDays = getDaysSince(date);
  if (ageInDays >= 90) return 1;
  if (ageInDays >= 30) return 0.75;
  if (ageInDays >= 7) return 0.5;
  return 0.3;
}

function computeCategoryRelevance(categories: string[]): number {
  if (categories.length === 0) {
    return 0.05;
  }

  const score = categories.reduce((total, category) => total + getCategorySpecificityScore(category), 0) / categories.length;
  return round2(score);
}

function getCategorySpecificityScore(category: string): number {
  if (EXACT_CATEGORY_DOMAIN_MAP[category]) {
    return 1;
  }

  for (const [prefix] of CATEGORY_PREFIX_DOMAIN_MAP) {
    if (category.startsWith(prefix)) {
      return 0.8;
    }
  }

  return 0.25;
}

function computeTraceabilityScore(paper: Required<ArxivPaperMetadata>): number {
  let score = 0.15;
  if (paper.pdfUrl) score += 0.2;
  if (paper.doi) score += 0.35;
  if (paper.journalRef) score += 0.2;
  if (paper.comment) score += 0.1;
  return round2(Math.min(score, 1));
}

function computeAbstractQuality(abstract: string): number {
  const length = abstract.trim().length;
  if (length >= 400) return 1;
  if (length >= 200) return 0.8;
  if (length >= 80) return 0.55;
  if (length >= 30) return 0.3;
  return 0.1;
}

function computeAuthorDiversity(authorCount: number): number {
  if (authorCount <= 1) {
    return 0.2;
  }

  return round2(Math.min(Math.log10(authorCount + 1) / Math.log10(11), 1));
}

function getConfidenceLevel(trustScore: number): SolutionRecord['trust']['confidence'] {
  if (trustScore >= 0.7) return 'tested';
  if (trustScore >= 0.4) return 'provisional';
  return 'speculative';
}

function normalizeIsoDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(0).toISOString();
  }
  return parsed.toISOString();
}

function isValidDate(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

function getDaysSince(value: string): number {
  const millis = Date.now() - new Date(value).getTime();
  return Math.max(0, millis / 86_400_000);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
