---
meta_version: 1
kind: plan
status: draft
authority: medium
domain: [dir-engine, observer-native, dataset-processor]
source: atlas_write
confidence: provisional
mode: build
created: 2026-04-03T12:00:00+11:00
modified: 2026-04-03T14:00:00+11:00
iteration: 0
maxIterations: 128
loopStatus: null
last_phase: DRAFT
failing_criteria: []
verification_summary: "0/55"
cssclasses: [status-draft]
motifs: [dir-structural-engine, mcp-server, composition-algebra, classification]
refs:
  - 01-Projects/observer-native/strategic-plan-bootstrap-to-sovereignty.md
  - 02-Knowledge/architecture/motif-algebra-v1.0-spec.md
  - 01-Projects/control-plane/architecture/control-plane-prd.md
  - 01-Projects/ocp-scraper/src/mcp/server.ts
  - 01-Projects/dataset-processor/scripts/dir-vectorize-cluster.py
  - 01-Projects/dataset-processor/scripts/backfill-compositions.py
  - 00-Inbox/qho-falsification-langevin-reframing-20260403-DRAFT.md
---

# D/I/R Structural Engine — MCP Server

> A model-agnostic inference engine that exposes D/I/R structural operations (classification, composition algebra, motif evaluation) as MCP tools, consuming pre-computed artifacts from the dataset processor pipeline.

---

## STATUS

| What | State |
|------|-------|
| Progress | 0/48 criteria passing |
| Phase | DRAFT |
| Next action | Begin S0 build (types + data loading + export scripts) |
| Blocked by | Nothing (core classifier has no dependencies; centroid data exists from Task 2) |

---

## 1. CONTEXT

### 1.1 Problem Space

The D/I/R algebra (v1.0 spec) defines classification, composition, and evaluation operations over structural patterns. These operations currently exist only as:

- Python scripts in `dataset-processor/scripts/` (batch pipeline, not callable)
- TypeScript type definitions in `observer-native/src/s3/algebra/` (types only, no runtime)
- Prose in the v1.0 spec (theory, not implemented)

No runtime service exists that downstream consumers can call. The trading system, wave equation tests, CLI backends, and Phase 2 model integration all need structural classification — and they need it through a shared protocol (MCP), not by importing Python modules or duplicating logic.

### 1.2 Strategic Position

This is **Task 3 on the critical path** (strategic plan). Everything downstream depends on it:

- **Task 5** (wave equation falsification) needs `dir_energy` and `dir_evaluate`
- **Task 8** (trading system) needs `dir_classify` for composition assignment
- **Phase 2** model integration — this engine IS the structural layer between base model and output
- **All four CLI backends** consume it via MCP

From the strategic plan: *"The one thing that matters most in Phase 1: Task 3 — the D/I/R structural engine as an MCP server. Everything else feeds it or depends on it."*

### 1.3 Key Files

| File | Role |
|------|------|
| `02-Knowledge/architecture/motif-algebra-v1.0-spec.md` | Theory: operators, compositions, stability, predicates |
| `01-Projects/dataset-processor/scripts/dir-vectorize-cluster.py` | Source: 6D vectorizer, indicator vocabulary, K-means clustering |
| `01-Projects/dataset-processor/scripts/backfill-compositions.py` | Source: cluster→composition mapping, centroid fitting |
| `01-Projects/ocp-scraper/src/mcp/server.ts` | Pattern: MCP server implementation (Bun + stdio) |
| `01-Projects/observer-native/src/s3/algebra/` | Types: CompositionExpression, MotifRecord (partial) |
| `02-Knowledge/motifs/` | Data: 35 motifs, 9 at Tier 2, 5 Tier 3 drafts |

### 1.4 Constraints

- **TypeScript + `@modelcontextprotocol/sdk`** — consistent with control plane and OCP scraper
- **Bun runtime** — direct TS execution, no build step (OCP scraper pattern)
- **Read-only** — engine reads shard databases and artifact files but NEVER writes to them
- **Energy tool gated** — ships as a stub returning `{ gated: true, reason: "..." }` until multi-well basin depth metric is confirmed computationally (see Section 2.7). QHO wave equation was falsified (≤2/5 tests); replaced by Langevin/multi-well model (5/5 tests). See `00-Inbox/qho-falsification-langevin-reframing-20260403-DRAFT.md`
- **Localhost stdio only** — no HTTP exposure, no network binding
- **No clustering at runtime** — the engine is an inference service, not a training pipeline. Centroid computation stays in the Python pipeline.

### 1.5 Decisions Made

| Decision | Rationale |
|----------|-----------|
| 5 tools, not 4 or 6 | Classify + Compose + Evaluate cover all inference needs. Status for observability. Energy gated for future. Cluster excluded — it's training, not inference. |
| Port 6D vectorizer, not 14D | 6D keyword vector is sufficient for production classification. 14D enrichment is for research (testing whether structural features improve clustering). |
| Centroid manifest as JSON artifact | Decouples engine from Python pipeline. Centroids exported as JSON, engine loads at startup. No hot-reload in v1. |
| `dir_*` tool namespace | Consistent with `ocp_*` (scraper) and `observer_*` (control plane) conventions. |
| Single server.ts + module files | MCP server is thin wrapper. Classification/composition/evaluation logic in separate modules for testability. |

---

## 2. ARCHITECTURE

### 2.1 Tool Surface

