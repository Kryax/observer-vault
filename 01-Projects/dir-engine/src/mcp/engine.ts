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

export class Engine {
  private centroids!: CentroidManifest;
  private vocabulary!: IndicatorVocabulary;
  private motifs!: MotifLibrary;
  private startTime: number;
  private loaded = false;

  constructor() {
    this.startTime = Date.now();
  }

  async init(dataDir: string): Promise<void> {
    this.centroids = await loadCentroids(resolve(dataDir, "centroids.json"));
    this.vocabulary = await loadVocabulary(resolve(dataDir, "vocabulary.json"));
    this.motifs = await loadMotifs(resolve(dataDir, "motifs.json"));
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
