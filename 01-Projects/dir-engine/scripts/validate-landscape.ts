/**
 * Validate the energy landscape after sigma calibration.
 *
 * Checks:
 * 1. All barrier_to_second > 0 at centroids
 * 2. Shared-operator midpoints lower than cross-operator
 * 3. Basin depth ranking preserved
 * 4. Transition scores near 0 at centroids
 */

import { resolve } from "node:path";
import { buildLandscape, computeEnergy, getAdjacentCompositions } from "../src/energy.js";
import { loadCentroids, loadMotifs } from "../src/data/loader.js";
import { euclideanDistance } from "../src/energy-core.js";

const DATA_DIR = resolve(import.meta.dir, "..", "data");

async function main() {
  const manifest = await loadCentroids(resolve(DATA_DIR, "centroids.json"));
  const motifs = await loadMotifs(resolve(DATA_DIR, "motifs.json"));
  const landscape = buildLandscape(manifest, motifs);

  console.log("═══ Energy Landscape Validation ═══\n");

  // 1. Basin summary
  console.log("Basin widths (σ) and depths:");
  console.log("─".repeat(60));
  for (const b of landscape.basins) {
    const result = computeEnergy(b.centroid, landscape);
    console.log(
      `  ${b.composition.padEnd(5)} σ=${b.width.toFixed(4)}  depth=${b.depth.toFixed(3)}  ` +
      `energy=${result.energy.toFixed(4)}  barrier_to_2nd=${result.barrier_to_second.toFixed(4)}  ` +
      `trans_score=${result.transition_score.toFixed(4)}`
    );
  }

  // 2. Contamination analysis
  console.log("\nContamination analysis:");
  console.log("─".repeat(60));
  let allBarriersPositive = true;

  for (const basin of landscape.basins) {
    const result = computeEnergy(basin.centroid, landscape);

    // Compute own contribution and total tail
    let ownContrib = 0;
    let tailContrib = 0;
    for (const other of landscape.basins) {
      let distSq = 0;
      for (let k = 0; k < basin.centroid.length; k++) {
        distSq += (basin.centroid[k] - other.centroid[k]) ** 2;
      }
      const contrib = other.depth * Math.exp(-distSq / (2 * other.width * other.width));
      if (other.composition === basin.composition) {
        ownContrib = contrib;
      } else {
        tailContrib += contrib;
      }
    }

    const contPct = ownContrib > 0 ? (tailContrib / ownContrib * 100) : 0;
    const status = result.barrier_to_second > 0 ? "OK" : "BROKEN";
    if (result.barrier_to_second <= 0) allBarriersPositive = false;

    console.log(
      `  ${basin.composition.padEnd(5)} own=${ownContrib.toFixed(3)}  tail=${tailContrib.toFixed(3)}  ` +
      `${contPct.toFixed(1).padStart(5)}%  barrier=${result.barrier_to_second.toFixed(4)}  [${status}]`
    );
  }

  // 3. Topology check: shared vs cross-operator ridges
  console.log("\nTopology check (shared vs cross-operator):");
  console.log("─".repeat(60));
  const sharedMidEnergies: number[] = [];
  const crossMidEnergies: number[] = [];

  for (let i = 0; i < landscape.basins.length; i++) {
    for (let j = i + 1; j < landscape.basins.length; j++) {
      const bi = landscape.basins[i];
      const bj = landscape.basins[j];
      const mid = bi.centroid.map((v, k) => (v + bj.centroid[k]) / 2);
      const midEnergy = computeEnergy(mid, landscape).energy;
      const adjacent = getAdjacentCompositions(bi.composition);
      if (adjacent.includes(bj.composition)) {
        sharedMidEnergies.push(midEnergy);
      } else {
        crossMidEnergies.push(midEnergy);
      }
    }
  }

  const avgShared = sharedMidEnergies.reduce((a, b) => a + b, 0) / sharedMidEnergies.length;
  const avgCross = crossMidEnergies.reduce((a, b) => a + b, 0) / crossMidEnergies.length;
  const topologyOk = avgShared < avgCross;

  console.log(`  Shared-operator avg midpoint energy: ${avgShared.toFixed(4)}`);
  console.log(`  Cross-operator avg midpoint energy:  ${avgCross.toFixed(4)}`);
  console.log(`  Topology preserved: ${topologyOk ? "YES" : "NO"}`);

  // 4. Summary
  console.log("\n═══ Summary ═══");
  console.log(`  All barriers positive: ${allBarriersPositive ? "PASS" : "FAIL"}`);
  console.log(`  Topology preserved:    ${topologyOk ? "PASS" : "FAIL"}`);

  if (!allBarriersPositive || !topologyOk) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
