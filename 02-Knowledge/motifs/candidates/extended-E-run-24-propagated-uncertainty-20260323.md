---
title: "Extended E Run 24: Propagated Uncertainty Envelope — Triangulation Gap Closure"
date: 2026-03-23
status: draft
target_motif: propagated-uncertainty-envelope
target_gap: "source: bottom-up only — needs top-down evidence"
---

# Extended E Run 24: Propagated Uncertainty Envelope — Triangulation Gap Closure

## Objective

Close the triangulation gap for Propagated Uncertainty Envelope (Tier 0, confidence 0.1, source: bottom-up only). Currently two bottom-up instances from OCP scrape (Control Theory, Decision Theory). Need 2-3 top-down instances derived from first principles.

**Structural invariant under test:** A system that models its own ignorance as a first-class quantity and propagates that meta-knowledge through its dynamics alongside its state estimate.

**Three-part structural test:**
- (a) Uncertainty is STRUCTURED (not just an error bar)
- (b) It TRANSFORMS through system dynamics (not static)
- (c) Decisions use the JOINT representation (not point estimate alone)

---

## Top-Down Instance 1: Portfolio Theory / Financial Economics

### First-Principles Derivation

Start from a minimal axiom: an investor holds multiple assets whose future returns are unknown. What does rational allocation require?

**Step 1: Why point estimates fail.** If you model each asset by its expected return alone, you cannot distinguish between a 10% return with 2% volatility and a 10% return with 40% volatility. Any allocation framework that ignores this distinction is degenerate — it treats qualitatively different risk profiles as identical. Therefore uncertainty must be represented, not discarded.

**Step 2: Why uncertainty must be structured.** Two assets can each have 20% volatility but be perfectly negatively correlated — holding both eliminates risk entirely. A scalar uncertainty per asset (variance alone) cannot capture this. The minimum sufficient representation is the covariance matrix: an NxN structured object encoding pairwise uncertainty relationships across all N assets. This is not an optional enrichment; it is the irreducible representation needed to solve the allocation problem.

**Step 3: Why uncertainty must propagate through dynamics.** A portfolio is not a static object. It transforms through time via rebalancing, compounding, and regime changes. The covariance matrix at time t must be propagated forward to time t+1 via the system's dynamics: changing correlations, volatility clustering (GARCH effects), contagion during crises. Risk models that treat covariance as static (e.g., using a fixed historical window) fail precisely when they matter most — during regime transitions. The covariance envelope must transform alongside the state (portfolio weights, market regime).

**Step 4: Why decisions use the joint representation.** Markowitz mean-variance optimization explicitly takes the expected return vector AND the covariance matrix as co-equal inputs. The efficient frontier is defined by the envelope, not the point estimates. Value-at-Risk (VaR) and Conditional VaR (CVaR) are functions of the full distributional shape. Risk budgeting allocates not return but uncertainty across portfolio components. The decision surface is defined by the joint (estimate, uncertainty) representation.

### Structural Test

| Criterion | Assessment |
|-----------|-----------|
| (a) Uncertainty is structured | YES — covariance matrix encodes pairwise relationships; not reducible to per-asset scalars |
| (b) Transforms through dynamics | YES — covariance propagates via GARCH, regime-switching models, contagion dynamics; changes shape through time |
| (c) Decisions use joint representation | YES — efficient frontier, VaR/CVaR, risk parity all require the covariance envelope as a first-class input |

### Structural Fit Rating

**Strong.** This is arguably the cleanest non-engineering instance of the pattern. The covariance matrix is the uncertainty envelope; it propagates through portfolio dynamics; and the entire decision framework (Markowitz optimization) is defined on the joint representation. The derivation is purely top-down: the structure is forced by the axioms of rational allocation under correlated uncertainty.

