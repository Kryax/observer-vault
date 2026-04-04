import { describe, test, expect } from "bun:test";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { evaluate } from "../src/evaluator/index.js";
import { predicateC, predicateI, predicateD, predicateP } from "../src/evaluator/predicates.js";
import { checkVolume, checkNonDegeneracy } from "../src/evaluator/stability.js";
import type { MotifLibrary, Vector6D } from "../src/types/index.js";

const fixturePath = resolve(import.meta.dir, "fixtures", "motifs-sample.json");
const sampleLibrary: MotifLibrary = JSON.parse(readFileSync(fixturePath, "utf-8"));

/** Mock vectorizer that returns a known vector with all D/I/R axes nonzero */
function mockVectorize(_text: string): Vector6D {
  return [0.5, 0.4, 0.3, 0.1, 0.2, 0.1];
}

/** Mock vectorizer that returns a zero D axis */
function mockVectorizeZeroD(_text: string): Vector6D {
  return [0, 0.4, 0.3, 0.1, 0.2, 0.1];
}

/**
 * Build a minimal mock library with known domain distributions for predicate tests.
 */
function makeMockLibrary(motifs: Array<{
  id: string;
  domains: string[];
  indicators: string[];
}>): MotifLibrary {
  return {
    version: "test",
    motifs: motifs.map((m) => ({
      id: m.id,
      name: m.id,
      composition: "D(I)",
      tier: 1,
      domains: m.domains,
      indicators: m.indicators,
      primary_axis: "differentiate" as const,
    })),
  };
}

describe("S4 Evaluator", () => {
  // ISC-S41: evaluate({ text }) returns all fields
  test("ISC-S41: evaluate({ text }) returns all fields (predicates c/i/d, volume, stable, non_degenerate)", () => {
    const result = evaluate(
      { text: "state machine finite state transition guard condition" },
      sampleLibrary,
      mockVectorize,
    );

    // Structure checks
    expect(result).toHaveProperty("predicates");
    expect(result.predicates).toHaveProperty("c");
    expect(result.predicates).toHaveProperty("i");
    expect(result.predicates).toHaveProperty("d");
    expect(result.predicates.c).toHaveProperty("pass");
    expect(result.predicates.c).toHaveProperty("score");
    expect(result.predicates.c).toHaveProperty("threshold");
    expect(result.predicates.c).toHaveProperty("detail");
    expect(typeof result.volume).toBe("number");
    expect(typeof result.stable).toBe("boolean");
    expect(typeof result.non_degenerate).toBe("boolean");
  });

  // ISC-S42: predicateC returns pass=true when candidate appears in >= 3 domains
  test("ISC-S42: predicateC pass=true when candidate appears in >= 3 domains", () => {
    const lib = makeMockLibrary([
      { id: "m1", domains: ["software", "biology"], indicators: ["alpha", "beta"] },
      { id: "m2", domains: ["economics"], indicators: ["alpha", "gamma"] },
      { id: "m3", domains: ["law", "governance"], indicators: ["alpha", "delta"] },
    ]);
    // "alpha" appears in motifs spanning software, biology, economics, law, governance = 5 domains
    const result = predicateC(["alpha"], lib, 3);
    expect(result.pass).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(3);
  });

  // ISC-S43: predicateC returns pass=false when candidate appears in < 3 domains
  test("ISC-S43: predicateC pass=false when candidate appears in < 3 domains", () => {
    const lib = makeMockLibrary([
      { id: "m1", domains: ["software"], indicators: ["alpha"] },
      { id: "m2", domains: ["software"], indicators: ["alpha", "beta"] },
    ]);
    // "alpha" only in "software" domain = 1
    const result = predicateC(["alpha"], lib, 3);
    expect(result.pass).toBe(false);
    expect(result.score).toBeLessThan(3);
  });

  // ISC-S44: predicateD returns pass=false when candidate matches existing motif (Jaccard > 0.8)
  test("ISC-S44: predicateD pass=false when candidate is near-duplicate (Jaccard > 0.8)", () => {
    const lib = makeMockLibrary([
      { id: "m1", domains: ["software"], indicators: ["a", "b", "c", "d", "e"] },
    ]);
    // Candidate shares 4/5 indicators with m1, plus 0 unique = Jaccard 4/5 = 0.8
    // Need > 0.8, so share 5/5: Jaccard = 5/5 = 1.0
    const result = predicateD(["a", "b", "c", "d", "e"], lib, 0.8);
    expect(result.pass).toBe(false);
    expect(result.score).toBeGreaterThan(0.8);
  });

  // ISC-S45: Volume check returns nonzero=false when any D/I/R axis is 0
  test("ISC-S45: volume check nonzero=false when any D/I/R axis is 0", () => {
    const zeroD: Vector6D = [0, 0.5, 0.3, 0.1, 0.2, 0.1];
    const zeroI: Vector6D = [0.5, 0, 0.3, 0.1, 0.2, 0.1];
    const zeroR: Vector6D = [0.5, 0.5, 0, 0.1, 0.2, 0.1];
    const allNonzero: Vector6D = [0.5, 0.4, 0.3, 0.1, 0.2, 0.1];

    expect(checkVolume(zeroD).nonzero).toBe(false);
    expect(checkVolume(zeroI).nonzero).toBe(false);
    expect(checkVolume(zeroR).nonzero).toBe(false);
    expect(checkVolume(allNonzero).nonzero).toBe(true);
    expect(checkVolume(allNonzero).volume).toBeCloseTo(0.5 * 0.4 * 0.3);
  });

  // ISC-S46: evaluate({ composition: "R(I)" }) returns stability result without text
  test("ISC-S46: evaluate({ composition: 'R(I)' }) returns stability result without text", () => {
    const result = evaluate({ composition: "R(I)" }, sampleLibrary);

    expect(typeof result.stable).toBe("boolean");
    expect(typeof result.non_degenerate).toBe("boolean");
    expect(typeof result.volume).toBe("number");
    expect(result.non_degenerate).toBe(true);
  });

  // ISC-S47: evaluate({}) with no inputs throws descriptive error
  test("ISC-S47: evaluate({}) with no inputs throws descriptive error", () => {
    expect(() => evaluate({}, sampleLibrary)).toThrow(
      /at least one of text, composition, or motif_id/i,
    );
  });

  // ISC-S48: evaluate({ thresholds: { c: 2 } }) applies override
  test("ISC-S48: threshold override — pass with c=2 where default c=3 would fail", () => {
    // Build library where candidate appears in exactly 2 domains
    const lib = makeMockLibrary([
      { id: "m1", domains: ["software"], indicators: ["alpha", "beta"] },
      { id: "m2", domains: ["biology"], indicators: ["alpha", "gamma"] },
    ]);

    // With default c=3, should fail (only 2 domains)
    const resultDefault = evaluate(
      { text: "alpha beta gamma" },
      lib,
      mockVectorize,
    );
    expect(resultDefault.predicates.c.pass).toBe(false);

    // With c=2, should pass
    const resultOverride = evaluate(
      { text: "alpha beta gamma", thresholds: { c: 2 } },
      lib,
      mockVectorize,
    );
    expect(resultOverride.predicates.c.pass).toBe(true);
  });
});

