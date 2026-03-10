---
meta_version: 1
kind: analysis
status: draft
authority: low
domain:
  - architecture
  - control-theory
  - cybernetics
source: ocp-scraper
created: 2026-03-10
cssclasses:
  - status-draft
---

# OCP Scrape: Control Theory & Cybernetics — D/I/R Triad Analysis

> Source document for motif candidates extracted via OCP scrape of control theory, cybernetics, state estimation, PID control, optimal control, and robotics repositories.

## Scrape Summary

| Topic | Processed | Indexed | Filtered | Errors | Top Record (Stars) |
|-------|-----------|---------|----------|--------|-------------------|
| control-systems | 11 | 10 | 1 | 0 | AirSim (17,999) |
| kalman-filter | 11 | 10 | 1 | 0 | Financial-Models (6,719) |
| pid-controller | 12 | 10 | 2 | 0 | simple-pid (894) |
| control-theory | 17 | 10 | 3 | 4 | TorchDyn (1,555) |
| state-estimation | 13 | 10 | 3 | 0 | VINS-Mono (5,789) |
| optimal-control | 12 | 10 | 1 | 1 | FSRS4Anki (3,837) |
| feedback-loop | 17 | 10 | 6 | 1 | RxFeedback (1,025) |
| robotics control | 15 | 10 | 0 | 5 | PythonRobotics (28,824) |
| adaptive control | 6 | 4 | 2 | 0 | ECGTransForm (61) |
| robust control | 6 | 4 | 2 | 0 | Robust Tube MPC (590) |
| mpc-controller | 5 | 2 | 3 | 0 | DDP (71) |
| motion-planning | 5 | 5 | 0 | 0 | Fast-Planner (3,208) |

**Total:** 130 processed, 95 indexed, 24 filtered, 11 errors. Index: 95 records, 792 graph edges.

## Key Records Inspected

### Control Toolbox (ethz-adrl/control-toolbox)
- **Stars:** 1,667 | **Trust:** 0.581 | **Language:** C++
- **Description:** Open-source C++ library for efficient modelling, control, estimation, trajectory optimization and model predictive control.
- **Tags:** disturbance-observer, extended-kalman-filter, ilqr, model-predictive-control, riccati-solver, trajectory-optimization
- **Structural shape:** A *toolbox* — the system decomposes control into composable modules (system model, cost function, controller, estimator) that can be mixed and matched. Each module has a defined interface. The system state flows through a pipeline: model → estimate → control → actuate → observe.

### ControlSystems.jl (JuliaControl/ControlSystems.jl)
- **Stars:** 573 | **Trust:** 0.331 | **Language:** Julia
- **Tags:** bode-plot, kalman-filter, lqg-controller, pid-control, riccati-equations, simulations
- **Structural shape:** Classical control theory as code. Transfer functions, state-space models, frequency domain analysis. The key structural pattern: *every controller is a transfer function* — a mathematical object that maps input signals to output signals. The same interface handles continuous and discrete systems. Analysis tools (Bode, Nyquist) are *observers of the controller*, not part of the controller itself.

### RxFeedback (NoTests/RxFeedback.swift)
- **Stars:** 1,025 | **Trust:** 0.504 | **Language:** Swift
- **Tags:** architecture, feedback-loop, rxswift, universal-operator
- **Description:** "The universal system operator and architecture for RxSwift"
- **Structural shape:** The most structurally interesting record for D/I/R analysis. RxFeedback models *all* system behavior as a feedback loop: State → Mutations → State. "Feedback" is a first-class architectural primitive, not an afterthought. The system is a pure function `(State) → [Mutation]` driven by feedback effects that observe state and produce mutations. This is control theory applied directly to software architecture.

### POMDPs.jl (JuliaPOMDP/POMDPs.jl)
- **Stars:** 747 | **Trust:** 0.622 | **Language:** Julia
- **Description:** MDPs and POMDPs — defining, solving, and simulating fully and partially observable Markov decision processes.
- **Structural shape:** The system distinguishes between *fully observable* (MDP) and *partially observable* (POMDP) decision processes. In a POMDP, the agent cannot see the true state — it maintains a *belief* (probability distribution over possible states) and acts on that belief. The observation function mediates between true state and perceived state. This is the mathematical formalization of the observer-observed gap.

### FSRS4Anki (open-spaced-repetition/fsrs4anki)
- **Stars:** 3,837 | **Trust:** 0.569 | **Language:** Jupyter Notebook
- **Tags:** optimal-control, reinforcement-learning, spaced-repetition
- **Structural shape:** Spaced repetition as an *optimal control problem*. The "plant" is human memory. The "controller" is the scheduling algorithm. The "observer" is the review outcome (correct/incorrect). The system continuously estimates memory state (stability, difficulty) and computes optimal review intervals. Control theory applied to cognition — the system tries to control something it can only partially observe (your memory).

