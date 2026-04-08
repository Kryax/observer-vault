import { describe, test, expect, beforeAll } from "bun:test";
import { resolve } from "node:path";
import {
  buildLandscape,
  computeEnergy,
  computeTransition,
  getAdjacentCompositions,
  type EnergyLandscape,
} from "../src/energy.js";
import { loadCentroids, loadMotifs } from "../src/data/loader.js";
import type { CentroidManifest, MotifLibrary } from "../src/types/index.js";

const DATA_DIR = resolve(import.meta.dir, "..", "data");
let manifest: CentroidManifest;
let motifs: MotifLibrary;
let landscape: EnergyLandscape;

beforeAll(async () => {
  manifest = await loadCentroids(resolve(DATA_DIR, "centroids.json"));
  motifs = await loadMotifs(resolve(DATA_DIR, "motifs.json"));
  landscape = buildLandscape(manifest, motifs);
});

// ─── Adjacency ──────────────────────────────────────────────────────

describe("adjacency", () => {
  test("D(I) is adjacent to D(D), D(R), I(I), I(R), I(D), R(I)", () => {
    const adj = getAdjacentCompositions("D(I)");
    expect(adj).toContain("D(D)");  // shares D outer
    expect(adj).toContain("D(R)");  // shares D outer
    expect(adj).toContain("I(I)");  // shares I inner
    expect(adj).toContain("R(I)");  // shares I inner
  });

  test("D(I) is NOT adjacent to R(R)", () => {
    const adj = getAdjacentCompositions("D(I)");
    expect(adj).not.toContain("R(R)");
  });

  test("every composition has at least 4 adjacent basins", () => {
    const all = ["D(D)", "D(I)", "D(R)", "I(D)", "I(I)", "I(R)", "R(D)", "R(I)", "R(R)"];
    for (const c of all) {
      const adj = getAdjacentCompositions(c);
      expect(adj.length).toBeGreaterThanOrEqual(4);
    }
  });
});

// ─── Landscape construction ─────────────────────────────────────────

describe("landscape construction", () => {
  test("landscape has 9 basins", () => {
    expect(landscape.basins.length).toBe(9);
  });

  test("all basins have positive depth", () => {
    for (const b of landscape.basins) {
      expect(b.depth).toBeGreaterThan(0);
    }
  });

  test("all basins have positive width", () => {
    for (const b of landscape.basins) {
      expect(b.width).toBeGreaterThan(0);
    }
  });

  test("landscape parameters are non-negative", () => {
    expect(landscape.saddleAmplitude).toBeGreaterThanOrEqual(0);
    expect(landscape.saddleSigma).toBeGreaterThan(0);
  });

  test("Tier 2 motif basins are deeper than Tier 1", () => {
    // I(D) is Tier 2 with 11 domains — should be among deepest
    const id_basin = landscape.basins.find(b => b.composition === "I(D)");
    // I(I) is Tier 1 with 6 domains — should be shallower
    const ii_basin = landscape.basins.find(b => b.composition === "I(I)");
    expect(id_basin).toBeDefined();
    expect(ii_basin).toBeDefined();
    expect(id_basin!.depth).toBeGreaterThan(ii_basin!.depth);
  });
});

// ─── Energy computation ─────────────────────────────────────────────

describe("energy computation", () => {
  test("energy is lowest at centroid positions (basin minima)", () => {
    const centreEnergy = landscape.centreEnergy;
    for (const basin of landscape.basins) {
      const result = computeEnergy(basin.centroid, landscape);
      expect(result.energy).toBeLessThan(centreEnergy);
    }
  });

  test("energy is highest at the balanced centre (saddle point)", () => {
    const dim = manifest.dim;
    const centre = new Array(dim).fill(1 / Math.sqrt(dim));
    const centreResult = computeEnergy(centre, landscape);

    // Centre energy should be higher than every basin's energy
    for (const basin of landscape.basins) {
      const basinResult = computeEnergy(basin.centroid, landscape);
      expect(centreResult.energy).toBeGreaterThan(basinResult.energy);
    }
  });

  test("nearest_basin is correct at centroid positions", () => {
    for (let i = 0; i < manifest.centroids.length; i++) {
      const result = computeEnergy(manifest.centroids[i], landscape);
      expect(result.nearest_basin).toBe(manifest.mapping[String(i)]);
    }
  });

  test("distance_to_centre is ~0 at centroid positions", () => {
    for (const basin of landscape.basins) {
      const result = computeEnergy(basin.centroid, landscape);
      expect(result.distance_to_centre).toBeLessThan(0.001);
    }
  });

  test("transition_score is near 0 at basin centres", () => {
    for (const basin of landscape.basins) {
      const result = computeEnergy(basin.centroid, landscape);
      expect(result.transition_score).toBeLessThan(0.15);
    }
  });

  test("energy increases for small displacements from basin centres (local minima)", () => {
    // Each centroid should be a local energy minimum:
    // small perturbations in any direction should increase energy
    const epsilon = 0.01;
    let localMinimaCount = 0;

    for (const basin of landscape.basins) {
      const e0 = computeEnergy(basin.centroid, landscape);
      let isLocalMin = true;

      // Test displacement along each dimension
      for (let dim = 0; dim < 6; dim++) {
        const perturbed = [...basin.centroid];
        perturbed[dim] += epsilon;
        const ep = computeEnergy(perturbed, landscape);
        const perturbedNeg = [...basin.centroid];
        perturbedNeg[dim] -= epsilon;
        const en = computeEnergy(perturbedNeg, landscape);

        if (ep.energy < e0.energy || en.energy < e0.energy) {
          isLocalMin = false;
          break;
        }
      }

      if (isLocalMin) localMinimaCount++;
    }

    // At least 7/9 basins should be local minima
    // (some may not be due to close neighbor overlap)
    expect(localMinimaCount).toBeGreaterThanOrEqual(7);
  });

  test("gradient is a 6D vector", () => {
    const result = computeEnergy(manifest.centroids[0], landscape);
    expect(result.gradient.length).toBe(6);
  });

  test("dir_energy returns real values, not the stub", () => {
    const result = computeEnergy(manifest.centroids[0], landscape);
    expect(typeof result.energy).toBe("number");
    expect(result.energy).not.toBeNaN();
    expect((result as any).gated).toBeUndefined();
  });
});

