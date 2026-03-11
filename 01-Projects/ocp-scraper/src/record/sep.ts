import { generateRecordId } from './assembler';
import { OCP_CONTEXT } from './schema';
import { computeCTS } from './trust';
import type { SolutionRecord } from '../types/solution-record';
import type { TrustVector } from '../types/trust-vector';

const SEP_BASE_URL = 'https://plato.stanford.edu';
const SEP_SYSTEM_URI = 'https://plato.stanford.edu';

export type SepCategoryStructure =
  | string
  | readonly SepCategoryStructure[]
  | { [key: string]: SepCategoryStructure | undefined };

export interface SepEntryMetadata {
  slug: string;
  title: string;
  preamble: string;
  authors: string[];
  relatedEntries: Array<string | { slug: string; title?: string; uri?: string }>;
  publishedAt?: string | null;
  revisedAt?: string | null;
  firstSectionTitle?: string | null;
  firstSectionText?: string | null;
  bibliographyCount?: number | null;
  bibliographyEntries?: Array<string | { raw?: string; title?: string | null; authors?: string[]; year?: string | null; uri?: string }> | null;
  categoryStructure?: SepCategoryStructure | null;
  entryUrl?: string | null;
}

export interface SepRecordAssemblyOptions {
  generatedAt?: string;
  generatedBy?: string;
}

export interface NormalizedSepEntryMetadata {
  slug: string;
  title: string;
  preamble: string;
  authors: string[];
  relatedEntries: string[];
  publishedAt?: string;
  revisedAt?: string;
  firstSectionTitle?: string;
  firstSectionText?: string;
  bibliographyCount: number;
  categoryPaths: string[];
  entryUrl: string;
}

export function assembleSepSolutionRecord(
  entry: SepEntryMetadata,
  options: SepRecordAssemblyOptions = {},
): SolutionRecord {
  const normalized = normalizeSepEntryMetadata(entry);
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const topics = inferSepTopics(normalized);
  const domains = inferSepDomains(normalized, topics);
  const trustVector = computeSepTrustVector(normalized);
  const trustScore = computeCTS(trustVector);

  return {
    '@context': OCP_CONTEXT,
    '@type': 'SolutionRecord',
    '@id': generateRecordId(normalized.slug, 'sep'),
    meta: {
      title: normalized.title,
      description: normalized.preamble || `${normalized.title} — SEP preamble unavailable`,
      version: '1.0.0',
      dateCreated: generatedAt,
      dateModified: generatedAt,
      datePublished: normalized.publishedAt,
      keywords: topics,
    },
    problemSolved: {
      statement: normalized.preamble || `${normalized.title} — SEP preamble unavailable`,
      context: buildProblemContext(normalized),
      cynefinDomain: 'complicated',
    },
    domains,
    validation: {
      method: 'community-consensus',
      evidence: buildValidationEvidence(normalized),
      reproducibility: 'contextual',
      validationDate: normalized.revisedAt ?? normalized.publishedAt,
    },
    implementation: {
      type: 'pattern',
      refs: [
        {
          type: 'documentation',
          uri: normalized.entryUrl,
          description: `SEP entry for ${normalized.slug}`,
        },
      ],
      solutionApproach: normalized.firstSectionTitle ?? normalized.firstSectionText,
    },
    composability: {
      inputs: [],
      outputs: [],
      dependencies: [],
      composableWith: normalized.relatedEntries.map((related) => generateRecordId(related, 'sep')),
    },
    provenance: {
      authors: normalized.authors.map((author) => ({ name: author, type: 'human' as const })),
      contributors: [
        {
          name: 'Stanford Encyclopedia of Philosophy',
          type: 'system',
          uri: SEP_SYSTEM_URI,
        },
      ],
      sourceType: 'scraped',
      derivedFrom: [normalized.entryUrl],
      generatedBy: options.generatedBy ?? 'ocp-scraper/sep-adapter',
    },
    trust: {
      vector: trustVector,
      confidence: getConfidenceLevel(trustScore),
      authority: getAuthorityLevel(normalized, trustScore),
      status: 'draft',
      trustScore,
    },
    extensions: {
      sep: {
        slug: normalized.slug,
        source: 'SEP',
        entryUrl: normalized.entryUrl,
        preamble: normalized.preamble,
        firstSectionTitle: normalized.firstSectionTitle,
        firstSectionText: normalized.firstSectionText,
        relatedEntries: normalized.relatedEntries,
        relatedEntryDetails: normalizeRelatedEntries(entry.relatedEntries),
        categoryPaths: normalized.categoryPaths,
        bibliographyCount: normalized.bibliographyCount,
        bibliography: normalizeBibliographyEntries(entry.bibliographyEntries),
        publishedAt: normalized.publishedAt,
        revisedAt: normalized.revisedAt,
      },
    },
  };
}

