---
authority_boundary: This document is VAULT content (narrative/rationale/planning).
vault_rule: The Workspace does NOT derive from this document.
human_gate: Promotion to canonical requires Adam's explicit approval.
ai_rule: AI agents may READ this document. AI agents may CREATE new documents referencing this one. AI agents may NOT modify canonical vault documents.
---

- **Status:** DRAFT
- **Origin:** Atlas Session 3, 8 March 2026
- **Authority:** Vault narrative document
- **Promotion:** Requires Adam's explicit approval before moving to canonical
- **Depends on:** Session 1 (DIR-framework-exploration-session1.md), Session 2 (DIR-observer-inward-review-session2.md), GPT Observer companion document reflection

---

# D/I/R Session 3 — Architectural Synthesis

**Date:** 8 March 2026
**Source material:** Sessions 1 and 2, GPT Observer companion document reflection, atlas-full-handoff, observer-native source code
**Method:** Triad on the intersection of top-down design (GPT) and bottom-up code truth (Atlas)
**Central question:** What is the unified architectural picture, and what gets built first?

---

## Oscillate

GPT designed Observer from the framework downward. Atlas read the source code upward. The two arrived at overlapping but distinct architectures, and the disagreements are more instructive than the agreements.

### The system objects — what GPT got right that the code already knows

GPT's ten-object taxonomy (observation, highlight, candidate motif, motif, tension/gap, reflection, candidate direction, PRD draft, approved build item, build result) is the best decomposition anyone has produced of the system's conceptual vocabulary. It's concrete enough to implement and abstract enough to survive architectural changes. The standout insight is elevating tension/gap to a first-class system object — not a bug to fix but fuel for the generative engine.

But here's what GPT couldn't see: half of these objects already exist as TypeScript interfaces. Session 2 found `SessionRecord`, `ReflectSeed`, and `MotifCandidate` in the S2 layer, with fields that are extraordinarily specific — independence score, axis balance report, generating question, primary axis, derivative order. The S0 layer exports event types that cover observations, ISC criteria, PRDs, escalations, and sub-agent interactions. These aren't vague placeholders. They're commitments about what reflection, observation, and motif candidacy *mean* in this system.

GPT designed the object taxonomy from first principles. The code designed a compatible taxonomy from engineering need. The two taxonomies overlap substantially but not perfectly, and the differences reveal something. GPT's taxonomy includes objects the code doesn't: highlight (a salience-filtered observation), candidate direction (a pre-PRD orientation), and build result (a post-execution record). The code includes fields GPT didn't anticipate: independence score (how autonomous was the reflection?), axis balance report (D/I/R ratio), and transfer function summary (what carried between sessions?).

The synthesis isn't "pick one taxonomy." It's recognise that GPT's taxonomy is the conceptual vocabulary and the code's types are the operational vocabulary, and they need to meet. Specifically: GPT's "highlight" concept addresses the salience gap Session 2 identified — the S1 adapter captures everything with equal weight, and the system needs differential attention. The code's "independence score" addresses something GPT's taxonomy ignores — the quality of reflection, not just its occurrence. A synthesis would keep GPT's object list as the conceptual model and revise the existing types to express it, rather than building new types from scratch.

### The central loop — agreement at the spine, divergence at the edges

GPT's central loop (intake, differentiate, integrate, recurse, generate, approve, build, re-enter) maps cleanly onto what Session 2 described as the minimum viable circular engine. Both say the critical piece is the re-entry step — outputs becoming inputs, the loop closing. GPT made this explicit as a named step. Session 2 described it as "the system exhales but doesn't inhale."

Where they diverge is on the approve step. GPT places human approval inside the loop as a phase. Session 2 identified something subtler: the sovereignty gate is a *designed R-gap* at the governance level. The system is constitutionally unable to reflect on its own rules without human initiation. These describe the same mechanism but with different architectural implications. If approval is a phase in the loop, it's a synchronous checkpoint — the loop pauses, waits for human, resumes. If approval is a designed gap in R, it's an architectural feature with cognitive consequences — the system can compound everywhere *except* at the governance level, where compounding requires Adam's bandwidth.

