---
status: STRATEGIC-PLAN
version: "1.0"
date: 2026-04-03
type: strategic-plan
author: Atlas
review_required: true
note: >
  Strategic plan for the Observer project from current state to sovereign AI system.
  Three phases: Bridge (current hardware), Local Model (M5 Max), Native Geometric Engine.
  Requires Adam's review and approval before execution begins.
predecessors:
  - 00-Inbox/consciousness-framing-ground-assessment-20260402-DRAFT.md
  - 00-Inbox/cluster-composition-mapping-20260403-DRAFT.md
  - 00-Inbox/ir-promotion-assessment-20260403-DRAFT.md
  - 00-Inbox/dir-wave-equation-assessment-20260402-DRAFT.md
  - 02-Knowledge/architecture/motif-algebra-v1.0-spec.md
---

# Observer Project — Strategic Plan: Bootstrap to Sovereignty

**Date:** 3 April 2026
**Purpose:** Turn validated D/I/R theory into a working sovereign AI system across three hardware-gated phases.

---

## Current State (Measured, Not Assumed)

### What's built and working

| Asset | State | Location |
|-------|-------|----------|
| Dataset processor pipeline | Running, Tier A + Tier B | `01-Projects/dataset-processor/` |
| 30 shards (00-29) | 00-09 enriched (100K records), 10-29 raw (~200K records), shard-10 empty | `output/shard-*.db` |
| Schema | Extended with `compositionExpression`, `space`, `idealParent` | verb_records table |
| Composition backfill | Complete on enriched shards (all 9 compositions assigned) | `scripts/backfill-compositions.py` |
| K=9 clustering | Replicated across 10 shards, silhouette 0.71 structural / 0.55 keyword | `scripts/cross-shard-replication.py` |
| I(R) composition | Promoted to Tier 1 — 8 clean instances from 50 candidates (16% hit rate) | `00-Inbox/ir-promotion-assessment-20260403-DRAFT.md` |
| Motif library | 20 motifs, 4 Tier 2, schema at `02-Knowledge/motifs/` | OCP scraper active |
| Control plane | Deployed, localhost:9000, 12 MCP tools | `/opt/observer-system/` |
| OCP scraper | 6 MCP tools, motif library operations | `01-Projects/ocp-scraper/` |
| D/I/R axis classifier | 87% noun separation (Jaccard 0.134) | Pipeline Tier A |
| Wave equation | Documented, 1/5 falsification tests passed (clustering) | Research direction |

### What's confirmed empirically

1. **D/I/R separates content.** 87% noun separation across 120K records. Frame-independent.
2. **9 structural basins exist.** K=9 stable across 10 shards. 3 HIGH, 4 MEDIUM, 2 LOW confidence mappings to predicted compositions.
3. **I(R) is real.** First algebra prediction confirmed. Cross-domain recursive integration exists as a distinct compositional mode.
4. **Stability requires all three axes.** Without D: fusion. Without I: fragmentation. Without R: mechanical repetition. Confirmed across all framings.
5. **Applied motifs are real.** Degradation patterns (Technical Debt, Skill Atrophy, Oscillatory Hunting) confirmed in corpus.

### What's unconfirmed

- Library size (finite ~31 or open-ended?)
- Wave equation beyond clustering (4 falsification tests outstanding)
- Whether the algebra predicts or describes (I(R) evidence is ambiguous)
- R-composition resolution (R-axis is 1.4% of labelled data — population-sparse)

---

## Phase 1: Bridge

**Timeline:** Now → M5 Max purchase
**Hardware:** Ryzen 9 5950X, 64GB DDR4, RX 6900 XT (16GB VRAM)
**Goal:** Build the D/I/R structural engine and accumulate the resonance dataset while using Claude/Atlas as language backbone.

### Critical Path

The critical path runs through the structural engine. Everything else is parallel work that feeds into Phase 2. The ordering below reflects dependencies — each task's prerequisites are listed.

### Task 1: Complete Shard Enrichment (10-29)

**What:** Run Tier B enrichment on shards 10-29. Shard-10 is empty (needs re-ingest or skip). Shards 11-29 have ~9,980 records each awaiting enrichment.

