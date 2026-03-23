---
prd: true
id: PRD-20260323-dataset-processor
status: DRAFT
mode: design
effort_level: Advanced
created: 2026-03-23
updated: 2026-03-23
iteration: 1
maxIterations: 128
loopStatus: null
last_phase: PLAN
failing_criteria: []
verification_summary: "0/0"
parent: null
children: []
refs:
  - 01-Projects/dataset-processor/docs/design-orientation-20260323.md
  - 01-Projects/ocp-scraper/
  - 02-Knowledge/motifs/MOTIF_INDEX.md
---

# Dataset Processor — PRD

> A motif-primed, three-tier, dual-speed extraction system that mines structural process patterns from large open-source text datasets and produces verb-records for the motif library.

## STATUS

| What | State |
|------|-------|
| Progress | 0/0 criteria passing |
| Phase | PLAN |
| Next action | Slice 1 implementation |
| Blocked by | Nothing |

---

## 1. Overview

### Purpose

The Dataset Processor is the **volume mining** complement to the OCP scraper's **precision search**. Where the OCP scraper targets specific repositories and produces SolutionRecords (noun-shaped: what a project IS), the Dataset Processor streams through large text corpora — The Pile (~800GB, 210M documents), Common Pile, and Dolma (~3TB) — and produces VerbRecords (process-shaped: what a process DOES).

Both feed the same destination: the verb-record store and motif library. SolutionRecords and VerbRecords are complementary representations of the same structural patterns, unified by the motif graph layer.

### Relationship to OCP Scraper

| Dimension | OCP Scraper | Dataset Processor |
|-----------|-------------|-------------------|
| Metaphor | Precision rifle | Trawl net |
| Input | GitHub, SEP, arXiv (targeted) | The Pile, Common Pile, Dolma (bulk) |
| Output | SolutionRecord (noun-shaped) | VerbRecord (process-shaped) |
| Record count | ~1,000s | ~10,000s–100,000s |
| Store | `.ocp/index.db` (shared) | `.ocp/index.db` (shared, extended) |
| Graph | Dependency edges, domain edges | Motif graph edges, relationship discovery |

The processor **extends** the scraper's SQLite schema — it does not create a separate store. New tables (`verb_records`, `motif_graph_edges`, `processing_state`) are added alongside the existing `records`, `edges`, and `validation_events` tables.

### Relationship to Wrapper / Dual-Stream Training

The paired output format (source passage + verb-record) is designed for future dual-stream model training:

- **Noun stream**: Raw source passages train text representation (what things ARE)
- **Verb stream**: Extracted verb-records train process representation (what things DO)

The wrapper concept treats these as aligned training pairs. The Dataset Processor produces these pairs; a future training pipeline consumes them. This PRD covers production of pairs only, not training infrastructure.

### Hardware Constraints

- **Primary**: Ryzen 9 5950X (16C/32T), 64GB RAM, RX 6900 XT (16GB VRAM, ROCm)
- **Incoming** (~1 month): MacBook M5 Max (local model inference for Tier C)
- **Storage**: ZFS on NFS, ample for dataset caching
- **Runtime**: Must run unattended 24/7 in tmux on CPU path (Tiers A+B). Tier C uses API initially.

---

## 2. Architecture

### Core Inversion

The Dataset Processor inverts the conventional NLP pipeline. Instead of extracting everything and searching for patterns, it starts from the motif library's structural signatures and searches for matching process descriptions. The motif library is both the search template AND the accumulation target.

### Three-Tier Processing Pipeline

```
                                    ┌─────────────────────┐
                                    │   Motif Library      │
                                    │   (34 motifs, graph) │
                                    └──────────┬──────────┘
                                               │
                              ┌────────────────┼────────────────┐
                              │ template gen   │ instance feed   │
                              ▼                │                 │
┌──────────┐    ┌─────────────────────┐        │    ┌────────────────────┐
│ Dataset  │───▶│  Tier A: Lexical    │        │    │  Tier C: Model     │
│ Stream   │    │  (CPU, fast)        │        │    │  (API/local, slow) │
└──────────┘    │  - indicator match  │        │    │  - motif evaluation│
                │  - domain filter    │        │    │  - axis/order class│
                │  - gap priority     │        │    │  - operator tags   │
                └─────────┬───────────┘        │    │  - relationship    │
                          │ candidates         │    │    discovery       │
                          ▼                    │    └─────────┬──────────┘
                ┌─────────────────────┐        │              │
                │  Tier B: Structural │        │              │ verb-records
                │  (spaCy, medium)    │        │              │
                │  - dep parse        │        │              ▼
                │  - process extract  │        │    ┌────────────────────┐
                │  - match scoring    │        │    │  Verb-Record Store │
                └─────────┬───────────┘        │    │  (SQLite)          │
                          │ scored candidates  │    │  - paired output   │
                          ▼                    │    │  - source links    │
                ┌─────────────────────┐        │    │  - graph edges     │
                │  Priority Buffer    │────────┘    └────────────────────┘
                │  (BBWOP)            │
                │  - bounded capacity │
                │  - priority eviction│
                │  - time-based expiry│
                └─────────────────────┘
```

**Tier A — Lexical Heuristics (CPU, fast path)**

For each motif, a set of weighted lexical indicators is derived from its structural description and known instances. Passages matching 3+ indicators at above-chance density are promoted to candidates. Uses compromise.js or wink-nlp for fast tokenization. Throughput target: ~1M documents/hour.

Rejection rate: ~90% of documents filtered here.

