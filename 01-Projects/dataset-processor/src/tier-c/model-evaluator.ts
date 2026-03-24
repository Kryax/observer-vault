/**
 * Tier C Model-Assisted Evaluation
 *
 * Uses the Anthropic SDK to evaluate candidates drawn from the priority buffer.
 * Each candidate is scored for motif match, axis classification, derivative order,
 * operator tags, and novel pattern detection. Typed verb-records are written to
 * the store upon successful evaluation.
 *
 * Budget tracking prevents runaway spend: daily token cap with automatic reset
 * at midnight UTC. Exponential backoff handles rate limiting.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { VerbRecord } from '../types/verb-record';
import type { PriorityBuffer } from '../buffer/priority-buffer';
import type { VerbRecordStore } from '../store/verb-record-store';
import { INDICATOR_SETS, type IndicatorSet } from '../filter/indicator-sets';

// ── Public interfaces ────────────────────────────────────────

export interface EvaluationResult {
  verbRecord: VerbRecord;
  tokensUsed: { input: number; output: number };
  evaluationDuration: number; // ms
}

export interface TierCConfig {
  model: string;
  dailyBudgetTokens: number;
  maxConcurrent: number;
  retryAttempts: number;
  retryBaseDelay: number; // ms
}

export interface BudgetState {
  tokensUsedToday: number;
  dailyBudget: number;
  evaluationsToday: number;
  budgetExhausted: boolean;
  resetAt: string; // ISO 8601, next midnight UTC
}

// ── Internal: structured response from model ────────────────

interface ModelResponse {
  structuralMatchConfidence: number;
  axis: 'differentiate' | 'integrate' | 'recurse';
  derivativeOrder: 0 | 1 | 2 | 3;
  operatorTags: string[];
  matchEvidence: string;
  isNovelPattern: boolean;
  processShape: string;
  temporalStructure: 'sequential' | 'concurrent' | 'cyclic' | 'recursive';
}

// ── Constants ────────────────────────────────────────────────

const DEFAULT_CONFIG: TierCConfig = {
  model: 'claude-sonnet-4-20250514',
  dailyBudgetTokens: 10_000_000,
  maxConcurrent: 3,
  retryAttempts: 3,
  retryBaseDelay: 1_000,
};

const VALID_OPERATORS = new Set([
  'constrain', 'buffer', 'gate', 'converge', 'diverge',
  'compose', 'decompose', 'observe', 'transform',
  'accumulate', 'ratchet', 'scaffold',
]);

const VALID_AXES = new Set(['differentiate', 'integrate', 'recurse']);
const VALID_DERIVATIVE_ORDERS = new Set([0, 1, 2, 3]);
const VALID_TEMPORAL = new Set(['sequential', 'concurrent', 'cyclic', 'recursive']);

// ── Helpers ──────────────────────────────────────────────────

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function nextMidnightUTC(): string {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return tomorrow.toISOString();
}

function lookupIndicatorSet(motifId: string): IndicatorSet | undefined {
  return INDICATOR_SETS.find((s) => s.motifId === motifId);
}

function buildMotifDescription(candidate: VerbRecord): string {
  const motifId = candidate.motifMatch?.motifId;
  if (!motifId) {
    return 'No candidate motif was identified during earlier tiers. Evaluate whether the passage describes a recognizable structural pattern.';
  }

  const set = lookupIndicatorSet(motifId);
  if (!set) {
    return `Candidate motif ID: ${motifId}. No structural description available in the indicator library.`;
  }

  const topIndicators = set.indicators
    .filter((i) => i.weight >= 0.6)
    .map((i) => i.term)
    .join(', ');

  return [
    `Candidate motif: ${set.motifName} (${set.motifId})`,
    `Tier: ${set.tier}, Axis: ${set.axis}, Derivative order: ${set.derivativeOrder}`,
    `Key structural indicators: ${topIndicators}`,
  ].join('\n');
}

function buildPrompt(candidate: VerbRecord): string {
  const motifSection = buildMotifDescription(candidate);

  return `You are evaluating a text passage for structural process patterns. Your job is to determine whether the passage exhibits a particular structural motif and to classify the process it describes.

## Source passage

${candidate.source.rawText}

## Candidate motif

${motifSection}

## Instructions

Evaluate the passage and produce a JSON object with these fields:

1. **structuralMatchConfidence** (number, 0.0-1.0): How well the passage structurally matches the candidate motif. 0.0 = no match, 1.0 = perfect structural match. Consider structural alignment, not surface keyword overlap.

2. **axis** (string, one of: "differentiate", "integrate", "recurse"): The primary structural axis of the process described.
   - differentiate: creating distinctions, boundaries, categories, decomposition
   - integrate: merging, converging, synthesizing, unifying
   - recurse: self-reference, feedback, meta-levels, self-modification

3. **derivativeOrder** (integer, 0-3): The order of structural change described.
   - 0: static structure, ground state
   - 1: first-order change (things moving, transforming)
   - 2: second-order change (rules changing, meta-level shifts)
   - 3: third-order change (generative, self-creating structures)

4. **operatorTags** (array of strings): One or more from this vocabulary: constrain, buffer, gate, converge, diverge, compose, decompose, observe, transform, accumulate, ratchet, scaffold. Pick the operators that best describe what the process DOES structurally.

5. **matchEvidence** (string): 1-3 sentences explaining WHY the passage does or does not match the motif structurally. Reference specific phrases or structural features in the passage.

6. **isNovelPattern** (boolean): true if the passage describes a structural pattern that does NOT match the candidate motif well (confidence < 0.4) but IS structurally interesting — it describes a recognizable process shape that may represent an undiscovered motif.

7. **processShape** (string): 1-2 sentence structural description of the process the passage describes, independent of any motif. Describe the shape of the process, not its content.

8. **temporalStructure** (string, one of: "sequential", "concurrent", "cyclic", "recursive"): The temporal shape of the process.

Respond with ONLY a valid JSON object. No markdown fences, no commentary.`;
}

function parseModelResponse(raw: string): ModelResponse {
  // Strip markdown fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  const parsed = JSON.parse(cleaned) as Record<string, unknown>;

  // Validate and coerce fields
  const confidence = Number(parsed.structuralMatchConfidence);
  if (isNaN(confidence) || confidence < 0 || confidence > 1) {
    throw new Error(`Invalid structuralMatchConfidence: ${parsed.structuralMatchConfidence}`);
  }

  const axis = String(parsed.axis);
  if (!VALID_AXES.has(axis)) {
    throw new Error(`Invalid axis: ${axis}`);
  }

  const derivativeOrder = Number(parsed.derivativeOrder);
  if (!VALID_DERIVATIVE_ORDERS.has(derivativeOrder)) {
    throw new Error(`Invalid derivativeOrder: ${derivativeOrder}`);
  }

  const rawTags = parsed.operatorTags;
  if (!Array.isArray(rawTags) || rawTags.length === 0) {
    throw new Error('operatorTags must be a non-empty array');
  }
  const operatorTags = (rawTags as string[]).filter((t) => VALID_OPERATORS.has(t));
  if (operatorTags.length === 0) {
    throw new Error(`No valid operator tags found in: ${JSON.stringify(rawTags)}`);
  }

  const matchEvidence = String(parsed.matchEvidence || '');
  if (!matchEvidence) {
    throw new Error('matchEvidence is required');
  }

  const isNovelPattern = Boolean(parsed.isNovelPattern);

  const processShape = String(parsed.processShape || '');
  if (!processShape) {
    throw new Error('processShape is required');
  }

  const temporalStructure = String(parsed.temporalStructure);
  if (!VALID_TEMPORAL.has(temporalStructure)) {
    throw new Error(`Invalid temporalStructure: ${temporalStructure}`);
  }

  return {
    structuralMatchConfidence: confidence,
    axis: axis as ModelResponse['axis'],
    derivativeOrder: derivativeOrder as ModelResponse['derivativeOrder'],
    operatorTags,
    matchEvidence,
    isNovelPattern,
    processShape,
    temporalStructure: temporalStructure as ModelResponse['temporalStructure'],
  };
}

function applyEvaluation(candidate: VerbRecord, evaluation: ModelResponse): VerbRecord {
  const now = new Date().toISOString();

  return {
    ...candidate,
    stage: 'typed',
    process: {
      shape: evaluation.processShape,
      operators: evaluation.operatorTags,
      axis: evaluation.axis,
      derivativeOrder: evaluation.derivativeOrder,
      temporalStructure: evaluation.temporalStructure,
    },
    motifMatch: {
      motifId: candidate.motifMatch?.motifId ?? 'unknown',
      confidence: evaluation.structuralMatchConfidence,
      matchEvidence: evaluation.matchEvidence,
      isNovel: evaluation.isNovelPattern,
    },
    quality: {
      ...candidate.quality,
      tierCScore: evaluation.structuralMatchConfidence,
    },
    updatedAt: now,
  };
}

// ── Delay helper for backoff ────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Main class ───────────────────────────────────────────────

export class ModelEvaluator {
  private client: Anthropic;
  private config: TierCConfig;
  private tokensUsedToday: number = 0;
  private evaluationsToday: number = 0;
  private budgetDate: string;

  constructor(config: Partial<TierCConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.client = new Anthropic();
    this.budgetDate = todayUTC();
  }

  /**
   * Evaluate a single candidate and produce a typed verb-record.
   * Returns null if budget exhausted or evaluation fails after retries.
   */
  async evaluate(candidate: VerbRecord): Promise<EvaluationResult | null> {
    this.maybeResetBudget();

    if (this.isBudgetExhausted()) {
      return null;
    }

    const prompt = buildPrompt(candidate);
    const startTime = Date.now();

    for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {
      try {
        const response = await this.client.messages.create({
          model: this.config.model,
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        });

        // Track tokens
        const inputTokens = response.usage.input_tokens;
        const outputTokens = response.usage.output_tokens;
        this.tokensUsedToday += inputTokens + outputTokens;
        this.evaluationsToday += 1;

        // Extract text content
        const textBlock = response.content.find((b) => b.type === 'text');
        if (!textBlock || textBlock.type !== 'text') {
          throw new Error('No text block in model response');
        }

        const evaluation = parseModelResponse(textBlock.text);
        const typedRecord = applyEvaluation(candidate, evaluation);
        const duration = Date.now() - startTime;

        return {
          verbRecord: typedRecord,
          tokensUsed: { input: inputTokens, output: outputTokens },
          evaluationDuration: duration,
        };
      } catch (error: unknown) {
        const isRateLimit =
          error instanceof Anthropic.RateLimitError ||
          (error instanceof Error && /429|rate.limit/i.test(error.message));

        if (isRateLimit && attempt < this.config.retryAttempts - 1) {
          const backoffMs = this.config.retryBaseDelay * Math.pow(2, attempt);
          await delay(backoffMs);
          continue;
        }

        // Parse error (bad JSON from model) -- retry
        const isParseError = error instanceof SyntaxError ||
          (error instanceof Error && /Invalid|required|must be/i.test(error.message));

        if (isParseError && attempt < this.config.retryAttempts - 1) {
          await delay(this.config.retryBaseDelay);
          continue;
        }

        // Final attempt or non-retryable error
        if (attempt === this.config.retryAttempts - 1) {
          return null;
        }
      }
    }

    return null;
  }

  /**
   * Process N candidates from the priority buffer.
   * Draws from top, evaluates each, writes typed verb-records to store.
   */
  async processBatch(
    buffer: PriorityBuffer,
    store: VerbRecordStore,
    count: number,
  ): Promise<{ processed: number; succeeded: number; failed: number; tokensUsed: number }> {
    const candidates = buffer.dequeue(count);
    let succeeded = 0;
    let failed = 0;
    let totalTokens = 0;

    // Process with concurrency limit
    const concurrency = this.config.maxConcurrent;
    const chunks: VerbRecord[][] = [];
    for (let i = 0; i < candidates.length; i += concurrency) {
      chunks.push(candidates.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      if (this.isBudgetExhausted()) {
        failed += chunk.length;
        // Count remaining chunks too
        const remaining = chunks.slice(chunks.indexOf(chunk) + 1);
        for (const r of remaining) {
          failed += r.length;
        }
        break;
      }

      const results = await Promise.all(
        chunk.map((candidate) => this.evaluate(candidate)),
      );

      for (const result of results) {
        if (result) {
          store.insert(result.verbRecord);
          totalTokens += result.tokensUsed.input + result.tokensUsed.output;
          succeeded++;
        } else {
          failed++;
        }
      }
    }

    return {
      processed: candidates.length,
      succeeded,
      failed,
      tokensUsed: totalTokens,
    };
  }

  /** Get current budget state. */
  getBudgetState(): BudgetState {
    this.maybeResetBudget();
    return {
      tokensUsedToday: this.tokensUsedToday,
      dailyBudget: this.config.dailyBudgetTokens,
      evaluationsToday: this.evaluationsToday,
      budgetExhausted: this.isBudgetExhausted(),
      resetAt: nextMidnightUTC(),
    };
  }

  /** Reset daily budget (called at midnight UTC or manually). */
  resetBudget(): void {
    this.tokensUsedToday = 0;
    this.evaluationsToday = 0;
    this.budgetDate = todayUTC();
  }

  // ── Private ──────────────────────────────────────────────

  private isBudgetExhausted(): boolean {
    return this.tokensUsedToday >= this.config.dailyBudgetTokens;
  }

  private maybeResetBudget(): void {
    const today = todayUTC();
    if (this.budgetDate !== today) {
      this.resetBudget();
    }
  }
}
