---
title: "Governance v2 — Full Sandbox Results"
status: DRAFT
created: 2026-03-31
type: governance-report
scope: all available shards (2 of 29)
---

# Governance v2 — Full Sandbox Results

**Date:** 2026-03-31
**Mode:** Sandbox (`dryRun: true`) — no motif files modified, no promotion_log entries inserted
**Engine version:** Governance v2 (commit `8848cb0`)
**Shards available:** 2 of 29 (shard-00, shard-02)

> **Note:** Only 2 shard databases exist in `output/`. Shards 01 and 03–29 have not been processed by the pipeline. Template files exist for shards 00–02, but shard-01 has no database. This report covers the full available corpus.

---

## 1. Per-Shard Results

| Shard | Verb Records | Auto-Promotions (T0→T1) | Demotions | T1→T2 Review Packets | T2→T3 Flags | Anomalies |
|-------|-------------|-------------------------|-----------|---------------------|-------------|-----------|
| shard-00 | 9,922 | 2 (TDC, SFA) | 0 | 0 | 0 | 1 |
| shard-02 | 10,000 | 2 (TDC, SFA) | 0 | 0 | 0 | 1 |
| **Total** | **19,922** | **2 unique motifs** | **0** | **0** | **0** | **2** |

### Auto-Promotion Details

| Motif | Shard | Domains | Source Types | Evidence Quality | Verb Records |
|-------|-------|---------|-------------|-----------------|-------------|
| **TDC** (Template-Driven Classification) | shard-00 | 13 | 13 | 0.421 | 1,949 |
| **TDC** | shard-02 | 11 | 11 | 0.357 | 346 |
| **SFA** (Scaffold-First Architecture) | shard-00 | 7 | 7 | 0.418 | 13 |
| **SFA** | shard-02 | 4 | 4 | 0.341 | 12 |

T0→T1 thresholds: domains ≥ 3, source types ≥ 2, evidence quality ≥ 0.3. Both motifs clear all thresholds in both shards.

### Anomalies

| Shard | Type | Motif | Severity |
|-------|------|-------|----------|
| shard-00 | domain-concentration | TDC | warning |
| shard-02 | domain-concentration | TDC | warning |

**TDC domain concentration:** PubMed Central dominates TDC records — 72% in shard-00 (1,411/1,949), 75% in shard-02 (259/346). This is expected: TDC is a d0 classification pattern and PubMed's structured abstracts are a natural fit. The concentration is a valid signal, not a bug — but it means TDC's cross-domain strength is shallower than the raw domain count suggests.

---

## 2. Aggregate Motif Promotion Map

### Motifs That Promote (T0→T1)

| Motif | Promotes In | Consistent? | Notes |
|-------|-----------|-------------|-------|
| **TDC** | shard-00, shard-02 | Yes — consistent across both shards | Strongest signal: 13 domains in shard-00, 11 in shard-02. Massive record counts (1,949 + 346). Domain concentration warning in both. |
| **SFA** | shard-00, shard-02 | Yes — consistent across both shards | Leaner evidence: 13 + 12 records. Clears quality threshold (0.418 / 0.341). No anomalies. |

### Motifs That Don't Promote But Have Evidence

These are already at T1 or T2 (manually curated before the processor), so no T0→T1 promotion applies. None triggered demotion.

| Motif | Current Tier | Shard-00 Evidence | Shard-02 Evidence | Notes |
|-------|-------------|------------------|------------------|-------|
| **TAC** (Trust-as-Curation) | T1 | 14 domains, 6,953 records, q=0.432 | 13 domains, 959 records, q=0.405 | Highest volume motif. Would massively qualify for promotion if it were T0. |
| **ESMB** (Explicit State Machine Backbone) | T2 | 10 domains, 177 records, q=0.409 | 7 domains, 25 records, q=0.386 | Strong cross-domain presence |
| **CPA** (Composable Plugin Architecture) | T2 | 9 domains, 258 records, q=0.401 | 8 domains, 38 records, q=0.358 | Consistent |
| **BBWOP** (Bounded Buffer With Overflow Policy) | T2 | 8 domains, 27 records, q=0.404 | 3 domains, 5 records, q=0.315 | Weaker in shard-02 |
| **SLD** (Safety-Liveness Duality) | T1 | 7 domains, 44 records, q=0.401 | 6 domains, 12 records, q=0.336 | Consistent |
| **DSG** (Dual-Speed Governance) | T2 | 6 domains, 61 records, q=0.378 | 6 domains, 17 records, q=0.345 | Only motif with conflicting evidence (shard-00) |
| **PF** (Progressive Formalization) | T2 | 6 domains, 43 records, q=0.419 | 3 domains, 6 records, q=0.353 | Weaker in shard-02 |
| **BD** (Boundary Drift) | T1 | 4 domains, 9 records, q=0.403 | 1 domain, 2 records, q=0.336 | Drops significantly in shard-02 |
| **PSR** (Primitive Self-Reference) | T1 | 4 domains, 8 records, q=0.416 | 2 domains, 3 records, q=0.382 | Weaker in shard-02 |
| **RST** (Reflexive Structural Transition) | T1 | 3 domains, 15 records, q=0.405 | 2 domains, 6 records, q=0.369 | Below T0→T1 domain threshold in shard-02 |
| **RG** (Recursive Generativity) | T1 | 3 domains, 5 records, q=0.376 | 0 records | No evidence in shard-02 |
| **ISC** (Idempotent State Convergence) | T2 | 3 domains, 4 records, q=0.387 | 2 domains, 3 records, q=0.317 | Low record counts for a T2 motif |
| **RAF** (Ratchet with Asymmetric Friction) | T2 | 3 domains, 3 records, q=0.376 | 0 records | Zero evidence in shard-02 |
| **OFL** (Observer-Feedback Loop) | T2 | 2 domains, 4 records, q=0.412 | 1 domain, 1 record, q=0.321 | Very sparse for a T2 motif |
| **SCGS** (Structural Coupling as Ground State) | T1 | 1 domain, 5 records, q=0.416 | 0 records | Single domain in shard-00, absent in shard-02 |

