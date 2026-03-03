---
prd: true
id: PRD-20260303-ocp-phase2a-template-system
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
verification_summary: "22/22"
parent: PRD-20260303-ocp-scraper-phase1
children: []
---

# OCP Scraper Phase 2a — Problem Template System

> Build the Problem Template Engine that enables deterministic, AI-proposed/human-approved classification of repositories into structured problem categories.

## STATUS

| What | State |
|------|-------|
| Progress | 22/22 criteria passing |
| Phase | COMPLETE |
| Next action | Phase 2b (search enhancement) ready |
| Blocked by | Nothing |

## CONTEXT

### Problem Space
Phase 1 extracts problem statements deterministically from README + description, but classification is rudimentary. The Problem Template Engine introduces a finite set of problem categories with pattern-matching rules, enabling richer search and ontology evolution. LLM involvement is batch-only for template proposal — matching is deterministic.

### Dependencies
- **Phase 1** (COMPLETE) — base scraping pipeline, record format, index, CLI framework
- Phase 2b and 2c depend on this phase completing first

### Key Files (from Phase 1)
- `src/record/assembler.ts` — Record assembly (templates enhance classification here)
- `src/store/index.ts` — SQLite index (template metadata stored here)
- `src/cli/` — CLI commands (template governance commands added here)
- `src/types/solution-record.ts` — SolutionRecord type (template fields extend this)

### Constraints
- Templates are proposed by AI, approved by human ("AI articulates, humans decide")
- LLM calls are BATCH ONLY — never per-repo in default pipeline
- Template set is itself a publishable artifact
- Templates versioned with semantic versioning
- Existing Phase 1 deterministic pipeline remains the default — templates ENHANCE, don't replace
- CLI tool, git-backed, one-person operable

### Decisions Made
- TemplateStore follows VaultStore pattern: flat JSON files, idToSlug conversion
- Matching engine uses weighted scoring: topics 0.4, dependencies 0.4, description 0.2
- Weight redistribution when pattern categories are empty (no penalty)
- Batch generator uses Union-Find clustering with Jaccard similarity on topics
- LLM integration stubbed as opt-in; deterministic clustering is the default
- Reclassify stores match data in record.extensions.templateMatch
- Rejected templates are removed (don't persist on disk)

## PLAN

### Execution Strategy
Fan-out parallel agent build in 3 groups + sequential CLI wiring:

**Group 1 (no deps):** Template JSON schema, template storage layer
**Group 2 (needs schema):** Template matching engine, batch template generation
**Group 3 (needs engine + storage):** Template governance CLI commands, re-classification command
**Sequential:** Integration testing, E2E verification

### Technical Decisions (Proposed)
- Templates stored as versioned JSON files in `templates/` directory (git-tracked)
- Template schema includes: pattern rules, category metadata, semantic version, Cynefin domain
- Matching engine is pure function: (repo metadata, record, templates[]) → best match
- LLM batch generation takes N repo metadata bundles → template proposals
- Governance CLI follows same Commander.js pattern as Phase 1

## IDEAL STATE CRITERIA (Verification Criteria)

### Schema
- [x] ISC-Schema-1: Template JSON schema defines pattern rules and category metadata | Verify: Read: template schema type definition
- [x] ISC-Schema-2: Template schema includes semantic version field for each template | Verify: Read: version field in schema type
- [x] ISC-Schema-3: Template schema includes Cynefin domain classification field present | Verify: Read: cynefin field in schema type

### Matching
- [x] ISC-Match-1: Matching engine accepts repo metadata and returns best template | Verify: Test: unit test matching function
- [x] ISC-Match-2: Matching engine is deterministic with no randomness or LLM calls | Verify: Grep: no AI/LLM imports in matching module
- [x] ISC-Match-3: Matching engine handles zero-match case returning null gracefully | Verify: Test: zero-match test case
- [x] ISC-Match-4: Matching engine uses topic patterns and dependency signatures together | Verify: Read: matching logic uses both signal types

### Generation
- [x] ISC-Gen-1: Batch generator takes multiple repo metadata bundles as input | Verify: Read: batch function signature
- [x] ISC-Gen-2: Batch generator produces template proposals not approved templates | Verify: Read: output type is proposal not template
- [x] ISC-Gen-3: LLM calls occur only in batch generation never per-repo | Verify: Grep: LLM imports only in generation module

### Governance CLI
- [x] ISC-Gov-1: ocp template list command displays all approved templates | Verify: Read: template list command implementation
- [x] ISC-Gov-2: ocp template propose command creates pending template from proposal | Verify: Read: template propose command
- [x] ISC-Gov-3: ocp template approve command promotes pending template to approved | Verify: Read: template approve command
- [x] ISC-Gov-4: ocp template reject command removes pending template with reason | Verify: Read: template reject command

### Reclassification
- [x] ISC-Reclass-1: ocp reclassify command re-runs template matching on existing records | Verify: CLI: run reclassify after template approval
- [x] ISC-Reclass-2: Reclassified records update index with new template assignments | Verify: Read: index update logic after reclassify

### Storage
- [x] ISC-Store-1: Templates stored as versioned JSON files in templates/ directory | Verify: Glob: templates/*.json after template approval
- [x] ISC-Store-2: Template files are git-tracked not in gitignored directories | Verify: Grep: templates/ not in .gitignore

### Anti-Criteria
- [x] ISC-A-Search-1: No search-as-validation mechanism exists in this phase | Verify: Grep: no validation event types
- [x] ISC-A-NegSpace-1: No negative space analysis or gap tracking code exists | Verify: Grep: no gap/negative-space modules
- [x] ISC-A-Fed-1: No federation or JSON Feed code exists in this phase | Verify: Grep: no feed/federation modules
- [x] ISC-A-WebUI-1: No web server or browser-facing UI code exists anywhere | Verify: Grep: no express/fastify/http.createServer imports

## DECISIONS

## LOG

### Iteration 1 — 2026-03-03
- Phase reached: VERIFY (COMPLETE)
- Criteria progress: 22/22
- Work done: Built complete Problem Template System — schema types, storage layer, deterministic matching engine (weighted topic+dep+desc scoring), batch generator (Union-Find clustering), governance CLI (list/propose/approve/reject), reclassify command. All 4 anti-criteria verified clean.
- Failing: None
- Context for next iteration: Phase 2a COMPLETE. Phase 2b (search enhancement) and 2c (feedback/evolution) are now unblocked.
