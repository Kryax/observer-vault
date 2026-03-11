import type {
  ForgeAdapter,
  ForgeFileContent,
  ForgeRepo,
  ForgeSearchParams,
  ForgeSearchResult,
} from '../types/forge';
import { parseSepEntryHtml } from './sep-entry';

const SEP_BASE_URL = 'https://plato.stanford.edu';
const SEP_CONTENTS_URL = `${SEP_BASE_URL}/contents.html`;
const MIN_REQUEST_DELAY_MS = 5000;

export interface SepAdapterOptions {
  baseUrl?: string;
  contentsUrl?: string;
  minRequestDelayMs?: number;
}

export interface SepContentsEntry {
  slug: string;
  title: string;
  authors: string[];
  anchorLetter?: string | null;
}

export interface SepEntrySnapshot {
  slug: string;
  title: string;
  authors: string[];
  preamble: string;
  firstSectionTitle: string | null;
  firstSectionText: string;
  bibliographyCount: number;
  bibliographyEntries: string[];
  publishedAt: string | null;
  revisedAt: string | null;
  relatedEntries: string[];
}

export class SepAdapter implements ForgeAdapter {
  readonly name = 'sep';

  private readonly baseUrl: string;
  private readonly contentsUrl: string;
  private readonly minRequestDelayMs: number;
  private lastRequestAt = 0;

  constructor(options: SepAdapterOptions = {}) {
    this.baseUrl = options.baseUrl ?? SEP_BASE_URL;
    this.contentsUrl = options.contentsUrl ?? SEP_CONTENTS_URL;
    this.minRequestDelayMs = options.minRequestDelayMs ?? MIN_REQUEST_DELAY_MS;
  }

  async searchRepos(params: ForgeSearchParams): Promise<ForgeSearchResult> {
    const entries = await this.fetchContentsEntries();
    const matches = filterContentsEntries(entries, params.topic).slice(0, params.limit);

    const repos: ForgeRepo[] = [];
    for (const entry of matches) {
      const snapshot = await this.fetchEntrySnapshot(entry.slug, entry);
      repos.push(mapSnapshotToForgeRepo(snapshot));
    }

    return {
      repos,
      totalCount: filterContentsEntries(entries, params.topic).length,
      hasMore: matches.length < filterContentsEntries(entries, params.topic).length,
    };
  }

  async getRepo(owner: string, repo: string): Promise<ForgeRepo> {
    assertSepOwner(owner);
    const slug = normalizeSepSlug(repo);
    return mapSnapshotToForgeRepo(await this.fetchEntrySnapshot(slug));
  }

  async getReadme(owner: string, repo: string): Promise<ForgeFileContent | null> {
    assertSepOwner(owner);
    const slug = normalizeSepSlug(repo);
    const snapshot = await this.fetchEntrySnapshot(slug);
    const content = buildReadmeContent(snapshot);

    return {
      content,
      encoding: 'utf-8',
      size: content.length,
      path: 'README.txt',
    };
  }

  async getFile(_owner: string, _repo: string, _path: string): Promise<ForgeFileContent | null> {
    return null;
  }

  async getContributorsCount(owner: string, repo: string): Promise<number> {
    const data = await this.getRepo(owner, repo);
    return data.contributorsCount ?? 0;
  }

  async getEntry(owner: string, repo: string): Promise<SepEntrySnapshot> {
    assertSepOwner(owner);
    return this.fetchEntrySnapshot(normalizeSepSlug(repo));
  }

  private async fetchContentsEntries(): Promise<SepContentsEntry[]> {
    await this.enforceRateLimit();
    const html = await fetchSepHtml(this.contentsUrl);
    return parseSepContents(html);
  }

  private async fetchEntrySnapshot(slug: string, fallback?: Partial<SepContentsEntry>): Promise<SepEntrySnapshot> {
    await this.enforceRateLimit();
    const html = await fetchSepHtml(buildSepEntryUrl(slug, this.baseUrl));
    return parseSepEntry(html, slug, fallback);
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const remaining = this.minRequestDelayMs - (now - this.lastRequestAt);
    if (remaining > 0) {
      await Bun.sleep(remaining);
    }
    this.lastRequestAt = Date.now();
  }
}

