# Atlas Build Prompt — Dual Fan-Out: D/I/R Engine + BTC Trading Phase A

## For Atlas — Parallel Build Using Sub-Agents

You have two approved PRDs ready for build. Use sub-agents to run them in parallel.

---

## Build 1: D/I/R Structural Engine (MCP Server)

**PRD:** `01-Projects/dir-engine/.prd/PRD-20260403-dir-structural-engine.md`
**Status:** PLAN, 0/55 ISC, Iteration 2
**Start with:** S0 (types + data loaders + export scripts)

Build sequence: S0 first → S1-S4 parallel (sub-agents) → S5 last.

S0 includes the export-artifacts.ts script — this is the bridge from Python pipeline to engine runtime. It must work before any slice can integration-test with real data. Build it first within S0.

Key things to know:
- Bun runtime, `@modelcontextprotocol/sdk`, Zod schemas
- OCP scraper pattern for MCP server (`01-Projects/ocp-scraper/src/mcp/server.ts`)
- Control plane monorepo for type patterns (`01-Projects/control-plane/observer-system/`)
- Centroid data from `01-Projects/dataset-processor/scripts/backfill-compositions.py`
- Indicator vocabulary from `01-Projects/dataset-processor/scripts/dir-vectorize-cluster.py`
- Motif library from `02-Knowledge/motifs/` (35 motifs, 9 Tier 2)
- `dir_classify` accepts EITHER text OR pre-computed vector (required for trading system)
- `dir_energy` is a gated stub — returns `{ gated: true }` (Langevin model, not QHO — see PRD Section 2.7)
- `dir_evaluate` accepts optional threshold overrides
- Cross-validation ISC-S5A: compare TS engine vs Python pipeline on ≥50 shared records, ≥95% agreement

---

## Build 2: BTC Trading System — Phase A Only (Feasibility Gate)

**PRD:** `01-Projects/trading-system/.prd/PRD-20260403-btc-regime-detection.md`
**Status:** PLAN, 0/41 ISC, Iteration 1
**Start with:** Phase A ONLY — this is the feasibility gate. Do NOT proceed to Phase B until Phase A gate passes.

Phase A is standalone Python — no dependency on the D/I/R engine being finished.

What Phase A does:
1. Download 1 year BTC 1h OHLCV data
2. Implement 12 features (4 per axis: D=volatility/boundaries, I=mean-reversion/convergence, R=autocorrelation/persistence)
3. Aggregate to 6D vector [D, I, R, temporal, density, entropy]
4. Run K-means for K ∈ {3, 5, 7, 9, 12}
5. Check: does K=9 emerge from price data?
6. Check: ISC-A9 — pairwise D/I/R axis correlation < 0.7

**Gate criteria (from PRD):**
- K=9 silhouette ≥ K=3 silhouette AND > 0.15 → proceed to Phase B
- K=9 fails → fall back to 3-regime model (K=3) or stop

**Build constraints:**
- GARCH(1,1) fallback: on convergence failure, use realised vol autocorrelation corr(σ_t, σ_{t-1})
- Test rolling windows: 24h, 48h, 72h. Pick by silhouette score.
- 3-regime first. Do NOT build 9-composition strategies yet.
- Hurst exponent: validate against synthetic random walk (H should be ≈ 0.5)

**Output:** A Jupyter notebook or Python script that produces:
- Silhouette scores for K=3,5,7,9,12
- Cluster scatter plots (3D: D, I, R axes)
- Axis correlation matrix
- Gate decision: proceed / fallback / stop

---

## Fan-Out Strategy

Use sub-agents for parallel work:

**Engine sub-agents (after S0 completes):**
- Sub-agent 1: S1 (Vectorizer)
- Sub-agent 2: S2 (Classifier)
- Sub-agent 3: S3 (Composer)
- Sub-agent 4: S4 (Evaluator)

**Trading sub-agent (independent, can start immediately):**
- Sub-agent 5: Phase A feasibility (download data, compute features, run clustering)

S5 (MCP server wiring) runs after S1-S4 converge — do NOT fan that out.

**Context budget:** Keep each sub-agent focused on its slice. Don't load the full PRD into every sub-agent — give each one its slice section, the types from S0, and the ISC criteria for its slice only.

---

## What NOT to do

- Don't start Phase B of trading until Phase A gate passes
- Don't build 9-composition strategies — 3-regime first
- Don't implement dir_energy beyond the gated stub
- Don't use text centroids for price data — separate centroid spaces
- Don't push to git without explicit instruction
- Don't exceed ~80% context before compacting
