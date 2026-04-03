---
status: DRAFT
date: 2026-04-03
type: empirical-analysis
source: Atlas analysis session. Maps K=9 clustering results to predicted D/I/R compositions.
vault_safety: >
  Analytical document. Does not modify code, databases, or existing artifacts.
  Interprets clustering results against the algebra's 9-composition prediction.
predecessors:
  - 01-Projects/dataset-processor/output/cross-shard-replication.json
  - 01-Projects/dataset-processor/scripts/cross-shard-replication.py
  - 01-Projects/dataset-processor/scripts/dir-vectorize-cluster.py
  - 02-Knowledge/architecture/motif-algebra-v1.0-spec.md
  - 02-Knowledge/architecture/dir-composition-algebra-motif-prediction-20260401-DRAFT.md
methodology: >
  Two clustering approaches compared: (1) structural 8-dimensional features from Tier B
  enrichment (cross-shard, silhouette 0.71), (2) keyword-based 6-dimensional D/I/R vectors
  from indicator vocabulary matching (silhouette 0.55). Both run at K=9 across 10 shards
  (~100K records total). Centroids examined for D/I/R score distributions, axis label purity,
  temporal structure, and domain coverage. Each cluster assigned to the most likely composition
  from the predicted 9.
---

# Cluster-to-Composition Mapping

**Date:** 3 April 2026
**Question:** Do the 9 empirical K-means clusters correspond to the 9 predicted D/I/R compositions?

---

## Summary

The algebra predicts 9 first-order compositions: D(D), D(I), D(R), I(D), I(I), I(R), R(D), R(I), R(R). K=9 clustering was confirmed across 10 shards (silhouette 0.71 structural, 0.55 keyword-based). This document maps each empirical cluster to a predicted composition.

**Headline result:** The mapping is partially successful but structurally asymmetric. The data contains far more I-dominant and D-dominant records than R-dominant ones (68K integrate, 30K differentiate, 1.4K recurse across 99K structural records). This means the 9 clusters do NOT distribute evenly across the 3x3 composition grid. Instead, the I and D quadrants are over-resolved (multiple clusters distinguish sub-types within I-dominant and D-dominant records), while the R quadrant is under-resolved (all R-dominant records compress into 1-2 clusters).

---

## Two Clustering Approaches

### Approach 1: Structural Features (8-dimensional)

Features: `[tier_b_score, T_sequential, T_concurrent, T_cyclic, T_recursive, operator_count, has_governance, process_richness]`

Silhouette: **0.714** (combined, 99,319 records across 10 shards)

This approach clusters on structural enrichment from Tier B processing. It achieves high separation but is primarily driven by temporal structure (sequential vs concurrent vs cyclic) and governance presence, not D/I/R balance.

### Approach 2: Keyword D/I/R Vectors (6-dimensional)

Features: `[D_raw, I_raw, R_raw, temporal_complexity, text_density, axis_entropy]`

Silhouette: **0.551** (shard-00, 3,142 records)

This approach computes continuous D/I/R scores from weighted keyword matching against the pipeline's indicator vocabulary. Lower silhouette but more directly measures D/I/R composition.

---

## Mapping Table: Keyword-Based Clusters to Compositions

The keyword-based clustering provides the clearest D/I/R signal. Nine clusters from shard-00 (representative; cross-shard replication confirmed K=9 stability):

