---
status: DRAFT
date: 2026-03-13
author: OpenCode
---

# Four Pillars Embodiment Design Memo

## Purpose

Design how the four Tier 2 motifs become operational structure inside `observer-native` without modifying existing source. This memo treats the motifs as architectural requirements for the next runtime spine, not as descriptive metaphors.

## Describe

Observer-native already contains partial embodiments of all four pillars:

- `Dual-Speed Governance` exists in policy and typed gates, but the fast path does not yet consult the slow path before risky execution.
- `Explicit State Machine Backbone` exists in local enums and lifecycle types, but there is no single runtime state machine governing intake, synthesis, review, halt, and completion.
- `Composable Plugin Architecture` exists at the edges (`HookAdapter`, stop handlers), but extension is still static import composition rather than bounded runtime composition.
- `Bounded Buffer With Overflow Policy` exists as ad hoc limits and cleanup behavior, but bounds and overflow outcomes are not modeled as first-class policy.

## Interpret

The missing piece is not more isolated modules. It is a single operational core that all four pillars share:

1. a runtime state machine that owns legal motion,
2. a governance boundary that decides fast-path vs slow-path,
3. a plugin contract that can observe and propose but not bypass the core,
4. bounded queues whose overflow becomes explicit state and receipts.

## Recommend

Embodiment should be centered in a new runtime layer:

- `src/runtime/state-machine.ts`
- `src/runtime/state-types.ts`
- `src/runtime/transition-ledger.ts`
- `src/runtime/governance-policy.ts`
- `src/runtime/plugin-contract.ts`
- `src/runtime/plugin-registry.ts`
- `src/runtime/plugin-validator.ts`
- `src/runtime/bounded-buffer.ts`
- `src/runtime/overflow-policy.ts`

Existing `s1`, `s2`, `s4`, `s6`, `s7`, and `s8` modules remain domain modules, but they route through this runtime core instead of each carrying their own local control flow.

## Proposed Runtime Spine

### Core file map

- `src/runtime/state-types.ts` — runtime states, events, guard results, halt reasons
- `src/runtime/state-machine.ts` — single transition table and transition executor
- `src/runtime/transition-ledger.ts` — append-only transition receipts
- `src/runtime/governance-policy.ts` — fast-path/slow-path decision policy
- `src/runtime/plugin-contract.ts` — plugin manifest, hook contracts, capability limits
- `src/runtime/plugin-registry.ts` — registration, activation, deactivation, removal
- `src/runtime/plugin-validator.ts` — contract validation and authority checks
- `src/runtime/bounded-buffer.ts` — generic bounded queue implementation
- `src/runtime/overflow-policy.ts` — per-queue overflow policies
- `src/runtime/runtime-orchestrator.ts` — wires state machine, policy, registry, and queues

### Existing files that become clients of the runtime

- `src/s1/adapter.ts` — emits normalized runtime intake events instead of only appending NDJSON
- `src/s8/stop-orchestrator.ts` — becomes a runtime-managed completion phase, not a parallel handler array only
- `src/s7/sovereignty.ts` — remains the authority rule source and is called by governance guards
- `src/s7/task-failure.ts`, `src/s7/process-quality.ts`, `src/s7/algebra-review.ts` — become slow-path gate producers
- `src/s4/deliberation.ts` — runs within `SYNTHESIS` and `REFLECTION` runtime states rather than owning top-level lifecycle alone
- `src/s2/session-capture.ts`, `src/s2/tension-tracker.ts` — become runtime plugins with bounded output contracts

## Pillar 1 — Dual-Speed Governance

### Current state

- Governance is strong in declaration: `src/s7/sovereignty.ts` explicitly prohibits AI decisions on scope, governance, and authority.
- Human review gates already exist in `src/s7/task-failure.ts`, `src/s7/process-quality.ts`, and `src/s7/algebra-review.ts`.
- Fast-path execution already exists in `src/s1/adapter.ts`, `src/s8/stop-orchestrator.ts`, and normal session flows.
- `src/s0/isc-evaluator.ts` already distinguishes routine vs foundational work conceptually.

### Gap

- Fast-path runtime does not structurally stop at the slow-path boundary.
- There is no single policy function that classifies a decision as `FAST_ALLOWED`, `SLOW_REQUIRED`, or `DISALLOWED`.
- Governance decisions are typed but not versioned as an explicit runtime policy surface.
- Open review queues, plugin registration, and overflow exceptions are not governed by one consistent slow-path rule set.

