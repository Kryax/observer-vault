# CONFLICT REGISTER -- Observer Constitutional Synthesis

**Status:** Draft synthesis artifact
**Authority:** NONE (draft only)
**Date:** 2026-02-10

This register documents conflicts detected between source documents during synthesis. No conflict is resolved. Both positions are stated with citations.

---

## CONF-01: Security Boundaries vs Human Absolute Authority

**Category:** PRIORITY CONFLICT

**Source A:** AUTHORITY.md (A2), "Authority Conflicts" section
> "Priority order (highest to lowest): 1. Human - Final authority always wins; 2. Security Boundaries - Cannot be overridden by anyone"

And also in the same table:
> "Human requests risky operation: Security says block, Human says proceed -> Human wins, but PAI explains risk first"

**Source B:** BOUNDARIES.md (A3), "When Boundaries Conflict" section
> "Priority order: 1. Security boundaries (always win)"

And DOCTRINE.md (A4), "Doctrine Conflicts" section:
> "Priority Order: 1. Security (never compromise); 2. Human Authority (human always wins)"

**Nature of Conflict:** AUTHORITY.md places Human at position 1 and says "Human wins" in the conflicts table, but then lists Security Boundaries at position 2 with the phrase "Cannot be overridden by anyone." BOUNDARIES.md and DOCTRINE.md both place Security above Human Authority. The same governance stack thus contains two incompatible priority orderings for the top two positions.

**Conservative Interpretation (per M2):** The narrower, safer reading is that security boundaries are the highest constraint, with human authority able to override only after full risk disclosure and explicit acknowledgment. However, this reading weakens the "absolute authority" claim in AUTHORITY.md.

**Resolution Status:** UNRESOLVED

**Implication:** A human must explicitly decide whether their authority can override security boundaries, and if so, under what conditions.

---

## CONF-02: Builder Status -- Disabled vs Active Execution Tier

**Category:** SCOPE DISAGREEMENT

**Source A:** COUNCIL_CONTRACT.md (C4), "Builder" section
> "Builder is effectively disabled inside Council MVP (no writes)."
> "MVP constraint: Builder is effectively disabled inside Council MVP"

**Source B:** AUTHORITY_ESCALATION_LOOP.md (C8), "Tiers" section
> "Builder: Executes scoped work. Escalates on ambiguity, conflicts, or unmet prerequisites."
> "Builder may not proceed until a Reality Patch is issued."

And OBSERVER_PROJECT_DETAILED_HANDOVER.md (C1), section 4.2:
> "Builder can be promoted to executor only when allowed by governance rules."

**Nature of Conflict:** The Council MVP Contract explicitly disables Builder. The Escalation Loop describes Builder as an active execution tier with specific responsibilities and escalation behavior. The Handover allows conditional promotion. These three documents describe three different states for the same role.

**Conservative Interpretation (per M2):** Builder is disabled (per MVP contract). The Escalation Loop describes a future or aspirational state. The Handover describes a conditional possibility not yet activated.

**Resolution Status:** UNRESOLVED

**Implication:** A human must decide whether Builder is currently active, disabled, or conditionally available, and update governance documents to be consistent.

---

## CONF-03: Truth Location -- Workspace vs Canonical Repos/Vault

**Category:** DIRECT CONTRADICTION

**Source A:** GUARDRAILS.md (B1), "Truth Location" section
> "Canonical project truth lives in the workspace."

**Source B:** PAI_BOUNDARIES.md (B16), "Observer Control Plane" section
> "Role: provisional coordination + reconstruction notes (not canon)"

And GUARDRAILS.md (B2), Council MVP Guardrails:
> "Workspace is wrapper, not truth: truth lives in canonical repos/vault."

**Nature of Conflict:** The base GUARDRAILS.md (B1) states workspace IS truth. The Council MVP GUARDRAILS.md (B2) and PAI_BOUNDARIES.md (B16) both state workspace is NOT truth. Two documents within the same workspace make directly opposite claims about whether the workspace holds canonical truth.

**Conservative Interpretation (per M2):** The workspace is provisional/wrapper, not canonical truth (narrower scope reading per Rule 9.4). This aligns with B2 and B16 against B1.

**Resolution Status:** UNRESOLVED

**Implication:** A human must decide where canonical truth lives and update all three documents to agree.

---

## CONF-04: Semantic Space and Motifs -- Core Architecture vs Unimplemented

**Category:** TEMPORAL CONFLICT

**Source A:** OBSERVER_PROJECT_DETAILED_HANDOVER.md (C1), sections 8-9
> "You are not searching documents. You are searching relationships between ideas."
> "Motif detection is: partially algorithmic, partially intuitive, best done with visual + human judgment"

Describes semantic space, motifs, connectors, and fractal patterns as core architecture.

**Source B:** All Category B operational documents (B1-B16)
Zero references to semantic space, motifs, connectors, or fractal patterns in any operational governance document.

PROJECT_STATE.md (C2), "Foundational Research" section:
> "Phase: UPGRADE (future); Status: Foundational research only; Implementation: Not scheduled; Constraint: Must not influence current RESTORE execution"

**Nature of Conflict:** The foundational Handover document treats semantic space and motifs as core to Observer's architecture. All operational documents ignore these concepts entirely. PROJECT_STATE explicitly classifies them as deferred research that must not influence current work.

**Conservative Interpretation (per M2):** Semantic space and motifs are aspirational/deferred, not current constitutional principles (per Rule 9.4: present state over future state).

**Resolution Status:** UNRESOLVED

