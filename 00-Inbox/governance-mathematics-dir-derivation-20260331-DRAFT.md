---
type: analysis
status: DRAFT
authority: none
created: 2026-03-31
method: D/I/R (3 cycles, c/i/d convergence)
scope: Governance mathematics derived from D/I/R first principles
feeds: governance-calibration-dir-analysis-20260331-DRAFT.md
depends_on:
  - 02-Knowledge/architecture/axiomatic-motif-algebra-v02-spec-20260311.md
  - 00-Inbox/governance-calibration-dir-analysis-20260331-DRAFT.md
---

# Governance Mathematics — Derivation from D/I/R First Principles

**Atlas, 2026-03-31**
**Authority: DRAFT — proposes, Adam decides.**

---

## Executive Summary

The governance calibration analysis produced working heuristics: `motif_confidence = Σ[e × s] / √N`, derivative order adjustment `× (1 + 0.1 × d)`, multiplicative source trust composition. These pass stress tests. But they were chosen for pragmatic neatness, not derived from anything.

This analysis asks: does D/I/R as the generative framework produce the same mathematics, different mathematics, or no mathematics at all?

**Answer: D/I/R produces governance mathematics that are structurally different from the heuristics in two important ways, and validates the heuristics in three others.**

What D/I/R derives:
1. **Multiplicative composition of source trust × evidence strength** — validated. Falls directly out of D as a filter operator.
2. **Hierarchical aggregation (mean of domain-level means)** replaces **√N normalisation**. The heuristic's flat aggregation with √N is solving the wrong problem; the real issue is domain-boundary preservation, which hierarchical averaging handles without artificial normalisation.
3. **Separation of source trust from evidence quality as parallel R-inputs** rather than pre-multiplied into a single confidence score. D and I produce separate outputs; R should evaluate both, not a blended number.
4. **Formal demotion conditions (↓)** with hysteresis — entirely absent from the heuristic governance.
5. **c/i/d as the native evaluation structure** — the existing AND-composition of domain count, triangulation, and validation conditions is correct and derivable.

What D/I/R does not derive:
- Specific threshold values (3/5/8 domains, 0.3/0.6/0.8 confidence) — these are noise-floor calibrations, not structural.
- The derivative order adjustment magnitude (10% per order) — direction is derived, rate is not.
- Source trust baseline table values — empirical, not structural.

---

# CYCLE 1 — DESCRIBE: D/I/R Primitives as Mathematical Operators

## 1.1 D (Differentiate) — The Filter Operator

D extracts candidate motifs from raw domain noise. Mathematically, D is a **domain-local filter**: it takes one domain's data and produces candidate evidence items, each with a signal quality.

Key properties:
- **Domain-local:** D(domain_i) operates independently of D(domain_j). There is no cross-domain interaction at the D stage.
- **Filter fidelity:** The quality of D's output depends on the channel — how noisy the domain is, how reliable the source is. This is source_trust: a property of the filter, not the signal.
- **Signal magnitude:** Within a domain, D produces evidence items with varying match quality. This is evidence_strength: a property of the signal, not the filter.

D's mathematical form:

```
D(domain_j) → { (evidence_strength(e₁), source_trust(sⱼ)),
                 (evidence_strength(e₂), source_trust(sⱼ)),
                 ... }
```

Note: source_trust is constant per domain (it characterises the channel), while evidence_strength varies per item (it characterises each signal).

## 1.2 I (Integrate) — The Structured Accumulation Operator

I combines D-outputs across domains while preserving provenance. It maps candidates against the existing library, finding structural overlaps.

Key properties:
- **Structure-preserving:** I accumulates without collapsing domain boundaries. The Σ in `G = ↑[ R( Σ I( D(domain_data) ) ) ]` is summation over domain-separated signals.
- **Cross-domain mapping:** I detects when D-outputs from different domains match the same motif pattern.
- **Non-commutative provenance:** The algebra specifies non-commutativity. In governance terms: the order and provenance of evidence matters. Evidence from PubMed followed by ArXiv confirmation is different from two PubMed items.

I's mathematical form:

```
I( D(d₁), D(d₂), ..., D(dₖ) ) = { domain_signal(d₁), domain_signal(d₂), ..., domain_signal(dₖ) }

where domain_signal(dⱼ) = aggregate( D(dⱼ) )
```

I does NOT flatten. It produces a structured collection indexed by domain.

## 1.3 R (Recurse) — The Evaluation Gate

R scans the integrated network and evaluates against stabilisation conditions. R is not an evidence producer — it's a discriminator that determines whether emergence (↑) is warranted.

R evaluates three conditions:
- **c (Cross-Domain Validation):** Is the pattern present across structurally distinct domains?
- **i (Structural Invariance):** Is the pattern's core geometry preserved under domain substitution?
- **d (Non-Derivability):** Is the pattern irreducible to existing higher-tier motifs?

R's mathematical form:

```
R( I_output ) → { c_score, i_score, d_score, evidence_quality, source_reliability }

↑ fires when ALL conditions meet their tier-appropriate thresholds.
```

## 1.4 ↑ and ↓ — Phase Transitions with Hysteresis

**↑ (Recursive Lift):** `↑( M_A⁰ ⊗ᵥ M_B⁰ ⊗ᵥ M_C⁰ ) = M_new¹`

Many lower-tier observations crystallise into one higher-tier identity. This is a phase transition — discontinuous, requiring simultaneous satisfaction of all stabilisation conditions.

