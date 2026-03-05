---
status: DRAFT
date: 2026-03-05
type: technical-design-specification
source: Theory_To_Architecture_20260305.md (grounded principles only)
vault_safety: Architecture specification. Proposes cognitive sequence changes that require Adam's review and approval before implementation. Does not modify governance or authority model.
predecessors:
  - 02-Knowledge/architecture/Theory_To_Architecture_20260305.md
  - 01-Projects/observer-council/architecture/OBSERVER_CONSTITUTION_DRAFT.md
  - 01-Projects/observer-council/architecture/council-builder-escalation-loop.md
---

# Technical Design Specification: Council Cognitive Triad Redesign

**Date:** 5 March 2026
**Status:** DRAFT -- REQUIRES ADAM'S APPROVAL BEFORE IMPLEMENTATION
**Author:** Atlas (specification from grounded principles)
**Human Authority:** Adam (Observer)

**Design Basis:** This specification draws exclusively from the six grounded design principles in Theory_To_Architecture_20260305.md, Section 6. Every design decision cites its source claim(s). No speculative-tier material is used.

---

## 1. Purpose and Scope

This TDS specifies the restructuring of the Observer Council's cognitive sequence around the Oscillate-Converge-Reflect triad. The restructuring changes **how the Council thinks** (cognitive sequence) without changing **who has authority** (governance model).

**In scope:**
- Role definitions for the restructured Council
- The deliberation sequence with decision points and data flows
- Recursion axis mitigation mechanisms as implementation requirements
- Escalation paths (Builder failure + Reflector process-quality)
- Constitutional delta (what stays vs. what changes)

**Out of scope:**
- Governance and authority model changes (P-AUTH-01 through P-PUR-06 are preserved verbatim)
- Control plane implementation details (see TDS v2 for that)
- Motif-in-PRD integration (see Theory_To_Architecture Section 3 for that proposal)

---

## 2. Role Definitions

`[Source: G4 -- three-axis geometry appears across 5+ independent traditions; G1 -- redundancy across independent measurements separates signal from noise]`

### 2.1 Role Summary

| Role | Phase | Count | Function | Current Equivalent | Status |
|------|-------|-------|----------|--------------------|--------|
| **Perspective Agent** | Oscillate | 2-4 | Generate structurally independent framings | Partially Architect (technical lens only) | NEW |
| **Triangulator** | Converge | 1 | Detect convergence, kill failed parallels, produce structural invariant | No equivalent (convergence was implicit) | NEW |
| **Sentry** | Converge | 1 | Adversarial pressure on converged output | Sentry | PRESERVED |
| **Reflector** | Reflect | 1 | Examine deliberation process, produce process observations and motif candidates | No equivalent | NEW (mandatory) |
| **Builder** | Post-triad execution | 1 | Receive work packet, execute deterministically, run proof gates | Builder | PRESERVED |

### 2.2 Perspective Agents (Oscillate Phase)

**Purpose:** Generate structurally independent perspectives on the problem. Each agent frames the problem from a different vantage point: domain lens, stakeholder position, time horizon, or abstraction level.

**Independence requirement:** `[Source: G1]` Perspectives that share foundational assumptions are partially redundant and reduce signal extraction quality. The independence check (Section 3, Step 2b) enforces this.

**Configuration:**
- **Count:** 2-4 agents per deliberation. The minimum of 2 ensures at least one triangulation pair. The maximum of 4 prevents diminishing returns where marginal perspectives add noise.
- **Seeding:** Each agent receives a different lens assignment. Lens types include but are not limited to: technical feasibility, user impact, security/adversarial, operational/maintenance, temporal (short-term vs. long-term), and domain-specific expertise.
- **Output format:** Each Perspective Agent produces a framing document containing: problem restatement from their lens, key constraints visible from their position, risks visible from their position, proposed approach from their position, and explicitly stated foundational assumptions.

**Constraint:** Perspective Agents do NOT see each other's output during the Oscillate phase. Independence requires isolation during generation.

### 2.3 Triangulator (Converge Phase)

