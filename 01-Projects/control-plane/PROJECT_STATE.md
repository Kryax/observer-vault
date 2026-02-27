---
meta_version: 1
kind: plan
status: draft
authority: low
domain: [control-plane]
source: claude_conversation
confidence: provisional
mode: design
created: 2026-02-28T16:00:00+11:00
modified: 2026-02-28T17:00:00+11:00
cssclasses: [status-draft]
motifs: [observer-control-plane, json-rpc, multi-engine-dispatch]
refs:
  - 01-Projects/observer-council/architecture/Technical_Design_Specification_v2.md
  - 01-Projects/control-plane/decisions/001-tds-v2-open-questions.md
---

# PROJECT_STATE.md — Observer Control Plane

**Last updated:** 2026-02-28
**Updated by:** Claude (Opus 4.6) + Adam
**Phase:** Pre-build — decisions complete, awaiting PRD

---

## Current State

All TDS v2 open questions (Q1-Q8) resolved. Key architectural decisions recorded in `decisions/001-tds-v2-open-questions.md`. PRD generation is unblocked.

## Key Decisions Made

- **Single-host is canonical deployment model** — two-VM is optional hardening only
- **Minimal Phase 1 scope** — HTTP-only, Mode 1 dispatch, curl scripts, no WebSocket
- **Bubblewrap elevated** — from distant Phase 2 to late Phase 1 / early Phase 2
- **Start permissive on approvals** — tighten based on real usage
- **age for secrets** — simple, single binary

## What Exists

- `CLAUDE.md` — Customised project coordination file
- `decisions/001-tds-v2-open-questions.md` — All Q1-Q8 decisions recorded
- `architecture/` — Empty, awaiting PRD
- `milestones/` — Empty
- `src/` — Empty, awaiting build
- TDS v2 at `../observer-council/architecture/Technical_Design_Specification_v2.md`

## What Doesn't Exist Yet

- PRD with parallelisable build slices (next step)
- The `observer-system/` monorepo
- Any source code

## Blockers

None. PRD generation is unblocked.

## Next Steps

1. Generate PRD from TDS v2 (incorporating Q1-Q8 decisions, especially single-host simplification)
2. Create `observer-system/` monorepo in workspace
3. Build S0 (shared types) as foundation
4. Fan-out build of parallel group (S1-S3, S6-S7)

## Notes for PRD Generation

The TDS v2 needs significant simplification in the PRD because:
- All cross-VM sections become optional hardening appendix
- Router simplifies to localhost communication
- No Tailscale requirement for default deployment
- systemd setup is one service set, not two
- Security guarantees come from application-level mechanisms (sanitizedEnv, bubblewrap) not VM boundaries
