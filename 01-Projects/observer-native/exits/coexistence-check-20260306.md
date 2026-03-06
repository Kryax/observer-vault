# Coexistence Check: Observer-Native S1 Adapter + PAI Hooks

**Date:** 2026-03-06
**Verdict:** CLEAR -- No conflicts detected
**Method:** Read-only analysis of settings.json hook registry and adapter source

---

## 1. PAI Hook Inventory (from ~/.claude/settings.json)

All hooks registered in settings.json, organized by lifecycle event:

### SessionStart (3 hooks)

| Hook | Matcher | Purpose | Side Effects |
|------|---------|---------|-------------|
| StartupGreeting.hook.ts | (global) | Displays PAI banner | stdout banner, reads settings.json |
| LoadContext.hook.ts | (global) | Injects PAI context as system-reminder | stdout system-reminder, reads SKILL.md + steering rules |
| CheckVersion.hook.ts | (global) | Checks Claude Code version vs npm | stderr notification, network request |

### PreToolUse (5 hooks across 5 matchers)

| Hook | Matcher | Purpose | Side Effects |
|------|---------|---------|-------------|
| VoiceGate.hook.ts | Bash | Blocks voice curls from subagents | May block Bash commands containing localhost:8888 |
| SecurityValidator.hook.ts | Bash | Security pattern validation | Writes to MEMORY/SECURITY/ JSONL, may prompt user |
| SecurityValidator.hook.ts | Edit | Security pattern validation | Same as above |
| SecurityValidator.hook.ts | Write | Security pattern validation | Same as above |
| SecurityValidator.hook.ts | Read | Security pattern validation | Same as above |
| SetQuestionTab.hook.ts | AskUserQuestion | Sets tab title on question | Tab title change |
| AgentExecutionGuard.hook.ts | Task | Guards agent spawning | May block Task calls |
| SkillGuard.hook.ts | Skill | Guards skill invocations | May block Skill calls |

### PostToolUse (3 hooks across 12 matchers)

| Hook | Matchers | Purpose | Side Effects |
|------|----------|---------|-------------|
| QuestionAnswered.hook.ts | AskUserQuestion | Tracks answered questions | State update |
| AlgorithmTracker.hook.ts | Bash, TaskCreate, TaskUpdate, Task | Tracks algorithm phases, ISC criteria, agents | Writes algorithm-state.json |
| OILEventBridge.hook.ts | Bash, TaskCreate, TaskUpdate, Task, Read, Write, Edit, Grep, Glob, WebFetch, WebSearch | Captures tool events as NDJSON for OIL | Appends to ~/vault/workspaces/observer/oil/tmp/events.ndjson |

### Stop (1 hook)

| Hook | Matcher | Purpose | Side Effects |
|------|---------|---------|-------------|
| StopOrchestrator.hook.ts | (global) | Orchestrates voice, tab reset, skill rebuild, doc integrity | Parses transcript, dispatches to handlers/ |

### SessionEnd (5 hooks)

| Hook | Matcher | Purpose | Side Effects |
|------|---------|---------|-------------|
| WorkCompletionLearning.hook.ts | (global) | Captures work completion learnings | Writes to MEMORY/ |
| SessionSummary.hook.ts | (global) | Generates session summary | Writes to MEMORY/ |
| RelationshipMemory.hook.ts | (global) | Updates relationship memory | Writes to MEMORY/ |
| UpdateCounts.hook.ts | (global) | Updates settings.json counts | Writes to settings.json counts field |
| IntegrityCheck.hook.ts | (global) | Post-session integrity validation | Reads/validates state |

### UserPromptSubmit (4 hooks)

| Hook | Matcher | Purpose | Side Effects |
|------|---------|---------|-------------|
| RatingCapture.hook.ts | (global) | Captures 1-10 ratings from prompts | Writes to MEMORY/ |
| AutoWorkCreation.hook.ts | (global) | Auto-creates work sessions | Writes to MEMORY/WORK/ |
| UpdateTabTitle.hook.ts | (global) | Updates terminal tab title | Tab title change |
| SessionAutoName.hook.ts | (global) | Auto-names sessions | Session metadata update |

---

## 2. Observer-Native S1 Adapter Analysis

**Source:** `src/s1/adapter.ts` (293 lines)

### Fail-Silent Verification

Three explicit try/catch blocks with empty catch bodies:

| Location | Method | What It Catches |
|----------|--------|----------------|
| Line 109-113 | constructor | Stream directory creation failure |
| Line 188-193 | emitEvent() | JSON serialization or file append failure |
| Line 201-207 | handleHookEvent() | Translation or emission failure (full pipeline) |

**Result:** All errors are caught and swallowed. Adapter failures NEVER propagate to the CLI.

### Write Isolation

The adapter writes to exactly ONE location:

```
{workspace}/tmp/events.ndjson
```

Default: `/mnt/zfs-host/backup/projects/observer-vault/01-Projects/observer-native/tmp/events.ndjson`

File operations used:
- `mkdirSync(dir, { recursive: true })` -- creates stream directory (line 286)
- `appendFileSync(this.eventStreamPath, line, "utf-8")` -- appends events (line 290)

No other file paths are written to. No reads from PAI paths.

### Import Analysis

```typescript
import { mkdirSync, appendFileSync } from "node:fs";       // Node stdlib only
import type { ... } from "../s0/index.ts";                  // Observer-internal types only
```

