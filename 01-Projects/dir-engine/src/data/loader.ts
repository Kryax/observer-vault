import { CentroidManifestSchema, IndicatorVocabularySchema, MotifLibrarySchema } from "./schemas.js";
import type { CentroidManifest, IndicatorVocabulary, MotifLibrary } from "../types/index.js";

const ALL_COMPOSITIONS = ["D(D)", "D(I)", "D(R)", "I(D)", "I(I)", "I(R)", "R(D)", "R(I)", "R(R)"];

async function readJson(path: string): Promise<unknown> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    throw new Error(`Artifact file not found: ${path}`);
  }
  const text = await file.text();
  return JSON.parse(text);
}

export async function loadCentroids(path: string): Promise<CentroidManifest> {
  const raw = await readJson(path);
  const manifest = CentroidManifestSchema.parse(raw);

  // Validate centroid dimensions match declared dim
  for (let i = 0; i < manifest.centroids.length; i++) {
    if (manifest.centroids[i].length !== manifest.dim) {
      throw new Error(
        `Centroid ${i} has ${manifest.centroids[i].length} dimensions, expected ${manifest.dim}`
      );
    }
  }

  // Validate centroid count matches k
  if (manifest.centroids.length !== manifest.k) {
    throw new Error(
      `Expected ${manifest.k} centroids, found ${manifest.centroids.length}`
    );
  }

  // Warn (don't fail) if mapping doesn't cover all 9 compositions
  const mappedCompositions = new Set(Object.values(manifest.mapping));
  const missing = ALL_COMPOSITIONS.filter((c) => !mappedCompositions.has(c));
  if (missing.length > 0) {
    console.error(
      `[dir-engine] WARNING: Centroid mapping missing compositions: ${missing.join(", ")}. ` +
        `Engine will operate with partial coverage.`
    );
  }

  return manifest;
}

export async function loadVocabulary(path: string): Promise<IndicatorVocabulary> {
  const raw = await readJson(path);
  return IndicatorVocabularySchema.parse(raw);
}

export async function loadMotifs(path: string): Promise<MotifLibrary> {
  const raw = await readJson(path);
  return MotifLibrarySchema.parse(raw);
}
