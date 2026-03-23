---
title: "Extended B Run 8: Drift Toward Regularity — T0 Expansion"
date: 2026-03-23
status: draft
target_motif: drift-toward-regularity
target_gap: "T0→T1 domain expansion"
---

# Extended B Run 8: Drift Toward Regularity — T0 Domain Expansion

## Status Assessment

Drift Toward Regularity (DTR) is T0 with `domain_count: 1` but actually lists 2 instances across 2 domains (Linguistics, Information Theory). Bookkeeping error — domain_count should be 2. However, T1 requires 3+ unrelated domains. This run adds 3 new domain instances to reach 5 domains total, making the T1 case unambiguous.

## Structural Recap

**Domain-independent formulation:** Iterated lossy transmission differentially erodes irregular forms, driving the system toward increasing regularity and compressibility without deliberate simplification.

**Key discriminator from Progressive Formalization:** PF involves a deliberate agent moving from amorphous to crystalline. DTR requires the regularization to be *emergent* — no agent intends the simplification. The lossy copy-transmit-receive cycle is the mechanism.

---

## New Domain Instances

### Instance 3: Cultural Evolution — Iterated Learning Experiments (Kirby, Cornish & Smith 2008; Ravignani, Delgado & Kirby 2017)

- **Domain:** Cultural Evolution / Experimental Semiotics
- **Expression:** Two landmark experimental programmes demonstrate DTR in laboratory settings:

  **Language regularization (Kirby, Cornish & Smith 2008, PNAS):** Participants learned an artificial language mapping meanings to novel words, then were tested on a subset. Their output became the training set for the next participant in the chain. Over 10 generations, initially random and holistic label-meaning mappings evolved into compositional, rule-governed languages. Irregularities — arbitrary one-off mappings — were lost because learners could not memorize the full language from a subset. Only regular, compositional structure survived the information bottleneck. No participant was told to simplify or regularize; the bottleneck alone drove the system toward compressibility.

  **Rhythm regularization (Ravignani, Delgado & Kirby 2017, Nature Human Behaviour):** Participants tapped back randomly generated drumming sequences; their reproductions became the input for the next participant. Over transmission chains, initially random temporal patterns converged toward rhythms exhibiting all six statistical universals found in world music: small integer ratio timing, isochrony, hierarchical grouping. The random-to-regular transition was driven entirely by the copy-transmit-receive cycle interacting with human perceptual-motor biases. No participant intended to create universal rhythms.

- **Discovery date:** 2026-03-23
- **Source:** bottom-up (published experimental results)
- **Structural fit:** **Canonical.** This is the strongest possible instance of DTR. The iterated learning paradigm was *designed* to isolate the effect of repeated lossy transmission on structure. The information bottleneck (learners see only a subset / reproducers approximate from memory) is the explicit lossy channel. Irregular forms (arbitrary mappings, non-integer-ratio timings) are differentially lost. Regular forms (compositional rules, simple-ratio rhythms) survive because they are reconstructable from partial information. The regularization is measured, quantified, and replicated across multiple labs. No deliberate simplification agent exists — participants try to be faithful copiers and fail in systematic ways.

  **Distinguishing from Progressive Formalization:** PF would require someone to deliberately refine the language or rhythm. In iterated learning, each participant tries to reproduce what they received — the regularization is a side effect of imperfect copying through a bottleneck. This is textbook DTR.

### Instance 4: Oral Musical Tradition — Folksong Regularization Through Transmission

- **Domain:** Ethnomusicology / Cultural Transmission
- **Expression:** Folk melodies transmitted orally across generations undergo systematic regularization. Bronson (1951, "Melodic Stability in Oral Transmission") documented that folk songs preserve melodic contour but lose ornamental complexity over transmission chains. More recently, experimental transmission chain studies (Jacoby & McDermott 2017; Ravignani 2018) confirm the laboratory findings in naturalistic contexts:

  - Cadence points lose chromatic complexity: scale degree 7 drops out at phrase boundaries, driving melodies toward pentatonic structure (simpler, more compressible scale)
  - Rhythmic irregularity erodes: syncopation and complex subdivisions simplify toward integer-ratio patterns
  - Melodic intervals regularize: augmented and diminished intervals (irregular, requiring precise memory) are replaced by perfect intervals (regular, reconstructable from tonal context)
  - Ornamentation erodes: melismatic passages simplify to syllabic settings

  The mechanism is precisely DTR: each singer recreates the song from memory (lossy transmission). Elements that require exact memorization (specific ornaments, chromatic notes, complex rhythms) are more vulnerable than elements that can be reconstructed from knowledge of the tonal and metric framework (scale-conforming notes, simple rhythms, stepwise motion).

