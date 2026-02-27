---
meta_version: 1
kind: milestone
status: draft
authority: high
domain: [control-plane]
source: atlas_write
confidence: confirmed
mode: build
created: 2026-02-28T20:00:00+11:00
modified: 2026-02-28T20:00:00+11:00
cssclasses: [status-draft]
motifs: [observer-control-plane, build-receipt, phase-1]
refs:
  - 01-Projects/control-plane/architecture/control-plane-prd.md
  - 01-Projects/control-plane/decisions/001-tds-v2-open-questions.md
  - 01-Projects/observer-council/architecture/Technical_Design_Specification_v2.md
---

# Milestone: Phase 1 Control Plane Build Complete

**Date:** 2026-02-28
**Commit:** f046dac
**Branch:** claude/zealous-satoshi
**Built by:** Claude (Opus 4.6), orchestrated by Adam (Observer)

---

## Build Metadata

| Field | Value |
|-------|-------|
| Commit hash | `f046dac` |
| Branch | `claude/zealous-satoshi` |
| Date | 2026-02-28 |
| Files committed | 57 |
| Lines of code | 16,636 |
| Total tests | 427 passing |
| Smoke test | 9/9 checks pass |
| Packages | 3 (`@observer/shared`, `@observer/control-plane`, `@observer/dispatch`) |
| Build slices | 8 (S0-S7) |

---

## Slice Completion Summary

### S0: Shared Types and Schemas (`packages/shared`)
- **Tests:** 60
- **Contents:** Zod schemas for all domain types, error codes enum, ID generation utilities, type exports
- **Role:** Foundation package consumed by all other packages

### S1: Session Management (`packages/control-plane/src/session`)
- **Tests:** 53
- **Contents:** Session state machine (created/active/suspended/closed), SQLite session store, session lifecycle management
- **Dependencies:** S0

### S2: Policy Engine (`packages/control-plane/src/policy`)
- **Tests:** 60
- **Contents:** Condition evaluator, YAML configuration loader, policy enforcer with default-deny semantics
- **Dependencies:** S0

### S3: Audit Logger (`packages/control-plane/src/audit`)
- **Tests:** 51
- **Contents:** Credential sanitizer (regex + pattern detection), JSONL writer (append-only), SQLite index for queries, circuit breaker for write failures
- **Dependencies:** S0

### S4: Approval Gateway (`packages/control-plane/src/approval`)
- **Tests:** 32
- **Contents:** Approval store, timeout scheduler (timeout = denied), tier routing
- **Dependencies:** S0, S1, S2, S3

### S5: Server Integration (`packages/control-plane/src/server`)
- **Tests:** 44
- **Contents:** JSON-RPC server (jayson, HTTP transport), Bearer token auth, method handlers for all 11 Phase 1 methods, 127.0.0.1 binding
- **Dependencies:** S0, S1, S2, S3, S4

### S6: Dispatch (`packages/dispatch`)
- **Tests:** 62
- **Contents:** Backend executor, environment sanitization (`sanitizedEnv()`), health checks, YAML config, output capture
- **Dependencies:** S0

### S7: Health Monitor (`packages/control-plane/src/health`)
- **Tests:** 49
- **Contents:** Status aggregator, backend health checks, liveness endpoint (unauthenticated)
- **Dependencies:** S0

---

## Test Distribution

| Package | Test Count |
|---------|-----------|
| `@observer/shared` | 60 |
| `@observer/control-plane` | 305 |
| `@observer/dispatch` | 62 |
| **Total** | **427** |

### Control Plane Breakdown

| Module | Tests |
|--------|-------|
| Session (S1) | 53 |
| Policy (S2) | 60 |
| Audit (S3) | 51 |
| Health (S7) | 49 |
| Server (S5) | 44 |
| Approval (S4) | 32 |
| Other | 16 |

---

## Architecture Decisions Applied

All decisions from `decisions/001-tds-v2-open-questions.md` were applied during build:

1. **Single-host canonical deployment** (Q3) -- all services communicate over localhost, no cross-VM protocol needed
2. **Environment sanitization for credential isolation** (Q2) -- `sanitizedEnv()` constructs minimal env from scratch for all child processes
3. **Minimal Phase 1 scope** (Q1) -- HTTP-only, Mode 1 dispatch, 11 JSON-RPC methods
4. **Default-deny policy** (Q5) -- start permissive for approvals but policy engine enforces default-deny when no rule matches
5. **age for secrets** (Q6) -- secret management designed for age-encrypted files, tmpfs at runtime
6. **Bubblewrap deferred to Phase 2** (Q4) -- Phase 1 relies on env sanitization, bubblewrap elevated for Phase 2

---

## Security Invariants Verified

These non-negotiables from the TDS and CLAUDE.md are structurally enforced in the implementation:

### sanitizedEnv() is sacred
Child processes spawned by the dispatch executor never receive `process.env`. The `sanitizedEnv()` function constructs a minimal environment object from scratch, containing only explicitly allowed variables. This is the primary credential isolation mechanism for Phase 1.

### No shell: true
All `spawn()` calls in the dispatch package use array arguments. Shell expansion is never enabled. This prevents command injection through backend arguments.

### 127.0.0.1 binding asserted at startup
The JSON-RPC server binds exclusively to `127.0.0.1`. This is not configurable to `0.0.0.0`. The binding address is validated at server startup.

### Audit writes block requests
If the audit logger cannot write (JSONL or SQLite), requests are rejected. The circuit breaker pattern detects persistent write failures and transitions to an error state. Only `health.status` and `session.close` are exempt from audit-blocking.

### Default deny in policy
The policy engine returns deny when no rule matches a given request. Explicit allow rules are required for every permitted operation.

### Approval timeout = denied
When an approval request times out without a human response, it is treated as denied. The system fails safe, not open.

### Config is restart-to-reload
Configuration is loaded from YAML at startup. No hot-reload mechanism exists. Running configuration always matches the file on disk.

---

## Known Limitations and Next Steps

### Immediate
1. **Merge to master** -- branch `claude/zealous-satoshi` needs to be merged
2. **Integration testing** -- individual package tests pass; end-to-end integration across the full request lifecycle needs validation
3. **Real backend testing** -- dispatch tests use mocked backends; testing against actual Claude Code, Gemini CLI needs to happen

### Phase 2 Candidates
1. **Bubblewrap sandboxing** (elevated priority) -- namespace isolation for backend processes
2. **WebSocket transport** -- streaming output from long-running backend operations
3. **Multi-client support** -- full Session > Thread > Turn > Item hierarchy
4. **TruffleHog integration** -- dual-layer credential detection (regex is Phase 1, TruffleHog is Phase 2)
5. **Telegram client** -- approval interface for mobile human-in-the-loop

### Technical Debt
- Smoke test runs via `tsx` script; could be formalized into the test suite
- Some test files use in-memory SQLite; production path validation with on-disk SQLite needed
- Error messages could be more specific for debugging in production

---

## Monorepo Structure (as built)

```
observer-system/
  packages/
    shared/             # S0: Types, schemas, error codes, IDs
    control-plane/      # S1-S5, S7: Core control plane
      src/
        session/        # S1: Session state machine + store
        policy/         # S2: Policy engine + YAML config
        audit/          # S3: Audit logger + sanitizer + circuit breaker
        approval/       # S4: Approval gateway + timeout
        server/         # S5: JSON-RPC server + auth + handlers
        health/         # S7: Health monitor + status aggregator
    dispatch/           # S6: Backend executor + env sanitization
  scripts/
    smoke-test.ts       # 9-check validation script
  tsconfig.json         # Workspace-level TypeScript config
```

---

## Verification Commands

```bash
# Run all tests
cd observer-system && npx vitest run --reporter=verbose

# Run smoke test
cd observer-system && npx tsx scripts/smoke-test.ts

# Run individual package tests
cd observer-system/packages/shared && npx vitest run
cd observer-system/packages/control-plane && npx vitest run
cd observer-system/packages/dispatch && npx vitest run
```
