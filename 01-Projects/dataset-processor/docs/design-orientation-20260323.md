---
title: "Dataset Processor — D/I/R Design Orientation"
date: 2026-03-23
status: draft
authority: low
domain: [observer-native, dataset-processing, motif-library]
method: 3-pass D/I/R design exploration
mode: design
motifs: [dual-speed-governance, bounded-buffer-with-overflow-policy, progressive-formalization, observer-feedback-loop, reconstruction-burden, ratchet-with-asymmetric-friction]
refs:
  - 01-Projects/ocp-scraper/
  - 02-Knowledge/motifs/MOTIF_INDEX.md
  - 02-Knowledge/architecture/algebra-implementation-triad-20260311.md
  - 01-Projects/observer-native/docs/observer-v3-dir-process-contract-20260319.md
---

# Dataset Processor — D/I/R Design Orientation

> Three-pass design exploration for a dataset processing subsystem that extracts verb-records and motif instances from large open-source text datasets. Output: architectural decisions that will inform a PRD.

## Context

The OCP scraper is the **precision rifle** — targeted search against GitHub, SEP, arXiv, producing ~100+ SolutionRecords with structured metadata, graph edges, trust vectors. It finds what you aim at.

The dataset processor is the **trawl net** — volume mining through The Pile (~800GB), Common Pile, and Dolma (~3TB) to find structural process patterns in natural text at scale. It finds what you didn't know to look for.

Both feed the same destination: the verb-record store and motif library. The scraper produces SolutionRecords (noun-shaped: what a project IS). The dataset processor produces verb-records (process-shaped: what a process DOES). These are complementary representations of the same structural patterns.

### Current Infrastructure

| Component | State | Integration Point |
|-----------|-------|-------------------|
| OCP Scraper | Phase 3 complete (22/22 ISC) | SQLite index, SolutionRecord schema, graph edges |
| Motif Library | 34 motifs, 9 Tier 2 | Structural descriptions, axis/order classification, relationships |
| Motif Algebra | Specified, not implemented | c/i/d stabilisation, operator vocabulary, MotifRecord/InstanceRecord types |
| Observer v3.0 | Design orientation drafted | Typed D/I/R outputs, verb-typed rivers, motif resonance layer |
| Gap Engine | Operational | Axis/order void detection, domain coverage analysis |

### Hardware Constraints

- **Primary**: Ryzen 9 5950X (16C/32T), 64GB RAM, RX 6900 XT (16GB VRAM — ROCm, not CUDA)
- **Incoming** (~1 month): MacBook M5 Max (local model inference)
- **Storage**: ZFS on NFS, ample space for dataset caching
- **Runtime**: Must run unattended 24/7 in tmux on CPU path

---

# Pass 1: Conventional Approach

## D — Describe: What would a standard NLP extraction pipeline look like?

### Standard Architecture

A conventional approach to extracting process/verb patterns from large text corpora follows a well-established pipeline:

```
Download → Chunk → Filter → Extract → Normalize → Store → Index
```

**Stage 1: Data Ingestion**
- Download or stream dataset shards (JSONL format for all three datasets)
- The Pile: 22 component datasets, each a `.jsonl.zst` shard. Documents have `text` + `meta` (with `pile_set_name` indicating component: Wikipedia, arXiv, StackExchange, GitHub, etc.)
- Common Pile: Similar JSONL format, open-license focused
- Dolma: HuggingFace-streamable, domain-tagged (web, books, papers, code, social)
- Typical approach: stream shards sequentially, process document-by-document

**Stage 2: Text Preprocessing**
- Sentence segmentation
- Language detection (filter to English)
- Quality filtering (length, perplexity, deduplication)
- Domain tagging from dataset metadata

**Stage 3: NLP Extraction**
- Dependency parsing to identify verb-subject-object triples
- Semantic role labeling (SRL) to extract "who did what to whom"
- Verb phrase extraction using constituency or dependency parse trees
- Named entity recognition for actors and objects
- Tools: spaCy (Python, gold standard for CPU pipeline), compromise.js (JS, fast but shallow), wink-nlp (JS, decent pipeline), natural (JS, classic but dated)

**Stage 4: Normalization**
- Lemmatize verbs to canonical form
- Cluster similar verb phrases
- Resolve coreferences
- Deduplicate semantically equivalent extractions

**Stage 5: Storage**
- Write extracted triples/records to a database
- Build inverted index for search
- Track source provenance (dataset, shard, document ID, character offset)

**Stage 6: Analysis**
- Frequency analysis of verb patterns
- Co-occurrence analysis
- Topic modeling over extracted verb clusters

