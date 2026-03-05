---
status: DRAFT
date: 2026-03-05
type: skill-modification-proposal
target_skill: ~/.claude/skills/Reflect/SKILL.md
modification: Addition of Operation 8 (Process Reflection)
vault_safety: Skill change proposal. REQUIRES ADAM'S EXPLICIT APPROVAL before any modification to the Reflect skill file. This document proposes; it does not implement.
source: Theory_To_Architecture_20260305.md, Section 2.2-2.4
---

# Proposed Addition: Reflect Skill -- Operation 8 (Process Reflection)

**Date:** 5 March 2026
**Status:** DRAFT -- REQUIRES ADAM'S APPROVAL BEFORE SKILL EDIT
**Author:** Atlas (specification from grounded principles)
**Target:** `~/.claude/skills/Reflect/SKILL.md`

**Design Basis:** Theory_To_Architecture_20260305.md, Sections 2.2-2.4. Design Principle 4: "Reflect must include an explicit self-modeling operation that examines the extraction process, not just the extracted patterns." `[Source: G3, G1, G2]`

---

## What This Proposes

Addition of **Operation 8: Process Reflection** to the Reflect skill, following the existing Operations 5 (Recognition), 6 (Motif Extraction), and 7 (Motif-of-Motif Detection).

This proposal contains:
1. The Operation 8 section text (to be inserted after Operation 7)
2. The updated Workflow Routing table entry
3. Completion tests for Operation 8

**This does NOT modify** Operations 5, 6, or 7, the Integration Notes, the Observer Ecosystem Mapping, the Self-Improvement section, or any other existing content.

---

## Proposed Operation 8 Section

The following text is proposed for insertion after the Operation 7 section in `SKILL.md`:

---

### Operation 8: Process Reflection (Self-Modeling)

Examine the extraction process itself. Operations 5-7 ask "what shape is this?" and "what patterns are here?" Operation 8 asks: **"What shaped my seeing? What assumptions in my extraction process determined which patterns I found?"**

`[Source: G3 -- systems that model their own selection process produce categorically new information irreducible from the inputs]`

This operation makes Reflect categorically different from a pattern-matching pass. The information produced by analysing the filter's transfer function is not in the signal and not derivable from the signal alone.

**Inputs:**
- The session's Oscillate output (perspectives generated)
- The session's Converge output (what survived, what was killed)
- The Reflect Operations 5-7 output (recognition, motifs, meta-motifs)
- The motif library's current state (especially axis distribution at `02-Knowledge/motifs/`)

**Process:**

1. **Transfer function analysis:** What did the convergence filter pass and reject? What properties of the surviving perspectives correlate with survival? Is there a pattern in what gets killed -- a systematic blind spot in how the session evaluated perspectives?

2. **Independence audit:** Were the Oscillate perspectives genuinely independent? Did they share assumptions that were not made explicit? How much of the convergence was real triangulation vs. confirmation from correlated sources?
   `[Source: G1 -- signal extraction depends on independence of measurements]`

3. **Axis balance check:** Of the motifs extracted in this session (Operation 6 output), what is their axis distribution across Differentiate, Integrate, and Recurse? If all new motifs are differentiate-axis or integrate-axis, the session's cognitive process was imbalanced -- it differentiated or integrated well but did not recurse. Flag the imbalance.
   `[Source: G5 -- recursion axis underpopulated, indicating systematic bias]`

4. **Observation perturbation accounting:** How did this session change the observation framework? What will the system see differently next time because of what was found this time? What new lenses, assumptions, or sensitivities were created or modified?
   `[Source: G2 -- observation modifies the observer's frame]`

**Outputs:**
- **Transfer function summary:** What the session's filter selected for and against, with evidence
- **Independence score:** Estimate of genuine independence across the session's perspectives (high/medium/low with reasoning)
- **Axis balance report:** Distribution of session outputs across D/I/R, with imbalance flag if applicable
- **Framework delta:** What changed in the observation apparatus -- new lenses, shifted assumptions, altered sensitivities
- **Process motif candidates:** Patterns in how the session unfolded (not in its content). These are structurally distinct from content motifs (Operation 6) because they describe the extraction process, not the extracted material