**Purpose:** Detect structural invariants across perspectives. The Triangulator reads all Oscillate outputs simultaneously and identifies what survives cross-framing.

`[Source: G1 -- the mechanism by which signal separates from noise]`

**Process:**
1. Read all Perspective Agent outputs.
2. For each claim/constraint/risk that appears in 2+ perspectives: mark as **convergent**.
3. For each convergent item: verify it appeared from genuinely independent framings (not from shared assumptions).
4. For items that appear in only 1 perspective: mark as **perspective-specific** (not killed, but not convergent).
5. Produce the **structural invariant**: the set of claims, constraints, and risks that survive triangulation.

**Output format:**
- Structural invariant (convergent items with evidence of independence)
- Kill list (items that failed cross-framing, with reason)
- Perspective-specific items (single-perspective items preserved for Sentry review)
- Convergence quality score: ratio of convergent items to total unique items

**Constraint:** Convergence without rejection is collection, not triangulation. The kill list MUST be non-empty for any deliberation with 3+ perspectives. If nothing is killed, the Triangulator flags this as a quality concern.

### 2.4 Sentry (Converge Phase -- Preserved)

**Purpose:** Adversarial pressure on the Triangulator's converged output. Tests whether the structural invariant holds under stress.

`[Source: G1 -- adversarial testing is independent measurement from a hostile frame]`

**Process:** Unchanged from current constitution. The Sentry audits plans and outputs for violations, missing steps, and unjustified assumptions. Must flag uncertainty.

**Change from current:** The Sentry now operates on the Triangulator's structural invariant rather than on an Architect's plan directly. The input changes; the adversarial function does not.

### 2.5 Reflector (Reflect Phase -- NEW, Mandatory)

**Purpose:** Examine the deliberation process itself. Identify what the Council assumed, what it missed, what patterns in its own reasoning are reusable.

`[Source: G3 -- recursive self-modeling produces categorically new information; G5 -- recursion axis is underpopulated, indicating systematic underinvestment]`

**Why mandatory:** `[Source: G5]` Without a Reflector, the Council produces differentiated and integrated output but never recurses on its own process. This reproduces the recursion axis starvation found in the motif library (1 of 10 motifs on the recurse axis). The Reflector is structurally mandatory, not a nice-to-have.

**Required outputs:**
1. **Process observation:** What happened in this deliberation? What was the cognitive sequence actually like, vs. what was prescribed?
2. **Assumption inventory:** What assumptions shaped the convergence? Were any foundational assumptions shared across "independent" perspectives?
3. **Motif candidates:** Is there a domain-independent structural pattern in how this deliberation unfolded? If yes, it enters the motif pipeline at `02-Knowledge/motifs/`.
4. **Framework delta:** What will the Council see differently next time because of what was found this time? `[Source: G2 -- observation modifies the observer's frame]`

**Authority:** The Reflector does NOT gain decision authority. It gains observation responsibility. It cannot override the Triangulator's structural invariant or the Sentry's flags. It can escalate process-quality concerns to Human (see Section 5.2).

### 2.6 Builder (Post-Triad Execution -- Preserved)

**Purpose:** Receive the triad's output as a work packet. Execute deterministically. Run proof gates.

**Change from current:** The Builder now receives a work packet that includes triad receipts (Oscillate perspectives, Converge invariant, Sentry flags, Reflect observations). The execution loop is unchanged. The input is richer.

**Work packet contents (updated):**
- Scope, constraints, success criteria, acceptance tests (existing)
- Structural invariant from Triangulator (new)
- Sentry flags and unresolved concerns (existing, now post-convergence)
- Reflect observations and framework delta (new -- informational, not binding)
- Paths / environment context (existing)

---

## 3. Deliberation Sequence

`[Source: G4 -- three-axis geometry as cognitive sequence; G1 -- independence requirement]`

This is the implementation-ready specification of the sequence sketched in Theory_To_Architecture Section 1.5.

