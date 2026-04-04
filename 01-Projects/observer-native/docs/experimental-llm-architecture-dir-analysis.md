---
⚠️ VAULT SAFETY HEADER
authority_boundary: This document is VAULT content (narrative/rationale/planning).
vault_rule: The Workspace does NOT derive from this document.
human_gate: Promotion to canonical requires Adam's explicit approval.
ai_rule: AI agents may READ this document. AI agents may CREATE new documents referencing this one. AI agents may NOT modify canonical vault documents.
---

---
status: DRAFT
date: 2026-03-27
author: Atlas
type: architecture
authority: low
domain: [experimental-llm, dual-stream, model-architecture, training-loop, reflexive-architecture]
method: 4-pass D/I/R triad (slow mode — convergence-checked at each R-phase)
mode: deep-analysis
motifs: [dual-speed-governance, estimation-control-separation, two-antagonistic-modes, reconstruction-burden, observer-feedback-loop, progressive-formalization, recursive-generativity, hidden-structure-surface-form-separation, idempotent-state-convergence, ratchet-with-asymmetric-friction, structural-coupling-ground-state]
refs:
  - 02-Knowledge/architecture/experimental-llm-dir-analysis-20260324.md
  - 02-Knowledge/architecture/experimental-llm-design-context-20260324.md
  - 02-Knowledge/architecture/dual-stream-dir-analysis-20260324.md
  - 02-Knowledge/architecture/Theory_To_Architecture_20260305.md
  - 01-Projects/observer-native/docs/PRD-rivers-dual-stream-20260324.md
  - 01-Projects/dataset-processor/src/governance/types.ts
  - 02-Knowledge/motifs/MOTIF_INDEX.md
provenance: >
  Four-pass D/I/R analysis performed by Atlas on 2026-03-27. Slow triad mode —
  each pass reads the output of the prior pass before running. Builds on the
  March 24 analysis with focus on practical buildability: mechanistic specifications,
  concrete component designs, loss function formulations, and a two-tier MVE plan.
  Convergence evaluated at each R-phase using motif algebra stability criteria.
  Adam holds sovereignty over all design decisions.
---

# Experimental LLM Architecture — Deep D/I/R Analysis (Buildable Blueprint)

> Four passes through the design space. Each transforms what the previous found.
> Focus: from concept to blueprint. Every component specified to the level of "you could implement this."

---

# Pass 1 — DISTINGUISH

## 1.1 The Eight Independent Design Decisions

The architecture as described contains eight separable design decisions. Each can be made independently. Each has alternatives. Distinguishing them prevents premature integration — choosing one shouldn't force the others.

### D1: Dual-Stream Input Encoding

**Decision**: Two separate encoders — noun stream for entities/structures, verb stream for processes/transformations.

**What this means mechanistically**: Two transformer encoder stacks that do not share weights. The noun encoder processes raw text (the `rawContent` field from PairedRecord). The verb encoder processes structured process metadata (the `verb` component: processShape, operators, axis, derivativeOrder, stabilisation).

**The asymmetry problem**: The noun stream is standard natural language — high-dimensional, information-dense, processable by any existing tokenizer. The verb stream is structured metadata — low-dimensional, semantically concentrated, with no standard tokenization.

**Three approaches to verb stream encoding**:

(a) **Text serialization** — render the verb record as a structured string: `"axis:differentiate order:2 operators:[separate,classify] shape:boundary-detection stabilisation:converging"`. Use the same tokenizer as the noun stream. Simplest implementation. Risk: the model learns text patterns rather than structural patterns. The string "differentiate" is just tokens to a tokenizer — it carries no inherent structural meaning.

(b) **Learned structured embeddings** — each verb field has its own embedding table. Axis maps to 3 learned vectors. Derivative order maps to 4 learned vectors. Each operator maps to its own learned vector. Process shape and stabilisation status likewise. These are concatenated and projected to the encoder's hidden dimension. More faithful to the structure. The model must learn what "differentiate" means from the training signal, not from its spelling.

(c) **Hybrid** — text serialization for the process shape description (which is natural language), learned embeddings for the categorical fields (axis, order, stabilisation), and a small set embedding for operators. This preserves the rich description while giving structural fields their own representation path.

**Recommendation**: (c) for the prototype. (a) is sufficient for the MVE. (b) is an intermediate option if (c) proves too complex.

**Alternatives to dual-stream**:

- **Single encoder with typed tokens**: Add special tokens `[NOUN]` and `[VERB]` to mark segments. One encoder processes both. Simpler but loses the forced separation — the model may collapse noun and verb into a single representation.
- **Mixture of Experts (MoE)**: A single encoder with routing that sends noun-like tokens to noun experts and verb-like tokens to verb experts. More parameter-efficient. But routing is learned, not forced — the model might not learn the noun/verb distinction.
- **Multi-head specialisation**: One encoder where certain attention heads specialise for noun processing and others for verb processing, via auxiliary loss. A softer version of dual-stream.

**Why dual-stream over alternatives**: The forced architectural separation is the hypothesis under test. If we let the model discover the separation (MoE, multi-head), we can't distinguish "the model learned to separate nouns and verbs" from "the model found some other useful decomposition." Dual-stream forces the question: does explicit noun/verb separation help? If the answer is no, we can always retreat to single-stream.

### D2: Cross-Attention Bridge (Corpus Callosum)

**Decision**: A cross-attention layer between the two streams where each attends to the other.

**Mechanistically**: Given noun representations `N ∈ R^{n×d}` and verb representations `V ∈ R^{m×d}`:
- Noun→Verb attention: `N' = N + CrossAttn(Q=N, K=V, V=V)` — noun representations enriched by attending to relevant verb features
- Verb→Noun attention: `V' = V + CrossAttn(Q=V, K=N, V=N)` — verb representations enriched by attending to relevant noun features

This is bidirectional cross-attention, as used in Flamingo (for vision-language) and similar multimodal architectures.

**Alternatives**:

(a) **Contrastive alignment (CLIP-style)**: No cross-attention. Each stream produces a single vector (CLS token or mean pool). A contrastive loss pulls matched noun-verb pairs together and pushes unmatched pairs apart in embedding space. Much cheaper computationally. But: coarser alignment — it learns that a noun and verb "go together" without learning *how* they correspond token-by-token.

(b) **Shared latent space with projection heads**: Both encoders project to a shared latent space of dimension `k < d`. Alignment is a reconstruction objective — decode both noun and verb from the shared representation. Captures the "hidden structure" that both surface forms express. But: the bottleneck dimension `k` must be chosen, and too small loses information while too large doesn't force abstraction.

(c) **Gated fusion (FiLM-style)**: One stream modulates the other via learned scale-and-shift parameters. The verb stream produces parameters `γ, β` that modulate the noun stream: `N' = γ ⊙ N + β`. Asymmetric — one stream conditions the other. Could be applied in both directions. Cheaper than cross-attention.

(d) **Alternating self-attention and cross-attention layers**: Instead of a single bridge, interleave cross-attention throughout the encoder stack. Layer 1: self-attention in both streams. Layer 2: cross-attention. Layer 3: self-attention. Etc. Deeper integration but more expensive.

**Recommendation for MVE**: (a) contrastive alignment. It's the cheapest, well-understood, and directly tests whether the paired data produces useful alignment.

