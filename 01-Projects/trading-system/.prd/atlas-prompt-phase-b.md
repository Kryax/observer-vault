# Atlas Build Prompt — Trading System Phase B

## For Atlas — Phase B: Regime Classifier (3-Regime Model)

Phase A is complete. Gate decision: **CONDITIONAL — fallback to K=3 (3-regime model).**

**Phase A results (from `data/phase_a_results.json`):**
- Best window: 72h (silhouette 0.326 at K=3)
- D↔I: −0.57 (anticorrelated — trending and mean-reverting oppose)
- D↔R: +0.10 (orthogonal)
- I↔R: −0.37 (moderately opposed)
- K=9 did NOT beat K=3 — 9-composition model deferred
- All Phase A ISC criteria pass

**Data already exists:**
- `data/btc_1h_ohlcv.csv` — 8,760 candles, Apr 2025–Apr 2026, Binance
- `data/phase_a_results.json` — full results
- `data/clusters_w72_k3.json` — K=3 clustering output for best window
- Phase A feature computation code in `src/`

---

## What Phase B Builds

Phase B takes the K=3 clustering from Phase A and turns it into a usable regime classifier with validated regime labels.

### B1: Fit K=3 Centroids (72h window)

Using the Phase A feature pipeline:
1. Compute 12 features → 6D vectors using 72h rolling window (already done in Phase A)
2. Fit K-means K=3 on the full dataset
3. Export centroid manifest: `data/price_centroids.json` (same format as dir-engine centroids but separate centroid space)
4. Map clusters to regimes by inspecting centroid axis weights:
   - Highest D score → D-regime (trending/breakout)
   - Highest I score → I-regime (mean-reverting/consolidation)
   - Highest R score → R-regime (reflexive/volatile)

### B2: Label Historical Data

1. Assign every 72h window to its nearest centroid → regime label
2. Add regime column to the OHLCV dataframe
3. Compute regime statistics:
   - Time distribution: what % of time in each regime?
   - Median regime duration (consecutive bars in same regime)
   - Regime transition matrix (how often does D→I, I→R, R→D, etc.)

### B3: Validate Regime Labels

This is the critical validation step. Regimes must correspond to identifiable market conditions.

1. Overlay regime labels on price chart — visual inspection
2. Check: do D-regime periods correspond to known trending periods?
3. Check: do I-regime periods correspond to known consolidation/ranging?
4. Check: do R-regime periods correspond to known volatile/reflexive periods (crashes, squeezes)?
5. Produce a labelled price chart with regime coloring as the primary output

### B4: Confidence & Transition Detection

From the Langevin model — confidence and entropy as regime health indicators:
1. Compute per-bar confidence: 1 - (nearest_distance / second_nearest_distance)
2. Compute per-bar entropy: Shannon entropy over D/I/R proportions
3. Detect transitions: confidence dropping + entropy rising = regime weakening
4. This becomes the position-sizing signal in Phase C

---

## Phase B Gate Criteria (from PRD)

- Median regime duration > 6 hours (regimes aren't flickering noise)
- Regimes match visual market conditions (human inspection — produce the chart for Adam)
- Transition detection fires before major regime changes (at least on 3 examples)
- No single regime dominates > 70% of time (the classifier is actually distinguishing)

---

## Phase B ISC (from PRD)

- [ ] **ISC-B1:** K=3 centroids fit on 72h window, exported to `data/price_centroids.json`
- [ ] **ISC-B2:** Cluster→regime mapping documented (which cluster = D, I, R)
- [ ] **ISC-B3:** Every OHLCV bar assigned a regime label
- [ ] **ISC-B4:** Regime time distribution computed — no single regime > 70%
- [ ] **ISC-B5:** Median regime duration > 6 hours (not noise)
- [ ] **ISC-B6:** Transition matrix computed (9 cells: D→D, D→I, D→R, I→D, ...)
- [ ] **ISC-B7:** Transition matrix shows shared-operator transitions more common than cross-axis (falsifiable prediction from multi-well topology)
- [ ] **ISC-B8:** Labelled price chart with regime coloring saved as image
- [ ] **ISC-B9:** Confidence and entropy time series computed per bar
- [ ] **ISC-B10:** At least 3 examples where confidence drop preceded regime transition

---

## Key Files

- PRD: `01-Projects/trading-system/.prd/PRD-20260403-btc-regime-detection.md`
- Phase A results: `01-Projects/trading-system/data/phase_a_results.json`
- Phase A source: `01-Projects/trading-system/src/`
- BTC data: `01-Projects/trading-system/data/btc_1h_ohlcv.csv`
- K=3 clusters: `01-Projects/trading-system/data/clusters_w72_k3.json`

## Constraints

- 3-regime only. Do NOT build 9-composition strategies.
- 72h window (best silhouette from Phase A).
- Python — consistent with Phase A code.
- Produce visual outputs (regime-coloured price chart) — Adam needs to visually validate.
- GARCH fallback: if vol_clustering fails to converge, use realised vol autocorrelation.

## Process

This is a sequential build, not a fan-out. B1 → B2 → B3 → B4. Each step depends on the previous. The regime-coloured price chart (B3) is the most important output — it's what Adam will use to decide whether to proceed to Phase C.
