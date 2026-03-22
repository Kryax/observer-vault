---
title: "Ratchet with Asymmetric Friction — Alien Domain Testing for T2"
date: 2026-03-22
status: draft
source: ocp-scraper (SEP, GitHub) + domain analysis
target_motif: ratchet-with-asymmetric-friction
target_gap: "alien domain testing for T2 validation"
existing_domains: 6
---

# Ratchet with Asymmetric Friction — Alien Domain Testing for T2

## Objective

Test the Ratchet with Asymmetric Friction motif (R/d1) in domains maximally distant from the existing 6 to assess Tier 2 candidacy. The existing domains span social science (Political Science, Economics), natural science (Evolutionary Biology), engineering (Software Engineering), humanities (Info Theory/Linguistics), and law (Common Law). Truly alien domains must come from fields with different ontologies, vocabularies, and causal substrates.

**Pattern under test**: "A system where each state change accumulates dependencies that make reversal disproportionately costlier than the original change, producing directional drift."

**Structural invariant**: forward step -> dependency accretion -> asymmetric friction (reversal costs grow with dependency count).

**Three-part structural test applied to each candidate**:
1. Is there a forward step?
2. Do dependencies accrete around the committed state?
3. Is reversal disproportionately costlier than the forward step, and does the cost grow with the dependency count?

**Zero-consumer test**: If all accumulated dependencies are removed, is reversal cheap? If yes, the friction is genuine (it comes from dependency accretion, not from the change itself).

---

## Scrape Summary

| Query | Source | Records Indexed | Key Records |
|-------|--------|----------------|-------------|
| habit formation entrenchment automaticity psychology | SEP | 5 | psychology-normative-cognition (0.641), folkpsych-simulation (0.574) |
| artistic convention tradition innovation aesthetics | SEP | 5 | convention (0.618), aesthetics-cogsci (0.587), goodman-aesthetics (0.551) |
| path dependence irreversibility thermodynamics entropy | SEP | 5 | time-thermo (0.534), information-entropy (0.404), statphys-statmech (0.580) |
| crystallization nucleation polymerization irreversible chemistry | SEP | 3 | chemistry (0.644), death-definition (0.565) |
| neural plasticity habit formation synaptic entrenchment | SEP | 3 | cognitive-science (0.596), connectionism (0.499) |
| urban planning zoning path dependence infrastructure lock-in | SEP | 3 | dependence-ontological (0.622), logic-dependence (0.489) |
| database migration irreversible backward compatibility | GitHub | 1 | youngfish42--awesome-fl (0.592, 1965 stars) |
| infrastructure as code state drift dependency | GitHub | 5 | goldbergyoni--nodebestpractices (0.834, 105173 stars) |

**Total new OCP records**: 30 across 8 queries. Direct ratchet-relevant records: SEP convention, time-thermo, information-entropy, chemistry, cognitive-science, connectionism.

---

## Alien Domain Instance 7: Neuroscience — Synaptic Pathway Entrenchment (Hebbian Ratchet)

