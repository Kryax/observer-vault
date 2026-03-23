#!/usr/bin/env bun
/**
 * Dataset Processor CLI — processes Pile shards through lexical motif filtering.
 *
 * Usage:
 *   bun src/index.ts process <shard-path> [options]
 */

import { Command } from "commander";
import { streamShard } from "./stream/shard-reader.ts";
import { filterDocument } from "./filter/lexical-engine.ts";
import { CandidateEmitter } from "./output/candidate-emitter.ts";

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

program.parse();
