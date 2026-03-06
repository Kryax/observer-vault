# Receipt: S1 Adapter Field Mapping Fix

**Date:** 2026-03-06
**Status:** Complete
**Session:** Atlas diagnostic + fix session

## Root Cause

The S1 adapter (`src/s1/adapter.ts`) dispatched on `event.type` but Claude Code sends the event type as `hook_event_name` in its stdin JSON. Every event hit the default switch case, threw silently, and zero events were ever written from real Claude Code sessions.

Additionally, event-specific fields used wrong names:
- PreToolUse: adapter read `parameters`, CC sends `tool_input`
- PostToolUse: adapter read `result` + `duration_ms`, CC sends `tool_result` (no duration)
- Stop: adapter read `summary` + `exit_reason`, CC sends `reason`

## Claude Code Actual Stdin Schema

Common fields on every hook event:
```
session_id, hook_event_name, transcript_path, cwd, permission_mode
```

Event-specific:
- SessionStart: common fields only
- PreToolUse: + `tool_name`, `tool_input`
- PostToolUse: + `tool_name`, `tool_input`, `tool_result`
- Stop: + `reason`

## Changes Made

### `src/s0/events.ts`
- `ObserverPostToolUse.durationMs` made optional (CC doesn't send it)
- `ObserverPostToolUse.toolInput` added (CC sends tool_input on PostToolUse)
- `ObserverSessionStop.summary` replaced with `reason`
- `ObserverSessionStop.exitReason` added `"unknown"` fallback variant

### `src/s1/adapter.ts`
- Added `ClaudeCodeCommonFields` base interface with all 5 common fields
- All `ClaudeCode*Event` interfaces updated to extend common fields
- `switch (event.type)` changed to `switch (event.hook_event_name)`
- `translateSessionStart`: removed nonexistent `git` and `timestamp` fields
- `translatePreToolUse`: reads `tool_input` instead of `parameters`
- `translatePostToolUse`: reads `tool_result` instead of `result`, adds `toolInput`, drops `durationMs`
- `translateStop`: reads `reason`, maps to `exitReason` enum with `"unknown"` fallback

## Verification

All 4 event types tested with realistic Claude Code stdin payloads:
```
SessionStart -> ObserverSessionStart (sessionId, timestamp, workingDirectory)
PreToolUse   -> ObserverPreToolUse   (toolName, parameters, sessionContext)
PostToolUse  -> ObserverPostToolUse  (toolName, toolInput, result, sessionContext)
Stop         -> ObserverSessionStop  (sessionId, timestamp, reason, exitReason)
```

Real Claude Code events from the live session were also captured successfully during testing, confirming the adapter now fires correctly in production.

## Evidence

OILEventBridge (same stdin-reading pattern) had 6,260+ events. Observer adapter had 0 from real sessions before fix. After fix, real session events immediately appeared in `tmp/events.ndjson`.