**Tier B — Structural Parsing (spaCy subprocess, medium path)**

Candidates from Tier A receive dependency parsing via spaCy (`en_core_web_md`) running as a subprocess. Extracts process relationships (agent-action-patient chains), temporal/causal connectors, governance relationships, speed/frequency indicators. Scores structural match against motif signatures.

Rejection rate: ~80% of Tier A survivors filtered here. Throughput target: ~20K documents/hour.

**Tier C — Model-Assisted Evaluation (API/local model, slow path)**

Candidates from the priority buffer receive LLM evaluation: structural match against motif description, axis/order classification, operator tag assignment, relationship discovery, novel pattern assessment. Produces finalized verb-records.

Conversion rate: ~50% of candidates become verb-records. Throughput target: ~200 candidates/hour (API), scaling with local model.

### Dual-Speed Governance (DSG)

| Property | Fast Speed (Tiers A+B) | Slow Speed (Tier C + Library) |
|----------|----------------------|-------------------------------|
| Compute | CPU-only, unattended | API calls / local model |
| Governed by | Motif-derived templates | Algebra evaluation, human review |
| Modifies | Candidate buffer only | Verb-record store, motif library, templates |
| Constraint | Cannot modify templates or library | Updates templates that govern fast path |

**Governance boundary**: The fast path operates within constraints set by the slow path. When the slow path discovers a new motif instance or refines a structural description, it regenerates the lexical indicator sets that the fast path uses. The fast path cannot modify its own filters.

### Priority Buffer (BBWOP)

Between Tiers B and C sits a bounded priority buffer:

| Property | Value |
|----------|-------|
| Capacity | 10,000 candidates (tunable) |
| Sort key | Composite score: `tierBScore * gapRelevance * noveltyBonus` |
| Overflow policy | Lowest-scoring candidates evicted |
| Staleness policy | Candidates older than 72 hours evicted |
| Draw order | Tier C draws from top of priority queue |

### Blind Extraction (OFL Novelty Preservation)

10% of processed documents receive full Tier B extraction without motif priming — specifically to discover patterns the library doesn't predict. This fraction is tunable and should increase when the library is young (more exploration) and decrease as it matures (more exploitation).

### Formalization Stages (Progressive Formalization)

| Stage | Description | Quality Gate |
|-------|-------------|-------------|
| Amorphous | Raw text passage flagged by Tier A pattern match | ≥3 lexical indicators at above-chance density |
| Structured | Extracted candidate with parse tree, process relationships, match scores | Tier B structural score > threshold |
| Typed | Normalized verb-record with operator tags, axis classification, candidate motif match | Tier C evaluation score > 0.5 |
| Crystallized | Validated verb-record linked to specific motif instance with full provenance | Human review (Tier 2+) or automated (Tier 0-1) |

### Accumulation Discipline (Ratchet)

- Candidate records (amorphous, structured) can be freely created and destroyed
- Typed verb-records are append-only in the store
- Crystallized verb-records (linked to motif instances) require explicit human review for demotion
- The boundary between typed and crystallized is the ratchet tooth

---

## 3. Schemas

### VerbRecord Schema

```typescript
interface VerbRecord {
  id: string;                          // Content-addressed: SHA-256 of source passage + extraction params

  // Process description
  process: {
    shape: string;                     // Structural description of the process
    operators: string[];               // From algebra vocabulary: constrain, buffer, gate, converge...
    axis: 'differentiate' | 'integrate' | 'recurse';
    derivativeOrder: 0 | 1 | 2 | 3;
    temporalStructure?: string;        // 'sequential' | 'concurrent' | 'cyclic' | 'recursive'
  };

  // Source linkage (Reconstruction Burden)
  source: {
    dataset: string;                   // 'the-pile' | 'common-pile' | 'dolma'
    component: string;                 // 'arxiv' | 'wikipedia' | 'stackexchange' | ...
    documentId: string;                // Dataset-specific document identifier
    charOffset: [number, number];      // Start/end character offsets in document
    contentHash: string;               // SHA-256 of source passage for integrity
    rawText: string;                   // The actual source passage (paired output)
  };

  // Motif matching
  motifMatch?: {
    motifId: string;                   // e.g., 'dual-speed-governance'
    confidence: number;                // 0.0 - 1.0
    matchEvidence: string;             // Why this matches
    isNovel: boolean;                  // True if no motif match — potential new pattern
  };

  // Formalization stage (Progressive Formalization)
  stage: 'amorphous' | 'structured' | 'typed' | 'crystallized';

  // Quality and trust
  quality: {
    tierAScore: number;                // Lexical indicator match score
    tierBScore: number;                // Structural parse match score
    tierCScore?: number;               // Model evaluation score (if evaluated)
    extractionMethod: 'primed' | 'blind';  // Whether motif-primed or blind extraction
  };

  // Domain context
  domain: string;                      // Inferred domain from dataset component + content

  // Metadata
  createdAt: string;                   // ISO 8601
  updatedAt: string;                   // ISO 8601
  extractorVersion: string;            // Pipeline version for reprocessing
}
```

### MotifGraphEdge Schema

```typescript
interface MotifGraphEdge {
  sourceMotifId: string;               // e.g., 'dual-speed-governance'
  targetMotifId: string;               // e.g., 'bounded-buffer-with-overflow-policy'
  relationshipType: 'complement' | 'tension' | 'composition' | 'derivation' | 'co-occurrence';
  strength: number;                    // 0.0 - 1.0
  evidenceCount: number;               // Number of verb-records supporting this edge
  evidenceIds: string[];               // Verb-record IDs as evidence
  discoveredAt: string;                // ISO 8601
  lastUpdated: string;                 // ISO 8601
}
```