### CBF-CLF-Helper (HybridRobotics/CBF-CLF-Helper)
- **Stars:** 357 | **Trust:** 0.396 | **Language:** MATLAB
- **Tags:** control-barrier-functions, control-lyapunov-functions, safety-critical
- **Structural shape:** Safety as a *hard constraint on the controller*, not a property to be optimized. Control Barrier Functions (CBFs) define invariant safe sets — regions of state space the system must never leave. Control Lyapunov Functions (CLFs) guarantee convergence to a goal. The structural insight: safety and liveness are dual constraints on the same control signal. The system must simultaneously "stay safe" and "make progress."

### UKF (sfwa/ukf)
- **Stars:** 513 | **Trust:** 0.450 | **Language:** C++
- **Tags:** kalman-filter, state-estimation, unscented-filtering
- **Structural shape:** State estimation under uncertainty. The Unscented Kalman Filter propagates a set of "sigma points" through the nonlinear system dynamics to estimate the true state. The key structural insight: *the observer must model its own uncertainty*. The filter doesn't just estimate state — it estimates the *distribution* of possible states, and updates that distribution as new observations arrive.

### DYNAMAX (probml/dynamax)
- **Stars:** 935 | **Trust:** 0.308 | **Language:** Python
- **Tags:** hidden-markov-models, kalman-filter, state-space-models
- **Structural shape:** Probabilistic state-space modelling. The system separates *latent state* (hidden) from *observations* (visible). Inference algorithms (Kalman smoother, EM) recover the latent state from noisy observations. The structural pattern: you never see the real thing — only its projections through an observation function.

### DAPPER (nansencenter/dapper)
- **Stars:** 398 | **Trust:** 0.507 | **Language:** Python
- **Tags:** data-assimilation, enkf, kalman-filtering, particle-filter, state-estimation
- **Structural shape:** Data assimilation — merging a model's predictions with actual observations. The Ensemble Kalman Filter (EnKF) maintains an *ensemble* of possible states and updates them against observations. The structural pattern: multiple parallel estimates of reality, continuously reconciled with evidence.

### NeuroMANCER (pnnl/neuromancer)
- **Stars:** 1,293 | **Trust:** 0.625 | **Language:** Python
- **Tags:** differentiable-control, differentiable-optimization, physics-informed-ml
- **Structural shape:** Neural networks as differentiable control systems. The controller is a neural net that learns from data while respecting physics constraints. The system can be trained end-to-end because every component is differentiable. The structural pattern: making the control law learnable while preserving structural guarantees from physics.

### Robust Tube MPC (hiroishida/robust-tube-mpc)
- **Stars:** 590 | **Trust:** 0.308 | **Language:** MATLAB
- **Tags:** convex, model-predictive-control, robust, tube
- **Structural shape:** Tube MPC wraps the nominal trajectory in a "tube" of guaranteed safe states. The system plans as if it has a perfect model, then uses robust control to keep the actual trajectory inside the tube despite disturbances. Two-speed operation: the MPC optimizes at a fast rate, the tube contracts/expands at a slower rate based on disturbance bounds.

---

## D — Differentiate: What structural patterns appear?

Looking across the 95 repos, five recurring structural shapes emerge:

### 1. The Estimator-Controller Separation

Nearly every control system cleanly separates *estimation* (figuring out where you are) from *control* (deciding what to do). The estimator observes the plant, infers hidden state, and passes that estimate to the controller. The controller never touches raw observations directly.

**Instances:** Control Toolbox (explicit estimator module), ControlSystems.jl (Kalman filter as observer), UKF (pure estimator), DAPPER (data assimilation), VINS-Mono (visual-inertial state estimation feeding navigation), safe-control-gym (separate estimation and policy).

This is not just software modularity — it's an epistemic claim: *you act on beliefs about state, never on state itself*.

### 2. The Feedback Loop as Architectural Primitive

Control theory treats the feedback loop not as one pattern among many but as the *fundamental unit of system behavior*. RxFeedback makes this explicit: all behavior is `State → Mutation → State`. PID controllers are literally named for three feedback terms. MPC is just "feedback with a planning horizon."

**Instances:** RxFeedback (feedback as architecture), ArduPID (canonical feedback), simple-pid (minimal feedback), AutomationShield (educational feedback), Gontroller (feedback controllers for Kubernetes), PythonVRFT (tuning feedback parameters from data).

