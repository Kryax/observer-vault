---
prd: true
id: PRD-20260303-reflect-skill-motif-extraction
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
verification_summary: "32/32"
parent: null
children: []
---

# Reflect Skill with Motif Extraction

> Build the third cognitive methodology skill that completes the creative triad (oscillate→converge→reflect), extracting domain-independent structural patterns into a compounding motif library.

## STATUS

| What | State |
|------|-------|
| Progress | 32/32 criteria passing |
| Phase | COMPLETE |
| Next action | None — all ISC verified |
| Blocked by | Nothing |

## CONTEXT

### Problem Space
The creative methodology triad (OscillateAndGenerate, ConvergeAndEvaluate) is missing its third skill: Reflect. Without formal reflection and motif extraction, structural patterns discovered during creative and build sessions evaporate. The Reflect skill captures these patterns into a persistent, searchable motif library that compounds through use — making every future session richer.

### Key Files
- `~/.claude/skills/OscillateAndGenerate/SKILL.md` — sibling skill pattern to follow
- `~/.claude/skills/ConvergeAndEvaluate/SKILL.md` — sibling skill pattern to follow
- `~/.claude/skills/OscillateAndGenerate/SelfImprovement.md` — governance template
- `~/.claude/skills/OscillateAndGenerate/Workflows/Diverge.md` — workflow structure template
- `~/.claude/skills/ConvergeAndEvaluate/Workflows/Converge.md` — workflow structure template
- `02-Knowledge/creative-methodology/Reflect_Skill_Seed_Notes.md` — Adam's design notes
- `02-Knowledge/creative-methodology/Motif_Library_Compiled_Concept.md` — motif schema spec
- `02-Knowledge/creative-methodology/Integrated_Cognitive_Architecture_and_Motif_Extraction.md` — architecture vision

### Constraints
- Follow existing skill structure exactly (SKILL.md, Workflows/, SelfImprovement.md, Tools/)
- No web UI, no database, no HTTP servers
- Vault markdown files only for motif storage
- OCP scraper interface defined but not required
- Tier 0/1 motifs auto-created (draft status), Tier 2+ requires human approval
- Skills are auto-discovered via YAML frontmatter USE WHEN clause

### Decisions Made
- skill-index.json does not exist — registration is via YAML frontmatter discovery
- Tools/ directory must exist even if empty (canonical skill structure)
- Customization directory check included but directory not created (pattern from siblings)

## PLAN

### Execution Strategy: Fan-Out 3 Parallel Agents

The 32 ISC criteria partition cleanly into 3 independent execution tracks:

**Track A: Skill Files** (Agent 1 — Engineer)
- `~/.claude/skills/Reflect/SKILL.md` — frontmatter, voice notification, customization, core operations, workflow routing, integration notes, observer ecosystem mapping, examples
- `~/.claude/skills/Reflect/SelfImprovement.md` — governance mechanism
- `~/.claude/skills/Reflect/Workflows/Reflect.md` — five-phase workflow with output format
- `~/.claude/skills/Reflect/Tools/` — empty directory (canonical structure)
- Covers: ISC-SS-1 through ISC-SS-5, ISC-RW-1 through ISC-RW-6, ISC-IN-2

**Track B: Motif Library Scaffold** (Agent 2 — Engineer)
- `02-Knowledge/motifs/MOTIF_INDEX.md` — index with table structure
- `02-Knowledge/motifs/meta/` — directory for second-order motifs
- `02-Knowledge/motifs/_TEMPLATE.md` — motif entry template with all 9 fields
- `02-Knowledge/motifs/_SCHEMA.md` — schema documentation (tier system, confidence, validation protocol)
- Seed motifs from existing creative methodology tests (Observer-Feedback Loop, Dual-Speed Governance, Trust-as-Curation, Template-Driven Classification)
- Covers: ISC-ML-1 through ISC-ML-5, ISC-MO-1, ISC-MO-2, ISC-MO-6, ISC-MO-7