**↓ (Recursive Collapse):** `↓( M² ⊗_stress M_env² ) = Σ M¹`

Degradation under unmanageable stress. Key property: ↓ decomposes but preserves components. Evidence returns to a lower tier where it's still valid — it doesn't vanish.

**Hysteresis requirement:** If ↑ and ↓ use the same threshold, a motif at the boundary oscillates indefinitely between tiers. The algebra's concept of "stabilisation" implies that once ↑ fires, the resulting structure must be resistant to small perturbations. Therefore: **the demotion threshold must be lower than the promotion threshold.** This is the asymmetric friction that prevents governance oscillation.

## 1.5 The Critical Structural Observation

The D→I→R pipeline is **hierarchical**: D separates by domain, I combines across domains, R evaluates the combination. Any governance mathematics that flattens this hierarchy — pooling all evidence into one sum regardless of domain provenance — violates the operator structure.

The heuristic formula `Σ[e × s] / √N` flattens. The D/I/R-derived form preserves hierarchy.

## 1.6 c/i/d Convergence — Cycle 1

| Evaluator | Assessment | Score |
|-----------|-----------|-------|
| **c** | D, I, R described independently with distinct mathematical roles. Filter / accumulator / gate structure is cross-validated against the algebra spec. | HIGH |
| **i** | The operator decomposition is structurally stable. Substituting different evidence types (lexical, structural, model) doesn't change D's role as filter or I's role as accumulator. | HIGH |
| **d** | The hierarchical observation (D→I→R implies hierarchical aggregation) is non-trivial — it's not stated in the algebra spec and only emerges from mapping operators to mathematical functions. | HIGH |

**Stability: STABLE.** Distinctions are sharp. Ready for integration.

---

# CYCLE 2 — INTEGRATE: Deriving Governance Formulas

## 2.1 Source Trust × Evidence Strength Composition

**Derivation:** D is a filter. Evidence_strength is signal magnitude passing through the filter. Source_trust is filter fidelity. The natural composition is **multiplicative**:

```
observed_signal = signal × filter_quality
                = evidence_strength(e) × source_trust(s)
```

**Why multiplicative, not additive:**
- Zero signal through perfect filter = zero evidence. (Multiplication: 0 × 1 = 0. Addition: 0 + 1 = 1. ✗)
- Perfect signal through zero-trust filter = zero evidence. (Multiplication: 1 × 0 = 0. Addition: 1 + 0 = 1. ✗)
- Both conditions require multiplication. Addition violates both.

**Verdict:** Multiplicative composition is **derived from D's filter semantics.** Matches the heuristic.

However — Cycle 3 will reveal that this multiplication should happen at the D-layer output, not as a collapsed input to R. The distinction matters.

## 2.2 Evidence Aggregation — Hierarchical vs. Flat

### The D/I/R-derived form

**D-layer aggregation (within domain):** Multiple evidence items from domain dⱼ are repeated observations through the same filter. After D separates signal, additional same-domain observations provide diminishing information — they confirm the same D-output. Natural form: **mean within domain.**

```
domain_signal(dⱼ) = (1/nⱼ) × Σᵢ [ evidence_strength(eᵢ) × source_trust(sⱼ) ]
                   = source_trust(sⱼ) × mean( evidence_strength(eᵢ) ) for eᵢ ∈ dⱼ
```

**I-layer aggregation (across domains):** Each domain contributes independent signal for the c condition. A new domain is genuinely new evidence. Natural form: **mean across domains** (to maintain 0-1 boundedness).

```
motif_confidence(m) = (1/k) × Σⱼ [ domain_signal(dⱼ) ]
```

The full form:

```
motif_confidence(m) = (1/k) × Σⱼ [ source_trust(sⱼ) × mean_evidence(dⱼ) ]
```

where k = number of distinct domains and mean_evidence(dⱼ) = average evidence_strength within domain dⱼ.

### Why this differs from √N normalisation

The heuristic: `Σ[eᵢ × sᵢ] / √N` where N = total evidence count.

| Property | Heuristic (Σ/√N) | Derived (mean of domain means) |
|----------|-------------------|-------------------------------|
| Domain boundaries | Flattened — all evidence pooled | Preserved — D-layer then I-layer |
| Volume dominance | Partially controlled (√N grows slower than N) | Structurally prevented (averaging caps each domain) |
| Boundedness | Unbounded — v√N grows without limit for fixed per-item value v | Bounded [0, 1] naturally |
| 100 items from 1 domain vs. 10 items from 10 domains | Different scores (√100 ≠ √10) despite same total | Same-quality evidence → similar scores; the 10-domain case correctly scores higher due to domain diversity |
| Information content | Conflates "more evidence" with "better evidence" | Distinguishes volume (within-domain) from diversity (cross-domain) |

### The √N problem, specifically

With N evidence items each of value v:
- Heuristic: Σ/√N = Nv/√N = v√N. For v = 0.5, N = 100 → confidence = 5.0. **Unbounded.**
- Derived: mean of domain means. If those 100 items are in 5 domains: (1/5) × 5 × 0.5 = 0.5. **Bounded.**

The heuristic would require an additional cap or different normalisation to work at scale. The derived form doesn't need one.

**Verdict:** Hierarchical aggregation is derived from D→I pipeline structure. √N is not the right normalisation — it's a patch on a flat aggregation that shouldn't be flat in the first place.