Zero imports from:
- `~/.claude/` (PAI root)
- `hooks/lib/` (PAI hook internals)
- `skills/` (PAI skills)
- Any PAI module whatsoever

### State Mutation Analysis

| PAI State | Modified by Adapter? |
|-----------|---------------------|
| settings.json | No |
| algorithm-state.json | No |
| MEMORY/ directories | No |
| SKILL.md or components | No |
| OIL events.ndjson | No (different path) |
| Any ~/.claude/ file | No |

---

## 3. Coexistence Map: Event-by-Event

### SessionStart

| Order | Hook | Conflict? |
|-------|------|-----------|
| 1 | PAI: StartupGreeting | None |
| 2 | PAI: LoadContext | None |
| 3 | PAI: CheckVersion | None |
| NEW | Observer-native: S1 adapter | **No conflict** -- writes to own NDJSON, fail-silent |

**Analysis:** PAI hooks output to stdout/stderr. Adapter appends to its own file. No shared state.

### PreToolUse

| Order | Hook | Matcher | Conflict? |
|-------|------|---------|-----------|
| 1 | PAI: VoiceGate | Bash | None |
| 2 | PAI: SecurityValidator | Bash/Edit/Write/Read | None |
| 3 | PAI: SetQuestionTab | AskUserQuestion | None |
| 4 | PAI: AgentExecutionGuard | Task | None |
| 5 | PAI: SkillGuard | Skill | None |
| NEW | Observer-native: S1 adapter | (global or per-tool) | **No conflict** -- pure observer, no blocking decisions |

**Analysis:** PAI PreToolUse hooks return `{continue: true}` or blocking decisions. The adapter would run alongside them independently. It does not return blocking decisions -- it only records the event.

### PostToolUse

| Order | Hook | Matcher | Conflict? |
|-------|------|---------|-----------|
| 1 | PAI: QuestionAnswered | AskUserQuestion | None |
| 2 | PAI: AlgorithmTracker | Bash/TaskCreate/TaskUpdate/Task | None |
| 3 | PAI: OILEventBridge | Bash + 10 more tools | None |
| NEW | Observer-native: S1 adapter | (global or per-tool) | **No conflict** -- writes to different NDJSON path |

**Analysis:** OILEventBridge writes to `~/vault/workspaces/observer/oil/tmp/events.ndjson`. The S1 adapter writes to `{workspace}/tmp/events.ndjson`. Completely different files, no contention.

### Stop

| Order | Hook | Conflict? |
|-------|------|-----------|
| 1 | PAI: StopOrchestrator | None |
| NEW | Observer-native: S1 adapter | **No conflict** -- records stop event to own stream |

**Analysis:** StopOrchestrator parses transcript and dispatches to its own handlers. Adapter records stop to its own NDJSON. No overlap.

### SessionEnd (Observer-native does NOT register here)

PAI hooks: WorkCompletionLearning, SessionSummary, RelationshipMemory, UpdateCounts, IntegrityCheck.
Observer-native: Not present. No interaction.

### UserPromptSubmit (Observer-native does NOT register here)

PAI hooks: RatingCapture, AutoWorkCreation, UpdateTabTitle, SessionAutoName.
Observer-native: Not present. No interaction.

---

## 4. Wiring Requirements

Adding Observer-native requires ONLY new entries appended to existing settings.json hook arrays:

```jsonc
// SessionStart -- append to existing hooks array:
{ "type": "command", "command": "<workspace>/src/s1/adapter.ts" }

// PreToolUse -- new matcher entry (does not modify existing matchers):
{ "matcher": "...", "hooks": [{ "type": "command", "command": "<workspace>/src/s1/adapter.ts" }] }

// PostToolUse -- new matcher entry (does not modify existing matchers):
{ "matcher": "...", "hooks": [{ "type": "command", "command": "<workspace>/src/s1/adapter.ts" }] }

// Stop -- append to existing hooks array:
{ "type": "command", "command": "<workspace>/src/s1/adapter.ts" }
```

**No existing PAI hook entries are modified, reordered, or removed.**

---

## 5. Conflict Summary

| Check | Result |
|-------|--------|
| Shared file paths | CLEAR -- different NDJSON paths |
| Shared state objects | CLEAR -- no shared in-memory or on-disk state |
| Import dependencies | CLEAR -- zero PAI imports |
| Blocking behavior | CLEAR -- adapter is observe-only, never blocks |
| Error propagation | CLEAR -- triple fail-silent wrapping |
| Hook ordering sensitivity | CLEAR -- adapter is order-independent |
| Matcher collisions | CLEAR -- new matchers, no modifications to existing |
| Settings.json modifications | CLEAR -- additions only, no edits to existing entries |

**Overall verdict: CLEAR. Observer-native S1 adapter can coexist with PAI without conflict.**

---

## 6. Notes

- The OILEventBridge is architecturally the closest PAI hook to the S1 adapter (both are NDJSON event recorders). They are fully independent: different ownership, different output paths, different event schemas.
- When Adam approves wiring, the adapter's `registerHooks()` method already produces the correct settings.json payload structure -- it just defers the actual write per CLAUDE.md governance rules.
- The adapter explicitly documents "No PAI imports" as a design constraint (line 11 of adapter.ts).
