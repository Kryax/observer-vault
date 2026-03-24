#!/usr/bin/env bun
/**
 * Ingest bridge — hydrates VerbRecordStore SQLite DB from candidates JSONL.
 *
 * Maps candidate fields to verb_records schema so governance can run.
 * One-off script; not part of the main pipeline.
 *
 * Usage:
 *   bun scripts/ingest-candidates.ts <candidates.jsonl> <output.db>
 */

import { Database } from 'bun:sqlite';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { runMigrations } from '../src/store/migrations.ts';

const [candidatesPath, dbPath] = Bun.argv.slice(2);
if (!candidatesPath || !dbPath) {
  console.error('Usage: bun scripts/ingest-candidates.ts <candidates.jsonl> <output.db>');
  process.exit(1);
}

// ── Setup DB ────────────────────────────────────────────────────────
const db = new Database(dbPath);
db.run('PRAGMA journal_mode=WAL');
db.run('PRAGMA foreign_keys=ON');
db.run('PRAGMA synchronous=NORMAL');
runMigrations(db);

// ── Prepare insert statement ────────────────────────────────────────
const insert = db.prepare(`
  INSERT OR IGNORE INTO verb_records (
    id, stage, process_shape, process_operators, process_axis,
    process_derivative_order, process_temporal_structure,
    source_dataset, source_component, source_document_id,
    source_char_start, source_char_end, source_content_hash, source_raw_text,
    motif_id, motif_confidence, motif_match_evidence, motif_is_novel,
    tier_a_score, tier_b_score, tier_c_score,
    extraction_method, domain, extractor_version
  ) VALUES (
    $id, $stage, $shape, $operators, $axis,
    $derivativeOrder, $temporalStructure,
    $dataset, $component, $documentId,
    $charStart, $charEnd, $contentHash, $rawText,
    $motifId, $motifConfidence, $matchEvidence, $isNovel,
    $tierAScore, $tierBScore, $tierCScore,
    $extractionMethod, $domain, $extractorVersion
  )
`);

// ── Derive domain from Pile component ───────────────────────────────
const COMPONENT_DOMAIN: Record<string, string> = {
  'PubMed Central': 'biomedical',
  'PubMed Abstracts': 'biomedical',
  'FreeLaw': 'legal',
  'USPTO Backgrounds': 'engineering',
  'Pile-CC': 'general',
  'Wikipedia (en)': 'encyclopedia',
  'ArXiv': 'science',
  'Github': 'software',
  'StackExchange': 'software',
  'OpenWebText2': 'general',
  'Books3': 'literature',
  'BookCorpus2': 'literature',
  'Gutenberg (PG-19)': 'literature',
  'OpenSubtitles': 'media',
  'DM Mathematics': 'mathematics',
  'PhilPapers': 'philosophy',
  'NIH ExPorter': 'biomedical',
  'HackerNews': 'technology',
  'Enron Emails': 'business',
  'EuroParl': 'politics',
  'YoutubeSubtitles': 'media',
  'Ubuntu IRC': 'software',
};

function deriveDomain(component: string): string {
  return COMPONENT_DOMAIN[component] ?? 'general';
}

// ── Map abbreviations to filename-based motif IDs ───────────────────
// The indicator-sets use abbreviations (TAC, DSG, etc.) but the governance
// motif-library-reader generates IDs from filenames (trust-as-curation, etc.)
const ABBREV_TO_FILENAME_ID: Record<string, string> = {
  'DSG':   'dual-speed-governance',
  'CPA':   'composable-plugin-architecture',
  'ESMB':  'explicit-state-machine-backbone',
  'BBWOP': 'bounded-buffer-with-overflow-policy',
  'ISC':   'idempotent-state-convergence',
  'OFL':   'observer-feedback-loop',
  'RAF':   'ratchet-with-asymmetric-friction',
  'PF':    'progressive-formalization',
  'RB':    'reconstruction-burden',
  'TAC':   'trust-as-curation',
  'RST':   'reflexive-structural-transition',
  'BD':    'boundary-drift',
  'SCGS':  'structural-coupling-ground-state',
  'SLD':   'safety-liveness-duality',
  'RG':    'recursive-generativity',
  'PSR':   'primitive-self-reference',
  'TDC':   'template-driven-classification',
  'SFA':   'scaffold-first-architecture',
};

