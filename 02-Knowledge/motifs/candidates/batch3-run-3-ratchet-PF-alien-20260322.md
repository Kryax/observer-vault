---
title: "Ratchet + Progressive Formalization — Game Theory and Ecology Alien Domains"
date: 2026-03-22
status: draft
source: ocp-scraper (SEP, GitHub) + domain analysis
target_motifs: [ratchet-with-asymmetric-friction, progressive-formalization]
target_gap: "alien domain testing in game theory and ecology"
---

# Ratchet + Progressive Formalization — Game Theory and Ecology Alien Domains

## Objective

Test two motifs against two alien domains:

- **Ratchet with Asymmetric Friction** (10 confirmed domains + 1 partial) against game theory and ecology
- **Progressive Formalization** (8 confirmed domains) against game theory and ecology

Ratchet definition: "A system where each state change accumulates dependencies that make reversal disproportionately costlier than the original change, producing directional drift."

PF definition: "Material passes through stages of increasing structural order, with each stage preserving essential content while adding constraint and operational accessibility."

## Scrape Summary

| Query | Source | Processed | Indexed | Key Records |
|-------|--------|-----------|---------|-------------|
| game theory strategy equilibrium commitment | SEP | 10 | 10 | game-theory, game-evolutionary, epistemic-game, game-ethics, decision-theory |
| ecological succession climax community | SEP | 10 | 10 | ecology, conservation-biology, biodiversity, evolution-development |
| evolutionary game theory cooperation defection | SEP | 10 | 10 | game-evolutionary, game-theory, epistemic-game, morality-biology |
| ecological niche construction path dependence | SEP | 10 | 10 | ecology, ecological-genetics, evolution-development, inheritance-systems |
| game theory commitment mechanism irreversibility | SEP | 10 | 10 | game-theory, game-evolutionary, decision-theory, decision-causal |
| game theory simulation evolutionary dynamics | GitHub | 10 | 10 | MARL-Papers (4764 stars), cs-video-courses |
| ecological modeling succession simulation | GitHub | 4 | 2 | MayaSim (12 stars) |
| **Totals** | | **64** | **62** | |

Key SEP records inspected in depth: game-theory, game-evolutionary, epistemic-game, ecology, conservation-biology.

---

## Domain 1: Game Theory

### 1A. Ratchet with Asymmetric Friction in Game Theory

#### Candidate Instance: Commitment Devices and Reputation Lock-In

**Description:** In repeated games, a player who commits to a strategy (e.g., tit-for-tat, or a reputation for toughness) creates a ratchet effect. Other players adapt their strategies around the commitment. As the interaction history lengthens, the committed player accumulates "reputation capital" — opponents have calibrated their behaviour to the commitment. Switching strategy now requires not only the cost of the switch itself but the cost of opponents' adjustment period, potential punishment phases, and loss of cooperative surplus built on the reputation.

**Structural Test:**

| Criterion | Assessment | Pass? |
|-----------|------------|-------|
| 1. Forward step exists | YES. A player commits to a strategy (e.g., always cooperate in tit-for-tat, or signal toughness in bargaining). This is a discrete, identifiable state change. | YES |
| 2. Dependencies accrete around committed state | YES. Other players adapt: they cooperate with tit-for-tat players, avoid challenging tough negotiators. These adaptations constitute dependencies — the entire strategic landscape reshapes around the commitment. In evolutionary game theory, population composition shifts toward strategies that perform well against the committed type (ESS). | YES |
| 3. Reversal disproportionately costlier, growing with dependency count | YES. Abandoning tit-for-tat after 100 rounds of mutual cooperation is far costlier than after 5 rounds. The longer the reputation, the more opponents have invested in complementary strategies. Switching triggers punishment phases (grim trigger), loss of trust premiums, and potential cascading defection as other players scramble to re-adapt. In Schelling's commitment theory, deliberately burning bridges (destroying your own option to retreat) is the ultimate ratchet — reversal is made infinitely costly by design. | YES |
| 4. Zero-consumer test: remove dependencies, reversal is cheap | YES. In a one-shot game with no history and no adapted opponents, switching strategy costs nothing — you simply choose differently. The asymmetric friction arises entirely from accumulated relational dependencies. If you could wipe all opponents' memories and reset population frequencies, strategy change would be free. | YES |

