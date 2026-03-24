---
⚠️ VAULT SAFETY HEADER
authority_boundary: This document is VAULT content (narrative/rationale/planning).
vault_rule: The Workspace does NOT derive from this document.
human_gate: Promotion to canonical requires Adam's explicit approval.
ai_rule: AI agents may READ this document. AI agents may CREATE new documents referencing this one. AI agents may NOT modify canonical vault documents.
---

---
status: DRAFT
date: 2026-03-24
author: Claude (advisory) + Adam (sovereignty)
type: PRD
authority: low
domain: [observer-native, rivers, dual-stream, architecture]
mode: design
motifs: [dual-speed-governance, explicit-state-machine-backbone, composable-plugin-architecture, bounded-buffer-with-overflow-policy, reconstruction-burden, observer-feedback-loop, hidden-structure-surface-form-separation, progressive-formalization]
refs:
  - 01-Projects/observer-native/docs/observer-v3-dir-process-contract-20260319.md
  - 02-Knowledge/architecture/dual-stream-dir-analysis-20260324.md
  - 02-Knowledge/architecture/Theory_To_Architecture_20260305.md
  - 01-Projects/observer-native/docs/four_pillars_design_memo.md
  - 01-Projects/dataset-processor/docs/PRD-dataset-processor-20260323.md
provenance: >
  Written by Claude (advisory role) on 2026-03-24 during a session with Adam.
  Incorporates the v3.0 process contract (verb-typed rivers), Atlas's dual-stream
  D/I/R analysis (noun-verb co-primary), and the Theory-to-Architecture grounded
  principles. Adam holds full sovereignty over all design decisions.
---

# Rivers PRD — Dual-Stream Cognitive Circulation

## 1. Purpose

Rivers are Observer's circulatory system. They carry cognitive material between subsystems — not as inert data transfers but as typed, process-aware flows that make the system's thinking legible and governable.

The v3.0 process contract established that rivers should carry verb-typed process metadata. The dual-stream architectural insight (2026-03-24) elevates this: rivers carry paired noun-verb flows, because process doesn't happen in a vacuum — it happens to something. A river that carries only "what happened" (verb) without "what it happened to" (noun) is structurally incomplete. The reconstruction burden of recovering one from the other is the cost of that incompleteness.

Rivers are not data pipes. They are the medium through which Observer observes itself.

## 2. Architectural Context

### What changed

The project shifted from verb-first to noun-verb co-primary. The atomic unit of data is now the PairedRecord — noun and verb bound together by source provenance. This changes what rivers carry but not what rivers are.

### What survived unchanged

The four pillars govern river behaviour:

- **Dual-Speed Governance**: Rivers have fast and slow channels. Fast carries operational flow (what's happening now). Slow carries reflective flow (what does this mean across time).
- **Explicit State Machine Backbone**: Every river segment has a defined state. Material in transit has a known position in the processing lifecycle.
- **Composable Plugin Architecture**: Subsystems connect to rivers through standardised interfaces. New subsystems plug in without rewiring existing flows.
- **Bounded Buffer With Overflow Policy**: Rivers have finite capacity. When flow exceeds capacity, explicit policy determines what's deferred, summarised, or dropped.

### What's new

- Rivers carry PairedRecords (noun-verb pairs), not just verb-typed metadata
- Cross-stream convergence points where noun and verb channels interact
- Entity-level and process-level convergence detection
- Dual feedback: observation modifies both what entities and what processes the system can see

## 3. The Atomic Unit: PairedRecord

Every item flowing through a river is a PairedRecord or derives from one.

### Schema

```typescript
interface PairedRecord {
  // Identity
  id: string;                    // content-hash derived
  sourceProvenance: string;      // where this came from
  timestamp: string;             // when it entered the river

  // Noun component — what exists
  noun: {
    entityType: string;          // structural classification of the entity
    domain: string;              // domain of origin
    stateDescription: string;    // current state/properties
    boundaries: string[];        // what defines its edges
    rawContent: string;          // source material
  };

  // Verb component — what it does
  verb: {
    processShape: string;        // structural pattern (motif signature)
    operators: string[];         // active operators
    axis: 'differentiate' | 'integrate' | 'recurse';
    derivativeOrder: number;     // abstraction level
    stabilisation: 'stable' | 'unstable' | 'converging' | 'diverging';
  };

  // Alignment — how noun and verb relate
  alignment: {
    confidence: number;          // how strongly noun and verb are coupled
    motifId?: string;            // if this matches a known motif
    convergenceType?: string;    // how the pairing was established
  };

  // River metadata
  river: {
    channelSpeed: 'fast' | 'slow';
    processingStage: string;     // where in the lifecycle
    dirPhase: 'distinguish' | 'integrate' | 'recurse' | 'transit';
    hops: number;                // how many subsystems have touched this
  };
}
```

### Design rationale

The noun component answers "what is it?" The verb component answers "what does it do?" The alignment answers "how do we know these refer to the same structural reality?" The river metadata answers "where is it going and what's happened to it?"

No field is optional in principle. A PairedRecord with a null noun is a VerbRecord (the prior atomic unit). A PairedRecord with a null verb is a SolutionRecord. Both are valid degeneracies but the full pair is the target.

## 4. River Architecture

### 4.1 River Types

Observer has three primary rivers, each carrying PairedRecords at different speeds and for different purposes.

#### Intake River

Carries material from external sources into Observer's processing pipeline.

- **Sources**: OCP scraper, dataset processor, manual input, session observations
- **Speed**: Fast by default (material arrives when it arrives)
- **D/I/R phase**: Primarily Distinguish — what is this? Is it new? Does it match known patterns?
- **Buffer policy**: BBWOP with priority scoring. High-motif-match candidates get priority. Low-scoring material is deferred, not discarded (the 10% blind extraction valve ensures novelty preservation).
- **Output**: Candidates enter the processing river or are stored for later gap-directed retrieval.

#### Processing River

Carries material through Observer's multi-tier evaluation pipeline.

- **Sources**: Intake river candidates, gap-directed sampling requests, recursive re-entry from reflection
- **Speed**: Dual. Fast channel for Tier A/B automated processing. Slow channel for Tier C model-assisted evaluation and sovereignty gate review.
- **D/I/R phase**: Primarily Integrate — how does this relate to what we already know? Does it strengthen, contradict, or extend existing motifs?
- **Buffer policy**: BBWOP with convergence-aware priority. Material that closes a triangulation gap or resolves a conflict gets elevated.
- **State machine**: Each PairedRecord has an explicit processing state:

```
INTAKE → TIER_A_QUEUED → TIER_A_SCORED → TIER_B_QUEUED → TIER_B_SCORED → 
BUFFER_HELD → TIER_C_QUEUED → TIER_C_EVALUATED → STORE_READY → STORED
                                                                    ↓
                                                            GOVERNANCE_QUEUED → 
                                                            PROMOTED | HELD | REJECTED
```

- **Output**: Evaluated PairedRecords enter the store. Governance-ready records enter the promotion queue.

#### Reflection River

Carries meta-observations about Observer's own process back into the system.

- **Sources**: Session traces, governance digests, motif algebra evaluations, anomaly detection, recursive re-entry
- **Speed**: Slow by default (reflection is not urgent)
- **D/I/R phase**: Primarily Recurse — what did we learn about our own process? What assumptions shaped our observations? What patterns in our reasoning are reusable?
- **Buffer policy**: BBWOP with novelty priority. Observations about the system's own biases, blind spots, or recurring patterns get elevated. Routine confirmations are deferred.
- **Output**: Modified templates, updated motif candidates, session trace records, governance recommendations, and — critically — feedback that modifies what the intake and processing rivers can see next time (OFL dual feedback).

### 4.2 Cross-River Connections

Rivers are not isolated channels. They interact at defined convergence points.

#### Intake → Processing

When the intake river's distinction phase identifies material that matches known motif templates, it routes directly to the processing river. Material that matches no templates enters the blind extraction path (10% valve) which has its own processing route — no template, pure structural analysis.

#### Processing → Reflection

When the processing river's integration phase detects anomalies — unexpected conflicts, surprising convergences, motifs appearing in domains where they weren't predicted — it routes observations to the reflection river. This is the OFL feedback mechanism: the act of processing material generates observations about the processing itself.

#### Reflection → Intake

When the reflection river's recursion phase produces updated templates, modified motif candidates, or revised gap-scoring priorities, these flow back to the intake river and modify its distinction criteria. This closes the loop: what the system learns about itself changes what it can observe.

#### Reflection → Processing

When the reflection river identifies systematic biases in processing (e.g., the indicator overlap problem that produced universal conflicts in shard 00), it generates processing configuration updates that modify how the processing river evaluates material.

### 4.3 Dual-Speed Within Each River

Each river has fast and slow channels operating simultaneously under DSG governance.

**Fast channel**: Automated, high-throughput, lower-precision. Lexical filtering, automated tier promotions (T0→T1), routine state transitions. Operates continuously without human intervention.

**Slow channel**: Deliberate, lower-throughput, higher-precision. Model-assisted evaluation, sovereignty gate reviews (T1→T2, T2→T3), anomaly investigation, architectural decisions. Operates on human timescales with explicit sovereignty gates.

**Escalation rules**: Material moves from fast to slow when:
- Conflict is detected between sources
- A sovereignty gate threshold is reached
- An anomaly flag fires
- A motif candidate crosses a tier promotion boundary
- Human review is explicitly requested

**De-escalation rules**: Material moves from slow to fast when:
- Human approves a batch of routine promotions
- A governance rule is established that automates a previously manual decision
- The slow channel's buffer exceeds capacity (BBWOP overflow to fast with explicit policy)

## 5. River Convergence and D/I/R

Atlas's analysis identified that the convergence layer IS the integrate axis of D/I/R applied to the two streams. This has concrete implications for river design.

### Noun-stream convergence detection

Has a particular entity type stabilised across multiple verb patterns? If "finite-capacity channel" (noun) appears in BBWOP instances, ISC instances, and Ratchet instances, that's noun-level convergence — a structural entity that hosts multiple process patterns. This is entity-type clustering.

### Verb-stream convergence detection

Has a particular process pattern stabilised across multiple entity types? If "negative feedback constraining deviation" (verb) appears in thermostats, immune systems, and governance structures, that's verb-level convergence — a process shape that runs on multiple structural entities. This is motif validation (what the library already does).

### Cross-stream convergence

When noun-convergence and verb-convergence happen simultaneously — the same entity types hosting the same process patterns across independent domains — that's motif crystallisation. The PairedRecord at the convergence point is a fully validated motif instance.

Rivers enable this by carrying both streams simultaneously. A verb-only river can detect verb-convergence but not noun-convergence. A noun-only river can detect noun-convergence but not verb-convergence. The paired river detects both, and their interaction.

## 6. Implementation Slices

### Slice 1: PairedRecord Type and River Interface

Define the PairedRecord type as a first-class TypeScript interface. Define the River interface that all rivers implement: accept, route, buffer, emit, stateTransition. Define the RiverMetadata that every PairedRecord carries.

**ISC criteria**: Types compile. Interface is implementable by all three river types. PairedRecord can represent both full pairs and degenerate cases (noun-only, verb-only).

### Slice 2: Intake River

Implement the intake river with its distinction logic, motif-template matching, blind extraction routing, and BBWOP buffer.

**ISC criteria**: Material from scraper and dataset processor enters the river. Known-template material routes to processing. Unknown material routes to blind extraction. Buffer respects capacity limits. Overflow policy is explicit.

### Slice 3: Processing River State Machine

Implement the processing river's explicit state machine (INTAKE through PROMOTED/HELD/REJECTED). Each PairedRecord has a trackable state. Transitions are logged.

**ISC criteria**: State transitions are explicit and logged. No material exists in an undefined state. Failed transitions produce error records, not silent drops. State can be queried at any time.

### Slice 4: Processing River Dual-Speed Channels

Implement fast and slow channels within the processing river. Escalation and de-escalation rules. DSG governance boundary between channels.

**ISC criteria**: Fast channel processes without human intervention. Slow channel blocks at sovereignty gates. Escalation triggers correctly. De-escalation rules are explicit. BBWOP overflow between channels works.

### Slice 5: Reflection River

Implement the reflection river with its recursion logic, anomaly detection routing, and template-update output.

**ISC criteria**: Processing anomalies generate reflection river entries. Session traces enter the reflection river. Output feeds back to intake river templates and processing river configuration. Reflection records are stored in vault.

### Slice 6: Cross-River Connections

Wire the three rivers together at their defined convergence points. Intake→Processing, Processing→Reflection, Reflection→Intake, Reflection→Processing.

**ISC criteria**: Material flows between rivers at defined points. Feedback loops are closed (Reflection output modifies Intake behaviour). Cross-river routing is logged. No circular amplification (bounded recursion limits apply).

### Slice 7: Convergence Detection

Implement noun-stream, verb-stream, and cross-stream convergence detection across rivers.

**ISC criteria**: Entity-type clustering detects when the same noun appears across multiple motif instances. Process-pattern clustering detects when the same verb appears across multiple entity types. Cross-stream convergence flags potential motif crystallisation. False-positive rate is manageable (convergence requires minimum evidence thresholds).

### Slice 8: River Observability

Implement river dashboards, flow metrics, buffer status, state distribution, convergence events. River state is inspectable at any time.

**ISC criteria**: Current buffer occupancy visible per river. State distribution (how many PairedRecords at each processing stage) visible. Convergence events logged and queryable. Flow rate (records per unit time) tracked. Anomaly flags surfaced.

### Slice 9: Vault Integration

Rivers write process traces to vault. Session traces include river flow summaries. Vault records carry river provenance metadata.

**ISC criteria**: Every significant river event produces a vault record. Session handoffs include river state. Vault queries can retrieve river history. Process traces are machine-readable D/I/R records.

### Slice 10: Integration with Dataset Processor and Governance

Wire the dataset processor's output into the intake river. Wire the governance system's output into the processing river's sovereignty gates. Wire governance digests into the reflection river.

**ISC criteria**: Dataset processor candidates enter the intake river as PairedRecords. Governance auto-promotions operate within the fast channel. Sovereignty gate reviews operate within the slow channel. Governance digests generate reflection river entries.

## 7. Dependencies

- **Slice 1** has no dependencies. Build first.
- **Slices 2, 3, 5** depend on Slice 1 and can be built in parallel.
- **Slice 4** depends on Slice 3.
- **Slice 6** depends on Slices 2, 3, 5.
- **Slice 7** depends on Slice 6.
- **Slices 8, 9** depend on Slice 6 and can be built in parallel.
- **Slice 10** depends on Slices 6 + existing dataset processor and governance system.

### Build waves

**Wave 1** (parallel): Slices 1, then 2, 3, 5
**Wave 2** (parallel): Slices 4, 6
**Wave 3** (parallel): Slices 7, 8, 9
**Wave 4**: Slice 10

## 8. Motif Predictions

The following motifs predict specific aspects of river behaviour. These are testable — if a river implementation exhibits properties that contradict these motif predictions, either the implementation or the motif understanding needs revision.

| Motif | Prediction |
|-------|-----------|
| Dual-Speed Governance | Every river has fast/slow channels. Escalation between them is the primary governance mechanism. |
| ESMB | Every PairedRecord in a river has an explicit, queryable state. No material exists in limbo. |
| CPA | Subsystems connect to rivers through standardised interfaces. Adding a new subsystem does not require rewiring existing rivers. |
| BBWOP | Every river buffer has finite capacity and explicit overflow policy. No unbounded queues. |
| Reconstruction Burden | Paired noun-verb records minimise reconstruction burden. Separating streams increases RB. |
| OFL | Reflection river output modifies intake and processing behaviour. The system observes itself and changes. |
| Hidden Structure / Surface Form Separation | Noun and verb are surface forms. The PairedRecord at convergence points reveals the hidden structural instance. |
| Progressive Formalisation | PairedRecords move through formalization stages: amorphous (raw intake) → structured (Tier A scored) → typed (Tier B/C evaluated) → crystallised (governance-approved, motif-linked). |

## 9. Open Questions

1. **River persistence**: Are rivers in-memory only (reset each session) or persistent (survive across sessions)? The reflection river arguably needs persistence. The intake river probably doesn't.
2. **River capacity**: What are the actual BBWOP numbers? Buffer sizes, overflow thresholds, priority scoring weights. These need empirical calibration.
3. **Convergence thresholds**: How much evidence constitutes noun-convergence or verb-convergence? Too low and everything converges (noise). Too high and nothing converges (miss rate).
4. **spaCy dependency**: Tier B scoring depends on spaCy which isn't installed on the CachyOS VM. Rivers that depend on Tier B need a graceful degradation path.
5. **Tier C cost**: Tier C uses Claude API which costs money. The slow channel needs budget governance — how many Tier C evaluations per day/session?
6. **PairedRecord degenerate cases**: How do noun-only (SolutionRecord) and verb-only (VerbRecord) entries behave in rivers designed for pairs? Explicit handling or silent adaptation?
7. **Temporal scope**: Rivers operate within a session? Across sessions? Continuously? The always-on model requires continuous rivers. The current session-based model requires rivers that start and stop.

## 10. Non-Goals

This PRD does not commit to:

- Replacing the existing dataset processor or governance system (rivers wrap around them)
- Building the model training convergence layer (that's downstream of rivers)
- Implementing true real-time stream processing (batch-oriented is fine for now)
- Solving the temporal persistence question definitively (mark as open, calibrate empirically)
- Building the noun-type classification system (rivers carry PairedRecords; the classification system is a separate concern that feeds into the noun component)

## 11. Success Criteria

Rivers are working when:

1. Material flows from intake through processing to store without manual intervention (fast channel)
2. Material requiring judgment pauses at sovereignty gates until human review (slow channel)
3. The reflection river produces observations that measurably change intake and processing behaviour (closed feedback loop)
4. Cross-stream convergence detection identifies motif instances that single-stream analysis would miss
5. River state is inspectable at any time — buffer occupancy, state distribution, flow rate, anomalies
6. The system's cognitive process is legible through river traces, not just through its outputs
