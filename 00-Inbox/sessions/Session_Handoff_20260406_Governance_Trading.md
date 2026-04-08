-----

## ⚠️ VAULT SAFETY HEADER

authority_boundary: This document is VAULT content (narrative/rationale/planning).
vault_rule: The Workspace does NOT derive from this document.
human_gate: Promotion to canonical requires Adam's explicit approval.
ai_rule: AI agents may READ this document. AI agents may CREATE new documents referencing this one. AI agents may NOT modify canonical vault documents.

-----

## status: ACTIVE

date: 2026-04-06
author: Claude (advisory)
type: session-handoff
domain: [governance, dataset-processor, motif-library, dir-theory, sovereignty, infrastructure]

# SESSION HANDOFF — March 31 – April 6, 2026

## OVERVIEW

This covers two interleaved threads of work:

1. **Governance v2 session (March 31):** A full-day session that designed, derived, built, validated, and deployed a new governance engine for the motif library. Entirely driven through D/I/R analysis cycles with Atlas.
2. **Subsequent multi-day session (April 1-4):** Covered by a separate handoff at `00-Inbox/session-handoff-20260404-DRAFT.md`. This included the D/I/R engine build (91/91 tests), QHO→Langevin pivot, BTC trading system Phases A-C, transition matrix analysis, and theoretical breakthroughs.
3. **Current state (April 6):** The 29-shard batch reprocess is running. Shard-15 is currently processing (~2M docs through). Shards 01-14 complete. A new motif (Cross-Domain Recursive Integration / CDRI) was discovered during the reprocess.

-----

## GOVERNANCE V2 — WHAT WAS BUILT (March 31)

### Four D/I/R Analyses in One Session

**Analysis 1: Governance Calibration (Atlas, 10m 42s, 3 cycles)**

Started with the assumption that two governance systems (OCP scraper + dataset processor) needed alignment. Atlas discovered three: the OCP scraper, the dataset processor, and the motif library schema each measure confidence differently and serve different purposes. Their scales are incommensurable — no linear mapping exists.

Key findings:
- OCP scraper has NO tier system — it uses a 5-level confidence scale from CTS scores. The "tier" framing was a projection.
- Only 18/34 motifs had indicator sets — the processor couldn't detect half the library
- Two T1 motifs (Template-Driven Classification, Scaffold-First Architecture) had only internal Observer project evidence — circular if used for external evaluation
- Proposed three composable layers: Source Trust → Evidence Strength → Knowledge Maturity

**Analysis 2: Governance Mathematics Derivation (Atlas, 9m 19s, 3 cycles)**

Derived governance formulas from D/I/R first principles rather than heuristics.

Three departures from the original heuristics:
- **Hierarchical aggregation replaces √N.** The heuristic formula Σ[e×s]/√N is unbounded — a correctness bug. The D/I/R-derived form (mean of per-domain means) is naturally bounded [0,1] because it respects the D→I pipeline structure.
- **Source trust separated from evidence quality as parallel R-inputs.** Pre-multiplying trust × evidence loses a dimension R needs. "Strong evidence from weak sources" and "weak evidence from strong sources" both produce 0.27 blended but require completely different governance responses.
- **Formal demotion conditions (↓ operator).** OR-composition of condition violations with hysteresis margins. Promotion harder than demotion resistance prevents oscillation. The governance system itself exhibits Ratchet with Asymmetric Friction.

Three validations of heuristics: multiplicative composition (derived from D as filter), AND-composition for promotion (derived from ↑), derivative order direction (higher claims need more evidence).

**Analysis 3: Source Trust Removal (Atlas, 3m 51s, 4 cycles)**

Adam raised a fundamental question: should we rank sources by institutional credibility at all? Atlas tested empirically against shard-00 data.

