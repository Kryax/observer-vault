---
status: draft
date: 2026-03-22
type: review
cssclasses:
  - status-draft
---

# Tier 3 Candidate Deep Review — 2026-03-22

> Adversarial evaluation of 5 Tier 3 candidates against ALL four Tier 3 criteria from `_SCHEMA.md`.

## Tier 3 Criteria (Reference)

1. **Geometric description** — Must describe the geometry of the space in which Tier 2 operators operate. Not merely "Tier 2 motifs are related" but "here is the shape of the space that generates and constrains Tier 2 motifs."
2. **Tier-independent falsification** — Cannot be falsified by any single domain or motif failing. If one Tier 2 motif is demoted, the Tier 3 motif must still hold.
3. **Self-referential prediction** — Must make predictions about the tier system itself: what kinds of motifs should exist, where gaps should appear, what the distribution of motifs across axes/orders should look like.
4. **Load-bearing, not decorative** — Must generate correct predictions that a simpler theory would not.

## Current Tier 2 Operator Space (8 motifs)

| Motif | Axis | Order | Confidence |
|-------|------|-------|------------|
| Dual-Speed Governance (DSG) | integrate | d2 | 1.0 |
| Composable Plugin Architecture (CPA) | differentiate | d2 | 0.9 |
| Explicit State Machine Backbone (ESMB) | differentiate | d2 | 0.9 |
| Bounded Buffer With Overflow Policy (BBWOP) | differentiate | d1.5 | 0.9 |
| Idempotent State Convergence (ISC) | integrate | d1 | 1.0 |
| Observer-Feedback Loop (OFL) | recurse | d1-2 | 0.9 |
| Ratchet with Asymmetric Friction (Ratchet) | recurse | d1 | 0.9 |
| Progressive Formalization (PF) | integrate | d1 | 0.85 |

---

## Candidate 1: Structural Metabolism (ISC + RST)

### Blocking Issue

**RST is Tier 1, not Tier 2.** The schema defines Tier 3 as "describes relationships between Tier 2+ motifs." RST has not been promoted to Tier 2 — it is still provisional at Tier 1 (confidence 0.8, pending formal validation protocol review). A Tier 3 motif cannot be built on a constituent that hasn't cleared the Tier 2 gate. This is a definitional failure, not a judgment call.

### Criteria Assessment (evaluated despite the blocking issue)

**1. Geometric description: FAIL**

The draft describes a "duality" between two operations: structure-preserving (ISC) and structure-transforming (RST). This is a binary relationship — complementary pairing — not a geometry of the operator space. It tells us "these two are dual" but says nothing about where the other 6 operators sit, what shape the space has, or what constraints it imposes. A true Tier 3 geometry would describe the space all operators inhabit. This describes a single edge in that space.

**2. Tier-independent falsification: FAIL**

The motif IS the coupling of ISC and RST. Demoting either constituent kills the claim. The falsification conditions are all about the coupling: "if ISC and RST operate independently," "if the metabolic cycle adds no predictive power." There is no formulation of the motif that survives loss of either component. Compare to a genuine geometric claim like "the operator space has axis-dependent structure" — that survives individual operator demotions.

**3. Self-referential prediction: FAIL**

The draft makes no predictions about the tier system, the distribution of motifs, or where gaps should appear. It predicts that "systems need both maintenance and transformation" — a claim about systems in general, not about the motif library's structure. A Tier 3 motif should predict something like "a motif of type X should exist at position Y in the operator space."

**4. Load-bearing, not decorative: CONDITIONAL**

The coupling claim (systems with one operator but not the other are pathological) is testable and non-trivial. Rigid systems (ISC without RST) and incoherent systems (RST without ISC) are real failure modes. However, a simpler theory — "complex systems need both stability and change" — generates the same prediction without the motif-library apparatus. The metabolic framing is evocative but may not generate predictions beyond what anyone already knows.

### Strongest Objection

This is a Tier 2 composition, not a Tier 3 meta-structural motif. It describes how two operators interact, not the geometry of the operator space. Every pair of complementary Tier 2 motifs could be similarly packaged as a "Tier 3" candidate — ISC+ESMB ("convergence-constraint duality"), DSG+OFL ("governance-feedback coupling"), etc. If this qualifies, the Tier 3 standard is too loose.

### Score