**Track C: Integration & Governance** (Agent 3 — Engineer)
- Motif operations documentation within the workflow (promotion gates, strengthening, meta-analysis)
- OCP scraper interface definition (within SKILL.md integration section)
- Verify all anti-criteria by reviewing Track A and B outputs
- Covers: ISC-MO-3 through ISC-MO-5, ISC-IN-1, ISC-IN-3, ISC-IN-4, all anti-criteria

### File-Edit Manifest

| File | Action | What Changes |
|------|--------|-------------|
| `~/.claude/skills/Reflect/SKILL.md` | create | Full skill definition following sibling pattern |
| `~/.claude/skills/Reflect/Workflows/Reflect.md` | create | Five-phase reflection workflow |
| `~/.claude/skills/Reflect/SelfImprovement.md` | create | Governance mechanism |
| `~/.claude/skills/Reflect/Tools/` | create dir | Empty directory (canonical structure) |
| `02-Knowledge/motifs/MOTIF_INDEX.md` | create | Index table with tier/confidence columns |
| `02-Knowledge/motifs/meta/.gitkeep` | create | Placeholder for meta-motif directory |
| `02-Knowledge/motifs/_TEMPLATE.md` | create | 9-field motif entry template |
| `02-Knowledge/motifs/_SCHEMA.md` | create | Tier system, validation protocol, confidence rules |
| `02-Knowledge/motifs/observer-feedback-loop.md` | create | Seed motif from creative methodology tests |
| `02-Knowledge/motifs/dual-speed-governance.md` | create | Seed motif from creative methodology tests |
| `02-Knowledge/motifs/trust-as-curation.md` | create | Seed motif from creative methodology tests |
| `02-Knowledge/motifs/template-driven-classification.md` | create | Seed motif from creative methodology tests |

### Technical Decisions

1. **Motif files as vault markdown** — Each motif is a standalone .md file with YAML frontmatter for structured fields and markdown body for rich description. Searchable via Grep/Glob.

2. **Confidence score: 0.0-1.0 float** — Starts at 0.1 for Tier 0 single-instance. +0.1 per new domain instance. +0.2 for triangulation (both top-down and bottom-up sources). Capped at 1.0.

3. **Motif naming: kebab-case** — `observer-feedback-loop.md`, `dual-speed-governance.md`. Predictable, greppable.

4. **Seed motifs at Tier 1** — The four motifs from creative methodology tests already have 2+ domain instances (identity, mining, GitHub), so they start at Tier 1, not Tier 0.

5. **No TypeScript tools** — This skill is pure markdown (instructions for Atlas). No code to compile. Tools/ exists empty per convention.

6. **OCP scraper interface** — Defined as a section in SKILL.md describing the data format the scraper would provide. No imports, no code coupling.

## IDEAL STATE CRITERIA (Verification Criteria)

### Skill Structure
- [ ] ISC-SS-1: SKILL.md exists with correct frontmatter and trigger definitions | Verify: Read
- [ ] ISC-SS-2: Workflows/Reflect.md contains five-phase reflection workflow process | Verify: Read
- [ ] ISC-SS-3: SelfImprovement.md governance pattern matches sibling skill conventions | Verify: Read
- [ ] ISC-SS-4: Voice notification and customization check follow sibling skill patterns | Verify: Grep
- [ ] ISC-SS-5: Skill YAML frontmatter includes proper USE WHEN trigger keywords | Verify: Read

### Reflect Workflow
- [ ] ISC-RW-1: Recognition phase examines session output shape without evaluating quality | Verify: Read
- [ ] ISC-RW-2: Context mapping assesses impact of session output on ecosystem | Verify: Read
- [ ] ISC-RW-3: Completion test checks friction, irreducibility, and internal consistency | Verify: Read
- [ ] ISC-RW-4: Motif extraction identifies domain-independent structural patterns from session | Verify: Read
- [ ] ISC-RW-5: Motif-informed re-reflection queries library for related existing patterns | Verify: Read
- [ ] ISC-RW-6: Workflow outputs reflection summary, motif entries, and forward questions | Verify: Read

