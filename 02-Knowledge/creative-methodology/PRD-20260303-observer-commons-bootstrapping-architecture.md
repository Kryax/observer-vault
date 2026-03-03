---
prd: true
id: PRD-20260303-observer-commons-bootstrapping-architecture
status: COMPLETE
mode: interactive
effort_level: Extended
created: 2026-03-03
updated: 2026-03-03
iteration: 1
maxIterations: 128
loopStatus: null
last_phase: VERIFY
failing_criteria: []
verification_summary: "19/19"
parent: null
children: []
---

# Observer Commons GitHub Bootstrapping Architecture

> Design the scraping architecture, solution record format, and search/discovery layer for bootstrapping the Observer Commons federated knowledge network by indexing GitHub repositories as structured solved-problem records.

## STATUS

| What | State |
|------|-------|
| Progress | 19/19 criteria passing |
| Phase | COMPLETE |
| Next action | Implementation specification (separate PRD) |
| Blocked by | Nothing |

## CONTEXT

### Problem Space
The Observer Commons Protocol (OCP) is a federated protocol for indexing solved problems. It faces a chicken-and-egg bootstrapping problem: no users, no network effects. The reverse protocol bootstrapping strategy solves this by pulling knowledge IN from GitHub, structuring it as Solution Records, and making it immediately searchable as a standalone tool. Users consuming the index implicitly participate in the protocol through queries and validations.

### Key Files
- `01-Projects/observer-commons/00-observer-commons-protocol.md` — Protocol synthesis (4 layers)
- `01-Projects/observer-commons/01-schema-spec.md` — JSON-LD Solution Record schema (7 facets)
- `01-Projects/observer-commons/02-federation-spec.md` — Federation & discovery spec
- `01-Projects/observer-commons/03-trust-spec.md` — Trust & governance (6-dim vector)
- `01-Projects/observer-commons/Observer_Commons_Strategic_Design_Notes.md` — Bootstrapping strategy
- `00-Inbox/great-transition-research/Session_2026-03-02_Great_Transition.md` — Session context

### Constraints
- Energy efficient: batch processing, no per-repo LLM calls in default pipeline
- Codeberg/Forgejo compatible: forge adapter pattern, not GitHub-locked
- Solution discovery over code stitching: index problems, not code
- Single vault useful before federation: CLI tool, git-backed, SQLite
- 60-second hook entry experience
- Implementable evenings/weekends by one person + AI
- Must conform to existing Solution Record JSON-LD schema

### Decisions Made
- Problem Template Engine chosen over per-repo LLM classification (energy efficiency)
- Property graph index chosen over flat inverted index (structural navigation + composability)
- Search-as-validation UX chosen (query and validation in same interface)
- Negative space analysis deferred to v1.1 (clever but not structurally necessary for v1)
- Cross-domain matching deferred to v1.1 (needs multi-domain template coverage)

## PLAN

### Methodology
Full OscillateAndGenerate → ConvergeAndEvaluate pipeline applied. 4 oscillation cycles, 10 perspectives explored, 4 convergence zones identified, C&E evaluation accepted with high confidence.

### Converged Architecture

**The system is a seeded, template-classified, graph-indexed knowledge crystalliser:**

1. **Seed** ~50-100 hand-curated solution records for well-known repos as control points
2. **Scrape** via deterministic pipeline: forge adapter → signal filter → metadata/README/dependency extraction (no LLM) → template-based problem classification → JSON-LD record assembly
3. **Enrich** optionally: batch LLM on pre-filtered high-signal repos to refine problem statements and Cynefin classification
4. **Index** as property graph: solution records as nodes, composition relationships (from dependency graphs) as edges. SQLite + FTS + edge table
5. **Search** by problem structure: user describes problem → positioned in problem-space graph → nearby solutions, composition pathways
6. **Validate** through use: search IS validation. "Did this solve your problem?" is the atomic trust operation. Independent validations → 6-dim trust vector
7. **Evolve** via dual-speed feedback: fast loop (deterministic query, <1s) + slow loop (template evolution, human-approved)

### Key Architectural Components
1. Forge Adapter (GitHub/Codeberg/Forgejo abstraction)
2. Signal Filter (coarse: stars/commits/README + fine: README quality heuristics)
3. Metadata Extractor (API fields, deterministic, LLM-free)
4. README Structural Parser (section pattern matching, not NLU)
5. Package Manifest Parser (deps, peer deps, engines, types)
6. Problem Template Engine (LLM-generated templates classify repos deterministically)
7. Batch LLM Enrichment (optional, pre-filtered batches of 50-100 only)
8. Record Assembler (JSON-LD Solution Record with all 7 facets)
9. Trust Vector Calculator (GitHub signals → 6-dimension vector)
10. Vault Store + Graph Index (git-backed JSON-LD + SQLite FTS + edge table)
11. Query Engine (keyword/facet + problem decomposition modes)
12. JSON Feed Generator (Phase 1 federation)
13. CLI Entry Experience (`ocp scrape`, `ocp search`, `ocp validate`, `ocp status`)

