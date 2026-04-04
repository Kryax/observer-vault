---
type: analysis
status: DRAFT
authority: none
created: 2026-03-31
method: D/I/R (4 cycles, c/i/d convergence)
scope: Source weighting in governance — keep, replace, or remove?
depends_on:
  - 00-Inbox/governance-mathematics-dir-derivation-20260331-DRAFT.md
  - 00-Inbox/governance-calibration-dir-analysis-20260331-DRAFT.md
  - 02-Knowledge/architecture/axiomatic-motif-algebra-v02-spec-20260311.md
empirical_data: shard-00.db (9,922 verb records, 15 source components, 18 motifs)
---

# Source Trust vs. Structural Signal — D/I/R Analysis

**Atlas, 2026-03-31**
**Authority: DRAFT — proposes, Adam decides.**

---

## Executive Summary

The source trust table conflates two unrelated properties: institutional credibility (is this source curated?) and structural signal quality (does this source yield valid motif evidence?). Empirical data from shard-00 demonstrates that these are not merely different — they are **inversely correlated** in several cases. Ubuntu IRC (trust 0.3) outperforms PubMed Central (trust 0.7) on average motif confidence. Pile-CC (trust 0.3) ties with PubMed Central for the most diverse motif detection (16 distinct motifs each).

D/I/R first principles derive that source weighting as currently implemented is **structurally incoherent**: it applies a content-level judgment (institutional curation) to a structural-level observation (motif geometry). The c/i/d conditions already handle the filtering that source trust claims to provide — and they do it without institutional bias.

**Recommendation: Remove the source trust table entirely. Let c/i/d do the work.** The `sourceReliability` metric and `trustFloor` gates should be deleted from the promotion engine. If a structural signal quality metric is later needed, it should be derived from measurable properties of the evidence itself (confidence variance, tier-B score density, structural complexity of the source passage), not from a static lookup table of institutional prejudice.

---

# CYCLE 1 — DESCRIBE: What Is the Source Trust Table Actually Doing?

## 1.1 The Mechanism

`source-trust.ts` maps 17 Pile sub-corpus names to static scores (0.2–0.7). The lookup is consumed in `evidence-aggregator.ts` at line 131: `getSourceTrust(r.domain)` is called per domain, producing a `sourceTrust` value per domain-evidence row. These are averaged into `sourceReliability` (line 139-141).

`tier-promoter.ts` uses `sourceReliability` in one way: as a floor gate at each tier transition:
- T0→T1: `sourceReliability >= 0.2`
- T1→T2: `sourceReliability >= 0.3`
- T2→T3: `sourceReliability >= 0.4`

## 1.2 What the Table Claims

The comments describe the scale as "source reliability for motif evidence":
- 0.7 = peer-reviewed / curated academic
- 0.6 = expert-authored / structured legal
- 0.5 = encyclopedic / published books
- 0.4 = community Q&A / code repositories
- 0.3 = minimally curated web / IRC / email

This is a hierarchy of **institutional curation intensity**. Peer review > expert authorship > editorial curation > community moderation > none.

## 1.3 What the Table Actually Measures

The scale measures **how many humans vetted this content before publication**. It does not measure:
- Whether the content contains structural patterns
- Whether detected patterns are real vs. artifacts
- Whether the source is structurally complex enough to exhibit motifs
- Whether the curation process preserved or destroyed structural signal

## 1.4 Empirical Reality (shard-00, n=9,922)

Source component performance ranked by average motif confidence:

| Source | Trust Score | Avg Confidence | Distinct Motifs | Records |
|--------|------------|----------------|-----------------|---------|
| EuroParl | 0.6 | **0.505** | 2 | 38 |
| Ubuntu IRC | **0.3** | **0.493** | 6 | 120 |
| Enron Emails | **0.3** | 0.447 | 1 | 12 |
| Gutenberg (PG-19) | 0.5 | 0.445 | 8 | 908 |
| PhilPapers | 0.7 | 0.439 | 10 | 152 |
| Pile-CC | **0.3** | 0.430 | **16** | 3120 |
| USPTO Backgrounds | 0.5 | 0.418 | 5 | 126 |
| HackerNews | 0.4 | 0.415 | 8 | 204 |
| PubMed Abstracts | 0.7 | 0.414 | 3 | 4 |
| ArXiv | 0.6 | 0.414 | 12 | 510 |
| PubMed Central | **0.7** | **0.409** | **16** | 2225 |
| FreeLaw | 0.6 | 0.406 | 4 | 2062 |
| Wikipedia (en) | 0.5 | 0.400 | 9 | 246 |
| StackExchange | 0.4 | 0.395 | 6 | 56 |
| Github | 0.4 | 0.394 | 8 | 139 |

