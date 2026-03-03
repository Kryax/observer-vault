import type { ForgeRepo } from '../types/forge';

/**
 * Extracted metadata from a forge repository.
 * Normalized form used by the record assembler.
 */
export interface RepoMetadata {
  // Identity
  id: string;
  name: string;
  fullName: string;
  description: string;
  url: string;
  homepage: string | null;

  // Signals
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  contributorsCount: number;
  size: number; // KB

  // Classification
  language: string | null;
  languages: Record<string, number>;
  topics: string[];
  license: string | null;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
  ageInDays: number;
  daysSinceLastPush: number;

  // Flags
  isArchived: boolean;
  isFork: boolean;
  defaultBranch: string;
}

/**
 * Extract normalized metadata from a ForgeRepo.
 * Pure function — no API calls, just field mapping and computation.
 */
export function extractMetadata(repo: ForgeRepo, contributorsCount: number = 0): RepoMetadata {
  const now = Date.now();
  const createdDate = new Date(repo.createdAt).getTime();
  const pushedDate = new Date(repo.pushedAt).getTime();

  return {
    // Identity
    id: repo.id,
    name: repo.name,
    fullName: repo.fullName,
    description: repo.description || '',
    url: repo.url,
    homepage: repo.homepage,

    // Signals
    stars: repo.stars,
    forks: repo.forks,
    watchers: repo.watchers,
    openIssues: repo.openIssues,
    contributorsCount: contributorsCount || repo.contributorsCount || 0,
    size: repo.size,

    // Classification
    language: repo.language,
    languages: repo.languages || {},
    topics: repo.topics,
    license: repo.license,

    // Timestamps
    createdAt: repo.createdAt,
    updatedAt: repo.updatedAt,
    pushedAt: repo.pushedAt,
    ageInDays: Math.floor((now - createdDate) / (1000 * 60 * 60 * 24)),
    daysSinceLastPush: Math.floor((now - pushedDate) / (1000 * 60 * 60 * 24)),

    // Flags
    isArchived: repo.isArchived,
    isFork: repo.isFork,
    defaultBranch: repo.defaultBranch,
  };
}

/**
 * Derive implementation type from repo metadata heuristically.
 */
export function inferImplementationType(meta: RepoMetadata): 'library' | 'framework' | 'tool' | 'service' | 'pattern' | 'algorithm' | 'configuration' {
  const desc = (meta.description + ' ' + meta.topics.join(' ')).toLowerCase();

  if (desc.includes('framework') || meta.topics.includes('framework')) return 'framework';
  if (desc.includes('cli') || desc.includes('command-line') || desc.includes('tool')) return 'tool';
  if (desc.includes('service') || desc.includes('server') || desc.includes('api')) return 'service';
  if (desc.includes('algorithm') || desc.includes('data-structure')) return 'algorithm';
  if (desc.includes('config') || desc.includes('dotfiles') || desc.includes('boilerplate')) return 'configuration';
  if (desc.includes('pattern') || desc.includes('example') || desc.includes('template')) return 'pattern';

  // Default: library
  return 'library';
}

/**
 * Infer domains from repo topics and language.
 * Returns at least one domain tag.
 */
export function inferDomains(meta: RepoMetadata): string[] {
  const domains = new Set<string>();
  const topicStr = meta.topics.join(' ').toLowerCase();
  const desc = (meta.description || '').toLowerCase();
  const combined = topicStr + ' ' + desc;

  // Domain mapping from common topics/descriptions
  const domainMap: Record<string, string[]> = {
    'web': ['web-development'],
    'frontend': ['web-development', 'frontend'],
    'backend': ['web-development', 'backend'],
    'api': ['web-development', 'backend'],
    'database': ['data-management'],
    'ml': ['machine-learning'],
    'machine-learning': ['machine-learning'],
    'ai': ['machine-learning'],
    'deep-learning': ['machine-learning'],
    'security': ['security'],
    'crypto': ['security', 'cryptography'],
    'devops': ['devops'],
    'docker': ['devops', 'containerization'],
    'kubernetes': ['devops', 'containerization'],
    'testing': ['testing'],
    'cli': ['developer-tools'],
    'automation': ['automation'],
    'data': ['data-management'],
    'networking': ['networking'],
    'mobile': ['mobile-development'],
    'ios': ['mobile-development'],
    'android': ['mobile-development'],
    'game': ['game-development'],
    'graphics': ['graphics'],
    'audio': ['media'],
    'video': ['media'],
  };

  for (const [keyword, mappedDomains] of Object.entries(domainMap)) {
    if (combined.includes(keyword)) {
      for (const d of mappedDomains) domains.add(d);
    }
  }

  // Add language-based domain
  if (meta.language) {
    domains.add(`lang:${meta.language.toLowerCase()}`);
  }

  // Ensure at least one domain
  if (domains.size === 0) {
    domains.add('software');
  }

  return Array.from(domains);
}
