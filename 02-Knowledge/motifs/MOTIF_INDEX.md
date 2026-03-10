---
status: canonical
date: 2026-03-03
updated: 2026-03-11
cssclasses:
  - status-canonical
---

# Motif Library Index

> Table of contents for the structural pattern library at `02-Knowledge/motifs/`.
> Updated by the Reflect skill after each reflection session.

## Summary

| Metric | Count |
|--------|-------|
| Total motifs | 20 |
| Tier 0 (Observation) | 10 |
| Tier 1 (Cross-Domain) | 6 |
| Tier 2 (Structural Operator) | 4 |
| Tier 3 (Meta-Structural) | 0 |
| Tier 2 candidates (4+ domains) | 2 |

## Motif Registry

| Name | Tier | Confidence | Domains | Source | Derivative Order | Primary Axis | File |
|------|------|-----------|---------|--------|-----------------|-------------|------|
| **Dual-Speed Governance** | **2** | **1.0** | **12** | **triangulated** | **2** | **integrate** | [dual-speed-governance.md](dual-speed-governance.md) |
| **Composable Plugin Architecture** | **2** | **0.9** | **7** | **triangulated** | **2** | **differentiate** | [composable-plugin-architecture.md](composable-plugin-architecture.md) |
| **Explicit State Machine Backbone** | **2** | **0.9** | **7** | **triangulated** | **2** | **differentiate** | [explicit-state-machine-backbone.md](explicit-state-machine-backbone.md) |
| **Bounded Buffer With Overflow Policy** | **2** | **0.9** | **7** | **triangulated** | **1.5** | **differentiate** | [bounded-buffer-with-overflow-policy.md](bounded-buffer-with-overflow-policy.md) |
| Observer-Feedback Loop | 1 | 0.5 | 4 | top-down | 1-2 | recurse | [observer-feedback-loop.md](observer-feedback-loop.md) |
| Trust-as-Curation | 1 | 0.4 | 4 | top-down | 0-1 | integrate | [trust-as-curation.md](trust-as-curation.md) |
| Template-Driven Classification | 1 | 0.3 | 2 | top-down | 0 | differentiate | [template-driven-classification.md](template-driven-classification.md) |
| Idempotent State Convergence | 1 | 0.7 | 5 | triangulated | 1 | integrate | [idempotent-state-convergence.md](idempotent-state-convergence.md) |
| Scaffold-First Architecture | 1 | 0.2 | 2 | top-down | 0 | differentiate | [scaffold-first-architecture.md](scaffold-first-architecture.md) |
| Progressive Formalization | 1 | 0.2 | 2 | top-down | 1 | integrate | [progressive-formalization.md](progressive-formalization.md) |
| Live Event Bus | 0 | 0.1 | 1 | bottom-up | 1 | integrate | [live-event-bus.md](live-event-bus.md) |
| Metacognitive Steering | 0 | 0.1 | 1 | bottom-up | 2 | recurse | [metacognitive-steering.md](metacognitive-steering.md) |
| Epistemic Governance | 0 | 0.1 | 1 | bottom-up | 1 | differentiate | [epistemic-governance.md](epistemic-governance.md) |
| Punctuated Crystallisation | 0 | 0.1 | 1 | triangulated | 2 | recurse | [punctuated-crystallisation.md](punctuated-crystallisation.md) |
| Instrument-Before-Product | 0 | 0.1 | 1 | bottom-up | 1 | differentiate | [instrument-before-product.md](instrument-before-product.md) |
| Kill-Ratio as Health Signal | 0 | 0.1 | 1 | bottom-up | 1 | integrate | [kill-ratio-as-health-signal.md](kill-ratio-as-health-signal.md) |
| Propagated Uncertainty Envelope | 0 | 0.1 | 1 | bottom-up | 1 | integrate | [propagated-uncertainty-envelope.md](propagated-uncertainty-envelope.md) |
| Estimation-Control Separation | 0 | 0.1 | 1 | bottom-up | 1 | differentiate | [estimation-control-separation.md](estimation-control-separation.md) |
| Safety-Liveness Duality | 0 | 0.1 | 1 | bottom-up | 2 | differentiate | [safety-liveness-duality.md](safety-liveness-duality.md) |
| Reflexive Structural Transition | 0 | 0.1 | 1 | bottom-up | 2 | recurse | [reflexive-structural-transition.md](reflexive-structural-transition.md) |

