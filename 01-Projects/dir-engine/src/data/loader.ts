import { CentroidManifestSchema, IndicatorVocabularySchema, MotifLibrarySchema } from "./schemas.js";
import type { CentroidManifest, IndicatorVocabulary, MotifLibrary } from "../types/index.js";
import { DIR_AXIS_WEIGHT } from "../classifier/distance.js";

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

  // v2+ centroids are computed in the weighted vector space (DIR_AXIS_WEIGHT
  // applied before L2 norm in vectorizer). Only re-weight v1 centroids that
  // were computed in the old unweighted space.
  const isV2 = manifest.version.includes("v2") || manifest.version.includes("weighted");
  if (!isV2) {
    for (let i = 0; i < manifest.centroids.length; i++) {
      const c = manifest.centroids[i];
      c[0] *= DIR_AXIS_WEIGHT;
      c[1] *= DIR_AXIS_WEIGHT;
      c[2] *= DIR_AXIS_WEIGHT;
      let norm = 0;
      for (let j = 0; j < c.length; j++) norm += c[j] * c[j];
      norm = Math.sqrt(norm);
      if (norm > 0) {
        for (let j = 0; j < c.length; j++) c[j] /= norm;
      }
    }
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
