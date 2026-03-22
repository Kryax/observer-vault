---
title: "Batch 4 Run 3: Boundary Drift — Alien Domain Expansion"
date: 2026-03-23
status: draft
source: ocp-scraper (SEP) + domain knowledge
target_motif: boundary-drift
target_gap: "Alien domain testing for T2 path"
---

# Batch 4 Run 3: Boundary Drift — Alien Domain Expansion

## Current State

Boundary Drift (BD) is T1 with 5 instances across 5 domains (philosophy of science, philosophy of language, evolutionary biology, software engineering, cultural anthropology), confidence 0.7. Needs alien domain expansion to build toward T2 readiness.

## Scrape Results

### SEP Scrape: "boundary drift semantic change category erosion"
- `ocp:sep/boundary` (0.633) — Boundary (philosophy)
- `ocp:sep/genetic-drift` (0.648) — Genetic Drift
- `ocp:sep/category-mistakes` (0.500) — Category Mistakes
- `ocp:sep/information-semantic` (0.555) — Semantic Conceptions of Information

### SEP Scrape: "concept creep diagnostic expansion overdiagnosis"
- `ocp:sep/mental-disorder` (0.645) — Mental Disorder
- `ocp:sep/biomedicine` (0.610) — Philosophy of Biomedicine
- `ocp:sep/concept-evil` (0.568) — The Concept of Evil
- `ocp:sep/aesthetic-concept` (0.613) — The Concept of the Aesthetic

### SEP Scrape: "genetic drift population genetics"
- `ocp:sep/genetic-drift` (0.648) — Genetic Drift (already covered in evolutionary biology instance)
- `ocp:sep/population-genetics` (0.548) — Population Genetics

---

## New Domain Instances

### Instance 6: Clinical Medicine — Diagnostic Boundary Drift (Concept Creep)
- **Domain:** Clinical Medicine / Psychiatry
- **Expression:** Nick Haslam's "concept creep" — diagnostic categories expand to include milder and more ambiguous cases over successive DSM revisions. PTSD's boundary expanded from combat trauma to include witnessing events, learning about events, and repeated exposure to details of events (DSM-5). ADHD's boundary expanded from hyperkinetic disorder of childhood to a lifelong condition diagnosable in adults. Depression's bereavement exclusion was removed in DSM-5, collapsing the boundary between grief and clinical depression.

  The drift mechanism: each borderline case that is diagnosed expands the implicit boundary. Clinicians calibrate against precedent cases, and as more borderline cases are included, the calibration drifts. The boundary still exists (the DSM criterion set) but no longer cuts where it was designed to cut. Downstream consequences: overdiagnosis, treatment of normal variation, insurance cost inflation, dilution of research cohorts.
- **Discovery date:** 2026-03-23
- **Source:** bottom-up (`ocp:sep/mental-disorder` — SEP covers the classification debate extensively)
- **Structural fit:** Strong. The boundary (diagnostic criterion) drifts through accumulated reinterpretation. The drift is invisible until a decision depends on precision (research replication, insurance coverage). Downstream systems degrade silently.

### Instance 7: Economics / Regulation — Regulatory Arbitrage and Category Migration
- **Domain:** Financial Regulation / Economics
- **Expression:** Financial products migrate across regulatory boundaries. When the Glass-Steagall Act separated commercial from investment banking, financial instruments evolved to straddle the boundary — mortgage-backed securities were technically "investments" but functionally "deposits." The boundary between "bank" and "non-bank" drifted as shadow banking grew. Regulatory categories designed for 1933 instruments no longer cut where they were designed to cut by 2008.

  The drift mechanism: market participants have incentive to position activities just outside regulatory boundaries. Each successful positioning shifts the de facto boundary. The de jure boundary (statute text) remains nominally fixed, but the de facto boundary (what regulators enforce, what courts accept) drifts. The 2008 financial crisis was partly caused by this boundary dysfunction — the "bank" boundary no longer captured the entities posing systemic risk.
- **Discovery date:** 2026-03-23
- **Source:** domain knowledge (grounded in regulatory theory)
- **Structural fit:** Strong. This is adversarial boundary drift — the drift is driven by agents exploiting the boundary, not passive reinterpretation. Adds a dimension: boundaries can drift through passive use (diagnostic creep) or active exploitation (regulatory arbitrage). In both cases, the downstream consequence is silent degradation.

