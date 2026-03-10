---
name: "Safety-Liveness Duality"
tier: 0
status: draft
confidence: 0.1
source: bottom-up
domain_count: 1
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
