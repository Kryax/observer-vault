---
prd: true
id: PRD-20260308-s2-salience-filter
status: COMPLETE
mode: interactive
effort_level: Extended
created: 2026-03-08
updated: 2026-03-08
iteration: 1
maxIterations: 128
loopStatus: completed
last_phase: VERIFY
failing_criteria: []
verification_summary: "15/15"
parent: null
children: []
language: TypeScript
runtime: Bun
---

# S2 Salience Filter — Highlight Layer Above S1 Events

> Transform raw sensation into perception by marking significant events as highlights, giving the session-end writer differential attention instead of undifferentiated event streams.

**Status:** DRAFT -- requires Adam's approval before any build begins.

**Source:** D/I/R Session 3 architectural synthesis, build order step 2. Implements GPT's "highlight" object — the only object in the ten-object taxonomy that addresses the salience gap Session 2 identified.

**Depends on:** Step 1 complete (PRD-20260308-s2-episodic-memory-loop, 11/12 ISC passing). S1 adapter running. Session-end hook wired.

---

## STATUS

| What | State |
|------|-------|
| Progress | 15/15 criteria passing |
| Phase | VERIFY complete |
| Next action | Commit and close |
| Blocked by | Nothing |

---

## 1. Problem Space

The S1 adapter captures every event with equal weight — tool calls, session lifecycle, errors, routine operations all land in `events.ndjson` as undifferentiated NDJSON lines. The session-end hook (step 1) constructs a `SessionRecord` from these events, but its summary is mechanical: event counts and tool frequency. A session with a critical failure and a session with 50 routine Reads produce summaries of equal blandness.

Session 3 identified this as the sensation-without-perception problem: "S1 adapter captures everything equally. Needed: a salience filter that elevates significant events into GPT's 'highlight' category."

The salience filter is a thin layer *above* S1, not a modification to S1. The adapter stays dumb. A layer above it gets selective. The filter uses simple heuristics — no NLP, no LLM inference — to mark events as highlights. The session-end writer then uses highlights to produce richer, more useful summaries.

### What exists (inputs to this PRD)

| Component | Location | Status |
|-----------|----------|--------|
| S1 adapter | `src/s1/adapter.ts` | Running, writes `events.ndjson` |
| `ObserverEvent` types | `src/s0/events.ts` | Stable — SessionStart, PreToolUse, PostToolUse, SessionStop |
| Session-end hook | `src/s2/session-end-hook.ts` | Wired, produces `SessionRecord` with mechanical summary |
| Session-start hook | `src/s2/session-start-hook.ts` | Wired, hydrates context from recent sessions |
| `readActiveMotifs()` | `src/s2/context-hydration.ts:141` | Working, reads motif entries from `02-Knowledge/motifs/` |
| `SessionRecord` | `src/s2/session-capture.ts:17` | Stable, has summary field for enrichment |
| Motif library | `02-Knowledge/motifs/` | 10 active motifs |

### What doesn't exist (outputs of this PRD)

| Component | Purpose |
|-----------|---------|
| `Highlight` type | A marked event with salience score and triggering heuristic |
| `SalienceFilter` function | Takes events + context, returns highlights |
| Heuristic implementations | Four heuristic functions per Session 3 spec |
| Session-end integration | Hook uses highlights for enriched summary |

---

## 2. Scope Boundary

This PRD covers **only** the salience filter / highlight layer (build order step 2). It does NOT cover:

- Episodic memory loop wiring (step 1 -- COMPLETE, separate PRD)
- Motif library priming at session start (step 3 -- separate PRD)
- Scraper FTS5 fix or scraper-to-motif pipeline (step 4 -- separate PRD)
- Tension/gap tracking backlog (step 5 -- separate PRD)
- Cron-scheduled fast loop / circular engine (step 6 -- separate PRD)

---

## 3. Work Items

### 3.1 Define Highlight type

Add to a new file `src/s2/salience-filter.ts`:

```typescript
export interface Highlight {
  /** The source event that was marked as significant. */
  event: ObserverEvent;
  /** Salience score: 0.0 (routine) to 1.0 (critical). */
  salience: number;
  /** Which heuristic(s) triggered this highlight. */
  triggers: SalienceTrigger[];
  /** ISO timestamp of when the highlight was produced. */
  timestamp: string;
}

export type SalienceTrigger =
  | { type: "motif_touch"; motifName: string }
  | { type: "error_or_failure"; detail: string }
  | { type: "novel_tool"; toolName: string }
  | { type: "long_duration"; durationMs: number };
```

The `SalienceTrigger` discriminated union makes each highlight self-documenting — you can see *why* it was flagged, not just *that* it was flagged. Multiple triggers on a single event compound the salience score.

Export from `src/s2/index.ts`.

### 3.2 Implement salience heuristics

Four heuristic functions, each pure and testable independently:

**3.2.1 Motif-touch heuristic.** Compare event content (tool names, parameters, file paths) against active motif names and keywords from the motif library. An event "touches" a motif when its tool input references files, concepts, or patterns that a motif describes.

