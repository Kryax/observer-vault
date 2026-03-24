---
prd: true
id: PRD-20260324-rivers
status: DRAFT
mode: design
effort_level: Advanced
created: 2026-03-24
updated: 2026-03-24
iteration: 1
maxIterations: 128
loopStatus: null
last_phase: PLAN
failing_criteria: []
verification_summary: "0/0"
parent: null
children: []
authority: low
domain: [observer-native, rivers, dual-stream, architecture]
method: D/I/R design pass (Atlas)
motifs:
  - dual-speed-governance
  - explicit-state-machine-backbone
  - composable-plugin-architecture
  - bounded-buffer-with-overflow-policy
  - reconstruction-burden
  - observer-feedback-loop
  - hidden-structure-surface-form-separation
  - progressive-formalization
  - ratchet-with-asymmetric-friction
  - idempotent-state-convergence
refs:
  - 01-Projects/observer-native/docs/PRD-rivers-dual-stream-20260324.md
  - 01-Projects/observer-native/docs/observer-v3-dir-process-contract-20260319.md
  - 02-Knowledge/architecture/dual-stream-dir-analysis-20260324.md
  - 02-Knowledge/architecture/Theory_To_Architecture_20260305.md
  - 01-Projects/observer-native/docs/four_pillars_design_memo.md
  - 01-Projects/dataset-processor/docs/PRD-dataset-processor-20260323.md
  - 02-Knowledge/motifs/MOTIF_INDEX.md
provenance: >
  Formal PRD produced by Atlas on 2026-03-24 via D/I/R design pass.
  Takes Claude's design brief (PRD-rivers-dual-stream-20260324.md) as input,
  challenges and extends it against the full architectural context.
  Adam holds sovereignty over all design decisions.
---

# Rivers PRD — Dual-Stream Cognitive Circulation

## STATUS

| What | State |
|------|-------|
| Progress | 0/0 criteria passing |
| Phase | PLAN |
| Next action | Slice 1 implementation |
| Blocked by | Nothing |

---

## 1. Purpose

Rivers are Observer's circulatory system. They carry cognitive material between subsystems as typed, process-aware flows that make the system's thinking legible and governable.

The v3.0 process contract (2026-03-19) established that rivers should carry verb-typed process metadata. The dual-stream analysis (2026-03-24) elevated this: rivers carry **PairedRecords** — noun-verb pairs bound by source provenance — because process doesn't happen in a vacuum. A river carrying only "what happened" (verb) without "what it happened to" (noun) incurs reconstruction burden that makes downstream convergence detection structurally incomplete.

Rivers are not data pipes. They are the medium through which Observer observes itself.

---

## 2. Design Pass: Where Claude's Brief Is Correct, Where It Needs Correction

### 2.1 What the brief gets right

1. **PairedRecord as atomic unit** — correct. The brief correctly identifies the paired noun-verb record as the fundamental river payload. This aligns with Priority 1 from the dual-stream analysis.

2. **Three rivers mapping to D/I/R** — the three-river taxonomy (Intake/Processing/Reflection) is a sound organisational principle that maps naturally to Distinguish/Integrate/Recurse.

3. **Cross-river connections** — the brief correctly identifies four connection points (Intake→Processing, Processing→Reflection, Reflection→Intake, Reflection→Processing). These close the OFL feedback loop.

4. **Convergence detection** — the noun-stream, verb-stream, and cross-stream convergence taxonomy is correct and novel. This is the brief's strongest contribution.

5. **Motif predictions** — the motif prediction table is well-structured and testable.

### 2.2 Where the brief needs correction or extension

**Correction 1: Rivers are not D/I/R-exclusive.**

The brief states Intake is "primarily Distinguish," Processing is "primarily Integrate," Reflection is "primarily Recurse." This is too rigid. Every river performs all three D/I/R phases internally. Material entering the Processing river undergoes distinction (what state is it in?), integration (how does it relate to existing records?), and recursion (did the processing reveal something about the processing?). The D/I/R mapping describes the river's *dominant* function in the overall system, not its exclusive operation.

**Correction 2: PairedRecord schema is over-specified for Slice 1.**

The brief's PairedRecord schema (§3) has 20+ fields including `alignment.confidence`, `verb.stabilisation`, and `river.hops`. This is the *target* schema, not the starting point. Progressive Formalization demands that the type start minimal and gain structure through use. Slice 1 should define the minimal viable PairedRecord that can flow through a river — identity, noun component, verb component, alignment indicator, river position. Additional fields accrete as slices require them.

**Correction 3: Missing runtime spine dependency.**

The four pillars design memo (2026-03-13) specifies a runtime spine (`src/runtime/`) with state machine, governance policy, plugin contract, and bounded buffers. Rivers are *clients of this runtime*, not independent infrastructure. The brief treats rivers as self-contained. In reality:

- River state transitions route through the runtime state machine
- River speed governance uses `governance-policy.ts` classification
- River plugins conform to the plugin contract
- River buffers are instances of `bounded-buffer.ts`

This changes the dependency graph. Rivers cannot be built before the runtime spine exists (or at least its interfaces).

**Correction 4: Processing river state machine conflicts with runtime state machine.**

The brief defines a processing-river-specific state machine (INTAKE → TIER_A_QUEUED → ... → PROMOTED). This is domain-specific processing state, not runtime state. It must be modeled as *content state within the river*, subordinate to the runtime state machine's operational states (IDLE, INTAKE, SYNTHESIS, REFLECTION, etc.). The two state machines are orthogonal: runtime state governs *Observer's* lifecycle; processing state governs *a record's* lifecycle within the Processing river.

**Correction 5: Degenerate PairedRecords need explicit handling.**

The brief mentions noun-only and verb-only records as "valid degeneracies" but doesn't specify how rivers handle them. This matters because:
- The OCP scraper produces SolutionRecords (noun-only)
- The dataset processor produces VerbRecords (verb-only, with noun as provenance)
- Rivers must accept both and route them toward pairing, not just carry them as incomplete records

Rivers should have an explicit **pairing service** that matches noun-only and verb-only records by source provenance, producing full PairedRecords where alignment is detectable.

**Extension 1: River persistence model.**

The brief lists persistence as an open question (§9.1). This PRD resolves it:
- **Intake river**: ephemeral per session. Material either routes to Processing or is stored for gap-directed retrieval. No inter-session persistence needed.
- **Processing river**: persistent. Records in processing have explicit state and must survive session boundaries. Stored in SQLite alongside the verb-record store.
- **Reflection river**: persistent. Meta-observations about Observer's process are vault records. They accumulate across sessions.

**Extension 2: River metrics as ISC criteria.**

The brief's Slice 8 (observability) is too late. Observable metrics should be ISC criteria on earlier slices. Every slice that implements a river must emit metrics from the start — buffer depth, flow rate, state distribution. Observability is not a separate concern; it is a verification mechanism for every river slice.

---

## 3. The Atomic Unit: PairedRecord

### 3.1 Minimal Viable Schema (Slice 1)

```typescript
/**
 * The atomic unit of river payload. Noun and verb bound by provenance.
 * Starts minimal; fields accrete through Progressive Formalization.
 */
interface PairedRecord {
  // Identity
  id: string;                        // content-hash (SHA-256 of source + extraction params)
  sourceProvenance: string;          // URI or content-hash of the originating material
  timestamp: string;                 // ISO 8601, when this record entered the river system

  // Noun component — what exists
  noun: NounComponent;

  // Verb component — what it does
  verb: VerbComponent;

  // Alignment — how noun and verb relate
  alignment: AlignmentComponent;

  // River position — where this record is now
  position: RiverPosition;
}

interface NounComponent {
  entityType: string;                // structural classification (e.g., "finite-capacity-channel")
  domain: string;                    // domain of origin (e.g., "network-engineering")
  description: string;               // what this entity is
  rawContent: string;                // source material
}

interface VerbComponent {
  processShape: string;              // structural description of the process
  operators: string[];               // algebra vocabulary: constrain, buffer, gate, converge...
  axis: 'differentiate' | 'integrate' | 'recurse';
  derivativeOrder: number;           // 0-3
}

interface AlignmentComponent {
  confidence: number;                // 0-1, how strongly noun and verb are coupled
  method: 'provenance' | 'structural' | 'model-assigned' | 'human-verified';
  motifId?: string;                  // if this pairing matches a known motif
}

interface RiverPosition {
  river: 'intake' | 'processing' | 'reflection';
  channel: 'fast' | 'slow';
  stage: string;                     // river-specific processing stage
  enteredAt: string;                 // when this record entered current stage
}
```

### 3.2 Degenerate Forms

| Form | Condition | Routing |
|------|-----------|---------|
| **Full pair** | Both noun and verb present, alignment > 0 | Normal river flow |
| **Noun-only** | Verb component is null/empty | Routes to pairing service; if no verb match found, stored as noun-pending |
| **Verb-only** | Noun component is null/empty (rawContent used as provenance) | Routes to pairing service; if no noun match found, flows as verb-dominant record |
| **Unaligned pair** | Both present but alignment.confidence = 0 | Flagged for Tier C model evaluation or human review |

### 3.3 Formalization Stages

Following Progressive Formalization (PF), PairedRecords move through stages:

| Stage | Description | Quality Gate | Ratchet Status |
|-------|-------------|-------------|----------------|
| **Amorphous** | Raw material flagged by intake heuristics | Enters river system | Freely created/destroyed |
| **Structured** | Parsed, scored, noun-verb components extracted | Tier A/B structural score > threshold | Freely created/destroyed |
| **Typed** | Normalized with operator tags, axis classification, alignment assessed | Tier C evaluation or automated scoring | Append-only in store |
| **Crystallized** | Validated, linked to specific motif instance, full provenance | Human review (T2+) or automated (T0-T1) | Demotion requires human approval |

The boundary between Structured and Typed is the ratchet tooth (Ratchet with Asymmetric Friction).

---

## 4. River Architecture

### 4.1 Three Rivers

#### Intake River

Carries material from external sources into Observer's processing pipeline.

| Property | Value |
|----------|-------|
| **Sources** | OCP scraper, dataset processor, manual input, session observations |
| **Dominant D/I/R** | Distinguish — what is this? Is it new? Does it match known patterns? |
| **Speed default** | Fast (material arrives when it arrives) |
| **Persistence** | Ephemeral per session |
| **Buffer** | BBWOP: priority scoring by motif-match strength. 10% blind extraction valve for novelty. |
| **Output** | Candidates route to Processing river or stored for gap-directed retrieval |

**Internal D/I/R within Intake:**
- D: Classify incoming material — known template match? blind extraction candidate? noise?
- I: Cross-reference against gap priorities — does this fill a known void?
- R: Did this batch reveal blind spots in template coverage?

#### Processing River

Carries material through Observer's multi-tier evaluation pipeline.

| Property | Value |
|----------|-------|
| **Sources** | Intake river candidates, gap-directed requests, recursive re-entry from Reflection |
| **Dominant D/I/R** | Integrate — how does this relate to existing records and motifs? |
| **Speed** | Dual: fast channel for Tier A/B automated processing; slow channel for Tier C and sovereignty gates |
| **Persistence** | Persistent (SQLite). Records survive session boundaries. |
| **Buffer** | BBWOP: convergence-aware priority. Material closing triangulation gaps elevated. |
| **Output** | Evaluated PairedRecords to store. Governance-ready records to promotion queue. |

**Record lifecycle within Processing river:**

```
RAW → TIER_A_SCORED → TIER_B_SCORED → BUFFER_HELD → TIER_C_EVALUATED → STORED
                                                                         ↓
                                                              GOVERNANCE_QUEUED →
                                                              PROMOTED | HELD | REJECTED
```

This is *record state*, orthogonal to the runtime state machine's operational states.

**Internal D/I/R within Processing:**
- D: What tier does this record qualify for? What state transition is valid?
- I: How does this record's verb pattern relate to existing motif instances?
- R: Did this processing batch reveal systematic biases (e.g., indicator overlap)?

#### Reflection River

Carries meta-observations about Observer's own process back into the system.

| Property | Value |
|----------|-------|
| **Sources** | Session traces, governance digests, motif algebra evaluations, anomaly detection |
| **Dominant D/I/R** | Recurse — what did we learn about our own process? |
| **Speed default** | Slow (reflection is not urgent) |
| **Persistence** | Persistent (vault records). Accumulates across sessions. |
| **Buffer** | BBWOP: novelty priority. Observations about blind spots and biases elevated. |
| **Output** | Modified templates → Intake. Processing config updates → Processing. Vault records. |

**Internal D/I/R within Reflection:**
- D: What is this observation about — process quality? bias? gap?
- I: How does this observation relate to prior reflections? Is there a pattern of patterns?
- R: Is the reflection itself biased? Are we only reflecting on failures, not successes?

### 4.2 Cross-River Connections

```
          ┌──────────────────────────────────────────────────────┐
          │                                                      │
          ▼                                                      │
    ┌──────────┐         ┌──────────────┐         ┌────────────┐ │
    │  INTAKE  │────────▶│  PROCESSING  │────────▶│ REFLECTION │─┘
    │  (D)     │         │  (I)         │         │ (R)        │
    └──────────┘         └──────────────┘         └────────────┘
          ▲                      ▲                       │
          │                      │                       │
          └──────────────────────┴───────────────────────┘
              template updates        config updates
```

| Connection | Trigger | Payload |
|------------|---------|---------|
| **Intake → Processing** | Template match or blind extraction promotion | PairedRecord (amorphous/structured) |
| **Processing → Reflection** | Anomaly detected, unexpected convergence, indicator overlap | Meta-observation record |
| **Reflection → Intake** | Updated templates, revised gap priorities | Template update, priority recalculation |
| **Reflection → Processing** | Systematic bias detected, configuration change needed | Processing config delta |