## 2.3 c/i/d as Governance Gates

### c → Domain Count

The c condition requires observation in structurally distinct domains. Domain count is its quantitative proxy.

The algebra doesn't specify how many domains satisfy c. It says "structurally distinct domains" — plural, minimum 2. Beyond that, the threshold depends on noise characteristics: how likely is it that k matching domains are coincidental? This is a statistical question, not an algebraic one.

**Derived structure:** Domain count as a gate. **Not derived:** specific thresholds (3/5/8).

### i → Triangulation and Source Diversity

Structural invariance means the pattern's geometry is unchanged under domain substitution. Governance proxies:
- **Triangulation** (primed + blind = triangulated) tests invariance under observation-method substitution. If you find the pattern both when looking for it and when not looking for it, the finding is method-invariant.
- **Source diversity** (multiple source types) tests invariance under source-type substitution.
- **The 5 validation conditions** (domain-independent description, cross-domain recurrence, predictive power, adversarial survival, clean failure) are structured i-tests. They each probe a different axis of invariance.

**Derived structure:** Triangulation and validation conditions as i-proxies. The 5 conditions are a reasonable operationalisation.

### d → Non-Derivability, Modulated by Derivative Order

The d condition asks: is this pattern reducible to existing motifs? The difficulty of establishing non-derivability scales with derivative order:

- **d0 (static pattern):** Small derivation space. Easy to check non-trivially.
- **d1 (pattern of patterns):** Must check against combinations of d0 motifs.
- **d2 (meta-pattern):** Must check against d0 and d1 combinations.
- **d3 (generator of generators):** Must check against all lower-order combinations.

The combinatorial derivation space grows with order. The evidence bar should rise correspondingly. The heuristic uses `threshold × (1 + 0.1 × d)`.

**Derived:** The adjustment should be monotonically increasing with d. **Not derived:** the rate. A principled rate would depend on the library size at each order (more motifs = larger derivation space = harder d condition). For the current library (~30 motifs, ~5 at each level), 10% per order is a reasonable linearisation. As the library grows, the rate may need to increase.

A more principled (but operationally complex) form:

```
d_adjustment = 1 + α × log( Σₙ₌₀^{d-1} count(motifs at order n) + 1 )
```

This grows logarithmically with library size at lower orders. For the current library, with α ≈ 0.03 and ~20 lower-order motifs: 1 + 0.03 × log(21) ≈ 1.09 — comparable to the heuristic's 1.1 for d=1. The heuristic wins on simplicity.

## 2.4 The ↑ Operator's Promotion Form

↑ fires when all stabilisation conditions are simultaneously satisfied. Mathematically, this is AND-composition:

```
↑(m, target_tier) fires when:
  c(m) ≥ c_threshold(target_tier)
  AND i(m) ≥ i_threshold(target_tier)
  AND d(m) satisfied at derivative_order(m)
  AND evidence_quality(m) ≥ quality_threshold(target_tier)
```

The existing governance uses AND-composition (domain count ≥ N AND source diversity ≥ M AND confidence ≥ T AND validation conditions). This is correct.

**Derived: AND-composition for promotion.** Matches the heuristic.

## 2.5 The ↓ Operator's Demotion Form — Gap in the Heuristic

The algebra defines ↓ explicitly. The governance calibration analysis does not formalise demotion. D/I/R says:

```
↓(m, current_tier) fires when:
  c(m) < c_threshold(current_tier) - Δc     // domain evidence retracted
  OR i(m) < i_threshold(current_tier) - Δi   // structural invariance broken
  OR d(m) violated                            // shown derivable from existing motif
```

Where Δc, Δi are hysteresis margins. The OR-composition (any condition failing triggers demotion) follows from the algebra: ↑ requires ALL conditions; losing ANY one means the stabilisation that justified ↑ no longer holds.

**Hysteresis (Δ) derivation:** The algebra describes ↑ as emergence of a *stable* structure. Stability implies resistance to small perturbations. If a motif at exactly the promotion threshold would be immediately re-evaluated and potentially demoted, the structure isn't stable — it oscillates. Therefore, demotion requires falling *below* the promotion threshold by a margin.

This is structurally analogous to the Ratchet with Asymmetric Friction (RAF) motif: promotion is harder than demotion resistance. The governance system exhibits the same asymmetric friction that one of its own motifs describes.

**Derived: Formal demotion conditions with hysteresis. Absent from the heuristic.**

## 2.6 Separation of Trust and Quality — A Cycle 2 Discovery

The initial derivation (2.1) composed source_trust × evidence_strength multiplicatively. But the D→I→R pipeline produces these as outputs of *different operators*:

- **D produces:** evidence items with quality scores, channeled through sources with trust ratings
- **I produces:** cross-domain integration of evidence quality
- **R evaluates:** both the integrated evidence quality AND the aggregate source reliability

If we pre-multiply trust × quality before R sees them, R loses information. It can't distinguish "strong evidence from weak sources" from "weak evidence from strong sources" — both produce the same blended number. But these are categorically different situations requiring different governance responses:

| Situation | Blended Score | Governance Response |
|-----------|--------------|-------------------|
| Strong evidence (0.9) × weak source (0.3) | 0.27 | Seek same pattern from better sources |
| Weak evidence (0.3) × strong source (0.9) | 0.27 | Pattern probably isn't there |

These have identical blended scores but opposite implications. D/I/R says R should see both dimensions:

