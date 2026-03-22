---
title: "Trust-as-Curation — Alien Domain Testing (Biology, Economics, Game Theory)"
date: 2026-03-22
status: draft
source: ocp-scraper (SEP, GitHub) + domain analysis
target_motif: trust-as-curation
target_gap: "alien domain testing in biology, economics, game theory"
existing_domains: 8
---

# Trust-as-Curation — Alien Domain Testing (Biology, Economics, Game Theory)

## Scrape Infrastructure

### Queries Executed

**SEP (Stanford Encyclopedia of Philosophy):**
1. "immune system recognition self tolerance adaptive" — 5 records indexed (recognition, self-consciousness, self-knowledge, self-reference, self-deception)
2. "market reputation mechanism design auction" — 5 records indexed (game-theory, contractarianism-contemporary, friedrich-hayek, justice-distributive, markets)
3. "symbiosis mutualism cooperation biological recognition" — 5 records indexed (recognition, biology-individual, altruism-biological, information-biological, theories-biological-development)
4. "credit rating financial reputation assessment" — 5 records indexed (money-finance, scientific-knowledge-social, it-moral-values, luxemburg, bounded-rationality)
5. "signaling game costly signal honest communication" — 5 records indexed (animal-communication, game-theory, game-evolutionary, game-ethics, implicature-optimality-games)

**GitHub:**
1. "reputation scoring marketplace trust rating" (min 10 stars) — 5 records indexed (public-apis, awesome-selfhosted, awesome-mcp-servers, modelcontextprotocol-servers, awesome-openclaw-skills)
2. "immune system simulation adaptive recognition" (min 5 stars) — 5 records indexed (awesome-machine-learning, awesome-courses, ml-papers-of-the-week, awesome-single-cell, fuzzingpaper)
3. "credit scoring machine learning risk assessment" (min 5 stars) — 5 records indexed (awesome-mcp-servers, modelcontextprotocol-servers, devops-exercises, awesome-openclaw-skills, awesome-osint)

**Records inspected in detail:** `ocp:sep/biology-individual` (trust 0.695), `ocp:sep/recognition` (trust 0.55), `ocp:sep/markets` (trust 0.574), `ocp:sep/game-evolutionary` (trust 0.518), `ocp:sep/animal-communication` (trust 0.541), `ocp:sep/money-finance` (trust 0.682).

**Index searches:** "trust earned credibility reputation graduated continuous", "immune tolerance self recognition adaptive graduated response", "reputation mechanism market trust signaling" — all returned 0 results (index sparse on these cross-cutting queries).

**Total:** 40 records processed across SEP and GitHub. 5 SEP entries inspected in depth.

---

## Domain Analysis

### Domain 1: Biology — Adaptive Immune System

#### Background

The immune system is the canonical biological recognition system. The traditional model (Burnet 1959) is a **binary self/non-self** discriminator: self-antigens are tolerated, non-self-antigens trigger attack. This binary model would NOT be TaC — it is precisely the kind of binary access control that TaC replaces.

However, modern immunology has moved substantially beyond the binary model:

**Danger Model (Matzinger 1994, 2002):** The immune system does not respond to "non-self" per se but to "danger signals" — molecular patterns associated with tissue damage, stress, or pathology. The response is graduated: the intensity, type, and duration of immune response scale with the strength and context of danger signals. A harmless foreign substance (e.g., food protein) that presents no danger signals is tolerated, even though it is "non-self."

**Tunable Activation Thresholds (Grossman & Paul 1992):** T-cells dynamically adjust their activation thresholds based on the antigenic environment. Cells in a high-stimulation environment raise their thresholds; cells in low-stimulation environments lower them. This means the same antigen can trigger different response levels depending on context — a graduated, continuous response, not binary.

**Immune Memory and Affinity Maturation:** B-cells undergo somatic hypermutation and clonal selection, producing antibodies with progressively higher affinity for recognized antigens. This is trust earned through demonstrated reliability: antibodies that successfully bind pathogens are amplified (clonal expansion); those that fail are eliminated. The system retains memory cells — high-trust templates that enable faster, stronger responses to previously encountered threats.