**Gate:** Operation 8 runs only when the full triad (Oscillate + Converge + Reflect Ops 5-7) has been executed in the session. If the session was a standalone reflection without a preceding Oscillate/Converge cycle, Operation 8 is skipped -- there is no extraction process to analyse.

**Relationship to Operation 7:** Operation 7 (Motif-of-Motif) looks for patterns among patterns in the content. Operation 8 looks for patterns in the process of pattern extraction. These are orthogonal: Operation 7 recurses on the output, Operation 8 recurses on the filter.

---

## Proposed Workflow Routing Table Update

Add one row to the existing routing table:

| Workflow | Triggers | Description |
|----------|----------|-------------|
| `Workflows/Reflect.md` | "reflect", "reflect on this", "what shape is this", "extract motifs", "session review", default post-session | Full reflection cycle: recognition + motif extraction + meta-analysis |
| `Workflows/ProcessReflect.md` | "process reflect", "what shaped my seeing", "analyse the filter", "extraction audit", "how did we see", post-triad completion (automatic) | Process reflection: transfer function analysis + independence audit + axis balance + framework delta |

**Routing logic:** When a full triad session completes (Oscillate + Converge + Reflect), Operation 8 is triggered automatically after Operations 5-7. It may also be triggered manually with the listed trigger phrases.

---

## Proposed Observer Ecosystem Mapping Addition

Add one row to the existing mapping table:

| Operation | Observer Equivalent | Connection |
|---|---|---|
| Process Reflection | Reflector (Council role) | Both examine the observation process itself, not just the observations |

---

## Completion Tests for Operation 8

These eight criteria verify a correct implementation of Operation 8. They are derived from Theory_To_Architecture Section 2.4:

1. **Process Reflection operation takes Oscillate and Converge outputs as explicit inputs.** The operation requires prior triad outputs; it cannot run on a standalone reflection session.

2. **Transfer function analysis identifies at least one filter property per session.** Every triad session has a convergence filter. The analysis must name at least one property that filter selected for or against.

3. **Independence audit flags correlated perspectives when present.** When Oscillate perspectives share unstated assumptions, the independence audit must detect and flag them. (When perspectives are genuinely independent, the audit confirms independence with reasoning.)

4. **Axis balance check reports D/I/R distribution of session outputs.** The check produces a concrete distribution (e.g., "3 differentiate, 2 integrate, 0 recurse"), not a vague assessment.

5. **Framework delta describes at least one change to the observation apparatus.** Every triad session changes the observer's frame. The delta must name at least one specific change (new lens, shifted assumption, altered sensitivity).

6. **Process motif candidates are structurally distinct from content motif candidates.** Process motifs describe how the session unfolded. Content motifs (Operation 6) describe what the session found. The two categories must be distinguishable in output.

7. **Operation 8 output feeds back into next Oscillate cycle as seed material.** The framework delta and process observations are stored and available to inform the next session's lens assignments and perspective generation.

8. **Recursion axis receives at least one candidate per full triad cycle.** Either Operation 6, Operation 7, or Operation 8 contributes at least one recurse-axis motif candidate per complete triad. If none of the three operations produce one, the axis balance check flags the deficit.

---

## Implementation Notes

- Operation 8 is the "missing operation" identified in Theory_To_Architecture Section 2.1-2.2. It completes the cognitive triad's coverage: Ops 1-2 (Oscillate), Ops 3-4 (Converge), Ops 5-7 (Reflect content), Op 8 (Reflect process).
- The gate condition (full triad required) prevents Operation 8 from running without the context it needs. Standalone reflections use Ops 5-7 only.
- The `Workflows/ProcessReflect.md` workflow file would need to be created alongside the skill edit. Its structure should mirror the existing `Workflows/Reflect.md`.