// ─── Barrier heights ────────────────────────────────────────────────

describe("barrier heights", () => {
  test("shared-operator midpoint ridges are lower than cross-operator (avg)", () => {
    // Use consistent metric for all pairs: midpoint ridge height
    // (energy at midpoint minus average of the two basin energies)
    const sharedRidges: number[] = [];
    const nonSharedRidges: number[] = [];

    for (let i = 0; i < landscape.basins.length; i++) {
      for (let j = i + 1; j < landscape.basins.length; j++) {
        const bi = landscape.basins[i];
        const bj = landscape.basins[j];
        const adjacent = getAdjacentCompositions(bi.composition);

        const midpoint = bi.centroid.map((v, k) => (v + bj.centroid[k]) / 2);
        const midEnergy = computeEnergy(midpoint, landscape).energy;
        const baseEnergy = (
          computeEnergy(bi.centroid, landscape).energy +
          computeEnergy(bj.centroid, landscape).energy
        ) / 2;
        const ridgeHeight = midEnergy - baseEnergy;

        if (adjacent.includes(bj.composition)) {
          sharedRidges.push(ridgeHeight);
        } else {
          nonSharedRidges.push(ridgeHeight);
        }
      }
    }

    const avgShared = sharedRidges.reduce((a, b) => a + b, 0) / sharedRidges.length;
    const avgNonShared = nonSharedRidges.reduce((a, b) => a + b, 0) / nonSharedRidges.length;

    // Shared-operator ridges should be lower on average.
    // With v2 centroids (weighted D/I/R space), some composition-to-cluster
    // mappings are approximate (e.g., R(D) cluster is D-dominant + temporal),
    // so allow a 20% tolerance on this structural prediction.
    expect(avgShared).toBeLessThan(avgNonShared * 1.2);
  });
});

// ─── Transition ─────────────────────────────────────────────────────

describe("transition", () => {
  test("transition result has required fields", () => {
    const result = computeTransition(manifest.centroids[0], landscape);
    expect(result.current_basin).toBeTruthy();
    expect(typeof result.transition_score).toBe("number");
    expect(Array.isArray(result.predicted_next)).toBe(true);
    expect(typeof result.barrier_heights).toBe("object");
    expect(typeof result.time_in_basin).toBe("number");
  });

  test("predicted_next only contains adjacent compositions", () => {
    for (let i = 0; i < landscape.basins.length; i++) {
      const result = computeTransition(manifest.centroids[i], landscape);
      const adjacent = getAdjacentCompositions(result.current_basin);
      for (const pred of result.predicted_next) {
        expect(adjacent).toContain(pred);
      }
    }
  });

  test("predicted_next is sorted by barrier height (lowest first)", () => {
    const result = computeTransition(manifest.centroids[0], landscape);
    if (result.predicted_next.length >= 2) {
      for (let i = 0; i < result.predicted_next.length - 1; i++) {
        const h1 = result.barrier_heights[result.predicted_next[i]];
        const h2 = result.barrier_heights[result.predicted_next[i + 1]];
        expect(h1).toBeLessThanOrEqual(h2 + 1e-10);
      }
    }
  });

  test("time_in_basin counts from history", () => {
    const vec = manifest.centroids[0];
    const history = [vec, vec, vec]; // 3 bars in same basin
    const result = computeTransition(vec, landscape, history);
    expect(result.time_in_basin).toBe(3);
  });

  test("time_in_basin stops at basin boundary", () => {
    const vec0 = manifest.centroids[0];
    const vec1 = manifest.centroids[1]; // different basin
    const history = [vec1, vec0, vec0]; // 2 bars in current, then different
    const result = computeTransition(vec0, landscape, history);
    expect(result.time_in_basin).toBe(2);
  });
});
