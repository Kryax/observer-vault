/**
 * Ecosyste.ms data merger -- supplements Solution Records with ecosystem metadata.
 *
 * CRITICAL INVARIANT: Forge-sourced fields are NEVER overwritten.
 * Ecosyste.ms data only ADDS new dimensions:
 *   - downloads      -> added to validation.evidence array
 *   - dependents     -> added to validation.evidence array
 *   - keywords       -> merged with existing (deduped)
 *   - ecosystem info -> added to extensions
 *
 * The trust vector is NOT modified by ecosyste.ms data.
 * Trust comes from forge signals only.
 */

import type { EcosystemsPackage } from './client';
import type { SolutionRecord, ValidationEvidence } from '../types/solution-record';

// ---------------------------------------------------------------------------
// Enrichment type
// ---------------------------------------------------------------------------

/**
 * Supplemental metadata from ecosyste.ms that can enrich a Solution Record.
 * These fields ADD TO the record -- they never overwrite forge-sourced data.
 */
export interface EcosystemsEnrichment {
  downloads?: number;
  dependentPackages?: number;
  dependentRepos?: number;
  latestVersion?: string;
  ecosystem?: string;
  maintainersCount?: number;
  additionalKeywords?: string[];
}

// ---------------------------------------------------------------------------
// extractEnrichment
// ---------------------------------------------------------------------------

/**
 * Extract enrichment data from an ecosyste.ms package response.
 */
export function extractEnrichment(pkg: EcosystemsPackage): EcosystemsEnrichment {
  return {
    downloads: pkg.downloads,
    dependentPackages: pkg.dependent_packages_count,
    dependentRepos: pkg.dependent_repos_count,
    latestVersion: pkg.latest_stable_release_number ?? pkg.latest_release_number,
    ecosystem: pkg.ecosystem,
    maintainersCount: pkg.maintainers_count,
    additionalKeywords: pkg.keywords && pkg.keywords.length > 0 ? pkg.keywords : undefined,
  };
}

// ---------------------------------------------------------------------------
// mergeEnrichment
// ---------------------------------------------------------------------------

/**
 * Merge ecosyste.ms enrichment into a Solution Record.
 *
 * Returns a NEW SolutionRecord -- the original is never mutated.
 *
 * RULES:
 * 1. Forge-sourced fields are NEVER overwritten.
 * 2. downloads -> added to validation.evidence
 * 3. dependentPackages -> added to validation.evidence
 * 4. additionalKeywords -> merged with existing keywords (deduped)
 * 5. ecosystem info -> added to extensions.ecosystems
 * 6. Trust vector is NOT modified.
 */
export function mergeEnrichment(
  record: SolutionRecord,
  enrichment: EcosystemsEnrichment,
): SolutionRecord {
  // Deep-clone enough to avoid mutating the original
  const merged: SolutionRecord = {
    ...record,
    meta: { ...record.meta },
    validation: {
      ...record.validation,
      evidence: [...record.validation.evidence],
    },
    trust: {
      ...record.trust,
      vector: { ...record.trust.vector },
    },
    extensions: { ...(record.extensions ?? {}) },
  };

  // ------------------------------------------------------------------
  // 1. Add download evidence
  // ------------------------------------------------------------------
  if (enrichment.downloads !== undefined && enrichment.downloads > 0) {
    const dlEvidence: ValidationEvidence = {
      type: 'ecosystems:downloads',
      description: `${enrichment.downloads} total downloads (ecosyste.ms)`,
      uri: 'https://packages.ecosyste.ms',
    };
    merged.validation.evidence.push(dlEvidence);
  }

  // ------------------------------------------------------------------
  // 2. Add dependent-packages evidence
  // ------------------------------------------------------------------
  if (enrichment.dependentPackages !== undefined && enrichment.dependentPackages > 0) {
    const depEvidence: ValidationEvidence = {
      type: 'ecosystems:dependent-packages',
      description: `${enrichment.dependentPackages} dependent packages (ecosyste.ms)`,
      uri: 'https://packages.ecosyste.ms',
    };
    merged.validation.evidence.push(depEvidence);
  }

  // ------------------------------------------------------------------
  // 3. Add dependent-repos evidence
  // ------------------------------------------------------------------
  if (enrichment.dependentRepos !== undefined && enrichment.dependentRepos > 0) {
    const repoEvidence: ValidationEvidence = {
      type: 'ecosystems:dependent-repos',
      description: `${enrichment.dependentRepos} dependent repositories (ecosyste.ms)`,
      uri: 'https://packages.ecosyste.ms',
    };
    merged.validation.evidence.push(repoEvidence);
  }

  // ------------------------------------------------------------------
  // 4. Merge keywords (deduped, original keywords come first)
  // ------------------------------------------------------------------
  if (enrichment.additionalKeywords && enrichment.additionalKeywords.length > 0) {
    const existing = new Set(merged.meta.keywords ?? []);
    const combined = [...(merged.meta.keywords ?? [])];
    for (const kw of enrichment.additionalKeywords) {
      if (!existing.has(kw)) {
        combined.push(kw);
        existing.add(kw);
      }
    }
    merged.meta.keywords = combined;
  }

  // ------------------------------------------------------------------
  // 5. Add ecosystem info to extensions
  // ------------------------------------------------------------------
  const hasEcoData =
    enrichment.ecosystem ||
    enrichment.latestVersion ||
    enrichment.maintainersCount !== undefined;

  if (hasEcoData) {
    const ecoExtension: Record<string, unknown> = {};
    if (enrichment.ecosystem) ecoExtension.ecosystem = enrichment.ecosystem;
    if (enrichment.latestVersion) ecoExtension.latestVersion = enrichment.latestVersion;
    if (enrichment.maintainersCount !== undefined)
      ecoExtension.maintainersCount = enrichment.maintainersCount;
    if (enrichment.downloads !== undefined) ecoExtension.downloads = enrichment.downloads;
    if (enrichment.dependentPackages !== undefined)
      ecoExtension.dependentPackages = enrichment.dependentPackages;
    if (enrichment.dependentRepos !== undefined)
      ecoExtension.dependentRepos = enrichment.dependentRepos;

    merged.extensions!['ecosystems'] = ecoExtension;
  }

  // ------------------------------------------------------------------
  // Trust vector is NEVER modified. That invariant is structural --
  // we cloned it above and never touch it.
  // ------------------------------------------------------------------

  return merged;
}
