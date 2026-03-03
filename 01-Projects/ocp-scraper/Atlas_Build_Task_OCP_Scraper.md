# Atlas Build Task: Observer Commons Protocol — Scraper MVP

## Overview

Build the OCP scraper as a TypeScript CLI tool running on Bun. This is the data acquisition, record assembly, indexing, and search pipeline for bootstrapping the Observer Commons federated knowledge network from GitHub repositories.

## Architecture Reference

Read these documents before starting:
- `.prd/PRD-20260303-observer-commons-bootstrapping-architecture.md` — ISC criteria (19 criteria, all must pass)
- `01-Projects/observer-commons/` — protocol spec, schema spec, trust spec
- `00-Inbox/great-transition-research/Creative_Methodology_Test3_GitHub_Bootstrapping.md` — full architecture design (if filed here, otherwise check `02-Knowledge/skills/creative-methodology/`)

## Tech Stack

- **Runtime:** Bun
- **Language:** TypeScript
- **GitHub API:** Octokit
- **Database:** bun:sqlite (or better-sqlite3)
- **CLI framework:** Commander.js
- **Storage:** Git-backed JSON-LD files
- **Repo:** GitHub — create as `Kryax/ocp-scraper`

## Project Structure

```
ocp-scraper/
├── src/
│   ├── cli.ts                  # CLI entry point (ocp command)
│   ├── commands/
│   │   ├── scrape.ts           # ocp scrape
│   │   ├── search.ts           # ocp search
│   │   ├── status.ts           # ocp status
│   │   └── seed.ts             # ocp seed (manage seed records)
│   ├── adapters/
│   │   ├── forge-adapter.ts    # Abstract forge interface
│   │   ├── github-adapter.ts   # GitHub implementation
│   │   └── codeberg-adapter.ts # Codeberg stub (interface only for now)
│   ├── pipeline/
│   │   ├── signal-filter.ts    # Two-stage signal filtering
│   │   ├── metadata-extractor.ts   # Deterministic metadata extraction
│   │   ├── readme-parser.ts    # Structural README parsing
│   │   ├── dependency-analyzer.ts  # Package manifest parsing
│   │   ├── record-assembler.ts # Assemble JSON-LD Solution Records
│   │   └── trust-calculator.ts # GitHub signals → 6-dim trust vector
│   ├── index/
│   │   ├── sqlite-store.ts     # SQLite FTS + graph edges
│   │   ├── graph.ts            # Property graph operations
│   │   └── query-engine.ts     # Search by problem structure
│   ├── types/
│   │   ├── solution-record.ts  # JSON-LD Solution Record types
│   │   ├── trust-vector.ts     # Trust vector types
│   │   └── forge.ts            # Forge adapter interface types
│   └── utils/
│       ├── config.ts           # Configuration management
│       ├── rate-limiter.ts     # API rate limit handling
│       └── logger.ts           # Structured logging
├── seeds/                      # Hand-curated seed Solution Records
│   └── README.md
├── data/                       # Local vault storage (git-backed)
│   ├── records/                # JSON-LD Solution Record files
│   └── index.db                # SQLite database
├── CLAUDE.md                   # Project context for Atlas
├── package.json
├── tsconfig.json
├── bunfig.toml
├── .gitignore
└── README.md
```

## Build Phases (do in order)

### Phase 1: Scaffold + Data Acquisition
1. Init project, install deps (octokit, commander, bun:sqlite)
2. Build CLI skeleton with `ocp` command and subcommands
3. Implement forge adapter interface + GitHub adapter with Octokit
4. Implement rate limiter (respect GitHub API limits, exponential backoff)
5. Implement signal filter:
   - Stage 1 (coarse): stars > configurable threshold, has README, committed within last 2 years
   - Stage 2 (fine): README length > 500 chars, has headings, has code examples
6. Implement metadata extractor: repo name, description, topics, language, license, stars, forks, open issues, contributors count, created/updated dates
7. Implement README structural parser: parse as structured document, map sections (Installation → implementation, Usage → problem context, API → composability, Contributing → community)
8. Implement dependency analyzer: parse package.json, Cargo.toml, go.mod, requirements.txt, pyproject.toml — extract deps, peer deps, engines
9. Test: `ocp scrape --source github --topic caching --limit 5` should pull 5 repos through the full extraction pipeline and output structured metadata to stdout

