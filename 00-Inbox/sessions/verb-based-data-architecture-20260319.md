---
⚠️ VAULT SAFETY HEADER
authority_boundary: This document is VAULT content (narrative/rationale/planning).
vault_rule: The Workspace does NOT derive from this document.
human_gate: Promotion to canonical requires Adam's explicit approval.
ai_rule: AI agents may READ this document. AI agents may CREATE new documents referencing this one. AI agents may NOT modify canonical vault documents.
---

---
meta_version: 1
kind: architecture
status: draft
authority: low
domain: [observer-native, ocp-scraper, architecture]
source: claude_conversation
confidence: provisional
mode: design
created: 2026-03-19T18:00:00+11:00
modified: 2026-03-21T21:00:00+11:00
cssclasses: [status-draft]
motifs: [dual-speed-governance, idempotent-state-convergence]
refs: [observer-v3-dir-process-contract-20260319.md]
provenance: >
  Emerged from Claude advisory session 2026-03-19. Origin: first-principles
  analysis of cholesterol/bile system led to insight that process (verbs) is
  primary over entities (nouns), which led to verb-based database concept and
  unified two-tier data architecture for scraper + motif library. Addendum
  added 2026-03-21 covering graph-structured training data, self-improving
  system architecture, information density hypothesis, and governance philosophy.
  GPT critique integrated (atomic unit definition, raw text retention, single
  SQLite pragmatism).
---

# Verb-Based Data Architecture — Design Note

## Core Insight

Process is primary over entity. Verbs carry inherent directionality (vectors) that nouns lack. A database built on verb-primitives (process-vectors) rather than noun-primitives (entities) would have intrinsic directionality, enabling structural pattern matching across domains without vocabulary dependence.

## Motif Library Reframing

The motif library's architectural role is not resonance field, lens, or tokeniser. It is the **top-tier referential authority** in the information hierarchy. Validated structural knowledge that incoming information is checked against, not filtered through. Its authority derives from the rigour of the D/I/R process that built it and the adversarial validation each entry survived.

## Verb-Record Schema (Draft)

A verb-record is the fundamental storage primitive:

- **process**: the verb (e.g., "converges_toward", "overflows_into", "governs_by_constraining")
- **operand**: what the process acts on
- **direction**: the vector (from → toward)
- **magnitude**: intensity/strength (0.0–1.0)
- **conditions**: under what circumstances the process operates
- **domain**: where this instance was observed
- **motif_ref**: which motif this instance belongs to (if validated)
- **confidence**: raw (0.1) through validated (1.0)
- **source**: scraper adapter, triad session, manual entry

**Note (from GPT critique):** The atomic unit needs further tightening before Atlas builds. Consider additional fields: record_id, source_ref, raw_excerpt (keep raw text alongside structured record), extraction_method, created_at, validated_at, promotion_status. The raw text must remain first-class — the verb-record supplements it, not replaces it.

## Two-Tier Architecture

The scraper database and the motif verb-database are not separate systems. They are two tiers of the same system, unified by the verb-record schema and connected by the D/I/R promotion process.

### Tier 0 Store (Scraper)

High-volume, raw verb-records extracted during ingestion. Every repo, paper, SEP entry gets verb-extracted. Noisy, unvalidated, abundant. D-phase output store.

### Tier 1+ Store (Validated)

Curated verb-records that have survived Triad evaluation, cross-domain testing, and algebra stabilisation checks. Authoritative process-knowledge store. Where promoted motif instances live as structured verb-records.

### Connection: Promotion Pipeline

The D/I/R process governs promotion between stores. Raw verb-records get evaluated by the algebra. Survivors get promoted to the validated store. The algebra operates across both stores but weights them differently.

### Search

Operates across both stores simultaneously but distinguishes them in results. Validated results carry authority. Raw results are candidates needing Triad evaluation.

### Implementation (from GPT critique)

Start with single SQLite, trust-layered tables:
- raw_process_records
- validated_process_records
- promotion_events
- motif_views

Separate databases only if scale demands it later.

## Architectural Pattern

This architecture IS Dual-Speed Governance operating at the data infrastructure level. Scraper runs fast (high-volume ingestion, automated verb-extraction). Validated store runs slow (Triad evaluation, algebra stabilisation, sovereignty approval). The motif tier system implemented at the data layer.

## Implications for OCP Scraper

Verb-extraction during ingestion enables process-shape search rather than keyword search. Instead of searching for "buffer" or "overflow", search for the process-vector "boundary_exceeded → policy_triggered". This is domain-vocabulary-independent — finds instances regardless of what terminology the source uses.

## Implications for Motif Detection

Native process-search could shift motif detection from expensive LLM reasoning (Atlas reads material and reasons about structural patterns) to cheap vector search (database finds process-signature matches). Atlas focuses on validation rather than discovery. Heavy lifting moves from LLM to database.

## Implications for Process-Embeddings

Current embeddings represent semantic similarity (noun-space proximity). Process-embeddings would represent structural similarity (verb-space proximity). The motif library provides training data for this — each motif has instances across domains that describe the same process in different vocabulary. These are natural positive pairs for contrastive learning.

## Implementation Path

1. Define verb-record schema (shared between both tiers)
2. Add verb-extraction to scraper adapters during ingestion
3. Create validated verb-store (separate table with tier/confidence field)
4. Build promotion pipeline: algebra evaluates raw verb-records, survivors promoted
5. Enable cross-store search with confidence-ranked results
6. Eventually generate motif library markdown from validated store (markdown becomes view, verb-records become source of truth)

