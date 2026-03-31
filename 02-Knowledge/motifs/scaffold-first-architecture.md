---
name: "Scaffold-First Architecture"
tier: 1
status: "provisional"
confidence: 0.9000000000000001
source: "top-down"
domain_count: 7
derivative_order: 0
primary_axis: differentiate
created: 2026-03-03
updated: "2026-03-31"
---

# Scaffold-First Architecture

## Structural Description

A system where the complete structural frame is constructed before the material it will organise enters. The frame's geometry determines the shape of what fills it — late-arriving material conforms to the scaffold, not the reverse. This is not "plan before you act" (which is temporal). It's "the container shapes the content" (which is structural). The scaffold is functional infrastructure, not a plan. It constrains, organises, and gives meaning to whatever enters it.

## Domain-Independent Formulation

Complete structural frames are erected before material enters, and the frame's geometry determines the shape of what fills it.

## Instances

### Instance 1: Software Architecture (OCP Scraper Pipeline)
- **Domain:** Software Architecture
- **Expression:** The OCP Scraper built its entire pipeline architecture — CLI, scraper, Solution Records (JSON-LD), Problem Template Engine, SQLite FTS5 index, graph index, trust vectors, dual-speed feedback cycle, gap analysis, coverage dashboard — before a single repository was scraped. The architecture determined what data meant: a repo isn't just code, it's a Solution Record classified against Problem Templates with computed trust vectors. The scaffold gave structure to everything that entered it.
- **Discovery date:** 2026-03-03
- **Source:** top-down

### Instance 2: Knowledge Architecture (Motif Library)
- **Domain:** Knowledge Architecture
- **Expression:** The motif library built its complete schema — tier system (0-3), validation protocol (5 conditions), confidence scoring, template format (9 required fields), relationship types (complement/tension/composition), falsification conditions, promotion rules, meta-motif directory — before a single motif was extracted. The schema determined what counts as a motif, how motifs relate, and how they earn credibility. The structural frame preceded and shaped all knowledge that entered it.
- **Discovery date:** 2026-03-03
- **Source:** top-down

## Relationships

| Related Motif | Relationship | Description |
|---------------|-------------|-------------|
| Template-Driven Classification | complement | Templates are a specific type of scaffold — they define the structural shape that content must match. Scaffold-First is the construction principle; Template-Driven Classification is the classification application. |
| Progressive Formalization | complement | Scaffold-First builds the frame; Progressive Formalization describes how content within the frame becomes increasingly ordered over time. They compose: frame first, then progressive crystallization within the frame. |

## Discovery Context

Identified during the 3 March 2026 reflection session examining the day's four major builds (OCP Scraper, MCP Server, Reflect Skill, Motif Library). All four followed the same construction pattern: build the complete structural skeleton first, then populate. The pattern was most explicit in the scraper (full pipeline before any data) and the motif library (full schema before any motifs).

## Falsification Conditions

- If the scaffold doesn't actually constrain or shape what enters it (i.e., content would look the same without the scaffold), then this is just "build before use" — temporal ordering, not structural shaping
- If the pattern only applies to software and not to other domains (construction, law, knowledge), then it's a domain-specific engineering practice, not a structural motif
- If content regularly violates the scaffold's geometry with no consequences, the scaffold is decorative rather than structural
