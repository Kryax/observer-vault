---
title: "Extended B Run 9: Kill-Ratio as Health Signal — T0 Expansion"
date: 2026-03-23
status: draft
target_motif: kill-ratio-as-health-signal
target_gap: "T0→T1 domain expansion (currently self-referential single domain)"
---

# Extended B Run 9: Kill-Ratio as Health Signal — T0→T1 Domain Expansion

## Status Assessment

Kill-Ratio as Health Signal (KRHS) is T0 with `domain_count: 1`, confidence 0.1. Its single instance is the Observer project itself — motif tier kills, document classification kills, PRD component discards. This is self-referential: the motif library is observing its own behaviour. For T1 promotion, we need 2+ *unrelated* domains, meaning at least 2 domains genuinely alien to software project development.

The motif's falsification conditions explicitly flag this risk: "If the pattern only applies to epistemic or creative systems and has no analog in engineering, biological, or economic systems, then it is domain-specific rather than structural."

## Structural Criteria for Instance Evaluation

The motif has three load-bearing components, all of which must be present in a valid instance:

1. **High kill ratio** — the system discards substantially more candidates than it retains
2. **Kill ratio tracked explicitly** — the ratio itself is monitored as a system-level metric, not just an incidental outcome
3. **Meta-knowledge accumulation** — the system learns from *what* it kills, not just *that* it kills; failure patterns feed back into candidate generation or evaluation

A domain where killing happens but is not tracked, or where the ratio is tracked but not used as a health signal, is a weak or false instance.

---

## New Domain Instances

### Instance 2: Adaptive Immunity — Thymic T-Cell Selection

- **Domain:** Immunology / Developmental Biology
- **Expression:** In the thymus, developing T-cells undergo a two-stage selection process (positive selection followed by negative selection) that kills 95–98% of all candidates. Only 2–5% of thymocytes survive to become mature, circulating T-cells. This is not a design flaw — it is the immune system's primary quality assurance mechanism.

  The kill ratio is structurally essential:
  - **Positive selection** kills T-cells whose receptors cannot bind MHC molecules (functionally useless — cannot recognise any presented antigen). Approximately 90% die at this stage ("death by neglect").
  - **Negative selection** kills T-cells whose receptors bind self-antigens too strongly (functionally dangerous — would attack the body's own tissue). This eliminates an additional portion of survivors.

  The ratio is not merely high — it is *monitored as a health signal*. When the kill ratio deviates:
  - Too few kills in negative selection → autoimmune disease (the system keeps self-reactive cells it should have killed)
  - Too few kills in positive selection → immunodeficiency (the system passes non-functional cells)
  - The thymic involution rate (thymus shrinks with age, reducing selection throughput) correlates with immunosenescence — the degradation of kill-ratio capacity is itself a disease signal

  **Meta-knowledge accumulation:** This is the critical structural match. The immune system does not merely kill — it learns from what survives. The repertoire of surviving T-cells constitutes an *implicit model of self*: everything that was NOT killed during negative selection defines the boundary between self and non-self. The accumulated kills are not recorded individually, but their aggregate effect (the shape of the surviving repertoire) constitutes learned knowledge about what patterns to avoid. Furthermore, regulatory T-cells (Tregs) — themselves survivors of selection — actively suppress immune responses that resemble the patterns of killed self-reactive cells, creating an ongoing feedback loop from historical kills to current immune behaviour.

  Central tolerance (thymic selection) also informs peripheral tolerance mechanisms. When central selection fails and self-reactive cells escape, peripheral mechanisms (anergy, deletion, suppression) act as a second-pass kill layer — the system has a backup kill mechanism informed by the same structural logic.

- **Discovery date:** 2026-03-23
- **Source:** domain knowledge (grounded in immunology — Starr, Jameson & Hogquist 2003; Klein et al. 2014)
- **Structural fit:** **Strong.** All three components present: (1) kill ratio is extreme (~97%), (2) deviations from expected kill ratio are diagnostic of specific diseases (autoimmunity, immunodeficiency), making the ratio an explicit health signal, (3) meta-knowledge accumulates — the surviving repertoire IS the learned model of self, shaped entirely by what was killed. The domain is genuinely alien to software development.

### Instance 3: Venture Capital — Deal Flow Funnel Metrics

- **Domain:** Venture Capital / Financial Investment
- **Expression:** A typical VC fund reviews 1,000+ opportunities per year and funds 5–15, yielding a kill ratio of approximately 99%. This ratio is not incidental — it is one of the most explicitly tracked metrics in the industry. VC firms monitor their "funnel metrics" at each stage: inbound deal flow → first meeting → due diligence → term sheet → close. Each stage has an explicit pass/kill ratio.

  The kill ratio is tracked as a health signal at multiple levels:
  - **Fund-level:** A fund that keeps too many deals (low kill ratio) is considered undisciplined. LPs (limited partners — the investors in the fund) evaluate GPs (general partners — the fund managers) partly on selectivity metrics. A fund that invests in 50 of 1,000 deals is viewed more skeptically than one that invests in 8 of 1,000 — unless the larger portfolio fund has structural reasons (seed stage diversification strategy).
  - **Partner-level:** Individual partners' kill ratios at each funnel stage are tracked. A partner who advances too many deals to due diligence (low early-stage kill ratio) is consuming fund resources; a partner who kills everything before due diligence (too-high early-stage kill ratio) may be missing opportunities.
  - **Vintage-level:** Fund vintage performance correlates with market-cycle kill ratios. Funds deployed during frothy markets (2020–2021 crypto/tech boom) had lower kill ratios due to FOMO pressure and are now showing worse returns. The kill ratio of the vintage IS the retrospective health signal.

  **Meta-knowledge accumulation:** VC firms systematically study their kills. "Anti-portfolio" pages (famously, Bessemer Venture Partners publishes their anti-portfolio — companies they evaluated and passed on, including Apple, Google, and Facebook) represent explicit institutional learning from kills. More substantively, post-mortems on passed deals that later succeeded ("why did we miss this?") directly modify evaluation criteria. The pattern of kills feeds back into the thesis: "we keep killing infrastructure deals — maybe our thesis underweights infrastructure" becomes an actionable insight. Some firms maintain explicit "kill reason" taxonomies (team risk, market size, technology risk, competitive dynamics) and track the distribution of kill reasons over time as a signal about their own blind spots.

  The inversion is also diagnostic: when a fund's kill ratio drops (they start keeping more), this is a recognized danger signal in the industry. "Deployment pressure" (the pressure to deploy committed capital within the fund's investment period) is known to reduce kill ratios and correlate with worse vintage returns.