### Motif Library
- [ ] ISC-ML-1: Motif markdown files stored in 02-Knowledge/motifs vault directory | Verify: Glob
- [ ] ISC-ML-2: MOTIF_INDEX.md contains table with tier levels and confidence scores | Verify: Read
- [ ] ISC-ML-3: Second-order motifs stored in 02-Knowledge/motifs/meta vault subdirectory | Verify: Bash ls
- [ ] ISC-ML-4: Each motif file contains all nine required schema fields | Verify: Read
- [ ] ISC-ML-5: Motif files use kebab-case naming matching the pattern name | Verify: Glob

### Motif Operations
- [ ] ISC-MO-1: New motifs created at Tier 0 with draft status by default | Verify: Read
- [ ] ISC-MO-2: Tier 1 promotion requires instances in 2+ unrelated domains | Verify: Read
- [ ] ISC-MO-3: Tier 2+ promotion requires explicit human approval via AskUserQuestion | Verify: Read
- [ ] ISC-MO-4: Only Tier 2+ motifs participate in motif-of-motif detection analysis | Verify: Read
- [ ] ISC-MO-5: Existing motif strengthened with new instance when pattern matches | Verify: Read
- [ ] ISC-MO-6: Validation protocol enforces five conditions before Tier 2 promotion | Verify: Read
- [ ] ISC-MO-7: Confidence score updates on new instance addition or triangulation | Verify: Read

### Integration
- [ ] ISC-IN-1: OCP scraper interface defined but scraper not required for operation | Verify: Read
- [ ] ISC-IN-2: Skill completes cognitive triad linking oscillate converge and reflect | Verify: Read
- [ ] ISC-IN-3: All motif storage uses vault markdown files without separate database | Verify: Grep
- [ ] ISC-IN-4: No HTTP servers or new infrastructure components are created | Verify: Grep

### Anti-Criteria
- [ ] ISC-A-SS-1: No web UI components or browser-dependent features created anywhere | Verify: Grep
- [ ] ISC-A-ML-1: No SQLite or database engine used for motif data storage | Verify: Grep
- [ ] ISC-A-MO-1: No automatic Tier 2 or above promotion without human approval | Verify: Read
- [ ] ISC-A-IN-1: No hard dependency on OCP scraper availability for skill operation | Verify: Read
- [ ] ISC-A-IN-2: No OCP scraper logic duplicated within the Reflect skill | Verify: Grep

## DECISIONS

- 2026-03-03: skill-index.json doesn't exist — skills auto-discovered via YAML frontmatter. ISC-SS-5 updated accordingly.
- 2026-03-03: Seed motifs start at Tier 1 (2+ domain instances already exist from creative methodology tests).
- 2026-03-03: Confidence score 0.0-1.0 with +0.1 per domain, +0.2 for triangulation.
- 2026-03-03: Tools/ directory created empty (canonical structure requirement).
- 2026-03-03: Fan-out 3 parallel agents for independent build tracks.

## LOG

### Iteration 0 — 2026-03-03
- Phase reached: PLAN
- Criteria progress: 0/32
- Work done: Read all 6 source documents, explored skill infrastructure, created 32 ISC criteria, wrote PRD
- Failing: all (not yet built)
- Context for next iteration: Approve plan, then fan-out BUILD with 3 parallel agents

## VERIFICATION STRATEGY

After BUILD completes:
1. **Read each created file** and verify content against ISC
2. **Glob** `~/.claude/skills/Reflect/**/*` to confirm directory structure
3. **Glob** `02-Knowledge/motifs/**/*` to confirm library scaffold
4. **Grep** skill files for absence of prohibited patterns (sqlite, database, server, html, octokit)
5. **Read** each seed motif to verify 9 schema fields present
6. **Read** workflow to verify all 5 phases, tier gates, validation protocol, confidence scoring