describe("Predicate helpers", () => {
  test("predicateI: average Jaccard >= threshold passes", () => {
    const lib = makeMockLibrary([
      { id: "m1", domains: ["software"], indicators: ["a", "b", "c"] },
      { id: "m2", domains: ["biology"], indicators: ["a", "b", "d"] },
    ]);
    // Candidate ["a", "b"] vs m1 ["a","b","c"]: intersection=2, union=3 -> 0.667
    // Candidate ["a", "b"] vs m2 ["a","b","d"]: intersection=2, union=3 -> 0.667
    // Average = 0.667, threshold 0.6 -> pass
    const result = predicateI(["a", "b"], lib, 0.6);
    expect(result.pass).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.6);
  });

  test("predicateP: detects substrate indicators absent in parent", () => {
    const result = predicateP(
      ["a", "b", "c", "substrate-only"],
      ["a", "b", "c"],
    );
    expect(result.pass).toBe(true);
    expect(result.score).toBeGreaterThan(0);
  });

  test("predicateP: fails when no unique substrate indicators", () => {
    const result = predicateP(["a", "b"], ["a", "b", "c"]);
    expect(result.pass).toBe(false);
    expect(result.score).toBe(0);
  });

  test("checkNonDegeneracy: standard compositions are non-degenerate", () => {
    expect(checkNonDegeneracy("D(I)")).toBe(true);
    expect(checkNonDegeneracy("R(I)")).toBe(true);
    expect(checkNonDegeneracy("I(D)")).toBe(true);
    expect(checkNonDegeneracy("D(D)")).toBe(true); // self-composition is valid
    expect(checkNonDegeneracy("R(R)")).toBe(true);
  });
});
