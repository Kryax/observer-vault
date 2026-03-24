/**
 * Recursive Multi-Pass Orchestrator
 *
 * Top-level pipeline that runs the full extraction process across multiple
 * passes with convergence-based termination. Each pass refines templates
 * from the results of previous passes, implementing a genuine feedback loop.
 *
 * Pass 1: Broad Tier A scan across gap-prioritized shards
 * Pass 2+: Full Tiers A+B+C with template refinement until convergence
 *
 * Convergence: terminates when marginal yield drops below threshold
 * (default: 10 new verb-records per 10K documents processed).
 *
 * ISC: S10-1 through S10-5
 */

import { Database } from 'bun:sqlite';
import { basename, join } from 'node:path';
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';

import { streamShard } from '../stream/shard-reader.ts';
import { filterDocument } from '../filter/lexical-engine.ts';
import { CandidateEmitter } from '../output/candidate-emitter.ts';
import { VerbRecordStore, generateVerbRecordId } from '../store/verb-record-store.ts';
import { runMigrations } from '../store/migrations.ts';
import {
  refreshTemplates,
  loadTemplateCache,
  saveTemplateCache,
} from '../template/motif-template-generator.ts';
import { SpacyBridge, type SpacyParseResult } from '../tier-b/spacy-bridge.ts';
import { scoreStructuralMatch } from '../tier-b/structural-scorer.ts';
import { PriorityBuffer } from '../buffer/priority-buffer.ts';
import { ModelEvaluator } from '../tier-c/model-evaluator.ts';
import { MotifGraph, type MotifMetadata } from '../graph/motif-graph.ts';
import { GapScorer } from '../sampling/gap-scorer.ts';
import { PairedExporter } from '../output/paired-exporter.ts';
import { INDICATOR_SETS } from '../filter/indicator-sets.ts';
import type { VerbRecord } from '../types/verb-record.ts';
import type { MotifTemplate } from '../types/motif-template.ts';

// ── Public interfaces ────────────────────────────────────────────────

export interface PipelineConfig {
  dbPath: string;
  motifLibraryPath: string;
  shardPaths: string[];
  templateCachePath: string;

  tierA: {
    minScore: number;
    blindExtractionFraction: number;
  };
  tierB: {
    enabled: boolean;
    spacyModel: string;
    batchSize: number;
  };
  tierC: {
    enabled: boolean;
    model: string;
    dailyBudgetTokens: number;
    batchSize: number;
  };

  bufferCapacity: number;
  bufferExpiryHours: number;

  convergenceThreshold: number;
  maxPasses: number;

  outputDir: string;
}

export interface PassStatistics {
  passNumber: number;
  documentsProcessed: number;
  tierACandidates: number;
  tierBCandidates: number;
  tierCEvaluated: number;
  verbRecordsCreated: number;
  marginalYield: number;
  templatesUpdated: number;
  graphEdgesCreated: number;
  duration: number;
}

export interface PipelineState {
  currentPass: number;
  passes: PassStatistics[];
  totalVerbRecords: number;
  converged: boolean;
  stoppedReason: 'converged' | 'max-passes' | 'budget-exhausted' | 'interrupted' | 'running';
}

// ── Default config ───────────────────────────────────────────────────

export const DEFAULT_PIPELINE_CONFIG: Omit<PipelineConfig, 'dbPath' | 'motifLibraryPath' | 'shardPaths' | 'templateCachePath' | 'outputDir'> = {
  tierA: {
    minScore: 0.3,
    blindExtractionFraction: 0.1,
  },
  tierB: {
    enabled: true,
    spacyModel: 'en_core_web_md',
    batchSize: 50,
  },
  tierC: {
    enabled: true,
    model: 'claude-sonnet-4-20250514',
    dailyBudgetTokens: 10_000_000,
    batchSize: 20,
  },
  bufferCapacity: 10_000,
  bufferExpiryHours: 72,
  convergenceThreshold: 10,
  maxPasses: 5,
};

// ── Internal helpers ─────────────────────────────────────────────────

const EXTRACTOR_VERSION = '0.10.0';

function stateFilePath(dbPath: string): string {
  return dbPath.replace(/\.sqlite3?$/, '') + '.pipeline-state.json';
}

function loadPipelineState(dbPath: string): PipelineState | null {
  const path = stateFilePath(dbPath);
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf-8');
    return JSON.parse(raw) as PipelineState;
  } catch {
    return null;
  }
}

