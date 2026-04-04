---
type: analysis
status: DRAFT
authority: none
created: 2026-03-31
method: D/I/R (3 cycles, c/i/d convergence)
scope: OCP scraper + dataset processor + motif library governance calibration
feeds: experimental-llm epistemological hierarchy
---

# Governance Calibration — Fresh Eyes D/I/R Analysis

**Atlas, 2026-03-31**
**Authority: DRAFT — proposes, Adam decides.**

---

## Executive Summary

The task framed this as aligning **two** divergent governance systems. The analysis reveals **three** — and the divergence is deeper than threshold mismatch. The OCP scraper, the dataset processor, and the motif library schema each implement governance differently, measure confidence differently, and serve different purposes. Alignment requires acknowledging this tripartite structure, not flattening it.

The motif library is strong. Of 34 motifs, 9 Tier 2 operators are exceptionally well-evidenced (7-14 domains each, 8/9 triangulated). Two Tier 1 motifs (Template-Driven Classification, Scaffold-First Architecture) are effectively internal-only and should not be used as evaluation criteria for external corpus processing until validated externally. The remaining library is sound.

The confidence scales across all three systems are **incommensurable** — they measure fundamentally different things. No linear mapping between them exists. The unified governance proposal must define a common evaluation language rather than forcing numerical alignment.

---

# CYCLE 1 — DISTINCTION (Map the Territory)

## 1.1 OCP Scraper Governance

### What It Actually Is

The OCP scraper does **not** implement a tier system (T0-T3). It implements:

1. **Composite Trust Score (CTS):** Weighted geometric mean of 6 trust vector dimensions, normalized 0-1
2. **5-level confidence mapping:** CTS thresholds → {speculative, provisional, tested, proven, foundational}
3. **Template governance:** pending → approved → rejected (human-in-loop for templates, not records)
4. **Federation trust discounting:** Foreign records discounted by 0.5 default

### CTS Calculation

Formula: `CTS = (v1^w1 * v2^w2 * ... * v6^w6) ^ (1/sum(weights))`

Weights:
| Dimension | Weight | What It Measures |
|-----------|--------|-----------------|
| validation_count | 0.25 | Adoption signal (stars, forks, citations) |
| validation_diversity | 0.30 | Source diversity (contributors, author diversity) |
| context_breadth | 0.20 | Topic/category coverage |
| temporal_stability | 0.10 | Age + recency balance |
| test_coverage | 0.10 | Quality indicators (CI, types, DOI, bibliography) |
| documentation_quality | 0.05 | Documentation completeness |

### Confidence Level Thresholds

**GitHub/arXiv adapters (3-level):**
| CTS Range | Confidence Level |
|-----------|-----------------|
| >= 0.7 | tested |
| >= 0.4 | provisional |
| < 0.4 | speculative |

**SEP adapter (5-level):**
| CTS Range | Confidence Level |
|-----------|-----------------|
| >= 0.82 | foundational |
| >= 0.62 | proven |
| >= 0.42 | tested |
| >= 0.22 | provisional |
| < 0.22 | speculative |

### Graph Edges

Edge types: `depends_on`, `shared_domain`, `compatible_port`, `related_to`, `references`

Edges are **deterministically derived** from metadata — dependency graphs, domain classification, port signatures, category hierarchies. No explicit validation process for connections. This means edges reflect source structure, not independently verified structural relationships.

### Sovereignty Structure

Federation IS the sovereignty gate:
- Local records: full trust
- Imported records: discounted (default 0.5x)
- `allow_trust_escalation: false` — foreign trust cannot exceed local baseline
- Template governance (human approval) applies to problem templates, not individual records

### Key Observations

1. **CTS measures source quality, not structural significance.** A well-documented, popular GitHub repo with many contributors gets high CTS regardless of whether it contains genuine structural motifs.
2. **The geometric mean formula compresses scores toward the lowest dimension.** A single weak dimension drags down the entire CTS. This is conservative by design.
3. **Confidence levels are adapter-specific.** SEP gets all 5 levels; GitHub/arXiv only get 3. A "tested" record from GitHub (CTS >= 0.7) and a "tested" record from SEP (CTS >= 0.42) represent very different evidence quality.
4. **No tier promotion exists.** Records are born at a confidence level based on their CTS and stay there unless re-scraped with new data.
5. **Graph edges are structural metadata, not validated structural claims.** A `shared_domain` edge means the records were classified in the same domain, not that a human or model verified they share genuine structure.

---

## 1.2 Dataset Processor Governance

### What It Actually Is

The processor implements TWO orthogonal systems:

1. **Evaluation tiers (A/B/C):** Methods of assessing evidence quality
2. **Governance tiers (T0/T1/T2/T3):** Motif maturity stages with promotion gates

These are orthogonal. Tier A/B/C produce evidence. T0→T3 consume evidence for promotion decisions.

### Evaluation Tiers (Evidence Production)

**Tier A — Lexical Indicators:**
- Weighted keyword matching against indicator sets (10-20 terms per motif)
- Score: `weightedSum / maxPossibleWeight`, range 0-1
- Qualification threshold: 3+ indicators matched AND score >= 0.3
- Produces: `amorphous` verb records with initial motif candidate

**Tier B — Structural Scoring:**
- Composite of 4 weighted components:
  - Process relationships: 0.35
  - Temporal structure: 0.20
  - Governance indicators: 0.20
  - Operator matching: 0.25
- Score: weighted sum, capped at 1.0
- Produces: `structured` verb records with refined motif match

**Tier C — Model Evaluation (Claude API):**
- Returns: structuralMatchConfidence (0-1), axis, derivativeOrder, operatorTags, matchEvidence, isNovelPattern, processShape, temporalStructure
- Budget: 10M tokens/day
- Produces: `typed` verb records with model-assessed confidence

### Governance Tiers (Motif Promotion)

**T0 → T1 (Auto-promotion):**
| Criterion | Threshold |
|-----------|-----------|
| Domain count | >= 3 |
| Source types | >= 2 (distinct source_component values) |
| Confidence | >= 0.3 (average motif_confidence across records) |

No human approval. Conflicting evidence no longer blocks (at-scale design decision).

**T1 → T2 (Batch review queue):**
| Criterion | Threshold |
|-----------|-----------|
| Domain count | >= 7 |
| Source types | >= 3 |
| Confidence | >= 0.7 |
| Cross-temporal evidence | true (3+ distinct source components) |

Plus ALL 5 validation protocol conditions:
1. Domain-independent description (has `## Structural Description` section)
2. Cross-domain recurrence (3+ unrelated domains)
3. Predictive power (2+ domains with confidence >= 0.7)
4. Adversarial survival (both top-down AND bottom-up evidence)
5. Clean failure (has `## Falsification Conditions` section)

**T2 → T3 (Sovereignty flag only):**
| Criterion | Threshold |
|-----------|-----------|
| Relationship edges | >= 3 |
| Domain count | >= 10 |
| Confidence | >= 0.9 |

Requires 2+ thresholds met. Flag only — no automation.

### Evidence Aggregation

Per motif, the aggregator collects:
- Domain count and list (from `source_component`)
- Source type count and triangulation signal (`primed` = top-down, `blind` = bottom-up, both = `triangulated`)
- Average confidence and Tier B score
- Verb record count
- Relationship edges from `motif_graph_edges`
- Conflicting evidence flag (same passage matching multiple motifs)
- Cross-temporal evidence flag (3+ distinct source components)

### Key Observations