### Design

Create `src/runtime/governance-policy.ts` with:

```ts
export type GovernanceSpeed = "FAST" | "SLOW";

export type GovernanceActionClass =
  | "SESSION_OPERATION"
  | "TASK_EXECUTION"
  | "BUFFER_EXCEPTION"
  | "PLUGIN_REGISTRATION"
  | "PLUGIN_REMOVAL"
  | "PROTECTED_PATH_WRITE"
  | "ARCHITECTURAL_CHANGE"
  | "TIER_PROMOTION"
  | "HUMAN_GATE_RESOLUTION";

export type GovernanceDecision =
  | { outcome: "FAST_ALLOWED"; policyVersion: string }
  | { outcome: "SLOW_REQUIRED"; gateType: string; policyVersion: string }
  | { outcome: "DISALLOWED"; reason: string; policyVersion: string };
```

Define the slow-path decisions as:

- human gate resolution
- architectural changes
- changes to transition tables or guard policy
- plugin registration, authority expansion, or removal
- writes to protected paths or governance files
- Tier 2+ motif promotion or classification changes
- overflow exceptions for governance-critical queues
- any action that changes queue limits or overflow policy

Define the fast-path decisions as:

- session start/stop processing within approved policy
- routine intake classification
- task execution within an approved PRD and path budget
- normal plugin hook execution for already-approved plugins
- routine receipt emission
- bounded retries within existing retry policy
- queue spill/defer behavior when policy already authorizes it

Boundary enforcement rules:

- `FAST` path may execute only when the action class maps to `FAST_ALLOWED`.
- `FAST` path may never mutate policy, resolve gates, change plugin authority, or override overflow policy.
- `SLOW_REQUIRED` always transitions runtime to `HUMAN_REVIEW` and emits a gate receipt.
- `DISALLOWED` transitions runtime to `HALTED` or `FAILED` depending on recoverability.

Policy artifact:

- `src/runtime/governance-policy.ts` holds compiled policy logic.
- `docs/runtime_governance_policy.md` documents the human-readable constitutional policy.

### Integration points

- The state machine uses governance policy as a transition guard.
- Plugins cannot self-authorize; registry changes are slow-path only.
- Buffer overflow for governance-critical queues escalates to slow-path instead of silently degrading.
- The transition ledger records the policy version that allowed or blocked each move.

## Pillar 2 — Explicit State Machine Backbone

### Current state

- `src/s4/types.ts` and `src/s4/deliberation.ts` define explicit deliberation steps.
- `src/s5/types.ts` defines explicit PRD lifecycle states.
- `src/s7/types.ts` defines explicit gate states.
- These are good local state machines, but there is no single operational state model for Observer-native as a runtime.

### Gap

- Session intake, synthesis, reflection, human review, halt, failure, and completion are not owned by one enumerated runtime state.
- Transitions are currently spread across modules as assignments and conditionals.
- Illegal transitions are not universally rejected.
- There is no runtime transition ledger for state changes.

### Design

Create `src/runtime/state-types.ts` and `src/runtime/state-machine.ts` around this minimal operational state set:

```ts
export type RuntimeState =
  | "IDLE"
  | "INTAKE"
  | "REFLECTION"
  | "SYNTHESIS"
  | "HUMAN_REVIEW"
  | "HALTED"
  | "FAILED"
  | "COMPLETE";
```

#### State meanings

- `IDLE` — no active work unit loaded
- `INTAKE` — normalize inputs, classify action, allocate queue slots, run pre-execution guards
- `SYNTHESIS` — execute task, deliberation, fan-out, merge, capture, and routine runtime plugins
- `REFLECTION` — run post-pass analysis, quality checks, summarization, receipt compaction, overflow summaries
- `HUMAN_REVIEW` — work is blocked pending human response on a gate
- `HALTED` — intentional stop due to policy, saturation, or sovereignty block; recoverable only through explicit transition
- `FAILED` — unrecoverable execution or invariant failure
- `COMPLETE` — work unit closed, receipts flushed, queues drained or deferred

#### Transition table

- `IDLE -> INTAKE`
  - guard: new session, task, or stop-event work unit arrives
- `INTAKE -> SYNTHESIS`
  - guard: governance decision is `FAST_ALLOWED`, required queue capacity exists, required plugins loaded
