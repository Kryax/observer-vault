---
⚠️ VAULT SAFETY HEADER
authority_boundary: This document is VAULT content (narrative/rationale/planning).
vault_rule: The Workspace does NOT derive from this document.
human_gate: Promotion to canonical requires Adam's explicit approval.
ai_rule: AI agents may READ this document. AI agents may CREATE new documents referencing this one. AI agents may NOT modify canonical vault documents.
---

# PRD: Gen 2 Native D/I/R Encoder Model

**Status:** DRAFT
**Date:** 2026-04-09
**Author:** Atlas (Claude Code) on behalf of Adam
**Engine validation:** dir_classify, dir_energy, dir_transition — results in Section 9
**Depends on:** `output/training_data_dir_v1.jsonl` (240,021 records), D/I/R engine MCP server
**Blocks:** Gen 3 decoder model, full-Pile processing, multimodal trading integration

---

## 1. Problem Statement

The D/I/R engine's current sensor is a 488-indicator lexical vectoriser. It has hit its ceiling:

- **Vocabulary-dependent.** Classification quality depends on whether the input contains specific indicator words. Synonyms, paraphrases, and domain-specific jargon that express the same structural pattern get different vectors.
- **Low confidence.** Mean confidence across 240K training records is 0.5255. The engine's own assessment during the motif discovery process (Session 2026-04-08) showed confidence scores ranging 0.10–0.55 for novel inputs, with zero-vector/zero-confidence returns on structurally valid questions (e.g., the artefact question returned R(D) at confidence 0.00).
- **Phrasing-sensitive.** The same architectural concept classified as R(I) at 0.36 confidence in one phrasing, R(R) at 0.26 in another, and R(D) at 0.00 in a third. The lexical surface dominates the structural signal.
- **No generalisation path.** Adding more indicators yields diminishing returns. The vectoriser cannot learn; it can only be manually extended.
- **Skipped records.** 57,879 records (19.4%) were excluded from training data export due to being unclassified (1,773), temporal-only (33,159), or low-confidence (22,947). A semantic encoder could recover many of these.

The energy landscape and transition mechanics (dir_energy, dir_transition) are sound — basin depths, barrier heights, and gradient vectors produce consistent, meaningful signals. The sensor is the bottleneck, not the topology.

---

## 2. Objective

Replace the 488-indicator lexical vectoriser with a neural encoder that produces the same output format through learned semantic representations instead of keyword matching.

### What Changes

| Component | Gen 1 (Current) | Gen 2 (This PRD) |
|-----------|-----------------|-------------------|
| Sensor | 488-indicator lexical match | Neural encoder (300-400M params) |
| Input | Text → keyword scan | Text → bidirectional attention |
| Output | 6D vector + composition label | 6D vector + composition label (same format) |
| Confidence basis | Indicator coverage ratio | Model softmax / regression uncertainty |
| Context window | Unlimited (bag of words) | 8,192 tokens |
| Training | None (hand-tuned indicators) | Supervised on 240K engine-labelled records |

### What Stays the Same

- 5 MCP tools: dir_classify, dir_compose, dir_energy, dir_transition, dir_status
- 6D vector format: [D, I, R, temporal, density, entropy]
- 9 composition labels: D(D), D(I), D(R), I(D), I(I), I(R), R(D), R(I), R(R)
- Langevin energy landscape (dir_energy, dir_transition) — unchanged
- Composition algebra (dir_compose) — unchanged

### What It Enables (Bootstrap Loop)

```
Gen 1 (lexical heuristics, 488 indicators)
  → labels 240K records from Pile sample
    → Gen 2 (this model, encoder, ~350M params)
      → processes full 177M-document Pile
        → millions of high-confidence labelled records
          → Gen 3 (decoder, native D/I/R reasoning, on MacBook M5 Max)
            → Gen 4 (dual-stream noun/verb with corpus callosum)
```

Gen 2 is a sensor upgrade. Gen 3 is the reasoning upgrade. Gen 2 must exist before Gen 3 is possible.

---

## 3. Architecture

### 3.1 Base Model