### Phase 2: Record Assembly + Storage
1. Define TypeScript types matching OCP JSON-LD Solution Record schema (all 7 required facets)
2. Implement record assembler: takes extracted metadata → produces valid JSON-LD Solution Record with `@context`, `@type`, `ocp:` namespace
3. Implement trust vector calculator: map GitHub signals to 6 dimensions (validationCount from stars, diversity from unique contributors, testing from CI indicators, documentation from README quality score, productionUse from dependents count, communityEngagement from issues+PRs)
4. Implement git-backed storage: write records as individual JSON-LD files to `data/records/{hash}.jsonld`
5. Create 5-10 hand-curated seed records for well-known repos (e.g., Redis, Express, SQLite, React, Lodash) — these are the control points
6. Implement `ocp seed list` and `ocp seed show {id}` commands
7. Test: `ocp scrape --source github --topic caching --limit 5 --store` should write 5 Solution Record files to data/records/

### Phase 3: Index + Search
1. Implement SQLite store: create tables for records (FTS5 on problem statement + domains + description) and edges (source_id, target_id, relationship_type, weight)
2. Build index at ingest time: when a record is stored, index it in SQLite and create edges from dependency relationships
3. Implement graph operations: find neighbours, find path between nodes, find clusters
4. Implement query engine: accept natural language problem description → tokenize → FTS match → rank by trust vector → return with graph context (nearby solutions, composition pathways)
5. Implement `ocp search "distributed cache invalidation"` — returns matching records with trust vectors and graph neighbours
6. Implement `ocp status` — shows: N records indexed, M seed records, K edges, last scrape timestamp, SQLite size
7. Test: After scraping and indexing 20+ repos, `ocp search` should return relevant results with trust scores

## Key Constraints (from architecture design)

- **NO per-repo LLM calls.** The entire pipeline is deterministic. LLM enrichment is a future feature (Phase 2+).
- **NO vendor lock-in.** Forge adapter pattern means Codeberg/Forgejo can be added by implementing the interface.
- **sourceType: "automated-scrape"** on all scraped records. Honest provenance.
- **Initial trust is LOW.** Scraped records start with low trust vectors. Trust grows through validation (future feature).
- **Records are immutable once published.** New versions, not mutations. Use content-addressing for IDs.
- **Everything in a git repo.** Records are files. Index is SQLite. No external services.
- **Must work as single vault.** No federation required for basic operation.
- **Energy efficient.** Batch operations. Rate-limited. No unnecessary API calls.

## Configuration

```typescript
// ~/.ocp/config.json
{
  "github_token": "...",          // GitHub personal access token
  "data_dir": "./data",           // Where records and index live
  "seeds_dir": "./seeds",         // Seed records location
  "default_source": "github",
  "scrape": {
    "min_stars": 50,              // Coarse filter threshold
    "min_readme_length": 500,     // Fine filter threshold
    "max_age_years": 2,           // Must have commits within this period
    "batch_size": 30              // Repos per API page
  }
}
```

## GitHub Auth

Use a personal access token. The CLI should check for:
1. `OCP_GITHUB_TOKEN` environment variable
2. `~/.ocp/config.json` github_token field
3. Prompt if neither found

## Success Criteria

By end of build:
- `ocp scrape --source github --topic "state management" --limit 20 --store` works end to end
- `ocp search "how to manage application state"` returns relevant results
- `ocp status` shows accurate counts
- `ocp seed list` shows curated seed records
- All 19 ISC criteria from the PRD are addressed in the implementation
- Code is clean, typed, and has inline documentation

## Anti-Criteria (things NOT to build)

- No web UI (CLI only)
- No LLM enrichment pipeline
- No template engine (Phase 2)
- No federation / JSON Feed publishing
- No validation mechanism ("did this solve your problem")
- No negative space analysis
- No cross-domain search
- No Ecosyste.ms integration

Use sub-agents. Show working. Create CLAUDE.md for the project. Push to GitHub when Phase 1 is working.
