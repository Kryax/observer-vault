import { describe, test, expect } from "bun:test";
import { resolve } from "node:path";
import type { Vector6D, CompositionExpression } from "../src/types/index.js";
import { CentroidManifestSchema, IndicatorVocabularySchema, MotifLibrarySchema } from "../src/data/schemas.js";
import { loadCentroids, loadVocabulary, loadMotifs } from "../src/data/loader.js";

const FIXTURES = resolve(import.meta.dir, "fixtures");

// ─── ISC-S01: Vector6D type exported and usable ─────────────────────
describe("S0 Types", () => {
  test("ISC-S01: Vector6D type is a 6-element tuple", () => {
    const v: Vector6D = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6];
    expect(v).toHaveLength(6);
    expect(typeof v[0]).toBe("number");
  });

  test("ISC-S02: CompositionExpression matches v1.0 spec Section 8.1", () => {
    const expr: CompositionExpression = {
      notation: "R(I)",
      outer: "R",
      inner: "I",
      order: 1,
      isApplied: false,
    };
    expect(expr.notation).toBe("R(I)");
    expect(expr.outer).toBe("R");
    expect(expr.inner).toBe("I");
    expect(expr.order).toBe(1);
    expect(expr.isApplied).toBe(false);
  });
});

// ─── ISC-S03/S04/S05: Zod schemas validate sample files ────────────
describe("S0 Schemas", () => {
  test("ISC-S03: CentroidManifest schema validates sample", async () => {
    const raw = await Bun.file(resolve(FIXTURES, "centroids-sample.json")).json();
    const result = CentroidManifestSchema.safeParse(raw);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.k).toBe(9);
      expect(result.data.centroids).toHaveLength(9);
      expect(result.data.centroids[0]).toHaveLength(6);
    }
  });

  test("ISC-S04: IndicatorVocabulary schema validates sample", async () => {
    const raw = await Bun.file(resolve(FIXTURES, "vocabulary-sample.json")).json();
    const result = IndicatorVocabularySchema.safeParse(raw);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.indicators.length).toBeGreaterThan(0);
      expect(result.data.temporal_markers.sequential.length).toBeGreaterThan(0);
    }
  });

  test("ISC-S05: MotifLibrary schema validates sample", async () => {
    const raw = await Bun.file(resolve(FIXTURES, "motifs-sample.json")).json();
    const result = MotifLibrarySchema.safeParse(raw);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.motifs.length).toBeGreaterThan(0);
      expect(result.data.motifs[0].indicators.length).toBeGreaterThan(0);
    }
  });

  test("CentroidManifest schema rejects invalid data", () => {
    const result = CentroidManifestSchema.safeParse({ version: "test" });
    expect(result.success).toBe(false);
  });

  test("IndicatorVocabulary schema rejects invalid axis value", () => {
    const result = IndicatorVocabularySchema.safeParse({
      version: "test",
      indicators: [{ term: "x", weight: 1.0, axis: 5 }],
      temporal_markers: { sequential: [], concurrent: [], cyclic: [], recursive: [] },
    });
    expect(result.success).toBe(false);
  });

  test("MotifLibrary schema rejects empty motifs array", () => {
    const result = MotifLibrarySchema.safeParse({ version: "test", motifs: [] });
    expect(result.success).toBe(false);
  });
});

// ─── ISC-S06/S07/S08: Loaders return typed data or throw ───────────
describe("S0 Loaders", () => {
  test("ISC-S06: loadCentroids returns typed manifest", async () => {
    const manifest = await loadCentroids(resolve(FIXTURES, "centroids-sample.json"));
    expect(manifest.k).toBe(9);
    expect(manifest.centroids).toHaveLength(9);
    expect(manifest.mapping["0"]).toBeDefined();
  });

  test("ISC-S06: loadCentroids throws on invalid data", async () => {
    // Write a temp invalid file
    const tmpPath = resolve(FIXTURES, "_invalid-centroids.json");
    await Bun.write(tmpPath, JSON.stringify({ version: "bad" }));
    await expect(loadCentroids(tmpPath)).rejects.toThrow();
    await Bun.file(tmpPath).exists() && (await Bun.write(tmpPath, "")); // cleanup
  });

  test("ISC-S06: loadCentroids throws on missing file", async () => {
    await expect(loadCentroids("/nonexistent/path.json")).rejects.toThrow("not found");
  });

  test("ISC-S07: loadVocabulary returns typed vocabulary", async () => {
    const vocab = await loadVocabulary(resolve(FIXTURES, "vocabulary-sample.json"));
    expect(vocab.indicators.length).toBeGreaterThan(0);
    expect(vocab.indicators[0].term).toBeDefined();
    expect(vocab.indicators[0].weight).toBeDefined();
    expect(vocab.indicators[0].axis).toBeDefined();
  });

  test("ISC-S07: loadVocabulary throws on invalid data", async () => {
    const tmpPath = resolve(FIXTURES, "_invalid-vocab.json");
    await Bun.write(tmpPath, JSON.stringify({ version: "bad" }));
    await expect(loadVocabulary(tmpPath)).rejects.toThrow();
  });

  test("ISC-S08: loadMotifs returns typed library", async () => {
    const library = await loadMotifs(resolve(FIXTURES, "motifs-sample.json"));
    expect(library.motifs.length).toBeGreaterThan(0);
    expect(library.motifs[0].id).toBeDefined();
    expect(library.motifs[0].indicators.length).toBeGreaterThan(0);
  });

  test("ISC-S08: loadMotifs throws on invalid data", async () => {
    const tmpPath = resolve(FIXTURES, "_invalid-motifs.json");
    await Bun.write(tmpPath, JSON.stringify({ version: "bad" }));
    await expect(loadMotifs(tmpPath)).rejects.toThrow();
  });
});

// ─── ISC-S09: Centroid coverage validation (warn, don't fail) ───────
describe("S0 Centroid Coverage", () => {
  test("ISC-S09: loadCentroids warns on partial mapping but still loads", async () => {
    const partial = {
      version: "test",
      k: 3,
      dim: 6,
      dim_names: ["D", "I", "R", "temporal", "density", "entropy"],
      centroids: [
        [0.8, 0.1, 0.1, 0.3, 0.5, 0.4],
        [0.1, 0.8, 0.1, 0.2, 0.6, 0.3],
        [0.1, 0.1, 0.8, 0.4, 0.4, 0.5],
      ],
      mapping: { "0": "D(D)", "1": "I(I)", "2": "R(R)" },
    };
    const tmpPath = resolve(FIXTURES, "_partial-centroids.json");
    await Bun.write(tmpPath, JSON.stringify(partial));

    // Should not throw — just warn
    const manifest = await loadCentroids(tmpPath);
    expect(manifest.k).toBe(3);
    expect(manifest.centroids).toHaveLength(3);
  });
});