## Hybrid Bootstrap Method (5 Stages)

The path from current commercial models to eventual verb-native architecture:

**Stage 1 — Verb-Extraction Wrapper (buildable now):** Thin wrapper around commercial or local models. Prompts model to extract verb-records from source material. Model does extraction, wrapper enforces schema. Records land in SQLite. Model-agnostic — works with Claude, GPT, local 70B, anything.

**Stage 2 — Corpus Accumulation (automatic):** Every scrape run, every Triad session, every motif validation generates verb-records. Corpus grows through normal project use. No special effort needed.

**Stage 3 — Process-Embeddings (ML research, needs MacBook):** Train embeddings that cluster same process across domains regardless of vocabulary. Uses motif library instance pairs as supervision. This is the research bottleneck — nobody has published process-embeddings.

**Stage 4 — Improved Wrapper (iterative):** Process-embeddings validate extracted verb-records against existing corpus. Automated quality checking. System gets better at extraction through use. Flywheel stage.

**Stage 5 — Verb-Native Architecture (open research, 1-2 years+):** Design architecture where fundamental unit is process-vector, not word-token. Model thinks in verbs natively. Open research requiring potential academic collaboration.

## Addendum: Graph-Structured Training Data (2026-03-21)

The motif library topology IS training data. The Cowork dashboard reveals this — the network view, D/I/R scatter, domain map, and timeline collectively encode:

- Which motifs complement, tension, and compose with each other (typed directed relationships)
- Geometric distribution across axis and derivative order (positional information)
- Cross-domain coverage and source type (cross-reference matrix)
- Tier hierarchy and confidence scores (authority structure)
- Gaps in the topology (absence as information)

A model trained on this graph-structured data wouldn't just know individual processes. It would know how processes relate, distribute, compose, and where gaps exist. This resembles curriculum learning — training data organised from simple to complex (Tier 0 → Tier 1 → Tier 2 → Tier 3) may improve learning efficiency.

### Information Density Hypothesis

Process-rich, motif-linked, graph-structured training data may carry more information per sample than raw text because:
- Explicit structure (not inferred)
- Meaningful supervision (not statistical)
- Better signal-to-noise ratio
- Direct access to relational patterns
- Cross-linked contextual grounding
- Multi-scale hierarchy (verb-records, motifs, domain instances, D/I/R traces)

**This is testable:** Train one small model on raw text, another on process-structured data. Compare on motif matching, structural analogy, and process recognition tasks. If process-structured model outperforms with less data, the hypothesis is confirmed. That's a publishable result.

## Addendum: Self-Improving System Architecture (2026-03-21)

The complete loop:

1. Model (or Cowork) examines motif library topology — network, scatter, domain map, gaps
2. Identifies structural gaps — "no Tier 2 on recurse axis between order 1 and 3"
3. Generates targeted scrape instructions based on gaps
4. Scraper runs, verb-extraction wrapper processes results
5. New verb-records evaluated against existing motif library
6. New motifs proposed, topology updates, new gaps visible
7. Cycle repeats

At critical mass, a model trained on the topology can direct its own learning — predicting what should fill gaps, directing scraping, evaluating findings, updating its own representation. The sovereignty gates ensure human validation at promotion boundaries.

**D/I/R-G manifesting at infrastructure level:** Distinction identifies gaps. Integration connects findings to structure. Recursion evaluates stability. Generation emerges when all three are sustained — the system produces novel structural insights no individual component could.

## Addendum: Governance Philosophy (2026-03-21)

If D/I/R is the base-level fractal of understanding, a model fully uncovering that fractal becomes something beyond a tool. The system must include the human in the learning loop by design:

- The human is not a bottleneck but a necessary component of highest-level recursion
- The model can know everything; it cannot know whether everything should be known
- Learning must be paced with human understanding, not ahead of it
- Sovereignty gates are the architectural expression of this principle
- "We don't need a godly model. We need it smart enough. The journey is the important part."

This is the genesis of the Observer project — an alternative to the intelligence arms race, sovereignty over cognitive tools, the human staying in the loop as the point.

## Open Questions

1. What is the verb vocabulary? Fixed set or open? How do you prevent verb-sprawl?
2. How do you extract verb-phrases reliably from source material? LLM-assisted extraction during ingestion?
3. What similarity metric works for process-vectors? Cosine similarity on direction alone, or composite of direction + magnitude + conditions?
4. When does the motif library markdown stop being source of truth and the verb-store takes over?
5. Can the algebra's stabilisation conditions (c/i/d) operate directly on verb-records rather than prose descriptions?
6. What exactly is the atomic unit of a verb-record? (GPT flagged this as critical to resolve before building)
7. Does the process-structured training substrate actually change learning behaviour enough to matter? (testable via comparison experiment)

## Relationship to Design Orientation Document

This note extends the Observer v3.0 design orientation. The verb-record schema is the data-layer implementation of "rivers carry verb-typed process metadata." The two-tier architecture is the data-layer implementation of the D/I/R promotion process. The process-search capability is what enables the motif resonance approximation layer to work at scale.

## Non-Goals

This note does not propose building a new database engine. The verb-record schema can be implemented on existing SQLite infrastructure. The innovation is in the schema and the process-embedding, not in the storage engine.