### Tool Assessment for TypeScript/Bun

| Tool | Language | Speed | Depth | CPU-Only | Bun Compatible |
|------|----------|-------|-------|----------|----------------|
| spaCy | Python | Medium | Deep (dep parse, SRL, NER) | Yes | Via subprocess/microservice |
| compromise.js | JS | Very fast | Shallow (POS, verb phrases) | Yes | Yes (native) |
| wink-nlp | JS | Fast | Medium (tokenize, POS, NER) | Yes | Yes (native) |
| natural | JS | Medium | Shallow (stem, tokenize, classify) | Yes | Probably |
| Stanza | Python | Slow | Deep (neural pipeline) | Yes (CPU mode) | Via subprocess |

**Honest assessment**: No JavaScript NLP library comes close to spaCy for dependency parsing quality. compromise.js is fast but cannot do real dependency parsing — it does surface-level verb phrase extraction via handwritten rules. For structural process extraction, the quality gap between "found a verb phrase" and "parsed the semantic role structure" is enormous.

### What This Pipeline Would Produce

At scale (processing ~100M documents), you'd get:
- Millions of verb-subject-object triples
- Verb frequency distributions across domains
- Co-occurrence matrices
- Very high noise-to-signal ratio
- No structural pattern recognition — just extracted verb phrases
- No connection to motif library
- No quality beyond NLP accuracy (which for free-text SRL is ~70-80%)

### Processing Time Estimates

On a 5950X with spaCy (en_core_web_lg model):
- ~500-1000 documents/second for tokenization + POS
- ~50-100 documents/second for full dependency parse
- ~10-20 documents/second with SRL
- The Pile at 210M documents: 24-58 days for dep parse, 4-6 months with SRL
- First-stage filtering could reduce to ~10-20M candidate documents

## I — Interpret: What are the strengths and weaknesses?

**Strengths:**
- Well-understood pipeline with mature tooling
- Scalable with standard parallel processing
- Produces machine-readable output
- Can run unattended on CPU

**Weaknesses:**
1. **Generic extraction produces generic results.** SRL finds "the enzyme catalyzes the reaction" — it doesn't know this is an instance of autocatalytic self-reference. The extraction is syntactic, not structural.
2. **No motif awareness.** The pipeline doesn't know what it's looking for. It extracts everything, then hopes post-hoc analysis finds patterns. This is exactly backwards from what the motif library enables.
3. **Quality bottleneck is NLP, not compute.** Even with perfect NLP, verb-subject-object triples don't capture process structure. "A governs B" and "A constrains B" look like two different verb phrases but might be the same structural motif (DSG). "A produces A" looks simple but is Primitive Self-Reference.
4. **No paired output.** Standard pipeline produces extracted triples OR processed text, not aligned pairs needed for dual-stream training.
5. **JS NLP ecosystem is thin.** compromise.js is fast but shallow. Serious extraction needs spaCy, which means a Python sidecar.

## R — Recommend

This pipeline would work, but it would produce a corpus of verb phrases, not verb-records in the motif-library sense. The gap between "extracted verb phrases from text" and "identified structural process patterns that match motif descriptions" is the entire value of the system. A conventional pipeline closes zero percent of that gap — it just produces raw material that still needs the hard work done.

**Verdict: Necessary foundation, but insufficient alone. The conventional pipeline is Stage 1 of a multi-stage architecture, not the architecture itself.**

---

# Pass 2: Motif-Informed Analysis

## D — Describe: What do existing motifs predict about this system?

Let me read this system through the lens of the six most relevant Tier 2 motifs.

### DSG (Dual-Speed Governance) predicts two coupled cycles

The dataset processor will have a **fast cycle** and a **slow cycle**, and they must be coupled:

- **Fast cycle**: Pattern-based filtering and extraction running at millions of documents per hour. CPU-bound. Rule-based. No model calls. Operates within constraints set by the slow cycle.
- **Slow cycle**: Model-assisted deep extraction, motif matching, relationship discovery, quality evaluation. Runs on filtered subsets. Uses API calls now, local model later. Updates the extraction templates and filter rules that govern the fast cycle.

**Critical DSG prediction**: The slow cycle must constrain the fast cycle. Concretely: the motif library's structural descriptions should generate the pattern templates that the fast cycle uses as filters. When the slow cycle discovers a new motif instance or refines a structural description, it updates the fast cycle's filter set. The fast cycle cannot modify its own filters — that's the governance boundary.

**Falsification check**: If the fast and slow cycles can run independently without coupling, DSG doesn't apply and we have two separate tools, not one system.

### BBWOP (Bounded Buffer With Overflow Policy) predicts queue management

