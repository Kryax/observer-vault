# Atlas Prompt: Observer-Native PRD

**Date:** 6 March 2026
**Purpose:** Prompt for Atlas to produce the Observer-native system PRD
**Status:** Ready to paste into Atlas

---

## PROMPT

You are about to produce the most important specification document in the Observer project to date: the PRD for Observer-native — the replacement for PAI as the cognitive infrastructure layer.

Before writing anything, read these documents in full:

```
# Prior work — read ALL of these first:
~/.claude/skills/PAI/PAISYSTEMARCHITECTURE.md
~/.claude/skills/PAI/PAIAGENTSYSTEM.md
/home/adam/.claude-v3/skills/PAI/Components/10-pai-intro.md
/home/adam/vault/workspaces/observer/oil/exits/2026-02-24_exit-011_pai-decoupling-decision.md
/home/adam/vault/workspaces/observer/oil/docs/architecture/pai_runtime_layout.md
/mnt/zfs-host/backup/projects/observer-vault/02-Knowledge/architecture/Theory_To_Architecture_20260305.md
/mnt/zfs-host/backup/projects/observer-vault/01-Projects/observer-council/Council_Redesign_TDS_20260305.md
/mnt/zfs-host/backup/projects/observer-vault/01-Projects/observer-council/Reflect_Operation8_Proposal_20260305.md
/mnt/zfs-host/backup/projects/observer-vault/01-Projects/control-plane/PROJECT_STATE.md
/mnt/zfs-host/backup/projects/observer-vault/01-Projects/observer-council/architecture/OBSERVER_CONSTITUTION_DRAFT.md
/mnt/zfs-host/backup/projects/observer-vault/01-Projects/observer-council/architecture/council-builder-escalation-loop.md
```

---

## Context You Must Understand Before Specifying

**What Observer-native is:**
A CLI-agnostic cognitive infrastructure layer that replaces PAI as the execution backbone for the Observer project. It is NOT a PAI fork or a PAI wrapper. It is built from scratch, informed by PAI's patterns, but owned entirely by the Observer project. It runs first on Claude Code. It is designed from day one to be hot-swappable to any CLI tool (OpenCode, Gemini CLI, or future tools) via an adapter interface.

**What PAI gave us that we keep (concepts, not code):**
- The algorithm loop structure (Observe → Think → Plan → Build → Execute → Verify → Learn)
- The skill system as the organisational unit for capabilities
- The hook lifecycle as the extension point for the underlying CLI
- The ISC/ideal-state system for quality verification
- The PRD → parallel slices → fan-out build pattern
- The memory system for cross-session persistence
- Sub-agents as the default execution strategy when parallelism is possible

**What PAI gave us that we discard:**
- Tight coupling to Claude Code's hook internals (we use an adapter)
- The Arbol cloud execution layer (not relevant)
- The agent personality/voice system complexity (we have voice, we keep it simple)
- PAI's upgrade cycle dependency (we own our own code)
- Monolithic hook files (we build modular, single-responsibility hooks)

**What Observer-native adds that PAI never had:**
- The cognitive triad as the deliberation architecture (Oscillate → Converge → Reflect)
- The Council role structure (Perspective Agents, Triangulator, Sentry, Reflector, Builder)
- The motif library as active design constraint (not passive catalogue)
- The Reflect skill Operation 8 (process self-modeling)
- The Reflector process-quality escalation path (separate from task failure)
- Sub-agents as the DEFAULT — any parallelisable work MUST use sub-agents unless a specific reason prevents it
- CLI-agnostic hook adapter (OILEventBridge pattern, already decided in exit-011)
- The sovereignty boundary formalised: AI articulates, humans decide — escalation is structural not optional

**The control plane exists and is built:**
The JSON-RPC control plane (localhost:9000) is complete — 427 tests passing, merged to master. Observer-native dispatches through it. Do not re-specify the control plane. It is infrastructure that Observer-native uses.

**Sub-agent policy (CRITICAL — this must be embedded in the PRD):**
Sub-agents are the default execution strategy. The system must know when it CAN use sub-agents and ALWAYS use them when it can. The only reasons NOT to use sub-agents are:
1. The task is strictly sequential (output of step N is required input for step N+1 with no way to parallelise)
2. Context window constraints make fan-out impractical
3. The task requires a single coherent reasoning thread (e.g. creative synthesis)

