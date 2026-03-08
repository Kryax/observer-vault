---
prd: true
id: PRD-20260309-s2-motif-library-priming
status: COMPLETE
mode: interactive
effort_level: Extended
created: 2026-03-09
updated: 2026-03-09
iteration: 1
maxIterations: 128
loopStatus: completed
last_phase: VERIFY
failing_criteria: []
verification_summary: "14/14"
parent: null
children: []
language: TypeScript
runtime: Bun
---

# S2 Motif Library Priming — Semantic Memory at Session Start

> Surface relevant motif content at session start based on working context, making the motif library operational rather than archival. The system doesn't just know what patterns exist — it brings the right ones to bear.

**Status:** DRAFT — requires Adam's approval before any build begins.

**Source:** D/I/R Session 3 architectural synthesis, build order step 3. "Session-start loader also reads relevant motifs from the library based on working context."

**Depends on:** Step 1 complete (PRD-20260308-s2-episodic-memory-loop, 11/12 ISC). Step 2 complete (PRD-20260308-s2-salience-filter, 15/15 ISC). Motif library exists with 10 motifs.

---

## STATUS

| What | State |
|------|-------|
| Progress | 14/14 criteria passing |
| Phase | COMPLETE |
| Next action | Commit |
| Blocked by | Nothing |

---

## 1. Problem Space

The session-start hook (`src/s2/session-start-hook.ts`) currently loads active motifs and formats them as a flat name list:

```
Active motifs: dual-speed-governance, composable-plugin-architecture, ...
```

This is archival — it tells you what patterns exist but doesn't surface *which ones matter right now*. A session working on state machine transitions gets the same motif list as a session refactoring plugin boundaries. The motif library has 10 entries with rich structural descriptions, domain instances, falsification conditions, and axis metadata. None of that reaches the session context.

Session 3 identified this as the missing cross-connection on the coupling map: "session → motif check" and "motif library → session priming." The salience filter (step 2) already does motif-touch detection on *events during* a session. Step 3 does the complementary thing: motif relevance detection *before* the session begins, so the session starts with the right conceptual vocabulary loaded.

### What exists (inputs to this PRD)

| Component | Location | Status |
|-----------|----------|--------|
| `readActiveMotifs()` | `src/s2/context-hydration.ts:141` | Working, reads all motif files |
| `MotifEntry` type | `src/s2/context-hydration.ts:42` | Has `filename` and `content` fields |
| `HydratedContext.activeMotifs` | `src/s2/context-hydration.ts:29` | Populated, passed to session-start-hook |
| Session-start hook motif formatting | `src/s2/session-start-hook.ts:71-77` | Names only, no content, no relevance filtering |
| Motif library | `02-Knowledge/motifs/` | 10 motifs, rich markdown with frontmatter |
| Motif schema | `02-Knowledge/motifs/_SCHEMA.md` | 11 required fields including tier, confidence, primary axis |
| `MOTIF_INDEX.md` | `02-Knowledge/motifs/MOTIF_INDEX.md` | Registry with tier, confidence, domain count |
| Recent sessions (episodic context) | `HydratedContext.recentSessions` | Loaded, includes summaries and tensions |
| Salience highlights (from step 2) | `SessionRecord.summary` | Contains motif-touch triggers from prior sessions |
| Control plane vault_query | `localhost:9000/rpc` | Available but adds HTTP latency to session start |

### What doesn't exist (outputs of this PRD)

| Component | Purpose |
|-----------|---------|
| Relevance scoring function | Scores each motif against working context signals |
| Context signal extraction | Extracts keywords/topics from recent sessions, working directory, and tensions |
| Motif content formatter | Formats relevant motifs as concise priming text (not just names) |
| Updated session-start output | Replaces flat name list with relevance-ranked motif summaries |

---

## 2. Scope Boundary

This PRD covers **only** motif library priming at session start (build order step 3). It does NOT cover:

- Episodic memory loop (step 1 — COMPLETE, separate PRD)
- Salience filter (step 2 — COMPLETE, separate PRD)
- Scraper FTS5 fix or scraper-to-motif pipeline (step 4 — separate PRD)
- Tension/gap tracking backlog (step 5 — separate PRD)
- Cron-scheduled fast loop / circular engine (step 6 — separate PRD)
- Motif candidate pipeline automation (deferred per Session 3)
- Motif deprecation lifecycle (deferred per Session 3)

---

## 3. Design

### 3.1 Relevance scoring — why not vault_query

Session 3 suggested the control plane's `vault_query` as the read mechanism. Having reviewed the implementation, this is the wrong choice for session-start priming:

1. **Latency.** Session start must be fast. An HTTP round-trip to localhost:9000 adds 50-200ms. The motif library is 10 files — direct filesystem reads via `readActiveMotifs()` take <5ms.
2. **Already loaded.** `hydrateContext()` already reads all motifs into memory. The data is there. The gap isn't retrieval — it's *relevance scoring*.
3. **No new infrastructure.** Session 3 specified "makes semantic memory operational without new infrastructure." Direct relevance scoring on already-loaded data satisfies this. Adding a vault_query dependency would couple session start to control plane availability.

**Decision:** Score relevance locally using data already in `HydratedContext`. Reserve `vault_query` for future use cases that need search across the full vault (step 5+).

### 3.2 Relevance signals — what "working context" means

Three signals determine which motifs are relevant to the incoming session:

**Signal 1: Recent session content.** The `recentSessions` array contains summaries, tensions, and highlight data from prior sessions. A motif is relevant if its keywords appear in recent session summaries or if recent sessions surfaced motif-touch highlights for it. This is the strongest signal — it reflects what the system has actually been working on.

**Signal 2: Working directory / project context.** The session starts in a project directory. Files recently modified (from git), active PRD criteria, and project-specific concepts provide a secondary signal. For the initial implementation: extract keywords from the most recent session's summary (which already captures tool usage and highlights) rather than scanning the filesystem.

**Signal 3: Open tensions.** Tensions carried across sessions (`TensionGap` with `status: "open"`) indicate unresolved problems. Motifs whose descriptions touch those tension topics are relevant because they may offer structural insight into the unresolved problem.

### 3.3 Scoring function

For each motif, compute a relevance score (0.0 to 1.0):

```
relevance = keyword_match_score × tier_weight
```

Where:
- `keyword_match_score` (0.0-1.0): proportion of motif keywords found in the combined context text (recent session summaries + open tension descriptions)
- `tier_weight`: multiplier that favours higher-tier, higher-confidence motifs: `0.5 + (0.5 × confidence)`. A Tier 2 motif at 0.9 confidence gets weight 0.95; a Tier 0 motif at 0.1 confidence gets weight 0.55.

**Keyword extraction from motif:** Use the motif filename split on `-` (already done in salience filter) plus the frontmatter `name` field. For the initial implementation, avoid parsing full motif content for keywords — filenames and frontmatter are sufficient and fast.

**Threshold:** Include motifs with `relevance > 0.0` (any keyword match). Sort by relevance descending. Cap at top 5 motifs to respect the 2KB context budget.

### 3.4 Motif content formatting

For each relevant motif, output a concise summary (not just the name):

```
Motif: {name} (Tier {tier}, {primary_axis})
  {one-line structural description from frontmatter or first sentence}
  Relevance: {why this motif matched — which keywords/tensions}
```

Budget: ~150 chars per motif × 5 motifs = ~750 chars. This fits within the 2KB total context budget alongside session summaries and other priming data.

### 3.5 Integration point

Modify the `formatPrimingContext()` function in `session-start-hook.ts` to replace the flat motif name list with relevance-scored motif summaries. The `readActiveMotifs()` call in `hydrateContext()` remains unchanged — we use the same data, just format it better.

