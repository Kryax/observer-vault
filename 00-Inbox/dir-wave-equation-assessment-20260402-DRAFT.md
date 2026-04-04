---
status: SUPERSEDED
date: 2026-04-02
type: research-direction
superseded_by: 00-Inbox/qho-falsification-langevin-reframing-20260403-DRAFT.md
superseded_date: 2026-04-03
superseded_reason: >-
  QHO falsified (≤2/5 tests). Replaced by Langevin/multi-well dissipative model
  (5/5 tests under reframed predictions). See superseding document for full results.
source: Atlas mathematical assessment of Gemini's D/I/R wave equation proposal
vault_safety: >
  Analysis document. Does not modify code, configuration, or any existing artifact.
  Documents a research direction for future exploration. Final theoretical document this cycle.
predecessors:
  - 02-Knowledge/architecture/motif-algebra-v1.0-spec.md
  - 00-Inbox/geometric-encoding-dir-assessment-20260402-DRAFT.md
  - 00-Inbox/motif-algebra-v1-empirical-validation-20260402-DRAFT.md
instruments:
  - Atlas (mathematical assessment, adversarial)
  - Gemini (wave equation proposal)
  - Adam (direction, context)
---

# D/I/R Wave Equation — Assessment and Documentation

**Date:** 2 April 2026
**Purpose:** Document, scrutinise, and determine implementability of Gemini's continuous wave equation mapping of D/I/R.

---

## 1. The Proposed Equation

### Operator Mappings

| Primitive | Differential Operator | Justification |
|-----------|----------------------|---------------|
| D (Distinction) | −d∇² (negative Laplacian, scaled) | The Laplacian measures how a value at a point differs from the average of its neighbours. It IS a distinction operator — it detects edges, boundaries, discontinuities. In image processing, ∇² is literally an edge detector. |
| I (Integration) | +k\|x\|² (harmonic potential well) | A quadratic potential pulls things toward a centre. It creates coherence and binding — separated parts experience a restoring force toward unity. |
| R (Recursion) | iτ ∂/∂t (temporal derivative, scaled) | The time derivative makes each state depend on its predecessor. This IS recursion in continuous form — the system's future is a function of its past. The imaginary unit i makes the evolution unitary (structure-preserving). |

### The Wave Equation

```
iτ ∂Ψ/∂t = (−d∇² + k|x|²)Ψ
```

Where:
- Ψ(x,t) is a field over some configuration space (the "field of unstructured potential")
- d is the "distinction strength" (diffusion coefficient)
- k is the "integration strength" (binding coefficient)
- τ is the "recursion rate" (temporal scale)
- x is position in the configuration space

### Stationary Solutions

Separating Ψ(x,t) = ψ(x)e^{−iωt} gives the time-independent eigenvalue problem:

```
(−d∇² + k|x|²)ψ_n = E_n ψ_n
```

This is structurally identical to the quantum harmonic oscillator (QHO).

### The Claim

The eigenstates ψ_n are the motif library. Each eigenstate is a stable standing-wave pattern. The eigenvalues E_n are the tiers. The library is finite at any energy cutoff because the QHO has discrete, quantised energy levels.

---

## 2. Mathematical Scrutiny

### Is the equation well-formed?

**Yes.** The equation iτ ∂Ψ/∂t = (−d∇² + k|x|²)Ψ is a linear PDE with well-understood properties. It has:
- A complete orthonormal basis of eigenstates (Hermite functions in 1D, products thereof in higher dimensions)
- Discrete energy spectrum: E_n = ℏω(n + dim/2) where ω = √(k/d) and dim is the dimension
- Unitary time evolution (structure is preserved, probability mass is conserved)

The mathematics is unimpeachable. The equation is exactly the quantum harmonic oscillator. The QUESTION is whether the mapping from D/I/R to these operators is justified.

### Mapping Assessment: D → −d∇²

**Strength: MODERATE-STRONG.**

The Laplacian genuinely measures local distinction. At any point, ∇²f measures how much f(x) differs from the average of f in a neighbourhood around x. Points where ∇²f is large are points where the value is sharply different from its surroundings — i.e., boundaries, edges, discontinuities.

