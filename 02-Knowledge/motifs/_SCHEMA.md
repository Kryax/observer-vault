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

## Motif Entry Fields (9 Required)

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

## Source Types

- `top-down` — Extracted from creative/build session reflection
- `bottom-up` — Extracted from corpus analysis (OCP scraper)
- `triangulated` — Confirmed by both sources independently