**Primary candidate:** ModernBERT-Large (395M params, 8,192 token context, Flash Attention 2, unpadding, alternating global/local attention)

**Alternate candidate:** jina-embeddings-v3 (570M params, 8,192 token context, task-specific LoRA adapters)

**Selection criteria:** ModernBERT-Large preferred for lower parameter count (fits 16GB VRAM with less pressure), native long-context without LoRA overhead, and Apache 2.0 licensing. Jina is fallback if ModernBERT shows training instability on ROCm.

Both are encoder-only transformers with bidirectional attention — the correct inductive bias for classification from full document context.

### 3.2 Dual-Head Multi-Task Learning (MTL)

```
Input text (up to 8,192 tokens)
        │
        ▼
┌──────────────────────┐
│  ModernBERT-Large     │
│  (frozen first N      │
│   epochs, then        │
│   unfrozen for        │
│   fine-tuning)        │
└──────────┬───────────┘
           │
      [CLS] token
      embedding
           │
     ┌─────┴─────┐
     ▼           ▼
┌─────────┐ ┌─────────┐
│ Head 1  │ │ Head 2  │
│ Regress │ │ Classif │
│ 768→256 │ │ 768→256 │
│ →6 (6D) │ │ →9 (CE) │
│ MSE loss│ │ XE loss │
└─────────┘ └─────────┘
     │           │
     ▼           ▼
  6D vector   Composition
  [D,I,R,     label (1/9)
   T,ρ,H]    + confidence
```

### 3.3 Loss Function

```
L_total = α · L_MSE(6D vector) + β · L_CrossEntropy(composition label)
```

- α = 1.0, β = 0.5 (initial — regression is primary, classification is auxiliary)
- Class weights applied to cross-entropy to compensate for label imbalance (R(D) at 6.06% vs D(D) at 19.11%)

**Monitoring protocol:**
- Log per-head loss and gradient norms every 100 steps
- Adjustment protocol:
  - If classification loss plateaus while regression loss decreases → increase β (try 1.0, then 1.5)
  - If regression loss plateaus while classification loss decreases → increase α (try 1.5, then 2.0)
  - If both plateau → learning rate issue, not loss weighting
- **Decision point:** Step 4 (small validation run) must produce per-head loss curves. Adam reviews curves before full training begins.
- Do NOT implement homoscedastic uncertainty weighting unless manual adjustment fails during Step 4. Keep it simple until forced otherwise.

### 3.4 Input/Output Specification

**Input:**
```json
{
  "text": "string (up to 8,192 tokens after tokenization)",
  "truncation": "right (preserve opening context)"
}
```

**Output:**
```json
{
  "vector": [0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
  "composition": "D(I)",
  "confidence": 0.87,
  "space": "ideal",
  "axis": "integrate",
  "cluster_id": 1
}
```

Output format is identical to current dir_classify response. Downstream tools (dir_energy, dir_transition, dir_compose) consume the vector unchanged.

---

## 4. Training Data

### 4.1 Source

- **File:** `01-Projects/dir-engine/output/training_data_dir_v1.jsonl`
- **Size:** 10.4 GB raw, 3.5 GB gzipped
- **Records:** 240,021
- **Labelled by:** Gen 1 lexical vectoriser (488 indicators)
- **Source corpus:** The Pile (EleutherAI), 16 component datasets

### 4.2 Composition Distribution

| Composition | Count | % | Mean Confidence |
|-------------|-------|---|-----------------|
| D(D) | 45,861 | 19.11% | 0.572 |
| I(I) | 42,937 | 17.89% | 0.530 |
| D(I) | 29,181 | 12.16% | 0.424 |
| R(I) | 23,575 | 9.82% | 0.680 |
| R(R) | 23,084 | 9.62% | 0.698 |
| I(D) | 22,008 | 9.17% | 0.471 |
| D(R) | 19,536 | 8.14% | 0.399 |
| I(R) | 19,288 | 8.04% | 0.380 |
| R(D) | 14,551 | 6.06% | 0.488 |

