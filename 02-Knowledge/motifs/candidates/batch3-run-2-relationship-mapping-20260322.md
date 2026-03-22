---
title: "Motif Relationship Mapping — Cross-Network Topology"
date: 2026-03-22
status: draft
source: structural analysis of motif library
target: relationship mapping for motifs with 5+ domains
---

# Motif Relationship Mapping — Cross-Network Topology

## Scope

12 motifs with 5+ domains analyzed for pairwise relationships. 66 possible pairs; 42 have structurally interesting relationships (complement, tension, composition, or subsumption). 24 are independent or trivially unrelated.

## Legend

| Code | Relationship | Definition |
|------|-------------|------------|
| **C** | Complement | They work together; one fills a gap the other leaves open |
| **T** | Tension | They structurally oppose or constrain each other |
| **P** | Composition | One composes into, contains, or specializes the other |
| **S** | Subsumption | One is a special case of the other |
| **-** | Independent | No structural relationship worth noting |

## Motif Index

| # | Abbreviation | Name | Axis/Order | Domains |
|---|-------------|------|------------|---------|
| 1 | DSG | Dual-Speed Governance | I/d2 | 12 |
| 2 | CPA | Composable Plugin Architecture | D/d2 | 7 |
| 3 | ESMB | Explicit State Machine Backbone | D/d2 | 7 |
| 4 | BBOP | Bounded Buffer With Overflow Policy | D/d1.5 | 7 |
| 5 | ISC | Idempotent State Convergence | I/d1 | 10 |
| 6 | OFL | Observer-Feedback Loop | R/d1-2 | 8 |
| 7 | Ratchet | Ratchet with Asymmetric Friction | R/d1 | 10 |
| 8 | PF | Progressive Formalization | I/d1 | 8 |
| 9 | TaC | Trust-as-Curation | I/d0-1 | 8 |
| 10 | BD | Boundary Drift | D/d1 | 7-8 |
| 11 | RST | Reflexive Structural Transition | R/d2 | 7 |
| 12 | RB | Reconstruction Burden | (new) | 10+ |

---

## Relationship Matrix

```
        DSG   CPA   ESMB  BBOP  ISC   OFL   Rat   PF    TaC   BD    RST   RB
DSG     .     C     C     C     C     C     T     C     C     C     P     C
CPA     C     .     C     -     -     -     T     -     -     C     -     C
ESMB    C     C     .     C     T     -     C     -     -     T     T     -
BBOP    C     -     C     .     -     -     -     -     -     -     C     C
ISC     C     -     T     -     .     T     T     T     -     T     T     -
OFL     C     -     -     -     T     .     C     P     P     C     C     -
Rat     T     T     C     -     T     C     .     C     C     C     T     C
PF      C     -     -     -     T     P     C     .     C     -     T     T
TaC     C     -     -     -     -     P     C     C     .     -     -     -
BD      C     C     T     -     T     C     C     -     -     .     C     C
RST     P     -     T     C     T     C     T     T     -     C     .     -
RB      C     C     -     C     -     -     C     T     -     C     -     .
```

---

## Detailed Analysis: Top 15 Relationships

### 1. ISC <-> RST: Tension (structural duals)

**Shared domains**: Software architecture (Kubernetes vs. circuit breakers), biology (homeostasis vs. apoptosis).

**Structural mechanism**: ISC preserves structure by converging to a declared desired state despite perturbation. RST intentionally destroys structure by executing a contained dissolution program. They are dual operations across a phase boundary: ISC operates *within* a stable phase (maintaining form), RST operates *at* phase boundaries (transitioning between forms). A system that only has ISC is rigid and cannot evolve its structure. A system that only has RST is unstable and cannot maintain any form. The tension is productive: ISC holds form until RST fires, then RST clears the way for ISC to converge on a new form.