Decisive findings:
- Ubuntu IRC (trust 0.3) outperforms PubMed Central (trust 0.7) on average confidence by 20%
- Pile-CC (trust 0.3) ties PubMed for motif diversity (16 distinct motifs each)
- FreeLaw (trust 0.6) detects only 4 motifs — 99% of records are TAC
- Trust table spread (0.4) is 3.6× wider than actual performance variation (0.111)

The structural argument: institutional curation filters for content validity (propositional). Motif detection operates on structural geometry (what text does, not says). c/i/d already handles evidence filtering without institutional bias.

**Recommendation approved: delete source trust table entirely.**

**Analysis 4: Wide-Then-Narrow Methodology (Atlas, 2m 29s, 3 cycles)**

Adam questioned the cautious approach (validate indicators → test one shard → expand). Atlas confirmed: wide-then-narrow is the structurally correct methodology. The governance engine IS the rigour layer. Pre-validation is doing R before D finishes — collapsing the observation space based on expectations rather than evidence.

Key evidence: dead indicators produce exactly zero noise, not scattered noise. The governance engine doesn't even need to filter them.

This was adopted as the default methodology: cast wide net with all indicators, let governance sort the catch.

### What Was Implemented

**Governance v2 committed as `8848cb0`:**
- Hierarchical evidence aggregation (mean of domain means)
- Demotion engine with hysteresis (↓ operator, OR-composition)
- Derivative order adjustments (higher-order motifs need proportionally more evidence)
- Sandbox mode (dryRun flag)
- Source trust table deleted
- Trust floor gates removed from all promotion thresholds

**Invisible motifs fixed, committed as `4c122ce`:**
- RB name mismatch fixed (T2 motif was invisible)
- 14 new T0 indicator sets created (CU, PBR, TAM, PEPS, MS, HSSFS, ECS, DTR, PC, RRT, NSSH, PUE, KRHS, IBP)
- 2 skipped (Live Event Bus overlaps CPA, Epistemic Governance overlaps DSG)
- Pipeline detection coverage: 18 → 32 motifs

**Shard-00 reprocess with 32 indicators, committed as `3b8a429`:**
- 5.9M docs, 608K candidates, 10K verb records
- 9 T0→T1 auto-promotions: NSSH, PEPS, PUE, HSSFS, IBP, PC, RRT, ECS, TAM
- 4 indicators found zero (CU, PBR, KRHS, MS)

**Frontmatter cosmetics committed as `aed1ee8`:**
- Fixed floating point artifacts and quoting inconsistency

**Production governance ran across all 30 shards:**
- SFA and TDC promoted T0→T1 through legitimate data
- 0 demotions, 30 digest files generated

### Decisions Made

1. Three composable governance layers rather than forced unification
2. Hierarchical aggregation replacing flat √N (derived from D/I/R)
3. Source trust table deleted (empirically inverted, structurally incoherent)
4. TDC and SFA demoted to T0 then re-promoted through data
5. Demotion guard: manually curated motifs protected from processor-based demotion
6. Wide-then-narrow as default processing methodology

-----

## TRADING SYSTEM — v6.2c COMPLETE (April 5-6, 2026)

Full session handoff at `01-Projects/observer-council/SESSION-HANDOFF-2026-04-06.md`.

Summary:
- v1 through v6.2c backtested and locked
- Architecture: K=2 HMM (Kinetic/Quiet), avg_momentum ±2% deadband gatekeeper, best_momentum micro funnel, unconditional Hold in Quiet
- Results: +1,662% total return, 66.2% CAGR, Calmar 0.99, 2022: -29.4%, 73 switches
- Token universe: BTC, ETH, SOL, BNB, ADA (frozen — phase diversity required)
- Freqtrade integration: delivered, execution-only (cross-pair backtest limitation documented)
- CCXT daemon: queued for Atlas build
- Paper trading: ready to start, needs Telegram credentials
- Key framework findings: thermodynamic mass requirement, K=2 as natural crypto state space, sensor array mode discovered, separation of concerns principle

-----

## CURRENT PIPELINE STATUS

### 29-Shard Batch Reprocess — IN PROGRESS

