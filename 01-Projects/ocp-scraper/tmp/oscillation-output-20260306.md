# Oscillation Output — OCP Scrape Cognitive Triad
**Date:** 2026-03-06
**Input:** 14 newly indexed records across 3 domains (robotics control: 10, distributed DB consensus: 2, game engine ECS: 2) + 2 empty domains (bioinformatics, smart contracts)

---

## Rules for this step
Cast wide. Quantity over quality. No filtering. What shapes recur? What's surprisingly similar across domains that shouldn't be?

---

## Observations

### O-1: Dual-speed control is explicit in robotics, not just a software architecture pattern
The CLF reactive planning system (UMich-BipedLab) runs at two explicit frequencies: **5 Hz planning thread** (slow, deliberate path planning) and **300 Hz reactive thread** (fast, real-time deviation correction). This is not a metaphor for dual-speed governance — it is literally two coupled cycles running at 60x speed difference, where the slow cycle constrains the fast cycle's goal state. The planning thread cannot run at 300 Hz (computationally impossible); the reactive thread cannot plan at 5 Hz (robot falls over). The coupling is structurally essential, not a design convenience.

### O-2: Model Predictive Control is a feedback loop with a horizon window
OCS2 and ContactImplicitMPC.jl both implement Model Predictive Control — a pattern where the system (a) observes current state, (b) predicts future states over a finite horizon, (c) selects the optimal control action for the immediate step, then (d) re-observes and repeats. The observation feeds back into the model, and the model evolves as the physical system state changes. The "horizon window" is essentially a bounded buffer of predicted future states — you can only look N steps ahead.

### O-3: Switched systems formalize state transitions in continuous domains
OCS2 is specifically for "Optimal Control for Switched Systems" — systems that transition between discrete modes (walking, running, contact, flight) while evolving continuously within each mode. This is the continuous-domain equivalent of Explicit State Machine Backbone: named modes, transitions between them, and behavior governed by which mode the system occupies. But the transitions happen in continuous physical space, not discrete software states.

### O-4: Contact-implicit planning treats constraint violation as a design parameter, not an error
ContactImplicitMPC doesn't avoid contact — it plans THROUGH contact. Making and breaking contact with the environment is expected, not a failure mode. The constraint boundary (touching vs. not touching ground) is a first-class planning parameter. This echoes bounded buffer with overflow policy: the boundary isn't an error condition, it's a design decision.

### O-5: Swarm coordination requires consensus without centralized authority
Mavswarm simulates multi-UAV coordination. Each drone makes autonomous decisions but must coordinate with the swarm. This is structurally identical to distributed consensus: independent agents reaching agreement on shared state without a central coordinator. The Raft protocol (dacha, raft-protocol-implementation) solves the same structural problem in databases: how do independent nodes agree on state?

### O-6: ECS architecture is composable plugin architecture expressed as data layout
Kengine and geotic both implement Entity-Component-System. ECS decomposes objects into entities (identity), components (data), and systems (behavior). Components are independently authored data types; systems are independently authored behavior plugins; entities are composed by combining components. This is structurally composable plugin architecture, but the composition happens through data co-location rather than interface contracts. The "interface" is implicit — systems query for component presence, not through explicit type contracts.

### O-7: ECS inverts the traditional hierarchy: data shapes behavior, not inheritance
In traditional OOP game engines, behavior is determined by class hierarchy. In ECS, behavior emerges from which data components are present on an entity. A "player" is just an entity with Position + Velocity + Input components. The same systems that move enemies move players — the behavior is data-determined, not type-determined. This is a structural inversion: the data IS the classification.

### O-8: Robotics control and game engines both solve the "real-time constraint satisfaction" problem
Both domains must produce valid outputs at fixed time intervals (control loop Hz / frame rate). Both deal with physics-constrained optimization. Both have the same fundamental tension: computation budget per step is fixed, but the problem space is continuous and potentially unbounded. The solutions converge: hierarchical decomposition (plan at one speed, execute at another), bounded computation budgets per step, and graceful degradation when the budget runs out.