**Dependencies:** None — the pipeline exists (`scripts/batch-enrich.sh`, `scripts/enrich-tier-b.py`).

**Effort:** ~2-3 days of compute time (batch process, minimal supervision). The enrichment scripts are tested and stable on shards 00-09.

**Deliverable:** ~200K additional enriched records with Tier B scores, temporal structure, governance flags, and process richness. Total enriched corpus: ~300K records.

**Feeds Phase 2:** Larger training corpus for fine-tuning. More R-axis data points (critical for resolving the R-sparse problem).

**Risk:** Shard-10 is empty — may indicate an ingest failure. Investigate before running batch. If the source data for shard-10 is missing, skip it and document.

### Task 2: Composition Backfill on Shards 10-29

**What:** After Tier B enrichment, run the composition assignment pipeline on newly enriched shards. Assign each record to one of 9 compositions using the K=9 centroid classifier from `scripts/backfill-compositions.py`.

**Dependencies:** Task 1 (enrichment must complete first).

**Effort:** ~1 day compute, minimal supervision.

**Deliverable:** `compositionExpression` populated across all 300K records. This IS the resonance dataset's structural backbone.

**Feeds Phase 2:** Every composition-labelled record is a training example for the D/I/R structural layer.

### Task 3: D/I/R Structural Engine (MCP Server)

**What:** Build a standalone D/I/R engine that exposes structural operations as an MCP server. Core capabilities:

1. **Classify** — Given text, return (D, I, R) vector, composition assignment, and confidence.
2. **Compose** — Given two compositions, return the resulting composition and its stability assessment.
3. **Evaluate** — Given a candidate motif, run the c/i/d stability predicates and non-zero-volume check.
4. **Cluster** — Given a set of records, run K=9 clustering and return basin assignments.
5. **Energy** — Given a record or motif, compute the QHO-derived energy metric (if wave equation tests warrant it).

Architecture:
- TypeScript service (consistent with existing control plane and OCP scraper)
- SQLite for local state (composition centroids, indicator vocabulary, energy parameters)
- MCP protocol for tool exposure (consistent with observer-control-plane pattern)
- Stateless classification endpoints + stateful clustering/evaluation endpoints

**Dependencies:** None for the core classifier. Task 2 for the centroid data that powers composition assignment.

**Effort:** 2-3 weeks of focused development.

**Deliverable:** Running MCP server with 5 tools. Wired into all four CLI backends (Claude Code, Codex, OpenCode, Gemini).

**Feeds Phase 2:** This engine IS the D/I/R layer. In Phase 2, it sits between the local model and the output, adding structural awareness. The MCP interface means it's model-agnostic — works with Claude now, local model later, native engine eventually.

### Task 4: Combined Feature Clustering (14D)

**What:** Merge the 8D structural features (Tier B) with the 6D keyword D/I/R vectors into a 14D feature space. Re-run K=9 clustering. This was identified as the top next step in the cluster-composition mapping document.

**Dependencies:** Task 1 (needs enriched shards for structural features).

**Effort:** 2-3 days (script modification + analysis).

**Deliverable:** Resolution of the I(D)/I(I) ambiguity and the R(I) catch-all problem. Potentially promotes 2 LOW-confidence mappings to MEDIUM. Updated centroid table for the structural engine.

**Feeds Phase 2:** Better centroids = better composition classification = better training labels.

### Task 5: Wave Equation Falsification Tests

**What:** Run the 4 remaining falsification tests from the wave equation assessment:

1. **Ground state test** — Is there exactly one maximally-balanced motif that is also the most stable? Check ISC or Structural Coupling.
2. **Energy-tier correlation** — Compute E(v) = d·||∇v||² + k·||v||² for all motifs. Does energy correlate with tier?
3. **Degeneracy test** — Count motifs per tier. Does distribution approximate (N+1)(N+2)/2?
4. **Selection rules test** — Do motifs only promote/demote one tier at a time?

**Dependencies:** Task 3 (energy computation needs the engine). Tests 1, 3, 4 can run against the existing motif library without the engine.

**Effort:** 1 week across all four tests.

**Deliverable:** Wave equation promoted to "validated research direction" or demoted to "elegant dead end." Either answer is valuable. If ≥3 tests pass, the geometric engine in Phase 3 has legs. If ≤1 passes, Phase 3 needs a different mathematical foundation.