1. **The 0.7 threshold for T1→T2 is designed for Tier C model-evaluated confidence.** This is the right threshold for model judgment but unreachable by Tier A lexical matching alone (which maxes around 0.42 for well-matched content). This is by design — the processor expects Tier C to have run before T1→T2 promotion is evaluated.
2. **The processor's governance tiers mirror the library schema** but add quantitative thresholds the schema doesn't specify. The schema says "3+ domains" for T2; the processor says 7. The schema says "human approval" for T2; the processor automates the check and queues for human review.
3. **The 10 slices form a feedback loop:** Tier A → Tier B → Buffer → Tier C → Governance → Template refresh → next pass. This means governance quality depends on the full pipeline running, not just Tier A.
4. **The confidence field in evidence aggregation is an average of Tier C model scores.** If Tier C hasn't run, this defaults to Tier A/B scores — which are structurally different measurements being averaged as if comparable.
5. **Extraction method tracking (primed/blind → triangulation) is a clever proxy** for top-down/bottom-up triangulation. Primed extraction uses known motif indicators (top-down). Blind extraction discovers patterns without priming (bottom-up). Both present = triangulated.

---

## 1.3 Motif Library Schema Governance

### What It Actually Is

A third governance system, defined in `02-Knowledge/motifs/_SCHEMA.md`:

**Tier definitions:**
| Tier | Name | Criteria | Approval |
|------|------|----------|----------|
| 0 | Observation | Single instance, no cross-domain confirmation | Auto-draft |
| 1 | Cross-Domain Pattern | 2+ unrelated domains | Auto-promotion |
| 2 | Structural Operator | 3+ domains, 5 validation conditions, predictive power | Human required |
| 3 | Meta-Structural | Describes relationships between T2 motifs, geometric description | Human required |

**Confidence scoring:**
| Event | Score Change |
|-------|-------------|
| New motif created (T0) | Start at 0.1 |
| New domain instance added | +0.1 per instance |
| Triangulation confirmed | +0.2 |
| Superficial instance retracted | -0.1 |
| Maximum | 1.0 (capped) |

### Key Observations

1. **The library schema's confidence scoring is additive and domain-count-driven.** A motif with 8 domains and triangulation: 0.1 + 0.8 + 0.2 = 1.0. This is fundamentally different from both CTS (geometric mean of source quality metrics) and the processor's confidence (average model judgment).
2. **The library schema says T1 requires 2+ domains; the processor says T0→T1 requires 3 domains.** These are already misaligned.
3. **The library schema says T2 requires 3+ domains; the processor says T1→T2 requires 7 domains.** The processor is significantly stricter.
4. **The library schema's T1 auto-promotion has no approval gate; the processor's T0→T1 also has no approval gate.** These align in intent if not in threshold.
5. **The library schema's T2 human approval and the processor's T1→T2 batch review queue are the same gate** — the processor mechanises what the schema describes qualitatively.

---

## 1.4 Motif Library Audit

### Tier 2 (9 motifs) — Assessment

| Motif | Conf. | Domains | Triangulated | Evidence Quality | Concerns |
|-------|-------|---------|--------------|-----------------|----------|
| Dual-Speed Governance | 1.0 | 12 | Yes | Exceptional | None |
| Composable Plugin Architecture | 0.9 | 7 | Yes | Excellent | None |
| Explicit State Machine Backbone | 0.9 | 7 | Yes | Excellent | None |
| Bounded Buffer w/ Overflow Policy | 0.9 | 7 | Yes | Excellent | None |
| Idempotent State Convergence | 1.0 | 10 | Yes | Exceptional | None |
| Observer-Feedback Loop | 0.9 | 8 | Partial | Very Good | **Top-down only — no bottom-up corpus triangulation** |
| Ratchet w/ Asymmetric Friction | 0.9 | 12 | Yes | Excellent | None |
| Progressive Formalization | 0.85 | 10 | Yes | Excellent | None |
| Reconstruction Burden | 0.9 | 14 | Yes | Exceptional | None |

**Assessment:** 8/9 fully triangulated with exceptional evidence. Observer-Feedback Loop is conditionally promoted — it needs bottom-up corpus evidence. This is acknowledged in its status ("conditional"). The library's self-awareness here is a strength.

### Tier 1 (9 motifs) — Assessment

| Motif | Conf. | Domains | Concerns |
|-------|-------|---------|----------|
| Trust-as-Curation | 0.7 | 8 | Needs alien-domain expansion |
| Reflexive Structural Transition | 0.8 | 10 | Strong — ready for T2 validation |
| Boundary Drift | 0.9 | 9 | Needs adversarial testing ("is this just things change?") |
| Structural Coupling as Ground State | 0.6 | 6 | Weakest T1 — conceptually important but empirically thin |
| Recursive Generativity | 0.5 | 5 | d3 classification needs review |
| Template-Driven Classification | 0.3 | 2 | **CONCERN: Both domains internal to Observer project** |
| Scaffold-First Architecture | 0.2 | 2 | **CONCERN: Both domains internal to Observer project** |
| Primitive Self-Reference | 0.7 | 7 | Solid |
| Safety-Liveness Duality | 0.7 | 7 | Strong — Alpern-Schneider provides mathematical universality |

**Critical flags:**
- **Template-Driven Classification** and **Scaffold-First Architecture** have ONLY internal Observer project instances. Using these as evaluation criteria for external corpus processing is circular — the motifs were derived from the system that would evaluate them.
- **Boundary Drift** at 0.9 confidence with 9 domains but still T1 — the stated gap is "needs adversarial testing." If it's genuinely "just things change," it fails the non-trivial structure test.
- **Structural Coupling as Ground State** at 0.6/6 domains is the weakest T1 motif. Conceptually important (Luhmann, Whitehead) but the evidence is more philosophical than empirical.

### Tier 0 (14 motifs) — Assessment

All T0 motifs are single-instance or very limited (1-3 domains). Most are sound as observations. Notable:
- **Paradigmatic Boundary Revision** and **Consilient Unification** (both 3 domains, d3) are the most mature T0 motifs and closest to T1 promotion
- Several music theory / cognitive science / control theory motifs could reach T1 with 1-2 additional domain instances

### Tier 3 (5 draft candidates) — Assessment

All DRAFT status, 0.1 confidence. Coordination Type Lattice is strongest but has a naming circularity problem (coordination types named post-hoc from operators, not from first principles). None are ready for promotion.

### Inter-Motif Connections — Assessment

42 documented relationships from batch 3 mapping (2026-03-22). These include complement, tension, composition, and governance relationships.

**Concern:** These connections were identified through creative analysis sessions (top-down), not through corpus co-occurrence analysis (bottom-up). While the analysis was rigorous (explicitly tested non-instances), the connections represent expert judgment about structural relationships, not statistically validated co-occurrence. This distinction matters for the experimental LLM — the model should know which edges are judgment-derived vs. evidence-derived.

---

## 1.5 Open Exploration — Cycle 1

### Finding 1: The Tripartite Structure Problem

The task asks to align "two systems." There are three:

| System | Confidence Metric | What It Measures | Scale Type |
|--------|------------------|-----------------|------------|
| OCP Scraper | CTS (geometric mean) | Source quality/reliability | Continuous, 0-1, multiplicative |
| Dataset Processor | Tier A/B/C scores averaged | Evidence strength per motif | Continuous, 0-1, weighted additive |
| Motif Library Schema | Domain count + triangulation bonus | Knowledge maturity | Discrete, additive, capped at 1.0 |

These are measuring **fundamentally different things:**
- CTS: "How reliable is this source?"
- Processor confidence: "How well does this passage match a motif pattern?"
- Library confidence: "How broadly has this motif been validated?"

No linear mapping between them is possible because they're answering different questions.

### Finding 2: The Indicator Set Coverage Gap

The processor's Tier A has indicator sets for **18 motifs** (hardcoded in `indicator-sets.ts`). The library has **34 motifs**. The processor can only detect motifs it has indicator sets for.

Motifs without indicator sets: all 14 Tier 0 motifs, plus Template-Driven Classification, Scaffold-First Architecture, and potentially some of the newer T1/T2 additions. This means the processor's governance pipeline structurally cannot promote motifs it cannot detect.