**Recommendation for prototype**: (d) alternating layers. This is the closest to the "corpus callosum" metaphor — continuous interaction between streams at every level of abstraction, not a single bridge point.

### D3: The D/I/R Training Loop

**Decision**: Three-phase cyclic training — contrastive D-phase, cross-stream prediction I-phase, reflexive consistency R-phase.

**The question beneath the question**: Is cycling between three loss functions different from computing them simultaneously?

In standard multi-task learning, the combined loss is `L = λ_D·L_D + λ_I·L_I + λ_R·L_R`, and gradients from all three flow simultaneously. In cyclic training, you compute and optimize one loss at a time, cycling D→I→R→D→...

**When cycling matters**: If the loss functions create conflicting gradients (improving D-loss worsens I-loss), simultaneous optimization produces a compromise that may satisfy neither. Cycling allows each phase to fully optimize its objective before the next phase adjusts. This is analogous to Generative Adversarial Network (GAN) training, where the generator and discriminator alternate rather than co-optimize.

**When cycling doesn't matter**: If the loss functions are compatible (improving one doesn't worsen the others), simultaneous optimization is strictly more efficient — you get gradient information from all objectives in every step.

**The D/I tension**: D-phase (contrastive) pushes noun and verb representations apart. I-phase (cross-stream prediction) requires them to be relatable. These ARE in tension — exactly like a GAN's generator and discriminator. This suggests cycling is justified, at least for D and I.

**The I/R relationship**: I-phase (cross-stream prediction) and R-phase (reflexive consistency) are likely compatible — both benefit from good structural representations. R may be computable as a regularisation term alongside I rather than as a separate phase.

**Practical recommendation**:

```
Phase 1 (warm-up, ~30% of training):
  L = L_D  (contrastive only — force stream separation)

Phase 2 (integration, ~50% of training):
  L = λ_D·L_D + λ_I·L_I  (contrastive + cross-prediction)
  Alternate batches: even batches optimize L_D, odd batches optimize L_I

Phase 3 (reflection, ~20% of training):
  L = λ_D·L_D + λ_I·L_I + λ_R·L_R  (all three)
  L_R evaluated every K batches (not every batch — expensive)
```

This is curriculum learning with GAN-style alternation for the D/I tension. Standard, implementable, no novel training infrastructure required.

### D4: The Reflexive R-Phase

**Decision**: After processing, run the model's own representations back through the architecture as input. Compare against motif library patterns.

**This is the most novel component and needs the most precise specification.**

**Mechanistic option A — Representation re-encoding (Universal Transformer style)**:

After the forward pass produces noun representations `N_1` and verb representations `V_1` from layer L:
1. Project `N_1` and `V_1` back to input embedding dimension via learned projections `W_N^{reflect}, W_V^{reflect}`
2. Run a second forward pass with these projected representations as input: `N_2, V_2 = forward(W_N^{reflect}·N_1, W_V^{reflect}·V_1)`
3. Compare `N_2, V_2` against motif library templates
4. The R-loss measures: (a) consistency between pass 1 and pass 2 representations, and (b) alignment with known motif patterns

**Weight sharing**: The reflection pass uses the SAME encoder weights as the original pass (weight-tied). This is the Universal Transformer approach. The model applies the same transformation repeatedly until representations stabilize. Different from training a separate reflection network.

**Mechanistic option B — Auxiliary prediction heads (simpler)**:

No re-encoding. Instead, attach prediction heads to the convergence layer output:
1. Motif classification head: predict which motif pattern the input exhibits
2. Structural coherence head: predict c/i/d scores (completeness, independence, decidability)
3. Cross-stream consistency head: predict whether noun and verb representations encode the same structural instance

The R-loss is the sum of these prediction losses. Trained against labels derived from the motif library and PairedRecord alignment scores.

**Mechanistic option C — Hybrid (recommended for prototype)**:

One reflection pass (option A) followed by auxiliary heads (option B) applied to the refined representations. The reflection pass gives the model a chance to refine; the heads evaluate the quality of the refinement.

```
Input → Encoder pass 1 → Convergence layer → Representations R1
R1 → Projection → Encoder pass 2 (weight-tied) → Representations R2
R2 → Motif classification head → L_R_motif
R2 → Coherence head (c/i/d) → L_R_coherence
|R1 - R2| → Stability loss → L_R_stability

L_R = L_R_motif + L_R_coherence + λ_stab · L_R_stability
```

The stability loss `|R1 - R2|` measures whether the representation has converged — if one reflection pass doesn't change the representation, it's already stable. If it changes significantly, the original representation was unstable and needed refinement.

**Adaptive depth via halting**: The Universal Transformer's Adaptive Computation Time (ACT) mechanism:
1. At each reflection iteration, compute a halting probability `p_i = σ(W_halt · R_i)`
2. Accumulate: `H_i = Σ_{j≤i} p_j`
3. Stop when `H_i > 1 - ε` or when max iterations reached
4. Final representation is the probability-weighted sum: `R_final = Σ_i p_i · R_i`

This is differentiable and GPU-friendly (batch all inputs for max iterations, weight by halting probabilities). The motif algebra's c/i/d scores can be features to the halting probability — inputs that are structurally complete and decidable halt early.

**Recommendation**: Option C for the prototype. Option B for the MVE (no reflection pass, just auxiliary heads — this tests whether motif-structured labels help at all before investing in the recursive mechanism).

### D5: Structural Graph vs. Context Window

**Decision**: Replace the token buffer with an associative graph of structural relationships.

**Assessment**: This is a Layer 5 aspiration, not a Layer 0 requirement. Every existing ML framework operates on sequential tensors. A true graph representation requires either:
- Custom CUDA kernels for graph attention (months of engineering)
- A graph neural network (GNN) as a post-processing layer over transformer representations (feasible but adds complexity)
- An external graph database queried at inference time (inference-time overhead)

**Practical approximation: structured attention masks**

Instead of replacing the context window, augment it. A standard transformer with a modified attention mask:

```
Standard attention: every token attends to every other token (causal mask for autoregressive)

Structured attention: tokens attend based on structural proximity, not just position
- Tokens within the same PairedRecord: full attention
- Tokens from PairedRecords sharing a motif: cross-record attention
- Tokens from PairedRecords in different domains but same axis: cross-domain attention
- Tokens from unrelated records: no attention (or reduced attention via learned gating)
```

This gives "structural proximity determines attention" without abandoning the transformer architecture. The attention mask is computed from the PairedRecord metadata before the forward pass. It's a sparse attention pattern — well-studied, efficient implementations exist (FlashAttention with block-sparse masks, BigBird-style patterns).

**For the MVE and prototype**: Standard context window with positional encoding. Structured attention masks as an optional experiment once the base architecture works.

**For future research**: True graph representations where the topology is learned rather than derived from metadata.

### D6: Adaptive Reasoning Depth

**Decision**: R-phase loops until stability evaluators indicate convergence. Simple inputs converge quickly; complex inputs may need many passes.

**Practical implementation**: ACT (Adaptive Computation Time) as described in D4. The halting probability is conditioned on:
- Representation stability: `|R_i - R_{i-1}|` (are representations still changing?)
- Structural completeness: c-score from motif algebra (are all components present?)
- Decidability: d-score (can this be classified?)

