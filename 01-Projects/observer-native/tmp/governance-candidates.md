# Observer-Native: First Active Governance Capability — Candidates

> Research output. Three candidates for Observer-native's first feature that *acts*, not just observes.

**Date:** 2026-03-06
**Status:** DRAFT — for Adam's review

---

## Current State

Observer-native (s0-s7) is fully built as a passive infrastructure:

| Slice | Role | Status |
|-------|------|--------|
| S0 | Core types: `ObserverEvent` union (SessionStart, PreToolUse, PostToolUse, SessionStop), ISC, PRD, escalation types | Complete |
| S1 | Hook adapter: translates Claude Code stdin events to Observer events, writes NDJSON stream to `tmp/events.ndjson` | Complete, wired to settings.json |
| S2 | Memory: session capture, context hydration, vault writer | Complete |
| S3 | Cognitive skills: Oscillate, Converge, Reflect triad | Complete |
| S4 | Council: perspective agents, triangulator, sentry, reflector, builder, deliberation | Complete |
| S5 | ISC/PRD pipeline: PRD creation, slice decomposition, fan-out, merge, motif application | Complete |
| S6 | Sub-agent orchestration: dispatch, collection, merge, retry with bounded retries | Complete |
| S7 | Escalation: task failure gates, process quality gates, sovereignty enforcement (`assertGateResolved`) | Complete |

**The gap:** S1's adapter outputs `{ continue: true }` immediately and logs events. It never blocks, warns, or triggers downstream governance. S7's human gates exist as types and functions but nothing creates them in response to real events. The system observes everything and governs nothing.

---

## How PAI Hooks Provide Active Governance (Reference)

PAI has 21 hooks. The governance-relevant ones use a **PreToolUse intercept pattern**:

**SecurityValidator** (`SecurityValidator.hook.ts`):
- Triggers on: PreToolUse for Bash, Edit, Write, Read
- Reads stdin, matches tool input against `patterns.yaml` rules
- Three response tiers: `exit(2)` hard block, `{ decision: "ask" }` user prompt, `{ continue: true }` allow
- Logs every decision to `MEMORY/SECURITY/` as JSONL
- Key design: pattern-driven, fail-open for usability, fail-safe for catastrophic ops

**AgentExecutionGuard** (`AgentExecutionGuard.hook.ts`):
- Triggers on: PreToolUse for Task tool
- Checks if `run_in_background: true` is set
- Injects `<system-reminder>` warning if foreground agent detected
- Non-blocking (warning only), but structurally visible

**SkillGuard** (`SkillGuard.hook.ts`):
- Triggers on: PreToolUse for Skill tool
- Blocks known false-positive skills (position-bias bug)
- Returns `{ decision: "block" }` with explanation

**OILEventBridge** (`OILEventBridge.hook.ts`):
- Triggers on: PostToolUse (all tools)
- Passive event capture to NDJSON — architecturally identical to Observer-native's S1 adapter
- This is the *predecessor* that S1 replaces

**Key insight:** PAI's active governance is entirely in PreToolUse hooks that intercept before execution. PostToolUse hooks are passive recorders. Observer-native's S1 adapter currently behaves like a PostToolUse recorder even though it receives PreToolUse events — it has the position to act but doesn't.

---

## Candidate 1: Boundary Guardian

### What It Does

Adds a governance check to the S1 adapter's PreToolUse path. Before outputting `{ continue: true }`, the adapter evaluates the incoming `ObserverPreToolUse` event against Observer-native's own governance rules — specifically the boundary constraints declared in CLAUDE.md:

- **PAI safety boundary:** Block writes to `~/.claude/`, `~/.claude/skills/`, `~/.claude/settings.json`
- **Control plane boundary:** Block modifications to `/opt/observer-system/` from the observer-native workspace
- **PRD authority:** Warn on file operations outside the current PRD's declared working directory

The check would use the same three-tier response model as PAI's SecurityValidator: hard block (`exit(2)`), ask user (`{ decision: "ask" }`), or allow (`{ continue: true }`).

### What Events It Acts On

