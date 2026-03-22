---
title: "D/d1 Boundary Drift — GitHub Bottom-Up Triangulation"
date: 2026-03-22
status: draft
source: ocp-scraper (GitHub) + domain analysis
target_candidate: Boundary Drift (D/d1)
target_gap: "SEP-heavy, needs GitHub/engineering bottom-up"
---

# D/d1 Boundary Drift — GitHub Bottom-Up Triangulation

## Objective

Close the triangulation gap on the Boundary Drift candidate (D/d1). Batch 1 identified 5 domains but sourcing was almost entirely SEP (top-down philosophical). The Software Engineering instance (schema evolution) had weak OCP backing. This run targets concrete engineering implementations where classification boundaries shift incrementally.

## Scrape Summary

### GitHub Scrapes (11 queries, ~100 records processed)

| Query | minStars | Indexed | Notable Specific Records |
|-------|----------|---------|--------------------------|
| schema migration evolution versioning | 100 | 10 | Mostly awesome-lists |
| feature flag gradual rollout canary release | 200 | 9 | **Unleash**, **Flagger** |
| A/B testing experiment assignment percentage | 100 | 10 | Mostly awesome-lists |
| taxonomy ontology versioning evolution | 50 | 10 | Mostly awesome-lists |
| content moderation policy threshold adjustment | 50 | 10 | Mostly awesome-lists |
| database schema migration versioned evolution tool | 100 | 10 | **Bytebase** |
| canary deployment progressive delivery traffic shifting | 100 | 10 | **Argo Rollouts**, Flagger (dup) |
| API versioning backwards compatibility deprecation strategy | 100 | 10 | RxJava (version deprecation) |
| flyway liquibase database migration versioning | 500 | 10 | **Bytebase**, **pgschema**, dbdiff |
| JSON schema evolution compatibility registry | 100 | 10 | Mostly awesome-lists |
| protobuf backward forward compatibility schema evolution | 100 | 7 | **Apache Fory**, protostuff, zebrapack |

### SEP Scrape (1 query, 10 records)

| Query | Indexed | Notable Records |
|-------|---------|-----------------|
| speciation ring species gradual | 10 | **SEP/species**, SEP/macroevolution, SEP/natural-kinds, SEP/darwinism |

## Candidate Instances Found

### Instance 1: Progressive Delivery / Canary Rollouts (STRONG)

**Domain**: Software Engineering — Deployment
**Source type**: GitHub (bottom-up)
**OCP records**: `ocp:github/fluxcd--flagger` (trust 0.752), `ocp:github/argoproj--argo-rollouts` (trust 0.727)
**Match strength**: HIGH
**Triangulation value**: HIGH — first concrete engineering bottom-up instance

**How it maps to Boundary Drift**: Progressive delivery is *definitional* boundary drift. The boundary between "users on old version" and "users on new version" is incrementally shifted:
- Flagger: automated canary analysis — starts at 0% traffic to new version, increments by configurable step (e.g., 5%), measures error rates, continues or rolls back. The classification boundary "which version does this request get?" drifts from 0% to 100%.
- Argo Rollouts: same pattern — Canary, Blue-Green, and A/B testing with configurable traffic-weight steps. The `setWeight` step literally moves the boundary.

The framework itself is not replaced. The classification (old vs new) persists. Only the boundary between them moves. This is textbook boundary drift.

**Key distinction from simple "deployment"**: What makes this boundary drift (not just "updating software") is that the two categories coexist with a *moving threshold* between them. The system of distinctions remains intact while the boundary shifts directionally.

### Instance 2: Feature Flag Activation Strategies (STRONG)

**Domain**: Software Engineering — Feature Management
**Source type**: GitHub (bottom-up)
**OCP records**: `ocp:github/unleash--unleash` (trust 0.788)
**Match strength**: HIGH
**Triangulation value**: HIGH — distinct sub-domain from Instance 1

**How it maps to Boundary Drift**: Unleash implements "activation strategies" that determine who sees a feature:
- **Gradual rollout**: percentage-based — the boundary between "feature on" and "feature off" drifts from 0% to 100% as the operator increases the percentage.
- **User ID strategies**: specific users migrate from one side of the boundary to the other.
- **Variants**: users are classified into variant buckets; the boundaries between buckets can be adjusted over time.

The classification framework ("feature on" vs "feature off") remains stable. The boundary (who falls on which side) is incrementally displaced. Categories persist; membership migrates.

### Instance 3: Database Schema Migration / Evolution (MODERATE)

**Domain**: Software Engineering — Data Management
**Source type**: GitHub (bottom-up)
**OCP records**: `ocp:github/bytebase--bytebase` (trust 0.800), `ocp:github/pgplex--pgschema` (trust 0.578)
**Match strength**: MODERATE
**Triangulation value**: MODERATE — strengthens the weak batch-1 schema-evolution instance

**How it maps to Boundary Drift**: Schema migration tools manage the incremental displacement of data classification boundaries:
- Bytebase: database DevSecOps platform that manages schema changes through versioned migrations. Each migration shifts the boundary of "what this column/table/type means" — adding a nullable column doesn't break old code, but new code can classify data differently. Over a series of migrations, what was once a single field may split into a normalized structure, migrating rows from one classification to another.
- pgschema: declarative schema diff — computes the difference between desired and current schema, producing migration steps. The "current" boundary drifts toward the "desired" state through incremental DDL operations.

