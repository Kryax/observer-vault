---
status: DRAFT
date: 2026-04-07
type: prd
project: dir-engine
title: "Empirical σ Calibration for D/I/R Energy Landscape"
---

# PRD: Empirical σ Calibration

## Problem

Basin widths (σᵢ) use nn_dist/6 heuristic. Deep basins (I(D) at -7.0, R(I) at -6.8) have wide Gaussian tails that contaminate shallow neighbours. R(D) has 18.7% tail contamination; I(R) has 13.3% — producing negative `barrier_to_second` at those centroids. The `effectiveWidth()` 2.5× adjacency multiplier inflates this further.

Fix: replace geometric heuristic with empirical within-cluster variance from shard data. Kill adjacency multiplier.

## Data Reality (discovered in orientation)

- **Only shards 00-09** have `compositionExpression` populated (~34,500 labeled records)
- Shards 10-25 have 10K records each but 0 composition labels — skipped
- R(I) has smallest count (~118/shard ≈ 1,180 total) — sufficient for variance
- 113 existing tests pass (not 91)

## D/I/R Cycle 1 — Distinction: Boundaries

### Files that change

| File | Change |
|------|--------|
| `src/energy-core.ts` | `computeBasinWidths()` — load empirical, fallback nn/6 |
| `src/energy-core.ts` | `effectiveWidth()` — remove 2.5×/0.5× multiplier |
| `src/energy.ts` L100 | Pass `manifest.mapping` to `computeBasinWidths()` |
| `scripts/compute-empirical-sigmas.ts` | NEW — extraction script |
| `scripts/validate-landscape.ts` | NEW — validation script |
| `data/basin-widths.json` | NEW — computed artifact |
| `test/energy-empirical.test.ts` | NEW — contamination/barrier tests |

### Files that MUST NOT change

- `data/centroids.json`, `data/vocabulary.json`, `data/motifs.json`
- `src/vectorizer/index.ts`, `src/data/loader.ts`
- Any shard DB files, anything outside `01-Projects/dir-engine/`

### Edge cases

1. Only shards 00-09 usable (compositionExpression NULL elsewhere)
2. R(I) has ~1,180 total records — small but sufficient
3. Near-zero variance → floor σ at 0.01
4. `effectiveWidth()` removal: `computeRawEnergyDirected()` still calls it — simplify to return avg(from.width, to.width) with no adjacency scaling
5. basin-widths.json path resolution: use `import.meta.dir` relative path (same pattern as loader.ts)

## D/I/R Cycle 2 — Integration: Architecture

### 1. Extraction Script (`scripts/compute-empirical-sigmas.ts`)

```typescript
// Pseudocode
import { Database } from "bun:sqlite";
import { vectorize } from "../src/vectorizer/index.js";
import { loadVocabulary, loadCentroids } from "../src/data/loader.js";
import { euclideanDistance } from "../src/energy-core.js";

const DATA_DIR = resolve(import.meta.dir, "..", "data");
const SHARD_DIR = resolve(import.meta.dir, "..", "..", "dataset-processor", "output");

const vocab = await loadVocabulary(resolve(DATA_DIR, "vocabulary.json"));
const manifest = await loadCentroids(resolve(DATA_DIR, "centroids.json"));

// Build centroid lookup: composition → centroid vector
const centroidMap: Map<string, number[]> = new Map();
for (const [idx, comp] of Object.entries(manifest.mapping)) {
  centroidMap.set(comp, manifest.centroids[Number(idx)]);
}

// Accumulate per-composition: sum of squared distances and count
const accum: Map<string, { sumSqDist: number; count: number }> = new Map();
const perShard: Record<string, Record<string, { n: number; sigma: number }>> = {};

for (let shard = 0; shard <= 25; shard++) {
  const dbPath = resolve(SHARD_DIR, `shard-${String(shard).padStart(2, "0")}.db`);
  // Open read-only, skip if missing/locked
  const db = new Database(dbPath, { readonly: true });
  
  const rows = db.prepare(
    "SELECT source_raw_text, compositionExpression FROM verb_records WHERE compositionExpression IS NOT NULL"
  ).all();
  
  if (rows.length === 0) { db.close(); continue; }
  
  const shardAccum: Map<string, { sumSqDist: number; count: number }> = new Map();
  
  for (const row of rows) {
    const vec = vectorize(row.source_raw_text, vocab);
    const comp = row.compositionExpression;
    const centroid = centroidMap.get(comp);
    if (!centroid) continue;
    
    const distSq = vec.reduce((sum, v, i) => sum + (v - centroid[i]) ** 2, 0);
    
    // Accumulate globally
    const g = accum.get(comp) ?? { sumSqDist: 0, count: 0 };
    g.sumSqDist += distSq; g.count++;
    accum.set(comp, g);
    
    // Accumulate per-shard
    const s = shardAccum.get(comp) ?? { sumSqDist: 0, count: 0 };
    s.sumSqDist += distSq; s.count++;
    shardAccum.set(comp, s);
  }
  
  // Record per-shard sigmas
  perShard[shard] = {};
  for (const [comp, { sumSqDist, count }] of shardAccum) {
    const sigma = Math.max(Math.sqrt(sumSqDist / count), 0.01);
    perShard[shard][comp] = { n: count, sigma };
  }
  
  db.close();
}

// Compute global sigmas (weighted by count — equivalent to pooling all records)
const widths: Record<string, number> = {};
const counts: Record<string, number> = {};
for (const [comp, { sumSqDist, count }] of accum) {
  widths[comp] = Math.max(Math.sqrt(sumSqDist / count), 0.01);
  counts[comp] = count;
}

// Write output
await Bun.write(resolve(DATA_DIR, "basin-widths.json"), JSON.stringify({
  version: "20260407-empirical",
  source_shards: [...new Set(Object.keys(perShard).map(Number))].sort((a,b) => a-b),
  total_records: [...accum.values()].reduce((s, v) => s + v.count, 0),
  widths,
  counts,
  per_shard: perShard,
}, null, 2));
```

