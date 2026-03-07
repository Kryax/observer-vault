---
prd: true
id: PRD-20260308-s2-episodic-memory-loop
status: COMPLETE
mode: interactive
effort_level: Extended
created: 2026-03-08
updated: 2026-03-08
iteration: 1
maxIterations: 128
loopStatus: completed
last_phase: VERIFY
failing_criteria: [ISC-C7]
verification_summary: "11/12"
parent: null
children: []
language: TypeScript
runtime: Bun
---

# S2 Episodic Memory Loop Wiring

> Close the episodic memory loop so that sessions write records and future sessions load them as context. The system remembers what happened last time.

**Status:** DRAFT -- requires Adam's approval before any build begins.

**Source:** D/I/R Session 3 architectural synthesis, "What should the first PRD contain?" section. This PRD implements step 1 of the confirmed build order (episodic memory loop).

**Depends on:** Session 1 (DIR-framework-exploration-session1.md), Session 2 (DIR-observer-inward-review-session2.md), Session 3 (DIR-architectural-synthesis-session3.md)

---

## STATUS

| What | State |
|------|-------|
| Progress | 11/12 criteria passing |
| Phase | VERIFY complete |
| Next action | Adam runs acceptance test (ISC-C7) |
| Blocked by | Manual loop closure test |

---

## 1. Problem Space

The S2 layer has types and functions for session capture (`SessionRecord`, `captureSession()`) and context hydration (`HydratedContext`, `hydrateContext()`). Neither is wired to anything. The system produces session events (S1 adapter writes to `events.ndjson`) but never constructs a structured session record from them. The system can read prior sessions but nothing invokes the reader at startup.

Session 2 identified this as "the perception gap and the retrieval gap" -- sensation without meaning, memory without recall. Session 3 confirmed this is the first coupling to wire because episodic memory is the foundation that makes all other memory types operational.

The types are a hypothesis. Wiring them is the experiment. This PRD scopes the minimum work to close the loop.

### What exists (inputs to this PRD)

| Component | Location | Status |
|-----------|----------|--------|
| `SessionRecord` interface | `src/s2/session-capture.ts:17` | Exists, needs `tensions` field |
| `ReflectSeed` interface | `src/s2/session-capture.ts:43` | Exists, needs nullable fields |
| `MotifCandidate` interface | `src/s2/session-capture.ts:58` | Exists, unchanged |
| `captureSession()` function | `src/s2/session-capture.ts:82` | Exists, unwired |
| `hydrateContext()` function | `src/s2/context-hydration.ts:61` | Exists, unwired |
| `readRecentSessions()` | `src/s2/context-hydration.ts:101` | Exists, reads `03-Daily/` |
| `extractPriorReflectOutput()` | `src/s2/context-hydration.ts:161` | Exists, finds last ReflectSeed |
| S1 adapter | `src/s1/` | Running, writes `events.ndjson` |
| Vault writer | `src/s2/vault-writer.ts` | Working, `vaultAppend()` used by `captureSession()` |

### What doesn't exist (outputs of this PRD)

| Component | Purpose |
|-----------|---------|
| `TensionGap` type | First-class tension/gap object -- the fuel for the generative engine |
| `tensions` field on `SessionRecord` | Carries surfaced tensions forward across sessions |
| Session-end hook script | Constructs `SessionRecord` from session events, calls `captureSession()` |
| Session-start hook script | Calls `hydrateContext()`, formats output as priming context |
| Nullable `ReflectSeed` fields | `independenceScore` and `axisBalanceReport` become `| null` |

---

## 2. Scope Boundary

This PRD covers **only** the episodic memory loop (build order step 1). It does NOT cover:

- Salience filter / highlight layer (step 2 -- separate PRD)
- Motif library priming at session start (step 3 -- separate PRD)
- Scraper FTS5 fix or scraper-to-motif pipeline (step 4 -- separate PRD)
- Tension/gap tracking backlog (step 5 -- separate PRD)
- Cron-scheduled fast loop / circular engine (step 6 -- separate PRD)

---

## 3. Work Items