export function normalizeSepSlug(raw: string): string {
  return raw
    .trim()
    .replace(/^sep\//i, '')
    .replace(/^https?:\/\/plato\.stanford\.edu\/entries\//i, '')
    .replace(/\/+$/g, '')
    .replace(/^entries\//, '')
    .replace(/[^a-z0-9-]/gi, '-');
}

export function buildSepEntryUrl(slug: string, baseUrl: string = SEP_BASE_URL): string {
  return `${baseUrl}/entries/${normalizeSepSlug(slug)}/`;
}

export function parseSepContents(html: string): SepContentsEntry[] {
  const entries: SepContentsEntry[] = [];
  const seen = new Set<string>();
  let currentLetter: string | null = null;

  for (const line of html.split('\n')) {
    const heading = line.match(/<h2[^>]*>([A-Z])(?:<[^>]+>.*)?<\/h2>/i);
    if (heading) {
      currentLetter = heading[1];
    }

    const match = line.match(/<a[^>]+href="(?:\.\.\/)?entries\/([^/]+)\/"[^>]*>(.*?)<\/a>\s*(?:\((.*?)\))?/i);
    if (!match) {
      continue;
    }

    const slug = normalizeSepSlug(match[1]);
    if (!slug || seen.has(slug)) {
      continue;
    }

    seen.add(slug);
    entries.push({
      slug,
      title: normalizeText(stripHtml(match[2])),
      authors: splitAuthors(match[3] ?? ''),
      anchorLetter: currentLetter,
    });
  }

  return entries;
}

export function filterContentsEntries(entries: SepContentsEntry[], topic: string): SepContentsEntry[] {
  const tokens = topic
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return entries;
  }

  return entries.filter((entry) => {
    const haystack = [entry.slug, entry.title, entry.authors.join(' ')].join(' ').toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  });
}

export function parseSepEntry(
  html: string,
  slug: string,
  fallback: Partial<SepContentsEntry> = {},
): SepEntrySnapshot {
  const parsed = parseSepEntryHtml(html, slug, {
    title: fallback.title,
    authors: fallback.authors,
  });

  return {
    slug,
    title: parsed.title,
    authors: parsed.authors,
    preamble: parsed.preamble,
    firstSectionTitle: parsed.firstSectionTitle,
    firstSectionText: parsed.firstSectionText,
    bibliographyCount: parsed.bibliography.length,
    bibliographyEntries: parsed.bibliography.map((entry) => entry.raw),
    publishedAt: parsed.publishedAt,
    revisedAt: parsed.revisedAt,
    relatedEntries: parsed.relatedEntries.map((entry) => entry.slug),
  };
}

function mapSnapshotToForgeRepo(snapshot: SepEntrySnapshot): ForgeRepo {
  const description = snapshot.preamble.slice(0, 200) || null;
  const topics = [...new Set(snapshot.relatedEntries.map(normalizeSepSlug).filter(Boolean))];
  const createdAt = snapshot.publishedAt ?? new Date(0).toISOString();
  const updatedAt = snapshot.revisedAt ?? createdAt;
  return {
    id: snapshot.slug,
    name: snapshot.title,
    fullName: `sep/${snapshot.slug}`,
    description,
    url: buildSepEntryUrl(snapshot.slug),
    homepage: null,
    stars: 0,
    forks: 0,
    watchers: 0,
    openIssues: 0,
    language: null,
    languages: {},
    license: null,
    topics,
    createdAt,
    updatedAt,
    pushedAt: updatedAt,
    defaultBranch: 'main',
    hasReadme: true,
    isArchived: false,
    isFork: false,
    size: Math.ceil((snapshot.preamble.length + snapshot.firstSectionText.length) / 1024),
    contributorsCount: snapshot.authors.length,
  };
}

function buildReadmeContent(snapshot: SepEntrySnapshot): string {
  const parts = [snapshot.preamble];
  if (snapshot.firstSectionTitle || snapshot.firstSectionText) {
    parts.push([
      snapshot.firstSectionTitle ? `## ${snapshot.firstSectionTitle}` : null,
      snapshot.firstSectionText,
    ].filter(Boolean).join('\n\n'));
  }
  return parts.filter(Boolean).join('\n\n');
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function splitAuthors(raw: string): string[] {
  return raw
    .split(/,| and /i)
    .map((author) => normalizeText(author))
    .filter(Boolean);
}

function assertSepOwner(owner: string): void {
  if (owner !== 'sep') {
    throw new Error(`SEP adapter expects owner "sep", received: ${owner}`);
  }
}

async function fetchSepHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'observer-ocp-scraper/0.1.0 (SEP adapter; contact Adam)',
    },
  });

  if (!response.ok) {
    throw new Error(`SEP fetch failed: ${response.status} ${response.statusText}`);
  }

  return response.text();
}
