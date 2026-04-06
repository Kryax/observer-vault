/**
 * D/I/R Domain Binding for Energy Landscape
 *
 * Wraps energy-core.ts with D/I/R-specific logic:
 * - Motif-derived basin depths
 * - Text centroids from CentroidManifest
 * - D/I/R algebraic adjacency
 *
 * The public API is unchanged — all existing consumers continue to work.
 */

import type { CentroidManifest, MotifLibrary } from "./types/index.js";
import {
  buildLandscape as coreBuildLandscape,
  computeEnergy as coreComputeEnergy,
  computeTransition as coreComputeTransition,
  getAdjacentBasins,
  computeBasinWidths,
  DIR_ADJACENCY,
  type BasinConfig,
  type EnergyLandscape,
  type EnergyResult,
  type TransitionResult,
} from "./energy-core.js";

// Re-export core types under the original names
export type { EnergyResult, TransitionResult };

// Re-export the landscape type with backward-compatible fields
export interface BasinParams {
  composition: string;
  centroid: number[];
  depth: number;
  width: number;
}

export interface DIRLandscape {
  basins: BasinParams[];
  saddleAmplitude: number;
  saddleSigma: number;
  centreEnergy: number;
  /** Internal core landscape for computation */
  _core: EnergyLandscape;
}

// Keep the old name as an alias for backward compatibility in the type system
export type { DIRLandscape as EnergyLandscape };

const ALL_COMPOSITIONS = ["D(D)", "D(I)", "D(R)", "I(D)", "I(I)", "I(R)", "R(D)", "R(I)", "R(R)"];

// ---------------------------------------------------------------------------
// Adjacency (delegates to core)
// ---------------------------------------------------------------------------

export function getAdjacentCompositions(composition: string): string[] {
  return Array.from(getAdjacentBasins(composition, DIR_ADJACENCY));
}

// ---------------------------------------------------------------------------
// Motif-derived basin depths
// ---------------------------------------------------------------------------

function computeBasinDepths(motifs: MotifLibrary): Map<string, number> {
  const depths = new Map<string, number>();
  const compData = new Map<string, { maxTier: number; maxDomains: number }>();

  for (const m of motifs.motifs) {
    const c = m.composition;
    if (!c || !ALL_COMPOSITIONS.includes(c)) continue;
    const existing = compData.get(c);
    if (!existing || m.tier > existing.maxTier ||
        (m.tier === existing.maxTier && m.domains.length > existing.maxDomains)) {
      compData.set(c, { maxTier: m.tier, maxDomains: m.domains.length });
    }
  }

  for (const comp of ALL_COMPOSITIONS) {
    const data = compData.get(comp);
    if (data) {
      const tierWeight = data.maxTier === 2 ? 2.0 : data.maxTier === 1 ? 1.0 : 0.5;
      const domainScale = 1 + Math.log(1 + data.maxDomains);
      depths.set(comp, tierWeight * domainScale);
    } else {
      depths.set(comp, 0.5);
    }
  }

  return depths;
}

// ---------------------------------------------------------------------------
// Build landscape (D/I/R domain)
// ---------------------------------------------------------------------------

export function buildLandscape(
  manifest: CentroidManifest,
  motifs: MotifLibrary,
): DIRLandscape {
  const depths = computeBasinDepths(motifs);
  const widths = computeBasinWidths(manifest.centroids, manifest.mapping);

  const basinConfigs: BasinConfig[] = [];
  const basinParams: BasinParams[] = [];

  for (let i = 0; i < manifest.centroids.length; i++) {
    const comp = manifest.mapping[String(i)];
    const depth = depths.get(comp) ?? 0.5;
    const width = widths[i];

    basinConfigs.push({
      centroid: manifest.centroids[i],
      depth,
      width,
      label: comp,
    });

    basinParams.push({
      composition: comp,
      centroid: manifest.centroids[i],
      depth,
      width,
    });
  }

  const core = coreBuildLandscape({
    basins: basinConfigs,
    adjacency: DIR_ADJACENCY,
  });

  return {
    basins: basinParams,
    saddleAmplitude: 0,
    saddleSigma: 1,
    centreEnergy: core.centreEnergy,
    _core: core,
  };
}

// ---------------------------------------------------------------------------
// Compute energy (delegates to core)
// ---------------------------------------------------------------------------

export function computeEnergy(
  vector: number[],
  landscape: DIRLandscape,
): EnergyResult {
  return coreComputeEnergy(vector, landscape._core);
}

// ---------------------------------------------------------------------------
// Compute transition (delegates to core)
// ---------------------------------------------------------------------------

export function computeTransition(
  vector: number[],
  landscape: DIRLandscape,
  history?: number[][],
): TransitionResult {
  return coreComputeTransition(vector, landscape._core, history);
}
