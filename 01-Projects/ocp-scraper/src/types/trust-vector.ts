/**
 * Trust Vector -- 6-dimension trust representation
 * From Observer Commons Trust & Governance Framework
 */
export interface TrustVector {
  /** Total independent validations (uint, not capped) */
  validation_count: number;
  /** Diversity of validator origins (0.0 - 1.0) */
  validation_diversity: number;
  /** Range of contexts tested (0.0 - 1.0) */
  context_breadth: number;
  /** Consistency over time (0.0 - 1.0) */
  temporal_stability: number;
  /** Automated test evidence (0.0 - 1.0) */
  test_coverage: number;
  /** Completeness of docs (0.0 - 1.0) */
  documentation_quality: number;
  /** Search-as-validation: user confirmations that this solved their problem (0.0 - 1.0) */
  search_validation?: number;
}

/** CTS default weights from Trust Spec */
export const CTS_WEIGHTS = {
  validation_count: 0.25,
  validation_diversity: 0.30,
  context_breadth: 0.20,
  temporal_stability: 0.10,
  test_coverage: 0.10,
  documentation_quality: 0.05,
} as const;

/** Confidence levels from Trust Spec */
export type ConfidenceLevel =
  | 'speculative'
  | 'provisional'
  | 'tested'
  | 'proven'
  | 'foundational';