Input: `ObserverEvent` + `MotifEntry[]` (from `readActiveMotifs()`).
Output: `SalienceTrigger[]` (zero or more motif_touch triggers).
Salience contribution: 0.3 per motif touched (additive, capped at 1.0).

**3.2.2 Error-and-failure heuristic.** Detect events that indicate something went wrong. For `PostToolUse` events: check for error indicators in `result` (error fields, non-zero exit codes, exception patterns). For `SessionStop` events: check `exitReason === "error"`.

Input: `ObserverEvent`.
Output: `SalienceTrigger | null`.
Salience contribution: 0.8 (errors are almost always significant).

**3.2.3 Novel-tool heuristic.** Track which tools have been used in the session so far. When a `PreToolUse` event names a tool not yet seen in the session, mark it as novel. The first use of every tool is novel; the goal is to catch unusual tool combinations, not routine Read/Grep/Edit cycles.

Input: `ObserverEvent` + `Set<string>` (tools seen so far in session).
Output: `SalienceTrigger | null`.
Salience contribution: 0.2 (novelty is interesting but not urgent).
Note: Common tools (Read, Grep, Glob, Edit, Write, Bash) should have reduced novelty scores or be excluded from novelty detection entirely, since they appear in nearly every session.

**3.2.4 Long-duration heuristic.** Match `PreToolUse` and `PostToolUse` event pairs by tool invocation. When the elapsed time between pre and post exceeds a threshold, mark the post event as a long-duration highlight. This catches slow builds, hanging processes, and timeout-adjacent operations.

Input: `ObserverPreToolUse` + `ObserverPostToolUse` pair.
Output: `SalienceTrigger | null`.
Threshold: configurable, default 10 seconds.
Salience contribution: 0.4 (long operations often indicate issues or significant work).

### 3.3 Implement SalienceFilter function

The main entry point:

```typescript
export interface SalienceContext {
  /** Active motifs from the vault, used by motif-touch heuristic. */
  activeMotifs: MotifEntry[];
  /** Duration threshold in milliseconds for long-duration detection. */
  longDurationThresholdMs?: number; // default: 10_000
}

/**
 * Filters a stream of session events through salience heuristics.
 * Returns only events that trigger at least one heuristic.
 * Events are returned in original order with salience metadata attached.
 */
export function filterForSalience(
  events: ObserverEvent[],
  context: SalienceContext,
): Highlight[];
```

The function:
1. Initialises a `Set<string>` for novel tool tracking
2. Iterates events in order
3. Runs each event through all four heuristics
4. If any heuristic triggers, creates a `Highlight` with combined score (additive, capped at 1.0)
5. Returns the highlights array (subset of events, now annotated)

### 3.4 Integrate with session-end hook

Modify `src/s2/session-end-hook.ts` to:

1. After reading session events, call `filterForSalience(events, context)` to get highlights
2. Use highlights to enrich the `SessionRecord.summary` field:
   - Start with the existing mechanical summary (event counts, tool frequency)
   - Append highlight information: "Highlights: {count}. {top highlights by salience score}"
   - Example: "11 events; tools: Read(3), Edit(2). Highlights: 2. Error in Bash (exit 1). Novel tool: WebSearch."
3. Optionally store the full highlights array in a new `highlights` field on `SessionRecord` for downstream consumers (step 3+ may use this)

The existing mechanical summary generation remains — highlights *enrich* it, they don't replace it.

### 3.5 Load motif context for filter

The session-end hook needs active motifs to run the motif-touch heuristic. Reuse `readActiveMotifs()` from `src/s2/context-hydration.ts` — it already reads from `02-Knowledge/motifs/`. Import it directly; no new infrastructure needed.

---

## 4. Key Decisions

### Why a separate file, not inline in session-end-hook

The salience filter is a reusable component. The session-end hook is one consumer. Future consumers include: the fast loop (step 6) processing events in batch, real-time salience scoring if Observer moves to streaming, and any dashboard that wants to show session highlights. Keeping it in its own module (`salience-filter.ts`) enables reuse without coupling to the hook lifecycle.

### Why heuristics, not ML/NLP

Session 3: "Not NLP. Simple heuristics." The system has zero training data for what constitutes a "significant" event. Building an NLP classifier would require labelled data that doesn't exist and would add inference latency to session-end processing. Heuristics are deterministic, fast, transparent (each highlight says *why* it was flagged), and improvable through iteration. If the heuristics prove insufficient after 50+ sessions of data, ML can be considered — but only with real data to train on.

### Why salience scores, not boolean significant/not-significant

A score between 0.0 and 1.0 allows downstream consumers to set their own thresholds. The session-end summary might show the top 3 highlights by score. The fast loop (step 6) might only care about score > 0.7. A boolean would force a single threshold decision at filter time that may not suit all consumers.

### Why the adapter stays unmodified

Session 3: "The adapter stays dumb. A thin layer above it gets selective." The S1 adapter's job is faithful translation of CLI events to Observer events. Salience is a judgement — it requires context (motifs, session history) that the adapter shouldn't know about. Keeping salience in S2 preserves the clean S1/S2 boundary: S1 translates, S2 interprets.