### SQLite Table Definitions

These tables extend the existing `.ocp/index.db` schema (alongside `records`, `edges`, `validation_events`, `query_log`, `zero_match_queries`).

```sql
-- Verb-records: process-shaped extractions from dataset processing
CREATE TABLE IF NOT EXISTS verb_records (
  id TEXT PRIMARY KEY,                              -- Content-addressed hash
  stage TEXT NOT NULL DEFAULT 'amorphous',           -- amorphous|structured|typed|crystallized

  -- Process description
  process_shape TEXT NOT NULL,                       -- Structural description
  process_operators TEXT,                            -- JSON array of operator tags
  process_axis TEXT,                                 -- differentiate|integrate|recurse
  process_derivative_order INTEGER,                  -- 0-3
  process_temporal_structure TEXT,                   -- sequential|concurrent|cyclic|recursive

  -- Source linkage
  source_dataset TEXT NOT NULL,                      -- the-pile|common-pile|dolma
  source_component TEXT NOT NULL,                    -- arxiv|wikipedia|stackexchange|...
  source_document_id TEXT NOT NULL,                  -- Dataset-specific doc ID
  source_char_start INTEGER NOT NULL,                -- Start character offset
  source_char_end INTEGER NOT NULL,                  -- End character offset
  source_content_hash TEXT NOT NULL,                 -- SHA-256 of source passage
  source_raw_text TEXT NOT NULL,                     -- The actual source passage

  -- Motif matching
  motif_id TEXT,                                     -- Matched motif slug (nullable)
  motif_confidence REAL,                             -- 0.0-1.0
  motif_match_evidence TEXT,                         -- Why this matches
  motif_is_novel INTEGER DEFAULT 0,                  -- 1 if no motif match

  -- Quality scores
  tier_a_score REAL NOT NULL DEFAULT 0,
  tier_b_score REAL NOT NULL DEFAULT 0,
  tier_c_score REAL,                                 -- NULL until Tier C evaluation
  extraction_method TEXT NOT NULL DEFAULT 'primed',  -- primed|blind

  -- Domain and metadata
  domain TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  extractor_version TEXT NOT NULL
);

-- FTS5 for verb-record search
CREATE VIRTUAL TABLE IF NOT EXISTS verb_records_fts USING fts5(
  id,
  process_shape,
  source_raw_text,
  domain,
  motif_id,
  content=verb_records,
  content_rowid=rowid
);

-- Motif graph edges: typed relationships between motifs with evidence tracking
CREATE TABLE IF NOT EXISTS motif_graph_edges (
  source_motif_id TEXT NOT NULL,
  target_motif_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL,                   -- complement|tension|composition|derivation|co-occurrence
  strength REAL NOT NULL DEFAULT 0,                  -- 0.0-1.0
  evidence_count INTEGER NOT NULL DEFAULT 0,
  evidence_ids TEXT,                                 -- JSON array of verb-record IDs
  discovered_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_updated TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (source_motif_id, target_motif_id, relationship_type)
);

-- Processing state: tracks which dataset shards have been processed
CREATE TABLE IF NOT EXISTS processing_state (
  dataset TEXT NOT NULL,                             -- the-pile|common-pile|dolma
  component TEXT NOT NULL,                           -- arxiv|wikipedia|stackexchange|...
  shard_id TEXT NOT NULL,                            -- Shard filename or identifier
  tier TEXT NOT NULL,                                -- a|b|c
  documents_processed INTEGER NOT NULL DEFAULT 0,
  candidates_produced INTEGER NOT NULL DEFAULT 0,
  verb_records_produced INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  status TEXT NOT NULL DEFAULT 'running',            -- running|completed|failed|paused
  PRIMARY KEY (dataset, component, shard_id, tier)
);

-- Priority buffer: bounded candidate queue between Tier B and Tier C
CREATE TABLE IF NOT EXISTS priority_buffer (
  id TEXT PRIMARY KEY,                               -- Candidate verb-record ID
  priority_score REAL NOT NULL,                      -- Composite: tierBScore * gapRelevance * noveltyBonus
  verb_record_json TEXT NOT NULL,                    -- Serialized candidate verb-record
  enqueued_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL                           -- enqueued_at + 72 hours
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vr_stage ON verb_records(stage);
CREATE INDEX IF NOT EXISTS idx_vr_motif ON verb_records(motif_id);
CREATE INDEX IF NOT EXISTS idx_vr_dataset ON verb_records(source_dataset, source_component);
CREATE INDEX IF NOT EXISTS idx_vr_axis ON verb_records(process_axis);
CREATE INDEX IF NOT EXISTS idx_vr_order ON verb_records(process_derivative_order);
CREATE INDEX IF NOT EXISTS idx_vr_created ON verb_records(created_at);
CREATE INDEX IF NOT EXISTS idx_mge_source ON motif_graph_edges(source_motif_id);
CREATE INDEX IF NOT EXISTS idx_mge_target ON motif_graph_edges(target_motif_id);
CREATE INDEX IF NOT EXISTS idx_mge_type ON motif_graph_edges(relationship_type);
CREATE INDEX IF NOT EXISTS idx_pb_priority ON priority_buffer(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_pb_expires ON priority_buffer(expires_at);
CREATE INDEX IF NOT EXISTS idx_ps_status ON processing_state(status);
```

---

## 4. Build Slices