- **Domain**: Neuroscience / Cognitive Psychology
- **Alienness from existing 6**: The existing domains operate on populations (political constituencies, language communities, software consumers, market participants, genomes, legal systems). Neuroscience operates on individual neural architecture — a different ontological level (sub-organismal, physical substrate of cognition). The causal mechanism is electrochemical, not social, informational, or evolutionary.
- **Expression**: Hebb's principle ("neurons that fire together wire together") describes how repeated activation of a neural pathway strengthens the synaptic connections along that path. Each repetition of a behavior triggers long-term potentiation (LTP), which increases synaptic efficacy. But the dependencies go beyond the synapse itself: surrounding neural circuits rewire to use the strengthened pathway as a shortcut (cortical maps reorganize), motor programs incorporate the habitual sequence, proprioceptive feedback loops calibrate to the learned pattern, and dopaminergic reward circuits tune their baseline expectations to the habitual state. Breaking a habit requires not just weakening the original synapse (which the brain can do via long-term depression, LTD) but simultaneously retraining every downstream circuit that has adapted to route through the entrenched pathway. This is why habit reversal is disproportionately harder than habit formation: the original action recruits a single pathway, but reversal must overcome the entire cortical reorganization that adapted to it. William James (1890) called habit "the enormous flywheel of society" — and the flywheel metaphor captures exactly the ratchet: momentum (dependency accretion) makes reversal costlier than the original impulse. The SEP entry on normative cognition (ocp:sep/psychology-normative-cognition, trust: 0.641) discusses how normative patterns become entrenched through cognitive automaticity — once a norm becomes "default," the cognitive cost of deviating exceeds the cost of the original adoption. The SEP connectionism entry (ocp:sep/connectionism, trust: 0.499) details how distributed representations in neural networks create implicit dependencies: modifying one weight to "unlearn" a pattern disrupts other learned associations that share those weights (catastrophic interference), making selective reversal far costlier than the original learning.
- **What accumulates**: Downstream neural circuits that route through the entrenched pathway — motor programs, cortical maps, proprioceptive calibrations, reward circuit baselines, and attentional biases that all presuppose the habitual pathway.
- **Why reversal cost grows**: Each downstream circuit that adapts to the habitual pathway adds a dependency that must be independently retrained on reversal. A habit used once (no downstream adaptation) is trivially extinguishable. A habit practiced for years, with motor sequences, contextual cues, and reward expectations all calibrated to it, requires sustained effortful override of every adapted subsystem.
- **Three-part test**: (1) Forward step: repeated activation of a neural pathway. (2) Dependency accretion: cortical maps, motor programs, reward baselines, and attentional filters reorganize around the pathway. (3) Asymmetric friction: extinguishing requires retraining all adapted subsystems, while formation requires only the original pathway activation. PASS.
- **Zero-consumer test**: If no downstream circuits had adapted to the pathway (i.e., the synapse existed in isolation with zero routing dependents), LTD could reverse the potentiation at minimal cost. The friction comes from the adaptation of consumers (downstream circuits), not from the synaptic change itself. PASS.
- **R/d1 confirmation**: The neural system's own activity history constrains its future plasticity through the dependencies that build around entrenched pathways. Each activation creates conditions that make future activation easier and reversal harder — a first-order recursive loop. Not d0 (static) because the mechanism is inherently temporal/dynamic. Not d2 because the ratchet mechanism itself (Hebbian learning + downstream adaptation) remains stable — it does not change its own rules.
- **Key references**: Hebb (1949) *The Organization of Behavior*; James (1890) *The Principles of Psychology* Ch. 4 "Habit"; Graybiel (2008) "Habits, Rituals, and the Evaluative Brain" *Annual Review of Neuroscience*; Bouton (2004) "Context and Behavioral Processes in Extinction" *Learning & Memory* (on why extinction does not erase but only suppresses — further evidence of irreversibility)
- **Source**: `ocp:sep/psychology-normative-cognition` (trust: 0.641), `ocp:sep/connectionism` (trust: 0.499), `ocp:sep/cognitive-science` (trust: 0.596)

---

## Alien Domain Instance 8: Chemistry / Materials Science — Cross-Linking Polymerization Ratchet