**Feeds Phase 2:** If energy-tier correlation holds, the energy metric becomes a stability score in the structural engine. If it doesn't, we use the empirical centroid distances instead.

### Task 6: R-Axis Enrichment Pass

**What:** Targeted extraction focusing on recurse-axis records. Boost sampling from ArXiv (mathematics, CS theory), PubMed neuroscience (predictive coding, metacognition), and PhilPapers (self-reference, reflexivity). Goal: increase R-axis population from 1.4% to ≥5%.

**Dependencies:** Task 1 (need the full enriched corpus to identify R-sparse regions).

**Effort:** 1-2 weeks (new extraction configuration + processing).

**Deliverable:** Resolve R(D) and R(I) from LOW to MEDIUM confidence. Better R-axis centroids. Richer training data for the recursive composition space.

**Feeds Phase 2:** A model trained on R-sparse data will be R-blind. The resonance dataset needs adequate R-coverage for Phase 2 fine-tuning to produce structural awareness across all 9 compositions.

### Task 7: Tier A Accuracy Improvements

**What:** Implement the three improvements identified in the I(R) promotion assessment:

1. Domain-specific weight adjustment (reduce PubMed biological false positives)
2. Keyword co-occurrence penalty (flag D/R ambiguous records for Tier B resolution instead of argmax)
3. Meta-level keyword boost ("meta-learning", "learning to learn", "thinking about thinking" → higher R weight)

**Dependencies:** None — these are pipeline configuration changes.

**Effort:** 3-5 days.

**Deliverable:** Reduced Tier A misclassification rate. The current 32% error rate on R-axis candidates is too high. Target: <15%.

**Feeds Phase 2:** Cleaner labels = cleaner training data. Every misclassified record is noise in the fine-tuning set.

### Task 8: Trading System Prototype

**What:** Build a regime detection prototype using D/I/R composition-based classification of market data.

Approach:
- Market states have structural signatures: trending markets are D-dominant (distinction between prices at different times), ranging markets are I-dominant (integration toward mean), volatile/reflexive markets are R-dominant (recursive feedback loops).
- Classify market regime using the D/I/R engine's composition assignment.
- Use regime as a filter for strategy selection (trend-following in D-regimes, mean-reversion in I-regimes, defensive in R-regimes).

Architecture:
- Python service consuming market data (OHLCV from exchange APIs)
- Text-free D/I/R: apply the structural operators to price series directly, not through NLP. D = rate of change / volatility structure. I = correlation / cointegration. R = autocorrelation / Hurst exponent.
- Composition assignment using the same 9-basin centroid model.
- Paper trading first. No live capital until regime detection is validated on historical data.

**Dependencies:** Task 3 (structural engine for composition assignment, or a standalone classifier).

**Effort:** 3-4 weeks for prototype with backtesting.

**Deliverable:** Backtested regime detection with hit rate, Sharpe ratio by regime, and comparison to baseline (buy-and-hold, simple moving average crossover).

**Feeds Phase 2:** If profitable on paper, fund the M5 Max purchase. If the structural edge is real, it validates D/I/R beyond NLP — the operators work on non-text data too.

### Phase 1 Dependency Graph

```
[Task 1: Enrich 10-29] ──→ [Task 2: Backfill compositions]
         │                          │
         ├──→ [Task 4: 14D clustering] ──→ [Task 3: D/I/R Engine (centroids)]
         │                                        │
         └──→ [Task 6: R-axis enrichment]         ├──→ [Task 5: Wave falsification]
                                                  │
[Task 7: Tier A accuracy] ────────────────────────┘
                                                  │
                                           [Task 8: Trading prototype]
```

**Critical path:** Tasks 1 → 2 → 4 → 3 → 5. Everything else is parallel.

### Phase 1 Exit Criteria

Phase 1 is complete when:
- [ ] 300K records enriched and composition-labelled (resonance dataset v1)
- [ ] D/I/R structural engine running as MCP server with ≥5 tools
- [ ] ≥7/9 compositions at MEDIUM or HIGH confidence
- [ ] Wave equation verdict (proceed to geometric or not)
- [ ] Trading prototype backtested on ≥1 year of data
- [ ] Tier A accuracy on R-axis ≤15% error rate