**Top-2 concentration:** 37.0% (D(D) + I(I)) — improved from 85.1% in original TAC/TDC scoring.

**Axis distribution:** Differentiate 39.4%, Integrate 35.1%, Recurse 25.5%.

### 4.3 Source Domain Distribution

| Source | Count | % |
|--------|-------|---|
| Pile-CC | 75,223 | 31.34% |
| PubMed Central | 63,903 | 26.62% |
| FreeLaw | 36,330 | 15.14% |
| ArXiv | 19,055 | 7.94% |
| Gutenberg (PG-19) | 16,411 | 6.84% |
| Wikipedia (en) | 6,701 | 2.79% |
| USPTO Backgrounds | 5,160 | 2.15% |
| HackerNews | 4,421 | 1.84% |
| PhilPapers | 4,288 | 1.79% |
| Ubuntu IRC | 2,987 | 1.24% |
| Github | 2,461 | 1.03% |
| StackExchange | 1,406 | 0.59% |
| EuroParl | 1,082 | 0.45% |
| Enron Emails | 390 | 0.16% |
| PubMed Abstracts | 163 | 0.07% |
| NIH ExPorter | 40 | 0.02% |

### 4.4 Known Biases and Limitations

1. **Label noise.** All labels come from the Gen 1 lexical vectoriser — the system this model is replacing. The model will learn the vectoriser's biases before it can transcend them. This is expected and acceptable for Gen 2; Gen 3 training data will come from Gen 2's higher-quality labels.

2. **Domain concentration.** Pile-CC + PubMed Central = 57.96% of records. The model may overfit to web text and biomedical prose patterns. Mitigation: domain-stratified validation split.

3. **R(I) and R(R) are temporal catch-basins.** Phase 1 basin signatures (Session 2026-04-08) showed R(I) loads on T=0.711 + I=0.673 with R near-zero, and R(R) loads on T=0.737 + D=0.642 with R near-zero. These basins capture temporal-dominant records, not genuine R-axis structure. The model will learn this artefact. Mitigation: monitor R(I)/R(R) predictions in validation — if they correlate with document length or temporal markers rather than recursive structure, flag for Gen 3 label correction.

4. **Confidence floor at 0.10.** Records below 0.10 confidence were excluded (22,947 skipped). The model will never see the hardest-to-classify examples. This creates a blind spot at the basin boundaries where the most structurally interesting transitions occur.

5. **Single-corpus provenance.** All records from The Pile. The T2 motif falsification condition (non-Pile corpus parity test) applies equally to this model — if Gen 2 classifications diverge significantly on non-Pile text, the model is Pile-specific, not structurally general.

---

## 5. Training Plan

### 5.1 Hardware

- **GPU:** AMD Radeon RX 6900 XT (16 GB VRAM)
- **Framework:** PyTorch 2.x with ROCm 6.x
- **System:** Polaris (proxmox host), ZFS storage
- **VRAM budget:** ~14 GB usable (reserve 2 GB for OS/overhead)

### 5.2 ROCm Environment Setup

```bash
# Verify ROCm sees the GPU
rocm-smi
# Verify PyTorch ROCm backend
python3 -c "import torch; print(torch.cuda.is_available()); print(torch.cuda.get_device_name(0))"
# Install transformers + ModernBERT dependencies
pip install transformers accelerate datasets

# HARD GATE: Verify Flash Attention 2 support on ROCm
python3 -c "from flash_attn import flash_attn_func; print('Flash Attention 2: OK')"
# If this fails: STOP. Do not proceed to training with 8K sequences.
# Fallback path: reduce max_seq_length to 2048 and enable gradient checkpointing.
# Without Flash Attention 2, the quadratic attention matrix at 8K tokens
# will consume 10-12GB VRAM at micro-batch 2, leaving no room for weights + optimizer.
```