### Source
- **Source:** top-down (first-principles derivation from rational allocation axioms)
- **Domain:** Financial Economics / Portfolio Theory
- **Expression:** The covariance matrix of asset returns is a structured uncertainty envelope that propagates through portfolio dynamics (rebalancing, regime shifts, volatility clustering) and co-determines all allocation decisions alongside expected returns. Mean-variance optimization, VaR, CVaR, and risk parity are all functions of the joint (return estimate, covariance envelope) representation. A portfolio manager who discards the covariance structure and allocates on expected returns alone is not merely imprecise — they are solving a structurally different (and degenerate) problem.

---

## Top-Down Instance 2: Jurisprudence / Legal Reasoning

### First-Principles Derivation

Start from a minimal axiom: a legal system must decide factual disputes using evidence that is inherently uncertain. What does principled adjudication require?

**Step 1: Why point estimates fail.** A trial concerns propositions ("defendant was at the scene," "contract was breached") whose truth values are unknown. A system that deals only in binary conclusions (true/false) cannot reason about chains of evidence — it has no way to express that one premise is well-supported while another is shaky, and therefore the conclusion inherits the weakness of its weakest link. Uncertainty must be represented.

**Step 2: Why uncertainty must be structured.** Legal uncertainty is not a single number. It has at least three distinct structural components:
- **Standard of proof** — the threshold envelope (preponderance of evidence ~51%, clear and convincing ~75%, beyond reasonable doubt ~95%). This is not a point but a regime that constrains what kind of uncertainty is tolerable.
- **Evidential weight** — individual pieces of evidence carry different probative values, and these interact (corroborating evidence is super-additive; contradictory evidence is sub-additive). The structure is relational, not scalar.
- **Burden allocation** — which party bears the uncertainty cost is itself a structured quantity that shifts during proceedings (e.g., prima facie case shifts burden, affirmative defenses shift it back).

This is a multi-dimensional uncertainty representation: (standard, weight-structure, burden-position). Not an error bar.

**Step 3: Why uncertainty must propagate through dynamics.** A trial is a sequential process. Evidence is introduced over time, and each new piece of evidence transforms the uncertainty envelope:
- A witness's testimony updates the weight structure (corroboration or contradiction).
- A successful motion to exclude evidence removes a component, restructuring the envelope.
- Shifting burden (e.g., after prima facie case established) transforms the threshold regime applied to the remaining uncertainty.
- Appellate review propagates the trial's uncertainty envelope through a different standard (abuse of discretion, de novo review) — the uncertainty is not re-evaluated from scratch but transformed through a new dynamic.

The uncertainty envelope at verdict is the product of these sequential transformations, not a static assessment.

**Step 4: Why decisions use the joint representation.** The verdict is not "did the event happen?" (point estimate) but "given the evidence, the standard of proof, the burden allocation, and the accumulated weight structure, is the uncertainty envelope on one side of the threshold?" Jury instructions explicitly require the joint assessment: "If you find, by a preponderance of the evidence..." The standard of proof IS the decision boundary defined on the uncertainty envelope, not on a point estimate of truth.

### Structural Test

| Criterion | Assessment |
|-----------|-----------|
| (a) Uncertainty is structured | YES — multi-dimensional: (standard of proof, evidential weight structure, burden position); not a single probability |
| (b) Transforms through dynamics | YES — each evidentiary event, motion, or burden shift transforms the envelope; appellate review applies a further transformation |
| (c) Decisions use joint representation | YES — verdict is defined as the uncertainty envelope relative to the standard-of-proof threshold; jury instructions encode this explicitly |

### Structural Fit Rating

**Moderate-to-strong.** The structural mapping is genuine but less mathematically crisp than the portfolio theory instance. The "covariance matrix" analog is the multi-dimensional (standard, weight, burden) structure, which is less formally specified than a covariance matrix but serves the same structural role: it is the irreducible representation of what the system does not know, and it drives decisions. The propagation through trial dynamics is real and well-documented in evidence law.

