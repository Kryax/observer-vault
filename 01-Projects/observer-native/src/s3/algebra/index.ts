export { ALGEBRA_OPERATORS } from "./types.ts";

export type {
  AlgebraDecision,
  AlgebraOperator,
  AxisVector,
  CandidateRecord,
  ComparisonReport,
  ComparisonTargetSummary,
  EvidenceReference,
  InstanceRecord,
  MotifRecord,
  MotifRelationshipRecord,
  MotifSourceType,
  MotifTier,
} from "./types.ts";

export {
  CANDIDATE_FIXTURE,
  EXISTING_MOTIF_FIXTURE,
} from "./fixtures.ts";

export {
  extractMotifCandidatesFromSessionContent,
  evaluateCandidate,
  evaluateCandidateNote,
  loadNormalizedMotifLibrary,
  loadNormalizedMotifLibraryAsync,
} from "./engine.ts";

export { evaluateCodexRegression, loadCodexRegressionNote } from "./regression.ts";

export {
  normalizeCandidateNote,
  normalizeLibraryMotifMarkdown,
} from "./normalization.ts";

export {
  evaluatePredicateC,
  evaluatePredicateD,
  evaluatePredicateI,
  evaluateStabilization,
} from "./stabilization.ts";

export {
  ALGEBRA_DECISION_SET,
  collectCandidateEvidence,
  resolveDecision,
} from "./decision.ts";

export {
  DEFAULT_PROCESS_PATHOLOGY_THRESHOLD,
  detectCollapseReview,
} from "./collapse.ts";
