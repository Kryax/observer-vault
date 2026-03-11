---
date: 2026-03-11
source: opencode/gpt-5.4
status: draft
depends-on:
  - 02-Knowledge/architecture/algebra-implementation-triad-20260311.md
---

# Minimum Viable Algebraic Engine v1

> Scope source: `02-Knowledge/architecture/algebra-implementation-triad-20260311.md`, especially the R section's minimum viable engine definition.

## Problem Statement

Observer-native already has a triad shell, motif library, and sovereignty boundary, but motif evaluation remains narrative rather than computable. The system can surface motif candidates, compare them informally, and store motif knowledge in markdown, yet it cannot normalize candidate evidence, apply algebraic operator tags, evaluate stabilization conditions (`c`, `i`, `d`), or emit governed decisions that stop at the human approval boundary. This leaves the Axiomatic Motif Algebra decorative rather than operational. The minimum viable algebraic engine makes motif evaluation executable without overreaching into automatic motif writing, full collapse decomposition, or OIL integration.

## Success Criteria (ISC)

- [ ] `ISC-AE1` Define typed interfaces for `MotifRecord`, `InstanceRecord`, `CandidateRecord`, and decision outputs in Observer-native source; verify with TypeScript compile and exported type usage.
- [ ] `ISC-AE2` Implement operator vocabulary v0 as a closed typed enum or union containing exactly `rewrite`, `align`, `compress`, `dissolve`, `scaffold`, `reconstitute`, `branch`, `gate`, `buffer`, `converge`; verify by unit test asserting exhaustive membership.
- [ ] `ISC-AE3` Implement normalization from raw motif candidate input into `CandidateRecord` with required fields for domains, evidence refs, operator tags, structural claims, invariants, and falsifiers; verify by fixture-based tests.
- [ ] `ISC-AE4` Implement stabilization predicate `c` that computes distinct-domain count and unrelated-domain threshold for Tier 0 -> 1 eligibility; verify with passing and failing fixtures.
- [ ] `ISC-AE5` Implement stabilization predicate `i` that scores structural invariance from operator-tag overlap plus invariant similarity across instances; verify deterministic scoring on fixed fixtures.
- [ ] `ISC-AE6` Implement stabilization predicate `d` that compares a candidate against existing motif records and emits a derivation conflict flag when similarity exceeds threshold; verify on positive and negative comparison fixtures.
- [ ] `ISC-AE7` Implement decision outputs restricted to `reject`, `hold_t0`, `auto_promote_t1`, `review_for_t2`, `collapse_review`; verify evaluator returns only these values.
- [ ] `ISC-AE8` Wire `review_for_t2` into `s7` sovereignty boundary as a blocked human gate with structured evidence payload; verify blocked execution behavior via test.
- [ ] `ISC-AE9` Implement collapse v0 detection as review flags only, with no automatic decomposition and no file mutation; verify by tests that collapse conditions emit `collapse_review` and stop there.
- [ ] `ISC-AE10` Make `01-Projects/observer-native/src/s3/reflect.ts` Op6 capable of passing candidate output into the new engine without altering the broader triad contract; verify existing reflect output shape remains backward compatible.
- [ ] `ISC-AE11` Add a regression fixture derived from `02-Knowledge/motifs/codex-dir-metamorphosis-language-20260311.md` and prove the engine can evaluate its three motif candidates, including at least one derivation-conflict outcome and no Tier 2 auto-promotion.
- [ ] `ISC-AE12` Confirm the engine performs no automatic motif file writing, no full `↓` decomposition, no OIL integration, and no verb ontology expansion beyond v0; verify by code search and test coverage.

## Scope Boundary

### In Scope

- Typed entity model: `MotifRecord`, `InstanceRecord`, `CandidateRecord`
- Operator vocabulary v0 only
- Stabilization evaluator for `c`, `i`, `d`
- Decision outputs: `reject`, `hold_t0`, `auto_promote_t1`, `review_for_t2`, `collapse_review`
- Sovereignty integration for Tier 2 review and above
- Collapse v0 review detection only
- Regression evaluation of the Codex metamorphosis x language note
- Minimal Op6 wiring into the engine

### Out of Scope

- Automatic motif file writing
- Full `↓` decomposition engine
- Grand verb ontology beyond operator vocabulary v0
- Any redesign of the triad pipeline beyond Op6 wiring
- OIL integration
- Automatic updates to `MOTIF_INDEX.md` or motif markdown files

## Slices

### Slice 1 - Algebra Core Types And Operator Vocabulary

**Delivers**

- New typed interfaces for `MotifRecord`, `InstanceRecord`, `CandidateRecord`
- Typed decision output union
- Operator vocabulary v0 as a closed set
- Serialization-safe shapes for evidence refs, invariants, falsifiers, and comparison reports

**Acceptance Criteria**

- All new types compile and are exported from the appropriate module boundary
- Operator vocabulary is exhaustive and cannot be extended accidentally without type changes
- Example fixtures for one existing motif and one candidate can be represented without ad hoc fields

**Dependencies**

- `02-Knowledge/architecture/algebra-implementation-triad-20260311.md`
- `02-Knowledge/motifs/_SCHEMA.md`
- Current Observer-native type layout in `src/s0/` and `src/s3/`

**Estimated Complexity**

- Medium

