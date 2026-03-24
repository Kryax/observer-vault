/**
 * R7 — Convergence Detection Types
 *
 * Types for noun-stream, verb-stream, and cross-stream convergence.
 */

// ---------------------------------------------------------------------------
// Convergence Thresholds (ISC-R48: configurable)
// ---------------------------------------------------------------------------

export interface ConvergenceThresholds {
  readonly minVerbPatterns: number;
  readonly minEntityTypes: number;
  readonly minDomains: number;
  readonly evidenceDecayDays: number;
}

export const DEFAULT_THRESHOLDS: ConvergenceThresholds = {
  minVerbPatterns: 3,
  minEntityTypes: 3,
  minDomains: 2,
  evidenceDecayDays: 90,
};

// ---------------------------------------------------------------------------
// Convergence Events
// ---------------------------------------------------------------------------

export type ConvergenceType = 'noun' | 'verb' | 'cross_stream';

export interface NounConvergenceEvent {
  readonly type: 'noun';
  readonly entityType: string;
  readonly verbPatterns: readonly string[];
  readonly domains: readonly string[];
  readonly recordIds: readonly string[];
  readonly timestamp: string;
}

export interface VerbConvergenceEvent {
  readonly type: 'verb';
  readonly processShape: string;
  readonly entityTypes: readonly string[];
  readonly domains: readonly string[];
  readonly recordIds: readonly string[];
  readonly timestamp: string;
}

export interface CrossStreamConvergenceEvent {
  readonly type: 'cross_stream';
  readonly entityType: string;
  readonly processShape: string;
  readonly nounEvent: NounConvergenceEvent;
  readonly verbEvent: VerbConvergenceEvent;
  readonly timestamp: string;
  readonly motifCandidateId?: string;
}

export type ConvergenceEvent =
  | NounConvergenceEvent
  | VerbConvergenceEvent
  | CrossStreamConvergenceEvent;