**Implication:** A human must decide whether the Handover's semantic space vision is constitutionally relevant or has been superseded by operational reality.

---

## CONF-05: Doctrine Priority vs Authority Priority -- Different Orderings

**Category:** PRIORITY CONFLICT

**Source A:** DOCTRINE.md (A4), "When Doctrines Conflict" section
> "Priority Order: 1. Security (never compromise); 2. Human Authority (human always wins); 3. Verification (prove before claiming); 4. Scope Discipline (stay in bounds); 5. Simplicity (prefer less over more)"

**Source B:** AUTHORITY.md (A2), "When Levels Conflict" section
> "Priority order (highest to lowest): 1. Human - Final authority always wins; 2. Security Boundaries; 3. Observer Constraints; 4. PAI Preferences"

**Nature of Conflict:** DOCTRINE.md places Security above Human Authority. AUTHORITY.md places Human above Security. Both are canonical v1.0 documents from the same date (2026-02-09). They explicitly disagree on whether Security or Human Authority is the highest priority.

**Conservative Interpretation (per M2):** Security is the highest constraint (safer reading per Rule 9.5). This creates a tension with AUTHORITY.md's "absolute authority" language.

**Resolution Status:** UNRESOLVED

**Implication:** This is the same conflict as CONF-01, viewed from a different angle. Both documents' priority orderings must be reconciled by a human.

---

## CONF-06: Observer Zero Write Authority vs Workspace Disk Artifacts

**Category:** SCOPE DISAGREEMENT

**Source A:** BOUNDARIES.md (A3), "Observer is Read-Only" section
> "Observer Council has ZERO write authority"
> "All writes require explicit human approval + PAI execution"

And COUNCIL_CONTRACT.md (C4):
> "No silent writes. Council MVP performs zero filesystem writes."

**Source B:** Operational reality as evidenced in B11 (DEFINITION_OF_DONE), B12 (SESSION_LIFECYCLE), and C6 (COUNCIL_ORCHESTRATION):
Work Orders, Job Packets, Session Logs, and Receipts exist as files on disk in the Observer workspace. Someone or something writes them.

COUNCIL_ORCHESTRATION.md (C6) states:
> "Council: Read-only planner/reviewer. Produces Work Orders. [Writes: No]"
> "OpenCode/GLM: Executor. Implements approved Work Orders. [Writes: Yes]"

**Nature of Conflict:** Observer has "ZERO write authority" but produces Work Orders. The COUNCIL_ORCHESTRATION.md resolves this by assigning writes to "OpenCode/GLM" (the executor), implying Council dictates content that a separate executor writes. However, this separation is not made explicit in BOUNDARIES.md or the Council Contract.

**Conservative Interpretation (per M2):** Observer truly has zero write authority. Any artifacts attributed to Observer (Work Orders, etc.) are written by the execution system (PAI/OpenCode) on Observer's behalf, with human approval. Observer's "production" of Work Orders is conceptual (generating content), not operational (writing to disk).

**Resolution Status:** UNRESOLVED

**Implication:** A human must clarify the mechanism by which Observer's conceptual outputs become disk artifacts, and whether this constitutes a write authority exception or is handled entirely by the execution layer.

---

## CONF-07: "AI Articulates, Human Decides" vs Observer Blocking Authority

**Category:** AUTHORITY COLLISION

**Source A:** All archived Council agent documents (C13)
> "AI articulates, Human decides." (stated as core principle across all four agent roles)

AUTHORITY.md (A2):
> "Observer can block (prevent execution) but cannot approve (authorize execution)."

**Source B:** GUARDRAILS.md (B1) and the practical blocking behavior:
> "The human operator is the final authority for all changes."

SENTRY agent role (C13, sentry.md):
> "You do not unilaterally block -- you provide your verdict and rationale, and the Human decides."

But AUTHORITY.md (A2) contradicts this by granting Observer actual blocking power:
> "Block risky operations (pre-execution validation) [YES]"

**Nature of Conflict:** The Sentry's own documentation says it does not unilaterally block; it provides a verdict and the human decides. But AUTHORITY.md grants Observer the power to "block risky operations." These describe two different levels of authority: advisory ("here is my verdict") vs. operational ("execution is blocked").

**Conservative Interpretation (per M2):** Observer blocking is advisory-with-flag (the narrower reading), requiring human to acknowledge and override rather than being a hard system block.

**Resolution Status:** UNRESOLVED

**Implication:** A human must decide whether Observer's blocking authority is advisory (recommend block, human overrides) or operational (hard block requiring human unlock).

---

## Summary

| ID | Category | Documents | Core Tension |
|----|----------|-----------|--------------|
| CONF-01 | PRIORITY CONFLICT | A2 vs A3, A4 | Security boundaries vs human absolute authority |
| CONF-02 | SCOPE DISAGREEMENT | C4 vs C8, C1 | Builder disabled vs active execution tier |
| CONF-03 | DIRECT CONTRADICTION | B1 vs B2, B16 | Workspace is truth vs workspace is not truth |
| CONF-04 | TEMPORAL CONFLICT | C1 vs all B-category, C2 | Semantic space as core vs unimplemented/deferred |
| CONF-05 | PRIORITY CONFLICT | A4 vs A2 | Doctrine priority order vs authority priority order |
| CONF-06 | SCOPE DISAGREEMENT | A3, C4 vs B11, C6 | Zero write authority vs disk artifacts exist |
| CONF-07 | AUTHORITY COLLISION | C13, A2 vs C13(sentry) | Blocking as advisory vs blocking as operational |
