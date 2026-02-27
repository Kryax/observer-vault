# Observer Control Plane

## Session Start
- Read `PROJECT_STATE.md` to understand current state
- Read `architecture/Technical_Design_Specification_v2.md` for the full TDS
- Check `decisions/` for any architectural decisions Adam has made
- If a status script exists, run it before starting work

## Project Overview

The JSON-RPC control plane and multi-engine execution dispatch layer for the Observer ecosystem. Accepts client connections (CLI, Telegram, GUI), enforces governance policy, routes work to backend CLI tools (Claude Code, Gemini CLI, Codex CLI, Ollama) via the CachyOS headless core, manages human-in-the-loop approvals, and maintains an append-only audit trail. This is the central nervous system that makes "AI articulates, humans decide" a protocol, not a suggestion.

**Status:** active — pre-build (awaiting PRD generation from TDS v2)
**Monorepo:** To be created at `observer-system/` (npm workspaces)
**Vault home:** 01-Projects/control-plane/
**TDS:** `../observer-council/architecture/Technical_Design_Specification_v2.md` (220KB, 4-agent deliberation output)

## Active Goals

1. Generate PRD from TDS v2 with parallelisable build slices
2. Resolve open questions (Section 9 of TDS) before build begins
3. Build S0 (shared types and schemas) as foundation
4. Build parallel group (S1-S3, S6-S7) against S0 contracts
5. Integrate with S4 (approval gateway) and S5 (server + router)

## Architecture Summary

### Monorepo Structure (target)
```
observer-system/
  packages/
    shared/           # Types, Zod schemas, error codes, ID generation
    control-plane/    # JSON-RPC server, session mgr, policy, approvals, audit
    dispatch/         # Backend executor, health checks, output capture
  scripts/            # Operational scripts (health-check, recent-activity, status)
  RUNBOOK.md          # 2am operational reference
```

### Technology Stack
- **Language:** TypeScript (strict mode)
- **Runtime:** Node.js 22 LTS (exclusively — no Bun)
- **Package Manager:** npm with workspaces
- **JSON-RPC:** jayson (HTTP transport, Phase 1)
- **Validation:** Zod (runtime schemas + type inference)
- **Persistence:** better-sqlite3 (audit index, session store)
- **Logging:** pino (structured JSON)
- **Config:** YAML (human-edited, restart-to-reload)
- **Testing:** vitest
- **Secrets:** age (encrypted at rest, tmpfs at runtime)

### Slice Dependency Graph
```
S0 (shared) → S1 (session) + S2 (policy) + S3 (audit) + S6 (dispatch) + S7 (health)
                                    ↓
                              S4 (approval — needs S1, S2, S3)
                                    ↓
                              S5 (server + router — wires everything)
```

### Two-VM Deployment
- **Observer Relay VM:** Control plane (127.0.0.1:9000), Telegram client
- **CachyOS VM:** Dispatch layer, Atlas, CLI backends
- **Cross-VM:** HTTP JSON-RPC over Tailscale + Bearer token auth

## Workflow

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan — don't keep pushing
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents to keep main context window clean
- One task per subagent for focused execution
- Offload research, exploration, and parallel work to subagents
- Fan-out pattern proven with governance-plugin build (7 parallel agents)

### 3. Verification Before Done
- Never mark a task complete without proving it works
- Run vitest suite for each slice before declaring done
- Credential isolation tests are highest priority (EX-6 prevention)
- Ask yourself: "Would Adam approve this?"

### 4. Context Budgeting
- Read this file first (Layer 1 — orientation)
- Read `PROJECT_STATE.md` for current status (Layer 1)
- Read TDS v2 sections ONLY for the slice you're working on (Layer 2 — it's 220KB, don't load all of it)
- Read `decisions/` only when you need historical rationale (Layer 2)
- Access `02-Knowledge/` and `04-Archive/` only for deep research (Layer 3)
- Do NOT load the entire TDS upfront — progressive disclosure saves context

## Key Files