**Batching constraint**: GPUs process batches efficiently. Variable-depth computation within a batch is wasteful — some inputs halt at iteration 2 while others need iteration 8, but all must wait for the slowest. Mitigation: sort inputs by estimated complexity and batch similar-complexity inputs together. Or: run all inputs for max iterations but weight contributions by halting probability (standard ACT approach — no actual early stopping, just probability weighting).

**Recommendation**: Use ACT with max 4 iterations for the prototype. Evaluate whether adaptive depth actually helps compared to a fixed 2-iteration baseline. This is an empirical question.

### D7: Generative Emergence (G-Phase)

**Decision**: The R-phase detects novel structural patterns in the model's own representations that don't match the training library.

**Mechanistically**: This is anomaly detection in representation space.

```
Given: motif library templates as reference vectors M = {m_1, ..., m_K}
Given: model's representation r for input x

Novelty score = min_k distance(r, m_k)  — minimum distance to any known motif

If novelty_score > threshold AND coherence_score > threshold:
  → Flag as potential novel motif
  → Route to sovereignty gate for human review
```

The critical requirement: the coherence score must distinguish "novel and structurally sound" from "garbage representation that doesn't match anything." The c/i/d scores serve this purpose — a representation with high completeness, high independence, and high decidability that nonetheless doesn't match any known motif is a candidate for genuine novelty.

**Practical concern**: Early in training, ALL representations will be garbage. Novelty detection should only activate after the model has reached a baseline performance threshold on known motifs. Premature novelty detection produces noise.

**Recommendation**: Implement novelty detection as a monitoring tool, not a training signal. Run it periodically on the validation set. Log candidates. Route to human review. Do NOT feed detected novel patterns back into training automatically — that's the sovereignty gate.

### D8: Training Data

**What exists**: The dataset processor produces PairedRecords from The Pile. Shard 00 has produced ~606K candidates. The PairedRecord schema is:

```typescript
interface PairedRecord {
  noun: {
    entityType: string;
    domain: string;
    stateDescription: string;
    boundaries: string[];
    rawContent: string;         // ← noun encoder input
  };
  verb: {
    processShape: string;       // ← verb encoder input (text component)
    operators: string[];        // ← verb encoder input (structured component)
    axis: 'differentiate' | 'integrate' | 'recurse';
    derivativeOrder: number;
    stabilisation: 'stable' | 'unstable' | 'converging' | 'diverging';
  };
  alignment: {
    confidence: number;         // ← training signal quality indicator
    motifId?: string;           // ← R-phase label (if matched)
    convergenceType?: string;
  };
}
```

**What's needed for training**:

1. **Tokenization pipeline**: noun.rawContent → standard tokenizer → token IDs. verb fields → hybrid encoding (see D1).
2. **Quality filtering**: Only PairedRecords with alignment.confidence > threshold. The 606K candidates include low-confidence pairs that would add noise.
3. **Negative sampling for contrastive D-phase**: Mismatched noun-verb pairs (noun from one record paired with verb from another). These are needed to train the model to distinguish correct pairings from incorrect ones.
4. **Motif labels for R-phase**: PairedRecords with alignment.motifId populated provide supervised labels for the motif classification head. Records without motifId contribute only to D and I phases.

**Data volume estimate**: From 606K candidates, filtering at confidence > 0.7 might yield ~50-100K usable pairs. Of those, maybe 10-20% have motifId labels (the motif library has ~34 motifs, and not every record matches one). For a 50M parameter model, 50K high-quality pairs is a reasonable training set — small by LLM standards, but the verb stream's structured signal is much denser than raw text.

---

## 1.2 Tensions Discovered

**T1: Asymmetric information density between streams**

The noun stream processes natural language paragraphs (hundreds of tokens). The verb stream processes a handful of structured fields (~10-20 effective "tokens" in the hybrid encoding). This creates a gradient imbalance — the noun encoder receives far more gradient signal per batch than the verb encoder.

*Mitigation*: Gradient scaling — multiply verb encoder gradients by a factor `α > 1` to compensate. Or: separate learning rates (higher for verb encoder). Or: more verb encoder updates per noun encoder update (asymmetric update schedule). All are standard techniques for imbalanced multi-task learning.

**T2: D-phase and I-phase create opposing gradients**

Contrastive D-loss pushes noun and verb representations apart. Cross-prediction I-loss requires them to be relatable. These conflict directly.

*Resolution*: The D-phase should push apart the *encoding spaces* (the noun encoder and verb encoder produce representations in distinguishable subspaces), while the I-phase should learn a *mapping* between the spaces (the convergence layer translates between them). The D-loss operates on encoder outputs; the I-loss operates on convergence layer outputs. They affect different parameters and don't directly conflict.

This is the key architectural insight: separation and integration operate at different layers. D happens in the encoders. I happens in the bridge. They don't fight because they're in different parts of the network.

**T3: Reflexive R-phase computational cost**

Each reflection pass is a full forward pass through the encoder stack. With weight sharing, parameters don't double, but compute does. On a single GPU with a 50M parameter model, each reflection iteration adds ~50ms per batch. With max 4 iterations, that's 4× the forward pass time.

*Mitigation*: Run reflection passes only during Phase 3 of training (the final 20%), and only every K batches (not every batch). At inference time, use ACT to minimize iterations for simple inputs.

**T4: Motif library as training constraint limits discovery**

If the R-phase evaluates against known motifs, the model can only learn to recognize patterns already in the library. Novel patterns (G-phase) require a separate detection mechanism that is inherently less reliable.

*Resolution*: The motif library is a curriculum, not a ceiling. The R-phase loss includes both motif classification (supervised, for known patterns) and structural coherence (unsupervised, for any pattern). The coherence loss rewards the model for producing internally consistent representations regardless of whether they match a known motif. Novel patterns emerge as representations that score high on coherence but low on known-motif similarity.

**T5: Single-GPU constraint limits model size and thus capacity**

A 50M parameter dual-stream model is small. Current competitive models are 1B+. The bet is that structural training data compensates for smaller size — the model learns more per parameter because the training signal is richer.

*This is the core empirical question the MVE must answer.*

---

# Pass 2 — INTEGRATE

## 2.1 Component Dependency Map

```
┌─────────────────────────────────────────────────────────────┐
│                    LAYER 5: Structural Graph                 │
│                  (replaces context window)                    │
│              Depends on: everything below working             │
│              Status: DEFERRED — research frontier             │
├─────────────────────────────────────────────────────────────┤
│                LAYER 4: Generative Emergence (G)             │
│                (novel pattern detection)                      │
│              Depends on: reliable R-phase                     │
│              Status: MONITORING TOOL — not training signal    │
├─────────────────────────────────────────────────────────────┤
│              LAYER 3: Reflexive R-Phase                      │
│         (iterative refinement + convergence halting)          │
│        Depends on: stable D+I training, motif labels         │
│        Status: PROTOTYPE — add after D+I proven              │
├─────────────────────────────────────────────────────────────┤
│              LAYER 2: D/I/R Training Loop                    │
│       (curriculum: D-first → D+I → D+I+R)                   │
│        Depends on: both encoders + convergence layer         │
│        Status: CORE — implement in prototype                 │
├─────────────────────────────────────────────────────────────┤
│              LAYER 1: Convergence Layer                      │
│       (cross-attention bridge between streams)               │
│        Depends on: both encoders producing representations   │
│        Status: CORE — implement in MVE                       │
├─────────────────────────────────────────────────────────────┤
│              LAYER 0: Dual-Stream Encoders                   │
│       (noun encoder + verb encoder)                          │
│        Depends on: training data pipeline                    │
│        Status: FOUNDATION — implement first                  │
├─────────────────────────────────────────────────────────────┤
│              DATA: PairedRecord Pipeline                     │
│       (dataset processor → tokenization → batching)          │
│        Status: PARTIALLY BUILT — processor exists,           │
│        tokenization/batching needed                          │
└─────────────────────────────────────────────────────────────┘
```

