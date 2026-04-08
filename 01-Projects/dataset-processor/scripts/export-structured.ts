#!/usr/bin/env bun
/**
 * Export all "structured" stage verb-records from all 30 shard databases
 * as paired JSONL for training data.
 *
 * Usage:
 *   bun scripts/export-structured.ts [--output <path>] [--include-amorphous]
 *
 * Default output: output/paired-structured-all.jsonl
 */

import { Database } from 'bun:sqlite';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const OUTPUT_DIR = resolve(import.meta.dir, '../output');
const args = process.argv.slice(2);

const includeAmorphous = args.includes('--include-amorphous');
const outputIdx = args.indexOf('--output');
const outputPath = outputIdx >= 0 && args[outputIdx + 1]
  ? resolve(args[outputIdx + 1])
  : resolve(OUTPUT_DIR, 'paired-structured-all.jsonl');

const stages = includeAmorphous
  ? ['structured', 'amorphous']
  : ['structured'];

const stageFilter = stages.map(s => `'${s}'`).join(',');

console.error(`[export] Exporting stages: ${stages.join(', ')}`);
console.error(`[export] Output: ${outputPath}`);

// Aggregated stats
let totalRecords = 0;
const axisCounts: Record<string, number> = {};
const motifCounts: Record<string, number> = {};
const componentCounts: Record<string, number> = {};
const stageCounts: Record<string, number> = {};
let shardCount = 0;

// Open output file
const sink = Bun.file(outputPath).writer();

for (let i = 0; i <= 29; i++) {
  const shard = String(i).padStart(2, '0');
  const dbPath = resolve(OUTPUT_DIR, `shard-${shard}.db`);

  if (!existsSync(dbPath)) {
    console.error(`[export] SKIP shard-${shard}: DB not found`);
    continue;
  }

  const db = new Database(dbPath, { readonly: true });
  shardCount++;

  const rows = db.prepare(`
    SELECT
      id, stage, process_shape, process_operators, process_axis,
      process_derivative_order, process_temporal_structure,
      source_dataset, source_component, source_document_id,
      source_char_start, source_char_end, source_content_hash, source_raw_text,
      motif_id, motif_confidence, motif_match_evidence, motif_is_novel,
      tier_a_score, tier_b_score, tier_c_score, extraction_method,
      domain, created_at, updated_at, extractor_version
    FROM verb_records
    WHERE stage IN (${stageFilter})
    ORDER BY tier_b_score DESC, tier_a_score DESC
  `).all() as any[];

  let shardExported = 0;

  for (const row of rows) {
    // Build paired record
    const paired = {
      source: row.source_raw_text,
      shard: shard,
      verb_record: {
        id: row.id,
        stage: row.stage,
        process: {
          shape: row.process_shape,
          operators: row.process_operators ? JSON.parse(row.process_operators) : [],
          axis: row.process_axis,
          derivativeOrder: row.process_derivative_order,
          temporalStructure: row.process_temporal_structure ?? undefined,
        },
        source: {
          dataset: row.source_dataset,
          component: row.source_component,
          documentId: row.source_document_id,
          charOffset: [row.source_char_start, row.source_char_end],
          contentHash: row.source_content_hash,
        },
        motifMatch: row.motif_id ? {
          motifId: row.motif_id,
          confidence: row.motif_confidence,
          matchEvidence: row.motif_match_evidence,
          isNovel: row.motif_is_novel === 1,
        } : undefined,
        quality: {
          tierAScore: row.tier_a_score,
          tierBScore: row.tier_b_score,
          tierCScore: row.tier_c_score ?? undefined,
          extractionMethod: row.extraction_method,
        },
        domain: row.domain,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        extractorVersion: row.extractor_version,
      },
    };

    sink.write(JSON.stringify(paired) + '\n');
    shardExported++;

    // Accumulate stats
    const axis = row.process_axis || 'unknown';
    axisCounts[axis] = (axisCounts[axis] || 0) + 1;

    const motif = row.motif_id || 'none';
    motifCounts[motif] = (motifCounts[motif] || 0) + 1;

    const component = row.source_component || 'unknown';
    componentCounts[component] = (componentCounts[component] || 0) + 1;

    const stage = row.stage || 'unknown';
    stageCounts[stage] = (stageCounts[stage] || 0) + 1;
  }

  totalRecords += shardExported;
  console.error(`[export] shard-${shard}: ${shardExported} records`);

  db.close();
}

await sink.end();

// Print report
console.error(`\n${'═'.repeat(60)}`);
console.error(`EXPORT COMPLETE`);
console.error(`${'═'.repeat(60)}`);
console.error(`Shards:          ${shardCount}`);
console.error(`Total records:   ${totalRecords.toLocaleString()}`);
console.error(`Output:          ${outputPath}`);

const fileSize = Bun.file(outputPath).size;
console.error(`File size:       ${(fileSize / 1024 / 1024).toFixed(1)} MB`);

console.error(`\nD/I/R Distribution:`);
const axisOrder = ['differentiate', 'integrate', 'recurse', 'unknown'];
for (const axis of axisOrder) {
  if (axisCounts[axis]) {
    const pct = ((axisCounts[axis] / totalRecords) * 100).toFixed(1);
    console.error(`  ${axis.padEnd(16)} ${axisCounts[axis].toLocaleString().padStart(8)}  (${pct}%)`);
  }
}

console.error(`\nStage Distribution:`);
for (const [stage, count] of Object.entries(stageCounts).sort((a, b) => b[1] - a[1])) {
  const pct = ((count / totalRecords) * 100).toFixed(1);
  console.error(`  ${stage.padEnd(16)} ${count.toLocaleString().padStart(8)}  (${pct}%)`);
}

console.error(`\nTop Source Components:`);
const sortedComponents = Object.entries(componentCounts).sort((a, b) => b[1] - a[1]);
for (const [comp, count] of sortedComponents.slice(0, 15)) {
  const pct = ((count / totalRecords) * 100).toFixed(1);
  console.error(`  ${comp.padEnd(24)} ${count.toLocaleString().padStart(8)}  (${pct}%)`);
}

console.error(`\nMotif Distribution:`);
const sortedMotifs = Object.entries(motifCounts).sort((a, b) => b[1] - a[1]);
for (const [motif, count] of sortedMotifs.slice(0, 20)) {
  const pct = ((count / totalRecords) * 100).toFixed(1);
  console.error(`  ${motif.padEnd(16)} ${count.toLocaleString().padStart(8)}  (${pct}%)`);
}
