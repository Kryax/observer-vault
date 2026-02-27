# AMBIGUITY REGISTER -- Observer Constitutional Synthesis

**Status:** Draft synthesis artifact
**Authority:** NONE (draft only)
**Date:** 2026-02-10

This register documents ambiguities detected in source documents during synthesis. No ambiguity is resolved. Possible interpretations and conservative defaults are stated.

---

## AMB-01: What Constitutes "Risky Operations"?

**Topic:** Definition of risk threshold for human approval gates

**Source:** BOUNDARIES.md (A3), "Human Approval Gates" section

**The Ambiguity:** BOUNDARIES.md lists categories requiring approval: "Destructive operations (delete, rm -rf, drop table); Hard-to-reverse operations (force push, reset --hard); Operations visible to others (push, PR, deploy to prod); Financial operations; Security policy changes; External communications." However, no threshold or precise boundary is defined.

**Possible Interpretations:**
- A (Narrow): Only the explicitly listed examples require approval. Moving a file is not "destructive." A local git commit is not "hard-to-reverse."
- B (Moderate): The categories apply broadly. Any operation with permanent data loss risk or external visibility requires approval. Moving a file to /dev/null would be "destructive."
- C (Broad): Any operation that modifies state in ways not trivially reversible requires approval. This would include most file writes.

**Conservative Default:** Interpretation B (moderate). When in doubt about whether an operation is "risky," treat it as risky and require approval.

**Status:** OPEN

---

## AMB-02: What Does "Read-Only" Mean for Observer?

**Topic:** Observer's "read-only" status and its practical limits

**Source:** BOUNDARIES.md (A3), COUNCIL_CONTRACT.md (C4), COUNCIL_CONTRACT docs (C5)

**The Ambiguity:** Observer "has ZERO write authority" and "performs zero filesystem writes." Yet Council "Produces Work Orders" (C6). Work Orders are documents that exist as files. Who writes them to disk? Is generating content in memory (which an executor then writes) considered "writing"?

**Possible Interpretations:**
- A (Strict): Observer generates NO persistent artifacts. Any Work Orders attributed to Observer are actually authored in conversation context and written to disk by the execution system.
- B (Functional): "Read-only" means Observer does not use write/edit/bash tools. An executor transcribes Observer's output to disk. Observer "writes" conceptually but not operationally.
- C (Relaxed): "Read-only" means Observer does not modify existing files. Creating new advisory documents (Work Orders, Job Packets) is permitted.

**Conservative Default:** Interpretation A (strict). Observer generates zero disk artifacts directly. All persistent artifacts are written by the execution layer on Observer's behalf, with human authorization.

**Status:** OPEN

---

## AMB-03: What Is the Boundary of "Approved Scope"?

**Topic:** Granularity of scope approval

**Source:** DOCTRINE.md (A4), "Scope Discipline"; BOUNDARIES.md (A3), "Scope Control"

**The Ambiguity:** "One scope per session" and "file touch list must be pre-approved" (A4). But BOUNDARIES.md says "Only listed files modified" in scope control. For ad-hoc tasks without a formal Work Order, who defines the scope? Is scope per-file, per-feature, per-objective?

**Possible Interpretations:**
- A (Strict per-file): Every file that will be modified must be listed and approved before work begins.
- B (Per-objective): The objective defines scope; files are implementation details within the approved objective.
- C (Implicit): For simple tasks, scope is implied by the request. For complex tasks, explicit file lists are required.

**Conservative Default:** Interpretation A for governed Observer work; Interpretation C for PAI ad-hoc tasks (matches the complexity-based routing in INTENSITY_DEPTH.md).

**Status:** OPEN

---

## AMB-04: When Does "Ask When Unclear" Override "Execute Delegated Tasks"?

**Topic:** Threshold for escalation from delegated execution to questioning

**Source:** DOCTRINE.md (A4), Doctrine 3; AUTHORITY.md (A2), "When PAI Decides"

**The Ambiguity:** PAI has "delegated authority for execution approach within approved scope" and "low-risk implementation details" (A2). Doctrine 3 says "Ambiguity is a signal to ask questions" (A4). At what uncertainty threshold must PAI stop executing and escalate?

**Possible Interpretations:**
- A (Low threshold): Any uncertainty about intent or approach triggers escalation. PAI asks frequently.
- B (Moderate threshold): Uncertainty about the objective or approach triggers escalation. Minor implementation uncertainties are resolved by PAI.
- C (High threshold): Only uncertainty that risks violating scope, boundaries, or security triggers escalation. PAI resolves most ambiguity independently.

**Conservative Default:** Interpretation B. This balances usability (not asking about every minor detail) with safety (escalating when the objective or approach is unclear).

**Status:** OPEN

---

## AMB-05: What Is the Boundary Between Observer Governance and PAI Governance?

**Topic:** Overlapping governance domains

**Source:** SCOPE.md (A5), "Scope Conflicts"; BOUNDARIES.md (A3)

