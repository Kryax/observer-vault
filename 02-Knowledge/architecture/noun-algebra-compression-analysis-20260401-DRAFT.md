---
status: DRAFT
date: 2026-04-01
type: research-analysis
source: Atlas analysis session, prompted by Adam. Follows composition algebra enumeration and project implications assessment.
vault_safety: Exploratory theoretical analysis. Does not modify any existing artifact. Proposes architectural changes requiring Adam's review.
predecessors:
  - 00-Inbox/dir-composition-algebra-motif-prediction-20260401-DRAFT.md
  - 00-Inbox/composition-algebra-project-implications-20260401-DRAFT.md
  - 01-Projects/observer-native/docs/experimental-llm-architecture-dir-analysis.md
  - 01-Projects/observer-native/docs/PRD-rivers-dual-stream-20260324.md
methodology: First-principles analysis of noun-side algebraic compression, starting from the composition algebra and the "nouns are frozen verbs" insight. Every assumption is listed explicitly. Speculative claims are separated from near-term testable ones.
---

# Noun-Side Algebraic Compression — Can We Reproduce the Verb-Side Result?

**Date:** 1 April 2026
**Core question:** The composition algebra compressed the verb side of the experimental LLM by providing structural priors that replace learned parameters. Can the same principle compress the noun side?

**Short answer:** Partially. The verb algebra constrains the noun space but does not determine it. Estimated compression: 3-5x (not 10x). The noun side retains irreducible domain content that is not algebraically derivable. But the compression, combined with verb-side gains, may be enough to bring the full model into the 15-40B range — plausibly runnable on a MacBook Pro M5 Max 128GB at reduced precision.

---

## 1. The Asymmetry Between Verb and Noun Compression

### Why the verb side compressed so well

The composition algebra provides ~90% of verb-side structure. Here's why:

1. **Verbs ARE process-shapes.** The algebra describes process-shapes. There is no gap between representation and subject matter.
2. **The composition space is small and closed.** 9 first-order compositions, ~27 second-order, with stability filtering reducing the viable set further.
3. **Structural relationships between verbs are algebraic.** D(I) and I(D) are related by the algebra itself — the model doesn't need to discover this relationship from data.
4. **Domain variation in verbs is low.** "Recursive refinement" looks structurally similar whether it's in biology, law, or software. The process-shape is invariant; only the substrate changes.

Training on the verb side becomes confirmation — checking that the algebraically predicted space matches empirical observations. The algebra does the heavy lifting. Parameters encode exceptions and domain-specific tuning, not primary structure.

### Why the noun side is different

Nouns are the outputs of stabilised verb compositions. A "tree" is the stable product of growing/photosynthesising/branching (verb processes). The noun is the frozen verb.

But freezing is lossy. The frozen output doesn't uniquely encode the process that produced it:

1. **Multiple processes can produce the same noun-class.** A "boundary" can result from D(D) (meta-distinction), D(R) (recursion-type detection), or I(D) (integration across distinctions producing an interface). The noun doesn't carry its generative history on its surface.

2. **Domain content is irreducible.** Knowing that a "tree" and a "judicial precedent" are both products of R(D)-type ratcheting tells you their STRUCTURAL relationship but not the CONTENT that distinguishes them. The content — what trees are, what precedents contain — must still be learned from data. This content is the bulk of noun-side parameters in current LLMs.

3. **Noun combinatorics are vastly larger than verb combinatorics.** There are 9 first-order verb compositions. There are millions of distinguishable nouns. The noun-to-verb ratio is not 1:1 — each verb composition produces an open class of nouns across domains. The mapping is one-to-many, and the "many" is large.

4. **Surface form variation is high.** The word "bank" (river bank vs. financial bank) requires disambiguation that the composition algebra doesn't address. Tokenization exists because surface forms need to be parsed; the algebra operates at the structural level, not the surface level.

**ASSUMPTION N1:** Nouns are downstream of verbs — each noun is produced by a stabilised process. This is the foundational claim. If some nouns are primitive (not derivable from any process), the compression argument breaks for those nouns. *Risk: LOW for abstract/structural nouns, MEDIUM for concrete/perceptual nouns like "red" or "pain" which may have non-process-derived components.*

---

## 2. What a Noun Algebra Would Look Like

### 2.1 Noun Signatures from Verb Compositions

Each of the nine first-order compositions produces a characteristic class of nouns. This gives a 9-class structural taxonomy:

| Composition | Verb Description | Noun-Class Produced | Exemplar Nouns |
|---|---|---|---|
| D(D) | Meta-distinction: distinguish distinctions | **Grammars, type systems, taxonomies** | State machines, formal grammars, classification keys, type hierarchies |
| D(I) | Distinguish integration modes | **Interfaces, modules, boundaries** | APIs, plugins, components, separation-of-concerns artifacts |
| D(R) | Distinguish recursion types | **Limits, thresholds, boundaries between regimes** | Buffer bounds, convergence criteria, halting conditions, phase boundaries |
| I(D) | Integrate across distinctions | **Bridges, translators, governance structures** | Consensus mechanisms, cross-domain mappings, governance frameworks, harmonic ratios |
| I(I) | Integrate across integrations | **Theories, unifications, meta-patterns** | Unified field theories, universal laws, structural homologies, meta-motifs |
| I(R) | Integrate across recursions | **Transfer mechanisms, cross-domain adaptors** | Biomimetic designs, borrowed methodologies, analogical solutions |
| R(D) | Recurse on distinction | **Precedents, accumulated evidence, refined categories** | Legal precedent, phylogenetic trees, trained classifiers, scientific consensus |
| R(I) | Recurse on integration | **Equilibria, standards, norms, ground states** | Homeostatic set-points, industry standards, cultural norms, crystal structures |
| R(R) | Recurse on recursion | **Observers, self-aware systems, reflexive structures** | Consciousness, meta-cognitive systems, self-monitoring architectures, mirrors |

**This is a structurally grounded noun taxonomy.** Instead of a flat vocabulary where "API" and "enzyme" start equidistant, the taxonomy tells us: "API" (D(I) class) and "plugin" (D(I) class) are structurally close; "API" (D(I) class) and "judicial precedent" (R(D) class) are structurally distant in a specific, predictable way.

### 2.2 The Representation: (composition_class, domain, instance)

Instead of representing a noun as a flat token embedding, represent it as a structured triple:

```
noun_representation = (composition_class, domain, instance_specifics)
```

Where:
- `composition_class` ∈ {D(D), D(I), D(R), I(D), I(I), I(R), R(D), R(I), R(R)} — 9 values, algebraically given
- `domain` ∈ {biology, law, software, physics, ...} — a learned vocabulary, perhaps 50-200 domain categories
- `instance_specifics` — a learned vector encoding what is unique about THIS noun within its class and domain

**What this buys:**

1. **Pre-structured embedding space.** Nouns in the same composition class start clustered. The model doesn't learn from scratch that "API" and "plugin" are related — the composition class tells it.

2. **Cross-domain transfer for free.** "API" (D(I), software) and "cell membrane" (D(I), biology) share a composition class. The model knows they are structurally analogous before seeing a single training example of the analogy.

3. **Reduced instance-specific dimensionality.** The instance_specifics vector only needs to encode what the composition class and domain DON'T already specify. This is a smaller space than encoding everything from scratch.

### 2.3 The Compression Arithmetic

Current noun-side LLMs encode ALL structure in parameters:

```
Current: noun_knowledge = structural_relationships + domain_content + surface_form_mapping
         (all learned from data, encoded in weights)
```

With algebraic priors:

```
Proposed: noun_knowledge = algebraic_structure (FREE — from composition algebra)
                         + domain_organisation (CHEAP — 50-200 categories, pre-structured)
                         + instance_content (LEARNED — but in a reduced space)
                         + surface_form_mapping (LEARNED — tokenization still needed)
```

**What fraction of parameters encodes what?**

In a current 150B noun-side model (rough estimates based on probing studies):

| Component | Fraction of Parameters | Algebraically Compressible? |
|---|---|---|
| Structural relationships between concepts | ~15-25% | YES — this is exactly what the algebra provides |
| Domain knowledge (facts about specific entities) | ~30-40% | NO — irreducible content |
| Linguistic structure (syntax, grammar, surface form) | ~20-30% | PARTIALLY — surface form parsing still needed, but reduced |
| Cross-domain analogy / transfer | ~10-15% | YES — composition class alignment handles this |
| Other (redundancy, noise, artifacts of training) | ~10-15% | ELIMINATED — algebraic priors reduce redundant learning |

**Compressible fraction: ~35-55%** — the structural relationships, cross-domain transfer, and redundancy.

**Irreducible fraction: ~45-65%** — domain content, linguistic structure, instance-specific knowledge.

**Estimated compression: 1.8x to 2.8x on the noun parameters alone.**

If we are generous about the interaction effects (algebraic priors make the remaining learning MORE efficient, not just smaller), the effective compression could reach **3-5x**.

**ASSUMPTION N2:** The parameter-fraction estimates above are approximately correct. These are informed guesses based on the probing literature, not measurements on a specific model. The actual fractions may vary significantly. *Risk: HIGH. The only way to know is to build and measure.*

