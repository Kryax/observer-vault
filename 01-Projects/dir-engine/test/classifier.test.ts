import { describe, it, expect } from "bun:test";
import { classify } from "../src/classifier/index.ts";
import { cosineDistance, nearestCentroid } from "../src/classifier/distance.ts";
import { detectSubstrate } from "../src/classifier/substrate.ts";
import type {
  Vector6D,
  CentroidManifest,
  IndicatorVocabulary,
} from "../src/types/index.ts";

// --- Test fixtures ---

import centroids from "./fixtures/centroids-sample.json";
const testCentroids = centroids as CentroidManifest;

const VALID_COMPOSITIONS = [
  "D(D)", "D(I)", "D(R)",
  "I(D)", "I(I)", "I(R)",
  "R(D)", "R(I)", "R(R)",
  "unknown",
];

/** Mock vocabulary -- not used by mock vectorizer but required by signature */
const mockVocab: IndicatorVocabulary = {
  version: "test",
  indicators: [],
  temporal_markers: {
    sequential: [],
    concurrent: [],
    cyclic: [],
    recursive: [],
  },
};

/** Mock vectorizer that returns a known vector regardless of input */
function mockVectorize(_text: string, _vocab: IndicatorVocabulary): Vector6D {
  // Returns a vector close to centroid 0 in the sample fixture: [0.8, 0.1, 0.1, 0.3, 0.5, 0.4]
  return [0.75, 0.12, 0.08, 0.28, 0.48, 0.38];
}

/** Mock vectorizer that returns a vector near the I(I) centroid (index 1) */
function mockVectorizeI(_text: string, _vocab: IndicatorVocabulary): Vector6D {
  return [0.12, 0.78, 0.09, 0.22, 0.58, 0.32];
}

// --- ISC-S24: cosineDistance identical vectors ---
describe("ISC-S24: cosineDistance identical vectors", () => {
  it("returns 0 for identical vectors", () => {
    const v = [0.5, 0.3, 0.2, 0.4, 0.6, 0.1];
    expect(cosineDistance(v, v)).toBeCloseTo(0, 10);
  });
});

// --- ISC-S25: cosineDistance orthogonal vectors ---
describe("ISC-S25: cosineDistance orthogonal vectors", () => {
  it("returns 1 for orthogonal vectors", () => {
    const a = [1, 0, 0, 0, 0, 0];
    const b = [0, 1, 0, 0, 0, 0];
    expect(cosineDistance(a, b)).toBeCloseTo(1, 10);
  });

  it("returns 2 for opposite vectors", () => {
    const a = [1, 0, 0, 0, 0, 0];
    const b = [-1, 0, 0, 0, 0, 0];
    expect(cosineDistance(a, b)).toBeCloseTo(2, 10);
  });
});

// --- ISC-S21: classify returns all ClassificationResult fields ---
describe("ISC-S21: classify returns all ClassificationResult fields", () => {
  it("returns vector, composition, confidence, space, axis, cluster_id", () => {
    const result = classify(
      { text: "some differentiation text" },
      testCentroids,
      mockVocab,
      mockVectorize,
    );

    expect(result).toHaveProperty("vector");
    expect(result).toHaveProperty("composition");
    expect(result).toHaveProperty("confidence");
    expect(result).toHaveProperty("space");
    expect(result).toHaveProperty("axis");
    expect(result).toHaveProperty("cluster_id");

    expect(result.vector).toHaveLength(6);
    expect(typeof result.composition).toBe("string");
    expect(typeof result.confidence).toBe("number");
    expect(["ideal", "applied", "unknown"]).toContain(result.space);
    expect(["differentiate", "integrate", "recurse"]).toContain(result.axis);
    expect(typeof result.cluster_id).toBe("number");
  });
});

// --- ISC-S22: Composition is one of 9 valid or "unknown" ---
describe("ISC-S22: composition is valid", () => {
  it("returns a valid first-order composition", () => {
    const result = classify(
      { text: "test" },
      testCentroids,
      mockVocab,
      mockVectorize,
    );
    expect(VALID_COMPOSITIONS).toContain(result.composition);
  });
});

