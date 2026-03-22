---
name: "Safety-Liveness Duality"
tier: 1
status: provisional
confidence: 0.7
source: triangulated
domain_count: 7
derivative_order: 2
primary_axis: differentiate
created: 2026-03-10
updated: 2026-03-10
cssclasses:
  - status-draft
---

# Safety-Liveness Duality

## Structural Description

A system that must simultaneously satisfy two competing requirements formalized as hard constraints on the same action space: *safety* (do not leave the acceptable region) and *liveness* (make progress toward a goal). Neither requirement can be relaxed — a system that is safe but makes no progress is useless, and a system that progresses but is unsafe is dangerous. The structural tension is that safety constraints shrink the action space while liveness requirements demand movement within it. The system must find actions that satisfy both, and when they conflict, safety dominates.

## Domain-Independent Formulation

Two dual constraints — one bounding what must not happen, one requiring what must happen — compete for the same action space, with the bounding constraint taking priority.

## Instances

### Instance 1: Control Theory (CBF/CLF)
- **Domain:** Control Engineering
- **Expression:** Control Barrier Functions (CBFs) define invariant safe sets that the system must never leave. Control Lyapunov Functions (CLFs) guarantee convergence to a goal state. Both are expressed as constraints on the control signal. The CBF-CLF-QP (quadratic program) finds the control action that satisfies both, with safety taking strict priority. Tube MPC implements the same duality: the tube boundary is the safety constraint, the nominal trajectory is the liveness requirement.
- **Discovery date:** 2026-03-10
- **Source:** bottom-up (OCP scrape: CBF-CLF-Helper, Robust Tube MPC, safe-control-gym, acados)

### Instance 2: Distributed Systems (FLP/CAP)
- **Domain:** Distributed Systems
- **Expression:** The FLP impossibility result (Fischer, Lynch, Paterson, 1985) proves that in an asynchronous system, you cannot guarantee both safety (agreement) and liveness (termination) if even one process can fail. The CAP theorem encodes a similar impossibility for distributed databases. Every consensus protocol (Raft, PBFT, Paxos) makes an explicit tradeoff between these dual constraints, with safety (consistency) typically dominating.
- **Discovery date:** 2026-03-10
- **Source:** bottom-up (structural analogy)

### Instance 3: Formal Verification — Alpern-Schneider Decomposition
- **Domain:** Formal Methods / Computer Science Theory
- **Expression:** Alpern and Schneider (1985) proved that every temporal property decomposes into safety ∩ liveness. This is a mathematical theorem, not a design choice. Safety violations have finite counterexamples; liveness violations require infinite traces. Model checkers must use different algorithms for each, reflecting the structural asymmetry.
- **Discovery date:** 2026-03-23
- **Source:** bottom-up (ocp:sep/logic-temporal)

### Instance 4: Medical Ethics — Nonmaleficence vs. Beneficence
- **Domain:** Medical Ethics / Bioethics
- **Expression:** "First, do no harm" (safety) versus "act for patient benefit" (liveness). When they conflict, safety dominates: IRBs prioritise risk over research progress. The Beauchamp-Childress four principles framework encodes the duality as two of four principles.
- **Discovery date:** 2026-03-23
- **Source:** domain knowledge

### Instance 5: Constitutional Law — Negative Rights vs. Positive Powers
- **Domain:** Constitutional Law / Political Philosophy
- **Expression:** Negative rights ("state must NOT do X" — safety) and positive powers ("state MUST do Y" — liveness). Berlin's negative/positive liberty distinction captures the same structure. Safety dominates: constitutional amendments are harder to pass than to block, judicial review can strike down legislation.
- **Discovery date:** 2026-03-23
- **Source:** domain knowledge

### Instance 6: Ecology — Conservation vs. Exploitation
- **Domain:** Ecology / Resource Management
- **Expression:** Do not deplete below recovery threshold (safety) vs. extract sufficient value (liveness). The Atlantic cod collapse (1992) illustrates liveness overriding safety. The Precautionary Principle is the institutional embodiment of safety dominance.
- **Discovery date:** 2026-03-23
- **Source:** domain knowledge

### Instance 7: Game Design — Constraint vs. Agency
- **Domain:** Game Design / Interactive Systems
- **Expression:** Prevent exploits and degenerate strategies (safety) vs. enable player expression and meaningful choice (liveness). In competitive games, rule integrity (safety) always dominates player preference (liveness).
- **Discovery date:** 2026-03-23
- **Source:** domain knowledge

## Relationships

| Related Motif | Relationship | Description |
|---------------|-------------|-------------|
| Dual-Speed Governance | tension | Dual-Speed couples fast and slow processes on a temporal axis. Safety-Liveness couples competing constraints on an action axis. Related but structurally distinct — one is about time, the other about constraint. |
| Bounded Buffer With Overflow Policy | complement | An overflow policy is a specific safety-liveness tradeoff: the buffer must not overflow (safety) but must accept new data (liveness). The overflow policy is the mechanism that resolves the dual constraint. |
| Explicit State Machine Backbone | complement | State machines with guards implement safety-liveness: guards enforce safety (can't transition to unsafe states), transition logic enforces liveness (must eventually make progress). |

## Discovery Context

Identified during OCP scrape of 95 control theory and cybernetics repositories (2026-03-10). The CBF-CLF-Helper repository made the duality explicit and formal. Cross-referenced with the distributed systems formalization (FLP, CAP) which encodes the same structural relationship in a different domain. The duality appears to be a structural invariant of any system that must both "do something" and "not break."

## Falsification Conditions

- If the safety and liveness requirements can always be satisfied independently (no genuine tension), then this is two separate patterns, not a duality
- If the "safety dominates" priority is not structural but merely a design choice (i.e., liveness-dominant systems work equally well), the duality claim is weakened
- If all instances reduce to "trade-offs exist" (too broad), the formulation lacks structural specificity
