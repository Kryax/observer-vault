import type {
  ForgeAdapter,
  ForgeFileContent,
  ForgeRepo,
  ForgeSearchParams,
  ForgeSearchResult,
} from '../types/forge';
import { parseArxivFeed, type ArxivFeedEntry } from './arxiv-feed';
import type { ArxivPaperMetadata } from '../record/arxiv';

const ARXIV_API_URL = 'http://export.arxiv.org/api/query';
const ARXIV_ABS_URL = 'https://arxiv.org/abs';
const MIN_REQUEST_DELAY_MS = 3000;

export interface ArxivAdapterOptions {
  apiUrl?: string;
  minRequestDelayMs?: number;
}

export interface ArxivQueryOptions {
  category?: string;
  title?: string;
  author?: string;
  keyword?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * arXiv adapter mapped onto the existing ForgeAdapter contract.
 *
 * Mapping for v1:
 * - owner is always `arxiv`
 * - repo is the arXiv identifier
 * - README is the abstract
 * - file tree is unsupported
 */
export class ArxivAdapter implements ForgeAdapter {
  readonly name = 'arxiv';

  private readonly apiUrl: string;
  private readonly minRequestDelayMs: number;
  private lastRequestAt = 0;

  constructor(options: ArxivAdapterOptions = {}) {
    this.apiUrl = options.apiUrl ?? ARXIV_API_URL;
    this.minRequestDelayMs = options.minRequestDelayMs ?? MIN_REQUEST_DELAY_MS;
  }

  async searchRepos(params: ForgeSearchParams): Promise<ForgeSearchResult> {
    const query = buildArxivSearchQuery(parseTopicQuery(params.topic));
    const url = new URL(this.apiUrl);
    url.searchParams.set('search_query', query);
    url.searchParams.set('start', '0');
    url.searchParams.set('max_results', String(Math.min(params.limit, 100)));
    url.searchParams.set('sortBy', 'submittedDate');
    url.searchParams.set('sortOrder', 'descending');

    await this.enforceRateLimit();
    const xml = await fetchArxivXml(url.toString());
    const feed = parseArxivFeed(xml);
    const repos = feed.entries.map(mapEntryToForgeRepo);

    return {
      repos,
      totalCount: feed.totalResults ?? repos.length,
      hasMore: (feed.totalResults ?? repos.length) > repos.length,
    };
  }

  async getRepo(owner: string, repo: string): Promise<ForgeRepo> {
    assertArxivOwner(owner);
    return mapEntryToForgeRepo(await this.fetchEntryById(repo));
  }

  async getPaper(owner: string, repo: string): Promise<ArxivPaperMetadata> {
    assertArxivOwner(owner);
    const entry = await this.fetchEntryById(repo);
    return mapEntryToPaperMetadata(entry);
  }

  async getReadme(owner: string, repo: string): Promise<ForgeFileContent | null> {
    assertArxivOwner(owner);
    const paper = mapEntryToPaperMetadata(await this.fetchEntryById(repo));
    const abstract = paper.abstract;

    return {
      content: abstract,
      encoding: 'utf-8',
      size: abstract.length,
      path: 'ABSTRACT.txt',
    };
  }

  async getFile(_owner: string, _repo: string, _path: string): Promise<ForgeFileContent | null> {
    return null;
  }

  async getContributorsCount(owner: string, repo: string): Promise<number> {
    const paper = await this.getRepo(owner, repo);
    return paper.contributorsCount ?? 0;
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const remaining = this.minRequestDelayMs - (now - this.lastRequestAt);
    if (remaining > 0) {
      await Bun.sleep(remaining);
    }
    this.lastRequestAt = Date.now();
  }