export function inferSepTopics(entry: Pick<NormalizedSepEntryMetadata, 'relatedEntries' | 'categoryPaths'>): string[] {
  const relatedTopics = entry.relatedEntries.map(humanizeSepTopic);
  const categoryTopics = entry.categoryPaths.map(humanizeSepTopic);
  const merged = [...relatedTopics, ...categoryTopics].filter(Boolean);
  return [...new Set(merged)].sort();
}

export function inferSepDomains(
  entry: Pick<NormalizedSepEntryMetadata, 'categoryPaths' | 'relatedEntries' | 'title'>,
  topics: string[] = inferSepTopics(entry as Pick<NormalizedSepEntryMetadata, 'relatedEntries' | 'categoryPaths'>),
): string[] {
  const signalText = [entry.title, ...topics, ...entry.categoryPaths, ...entry.relatedEntries].join(' ').toLowerCase();
  const domains: string[] = [];

  const domainSignals: Array<[string, RegExp]> = [
    ['ethics', /ethic|moral|value/],
    ['mind', /mind|cognitive|conscious|perception|phenomenolog/],
    ['metaphysics', /metaphysics|ontology|being|causation|time|identity/],
    ['epistemology', /epistemology|knowledge|justification|belief|skeptic/],
    ['logic', /logic|reasoning|proof|modal|semantic/],
    ['political-philosophy', /politic|justice|law|state|liberty/],
    ['history-of-philosophy', /ancient|medieval|modern|history|plato|aristotle|kant|descartes/],
    ['philosophy-of-science', /science|scientific|biology|physics|mathematics|artificial intelligence|ai/],
    ['general-philosophy', /philosophy|philosophical/],
  ];

  for (const [domain, pattern] of domainSignals) {
    if (pattern.test(signalText) && !domains.includes(domain)) {
      domains.push(domain);
    }
  }

  return domains.length > 0 ? domains : ['general-philosophy'];
}

export function computeSepTrustVector(entry: SepEntryMetadata | NormalizedSepEntryMetadata): TrustVector {
  const normalized = isNormalizedSepEntry(entry) ? entry : normalizeSepEntryMetadata(entry);
  const authorSignal = computeAuthorSignal(normalized.authors.length);
  const relatedSignal = computeRelatedSignal(normalized.relatedEntries.length);
  const bibliographySignal = computeBibliographySignal(normalized.bibliographyCount);
  const temporalSignal = computeTemporalSignal(normalized.publishedAt, normalized.revisedAt);
  const completenessSignal = computeStructuralCompleteness(normalized);
  const categorySignal = computeCategorySignal(normalized.categoryPaths.length);

  return {
    validation_count: Math.max(
      1,
      Math.round(
        (normalized.authors.length * 3)
          + normalized.relatedEntries.length
          + (normalized.bibliographyCount * 0.5)
          + (hasRevisionSignal(normalized) ? 8 : 0)
          + (completenessSignal * 12),
      ),
    ),
    validation_diversity: round2((authorSignal * 0.45) + (relatedSignal * 0.35) + (categorySignal * 0.2)),
    context_breadth: round2((relatedSignal * 0.55) + (categorySignal * 0.45)),
    temporal_stability: round2(temporalSignal),
    test_coverage: round2((bibliographySignal * 0.6) + (hasRevisionSignal(normalized) ? 0.2 : 0) + (completenessSignal * 0.2)),
    documentation_quality: round2((completenessSignal * 0.65) + (bibliographySignal * 0.2) + (relatedSignal * 0.15)),
  };
}

export function normalizeSepEntryMetadata(entry: SepEntryMetadata): NormalizedSepEntryMetadata {
  const slug = normalizeSepSlug(entry.slug || entry.title);
  const title = entry.title.trim() || slug;
  const categoryPaths = flattenCategoryStructure(entry.categoryStructure);
  const bibliographyCount = getBibliographyCount(entry);
  const entryUrl = entry.entryUrl?.trim() || `${SEP_BASE_URL}/entries/${slug}/`;

  return {
    slug,
    title,
    preamble: normalizeWhitespace(entry.preamble),
    authors: [...new Set(entry.authors.map((author) => normalizeWhitespace(author)).filter(Boolean))],
    relatedEntries: [...new Set(normalizeRelatedEntries(entry.relatedEntries).map((item) => item.slug).filter(Boolean))],
    publishedAt: normalizeOptionalIsoDate(entry.publishedAt),
    revisedAt: normalizeOptionalIsoDate(entry.revisedAt) ?? normalizeOptionalIsoDate(entry.publishedAt),
    firstSectionTitle: normalizeOptionalText(entry.firstSectionTitle),
    firstSectionText: normalizeOptionalText(entry.firstSectionText),
    bibliographyCount,
    categoryPaths,
    entryUrl,
  };
}

