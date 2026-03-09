---
name: "Metacognitive Steering"
tier: 0
status: draft
confidence: 0.1
source: bottom-up
domain_count: 1
derivative_order: 2
primary_axis: recurse
created: 2026-03-09
updated: 2026-03-09
cssclasses:
  - status-draft
---

# Metacognitive Steering

## Structural Description

A system that tracks its own unresolved questions, gaps, or tensions does not merely record them — it models which gaps, if resolved, would produce the greatest improvement in overall capability. The system predicts its own learning progress and uses those predictions to prioritise which questions to pursue next. This creates a second-order feedback loop: the system observes what it doesn't know, predicts the value of knowing it, and steers itself toward the highest-value unknowns.

## Domain-Independent Formulation

A system that predicts the value of resolving its own gaps and uses those predictions to prioritise what to learn next generates a second-order steering loop over its own development.

## Instances

### Instance 1: Autotelic LLM Agents (MAGELLAN Framework)
- **Domain:** AI / Reinforcement Learning
- **Expression:** MAGELLAN enables LLM agents to predict their competence and learning progress online, leveraging semantic relationships between goals to prioritise learning efficiently. The agent navigates vast goal spaces adaptively by predicting which goals are most productive to pursue — not which are easiest or hardest, but which offer the greatest learning progress.
- **Discovery date:** 2026-03-09
- **Source:** bottom-up (OCP scraper: github/flowersteam--MAGELLAN, arXiv 2502.07709)

## Relationships

| Related Motif | Relationship | Description |
|---------------|-------------|-------------|
| observer-feedback-loop | composition | Metacognitive Steering is an Observer-Feedback Loop operating on the system's own gap state — the observed subject is the system's ignorance, and the feedback changes which ignorance gets addressed |
| dual-speed-governance | complement | Metacognitive Steering operates at slow speed (strategic prioritisation), while fast-speed execution resolves the selected gaps |
| progressive-formalization | tension | Progressive Formalization moves from amorphous to crystalline; Metacognitive Steering asks whether the system should even pursue crystallisation of a given concept, or redirect to a higher-value gap |

## Discovery Context

Identified during OCP scrape of metacognition topic on 2026-03-09. MAGELLAN (flowersteam/MAGELLAN) introduced the concept of metacognitive prediction of learning progress for LLM agents. The connection to Observer-native emerged through the tension tracker — Observer-native records unresolved gaps but does not predict which are most valuable to resolve. MAGELLAN's framework suggests the tension tracker could become an active steering mechanism, not just a passive backlog.

## Falsification Conditions

- If systems that predict gap-resolution value do not outperform systems that resolve gaps in arbitrary order (e.g., FIFO, random, or by difficulty), then the prediction adds no structural value and the motif is merely an optimisation heuristic
- If the predicted value of resolving a gap cannot be meaningfully estimated without actually resolving it (i.e., the prediction is computationally equivalent to the resolution), then the steering loop collapses to simple execution and the motif is trivial
- If the pattern only applies to systems with explicit goal spaces (RL agents with enumerable goals) and cannot be expressed in systems with emergent or open-ended goals, then the domain-independent formulation is too narrow
