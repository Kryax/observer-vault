export interface SepRelatedEntry {
  slug: string;
  title: string;
}

export interface SepBibliographyEntry {
  raw: string;
  authors: string[];
  year: string | null;
  title: string | null;
}

export interface SepEntryParseFallback {
  title?: string;
  authors?: string[];
  canonicalUrl?: string;
}

export interface SepEntryParsed {
  slug: string;
  title: string;
  authors: string[];
  preamble: string;
  firstSectionTitle: string | null;
  firstSectionText: string;
  relatedEntries: SepRelatedEntry[];
  bibliography: SepBibliographyEntry[];
  canonicalUrl: string;
  publishedAt: string | null;
  revisedAt: string | null;
}

interface HeadingMatch {
  level: number;
  title: string;
  start: number;
  end: number;
  raw: string;
}

const SEP_BASE_URL = 'https://plato.stanford.edu';

export function parseSepEntryHtml(
  html: string,
  slug: string,
  fallback: SepEntryParseFallback = {},
): SepEntryParsed {
  const article = extractArticleBody(html);
  const title = firstNonEmpty(
    normalizeText(stripHtml(extractTagText(html, 'h1') ?? '')),
    normalizeText(extractMetaContent(html, 'citation_title') ?? ''),
    normalizeText(extractMetaContent(html, 'dc.title') ?? ''),
    fallback.title,
    slug,
  );
  const authors = extractAuthors(html, fallback.authors ?? []);
  const headings = extractHeadings(article);
  const firstNumberedHeading = headings.find((heading) => /^\d+(?:\.\d+)*\.?\s+/.test(heading.title));
  const intro = extractPreamble(article, firstNumberedHeading?.start ?? article.length);
  const firstSection = extractFirstNumberedSection(article, headings);

  return {
    slug: normalizeSepSlug(slug),
    title,
    authors,
    preamble: intro,
    firstSectionTitle: firstSection?.title ?? null,
    firstSectionText: firstSection?.text ?? '',
    relatedEntries: extractRelatedEntries(article),
    bibliography: extractBibliography(article),
    canonicalUrl: extractCanonicalUrl(html, slug, fallback.canonicalUrl),
    publishedAt: extractPublishedAt(html, article),
    revisedAt: extractRevisedAt(html, article),
  };
}