```
COUNCIL TRIAD DELIBERATION SEQUENCE v1.0

PRECONDITION: Problem arrives with sufficient context for framing.
PRECONDITION: Adam has authorized Council deliberation (P-AUTH-01).

STEP 1 -- INTAKE
  1a. Problem statement received.
  1b. Council determines lens assignments for Perspective Agents.
  1c. Agent count selected: 2-4 based on problem complexity.
      - Simple/well-defined problem: 2 agents
      - Multi-faceted problem: 3 agents
      - High-stakes or cross-domain problem: 4 agents

STEP 2 -- OSCILLATE (Differentiate axis)
  2a. Each Perspective Agent generates framing IN ISOLATION.
      - Agents do NOT see each other's output.
      - Each agent produces: restatement, constraints, risks, approach,
        and EXPLICIT foundational assumptions.
  2b. INDEPENDENCE CHECK (mandatory):
      - Compare foundational assumptions across all agents.
      - For each pair of agents, check: do they share any foundational
        assumption not derivable from the problem statement itself?
      - If YES: flag the redundancy. Options:
        (i)  Request the redundant agent to reframe from a different
             assumption base.
        (ii) Replace the agent with a different lens assignment.
        (iii) Proceed with noted redundancy (reduces convergence quality
              but does not block).
      - The independence check result is recorded in the deliberation
        receipt. Convergence quality depends on independence quality.
  2c. Output: 2-4 independent framing documents + independence check result.

STEP 3 -- CONVERGE (Integrate axis)
  3a. Triangulator reads all framing documents.
  3b. Triangulator identifies convergent items (appear in 2+ independent
      framings) and perspective-specific items (1 framing only).
  3c. Triangulator produces structural invariant + kill list.
      REQUIREMENT: kill list MUST be non-empty if 3+ perspectives exist.
      If nothing killed, flag as convergence quality concern.
  3d. Sentry receives structural invariant + perspective-specific items.
  3e. Sentry applies adversarial pressure:
      - Tests invariant for hidden assumptions.
      - Checks kill list for items killed incorrectly.
      - Checks perspective-specific items for missed convergence.
      - Flags unresolved risks.
  3f. Output: stress-tested invariant + Sentry flags + evidence package.

STEP 4 -- REFLECT (Recurse axis)
  4a. Reflector receives ALL prior outputs:
      - Oscillate framing documents
      - Independence check result
      - Triangulator invariant + kill list
      - Sentry flags
  4b. Reflector produces REQUIRED outputs:
      (i)   Process observation
      (ii)  Assumption inventory
      (iii) Motif candidates (0 or more)
      (iv)  Framework delta
  4c. MINIMUM OUTPUT FLOOR ENFORCED:
      If Converge produced M pages of output, Reflect MUST produce
      at least M/2 pages. A one-sentence summary is not acceptable.
      [Source: G5 -- recursion axis starves from deprioritisation]
  4d. Reflector checks: does the session's output distribution across
      D/I/R axes show imbalance? If all outputs are differentiate or
      integrate with no recurse content, flag as axis imbalance.
  4e. Output: process observation + assumption inventory + motif
      candidates + framework delta + axis balance assessment.

STEP 5 -- WORK PACKET ASSEMBLY
  5a. Compile work packet for Builder:
      - Structural invariant (from Converge)
      - Sentry flags (from Converge)
      - Reflect observations (informational)
      - Scope, constraints, success criteria, acceptance tests
      - Paths / environment context
  5b. Work packet includes TRIAD RECEIPTS: evidence from each phase.

STEP 6 -- EXECUTE (Builder)
  6a. Builder receives work packet.
  6b. Builder executes deterministically.
  6c. Builder runs proof gates.
  6d. If PASS: return receipts to Council. Deliberation complete.
  6e. If FAIL: bounded retry (max N retries per existing escalation
      loop). Each retry includes failure evidence, delta, reasoning.
  6f. If STILL FAILING: escalate to Council (see Section 5.1).

STEP 7 -- COUNCIL RE-ENTRY (if escalated from Builder)
  7a. Council performs structural diagnosis:
      - Missing information?
      - Conflicting constraints?
      - Environmental failure?
      - Structural disharmony?
  7b. If resolvable: update work packet, return to Step 6.
  7c. If not resolvable: escalate to Human (see Section 5.1).

STEP 8 -- REFLECTOR ESCALATION (parallel path, any time)
  8a. If Reflector detects recurring pattern in Council process:
      flag to Human (see Section 5.2).
  8b. This is NOT task-failure escalation. It is process-quality
      escalation.

STEP 9 -- FEEDBACK LOOP
  9a. Reflect output (motif candidates, framework delta) is stored.
  9b. Next deliberation's Oscillate phase receives prior Reflect
      output as seed material for lens assignment.
      [Source: G3 -- recursive self-modeling; G5 -- closes the loop]
```