### 5.3 Hyperparameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Base model | ModernBERT-Large (395M) | 8K context, fits VRAM |
| Max sequence length | 8,192 tokens | Match model's native context |
| Effective batch size | 32–64 | Via gradient accumulation |
| Micro-batch size | 2–4 | VRAM-constrained |
| Gradient accumulation steps | 8–16 | To reach effective batch size |
| Learning rate | 2e-5 (heads), 5e-6 (backbone) | Discriminative LR — heads learn faster |
| LR schedule | Linear warmup (5%) + cosine decay | Standard for fine-tuning |
| Epochs | 3–5 | Monitor validation loss for early stopping |
| Optimizer | AdamW (weight decay 0.01) | Standard |
| Mixed precision | FP16 (ROCm) | Required for 16GB VRAM |
| Gradient checkpointing | **Enabled (default)** | Required for 16GB VRAM with 8K sequences |
| Frozen backbone epochs | 1 | Train heads first, then unfreeze |
| Per-head loss logging | Every 100 steps | Detect gradient starvation before full training |
| Confidence weighting | Enabled — scale sample loss by Gen 1 confidence score | Higher-confidence labels contribute more; low-confidence soft-downweighted, not excluded |

### 5.4 Data Pipeline

```python
# Pseudocode
class DIRDataset(torch.utils.data.Dataset):
    """Parse JSONL, tokenize to 8K, extract 6D vector + composition label."""
    def __getitem__(self, idx):
        record = self.records[idx]
        text = record["text"]

        # Dynamic Sequence Truncation — R-axis artifact defense
        # Randomly truncate 20% of R(I)/R(R) documents to break length→R shortcut
        text = self.augment_r_axis(text, record["composition"])

        tokens = self.tokenizer(text, max_length=8192,
                                truncation=True, padding="max_length")
        vector = torch.tensor(record["vector"], dtype=torch.float32)  # 6D
        label = self.label_map[record["composition"]]  # 0-8
        confidence = record["confidence"]  # for confidence-weighted loss
        return tokens, vector, label, confidence

    @staticmethod
    def augment_r_axis(text, composition):
        """Force model to find R-signatures in semantic content, not sequence length."""
        if composition in ("R(I)", "R(R)") and random.random() < 0.20:
            tokens = tokenizer.encode(text)
            max_trunc = min(len(tokens), 4096)
            trunc_len = random.randint(512, max_trunc)
            text = tokenizer.decode(tokens[:trunc_len])
        return text
```

**Confidence-weighted loss implementation:**
```python
# Per-sample loss weighting by Gen 1 confidence
sample_weight = record["confidence"]  # 0.10 to 1.0
loss = sample_weight * (alpha * mse_loss + beta * ce_loss)
```

### 5.5 Validation Strategy

- **Split:** 80/10/10 train/val/test, stratified by composition AND source domain
- **Validation metrics:** MSE on 6D vector, accuracy + F1 on composition label, per-class breakdown
- **Early stopping:** Patience 3 epochs on validation loss
- **Checkpoint:** Save best model by validation loss, plus checkpoint every epoch

### 5.6 Training Time Estimate

- ~240K records × 3–5 epochs = 720K–1.2M forward/backward passes
- At ~2–4 samples/second (8K tokens, 395M params, FP16, RX 6900 XT): 3–5 days continuous
- tmux session for unattended training

---

## 6. Integration Plan

The trained model replaces the vectoriser inside the D/I/R engine MCP server. Same interface, same tools, different sensor.

### 6.1 Current Architecture

```
dir_classify(text) → lexical_vectorise(text, 488 indicators) → 6D vector → nearest basin → composition
```

### 6.2 Gen 2 Architecture

```
dir_classify(text) → model.forward(tokenize(text)) → Head 1: 6D vector, Head 2: composition + confidence
```

### 6.3 Integration Steps

1. **Export trained model** to ONNX or TorchScript for inference
2. **Create inference wrapper** that matches current vectoriser interface: `text → (vector, composition, confidence)`
3. **Swap vectoriser** in dir_classify — single function replacement
4. **dir_energy, dir_transition, dir_compose** remain unchanged — they consume the 6D vector
5. **dir_status** updated to report model version, parameter count, inference latency
6. **Fallback path:** Keep lexical vectoriser as `dir_classify(text, engine="lexical")` for comparison

### 6.4 Inference Requirements