**Script:** `01-Projects/dataset-processor/scripts/reprocess-all-shards.sh`
**Started:** 2026-04-01T05:54:44 AEDT
**Progress as of April 6:** Shard-15 processing (~2M/5.9M docs). Shards 01-14 complete.

**Important:** The script was restarted at shard-10 with a modified version that includes Tier B enrichment. Shards 01-09 were processed with Tier A only (--no-tier-b). Shards 10-14 (and ongoing) include Tier B structural scoring. This means shards 01-09 may need Tier B enrichment retroactively for consistency.

**Completion timeline:** At ~4.5-5 hours per shard, remaining shards 15-29 = ~67-75 hours. Estimated completion: April 9-10.

**Monitoring:**
```fish
# Quick status
tail -f /mnt/zfs-host/backup/projects/observer-vault/01-Projects/dataset-processor/output/batch-reprocess.log

# Which shard is processing
grep "\[batch\].*Processing shard" /mnt/zfs-host/backup/projects/observer-vault/01-Projects/dataset-processor/output/batch-reprocess.log | tail -1

# Is it still running
pgrep -f reprocess-all-shards && echo "running" || echo "finished"
```

### New Motif Discovered During Reprocess

**Cross-Domain Recursive Integration (CDRI)** — created 2026-04-03, T1, confidence 0.6, 6 domains, d2, integrate axis, composition I(R). Source: bottom-up. Located at `02-Knowledge/motifs/cross-domain-recursive-integration.md`.

-----

## MOTIF LIBRARY STATE (as of April 6)

**38 motifs total:**

**Tier 2 (9 motifs):** DSG, CPA, ESMB, BBWOP, ISC, OFL, RAF, PF, RB

**Tier 1 (19 motifs):**
TAC, RST, BD, SCGS, SLD, RG, PSR (original 7)
SFA, TDC (promoted through production governance)
NSSH, PEPS, PUE, HSSFS, IBP, PC, RRT, ECS, TAM (promoted from shard-00 reprocess)
CDRI (new discovery, created directly at T1)

**Tier 0 (10 motifs):** CU, PBR, KRHS, MS + remaining T0 observations

**Indicator set coverage:** 32/38 detectable

-----

## WHAT TO DO WHEN REPROCESS COMPLETES

1. Check Tier A/B consistency — shards 01-09 need retroactive Tier B enrichment
2. Run governance across all 30 reprocessed shards
3. Review CDRI motif evidence and structural description
4. Consider Tier C evaluation (Claude API) to break through 0.43 evidence ceiling
5. Cross-shard aggregation for T1→T2 threshold (individual shards can't reach 0.6 alone)
6. Training data export once motif library stabilises

-----

## INFRASTRUCTURE REMINDERS

- **Git push needed** — check `git log --oneline origin/main..HEAD`
- **OILEventBridge** — hardcoded vault path needs ZFS migration
- **Kingston 4TB drive** at 93% — investigate
- **KDE settings** — lost in Plasma reinstall, need manual reconfiguration
- **Oliver power button fix** — `HandlePowerKey=ignore` in logind.conf
- **Forgejo setup** on Proxmox — self-hosted git (GitHub migration pending)
- **MacBook M5 Max 128GB** — purchase pending fuel situation resolution
- **Four Pillars + Rivers** — 113 ISC, still not built (biggest deferred engineering block)
- **OCP scraper FTS5 bug** — keyword queries return 0 results, fix pending

-----

## D/I/R ENGINE STATE

- 5 tools operational: dir_classify, dir_compose, dir_energy, dir_transition, dir_status
- 228 vocabulary, 9 compositions, 45 motifs, centroid v20260403-001
- Wired into Claude Desktop via MCP
- Gemini Gem instructions updated with live engine integration

-----

*Handoff compiled 2026-04-06. Pipeline running. Governance v2 deployed. Trading system v6.2c locked. Multiple theoretical breakthroughs in April 1-4 session (see separate handoff). Build continues.*
