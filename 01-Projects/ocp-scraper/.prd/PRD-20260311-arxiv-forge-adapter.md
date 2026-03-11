---
prd: true
id: PRD-20260311-arxiv-forge-adapter
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
verification_summary: "0/26"
parent: null
children: []
---

# OCP Scraper - arXiv Forge Adapter

> Expand OCP Scraper with an `arXiv` forge adapter so motif discovery can ingest direct academic evidence instead of relying only on GitHub proxies.

## STATUS

| What | State |
|------|-------|
| Progress | 0/26 criteria passing |
| Phase | PLAN |
| Next action | Build arXiv adapter slice 1 |
| Blocked by | Nothing, but FTS5 issue should be checked during implementation |

## Problem Statement

The OCP scraper currently ingests from GitHub-class forges only, which creates a systemic skew in the motif library: structural claims are triangulated through what open-source developers chose to publish as code. As the Axiomatic Motif Algebra drives scraping into alien domains like law, materials science, game design, cartography, cryptography, and quantitative systems, GitHub increasingly becomes a proxy rather than primary evidence. arXiv is the highest-value next forge because it provides direct access to academic preprints across physics, mathematics, computer science, biology, economics, statistics, quantitative finance, and electrical engineering. An arXiv adapter reduces proxy distortion while preserving the scraper's deterministic, local, forge-adapter architecture.

## Context

### Architectural Fit

- `src/types/forge.ts` already defines a platform-agnostic `ForgeAdapter` interface.
- `src/forge/github.ts` demonstrates the expected adapter shape.
- `src/types/solution-record.ts` defines the JSON-LD output contract the arXiv adapter must satisfy.
- `src/store/index.ts` already supports forge-agnostic record indexing through `SolutionRecord` upserts.
- The project constraint remains: deterministic ingestion, no per-record LLM calls, CLI-first, local-only execution.

### Why arXiv First

- High domain breadth across exactly the domains where GitHub-only evidence is weakest.
- Free API, no auth requirement, stable arXiv IDs.
- Abstracts provide a deterministic content surface analogous to GitHub README extraction.
- Citation graph and full-text enrichment can be deferred without breaking utility.

### Known Constraint Note: FTS5 Search Bug

- There is a known observed bug in current system behavior: keyword search can return 0 results despite records being indexed and inspectable by known ID.
- Based on current code in `src/store/index.ts`, FTS5 population and rebuild logic exists, so the bug is likely integration/runtime-path specific rather than adapter-specific.
- This PRD treats the FTS5 issue as **adjacent but important**:
  - not a prerequisite to building the arXiv adapter itself,
  - but a prerequisite to claiming end-to-end discovery value for arXiv ingestion.
- Therefore the PRD includes a verification slice to prove arXiv-ingested records are actually searchable.

## Scope

### In Scope

- `arXiv` forge adapter implementing the existing `ForgeAdapter` interface
- arXiv API integration using `api.arxiv.org` Atom/XML responses
- Search by topic/category, keyword, author, and date range
- Metadata extraction: title, authors, abstract, categories, publication date, DOI/arXiv ID, references where available from feed metadata
- Abstract as primary content source
- JSON-LD assembly into existing `SolutionRecord` format
- Trust vector adaptation for academic signals
- SQLite index integration using existing FTS5 + graph pattern
- CLI support: `ocp scrape --source=arxiv --topic=<category> --limit=N`
- MCP parity so Atlas can use arXiv the same way as GitHub scraping
- Idempotent re-scraping keyed on stable arXiv IDs

### Out of Scope

- Full-text PDF extraction
- Citation graph building via external APIs
- LLM-based paper classification
- Changes to existing GitHub adapter behavior
- Template system, search enhancement, federation, or web UI work

## Known Constraints

- arXiv API is unauthenticated and should be used politely; implementation must rate-limit requests conservatively and avoid burst scraping.
- arXiv responses are Atom/XML, so parser choice and namespace handling must be deterministic and robust.
- Abstract-only ingestion means some papers will have weak problem statements or sparse implementation clues.
- Academic signals differ from GitHub signals; trust heuristics must be adapted without inventing unavailable metadata.
- arXiv records may not have dependency graphs in the GitHub sense, so graph-edge behavior will be sparser or use alternate deterministic edges.

## Success Criteria (ISC)

### Forge Adapter

