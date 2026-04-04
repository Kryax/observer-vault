/** 6-dimensional D/I/R vector: [D, I, R, temporal, density, entropy] */
export type Vector6D = [number, number, number, number, number, number];

export type PrimitiveOperator = "D" | "I" | "R";
export type SubstrateFunctor = "P";

export interface CompositionExpression {
  /** e.g. "D(I)", "R(I(D))", "P(D(D))" */
  notation: string;
  /** Outermost operator */
  outer: PrimitiveOperator | SubstrateFunctor;
  /** Inner operand (primitive or nested composition) */
  inner: PrimitiveOperator | CompositionExpression;
  /** Composition order: 1 for X(Y), 2 for X(Y(Z)), etc. */
  order: number;
  /** Whether this is a substrate-transformed variant */
  isApplied: boolean;
}

export interface ClassificationResult {
  vector: Vector6D;
  composition: string;
  confidence: number;
  space: "ideal" | "applied" | "unknown";
  axis: "differentiate" | "integrate" | "recurse";
  cluster_id: number;
}

export interface CompositionResult {
  result: string;
  order: number;
  stable: boolean;
  volume: number;
  notes: string[];
}

export interface PredicateResult {
  pass: boolean;
  score: number;
  threshold: number;
  detail: string;
}

export interface EvaluationResult {
  predicates: {
    c: PredicateResult;
    i: PredicateResult;
    d: PredicateResult;
    p?: PredicateResult;
  };
  volume: number;
  stable: boolean;
  non_degenerate: boolean;
}

export interface EngineStatus {
  centroids_loaded: boolean;
  centroid_version: string;
  vocabulary_size: number;
  compositions_covered: number;
  motifs_loaded: number;
  uptime_s: number;
}

export interface Indicator {
  term: string;
  weight: number;
  axis: 0 | 1 | 2;
}

export interface TemporalMarkers {
  sequential: string[];
  concurrent: string[];
  cyclic: string[];
  recursive: string[];
}

export interface CentroidManifest {
  version: string;
  k: number;
  dim: number;
  dim_names: string[];
  centroids: number[][];
  mapping: Record<string, string>;
}

export interface IndicatorVocabulary {
  version: string;
  indicators: Indicator[];
  temporal_markers: TemporalMarkers;
}

export interface MotifEntry {
  id: string;
  name: string;
  composition: string;
  tier: number;
  domains: string[];
  indicators: string[];
  primary_axis: "differentiate" | "integrate" | "recurse";
}

export interface MotifLibrary {
  version: string;
  motifs: MotifEntry[];
}
