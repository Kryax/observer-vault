---
receipt: true
slice: S1
title: Hook Adapter (CLI Bridge)
status: COMPLETE
date: 2026-03-06
file: src/s1/adapter.ts
---

# S1 -- Hook Adapter: ISC Exit Criteria Verification

## ISC-1: Adapter registers for all four Claude Code hook events

**PASS**

The `registerHooks` method constructs registration entries for all four events:

```
event: "SessionStart"
event: "PreToolUse"
event: "PostToolUse"
event: "Stop"
```

Evidence: `grep 'event:' src/s1/adapter.ts` shows all four in the registration payload.

## ISC-2: Each CLI event translates to the corresponding Observer event type from S0

**PASS**

The `translateEvent` method's switch statement maps:

- `SessionStart` -> `ObserverSessionStart`
- `PreToolUse` -> `ObserverPreToolUse`
- `PostToolUse` -> `ObserverPostToolUse`
- `Stop` -> `ObserverSessionStop`

Evidence: `grep 'case "' src/s1/adapter.ts` shows all four cases. Each private translation method returns the correct S0 type with full field mapping.

## ISC-3: Translated events emit to NDJSON stream at configured path

**PASS**

- `emitEvent()` serializes events via `JSON.stringify(event) + "\n"` (valid NDJSON)
- Appends to the file at `eventStreamPath`
- Default path: `{workspace}/tmp/events.ndjson`
- Configurable via `HookRegistrationConfig.eventStreamPath`

## ISC-4: Adapter failure does not break the underlying CLI session

**PASS**

Three fail-silent try/catch blocks:

1. Constructor: `ensureStreamDirectory()` wrapped in try/catch
2. `emitEvent()`: JSON serialization + file write wrapped in try/catch
3. `handleHookEvent()`: entire translate+emit pipeline wrapped in try/catch

All catch blocks are empty (silent swallow). No errors propagate to the CLI.

## ISC-5: No imports from PAI internal modules exist in adapter code

**PASS**

Only two import statements:

1. `import { mkdirSync, appendFileSync } from "node:fs"` -- Node.js stdlib
2. `import type { ... } from "../s0/index.ts"` -- Observer's own S0 foundation

No `.claude/`, `PAI/`, `hooks/lib/`, or any PAI path references in imports.
(The only `.claude` string is a governance comment on line 143, not code.)

## ISC-6: Adapter interface contract is defined such that a second CLI adapter can implement it

**PASS**

Exported types:

- `HookAdapter` interface with `translateEvent`, `registerHooks`, `getEventStream`
- `HookRegistrationConfig` interface for configuration

Any second CLI adapter imports `HookAdapter` and implements the three methods. The `ClaudeCodeAdapter` class demonstrates the pattern via `implements HookAdapter`.

## ISC-7: Event stream is readable by all downstream Observer components (valid NDJSON)

**PASS**

Events are emitted as `JSON.stringify(event) + "\n"` -- one JSON object per line, newline-delimited. This is valid NDJSON per spec. Any consumer can `readLines()` and `JSON.parse()` each line.

## ISC-8: Adapter is a single file with no dependencies on other S1+ components

**PASS**

- Single file: `src/s1/adapter.ts`
- Imports only: `node:fs` (stdlib) and `../s0/index.ts` (foundation layer below S1)
- No imports from S2, S3, S4, S5, S6, S7 or any other S1 file
- `grep 'from.*s[2-9]' src/s1/adapter.ts` returns zero matches

## Verification Commands Run

| Check | Command | Result |
|-------|---------|--------|
| Type safety | `tsc --noEmit --strict` | Clean (zero errors) |
| Four event translations | `grep 'case "' src/s1/adapter.ts` | 4 matches |
| Fail-silent pattern | `grep '} catch' src/s1/adapter.ts` | 3 matches |
| No PAI imports | `grep '\.claude/\|PAI/\|hooks/lib' src/s1/adapter.ts` | 0 code imports |
| Interface exported | `grep 'export interface HookAdapter' src/s1/adapter.ts` | 1 match |
| No S1+ deps | `grep 'from.*s[2-9]' src/s1/adapter.ts` | 0 matches |
| Only valid imports | `grep 'import.*from' src/s1/adapter.ts` | 2 (node:fs, s0) |

## Result

**8/8 ISC criteria PASSING.** S1 is complete.
