# PRD: Governance Mathematics v2 — D/I/R-Derived Evidence Aggregation

**Status:** DRAFT
**Author:** Atlas
**Created:** 2026-03-31
**Authority:** Adam decides. Atlas proposes.

---

## 1. Problem Statement

The current governance engine uses flat evidence aggregation (`AVG(motif_confidence)` across all verb records) and hardcoded thresholds. The D/I/R derivation analysis revealed three structural issues:

1. **Flat aggregation ignores domain boundaries.** `AVG(motif_confidence)` pools all records regardless of domain. 100 records from one domain carry the same weight as 10 records from 10 domains, despite the latter being stronger evidence for cross-domain validation (c condition).

2. **No source trust weighting.** All Pile sources are treated equally. A PubMed peer-reviewed paper carries the same weight as Common Crawl web text.

3. **No demotion mechanism.** The system can promote motifs but cannot demote them. Motifs that lose evidence or were incorrectly promoted persist at inflated tiers.

## 2. Source Analysis

Two analyses feed this PRD:

- **Governance Calibration** (`00-Inbox/governance-calibration-dir-analysis-20260331-DRAFT.md`): Mapped three governance systems, proposed three-layer architecture, stress-tested thresholds.
- **Governance Mathematics Derivation** (`00-Inbox/governance-mathematics-dir-derivation-20260331-DRAFT.md`): Derived formulas from D/I/R first principles. Key findings: hierarchical aggregation > flat, source trust as separate R-input, formal ↓ operator.

## 3. What Changes

### 3.1 Hierarchical Evidence Aggregation

**Current** (`evidence-aggregator.ts:94-101`):
```sql
SELECT AVG(motif_confidence) as avg_confidence, AVG(tier_b_score) as avg_tier_b, COUNT(*) as total
FROM verb_records WHERE motif_id = ?
```

**Proposed:** Two-stage aggregation:
```
Stage 1 (D-layer): Per-domain mean
  domain_evidence(dⱼ) = AVG(motif_confidence) WHERE motif_id = ? AND domain = dⱼ
  domain_trust(dⱼ)    = source_trust_table[source_component]

Stage 2 (I-layer): Cross-domain mean
  evidence_quality(m)   = AVG(domain_evidence) across all domains
  source_reliability(m) = AVG(domain_trust) across all domains
```

The `MotifEvidence` interface gains two new fields: `evidenceQuality: number` and `sourceReliability: number`. The existing `confidence` field is retained for backward compatibility but marked deprecated.

### 3.2 Source Trust Table

New file: `src/governance/source-trust.ts`

Static lookup table mapping `source_component` values to trust scores:

| source_component | trust | Rationale |
|-----------------|-------|-----------|
| PubMed Central  | 0.7   | Peer-reviewed biomedical |
| PhilPapers      | 0.7   | Curated philosophical |
| ArXiv           | 0.6   | Pre-print, expert-authored |
| FreeLaw         | 0.6   | Legal opinions, structured |
| Wikipedia       | 0.5   | Encyclopedic, community-edited |
| Books3          | 0.5   | Published books, mixed quality |
| StackExchange   | 0.4   | Community Q&A, variable |
| Github          | 0.4   | Code + docs, variable |
| OpenWebText2    | 0.3   | Web text, low curation |
| Pile-CC         | 0.3   | Common Crawl, minimal curation |
| _default        | 0.3   | Conservative fallback |

Exported as `getSourceTrust(component: string): number`.

### 3.3 Updated Promotion Thresholds

**Current** (`tier-promoter.ts:27-37`):
```typescript
const T0_T1_THRESHOLDS = { domainCount: 3, sourceTypes: 2, confidence: 0.3 };
const T1_T2_THRESHOLDS = { domainCount: 7, sourceTypes: 3, confidence: 0.7 };
```

**Proposed:**
```typescript
const T0_T1_THRESHOLDS = {
  domainCount: 3,
  sourceTypes: 2,
  evidenceQuality: 0.3,
  trustFloor: 0.2,
};

const T1_T2_THRESHOLDS = {
  domainCount: 5,        // was 7; source trust weighting raises effective bar
  sourceTypes: 3,
  evidenceQuality: 0.6,  // was 0.7; trust separation means raw evidence checked separately
  trustFloor: 0.3,
};

const T2_T3_THRESHOLDS = {
  domainCount: 8,        // was 10
  relationshipEdges: 3,
  evidenceQuality: 0.8,  // was 0.9
  trustFloor: 0.4,
  preliminaryCount: 2,   // unchanged
};
```

