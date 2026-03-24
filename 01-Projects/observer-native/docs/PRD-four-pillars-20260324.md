---
prd: true
id: PRD-20260324-four-pillars
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
domain: [observer-native, runtime, four-pillars, architecture]
method: D/I/R design pass (Atlas) — converting design memo to buildable PRD
motifs:
  - dual-speed-governance
  - explicit-state-machine-backbone
  - composable-plugin-architecture
  - bounded-buffer-with-overflow-policy
refs:
  - 01-Projects/observer-native/docs/four_pillars_design_memo.md
  - 01-Projects/observer-native/docs/PRD-rivers-20260324.md
  - 02-Knowledge/architecture/Theory_To_Architecture_20260305.md
  - 02-Knowledge/motifs/MOTIF_INDEX.md
provenance: >
  Formal PRD produced by Atlas on 2026-03-24. Converts the four pillars
  embodiment design memo (2026-03-13, authored by OpenCode) into a buildable
  specification with numbered slices and ISC criteria. The design memo remains
  the canonical design reference; this PRD makes it executable.
  Adam holds sovereignty over all design decisions.
---

# Four Pillars Runtime Spine — PRD

## STATUS

| What | State |
|------|-------|
| Progress | 0/0 criteria passing |
| Phase | PLAN |
| Next action | Slice 1 implementation |
| Blocked by | Nothing |

---

## 1. Purpose

The four Tier 2 motifs — Dual-Speed Governance, Explicit State Machine Backbone, Composable Plugin Architecture, Bounded Buffer With Overflow Policy — exist in the motif library as validated structural operators. They exist in observer-native as scattered partial embodiments across s0–s9 modules. They do not yet exist as a unified runtime spine.

This PRD converts the four pillars design memo (2026-03-13) into buildable slices with ISC criteria. The design memo's analysis — gap identification, proposed file map, pillar-by-pillar design, cross-pillar reinforcement — is the design authority. This PRD adds: numbered slices, ISC criteria per slice, dependency graph, and build waves.

### Relationship to Rivers PRD

The Rivers PRD (PRD-20260324-rivers) defines rivers as clients of this runtime spine. Rivers Slice 2 ("Runtime Spine Interfaces — River Subset") originally defined stub interfaces for rivers to code against. This PRD supersedes that slice. Pillars Slice 1 produces the real type layer that rivers consume directly. Rivers Slice 2 is eliminated; Rivers Slices 3+ depend on Pillars Slice 1 instead.

See the unified build plan (`build-plan-pillars-rivers-20260324.md`) for the interleaved schedule.

---

## 2. What Exists Today

The design memo's "Describe" section is accurate. Verifying against current source:

| Pillar | Partial Embodiment | Gap |
|--------|--------------------|-----|
| **DSG** | `s7/sovereignty.ts` (authority rules), `s7/task-failure.ts` + `s7/process-quality.ts` (slow-path gates), `s0/isc-evaluator.ts` (routine vs foundational) | No single policy function classifying FAST/SLOW/DISALLOWED. Fast path doesn't structurally stop at slow-path boundary. |
| **ESMB** | `s4/types.ts` (deliberation steps), `s5/types.ts` (PRD lifecycle), `s7/types.ts` (gate states) | No unified runtime state machine. Transitions spread across modules. No transition ledger. |
| **CPA** | `s1/adapter.ts` (bounded adapter), `s8/stop-orchestrator.ts` (proto-registry) | No plugin manifest, no capability model, no validation, no lifecycle management. |
| **BBWOP** | `s1/adapter.ts` (event file), `s6/retry.ts` (retry bound), `s2/tension-tracker.ts` (read cap) | No named queue classes, no system-wide overflow policy, no overflow artifacts. |

The existing modules are correct for their domain logic. They lack a shared runtime core.

---

## 3. Architecture

### 3.1 File Map

All new files live under `src/runtime/`. The design memo's file map is adopted with one change: types are split into a dedicated type file per pillar for cleaner imports.

```
src/runtime/
├── state-types.ts          # RuntimeState, events, guards, halt reasons, TransitionReceipt
├── state-machine.ts        # Transition table and executor
├── transition-ledger.ts    # Append-only receipt store
├── governance-types.ts     # GovernanceSpeed, GovernanceActionClass, GovernanceDecision
├── governance-policy.ts    # Policy classifier implementation
├── buffer-types.ts         # BoundedBuffer<T> interface, OverflowPolicy, QueueClass
├── bounded-buffer.ts       # Generic bounded queue implementation
├── overflow-policy.ts      # Per-queue overflow policy implementations
├── plugin-types.ts         # PluginCapability, PluginHook, Manifest, Context, Plugin
├── plugin-contract.ts      # Contract enforcement
├── plugin-registry.ts      # Registration, activation, drain, removal
├── plugin-validator.ts     # Manifest validation
└── runtime-orchestrator.ts # Wires all components
```

