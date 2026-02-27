# Observer Governance Plugin

## Session Start
- Read `PROJECT_STATE.md` to understand current state
- Read `observer-governance-prd.md` for the full specification
- Check `decisions/` for any recent architectural decisions

## Project Overview

The single custom Obsidian plugin for the Observer Vault. Handles document lifecycle management, frontmatter validation, promotion workflow, audit logging, cssclasses auto-sync, and Atlas integration manifest generation. This is the 20% that community plugins can't cover.

**Status:** active
**Repo:** Built in-place at `01-Projects/governance-plugin/src/`
**Build output:** `.obsidian/plugins/observer-governance/`
**Vault home:** 01-Projects/governance-plugin/

## Active Goals

1. Build the plugin from PRD specification
2. Implement frontmatter validation against controlled vocabulary (Schema v1)
3. Implement promotion state machine with human-gated transitions
4. Implement JSONL audit log
5. Generate Atlas integration manifest

## Workflow

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan — don't keep pushing
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents to keep main context window clean
- One task per subagent for focused execution
- Offload research, exploration, and parallel work to subagents

### 3. Verification Before Done
- Never mark a task complete without proving it works
- Run any project-specific verification gates before declaring done
- Ask yourself: "Would Adam approve this?"

### 4. Context Budgeting
- Read this file first (Layer 1 — orientation)
- Read `observer-governance-prd.md` for full spec (Layer 2 — essential)
- Read `architecture/` docs only when working on design tasks (Layer 2)
- Read `decisions/` only when you need historical rationale (Layer 2)
- Access `02-Knowledge/` and `04-Archive/` only for deep research (Layer 3)
- Do NOT load everything upfront — progressive disclosure saves context

## Key Files

- `PROJECT_STATE.md` — Current state, active work, blockers
- `observer-governance-prd.md` — **THE SPEC** — full PRD with schema, state machine, audit format, manifest schema, UI elements, and technical implementation details
- `architecture/` — Design documents and technical specs
- `decisions/` — Decision records with rationale
- `milestones/` — Completed milestones and exit artifacts
- `src/` — TypeScript source code

## Technical Stack

- **Language:** TypeScript (Obsidian Plugin API)
- **Build:** esbuild (standard Obsidian plugin build)
- **Dependencies:** Obsidian API only — no external packages
- **Frontmatter parsing:** Obsidian's built-in `processFrontMatter()`
- **Target:** Obsidian desktop only

## Source Structure (target)

```
src/
├── main.ts                # Plugin entry point
├── validator.ts           # Frontmatter validation logic
├── promoter.ts            # Promotion state machine and file moves
├── audit.ts               # JSONL audit log writer
├── manifest-gen.ts        # Atlas manifest generator
├── priming.ts             # Priming document generator
├── cssync.ts              # cssclasses auto-sync
├── schema.ts              # Controlled vocabulary definitions (SINGLE SOURCE OF TRUTH)
└── settings.ts            # Plugin settings tab
```

## Boundary Enforcement (NON-NEGOTIABLE)

### Universal Rules
- **Human Sovereignty**: Adam decides. Atlas executes.
- **Authority Boundary**: The Vault describes ABOUT the workspace, not FOR it. Never derive executable decisions from Vault narrative.
- **No Drift**: Architecture changes only through documented decisions
- **Receipts Exist**: If it happened, document it
- **Boundaries Are Real**: Approved boundaries are walls, not suggestions

### Project-Specific Rules
1. The plugin MUST NOT block file saves — validation is advisory, not blocking (fail-open)
2. The plugin MUST NOT promote to canonical without human action — sovereignty is non-negotiable
3. The plugin MUST NOT have any network interface — runs inside Obsidian only
4. Schema definitions in `schema.ts` are the single source of truth — the manifest generator exports FROM this, the validator checks AGAINST this
5. Audit log is append-only JSONL — never modify existing entries
6. Build output goes to `.obsidian/plugins/observer-governance/` — do not commit build artifacts to src/

## Vault Write Rules
- Atlas creates new files in `00-Inbox/` only
- Atlas can update documents with status `inbox` or `draft`
- Atlas CANNOT modify `canonical` or `archived` documents
- All Atlas-created documents must include valid frontmatter per vault schema
- Source field must be set to `atlas_write` or `gpt_build`

## Stop Conditions (Always Apply)
- Boundary crossing without documented approval → STOP
- Uncertainty about scope or intent → STOP and ask Adam
- Modifying canonical documents → STOP
- Architecture changes without decision record → STOP
- Merge conflicts during parallel work → STOP
- Pre-commit or verification gate failure → STOP and report
- Do not build when asked to plan
- Do not execute when asked to record
- If plugin requires external dependencies beyond Obsidian API → STOP and justify

## Session End Checklist
- [ ] Update `PROJECT_STATE.md` with current state
- [ ] Update Active Goals in this file if priorities changed
- [ ] Document any decisions made in `decisions/`
- [ ] Commit work with meaningful message
- [ ] Note any blockers or open questions for Adam