- [ ] ISC-Arxiv-Forge-1: `ArxivAdapter` implements `ForgeAdapter` without changing the interface in `src/types/forge.ts` | Verify: Read `src/forge/arxiv.ts`
- [ ] ISC-Arxiv-Forge-2: arXiv IDs are mapped to stable record IDs and re-scraping updates existing records idempotently | Verify: Read adapter + run scrape twice
- [ ] ISC-Arxiv-Forge-3: Adapter supports deterministic topic/category search against arXiv API | Verify: CLI scrape by category
- [ ] ISC-Arxiv-Forge-4: Adapter supports keyword and author search without LLM inference | Verify: Read adapter query builder + CLI run

### Extraction

- [ ] ISC-Arxiv-Extract-1: Metadata extractor captures title, authors, abstract, categories, published date, updated date, DOI when available, and arXiv ID | Verify: Read extraction code + inspect sample record
- [ ] ISC-Arxiv-Extract-2: Abstract is used as the primary content source analogous to README in GitHub adapter | Verify: Inspect assembled record
- [ ] ISC-Arxiv-Extract-3: arXiv categories are preserved deterministically in record keywords/domains mapping | Verify: Inspect assembled record
- [ ] ISC-Arxiv-Extract-4: XML parsing handles Atom namespaces and missing optional fields gracefully | Verify: Tests with sparse fixtures

### Record Assembly

- [ ] ISC-Arxiv-Record-1: arXiv papers assemble into valid `SolutionRecord` JSON-LD matching existing schema | Verify: Typecheck + inspect emitted record
- [ ] ISC-Arxiv-Record-2: `problemSolved.statement` is derived deterministically from abstract and metadata without LLM calls | Verify: Read assembly logic
- [ ] ISC-Arxiv-Record-3: `implementation.refs` includes canonical arXiv URL and PDF URL when present | Verify: Inspect sample record
- [ ] ISC-Arxiv-Record-4: provenance clearly identifies source as scraped arXiv content | Verify: Inspect record JSON

### Trust

- [ ] ISC-Arxiv-Trust-1: Trust vector maps academic signals deterministically (recency, category relevance, metadata completeness, author signal where available) | Verify: Read trust logic
- [ ] ISC-Arxiv-Trust-2: Citation-dependent logic is optional and degrades gracefully when citations are unavailable | Verify: Tests with no citation fields
- [ ] ISC-Arxiv-Trust-3: arXiv trust scoring does not reuse GitHub star/fork heuristics directly | Verify: Read trust mapping

### Store / Index

- [ ] ISC-Arxiv-Store-1: arXiv records index into SQLite via existing `SearchIndex.index` path without schema changes to `SolutionRecord` | Verify: Run scrape + inspect DB stats
- [ ] ISC-Arxiv-Store-2: arXiv records are searchable via existing FTS5 search path after scrape | Verify: `ocp search` against known abstract terms
- [ ] ISC-Arxiv-Store-3: Graph edges are created deterministically where possible, or omitted cleanly when no dependency-like edges exist | Verify: Read edge logic + inspect stats

### CLI / MCP

- [ ] ISC-Arxiv-CLI-1: `ocp scrape --source arxiv --topic <category> --limit N` works end-to-end | Verify: CLI run
- [ ] ISC-Arxiv-CLI-2: CLI accepts arXiv-relevant search parameters for keyword/author/date range without breaking GitHub path | Verify: Read CLI + run examples
- [ ] ISC-Arxiv-CLI-3: MCP scraping path can invoke arXiv source the same way as GitHub source | Verify: Read MCP tool wiring + test invocation

### End-to-End

- [ ] ISC-Arxiv-E2E-1: Scraping `cs.AI` or similar category produces valid JSON-LD records on disk | Verify: CLI run + inspect files
- [ ] ISC-Arxiv-E2E-2: Search returns arXiv-ingested records by title or abstract terms | Verify: `ocp search`
- [ ] ISC-Arxiv-E2E-3: Inspect returns full detail for a known arXiv record ID | Verify: `ocp inspect`

### Anti-Criteria

- [ ] ISC-Arxiv-A-LLM-1: No LLM calls are added anywhere in arXiv pipeline | Verify: Grep for AI/LLM usage
- [ ] ISC-Arxiv-A-Fulltext-1: No PDF full-text extraction is added in v1 | Verify: Grep for PDF parsing deps
- [ ] ISC-Arxiv-A-GitHub-1: Existing GitHub adapter behavior remains unchanged | Verify: Diff scope + regression test
- [ ] ISC-Arxiv-A-Phase2-1: No template/federation/web UI work is bundled into arXiv adapter implementation | Verify: Diff scope

## Slices

### Slice 1 - arXiv Adapter Skeleton And Query Model

**Delivers**

- `ArxivAdapter` implementing `ForgeAdapter`
- arXiv query builder for category, keyword, author, and date filters
- arXiv ID normalization and stable identifier mapping

