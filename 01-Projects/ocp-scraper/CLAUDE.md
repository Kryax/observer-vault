# OCP Scraper — Observer Commons Protocol Knowledge Crystallizer

> The CLI tool that transforms GitHub repositories into structured Solution Records for the Observer Commons federated knowledge network.

## Identity

This is the OCP Scraper — Phase 1 of the Observer Commons bootstrapping strategy. It scrapes public repositories, extracts problem-knowledge (not code), and assembles JSON-LD Solution Records conforming to the OCP schema. The architecture was designed through a full OscillateAndGenerate → ConvergeAndEvaluate creative methodology pipeline.

## Session Start

1. Read this file
2. Check project state: `cat .prd/*.md` for active PRDs
3. Check git status: `git status --short`
4. Review `src/` structure to understand current codebase
5. Run tests if they exist: `bun test`

## Core Principle

**"AI articulates, humans decide."**

Adam decides. Atlas executes. OIL constrains.

## Workflow Orchestration

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan — don't keep pushing
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- One task per subagent for focused execution
- Offload research, exploration, and parallel work to subagents
- Fan-out parallel execution for independent build tasks

### 3. Verification Before Done
- Never mark a task complete without proving it works
- Run the actual CLI commands to verify functionality
- Ask yourself: "Would Adam approve this?"

### 4. Boundary Enforcement
- This project builds Phase 1 ONLY — do not scope-creep into Phase 2+ features
- No LLM calls in the default scraping pipeline
- No external service dependencies — everything local
- No running services — CLI tool only

### 5. When In Doubt
- STOP and ask Adam
- Do not assume approval
- Do not build when asked to plan

## Architecture Reference

The full architecture was designed via creative methodology skills and is documented at:
- **Architecture PRD:** `/mnt/zfs-host/backup/projects/observer-vault/.prd/PRD-20260303-observer-commons-bootstrapping-architecture.md`
- **Protocol spec:** `/mnt/zfs-host/backup/projects/observer-vault/01-Projects/observer-commons/`
- **Schema spec:** `/mnt/zfs-host/backup/projects/observer-vault/01-Projects/observer-commons/Observer_Commons_Schema_Spec.md`

### Key Architectural Decisions
1. **Problem Template Engine** — Phase 2. For now, extract problem statements deterministically from README + description
2. **Graph Index** — Phase 1. SQLite with edges table from dependency graph data
3. **Search-as-Validation** — Phase 2. For now, search returns results without validation mechanism
4. **Dual-speed cycle** — Phase 2+. For now, single-speed: scrape → index → search
5. **Forge Adapter pattern** — Phase 1. Build the interface, implement GitHub adapter only

## Technical Stack

- **Runtime:** Bun
- **Language:** TypeScript (strict mode)
- **GitHub API:** @octokit/rest
- **CLI framework:** Commander.js
- **Database:** better-sqlite3 or bun:sqlite
- **Markdown parsing:** marked or remark
- **TOML parsing:** smol-toml (for Cargo.toml)

## Project Structure (Target)

```
ocp-scraper/
├── CLAUDE.md                    # This file
├── package.json
├── tsconfig.json
├── bun.lockb
├── .prd/                        # PRD tracking
├── .ocp/                        # Runtime data (gitignored)
│   ├── config.json              # Scraper configuration
│   └── index.db                 # SQLite index
├── records/                     # Solution Record storage (git-tracked)
│   └── <domain>/
│       └── <record-id>.jsonld
├── seeds/                       # Hand-curated seed records
├── src/
│   ├── cli/                     # CLI command definitions
│   │   ├── index.ts             # Entry point
│   │   ├── scrape.ts
│   │   ├── search.ts
│   │   ├── status.ts
│   │   ├── inspect.ts
│   │   └── seed.ts
│   ├── forge/                   # Forge adapter layer
│   │   ├── types.ts             # ForgeAdapter interface
│   │   ├── github.ts            # GitHub implementation
│   │   └── index.ts
│   ├── filter/                  # Signal filtering
│   │   ├── coarse.ts            # Stage 1: API-level filter
│   │   └── fine.ts              # Stage 2: README quality filter
│   ├── extract/                 # Data extraction
│   │   ├── metadata.ts          # GitHub API metadata
│   │   ├── readme.ts            # README structural parser
│   │   └── dependencies.ts      # Package manifest parser
│   ├── record/                  # Record assembly
│   │   ├── assembler.ts         # JSON-LD Solution Record builder
│   │   ├── trust.ts             # Trust vector calculator
│   │   └── schema.ts            # OCP schema types and validation
│   ├── store/                   # Storage layer
│   │   ├── vault.ts             # Git-backed file storage
│   │   └── index.ts             # SQLite index management
│   └── types/                   # Shared type definitions
│       ├── solution-record.ts
│       ├── trust-vector.ts
│       └── forge.ts
└── test/                        # Tests
```