New function in `context-hydration.ts` or a new `motif-priming.ts`:

```typescript
export interface PrimedMotif {
  name: string;
  tier: number;
  primaryAxis: string;
  confidence: number;
  description: string;  // first sentence of structural description
  relevance: number;
  matchedSignals: string[];  // which keywords/tensions triggered the match
}

export function primeMotifs(
  motifs: MotifEntry[],
  recentSessions: SessionRecord[],
  openTensions: TensionGap[],
): PrimedMotif[];
```

---

## 4. Work Items

### 4.1 Extract motif metadata from content

Parse `MotifEntry.content` (markdown) to extract frontmatter fields: `name`, `tier`, `confidence`, `primary_axis`, and the first sentence of the `## Structural Description` section. Return as a structured type.

### 4.2 Build context signal extractor

Combine recent session summaries and open tensions into a searchable text corpus. Extract keywords by splitting on whitespace and common delimiters, lowercasing, filtering stopwords and short tokens.

### 4.3 Implement relevance scoring function

Score each motif against the context signals using the formula from section 3.3. Return `PrimedMotif[]` sorted by relevance descending, capped at 5.

### 4.4 Format primed motifs for session-start output

Replace the flat name list in `formatPrimingContext()` with relevance-ranked motif summaries. Each entry shows name, tier, axis, structural description snippet, and why it matched.

### 4.5 Export new types and functions from s2/index.ts

Add `PrimedMotif` type and `primeMotifs` function to the S2 public API.

---

## 5. Key Decisions

### Why direct scoring, not vault_query

See section 3.1. The data is already loaded. The gap is scoring, not retrieval. Avoids coupling to control plane availability and adding HTTP latency to session start.

### Why keyword matching, not embeddings or NLP

Same reasoning as the salience filter (step 2): no training data, no inference budget at session start, deterministic and transparent matching. The motif library is 10 entries — keyword matching is sufficient. If it grows to 100+, revisit.

### Why cap at 5 motifs

The 2KB context budget is shared across session summaries, prior ReflectSeed, and motif priming. With ~150 chars per motif summary, 5 motifs consume ~750 chars, leaving room for 3 session summaries and other context. More than 5 would crowd out episodic context.

### Why tier-weighted scoring

Not all motifs are equally trustworthy. A Tier 2 motif at 0.9 confidence has survived cross-domain validation and human approval. A Tier 0 observation is provisional. When multiple motifs match, the system should favour established patterns over speculative ones. The `0.5 + (0.5 × confidence)` formula ensures even low-confidence motifs appear when highly relevant (keyword match dominates) while breaking ties in favour of validated patterns.

### Why a new file (motif-priming.ts) vs inline in context-hydration

The relevance scoring logic is conceptually distinct from context hydration (which loads raw data). Priming is an interpretation layer — it decides what matters. Keeping it separate follows the same pattern as salience-filter.ts: raw data loading in one module, interpretation in another. Future consumers (the fast loop, dashboard) may want to call `primeMotifs()` independently.

---

## 6. Acceptance Test

**The relevance test:**

1. Start a session after working on state-machine-related code (recent session summary mentions "state", "transition", "machine")
2. Verify: "Explicit State Machine Backbone" appears in primed motifs with high relevance
3. Verify: "Bounded Buffer With Overflow Policy" does NOT appear (irrelevant to state machines)
4. Verify: The priming output includes the motif's structural description, not just its name

**The empty-match test:**

5. Start a session with no prior sessions (cold start)
6. Verify: Falls back gracefully — either shows top motifs by tier/confidence, or shows no motifs (not an error)

**Pass condition:** A session about state machines gets state-machine motifs. A session about plugins gets plugin motifs. The system brings the right vocabulary to bear. That's operational semantic memory.

---

## PLAN

### Approach

