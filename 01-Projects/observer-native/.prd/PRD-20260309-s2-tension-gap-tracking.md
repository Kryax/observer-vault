---
prd: true
id: PRD-20260309-s2-tension-gap-tracking
status: DRAFT
mode: interactive
effort_level: Standard
created: 2026-03-09
updated: 2026-03-09
iteration: 0
maxIterations: 128
loopStatus: null
last_phase: null
failing_criteria: []
verification_summary: "0/15"
parent: null
children: []
language: TypeScript
runtime: Bun
---

# S2 Tension/Gap Tracking — Living Backlog from Accumulated Session Tensions

> Track tensions across sessions — accumulate them in a persistent backlog, increment sessionCount on recurrence, and surface the living backlog at session start. Tensions are the bridge between reflection and action: named, tracked, unresolved problems that drive PRD generation.

**Status:** DRAFT — requires Adam's approval before any build begins.

**Source:** D/I/R Session 3 architectural synthesis, build order step 5. "Once sessions produce tensions and the episodic loop carries them forward, a living backlog document (or structured JSONL) accumulates unresolved tensions. This is the input to eventual PRD generation."

**Depends on:** Step 1 complete (PRD-20260308-s2-episodic-memory-loop, 11/12 ISC). Step 2 complete (PRD-20260308-s2-salience-filter, 15/15 ISC). Step 3 complete (PRD-20260309-s2-motif-library-priming, 14/14 ISC).

---

## STATUS

| What | State |
|------|-------|
| Progress | 0/15 criteria passing |
| Phase | DRAFT |
| Next action | Adam reviews and approves |
| Blocked by | Adam's approval |

---

## 1. Problem Space

The `TensionGap` type already exists in `src/s2/session-capture.ts`:

```typescript
export interface TensionGap {
  id: string;
  description: string;
  firstSeen: string;
  sessionCount: number;
  relatedMotifs?: string[];
  status: "open" | "resolved";
}
```

And `SessionRecord` already has an optional `tensions?: TensionGap[]` field. But the session-end hook currently writes `tensions: undefined` — no tensions are ever surfaced, accumulated, or tracked. The type is a hypothesis that has never been tested.

Session 3's coupling map shows tensions on the right spine:

```
session → tension detect → Tension/Gap → track → Build Backlog → PRD → Adam approves
```

The left spine (episodic memory loop, steps 1-3) is operational. The right spine is entirely unwired. Step 5 wires the first two connections: detecting tensions during session-end processing, and accumulating them in a persistent backlog that carries across sessions.

### What exists (inputs to this PRD)

| Component | Location | Status |
|-----------|----------|--------|
| `TensionGap` type | `src/s2/session-capture.ts:61` | Defined, never instantiated |
| `SessionRecord.tensions` field | `src/s2/session-capture.ts:27` | Optional, always `undefined` |
| Session-end hook | `src/s2/session-end-hook.ts` | Working, writes SessionRecord with tensions=undefined |
| Session-start hook | `src/s2/session-start-hook.ts:35-41` | Reads tensions from prior sessions, formats as priming text |
| Motif priming | `src/s2/motif-priming.ts:109-130` | Uses open tensions for relevance scoring |
| Salience highlights | `src/s2/salience-filter.ts` | Provides event highlights (motif touches, errors, novel events) |
| `sessions.jsonl` | `03-Daily/{date}/sessions.jsonl` | Per-day session records |

### What doesn't exist (outputs of this PRD)

| Component | Purpose |
|-----------|---------|
| Tension detection at session-end | Extract candidate tensions from session events and highlights |
| Tension backlog file | Persistent JSONL storing all accumulated tensions across sessions |
| Tension accumulation logic | Merge new tensions with existing backlog: deduplicate by id, increment sessionCount on recurrence |
| Tension backlog reader at session-start | Load open tensions from backlog for priming context and motif scoring |
| Tension resolution marking | Mechanism to mark tensions as resolved when addressed |

---

## 2. Scope Boundary

This PRD covers **only** tension/gap tracking (build order step 5). It does NOT cover:

- Episodic memory loop (step 1 — COMPLETE)
- Salience filter (step 2 — COMPLETE)
- Motif library priming (step 3 — COMPLETE)
- Scraper FTS5 fix (step 4 — separate PRD)
- Cron-scheduled fast loop / circular engine (step 6 — separate PRD)
- Automated PRD generation from tensions (future — tensions are *input to* PRDs, this step doesn't auto-generate PRDs)
- Candidate direction objects (deferred per Session 3)

---

## 3. Design

### 3.1 Tension detection — what generates tensions

Tensions are unresolved problems that surface during a session. For the initial implementation, three sources:

**Source 1: Salience highlights.** The salience filter (step 2) already marks events as highlights for specific reasons: motif touches, errors/failures, novel tool usage, long-duration operations. Recurring error patterns and unresolved failures across events within a single session are tension candidates. Detection heuristic: if the same error class appears 2+ times in highlights, or if a task was attempted but not completed (ISC criteria failing at session end), generate a tension.

**Source 2: Explicit session-end tensions.** The session-end hook constructs a `SessionRecord`. During construction, it can inspect `iscOutcomes` for failing criteria — these represent known gaps where the session didn't achieve its goals. Each failing ISC outcome is a candidate tension.

**Source 3: Motif-surfaced gaps.** If the motif priming system (step 3) surfaced motifs that the session then never engaged with (primed but not touched in highlights), this is a weaker signal but still worth tracking as a potential gap.

For the first implementation, focus on **Source 2 only** (failing ISC outcomes). This is the most reliable signal — it's deterministic, already structured, and directly maps to "things the system tried to do but didn't finish." Sources 1 and 3 can be added as the system learns what tensions are actually useful.

### 3.2 Tension backlog — persistent storage

A single JSONL file at `01-Projects/observer-native/tensions.jsonl` (project-level, not per-day). Each line is a `TensionGap` object. This is the living backlog.

**Why project-level, not per-day:** Tensions span sessions and days. A per-day file would require cross-day scanning to build the full backlog. A single project-level file is the simplest structure that supports accumulation.

**Why JSONL, not markdown:** Tensions need programmatic read/write (accumulation, deduplication, recurrence counting). JSONL is what sessions.jsonl uses. Markdown would require parsing structure. Consistency with existing patterns.

### 3.3 Tension accumulation — merge logic

At session-end, after detecting new tensions:

1. **Read** existing backlog from `tensions.jsonl`
2. **Match** each new tension against existing ones by normalized description similarity (exact match on lowercased, whitespace-normalized description for v1 — fuzzy matching deferred)
3. **If match found:** increment `sessionCount`, update `relatedMotifs` union, keep original `firstSeen`
4. **If no match:** append as new entry with `sessionCount: 1`, `firstSeen: now`, `status: "open"`
5. **Write** the full updated backlog back to `tensions.jsonl`

The `id` field for new tensions: `tension-{timestamp}-{index}` where timestamp is ISO date and index is sequential within the session.

### 3.4 Tension ID generation

Tension IDs use the format `t-{YYYYMMDD}-{NNN}` where NNN is a zero-padded sequential number within that day. Example: `t-20260309-001`. On recurrence match, the original ID is preserved — the tension keeps its identity across sessions.

### 3.5 Session-start backlog loading

The session-start hook already reads tensions from recent sessions (lines 35-41, 73-76 in `session-start-hook.ts`). This step adds a second source: the tension backlog file. The backlog is the authoritative source for all open tensions — it's the accumulated, deduplicated view.

Modify `hydrateContext()` in `context-hydration.ts` to also read `tensions.jsonl` and include the open tensions in `HydratedContext`. The session-start hook then surfaces the top tensions (by sessionCount descending — most recurrent = most important) in priming context.

### 3.6 Tension resolution

A tension is marked `"resolved"` when:
- An ISC criterion that generated the tension now passes in a subsequent session
- Manual resolution (Adam marks it resolved — future mechanism, not in this PRD)

For the first implementation: automatic resolution by ISC match. If a tension's description matches a now-passing ISC criterion description (exact match), mark it resolved. This is conservative — it won't catch all resolutions, but it won't produce false positives.

### 3.7 Integration with existing consumers

Two existing consumers already expect tensions:

1. **Session-start hook** (`session-start-hook.ts:35-41`): Formats open tensions from recent sessions into priming text. This continues to work but now has richer data from the accumulated backlog.

2. **Motif priming** (`motif-priming.ts:109-130`): Uses open tensions for keyword-based relevance scoring. Now draws from the backlog's accumulated tensions instead of just recent session records, producing more stable motif relevance scores.

### 3.8 Backlog surfacing format

In session-start priming context, tensions appear as:

```
Open tensions (3):
  [t-20260308-001] Session capture produces no summary when events < 5 (seen 4x)
  [t-20260309-002] Motif priming relevance scores cluster near zero (seen 2x)
  [t-20260309-003] Salience filter marks too many events as highlights (seen 1x)
```

Sorted by sessionCount descending. Capped at 5 tensions to respect context budget. The ID allows referencing specific tensions in conversation.

---

## 4. Work Items

### 4.1 Implement tension detection from failing ISC outcomes

In the session-end hook, after constructing `iscOutcomes`, identify failing criteria and convert each to a `TensionGap` with the criterion description as the tension description.

### 4.2 Implement tension backlog read/write

Functions to read `tensions.jsonl` into `TensionGap[]` and write `TensionGap[]` back. Handle missing file (empty backlog on first run). Location: new file `src/s2/tension-tracker.ts`.

### 4.3 Implement tension accumulation/merge logic

Given new session tensions and existing backlog: deduplicate by description match, increment sessionCount on recurrence, preserve original firstSeen and id, union relatedMotifs. Return updated backlog.

### 4.4 Implement tension resolution by ISC match

After accumulation, check if any open tensions match now-passing ISC criteria. Mark matched tensions as `"resolved"`.

### 4.5 Wire session-end hook to detect, accumulate, and write tensions

After `captureSession()` writes the session record, call the tension tracker to: detect new tensions → read backlog → accumulate → resolve → write backlog. Also set `tensions` field on `SessionRecord` to the tensions surfaced this session.

### 4.6 Wire session-start to load tension backlog

Modify `hydrateContext()` to read `tensions.jsonl` and include open tensions in `HydratedContext`. Modify session-start hook to format top tensions from backlog in priming context.

### 4.7 Export new types and functions from s2/index.ts

Add `tension-tracker.ts` exports to the S2 public API.

---

## 5. Key Decisions

### Why failing ISC outcomes as the first tension source

Failing ISC outcomes are the most reliable, structured, and deterministic signal available. They directly represent "things the system tried to accomplish but didn't." Other sources (highlight patterns, unengaged motifs) are more speculative and can be added once the basic pipeline proves the concept.

### Why a single project-level JSONL file

Per-day files would require cross-day scanning, adding complexity. The tension backlog is small (dozens to low hundreds of entries) and logically represents a single evolving view of unresolved problems. A single file with full rewrite on update is simple and correct at this scale.

### Why exact description match for deduplication (not fuzzy)

Fuzzy matching requires choosing a similarity threshold with no calibration data. Exact match (after normalization) is conservative — it may under-deduplicate (creating near-duplicate tensions) but won't incorrectly merge distinct tensions. Fuzzy matching can be added once the backlog accumulates enough data to reveal duplicates that exact match misses.

### Why automatic resolution is limited to ISC match

False-positive resolution (marking a tension as resolved when it isn't) is worse than false-negative (keeping a resolved tension as open). ISC match is narrow and reliable. A tension generated from "ISC-C5 failed" can be confidently resolved when ISC-C5 passes in a later session. Broader resolution heuristics need more data to calibrate.

### Why cap at 5 tensions in session-start priming

Same budget reasoning as motif priming. The 2KB context budget is shared across session summaries, motif priming, and tension surfacing. 5 tensions at ~80 chars each = ~400 chars. Combined with 5 primed motifs (~750 chars), this leaves room for 2-3 session summaries.

---

## 6. Acceptance Test

**The accumulation test:**

1. Run a session that produces failing ISC criteria
2. Verify: `tensions.jsonl` is created with tension entries derived from the failures
3. Run another session that fails on the same criteria
4. Verify: the existing tension's `sessionCount` incremented to 2, original `firstSeen` preserved

**The resolution test:**

5. Run a session where a previously-failing ISC criterion now passes
6. Verify: the corresponding tension is marked `status: "resolved"`

**The surfacing test:**

7. Start a session with accumulated tensions in the backlog
8. Verify: session-start priming context shows open tensions sorted by recurrence count
9. Verify: motif priming uses backlog tensions for relevance scoring

**The cold start test:**

10. Start a session with no `tensions.jsonl` file
11. Verify: no error, empty tension list, system proceeds normally

**Pass condition:** Tensions accumulate across sessions, recurrence is tracked, resolved tensions are marked, and the living backlog surfaces in priming context. The right spine of the coupling map has its first two connections wired.

---

## PLAN

### Approach

Tension tracking is a pipeline: detect → read backlog → accumulate → resolve → write backlog → surface. The core logic is a pure function module (`tension-tracker.ts`), wired into the session-end hook for writes and context-hydration for reads.

**Implementation order:**
1. Define tension tracker module with read/write for `tensions.jsonl`
2. Implement detection: failing ISC outcomes → `TensionGap[]`
3. Implement accumulation: merge new tensions with existing backlog
4. Implement resolution: check passing ISC against open tensions
5. Wire session-end hook: detect + accumulate + resolve + write
6. Wire session-start: load backlog into `HydratedContext`, format in priming
7. Export from `src/s2/index.ts`
8. Verify end-to-end: tensions accumulate, recur, resolve, surface

**Technical decisions:**
- File: `src/s2/tension-tracker.ts` (new file)
- Backlog location: `01-Projects/observer-native/tensions.jsonl`
- Exports added to `src/s2/index.ts`
- No new external dependencies
- Session-end hook modification: ~20 lines after `captureSession()` call
- Context-hydration modification: read backlog file, add to `HydratedContext`
- Session-start-hook modification: format backlog tensions in priming output

**Task breakdown:**
- Tracker module (read/write/accumulate/resolve): independent, can be done first
- Detection logic: independent of tracker (needs ISCOutcome type only)
- Session-end wiring: depends on tracker + detection
- Session-start wiring: depends on tracker (read only)
- Verification: depends on both wirings

---

## IDEAL STATE CRITERIA

### Core Functionality

- [ ] ISC-C1: Tension tracker module exists at src/s2/tension-tracker.ts | Verify: Glob: `src/s2/tension-tracker.ts`
- [ ] ISC-C2: Failing ISC outcomes converted to TensionGap objects at session-end | Verify: Read: detection function in tension-tracker.ts takes ISCOutcome[]
- [ ] ISC-C3: Tension backlog persisted as JSONL at tensions.jsonl project-level | Verify: Read: read/write functions target `tensions.jsonl`
- [ ] ISC-C4: New tensions appended with sessionCount one and current firstSeen date | Verify: Read: new tension construction sets sessionCount=1
- [ ] ISC-C5: Recurring tensions increment sessionCount preserving original firstSeen and id | Verify: Read: accumulation logic matches by description and increments
- [ ] ISC-C6: Tension deduplication uses normalized exact description match | Verify: Read: normalization (lowercase, whitespace) before comparison
- [ ] ISC-C7: Resolved tensions marked status resolved when matching ISC passes | Verify: Read: resolution function checks passing outcomes against open tensions
- [ ] ISC-C8: Tension backlog loaded into HydratedContext at session start | Verify: Grep: `tensions` field read from backlog in context-hydration.ts
- [ ] ISC-C9: Session-start priming shows top five open tensions by recurrence count | Verify: Read: formatting function sorts by sessionCount, caps at 5
- [ ] ISC-C10: Tension IDs use t-YYYYMMDD-NNN sequential format | Verify: Grep: `t-` ID pattern in tension-tracker.ts

### Integration

- [ ] ISC-C11: Session-end hook calls tension tracker after captureSession write | Verify: Read: session-end-hook.ts calls detect+accumulate+write
- [ ] ISC-C12: SessionRecord.tensions field populated with session's detected tensions | Verify: Read: tensions set on record before captureSession call or after detection
- [ ] ISC-C13: Missing tensions.jsonl handled gracefully as empty backlog on first run | Verify: Read: file-not-found produces empty array, no error

### Anti-Criteria

- [ ] ISC-A1: No NLP or LLM inference calls in tension detection or matching | Verify: Grep: absence of `anthropic` or `inference` imports in tension-tracker.ts
- [ ] ISC-A2: No new external dependencies added for tension tracking | Verify: Read: no new entries in package.json

## DECISIONS

*None yet — PRD is DRAFT.*

## LOG

*No iterations yet.*