---

## 4. Recursion Axis Mitigation Requirements

`[Source: G5 -- recursion axis underpopulated (1 of 10 motifs); G3 -- recursive self-modeling produces categorically new information]`

These are implementation requirements (SHALL), not guidelines (SHOULD). The recursion axis starves because it is consistently deprioritised. These mechanisms make deprioritisation structurally impossible.

### REQ-R1: Minimum Output Floor

The Reflector SHALL produce at least M/2 pages of output, where M is the page count of the Converge phase output (Triangulator invariant + kill list + Sentry flags combined).

**Rationale:** `[Source: G5]` The recursion axis starves not because recursion is impossible but because it is deprioritised in favour of more tangible differentiation and integration outputs. A structural floor prevents the Reflector from producing a perfunctory summary.

**Enforcement:** The deliberation sequence (Step 4c) checks output volume before proceeding to Step 5. If the floor is not met, the Reflector must expand its analysis before the work packet is assembled.

### REQ-R2: Reflect-to-Oscillate Feedback Loop

The Reflector's output SHALL feed the next deliberation cycle's Oscillate phase as seed material for perspective generation and lens assignment.

**Rationale:** `[Source: G3, G5]` Without this feedback, Reflect is a dead end -- observed but not integrated. The loop closes: recurse outputs inform differentiation inputs.

**Mechanism:** Reflect output is stored in the deliberation record. When the next deliberation begins (Step 1b), the Council reviews prior Reflect output to inform lens assignments. Framework deltas from prior sessions may suggest new lens types or flag perspectives that were systematically absent.

### REQ-R3: Motif Candidate Production

The Reflector SHALL explicitly check every deliberation for domain-independent structural patterns: "Is there a pattern in how this deliberation unfolded that is independent of the specific problem domain?"

**Rationale:** `[Source: G5]` Every Council deliberation is a potential source of structural patterns. The Reflector's motif check directly populates the recursion axis of the motif library.

**Output:** Zero or more motif candidates per deliberation. Each candidate includes: pattern description, domain-independence argument, and instance documentation. Candidates enter the motif pipeline at `02-Knowledge/motifs/` as Tier 0 entries.

### REQ-R4: Reflector Process-Quality Escalation

The Reflector SHALL have the authority to escalate process-quality concerns directly to Human, independent of task-failure escalation.

**Rationale:** `[Source: G2 -- observation modifies the observer's frame; G3 -- recursive self-modeling]` The system modeling its own selection process can detect systematic errors invisible from within a single deliberation.

**Specification:** See Section 5.2 for trigger conditions, payload, and resolution flow.

---

## 5. Escalation Paths

### 5.1 Builder Failure Escalation (Preserved)

This path is unchanged from the existing council-builder escalation loop. The full specification is at `01-Projects/observer-council/architecture/council-builder-escalation-loop.md`.

**Summary:**
1. Builder fails proof gates.
2. Builder retries (bounded, max N).
3. If still failing: Builder escalates to Council with logs, diffs, failure analysis.
4. Council performs structural diagnosis (missing info, conflicting constraints, environmental failure, structural disharmony).
5. If resolvable: Council updates work packet, Builder retries.
6. If not resolvable: Council escalates to Human with evidence, impact, and request for clarification.
7. Human responds with missing info, constraint adjustment, or Creative Harmony Loop authorization.

**What changes:** The work packet now includes triad receipts (Oscillate perspectives, Converge invariant, Sentry flags, Reflect observations). This gives the Council richer context for structural diagnosis during re-entry.