  private async fetchEntryById(repo: string): Promise<ArxivFeedEntry> {
    const query = `id_list=${encodeURIComponent(normalizeArxivId(repo))}`;
    await this.enforceRateLimit();
    const xml = await fetchArxivXml(`${this.apiUrl}?${query}`);
    const entry = parseArxivFeed(xml).entries[0];

    if (!entry) {
      throw new Error(`arXiv paper not found: ${repo}`);
    }

    return entry;
  }
}

export function normalizeArxivId(raw: string): string {
  return raw
    .trim()
    .replace(/^arxiv:/i, '')
    .replace(/^https?:\/\/arxiv\.org\/(abs|pdf)\//i, '')
    .replace(/\.pdf$/i, '');
}

export function buildArxivSearchQuery(options: ArxivQueryOptions): string {
  const parts: string[] = [];

  if (options.category) {
    parts.push(`cat:${sanitizeQueryTerm(options.category)}`);
  }
  if (options.title) {
    parts.push(`ti:${sanitizeQueryTerm(options.title)}`);
  }
  if (options.author) {
    parts.push(`au:${sanitizeQueryTerm(options.author)}`);
  }
  if (options.keyword) {
    parts.push(`all:${sanitizeQueryTerm(options.keyword)}`);
  }
  if (options.dateFrom || options.dateTo) {
    parts.push(buildDateRangeTerm(options.dateFrom, options.dateTo));
  }

  if (parts.length === 0) {
    throw new Error('arXiv query requires at least one category, title, author, or keyword term');
  }

  return parts.join('+AND+');
}

export function parseTopicQuery(topic: string): ArxivQueryOptions {
  const trimmed = topic.trim();
  if (!trimmed) {
    throw new Error('Topic is required for arXiv search');
  }

  const explicit = parseExplicitQuery(trimmed);
  if (explicit) {
    return explicit;
  }

  if (/^[a-z\-]+\.[A-Z\-]+$/.test(trimmed)) {
    return { category: trimmed };
  }

  return { keyword: trimmed };
}

function parseExplicitQuery(topic: string): ArxivQueryOptions | null {
  const result: ArxivQueryOptions = {};
  const parts = topic.split(/\s*;\s*/).filter(Boolean);

  if (parts.length === 0 || !parts.some((part) => part.includes(':'))) {
    return null;
  }

  for (const part of parts) {
    const [rawKey, ...rest] = part.split(':');
    const value = rest.join(':').trim();
    if (!value) continue;

    switch (rawKey.trim().toLowerCase()) {
      case 'cat':
      case 'category':
      case 'topic':
        result.category = value;
        break;
      case 'ti':
      case 'title':
        result.title = value;
        break;
      case 'au':
      case 'author':
        result.author = value;
        break;
      case 'all':
      case 'keyword':
      case 'q':
        result.keyword = value;
        break;
      case 'from':
      case 'date-from':
      case 'start':
        result.dateFrom = value;
        break;
      case 'to':
      case 'until':
      case 'date-to':
      case 'end':
        result.dateTo = value;
        break;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

function sanitizeQueryTerm(value: string): string {
  return value.trim().replace(/\s+/g, '+');
}

function assertArxivOwner(owner: string): void {
  if (owner !== 'arxiv') {
    throw new Error(`arXiv adapter expects owner "arxiv", received: ${owner}`);
  }
}

function mapEntryToForgeRepo(entry: ArxivFeedEntry): ForgeRepo {
  const arxivId = entry.arxivId ?? '';
  return {
    id: arxivId,
    name: entry.title,
    fullName: `arxiv/${arxivId}`,
    description: entry.abstract.slice(0, 200) || null,
    url: `${ARXIV_ABS_URL}/${arxivId}`,
    homepage: entry.pdfUrl,
    stars: 0,
    forks: 0,
    watchers: 0,
    openIssues: 0,
    language: entry.primaryCategory ?? entry.categories[0] ?? null,
    languages: {},
    license: null,
    topics: entry.categories,
    createdAt: entry.published ?? new Date(0).toISOString(),
    updatedAt: entry.updated ?? entry.published ?? new Date(0).toISOString(),
    pushedAt: entry.updated ?? entry.published ?? new Date(0).toISOString(),
    defaultBranch: 'main',
    hasReadme: true,
    isArchived: false,
    isFork: false,
    size: Math.ceil(entry.abstract.length / 1024),
    contributorsCount: entry.authors.length,
  };
}

function mapEntryToPaperMetadata(entry: ArxivFeedEntry): ArxivPaperMetadata {
  const id = entry.arxivId ?? '';
  return {
    id,
    title: entry.title,
    abstract: entry.abstract,
    authors: entry.authors,
    categories: entry.categories,
    published: entry.published ?? new Date(0).toISOString(),
    updated: entry.updated ?? entry.published ?? new Date(0).toISOString(),
    doi: entry.doi,
    pdfUrl: entry.pdfUrl,
    absUrl: `${ARXIV_ABS_URL}/${id}`,
    comment: entry.comment,
    journalRef: entry.journalRef,
  };
}

function buildDateRangeTerm(dateFrom?: string, dateTo?: string): string {
  const start = formatArxivDateBound(dateFrom, 'start');
  const end = formatArxivDateBound(dateTo, 'end');
  return `submittedDate:[${start}+TO+${end}]`;
}

function formatArxivDateBound(value: string | undefined, bound: 'start' | 'end'): string {
  if (!value) {
    return bound === 'start' ? '000000000000' : '300012312359';
  }

  const digits = value.replace(/[^0-9]/g, '');
  if (digits.length === 8) {
    return `${digits}${bound === 'start' ? '0000' : '2359'}`;
  }
  if (digits.length === 12) {
    return digits;
  }

  throw new Error(`Invalid arXiv date bound: ${value}`);
}

async function fetchArxivXml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'observer-ocp-scraper/0.1.0 (academic adapter; contact Adam)',
    },
  });

  if (!response.ok) {
    throw new Error(`arXiv API error: ${response.status} ${response.statusText}`);
  }

  return response.text();
}