This isn't just analogy. In physics:
- ∇² drives diffusion (heat equation: ∂T/∂t = α∇²T). Sharp distinctions diffuse over time.
- ∇² detects edges (Laplacian of Gaussian is a standard edge detector in computer vision).
- −∇² is the kinetic energy operator in quantum mechanics — it measures how "wavy" the function is, which is how much local structure/distinction it contains.

**Limitation:** The Laplacian is isotropic — it treats all spatial directions equally. D in the motif algebra isn't necessarily isotropic. Some distinctions may be "sharper" along certain axes than others. An anisotropic generalisation (−∇·(D̃∇) with D̃ a tensor) would be more general but would break the clean QHO form.

**Verdict:** The strongest mapping of the three. D as Laplacian has genuine mathematical content, not just metaphor.

### Mapping Assessment: I → +k|x|²

**Strength: MODERATE, with a critical caveat.**

A harmonic potential IS a binding force. It creates coherence — pulls things toward a centre, provides a restoring force against fragmentation. Separated parts are "attracted" back.

**The critical caveat:** The quadratic form k|x|² is the simplest possible confining potential. It's also the UNIVERSAL first-order approximation to any confining potential near its minimum (Taylor expand V(x) around x₀: V(x) ≈ V(x₀) + ½V''(x₀)(x−x₀)², and V''(x₀) > 0 for a minimum). This means:

**Any system with stable attractors looks like a harmonic oscillator near those attractors.**

This is not a discovery about D/I/R. It's a mathematical theorem about potentials near minima. The QHO form follows from "the system has stable states" — which is something we assumed from the start (motifs are stable patterns).

The mapping I → k|x|² says: "Integration creates a confining potential, and near the bottom of that potential the confining force is approximately linear (Hooke's law)." The first claim is substantive. The second is automatic for any smooth potential.

**Verdict:** The existence of a confining potential is justified. The specific quadratic form is the generic approximation, not a structural claim about I.

### Mapping Assessment: R → iτ ∂/∂t

**Strength: MODERATE.**

The time derivative generates temporal evolution. The state at t+dt is determined by applying the Hamiltonian to the state at t. This IS iterative self-application — continuous recursion.

The imaginary unit i is doing specific work: it makes the evolution unitary. |Ψ|² is conserved. Nothing is gained or lost — the system evolves but its total "weight" is preserved. This is a physical claim about R: recursion preserves structural content while changing its form. That's defensible — a system that reflects on itself shouldn't gain or lose information in the reflection.

**Limitation:** R in the motif algebra is more than just "the next state depends on the current state." R is specifically SELF-application — the system applying its own operation to itself. The time derivative captures temporal dependence but not the self-referential character. In the QHO, the time derivative drives evolution under an EXTERNAL Hamiltonian. In D/I/R, R drives evolution under ITSELF. This is a meaningful distinction that the mapping doesn't capture.

**Verdict:** Captures recursion-as-iteration. Misses recursion-as-self-reference.

### Overall Mapping Validity

| Mapping | Validity | What it captures | What it misses |
|---------|----------|-----------------|----------------|
| D → −d∇² | Moderate-strong | Local distinction, boundary detection, diffusion | Anisotropy, non-local distinction |
| I → +k\|x\|² | Moderate | Binding force, confinement, coherence | Non-quadratic binding (automatic near-minimum approximation) |
| R → iτ ∂/∂t | Moderate | Temporal recursion, structure-preserving iteration | Self-referential character of R |

---

## 3. Eigenstate Analysis

### 3D QHO Spectrum

If the configuration space has three dimensions (one per axis: x_D, x_I, x_R), the eigenstates are products of 1D Hermite-Gaussian functions:

```
ψ_{n_D, n_I, n_R}(x_D, x_I, x_R) = H_{n_D}(x_D) · H_{n_I}(x_I) · H_{n_R}(x_R) · e^{−(x_D² + x_I² + x_R²)/2}
```

where H_n are Hermite polynomials and n_D, n_I, n_R ≥ 0 are integers.

Energy levels: E = ℏω(n_D + n_I + n_R + 3/2)

