/**
 * Composition algebra — parse, apply, order, isStable, volume.
 *
 * Implements the structural algebra over D/I/R primitives.
 */

import type { CompositionExpression, PrimitiveOperator, SubstrateFunctor } from "../types/index.js";
import { lookup } from "./known.js";

const PRIMITIVES = new Set(["D", "I", "R"]);
const VALID_OUTER = new Set(["D", "I", "R", "P"]);

/**
 * Parse a composition notation string into a CompositionExpression.
 *
 * Valid forms:
 *   "D", "I", "R"           — primitives (order 0)
 *   "X(Y)"                  — first-order composition
 *   "X(Y(Z))"               — second-order composition
 *   "X(Y)⁻¹"                — inverse annotation
 *   "P(X(Y))"               — substrate functor (isApplied=true)
 */
export function parse(notation: string): CompositionExpression {
  if (!notation || notation.length === 0) {
    throw new Error("Invalid notation: empty string");
  }

  return parseExpr(notation);
}

function parseExpr(notation: string): CompositionExpression {
  // Strip inverse suffix for parsing, re-attach to notation
  let raw = notation;
  const hasInverse = raw.endsWith("⁻¹");
  if (hasInverse) {
    raw = raw.slice(0, -2); // "⁻¹" is 2 chars (U+207B U+00B9)
  }

  // Case 1: bare primitive — "D", "I", or "R"
  if (raw.length === 1) {
    if (!PRIMITIVES.has(raw)) {
      throw new Error(`Invalid notation: "${raw}" is not a valid primitive (expected D, I, or R)`);
    }
    return {
      notation,
      outer: raw as PrimitiveOperator,
      inner: raw as PrimitiveOperator, // self-reference for primitives
      order: 0,
      isApplied: false,
    };
  }

  // Must be X(...) form — validate structure
  if (raw.length < 4 || raw[1] !== "(" || raw[raw.length - 1] !== ")") {
    throw new Error(`Invalid notation: "${notation}" does not match pattern X(...)`)
  }

  const outer = raw[0];
  if (!VALID_OUTER.has(outer)) {
    throw new Error(`Invalid notation: "${outer}" is not a valid operator (expected D, I, R, or P)`);
  }

  // Extract inner content between first ( and matching )
  const innerStr = raw.slice(2, -1);
  if (!innerStr) {
    throw new Error(`Invalid notation: "${notation}" has empty inner expression`);
  }

  const isSubstrate = outer === "P";

  // Parse inner recursively
  let inner: PrimitiveOperator | CompositionExpression;
  if (innerStr.length === 1) {
    if (!PRIMITIVES.has(innerStr)) {
      throw new Error(`Invalid notation: inner "${innerStr}" is not a valid primitive`);
    }
    inner = innerStr as PrimitiveOperator;
  } else {
    inner = parseExpr(innerStr);
  }

  const innerOrder = typeof inner === "string" ? 0 : inner.order;

  return {
    notation,
    outer: (isSubstrate ? "P" : outer) as PrimitiveOperator | SubstrateFunctor,
    inner,
    order: innerOrder + 1,
    isApplied: isSubstrate,
  };
}

/**
 * Apply outer to inner, producing a new composed expression.
 */
export function apply(
  outer: CompositionExpression,
  inner: CompositionExpression,
): CompositionExpression {
  // Build notation: outer.outer + "(" + inner.notation + ")"
  const notation = `${outer.outer}(${inner.notation})`;
  const innerValue: PrimitiveOperator | CompositionExpression =
    inner.order === 0 ? (inner.outer as PrimitiveOperator) : inner;

  return {
    notation,
    outer: outer.outer,
    inner: innerValue,
    order: inner.order + 1,
    isApplied: outer.outer === "P",
  };
}

/**
 * Return the nesting depth (order) of a composition expression.
 */
export function order(expr: CompositionExpression): number {
  return expr.order;
}

/**
 * Determine whether a composition is stable.
 *
 * Stable if:
 * - It is one of the 9 known first-order compositions, OR
 * - It is a known second-order composition, OR
 * - It is a bare primitive (order 0)
 *
 * Unstable (false) if:
 * - Not in the known table (unknown composition)
 * - Any axis weight is zero (degenerate)
 */
export function isStable(expr: CompositionExpression): boolean {
  if (expr.order === 0) return true;

  const known = lookup(expr.notation);
  if (!known) return false;
  if (!known.stable) return false;

  // Check for degeneracy — any axis weight at zero
  const [d, i, r] = known.axisWeights;
  if (d === 0 || i === 0 || r === 0) return false;

  return true;
}

/**
 * Compute the volume of a composition: D_weight * I_weight * R_weight.
 *
 * Returns 0 for unknown compositions (not in the known table).
 */
export function volume(expr: CompositionExpression): number {
  const known = lookup(expr.notation);
  if (!known) return 0;

  const [d, i, r] = known.axisWeights;
  return d * i * r;
}
