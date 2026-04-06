/**
 * Domain-Agnostic Multi-Well Energy Landscape
 *
 * Pure mathematics — no domain assumptions. Takes centroids as INPUT.
 *
 * Energy function:
 *   E(x) = −Σᵢ Aᵢ · exp(−||x − cᵢ||² / 2σᵢ²)
 *
 * Where:
 *   cᵢ = centroid positions (any number of basins)
 *   Aᵢ = basin depths (caller-provided)
 *   σᵢ = basin widths (auto-computed from centroid spacing or caller-provided)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BasinConfig {
  centroid: number[];
  depth: number;
  width: number;
  label: string;
}

export interface LandscapeConfig {
  basins: BasinConfig[];
  adjacency?: Map<string, Set<string>>;
}

export interface EnergyLandscape {
  basins: BasinConfig[];
  adjacency: Map<string, Set<string>>;
  centreEnergy: number;
}

export interface EnergyResult {
  energy: number;
  nearest_basin: string;
  basin_depth: number;
  distance_to_centre: number;
  barrier_to_second: number;
  transition_score: number;
  gradient: number[];
}

export interface TransitionResult {
  current_basin: string;
  transition_score: number;
  predicted_next: string[];
  barrier_heights: Record<string, number>;
  time_in_basin: number;
}

// ---------------------------------------------------------------------------
// Adjacency — D/I/R specific (shared operator rule)
// ---------------------------------------------------------------------------

const ALL_COMPOSITIONS = ["D(D)", "D(I)", "D(R)", "I(D)", "I(I)", "I(R)", "R(D)", "R(I)", "R(R)"];

function sharesOperator(a: string, b: string): boolean {
  if (a === b) return false;
  const outerA = a[0], innerA = a[2];
  const outerB = b[0], innerB = b[2];
  return outerA === outerB || innerA === innerB ||
         outerA === innerB || innerA === outerB;
}

export const DIR_ADJACENCY: Map<string, Set<string>> = new Map();
for (const a of ALL_COMPOSITIONS) {
  const adj = new Set<string>();
  for (const b of ALL_COMPOSITIONS) {
    if (sharesOperator(a, b)) adj.add(b);
  }
  DIR_ADJACENCY.set(a, adj);
}

// ---------------------------------------------------------------------------
// Geometry utilities
// ---------------------------------------------------------------------------

export function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

function vectorNorm(v: number[]): number {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  return Math.sqrt(sum);
}

// ---------------------------------------------------------------------------
// Basin width computation
// ---------------------------------------------------------------------------

/**
 * Compute basin widths.
 *
 * If data/basin-widths.json exists (empirical σ from shard data), use those
 * as relative widths, normalized so their median matches the nn/6 geometric
 * scale. This preserves which basins are tight vs loose from the data while
 * keeping wells properly separated.
 *
 * Otherwise fall back to nearest_neighbour_distance / 6 heuristic.
 */
export function computeBasinWidths(
  centroids: number[][],
  mapping?: Record<string, string>,
): number[] {
  // Compute nn/6 heuristic widths (always needed as fallback or scale anchor)
  const heuristicWidths: number[] = [];
  for (let i = 0; i < centroids.length; i++) {
    let minDist = Infinity;
    for (let j = 0; j < centroids.length; j++) {
      if (i === j) continue;
      const d = euclideanDistance(centroids[i], centroids[j]);
      if (d < minDist) minDist = d;
    }
    heuristicWidths.push(Math.max(minDist / 6, 0.01));
  }

  // Try empirical widths
  if (mapping) {
    try {
      const jsonPath = import.meta.dir + "/../data/basin-widths.json";
      const text = require("fs").readFileSync(jsonPath, "utf-8");
      const data = JSON.parse(text) as { widths: Record<string, number> };
      if (data.widths) {
        // Collect empirical values in centroid order
        const rawEmpirical: number[] = [];
        for (let i = 0; i < centroids.length; i++) {
          const comp = mapping[String(i)];
          const empirical = comp ? data.widths[comp] : undefined;
          rawEmpirical.push(empirical ?? heuristicWidths[i]);
        }

        // Normalize: scale empirical values so their median matches heuristic median
        const sortedEmpirical = [...rawEmpirical].sort((a, b) => a - b);
        const sortedHeuristic = [...heuristicWidths].sort((a, b) => a - b);
        const mid = Math.floor(sortedEmpirical.length / 2);
        const medianEmpirical = sortedEmpirical[mid];
        const medianHeuristic = sortedHeuristic[mid];
        const scale = medianEmpirical > 0 ? medianHeuristic / medianEmpirical : 1;

        return rawEmpirical.map(w => Math.max(w * scale, 0.01));
      }
    } catch {
      // basin-widths.json not found — fall through to heuristic
    }
  }

  return heuristicWidths;
}