### 3.4 Derivative Order Adjustment

**Where:** `evaluateT1T2()` and `evaluateT2T3()` in `tier-promoter.ts`.

```typescript
function adjustedQualityThreshold(baseThreshold: number, derivativeOrder: number): number {
  return baseThreshold * (1 + 0.1 * derivativeOrder);
}
```

The `derivative_order` field already exists in `MotifFrontmatter` (types.ts:21). Currently unused in threshold checks.

### 3.5 Demotion Engine (↓ operator)

New method on `TierPromoter`: `evaluateDemotions()`.

Demotion fires when any stabilisation condition falls below promotion threshold minus hysteresis:

```typescript
const DEMOTION_HYSTERESIS = {
  domainCount: 1,      // 1 domain below promotion threshold
  evidenceQuality: 0.1, // 0.1 below promotion threshold
};
```

**T1 → T0:** `domainCount < 2 OR evidenceQuality < 0.2`
**T2 → T1:** `domainCount < 4 OR triangulation lost OR evidenceQuality < 0.5 × d_adj`
**T3 → T2:** `domainCount < 7 OR evidenceQuality < 0.7 × d_adj OR relationshipEdges < 2`

Exception: Motifs that never met their current tier's promotion conditions (correction, not degradation) bypass hysteresis.

**Guard:** Demotion only evaluates motifs that were auto-promoted by the processor (have a promotion_log entry with `action IN ('auto-promoted', 'queued-for-review')` at the current tier). Manually curated motifs — promoted before the processor existed — should not be demoted based on incomplete processor evidence. Their evidence base includes manually catalogued domains not in the verb_record store.

Demotion results are logged to `promotion_log` with action `'demoted'`. The `PromotionLogEntry.action` type union gains `'demoted'`.