- **Discovery date:** 2026-03-23
- **Source:** domain knowledge (grounded in VC industry practice — Kaplan & Lerner 2010; Gompers et al. 2020; Bessemer anti-portfolio as public instance)
- **Structural fit:** **Strong.** All three components robustly present: (1) kill ratio is extreme (~99%), (2) the ratio is explicitly tracked at fund, partner, and vintage levels as a primary health metric, (3) meta-knowledge accumulation is systematic — anti-portfolios, kill-reason taxonomies, and thesis refinement based on kill pattern analysis. Domain is genuinely alien to both software development and biology.

### Instance 4: Drug Discovery — Compound Attrition Pipeline

- **Domain:** Pharmaceutical R&D / Drug Discovery
- **Expression:** Drug discovery is defined by its kill ratio. Of approximately 10,000 candidate compounds that enter the discovery pipeline, roughly 1 receives FDA approval — a kill ratio of 99.99%. The pipeline is explicitly structured as a series of kill gates: target identification → hit discovery → lead optimisation → preclinical → Phase I → Phase II → Phase III → regulatory approval. Each gate has an expected attrition rate, and the *deviation from expected attrition* at each gate is a primary pipeline health metric.

  The kill ratio is tracked as a health signal with unusual precision:
  - **Stage-specific attrition rates** are industry benchmarks: preclinical-to-Phase-I success is ~60%, Phase-I-to-Phase-II is ~65%, Phase-II-to-Phase-III is ~30%, Phase-III-to-approval is ~60% (numbers vary by therapeutic area). These benchmarks ARE the health signal — a pipeline whose Phase II kill ratio is lower than the benchmark 70% is *not* healthier; it is suspected of advancing weak candidates (insufficient stringency).
  - **"Pipeline by numbers" models** (e.g., Paul et al. 2010, Nature Reviews Drug Discovery) explicitly model the expected number of candidates needed at each stage to produce one approved drug, working backward from the kill ratio at each gate. The model IS the kill ratio made into a planning tool.
  - **Probability of Technical and Regulatory Success (PTRS)** is a per-compound score that encodes the compound's probability of surviving each remaining kill gate. Aggregating PTRS across the portfolio produces an expected pipeline output — this is the kill ratio turned into a forward-looking health metric.

  **Meta-knowledge accumulation:** This is where drug discovery most precisely matches the motif. Pharma companies maintain extensive databases of killed compounds and the reasons for their failure. These databases directly inform future candidate design:
  - **Structure-Activity Relationships (SAR):** Every killed compound contributes to the SAR map — understanding which molecular features correlate with failure (toxicity, poor absorption, lack of efficacy) and which correlate with survival. The kills ARE the training data.
  - **"Fail fast" as explicit strategy:** The industry shifted in the 2000s toward earlier, cheaper kills (killing in silico or in vitro rather than in expensive Phase III trials). This is meta-knowledge application: learning that late-stage kills are structurally identical to early-stage kills but 100x more expensive led to restructuring the kill schedule.
  - **Therapeutic area attrition patterns:** The observation that oncology has higher Phase II kill rates than cardiovascular disease informs portfolio strategy and trial design. The kill pattern across therapeutic areas is itself knowledge.
  - **Regulatory post-mortems:** FDA publishes reasons for rejection (Complete Response Letters), which become public meta-knowledge about failure patterns. The community learns from every public kill.

