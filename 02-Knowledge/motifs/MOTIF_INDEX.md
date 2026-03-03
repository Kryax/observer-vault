---
status: canonical
date: 2026-03-03
updated: 2026-03-03
cssclasses:
  - status-canonical
---

# Motif Library Index

> Table of contents for the structural pattern library at `02-Knowledge/motifs/`.
> Updated by the Reflect skill after each reflection session.

## Summary

| Metric | Count |
|--------|-------|
| Total motifs | 10 |
| Tier 0 (Observation) | 0 |
| Tier 1 (Cross-Domain) | 9 |
| Tier 2 (Structural Operator) | 1 |
| Tier 3 (Meta-Structural) | 0 |
| Tier 2 candidates (3+ domains) | 2 |

## Motif Registry

| Name | Tier | Confidence | Domains | Source | File |
|------|------|-----------|---------|--------|------|
| **Dual-Speed Governance** | **2** | **1.0** | **8** | **triangulated** | [dual-speed-governance.md](dual-speed-governance.md) |
| Observer-Feedback Loop | 1 | 0.5 | 4 | top-down | [observer-feedback-loop.md](observer-feedback-loop.md) |
| Trust-as-Curation | 1 | 0.4 | 4 | top-down | [trust-as-curation.md](trust-as-curation.md) |
| Template-Driven Classification | 1 | 0.3 | 2 | top-down | [template-driven-classification.md](template-driven-classification.md) |
| Bounded Buffer With Overflow Policy | 1 | 0.3 | 3 | bottom-up | [bounded-buffer-with-overflow-policy.md](bounded-buffer-with-overflow-policy.md) |
| Explicit State Machine Backbone | 1 | 0.3 | 3 | bottom-up | [explicit-state-machine-backbone.md](explicit-state-machine-backbone.md) |
| Idempotent State Convergence | 1 | 0.3 | 3 | bottom-up | [idempotent-state-convergence.md](idempotent-state-convergence.md) |
| Composable Plugin Architecture | 1 | 0.3 | 3 | bottom-up | [composable-plugin-architecture.md](composable-plugin-architecture.md) |
| Scaffold-First Architecture | 1 | 0.2 | 2 | top-down | [scaffold-first-architecture.md](scaffold-first-architecture.md) |
| Progressive Formalization | 1 | 0.2 | 2 | top-down | [progressive-formalization.md](progressive-formalization.md) |

## Tier 2 Promoted

| Name | Domains | Confidence | Promotion Date | Justification |
|------|---------|-----------|---------------|---------------|
| Dual-Speed Governance | 8 | 1.0 | 2026-03-03 | Bottom-up triangulation from 112-repo triad run. Pattern independently emerged in 4 additional domains (migration, auth, monitoring, CLI) beyond 4 existing top-down domains. All 5 validation protocol conditions satisfied. |

## Tier 2 Candidates

The following Tier 1 motifs have 3+ domain instances and are eligible for Tier 2 promotion pending validation protocol and human approval:

| Name | Domains | Confidence | Promotion Readiness |
|------|---------|-----------|-------------------|
| Observer-Feedback Loop | 4 | 0.5 | Ready — strongest remaining candidate, highest confidence |
| Trust-as-Curation | 4 | 0.4 | Ready — clean instances across 4 domains |

*Note: The 4 new bottom-up motifs (Bounded Buffer, Explicit State Machine, Idempotent State Convergence, Composable Plugin) each have 3 domains and are technically eligible, but need triangulation (top-down confirmation) before Tier 2 candidacy is strong.*

## Phase 5: Meta-Analysis Gate

**Status: NOT OPEN**

Meta-analysis (Tier 3 motif detection) requires 3+ Tier 2 motifs. Current Tier 2 count: **1** (Dual-Speed Governance).

Remaining path to gate:
- Promote Observer-Feedback Loop to Tier 2 (candidate ready, needs human approval + validation)
- Promote Trust-as-Curation to Tier 2 (candidate ready, needs human approval + validation)
- With 3 Tier 2 motifs, meta-analysis gate opens for Tier 3 motif-of-motif detection

## Meta-Motifs (Tier 3)

*No meta-motifs yet. Phase 5 gate requires 3+ Tier 2 motifs (current: 1). Two strong Tier 2 candidates remain.*

## Schema Reference

See [_SCHEMA.md](_SCHEMA.md) for tier system, validation protocol, and confidence scoring rules.
See [_TEMPLATE.md](_TEMPLATE.md) for motif entry template.