- **`ObserverPreToolUse`** — specifically when `toolName` is `Bash`, `Edit`, `Write`, or `Read`
- Inspects `parameters` (the tool input) for file paths and commands
- The adapter already receives and translates these events; the governance check inserts between translation and emission

### Why It Should Be First

1. **Minimal code change, maximum governance value.** The S1 adapter already occupies the PreToolUse position. Adding a check before `console.log(JSON.stringify({ continue: true }))` is a single-function insertion — no new files, no new hook registrations.

2. **Enforces rules that already exist.** CLAUDE.md lines 56-63 declare PAI safety boundaries. These rules currently depend on the AI reading and following them. A Boundary Guardian makes them structural — the same shift S7's sovereignty module makes for escalation gates.

3. **Proven pattern.** PAI's SecurityValidator demonstrates this exact architecture works at <10ms with fail-open safety. The pattern is battle-tested across 21+ hooks.

4. **Direct path to S7 integration.** A boundary violation naturally produces a `TaskFailureEscalation` (structural diagnosis: `conflicting_constraints`). This connects S1 directly to S7's human gate, activating the sovereignty boundary for the first time.

### Source Code References

- `src/s1/adapter.ts:296-320` — hook entry point where `{ continue: true }` is output before any check
- `src/s0/events.ts:21-29` — `ObserverPreToolUse` type with `toolName` and `parameters`
- `src/s7/sovereignty.ts:37-54` — `SOVEREIGNTY_PRINCIPLE` constant and `assertGateResolved`
- `src/s0/escalation.ts:15-21` — `TaskFailureEscalation` type for boundary violations
- CLAUDE.md lines 56-63 — PAI safety and boundary rules (the governance policy to enforce)

---

## Candidate 2: Scope Drift Detector

### What It Does

A PostToolUse analyzer that watches for file modifications outside the declared scope of the active PRD. When a `Write` or `Edit` tool completes, the detector:

1. Extracts the file path from the `ObserverPostToolUse` event's `toolInput`
2. Compares it against the PRD's declared working directory and key files (from S5's `PRD.context.keyFiles`)
3. If the path is outside scope, creates a `ProcessQualityEscalation` with trigger `SYSTEMATIC_ABSENCE` (the PRD scope check was absent from the deliberation that led to the edit)

This doesn't block — it fires after execution. But it creates a typed escalation event that S7's sovereignty boundary can surface to the human.

### What Events It Acts On

- **`ObserverPostToolUse`** — when `toolName` is `Write`, `Edit`, or `Bash` (for commands containing file-writing operations)
- Uses `toolInput` to extract target file paths
- Cross-references against the PRD loaded by S2's context hydration

### Why It Should Be First

1. **Unique to Observer.** PAI has no scope drift detection. This would be the first governance capability that exists in Observer-native but has no PAI equivalent — establishing Observer as genuinely independent, not a clone.

2. **Connects three slices.** S1 (event capture) -> S5 (PRD scope) -> S7 (process quality escalation). This exercises the architecture as designed — events flowing through the typed pipeline to governance outcomes.

3. **"PRD Is the Authority" is the core governance principle.** CLAUDE.md's governance section makes this the foundational rule. Enforcing it structurally is the highest-leverage governance addition.

4. **Non-blocking, low-risk.** Since it fires on PostToolUse, it cannot break the CLI session. It observes and escalates but never blocks. This makes it safe to deploy immediately while the human gate UX is still being designed.

### Source Code References

- `src/s0/events.ts:31-41` — `ObserverPostToolUse` with `toolInput` and `result`
- `src/s5/prd-creation.ts` — PRD creation with context and key files
- `src/s5/types.ts` — `PRDContext` type defining scope
- `src/s7/process-quality.ts:46-76` — `createProcessQualityEscalation` function
- `src/s7/process-quality.ts:85-94` — `createProcessQualityGate` that blocks deliberation
- `src/s0/escalation.ts:24-37` — `ProcessQualityTrigger` enum

---

## Candidate 3: Retry-to-Gate Bridge

### What It Does

Watches the NDJSON event stream for repeated tool failures and, when S6's retry threshold is exceeded, activates S7's task failure gate — making the sovereignty boundary functional for the first time.

