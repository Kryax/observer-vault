---
status: candidate
date: 2026-03-23
target_motif: Punctuated Crystallisation
batch: 6
run: 4
---

# Batch 6 Run 4 — Punctuated Crystallisation Expansion

## Target

Expand the T0 motif "Punctuated Crystallisation" (currently 1 instance, domain_count: 1) with 2-3 alien domain instances to raise it toward T1 candidacy. The motif describes systems that alternate between invisible accumulation and rapid coherent output, producing higher-quality artifacts than continuous-pace systems.

## Method

- Domain knowledge search across geology, evolutionary biology, and physics for structurally isomorphic patterns
- OCP search for existing records (none found for these domains)
- SEP scrape for "scientific revolutions" (1 record indexed: ocp:sep/scientific-revolutions, trust 0.614)
- Structural alignment test: does the candidate instance preserve both the accumulation-is-not-idle condition AND the burst-produces-disproportionate-coherence condition?

## Discovered Instances

### Instance 2: Supercooled Crystallisation (Physics / Materials Science)

- **Domain:** Condensed matter physics
- **Expression:** A liquid cooled below its freezing point can remain liquid for extended periods (supercooling). During this accumulation phase the system is not idle — molecular clusters form and dissolve, sampling configurations without committing to a lattice. When a critical nucleus finally forms, crystallisation propagates through the entire volume in a rapid burst, producing a highly ordered crystal structure. The quality of the resulting crystal (grain size, defect density) depends on the depth and duration of the supercooling phase. Forced nucleation at shallow supercooling produces polycrystalline, defect-rich solids — the continuous-pace analogue.
- **Structural alignment:** Silent accumulation (subcritical nucleation attempts) is genuinely preparatory, not idle. The burst (crystal growth from critical nucleus) produces disproportionate order relative to its duration. Forcing continuous output (shallow supercooling, seeding too early) degrades quality. All three structural conditions of the motif are satisfied.
- **Source domain distance:** High — physical chemistry, no software or cognitive component
- **Discovery date:** 2026-03-23

### Instance 3: Punctuated Equilibrium (Evolutionary Biology)

- **Domain:** Macroevolutionary theory (Eldredge & Gould, 1972)
- **Expression:** The fossil record shows species persisting in morphological stasis for millions of years (accumulation phase), then undergoing rapid speciation events in geologically brief intervals (~50,000 years). During stasis, populations are not genetically frozen — they accumulate cryptic genetic variation buffered by developmental canalisation. When environmental or geographic isolation breaks the buffer, the accumulated variation is released in a rapid morphological burst, producing new species that are disproportionately divergent relative to the time of visible change. Gradualist models (phyletic gradualism) predict continuous morphological drift but the fossil record consistently shows the punctuated pattern.
- **Structural alignment:** Stasis is accumulation (cryptic genetic variation builds), not absence. Speciation bursts produce disproportionate morphological novelty. Continuous-pace models (gradualism) fail to match observed coherence of new forms. All three conditions met.
- **Source domain distance:** High — evolutionary biology, deep time, no engineering or cognitive component
- **Discovery date:** 2026-03-23

### Instance 4: Kuhnian Scientific Revolutions (History/Philosophy of Science)

- **Domain:** Philosophy of science (Kuhn, 1962)
- **Expression:** Normal science operates within a paradigm for decades, accumulating anomalies that the paradigm cannot resolve. These anomalies are not crises — they are catalogued, set aside, worked around. The community is not idle; it is deepening the paradigm's internal structure while simultaneously stockpiling unresolved tensions. When anomalies reach critical mass, a revolutionary phase produces a new paradigm in a compressed burst (e.g., quantum mechanics 1900-1927, plate tectonics 1960-1968). The new paradigm resolves accumulated anomalies with disproportionate coherence relative to the time spent in revolution. Attempts at continuous paradigm revision (Popper's falsificationism as practice) do not match historical patterns.
- **Structural alignment:** Normal science is the accumulation phase — productive, not idle, but producing within-paradigm work while anomalies build. The revolutionary burst produces a new framework of disproportionate explanatory power. Continuous-revision models fail empirically. All three conditions met.
- **Source domain distance:** Medium-high — philosophy/sociology of science, partially overlaps with cognitive domain but operates at community scale
- **Discovery date:** 2026-03-23
- **OCP record:** ocp:sep/scientific-revolutions (trust 0.614)

## Assessment

| Criterion | Instance 2 (Supercooling) | Instance 3 (Punctuated Eq.) | Instance 4 (Kuhn) |
|-----------|--------------------------|----------------------------|-------------------|
| Accumulation is non-idle | Yes — subcritical nucleation | Yes — cryptic genetic variation | Yes — normal science + anomaly stockpile |
| Burst produces disproportionate coherence | Yes — ordered crystal lattice | Yes — rapid speciation | Yes — paradigm with high explanatory power |
| Continuous pace degrades quality | Yes — polycrystalline defects | Yes — gradualism fails empirically | Yes — continuous revision not observed |
| Domain distance from Instance 1 | High | High | Medium-high |
| Structural (not metaphorical) | Yes | Yes | Yes |

**Recommendation:** All three instances are structurally sound and pass the motif's falsification conditions. Adding all three would raise domain_count from 1 to 4, qualifying the motif for T1 promotion (requires domain_count >= 3). Supercooling and punctuated equilibrium are the strongest pair (highest domain distance, cleanest structural mapping). The Kuhn instance is valid but has partial domain overlap with the existing software development instance (both involve cognitive/knowledge systems).

**Proposed action:** Add all three instances to the motif file. Update tier from T0 to T1-candidate. Update domain_count to 4, confidence to 0.55.

## OCP Records Created

- `ocp:sep/scientific-revolutions` — scraped and indexed during this run (trust 0.614)
