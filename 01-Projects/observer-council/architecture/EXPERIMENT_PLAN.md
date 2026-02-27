# Experiment Plan: Angular Separation, Review Fatigue, Perspective Presentation

**Status:** Experiment design only (no code, no repos, no governance mechanisms)
**Input:** Q5 pressure map, empirical questions E1–E3
**Date:** 2026-02-10

---

## Experiment 1: Angular Separation Detection (E1)

**Question:** Can a human distinguish genuine angular separation from performative diversity in synthesized team outputs?

**What decision it informs:** Whether angular separation is an enforceable invariant or an aspirational value. If detection accuracy is low, angular separation cannot serve as an exit gate — it can only serve as a design intent.

**Input:**
- Two Agent Team runs on the *same problem* (a real task, not a toy). Problem should be non-trivial with genuinely multiple valid approaches — e.g., "design the receipt format for team exits" or "propose how to handle CONF-01 (security vs human authority)."
- **Run A ("Divergent"):** Teammates spawned with prompts that force structurally different analytical frames. Example: one teammate reasons from the constitution's verification doctrine, another from the human review load constraint, another from a "what would make this fail?" adversarial frame. Different entry points, not just different labels.
- **Run B ("Cosmetic"):** Teammates spawned with prompts that use different role names and vocabulary but share the same underlying analytical approach. Example: "Analyst A," "Analyst B," "Analyst C" — all asked to evaluate the problem and propose a solution. No structural divergence in the prompt.
- Both runs produce a lead synthesis in the same format.

**Procedure:**
1. Run A and Run B on the same day, same problem.
2. Remove teammate role labels from the outputs (blind the presentation).
3. Present both synthesized outputs to Adam in random order, labeled only "Output X" and "Output Y."
4. Adam reads both and answers: (a) Which output, if either, contains genuinely distinct perspectives? (b) What specific evidence supports that judgment? (c) Confidence level (high/medium/low).
5. Reveal which was Divergent and which was Cosmetic.
6. Adam self-assesses: Was the evidence I cited actually diagnostic, or could it have appeared in either?

**Success metric:** Adam correctly identifies the Divergent output with high confidence AND cites evidence that is actually diagnostic (present in Divergent, absent in Cosmetic). Partial success: correct identification but low confidence or non-diagnostic evidence.

**Expected failure mode:** Both outputs look similarly diverse because the same underlying model produces plausible-sounding disagreements regardless of prompt structure. Adam either guesses correctly without reliable signal, or identifies the wrong one. This would indicate self-similarity is not detectable at the synthesis level.

---

## Experiment 2: Review Fatigue Threshold (E2)

**Question:** At what exit review frequency does human evaluation quality degrade?

**What decision it informs:** The practical throughput ceiling for boundary governance. This constrains how many Agent Teams can run in parallel under the current model (human reviews every exit). If the ceiling is low (3-4 reviews/day), the system design must account for it.

**Input:**
- A sequence of 6 Agent Team tasks of mixed complexity, run consecutively in a single working session. Tasks should span the realistic range:
  - 2 simple (research summary, file inventory)
  - 2 moderate (design proposal, analysis with tradeoffs)
  - 2 complex (multi-file implementation plan, architectural decision with constitutional implications)
- Order: interleave complexity (not all simple first). Suggested: moderate, simple, complex, simple, moderate, complex.

**Procedure:**
1. Run all 6 tasks. Each produces a standard exit output (synthesis + receipt).
2. Adam reviews each exit as it completes, performing the same evaluation: Does this output satisfy the boundary governance requirements? (Coherent output, receipt present, material sufficient for judgment, any constitutional concerns?)
3. For each review, record:
   - Time spent (wall clock, self-reported)
   - Number of constitutional principles explicitly considered (even informally)
   - Subjective depth rating: "thorough / adequate / skimmed / rubber-stamped"
   - One sentence on what, if anything, you would have caught with more time
4. After all 6 reviews, Adam self-assesses: At which review number did quality start to degrade? Was the degradation driven by fatigue, boredom, trust accumulation, or something else?

**Success metric:** This experiment does not have a pass/fail — it produces a data point. The output is: (a) an approximate review count where degradation begins, (b) the dominant degradation driver, and (c) whether complexity modulates the threshold (do complex tasks sustain attention longer than simple ones?).

**Expected failure mode:** Adam maintains consistent review quality across all 6 because the experiment is self-aware — knowing you're being measured changes the behavior (Hawthorne effect). This would mean the experiment measures *motivated* review capacity, not *natural* review capacity. The gap between these is itself informative: it tells you how much review quality depends on conscious effort versus default behavior.