### Slice 1: Dataset Streaming and Tier A Lexical Filtering

**Goal**: Stream documents from The Pile and filter using motif-derived lexical indicators.

**What it does**: Reads JSONL (.zst compressed) shards, tokenizes documents, matches against a hardcoded set of lexical indicator patterns for each known motif, scores matches, and emits candidate passages with scores.

**Dependencies**: None (foundation slice).

**ISC Criteria**:

| ID | Criterion | Verification |
|----|-----------|-------------|
| S1-1 | Pipeline streams a `.jsonl.zst` shard from The Pile and processes documents sequentially without loading the full shard into memory | Run against a test shard; memory usage stays below 500MB |
| S1-2 | Tier A processes 1,000 documents from The Pile's PhilPapers component and produces >50 candidate passages with motif-indicator scores >0.5 | Run and count output candidates |
| S1-3 | Each candidate includes: source dataset, component name, document ID, character offsets, content hash, raw text passage, and per-motif indicator scores | Inspect 10 random candidates for completeness |
| S1-4 | Processing throughput exceeds 10,000 documents/hour on the 5950X | Time 1,000 documents and extrapolate |
| S1-5 | Documents with zero indicator matches are discarded without producing output | Verify no zero-score candidates in output |

---

### Slice 2: VerbRecord Schema and SQLite Store Extension

**Goal**: Define the VerbRecord type in TypeScript and extend the existing SQLite schema with `verb_records`, `motif_graph_edges`, `processing_state`, and `priority_buffer` tables.

**What it does**: Adds TypeScript interfaces, SQLite migration, and CRUD operations for verb-records. Extends the OCP scraper's `SearchIndex` class or creates a parallel `VerbRecordStore` class.

**Dependencies**: OCP scraper SQLite schema (read-only reference).

**ISC Criteria**:

| ID | Criterion | Verification |
|----|-----------|-------------|
| S2-1 | TypeScript `VerbRecord` and `MotifGraphEdge` interfaces compile under strict mode and match the schemas in Section 3 | `bun build` with strict mode passes |
| S2-2 | SQLite migration creates all four new tables (`verb_records`, `motif_graph_edges`, `processing_state`, `priority_buffer`) without affecting existing tables | Run migration against a copy of `.ocp/index.db`; verify existing tables unchanged |
| S2-3 | CRUD operations: insert, get-by-id, update-stage, list-by-motif, list-by-stage all work for verb-records | Unit tests pass for each operation |
| S2-4 | FTS5 virtual table `verb_records_fts` indexes `process_shape`, `source_raw_text`, `domain`, `motif_id` and returns results for text queries | Insert 10 test records; search returns matches |
| S2-5 | Content-addressed ID generation produces deterministic IDs: same source passage + extraction params → same ID | Hash two identical inputs; assert equal IDs |

---

### Slice 3: Motif Template Generation

**Goal**: Generate lexical indicator sets from the motif library's structural descriptions and known instances.

**What it does**: Reads motif markdown files from `02-Knowledge/motifs/`, extracts structural descriptions, domain-independent formulations, and known instances. Produces a `MotifTemplate` for each motif containing weighted lexical indicators that Tier A uses for filtering.

**Dependencies**: Motif library files (read-only). Slice 1 (consumes templates).

**ISC Criteria**:

| ID | Criterion | Verification |
|----|-----------|-------------|
| S3-1 | Template generator reads all motif files from `02-Knowledge/motifs/` and produces a `MotifTemplate` for each Tier 1+ motif | Run generator; verify template count matches Tier 1+ motif count in MOTIF_INDEX.md |
| S3-2 | Each `MotifTemplate` contains ≥10 weighted lexical indicators derived from the motif's structural description and instances | Inspect templates for DSG, BBWOP, PF; verify indicator count and relevance |
| S3-3 | Templates are serializable to/from JSON and can be loaded by Tier A without parsing motif files at runtime | Serialize, deserialize, compare for equality |
| S3-4 | Template refresh: when a motif file changes, only that motif's template is regenerated (incremental, not full rebuild) | Modify one motif file; verify only one template changes |

---

### Slice 4: spaCy Subprocess Integration (Tier B)

**Goal**: Run spaCy dependency parsing as a Python subprocess, called from TypeScript, with batched input/output.

**What it does**: Launches a long-lived Python subprocess running spaCy with `en_core_web_md`. TypeScript sends batches of candidate passages via stdin (JSONL). Python returns dependency parses, process relationships, temporal/causal connectors, and governance relationships via stdout (JSONL). TypeScript scores structural match against motif signatures.

**Dependencies**: Slice 1 (provides candidates). Python 3 + spaCy installed on system.

**ISC Criteria**:

| ID | Criterion | Verification |
|----|-----------|-------------|
| S4-1 | spaCy subprocess starts, stays alive across multiple batches, and shuts down cleanly on SIGTERM | Start process, send 3 batches, send shutdown signal; verify clean exit |
| S4-2 | Batch processing: send 50 candidate passages, receive 50 parsed results with dependency trees, identified process relationships, and temporal connectors | Send batch; verify 50 results with expected fields |
| S4-3 | Structural match scoring: candidates with genuine process descriptions (e.g., "the fast cycle constrains the slow cycle") score higher than candidates with coincidental keyword co-occurrence | Score 10 genuine + 10 noise passages; verify separation |
| S4-4 | Throughput exceeds 500 documents/hour per spaCy worker on the 5950X with `en_core_web_md` | Time 100 documents and extrapolate |
| S4-5 | Subprocess crash recovery: if spaCy process dies, orchestrator detects failure and restarts within 5 seconds | Kill subprocess; verify restart and continued processing |