### 3.2 Design Principles

Taken directly from the design memo:

1. **One runtime state machine owns legal motion.** All operational state transitions go through it. Modules propose; the state machine commits.
2. **One governance boundary decides fast vs slow.** The policy function is the single point of speed classification. No module bypasses it.
3. **Plugins observe and propose but never bypass.** The plugin contract is a capability-bounded sandbox. Plugins cannot mutate state, resolve gates, or alter policy.
4. **Overflow is designed behavior, not loss.** Every queue has finite capacity and explicit overflow policy. Overflow produces artifacts and receipts, not silent data loss.

### 3.3 Runtime State Machine

Adopted from the design memo's Pillar 2, unchanged:

```typescript
type RuntimeState =
  | "IDLE"
  | "INTAKE"
  | "SYNTHESIS"
  | "REFLECTION"
  | "HUMAN_REVIEW"
  | "HALTED"
  | "FAILED"
  | "COMPLETE";
```

The full transition table (22 transitions, illegal transition rejection, halt conditions) is specified in the design memo §Pillar 2. That specification is normative — this PRD does not duplicate it.

### 3.4 Cross-Pillar Reinforcement

The four pillars are not independent modules. They reinforce each other:

- **DSG × ESMB**: Governance is implemented as transition guards. Transitions carry policy version evidence.
- **ESMB × CPA**: Plugins run on named hooks in named states. They propose, not commit, transitions.
- **CPA × BBWOP**: Plugin work is bounded by queue capacity. Overflow handled by summary plugins.
- **BBWOP × DSG**: Queue pressure triggers governance. Low-stakes overflow degrades gracefully; governance-critical overflow halts.

These reinforcement patterns are tested by cross-pillar ISC criteria in Slice 6.

---

## 4. Implementation Slices

### Slice 1: Runtime Type Layer

**Scope**: Define all type contracts for the runtime spine. This is the foundation that both pillar implementations and river implementations depend on. No business logic — pure types and interfaces.

**Files**:
- `src/runtime/state-types.ts` — RuntimeState, RuntimeEvent, TransitionGuardResult, HaltReason, TransitionReceipt
- `src/runtime/governance-types.ts` — GovernanceSpeed, GovernanceActionClass, GovernanceDecision
- `src/runtime/buffer-types.ts` — BoundedBuffer\<T\> interface, OverflowPolicy, OverflowAction, QueueClass, QueueConfig
- `src/runtime/plugin-types.ts` — PluginCapability, PluginHook, ObserverPluginManifest, PluginContext, ObserverPlugin, PluginResult

**ISC Criteria**:
- [ ] ISC-P01: All four type files compile with strict TypeScript (no `any`, no implicit `undefined`) | Verify: `tsc --strict`
- [ ] ISC-P02: `RuntimeState` enum covers all 8 states from design memo | Verify: type check
- [ ] ISC-P03: `GovernanceDecision` discriminated union covers FAST_ALLOWED, SLOW_REQUIRED, DISALLOWED | Verify: type check
- [ ] ISC-P04: `BoundedBuffer<T>` interface supports: accept, reject, evict, query depth/capacity, soft/hard threshold reporting | Verify: type check
- [ ] ISC-P05: `ObserverPlugin` interface supports: manifest declaration, setup, hook-dispatched run, teardown | Verify: type check
- [ ] ISC-P06: `TransitionReceipt` carries: priorState, nextState, actor, timestamp, guardResults, policyVersion, queueSnapshot | Verify: type check
- [ ] ISC-P07: Types are importable by both `src/runtime/` (pillar implementations) and `src/rivers/` (river implementations) without circular dependencies | Verify: import test

**Dependencies**: None. Build first.

**Note**: This slice supersedes Rivers PRD Slice 2. Rivers Slices 3+ import from these files directly.

---

### Slice 2: State Machine + Transition Ledger

**Scope**: Implement the runtime state machine with the full 22-transition table from the design memo. Implement the append-only transition ledger. Illegal transitions throw `IllegalRuntimeTransitionError`.