One risk: the legal system does not always make the uncertainty envelope explicit. Juries are not handed probability distributions. The pattern operates implicitly — the structure is there but the formalism is verbal and procedural rather than mathematical. This does not disqualify the instance (the structural invariant does not require mathematical formalism), but it does make the mapping less sharp.

### Source
- **Source:** top-down (first-principles derivation from adjudication under evidential uncertainty)
- **Domain:** Jurisprudence / Evidence Law
- **Expression:** Legal proceedings maintain a structured uncertainty envelope comprising the standard of proof (threshold regime), evidential weight structure (relational probative values), and burden allocation (which party bears epistemic cost). This envelope transforms sequentially through the dynamics of trial: testimony, motions, burden shifts, and appellate review each apply a transformation to the envelope. The verdict is a decision made on the joint representation — the jury evaluates whether the transformed uncertainty envelope crosses the standard-of-proof threshold, not whether a point estimate of truth exceeds 50%.

---

## Top-Down Instance 3: Harmonic Analysis / Music Theory

### First-Principles Derivation

Start from a minimal axiom: a listener encounters a sequence of chords whose harmonic function is not determined by any single chord in isolation. What does coherent harmonic perception require?

**Step 1: Why point estimates fail.** A C major triad could function as I in C major, IV in G major, V in F major, bVI in E minor, or several other roles. Assigning a single function (point estimate) to the chord in isolation is underdetermined. Any perceptual system that commits to a single interpretation at the moment of hearing the chord must either guess (and often be wrong) or defer (maintaining uncertainty).

**Step 2: Why uncertainty must be structured.** The ambiguity is not a scalar "how uncertain am I?" It has structure:
- **Key-space distribution** — a probability distribution across possible keys (or tonal centers), where each key implies a different function for the chord. This is a structured object over a discrete space.
- **Functional-role weights** — within each candidate key, the chord may have multiple plausible functions (e.g., V vs. V/vi). The uncertainty is hierarchical: (key uncertainty) x (function-within-key uncertainty).
- **Voice-leading expectations** — each candidate interpretation generates different predictions for what should follow, and these predictions have different strengths. The uncertainty envelope includes these forward-looking expectations.

This is at minimum a joint distribution over (key, function, expected-continuation). Not a scalar.

**Step 3: Why uncertainty must propagate through dynamics.** Each subsequent chord in the progression transforms the uncertainty envelope:
- A chord that is consistent with one key but not another narrows the key-space distribution (Bayesian update).
- A deceptive cadence (V to vi instead of V to I) does not merely surprise — it restructures the entire envelope by invalidating the highest-probability continuation while confirming the key.
- Modulations propagate a transformation of the key-space distribution that reweights the entire envelope, often gradually (pivot chord sequences).
- Tonicization temporarily shifts the envelope without destroying the parent-key distribution — the listener maintains a nested uncertainty structure.

The perception of harmonic function at any point in a progression is the result of propagating the uncertainty envelope through the dynamics of the chord sequence, not a local assessment.

**Step 4: Why decisions use the joint representation.** The listener's (or analyst's) experience of harmonic tension, resolution, surprise, and coherence is a function of the full envelope, not any single interpretation:
- **Tension** arises when the envelope is wide (multiple competing interpretations) or when it concentrates on an unstable function.
- **Resolution** is the envelope collapsing onto a stable interpretation.
- **Surprise** (as in a deceptive cadence) is the envelope being sharply restructured.
- Composers who exploit harmonic ambiguity (Wagner, Debussy, jazz harmony) are manipulating the envelope itself as an expressive parameter. The decision "what does this chord mean?" is answered by the joint representation.

### Structural Test