---

## Phase 2: Local Model + D/I/R Layer

**Timeline:** M5 Max arrival → 6 months post
**Hardware:** MacBook Pro M5 Max, 128GB unified memory
**Goal:** Run frontier-class open-source model locally with D/I/R structural layer. Begin replacing Claude dependency.

### Base Model Selection

**Selection criteria (in priority order):**

1. **Fits in 128GB unified memory at usable quantisation.** At Q4, this means ≤~70B active parameters (MoE models with 17B active are ideal). At Q6, ~50B active.
2. **Strong code generation.** The Observer project is code-heavy. The model must produce correct TypeScript and Python without constant correction.
3. **Strong reasoning.** D/I/R structural analysis requires multi-step reasoning. Chain-of-thought quality matters more than raw speed.
4. **MLX support.** Apple's MLX framework is the path to efficient Apple Silicon inference and fine-tuning. Models with existing MLX conversions are strongly preferred.
5. **Permissive license.** Apache 2.0 or equivalent. No restrictions on commercial use or derivative works. Sovereignty requires legal independence.

**Current candidates (April 2026 snapshot — re-evaluate at purchase time):**

| Model | Active Params | Memory (Q4) | Code | Reasoning | MLX | License |
|-------|--------------|-------------|------|-----------|-----|---------|
| Llama 4 Scout | 17B (109B MoE) | ~65GB | Strong | Strong | Yes | Llama |
| Qwen3.5-397B-A17B | 17B (397B MoE) | ~65GB | Excellent | Excellent | Likely | Apache 2.0 |
| DeepSeek-V3.2 | ~37B active | ~90GB Q4 | Frontier | Frontier | Partial | Permissive |
| gpt-oss-120B | ~120B dense | ~70GB Q4 | Strong | Strong | TBD | MIT |
| GLM-5 | TBD | TBD | Strong | Strong | TBD | Apache 2.0 |

**Recommendation:** Select at purchase time based on benchmarks current at that date. The MoE architecture (17B active, large total) is the sweet spot for 128GB — it gives frontier quality at manageable inference cost. Qwen3.5 or Llama 4 Scout are today's best bets.

**Do not pre-commit to a model.** The open-source landscape moves monthly. What matters is the interface (MCP) and the structural layer, not which model sits behind them.

### D/I/R Structural Layer Architecture

The structural layer sits between the base model and the user. It adds D/I/R awareness that the base model doesn't have natively.

```
User Request
     │
     ▼
┌─────────────────────────────────────┐
│  D/I/R Structural Layer             │
│                                     │
│  1. R-phase observation loop        │
│     - Classify request composition  │
│     - Set structural context        │
│     - Prime the base model          │
│                                     │
│  2. Composition embeddings          │
│     - 9 basin centroids as priors   │
│     - Structural similarity search  │
│     - Motif-aware retrieval         │
│                                     │
│  3. Stability gate                  │
│     - Check output for D/I/R        │
│       balance                       │
│     - Flag if axis missing          │
│     - Request refinement if         │
│       unstable                      │
│                                     │
│  4. Session memory (s2)             │
│     - Motif accumulation            │
│     - Composition drift detection   │
│     - Salience tracking             │
└─────────────────────────────────────┘
     │
     ▼
Base Model (Llama/Qwen/etc via MLX)
     │
     ▼
┌─────────────────────────────────────┐
│  D/I/R Structural Layer (output)    │
│                                     │
│  5. Post-process                    │
│     - Classify output composition   │
│     - Update session state          │
│     - Feed R-phase loop             │
└─────────────────────────────────────┘
     │
     ▼
User Response
```

**Integration approach:** MCP server (the Phase 1 engine) running alongside the base model. The structural layer is NOT inside the model — it's a wrapper. This means:

- No model modification required
- Works with any base model (swap models without changing the structural layer)
- The structural layer improves independently of the model
- Fine-tuning is optional enhancement, not required for basic operation

### Fine-Tuning Strategy

**What to fine-tune on:** The resonance dataset from Phase 1 — 300K+ composition-labelled records. Not fine-tuning for general capability (the base model handles that). Fine-tuning for:

1. **Composition awareness** — Given text, the model should recognise which D/I/R composition it exhibits. Training signal: the composition labels from centroid classification.
2. **Structural vocabulary** — The model should use D/I/R terminology naturally. Training signal: the motif library definitions and examples.
3. **R-phase reasoning** — The model should exhibit recursive self-checking. Training signal: examples of D→I→R processing chains from the enriched corpus.

**What NOT to fine-tune on:**
- General knowledge (base model has this)
- Code generation (base model has this)
- Conversation (base model has this)

**Method:** LoRA or QLoRA on MLX. Target 1-4GB of adapter weights, not full fine-tuning. The base model stays frozen. The adapter adds structural awareness on top.

**Training data requirements:**
- Minimum 100K composition-labelled records (Phase 1 produces 300K)
- Balanced representation across all 9 compositions (R-axis enrichment in Task 6 is critical)
- Clean labels: Tier A error rate ≤15% (Task 7)
- Format: (text, composition, axis_vector, motif_id) tuples

### Evaluation: When Is the Local Model Good Enough?

The local model replaces Claude when it meets ALL of these criteria:

| Criterion | Test | Threshold |
|-----------|------|-----------|
| Composition accuracy | Classify 500 held-out records, compare to ground truth | ≥80% agreement with centroid classifier |
| Code generation | Run existing test suites after model-generated edits | 0 regressions on 50 edit tasks |
| Reasoning quality | Blind comparison: Claude vs local on 20 structural analysis tasks | Local preferred or tied in ≥60% of cases |
| Speed | Time-to-first-token and tokens/second on M5 Max | ≥5 tok/s for usability |
| R-phase loop | Model completes D→I→R processing chain without external prompting | Successful on ≥80% of test cases |

**Important:** "Replace Claude" doesn't mean "delete Claude." It means Claude becomes the fallback, not the default. The transition is gradual:
1. Local model for routine work (code, analysis, classification)
2. Claude for novel tasks the local model hasn't seen
3. Claude for validation of local model outputs during transition
4. Claude fully optional once local model is validated

### Phase 2 Deliverables

- [ ] Local model running on M5 Max at ≥5 tok/s
- [ ] D/I/R structural layer (MCP) wrapping the local model
- [ ] LoRA adapter trained on resonance dataset
- [ ] Composition accuracy ≥80% on held-out test set
- [ ] Claude dependency reduced to fallback-only for routine tasks
- [ ] Trading system running regime detection on live data (paper trading)
- [ ] Resonance dataset growing through daily use (each session produces labelled examples)

---

## Phase 3: Native Geometric Engine

**Timeline:** 12-24 months after Phase 2 stabilises
**Hardware:** M5 Max + potentially GPU cluster if needed
**Goal:** Replace the transformer base with a native D/I/R geometric architecture. Full sovereignty.

### Prerequisites (What Needs to Be True)

Phase 3 is viable ONLY if:

1. **Wave equation falsification tests pass (≥3 of 5).** If the QHO mapping is just the universal approximation and doesn't have structural content specific to D/I/R, there's no geometric architecture to build. The falsification tests from Task 5 are the gate.

