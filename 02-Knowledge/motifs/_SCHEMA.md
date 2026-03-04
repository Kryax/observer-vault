---
status: canonical
date: 2026-03-03
cssclasses:
  - status-canonical
---

# Motif Library Schema

> Structural conventions for the motif library at `02-Knowledge/motifs/`.

## Tier System

| Tier | Name | Criteria | Approval | Participates In |
|------|------|----------|----------|----------------|
| 0 | Observation | Noticed once, no cross-domain confirmation | Auto (draft status) | Library only |
| 1 | Cross-Domain Pattern | 2+ unrelated domain instances | Auto (Tier 0→1) | Library, queries |
| 2 | Structural Operator | 3+ domains, passes validation protocol, actively changes design decisions | Human approval required | Library, queries, meta-analysis |
| 3 | Meta-Structural Motif | Describes relationships between Tier 2 motifs | Human approval required | Library, queries, meta-analysis |

## Promotion Rules

### Tier 0 → Tier 1 (Automatic)
When a motif's instance list spans 2+ unrelated domains, it auto-promotes. Update:
- `tier: 1` in frontmatter
- `status: provisional`
- `confidence: +(0.1 × new_domains_added)`

### Tier 1 → Tier 2 (Human Approval Required)
ALL conditions must be met:
1. 3+ unrelated domain instances
2. Passes the Validation Protocol (all 5 conditions)
3. Adam explicitly approves via AskUserQuestion

### Tier 2 → Tier 3 (Human Approval Required)
Only through motif-of-motif detection. The motif must describe a relationship between other Tier 2+ motifs. Adam must approve.

## Validation Protocol (Tier 2+ Only)

A motif must satisfy ALL five conditions:

1. **Domain-independent description** — Can be described without ANY domain-specific vocabulary
2. **Cross-domain recurrence** — Appears in 3+ unrelated domains with documented instances
3. **Predictive power** — Knowing this motif changes design decisions in new domains
4. **Adversarial survival** — Survives the question "is this a genuine structural pattern or a superficial similarity?"
5. **Clean failure** — Has specific, testable falsification conditions. If those conditions are met, the motif is demoted.

## Confidence Score

| Event | Score Change |
|-------|-------------|
| New motif created (Tier 0) | Start at 0.1 |
| New domain instance added | +0.1 |
| Triangulation confirmed (top-down + bottom-up) | +0.2 |
| Instance found superficial (retracted) | -0.1 |
| Maximum | 1.0 |

## Triangulation Principle

A motif gains structural credibility when found independently from both sources:
- **Top-down:** Extracted through creative session reflection (Reflect skill)
- **Bottom-up:** Extracted from cross-repository corpus analysis (OCP scraper, future)

Motifs found from only one source are provisional. Motifs confirmed by both sources are strong candidates.

## File Naming Convention

- Kebab-case: `observer-feedback-loop.md`
- Derived from pattern name: spaces to hyphens, lowercase, strip special chars
- Second-order motifs in `meta/` subdirectory

## Motif Entry Fields (11 Required)

| # | Field | Location | Description |
|---|-------|----------|-------------|
| 1 | Pattern name | Frontmatter `name` + H1 header | Concise label for the structural pattern |
| 2 | Structural description | `## Structural Description` section | Domain-independent description of the pattern's shape |
| 3 | Domain-independent formulation | `## Domain-Independent Formulation` section | One-sentence compressed abstract statement |
| 4 | Instances | `## Instances` section | Each with domain, expression, discovery date, source |
| 5 | Relationships | `## Relationships` section | Links to other motifs (complement/tension/composition) |
| 6 | Tier level | Frontmatter `tier` | 0-3 per tier system above |
| 7 | Confidence score | Frontmatter `confidence` | 0.0-1.0 per confidence rules above |
| 8 | Falsification conditions | `## Falsification Conditions` section | What would disprove this pattern |
| 9 | Discovery context | `## Discovery Context` section | When/how first identified |
| 10 | Derivative order | Frontmatter `derivative_order` | 0-3 per derivative order system above |
| 11 | Primary axis | Frontmatter `primary_axis` | differentiate / integrate / recurse |