function buildProblemContext(entry: NormalizedSepEntryMetadata): string | undefined {
  const parts = [
    entry.firstSectionTitle ? `Opening section: ${entry.firstSectionTitle}` : null,
    entry.categoryPaths.length > 0 ? `SEP categories: ${entry.categoryPaths.join(' / ')}` : null,
    entry.relatedEntries.length > 0 ? `Related entries: ${entry.relatedEntries.join(', ')}` : null,
  ].filter((value): value is string => Boolean(value));

  return parts.length > 0 ? parts.join(' | ') : undefined;
}

function buildValidationEvidence(entry: NormalizedSepEntryMetadata): SolutionRecord['validation']['evidence'] {
  const evidence: SolutionRecord['validation']['evidence'] = [
    {
      type: 'sep-entry',
      description: `Indexed from Stanford Encyclopedia of Philosophy entry ${entry.slug}`,
      uri: entry.entryUrl,
    },
    {
      type: 'editorial-structure',
      description: `${entry.authors.length} author(s), ${entry.relatedEntries.length} related entr${entry.relatedEntries.length === 1 ? 'y' : 'ies'}, bibliography size ${entry.bibliographyCount}`,
    },
  ];

  if (entry.publishedAt) {
    evidence.push({
      type: 'publication-history',
      description: `Published ${entry.publishedAt}${entry.revisedAt ? ` and revised ${entry.revisedAt}` : ''}`,
    });
  }

  if (entry.categoryPaths.length > 0) {
    evidence.push({
      type: 'category-classification',
      description: `Classified under SEP categories: ${entry.categoryPaths.join(' / ')}`,
    });
  }

  return evidence;
}

function flattenCategoryStructure(input: SepCategoryStructure | null | undefined, prefix: string[] = []): string[] {
  if (!input) {
    return [];
  }

  if (typeof input === 'string') {
    const text = normalizeWhitespace(input);
    if (!text) {
      return [];
    }
    const segments = text.split(/[>/|]/).map((part) => normalizeWhitespace(part)).filter(Boolean);
    const path = [...prefix, ...(segments.length > 0 ? segments : [text])];
    return [path.join(' / ')];
  }

  if (Array.isArray(input)) {
    return [...new Set(input.flatMap((item) => flattenCategoryStructure(item, prefix)).filter(Boolean))];
  }

  const values: string[] = [];
  for (const [key, value] of Object.entries(input)) {
    const nextPrefix = shouldIgnoreCategoryKey(key) ? prefix : [...prefix, normalizeWhitespace(key)];
    values.push(...flattenCategoryStructure(value, nextPrefix));
  }
  return [...new Set(values.filter(Boolean))];
}

function shouldIgnoreCategoryKey(key: string): boolean {
  return ['items', 'children', 'nodes', 'trail', 'path', 'categories'].includes(key.toLowerCase());
}

function getBibliographyCount(entry: SepEntryMetadata): number {
  if (typeof entry.bibliographyCount === 'number' && Number.isFinite(entry.bibliographyCount)) {
    return Math.max(0, Math.round(entry.bibliographyCount));
  }
  if (Array.isArray(entry.bibliographyEntries)) {
    return normalizeBibliographyEntries(entry.bibliographyEntries).length;
  }
  return 0;
}

function normalizeRelatedEntries(
  entries: SepEntryMetadata['relatedEntries'],
): Array<{ slug: string; title?: string; uri?: string }> {
  return entries
    .map((entry) => {
      if (typeof entry === 'string') {
        const slug = normalizeSepSlug(entry);
        return slug ? { slug } : null;
      }

      const slug = normalizeSepSlug(entry.slug);
      return slug
        ? {
            slug,
            title: normalizeOptionalText(entry.title),
            uri: normalizeOptionalText(entry.uri),
          }
        : null;
    })
    .filter((entry): entry is { slug: string; title?: string; uri?: string } => Boolean(entry));
}

function normalizeBibliographyEntries(
  entries: SepEntryMetadata['bibliographyEntries'] = [],
): Array<{ raw: string; title?: string; authors?: string[]; year?: string | null; uri?: string }> {
  if (!Array.isArray(entries)) {
    return [];
  }

  const normalized = entries
    .map((entry): { raw: string; title?: string; authors?: string[]; year?: string | null; uri?: string } | null => {
      if (typeof entry === 'string') {
        const raw = normalizeWhitespace(entry);
        return raw ? { raw } : null;
      }

      const raw = normalizeWhitespace(entry.raw ?? entry.title ?? '');
      if (!raw) {
        return null;
      }

      return {
        raw,
        title: normalizeOptionalText(entry.title),
        authors: Array.isArray(entry.authors)
          ? entry.authors.map((author) => normalizeWhitespace(author)).filter(Boolean)
          : undefined,
        year: normalizeOptionalText(entry.year),
        uri: normalizeOptionalText(entry.uri),
      };
    });

  return normalized.filter((entry): entry is { raw: string; title?: string; authors?: string[]; year?: string | null; uri?: string } => entry !== null);
}

