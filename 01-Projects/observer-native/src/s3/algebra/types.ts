/**
 * S3 Algebra Engine — Foundation types
 *
 * Minimum viable algebraic engine entity model and closed vocabularies.
 */

import type { MotifAxis } from "../../s0/index.ts";

export const ALGEBRA_OPERATORS = [
  "rewrite",
  "align",
  "compress",
  "dissolve",
  "scaffold",
  "reconstitute",
  "branch",
  "gate",
  "buffer",
  "converge",
] as const;

export type AlgebraOperator = typeof ALGEBRA_OPERATORS[number];

export type AlgebraDecision =
  | "reject"
  | "hold_t0"
  | "auto_promote_t1"
  | "review_for_t2"
  | "collapse_review";

export type MotifSourceType =
  | "top-down"
  | "bottom-up"
  | "triangulated"
  | "session-derived";

export type MotifTier = 0 | 1 | 2 | 3;

export interface AxisVector {
  differentiate: number;
  integrate: number;
  recurse: number;
}

export interface EvidenceReference {
  recordId?: string;
  filePath?: string;
  section?: string;
  excerpt?: string;
  note?: string;
}

export interface MotifRelationshipRecord {
  kind: "complement" | "tension" | "composition" | "possible_derivation" | "overlap";
  targetMotif: string;
  note?: string;
}

export interface InstanceRecord {
  id: string;
  domain: string;
  sourceType: MotifSourceType;
  evidenceRefs: EvidenceReference[];
  operatorTags: AlgebraOperator[];
  structuralClaims: string[];
  invariants: string[];
  falsifiers: string[];
  primaryAxis?: MotifAxis;
}

export interface ComparisonTargetSummary {
  motifId: string;
  motifName: string;
  similarityScore: number;
  overlappingOperators: AlgebraOperator[];
  overlappingInvariants: string[];
  notes: string[];
}

export interface ComparisonReport {
  comparedAgainst: ComparisonTargetSummary[];
  strongestMatch: ComparisonTargetSummary | null;
  derivationConflict: boolean;
  reviewRequired: boolean;
  notes: string[];
}

export interface MotifRecord {
  id: string;
  name: string;
  tier: MotifTier;
  axisVector: AxisVector;
  derivativeOrder: number | string;
  sourceType: MotifSourceType;
  confidence: number;
  instances: InstanceRecord[];
  invariants: string[];
  falsifiers: string[];
  relationships: MotifRelationshipRecord[];
}

export interface CandidateRecord extends MotifRecord {
  comparisonReport: ComparisonReport;
  normalizationWarnings: string[];
}