// ---------------------------------------------------------------------------
// Adjacency-aware effective width
// ---------------------------------------------------------------------------

function effectiveWidth(
  from: BasinConfig, to: BasinConfig,
  _adjacency: Map<string, Set<string>>,
): number {
  // No adjacency scaling — adjacency is encoded in barrier heights, not widths.
  // Using raw average of basin widths.
  return (from.width + to.width) / 2;
}

// ---------------------------------------------------------------------------
// Raw energy computation
// ---------------------------------------------------------------------------

function computeRawEnergy(x: number[], basins: BasinConfig[]): number {
  let gaussianSum = 0;
  for (const b of basins) {
    let distSq = 0;
    for (let k = 0; k < x.length; k++) distSq += (x[k] - b.centroid[k]) ** 2;
    gaussianSum += b.depth * Math.exp(-distSq / (2 * b.width * b.width));
  }
  return -gaussianSum;
}

function computeRawEnergyDirected(
  x: number[], basins: BasinConfig[],
  from: BasinConfig, to: BasinConfig,
  adjacency: Map<string, Set<string>>,
): number {
  let gaussianSum = 0;
  const effW = effectiveWidth(from, to, adjacency);
  for (const b of basins) {
    let distSq = 0;
    for (let k = 0; k < x.length; k++) distSq += (x[k] - b.centroid[k]) ** 2;
    const sigma = (b === from || b === to) ? effW : b.width;
    gaussianSum += b.depth * Math.exp(-distSq / (2 * sigma * sigma));
  }
  return -gaussianSum;
}

function computeGradient(x: number[], basins: BasinConfig[]): number[] {
  const dim = x.length;
  const grad = new Array(dim).fill(0);
  for (const b of basins) {
    let distSq = 0;
    for (let k = 0; k < dim; k++) distSq += (x[k] - b.centroid[k]) ** 2;
    const g = b.depth * Math.exp(-distSq / (2 * b.width * b.width));
    for (let k = 0; k < dim; k++) {
      grad[k] += g * (x[k] - b.centroid[k]) / (b.width * b.width);
    }
  }
  return grad;
}

// ---------------------------------------------------------------------------
// Barrier estimation
// ---------------------------------------------------------------------------