- `INTAKE -> HUMAN_REVIEW`
  - guard: governance decision is `SLOW_REQUIRED`
- `INTAKE -> HALTED`
  - guard: protected-path violation, governance queue saturation, missing policy snapshot, or required artifact store unavailable
- `INTAKE -> FAILED`
  - guard: malformed event, invalid runtime payload, or corrupted queue artifact
- `SYNTHESIS -> REFLECTION`
  - guard: execution phase reached terminal operational output and all mandatory receipts emitted
- `SYNTHESIS -> HUMAN_REVIEW`
  - guard: task failure escalation, process-quality escalation, algebra review escalation, or overflow requiring prioritization
- `SYNTHESIS -> HALTED`
  - guard: retry budget exhausted without escalation artifact, governance-critical receipt sink unavailable, or queue hard cap reached on protected class
- `SYNTHESIS -> FAILED`
  - guard: invariant violation, illegal transition proposal, or unhandled runtime exception
- `REFLECTION -> COMPLETE`
  - guard: reflection plugins completed, deferred items receipted, queue state persisted
- `REFLECTION -> HUMAN_REVIEW`
  - guard: reflector-generated process-quality gate, unresolved overflow prioritization, or promotion request
- `REFLECTION -> HALTED`
  - guard: receipt flush incomplete for governance-critical events
- `REFLECTION -> FAILED`
  - guard: reflection artifact corrupted or mandatory output missing
- `HUMAN_REVIEW -> INTAKE`
  - guard: human resolution requires revised intake or reprioritization
- `HUMAN_REVIEW -> SYNTHESIS`
  - guard: human approved retry or provided info/constraint update
- `HUMAN_REVIEW -> HALTED`
  - guard: human explicitly halts or defers the work unit
- `HUMAN_REVIEW -> FAILED`
  - guard: human closes as failed or denial makes completion impossible
- `HUMAN_REVIEW -> COMPLETE`
  - guard: human acknowledges and closes with no further execution
- `HALTED -> INTAKE`
  - guard: halt condition resolved and replay is safe
- `HALTED -> HUMAN_REVIEW`
  - guard: halt reason itself requires human decision
- `HALTED -> FAILED`
  - guard: replay not safe or missing recovery artifact
- `FAILED -> INTAKE`
  - guard: explicit retry authorized by human or policy
- `FAILED -> COMPLETE`
  - guard: failure receipted and closed as terminal
- `COMPLETE -> IDLE`
  - guard: all buffers drained/deferred and ledger flush acknowledged

#### Illegal transitions

- Any transition not in the table throws `IllegalRuntimeTransitionError`.
- No direct `IDLE -> COMPLETE`.
- No direct `SYNTHESIS -> COMPLETE`.
- No direct `HALTED -> COMPLETE`.
- No state can self-transition without an explicit idempotent transition rule.

#### Halt conditions

- governance queue at hard cap
- missing policy snapshot
- missing receipt sink for governance-critical transitions
- unresolved protected-path write attempt
- plugin capability violation
- transition ledger unavailable

#### Receipt ledger

Create `src/runtime/transition-ledger.ts` with append-only receipts written to:

- hot path: `tmp/runtime-ledger.ndjson`
- compacted daily artifact: `03-Daily/{date}/runtime-ledger/{sessionId}.json`

Each transition receipt contains:

```ts
export interface TransitionReceipt {
  receiptId: string;
  sessionId: string;
  workUnitId: string;
  priorState: RuntimeState;
  nextState: RuntimeState;
  eventType: string;
  actor: "system" | "plugin" | "human";
  actorId: string;
  timestamp: string;
  guardResults: Array<{ guard: string; passed: boolean; detail: string }>;
  policyVersion: string;
  queueSnapshot: Record<string, { depth: number; capacity: number }>;
  evidenceRefs: string[];
  gateId?: string;
  overflowArtifactPath?: string;
}
```

### Integration points

- Dual-Speed Governance supplies the guards.
- Plugins can propose transitions but only the state machine commits them.
- Buffer overflow becomes `INTAKE -> HALTED`, `SYNTHESIS -> HUMAN_REVIEW`, or `REFLECTION -> HALTED` depending on queue class.
- Receipts give the audit backbone for governance and plugin actions.

## Pillar 3 — Composable Plugin Architecture

### Current state