| Tool | Input | Output | Statefulness |
|------|-------|--------|-------------|
| `dir_classify` | `{ text?: string, vector?: number[6], space?: "ideal" \| "applied" \| "auto" }` (exactly one of text/vector required) | `{ vector: number[6], composition: string, confidence: number, space: string, axis: string, cluster_id: number }` | Reads centroids + vocabulary |
| `dir_compose` | `{ a: string, b: string, operation?: "apply" \| "commutator" \| "inverse" }` | `{ result: string, order: number, stable: boolean, volume: number, notes: string[] }` | Pure algebra (stateless) |
| `dir_evaluate` | `{ text?: string, composition?: string, motif_id?: string, thresholds?: { c?: number, i?: number, d?: number } }` | `{ predicates: { c: result, i: result, d: result, p?: result }, volume: number, stable: boolean, non_degenerate: boolean }` | Reads motif library |
| `dir_status` | `{}` | `{ centroids_loaded: boolean, centroid_version: string, vocabulary_size: number, compositions_covered: number, motifs_loaded: number, uptime_s: number }` | All artifacts |
| `dir_energy` | `{ text?: string, composition?: string }` | `{ gated: true, reason: "Awaiting multi-well basin depth computation (Langevin model v1.1)" }` | **Gated stub** (see 2.7) |

### 2.2 Data Artifacts

The engine loads four artifact types from a well-known data directory (`data/` relative to project root):

| Artifact | File | Format | Source | Update Trigger |
|----------|------|--------|--------|---------------|
| Centroid manifest | `data/centroids.json` | `{ version: string, k: 9, dim: 6, centroids: number[9][6], mapping: Record<number, string> }` | `backfill-compositions.py` exports | K-means rerun |
| Indicator vocabulary | `data/vocabulary.json` | `{ version: string, indicators: { term: string, weight: number, axis: 0\|1\|2 }[] }` | Extracted from `dir-vectorize-cluster.py` | Theory change |
| Motif library | `data/motifs.json` | `{ motifs: { id: string, name: string, composition: string, tier: number, domains: string[], indicators: string[] }[] }` | Snapshot of `02-Knowledge/motifs/` | Motif promotion |
| Composition rules | Compiled in code | TypeScript algebra module | `motif-algebra-v1.0-spec.md` Section 2 | Spec revision |

**Export scripts** (deliverable, not engine code): small Python/TS scripts that export centroid manifest and vocabulary from existing pipeline artifacts into the `data/` directory.

### 2.3 Vectorization Pipeline (ported from Python)

```
Input text (max 8000 chars)
    │
    ├─ For each indicator in vocabulary:
    │    match regex against text
    │    score[axis] += log(1 + count) * weight
    │
    ├─ Temporal complexity: log(1 + temporal_marker_count)
    │
    ├─ Density: total_indicator_weight / (text_length / 1000)
    │
    ├─ Entropy: -sum(p_i * log2(p_i)) over D/I/R proportions
    │
    └─ Output: [D, I, R, temporal, density, entropy]  (6D, L2-normalized)
```

### 2.4 Classification Pipeline

```
Input: text OR pre-computed vector (exactly one required)
    │
    ├─ If text: vectorize(text, vocab) → 6D vector
    ├─ If vector: validate length == 6, use directly
    │
    ├─ L2 normalize
    │
    ├─ Compute cosine distance to each of 9 centroids
    │
    ├─ Nearest centroid → cluster_id → composition (via mapping)
    │
    ├─ Confidence: 1 - (nearest_distance / second_nearest_distance)
    │
    ├─ Space classification:
    │    if text provided and substrate_indicators detected → "applied"
    │    if vector provided (no text) → space from caller or "ideal" default
    │    (or caller specifies space explicitly)
    │
    └─ Axis: argmax(D, I, R) → "differentiate" | "integrate" | "recurse"
```

**Note on vector input path (Q1 resolution):** The trading system (Task 8) computes D/I/R vectors directly from price data (D=volatility structure, I=mean-reversion/correlation, R=autocorrelation/Hurst). It will never pass text. Without the vector input path, Task 8 cannot use the engine. This is critical-path required.

### 2.7 Energy Tool — Langevin Multi-Well Model

**Background (3 April 2026):** The original QHO wave equation (iτ ∂Ψ/∂t = (−d∇² + k|x|²)Ψ) was tested against 5 pre-committed falsification criteria and scored ≤2/5. The specific failure was the binding potential I→k|x|² (quadratic confinement to a single balanced centre). The empirical data shows 9 asymmetric basins with the centre as a saddle point, not a minimum. See: `00-Inbox/qho-falsification-langevin-reframing-20260403-DRAFT.md`.

A replacement model — the **Langevin/multi-well dissipative landscape** — was validated by triad convergence (Claude Opus, Gemini ×2) at ~95% agreement, scoring 5/5 under reframed predictions.

**The replacement equation:**
```
∂x/∂t = −∇E(x) + √(2T)η(t)
```

Where E(x) is a non-linear multi-well energy landscape with 9 empirically-measured global minima (the K=9 centroids), T is temperature/noise, η(t) is stochastic noise. D maps to noise/scattering, I maps to gradient pull (−∇E), R maps to temporal update (∂x/∂t).

**Revised ungating criteria for `dir_energy`:** Multi-well basin depth metric computed from empirical centroids correlates with tier stability. Structural evidence supports this (domain count and confidence increase monotonically with tier). Full computational test is runnable once the engine is built.

