# Atlas Task: Generate PRDs for OCP Scraper Phase 2a, 2b, 2c, and Phase 3

## CRITICAL: This is a PLANNING task, NOT a build task. Generate PRD files only. Do NOT write any code.

**Working directory:** `/mnt/zfs-host/backup/projects/observer-vault/01-Projects/ocp-scraper/`

CD into the project directory first. Read:
1. `CLAUDE.md` — project spec, current state (Phase 1 COMPLETE, 34/34)
2. `.prd/PRD-20260303-ocp-scraper-phase1.md` — Phase 1 PRD format reference (use same structure)
3. The architecture context below (this IS the source of truth for Phase 2+ design)

## What To Produce

Generate **four PRD files** in `.prd/` with full ISC criteria. Same format as the Phase 1 PRD. Status: PLANNED. Each PRD must have:
- Complete ISC criteria (testable, binary, state-based)
- Anti-criteria (what NOT to build in that phase)
- Dependency notes (which phases/PRDs must complete first)
- Execution strategy (parallel groups for fan-out)

### PRD 1: Phase 2a — Problem Template System
**File:** `.prd/PRD-20260303-ocp-phase2a-template-system.md`
**Parent:** PRD-20260303-ocp-scraper-phase1
**Depends on:** Phase 1 (COMPLETE)

Scope:
1. Problem Template JSON schema — defines template format (pattern rules, category metadata, version, Cynefin domain)
2. Template matching engine — given repo metadata + record, find best-matching template deterministically
3. Batch template generation — LLM takes N repo metadata bundles → generates template proposals (this is the ONLY place LLM is used)
4. Template governance CLI — `ocp template list`, `ocp template propose`, `ocp template approve`, `ocp template reject`
5. Re-classification command — `ocp reclassify` re-runs template matching on existing records when new templates are approved
6. Template storage — templates stored as versioned JSON files in `templates/` directory (git-tracked)

Key constraints:
- Templates are proposed by AI, approved by human ("AI articulates, humans decide")
- LLM calls are BATCH ONLY — never per-repo in default pipeline
- Template set is itself a publishable artifact
- Templates versioned with semantic versioning
- Existing Phase 1 deterministic pipeline remains the default — templates ENHANCE classification, don't replace the base extraction