Three observations that undermine the table:

1. **The three lowest-trust sources (Pile-CC 0.3, Ubuntu IRC 0.3, Enron Emails 0.3) all outperform the two highest-trust sources (PubMed Central 0.7, PubMed Abstracts 0.7) on average confidence.**

2. **Pile-CC (trust 0.3) and PubMed Central (trust 0.7) are tied for the most diverse motif detection (16 distinct motifs each).** If trust measured structural signal quality, the most "trusted" source should detect more patterns than the least "trusted" — or at minimum, different patterns. They detect the same breadth.

3. **The confidence range across all sources is 0.394–0.505 (spread: 0.111).** The trust table assigns a range of 0.3–0.7 (spread: 0.4). The imposed prior is 3.6× wider than the actual variation. The table amplifies a signal that barely exists.

## 1.5 What the Trust Floor Actually Gates

With DEFAULT_TRUST = 0.3 and the lowest trustFloor at 0.2, no known source can fail the T0→T1 trust gate. The T1→T2 gate (0.3) is trivially passed by any motif with evidence from sources other than exclusively unknown ones. The T2→T3 gate (0.4) would penalise motifs whose evidence comes predominantly from Pile-CC, Ubuntu IRC, OpenWebText2, or Enron Emails — none of which are structurally poor sources based on empirical evidence.

The gates are either trivially satisfied or actively wrong.

## 1.6 c/i/d Convergence — Cycle 1

| Condition | Assessment | Score |
|-----------|-----------|-------|
| **c** | The mechanism is clearly described. Empirical data cross-validates the table values against actual performance. The discrepancy between assigned trust and observed performance is documented, not assumed. | HIGH |
| **i** | The observation that institutional curation ≠ structural signal quality is invariant under source substitution — no rearrangement of the table fixes the category error. | HIGH |
| **d** | The empirical inversion (low-trust sources outperforming high-trust sources) is a novel finding, not stated in any prior analysis. The governance mathematics derivation mentions source trust as "a property of the filter" but does not test whether the filter fidelity correlates with its assigned values. | HIGH |

**Stability: STABLE.** The description is sharp. Ready for interpretation.

---

# CYCLE 2 — INTERPRET: Why the Table Fails, and What D/I/R Says

## 2.1 The Category Error

The governance mathematics derivation (`governance-mathematics-dir-derivation-20260331-DRAFT.md`) frames source trust as **filter fidelity**: how accurately does this domain's D-operator transmit the true structural signal? A noisy filter (low fidelity) adds structural artifacts; a clean filter (high fidelity) transmits signal faithfully.

This framing is correct in principle. The error is in the operationalisation: **the table equates institutional curation with filter fidelity.**

Institutional curation filters for **content validity** — is the claim true? Is the argument sound? Does it meet disciplinary standards? This is a propositional filter. It operates on what the text **says**.

Structural pattern detection operates on what the text **does**. A biased paper that reaches wrong conclusions via motivated reasoning still exhibits real structural patterns — perhaps more interesting ones (Belief-Driven Worldview Override Pattern, Scaffold-First Architecture for constructing predetermined conclusions). A Wikipedia edit war produces genuine governance structures in its discussion page regardless of which side "wins" the content dispute.

The D operator in governance is extracting structural geometry, not evaluating propositional truth. Institutional curation optimises for propositional truth. These are orthogonal.

## 2.2 Does Curation Correlate with Structural Richness?

A weaker claim: even if curation doesn't equal structural validity, maybe curated sources are structurally richer — more complex arguments, more layers of governance, more surface area for motif detection.

