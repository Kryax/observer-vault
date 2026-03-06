/**
 * S0 — Motif Reference Schema (PRD 3.0.6)
 *
 * How a motif is cited in an ISC criterion. Traces criteria back to
 * the generating motif and its structural properties.
 */

export type MotifAxis = "differentiate" | "integrate" | "recurse";

export interface MotifReference {
  motifName: string;
  motifTier: 0 | 1 | 2;
  primaryAxis: MotifAxis;
  derivativeOrder: number;
  generatingQuestion: string;
}