The total quantum number N = n_D + n_I + n_R determines the energy level. Degeneracy of level N is (N+1)(N+2)/2.

### State Count by Level

| Level N | Degeneracy | Cumulative | Interpretation as Tier |
|---------|-----------|------------|----------------------|
| 0 | 1 | 1 | Ground state: (0,0,0). All axes balanced at minimum energy. |
| 1 | 3 | 4 | Three states: (1,0,0), (0,1,0), (0,0,1). Single-axis excitation. |
| 2 | 6 | 10 | Six states including (1,1,0), (2,0,0), etc. Two-axis and double-single excitations. |
| 3 | 10 | 20 | Ten states. Full combinatorial complexity at three quanta. |

**Cumulative through N=3: 20 states.**

### Comparison to Motif Library

The v1.0 spec predicts 16 ± 3 ideal motifs. The current library has 20 documented motifs (4 at Tier 2, others at Tier 0-1). The QHO through N=3 gives exactly 20 states.

**Assessment: This numerology is interesting but MUST NOT be trusted.**

Reasons for caution:

1. **The motif count is uncertain.** "16 ± 3" overlaps with "20" but also with "13" or "19." The match isn't precise.

2. **N=3 is arbitrary.** Why stop at N=3? The QHO has infinite levels. The claim "motifs correspond to N=0-3" requires a justification for the cutoff. The v1.0 spec's Tier 4 ceiling proof provides one (I(I) applied to Tier 3 collapses back to Tier 2), but this proof is algebraic, not wave-mechanical. The wave equation by itself predicts no ceiling.

3. **Numerological coincidence is common.** 20 is a small enough number that many unrelated mathematical structures produce it. C(6,3) = 20. 4! + (-4) = 20. The 3D QHO through N=3 = 20. These are not related.

4. **The degeneracy structure doesn't obviously match tiers.** Tier 0 in the library has ~14 entries. Tier 2 has 4. The QHO level N=0 has 1 state and N=3 has 10. The distribution doesn't match.

**Verdict:** Note the numerological coincidence. Don't build on it. If the library stabilises at exactly 20 after extensive scraping, revisit. If it stabilises at 25 or 15, the coincidence was just that.

### What the QHO Structure DOES Predict (Testably)

Even setting aside the count, the QHO structure makes specific predictions:

1. **Ground state is unique and maximally symmetric.** N=0 has one state with equal weight on all three axes. If this corresponds to a motif, it should be the most symmetric and most stable pattern in the library — one where D, I, and R are equally active. Candidate: ISC (Idempotent State Convergence), which is the canonical balanced motif. Or possibly "Structural Coupling as Ground State" (SC) — which even has "ground state" in its name.

2. **First excited states separate by axis.** N=1 has three states, each with one axis excited. These should be the three "pure" motifs — predominantly D, predominantly I, predominantly R. The library's Tier 1 motifs should cluster into three groups by dominant axis. This IS testable with the existing axis vector data.

