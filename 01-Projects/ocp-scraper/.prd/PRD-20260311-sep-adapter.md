---
prd: true
id: PRD-20260311-sep-adapter
status: draft
mode: interactive
effort_level: Advanced
created: 2026-03-11
updated: 2026-03-11
iteration: 1
maxIterations: 128
loopStatus: null
last_phase: PLAN
failing_criteria: []
verification_summary: "0/25"
parent: null
children: []
---

# OCP Scraper - Stanford Encyclopedia of Philosophy Adapter

> Expand OCP Scraper with a `SEP` adapter so motif discovery can ingest reflective, cybernetic, phenomenological, and philosophy-of-science evidence from a corpus where recurse-axis vocabulary is native rather than translated away.

## STATUS

| What | State |
|------|-------|
| Progress | 0/25 criteria passing |
| Phase | PLAN |
| Next action | Build SEP adapter slice 1 |
| Blocked by | Nothing |

## Problem Statement

The motif library's evidence base is currently biased toward materialist-technical discourse. GitHub produces effect-heavy evidence and arXiv produces mechanism-heavy evidence, but neither source natively surfaces reflective, cybernetic, autopoietic, participatory, or phenomenological recurse vocabulary. This bias is now empirically confirmed: three reflective `cs.AI` keyword scrapes on arXiv returned zero results. The recurse-axis Tier 2 search and the emerging Tier 3 composition inquiry both require a source where second-order, observer-dependent, and self-referential language is native rather than operationalized away. The Stanford Encyclopedia of Philosophy is the highest-value next source because it is peer-reviewed, open, structurally consistent, and already contains native graph structure through related entries and bibliographies.

## Context

### Architectural Fit

- `src/types/forge.ts` defines the platform-agnostic `ForgeAdapter` interface the SEP adapter must implement.
- `src/forge/arxiv.ts` demonstrates the current pattern for mapping non-repository sources onto `ForgeAdapter` without changing the interface.
- `src/types/solution-record.ts` and the existing record pipeline provide the JSON-LD target shape.
- `src/store/index.ts` already supports indexing forge-agnostic `SolutionRecord` output.
- The project constraint remains: deterministic ingestion, no LLM calls, CLI-first, local-only execution.

### Why SEP

- Reflective and recursive language is native there, not translated into engineering jargon.
- Coverage directly supports the current R-axis frontier: phenomenology, process philosophy, philosophy of mind, autopoiesis, epistemology, philosophy of science, cybernetics-adjacent topics.
- Entry structure is consistent: preamble, numbered sections, bibliography, related entries.
- Graph affordances are first-class: related entries and bibliographies provide deterministic edge sources.
- There is no auth barrier and no bespoke API requirement; well-structured HTML is sufficient.

### Why SEP Now

- `02-Knowledge/motifs/r-axis-status-20260311.md` freezes the current interpretation that a standalone Tier 2 recurse operator is doubtful and that Tier 3 compositional inquiry is now the frontier.
- `02-Knowledge/motifs/arxiv-reflective-raxis-test-20260311.md` demonstrates that arXiv is poor at surfacing reflective recurse vocabulary even when mechanistic recurse signal is strong.
- SEP is therefore not just “another source”; it is the first source explicitly chosen to test substrate bias.

## Scope

### In Scope

- `SEP` adapter implementing the existing `ForgeAdapter` interface
- HTML fetching and deterministic parsing of SEP entry pages
- Entry discovery via `contents.html`, direct slug addressing, and/or SEP search endpoint
- Preamble plus first section extraction as primary content source
- Related Entries extraction as native graph edges
- Bibliography extraction as secondary edge material where deterministic and feasible
- Topic derivation from Table of Contents categorization and entry-local metadata/related entries
- Record assembly into `SolutionRecord` JSON-LD format
- Trust heuristic adapted for encyclopedic signals
- SQLite index integration
- CLI support: `ocp scrape --source sep --topic <keyword> --limit N`
- MCP parity so Atlas can invoke SEP scraping like other sources
- Polite rate limiting appropriate for a small academic website
- Idempotent re-scraping keyed on stable SEP slug

### Out of Scope

- Full entry text extraction beyond preamble + first section
- PDF extraction
- LLM-based classification
- Changes to existing GitHub or arXiv adapters
- Template, search enhancement, federation, or web UI work

## Known Constraints

- SEP is a small academic operation and must be scraped very politely.
- There is no official public JSON API requirement for v1; HTML parsing must be robust to moderate markup drift.
- Topic/category structure may be partly implicit in `contents.html`, so categorization logic must be deterministic and inspectable.
- Bibliography extraction is useful but may be uneven across entries; it must degrade gracefully.
- Reflective richness is high, but implementation adjacency is lower than GitHub/arXiv, so records may be stronger on conceptual structure than engineering detail.

## Success Criteria (ISC)

