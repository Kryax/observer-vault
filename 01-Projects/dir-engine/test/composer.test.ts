import { describe, test, expect } from "bun:test";
import { parse, apply, order, isStable, volume } from "../src/composer/algebra.js";
import { compose } from "../src/composer/index.js";
import { KNOWN_FIRST_ORDER, KNOWN_SECOND_ORDER, lookup } from "../src/composer/known.js";
import type { CompositionExpression } from "../src/types/index.js";

// ─── ISC-S31: parse("R(I)") returns outer=R, inner=I, order=1 ─────
describe("S3 Composer — parse", () => {
  test("ISC-S31: parse('R(I)') returns outer=R, inner=I, order=1", () => {
    const expr = parse("R(I)");
    expect(expr.notation).toBe("R(I)");
    expect(expr.outer).toBe("R");
    expect(expr.inner).toBe("I");
    expect(expr.order).toBe(1);
    expect(expr.isApplied).toBe(false);
  });

  test("ISC-S31: parse primitives D, I, R as order 0", () => {
    const d = parse("D");
    expect(d.notation).toBe("D");
    expect(d.outer).toBe("D");
    expect(d.order).toBe(0);

    const i = parse("I");
    expect(i.outer).toBe("I");

    const r = parse("R");
    expect(r.outer).toBe("R");
  });

  // ─── ISC-S32: parse("R(I(D))") returns order=2 with nested inner ──
  test("ISC-S32: parse('R(I(D))') returns order=2 with nested inner", () => {
    const expr = parse("R(I(D))");
    expect(expr.notation).toBe("R(I(D))");
    expect(expr.outer).toBe("R");
    expect(expr.order).toBe(2);

    // inner should be a CompositionExpression for I(D)
    expect(typeof expr.inner).toBe("object");
    const inner = expr.inner as CompositionExpression;
    expect(inner.notation).toBe("I(D)");
    expect(inner.outer).toBe("I");
    expect(inner.inner).toBe("D");
    expect(inner.order).toBe(1);
  });

  test("ISC-S32: parse substrate notation P(D(D))", () => {
    const expr = parse("P(D(D))");
    expect(expr.outer).toBe("P");
    expect(expr.isApplied).toBe(true);
    expect(expr.order).toBe(2);
  });

  test("ISC-S32: parse inverse notation D(I)⁻¹", () => {
    const expr = parse("D(I)⁻¹");
    expect(expr.notation).toBe("D(I)⁻¹");
    expect(expr.outer).toBe("D");
    expect(expr.inner).toBe("I");
    expect(expr.order).toBe(1);
  });
});

// ─── ISC-S33: apply(D, I) returns notation "D(I)" ─────────────────
describe("S3 Composer — apply", () => {
  test("ISC-S33: apply(D, I) returns notation 'D(I)'", () => {
    const d = parse("D");
    const i = parse("I");
    const result = apply(d, i);
    expect(result.notation).toBe("D(I)");
    expect(result.outer).toBe("D");
    expect(result.inner).toBe("I");
    expect(result.order).toBe(1);
  });

  test("ISC-S33: apply(R, parse('I(D)')) returns 'R(I(D))' order 2", () => {
    const r = parse("R");
    const id = parse("I(D)");
    const result = apply(r, id);
    expect(result.notation).toBe("R(I(D))");
    expect(result.order).toBe(2);
  });
});

// ─── ISC-S34: commutator(D, I) returns both D(I) and I(D) ─────────
describe("S3 Composer — compose()", () => {
  test("ISC-S34: commutator returns both D(I) and I(D)", () => {
    const result = compose("D", "I", "commutator");
    // result.result should mention both orderings
    expect(result.notes.length).toBeGreaterThanOrEqual(1);
    // The commutator should reference both compositions
    const allText = [result.result, ...result.notes].join(" ");
    expect(allText).toContain("D(I)");
    expect(allText).toContain("I(D)");
  });

  test("ISC-S34: default apply operation works", () => {
    const result = compose("D", "I");
    expect(result.result).toBe("D(I)");
    expect(result.order).toBe(1);
    expect(result.stable).toBe(true);
  });

  test("ISC-S34: inverse operation annotates reversal cost", () => {
    const result = compose("D", "I", "inverse");
    expect(result.result).toBe("D(I)⁻¹");
    expect(result.notes.some((n) => n.toLowerCase().includes("reversal"))).toBe(true);
  });
});