- **Domain**: Chemistry / Materials Science
- **Alienness from existing 6**: This operates on molecular bonds in inanimate matter. There are no agents, no decisions, no information, no populations — only thermodynamics and covalent chemistry. The causal substrate (molecular orbital interactions, covalent bond formation) is as far from social science, law, and software engineering as possible while remaining within empirical science.
- **Expression**: When a thermosetting polymer (epoxy resin, vulcanized rubber, Bakelite) undergoes cross-linking, individual monomer chains form covalent bonds with adjacent chains. The initial polymerization is a relatively low-energy forward reaction (often exothermic, requiring only heat or a catalyst). But each cross-link constrains the conformational freedom of neighboring chain segments, which in turn affects the probability and geometry of subsequent cross-links. The network topology that emerges is not the result of a single cross-link but of the entire accumulated bonding history. Reversal (de-cross-linking) requires breaking covalent bonds — but the energy required to break a bond embedded in a rigid cross-linked network is higher than the energy needed to break the same bond in a flexible chain, because the surrounding network constrains the fragments from separating. The gel point marks the phase transition where the cross-link density passes the percolation threshold and the material becomes a single macroscopic network — after this point, reversal requires breaking not just individual bonds but overcoming the topological connectivity of the entire network. This is why thermosets cannot be re-melted: the cross-link density creates a dependency network where every bond is mechanically coupled to every other bond through the network topology. In contrast, thermoplastics (linear polymers without cross-links) can be re-melted trivially — demonstrating the zero-consumer test: without the dependency network (cross-links), reversal (melting) is cheap.
- **What accumulates**: Cross-links between polymer chains — each bond constrains the geometry and mechanical properties of neighboring segments, creating a coupled network where each element depends on the topology of the whole.
- **Why reversal cost grows**: Each additional cross-link adds a structural dependency. The energy required to decompose the network grows superlinearly with cross-link density because bond dissociation in a constrained network requires more energy than in a free chain (mechanical coupling amplifies the effective bond energy). Beyond the gel point, the material becomes a single topologically connected object — you cannot selectively remove cross-links without fragmenting the network.
- **Three-part test**: (1) Forward step: exothermic cross-linking reaction between monomer chains. (2) Dependency accretion: each cross-link constrains neighboring chains, and the network topology couples distant regions of the material. (3) Asymmetric friction: decomposing the cross-linked network requires far more energy than forming it, and the cost scales with the density and connectivity of the accumulated cross-link network. PASS.
- **Zero-consumer test**: A single cross-link in isolation (monomer chains with one bond between them, no network topology) can be reversed at roughly the bond dissociation energy. A densely cross-linked network resists reversal because the surrounding bonds prevent the fragments from separating. Remove the network context and reversal becomes cheap. PASS.
- **R/d1 confirmation**: The polymer's bonding history constrains its future chemistry through the network topology that accumulated cross-links create. Each cross-link makes the next cross-link more geometrically constrained (and eventually impossible past full cure), while reversal becomes harder as the network stiffens. The self-referential loop: bonding creates structure, structure constrains future bonding and resists un-bonding. Not d0 (static self-reference) because the mechanism unfolds over cure time. Not d2 because the cross-linking mechanism itself does not change — the same covalent chemistry operates throughout.
- **Key references**: Flory (1941) "Molecular Size Distribution in Three-Dimensional Polymers" (gel point theory); Stockmayer (1943) (percolation model for network polymers); Ferry (1980) *Viscoelastic Properties of Polymers*; thermoset vs. thermoplastic distinction in any polymer chemistry textbook
- **Source**: `ocp:sep/chemistry` (trust: 0.644, discusses philosophy of chemistry and molecular structure dependence)

---

## Alien Domain Instance 9: Music — Genre Convention and Audience Expectation Accretion