function resolveMotifId(abbrev: string): string {
  return ABBREV_TO_FILENAME_ID[abbrev] ?? abbrev;
}

// ── Stream and ingest ───────────────────────────────────────────────
const rl = createInterface({
  input: createReadStream(candidatesPath),
  crlfDelay: Infinity,
});

let ingested = 0;
let skipped = 0;
let errors = 0;
const batchSize = 5000;
let batch: Array<() => void> = [];

const flushBatch = () => {
  const txn = db.transaction(() => {
    for (const fn of batch) fn();
  });
  txn();
  batch = [];
};

const startTime = performance.now();

for await (const line of rl) {
  if (!line.trim()) continue;

  let candidate: any;
  try {
    candidate = JSON.parse(line);
  } catch {
    errors++;
    continue;
  }

  // Each candidate may have multiple motif scores; create one verb_record per motif match
  const motifScores: Array<{ motifId: string; score: number; matchedIndicators: string[]; indicatorCount: number }> =
    candidate.motifScores ?? [];

  if (motifScores.length === 0) {
    skipped++;
    continue;
  }

  for (const ms of motifScores) {
    const motifId = resolveMotifId(ms.motifId);
    const id = `${candidate.contentHash}-${motifId}`;
    const domain = deriveDomain(candidate.sourceComponent);
    const [charStart, charEnd] = candidate.charOffset ?? [0, 0];

    batch.push(() => {
      insert.run({
        $id: id,
        $stage: 'structured',
        $shape: `${motifId}-match`,
        $operators: (ms.matchedIndicators ?? []).join(','),
        $axis: 'differentiate',
        $derivativeOrder: 0,
        $temporalStructure: null,
        $dataset: candidate.sourceDataset ?? 'the-pile',
        $component: candidate.sourceComponent ?? 'unknown',
        $documentId: candidate.documentId ?? 'unknown',
        $charStart: charStart,
        $charEnd: charEnd,
        $contentHash: candidate.contentHash,
        $rawText: (candidate.rawText ?? '').slice(0, 2000), // truncate for DB size
        $motifId: motifId,
        $motifConfidence: ms.score,
        $matchEvidence: JSON.stringify({
          matchedIndicators: ms.matchedIndicators,
          indicatorCount: ms.indicatorCount,
        }),
        $isNovel: 0,
        $tierAScore: ms.score,
        $tierBScore: null, // real Tier B scores come from spaCy pipeline
        $tierCScore: null,
        $extractionMethod: 'primed',
        $domain: domain,
        $extractorVersion: 'ingest-bridge-0.1.0',
      });
    });

    ingested++;
  }

  if (batch.length >= batchSize) {
    flushBatch();
    if (ingested % 50000 === 0) {
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
      console.error(`[ingest] ${ingested} records in ${elapsed}s`);
    }
  }
}

// Flush remaining
if (batch.length > 0) flushBatch();

const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
console.error(`\n[ingest] Done: ${ingested} verb-records ingested, ${skipped} skipped, ${errors} errors in ${elapsed}s`);

// ── Summary stats ───────────────────────────────────────────────────
const totalRow = db.prepare('SELECT COUNT(*) as cnt FROM verb_records').get() as { cnt: number };
const motifRow = db.prepare('SELECT COUNT(DISTINCT motif_id) as cnt FROM verb_records').get() as { cnt: number };
const domainRow = db.prepare('SELECT COUNT(DISTINCT domain) as cnt FROM verb_records').get() as { cnt: number };
const componentRow = db.prepare('SELECT COUNT(DISTINCT source_component) as cnt FROM verb_records').get() as { cnt: number };

console.error(`[ingest] DB stats: ${totalRow.cnt} records, ${motifRow.cnt} motifs, ${domainRow.cnt} domains, ${componentRow.cnt} components`);

db.close();