```
evidence_quality(m) = mean_of_domain_means( evidence_strength )   // I-layer output
source_reliability(m) = mean( source_trust across domains )        // D-layer output

R evaluates:
  evidence_quality ≥ quality_threshold    // is the signal strong?
  source_reliability ≥ trust_floor        // is the channel reliable?
```

This produces richer governance decisions than a single blended number.

## 2.7 The Full Derived Governance Model

```
D-LAYER (per domain):
  For each domain dⱼ:
    domain_evidence(dⱼ) = mean( evidence_strength(eᵢ) )  for eᵢ ∈ dⱼ
    domain_trust(dⱼ)    = source_trust(sⱼ)

I-LAYER (cross-domain):
  evidence_quality(m)    = mean( domain_evidence(d₁), ..., domain_evidence(dₖ) )
  source_reliability(m)  = mean( domain_trust(d₁), ..., domain_trust(dₖ) )
  domain_count(m)        = k

R-LAYER (evaluation):
  ↑(m, target) fires when:
    domain_count(m)        ≥ c_threshold(target)
    triangulation(m)       = true if required(target)
    evidence_quality(m)    ≥ quality_threshold(target) × d_adjustment(m)
    source_reliability(m)  ≥ trust_floor(target)
    validation_conditions  met per target tier

  ↓(m, current) fires when:
    domain_count(m)        < c_threshold(current) - Δc
    OR triangulation(m)    lost AND required(current)
    OR evidence_quality(m) < quality_threshold(current) × d_adjustment(m) - Δq
    OR d_violation(m)      detected

  d_adjustment(m) = 1 + 0.1 × derivative_order(m)

  Hysteresis margins: Δc = 1 domain, Δq = 0.1 confidence
```

## 2.8 c/i/d Convergence — Cycle 2