- **Domain**: Music / Aesthetics / Cultural Production
- **Alienness from existing 6**: While music is a cultural artifact (as is law and language), the causal substrate is perceptual and aesthetic rather than rational, economic, or biological. Genre conventions operate through embodied listener expectations, not through formal dependency graphs, market forces, or molecular bonds. The "dependencies" are affective and perceptual — trained ears, emotional associations, venue infrastructures, and critical vocabularies that accumulate around a genre's conventions.
- **Expression**: When a musical genre crystallizes — say, sonata form in the Classical period, or the 12-bar blues, or the verse-chorus-verse pop structure — composers/artists work within the convention, and listeners develop expectations calibrated to it. Each piece written in the form reinforces the listener's expectation; each performer trained in the idiom deepens the pedagogical infrastructure; each concert venue designed for the genre's typical instrumentation adds a physical dependency; each music theory textbook that codifies the form adds an institutional dependency; each critic who evaluates new work relative to the established form adds a gatekeeping dependency. The forward step (adopting a convention) is cheap — one artist or community decides on a structure. But the dependency network that accretes is vast: listener expectations, performer training pipelines, instrument manufacturing, recording studio configurations, radio format templates, streaming platform genre tags, and critical/scholarly apparatus. Departing from the convention (as the early Romantics did with sonata form, or as bebop did with swing, or as punk did with progressive rock) is possible but requires simultaneously overcoming all adapted subsystems — and the "revolutionary" genre typically must build its own parallel infrastructure of venues, critics, pedagogies, and audience expectations from scratch. The SEP entry on convention (ocp:sep/convention, trust: 0.618) directly addresses how conventions, once established, resist change because "alternative conventions that are in some sense equally good" cannot displace the incumbent due to accumulated reliance. The SEP entry on aesthetics and cognitive science (ocp:sep/aesthetics-cogsci, trust: 0.587) discusses how perceptual schemas and aesthetic expectations become entrenched through exposure, creating cognitive path dependence in aesthetic judgment.
- **What accumulates**: Listener expectations, performer training, instrument/venue/studio infrastructure, pedagogical materials, critical vocabularies, streaming/radio format templates, and scholarly apparatus — all calibrated to the genre's conventions.
- **Why reversal cost grows**: Each new performer trained in the idiom, each venue configured for it, each listener whose expectations are calibrated to it, each critic who evaluates relative to it — all add dependencies. Abandoning the convention means simultaneously overcoming all of these adapted entities. The more deeply embedded the convention, the more infrastructure must be rebuilt from scratch.
- **Three-part test**: (1) Forward step: a musical convention is adopted (sonata form, 12-bar blues, verse-chorus structure). (2) Dependency accretion: performers, listeners, venues, pedagogies, critics, and media formats adapt to the convention. (3) Asymmetric friction: departing from the convention requires building parallel infrastructure for every adapted subsystem, while continuing within it requires only creative variation within established parameters. PASS.
- **Zero-consumer test**: A musical form that has never been performed, heard, taught, or written about is trivially abandonable — there are no adapted entities. The friction comes entirely from the accumulated listener/performer/infrastructure expectations, not from the form itself. PASS.
- **R/d1 confirmation**: The genre's own history of use constrains its future evolution through the expectations and infrastructure that accumulate around its conventions. Each new work in the genre reinforces the convention and deepens the dependency network. The self-referential loop: convention use creates expectations, expectations constrain future creation, constrained creation reinforces expectations. Not d2 because the ratchet mechanism (convention -> expectation -> reinforcement) remains stable.
- **Key references**: Meyer (1956) *Emotion and Meaning in Music* (listener expectation as the basis of musical meaning); Rosen (1988) *Sonata Forms* (on the crystallization and subsequent resistance to change of sonata form); Lena (2012) *Banding Together: How Communities Create Genres in Popular Music* (on genre infrastructure accretion); DeNora (2000) *Music in Everyday Life* (music as affordance structure)
- **Source**: `ocp:sep/convention` (trust: 0.618), `ocp:sep/aesthetics-cogsci` (trust: 0.587), `ocp:sep/goodman-aesthetics` (trust: 0.551)

---

## Alien Domain Instance 10: Urban Planning / Architecture — Zoning and Infrastructure Dependency Networks