Demotion updates motif frontmatter (tier, status → previous tier's status, confidence adjustment). Review packets are generated for T2→T1 demotions (human visibility).

### 3.6 Sandbox Mode

New option on `TierPromoter`: `dryRun: boolean`.

When `dryRun = true`:
- All evaluations run normally (promotions, demotions, review packets)
- No filesystem writes (no frontmatter updates, no review packet files)
- No promotion_log inserts
- Returns full `PromotionRunResult` with an additional `demotions` array
- Digest is generated but written to a sandbox subdirectory

This enables the calibration analysis's Phase 2 (governance dry run against existing shards).

## 4. Files Changed

| File | Change Type | Description |
|------|------------|-------------|
| `src/governance/types.ts` | MODIFY | Add `evidenceQuality`, `sourceReliability` to `MotifEvidence`. Add `DemotionResult` type. Extend `PromotionLogEntry.action` union. |
| `src/governance/source-trust.ts` | NEW | Source trust lookup table. |
| `src/governance/evidence-aggregator.ts` | MODIFY | Hierarchical aggregation: per-domain means → cross-domain mean. Source trust integration. |
| `src/governance/tier-promoter.ts` | MODIFY | Updated thresholds. Derivative order adjustment. Demotion engine. Sandbox mode. |
| `src/governance/index.ts` | MODIFY | Export new types, pass dryRun option through. |
| `src/store/migrations.ts` | MODIFY | Add `domain_evidence` index for hierarchical aggregation performance. |

## 5. Files NOT Changed

- `src/filter/indicator-sets.ts` — Indicator set governance (OCP template model import) is a separate PRD. Higher leverage but different scope.
- `src/tier-b/`, `src/tier-c/` — Evidence production pipeline unchanged. This PRD only changes how evidence is aggregated and evaluated.
- `src/governance/motif-library-reader.ts` — Already reads `derivative_order` from frontmatter. No changes needed.
| `src/governance/digest-generator.ts` | MODIFY | Add demotions section to digest markdown output. `DigestEntry` gains `demotions` field. |

### D/I/R Validation Findings (incorporated)

1. **`domain` = `source_component` in actual data.** Hierarchical grouping by `domain` correctly separates Pile sub-corpora. No additional mapping needed.
2. **Current evidence scores are Tier A/B only (~0.38-0.43).** T2 thresholds (0.6+) are unreachable without Tier C. Sandbox dry-run will show zero T2 candidates — by design.
3. **Hierarchical vs. flat difference is small with current data (~0.01-0.02).** Matters more after Tier C runs with domain-varying scores.
4. **Non-integer derivative orders exist** (e.g. "1-2", "1.5"). Use `Math.ceil(parseFloat(...))` for threshold adjustment.
5. **`wasAlreadyPromoted()` pattern reusable** for demotion deduplication: check `action = 'demoted'` in promotion_log.

## 6. Build Order

```
Phase A (parallel, no dependencies):
  A1: source-trust.ts (new file)
  A2: types.ts updates (new interfaces, DemotionResult, extended action union)
  A3: migrations.ts (new composite index)

Phase B (depends on A1 + A2):
  B1: evidence-aggregator.ts (hierarchical aggregation + source trust)

Phase C (sequential — single file, depends on A2 + B1):
  C1: tier-promoter.ts — updated thresholds + derivative order adjustment
  C2: tier-promoter.ts — demotion engine (↓ with hysteresis)
  C3: tier-promoter.ts — sandbox mode (dryRun flag)

Phase D (parallel, depends on C):
  D1: digest-generator.ts — add demotions to DigestEntry and markdown
  D2: index.ts — exports + wiring
```

Phase C is sequential (single file). D1 and D2 can run in parallel.

## 7. Acceptance Criteria

1. **Hierarchical aggregation produces bounded [0,1] scores** for all motifs in existing shards.
2. **Source trust weighting changes evidence_quality** relative to flat AVG — verify with a known high-trust motif (DSG) and a known low-trust scenario.
3. **Derivative order adjustment** raises the effective T2 threshold for d2+ motifs.
4. **Demotion engine correctly identifies** Template-Driven Classification and Scaffold-First Architecture as demotion candidates (both fail T1 c-threshold under new model).
5. **Sandbox mode** produces identical evaluation results to live mode but writes no files and no DB entries.
6. **Existing T2 motifs still pass T2** under new thresholds (regression test: all 9 current T2 motifs).
7. **Promotion log** records both promotions and demotions with full evidence snapshots.

## 8. Validation Protocol

### Phase 1: Unit validation
- Run hierarchical aggregation against shard-00.db. Compare `evidence_quality` to existing `confidence` for each motif. Verify bounded [0,1].
- Run demotion evaluator against current library. Verify Template-Driven and Scaffold-First flagged.
- Run promotion evaluator with new thresholds. Verify all 9 T2 motifs still pass.

### Phase 2: Dry-run comparison
- Run full governance in sandbox mode against all available shards.
- Compare promotion/demotion decisions to current governance output.
- Produce diff report: what changes under the new model.

### Phase 3: Adam reviews dry-run output
- No library changes until Adam approves the dry-run results.

## 9. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| New thresholds incorrectly demote a valid T2 motif | Low | High | Sandbox dry-run before any live changes. Regression test against all 9 T2 motifs. |
| Source trust table values are miscalibrated | Medium | Medium | Values are initial estimates. Validation event tracking (future PRD) enables empirical recalibration. |
| Domain grouping by `source_component` is too coarse | Medium | Low | "PubMed Central" contains many sub-domains. Hierarchical aggregation treats all PubMed records as one domain. Refinement deferred to indicator-set-governance PRD. |
| Demotion engine creates governance oscillation | Low | Medium | Hysteresis margins prevent oscillation. ↑ threshold > ↓ threshold by design. |
| Performance: hierarchical aggregation requires grouped queries | Low | Low | Add composite index on (motif_id, domain). SQLite handles grouped aggregation efficiently. |

## 10. Out of Scope

- Indicator set governance (OCP template model import)
- Indicator set expansion (18 → 25+ motifs)
- Validation event tracking / empirical trust recalibration
- Edge tagging (`evidence_source` metadata on graph edges)
- Trust floor as a separate R-gate (simplified: trust floor is checked as a single threshold, not a parallel multi-dimensional evaluation — the full separation described in the derivation is deferred pending practical evaluation)

---

*PRD completed 2026-03-31. DRAFT — requires D/I/R validation, then Adam's approval before build.*