| Criterion | Result |
|-----------|--------|
| Geometric description | **FAIL** |
| Tier-independent falsification | **FAIL** |
| Self-referential prediction | **FAIL** |
| Load-bearing, not decorative | **CONDITIONAL** |

### Recommendation: **KILL**

RST's Tier 1 status is a definitional blocker. Even setting that aside, 3 of 4 criteria fail outright. The ISC/RST complementarity is a real and valuable observation — it should be recorded as a relationship property on both motif entries, not elevated to Tier 3. The "structural metabolism" framing adds narrative appeal but not structural insight.

---

## Candidate 2: Irreversible Progressive Ordering (PF + Ratchet + OFL)

### Criteria Assessment

**1. Geometric description: FAIL**

The draft describes a directed cycle among three specific operators: PF creates structure → Ratchet locks it → OFL drives the next cycle. This is a composition topology (a cycle graph over three nodes), not a geometry of the full operator space. It says nothing about where DSG, CPA, ESMB, BBWOP, or ISC sit. A genuine geometry describes the space all operators inhabit; this describes a subgraph of three operators and how they compose.

The "directed cycle" framing is stronger than Structural Metabolism's "binary duality" — it identifies an emergent property (directional arrow) from the composition. But emergence from composition is what Tier 2 motifs already do individually. A Tier 3 motif must describe the space, not a composition within it.

**2. Tier-independent falsification: FAIL**

Each constituent is essential:
- Remove PF → no ordering trajectory → the "progressive" claim dies
- Remove Ratchet → no irreversibility → the "irreversible" claim dies
- Remove OFL → no feedback driver → the cycle breaks

The falsification conditions confirm this: "if the arrow can be explained by any single operator without the other two, this Tier 3 pattern is redundant." The motif is the coupling — lose any element and the coupling fails.

The draft's own assessment claims the composition claim would fail if the three operate independently. This is the definition of constituent-dependent falsification.

**3. Self-referential prediction: CONDITIONAL**

The cycle predicts that the motif library itself should show progressive ordering — and it does (early Tier 0 → later Tier 1 → still later Tier 2). But this prediction is partially circular: PF is a constituent of the motif, and PF literally describes progressive ordering. Predicting that the motif library follows PF when PF is one of your ingredients is not an independent prediction.

A stronger self-referential prediction would be: "the motif library's development rate should accelerate over time because each formalized motif creates dependencies (Ratchet) that constrain future observation (OFL), revealing new structure faster (PF)." This is testable and non-circular. But the draft doesn't make this prediction explicitly.

**4. Load-bearing, not decorative: CONDITIONAL**

The genuinely novel claim is that OFL is the mechanism that closes the cycle — without observation-feedback, PF+Ratchet would produce directional drift but not accelerating development. This is non-trivial. The ecological succession evidence (PF+Ratchet+OFL co-occurring on the same substrate) is the strongest support.

However, the simpler theory "PF and Ratchet co-occur because progressive systems accumulate dependencies" captures most of the content. The OFL addition is the marginal contribution, and it's testable: do systems with PF+Ratchet but without OFL show slower directional development than those with all three? This test has not been run.

### Strongest Objection

This is a three-operator composition, not a geometry of the operator space. It's a directed cycle over {PF, Ratchet, OFL}, silent about the other 5 operators. If "three Tier 2 operators form a cycle" qualifies as Tier 3, then any three-operator composition could be nominated. The criterion says "describes the geometry of the space" — a three-node cycle is a substructure, not a geometry.

### Score

| Criterion | Result |
|-----------|--------|
| Geometric description | **FAIL** |
| Tier-independent falsification | **FAIL** |
| Self-referential prediction | **CONDITIONAL** |
| Load-bearing, not decorative | **CONDITIONAL** |

### Recommendation: **REVISE (major)**

The three-operator composition is genuine and empirically grounded. But it is not Tier 3 — it is a meta-relationship among Tier 2 motifs, which the schema records as relationship properties, not as a separate motif. Two revision paths:

1. **Downgrade to inter-motif relationship**: Record the PF→Ratchet→OFL directed cycle as relationship entries on each constituent motif's Relationships section. This preserves the insight without inflating it.
2. **Expand to geometry**: If the directed cycle can be shown to be a special case of a larger geometric structure (e.g., a flow pattern in the operator space that includes ALL operators, not just three), it might become a genuine Tier 3 candidate. But this would be a substantially different motif.

---