Processing terabytes of text will produce candidates faster than the slow path can evaluate them. The buffer between fast-path output and slow-path input will overflow.

**BBWOP predictions**:
- There must be an explicit candidate buffer between fast and slow paths
- The buffer needs a capacity limit (not unbounded accumulation)
- An overflow policy must be defined: priority queue (highest-scoring candidates first), sampling (random subset), or drop-oldest
- The overflow policy is a governance decision, not a technical accident

**Concrete implication**: The fast path should score candidates with a lightweight heuristic and the buffer should be a priority queue sorted by that score. When the buffer is full, lowest-scoring candidates are evicted. The slow path draws from the top of the queue.

### PF (Progressive Formalization) predicts the extraction lifecycle

Extracted candidates will follow a formalization trajectory:

1. **Amorphous**: Raw text passage flagged by keyword/pattern match
2. **Structured**: Extracted verb phrase with source context, domain tag, basic parse
3. **Typed**: Normalized verb-record with operator tags, axis classification, candidate motif match
4. **Crystallized**: Validated verb-record linked to a specific motif instance with full provenance

PF predicts that most candidates will never reach crystallization — and that's correct. The kill ratio between amorphous and crystallized should be high (>99%). The system must track candidates at each formalization stage and not force premature crystallization.

**PF prediction about failure mode**: If the system tries to crystallize too early (e.g., immediately mapping every extracted verb phrase to a motif), it will produce false precision. If it stays amorphous too long (just accumulating text passages with no structure), it will produce noise. The formalization gradient must be explicit and governable.

### OFL (Observer-Feedback Loop) predicts extraction-library co-evolution

The motif library is both the search template AND the accumulation target. This is a self-modifying observation system:

1. Library generates search patterns → extraction finds instances → instances enrich library → library generates better search patterns
2. The observer (the extraction system) modifies its own frame (the motif library) through observation (finding instances)

**OFL prediction**: This feedback loop will produce both productive enrichment and pathological self-reinforcement. The system will get better at finding more instances of motifs it already knows, and worse at finding genuinely novel patterns (confirmation bias). The loop needs an explicit novelty-preservation mechanism.

**Concrete implication**: Some fraction of processing must be "motif-blind" — running generic extraction without motif priming, specifically to discover patterns the library doesn't predict. The ratio between primed and blind extraction is a tunable parameter.

### Ratchet (Ratchet with Asymmetric Friction) predicts knowledge accumulation

Once a verb-record is validated and linked to a motif instance, it should be hard to remove. The forward direction (accumulation) should have low friction; the reverse direction (removal) should have high friction.

