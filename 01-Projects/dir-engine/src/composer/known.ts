/**
 * Known composition table — empirically validated D/I/R compositions.
 *
 * Each entry maps a composition notation to its motif name, axis weights,
 * order, and stability status.
 */

export interface KnownComposition {
  notation: string;
  motif: string;
  axisWeights: [number, number, number]; // [D, I, R] weights
  order: number;
  stable: boolean;
}

// ─── First-order: all 9 pairwise compositions ─────────────────────
export const KNOWN_FIRST_ORDER: KnownComposition[] = [
  { notation: "D(D)", motif: "ESMB", axisWeights: [0.8, 0.1, 0.1], order: 1, stable: true },
  { notation: "D(I)", motif: "CPA", axisWeights: [0.6, 0.3, 0.1], order: 1, stable: true },
  { notation: "D(R)", motif: "BBWOP", axisWeights: [0.5, 0.1, 0.4], order: 1, stable: true },
  { notation: "I(D)", motif: "DSG", axisWeights: [0.3, 0.6, 0.1], order: 1, stable: true },
  { notation: "I(I)", motif: "Tier 3 gen", axisWeights: [0.1, 0.8, 0.1], order: 1, stable: true },
  { notation: "I(R)", motif: "CDRI", axisWeights: [0.1, 0.5, 0.4], order: 1, stable: true },
  { notation: "R(D)", motif: "Ratchet", axisWeights: [0.3, 0.1, 0.6], order: 1, stable: true },
  { notation: "R(I)", motif: "ISC", axisWeights: [0.1, 0.3, 0.6], order: 1, stable: true },
  { notation: "R(R)", motif: "OFL", axisWeights: [0.1, 0.1, 0.8], order: 1, stable: true },
];

// ─── Second-order and special compositions ─────────────────────────
export const KNOWN_SECOND_ORDER: KnownComposition[] = [
  { notation: "R(I(D))", motif: "Progressive Formalisation", axisWeights: [0.2, 0.3, 0.5], order: 2, stable: true },
  { notation: "D(I)⁻¹", motif: "Reconstruction Burden", axisWeights: [0.5, 0.3, 0.2], order: 1, stable: true },
  { notation: "D(R(R))", motif: "Metacognitive Steering", axisWeights: [0.4, 0.1, 0.5], order: 2, stable: true },
];

/** Combined lookup across all known tables. */
const ALL_KNOWN = [...KNOWN_FIRST_ORDER, ...KNOWN_SECOND_ORDER];
const KNOWN_INDEX = new Map<string, KnownComposition>(
  ALL_KNOWN.map((k) => [k.notation, k]),
);

/**
 * Look up a composition by notation string.
 * Returns undefined if the composition is not in the known table.
 */
export function lookup(notation: string): KnownComposition | undefined {
  return KNOWN_INDEX.get(notation);
}
