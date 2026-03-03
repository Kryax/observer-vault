Build Phase 1 of the OCP Scraper — the Observer Commons Protocol knowledge crystallizer CLI tool.

**Working directory:** `/mnt/zfs-host/backup/projects/observer-vault/01-Projects/ocp-scraper/`

CD into the project directory first. Read the CLAUDE.md there — it contains the full project spec, architecture references, technical stack, target project structure, CLI commands, and all constraints. Everything you need to understand the build is in that file.

Before building, also read these architecture references:
- The architecture PRD at `/mnt/zfs-host/backup/projects/observer-vault/.prd/PRD-20260303-observer-commons-bootstrapping-architecture.md`
- The OCP schema spec at `/mnt/zfs-host/backup/projects/observer-vault/01-Projects/observer-commons/Observer_Commons_Schema_Spec.md`

This is a full build task. Generate a PRD with ISC criteria from the CLAUDE.md spec. Use fan-out parallel execution with sub-agents for independent modules:

**Parallel Group 1 (no dependencies):**
- Project scaffold (package.json, tsconfig.json, directory structure)
- Forge adapter layer (interface + GitHub implementation with Octokit)
- Signal filter (coarse + fine stages)
- Type definitions (SolutionRecord, TrustVector, ForgeAdapter interfaces)

**Parallel Group 2 (depends on Group 1 types):**
- Metadata extractor (GitHub API fields)
- README structural parser
- Dependency analyzer (package.json, Cargo.toml, go.mod, pyproject.toml)

**Parallel Group 3 (depends on Group 2):**
- Record assembler (JSON-LD with all 7 OCP facets)
- Trust vector calculator (6-dimension from GitHub signals)
- Storage layer (git-backed files + SQLite index with graph edges)

**Sequential (depends on all above):**
- CLI commands: ocp scrape, ocp search, ocp status, ocp inspect, ocp seed
- End-to-end verification: `ocp scrape --source github --topic caching --limit 5` then `ocp search "caching"` then `ocp status`

All work happens inside `/mnt/zfs-host/backup/projects/observer-vault/01-Projects/ocp-scraper/`. TypeScript on Bun. GITHUB_TOKEN env var for API access. No LLM calls in the pipeline. No external services. CLI only.