**Critical path**: Data pipeline → Layer 0 → Layer 1 → Layer 2 → Layer 3

Each layer can be tested before building the next. This is the architecture's greatest strength — it's an incremental research programme, not an all-or-nothing bet.

## 2.2 How Components Reinforce Each Other

### The D/I/R training loop exercises each architectural component

| Training Phase | Architectural Component Exercised | Loss Function |
|---------------|----------------------------------|---------------|
| D (contrastive) | Noun encoder + verb encoder | Push matched pairs of different-motif apart, pull same-motif pairs together |
| I (cross-prediction) | Convergence layer | Given noun, predict verb features; given verb, predict noun features |
| R (reflexive) | Reflection pass + prediction heads | Representation stability + motif classification + c/i/d coherence |

This is a clean alignment: the three training phases map to three architectural components. Each phase exercises a different part of the network. This is not accidental — the architecture was designed around D/I/R, so D/I/R training naturally fits.

### The PairedRecord format IS the dual-stream architecture at the data level

```
PairedRecord                          Model Architecture
┌──────────────┐                      ┌──────────────┐
│ noun:        │──── rawContent ──────│ Noun Encoder  │
│  entityType  │                      │ (transformer) │
│  domain      │                      └──────┬───────┘
│  boundaries  │                             │
│  rawContent  │                      ┌──────┴───────┐
├──────────────┤                      │  Convergence  │
│ alignment:   │──── motifId ────────│    Layer      │
│  confidence  │  (supervision)       │ (cross-attn)  │
│  motifId     │                      └──────┬───────┘
├──────────────┤                             │
│ verb:        │──── structured ──────┌──────┴───────┐
│  processShape│     encoding         │ Verb Encoder  │
│  operators   │                      │ (transformer) │
│  axis, order │                      └──────────────┘
└──────────────┘
```

The data format and the model architecture are isomorphic. This means:
- No impedance mismatch between data and model
- The tokenization pipeline maps directly from PairedRecord fields to encoder inputs
- The alignment field provides direct supervision for the convergence layer
- The motifId field provides direct supervision for the R-phase

### The motif algebra's c/i/d conditions translate to differentiable convergence criteria

The motif algebra evaluates motifs on three conditions:
- **c (completeness)**: All structural components are present
- **i (independence)**: Components are not redundant
- **d (decidability)**: The pattern can be classified

These translate to representation-space metrics:

```python
def c_score(noun_repr, verb_repr):
    """Completeness: both streams contribute to the representation."""
    noun_norm = torch.norm(noun_repr, dim=-1)
    verb_norm = torch.norm(verb_repr, dim=-1)
    # Both must be non-trivial — if either collapses, c is low
    return torch.min(noun_norm, verb_norm) / (torch.max(noun_norm, verb_norm) + eps)

def i_score(noun_repr, verb_repr):
    """Independence: noun and verb encode different information."""
    cos_sim = F.cosine_similarity(noun_repr, verb_repr, dim=-1)
    # High independence = low similarity (they're capturing different aspects)
    return 1.0 - cos_sim.abs()

def d_score(repr, motif_templates):
    """Decidability: representation clearly matches (or clearly doesn't match) a pattern."""
    similarities = torch.stack([F.cosine_similarity(repr, t, dim=-1) for t in motif_templates])
    max_sim = similarities.max(dim=0).values
    entropy = -(similarities.softmax(dim=0) * similarities.log_softmax(dim=0)).sum(dim=0)
    # High decidability = low entropy (confident classification)
    return max_sim * (1.0 - entropy / math.log(len(motif_templates)))
```

These are differentiable, batchable, and can serve as:
1. Features for the ACT halting probability
2. Components of the R-phase loss
3. Evaluation metrics for monitoring training progress

### The reflection river in the infrastructure mirrors the R-phase in the model

| Infrastructure | Model |
|---------------|-------|
| Intake river → Distinguish what's new | D-phase → Separate noun and verb |
| Processing river → Integrate across records | I-phase → Learn cross-stream correspondence |
| Reflection river → Recurse on own process | R-phase → Re-encode own representations |
| Cross-river convergence → Motif crystallisation | Cross-stream convergence → Motif recognition |

The model architecture recapitulates the infrastructure architecture. This is Recursive Generativity: the infrastructure that produces the training data has the same cognitive structure as the model trained on that data.

## 2.3 The Unified Data Flow

End-to-end, from raw text to trained model:

```
The Pile (raw text)
    │
    ▼
Dataset Processor (3-tier: lexical → structural → model-assisted)
    │
    ▼
PairedRecords (noun + verb + alignment)
    │
    ├─── Quality filter (confidence > threshold)
    ├─── Negative sampling (shuffle noun-verb pairings)
    ├─── Motif label enrichment (from motif library)
    │
    ▼
Tokenization Pipeline
    │
    ├─── Noun: standard tokenizer → token IDs
    ├─── Verb: hybrid encoding → structured tensor
    ├─── Labels: motif IDs, c/i/d scores → supervision targets
    │
    ▼
Training Loop
    │
    ├─── Phase 1 (D): Contrastive loss on encoder outputs
    │       • Pull same-motif pairs together
    │       • Push different-motif pairs apart
    │       • Separate noun and verb representational spaces
    │
    ├─── Phase 2 (D+I): Contrastive + cross-prediction
    │       • Continue D-phase objectives
    │       • Add: given noun repr, predict verb features (and vice versa)
    │       • Train the convergence layer
    │
    ├─── Phase 3 (D+I+R): Full loop with reflection
    │       • Continue D and I objectives
    │       • Add: reflection pass (re-encode representations)
    │       • Evaluate stability, motif classification, c/i/d coherence
    │       • ACT halting for adaptive depth
    │
    ▼
Trained Model
    │
    ├─── Inference: Encode input → convergence → reflect → output
    ├─── Monitoring: G-phase novelty detection (offline, sovereignty-gated)
    └─── Evaluation: motif recognition, cross-domain transfer, structural coherence
```

## 2.4 Loss Function Specification

### D-Phase Loss: Contrastive Stream Separation