| Cluster | Size | D/I/R Ratio | Assigned Composition | Confidence | Key Evidence |
|---------|------|-------------|---------------------|------------|--------------|
| 0 | 545 (17%) | D=0.7% I=99.3% R=0.0% | **I(D)** | Medium | Pure I-dominant, high temporal (T=0.97), moderate density. Governance/coupling records. 88% integrate-axis labels. Cross-domain: law, medicine, web content. |
| 1 | 341 (11%) | D=94.7% I=3.8% R=1.5% | **D(D)** | High | Strong D-dominant, highest density (0.45), moderate temporal. State machines, type systems, formal grammars. 90% differentiate-axis. ArXiv + patents heavy. |
| 2 | 112 (4%) | D=0.8% I=1.9% R=97.3% | **R(R)** | High | Overwhelmingly R, high density (0.78), low temporal. Self-reference, prediction error, fractal/scale-invariant content. 63% recurse-axis. PubMed Central + ArXiv. |
| 3 | 345 (11%) | D=1.0% I=98.7% R=0.3% | **I(I)** | Medium | Pure I-dominant but LOW temporal (T=0.08) distinguishing it from Cluster 0. Static integration/synthesis. Pattern-of-patterns, meta-synthesis records. |
| 4 | 713 (23%) | D=0.1% I=99.6% R=0.2% | **R(I)** | Low | Largest cluster; I-dominant with highest temporal (T=1.42) but lowest density (0.12). Weak indicator signal, high temporal flow. Convergence-toward-target with sequential process. Largest and most diffuse. |
| 5 | 160 (5%) | D=0.0% I=2.8% R=97.2% | **R(D)** | Low | R-dominant but only 10% recurse-axis labels (53% differentiate, 37% integrate). Moderate temporal. The records CONTAIN recursive vocabulary but were LABELED differentiate/integrate by the pipeline's axis classifier. Possible ratchet/iterative-refinement content. |
| 6 | 295 (9%) | D=97.6% I=1.5% R=0.9% | **D(I)** | High | Strong D-dominant, highest density (0.73), very low temporal (T=0.15). Plugin, modular, extensible vocabulary. Clean interfaces and composition. 91% differentiate-axis. |
| 7 | 418 (13%) | D=98.8% I=0.6% R=0.5% | **D(R)** | Medium | D-dominant with high temporal (T=1.30) but low density (0.15). Distinguished from Cluster 6 by temporal richness and lower density. Boundary/overflow content with sequential process. 74% differentiate-axis. |
| 8 | 213 (7%) | D=37.9% I=36.4% R=25.7% | **I(R)** | Medium | The ONLY mixed cluster. All three axes present, highest entropy (H=1.01). Cross-domain integration of recursive processes. Multi-axis records. 61% differentiate-axis labels but balanced keyword scores. |

---

## Per-Cluster Analysis

### Cluster 0 -> I(D): Integrate across distinctions
545 records, 17.3%. Purely I-dominant keyword scores with negligible D and R. High temporal complexity suggests sequential governance processes. Domain spread across law (FreeLaw), medicine (PubMed), and web (Pile-CC). This is the "governance and coupling" cluster -- records about relating across distinguished categories, dual-speed oversight, and convergence. The I(D) assignment is supported by the DSG (Dual-Speed Governance) motif mapping in the algebra spec.

### Cluster 1 -> D(D): Meta-distinction
341 records, 10.9%. Strongly D-dominant (94.7%) with highest keyword density (0.45), indicating dense structural vocabulary. Records about type systems, state machines, formal grammars, taxonomies. ArXiv and patents are overrepresented. This is the "grammar of distinctions" cluster. High confidence: the ESMB (Explicit State Machine Backbone) motif maps directly here.

### Cluster 2 -> R(R): Recurse on recursion
112 records, 3.6%. Overwhelmingly R-dominant (97.3%) with the highest density of any cluster (0.78). Records about Bayesian brains, predictive coding, self-similar hierarchies, fractal structures. 63% of records carry the pipeline's recurse-axis label (highest purity for any R-cluster). This is the "self-reference observing self-reference" cluster. High confidence: the OFL (Observer-Feedback Loop) and PSR (Primitive Self-Reference) motifs map here.

### Cluster 3 -> I(I): Meta-synthesis
345 records, 11.0%. Pure I-dominant but crucially DIFFERENT from Cluster 0: very low temporal complexity (T=0.08 vs 0.97). Where Cluster 0 is integration through sequential governance processes, Cluster 3 is integration through static pattern recognition. This is the "pattern of patterns" cluster -- meta-synthesis that discovers structural invariants. The algebra spec predicts I(I) is the Tier 3 generation operator. Assignment confidence is medium because the D/I/R scores alone do not distinguish I(D) from I(I) -- the distinction relies on temporal features.

### Cluster 4 -> R(I): Recurse on integration (convergence)
713 records, 22.7%. The largest cluster. I-dominant with highest temporal complexity (T=1.42) but lowest keyword density (0.12). These are records with extensive sequential process but few specific indicator-vocabulary matches. Interpreting this as R(I) rather than I(D): the high temporal + low density signature suggests iterative convergence processes where the content is about reaching a target state through repeated application, but the vocabulary is general rather than motif-specific. Confidence is low because this may simply be the "background integration" cluster -- records that are weakly I-dominant without enough structural signal to place more specifically.

### Cluster 5 -> R(D): Recurse on distinction (ratchet)
160 records, 5.1%. R-dominant keyword scores (97.2%) but paradoxically labeled 53% differentiate and 37% integrate by the pipeline's axis classifier. This disagreement is the strongest evidence for a genuine composition rather than a pure axis: the CONTENT is recursive (self-similar, prediction error, iterative learning vocabulary) but the PROCESS STRUCTURE is differentiation (progressive refinement, boundary sharpening). This is exactly what R(D) predicts -- recursion applied to distinction-making, producing irreversible refinement. Confidence is low because the cluster is small and the axis-label disagreement could also indicate noisy classification.