### Forge Adapter

- [ ] ISC-SEP-Forge-1: `SepAdapter` implements `ForgeAdapter` without changing `src/types/forge.ts` | Verify: Read `src/forge/sep.ts`
- [ ] ISC-SEP-Forge-2: Entry slugs map to stable record IDs and re-scraping updates records idempotently | Verify: Read adapter + run scrape twice
- [ ] ISC-SEP-Forge-3: Adapter supports deterministic topic/keyword search using SEP contents and/or SEP search endpoint | Verify: CLI scrape by keyword
- [ ] ISC-SEP-Forge-4: `getRepo(owner, repo)` works with `owner=sep` and `repo=<slug>` | Verify: CLI/adapter test

### Extraction

- [ ] ISC-SEP-Extract-1: Entry parser extracts title, author list, preamble, first section, related entries, bibliography references where feasible, and canonical URL | Verify: Read extraction code + inspect sample record
- [ ] ISC-SEP-Extract-2: Preamble + first section are used as the primary content source analogous to README/abstract | Verify: Inspect assembled record
- [ ] ISC-SEP-Extract-3: Topic/category derivation from `contents.html` or deterministic entry metadata is preserved in record keywords/domains mapping | Verify: Inspect assembled record
- [ ] ISC-SEP-Extract-4: Parser handles sparse or structurally variant entries gracefully without crashing | Verify: Tests with entry fixtures

### Record Assembly

- [ ] ISC-SEP-Record-1: SEP entries assemble into valid `SolutionRecord` JSON-LD matching existing schema | Verify: Typecheck + inspect emitted record
- [ ] ISC-SEP-Record-2: `problemSolved.statement` is derived deterministically from entry preamble/first section without LLM calls | Verify: Read assembly logic
- [ ] ISC-SEP-Record-3: `implementation.refs` includes canonical SEP entry URL and section anchors where relevant | Verify: Inspect sample record
- [ ] ISC-SEP-Record-4: provenance clearly identifies source as SEP | Verify: Inspect record JSON

### Trust

- [ ] ISC-SEP-Trust-1: Trust vector maps encyclopedic signals deterministically (author count, revision/update signal where available, related-entry count, bibliography size, structural completeness) | Verify: Read trust logic
- [ ] ISC-SEP-Trust-2: SEP trust scoring does not reuse GitHub or arXiv heuristics directly | Verify: Read trust mapping
- [ ] ISC-SEP-Trust-3: Missing bibliography/related-entry data degrades gracefully rather than collapsing trust computation | Verify: Tests with sparse fixtures

### Store / Index

- [ ] ISC-SEP-Store-1: SEP records index into SQLite via existing `SearchIndex.index` path without schema change to `SolutionRecord` | Verify: Run scrape + inspect DB stats
- [ ] ISC-SEP-Store-2: SEP records are searchable by title, preamble terms, and first-section terms after scrape | Verify: `ocp search`
- [ ] ISC-SEP-Store-3: Related Entries create deterministic graph edges and bibliography-derived edges are either created deterministically or omitted cleanly | Verify: Inspect graph stats / code path

### CLI / MCP

- [ ] ISC-SEP-CLI-1: `ocp scrape --source sep --topic <keyword> --limit N` works end-to-end | Verify: CLI run
- [ ] ISC-SEP-CLI-2: CLI supports SEP-relevant discovery by keyword/slug without breaking GitHub/arXiv paths | Verify: Read CLI + run examples
- [ ] ISC-SEP-CLI-3: MCP scraping path can invoke SEP source the same way as GitHub/arXiv sources | Verify: Read MCP tool wiring + test invocation

### End-to-End

- [ ] ISC-SEP-E2E-1: Scraping a known reflective keyword (e.g. `autopoiesis`, `phenomenology`, `process philosophy`) produces valid records on disk | Verify: CLI run + inspect files
- [ ] ISC-SEP-E2E-2: Search returns SEP-ingested records by title or preamble terms | Verify: `ocp search`
- [ ] ISC-SEP-E2E-3: Inspect returns full detail for a known SEP record ID | Verify: `ocp inspect`

### Anti-Criteria

- [ ] ISC-SEP-A-LLM-1: No LLM calls are added anywhere in SEP pipeline | Verify: Grep for AI/LLM usage
- [ ] ISC-SEP-A-Fulltext-1: No full-entry extraction beyond preamble + first section is added in v1 | Verify: Read parser scope + tests
- [ ] ISC-SEP-A-Adapter-1: `ForgeAdapter` interface remains unchanged | Verify: Diff scope
- [ ] ISC-SEP-A-Phase2-1: No template/federation/web UI work is bundled into SEP adapter implementation | Verify: Diff scope

## Slices

### Slice 1 - SEP Adapter Skeleton And Discovery Model

**Delivers**

