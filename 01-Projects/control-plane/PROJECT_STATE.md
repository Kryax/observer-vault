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
modified: 2026-02-28T18:00:00+11:00
cssclasses: [status-draft]
motifs: [observer-control-plane, json-rpc, multi-engine-dispatch]
refs:
  - 01-Projects/observer-council/architecture/Technical_Design_Specification_v2.md
  - 01-Projects/control-plane/decisions/001-tds-v2-open-questions.md
  - 01-Projects/control-plane/architecture/control-plane-prd.md
---

# PROJECT_STATE.md — Observer Control Plane

**Last updated:** 2026-02-28
**Updated by:** Claude (Opus 4.6) + Adam
**Phase:** PRD complete — ready to build

---

## Current State

PRD generated and reviewed. All architectural decisions recorded. Ready for build execution.

## Key Artifacts

- `architecture/control-plane-prd.md` — **THE PRD** (40KB, 8 slices, ISC exit criteria, wiring table)
- `decisions/001-tds-v2-open-questions.md` — All Q1-Q8 decisions resolved
- `CLAUDE.md` — Project coordination file for Atlas
- `../observer-council/architecture/Technical_Design_Specification_v2.md` — Source spec (reference only, PRD is self-contained)

## Key Decisions

- **Single-host is canonical deployment model** — two-VM is optional hardening only
- **Minimal Phase 1 scope** — HTTP-only, Mode 1 dispatch, curl scripts, no WebSocket
- **Atlas/PAI is the headless core** — dispatch is an imported library, not a separate service
- **Bubblewrap elevated** — late Phase 1 / early Phase 2
- **Start permissive on approvals** — tighten based on real usage
- **S4 owns src/approval/** — separated from S2's src/policy/ for clean parallel builds
- **S5 has explicit wiring table** — 11 methods mapped to component call sequences

## Build Order

```
S0 (shared types) → S1+S2+S3+S6+S7 (parallel) → S4 (approval) → S5 (server integration)
```

## Next Steps

1. Fresh Atlas context
2. Point Atlas at CLAUDE.md and the PRD
3. Build S0 first (shared types — foundation for everything)
4. Fan-out parallel build of S1, S2, S3, S6, S7
5. S4 after S1+S2+S3 complete
6. S5 integration last

## Blockers

None. Build is unblocked.
