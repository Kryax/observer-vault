/**
 * R4 — Reflection River Implementation
 *
 * Carries meta-observations about Observer's own process.
 * Persistent as vault records. Dominant D/I/R: Recurse.
 * Bounded recursion: max 3 per session (configurable).
 *
 * ISC-R25 through ISC-R31.
 */

import type { PairedRecord, DegenerateForm, RiverName } from './types.ts';
import type { River, RiverStateQuery, RouteDecision } from './river.ts';
import { classifyDegenerateForm } from './degenerate.ts';
import { ReflectionBuffer } from './reflection-buffer.ts';
import { ReflectionStore } from './reflection-store.ts';
import type { ReflectionVaultRecord } from './reflection-store.ts';

// ---------------------------------------------------------------------------
// Reflection Output Types
// ---------------------------------------------------------------------------

export interface TemplateUpdateRecord {
  readonly type: 'template_update';
  readonly templateId: string;
  readonly changes: string;
  readonly reason: string;
}

export interface ConfigDeltaRecord {
  readonly type: 'config_delta';
  readonly target: 'intake' | 'processing';
  readonly delta: Record<string, unknown>;
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// Reflection River
// ---------------------------------------------------------------------------

export class ReflectionRiver implements River {
  readonly name: RiverName = 'reflection';
  private readonly buffer: ReflectionBuffer;
  private readonly store: ReflectionStore | null;
  private readonly outbox: PairedRecord[] = [];
  private readonly templateUpdates: TemplateUpdateRecord[] = [];
  private readonly configDeltas: ConfigDeltaRecord[] = [];
  private readonly stageMap: Map<string, number> = new Map();
  private readonly sessionId: string;

  constructor(
    sessionId: string,
    vaultRoot?: string,
    maxRecursionDepth: number = 3,
  ) {
    this.sessionId = sessionId;
    this.buffer = new ReflectionBuffer(maxRecursionDepth);
    this.store = vaultRoot ? new ReflectionStore(vaultRoot) : null;
  }

  /**
   * Accept a meta-observation. ISC-R25, ISC-R26.
   */
  accept(record: PairedRecord): boolean {
    const accepted = this.buffer.accept(record);
    if (accepted) {
      this.incrementStage('buffered');
    }
    return accepted;
  }

  /**
   * Route a reflection record.
   * ISC-R27: Template updates → intake.
   * ISC-R28: Config deltas → processing.
   */
  route(record: PairedRecord): RouteDecision {
    // Check if this generates a template update
    if (record.verb?.operators.includes('update_template')) {
      return {
        target: 'intake' as RiverName,
        channel: 'slow',
        reason: 'Template update — routes back to Intake',
      };
    }

    // Check if this generates a config delta
    if (record.verb?.operators.includes('update_config')) {
      return {
        target: 'processing' as RiverName,
        channel: 'slow',
        reason: 'Config delta — routes to Processing',
      };
    }

    // Default: store as vault record
    return {
      target: 'store',
      channel: 'slow',
      reason: 'Reflection observation stored',
    };
  }

  /** Emit processed reflection records. */
  emit(): readonly PairedRecord[] {
    const emitted = [...this.outbox];
    this.outbox.length = 0;
    return emitted;
  }

  /**
   * Process all buffered records. Persists to vault store.
   * Returns processing results.
   */
  processBuffer(): Array<{ record: PairedRecord; decision: RouteDecision }> {
    const results: Array<{ record: PairedRecord; decision: RouteDecision }> = [];
    let record: PairedRecord | undefined;

    while ((record = this.buffer.dequeue()) !== undefined) {
      const decision = this.route(record);

      // Persist to vault store. ISC-R29.
      if (this.store) {
        const vaultRecord: ReflectionVaultRecord = {
          id: record.id,
          type: this.classifyObservationType(record),
          sourceRecord: record,
          observation: record.verb?.processShape ?? record.noun?.description ?? '',
          sessionId: this.sessionId,
          timestamp: new Date().toISOString(),
        };
        this.store.write(vaultRecord);
      }

      // Route to outbox if it feeds back to another river
      if (decision.target === 'intake' || decision.target === 'processing') {
        if (this.buffer.canRecurse()) {
          this.buffer.incrementRecursion();
          this.outbox.push(record);
        }
        // ISC-R30: If recursion bound exceeded, don't emit (bounded recursion)
      }

      results.push({ record, decision });
    }

    return results;
  }

  /** Produce a template update record. ISC-R27. */
  emitTemplateUpdate(update: TemplateUpdateRecord): void {
    this.templateUpdates.push(update);
    this.buffer.recordTemplateUpdate();
    this.incrementStage('template_update');
  }

  /** Produce a config delta record. ISC-R28. */
  emitConfigDelta(delta: ConfigDeltaRecord): void {
    this.configDeltas.push(delta);
    this.buffer.recordConfigDelta();
    this.incrementStage('config_delta');
  }

  /** Get pending template updates. */
  getTemplateUpdates(): readonly TemplateUpdateRecord[] {
    return this.templateUpdates;
  }

  /** Get pending config deltas. */
  getConfigDeltas(): readonly ConfigDeltaRecord[] {
    return this.configDeltas;
  }

  /** Query state. ISC-R31. */
  queryState(): RiverStateQuery {
    return {
      river: 'reflection',
      bufferDepth: this.buffer.depth(),
      bufferCapacity: this.buffer.capacity(),
      recordCount: this.buffer.metrics().observationsCaptured,
      stageDistribution: Object.fromEntries(this.stageMap),
    };
  }

  classify(record: PairedRecord): DegenerateForm {
    return classifyDegenerateForm(record);
  }

  /** Get metrics. ISC-R31. */
  metrics() {
    return this.buffer.metrics();
  }

  /** Check if recursion is still allowed. */
  canRecurse(): boolean {
    return this.buffer.canRecurse();
  }

  private classifyObservationType(record: PairedRecord): ReflectionVaultRecord['type'] {
    if (record.verb?.operators.includes('update_template')) return 'template_update';
    if (record.verb?.operators.includes('update_config')) return 'config_delta';
    if (record.verb?.operators.includes('anomaly')) return 'anomaly_observation';
    return 'session_trace';
  }

  private incrementStage(stage: string): void {
    this.stageMap.set(stage, (this.stageMap.get(stage) ?? 0) + 1);
  }
}