Every PRD build phase must declare its parallelisation strategy explicitly. Fan-out is assumed unless declared otherwise with reason.

---

## The PRD You Will Write

**Working directory:** `/mnt/zfs-host/backup/projects/observer-vault/01-Projects/observer-native/`

This directory is already scaffolded with CLAUDE.md, src/, exits/, receipts/, and .prd/.

**Output path:** `/mnt/zfs-host/backup/projects/observer-vault/01-Projects/observer-native/.prd/PRD_Observer_Native_20260306.md`

Note: The old `/home/adam/vault/` location is DEPRECATED. Do not use it.

**Status:** DRAFT

**The PRD must cover:**

### System Overview
What Observer-native is, what it replaces, what it keeps from the existing infrastructure, what the control plane provides (don't re-spec it), and the CLI-agnostic design principle.

### Architecture Overview
The layered architecture:
- Hook adapter layer (CLI interface — hot-swappable)
- Cognitive layer (triad skills + Council roles)
- Memory layer (cross-session persistence)
- ISC/PRD pipeline (specification → execution)
- Sub-agent orchestration layer (fan-out, parallel build, merge)
- Escalation layer (sovereignty boundary)
- Control plane interface (dispatches to existing CP at localhost:9000)

### Component Specifications (one section per component)

**S0 — Core Types and Interfaces (foundation — built first, everything imports from here)**
- Hook event interface (SessionStart, PreToolUse, PostToolUse, Stop) — the four Claude Code hook events, abstracted behind Observer's own types so swapping CLI means swapping the adapter only
- ISC schema (ideal state criteria — typed)
- PRD schema (the structure every PRD must conform to)
- Escalation event types (task failure vs process quality — two distinct types)
- Sub-agent task schema (how work is packaged for fan-out)
- Motif reference schema (how a motif is cited in an ISC criterion)

**S1 — Hook Adapter (CLI bridge)**
Based on exit-011's OILEventBridge pattern. An Observer-owned hook file that:
- Registers for Claude Code's four hook events
- Translates them into Observer's internal event types (S0)
- Emits to Observer's event bus (NDJSON stream)
- Fails silently — never breaks the underlying CLI session
- Is the ONLY file that knows about Claude Code's specifics
- Swapping to OpenCode means writing a new adapter, nothing else changes

**S2 — Memory System**
Cross-session persistence. Must cover:
- Session capture (what gets recorded per session)
- Vault integration (how memory writes to the observer-vault)
- Context hydration (how prior sessions inform current session at startup)
- The framework delta mechanism (from Reflect Op8 — how each session updates the observation framework for the next)
- Memory is NOT PAI's MEMORY/ directory — it integrates with the vault structure already established

**S3 — Cognitive Skills**
The three triad skills as Observer-native components:
- OscillateAndGenerate (existing, formalise as Observer-native)
- ConvergeAndEvaluate (existing, formalise as Observer-native)
- Reflect with Operation 8 (existing Ops 5-7 + new Op8 from the proposal document)
- Specify the triad closed loop: Reflect output feeds next Oscillate as seed material
- Specify the sub-agent policy for each skill: Oscillate MUST fan out to sub-agents (one per perspective); Converge runs single-thread (synthesis requires coherence); Reflect runs single-thread

**S4 — Council Roles**
The five roles from the Council Redesign TDS:
- Perspective Agents (Oscillate phase — sub-agents by definition, 2-4)
- Triangulator (Converge phase — single agent)
- Sentry (Converge phase — single agent, adversarial)
- Reflector (Reflect phase — single agent, mandatory)
- Builder (execution phase — sub-agents for parallel work packets)
Include the deliberation sequence from the TDS (already specified — reference it, don't re-specify in full, just note what Observer-native adds)

**S5 — ISC and PRD Pipeline**
The specification-to-execution pipeline:
- PRD creation (whole-to-parts, human-involved planning phase)
- PRD slice decomposition (how a PRD is broken into parallel build slices)
- Slice dependency graph (S0 first, then parallel, then integration)
- Fan-out to sub-agents (one sub-agent per slice, or multiple per slice for large slices)
- Sub-agent completion criteria (each slice has ISC exit criteria — slice only closes when ISC pass)
- Merge and integration (how slice outputs are combined)
- The motif application protocol (from Theory_To_Architecture Section 3 — motifs as ISC-generating lenses, `Motif:` tag on criteria)

**S6 — Sub-Agent Orchestration**
This is the component that makes parallelism work. Specify:
- The sub-agent task schema (from S0) in use
- How tasks are dispatched (fan-out mechanism)
- How sub-agent outputs are collected and validated
- The merge protocol (conflict resolution when sub-agents produce overlapping outputs)
- The retry policy (what happens when a sub-agent fails its ISC)
- The escalation trigger (when sub-agent failures exceed retry budget → Council re-entry)
- Sub-agent context budgeting (each sub-agent gets sufficient context but not the full session context)
- The DEFAULT RULE embedded in this component: if work can be parallelised, it MUST be. The orchestrator rejects sequential execution of parallelisable work.

**S7 — Escalation Layer**
The sovereignty boundary — where AI stops and human decides:
- Task failure escalation (Builder fails proof gates — existing pattern, formalise)
- Process quality escalation (Reflector detects recurring bias — new pattern from TDS)
- Escalation payload formats (both types — typed in S0)
- Human gate: escalation blocks execution until human responds
- Resolution paths: human provides missing info / adjusts constraint / approves retry / takes over
- The constitutional principle: "AI articulates, humans decide" is not a guideline — it is a hard stop in the escalation layer

### Build Order
```
S0 (core types — foundation)
    ↓
S1 + S2 + S3 + S4 (parallel — all depend on S0, not on each other)
    ↓
S5 + S6 (parallel — depend on S0-S4)
    ↓
S7 (depends on S5+S6 for escalation event types in use)
    ↓
Integration + smoke test
```

### ISC Exit Criteria (per slice)
Each slice section must end with its ISC — the criteria that must pass before the slice is considered complete. These are the acceptance tests for the build.

### Integration ISC
The criteria that verify the full system works end-to-end:
1. A full triad session completes (Oscillate with sub-agents → Converge → Reflect with Op8)
2. Reflect output is stored and available to next session's Oscillate
3. A PRD is created, sliced, and fanned out to sub-agents
4. Sub-agent outputs are merged without conflict
5. A task failure escalation reaches human and blocks execution
6. A process quality escalation reaches human via Reflector path
7. Hook adapter receives a Claude Code event and translates it to Observer's internal type
8. Swapping the hook adapter does not require changes to any other component
9. The motif application protocol generates at least one motif-sourced ISC criterion in a PRD
10. Sub-agent default policy is enforced — a parallelisable task submitted as sequential is rejected with explanation

### Deployment Notes
- Runs in Claude Code first (Claude Code is S1's first adapter implementation)
- Control plane at localhost:9000 is assumed running (see control-plane PROJECT_STATE.md)
- No new infrastructure required beyond what is already built
- Observer-native working directory already exists at: `/mnt/zfs-host/backup/projects/observer-vault/01-Projects/observer-native/` (scaffolded, do not recreate)
- Language: TypeScript + Bun (consistent with existing Observer stack)

---

## Output Requirements

1. Write the PRD to `.prd/PRD_Observer_Native_20260306.md` inside the working directory
2. Read `CLAUDE.md` in the working directory before starting — it contains session governance rules
4. Commit from the vault repo with message: `"prd: Observer-native system PRD — CLI-agnostic cognitive infrastructure replacing PAI"`
4. Report: slice count, ISC criterion count per slice, total ISC count, estimated build complexity per slice

**Use sub-agents** for any research tasks during PRD writing where parallelism helps — for example, reading multiple reference documents simultaneously, or drafting multiple component sections in parallel before synthesising.

**The PRD itself is a planning artifact — it is not implementation.** Do not write code. Do not create directory structures beyond the PRD output path and its parent. The PRD describes what will be built. Building happens in subsequent sessions.

**Status: DRAFT.** Adam reviews and approves before any build begins.

---

## What Good Looks Like

A good PRD for this project:
- Is specific enough that a sub-agent given one slice can build it without asking questions
- Has ISC exit criteria that are binary (pass/fail, not subjective)
- Traces every design decision to a source (prior work, grounded principle, or explicit decision)
- Declares the sub-agent strategy for every build phase explicitly
- Does not introduce new architectural concepts not already decided
- Is honest about what is deferred (note it, don't specify it)
- The motif library and the three-axis framework inform the ISC design without the PRD re-explaining the theory

Commit the PRD and report back.