- **Domain**: Urban Planning / Architecture / Civil Engineering
- **Alienness from existing 6**: This operates on physical space and the built environment. Unlike software (which is abstract and digital), law (which is textual), or biology (which is organic), urban infrastructure is concrete, spatially fixed, and extremely capital-intensive. The dependencies are physical (pipes, roads, foundations) and spatial (proximity relationships, sight lines, traffic patterns), not informational, biological, or legal.
- **Expression**: When a city zones a district as residential and builds accordingly, an enormous dependency network accretes: roads are laid to residential traffic patterns, water/sewer pipes are sized for domestic loads, schools and parks are sited for residential catchment areas, property tax assessments assume residential valuations, mortgage instruments are secured against residential zoning, neighborhood associations form around residential character, retail businesses locate to serve residential consumers. Rezoning to commercial or industrial use requires not just changing a designation on a map but simultaneously: (a) rebuilding roads for truck traffic, (b) upgrading utility infrastructure for industrial loads, (c) relocating schools, (d) renegotiating property tax structures, (e) defeating organized neighborhood opposition, (f) buying out or renegotiating residential mortgages, (g) reconfiguring retail to serve a different clientele. Each building constructed under the zoning adds a physical dependency that would need demolition or retrofit on reversal. Robert Moses's highway projects in New York are a canonical example: once a highway is built through a neighborhood, the neighborhood reorganizes around it (sound barriers, on/off ramp businesses, commuter patterns, property values tied to highway access). Removing the highway (as happened with San Francisco's Embarcadero Freeway after the 1989 earthquake) requires decades and enormous capital — not because the concrete is hard to demolish, but because every adapted entity (traffic patterns, property values, businesses, transit routes) must be simultaneously reconfigured.
- **What accumulates**: Roads, pipes, buildings, schools, businesses, property instruments, neighborhood associations, transit routes, and utility infrastructure — all physically configured for the current zoning and use pattern.
- **Why reversal cost grows**: Each building, road, and pipe adds a capital-intensive physical dependency. Unlike software APIs (where migration is labor but not capital), infrastructure dependencies are measured in billions of dollars of sunk physical investment. The spatial fixity of buildings means they cannot be "migrated" — they must be demolished and rebuilt.
- **Three-part test**: (1) Forward step: a zoning decision is made and initial construction occurs. (2) Dependency accretion: roads, utilities, schools, businesses, transit, property instruments, and community organizations all configure to the zoning. (3) Asymmetric friction: rezoning requires simultaneous reconfiguration of all physically embedded dependencies, at costs orders of magnitude greater than the initial zoning decision. PASS.
- **Zero-consumer test**: A zoning designation on undeveloped land (zero buildings, zero infrastructure, zero community) is trivially reversible — just change the map. The friction comes entirely from the accumulated built environment and its human/institutional adaptations. PASS.
- **R/d1 confirmation**: The built environment's own development history constrains its future development through the physical and institutional dependencies that accumulate around each land-use commitment. Each building constructed deepens the commitment; the self-referential loop is: construction creates infrastructure, infrastructure attracts complementary construction, complementary construction deepens the dependency network. Not d2 because the ratchet mechanism (build -> attract dependencies -> resist reversal) is stable across all instances.
- **Key references**: Jacobs (1961) *The Death and Life of Great American Cities*; Hirt (2014) *Zoned in the USA*; Robert Moses's highway legacy (Caro 1974, *The Power Broker*); Embarcadero Freeway removal case study; Marshall (2004) *Streets and Patterns*
- **Source**: Domain knowledge; structural parallel to the economics/technology lock-in instance but operating on physical capital rather than market adoption.

---

## Alien Domain Instance 11: Thermodynamics / Statistical Mechanics — Entropy Production as Asymmetric Friction

- **Domain**: Physics / Thermodynamics
- **Alienness from existing 6**: This is the most fundamental physical domain possible — it operates on the statistical behavior of particle ensembles, with no agents, no information (in the semantic sense), no biology, and no social structures. The causal substrate is the second law of thermodynamics itself. If the ratchet motif holds here, it holds at the level of physical law.
- **Expression**: The second law of thermodynamics states that the entropy of an isolated system spontaneously increases toward equilibrium but does not spontaneously decrease. The SEP entry on thermodynamic asymmetry in time (ocp:sep/time-thermo, trust: 0.534) provides the philosophical treatment: "Heat flows from hot to cold, never the reverse. The smell of coffee spreads throughout its available volume, never the reverse." But the fit with the ratchet motif is more specific than "things tend toward disorder." When a system undergoes an irreversible process (e.g., mixing of two gases, heat conduction between bodies at different temperatures), the entropy increase reflects the proliferation of microstates compatible with the macrostate. Each step toward equilibrium increases the number of accessible microstates — and those microstates are the "dependencies" in the ratchet sense. Reversal would require the system to spontaneously find its way back to one of the vanishingly small fraction of microstates compatible with the original ordered state — and the more microstates the system has explored, the less probable this becomes. Landauer's principle (from ocp:sep/information-entropy, trust: 0.404) makes the dependency accretion concrete: erasing one bit of information requires dissipating at least kT ln 2 of energy as heat, because the computational operation destroys correlations (dependencies between the system's state and the environment's record of that state). Each irreversible step creates new correlations with the environment (heat bath); these correlations are the dependencies that make reversal costlier.

**HOWEVER — critical structural analysis**: The thermodynamic case is a borderline fit. The "dependencies" (microstates, environmental correlations) are not entities that "adapt to" the committed state in the way that software consumers adapt to an API or neural circuits adapt to a habit. They are statistical rather than structural. The reversal cost does not grow because adapted entities resist change — it grows because the probability of spontaneous reversal decreases combinatorially. This is a different mechanism: probabilistic suppression rather than structural resistance. The zero-consumer test is ambiguous: removing "environmental correlations" is not well-defined in the same way as removing software consumers or neural dependencies.

