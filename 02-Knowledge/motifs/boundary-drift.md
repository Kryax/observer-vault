---
name: "Boundary Drift"
tier: 1
status: provisional
confidence: 0.7
source: triangulated
domain_count: 8
derivative_order: 1
primary_axis: differentiate
created: 2026-03-22
updated: 2026-03-22
cssclasses:
  - status-provisional
---

# Boundary Drift

## Structural Description

Distinctions that were originally sharp and load-bearing gradually lose their precision through use, reinterpretation, or environmental change. The boundary remains nominally present but no longer cuts where it was designed to cut. Systems that depend on the boundary's precision degrade silently because the boundary still exists — it just no longer does its job. The drift is typically invisible until a decision depends on the boundary being where it was originally placed.

## Domain-Independent Formulation

A distinction boundary drifts from its original position through accumulated reinterpretation, and downstream systems degrade silently because the boundary's existence masks its dysfunction.

## Instances

### Instance 1: Philosophy of Science
- **Domain:** Philosophy of Science (Kuhn)
- **Expression:** Paradigm boundaries between normal and revolutionary science drift as anomalies accumulate. The boundary between "puzzle" and "anomaly" shifts gradually until crisis.
- **Discovery date:** 2026-03-22
- **Source:** bottom-up (OCP scraper, SEP)

### Instance 2: Philosophy of Language
- **Domain:** Philosophy of Language
- **Expression:** Semantic drift — word meanings shift gradually through use, metaphor extension, and context change. Legal terms drift from statutory intent.
- **Discovery date:** 2026-03-22
- **Source:** bottom-up (OCP scraper, SEP)

### Instance 3: Evolutionary Biology
- **Domain:** Evolutionary Biology
- **Expression:** Species boundaries drift through hybridisation, ring species, and horizontal gene transfer. The phenetic/cladistic boundary itself drifted.
- **Discovery date:** 2026-03-22
- **Source:** bottom-up (OCP scraper, SEP)

### Instance 4: Software Engineering
- **Domain:** Software Engineering
- **Expression:** Feature flags and progressive delivery (Flagger, Argo Rollouts) — deployment boundaries between canary/stable drift as rollout percentages change. API versioning boundaries drift as consumers depend on undocumented behaviour.
- **Discovery date:** 2026-03-22
- **Source:** bottom-up (OCP scraper, GitHub)

### Instance 5: Anthropology
- **Domain:** Cultural Anthropology
- **Expression:** Cultural category boundaries (kinship terms, food taboos, sacred/profane) drift through contact, trade, and generational reinterpretation.
- **Discovery date:** 2026-03-22
- **Source:** bottom-up (OCP scraper, SEP)

## Relationships

| Related Motif | Relationship | Description |
|---------------|-------------|-------------|
| Progressive Formalization | tension | PF sharpens boundaries; BD erodes them. Opposing dynamics. |
| Reconstruction Burden | composition | When BD degrades a boundary, downstream systems bear reconstruction burden from the now-imprecise distinction |

## Discovery Context

Identified as a D/d1 topology void filler during automated motif discovery loop batch 1 (2026-03-22). The dashboard gap engine flagged no motifs at Distinction axis / derivative order 1. Scraping across philosophy, biology, software, and anthropology found consistent instances.

## Falsification Conditions

- A distinction boundary that maintains perfect precision indefinitely without active maintenance
- Evidence that boundary drift is always visible and immediately detectable (breaking the "silent degradation" invariant)
- A system where drifted boundaries improve rather than degrade downstream function
