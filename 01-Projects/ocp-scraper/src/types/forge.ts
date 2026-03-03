/**
 * ForgeAdapter -- Platform-agnostic interface for code forge APIs
 * Implementations: GitHubAdapter (Phase 1), Codeberg/Forgejo (Phase 2+)
 *
 * IMPORTANT: This file MUST remain platform-agnostic.
 * No GitHub imports. No Octokit types. No forge-specific dependencies.
 */

/** Repository metadata from any forge */
export interface ForgeRepo {
  id: string;
  name: string;
  fullName: string;
  description: string | null;
  url: string;
  homepage: string | null;
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  language: string | null;
  languages?: Record<string, number>; // language -> bytes
  license: string | null;
  topics: string[];
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
  defaultBranch: string;
  hasReadme: boolean;
  isArchived: boolean;
  isFork: boolean;
  size: number; // KB
  contributorsCount?: number;
}

/** Search parameters */
export interface ForgeSearchParams {
  topic: string;
  limit: number;
  minStars?: number;
  language?: string;
}

/** Search result page */
export interface ForgeSearchResult {
  repos: ForgeRepo[];
  totalCount: number;
  hasMore: boolean;
}

/** File content from forge */
export interface ForgeFileContent {
  content: string;
  encoding: 'utf-8' | 'base64';
  size: number;
  path: string;
}

/** The adapter interface */
export interface ForgeAdapter {
  /** Name of the forge platform */
  readonly name: string;

  /** Search repositories by topic */
  searchRepos(params: ForgeSearchParams): Promise<ForgeSearchResult>;

  /** Get full repository metadata */
  getRepo(owner: string, repo: string): Promise<ForgeRepo>;

  /** Get README content */
  getReadme(owner: string, repo: string): Promise<ForgeFileContent | null>;

  /** Get file content by path */
  getFile(
    owner: string,
    repo: string,
    path: string,
  ): Promise<ForgeFileContent | null>;

  /** Get contributors count */
  getContributorsCount(owner: string, repo: string): Promise<number>;
}