**Ratchet Score: 4/4 — FULL MATCH**

#### Candidate Instance: Escalation in Commitment Games (Dollar Auction)

**Description:** In Shubik's dollar auction, two bidders bid for a dollar, but both the highest and second-highest bidder pay their bid. Once bidding begins, each incremental bid creates a dependency: the second-highest bidder must bid higher to avoid losing their sunk cost. Each step forward makes retreat more expensive because the already-spent amount grows. The game produces irrational escalation precisely because the ratchet mechanism converts each forward step into a dependency that raises reversal cost.

**Structural Test:**

| Criterion | Assessment | Pass? |
|-----------|------------|-------|
| 1. Forward step | YES. Each bid increment is a discrete forward step. | YES |
| 2. Dependency accretion | YES. The sunk cost of the current bid constitutes a dependency — it cannot be recovered. Each bid adds to the total sunk cost. | YES |
| 3. Asymmetric reversal cost, growing | YES. After bidding $0.50, walking away costs $0.50. After bidding $0.90, walking away costs $0.90. Reversal cost grows linearly with commitment depth. Moreover, the opponent's matching bids create mutual dependencies — each player's sunk cost pressures the other to continue. | YES |
| 4. Zero-consumer test | YES. If sunk costs could be refunded (dependencies removed), the auction would stop immediately — no rational player would continue. The ratchet operates entirely through accumulated, irrecoverable dependencies. | YES |

**Ratchet Score: 4/4 — FULL MATCH**

#### Candidate Instance: Evolutionary Stable Strategies (ESS) and Basin Lock-In

**Description:** In evolutionary game theory, once a population reaches an ESS, the population composition itself creates a ratchet. Mutant strategies entering a population at an ESS are selected against because the entire population is adapted to the incumbent strategy. The more thoroughly the population has converged on the ESS, the stronger the selection pressure against alternatives.

**Structural Test:**

| Criterion | Assessment | Pass? |
|-----------|------------|-------|
| 1. Forward step | YES. Population drifts toward a particular strategy mix. | YES |
| 2. Dependency accretion | YES. As the ESS becomes prevalent, fitness landscapes reshape — strategies that work well against the ESS thrive, strategies that don't are eliminated. The population's strategic diversity narrows around the ESS. | YES |
| 3. Asymmetric reversal cost, growing | YES. Invading an ESS requires overcoming increasingly strong selection pressure. A single mutant in a population of 1000 ESS-players faces far worse odds than in a population of 10. The basin of attraction deepens with population size and convergence. | YES |
| 4. Zero-consumer test | PARTIAL. If you could simultaneously reset the entire population to maximum diversity (removing all frequency-dependent dependencies), any strategy could invade freely. However, the ESS property is defined precisely by resistance to invasion, which is structural rather than purely dependency-based. A true ESS remains stable even against a small fraction of mutants — the "dependencies" are partially inherent in the payoff structure, not only in accumulated history. | 0.7 |

**Ratchet Score: 3.7/4.0 — STRONG MATCH**

