---
name: "Template-Driven Classification"
tier: 1
status: "provisional"
confidence: 1
source: "top-down"
domain_count: 13
derivative_order: 0
primary_axis: differentiate
created: 2026-03-03
updated: "2026-03-31"
---

# Template-Driven Classification

## Structural Description

A classification system where items are matched against structural templates rather than keyword categories or taxonomies. Templates encode the shape of a problem or solution class — its structural relationships, constraints, and typical decompositions. Classification becomes pattern matching against known structures rather than label assignment.

## Domain-Independent Formulation

Items are classified by matching against structural templates encoding problem/solution shapes, not by keyword or taxonomic label assignment.

## Instances

### Instance 1: Software Architecture (OCP Scraper Problem Templates)
- **Domain:** Software Architecture
- **Expression:** Problem Template Engine where repositories are classified by matching against structural problem templates rather than topic keywords. Templates encode: problem shape, typical decomposition, expected dependencies, canonical solutions. The classification is structural, not semantic.
- **Discovery date:** 2026-03-03
- **Source:** top-down

### Instance 2: Creative Methodology (Motif Library Tier System)
- **Domain:** Creative Methodology
- **Expression:** The motif library itself uses structural pattern matching — motifs are classified by their structural shape (feedback loops, governance patterns, trust mechanisms) rather than by domain labels. A motif matches not by keyword but by structural similarity.
- **Discovery date:** 2026-03-03
- **Source:** top-down

## Relationships

| Related Motif | Relationship | Description |
|---------------|-------------|-------------|
| Observer-Feedback Loop | composition | Template classification creates a frame; usage patterns feed back to reshape templates |
| Scaffold-First Architecture | complement | Templates are a specific type of scaffold — structural shapes that content must match. Scaffold-First is the construction principle; templates are the classification application. |

## Discovery Context

First explicitly articulated in the OCP scraper architecture design (Problem Template Engine). Recognised retrospectively in the motif library itself — the tier system and structural matching are instances of template-driven classification applied to meta-knowledge.

## Falsification Conditions

- If template matching produces the same results as simple keyword classification, the structural dimension adds no value
- If templates cannot be updated through use (they're static), this is just "taxonomy" not template-driven classification
- If the pattern only works for software repositories (not generalizable), it's a domain-specific technique, not a motif