// --- ISC-S23: Confidence in [0, 1] ---
describe("ISC-S23: confidence in [0, 1]", () => {
  it("confidence is between 0 and 1 inclusive", () => {
    const result = classify(
      { text: "test" },
      testCentroids,
      mockVocab,
      mockVectorize,
    );
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("confidence is in range for vector input too", () => {
    const result = classify(
      { vector: [0.5, 0.3, 0.2, 0.4, 0.6, 0.1] },
      testCentroids,
      mockVocab,
      mockVectorize,
    );
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});

// --- ISC-S26: Text with substrate keywords -> "applied" when space="auto" ---
describe("ISC-S26: substrate detection sets space to applied", () => {
  it("classifies text with substrate keywords as applied", () => {
    const result = classify(
      { text: "the noise and drift cause decay in the system", space: "auto" },
      testCentroids,
      mockVocab,
      mockVectorize,
    );
    expect(result.space).toBe("applied");
  });

  it("classifies text without substrate keywords as ideal", () => {
    const result = classify(
      { text: "pure differentiation operator", space: "auto" },
      testCentroids,
      mockVocab,
      mockVectorize,
    );
    expect(result.space).toBe("ideal");
  });
});

// --- ISC-S27: Explicit space overrides auto-detection ---
describe("ISC-S27: explicit space overrides auto-detection", () => {
  it("explicit ideal overrides substrate detection", () => {
    const result = classify(
      { text: "noise and drift and decay", space: "ideal" },
      testCentroids,
      mockVocab,
      mockVectorize,
    );
    expect(result.space).toBe("ideal");
  });

  it("explicit applied overrides no-substrate text", () => {
    const result = classify(
      { text: "pure operator", space: "applied" },
      testCentroids,
      mockVocab,
      mockVectorize,
    );
    expect(result.space).toBe("applied");
  });
});

// --- ISC-S28: classify with 9 centroids assigns to nearest cluster ---
describe("ISC-S28: nearest centroid assignment", () => {
  it("assigns vector close to centroid 0 to cluster 0", () => {
    // Centroid 0 in fixture: [0.8, 0.1, 0.1, 0.3, 0.5, 0.4] -> D(D)
    const result = classify(
      { vector: [0.8, 0.1, 0.1, 0.3, 0.5, 0.4] },
      testCentroids,
      mockVocab,
      mockVectorize,
    );
    expect(result.cluster_id).toBe(0);
    expect(result.composition).toBe("D(D)");
  });

  it("assigns vector close to centroid 1 to cluster 1", () => {
    // Centroid 1 in fixture: [0.1, 0.8, 0.1, 0.2, 0.6, 0.3] -> I(I)
    const result = classify(
      { vector: [0.1, 0.8, 0.1, 0.2, 0.6, 0.3] },
      testCentroids,
      mockVocab,
      mockVectorize,
    );
    expect(result.cluster_id).toBe(1);
    expect(result.composition).toBe("I(I)");
  });

  it("assigns vector close to centroid 2 to cluster 2", () => {
    // Centroid 2 in fixture: [0.1, 0.1, 0.8, 0.4, 0.4, 0.5] -> R(R)
    const result = classify(
      { vector: [0.1, 0.1, 0.8, 0.4, 0.4, 0.5] },
      testCentroids,
      mockVocab,
      mockVectorize,
    );
    expect(result.cluster_id).toBe(2);
    expect(result.composition).toBe("R(R)");
  });
});

// --- ISC-S29: vector input skips vectorization ---
describe("ISC-S29: vector input skips vectorization", () => {
  it("classifies directly from a 6D vector without calling vectorizeFn", () => {
    let vectorizeCalled = false;
    const trackingVectorize = (text: string, vocab: IndicatorVocabulary): Vector6D => {
      vectorizeCalled = true;
      return [0, 0, 0, 0, 0, 0];
    };

    const result = classify(
      { vector: [0.5, 0.3, 0.2, 0.4, 0.6, 0.1] },
      testCentroids,
      mockVocab,
      trackingVectorize,
    );

    expect(vectorizeCalled).toBe(false);
    expect(result.vector).toHaveLength(6);
    expect(result.cluster_id).toBeGreaterThanOrEqual(0);
  });
});

// --- ISC-S2A: throws when both text and vector provided ---
describe("ISC-S2A: throws when both text and vector provided", () => {
  it("throws an error", () => {
    expect(() =>
      classify(
        { text: "hello", vector: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6] },
        testCentroids,
        mockVocab,
        mockVectorize,
      ),
    ).toThrow();
  });
});

// --- ISC-S2B: throws when neither text nor vector provided ---
describe("ISC-S2B: throws when neither text nor vector provided", () => {
  it("throws an error", () => {
    expect(() =>
      classify(
        {},
        testCentroids,
        mockVocab,
        mockVectorize,
      ),
    ).toThrow();
  });
});

// --- Additional distance tests ---
describe("nearestCentroid", () => {
  it("finds the nearest centroid index and distance", () => {
    const centroids = [
      [1, 0, 0, 0, 0, 0],
      [0, 1, 0, 0, 0, 0],
      [0, 0, 1, 0, 0, 0],
    ];
    const result = nearestCentroid([0.9, 0.1, 0, 0, 0, 0], centroids);
    expect(result.index).toBe(0);
    expect(result.distance).toBeGreaterThanOrEqual(0);
  });
});

// --- Substrate detection ---
describe("detectSubstrate", () => {
  it("detects substrate keywords", () => {
    const result = detectSubstrate("there is noise and drift in the signal");
    expect(result.detected).toBe(true);
    expect(result.indicators).toContain("noise");
    expect(result.indicators).toContain("drift");
  });

  it("returns false when no substrate keywords present", () => {
    const result = detectSubstrate("pure mathematical operator");
    expect(result.detected).toBe(false);
    expect(result.indicators).toHaveLength(0);
  });
});