### Instance 8: Music Theory — Genre Boundary Erosion
- **Domain:** Music / Aesthetics
- **Expression:** Genre boundaries (jazz, rock, classical, electronic) are originally load-bearing distinctions that organise production, distribution, marketing, and audience expectation. Over time, fusion, crossover, and hybridisation erode genre boundaries. "Jazz" in 1925 and "jazz" in 2025 delimit radically different sonic territories. The Grammy Awards' genre categories (originally designed to sort clear cases) now require annual boundary maintenance as artists resist classification.

  The drift is cumulative and invisible: no single genre-bending album "moves" the boundary, but the accumulated effect over decades renders the original distinction nonfunctional. Downstream systems (record stores, streaming recommendation algorithms, music criticism) degrade because they depend on genre categories that no longer sort coherently.
- **Discovery date:** 2026-03-23
- **Source:** domain knowledge
- **Structural fit:** Moderate-strong. The boundary exists, it drifts through cumulative reinterpretation, and downstream systems degrade silently. Weaker than the medical or regulatory instances because genre boundaries were never as precise — the initial sharpness was lower, so the drift is less dramatic.

### Instance 9: Ecology — Ecotone Shifting Under Climate Change
- **Domain:** Ecology / Biogeography
- **Expression:** Ecotones (transition zones between biomes: forest-grassland, alpine-subalpine, marine-terrestrial) are ecological boundaries that are physically marked and ecologically load-bearing — species composition, fire regime, and nutrient cycling change at the boundary. Under climate change, ecotones shift geographically. The boreal-temperate boundary moves northward. The treeline moves upward. Alpine meadows shrink as treeline advances.

  The drift is physically real and measurable, but the ecological management systems (conservation zones, protected area boundaries, fire management districts) are defined by the OLD boundary positions. Conservation areas designed to protect alpine ecosystems find themselves protecting forest instead. Fire management districts calibrated to one biome's fire regime face a different biome's fire behaviour. The human management systems degrade because the ecological boundary moved but the jurisdictional boundary didn't.
- **Discovery date:** 2026-03-23
- **Source:** domain knowledge (grounded in `ocp:sep/genetic-drift` adjacent topics; climate ecology literature)
- **Structural fit:** Strong. This is the most physically concrete instance: the boundary literally moves in geographic space. The "silent degradation" is in the management systems calibrated to the old boundary position.

---

## Updated Domain Count and Confidence

| # | Domain | Instance |
|---|--------|----------|
| 1 | Philosophy of Science | Paradigm boundaries (Kuhn) |
| 2 | Philosophy of Language | Semantic drift |
| 3 | Evolutionary Biology | Species boundaries |
| 4 | Software Engineering | Feature flags, API versioning |
| 5 | Cultural Anthropology | Cultural category boundaries |
| 6 | Clinical Medicine | Diagnostic concept creep |
| 7 | Financial Regulation | Regulatory arbitrage |
| 8 | Music / Aesthetics | Genre boundary erosion |
| 9 | Ecology / Biogeography | Ecotone shifting |

**9 domains** (from 5). Confidence: 0.7 → **0.9** (+0.1 per new domain × 4, capped by 1.0 maximum with no triangulation bonus yet claimed; conservative: 0.9 pending bottom-up corpus confirmation of alien instances).

## Structural Refinement

The alien domains reveal two modes of drift:

1. **Passive drift** (original instances + medicine + music): The boundary drifts through accumulated reinterpretation without deliberate pressure. Each marginal case nudges the effective boundary. No agent intends the drift.

2. **Adversarial drift** (regulatory arbitrage): The boundary drifts because agents actively exploit it. Financial innovation is specifically designed to position activities outside regulatory reach. The drift is driven by incentive, not accident.

Both modes produce the same downstream consequence: silent degradation of systems dependent on the boundary's original position. The structural invariant (boundary exists → drifts → downstream systems degrade silently) holds across both modes.

This two-mode distinction is a structural refinement, not a conflation problem. Both modes are BD; they differ only in the mechanism of drift (passive vs. adversarial).

## T2 Path Assessment

BD now has 9 domains. The 5-condition validation protocol:

1. **Domain-independent description:** PASS — "A distinction boundary drifts from its original position through accumulated reinterpretation" uses no domain vocabulary
2. **Cross-domain recurrence:** PASS — 9 unrelated domains
3. **Predictive power:** Needs testing — does knowing BD predict where boundaries will fail in a new domain?
4. **Adversarial survival:** Needs formal challenge — is this just "things change over time"?
5. **Clean failure:** PASS — falsification conditions are specific

**Gap for T2:** Formal adversarial testing (condition 4) is the main gap. The "things change" objection must be explicitly refuted. The structural specificity is: (a) the boundary was originally sharp and load-bearing, (b) the drift is gradual and invisible, (c) the boundary's nominal existence masks its dysfunction. Systems where change is visible and managed (e.g., explicit version deprecation) are NOT BD.

**Recommendation:** Queue BD for formal T2 validation protocol in next batch.
