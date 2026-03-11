import type {
  ForgeAdapter,
  ForgeFileContent,
  ForgeRepo,
  ForgeSearchParams,
  ForgeSearchResult,
} from '../types/forge';

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
    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'observer-ocp-scraper/0.1.0 (academic adapter; contact Adam)',
      },
    });

    if (!response.ok) {
      throw new Error(`arXiv API error: ${response.status} ${response.statusText}`);
    }

    const xml = await response.text();
    const entries = extractArxivEntries(xml);
    const repos = entries.map(mapEntryToForgeRepo);

    return {
      repos,
      totalCount: repos.length,
      hasMore: repos.length >= params.limit,
    };
  }

  async getRepo(owner: string, repo: string): Promise<ForgeRepo> {
    assertArxivOwner(owner);

    const query = `id_list=${encodeURIComponent(normalizeArxivId(repo))}`;
    await this.enforceRateLimit();
    const response = await fetch(`${this.apiUrl}?${query}`, {
      headers: {
        'User-Agent': 'observer-ocp-scraper/0.1.0 (academic adapter; contact Adam)',
      },
    });

    if (!response.ok) {
      throw new Error(`arXiv API error: ${response.status} ${response.statusText}`);
    }

    const xml = await response.text();
    const entries = extractArxivEntries(xml);
    const entry = entries[0];

    if (!entry) {
      throw new Error(`arXiv paper not found: ${repo}`);
    }

    return mapEntryToForgeRepo(entry);
  }

  async getReadme(owner: string, repo: string): Promise<ForgeFileContent | null> {
    const paper = await this.getRepo(owner, repo);
    const abstract = paper.description ?? '';

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
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

function sanitizeQueryTerm(value: string): string {
  return value.trim().replace(/\s+/g, '+');
}

interface ArxivEntry {
  id: string;
  title: string;
  abstract: string;
  categories: string[];
  published: string;
  updated: string;
  doi: string | null;
  pdfUrl: string | null;
  authors: string[];
}

function extractArxivEntries(xml: string): ArxivEntry[] {
  const entryBlocks = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];
  return entryBlocks.map((match) => parseEntryBlock(match[1])).filter((entry): entry is ArxivEntry => entry !== null);
}

function parseEntryBlock(block: string): ArxivEntry | null {
  const id = normalizeArxivId(extractSingleTag(block, 'id') ?? '');
  const title = decodeXml(extractSingleTag(block, 'title') ?? '').replace(/\s+/g, ' ').trim();
  if (!id || !title) {
    return null;
  }

  const abstract = decodeXml(extractSingleTag(block, 'summary') ?? '').replace(/\s+/g, ' ').trim();
  const published = extractSingleTag(block, 'published') ?? new Date(0).toISOString();
  const updated = extractSingleTag(block, 'updated') ?? published;
  const doi = extractSingleTag(block, 'arxiv:doi');
  const authors = [...block.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/g)]
    .map((match) => decodeXml(match[1]).replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const categories = [...block.matchAll(/<category[^>]*term="([^"]+)"/g)].map((match) => match[1]);
  const pdfUrl = extractPdfUrl(block);

  return {
    id,
    title,
    abstract,
    categories,
    published,
    updated,
    doi: doi ? decodeXml(doi).trim() : null,
    pdfUrl,
    authors,
  };
}

function extractSingleTag(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`));
  return match ? match[1] : null;
}

function extractPdfUrl(block: string): string | null {
  const match = block.match(/<link[^>]*title="pdf"[^>]*href="([^"]+)"/i) ??
    block.match(/<link[^>]*href="([^"]+\.pdf)"/i);
  return match ? decodeXml(match[1]).trim() : null;
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function assertArxivOwner(owner: string): void {
  if (owner !== 'arxiv') {
    throw new Error(`arXiv adapter expects owner "arxiv", received: ${owner}`);
  }
}

function mapEntryToForgeRepo(entry: ArxivEntry): ForgeRepo {
  return {
    id: entry.id,
    name: entry.title,
    fullName: `arxiv/${entry.id}`,
    description: entry.abstract.slice(0, 200) || null,
    url: `${ARXIV_ABS_URL}/${entry.id}`,
    homepage: entry.pdfUrl,
    stars: 0,
    forks: 0,
    watchers: 0,
    openIssues: 0,
    language: entry.categories[0] ?? null,
    languages: {},
    license: null,
    topics: entry.categories,
    createdAt: entry.published,
    updatedAt: entry.updated,
    pushedAt: entry.updated,
    defaultBranch: 'main',
    hasReadme: true,
    isArchived: false,
    isFork: false,
    size: Math.ceil(entry.abstract.length / 1024),
    contributorsCount: entry.authors.length,
  };
}
