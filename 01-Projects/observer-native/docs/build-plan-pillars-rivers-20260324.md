---
status: DRAFT
date: 2026-03-24
author: Atlas
type: build-plan
authority: low
domain: [observer-native, runtime, rivers, architecture]
refs:
  - 01-Projects/observer-native/docs/PRD-four-pillars-20260324.md
  - 01-Projects/observer-native/docs/PRD-rivers-20260324.md
  - 01-Projects/observer-native/docs/four_pillars_design_memo.md
provenance: >
  Unified build plan produced by Atlas on 2026-03-24. Answers the question:
  how do the four pillars runtime spine and the rivers architecture get built
  together without duplication or blocking?
---

# Unified Build Plan: Pillars + Rivers

## 1. The Problem

Two PRDs share the same runtime spine:

- **PRD-20260324-four-pillars** (59 ISC criteria, 7 slices): Builds the runtime spine itself — state machine, governance, buffers, plugins.
- **PRD-20260324-rivers** (54 active ISC criteria, 9 active slices): Builds the cognitive circulation layer — three rivers, pairing service, convergence detection.

Rivers are clients of the runtime spine. The runtime spine exists to serve clients like rivers (and the existing s0–s9 modules). Building them sequentially wastes time. Building them without coordination creates interface mismatches.

## 2. Analysis

### What the Rivers PRD originally assumed

Rivers Slice 2 defined stub interfaces (`src/runtime/stubs.ts`) for rivers to code against. This was pragmatic — get rivers flowing without waiting for the full runtime — but it creates debt:

1. Stubs must be replaced when real implementations arrive
2. Stubs can diverge from real implementations if designed independently
3. Two PRDs defining the same types (`state-types.ts`) is a governance violation

### What actually needs to happen

The runtime type layer is shared infrastructure. It should be built once, correctly, by the Pillars PRD. Rivers consume it directly.

### Key insight: types unlock both; implementations are independent

Once the runtime type layer (Pillars Slice 1) exists:
- Pillar implementations (state machine, governance, buffer, plugin) can proceed
- River implementations (intake, processing, reflection) can proceed
- They don't block each other because rivers depend on type contracts, not implementations

Rivers can use thin passthrough implementations initially (the runtime types compile; the behavior is minimal). As pillar slices deliver real implementations, rivers automatically get richer behavior without code changes — because they code against interfaces, not implementations.

## 3. Decisions

### Decision 1: Rivers Slice 2 is eliminated

Rivers PRD Slice 2 ("Runtime Spine Interfaces — River Subset") is superseded by Pillars Slice 1 ("Runtime Type Layer"). The types Rivers Slice 2 would have defined are a strict subset of what Pillars Slice 1 defines. No stubs needed.

**Impact on Rivers PRD**: Slices renumber. What was Rivers Slice 3 (Intake) now depends on Pillars Slice 1 instead of Rivers Slice 2. All other river slices shift accordingly.

### Decision 2: The design memo is not sufficient without a PRD

The four pillars design memo (2026-03-13) is excellent design work. It has:
- Gap analysis per pillar
- Concrete type definitions
- Transition table with 22 transitions
- Queue classes with hard/soft limits
- Plugin contract with capability model
- Cross-pillar reinforcement analysis

It does not have:
- Numbered build slices
- ISC criteria per slice
- Verification methods
- Dependency graph
- Build waves

Without ISC criteria, there's no way to know when a pillar is "done." The design memo describes what to build; the PRD specifies how to verify it's built correctly. Both are needed.

### Decision 3: Interleaved build, not sequential

Building all 7 pillar slices before starting rivers would delay river work by the entire pillar build. Building rivers with stubs before pillars would create replacement debt. The right answer is interleaved: shared types first, then parallel tracks.

## 4. Unified Build Schedule

### Revised Slice Numbering

After eliminating Rivers Slice 2, the river slices renumber:

| Original Rivers Slice | New ID | Name |
|----------------------|--------|------|
| R-Slice 1 | R1 | PairedRecord types + River interface |
| R-Slice 2 | ~~eliminated~~ | ~~absorbed into P1~~ |
| R-Slice 3 | R2 | Intake river |
| R-Slice 4 | R3 | Processing river + record state machine |
| R-Slice 5 | R4 | Reflection river |
| R-Slice 6 | R5 | Pairing service |
| R-Slice 7 | R6 | Cross-river wiring |
| R-Slice 8 | R7 | Convergence detection |
| R-Slice 9 | R8 | Pipeline integration |
| R-Slice 10 | R9 | Vault integration + session traces |

Pillar slices keep their numbering (P1–P7).

### Build Waves

```
Wave 1 ─── FOUNDATION (parallel)
│
├── P1: Runtime Type Layer
│   └── src/runtime/{state,governance,buffer,plugin}-types.ts
│
└── R1: PairedRecord Types + River Interface
    └── src/rivers/{types,river,degenerate}.ts

Wave 2 ─── CORE INFRASTRUCTURE (parallel)
│
├── P2: State Machine + Transition Ledger
│   └── src/runtime/{state-machine,transition-ledger}.ts
│
├── P4: Bounded Buffer + Overflow Policy
│   └── src/runtime/{bounded-buffer,overflow-policy}.ts
│
├── R2: Intake River
│   └── src/rivers/{intake,intake-buffer,template-matcher}.ts
│
└── R4: Reflection River
    └── src/rivers/{reflection,reflection-buffer,reflection-store}.ts

Wave 3 ─── GOVERNANCE + PROCESSING (parallel)
│
├── P3: Governance Policy
│   └── src/runtime/governance-policy.ts
│
├── P5: Plugin Contract + Registry
│   └── src/runtime/{plugin-contract,plugin-registry,plugin-validator}.ts
│
└── R3: Processing River + Record State Machine
    └── src/rivers/{processing,processing-state,processing-buffer,processing-store}.ts

Wave 4 ─── WIRING (parallel)
│
├── P6: Runtime Orchestrator
│   └── src/runtime/runtime-orchestrator.ts
│
├── R5: Pairing Service
│   └── src/rivers/{pairing,pairing-store}.ts
│
└── R6: Cross-River Wiring
    └── src/rivers/{router,recursion-guard}.ts

Wave 5 ─── INTEGRATION (parallel)
│
├── P7: Existing Module Migration
│   └── Modifications to s1, s2, s4, s7, s8
│
├── R7: Convergence Detection
│   └── src/rivers/{convergence,convergence-types,convergence-store}.ts
│
├── R8: Pipeline Integration
│   └── src/rivers/adapters/{dataset-processor,scraper,governance}.ts
│
└── R9: Vault Integration + Session Traces
    └── src/rivers/{vault-writer,session-trace}.ts
```

### Wave Dependency Table

| Wave | Slices | Depends On | Can Start When |
|------|--------|-----------|----------------|
| **1** | P1, R1 | Nothing | Immediately |
| **2** | P2, P4, R2, R4 | P1, R1 | Wave 1 complete |
| **3** | P3, P5, R3 | P1, P2 | P1 + P2 complete (P4, R2, R4 may still be in progress) |
| **4** | P6, R5, R6 | P2–P5, R2–R4 | Waves 2 + 3 complete |
| **5** | P7, R7, R8, R9 | P6, R6 | Wave 4 complete |

### Parallelism Within Waves

| Wave | Max parallel slices | Why parallel is safe |
|------|--------------------|--------------------|
| 1 | 2 | P1 and R1 define types in separate directories (runtime/ vs rivers/) |
| 2 | 4 | P2+P4 are independent pillars; R2+R4 are independent rivers; all depend only on types from Wave 1 |
| 3 | 3 | P3 depends on P2; P5 depends on P3; R3 depends on P1+P2. P3→P5 is sequential within the wave. |
| 4 | 3 | P6 wires pillars; R5+R6 wire rivers. Independent wiring tracks. |
| 5 | 4 | P7 migrates modules; R7/R8/R9 extend rivers. Independent tracks. |

### Critical Path

The longest sequential chain determines minimum build time:

```
P1 → P2 → P3 → P5 → P6 → P7
 1     2    3    3    4    5   = 5 waves
```

Rivers never appear on the critical path because they parallel the pillar chain after Wave 1.

## 5. Interface Contracts Between PRDs

The two PRDs share these interfaces:

| Interface | Defined In | Consumed By |
|-----------|-----------|-------------|
| `RuntimeState` | P1: `state-types.ts` | R3: Processing river state (orthogonal but references runtime states) |
| `GovernanceDecision` | P1: `governance-types.ts` | R2, R3, R4: Fast/slow channel classification |
| `BoundedBuffer<T>` | P1: `buffer-types.ts` | R2, R3, R4: River-specific buffer instances |
| `PluginHook` | P1: `plugin-types.ts` | R6: Cross-river routing fires plugin hooks |
| `TransitionReceipt` | P1: `state-types.ts` | R9: Vault writer produces receipts from river events |

**Contract stability rule**: Once Pillars Slice 1 ships, its type exports are frozen for the remainder of the build. Any type changes require both PRDs to be re-evaluated. This is not bureaucratic overhead — it prevents interface drift between parallel tracks.

## 6. Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Runtime types need revision after rivers start using them | Medium | Medium — river code needs updating | Keep Slice 1 minimal; add fields later via extension, not modification |
| Pillar implementations lag behind river progress | Low | Low — rivers use interface contracts, not implementations | Rivers can test against thin implementations; real behavior arrives later |
| Processing river record state machine conflicts with runtime state machine | Low | High — if they interfere, fundamental design error | Already addressed in Rivers PRD §2.2 Correction 4: they're orthogonal |
| Module migration (P7) breaks existing functionality | Medium | High | ISC-P51 requires full test suite pass; migration is wiring-only |

## 7. Design Decisions Resolved During D/I/R Review (2026-03-24)

The following were open questions across the three documents. All resolved in the Pillars PRD §8:

| Question | Resolution | Pillar PRD Section |
|----------|-----------|-------------------|
| Policy versioning scheme | Content-hash of active policy rules (deterministic, no manual versioning) | §8.1 |
| Ledger compaction trigger | Session end (COMPLETE→IDLE transition) | §8.2 |
| Crash recovery | State machine re-initialises from ledger; crash during SYNTHESIS/REFLECTION → HALTED | §8.3 |
| Plugin approval UX | Vault gate document in 00-Inbox/, resolved via control plane approval | §8.4 |
| Algebra review governance | New ALGEBRA_REVIEW action class, classified SLOW_REQUIRED | §8.5 |

These resolutions added 7 new ISC criteria to the Pillars PRD (ISC-P53 through ISC-P59).

## 8. What This Plan Does NOT Do

- **Rivers PRD Slice 2 is now marked superseded** in the Rivers PRD itself (resolved during D/I/R review).
- **Does not schedule calendar dates.** Waves define dependency order, not deadlines.
- **Does not assign agents.** Which CLI or sub-agent builds which slice is a session-level decision.
- **Does not specify the dataset processor integration.** R8 (Pipeline Integration) depends on the dataset processor being built. That's tracked in its own PRD.

## 9. Recommendation

**Build order: Interleaved, pillar-led.**

1. Start with P1 + R1 in parallel (Wave 1). This is pure type work — fast, low-risk, high-leverage.
2. Once types compile, fan out into Wave 2. Prioritize P2 (state machine) because P3 and P5 depend on it.
3. Rivers proceed in parallel on their own track. They never block on pillar implementations, only on pillar types.
4. The critical path runs through the pillar chain (P1→P2→P3→P5→P6→P7). Keep this chain moving.
5. Rivers reach full wiring (R6) around the same time pillars reach orchestrator (P6). Integration testing happens naturally.

**Total ISC criteria**: 59 (pillars) + 54 (rivers, after eliminating Slice 2's 4 criteria) = **113 ISC criteria across 16 active slices in 5 waves.**

This is a large build. It is also the smallest build that makes the four motifs operational and gives Observer a circulatory system. Everything smaller would be a partial embodiment — which is what we already have.