- `src/s1/adapter.ts` already defines a bounded adapter interface.
- `src/s8/stop-orchestrator.ts` already has a handler array that behaves like a proto-plugin registry.
- `src/s2` modules are naturally separable concerns: session capture, motif priming, tension tracking, salience.
- The architecture wants extension, but composition is still static and trust is implicit.

### Gap

- No single plugin manifest or capability model.
- No validation step before activation.
- No authority boundary between observe-only plugins and state-affecting plugins.
- No standard lifecycle for registration, disablement, drain, or removal.

### Design

Create `src/runtime/plugin-contract.ts`:

```ts
export type PluginCapability =
  | "observe_events"
  | "read_state"
  | "emit_receipts"
  | "propose_transition"
  | "propose_gate"
  | "write_artifacts"
  | "summarize_overflow";

export type PluginHook =
  | "onIntake"
  | "onSynthesis"
  | "onReflection"
  | "onHumanReview"
  | "onHalt"
  | "onComplete"
  | "onOverflow";

export interface ObserverPluginManifest {
  id: string;
  version: string;
  description: string;
  hooks: PluginHook[];
  capabilities: PluginCapability[];
  produces: string[];
  requiresSlowPathApproval: boolean;
}

export interface PluginContext {
  sessionId: string;
  workUnitId: string;
  state: RuntimeState;
  policyVersion: string;
  queues: Readonly<Record<string, { depth: number; capacity: number }>>;
  receipts: { emit(input: ReceiptInput): void };
  artifacts: { write(input: ArtifactWrite): ArtifactRef };
}

export interface ObserverPlugin {
  manifest: ObserverPluginManifest;
  setup(): Promise<void> | void;
  run(hook: PluginHook, context: PluginContext, input: unknown): Promise<PluginResult> | PluginResult;
  teardown(): Promise<void> | void;
}
```

#### What plugins can observe

- normalized runtime events
- current runtime state
- queue depth/capacity snapshots
- policy version and allowed action class
- prior receipt ids and artifact references exposed through `PluginContext`

#### What plugins can produce

- observations
- derived artifacts
- receipt entries
- transition proposals
- gate proposals
- overflow summaries
- deferred-work packets

#### What plugins cannot do

- mutate runtime state directly
- resolve or dismiss human gates
- register other plugins
- write arbitrary files outside the artifact API
- alter queue limits or overflow policy at runtime
- bypass governance guards
- write protected paths directly

#### Plugin classes

- `Core plugins` — bundled, always present, still bounded by the same contract
- `Approved optional plugins` — slow-path approved and activated by registry
- `Disabled plugins` — installed but inactive
- `Retired plugins` — removed after drain and receipt closure

#### Registration and validation

Create `src/runtime/plugin-registry.ts` and `src/runtime/plugin-validator.ts`.

Registration flow:

1. manifest submitted
2. validator checks hook names, capability set, artifact paths, and compatibility
3. governance policy classifies registration as `SLOW_REQUIRED`
4. human approves or denies
5. registry records plugin as `REGISTERED`
6. activation moves plugin to `ENABLED`

Removal flow:

1. mark plugin `DRAINING`
2. stop new hook dispatch
3. flush in-flight receipts/artifacts
4. emit removal receipt
5. mark `REMOVED`

### Integration points

- State machine decides when each plugin hook can run.
- Governance decides who may register, activate, or remove plugins.
- Buffer policies limit plugin work queues and plugin-produced artifacts.
- Receipts identify which plugin observed, proposed, or emitted each artifact.

## Pillar 4 — Bounded Buffer With Overflow Policy

### Current state

- `src/s1/adapter.ts` writes to `tmp/events.ndjson`.
- `src/s8/handlers/event-cleanup.ts` truncates the event file after stop processing.
- `src/s6/retry.ts` already has a hard retry bound.
- `src/s2/tension-tracker.ts` caps open-tension reads.
- These are useful local limits, but they do not add up to a system-wide overflow policy.

### Gap

- Ingestion and processing queues do not have named capacities and queue classes.
- Overflow behavior is not explicit enough for sovereignty-sensitive work.
- Silent truncation is still possible in the current event path.
- No overflow artifact is produced when pressure changes system behavior.

### Design

Create `src/runtime/bounded-buffer.ts` and `src/runtime/overflow-policy.ts`.

#### Queue classes and limits