---

### Slice 5: Priority Buffer with BBWOP Overflow Policy

**Goal**: Implement the bounded priority buffer between Tier B output and Tier C input.

**What it does**: SQLite-backed priority queue with bounded capacity (10K default), priority-based eviction on overflow, time-based expiry (72 hours), and draw-from-top for Tier C consumption.

**Dependencies**: Slice 2 (SQLite `priority_buffer` table).

**ISC Criteria**:

| ID | Criterion | Verification |
|----|-----------|-------------|
| S5-1 | Buffer enforces capacity limit: inserting candidate 10,001 evicts the lowest-priority candidate | Insert 10,001 candidates with known scores; verify count stays at 10,000 and lowest-scored is gone |
| S5-2 | Priority score is composite: `tierBScore * gapRelevance * noveltyBonus` where `noveltyBonus = 1.5` for blind extractions | Insert candidates with known inputs; verify computed priority matches formula |
| S5-3 | Time-based expiry: candidates older than 72 hours are evicted on next buffer maintenance cycle | Insert candidate with past timestamp; run maintenance; verify eviction |
| S5-4 | Draw-from-top: `dequeue(n)` returns the n highest-priority candidates and removes them from the buffer | Enqueue 100 candidates; dequeue 10; verify top-10 by score returned and buffer has 90 |
| S5-5 | Buffer statistics: `getStats()` returns count, min/max/avg priority, oldest candidate age | Populate buffer; verify stats match expected values |

---

### Slice 6: Paired Output Format

**Goal**: Produce aligned (source text, verb-record) pairs suitable for future dual-stream training.

**What it does**: When a verb-record is finalized (typed or crystallized stage), write the paired output: the raw source passage alongside the structured verb-record. Output format is JSONL with each line containing both the source text and the complete verb-record. Supports export to filesystem for training pipeline consumption.

**Dependencies**: Slice 2 (verb-record store), Slice 1 (source passages).

**ISC Criteria**:

| ID | Criterion | Verification |
|----|-----------|-------------|
| S6-1 | Export produces JSONL where each line contains `{"source": <raw text>, "verb_record": <VerbRecord>}` | Export 100 records; parse each line; verify both fields present |
| S6-2 | Source text in export matches the `source.rawText` field of the verb-record exactly (byte-for-byte) | Compare exported source text against stored verb-record for 50 records |
| S6-3 | Content hash in verb-record matches SHA-256 of the source passage | Recompute hash for 50 records; verify match |
| S6-4 | Export filters by stage: can export only `typed` records, only `crystallized` records, or both | Export with each filter; verify correct records included |

---

### Slice 7: Graph Layer Extension for Relationship Discovery

**Goal**: Implement the motif graph with typed edges, evidence tracking, and neighborhood-scoped relationship evaluation.

**What it does**: When a verb-record matches a motif, the system checks whether the source passage also describes processes matching other motifs. Co-occurring motif matches in the same passage create `co-occurrence` edges. Neighborhood-scoped evaluation (same axis, adjacent derivative orders) identifies `complement` and `tension` relationships. Evidence tracking links edges to the verb-records that support them.

**Dependencies**: Slice 2 (motif_graph_edges table), Slice 3 (motif templates for multi-motif matching).

**ISC Criteria**:

| ID | Criterion | Verification |
|----|-----------|-------------|
| S7-1 | When a verb-record matches motif A and the same passage also scores >0.3 for motif B, a `co-occurrence` edge is created between A and B | Insert verb-record matching DSG with secondary BBWOP match; verify edge created |
| S7-2 | Evidence tracking: each edge's `evidence_ids` array contains the verb-record IDs that support it, and `evidence_count` is accurate | Create 5 verb-records supporting same edge; verify count=5 and all IDs present |
| S7-3 | Neighborhood scoping: relationship evaluation only compares against motifs at same axis ± 1 derivative order, plus known complements | Insert verb-record at (integrate, d1); verify only neighborhood motifs compared |
| S7-4 | Graph query: `getNeighborhood(motifId)` returns all edges for a motif with their types, strengths, and evidence counts | Populate graph; query neighborhood; verify completeness |
| S7-5 | Incremental update: adding a new verb-record only re-evaluates edges involving the matched motif, not the entire graph | Instrument edge evaluation count; verify bounded by neighborhood size |

---

### Slice 8: Tier C Model-Assisted Evaluation

**Goal**: Use Claude API to evaluate candidates from the priority buffer: structural match, axis/order classification, operator tag assignment, novel pattern assessment.

**What it does**: Draws candidates from the priority buffer top. For each candidate, constructs a prompt containing the source passage and the candidate motif's structural description. Claude evaluates structural match, assigns axis and derivative order, selects operator tags from the algebra vocabulary, and assesses novelty. Output is a finalized VerbRecord at `typed` stage.

**Dependencies**: Slice 5 (priority buffer), Slice 2 (verb-record store), Slice 3 (motif templates). Requires `ANTHROPIC_API_KEY`.

**ISC Criteria**:

| ID | Criterion | Verification |
|----|-----------|-------------|
| S8-1 | Tier C draws from buffer top, processes candidates, and writes typed verb-records to the store | Populate buffer with 20 candidates; run Tier C; verify ≥5 verb-records produced |
| S8-2 | Each verb-record produced has: axis, derivative order, ≥1 operator tag, motif match confidence, and match evidence | Inspect 10 produced verb-records for completeness |
| S8-3 | Novel pattern detection: candidates with no strong motif match are flagged with `motifMatch.isNovel = true` | Submit 5 candidates with no motif relevance; verify novel flag set |
| S8-4 | API budget tracking: log token usage per evaluation; abort processing if daily budget exceeded | Set low budget; verify processing stops at limit |
| S8-5 | Rate limiting: respect API rate limits with exponential backoff | Verify backoff behavior under simulated rate limiting |

---

### Slice 9: Gap-Directed Sampling Engine

**Goal**: Score dataset components against motif library gaps and prioritize processing order.

**What it does**: Reads the motif library's gap state (axis/order voids, domain coverage gaps, relationship density gaps). Scores each dataset component (e.g., The Pile's PhilPapers, ArXiv, Wikipedia) by relevance to known gaps. Produces a processing priority queue: highest-relevance components processed first.

**Dependencies**: Slice 1 (dataset streaming), Slice 3 (motif templates), OCP scraper gap engine (read-only reference).

**ISC Criteria**:

| ID | Criterion | Verification |
|----|-----------|-------------|
| S9-1 | Gap scorer reads current motif library state and produces a priority ranking of dataset components | Run scorer; verify all Pile components have a score and ranking |
| S9-2 | PhilPapers scores higher than GitHub for d3 (meta-structural) gaps; PubMed scores higher for alien-domain expansion | Verify rankings match expected gap-component affinity |
| S9-3 | Priority queue updates when library state changes (new motif, new instances, confidence update) | Add motif instance; re-score; verify rankings change |
| S9-4 | Processing scheduler selects next shard from highest-priority unprocessed component | Mock 10 shards across 3 components; verify selection order matches priority |

---

### Slice 10: Recursive Multi-Pass Orchestrator

**Goal**: Implement the multi-pass extraction loop where each pass informs the next, with convergence-based termination.

**What it does**: Orchestrates the full pipeline across multiple passes:
- **Pass 1**: Broad Tier A filter across high-priority shards. Updates domain coverage statistics.
- **Pass 2**: Motif-primed extraction through Tiers B+C. Updates motif instances and graph.
- **Pass 3+**: Using enriched library, regenerates templates and re-processes shards with improved indicators.
- **Convergence**: When marginal verb-record yield drops below threshold (<10 new records per 10K documents), the current extraction round terminates.

**Dependencies**: All previous slices (1-9).

**ISC Criteria**:

| ID | Criterion | Verification |
|----|-----------|-------------|
| S10-1 | Orchestrator runs Pass 1 → Pass 2 → convergence check as a complete cycle | Run against test corpus; verify all three phases execute |
| S10-2 | Template regeneration between passes: Pass 2 verb-records update library; Pass 3 uses updated templates | Compare Pass 1 and Pass 3 template indicator sets; verify differences |
| S10-3 | Convergence detection: processing terminates when yield drops below 10 new verb-records per 10K documents | Simulate declining yield; verify termination at threshold |
| S10-4 | State persistence: orchestrator can be stopped and resumed without reprocessing completed shards | Stop mid-pass; restart; verify processing resumes from correct shard |
| S10-5 | Processing statistics: each pass logs documents processed, candidates produced, verb-records created, and marginal yield | Run 2 passes; verify stats available for each |

---

## 5. Dependencies

### Slice Dependency Graph

```
Slice 1 (Streaming + Tier A) ──┬──▶ Slice 3 (Templates) ──┬──▶ Slice 7 (Graph Layer)
                                │                           │
Slice 2 (Schema + Store) ──────┼──▶ Slice 5 (Buffer) ──────┼──▶ Slice 8 (Tier C)
                                │                           │
                                ├──▶ Slice 4 (spaCy/Tier B) │
                                │                           │
                                └──▶ Slice 6 (Paired Output)│
                                                            │
                                                            ▼
                                          Slice 9 (Gap Sampling) ──▶ Slice 10 (Orchestrator)
```

**Parallel build opportunities**:
- Slices 1 and 2 can build in parallel (no dependencies on each other)
- Slices 3, 4, 5, 6 can build in parallel once 1+2 are complete
- Slices 7 and 8 can build in parallel once 3+5 are complete
- Slice 9 depends on 1+3
- Slice 10 depends on everything

### External Dependencies

| Dependency | Required By | Notes |
|------------|------------|-------|
| Bun runtime | All slices | Existing in OCP scraper |
| bun:sqlite | Slice 2+ | Existing in OCP scraper |
| compromise.js or wink-nlp | Slice 1 | New dependency — evaluate both |
| Python 3.10+ | Slice 4 | System-level install |
| spaCy + en_core_web_md | Slice 4 | `pip install spacy && python -m spacy download en_core_web_md` |
| zstd decompression | Slice 1 | For `.jsonl.zst` shard streaming |
| Anthropic SDK | Slice 8 | `@anthropic-ai/sdk` for Tier C API calls |
| The Pile dataset access | Slice 1 | HuggingFace or direct download |

---

## 6. Integration Points

### OCP Scraper

| Integration | Direction | Mechanism |
|-------------|-----------|-----------|
| SQLite schema | Shared | Same `.ocp/index.db` — verb-record tables added alongside existing tables |
| Graph edges | Bidirectional | Motif graph edges in `motif_graph_edges` complement existing `edges` table |
| Gap engine | Read | Dataset processor reads gap state from scraper's coverage analysis |
| Template system | Read | Motif templates may reference scraper's existing template types |

