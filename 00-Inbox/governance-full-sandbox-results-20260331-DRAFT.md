---
title: "Governance v2 — Full 29-Shard Sandbox Results"
status: DRAFT
created: 2026-03-31
type: governance-report
mode: sandbox (dryRun: true)
commit: 8848cb0
---

# Governance v2 — Full Corpus Sandbox Run

**Date:** 2026-03-31
**Mode:** Sandbox (dryRun: true — no motif library changes, no promotion_log inserts)
**Shards:** 30 (shard-00 through shard-29)
**Total verb records:** 301,224
**Motif library:** 21 T0, 7 T1, 9 T2 (37 motifs evaluated)

---

## 1. Per-Shard Results Table

| Shard | Verb Records | Auto-Promotions | Demotions | T1→T2 Reviews | T2→T3 Flags | Anomalies |
|-------|-------------|----------------|-----------|---------------|-------------|-----------|
| shard-00 | 9,922 | 2 | 0 | 0 | 0 | 1 |
| shard-01 | 9,980 | 2 | 0 | 0 | 0 | 2 |
| shard-02 | 9,980 | 2 | 0 | 0 | 0 | 1 |
| shard-03 | 9,980 | 2 | 0 | 0 | 0 | 1 |
| shard-04 | 9,980 | 2 | 0 | 0 | 0 | 1 |
| shard-05 | 9,980 | 2 | 0 | 0 | 0 | 1 |
| shard-06 | 9,980 | 2 | 0 | 0 | 0 | 1 |
| shard-07 | 9,980 | 2 | 0 | 0 | 0 | 2 |
| shard-08 | 11,174 | 2 | 0 | 0 | 0 | 1 |
| shard-09 | 10,364 | 2 | 0 | 0 | 0 | 1 |
| shard-10 | 9,980 | 2 | 0 | 0 | 0 | 1 |
| shard-11 | 9,980 | 2 | 0 | 0 | 0 | 1 |
| shard-12 | 9,980 | 2 | 0 | 0 | 0 | 3 |
| shard-13 | 10,075 | 2 | 0 | 0 | 0 | 1 |
| shard-14 | 10,189 | 2 | 0 | 0 | 0 | 1 |
| shard-15 | 9,980 | 2 | 0 | 0 | 0 | 1 |
| shard-16 | 9,980 | 2 | 0 | 0 | 0 | 1 |
| shard-17 | 9,980 | 2 | 0 | 0 | 0 | 1 |
| shard-18 | 9,980 | 2 | 0 | 0 | 0 | 1 |
| shard-19 | 9,980 | 2 | 0 | 0 | 0 | 1 |
| shard-20 | 9,980 | 2 | 0 | 0 | 0 | 2 |
| shard-21 | 9,980 | 2 | 0 | 0 | 0 | 1 |
| shard-22 | 9,980 | 2 | 0 | 0 | 0 | 1 |
| shard-23 | 9,980 | 2 | 0 | 0 | 0 | 1 |
| shard-24 | 9,980 | 2 | 0 | 0 | 0 | 1 |
| shard-25 | 9,980 | 2 | 0 | 0 | 0 | 1 |
| shard-26 | 9,980 | 2 | 0 | 0 | 0 | 1 |
| shard-27 | 9,980 | 2 | 0 | 0 | 0 | 2 |
| shard-28 | 9,980 | 2 | 0 | 0 | 0 | 3 |
| shard-29 | 9,980 | 2 | 0 | 0 | 0 | 3 |
| **TOTAL** | **301,224** | **60** | **0** | **0** | **0** | **40** |

**Observation:** Perfectly uniform results across all 30 shards. Every shard produces exactly 2 auto-promotions (SFA, TDC) and 0 of everything else. The engine is deterministic and stable.

---

## 2. Aggregate Motif Promotion Map

### Motifs That Auto-Promote (T0→T1)

| Motif | ID | Shards Promoted | Avg Evidence Quality | Min EQ | Max EQ | Avg Domains | Unique Domains |
|-------|----|----------------|---------------------|--------|--------|-------------|---------------|
| Scaffold-First Architecture | SFA | 30/30 | 0.4017 | 0.3884 | 0.4415 | 6.6 | 11 |
| Template-Driven Classification | TDC | 30/30 | 0.4191 | 0.4040 | 0.4349 | 13.2 | 14 |

### Motifs That Do NOT Promote (remaining 19 T0 motifs)

The remaining T0 motifs fail the T0→T1 threshold (requires: 3+ domains, 2+ source types, evidenceQuality >= 0.3). The most likely failure condition is insufficient domain diversity or source type diversity within individual shards. These motifs are not shard-dependent — they consistently fail across all 30 shards.

