---
title: "R/d1 Expansion Scrape — Ratchet with Asymmetric Friction"
date: 2026-03-22
status: draft
source: ocp-scraper (SEP, GitHub) + domain knowledge
target_motif: ratchet-with-asymmetric-friction
target_axis: recurse
target_order: 1
existing_domains: 2
new_domains_found: 4
total_domains_after: 6
promotion_target: tier-1
---

# R/d1 Expansion Scrape — Ratchet with Asymmetric Friction

Targeted scrape to expand the Ratchet with Asymmetric Friction motif (R/d1) from 2 domains to 4+, enabling Tier-1 promotion.

**Pattern shape**: "A system where each state change accumulates dependencies that make reversal disproportionately costlier than the original change, producing directional drift."

**Key distinguisher**: The DEPENDENCIES that build up around the committed state are what makes reversal costly. It is not that the change itself is hard to undo — it is that OTHER things adapt to the new state.

**R/d1 classification**: First-order recurse. The system's own state changes feed back to constrain future state changes. Each step creates conditions that make the next step in the same direction easier and reversal harder. The self-referential element is that the system's history acts on its future through accumulated dependencies.

## Existing Instances (NOT re-scraped)

1. **Political Science** — Institutional Path Dependence (bureaucratic agencies, constitutional provisions, democratic backsliding)
2. **Information Theory / Linguistics** — Arbitrary Binding Ossification (Saussure's arbitrary sign, codebook assignments)

---

## Scrape Infrastructure Notes

- **SEP adapter**: 30 records processed across 3 topic batches. Relevant hits: `ocp:sep/time-thermo` (trust: 0.534), `ocp:sep/evolution-cultural` (trust: 0.635), `ocp:sep/game-evolutionary` (trust: 0.518), `ocp:sep/reduction-biology` (trust: 0.674).
- **GitHub adapter**: 20 records processed across 2 topic batches. Relevant hits: `ocp:github/carbon-language--carbon-lang` (trust: 0.74, 33652 stars), `ocp:github/zloirock--core-js` (trust: 0.752, 25476 stars), `ocp:github/charlax--professional-programming` (trust: 0.72, 50680 stars).
- **OCP search index**: Zero results for all 3 search queries (path dependence, technical debt, evolutionary ratchet). Index does not yet contain problem-statement-level semantic matching for these concepts.

---

## New Instance 3: Software Engineering — API/ABI Dependency Accretion

- **Domain**: Software Engineering
- **Expression**: When a software library exposes a public API, every downstream consumer builds against that interface. Each consumer adds code that assumes the shape of the API: type signatures, argument order, return semantics, error codes. The library author can add new functions trivially (forward movement is cheap), but changing or removing an existing function signature requires coordinating migration across all consumers — a cost that grows superlinearly with the dependency graph. This is why deprecated APIs persist for decades: the cost of removal is borne not by the library author but by every adapter built on top of it. C++ is the canonical example — its backward-compatibility constraints have accumulated over 40+ years to the point where Google created Carbon Language explicitly as a "successor language" because fixing C++ from within is costlier than starting fresh and providing interop bridges. JavaScript polyfill libraries like core-js (25,476 stars) exist specifically to paper over the friction of browser API evolution, maintaining backward compatibility shims that themselves become dependencies.
- **What accumulates**: Downstream consumers, build scripts, documentation, tutorials, trained developer expectations, integration tests — all adapted to the current API surface.
- **Why reversal cost grows**: Each new consumer adds another entity that would break on reversal. The reversal cost is proportional to the size of the dependency graph, not to the complexity of the original change. A one-line API change can require thousands of downstream migrations.
- **R/d1 confirmation**: The system's own history (published API surface) constrains its future (what changes are feasible) through accumulated dependencies. The dependencies are the feedback mechanism — they are created BY the forward step and they PREVENT the reverse step. This is genuinely self-referential: the act of publishing an API creates the constraints that make un-publishing it disproportionately expensive.
- **Not trivial irreversibility**: The API change itself is trivially reversible in the library source. What makes it irreversible is that external systems have adapted to the committed state. Remove the backward compatibility constraint (i.e., have zero consumers) and the reversal is free — proving that the friction comes from dependency accretion, not from the change itself.
- **Source**: `ocp:github/carbon-language--carbon-lang` (trust: 0.74), `ocp:github/zloirock--core-js` (trust: 0.752), `ocp:github/charlax--professional-programming` (trust: 0.72)
- **Key references**: Hyrum's Law ("With a sufficient number of users of an API, all observable behaviors of your system will be depended on by somebody"); Stroustrup (1994) *The Design and Evolution of C++*; Carbon Language design motivation docs; semver as a social protocol for managing API ratchet effects

---

## New Instance 4: Economics — Technological Lock-In via Increasing Returns

- **Domain**: Economics / Industrial Organization
- **Expression**: Brian Arthur's (1989) increasing returns model shows that when a technology is adopted, complementary investments accumulate around it: training programs, supply chains, repair infrastructure, regulatory standards, and interoperability protocols. QWERTY keyboard layout is the textbook example — not because the layout itself resists change (remapping keys is trivial), but because typist muscle memory, keyboard manufacturing tooling, software keyboard layouts, teaching curricula, and accessibility standards all presuppose it. VHS over Betamax, x86 over competing ISAs, and the internal combustion engine over early electric vehicles all follow the same pattern: early adoption triggers complementary investment that raises the switching cost superlinearly. Arthur's formal model shows that the probability of lock-in increases with each adopter because each adopter's complementary investments make the next adoption cheaper in the same direction and costlier in the reverse direction.
- **What accumulates**: Complementary assets — training, tooling, supply chains, standards, interop protocols, regulatory frameworks, consumer expectations — all adapted to the incumbent technology.
- **Why reversal cost grows**: Each complementary investment is an entity that would need replacement or retraining on reversal. The investments are made by independent agents (firms, workers, regulators), creating a coordination problem that grows with the size of the installed base.
- **R/d1 confirmation**: The technology's own adoption history constrains its future displacement through the complementary investments that adoption triggers. Each adoption event creates new dependencies; those dependencies feed back to make the next adoption event more likely and displacement less likely. The self-referential loop is: adoption creates infrastructure, infrastructure lowers adoption cost, lower cost drives more adoption, more adoption creates more infrastructure.
- **Not trivial irreversibility**: The technology itself can be replaced at any single site. What makes system-wide reversal disproportionately costly is the distributed complementary investment. If all complementary assets were owned by a single agent, switching cost would be manageable — the friction comes from the coordination problem created by distributed dependency accretion.
- **Source**: `ocp:sep/evolution-cultural` (trust: 0.635, discusses cultural lock-in and cumulative culture), `ocp:sep/game-evolutionary` (trust: 0.518, increasing returns in evolutionary game theory)
- **Key references**: Arthur (1989) "Competing Technologies, Increasing Returns, and Lock-In by Historical Events" *Economic Journal*; David (1985) "Clio and the Economics of QWERTY" *American Economic Review*; North (1990) *Institutions, Institutional Change, and Economic Performance*; Liebowitz & Margolis (1995) critique distinguishing first-degree, second-degree, and third-degree path dependence

---

## New Instance 5: Biology — Muller's Ratchet and Genomic Complexity Accretion

- **Domain**: Evolutionary Biology / Population Genetics
- **Expression**: Muller's ratchet (1964) describes how asexual populations irreversibly accumulate deleterious mutations because each mutation-free lineage that is lost by drift cannot be recovered without recombination. But the deeper ratchet — the one that matches R/d1 — is genomic complexity accretion. When a gene duplicates and the duplicate acquires a new function (neofunctionalization), other genes evolve to interact with the new copy. Regulatory networks wire into it, protein complexes incorporate it, developmental pathways depend on it. The duplicate's presence becomes structurally assumed by dozens of other components. Deletion of the now-"unnecessary" original becomes lethal not because the gene itself is essential but because the interaction partners have adapted to its presence. This is why eukaryotic genomes exhibit a complexity ratchet (Stoltzfus 1999, Lynch 2007): features accrete and become irremovable because the rest of the genome adapts to them. Introns, once inserted, acquire regulatory functions that make their removal disruptive. Organellar genomes (mitochondria, chloroplasts) cannot revert to free-living because the host genome has lost the genes that the endosymbiont provides — neither partner can survive alone.
- **What accumulates**: Interaction partners — regulatory circuits, protein complexes, developmental dependencies, metabolic pathway connections — all adapted to the current genomic state.
- **Why reversal cost grows**: Each new interaction partner is an entity that would malfunction on reversal. The fitness cost of removing a genomic feature is proportional to the number of other features that have adapted to depend on it.
- **R/d1 confirmation**: The genome's own evolutionary history constrains its future evolution through the interaction networks that build up around each committed feature. Each evolutionary step (gene duplication, intron insertion, endosymbiosis) creates new dependencies; those dependencies prevent reversal. The self-referential element: the genome's current state acts on its future state through the constraints imposed by accumulated co-adaptations.
- **Not trivial irreversibility**: A gene duplication is trivially reversible in principle (deletion). What makes it irreversible is that other genes have adapted to the duplicate's presence. Remove all co-adapted interaction partners and the deletion becomes neutral — proving the friction comes from dependency accretion, not from the mutation event itself.
- **Source**: `ocp:sep/reduction-biology` (trust: 0.674), `ocp:sep/evolution-cultural` (trust: 0.635, discusses cumulative ratchet in cultural context — structural parallel to genomic complexity ratchet)
- **Key references**: Muller (1964) "The Relation of Recombination to Mutational Advance"; Stoltzfus (1999) "On the Possibility of Constructive Neutral Evolution"; Lynch (2007) *The Origins of Genome Architecture*; Gray et al. (1999) on mitochondrial genome reduction and host-dependency lock-in; Doolittle (2012) "Is junk DNA bunk? A critique of ENCODE"

---

## New Instance 6: Law — Precedent Dependency Networks

- **Domain**: Common Law / Jurisprudence
- **Expression**: In common law systems, a judicial decision creates a precedent. Subsequent cases cite the precedent, distinguish it, extend it, and build doctrinal structures on top of it. Each citing case adds a dependency: a legal argument that assumes the precedent's holding. Overruling a precedent does not merely undo one decision — it destabilizes every case that relied on it, requiring courts to re-examine the doctrinal chain built on the overruled foundation. This is why stare decisis (the doctrine of standing by prior decisions) is so powerful: the cost of overruling grows with the citation depth. A precedent cited by 3 cases can be overruled with modest disruption; a precedent woven into the fabric of an entire doctrinal area (e.g., *Roe v. Wade* with its 50 years of reliance interests, or *Erie Railroad v. Tompkins* as the foundation of federal-state procedural law) creates cascading uncertainty when overruled. The U.S. Supreme Court's explicit "reliance interests" analysis in *Planned Parenthood v. Casey* (1992) directly articulates the ratchet mechanism: the question is not whether the original decision was correct, but how many people and institutions have organized their conduct in reliance on it.
- **What accumulates**: Citing decisions, doctrinal frameworks, legal scholarship, institutional practices, statutory cross-references, and individual reliance — all adapted to the precedent's holding.
- **Why reversal cost grows**: Each citing case and each instance of institutional reliance adds an entity that would be disrupted by overruling. The disruption cost is proportional to the citation network depth and the breadth of reliance, not to the complexity of the original holding.
- **R/d1 confirmation**: The legal system's own decisional history constrains its future decisions through the citation networks that build up around each precedent. Each subsequent decision that relies on the precedent creates a new dependency; those dependencies feed back to make future reliance more likely (because the doctrine appears settled) and overruling more costly (because more would be disrupted). The self-referential loop: precedent creates reliance, reliance creates doctrinal structure, doctrinal structure creates more reliance.
- **Not trivial irreversibility**: The original holding can be reversed in a single opinion. What makes it costly is the downstream reliance network. A precedent with zero citations can be overruled without disruption — proving that the friction comes from dependency accretion (the citation/reliance network), not from the decision itself.
- **Source**: Domain knowledge (no direct OCP record; SEP entries on philosophy of law were not in the scrape batch). Strong structural parallel to the software API instance — citation networks are to legal precedent what dependency graphs are to public APIs.
- **Key references**: *Planned Parenthood v. Casey*, 505 U.S. 833 (1992) (reliance interests analysis); *Dobbs v. Jackson Women's Health*, 597 U.S. 215 (2022) (overruling despite deep reliance network — illustrating the cost); Landes & Posner (1976) "Legal Precedent: A Theoretical and Empirical Analysis" *Journal of Law and Economics*; Llewellyn (1930) "The Bramble Bush"

---

## Cross-Instance Structural Analysis

| # | Domain | What Accumulates | Feedback Mechanism | Reversal Cost Grows Because |
|---|--------|-----------------|-------------------|---------------------------|
| 1 | Political Science | Constituencies, procedures | Agency creates stakeholders who resist dissolution | More stakeholders = harder to dismantle |
| 2 | Info Theory / Linguistics | Compounds, idioms, collocations | Arbitrary binding gets built upon | More derived forms = costlier to re-bind |
| 3 | Software Engineering | Downstream consumers, build scripts | API publication attracts integrators | Larger dependency graph = costlier to change |
| 4 | Economics | Complementary assets, supply chains | Adoption triggers infrastructure investment | More complementary investment = costlier to switch |
| 5 | Biology | Interaction partners, regulatory circuits | Gene presence attracts co-adapted partners | More co-adaptations = costlier to delete |
| 6 | Law | Citing cases, reliance interests | Precedent attracts doctrinal construction | Deeper citation network = costlier to overrule |

### Structural Invariant

All six instances share the same three-part structure:

1. **Forward step**: A change is made (agency created, sign bound, API published, technology adopted, gene duplicated, precedent set).
2. **Dependency accretion**: Other entities adapt to the new state (constituencies form, compounds build, consumers integrate, complementary assets invest, interaction partners co-evolve, cases cite).
3. **Asymmetric friction**: Reversal requires coordinated undoing across all adapted entities, while forward continuation only requires the original actor.

The cost asymmetry is always between the original change (one actor, one decision) and reversal (coordinated action across all entities that adapted to the change).

### Why This Is R/d1 (Recurse, First-Order)

The recursion is first-order: the system's state at time t constrains its state at time t+1 through the dependencies accumulated between t-1 and t. The system's history acts on its future — that is the self-referential element. It is not merely that "things are hard to undo" (which would be a non-recursive observation); it is that "the act of doing creates the conditions that make undoing harder" (which is a first-order recursive feedback loop).

The derivative order is 1 (not 0, not 2) because:
- d0 would be static self-reference (the system IS self-referential). The ratchet is dynamic — it involves change over time.
- d2 would require the ratchet mechanism itself to change (a ratchet on ratchets). These instances describe a stable ratchet mechanism, not a meta-ratchet.
- d1 is correct: the rate of change is constrained by accumulated state. Each step changes the derivative (the ease of future steps) — that is first-order.

---

## Promotion Assessment

### Tier 1 Criteria

| Criterion | Required | Status |
|-----------|----------|--------|
| 2+ unrelated domain instances | 2 | **6 (PASS)** — Political Science, Info Theory/Linguistics, Software Engineering, Economics, Biology, Law |

### Confidence Score

- New motif created: 0.1
- 5 additional domain instances (beyond first): +0.5
- Triangulation (top-down prediction confirmed by bottom-up scrape): +0.2
- **Proposed confidence**: **0.8**

### Strength Assessment

- **Strongest instances**: Software Engineering (API dependency graphs — concrete, measurable, well-documented in OCP) and Economics (Arthur's increasing returns — formally modeled, extensively studied).
- **Strong instances**: Biology (genomic complexity ratchet — supported by Lynch, Stoltzfus, and the endosymbiosis literature) and Law (precedent citation networks — explicitly articulated by the Supreme Court in *Casey*).
- **Previously existing**: Political Science (institutional path dependence) and Info Theory/Linguistics (arbitrary binding ossification) remain well-grounded.

### Adversarial Notes

1. **Economics instance vs. existing Political Science instance**: These are closely related — institutional path dependence is sometimes framed as a special case of economic lock-in. However, the mechanisms differ: political institutions accrete constituencies (people with interests), while technology markets accrete complementary assets (capital investments). The feedback loops are structurally similar but operate through different substrates. Acceptable as separate domains per schema (different disciplinary literatures, different formal models).

2. **Trivial irreversibility risk**: The strongest defense against "this is just things that are hard to undo" is the zero-consumer test: in every instance, removing the dependency network makes reversal cheap. An API with no consumers, a technology with no complementary assets, a gene with no interaction partners, a precedent with no citations — all are trivially reversible. The friction is always in the dependency accretion, not in the change itself.

3. **Liebowitz & Margolis critique**: Their distinction between first-degree (no real inefficiency), second-degree (unpredictable inefficiency), and third-degree (correctable inefficiency) path dependence is worth noting. The R/d1 motif captures the structural mechanism regardless of whether the lock-in is efficient or inefficient — it is a description of dynamics, not a normative claim.

---

## Recommendation

Promote Ratchet with Asymmetric Friction from Tier 0 to Tier 1. Update domain count to 6 and confidence to 0.8. The motif has 6 cross-domain instances across genuinely distinct domains, all exhibiting the same three-part structure (forward step, dependency accretion, asymmetric friction). Tier 2 candidacy is viable pending validation protocol pass and Adam's approval.

**This file is a candidate only. Do NOT modify the existing motif file without Adam's approval.**
