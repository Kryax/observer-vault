#!/usr/bin/env bun
/**
 * Vectorize all 297,900 exported records using the fixed D/I/R vectorizer.
 * Reads paired-structured-all.jsonl, produces vectors_297k.jsonl.
 *
 * Usage: bun scripts/vectorize-shard-data.ts [--input <path>] [--output <path>]
 */

import { resolve } from "node:path";
import { vectorize } from "../src/vectorizer/index.ts";
import { loadVocabulary } from "../src/data/loader.ts";

const DATA_DIR = resolve(import.meta.dir, "..", "data");
const DEFAULT_INPUT = resolve(
  import.meta.dir,
  "../../dataset-processor/output/paired-structured-all.jsonl",
);
const DEFAULT_OUTPUT = resolve(DATA_DIR, "vectors_297k.jsonl");

const args = process.argv.slice(2);
const inputIdx = args.indexOf("--input");
const outputIdx = args.indexOf("--output");
const inputPath = inputIdx >= 0 ? resolve(args[inputIdx + 1]) : DEFAULT_INPUT;
const outputPath = outputIdx >= 0 ? resolve(args[outputIdx + 1]) : DEFAULT_OUTPUT;

console.error(`[vectorize] Input: ${inputPath}`);
console.error(`[vectorize] Output: ${outputPath}`);

const vocab = await loadVocabulary(resolve(DATA_DIR, "vocabulary.json"));
console.error(`[vectorize] Vocabulary: ${vocab.indicators.length} indicators`);

// Stream-process: read line by line, vectorize, write
const inputFile = Bun.file(inputPath);
const reader = inputFile.stream().getReader();
const decoder = new TextDecoder();
const sink = Bun.file(outputPath).writer();

let buffer = "";
let processed = 0;
let zeroVectors = 0;
const t0 = performance.now();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split("\n");
  buffer = lines.pop()!; // Keep incomplete last line in buffer

  for (const line of lines) {
    if (line.length === 0) continue;

    try {
      const record = JSON.parse(line);
      const text = record.source ?? "";
      const vec = vectorize(text, vocab);

      // Check for zero vector
      const isZero = vec.every((v: number) => v === 0);
      if (isZero) zeroVectors++;

      sink.write(JSON.stringify(vec) + "\n");
      processed++;

      if (processed % 10000 === 0) {
        const elapsed = (performance.now() - t0) / 1000;
        const rate = Math.round(processed / elapsed);
        console.error(
          `[vectorize] ${processed.toLocaleString()} records, ${rate} rec/s, ${zeroVectors} zero vectors`,
        );
      }
    } catch {
      // Skip malformed lines
    }
  }
}

// Process any remaining buffer
if (buffer.length > 0) {
  try {
    const record = JSON.parse(buffer);
    const text = record.source ?? "";
    const vec = vectorize(text, vocab);
    sink.write(JSON.stringify(vec) + "\n");
    processed++;
  } catch {
    // ignore
  }
}

await sink.end();

const elapsed = (performance.now() - t0) / 1000;
console.error(`\n[vectorize] Complete:`);
console.error(`  Records: ${processed.toLocaleString()}`);
console.error(`  Zero vectors: ${zeroVectors.toLocaleString()} (${((zeroVectors / processed) * 100).toFixed(1)}%)`);
console.error(`  Time: ${elapsed.toFixed(1)}s (${Math.round(processed / elapsed)} rec/s)`);
console.error(`  Output: ${outputPath}`);
