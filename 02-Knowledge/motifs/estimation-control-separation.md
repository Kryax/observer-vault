---
name: "Estimation-Control Separation"
tier: 0
status: draft
confidence: 0.1
source: bottom-up
domain_count: 1
derivative_order: 1
primary_axis: differentiate
created: 2026-03-10
updated: 2026-03-10
cssclasses:
  - status-draft
---

# Estimation-Control Separation

## Structural Description

A system that cleanly separates the process of "figuring out where you are" (estimation) from "deciding what to do" (control). The estimator observes the plant, infers hidden state from noisy/incomplete observations, and passes a state estimate to the controller. The controller operates on the estimate, never on raw observations. The separation is load-bearing: mixing observation and action in the same component creates unstable feedback loops because the action changes what you observe while you're still observing.

## Domain-Independent Formulation

A system partitions cognition into distinct estimation and action phases, where the actor operates on inferred state rather than raw observation.

## Instances

### Instance 1: Control Theory
- **Domain:** Control Engineering
- **Expression:** The estimator-controller architecture is a foundational pattern in control theory. The "separation principle" (proved for LQG systems) states that the optimal estimator and optimal controller can be designed independently. The Control Toolbox, ControlSystems.jl, ros2_control, and virtually every control framework implement this separation. The Kalman filter (estimator) and LQR (controller) are canonical independent components.
- **Discovery date:** 2026-03-10
- **Source:** bottom-up (OCP scrape: Control Toolbox, ControlSystems.jl, ros2_control, UKF, safe-control-gym)

### Instance 2: Software Architecture
- **Domain:** Software Architecture
- **Expression:** CQRS (Command Query Responsibility Segregation) separates read models from write models. Event sourcing separates event capture from event processing. The Observer pattern separates observation from reaction. In each case, the system avoids coupling "what happened" with "what to do about it."
- **Discovery date:** 2026-03-10
- **Source:** bottom-up (structural analogy from RxFeedback, Gontroller, Observer-native S1/S2 split)

## Relationships

| Related Motif | Relationship | Description |
|---------------|-------------|-------------|
| Observer-Feedback Loop | composition | The Observer-Feedback Loop describes the cycle; Estimation-Control Separation describes the internal structure of one half-cycle. The estimator is the "observe" phase; the controller is the "act" phase. |
| Dual-Speed Governance | complement | The estimation and control components often operate at different speeds — estimation at sensor rate, control at actuator rate. This is a specific instance of dual-speed coupling. |
| Propagated Uncertainty Envelope | complement | The estimation phase produces an uncertainty-annotated state; the control phase consumes it. The envelope lives at the interface between estimation and control. |

## Discovery Context

Identified during OCP scrape of 95 control theory and cybernetics repositories (2026-03-10). The separation principle is so fundamental in control theory that it's rarely called out as a "pattern" — it's just how things are done. But seen from outside the domain, it's a striking structural commitment: you never act on what you see, only on what you infer from what you see.

## Falsification Conditions

- If the separation provides no stability benefit (i.e., systems that mix estimation and control perform equally well), then the separation is organizational, not structural
- If all instances are simply "read-before-write" or "look-before-you-leap" (too broad), the formulation needs tightening
- If the pattern only holds for linear systems (where the separation principle is provably optimal) and breaks for nonlinear systems, it's a mathematical result, not a structural motif