**The Ambiguity:** SCOPE.md says "Observer governance boundaries ALWAYS win." But both Observer and PAI have governance documents that address overlapping domains (authority, verification, scope control). Which governance system's specific rules apply in overlapping areas?

**Possible Interpretations:**
- A (Observer supreme): Wherever Observer and PAI governance conflict, Observer's specific rules apply, even for PAI execution details.
- B (Layered): Observer sets constraints; PAI operates within those constraints using its own governance for implementation details.
- C (Domain-specific): Observer governs planning and review; PAI governs execution. Each is supreme in its domain.

**Conservative Default:** Interpretation B. Observer sets outer boundaries; PAI operates within them. This aligns with the three-tier authority model.

**Status:** OPEN

---

## AMB-06: Is the Council a Persistent Entity or a Per-Session Tool?

**Topic:** Council's nature and continuity

**Source:** OBSERVER_PROJECT_DETAILED_HANDOVER.md (C1); COUNCIL_CONTRACT.md (C4)

**The Ambiguity:** The Handover describes Council as "a structured deliberation system" and "a governance system" (C1, Section 4.1), implying persistence and institutional authority. The Council Contract describes it as a tool (`council.survey`) with specific input/output schemas (C4), implying a per-invocation function.

**Possible Interpretations:**
- A (Tool): Council is a stateless tool invoked per-request. It has no memory, no persistence, no institutional authority beyond the current invocation.
- B (Institutional): Council is a persistent governance entity with accumulated knowledge, ongoing authority, and decision continuity across sessions.
- C (Hybrid): Council is invoked as a tool but its outputs (Work Orders, decisions) persist and form institutional memory.

**Conservative Default:** Interpretation A (tool). A stateless tool grants less authority than a persistent institution (per Rule 9.1). The Council's outputs persist, but the Council itself does not accumulate authority.

**Status:** OPEN

---

## AMB-07: What Happens When Verification Is Impossible?

**Topic:** Verification requirements for non-deterministic outcomes

**Source:** BOUNDARIES.md (A3); GUARDRAILS.md (B1); DOCTRINE.md (A4)

**The Ambiguity:** "Nothing is done without proof" (A3) and "If it can't be verified, it shouldn't be claimed" (A5). But some outcomes are inherently probabilistic (research quality, creative output, search relevance). GUARDRAILS.md (B1) adds: "If proof is not possible, the limitation must be stated explicitly."

**Possible Interpretations:**
- A (Strict): Tasks with unverifiable outcomes should not be undertaken by the system.
- B (Bounded): Unverifiable claims must be explicitly labeled as such. The limitation itself is documented as proof of due diligence.
- C (Best-effort): Verification is aspirational. Where impossible, best-effort evidence suffices.

**Conservative Default:** Interpretation B. This aligns with GUARDRAILS.md (B1) which explicitly provides for "If proof is not possible, the limitation must be stated explicitly."

**Status:** OPEN

---

## AMB-08: What Is "Euphoric Surprise" in Operational Terms?

**Topic:** Success metric definition

**Source:** PURPOSE.md (A1); SUCCESS_CRITERIA.md (A6)

**The Ambiguity:** SUCCESS_CRITERIA.md targets ">= 50% of tasks produce euphoric surprise." PURPOSE.md describes it as "results so thorough, thoughtful, and effective that you are genuinely surprised and delighted." This is simultaneously the highest aspiration and the most ambiguous metric. There is no operational definition of what constitutes "euphoric surprise" vs. merely "satisfactory completion."

**Possible Interpretations:**
- A (Aspirational): Euphoric Surprise is a guiding philosophy, not a measurable KPI.
- B (Rating-based): Euphoric Surprise maps to ratings of 9-10 on the explicit rating scale (per SKILL.md: "YOUR GOAL IS 9-10 implicit or explicit ratings").
- C (Threshold): Any task rated >7/10 with positive sentiment constitutes "euphoric surprise."

**Conservative Default:** Interpretation A. As a constitutional principle, Euphoric Surprise is a directional aspiration rather than a verifiable criterion.

**Status:** OPEN

---

## AMB-09: Are Governance Documents Subject to the Verification Doctrine?

**Topic:** Self-referential application of verification

**Source:** DOCTRINE.md (A4), Doctrine 1; CANON_PROMOTION_RULES.md (C15)

**The Ambiguity:** Doctrine 1 states "Prove it, don't claim it." If this doctrine applies universally, then updating a governance document should require proof that the update is correct. But governance documents describe values, principles, and intentions -- not code behavior. How do you "verify" that a principle statement is "correct"?

**Possible Interpretations:**
- A (Universal): All claims, including governance claims, require verification. A governance update requires evidence that the change reflects actual operational intent.
- B (Scoped): The verification doctrine applies to execution claims (code works, tests pass, deployment succeeded). Governance documents are policy statements that require human approval, not empirical verification.
- C (Process-based): Verification for governance means the document was reviewed, approved, and follows the canon promotion process (C15).