- Model must load into GPU memory alongside other processes
- Inference latency target: <500ms per classification (current lexical: ~10ms)
- Batch inference mode for bulk processing (full Pile run)

---

## 7. Validation Criteria

### 7.1 Minimum Viable Performance

| Metric | Lexical Baseline | Gen 2 Target | Measurement |
|--------|-----------------|--------------|-------------|
| Composition accuracy | ~100% (tautological — labels come from this system) | ≥85% on held-out test set | 10% test split |
| Mean confidence | 0.5255 | ≥0.70 | Across test set |
| Zero-vector rate | ~8% (temporal-only + unclassified) | <1% | On same input distribution |
| Cross-domain consistency | Not measured | Same text, different phrasing → same composition | Manual test battery |
| Per-class F1 | N/A | ≥0.75 for all 9 classes | Weighted by class frequency |

**Gap protocol (80-85% accuracy):** Model is not failed but not accepted. Review per-class breakdown and per-domain breakdown. If accuracy is ≥85% on 7+ of 9 classes with 1-2 classes dragging the average (likely R(I)/R(R)), proceed with deployment and flag those classes for Gen 3 label correction. If accuracy is uniformly ~82% across all classes, retrain with adjusted hyperparameters (learning rate, loss weighting, epochs) before declaring success.

### 7.2 Structural Validation

- **Basin coherence:** Gen 2 vectors for known D(R) texts should cluster in D(R) basin when passed through dir_energy
- **Transition consistency:** Gen 2 vectors should produce similar transition predictions as Gen 1 vectors for the same text
- **Motif discovery replay:** Re-run the Phase 1-3 motif discovery pipeline with Gen 2 classifications. SCGS and CDRI should still emerge as T2 candidates. If they don't, the model has lost structural signal.

### 7.3 Generalisation Test

- Classify non-Pile text (e.g., recent arXiv papers, blog posts, code documentation)
- Compare composition distributions against Pile-trained expectations
- Flag if R(I)/R(R) predictions correlate with document length rather than recursive structure

---

## 8. Bootstrap Loop

### 8.1 Gen 2 → Full Pile Processing

Once validated, Gen 2 processes the full Pile (177M documents, ~825 GB):

- Batch inference on GPU, ~2-4 docs/second = ~45-90M docs/month
- Output: JSONL with 6D vectors + composition labels + confidence scores
- Filter: Only retain records with confidence ≥0.60 (estimated 60-70% pass rate)
- Expected yield: 100-120M high-confidence labelled records

### 8.2 Gen 3 Training Data

Gen 2 output becomes Gen 3 training data:

- **Volume:** 100-120M records (500x more than Gen 2 training data)
- **Quality:** Higher confidence, semantic rather than lexical labels
- **Diversity:** Full Pile coverage vs. 240K sample
- **Architecture:** Gen 3 is a decoder model (autoregressive) — it doesn't just classify, it reasons in D/I/R space
- **Hardware:** MacBook M5 Max (anticipated purchase) — MLX framework, 128GB unified memory

### 8.3 Gen 4 Vision

Gen 4 introduces dual-stream architecture:

- Noun stream: entity/concept extraction (what things are)
- Verb stream: relation/action extraction (what things do)
- Corpus callosum: convergence layer that merges noun and verb streams into unified D/I/R representation
- This mirrors the observer-native two-speed model at the architectural level

### 8.4 Application: Trading System Integration

Gen 2 encoder enables real-time classification of market narrative:

- News articles, social media, analyst commentary → D/I/R composition
- Same K=9 Langevin landscape the trading system already uses
- Multimodal convergence: price action topology + narrative topology
- Requires Gen 2 inference at <500ms for real-time feed processing

---

## 9. D/I/R Engine Assessment

The engine was used to classify and assess its own replacement. Results below.

### 9.1 Architecture Classification

**Input:** "An encoder-only transformer that reads text bidirectionally and outputs a continuous 6D coordinate vector and a discrete 9-class composition label through dual parallel output heads trained simultaneously with combined MSE and cross-entropy loss"