### 3.1 Define TensionGap type

Add to `src/s2/session-capture.ts`:

```typescript
export interface TensionGap {
  id: string;
  description: string;
  firstSeen: string;       // ISO timestamp
  sessionCount: number;    // how many sessions have surfaced this tension
  relatedMotifs?: string[]; // motif names from the library, if applicable
  status: 'open' | 'resolved';
}
```

Export from `src/s2/index.ts`.

### 3.2 Add tensions field to SessionRecord

```typescript
export interface SessionRecord {
  sessionId: string;
  startedAt: string;
  endedAt: string;
  workingDirectory: string;
  exitReason: "user_exit" | "timeout" | "error" | "completed";
  summary?: string;
  iscOutcomes: ISCOutcome[];
  reflectOutput?: ReflectSeed;
  motifCandidates?: MotifCandidate[];
  tensions?: TensionGap[];  // NEW: surfaced tensions/gaps from this session
}
```

The field is optional because early sessions may not surface tensions.

### 3.3 Make ReflectSeed fields nullable

Session 3 directive: "populate newLenses and shiftedAssumptions as optional free-text, leave independenceScore and axisBalanceReport as null until real data informs them."

```typescript
export interface ReflectSeed {
  transferFunctionSummary: string;
  independenceScore: number | null;      // null until real data informs meaning
  axisBalanceReport: {
    differentiate: number;
    integrate: number;
    recurse: number;
  } | null;                               // null until real data informs meaning
  newLenses?: string[];                   // optional free-text initially
  shiftedAssumptions?: string[];          // optional free-text initially
}
```

The types were designed before any real reflection was captured. Making numeric fields nullable lets the system start producing ReflectSeeds without fabricating measurements. Session 3: "The type is a hypothesis; running it is the experiment."

### 3.4 Wire session-end hook