**When ungated, `dir_energy` should compute:**
1. Distance to nearest centroid (how deep in a basin the input sits)
2. Basin depth of the nearest centroid (Aᵢ from the energy function, derivable from domain count/confidence of corresponding Tier 2 motif)
3. Barrier height to second-nearest basin (classification confidence reframed as energy)

`dir_energy` ships as a gated stub in v1. Ungating is a v1.1 milestone once the engine can compute centroid distances on real records and the basin-depth-to-tier correlation is confirmed computationally.

### 2.5 Composition Algebra

Implements Section 2 of the v1.0 spec:

**Operations:**
- `apply(X, Y) → X(Y)` — first-order composition
- `apply(X, Y(Z)) → X(Y(Z))` — higher-order composition
- `commutator(X, Y) → [X,Y] = X(Y) - Y(X)` — returns the pair and their difference
- `inverse(X(Y)) → X(Y)⁻¹` — reversal cost annotation

**Stability checks per composition:**
- Non-zero volume: `axis_D * axis_I * axis_R > 0`
- Non-degeneracy: `X(Y) ≇ X` and `X(Y) ≇ Y`
- Known compositions checked against the 3x3 grid + second-order table

### 2.6 Evaluation Pipeline

**Predicate c (cross-domain validation):**
- Count distinct domains in which the candidate pattern appears
- Pass if domains >= threshold (default: 3)
- Uses motif library domain data

**Predicate i (structural invariance):**
- Measure consistency of core pattern across instances
- Approximated via Jaccard similarity of indicator sets across domain occurrences
- Pass if similarity >= threshold (default: 0.6)

**Predicate d (non-derivability):**
- Compare candidate's indicator profile against existing library entries
- Pass if no existing motif has Jaccard similarity > threshold (default: 0.8)

**Predicate p (substrate signature, optional):**
- Check whether applied motif demonstrates substrate effects absent in ideal parent
- Only evaluated when `space == "applied"`

**Volume check:**
- Compute `D * I * R` from the candidate's 6D vector
- Non-zero volume required for stability

---

## 3. BUILD SLICES

### S0: Core Types & Data Loading

**Package:** `src/types/` + `src/data/`
**Dependencies:** None
**Build group:** Foundation (must build first)

**What to build:**
- `src/types/index.ts` — Core type definitions:
  - `Vector6D` — `[number, number, number, number, number, number]`
  - `CompositionExpression` — notation, outer, inner, order, isApplied (port from spec)
  - `ClassificationResult` — vector, composition, confidence, space, axis, cluster_id
  - `CompositionResult` — result, order, stable, volume, notes
  - `EvaluationResult` — predicates, volume, stable, non_degenerate
  - `EngineStatus` — centroids_loaded, versions, counts, uptime
  - `PredicateResult` — `{ pass: boolean, score: number, threshold: number, detail: string }`
- `src/data/loader.ts` — Artifact loading functions:
  - `loadCentroids(path) → CentroidManifest`
    - Validates that all 9 compositions are present in the mapping; logs warning for missing compositions but does NOT refuse to start (partial manifest is better than no engine)
  - `loadVocabulary(path) → IndicatorVocabulary`
  - `loadMotifs(path) → MotifLibrary`
  - Validation via Zod schemas on load (fail fast on malformed artifacts)
- `src/data/schemas.ts` — Zod schemas for all three JSON artifact types

- `scripts/export-artifacts.ts` — Artifact export script (bridge between Python pipeline and engine runtime):
  - Export centroids from K-means pipeline state → `data/centroids.json` in manifest format
  - Export indicator vocabulary from `dir-vectorize-cluster.py` constants → `data/vocabulary.json`
  - Export motif library snapshot from `02-Knowledge/motifs/` → `data/motifs.json`
  - This is the first thing that must work before any slice can integration-test with real data

**What NOT to build:**
- No file watching or hot-reload

**ISC Exit Criteria:**

- [ ] **ISC-S01:** Vector6D type exported and usable in downstream modules | Verify: Test: `import { Vector6D } from './types'`
- [ ] **ISC-S02:** CompositionExpression type matches v1.0 spec Section 8.1 fields | Verify: Read: compare with spec
- [ ] **ISC-S03:** CentroidManifest Zod schema validates sample centroids.json | Verify: Test: schema.parse(sample)
- [ ] **ISC-S04:** IndicatorVocabulary Zod schema validates sample vocabulary.json | Verify: Test: schema.parse(sample)
- [ ] **ISC-S05:** MotifLibrary Zod schema validates sample motifs.json | Verify: Test: schema.parse(sample)
- [ ] **ISC-S06:** loadCentroids returns typed manifest or throws on invalid data | Verify: Test: load valid + invalid
- [ ] **ISC-S07:** loadVocabulary returns typed vocabulary or throws on invalid data | Verify: Test: load valid + invalid
- [ ] **ISC-S08:** loadMotifs returns typed library or throws on invalid data | Verify: Test: load valid + invalid
- [ ] **ISC-S09:** loadCentroids warns when mapping has < 9 compositions but still loads | Verify: Test: partial mapping → warning logged, manifest returned
- [ ] **ISC-S0A:** export-artifacts exports centroids.json in valid manifest format | Verify: CLI: `bun scripts/export-artifacts.ts && bun -e "import('./src/data/schemas').then(s => s.CentroidManifestSchema.parse(JSON.parse(require('fs').readFileSync('data/centroids.json','utf8'))))"`
- [ ] **ISC-S0B:** export-artifacts exports vocabulary.json in valid vocabulary format | Verify: CLI: export + schema validation
- [ ] **ISC-S0C:** export-artifacts exports motifs.json with indicator sets per motif | Verify: CLI: export + check motifs[0].indicators.length > 0