```python
def d_loss(noun_repr, verb_repr, motif_labels):
    """
    Contrastive loss that separates the two streams while aligning
    same-motif instances.

    Within a batch of size B:
    - Positive pairs: (noun_i, verb_i) from the same PairedRecord
    - Hard negatives: (noun_i, verb_j) where motif_i ≠ motif_j
    """
    # Normalize representations
    noun_norm = F.normalize(noun_repr, dim=-1)  # [B, d]
    verb_norm = F.normalize(verb_repr, dim=-1)   # [B, d]

    # Similarity matrix
    sim = torch.mm(noun_norm, verb_norm.t()) / temperature  # [B, B]

    # InfoNCE contrastive loss
    labels = torch.arange(B, device=sim.device)  # diagonal = positive pairs
    loss_n2v = F.cross_entropy(sim, labels)       # noun → verb direction
    loss_v2n = F.cross_entropy(sim.t(), labels)   # verb → noun direction

    return (loss_n2v + loss_v2n) / 2
```

### I-Phase Loss: Cross-Stream Prediction

```python
def i_loss(noun_repr, verb_repr, convergence_output, verb_targets):
    """
    Given noun representation, predict verb features (and vice versa)
    through the convergence layer.

    verb_targets: dict with axis, order, operators, stabilisation labels
    """
    # Convergence layer maps between streams
    noun_to_verb = convergence_layer.predict_verb(noun_repr)   # [B, d_verb]
    verb_to_noun = convergence_layer.predict_noun(verb_repr)   # [B, d_noun]

    # Cross-prediction loss
    loss_n2v = F.mse_loss(noun_to_verb, verb_repr.detach())
    loss_v2n = F.mse_loss(verb_to_noun, noun_repr.detach())

    # Structured prediction loss (predict verb metadata from convergence output)
    loss_axis = F.cross_entropy(convergence_output.axis_logits, verb_targets['axis'])
    loss_order = F.cross_entropy(convergence_output.order_logits, verb_targets['order'])
    loss_stab = F.cross_entropy(convergence_output.stab_logits, verb_targets['stabilisation'])

    return loss_n2v + loss_v2n + loss_axis + loss_order + loss_stab
```

### R-Phase Loss: Reflexive Consistency

```python
def r_loss(repr_pass1, repr_pass2, motif_labels, motif_templates):
    """
    Evaluate structural consistency of representations after reflection pass.

    repr_pass1: representations from initial forward pass
    repr_pass2: representations from reflection pass (re-encoding pass1)
    motif_labels: ground-truth motif IDs (may be None for unlabeled records)
    motif_templates: learned template vectors for each motif
    """
    # 1. Stability: how much did representations change?
    stability = F.mse_loss(repr_pass2, repr_pass1.detach())

    # 2. Motif classification (supervised, where labels exist)
    if motif_labels is not None:
        motif_logits = motif_classifier(repr_pass2)
        classification = F.cross_entropy(motif_logits, motif_labels)
    else:
        classification = 0.0

    # 3. Structural coherence (unsupervised, always active)
    noun_r2, verb_r2 = split_streams(repr_pass2)
    coherence = -(c_score(noun_r2, verb_r2) + i_score(noun_r2, verb_r2) +
                  d_score(repr_pass2, motif_templates))

    return stability + classification + coherence
```

### Combined Training Objective

```python
# Phase 1: warm-up (epochs 0 to E1)
loss = d_loss(noun, verb, labels)

# Phase 2: integration (epochs E1 to E2)
loss = λ_D * d_loss(noun, verb, labels) + λ_I * i_loss(noun, verb, conv, targets)

# Phase 3: reflection (epochs E2 to E3)
noun2, verb2 = reflection_pass(noun1, verb1)  # weight-tied re-encoding
loss = (λ_D * d_loss(noun1, verb1, labels) +
        λ_I * i_loss(noun1, verb1, conv, targets) +
        λ_R * r_loss(repr1, repr2, labels, templates))
```

Hyperparameters: `λ_D = 1.0, λ_I = 0.5, λ_R = 0.3` (start conservative on I and R; tune empirically).

---

# Pass 3 — REFLECT

## 3.1 Coherence Assessment

**Has the design stabilized?**

Yes, substantially. The layered architecture (D0→D5) provides a clear implementation path. The loss functions are specified to pseudocode level. The data flow is end-to-end. The remaining open questions are empirical (hyperparameter values, whether the approach works at all) rather than architectural (what to build).

**Unresolved tensions?**

Three remain:

1. **Verb stream information density**: The hybrid encoding (D1, option c) is specified but the exact embedding dimensions, vocabulary sizes, and concatenation strategy need to be determined empirically. This is engineering, not architecture.

2. **Reflection pass stability**: Re-encoding representations through the same weights may diverge rather than converge. The stability loss should prevent this, but edge cases (adversarial inputs, out-of-distribution text) may produce unstable reflection loops. The max iteration cap (4) is the safety valve.

3. **Scale vs. structure bet**: Whether a 50M parameter model with rich structural training data can outperform a 50M parameter model with standard training remains the central unknown. The MVE is designed to answer this.

**New questions from this cycle?**

One important one: **how do you generate the motif template vectors for the R-phase?**

The motif library contains text descriptions, not vectors. The template vectors need to be derived. Options:
- (a) Embed each motif's structural description through the noun encoder at initialization. Frozen during training. Simple but circular — using the model to create its own training signal.
- (b) Train a small auxiliary model on the motif library to produce template embeddings. Use these as fixed targets. Independent of the main model.
- (c) Maintain learnable template vectors that are updated during training (like class prototypes in prototypical networks). Initialize randomly. Let the R-phase loss shape them.

Recommendation: (c) for the prototype. The templates learn to represent the structural essence of each motif as the model trains. They're interpretable via nearest-neighbor lookup in embedding space.

## 3.2 What Motifs Appear in the Architecture Itself

The architecture is an instance of multiple motifs simultaneously — this is the meta-coherence check.

| Motif | How the Architecture Instantiates It |
|-------|--------------------------------------|
| **Estimation-Control Separation** (T2) | Noun encoder = estimation (what IS). Verb encoder = control (what DOES). The convergence layer maps between them. The architecture IS this motif. |
| **Two Antagonistic Modes** (T1) | D-phase and I-phase are antagonistic — separation vs. integration. Both must operate; neither collapses. Mode-lock in either direction is pathological (D-lock = streams never integrate; I-lock = streams collapse into one). |
| **Dual-Speed Governance** (T2) | Training phases are two speeds: fast (D/I batches, every step) and slow (R-phase, every K steps). Inference has two speeds: fast (single pass) and slow (multiple reflection iterations for complex inputs). |
| **Reconstruction Burden** (T2) | The dual-stream architecture minimizes reconstruction burden — you can recover the structural instance from both projections together. A single-stream model destroys either noun or verb information. |
| **Observer-Feedback Loop** (T2) | The R-phase IS the model observing itself. The reflection pass feeds representations back as input. The model's observation modifies its own state. |
| **Progressive Formalization** (T2) | The implementation path IS progressive formalization: amorphous (design conversations) → structured (this analysis) → typed (loss function pseudocode) → crystallized (implementation). |
| **Recursive Generativity** (T2) | The R-phase's iterative refinement, where each pass creates conditions for the next. The G-phase, where the model generates novel patterns through recursive self-application. |
| **Idempotent State Convergence** | The R-phase stability loss drives representations toward a fixed point — a representation that doesn't change when re-encoded is idempotent under the reflection operation. |

