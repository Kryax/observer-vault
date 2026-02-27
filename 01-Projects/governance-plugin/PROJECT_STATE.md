---
meta_version: 1
kind: plan
status: draft
authority: low
domain: [vault, governance]
source: claude_conversation
confidence: provisional
mode: build
created: 2026-02-27T23:00:00+11:00
modified: 2026-02-27T23:00:00+11:00
cssclasses: [status-draft]
---

# PROJECT_STATE — Observer Governance Plugin

## Current Phase
**Pre-build** — PRD complete, project scaffolded, awaiting Atlas execution.

## What Exists
- PRD: `observer-governance-prd.md` (complete, 13 sections)
- Project structure: `architecture/`, `decisions/`, `milestones/`, `src/`
- CLAUDE.md: Project-specific Atlas instructions
- Vault templates, dashboards, CSS: all in place (created 2026-02-27)
- Controlled vocabulary: defined in PRD Section 2, needs to become `src/schema.ts`

## What Needs Building
1. Plugin scaffold (Obsidian sample plugin template, esbuild config)
2. `schema.ts` — controlled vocabulary as TypeScript const
3. `validator.ts` — frontmatter validation against schema
4. `cssync.ts` — cssclasses auto-sync on save
5. `audit.ts` — JSONL append-only audit writer
6. `promoter.ts` — promotion state machine with modal UI
7. `manifest-gen.ts` — Atlas integration manifest generator
8. `priming.ts` — VAULT_PRIMING.md regenerator
9. `settings.ts` — plugin settings tab
10. `main.ts` — wire everything together, register commands and events

## Open Questions (from PRD Section 13)
1. File moves on promotion — offer to move files or manual?
2. Batch validation on startup — yes or on-demand only?
3. Priming refresh scope — canonical only or include high-confidence drafts?
4. Audit log location — plugin folder or vault root `_audit/`?
5. Superseded linking — require link to replacement doc?
6. Notification style — toast popup or status bar only?

## Blockers
- None. Ready for Atlas to begin.

## Dependencies
- Obsidian Plugin API
- Community plugins already installed: Templater, Dataview, Auto Template Trigger, Smart Connections, Obsidian Git
- CSS snippet: `.obsidian/snippets/observer-vault.css` (in place)
- Templates: all 12 in `00-Inbox/_templates/` (in place)

## Next Action
Atlas creates PAI PRD with ISC criteria from the narrative PRD, then builds in loop mode.