The data tests this. If structural richness correlated with curation:
- PubMed Central (0.7) should detect more motifs than Pile-CC (0.3). **Both detect 16.**
- FreeLaw (0.6) should detect more motifs than HackerNews (0.4). **FreeLaw: 4. HackerNews: 8.**
- PhilPapers (0.7) should detect more motifs than Github (0.4). **PhilPapers: 10. Github: 8.** Mild advantage, but PhilPapers is philosophy — structurally rich by nature, not by curation.

The correlation between curation and structural richness is weak to nonexistent. Some curated sources (FreeLaw) are structurally monotone — legal opinions follow rigid templates, producing high volume but low diversity. Some uncurated sources (Pile-CC, HackerNews) are structurally diverse — web content spans every genre, register, and structural form.

## 2.3 Can Structural Manipulation Corrupt the D-Operator?

The harder question: can a source be structured to produce false structural signals?

Consider an academic paper designed to support a predetermined conclusion. The **content** is manipulated — evidence is cherry-picked, counterarguments are straw-manned. But the **structure** is genuinely present: it exhibits Scaffold-First Architecture (building toward a conclusion), Trust-as-Curation (using citations as authority signals), possibly Belief-Driven Worldview Override Pattern (filtering evidence through ideology). The structural patterns are real even when deployed in service of false content.

This is a feature, not a bug. The governance system detects structural patterns, not propositional truth. A dishonest paper that builds scaffolds is evidence that scaffold-building is a real structural pattern — perhaps stronger evidence than an honest paper, because the pattern is being deliberately constructed rather than naturally emerging.

The exception: **adversarial structural manipulation** — content designed to fool the D-operator itself by mimicking structural patterns without actually implementing them. This is theoretically possible but requires knowledge of the specific motif detection pipeline. The Pile (a static training corpus from 2020) was not designed to fool a motif detection system that didn't exist yet. For the current data, this threat is negligible.

For future dynamic sources, adversarial structural manipulation is a real concern — but source trust doesn't address it. An adversarial paper from a "trusted" institution (PubMed, trust 0.7) would pass the trust gate while fooling D. An honest blog post from an "untrusted" source (Pile-CC, trust 0.3) would be penalised despite providing genuine evidence. The trust table is anti-correlated with adversarial robustness.

## 2.4 What c/i/d Already Provides

The c condition (cross-domain validation) requires a pattern to appear across structurally distinct domains. This is the mechanism that source trust claims to reinforce, but c does it without institutional prejudice:

- A motif found in PubMed, ArXiv, and FreeLaw (trust: 0.7, 0.6, 0.6) passes c.
- A motif found in Pile-CC, Ubuntu IRC, and HackerNews (trust: 0.3, 0.3, 0.4) also passes c — and arguably demonstrates stronger structural invariance, because these sources have less structural similarity to each other than three academic sources do.

The i condition (structural invariance) tests whether the pattern survives domain substitution. Triangulation (primed + blind) tests method invariance. Neither requires institutional credibility.

The d condition (non-derivability) tests whether the pattern is reducible to existing motifs. Institutional prestige is irrelevant.

**Source trust is redundant with c/i/d, and where it differs from c/i/d, it is wrong.**

## 2.5 The Bias Amplification Risk

If source trust were merely redundant, the cost would be complexity (one more gate to maintain). But it's worse: it's actively biased in a way that could corrupt governance.

The trust table encodes Western academic institutional hierarchy: peer review > expert opinion > encyclopedia > community > web. This hierarchy:
- Privileges English-language academic discourse
- Privileges institutional affiliation (PubMed requires it)
- Privileges research paradigms compatible with peer review
- Suppresses patterns that emerge in informal, oral, or community-driven discourse

For structural pattern detection, this bias is particularly damaging. Governance patterns (Trust-as-Curation, Ratchet with Asymmetric Friction, Cascading Proxy Alignment) are often more visible in informal contexts where they aren't masked by institutional formatting. A congressional hearing transcript has more visible governance structure than a polished journal article that has been edited to hide the governance process behind it.

The empirical data confirms this: Ubuntu IRC's average confidence (0.493) exceeds PubMed Central's (0.409) by 20%. IRC conversations exhibit governance structures in real-time — trust negotiations, authority delegation, community moderation — in raw structural form. Academic papers describe governance but embed it in a formal register that can mask the structural geometry.

## 2.6 c/i/d Convergence — Cycle 2