### 2. Engine Modifications

**`computeBasinWidths(centroids, mapping?)`:**
- If mapping provided and `basin-widths.json` exists at `../data/basin-widths.json` relative to module:
  - Load and parse JSON
  - For each centroid index i, look up composition via mapping[i], get σ from widths[composition]
  - Return array of σ values in centroid order
- Else: fall back to nn/6 heuristic (current code)

**`effectiveWidth(from, to, adjacency)`:**
- Return `(from.width + to.width) / 2` — no adjacency scaling

### 3. Validation Script (`scripts/validate-landscape.ts`)

Loads landscape, computes energy at all 9 centroids, prints:
- barrier_to_second for each basin (all must be > 0)
- contamination % for each basin
- shared vs cross-operator avg ridge energies
- old σ vs new σ comparison

### 4. New Tests (`test/energy-empirical.test.ts`)

- `barrier_to_second > 0` for all 9 basins at centroids
- R(D) contamination < 5%
- I(R) contamination < 5%
- All basins remain local energy minima

## D/I/R Cycle 3 — Recursion: What did we miss?

1. **compositionExpression NULL** — handled by WHERE clause; only shards 00-09 contribute data
2. **Vectorizer standalone** — imports `vectorize()` from `../src/vectorizer/index.js` and `loadVocabulary` from `../src/data/loader.js`. The vectorizer depends on `IndicatorVocabulary` type and `TEMPORAL_MARKERS` from `temporal.ts`. All are within the dir-engine package — no external deps. ✓
3. **Chicken-and-egg** — vocabulary.json path resolved via `import.meta.dir` relative to scripts dir → `../data/vocabulary.json`. Same pattern as loader.ts uses. ✓
4. **basin-widths.json path resolution** — `computeBasinWidths()` is in `src/energy-core.ts`. It needs to resolve `../data/basin-widths.json` relative to its own location. Use `import.meta.dir` → `resolve(import.meta.dir, "..", "data", "basin-widths.json")`. In test context, `import.meta.dir` resolves to the `src/` directory. In MCP server context, same. ✓
5. **Centroids don't need updating** — they're positions, σ is spread. Independent. ✓
6. **`computeRawEnergyDirected` behavior change** — with effectiveWidth no longer scaling by 2.5×, directed energy becomes closer to undirected energy. Barrier estimates will be higher (less artificially lowered by inflated σ). This is the desired behavior — barriers should reflect actual landscape topology. ✓
7. **Test tolerance** — existing test `transition_score < 0.15 at centroids` might tighten (scores may drop toward 0 with better-isolated basins). This is fine — the threshold is a ceiling. ✓
8. **Test `localMinimaCount >= 7`** — with tighter σ, all 9 basins should be proper local minima. Count should increase from ≥7 to 9. This is improvement, not breakage. ✓

**Delta from Cycle 2: NONE.** Architecture converged. Proceeding to build.

## Implementation Order

1. Write `scripts/compute-empirical-sigmas.ts`
2. Run it → `data/basin-widths.json`
3. Modify `src/energy-core.ts` (computeBasinWidths + effectiveWidth)
4. Modify `src/energy.ts` (pass mapping)
5. Write `scripts/validate-landscape.ts`
6. Write `test/energy-empirical.test.ts`
7. Run all tests
8. Run validation
9. Commit