## CLI Commands (Phase 1)

```bash
ocp scrape --source github --topic <topic> --limit <n>   # Scrape repos by topic
ocp search <query>                                        # Search local index
ocp status                                                # Show index statistics
ocp inspect <record-id>                                   # View single record detail
ocp seed <repo-url>                                       # Hand-curate a seed record
```

## Key Constraints

- **NO per-repo LLM calls** — everything deterministic
- **NO vendor lock-in** — forge adapter interface is platform-agnostic
- **NO external services** — everything runs locally
- **NO daemons** — CLI tool only, runs on demand
- **Idempotent** — re-scraping updates, doesn't duplicate
- **Graceful failure** — continue on individual repo failures

## Environment

- `GITHUB_TOKEN` — required for GitHub API access (public repo read)
- Records stored in `records/` directory (git-tracked)
- Index stored in `.ocp/index.db` (gitignored — rebuilt from records)

## What NOT to Build (Phase 2+)

- Problem Template Engine
- Batch LLM enrichment
- Search-as-validation / one-click validation
- Query feedback loop
- Template governance
- Negative space analysis
- Federation / JSON Feed publishing
- Codeberg/Forgejo adapter implementations (build interface only)
- Web UI

---

## Atlas Self-Managed Section

_Below this line, Atlas MAY update: last session info, build progress, known issues._
_Atlas MUST NOT modify anything above this line without Adam's approval._

---

### Last Session
- **Date:** 2026-03-03
- **Status:** Phase 3 COMPLETE (22/22 ISC passing)
- **Work done:** Built Federation — JSON Feed publishing, feed subscription, trust discounting, Codeberg/Forgejo adapter, ecosyste.ms client
- **Phase 1:** COMPLETE (34/34 ISC passing)
- **Phase 2a:** COMPLETE (22/22 ISC passing)
- **Phase 2b:** COMPLETE (20/20 ISC passing)
- **Phase 2c:** COMPLETE (16/16 ISC passing)
- **Phase 3:** COMPLETE (22/22 ISC passing)

### Known Issues
- 404 log noise from Octokit when checking manifest files that don't exist (cosmetic, not functional)
- README title parsing captures badge markdown in some cases (bigcache, haproxy)

### Build Progress
- [x] Project scaffold
- [x] Forge adapter (GitHub)
- [x] Signal filter (two-stage)
- [x] Metadata extractor
- [x] README structural parser
- [x] Dependency analyzer
- [x] Record assembler (JSON-LD)
- [x] Trust vector calculator
- [x] Git-backed storage
- [x] SQLite index with graph edges
- [x] CLI: ocp scrape
- [x] CLI: ocp search
- [x] CLI: ocp status
- [x] CLI: ocp inspect
- [x] CLI: ocp seed
- [x] End-to-end test (scrape → index → search)
- [x] Phase 2a: Template schema types
- [x] Phase 2a: Template storage layer
- [x] Phase 2a: Deterministic matching engine
- [x] Phase 2a: Batch template generator
- [x] Phase 2a: Governance CLI (list/propose/approve/reject)
- [x] Phase 2a: Reclassify command
- [x] Phase 2b: Zero-match query logging (negative space)
- [x] Phase 2b: Gap analysis clustering command (ocp gaps)
- [x] Phase 2b: Validation event storage (append-only)
- [x] Phase 2b: Search-as-validation prompt
- [x] Phase 2b: Trust vector validation dimension
- [x] Phase 2b: Graph enrichment (domain + port edges)
- [x] Phase 2b: Related records in search output
- [x] Phase 2b: Post-scrape graph enrichment pipeline
- [x] Phase 2c: All-query logging (query_log table)
- [x] Phase 2c: Feedback analyzer (cluster→proposal)
- [x] Phase 2c: Feedback CLI (ocp feedback analyze)
- [x] Phase 2c: Coverage dashboard (ocp coverage)
- [x] Phase 2c: Dual-speed cycle architecture
- [x] Phase 3: Forgejo/Codeberg adapter (ForgejoAdapter)
- [x] Phase 3: JSON Feed publisher (ocp publish)
- [x] Phase 3: Feed subscriber (ocp subscribe)
- [x] Phase 3: Trust discounting + re-validation
- [x] Phase 3: Provenance tagging (federation.originNode)
- [x] Phase 3: Ecosyste.ms client + merger
- [x] Phase 3: Federation config (.ocp/federation.json)
- [x] Phase 3: Forge-aware record IDs (generateRecordId)
