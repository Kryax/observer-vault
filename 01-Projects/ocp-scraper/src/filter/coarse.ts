import type { ForgeRepo } from '../types/forge';

/** Coarse filter thresholds */
export interface CoarseFilterConfig {
  minStars: number;
  minForks: number;
  maxDaysSinceUpdate: number;
  requireDescription: boolean;
  excludeArchived: boolean;
  excludeForks: boolean;
}

export const DEFAULT_COARSE_CONFIG: CoarseFilterConfig = {
  minStars: 10,
  minForks: 2,
  maxDaysSinceUpdate: 730, // 2 years
  requireDescription: true,
  excludeArchived: true,
  excludeForks: true,
};

export interface FilterResult {
  passed: boolean;
  repo: ForgeRepo;
  reasons: string[];
}

/**
 * Stage 1: Coarse filter — eliminates repos using API metadata only.
 * No README fetch needed. Fast, cheap, reduces candidates for fine filter.
 */
export function coarseFilter(repo: ForgeRepo, config: CoarseFilterConfig = DEFAULT_COARSE_CONFIG): FilterResult {
  const reasons: string[] = [];

  if (repo.stars < config.minStars) {
    reasons.push(`stars ${repo.stars} < ${config.minStars}`);
  }

  if (repo.forks < config.minForks) {
    reasons.push(`forks ${repo.forks} < ${config.minForks}`);
  }

  if (config.requireDescription && !repo.description) {
    reasons.push('no description');
  }

  if (config.excludeArchived && repo.isArchived) {
    reasons.push('archived');
  }

  if (config.excludeForks && repo.isFork) {
    reasons.push('is a fork');
  }

  // Check staleness
  const updatedAt = new Date(repo.updatedAt);
  const daysSinceUpdate = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceUpdate > config.maxDaysSinceUpdate) {
    reasons.push(`stale: ${Math.round(daysSinceUpdate)} days since update`);
  }

  return {
    passed: reasons.length === 0,
    repo,
    reasons,
  };
}