### Motif Library

| Integration | Direction | Mechanism |
|-------------|-----------|-----------|
| Structural descriptions | Read | Template generator reads motif markdown files |
| Instance enrichment | Write | New verb-record instances enrich motif instance counts |
| Relationship discovery | Write | Graph edges flow back to update relationship tables in motif files |
| Gap state | Read | Gap-directed sampling reads axis/order/domain voids |

### Motif Algebra Engine

| Integration | Direction | Mechanism |
|-------------|-----------|-----------|
| Operator vocabulary | Read | Tier C assigns operator tags from algebra's verb vocabulary |
| c/i/d stabilisation | Deferred | Algebra evaluates stabilisation conditions on verb-records (separate service) |
| MotifRecord/InstanceRecord | Deferred | Future alignment between VerbRecord and algebra's type system |

**Decision**: The dataset processor produces verb-records; the algebra engine evaluates them. Clean separation of concerns. Integration deferred until algebra engine is implemented.

### Dashboard / Control Plane

| Integration | Direction | Mechanism |
|-------------|-----------|-----------|
| Processing statistics | Write | Processing state table provides dashboard data |
| Buffer status | Read | Dashboard can query priority buffer stats |
| Verb-record counts | Read | Dashboard can query verb-record counts by stage, motif, domain |

---

## 7. Governance

### Sovereignty Gates

| Action | Gate | Rationale |
|--------|------|-----------|
| Tier A/B processing | **Automated** | CPU-only, pattern-based, no permanent state changes |
| Verb-record creation (typed stage) | **Automated** | Tier C evaluation with quality threshold |
| Tier 0 motif instance linking | **Automated** | Low-confidence, observational — no structural claims |
| Tier 1 motif instance linking | **Automated with review queue** | Cross-domain claim — automated but queued for periodic human review |
| Tier 2+ motif instance promotion | **Human approval required** | Structural operator status — sovereignty gate applies |
| Template regeneration | **Automated** | Slow-path operation but deterministic from library state |
| New motif proposal (from blind extraction) | **Human approval required** | Novel pattern claim requires human evaluation |
| Graph edge creation (co-occurrence) | **Automated** | Evidence-based, statistical |
| Graph edge promotion (complement/tension) | **Human review** | Structural relationship claim |
| Reprocessing trigger | **Automated** | When library changes, targeted reprocessing is safe |
| Convergence threshold adjustment | **Human approval** | Affects processing budget and yield |

### OIL Constraints

- No API keys, tokens, or secrets in commits (existing OIL secret gate)
- No modification of motif files without human approval
- No promotion of verb-records to crystallized stage without meeting quality gates
- Processing state is the processor's own — freely modifiable
- Verb-record store is append-only for typed+ records

---

## 8. Open Questions and Recommended Resolutions

### Q1: spaCy model size

**Question**: `en_core_web_sm` (fast, less accurate) vs `en_core_web_lg` (slow, more accurate) vs `en_core_web_trf` (transformer, needs GPU)?

**Recommended resolution**: Start with `en_core_web_md` (medium — good accuracy/speed tradeoff). Benchmark on 1,000 candidates. If accuracy is insufficient for process relationship extraction, upgrade to `en_core_web_lg`. Do not use `trf` — it requires GPU and the fast path must be CPU-only.

### Q2: Tier C model and API budget

**Question**: Claude API for now, local model later. What's the API budget?

**Recommended resolution**: At 200 candidates/hr with ~1K tokens per evaluation, daily usage is ~5M tokens. Set initial daily budget at 10M tokens (~$30/day at current Sonnet pricing). Track actual usage in Slice 8 and adjust. When MacBook M5 Max arrives, evaluate local model for Tier C to reduce API dependency.

### Q3: Blind extraction fraction

**Question**: 10% is a starting guess. Should it be tunable? Should it adapt?

**Recommended resolution**: Make it a config parameter. Start at 10%. Implement adaptive adjustment in Slice 10: increase to 20% when library has <50 motifs (exploration phase), decrease to 5% when library has >200 motifs (exploitation phase). Log blind extraction yield separately for monitoring.

### Q4: Buffer capacity

**Question**: 10K candidates — is this right?

**Recommended resolution**: 10K as default. Benchmark Tier B throughput vs Tier C throughput in Slices 4+8 to validate. If Tier B produces >10K candidates before Tier C can process 1K, the buffer is too small. If the buffer never fills, it's too large. Make capacity configurable.

### Q5: Graph update frequency

**Question**: On every verb-record insertion, or batched?

**Recommended resolution**: On every insertion for the current library size (34 motifs, neighborhood comparison is O(k) with k~10). Add batch mode when library exceeds 200 motifs. The incremental neighborhood-scoped approach (Slice 7 ISC S7-5) keeps per-insertion cost bounded.

### Q6: Dataset priority

**Question**: Which dataset first — The Pile, Dolma, or Common Pile?

**Recommended resolution**: The Pile first. Better understood, well-documented domain tags per component, smaller than Dolma. Use for initial pipeline development and calibration. Expand to Dolma after pipeline is validated (post-Slice 10).

### Q7: Integration with motif algebra

**Question**: Should the processor evaluate c/i/d stabilisation, or feed raw verb-records to a separate algebra service?

**Recommended resolution**: Separate service. The processor produces verb-records with operator tags and axis/order classification. The algebra engine evaluates stabilisation conditions on those records. Clean separation of concerns — build the algebra engine as a consumer of verb-records, not embedded in the processor.

### Q8: Reprocessing strategy

