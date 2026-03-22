---
name: "Ratchet with Asymmetric Friction"
tier: 2
status: validated
confidence: 0.9
source: triangulated
domain_count: 12
derivative_order: 1
primary_axis: recurse
created: 2026-03-19
updated: 2026-03-19
cssclasses:
  - status-draft
---

# Ratchet with Asymmetric Friction

## Structural Description

A system can move in one direction with relatively low effort but requires disproportionately more effort to reverse. Each forward step accumulates dependencies — other components adapt to the new state, making the cost of reversal grow with each step taken. The system therefore drifts in the low-friction direction regardless of whether that direction is optimal. The asymmetry is not inherent in the direction itself but emerges from the dependency structures that build up around each committed position.

## Domain-Independent Formulation

A system where each state change accumulates dependencies that make reversal disproportionately costlier than the original change, producing directional drift.

## Instances

### Instance 1: Political Science — Institutional Path Dependence
- **Domain:** Political Science / Institutional Design
- **Expression:** Once a bureaucratic agency is created and constituencies form around it, dismantling it requires overcoming organized resistance that did not exist before its creation. Constitutional provisions are created by ordinary legislation but require supermajorities to amend. Democratic backsliding proceeds incrementally through executive action, but restoring eroded norms requires sustained coordinated effort. In all cases, forward movement is cheap and reversal is expensive.
- **Discovery date:** 2026-03-19
- **Source:** top-down

### Instance 2: Information Theory / Linguistics — Arbitrary Binding Ossification
- **Domain:** Information Theory / Semiotics
- **Expression:** Saussure's arbitrary sign — the connection between signifier and signified — is initially unmotivated, but once the language community adopts the binding, compounds, idioms, morphological derivations, and collocations build on top of it. The arbitrary choice becomes structurally critical. Similarly, codebook assignments in deployed systems become rigid interfaces once decoders are built to expect them.
- **Discovery date:** 2026-03-19
- **Source:** top-down

## Relationships

| Related Motif | Relationship | Description |
|---------------|-------------|-------------|
| Progressive Formalization | complement | PF describes the trajectory from amorphous to crystalline; Ratchet describes the mechanism that makes this trajectory irreversible — dependencies accumulate at each stage. |
| Dual-Speed Governance | tension | DSG couples fast and slow cycles; the ratchet explains why the slow cycle's decisions are harder to undo than the fast cycle's. |

## Discovery Context

Discovered during a slow triad exploring political science and information theory. Path dependence in institutional design and arbitrary-binding-becomes-load-bearing in semiotics independently surfaced the same structural shape: systems where each step forward raises the cost of stepping back.

## Falsification Conditions

- If reversal costs could be shown to scale linearly (rather than superlinearly) with the number of forward steps, the motif would reduce to simple cost rather than a structural ratchet.
- If systems described by this motif regularly reverse without extraordinary effort — if "reversibility in practice" matches "reversibility in principle" — then the asymmetric friction is illusory.