**Caveat**: Schema migration is a weaker fit than progressive delivery. The "boundary" here is the data model itself, which is arguably *replaced* rather than *drifted*. The boundary drift reading is strongest when migrations are incremental and backward-compatible (expand-contract pattern), where old and new classifications coexist during the transition window.

### Instance 4: Serialization Schema Evolution (MODERATE)

**Domain**: Software Engineering — Data Serialization
**Source type**: GitHub (bottom-up)
**OCP records**: `ocp:github/apache--fory` (trust 0.747), plus protostuff and zebrapack from the protobuf scrape
**Match strength**: MODERATE
**Triangulation value**: MODERATE — niche sub-domain

**How it maps to Boundary Drift**: Serialization frameworks with schema evolution support (protobuf, Avro, Fory) maintain backward/forward compatibility by allowing old and new schemas to coexist. The boundary between "fields present in the schema" and "fields absent" shifts incrementally as schemas evolve:
- New optional fields are added (boundary expands)
- Old fields are deprecated then removed (boundary contracts)
- The classification of "what data this message contains" drifts without the serialization framework being replaced

This is boundary drift at the wire-protocol level: producers and consumers may be on different schema versions simultaneously, with the boundary of "understood fields" varying by participant and shifting over time.

### Instance 5: Species Boundaries in Biology (SEP STRENGTHENING)

**Domain**: Evolutionary Biology / Philosophy of Biology
**Source type**: SEP (top-down, but deeper than batch 1)
**OCP records**: `ocp:sep/species` (trust 0.530), `ocp:sep/macroevolution` (trust 0.677), `ocp:sep/natural-kinds` (trust 0.601)
**Match strength**: HIGH
**Triangulation value**: LOW (same source type as batch 1) but DEEPENS existing instance

**How it maps to Boundary Drift**: The SEP Species entry (Ereshefsky 2002/2022) is remarkably explicit about boundary drift:
- 20+ competing species definitions exist because species boundaries *are* inherently drifting — "Biologists offer over twenty definitions of the term 'species'"
- The species problem is precisely about whether classification boundaries are stable or fluid
- Ring species are the textbook case: populations A-B-C-D-E form a geographic ring where each adjacent pair can interbreed, but A and E cannot. The species boundary drifts along the ring.
- Microbial species (horizontal gene transfer) make boundaries especially fluid — "The Myth of Bacterial Species" (Lawrence & Retchless 2010)
- Species pluralism (Mishler, Dupre, Kitcher) argues there is no single correct boundary — the boundary depends on which definition you use, and these shift over time

The Natural Kinds entry connects this to broader metaphysics: whether category boundaries are discovered or imposed, and how they change.

## Triangulation Assessment

### Before This Run (Batch 1)
- 5 domains, all sourced from SEP or philosophical literature
- Software Engineering instance was thin ("no single OCP record directly captures schema-evolution-as-boundary-drift")
- Source diversity: LOW (SEP-dominant)

### After This Run (Batch 2, Run 2)
- 4 new engineering instances added from GitHub
- 2 STRONG (progressive delivery, feature flags) with direct OCP backing
- 2 MODERATE (schema migration, serialization evolution) with direct OCP backing
- Biology instance deepened with specific SEP records

### Updated Domain Count: 7-8 (depending on how you count sub-domains)

| Domain | Source Type | Strength | OCP Record |
|--------|-----------|----------|------------|
| Philosophy of Science | SEP | HIGH | (batch 1) |
| Philosophy of Language | SEP | HIGH | (batch 1) |
| Evolutionary Biology | SEP | HIGH | ocp:sep/species, ocp:sep/macroevolution |
| Cultural Anthropology | SEP | MODERATE | (batch 1) |
| SE: Deployment (Progressive Delivery) | GitHub | HIGH | ocp:github/fluxcd--flagger, ocp:github/argoproj--argo-rollouts |
| SE: Feature Management | GitHub | HIGH | ocp:github/unleash--unleash |
| SE: Data Management (Schema Migration) | GitHub | MODERATE | ocp:github/bytebase--bytebase, ocp:github/pgplex--pgschema |
| SE: Serialization (Schema Evolution) | GitHub | MODERATE | ocp:github/apache--fory |

### Source Diversity: IMPROVED
- Before: ~90% SEP
- After: ~50% SEP, ~50% GitHub
- The two STRONG GitHub instances (progressive delivery, feature flags) are concrete, bottom-up, implementation-backed. They are not theoretical descriptions of boundary drift — they are *systems that implement boundary drift as their core mechanism*.

## Verdict

**The triangulation gap is substantially closed.** The candidate now has:
- Strong philosophical grounding (batch 1 SEP instances)
- Strong engineering grounding (progressive delivery + feature flags)
- Moderate additional engineering support (schema migration, serialization)
- Cross-domain presence in 7-8 domains
- Mixed source types (SEP + GitHub)

**Remaining weakness**: No arXiv/academic CS paper explicitly naming this pattern. The engineering instances are strong but implicit — none of these tools describe themselves as doing "boundary drift." The motif-level abstraction is ours.

**Recommendation**: The Boundary Drift candidate is now viable for Tier 1 promotion. The progressive delivery instance alone (Flagger + Argo Rollouts) would be sufficient to confirm the engineering domain. Combined with Unleash for feature management, the bottom-up backing is solid.