## Candidate 3: Governed Architecture (DSG + CPA + ESMB)

### Criteria Assessment

**1. Geometric description: FAIL**

The draft describes a "structural attractor" — a convergent architecture that systems independently arrive at. This is a claim about engineering design space, not about the geometry of the operator space. The "governance stack" (DSG governs CPA extends ESMB, with ESMB constraining DSG) is a composition hierarchy, not a geometry.

The self-constraining loop (DSG→CPA→ESMB→DSG) is structurally interesting, but it describes a property of three specific operators' composition, not the shape of the space all eight operators inhabit. The draft says nothing about where ISC, OFL, Ratchet, PF, or BBWOP sit in relation to this stack.

**2. Tier-independent falsification: FAIL**

Same structural problem as the other composition candidates. Remove ESMB → no transition grammar → the stack loses its constraint layer. Remove CPA → no extension mechanism → the stack can't evolve. Remove DSG → no meta-governance → the stack has no regulatory layer. The three are load-bearing in the composition; removing any one breaks the claim.

**3. Self-referential prediction: FAIL**

The draft predicts that systems under evolutionary pressure converge on the DSG+CPA+ESMB stack. This is a prediction about engineering systems, not about the tier system or motif library. It doesn't predict what motifs should exist, where gaps should appear, or what the distribution should look like. A Tier 3 motif must be self-referential about the tier system.

**4. Load-bearing, not decorative: CONDITIONAL**

The "convergent architecture" claim is non-trivial — if true, it predicts that well-engineered systems in ANY domain will exhibit all three operators together. The cross-domain evidence (OS kernels, game engines, constitutional governance, gene regulation) is suggestive.

However, the cultural-transmission alternative remains unrefuted: engineers learn the same patterns from the same textbooks (SOLID principles, clean architecture), and these patterns spread memetically. The biological instances (gene regulatory networks) are the strongest counter to cultural transmission, but the mapping (modular protein domains = CPA, epigenetic regulation = DSG) is metaphorical — it requires demonstrating genuine structural isomorphism, not just surface-level analogy.

### Strongest Objection

This is an architectural recipe, not a meta-structural insight. "Good systems use state machines, plugins, and governance" is engineering wisdom, not a geometric description of the operator space. The composition is domain-specific to *engineered* systems — it's unclear that the stack applies to natural systems without metaphorical stretching. Contrast with the Coordination Type Lattice, which claims to describe the space all operators inhabit regardless of domain.

### Score

| Criterion | Result |
|-----------|--------|
| Geometric description | **FAIL** |
| Tier-independent falsification | **FAIL** |
| Self-referential prediction | **FAIL** |
| Load-bearing, not decorative | **CONDITIONAL** |

### Recommendation: **KILL**

Three of four criteria fail. The DSG+CPA+ESMB composition is a valid and useful observation — it should be recorded as a three-way relationship in each constituent motif's Relationships section ("these three compose into a governance stack"). But it is not a Tier 3 motif. It describes what good engineering looks like, not the geometry of the structural operator space.

---

## Candidate 4: Coordination Type Lattice (CTL)

### Criteria Assessment

**1. Geometric description: PASS**

This is the strongest geometric claim among all candidates. It describes a partial order over the operator space:

```
BBWOP → {ESMB ∥ CPA} → ISC → DSG → OFL
```

Properties of the geometry:
- A minimal element (BBWOP — boundary coordination)
- A maximal element (OFL — reflexive coordination)
- Incomparable pairs (ESMB ∥ CPA — sequence and composition coordination are independent)
- A diamond structure at the differentiate axis
- Linear chain elsewhere
- Metric irregularity at the apex (derivative order becomes interval-valued)

This is a genuine geometric structure — a Hasse diagram of a partial order — not merely "these motifs are related." It describes WHERE each operator sits relative to every other operator, with directed prerequisite relationships.

**2. Tier-independent falsification: CONDITIONAL**

If one operator is demoted, the lattice loses a node but the remaining ordering holds — the prerequisite structure between surviving operators is preserved. This is structurally better than the composition candidates, which dissolve when any constituent is removed.

However, the post-hoc naming problem is the critical weakness. The coordination types (boundary, sequence, composition, convergence, temporal, reflexive) were derived FROM the operators, not from first principles. If the labels are post-hoc, then the lattice is a description of the current operator set, not an independent geometry — and it would need to be rebuilt from scratch if the operator set changed. The falsification is tied to the labeling scheme, not to individual operators.

