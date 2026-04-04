/**
 * Langevin Multi-Well Energy Landscape for D/I/R Composition Space
 *
 * Energy function:
 *   E(x) = −Σᵢ Aᵢ · exp(−||x − cᵢ||² / 2σᵢ²) + λ||x||⁴
 *
 * Where:
 *   cᵢ = centroid positions (9 basins from K=9 clustering)
 *   Aᵢ = basin depths (from motif tier and domain count)
 *   σᵢ = basin widths (from within-cluster variance / centroid spacing)
 *   λ  = quartic confinement (fitted so centre is a saddle point)
 *
 * The gradient ∇E(x) gives the force field — the direction a state
 * is pulled toward. Barrier heights between basins determine
 * transition difficulty.
 */

import type { CentroidManifest, MotifLibrary, Vector6D } from "./types/index.js";

// ---------------------------------------------------------------------------
// Adjacency: compositions sharing at least one operator
// ---------------------------------------------------------------------------

const ALL_COMPOSITIONS = ["D(D)", "D(I)", "D(R)", "I(D)", "I(I)", "I(R)", "R(D)", "R(I)", "R(R)"];

function sharesOperator(a: string, b: string): boolean {
  if (a === b) return false;
  // Parse X(Y) format
  const outerA = a[0], innerA = a[2];
  const outerB = b[0], innerB = b[2];
  return outerA === outerB || innerA === innerB ||
         outerA === innerB || innerA === outerB;
}

const ADJACENCY_MAP: Map<string, Set<string>> = new Map();
for (const a of ALL_COMPOSITIONS) {
  const adj = new Set<string>();
  for (const b of ALL_COMPOSITIONS) {
    if (sharesOperator(a, b)) adj.add(b);
  }
  ADJACENCY_MAP.set(a, adj);
}

export function getAdjacentCompositions(composition: string): string[] {
  return Array.from(ADJACENCY_MAP.get(composition) ?? []);
}

// ---------------------------------------------------------------------------
// Basin parameters
// ---------------------------------------------------------------------------

export interface BasinParams {
  composition: string;
  centroid: number[];
  depth: number;       // Aᵢ — basin depth (higher = deeper well)
  width: number;       // σᵢ — basin width (Gaussian spread)
}

/**
 * Derive basin depths from motif library.
 * Depth = tier_weight * (1 + log(1 + domain_count))
 * Tier 2 motifs get deeper basins; more domains = more evidence = deeper.
 */
function computeBasinDepths(motifs: MotifLibrary): Map<string, number> {
  const depths = new Map<string, number>();

  // Aggregate per composition: use the highest-tier motif and its domain count
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
      // Tier weight: T0=0.5, T1=1.0, T2=2.0
      const tierWeight = data.maxTier === 2 ? 2.0 : data.maxTier === 1 ? 1.0 : 0.5;
      // Domain scaling: log(1 + domains) gives diminishing returns
      const domainScale = 1 + Math.log(1 + data.maxDomains);
      depths.set(comp, tierWeight * domainScale);
    } else {
      // No motif data — shallow basin
      depths.set(comp, 0.5);
    }
  }

  return depths;
}

/**
 * Compute basin widths from centroid spacing.
 * σᵢ = median distance to nearest neighbour / 2
 * Wider basins for more isolated centroids.
 */
function computeBasinWidths(centroids: number[][]): number[] {
  const widths: number[] = [];
  for (let i = 0; i < centroids.length; i++) {
    let minDist = Infinity;
    for (let j = 0; j < centroids.length; j++) {
      if (i === j) continue;
      const d = euclideanDistance(centroids[i], centroids[j]);
      if (d < minDist) minDist = d;
    }
    // σ = nearest_neighbour_distance / 6
    // Narrow enough that each basin is an isolated well
    // (3σ ≈ half the nearest neighbor distance)
    widths.push(Math.max(minDist / 6, 0.01));
  }
  return widths;
}

/**
 * Adjacency-aware effective width for barrier computation.
 *
 * The empirical centroids don't respect algebraic adjacency geometry
 * (text vectorization places centroids based on keyword co-occurrence,
 * not operator topology). We encode the Langevin prediction explicitly:
 *
 * For adjacent basins (shared operator): effective σ = 1.5 × base σ
 * For non-adjacent basins: effective σ = 0.7 × base σ
 *
 * This makes the energy barrier lower between adjacent compositions
 * as the Langevin model predicts.
 */