1. `ingestionQueue`
   - purpose: normalized session/tool/stop events awaiting intake
   - hard limit: `128` items per active work unit
   - soft threshold: `96`

2. `processingQueue`
   - purpose: synthesis work packets, plugin tasks, deferred reflections
   - hard limit: `24` queued items
   - active concurrency: `4`
   - soft threshold: `16`

3. `governanceQueue`
   - purpose: open human gates and slow-path review packets
   - hard limit: `10` open items
   - soft threshold: `7`

4. `receiptQueue`
   - purpose: pending receipt flushes
   - hard limit: `256` entries or `1 MB`, whichever hits first
   - soft threshold: `192` entries

5. `overflowSummaryQueue`
   - purpose: compacted summaries waiting for reflection
   - hard limit: `32` items

#### Overflow policy by queue

##### `ingestionQueue`

- at soft threshold:
  - summarize oldest low-priority items into one summary artifact
  - emit `overflow_warning` receipt
- at hard limit:
  - stop new fast-path intake for low-priority items
  - emit overflow artifact to `tmp/overflow/{sessionId}/ingestion-{n}.ndjson`
  - defer remainder to `overflowSummaryQueue`
  - if deferred remainder contains governance-sensitive events, transition to `HUMAN_REVIEW`

##### `processingQueue`

- at soft threshold:
  - route low-priority work to slower reflection pass
  - emit `processing_deferred` receipt
- at hard limit:
  - reject new fast-path work
  - defer non-critical items into a future work packet artifact
  - request human prioritization if all remaining items are critical

##### `governanceQueue`

- at soft threshold:
  - emit `governance_saturation_warning`
  - require intake classification to become stricter
- at hard limit:
  - stop intake for any new slow-path-requiring action
  - transition runtime to `HALTED`
  - emit saturation artifact and request human prioritization
  - never drop or summarize away a gate

##### `receiptQueue`

- at soft threshold:
  - force immediate flush attempt
- at hard limit:
  - if receipts are non-governance-critical, spill to `tmp/receipt-spool/`
  - if receipts are governance-critical, halt runtime until flush succeeds

#### Policy summary

- low-criticality overflow: summarize, defer, artifact
- medium-criticality overflow: slow-path reroute
- governance-critical overflow: stop intake, emit artifact, request human prioritization

This makes overflow a designed behavior rather than a loss condition.

### Integration points

- State machine consumes buffer health as a transition guard.
- Governance policy classifies which queues may summarize/defer and which must halt.
- Plugins can propose overflow summaries but cannot decide to drop protected items.
- Transition ledger captures each overflow event, artifact path, and policy basis.

## Cross-Pillar Reinforcement

### Dual-Speed Governance x Explicit State Machine Backbone

- Governance becomes concrete only when it is implemented as transition guards.
- State transitions become legitimate only when they carry a policy version and guard evidence.

### Explicit State Machine Backbone x Composable Plugin Architecture

- Plugins remain bounded because they run on named hooks in named states.
- The state machine stays stable because plugins can propose, not commit, transitions.

### Composable Plugin Architecture x Bounded Buffer With Overflow Policy

- Plugin work is measurable and bounded.
- Overflow can be handled by specialized summary or artifact plugins without changing the runtime core.

### Bounded Buffer With Overflow Policy x Dual-Speed Governance

- Queue pressure is where governance becomes real.
- Low-stakes overflow can degrade gracefully; sovereignty-critical overflow must halt and request human prioritization.

## Recommended First Embodiment Sequence

1. specify `state-types.ts`, `state-machine.ts`, and `transition-ledger.ts`
2. specify `governance-policy.ts` with explicit fast/slow action classes
3. specify `plugin-contract.ts`, `plugin-registry.ts`, and validator rules
4. specify queue classes, hard caps, and overflow artifacts
5. map existing `s1/s2/s4/s7/s8` modules to the new runtime hooks without changing their domain logic yet

## Final judgment

Observer-native already has the right motifs in fragments. To embody them architecturally, it needs one runtime spine where:

- `Dual-Speed Governance` decides whether action stays fast or crosses into human review,
- `Explicit State Machine Backbone` controls legal motion,
- `Composable Plugin Architecture` limits extension to approved bounded hooks,
- `Bounded Buffer With Overflow Policy` turns pressure into explicit artifacts, gates, and receipts.

That is the smallest design that makes the four motifs operational structure instead of accumulated knowledge.