**Security:**
- All file paths resolved relative to project root, never user-supplied
- Zod validation on load prevents malformed data from reaching runtime

---

### S1: Vectorizer

**Package:** `src/vectorizer/`
**Dependencies:** S0 (Vector6D, IndicatorVocabulary)
**Build group:** Parallel Group 1

**What to build:**
- `src/vectorizer/index.ts` — Main vectorization function:
  - `vectorize(text: string, vocab: IndicatorVocabulary): Vector6D`
  - Regex compilation for each indicator (compiled once at load, reused per call)
  - Log-weighted scoring: `score[axis] += log(1 + count) * weight`
  - Temporal marker counting (sequential, concurrent, cyclic, recursive)
  - Density: `total_weight / (text.length / 1000)`
  - Entropy: Shannon entropy over D/I/R proportions
  - L2 normalization of output vector
  - Text truncation at 8000 chars (consistent with Python)
- `src/vectorizer/temporal.ts` — Temporal marker definitions:
  - Four marker sets: sequential, concurrent, cyclic, recursive
  - Exported as const arrays for testability

**What NOT to build:**
- No 14D enriched vectorization (research only, stays in Python)
- No Tier B scoring (pipeline concern, not engine concern)
- No text preprocessing beyond truncation (the Python pipeline doesn't preprocess either)

**ISC Exit Criteria:**

- [ ] **ISC-S11:** vectorize() returns a 6-element number array | Verify: Test: typeof + length check
- [ ] **ISC-S12:** Output vector is L2-normalized (magnitude within 0.999-1.001) | Verify: Test: compute magnitude
- [ ] **ISC-S13:** D-dominant text scores highest on index 0 | Verify: Test: "state machine boundary explicit" → vector[0] > vector[1] and vector[0] > vector[2]
- [ ] **ISC-S14:** I-dominant text scores highest on index 1 | Verify: Test: "dual-speed governance integration" → vector[1] > vector[0]
- [ ] **ISC-S15:** R-dominant text scores highest on index 2 | Verify: Test: "recursive feedback loop self-reference" → vector[2] > vector[0]
- [ ] **ISC-S16:** Empty string returns zero vector [0,0,0,0,0,0] | Verify: Test: vectorize("", vocab)
- [ ] **ISC-S17:** Text longer than 8000 chars is truncated before processing | Verify: Test: long string produces same result as truncated version
- [ ] **ISC-S18:** Indicator regex patterns compile without error for full vocabulary | Verify: Test: load vocabulary.json, compile all patterns

---

### S2: Classifier

**Package:** `src/classifier/`
**Dependencies:** S0 (types, CentroidManifest), S1 (vectorize)
**Build group:** Parallel Group 1 (S1 dependency is interface-only; can build against type contract)

**What to build:**
- `src/classifier/index.ts` — Classification function:
  - `classify(input: { text?: string, vector?: number[], space?: "ideal" | "applied" | "auto" }): ClassificationResult`
  - Exactly one of text/vector required; throws if both or neither provided
  - If text: calls vectorize() to get 6D vector
  - If vector: validates length == 6, uses directly (skips vectorization)
  - Computes cosine distance to each centroid
  - Selects nearest centroid → cluster_id → composition via mapping
  - Confidence: `1 - (nearest_distance / second_nearest_distance)`
  - Space detection: scan text for substrate indicators (noise, drift, decay, lag, etc.)
  - Axis: argmax of D, I, R components
- `src/classifier/distance.ts` — Distance functions:
  - `cosineDistance(a: Vector6D, b: Vector6D): number`
  - `nearestCentroid(vector: Vector6D, centroids: Vector6D[]): { index: number, distance: number }`
- `src/classifier/substrate.ts` — Substrate indicator detection:
  - Hard-coded substrate keyword list from v1.0 spec Section 8.3
  - `detectSubstrate(text: string): { detected: boolean, indicators: string[] }`

**What NOT to build:**
- No batch classification (callers iterate, engine classifies one at a time)
- No shard database access (caller extracts text, passes to classify)

**ISC Exit Criteria:**

- [ ] **ISC-S21:** classify() returns all ClassificationResult fields | Verify: Test: check all fields present
- [ ] **ISC-S22:** Composition is one of 9 valid first-order compositions or "unknown" | Verify: Test: result.composition ∈ valid set
- [ ] **ISC-S23:** Confidence is in [0, 1] range | Verify: Test: 0 <= result.confidence <= 1
- [ ] **ISC-S24:** cosineDistance of identical vectors returns 0 | Verify: Test: cosineDistance(v, v) === 0
- [ ] **ISC-S25:** cosineDistance of orthogonal vectors returns 1 | Verify: Test: cosineDistance([1,0,...], [0,1,...]) === 1
- [ ] **ISC-S26:** Text with substrate keywords classified as "applied" when space="auto" | Verify: Test: "noise drift decay" → space === "applied"
- [ ] **ISC-S27:** Explicit space parameter overrides auto-detection | Verify: Test: space="ideal" with substrate text → space === "ideal"
- [ ] **ISC-S28:** classify() with 9 centroids assigns to nearest cluster correctly | Verify: Test: synthetic vector equidistant to known centroid
- [ ] **ISC-S29:** classify({ vector: [6] }) skips vectorization and classifies directly | Verify: Test: pre-computed vector returns valid ClassificationResult
- [ ] **ISC-S2A:** classify({ text, vector }) throws when both provided | Verify: Test: dual-input rejection
- [ ] **ISC-S2B:** classify({}) throws when neither text nor vector provided | Verify: Test: empty-input rejection

---

### S3: Composer

**Package:** `src/composer/`
**Dependencies:** S0 (CompositionExpression types)
**Build group:** Parallel Group 1

**What to build:**
- `src/composer/index.ts` — Composition operations:
  - `compose(a: string, b: string, op?: "apply" | "commutator" | "inverse"): CompositionResult`
  - Default operation: "apply" → `a(b)`
  - Commutator: `[a, b]` → returns `{ a(b), b(a), commutator_pair }`
  - Inverse: `a(b)⁻¹` → annotates reversal cost
- `src/composer/algebra.ts` — Core algebra:
  - `parse(notation: string): CompositionExpression` — parse "R(I)" into structured form
  - `apply(outer: CompositionExpression, inner: CompositionExpression): CompositionExpression`
  - `order(expr: CompositionExpression): number` — composition order (nesting depth)
  - `isStable(expr: CompositionExpression): boolean` — checks against known stable compositions
  - `volume(expr: CompositionExpression): number` — D*I*R product from axis weights
- `src/composer/known.ts` — Known composition table:
  - All 9 first-order compositions with axis weights and motif mappings
  - 3 known second-order compositions (R(I(D)), D(I)⁻¹, D(R(R)))
  - Substrate-interface compositions (P(R), R(P(D)), D(I(P)))
  - Lookup by notation string

**What NOT to build:**
- No composition enumeration/generation (future "engine inversion" feature)
- No substrate functor parameterisation (P(t,f,p) — future)

**ISC Exit Criteria:**

- [ ] **ISC-S31:** parse("R(I)") returns CompositionExpression with outer=R, inner=I, order=1 | Verify: Test: parse + field check
- [ ] **ISC-S32:** parse("R(I(D))") returns order=2 with nested inner | Verify: Test: parse + order check
- [ ] **ISC-S33:** apply(D, I) returns notation "D(I)" | Verify: Test: compose("D", "I", "apply")
- [ ] **ISC-S34:** commutator(D, I) returns both D(I) and I(D) | Verify: Test: compose("D", "I", "commutator")
- [ ] **ISC-S35:** All 9 first-order compositions in known table | Verify: Test: iterate 3x3 grid, all resolve
- [ ] **ISC-S36:** isStable returns true for all 9 first-order compositions | Verify: Test: all 9 pass
- [ ] **ISC-S37:** isStable returns false for degenerate composition where one axis is zero | Verify: Test: synthetic degenerate case
- [ ] **ISC-S38:** Invalid notation string throws descriptive error | Verify: Test: parse("XYZ") throws

---

### S4: Evaluator

**Package:** `src/evaluator/`
**Dependencies:** S0 (types, MotifLibrary), S1 (vectorize — for volume computation)
**Build group:** Parallel Group 1

**What to build:**
- `src/evaluator/index.ts` — Evaluation entry point:
  - `evaluate(opts: { text?: string, composition?: string, motif_id?: string, thresholds?: { c?: number, i?: number, d?: number } }): EvaluationResult`
  - At least one of text/composition/motif_id required
  - Optional thresholds override defaults: c >= 3 domains, i >= 0.6 Jaccard, d <= 0.8 Jaccard
  - If text provided: vectorize → volume check → predicate evaluation
  - If composition provided: stability check via composer
  - If motif_id provided: lookup in motif library → evaluate predicates
- `src/evaluator/predicates.ts` — c/i/d predicate implementations:
  - `predicateC(candidate, library): PredicateResult` — cross-domain count >= 3
  - `predicateI(candidate, library): PredicateResult` — Jaccard similarity of indicator sets >= 0.6
  - `predicateD(candidate, library): PredicateResult` — no existing motif with Jaccard > 0.8
  - `predicateP(candidate, library): PredicateResult` — substrate effects present (optional)
- `src/evaluator/stability.ts` — Stability checks:
  - `checkVolume(vector: Vector6D): { volume: number, nonzero: boolean }`
  - `checkNonDegeneracy(expr: CompositionExpression): boolean`

**What NOT to build:**
- No batch evaluation

**ISC Exit Criteria:**

- [ ] **ISC-S41:** evaluate({ text }) returns all four predicates + volume + stability | Verify: Test: full result shape
- [ ] **ISC-S42:** predicateC returns pass=true when candidate appears in >= 3 domains | Verify: Test: mock library with 3 domains
- [ ] **ISC-S43:** predicateC returns pass=false when candidate appears in < 3 domains | Verify: Test: mock library with 1 domain
- [ ] **ISC-S44:** predicateD returns pass=false when candidate matches existing motif (Jaccard > 0.8) | Verify: Test: near-duplicate candidate
- [ ] **ISC-S45:** Volume check returns nonzero=false when any D/I/R axis is 0 | Verify: Test: [0, 0.5, 0.5, ...]
- [ ] **ISC-S46:** evaluate({ composition: "R(I)" }) returns stability result without text | Verify: Test: composition-only evaluation
- [ ] **ISC-S47:** evaluate({}) with no inputs throws descriptive error | Verify: Test: empty call
- [ ] **ISC-S48:** evaluate({ thresholds: { c: 2 } }) applies override — pass with 2 domains | Verify: Test: lowered threshold changes predicate result

---

### S5: MCP Server

**Package:** `src/mcp/`
**Dependencies:** S0, S1, S2, S3, S4
**Build group:** Sequential (last — depends on all)

**What to build:**
- `src/mcp/server.ts` — MCP server entry point:
  - `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`
  - `StdioServerTransport` from `@modelcontextprotocol/sdk/server/stdio.js`
  - Register 5 tools with Zod input schemas
  - Load artifacts at startup (centroids, vocabulary, motifs)
  - Track uptime for status tool
  - Error wrapping: all handlers return `{ content: [{ type: "text", text: JSON.stringify(...) }] }` or `{ isError: true, ... }`
  - Shebang: `#!/usr/bin/env bun`
- `src/mcp/tools.ts` — Tool handler implementations:
  - `handleClassify(args, engine) → MCP response`
  - `handleCompose(args, engine) → MCP response`
  - `handleEvaluate(args, engine) → MCP response`
  - `handleStatus(engine) → MCP response`
  - `handleEnergy(args) → MCP response` (gated stub)
- `src/mcp/engine.ts` — Engine state container:
  - Holds loaded artifacts (centroids, vocabulary, motifs)
  - Provides methods that tools call (thin delegation to S1-S4 modules)
  - Tracks startup time for uptime computation

**What NOT to build:**
- No HTTP transport (stdio only)
- No authentication (localhost stdio — no attack surface)
- No hot-reload (restart to reload artifacts)

**ISC Exit Criteria:**

- [ ] **ISC-S51:** Server starts without error when valid artifacts exist in data/ | Verify: CLI: `echo '{}' | timeout 2 bun src/mcp/server.ts 2>&1; echo $?`
- [ ] **ISC-S52:** Server registers exactly 5 tools | Verify: Test: MCP list_tools response contains 5 entries
- [ ] **ISC-S53:** dir_classify tool accepts text input and returns classification JSON | Verify: CLI: MCP tool call via stdio
- [ ] **ISC-S54:** dir_compose tool accepts two composition strings and returns result | Verify: CLI: MCP tool call via stdio
- [ ] **ISC-S55:** dir_evaluate tool accepts text or composition and returns predicates | Verify: CLI: MCP tool call via stdio
- [ ] **ISC-S56:** dir_status tool returns engine status with artifact versions | Verify: CLI: MCP tool call via stdio
- [ ] **ISC-S57:** dir_energy tool returns gated response | Verify: CLI: MCP tool call returns `gated: true`
- [ ] **ISC-S58:** All tool handlers catch errors and return isError MCP responses | Verify: Test: invalid input → isError response
- [ ] **ISC-S59:** Server wired into .mcp.json alongside ocp-scraper and observer-control-plane | Verify: Read: .mcp.json contains dir-engine entry
- [ ] **ISC-S5A:** Cross-validation: classify >= 50 shared test records through both Python vectorizer and TS engine; composition assignments identical for >= 95% of records | Verify: CLI: cross-validation script comparing pipeline vs engine output

---

## 4. DEPENDENCY GRAPH

```
S0 (types + loaders) ──┬── S1 (vectorizer)  ──┐
                       ├── S2 (classifier)  ──┤
                       ├── S3 (composer)    ──┼── S5 (MCP server)
                       └── S4 (evaluator)  ──┘
```

| Group | Slices | Can Build After |
|-------|--------|-----------------|
| Foundation | S0 | Nothing (first) |
| Parallel 1 | S1, S2, S3, S4 | S0 complete |
| Final | S5 | S1 + S2 + S3 + S4 complete |

**Critical path:** S0 → S1 → S5 (vectorizer is on critical path because classifier depends on it at integration time)

**Note on S2 parallel build:** S2 depends on S1's `vectorize()` function, but can be built against the type contract (Vector6D). Integration tested in S5.

---

## 5. PROJECT STRUCTURE

```
01-Projects/dir-engine/
├── .prd/
│   └── PRD-20260403-dir-structural-engine.md    # This document
├── package.json
├── tsconfig.json
├── CLAUDE.md                                     # Project-specific instructions
├── data/                                         # Artifact directory (gitignored binaries, tracked JSON)
│   ├── centroids.json                            # Centroid manifest (exported from pipeline)
│   ├── vocabulary.json                           # Indicator vocabulary (exported from pipeline)
│   └── motifs.json                               # Motif library snapshot
├── scripts/
│   └── export-artifacts.ts                       # Export script for pipeline → data/
├── src/
│   ├── types/
│   │   └── index.ts                              # S0: Core types
│   ├── data/
│   │   ├── loader.ts                             # S0: Artifact loading
│   │   └── schemas.ts                            # S0: Zod validation schemas
│   ├── vectorizer/
│   │   ├── index.ts                              # S1: vectorize()
│   │   └── temporal.ts                           # S1: Temporal markers
│   ├── classifier/
│   │   ├── index.ts                              # S2: classify()
│   │   ├── distance.ts                           # S2: Cosine distance
│   │   └── substrate.ts                          # S2: Substrate detection
│   ├── composer/
│   │   ├── index.ts                              # S3: compose()
│   │   ├── algebra.ts                            # S3: Parse/apply/order
│   │   └── known.ts                              # S3: Known composition table
│   ├── evaluator/
│   │   ├── index.ts                              # S4: evaluate()
│   │   ├── predicates.ts                         # S4: c/i/d/p predicates
│   │   └── stability.ts                          # S4: Volume + degeneracy checks
│   └── mcp/
│       ├── server.ts                             # S5: MCP entry point (shebang)
│       ├── tools.ts                              # S5: Tool handlers
│       └── engine.ts                             # S5: Engine state container
└── test/
    ├── vectorizer.test.ts
    ├── classifier.test.ts
    ├── composer.test.ts
    ├── evaluator.test.ts
    └── fixtures/
        ├── centroids-sample.json
        ├── vocabulary-sample.json
        └── motifs-sample.json
```

---

## 6. CONFIGURATION

### 6.1 package.json

```json
{
  "name": "dir-engine",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "mcp": "bun src/mcp/server.ts",
    "test": "bun test",
    "export-artifacts": "bun scripts/export-artifacts.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.27.1",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/bun": "^1.2.0",
    "bun-types": "^1.3.10",
    "typescript": "^5.7.0"
  }
}
```

### 6.2 tsconfig.json

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["bun-types"],
    "outDir": "dist",
    "rootDir": "src",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "test"]
}
```

### 6.3 .mcp.json Entry

```json
{
  "dir-engine": {
    "type": "stdio",
    "command": "bun",
    "args": ["/mnt/zfs-host/backup/projects/observer-vault/01-Projects/dir-engine/src/mcp/server.ts"]
  }
}
```

This entry is added alongside existing `observer-control-plane` and `ocp-scraper` entries in the vault-root `.mcp.json` and all four CLI backend configs.

---

## 7. ARTIFACT EXPORT

### 7.1 Centroid Manifest

Exported from the Python pipeline's K-means results:

```json
{
  "version": "2026-04-03-001",
  "k": 9,
  "dim": 6,
  "dim_names": ["D", "I", "R", "temporal", "density", "entropy"],
  "centroids": [
    [0.456, 0.234, 0.310, 0.412, 1.034, 0.876],
    [0.182, 0.645, 0.173, 0.321, 0.945, 0.654]
  ],
  "mapping": {
    "0": "I(D)",
    "1": "D(D)",
    "2": "R(R)",
    "3": "I(I)",
    "4": "R(I)",
    "5": "R(D)",
    "6": "D(I)",
    "7": "D(R)",
    "8": "I(R)"
  }
}
```

### 7.2 Indicator Vocabulary

Extracted from `dir-vectorize-cluster.py`'s INDICATORS constant:

```json
{
  "version": "2026-04-03-001",
  "indicators": [
    { "term": "state machine", "weight": 1.0, "axis": 0 },
    { "term": "boundary", "weight": 0.7, "axis": 0 },
    { "term": "dual-speed", "weight": 1.0, "axis": 1 },
    { "term": "recursive", "weight": 0.9, "axis": 2 }
  ],
  "temporal_markers": {
    "sequential": ["then", "next", "subsequently", "afterward"],
    "concurrent": ["while", "during", "meanwhile", "simultaneously"],
    "cyclic": ["cycle", "loop", "iterate", "periodic"],
    "recursive": ["recursive", "meta", "nested", "self-referential"]
  }
}
```

### 7.3 Motif Library Snapshot

Extracted from `02-Knowledge/motifs/`:

```json
{
  "version": "2026-04-03-001",
  "motifs": [
    {
      "id": "explicit-state-machine-backbone",
      "name": "Explicit State Machine Backbone",
      "composition": "D(D)",
      "tier": 2,
      "domains": ["software", "governance", "biology"],
      "indicators": ["state machine", "explicit", "boundary", "transition"]
    }
  ]
}
```

---

## 8. SECURITY

### 8.1 Invariants

| Constraint | Enforcement | Rationale |
|-----------|------------|-----------|
| Read-only access | Engine opens shard DBs with `?mode=ro` URI, artifact files read with `Bun.file().text()` | Engine must never corrupt pipeline data |
| No user-supplied paths | All file paths resolved from project-root constant, never from MCP tool input | Prevent path traversal |
| Zod validation on all inputs | Every tool handler validates args via Zod schema before processing | Prevent malformed input from reaching engine logic |
| Zod validation on artifact load | All JSON artifacts validated against Zod schemas at startup | Prevent malformed data from corrupting classification |
| Localhost stdio only | No HTTP server, no network binding | No network attack surface |
| No secrets in artifacts | Artifact JSON files contain only structural data (vectors, terms, names) | OIL secret gate applies at commit time |

### 8.2 Threat Model

| Threat | Mitigation |
|--------|-----------|
| Malformed MCP input | Zod schema validation rejects before processing |
| Corrupted artifact files | Zod schema validation at load time; engine refuses to start with invalid artifacts |
| Path traversal via tool input | No file path parameters exposed in tool schemas |
| Denial of service (large text) | Text truncated to 8000 chars before vectorization |
| Information disclosure | Tool responses contain only structural data (vectors, compositions, scores) — no raw text echoed back |

---

## 9. OPERATIONAL

### 9.1 CLI Backend Wiring

After S5 is complete, the MCP server entry must be added to all four CLI backend configs:

| CLI | Config file | Entry key |
|-----|------------|-----------|
| Claude Code | `.mcp.json` (vault root) | `dir-engine` |
| Codex CLI | `~/.codex/config.toml` | `[mcp.dir-engine]` |
| OpenCode | `opencode.json` | `mcpServers.dir-engine` |
| Gemini CLI | `.gemini/settings.json` | `mcpServers.dir-engine` |

### 9.2 Artifact Refresh Workflow

When the Python pipeline recomputes centroids:

1. Run `bun scripts/export-artifacts.ts` (or Python equivalent) to regenerate `data/centroids.json`
2. Restart the MCP server (any CLI backend will re-launch it on next tool call)
3. Verify via `dir_status` that new centroid version is loaded

No hot-reload — restart is the reload mechanism. This is acceptable because centroid updates are infrequent (days/weeks) and MCP servers are re-launched per CLI session.

### 9.3 Testing

```bash
# Run all tests
bun test