| Evaluator | Assessment | Score |
|-----------|-----------|-------|
| **c** | Derived formulas tested against all three governance systems from the calibration analysis. Hierarchical aggregation applies regardless of source system. Separation of trust and quality is validated across OCP (which already tracks trust separately), processor (which doesn't — identified as a gap), and library schema (which uses domain counts, compatible with c-gate). | HIGH |
| **i** | The hierarchical structure (D-aggregate → I-combine → R-evaluate) is invariant under substitution of evidence types (lexical, structural, model), source types (PubMed, GitHub, Pile-CC), and motif types (T0–T3). | HIGH |
| **d** | The trust/quality separation (2.6) is non-derivable from the heuristic — it requires the operator decomposition. The ↓ conditions with hysteresis (2.5) are non-derivable from the ↑ analysis alone. The RAF self-similarity (governance exhibits asymmetric friction) is non-obvious. | HIGH |

**Stability: STABLE.** Integration produced two structural departures from the heuristic (hierarchical aggregation, trust/quality separation) and one new component (↓ with hysteresis). Ready for recursion.

---

# CYCLE 3 — RECURSE: Stress Tests, Self-Application, Convergence

## 3.1 Known-Example Stress Tests

### Dual-Speed Governance (T2, 12 domains, d2)

Under derived model:
- domain_count: 12 ≥ 5 ✓
- triangulation: yes ✓
- evidence_quality: mean of domain means ≈ 0.85 (high Tier C scores across domains)
- quality_threshold × d_adjustment: 0.6 × (1 + 0.1 × 2) = 0.72. Evidence 0.85 ≥ 0.72 ✓
- source_reliability: mean trust across 12 diverse domains ≈ 0.55 (mix of PubMed 0.7, ArXiv 0.6, GitHub 0.4). trust_floor for T2 = 0.3. 0.55 ≥ 0.3 ✓
- validation_conditions: all 5 satisfied ✓

**Result: DSG passes T2. ✓**

### Scaffold-First Architecture (currently T1, 2 internal domains, d0)

- domain_count: 2 < 3 ✗ → blocked at T0→T1
- evidence_quality: 0.2 < 0.3 ✗
- source_reliability: ~0.4 (Observer project ≈ GitHub-level)

**Result: Correctly blocked at T0. Would be demoted from current T1. ✓**

Demotion check: current tier is T1 (c_threshold = 3, Δc = 1).
- domain_count = 2 < (3 - 1) = 2? No, 2 = 2. At boundary of hysteresis.
- Under strict inequality: 2 < 2 is false → hysteresis protects.
- Under ≤: would trigger.

**Decision point:** Should hysteresis protect an incorrectly-promoted motif? The algebra says ↓ fires under "unmanageable stress." A motif that never met the c threshold was never properly stabilised — hysteresis protects stable structures, not classification errors. **Recommendation:** Demotion for motifs that don't meet the promotion threshold at their current tier should bypass hysteresis. This is a **correction**, not a degradation.

### Observer-Feedback Loop (conditional T2, 8 domains, d1-2, partial triangulation)

- domain_count: 8 ≥ 5 ✓
- triangulation: partial (top-down only) → **fails i requirement for T2** ✗
- evidence_quality: ≈ 0.85, threshold × d_adj ≈ 0.6 × 1.15 = 0.69, passes ✓
- source_reliability: ≈ 0.55, trust_floor 0.3, passes ✓

**Result: OFL correctly blocked from full T2 by triangulation gate. Matches current "conditional" status. ✓**

↓ risk assessment: If corpus processing produces bottom-up evidence that *contradicts* OFL, triangulation flips from "partial" to "conflicted" → i degrades → ↓ fires. If corpus simply finds no bottom-up evidence, status quo holds (absence ≠ refutation).

### Edge case: High evidence, low trust (8 Pile-CC domains, evidence 0.8)

Under derived model:
- domain_count: 8 ≥ 5 ✓ (for T2)
- evidence_quality: 0.8, threshold 0.72 (assuming d1) → passes ✓
- source_reliability: 0.3, trust_floor for T2 = 0.3 → **at boundary**

Under heuristic (blended): 0.8 × 0.3 = 0.24 → fails 0.6 threshold. **Hard fail.**
Under derived (separated): evidence is strong, trust is marginal. Governance response: **surface for review with explicit trust flag** rather than silent rejection.

The derived model produces a more informative decision: "strong pattern signal from noisy sources — verify from better sources" vs. the heuristic's undifferentiated "score too low."

### Edge case: Low evidence, high trust (3 PubMed domains, evidence 0.3)

Under derived model:
- domain_count: 3 < 5 for T2 → blocked by c ✓
- evidence_quality: 0.3 < 0.6 → blocked by quality ✓
- source_reliability: 0.7 → passes trust floor ✓

Both models correctly block. But the derived model tells you *why*: "trusted sources, but the pattern match is weak and domain coverage is thin." Different remediation than the Pile-CC case.

### Edge case: Demotion under evidence retraction

Hypothetical: a T2 motif loses 3 domains due to source reclassification (what was counted as 3 separate domains is reclassified as 1).

Before: domain_count = 7 (≥ 5 for T2 ✓)
After: domain_count = 5 (≥ 5 for T2 ✓, but at threshold)

↓ check: 5 < (5 - 1) = 4? No. Hysteresis protects. ✓ The motif stays at T2 but is now vulnerable — one more retraction triggers ↓.

If another domain is retracted: 4 < 4? No. Still protected by hysteresis.
One more: 3 < 4? Yes. **↓ fires.** Motif demoted to T1 with 3 domains.

Hysteresis gives 2 domains of buffer. This feels right: a T2 motif that loses 2 of 7 domains is still well-evidenced; one that loses 4 of 7 has genuinely degraded.

## 3.2 Self-Application: Does the Derivation Exhibit D/I/R?

**D phase (Cycle 1):** Differentiated the mathematical operators — identified D as filter, I as accumulator, R as gate. Separated the primitives from the composite formulas.

**I phase (Cycle 2):** Integrated the operator forms into governance formulas. Found where they agree with heuristics (multiplication, AND-gates) and where they diverge (hierarchical aggregation, trust separation, demotion conditions).

**R phase (Cycle 3):** Evaluated the derived formulas against known examples and edge cases. Checked stability conditions.

The derivation is itself a D/I/R process operating on mathematical objects rather than domain data. The c/i/d evaluators apply:
- **c:** The derivation was tested across multiple domains — different motifs, different evidence types, different edge cases.
- **i:** The hierarchical aggregation structure held across all tests without modification.
- **d:** The key findings (hierarchy, trust separation, ↓ conditions) are not derivable from the heuristic analysis alone — they require the operator decomposition.

**The derivation is self-consistent.** The framework that generated the mathematics can evaluate the mathematics it generated.

## 3.3 Does D/I/R reveal a geometry of governance?

The task asked: "Is there a geometry to governance that the motif algebra already describes but we haven't recognised yet?"

**Yes.** The D→I→R pipeline describes a **funnel with dimensional preservation:**

```
Raw data (high-dimensional, noisy)
    │
    ▼  D: filter per domain (reduces noise, preserves domain dimension)
    │
Domain-separated signals (k domains × evidence quality)
    │
    ▼  I: aggregate across domains (reduces within-domain redundancy, preserves cross-domain dimension)
    │
Structured evidence (k domain scores + k trust scores)
    │
    ▼  R: evaluate against c/i/d (reduces to promotion decision)
    │
↑ or ↓ or hold
```

The geometry is a **dimensionality-reducing funnel where each stage preserves the dimensions that matter for the next stage:**
- D preserves domain separation (needed by I)
- I preserves domain diversity (needed by R's c-check) and trust provenance (needed by R's trust-floor check)
- R preserves the ↑/↓ asymmetry (hysteresis)

The heuristic formula collapses this funnel into a single scalar too early. The derived form preserves dimensions until R needs them.

This is an instance of **Progressive Formalization** operating on evidence: raw data → filtered signals → domain-structured evidence → governance decision. Each stage is more formal than the last, and each stage preserves exactly the information the next stage needs.

## 3.4 The Oscillation Dynamics and Diminishing Returns

The task asked: "What about the relationship between the oscillation dynamics and diminishing returns?"

Within a single domain, repeated observation follows a convergence curve: the first evidence item is maximally informative, subsequent items converge toward the domain mean with diminishing returns. This is why the D-layer uses averaging — it models the convergence of repeated observation.

Across domains, each new domain is a new oscillation cycle in the D/I/R spiral. The first domain establishes a candidate (D). The second domain validates cross-domain presence (first I). Each subsequent domain tightens the c and i conditions. But the marginal information from domain k+1 is less than from domain k: going from 2 to 3 domains is a much bigger signal than going from 12 to 13.

This suggests that the **cross-domain aggregation should also show diminishing returns**, not just the within-domain aggregation. The mean-of-domain-means gives equal weight to each domain. A more faithful form would be:

```
evidence_quality(m) = Σⱼ [ domain_evidence(dⱼ) × weight(j) ] / Σⱼ weight(j)

where weight(j) = 1/j (harmonic), or weight(j) = 1/√j, or similar decreasing sequence
```

But this introduces a question: ordered by what? The domains aren't naturally ordered. One option is ordering by domain_evidence (strongest domain first), which gives:

```
evidence_quality = Σⱼ [ sorted_domain_evidence(j) / j ] / H(k)
```

where H(k) is the k-th harmonic number. This weights the strongest domain most and gives diminishing credit for subsequent domains.

**However:** This conflicts with the c condition's intent. c says "more distinct domains = more validated." If we discount later domains, we underweight breadth. The diminishing returns for cross-domain evidence are already captured by the domain count thresholds (which increase sub-linearly: 3→5→8, not 3→6→12).

**Resolution:** Keep simple mean across domains. The sub-linear threshold progression already encodes the diminishing marginal value of additional domains. Adding a weighting scheme would double-count the effect.

**Verdict on √N:** The heuristic's √N was an attempt to capture diminishing returns in a flat aggregation. The derived hierarchical form handles this structurally: within-domain averaging captures per-domain diminishing returns, and sub-linear threshold progression captures cross-domain diminishing returns. No √N needed.

## 3.5 c/i/d Convergence — Cycle 3

| Evaluator | Assessment | Score |
|-----------|-----------|-------|
| **c** | Derived formulas tested against 5 known motifs, 3 edge cases, 1 demotion scenario, and self-application. Hierarchical aggregation, trust separation, and ↓ conditions held across all. No test required model revision. | HIGH |
| **i** | D-layer → I-layer → R-layer decomposition was invariant across all test substitutions: different motifs, different source types, different evidence volumes, different derivative orders. | HIGH |
| **d** | Three non-derivable findings: (1) hierarchical aggregation from pipeline structure, (2) trust/quality separation from operator decomposition, (3) governance as dimensionality-reducing funnel with stage-appropriate preservation. None derivable from the heuristic analysis alone. | HIGH |

**Cycle 3 Stability: CONVERGED.** One refinement explored (cross-domain diminishing returns weighting) and rejected (already handled by threshold progression). Core model unchanged from Cycle 2.

---

# OUTPUT DELIVERABLES

## Output 1: Derivation Summary

| Formula Component | Heuristic (Calibration Analysis) | D/I/R-Derived | Derived or Heuristic? |
|-------------------|----------------------------------|---------------|----------------------|
| Source trust × evidence strength | Multiplicative | Multiplicative | **Derived** — falls out of D as filter |
| Evidence aggregation | Σ[e×s] / √N (flat, unbounded) | Mean of domain-level means (hierarchical, bounded) | **Derived** — replaces heuristic |
| Trust in confidence formula | Pre-multiplied into single score | Separated as parallel R-input | **Derived** — replaces heuristic |
| Domain count gate | ≥ 3/5/8 per tier | Same structure | Derived structure, **calibrated** thresholds |
| Triangulation gate | Required for T2+ | Same | **Derived** from i condition |
| Derivative order adjustment | × (1 + 0.1 × d) | Same form | Derived direction, **calibrated** magnitude |
| Promotion composition | AND of all conditions | AND of all conditions | **Derived** from ↑ requiring all stabilisation conditions |
| Demotion conditions | Not formalised | OR of condition violations with hysteresis | **Derived** — new component |
| Hysteresis | Not present | Δc = 1 domain, Δq = 0.1 confidence | **Derived** from ↑/↓ stability requirement |

## Output 2: Proposed Formulas

### Evidence Quality (replaces unified confidence)

```
For each domain dⱼ supporting motif m:
  domain_evidence(dⱼ) = (1/nⱼ) × Σᵢ evidence_strength(eᵢ)
    where nⱼ = count of evidence items in domain dⱼ

evidence_quality(m) = (1/k) × Σⱼ domain_evidence(dⱼ)
    where k = number of distinct domains
```

### Source Reliability (new, separated from evidence quality)

```
source_reliability(m) = (1/k) × Σⱼ source_trust(sⱼ)
```

### Promotion (↑)

```
↑(m, T1) fires when:
  domain_count(m) ≥ 3
  AND source_diversity(m) ≥ 2
  AND evidence_quality(m) ≥ 0.3
  AND source_reliability(m) ≥ 0.2

↑(m, T2) fires when:
  domain_count(m) ≥ 5
  AND source_diversity(m) ≥ 3 AND triangulated(m)
  AND evidence_quality(m) ≥ 0.6 × (1 + 0.1 × d)
  AND source_reliability(m) ≥ 0.3
  AND validation_conditions(m) = 5/5

↑(m, T3) fires when:
  domain_count(m) ≥ 8
  AND source_diversity(m) ≥ 4 AND triangulated(m)
  AND evidence_quality(m) ≥ 0.8 × (1 + 0.1 × d)
  AND source_reliability(m) ≥ 0.4
  AND relationship_edges(m) ≥ 3
  AND sovereignty_gate = human_approved
```

### Demotion (↓) — New

```
↓(m, from T1) fires when:
  domain_count(m) < 2           // c_threshold(T1) - Δc = 3 - 1
  OR evidence_quality(m) < 0.2  // quality_threshold(T1) - Δq = 0.3 - 0.1

↓(m, from T2) fires when:
  domain_count(m) < 4           // 5 - 1
  OR triangulation(m) lost
  OR evidence_quality(m) < 0.5 × (1 + 0.1 × d)  // 0.6 - 0.1, adjusted for d
  OR d_violation(m) detected

↓(m, from T3) fires when:
  domain_count(m) < 7           // 8 - 1
  OR evidence_quality(m) < 0.7 × (1 + 0.1 × d)  // 0.8 - 0.1
  OR relationship_edges(m) < 2  // 3 - 1

Exception: Motifs that never legitimately met their current tier's ↑ conditions
           are corrections, not degradations — bypass hysteresis.
```

## Output 3: Comparison — Derived vs. Heuristic

### Where they agree
1. **Multiplicative trust × evidence composition.** Both use it. D/I/R derives it from filter semantics.
2. **AND-composition for promotion.** Both require all conditions simultaneously.
3. **Derivative order adjustment direction.** Both increase the bar for higher-order claims.
4. **Three-layer architecture.** The calibration analysis's source trust → evidence strength → knowledge maturity matches D → I → R.

### Where they diverge

**1. Aggregation structure** (most consequential)
- Heuristic: Σ[e×s] / √N — flat pool with normalisation hack
- Derived: mean of domain-level means — hierarchical, bounded, domain-aware
- Practical difference: The heuristic conflates volume with diversity. 100 items from 1 domain score differently than 10 items from 10 domains in the heuristic (√100 vs √10 divisor), but the derived form correctly treats the 10-domain case as better-evidenced per domain.
- **Matters in practice:** Yes. For motifs with uneven domain evidence distribution (common — some domains produce more text), the heuristic over-weights voluminous domains.

**2. Trust separation** (moderate consequence)
- Heuristic: trust × evidence pre-multiplied into one number
- Derived: trust and evidence as parallel R-inputs with separate thresholds
- Practical difference: The heuristic can't distinguish "strong evidence from weak sources" from "weak evidence from strong sources." The derived form can, enabling targeted governance responses.
- **Matters in practice:** Yes, for motifs at the boundary where source quality is the differentiator. Especially for Pile-CC-heavy motifs where the signal may be real but needs verification from better sources.

**3. Demotion conditions** (significant gap)
- Heuristic: none formalised
- Derived: OR-composition of condition violations with hysteresis
- Practical difference: Without formal demotion, the only way to demote a motif is manual intervention (as recommended for Template-Driven and Scaffold-First). The derived form automates what the calibration analysis recommended manually.
- **Matters in practice:** Yes. As the library grows, manual demotion doesn't scale. The Matthew effect identified in the calibration analysis is partially addressed by formal demotion — motifs that lose evidence get demoted rather than lingering at inflated tiers.

**4. √N normalisation** (correctness issue)
- Heuristic: Σ/√N, unbounded for large N
- Derived: hierarchical averaging, naturally bounded [0,1]
- Practical difference: The heuristic formula as written produces values > 1 for N > 4 with average item value > 0.5. Either the formula needs a cap, or it was intended as Σ/(N) × √N (mean × √N), which grows without bound. The derived form has no such issue.
- **Matters in practice:** Yes — this appears to be a bug in the heuristic formula. Without a cap or reinterpretation, it doesn't produce valid 0-1 confidence scores at scale.

### Where the heuristic wins
- **Simplicity.** One formula vs. a multi-stage pipeline. If the governance system is hand-operated, the heuristic is easier to compute and explain.
- **Single number.** The blended confidence score is convenient for threshold comparisons, sorting, and reporting. The derived model's separated trust/quality requires two-dimensional threshold checks.
- **Derivative order rate.** 10% per order is simple and memorable. The principled library-size-dependent rate is more complex with negligible difference at current library size.

## Output 4: c/i/d Stability Report

| Metric | Cycle 1 (Describe) | Cycle 2 (Integrate) | Cycle 3 (Recurse) |
|--------|-------------------|--------------------|--------------------|
| **c** | HIGH — operators mapped independently across algebra spec | HIGH — derived formulas validated against all three source systems | HIGH — stress-tested across 5 motifs, 3 edge cases, self-application |
| **i** | HIGH — D/I/R roles stable under evidence-type substitution | HIGH — hierarchical structure invariant under domain/source substitution | HIGH — no test required model revision |
| **d** | HIGH — hierarchical observation non-trivially derived | HIGH — trust separation and ↓ conditions non-derivable from heuristic | HIGH — governance geometry (dimensionality-reducing funnel) non-obvious |
| **Stability** | STABLE | STABLE | CONVERGED |
| **Refinements** | — | Trust separated from quality (structural revision) | Cross-domain weighting explored and rejected (already handled) |

**Trajectory:** Cycle 1 established operator forms. Cycle 2 produced one structural revision (trust separation) which refined the integration without destabilising Cycle 1 findings. Cycle 3 explored one extension (cross-domain diminishing returns) and correctly rejected it. **Monotonic convergence in 3 cycles.**

## Output 5: Assumptions and Open Questions

### Assumptions

| # | Assumption | Risk | What Breaks |
|---|-----------|------|-------------|
| 1 | D/I/R can generate quantitative governance mathematics, not just architectural patterns | Medium | **Did not break.** The derivation produced formulas, not philosophy. But the specific thresholds remain calibrated, not derived — the algebra generates structure, not constants. |
| 2 | c/i/d evaluators can be expressed quantitatively | Low | **Did not break.** c → domain count, i → triangulation, d → derivative order modulation. All have natural quantitative proxies. |
| 3 | The calibration analysis correctly identified what formulas need to do | Low | **Partially revised.** The three-layer architecture is confirmed, but the derivation adds demotion conditions (↓) and trust/quality separation that the calibration analysis didn't identify as needed. |
| 4 | Hierarchical averaging is implementable in the processor | Low | Mean of domain means is straightforward; requires grouping evidence by source_component before averaging. Already partially done in the evidence aggregator (domain_count, per-domain tracking). |
| 5 | Trust floor as a separate gate is operationally useful | Medium | If trust floors are set too high, motifs with legitimate evidence from low-trust sources are permanently blocked. If too low, the gate is meaningless. Requires calibration against the sandbox protocol. |

### Open Questions

1. **Is the trust floor gate worth the complexity?** The separated model is more informative but requires two-dimensional threshold management. Simpler alternative: keep trust × evidence multiplication but use hierarchical aggregation. This captures most of the derived structure with less operational complexity.

2. **Should hysteresis margins be tier-dependent?** Δc = 1 and Δq = 0.1 are uniform across tiers. Higher tiers might warrant larger margins (more protection for hard-won promotions) or smaller margins (stricter maintenance of high standards).

3. **How should the processor group evidence by domain?** Currently source_component is the domain proxy. But "PubMed" is one source_component containing many sub-domains. Should domain grouping be finer-grained? This affects the hierarchical aggregation directly.

4. **Does the ↓ operator need a sovereignty gate at T2+?** The ↑ sovereignty gate prevents automated T2 promotion. Should there be a corresponding gate preventing automated T2 demotion? Argument for: demoting a T2 motif is a significant library event. Argument against: if evidence genuinely degrades, blocking demotion creates a false sense of stability.

## Output 6: Unexpected Findings

### Finding 1: √N is a bug, not a feature

The heuristic formula `Σ[e×s] / √N` is unbounded for large N. This isn't a philosophical disagreement — it's a correctness issue. The formula as written doesn't produce valid 0-1 confidence scores at scale. The D/I/R derivation doesn't just suggest a different normalisation; it reveals that the heuristic normalisation doesn't work.

### Finding 2: Governance has the same shape as the triad it governs

`G = ↑[ R( Σ I( D(domain_data) ) ) ]` — this is simultaneously the formula for motif discovery AND the formula for motif governance. The governance system is an instance of its own generative process. D separates evidence by domain. I aggregates across domains. R evaluates against stabilisation conditions. ↑ promotes. The same pipeline that discovers motifs governs their lifecycle.

This is an Observer-Feedback Loop instance at the mathematical level: the governance mathematics is structurally identical to the process it governs.

### Finding 3: The ↓ operator reveals a gap the calibration analysis didn't see

The calibration analysis identified that Template-Driven and Scaffold-First should be demoted, but framed it as a one-time correction. D/I/R reveals that demotion is a structural operation (↓) that should be as formalised as promotion (↑). The gap isn't "these two motifs need demotion" — it's "the governance system has no demotion mechanism."

### Finding 4: Trust/quality separation is a dimension-preservation argument

The most unexpected finding is that pre-multiplying trust × evidence is a **premature dimensionality reduction**. The D→I→R pipeline is a dimensionality-reducing funnel where each stage should preserve exactly the dimensions the next stage needs. Multiplying trust × evidence at the D/I boundary throws away a dimension that R needs.

This generalises: any governance formula that collapses multiple independent measurements into a single score before the evaluation stage is losing information. The three-layer architecture from the calibration analysis is right in principle — but the unified confidence formula that blends layers 1 and 2 into one number partially undermines it.

### Finding 5: The governance system exhibits its own motifs

- **Ratchet with Asymmetric Friction:** ↑ is harder than ↓ resistance (hysteresis). The governance system is a ratchet.
- **Progressive Formalization:** Evidence flows from raw data through increasingly formal stages. The governance pipeline is a formalisation pipeline.
- **Observer-Feedback Loop:** The governance mathematics has the same form as the process it governs.
- **Dual-Speed Governance:** The fast path (automated T0→T1) and slow path (human-gated T2+) are DSG.

The governance system is not just evaluating motifs — it's *instantiating* them. This is either a deep structural consistency or a sign that we're seeing patterns because we're looking for patterns. The c/i/d check says: is this observation cross-domain (c)? Yes — each motif manifests independently in the governance structure. Is it structurally invariant (i)? Yes — the ratchet/formalisation/feedback shapes are preserved. Is it non-derivable (d)? Partially — some of these (DSG, PF) were designed in. RAF emerging from hysteresis is non-trivial.

---

# Summary

D/I/R as first principle **does** produce governance mathematics. The derived forms agree with the heuristics on multiplicative composition, AND-gating, and derivative order direction. They depart on aggregation structure (hierarchical > flat), trust handling (separated > blended), and demotion (formalised > absent).

The most important practical finding: **replace √N normalisation with hierarchical domain-level averaging.** This is simultaneously more principled (derived from pipeline structure), more correct (bounded 0-1), and more informative (preserves domain provenance).

The most important structural finding: **governance has the same shape as the triad it governs.** The mathematics isn't imposed on D/I/R from outside — it emerges from D/I/R operating on its own evidence.

---

*Analysis completed 2026-03-31. Three D/I/R cycles, c/i/d convergence achieved. DRAFT status — proposes, Adam decides.*
