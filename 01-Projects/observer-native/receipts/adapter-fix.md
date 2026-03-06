# S1 Adapter Fix — Hook Entry Point

**Date:** 2026-03-06
**Status:** Fixed, pending session restart for live verification

## Root Cause

The adapter's hook entry point was missing two requirements for Claude Code hook integration:

1. **No `{ continue: true }` stdout response.** Claude Code hooks must output a JSON response to stdout telling the CLI to proceed. Without this, the hook is treated as a timeout/rejection, and the tool pipeline stalls or skips the hook.

2. **Blocking stdin read.** `for await (process.stdin)` can block indefinitely if stdin doesn't close promptly. The OILEventBridge pattern uses `Bun.stdin.stream().getReader()` with a 200ms `Promise.race` timeout — safe and non-blocking.

## Fix Applied

- Added immediate `console.log(JSON.stringify({ continue: true }))` before stdin read
- Replaced `for await (process.stdin)` with `Bun.stdin.stream().getReader()` + 200ms timeout
- Pattern matches the proven OILEventBridge hook architecture

## Verification

```bash
# Manual test passes — stdout response + event written:
echo '{"type":"SessionStart","session_id":"test","cwd":"/tmp"}' | \
  /mnt/zfs-host/backup/projects/observer-vault/01-Projects/observer-native/src/s1/adapter.ts
# Output: {"continue":true}
# tmp/events.ndjson: contains translated ObserverSessionStart event

# Live verification: restart Claude Code, then check:
cat 01-Projects/observer-native/tmp/events.ndjson | wc -l
# Should show events accumulating from SessionStart, PreToolUse, PostToolUse hooks
```

## Files Changed

- `src/s1/adapter.ts` — hook entry point rewritten (lines 298-321)