**Assessment:** The lattice structure (partial order with prerequisite relationships) survives individual demotions. But the coordination type labels are the interpretive layer that gives the lattice meaning, and they are not independently derived. If the labels are shown to be post-hoc (can't be derived without knowing the operators), the lattice's explanatory power collapses even without any demotion.

**3. Self-referential prediction: PASS**

The lattice makes specific, testable predictions about the tier system:
- A minimal element with no prerequisites exists → BBWOP confirmed
- A maximal element requiring all others exists → OFL confirmed
- Incomparable pairs exist → ESMB ∥ CPA confirmed
- The motif library's development should traverse the lattice bottom-up → D-axis operators discovered first, then I-axis, then R-axis — confirmed
- The join of parallel operators should exist → ISC as join of ESMB and CPA (testable)
- OFL should not appear in systems lacking DSG-like temporal separation → testable

These are predictions about the structure of the motif library, not just about external systems. The developmental traversal prediction is particularly strong: it was confirmed after the lattice was proposed.

**4. Load-bearing, not decorative: CONDITIONAL**

The lattice generates predictions beyond what the individual operators provide:
- OFL should not appear in systems that lack DSG-like temporal separation (a specific, non-obvious prediction)
- BBWOP should appear in even very simple systems (a specific prediction about minimal complexity)
- Adding more D-axis operators at the base of the lattice adds breadth but not new coordination types (a structural prediction about the distribution)

However, the post-hoc labeling concern weakens the load-bearing claim. If the coordination types are just operator names in disguise, the lattice "predicts" the operators because it was built from them. The specific, independently testable predictions (OFL requires DSG; BBWOP is minimal) are the genuinely load-bearing elements. The lattice needs these predictions confirmed in domains where the operators weren't already known to co-occur.

### Strongest Objection

**Circularity.** The lattice was constructed by examining the 8 Tier 2 operators and inferring prerequisite relationships between them. The coordination type labels were coined to describe the operators, not derived independently. This means:
- The lattice "predicts" operators that it was built from
- The labels have no independent motivation — they could be a sophisticated re-description
- If a 9th Tier 2 operator is discovered that addresses a coordination type the lattice didn't predict, the lattice must be rebuilt rather than extended

The circularity can be broken in two ways: (a) derive the coordination types from first principles (e.g., from D/I/R axis structure + derivative order), or (b) use the lattice to predict a new operator before it's discovered. Neither has been done.

### Score

| Criterion | Result |
|-----------|--------|
| Geometric description | **PASS** |
| Tier-independent falsification | **CONDITIONAL** |
| Self-referential prediction | **PASS** |
| Load-bearing, not decorative | **CONDITIONAL** |

### Recommendation: **REVISE (targeted)**

CTL is the strongest Tier 3 candidate by a significant margin. It has genuine geometric structure and makes testable self-referential predictions. Two gaps must be closed before promotion:

1. **Break the circularity.** Either derive the coordination types from first principles (the axis structure + derivative order decomposition is the most promising path, as the draft's own open issues note) OR use the lattice to make a novel prediction (e.g., predict a specific gap in the operator space and then discover a motif that fills it).

2. **Cross-domain lattice testing.** The prerequisite ordering (BBWOP before ESMB before ISC before DSG before OFL) needs testing in domains where the developmental history is independently documented. The immune system traversal (full lattice) and simple systems (BBWOP only) are good starts but insufficient. Test in: legal system development (did boundary regulation precede procedural regulation?), organizational development (do startups acquire these capabilities in lattice order?), language development (do natural languages exhibit lattice-ordered coordination capabilities?).

---

## Candidate 5: Derivative Order Collapse Under Self-Reference (DOC)

### Criteria Assessment

**1. Geometric description: PASS**

The claim is topological: the operator space has axis-dependent fiber geometry. The D and I axes support discrete, point-valued derivative order (d0, d1, d2, d3). The R axis supports only interval-valued or ambiguous derivative order. This means the operator space is NOT a uniform product of axis × order — the fibers are topologically different depending on which axis you're on.

This is a genuine geometric claim about the space, not a claim about relationships between specific operators. It describes a structural property of the space itself.

**2. Tier-independent falsification: PASS**

The claim is about self-reference as a structural property, not about any specific operator. If OFL is demoted, the claim still stands as a prediction: "any future R-axis Tier 2 operator will have range-valued derivative order." The falsification condition — "if a second R-axis Tier 2 operator has point-valued derivative order" — is structural and doesn't depend on any existing operator's status.

This is the strongest tier-independent falsification among all candidates. The claim is about a property of the space (R-axis fibers are different), not about the operators that happen to inhabit it.

**3. Self-referential prediction: PASS**

Predictions about the tier system:
- R-axis operators will always have range-valued or ambiguous derivative orders
- Any D or I axis operator that acquires self-referential properties will see its derivative order become ambiguous
- The Tier 2/3 boundary should be the fuzziest boundary in the tier system (because Tier 3 analysis is itself a recurse-axis operation on the motif space)
- The tier system itself, viewed as a meta-operator, should resist clean derivative order assignment

The Tier 2/3 boundary fuzziness prediction is specific, non-obvious, and testable. The current state of the motif library provides evidence: the Tier 0/1 boundary is sharp (auto-promotion on domain count), the Tier 1/2 boundary is moderately sharp (5-condition protocol), but the Tier 2/3 boundary is genuinely fuzzy (the current review is struggling with whether compositions "count" as Tier 3 — which is exactly what the motif predicts).

**4. Load-bearing, not decorative: CONDITIONAL**

The Tier 2/3 boundary fuzziness prediction is the strongest load-bearing element. A simpler theory ("OFL is just hard to classify") does not predict that the Tier 2/3 boundary SHOULD be fuzzy — it only describes one observation.

However, the prediction space is narrow. Most predictions reduce to one underlying claim: "self-reference blurs level boundaries." The predictions about D/I operators acquiring self-referential properties and seeing order collapse are testable but untested. The motif needs to generate a richer set of predictions to clearly justify Tier 3 status.

The N=1 evidence problem is real: the entire R-axis claim rests on OFL having derivative order "1-2". Ratchet is classified as R-axis d1 (point-valued), which could be read as evidence AGAINST the claim — though the draft might argue Ratchet's recurse-axis properties are secondary and its self-referential character is weaker than OFL's.

**Critical test:** Ratchet with Asymmetric Friction is classified as `primary_axis: recurse` with `derivative_order: 1` (point-valued). If the DOC claim is correct, why does Ratchet — an R-axis operator — have a point-valued derivative order? Possible responses:
- Ratchet's recursion is not genuine self-reference (the output modifies the environment, not the operator itself)
- Ratchet is "weakly recursive" — the D/I characterization might be more accurate for its primary structural action

This is a potential falsification edge. If Ratchet is genuinely R-axis and has point-valued derivative order, DOC's claim that "R-axis fibers are interval-valued" is already falsified by existing data.

### Strongest Objection

**N=1 plus a potential counterexample.** The claim that R-axis fibers have interval-valued derivative order rests on a single data point (OFL at d1-2). Meanwhile, Ratchet is classified as R-axis with d1 (point-valued). Either Ratchet falsifies the claim, or Ratchet isn't "truly" R-axis — but reclassifying Ratchet to save the theory is ad hoc rescue. The motif needs to either (a) explain why Ratchet has point-valued order despite being R-axis without circular reasoning, or (b) predict a second R-axis operator with range-valued order.

### Score

| Criterion | Result |
|-----------|--------|
| Geometric description | **PASS** |
| Tier-independent falsification | **PASS** |
| Self-referential prediction | **PASS** |
| Load-bearing, not decorative | **CONDITIONAL** |

### Recommendation: **REVISE (targeted)**

DOC passes 3 of 4 criteria — the strongest pass rate. Two issues must be resolved:

1. **The Ratchet problem.** Ratchet is R-axis with point-valued d1. DOC must either provide a principled reason Ratchet's derivative order is well-defined (e.g., Ratchet's self-referential character is qualitatively different from OFL's — dependency accumulation is not the same as observation-framework modification), or concede that the axis labels are too coarse and DOC applies to "strongly self-referential" operators, not all R-axis operators. Either way, the claim needs refinement.

2. **Broaden the prediction space.** The current predictions mostly reduce to "self-reference blurs levels." DOC should generate predictions about: (a) what happens when D/I operators compose with OFL — does the composition acquire interval-valued derivative order? (b) whether the "jerk" level (d3) is structurally achievable on the R axis or whether derivative order collapse prevents d3 R-axis operators from existing. (c) whether the three-axis model predicts exactly ONE axis should have this property, or whether a fourth axis would also collapse.

### Relationship to CTL

DOC's own draft notes that it "may be a sub-property of the Coordination Type Lattice rather than an independent Tier 3 motif." This should be evaluated:

- If CTL is promoted and DOC is a property of CTL's apex (the metric irregularity at the reflexive coordination node), then DOC should be folded into CTL as a derived property, not maintained as a separate Tier 3 entry.
- If DOC makes predictions that CTL does not (e.g., about D/I operators acquiring self-reference, about Tier boundary fuzziness), it has independent content and should remain separate.

Current assessment: DOC's predictions about Tier boundary fuzziness and about D/I operators under self-reference are NOT derivable from CTL. DOC has independent content. But if both are promoted, their relationship must be explicit: CTL describes the lattice structure; DOC describes the metric irregularity of the lattice's apex fiber.

---

## Comparative Summary

| Candidate | Geometric | Tier-Independent | Self-Referential | Load-Bearing | Overall |
|-----------|-----------|-----------------|-----------------|-------------|---------|
| Structural Metabolism | FAIL | FAIL | FAIL | CONDITIONAL | **KILL** |
| Irreversible Progressive Ordering | FAIL | FAIL | CONDITIONAL | CONDITIONAL | **REVISE (major)** |
| Governed Architecture | FAIL | FAIL | FAIL | CONDITIONAL | **KILL** |
| Coordination Type Lattice | PASS | CONDITIONAL | PASS | CONDITIONAL | **REVISE (targeted)** |
| Derivative Order Collapse | PASS | PASS | PASS | CONDITIONAL | **REVISE (targeted)** |

### Tier 3 Candidate Ranking

1. **Derivative Order Collapse** — 3 PASS, 1 CONDITIONAL. Strongest pass rate. The Ratchet problem is solvable; the narrow prediction space is expandable. Closest to promotion-ready.

2. **Coordination Type Lattice** — 1 PASS, 2 CONDITIONAL. The circularity problem is fundamental but addressable. If the coordination types can be independently derived, this becomes the most powerful Tier 3 candidate because it describes the entire operator space, not just one property of it. Higher ceiling than DOC but more work needed.

3. **Irreversible Progressive Ordering** — 0 PASS, 2 CONDITIONAL. A genuine three-operator composition with empirical grounding, but not Tier 3 by the criteria. Could be reconceived as a relationship pattern rather than a meta-motif.

4–5. **Structural Metabolism** and **Governed Architecture** — 0 PASS, 1 CONDITIONAL each. Both are Tier 2 operator compositions masquerading as Tier 3 meta-structural motifs. Kill both; preserve the insights as relationship annotations.

## Structural Observation

The three composition candidates (Structural Metabolism, Irreversible Progressive Ordering, Governed Architecture) all fail the same way: they describe how specific subsets of operators compose, not the geometry of the space all operators inhabit. This reveals a systematic confusion between "Tier 2 operators can compose" (true, interesting, but not Tier 3) and "the space of operators has geometric structure" (the actual Tier 3 criterion).

The two cross-cutting candidates (CTL and DOC) both pass the geometric criterion because they make claims about the space itself — its partial order (CTL) and its fiber geometry (DOC). This confirms the schema's Tier 3 criteria are well-calibrated: they successfully discriminate between compositions and genuine meta-structural insights.

## Recommended Next Actions

1. **Kill** Structural Metabolism and Governed Architecture. Record their compositional insights as relationship annotations on the constituent motifs.
2. **Downgrade** Irreversible Progressive Ordering to a relationship annotation. Optionally preserve the PF→Ratchet→OFL cycle description as a cross-cutting relationship note in a meta/ file (not a Tier 3 candidate).
3. **Advance DOC** by resolving the Ratchet problem and broadening the prediction space. The Ratchet issue is the most urgent — it's a potential falsification by existing data.
4. **Advance CTL** by attempting first-principles derivation of coordination types. If the coordination types can be derived from the D/I/R axis structure plus derivative order, the circularity breaks and CTL becomes promotable.
5. **RST promotion** is a prerequisite for any future composition-based Tier 3 candidates. RST should complete its Tier 2 validation protocol before being incorporated into meta-structural claims.

---

*Review conducted adversarially with the assumption that Tier 3 is a high bar. Framework-level claims require framework-level evidence.*
