---
status: canonical
date: 2026-03-03
updated: 2026-03-19
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
| Tier 1 (Cross-Domain) | 4 |
| Tier 2 (Structural Operator) | 6 |
| Tier 3 (Meta-Structural) | 0 |
| Tier 2 candidates (4+ domains) | 0 |

## Motif Registry

| Name | Tier | Confidence | Domains | Source | Derivative Order | Primary Axis | File |
|------|------|-----------|---------|--------|-----------------|-------------|------|
| **Dual-Speed Governance** | **2** | **1.0** | **12** | **triangulated** | **2** | **integrate** | [dual-speed-governance.md](dual-speed-governance.md) |
| **Composable Plugin Architecture** | **2** | **0.9** | **7** | **triangulated** | **2** | **differentiate** | [composable-plugin-architecture.md](composable-plugin-architecture.md) |
| **Explicit State Machine Backbone** | **2** | **0.9** | **7** | **triangulated** | **2** | **differentiate** | [explicit-state-machine-backbone.md](explicit-state-machine-backbone.md) |
| **Bounded Buffer With Overflow Policy** | **2** | **0.9** | **7** | **triangulated** | **1.5** | **differentiate** | [bounded-buffer-with-overflow-policy.md](bounded-buffer-with-overflow-policy.md) |
| **Idempotent State Convergence** | **2** | **1.0** | **10** | **triangulated** | **1** | **integrate** | [idempotent-state-convergence.md](idempotent-state-convergence.md) |
| **Observer-Feedback Loop** | **2** | **0.9** | **8** | **top-down** | **1-2** | **recurse** | [observer-feedback-loop.md](observer-feedback-loop.md) |
| Trust-as-Curation | 1 | 0.4 | 4 | top-down | 0-1 | integrate | [trust-as-curation.md](trust-as-curation.md) |
| Template-Driven Classification | 1 | 0.3 | 2 | top-down | 0 | differentiate | [template-driven-classification.md](template-driven-classification.md) |
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
| Idempotent State Convergence | 10 | 1.0 | 2026-03-19 | Slow triad alien domain expansion: 5 new alien domains (biology/homeostasis, materials science/crystal annealing, mathematics/proof normalization, economics/arbitrage, governance/regulatory compliance). 10 domains, all 5 validation protocol conditions satisfied. Domain boundary refined from "pipeline/declarative systems" to "active control with declared targets." |
| Observer-Feedback Loop | 8 | 0.9 | 2026-03-19 | Slow triad alien domain expansion: 4 new alien domains (biology/adaptive immunity, jurisprudence/common law, clinical medicine/psychiatric nosology, anthropology/ethnographic framework evolution). 8 domains, all 5 validation protocol conditions satisfied. **Conditional promotion** — all instances top-down derived; bottom-up corpus confirmation pending. |

## Tier 2 Candidates

No current Tier 2 candidates. Trust-as-Curation (4 domains, 0.4 confidence) is the closest Tier 1 motif but needs additional domain instances and alien domain testing to qualify.

## Phase 5: Meta-Analysis Gate

**Status: OPEN**

Meta-analysis (Tier 3 motif detection) requires 3+ Tier 2 motifs. Current Tier 2 count: **6**.

| Tier 2 Motif | Domains | Promoted | Status |
|-------------|---------|----------|--------|
| Dual-Speed Governance | 12 | 2026-03-03 | canonical |
| Composable Plugin Architecture | 7 | 2026-03-04 | canonical |
| Explicit State Machine Backbone | 7 | 2026-03-04 | canonical |
| Bounded Buffer With Overflow Policy | 7 | 2026-03-04 | canonical |
| Idempotent State Convergence | 10 | 2026-03-19 | canonical |
| Observer-Feedback Loop | 8 | 2026-03-19 | provisional (triangulation gap) |

**Gate opened 2026-03-04.** With 6 Tier 2 structural operators, motif-of-motif detection (Tier 3) has a richer operator space. The addition of ISC (integrate axis) and OFL (recurse axis) brings all three primary axes into the Tier 2 set, enabling cross-axis meta-structural analysis.

## Meta-Motifs (Tier 3)

*No meta-motifs yet. Phase 5 gate is now OPEN with 4 Tier 2 motifs. Meta-structural analysis can proceed.*

## Schema Reference

See [_SCHEMA.md](_SCHEMA.md) for tier system, validation protocol, and confidence scoring rules.
See [_TEMPLATE.md](_TEMPLATE.md) for motif entry template.