## Derivative Order (Required)

Every motif carries a `derivative_order` in frontmatter. This measures structural depth — how many levels of abstraction the motif operates at — complementing the tier system's measure of domain breadth.

| Order | Derivative | Describes | Example |
|-------|-----------|-----------|---------|
| 0 | Position | What patterns exist — static structural descriptions | Template-Driven Classification describes a structural arrangement (items matched against templates) |
| 1 | Velocity | How patterns change across domains — dynamics and trajectories | Progressive Formalization describes the trajectory from amorphous to crystalline |
| 2 | Acceleration | What generates the change of patterns — generative mechanisms | Dual-Speed Governance describes the mechanism that generates two-speed dynamics |
| 3 | Jerk | What generates the generators — meta-structural operators | A Tier 3 motif would describe what produces the generative mechanisms themselves |

Fractional orders (e.g., `1.5`) are permitted when a motif straddles two levels. Range notation (e.g., `"1-2"`) is permitted when a motif's depth is genuinely ambiguous between orders.

**Relationship to tiers:** Derivative order and tier usually correlate but measure different things. Tier measures domain breadth and validation strength. Derivative order measures structural depth. A motif can be tier-inflated (high tier from domain count, low derivative order) or tier-suppressed (low tier from insufficient domains, high derivative order).

## Primary Axis (Required)

Every motif carries a `primary_axis` in frontmatter. This captures the motif's dominant structural orientation across three fundamental axes:

| Axis | Code | Description | Example |
|------|------|-------------|---------|
| Differentiate | `differentiate` | Motif primarily creates distinctions — boundaries, enumerations, categories, separations | Explicit State Machine Backbone creates distinct named states with guarded transitions |
| Integrate | `integrate` | Motif primarily maintains connections across distinctions — coupling, convergence, progression | Dual-Speed Governance couples fast and slow cycles into a coherent governance system |
| Recurse | `recurse` | Motif primarily applies process to its own output — self-modification, self-reference, meta-levels | Observer-Feedback Loop modifies its own observation frame through observation |

Most motifs have secondary axis engagement. `primary_axis` captures the dominant orientation only. The three-axis model predicts that motifs engaging multiple axes tend toward higher tiers and greater generative power.

## Cross-Temporal Validation (Optional Enrichment)

An optional enrichment field that strengthens or weakens a motif's claim to structural fundamentality by examining its history across eras. Added to the `## Cross-Temporal Validation` section of a motif entry when evidence is available.

**Fields:**
- **Earliest known antecedent:** Domain, era, and description of the oldest known instance of the structural pattern
- **Independent rediscoveries:** List of documented cases where the pattern was independently articulated in different eras or cultures
- **Assessment:** Whether the cross-temporal recurrence represents cultural transmission (the same idea passed down) or independent discovery (the same structural constraint rediscovered). Independent discovery is stronger evidence of substrate-level invariance.

This implements a validation enrichment step — it provides additional evidence for or against a motif's fundamentality but does not itself constitute a motif.

## Tier 3 Criteria

Tier 3 (Meta-Structural Motif) requires meeting ALL of the following criteria beyond the standard Tier 2→3 promotion rules:

1. **Geometric description** — Must describe the geometry of the space in which Tier 2 operators operate. Not merely "Tier 2 motifs are related" but "here is the shape of the space that generates and constrains Tier 2 motifs."
2. **Tier-independent falsification** — Cannot be falsified by any single domain or motif failing. If one Tier 2 motif is demoted, the Tier 3 motif must still hold (or its falsification conditions must be structural, not incidental).
3. **Self-referential prediction** — Must make predictions about the tier system itself: what kinds of motifs should exist, where gaps should appear, what the distribution of motifs across axes/orders should look like.
4. **Load-bearing, not decorative** — Must generate correct predictions that a simpler theory would not. A Tier 3 motif that merely describes a property all motifs share (e.g., "every tier points beyond itself") without generating specific, testable predictions is decorative and does not qualify.

## Source Types

- `top-down` — Extracted from creative/build session reflection
- `bottom-up` — Extracted from corpus analysis (OCP scraper)
- `triangulated` — Confirmed by both sources independently