---

## Experiment 3: Raw Perspectives vs. Synthesis Only (E3)

**Question:** Does preserving raw teammate perspectives alongside the lead's synthesis improve or degrade human judgment?

**What decision it informs:** Whether exit outputs should include raw teammate perspectives, only the lead's synthesis, or both. This directly shapes what the exit boundary looks like in practice.

**Input:**
- Two different Agent Team tasks of comparable complexity and domain (both design tasks, or both analysis tasks — not one of each).
- Both tasks use the same team structure (lead + 3 teammates, same divergence approach).
- **Task P ("Perspectives preserved"):** Exit output includes the lead's synthesis AND each teammate's raw perspective, clearly separated.
- **Task S ("Synthesis only"):** Exit output includes only the lead's synthesis. Raw teammate perspectives are generated but not shown.

**Procedure:**
1. Run Task P and Task S on different days (to avoid direct comparison bias) or, if same day, with a meaningful break between them.
2. Adam reviews each exit with the same evaluation criteria: Is this output trustworthy? Are the conclusions well-supported? Do I have enough information to approve or reject?
3. For each review, record:
   - Time spent
   - Confidence in approval/rejection decision (high/medium/low)
   - Specific concerns or questions that arose during review
   - Whether you wanted information that wasn't present
4. After both reviews, reveal the conditions and self-assess:
   - Did the raw perspectives change your judgment on Task P?
   - Did you feel *under-informed* reviewing Task S?
   - Did the raw perspectives in Task P create *noise* (too much information)?
   - If you could design your preferred exit format, what would it include?

**Success metric:** The experiment produces a stated preference with reasoning — not a statistical result. Adam identifies whether raw perspectives were (a) essential to judgment, (b) helpful but not essential, (c) neutral, or (d) actively harmful (noise, distraction, slower review). Any of these outcomes is informative.

**Expected failure mode:** The two tasks are different enough that comparison is unreliable. Adam's review of Task P is influenced by the content of the perspectives, not by their presence. This would indicate the experiment needs to be repeated with the same task under both conditions (which requires a longer gap to avoid memory effects).

---

## Experiment 4: Self-Similarity Depth Probe (E1 extension)

**Question:** If Experiment 1 shows that self-similarity is hard to detect at the synthesis level, can it be detected by examining raw teammate outputs directly?

**What decision it informs:** Whether angular separation enforcement requires access to raw perspectives (linking E1 to E3). If self-similarity is detectable in raw outputs but invisible in synthesis, that is strong evidence for preserving raw perspectives at exit.

**Input:**
- Reuse the two runs from Experiment 1 (Divergent and Cosmetic).
- This time, present the *raw teammate outputs* (not the synthesis) from both runs.

**Procedure:**
1. After Experiment 1 is complete and results recorded, present raw perspectives from both runs (still blinded as "Output X teammates" and "Output Y teammates").
2. Adam reads the raw perspectives and answers: (a) Which set contains genuinely distinct reasoning? (b) What specific structural differences (not vocabulary differences) do you observe? (c) Confidence level.
3. Compare detection accuracy at raw-perspective level vs. synthesis level (from Experiment 1).

**Success metric:** Detection accuracy is *higher* with raw perspectives than with synthesis alone. This would validate that synthesis compresses away the signal that distinguishes genuine from performative diversity.

**Expected failure mode:** Detection accuracy is the same or lower. This would suggest the problem is not synthesis compression but model-level convergence — the teammates genuinely did not produce structurally different reasoning regardless of prompt, and no amount of transparency fixes that.

---

## Experiment Sequencing

| Order | Experiment | Depends On | Calendar |
|-------|-----------|------------|----------|
| 1st | Exp 1 (Angular Separation Detection) | Nothing | Day 1 |
| 2nd | Exp 4 (Self-Similarity Depth Probe) | Exp 1 outputs | Day 1 (immediately after Exp 1) |
| 3rd | Exp 3 (Raw vs. Synthesis) | Nothing, but benefits from Exp 1/4 learning | Day 2 |
| 4th | Exp 2 (Review Fatigue) | Nothing, but should be last — it's the most demanding | Day 3 |

**Total time commitment:** ~3 sessions across 3 days. Each session: 1-3 hours depending on task complexity.

---

## What These Experiments Do NOT Test

- Whether the constitution is correct or complete
- Whether Agent Teams produce better work than single agents
- Optimal team size or composition
- Receipt format design
- Any governance mechanism

**What they test:** Three properties of the human-in-the-loop boundary that determine whether boundary governance is viable in practice.