**Acceptance Criteria**

- Adapter compiles against existing `ForgeAdapter` interface
- Query builder produces deterministic API query strings
- Stable ID mapping is documented and test-covered

**Dependencies**

- Existing forge interface in `src/types/forge.ts`

**Estimated Complexity**

- Medium

### Slice 2 - Atom/XML Parsing And Metadata Extraction

**Delivers**

- XML parser for arXiv Atom feed entries
- Deterministic extraction of title, authors, abstract, categories, dates, DOI, canonical URLs
- Graceful handling of sparse entries

**Acceptance Criteria**

- Sample arXiv feed fixtures parse into stable internal objects
- Missing DOI/authors/categories do not crash extraction
- Abstract is available as primary content source for record assembly

**Dependencies**

- Slice 1 complete

**Estimated Complexity**

- Medium-High

### Slice 3 - Record Assembly And Trust Adaptation

**Delivers**

- arXiv-to-`SolutionRecord` assembler path
- Academic trust heuristic adaptation
- Deterministic domain/category mapping strategy

**Acceptance Criteria**

- Emitted records validate against existing schema types
- Trust vector uses academic signals rather than GitHub stars/forks
- Provenance and implementation refs are complete and inspectable

**Dependencies**

- Slice 2 complete

**Estimated Complexity**

- High

### Slice 4 - Storage, Search, And FTS5 Verification

**Delivers**

- arXiv records indexed into SQLite via current store path
- verification that FTS5 search actually surfaces arXiv records
- bug note or fix if current FTS5 path fails under arXiv ingestion too

**Acceptance Criteria**

- arXiv records appear in status counts and inspect path
- title/abstract search returns known ingested arXiv records
- if FTS5 bug reproduces, the issue is fixed or isolated with explicit failing evidence before completion

**Dependencies**

- Slice 3 complete

**Estimated Complexity**

- Medium-High

### Slice 5 - CLI And MCP Integration

**Delivers**

- CLI support for `--source arxiv`
- parameter handling for category/keyword/author/date range
- MCP integration path consistent with current scrape tooling

**Acceptance Criteria**

- CLI invocation works end-to-end for at least one category and one keyword query
- MCP can trigger arXiv scrape using same command surface model
- GitHub path still behaves as before

**Dependencies**

- Slice 4 complete

**Estimated Complexity**

- Medium

### Slice 6 - End-to-End Proof And Regression Coverage

**Delivers**

- end-to-end scrape, index, search, inspect verification for arXiv
- regression tests covering sparse XML, DOI presence/absence, idempotent re-scrape, and searchability

**Acceptance Criteria**

- `ocp scrape --source arxiv --topic cs.AI --limit N` produces records
- `ocp search` surfaces those records by title or abstract keywords
- `ocp inspect <record-id>` returns full record detail
- tests prove no regression in GitHub source path

**Dependencies**

- Slices 1-5 complete

**Estimated Complexity**

- Medium

## Governance Notes

- Adam's approval is required before implementation begins, because this expands source-of-truth boundaries for motif evidence beyond GitHub-class forges.
- Adam's approval is required before adding any new external metadata sources beyond arXiv itself (for example Semantic Scholar, Crossref enrichment, citation APIs, or PDF extraction).
- Adam's approval is required before changing the `ForgeAdapter` interface shape, because that would affect multiple existing adapters and MCP behavior.
- If implementation reveals that abstract-only ingestion is too weak to produce acceptable `SolutionRecord` quality, stop and ask Adam before expanding scope into PDF or citation enrichment.

## Falsification

- If arXiv abstracts do not provide enough deterministic signal to produce usable `problemSolved` and trust fields, the PRD is too optimistic.
- If the current `ForgeAdapter` abstraction cannot accommodate arXiv cleanly without force-fitting paper metadata into repository-shaped fields, the adapter pattern needs revision before implementation.
- If search remains effectively broken due to the FTS5 issue and cannot surface arXiv records after ingestion, the practical value of the adapter is undermined until search is repaired.
- If academic trust heuristics cannot be made meaningfully distinct from GitHub heuristics without external services, the v1 scope may be too thin.
- If arXiv ingestion mostly reproduces the same proxy problem because abstracts are too shallow for motif extraction in alien domains, this is the wrong first non-GitHub forge.

## Recommendation

- Proceed with arXiv as the first non-code forge because it best counters the current evidence skew while fitting the existing deterministic adapter model.
- Treat the FTS5 issue as a must-verify integration risk, not an excuse to defer the adapter entirely.
- Keep v1 abstract-only and deterministic; defer citation graph and PDF work to a separate PRD if arXiv proves high value.