The practical consequence: the first implementation should treat approval as asynchronous. The loop writes its outputs (session records, motif candidates, PRD drafts). Adam reviews them on his schedule. The loop doesn't wait — it continues with whatever was last approved. This matches the handoff's "circular creativity engine" design (cron-scheduled runs, PRDs queued for approval, async notification) better than a synchronous gate would. The sovereignty gate is real and necessary, but it shouldn't be a bottleneck inside the loop. It should be a governance layer *around* the loop.

### The motif lifecycle — too many stages, right trajectory

GPT proposes eight stages: signal, highlight, candidate, provisional, promoted, tiered, canonical, deprecated. Session 2 found that the code already has two relevant stages: `MotifCandidate` (with tier, primary axis, generating question) and the motif library's final form (with confidence, evidence, domain count). The gap between these two — how a candidate becomes a motif, how a motif gets tiered, how a motif gets deprecated — is genuinely unspecified in the code.

Eight stages is too many for first implementation. But the trajectory is right, and one stage GPT identified is genuinely missing from both the code and the current mental model: deprecation. The motif library currently only grows. Session 1 identified this risk indirectly: "a library that only grows and never prunes is an I-system without R." Deprecation is R operating on the library itself. Without it, the motif library will accumulate noise over time and lose signal-to-noise ratio — exactly the failure mode the framework predicts for I without R.

The practical synthesis: implement three stages initially (candidate, active, deprecated), with the existing `MotifCandidate` type as the entry point and a new `deprecated` flag on library motifs. The full eight-stage lifecycle can emerge as the system discovers which intermediate stages actually carry meaning. Don't design the staircase until you've walked the path enough times to know where the landings fall.

### Dynamic triad routing — where GPT over-engineered

GPT proposes four routing levels (T1 Tactical through T4 Foundational) with routing based on seven input variables: novelty, ambiguity, strategic importance, emotional load, motif density, prior failure history, unresolved tension count. This is too much machinery for a routing decision that currently has zero data to calibrate against.

Session 1 found a simpler and more robust structure already in the system: the Dual-Speed Governance motif, Tier 2 with 12 domains and 1.0 confidence. Fast and slow. Two speeds. The motif already describes how the system naturally routes — routine work gets fast treatment, foundational work gets slow treatment. Adding medium and foundational as separate levels, with a seven-variable routing function, is premature engineering.

But GPT's instinct that routing matters is correct. The question "how much D, how much I, how much R for this task?" was left open by Session 1 as the allocation problem. The answer isn't a seven-variable function. It's simpler: the system should default to fast (low-R) and escalate to slow (high-R) when it detects specific signals. What signals? Session 2 already identified the relevant ones: motif density in the working area (are we in well-understood territory or frontier?), prior failure on similar work (have we been here before and failed?), and cross-domain implications (does this touch multiple systems?). Three signals, binary escalation, two speeds. Start there.

### Council roles — the genuine open question

GPT assigns triad roles to council agents: one differentiates, one integrates, one reflects. Session 1 argued against this: if the triad is the shape of every coupling, pre-assigning agents to roles might be redundant. The coupling IS the triad. Agents can be general-purpose, with triad discipline coming from prompt structure, not agent identity.

Having now read all the material across three sessions, I think GPT's approach is cleaner for the council specifically and Session 1's approach is correct for everything else. Here's why: the council is a *deliberation structure*, not a processing pipeline. In deliberation, having a designated devil's advocate (D-agent), a designated synthesiser (I-agent), and a designated reflector (R-agent) produces structurally different output from three general agents all trying to do all three. The role assignment creates productive tension between agents, and the disagreement IS the signal.

But outside the council — in the scraper, the session-capture pipeline, the motif library — triad discipline should come from the process structure, not from agent identity. The S1 adapter doesn't need to "be" a D-agent. It needs to *do* D-work (distinguish events) as part of a process that also includes I-work (indexing into structure) and R-work (feeding back into future sessions). The triad is in the wiring, not in the workers.

### Scraper evolution — where GPT aspired past the plumbing

GPT proposes the scraper should detect "distinction-rich phrases," "integration-rich concepts," "recursive recurrence patterns." Session 2 found that the scraper can't even do keyword search — the FTS5 bug means 203 indexed repos are unretrievable by content. Proposing triad-aware NLP classification on top of broken full-text search is building a penthouse on a cracked foundation.