The bridge:

1. Maintains a sliding window of recent `ObserverPostToolUse` events
2. Detects error outcomes (failed tool results) grouped by tool name and context
3. When the same tool fails 3+ times (S6's `DEFAULT_MAX_RETRIES`), constructs a `TaskFailureEscalation` with structural diagnosis
4. Calls `createTaskFailureGate` to create a BLOCKED human gate
5. Writes the gate to the event stream as a new event type for the control plane to surface

### What Events It Acts On

- **`ObserverPostToolUse`** — monitors `result` field for error indicators
- Correlates failures across events using `sessionContext.sessionId`
- Produces a new event (gate creation) that downstream consumers can act on

### Why It Should Be First

1. **Activates the most-built infrastructure.** S6's retry module (`retry.ts`) and S7's task failure module (`task-failure.ts`) are fully typed and implemented but disconnected from real events. This bridge is the missing wire — connecting event capture to the escalation loop that's already designed.

2. **Smallest conceptual leap.** The `executeTaskFailureLoop` function in `task-failure.ts:114-146` already describes the exact flow: retries exhausted -> Council diagnosis -> human gate. The bridge just triggers this flow from real NDJSON events instead of waiting for code-level invocation.

3. **Makes sovereignty real.** S7's `assertGateResolved` function throws if a gate is BLOCKED, preventing execution from proceeding without human input. But no gate is ever created from real events today. This bridge creates the first real gate, making the sovereignty principle operational.

4. **Connects to Council.** The task failure loop includes `requestCouncilDiagnosis` — when this bridge fires, it would be the first time the Council (S4) is invoked from a real governance event rather than a test.

### Source Code References

- `src/s1/adapter.ts:183-190` — `emitEvent` method for writing to NDJSON stream
- `src/s0/events.ts:31-41` — `ObserverPostToolUse` with `result` field
- `src/s6/retry.ts` — `DEFAULT_MAX_RETRIES`, `createRetryState`, `decideRetry`, `escalateToHuman`
- `src/s7/task-failure.ts:114-146` — `executeTaskFailureLoop` (the complete escalation flow)
- `src/s7/task-failure.ts:70-79` — `createTaskFailureGate` (creates BLOCKED gate)
- `src/s7/sovereignty.ts:62-72` — `assertGateResolved` (structural enforcement)

---

## Comparison Matrix

| Dimension | Boundary Guardian | Scope Drift Detector | Retry-to-Gate Bridge |
|-----------|------------------|---------------------|---------------------|
| **Hook position** | PreToolUse (blocking) | PostToolUse (observing) | PostToolUse (observing) |
| **Can block execution** | Yes | No (escalates after) | No (gates future execution) |
| **Code change scope** | Modify S1 adapter only | New module + S1 wiring | New module + S1 wiring |
| **Slices activated** | S1, S7 | S1, S2, S5, S7 | S1, S4, S6, S7 |
| **PAI equivalent** | SecurityValidator | None (unique) | None (unique) |
| **Risk if buggy** | Could block legitimate ops | Zero (post-execution) | Zero (post-execution) |
| **Governance rules enforced** | PAI safety, workspace boundaries | PRD scope authority | Retry budget, sovereignty |
| **Implementation effort** | Low (single function) | Medium (needs PRD context loading) | Medium (needs event stream analysis) |

---

## Recommendation

**Start with Candidate 1 (Boundary Guardian)** for tactical safety, then build Candidate 2 (Scope Drift Detector) for strategic differentiation.

The Boundary Guardian is the smallest change with the most immediate governance value — it converts existing CLAUDE.md rules from "please follow these" into "structurally enforced." It also establishes the PreToolUse intercept pattern that all future active governance will use.

The Scope Drift Detector should follow immediately because it's the first capability that has no PAI equivalent — it establishes Observer-native as a genuinely new governance system, not just a rewrite of PAI's hooks.

The Retry-to-Gate Bridge is the most architecturally ambitious (activating S4, S6, and S7 together) and should come third, after the simpler patterns prove out the event-to-governance pipeline.