- **Structural test assessment**: (1) Forward step: irreversible process (mixing, heat flow). (2) Dependency accretion: environmental correlations and microstate proliferation. (3) Asymmetric friction: reversal requires finding one specific microstate among combinatorially many — probability decreases with each step. Formally PASS, but the mechanism is statistical rather than structural.
- **Zero-consumer test**: AMBIGUOUS. The "consumers" (environmental degrees of freedom that have absorbed the dissipated energy) cannot be cleanly isolated.
- **R/d1 fit**: WEAK. The self-referential element is present (the system's macrostate history constrains its future evolution through accumulated entropy), but the feedback loop operates through probability distributions over microstates rather than through identifiable dependencies. This is closer to d0 (a static law constraining the system) than d1 (a dynamic feedback loop through accumulated dependencies).
- **Verdict**: PARTIAL INSTANCE. The thermodynamic arrow of time shares the structural shape of the ratchet (forward-cheap, reversal-expensive, cost-grows-with-steps) but the mechanism is statistical/probabilistic rather than dependency-structural. This instance should be noted as a structural analog rather than a full domain instance for T2 counting purposes.
- **Source**: `ocp:sep/time-thermo` (trust: 0.534), `ocp:sep/information-entropy` (trust: 0.404)

---

## Cross-Instance Structural Analysis (All 10 Instances)

| # | Domain | Alien? | What Accumulates | Mechanism Type | Zero-Consumer Test |
|---|--------|--------|-----------------|---------------|-------------------|
| 1 | Political Science | existing | Constituencies, procedures | Social/institutional | PASS |
| 2 | Info Theory / Linguistics | existing | Compounds, idioms | Informational/semiotic | PASS |
| 3 | Software Engineering | existing | Downstream consumers | Technical/digital | PASS |
| 4 | Economics | existing | Complementary assets | Market/capital | PASS |
| 5 | Evolutionary Biology | existing | Interaction partners | Biological/genetic | PASS |
| 6 | Common Law | existing | Citing cases, reliance | Legal/textual | PASS |
| 7 | **Neuroscience** | **ALIEN** | Neural circuits, motor programs | Electrochemical/cognitive | PASS |
| 8 | **Chemistry** | **ALIEN** | Cross-links, network topology | Molecular/covalent | PASS |
| 9 | **Music/Aesthetics** | **ALIEN** | Listener expectations, infrastructure | Perceptual/affective | PASS |
| 10 | **Urban Planning** | **ALIEN** | Buildings, roads, utilities | Physical/spatial | PASS |
| 11 | Thermodynamics | ALIEN (partial) | Microstates, correlations | Statistical/probabilistic | AMBIGUOUS |

### Structural Invariant Assessment

The three-part invariant (forward step -> dependency accretion -> asymmetric friction) holds cleanly across instances 1-10. Instance 11 (thermodynamics) exhibits the shape but through a different mechanism (statistical suppression rather than structural dependency accretion).

The zero-consumer test passes for instances 1-10: in every case, removing the accumulated dependencies makes reversal cheap. This confirms that the friction is genuinely in the dependency network, not in the change itself.

### Alienness Assessment

The 4 new alien domain instances span:
- **Neuroscience** (sub-organismal, electrochemical) — maximally distant from the social/institutional domains
- **Chemistry/Materials** (inanimate, molecular) — maximally distant from all biological and social domains; operates on covalent bonds in matter with no agents whatsoever
- **Music/Aesthetics** (perceptual, affective) — a cultural domain but operating through embodied perception rather than rational/economic/legal mechanisms
- **Urban Planning** (physical, spatial, capital-intensive) — built environment rather than information, biology, or social convention

These 4 domains are genuinely alien: they share no disciplinary overlap with the existing 6 and operate through fundamentally different causal substrates (electrochemistry, covalent bonds, aesthetic perception, physical capital).

---

## T2 Validation Protocol Assessment

### 1. 3+ domains from truly alien fields?

**YES.** 4 fully passing alien domain instances (Neuroscience, Chemistry, Music, Urban Planning), plus 1 partial (Thermodynamics). The 4 full instances come from fields with no disciplinary overlap with the existing 6 domains.

### 2. Structural invariant holds across all domains?

**YES.** The three-part structure (forward step -> dependency accretion -> asymmetric friction) holds cleanly across all 10 full instances. The zero-consumer test passes for all 10. The invariant is domain-independent: it operates through covalent bonds (chemistry), synaptic connections (neuroscience), listener expectations (music), physical infrastructure (urban planning), API consumers (software), complementary assets (economics), genomic co-adaptations (biology), citation networks (law), institutional constituencies (politics), and semiotic compounds (linguistics).

### 3. Falsification conditions survive?

**YES.** The two falsification conditions from the motif definition remain unmet:
- **Linear scaling**: In every domain, reversal cost scales superlinearly with dependency count. The cross-linking chemistry instance makes this most concrete: bond dissociation energy in a constrained network exceeds that of a free chain due to mechanical coupling. The music instance shows it in cultural terms: departing from a deeply embedded genre convention requires building entirely parallel infrastructure.
- **Regular reversal without extraordinary effort**: No domain instance exhibits regular easy reversal. Habit extinction does not erase but suppresses (Bouton 2004). Cross-linked polymers cannot be re-melted. Entrenched genre conventions are only overturned by revolutionary movements. Zoning reversals take decades and billions of dollars.

### 4. Domain boundary clearly defined?

**YES.** The motif's domain boundary is clearly marked:
- **Included**: Systems where forward steps create external dependencies that adapt to the committed state, making reversal cost scale with dependency count.
- **Excluded**: (a) Simple irreversibility where reversal is inherently costly regardless of dependencies (e.g., breaking an egg — the cost is in the physics of the break, not in accumulated dependencies). (b) Mere friction without dependency accretion (e.g., physical inertia — resistance to change that does not grow with history). (c) Statistical irreversibility without structural dependencies (thermodynamics instance 11 — borderline, classified as partial analog).
- The thermoset/thermoplastic contrast provides the sharpest boundary test: thermosets (cross-linked, dependency network) exhibit the ratchet; thermoplastics (linear, no cross-links) do not. Same chemistry, different dependency topology, different reversibility profile.

### 5. Not subsumed by a broader motif?

**YES — with caveat.** The ratchet is not subsumed by:
- **Path dependence** (broader concept that includes cases without dependency accretion, e.g., sensitive dependence on initial conditions in chaos)
- **Hysteresis** (broader concept that includes non-growing friction; the ratchet specifically requires that friction grows with accumulated steps)
- **Lock-in** (often used loosely; the ratchet provides the structural mechanism that explains lock-in)
- **Progressive Formalization** (PF describes a trajectory from amorphous to crystalline; the ratchet describes the mechanism that makes PF irreversible. They are complements, not subsumption.)

**Caveat**: The ratchet motif could potentially be seen as a special case of a very general "increasing returns to commitment" principle. However, the motif's specificity (three-part structure, dependency accretion as the mechanism, zero-consumer test as the diagnostic) makes it a well-bounded structural pattern rather than an amorphous general principle.

---

## Recommendation

**The Ratchet with Asymmetric Friction passes the T2 validation protocol.** With 10 full domain instances across 10 genuinely distinct fields — spanning molecular chemistry, neuroscience, aesthetics, urban planning, software engineering, economics, evolutionary biology, law, political science, and linguistics — the motif demonstrates domain-independent structural validity. The three-part invariant and zero-consumer test hold across all instances. Falsification conditions remain unmet. The domain boundary is clearly defined and the motif is not subsumed by broader patterns.

**Proposed updates**:
- Confidence: 0.8 -> 0.9
- Domain count: 6 -> 10 (+ 1 partial)
- Tier: recommend promotion to Tier 2 pending Adam's approval

**Strongest new instances** (for motif file inclusion):
1. **Chemistry / Cross-Linking Polymerization** — the most structurally clean instance because it operates on inanimate matter with no agents, making the dependency accretion mechanism maximally visible. The thermoset/thermoplastic contrast is the sharpest zero-consumer test across all domains.
2. **Neuroscience / Hebbian Ratchet** — powerful because it shows the motif operating at the sub-organismal level on electrochemical substrates, and because the Bouton (2004) finding that extinction suppresses rather than erases directly confirms irreversibility.

**This file is a candidate only. Do NOT modify the existing motif file without Adam's approval.**