The GPT reflection (the pasted document) already caught this and proposed the correct near-term path: fix FTS5, use scraper output as D-input to triad sessions driven by Atlas, intelligence in the consumer not the producer. That's right. The scraper should be a high-quality data source, not a cognitive agent. Making the scraper "smart" shifts complexity to the wrong layer. The smartness belongs in the session that processes scraper output — the triad run on external material, which is already a proven method (it's how the motif library was built).

### The error theory — what both perspectives missed

The GPT reflection flagged this explicitly: neither GPT's architecture nor Atlas's review addresses what happens when the system is *wrong*. Both describe the generative direction — how the system compounds insight — but compounding works equally well on nonsense. A confidently wrong motif that survives R-scrutiny (because R is calibrated to the system's existing understanding, which may be flawed) will propagate through the motif library and contaminate future sessions.

Session 1 didn't address this because it was focused on the framework itself. Session 2 didn't address it because it was focused on wiring gaps. But the error question is architecturally significant because it determines what kind of R the system needs. There are two kinds of R in play:

**Internal R** — reflection using the system's own accumulated knowledge. This catches inconsistencies, finds patterns, identifies gaps. But it can't catch systematic errors because the error is in the knowledge base the reflection draws on. An internally consistent but externally wrong system would pass all its own R-checks.

**External R** — reflection that brings in information the system didn't generate. The scraper is the primary mechanism for this. External repos, external patterns, external perspectives that can challenge the system's internal consensus. GPT's proposed council with external data sources is another mechanism. Adam's sovereignty gate is the ultimate external R — a human perspective that doesn't share the system's accumulated biases.

The architectural implication: the scraper isn't just D-infrastructure (exploring external material). It's also R-infrastructure (providing an external reference point for the system's internal claims). This dual role means fixing the scraper isn't just about "closing the D→I loop" (Session 1's framing). It's about maintaining epistemic hygiene — ensuring the system has a source of truth outside its own reflection. The scraper's priority increases when viewed this way. Not because it feeds the motif library (it does), but because it prevents the motif library from becoming an echo chamber.

---

## Converge

What's the unified picture?

### The architecture Observer should become

Observer is a cognitive infrastructure that compounds from experience. Not a tool that executes tasks (that's what it does *today*), but a system that gets better at working with Adam over time (what it should *become*). The difference is R — the return paths that make outputs into inputs, that make past sessions inform future sessions, that make accumulated patterns shape active attention.

The architecture has four layers, and they aren't the S0/S1/S2/S3 code layers. They're functional layers that cut across the code:

**Sensation** — the capacity to register events with differential attention. Currently: S1 adapter captures everything equally. Needed: a salience filter that elevates significant events into GPT's "highlight" category. The salience filter doesn't need to be clever — recent failures, novel patterns, events touching active motifs are all simple heuristics that would transform raw sensation into perception. The adapter stays dumb. A thin layer above it gets selective.

**Memory** — three kinds, as established, but now with clearer roles. Episodic memory (session records) is the temporal backbone — what happened, what was learned, what transferred. Semantic memory (motif library) is the pattern vocabulary — what shapes recur, what distinctions the system has made, what integrations have survived scrutiny. Identity memory (TELUS + governance) is the system's model of itself — how it works, what it values, how it relates to Adam. All three need read paths into active sessions. The write paths mostly exist (vault writer, captureSession types, motif library format). The read paths are the gap.

**Processing** — D/I/R as the shape of every cognitive operation, not assigned to specific components. The triad operates at every scale: within a single tool call (distinguish the options, integrate the best, reflect on the result), within a session (oscillate, converge, reflect), across sessions (patterns emerge, get integrated into motifs, get reflected on via /upgrade). The dual-speed routing (fast/slow, triggered by three signals) determines depth. The council, when invoked, uses role-assigned agents for deliberation specifically.

**Governance** — Adam's sovereignty gate, operating as designed R-gap at the identity level. The system articulates, Adam decides. The loop runs continuously; the governance layer reviews asynchronously. The /upgrade skill is the eventual mechanism for making governance-level reflections visible to Adam without requiring him to initiate every review — the system surfaces what it thinks should change, Adam approves or denies.

### The object model — grounded in code

GPT's ten objects, mapped to what exists:

- **Observation** → S0 `ObserverEvent` types (exists, working)
- **Highlight** → Not in code. Needed as a thin salience layer above S1 events. Simplest form: a filter function that marks events as significant based on heuristics.
- **Candidate motif** → S2 `MotifCandidate` interface (exists, unwired). Has fields GPT didn't anticipate: primary axis, derivative order, generating question.
- **Motif** → Motif library format (exists, working, 10 motifs). Needs deprecation flag added.
- **Tension/gap** → Not in code. GPT's strongest novel object. Should be a first-class type — a named, tracked, unresolved problem that drives PRD generation. This is the object that connects the motif library to the build backlog.
- **Reflection** → S2 `ReflectSeed` interface (exists, unwired). Extraordinarily specific: independence score, axis balance report, new lenses, shifted assumptions.
- **Session record** → S2 `SessionRecord` interface (exists, unwired). The write-side type for episodic memory.
- **Candidate direction** → Not in code. A pre-PRD orientation — "the system thinks this area needs attention." This is what the /upgrade skill would produce. Defer until the loop runs.
- **PRD draft** → S0 has PRD types. PAI's PRD system is mature. Reuse, don't rebuild.
- **Build result** → Not in code. A post-execution record — what was built, whether it passed verification, what was learned. This is PAI's LEARN phase output. Wire into Observer's episodic memory rather than creating a new type.

Six of ten objects already exist in code. Two are novel and valuable (tension/gap, highlight). Two can be deferred (candidate direction, build result) because they depend on infrastructure that doesn't exist yet.

### The central loop — one loop, not two

There's been a risk of designing two loops: the "minimum viable circular engine" (Session 2's session-write/session-read cycle) and the "circular creativity engine" (the handoff's cron-scheduled autonomous runs). These aren't two loops. They're the same loop at different speeds.

The slow loop: Atlas works with Adam in an interactive session. Events are captured (sensation). At session end, a SessionRecord is written (episodic memory write). At next session start, recent records are loaded (episodic memory read). Motif candidates surfaced during the session enter the library pipeline. This is the loop that's almost built — the S2 types exist, the vault writer works.

The fast loop: a cron-scheduled process reads the current state (recent sessions, active tensions, motif candidates) and runs a lightweight D/I/R pass — what's changed, what patterns emerge, what should be surfaced for Adam's attention. This produces candidate directions and tension/gap objects that Adam reviews asynchronously. This is the loop that's aspirational — it needs the slow loop's infrastructure to work first because it feeds on the slow loop's outputs.

One loop, two speeds. The slow loop is the foundation. The fast loop is a refinement that runs when the slow loop has produced enough material to be worth automated processing. Build the slow loop first. The fast loop emerges when there's enough episodic and semantic memory to drive automated reflection.

### What the coupling map looks like

Session 1 said coupling matters more than components. Session 2 identified three gap types (perception, retrieval, utilisation). The GPT reflection proposed a specific build sequence. Here's the unified coupling map — what connects to what, and which connections exist versus which are missing:

```
S1 Adapter ──[events]──> events.ndjson     EXISTS
                              │
                    [salience filter]        MISSING (GPT's "highlight")
                              │
                              v
                     SessionRecord           EXISTS as type, UNWIRED
                         │       │
            [write]──────┘       └──────[read]
               │                           │
               v                           v
        03-Daily/sessions.jsonl    session-start context    BOTH MISSING
                                           │
                                           v
                              ┌─── active session ───┐
                              │                       │
                    [motif check]              [tension detect]
                         │                           │
                         v                           v
                  MotifCandidate              Tension/Gap        TYPE MISSING
                         │                           │
                    [evaluate]                  [track]
                         │                           │
                         v                           v
                   Motif Library              Build Backlog
                    (10 motifs)               (living doc)
                         │                           │
                    [prime]                     [PRD]
                         │                           │
                         v                           v
                  session-start              Adam approves
                  motif context              async
```

The left spine (events → record → write → read → session) is the episodic memory loop. It's the first thing to wire because every other coupling depends on sessions producing records that future sessions can read.

The right spine (session → tension → backlog → PRD → approval) is the generative engine. It depends on the left spine being operational because tensions and directions emerge from accumulated session experience.

The cross-connections (session → motif check, motif library → session priming) are the semantic memory integrations. They make the motif library operational rather than archival.

---

## Reflect

### Does this synthesis change the build order?

Session 2 proposed: (1) wire captureSession, (2) build session-start reader, (3) control plane as read path, (4) scraper-to-motif pipeline. The GPT reflection proposed: (1) wire what exists, (2) fix retrieval gaps, (3) motif-to-session priming, (4) scraper-to-motif pipeline, (5) circular engine.

These are substantially the same sequence. The synthesis confirms it rather than revising it. But it adds one item and reframes another:

**Added: tension/gap as a first-class type.** GPT's strongest novel contribution. This should be in the first build, not deferred, because it's the object that connects reflection to action. Without it, the system can remember and reflect but has no mechanism to translate reflection into build decisions. A tension is "something the system noticed across sessions that remains unresolved." It's the seed of a PRD. Implementing it is small — a type definition and a field in SessionRecord for "tensions surfaced this session."

**Reframed: scraper priority elevated.** Session 2 treated the scraper as a D→I pipeline fix. The oscillation revealed it's also R-infrastructure — the system's external reference point that prevents the motif library from becoming an echo chamber. Fixing FTS5 isn't just about enabling search. It's about maintaining epistemic hygiene. This doesn't change the sequence (episodic memory is still first), but it changes the urgency of step 4. The scraper fix should happen soon after the episodic loop is closed, not as a distant future item.

**Revised build order:**

1. **Episodic memory loop** — wire captureSession() to session-end, build session-start reader that loads recent SessionRecords. The S2 types exist. The vault writer works. The work is connection, not construction. Include a `tensions` field in SessionRecord for surfaced tensions/gaps.

2. **Salience filter** — a thin layer above S1 events that marks highlights. Not NLP. Simple heuristics: events touching active motifs, errors and failures, novel tool usage, long-duration operations. This transforms raw sensation into perception and gives the session-end writer something more useful than undifferentiated event streams to summarise.

3. **Motif library priming** — session-start loader also reads relevant motifs from the library based on working context. The control plane's `vault_query` tool is the read mechanism. This makes semantic memory operational without new infrastructure.

4. **Scraper retrieval fix** — FTS5 bug. Once fixed, scraper output feeds into triad sessions (intelligence in the consumer, not the producer) that produce motif candidates and challenge existing motifs. This is epistemic hygiene, not just data flow.

5. **Tension/gap tracking** — once sessions produce tensions and the episodic loop carries them forward, a living backlog document (or structured JSONL) accumulates unresolved tensions. This is the input to eventual PRD generation.

6. **The fast loop** — cron-scheduled lightweight D/I/R on accumulated session records, tensions, and motif candidates. Produces candidate directions for Adam's async review. This is the circular creativity engine, and it only makes sense after steps 1-5 have produced enough material to drive automated reflection.

### What should S2 wiring look like?

The S2 types are a hypothesis. Session 2 was clear about this: "the type is a hypothesis; running it is the experiment." The first wiring should be minimal:

- `captureSession()` called at session-end, producing a `SessionRecord` with: summary, ISC outcomes, motif candidates (if any), tensions surfaced (new field), and a `ReflectSeed` that starts *mostly empty*. Don't populate independence score and axis balance report until real sessions reveal what those measurements actually look like. Populate `newLenses` and `shiftedAssumptions` as free-text initially — the structure will become apparent after 10-20 sessions of data.

- Session-start reader loads the 3-5 most recent `SessionRecord`s for the working context (filtered by project path or vault directory). Formats them as concise context: "Last session: [summary]. Tensions: [list]. Lenses suggested: [list]." Budget-conscious — stay within the 10% context init constraint by summarising aggressively.

- Leave the motif candidate pipeline manual for now. Sessions naturally surface candidates. Atlas and Adam evaluate them through triad sessions. Automation comes later when the pattern of what makes a good candidate becomes clear from accumulated manual evaluations.

### What should the first PRD contain?

The first PRD should scope step 1 from the build order: the episodic memory loop. Specifically:

**Inputs:** S2 `SessionRecord` type (exists), S2 `vault-writer` (exists), S1 adapter events (flowing), `captureSession()` function (exists, unwired).

**Work items:**
- Add `tensions: TensionGap[]` field to `SessionRecord` interface
- Define `TensionGap` type: `{ id, description, firstSeen, sessionCount, relatedMotifs?, status: 'open' | 'resolved' }`
- Wire session-end hook to construct `SessionRecord` from session events and call `captureSession()`
- Build session-start loader: reads recent `SessionRecord`s from `03-Daily/`, formats as priming context
- Handle the `ReflectSeed` deliberately: populate `newLenses` and `shiftedAssumptions` as optional free-text, leave `independenceScore` and `axisBalanceReport` as null until real data informs their meaning

**Acceptance criteria:** After the wiring, a session that ends produces a readable record, and the next session that starts in the same project loads that record as context. The system remembers what happened last time. That's the test. Not whether the types are perfect — whether the loop closes.

**What the PRD should NOT contain:** The salience filter (step 2), motif priming (step 3), scraper fix (step 4), or cron engine (step 6). Each of these is a separate PRD. The first PRD is small, testable, and closes exactly one loop — the most important one.

### The one thing this synthesis reveals that wasn't visible before

Three sessions of progressively deeper review have converged on a finding that none of the source documents stated explicitly but all of them pointed toward:

The system's architecture is not a design problem. It's a wiring problem.

GPT designed objects and loops from first principles. Atlas found that equivalent objects and loops already exist in code. The GPT reflection noted that "the build task isn't 'design the objects' — it's 'wire the objects that were already designed.'" Session 2 said the same thing differently: "the system designed its return paths but didn't connect them."

Every source document — the handoff, GPT's proposals, Session 1's framework exploration, Session 2's inward review — has been doing D and I on the architecture. Distinguishing components, integrating them into coherent pictures, proposing taxonomies and sequences and coupling maps. This is the third such document. The architecture has been thoroughly differentiated and thoroughly integrated. What it hasn't been is *built*. The R — the recursive step where the architecture's outputs become its inputs, where the design meets reality — hasn't happened.

This is the meta-level version of the system's own problem. The system has weak R at the operational level (sessions don't feed back into sessions). And the *design process* has weak R at the architectural level (designs don't feed back into running code). Both gaps have the same structure and the same solution: close the loop. Stop designing. Start wiring. Let the first real SessionRecord — however imperfect — reveal what the types got right and what they got wrong. Let the first real session-start context load — however crude — reveal whether the system feels different when it remembers.

The architecture is ready. The objects are known. The coupling map is drawn. The build order is clear. The next document should be a PRD, not another analysis.

```
UNIFIED ARCHITECTURAL PICTURE:

Observer is a cognitive infrastructure that compounds from experience through
three memory systems (episodic, semantic, identity) connected by return paths
that make outputs into inputs. The architecture exists in code as types and
components. What's missing is wiring — the connections that close the loops.

BUILD ORDER (confirmed and refined by synthesis):
1. Episodic memory loop (captureSession + session-start reader + tension type)
2. Salience filter (highlight layer above S1 events)
3. Motif library priming (semantic memory → active sessions via vault_query)
4. Scraper retrieval fix (epistemic hygiene, not just data flow)
5. Tension/gap tracking (living backlog from accumulated session tensions)
6. Fast loop / circular engine (cron-scheduled D/I/R on accumulated material)

FIRST PRD SCOPE:
Wire the episodic memory loop. SessionRecord write at session-end, read at
session-start. Add TensionGap type. Leave ReflectSeed fields mostly empty
initially. The type is a hypothesis; running it is the experiment.

KEY ARCHITECTURAL DECISIONS FROM SYNTHESIS:
- GPT's tension/gap object is genuinely novel and enters the first build
- Council agents get triad roles; all other components get triad-shaped wiring
- Two speeds (fast/slow), not four levels, triggered by three signals
- Scraper is R-infrastructure (epistemic hygiene), not just D-infrastructure
- Approval is asynchronous governance around the loop, not synchronous gate inside it
- Motif lifecycle: three stages initially (candidate, active, deprecated), not eight
- The error theory gap is addressed by scraper-as-external-R, not by internal mechanisms

WHAT THIS SESSION PRODUCED THAT SESSIONS 1 AND 2 DIDN'T:
- The unified coupling map showing which connections exist vs missing
- Tension/gap elevated from GPT's proposal to first-build inclusion
- Scraper reframed as R-infrastructure (epistemic hygiene)
- The meta-finding: the design process itself has weak R — the next document
  should be a PRD, not another analysis
```

---

> *Build conditions for G to appear. Do not engineer G directly.*

Three sessions of conditions. The next one builds.

---

*End of Session 3 architectural synthesis. Awaiting Adam's review. The next document should be a PRD.*