Create a session-end hook script (entry point TBD based on observer-native's hook adapter pattern) that:

1. Reads the current session's `events.ndjson` entries written since session start
2. Constructs a `SessionRecord`:
   - `sessionId`: generated or pulled from session context
   - `startedAt` / `endedAt`: from first/last event timestamps
   - `workingDirectory`: from event context or `process.cwd()`
   - `exitReason`: mapped from the hook trigger context
   - `summary`: brief auto-generated summary of session activity (event counts by type, key actions)
   - `iscOutcomes`: extracted via `extractISCOutcomes()` if ISC criteria exist in the session
   - `reflectOutput`: `undefined` initially (no automated reflection yet -- this is the honest state)
   - `motifCandidates`: `undefined` initially
   - `tensions`: `undefined` initially (tensions surface through deliberate work, not automation)
3. Calls `captureSession(record)` which writes to `03-Daily/{date}/sessions.jsonl`

The hook must handle the case where `events.ndjson` is empty or the session was trivial (e.g., user opened and immediately closed). In trivial cases, either skip the write or write a minimal record.

### 3.5 Wire session-start loader

Create a session-start hook script that:

1. Calls `hydrateContext(projectRoot)` to get recent sessions, motifs, framework deltas, and prior ReflectSeed
2. Formats the `HydratedContext` as concise priming text:
   - For each recent session: "Session {date}: {summary}. Tensions: {list}. Lenses: {list}."
   - Prior ReflectSeed: "Last reflect suggested: {transferFunctionSummary}"
   - Keep total output under the 10% context init budget (aggressive summarization)
3. Outputs the formatted context so it appears in the session's initial context

The existing `hydrateContext()` already reads from `03-Daily/`, loads motifs, and extracts prior ReflectSeed. The work here is: (a) calling it from a hook, and (b) formatting its output as human-readable priming text rather than raw JSON.

---

## 4. Key Decisions

### Why optional tensions field (not required)

Early sessions won't have automated tension detection. Tensions surface through deliberate D/I/R work, not through event processing. Making the field required would force fabrication of tension data. The field exists so that when Atlas or Adam identify a tension during a session, it has a place to go. Automation comes later (build order step 5).

### Why ReflectSeed stays mostly empty

Session 3: "Don't populate independence score and axis balance report until real sessions reveal what those measurements actually look like." The fields exist as architectural commitments about what reflection should eventually measure. Populating them prematurely would train the system on fabricated data. Null is the honest state.

### Why hydrateContext() is reused, not rebuilt

The function already exists and already reads sessions, motifs, framework deltas, and prior ReflectSeed. The only missing piece is a caller (the session-start hook) and a formatter (turning HydratedContext into priming text). Don't rebuild what works.

### Why the summary field is auto-generated, not AI-generated

The session-end hook should produce a mechanical summary (event counts, key file paths touched, ISC progress) rather than an LLM-generated narrative. Mechanical summaries are deterministic, fast, and honest. LLM summaries would require an inference call at session-end, adding latency and complexity. If richer summaries prove valuable, they can be added later.

---

## 5. Acceptance Test

**The loop closure test:**

1. Start a session in the observer-native project
2. Do some work (the session-end hook fires, `captureSession()` writes to `03-Daily/{date}/sessions.jsonl`)
3. End the session
4. Start a new session in the same project
5. The session-start hook fires, `hydrateContext()` reads the record from step 2, and the formatted context appears in the new session

**Pass condition:** The new session's priming context includes information from the previous session. The system remembers what happened last time. That's the test. Not whether the types are perfect -- whether the loop closes.

---

## IDEAL STATE CRITERIA

- [x] ISC-C1: SessionRecord interface includes tensions TensionGap array field | Verify: Grep: `tensions.*TensionGap` in session-capture.ts
- [x] ISC-C2: TensionGap type has id description firstSeen sessionCount status fields | Verify: Read: TensionGap interface in session-capture.ts
- [x] ISC-C3: Session-end hook constructs SessionRecord and calls captureSession | Verify: Grep: `captureSession` invocation in hook script
- [x] ISC-C4: Session-start loader reads recent SessionRecords formats priming context | Verify: Grep: `hydrateContext` invocation in hook script
- [x] ISC-C5: ReflectSeed newLenses shiftedAssumptions specified as optional free-text | Verify: Read: ReflectSeed interface shows optional arrays
- [x] ISC-C6: ReflectSeed independenceScore axisBalanceReport are nullable types | Verify: Grep: `number \| null` in ReflectSeed
- [ ] ISC-C7: Loop closure acceptance test passes end to end | Verify: Custom: run the acceptance test manually
- [x] ISC-C8: TensionGap exported from s2 index module | Verify: Grep: `TensionGap` in s2/index.ts
- [x] ISC-C9: Session-end hook handles trivial or empty sessions gracefully | Verify: Read: conditional logic in hook script
- [x] ISC-C10: Session-start context stays within 10 percent context budget | Verify: Read: summarization/truncation logic in formatter

- [x] ISC-A1: PRD scope excludes salience filter motif priming scraper cron | Verify: Grep: absence of salience/FTS5/cron in ISC
- [x] ISC-A2: No modifications to PAI files or settings.json without approval | Verify: CLI: git diff --name-only

## DECISIONS

- 2026-03-08: Session-end hook lives at `src/s2/session-end-hook.ts` (not s1) because it operates on S2 types. The S1 adapter remains pure translation.
- 2026-03-08: Trivial session threshold set to 2 events. Sessions with < 2 events are skipped entirely.
- 2026-03-08: Context budget set to 2000 chars (~10% of typical initial context). Hard truncation with ellipsis.
- 2026-03-08: FrameworkDelta summary uses `transferFunctionSummary` field (no `description` field exists).

## LOG

### Iteration 1 — 2026-03-08
- Phase reached: VERIFY
- Criteria progress: 11/12
- Work done: All 5 work items implemented across 3 commits (types, session-end hook, session-start hook). Type-checks clean.
- Failing: ISC-C7 (loop closure acceptance test — requires manual run by Adam)
- Context for next iteration: Register hooks in settings.json (requires Adam's approval per PAI safety boundary). Then run the acceptance test: start session → do work → end session → start new session → verify priming context appears.