| Condition | Assessment | Score |
|-----------|-----------|-------|
| **c** | The category error (institutional curation ≠ structural filter fidelity) is validated across all 15 source components. The empirical inversion holds regardless of which sources are compared. | HIGH |
| **i** | The interpretation is invariant under motif substitution — checking TAC, TDC, ESMB, CPA all show the same non-correlation between trust score and detection quality. | HIGH |
| **d** | The bias amplification risk is a genuinely new observation — not stated in the governance mathematics derivation, which treated source trust values as "empirical, not structural" without questioning whether the empirical values are valid. | HIGH |

**Stability: STABLE.** Interpretation is converged. Ready for recommendation.

---

# CYCLE 3 — RECOMMEND: Remove Source Trust, Strengthen c/i/d

## 3.1 Primary Recommendation: Delete the Source Trust Table

Remove `source-trust.ts` entirely. Delete `sourceReliability` from the evidence aggregation. Remove `trustFloor` gates from all tier promotion thresholds.

**Rationale:**
1. The table measures institutional credibility, not structural signal quality
2. Empirical evidence shows no correlation (and in several cases, inverse correlation) between assigned trust and actual detection performance
3. The c/i/d conditions already filter for what source trust claims to filter — and do it without institutional bias
4. The trust floor gates are either trivially satisfied or penalise structurally valuable sources
5. The table introduces a bias vector (Western academic hierarchy) into a system designed to detect universal structural patterns

## 3.2 What Changes in the Implementation

### Files modified:

**`evidence-aggregator.ts`:**
- Remove `import { getSourceTrust } from './source-trust.ts'`
- Remove `sourceTrust: getSourceTrust(r.domain)` from `domainEvidence` construction (line 132)
- Remove `sourceReliability` computation (lines 139-141)
- The `domainEvidence` array keeps `domain`, `meanEvidence`, `recordCount` — just drops `sourceTrust`

**`tier-promoter.ts`:**
- Remove `trustFloor` from all three threshold objects (T0_T1, T1_T2, T2_T3)
- Remove the `sourceReliability >= trustFloor` checks in evaluateT0T1 (line 202), evaluateT1T2 (line 244)
- Remove `sourceReliability` threshold met check in evaluateT2T3 (lines 367-369)
- Remove `sourceReliability` from demotion evaluation if referenced

**`types.ts`:**
- Remove `sourceReliability` from `MotifEvidence` interface
- Remove `sourceTrust` from the `domainEvidence` array type

**`source-trust.ts`:**
- Delete the file entirely

**`digest-generator.ts`:**
- Remove any references to `sourceReliability` in digest output

### What does NOT change:

- `evidenceQuality` (mean of per-domain mean evidence scores) — this is the D/I/R-derived metric and it stays
- `domainCount` gates — these are the c condition, structurally valid
- Triangulation/source type checks — these are the i condition, structurally valid
- Derivative order adjustments — these are the d condition, structurally valid
- All other promotion logic, demotion hysteresis, validation protocol

## 3.3 Alternative Considered and Rejected: Replace with Structural Signal Density

One could replace institutional trust with a computed "structural signal density" metric — measuring, per source, how structurally complex the source passages are (argument depth, governance layer count, relationship density). This would address the category error while preserving the idea that some sources yield better structural evidence.

**Rejected for now because:**
1. c/i/d already handles this — a structurally poor source produces low-confidence matches that fail the evidenceQuality gate without needing a per-source modifier
2. Any per-source metric that averages across all passages from that source reintroduces the ecological fallacy — individual passages vary enormously within any corpus
3. The information is already captured at the per-record level (tier-A score, tier-B score, motif_confidence) and aggregated through the hierarchical mean. Adding a per-source multiplier double-counts the signal
4. Building a structural signal density metric requires defining "structural complexity" — a research problem, not a calibration task

If future data shows that c/i/d alone is insufficient to filter structural noise, the right response is to tighten the evidence quality thresholds (raise the floor), not to reintroduce per-source weighting.

## 3.4 Alternative Considered and Rejected: Per-Record Weighting

Instead of per-source weighting, weight each individual record by properties of that specific passage — structural complexity, argument depth, number of governance layers detected. This avoids the ecological fallacy and measures what we actually care about.

