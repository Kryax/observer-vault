---
prd: true
id: PRD-20260309-observer-native-pai-replacement
status: VERIFYING
mode: interactive
effort_level: Advanced
created: 2026-03-09
updated: 2026-03-09
iteration: 1
maxIterations: 128
loopStatus: null
last_phase: BUILD
failing_criteria: []
verification_summary: "54/54"
parent: null
children: []
language: TypeScript
runtime: Bun
---

# Observer-Native PAI Replacement — Five Parallel Slices

> Replace PAI operational dependencies with Observer-native implementations that express D/I/R, not PAI's Algorithm patterns. Five independent slices: stop orchestrator, dual-speed ISC, PRD reader, identity profile, and living backlog.

**Status:** VERIFYING — all slices built, verification in progress.

---

## STATUS

| What | State |
|------|-------|
| Progress | 54/54 criteria passing |
| Phase | VERIFY |
| Next action | Adam reviews builds |
| Blocked by | Nothing |

---

## CONTEXT

### Problem Space

Observer-native has its own S1 adapter, S2 session hooks, and S0 schemas — but still depends on PAI for session stop orchestration, ISC evaluation, and PRD loading. Three PAI components need Observer-native replacements (informed by PAI's code, not copying it). Two fresh components need building from scratch: an identity profile capturing Adam's cognitive style, and a living backlog at the project level.

### Coexistence Constraint

PAI continues running. Observer-native hooks run alongside PAI hooks in settings.json (Stop event already has both PAI's StopOrchestrator and Observer-native's session-end-hook registered). The Observer-native stop orchestrator coordinates Observer's own handlers — it does not replace PAI's StopOrchestrator.

### Key Files

| File | Role |
|------|------|
| `src/s1/adapter.ts` | S1 hook adapter — translates Claude Code events to Observer events |
| `src/s2/session-end-hook.ts` | S2 session-end — captures session records, runs salience + tension tracking |
| `src/s2/tension-tracker.ts` | Tension/gap tracker — persistent JSONL backlog at project level |
| `src/s0/isc.ts` | ISC schema — types for criteria, verification methods, priorities |
| `src/s0/prd.ts` | PRD schema — types for PRD structure, slices, log entries |
| `~/.claude-v3/hooks/StopOrchestrator.hook.ts` | PAI reference — orchestrator pattern with Promise.allSettled delegation |
| `02-Knowledge/architecture/Theory_To_Architecture_20260305.md` | D/I/R design principles |
| `00-Inbox/atlas-full-handoff 070326.md` | D/I/R/G framework, cognitive style source |

### Constraints

- No PAI imports. No dependencies on `~/.claude-v3/`.
- PAI safety boundary: never write to `~/.claude/` or `~/.claude-v3/`.
- Observer-native code lives in `01-Projects/observer-native/src/`.
- All hooks fail-silent — errors never propagate to the CLI.
- Existing S0 schemas (isc.ts, prd.ts) are the type authority. Extend, don't replace.

### Decisions Made

- S2 session-end hook already registered in settings.json alongside PAI's StopOrchestrator.
- Tension tracker writes to `{WORKSPACE}/tensions.jsonl` (project-level, not per-day).
- Session records write to `03-Daily/{date}/sessions.jsonl`.
- Events stream via `tmp/events.ndjson` (NDJSON, not JSON array).

---

## PLAN

### Architecture

Five slices, all independent, all buildable in parallel. No slice depends on another slice's output.

```
Slice A: Stop Orchestrator    → src/s8/stop-orchestrator.ts + src/s8/handlers/
Slice B: ISC Dual-Speed       → src/s0/isc-evaluator.ts (extends s0/isc.ts types)
Slice C: PRD Reader           → src/s0/prd-reader.ts (reads .prd/ markdown, returns PRD type)
Slice D: Identity Profile     → 02-Knowledge/identity/cognitive-profile.md
Slice E: Living Backlog       → 01-Projects/observer-council/BACKLOG.md + session-end hook integration
```

### Slice A: Observer-Native Stop Orchestrator

**PAI Reference:** `~/.claude-v3/hooks/StopOrchestrator.hook.ts`
- PAI reads transcript once via `parseTranscript`, delegates to 5 handlers via `Promise.allSettled`
- Handlers: Voice, TabState, RebuildSkill, AlgorithmEnrichment, DocCrossRefIntegrity
- Voice gated by `isMainSession()` checking kitty-sessions file

**Observer-native design:**
- Does NOT replace PAI's StopOrchestrator — runs alongside it
- Coordinates Observer's own stop-time work: S2 session capture, salience filtering, tension tracking, event stream cleanup
- Currently session-end-hook.ts does this inline. The orchestrator extracts the coordination pattern so new handlers can be added without modifying the hook entry point.
- Express D/I/R: the orchestrator Describes (reads events), delegates to handlers that Interpret (salience, tensions), and the session record is the Recommendation (what mattered, what's unresolved).

**Implementation:**
- `src/s8/stop-orchestrator.ts` — reads stdin once, delegates to handler functions via `Promise.allSettled`
- `src/s8/handlers/session-capture.ts` — extracts from current session-end-hook.ts
- `src/s8/handlers/tension-update.ts` — extracts tension tracking from session-end-hook.ts
- `src/s8/handlers/event-cleanup.ts` — truncates events.ndjson after capture (bounded buffer)
- `src/s2/session-end-hook.ts` becomes a thin shell calling the orchestrator
- Handler interface: `(events: ObserverEvent[], context: StopContext) => Promise<void>`

### Slice B: ISC Dual-Speed Mode

**PAI Reference:** PAI's ISC logic lives in the Algorithm — every task gets the same 7-phase treatment with ISC created in OBSERVE, verified in VERIFY. No speed differentiation.

**Observer-native design:**
- Two evaluation modes for ISC criteria:
  - **Fast:** Binary pass/fail. Does the criterion hold? Yes or no. Used for routine work — bug fixes, config changes, implementation tasks with known shape.
  - **Deep:** Structural coherence check. Does the criterion hold AND does it cohere with architecture, motifs, and governance? Used when the task touches foundational concerns.
- The mode is not user-selected. It is determined by a threshold function that checks whether the task touches architecture files, motif definitions, governance documents, or sovereignty boundaries.
- Express D/I/R: Fast mode is pure Describe (state of criterion). Deep mode adds Interpret (structural coherence) and Recommend (whether the criterion should be modified given what coherence analysis reveals).

**Implementation:**
- `src/s0/isc-evaluator.ts` — exports `evaluateISC(criteria: ISC[], context: EvalContext): ISCResult[]`
- `EvalContext` includes: `touchedFiles: string[]`, `taskDescription: string`
- Threshold function: `isFoundational(context: EvalContext): boolean` — checks file paths against known architectural/governance/motif patterns
- `ISCResult` extends ISC with `mode: "fast" | "deep"`, `coherenceNotes?: string[]`
- Fast mode: runs verification command, returns pass/fail
- Deep mode: runs verification command AND checks criterion against active motifs and architectural constraints

**Foundational triggers** (any match → deep mode):
- Files in `01-Projects/observer-council/architecture/`
- Files in `02-Knowledge/motifs/` or `02-Knowledge/patterns/`
- Files matching `**/governance*`, `**/constitution*`, `**/sovereignty*`
- Files in `src/s0/` (schema layer — foundational by definition)
- Task description containing: "architecture", "governance", "motif", "sovereignty", "D/I/R", "framework"

### Slice C: Observer-Native PRD Reader

**PAI Reference:** PAI's PRD handling requires the full Algorithm ceremony — 7 phases, capability audits, effort levels. The PRD format itself (.prd/ markdown with YAML frontmatter) is good. The ceremony around it is not needed for Observer-native.

**Observer-native design:**
- Reads .prd/ markdown files and returns typed `PRD` objects (using existing s0/prd.ts schema)
- Parses YAML frontmatter → PRD metadata
- Parses ISC section → `ISC[]` array with checkbox status
- Parses LOG section → `PRDLogEntry[]`
- No Algorithm phases. No ceremony. Just: read the file, return the data.
- Express D/I/R: the reader Describes (parses). Interpretation and recommendation happen in the caller, not the reader.

**Implementation:**
- `src/s0/prd-reader.ts` — exports `readPRD(filePath: string): PRD`, `listPRDs(dir: string): PRD[]`
- YAML frontmatter parsing via simple regex (no external dependency — frontmatter is delimited by `---`)
- ISC parsing: find `## IDEAL STATE CRITERIA` or ISC-pattern lines (`- [x] ISC-` / `- [x] ISC-`), extract id, description, status, verification method
- Log parsing: find `## LOG` section, extract iteration entries
- Context parsing: find `## CONTEXT` section, extract problem space, key files, constraints
- Graceful degradation: missing sections return empty arrays/strings, not errors

### Slice D: Identity Profile

**No PAI reference.** Fresh build from D/I/R framework understanding.

**Purpose:** A cognitive style document that captures Adam's epistemological stance and thinking patterns. This is not a personality profile — it is a map of how Adam processes information, makes distinctions, and integrates knowledge. Atlas uses this to calibrate its own cognitive approach.

**Source material:**
- D/I/R/G framework (`00-Inbox/atlas-full-handoff 070326.md`)
- Theory to Architecture (`02-Knowledge/architecture/Theory_To_Architecture_20260305.md`)
- SKILL.md two-speed model and sovereignty gate
- Observer project design decisions and their reasoning patterns

**Content structure:**
1. **Epistemological stance: Surveyor** — Adam maps territory before building. Understanding the shape of the problem precedes solving it. "What is the structure here?" before "What should we do?"
2. **Fractal zoom** — Moves fluidly between abstraction levels. The same pattern at the ontological level (D/I/R as operators) appears at the architectural level (Oscillate/Converge/Reflect) and at the session level (fast/slow paths). The zoom is the method — not metaphor, structure.
3. **Observer archetype** — Consciousness-first framing. The observer is not emergent from the system — it is the precondition. This shapes how Adam thinks about agency, authority, and sovereignty in AI systems. "AI articulates, humans decide" is not a safety constraint bolted on — it is structurally implied by the framework.
4. **Oscillation pattern** — Adam's natural thinking mode oscillates between generating multiple framings and integrating them. Not brainstorming (quantity) but structural independence (quality of difference). Correlated perspectives are redundant.
5. **Long integration periods** — Integration is not instantaneous. Adam processes over days, not minutes. Sessions end with open tensions that resolve in subsequent sessions. The system must support this — not force premature convergence.
6. **Sovereignty as structural fact** — Not a preference or a safety measure. The framework implies that the observer (Adam) is the locus from which distinction is registered. Decision authority follows from this structural position.

**Output:** `02-Knowledge/identity/cognitive-profile.md` — a document Atlas reads at session start for calibration, not a checklist to follow.

### Slice E: Living Backlog

**No PAI reference.** Fresh build.

**Purpose:** A persistent, human-readable backlog at `01-Projects/observer-council/BACKLOG.md` that is auto-updated by the session-end hook with open tensions and pending items. Replaces the stale `00-Inbox/BACKLOG.md` with a living document that stays current.

**Design:**
- Markdown format, human-editable. Adam can add, remove, and reorder items manually.
- Session-end hook appends new tensions as backlog items under an `## Auto-tracked Tensions` section
- Manual items under other sections are never touched by automation
- Items include: source session date, recurrence count, related motifs
- Resolved tensions are moved to a `## Resolved` section (not deleted — audit trail)

**Implementation:**
- `src/s8/handlers/backlog-update.ts` — reads BACKLOG.md, reads open tensions from tension tracker, appends new items, moves resolved items
- Integrated into stop orchestrator (Slice A) as a handler
- Safe merge: only modifies the `## Auto-tracked Tensions` section. All other sections are pass-through.
- Creates BACKLOG.md with scaffold if it doesn't exist

---

## IDEAL STATE CRITERIA

### Slice A: Stop Orchestrator

- [x] ISC-A1: Stop orchestrator delegates to handlers via Promise.allSettled | Verify: Read: check src/s8/stop-orchestrator.ts uses Promise.allSettled
- [x] ISC-A2: Handler interface accepts ObserverEvent array and StopContext | Verify: Read: check handler function signatures in src/s8/handlers/
- [x] ISC-A3: Session-end-hook.ts is thin shell calling stop orchestrator | Verify: Read: session-end-hook.ts under 30 lines of logic
- [x] ISC-A4: Event cleanup handler truncates events.ndjson after capture | Verify: Read: check src/s8/handlers/event-cleanup.ts truncation logic
- [x] ISC-A5: Stop orchestrator reads stdin once and distributes parsed data | Verify: Read: single stdin read in stop-orchestrator.ts
- [x] ISC-A6: All handlers fail-silent with try-catch isolation | Verify: Grep: error handling in each handler file
- [x] ISC-A7: No imports from ~/.claude or ~/.claude-v3 directories | Verify: Grep: no "~/.claude" or ".claude-v3" in src/s8/
- [x] ISC-A8: StopContext type includes sessionId, events, and timestamps | Verify: Read: type definition in stop-orchestrator.ts
- [x] ISC-A-A1: No handler failure propagates to CLI session output | Verify: Read: console.log only outputs {continue:true}
- [x] ISC-A-A2: Orchestrator never blocks Claude Code for more than 500ms | Verify: Read: timeout race pattern matches adapter.ts approach

### Slice B: ISC Dual-Speed Mode

- [x] ISC-B1: evaluateISC function accepts ISC array and EvalContext | Verify: Read: function signature in src/s0/isc-evaluator.ts
- [x] ISC-B2: isFoundational returns true for architecture directory files | Verify: Test: unit test with path "01-Projects/observer-council/architecture/foo.md"
- [x] ISC-B3: isFoundational returns true for motif directory files | Verify: Test: unit test with path "02-Knowledge/motifs/bar.md"
- [x] ISC-B4: isFoundational returns true for governance-related files | Verify: Test: unit test with glob match
- [x] ISC-B5: isFoundational returns true for s0 schema layer files | Verify: Test: unit test with path "src/s0/types.ts"
- [x] ISC-B6: isFoundational returns true for task description containing "architecture" | Verify: Test: unit test with context
- [x] ISC-B7: Fast mode returns binary pass or fail status only | Verify: Read: fast path returns ISCResult without coherenceNotes
- [x] ISC-B8: Deep mode returns pass or fail plus coherence notes | Verify: Read: deep path populates coherenceNotes array
- [x] ISC-B9: ISCResult extends ISC with mode and optional coherenceNotes | Verify: Read: type definition
- [x] ISC-B10: Evaluator uses existing ISC type from s0/isc.ts unchanged | Verify: Grep: import from "./isc" in isc-evaluator.ts
- [x] ISC-A-B1: Fast mode never produces coherence notes | Verify: Test: fast mode result has undefined coherenceNotes
- [x] ISC-A-B2: No external dependencies added for ISC evaluation | Verify: Read: no new imports in package.json

### Slice C: PRD Reader

- [x] ISC-C1: readPRD parses YAML frontmatter into PRD metadata fields | Verify: Test: parse sample PRD, check id/status/effort_level
- [x] ISC-C2: readPRD extracts ISC criteria from checkbox markdown lines | Verify: Test: parse PRD with 3 ISC lines, get ISC[] of length 3
- [x] ISC-C3: readPRD distinguishes checked from unchecked ISC criteria | Verify: Test: [x] → passing, [ ] → pending
- [x] ISC-C4: readPRD extracts verification method from pipe-delimited suffix | Verify: Test: "| Verify: CLI: curl" → method="CLI"
- [x] ISC-C5: readPRD parses LOG section into PRDLogEntry array | Verify: Test: parse PRD with 2 log entries
- [x] ISC-C6: readPRD parses CONTEXT section extracting problem space | Verify: Test: non-empty problemSpace string
- [x] ISC-C7: listPRDs returns array of PRD objects from directory | Verify: Test: list .prd/ directory, get array
- [x] ISC-C8: Missing sections return empty arrays not errors | Verify: Test: parse PRD missing LOG section, get empty array
- [x] ISC-C9: Reader uses existing PRD type from s0/prd.ts unchanged | Verify: Grep: import from "./prd" in prd-reader.ts
- [x] ISC-C10: No external parsing dependencies — regex only | Verify: Read: no yaml/markdown library imports
- [x] ISC-A-C1: Malformed frontmatter does not throw — returns defaults | Verify: Test: parse file with broken YAML
- [x] ISC-A-C2: Reader never writes to disk — pure read operation | Verify: Grep: no writeFileSync or appendFileSync in prd-reader.ts

### Slice D: Identity Profile

- [x] ISC-D1: Document exists at 02-Knowledge/identity/cognitive-profile.md | Verify: Read: file exists
- [x] ISC-D2: Surveyor epistemology section describes map-before-build pattern | Verify: Read: section contains "map" and "territory" or "structure"
- [x] ISC-D3: Fractal zoom section describes cross-level pattern recurrence | Verify: Read: section references at least 3 abstraction levels
- [x] ISC-D4: Observer archetype section connects to consciousness-first framing | Verify: Read: section references observer as precondition
- [x] ISC-D5: Oscillation pattern section distinguishes independence from quantity | Verify: Read: section mentions structural independence
- [x] ISC-D6: Long integration section describes multi-session processing | Verify: Read: section references sessions and time
- [x] ISC-D7: Sovereignty section frames authority as structural not preferential | Verify: Read: section connects to D/I/R framework
- [x] ISC-D8: Document is under 200 lines for context budget | Verify: CLI: wc -l on file
- [x] ISC-A-D1: No PAI Algorithm terminology in the document | Verify: Grep: no "OBSERVE", "THINK", "PLAN", "BUILD", "EXECUTE", "VERIFY", "LEARN" as phase names
- [x] ISC-A-D2: Document does not prescribe behavior — describes cognition only | Verify: Read: no imperative instructions ("you must", "always do")

### Slice E: Living Backlog

- [x] ISC-E1: BACKLOG.md exists at 01-Projects/observer-council/BACKLOG.md | Verify: Read: file exists
- [x] ISC-E2: Auto-tracked Tensions section populated from open tensions | Verify: Read: section header exists with tension items
- [x] ISC-E3: Each tension item shows source date and recurrence count | Verify: Read: items contain date and "seen Nx"
- [x] ISC-E4: Manual sections above Auto-tracked are never modified | Verify: Test: add manual item, run update, manual item preserved
- [x] ISC-E5: Resolved tensions moved to Resolved section not deleted | Verify: Test: resolve a tension, check Resolved section
- [x] ISC-E6: Backlog handler reads from tension-tracker's readOpenTensions | Verify: Grep: import readOpenTensions in backlog-update.ts
- [x] ISC-E7: Handler creates BACKLOG.md with scaffold if missing | Verify: Test: delete file, run handler, file recreated
- [x] ISC-E8: Handler integrated into stop orchestrator as registered handler | Verify: Read: stop-orchestrator.ts imports backlog handler
- [x] ISC-A-E1: Handler never modifies sections it does not own | Verify: Read: only writes to Auto-tracked and Resolved sections
- [x] ISC-A-E2: Empty tension list does not corrupt existing backlog | Verify: Test: run with zero tensions, backlog unchanged

---

## DECISIONS

(None yet — populated during BUILD.)

---

## LOG

### Iteration 1 — 2026-03-09
- Phase reached: VERIFY
- Criteria progress: 54/54
- Work done: All five slices built in parallel via sub-agents. Slice A: stop orchestrator with 3 handlers + backlog handler (s8/). Slice B: isc-evaluator.ts with dual-speed fast/deep modes. Slice C: prd-reader.ts with regex-only markdown parsing. Slice D: cognitive-profile.md (75 lines, 6 sections). Slice E: backlog-update handler + BACKLOG.md scaffold. Session-end-hook.ts refactored to 19-line thin shell.
- Failing: none
- Context for next iteration: All slices pass ISC. Backlog handler registered in stop orchestrator. No external dependencies added. Ready for Adam's review and potential hook registration in settings.json.
