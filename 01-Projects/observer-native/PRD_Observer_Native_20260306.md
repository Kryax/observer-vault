---
prd: true
id: PRD-20260306-observer-native
status: DRAFT
mode: interactive
effort_level: Comprehensive
created: 2026-03-06
updated: 2026-03-06
iteration: 0
maxIterations: 128
loopStatus: null
last_phase: null
failing_criteria: []
verification_summary: "0/0"
parent: null
children: []
language: TypeScript
runtime: Bun
---

# Observer-Native: CLI-Agnostic Cognitive Infrastructure

> The execution backbone for the Observer project, replacing PAI with a system built from scratch, owned entirely by Observer, and designed from day one to be hot-swappable across CLI tools.

**Status:** DRAFT — requires Adam's approval before any build begins.

---

## STATUS

| What | State |
|------|-------|
| Progress | 0/0 criteria passing (pre-build) |
| Phase | PRD complete, awaiting approval |
| Next action | Adam reviews PRD |
| Blocked by | Nothing (specification phase) |

---

## 1. System Overview

### 1.1 What Observer-Native Is

Observer-native is a CLI-agnostic cognitive infrastructure layer that replaces PAI as the execution backbone for the Observer project. It is NOT a PAI fork, NOT a PAI wrapper. It is built from scratch, informed by PAI's proven patterns, but owned entirely by the Observer project.

It runs first on Claude Code. It is designed from day one to be hot-swappable to any CLI tool (OpenCode, Gemini CLI, or future tools) via a hook adapter interface.

`[Source: exit-011 PAI Decoupling Decision — Option B chosen; CLAUDE.md observer-native workspace governance]`

### 1.2 What It Replaces

PAI v3.0 currently provides: the algorithm loop, skill system, hook lifecycle, ISC/ideal-state verification, PRD pipeline, memory system, and sub-agent orchestration. Observer-native replaces ALL of these functions with Observer-owned implementations.

### 1.3 What It Keeps (Concepts, Not Code)

From PAI, Observer-native preserves these proven patterns:

| Pattern | PAI Origin | Observer-Native Form |
|---------|-----------|---------------------|
| Algorithm loop | Observe → Think → Plan → Build → Execute → Verify → Learn | Preserved as cognitive rhythm |
| Skill system | Organisational unit for capabilities | Skills as modular, self-activating capability packages |
| Hook lifecycle | CLI extension points | Abstracted behind adapter interface (S1) |
| ISC/ideal-state | Quality verification via binary criteria | Preserved with motif-lens enhancement (S5) |
| PRD pipeline | Specification → execution | Enhanced with slice decomposition and fan-out (S5) |
| Memory system | Cross-session persistence | Rebuilt with vault integration (S2) |
| Sub-agents | Parallelisation strategy | Elevated to DEFAULT execution strategy (S6) |

`[Source: PAI System Architecture — founding principles 1-16; exit-011 — what to preserve vs. discard]`

### 1.4 What It Discards

| Discarded | Reason |
|-----------|--------|
| Tight coupling to Claude Code hook internals | Replaced by adapter pattern (exit-011) |
| Arbol cloud execution layer | Not relevant to Observer's deployment model |
| Agent personality/voice system complexity | Observer uses voice but keeps it simple — no ComposeAgent, no trait matrix, no 10-voice mapping |
| PAI's upgrade cycle dependency | Observer owns its own code |
| Monolithic hook files | Observer builds modular, single-responsibility hooks |
| PAI MEMORY/ directory structure | Observer integrates with the vault's established structure |

`[Source: exit-011 — Option B rationale; PAI Runtime Layout — complexity inventory]`

### 1.5 What Observer-Native Adds

These capabilities exist in Observer-native but never existed in PAI:

| Addition | Source |
|----------|--------|
| Cognitive triad as deliberation architecture (Oscillate → Converge → Reflect) | Theory_To_Architecture, Design Principle 1 `[G4]` |
| Council role structure (Perspective Agents, Triangulator, Sentry, Reflector, Builder) | Council_Redesign_TDS, Section 2 `[G4, G1, G3]` |
| Motif library as active design constraint (ISC-generating lenses) | Theory_To_Architecture, Design Principle 5 `[G1, G2, G6]` |
| Reflect Operation 8 (process self-modeling) | Reflect_Operation8_Proposal `[G3]` |
| Reflector process-quality escalation path | Council_Redesign_TDS, Section 5.2 `[G2, G3]` |
| Sub-agents as DEFAULT strategy (not optional) | Observer-native CLAUDE.md governance |
| CLI-agnostic hook adapter (OILEventBridge pattern) | exit-011 |
| Sovereignty boundary formalised as structural hard stop | Observer Constitution P-AUTH-01, P-AGENT-01 |

### 1.6 The Control Plane (Existing Infrastructure)

The JSON-RPC control plane at localhost:9000 is complete — 427 tests passing, merged to master. It provides: session management, policy enforcement, audit logging, approval gateway, health monitoring, and backend dispatch.

Observer-native dispatches through it. This PRD does not re-specify the control plane. It is infrastructure that Observer-native uses.

`[Source: Control Plane PROJECT_STATE.md — Phase 1 build complete at e915fe2]`

---

## 2. Architecture Overview

Observer-native is a layered architecture. Each layer has a single responsibility and communicates through typed interfaces defined in S0.