### Slice 2 - Candidate Normalization And Library Adapters

**Delivers**

- Adapter logic that converts raw motif candidate outputs into `CandidateRecord`
- Library adapter logic that converts motif-library records into `MotifRecord`-compatible comparison inputs
- Explicit handling for schema drift and missing fields without mutating source files

**Acceptance Criteria**

- Normalization succeeds on representative current-library records and the Codex note fixture
- Missing or drifted fields are surfaced as validation warnings, not silent defaults
- No file writing occurs during normalization

**Dependencies**

- Slice 1 complete
- Access to current motif schema and index

**Estimated Complexity**

- Medium-High

### Slice 3 - Stabilization Evaluator (`c`, `i`, `d`)

**Delivers**

- Predicate `c` for distinct-domain counting and unrelated-domain thresholding
- Predicate `i` for operator-tag overlap and invariant similarity scoring
- Predicate `d` for non-derivability via similarity threshold plus human-review flag
- Structured comparison report for candidate vs library motifs

**Acceptance Criteria**

- `c` passes two-domain and three-domain positive cases and fails single-domain cases
- `i` produces deterministic scores for identical fixture input
- `d` flags overlap conditions without auto-rejecting genuinely ambiguous cases
- Evaluator emits enough evidence for human review rather than just a bare score

**Dependencies**

- Slice 2 complete
- Existing motif library available as comparison corpus

**Estimated Complexity**

- High

### Slice 4 - Decision Engine And Sovereignty Gate Wiring

**Delivers**

- Decision resolver for `reject`, `hold_t0`, `auto_promote_t1`, `review_for_t2`, `collapse_review`
- Integration with `01-Projects/observer-native/src/s7/sovereignty.ts` for blocked human review on `review_for_t2`
- Structured review payload including candidate evidence, stabilization scores, and derivation conflicts

**Acceptance Criteria**

- No decision outside the approved output set can be emitted
- `review_for_t2` produces a blocked gate that must be resolved before continuation
- `auto_promote_t1` does not bypass governance intended only for Tier 2+
- The implementation makes no motif file changes and does not write approval results back into the vault

**Dependencies**

- Slice 3 complete
- Existing `s7` gate types and enforcement behavior

**Estimated Complexity**

- Medium

### Slice 5 - Collapse v0 Review Signals

**Delivers**

- Collapse detection hooks that emit `collapse_review` when derivation conflicts, failed falsification signals, or process-pathology indicators exceed threshold
- Review-only handling with no automatic decomposition or demotion

**Acceptance Criteria**

- Collapse conditions are explicit and test-covered
- `collapse_review` never mutates motif records or decomposes them automatically
- Routine ambiguity does not trigger collapse by default

**Dependencies**

- Slice 4 complete
- Existing process-quality and evaluator outputs

**Estimated Complexity**

- Medium

### Slice 6 - Op6 Wiring And Regression Fixture

**Delivers**

- Minimal wiring from `01-Projects/observer-native/src/s3/reflect.ts` Op6 output into the algebraic engine
- Regression fixture derived from `02-Knowledge/motifs/codex-dir-metamorphosis-language-20260311.md`
- End-to-end evaluation proving the engine can classify the three candidate motifs without Tier 2 auto-promotion

**Acceptance Criteria**

- Existing Reflect return contract remains intact
- The Codex fixture yields:
  - `Constraint-Field Reorganization` -> evaluable, no Tier 2 auto-promotion
  - `Scaffolded Reconstitution Through Selective Loss` -> derivation conflict or equivalent review signal
  - `Alignment by Compression` -> evaluable but held below Tier 2 pending more evidence
- No OIL dependency is introduced

**Dependencies**

- Slices 1-5 complete
- Stable fixture derived from the Codex note

**Estimated Complexity**

- Medium

## Governance Notes

- Adam's approval is required before any build begins, because this PRD introduces a new decision-bearing engine inside Observer-native.
- Adam's approval is required before any execution path may emit `review_for_t2` in live flows, because that changes governance behavior even if it does not auto-promote motifs.
- Any proposal to expand scope into automatic motif file writing, automatic index mutation, full `↓` decomposition, or OIL integration requires a separate PRD and explicit approval.
- Any change to the hook adapter interface while wiring Op6 into the engine is out of scope and must stop for approval.
- Tier 2+ promotion remains human-sovereign; this PRD only permits preparation of review packets and blocked gates, never autonomous lift completion.

## Falsification

- If the engine cannot produce materially different, more disciplined decisions than the current prose workflow, the PRD is unnecessary.
- If normalization of existing motif records proves so lossy or brittle that current library data cannot be adapted without rewriting the library first, this PRD is premature.
- If `d` cannot be made operational even as a threshold-plus-review flag, the algebraic engine collapses into a scoring veneer and should not proceed.
- If sovereignty integration cannot be achieved without invasive changes beyond `s7` wiring and Op6 handoff, the MVP scope is wrong.
- If the Codex metamorphosis x language regression case cannot be evaluated deterministically enough to distinguish evaluable candidates from derivation-conflicted ones, the engine is not yet viable.

## Notes For Execution Review

- This PRD intentionally stops short of persistence. The engine evaluates, scores, and gates; it does not write motifs.
- The first proof of value is not library automation. It is showing that Observer-native can evaluate motif candidates in a repeatable way up to the human boundary.
