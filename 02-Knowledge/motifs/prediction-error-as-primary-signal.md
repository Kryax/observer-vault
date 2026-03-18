---
name: "Prediction-Error as Primary Signal"
tier: 0
status: draft
confidence: 0.1
source: top-down
domain_count: 1
derivative_order: 2
primary_axis: recurse
created: 2026-03-19
updated: 2026-03-19
cssclasses:
  - status-draft
---

# Prediction-Error as Primary Signal

## Structural Description

A system generates a forward model of its expected next state, then compares that expectation against what actually arrives. Only the difference — the prediction error — propagates as signal. When the mismatch is small, the system coasts on its internal model. When the mismatch is large, the model is forced to update. The system therefore spends most of its processing energy on surprise rather than confirmation. This inverts the naive assumption that signal equals sensory input; instead, signal equals deviation from expectation.

## Domain-Independent Formulation

A system that generates expectations transmits only the delta between prediction and reality, making surprise — not confirmation — the primary information carrier.

## Instances

### Instance 1: Cognitive Science — Predictive Coding
- **Domain:** Cognitive Science / Neuroscience
- **Expression:** In the predictive processing framework, top-down predictions flow downward through cortical hierarchy; only prediction errors flow upward. Perception is largely "controlled hallucination" corrected by sparse error signals. The brain's energy budget is spent processing what was unexpected, not what was expected.
- **Discovery date:** 2026-03-19
- **Source:** top-down

### Instance 2: Music Theory — Cadential Expectation
- **Domain:** Music Theory
- **Expression:** Harmonic progressions build expectations about resolution. A deceptive cadence derives its entire structural force from violating a strong prediction. The meaning of the event is not in the chord itself but in the delta between what was predicted (tonic resolution) and what arrived (submediant substitution). Composers explicitly construct prediction engines in the listener and then exploit the error signal.
- **Discovery date:** 2026-03-19
- **Source:** top-down

## Relationships

| Related Motif | Relationship | Description |
|---------------|-------------|-------------|
| Observer-Feedback Loop | complement | OFL describes how observation modifies the observation frame; Prediction-Error describes the information-theoretic mechanism by which such modification occurs — via error signals rather than raw observation. |
| Metacognitive Steering | complement | Metacognitive Steering uses self-monitoring to steer; Prediction-Error describes the signal type (error, not state) that enables such steering. |

## Discovery Context

Discovered during a slow triad exploring cognitive science and music theory as unexplored domains for the motif library. The predictive coding framework in neuroscience and cadential expectation management in music theory independently surfaced the same structural shape: systems that transmit prediction errors rather than raw state.

## Falsification Conditions

- If systems described by this motif could be shown to work equally well by transmitting raw state rather than prediction error (i.e., the error-centric architecture provides no efficiency or functional advantage), the motif would be superficial.
- If the "prediction" in supposed instances is actually post-hoc rationalization rather than a genuine forward model generated before the observation, the motif would be illusory — prediction-error requires genuine temporal priority of the prediction.