**The meta-observation**: 8 motifs from the library independently describe features of the architecture. This is the same cross-stream convergence the architecture is designed to detect — structural patterns recurring across independent descriptions. The architecture is internally consistent with its own theoretical foundation.

## 3.3 Does the Design Follow D/I/R at Every Level?

| Level | D (Distinguish) | I (Integrate) | R (Reflect) |
|-------|-----------------|---------------|-------------|
| **Data** | Noun and verb fields are separated in PairedRecord | Alignment field links them | Motif labels evaluate the pairing |
| **Architecture** | Two separate encoders | Convergence layer | Reflection pass |
| **Training** | Contrastive D-phase | Cross-prediction I-phase | Reflexive R-phase |
| **Inference** | Encode noun and verb separately | Merge through convergence | Iterate through reflection until stable |
| **Evaluation** | Stream separation metrics | Cross-stream prediction accuracy | Motif recognition + c/i/d scores |
| **Meta** | This analysis Pass 1 | This analysis Pass 2 | This analysis Pass 3 |

D/I/R is present at every level. The architecture is fractal — the same pattern at data level, model level, training level, and evaluation level. This is either a deep structural insight or a sign that we're projecting the pattern everywhere. The MVE will distinguish: if the architecture works, the fractal consistency is evidence of genuine structural alignment. If it doesn't, we were pattern-matching on our own framework.

---

# Pass 4 — CONVERGENCE CHECK AND PRACTICAL SYNTHESIS

## 4.1 Stability Evaluation

Running the motif algebra's stability criteria on the analysis itself:

**Completeness (c)**: All major architectural components are specified: encoders, bridge, training loop, reflection mechanism, convergence criteria, data pipeline. No structural gaps remain. **c = HIGH**.

**Independence (i)**: The eight design decisions (D1-D8) are genuinely separable — each can be made without forcing the others. The five tensions (T1-T5) are distinct, not restatements of each other. **i = HIGH**.

**Decidability (d)**: For each component, there is a concrete recommendation with alternatives ranked. The implementation path is clear: which layer to build first, which to defer. The MVE and prototype are specified to the level of "you could start coding." **d = HIGH**.

**Assessment: converged.** Another pass would refine details but not change the architecture. Proceeding to output.

---

# OUTPUT 1: Architecture Document

## Component Specification

### Noun Encoder

| Property | Value |
|----------|-------|
| Type | Transformer encoder (GPT-2 / LLaMA-style) |
| Layers | 6 (MVE: 4) |
| Hidden dim | 256 (MVE: 128) |
| Attention heads | 4 |
| Input | Standard BPE tokenization of rawContent |
| Output | Per-token representations [seq_len, hidden_dim] |
| Pooled output | CLS token or mean-pool → [hidden_dim] |
| Parameters | ~12M (MVE: ~3M) |

### Verb Encoder

| Property | Value |
|----------|-------|
| Type | Transformer encoder (smaller than noun encoder) |
| Layers | 4 (MVE: 2) |
| Hidden dim | 256 (MVE: 128) |
| Attention heads | 4 |
| Input | Hybrid encoding: text tokens (processShape) + learned embeddings (axis: 3, order: 4, stabilisation: 4, operators: vocab_size) |
| Output | Per-token representations [seq_len, hidden_dim] |
| Pooled output | CLS token or mean-pool → [hidden_dim] |
| Parameters | ~6M (MVE: ~1.5M) |

### Verb Encoding Detail

```python
class VerbEncoder(nn.Module):
    def __init__(self, d_model=256, n_operators=64):
        # Text component (processShape)
        self.text_embed = nn.Embedding(vocab_size, d_model)

        # Structured components
        self.axis_embed = nn.Embedding(3, d_model)       # D/I/R
        self.order_embed = nn.Embedding(4, d_model)       # 0-3
        self.stab_embed = nn.Embedding(4, d_model)        # stable/unstable/converging/diverging
        self.operator_embed = nn.Embedding(n_operators, d_model)

        # Projection to combine structured fields
        self.struct_proj = nn.Linear(d_model * 4, d_model)  # 4 structured fields → 1 vector

        self.transformer = TransformerEncoder(...)

    def forward(self, text_tokens, axis_id, order_id, stab_id, operator_ids):
        # Text tokens
        text_repr = self.text_embed(text_tokens)  # [B, seq, d]

        # Structured fields → single vector prepended as CLS-like token
        struct = torch.cat([
            self.axis_embed(axis_id),
            self.order_embed(order_id),
            self.stab_embed(stab_id),
            self.operator_embed(operator_ids).mean(dim=1),  # bag-of-operators
        ], dim=-1)
        struct_token = self.struct_proj(struct).unsqueeze(1)  # [B, 1, d]

        # Prepend structured token to text sequence
        x = torch.cat([struct_token, text_repr], dim=1)  # [B, 1+seq, d]

        return self.transformer(x)
```

### Convergence Layer

| Property | Value |
|----------|-------|
| Type | Bidirectional cross-attention (MVE: contrastive alignment only) |
| Layers | 2 cross-attention layers (prototype) |
| Hidden dim | 256 (matches encoders) |
| Mechanism | Noun-to-verb cross-attention + verb-to-noun cross-attention |
| Output | Fused representations [hidden_dim] for each stream |
| Parameters | ~4M (MVE: ~0.5M projection heads) |

### Reflection Module

| Property | Value |
|----------|-------|
| Type | Weight-tied re-encoding with ACT halting |
| Max iterations | 4 |
| Halting features | c/i/d scores + representation delta norm |
| Prediction heads | Motif classifier, coherence scorer |
| Parameters | ~2M (heads only — encoder weights shared) |
| Activation | Phase 3 of training only |

### Total Model Size

| Configuration | Parameters | GPU Memory (est.) |
|--------------|-----------|-------------------|
| MVE | ~5M | <1 GB |
| Prototype | ~25M | ~2-4 GB |
| Full (with reflection) | ~25M + heads | ~4-6 GB |

All configurations fit comfortably on a single RTX 3090 (24GB) or M5 Max (128GB unified). Batch sizes of 32-64 are feasible.

### Data Flow Diagram

```
                    ┌──────────────────────┐
                    │    PairedRecord DB    │
                    │   (dataset processor) │
                    └──────────┬───────────┘
                               │
                    ┌──────────┴───────────┐
                    │  Tokenization / Encoding │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                │                ▼
     ┌────────────────┐       │       ┌────────────────┐
     │  Noun Encoder   │       │       │  Verb Encoder   │
     │  (6-layer xfmr) │       │       │  (4-layer xfmr) │
     └───────┬────────┘       │       └───────┬────────┘
             │                │               │
             │         ┌──────┴──────┐        │
             └────────►│ Convergence  │◄───────┘
                       │   Layer      │
                       │(cross-attn)  │
                       └──────┬──────┘
                              │
                    ┌─────────┴─────────┐
                    │   R-Phase Gate     │
                    │  (Phase 3 only)    │
                    └─────────┬─────────┘
                              │
                    ┌─────────┴─────────┐
                    │ Reflection Pass    │
                    │ (weight-tied re-   │
                    │  encoding, 1-4x)   │
                    └─────────┬─────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
     ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
     │ Motif Head    │ │ Coherence    │ │ Halting      │
     │ (classify)    │ │ Head (c/i/d) │ │ Head (ACT)   │
     └──────────────┘ └──────────────┘ └──────────────┘
```