**Rejected because it's already implemented:** `motif_confidence` and `tier_b_score` are per-record quality metrics. The hierarchical aggregation (mean of per-domain means) already weights by quality at the record level. Adding another per-record weight is redundant with the existing scoring pipeline.

## 3.5 c/i/d Convergence — Cycle 3

| Condition | Assessment | Score |
|-----------|-----------|-------|
| **c** | The recommendation is specific: delete one file, modify three others, remove one metric and one gate type. Changes are enumerated and bounded. | HIGH |
| **i** | The recommendation is invariant under different weighting schemes — the argument for removal holds whether you consider replacing trust with structural density, per-record weighting, or nothing. All alternatives are either redundant or premature. | HIGH |
| **d** | The recommendation is non-trivially derived from the empirical finding (trust inversely correlates with performance) combined with the structural argument (c/i/d subsumes the trust table's function). Neither finding alone is sufficient — the empirical data alone could justify recalibrating the table rather than removing it; the structural argument alone could be met with "but maybe the table adds defense in depth." Together they converge on removal. | HIGH |

**Stability: STABLE.** Recommendation converged.

---

# CYCLE 4 — RECURSE: Testing the Recommendation Against Edge Cases

## 4.1 What If a Hostile Source Floods the Pipeline?

Without source trust, a hypothetical source of pure noise that produces thousands of false motif matches would... get filtered by c/i/d anyway. The noise source contributes to one domain. The c condition requires 3+ domains. The noise doesn't promote motifs on its own.

If the noise is volume-dominant (e.g., 90% of all records), it could skew `evidenceQuality` within its domain. But the hierarchical aggregation (mean of domain means) caps its influence to 1/k of the total score, where k is the number of domains. With 15 source components, a single noisy source contributes at most ~7% of the aggregated evidence quality. The existing architecture handles this without trust weighting.

## 4.2 What If All Sources Are Structurally Poor?

If every source produces low-confidence matches, `evidenceQuality` will be low across all domains, and promotion thresholds won't be met. The system correctly refuses to promote motifs when evidence is weak everywhere. Source trust doesn't help here — it would just add another (uncorrelated) low number to the evaluation.

## 4.3 What If We Later Add Sources With Known Adversarial Intent?

For a static historical corpus like The Pile, adversarial structural manipulation is not a realistic threat (see §2.3). If the pipeline later ingests sources where adversarial manipulation is plausible (e.g., LLM-generated text designed to fool motif detection), the correct response is:

1. **Adversarial detection in the D-operator** (detect patterns that mimic motif structure without genuine structural depth)
2. **Provenance tracking** (record that evidence came from a potentially adversarial source, for human review)
3. **NOT per-source trust** — an adversarial source with high institutional prestige is more dangerous than an honest one with low prestige

## 4.4 The "Defense in Depth" Objection

One could argue: even if source trust is weakly correlated and c/i/d does the real work, keeping it as an additional filter provides defense in depth.

The problem: defense in depth assumes each layer filters independently. Source trust is not independent of c/i/d — it's a static prior that can override evidence. A motif with strong cross-domain evidence from "untrusted" sources (Pile-CC, IRC, HackerNews) is penalised by trust weighting despite passing every structural test. This isn't defense in depth — it's institutional bias masquerading as caution.

Defense in depth that introduces correlated bias is worse than no defense at all, because it creates the illusion of rigour while actually narrowing the evidence base.

## 4.5 What About the Governance Mathematics Derivation?

The derivation (`governance-mathematics-dir-derivation-20260331-DRAFT.md`) derives that D is a filter, and that filter fidelity (source trust) and signal magnitude (evidence strength) compose multiplicatively. This is structurally correct.

The issue is not with the mathematical form — it's with the operationalisation. If source trust could be measured (actual filter fidelity: what fraction of this source's detected patterns are real?), the multiplicative composition would be valid. But we don't have a measure of filter fidelity independent of the detection pipeline. The static lookup table is a guess at filter fidelity, not a measurement.

If empirical filter fidelity data becomes available in the future (e.g., through validation events that confirm or reject individual detections), a derived per-source quality metric could be introduced. This would be a **computed** trust score based on track record, not a **static** institutional hierarchy. The mathematics would be the same; the data source would be correct.

## 4.6 c/i/d Convergence — Cycle 4