function savePipelineState(dbPath: string, state: PipelineState): void {
  const path = stateFilePath(dbPath);
  writeFileSync(path, JSON.stringify(state, null, 2));
}

function shardIdFromPath(shardPath: string): string {
  return basename(shardPath, '.jsonl.zst');
}

function buildMotifMetadata(): MotifMetadata[] {
  return INDICATOR_SETS.map((s) => ({
    motifId: s.motifId,
    axis: s.axis,
    derivativeOrder: s.derivativeOrder,
  }));
}

// ── Pipeline class ───────────────────────────────────────────────────

export class Pipeline {
  private state: PipelineState;
  private stopRequested: boolean = false;

  // Lazily initialized subsystems
  private db: Database | null = null;
  private store: VerbRecordStore | null = null;
  private buffer: PriorityBuffer | null = null;
  private gapScorer: GapScorer | null = null;
  private motifGraph: MotifGraph | null = null;
  private spacyBridge: SpacyBridge | null = null;
  private modelEvaluator: ModelEvaluator | null = null;
  private templates: MotifTemplate[] = [];

  constructor(private config: PipelineConfig) {
    this.state = {
      currentPass: 0,
      passes: [],
      totalVerbRecords: 0,
      converged: false,
      stoppedReason: 'running',
    };
  }

  /**
   * Run the full multi-pass pipeline.
   */
  async run(): Promise<PipelineState> {
    this.stopRequested = false;
    this.state.stoppedReason = 'running';

    try {
      await this.initSubsystems();

      for (let pass = 1; pass <= this.config.maxPasses; pass++) {
        if (this.stopRequested) {
          this.state.stoppedReason = 'interrupted';
          break;
        }

        const stats = await this.runPass(pass);
        this.state.passes.push(stats);
        this.state.currentPass = pass;
        this.state.totalVerbRecords = this.getVerbRecordCount();

        savePipelineState(this.config.dbPath, this.state);

        console.error(
          `[pass ${pass}] done: ${stats.documentsProcessed} docs, ` +
          `${stats.verbRecordsCreated} new records, ` +
          `yield=${stats.marginalYield.toFixed(1)}/10K, ` +
          `${stats.duration}ms`,
        );

        // Convergence check
        if (stats.marginalYield < this.config.convergenceThreshold && pass >= 2) {
          this.state.converged = true;
          this.state.stoppedReason = 'converged';
          console.error(`[pipeline] Converged after pass ${pass} (yield ${stats.marginalYield.toFixed(1)} < ${this.config.convergenceThreshold})`);
          break;
        }

        // Budget exhaustion check (Tier C)
        if (this.config.tierC.enabled && this.modelEvaluator) {
          const budget = this.modelEvaluator.getBudgetState();
          if (budget.budgetExhausted) {
            this.state.stoppedReason = 'budget-exhausted';
            console.error(`[pipeline] Budget exhausted after pass ${pass}`);
            break;
          }
        }

        // Template refresh between passes
        if (pass < this.config.maxPasses) {
          const newTemplates = await refreshTemplates(
            this.config.motifLibraryPath,
            this.config.templateCachePath,
          );
          const templatesChanged = newTemplates.length !== this.templates.length;
          this.templates = newTemplates;
          if (templatesChanged) {
            console.error(`[pipeline] Templates refreshed: ${newTemplates.length} templates`);
          }

          // Re-score gaps with updated library state
          this.gapScorer!.refreshPriorities();
        }
      }

      if (this.state.stoppedReason === 'running') {
        this.state.stoppedReason = 'max-passes';
      }

      // Flush remaining buffer entries to the store (covers runs without Tier C)
      this.flushBufferToStore();

      // Checkpoint WAL so the pipeline's connection sees all store writes,
      // then save state with accurate totalVerbRecords
      this.checkpointWal();
      this.state.totalVerbRecords = this.getVerbRecordCount();
      savePipelineState(this.config.dbPath, this.state);

      // Final export
      await this.exportResults();

      return this.state;
    } finally {
      await this.shutdownSubsystems();
    }
  }