**Question**: When the library improves, which old shards get reprocessed?

**Recommended resolution**: Targeted reprocessing. Track which motifs changed (new instances, confidence updates) and which dataset components those motifs' templates cover. Only reprocess shards from components where changed motifs' templates would produce different Tier A results. The `processing_state` table (Slice 2) enables this by tracking what was processed with which extractor version.

---

## 9. Processing Budget

| Tier | Throughput | Daily Volume | Monthly Volume |
|------|-----------|--------------|----------------|
| A (lexical) | ~1M docs/hr | 24M docs | 720M docs |
| B (structural) | ~20K docs/hr | 480K docs | 14.4M docs |
| Buffer capacity | 10K candidates | — | — |
| C (model, API) | ~200 candidates/hr | 4,800 candidates | 144K candidates |
| Verb-records produced | ~100/hr | 2,400/day | 72K/month |
| Post-evaluation validated | ~50/hr | 1,200/day | 36K/month |

At 36K validated verb-records/month against 34 motifs: ~1,000 candidate instances per motif per month.

---

## Appendix A: Design Decisions (Architectural Commitments)

These decisions are carried forward from the [design orientation document](design-orientation-20260323.md) and are architectural commitments for this PRD.

### Decision 1: Inverted Extraction (Search, Not Extract)

- **Choice**: Start from motif structural signatures, search for matching passages
- **Alternative rejected**: Start from verb phrases, cluster into patterns
- **Rationale**: The motif library already defines what we're looking for. Generic extraction produces 99% noise. Primed search produces actionable candidates.
- **Risk**: Confirmation bias. Mitigated by 10% blind extraction.

### Decision 2: Three-Tier Processing with spaCy Subprocess

- **Choice**: Tier A (JS, lexical) → Tier B (spaCy subprocess, structural) → Tier C (LLM, evaluative)
- **Alternative rejected**: All-JS pipeline with compromise.js; All-Python pipeline; Direct LLM extraction on all documents
- **Rationale**: Each tier has the right tool for its abstraction level. JS is fast for tokenization. spaCy is the best CPU-based dependency parser. LLMs are the only option for structural motif matching.
- **Risk**: Subprocess overhead. Mitigated by batching Tier B calls.

### Decision 3: Extend OCP Scraper's SQLite, Don't Build New Store

- **Choice**: Add `verb_records` and `motif_graph_edges` tables to existing `.ocp/index.db`
- **Alternative rejected**: Separate database; Graph database (Neo4j); Document store
- **Rationale**: The scraper already has the right primitives (records, edges, FTS5, query log). One store, one truth.
- **Risk**: SQLite write contention. Mitigated by WAL mode (already enabled).
- **Scaling boundary**: If the library exceeds ~1,000 motifs, the SQLite graph layer may need migration to a dedicated graph store.

### Decision 4: Gap-Directed Sampling Over Uniform Processing

- **Choice**: Score dataset components against library gaps, process highest-priority first
- **Alternative rejected**: Process everything uniformly; Random sampling
- **Rationale**: 5% of the data contains 80% of the value for library enrichment. The gap engine identifies what the library needs.
- **Risk**: Sampling bias. Mitigated by periodic rotation and blind extraction.

### Decision 5: VerbRecord as New Primitive (Not SolutionRecord)

- **Choice**: New VerbRecord type distinct from SolutionRecord
- **Alternative rejected**: Extend SolutionRecord with verb fields; Store as untyped JSON
- **Rationale**: SolutionRecords describe what things ARE (nouns). VerbRecords describe what processes DO (verbs). Complementary representations. Both share the same SQLite store and graph.

### Decision 6: Motif Graph as First-Class Structure

- **Choice**: Explicit graph with typed edges, evidence tracking, neighborhood-scoped updates
- **Alternative rejected**: Keep relationships as prose in markdown; Build full graph database
- **Rationale**: Prose tables can't support automated relationship discovery. Full graph DB is over-engineering at 34 motifs.
- **Scaling boundary**: Re-evaluate at ~1,000 motifs.

### Decision 7: Recursive Multi-Pass, Not Linear Pipeline

- **Choice**: Each pass informs the next; convergence-based termination
- **Alternative rejected**: Single-pass linear pipeline; Fixed N-pass schedule
- **Rationale**: OFL feedback loop means extraction quality improves as library grows. Convergence criterion: marginal yield <10 new records per 10K documents.

### Decision 8: Streaming, Not Batch Download

- **Choice**: Stream shards, process, discard raw text after extraction
- **Alternative rejected**: Download full dataset first, then process
- **Rationale**: 800GB+ download before first result is unacceptable. Streaming produces results from the first shard. Only paired output (passage + verb-record) is kept, not full documents.

---

## Appendix B: Motif Library State at Time of Writing

| Metric | Count |
|--------|-------|
| Total motifs | 34 |
| Tier 0 | 14 |
| Tier 1 | 9 |
| Tier 2 | 9 |
| Tier 3 (draft) | 5 |
| Inter-motif relationships | 42 |

Tier 2 motifs (the structural operators that inform this architecture): Dual-Speed Governance, Composable Plugin Architecture, Explicit State Machine Backbone, Bounded Buffer With Overflow Policy, Idempotent State Convergence, Observer-Feedback Loop, Ratchet with Asymmetric Friction, Progressive Formalization, Reconstruction Burden.

All three primary axes represented at Tier 2: integrate (DSG, ISC, PF), differentiate (CPA, ESMB, BBWOP, RB), recurse (OFL, Ratchet).