**Files**:
- `src/runtime/state-machine.ts` — Transition table, guard evaluation, transition executor
- `src/runtime/transition-ledger.ts` — Append-only receipt writer (hot path: `tmp/runtime-ledger.ndjson`)

**ISC Criteria**:
- [ ] ISC-P08: All 22 legal transitions from the design memo's transition table are executable | Verify: unit test per transition
- [ ] ISC-P09: Every illegal transition (IDLE→COMPLETE, SYNTHESIS→COMPLETE, HALTED→COMPLETE, any unlisted pair) throws `IllegalRuntimeTransitionError` | Verify: unit test with exhaustive illegal pairs
- [ ] ISC-P10: No self-transitions without explicit idempotent rule | Verify: unit test
- [ ] ISC-P11: Every committed transition produces a `TransitionReceipt` in the ledger | Verify: unit test checking ledger after transition
- [ ] ISC-P12: Transition guards receive current state, proposed next state, and event context | Verify: unit test with mock guard
- [ ] ISC-P13: Ledger is append-only; no receipt modification or deletion | Verify: unit test attempting mutation
- [ ] ISC-P14: Ledger writes to `tmp/runtime-ledger.ndjson` in NDJSON format | Verify: integration test reading file after transitions
- [ ] ISC-P15: State machine exposes current state query (synchronous, no side effects) | Verify: unit test

**Dependencies**: Slice 1.

---

### Slice 3: Governance Policy

**Scope**: Implement the governance policy classifier. Given an action class, return FAST_ALLOWED, SLOW_REQUIRED, or DISALLOWED with policy version. Implement boundary enforcement rules from the design memo.

**Files**:
- `src/runtime/governance-policy.ts` — Policy classifier, action class registry, boundary enforcement

**ISC Criteria**:
- [ ] ISC-P16: All 8 `GovernanceActionClass` values from the design memo are classified | Verify: unit test per action class
- [ ] ISC-P17: SESSION_OPERATION and TASK_EXECUTION classify as FAST_ALLOWED under default policy | Verify: unit test
- [ ] ISC-P18: HUMAN_GATE_RESOLUTION and ARCHITECTURAL_CHANGE classify as SLOW_REQUIRED | Verify: unit test
- [ ] ISC-P19: Every GovernanceDecision includes a `policyVersion` string | Verify: unit test
- [ ] ISC-P20: SLOW_REQUIRED decisions include a `gateType` identifying which gate blocks | Verify: unit test
- [ ] ISC-P21: DISALLOWED decisions include a `reason` string | Verify: unit test
- [ ] ISC-P22: Governance policy integrates with state machine as a transition guard: SLOW_REQUIRED triggers HUMAN_REVIEW transition | Verify: integration test with state machine from Slice 2

**Dependencies**: Slices 1, 2.

---

### Slice 4: Bounded Buffer + Overflow Policy

**Scope**: Implement the generic bounded buffer and per-queue overflow policies. Five queue classes from the design memo with soft/hard thresholds and explicit overflow behavior.

**Files**:
- `src/runtime/bounded-buffer.ts` — Generic `BoundedBuffer<T>` implementation
- `src/runtime/overflow-policy.ts` — Per-queue overflow policy implementations

**ISC Criteria**:
- [ ] ISC-P23: `BoundedBuffer<T>` enforces hard capacity limit — accept() returns false at hard limit | Verify: unit test filling to capacity
- [ ] ISC-P24: Soft threshold triggers emit an overflow_warning event before hard limit | Verify: unit test at soft threshold
- [ ] ISC-P25: All 5 queue classes from design memo (ingestion, processing, governance, receipt, overflowSummary) are configurable | Verify: unit test instantiating each
- [ ] ISC-P26: ingestionQueue overflow: summarize + defer at soft, stop intake at hard | Verify: unit test
- [ ] ISC-P27: governanceQueue overflow: saturation warning at soft, HALT at hard, never drop a gate | Verify: unit test — gate items survive overflow
- [ ] ISC-P28: receiptQueue overflow: governance-critical receipts halt runtime; non-critical spill to file | Verify: unit test distinguishing criticality
- [ ] ISC-P29: Overflow produces artifacts (file path recorded) — not silent data loss | Verify: unit test checking artifact existence after overflow
- [ ] ISC-P30: Buffer depth and capacity are queryable at any time (for state machine guards and metrics) | Verify: unit test

**Dependencies**: Slice 1.

---

### Slice 5: Plugin Contract + Registry + Validator

