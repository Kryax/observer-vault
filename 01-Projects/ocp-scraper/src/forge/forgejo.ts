import type {
  ForgeAdapter,
  ForgeRepo,
  ForgeSearchParams,
  ForgeSearchResult,
  ForgeFileContent,
} from '../types/forge';

export interface ForgejoAdapterOptions {
  baseUrl?: string;
  token?: string;
}

/**
 * ForgejoAdapter -- works with any Forgejo instance (Codeberg, Gitea, self-hosted).
 *
 * Codeberg IS Forgejo, so this single class covers both ISC-Forge-1 (Codeberg adapter)
 * and ISC-Forge-4 (shared implementation via base class / single parameterized class).
 *
 * Authentication is OPTIONAL -- Codeberg allows unauthenticated public reads.
 */
export class ForgejoAdapter implements ForgeAdapter {
  readonly name: string;
  private readonly apiBase: string;
  private readonly headers: Record<string, string>;

  constructor(options?: ForgejoAdapterOptions) {
    const baseUrl = (options?.baseUrl ?? 'https://codeberg.org').replace(/\/+$/, '');
    const token = options?.token ?? process.env.CODEBERG_TOKEN;

    // Extract hostname for the adapter name (e.g., 'codeberg.org')
    try {
      this.name = new URL(baseUrl).hostname;
    } catch {
      this.name = baseUrl;
    }

    this.apiBase = `${baseUrl}/api/v1`;

    this.headers = {
      'Accept': 'application/json',
    };
    if (token) {
      this.headers['Authorization'] = `token ${token}`;
    }
  }

  async searchRepos(params: ForgeSearchParams): Promise<ForgeSearchResult> {
    // Forgejo search: q param with topic=true to search by topic
    const searchParams = new URLSearchParams({
      q: params.topic,
      topic: 'true',
      sort: 'stars',
      order: 'desc',
      limit: String(Math.min(params.limit, 50)), // Forgejo max per page is 50
    });

    if (params.language) {
      // Forgejo doesn't have a native language filter in search,
      // but we can filter client-side after fetching
    }

    const url = `${this.apiBase}/repos/search?${searchParams.toString()}`;
    const response = await this.fetchJson<ForgejoSearchResponse>(url);

    let repos = response.data.map((item) => this.mapRepo(item));

    // Client-side filters that Forgejo API doesn't support natively
    if (params.minStars) {
      repos = repos.filter((r) => r.stars >= params.minStars!);
    }
    if (params.language) {
      const lang = params.language.toLowerCase();
      repos = repos.filter((r) => r.language?.toLowerCase() === lang);
    }

    return {
      repos,
      totalCount: repos.length,
      hasMore: response.data.length >= Math.min(params.limit, 50),
    };
  }

  async getRepo(owner: string, repo: string): Promise<ForgeRepo> {
    const url = `${this.apiBase}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    const data = await this.fetchJson<ForgejoRepoResponse>(url);
    return this.mapRepo(data);
  }

  async getReadme(owner: string, repo: string): Promise<ForgeFileContent | null> {
    // Try common README filenames in order
    const candidates = ['README.md', 'README.rst', 'README', 'readme.md'];

    for (const filename of candidates) {
      const url = `${this.apiBase}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/raw/${filename}`;
      try {
        const response = await fetch(url, { headers: this.headers });
        if (response.ok) {
          const content = await response.text();
          return {
            content,
            encoding: 'utf-8',
            size: content.length,
            path: filename,
          };
        }
        if (response.status === 404) {
          continue;
        }
        // Other errors -- throw
        throw new Error(`Forgejo API error: ${response.status} ${response.statusText}`);
      } catch (e: unknown) {
        if (e instanceof Error && e.message.startsWith('Forgejo API error')) {
          throw e;
        }
        // Network errors on individual candidates -- try next
        continue;
      }
    }

    return null;
  }

  async getFile(owner: string, repo: string, path: string): Promise<ForgeFileContent | null> {
    const url = `${this.apiBase}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURI(path)}`;
    try {
      const data = await this.fetchJson<ForgejoContentsResponse>(url);

      // Contents endpoint returns base64-encoded content
      if (data.type !== 'file') return null;

      const content = data.encoding === 'base64' && data.content
        ? Buffer.from(data.content, 'base64').toString('utf-8')
        : (data.content ?? '');

      return {
        content,
        encoding: 'utf-8',
        size: data.size,
        path: data.path,
      };
    } catch (e: unknown) {
      if (e instanceof ForgejoNotFoundError) return null;
      throw e;
    }
  }

  async getContributorsCount(owner: string, repo: string): Promise<number> {
    const url = `${this.apiBase}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contributors`;
    try {
      const data = await this.fetchJson<ForgejoContributor[]>(url);
      return data.length;
    } catch {
      return 0;
    }
  }

  // ---- Private helpers ----

  private async fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url, { headers: this.headers });

    if (response.status === 404) {
      throw new ForgejoNotFoundError(url);
    }

    if (!response.ok) {
      throw new Error(`Forgejo API error: ${response.status} ${response.statusText} for ${url}`);
    }

    return response.json() as Promise<T>;
  }

  private mapRepo(item: ForgejoRepoResponse): ForgeRepo {
    return {
      id: String(item.id),
      name: item.name ?? '',
      fullName: item.full_name ?? '',
      description: item.description || null,
      url: item.html_url ?? '',
      homepage: item.website || null,
      stars: item.stars_count ?? 0,
      forks: item.forks_count ?? 0,
      watchers: item.watchers_count ?? 0,
      openIssues: item.open_issues_count ?? 0,
      language: item.language || null,
      license: item.license?.spdx_id ?? null,
      topics: Array.isArray(item.topics) ? item.topics : [],
      createdAt: item.created_at ?? '',
      updatedAt: item.updated_at ?? '',
      pushedAt: item.updated_at ?? '', // Forgejo doesn't have pushed_at; use updated_at
      defaultBranch: item.default_branch ?? 'main',
      hasReadme: item.has_wiki !== undefined ? true : true, // Verify by fetching
      isArchived: item.archived ?? false,
      isFork: item.fork ?? false,
      size: item.size ?? 0,
    };
  }
}

// ---- Forgejo API response types (internal) ----

class ForgejoNotFoundError extends Error {
  constructor(url: string) {
    super(`Not found: ${url}`);
    this.name = 'ForgejoNotFoundError';
  }
}

interface ForgejoSearchResponse {
  data: ForgejoRepoResponse[];
  ok: boolean;
}

interface ForgejoRepoResponse {
  id: number;
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  website: string;
  stars_count: number;
  forks_count: number;
  watchers_count: number;
  open_issues_count: number;
  language: string;
  license: { spdx_id: string; name: string } | null;
  topics: string[];
  created_at: string;
  updated_at: string;
  default_branch: string;
  has_wiki: boolean;
  archived: boolean;
  fork: boolean;
  size: number;
}

interface ForgejoContentsResponse {
  type: string;
  encoding: string;
  content: string | null;
  size: number;
  path: string;
  name: string;
}

interface ForgejoContributor {
  id: number;
  login: string;
  contributions: number;
}