**Bounded recursion**: The Reflection → Intake → Processing → Reflection cycle must be bounded. Maximum recursion depth per session: 3 (configurable). Unbounded recursion would violate BBWOP — the Reflection river's buffer enforces the bound.

### 4.3 Dual-Speed Channels (DSG)

Every river has fast and slow channels. The governance policy (`src/runtime/governance-policy.ts`) classifies operations as FAST_ALLOWED, SLOW_REQUIRED, or DISALLOWED.

| Channel | Properties | Governance |
|---------|-----------|------------|
| **Fast** | Automated, high-throughput. Lexical filtering, automated tier scoring, routine state transitions. | Operates within constraints set by slow channel. Cannot modify templates, governance rules, or promotion criteria. |
| **Slow** | Deliberate, human-gated. Model-assisted evaluation, sovereignty gate reviews, anomaly investigation. | Can modify constraints the fast channel operates under. Blocks at sovereignty gates until human review. |

**Escalation triggers** (fast → slow):
- Conflict between sources
- Sovereignty gate threshold reached
- Anomaly flag fires
- Tier promotion boundary crossed (T1→T2 or higher)
- Human review explicitly requested
- Buffer overflow on governance-critical queue

**De-escalation triggers** (slow → fast):
- Human approves batch of routine promotions
- Governance rule established automating a previously manual decision
- Slow channel buffer exceeds capacity (BBWOP overflow to fast with explicit policy)

### 4.4 Pairing Service

A dedicated subsystem that matches degenerate records into full PairedRecords.

| Input | Matching Strategy | Output |
|-------|-------------------|--------|
| Noun-only (SolutionRecord from scraper) | Search verb-record store for matching source provenance or structural description | Full PairedRecord or noun-pending record |
| Verb-only (VerbRecord from processor) | Search solution-record store for matching domain + entity type | Full PairedRecord or verb-dominant record |
| Unaligned pair | Route to Tier C model evaluation for alignment assessment | Aligned PairedRecord or split into noun-pending + verb-dominant |

The pairing service sits at the boundary between Intake and Processing rivers. It is the first concrete implementation of cross-stream convergence.

---

## 5. Convergence Detection

### 5.1 Noun-Stream Convergence

**Question**: Has a particular entity type stabilised across multiple verb patterns?

**Mechanism**: Track entity-type frequency across PairedRecords in the Processing river. When the same `noun.entityType` appears with 3+ distinct `verb.processShape` values across 2+ domains, flag as noun-convergent.

**Example**: "finite-capacity-channel" (noun) appears in BBWOP instances, ISC instances, and Ratchet instances. That noun hosts multiple process patterns — it's a structurally stable entity type.

**Output**: Entity-type cluster record, routed to Reflection river.

### 5.2 Verb-Stream Convergence

**Question**: Has a particular process pattern stabilised across multiple entity types?

**Mechanism**: Track `verb.processShape` + `verb.operators` frequency across PairedRecords. When the same process pattern appears across 3+ distinct `noun.entityType` values in 2+ domains, flag as verb-convergent.

**Example**: "negative feedback constraining deviation" (verb) appears in thermostats, immune systems, and governance structures. That verb runs on multiple entity types — it's a structurally stable process (i.e., a motif).

**Output**: Motif validation signal, confirming or strengthening existing motif instances. This is what the motif library already does, now formalised within river infrastructure.

### 5.3 Cross-Stream Convergence (Motif Crystallisation)

**Question**: Are noun-convergence and verb-convergence happening simultaneously?

**Mechanism**: When a noun-convergent entity-type cluster overlaps with a verb-convergent process pattern — the same entity types hosting the same process patterns across independent domains — flag as cross-stream convergent.

**Output**: Motif crystallisation candidate. The PairedRecord at the convergence point is a fully validated motif instance. Routes to governance queue for sovereignty review.

**Significance**: This is the convergence layer from the dual-stream analysis made operational. It is the Integrate axis of D/I/R applied to the two streams. A verb-only river cannot detect noun-convergence. A noun-only river cannot detect verb-convergence. The paired river detects both, and their interaction.

### 5.4 Convergence Thresholds

| Threshold | Default | Tunable | Rationale |
|-----------|---------|---------|-----------|
| Minimum verb patterns for noun-convergence | 3 | Yes | Below 3, too many false positives |
| Minimum entity types for verb-convergence | 3 | Yes | Aligns with motif library validation protocol |
| Minimum domains for cross-stream convergence | 2 | Yes | Single-domain convergence may be domain artifact |
| Evidence decay window | 90 days | Yes | Older evidence weighted less |

---

## 6. Relationship to Runtime Spine

Rivers are clients of the runtime spine defined in the four pillars design memo. This table maps river operations to runtime components.