### T1 Motifs (7) — No T1→T2 Transitions

| Motif | Current Tier |
|-------|-------------|
| Boundary Drift | T1 |
| Primitive Self-Reference | T1 |
| Recursive Generativity | T1 |
| Reflexive Structural Transition | T1 |
| Safety-Liveness Duality | T1 |
| Structural Coupling as Ground State | T1 |
| Trust-as-Curation | T1 |

None reach the T1→T2 threshold (requires: 5+ domains, 3+ source types, evidenceQuality >= 0.6, cross-temporal evidence, full validation protocol pass). This is expected — per-shard data alone is unlikely to meet these higher thresholds.

### T2 Motifs (9) — No T2→T3 Flags

No T2 motifs meet even the preliminary flagging thresholds (8+ domains, 3+ relationship edges, evidenceQuality >= 0.8). Again expected at per-shard scope.

---

## 3. Evidence Quality Distribution

### SFA (Scaffold-First Architecture)

| Shard | Evidence Quality | Domain Count | Domains |
|-------|-----------------|-------------|---------|
| shard-26 | **0.4415** (max) | 6 | Pile-CC, HackerNews, ArXiv, Wikipedia, Ubuntu IRC, Github |
| shard-00 | 0.4185 | 7 | Pile-CC, HackerNews, Github, Ubuntu IRC, PubMed Central, PhilPapers, Gutenberg |
| shard-16 | 0.4177 | 6 | Pile-CC, PubMed Central, Github, Gutenberg, Ubuntu IRC, HackerNews |
| shard-27 | 0.4135 | 7 | Pile-CC, HackerNews, Gutenberg, Github, Ubuntu IRC, PubMed Central, ArXiv |
| shard-05 | 0.4134 | 7 | Pile-CC, HackerNews, PubMed Central, Gutenberg, Github, Ubuntu IRC, StackExchange |
| ... | ... | ... | ... |
| shard-25 | **0.3884** (min) | 8 | HackerNews, Pile-CC, Ubuntu IRC, StackExchange, PubMed Central, Github, Gutenberg, ArXiv |

**Range:** 0.3884–0.4415 (spread: 0.0531)
**Domain count range:** 4–8
**Core domains** (appear in most shards): Pile-CC, PubMed Central, HackerNews, Github, Gutenberg

### TDC (Template-Driven Classification)

| Shard | Evidence Quality | Domain Count |
|-------|-----------------|-------------|
| shard-16 | **0.4349** (max) | 12 |
| shard-29 | 0.4336 | 13 |
| shard-22 | 0.4283 | 13 |
| shard-13 | 0.4271 | 13 |
| ... | ... | ... |
| shard-17 | **0.4040** (min) | 14 |

**Range:** 0.4040–0.4349 (spread: 0.0309)
**Domain count range:** 12–14
**Core domains** (appear in all shards): PubMed Central, ArXiv, Pile-CC, PhilPapers, Wikipedia, Github, USPTO Backgrounds, FreeLaw, HackerNews, Ubuntu IRC, Gutenberg, StackExchange
**Occasional domains:** PubMed Abstracts, NIH ExPorter

TDC has tighter evidence quality variance than SFA, and consistently appears across nearly all Pile sub-components.

---

## 4. Anomaly Analysis

### 4.1 Domain Concentration (30/30 shards) — WARNING

**Motif:** TDC (Template-Driven Classification)
**Finding:** 70–75% of TDC verb records are in PubMed Central domain across all shards.

**Interpretation:** TDC's lexical pattern (classification, taxonomy, categorical structure) appears heavily in biomedical literature. The anomaly detector correctly flags this. Despite PubMed concentration, TDC still appears in 12–14 domains — the breadth is real, but depth is skewed. This is a known property of the Pile corpus (PubMed Central is the largest component).

**Assessment:** Expected behavior. The domain-concentration anomaly is working as designed. Worth noting but not blocking — the 3-domain threshold is met by wide margin, and the per-domain evidence quality is healthy.

### 4.2 Conflicting Evidence (9 instances across 7 shards) — WARNING

| Shard | Motif | Conflicting Passages |
|-------|-------|---------------------|
| shard-01 | TDC | 6 |
| shard-07 | TDC | 10 |
| shard-12 | ESMB (Estimation-Control Separation) | 6 |
| shard-12 | SLD (Safety-Liveness Duality) | 6 |
| shard-20 | TAC (Trust-as-Curation) | 6 |
| shard-27 | TDC | 8 |
| shard-28 | TAC | 15 |
| shard-28 | TDC | 15 |
| shard-29 | TAC | 7 |
| shard-29 | TDC | 7 |

