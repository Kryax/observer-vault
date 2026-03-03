---
prd: true
id: PRD-20260303-ocp-phase2c-feedback-evolution
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
verification_summary: "16/16"
parent: PRD-20260303-ocp-scraper-phase1
children: []
---

# OCP Scraper Phase 2c — Feedback & Evolution

> Wire the query feedback loop and dual-speed cycle that connects real-time search to slow-loop ontology evolution through human-governed template proposals.

## STATUS

| What | State |
|------|-------|
| Progress | 16/16 criteria passing |
| Phase | COMPLETE |
| Next action | None — Phase 2c complete |
| Blocked by | Nothing |

## CONTEXT

### Problem Space
Phase 2a creates templates. Phase 2b tracks gaps and validation. Phase 2c closes the loop: query patterns drive template evolution through batch LLM analysis, with human approval as the gate. The dual-speed cycle separates fast deterministic search from slow governed ontology changes.

### Dependencies
- **Phase 1** (COMPLETE) — base pipeline and CLI
- **Phase 2a** (REQUIRED) — template system and governance CLI for proposals
- **Phase 2b** (REQUIRED) — negative space data, validation events, gap tracking
- Nothing depends on this phase (2c is a capstone for Phase 2)

### Key Files (from Phase 2a/2b)
- Template governance CLI — 2c proposes templates through same governance pipeline
- Negative space tracker — 2c reads zero-match clusters for feedback
- Validation event store — 2c reads validation data for coverage metrics
- `src/cli/` — Coverage dashboard command added here

### Constraints
- Template proposals from feedback loop go through same governance as 2a (human approval required)
- Coverage dashboard is CLI output, not web UI
- Dual-speed cycle has three temporal layers: batch scraping (periodic), real-time queries (on-demand), template evolution (slow, governed)
- No autonomous template approval — human always decides

### Decisions Made
- Reused Jaccard clustering from gaps.ts (exported functions) rather than duplicating
- query_log table tracks ALL queries (not just zero-match) for richer analytics
- Feedback proposals use proposedBy: 'feedback-analyzer' to distinguish from batch-generator
- Category derivation uses same heuristic mapping as template/generator.ts for consistency

## PLAN

### Execution Strategy
Mostly sequential due to tight inter-dependencies:

**Group 1 (parallel):** Query logger enhancement (if not already from 2b), coverage metric calculations
**Group 2 (needs Group 1):** Batch LLM query analysis, template proposal generation from clusters
**Sequential:** Dual-speed cycle wiring, ocp coverage command, integration testing

### Technical Decisions (Proposed)
- Query log analysis is batch LLM (same pattern as 2a batch generation)
- Coverage metrics: template hit rate, gap density, unclassified ratio
- Dual-speed wiring is architectural — no new services, just CLI commands that read from both fast (index) and slow (template governance) stores
- `ocp coverage` outputs tabular CLI report

## IDEAL STATE CRITERIA (Verification Criteria)

### Feedback Loop
- [x] ISC-Feedback-1: All search queries logged with timestamp and match count | Verify: Read: query logging captures all searches
- [x] ISC-Feedback-2: Batch LLM analysis identifies clusters from zero-match query logs | Verify: Read: clustering logic over query log
- [x] ISC-Feedback-3: Clustered query patterns generate template proposals automatically | Verify: Read: proposal generation from clusters
- [x] ISC-Feedback-4: Generated proposals enter same governance pipeline as Phase 2a | Verify: Read: proposals use template propose command
- [x] ISC-Feedback-5: Human approval required before any proposed template becomes active | Verify: Grep: no auto-approve path in feedback loop

### Coverage Dashboard
- [x] ISC-Coverage-1: ocp coverage command shows template hit rate percentage | Verify: CLI: run coverage and check output
- [x] ISC-Coverage-2: Coverage output shows gap density across template categories | Verify: CLI: coverage output includes gap counts
- [x] ISC-Coverage-3: Coverage output shows total unclassified record count clearly | Verify: CLI: coverage shows unclassified count
- [x] ISC-Coverage-4: Coverage dashboard is CLI tabular output not web interface | Verify: Read: no HTTP server in coverage command

### Dual-Speed Cycle
- [x] ISC-Dual-1: Fast loop returns search results deterministically under one second | Verify: CLI: time search query execution
- [x] ISC-Dual-2: Slow loop connects query patterns to template governance proposals | Verify: Read: feedback loop triggers governance pipeline
- [x] ISC-Dual-3: Three temporal layers documented and architecturally separated in code | Verify: Read: separation between scrape/query/evolution modules

### Anti-Criteria
- [x] ISC-A-Fed-1: No federation or JSON Feed code exists in this phase | Verify: Grep: no feed/federation modules
- [x] ISC-A-WebUI-1: No web server or browser-facing UI code exists anywhere | Verify: Grep: no express/fastify/http.createServer imports
- [x] ISC-A-Pipeline-1: No changes to base Phase 1 scraping pipeline logic | Verify: Read: scrape command unchanged from Phase 1
- [x] ISC-A-AutoApprove-1: No autonomous template approval path bypassing human decision | Verify: Grep: no auto-approve or skip-governance flags

## DECISIONS

- 2026-03-03: Reuse Jaccard clustering from gaps.ts via export rather than duplicating. Keeps single source of truth for clustering algorithm.
- 2026-03-03: query_log table captures ALL queries (not just zero-match). Enables richer analytics in coverage dashboard (total queries, avg match rate).
- 2026-03-03: Feedback proposals use `proposedBy: 'feedback-analyzer'` to distinguish from Phase 2a `batch-generator` proposals.
- 2026-03-03: Category derivation in feedback analyzer mirrors template/generator.ts heuristics for consistency.

## LOG

### Iteration 1 — 2026-03-03
- Phase reached: VERIFY
- Criteria progress: 16/16
- Work done: Built full Phase 2c — query logging (store layer + search integration), feedback analyzer (cluster-to-proposal), feedback CLI command, coverage dashboard CLI, CLI registration
- Failing: none
- Files created: src/cli/coverage.ts, src/feedback/analyzer.ts, src/cli/feedback.ts
- Files modified: src/store/index.ts (query_log table + methods), src/cli/search.ts (log all queries), src/cli/gaps.ts (export clustering), src/cli/index.ts (register commands)
- Type-check: clean (zero errors)
- CLI verification: all commands functional with live data