**Assessment:** Game theory is a strong ratchet domain. The pattern appears in at least three structurally distinct instances: reputation/commitment lock-in, escalation games, and ESS basin dynamics. The commitment device literature (Schelling 1960, Ainslie 1992) is essentially a formalization of the ratchet mechanism — "how do you make your forward step irreversible to gain strategic advantage?" The zero-consumer test cleanly distinguishes ratchet from mere path dependence in game theory: remove the accumulated strategic dependencies (opponents' adaptations, sunk costs, population frequencies) and reversal becomes cheap.

**Verdict: CONFIRMED — game theory is a valid domain for the ratchet motif.**

---

### 1B. Progressive Formalization in Game Theory

#### Candidate Instance: Strategy Development from Intuition to Mechanism Design

**Description:** Game-theoretic reasoning follows a PF trajectory that is both historically visible and recapitulated by individual learners:

1. **Amorphous stage (intuition/folk strategy):** Players have informal intuitions about strategic interaction. Socrates at Delium reasons informally about whether to stay and fight (as described in SEP game-theory entry — pre-formal strategic reasoning). Traders negotiate by feel. Children develop sharing norms.

2. **Heuristic stage (rules of thumb):** "Don't bid against yourself." "Match your opponent's cooperation." "Never make a threat you won't carry out." These are structured but not formally grounded — they capture strategic insight in operational form without proving optimality.

3. **Formal equilibrium stage (Nash, ESS, subgame perfection):** The heuristics are formalized into rigorous solution concepts. Tit-for-tat is proved to be an ESS. Nash equilibrium is shown to always exist (with mixed strategies). Subgame perfection eliminates non-credible threats. The informal insight ("match cooperation") is now a theorem.

4. **Mechanism design stage (reverse engineering the game):** The culmination — instead of solving a given game, the formalized theory enables designing games (auctions, voting rules, matching markets) that produce desired outcomes. The original folk intuition ("fair allocation") is now implementable as a formal mechanism (Vickrey auction, deferred acceptance algorithm).

**Structural Test:**

| Criterion | Assessment | Pass? |
|-----------|------------|-------|
| 1. Genuinely distinct stages of increasing formality | YES. The four stages are clearly differentiated: intuition has no formal structure, heuristics have operational rules without proof, equilibrium analysis has mathematical precision, and mechanism design has constructive power. Each stage is recognizably more formal than the previous. | YES |
| 2. Essential content survives across stages | YES. The insight that "cooperation can be sustained through reciprocity" survives from folk wisdom through tit-for-tat heuristic through ESS proof through mechanism design (repeated procurement auctions with reputation scoring). The content is preserved; the wrapper becomes increasingly precise. | YES |
| 3. Each stage adds constraint or accessibility | YES. Heuristics constrain behaviour relative to unconstrained intuition. Equilibrium analysis constrains the solution set (eliminates irrational outcomes). Mechanism design constrains the game structure itself. Each constraint simultaneously adds operational power — you can do more with a formal mechanism than with a folk heuristic. | YES |
| 4. Formalized version "remembers" amorphous origin (not lossy compression) | PARTIAL. The formal theory does reference its pre-formal origins — Nash equilibrium theory explicitly models "what rational players would intuitively choose." Mechanism design starts from intuitive desiderata (fairness, efficiency) and formalizes them. However, much of the richness of pre-formal strategic reasoning (emotional commitments, social context, bounded rationality) is deliberately excluded in the formalization. Behavioural game theory re-introduces these, suggesting the formal version was too lossy and needed correction. | 0.7 |

**PF Score: 3.7/4.0 — STRONG MATCH**

#### Candidate Instance: Epistemic Foundations (Formal Logic of Strategic Knowledge)

**Description:** The SEP epistemic-game entry reveals a second PF trajectory within game theory — the formalization of "what players know about each other":

1. **Amorphous:** Players have vague beliefs about opponents ("she's probably bluffing").
2. **Heuristic:** Common knowledge is invoked informally ("everyone knows the rules").
3. **Formal:** Aumann's common knowledge formalization (1976). Epistemic models with possible worlds, knowledge operators, belief hierarchies. Common knowledge of rationality as a formal concept.
4. **Constructive:** Interactive epistemology enables proving results about rational play purely from epistemic assumptions (e.g., iterated deletion of dominated strategies follows from common knowledge of rationality).

**Structural Test:** Passes criteria 1-3 cleanly. Criterion 4 (memory of origin): the formal apparatus explicitly models the informal concepts (belief, knowledge, common awareness) — the Kripke models "remember" the pre-formal intuitions about knowledge. Score: 3.8/4.0.

**Assessment:** Game theory is a strong PF domain. The historical trajectory from Socratic strategic intuition through von Neumann's formalization through modern mechanism design is a textbook PF sequence. The epistemic foundations literature provides a second, independent PF trajectory within the same domain. The partial score on criterion 4 reflects a genuine tension in PF — formalization must necessarily compress, and the question is whether it compresses too much. Behavioural game theory's critique that formal models lose essential pre-formal content (bounded rationality, emotions) is precisely the PF "lossy compression" warning.

**Verdict: CONFIRMED — game theory is a valid domain for progressive formalization.**

---

## Domain 2: Ecology

### 2A. Ratchet with Asymmetric Friction in Ecology

#### Candidate Instance: Ecological Succession and Soil Development

**Description:** Primary ecological succession (bare rock to climax community) creates a ratchet through soil development. Pioneer species (lichens, mosses) break down rock into thin soil. Intermediate species (grasses, shrubs) add organic matter, deepen soil, and modify moisture and nutrient cycling. Each successional stage creates physical and chemical dependencies — the soil that supports later-stage species cannot be produced without the biological activity of earlier stages, and the biological community that maintains the soil depends on the soil itself.

**Structural Test:**

| Criterion | Assessment | Pass? |
|-----------|------------|-------|
| 1. Forward step | YES. Each successional stage is a discrete community transition — pioneer to intermediate to mature forest. | YES |
| 2. Dependency accretion | YES. Soil depth, nutrient cycling, mycorrhizal networks, microclimate regulation, seed banks — each stage adds biological and physical dependencies. A mature forest floor has decades of accumulated organic matter, fungal networks connecting trees (the "wood wide web"), and moisture-retention properties that make reversal to bare rock virtually impossible under normal conditions. | YES |
| 3. Asymmetric reversal cost, growing | YES. Clearing a 5-year grassland requires moderate effort. Clearing a 50-year forest requires far more — root systems, soil structure, seed banks, and mycorrhizal networks all resist removal. Even after clear-cutting, the soil retains structure that promotes regrowth to intermediate rather than pioneer stage. Full reversal to bare rock requires catastrophic disturbance (volcanic activity, glaciation). The asymmetry between "one generation of tree growth" and "remove all accumulated soil and biological structure" is extreme. | YES |
| 4. Zero-consumer test | YES. A volcanic eruption that strips soil back to bare rock (removing all accumulated dependencies) resets the system to primary succession — exactly where it started. The Krakatoa eruption (1883) and Mount St. Helens (1980) provide natural experiments: where lava flow destroyed all accumulated biological and soil dependencies, primary succession began from scratch, confirming that reversal difficulty is proportional to accumulated dependency, not to some inherent irreversibility of the ecological state. | YES |

**Ratchet Score: 4/4 — FULL MATCH**

#### Candidate Instance: Niche Construction and Environmental Modification

**Description:** Organisms modify their environments in ways that create ratchet effects. Beaver dams restructure waterways, creating ponds that alter hydrology, sediment patterns, and species composition for the entire watershed. Earthworms transform soil structure. Coral reefs build physical substrate that supports entire ecosystems. Each modification creates dependencies — other species adapt to the modified environment, and the modifier species itself becomes dependent on its modifications.

**Structural Test:**

| Criterion | Assessment | Pass? |
|-----------|------------|-------|
| 1. Forward step | YES. Beaver builds dam, coral secretes calcium carbonate, earthworm processes soil. Each is a discrete environmental modification. | YES |
| 2. Dependency accretion | YES. A beaver pond attracts fish, waterfowl, insects, and aquatic plants, all of which depend on the pond. The beaver depends on the pond for protection and food access. Surrounding vegetation changes due to altered water table. Each year adds more dependent species and more physical modification. | YES |
| 3. Asymmetric reversal cost, growing | YES. Removing a 1-year beaver dam is straightforward. Removing a 20-year beaver pond requires draining, dredging accumulated sediment, re-establishing the original stream channel, and waiting for the altered vegetation and species composition to revert — which may take decades. The reversal cost includes not just removing the dam but undoing all accumulated downstream dependencies. | YES |
| 4. Zero-consumer test | YES. When beavers are removed from a watershed (the "consumer" of the dam is the beaver), the dam eventually breaches naturally. If the pond is young with few accumulated dependencies, the stream channel recovers quickly. If the pond is old with deep sediment, altered vegetation, and dependent species, recovery to pre-dam state takes years to decades. The test confirms: accumulated dependencies, not the dam itself, create the reversal cost. | YES |

**Ratchet Score: 4/4 — FULL MATCH**

#### Candidate Instance: Invasive Species Lock-In

**Description:** When an invasive species establishes, it modifies the environment to favour itself and disadvantage natives. Kudzu vine shades out competitors. Zebra mussels filter water, altering nutrient dynamics. Each generation of the invasive creates more physical and biological dependency — soil chemistry changes, native seed banks diminish, predators and pollinators adapt to the new species. Removal costs grow with each year of establishment.

**Structural Test:** Passes all four criteria. Forward step (introduction), dependency accretion (environmental modification, native displacement), growing reversal cost (eradication costs scale super-linearly with establishment time), zero-consumer test (in controlled island eradications, removing the invasive allows recovery, confirming dependencies were the source of lock-in). **Ratchet Score: 4/4.**

**Assessment:** Ecology is an exceptionally strong ratchet domain — arguably the strongest alien domain tested so far. The pattern appears in at least three structurally distinct instances (succession/soil, niche construction, invasive species), all of which pass the full structural test including the zero-consumer test. The ecological ratchet is distinguished by its physical materialisation — unlike game-theoretic ratchets where dependencies are informational/strategic, ecological ratchets involve literal accumulation of soil, biomass, and physical infrastructure.

**Verdict: CONFIRMED — ecology is a valid domain for the ratchet motif. Recommended for immediate inclusion.**

---

### 2B. Progressive Formalization in Ecology

#### Candidate Instance: Ecological Succession as Progressive Formalization

**Description:** Ecological succession itself — not just as a ratchet but as a PF process — moves through stages of increasing structural order:

1. **Amorphous stage (bare substrate):** No biological structure. Random colonization by whatever propagules arrive first. The essential "content" is the abiotic potential — mineral nutrients, sunlight, water availability.

2. **Pioneer stage (initial structure):** Lichens, mosses, ruderal plants impose minimal biological structure. Simple food webs, low species diversity, r-selected generalists. The abiotic potential is now partially organized into biological form.

3. **Intermediate stage (increasing complexity):** Shrubs, small trees, more complex food webs. Nutrient cycling becomes biologically mediated. Symbioses emerge (mycorrhizae). The ecosystem has recognizable structure — trophic levels, spatial stratification, seasonal rhythms.

4. **Climax/mature stage (high formalization):** Complex, stable community with elaborate structure — canopy layers, understorey, diverse trophic networks, tight nutrient cycling, high species diversity, K-selected specialists. The same essential content (mineral nutrients, sunlight, water) is now organized into a highly constrained, operationally sophisticated system.

**Structural Test:**

| Criterion | Assessment | Pass? |
|-----------|------------|-------|
| 1. Genuinely distinct stages | YES. Pioneer, intermediate, and climax communities are ecologically distinct — different species composition, different structural properties, different stability characteristics. Ecologists have debated the sharpness of stage boundaries (Clements' discrete stages vs. Gleason's continuum), but even continuum views acknowledge qualitative differences between early and late successional communities. | YES |
| 2. Essential content survives | YES. The fundamental ecological functions — energy capture, nutrient cycling, water regulation — are present at every stage. A pioneer lichen captures sunlight and cycles nutrients just as a mature forest does. The "essential content" (conversion of abiotic resources into biological organization) survives across all stages. | YES |
| 3. Each stage adds constraint/accessibility | YES. Each successional stage adds ecological constraints (tighter nutrient cycling, more specialized niches, more complex competitive and mutualistic interactions) and simultaneously increases operational accessibility (more diverse resource utilization, greater buffering against perturbation, more niches available for colonization). A mature forest is both more constrained (you can't easily add a novel species) and more operationally capable (it processes more energy, cycles nutrients more efficiently, supports more biomass). | YES |
| 4. Formalized version remembers amorphous origin | YES. This is where ecological PF is distinctive. Disturbance (fire, storm, clearing) can reset a mature ecosystem to an earlier successional stage — the system literally "remembers" its amorphous origin by retaining the capacity to re-traverse the PF trajectory. The pioneer species are still present as seeds, spores, or nearby colonizers. Unlike formal mathematical systems that cannot easily return to their pre-formal state, ecosystems retain explicit access to their earlier, less-formalized stages. This is PF with a rewind button. | YES |

**PF Score: 4/4 — FULL MATCH**

#### Candidate Instance: Community Assembly Rules — From Random Colonization to Deterministic Structure

**Description:** Island biogeography and community ecology show PF-like dynamics in how species communities assemble:

1. **Amorphous:** An empty habitat (new island, cleared plot) receives random colonizers. Which species arrive first is stochastic.
2. **Heuristic:** Early assembly follows simple priority effects — first arrivals dominate, creating rough "rules" of occupation, but these are contingent on arrival order.
3. **Structured:** As species accumulate, competitive interactions impose assembly rules (Diamond's forbidden combinations) — certain species pairs cannot coexist, creating deterministic constraints on community composition.
4. **Formalized:** Mature communities converge on predictable composition regardless of assembly history — the same habitat types produce recognizably similar communities worldwide (convergent evolution of community structure).

**Structural Test:** Stages are distinct (1-YES). Essential content (the available species pool and habitat capacity) survives (2-YES). Each stage adds constraint — from "anything can colonize" to "only these species combinations persist" (3-YES). Criterion 4 is partial — the stochastic origin is partially "forgotten" as communities converge, which is closer to lossy compression than PF's memory requirement. However, historical contingency effects (priority effects persisting in mature communities) suggest some "memory" survives. **PF Score: 3.5/4.0 — STRONG MATCH.**

**Assessment:** Ecology is a strong PF domain. Ecological succession maps onto PF with unusual completeness — all four criteria are met, and criterion 4 (memory of origin) is met more cleanly than in most formal-system domains because ecosystems literally retain access to earlier stages through disturbance-reset dynamics. Community assembly provides a second PF trajectory with slightly weaker criterion-4 performance.

**Verdict: CONFIRMED — ecology is a valid domain for progressive formalization.**

---

## Co-Occurrence Analysis

### Do Ratchet and PF Co-Occur in These Domains?

| Domain | Ratchet | PF | Co-occurrence? | Relationship |
|--------|---------|-----|----------------|--------------|
| Game Theory | YES (4/4, 3.7/4, 4/4 across 3 instances) | YES (3.7/4, 3.8/4 across 2 instances) | YES — CO-OCCURRING | **Coupled but distinct**: The ratchet describes *what happens* (commitment lock-in), while PF describes *how understanding of that lock-in develops* (intuition to formal theory). In mechanism design, the two merge: PF produces formal tools that are then used to *engineer* ratchets (auction design that locks in truthful revelation). |
| Ecology | YES (4/4 across 3 instances) | YES (4/4, 3.5/4 across 2 instances) | YES — CO-OCCURRING | **Temporally interleaved**: Ecological succession is *simultaneously* a ratchet (soil accumulation makes reversal costly) and a PF process (structural order increases through stages). Unlike game theory where the motifs apply to different aspects, in ecology the *same process* instantiates both motifs on the *same substrate*. This is the strongest co-occurrence observed. |

### Nature of the Co-Occurrence

The co-occurrence is **not accidental** but appears structurally related:

1. **PF creates the substrate for ratcheting.** As material becomes more formalized (more structured, more constrained), it accumulates the dependencies that make reversal costly. The increasing order of PF naturally generates the dependency accretion that powers the ratchet.

2. **Ratcheting preserves PF gains.** The asymmetric friction of the ratchet prevents the system from sliding back to earlier, less-formalized stages. The ratchet acts as a one-way valve that protects formalization progress.

3. **The relationship is not identity.** PF can occur without ratcheting (a mathematical proof can be "unformalized" — returned to intuitive form — at low cost; the formalization adds constraint but doesn't create dependencies that resist reversal). Ratcheting can occur without PF (the dollar auction escalation does not involve increasing structural order — it's just accumulating costs). But when both are present, they reinforce each other.

This suggests a potential **meta-motif**: PF-Ratchet coupling, where progressive formalization generates the dependency substrate that asymmetric friction then locks in. Ecology provides the cleanest instance; game theory provides the most analytically tractable one.

---

## Summary Table

| Domain | Motif | Score | Instances | Verdict |
|--------|-------|-------|-----------|---------|
| Game Theory | Ratchet | 4.0, 4.0, 3.7 | Commitment/reputation, dollar auction escalation, ESS basin lock-in | CONFIRMED |
| Game Theory | PF | 3.7, 3.8 | Strategy development trajectory, epistemic foundations formalization | CONFIRMED |
| Ecology | Ratchet | 4.0, 4.0, 4.0 | Succession/soil, niche construction, invasive species | CONFIRMED |
| Ecology | PF | 4.0, 3.5 | Succession as formalization, community assembly rules | CONFIRMED |

---

## Recommendations

### For Ratchet with Asymmetric Friction

1. **Add game theory and ecology as confirmed domains**, bringing the total from 10 (+ 1 partial) to **12 confirmed + 1 partial**.
2. Game theory is notable because it provides the most *analytically precise* description of the ratchet mechanism — Schelling's commitment theory is essentially a formal theory of deliberate ratchet construction.
3. Ecology is notable because it provides the most *physically tangible* ratchet instances — soil accumulation, biomass, physical structures. The zero-consumer test is validated by natural experiments (volcanic eruption resets).
4. Consider **Tier 2 promotion candidacy** — with 12 domains confirmed, the ratchet motif exceeds the threshold for cross-domain structural pattern.

### For Progressive Formalization

1. **Add game theory and ecology as confirmed domains**, bringing the total from 8 to **10 confirmed**.
2. Ecology's PF instance is unique in that it provides "PF with rewind" — the formalized stage retains explicit access to earlier stages via disturbance reset. This is a distinctive structural feature worth noting in the motif description.
3. Game theory's PF instance highlights the "lossy compression" risk — behavioural game theory's corrections to classical formalization suggest that PF can overshoot, losing essential content. This is useful diagnostic information for the motif.
4. Consider **Tier 2 promotion candidacy** — with 10 domains confirmed, PF also exceeds the threshold.

### For the Motif Library

1. **Document the PF-Ratchet co-occurrence pattern.** The observation that PF generates dependency substrates and ratcheting preserves PF gains suggests a structural coupling that may itself be a motif (or a relationship type between motifs).
2. Ecology's dual instantiation of both motifs on the same substrate (succession) is the strongest co-occurrence evidence found across any domain pair. This deserves a dedicated analysis note.

### Sovereignty Gate

No existing motif files were modified. All findings are recorded here as DRAFT candidates pending Adam's review.