  /**
   * Run a single pass through available shards.
   */
  async runPass(passNumber: number): Promise<PassStatistics> {
    const startTime = performance.now();
    const stats: PassStatistics = {
      passNumber,
      documentsProcessed: 0,
      tierACandidates: 0,
      tierBCandidates: 0,
      tierCEvaluated: 0,
      verbRecordsCreated: 0,
      marginalYield: 0,
      templatesUpdated: 0,
      graphEdgesCreated: 0,
      duration: 0,
    };

    const db = this.db!;
    const store = this.store!;
    const buffer = this.buffer!;
    const gapScorer = this.gapScorer!;

    // Get verb-record count before pass for marginal yield calculation
    const recordsBefore = this.getVerbRecordCount();

    // Determine shard processing order via gap scorer
    const shardSchedule = this.prioritizeShards(passNumber);

    for (const shardPath of shardSchedule) {
      if (this.stopRequested) break;

      const shardId = shardIdFromPath(shardPath);

      // Skip if already processed in this pass
      if (this.isShardProcessed(shardId, passNumber)) {
        continue;
      }

      // Mark shard as running
      this.recordShardState(shardId, passNumber, 'running', 0, 0, 0);

      const shardStats = await this.processShard(shardPath, passNumber, stats);

      // Mark shard as completed
      this.recordShardState(
        shardId,
        passNumber,
        'completed',
        shardStats.docsProcessed,
        shardStats.candidates,
        shardStats.verbRecords,
      );
    }

    // Pass 2+: run Tier C evaluation from buffer
    if (passNumber >= 2 && this.config.tierC.enabled && this.modelEvaluator) {
      const bufferCount = buffer.count();
      if (bufferCount > 0) {
        const batchSize = Math.min(this.config.tierC.batchSize, bufferCount);
        const result = await this.modelEvaluator.processBatch(buffer, store, batchSize);
        stats.tierCEvaluated += result.processed;
        stats.verbRecordsCreated += result.succeeded;

        // Update graph with newly typed records
        const typedRecords = store.listByStage('typed', result.succeeded);
        for (const record of typedRecords) {
          this.updateGraph(record);
          stats.graphEdgesCreated++;
        }
      }
    }

    // Calculate marginal yield
    const recordsAfter = this.getVerbRecordCount();
    const newRecords = recordsAfter - recordsBefore;
    stats.verbRecordsCreated = newRecords;
    stats.marginalYield = stats.documentsProcessed > 0
      ? (newRecords / (stats.documentsProcessed / 10_000))
      : 0;

    stats.duration = Math.round(performance.now() - startTime);

    return stats;
  }

  /**
   * Resume a stopped/interrupted pipeline.
   */
  async resume(): Promise<PipelineState> {
    const saved = loadPipelineState(this.config.dbPath);
    if (saved) {
      this.state = saved;
      this.state.stoppedReason = 'running';
      console.error(`[pipeline] Resuming from pass ${this.state.currentPass}`);
    }

    this.stopRequested = false;

    try {
      await this.initSubsystems();

      const startPass = this.state.currentPass > 0 ? this.state.currentPass : 1;

      for (let pass = startPass; pass <= this.config.maxPasses; pass++) {
        if (this.stopRequested) {
          this.state.stoppedReason = 'interrupted';
          break;
        }

        const stats = await this.runPass(pass);
        // Find or append pass stats
        const existingIdx = this.state.passes.findIndex((p) => p.passNumber === pass);
        if (existingIdx >= 0) {
          // Merge: add to existing stats for resumed passes
          const existing = this.state.passes[existingIdx]!;
          existing.documentsProcessed += stats.documentsProcessed;
          existing.tierACandidates += stats.tierACandidates;
          existing.tierBCandidates += stats.tierBCandidates;
          existing.tierCEvaluated += stats.tierCEvaluated;
          existing.verbRecordsCreated += stats.verbRecordsCreated;
          existing.graphEdgesCreated += stats.graphEdgesCreated;
          existing.duration += stats.duration;
          // Recalculate marginal yield for merged stats
          existing.marginalYield = existing.documentsProcessed > 0
            ? (existing.verbRecordsCreated / (existing.documentsProcessed / 10_000))
            : 0;
        } else {
          this.state.passes.push(stats);
        }

        this.state.currentPass = pass;
        this.state.totalVerbRecords = this.getVerbRecordCount();
        savePipelineState(this.config.dbPath, this.state);

        console.error(
          `[pass ${pass}] done: ${stats.documentsProcessed} docs, ` +
          `${stats.verbRecordsCreated} new records, ` +
          `yield=${stats.marginalYield.toFixed(1)}/10K, ` +
          `${stats.duration}ms`,
        );

        // Convergence check
        if (stats.marginalYield < this.config.convergenceThreshold && pass >= 2) {
          this.state.converged = true;
          this.state.stoppedReason = 'converged';
          break;
        }

        // Budget check
        if (this.config.tierC.enabled && this.modelEvaluator) {
          const budget = this.modelEvaluator.getBudgetState();
          if (budget.budgetExhausted) {
            this.state.stoppedReason = 'budget-exhausted';
            break;
          }
        }

        // Refresh templates between passes
        if (pass < this.config.maxPasses) {
          this.templates = await refreshTemplates(
            this.config.motifLibraryPath,
            this.config.templateCachePath,
          );
          this.gapScorer!.refreshPriorities();
        }
      }

      if (this.state.stoppedReason === 'running') {
        this.state.stoppedReason = 'max-passes';
      }

      // Flush remaining buffer entries to the store (covers runs without Tier C)
      this.flushBufferToStore();

      // Checkpoint WAL so the pipeline's connection sees all store writes,
      // then save state with accurate totalVerbRecords
      this.checkpointWal();
      this.state.totalVerbRecords = this.getVerbRecordCount();
      savePipelineState(this.config.dbPath, this.state);

      await this.exportResults();
      return this.state;
    } finally {
      await this.shutdownSubsystems();
    }
  }