### Finding 3: The Self-Reference in Evaluation Criteria

The motif library is being used as the evaluation backbone for the dataset processor, which produces evidence that promotes motifs in the library. This is an Observer-Feedback Loop instance — the evaluation criteria and the evidence they evaluate co-evolve. This isn't a bug; it's the intended design. But it means:
- Motifs that are well-described get better indicator sets, which find more evidence, which raises confidence, which makes them even more central
- Motifs that are poorly described get weak indicator sets, find less evidence, and atrophy

This creates a **Matthew effect** (rich-get-richer) in the motif library. Existing T2 motifs will accumulate disproportionate evidence from corpus processing. New motifs and weak T0 observations will struggle to gain traction through the processor pipeline alone.

### Finding 4: Edge Validation Asymmetry

OCP scraper edges are deterministic (metadata-derived). Processor edges are co-occurrence-based (statistical). Library edges are expert-judged (creative analysis). Three different edge-generation methods, no common validation standard.

### Finding 5: The Adapter-Specific Confidence Bias

SEP adapter has access to all 5 confidence levels; GitHub/arXiv only 3. This means philosophical/epistemological content can reach "foundational" confidence while software engineering content maxes out at "tested." Since the motif library spans both domains, this creates a systematic bias: philosophy-sourced motifs appear more authoritative than software-sourced motifs in OCP data, regardless of actual evidence quality.

---

## 1.6 c/i/d Convergence Check — Cycle 1

**c (Cross-Domain Validation):** Each system described in its own terms. OCP's CTS system, processor's dual-tier structure, and library schema's additive confidence are mapped independently across their respective domains (source assessment, evidence production, knowledge maturity). **Score: HIGH** — the three systems are clearly distinguished.

**i (Structural Invariance):** The core governance question — "when is a motif ready for the next level?" — has a stable answer within each system, though the answer differs across systems. The structural shape of "threshold-based promotion" is invariant; the specific thresholds and metrics are domain-substituted. **Score: HIGH** — the distinction is clean.

**d (Non-Derivability):** The tripartite structure (Finding 1) is not derivable from either the OCP or processor system descriptions alone. It required examining all three to see that they answer different questions. The Matthew effect (Finding 3) is not derivable from any single system — it emerges from the feedback loop between library and processor. **Score: HIGH** — findings are non-trivial.

**Cycle 1 Stability:** STABLE. Distinctions are sharp, no premature blending. Ready for integration.

---

# CYCLE 2 — INTEGRATION (Find Alignment and Conflict)

## 2.1 System Correspondence Map

### Tier Alignment

| Library Schema | Processor Governance | OCP Scraper | Correspondence |
|---------------|---------------------|-------------|----------------|
| Tier 0 (Observation) | T0 (pre-promotion) | speculative/provisional | **Partial.** Library T0 = "exists." Processor T0 = "has some evidence." OCP speculative = "low CTS." Different entry criteria. |
| Tier 1 (Cross-Domain) | T1 (auto-promoted) | provisional/tested | **Weak.** Library T1 needs 2+ domains. Processor T1 needs 3+ domains + 2 source types + 0.3 confidence. OCP "tested" needs CTS >= 0.7 (GitHub) or 0.42 (SEP). Measures differ. |
| Tier 2 (Structural Operator) | T2 (batch reviewed) | proven/foundational | **Very weak.** Library T2 needs 3+ domains + 5 conditions + human approval. Processor T2 needs 7+ domains + 0.7 confidence + cross-temporal + 5 conditions. OCP "proven" needs CTS >= 0.62 (SEP only). Fundamentally different evaluations. |
| Tier 3 (Meta-Structural) | T3 (sovereignty flag) | N/A | **No OCP equivalent.** OCP doesn't model meta-structural relationships. |

### Threshold Mismatches

| Transition | Library Schema | Processor | Mismatch Type |
|-----------|---------------|-----------|---------------|
| → T1 domain count | 2+ | 3+ | Processor stricter (by 1) |
| → T2 domain count | 3+ | 7+ | Processor much stricter (by 4) |
| → T2 confidence | "predictive power" (qualitative) | 0.7 (quantitative) | Different measurement: qualitative judgment vs. averaged model score |
| → T2 source diversity | "cross-domain recurrence" | 3+ source types + cross-temporal | Processor adds granularity the schema doesn't specify |
| → T2 approval | Human | Human (batch queue) | Aligned in intent |

### Why Each Mismatch Exists

1. **Domain count gap (T1: 2 vs 3, T2: 3 vs 7):** The library schema was designed for manual curation where each domain instance is carefully verified. The processor processes bulk data where domain counts are noisy (a source_component like "GitHub" contains many sub-domains). Higher thresholds compensate for lower per-instance quality.

2. **Confidence gap (qualitative vs 0.7):** The library schema's "predictive power" is a human judgment call. The processor needs a computable threshold. 0.7 was calibrated for Tier C model evaluation, which is the closest automated proxy for human judgment of predictive power.

3. **Source diversity gap:** The library's triangulation (top-down + bottom-up) maps to the processor's extraction method tracking (primed + blind = triangulated). The processor adds cross-temporal evidence (3+ source components) as a second diversity axis the schema doesn't specify.

## 2.2 Governance Logic Asymmetry

### Present in Processor, Absent in OCP

| Logic | Processor | OCP Equivalent |
|-------|-----------|----------------|
| Tier promotion gates | T0→T1→T2→T3 with thresholds | None — records born at confidence level |
| Evidence aggregation | Per-motif evidence across all verb records | None — per-record CTS only |
| Validation protocol (5 conditions) | Automated check + human review | None |
| Extraction method tracking | primed/blind/triangulated | None |
| Cross-temporal evidence | 3+ source components | None |
| Priority buffer with eviction | BBWOP, 10K capacity, 72h TTL | None |
| Multi-pass convergence | Orchestrator with template refresh | Single scrape pass |
| Graph edge co-occurrence | Statistical from verb records | Deterministic from metadata |

### Present in OCP, Absent in Processor

| Logic | OCP | Processor Equivalent |
|-------|-----|---------------------|
| Source quality assessment (CTS) | 6-dimension trust vector | None — processor trusts all Pile sources equally |
| Template governance (human approval) | pending → approved → rejected | None — indicator sets are hardcoded |
| Federation trust discounting | 0.5x foreign discount | None — no multi-vault concept |
| Validation events (search-as-validation) | Append-only ledger tracking outcomes | None |
| Adapter-specific scoring | Per-source scoring formulas | None — all sources treated uniformly |
| Composability interfaces | Port signatures, dependency graphs | None |

### Present in Library Schema, Absent in Both

| Logic | Library Schema | Missing From |
|-------|---------------|-------------|
| Derivative order classification | d0/d1/d2/d3 with structural definitions | OCP has no concept; processor detects it in Tier C but doesn't use it for governance |
| Primary axis classification | differentiate/integrate/recurse | OCP has no concept; processor detects it in Tier C |
| Falsification conditions | Required for T2 | OCP — no concept; processor checks for section presence but doesn't evaluate quality |
| Domain-independent description | Required for T2 | OCP — no concept; processor checks for section presence |
| Motif relationship types | complement/tension/composition/governance | OCP has different edge types (depends_on, shared_domain, etc.) |

## 2.3 Can OCP Scale to Bulk Processing?

**No — not in its current form.** The OCP model was designed for targeted discovery:
- CTS evaluates individual sources against quality metrics
- Each record gets its own trust vector based on the source it came from
- Confidence levels are assigned per-record, not aggregated per-motif

For bulk Pile processing:
- Individual source quality metrics are meaningless (Pile sources are diverse but not individually scored)
- Per-record confidence doesn't aggregate into per-motif governance
- The 5-level confidence scale doesn't map to maturity stages