| Field | Value |
|-------|-------|
| Composition | **R(I)** |
| Confidence | 0.362 |
| Vector | [0, 0.688, 0, 0.545, 0.480, 0] |
| Axis | integrate |

The engine sees the architecture as **recursive integration** — a system integrating multiple outputs (regression + classification) through a recursive structure (transformer attention). Moderate confidence; the lexical vectoriser partially recognises the pattern but can't fully resolve it.

### 9.2 Replacement Rationale Classification

**Input:** "Replacing a brittle keyword-matching lexical vectoriser with a deep semantic encoder that learns structural patterns from 240,000 labelled text records to produce the same 6D vector output but with genuine semantic understanding instead of indicator word counting"

| Field | Value |
|-------|-------|
| Composition | **R(D)** |
| Confidence | **0.00** |
| Vector | **[0, 0, 0, 0, 0, 0]** |

**Zero confidence. Zero vector.** The engine cannot classify the rationale for its own replacement. This mirrors the artefact question (Tension 4) in the motif discovery process — questions about the framework's own validity return no signal. The engine says: don't justify the replacement; just build it.

### 9.3 Full Project Classification

**Input:** "Build a neural encoder model that replaces lexical heuristics with learned semantic representations, producing continuous 6D vectors and discrete 9-class labels, trained on 240,000 engine-labelled records, deployed as a drop-in replacement inside the existing MCP server to enable processing the full 177 million document Pile corpus and bootstrapping the next generation model"

| Field | Value |
|-------|-------|
| Composition | **R(R)** |
| Confidence | 0.263 |
| Vector | [0.753, 0, 0, 0.502, 0.424, 0] |

The engine sees the full project as **recursive on recursive** — the framework rebuilding itself. D-axis dominant in the vector despite R(R) classification, with temporal and density loading. Low confidence — the lexical vectoriser struggles with meta-level descriptions of itself.

### 9.4 Energy Landscape Assessment

**Architecture vector (R(I) basin):**

| Metric | Value |
|--------|-------|
| Energy | -0.028 |
| Basin depth | 6.80 |
| Distance to centre | 0.465 |
| Barrier to second | 0.009 |
| Transition score | **0.999** |

Deep basin (6.80) but **paper-thin barriers** (0.009) and **maximum transition score** (0.999). The architecture is in a deep well with no walls — same structural signature as D(D) in the motif discovery process. Valid starting position, not a resting position. The gradient demands +0.624 density — make it denser, more concrete.

**Full project vector (R(R) basin):**

| Metric | Value |
|--------|-------|
| Energy | -0.0001 |
| Basin depth | 6.39 |
| Barrier to second | 0.00003 |
| Transition score | **~1.0** |

Even more unstable. Nearly zero barrier. The engine wants this to transition immediately.

### 9.5 Transition Predictions

**From architecture (R(I)):**

| Predicted Next | Barrier |
|---------------|---------|
| I(I) | 0.009 (lowest) |
| D(I) | 0.019 |
| D(R) | 0.024 |

The engine predicts the architecture transitions to **I(I) — pure integration** (implementation). Lowest barrier. This is the natural next step: stop describing the architecture, start building it.

**From full project (R(R)):**

| Predicted Next | Barrier |
|---------------|---------|
| **D(R)** | **-0.007 (downhill)** |
| R(I) | -0.001 (downhill) |
| I(R) | 0.00003 |

Two downhill transitions. **D(R) is the strongest attractor** — the same basin that dominated the motif discovery process. The engine says: describe what this model recommends, don't recurse on the meta-architecture.

**From bootstrap loop (D(D)):**

| Predicted Next | Barrier |
|---------------|---------|
| D(I) | ~0 (downhill) |
| I(D) | ~0 (downhill) |
| R(D) | 0 |

D(D) immediately exits — all barriers zero or negative. The bootstrap loop description is a starting position. Every direction is equally accessible. The first concrete action will determine the basin.

### 9.6 Engine Assessment Summary

1. **The architecture is structurally valid but maximally unstable as a concept.** It needs to transition from description (R(I)/R(R)) to implementation (I(I)). The engine is saying: stop planning, start building.

