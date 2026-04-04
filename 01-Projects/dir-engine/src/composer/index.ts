/**
 * S3 Composer — main compose() entry point.
 *
 * Composes two D/I/R primitives or expressions using one of three operations:
 *   - "apply" (default): a(b) first-order composition
 *   - "commutator": [a,b] — both a(b) and b(a) with difference notes
 *   - "inverse": a(b)⁻¹ — annotates reversal cost
 */

import type { CompositionResult } from "../types/index.js";
import { parse, apply, isStable, volume } from "./algebra.js";
import { lookup } from "./known.js";

export function compose(
  a: string,
  b: string,
  operation: "apply" | "commutator" | "inverse" = "apply",
): CompositionResult {
  // Parse both inputs — will throw on invalid notation
  const exprA = parse(a);
  const exprB = parse(b);

  switch (operation) {
    case "apply":
      return composeApply(a, b);

    case "commutator":
      return composeCommutator(a, b);

    case "inverse":
      return composeInverse(a, b);
  }
}

function composeApply(a: string, b: string): CompositionResult {
  const exprA = parse(a);
  const exprB = parse(b);
  const composed = apply(exprA, exprB);
  const stable = isStable(composed);
  const vol = volume(composed);
  const known = lookup(composed.notation);

  const notes: string[] = [];
  if (known) {
    notes.push(`Maps to motif: ${known.motif}`);
  }

  return {
    result: composed.notation,
    order: composed.order,
    stable,
    volume: vol,
    notes,
  };
}

function composeCommutator(a: string, b: string): CompositionResult {
  const exprA = parse(a);
  const exprB = parse(b);

  const ab = apply(exprA, exprB);
  const ba = apply(exprB, exprA);

  const abKnown = lookup(ab.notation);
  const baKnown = lookup(ba.notation);

  const abStable = isStable(ab);
  const baStable = isStable(ba);
  const abVol = volume(ab);
  const baVol = volume(ba);

  const notes: string[] = [
    `${ab.notation}: ${abKnown ? abKnown.motif : "unknown"} (volume=${abVol.toFixed(4)}, stable=${abStable})`,
    `${ba.notation}: ${baKnown ? baKnown.motif : "unknown"} (volume=${baVol.toFixed(4)}, stable=${baStable})`,
  ];

  if (abKnown && baKnown) {
    const volDiff = Math.abs(abVol - baVol);
    notes.push(`Volume difference: ${volDiff.toFixed(4)} — composition is ${volDiff < 0.001 ? "commutative" : "non-commutative"}`);
  }

  return {
    result: `[${ab.notation}, ${ba.notation}]`,
    order: Math.max(ab.order, ba.order),
    stable: abStable && baStable,
    volume: Math.max(abVol, baVol),
    notes,
  };
}

function composeInverse(a: string, b: string): CompositionResult {
  const exprA = parse(a);
  const exprB = parse(b);
  const composed = apply(exprA, exprB);

  const inverseNotation = `${composed.notation}⁻¹`;
  const known = lookup(inverseNotation);
  const forwardKnown = lookup(composed.notation);

  const notes: string[] = [
    `Reversal of ${composed.notation}`,
  ];

  if (known) {
    notes.push(`Known inverse: ${known.motif}`);
  } else if (forwardKnown) {
    notes.push(`Forward motif ${forwardKnown.motif} — reversal cost is non-trivial`);
  }

  const vol = known ? known.axisWeights[0] * known.axisWeights[1] * known.axisWeights[2] : volume(composed);

  return {
    result: inverseNotation,
    order: composed.order,
    stable: known ? known.stable : false,
    volume: vol,
    notes,
  };
}

export { parse, apply, isStable, volume, order } from "./algebra.js";
export { lookup, KNOWN_FIRST_ORDER, KNOWN_SECOND_ORDER } from "./known.js";