| River Operation | Runtime Component | Relationship |
|----------------|-------------------|-------------|
| Record state transitions | `state-machine.ts` | River requests transition; runtime validates and commits |
| Fast/slow classification | `governance-policy.ts` | River queries policy; acts on classification |
| Buffer management | `bounded-buffer.ts` | Each river buffer is an instance of the generic bounded buffer |
| Overflow handling | `overflow-policy.ts` | River-specific overflow policies registered with runtime |
| Plugin hooks | `plugin-contract.ts` | River operations fire plugin hooks (onIntake, onSynthesis, onReflection) |
| Transition logging | `transition-ledger.ts` | Every river state change produces a receipt |

**Dependency implication**: River implementation depends on the runtime spine interfaces existing. Rivers do not need the full runtime spine built — they need the interfaces (`state-types.ts`, `governance-policy.ts` types, `plugin-contract.ts` types, `bounded-buffer.ts` interface) to code against.

---

## 7. Implementation Slices

### Slice 1: PairedRecord Type and River Interface

**Scope**: Define `PairedRecord`, `NounComponent`, `VerbComponent`, `AlignmentComponent`, `RiverPosition` as first-class TypeScript interfaces. Define the `River` interface (accept, route, buffer, emit, queryState). Define degenerate-form handling (noun-only, verb-only, unaligned).

**Files**:
- `src/rivers/types.ts` — PairedRecord and component types
- `src/rivers/river.ts` — River interface definition
- `src/rivers/degenerate.ts` — Degenerate form classification and routing

**ISC Criteria**:
- [ ] ISC-R01: `PairedRecord` type compiles and represents full pairs, noun-only, verb-only, and unaligned forms | Verify: tsc
- [ ] ISC-R02: `River` interface is implementable by all three river types (Intake, Processing, Reflection) | Verify: type check
- [ ] ISC-R03: Degenerate form classifier correctly identifies and routes all four forms (full, noun-only, verb-only, unaligned) | Verify: unit test with 4+ cases per form
- [ ] ISC-R04: `PairedRecord` can be constructed from existing `VerbRecord` (verb-only degenerate) | Verify: unit test | Motif: Reconstruction Burden
- [ ] ISC-R05: `PairedRecord` can be constructed from existing `SolutionRecord` (noun-only degenerate) | Verify: unit test | Motif: Reconstruction Burden

**Dependencies**: None. Build first.

---

### Slice 2: Runtime Spine Interfaces (River Subset)

**Scope**: Define the minimal runtime spine interfaces that rivers need. This does NOT implement the full runtime spine — it defines the interface contracts that rivers code against, and provides stub/passthrough implementations for initial development.

**Files**:
- `src/runtime/state-types.ts` — Runtime state enum, river-relevant subset
- `src/runtime/governance-types.ts` — GovernanceSpeed, GovernanceDecision types
- `src/runtime/buffer-types.ts` — BoundedBuffer interface, OverflowPolicy types
- `src/runtime/stubs.ts` — Passthrough implementations for development

**ISC Criteria**:
- [ ] ISC-R06: Runtime state types compile and cover all river-relevant operational states | Verify: tsc
- [ ] ISC-R07: Governance types support FAST_ALLOWED, SLOW_REQUIRED, DISALLOWED classification | Verify: type check
- [ ] ISC-R08: BoundedBuffer interface supports capacity, depth, accept, evict, query operations | Verify: type check
- [ ] ISC-R09: Stub implementations pass all interface contracts | Verify: unit test | Motif: Explicit State Machine Backbone

**Dependencies**: Slice 1 (PairedRecord types referenced by buffer types).

---

### Slice 3: Intake River

**Scope**: Implement the Intake river with distinction logic, motif-template matching, blind extraction routing (10% valve), and BBWOP buffer. Ephemeral per session.

**Files**:
- `src/rivers/intake.ts` — Intake river implementation
- `src/rivers/intake-buffer.ts` — Intake-specific BBWOP buffer configuration
- `src/rivers/template-matcher.ts` — Motif template matching for intake classification

**ISC Criteria**:
- [ ] ISC-R10: Material from scraper enters the intake river as noun-only PairedRecords | Verify: integration test
- [ ] ISC-R11: Material from dataset processor enters as verb-only PairedRecords | Verify: integration test
- [ ] ISC-R12: Known-template material routes toward Processing river output | Verify: unit test with 3+ known templates
- [ ] ISC-R13: Unknown material routes to blind extraction path (10% valve) | Verify: unit test verifying extraction rate within ±2% of target
- [ ] ISC-R14: Buffer respects capacity limits; overflow evicts lowest-priority candidates | Verify: unit test with buffer at capacity | Motif: BBWOP
- [ ] ISC-R15: Buffer depth and flow rate are queryable at any time | Verify: unit test
- [ ] ISC-R16: Intake river produces metrics: records accepted, rejected, blind-extracted, overflow-evicted | Verify: unit test | Motif: ESMB