**What CAN transfer from OCP:**
1. **The trust vector concept** — a multi-dimensional quality assessment rather than a single score — is sound architecture
2. **Template governance** (human approval for classification templates) should apply to the processor's indicator sets, which are currently hardcoded without governance
3. **Federation trust discounting** provides a model for how processor-generated evidence should be discounted relative to manually curated evidence
4. **Validation events** (tracking whether motif predictions proved useful) should be replicated in the processor for empirical calibration

## 2.4 Does the Processor's Three-Tier Gate Capture Everything?

**No — it misses two critical things from OCP:**

1. **Source quality assessment.** The processor treats all Pile sources equally. A verb record from a peer-reviewed PubMed paper and one from a Reddit comment carry the same initial weight. OCP's per-source trust vector addresses this.

2. **Template/indicator governance.** The processor's indicator sets are hardcoded TypeScript. There's no pending → approved → rejected workflow. New motifs can't get indicator sets without code changes. OCP's template governance is the right model here.

**And one critical thing from the library schema:**

3. **Derivative order and primary axis as governance inputs.** The processor detects these in Tier C but doesn't use them for promotion decisions. A d0 motif (static pattern) and a d3 motif (generator of generators) require fundamentally different evidence standards. The library schema acknowledges this implicitly; the processor ignores it.

## 2.5 Unified Governance Proposal (Draft)

### Principle: Three Layers, Not Three Systems

Rather than forcing alignment between incommensurable systems, define three governance layers that compose:

```
Layer 1: SOURCE TRUST (from OCP model)
  "How reliable is this evidence source?"
  → Trust vector per source, CTS scoring
  → Applies to all evidence regardless of origin

Layer 2: EVIDENCE STRENGTH (from processor model)
  "How well does this evidence support a motif claim?"
  → Tier A/B/C evaluation pipeline
  → Weighted by source trust from Layer 1

Layer 3: KNOWLEDGE MATURITY (from library schema)
  "Has this motif been sufficiently validated for its claimed tier?"
  → T0→T1→T2→T3 governance tiers
  → Consumes evidence strength weighted by source trust
```

### Unified Confidence Formula

```
motif_confidence(m) = Σ [ evidence_strength(e) × source_trust(s) ] / N
                      for all evidence e from source s supporting motif m
```

