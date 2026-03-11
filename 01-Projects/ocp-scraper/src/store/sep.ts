import type { SolutionRecord } from '../types/solution-record';
import type { DerivedEdge } from './arxiv';

const SEP_ENTRY_URL_PATTERN = /https?:\/\/plato\.stanford\.edu\/entries\/([^/?#]+)\/?/i;
const SEP_RECORD_ID_PREFIX = 'ocp:sep/';

interface SepExtension {
  slug?: unknown;
  preamble?: unknown;
  firstSectionTitle?: unknown;
  firstSectionText?: unknown;
  relatedEntries?: unknown;
  bibliography?: unknown;
}

interface SepReferenceTarget {
  slug: string;
  title?: string;
  uri?: string;
}

export function isSepRecord(record: SolutionRecord): boolean {
  return Boolean(
    getSepExtension(record)
    || record['@id'].startsWith(SEP_RECORD_ID_PREFIX)
    || record.implementation.refs.some((ref) => SEP_ENTRY_URL_PATTERN.test(ref.uri)),
  );
}

export function extractSepSearchText(record: SolutionRecord): string {
  if (!isSepRecord(record)) {
    return '';
  }

  const extension = getSepExtension(record);
  if (!extension) {
    return '';
  }

  const parts = [
    asNonEmptyString(extension.preamble),
    asNonEmptyString(extension.firstSectionTitle),
    asNonEmptyString(extension.firstSectionText),
    ...extractSepRelatedEntries(record).map((entry) => entry.title).filter((title): title is string => Boolean(title)),
  ];

  const bibliographyTargets = extractSepBibliographyTargets(record);
  for (const target of bibliographyTargets) {
    if (target.title) {
      parts.push(target.title);
    }
  }

  return uniqueStrings(parts).join('\n\n');
}

export function extractSepRelatedEntries(record: SolutionRecord): SepReferenceTarget[] {
  const extension = getSepExtension(record);
  if (!extension) {
    return [];
  }

  return extractSepReferenceTargets(extension.relatedEntries);
}

export function extractSepBibliographyTargets(record: SolutionRecord): SepReferenceTarget[] {
  const extension = getSepExtension(record);
  if (!extension) {
    return [];
  }

  return extractSepReferenceTargets(extension.bibliography);
}

export function buildSepGraphEdges(record: SolutionRecord): DerivedEdge[] {
  if (!isSepRecord(record)) {
    return [];
  }

  const recordSlug = extractSepSlug(record);
  const edges: DerivedEdge[] = [];

  for (const relatedEntry of extractSepRelatedEntries(record)) {
    if (recordSlug && relatedEntry.slug === recordSlug) {
      continue;
    }

    edges.push({
      targetId: buildSepRecordId(relatedEntry.slug),
      edgeType: 'related_to',
      weight: 0.85,
      metadata: {
        source: 'sep',
        relation: 'related_entry',
        slug: relatedEntry.slug,
        title: relatedEntry.title,
        uri: relatedEntry.uri ?? buildSepEntryUrl(relatedEntry.slug),
      },
    });
  }

  for (const bibliographyTarget of extractSepBibliographyTargets(record)) {
    if (recordSlug && bibliographyTarget.slug === recordSlug) {
      continue;
    }

    edges.push({
      targetId: buildSepRecordId(bibliographyTarget.slug),
      edgeType: 'references',
      weight: 0.35,
      metadata: {
        source: 'sep',
        relation: 'bibliography',
        slug: bibliographyTarget.slug,
        title: bibliographyTarget.title,
        uri: bibliographyTarget.uri ?? buildSepEntryUrl(bibliographyTarget.slug),
      },
    });
  }

  return edges;
}

function getSepExtension(record: SolutionRecord): SepExtension | null {
  const extension = (record.extensions as { sep?: unknown } | undefined)?.sep;
  return extension && typeof extension === 'object' ? extension as SepExtension : null;
}

function extractSepSlug(record: SolutionRecord): string | null {
  const extension = getSepExtension(record);
  const explicitSlug = asNonEmptyString(extension?.slug);
  if (explicitSlug) {
    return normalizeSepSlug(explicitSlug);
  }

  if (record['@id'].startsWith(SEP_RECORD_ID_PREFIX)) {
    return normalizeSepSlug(record['@id'].slice(SEP_RECORD_ID_PREFIX.length));
  }

  for (const ref of record.implementation.refs) {
    const slug = extractSepSlugFromValue(ref.uri);
    if (slug) {
      return slug;
    }
  }

  return null;
}

function extractSepReferenceTargets(value: unknown): SepReferenceTarget[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const results: SepReferenceTarget[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    const target = toSepReferenceTarget(item);
    if (!target || seen.has(target.slug)) {
      continue;
    }

    seen.add(target.slug);
    results.push(target);
  }

  return results;
}

function toSepReferenceTarget(value: unknown): SepReferenceTarget | null {
  if (typeof value === 'string') {
    const slug = extractSepSlugFromValue(value);
    return slug ? { slug, uri: buildSepEntryUrl(slug) } : null;
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as { slug?: unknown; uri?: unknown; url?: unknown; title?: unknown; name?: unknown };
  const slug = asNonEmptyString(candidate.slug)
    ? normalizeSepSlug(candidate.slug as string)
    : extractSepSlugFromValue(asNonEmptyString(candidate.uri) ?? asNonEmptyString(candidate.url) ?? '');

  if (!slug) {
    return null;
  }

  return {
    slug,
    title: asNonEmptyString(candidate.title) ?? asNonEmptyString(candidate.name) ?? undefined,
    uri: asNonEmptyString(candidate.uri) ?? asNonEmptyString(candidate.url) ?? buildSepEntryUrl(slug),
  };
}

function extractSepSlugFromValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const urlMatch = trimmed.match(SEP_ENTRY_URL_PATTERN);
  if (urlMatch) {
    return normalizeSepSlug(urlMatch[1]);
  }

  if (/^[a-z0-9-]+$/i.test(trimmed)) {
    return normalizeSepSlug(trimmed);
  }

  return null;
}

function buildSepRecordId(slug: string): string {
  return `${SEP_RECORD_ID_PREFIX}${normalizeSepSlug(slug)}`;
}

function buildSepEntryUrl(slug: string): string {
  return `https://plato.stanford.edu/entries/${normalizeSepSlug(slug)}/`;
}

function normalizeSepSlug(raw: string): string {
  return raw
    .trim()
    .replace(/^sep\//i, '')
    .replace(/^https?:\/\/plato\.stanford\.edu\/entries\//i, '')
    .replace(/[?#].*$/g, '')
    .replace(/^entries\//i, '')
    .replace(/\/+/g, '-')
    .replace(/[^a-z0-9-]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function uniqueStrings(values: Array<string | null>): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  for (const value of values) {
    if (!value || seen.has(value)) {
      continue;
    }

    seen.add(value);
    results.push(value);
  }

  return results;
}