**ASSUMPTION N3:** Algebraic priors and learned content are additive — having the algebraic structure makes learning the remaining content easier (fewer parameters needed for the same capability). If instead they are independent (having structure doesn't help learn content), the compression is only 1.8-2.8x. If they are synergistic (structure dramatically accelerates content learning), compression could exceed 5x. *Risk: MEDIUM. There is theoretical support for synergy (structured representations generalise better) but no direct evidence.*

---

## 3. Beyond Tokenization — What Replaces It?

### 3.1 Why Tokenization Exists

BPE/SentencePiece tokenization solves a specific problem: mapping variable-length character sequences to fixed-size vocabulary items that a neural network can process. It is linguistically arbitrary — "unhappiness" might tokenize as "un" + "happiness" or "unhapp" + "iness" depending on corpus statistics, with no structural rationale.

The tokenizer encodes NO MEANING. All meaning is learned downstream, in the embedding layer and transformer weights. This means the model must discover from scratch that "un-" is a negation prefix, that "-ness" forms abstract nouns, that "happy" and "happiness" share a root — all of which are trivially available from morphological structure.

### 3.2 What Could Replace or Augment Tokenization

**Option A: Composition-aware tokenization**

Keep BPE tokenization for surface form processing (you still need to parse characters into processable units). But add a parallel structural encoding:

```
Input: "The enzyme's binding site acts as a molecular filter"

Surface tokens: [The] [enzyme] ['s] [binding] [site] [acts] [as] [a] [molecular] [filter]

Structural encoding:
  entity: "enzyme binding site"
  composition_class: D(I)  — an interface that distinguishes integration modes
  domain: biology/biochemistry
  role: subject-as-boundary
```

The structural encoding provides TOP-DOWN priors that the surface tokens lack. The model processes both in parallel: bottom-up token features AND top-down structural classification.

**This is already implicit in the PairedRecord format.** The noun field IS the surface content; the verb field IS the structural encoding. What's new is recognising that the verb field's composition class pre-organises the noun field's embedding space.

**Option B: Process-signature tokens (more radical)**

Replace BPE tokens with tokens derived from the generative process:

```
Instead of: [enzyme] = token_4572 (arbitrary ID)
Use:        [enzyme] = (D(I), biology, catalytic_boundary)
```

Each "token" is a triple: composition class (from algebra), domain (learned taxonomy), and instance identifier (learned within-class code). The vocabulary is structured rather than flat.

**Problem:** This requires a pre-processing step that IDENTIFIES the composition class of each noun in the input. This is essentially the motif recognition task that the model is supposed to learn. Chicken-and-egg. You'd need a trained model to produce the tokens that train the model.

**Mitigation:** Use a bootstrapping approach. Start with BPE tokens + composition class annotations from the dataset processor. As the model learns, its own classifications can augment the annotations. This is Progressive Formalization applied to tokenization itself.

**Option C: Hybrid embedding with algebraic priors (most practical)**

Keep BPE tokenization. But initialise and constrain the embedding layer using algebraic structure:

```python
class AlgebraicEmbedding(nn.Module):
    def __init__(self, vocab_size, d_model, n_compositions=9, n_domains=100):
        self.token_embed = nn.Embedding(vocab_size, d_model)  # Standard BPE embeddings
        self.comp_embed = nn.Embedding(n_compositions, d_model)  # Composition class embeddings
        self.domain_embed = nn.Embedding(n_domains, d_model)     # Domain embeddings
        
        # Projection that combines algebraic priors with token features
        self.prior_proj = nn.Linear(d_model * 2, d_model)
    
    def forward(self, token_ids, comp_ids=None, domain_ids=None):
        x = self.token_embed(token_ids)
        
        if comp_ids is not None:
            # Add algebraic prior: composition class + domain as bias
            prior = self.prior_proj(torch.cat([
                self.comp_embed(comp_ids),
                self.domain_embed(domain_ids)
            ], dim=-1))
            x = x + prior  # Residual addition — prior biases, doesn't replace
        
        return x
```

This is Option C from D1 in the architecture doc (hybrid encoding), extended to the noun side. The algebraic prior biases the embedding without replacing it. If the prior is useful, the model learns to weight it. If not, it learns to ignore it (the residual connection allows this).

**ASSUMPTION N4:** Algebraic priors in the embedding layer provide useful signal that accelerates learning. If the composition class annotations are noisy or wrong, the priors add noise instead of signal. *Risk: MEDIUM. Depends entirely on annotation quality, which depends on the dataset processor's accuracy.*

### 3.3 What Happens to Embedding Spaces

In a current LLM, the embedding space is flat. All tokens start equidistant (random initialisation). The model must discover ALL structure through gradient updates.

With algebraic priors, the embedding space is PRE-STRUCTURED:

```
Current flat embedding space:
  [tree] [bank] [enzyme] [precedent] [API] [norm] — all equidistant at init

Pre-structured embedding space:
  D(I) cluster: [API] [plugin] [membrane] [enzyme_site] — close at init
  R(D) cluster: [precedent] [phylogeny] [trained_model] — close at init
  R(I) cluster: [norm] [standard] [homeostasis] [crystal] — close at init
  ...
```

The pre-structuring means:
- **Faster convergence:** The model starts closer to a good embedding geometry
- **Better generalisation:** Novel nouns in a known composition class inherit structural relationships
- **Smaller model for equivalent performance:** Less parameter capacity needed to encode structural relationships that are given for free

**But surface form processing is untouched.** The model still needs to parse "The enzyme's binding site acts as a molecular filter" into tokens and understand grammar, coreference, and syntax. These are NOT compressed by the algebra. This is why the compression is 3-5x, not 10x.

**ASSUMPTION N5:** Pre-structured embeddings provide meaningfully faster convergence and better generalisation than random initialisation. This is consistent with the transfer learning literature (pre-trained embeddings consistently outperform random) but hasn't been tested with algebraic priors specifically. *Risk: LOW-MEDIUM. The principle is well-established; the specific prior is new.*

---

## 4. Speed and Efficiency

### 4.1 Inference Speed

Current next-token prediction: at each step, the model searches the entire vocabulary (50K-200K tokens) for the most likely next token. This is an unconstrained search.

With composition-class priors: if the model can determine the composition class of the current context, it can constrain the search to nouns within that class. This is a two-stage prediction:

```
Stage 1: Predict composition class of next noun (9-way classification — cheap)
Stage 2: Predict within-class (vocabulary restricted to class members — smaller search)
```

**Potential speedup:** If class prediction is 90%+ accurate, the vocabulary search narrows by ~9x (assuming roughly equal class sizes). In practice, class sizes are unequal (R(I) nouns — norms, standards — are more common in text than I(I) nouns — theories, unifications), so the effective narrowing is maybe 3-6x on the generation step.

**But generation is not the bottleneck.** In transformer inference, the bottleneck is the attention computation over the context, not the vocabulary projection. The vocab projection is already cheap. Speedup from constrained generation is modest — maybe 5-15% wall-clock improvement.

The real speed gain comes from **smaller model = faster everything:**

| Model Size | Inference Speed (tok/s, M5 Max, fp16) | Notes |
|---|---|---|
| 150B (current noun-side projection) | ~5-10 | Doesn't fit in 128GB at fp16 |
| 70B (2x compression) | ~15-25 | Fits at fp16 with KV-cache pressure |
| 30-50B (3-5x compression) | ~30-60 | Fits comfortably at fp16 |
| 10-20B (hypothetical full compression) | ~80-150 | Fits at fp32 |

The MacBook Pro M5 Max with 128GB can run a ~70B model at fp16 (128GB ÷ ~1.8 bytes/param ≈ 71B). A 30-50B model would run comfortably with room for KV cache.

**ASSUMPTION N6:** Inference speed scales roughly linearly with model size for memory-bandwidth-bound transformer inference on Apple Silicon. This is approximately correct for the memory-bandwidth-limited regime but ignores compute-limited scenarios (small context lengths). *Risk: LOW for the large-context inference case.*

### 4.2 Training Speed and Data Requirements

The algebraic priors don't just reduce model size — they reduce the amount of data needed to learn:

**Structural relationships (algebraically given):** 
- Current: the model needs millions of examples to learn that "API" and "cell membrane" are structurally analogous
- With priors: the composition class encodes this from the start. Zero examples needed for the structural relationship.

**Domain content (still learned):**
- Current: the model needs millions of examples to learn what an enzyme IS
- With priors: unchanged. Enzymes don't get simpler because we know their composition class.

**Cross-domain transfer (algebraically boosted):**
- Current: the model needs to see the SAME structural pattern in multiple domains to learn transfer
- With priors: the composition class tells the model which domains to expect similar patterns in. Transfer learning requires fewer examples because the search space is pre-constrained.

**Estimated data requirement reduction: 2-4x for structural tasks, 1x for content tasks.** A model that currently needs 1T tokens of training might need 300-500B tokens to reach equivalent structural understanding, but still needs the full data for content knowledge.

**ASSUMPTION N7:** Data requirement scales inversely with the quality of structural priors. This is supported by the pre-training literature (better initialisation reduces data needs) but the specific ratio is a guess. *Risk: MEDIUM.*

---

## 5. Architecture Implications

### 5.1 Revised Size Estimates

The current architecture doc specifies:

| Stream | Current Projection | With Verb Algebra Only | With Noun Algebra Too |
|---|---|---|---|
| Verb stream | 10-50B | 0.5-5B | 0.5-5B (unchanged) |
| Noun stream | 150-200B | 150-200B (unchanged) | 30-70B |
| Bridge/convergence | 5-20B | 5-20B | 2-10B (both sides structured) |
| R-phase/reflection | 2-5B | 2-5B | 1-3B |
| **Total** | **167-275B** | **157-230B** | **34-88B** |

The "With Noun Algebra Too" column assumes 3-5x compression on the noun stream, proportional compression on the bridge (because both inputs are now algebraically structured), and modest compression on the R-phase.

**Best-case realistic: ~35B total.** This fits on a MacBook Pro M5 Max 128GB at fp16 (35B × 2 bytes = 70GB, leaving 58GB for KV cache and OS).

**Conservative estimate: ~60-70B total.** This fits on the same hardware at fp16 but with tighter KV cache budget. Still runnable, but inference speed drops.

**This is not the 10-30B that Adam asked about.** To hit 10-30B, you'd need ~10x compression on the noun side, which requires the irreducible domain content to also compress. See Section 6.3 for what that would take.

**ASSUMPTION N8:** The verb stream size estimate (0.5-5B with algebra) from the implications doc is approximately correct. *Risk: LOW — the algebra provides strong priors for a small space.*

**ASSUMPTION N9:** Bridge compression is proportional to input structure. If both streams are algebraically organised, the cross-attention bridge needs fewer parameters because the alignment space is pre-structured. *Risk: MEDIUM — the bridge may need the same capacity regardless, to handle edge cases where algebraic priors are wrong.*

### 5.2 What Changes in the Cross-Attention Bridge

Currently (architecture doc D2): the bridge maps between a structured verb space and a flat noun space. This is an asymmetric alignment problem — one side has structure the other doesn't.

If both sides have algebraic structure:

```
Current bridge:
  Structured verb space ←→ Flat noun space
  (asymmetric — the bridge must discover noun structure)

Proposed bridge:  
  Structured verb space ←→ Structured noun space
  (symmetric — the bridge aligns known structures)
```

Symmetric alignment is a dramatically simpler problem. Instead of discovering that "enzyme binding site" relates to "D(I) composition," the bridge knows both sides are D(I) and only needs to align the domain-specific details.

**Concrete change:** The cross-attention could include a composition-class gating mechanism:

```python
def composition_gated_cross_attention(noun_repr, verb_repr, noun_comp, verb_comp):
    # Standard cross-attention
    attn_output = cross_attention(noun_repr, verb_repr)
    
    # Composition alignment gate: boost attention when compositions match
    comp_match = (noun_comp == verb_comp).float().unsqueeze(-1)
    gate = 0.5 + 0.5 * comp_match  # 0.5 for mismatched, 1.0 for matched
    
    return attn_output * gate
```

When noun and verb share a composition class, the bridge passes signal at full strength. When they differ, it attenuates. This is a cheap, interpretable prior that the model can override if the data warrants.

### 5.3 R-Phase Convergence with Dual Algebraic Priors

The R-phase checks whether representations have stabilised. With algebraic priors on BOTH sides:

**Faster convergence:** If both noun and verb representations start in structured spaces, the R-phase reflection passes need fewer iterations to reach stability. The ACT halting probability should peak earlier — perhaps 1-2 iterations instead of 3-4.

**Sharper stability criterion:** The composition algebra's stability criterion (non-zero volume on all axes) can now be evaluated on the noun representation as well as the verb representation. A fully stable representation requires:
- Verb: classified to a composition with non-degenerate axis weights
- Noun: classified to a composition class consistent with the verb
- Bridge: alignment score above threshold
- All three axes active in both representations

This is more specific than the existing c/i/d criterion and should produce fewer false convergences.

**ASSUMPTION N10:** Algebraic priors on both sides actually reduce the number of reflection iterations needed. If the priors are wrong or noisy, they could INCREASE iterations (the model fights the priors). *Risk: MEDIUM.*

### 5.4 Does the Dual-Stream Architecture Simplify?

Adam's key question: if both sides use algebraic structure, does the architecture converge toward something simpler?

**Yes and no.**

**What simplifies:**
- The bridge becomes a symmetric alignment problem instead of an asymmetric discovery problem
- The embedding spaces are pre-structured, reducing the work the encoders must do
- The R-phase converges faster with dual priors
- Training data requirements drop because the model starts with structural priors

**What doesn't simplify:**
- You still need two encoders because the INPUT MODALITIES are different (text vs. structured metadata)
- Tokenization is still needed for the noun side (surface form parsing doesn't go away)
- Domain content still needs to be learned — the model must still know what enzymes, courts, and filesystems ARE
- The D/I/R training curriculum remains the same (the phases exercise different components)

**The architecture doesn't collapse to a single stream.** The noun and verb inputs are genuinely different modalities — natural language text vs. structured process metadata. Dual encoding is justified by input format, not just by theoretical principle.

However, the architecture COMPRESSES. The noun encoder can be smaller (fewer parameters needed to learn structure). The bridge can be simpler (symmetric alignment). The total model shrinks. The SHAPE stays the same; the SIZE decreases.

**Could a single algebra-driven architecture replace both streams?** Only if you eliminate the distinction between noun text and verb metadata — i.e., if you represent EVERYTHING as algebraic expressions. This is Layer 5 territory (structural graph replacing context window). It's not achievable in the near term. The algebra constrains and compresses representation; it doesn't replace natural language parsing.

**ASSUMPTION N11:** The dual-stream architecture remains necessary because the input modalities are genuinely different. If a way is found to encode natural language text directly as algebraic structure (without first parsing it through a transformer), this assumption breaks and the architecture could simplify radically. *Risk: LOW for near-term. This would be a fundamental breakthrough in NLP.*

---

## 6. What's Achievable vs. Speculative

### 6.1 Prototypable NOW (with existing tools)

**6.1.1 Pre-structured embedding initialisation**

Take the existing 5M MVE-B architecture. Instead of random embedding initialisation, cluster the noun vocabulary into composition classes (using the dataset processor's verb annotations on PairedRecords) and initialise embeddings so that same-class tokens start close together.

- **Effort:** Small. Requires a pre-processing pass over the PairedRecord database to compute token-to-composition-class mappings, then a modified embedding init.
- **Test:** Compare random-init MVE-B vs. algebra-init MVE-B on motif recognition and cross-domain transfer. If algebra-init converges faster or achieves higher accuracy, the noun-side compression principle is validated.
- **Depends on:** The PairedRecord database having sufficient composition annotations (requires the `compositionExpression` field from the implications doc to be populated).

**6.1.2 Composition-class prediction head**

Add a classification head to the noun encoder that predicts the composition class of the input text. This tests whether noun text carries sufficient signal to identify its generative process.

- **Effort:** Trivial. A linear layer on the CLS token output.
- **Test:** If composition class can be predicted from noun text alone with >60% accuracy (baseline = 11% for 9-way classification), there IS algebraic signal in the noun side. If accuracy is near chance, the noun side doesn't carry composition information in a recoverable form — the compression thesis weakens.
- **Depends on:** Composition-annotated training data.

**6.1.3 Noun vocabulary analysis**

For each of the nine composition classes, extract the most frequent nouns from the PairedRecord database. Measure:
- Within-class semantic similarity (are nouns in the same class actually semantically related?)
- Between-class separation (are nouns in different classes actually distinguishable?)
- Class size distribution (are classes roughly balanced or wildly skewed?)

This is pure data analysis — no model needed. It tests whether the algebraic noun taxonomy carves reality at real joints.

- **Effort:** Small. SQL/Python analysis on existing shard databases.
- **Depends on:** Composition annotations on PairedRecords.

### 6.2 Requires the Experimental Model to Be Built First

**6.2.1 Dual-algebraic-prior architecture**

The full architecture with pre-structured embeddings on both sides, composition-gated cross-attention, and enhanced R-phase stability criteria. This requires MVE-B to be built and working first — you need a baseline before testing enhancements.

**6.2.2 Compression ratio measurement**

Build two versions of the same architecture: one with algebraic noun priors (smaller noun encoder), one without (full-size noun encoder). Compare on the same evaluation suite. This measures the ACTUAL compression ratio — not estimated, but observed.

**6.2.3 KV cache structure under algebraic priors**

If the embedding space is pre-structured, the KV cache may exhibit more regular structure (clustered keys for same-composition tokens). This could enable more efficient KV cache compression techniques. But you need a working model to measure this.

### 6.3 Requires Fundamental Research (Does Not Exist Yet)

**6.3.1 Domain content compression via compositional semantics**

To reach 10-30B (10x compression), the irreducible domain content must ALSO compress. This would require a way to represent domain knowledge compositionally — e.g., "enzyme" = (D(I), biology, catalyst × protein × binding_site) where the instance specifics are THEMSELVES compositions rather than flat vectors.

This is compositional semantics — an active research area with decades of work and no scalable solution. The specific question is whether D/I/R composition provides a better basis for compositional semantics than existing approaches (lambda calculus, type-logical grammar, etc.).

**Status:** Fundamental research. No existing prototype path. Would be a contribution to linguistics and AI if it works.

**6.3.2 Algebraic tokenization**

Replace BPE entirely with process-signature tokens (Option B from Section 3.2). This requires solving the chicken-and-egg problem: you need a model to generate the tokens, but you need tokens to train the model.

Possible approach: iterative bootstrapping. Start with BPE + composition annotations. Train model. Use model to refine annotations. Retrain. Iterate until token vocabulary stabilises. This is Progressive Formalization applied to the tokenizer itself.

**Status:** Speculative but has a concrete iterative path. Could be attempted after MVE-B, before the full model. Estimated timeline: 6-12 months of research.

**6.3.3 Single-algebra unified architecture**

Replacing both streams with a single algebraic processing engine that handles nouns and verbs within one framework. This is the "Layer 5" vision: structural graph replacing context window. Would require a way to parse natural language directly into algebraic expressions — essentially, solving natural language understanding.

**Status:** Far future. This is the endpoint, not the next step.

---

## 7. Conflicts with Existing Architecture Design

### 7.1 Noun Stream Size — Tension, Not Conflict

The architecture doc (March 27) specifies the noun encoder at 12M (prototype) / 3M (MVE). These are already small. The "150-200B noun stream" is the FAMILY MODEL projection — the production-scale version that hasn't been designed yet.

Algebraic noun compression changes the family model projection, not the MVE/prototype. The near-term architecture is unaffected.

### 7.2 Tokenization — Tension

The architecture doc assumes standard BPE tokenization for the noun encoder. Algebraic tokenization (Option B) would require changing this. But Option C (hybrid embeddings) is compatible with the existing tokenizer — it adds algebraic priors ON TOP of BPE, not instead of it.

**Recommendation:** Don't change tokenization in the MVE or prototype. Add algebraic priors as a parallel channel (Option C). If they prove useful, explore deeper tokenization changes in the family model.

### 7.3 Bridge Symmetry — Compatible Change

Composition-gated cross-attention (Section 5.2) is an enhancement to the existing bridge design, not a replacement. It can be tested as an experimental variant after the base architecture works. No conflict.

### 7.4 Model Size Targets — Significant Change

The architecture doc assumes 5M (MVE) → 25M (prototype) → implied large-scale family model. If noun compression works, the family model target drops from 160-220B to 34-88B. This changes hardware requirements, training budget, and timeline projections. But it doesn't change the MVE or prototype — those are already small enough.

---

## 8. Concrete Compression and Speed Estimates

### 8.1 Compression Summary

| Scenario | Verb Stream | Noun Stream | Bridge + R | Total | Fits M5 Max 128GB? |
|---|---|---|---|---|---|
| Current projection (no algebra) | 10-50B | 150-200B | 7-25B | 167-275B | NO |
| Verb algebra only | 0.5-5B | 150-200B | 7-25B | 157-230B | NO |
| Verb + noun algebra (conservative) | 0.5-5B | 50-70B | 3-10B | 54-85B | MARGINAL (fp16) |
| Verb + noun algebra (optimistic) | 0.5-3B | 30-50B | 2-7B | 33-60B | YES (fp16) |
| Full compositional semantics (speculative) | 0.5-2B | 8-20B | 1-3B | 10-25B | YES (fp32) |

### 8.2 Speed Estimates (M5 Max 128GB, inference)

| Model Size | Precision | Memory Used | tok/s (est.) | Usable? |
|---|---|---|---|---|
| 70B | fp16 | ~140GB | ~10-15 | Marginal — OOM risk |
| 50B | fp16 | ~100GB | ~20-30 | Usable with constraints |
| 35B | fp16 | ~70GB | ~35-50 | Comfortable |
| 20B | fp16 | ~40GB | ~60-90 | Fast |
| 15B | fp32 | ~60GB | ~40-60 | Fast, full precision |

### 8.3 Training Time Estimates

| Scenario | Data Needed | Hardware | Training Time (est.) |
|---|---|---|---|
| 70B, no algebraic priors | ~1T tokens | Multi-GPU cluster | Months |
| 50B, noun algebra priors | ~300-500B tokens | Multi-GPU cluster | Weeks-months |
| 35B, full dual priors | ~200-300B tokens | Single 8×H100 node | Weeks |
| 20B, compositional semantics | ~100-200B tokens | Single 4×H100 or M5 Max | Days-weeks |

**The 35B scenario is the sweet spot** — plausibly achievable with known techniques, fits on consumer hardware at inference time, and the training compute is within reach of a modest cluster or cloud budget.

---

## 9. Prioritised Build/Test Plan

### Priority 1: Validate the noun taxonomy (effort: small, blocks everything)

Run the noun vocabulary analysis (6.1.3). For each composition class, extract the top-100 nouns from PairedRecords. Measure within-class similarity and between-class separation using existing word embeddings (word2vec, GloVe, or the noun encoder's own embeddings).

**If within-class similarity is NOT significantly higher than between-class similarity, the noun taxonomy doesn't carve at real joints and the entire compression thesis weakens.**

This is the single most important test. It requires only data analysis, no model changes.

### Priority 2: Composition-class prediction test (effort: trivial)

Add a composition-class prediction head to MVE-B when it's built. This is a single linear layer. It tests whether noun text carries composition signal.

### Priority 3: Pre-structured embedding initialisation (effort: small)

When MVE-B is built, test algebra-init vs. random-init. Compare convergence speed and final accuracy.

### Priority 4: Composition-gated cross-attention (effort: small)

After the base bridge works, add composition gating as an experimental variant.

### Priority 5: Hybrid embedding layer (effort: medium)

Implement Option C (algebraic priors in the embedding layer). Test on MVE-B.

### Priority 6: Smaller noun encoder with algebraic priors (effort: medium)

Once Priorities 1-5 validate the principle, build a noun encoder with 2-3x fewer parameters than the baseline and test whether algebraic priors compensate for the size reduction.

### Priority 7: Algebraic tokenization prototype (effort: large, speculative)

Build the bootstrapping pipeline for process-signature tokens. Test whether iterative refinement converges to a stable vocabulary. This is research, not engineering.

### Priority 8: Full compositional semantics (effort: very large, fundamental research)

Investigate whether D/I/R composition provides a basis for domain content compression. This is the path to 10-20B. It requires solving hard problems in compositional semantics.

---

## 10. Complete Assumption List

### Foundational

**N1:** Nouns are downstream of verbs — each noun is produced by a stabilised process. If some nouns are primitive (not derivable from any process), the compression argument breaks for those nouns. *Risk: LOW for abstract/structural nouns, MEDIUM for concrete/perceptual nouns.*

**N2:** The parameter-fraction estimates (15-25% structural, 30-40% domain, etc.) are approximately correct. *Risk: HIGH. These are informed guesses, not measurements.*

**N3:** Algebraic priors and learned content are synergistic — having structure makes learning content easier. *Risk: MEDIUM. Supported by transfer learning literature but untested with this specific prior.*

### Technical

**N4:** Algebraic priors in the embedding layer provide useful signal. If composition annotations are noisy, priors add noise. *Risk: MEDIUM. Depends on annotation quality.*

**N5:** Pre-structured embeddings provide faster convergence than random init. *Risk: LOW-MEDIUM. The principle is well-established; the specific prior is new.*

**N6:** Inference speed scales roughly linearly with model size on Apple Silicon. *Risk: LOW for the memory-bandwidth-limited regime.*

**N7:** Data requirements scale inversely with structural prior quality. *Risk: MEDIUM.*

### Architectural

**N8:** Verb stream at 0.5-5B with algebraic priors is sufficient. *Risk: LOW.*

**N9:** Bridge compression is proportional to input structure. *Risk: MEDIUM.*

**N10:** Dual algebraic priors reduce R-phase iteration count. If priors are wrong, they could increase iterations. *Risk: MEDIUM.*

**N11:** The dual-stream architecture remains necessary because input modalities are genuinely different. *Risk: LOW for near-term.*

### Compression estimates

**N12:** The compressible fraction of noun-side parameters is 35-55%. *Risk: HIGH. This is the critical estimate and it's a guess.*

**N13:** Interaction effects (algebraic priors making remaining learning more efficient) contribute an additional 1.5-2x compression beyond the direct structural fraction. *Risk: MEDIUM-HIGH. Plausible but unquantified.*

**N14:** The 35B sweet-spot model would match a 150B model's capability on structural tasks while trailing on pure content tasks (trivia, factual recall). *Risk: MEDIUM. The model is smaller — it WILL lose something. The bet is that what it loses matters less than what it keeps.*

### Meta-assumptions

**N15:** D/I/R composition is the correct framework for noun taxonomy. If a better organising principle exists (e.g., a content-based taxonomy), the composition-based compression would be suboptimal. *Risk: LOW-MEDIUM. The composition approach has theoretical grounding; alternatives would need to be proposed and tested.*

**N16:** The compression estimates are independent of the base model architecture. In practice, different architectures (transformer, SSM, hybrid) may compress differently under algebraic priors. *Risk: MEDIUM. The analysis assumes transformer architecture throughout.*

**N17:** Consumer hardware (M5 Max 128GB) is a relevant target. If the model is deployed as a cloud service rather than locally, compression below 70B is less valuable. *Risk: LOW. Sovereignty requires local execution — this is a project constraint, not an assumption.*

---

## 11. Summary

### What's feasible

The noun side CAN be algebraically compressed, but not to the same degree as the verb side. The composition algebra provides structural priors (noun taxonomy, pre-structured embeddings, cross-domain transfer hints) that reduce the noun stream by an estimated **3-5x** from 150-200B to **30-70B**.

Combined with verb-side compression (10-100x, from 10-50B to 0.5-5B), the total model drops from **167-275B** to approximately **34-88B**, with a sweet spot around **35-50B**.

This fits on a MacBook Pro M5 Max 128GB at fp16. It does NOT fit at fp32, and it doesn't reach the 10-30B target without fundamental advances in compositional semantics.

### What's not feasible (yet)

Compressing the noun side by 10x or more requires solving the domain content problem — representing WHAT things are, not just HOW they relate. This is the compositional semantics frontier. The D/I/R framework may provide a better basis for this than existing approaches, but this is a research hypothesis, not a known result.

### The critical test

Priority 1 (noun vocabulary analysis) determines whether the entire programme is viable. If nouns in the same composition class are NOT more similar to each other than to nouns in other classes, the algebraic taxonomy doesn't carve at real joints and the compression thesis fails.

This test can be run NOW, with existing data, in a few hours of analysis time.

### The honest answer to Adam's question

**"Can we compress the noun side like we compressed the verb side?"**

Not to the same degree. The verb side compressed 10-100x because the algebra IS about process-shapes and verbs ARE process-shapes. The noun side compresses 3-5x because the algebra CONSTRAINS noun-structure but doesn't DETERMINE noun-content. The structural skeleton compresses; the domain flesh does not.

But 3-5x on the noun side, combined with 10-100x on the verb side, brings the total model from "requires a data centre" (167-275B) to "runs on a powerful laptop" (35-50B at fp16). That's the difference between being a consumer of cloud AI and being sovereign over your own model.

The path to 10-20B exists in principle (compositional semantics) but requires fundamental research that no one has completed yet. It's a valid research direction, not a near-term engineering target.

---

*The verb-side compression was a discovery: the algebra WAS there, waiting to be recognised. The noun-side compression is an engineering programme: the algebra PROVIDES PRIORS that must be combined with learned content. The first was an insight; the second is a construction project. Both are valuable. Neither should be mistaken for the other.*