### Motifs With Zero Verb Records (Both Shards)

17 motifs have no verb records in either shard. These are all T0 motifs without `abbreviation` values in their frontmatter — the pipeline only matches by abbreviated ID, so motifs without abbreviations are invisible to the evidence aggregator.

---

## 3. Surprises and Observations

### 3a. No Demotions — Expected

No demotions occurred because the demotion engine only targets motifs that were **auto-promoted by the processor** (checked via `promotion_log`). All current T1/T2 motifs were manually curated — their promotion_log tables are empty. This is correct behaviour: the engine should not demote manually curated motifs based on incomplete processor evidence.

### 3b. No T1→T2 Review Packets — Expected

No T1 motifs met all 5 validation protocol conditions for T2 review. The bottleneck is likely the file-content checks (VP1: `## Structural Description` section, VP5: `## Falsification Conditions` section) and the evidence quality threshold (0.6 base, adjusted up for derivative order). Most evidence quality scores are in the 0.33–0.43 range — well below the 0.6 threshold.

### 3c. No T2→T3 Flags — Expected

T2→T3 requires 8+ domains, 3+ relationship edges, or 0.8+ evidence quality. No motif_graph_edges exist in either shard (both tables have 0 rows), so the edge threshold is unreachable. Domain counts reach 10 (ESMB) but evidence quality stays around 0.4, far below 0.8.

### 3d. TDC and SFA Consistently Promote

Both motifs promote in both shards with identical conclusions. TDC is the clearest signal in the corpus — 13+ domains, nearly 2,000 records in shard-00. SFA is leaner but consistent.

### 3e. DSG Conflicting Evidence (shard-00 only)

Dual-Speed Governance shows `hasConflictingEvidence: true` in shard-00 but not shard-02. This means some source passages matching DSG also match other motifs with higher confidence. Worth investigating if DSG overlaps conceptually with another motif in that shard.

### 3f. BBWOP, PF, BD Shard-Sensitive

Some motifs show strong evidence in shard-00 but much weaker in shard-02:
- **BBWOP:** 8 domains → 3 domains
- **PF:** 6 domains → 3 domains
- **BD:** 4 domains → 1 domain

This is expected with only 2 shards — different Pile slices have different domain distributions. Shard-02 has heavy StackExchange, PubMed Abstracts, and Github content that shard-00 lacks, while shard-00 is heavier on FreeLaw and Gutenberg.

### 3g. RAF and RG Disappear in Shard-02

Ratchet with Asymmetric Friction and Recursive Generativity have zero records in shard-02. Both are specialised d1/d3 motifs — their absence in a single shard is not alarming but should be watched across more shards.

### 3h. ISC and OFL Are Sparse for T2 Motifs

ISC (canonical T2) has only 4 records across 3 domains in shard-00, and 3 records in 2 domains in shard-02. OFL (validated T2) has 4 and 1 records respectively. These were manually promoted based on evidence outside the Pile — the processor's evidence is supplementary, not contradictory. No demotion risk because they weren't auto-promoted.

### 3i. 17 Invisible Motifs

The 17 T0 motifs without abbreviations produce zero evidence. This is a pipeline gap, not a governance gap — the pipeline needs abbreviations added to match these motifs. Governance correctly ignores them (no evidence = no promotion).

---

## 4. Overall Assessment

### The governance engine is behaving sensibly.

**Correct behaviours observed:**
1. **Auto-promotion works.** TDC and SFA consistently clear T0→T1 thresholds across both shards. The promotions are data-driven: 3+ domains, 2+ source types, evidence quality above 0.3.
2. **Demotion hysteresis is conservative.** No false demotions of manually curated motifs. The `wasAutoPromoted` guard is functioning correctly.
3. **Domain concentration anomaly fires appropriately.** TDC's PubMed dominance is flagged, giving reviewers context on the evidence distribution.
4. **Higher-tier gates hold.** T1→T2 and T2→T3 correctly produce nothing — the evidence quality across the corpus (~0.35–0.43) is below T2 thresholds (0.6+), and no graph edges exist yet.
5. **Sandbox mode is clean.** No filesystem writes, no promotion_log inserts, digests routed to sandbox subdirectory.

**Limitations of this run:**
1. **Only 2 of 29 shards processed.** The full corpus would provide more confidence in cross-shard consistency.
2. **No graph edges.** The `motif_graph_edges` table is empty in both shards, blocking the relationship-based T2→T3 pathway.
3. **17 motifs invisible.** Pipeline abbreviation gap means nearly half the motif library has no evidence path.
4. **Evidence quality ceiling ~0.43.** No motif reaches the 0.6 threshold for T2 review. This may be a calibration issue in the evidence scoring, or it may reflect the Pile's nature — lower-quality signal is expected from broad crawl data.

### Recommendations

1. **Approve TDC and SFA for production T0→T1 promotion** — results are consistent and well-evidenced across both shards.
2. **Process remaining shards** before running production governance to get fuller cross-shard coverage.
3. **Add abbreviations** to the 17 T0 motifs that lack them, then reprocess to get evidence.
4. **Investigate evidence quality ceiling** — if the scoring consistently caps at ~0.43, the T1→T2 threshold of 0.6 may be unreachable without calibration.
5. **Populate motif_graph_edges** to enable the relationship-based T2→T3 pathway.

---

*Generated by Atlas in sandbox mode. No motif library changes made.*