- **Discovery date:** 2026-03-23
- **Source:** domain knowledge + published ethnomusicological research
- **Structural fit:** **Strong.** The copy-transmit-receive cycle is literal: each singer learns by ear, stores in memory, reproduces for the next generation. The lossy channel is human auditory memory. Irregular forms (chromatic notes, complex rhythms, ornaments) erode differentially because they cannot be reconstructed from the tonal/metric framework. Regular forms (pentatonic, isochronous, stepwise) survive because they are the defaults the singer falls back on when memory fails. No singer intends to simplify the tradition — many actively try to preserve it. The regularization is emergent.

  **Distinguishing from Progressive Formalization:** PF would describe a deliberate editorial process — a musicologist or tradition-bearer consciously simplifying. DTR captures what happens when no such editor exists: the lossy channel itself regularizes. The key evidence is that regularization *also* occurs in laboratory transmission chains with naive participants who have no musical training or simplification intent.

### Instance 5: Serial Reproduction — Bartlett's Memory Chains and Cultural Regularization

- **Domain:** Cognitive Psychology / Cultural Evolution
- **Expression:** Bartlett's (1932) serial reproduction experiments — the laboratory analogue of the children's game "Telephone" — demonstrate DTR for narrative and visual material. A participant reads a story or views a drawing, then reproduces it from memory. Their reproduction is given to the next participant, and so on. Bartlett's classic finding with "The War of the Ghosts" (a Kwakiutl folk tale presented to English undergraduates):

  - Stories shortened dramatically over chains (lossy transmission)
  - Culturally unfamiliar elements (supernatural events, non-linear structure) were differentially lost
  - Conventional narrative structure emerged: linear causality, familiar story arcs, culturally regular tropes replaced irregular originals
  - The stories became more "schema-consistent" — conforming to the regular templates already available in participants' cultural memory

  Modern extensions by Griffiths, Kalish & Lewandowsky (2008, "How memory biases affect information transmission," Cognitive Science) formalized this: serial reproduction converges on the prior distribution of the transmission chain. That is, iterated lossy transmission drives the signal toward whatever structure is most easily reconstructable by the receivers — which is, by definition, the most regular and compressible form relative to the receivers' cognitive priors.

  Xu & Griffiths (2010) showed this mathematically: a Markov chain defined by iterated Bayesian agents converges to the agents' shared prior. The "drift toward regularity" is convergence to the prior, and the prior encodes regularities (because regularities are what priors are).

- **Discovery date:** 2026-03-23
- **Source:** bottom-up (Bartlett 1932; Griffiths, Kalish & Lewandowsky 2008; Xu & Griffiths 2010)
- **Structural fit:** **Canonical.** Serial reproduction is the general-purpose laboratory instantiation of DTR. The lossy channel is human memory. The irregular forms are culturally unfamiliar, structurally complex, or schema-inconsistent elements. The regular forms are schema-consistent, culturally familiar, structurally simple elements. The convergence to the prior is mathematically proven — Xu & Griffiths showed that iterated Bayesian transmission is guaranteed to converge to the shared prior regardless of starting point. This provides a *mathematical* grounding for DTR analogous to the iterative decoding convergence in Instance 2.

  **Distinguishing from Progressive Formalization:** Bartlett's participants tried to faithfully reproduce what they received. No one was editing, curating, or simplifying deliberately. The regularization emerges from the interaction of lossy memory with structured priors. This is DTR, not PF.

---

## Candidate Evaluated and Rejected

### Crystal Growth (repeated nucleation favoring regular lattice structures)

- **Domain:** Materials Science / Crystallography
- **Structural fit:** **Weak — does not pass.** Crystal growth does produce regular structures from disordered precursors, but the mechanism is thermodynamic minimization (equilibrium-seeking), not iterated lossy transmission. There is no copy-transmit-receive cycle: atoms are not copying a signal through a channel. The regularity arises from energy minimization in a single crystallization event, not from repeated imperfect copying across generations. This is closer to Idempotent State Convergence (system converging to an equilibrium) than to DTR. Rejected.

### Protein Evolution Toward Stable Folds