# Run specific slice tests
bun test test/vectorizer.test.ts
bun test test/classifier.test.ts
bun test test/composer.test.ts
bun test test/evaluator.test.ts

# Manual MCP smoke test
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"dir_status","arguments":{}},"id":1}' | bun src/mcp/server.ts
```

---

## 10. RESOLVED QUESTIONS

All open questions resolved by Adam on 2026-04-03:

| # | Question | Resolution |
|---|----------|-----------|
| 1 | Should `dir_classify` accept pre-computed vectors? | **Yes, required.** Trading system computes D/I/R vectors from price data (D=volatility, I=correlation, R=autocorrelation). Without vector input, Task 8 cannot use the engine. Added to S2 with ISC-S29/S2A/S2B. |
| 2 | Should motifs.json include full indicator sets per motif? | **Yes.** Predicates i and d are uncomputable without indicator sets. Added indicators field to motif library schema and motifs.json format. |
| 3 | Should the engine validate centroid coverage on load? | **Yes, warn don't fail.** loadCentroids logs warning for missing compositions but still loads. Partial manifest is better than no engine. Added ISC-S09. |
| 4 | Should `dir_compose` handle substrate functor P? | **Defer to v2.** Not needed for Task 5 or Task 8. |
| 5 | Should predicate thresholds be caller-overridable? | **Yes.** Defaults: c >= 3 domains, i >= 0.6 Jaccard, d <= 0.8 Jaccard. Optional thresholds object merges over defaults. Added to S4 with ISC-S48. |

---

## LOG

### Iteration 0 — 2026-04-03 — DRAFT
- **Phase reached:** DRAFT
- **Criteria progress:** 0/48
- **Work done:** PRD authored after 3 full D/I/R cycles. Key design decisions: dropped Cluster tool (training, not inference), replaced with Status. 6D vectorizer ported from Python. Centroid manifest as JSON artifact. 6 build slices with S1-S4 parallelisable.
- **Failing criteria:** All (not yet built)
- **Context for next:** Adam reviews PRD. Key decision points: open questions 1-5, especially Q1 (pre-computed vector input) and Q4 (substrate functor scope).

### Iteration 1 — 2026-04-03 — DRAFT (reviewed)
- **Phase reached:** DRAFT → PLAN (Adam approved with amendments)
- **Criteria progress:** 0/55 (7 new ISC added)
- **Work done:** All 5 open questions resolved. Amendments applied:
  - Q1: vector input path added to dir_classify (required for Task 8 trading system). S2 updated + 3 ISC added (S29, S2A, S2B).
  - Q2: indicators field added to motif library schema and motifs.json format.
  - Q3: loadCentroids coverage validation added (warn, don't fail). ISC-S09 added.
  - Q4: Substrate functor P deferred to v2.
  - Q5: Threshold overrides added to dir_evaluate. ISC-S48 added.
  - Export script promoted to S0 deliverable with 3 ISC (S0A, S0B, S0C).
  - Cross-validation ISC-S5A added to S5 (Python↔TS pipeline parity >= 95%).
  - Energy ungating criteria documented (Section 2.7): >= 3/5 wave equation tests must pass.
  - Motif library count corrected: 35 motifs, 9 Tier 2, 5 Tier 3 drafts.
- **Failing criteria:** All (not yet built)
- **Context for next:** Begin S0 build. Export scripts first (bridge to real data), then types and loaders.

### Iteration 2 — 2026-04-03 — PLAN (wave theory update)
- **Phase reached:** PLAN
- **Criteria progress:** 0/55
- **Work done:** QHO wave equation falsified (≤2/5 tests). Replaced by Langevin/multi-well dissipative model (5/5 under reframed predictions). Triad convergence ~95% (Claude Opus, Gemini ×2). PRD updated: Section 2.7 rewritten with Langevin equation, revised operator mappings, and new ungating criteria. Section 1.4 and 2.1 energy stub message updated. Vault document placed at `00-Inbox/qho-falsification-langevin-reframing-20260403-DRAFT.md`. Original wave equation assessment (`dir-wave-equation-assessment-20260402-DRAFT.md`) marked SUPERSEDED.
- **Failing criteria:** All (not yet built)
- **Context for next:** S0 build proceeds unchanged. Energy gating criteria now reference multi-well basin depth, not QHO eigenvalues. No impact on build slices S0–S5 — energy remains a stub in v1 regardless.