### O-9: The absence of bioinformatics and smart contract results is itself a signal
Both empty domains are "compound query" failures — the specific term combinations ("bioinformatics pipeline orchestration", "smart contract governance infrastructure") don't match GitHub's tagging ecosystem. But the STRUCTURAL patterns exist in both domains. Bioinformatics pipelines (Nextflow, Snakemake) are already known to exhibit dual-speed governance, bounded buffers, and idempotent convergence. Smart contract governance (DAOs, Compound, Aave) implements dual-speed governance (proposal → vote → execute) and explicit state machines (proposal lifecycle). The patterns are there; the search terms weren't.

### O-10: Trust scores inversely correlate with domain specificity
The highest trust scores (OCS2: 0.579, ContactImplicitMPC: 0.404) came from repos with broad documentation, clear problem statements, and cross-reference potential. The lowest (CLF reactive planner: 0.071, dacha: 0.07) were highly specialized or poorly documented. Trust-as-curation is working: the repos most likely to yield structural insight score highest.

### O-11: Raft consensus is an explicit state machine applied to distributed agreement
The Raft protocol (both dacha and the standalone implementation) defines three explicit states: Follower, Candidate, Leader. Transitions are guarded: a Follower becomes a Candidate only after election timeout; a Candidate becomes Leader only after receiving majority votes. The state machine IS the consensus mechanism. Invalid transitions (jumping from Follower to Leader) are structurally impossible. This is Explicit State Machine Backbone applied to distributed agreement.

### O-12: Robotics control uses URDF models as scaffold-first architecture
OCS2 builds from URDF (Unified Robot Description Format) — a complete structural description of the robot's kinematics and dynamics. The URDF is authored BEFORE any control computation happens. It defines the structural frame (joint limits, link geometry, mass distribution) that constrains ALL subsequent optimization. This is scaffold-first: the model shapes the control, not the reverse.

### O-13: The "reactive" pattern appears at different timescales across domains
CLF reactive planner: 300 Hz physical correction. Game engine frame loop: 60 Hz world update. Kubernetes reconciliation: ~30s convergence loops. Database consensus: millisecond leader election. The SHAPE is the same — sense current state, compare to desired state, apply correction — but the timescale spans 5 orders of magnitude.

### O-14: Soft-body robotics (SorotokiCode) challenges the rigid state machine assumption
SorotokiCode models soft robots — structures without discrete joints or rigid states. The robot's configuration is a continuous deformation field, not an enumerated set of joint angles. This is a domain where Explicit State Machine Backbone may be a non-instance: the physical system genuinely doesn't have discrete states to enumerate.

### O-15: Both robotics and game ECS use the "world model" as the single source of truth
In robotics, the URDF + state estimation forms the world model. In ECS, the component store IS the world model. All behavior queries this model. All mutations go through defined channels (control commands / system execution). The world model is not a side effect — it's the primary data structure that everything else serves.

### O-16: Inverse kinematics (closed-chain IK) is constraint satisfaction under composition
Closed-chain IK (gkjohnson/closed-chain-ik-js) solves for joint positions that satisfy multiple simultaneous constraints (end effector positions, joint limits, chain closure). This is composable constraint satisfaction — each constraint is independently defined, and the solver finds solutions that satisfy their composition. The constraints compose; the solution emerges.

### O-17: The monorepo pattern in dacha echoes composable architecture
Dacha is a Rust monorepo containing distributed systems tools: consensus, storage, networking, compute. Each component is independently buildable but designed to compose within the monorepo. This mirrors composable plugin architecture at the project organization level — independent modules, shared interface expectations, composition as the growth mechanism.

### O-18: Control barrier functions (CBFs) formalize "anti-criteria"
Online_adaptive_CBF implements control barrier functions — mathematical guarantees that the system will NEVER enter a forbidden region of state space. CBFs are literally anti-criteria in control theory: they define what must NOT happen (collision, instability, constraint violation) and the controller is mathematically guaranteed to respect these boundaries. The anti-criterion IS the controller's primary constraint.

### O-19: All 14 indexed records are classified as "complex" in Cynefin
Every single scraped record was classified as Cynefin "complex" domain. This suggests the scraper's Cynefin classification may be over-counting complex and under-counting complicated. Or: these particular topics genuinely are complex systems where cause-effect relationships emerge rather than being predetermined.

### O-20: The observer pattern is literally built into ROS
Multiple robotics repos use ROS (Robot Operating System), which is built on a publish-subscribe message passing system. Observers subscribe to topics; publishers emit state changes. The observer-feedback pattern is the foundational communication model of the entire robotics middleware ecosystem.
