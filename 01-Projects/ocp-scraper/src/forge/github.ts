import { Octokit } from '@octokit/rest';
import type { ForgeAdapter, ForgeRepo, ForgeSearchParams, ForgeSearchResult, ForgeFileContent } from '../types/forge';

export class GitHubAdapter implements ForgeAdapter {
  readonly name = 'github';
  private octokit: Octokit;

  constructor(token?: string) {
    const authToken = token || process.env.GITHUB_TOKEN;
    if (!authToken) {
      throw new Error('GITHUB_TOKEN environment variable is required for GitHub API access');
    }
    this.octokit = new Octokit({ auth: authToken });
  }

  async searchRepos(params: ForgeSearchParams): Promise<ForgeSearchResult> {
    // Use topic: prefix for single-word topics, text search for multi-word queries
    const topicPart = params.topic.includes(' ')
      ? `${params.topic} in:name,description,readme`
      : `topic:${params.topic}`;
    const query = `${topicPart}${params.minStars ? ` stars:>=${params.minStars}` : ''}${params.language ? ` language:${params.language}` : ''} sort:stars`;

    const response = await this.octokit.search.repos({
      q: query,
      per_page: Math.min(params.limit, 100),
      sort: 'stars',
      order: 'desc',
    });

    const repos: ForgeRepo[] = response.data.items.map(item => this.mapRepo(item));

    return {
      repos,
      totalCount: response.data.total_count,
      hasMore: response.data.total_count > params.limit,
    };
  }

  async getRepo(owner: string, repo: string): Promise<ForgeRepo> {
    const { data } = await this.octokit.repos.get({ owner, repo });
    return this.mapRepo(data);
  }

  async getReadme(owner: string, repo: string): Promise<ForgeFileContent | null> {
    try {
      const { data } = await this.octokit.repos.getReadme({ owner, repo, mediaType: { format: 'raw' } });
      return {
        content: data as unknown as string,
        encoding: 'utf-8',
        size: (data as unknown as string).length,
        path: 'README.md',
      };
    } catch (e: unknown) {
      const error = e as { status?: number };
      if (error.status === 404) return null;
      throw e;
    }
  }

  async getFile(owner: string, repo: string, path: string): Promise<ForgeFileContent | null> {
    try {
      const { data } = await this.octokit.repos.getContent({ owner, repo, path });
      if (Array.isArray(data) || data.type !== 'file') return null;

      const content = data.encoding === 'base64'
        ? Buffer.from(data.content, 'base64').toString('utf-8')
        : data.content;

      return {
        content,
        encoding: 'utf-8',
        size: data.size,
        path: data.path,
      };
    } catch (e: unknown) {
      const error = e as { status?: number };
      if (error.status === 404) return null;
      throw e;
    }
  }

  async getContributorsCount(owner: string, repo: string): Promise<number> {
    try {
      // Use per_page=1 and check the Link header for total count
      const response = await this.octokit.repos.listContributors({ owner, repo, per_page: 1, anon: 'true' });

      // Parse Link header for last page number
      const linkHeader = response.headers.link;
      if (linkHeader) {
        const match = linkHeader.match(/page=(\d+)>; rel="last"/);
        if (match) return parseInt(match[1], 10);
      }

      return response.data.length;
    } catch {
      return 0;
    }
  }

  private mapRepo(item: Record<string, unknown>): ForgeRepo {
    const owner = item.owner as Record<string, unknown> | undefined;
    const license = item.license as Record<string, unknown> | null;
    return {
      id: String(item.id),
      name: String(item.name || ''),
      fullName: String(item.full_name || ''),
      description: item.description ? String(item.description) : null,
      url: String(item.html_url || ''),
      homepage: item.homepage ? String(item.homepage) : null,
      stars: Number(item.stargazers_count || 0),
      forks: Number(item.forks_count || 0),
      watchers: Number(item.watchers_count || 0),
      openIssues: Number(item.open_issues_count || 0),
      language: item.language ? String(item.language) : null,
      license: license?.spdx_id ? String(license.spdx_id) : null,
      topics: Array.isArray(item.topics) ? item.topics.map(String) : [],
      createdAt: String(item.created_at || ''),
      updatedAt: String(item.updated_at || ''),
      pushedAt: String(item.pushed_at || ''),
      defaultBranch: String(item.default_branch || 'main'),
      hasReadme: true, // GitHub always reports this; we verify by fetching
      isArchived: Boolean(item.archived),
      isFork: Boolean(item.fork),
      size: Number(item.size || 0),
    };
  }
}