2. **The engine cannot classify the rationale for its own replacement** (zero vector). This is consistent — the same zero-signal pattern appeared when asking whether basin-motif mappings are artefacts. Meta-questions about the framework's validity are ill-posed within the framework.

3. **D(R) is the persistent attractor.** From every framing of this project, the engine predicts transition toward D(R) — describe the recommendations. This means: the PRD itself is the correct D(R) artifact. Once written, transition to I(I) (implementation).

4. **The bootstrap loop has zero barriers in every direction.** This is neither good nor bad — it means the first implementation step will determine the trajectory. The plan is unconstrained by the current energy landscape.

---

## 10. Risks and Mitigations

### 10.1 ROCm Stability

**Risk:** ROCm + PyTorch on RX 6900 XT has known stability issues — kernel crashes, memory leaks, incomplete operator support for some transformer operations. Flash Attention 2 may not be available on gfx1030, which makes 8K sequences infeasible.

**Mitigation:**
- Verify environment before training (rocm-smi, PyTorch CUDA test)
- **Flash Attention 2 is a hard gate** — if unavailable on ROCm/gfx1030: reduce max sequence length to 2,048 tokens (still covers majority of records) and enable gradient checkpointing. This is the primary fallback, not CPU training.
- Use conservative settings: FP16 (not BF16, which has spotty gfx1030 support)
- Small validation run (1K records) before committing to full training
- Checkpoint every epoch to survive crashes
- Last-resort fallback: CPU training (dramatically slower, ~30 days, but viable)

### 10.2 VRAM Constraints

**Risk:** ModernBERT-Large (395M params) + 8K token sequences + gradient accumulation may exceed 16 GB.

**Mitigation:**
- Micro-batch size 2 with gradient accumulation 16 = effective batch 32
- FP16 throughout
- Gradient checkpointing if needed (trades compute for memory)
- Reduce max sequence length to 4,096 if OOM persists (covers 90%+ of records)
- Monitor with `rocm-smi --showmeminfo` during training

### 10.3 Label Noise from Gen 1

**Risk:** Training on Gen 1 lexical labels means the model learns Gen 1's mistakes. Garbage in, garbage out.

**Mitigation:**
- This is expected and acceptable for Gen 2. The bootstrap loop is specifically designed to iteratively improve label quality.
- Confidence-weighted loss: higher-confidence Gen 1 labels get more weight
- The structural patterns in the training data are real even if individual labels are noisy — the model should learn the distribution, not memorise labels
- Gen 3 will be trained on Gen 2 output, further denoising

### 10.4 Overfitting on Pile-Specific Patterns

**Risk:** Model learns Pile-specific vocabulary, formatting, and style rather than structural D/I/R patterns. Works on Pile text, fails on everything else.

**Mitigation:**
- Domain-stratified validation: ensure all 16 Pile components are in every split
- Post-training generalisation test on non-Pile text
- The T2 motif falsification condition (non-Pile corpus parity) applies to the model
- If Gen 2 classifications diverge >15% on non-Pile text, the model is Pile-specific and needs augmentation

### 10.5 R(I)/R(R) Temporal Catch-Basin Artefact

**Risk:** Phase 1 basin signatures showed R(I) and R(R) load on temporal axis, not R-axis. ModernBERT with positional embeddings will learn a trivial shortcut: long document → R(I)/R(R). The model will achieve high accuracy on these classes by reading document length, not semantic recursion.

**Mitigation:**
- **Active defense:** Dynamic Sequence Truncation during training — randomly truncate 20% of R-classified long documents to force semantic R-signature learning instead of positional shortcut (see Section 5.4).
- **Validation check:** Pearson correlation between document token count and R(I)/R(R) classification probability. Target: < 0.3 (falsification threshold remains 0.5 per Section 12.4).
- **Attention analysis:** Post-training, inspect attention weights on R-classified documents. If attention concentrates on positional tokens rather than content tokens, the defense has failed.
- Gen 3 label correction: use Gen 2 as feature extractor, retrain classification head with corrected R(I)/R(R) labels

