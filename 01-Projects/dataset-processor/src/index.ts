#!/usr/bin/env bun
/**
 * Dataset Processor CLI — processes Pile shards through lexical motif filtering.
 *
 * Usage:
 *   bun src/index.ts process <shard-path> [options]
 *   bun src/index.ts orchestrate --shards <glob> --db <path> [options]
 */

import { Command } from "commander";
import { Glob } from "bun";
import { resolve } from "node:path";
import { streamShard } from "./stream/shard-reader.ts";
import { filterDocument } from "./filter/lexical-engine.ts";
import { CandidateEmitter } from "./output/candidate-emitter.ts";
import { Pipeline, DEFAULT_PIPELINE_CONFIG, type PipelineConfig } from "./orchestrator/pipeline.ts";

const program = new Command();

program
  .name("dataset-processor")
  .description("Process Pile shards through lexical motif filtering")
  .version("0.1.0");

program
  .command("process")
  .description("Process a shard, emit candidate passages as JSONL")
  .argument("<shard-path>", "Path to .jsonl.zst shard file")
  .option("--component <name>", "Filter to specific Pile component")
  .option("--max-docs <n>", "Limit documents processed", parseInt)
  .option("--output <path>", "Output file path (default: stdout)")
  .option("--min-score <n>", "Minimum motif score threshold", parseFloat, 0.3)
  .action(async (shardPath: string, opts: {
    component?: string;
    maxDocs?: number;
    output?: string;
    minScore: number;
  }) => {
    const startTime = performance.now();
    let docsProcessed = 0;
    let docsRejected = 0;

    const emitter = new CandidateEmitter(opts.output ?? null);
    await emitter.open();

    const stream = streamShard(shardPath, {
      componentFilter: opts.component,
      maxDocuments: opts.maxDocs,
    });

    for await (const { doc, lineNumber, shardPath: sPath } of stream) {
      docsProcessed++;

      const result = filterDocument(doc.text, opts.minScore);

      if (result.rejected) {
        docsRejected++;
        continue;
      }

      const documentId = CandidateEmitter.makeDocumentId(sPath, lineNumber);

      for (const candidate of result.candidates) {
        emitter.emit({
          sourceComponent: doc.meta.pile_set_name,
          documentId,
          charOffset: candidate.charOffset,
          rawText: candidate.text,
          motifScores: candidate.motifScores,
          topMotifId: candidate.topMotifId,
          topScore: candidate.topScore,
        });
      }

      // Progress report every 1000 docs to stderr
      if (docsProcessed % 1000 === 0) {
        const elapsed = (performance.now() - startTime) / 1000;
        const rate = Math.round(docsProcessed / elapsed * 3600);
        console.error(
          `[progress] ${docsProcessed} docs processed, ${emitter.getCount()} candidates, ${rate} docs/hr`
        );
      }
    }

    await emitter.close();

    const elapsed = (performance.now() - startTime) / 1000;
    const rate = Math.round(docsProcessed / elapsed * 3600);

    console.error(`[done] ${docsProcessed} docs processed in ${elapsed.toFixed(1)}s`);
    console.error(`[done] ${docsRejected} rejected, ${emitter.getCount()} candidates emitted`);
    console.error(`[done] Throughput: ${rate} docs/hr`);
  });

program
  .command("orchestrate")
  .description("Run multi-pass extraction pipeline with convergence detection")
  .requiredOption("--shards <glob>", "Glob pattern for .jsonl.zst shard files")
  .requiredOption("--db <path>", "Path to SQLite database file")
  .option("--motifs <path>", "Path to motif library directory", resolve("../../02-Knowledge/motifs"))
  .option("--template-cache <path>", "Path to template cache JSON file")
  .option("--output <dir>", "Output directory for paired JSONL exports", "./output")
  .option("--min-score <n>", "Tier A minimum motif score", parseFloat, 0.3)
  .option("--blind-fraction <n>", "Fraction of documents for blind extraction", parseFloat, 0.1)
  .option("--no-tier-b", "Disable Tier B (spaCy structural scoring)")
  .option("--no-tier-c", "Disable Tier C (model-assisted evaluation)")
  .option("--tier-c-model <model>", "Model for Tier C evaluation", "claude-sonnet-4-20250514")
  .option("--tier-c-budget <n>", "Daily token budget for Tier C", parseInt, 10_000_000)
  .option("--tier-c-batch <n>", "Batch size for Tier C evaluation", parseInt, 20)
  .option("--tier-b-batch <n>", "Batch size for Tier B processing", parseInt, 50)
  .option("--buffer-capacity <n>", "Priority buffer capacity", parseInt, 10_000)
  .option("--convergence <n>", "Convergence threshold (records per 10K docs)", parseFloat, 10)
  .option("--max-passes <n>", "Maximum number of passes", parseInt, 5)
  .option("--resume", "Resume a previously interrupted pipeline")
  .action(async (opts: {
    shards: string;
    db: string;
    motifs: string;
    templateCache?: string;
    output: string;
    minScore: number;
    blindFraction: number;
    tierB: boolean;
    tierC: boolean;
    tierCModel: string;
    tierCBudget: number;
    tierCBatch: number;
    tierBBatch: number;
    bufferCapacity: number;
    convergence: number;
    maxPasses: number;
    resume?: boolean;
  }) => {
    // Resolve shard glob to file paths
    const glob = new Glob(opts.shards);
    const shardPaths: string[] = [];
    for await (const path of glob.scan({ absolute: true })) {
      shardPaths.push(path);
    }
    shardPaths.sort();

    if (shardPaths.length === 0) {
      console.error(`[error] No shard files found matching: ${opts.shards}`);
      process.exit(1);
    }

    console.error(`[orchestrate] Found ${shardPaths.length} shard files`);

    const dbPath = resolve(opts.db);
    const templateCachePath = opts.templateCache ?? dbPath.replace(/\.sqlite3?$/, '') + '.templates.json';

    const config: PipelineConfig = {
      dbPath,
      motifLibraryPath: resolve(opts.motifs),
      shardPaths,
      templateCachePath,
      tierA: {
        minScore: opts.minScore,
        blindExtractionFraction: opts.blindFraction,
      },
      tierB: {
        enabled: opts.tierB !== false,
        spacyModel: 'en_core_web_md',
        batchSize: opts.tierBBatch,
      },
      tierC: {
        enabled: opts.tierC !== false,
        model: opts.tierCModel,
        dailyBudgetTokens: opts.tierCBudget,
        batchSize: opts.tierCBatch,
      },
      bufferCapacity: opts.bufferCapacity,
      bufferExpiryHours: 72,
      convergenceThreshold: opts.convergence,
      maxPasses: opts.maxPasses,
      outputDir: resolve(opts.output),
    };

    const pipeline = new Pipeline(config);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      pipeline.stop();
    });
    process.on('SIGTERM', () => {
      pipeline.stop();
    });

    const state = opts.resume
      ? await pipeline.resume()
      : await pipeline.run();

    console.error(`\n[orchestrate] Pipeline ${state.stoppedReason}`);
    console.error(`[orchestrate] Passes: ${state.passes.length}, Total verb-records: ${state.totalVerbRecords}`);
    for (const pass of state.passes) {
      console.error(
        `  Pass ${pass.passNumber}: ${pass.documentsProcessed} docs, ` +
        `${pass.tierACandidates} Tier-A, ${pass.tierBCandidates} Tier-B, ` +
        `${pass.tierCEvaluated} Tier-C, ${pass.verbRecordsCreated} records, ` +
        `yield=${pass.marginalYield.toFixed(1)}/10K`,
      );
    }
  });

program.parse();
