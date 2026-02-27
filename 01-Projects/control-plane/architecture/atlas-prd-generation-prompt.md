# Atlas Task: Generate PRD for Observer Control Plane

## Task Type
**Plan mode only. Do NOT write any code. Do NOT create any source files.**

The deliverable is a single PRD document saved to:
`/mnt/zfs-host/backup/projects/observer-vault/01-Projects/control-plane/architecture/control-plane-prd.md`

## Context

You are generating a build-ready PRD for the Observer Control Plane — a JSON-RPC server that accepts client connections, enforces governance policy, routes work to backend CLI tools, manages human-in-the-loop approvals, and maintains an append-only audit trail.

The source specification is a 220KB Technical Design Specification (TDS v2) produced by a 4-agent deliberation team. Your job is to distill it into a focused, actionable PRD with parallelisable build slices and explicit ISC exit criteria — the same format that made the governance plugin build succeed in 30 minutes.

## Critical Inputs (read these in order)

### Layer 1 — Orientation (read first)
1. **CLAUDE.md** at `/mnt/zfs-host/backup/projects/observer-vault/01-Projects/control-plane/CLAUDE.md`
   - Project overview, architecture summary, slice dependency graph, boundary rules
2. **Decision Record** at `/mnt/zfs-host/backup/projects/observer-vault/01-Projects/control-plane/decisions/001-tds-v2-open-questions.md`
   - All Q1-Q8 decisions are resolved. These OVERRIDE the TDS v2 defaults where they conflict.

### Layer 2 — Reference Specification (read section-by-section, NOT all at once)
3. **TDS v2** at `/mnt/zfs-host/backup/projects/observer-vault/01-Projects/observer-council/architecture/Technical_Design_Specification_v2.md`
   - This is 220KB. DO NOT load it all into context at once.
   - Use sub-agents to read specific sections as needed.
   - Key sections for PRD generation: 1 (Tech Stack), 2 (Directory Structure), 3 (Component Specs), 4 (Config Schemas), 6 (Testing Strategy), 8 (Slice Dependency Graph)
   - Section 5 (Security) is important but can be summarised — the PRD needs security requirements per slice, not the full threat model.

### Layer 3 — Reference PRD (format example)
4. **Governance Plugin PRD** at `/mnt/zfs-host/backup/projects/observer-vault/01-Projects/governance-plugin/observer-governance-prd.md`
   - This is the PRD format that produced a successful 30-minute build. Use it as a structural reference for how to write actionable build slices.

## Key Decisions That Override TDS v2

The decision record changes the architecture significantly. The PRD MUST reflect these:

1. **Single-host is the canonical deployment model.** All cross-VM sections (3i, parts of 3f, Tailscale health checks, coordinated multi-VM restarts) become an optional appendix, NOT part of the core build slices. Control plane and dispatch communicate over localhost.

2. **Bubblewrap elevated to late Phase 1 / early Phase 2.** It's no longer a distant nice-to-have — it replaces VM-boundary credential isolation for single-host deployments.

3. **Minimal Phase 1 scope (7-point).** HTTP-only, Mode 1 dispatch, curl scripts, no WebSocket, no Telegram, Node.js only, flat structure.

4. **Start permissive on approval tiers.** Auto-approve read-only ops. Require approval only for code execution, file modification, external API calls.

5. **Atlas/PAI is the headless core.** Dispatch layer is an imported library, not a separate service.

## PRD Structure Requirements

The PRD must include:

### Header
- Frontmatter with vault schema (kind: plan, status: draft, source: atlas_write)
- Purpose statement
- Scope (what's in, what's explicitly out for Phase 1)
- Design constraints

### Technology Stack
- Confirmed stack from TDS v2 Section 1 (TypeScript, Node.js 22 LTS, jayson, Zod, better-sqlite3, pino, vitest)
- npm workspaces monorepo structure

### Controlled Vocabulary / Shared Types
- All TypeScript interfaces and enums from TDS v2 Section 3 that define the shared contract
- These are the schema that all slices build against
- Include: Session, Thread, Turn, Item, ClientType, ThreadStatus, IntentType, ApprovalTier, AuditCategory, ObserverErrorCode, PolicyCondition, PolicyDecision, DispatchRequest, DispatchResult, BackendStatus, HealthStatus
- Include Zod schema definitions where specified

### Build Slices
Each slice must have:
- **Slice ID** (S0, S1, etc.)
- **Package/directory** where the code lives
- **Dependencies** on other slices
- **What to build** — specific files, functions, interfaces
- **What NOT to build** — explicit exclusions to prevent scope creep
- **ISC Exit Criteria** — concrete, testable conditions. "It works" is not a criterion. "Server starts, binds to 127.0.0.1:9000, rejects requests to 0.0.0.0" is.
- **Security requirements** specific to this slice (pulled from TDS v2 Section 5)
- **Test requirements** — what tests must pass before the slice is done

### Slice Dependency Graph
- Visual representation of which slices can be built in parallel
- Critical path identification
- Recommended build order for fan-out execution

### Configuration Schemas
- YAML schemas for control-plane.yaml and execution-backends.yaml
- Simplified for single-host (no cross-VM config)
- Example configs included

### Operational Scripts
- What scripts are needed (health-check.sh, smoke-test.sh, recent-activity.sh)
- What each must do
- RUNBOOK.md requirements

## What NOT to Include

- Full threat model (reference TDS v2 Section 5 instead)
- Full deliberation history (reference TDS v2 appendices instead)
- Two-VM deployment details (optional appendix only)
- Phase 2/3 features (WebSocket, Telegram client, Mode 2/3 dispatch, GUI client)
- Implementation code (this is a PRD, not a codebase)

## Quality Criteria

The PRD is successful if:
1. Atlas can generate parallelisable build slices from it without reading the 220KB TDS
2. Every slice has unambiguous ISC exit criteria that a sub-agent can verify
3. No TypeScript interface is defined in two places — shared types are defined once in S0
4. The security requirements per slice are concrete enough to test, not just "be secure"
5. A developer who has never read the TDS could build from the PRD alone
6. The PRD is under 40KB (the governance plugin PRD was 22KB and that was sufficient for a successful build)

## Sub-Agent Strategy

Given the 220KB TDS, use sub-agents for:
- **Sub-agent 1:** Read TDS Sections 1-2 (Tech Stack + Directory Structure) → extract confirmed stack and project layout
- **Sub-agent 2:** Read TDS Section 3 (Component Specs) → extract all TypeScript interfaces and public APIs per component
- **Sub-agent 3:** Read TDS Section 4 (Config Schemas) → extract YAML schemas, simplify for single-host
- **Sub-agent 4:** Read TDS Sections 6+8 (Testing + Slice Graph) → extract ISC criteria and dependency map
- **Sub-agent 5:** Read TDS Section 5 (Security) → extract per-component security requirements as bullet points
- **Synthesis agent:** Combine sub-agent outputs into the final PRD document

## Boundary Rules

- **Plan mode only.** If you find yourself writing TypeScript, STOP.
- **Do not create the monorepo.** The PRD describes what to build, not the build itself.
- **Do not modify the TDS.** It's a reference document, not an input to edit.
- **Do not modify CLAUDE.md or PROJECT_STATE.md.** Those are managed by the coordination layer.
- **Save the PRD to the architecture/ directory** in the control-plane project, not to Inbox.
- **Include vault frontmatter** on the PRD document.

## When Done

Save the PRD to:
`/mnt/zfs-host/backup/projects/observer-vault/01-Projects/control-plane/architecture/control-plane-prd.md`

Then report what you produced and any open issues or recommendations.