Anti-criteria for 2a:
- NO search-as-validation (that's 2b)
- NO negative space analysis (that's 2b)
- NO federation (that's Phase 3)
- NO web UI
- NO query feedback loop (that's 2c)

### PRD 2: Phase 2b — Search Enhancement
**File:** `.prd/PRD-20260303-ocp-phase2b-search-enhancement.md`
**Parent:** PRD-20260303-ocp-scraper-phase1
**Depends on:** Phase 2a (template system must exist for negative space and validation to work)

Scope:
1. Negative space analysis — track zero-match queries, cluster them, identify template coverage gaps, `ocp gaps` command
2. Search-as-validation — after search results, "Did this solve your problem? Yes/No" one-click atomic trust operation, validation events update trust vectors
3. Graph enrichment — add shared-domain edges and compatible-port edges beyond dependency-only edges from Phase 1
4. Problem decomposition search — LLM-assisted query decomposition for complex multi-part problems (optional, can be deferred)

Key constraints:
- Negative space tracks what DOESN'T exist — inherently resistant to gaming
- Validation events are append-only (immutable trust ledger)
- Graph enrichment must not break existing Phase 1 dependency edges
- Search-as-validation is the same interface as search — no separate curation UI

Anti-criteria for 2b:
- NO template changes (templates are 2a's domain)
- NO federation
- NO query feedback loop driving template evolution (that's 2c)
- NO web UI

### PRD 3: Phase 2c — Feedback & Evolution
**File:** `.prd/PRD-20260303-ocp-phase2c-feedback-evolution.md`
**Parent:** PRD-20260303-ocp-scraper-phase1
**Depends on:** Phase 2a AND Phase 2b (needs templates + negative space + validation data)

Scope:
1. Query feedback loop — log all queries, periodic batch LLM analysis identifies clusters of unmatched queries → proposes new templates
2. Coverage dashboard — `ocp coverage` showing template coverage stats, gap density, unclassified record count
3. Dual-speed cycle wiring — fast loop (deterministic query → indexed results, <1s) connected to slow loop (query patterns → gap analysis → template proposals → human-approved ontology changes)

Key constraints:
- Template proposals from feedback loop go through same governance as 2a (human approval required)
- Coverage dashboard is CLI output, not web UI
- Dual-speed cycle has three temporal layers: batch scraping (periodic), real-time queries (on-demand), template evolution (slow, governed)

Anti-criteria for 2c:
- NO federation
- NO web UI
- NO changes to base scraping pipeline
- NO autonomous template approval (human always decides)

### PRD 4: Phase 3 — Federation
**File:** `.prd/PRD-20260303-ocp-phase3-federation.md`
**Parent:** PRD-20260303-ocp-scraper-phase1
**Depends on:** Phase 2a (at minimum — templates needed for cross-vault interoperability)

Scope:
1. JSON Feed generation — `ocp publish` generates JSON Feed from vault records
2. Feed consumption — `ocp subscribe <feed-url>` imports records from other vaults
3. Trust merging — policy for handling trust vectors from federated records (discount foreign trust, require local re-validation)
4. Forge adapters — Codeberg adapter implementation (Forgejo as separate or shared impl)
5. Ecosyste.ms data consumption — optional bulk metadata import as alternative to GitHub API for large-scale scraping

Key constraints:
- Federation is opt-in, sovereignty preserved
- Foreign records marked with provenance (which vault they came from)
- Trust from federated records starts discounted — local validation increases it
- Codeberg adapter uses same ForgeAdapter interface from Phase 1
- Ecosyste.ms is supplementary data source, not replacement for direct forge API

Anti-criteria for Phase 3:
- NO web UI
- NO centralised registry or coordinator
- NO mandatory federation — single vault must remain fully functional
- NO trust inflation from federation (foreign trust is discounted)

## Architecture Context (Source of Truth)

### The Three Load-Bearing Innovations

**1. Problem Template Engine**
Instead of LLM classifying each repo individually, use TEMPLATES — a finite set of problem categories with pattern-matching rules. Templates define problem categories (e.g., "caching", "authentication", "state management"). Each template has pattern-matching rules: topic patterns, dependency signatures, README structure indicators. Repos are classified deterministically by matching against templates. LLM involvement is batch only: take 50-100 high-signal repo metadata bundles → generate/refine templates. Templates are versioned, proposed by AI, approved by human. Template set is itself a publishable artifact — a machine-readable ontology of solved software problems.

**2. Graph Index (partially in Phase 1)**
Phase 1 has SQLite edge table from dependency graphs. Phase 2 enriches with: shared problem domain edges, compatible port edges, cross-domain structural isomorphism edges. Search becomes graph navigation.

**3. Search-as-Validation**
Query and validation are the same interface. "Did this solve your problem? Yes/No" — one-click atomic trust operation. Independent validations accumulate into trust vector. No separate curation step.

### Negative Space Analysis
Index what DOESN'T exist. Track zero-match queries. Cluster them. Identify template coverage gaps. Display gaps as features. Uses: shows unsolved problems, guides template evolution, could become bounty system, inherently resistant to gaming.

### Query Feedback Loop
Zero-match queries logged. Periodic batch LLM analysis identifies clusters → proposes new templates. Template changes = ontology changes = governance events (human approval required).

### Dual-Speed Feedback Cycle
Fast loop: deterministic query → indexed results (<1s). Slow loop: query patterns → gap analysis → new template proposals → human-approved ontology changes (hours/days). Three temporal layers: batch scraping (periodic), real-time queries (on-demand), template evolution (slow, governed).

### Key Constraints Carrying Forward
- NO per-repo LLM calls in default pipeline
- AI proposes, human approves for all template/ontology changes
- Energy efficiency — batch LLM only
- Operational simplicity — CLI tool, git-backed, one-person operable
- Sovereignty — everything local, federation opt-in
- Forge-agnostic — adapter interface, never GitHub-locked

## Execution Instructions

1. Read CLAUDE.md and Phase 1 PRD for format reference
2. Generate all four PRD files in `.prd/`
3. Each PRD must have complete ISC criteria with verification methods
4. Use fan-out parallel groups in execution strategy where possible
5. Mark all as status: PLANNED
6. Set parent references correctly
7. Do NOT write any code — this is planning only
8. Update CLAUDE.md "Last Session" section to note PRDs generated

Use sub-agents if helpful for parallel PRD generation — all four PRDs are independent of each other (they depend on Phase 1 and each other at build time, but the PRD documents themselves can be written in parallel).