  /**
   * Get current pipeline state.
   */
  getState(): PipelineState {
    return { ...this.state };
  }

  /**
   * Stop the pipeline gracefully after current shard completes.
   */
  stop(): void {
    this.stopRequested = true;
    console.error('[pipeline] Stop requested -- finishing current shard...');
  }

  // ── Private: subsystem lifecycle ────────────────────────────────────

  private async initSubsystems(): Promise<void> {
    // Ensure output directory exists
    mkdirSync(this.config.outputDir, { recursive: true });

    // Database
    const dbDir = join(this.config.dbPath, '..');
    mkdirSync(dbDir, { recursive: true });

    this.db = new Database(this.config.dbPath);
    this.db.run('PRAGMA journal_mode=WAL');
    this.db.run('PRAGMA foreign_keys=ON');
    runMigrations(this.db);

    // Store (uses its own Database connection)
    this.store = new VerbRecordStore(this.config.dbPath);

    // Priority buffer
    this.buffer = new PriorityBuffer(
      this.db,
      this.config.bufferCapacity,
      this.config.bufferExpiryHours,
    );

    // Gap scorer
    this.gapScorer = new GapScorer(this.db);

    // Motif graph
    const motifMetadata = buildMotifMetadata();
    this.motifGraph = new MotifGraph(this.db, motifMetadata);

    // Templates
    this.templates = await refreshTemplates(
      this.config.motifLibraryPath,
      this.config.templateCachePath,
    );

    // Tier B: spaCy bridge
    if (this.config.tierB.enabled) {
      this.spacyBridge = new SpacyBridge(
        this.config.tierB.spacyModel,
      );
      try {
        await this.spacyBridge.start();
      } catch (err) {
        console.error(`[pipeline] Warning: spaCy bridge failed to start: ${err}`);
        this.spacyBridge = null;
      }
    }

    // Tier C: model evaluator
    if (this.config.tierC.enabled) {
      this.modelEvaluator = new ModelEvaluator({
        model: this.config.tierC.model,
        dailyBudgetTokens: this.config.tierC.dailyBudgetTokens,
      });
    }
  }