### 10.6 Training Interruption

**Risk:** 3-5 day continuous training on a home server. Power outage, system update, OOM kill, ZFS scrub.

**Mitigation:**
- Checkpoint every epoch
- tmux session with logging
- Disable automatic updates during training window
- ZFS scrub schedule checked/deferred

---

## 11. Timeline

| Step | Duration | Description |
|------|----------|-------------|
| 1. ROCm validation | 1 hour | Verify GPU visible, PyTorch functional, memory budget, **Flash Attention 2 hard gate** (pass/fail) |
| 2. Dataset class | 2-3 hours | JSONL parser, tokenizer, stratified splits, DataLoader |
| 3. Model architecture | 2-3 hours | ModernBERT + dual heads, loss function, training loop |
| 4. Small validation run | 2-4 hours | 1K records, 1 epoch, confirm no OOM, loss decreasing |
| 5. Full training | 3-5 days | 240K records, 3-5 epochs, unattended in tmux |
| 6. Evaluation | 2-3 hours | Test set metrics, per-class breakdown, generalisation test |
| 7. Integration | 3-4 hours | Export model, swap vectoriser, update dir_status |
| 8. Structural validation | 2-3 hours | Motif discovery replay, basin coherence, transition consistency |
| **Total** | **4-6 days** | Dominated by Step 5 training time |

Steps 1-4 can be completed in a single session. Step 5 runs unattended. Steps 6-8 in a follow-up session.

---

## 12. Falsification Conditions

The model has failed if any of the following are true after training:

1. **Worse than lexical baseline.** Composition accuracy on held-out test set is below 80%. (The lexical vectoriser is tautologically 100% on its own output, but 80% learned accuracy on the same distribution means the model has learned the structure, not just memorised.)

2. **Domain-specific rather than structural.** Classification accuracy varies >20% between Pile source domains (e.g., 95% on PubMed but 60% on HackerNews). This means the model learned domain vocabulary, not D/I/R structure.

3. **Confidence collapse.** Mean confidence is below 0.50 (worse than Gen 1's 0.5255). The model should be more confident, not less.

4. **R(I)/R(R) length correlation.** Pearson correlation between document token count and R(I)/R(R) classification probability exceeds 0.5. This means the temporal catch-basin artefact has been learned rather than structural R-axis patterns.

5. **Motif discovery failure.** Re-running Phase 1-3 motif discovery with Gen 2 classifications fails to reproduce SCGS and CDRI as T2 promotion candidates. The model has lost the structural signal that the lexical vectoriser captured.

6. **Non-Pile divergence.** Classification distribution on non-Pile text diverges >15% (Jensen-Shannon divergence) from Pile distribution. The model is corpus-specific, not structurally general.

7. **Zero-vector persistence.** The model produces zero or near-zero vectors (L2 norm < 0.01) for >1% of inputs. The whole point is eliminating the zero-vector failure mode.

If conditions 1, 2, or 5 are met: **model has failed, do not deploy.** Diagnose and retrain or reconsider architecture.

If conditions 3, 4, 6, or 7 are met: **model is degraded, investigate before deployment.** May be salvageable with targeted fine-tuning or label correction.

---

## Appendix A: Record Format

Each training record in `training_data_dir_v1.jsonl`:

```json
{
  "text": "...",
  "vector": [0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
  "composition": "D(I)",
  "confidence": 0.42,
  "source": "PubMed Central",
  "motif": "RB",
  "axis": "differentiate"
}
```

## Appendix B: Engine Tool Versions

| Tool | Version | Notes |
|------|---------|-------|
| dir_classify | centroid v20260408-v3-weighted-merged-vocab | 488 indicators, 9 compositions |
| dir_energy | Langevin multi-well, 9 basins | Unchanged by Gen 2 |
| dir_transition | Adjacent-basin barrier model | Unchanged by Gen 2 |
| dir_compose | Algebraic composition | Unchanged by Gen 2 |

Engine assessment conducted 2026-04-09 via MCP tools on active engine instance (uptime 1,119s at query time).