```
┌─────────────────────────────────────────────────────────┐
│  Layer 7: Escalation Layer (S7)                         │
│  Sovereignty boundary — AI articulates, humans decide   │
├─────────────────────────────────────────────────────────┤
│  Layer 6: Sub-Agent Orchestration (S6)                  │
│  Fan-out, parallel build, merge, retry                  │
├─────────────────────────────────────────────────────────┤
│  Layer 5: ISC / PRD Pipeline (S5)                       │
│  Specification → decomposition → execution → verify     │
├─────────────────────────────────────────────────────────┤
│  Layer 4: Council Roles (S4)                            │
│  Perspective Agents, Triangulator, Sentry, Reflector,   │
│  Builder                                                │
├─────────────────────────────────────────────────────────┤
│  Layer 3: Cognitive Skills (S3)                         │
│  Oscillate, Converge, Reflect (with Op8)                │
├─────────────────────────────────────────────────────────┤
│  Layer 2: Memory Layer (S2)                             │
│  Cross-session persistence, vault integration           │
├─────────────────────────────────────────────────────────┤
│  Layer 1: Hook Adapter (S1)                             │
│  CLI bridge — the ONLY CLI-specific component           │
├─────────────────────────────────────────────────────────┤
│  Layer 0: Core Types & Interfaces (S0)                  │
│  Foundation — everything imports from here              │
├─────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────┐  │
│  │  Control Plane (localhost:9000) — EXISTING         │  │
│  │  Not part of this build — used as infrastructure   │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Design principle:** Each layer depends only on layers below it. S0 is the foundation. S1 is the only layer that knows about the specific CLI tool. Every other layer is CLI-agnostic.

`[Source: exit-011 — adapter pattern; PAI System Architecture — layered design; Theory_To_Architecture — cognitive layers]`

---

## 3. Component Specifications

### S0 — Core Types and Interfaces

**Purpose:** The foundation. Every other component imports from S0. No component defines its own types for cross-component communication — S0 is the single source of truth for shared types.

**Sub-agent strategy:** Sequential. S0 is a single coherent type system that must be internally consistent. One author.

#### 3.0.1 Hook Event Interface

The four Claude Code lifecycle events, abstracted behind Observer's own types so that swapping CLI means swapping the adapter only.

| Observer Event | Claude Code Source | Payload |
|---------------|-------------------|---------|
| `ObserverSessionStart` | `SessionStart` | Session ID, timestamp, working directory, git context |
| `ObserverPreToolUse` | `PreToolUse` | Tool name, parameters, session context |
| `ObserverPostToolUse` | `PostToolUse` | Tool name, result, duration, session context |
| `ObserverSessionStop` | `Stop` | Session ID, timestamp, summary, exit reason |

Each event type is an Observer-owned interface. The adapter (S1) translates from the CLI's native format into these types. All downstream consumers see only Observer events.

`[Source: exit-011 — OILEventBridge emits to Observer's own event types; PAI System Architecture — hook lifecycle]`

#### 3.0.2 ISC Schema

The typed structure for Ideal State Criteria:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | `ISC-{Domain}-{N}` or `ISC-C{N}` |
| `description` | string | 8-12 words, state not action, binary testable |
| `status` | enum | `pending`, `in_progress`, `passing`, `failing` |
| `verification_method` | enum | `CLI`, `Test`, `Static`, `Browser`, `Grep`, `Read`, `Custom` |
| `verification_command` | string | The specific check to run |
| `confidence_tag` | enum | `E` (explicit), `I` (inferred), `R` (reverse-engineered) |
| `priority` | enum | `CRITICAL`, `IMPORTANT`, `NICE` |
| `motif_source` | string? | Optional `Motif:` tag if criterion was generated from a motif lens |
| `evidence` | string? | Verification evidence when passing/failing |

#### 3.0.3 PRD Schema

The structure every PRD must conform to:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | `PRD-{YYYYMMDD}-{slug}` |
| `status` | enum | `DRAFT`, `CRITERIA_DEFINED`, `PLANNED`, `IN_PROGRESS`, `VERIFYING`, `COMPLETE`, `FAILED`, `BLOCKED` |
| `effort_level` | string | Effort tier |
| `created` / `updated` | date | Timestamps |
| `iteration` | number | Current iteration count |
| `slices` | Slice[] | Decomposed build slices |
| `isc_criteria` | ISC[] | All criteria |
| `context` | object | Problem space, key files, constraints, decisions |
| `plan` | string | Execution approach |
| `log` | LogEntry[] | Per-iteration log |

#### 3.0.4 Escalation Event Types

Two distinct escalation types with separate payloads:

**TaskFailureEscalation:**

| Field | Type | Description |
|-------|------|-------------|
| `type` | literal | `TASK_FAILURE` |
| `source` | string | Which Builder/slice failed |
| `failure_evidence` | string | Logs, diffs, error output |
| `retry_count` | number | How many retries were attempted |
| `structural_diagnosis` | string | Council's classification (missing info, conflicting constraints, environmental failure, structural disharmony) |
| `impact` | string | What is blocked by this failure |

**ProcessQualityEscalation:**

| Field | Type | Description |
|-------|------|-------------|
| `type` | literal | `PROCESS_QUALITY` |
| `trigger` | enum | `RECURRING_BIAS`, `SYSTEMATIC_ABSENCE`, `CONVERGENCE_DEGRADATION`, `AXIS_IMBALANCE_PERSISTENCE` |
| `pattern_description` | string | What the Reflector detected |
| `span` | string[] | Which deliberations exhibit the pattern |
| `impact` | string | What the Council is systematically missing |
| `suggested_correction` | string? | Optional — Reflector may suggest but does not decide |

`[Source: Council_Redesign_TDS Section 5.1 (task failure), Section 5.2 (process quality)]`

#### 3.0.5 Sub-Agent Task Schema

How work is packaged for fan-out:

| Field | Type | Description |
|-------|------|-------------|
| `task_id` | string | Unique identifier |
| `slice_id` | string | Which PRD slice this belongs to |
| `description` | string | What the sub-agent must accomplish |
| `context` | string | Sufficient context for the sub-agent (not full session) |
| `isc_criteria` | ISC[] | Exit criteria — slice only closes when these pass |
| `dependencies` | string[] | Task IDs that must complete first |
| `timeout` | number | Maximum execution time in seconds |
| `retry_budget` | number | Maximum retries on failure |

#### 3.0.6 Motif Reference Schema

How a motif is cited in an ISC criterion:

| Field | Type | Description |
|-------|------|-------------|
| `motif_name` | string | e.g., "Dual-Speed Governance" |
| `motif_tier` | number | 0, 1, or 2 |
| `primary_axis` | enum | `differentiate`, `integrate`, `recurse` |
| `derivative_order` | number | Structural depth indicator |
| `generating_question` | string | The lens question that produced the ISC criterion |

`[Source: Theory_To_Architecture Section 3.2 — motifs as ISC-generating lenses]`

#### S0 ISC Exit Criteria

1. All six type definitions are present and internally consistent
2. Hook event interface abstracts all four CLI lifecycle events
3. ISC schema includes motif_source field for motif-lens traceability
4. PRD schema includes slices array for decomposition support
5. Two distinct escalation types have non-overlapping payloads
6. Sub-agent task schema includes ISC criteria as exit conditions
7. Motif reference schema includes axis and derivative order fields
8. No type definition imports from or references PAI source paths

---

### S1 — Hook Adapter (CLI Bridge)

**Purpose:** The ONLY component that knows about Claude Code's specifics. Translates CLI-native events into Observer's internal event types (S0). Swapping to a different CLI means writing a new adapter — nothing else changes.

**Sub-agent strategy:** Sequential. S1 is a single file with a single responsibility. One author.

**Based on:** exit-011's OILEventBridge pattern — Observer-owned hook file, fail-silent, NDJSON event bus.

`[Source: exit-011 — Option B (Hook Adapter); PAI Runtime Layout — hook lifecycle]`

#### 3.1.1 Design

The adapter is an Observer-owned hook file that:

1. **Registers** for Claude Code's four hook events (SessionStart, PreToolUse, PostToolUse, Stop) via `settings.json` hook entries
2. **Translates** each Claude Code event into the corresponding Observer event type (S0 Section 3.0.1)
3. **Emits** translated events to Observer's event bus (NDJSON stream file)
4. **Fails silently** — adapter errors NEVER break the underlying CLI session. All operations are wrapped in try/catch with silent fallback
5. **Is the ONLY file** that imports or references Claude Code's hook interface, data structures, or execution model

#### 3.1.2 Adapter Interface Contract

Any CLI adapter must implement:

| Method | Input | Output | Description |
|--------|-------|--------|-------------|
| `translateEvent` | CLI-native event | `ObserverEvent` (S0) | Convert CLI event to Observer type |
| `registerHooks` | CLI configuration mechanism | void | Register for all relevant lifecycle events |
| `getEventStream` | void | NDJSON file path | Where translated events are written |

#### 3.1.3 Claude Code Adapter (First Implementation)

- **Location:** Single file in Observer-native's hook directory
- **Registration:** `settings.json` hook entries for all four event types
- **Event bus:** NDJSON stream at a configurable path (default: `{workspace}/tmp/events.ndjson`)
- **Zero imports from PAI:** No `hooks/lib/*` imports, no PAI internal module references
- **Writes only to Observer workspace:** Never touches PAI state files

#### 3.1.4 Swapping to a Different CLI

To support a new CLI (e.g., OpenCode, Gemini CLI):

1. Write a new adapter file implementing the adapter interface contract
2. Map the new CLI's lifecycle events to Observer's four event types
3. Register hooks using the new CLI's configuration mechanism
4. No other component in Observer-native needs to change

`[Source: exit-011 — "Swapping to OpenCode means writing a new adapter, nothing else changes"]`

#### S1 ISC Exit Criteria

1. Adapter registers for all four Claude Code hook events
2. Each CLI event translates to the corresponding Observer event type from S0
3. Translated events emit to NDJSON stream at configured path
4. Adapter failure does not break the underlying CLI session
5. No imports from PAI internal modules exist in adapter code
6. Adapter interface contract is defined such that a second CLI adapter can implement it
7. Event stream is readable by all downstream Observer components
8. Adapter is a single file with no dependencies on other S1+ components

---

### S2 — Memory System

**Purpose:** Cross-session persistence. Captures what happens in each session and makes it available to future sessions. Integrates with the observer-vault's established structure, NOT PAI's MEMORY/ directory.

**Sub-agent strategy:** Sequential. Memory system design requires coherent integration with the existing vault structure. One author.

`[Source: Theory_To_Architecture Section 2.3 — framework delta mechanism; PAI System Architecture — memory founding principle 13]`

#### 3.2.1 Session Capture

What gets recorded per session:

| Capture | Format | Storage Location |
|---------|--------|-----------------|
| Session metadata | JSONL entry | `03-Daily/{YYYY-MM-DD}/sessions.jsonl` |
| ISC criteria and outcomes | PRD file (ISC section) | `.prd/` in working project |
| Deliberation receipts | Structured markdown | `receipts/` in working project |
| Motif candidates (from Reflect) | Motif entry markdown | `02-Knowledge/motifs/` in vault |
| Framework delta (from Reflect Op8) | Delta record | `02-Knowledge/framework/deltas/` in vault |
| Decisions made | Decision record | Working project `decisions/` or vault `01-Projects/` |

#### 3.2.2 Vault Integration

Observer-native writes to the vault's established structure:

| Vault Directory | What Observer-Native Writes | Authority |
|----------------|---------------------------|-----------|
| `00-Inbox/` | New documents, drafts — auto-approved for creation | Atlas can create |
| `01-Projects/{project}/` | PRDs, receipts, decisions, project state | Atlas can update draft/inbox status |
| `02-Knowledge/motifs/` | Motif candidates from Reflect | Atlas can create Tier 0 entries |
| `02-Knowledge/framework/` | Framework deltas from Op8 | Atlas can create |
| `03-Daily/` | Session logs | Atlas can create |

**Rule:** Atlas creates in `00-Inbox/` (auto-approved) and updates `draft`/`inbox` status documents. Promotion to `canonical` requires Adam's explicit approval.

`[Source: Observer-vault CLAUDE.md — vault write rules]`

#### 3.2.3 Context Hydration

How prior sessions inform the current session at startup:

1. **Read project state:** `.prd/` directory for active PRDs, `PROJECT_STATE.md` for build status
2. **Read recent sessions:** Last 3 session entries from `03-Daily/` for continuity
3. **Read framework deltas:** Most recent delta from `02-Knowledge/framework/deltas/` to seed this session's observation frame
4. **Read active motifs:** Current motif library state from `02-Knowledge/motifs/` for motif-lens ISC generation
5. **Load prior Reflect output:** If the last session included a Reflect phase, its output feeds this session's Oscillate as seed material

#### 3.2.4 Framework Delta Mechanism

From Reflect Operation 8: each session updates the observation framework for the next.

| Delta Component | Description | Updated By |
|----------------|-------------|-----------|
| `transfer_function_summary` | What the session's convergence filter selected for/against | Reflector (Op8) |
| `independence_score` | How independent were the session's perspectives | Reflector (Op8) |
| `axis_balance_report` | D/I/R distribution of session outputs | Reflector (Op8) |
| `new_lenses` | New observation lenses discovered | Reflector (Op8) |
| `shifted_assumptions` | Assumptions that were modified by this session | Reflector (Op8) |

The delta is stored as a dated file. The next session's context hydration (Step 3 above) reads the most recent delta to adjust its starting observation frame.

`[Source: Reflect_Operation8_Proposal — Operation 8 outputs; Theory_To_Architecture Section 2.3]`

#### S2 ISC Exit Criteria

1. Session metadata captured as JSONL entry in vault daily directory
2. Context hydration reads project state and recent sessions at startup
3. Framework delta mechanism stores and retrieves observation frame changes
4. Vault integration respects established directory structure and write rules
5. Memory system does not reference or use PAI's MEMORY/ directory
6. Motif candidates from Reflect are written to vault motifs directory
7. Prior Reflect output is available to seed next session's Oscillate
8. Session capture includes ISC outcomes for hill-climbing visibility

---

### S3 — Cognitive Skills

**Purpose:** The three triad skills as Observer-native components. These form the cognitive sequence that the Council executes: Oscillate (differentiate), Converge (integrate), Reflect (recurse).

**Sub-agent strategy:** Skill definition is sequential (one coherent design). Skill EXECUTION uses sub-agents as specified per skill below.

`[Source: Theory_To_Architecture Section 1.2 — triad as cognitive architecture; Council_Redesign_TDS Section 3]`

#### 3.3.1 OscillateAndGenerate

**Existing:** The OscillateAndGenerate skill exists in PAI. Observer-native formalises it as an Observer-owned component.

**Function:** Generate structurally independent perspectives on a problem. Multiple agents produce framings from different vantage points.

**Sub-agent policy: MUST fan out to sub-agents.** Each perspective is generated by a separate sub-agent in isolation. Perspectives that share assumptions are partially redundant and reduce signal extraction quality.

`[Source: G1 — redundancy across independent measurements separates signal from noise]`

**Execution model:**
- Spawn 2-4 Perspective Agent sub-agents (count based on problem complexity)
- Each agent receives a different lens assignment (domain, stakeholder, time horizon, abstraction level)
- Agents operate in isolation — they do NOT see each other's output during generation
- Independence check runs after all agents complete: compare foundational assumptions across agent pairs
- Output: 2-4 independent framing documents + independence check result

**Inputs:** Problem statement, lens assignments, prior Reflect output (seed material from previous session)

**Outputs:** Framing documents (one per perspective), independence check result, redundancy flags (if any)

#### 3.3.2 ConvergeAndEvaluate

**Existing:** The ConvergeAndEvaluate skill exists in PAI. Observer-native formalises it as an Observer-owned component.

**Function:** Find what survives triangulation across perspectives. Kill what doesn't. Produce the structural invariant.

**Sub-agent policy: Single-thread.** Convergence is synthesis — it requires a single coherent reasoning thread to detect structural invariants across all perspectives simultaneously.

`[Source: G1 — the mechanism by which signal separates from noise requires seeing all measurements at once]`

**Execution model:**
- Single agent reads ALL Oscillate outputs simultaneously
- Identifies convergent items (appear in 2+ independent framings)
- Produces kill list (items that failed cross-framing — MUST be non-empty with 3+ perspectives)
- Sentry applies adversarial pressure on the converged output
- Output: structural invariant + kill list + perspective-specific items + convergence quality score + Sentry flags

**Inputs:** All Oscillate framing documents, independence check result

**Outputs:** Structural invariant, kill list with reasons, perspective-specific items, convergence quality score, Sentry adversarial flags

#### 3.3.3 Reflect (with Operation 8)

**Existing:** The Reflect skill exists in PAI with Operations 5 (Recognition), 6 (Motif Extraction), 7 (Motif-of-Motif Detection). Observer-native adds Operation 8 (Process Reflection).

**Function:** Examine the deliberation itself. What did the system learn about its own process?

**Sub-agent policy: Single-thread.** Reflection requires a single coherent reasoning thread that examines the entire deliberation process holistically.

`[Source: G3 — recursive self-modeling produces categorically new information]`

**Operations:**

| Operation | Function | Input | Output |
|-----------|----------|-------|--------|
| Op 5: Recognition | "What shape is this?" | Session content | Shape recognition |
| Op 6: Motif Extraction | Domain-independent structural patterns | Session content | Motif candidates (content) |
| Op 7: Motif-of-Motif | Higher-order patterns (gated to Tier 2+) | Op 6 output | Meta-motif candidates |
| **Op 8: Process Reflection** | **"What shaped my seeing?"** | **Oscillate + Converge + Ops 5-7 output + motif library state** | **Transfer function summary, independence score, axis balance report, framework delta, process motif candidates** |

**Operation 8 gate:** Runs ONLY when the full triad (Oscillate + Converge + Reflect Ops 5-7) has been executed in the session. If standalone reflection without preceding triad, Op 8 is skipped.

`[Source: Reflect_Operation8_Proposal — Operation 8 specification]`

**Op 8 process:**
1. **Transfer function analysis:** What did the convergence filter pass and reject? Systematic blind spots?
2. **Independence audit:** Were perspectives genuinely independent? Shared unstated assumptions?
3. **Axis balance check:** D/I/R distribution of session's motif outputs. Flag imbalance if no recurse content.
4. **Observation perturbation accounting:** How did this session change the observation framework?

`[Source: Theory_To_Architecture Section 2.3 — the gap; G2 — observation modifies the observer's frame; G5 — recursion axis underpopulated]`

#### 3.3.4 Triad Closed Loop

The triad is a closed loop, not a pipeline:

```
Oscillate ──→ Converge ──→ Reflect
    ↑                          │
    └──── seed material ───────┘
```

Reflect output (framework delta, motif candidates, process observations) feeds the next cycle's Oscillate phase as seed material for lens assignment and perspective generation. Without this feedback, Reflect is a dead end — observed but not integrated.

`[Source: Theory_To_Architecture Design Principle 3; Council_Redesign_TDS REQ-R2]`

#### S3 ISC Exit Criteria

1. OscillateAndGenerate fans out to 2-4 sub-agents in isolation
2. Independence check compares foundational assumptions across agent pairs
3. ConvergeAndEvaluate runs as single-thread synthesis not fan-out
4. Convergence produces non-empty kill list with three-plus perspectives
5. Reflect includes all four operations including Operation 8
6. Operation 8 runs only after full triad completion as gate condition
7. Operation 8 produces all five specified outputs per session
8. Reflect output feeds next Oscillate cycle as seed material
9. Axis balance check flags sessions with zero recurse-axis output

---

### S4 — Council Roles

**Purpose:** The five roles from the Council Redesign TDS. These are the agents that execute the cognitive triad.

**Sub-agent strategy:** Role DEFINITION is sequential (coherent design). Role EXECUTION uses sub-agents for Perspective Agents and Builder, single-thread for Triangulator, Sentry, and Reflector.

`[Source: Council_Redesign_TDS Section 2 — role definitions; Theory_To_Architecture Section 1.3 — role mapping]`

#### 3.4.1 Perspective Agents (Oscillate Phase)

| Attribute | Value |
|-----------|-------|
| **Phase** | Oscillate |
| **Count** | 2-4 per deliberation |
| **Sub-agents** | Yes — each is a separate sub-agent |
| **Isolation** | Agents do NOT see each other's output during Oscillate |
| **Output** | Framing document: restatement, constraints, risks, approach, explicit foundational assumptions |
| **Current equivalent** | Partially the former Architect role (technical lens only) |

**Lens types** (not exhaustive): technical feasibility, user impact, security/adversarial, operational/maintenance, temporal (short-term vs. long-term), domain-specific expertise.

**Count selection:**
- Simple/well-defined problem: 2 agents
- Multi-faceted problem: 3 agents
- High-stakes or cross-domain problem: 4 agents

`[Source: Council_Redesign_TDS Section 2.2]`

#### 3.4.2 Triangulator (Converge Phase)

| Attribute | Value |
|-----------|-------|
| **Phase** | Converge |
| **Count** | 1 |
| **Sub-agents** | No — single-thread synthesis |
| **Input** | All Oscillate framing documents |
| **Output** | Structural invariant, kill list, perspective-specific items, convergence quality score |
| **Current equivalent** | No equivalent (convergence was implicit) |

**Constraint:** Convergence without rejection is collection, not triangulation. The kill list MUST be non-empty for any deliberation with 3+ perspectives.

`[Source: Council_Redesign_TDS Section 2.3; G1 — signal from independent measurements]`

#### 3.4.3 Sentry (Converge Phase — Preserved)

| Attribute | Value |
|-----------|-------|
| **Phase** | Converge |
| **Count** | 1 |
| **Sub-agents** | No — single-thread adversarial |
| **Input** | Triangulator's structural invariant + perspective-specific items |
| **Output** | Stress-tested invariant, Sentry flags, unresolved risks |
| **Current equivalent** | Sentry (preserved) |

**Change from current:** The Sentry now operates on the Triangulator's structural invariant rather than on an Architect's plan directly. The adversarial function is unchanged.

`[Source: Council_Redesign_TDS Section 2.4; Observer Constitution — Sentry role]`

#### 3.4.4 Reflector (Reflect Phase — Mandatory)

| Attribute | Value |
|-----------|-------|
| **Phase** | Reflect |
| **Count** | 1 |
| **Sub-agents** | No — single-thread reflective |
| **Authority** | Observation responsibility ONLY. No decision authority. Cannot override Triangulator or Sentry. |
| **Input** | ALL prior phase outputs |
| **Required outputs** | Process observation, assumption inventory, motif candidates, framework delta |
| **Minimum output floor** | M/2 pages where M = Converge output page count |
| **Current equivalent** | No equivalent |

**Why mandatory:** Without a Reflector, the Council produces differentiated and integrated output but never recurses on its own process. This reproduces recursion axis starvation (1 of 10 motifs on recurse axis in current library).

**Escalation authority:** The Reflector can escalate process-quality concerns to Human (S7, Section 3.7.2). This is independent of task-failure escalation.

`[Source: Council_Redesign_TDS Section 2.5, REQ-R1 through REQ-R4; G3, G5]`

#### 3.4.5 Builder (Post-Triad Execution — Preserved)

| Attribute | Value |
|-----------|-------|
| **Phase** | Post-triad execution |
| **Count** | 1 (may fan out to sub-agents for parallel work packets) |
| **Sub-agents** | Yes — for parallel work packets via S6 |
| **Input** | Work packet with triad receipts |
| **Output** | Built artifacts, proof gate results, receipts |
| **Current equivalent** | Builder (preserved) |

**Work packet contents (updated):**
- Scope, constraints, success criteria, acceptance tests (existing)
- Structural invariant from Triangulator (new)
- Sentry flags and unresolved concerns (existing, now post-convergence)
- Reflect observations and framework delta (new — informational, not binding)
- Paths / environment context (existing)

`[Source: council-builder-escalation-loop — existing loop preserved; Council_Redesign_TDS Section 2.6]`

#### 3.4.6 Deliberation Sequence

The full sequence is specified in Council_Redesign_TDS Section 3 (Steps 1-9). Observer-native implements that sequence verbatim. Key additions over the TDS:

- Step 9 (Feedback Loop) is enforced by S2's framework delta mechanism
- Step 8 (Reflector Escalation) dispatches through S7's process-quality escalation path
- Step 6 (Execute) uses S6's sub-agent orchestration for parallel work packets

#### S4 ISC Exit Criteria

1. All five Council roles are defined with correct phase assignments
2. Perspective Agents operate in isolation during Oscillate phase
3. Triangulator produces structural invariant with kill list requirement
4. Sentry applies adversarial pressure on converged output not raw perspectives
5. Reflector is structurally mandatory not optional in deliberation sequence
6. Reflector has observation responsibility only with no decision authority
7. Reflector minimum output floor enforced at M/2 pages of Converge output
8. Builder work packet includes triad receipts from all three phases
9. Perspective Agent count scales with problem complexity between 2-4

---

### S5 — ISC and PRD Pipeline

**Purpose:** The specification-to-execution pipeline. How problems become PRDs, how PRDs decompose into slices, and how slices fan out to sub-agents.

**Sub-agent strategy:** Pipeline DESIGN is sequential. Pipeline EXECUTION uses sub-agents for parallel slice building via S6.

`[Source: PAI System Architecture — PRD pipeline pattern; Theory_To_Architecture Section 3 — motif application protocol]`

#### 3.5.1 PRD Creation

PRDs are created during the planning phase of a task. The process is whole-to-parts with human involvement:

1. **Problem arrives** — human provides intent, context, constraints
2. **ISC creation** — Observer creates Ideal State Criteria from reverse engineering the request
3. **PRD assembly** — Criteria, context, plan, and metadata written to PRD file
4. **Human review** — PRD is DRAFT until human approves
5. **Approval** — Human sets status to PLANNED, build may begin

#### 3.5.2 PRD Slice Decomposition

How a PRD is broken into parallel build slices:

1. **Dependency analysis** — identify which ISC criteria are independent of each other
2. **Slice grouping** — group independent criteria into slices (one concern per slice)
3. **Dependency graph** — order slices by dependency (e.g., S0 before S1-S4)
4. **ISC assignment** — each slice carries its own ISC exit criteria
5. **Fan-out readiness** — each slice is packaged as a Sub-Agent Task (S0 Section 3.0.5)

#### 3.5.3 Slice Dependency Graph Pattern

```
Foundation slice(s) — no dependencies
    ↓
Parallel slice group — depend on foundation, not on each other
    ↓
Integration slice(s) — depend on parallel group
    ↓
Smoke test — depends on integration
```

This pattern repeats at every scale. The Observer-native build itself follows this pattern (see Section 4, Build Order).

#### 3.5.4 Fan-Out to Sub-Agents

Each slice is dispatched to a sub-agent via S6:

- One sub-agent per slice (or multiple per slice for large slices)
- Each sub-agent receives: slice PRD, ISC exit criteria, context sufficient for independent work
- Sub-agent runs the algorithm loop against its slice's ISC
- Slice closes ONLY when its ISC criteria pass

#### 3.5.5 Merge and Integration

How slice outputs are combined:

1. **Collect** — S6 collects all sub-agent outputs
2. **Conflict check** — detect overlapping file modifications or type conflicts
3. **Merge** — apply non-conflicting outputs
4. **Conflict resolution** — conflicting outputs escalate to Council re-entry (see S6 merge protocol)
5. **Integration test** — run integration ISC criteria against the merged output

#### 3.5.6 Motif Application Protocol

From Theory_To_Architecture Section 3: motifs as ISC-generating lenses.

**Step 1: Motif Selection (during OBSERVE or THINK phase)**

When creating ISC for a PRD, query the motif library for relevant motifs:
- Check all Tier 2 motifs (highest structural depth)
- Check Tier 1 motifs when the problem's domain matches a known instance
- Output: 0-3 applicable motifs per PRD

**Step 2: Lens Application (during ISC creation)**

For each selected motif, ask: "If this motif's structural pattern is active in this design, what additional conditions must hold?" Each answer becomes an ISC criterion with the motif cited as source.

PRD format — motif-sourced criteria carry a tag:

```
- [ ] ISC-C12: Rate limit thresholds modifiable without service restart | Verify: CLI | Motif: Dual-Speed Governance
```

The `Motif:` tag traces the criterion to its generating motif. Criteria without motif tags come from the problem's native framing.

**Step 3: Axis Coverage Check (during THINK pressure test)**

After ISC creation, check the axis distribution of motif-sourced criteria:
- Do any criteria exercise the recurse axis?
- If all motif-sourced criteria are differentiate or integrate, consider whether a recurse-axis motif applies

`[Source: Theory_To_Architecture Design Principle 5 — G1, G2, G6; Section 3.3 — concrete mechanism]`

#### S5 ISC Exit Criteria

1. PRD creation follows whole-to-parts process with human review gate
2. Slice decomposition produces dependency graph before fan-out
3. Each slice carries its own ISC exit criteria as acceptance tests
4. Fan-out packages slices as Sub-Agent Tasks per S0 schema
5. Merge process detects overlapping modifications before applying
6. Motif application protocol generates criteria with Motif tag format
7. Axis coverage check flags ISC sets with no recurse-axis criteria
8. PRD status progression follows defined lifecycle states from S0

---

### S6 — Sub-Agent Orchestration

**Purpose:** The component that makes parallelism work. Manages dispatch, collection, merge, retry, and escalation for sub-agent work.

**Sub-agent strategy:** Orchestrator DESIGN is sequential. Orchestrator EXECUTION is the sub-agent system itself.

**DEFAULT RULE (CRITICAL):** If work can be parallelised, it MUST be. The orchestrator rejects sequential execution of parallelisable work. This is a policy enforcement, not a suggestion.

`[Source: Observer-native CLAUDE.md — "Sequential execution of parallelisable work is a policy violation"]`

#### 3.6.1 Dispatch

How tasks are dispatched to sub-agents:

1. **Receive** task batch from S5 (sliced PRD) or direct submission
2. **Parallelisability check** — are tasks independent? If YES → fan out. If sequential → execute in order with explicit justification.
3. **Rejection gate** — if tasks are parallelisable but submitted as sequential, the orchestrator REJECTS with explanation: "These tasks have no dependencies and must be executed in parallel."
4. **Context budget** — each sub-agent receives sufficient context for its task but NOT the full session context. Context is scoped to: task description, relevant ISC, key file paths, and architectural constraints.
5. **Spawn** — dispatch sub-agents with timeout and retry budget from Sub-Agent Task schema (S0)

#### 3.6.2 Collection and Validation

How sub-agent outputs are collected:

1. **Wait** for all sub-agents in a parallel batch to complete (or timeout)
2. **Validate** each output against its ISC exit criteria
3. **Classify** each output as: PASSING (all ISC met), FAILING (ISC not met), TIMED_OUT (exceeded timeout)
4. **Report** aggregate status: N passing, M failing, K timed out

#### 3.6.3 Merge Protocol

Conflict resolution when sub-agents produce overlapping outputs:

| Conflict Type | Resolution |
|---------------|-----------|
| **No overlap** | Apply all outputs directly |
| **File-level overlap, compatible changes** | Merge automatically (e.g., different functions in same file) |
| **File-level overlap, incompatible changes** | Escalate to Council re-entry — do not auto-resolve |
| **Type-level conflict (S0 schema disagreement)** | Escalate to Council re-entry — S0 is the single source of truth |
| **ISC conflict (criteria contradiction)** | Escalate to human — contradictory criteria indicate a specification problem |

#### 3.6.4 Retry Policy

When a sub-agent fails its ISC:

1. **First retry** — same sub-agent, same context, failure evidence appended
2. **Second retry** — same sub-agent, expanded context (include related slice outputs if available)
3. **Third retry** — escalate to Council re-entry with logs, diffs, failure analysis
4. **Council re-entry** — structural diagnosis (missing info, conflicting constraints, environmental failure)
5. **If Council cannot resolve** — escalate to human (S7)

Maximum retry budget is configurable per task (default: 3).

#### 3.6.5 Escalation Trigger

Sub-agent failures escalate to Council re-entry when:
- Retry budget exhausted for any sub-agent
- Merge conflicts that cannot be auto-resolved
- More than 50% of parallel batch failing simultaneously (indicates systemic issue, not per-task failure)

#### 3.6.6 Context Budgeting

Each sub-agent gets:
- Its task description and ISC criteria (always)
- The PRD's CONTEXT section (key files, constraints, decisions)
- S0 type definitions relevant to its task
- File contents for files it will modify (read before write)
- NOT the full session transcript
- NOT other sub-agents' work-in-progress

#### S6 ISC Exit Criteria

1. Orchestrator rejects sequential submission of parallelisable tasks with explanation
2. Dispatch includes parallelisability check before fan-out decision
3. Collection validates each sub-agent output against its ISC exit criteria
4. Merge protocol escalates incompatible file-level overlaps to Council
5. Retry policy allows maximum three retries before Council escalation
6. Context budgeting scopes sub-agent context to task not full session
7. Escalation triggers on retry exhaustion and systemic batch failure
8. The DEFAULT RULE is enforced: parallelisable work uses sub-agents

---

### S7 — Escalation Layer

**Purpose:** The sovereignty boundary — where AI stops and human decides. "AI articulates, humans decide" is not a guideline — it is a hard stop in this layer.

**Sub-agent strategy:** Sequential. Escalation is a single coherent decision path. One author.

`[Source: Observer Constitution P-AUTH-01, P-AGENT-01; Council_Redesign_TDS Section 5; council-builder-escalation-loop]`

#### 3.7.1 Task Failure Escalation (Preserved)

This path is preserved from the existing council-builder escalation loop:

```
Builder fails proof gates
    ↓
Builder retries (bounded, max N per S6 retry policy)
    ↓
Still failing → Builder escalates to Council with:
  - failure evidence (logs, diffs, error output)
  - retry count
  - failure analysis
    ↓
Council performs structural diagnosis:
  - Missing information?
  - Conflicting constraints?
  - Environmental failure?
  - Structural disharmony?
    ↓
If resolvable → Council updates work packet, Builder retries
If not resolvable → Council escalates to Human
```

**Escalation payload:** TaskFailureEscalation (S0 Section 3.0.4)

**Human gate:** Escalation BLOCKS execution until human responds. The system does not proceed without human resolution.

**Resolution paths:**
- Human provides missing information
- Human adjusts constraint
- Human approves retry with guidance
- Human takes over directly

`[Source: council-builder-escalation-loop — full loop specification]`

#### 3.7.2 Process Quality Escalation (New)

This is a NEW escalation path from the Council Redesign TDS. It runs in parallel with task failure escalation and is independent of it.

**Source:** The Reflector role (S4). Only the Reflector can trigger this path.

**Trigger conditions (any one sufficient):**

| Trigger | Condition |
|---------|-----------|
| `RECURRING_BIAS` | Same assumption in 3+ consecutive deliberations without explicit lens assignment |
| `SYSTEMATIC_ABSENCE` | A domain or stakeholder absent from Oscillate for 3+ consecutive deliberations |
| `CONVERGENCE_DEGRADATION` | Independence check flags redundancy in 3+ consecutive deliberations |
| `AXIS_IMBALANCE_PERSISTENCE` | Same D/I/R imbalance pattern across 3+ consecutive deliberations |

**Escalation payload:** ProcessQualityEscalation (S0 Section 3.0.4)

**Human gate:** Escalation BLOCKS further deliberation until human responds. This is a hard stop — the system does not dismiss process-quality concerns autonomously.

**Resolution paths:**
- Human adjusts lens assignment defaults
- Human adds a required perspective type
- Human modifies independence check criteria
- Human acknowledges and dismisses (with reason recorded)

**Relationship to P-AUTH-01:** The Reflector escalation is consistent with "AI articulates, humans decide." The Reflector articulates a process observation. The human decides whether to act.

`[Source: Council_Redesign_TDS Section 5.2; G2 — observation modifies observer; G3 — recursive self-modeling]`

#### 3.7.3 Constitutional Principle

The sovereignty boundary is formalised as a structural hard stop:

- **AI articulates:** The system produces analysis, options, recommendations, and evidence. It does not make decisions that affect scope, governance, or authority.
- **Humans decide:** Adam is Level 1 authority (P-AUTH-01). All escalation paths terminate at human decision. The system cannot override, dismiss, or bypass human gates.
- **Hard stop:** This is enforced by the escalation layer's architecture, not by a prompt. Escalation events are typed (S0), payloads are structured, and resolution requires human input before execution resumes.

`[Source: Observer Constitution P-AUTH-01 through P-AUTH-09; P-AGENT-01]`

#### S7 ISC Exit Criteria

1. Task failure escalation follows the preserved council-builder escalation loop
2. Process quality escalation triggers on any of four specified conditions
3. Both escalation types use typed payloads from S0 event types
4. Human gate blocks execution until human responds for both paths
5. Reflector is the only role that can trigger process quality escalation
6. Escalation payloads include evidence, impact, and suggested correction
7. Resolution paths are enumerated for both escalation types
8. The sovereignty principle is a structural hard stop not a guideline

---

## 4. Build Order

```
S0 (Core Types — foundation, everything imports from here)
    ↓
S1 + S2 + S3 + S4 (parallel — all depend on S0, not on each other)
    ↓
S5 + S6 (parallel — depend on S0-S4 for type usage and role definitions)
    ↓
S7 (depends on S5+S6 for escalation event types in active use)
    ↓
Integration + smoke test
```

**Sub-agent strategy for build:**

| Phase | Slices | Strategy | Reason |
|-------|--------|----------|--------|
| Phase 1 | S0 | Sequential, single agent | Foundation must be internally consistent |
| Phase 2 | S1, S2, S3, S4 | Parallel, 4 sub-agents | No dependencies between slices |
| Phase 3 | S5, S6 | Parallel, 2 sub-agents | No dependencies between slices |
| Phase 4 | S7 | Sequential, single agent | Must reference S5+S6 escalation patterns |
| Phase 5 | Integration | Sequential, single agent | Cross-component verification |

---

## 5. Integration ISC

These criteria verify the full system works end-to-end. All must pass before Observer-native is considered operational.

1. A full triad session completes: Oscillate with sub-agents, then Converge, then Reflect with Op8
2. Reflect output is stored in vault and available to next session's Oscillate as seed material
3. A PRD is created, sliced into parallel work packages, and fanned out to sub-agents
4. Sub-agent outputs are merged without conflict (or conflicts are escalated correctly)
5. A task failure escalation reaches human and blocks execution until human responds
6. A process quality escalation reaches human via Reflector path and blocks until resolved
7. Hook adapter receives a Claude Code event and translates it to Observer's internal type
8. Swapping the hook adapter does not require changes to any other component
9. The motif application protocol generates at least one motif-sourced ISC criterion in a PRD
10. Sub-agent default policy is enforced: a parallelisable task submitted as sequential is rejected with explanation

---

## 6. Deployment Notes

- **First CLI:** Claude Code (S1's first adapter implementation)
- **Control plane:** localhost:9000, assumed running (see control-plane PROJECT_STATE.md)
- **No new infrastructure** required beyond what is already built
- **Working directory:** `/home/adam/vault/workspaces/observer/observer-native/` (already scaffolded)
- **Source code location:** `src/` within the working directory
- **Language:** TypeScript
- **Runtime:** Bun (consistent with existing Observer stack)
- **Testing:** Vitest or Bun's built-in test runner

---

## 7. Deferred Items

These items are acknowledged but not specified in this PRD. They will be addressed in subsequent PRDs or sessions:

| Item | Reason Deferred |
|------|----------------|
| Voice system integration | Keep simple — basic TTS notification, not PAI's full personality/trait system |
| WebSocket transport for control plane | Phase 2 of control plane |
| Telegram client integration | Phase 2 of control plane |
| Bubblewrap sandboxing | Phase 2 of control plane |
| Multi-CLI adapter testing | Only Claude Code adapter built first; others when CLI tools are adopted |
| Motif library formal validation (Prediction 3 test) | Theory_To_Architecture Section 4.2 — separate effort |
| Dashboard / monitoring UI | Not specified, build if needed |
| Speculative-tier design principles (CFT, p-adic, category theory) | Theory_To_Architecture Section 5 — set aside pending formal validation |

---

## 8. Traceability Index

Every design decision in this PRD traces to a source:

| Component | Primary Sources |
|-----------|----------------|
| S0 Core Types | All component specs (aggregate), S0 types serve all consumers |
| S1 Hook Adapter | exit-011 PAI Decoupling Decision, OILEventBridge pattern |
| S2 Memory System | Theory_To_Architecture Section 2.3, Reflect_Op8_Proposal, vault CLAUDE.md |
| S3 Cognitive Skills | Theory_To_Architecture Design Principles 1-4, Council_Redesign_TDS Section 3 |
| S4 Council Roles | Council_Redesign_TDS Section 2, Observer Constitution P-AUTH-01 |
| S5 ISC/PRD Pipeline | PAI System Architecture (PRD pattern), Theory_To_Architecture Section 3 (motifs) |
| S6 Sub-Agent Orchestration | Observer-native CLAUDE.md (sub-agent default policy), PAI Agent System (patterns) |
| S7 Escalation Layer | council-builder-escalation-loop, Council_Redesign_TDS Section 5, Constitution P-AUTH-01/P-AGENT-01 |
| Build Order | Prompt specification, control-plane build pattern |
| Integration ISC | Prompt specification (10 criteria verbatim) |

---

## DECISIONS

(To be populated during build phase)

---

## LOG

### PRD Creation — 2026-03-06
- Phase reached: PRD written
- Criteria progress: 0/0 (pre-build)
- Work done: Full system PRD from 12 reference documents
- Context for next session: Adam reviews PRD, approves or requests changes before build begins