3. **Higher levels have increasing degeneracy.** More motifs at higher tiers. But the library shows the opposite — fewer at higher tiers (many Tier 0, few Tier 2, draft Tier 3). This CONTRADICTS the QHO prediction unless we interpret lower tiers as higher energy (less stable, more numerous because they haven't been pruned yet). The inversion would mean Tier 0 = highest energy (most unstable, most numerous) and Tier 2 = lowest energy (most stable, fewest). This actually makes sense: Tier 0 motifs are fragments that haven't stabilised. Tier 2 motifs are the confirmed stable ones. Stability = low energy = ground state. The "inverted" reading is defensible.

4. **Energy gap between levels predicts stability gap between tiers.** The QHO has equal spacing (ΔE = ℏω between levels). This predicts equal difficulty in tier promotion — going from Tier 0 → Tier 1 should be equally hard as Tier 1 → Tier 2. In practice, Tier 0 → 1 seems easier than 1 → 2 (more motifs make the jump). This may contradict equal spacing, or it may reflect the different population sizes.

---

## 4. The Critical Question: Discovery or Curve-Fitting?

### The case that this is a genuine discovery

1. The Laplacian genuinely IS a distinction operator. This isn't forced — it's the standard mathematical formalism for local difference.
2. The harmonic potential genuinely IS a binding/integration mechanism. Restoring forces create coherence.
3. The time derivative genuinely IS continuous recursion. Temporal evolution IS iterative self-application.
4. The resulting equation has exactly the properties the motif algebra predicts: discrete stable states, quantised tiers, natural finiteness at any energy cutoff, degradation via damping.

### The case that this is curve-fitting

1. **The QHO is the universal attractor of "anything with stable states near equilibrium."** The Taylor expansion argument means EVERY system with stable attractors looks like a QHO locally. Mapping D/I/R to the QHO might just mean "D/I/R has stable states" — which we assumed from the start.

2. **The mapping was chosen to produce the QHO.** If you want a wave equation with discrete eigenstates, the QHO is the simplest one that has them. Starting from "I want discrete stable states" and working backward gives you the QHO automatically. The mapping D → ∇², I → |x|², R → ∂/∂t may have been reverse-engineered from the desired result.

3. **Three free parameters (d, k, τ) can be tuned to match any count.** The energy cutoff that determines how many states you get is not predicted by the theory — it's a free parameter. You can always choose the cutoff to match the observed motif count.

4. **The specific predictions (ground state = ISC, inverted tier interpretation, equal energy spacing) haven't been tested.** The equation makes predictions, but none have been confirmed. An untested prediction is not evidence.

### Verdict on Discovery vs. Curve-Fitting

**The equation is very likely the universal first-order approximation, not a deep structural identity.**

Here's why: the QHO emerges whenever you have (1) a conservative force near equilibrium and (2) a continuous configuration space. Condition (1) is just "stable patterns exist." Condition (2) is "the D/I/R axes are continuous." Both were assumed a priori.

This doesn't make the equation useless. The universal approximation is still a useful approximation. Near-equilibrium physics works. But it means the equation tells us less about D/I/R specifically and more about "systems with stable states generally."

**The equation is valid mathematics, a reasonable first-order model, and a useful engineering tool. It is probably not a deep ontological identity between D/I/R and quantum mechanics.**

### What Would Change This Assessment

If any of the following were observed, the equation would be promoted from "universal approximation" to "structural identity":

1. **Anharmonic corrections match.** The QHO is the first-order approximation. Higher-order terms (cubic, quartic corrections to the potential) produce specific anharmonic shifts in the energy levels. If those shifts matched observed tier-promotion difficulties in the library, the equation has content beyond first order.

2. **Degeneracy matches.** If the motif count per tier matches (N+1)(N+2)/2 exactly, across tiers, the QHO structure is doing real work.

3. **Selection rules match.** The QHO has specific selection rules: transitions only between adjacent levels (Δn = ±1). If motif evolution follows this rule (motifs only promote/demote one tier at a time, never skip), the wave equation predicts the dynamics.

4. **The ground state is identifiable.** If exactly one motif is maximally symmetric (equal D/I/R weight, maximum stability), and it matches the QHO ground state's properties (Gaussian profile, no nodes), the mapping has predictive teeth.

None of these have been tested. They are the empirical programme that would validate or falsify the wave equation.

---

## 5. Implementable Components

### Regardless of whether the equation is "true"

**5.1 Continuous D/I/R Space (Implement Now)**

The `AxisVector` type already has continuous components (differentiate: number, integrate: number, recurse: number). Treat this as a 3D vector space. Every verb record is a point. Every motif is a region.

Currently these are used as independent scores. The wave equation suggests they should be treated as a JOINT space with structure — distance, clustering, and basins.

Implementation: no code change needed to the type. Change how it's used: instead of checking axis values independently, compute distances between records in the 3D space. Records near each other are structurally similar.

**5.2 Clustering Test (Implement Next Sprint)**

Take the existing axis-classified verb records. Extract their (D, I, R) vectors. Run K-means with K=9 (nine first-order compositions). Check:
- Do 9 natural clusters emerge?
- Do the cluster centres correspond to the predicted compositions? (D(D) should cluster at high-D; R(I) should cluster at high-R, moderate-I; etc.)
- Is within-cluster variance lower than between-cluster variance?

This is the minimum viable test of BOTH the geometric hypothesis and the wave equation. It requires no neural network, no labeled data beyond axis scores, and runs in minutes on any hardware.

If 9 clusters don't emerge naturally, the continuous space doesn't have the predicted structure, and neither the geometric hypothesis nor the wave equation has empirical support at the data level.

If 9 clusters DO emerge, proceed to test whether their locations match predictions.

**5.3 Energy as Stability Metric (Implement If Clustering Works)**

Define "energy" for a verb record as:

```
E(v) = d * ||∇v||² + k * ||v||²
```

where ||∇v||² approximates local distinction (how different this record is from its neighbours in the continuous space) and ||v||² is the distance from the origin (how "excited" it is on all axes combined).

Records with low energy are near the centre and similar to their neighbours — stable, balanced, ground-state-like. Records with high energy are far from the centre or sharply different from neighbours — excited, specialised, potentially unstable.

If energy correlates with tier (low energy ↔ high tier), the QHO-as-stability-metric has practical value even if the ontological mapping is wrong.

**5.4 Damping as Degradation (Research Direction, Not Build)**

Add an imaginary component to the potential: V(x) → V(x) − iγ. This makes high-energy states decay faster. In the motif context: complex, high-tier patterns are more fragile and degrade faster in noisy environments.

This predicts that applied motifs (substrate-degraded) should cluster at higher energy levels than their ideal parents. Testable once we have applied-motif-labeled data.

Not implementable now — requires the labeled training set. Note for later.

---

## 6. Connection to the Six-Framing Synthesis

The wave equation is the mathematical formalisation of Framing #5 (consciousness-first standing waves) and Framing #6 (geometric encoding / attractor landscape).

| Framing | Wave Equation Connection |
|---------|------------------------|
| 1. Composition algebra | The nine compositions correspond to specific eigenstates in the first excited shell (N=1 and N=2). Non-commutativity would appear as different quantum numbers for D(I) vs I(D). |
| 2. Three axioms | Axiom 1 (self-application) = the operators act on the same Hilbert space they generate. Axiom 2 (primal boundary) = the boundary between the system and vacuum state. Axiom 3 (stability) = eigenstates are the stable solutions. |
| 3. Crystallography of survivors | Eigenstates ARE the survivors — they're the configurations that don't destructively interfere with themselves. Everything else cancels out. |
| 4. Consciousness-first | Ψ is the "field of awareness." Eigenstates are the standing waves. Observation collapses superpositions into definite states. |
| 5. Geometric encoding | The wave equation IS the dynamical system whose attractor basins are the motifs. The energy landscape IS the Hamiltonian. |
| 6. Ground assessment | The wave equation is compatible with all empirical results because it doesn't contradict the invariant core (D/I/R real, stability requires all three, degradation is real). |

The wave equation is NOT a seventh framing. It's the mathematical language that several framings were gesturing toward. It makes the geometric and consciousness framings precise enough to test.

---

## 7. Honest Ratings

| Criterion | Rating | Justification |
|-----------|--------|---------------|
| Mathematical validity | **Yes** | The equation is the QHO. Well-formed, well-understood, exactly solvable. |
| Mapping validity | **Moderate** | D→∇² is strong. I→\|x\|² is the generic approximation (justified but not specific). R→∂/∂t captures iteration but misses self-reference. |
| Predictive power | **Yes, untested** | Makes specific predictions (ground state identity, degeneracy structure, selection rules, energy-tier correlation). None tested yet. |
| Implementability | **Partial — now** | Continuous space + clustering: now. Energy metric: next sprint. Damping: later. Full wave equation solver: not needed (eigenstates are analytically known). |
| Risk of overfitting | **Medium-High** | The QHO is the universal near-equilibrium approximation. The mapping may have been reverse-engineered from the desired result. The numerological coincidence (20 states ≈ 20 motifs) is suspicious. |

---

## 8. Falsification Criteria

The wave equation escapes "beautiful but unfalsifiable" if we commit to testing:

1. **Clustering test.** K-means on existing axis vectors with K=9. If natural clusters DON'T form at the predicted composition locations, the continuous-space structure isn't there. Timeline: this sprint (data already exists).

2. **Ground state test.** Is there exactly one maximally-balanced motif that is also the most stable? If the most stable motif is axis-dominated rather than balanced, the QHO ground state prediction fails. Timeline: after library review.

3. **Energy-tier correlation.** Compute energy for all documented motifs. If energy doesn't correlate with tier, the QHO-as-stability model fails. Timeline: after schema extensions.

4. **Degeneracy test.** Count motifs per tier. If the distribution doesn't approximate (N+1)(N+2)/2 (even allowing for the inverted-tier interpretation), the QHO level structure isn't present. Timeline: after library stabilises.

5. **Selection rules test.** Track motif promotion/demotion in the library over time. If motifs skip tiers (Tier 0 → Tier 2 directly, without passing through Tier 1), the QHO selection rules fail. Timeline: longitudinal observation.

Committing to these tests is what separates a research direction from speculation. If all five fail, the wave equation was a beautiful dead end. If any pass, there's something to pursue.

---

## 9. Recommendation

### For the current build

**Implement the continuous space and clustering test (items 5.1 and 5.2). Ignore the wave equation itself.**

The clustering test is valuable regardless of whether the wave equation is "true." It tests whether the D/I/R axis vectors have natural structure. If they do, every framing benefits. If they don't, every framing that predicts structure (algebra, geometry, waves) has a problem.

### For the next cycle

**If clustering passes:** Implement the energy metric (5.3). Test energy-tier correlation. This is the first test of the wave equation's specific predictions beyond "stable states exist."

**If clustering fails:** The continuous-space framings (geometric, wave, consciousness) lose empirical support. Fall back to the symbolic algebra, which works regardless of continuous structure.

### For the long term

**If energy-tier correlation holds:** The wave equation has practical value as a stability metric, even if the ontological mapping is uncertain. Build it into the evaluator.

**If multiple falsification tests pass:** Invest in a proper mathematical treatment. Hire (or find) someone who does spectral theory to assess whether the D/I/R → QHO mapping is rigorous or merely heuristic.

### What NOT to do

- Don't build a wave equation solver. The eigenstates are analytically known (Hermite-Gaussians). If we need them, we compute them directly.
- Don't replace the symbolic engine with a wave-mechanics engine. The symbolic engine works. The wave equation is untested.
- Don't treat the 20-state numerology as evidence. It's a coincidence until proven otherwise.
- Don't spend more time on the mathematics without empirical testing first. The equation is well-understood. What's unknown is whether the mapping holds.

---

## 10. Summary

The D/I/R wave equation is:

- **Mathematically sound.** It's the quantum harmonic oscillator with D/I/R mapped to kinetic energy, potential energy, and temporal evolution. The QHO is exactly solvable with known, complete eigenstates.

- **Plausibly but not necessarily correct.** The operator mappings have genuine mathematical content (especially D → ∇²). But the QHO form is also the universal first-order approximation for any system with stable states near equilibrium. The mapping might be structural or might be generic.

- **Partially implementable now.** Continuous D/I/R space and K-means clustering require no new theory, no labeled data, and no special hardware. This is the minimum viable test.

- **Testable.** Five specific falsification criteria committed. If they fail, the equation was a dead end. If they pass, there's a genuine research programme.

- **The mathematical formalisation of several framings.** It makes the geometric and consciousness intuitions precise enough to test. That's its primary value right now — not as truth, but as the bridge between intuition and experiment.

**The equation goes in the vault as a research direction, not as a result. Its promotion to "result" requires empirical testing that we can begin this sprint (clustering) and continue over the next several cycles (energy correlation, degeneracy, selection rules).**

---

*This is the last theoretical document for this cycle. The wave equation is either the deepest insight of the project or an elegant instance of choosing mathematics that produces the desired answer. Only empirical work distinguishes the two. The clustering test is the first gate. Run it. If 9 natural clusters emerge in the continuous D/I/R space at the predicted composition locations, the wave equation has legs. If they don't, it was beautiful mathematics applied to the wrong problem. Either answer is valuable.*