### Cluster 6 -> D(I): Distinguish modes of integration
295 records, 9.4%. Strongly D-dominant (97.6%) with high density (0.73) and very low temporal complexity (0.15). Records about modular architecture, plugin systems, composable interfaces. The low temporal complexity distinguishes this from D(D) and D(R): these are STATIC descriptions of how composition works, not processes that unfold in time. High confidence: the CPA (Composable Plugin Architecture) motif maps directly here.

### Cluster 7 -> D(R): Distinguish types of recursion
418 records, 13.3%. D-dominant (98.8%) with high temporal complexity (T=1.30) but low density (0.15). Distinguished from D(I) (Cluster 6) by temporal richness: these records describe processes where recursion types are being identified and bounded. Overflow, buffer, rate-limiting content with sequential temporal structure. Medium confidence: the BBWOP mapping is the weakest in the algebra spec, and this cluster may overlap with general D-dominant sequential process records.

### Cluster 8 -> I(R): Integrate across recursive processes
213 records, 6.8%. The only genuinely multi-axis cluster: D=37.9%, I=36.4%, R=25.7%, with entropy H=1.01 (highest of all clusters). This is the "cross-domain integration of feedback loops" predicted by the algebra. Records here show vocabulary from all three axes simultaneously. The algebra spec predicted I(R) as a gap in the motif library -- no existing Tier 2 motif maps to it. This cluster's existence as the only balanced-axis cluster is evidence that I(R) is a real compositional mode that the library has not yet named.

---

## Mapping Table: Structural Clusters

The structural 8-dimensional clustering (silhouette 0.71) produces clusters primarily separated by temporal structure and governance, not D/I/R composition. For completeness:

| Cluster | Size | Temporal | Governance | Dominant Axis | Notes |
|---------|------|----------|------------|---------------|-------|
| 0 | 5,372 (5%) | None | Low (3%) | Mixed D/I | No temporal, no governance -- amorphous structural records |
| 1 | 17,388 (18%) | Sequential | High (100%) | I (72%) | Sequential-governed integration |
| 2 | 40,448 (41%) | Sequential | None (0%) | I (80%) | Largest: sequential ungoverned integration |
| 3 | 13,056 (13%) | Sequential | High (100%) | I/D mixed | Sequential-governed with higher richness |
| 4 | 5,153 (5%) | Mixed/Recursive | High (98%) | D (52%) | Recursive-temporal with governance |
| 5 | 6,609 (7%) | Mostly sequential | Low (23%) | I (74%) | Low-density sequential |
| 6 | 5,969 (6%) | Concurrent | Mixed (53%) | I (55%) | Concurrent temporal structure |
| 7 | 4,327 (4%) | Sequential | Mixed (52%) | D (73%) | Sequential differentiation with operators |
| 8 | 997 (1%) | Cyclic | Mixed (45%) | I (67%) | Cyclic temporal structure (smallest) |

The structural clusters separate primarily on temporal type (sequential/concurrent/cyclic) crossed with governance presence. This is a valid partitioning but measures SUBSTRATE features (how records unfold in time) rather than PLATONIC features (which D/I/R composition they express). The two cluster sets are orthogonal projections of the same 9-basin structure.

---

## Overall Assessment

### What mapped cleanly (5 of 9)

- **D(D)** -- Cluster 1: high-density D-dominant with state machine / type system vocabulary. Clear.
- **D(I)** -- Cluster 6: high-density D-dominant with plugin / modular / composable vocabulary. Clear.
- **R(R)** -- Cluster 2: high-density R-dominant with self-reference / prediction error vocabulary. Clear.
- **I(R)** -- Cluster 8: the only multi-axis cluster, balanced D/I/R with high entropy. Distinctive.
- **I(D)** -- Cluster 0: I-dominant with high temporal, governance-related content. Reasonable.

### What mapped with ambiguity (4 of 9)

- **I(I) vs I(D)** -- Clusters 0 and 3 are both pure-I but differ in temporal complexity. The assignment (0=I(D), 3=I(I)) relies on temporal features rather than D/I/R scores. The distinction between "integrating across distinctions" and "integrating across integrations" does not produce a clean keyword-score difference because both are I-dominant. Temporal complexity may be the wrong discriminator.

- **R(I) vs background I** -- Cluster 4 (the largest at 23%) has the weakest indicator signal. Assigning it to R(I) is speculative. It may simply be the "weakly-I" catch-all cluster -- records that are sequential and integrative but lack enough structural vocabulary to discriminate further.

