---
prd: true
id: PRD-20260303-ocp-scraper-phase1
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
verification_summary: "34/34"
parent: null
children: []
---

# OCP Scraper Phase 1 — CLI Tool Build

> Build the OCP Scraper CLI tool that transforms GitHub repositories into structured JSON-LD Solution Records for the Observer Commons federated knowledge network.

## STATUS

| What | State |
|------|-------|
| Progress | 34/34 criteria passing |
| Phase | COMPLETE |
| Next action | None — Phase 1 complete |
| Blocked by | Nothing |

## CONTEXT

### Problem Space
The Observer Commons Protocol needs a bootstrapping tool to pull knowledge from GitHub, structure it as Solution Records, and make it searchable. This CLI tool is Phase 1 — deterministic scraping, no LLM calls, local-only operation.

### Key Files
- `CLAUDE.md` — Full project spec with architecture, stack, constraints
- `.prd/PRD-20260303-observer-commons-bootstrapping-architecture.md` (parent vault) — Architecture design (COMPLETE, 19/19)
- `01-Projects/observer-commons/01-schema-spec.md` — JSON-LD Solution Record schema (7 facets)
- `01-Projects/observer-commons/03-trust-spec.md` — Trust vector (6 dimensions, CTS formula)

### Constraints
- NO per-repo LLM calls — deterministic pipeline only
- NO vendor lock-in — forge adapter pattern
- NO external services — local CLI only
- Bun runtime, TypeScript strict mode
- GITHUB_TOKEN for API access
- Idempotent re-scraping
- Graceful per-repo failure handling

### Decisions Made
- bun:sqlite over better-sqlite3 (Bun built-in, zero deps)
- Commander.js for CLI framework
- marked for markdown parsing
- smol-toml for TOML parsing
- Records stored as .jsonld files in records/<domain>/
- Index in .ocp/index.db (gitignored)

## PLAN

### Execution Strategy
Fan-out parallel agent build in 3 groups + sequential CLI wiring:

**Group 1 (no deps):** scaffold, types, forge adapter, signal filter
**Group 2 (needs types):** metadata extractor, README parser, dependency analyzer
**Group 3 (needs extractors):** record assembler, trust calculator, storage layer
**Sequential:** CLI commands, entry point, E2E verification

### Technical Decisions
- JSON-LD @context inlined (not URL-referenced) per schema spec draft guidance
- Trust vector computed deterministically from GitHub API signals
- CTS uses weighted geometric mean with exact weights from trust spec
- SQLite FTS5 for full-text search, separate edges table for graph
- Cynefin domain defaulted to "complex" for scraped repos (most GitHub projects)

## IDEAL STATE CRITERIA (Verification Criteria)

### Scaffold
- [ ] ISC-Scaffold-1: Project has package.json with all required dependencies listed | Verify: Read: package.json
- [ ] ISC-Scaffold-2: tsconfig.json configured for Bun with strict mode enabled | Verify: Read: tsconfig.json
- [ ] ISC-Scaffold-3: Directory structure matches target layout from CLAUDE.md spec | Verify: Glob: all dirs

### Types
- [ ] ISC-Types-1: SolutionRecord type covers all seven required OCP facets | Verify: Read: solution-record.ts
- [ ] ISC-Types-2: TrustVector type has exactly six named float dimensions | Verify: Read: trust-vector.ts
- [ ] ISC-Types-3: ForgeAdapter interface is platform-agnostic with no GitHub-specific types | Verify: Read: forge.ts

### Forge
- [ ] ISC-Forge-1: GitHub adapter implements ForgeAdapter interface using Octokit | Verify: Read: github.ts
- [ ] ISC-Forge-2: GitHub adapter reads GITHUB_TOKEN from environment variable | Verify: Grep: GITHUB_TOKEN

### Filter
- [ ] ISC-Filter-1: Coarse filter removes repos by stars, commits, README presence | Verify: Read: coarse.ts
- [ ] ISC-Filter-2: Fine filter evaluates README structural quality heuristically | Verify: Read: fine.ts

### Extract
- [ ] ISC-Extract-1: Metadata extractor pulls all GitHub API fields deterministically | Verify: Read: metadata.ts
- [ ] ISC-Extract-2: README parser extracts sections by structural pattern matching | Verify: Read: readme.ts
- [ ] ISC-Extract-3: Dependency analyzer parses four manifest formats correctly | Verify: Read: dependencies.ts

### Record
- [ ] ISC-Record-1: Assembler produces valid JSON-LD with ocp: namespace context | Verify: Read: assembler.ts
- [ ] ISC-Record-2: Trust vector calculator maps GitHub signals to six dimensions | Verify: Read: trust.ts
- [ ] ISC-Record-3: CTS uses weighted geometric mean with specified default weights | Verify: Read: trust.ts

### Store
- [ ] ISC-Store-1: Records saved as JSON-LD files in records/<domain>/ directory | Verify: Grep: records/ path
- [ ] ISC-Store-2: SQLite index at .ocp/index.db with FTS and edges table | Verify: Read: index.ts
- [ ] ISC-Store-3: Re-scraping same repo updates existing record, not duplicates | Verify: Read: upsert logic

### CLI
- [ ] ISC-CLI-1: ocp scrape command accepts --source, --topic, --limit flags | Verify: Read: scrape.ts
- [ ] ISC-CLI-2: ocp search command accepts query string and returns matches | Verify: Read: search.ts
- [ ] ISC-CLI-3: ocp status command shows index statistics summary | Verify: Read: status.ts
- [ ] ISC-CLI-4: ocp inspect command displays single record detail by ID | Verify: Read: inspect.ts
- [ ] ISC-CLI-5: ocp seed command creates record from single repo URL | Verify: Read: seed.ts
- [ ] ISC-CLI-6: CLI entry point wired as bin command via package.json | Verify: Read: package.json

### End-to-End
- [ ] ISC-E2E-1: Full pipeline scrapes GitHub repos and produces JSON-LD files | Verify: CLI: run scrape
- [ ] ISC-E2E-2: Search returns results after scraping completes successfully | Verify: CLI: run search
- [ ] ISC-E2E-3: Status command shows correct counts after scraping completes | Verify: CLI: run status

### Robustness
- [ ] ISC-Robust-1: Individual repo failures do not halt the scraping pipeline | Verify: Read: error handling

### Anti-Criteria
- [ ] ISC-A-LLM-1: No LLM or AI inference calls exist in scraping pipeline | Verify: Grep: no AI imports
- [ ] ISC-A-Vendor-1: ForgeAdapter interface contains no GitHub-specific API types | Verify: Read: forge/types.ts
- [ ] ISC-A-External-1: No HTTP calls to external services besides GitHub API | Verify: Grep: no fetch/axios
- [ ] ISC-A-Phase2-1: No template engine, federation, or web UI code exists | Verify: Grep: no Phase 2 modules
- [ ] ISC-A-Daemon-1: No long-running server or daemon process in codebase | Verify: Grep: no server imports

## DECISIONS

## LOG

### Iteration 1 — 2026-03-03
- Phase reached: PLAN
- Criteria progress: 0/34
- Work done: ISC created from CLAUDE.md spec + architecture PRD + schema spec + trust spec
- Failing: All (not yet built)
- Context for next iteration: Proceeding to BUILD with parallel agent fan-out
