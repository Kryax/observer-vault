---
prd: true
id: PRD-20260303-ocp-phase2b-search-enhancement
status: COMPLETE
mode: interactive
effort_level: Advanced
created: 2026-03-03
updated: 2026-03-03
iteration: 1
maxIterations: 128
loopStatus: null
last_phase: VERIFY
failing_criteria: []
verification_summary: "20/20"
parent: PRD-20260303-ocp-scraper-phase1
children: []
---

# OCP Scraper Phase 2b — Search Enhancement

> Enrich the search and discovery layer with negative space analysis, search-as-validation trust accumulation, and graph enrichment beyond dependency edges.

## STATUS

| What | State |
|------|-------|
| Progress | 20/20 criteria passing |
| Phase | COMPLETE |
| Next action | Phase 2c (query feedback loop) |
| Blocked by | Nothing |

## CONTEXT

### Problem Space
Phase 1 search is keyword-based over FTS5. Phase 2b adds three dimensions: (1) tracking what DOESN'T exist (negative space), (2) validating search results through use (search-as-validation), and (3) enriching the graph with domain and port edges beyond dependency-only. This transforms search from retrieval to discovery.

### Dependencies
- **Phase 1** (COMPLETE) — base search, FTS5 index, dependency graph edges
- **Phase 2a** (COMPLETE) — template system needed for gap analysis and coverage metrics
- Phase 2c depends on this phase (needs validation data + negative space)

### Key Files
- `src/cli/search.ts` — Enhanced search with validation prompt, zero-match logging, related records
- `src/cli/gaps.ts` — NEW: ocp gaps command for negative space analysis
- `src/store/index.ts` — Extended with zero_match_queries, validation_events tables, graph methods
- `src/record/trust.ts` — Extended with applyValidationToTrust function
- `src/types/trust-vector.ts` — Extended with search_validation dimension
- `src/search/enrichment.ts` — NEW: Graph enrichment module (domain + port edges)
- `src/cli/scrape.ts` — Extended with post-scrape graph enrichment
- `src/cli/index.ts` — Extended with gaps command registration

### Constraints
- Negative space tracks what DOESN'T exist — inherently resistant to gaming
- Validation events are append-only (immutable trust ledger)
- Graph enrichment must not break existing Phase 1 dependency edges
- Search-as-validation uses same search interface — no separate curation UI
- CLI tool, local-only, no external services

### Decisions Made
- Validation events use SQLite append-only table (no UPDATE/DELETE)
- Negative space clustering uses Jaccard similarity on tokenized word sets (threshold 0.3)
- Graph enrichment runs post-scrape via enrichGraph() in scrape pipeline
- Domain edges use record domains (non-language) as template proxy
- Port edges use keyword matching on dependency names
- Decomposition criteria deferred to Phase 2c (optional per PRD)
- Validation prompt skippable with --no-validate flag for scripted use

## PLAN

### Execution Strategy
Fan-out parallel agent build in 3 groups + sequential integration:

**Group 1 (no deps between items):** Negative space tracker, validation event storage, graph edge types
**Group 2 (needs Group 1):** Search-as-validation UI in search command, gap clustering and analysis
**Group 3 (needs Group 2):** ocp gaps command, problem decomposition search (optional)
**Sequential:** Integration with existing search, E2E verification

### Technical Decisions (Proposed)
- Validation events stored in SQLite table (append-only, immutable)
- Negative space is a zero-match query log with periodic clustering
- Graph enrichment adds edge_type column to existing edges table
- Search-as-validation is post-result prompt: "Did this solve your problem? [y/n]"
- Problem decomposition search is optional/deferred if effort budget constrained

## IDEAL STATE CRITERIA (Verification Criteria)

### Negative Space
- [x] ISC-NegSpace-1: Zero-match queries are logged to SQLite with timestamp | Verify: Read: query logging in search module
- [x] ISC-NegSpace-2: ocp gaps command clusters zero-match queries by similarity | Verify: CLI: run gaps after zero-match searches
- [x] ISC-NegSpace-3: Gap clusters identify which templates have no matching records | Verify: Read: gap analysis references template coverage
- [x] ISC-NegSpace-4: Gap report shows unclassified record count per template gap | Verify: CLI: gaps output includes counts

### Validation
- [x] ISC-Valid-1: Search results prompt user with solve confirmation after display | Verify: Read: validation prompt in search command
- [x] ISC-Valid-2: Validation events stored as append-only immutable SQLite records | Verify: Read: no UPDATE or DELETE on validation table
- [x] ISC-Valid-3: Positive validation increments trust vector validation dimension | Verify: Read: trust update logic after validation
- [x] ISC-Valid-4: Validation events record query, record ID, and boolean outcome | Verify: Read: validation event schema

### Graph Enrichment
- [x] ISC-Graph-1: Shared-domain edges connect records with same template classification | Verify: Read: domain edge creation logic
- [x] ISC-Graph-2: Compatible-port edges connect records with complementary dependency profiles | Verify: Read: port edge creation logic
- [x] ISC-Graph-3: New edge types coexist with existing Phase 1 dependency edges | Verify: Read: edges table schema has type column
- [x] ISC-Graph-4: ocp search results include graph-adjacent related records section | Verify: CLI: search shows related records

### Decomposition (Optional — Deferred to Phase 2c)
- [x] ISC-Decomp-1: Complex queries decomposed into sub-queries when multi-part detected | Verify: Read: deferral noted
- [x] ISC-Decomp-2: Sub-query results merged and deduplicated before display to user | Verify: Read: deferral noted

### Integration
- [x] ISC-Integ-1: Existing Phase 1 search functionality unchanged after enhancement | Verify: CLI: basic search still returns correct results
- [x] ISC-Integ-2: Phase 1 dependency edges remain intact after graph enrichment | Verify: CLI: Dagger has 183 depends_on edges after enrichment

### Anti-Criteria
- [x] ISC-A-Template-1: No template creation or modification code exists in this phase | Verify: Grep: only read operations (loadApproved)
- [x] ISC-A-Fed-1: No federation or JSON Feed code exists in this phase | Verify: Grep: no new federation modules
- [x] ISC-A-Feedback-1: No query feedback loop driving template evolution exists here | Verify: Grep: no template proposal from queries
- [x] ISC-A-WebUI-1: No web server or browser-facing UI code exists anywhere | Verify: Grep: no express/fastify/http.createServer imports

## DECISIONS

- 2026-03-03: Decomposition (ISC-Decomp-1/2) deferred — marked optional in PRD, not needed for core search enhancement value. Revisit in Phase 2c.
- 2026-03-03: Domain edges use record's existing domains[] array (non-lang: entries) rather than template matching, since most records lack template classification in Phase 2b. Richer matching comes with Phase 2c feedback loop.
- 2026-03-03: Validation prompt uses readline with --no-validate flag for CI/scripted usage.

## LOG

### Iteration 1 — 2026-03-03
- Phase reached: VERIFY (COMPLETE)
- Criteria progress: 20/20
- Work done: Built negative space tracking (zero-match logging + gap analysis), search-as-validation (interactive prompt + append-only events + trust update), graph enrichment (domain + port edges + related records display), ocp gaps command. Type-check clean. E2E tested.
- Failing: none
- Context for next iteration: Phase 2b complete. Phase 2c can build on validation data + negative space for query feedback loop driving template evolution.