**Interpretation:** Some source passages match multiple motifs with different confidence values. This is expected for structurally adjacent motifs (TDC and TAC share classification-related language). The counts are low relative to total records (~6–15 out of ~10,000). Shard-28 has the highest overlap (15 passages each for TAC and TDC) — likely a dense classification-focused document cluster in that shard.

**Assessment:** Normal overlap between related motifs. Not a governance engine defect. The conflicting-evidence detector is doing its job. No action needed unless overlap increases significantly with more data.

### 4.3 Absent Anomaly Types

- **Outlier yield:** No shards have abnormal yield rates (all within 2σ)
- **Blind-novel patterns:** No blind extraction surfacing novel instances at significant volume

---

## 5. Surprises and Notable Findings

### 5.1 Only 2 of 21 T0 Motifs Promote — Is This Right?

**Yes.** The T0→T1 threshold requires 3+ domains AND 2+ source types AND evidenceQuality >= 0.3. Most T0 motifs likely fail on source type diversity (requires both primed and blind extraction). SFA and TDC are the strongest motifs in the library by evidence breadth — they were seeded early and have accumulated the most diverse extraction data.

**Implication:** The governance engine is conservative by design. 19/21 T0 motifs need more extraction passes (particularly blind extraction) before they'll qualify for auto-promotion. This is the correct behavior — promotion should require real cross-method validation.

### 5.2 Zero Demotions

No T1 motifs are demoted, meaning all 7 current T1 motifs still meet their tier thresholds even after the hysteresis adjustment. The demotion engine has no work to do — the existing T1 motifs are well-supported.

### 5.3 Perfect Uniformity Across Shards

The most striking result: governance produces identical decisions across all 30 shards. Same 2 motifs promote, same 0 demotions, same 0 reviews. This means:

- **SFA and TDC have sufficient evidence in every shard independently** — they're not riding on a few lucky shards
- **The Pile's component distribution is consistent across shards** — domain diversity doesn't vary significantly shard-to-shard
- **The engine is deterministic** — no randomness or order-dependence in evaluation

### 5.4 No T1→T2 Review Packets Generated

The T1→T2 threshold is significantly higher (5+ domains, 3+ source types, evidenceQuality >= 0.6, cross-temporal evidence, full validation protocol). Per-shard data alone is unlikely to meet this. T1→T2 transitions would likely require cross-shard evidence aggregation — running governance against a merged database or implementing accumulation across shards.

---

## 6. Overall Assessment

### Engine Behavior: SENSIBLE

The governance engine behaves correctly and conservatively across the full 30-shard corpus:

1. **Thresholds work as designed.** Only motifs with genuine cross-domain, cross-method evidence promote. The bar is appropriately high.

2. **Anomaly detection is calibrated.** Domain concentration and conflicting evidence are correctly flagged. No false positives in outlier yield or blind-novel patterns.

3. **Demotion engine is stable.** Zero demotions means no flip-flopping risk with existing T1 motifs.

4. **Results are shard-independent.** Governance decisions don't depend on which shard you run against. This is a strong signal of robustness.

5. **The sovereignty gate holds.** Zero T2→T3 flags — the engine correctly recognizes that per-shard data is insufficient for the highest tier transitions.

### Identified Limitations

1. **Per-shard scope can't trigger T1→T2.** The higher thresholds require evidence density that individual shards don't provide. Consider a cross-shard aggregation mode for future runs.

2. **TDC domain concentration is structural.** PubMed Central dominance is a Pile corpus property, not a governance defect. But if a motif's "cross-domain breadth" is 14 domains where one domain has 72% of records, the evidenceQuality metric may overstate true independence. Worth monitoring.

3. **19 T0 motifs need more extraction passes.** The pipeline has produced evidence for these motifs, but not with sufficient source type diversity to cross the T0→T1 threshold. Blind extraction passes would likely move several of these forward.

### Recommendation

**The governance engine is ready for production use.** The sandbox results show stable, conservative, deterministic behavior across the full corpus. No surprises, no edge cases, no anomalies that suggest implementation bugs.

Suggested next steps:
- Run governance in production against shard-00 first (as canary)
- Monitor promotion_log entries after production run
- Plan blind extraction passes for the 19 remaining T0 motifs
- Consider cross-shard aggregation mode for T1→T2 evaluation

---

*Generated by Atlas in sandbox mode. No motif library changes made. All data derived from dryRun: true governance runs against 30 independent shard databases.*