- **Discovery date:** 2026-03-23
- **Source:** domain knowledge (grounded in pharmaceutical R&D literature — Paul et al. 2010; Hay et al. 2014; DiMasi et al. 2016)
- **Structural fit:** **Strong — arguably the strongest instance.** All three components present at high fidelity: (1) kill ratio is extreme (99.99%), (2) the ratio is tracked with quantitative precision at every pipeline stage, with deviations from expected ratios flagged as diagnostic signals, (3) meta-knowledge accumulation is the central activity of medicinal chemistry — killed compounds are the primary source of design knowledge. Domain is alien to all previous instances.

---

## Updated Domain Count and Confidence

| # | Domain | Instance |
|---|--------|----------|
| 1 | Software Project Development / Epistemic Systems | Observer project — motif kills, document classification, PRD discards |
| 2 | Immunology / Developmental Biology | Thymic T-cell selection — 95-98% kill, repertoire as learned model |
| 3 | Venture Capital / Financial Investment | Deal flow funnel — ~99% kill, anti-portfolios, kill-reason taxonomies |
| 4 | Pharmaceutical R&D / Drug Discovery | Compound attrition pipeline — 99.99% kill, SAR databases, PTRS scoring |

**4 domains** (from 1). Confidence: 0.1 → **0.4** (0.1 start + 3 × 0.1 new domains).

## T1 Promotion

KRHS should auto-promote to T1 (requires 2+ unrelated domains; now has 4). With 4 domains across biology, finance, and pharma — all alien to the original software/epistemic instance — the T1 case is unambiguous.

### Updated Frontmatter
```yaml
tier: 1
status: provisional
confidence: 0.4
domain_count: 4
source: bottom-up
```

Note: source remains `bottom-up` — all instances were identified through analytical reasoning about domain structures, not through independent top-down creative session discovery. Triangulation would require independent discovery from a Reflect/Triad session.

## Structural Observations

### The Three-Component Test Discriminates Well

The motif's three requirements (high kill ratio + explicit tracking + meta-knowledge accumulation) are useful filters. Several candidate domains were considered and set aside:

- **Evolution / natural selection:** Mutations are killed at enormous rates, but the kill ratio is not tracked by the system itself — there is no organism or mechanism that monitors the mutation kill ratio as a health signal. Natural selection kills, but does not observe its own killing. This fails component (2). Evolution could be added as a *weak* instance if the criterion is relaxed, but including it would dilute the motif's specificity.
- **Quality control / manufacturing:** Defect rates are tracked, and Six Sigma explicitly manages kill ratios. However, the meta-knowledge component is weaker — QC learns to prevent the *same* defects, but does not typically generate structural insight about *categories* of failure that reshape the generation process. This is borderline and could be revisited.
- **Academic peer review:** Rejection rates are tracked (top journals reject 90%+), but the meta-knowledge feedback loop is weak — rejected papers do not systematically inform the generation of future submissions in the way that killed compounds inform future drug design. The journal system kills but learns slowly.

The three surviving instances (immunity, VC, pharma) all exhibit all three components robustly. This suggests the motif is not just "systems that discard a lot" (which would be trivially universal) but specifically "systems that use their discard ratio as a monitored health metric AND feed kill patterns back into candidate generation."

### Kill Ratio as Second-Derivative Signal

An observation across all four instances: the kill ratio itself is a first-order signal, but the *change in kill ratio* is often more diagnostic. A stable high kill ratio = healthy. A rising kill ratio might mean the generation process is degrading. A falling kill ratio might mean selection is loosening. In VC, deployment pressure (falling kill ratio) predicts worse returns. In immunology, thymic involution (falling kill throughput) predicts immunosenescence. In pharma, lower-than-benchmark Phase II kills predict late-stage failures. This suggests the motif may be higher than derivative order 1 — the kill ratio's *rate of change* may be the real structural signal.

### Relationship to Existing Motifs

The existing motif entry already identifies three relationships (trust-as-curation, observer-feedback-loop, bounded-buffer-with-overflow-policy). The new instances suggest an additional connection:

- **Progressive Formalization** (if it exists in the library): the kill ratio tends to increase as a system matures. Early-stage systems keep more (exploratory phase); mature systems kill more (the criteria have crystallized). This is progressive formalization applied to the kill threshold itself.

## T2 Path Assessment

KRHS at 4 domains is a moderate T1. The 5-condition protocol:

1. **Domain-independent description:** PASS — the motif is described without any domain vocabulary
2. **Cross-domain recurrence:** PASS — 4 unrelated domains
3. **Predictive power:** Moderate — knowing this motif predicts that healthy curation systems will have high, explicitly-tracked kill ratios with feedback loops. It would predict, for example, that a machine learning feature selection pipeline should track rejection reasons, not just rejection counts.
4. **Adversarial survival:** Needs testing — "systems that filter aggressively perform better" could be challenged as survivorship bias observation rather than structural pattern. The meta-knowledge component is the defense: the claim is not just "kill more = better" but "track why you kill = learn faster."
5. **Clean failure:** PASS — falsification conditions are already well-specified in the existing entry

**Recommendation:** KRHS is a solid T1 with a plausible T2 path. The main gap for T2 is predictive power validation — can the motif generate non-obvious predictions in a new domain? The strongest T2 argument would be finding a domain where explicitly tracking kill ratios *caused* a measurable improvement that not-tracking did not produce.
