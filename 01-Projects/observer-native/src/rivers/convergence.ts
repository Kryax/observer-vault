/**
 * R7 — Convergence Detection Engine
 *
 * Detects noun-stream, verb-stream, and cross-stream convergence.
 * ISC-R44 through ISC-R49.
 */

import type { PairedRecord } from './types.ts';
import type {
  ConvergenceThresholds,
  NounConvergenceEvent,
  VerbConvergenceEvent,
  CrossStreamConvergenceEvent,
  ConvergenceEvent,
} from './convergence-types.ts';
import { DEFAULT_THRESHOLDS } from './convergence-types.ts';

// ---------------------------------------------------------------------------
// Internal tracking structures
// ---------------------------------------------------------------------------

interface EntityTypeTracker {
  verbPatterns: Set<string>;
  domains: Set<string>;
  recordIds: string[];
}

interface ProcessShapeTracker {
  entityTypes: Set<string>;
  domains: Set<string>;
  recordIds: string[];
}

// ---------------------------------------------------------------------------
// Convergence Detection Engine
// ---------------------------------------------------------------------------

export class ConvergenceDetector {
  private readonly thresholds: ConvergenceThresholds;
  private readonly entityTypeMap: Map<string, EntityTypeTracker> = new Map();
  private readonly processShapeMap: Map<string, ProcessShapeTracker> = new Map();
  private readonly events: ConvergenceEvent[] = [];

  constructor(thresholds?: Partial<ConvergenceThresholds>) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  /**
   * Ingest a PairedRecord and check for convergence.
   * Returns any convergence events detected.
   */
  ingest(record: PairedRecord): ConvergenceEvent[] {
    const detected: ConvergenceEvent[] = [];

    // Track noun component
    if (record.noun) {
      let tracker = this.entityTypeMap.get(record.noun.entityType);
      if (!tracker) {
        tracker = { verbPatterns: new Set(), domains: new Set(), recordIds: [] };
        this.entityTypeMap.set(record.noun.entityType, tracker);
      }
      tracker.domains.add(record.noun.domain);
      tracker.recordIds.push(record.id);
      if (record.verb) {
        tracker.verbPatterns.add(record.verb.processShape);
      }
    }

    // Track verb component
    if (record.verb) {
      let tracker = this.processShapeMap.get(record.verb.processShape);
      if (!tracker) {
        tracker = { entityTypes: new Set(), domains: new Set(), recordIds: [] };
        this.processShapeMap.set(record.verb.processShape, tracker);
      }
      if (record.noun) {
        tracker.entityTypes.add(record.noun.entityType);
        tracker.domains.add(record.noun.domain);
      }
      tracker.recordIds.push(record.id);
    }

    // Check noun convergence (ISC-R44)
    if (record.noun) {
      const nounEvent = this.checkNounConvergence(record.noun.entityType);
      if (nounEvent) detected.push(nounEvent);
    }

    // Check verb convergence (ISC-R45)
    if (record.verb) {
      const verbEvent = this.checkVerbConvergence(record.verb.processShape);
      if (verbEvent) detected.push(verbEvent);
    }

    // Check cross-stream convergence (ISC-R46)
    if (record.noun && record.verb) {
      const crossEvent = this.checkCrossStreamConvergence(
        record.noun.entityType,
        record.verb.processShape,
      );
      if (crossEvent) detected.push(crossEvent);
    }

    this.events.push(...detected);
    return detected;
  }

  /**
   * ISC-R44: Noun-convergence when same entityType appears with
   * 3+ verb patterns across 2+ domains.
   */
  private checkNounConvergence(entityType: string): NounConvergenceEvent | null {
    const tracker = this.entityTypeMap.get(entityType);
    if (!tracker) return null;

    if (
      tracker.verbPatterns.size >= this.thresholds.minVerbPatterns &&
      tracker.domains.size >= this.thresholds.minDomains
    ) {
      return {
        type: 'noun',
        entityType,
        verbPatterns: [...tracker.verbPatterns],
        domains: [...tracker.domains],
        recordIds: tracker.recordIds,
        timestamp: new Date().toISOString(),
      };
    }
    return null;
  }

  /**
   * ISC-R45: Verb-convergence when same processShape appears across
   * 3+ entity types in 2+ domains.
   */
  private checkVerbConvergence(processShape: string): VerbConvergenceEvent | null {
    const tracker = this.processShapeMap.get(processShape);
    if (!tracker) return null;

    if (
      tracker.entityTypes.size >= this.thresholds.minEntityTypes &&
      tracker.domains.size >= this.thresholds.minDomains
    ) {
      return {
        type: 'verb',
        processShape,
        entityTypes: [...tracker.entityTypes],
        domains: [...tracker.domains],
        recordIds: tracker.recordIds,
        timestamp: new Date().toISOString(),
      };
    }
    return null;
  }

  /**
   * ISC-R46: Cross-stream convergence when noun and verb convergence co-occur.
   */
  private checkCrossStreamConvergence(
    entityType: string,
    processShape: string,
  ): CrossStreamConvergenceEvent | null {
    const nounEvent = this.checkNounConvergence(entityType);
    const verbEvent = this.checkVerbConvergence(processShape);

    if (nounEvent && verbEvent) {
      return {
        type: 'cross_stream',
        entityType,
        processShape,
        nounEvent,
        verbEvent,
        timestamp: new Date().toISOString(),
      };
    }
    return null;
  }

  /** Get all detected events. */
  getEvents(): readonly ConvergenceEvent[] {
    return this.events;
  }

  /** Get thresholds (ISC-R48). */
  getThresholds(): ConvergenceThresholds {
    return this.thresholds;
  }
}