---

# OUTPUT 2: Key Design Decisions

## Decision 1: Dual-stream over single-stream

**Choice**: Two separate transformer encoders, one for noun data (raw text), one for verb data (structured process metadata).

**Why**: The hypothesis under test IS that forced architectural separation of structure and process produces qualitatively different representations. A single-stream model can't test this hypothesis — it might learn the separation, or it might not, and we can't tell which. Dual-stream makes the separation guaranteed and measurable.

**Rejected alternatives**:
- Single encoder with typed tokens: Can't guarantee separation
- MoE with noun/verb routing: Routing is learned, not forced; can't control what specializes
- Multi-head specialization: Softer separation, harder to measure

**Risk**: Dual-stream is more complex to implement and train. If the separation hypothesis is wrong, we've added complexity for nothing.

## Decision 2: Contrastive alignment for MVE, cross-attention for prototype

**Choice**: Start with CLIP-style contrastive alignment (simplest), upgrade to bidirectional cross-attention (richer) for the prototype.

**Why**: Contrastive alignment is well-understood, cheap, and directly tests whether paired data produces useful noun-verb alignment. If contrastive alignment works, cross-attention will work better (strictly more expressive). If contrastive alignment fails, we learn that the problem is in the data or the encoders, not in the bridge.

**Rejected alternatives**:
- Shared latent space: Requires choosing a bottleneck dimension; too many hyperparameters for a first experiment
- Gated fusion (FiLM): Asymmetric; doesn't treat both streams equally
- Full interleaved attention from the start: Too expensive for the MVE

## Decision 3: Curriculum training over simultaneous multi-task

**Choice**: D-first → D+I → D+I+R, not all losses simultaneously from the start.

**Why**: The D and I phases have opposing gradients on the encoder representations. D pushes streams apart; I requires them to be relatable. Starting with D-only ensures the streams learn distinct representations before integration begins. This mirrors how the brain develops — sensory streams differentiate before integrating.

The R-phase depends on stable D+I representations — evaluating reflexive consistency on random representations is meaningless. Adding R last ensures the reflection mechanism has something meaningful to evaluate.

**Rejected alternatives**:
- Simultaneous multi-task: Risk of D/I gradient conflict preventing either from learning
- R-first: Meaningless without good representations
- I-first: Without separation, integration has nothing to integrate

## Decision 4: Universal Transformer style reflection with ACT halting

**Choice**: Weight-tied re-encoding with Adaptive Computation Time for the R-phase.

**Why**: Weight tying means no extra parameters for reflection — the model applies the same transformation repeatedly. ACT makes variable depth differentiable and GPU-batchable. The combination is well-studied (Dehghani et al., 2018) and implementable in standard PyTorch.

**Rejected alternatives**:
- Separate reflection network: Doubles parameters; hard to train
- Fixed-depth iteration: Wastes compute on simple inputs, insufficient for complex ones
- Hard convergence threshold: Not differentiable; can't learn to halt

## Decision 5: Learnable motif template vectors over fixed embeddings

**Choice**: Initialize template vectors randomly and let the R-phase loss shape them, like prototypical networks.

**Why**: Fixed templates (e.g., from text embedding) are circular — the model would use its own representations to create its own training targets. Learned templates co-evolve with the model, converging to the structural essence of each motif as training progresses. They're also interpretable — nearest-neighbor lookup reveals what the model thinks each motif "is" in representation space.

## Decision 6: Standard context window first, structured attention later

**Choice**: Use standard transformer attention for MVE and prototype. Explore structured attention masks as an experiment once the base works.

**Why**: The structural graph vision (associative context, not sequential) is beautiful but fights every existing framework. Building custom graph operators is months of engineering that we should not invest before validating the core architecture. Structured attention masks (block-sparse patterns derived from PairedRecord metadata) are a practical approximation achievable with existing sparse attention libraries.

## Decision 7: G-phase as monitoring, not training signal

**Choice**: Novelty detection runs periodically on the validation set and flags candidates for human review. It does NOT feed back into training automatically.

**Why**: Sovereignty. The motif library is human-curated. Novel patterns detected by the model must pass human review before becoming part of the training signal. Automatic feedback risks the model reinforcing its own artifacts. The sovereignty gate is non-negotiable.

---

# OUTPUT 3: Open Questions

## Must Resolve Before Building

**Q1: Verb tokenizer vocabulary size and embedding dimensions**