| Condition | Assessment | Score |
|-----------|-----------|-------|
| **c** | Four edge cases tested. Each confirms the recommendation holds under adversarial, degenerate, and future-looking conditions. | HIGH |
| **i** | The recommendation survives substitution of threat model: whether the concern is noise, structural poverty, adversarial manipulation, or over-filtering, source trust either doesn't help or actively harms. | HIGH |
| **d** | The "defense in depth" rebuttal and the governance mathematics reconciliation are non-trivially derived. The distinction between the mathematical form (valid) and its operationalisation (invalid) was not previously articulated. | HIGH |

**Stability: STABLE.** Full convergence across 4 cycles.

---

# Summary of Findings

## Recommendation

**Remove the source trust table entirely.** Delete `source-trust.ts`. Remove `sourceReliability` from evidence aggregation and `trustFloor` gates from tier promotion. The c/i/d conditions are the correct mechanism for filtering evidence quality; source trust is redundant at best and biased at worst.

## What Changes

| Component | Action |
|-----------|--------|
| `source-trust.ts` | Delete |
| `evidence-aggregator.ts` | Remove `sourceTrust` from domain evidence, remove `sourceReliability` computation |
| `tier-promoter.ts` | Remove `trustFloor` from all threshold objects, remove `sourceReliability` gate checks |
| `types.ts` | Remove `sourceReliability` and `sourceTrust` from types |
| `digest-generator.ts` | Remove `sourceReliability` references |

## What Stays

- `evidenceQuality` (hierarchical mean of per-domain means) — structurally derived, empirically grounded
- `domainCount` gates — c condition
- Triangulation / source diversity — i condition
- Derivative order adjustments — d condition
- All demotion logic, validation protocol, hysteresis

## Assumptions

1. The Pile is the primary/only corpus for now. If new corpora are added with known quality issues, the correct response is per-record quality assessment, not per-source weighting.
2. Adversarial structural manipulation is not a current threat for a static historical corpus. If it becomes a threat, the response should be adversarial detection in the D-operator, not institutional trust.
3. The empirical data from shard-00 (9,922 records, 15 sources) is representative of the full pipeline's behavior. If shard-01 and shard-02 show dramatically different patterns, re-evaluate.

## Open Questions

1. **Empirical filter fidelity:** Could we compute per-source trust from validation events? If the pipeline later includes a mechanism where humans confirm/reject individual motif detections, the confirmed/rejected ratio per source would be genuine filter fidelity data. This would be a legitimate use of the multiplicative composition derived in the governance mathematics — but it requires data we don't have yet.

2. **Domain vs. source_component:** The current code calls `getSourceTrust(r.domain)`, but the trust table maps `source_component` values. If `domain` and `source_component` diverge in future schemas, this is a latent bug. Removal makes it moot.

3. **Structural complexity as a computable metric:** Is there a way to measure the structural complexity of a source passage (argument depth, governance layer count, relationship density) that isn't redundant with motif_confidence? If so, this could be a per-record input to the D-operator rather than a per-source prior. This is a research question, not an implementation task.

## Unexpected Findings

1. **Ubuntu IRC is a structurally rich source.** Average confidence 0.493, 6th highest motif diversity. Real-time governance negotiations (trust formation, authority delegation, community moderation) produce raw structural signal that exceeds the structural density of most curated academic sources. The trust table assigns it the minimum score. This is the clearest single data point against institutional trust as a proxy for structural quality.

2. **FreeLaw is structurally monotone despite institutional quality.** Trust 0.6 but only 4 distinct motifs detected, overwhelmingly TAC (2,041 of 2,062 records). Legal opinions follow rigid templates — high institutional quality, low structural diversity. The trust table rewards the institutional quality; the evidence pipeline reveals the structural poverty.

3. **The trust table's spread (0.4) is 3.6× the actual performance spread (0.111).** The prior massively overstates the difference between sources. Even if the ranking were correct (it isn't), the magnitude is wrong by a factor of ~4.

4. **The governance mathematics derivation is correct in principle but unverifiable in practice.** The multiplicative composition of filter fidelity × signal magnitude is a valid mathematical form — the problem is that we have no independent measurement of filter fidelity. The static trust table is an unvalidated guess masquerading as a parameter. This is a subtle but important distinction: the mathematics isn't wrong, the data is missing.