**Scope**: Implement the plugin capability model, registration lifecycle (submit → validate → approve → enable → drain → remove), and manifest validation.

**Files**:
- `src/runtime/plugin-contract.ts` — Capability enforcement, hook dispatch boundary
- `src/runtime/plugin-registry.ts` — Lifecycle management
- `src/runtime/plugin-validator.ts` — Manifest validation rules

**ISC Criteria**:
- [ ] ISC-P31: Plugin manifest declares: id, version, hooks, capabilities, produces, requiresSlowPathApproval | Verify: type check + unit test
- [ ] ISC-P32: Plugin registration is classified as SLOW_REQUIRED by governance policy | Verify: integration test with Slice 3
- [ ] ISC-P33: Validator rejects manifests with unknown hook names or capability values | Verify: unit test with invalid manifest
- [ ] ISC-P34: Plugins with `propose_transition` capability can propose but not commit state transitions | Verify: unit test — proposal recorded, state unchanged until machine commits
- [ ] ISC-P35: Plugins cannot: mutate state directly, resolve gates, register other plugins, write outside artifact API, alter queue limits | Verify: unit test per prohibition
- [ ] ISC-P36: Plugin removal follows drain lifecycle: DRAINING → stop dispatch → flush → receipt → REMOVED | Verify: unit test through full lifecycle
- [ ] ISC-P37: Registry exposes list of active plugins with their manifests (for observability) | Verify: unit test
- [ ] ISC-P38: PluginContext provides: sessionId, workUnitId, state, policyVersion, queue snapshots, receipt emitter, artifact writer | Verify: type check + unit test

**Dependencies**: Slices 1, 3 (governance classifies registration).

---

### Slice 6: Runtime Orchestrator + Cross-Pillar Integration

**Scope**: Wire state machine, governance, buffers, and plugin registry into a single runtime orchestrator. Verify cross-pillar reinforcement patterns from the design memo.

**Files**:
- `src/runtime/runtime-orchestrator.ts` — Wires all components, exposes unified API

**ISC Criteria**:
- [ ] ISC-P39: Orchestrator initialises state machine, governance, 5 queue instances, and plugin registry | Verify: integration test
- [ ] ISC-P40: **DSG × ESMB**: Governance decision is evaluated as a transition guard — SLOW_REQUIRED blocks transition until gate resolved | Verify: integration test
- [ ] ISC-P41: **ESMB × CPA**: Plugin hooks fire only in their declared states (onIntake only in INTAKE, onSynthesis only in SYNTHESIS, etc.) | Verify: integration test — wrong-state dispatch rejected
- [ ] ISC-P42: **CPA × BBWOP**: Plugin-produced artifacts count against queue capacity | Verify: integration test with plugin filling buffer
- [ ] ISC-P43: **BBWOP × DSG**: governanceQueue hard cap triggers HALTED transition | Verify: integration test
- [ ] ISC-P44: Orchestrator exposes runtime health query: current state, queue depths, active plugins, policy version | Verify: unit test
- [ ] ISC-P45: Full lifecycle test: IDLE → INTAKE → SYNTHESIS → REFLECTION → COMPLETE → IDLE with receipts at every transition | Verify: integration test

**Dependencies**: Slices 2, 3, 4, 5.

---

### Slice 7: Existing Module Migration

**Scope**: Wire existing s1, s2, s4, s7, s8 modules as runtime clients. Domain logic unchanged — routing changes to go through the runtime spine.

**Files** (modifications, not new):
- `src/s1/adapter.ts` — Emit normalized runtime intake events
- `src/s8/stop-orchestrator.ts` — Become runtime-managed completion phase
- `src/s7/sovereignty.ts` — Called by governance guards (no change to logic, wiring only)
- `src/s7/task-failure.ts`, `src/s7/process-quality.ts` — Become slow-path gate producers
- `src/s4/deliberation.ts` — Run within SYNTHESIS/REFLECTION runtime states
- `src/s2/session-capture.ts`, `src/s2/tension-tracker.ts` — Become runtime plugins