function estimateBarrierHeight(
  start: number[], target: number[],
  basins: BasinConfig[],
  adjacency: Map<string, Set<string>>,
  fromBasin?: BasinConfig,
  toBasin?: BasinConfig,
  samples: number = 20,
): number {
  let maxEnergy = -Infinity;
  for (let s = 0; s <= samples; s++) {
    const t = s / samples;
    const point = start.map((v, k) => v * (1 - t) + target[k] * t);
    let energy: number;
    if (fromBasin && toBasin) {
      energy = computeRawEnergyDirected(point, basins, fromBasin, toBasin, adjacency);
    } else {
      energy = computeRawEnergy(point, basins);
    }
    if (energy > maxEnergy) maxEnergy = energy;
  }
  return maxEnergy;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build an energy landscape from any set of basins.
 */
export function buildLandscape(config: LandscapeConfig): EnergyLandscape {
  const adjacency = config.adjacency ?? new Map<string, Set<string>>();
  const dim = config.basins[0]?.centroid.length ?? 0;
  const centre = new Array(dim).fill(dim > 0 ? 1 / Math.sqrt(dim) : 0);
  const centreEnergy = computeRawEnergy(centre, config.basins);

  return {
    basins: config.basins,
    adjacency,
    centreEnergy,
  };
}

/**
 * Compute the energy of a point in the landscape.
 */
export function computeEnergy(
  vector: number[],
  landscape: EnergyLandscape,
): EnergyResult {
  const { basins, adjacency } = landscape;
  const energy = computeRawEnergy(vector, basins);
  const gradient = computeGradient(vector, basins);

  // Find nearest and second-nearest basins
  let nearestIdx = 0;
  let nearestDist = Infinity;
  let secondDist = Infinity;
  let secondIdx = 0;

  for (let i = 0; i < basins.length; i++) {
    const d = euclideanDistance(vector, basins[i].centroid);
    if (d < nearestDist) {
      secondDist = nearestDist;
      secondIdx = nearestIdx;
      nearestDist = d;
      nearestIdx = i;
    } else if (d < secondDist) {
      secondDist = d;
      secondIdx = i;
    }
  }

  const nearest = basins[nearestIdx];
  const second = basins[secondIdx];

  const barrier = estimateBarrierHeight(
    vector, second.centroid, basins, adjacency, nearest, second,
  );

  const basinEnergy = computeRawEnergy(nearest.centroid, basins);
  const currentDepth = energy - basinEnergy;
  const ridgeHeight = barrier - basinEnergy;
  const transitionScore = ridgeHeight > 0
    ? Math.min(1, currentDepth / ridgeHeight)
    : 0;

  return {
    energy,
    nearest_basin: nearest.label,
    basin_depth: nearest.depth,
    distance_to_centre: nearestDist,
    barrier_to_second: barrier - energy,
    transition_score: Math.max(0, Math.min(1, transitionScore)),
    gradient,
  };
}

/**
 * Compute transition predictions from current position.
 */
export function computeTransition(
  vector: number[],
  landscape: EnergyLandscape,
  history?: number[][],
): TransitionResult {
  const { basins, adjacency } = landscape;
  const energyResult = computeEnergy(vector, landscape);
  const currentBasin = energyResult.nearest_basin;
  const adjacent = getAdjacentBasins(currentBasin, adjacency);

  const barriers: Record<string, number> = {};
  const currentBasinObj = basins.find(b => b.label === currentBasin);
  for (const adj of adjacent) {
    const targetBasin = basins.find(b => b.label === adj);
    if (!targetBasin || !currentBasinObj) continue;
    const barrier = estimateBarrierHeight(
      vector, targetBasin.centroid, basins, adjacency,
      currentBasinObj, targetBasin,
    );
    barriers[adj] = barrier - energyResult.energy;
  }

  const predicted = Object.entries(barriers)
    .sort((a, b) => a[1] - b[1])
    .map(([comp]) => comp);

  let timeInBasin = 0;
  if (history && history.length > 0) {
    for (let i = history.length - 1; i >= 0; i--) {
      const histEnergy = computeEnergy(history[i], landscape);
      if (histEnergy.nearest_basin === currentBasin) {
        timeInBasin++;
      } else {
        break;
      }
    }
  }

  return {
    current_basin: currentBasin,
    transition_score: energyResult.transition_score,
    predicted_next: predicted,
    barrier_heights: barriers,
    time_in_basin: timeInBasin,
  };
}

/**
 * Get adjacent basins from an adjacency map.
 */
export function getAdjacentBasins(label: string, adjacency: Map<string, Set<string>>): Set<string> {
  return adjacency.get(label) ?? new Set<string>();
}