**Conservative Default:** Interpretation C. This aligns with CANON_PROMOTION_RULES.md, which defines a specific process for document promotion that serves as the "verification" for governance artifacts.

**Status:** OPEN

---

## AMB-10: What Constitutes "Explicit Human Approval"?

**Topic:** Standard of approval

**Source:** BOUNDARIES.md (A3); PURPOSE.md (A1)

**The Ambiguity:** BOUNDARIES.md requires "explicit approval" for risky operations and defines a 5-step approval process: "PAI explains, shows diff, asks approval, human responds yes/no, PAI proceeds only if approved." It also states "Assuming approval based on previous similar tasks [Forbidden]." However, PURPOSE.md describes a "Simple Task" pattern where "implicit approval via no objection" is accepted.

**Possible Interpretations:**
- A (Strict): All operations require an explicit "yes" from the human. No implicit approval is ever valid.
- B (Risk-graduated): Risky operations require explicit yes/no. Simple, low-risk operations accept implicit approval (no objection = proceed).
- C (Context-dependent): The standard of approval depends on the task complexity domain (Clear = implicit OK; Complex = explicit required).

**Conservative Default:** Interpretation B. This reconciles both sources: BOUNDARIES.md governs risky operations with explicit approval; PURPOSE.md describes simple tasks where implicit approval suffices. However, the exact boundary between "simple" and "risky" remains ambiguous (see AMB-01).

**Status:** OPEN

---

## AMB-11: What Are the Enforcement Mechanisms for Constitutional Principles?

**Topic:** How principles become enforceable constraints

**Source:** DOCTRINE.md (A4), "Doctrine Enforcement"; PROJECT_STATE.md (C2)

**The Ambiguity:** Doctrine enforcement mechanisms are listed (verification gates, receipt requirements, SecurityValidator hook, etc.), but these are implementation-specific. If tools change, do the enforcement mechanisms need to be re-established? Is a principle without an enforcement mechanism merely aspirational?

**Possible Interpretations:**
- A (Principle-only): Constitutional principles are constraints that must be honored regardless of enforcement mechanism. Enforcement is an implementation detail.
- B (Gate-required): A principle without an active enforcement gate is advisory only. It becomes binding when a gate enforces it.
- C (Human-enforced): In the absence of automated gates, human vigilance is the enforcement mechanism.

**Conservative Default:** Interpretation A, with Interpretation C as the operational fallback. Principles are binding regardless of tooling; human enforcement applies when automation is absent.

**Status:** OPEN

---

## AMB-12: What Is the Relationship Between PAI Algorithm and Observer Constitution?

**Topic:** Governance framework interaction

**Source:** SKILL.md (A9); All governance documents (A1-A5)

**The Ambiguity:** The PAI Algorithm (SKILL.md) defines its own verification model (ISC criteria), capability system, and execution phases. The governance documents define a separate verification model (receipts, gates, Definition of Done). Are these two verification systems complementary, redundant, or potentially conflicting? Which takes precedence for governed tasks?

**Possible Interpretations:**
- A (Complementary): PAI Algorithm handles task-level verification (ISC). Observer governance handles process-level verification (receipts, gates). Both apply simultaneously.
- B (Hierarchical): Observer governance is the outer constraint. PAI Algorithm operates within it. When they conflict, Observer governance wins (per P-SCOPE-04).
- C (Domain-separated): PAI Algorithm governs PAI execution. Observer governs Observer planning/review. They operate in separate domains.

**Conservative Default:** Interpretation B. Observer governance is the outer boundary (per SCOPE.md: "Observer governance boundaries ALWAYS win").

**Status:** OPEN

---

## Summary

| ID | Topic | Conservative Default | Source |
|----|-------|---------------------|--------|
| AMB-01 | "Risky operations" definition | Moderate: when in doubt, it's risky | A3 |
| AMB-02 | "Read-only" Observer meaning | Strict: zero direct disk artifacts | A3, C4, C5 |
| AMB-03 | "Approved scope" boundary | Per-file for governed, per-objective for ad-hoc | A4, A3 |
| AMB-04 | Escalation threshold | Moderate: escalate on objective/approach uncertainty | A4, A2 |
| AMB-05 | Observer vs PAI governance boundary | Layered: Observer sets constraints, PAI operates within | A5, A3 |
| AMB-06 | Council persistence | Tool: stateless per-invocation | C1, C4 |
| AMB-07 | Impossible verification | Bounded: label limitations explicitly | A3, B1, A4 |
| AMB-08 | Euphoric Surprise definition | Aspirational philosophy, not verifiable KPI | A1, A6 |
| AMB-09 | Governance document verification | Process-based: canon promotion serves as verification | A4, C15 |
| AMB-10 | "Explicit approval" standard | Risk-graduated: explicit for risky, implicit OK for simple | A3, A1 |
| AMB-11 | Enforcement mechanisms | Principle-only: binding regardless of tooling | A4, C2 |
| AMB-12 | PAI Algorithm vs Observer Constitution | Hierarchical: Observer is outer boundary | A9, A1-A5 |