## Tier 2 Promoted

| Name | Domains | Confidence | Promotion Date | Justification |
|------|---------|-----------|---------------|---------------|
| Dual-Speed Governance | 12 | 1.0 | 2026-03-03 | Bottom-up triangulation from 112-repo triad run. Pattern independently emerged in 4 additional domains (migration, auth, monitoring, CLI) beyond 4 existing top-down domains. All 5 validation protocol conditions satisfied. |
| Composable Plugin Architecture | 7 | 0.9 | 2026-03-04 | Alien-domain triangulation across game engines (Bevy, A-Frame, GDevelop), music production (Zrythm — STRONGEST instance), and bioinformatics (Nextflow, GATK). 7 domains, all 5 validation protocol conditions satisfied. |
| Explicit State Machine Backbone | 7 | 0.9 | 2026-03-04 | Alien-domain triangulation across game engines (Godot, Bevy, libGDX — canonical domain), spaced repetition (FSRS4Anki — problem-shaped), and music production (Zrythm transport). 7 domains, all 5 validation protocol conditions satisfied. |
| Bounded Buffer With Overflow Policy | 7 | 0.9 | 2026-03-04 | Alien-domain triangulation across music production (Zrythm audio buffers — CANONICAL instance predating software eng), bioinformatics (Nextflow channels, fastp I/O), and game engines (Bevy event TTL). 7 domains, all 5 validation protocol conditions satisfied. |

## Tier 2 Candidates

The following Tier 1 motifs have 3+ domain instances and are eligible for Tier 2 promotion pending validation protocol and human approval:

| Name | Domains | Confidence | Promotion Readiness |
|------|---------|-----------|-------------------|
| Idempotent State Convergence | 5 | 0.7 | **Moderate** — 5 domains, triangulated, but domain-constrained to pipeline/declarative systems |
| Observer-Feedback Loop | 4 | 0.5 | Ready — needs alien domain testing to strengthen candidacy |

*Note: Three motifs (Plugin, StateMachine, Buffer) promoted to Tier 2 on 2026-03-04. Idempotent Convergence remains a moderate candidate with a documented domain constraint. Trust-as-Curation (4 domains, 0.4 confidence) needs more domain instances to qualify.*

## Phase 5: Meta-Analysis Gate

**Status: OPEN**

Meta-analysis (Tier 3 motif detection) requires 3+ Tier 2 motifs. Current Tier 2 count: **4**.

| Tier 2 Motif | Domains | Promoted |
|-------------|---------|----------|
| Dual-Speed Governance | 12 | 2026-03-03 |
| Composable Plugin Architecture | 7 | 2026-03-04 |
| Explicit State Machine Backbone | 7 | 2026-03-04 |
| Bounded Buffer With Overflow Policy | 7 | 2026-03-04 |

**Gate opened 2026-03-04.** With 4 Tier 2 structural operators, motif-of-motif detection (Tier 3) can now proceed. Look for structural relationships, compositional patterns, and meta-structural regularities across the 4 Tier 2 motifs.

## Meta-Motifs (Tier 3)

*No meta-motifs yet. Phase 5 gate is now OPEN with 4 Tier 2 motifs. Meta-structural analysis can proceed.*

## Schema Reference

See [_SCHEMA.md](_SCHEMA.md) for tier system, validation protocol, and confidence scoring rules.
See [_TEMPLATE.md](_TEMPLATE.md) for motif entry template.