**Regulatory T-cells (Tregs):** Tregs actively suppress immune responses against self-antigens and harmless foreign antigens (commensals, food). This is not binary tolerance but active, calibrated suppression — the immune system curates which responses are permitted and which are damped, based on learned experience.

#### Structural Test

| Test | Result | Evidence |
|------|--------|----------|
| 1. Trust EARNED through demonstrated reliability? | **YES** | Affinity maturation: antibodies earn amplification by binding successfully. Memory cells earn retention by having responded to real threats. Tregs earn suppressive authority by correctly identifying harmless antigens. |
| 2. Trust CONTINUOUS (not binary)? | **PARTIAL** | The Danger Model and tunable thresholds produce graduated responses. However, the effector phase is still substantially binary at the individual cell level (activate/don't activate). The graduation occurs at the population/system level through response magnitude, duration, and type selection. |
| 3. Trust determines CURATION? | **YES** | Trust (accumulated immune memory + affinity-matured antibodies) determines what enters the response repertoire and how prominently it features. High-affinity antibodies are amplified in the response; low-affinity variants are culled. Memory cells curate future responses by biasing toward previously validated threats. |
| 4. Replaces binary access control? | **PARTIAL** | Modern immunology has moved beyond binary self/non-self, but the binary substrate remains influential. The graduated system overlays but does not fully replace the binary discrimination. The MHC self-presentation system is still fundamentally binary (self-MHC recognized / foreign-MHC attacked). |
| 5. Gameability (falsification)? | **YES — partially triggered** | Pathogens game the immune trust system routinely: molecular mimicry (presenting self-like antigens to evade detection), immune evasion (HIV, cancer cells downregulating MHC), autoimmune disorders (the system's trust calibration fails, attacking self). This is a known failure mode. |

#### Assessment

**Match strength: 0.55** — The adaptive immune system implements a graduated trust-as-curation pattern at the systems level (affinity maturation, memory cell curation, Treg-mediated tolerance calibration), but the binary self/non-self substrate persists at lower levels. The pattern is present but structurally mixed — a graduated system built on top of a binary foundation. The gameability concern is real (molecular mimicry, immune evasion) but the system has evolved counter-measures (co-evolution of recognition mechanisms), so it is not trivially gameable.

**Domain novelty:** HIGH — biology is genuinely alien to all existing TaC instances.

**Key tension:** The immune system is better described as "graduated trust layered on binary recognition" than as "graduated trust replacing binary access control." The TaC motif specifies *replacing* binary access control, but the immune system *extends* it. This is a partial structural match.

---

### Domain 2: Economics — Market Reputation Systems

#### Background

Market reputation systems are arguably the most direct real-world implementations of trust-as-curation in economics. The OCP scrape surfaced `ocp:sep/markets` (trust 0.574), which discusses markets as institutions for exchange, including the role of reputation, information asymmetry, and institutional design.

**Platform Reputation Systems (eBay, Uber, Airbnb, Amazon Marketplace):**

These platforms implement precisely the TaC pattern:
- **Earned trust:** Sellers/drivers/hosts earn reputation through completed transactions, customer ratings, and demonstrated reliability. New participants start with no reputation and must build it.
- **Continuous scoring:** 5-star ratings, percentage positive feedback, response rates — all continuous, not binary.
- **Trust determines curation:** Search rankings, "Superhost" badges, Buy Box eligibility, and recommendation placement are all determined by reputation scores. High-trust sellers are surfaced prominently; low-trust sellers are buried or excluded from featured placement.
- **Replaces binary access control:** Any seller can list on the platform (no binary gatekeeping), but reputation determines visibility and priority. The platform curates through trust, not access control.

**Credit Scoring Systems (FICO, credit bureaus):**

- **Earned trust:** Credit scores are earned through demonstrated repayment reliability over time.
- **Continuous scoring:** FICO ranges from 300-850 — paradigmatically continuous.
- **Trust determines curation:** The credit score determines which financial products a borrower can access, at what interest rates, and with what terms. It curates the financial system's response to an individual.
- **Replaces binary access control:** The system does not use binary creditworthy/not-creditworthy. Instead, graduated scores determine graduated access — prime rates, subprime rates, required collateral levels, credit limits.

**Bond Rating Systems (Moody's, S&P, Fitch):**

- **Earned trust:** Bond issuers earn ratings based on demonstrated financial health, repayment history, and structural risk factors.
- **Continuous (ordinal) scoring:** AAA through D — a graduated scale with ~20 levels, not binary.
- **Trust determines curation:** Institutional investors often have mandates requiring minimum ratings. Bond ratings determine which fixed-income products enter portfolios and at what allocation levels. Low-rated bonds are excluded from many institutional portfolios.
- **Replaces binary access control:** Graduated ratings determine graduated investment terms, not binary invest/don't-invest.

#### Structural Test

| Test | Result | Evidence |
|------|--------|----------|
| 1. Trust EARNED through demonstrated reliability? | **YES** | Platform ratings: earned through transaction completion. Credit scores: earned through repayment history. Bond ratings: earned through financial performance. All three require demonstrated track record. |
| 2. Trust CONTINUOUS (not binary)? | **YES** | 5-star ratings, 300-850 FICO scores, AAA-D bond ratings — all continuous or finely graduated ordinal scales. |
| 3. Trust determines CURATION? | **YES** | Platform rankings sort by reputation. Credit scores determine product access and pricing. Bond ratings determine portfolio inclusion. Trust directly curates what enters and at what prominence. |
| 4. Replaces binary access control? | **YES** | Platform listings are open to all (no binary gate); reputation determines visibility. Credit markets offer graduated terms, not binary approve/deny. Bond markets tier by rating, not binary include/exclude. |
| 5. Gameability (falsification)? | **YES — partially triggered** | Review fraud on platforms (fake reviews, review bombing). Credit score manipulation (authorized user piggybacking, strategic defaults). Rating agency capture (the 2008 financial crisis: agencies gave AAA ratings to subprime mortgage securities under issuer pressure). Gameability is a known and serious vulnerability. |

#### Assessment

**Match strength: 0.80** — Market reputation systems are arguably the strongest TaC instance found across any domain. All four structural tests pass cleanly. The pattern is not merely analogous — it is the exact mechanism described by the motif: continuous earned credibility replacing binary access control, determining what enters the system and how prominently it features.

**Domain novelty:** HIGH — Economics/Market Design is genuinely alien to all existing TaC instances.

**Key finding:** The gameability concern is significant. The 2008 financial crisis is a case study in TaC failure: when rating agencies were captured by issuers (trust gamed through payment relationships), the curation function catastrophically failed — AAA-rated securities defaulted, destroying the informational value of the trust system. This directly validates the TaC falsification condition: "if trust can be gamed easily without actual reliability, the curation function fails." The 2008 crisis is empirical confirmation that the falsification condition correctly identifies the motif's failure mode.

**Sub-instances identified:**
- **Economics/Platform Design** (eBay, Uber, Airbnb): match 0.85
- **Economics/Credit Scoring** (FICO, credit bureaus): match 0.80
- **Economics/Bond Ratings** (Moody's, S&P, Fitch): match 0.75 (lower due to demonstrated gameability in 2008)

---

### Domain 3: Game Theory — Costly Signaling

#### Background

The OCP scrape surfaced `ocp:sep/game-evolutionary` (trust 0.518), `ocp:sep/animal-communication` (trust 0.541), and `ocp:sep/game-theory` (trust 0.517). Game-theoretic signaling theory provides a formal framework for how agents establish credibility.

**Spence's Signaling Model (1973):**

In Spence's job market model, workers signal their unobservable ability by acquiring education. Education is costly, and the key insight is that it is *differentially* costly: high-ability workers find education less costly than low-ability workers. This differential cost makes the signal honest — only high-ability workers find it worth signaling. Employers learn to trust the signal because it is earned through costly investment, not merely claimed.

- **Earned trust:** The signal (education) earns credibility through demonstrated cost-bearing. Cheap talk is not trusted; costly signals are.
- **Continuous:** The level of education is continuous (years, degrees) and maps to a continuous credibility assessment. More education = higher inferred ability (within the model).
- **Determines curation:** The signal determines which candidates are hired and at what wage — it curates access to economic opportunities.
- **Replaces binary access control:** Instead of binary "qualified/not qualified," the signaling equilibrium produces a graduated mapping from signal level to inferred ability to employment terms.

**Handicap Principle (Zahavi 1975) — Biological Costly Signaling:**

The peacock's tail is the canonical example: a costly ornament that signals genetic fitness precisely because it is expensive to produce and maintain. Only genuinely fit males can afford the handicap. Females use the signal intensity to curate mate selection — more elaborate displays indicate higher fitness.

- **Earned trust:** The display earns credibility through its biological cost. Dishonest signaling is penalized by survival costs.
- **Continuous:** Display quality is continuous (tail size, brightness, symmetry). Response is graduated.
- **Determines curation:** Female mate choice is curated by signal quality — more trustworthy signals receive preferential mating access.
- **Replaces binary access control:** Not binary mate/don't-mate but graduated preference ordering based on signal quality.

**Repeated Game Reputation (Fudenberg & Levine 1989, Kreps & Wilson 1982):**

In repeated games, players build reputation through observed behavior over time. A player who consistently cooperates earns a reputation for cooperation, which determines how other players interact with them. This is the formal game-theoretic foundation for reputation systems.

- **Earned trust:** Reputation is earned through demonstrated cooperation over multiple rounds.
- **Continuous:** Bayesian belief updating produces continuous posterior probabilities over player types.
- **Determines curation:** Other players curate their strategies based on the target's reputation — cooperating with high-reputation players, defecting against low-reputation ones.
- **Replaces binary access control:** Not binary "cooperate/defect" partner selection but graduated strategy adjustment based on reputation.

#### Structural Test

| Test | Result | Evidence |
|------|--------|----------|
| 1. Trust EARNED through demonstrated reliability? | **YES** | Costly signals earn credibility through demonstrated cost-bearing. Repeated-game reputation earned through demonstrated cooperation. Both require track record, not authority. |
| 2. Trust CONTINUOUS (not binary)? | **YES** | Signal intensity is continuous. Bayesian posterior beliefs are continuous. Graduation is a formal property of the models. |
| 3. Trust determines CURATION? | **PARTIAL** | In signaling models, trust determines access (hiring, mate selection) and terms (wages, mating priority). But the "curation" framing is somewhat strained — the models describe *selection* more than *curation*. The curating agent is making choices, not organizing a system. |
| 4. Replaces binary access control? | **PARTIAL** | Signaling models produce separating or pooling equilibria. Separating equilibria can be binary (signal/don't signal divides the population into two groups). The continuous graduation exists within the model but the equilibrium outcome can collapse to binary separation. |
| 5. Gameability (falsification)? | **Structurally addressed** | The entire theory of costly signaling exists precisely because cheap signals ARE gameable. Costly signaling theory explains how systems evolve to resist gaming — by making signals expensive to fake. This is a theoretical framework for the TaC falsification condition itself. |

#### Assessment

**Match strength: 0.60** — Game-theoretic signaling provides the formal theoretical foundation for why trust-as-curation works (and when it fails). Costly signaling theory explains the mechanism by which earned trust resists gaming. However, the "curation" dimension is weaker than in market reputation systems — signaling models describe selection decisions more than system-level curation. The repeated-game reputation literature maps more cleanly to TaC than the one-shot signaling models.

**Domain novelty:** HIGH — Game Theory is genuinely alien to existing TaC instances.

**Key finding:** Game theory provides the *theoretical explanation* for TaC rather than just another instance. Costly signaling theory explains *why* continuous earned credibility works as a curation mechanism — because the cost of signaling creates a reliable mapping from signal to quality. This is meta-structural: game theory doesn't just instantiate TaC, it explains the conditions under which TaC is stable (costly signals) vs. unstable (cheap signals). This is a deeper kind of confirmation than mere instance-counting.

---

## Cross-Instance Analysis

### Structural Comparison Across Three Alien Domains

| Feature | Biology (Immune) | Economics (Markets) | Game Theory (Signaling) |
|---------|-----------------|--------------------|-----------------------|
| Trust earned? | Yes (affinity maturation, memory) | Yes (transaction history, repayment) | Yes (costly signal, repeated cooperation) |
| Trust continuous? | Partial (system-level yes, cell-level mixed) | Yes (star ratings, FICO scores) | Yes (signal intensity, Bayesian posteriors) |
| Trust curates? | Yes (response repertoire selection) | Yes (ranking, pricing, portfolio inclusion) | Partial (selection more than curation) |
| Replaces binary? | Partial (extends rather than replaces) | Yes (graduated access replacing gatekeeping) | Partial (separating equilibria can be binary) |
| Gameability? | High (molecular mimicry, immune evasion) | High (fake reviews, rating capture) | Addressed theoretically (costly signal resistance) |

### Pattern Strength Ranking

1. **Economics/Market Reputation** (0.80) — cleanest structural match across all four tests
2. **Game Theory/Costly Signaling** (0.60) — provides theoretical foundation, weaker on curation dimension
3. **Biology/Adaptive Immune System** (0.55) — graduated trust present but layered on binary substrate

### Cross-Domain Convergence

The strongest finding is that all three alien domains independently converge on the same failure mode: **gaming**. The immune system is gamed by molecular mimicry. Market reputation is gamed by fake reviews and rating agency capture. Signaling is gamed by cheap talk. In all three cases, the system's response to gaming is to increase the cost of signaling: the immune system co-evolves more specific recognition; markets implement fraud detection; game theory predicts costly signaling equilibria.

This convergence on the gaming-resistance mechanism is itself evidence of structural depth. The TaC motif's falsification condition ("if trust can be gamed easily, the curation function fails") is not just a theoretical concern but a cross-domain empirical regularity. Every instance of TaC faces gaming pressure, and the robustness of the pattern depends on the cost of dishonest signaling.

---

## Falsification Check

The TaC falsification condition states: "If trust can be gamed easily without actual reliability, the curation function fails."

**Status across alien domains:**

- **Biology:** Partially triggered. Pathogens routinely game immune recognition, but the system has evolved counter-measures. The arms race is ongoing; neither side wins permanently. TaC persists despite gaming because the cost of evasion is high (pathogens must invest in mimicry/evasion machinery).

- **Economics:** Partially triggered. The 2008 financial crisis is a case study in TaC failure through rating agency capture. eBay/Amazon review fraud is ongoing. However, platform reputation systems continue to function because gaming is costly enough (account creation costs, detection algorithms) that the signal-to-noise ratio remains positive.

- **Game Theory:** Structurally addresses the concern. Costly signaling theory exists precisely to explain when trust signals resist gaming (costly signals) and when they fail (cheap talk). This domain provides the theoretical framework for the falsification condition itself.

**Overall:** The falsification condition is partially triggered in all three domains but not fatally. The pattern persists when gaming is costly; it degrades when gaming is cheap. This is consistent with the existing X algorithm instance (Instance 8) where gameability through engagement farming partially degrades the pattern.

**Refined falsification criterion:** TaC is robust when the cost of dishonest signaling exceeds the benefit of gaming. It degrades proportionally as gaming costs decrease. The pattern is not binary-present/absent but exists on a spectrum of robustness determined by the gaming cost ratio.

---

## Confidence Impact Assessment

### Before This Analysis

- **Domain count:** ~8 (Protocol Design, Software Architecture, Industry/Policy, Knowledge Architecture, Epistemology, Social Epistemology, Philosophy of Science, Platform Engineering)
- **Confidence:** 0.6 (after batch 2 triangulation pass)
- **Source diversity:** Mixed (4 top-down, 4 bottom-up from batch 2)
- **Alien domain coverage:** Epistemology, Social Epistemology, Platform Engineering (all humanities/tech)

### After This Analysis

- **New domains tested:** 3 (Biology, Economics/Market Design, Game Theory)
- **New instances confirmed:** 1 strong (Economics, 0.80), 1 moderate (Game Theory, 0.60), 1 weak-moderate (Biology, 0.55)
- **Domain count if accepted:** 10-11 (adding Economics as strong, Game Theory as moderate, Biology as partial)
- **Domain diversity expanded:** Now spans humanities, social sciences, natural sciences, formal sciences, and technology

### Proposed Confidence Adjustment

Current: 0.6 -> Proposed: **0.70**

Rationale:
- +0.05 for Economics/Market Reputation — strong alien-domain instance, cleanest structural match of any TaC instance found so far
- +0.03 for Game Theory/Costly Signaling — provides theoretical foundation for why TaC works, moderate structural match
- +0.02 for Biology/Immune System — partial match that extends domain range to natural sciences, despite structural tensions
- Net: +0.10

This would bring TaC to confidence 0.70, meeting the threshold for **Tier 2 promotion candidacy**.

### Tier 2 Promotion Case

With 10-11 domains spanning humanities, social sciences, natural sciences, formal sciences, and technology, and with both top-down and bottom-up instances confirmed, TaC has the strongest cross-domain coverage of any motif in the library. The Economics/Market Reputation instance is arguably the strongest single instance of any motif — the structural isomorphism is near-perfect.

The gameability concern, rather than weakening the motif, actually strengthens it: the falsification condition is empirically validated across multiple domains, and the conditions under which TaC fails (cheap gaming) vs. persists (costly signaling) are now well-characterised.

---

## Recommendations

**Sovereignty gate: NO modifications to existing motif files.**

### For Adam

1. **Economics/Market Reputation** is the strongest finding. Platform reputation systems (eBay, Uber, Airbnb) implement TaC with near-perfect structural isomorphism. Recommend adding as a primary instance. The 2008 financial crisis as a TaC failure case study is particularly valuable for the falsification analysis.

2. **Game Theory/Costly Signaling** provides the theoretical foundation for TaC. It explains *why* the pattern is stable (costly signals resist gaming) and *when* it fails (cheap signals). Consider adding as a "theoretical foundation" instance rather than a standard domain instance — it is meta-structural.

3. **Biology/Adaptive Immune System** is a partial match. The graduated trust pattern exists at the systems level (affinity maturation, Treg calibration, memory cells) but is layered on a binary substrate (self/non-self MHC recognition). If included, should be flagged as a "partial instance" with the structural tension noted.

4. **Tier 2 promotion:** If Economics is accepted, TaC reaches 0.70 confidence with 10+ domains. This meets the threshold for Tier 2 candidacy. Adam's decision whether to promote.

5. **Falsification refinement:** The gaming cost ratio (cost of dishonest signal vs. benefit of gaming) could be formalised as a parameter of TaC robustness. This would convert the binary falsification condition into a continuous measure — which is, itself, an instance of the TaC pattern applied to its own evaluation.

### Future Targets

- **Law/Jurisprudence:** Precedent-based legal reasoning as trust-as-curation (established precedents earn higher authority through demonstrated applicability)
- **Ecology:** Mycorrhizal networks where nutrient exchange is calibrated to partner reliability (recent research on "sanctions" against cheating partners)
- **Neuroscience:** Bayesian brain predictive processing where priors earn credibility through prediction accuracy