- `PROJECT_STATE.md` — Current state, active work, blockers
- `../observer-council/architecture/Technical_Design_Specification_v2.md` — **THE SPEC** (220KB) — full TDS with component specs, security architecture, config schemas, testing strategy, deployment ops
- `../observer-council/architecture/Observer_Ecosystem_Architecture_v2_Control_Plane.md` — Vision-level architecture
- `../observer-council/architecture/Observer_Ecosystem_Multi-Engine.md` — Dispatch layer architecture
- `../observer-council/architecture/Observer_Security_Governance_Framework.md` — Security invariants
- `architecture/` — Project-specific design documents and PRD (once generated)
- `decisions/` — Decision records with rationale
- `milestones/` — Completed milestones and exit artifacts

## Technical Reference (from TDS v2)

### JSON-RPC Methods (Phase 1)
| Method | Auth | Purpose |
|--------|------|---------|
| `session.create` | Yes | Create new session |
| `session.close` | Yes | Close session |
| `session.resume` | Yes | Resume with pending approvals |
| `thread.create` | Yes | Start work thread with intent |
| `thread.status` | Yes | Poll for updates and approvals |
| `thread.cancel` | Yes | Cancel active thread |
| `turn.submit` | Yes | Submit work to thread |
| `approval.respond` | Yes | Human decision on approval |
| `health.status` | No | Liveness + topology |
| `audit.query` | Yes | Query audit trail |
| `admin.revoke_token` | Yes (CLI) | Emergency token revocation |

### Security Non-Negotiables (from TDS v2 Section 5)
- **NNF-1:** Credential isolation between backends (Phase 1: env sanitization, Phase 2: bubblewrap)
- **NNF-2:** Telegram approval scope restricted to CLI-only for approve/escalate tiers
- **NNF-3:** Dual-layer credential detection (regex + TruffleHog)
- **NNF-4:** Structurally append-only audit (JSONL primary + SQLite index)
- **NNF-5:** Secrets bootstrap documented (age encrypted, tmpfs at runtime)
- **NNF-6:** Backend sandboxing (Phase 2 bubblewrap)
- **NNF-7:** Auth failure rate limiting
- **NNF-8:** Telegram structural enforcement via intent_type, not keyword matching

### Open Questions (Section 9 — awaiting Adam's decisions)
- Q1: Accept Operator's 7-point minimal Phase 1 scope?
- Q2: Phase 1 env sanitization, Phase 2 separate users?
- Q3: Two VMs or single VM?
- Q4: Bubblewrap timing — Phase 2?
- Q5: Approval tier assignments — how conservative?
- Q6: Secret management — age?
- Q7: Single-VM collapse implications?
- Q8: Cross-VM auth strategy for Phase 2?

## Boundary Enforcement (NON-NEGOTIABLE)

### Universal Rules
- **Human Sovereignty**: Adam decides. Atlas executes.
- **Authority Boundary**: The Vault describes ABOUT the workspace, not FOR it. Never derive executable decisions from Vault narrative.
- **No Drift**: Architecture changes only through documented decisions
- **Receipts Exist**: If it happened, document it
- **Boundaries Are Real**: Approved boundaries are walls, not suggestions

### Project-Specific Rules
1. **sanitizedEnv() is sacred** — child processes NEVER receive process.env. This is the #1 security guarantee. Do not weaken it for convenience.
2. **Audit writes block requests** — if audit can't write, the request doesn't proceed (except health.status and session.close)
3. **127.0.0.1 binding is asserted at startup** — never bind to 0.0.0.0, never make this configurable beyond localhost
4. **No shell: true** — all spawn() calls use array args. No exceptions. No "just this once."
5. **Config is restart-to-reload** — no hot-reload. Running config always matches file on disk.
6. **Default deny** — if no policy rule matches, deny. Explicit allow required.
7. **Fail safe, not fail open** — approval timeout = denied. Backend unavailable = error, not silent skip.
8. **Cross-VM timeout >= max dispatch timeout + 60s** — prevents the control plane timing out while dispatch is still running

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
- If credential isolation tests fail → HARD STOP, do not proceed
- If worktree build completes → MERGE OR NOTIFY ADAM (do not leave stranded)

## Session End Checklist
- [ ] Update `PROJECT_STATE.md` with current state
- [ ] Update Active Goals in this file if priorities changed
- [ ] Document any decisions made in `decisions/`
- [ ] Commit work with meaningful message
- [ ] If worktree was used, merge to main or explicitly notify Adam
- [ ] Note any blockers or open questions for Adam
