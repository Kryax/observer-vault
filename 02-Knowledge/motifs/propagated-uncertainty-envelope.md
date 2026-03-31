---
name: "Propagated Uncertainty Envelope"
tier: 1
status: provisional
confidence: 0.5
source: bottom-up
domain_count: 4
derivative_order: 1
primary_axis: integrate
created: 2026-03-10
updated: 2026-03-31
cssclasses:
  - status-draft
---

# Propagated Uncertainty Envelope

## Structural Description

A system that carries a model of what it doesn't know alongside its model of what it does know, and propagates both through its dynamics. The uncertainty representation is not merely an error bar or a flag — it's a structured quantity (covariance matrix, particle cloud, belief distribution, tube diameter) that transforms through the same system dynamics as the state estimate itself. Decisions are made by the joint representation, not by the point estimate alone.

## Domain-Independent Formulation

A system that models its own ignorance as a first-class quantity and propagates that meta-knowledge through its dynamics alongside its state estimate.

## Instances

### Instance 1: Control Theory / State Estimation
- **Domain:** Control Theory
- **Expression:** Kalman filters propagate a covariance matrix alongside the state estimate. The Unscented Kalman Filter (UKF) generates "sigma points" — a structured representation of uncertainty — and passes them through nonlinear system dynamics. Ensemble Kalman Filters maintain a cloud of possible states. Tube MPC wraps the nominal trajectory in an uncertainty tube whose diameter is a function of disturbance bounds. In every case, the uncertainty representation is not an afterthought — it's half the computation.
- **Discovery date:** 2026-03-10
- **Source:** bottom-up (OCP scrape: UKF, DYNAMAX, DAPPER, Robust Tube MPC, Kalman repos)

### Instance 2: Decision Theory / Cognitive Science
- **Domain:** Decision Theory
- **Expression:** POMDPs maintain a "belief state" — a probability distribution over possible hidden states — and the agent acts on the belief, not on any single state estimate. FSRS4Anki models human memory as a hidden state with stability and difficulty parameters that carry uncertainty. The scheduling algorithm acts on the uncertain model, not on a point estimate of memory strength.
- **Discovery date:** 2026-03-10
- **Source:** bottom-up (OCP scrape: POMDPs.jl, FSRS4Anki)

## Relationships

| Related Motif | Relationship | Description |
|---------------|-------------|-------------|
| Observer-Feedback Loop | complement | The feedback loop generates observations; the uncertainty envelope tracks how much those observations can be trusted. Without the envelope, the feedback loop has no epistemic grounding. |
| Bounded Buffer With Overflow Policy | tension | Buffers deal with *volume* overflow; uncertainty envelopes deal with *epistemic* overflow. Both are about what to do when you have more than you can handle. |

## Discovery Context

Identified during OCP scrape of 95 control theory and cybernetics repositories (2026-03-10). The pattern appeared in essentially every state estimation repository — Kalman filters, particle filters, ensemble methods, tube MPC — and independently in decision-theory repos (POMDPs, spaced repetition). The structural recurrence across control engineering and cognitive modelling suggests this is not domain-specific.

## Falsification Conditions

- If the uncertainty representation can be removed without changing the system's behavior (i.e., it's decorative logging, not decision-informing), then that instance is not genuine
- If all instances reduce to "handle errors gracefully" rather than "model and propagate structured uncertainty," the pattern is too broad
- If the pattern only appears in systems that explicitly use probability theory (i.e., it's just "Bayesian inference" rebranded), then it lacks structural independence
