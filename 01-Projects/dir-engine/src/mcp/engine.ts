import { resolve } from "node:path";
import type {
  CentroidManifest,
  IndicatorVocabulary,
  MotifLibrary,
  Vector6D,
  ClassificationResult,
  CompositionResult,
  EvaluationResult,
  EngineStatus,
} from "../types/index.js";
import { loadCentroids, loadVocabulary, loadMotifs } from "../data/loader.js";
import { vectorize } from "../vectorizer/index.js";
import { classify, type ClassifyInput } from "../classifier/index.js";
import { compose } from "../composer/index.js";
import { evaluate, type EvaluateInput } from "../evaluator/index.js";
import {
  buildLandscape,
  computeEnergy,
  computeTransition,
  type EnergyLandscape,
  type EnergyResult,
  type TransitionResult,
} from "../energy.js";

export class Engine {
  private centroids!: CentroidManifest;
  private vocabulary!: IndicatorVocabulary;
  private motifs!: MotifLibrary;
  private landscape!: EnergyLandscape;
  private startTime: number;
  private loaded = false;

  constructor() {
    this.startTime = Date.now();
  }

  async init(dataDir: string): Promise<void> {
    this.centroids = await loadCentroids(resolve(dataDir, "centroids.json"));
    this.vocabulary = await loadVocabulary(resolve(dataDir, "vocabulary.json"));
    this.motifs = await loadMotifs(resolve(dataDir, "motifs.json"));
    this.landscape = buildLandscape(this.centroids, this.motifs);
    this.loaded = true;
  }

  doClassify(input: ClassifyInput): ClassificationResult {
    this.ensureLoaded();
    return classify(input, this.centroids, this.vocabulary, vectorize);
  }

  doCompose(a: string, b: string, operation?: "apply" | "commutator" | "inverse"): CompositionResult {
    return compose(a, b, operation);
  }

  doEvaluate(input: EvaluateInput): EvaluationResult {
    this.ensureLoaded();
    const vectorizeFn = (text: string): Vector6D => vectorize(text, this.vocabulary);
    return evaluate(input, this.motifs, vectorizeFn);
  }

  doEnergy(input: { text?: string; vector?: number[]; composition?: string }): EnergyResult {
    this.ensureLoaded();
    let vec: number[];
    if (input.vector) {
      vec = input.vector;
    } else if (input.text) {
      vec = vectorize(input.text, this.vocabulary) as number[];
    } else if (input.composition) {
      // Find the centroid for this composition
      const entry = Object.entries(this.centroids.mapping)
        .find(([, comp]) => comp === input.composition);
      if (!entry) throw new Error(`Unknown composition: ${input.composition}`);
      vec = this.centroids.centroids[parseInt(entry[0])];
    } else {
      throw new Error("Provide text, vector, or composition");
    }
    return computeEnergy(vec, this.landscape);
  }

  doTransition(input: { vector: number[]; history?: number[][] }): TransitionResult {
    this.ensureLoaded();
    return computeTransition(input.vector, this.landscape, input.history);
  }

  getLandscape(): EnergyLandscape {
    this.ensureLoaded();
    return this.landscape;
  }

  getStatus(): EngineStatus {
    const compositions = this.loaded
      ? new Set(Object.values(this.centroids.mapping)).size
      : 0;

    return {
      centroids_loaded: this.loaded,
      centroid_version: this.loaded ? this.centroids.version : "none",
      vocabulary_size: this.loaded ? this.vocabulary.indicators.length : 0,
      compositions_covered: compositions,
      motifs_loaded: this.loaded ? this.motifs.motifs.length : 0,
      uptime_s: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  private ensureLoaded(): void {
    if (!this.loaded) {
      throw new Error("Engine not initialized. Call init() first.");
    }
  }
}