// ─── ISC-S35: All 9 first-order compositions in known table ────────
describe("S3 Composer — known table", () => {
  test("ISC-S35: All 9 first-order compositions present", () => {
    expect(KNOWN_FIRST_ORDER).toHaveLength(9);

    const primitives = ["D", "I", "R"];
    for (const outer of primitives) {
      for (const inner of primitives) {
        const notation = `${outer}(${inner})`;
        const found = KNOWN_FIRST_ORDER.find((k) => k.notation === notation);
        expect(found).toBeDefined();
        expect(found!.order).toBe(1);
        expect(found!.axisWeights).toHaveLength(3);
      }
    }
  });

  test("ISC-S35: Known second-order compositions present", () => {
    expect(KNOWN_SECOND_ORDER.length).toBeGreaterThanOrEqual(3);
    const rid = KNOWN_SECOND_ORDER.find((k) => k.notation === "R(I(D))");
    expect(rid).toBeDefined();
    expect(rid!.motif).toBe("Progressive Formalisation");
  });

  test("ISC-S35: lookup finds known compositions", () => {
    const result = lookup("D(I)");
    expect(result).toBeDefined();
    expect(result!.motif).toBe("CPA");
  });
});

// ─── ISC-S36: isStable returns true for all 9 first-order ──────────
describe("S3 Composer — isStable", () => {
  test("ISC-S36: isStable returns true for all 9 first-order compositions", () => {
    for (const known of KNOWN_FIRST_ORDER) {
      const expr = parse(known.notation);
      expect(isStable(expr)).toBe(true);
    }
  });

  test("ISC-S36: isStable returns true for known second-order", () => {
    const expr = parse("R(I(D))");
    expect(isStable(expr)).toBe(true);
  });
});

// ─── ISC-S37: isStable returns false for degenerate ────────────────
describe("S3 Composer — degenerate detection", () => {
  test("ISC-S37: isStable returns false for degenerate composition (axis weight zero)", () => {
    // A composition not in the known table with unknown stability
    // We test via volume — degenerate means one axis is zero
    // We'll test by checking the compose() result for an unknown higher-order
    // For direct isStable testing, an unknown composition defaults to false
    const expr = parse("D(D(D))");
    expect(isStable(expr)).toBe(false);
  });

  test("ISC-S37: volume is zero for degenerate compositions", () => {
    // Unknown composition not in table returns volume 0
    const expr = parse("D(D(D))");
    expect(volume(expr)).toBe(0);
  });

  test("ISC-S37: volume for known composition is product of axis weights", () => {
    const expr = parse("D(I)");
    const v = volume(expr);
    // D(I) weights: [0.6, 0.3, 0.1] → 0.6 * 0.3 * 0.1 = 0.018
    expect(v).toBeCloseTo(0.018, 3);
  });
});

// ─── ISC-S38: Invalid notation throws descriptive error ────────────
describe("S3 Composer — error handling", () => {
  test("ISC-S38: Invalid notation throws descriptive error", () => {
    expect(() => parse("")).toThrow();
    expect(() => parse("X")).toThrow(/invalid/i);
    expect(() => parse("D(")).toThrow();
    expect(() => parse("D(X)")).toThrow(/invalid/i);
    expect(() => parse("(D)")).toThrow();
    expect(() => parse("DD")).toThrow();
    expect(() => parse("D(I)(R)")).toThrow();
  });

  test("ISC-S38: compose with invalid inputs throws", () => {
    expect(() => compose("X", "D")).toThrow();
    expect(() => compose("D", "Z")).toThrow();
  });
});