**Dependencies**: Slices 1, 2.

---

### Slice 4: Processing River with Record State Machine

**Scope**: Implement the Processing river with its record-level state machine (RAW through PROMOTED/HELD/REJECTED). Persistent in SQLite. Dual-speed channels. Each PairedRecord has trackable state with logged transitions.

**Files**:
- `src/rivers/processing.ts` — Processing river implementation
- `src/rivers/processing-state.ts` — Record state machine (distinct from runtime state machine)
- `src/rivers/processing-buffer.ts` — Processing-specific BBWOP buffer
- `src/rivers/processing-store.ts` — SQLite persistence for processing records

**ISC Criteria**:
- [ ] ISC-R17: Record state transitions are explicit and logged | Verify: unit test for each valid transition
- [ ] ISC-R18: No record exists in an undefined state | Verify: invariant check after batch processing | Motif: ESMB
- [ ] ISC-R19: Failed transitions produce error records, not silent drops | Verify: unit test with invalid transition attempt
- [ ] ISC-R20: Record state is queryable at any time (state distribution) | Verify: unit test
- [ ] ISC-R21: Fast channel processes Tier A/B without human intervention | Verify: integration test | Motif: DSG
- [ ] ISC-R22: Slow channel blocks at sovereignty gates for Tier C and T1→T2 promotions | Verify: integration test | Motif: DSG
- [ ] ISC-R23: Records survive session boundaries via SQLite persistence | Verify: integration test (write, close, reopen, read)
- [ ] ISC-R24: Processing river produces metrics: records per stage, transition count, error count | Verify: unit test

**Dependencies**: Slices 1, 2.

---

### Slice 5: Reflection River

**Scope**: Implement the Reflection river with recursion logic, anomaly routing, template-update output. Persistent as vault records. Includes bounded recursion enforcement.

**Files**:
- `src/rivers/reflection.ts` — Reflection river implementation
- `src/rivers/reflection-buffer.ts` — Reflection-specific BBWOP buffer (novelty priority)
- `src/rivers/reflection-store.ts` — Vault record persistence

**ISC Criteria**:
- [ ] ISC-R25: Processing anomalies generate Reflection river entries | Verify: integration test with simulated anomaly
- [ ] ISC-R26: Session traces enter the Reflection river | Verify: integration test
- [ ] ISC-R27: Reflection output produces template-update records (for Intake) | Verify: unit test
- [ ] ISC-R28: Reflection output produces config-delta records (for Processing) | Verify: unit test
- [ ] ISC-R29: Reflection records persist as vault records | Verify: integration test (write and query)
- [ ] ISC-R30: Bounded recursion: maximum recursion depth per session enforced (default 3) | Verify: unit test exceeding bound | Motif: BBWOP
- [ ] ISC-R31: Reflection river produces metrics: observations captured, templates updated, recursion depth | Verify: unit test

**Dependencies**: Slices 1, 2.

---

### Slice 6: Pairing Service

**Scope**: Implement the service that matches noun-only and verb-only records into full PairedRecords. Sits at Intake/Processing boundary.

**Files**:
- `src/rivers/pairing.ts` — Pairing service implementation
- `src/rivers/pairing-store.ts` — Pending-pair storage (noun-pending, verb-dominant queues)

**ISC Criteria**:
- [ ] ISC-R32: Noun-only records (SolutionRecord origin) are matched with verb-records by source provenance | Verify: integration test
- [ ] ISC-R33: Verb-only records (VerbRecord origin) are matched with noun records by domain + entity type | Verify: integration test
- [ ] ISC-R34: Unmatched records are stored as pending with explicit status | Verify: unit test
- [ ] ISC-R35: Successfully paired records have alignment.method = 'provenance' or 'structural' | Verify: unit test
- [ ] ISC-R36: Pairing service produces metrics: pairs formed, noun-pending count, verb-dominant count | Verify: unit test | Motif: Reconstruction Burden

**Dependencies**: Slices 1, 3, 4 (needs Intake and Processing rivers to route through).

---

### Slice 7: Cross-River Wiring

**Scope**: Wire the three rivers and pairing service together at defined connection points. Intake→Processing, Processing→Reflection, Reflection→Intake, Reflection→Processing. Enforce bounded recursion.

**Files**:
- `src/rivers/router.ts` — Cross-river routing logic
- `src/rivers/recursion-guard.ts` — Bounded recursion enforcement