function computeAuthorSignal(count: number): number {
  if (count <= 0) return 0.05;
  if (count === 1) return 0.35;
  if (count === 2) return 0.6;
  if (count === 3) return 0.8;
  return 1;
}

function computeRelatedSignal(count: number): number {
  if (count <= 0) return 0.05;
  return round2(Math.min(Math.log10(count + 1) / Math.log10(21), 1));
}

function computeBibliographySignal(count: number): number {
  if (count <= 0) return 0.05;
  if (count >= 80) return 1;
  return round2(Math.min(count / 80, 1));
}

function computeTemporalSignal(publishedAt?: string, revisedAt?: string): number {
  if (!publishedAt && !revisedAt) {
    return 0.2;
  }

  const anchor = revisedAt ?? publishedAt;
  const ageDays = anchor ? getDaysSince(anchor) : 0;
  const publicationAgeDays = publishedAt ? getDaysSince(publishedAt) : ageDays;

  let ageScore = 0.4;
  if (publicationAgeDays >= 3650) ageScore = 1;
  else if (publicationAgeDays >= 1825) ageScore = 0.9;
  else if (publicationAgeDays >= 730) ageScore = 0.75;
  else if (publicationAgeDays >= 180) ageScore = 0.55;

  let revisionScore = 0.2;
  if (revisedAt && publishedAt && revisedAt !== publishedAt) {
    if (ageDays <= 365) revisionScore = 1;
    else if (ageDays <= 1825) revisionScore = 0.85;
    else revisionScore = 0.65;
  } else if (publishedAt) {
    revisionScore = 0.45;
  }

  return round2((ageScore * 0.55) + (revisionScore * 0.45));
}

function computeStructuralCompleteness(entry: NormalizedSepEntryMetadata): number {
  const signals = [
    entry.title.length > 0,
    entry.preamble.length > 0,
    entry.authors.length > 0,
    entry.relatedEntries.length > 0,
    entry.categoryPaths.length > 0,
    entry.bibliographyCount > 0,
    Boolean(entry.firstSectionTitle),
    Boolean(entry.firstSectionText),
    Boolean(entry.publishedAt),
    Boolean(entry.revisedAt),
    Boolean(entry.entryUrl),
  ].filter(Boolean).length;

  return round2(signals / 11);
}

function computeCategorySignal(count: number): number {
  if (count <= 0) return 0.05;
  if (count >= 4) return 1;
  return round2(count / 4);
}

function hasRevisionSignal(entry: NormalizedSepEntryMetadata): boolean {
  return Boolean(entry.publishedAt && entry.revisedAt && entry.publishedAt !== entry.revisedAt);
}

function getConfidenceLevel(trustScore: number): SolutionRecord['trust']['confidence'] {
  if (trustScore >= 0.82) return 'foundational';
  if (trustScore >= 0.62) return 'proven';
  if (trustScore >= 0.42) return 'tested';
  if (trustScore >= 0.22) return 'provisional';
  return 'speculative';
}

function getAuthorityLevel(entry: NormalizedSepEntryMetadata, trustScore: number): SolutionRecord['trust']['authority'] {
  if (entry.authors.length >= 2 && entry.bibliographyCount >= 20 && trustScore >= 0.55) {
    return 'high';
  }
  if (entry.authors.length >= 1 || entry.publishedAt) {
    return 'medium';
  }
  return 'low';
}

function humanizeSepTopic(value: string): string {
  return normalizeWhitespace(value.replace(/[-_]+/g, ' '));
}

function normalizeSepSlug(value: string): string {
  return value
    .trim()
    .replace(/^sep\//i, '')
    .replace(/^https?:\/\/plato\.stanford\.edu\/entries\//i, '')
    .replace(/^entries\//i, '')
    .replace(/\/+$/g, '')
    .replace(/[^a-z0-9-]/gi, '-')
    .replace(/-{2,}/g, '-')
    .toLowerCase();
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeOptionalText(value?: string | null): string | undefined {
  const normalized = value ? normalizeWhitespace(value) : '';
  return normalized || undefined;
}

function normalizeOptionalIsoDate(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function getDaysSince(value: string): number {
  return Math.max(0, (Date.now() - new Date(value).getTime()) / 86_400_000);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function isNormalizedSepEntry(
  entry: SepEntryMetadata | NormalizedSepEntryMetadata,
): entry is NormalizedSepEntryMetadata {
  return 'categoryPaths' in entry && 'entryUrl' in entry && typeof entry.bibliographyCount === 'number';
}