### Why common tools get reduced novelty

Read, Grep, Glob, Edit, Write, and Bash appear in virtually every session. Flagging them as "novel" on first use would create noise. Either exclude them from novelty detection entirely or give them a reduced novelty score (e.g., 0.05 instead of 0.2). The specific list of "common tools" can be a configurable constant.

---

## 5. Acceptance Test

**The differential attention test:**

1. Create a session with mixed events: some routine Reads, one error (Bash exit code 1), one novel tool (WebSearch), and one file touching an active motif topic
2. Run `filterForSalience()` on the event stream
3. Verify: the error, the novel tool, and the motif-touch are highlighted; routine Reads are not
4. Verify: the session-end summary includes highlight information beyond the mechanical event counts

**Pass condition:** The session summary for a session with interesting events is meaningfully different from a session with only routine events. The system notices when something noteworthy happened. That's perception.

---

## PLAN

### Approach

The salience filter is a pure function module with no side effects — it takes events and context in, returns highlights out. This makes it fully testable in isolation.

**Implementation order:**
1. Define types (`Highlight`, `SalienceTrigger`, `SalienceContext`) — no dependencies
2. Implement four heuristic functions — each pure, each testable independently
3. Implement `filterForSalience()` — orchestrates heuristics, computes composite scores
4. Integrate into session-end hook — call filter, enrich summary
5. Verify end-to-end: session with mixed events produces differential summaries

**Technical decisions:**
- File: `src/s2/salience-filter.ts` (new file)
- Exports added to `src/s2/index.ts`
- Motif context loaded via existing `readActiveMotifs()` from context-hydration
- No new dependencies — pure TypeScript, no external packages
- Session-end hook modification is surgical: add filter call, enrich summary string

**Task breakdown:**
- Types + heuristics: independent, can be built in parallel
- Filter function: depends on heuristics
- Hook integration: depends on filter function
- Verification: depends on hook integration

---

## IDEAL STATE CRITERIA

- [x] ISC-C1: Highlight interface defined with event salience and triggers | Verify: Grep: `interface Highlight` in salience-filter.ts
- [x] ISC-C2: SalienceTrigger union covers motif error novel duration types | Verify: Read: SalienceTrigger type in salience-filter.ts
- [x] ISC-C3: Motif-touch heuristic compares events against active motif entries | Verify: Grep: `motif_touch` in salience-filter.ts
- [x] ISC-C4: Error-and-failure heuristic detects errors in PostToolUse results | Verify: Grep: `error_or_failure` in salience-filter.ts
- [x] ISC-C5: Novel-tool heuristic tracks first tool appearances per session | Verify: Grep: `novel_tool` in salience-filter.ts
- [x] ISC-C6: Long-duration heuristic detects slow PreToolUse PostToolUse pairs | Verify: Grep: `long_duration` in salience-filter.ts
- [x] ISC-C7: filterForSalience function returns highlights from event array | Verify: Grep: `function filterForSalience` in salience-filter.ts
- [x] ISC-C8: Session-end hook calls filterForSalience and enriches summary | Verify: Grep: `filterForSalience` in session-end-hook.ts
- [x] ISC-C9: Highlight and SalienceTrigger exported from s2 index module | Verify: Grep: `Highlight` in s2/index.ts
- [x] ISC-C10: Common tools excluded or reduced in novel tool detection | Verify: Read: common tool list constant in salience-filter.ts
- [x] ISC-C11: Salience scores are additive and capped at one point zero | Verify: Read: score computation in filterForSalience
- [x] ISC-C12: Active motifs loaded via existing readActiveMotifs function | Verify: Grep: `readActiveMotifs` import in session-end-hook.ts or salience-filter.ts

- [x] ISC-A1: S1 adapter code remains completely unmodified | Verify: CLI: git diff src/s1/adapter.ts shows no changes
- [x] ISC-A2: No NLP or LLM inference calls in salience heuristics | Verify: Grep: absence of `anthropic` or `inference` imports in salience-filter.ts
- [x] ISC-A3: No new external dependencies added for salience scoring | Verify: Read: no new entries in package.json

## DECISIONS

- 2026-03-08: `readActiveMotifs()` promoted from private to exported in context-hydration.ts to enable reuse by salience filter and session-end hook.
- 2026-03-08: Long-duration heuristic uses `durationMs` field on PostToolUse when available, falls back to timestamp differencing for pre/post pairs.
- 2026-03-08: `formatHighlightSummary()` extracted as a separate export for reuse by future consumers (fast loop, dashboard).

## LOG

### Iteration 1 — 2026-03-08
- Phase reached: VERIFY
- Criteria progress: 15/15
- Work done: Created salience-filter.ts with Highlight type, 4 heuristics, filterForSalience. Integrated into session-end-hook. Exported from s2/index. All type-checks clean.
- Failing: none
- Context for next iteration: N/A — complete. Step 3 (motif library priming) is the next build order item.
