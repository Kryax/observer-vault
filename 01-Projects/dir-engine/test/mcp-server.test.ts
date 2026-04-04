import { describe, test, expect, beforeAll } from "bun:test";
import { resolve } from "node:path";
import { Engine } from "../src/mcp/engine.js";

const DATA_DIR = resolve(import.meta.dir, "..", "data");

let engine: Engine;

beforeAll(async () => {
  engine = new Engine();
  await engine.init(DATA_DIR);
});

// ─── ISC-S52: Engine loads and exposes all operations ────────────────
describe("S5 Engine Integration", () => {
  test("ISC-S52: Engine loads artifacts and reports status", () => {
    const status = engine.getStatus();
    expect(status.centroids_loaded).toBe(true);
    expect(status.vocabulary_size).toBeGreaterThan(100);
    expect(status.compositions_covered).toBe(9);
    expect(status.motifs_loaded).toBeGreaterThan(0);
    expect(status.uptime_s).toBeGreaterThanOrEqual(0);
    expect(status.centroid_version).not.toBe("none");
  });

  // ─── ISC-S53: dir_classify with text ──────────────────────────────
  test("ISC-S53: classify with text returns valid result", () => {
    const result = engine.doClassify({
      text: "The state machine has explicit transitions with guard conditions. Each state is clearly bounded.",
    });
    expect(result.vector).toHaveLength(6);
    expect(result.composition).toBeTruthy();
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(["differentiate", "integrate", "recurse"]).toContain(result.axis);
    expect(["ideal", "applied", "unknown"]).toContain(result.space);
    expect(typeof result.cluster_id).toBe("number");
  });

  // ─── ISC-S53: dir_classify with vector ────────────────────────────
  test("ISC-S53: classify with vector returns valid result", () => {
    const result = engine.doClassify({
      vector: [0.8, 0.1, 0.1, 0.3, 0.5, 0.2],
    });
    expect(result.composition).toBeTruthy();
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.axis).toBe("differentiate"); // D-dominant vector
  });

  // ─── ISC-S54: dir_compose ─────────────────────────────────────────
  test("ISC-S54: compose returns valid result", () => {
    const result = engine.doCompose("D", "I");
    expect(result.result).toBe("D(I)");
    expect(result.order).toBe(1);
    expect(result.stable).toBe(true);
    expect(result.volume).toBeGreaterThan(0);
  });

  test("ISC-S54: compose commutator returns both orderings", () => {
    const result = engine.doCompose("D", "I", "commutator");
    expect(result.result).toContain("D(I)");
    expect(result.result).toContain("I(D)");
    expect(result.notes.length).toBeGreaterThanOrEqual(2);
  });

  // ─── ISC-S55: dir_evaluate ────────────────────────────────────────
  test("ISC-S55: evaluate with composition returns stability", () => {
    const result = engine.doEvaluate({ composition: "R(I)" });
    expect(typeof result.stable).toBe("boolean");
    expect(typeof result.non_degenerate).toBe("boolean");
    expect(result.predicates.c).toBeDefined();
  });

  test("ISC-S55: evaluate with text returns predicates", () => {
    const result = engine.doEvaluate({
      text: "This system uses idempotent convergence with self-healing reconciliation across multiple domains.",
    });
    expect(result.predicates.c).toBeDefined();
    expect(result.predicates.i).toBeDefined();
    expect(result.predicates.d).toBeDefined();
    expect(typeof result.volume).toBe("number");
  });

  // ─── ISC-S56: dir_status ──────────────────────────────────────────
  test("ISC-S56: status returns all fields with versions", () => {
    const status = engine.getStatus();
    expect(status.centroid_version).toMatch(/^\d{8}/);
    expect(typeof status.uptime_s).toBe("number");
  });

  // ─── ISC-S57: dir_energy returns real values (ungated) ─────────────
  test("ISC-S57: energy returns real values", () => {
    const result = engine.doEnergy({ composition: "D(I)" });
    expect(typeof result.energy).toBe("number");
    expect(result.energy).not.toBeNaN();
    expect(result.nearest_basin).toBe("D(I)");
    expect(result.gradient).toHaveLength(6);
    expect((result as any).gated).toBeUndefined();
  });

  // ─── ISC-S58: Error handling ──────────────────────────────────────
  test("ISC-S58: classify with invalid input throws", () => {
    expect(() => engine.doClassify({})).toThrow();
    expect(() => engine.doClassify({ text: "hi", vector: [1, 2, 3, 4, 5, 6] })).toThrow();
  });

  test("ISC-S58: compose with invalid notation throws", () => {
    expect(() => engine.doCompose("X", "Y")).toThrow();
  });

  test("ISC-S58: evaluate with no input throws", () => {
    expect(() => engine.doEvaluate({})).toThrow();
  });

  // ─── Full pipeline: text → classify → compose → evaluate ─────────
  test("Full pipeline integration", () => {
    // Classify a D-dominant text
    const classification = engine.doClassify({
      text: "The finite state machine uses guard conditions to enforce state transitions with explicit boundaries.",
    });
    expect(classification.axis).toBe("differentiate");

    // Compose the classified composition with another
    const composed = engine.doCompose(classification.composition.charAt(0), "I");
    expect(composed.result).toBeTruthy();

    // Evaluate the original text
    const evaluation = engine.doEvaluate({
      text: "The finite state machine uses guard conditions to enforce state transitions with explicit boundaries.",
    });
    expect(evaluation.predicates.c).toBeDefined();
  });
});
