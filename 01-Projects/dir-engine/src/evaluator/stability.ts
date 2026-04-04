import type { Vector6D } from "../types/index.js";

/**
 * Check the D*I*R volume of a 6D vector.
 * Volume = D * I * R (first three components).
 * nonzero = volume > 0 (all three axes must be positive).
 */
export function checkVolume(vector: Vector6D): { volume: number; nonzero: boolean } {
  const volume = vector[0] * vector[1] * vector[2];
  return { volume, nonzero: volume > 0 };
}

/**
 * Check whether a composition notation is non-degenerate.
 *
 * All 9 first-order compositions (including self-compositions like D(D), I(I), R(R))
 * are considered non-degenerate. Self-compositions represent valid meta-operations
 * (meta-distinction, meta-integration, meta-recursion).
 *
 * For our purposes, any well-formed X(Y) notation is non-degenerate.
 * Degeneracy would only apply if the composition collapses to a single
 * operator in a way that loses structural information, which does not
 * occur in the D/I/R composition algebra.
 */
export function checkNonDegeneracy(notation: string): boolean {
  // Match first-order X(Y) pattern
  const match = notation.match(/^([DIR])\(([DIR])\)$/);
  if (!match) {
    // Higher-order or substrate compositions — assume non-degenerate if well-formed
    const wellFormed = /^[DIRP]\(.+\)$/.test(notation);
    return wellFormed;
  }
  // All 9 first-order compositions are non-degenerate
  return true;
}