**ISC Criteria**:
- [ ] ISC-P46: `s1/adapter.ts` emits events that the runtime orchestrator's INTAKE state processes | Verify: integration test
- [ ] ISC-P47: `s7/task-failure.ts` and `s7/process-quality.ts` produce SLOW_REQUIRED gates via governance policy | Verify: integration test
- [ ] ISC-P48: `s4/deliberation.ts` executes only in SYNTHESIS or REFLECTION runtime states | Verify: integration test — execution rejected in other states
- [ ] ISC-P49: `s2/session-capture.ts` conforms to plugin contract with `observe_events` + `emit_receipts` capabilities | Verify: unit test
- [ ] ISC-P50: `s8/stop-orchestrator.ts` triggers COMPLETE transition and receipt flush | Verify: integration test
- [ ] ISC-P51: All existing tests continue to pass after migration | Verify: full test suite
- [ ] ISC-P52: No domain logic in s0–s9 modules is modified — only routing/wiring changes | Verify: code review (diff shows no logic changes)

**Dependencies**: Slice 6.

---

## 5. Dependency Graph

```
Slice 1 (Type Layer)
    │
    ├───────────────┬───────────────┐
    ▼               ▼               ▼
Slice 2          Slice 4         [Rivers PRD]
(State Machine)  (Buffer)        Slices 3-5
    │               │
    ▼               │
Slice 3             │
(Governance)        │
    │               │
    ├───────────────┤
    ▼               ▼
Slice 5
(Plugin)
    │
    ▼
Slice 6
(Orchestrator)
    │
    ▼
Slice 7
(Migration)
```

---

## 6. Build Waves

| Wave | Slices | Parallelism | Rationale |
|------|--------|-------------|-----------|
| **Wave 1** | P1 | Sequential | Type layer — everything depends on this |
| **Wave 2** | P2, P4 | Parallel | State machine and buffer have no dependency on each other |
| **Wave 3** | P3, P5 | Partially parallel | Governance depends on P2; Plugin depends on P1 and P3. P5 starts after P3 completes. |
| **Wave 4** | P6 | Sequential | Orchestrator wires all components |
| **Wave 5** | P7 | Sequential | Module migration requires working orchestrator |

See the unified build plan for how these waves interleave with Rivers PRD waves.

---

## 7. Motif Predictions

| Motif | Prediction | Test Mechanism |
|-------|-----------|----------------|
| **ESMB** | One state machine governs all runtime motion. No module transitions state independently. | ISC-P08, ISC-P09, ISC-P48 |
| **DSG** | One policy function classifies every action as fast/slow/disallowed. No module self-classifies. | ISC-P16–P22, ISC-P40 |
| **CPA** | Plugins observe and propose. They never bypass the state machine or governance. | ISC-P34, ISC-P35, ISC-P41 |
| **BBWOP** | Every queue has finite capacity. Overflow produces artifacts, not data loss. | ISC-P23–P29, ISC-P43 |

---

## 8. Open Questions

1. **Policy versioning**: How are policy versions generated? Semantic versioning? Content-hash? The design memo specifies that every GovernanceDecision carries a policyVersion but doesn't specify the versioning scheme.

2. **Ledger compaction**: The transition ledger writes to `tmp/runtime-ledger.ndjson` (hot) and compacts daily to `03-Daily/{date}/`. What triggers compaction? Session end? Cron? Timer?

3. **Plugin approval workflow**: Registration requires SLOW_REQUIRED (human approval). What's the UX? A vault document? A CLI prompt? A control plane API?

4. **Existing test coverage**: The memo references `src/s4/types.ts`, `s5/types.ts`, `s7/types.ts` as existing local state machines. How extensive is the existing test suite? Slice 7 ISC-P51 requires all existing tests to pass.

5. **Algebra review gate**: `s7/algebra-review.ts` is listed as a slow-path gate producer but its integration with the governance policy isn't specified. What action class does algebra review map to?

---

## 9. Non-Goals

This PRD does not commit to:

- Replacing domain logic in s0–s9 modules (Slice 7 changes wiring only)
- Building a persistent state machine (runtime state is session-scoped; rivers handle their own persistence)
- Implementing a full plugin marketplace or discovery system (registration is manual and slow-path)
- Optimizing for high-throughput (the runtime serves Observer-native's cognitive workload, not a web server)
- Building the rivers themselves (that's the Rivers PRD's scope)

---

## 10. Success Criteria

The runtime spine is working when:

1. A single state machine governs all runtime transitions with receipt evidence
2. A single governance policy classifies every action and enforces fast/slow boundaries
3. Plugins observe and propose without bypassing governance or the state machine
4. Every queue has bounded capacity with explicit, artifact-producing overflow
5. Existing s0–s9 modules route through the spine without domain logic changes
6. The Rivers PRD can build Slices 3+ against real runtime types, not stubs
7. All 52 ISC criteria pass
