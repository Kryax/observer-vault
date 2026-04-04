import { describe, test, expect } from "bun:test";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { vectorize } from "../src/vectorizer/index.js";
import { TEMPORAL_MARKERS } from "../src/vectorizer/temporal.js";
import type { IndicatorVocabulary, Vector6D } from "../src/types/index.js";

const vocabPath = resolve(import.meta.dir, "..", "data", "vocabulary.json");
const vocab: IndicatorVocabulary = JSON.parse(readFileSync(vocabPath, "utf-8"));

function magnitude(v: Vector6D): number {
  return Math.sqrt(v.reduce((s, x) => s + x * x, 0));
}

describe("S1 Vectorizer", () => {
  // ISC-S11: vectorize() returns a 6-element number array
  test("ISC-S11: vectorize() returns a 6-element number array", () => {
    const result = vectorize("state machine boundary", vocab);
    expect(result).toHaveLength(6);
    for (const val of result) {
      expect(typeof val).toBe("number");
    }
  });

  // ISC-S12: Output vector is L2-normalized (magnitude 0.999-1.001) for non-empty text
  test("ISC-S12: output vector is L2-normalized for non-empty text", () => {
    const result = vectorize(
      "state machine boundary explicit transition guard condition",
      vocab,
    );
    const mag = magnitude(result);
    expect(mag).toBeGreaterThanOrEqual(0.999);
    expect(mag).toBeLessThanOrEqual(1.001);
  });

  // ISC-S13: D-dominant text scores highest on index 0
  test("ISC-S13: D-dominant text scores highest on index 0", () => {
    const result = vectorize(
      "state machine boundary explicit transition guard condition",
      vocab,
    );
    expect(result[0]).toBeGreaterThan(result[1]);
    expect(result[0]).toBeGreaterThan(result[2]);
  });

  // ISC-S14: I-dominant text scores highest on index 1
  test("ISC-S14: I-dominant text scores highest on index 1", () => {
    const result = vectorize(
      "dual-speed governance integration convergence reconcile",
      vocab,
    );
    expect(result[1]).toBeGreaterThan(result[0]);
  });

  // ISC-S15: R-dominant text scores highest on index 2
  test("ISC-S15: R-dominant text scores highest on index 2", () => {
    const result = vectorize(
      "recursive feedback loop self-reference meta-observation",
      vocab,
    );
    expect(result[2]).toBeGreaterThan(result[0]);
  });

  // ISC-S16: Empty string returns zero vector
  test("ISC-S16: empty string returns zero vector", () => {
    const result = vectorize("", vocab);
    expect(result).toEqual([0, 0, 0, 0, 0, 0]);
  });

  // ISC-S17: Text longer than 8000 chars is truncated
  test("ISC-S17: text longer than 8000 chars is truncated", () => {
    const base = "state machine boundary explicit ";
    const longText = base.repeat(Math.ceil(9000 / base.length));
    expect(longText.length).toBeGreaterThan(8000);

    const truncated = longText.slice(0, 8000);
    const resultLong = vectorize(longText, vocab);
    const resultTruncated = vectorize(truncated, vocab);

    for (let i = 0; i < 6; i++) {
      expect(resultLong[i]).toBeCloseTo(resultTruncated[i], 10);
    }
  });

  // ISC-S18: Indicator regex patterns compile without error for full vocabulary
  test("ISC-S18: all vocabulary indicators compile and vectorize without error", () => {
    expect(vocab.indicators.length).toBeGreaterThan(0);
    // This exercises every regex pattern in the vocabulary
    const result = vectorize(
      "This text contains state machine boundary recursive feedback integration convergence",
      vocab,
    );
    expect(result).toHaveLength(6);
    expect(magnitude(result)).toBeGreaterThan(0);
  });
});

describe("Temporal markers", () => {
  test("TEMPORAL_MARKERS has four categories", () => {
    expect(Object.keys(TEMPORAL_MARKERS)).toEqual([
      "sequential",
      "concurrent",
      "cyclic",
      "recursive",
    ]);
  });

  test("each category has at least 6 markers", () => {
    for (const group of Object.values(TEMPORAL_MARKERS)) {
      expect(group.length).toBeGreaterThanOrEqual(6);
    }
  });
});