| Criterion | Assessment |
|-----------|-----------|
| (a) Uncertainty is structured | YES — joint distribution over (key, function, expected continuation); hierarchical, not scalar |
| (b) Transforms through dynamics | YES — each chord in the progression updates/restructures the envelope; modulations, deceptive cadences, and tonicizations are specific transformation operators |
| (c) Decisions use joint representation | YES — tension, resolution, and surprise are properties of the envelope, not of any single interpretation; composers manipulate the envelope as expressive material |

### Structural Fit Rating

**Strong.** This instance is particularly interesting because it demonstrates the pattern in a non-quantitative domain. The "covariance matrix" analog is the joint distribution over key-function-continuation space. The "dynamics" are the chord progression itself. The "decision" is the perceptual/analytical assessment of harmonic meaning. The mapping is structurally tight: replacing the uncertainty envelope with a point estimate (committing to a single key at each moment) produces a qualitatively impoverished model that cannot account for the experience of harmonic ambiguity, which is one of the primary expressive dimensions of tonal music.

The derivation is top-down: starting from the underdetermination of chord function in isolation, the necessity of a structured uncertainty representation that propagates through the harmonic dynamics follows from first principles.

### Source
- **Source:** top-down (first-principles derivation from harmonic underdetermination)
- **Domain:** Music Theory / Harmonic Perception
- **Expression:** Harmonic perception maintains a structured uncertainty envelope over (key, chord function, expected continuation) that propagates through the dynamics of a chord progression. Each chord transforms the envelope via Bayesian-like updates: confirming or disconfirming candidate keys, restructuring functional-role weights, and generating new continuation expectations. The perceptual qualities of tension, resolution, and surprise are properties of the envelope itself — not of any single interpretation. Composers exploit this by manipulating harmonic ambiguity as a first-class expressive parameter (Wagner's "Tristan" chord, Debussy's whole-tone passages, jazz tritone substitutions).

---

## Summary

| # | Domain | Structural Fit | Source | Key Structure |
|---|--------|---------------|--------|---------------|
| 3 | Financial Economics / Portfolio Theory | Strong | top-down | Covariance matrix propagated through portfolio dynamics; decisions via mean-variance optimization |
| 4 | Jurisprudence / Evidence Law | Moderate-to-strong | top-down | (Standard, weight, burden) envelope propagated through trial dynamics; verdict via threshold on envelope |
| 5 | Music Theory / Harmonic Perception | Strong | top-down | (Key, function, continuation) distribution propagated through chord progression; perception via envelope properties |

## Triangulation Assessment

The three top-down instances are derived from first principles in domains with no evident connection to the original bottom-up domains (control theory, decision theory). The structural test passes in all three cases, with varying degrees of mathematical crispness:

- **Portfolio Theory** is the most formally precise — the covariance matrix is literally the uncertainty envelope, and the entire Markowitz framework is defined on it.
- **Music Theory** is the most surprising — it demonstrates the pattern in a domain where the "uncertainty" is perceptual and the "dynamics" are aesthetic, yet the structural mapping is tight.
- **Jurisprudence** is the most institutionally embedded — the pattern is encoded in procedural law (burden shifting, standards of proof, jury instructions) without being mathematically formalized.

Together with the two existing bottom-up instances, this gives 5 domain instances across 5 unrelated domains. The pattern is now triangulated (bottom-up + top-down) and has sufficient domain coverage for Tier 1 auto-promotion, and is a candidate for Tier 2 review pending validation protocol.

## Recommended Motif Updates

If Adam approves these instances:

1. **Add Instances 3, 4, 5** to `propagated-uncertainty-envelope.md`
2. **Update frontmatter:**
   - `tier: 1` (auto-promotion: 5 domains > 2 threshold)
   - `confidence: 0.7` (base 0.1 + 0.3 for 3 new domains + 0.2 for triangulation + 0.1 for existing 2nd domain)
   - `source: triangulated`
   - `domain_count: 5`
3. **Update MOTIF_INDEX.md** accordingly
4. **Evaluate for Tier 2 candidacy** — 5 domains, triangulated, structured falsification conditions already present