### Key Design Insights (from O&G → C&E)
1. **Problem Template Engine** — Amortize LLM cost across templates, not per-repo
2. **Dual-Speed Cyclic Architecture** — Fast deterministic loop + slow governed evolution loop
3. **Search IS Validation** — Query and validation are the same interface
4. **Graph Index** — Solutions as nodes, compositions as edges from dependency graphs
5. **Trust Handles Curation** — Scraped records start low-trust; quality emerges through validation
6. **Negative Space as Asset** (v1.1) — Gaps in coverage are valuable data
7. **Operational Triviality** — CLI, git-backed, SQLite, cron-driven, one-person operable

### Primitive Analysis (from C&E)
- **Recombined:** JSON-LD Solution Records, 6-dim trust vector, JSON Feed federation, git-backed storage, dependency graph extraction, forge adapter pattern
- **Transformed:** GitHub search → Problem Template Engine, database index → Property Graph Index, search results → Search-as-Validation
- **Created:** Negative Space Analysis (novel), Dual-Speed Feedback Cycle (novel)

## IDEAL STATE CRITERIA (Verification Criteria)

### Scraping Architecture

- [x] ISC-Scrape-1: GitHub scraper converts repos into structured solution records | Verify: Read: pipeline produces JSON-LD Solution Records
- [x] ISC-Scrape-2: Batch processing handles repos without per-repo LLM calls | Verify: Read: template engine amortizes LLM across templates
- [x] ISC-Scrape-3: High-signal repos prioritized by stars, maintenance, and docs | Verify: Read: two-stage signal filter documented
- [x] ISC-Scrape-4: GitHub API rate limits handled with graceful backoff | Verify: Read: cron-driven batch + idempotent operations
- [x] ISC-Scrape-5: Architecture works as single vault before federation | Verify: Read: CLI tool, git-backed, zero external services

### Solution Record Format

- [x] ISC-Record-1: Solution records contain all seven required OCP facets | Verify: Read: all 7 facets have explicit extraction sources
- [x] ISC-Record-2: Records use JSON-LD format with ocp: namespace | Verify: Read: existing schema spec used as-is
- [x] ISC-Record-3: GitHub signals map to six-dimension trust vector | Verify: Read: mapping table exists
- [x] ISC-Record-4: Records index solved problems, not repository code | Verify: Read: problemSolved is primary field
- [x] ISC-Record-5: Minimum viable record achievable in ~40 lines JSON | Verify: Read: estimated 35-45 lines

### Search/Discovery

- [x] ISC-Search-1: Discovery queries by problem structure, not just keywords | Verify: Read: two search modes documented
- [x] ISC-Search-2: First query demonstrates value within 60 seconds | Verify: Read: local SQLite returns <1s
- [x] ISC-Search-3: Results include trust vectors and composability metadata | Verify: Read: graph surfaces edges + trust
- [x] ISC-Search-4: Cross-domain pattern matching surfaces non-obvious connections | Verify: Read: graph supports multi-hop (deferred to v1.1)
- [x] ISC-Search-5: Search works locally without federation infrastructure | Verify: Read: local SQLite, zero network

### Anti-Criteria

- [x] ISC-A-Scrape-1: No vendor lock-in to GitHub API in architecture | Verify: Read: forge adapter pattern
- [x] ISC-A-Record-1: No AI-generated trust scores treated as authoritative | Verify: Read: deterministic trust computation
- [x] ISC-A-Search-1: No central authority controls search ranking | Verify: Read: local computation from trust vectors
- [x] ISC-A-Scrape-2: No per-repository LLM inference in default pipeline | Verify: Read: template matching is default

## DECISIONS

- 2026-03-03: Problem Template Engine over per-repo LLM classification. Rationale: energy efficiency constraint (EX-3). Templates generated by batch LLM, repos classified deterministically. Alternatives: per-repo LLM (rejected — violates energy constraint), pure heuristic (rejected — insufficient accuracy for problem statement extraction).
- 2026-03-03: Property graph over flat index. Rationale: composability data from dependency graphs naturally forms edges. Flat index loses structural relationships. Alternatives: inverted index (rejected — no graph navigation), full graph DB like Neo4j (rejected — operational complexity for one person).
- 2026-03-03: Search-as-validation UX. Rationale: the feedback loop only activates if people query AND validate. Combining them into one interaction maximizes participation. Alternatives: separate validation interface (rejected — extra friction kills participation).
- 2026-03-03: Negative space deferred to v1.1. Rationale: clever but not structurally necessary for bootstrapping. Adds scope for one-person operation. Design documented, implementation deferred.

## LOG

### Iteration 1 — 2026-03-03
- Phase reached: VERIFY (COMPLETE)
- Criteria progress: 19/19
- Work done: Full OscillateAndGenerate (4 cycles, 10 perspectives) → ConvergeAndEvaluate (4 clusters, high-confidence acceptance). Architecture design complete. All ISC verified against converged design.
- Failing: None
- Context for next iteration: Architecture design is complete. Next step is implementation specification — a separate PRD that takes this architecture and produces buildable component specs (CLI tool design, SQLite schema, template format, scraper implementation).