- **Domain:** Molecular Biology / Protein Evolution
- **Structural fit:** **Weak — does not pass.** Consensus sequence methods show that replacing rare amino acids with the most common amino acid at each position tends to increase thermodynamic stability (Porebski & Bhuckley 2016). Neutral drift can move protein sequences toward consensus over evolutionary time (Bloom et al. 2008). However, the mechanism is selection + drift acting on fitness landscapes, not iterated lossy transmission through a bottleneck. Each generation of organisms faithfully copies DNA (high-fidelity replication, not lossy). Mutations are random perturbations, not lossy-channel-driven erosion of irregular forms. The "regularization" (drift toward consensus/stability) has a different causal structure: it arises from the statistics of neutral substitution on a fitness landscape, not from information loss during transmission. Does not satisfy DTR's core mechanism. Rejected.

---

## Updated Domain Count and Confidence

| # | Domain | Instance |
|---|--------|----------|
| 1 | Linguistics / Historical Linguistics | Irregular verb erosion, sound change regularity |
| 2 | Information Theory | Iterative decoding convergence (turbo/LDPC codes) |
| 3 | Cultural Evolution / Experimental Semiotics | Iterated learning (Kirby et al. 2008; Ravignani et al. 2017) |
| 4 | Ethnomusicology | Folksong regularization through oral transmission |
| 5 | Cognitive Psychology | Serial reproduction / Bartlett chains (Griffiths et al. 2008) |

**5 domains** (from 2). Confidence: 0.1 → **0.5** (0.1 start + 4 × 0.1 new verified domains, keeping conservative because 3 of 5 domains share a "human cognition as lossy channel" substrate).

## T1 Promotion Recommendation

DTR qualifies for T1 (3+ unrelated domains). The promotion case:

- 5 domains spanning linguistics, information theory, experimental semiotics, ethnomusicology, and cognitive psychology
- The information theory instance (iterative decoding) is genuinely alien to the human-cognition cluster — different substrate, same structure
- Mathematical grounding exists: Xu & Griffiths (2010) proved convergence-to-prior for iterated Bayesian agents; iterative decoding convergence proofs exist independently in coding theory
- Clear falsification conditions already specified in the motif file
- Clean discrimination from Progressive Formalization (deliberate vs. emergent)

### Updated Frontmatter for Motif File
```yaml
tier: 1
status: provisional
confidence: 0.5
domain_count: 5
source: triangulated
```

### Caution on Domain Independence

Three of the five instances (3, 4, 5) share the substrate of human cognition as the lossy channel. They are distinct domains (language learning, music, narrative memory) with distinct research communities and literatures, but a skeptic could argue they are "the same instance in different costumes." The information theory instance (2) and the linguistics/historical instance (1) provide genuine domain independence. For T2 readiness, a non-human, non-information-theoretic instance would strengthen the case — perhaps something from ecology (genetic drift through population bottlenecks?) or materials science (though crystal growth was rejected above). The motif may be fundamentally about *cognitive* systems and lossy channels rather than a universal structural principle.

## Structural Observations

### The Xu-Griffiths Convergence Theorem as Unifying Mechanism

Xu & Griffiths (2010) proved that iterated transmission through Bayesian agents converges to the agents' shared prior. This provides a single mathematical mechanism that unifies Instances 1, 3, 4, and 5: in each case, the "prior" is the regular structure (morphological rules, compositional grammar, integer-ratio rhythms, cultural schemas), and the "lossy channel" is imperfect human learning/memory. The drift toward regularity IS convergence to the prior.

Instance 2 (iterative decoding) has an independent mathematical foundation: belief propagation on factor graphs converges to the most likely codeword. But the structural shape is the same: iterated message-passing through a noisy channel converges toward the most compressible (regular) representation.

### Compressibility as the Invariant

Across all 5 instances, what survives iterated lossy transmission is what is most *compressible*:
- Regular verb forms are compressible (one rule generates them all)
- Compositional languages are compressible (recombine a small set of morphemes)
- Integer-ratio rhythms are compressible (small number of distinct durations)
- Pentatonic melodies are compressible (5 notes, not 12)
- Schema-consistent narratives are compressible (match an existing template)
- Clean codewords are compressible (satisfy parity constraints)

This suggests the domain-independent formulation could be sharpened: **Iterated lossy transmission selects for compressibility.** The "regularity" is a consequence of compressibility being the fitness criterion imposed by the lossy channel.