- `SepAdapter` implementing `ForgeAdapter`
- deterministic discovery strategy using SEP contents page and/or SEP search endpoint
- slug normalization and stable ID mapping

**Acceptance Criteria**

- Adapter compiles against existing `ForgeAdapter` interface
- Slug mapping is deterministic and documented
- Search/discovery path works for at least one keyword and one known slug

**Dependencies**

- Existing forge interface in `src/types/forge.ts`

**Estimated Complexity**

- Medium

### Slice 2 - HTML Parsing And Content Extraction

**Delivers**

- deterministic parser for SEP entry pages
- extraction of preamble, first section, authors, related entries, bibliography references, canonical URL
- graceful handling of structural variation

**Acceptance Criteria**

- Sample entry fixtures parse into stable internal objects
- Missing bibliography/related-entry structures do not crash extraction
- Preamble and first section are available as primary content

**Dependencies**

- Slice 1 complete

**Estimated Complexity**

- Medium-High

### Slice 3 - Record Assembly And SEP Trust Heuristic

**Delivers**

- SEP-to-`SolutionRecord` assembly path
- deterministic topic derivation from contents/category structure
- encyclopedic trust heuristic

**Acceptance Criteria**

- Emitted records validate against existing schema types
- Trust vector uses SEP-native signals rather than GitHub/arXiv proxies
- Provenance and implementation refs are complete and inspectable

**Dependencies**

- Slice 2 complete

**Estimated Complexity**

- High

### Slice 4 - Graph Edges, Storage, And Search Verification

**Delivers**

- related-entry edges and optional bibliography-derived secondary edges
- SEP records indexed into SQLite via current store path
- end-to-end proof that SEP records are actually searchable

**Acceptance Criteria**

- SEP records appear in status counts and inspect path
- title/preamble/first-section search returns known ingested records
- related-entry graph edges are visible in graph enrichment/stats or equivalent inspection path

**Dependencies**

- Slice 3 complete

**Estimated Complexity**

- Medium-High

### Slice 5 - CLI And MCP Integration

**Delivers**

- CLI support for `--source sep`
- parameter handling for SEP keyword/slug/topic discovery
- MCP integration path consistent with current scrape tooling

**Acceptance Criteria**

- CLI invocation works end-to-end for at least one reflective keyword
- MCP can trigger SEP scrape using same source model as GitHub/arXiv
- Existing GitHub/arXiv paths still behave as before

**Dependencies**

- Slice 4 complete

**Estimated Complexity**

- Medium

### Slice 6 - End-to-End Proof And Reflective Retrieval Check

**Delivers**

- end-to-end scrape, index, search, inspect verification for SEP
- regression tests covering sparse entries, related-entry extraction, bibliography extraction, and idempotent re-scrape
- proof that SEP retrieves reflective vocabulary which arXiv failed to surface directly

**Acceptance Criteria**

- `ocp scrape --source sep --topic autopoiesis --limit N` or equivalent known reflective query produces records
- `ocp search` surfaces those records by title or preamble terms
- `ocp inspect <record-id>` returns full record detail
- tests prove no regression in GitHub/arXiv paths

**Dependencies**

- Slices 1-5 complete

**Estimated Complexity**

- Medium

## Governance Notes

- Adam's approval is required before implementation begins, because this expands motif evidence into a new reflective source class.
- Adam's approval is required before adding any external helper service, unofficial API dependency, or PDF/archive enrichment beyond direct SEP HTML and official SEP pages.
- Adam's approval is required before changing the `ForgeAdapter` interface shape, because that would affect GitHub and arXiv paths as well.
- If implementation reveals that `contents.html` and direct entry parsing are insufficiently stable for deterministic ingestion, stop and ask Adam before expanding scope to unofficial APIs or additional scraping infrastructure.

## Falsification

- If SEP entry structure is too inconsistent for robust deterministic extraction, the PRD is too optimistic.
- If SEP content cannot be mapped into `ForgeAdapter` cleanly without severe semantic distortion beyond the arXiv stretch, the adapter pattern needs revision before implementation.
- If related entries and bibliography extraction prove too inconsistent to create meaningful graph edges, the expected advantage over arXiv is overstated.
- If reflective vocabulary remains hard to retrieve even in SEP, the substrate-bias hypothesis is incomplete and the source choice is weaker than expected.
- If SEP records add conceptual richness but not enough structured signal for usable `SolutionRecord` assembly and search, this may be the wrong next source for Phase 1-style deterministic scraping.

## Recommendation

- Proceed with SEP as the first reflective source because it directly tests the substrate-bias hypothesis and supplies native recurse vocabulary absent from GitHub and arXiv.
- Keep v1 narrowly deterministic: preamble + first section, related entries, bibliography-lite, no full-entry extraction.
- Use SEP not just as another corpus, but as a stress test for whether recurse/Tier 3 questions are currently being constrained by evidence substrate rather than by true motif absence.