**Ratchet predictions**:
- Validated verb-records should be append-only (like the OCP scraper's validation_events table)
- Candidate records can be freely created and destroyed
- The boundary between candidate and validated is the ratchet tooth — crossing it requires meeting quality gates
- Demotion (removing a validated record) should require explicit human review, not automated processes

### RB (Reconstruction Burden) predicts source linkage cost

Every abstraction from source text to verb-record destroys information. The reconstruction burden measures how expensive it is to recover the original.

**RB predictions**:
- Every verb-record MUST carry a pointer to exact source passage (dataset, document ID, character offsets)
- The paired output format (raw text + verb-record) is correct because it minimizes reconstruction burden for the training use case
- Lossy intermediate representations (e.g., summarized passages without source links) are architectural debt that compounds
- The source linkage is not metadata decoration — it is load-bearing infrastructure for reprocessing, validation, and training data alignment

## I — Interpret: What architecture emerges from the motifs?

The six motifs don't describe six independent features — they describe a single coherent system:

**DSG gives the two-speed skeleton.** Fast CPU extraction governed by slow model-assisted evaluation.

**BBWOP gives the coupling joint.** A bounded priority buffer between the two speeds, with explicit overflow policy.

**PF gives the lifecycle.** Candidates progress through formalization stages: amorphous → structured → typed → crystallized. Each stage has quality gates.

**OFL gives the feedback loop.** The library feeds the extractor; the extractor feeds the library. With an explicit novelty-preservation escape valve.

**Ratchet gives the accumulation discipline.** Forward motion is cheap; backward motion is expensive. Validated records are permanent.

**RB gives the source integrity constraint.** Every transformation carries its reconstruction cost. Paired output minimizes that cost.

**The architecture that emerges**: A dual-speed pipeline where the fast path does pattern-based filtering using motif-derived templates, feeds a bounded priority buffer, from which the slow path draws candidates for deep evaluation, motif matching, and relationship discovery. The slow path's discoveries update the fast path's templates. Candidates progress through formalization stages with explicit quality gates. Validated records ratchet forward permanently. Everything carries source provenance.

## R — Recommend: Motif-predicted failure modes to design against

1. **Confirmation bias spiral** (OFL): The system finds more of what it already knows. Mitigate with mandatory blind extraction fraction.
2. **Premature crystallization** (PF): Candidates get mapped to motifs before they're structurally validated. Mitigate with explicit formalization stages and stage-appropriate quality checks.
3. **Buffer starvation** (BBWOP): The slow path can't keep up and the buffer fills with stale candidates. Mitigate with time-based eviction in addition to priority-based.
4. **Template ossification** (DSG): The slow cycle stops updating the fast cycle's templates. Mitigate with mandatory template refresh triggered by library changes.
5. **Source orphaning** (RB): Reconstruction links break when datasets are re-versioned or relocated. Mitigate with content-addressed source references (hash + offset) not just path-based.

---

# Pass 3: Novel Synthesis

## D — Describe: What's genuinely different about our situation?

Three things distinguish this system from both conventional NLP extraction and standard information extraction:

### 1. The library IS the search template

In conventional IE, you define extraction patterns separately from the knowledge base. Here, the motif library's structural descriptions are literally the extraction templates. Each motif has:
- A domain-independent formulation (one-sentence abstract description)
- A structural description (multi-paragraph process shape)
- Instances with specific domain expressions
- An axis (differentiate/integrate/recurse) and derivative order (0-3)
- Falsification conditions

This is not a feature list or keyword set. It's a structural signature. The extraction task is: "find passages that describe processes matching this structural signature."

**Implication**: The extraction doesn't start from verb patterns and hope to find motifs. It starts from motif signatures and searches for matching process descriptions. This inverts the conventional pipeline.

### 2. The output must be verb-records, not noun-records

The OCP scraper produces SolutionRecords — noun-shaped descriptions of what something IS. The dataset processor must produce verb-records — process-shaped descriptions of what something DOES.

A verb-record is not an SRL triple (agent-verb-patient). It's a structural process description with:
- **Process shape**: What transformation occurs (e.g., "fast cycle constrained by slow cycle")
- **Operator tags**: From the algebra's verb vocabulary (e.g., `constrain`, `buffer`, `gate`, `converge`)
- **Axis classification**: differentiate / integrate / recurse
- **Derivative order**: What level of abstraction the process operates at
- **Domain context**: Where this process was observed
- **Source text**: The exact passage describing this process
- **Motif match** (if any): Which motif this instance potentially exemplifies

This is a fundamentally different extraction target from verb phrases or SRL frames. It requires understanding process structure, not just syntactic roles.

### 3. Paired output for dual-stream training

Every extraction must produce BOTH:
- The raw source passage (trains the noun stream — learns to represent text)
- The extracted verb-record (trains the verb stream — learns to represent process structure)

These must be aligned by source reference. One processing pass, two outputs. This constraint means the extraction pipeline must preserve the source text alongside the structured extraction, not discard it after processing.

### What this means for architecture

**The conventional pipeline (Pass 1) is wrong because it extracts bottom-up from syntax.** Our system needs to extract top-down from structural signatures.

**The motif-informed analysis (Pass 2) is right about the skeleton but incomplete about the core extraction mechanism.** DSG/BBWOP/PF/OFL/Ratchet/RB predict the pipeline's governance and lifecycle correctly. But they don't specify HOW the motif-signature matching works at the extraction level.

### The core extraction problem

Given a text passage and a motif's structural description, determine whether the passage describes a process instance of that motif.

This is not keyword matching. "The enzyme catalyzes its own synthesis" doesn't contain the words "self-reference" or "recursion," but it's an instance of Primitive Self-Reference. "The committee reviews policy changes quarterly while staff implement decisions daily" doesn't contain "dual-speed" or "governance," but it's an instance of DSG.

**Three-tier extraction strategy**:

**Tier A — Lexical heuristics (CPU, fast path)**

For each motif, derive a set of lexical indicators from its structural description and instances:
- DSG: frequency words like "fast/slow", "policy/operational", "governance/execution", "configure/run", "deliberate/autonomous"
- BBWOP: "buffer", "queue", "overflow", "backpressure", "capacity", "limit", "drop"
- PF: "draft/final", "informal/formal", "evolve", "crystallize", "solidify", "mature"
- Etc.

These are not keyword searches — they're weighted indicator sets. A passage matching 3+ indicators for a motif at above-chance density gets promoted to structured candidate.

This is where compromise.js or wink-nlp works fine. You don't need deep parsing for lexical indicator matching — you need fast tokenization and efficient pattern matching.

**Tier B — Structural parsing (CPU, medium path)**

For candidates promoted from Tier A, run deeper NLP:
- Dependency parsing to identify process relationships (agent-action-patient chains)
- Identify temporal/causal connectors ("before", "after", "because", "therefore", "while")
- Extract governance relationships ("constrains", "governs", "limits", "enables")
- Identify speed/frequency indicators ("continuous", "periodic", "once", "always")

This is where spaCy-as-subprocess earns its keep. The dependency parse reveals whether the matched indicators are structurally connected (genuine process description) or coincidentally co-occurring (noise).

Output: structured candidate with parse tree, identified process relationships, and motif-match scores.

**Tier C — Model-assisted evaluation (API/local model, slow path)**

For candidates promoted from Tier B, use an LLM to:
- Evaluate structural match against motif description
- Classify axis and derivative order
- Assign operator tags from the algebra vocabulary
- Identify potential new relationships between motifs
- Assess whether this is a genuine instance, a superficial match, or a novel pattern

This is the slow path. It produces high-quality verb-records but can only process ~100-1000 candidates per hour (API cost and latency).

### The graph layer

The motif library currently stores relationships as prose tables in markdown:

```
| Related Motif | Relationship | Description |
| OFL | complement | Feedback operates at fast speed... |
```

This needs to become a proper graph data structure:
- **Nodes**: motifs (with axis, order, tier, confidence as node attributes)
- **Edges**: typed relationships (complement, tension, composition, derivation)
- **Edge attributes**: strength, evidence count, discovery date
- **Operations**: neighborhood query, path finding, cluster detection, gap detection

**Why now**: As verb-records are extracted and matched to motifs, the system automatically discovers relationships. If a single passage describes a process involving both DSG and BBWOP, that's evidence of a complement relationship. If many passages from the same domain contain both PF and Ratchet instances, that's evidence of co-occurrence. These relationship discoveries should flow directly into the graph.

**Implementation**: SQLite can represent this (the OCP scraper already has an `edges` table). But the relationship types need to be richer and the operations need to be more sophisticated than what the current `edges` table supports. A dedicated graph table with typed edges, or an in-memory adjacency structure loaded from SQLite at startup.

### Gap-directed sampling

The motif library's gap engine identifies voids in the axis/order space:
- D/d3, I/d3, R/d0 were identified and partially filled in the 2026-03-22 scrape
- Domain coverage shows which motifs need more alien-domain instances

**Gap-directed sampling means**: don't process the entire dataset uniformly. Score dataset shards by their likely relevance to known gaps, and process high-relevance shards first.

The Pile's component datasets are domain-tagged:
- `ArXiv` → physics, math, CS (good for d2/d3 abstract patterns)
- `Wikipedia` → broad domain coverage (good for alien-domain expansion)
- `StackExchange` → practical implementation patterns (good for d0/d1)
- `GitHub` → code + documentation (good for software-domain motifs)
- `PubMed` → biology, medicine (good for alien-domain expansion)
- `PhilPapers` → philosophy (good for d3 patterns)

Dolma has similar domain tags. Gap-directed sampling selects which components to process and in what order based on what the library needs.

### Scaling efficiency for relationship discovery

At 34 motifs, pairwise comparison is 561 pairs — trivial. At 500 motifs, it's 124,750 pairs — expensive if done naively for every new verb-record.

**The axis/order classification is a spatial index.** Motifs on the same axis and adjacent orders are more likely to have meaningful relationships than motifs on different axes at different orders. When a new verb-record is classified at (integrate, d1), only compare against motifs at (integrate, d0-d2) plus their known complements on other axes. This reduces the comparison space from O(n²) to O(k) where k is the neighborhood size.

**Incremental relationship evaluation**: Track which motifs changed (new instances added, confidence updated) and only re-evaluate relationships involving changed motifs. Don't recompute the entire graph on every insertion.

## I — Interpret: What's the novel architecture?

The novel architecture is a **motif-primed, three-tier, dual-speed extraction pipeline with paired output and graph-integrated relationship discovery**.

It inverts the conventional pipeline: instead of extracting everything and searching for patterns, it starts from known patterns and searches for instances, with an explicit blind-extraction channel for discovering genuinely novel patterns.

The three tiers (lexical → structural → model-assisted) map naturally to DSG's dual-speed model:
- **Fast speed**: Tiers A+B (CPU, pattern-based, governed by motif-derived templates)
- **Slow speed**: Tier C (model-assisted, governed by algebra evaluation)
- **Governance boundary**: The motif library generates templates for the fast path; the slow path validates and enriches the library; but the fast path cannot modify the library directly

The paired output (source text + verb-record) satisfies both the training data requirement and the Reconstruction Burden constraint: the source text is always recoverable from the verb-record's provenance link.

The graph layer makes relationship discovery continuous rather than batch: every new verb-record that matches a motif automatically triggers neighborhood-scoped relationship evaluation.

### Key architectural decisions

1. **spaCy as subprocess, not in-process**. TypeScript orchestrates; Python does the heavy NLP. This is the correct boundary — fighting the JS NLP ecosystem is wasted effort.

2. **SQLite for everything, initially.** The OCP scraper's SQLite store already has the right primitives (records, edges, FTS5). Extend it rather than introducing a new store. The verb-record table is new; the graph edge types are extended; the storage layer is shared.

3. **Streaming, not batch download.** Don't download 800GB of The Pile first. Stream shards, process, discard raw text after extraction. Only keep the paired output (source passage + verb-record), not the entire document.

4. **Template generation is a slow-path operation.** When a new motif is created or a structural description is refined, the slow path generates new lexical indicator sets for the fast path. This is DSG governance: template changes go through the slow cycle.

5. **Blind extraction fraction: 10%.** Ten percent of processed documents get full Tier B extraction without motif priming. This is the OFL novelty-preservation valve.

## R — Recommend: The architecture

### Component Diagram

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

### Data Flow

1. **Dataset stream** → Select shard based on gap-directed priority
2. **Tier A** → Tokenize, match against motif-derived lexical indicators, score, filter. ~90% of documents rejected here. Throughput: millions/hour.
3. **Tier B** → spaCy dependency parse on survivors. Extract process relationships. Score structural match. ~80% of Tier A survivors rejected. Throughput: tens of thousands/hour.
4. **Priority Buffer** → Scored candidates queued. Bounded capacity. Priority eviction on overflow. Time-based expiry for staleness.
5. **Tier C** → Model draws from buffer top. Deep evaluation: motif match, axis/order, operator tags, relationships. Produces verb-records. ~50% of candidates become verb-records. Throughput: hundreds/hour.
6. **Verb-Record Store** → Paired output (source passage + verb-record) written to SQLite. Graph edges updated. Motif instance linked. Relationship neighborhood re-evaluated.
7. **Template refresh** → When library changes, slow path regenerates lexical indicator sets for Tier A.

### Verb-Record Schema (Draft)

```typescript
interface VerbRecord {
  id: string;                          // Content-addressed: hash of source + extraction

  // Process description
  process: {
    shape: string;                     // Structural description of the process
    operators: string[];               // From algebra vocabulary: constrain, buffer, gate, converge...
    axis: 'differentiate' | 'integrate' | 'recurse';
    derivativeOrder: 0 | 1 | 2 | 3;
    temporalStructure?: string;        // Sequential, concurrent, cyclic, recursive
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
  extractorVersion: string;            // Pipeline version for reprocessing
}
```

### Graph Extension Schema

```typescript
// Extends OCP scraper's existing edges table
interface MotifGraphEdge {
  sourceMotifId: string;
  targetMotifId: string;
  relationshipType: 'complement' | 'tension' | 'composition' | 'derivation' | 'co-occurrence';
  strength: number;                    // 0.0 - 1.0
  evidenceCount: number;               // Number of verb-records supporting this edge
  evidenceIds: string[];               // Verb-record IDs as evidence
  discoveredAt: string;                // ISO 8601
  lastUpdated: string;                 // ISO 8601
}
```

### Gap-Directed Sampling Strategy

```
For each dataset component:
  1. Score component against motif library gaps:
     - axis/order voids → high priority for components likely to contain those patterns
     - domain coverage gaps → high priority for underrepresented domains
     - relationship density gaps → high priority for components bridging sparse neighborhoods
  2. Sort components by gap-relevance score
  3. Process highest-scoring components first
  4. Re-score periodically as library grows (Ratchet: re-evaluation on change only)
```

Component-to-gap mapping (initial):

| Gap Type | High-Priority Components |
|----------|------------------------|
| d3 patterns (meta-structural) | PhilPapers, ArXiv (cs.AI, math.LO), Wikipedia (philosophy) |
| Alien-domain expansion | PubMed, FreeLaw, USPTO, NIH ExPorter |
| d0 patterns (positional) | StackExchange, GitHub docs, DM Mathematics |
| Relationship density | Wikipedia (broad coverage, cross-domain references) |

### Processing Budget

Target: process the most valuable 5% of available data, not all of it.

| Tier | Throughput | Daily Volume | Monthly Volume |
|------|-----------|--------------|----------------|
| A (lexical) | 1M docs/hr | 24M docs | 720M docs |
| B (structural) | 20K docs/hr | 480K docs | 14.4M docs |
| Buffer capacity | 10K candidates | — | — |
| C (model) | 200 candidates/hr (API) | 4,800 candidates | 144K candidates |
| Verb-records produced | ~100/hr | 2,400/day | 72K/month |

At 72K verb-records/month, with a 50% post-evaluation kill rate, the system produces ~36K validated verb-records per month. Against 34 motifs, that's ~1,000 candidate instances per motif per month — more than enough for library enrichment and relationship discovery.

### Recursive Multi-Pass Strategy

Not a linear pipeline. Each pass informs the next:

**Pass 1 (Broad filter)**: Process all high-priority shards through Tier A. Produce a filtered corpus of candidate passages. Update domain coverage statistics.

**Pass 2 (Motif-primed extraction)**: Process filtered corpus through Tiers B+C with motif priming. Produce verb-records. Update motif instance counts and relationship graph.

**Pass 3 (Library-informed re-extraction)**: Using the enriched library from Pass 2, regenerate lexical indicators and structural templates. Re-process the original shards (or new shards) with the improved templates. Find instances that Pass 1 missed because the templates were less refined.

**Pass N (Convergence check)**: When the marginal yield of new verb-records per shard processed drops below a threshold, the extraction has converged for the current library state. Wait for library changes (new motifs, new relationships) before re-running.

This is the OFL feedback loop made explicit. Each pass improves the library, which improves the next pass's extraction.

---

# Reflect: Cross-Pass Comparison and Key Decisions

## What emerged across the three passes

### Pass 1 → Pass 2 shift: From extraction to search

The biggest shift from conventional (Pass 1) to motif-informed (Pass 2) was inverting the pipeline: instead of "extract everything, then analyze," it's "search for specific structural signatures." This changes the fundamental operation from **information extraction** to **pattern matching against a structural lexicon**.

### Pass 2 → Pass 3 shift: From dual-speed to three-tier

Pass 2 predicted a dual-speed architecture (DSG). Pass 3 refined this into a three-tier architecture where the middle tier (spaCy structural parsing) is the critical quality gate between lexical noise and model-assisted evaluation. The two-speed model is still correct at the governance level, but the implementation has three processing stages.

### Convergence across all three passes

All three passes agreed on:
1. **Source provenance is non-negotiable** — every extracted item must link back to exact source
2. **JavaScript NLP is insufficient** — spaCy via subprocess is the correct boundary
3. **SQLite is the right store** — extend the OCP scraper's existing schema
4. **Unattended CPU operation for the fast path** — no API keys, no interactive prompts, no GPU
5. **Paired output format** — source text + verb-record, always linked

### Novel insight from Pass 3

The **blind extraction fraction** (10% of processing runs without motif priming) was the most novel architectural element. It comes directly from reading OFL's predictions about confirmation bias. No conventional pipeline or standard motif-matching architecture would include this — it's the system deliberately maintaining ignorance to preserve novelty discovery.

## Key architectural decisions (for PRD input)

### Decision 1: Inverted extraction (search, not extract)
- **Choice**: Start from motif structural signatures, search for matching passages
- **Alternative rejected**: Start from verb phrases, cluster into patterns
- **Rationale**: The motif library already defines what we're looking for. Generic extraction produces 99% noise. Primed search produces actionable candidates.
- **Risk**: Confirmation bias. Mitigated by 10% blind extraction.

### Decision 2: Three-tier processing with spaCy subprocess
- **Choice**: Tier A (JS, lexical) → Tier B (spaCy subprocess, structural) → Tier C (LLM, evaluative)
- **Alternative rejected**: All-JS pipeline with compromise.js; All-Python pipeline; Direct LLM extraction on all documents
- **Rationale**: Each tier has the right tool for its abstraction level. JS is fast for tokenization. spaCy is the best CPU-based dependency parser. LLMs are the only option for structural motif matching. The boundaries are natural quality gates.
- **Risk**: Subprocess overhead. Mitigated by batching Tier B calls.

### Decision 3: Extend OCP scraper's SQLite, don't build new store
- **Choice**: Add verb_records and motif_graph_edges tables to the existing .ocp/index.db schema
- **Alternative rejected**: Separate database; Graph database (Neo4j); Document store
- **Rationale**: The scraper already has the right primitives (records, edges, FTS5, query log). Verb-records and motif graph edges are natural extensions. One store, one truth.
- **Risk**: SQLite write contention if both scraper and processor run simultaneously. Mitigated by WAL mode (already enabled) and separate writer processes.

### Decision 4: Gap-directed sampling over uniform processing
- **Choice**: Score dataset components against library gaps, process highest-priority first
- **Alternative rejected**: Process everything uniformly; Random sampling
- **Rationale**: 5% of the data contains 80% of the value for library enrichment. The gap engine already identifies what the library needs. Processing uniformly wastes 95% of compute on low-value data.
- **Risk**: Sampling bias — systematically missing patterns in low-priority components. Mitigated by periodic rotation through all components and blind extraction.

### Decision 5: Verb-record as the new primitive (not SolutionRecord)
- **Choice**: New VerbRecord type distinct from SolutionRecord
- **Alternative rejected**: Extend SolutionRecord with verb fields; Store extractions as untyped JSON
- **Rationale**: SolutionRecords describe what things ARE (nouns). VerbRecords describe what processes DO (verbs). These are complementary representations. Forcing verb data into the noun schema would corrupt both. But both live in the same SQLite store and graph.
- **Risk**: Two record types means two code paths. Mitigated by shared graph layer and store infrastructure.

### Decision 6: Motif graph as first-class structure
- **Choice**: Explicit graph with typed edges, evidence tracking, neighborhood-scoped updates
- **Alternative rejected**: Keep relationships as prose in markdown; Build full graph database
- **Rationale**: The current prose relationship tables can't support automated relationship discovery. But a full graph database is over-engineering — SQLite's edges table extended with evidence tracking and typed relationships is sufficient for the current library size (34 motifs, growing to hundreds).
- **Scaling boundary**: If the library exceeds ~1000 motifs, the SQLite graph layer may need migration to a dedicated graph store. At 34-500 motifs, SQLite is fine.

### Decision 7: Recursive multi-pass, not linear pipeline
- **Choice**: Each pass informs the next; convergence-based termination
- **Alternative rejected**: Single-pass linear pipeline; Fixed N-pass schedule
- **Rationale**: The OFL feedback loop means extraction quality improves as the library grows. A single pass leaves value on the table. A fixed schedule either under-processes (not enough passes) or over-processes (too many after convergence).
- **Convergence criterion**: Marginal verb-record yield per shard drops below threshold (e.g., <10 new records per 10K documents processed).

## Open questions for PRD

1. **spaCy model size**: en_core_web_sm (fast, less accurate) vs en_core_web_lg (slow, more accurate) vs en_core_web_trf (transformer-based, slow but best quality, might need GPU). Recommendation: start with en_core_web_md as compromise.

2. **Tier C model**: Claude API for now, local model (on MacBook M5 Max) later. What's the API budget? At 200 candidates/hr with ~1K tokens per evaluation, that's ~200K tokens/hr = ~5M tokens/day. Manageable but not free.

3. **Blind extraction fraction**: 10% is a starting guess. Should this be tunable? Should it increase when the library is young (more exploration) and decrease as it matures (more exploitation)?

4. **Buffer capacity**: 10K candidates is a guess. Need to benchmark Tier B throughput vs Tier C throughput to size correctly.

5. **Graph update frequency**: On every verb-record insertion, or batched? Batched is more efficient but introduces lag in relationship discovery.

6. **Dataset priority**: Which dataset first? The Pile has better domain tags but is older. Dolma is newer and larger. Common Pile is open-license focused. Recommendation: start with The Pile (better understood, domain-tagged components) for initial pipeline development.

7. **Integration with motif algebra**: The algebra spec defines c/i/d stabilisation conditions. Should the dataset processor evaluate these, or feed raw verb-records to a separate algebra service? Recommendation: separate service — the processor produces verb-records; the algebra evaluates them. Clean separation of concerns.

8. **Reprocessing strategy**: When the library improves, which old shards get reprocessed? All of them (expensive)? Only those from domains where the library changed (targeted)? Only new shards (cheapest but misses improvement)? Recommendation: targeted reprocessing of shards from domains where library changes occurred.

---

## Summary

The dataset processor is a motif-primed, three-tier, dual-speed extraction system that inverts the conventional NLP pipeline. Instead of extracting everything and searching for patterns, it starts from the motif library's structural signatures and searches for matching process descriptions in large text datasets. It produces verb-records (process-shaped) that complement the OCP scraper's SolutionRecords (noun-shaped), with paired output format for future dual-stream model training.

The architecture is predicted by six Tier 2 motifs (DSG, BBWOP, PF, OFL, Ratchet, RB) and includes explicit defenses against the failure modes those motifs predict (confirmation bias, premature crystallization, buffer starvation, template ossification, source orphaning).

This document is a design orientation. It does not commit to implementation details. The next step is a PRD that specifies exact schemas, ISC criteria, and build slices.