**Prediction**: Any system exhibiting both motifs should show clear phase boundaries where ISC gives way to RST. Kubernetes does this: reconciliation loops (ISC) maintain desired state, but when a deployment strategy triggers a rolling update, the old pods are terminated and replaced (RST operating within ISC's larger loop).

**Significance**: This is a candidate for a Tier 3 composition. "Phase-stable systems with controlled structural transitions" describes the ISC+RST pair as a higher-order pattern.

### 2. OFL <-> PF: Composition (PF is OFL across formalization stages)

**Shared domains**: Knowledge architecture, creative methodology.

**Structural mechanism**: Progressive Formalization describes material passing through stages of increasing structural order. Each formalization stage is an observation event in the OFL sense: the act of formalizing reveals new structure (observation), which feeds back into understanding of the material (framework change), which enables the next formalization stage. PF *is* OFL operating across formalization stages. The observer's framework (understanding of the material) evolves through each formalization act.

**Why this is composition, not complement**: PF does not merely "work alongside" OFL. PF is structurally constituted by iterated OFL applications. Remove the feedback-into-framework property and PF collapses into "rewriting in different formats" (one of its own falsification conditions). The feedback is what makes the formalization progressive rather than merely sequential.

**Significance**: This composition suggests that PF may not be an independent motif but a specialization of OFL constrained to monotonically increasing formality. If so, PF should be documented as an OFL variant, not a separate Tier 2 candidate.

### 3. Ratchet <-> PF: Complement (irreversibility mechanism for formalization trajectory)

**Shared domains**: Knowledge architecture (motif tier progression is both progressive and ratcheted), institutional design, language evolution.

**Structural mechanism**: PF describes the trajectory from amorphous to crystalline. Ratchet describes why this trajectory is irreversible: each formalization stage accumulates dependencies (tools, conventions, trained practitioners, institutional structures) that make reversal costlier than the original step. The history of formal logic illustrates this: after Frege's Begriffsschrift, the entire mathematical community built proof infrastructure on symbolic notation; reverting to natural-language proofs would require rebuilding centuries of accumulated tooling. PF provides the direction, Ratchet provides the irreversibility.

**Why complement not composition**: PF can occur without Ratchet (reversible formalization, like converting pseudocode to Python and back). Ratchet can occur without PF (path dependence that does not increase structural order). They are structurally independent patterns that, when co-present, produce a powerful compound: irreversible progressive ordering.

### 4. DSG <-> RST: Composition (slow cycle governs dissolution)

**Shared domains**: Software architecture (circuit breaker thresholds set at governance speed), biology (hormonal cascades as slow-cycle governance of metamorphosis).

**Structural mechanism**: RST fires as a slow-cycle operation within DSG. The decision to dissolve the current structure (RST) is a constitutional/governance decision, not an operational one. In Bevy game engines, system topology is defined at startup (slow cycle) and RST-like operations (plugin unloading) happen at init/shutdown, never at frame speed. In apoptosis, the decision to trigger caspase cascade is made by the p53 pathway (a slow, deliberative sensor), not by the cell's fast metabolic operations. DSG provides the governance frame within which RST's dissolution program operates.

**Significance**: This relationship constrains where RST can fire. If RST fired at fast-cycle speed, it would be indistinguishable from ordinary failure. The slow-cycle governance makes it *controlled* dissolution, which is RST's defining structural feature.

### 5. DSG <-> Ratchet: Tension (why slow-cycle decisions are irreversible)

**Shared domains**: Political science (constitutional amendments), protocol design (governance changes), software architecture (schema migrations).

**Structural mechanism**: DSG couples fast and slow cycles. The Ratchet explains *why* the slow cycle's decisions are harder to undo than the fast cycle's: slow-cycle decisions (constitutional rules, schema definitions, governance policies) accumulate dependencies from fast-cycle operations that rely on them. A database migration (slow cycle) creates tables that application code (fast cycle) immediately queries. Reverting the migration requires updating all dependent code. The fast cycle creates consumers of slow-cycle decisions, and these consumers constitute the Ratchet's asymmetric friction.

**Prediction**: In any DSG system, the Ratchet effect should be stronger on slow-cycle decisions than fast-cycle decisions, proportional to the number of fast-cycle operations that have adapted to each slow-cycle decision.

### 6. OFL <-> TaC: Composition (trust scores as observer-feedback mechanism)

**Shared domains**: Knowledge architecture (motif confidence scoring), protocol design (Observer Commons trust vectors).

**Structural mechanism**: Trust scores in TaC are a specific instantiation of the OFL loop. Validation events (observations) change trust scores (the observer's frame), which change what is surfaced for future observation. TaC implements OFL with a specific feedback channel: trust. The structural claim is that TaC *is* OFL restricted to the trust dimension of the observation frame.

**Why this matters**: If TaC is an OFL specialization, then any system exhibiting TaC should also exhibit OFL. This is testable. Platform recommendation algorithms (TaC Instance 8: X's algorithm) should show OFL properties, and they do: user engagement reshapes the recommendation model, which reshapes what users see, which reshapes engagement patterns.

### 7. BD <-> OFL: Complement (boundary observation shifts the boundary)

**Shared domains**: Philosophy of science (theory change boundaries shift through observation), evolutionary biology (species boundaries shift under observation/selection), cultural anthropology.

**Structural mechanism**: OFL describes how observation changes the observer's framework. BD describes how classification boundaries drift. When the observer's framework includes classification boundaries (as it often does), OFL produces BD: observing borderline cases forces re-evaluation of where the boundary falls, which shifts the boundary, which changes what counts as a borderline case, which triggers further observation. The vagueness/sorites literature explicitly models this: each judgment in a forced-march sorites shifts the boundary, and the shifted boundary changes the context for the next judgment.

**Key distinction**: BD can occur without OFL (boundaries can drift through external pressure without the observer's framework changing, as in progressive delivery where traffic percentages shift without the deployment system's model changing). OFL can occur without BD (the observer's framework can change in ways other than boundary shifts). So this is complement, not composition.

### 8. ESMB <-> ISC: Tension (ordered transitions vs. convergent idempotency)

**Shared domains**: Database migration (schema states with ordered transitions vs. idempotent convergence), container orchestration (state machines for pod lifecycle vs. desired-state reconciliation).

**Structural mechanism**: ESMB demands explicit, ordered state transitions: state A must precede state B, transitions are guarded, illegal transitions are rejected. ISC demands that operations be safely repeatable regardless of order: apply the convergence operation multiple times and get the same result. These are structurally opposed: ESMB says *order matters and is enforced*, ISC says *order does not matter because operations are idempotent*.

**Resolution in practice**: Many systems use ESMB for transitions *between* convergence targets and ISC *within* each target state. Kubernetes pods have a lifecycle state machine (Pending -> Running -> Succeeded/Failed, which is ESMB) but the reconciliation loop for each state is ISC (repeatedly apply desired state until actual matches). The two motifs partition the system's behavior: ESMB governs the macro structure, ISC governs the micro convergence.

### 9. RB <-> Ratchet: Complement (lossy boundaries create irreversible dependency chains)

**Shared domains**: Software engineering (microservice decomposition creates both reconstruction burden and ratchet effects), governance/law (statutory encoding is both lossy and ratcheted).

**Structural mechanism**: RB describes how a lossy boundary operation forces downstream overprovisioning. Ratchet describes how each state change accumulates dependencies that resist reversal. They compose: when a lossy boundary creates reconstruction infrastructure downstream (courts interpreting statutes, observability platforms reconstructing traces, codec decoders), that reconstruction infrastructure becomes a dependency that resists reversal of the boundary operation. The more reconstruction infrastructure accumulates, the harder it is to undo the boundary operation (merge the microservices back, revert to oral tradition instead of statute). RB creates the initial loss; Ratchet ensures the compensation becomes load-bearing.

**Prediction**: Any system exhibiting RB should develop Ratchet properties over time, as reconstruction infrastructure accumulates. This is testable: young microservice architectures should be easier to merge back than mature ones with extensive observability tooling, and this appears to be empirically true.

### 10. CPA <-> DSG: Complement (plugin interfaces at governance speed)

**Shared domains**: Game engines (Bevy: plugins defined at init time, executed at frame rate), music production (Zrythm: plugin chains configured deliberately, audio processed in real-time), CLI frameworks.

**Structural mechanism**: Plugin interfaces (CPA) are defined at governance speed (slow cycle of DSG). Plugin composition and execution happen at operational speed (fast cycle). The interface contract is a slow-cycle artifact: changing the VST plugin standard requires industry-wide deliberation (slow); loading a VST plugin into a DAW signal chain is fast. This means CPA is structurally nested within DSG: the plugin architecture's extension points are governed by the slow cycle, while the plugins themselves operate within the fast cycle.

### 11. BD <-> Ratchet: Complement (drift with accumulating irreversibility)

**Shared domains**: Evolutionary biology (species boundary drift is ratcheted by accumulated genetic divergence), software engineering (schema migration drift is ratcheted by dependent code), political science (policy boundary drift is ratcheted by institutional adaptation).

**Structural mechanism**: BD describes boundaries shifting incrementally. Ratchet describes why those shifts resist reversal. They compound: as a boundary drifts, dependencies accumulate on each side of the new boundary position. Moving the boundary back requires not just the boundary shift itself but the removal of all dependencies that adapted to the current position. Species that have drifted apart cannot be "un-speciated" because their genomes have diverged and built independent evolutionary trajectories.

### 12. CPA <-> BD: Complement (plugins drift the interface boundary)

**Shared domains**: Software engineering (API versioning), music production (plugin standard evolution, e.g., VST2 -> VST3).

**Structural mechanism**: As plugins accumulate and exercise edge cases of the interface contract, pressure builds to drift the interface boundary. New plugins demand capabilities the original interface did not anticipate; deprecated plugins make old interface features vestigial. The interface boundary (which capabilities are in-contract vs. out-of-contract) drifts incrementally without the plugin architecture itself being replaced. CPA creates the conditions for BD to operate on the interface contract.

### 13. ESMB <-> RST: Tension (state preservation vs. state dissolution)

**Shared domains**: Software architecture (circuit breakers as RST within state-machine-governed systems), game engines (application lifecycle state machine vs. plugin unloading).

**Structural mechanism**: ESMB insists that all valid states are enumerated and transitions are guarded. RST dissolves the current state entirely. RST is *structurally illegal* from ESMB's perspective: it transitions to a state that was not in the enumeration (the dissolved/recomposing state). Systems that combine both must either (a) enumerate the dissolution state explicitly (as circuit breakers do with the "open" state), effectively domesticating RST into the state machine, or (b) allow RST to operate outside the state machine's jurisdiction (metamorphosis operates on the organism as a whole, not on any single state machine within it).

### 14. RB <-> BBOP: Complement (overflow as lossy boundary + reconstruction)

**Shared domains**: Audio engineering (buffer underrun creates artifacts requiring reconstruction), message queuing (overflow drops create downstream compensation needs), caching (eviction creates reconstruction cost on cache miss).

**Structural mechanism**: BBOP defines what happens at a capacity boundary. When the overflow policy is lossy (drop oldest, discard, downsample), the boundary operation destroys information, creating a Reconstruction Burden downstream. The cache miss after eviction forces a full reconstruction from source. The dropped message forces the consumer to reconcile with incomplete data. BBOP's overflow policy *is* a lossy boundary operation in the RB sense, and the downstream compensation is the reconstruction burden.

### 15. ISC <-> Ratchet: Tension (convergence vs. irreversibility)

**Shared domains**: Materials science (crystal annealing as ISC vs. cross-linking polymerization as Ratchet), institutional design (regulatory compliance as ISC vs. institutional path dependence as Ratchet).

**Structural mechanism**: ISC says repeated application converges to the same state, making the system reversible (any perturbation is corrected). Ratchet says each step accumulates dependencies that resist reversal. They describe opposite temporal structures: ISC makes history irrelevant (the same endpoint regardless of path), while Ratchet makes history constitutive (the endpoint depends on the entire path). A system with strong ISC properties has weak Ratchet properties and vice versa. This is a genuine structural opposition.

**Boundary case**: Annealing (ISC) operates on materials that have *not* been cross-linked (Ratchet). Once a thermoset is cross-linked, annealing cannot restore it. The Ratchet defeats the ISC by creating dependencies that the convergence operation cannot undo.

---

## Relationship Clusters

### Cluster A: Governance Stack (DSG + ESMB + CPA + BBOP)

These four D-axis and I-axis motifs compose into a coherent governance architecture:
- **DSG** provides the two-speed frame (slow governance, fast operation)
- **ESMB** provides the explicit state control within each speed
- **CPA** provides the extensibility mechanism (plugins at governed interfaces)
- **BBOP** provides the resource boundary management

All four share domains in game engines (Bevy), music production (Zrythm), and CLI frameworks. They co-occur so frequently that they may describe a *standard architecture pattern*: a governed, state-controlled, extensible system with bounded resources. This is the "well-engineered system" cluster.

**Observation**: All four are D-axis or I-axis with derivative order 1.5-2. No R-axis motif participates. This cluster describes *structure* and *integration* but not *self-reference*.

### Cluster B: Evolutionary Dynamics (OFL + BD + Ratchet + PF)

These four motifs compose into a coherent account of directed change:
- **OFL** provides the feedback mechanism (observation changes the observer)
- **BD** provides the incremental displacement of boundaries
- **PF** provides the directionality (toward increasing formal order)
- **Ratchet** provides the irreversibility (accumulated dependencies prevent reversal)

Together: a system observes its environment (OFL), its classification boundaries shift incrementally (BD), the shifts tend toward increasing structural order (PF), and each shift accumulates dependencies that prevent reversal (Ratchet). This is a structural account of *why* things evolve and *why* evolution is irreversible.

**Observation**: All four have derivative order 1 or span 1-2. They describe *dynamics* — how systems change over time. This cluster captures the *velocity* of structural change.

### Cluster C: Phase Transition Pair (ISC + RST)

ISC and RST form a dual pair across a phase boundary:
- **ISC** maintains form within a stable phase
- **RST** transitions between phases through controlled dissolution

This is the minimal system that can both *maintain structure* and *change structure*. Without ISC, there is no stability. Without RST, there is no transformation. The pair describes *structural metabolism*: the ability to maintain and replace form.

**Observation**: ISC is I-axis (integration/convergence), RST is R-axis (recursion/self-reference). The pair spans two of three axes, which is structurally interesting.

### Cluster D: Loss and Compensation (RB + BBOP + Ratchet)

These three motifs describe the economics of information loss:
- **BBOP** creates the capacity boundary where loss can occur
- **RB** describes the downstream cost of that loss
- **Ratchet** describes why the compensation infrastructure becomes permanent

Together: a finite system hits a boundary (BBOP), the boundary operation loses information (RB), and the reconstruction infrastructure that compensates becomes load-bearing and irreversible (Ratchet). This is a structural account of *why* systems accumulate compensatory complexity*.

### Cluster E: Trust and Observation (TaC + OFL + DSG)

These three motifs compose into a trust-governed observation system:
- **TaC** provides the trust-weighted curation
- **OFL** provides the framework-evolving feedback
- **DSG** provides the governance speed separation

Together: trust scores curate what is observed (TaC), observations feed back into the trust scores (OFL operating on the trust dimension), and trust updates happen at governance speed while observations happen at operational speed (DSG). This is the Observer ecosystem's own architecture.

---

## Network Topology Observations

### Connectivity

| Motif | Non-trivial relationships | Hub score |
|-------|--------------------------|-----------|
| DSG | 10 | Highest — connects to everything except RB |
| Ratchet | 10 | Tied highest — the irreversibility mechanism relates to nearly every other motif |
| OFL | 8 | High — the feedback mechanism is pervasive |
| ISC | 7 | High — tension relationships are frequent |
| RST | 7 | High — opposition to stability motifs |
| BD | 7 | Moderate-high |
| PF | 6 | Moderate |
| CPA | 5 | Moderate |
| ESMB | 5 | Moderate |
| BBOP | 4 | Lower |
| TaC | 4 | Lower |
| RB | 5 | Moderate |

**Hub motifs**: DSG and Ratchet are the most connected. DSG acts as a meta-frame (governance speed separation applies to nearly every other motif). Ratchet acts as a universal dynamic (irreversibility affects any system that changes state).

**Peripheral motifs**: TaC and BBOP have fewer structural relationships to other motifs. TaC's relationships are primarily compositions/specializations of OFL. BBOP's relationships are primarily complement-with-DSG and the loss/compensation cluster.

### Axis Distribution

- **D-axis motifs** (CPA, ESMB, BBOP, BD) form the Governance Stack cluster and relate primarily to each other and to DSG
- **I-axis motifs** (DSG, ISC, PF, TaC) are more dispersed; DSG connects everywhere, while TaC and PF are more specialized
- **R-axis motifs** (OFL, Ratchet, RST) form the most interesting tension relationships; they describe self-referential dynamics that oppose or complement the D/I-axis structure

**Cross-axis relationships are more structurally interesting than within-axis relationships.** The ISC-RST tension (I vs R), the ESMB-RST tension (D vs R), and the OFL-BD complement (R vs D) are more revealing than, say, CPA-ESMB complement (D vs D).

### Isolation Test

No motif is fully isolated. Every motif has at least 4 non-trivial relationships. This suggests the library at this scale has reached a level of coherence where motifs form a network rather than a bag of independent patterns.

---

## Composition Patterns (2-3 Motif Composites)

### Pattern 1: Governed Irreversible Formalization (DSG + PF + Ratchet)

A system where material is formalized through governed stages (DSG provides the speed separation, PF provides the trajectory, Ratchet provides the irreversibility). The motif tier system itself instantiates this: tier progression is governed (slow cycle approval), progressive (increasing structural order), and ratcheted (demoting a Tier 2 motif requires overcoming all the analysis built on it).

### Pattern 2: Feedback-Driven Boundary Evolution (OFL + BD + Ratchet)

Observation shifts boundaries (OFL+BD), and the shifted boundaries resist reversal (Ratchet). This is the structural account of paradigm evolution in science, cultural category migration, and schema evolution in software. Each observation-driven boundary shift accumulates dependencies (papers citing the new taxonomy, code depending on the new schema), making reversal increasingly costly.

### Pattern 3: Convergent System with Controlled Dissolution (ISC + RST + DSG)

A system that maintains form through convergence (ISC) until a governance decision (DSG slow cycle) triggers controlled dissolution (RST), after which convergence resumes on a new target. This is the Kubernetes deployment model: reconciliation loops (ISC) maintain pod state, rolling update strategy (DSG governance) triggers pod termination (RST), and convergence immediately targets the new pod spec.

### Pattern 4: Lossy Boundary with Compensatory Ratchet (RB + BBOP + Ratchet)

A capacity boundary (BBOP) performs a lossy operation (RB), the downstream reconstruction infrastructure accumulates (Ratchet), and the accumulated infrastructure becomes load-bearing. Statutory law exemplifies this: legislative compression of policy intent (RB) into statutory text (BBOP-like finite encoding) creates a judicial interpretation industry (reconstruction) that becomes an irreversible institutional dependency (Ratchet).

---

## Implications for Tier 3 Meta-Motif Candidates

The cluster analysis reveals three candidate Tier 3 meta-motifs:

### Candidate T3-1: Structural Metabolism (ISC + RST)

**Claim**: The minimal system capable of both maintaining and transforming structure requires two dual operations: one that converges on a target (ISC), one that dissolves the current form to enable a new target (RST). This pair spans the I-axis and R-axis, suggesting that structural metabolism is inherently cross-axial.

**Test**: Find a system that maintains and transforms structure using only one of ISC or RST. If such systems exist and are stable, the pair is not a genuine composite.

### Candidate T3-2: Irreversible Progressive Ordering (PF + Ratchet + OFL)

**Claim**: The observation-driven, irreversible accumulation of structural order is a composite of three motifs: feedback evolves the observer's framework (OFL), the framework shifts toward higher formality (PF), and dependency accretion prevents reversal (Ratchet). This describes why knowledge, institutions, and cultural practices undergo directional development.

**Test**: Find a system that exhibits progressive formalization without ratchet effects (i.e., easily reversible formalization). If such systems are common, the composition is contingent, not structural.

### Candidate T3-3: Governed Architecture (DSG + CPA + ESMB)

**Claim**: Well-engineered complex systems converge on a standard architecture combining speed-separated governance (DSG), plugin-based extensibility (CPA), and explicit state control (ESMB). The frequency of co-occurrence across game engines, DAWs, and infrastructure tools suggests this is a structural attractor, not coincidence.

**Test**: Find well-engineered complex systems that deliberately reject one of the three and remain successful. If such systems exist widely, the composition is a preference, not a structural necessity.

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| Total pairs analyzed | 66 |
| Complement relationships | 22 |
| Tension relationships | 11 |
| Composition relationships | 6 |
| Subsumption relationships | 0 |
| Independent pairs | 24 |
| Ambiguous/borderline | 3 |
| Identified clusters | 5 |
| Tier 3 candidates identified | 3 |
| Hub motifs (8+ connections) | 3 (DSG, Ratchet, OFL) |
| Peripheral motifs (4 or fewer) | 2 (TaC, BBOP) |

## Open Questions

1. **Is PF genuinely independent of OFL?** The composition relationship is strong enough that PF might be reclassified as an OFL variant rather than an independent motif. This requires adversarial testing: find PF instances with no OFL properties.

2. **Is TaC an OFL specialization?** TaC's composition-with-OFL relationship is structural, not incidental. If TaC reduces to "OFL restricted to the trust dimension," it should not be promoted independently.

3. **Does the Governance Stack (Cluster A) constitute a single meta-pattern?** The co-occurrence of DSG+CPA+ESMB+BBOP across game engines, DAWs, and infrastructure tools is striking. Is this one pattern or four?

4. **Are tension relationships more structurally informative than complement relationships?** The ISC-RST, ISC-Ratchet, and ESMB-RST tensions reveal structural boundaries more precisely than any complement relationship. Tension relationships may be the primary tool for differentiating motifs.

5. **What is the role of RB (Reconstruction Burden)?** RB's relationship network is distinct from the other 11 motifs: it primarily complements motifs that create boundaries or losses (BBOP, Ratchet, CPA, BD) but has no tension relationships. This suggests RB may be a *consequence* pattern rather than a *structural* pattern — it describes what happens *after* other motifs create information loss, rather than describing a structural shape itself.