The hybrid encoding requires:
- An operator vocabulary (how many distinct operators exist in the dataset processor's output?)
- Embedding dimensions for each structured field
- A strategy for combining text and structured tokens

*Resolution path*: Analyze the dataset processor's actual output. Count distinct operators, process shapes, and domain labels. Size the vocabulary accordingly. Start with d=64 for structured embeddings and project to model dimension.

**Q2: Negative sampling strategy for D-phase**

The contrastive loss requires negative pairs. Options:
- Random negatives: shuffle noun-verb pairings within a batch
- Hard negatives: pair nouns with verbs from a similar but different motif
- Curriculum negatives: start with random, progressively use harder negatives

*Resolution path*: Start with in-batch random negatives (standard InfoNCE). If training stalls, add hard negative mining. This is a standard hyperparameter choice.

**Q3: Alignment confidence threshold for training data**

PairedRecords have an `alignment.confidence` score. What threshold produces the best training set? Too high = few records. Too low = noisy supervision.

*Resolution path*: Train on multiple thresholds (0.5, 0.7, 0.9) and compare validation performance. Standard hyperparameter sweep.

## Should Resolve Through Experimentation

**Q4: Does the R-phase actually help?**

Compare prototype with and without Phase 3. If removing R-phase doesn't degrade motif recognition or cross-domain transfer, the reflection mechanism isn't contributing. This is the Level 1 test for the most novel component.

**Q5: Optimal reflection depth**

With max 4 iterations and ACT halting, how many iterations does the model actually use? If it consistently halts at 1-2, the adaptive depth isn't needed. If it consistently hits 4, the max may be too low.

**Q6: Does curriculum training outperform simultaneous multi-task?**

Compare D→D+I→D+I+R curriculum against a simultaneous `λ_D·L_D + λ_I·L_I + λ_R·L_R` baseline. The curriculum is motivated by the D/I gradient tension, but the tension may be manageable with appropriate λ values.

## Deferred (Post-MVE)

**Q7: Can the model generate language from structural representations?**

The current architecture is encoder-only. A full LLM needs a decoder. How do you decode from dual-stream representations to text? Options: standard autoregressive decoder attending to fused representations; or a dual-stream decoder with noun and verb generation heads.

**Q8: Does structural graph attention improve over standard attention?**

Requires the base architecture to work first. Test structured attention masks (motif-aware sparsity patterns) against full attention on the same model.

**Q9: Can the model recognize motifs in domains not present in training?**

The strongest test of structural understanding: train on motifs observed in biology and physics, test recognition in governance and economics. This is the cross-domain transfer test that distinguishes "learned the pattern" from "memorized the examples."

---

# OUTPUT 4: MVE Specification

## Two-Tier MVE Plan

### MVE-A: Data Validation (2-4 weeks)

**Purpose**: Test whether structurally paired training data improves structural understanding, using fine-tuning only (no custom architecture).

**Setup**:
1. Select 10,000 high-confidence PairedRecords from shard 00
2. Fine-tune two instances of Phi-3.5-mini (3.8B) or Llama-3.2-1B:
   - **Control**: Fine-tuned on `noun.rawContent` only (standard next-token prediction)
   - **Experimental**: Fine-tuned on serialized PairedRecord format (noun text + verb metadata as structured text)
3. Both models see the same total token count

**Evaluation**:
- Present novel passages containing structural patterns
- Ask each model to: identify pattern presence, classify axis/order, predict co-occurring patterns, apply pattern to new domain
- Metric: accuracy on structural tasks, compared between control and experimental

**Success**: Experimental model statistically significantly outperforms control on structural pattern recognition.

**Failure**: No significant difference → paired data format doesn't help → reconsider entire approach.

**Falsification value**: Tests the most fundamental claim (does paired data help?) with minimal engineering investment. If this fails, don't build the architecture.

**Hardware**: API fine-tuning (available now) or local on M5 Max.

### MVE-B: Architecture Validation (2-3 months)

**Purpose**: Test whether the dual-stream architecture with D/I/R training produces qualitatively different representations than a single-stream model.

**Prerequisites**: MVE-A succeeds.

**Setup**:

```
Dual-Stream Model (~5M params):
  Noun encoder: 4-layer transformer, d=128, 4 heads
  Verb encoder: 2-layer transformer, d=128, 4 heads
  Convergence: contrastive alignment (CLIP-style)
  Training: D-only (30%) → D+I (50%) → D+I+R_aux (20%)
  R_aux: prediction heads only (no reflection pass)

Single-Stream Baseline (~5M params):
  Encoder: 6-layer transformer, d=128, 4 heads
  Input: serialized PairedRecord as single token sequence
  Training: standard next-token prediction + motif classification head
```

**Training data**: 50K high-confidence PairedRecords. Same data for both models. Same total compute budget.

**Evaluation metrics**:

| Metric | What It Tests | How |
|--------|--------------|-----|
| Noun-verb alignment | Can the model predict verb features from noun representations? | Cross-prediction accuracy on held-out set |
| Motif recognition | Can the model identify which motif a passage exhibits? | Classification accuracy on held-out motif-labeled records |
| Cross-domain transfer | Given a motif in domain A, does the model recognize it in domain B? | Hold out one domain per motif during training; test recognition in held-out domain |
| Stream separation | Are noun and verb representations actually distinct? | Representational similarity analysis: cosine similarity between noun and verb embeddings for same input |
| Representation quality | Do structurally similar inputs produce similar representations? | Nearest-neighbor retrieval: do same-motif inputs cluster in embedding space? |

**Success criteria**:
1. Dual-stream outperforms single-stream on cross-domain transfer by ≥5% accuracy
2. Noun and verb representations are measurably distinct (mean cosine similarity < 0.5)
3. Convergence layer's cross-prediction loss decreases monotonically during Phase 2
4. Same-motif inputs cluster in embedding space (silhouette score > 0.3)

**Failure criteria and what they tell us**:
| Failure Mode | What It Means | Next Step |
|-------------|---------------|-----------|
| Dual-stream ≈ single-stream on all metrics | Architecture doesn't help | Abandon dual-stream; try single-stream with structured labels |
| Streams collapse (cos sim > 0.8) | D-phase failed; separation not maintained | Increase contrastive loss weight; add explicit orthogonality constraint |
| Good recognition, no transfer | Model memorized, didn't generalize | Need more diverse training domains; or structure doesn't transfer |
| D+I works but adding R doesn't help | Reflection mechanism not contributing | Simplify to D+I only; defer reflection to future work |

**Hardware**: Single RTX 3090/4090 or M5 Max. Training time: ~24-48 hours for 50K records.

**Code framework**: PyTorch. Use HuggingFace Transformers for the encoder building blocks. Custom training loop for the D/I/R curriculum. Standard evaluation library (sklearn) for metrics.

---

# OUTPUT 5: PRD Readiness Assessment

## Status: NOT YET READY — needs one more design session

### What's ready:

- [x] Architecture components specified (encoders, bridge, reflection module)
- [x] Loss functions specified to pseudocode level
- [x] Training curriculum defined (D → D+I → D+I+R)
- [x] Data flow end-to-end
- [x] MVE plan with success/failure criteria
- [x] Layered implementation path (each layer independently testable)
- [x] c/i/d stability evaluators as differentiable functions
- [x] Parameter budgets and hardware requirements
- [x] Component dependency map

### What's missing for a full PRD:

1. **Verb tokenizer specification**: Need to analyze actual dataset processor output to determine operator vocabulary, process shape descriptions, and domain label distributions. The hybrid encoding design is specified but the concrete vocabulary needs data analysis.

2. **Exact hyperparameters for training curriculum transitions**: When does Phase 1 end and Phase 2 begin? Options: fixed epoch count, or validation metric threshold (e.g., "start Phase 2 when D-loss plateaus"). Need to specify the transition criterion.

3. **Evaluation dataset construction**: The MVE evaluation requires held-out data with specific properties (novel domains, labeled motifs, structural patterns). Need to specify how this evaluation set is constructed from the dataset processor's output.

4. **Inference pipeline specification**: How does the trained model actually get used? Takes a text passage as input and produces... what? Motif classification? Structural analysis? Reasoning trace? The PRD needs a clear inference API.

5. **ISC criteria for each implementation slice**: The observer-native PRD format requires Ideal State Criteria for each slice. These need to be formalized from the success criteria specified above.

### Recommended path to PRD:

**One design session** to:
1. Analyze dataset processor output (operator vocab, domain distribution)
2. Specify the evaluation dataset construction
3. Define the inference API
4. Write ISC criteria for 5-6 implementation slices

After that session, this document plus the specification details would constitute a PRD-ready package. The architecture itself is stable — what's missing is the engineering specification that turns "build this" into "build this with these exact parameters."

---

## Summary Table

| Question | Answer |
|----------|--------|
| Architecture shape | Layered stack: dual encoders → convergence layer → D/I/R training → reflection → emergence detection |
| Key innovation | D/I/R as training curriculum (not just inference structure); reflexive R-phase with motif algebra convergence |
| Total parameters | 5M (MVE) to 25M (prototype) — fits single GPU |
| Training data | 50K+ high-confidence PairedRecords from dataset processor |
| Loss functions | D: contrastive (InfoNCE), I: cross-prediction + structured classification, R: stability + motif classification + c/i/d coherence |
| Critical bet | Structural training data compensates for small model size — the model learns more per parameter |
| MVE timeline | MVE-A: 2-4 weeks (fine-tuning only). MVE-B: 2-3 months (custom architecture) |
| What would kill it | MVE-A failure: paired data doesn't help → reconsider everything |
| PRD ready? | No — one more design session for engineering specs (verb vocab, eval dataset, inference API, ISC criteria) |
| What the analysis revealed | The architecture is a layered stack, not a monolith. Each layer is independently testable. The D/I gradient tension is real but resolvable (they operate on different network components). The motif algebra's c/i/d conditions translate cleanly to differentiable convergence criteria. 8 motifs from the library independently describe the architecture — internal consistency is high. |