**ISC Criteria**:
- [ ] ISC-R37: Material flows from Intake to Processing via pairing service | Verify: end-to-end test
- [ ] ISC-R38: Anomalies in Processing generate Reflection entries | Verify: end-to-end test
- [ ] ISC-R39: Reflection template updates modify Intake behaviour in next cycle | Verify: end-to-end test | Motif: OFL
- [ ] ISC-R40: Reflection config deltas modify Processing behaviour | Verify: end-to-end test | Motif: OFL
- [ ] ISC-R41: Cross-river routing is logged (which record, which rivers, which direction) | Verify: unit test
- [ ] ISC-R42: Recursion guard prevents circular amplification (max depth enforced) | Verify: unit test with recursive trigger | Motif: BBWOP
- [ ] ISC-R43: Total cross-river flow rate is queryable | Verify: unit test

**Dependencies**: Slices 3, 4, 5, 6.

---

### Slice 8: Convergence Detection

**Scope**: Implement noun-stream, verb-stream, and cross-stream convergence detection.

**Files**:
- `src/rivers/convergence.ts` — Convergence detection engine
- `src/rivers/convergence-types.ts` — Convergence event types
- `src/rivers/convergence-store.ts` — Convergence event persistence

**ISC Criteria**:
- [ ] ISC-R44: Noun-convergence detected when same entityType appears with 3+ verb patterns across 2+ domains | Verify: unit test with synthetic PairedRecords
- [ ] ISC-R45: Verb-convergence detected when same processShape appears across 3+ entity types in 2+ domains | Verify: unit test with synthetic PairedRecords
- [ ] ISC-R46: Cross-stream convergence flagged when noun and verb convergence co-occur | Verify: unit test | Motif: Hidden Structure / Surface Form Separation
- [ ] ISC-R47: Convergence events route to governance queue for sovereignty review | Verify: integration test
- [ ] ISC-R48: Convergence thresholds are configurable | Verify: unit test with varied thresholds
- [ ] ISC-R49: False-positive rate manageable: convergence requires minimum evidence thresholds | Verify: unit test with noise data

**Dependencies**: Slice 7 (needs cross-river wiring to detect convergence across rivers).

---

### Slice 9: Pipeline Integration

**Scope**: Wire the dataset processor's output into the Intake river. Wire governance system output into Processing river sovereignty gates. Wire governance digests into Reflection river.

**Files**:
- `src/rivers/adapters/dataset-processor.ts` — Dataset processor → Intake adapter
- `src/rivers/adapters/scraper.ts` — OCP scraper → Intake adapter
- `src/rivers/adapters/governance.ts` — Governance → Processing/Reflection adapter

**ISC Criteria**:
- [ ] ISC-R50: Dataset processor candidates enter Intake river as verb-only PairedRecords | Verify: integration test with real processor output
- [ ] ISC-R51: OCP scraper records enter Intake river as noun-only PairedRecords | Verify: integration test with real scraper output
- [ ] ISC-R52: Governance auto-promotions operate within Processing fast channel | Verify: integration test | Motif: DSG
- [ ] ISC-R53: Sovereignty gate reviews operate within Processing slow channel | Verify: integration test | Motif: DSG
- [ ] ISC-R54: Governance digests generate Reflection river entries | Verify: integration test

**Dependencies**: Slice 7, plus existing dataset processor and governance system.

---

### Slice 10: Vault Integration and Session Traces

**Scope**: Rivers write process traces to vault. Session traces include river flow summaries. Vault records carry river provenance metadata.

**Files**:
- `src/rivers/vault-writer.ts` — Vault record production from river events
- `src/rivers/session-trace.ts` — Session-level river flow summary

**ISC Criteria**:
- [ ] ISC-R55: Every significant river event produces a vault record | Verify: integration test
- [ ] ISC-R56: Session handoffs include river state (buffer depths, record counts, convergence events) | Verify: integration test
- [ ] ISC-R57: Vault queries can retrieve river history by time range and river type | Verify: integration test
- [ ] ISC-R58: Process traces are machine-readable D/I/R records | Verify: schema validation

**Dependencies**: Slice 7, vault infrastructure.

---

## 8. Dependency Graph

```
Slice 1 ──────────────────────────┐
  (PairedRecord types)            │
                                  ▼
Slice 2 ──────────────────────────┤
  (Runtime spine interfaces)      │
                                  ▼
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
                Slice 3       Slice 4       Slice 5
                (Intake)    (Processing)  (Reflection)
                    │             │             │
                    └──────┬──────┘             │
                           ▼                   │
                       Slice 6                 │
                       (Pairing)               │
                           │                   │
                           └─────────┬─────────┘
                                     ▼
                                 Slice 7
                               (Cross-River)
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
                Slice 8          Slice 9          Slice 10
              (Convergence)    (Pipeline)     (Vault/Session)
```