Where:
- `evidence_strength(e)` = Tier C model score (or Tier B structural score if Tier C hasn't run)
- `source_trust(s)` = CTS-derived weight for the source (default 0.5 for unscorable sources like Pile bulk data; higher for individually assessed sources)
- `N` = normalisation factor (verb record count, with diminishing returns: `sqrt(count)` to prevent raw volume from dominating)

### Unified Tier Thresholds

| Transition | Domain Count | Source Diversity | Confidence | Special Conditions | Approval |
|-----------|-------------|-----------------|------------|-------------------|----------|
| → T1 | >= 3 | >= 2 distinct sources | >= 0.3 | — | Auto |
| → T2 | >= 5 | >= 3 distinct + triangulated | >= 0.6 | 5 validation conditions; derivative order >= 1 for governance weight | Human (batch) |
| → T3 | >= 8 | >= 4 distinct + triangulated | >= 0.8 | 3+ relationship edges; 2+ of 3 preliminary flags | Human (sovereign) |

**Rationale for changed thresholds:**

- **T1 domain count stays at 3** (processor's value, not schema's 2). Bulk processing noise means 2 domains could be coincidental. 3 provides better signal.
- **T2 domain count lowered from 7 to 5.** The processor's 7 was set for unweighted domain counting. With source trust weighting, 5 well-sourced domains provide equivalent evidence quality to 7 unweighted.
- **T2 confidence lowered from 0.7 to 0.6.** The processor's 0.7 assumed unweighted model scores. With source trust weighting, the effective bar is higher (a score of 0.6 from well-trusted sources requires ~0.8 raw model confidence after trust discounting). This also makes T2 reachable for motifs with partial Tier C coverage.
- **T3 threshold lowered from 0.9 to 0.8.** At 0.9, even exceptional motifs barely qualify. 0.8 with mandatory human sovereignty provides the right balance — the threshold surfaces candidates, the human decides.
- **T3 domain count lowered from 10 to 8.** Combined with source trust weighting, 8 well-sourced domains provides equivalent evidence to 10 unweighted.

### Indicator Set Governance

Import OCP's template governance model for processor indicator sets:

```
1. Atlas proposes indicator set changes (as it does now, but as proposals)
2. Changes enter "pending" state in indicator-sets.ts
3. Adam reviews and approves/rejects
4. Only approved indicator sets are used for Tier A processing
5. Rejection includes reason, stored in governance log
```

This closes the gap where indicator sets were hardcoded without human review — a governance hole in the processor.

### Source Trust for Pile Components

Define baseline trust scores for Pile components, inspired by OCP's adapter-specific scoring:

| Pile Component | Baseline Trust | Rationale |
|---------------|---------------|-----------|
| PubMed Central | 0.7 | Peer-reviewed biomedical literature |
| ArXiv | 0.6 | Pre-print but expert-authored |
| PhilPapers | 0.7 | Curated philosophical literature |
| FreeLaw | 0.6 | Legal opinions (structured, authoritative) |
| StackExchange | 0.4 | Community Q&A, variable quality |
| GitHub | 0.4 | Code + documentation, variable quality |
| Wikipedia | 0.5 | Encyclopedic, community-edited |
| Books3 | 0.5 | Published books, mixed quality |
| OpenWebText2 | 0.3 | Web text, low curation |
| Pile-CC | 0.2 | Common Crawl, minimal curation |
| Other/Unknown | 0.3 | Default conservative estimate |

These are initial estimates. The validation-event mechanism from OCP should be adapted to empirically calibrate these over time.

## 2.6 Motif Library Survivorship

### Motifs That Survive Fresh Scrutiny

**All 9 Tier 2 motifs survive.** Evidence quality is exceptional. Even the conditional Observer-Feedback Loop has 8 top-down domains and explicit gap awareness. The library's self-scrutiny at T2 is rigorous.

**7 of 9 Tier 1 motifs survive as-is:**
- Trust-as-Curation, Reflexive Structural Transition, Boundary Drift, Primitive Self-Reference, Safety-Liveness Duality, Recursive Generativity, Structural Coupling as Ground State

**2 Tier 1 motifs flagged:**
- **Template-Driven Classification** (0.3, 2 internal domains): Should be **demoted to T0** or held at T1 with an explicit "internal-only" flag until external validation is achieved. Using it as evaluation criteria for external corpus is circular.
- **Scaffold-First Architecture** (0.2, 2 internal domains): Same assessment. Should be **demoted to T0** or flagged.

**All 14 Tier 0 motifs survive** as observations pending expansion.

**5 Tier 3 drafts survive** as drafts — none are ready for promotion.

### Connection Graph Assessment

Of 42 documented relationships:
- **High confidence:** Relationships within Tier 3 composition candidates (they were stress-tested during the Tier 3 analysis)
- **Medium confidence:** Complement/tension relationships between T2 motifs (expert-judged but with explicit reasoning)
- **Low confidence:** Any relationship involving T1 or T0 motifs with limited domain coverage

**Recommendation:** Tag each edge with `evidence_source: {expert_judgment | corpus_co-occurrence | metadata_derived}` so downstream consumers (especially the experimental LLM) know what kind of claim each edge represents.

## 2.7 Open Exploration — Cycle 2

### Finding 6: The Indicator Set Is the Real Bottleneck

The processor can only detect 18 motifs. The library has 34. Even if all governance thresholds were perfectly calibrated, 16 motifs are invisible to the processor pipeline. The governance calibration conversation is necessary but not sufficient — indicator set expansion is equally critical.

### Finding 7: Derivative Order Should Inform Governance

The library schema defines derivative orders (d0-d3) but neither the processor nor OCP uses them for governance decisions. A d0 motif (static pattern) should require less evidence for promotion than a d3 motif (generator of generators) because higher-order claims are inherently harder to validate. The unified model should weight derivative order into the threshold:

```
adjusted_threshold = base_threshold × (1 + 0.1 × derivative_order)
```

This means a d3 motif would need ~30% more confidence to promote than a d0 motif.

### Finding 8: The LLM Epistemological Hierarchy Needs Confidence Metadata

The experimental LLM's epistemological hierarchy (D/I/R primitives > motif library > PairedRecords > plain text) treats the motif library as a monolithic authority layer. It should instead carry confidence metadata:
- T2 motifs with > 0.85 confidence: high authority
- T1 motifs with external validation: medium authority  
- T1 motifs with internal-only evidence: low authority (should not outrank well-sourced PairedRecords)
- T0 motifs: informational only, no authority weight

### Finding 9: Is "Unified Governance" the Right Framing?

The data suggests the three systems serve different purposes and should remain distinct layers rather than being unified into a single model. The real need is **interoperability** — agreed interfaces between layers — not unification. The three-layer proposal (2.5) is already moving in this direction. Pushing further toward a single system would lose the specialisation each system provides.

## 2.8 c/i/d Convergence Check — Cycle 2

**c (Cross-Domain Validation):** The three-layer governance model has been validated against all three source systems. Each layer maps to a real function: source trust (OCP), evidence strength (processor), knowledge maturity (library). The model also applies to itself — the analysis of governance is itself a D/I/R process with trust layers. **Score: HIGH.**

**i (Structural Invariance):** The core integration — three composable layers rather than forced unification — is structurally stable under domain substitution. Whether we're evaluating motifs from philosophy, software, or biology, the same three questions apply: is the source trustworthy, is the evidence strong, is the motif mature? **Score: HIGH.**

**d (Non-Derivability):** The three-layer model is not derivable from any single source system. The derivative order governance weighting (Finding 7) is non-obvious — it requires recognising that claim complexity should modulate evidence requirements. The indicator set bottleneck (Finding 6) is not derivable from threshold analysis alone. **Score: HIGH.**

**Cycle 2 Stability:** STABLE. Integration is coherent without losing Cycle 1 distinctions. Conflicts (threshold values, internal-only motifs, indicator coverage) are explicitly listed, not smoothed over. Ready for recursion.

---

# CYCLE 3 — RECURSION (Stress-Test and Refine)

## 3.1 Apply the Model to Itself

The three-layer governance model claims:
1. Source trust should weight evidence
2. Evidence strength should feed governance
3. Knowledge maturity determines authority

Apply to the governance analysis itself:
- **Source trust of this analysis:** High within the Observer project (Atlas has full access, domain knowledge, fresh-eyes mandate). Low outside it (single-analyst, no peer review, no empirical testing).
- **Evidence strength:** High for structural mapping (directly read and compared code). Medium for threshold recommendations (reasoned but not empirically validated). Low for source trust table values (estimated, not calibrated).
- **Knowledge maturity:** DRAFT. Single analysis, no cross-temporal validation, no adversarial testing.

**Self-assessment: The analysis itself is approximately T0-T1.** The structural findings (tripartite system, incommensurable scales, indicator bottleneck) are well-evidenced. The threshold recommendations need empirical validation. The source trust table needs calibration against actual processing results.

## 3.2 Known-Example Stress Test

### Would Dual-Speed Governance still reach T2 under the proposed model?

DSG has:
- 12 domains
- Triangulated (top-down + bottom-up)
- Confidence 1.0 (library) = many high-scoring Tier C evaluations expected
- d2, integrate axis

Under proposed thresholds (T1→T2: 5 domains, 3 sources, 0.6 confidence, 5 conditions):
- Domain count: 12 >= 5 ✓
- Source diversity: multiple PubMed, GitHub, ArXiv sources >= 3 ✓ (with triangulation ✓)
- Confidence: 1.0 >> 0.6 ✓ (even with source trust weighting)
- 5 validation conditions: all satisfied (documented extensively)
- Derivative order adjustment: 0.6 × (1 + 0.1 × 2) = 0.72 → still passes at 1.0

**Result: DSG passes easily.** ✓

### Would a weak motif get filtered?

Scaffold-First Architecture has:
- 2 domains (both internal)
- Not triangulated externally
- Confidence 0.2
- d0, differentiate axis

Under proposed thresholds (T0→T1: 3 domains, 2 sources, 0.3 confidence):
- Domain count: 2 < 3 ✗
- Source diversity: 1 (Observer project only) < 2 ✗
- Confidence: 0.2 < 0.3 ✗

**Result: Scaffold-First correctly stays at T0.** ✓

But wait — it's currently at T1 in the library. Under the proposed model, it would be **demoted from T1 to T0.** This is the right behaviour: the proposed model correctly identifies that a motif with only internal evidence shouldn't have cross-domain status.

### Would Observer-Feedback Loop hold its conditional T2?

OFL has:
- 8 domains (all top-down)
- NOT triangulated (no bottom-up)
- Confidence 0.9
- d1-2, recurse axis

Under proposed thresholds (T1→T2: 5 domains, 3+ sources + triangulated, 0.6 confidence):
- Domain count: 8 >= 5 ✓
- Source diversity: missing triangulation ✗
- Confidence: 0.9 >= 0.6 ✓ (even with derivative order adjustment: 0.6 × 1.15 = 0.69 → still passes)
- 5 conditions: 4/5 pass; adversarial survival (condition 4) requires both top-down AND bottom-up

**Result: OFL correctly blocked from full T2** by triangulation requirement. ✓

This matches the library's current "conditional" status. The proposed model mechanises what was a judgment call.

### Edge case: High-confidence but low-domain motif

Hypothetical: a motif with 3 domains but all from high-trust sources (PubMed, PhilPapers) with Tier C scores of 0.95.

Under source-trust-weighted confidence:
- motif_confidence = avg(0.95 × 0.7, 0.95 × 0.7, 0.95 × 0.7) = 0.665
- T1→T2 threshold: 0.6 × (1 + 0.1 × d) — passes for d0-d1

But domain count: 3 < 5 for T2. **Correctly blocked.** High confidence from few domains shouldn't substitute for breadth. ✓

### Edge case: Many domains but all low-trust sources

Hypothetical: 8 domains all from Pile-CC (trust 0.2) with Tier C scores of 0.8.

Under source-trust-weighted confidence:
- motif_confidence = avg(0.8 × 0.2) = 0.16
- T1→T2 threshold: 0.6 → **fails**

**Correctly blocked.** Volume of low-quality evidence shouldn't substitute for quality. ✓

But wait — T0→T1 threshold is 0.3, and this motif scores 0.16. It would fail even T0→T1. Is this too harsh?

Consideration: if a motif genuinely appears across 8 domains in Common Crawl, the structural signal may be real despite the noisy source. The source trust weight of 0.2 might be too aggressive for Pile-CC.

**Refinement:** Set Pile-CC baseline to 0.3 instead of 0.2, and add a volume bonus: for sources with > 50 verb records, apply `trust × (1 + 0.1 × log10(count/50))`. This gives credit for consistent signal in noisy data without letting volume alone dominate.

Revised: motif_confidence = avg(0.8 × 0.3 × 1.1) ≈ 0.264 — still fails T1 but less aggressively. With 100+ records: 0.8 × 0.3 × 1.2 = 0.288 — approaches threshold. Seems right: a pattern appearing 100+ times in Common Crawl at 0.8 model confidence should be taken seriously, but the source trust appropriately discounts it below the level of peer-reviewed literature.

## 3.3 Unstated Assumptions in the Proposed Model

1. **Assumption: Source trust is static.** The baseline trust table doesn't evolve. In practice, trust should be calibrated by validation events (did motifs from PubMed predict better than motifs from Pile-CC?). Risk: Medium. Mitigation: implement validation-event calibration in Phase 2.

2. **Assumption: Evidence strength (Tier C model score) is well-calibrated.** If the Claude API consistently over- or under-estimates structural match confidence, all downstream governance is affected. Risk: High. Mitigation: calibration set of hand-scored examples (see sandbox protocol).

3. **Assumption: Domain counts from the processor are meaningful.** If the processor maps "PubMed Central" as one domain and "GitHub" as another, but doesn't distinguish PubMed sub-domains (oncology vs. neuroscience), two very different PubMed papers count as same-domain evidence. Risk: Medium. Mitigation: refine source_component granularity.

4. **Assumption: The sqrt(count) normalisation prevents volume dominance.** This is a heuristic, not a principled choice. Risk: Low — can be empirically calibrated.

5. **Assumption: Derivative order is accurately classified.** If Tier C misclassifies d0 as d2, the threshold adjustment gives unearned leniency. Risk: Low for T2 motifs (well-documented), Medium for T0/T1 (less validated).

6. **Assumption: The 5 validation conditions can be automated.** Currently, conditions 1 and 5 check for markdown section presence, not content quality. A motif could have a `## Falsification Conditions` section that says "none identified" and pass the automated check. Risk: Medium. Mitigation: Tier C should evaluate section quality, not just presence.

## 3.4 Sandbox Validation Protocol

### Phase 1: Calibration Set (Before Any Production Changes)

1. **Hand-score 50 verb records.** Adam selects 50 verb records from existing shards (mix of strong/weak/novel matches). For each:
   - Score structural match confidence (0-1)
   - Classify axis and derivative order
   - Judge whether the motif match is genuine, partial, or false

2. **Compare hand scores to Tier C model scores.** Compute:
   - Mean absolute error (target: < 0.15)
   - Rank correlation (target: Spearman's ρ > 0.8)
   - False positive rate at 0.7 threshold (target: < 10%)
   - False negative rate at 0.3 threshold (target: < 5%)

3. **Calibrate source trust weights.** Run the unified confidence formula with and without source trust weighting. Compare to hand scores. If weighting improves correlation, keep it; if not, investigate why.

### Phase 2: Governance Dry Run (Before Changing the Library)

1. **Run the proposed governance thresholds against all 29 processed shards** in read-only mode. Don't change any motif files. Produce:
   - List of all motifs that would change tier under proposed model
   - For each proposed change: old tier, new tier, evidence summary
   - Flag any surprises (motifs promoted/demoted that shouldn't be)

2. **Review with Adam.** The dry run output is the decision document. Adam approves, rejects, or modifies each proposed change.

3. **Check for Matthew effect.** Compare evidence accumulation rates across motifs. If T2 motifs have 100x more verb records than T0 motifs, the indicator set coverage gap is dominating. Measure the gap.

### Phase 3: Controlled Rollout

1. **Apply approved tier changes to library** (one commit per batch, reversible).
2. **Deploy unified confidence formula** to processor governance.
3. **Deploy source trust table** with initial estimates.
4. **Run one complete multi-pass cycle** on a single shard (not all 29). Compare governance outputs to Phase 2 dry run.
5. **If outputs match within tolerance (< 5% tier disagreement):** proceed to remaining shards.
6. **If outputs diverge:** stop, diagnose, report to Adam.

### Phase 4: Ongoing Calibration

1. **Validation events:** Track whether governance-promoted motifs prove useful in downstream work (LLM training, ISC evaluation). Feed back into source trust calibration.
2. **Quarterly review:** Adam reviews governance statistics — promotion rates, rejection rates, evidence distribution.
3. **Indicator set governance:** Implement pending → approved → rejected workflow for new indicator sets.

### "Governance Matching Human Judgment" — Measurable Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Tier agreement (auto-promoted vs. Adam's judgment) | >= 90% | Present all auto-promotions to Adam; count agreements |
| False T2 candidates (sent to review that Adam rejects) | <= 20% | Track rejection rate in batch review |
| Missed T2 candidates (Adam would promote but system doesn't surface) | <= 10% | Adam periodically reviews T1 motifs for missed promotions |
| Confidence calibration (model score vs. hand score) | MAE < 0.15, ρ > 0.8 | Periodic calibration set reviews |
| Time-to-surface (new genuine motif → appears in review queue) | < 3 processing passes | Track pass number when motif first surfaces |

## 3.5 Open Exploration — Cycle 3

### Finding 10: The Governance Process Itself Is a Motif Instance

This governance calibration analysis is an instance of **Progressive Formalization** — it takes amorphous system state (three divergent systems), passes it through stages of increasing structural order (Cycle 1 distinction → Cycle 2 integration → Cycle 3 recursion), and produces a crystallised proposal. The D/I/R framework applies to its own calibration.

It's also an instance of **Observer-Feedback Loop** — the analysis of the motif library changes the framework through which future motifs will be evaluated. The governance model that emerges from this analysis will shape what evidence counts, which changes what motifs get promoted, which changes the library, which feeds back into the governance model.

### Finding 11: The "Two Systems" Framing Was Itself an Assumption

The task assumed two systems needed alignment. The analysis discovered three. This is a meta-level observation: the framing of a calibration problem contains assumptions about what needs calibrating. A D/I/R analysis that only answers the stated questions misses this — the Describe phase must be free to discover that the territory doesn't match the map.

### Finding 12: Indicator Set Governance Is the Highest-Leverage Intervention

All the threshold calibration in the world doesn't help if the processor can only detect 18 of 34 motifs. Expanding and governing indicator sets is more impactful than adjusting confidence thresholds. Priority order:
1. Indicator set governance workflow (import from OCP template model)
2. Indicator sets for remaining T2 motifs (if any lack them)
3. Indicator sets for strong T1 motifs (Reflexive Structural Transition, Safety-Liveness Duality, Boundary Drift)
4. Source trust weighting implementation
5. Threshold adjustment

### Finding 13: The Overall Shape Reduces to a Design Pattern

The finding is: **governance systems that measure different things should be composed as layers, not unified as one system.** Each layer answers a specific question and feeds its answer to the next layer. This is itself an instance of DSG (the slow governance layer constrains the fast evidence-evaluation layer) composed with CPA (each layer is a plugin with a defined interface).

The irreducible complexity that needs to be preserved: **the three confidence metrics measure genuinely different things and should not be collapsed into one number.** Source trust, evidence strength, and knowledge maturity are orthogonal dimensions. The unified formula combines them for threshold checks, but the components should remain inspectable.

## 3.6 c/i/d Convergence Check — Cycle 3

**c (Cross-Domain Validation):** The proposed model was tested against known examples from the motif library (DSG, Scaffold-First, OFL), hypothetical edge cases (high-trust/low-domain, low-trust/high-domain), and applied self-referentially. All tests passed without requiring model changes — only one refinement (Pile-CC trust value). **Score: HIGH.**

**i (Structural Invariance):** The three-layer architecture (source trust → evidence strength → knowledge maturity) remained stable across all stress tests. Substituting different motifs, different source types, and different confidence levels didn't change the model's structure. **Score: HIGH.**

**d (Non-Derivability):** The recursive findings (governance process as Progressive Formalization instance, indicator set governance as highest-leverage intervention) are not derivable from the base systems. They required turning the analysis on itself. **Score: HIGH.**

**Cycle 3 Stability: CONVERGED.** No oscillation detected. The model refined (Pile-CC trust adjustment) but didn't restructure. The c/i/d scores are uniformly high across all three cycles, and Cycle 3 did not introduce instability. The analysis has stabilised.

---

# OUTPUT DELIVERABLES

## Output 1: Side-by-Side Governance Comparison

| Dimension | OCP Scraper | Dataset Processor | Motif Library Schema |
|-----------|-------------|-------------------|---------------------|
| **Confidence metric** | CTS (geometric mean of 6 trust dims) | Tier A/B/C scores (weighted additive) | Domain count + triangulation (discrete additive) |
| **What it measures** | Source reliability | Evidence-motif match strength | Knowledge maturity/breadth |
| **Scale** | 0-1 continuous, multiplicative | 0-1 continuous, weighted sum | 0-1, discrete increments of 0.1/0.2 |
| **Tier/level system** | 5 confidence levels (adapter-specific) | 4 governance tiers (T0-T3) | 4 tiers (T0-T3) |
| **Auto-promotion** | All (deterministic from CTS) | T0→T1 only | T0→T1 only |
| **Human gate** | Templates only | T1→T2 (batch), T2→T3 (sovereign) | T2 and T3 |
| **Evidence types** | Source metadata (stars, citations, bibliography) | Lexical matches, structural scores, model judgments | Domain instances, triangulation events |
| **Graph edges** | Deterministic (metadata-derived) | Statistical (co-occurrence) | Expert-judged (creative analysis) |
| **Source quality** | Per-record CTS | None (all sources equal) | None |
| **Indicator governance** | pending → approved → rejected | Hardcoded (no governance) | N/A |
| **Derivative order** | Not modeled | Detected in Tier C, not used for governance | Required metadata, not used for thresholds |
| **Primary axis** | Not modeled | Detected in Tier C | Required metadata |
| **Federation/multi-vault** | Trust discounting (0.5x default) | None | None |

## Output 2: Motif Library Audit Report

### Summary Statistics
- **Total motifs:** 34 (9 T2, 9 T1, 14 T0, 5 T3 draft)
- **Indicator set coverage:** 18/34 (53%) — processor can detect 18 motifs
- **Triangulation rate at T2:** 8/9 (89%) — OFL awaiting bottom-up
- **Internal-only motifs at T1:** 2/9 (Template-Driven, Scaffold-First)
- **Mean T2 confidence:** 0.93
- **Mean T2 domain count:** 9.7
- **Connection count:** 42 documented relationships

### Per-Motif Assessment (T2)

| Motif | Abbr. | Conf. | Domains | Triang. | d-Order | Axis | Verdict |
|-------|-------|-------|---------|---------|---------|------|---------|
| Dual-Speed Governance | DSG | 1.0 | 12 | Yes | 2 | I | STRONG — no concerns |
| Composable Plugin Architecture | CPA | 0.9 | 7 | Yes | 2 | D | STRONG — no concerns |
| Explicit State Machine Backbone | ESMB | 0.9 | 7 | Yes | 2 | D | STRONG — no concerns |
| Bounded Buffer w/ Overflow | BBWOP | 0.9 | 7 | Yes | 1.5 | D | STRONG — no concerns |
| Idempotent State Convergence | ISC | 1.0 | 10 | Yes | 1 | I | STRONG — exceptional adversarial testing |
| Observer-Feedback Loop | OFL | 0.9 | 8 | Partial | 1-2 | R | CONDITIONAL — needs bottom-up corpus evidence |
| Ratchet w/ Asymmetric Friction | RAF | 0.9 | 12 | Yes | 1 | R | STRONG — no concerns |
| Progressive Formalization | PF | 0.85 | 10 | Yes | 1 | I | STRONG — no concerns |
| Reconstruction Burden | RB | 0.9 | 14 | Yes | 1 | D | STRONG — highest domain count |

### Per-Motif Assessment (T1)

| Motif | Conf. | Domains | Verdict |
|-------|-------|---------|---------|
| Trust-as-Curation | 0.7 | 8 | OK — needs alien-domain expansion for T2 |
| Reflexive Structural Transition | 0.8 | 10 | STRONG — ready for T2 validation |
| Boundary Drift | 0.9 | 9 | NEEDS WORK — adversarial testing pending ("just things change?") |
| Structural Coupling as Ground State | 0.6 | 6 | WEAK — conceptually deep, empirically thin |
| Recursive Generativity | 0.5 | 5 | OK — d3 needs dedicated review |
| Template-Driven Classification | 0.3 | 2 | **FLAG: Demote to T0 — internal-only evidence** |
| Scaffold-First Architecture | 0.2 | 2 | **FLAG: Demote to T0 — internal-only evidence** |
| Primitive Self-Reference | 0.7 | 7 | OK — solid |
| Safety-Liveness Duality | 0.7 | 7 | STRONG — mathematical universality via Alpern-Schneider |

### Connection Validity Assessment

| Edge Source | Count (est.) | Confidence | Recommendation |
|------------|-------------|------------|----------------|
| Expert judgment (creative analysis sessions) | ~35 | Medium | Tag as `evidence_source: expert_judgment` |
| Tier 3 composition analysis | ~5 | Medium-High | Tag as `evidence_source: expert_judgment` |
| Corpus co-occurrence (processor) | ~2 | Low (early) | Tag as `evidence_source: corpus_co-occurrence` |
| Metadata-derived (OCP) | Unknown | Low | Tag as `evidence_source: metadata_derived` |

## Output 3: Unified Governance Proposal

### Architecture: Three Composable Layers

```
┌─────────────────────────────────────────┐
│  Layer 3: KNOWLEDGE MATURITY            │
│  T0 → T1 → T2 → T3                     │
│  Consumes: weighted evidence            │
│  Produces: tier assignments, review      │
│           queues, sovereignty flags      │
├─────────────────────────────────────────┤
│  Layer 2: EVIDENCE STRENGTH             │
│  Tier A (lexical) → B (structural)      │
│       → C (model)                       │
│  Consumes: source-trust-weighted input  │
│  Produces: motif_confidence per record  │
├─────────────────────────────────────────┤
│  Layer 1: SOURCE TRUST                  │
│  CTS per source / baseline per corpus   │
│  Consumes: raw source metadata          │
│  Produces: trust weight per evidence    │
└─────────────────────────────────────────┘
```

### Specific Numbers

**Unified confidence formula:**
```
motif_confidence(m) = Σ[evidence_strength(e) × source_trust(s)] / sqrt(N)
```

**Governance thresholds:**

| Transition | Domain Count | Source Diversity | Base Confidence | d-Order Adjustment | Approval |
|-----------|-------------|-----------------|----------------|-------------------|----------|
| → T1 | >= 3 | >= 2 distinct | >= 0.3 | None | Auto |
| → T2 | >= 5 | >= 3 + triangulated | >= 0.6 | × (1 + 0.1 × d) | Human (batch) |
| → T3 | >= 8 | >= 4 + triangulated | >= 0.8 | × (1 + 0.1 × d) | Human (sovereign) |

**Source trust baseline table:**

| Source Category | Trust | Examples |
|----------------|-------|---------|
| Peer-reviewed literature | 0.7 | PubMed, PhilPapers |
| Pre-prints / expert-authored | 0.6 | ArXiv, FreeLaw |
| Curated encyclopedic | 0.5 | Wikipedia, SEP (via OCP) |
| Community-generated | 0.4 | StackExchange, GitHub |
| Minimally curated web | 0.3 | OpenWebText2, Pile-CC, Books3 |
| OCP-scraped (CTS available) | CTS value directly | GitHub/arXiv/SEP via OCP |

### Implementation Priority

1. **Indicator set governance** — import OCP template model (highest leverage)
2. **Indicator sets for uncovered T2/T1 motifs** — expand from 18 to 25+
3. **Source trust table** — implement in evidence aggregator
4. **Unified confidence formula** — replace simple averaging
5. **Threshold adjustment** — update tier-promoter.ts constants
6. **Edge tagging** — add evidence_source metadata to all graph edges
7. **Derivative order governance weighting** — implement d-order adjustment
8. **Validation event tracking** — adapt from OCP for empirical calibration

## Output 4: Sandbox Validation Protocol

(Detailed in Section 3.4 above)

**Summary:**
1. **Phase 1 — Calibration:** Hand-score 50 verb records, compare to model, calibrate source trust
2. **Phase 2 — Dry Run:** Run proposed governance in read-only against 29 shards, review with Adam
3. **Phase 3 — Controlled Rollout:** Apply changes, test on 1 shard, then expand
4. **Phase 4 — Ongoing Calibration:** Validation events, quarterly review, indicator governance

**Success criteria:** >= 90% tier agreement with Adam's judgment, <= 20% false T2 candidates, MAE < 0.15 on confidence calibration.

## Output 5: c/i/d Stability Report

| Metric | Cycle 1 (Distinction) | Cycle 2 (Integration) | Cycle 3 (Recursion) |
|--------|----------------------|----------------------|---------------------|
| **c (Cross-Domain)** | HIGH — three systems mapped independently | HIGH — three-layer model validated across all source systems | HIGH — model tested against known examples, edge cases, self-reference |
| **i (Structural Invariance)** | HIGH — governance question stable within each system | HIGH — three-layer composition stable under domain substitution | HIGH — no structural changes under stress testing |
| **d (Non-Derivability)** | HIGH — tripartite structure, Matthew effect | HIGH — derivative order governance, indicator bottleneck | HIGH — recursive self-application findings |
| **Stability** | STABLE | STABLE | CONVERGED |
| **Refinements** | — | — | Pile-CC trust: 0.2 → 0.3; volume bonus for noisy sources |

**Trajectory:** Monotonic convergence. No oscillation. Each cycle refined without restructuring. The model stabilised in 3 cycles — no additional cycles required.

## Output 6: Explicit Assumptions

| # | Assumption | Risk | What Breaks If Wrong |
|---|-----------|------|---------------------|
| 1 | Source trust is meaningful and measurable | Medium | If PubMed is no more reliable than Pile-CC for motif detection, the entire weighting layer is noise |
| 2 | Tier C model scores correlate with structural reality | High | All governance downstream of model evaluation is miscalibrated |
| 3 | Domain counts from source_component are meaningful | Medium | Promotion thresholds lose their intended meaning |
| 4 | sqrt(N) normalisation prevents volume dominance | Low | Large-volume low-quality sources dominate smaller high-quality ones |
| 5 | Derivative order is accurately classified | Medium | d-order governance adjustment applies incorrectly |
| 6 | 5 validation conditions can be partially automated | Medium | Automated checks pass motifs that fail qualitative review |
| 7 | Indicator sets are the primary detection bottleneck | Low | Coverage expansion has less impact than expected |
| 8 | The three-layer architecture is the right decomposition | Medium | Some other decomposition serves better; discovered during sandbox testing |
| 9 | Confidence metrics across systems are truly incommensurable | Low | A valid mapping exists that we missed; unified formula unnecessary |
| 10 | The motif library's self-assessed tiers are approximately correct | Low | Fresh-eyes audit would reveal systematic over- or under-rating |

## Output 7: Open Questions (Require Empirical Testing or Adam's Decision)

1. **Should Template-Driven Classification and Scaffold-First Architecture be demoted to T0?** Both have only internal Observer project evidence. Proposed: yes. Requires Adam's decision.

2. **Should derivative order modulate governance thresholds?** Proposed: yes, with 10% per d-order. Requires Adam's judgment on the magnitude.

3. **What is the right source trust weight for Pile-CC?** Proposed: 0.3 (revised from initial 0.2). Requires empirical calibration.

4. **Should T2 domain count threshold be 5 or 7?** Proposed: 5 (with source trust weighting). Requires validation against the calibration set.

5. **Should the experimental LLM carry per-motif confidence metadata?** Proposed: yes. Requires architecture decision.

6. **Should graph edges carry evidence_source tags?** Proposed: yes. Requires schema change and backfill.

7. **Who hand-scores the calibration set?** The 50-record scoring requires domain expertise and time commitment.

8. **Should the processor's indicator sets go through governance?** Proposed: yes (import OCP template model). Requires workflow implementation.

9. **Should the confidence formula use sqrt(N) or ln(N) normalisation?** Both are reasonable. Requires empirical comparison.

10. **How should the processor handle motifs without indicator sets?** Currently invisible. Options: (a) Tier C blind evaluation only, (b) expand indicator sets, (c) both.

## Output 8: Unexpected Findings

1. **Three systems, not two.** The task framed this as OCP vs. processor alignment. The motif library schema is a third governance system with its own rules that partially overlap and partially conflict with both.

2. **The confidence scales are incommensurable.** They measure fundamentally different things (source quality, evidence strength, knowledge maturity). No linear mapping exists.

3. **The indicator set is the real bottleneck.** 18/34 motifs have indicator sets. Threshold calibration without coverage expansion has limited impact.

4. **The Matthew effect in motif evidence accumulation.** Well-described motifs get better indicator sets, find more evidence, raise confidence — a self-reinforcing cycle that may suppress novel motif discovery.

5. **The adapter-specific confidence bias in OCP.** SEP can reach "foundational"; GitHub/arXiv max at "tested." This creates systematic domain bias in OCP-sourced evidence.

6. **The governance calibration process is itself a motif instance** (Progressive Formalization and Observer-Feedback Loop). The analysis participates in the system it analyses.

7. **"Unified governance" is the wrong framing.** The data suggests composable layers, not unification. The three systems serve different purposes and should remain distinct with defined interfaces.

8. **Derivative order should be a governance input.** Higher-order structural claims (d2, d3) require more evidence than lower-order claims (d0, d1). Neither system currently implements this.

9. **Two T1 motifs are effectively internal-only.** Template-Driven Classification and Scaffold-First Architecture should not serve as evaluation criteria for external corpus until externally validated.

10. **The OCP scraper has no tier system at all.** The task description projected tier language onto a system that uses confidence levels — a 5-point scale, not a 4-stage maturity model.

---

# Appendix: Key File Locations

| System | Component | Path |
|--------|-----------|------|
| OCP | CTS computation | `01-Projects/ocp-scraper/src/record/trust.ts` |
| OCP | Trust vector weights | `01-Projects/ocp-scraper/src/types/trust-vector.ts` |
| OCP | Confidence levels | `01-Projects/ocp-scraper/src/record/assembler.ts` (GitHub), `src/record/arxiv.ts`, `src/record/sep.ts` |
| OCP | Template governance | `01-Projects/ocp-scraper/src/template/types.ts` |
| OCP | Graph edges | `01-Projects/ocp-scraper/src/store/index.ts` |
| OCP | Federation | `01-Projects/ocp-scraper/src/federation/config.ts` |
| Processor | Tier promoter | `01-Projects/dataset-processor/src/governance/tier-promoter.ts` |
| Processor | Evidence aggregator | `01-Projects/dataset-processor/src/governance/evidence-aggregator.ts` |
| Processor | Motif library reader | `01-Projects/dataset-processor/src/governance/motif-library-reader.ts` |
| Processor | Governance types | `01-Projects/dataset-processor/src/governance/types.ts` |
| Processor | Tier A (lexical) | `01-Projects/dataset-processor/src/filter/lexical-engine.ts` |
| Processor | Indicator sets | `01-Projects/dataset-processor/src/filter/indicator-sets.ts` |
| Processor | Tier B (structural) | `01-Projects/dataset-processor/src/tier-b/structural-scorer.ts` |
| Processor | Tier C (model) | `01-Projects/dataset-processor/src/tier-c/model-evaluator.ts` |
| Library | Schema | `02-Knowledge/motifs/_SCHEMA.md` |
| Library | Index | `02-Knowledge/motifs/MOTIF_INDEX.md` |
| Library | Algebra spec | `02-Knowledge/architecture/axiomatic-motif-algebra-v02-spec-20260311.md` |

---

*Analysis completed 2026-03-31. Three D/I/R cycles, c/i/d convergence achieved. DRAFT status — proposes, Adam decides.*