### 5.2 Reflector Process-Quality Escalation (New)

`[Source: G2, G3]`

This is a NEW escalation path. It runs in parallel with the Builder failure path and is independent of it.

**Trigger conditions (any one sufficient):**
1. **Recurring bias:** The Reflector identifies the same assumption appearing across 3+ consecutive deliberations without being made explicit in lens assignments.
2. **Systematic perspective absence:** The Reflector identifies a domain or stakeholder position that has been absent from Oscillate for 3+ consecutive deliberations.
3. **Convergence quality degradation:** The independence check (Step 2b) flags redundancy in 3+ consecutive deliberations, suggesting the lens assignment process has narrowed.
4. **Axis imbalance persistence:** The D/I/R axis balance check (Step 4d) shows the same imbalance pattern across 3+ consecutive deliberations.

**Payload:**
```
REFLECTOR ESCALATION
Type: PROCESS_QUALITY
Trigger: [which trigger condition, with evidence]
Pattern: [description of the recurring pattern]
Span: [which deliberations exhibit the pattern]
Impact: [what the Council is systematically missing or biasing]
Suggested correction: [optional -- Reflector may suggest but does not decide]
```

**Resolution:**
- Human reviews the escalation.
- Human may: adjust lens assignment defaults, add a required perspective type, modify the independence check criteria, or acknowledge and dismiss.
- The Reflector does NOT have authority to modify the deliberation sequence. It has authority to flag. Human decides.

**Relationship to P-AUTH-01:** The Reflector escalation is consistent with "AI articulates, humans decide." The Reflector articulates a process observation. The human decides whether to act on it.

---

## 6. Constitutional Delta

### 6.1 What Stays (Unchanged)

The following are NOT modified by this redesign:

| Element | Reference | Status |
|---------|-----------|--------|
| Human absolute authority | P-AUTH-01 | Unchanged |
| Human override power | P-AUTH-02 | Unchanged |
| Observer advisory authority only | P-AUTH-03 | Unchanged |
| PAI delegated execution authority | P-AUTH-05 | Unchanged |
| Decision routing rules | P-AUTH-07, P-AUTH-08 | Unchanged |
| Authority priority in conflicts | P-AUTH-09 | Unchanged |
| System purpose | P-PUR-01, P-PUR-02, P-PUR-06 | Unchanged |
| Verification doctrine | P-DOC-01, P-BOUND-08 | Unchanged |
| Receipt requirements | P-BOUND-09, P-MASTER-01 | Unchanged |
| Council zero filesystem writes | P-COUNCIL-01 | Unchanged |
| Council deterministic output | P-COUNCIL-03 | Unchanged |
| Explicit assumptions in output | P-COUNCIL-02 | Unchanged |
| Agent write:false, edit:false, bash:false | P-AGENT-02 | Unchanged |
| "AI articulates, Human decides" | P-AGENT-01 | Unchanged |
| Escalation model | P-ESCAL-01 through P-ESCAL-04 | Extended (not replaced) |
| Creative input governance | P-CREAT-01 through P-CREAT-04 | Unchanged |
| Builder execution loop | council-builder-escalation-loop.md | Preserved (input enriched) |
| Stop conditions | P-ESCAL-02 | Unchanged |
| Reality Patches | P-ESCAL-03 | Unchanged |

### 6.2 What Changes (Cognitive Sequence)

