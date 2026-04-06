import { describe, test, expect, beforeAll } from "bun:test";
import { resolve } from "node:path";
import {
  buildLandscape,
  computeEnergy,
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

// ─── Barrier positivity ────────────────────────────────────────────

describe("empirical sigma: barrier positivity", () => {
  test("all 9 basins have positive barrier_to_second at centroids", () => {
    for (const basin of landscape.basins) {
      const result = computeEnergy(basin.centroid, landscape);
      expect(result.barrier_to_second).toBeGreaterThan(0);
    }
  });
});

// ─── Contamination limits ──────────────────────────────────────────

function computeContamination(
  basinComp: string,
  landscape: EnergyLandscape,
): number {
  const basin = landscape.basins.find(b => b.composition === basinComp)!;
  let ownContrib = 0;
  let tailContrib = 0;

  for (const other of landscape.basins) {
    let distSq = 0;
    for (let k = 0; k < basin.centroid.length; k++) {
      distSq += (basin.centroid[k] - other.centroid[k]) ** 2;
    }
    const contrib = other.depth * Math.exp(-distSq / (2 * other.width * other.width));
    if (other.composition === basinComp) {
      ownContrib = contrib;
    } else {
      tailContrib += contrib;
    }
  }

  return ownContrib > 0 ? tailContrib / ownContrib : Infinity;
}

describe("empirical sigma: contamination", () => {
  test("R(D) contamination < 5% (was 18.7%)", () => {
    const contamination = computeContamination("R(D)", landscape);
    expect(contamination).toBeLessThan(0.05);
  });

  test("I(R) contamination < 5% (was 13.3%)", () => {
    const contamination = computeContamination("I(R)", landscape);
    expect(contamination).toBeLessThan(0.05);
  });

  test("all basins contamination < 10%", () => {
    for (const basin of landscape.basins) {
      const contamination = computeContamination(basin.composition, landscape);
      expect(contamination).toBeLessThan(0.10);
    }
  });
});

// ─── Local minima preserved ────────────────────────────────────────

describe("empirical sigma: local minima", () => {
  test("all 9 basins are local energy minima", () => {
    const epsilon = 0.01;
    for (const basin of landscape.basins) {
      const e0 = computeEnergy(basin.centroid, landscape);
      for (let dim = 0; dim < 6; dim++) {
        const plus = [...basin.centroid];
        plus[dim] += epsilon;
        const minus = [...basin.centroid];
        minus[dim] -= epsilon;
        expect(computeEnergy(plus, landscape).energy).toBeGreaterThanOrEqual(e0.energy);
        expect(computeEnergy(minus, landscape).energy).toBeGreaterThanOrEqual(e0.energy);
      }
    }
  });
});
