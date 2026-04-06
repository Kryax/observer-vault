/**
 * Compute empirical basin widths (σᵢ) from shard verb-record data.
 *
 * For each composition, computes within-cluster variance:
 *   σ²ᵢ = (1/Nᵢ) Σⱼ ||vⱼ − cᵢ||²
 *
 * Uses only records with non-null compositionExpression.
 * Writes result to data/basin-widths.json.
 */

import { Database } from "bun:sqlite";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { vectorize } from "../src/vectorizer/index.js";
import { loadVocabulary, loadCentroids } from "../src/data/loader.js";

const DATA_DIR = resolve(import.meta.dir, "..", "data");
const SHARD_DIR = resolve(import.meta.dir, "..", "..", "dataset-processor", "output");
const MAX_SHARD = 25; // Do NOT touch shards 26-29

async function main() {
  const vocab = await loadVocabulary(resolve(DATA_DIR, "vocabulary.json"));
  const manifest = await loadCentroids(resolve(DATA_DIR, "centroids.json"));

  // Build centroid lookup: composition → centroid vector
  const centroidMap = new Map<string, number[]>();
  for (const [idx, comp] of Object.entries(manifest.mapping)) {
    centroidMap.set(comp, manifest.centroids[Number(idx)]);
  }

  // Accumulators
  const accum = new Map<string, { sumSqDist: number; count: number }>();
  const perShard: Record<string, Record<string, { n: number; sigma: number }>> = {};
  const usedShards: number[] = [];

  for (let shard = 0; shard <= MAX_SHARD; shard++) {
    const padded = String(shard).padStart(2, "0");
    const dbPath = resolve(SHARD_DIR, `shard-${padded}.db`);

    if (!existsSync(dbPath)) {
      console.log(`[shard-${padded}] not found, skipping`);
      continue;
    }

    let db: Database;
    try {
      db = new Database(dbPath, { readonly: true });
    } catch (e) {
      console.log(`[shard-${padded}] locked/error, skipping: ${e}`);
      continue;
    }

    const rows = db.prepare(
      "SELECT source_raw_text, compositionExpression FROM verb_records WHERE compositionExpression IS NOT NULL"
    ).all() as { source_raw_text: string; compositionExpression: string }[];

    if (rows.length === 0) {
      db.close();
      console.log(`[shard-${padded}] 0 labeled records, skipping`);
      continue;
    }

    usedShards.push(shard);
    const shardAccum = new Map<string, { sumSqDist: number; count: number }>();

    for (const row of rows) {
      const vec = vectorize(row.source_raw_text, vocab);
      const comp = row.compositionExpression;
      const centroid = centroidMap.get(comp);
      if (!centroid) continue;

      let distSq = 0;
      for (let i = 0; i < vec.length; i++) {
        distSq += (vec[i] - centroid[i]) ** 2;
      }

      // Global accumulator
      const g = accum.get(comp) ?? { sumSqDist: 0, count: 0 };
      g.sumSqDist += distSq;
      g.count++;
      accum.set(comp, g);

      // Per-shard accumulator
      const s = shardAccum.get(comp) ?? { sumSqDist: 0, count: 0 };
      s.sumSqDist += distSq;
      s.count++;
      shardAccum.set(comp, s);
    }

    // Record per-shard sigmas
    perShard[String(shard)] = {};
    for (const [comp, { sumSqDist, count }] of shardAccum) {
      const sigma = Math.max(Math.sqrt(sumSqDist / count), 0.01);
      perShard[String(shard)][comp] = { n: count, sigma };
    }

    console.log(`[shard-${padded}] ${rows.length} labeled records processed`);
    db.close();
  }

  // Compute global sigmas
  const widths: Record<string, number> = {};
  const counts: Record<string, number> = {};
  let totalRecords = 0;

  for (const [comp, { sumSqDist, count }] of accum) {
    widths[comp] = Math.max(Math.sqrt(sumSqDist / count), 0.01);
    counts[comp] = count;
    totalRecords += count;
  }

  const output = {
    version: "20260407-empirical",
    source_shards: usedShards.sort((a, b) => a - b),
    total_records: totalRecords,
    widths,
    counts,
    per_shard: perShard,
  };

  const outPath = resolve(DATA_DIR, "basin-widths.json");
  await Bun.write(outPath, JSON.stringify(output, null, 2));

  console.log(`\nWrote ${outPath}`);
  console.log(`Total records: ${totalRecords}`);
  console.log(`Shards used: ${usedShards.join(", ")}`);
  console.log("\nEmpirical σ values:");
  for (const [comp, sigma] of Object.entries(widths).sort()) {
    console.log(`  ${comp}: σ=${sigma.toFixed(4)} (n=${counts[comp]})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
