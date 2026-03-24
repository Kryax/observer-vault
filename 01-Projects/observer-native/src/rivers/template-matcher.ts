/**
 * R2 — Template Matcher for Intake Classification
 *
 * Matches incoming PairedRecords against known motif templates.
 * ISC-R12: Known-template material routes toward Processing.
 * ISC-R13: Unknown material routes to blind extraction (10% valve).
 */

import type { PairedRecord } from './types.ts';

// ---------------------------------------------------------------------------
// Template Definition
// ---------------------------------------------------------------------------

export interface MotifTemplate {
  readonly id: string;
  readonly name: string;
  readonly entityTypes: readonly string[];
  readonly processShapes: readonly string[];
  readonly operators: readonly string[];
  readonly domains: readonly string[];
}

// ---------------------------------------------------------------------------
// Match Result
// ---------------------------------------------------------------------------

export interface TemplateMatchResult {
  readonly matched: boolean;
  readonly templateId: string | null;
  readonly confidence: number;
  readonly matchType: 'entity_type' | 'process_shape' | 'operator' | 'domain' | 'none';
}

// ---------------------------------------------------------------------------
// Matcher
// ---------------------------------------------------------------------------

export class TemplateMatcher {
  private templates: MotifTemplate[] = [];
  private blindExtractionRate: number;
  private _callCount = 0;

  constructor(blindExtractionRate: number = 0.10) {
    this.blindExtractionRate = blindExtractionRate;
  }

  /** Register a template for matching. */
  addTemplate(template: MotifTemplate): void {
    this.templates.push(template);
  }

  /** Set all templates at once. */
  setTemplates(templates: readonly MotifTemplate[]): void {
    this.templates = [...templates];
  }

  /**
   * Match a PairedRecord against known templates.
   * Returns the best match or a null match if unknown.
   */
  match(record: PairedRecord): TemplateMatchResult {
    let bestMatch: TemplateMatchResult = {
      matched: false,
      templateId: null,
      confidence: 0,
      matchType: 'none',
    };

    for (const template of this.templates) {
      let score = 0;
      let matchType: TemplateMatchResult['matchType'] = 'none';

      // Check noun component
      if (record.noun) {
        if (template.entityTypes.includes(record.noun.entityType)) {
          score += 0.4;
          matchType = 'entity_type';
        }
        if (template.domains.includes(record.noun.domain)) {
          score += 0.1;
        }
      }

      // Check verb component
      if (record.verb) {
        if (template.processShapes.includes(record.verb.processShape)) {
          score += 0.3;
          if (matchType === 'none') matchType = 'process_shape';
        }
        const opOverlap = record.verb.operators.filter(
          (op) => template.operators.includes(op),
        ).length;
        if (opOverlap > 0) {
          score += Math.min(0.2, opOverlap * 0.05);
          if (matchType === 'none') matchType = 'operator';
        }
      }

      if (score > bestMatch.confidence) {
        bestMatch = {
          matched: score >= 0.3,
          templateId: template.id,
          confidence: score,
          matchType,
        };
      }
    }

    return bestMatch;
  }

  /**
   * Determine if a record should be blind-extracted.
   * ISC-R13: 10% valve for unknown material.
   */
  shouldBlindExtract(): boolean {
    this._callCount++;
    // Deterministic modulo-based extraction for testability
    return (this._callCount % Math.round(1 / this.blindExtractionRate)) === 0;
  }

  /** Get the blind extraction rate. */
  getBlindExtractionRate(): number {
    return this.blindExtractionRate;
  }

  /** Reset call counter (for testing). */
  resetCounter(): void {
    this._callCount = 0;
  }
}