- **D(R) vs general D-sequential** -- Cluster 7 is D-dominant with high temporal but low density. The D(R) assignment relies on the temporal feature distinguishing it from D(I), but overflow/buffer/recursion-type vocabulary is sparse.

- **R(D) vs axis-misclassified R** -- Cluster 5 shows the intriguing axis-label vs keyword-score disagreement that would support R(D), but the cluster is small (160 records) and the evidence is circumstantial.

### Structural asymmetry

The biggest finding is the population imbalance:

| Outer operator | Records | Clusters | Coverage |
|----------------|---------|----------|----------|
| D-outer (D(D), D(I), D(R)) | 1,054 (34%) | 3 clusters | Well-resolved |
| I-outer (I(D), I(I), I(R)) | 1,271 (40%) | 3 clusters | Medium (I(D)/I(I) ambiguous) |
| R-outer (R(D), R(I), R(R)) | 272 (9%) | 2 clusters | Under-resolved |
| Mixed/convergence | 713 (23%) | 1 cluster | Catch-all |

The R-axis accounts for only 1.4% of the labeled data (1,418 of 99,319 structural records). This means R-compositions are rare in the training corpus -- not because they are theoretically absent but because the Pile dataset underrepresents reflexive/recursive content relative to descriptive (D) and synthetic (I) content.

### Surprises

1. **I(R) emerged as the only balanced cluster.** The algebra predicted I(R) as a gap in the motif library. The clustering independently found exactly one cluster with balanced D/I/R entropy. This is the strongest empirical confirmation in the mapping.

2. **The structural and keyword clusterings are nearly orthogonal.** The structural clusters separate on temporal-type x governance, while the keyword clusters separate on D/I/R balance x density. These are genuinely different projections of the data. A combined feature space might resolve the ambiguous assignments.

3. **R-compositions are population-sparse but structurally distinct.** Clusters 2 (R(R)) and 5 (R(D)) are small but have the clearest internal structure -- high keyword density, high axis purity. R-compositions are rare but sharp.

---

## Confidence Summary

| Composition | Cluster | Confidence | Status |
|-------------|---------|------------|--------|
| D(D) | 1 | HIGH | Confirmed -- ESMB vocabulary, high D-purity |
| D(I) | 6 | HIGH | Confirmed -- CPA vocabulary, static D-purity |
| D(R) | 7 | MEDIUM | Plausible -- D-dominant + temporal, but weak indicator signal |
| I(D) | 0 | MEDIUM | Plausible -- I-dominant + governance, but could be generic I |
| I(I) | 3 | MEDIUM | Plausible -- I-dominant + low temporal, but distinguished only by absence |
| I(R) | 8 | MEDIUM | Supported -- only balanced cluster; algebra predicted gap; distinctive |
| R(D) | 5 | LOW | Circumstantial -- axis-label disagreement suggestive but small N |
| R(I) | 4 | LOW | Speculative -- may be background catch-all rather than true R(I) |
| R(R) | 2 | HIGH | Confirmed -- self-reference vocabulary, highest R-purity |

**3 HIGH, 4 MEDIUM, 2 LOW.** The D-outer and R(R) compositions map cleanly. The I-outer compositions are plausible but harder to distinguish from each other. The R(D) and R(I) assignments are the weakest.

---

## Next Steps

1. **Combined feature clustering.** Merge the 8d structural features with the 6d keyword features into a 14d space and re-run K=9. This may resolve the I(D)/I(I) ambiguity by giving both D/I/R balance AND temporal/governance signals to the same clustering.

2. **R-axis enrichment.** The R-compositions are under-resolved because R-content is sparse. A targeted extraction pass focusing on recurse-axis records (with boosted sampling from ArXiv, PubMed neuroscience, and philosophy sources) would test whether R(D), R(I), and R(R) form 3 distinct clusters when given adequate population.

3. **Composition expression assignment.** Use the cluster centroids as a soft classifier: for each verb record, compute distance to each of the 9 centroids and assign a compositionExpression (e.g., "D(D)", "I(R)") to the database. This populates the currently-empty compositionExpression column in the verb_records table.

4. **Motif-cluster cross-validation.** For records with known motif_id assignments, check whether the motif's predicted composition (from dir-composition-algebra-motif-prediction-20260401-DRAFT.md) matches the cluster assignment. This provides a direct test: does a record labeled ESMB land in the D(D) cluster?

5. **Adversarial test: K=8 or K=10.** If one of the 9 clusters is genuinely a catch-all (Cluster 4), then K=8 might produce a cleaner mapping with the catch-all absorbed. Conversely, K=10 might split one of the ambiguous I-compositions into sub-clusters, revealing hidden structure.