export function normalizeSepSlug(raw: string): string {
  return raw
    .trim()
    .replace(/^sep\//i, '')
    .replace(/^https?:\/\/plato\.stanford\.edu\/entries\//i, '')
    .replace(/^entries\//i, '')
    .replace(/\/.*$/, '')
    .replace(/[^a-z0-9-]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function buildSepCanonicalUrl(slug: string, baseUrl: string = SEP_BASE_URL): string {
  return `${baseUrl}/entries/${normalizeSepSlug(slug)}/`;
}

function extractAuthors(html: string, fallback: string[]): string[] {
  const candidates = [
    extractMetaContent(html, 'citation_author'),
    extractMetaContent(html, 'dc.creator'),
    extractSpanByClass(html, 'au'),
    extractPubInfoAuthors(html),
  ];

  for (const candidate of candidates) {
    const authors = splitAuthors(candidate ?? '');
    if (authors.length > 0) {
      return authors;
    }
  }

  return fallback;
}

function extractPubInfoAuthors(html: string): string | null {
  const pubInfo = extractElementById(html, 'pubinfo');
  if (!pubInfo) {
    return null;
  }

  const text = normalizeText(stripHtml(pubInfo));
  const byMatch = text.match(/\bby\s+(.+?)(?:\.\s+|\s+First published|\s+Winter|\s+Spring|\s+Summer|\s+Fall|$)/i);
  return byMatch?.[1] ?? null;
}

function extractPreamble(article: string, boundary: number): string {
  const beforeFirstSection = article.slice(0, boundary);
  const parts = extractParagraphs(beforeFirstSection)
    .map((paragraph) => normalizeText(stripHtml(paragraph)))
    .filter((text) => text.length > 0)
    .filter((text) => !/^First published\b/i.test(text))
    .filter((text) => !/^Copyright\b/i.test(text));

  return parts.join('\n\n');
}

function extractFirstNumberedSection(article: string, headings: HeadingMatch[]): { title: string; text: string } | null {
  const first = headings.find((heading) => /^\d+(?:\.\d+)*\.?\s+/.test(heading.title));
  if (!first) {
    return null;
  }

  const next = headings.find((heading) => heading.start > first.start && heading.level <= first.level);
  const sectionHtml = article.slice(first.end, next?.start ?? article.length);
  const text = extractParagraphs(sectionHtml)
    .map((paragraph) => normalizeText(stripHtml(paragraph)))
    .filter(Boolean)
    .join('\n\n');

  return {
    title: first.title,
    text,
  };
}

function extractRelatedEntries(article: string): SepRelatedEntry[] {
  const section = extractSectionByHeading(article, /related entries/i);
  if (!section) {
    return [];
  }

  const seen = new Set<string>();
  const results: SepRelatedEntry[] = [];
  for (const match of section.matchAll(/<a\b[^>]*href=["'](?:\.\.\/)?entries\/([^\/"'#?]+)\/?[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const slug = normalizeSepSlug(match[1]);
    const title = normalizeText(stripHtml(match[2]));
    if (!slug || !title || seen.has(slug)) {
      continue;
    }
    seen.add(slug);
    results.push({ slug, title });
  }

  return results;
}

function extractBibliography(article: string): SepBibliographyEntry[] {
  const section = extractSectionByHeading(article, /bibliography|references/i);
  if (!section) {
    return [];
  }

  const items = [
    ...extractListItems(section),
    ...extractParagraphs(section),
  ]
    .map((item) => normalizeText(stripHtml(item)))
    .filter(Boolean);

  const seen = new Set<string>();
  const entries: SepBibliographyEntry[] = [];
  for (const item of items) {
    if (seen.has(item)) {
      continue;
    }
    seen.add(item);
    const parsed = parseBibliographyItem(item);
    if (parsed) {
      entries.push(parsed);
    }
  }

  return entries;
}

function parseBibliographyItem(text: string): SepBibliographyEntry | null {
  const yearMatch = text.match(/\b(1\d{3}|20\d{2}|21\d{2}|n\.d\.)\b/i);
  const quotedTitleMatch = text.match(/["“]([^"”]+)["”]/);
  const afterYear = yearMatch
    ? text.slice((yearMatch.index ?? 0) + yearMatch[0].length).replace(/^[a-z]?[,.:]?\s*/i, '')
    : '';
  const unquotedTitle = normalizeText(
    afterYear
      .split(/,\s+(?=[A-Z][a-z]+(?:,\s+[A-Z]{2}:|:|\s+[A-Z][a-z]+:))/)[0] ?? '',
  ).replace(/[.;:,]+$/g, '');
  const authorPart = yearMatch ? text.slice(0, yearMatch.index).replace(/[\s,;:.]+$/g, '') : '';
  const authors = parseBibliographyAuthors(authorPart);
  const title = normalizeText(quotedTitleMatch?.[1] ?? unquotedTitle);
  const hasStructure = authors.length > 0 || yearMatch !== null || title.length > 0;

  if (!hasStructure) {
    return null;
  }

  return {
    raw: text,
    authors,
    year: yearMatch ? yearMatch[1] : null,
    title: title || null,
  };
}

function parseBibliographyAuthors(text: string): string[] {
  const normalized = normalizeText(text.replace(/,?\s+and\s+/gi, ', '));
  if (!normalized) {
    return [];
  }

  if (!normalized.includes(',')) {
    return splitAuthors(normalized);
  }

  const tokens = normalized.split(/\s*,\s*/).map((token) => token.trim()).filter(Boolean);
  const authors: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const current = tokens[index];
    const next = tokens[index + 1];
    if (next && looksLikeGivenNames(next) && !current.includes(' ')) {
      authors.push(`${current}, ${next}`);
      index += 1;
      continue;
    }

    authors.push(current);
  }

  return authors.map((author) => normalizeText(author)).filter(Boolean);
}

function looksLikeGivenNames(value: string): boolean {
  return /^[A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*)*$/.test(value);
}

function extractCanonicalUrl(html: string, slug: string, fallback?: string): string {
  const canonical = extractLinkHref(html, 'canonical');
  if (canonical) {
    return canonical;
  }

  const ogUrl = extractMetaContent(html, 'og:url');
  if (ogUrl) {
    return ogUrl;
  }

  return fallback ?? buildSepCanonicalUrl(slug);
}

function extractPublishedAt(html: string, article: string): string | null {
  return firstDate([
    extractMetaContent(html, 'citation_publication_date'),
    extractMetaContent(html, 'dc.date'),
    extractDateFromText(combinedText(html, article), /First published\s+([^;.,]+(?:,\s*\d{4})?)/i),
  ]);
}

function extractRevisedAt(html: string, article: string): string | null {
  const revised = firstDate([
    extractDateFromText(combinedText(html, article), /substantive revision\s+([^;.,]+(?:,\s*\d{4})?)/i),
    extractDateFromText(combinedText(html, article), /revised\s+([^;.,]+(?:,\s*\d{4})?)/i),
  ]);
  return revised;
}

function combinedText(html: string, article: string): string {
  return normalizeText(stripHtml(`${extractElementById(html, 'pubinfo') ?? ''} ${article}`));
}

function firstDate(values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const iso = toIsoDate(value ?? '');
    if (iso) {
      return iso;
    }
  }
  return null;
}

function extractDateFromText(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);
  return match ? match[1] : null;
}

function extractArticleBody(html: string): string {
  const candidates = [
    extractElementById(html, 'main-text'),
    extractElementById(html, 'aueditable'),
    extractTagText(html, 'article'),
    extractTagText(html, 'body'),
  ];

  return candidates.find((candidate) => typeof candidate === 'string' && candidate.length > 0) ?? html;
}

function extractSectionByHeading(article: string, headingPattern: RegExp): string | null {
  const headings = extractHeadings(article);
  const heading = headings.find((candidate) => headingPattern.test(candidate.title));
  if (!heading) {
    return null;
  }

  const next = headings.find((candidate) => candidate.start > heading.start && candidate.level <= heading.level);
  return article.slice(heading.end, next?.start ?? article.length);
}

function extractHeadings(html: string): HeadingMatch[] {
  const results: HeadingMatch[] = [];
  for (const match of html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    if (match.index === undefined) {
      continue;
    }

    results.push({
      level: Number(match[1]),
      title: normalizeText(stripHtml(match[2])),
      start: match.index,
      end: match.index + match[0].length,
      raw: match[0],
    });
  }
  return results;
}

function extractParagraphs(html: string): string[] {
  return [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((match) => match[1]);
}

function extractListItems(html: string): string[] {
  return [...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((match) => match[1]);
}

function extractTagText(html: string, tagName: string): string | null {
  const match = html.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  return match?.[1] ?? null;
}

function extractElementById(html: string, id: string): string | null {
  const start = html.search(new RegExp(`<([a-z0-9:-]+)\\b[^>]*\\bid=["']${escapeRegex(id)}["'][^>]*>`, 'i'));
  if (start < 0) {
    return null;
  }

  const openMatch = html.slice(start).match(/^<([a-z0-9:-]+)\b[^>]*>/i);
  if (!openMatch) {
    return null;
  }

  const tagName = openMatch[1].toLowerCase();
  const openEnd = start + openMatch[0].length;
  let depth = 1;
  let cursor = openEnd;
  const tagPattern = new RegExp(`<\\/?${escapeRegex(tagName)}\\b[^>]*>`, 'gi');
  tagPattern.lastIndex = openEnd;

  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = tagPattern.exec(html)) !== null) {
    const token = tagMatch[0];
    const selfClosing = /\/>$/.test(token);
    const closing = /^<\//.test(token);
    if (!closing && !selfClosing) {
      depth += 1;
    } else if (closing) {
      depth -= 1;
      if (depth === 0) {
        cursor = tagMatch.index;
        return html.slice(openEnd, cursor);
      }
    }
  }

  return html.slice(openEnd);
}

function extractSpanByClass(html: string, className: string): string | null {
  const match = html.match(new RegExp(`<span\\b[^>]*class=["'][^"']*\\b${escapeRegex(className)}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/span>`, 'i'));
  return match?.[1] ?? null;
}

function extractMetaContent(html: string, name: string): string | null {
  const patterns = [
    new RegExp(`<meta\\b[^>]*name=["']${escapeRegex(name)}["'][^>]*content=["']([^"']*)["'][^>]*>`, 'i'),
    new RegExp(`<meta\\b[^>]*content=["']([^"']*)["'][^>]*name=["']${escapeRegex(name)}["'][^>]*>`, 'i'),
    new RegExp(`<meta\\b[^>]*property=["']${escapeRegex(name)}["'][^>]*content=["']([^"']*)["'][^>]*>`, 'i'),
    new RegExp(`<meta\\b[^>]*content=["']([^"']*)["'][^>]*property=["']${escapeRegex(name)}["'][^>]*>`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decodeHtml(match[1]);
    }
  }

  return null;
}

function extractLinkHref(html: string, rel: string): string | null {
  const patterns = [
    new RegExp(`<link\\b[^>]*rel=["'][^"']*\\b${escapeRegex(rel)}\\b[^"']*["'][^>]*href=["']([^"']*)["'][^>]*>`, 'i'),
    new RegExp(`<link\\b[^>]*href=["']([^"']*)["'][^>]*rel=["'][^"']*\\b${escapeRegex(rel)}\\b[^"']*["'][^>]*>`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decodeHtml(match[1]);
    }
  }

  return null;
}

function splitAuthors(raw: string): string[] {
  return raw
    .replace(/^by\s+/i, '')
    .replace(/\set\sal\.?$/i, '')
    .split(/;|,\s+and\s+|\sand\s+|\s*&\s*|\s*,\s*(?=[A-Z][a-z]+\s+[A-Z])/)
    .map((author) => normalizeText(author))
    .filter(Boolean);
}

function stripHtml(value: string): string {
  return decodeHtml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '--');
}

function toIsoDate(value: string): string | null {
  const normalized = normalizeText(value)
    .replace(/^(Mon|Tue|Tues|Wed|Thu|Thur|Thurs|Fri|Sat|Sun)\s+/i, '')
    .replace(/\b(Winter|Spring|Summer|Fall)\s+\d{4}$/i, '')
    .replace(/\s+/g, ' ');
  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
}

function firstNonEmpty(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const normalized = normalizeText(value ?? '');
    if (normalized) {
      return normalized;
    }
  }
  return '';
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