## 9. Build Waves

| Wave | Slices | Parallelism | Rationale |
|------|--------|-------------|-----------|
| **Wave 1** | 1 → 2 | Sequential | Types first, then interfaces they plug into |
| **Wave 2** | 3, 4, 5 | Parallel | Three rivers independent once types and interfaces exist |
| **Wave 3** | 6 | Sequential | Pairing service needs Intake and Processing |
| **Wave 4** | 7 | Sequential | Cross-river wiring needs all rivers + pairing |
| **Wave 5** | 8, 9, 10 | Parallel | Convergence, pipeline integration, and vault all depend on wired rivers |

**Estimated slice count**: 10 slices, 58 ISC criteria.

---

## 10. Motif Predictions

Each motif predicts specific river behaviour. These are testable — if implementation contradicts a prediction, either the implementation or the motif understanding needs revision.

| Motif | Prediction | Test Mechanism |
|-------|-----------|----------------|
| **DSG** | Every river has fast/slow channels. Escalation between them is the primary governance mechanism. | ISC-R21, ISC-R22, ISC-R52, ISC-R53 |
| **ESMB** | Every PairedRecord in a river has an explicit, queryable state. No material exists in limbo. | ISC-R17, ISC-R18, ISC-R20 |
| **CPA** | New subsystems connect to rivers through adapter interfaces. Adding a source doesn't rewire existing rivers. | ISC-R50, ISC-R51 (adapter pattern) |
| **BBWOP** | Every river buffer has finite capacity and explicit overflow policy. No unbounded queues. | ISC-R14, ISC-R30, ISC-R42 |
| **Reconstruction Burden** | Paired noun-verb records minimise RB. Separating streams increases RB. Pairing service exists because separation incurs RB. | ISC-R04, ISC-R05, ISC-R32, ISC-R33 |
| **OFL** | Reflection river output modifies Intake and Processing behaviour. The system observes itself and changes. | ISC-R39, ISC-R40 |
| **Hidden Structure / Surface Form** | Noun and verb are surface forms. Cross-stream convergence reveals the hidden structural instance (the motif). | ISC-R46 |
| **Progressive Formalization** | PairedRecords move through formalization stages: amorphous → structured → typed → crystallized. | Record state machine (Slice 4) |
| **Ratchet** | Typed records are append-only. Crystallized records require human approval for demotion. The ratchet tooth is the structured→typed boundary. | ISC-R18 (no undefined states), governance gates |
| **ISC** | Convergence detection identifies when noun-verb pairings stabilise across domains — the idempotent state the system converges toward. | ISC-R44, ISC-R45, ISC-R46 |

---

## 11. Open Questions

1. **Convergence threshold calibration**: The defaults (3 verb patterns, 3 entity types, 2 domains) are informed guesses. Empirical calibration needed after first 1,000+ PairedRecords flow through the system.

2. **Tier C cost governance**: Tier C uses Claude API. The slow channel needs budget governance — configurable per-session and per-day caps. Not specified here; inherits from dataset processor PRD's Tier C cost model.

3. **spaCy dependency**: Tier B scoring depends on spaCy. Rivers carrying records from Tier B need graceful degradation when spaCy is unavailable. Tier A → Tier C direct path must be valid.

4. **PairedRecord schema evolution**: The minimal schema (§3.1) will grow. Need a migration strategy for adding fields to PairedRecords already in the store. SQLite schema migrations or versioned record format.

5. **River capacity numbers**: Buffer sizes, overflow thresholds, and priority weights need empirical calibration. Starting defaults should be conservative (small buffers, strict bounds) and tuned upward.

---

## 12. Non-Goals

This PRD does not commit to:

- Replacing the dataset processor or governance system (rivers wrap around them)
- Building the model training convergence layer (downstream of rivers)
- Implementing real-time stream processing (batch-oriented is sufficient)
- Building the full runtime spine (rivers need interfaces, not full implementation)
- Solving noun-type classification (rivers carry PairedRecords; classification feeds into the noun component)
- Defining the motif algebra integration (the algebra is an ambient service triggered by river events, not a river component)

---

## 13. Success Criteria

Rivers are working when:

1. Material flows from Intake through Processing to store without manual intervention (fast channel)
2. Material requiring judgment pauses at sovereignty gates until human review (slow channel)
3. The Reflection river produces observations that measurably change Intake and Processing behaviour (closed OFL)
4. Noun-only and verb-only records are matched into full PairedRecords by the pairing service
5. Cross-stream convergence detection identifies motif instances that single-stream analysis would miss
6. River state is inspectable at any time — buffer occupancy, state distribution, flow rate, convergence events
7. The system's cognitive process is legible through river traces, not just its outputs
8. All 58 ISC criteria pass