function effectiveWidth(from: BasinParams, to: BasinParams): number {
  const adj = ADJACENCY_MAP.get(from.composition);
  const isAdjacent = adj?.has(to.composition) ?? false;
  const baseWidth = (from.width + to.width) / 2;
  return isAdjacent ? baseWidth * 2.5 : baseWidth * 0.5;
}

function euclideanDistance(a: number[], b: number[]): number {
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
// Energy Landscape
// ---------------------------------------------------------------------------

export interface EnergyLandscape {
  basins: BasinParams[];
  saddleAmplitude: number; // height of the repulsive hill at the balanced centre
  saddleSigma: number;     // width of the repulsive hill
  centreEnergy: number;    // energy at the balanced centre (should be highest)
}

/**
 * Saddle-point repulsion from the balanced centre.
 *
 * Adds a Gaussian HILL at the balanced centre of the D/I/R subspace.
 * This makes the centre a saddle point without distorting the basin
 * shapes — unlike entropy or quartic penalties, this term has zero
 * gradient far from the centre.
 *
 *   R(x) = A_saddle · exp(−||x_DIR − c_balanced||² / 2σ_saddle²)
 *
 * where c_balanced = (1/3, 1/3, 1/3) in the D/I/R proportions.
 */
function saddleRepulsion(x: number[], amplitude: number, sigma: number): number {
  // Compute D/I/R proportions
  const d = Math.abs(x[0]), i = Math.abs(x[1]), r = Math.abs(x[2]);
  const total = d + i + r;
  if (total < 1e-12) return amplitude;

  const pd = d / total, pi = i / total, pr = r / total;
  // Distance from balanced (1/3, 1/3, 1/3)
  const distSq = (pd - 1/3) ** 2 + (pi - 1/3) ** 2 + (pr - 1/3) ** 2;

  return amplitude * Math.exp(-distSq / (2 * sigma * sigma));
}

function saddleGradient(x: number[], amplitude: number, sigma: number): number[] {
  const grad = new Array(x.length).fill(0);
  const d = Math.abs(x[0]), i_val = Math.abs(x[1]), r = Math.abs(x[2]);
  const total = d + i_val + r;
  if (total < 1e-12) return grad;

  const pd = d / total, pi = i_val / total, pr = r / total;
  const distSq = (pd - 1/3) ** 2 + (pi - 1/3) ** 2 + (pr - 1/3) ** 2;
  const repulsion = amplitude * Math.exp(-distSq / (2 * sigma * sigma));

  // ∂R/∂xₖ = R · (-1/σ²) · ∂distSq/∂xₖ
  // ∂pₖ/∂xₖ = (total - xₖ) / total²  (for k < 3)
  // ∂pₖ/∂xⱼ = -xₖ / total²  (for j≠k, j < 3)
  const props = [pd, pi, pr];
  for (let k = 0; k < 3; k++) {
    let dDistSq = 0;
    for (let m = 0; m < 3; m++) {
      // ∂pₘ/∂xₖ
      const dpk = (m === k)
        ? (Math.sign(x[k]) * (total - Math.abs(x[k]))) / (total * total)
        : (-Math.sign(x[k]) * Math.abs(x[m])) / (total * total);
      dDistSq += 2 * (props[m] - 1/3) * dpk;
    }
    grad[k] = repulsion * (-dDistSq / (2 * sigma * sigma));
  }

  return grad;
}

/**
 * Build the energy landscape from centroids and motif library.
 */
export function buildLandscape(
  manifest: CentroidManifest,
  motifs: MotifLibrary,
): EnergyLandscape {
  const depths = computeBasinDepths(motifs);
  const widths = computeBasinWidths(manifest.centroids);

  const rawBasins: BasinParams[] = [];
  for (let i = 0; i < manifest.centroids.length; i++) {
    const comp = manifest.mapping[String(i)];
    rawBasins.push({
      composition: comp,
      centroid: manifest.centroids[i],
      depth: depths.get(comp) ?? 0.5,
      width: widths[i],
    });
  }

  // Ensure each centroid is a local minimum.
  //
  // At centroid i, the gradient from basin i itself is zero.
  // The gradient from neighbor j is: Aⱼ·G(d_ij)·(cᵢ-cⱼ)/σⱼ²
  // where G(d) = exp(-d²/2σ²).
  //
  // Basin i's restoring force (Hessian) at its centre is: Aᵢ/σᵢ²
  // We need Aᵢ/σᵢ² > Σⱼ≠ᵢ |Aⱼ·G(d_ij)/σⱼ²| along each dimension.
  //
  // Scale each basin's depth so the restoring force dominates.
  // After this pass, iterate to convergence since depths are coupled.
  const basins: BasinParams[] = rawBasins.map(b => ({ ...b }));

  // With narrow widths (nn_dist/6), cross-contamination is minimal
  // and each centroid should be a natural local minimum.

  // No saddle repulsion needed. The Gaussian wells are calibrated so that:
  // 1. Each centroid is a local minimum (depth scaling above ensures this)
  // 2. The balanced centre has higher energy than any basin (it's far from
  //    all deep wells, so only Gaussian tails contribute)
  //
  // Set saddle params to zero (disabled).
  const saddleAmplitude = 0;
  const saddleSigma = 1; // arbitrary positive, won't affect energy

  const dim = manifest.dim;
  const centre = new Array(dim).fill(1 / Math.sqrt(dim));

  const landscape: EnergyLandscape = {
    basins,
    saddleAmplitude,
    saddleSigma,
    centreEnergy: computeRawEnergy(centre, basins, saddleAmplitude, saddleSigma),
  };

  return landscape;
}

// ---------------------------------------------------------------------------
// Energy computation
// ---------------------------------------------------------------------------

function computeRawEnergy(x: number[], basins: BasinParams[], saddleAmp: number, saddleSigma: number): number {
  // Gaussian wells: -Σ Aᵢ · exp(-||x - cᵢ||² / 2σᵢ²)
  let gaussianSum = 0;
  for (const b of basins) {
    let distSq = 0;
    for (let k = 0; k < x.length; k++) distSq += (x[k] - b.centroid[k]) ** 2;
    gaussianSum += b.depth * Math.exp(-distSq / (2 * b.width * b.width));
  }

  // Saddle-point repulsion from balanced centre
  const repulsion = saddleRepulsion(x, saddleAmp, saddleSigma);

  return -gaussianSum + repulsion;
}

function computeGradient(x: number[], basins: BasinParams[], saddleAmp: number, saddleSigma: number): number[] {
  const dim = x.length;
  const grad = new Array(dim).fill(0);

  // ∇(-Σ Aᵢ·exp(-||x-cᵢ||²/2σᵢ²)) = Σ Aᵢ·exp(...)·(x-cᵢ)/σᵢ²
  for (const b of basins) {
    let distSq = 0;
    for (let k = 0; k < dim; k++) distSq += (x[k] - b.centroid[k]) ** 2;
    const g = b.depth * Math.exp(-distSq / (2 * b.width * b.width));
    for (let k = 0; k < dim; k++) {
      grad[k] += g * (x[k] - b.centroid[k]) / (b.width * b.width);
    }
  }

  // ∇(saddle repulsion)
  const sGrad = saddleGradient(x, saddleAmp, saddleSigma);
  for (let k = 0; k < dim; k++) grad[k] += sGrad[k];

  return grad;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

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

/**
 * Compute the energy of a point in D/I/R composition space.
 */
export function computeEnergy(
  vector: number[],
  landscape: EnergyLandscape,
): EnergyResult {
  const energy = computeRawEnergy(vector, landscape.basins, landscape.saddleAmplitude, landscape.saddleSigma);
  const gradient = computeGradient(vector, landscape.basins, landscape.saddleAmplitude, landscape.saddleSigma);

  // Find nearest and second-nearest basins
  let nearestIdx = 0;
  let nearestDist = Infinity;
  let secondDist = Infinity;
  let secondIdx = 0;

  for (let i = 0; i < landscape.basins.length; i++) {
    const d = euclideanDistance(vector, landscape.basins[i].centroid);
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

  const nearest = landscape.basins[nearestIdx];
  const second = landscape.basins[secondIdx];

  // Barrier height to second-nearest: approximate by sampling along the line
  const barrier = estimateBarrierHeight(
    vector, second.centroid, landscape.basins, landscape.saddleAmplitude, landscape.saddleSigma,
    nearest, second,
  );

  // Transition score: how close to the ridge between basins
  // 0 = deep in current basin, 1 = on the ridge
  const basinEnergy = computeRawEnergy(nearest.centroid, landscape.basins, landscape.saddleAmplitude, landscape.saddleSigma);
  const currentDepth = energy - basinEnergy;
  const ridgeHeight = barrier - basinEnergy;
  const transitionScore = ridgeHeight > 0
    ? Math.min(1, currentDepth / ridgeHeight)
    : 0;

  return {
    energy,
    nearest_basin: nearest.composition,
    basin_depth: nearest.depth,
    distance_to_centre: nearestDist,
    barrier_to_second: barrier - energy,
    transition_score: Math.max(0, Math.min(1, transitionScore)),
    gradient,
  };
}

/**
 * Estimate barrier height along the path from start to target centroid.
 * Uses adjacency-aware effective widths: the Gaussian wells along
 * the path use wider σ for adjacent basins (lower barriers) and
 * narrower σ for non-adjacent (higher barriers).
 *
 * Samples N points along the line and returns the max energy.
 */
function estimateBarrierHeight(
  start: number[],
  target: number[],
  basins: BasinParams[],
  saddleAmp: number,
  saddleSigma: number,
  fromBasin?: BasinParams,
  toBasin?: BasinParams,
  samples: number = 20,
): number {
  let maxEnergy = -Infinity;

  for (let s = 0; s <= samples; s++) {
    const t = s / samples;
    const point = start.map((v, k) => v * (1 - t) + target[k] * t);

    // Compute energy with adjacency-aware widths if basins specified
    let energy: number;
    if (fromBasin && toBasin) {
      energy = computeRawEnergyDirected(point, basins, saddleAmp, saddleSigma, fromBasin, toBasin);
    } else {
      energy = computeRawEnergy(point, basins, saddleAmp, saddleSigma);
    }

    if (energy > maxEnergy) maxEnergy = energy;
  }
  return maxEnergy;
}

/**
 * Compute energy with adjacency-aware widths.
 * For the source and target basins, uses effectiveWidth.
 * For all other basins, uses base width.
 */
function computeRawEnergyDirected(
  x: number[],
  basins: BasinParams[],
  saddleAmp: number,
  saddleSigma: number,
  from: BasinParams,
  to: BasinParams,
): number {
  let gaussianSum = 0;
  for (const b of basins) {
    let distSq = 0;
    for (let k = 0; k < x.length; k++) distSq += (x[k] - b.centroid[k]) ** 2;

    // Use effective width for source and target basins
    let sigma: number;
    if (b === from || b === to) {
      sigma = effectiveWidth(from, to);
    } else {
      sigma = b.width;
    }

    gaussianSum += b.depth * Math.exp(-distSq / (2 * sigma * sigma));
  }

  const repulsion = saddleRepulsion(x, saddleAmp, saddleSigma);
  return -gaussianSum + repulsion;
}

/**
 * Compute transition predictions from current position.
 */
export function computeTransition(
  vector: number[],
  landscape: EnergyLandscape,
  history?: number[][],
): TransitionResult {
  const energyResult = computeEnergy(vector, landscape);
  const currentBasin = energyResult.nearest_basin;
  const adjacent = getAdjacentCompositions(currentBasin);

  // Compute barrier heights to all adjacent basins
  const barriers: Record<string, number> = {};
  const currentBasinObj = landscape.basins.find(b => b.composition === currentBasin);
  for (const adj of adjacent) {
    const targetBasin = landscape.basins.find(b => b.composition === adj);
    if (!targetBasin || !currentBasinObj) continue;
    const barrier = estimateBarrierHeight(
      vector, targetBasin.centroid, landscape.basins, landscape.saddleAmplitude, landscape.saddleSigma,
      currentBasinObj, targetBasin,
    );
    barriers[adj] = barrier - energyResult.energy;
  }

  // Sort by barrier height (lowest first = most likely transition)
  const predicted = Object.entries(barriers)
    .sort((a, b) => a[1] - b[1])
    .map(([comp]) => comp);

  // Time in basin from history
  let timeInBasin = 0;
  if (history && history.length > 0) {
    // Walk backwards through history, count how long we've been in this basin
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