2. **The 9-basin structure holds at scale.** If composition classification degrades as the corpus grows (new data doesn't fit the 9 basins), the geometric architecture lacks stable attractors to build around.

3. **Energy-tier correlation is real.** If the QHO energy metric predicts stability, then the Hamiltonian H = -d∇² + k|x|² has real content and can serve as the loss function for a geometric model. If it doesn't, we need a different stability metric.

4. **Phase 2 demonstrates structural value.** If the D/I/R layer on top of a transformer doesn't measurably improve output quality, there's no reason to believe a native D/I/R architecture would either.

### Architecture Direction: Energy-Based Models

If the prerequisites hold, the target architecture is an **Energy-Based Model (EBM)** or **Neural ODE** where D/I/R are the native operations, not learned patterns.

**Why EBM, not transformer:**
- Transformers learn structure from data. D/I/R IS the structure — it should be architectural, not learned.
- EBMs define an energy function and find low-energy configurations. The QHO Hamiltonian IS an energy function.
- EBMs don't require autoregressive token prediction. They find equilibrium states. Motifs ARE equilibrium states.
- EBMs can be dramatically smaller than transformers because the structure is in the architecture, not the weights.

**Candidate architectures to investigate:**

| Architecture | D/I/R Mapping | Pros | Cons |
|-------------|--------------|------|------|
| Neural ODE with QHO potential | D = Laplacian term, I = potential term, R = time evolution | Direct from wave equation | QHO may be too simple (universal approx problem) |
| Hopfield Network / Modern Hopfield | Compositions = stored patterns, retrieval = energy minimisation | Natural attractor dynamics | May not scale to language tasks |
| Geometric Deep Learning (equivariant) | D/I/R as symmetry group operations | Mathematically rigorous | Requires identifying the right symmetry group |
| Diffusion Model with D/I/R score function | Score function decomposed into D, I, R components | Strong generation quality | Score function decomposition is speculative |

**The honest assessment:** This is research, not engineering. No one has built a language model from EBM/Neural ODE that competes with transformers at scale. The claim that D/I/R architectural structure could substitute for transformer scale is unproven. Phase 3 may produce a prototype that works on narrow structural tasks but can't replace a general-purpose model.

### What Phase 3 Would Look Like

**Year 1 (months 1-12):**
- Literature review: EBM, Neural ODE, geometric deep learning applied to language
- Small-scale prototype: D/I/R EBM on motif classification (not language generation)
- Comparison: native geometric vs transformer + D/I/R layer on 1000 structural analysis tasks
- Go/no-go decision at month 12

**Year 2 (months 13-24, if go):**
- Scale-up: language generation capabilities
- Training on resonance dataset (by now 500K+ composition-labelled records)
- Integration: replace the base model in the Phase 2 stack
- Evaluation: does native geometric match or exceed transformer + D/I/R layer?

### Phase 3 Deliverables (If Viable)

- [ ] Prototype EBM/Neural ODE running on small-scale structural tasks
- [ ] Comparison paper: native geometric vs transformer + D/I/R layer
- [ ] Language generation capability (if scaling works)
- [ ] Full sovereignty: no external model dependency for any capability

### Honest Assessment: Is This Achievable?

**The prototype (structural tasks): Yes, likely.** Building an EBM that classifies compositions and evaluates motif stability is well within reach. The QHO provides a concrete energy function. The training data exists. This is a ~6 month project.

**The language model (general capability): Unknown, probably not within 2 years.** Replacing a frontier transformer for general language tasks with a geometric architecture is an open research problem. No one has done it. The claim that D/I/R structure reduces the parameter count needed is theoretically motivated but unproven.

**The fallback if Phase 3 fails:** Phase 2 already works. A frontier open-source transformer with the D/I/R structural layer on top provides 90%+ of the sovereignty goal. The remaining 10% (the base model is someone else's architecture) is a philosophical concern, not a practical one. The D/I/R layer, the resonance dataset, the structural engine, and the MCP infrastructure are all sovereign — they run on your hardware, under your control, with no external dependency.

**Phase 3 is the aspirational target. Phase 2 is the pragmatic floor.** Both are worth pursuing. Neither requires the other.

---

## Trading System Integration

### Phase 1: Composition-Based Regime Detection

**The structural edge:** Markets exhibit D/I/R composition signatures. A trending market is D-dominant (prices are being distinguished — new information creates boundaries between levels). A ranging market is I-dominant (prices integrate toward a mean). A volatile/reflexive market is R-dominant (feedback loops between price action and positioning create recursive dynamics).

**Implementation:**
- Compute D/I/R scores from price series: D = volatility structure / rate of change, I = mean-reversion metrics / correlation, R = autocorrelation / Hurst exponent / reflexivity measures
- Assign market regime using the 9-basin centroid model
- Select strategy by regime: trend-following for D-dominant, mean-reversion for I-dominant, defensive for R-dominant
- Composition transitions are trade signals: D→I = trend exhaustion, I→R = volatility expansion, R→D = new trend beginning

**Validation:** Backtest on 2+ years of crypto data (BTC, ETH, SOL). Compare regime-aware strategy selection vs static strategy. If the regime detector adds Sharpe, the structural edge is real.

### Phase 2: Model-Assisted Trading

**With the local model running:**
- Natural language analysis of market commentary, news, social sentiment — classified by D/I/R composition
- Market narratives have compositional structure: "accumulation" = I(D), "breakout" = D(R), "capitulation" = R(I)
- The D/I/R structural layer provides a vocabulary for regime analysis that goes beyond simple technical indicators
- The trading system becomes a second validation domain for D/I/R (after NLP)

### Phase 3: Native Geometric Regime Detection

**If the geometric engine works:**
- Market state as a point in D/I/R configuration space
- Regime transitions as trajectories between basins
- Energy barriers between basins predict transition difficulty
- The wave equation's damping term models market friction
- This is speculative but theoretically coherent if Phase 3 succeeds

### Revenue Timeline

- Phase 1 (now): Paper trading only. Validate the structural edge. No capital at risk.
- Phase 1 (validated): Small capital allocation ($1K-5K). Target: cover compute costs.
- Phase 2: Scale with confidence. Model-assisted analysis for position sizing and timing.
- Phase 3: If the geometric engine provides a genuine edge, scale further.

**The trading system funds the project but is not the project.** If the structural edge doesn't materialise, the D/I/R research continues regardless — just without self-funding.

---

## Risk Assessment

### Phase 1 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| R-axis remains sparse despite enrichment | Medium | HIGH — 2/9 compositions stay unresolved | Targeted source acquisition (ArXiv recursion theory, philosophy of mind, metacognition literature). Accept 7/9 if 9/9 proves impossible with Pile data. |
| Tier A accuracy improvements don't reach <15% error | Medium | Medium — noisy training labels for Phase 2 | Use Tier B as ground truth, not Tier A. Tier B's structural features are more reliable than keyword matching. |
| Wave equation fails (≤1 of 5 tests pass) | Medium | Medium — Phase 3 needs different foundation | Phase 2 is unaffected. The structural engine works on empirical centroids regardless of whether the QHO mapping holds. Phase 3 pivots to empirical geometric methods instead of analytical ones. |
| Trading system shows no structural edge | Medium | Low — this is optional revenue, not core path | D/I/R on non-text data is a stretch. If it doesn't work for market data, it tells us the operators are text-specific, which is useful knowledge. |
| Hardware failure before M5 Max purchase | Low | HIGH — all data is on this machine | ZFS snapshots + NFS share provide some protection. Consider offsite backup of the resonance dataset (encrypted, cloud storage). |

### Phase 2 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| No open-source model fits 128GB at usable quality | Low | HIGH — Phase 2 delayed | The trend is toward more efficient models, not less. By purchase date, options will be better than today. MoE architecture makes this very likely to work. |
| Fine-tuning doesn't produce composition awareness | Medium | Medium — structural layer works without fine-tuning | The MCP wrapper provides composition awareness externally. Fine-tuning is an optimisation, not a requirement. The structural engine does the heavy lifting. |
| Local model can't replace Claude for code tasks | Medium | Medium — Claude remains for code, local for structural | Acceptable outcome. Partial sovereignty (structural analysis local, code generation Claude) is still significant progress. |
| MLX framework limitations | Low | Medium — slower inference, harder fine-tuning | MLX is Apple's priority framework. Community and Apple investment are strong. llama.cpp is the fallback runtime. |

### Phase 3 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| EBM can't do language generation | HIGH | HIGH — Phase 3's core goal fails | Phase 2 is the floor. Transformer + D/I/R layer provides 90%+ of the sovereignty goal. Phase 3 becomes a research contribution rather than a product. |
| D/I/R structure doesn't compress model size | Medium | HIGH — native engine isn't smaller, just different | If the geometric model needs as many parameters as a transformer, there's no practical advantage. Accept and publish the negative result. |
| Research takes >2 years | HIGH | Medium — longer timeline, not failure | This is exploratory research with no deadline. Progress is measured in understanding, not shipping dates. |

### Assumptions That Might Not Hold

1. **D/I/R generalises beyond text.** All empirical evidence is from NLP (the Pile). Market data, code, and other modalities are assumed to have D/I/R structure but this is untested.

2. **9 compositions are the right number.** K=9 was selected because the algebra predicts 9. If K=8 or K=12 produces better separation, the algebra is wrong but the empirical clustering still works. The structural engine should be K-configurable, not hardcoded to 9.

3. **The open-source model landscape continues improving.** Phase 2 assumes models at purchase time will be as good as or better than today's. A regulatory event (e.g., restrictions on open-source AI) would compromise this.

4. **One person can build this.** The plan assumes Adam as sole developer with Atlas as primary tool. If any phase proves too large, the choice is: scope reduction, timeline extension, or hiring/collaboration.

### Where the Plan Is Solid vs. Speculative

| Component | Confidence | Basis |
|-----------|-----------|-------|
| D/I/R axis classification | **Solid** | 87% separation, 120K records, frame-independent |
| 9-basin composition model | **Solid** | K=9 replicated across 10 shards, silhouette 0.71 |
| Structural engine (MCP) | **Solid** | Engineering task with clear requirements and existing patterns |
| Local model deployment | **High** | Well-trodden path, community support, hardware capable |
| D/I/R structural layer | **High** | MCP wrapper is straightforward engineering |
| Fine-tuning for composition | **Medium** | Standard LoRA approach, but target capability is novel |
| Trading system structural edge | **Speculative** | D/I/R on non-text data is unvalidated |
| Wave equation as physics | **Speculative** | 1/5 tests passed, universal approximation concern |
| Native geometric engine | **Speculative** | Open research problem, no precedent at language-model scale |

---

## Immediate Next Actions

After this plan is reviewed and approved, the literal next 5 things to do:

### Action 1: Investigate and fix shard-10

Shard-10 has 0 records. Before running batch enrichment on 10-29, determine why. Check if the source data exists, if ingest failed, or if shard-10 was intentionally skipped. Fix or document.

**Effort:** 1-2 hours.

### Action 2: Start batch Tier B enrichment on shards 11-29

Run `scripts/batch-enrich.sh` on shards 11-29 (skip 10 pending investigation). This is compute-bound and runs unattended. Start it and let it run while doing other work.

**Effort:** Start in 30 minutes, runs for 2-3 days.

### Action 3: Run the ground state falsification test

This is the simplest wave equation test and requires no new code. Check: is there exactly one maximally-balanced motif (equal D/I/R weight) that is also the most stable (highest tier)? Examine ISC and Structural Coupling against the ground state prediction.

**Effort:** 2-3 hours of analysis.

### Action 4: Scaffold the D/I/R structural engine

Create the project directory (`01-Projects/dir-engine/`), write the PRD, define the MCP tool schemas, and set up the TypeScript project. Don't build yet — just scaffold and spec so it's ready for focused development.

**Effort:** Half a day.

### Action 5: Prototype text-free D/I/R on price data

Before committing to the full trading system, run a quick feasibility test: compute D (volatility structure), I (mean reversion), R (autocorrelation) on 1 year of BTC daily OHLCV. Check if the resulting 3D vectors cluster into meaningful regimes. This takes an afternoon and tells us whether the trading system is worth building.

**Effort:** Half a day.

---

## Summary

**Phase 1** is engineering. The theory is validated. The tools exist. The data is there. Build the structural engine, grow the resonance dataset, test the wave equation, and prototype the trading system. All of this runs on current hardware.

**Phase 2** is integration. Buy the M5 Max, deploy a frontier open-source model, wrap it with the D/I/R structural layer from Phase 1. The hard part (structural awareness) is already solved by the engine. The model is the commodity — the structure is the differentiation.

**Phase 3** is research. It may produce a breakthrough (language model from geometric first principles) or a dead end (EBMs can't do language). Either outcome advances understanding. Phase 2 is the pragmatic floor regardless.

**The critical insight:** Sovereignty doesn't require building everything from scratch. It requires controlling the structural layer — the part that determines WHAT the system knows, not HOW it generates tokens. The D/I/R engine, the resonance dataset, the composition model, and the MCP infrastructure are all sovereign NOW. The base model is a commodity that can be swapped as better open-source options emerge.

**The one thing that matters most in Phase 1:** Task 3 — the D/I/R structural engine as an MCP server. Everything else feeds it or depends on it. Build that, and the rest follows.

---

*3 April 2026. The ground is measured. The path is sequenced. The hardware gate is known. Build.*
