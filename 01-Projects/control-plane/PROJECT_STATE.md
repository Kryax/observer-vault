---
meta_version: 1
kind: plan
status: draft
authority: low
domain: [control-plane]
source: atlas_write
confidence: confirmed
mode: build
created: 2026-02-28T16:00:00+11:00
modified: 2026-02-28T22:28:00+11:00
cssclasses: [status-draft]
motifs: [observer-control-plane, json-rpc, multi-engine-dispatch]
refs:
  - 01-Projects/observer-council/architecture/Technical_Design_Specification_v2.md
  - 01-Projects/control-plane/decisions/001-tds-v2-open-questions.md
  - 01-Projects/control-plane/architecture/control-plane-prd.md
  - 01-Projects/control-plane/milestones/001-control-plane-build.md
---

# PROJECT_STATE.md -- Observer Control Plane

**Last updated:** 2026-02-28
**Updated by:** Claude (Opus 4.6) + Adam
**Phase:** Built, merged to master, awaiting infrastructure wiring

---

## Current State

Phase 1 build is complete and merged to master. All 8 slices (S0-S7) implemented across 3 packages. 427 tests passing. Smoke test green (9/9 checks). Merged to master at `e915fe2` on 2026-02-28. Awaiting infrastructure wiring (systemd, Tailscale, deployment).

## Build Summary

| Metric | Value |
|--------|-------|
| Build commit | `f046dac` |
| Merge commit | `e915fe2` |
| Branch | `claude/zealous-satoshi` (merged to master) |
| Files | 64 |
| Lines of code | 16,754 |
| Tests passing | 427 |
| Smoke test | 9/9 |
| Packages | 3 |
| Build slices | 8 (S0-S7 all complete) |

## Key Artifacts

- `architecture/control-plane-prd.md` -- **THE PRD** (40KB, 8 slices, ISC exit criteria, wiring table)
- `decisions/001-tds-v2-open-questions.md` -- All Q1-Q8 decisions resolved
- `milestones/001-control-plane-build.md` -- Build receipt with full details
- `observer-system/` -- **THE MONOREPO** (3 packages, 427 tests)
- `CLAUDE.md` -- Project coordination file for Atlas
- `../observer-council/architecture/Technical_Design_Specification_v2.md` -- Source spec (reference only, PRD is self-contained)

## Key Decisions

- **Single-host is canonical deployment model** -- two-VM is optional hardening only
- **Minimal Phase 1 scope** -- HTTP-only, Mode 1 dispatch, curl scripts, no WebSocket
- **Atlas/PAI is the headless core** -- dispatch is an imported library, not a separate service
- **Bubblewrap elevated** -- late Phase 1 / early Phase 2
- **Start permissive on approvals** -- tighten based on real usage
- **S4 owns src/approval/** -- separated from S2's src/policy/ for clean parallel builds
- **S5 has explicit wiring table** -- 11 methods mapped to component call sequences

## Build Order (COMPLETED)

```
S0 (shared types) --> S1+S2+S3+S6+S7 (parallel) --> S4 (approval) --> S5 (server integration)
         DONE              ALL DONE                     DONE               DONE
```

## Monorepo Structure (as built)

```
observer-system/
  packages/
    shared/             # S0: Types, schemas, error codes, IDs (60 tests)
    control-plane/      # S1-S5, S7: Core control plane (305 tests)
      src/
        session/        # S1: Session state machine + store
        policy/         # S2: Policy engine + YAML config
        audit/          # S3: Audit logger + sanitizer + circuit breaker
        approval/       # S4: Approval gateway + timeout
        server/         # S5: JSON-RPC server + auth + handlers
        health/         # S7: Health monitor + status aggregator
    dispatch/           # S6: Backend executor + env sanitization (62 tests)
  scripts/
    smoke-test.ts       # 9-check validation script
```

## Security Invariants (verified in build)

- sanitizedEnv() constructs minimal env from scratch for child processes
- No shell:true in any spawn() call
- 127.0.0.1 binding enforced at server startup
- Audit writes block requests (circuit breaker pattern)
- Default-deny policy enforcement
- Approval timeout = denied
- Credential redaction in audit output

## Next Steps

1. **Infrastructure wiring** -- systemd units, Tailscale networking, deployment scripts
2. **End-to-end integration testing** -- validate full request lifecycle across packages
3. **Real backend testing** -- test dispatch against actual CLI backends (Claude Code, Gemini CLI)
4. **Phase 2 planning** -- bubblewrap sandboxing, WebSocket transport, Telegram client, TruffleHog

## Blockers

None. Build is complete and merged to master.
