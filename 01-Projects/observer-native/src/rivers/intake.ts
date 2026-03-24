/**
 * R2 — Intake River Implementation
 *
 * Carries material from external sources into Observer's processing pipeline.
 * Ephemeral per session. Dominant D/I/R: Distinguish.
 *
 * ISC-R10 through ISC-R16.
 */

import type { PairedRecord, DegenerateForm, RiverName } from './types.ts';
import type { River, RiverStateQuery, RouteDecision } from './river.ts';
import { classifyDegenerateForm } from './degenerate.ts';
import { IntakeBuffer } from './intake-buffer.ts';
import { TemplateMatcher } from './template-matcher.ts';
import type { TemplateMatchResult, MotifTemplate } from './template-matcher.ts';

// ---------------------------------------------------------------------------
// Intake River
// ---------------------------------------------------------------------------

export class IntakeRiver implements River {
  readonly name: RiverName = 'intake';
  private readonly buffer: IntakeBuffer;
  private readonly matcher: TemplateMatcher;
  private readonly outbox: PairedRecord[] = [];
  private readonly stageMap: Map<string, number> = new Map();

  constructor(
    templates: readonly MotifTemplate[] = [],
    blindExtractionRate: number = 0.10,
  ) {
    this.buffer = new IntakeBuffer();
    this.matcher = new TemplateMatcher(blindExtractionRate);
    this.matcher.setTemplates(templates);
  }

  /**
   * Accept a PairedRecord into the intake buffer. ISC-R10, ISC-R11, ISC-R14.
   */
  accept(record: PairedRecord): boolean {
    const accepted = this.buffer.accept(record);
    if (accepted) {
      this.incrementStage('buffered');
    }
    return accepted;
  }

  /**
   * Route a record based on template matching and degenerate form.
   * ISC-R12: Known templates → processing.
   * ISC-R13: Unknown → blind extraction path (10% valve).
   */
  route(record: PairedRecord): RouteDecision {
    const form = this.classify(record);

    // Degenerate forms route to pairing service
    if (form === 'noun_only' || form === 'verb_only') {
      return {
        target: 'pairing_service',
        channel: 'fast',
        reason: `Degenerate form: ${form} — routing to pairing service`,
      };
    }

    // Template matching
    const matchResult = this.matcher.match(record);

    if (matchResult.matched) {
      this.incrementStage('template_matched');
      return {
        target: 'processing',
        channel: 'fast',
        reason: `Template match: ${matchResult.templateId} (confidence: ${matchResult.confidence.toFixed(2)})`,
      };
    }

    // Blind extraction valve
    if (this.matcher.shouldBlindExtract()) {
      this.buffer.recordBlindExtraction();
      this.incrementStage('blind_extracted');
      return {
        target: 'processing',
        channel: 'slow',
        reason: 'Blind extraction — unknown material selected for processing',
      };
    }

    // Neither matched nor extracted — store for gap-directed retrieval
    this.incrementStage('stored_for_retrieval');
    return {
      target: 'store',
      channel: 'fast',
      reason: 'No template match, not selected for blind extraction',
    };
  }

  /**
   * Emit records that have completed intake processing.
   */
  emit(): readonly PairedRecord[] {
    const emitted = [...this.outbox];
    this.outbox.length = 0;
    return emitted;
  }

  /**
   * Process all buffered records: classify, route, stage for emission.
   * Returns route decisions for all processed records.
   */
  processBuffer(): Array<{ record: PairedRecord; decision: RouteDecision }> {
    const results: Array<{ record: PairedRecord; decision: RouteDecision }> = [];
    let record: PairedRecord | undefined;

    while ((record = this.buffer.dequeue()) !== undefined) {
      const decision = this.route(record);
      if (decision.target === 'processing' || decision.target === 'pairing_service') {
        this.outbox.push(record);
      }
      results.push({ record, decision });
    }

    return results;
  }

  /**
   * Query current state. ISC-R15, ISC-R16.
   */
  queryState(): RiverStateQuery {
    return {
      river: 'intake',
      bufferDepth: this.buffer.depth(),
      bufferCapacity: this.buffer.capacity(),
      recordCount: this.buffer.metrics().accepted,
      stageDistribution: Object.fromEntries(this.stageMap),
    };
  }

  /** Classify degenerate form. */
  classify(record: PairedRecord): DegenerateForm {
    return classifyDegenerateForm(record);
  }

  /** Get intake metrics. ISC-R16. */
  metrics() {
    return this.buffer.metrics();
  }

  /** Add a template at runtime. */
  addTemplate(template: MotifTemplate): void {
    this.matcher.addTemplate(template);
  }

  private incrementStage(stage: string): void {
    this.stageMap.set(stage, (this.stageMap.get(stage) ?? 0) + 1);
  }
}