  private async shutdownSubsystems(): Promise<void> {
    if (this.spacyBridge) {
      await this.spacyBridge.shutdown();
      this.spacyBridge = null;
    }
    if (this.store) {
      this.store.close();
      this.store = null;
    }
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // ── Private: shard processing ──────────────────────────────────────

  private async processShard(
    shardPath: string,
    passNumber: number,
    stats: PassStatistics,
  ): Promise<{ docsProcessed: number; candidates: number; verbRecords: number }> {
    let docsProcessed = 0;
    let candidates = 0;
    let verbRecords = 0;

    const store = this.store!;
    const buffer = this.buffer!;
    const gapScorer = this.gapScorer!;

    // Batch collection for Tier B
    const tierBBatch: Array<{
      text: string;
      motifId: string;
      tierAScore: number;
      documentId: string;
      charOffset: [number, number];
      sourceComponent: string;
      contentHash: string;
      isBlind: boolean;
    }> = [];

    const stream = streamShard(shardPath);

    for await (const { doc, lineNumber, shardPath: sPath } of stream) {
      if (this.stopRequested) break;

      docsProcessed++;

      // Tier A: lexical filtering
      const result = filterDocument(doc.text, this.config.tierA.minScore);

      // Blind extraction: 10% chance, run without motif priming
      const isBlind = Math.random() < this.config.tierA.blindExtractionFraction;

      if (result.rejected && !isBlind) {
        continue;
      }

      const documentId = CandidateEmitter.makeDocumentId(sPath, lineNumber);
      const contentHash = new Bun.CryptoHasher('sha256').update(doc.text).digest('hex');

      // For blind extractions on rejected docs, create a minimal candidate
      const candidateList = result.rejected
        ? [{
            text: doc.text.slice(0, 4000),
            charOffset: [0, Math.min(doc.text.length, 4000)] as [number, number],
            motifScores: [],
            topMotifId: 'blind',
            topScore: 0,
          }]
        : result.candidates;

      for (const candidate of candidateList) {
        stats.tierACandidates++;
        candidates++;

        if (this.config.tierB.enabled && this.spacyBridge) {
          tierBBatch.push({
            text: candidate.text,
            motifId: candidate.topMotifId,
            tierAScore: candidate.topScore,
            documentId,
            charOffset: candidate.charOffset,
            sourceComponent: doc.meta.pile_set_name,
            contentHash,
            isBlind: isBlind && result.rejected,
          });

          // Process Tier B batch when full
          if (tierBBatch.length >= this.config.tierB.batchSize) {
            const batchResult = await this.processTierBBatch(tierBBatch, stats);
            verbRecords += batchResult;
            tierBBatch.length = 0;
          }
        } else {
          // No Tier B: enqueue directly to buffer with Tier A score only
          const verbRecord = this.buildAmorphousVerbRecord(
            candidate.text,
            documentId,
            candidate.charOffset,
            doc.meta.pile_set_name,
            contentHash,
            candidate.topMotifId,
            candidate.topScore,
            0,
            isBlind && result.rejected,
          );
          const gapRelevance = gapScorer.getGapRelevance(candidate.topMotifId);
          buffer.enqueue({
            id: verbRecord.id,
            verbRecord,
            tierBScore: candidate.topScore,
            gapRelevance,
            isBlindExtraction: isBlind && result.rejected,
          });
        }
      }

      // Progress report every 1000 docs
      if (docsProcessed % 1000 === 0) {
        console.error(
          `[pass ${passNumber}] ${shardIdFromPath(shardPath)}: ` +
          `${docsProcessed} docs, ${candidates} candidates`,
        );
      }
    }

    // Flush remaining Tier B batch
    if (tierBBatch.length > 0 && this.spacyBridge) {
      const batchResult = await this.processTierBBatch(tierBBatch, stats);
      verbRecords += batchResult;
    }

    // Run buffer maintenance (expire old entries)
    buffer.maintenance();

    return { docsProcessed, candidates, verbRecords };
  }

  private async processTierBBatch(
    batch: Array<{
      text: string;
      motifId: string;
      tierAScore: number;
      documentId: string;
      charOffset: [number, number];
      sourceComponent: string;
      contentHash: string;
      isBlind: boolean;
    }>,
    stats: PassStatistics,
  ): Promise<number> {
    if (!this.spacyBridge || batch.length === 0) return 0;

    let verbRecords = 0;
    const buffer = this.buffer!;
    const gapScorer = this.gapScorer!;

    try {
      const texts = batch.map((b) => b.text);
      const parseResults = await this.spacyBridge.processBatch(texts);

      for (const parse of parseResults) {
        const item = batch[parse.docIndex];
        if (!item) continue;

        const structural = scoreStructuralMatch(parse, item.motifId, item.text);

        if (structural.overallScore > 0) {
          stats.tierBCandidates++;

          const verbRecord = this.buildStructuredVerbRecord(
            item.text,
            item.documentId,
            item.charOffset,
            item.sourceComponent,
            item.contentHash,
            item.motifId,
            item.tierAScore,
            structural.overallScore,
            structural.processDescription,
            structural.operators,
            structural.temporalStructure,
            item.isBlind,
          );

          const gapRelevance = gapScorer.getGapRelevance(item.motifId);
          buffer.enqueue({
            id: verbRecord.id,
            verbRecord,
            tierBScore: structural.overallScore,
            gapRelevance,
            isBlindExtraction: item.isBlind,
          });

          verbRecords++;
        }
      }
    } catch (err) {
      console.error(`[tier-b] Batch processing error: ${err}`);
    }

    return verbRecords;
  }

  // ── Private: verb-record builders ──────────────────────────────────

  private buildAmorphousVerbRecord(
    text: string,
    documentId: string,
    charOffset: [number, number],
    sourceComponent: string,
    contentHash: string,
    motifId: string,
    tierAScore: number,
    tierBScore: number,
    isBlind: boolean,
  ): VerbRecord {
    const now = new Date().toISOString();
    const id = generateVerbRecordId(text, `${motifId}:${EXTRACTOR_VERSION}`);

    return {
      id,
      process: {
        shape: 'unanalyzed',
        operators: [],
        axis: this.guessAxis(motifId),
        derivativeOrder: this.guessOrder(motifId),
      },
      source: {
        dataset: 'the-pile',
        component: sourceComponent,
        documentId,
        charOffset,
        contentHash,
        rawText: text,
      },
      motifMatch: motifId !== 'blind' ? {
        motifId,
        confidence: tierAScore,
        matchEvidence: 'Tier A lexical match',
        isNovel: false,
      } : undefined,
      stage: 'amorphous',
      quality: {
        tierAScore,
        tierBScore,
        extractionMethod: isBlind ? 'blind' : 'primed',
      },
      domain: sourceComponent,
      createdAt: now,
      updatedAt: now,
      extractorVersion: EXTRACTOR_VERSION,
    };
  }

  private buildStructuredVerbRecord(
    text: string,
    documentId: string,
    charOffset: [number, number],
    sourceComponent: string,
    contentHash: string,
    motifId: string,
    tierAScore: number,
    tierBScore: number,
    processDescription: string,
    operators: string[],
    temporalStructure: 'sequential' | 'concurrent' | 'cyclic' | 'recursive' | undefined,
    isBlind: boolean,
  ): VerbRecord {
    const now = new Date().toISOString();
    const id = generateVerbRecordId(text, `${motifId}:${EXTRACTOR_VERSION}`);

    return {
      id,
      process: {
        shape: processDescription,
        operators,
        axis: this.guessAxis(motifId),
        derivativeOrder: this.guessOrder(motifId),
        temporalStructure,
      },
      source: {
        dataset: 'the-pile',
        component: sourceComponent,
        documentId,
        charOffset,
        contentHash,
        rawText: text,
      },
      motifMatch: motifId !== 'blind' ? {
        motifId,
        confidence: tierBScore,
        matchEvidence: `Tier B structural: ${processDescription}`,
        isNovel: false,
      } : undefined,
      stage: 'structured',
      quality: {
        tierAScore,
        tierBScore,
        extractionMethod: isBlind ? 'blind' : 'primed',
      },
      domain: sourceComponent,
      createdAt: now,
      updatedAt: now,
      extractorVersion: EXTRACTOR_VERSION,
    };
  }

  private guessAxis(motifId: string): 'differentiate' | 'integrate' | 'recurse' {
    const indicator = INDICATOR_SETS.find((s) => s.motifId === motifId);
    return indicator?.axis ?? 'differentiate';
  }

  private guessOrder(motifId: string): 0 | 1 | 2 | 3 {
    const indicator = INDICATOR_SETS.find((s) => s.motifId === motifId);
    if (!indicator) return 0;
    return Math.round(indicator.derivativeOrder) as 0 | 1 | 2 | 3;
  }

  // ── Private: graph updates ─────────────────────────────────────────

  private updateGraph(record: VerbRecord): void {
    if (!this.motifGraph) return;

    // Build motif scores from the record's source text
    const text = record.source.rawText.toLowerCase();
    const allMotifScores: Array<{ motifId: string; score: number }> = [];

    for (const indicatorSet of INDICATOR_SETS) {
      let weightedSum = 0;
      let maxWeight = 0;
      for (const ind of indicatorSet.indicators) {
        maxWeight += ind.weight;
        if (text.includes(ind.term)) {
          weightedSum += ind.weight;
        }
      }
      const score = maxWeight > 0 ? weightedSum / maxWeight : 0;
      if (score > 0) {
        allMotifScores.push({ motifId: indicatorSet.motifId, score });
      }
    }

    this.motifGraph.processVerbRecord(record, allMotifScores);
  }

  // ── Private: shard prioritization ──────────────────────────────────

  private prioritizeShards(passNumber: number): string[] {
    if (!this.gapScorer) return this.config.shardPaths;

    // Score components and sort shards by priority
    const priorities = this.gapScorer.scoreComponents();
    const componentPriority = new Map<string, number>();
    for (const p of priorities) {
      componentPriority.set(p.component, p.score);
    }

    // For now, just return all shards in the configured order.
    // In a production system, we would extract component from each shard
    // and sort by component priority. Since shard filenames don't encode
    // component info in The Pile, we process in order and let the gap scorer
    // influence candidate priority via the buffer.
    return [...this.config.shardPaths];
  }

  // ── Private: processing state tracking ─────────────────────────────

  private isShardProcessed(shardId: string, passNumber: number): boolean {
    if (!this.db) return false;

    const row = this.db.prepare(`
      SELECT status FROM processing_state
      WHERE dataset = 'the-pile' AND component = ? AND shard_id = ? AND tier = ?
    `).get('all', shardId, `pass-${passNumber}`) as { status: string } | null;

    return row?.status === 'completed';
  }

  private recordShardState(
    shardId: string,
    passNumber: number,
    status: 'running' | 'completed',
    docsProcessed: number,
    candidates: number,
    verbRecords: number,
  ): void {
    if (!this.db) return;

    const tier = `pass-${passNumber}`;

    if (status === 'running') {
      this.db.prepare(`
        INSERT OR REPLACE INTO processing_state
          (dataset, component, shard_id, tier, documents_processed, candidates_produced, verb_records_produced, status)
        VALUES ('the-pile', 'all', ?, ?, 0, 0, 0, 'running')
      `).run(shardId, tier);
    } else {
      this.db.prepare(`
        UPDATE processing_state
        SET documents_processed = ?, candidates_produced = ?, verb_records_produced = ?,
            status = 'completed', completed_at = datetime('now')
        WHERE dataset = 'the-pile' AND component = 'all' AND shard_id = ? AND tier = ?
      `).run(docsProcessed, candidates, verbRecords, shardId, tier);
    }
  }

  private getVerbRecordCount(): number {
    if (!this.db) return 0;
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM verb_records').get() as { cnt: number };
    return row.cnt;
  }

  /**
   * Force a WAL checkpoint so the pipeline's Database connection sees
   * all writes made by the VerbRecordStore's separate connection.
   */
  private checkpointWal(): void {
    if (!this.db) return;
    try {
      this.db.run('PRAGMA wal_checkpoint(PASSIVE)');
    } catch (err) {
      console.error(`[pipeline] WAL checkpoint failed: ${err}`);
    }
  }

  // ── Private: buffer flush ──────────────────────────────────────────

  /**
   * Flush all remaining buffer entries into the verb-record store.
   * This ensures records are persisted even when Tier C is disabled.
   */
  private flushBufferToStore(): void {
    if (!this.buffer || !this.store) return;

    const bufferCount = this.buffer.count();
    if (bufferCount === 0) return;

    let flushed = 0;
    // Drain the buffer in batches
    const records = this.buffer.dequeue(bufferCount);
    for (const record of records) {
      try {
        this.store.insert(record);
        flushed++;
      } catch {
        // Skip duplicates (content-addressed IDs)
      }
    }

    if (flushed > 0) {
      console.error(`[pipeline] Flushed ${flushed} buffered records to store`);
      this.state.totalVerbRecords = this.getVerbRecordCount();
    }
  }

  // ── Private: export ────────────────────────────────────────────────

  private async exportResults(): Promise<void> {
    if (!this.store) return;

    const exporter = new PairedExporter(this.store);
    const outputPath = join(this.config.outputDir, 'paired-output.jsonl');

    try {
      const count = await exporter.exportToFile(outputPath, {
        stages: ['typed', 'crystallized'],
      });
      console.error(`[pipeline] Exported ${count} paired records to ${outputPath}`);
    } catch (err) {
      console.error(`[pipeline] Export failed: ${err}`);
    }
  }
}