The structural shape: *a system that observes its own output and uses that observation to modify its input*. This is a closed loop — not a pipeline, not a tree, but a cycle.

### 3. The Uncertainty Envelope

Multiple repos explicitly model uncertainty as a first-class quantity. Not "handle errors gracefully" but "propagate a probability distribution through the system dynamics."

**Instances:** UKF (sigma points — propagating uncertainty through nonlinear dynamics), DYNAMAX (belief states over hidden Markov models), POMDPs.jl (belief as probability distribution over states), DAPPER (ensemble of possible states), Robust Tube MPC (tube = uncertainty envelope around nominal trajectory), Kalman filters everywhere (covariance matrix = structured uncertainty).

The structural shape: *the system carries a model of what it doesn't know alongside its model of what it does know*. Uncertainty is not noise to be filtered — it's information to be propagated.

### 4. The Safety-Liveness Duality

CBF-CLF-Helper crystallizes a deep structural pattern: a control system must simultaneously satisfy two competing requirements — *safety* (don't leave the safe set) and *liveness* (make progress toward the goal). These are formalized as hard constraints on the same control signal.

**Instances:** CBF-CLF-Helper (explicit barrier/Lyapunov duality), safe-control-gym (constrained RL with safety), Robust Tube MPC (stay in tube = safety, follow trajectory = liveness), acados (constrained optimal control).

The structural shape: *two dual constraints operating on the same action space*. The system must not just optimize — it must optimize *within a safe set*.

### 5. The Plant-Model Gap

Control theory is obsessed with the gap between the mathematical model and the physical plant. System identification exists to close this gap. Robust control exists to survive it. Adaptive control exists to track it over time.

**Instances:** NeuroMANCER (physics-informed learning — close the gap with data), PythonVRFT (tune controllers from plant data, not models), TorchDyn (neural ODEs — learn the dynamics), system identification repos, Robust Tube MPC (the tube accounts for model error).

The structural shape: *every model is wrong, and the system must account for the gap between model and reality*.

---

## I — Integrate: Where do these patterns overlap with existing motifs?

### Strong Overlaps

**1. Estimator-Controller Separation ↔ Observer-Feedback Loop (Tier 1)**

The estimator-controller separation is the control-theory expression of the Observer-Feedback Loop motif. In Observer-native, S1 emits events (observations), S2 filters them (estimation), and the governance layer decides what to do (control). The mapping is nearly exact:

| Control Theory | Observer-native |
|---------------|----------------|
| Plant | Session (the thing being observed) |
| Sensor | S1 event emitter |
| Estimator | S2 salience filter |
| Controller | Governance / tension tracker |
| Actuator | Tool calls / actions |

This strengthens the Observer-Feedback Loop motif with a major new domain instance (control engineering). The control-theory instance is the *canonical* instance — it's the domain that formalized the pattern.

**2. Feedback Loop as Primitive ↔ Explicit State Machine Backbone (Tier 2)**

The feedback loop repos universally model their systems as explicit state machines. RxFeedback's `State → Mutation → State` is a state machine. PID's `setpoint → error → correction → output` is a state machine. MPC's `plan → execute → observe → replan` is a state machine. The feedback loop *is* a state machine with a particular topology (a cycle).

**3. The Uncertainty Envelope — NEW**

This does not map cleanly to any existing motif. The closest is Observer-Feedback Loop (the observer models what it observes), but the Uncertainty Envelope goes further: the system explicitly models *what it doesn't know* and propagates that meta-knowledge through its dynamics. This is a distinct structural pattern.

**4. Safety-Liveness Duality ↔ Dual-Speed Governance (Tier 2)**

There's a partial structural overlap. Dual-Speed Governance says fast/slow cycles coexist and couple. Safety-Liveness Duality says safety constraints and progress objectives coexist and couple. But they're not the same pattern — Dual-Speed is about *temporal* scale separation, Safety-Liveness is about *constraint* duality. The overlap is that both involve two competing concerns operating on the same substrate.

**5. Plant-Model Gap ↔ Progressive Formalization (Tier 1)**

Partial overlap. Progressive Formalization describes the trajectory from amorphous to crystalline. The plant-model gap is about the *persistent* distance between model and reality. System identification *is* progressive formalization of a plant model. But the gap is never fully closed in control theory — the pattern is not "converge to truth" but "operate despite gap."

### New Shapes Not in Library

**A. The Uncertainty Envelope** — Carrying a model of what you don't know alongside what you do know, and propagating both through system dynamics. Seen in: Kalman filters (covariance matrix), POMDPs (belief state), Tube MPC (tube diameter), ensemble methods (particle cloud).

**B. Dual Constraint on Shared Action Space** — Two competing requirements (safety/liveness, explore/exploit, fast/slow) formalized as hard constraints on the same control signal. Structurally distinct from Dual-Speed Governance (which is about temporal coupling, not constraint coupling).

---

## R — Recurse: What does this domain reveal about D/I/R itself?

### The Observer-Observed Relationship Maps Directly

Control theory is the mathematical formalization of the observer-observed relationship. A Kalman filter is literally an "observer" in control-theory terminology — it observes a plant and estimates its hidden state. The entire field is built on the structural assumption that *you never have direct access to the thing you're trying to control*. You always work through observations, models, and estimates.

This maps directly onto D/I/R:
- **D** (Differentiate) = *observing* — collecting data, separating signal from noise, building distinctions
- **I** (Integrate) = *estimating* — combining observations into a coherent state estimate, fusing information
- **R** (Recurse) = *controlling* — acting on the estimate, which changes the plant, which changes the observations, which changes the estimate, closing the loop

The D/I/R triad *is* the observe-estimate-control cycle. This is not a metaphorical similarity — it's the same structural relationship.

### The Certainty Gradient

Control theory reveals something D/I/R doesn't explicitly name: *every observation degrades as it propagates through inference*. Raw sensor data has the highest certainty. The state estimate is lower. The predicted future state is lower still. The optimal action computed from that prediction inherits all accumulated uncertainty. The system operates on a certainty gradient from observation to action.

This maps onto a potential weakness in Observer-native: the framework tracks *what* is observed but not *how certain* we are about it. The tension tracker should carry confidence, not just priority.

### Motif Candidates

#### Tier 0 Candidate: Propagated Uncertainty Envelope

**Justification:** The structural pattern of carrying a model of what you don't know alongside what you do know, and propagating both through system dynamics, appears independently in:
1. **Control theory / state estimation** — Kalman filter covariance matrices, UKF sigma points, ensemble methods, tube MPC
2. **Cognitive architecture** — POMDPs (belief states over hidden states), FSRS4Anki (memory stability estimates with uncertainty)

The pattern is not "handle errors" — it's "model your own ignorance as a first-class quantity and let it inform your decisions." This is structurally distinct from any existing motif.

**Primary axis:** integrate (maintains connections across the certain/uncertain boundary)
**Derivative order:** 1 (describes how uncertainty changes across domains — a dynamic)

#### Tier 0 Candidate: Separation of Estimation and Control

**Justification:** The structural pattern of cleanly separating "figuring out where you are" from "deciding what to do" appears independently in:
1. **Control theory** — explicit estimator-controller architecture in every major framework
2. **Software architecture** — observer pattern, event sourcing, CQRS (command-query separation)

This is a structural primitive that recurs because mixing observation and action creates unstable feedback loops. The separation is load-bearing, not organizational.

**Primary axis:** differentiate (creates a hard boundary between observation and action)
**Derivative order:** 1 (describes the dynamics of how systems partition their cognitive load)

#### Tier 0 Candidate: Safety-Liveness Duality

**Justification:** The structural pattern of two competing requirements formalized as hard constraints on the same action space appears independently in:
1. **Control theory** — CBF/CLF constraints, tube MPC (stay in tube / follow trajectory)
2. **Distributed systems** — the FLP impossibility result, CAP theorem (safety vs. liveness in consensus)

Every system that must both "make progress" and "avoid catastrophe" encounters this duality. It's not a design choice — it's a structural constraint.

**Primary axis:** differentiate (creates the boundary between the safe set and the unsafe set)
**Derivative order:** 2 (it's a generative mechanism — knowing this pattern changes how you design constraint systems)

### Relationship to Existing Motifs

The Observer-Feedback Loop (Tier 1, confidence 0.5) gains a major new domain instance from control theory. This scrape provides the strongest evidence yet for promotion — control theory is the *canonical domain* for this pattern. Recommend updating the motif entry with the control-theory instance and considering Tier 2 candidacy.

---

## Scrape Metadata

- **Date:** 2026-03-10
- **Topics:** 12 queries across control theory, cybernetics, state estimation, PID, optimal control, robotics
- **Total indexed:** 95 records
- **Graph edges:** 792
- **Index status:** Rebuilt from scratch (FTS5 fix applied to store/index.ts)
- **Bug fixed:** FTS5 external content table sync — `INSERT OR REPLACE` caused rowid drift breaking FTS `delete` command. Fixed with explicit DELETE + INSERT cycle.