Motif priming is a pure function module — takes loaded motifs + session context, returns scored and formatted results. No side effects, no external calls.

**Implementation order:**
1. Define types (`PrimedMotif`, `MotifMetadata`) — no dependencies
2. Implement frontmatter parser — extracts structured fields from motif markdown
3. Implement context signal extractor — combines session data into searchable text
4. Implement `primeMotifs()` — scores, ranks, caps at 5
5. Update `formatPrimingContext()` in session-start-hook to use primed motifs
6. Export from `src/s2/index.ts`
7. Verify end-to-end: different session contexts produce different motif selections

**Technical decisions:**
- File: `src/s2/motif-priming.ts` (new file)
- Exports added to `src/s2/index.ts`
- Motif data from existing `readActiveMotifs()` — no new file reads
- Frontmatter parsing: simple regex on `---` blocks, not a YAML dependency
- No new external dependencies
- Session-start-hook modification: replace ~6 lines of name-list formatting

**Task breakdown:**
- Types + parser: independent, can be done first
- Signal extractor: independent of parser
- Scoring function: depends on parser + signal extractor
- Hook integration: depends on scoring function
- Verification: depends on hook integration

---

## IDEAL STATE CRITERIA

### Core Functionality

- [x] ISC-C1: PrimedMotif type defined with name tier axis relevance fields | Verify: Grep: `interface PrimedMotif` in motif-priming.ts
- [x] ISC-C2: Frontmatter parser extracts tier confidence primary-axis from motif markdown | Verify: Read: parser function in motif-priming.ts handles `---` blocks
- [x] ISC-C3: Context signal extractor combines session summaries and open tensions | Verify: Read: function takes SessionRecord[] and TensionGap[] inputs
- [x] ISC-C4: Relevance score computed as keyword-match times tier-weighted confidence | Verify: Read: scoring formula uses `0.5 + (0.5 * confidence)` weight
- [x] ISC-C5: primeMotifs function returns PrimedMotif array sorted by relevance descending | Verify: Grep: `function primeMotifs` in motif-priming.ts
- [x] ISC-C6: Output capped at maximum five motifs per session start | Verify: Grep: slice or limit of 5 in primeMotifs
- [x] ISC-C7: Each primed motif includes structural description first sentence snippet | Verify: Read: description extraction from `## Structural Description`
- [x] ISC-C8: Session-start hook formats primed motifs with name tier and description | Verify: Read: formatPrimingContext uses primeMotifs output
- [x] ISC-C9: PrimedMotif and primeMotifs exported from s2 index module | Verify: Grep: `PrimedMotif` in s2/index.ts

### Integration

- [x] ISC-C10: Motif data sourced from existing readActiveMotifs not new file reads | Verify: Grep: `readActiveMotifs` import in motif-priming.ts or session-start-hook.ts
- [x] ISC-C11: Cold start with no prior sessions does not error or crash | Verify: Read: graceful fallback when recentSessions is empty

### Anti-Criteria

- [x] ISC-A1: No HTTP calls or control plane dependency in motif priming | Verify: Grep: absence of `fetch` or `localhost` in motif-priming.ts
- [x] ISC-A2: No NLP or LLM inference calls in relevance scoring | Verify: Grep: absence of `anthropic` or `inference` imports in motif-priming.ts
- [x] ISC-A3: No new external dependencies added for motif priming | Verify: Read: no new entries in package.json

## DECISIONS

*None yet — PRD is DRAFT.*

## LOG

### Iteration 1 — 2026-03-09
- Phase reached: VERIFY (COMPLETE)
- Criteria progress: 14/14
- Work done: Created motif-priming.ts with PrimedMotif type, frontmatter parser, context signal extractor, relevance scorer. Updated session-start-hook to use primed motifs instead of flat name list. Added exports to s2/index.ts. Functional test confirmed: "state machine" context → Explicit State Machine Backbone #1, cold start → graceful empty.