| Element | Before | After | Rationale |
|---------|--------|-------|-----------|
| **Deliberation model** | Functional roles deliberate on technical decisions | Epistemic triad: Oscillate-Converge-Reflect as cognitive sequence | `[Source: G4]` |
| **Role set** | Clarifier, Architect, Sentry, Builder, Gatekeeper | Perspective Agents (2-4), Triangulator, Sentry, Reflector, Builder | `[Source: G4, G1, G3]` |
| **Clarifier role** | Dedicated role: interprets intent, resolves ambiguity | Absorbed into intake (Step 1) and Perspective Agent seeding. Clarification becomes a precondition for Oscillate, not a separate role. | Clarifier's function (understand the problem) is now distributed across intake and the Perspective Agent framing process |
| **Architect role** | Dedicated role: produces plans | Replaced by Triangulator + Perspective Agents. Architecture emerges from convergence of independent perspectives rather than from a single planning role. | `[Source: G1 -- signal from independent measurements, not from a single planner]` |
| **Convergence** | Implicit (no dedicated mechanism) | Explicit Triangulator role with kill list requirement | `[Source: G1]` |
| **Self-reflection** | Absent | Mandatory Reflector role with minimum output floor | `[Source: G3, G5]` |
| **Escalation paths** | Builder failure only | Builder failure (preserved) + Reflector process-quality (new) | `[Source: G2, G3]` |
| **Deliberation receipts** | Task-focused (what was decided) | Triad receipts (Oscillate perspectives, Converge invariant, Sentry flags, Reflect observations) | Richer audit trail from structured cognitive process |
| **Inter-session learning** | No formal mechanism | Reflect output feeds next Oscillate as seed material | `[Source: G3, G5]` REQ-R2 |

### 6.3 Role Transition Map

| Current Role | Disposition | Notes |
|--------------|-------------|-------|
| **Clarifier** | Retired as dedicated role | Function absorbed into intake + Perspective Agent seeding. The problem-understanding function persists; the standalone role does not. |
| **Architect** | Retired as dedicated role | Function replaced by Triangulator (convergence) + Perspective Agents (multi-lens design). Architecture is an emergent property of the triad, not a single-agent output. |
| **Sentry** | Preserved | Now operates on Triangulator output. Adversarial function unchanged. |
| **Builder** | Preserved | Receives richer work packet. Execution loop unchanged. |
| **Security Auditor** | Status unclear | Not addressed in the triad. If currently active, it may operate as a specialised Perspective Agent (security lens) or as a parallel Sentry function. Adam to decide. |
| **Gatekeeper (Human)** | Preserved | P-AUTH-01 unchanged. Human approves at the same decision points. |

---

## 7. ISC Criteria for the Redesigned Council

These criteria verify a correct implementation of this TDS:

1. Council deliberation follows the three-phase Oscillate-Converge-Reflect sequence
2. Perspective Agents generate framings in isolation without seeing each other
3. Independence check compares foundational assumptions across all agent pairs
4. Redundant perspectives are flagged before Converge phase begins execution
5. Triangulator produces structural invariant with non-empty kill list requirement
6. Sentry applies adversarial pressure on Triangulator output, not raw perspectives
7. Reflector produces all four required outputs every deliberation cycle
8. Reflect minimum output floor of M/2 pages is enforced before work packet assembly
9. Reflect output feeds next Oscillate cycle as seed material for lens assignment
10. Reflector produces motif candidates that enter pipeline at 02-Knowledge/motifs
11. Reflector process-quality escalation triggers on recurring patterns across three-plus deliberations
12. Reflector escalation payload includes trigger type, evidence, span, and impact
13. Builder work packet contains triad receipts from all three phases
14. Governance principles P-AUTH-01 through P-PUR-06 are unchanged in implementation
15. Clarifier and Architect functions are absorbed, not silently dropped
16. Human approval gates remain at all existing decision points

**Anti-criteria:**
- A1: Council does not grant decision authority to the Reflector
- A2: Perspectives are not visible to each other during Oscillate phase
- A3: Convergence phase does not produce output without a kill list when three-plus perspectives exist
- A4: Reflect phase is not reducible to a summary shorter than M/2 pages

---

## Appendix: Traceability Matrix

| Design Element | Source Claims |
|---------------|-------------|
| Three-phase cognitive sequence | G4, G1 |
| Perspective Agent independence requirement | G1 |
| Triangulator convergence mechanism | G1 |
| Reflector mandatory status | G3, G5 |
| Minimum output floor | G5, G3 |
| Reflect-to-Oscillate feedback | G3, G5 |
| Motif candidate production | G5 |
| Reflector escalation path | G2, G3 |
| Observation modifies observer (framework delta) | G2 |
