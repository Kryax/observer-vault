---
meta_version: 1
kind: plan
status: draft
authority: medium
domain: [dir-engine, trading]
source: atlas_write
confidence: provisional
mode: build
created: 2026-04-03T16:00:00+11:00
modified: 2026-04-03T17:00:00+11:00
iteration: 0
maxIterations: 128
loopStatus: null
last_phase: DRAFT
failing_criteria: []
verification_summary: "0/41"
cssclasses: [status-draft]
motifs: [regime-detection, composition-trading, langevin-dynamics]
refs:
  - 01-Projects/observer-native/strategic-plan-bootstrap-to-sovereignty.md
  - 01-Projects/dir-engine/.prd/PRD-20260403-dir-structural-engine.md
  - 00-Inbox/qho-falsification-langevin-reframing-20260403-DRAFT.md
---

# BTC Regime Detection — D/I/R Composition Trading System

> A regime detection system that computes D/I/R structural vectors from BTC price data, classifies market state into composition basins, and selects trading strategies by regime — validating D/I/R universality on non-text data while funding Observer research.

---

## STATUS

| What | State |
|------|-------|
| Progress | 0/41 criteria passing |
| Phase | DRAFT → PLAN (Adam approved with amendments) |
| Next action | Begin Phase A: feature engineering + K=9 feasibility validation |
| Blocked by | D/I/R engine (Task 3) for MCP algebra — but Phase A (feasibility) can start immediately with standalone Python |

---

## 1. CONTEXT

### 1.1 Problem Space

D/I/R has been validated on text data: K=9 clustering confirms 9 composition basins in the structural feature space. The operators (Distinction, Integration, Recursion) are defined abstractly — they should apply to any domain where things are separated, connected, and feed back on themselves.

Markets exhibit all three dynamics:
- **Trending markets** create new price boundaries (D)
- **Ranging markets** converge toward equilibrium (I)
- **Reflexive markets** exhibit self-reinforcing feedback (R)

If D/I/R works on price data, two things happen: (1) the theory is validated as domain-agnostic, not text-specific, and (2) the trading system can fund Observer research without commercializing the core framework.

If D/I/R doesn't work on price data, that's also valuable — it tells us the operators are text-specific, and we stop before wasting time.

### 1.2 Strategic Position

This is **Task 8** (strategic plan). It depends on Task 3 (D/I/R engine) for composition algebra, but the core classification can be built standalone in Python. The project serves two purposes:

1. **Revenue**: Fund Observer research (M5 Max hardware, compute costs) without external capital
2. **Validation**: Prove D/I/R operators work on non-text data — the strongest possible evidence for universality

Risk assessment from the strategic plan: *"D/I/R on non-text data is a stretch. If it doesn't work for market data, it tells us the operators are text-specific, which is useful knowledge."*

### 1.3 Theoretical Foundation — The Langevin Model

The QHO wave equation was falsified and replaced by a multi-well dissipative model:

```
∂x/∂t = −∇E(x) + √(2T)η(t)
```

The energy landscape has 9 basins at empirical centroids:

```
E(x) = −Σᵢ Aᵢ · exp(−||x − cᵢ||² / 2σᵢ²) + λ||x||⁴
```

Key properties for trading:
- **The centre is a saddle point** — balanced D/I/R is maximally unstable. Markets must break symmetry into axis-dominant regimes. This matches market intuition: markets are always doing something (trending, ranging, or feeding back).
- **Adjacent basins have lower barriers** — compositions sharing an operator transition more easily. D(I) → D(R) is more likely than D(I) → R(R). This predicts which regime transitions are common.
- **Temperature T controls noise** — high volatility environments blur regime boundaries. Classification confidence drops when T is high. This naturally maps to position sizing.

### 1.4 Key Files

| File | Role |
|------|------|
| `01-Projects/dir-engine/.prd/PRD-20260403-dir-structural-engine.md` | D/I/R engine interface (dir_classify vector input path) |
| `00-Inbox/qho-falsification-langevin-reframing-20260403-DRAFT.md` | Langevin model: energy landscape, barrier crossings, basin topology |
| `01-Projects/dataset-processor/scripts/dir-vectorize-cluster.py` | Reference: how K=9 validation was done on text data |
| `01-Projects/dataset-processor/scripts/backfill-compositions.py` | Reference: cluster → composition mapping approach |

### 1.5 Constraints

- **Paper trading only** until regime detection is validated on ≥1 year historical data with documented edge
- **Freqtrade** as execution engine (Python, existing ecosystem, no custom execution)
- **BTC first** — expand to ETH/SOL only after BTC validation
- **No live capital** until Sharpe ratio (regime-aware) > Sharpe ratio (baseline) on out-of-sample data
- **In-process classification** for the hot path (every candle). MCP engine (`dir_classify`, `dir_compose`) for offline analysis only — latency matters.
- **Sequential gating** — each phase produces a go/no-go decision. Don't build Phase C if Phase B fails.

### 1.6 Decisions Made

| Decision | Rationale |
|----------|-----------|
| Separate centroid space for price data | Text centroids were fit on text features. Price features are a different space. The trading system fits its own centroids and tests whether K=9 emerges independently — the strongest universality validation. |
| In-process Python classification, not MCP | Every candle needs classification. MCP stdio round-trips add latency and complexity. Classification is a simple nearest-centroid lookup; Python does it trivially. MCP engine used for algebra/analysis. |
| 12 features → 6D vector pipeline | 4 features per axis (D, I, R), aggregated and normalized. Remaining 3 dimensions: temporal persistence, signal density, axis entropy. Same 6D structure as text for cross-domain comparability. |
| Sequential phases with hard gates | Each phase validates a hypothesis. Building downstream before upstream is validated wastes effort. Phase A gates everything. |
| Regime confidence as position size | Confidence from nearest-centroid distance directly maps to conviction. High confidence = full position. Low confidence (transition zone) = reduced position. |

### 1.7 The Centroid Space Problem

The D/I/R engine's centroids were fit on text vectors: `[D_text, I_text, R_text, temporal_text, density_text, entropy_text]`. Price vectors exist in a different feature space: `[D_price, I_price, R_price, temporal_price, density_price, entropy_price]`.

Passing price vectors through text centroids is invalid — the absolute values, distributions, and correlations between dimensions differ.

**Resolution:** The trading system fits its own centroids on historical BTC price vectors. If K=9 emerges independently from price data (matching the text domain result), that's powerful evidence for D/I/R universality. If K≠9, we fall back to 3-regime classification (D/I/R dominant axis) or accept the negative result.

Cross-domain comparison happens at the composition level (both domains produce the same composition labels), not the vector level.

---

## 2. ARCHITECTURE

### 2.1 D/I/R Feature Computation from OHLCV

For each rolling window of N candles (default: 48 bars on 1h = 2 days):

**D-axis (Distinction) — rate of boundary creation:**

| Feature | Computation | Why D |
|---------|-------------|-------|
| `realized_vol` | std(log_returns) × √(annualization_factor) | Volatility IS distinction-making: price levels being separated |
| `atr_ratio` | ATR(N) / ATR(3×N) | >1 = range expanding (new boundaries), <1 = compressing |
| `new_extremes` | count(new_high ∨ new_low over N) / N | Literal creation of new price territory |
| `range_expansion` | (max−min over N) / (max−min over 3×N) | How much of the current range is new vs historical |

**I-axis (Integration) — convergence toward equilibrium:**

| Feature | Computation | Why I |
|---------|-------------|-------|
| `mean_reversion` | −autocorrelation(log_returns, lag=1), clipped ≥ 0 | Negative autocorrelation = price reverting (integrating) |
| `hurst_mr` | max(0, 0.5 − hurst_exponent) | Hurst < 0.5 = anti-persistent = mean-reverting |
| `vwap_proximity` | 1 − \|close − VWAP\| / ATR, clipped [0,1] | How close price stays to "fair value" |
| `band_compression` | 1 − BB_width / max(BB_width over 3×N) | Bollinger bands narrowing = range converging |

**R-axis (Recursion) — self-reinforcing feedback:**

| Feature | Computation | Why R |
|---------|-------------|-------|
| `autocorr` | max(0, autocorrelation(log_returns, lag=1)) | Positive autocorrelation = returns predicting returns |
| `hurst_persist` | max(0, hurst_exponent − 0.5) | Hurst > 0.5 = persistent = self-reinforcing |
| `vol_clustering` | GARCH(1,1) α + β, clipped [0,1]. **Build constraint:** GARCH(1,1) frequently fails to converge on windows < 100 bars. On convergence failure, fall back to realised vol autocorrelation: corr(σ_t, σ_{t-1}). Same signal without optimisation failure. | Volatility feeding back into volatility |
| `momentum_persist` | correlation(returns[t], returns[t+1]) over N, clipped ≥ 0 | Serial momentum = recursion in returns |

**Resolving the D/R tension for trends:** D measures *creation of new territory* (new highs/lows, range expansion). R measures *self-reinforcement* (autocorrelation, persistence). A breakout into new highs scores high D. A momentum continuation within known range scores high R. They overlap in strong trends but are distinguishable — a strong trend scores high on both, which increases entropy and reduces classification confidence. This is correct: a strong trend IS structurally ambiguous between D and R.

**Aggregation to 6D vector:**

```
For each axis ∈ {D, I, R}:
    raw_score = Σ (feature_value)  for each of 4 features
    # Feature values individually normalized 0-1 via rolling min-max over training set

vector[0] = D_raw
vector[1] = I_raw
vector[2] = R_raw
vector[3] = regime_persistence / max_persistence    # temporal: how long current dominant axis held
vector[4] = (D_raw + I_raw + R_raw) / max_density   # density: total signal strength
vector[5] = −Σ pᵢ log₂(pᵢ)                          # entropy: axis balance (pᵢ = axis_i / sum)

L2-normalize full 6D vector
```

### 2.2 Classification Pipeline

```
OHLCV DataFrame (N-bar rolling window)
    │
    ├─ Compute 12 raw features (4 per axis)
    ├─ Normalize each feature 0-1 (rolling min-max)
    ├─ Aggregate to 6D vector [D, I, R, temporal, density, entropy]
    ├─ L2 normalize
    │
    ├─ Phase A result: test K ∈ {3,5,7,9,12}, compare silhouette scores
    │
    ├─ If K=9 confirmed:
    │    ├─ Nearest centroid → cluster_id → composition
    │    ├─ Confidence: 1 - (d_nearest / d_second_nearest)
    │    └─ Full 9-composition regime output
    │
    └─ If K=9 not confirmed:
         ├─ Regime = argmax(D, I, R)
         ├─ Confidence: max(D,I,R) / sum(D,I,R)
         └─ 3-regime fallback output
```

### 2.3 Regime Transition Detection

Under the Langevin model, a regime transition in progress manifests as:

1. **Confidence dropping** — the vector is moving away from its current basin centre
2. **Entropy rising** — D/I/R scores becoming more balanced (approaching the saddle)
3. **Adjacent basin distance decreasing** — the next-nearest centroid is getting closer

**Transition signal:**
```
transition_score = (1 - confidence) × entropy × (1 / distance_to_second_nearest)
```

When `transition_score` exceeds a threshold (calibrated on training data), the system is in the "ridge zone" between basins. Trading response: reduce position size.

**Transition prediction from Langevin barrier model:**
- Adjacent basins (shared operator) → lower barrier → more likely transition
- Current composition D(I) → most likely next states: D(D), D(R), I(I) (share D or I)
- Least likely next state: R(R) (no shared operator)
- This gives directional bias for the transition: if D(I) is weakening, prepare for D(D) or I(I)

### 2.4 Strategy Selection

**If K=9 confirmed — 9-composition strategy mapping:**

| Composition | Market Regime | Strategy | Position Size |
|------------|--------------|----------|---------------|
| D(D) | Strong breakout, new territory | Aggressive trend-following, wide stops | Full |
| D(I) | Trending within structure | Range breakout with defined target | Full |
| D(R) | Momentum-driven trend | Momentum with trailing stop | Full |
| I(D) | Consolidation with clear levels | Support/resistance range trading | Reduced |
| I(I) | Deep compression | Flat / wait for breakout signal | Minimal |
| I(R) | Mean-reversion oscillation | Oscillator strategies (RSI/Stoch) | Reduced |
| R(D) | Early trend formation (feedback creating boundaries) | Early trend entry, tight stops | Moderate |
| R(I) | Oscillatory feedback (whipsaw) | Counter-trend scalping or flat | Reduced |
| R(R) | Pure reflexivity (bubble/crash) | Defensive: reduce exposure, set hedges | Minimal |

**If 3-regime fallback:**

| Regime | Strategy | Position Size |
|--------|----------|---------------|
| D-dominant | Trend-following | Full |
| I-dominant | Mean-reversion / range | Reduced |
| R-dominant | Defensive / flat | Minimal |

**Position sizing by confidence:**
```
position_size = base_size × confidence × regime_size_multiplier
```
Where `regime_size_multiplier` comes from the table above (Full=1.0, Reduced=0.5, Moderate=0.7, Minimal=0.2).

### 2.5 Data Pipeline

```
Exchange API (Binance/Kraken via Freqtrade)
    │
    └─ OHLCV 1h candles (BTC/USDT)
         │
         ├─ Feature Computer (populate_indicators)
         │    └─ 12 features → 6D vector → regime + confidence
         │
         ├─ Strategy Selector (populate_entry_trend / populate_exit_trend)
         │    └─ Regime → strategy-specific entry/exit conditions
         │
         └─ Execution (Freqtrade)
              └─ Paper trading → validated → small capital

For offline analysis / development:
    6D vectors → dir_classify (MCP, for cross-domain comparison)
    Compositions → dir_compose (MCP, for transition algebra)
    Regime labels → dir_evaluate (MCP, for mapping quality assessment)
```

### 2.6 Multi-Timeframe Extension (deferred)

The Langevin temperature parameter maps to timeframe noise:
- 1h data: high T (noisy, local dynamics)
- 4h data: medium T (smoother, intermediate trends)
- 1d data: low T (clean, macro regimes)

**Deferred to v2.** Start with single timeframe (1h) for validation simplicity. Add multi-timeframe only after single-timeframe edge is confirmed.

---

## 3. BUILD PHASES

### Phase A: Feasibility Validation (GATE)

**Package:** `src/features/` + `notebooks/`
**Dependencies:** None (standalone Python, no D/I/R engine needed)
**Effort:** Half a day
**This is the go/no-go gate for the entire project.**

**What to build:**
- `src/features/indicators.py` — 12 feature computation functions:
  - 4 D-axis: realized_vol, atr_ratio, new_extremes, range_expansion
  - 4 I-axis: mean_reversion, hurst_mr, vwap_proximity, band_compression
  - 4 R-axis: autocorr, hurst_persist, vol_clustering, momentum_persist
- `src/features/vectorizer.py` — 12 features → 6D vector aggregation + L2 normalization
- `notebooks/phase-a-feasibility.ipynb` — Validation notebook:
  - Download 1 year BTC 1h OHLCV (via ccxt or Freqtrade data download)
  - Compute 6D vectors for all rolling windows
  - Run K-means for K ∈ {3, 5, 7, 9, 12}
  - Compare silhouette scores
  - Visualize clusters (3D D/I/R scatter, colored by cluster)
  - Report: does K=9 emerge?

**What NOT to build:**
- No Freqtrade integration (too early)
- No strategy logic
- No MCP integration

**Gate criterion:** K=9 silhouette score ≥ K=3 silhouette score AND K=9 silhouette > 0.15 (meaningful clustering, not noise). If this fails, evaluate whether K=3 (D/I/R dominant) is viable as a simpler regime model. If K=3 also fails (silhouette < 0.1), the project stops — D/I/R doesn't separate market dynamics.

**ISC Exit Criteria:**

- [ ] **ISC-A1:** 12 feature functions compute without error on 1yr BTC 1h OHLCV | Verify: Test: no NaN/Inf in output
- [ ] **ISC-A2:** Each feature produces values in [0, 1] after normalization | Verify: Test: min/max check
- [ ] **ISC-A3:** 6D vectors are L2-normalized (magnitude ∈ [0.999, 1.001]) | Verify: Test: magnitude check
- [ ] **ISC-A4:** K-means runs for K ∈ {3,5,7,9,12} without error | Verify: CLI: `python -m pytest test/test_features.py`
- [ ] **ISC-A5:** Silhouette scores computed and compared across K values | Verify: Test: scores array length == 5
- [ ] **ISC-A6:** Visualization notebook runs end-to-end producing cluster scatter plot | Verify: Read: notebook output cells non-empty
- [ ] **ISC-A7:** Gate decision documented: K=9 status (confirmed / fallback / stop) | Verify: Read: notebook markdown cell with conclusion
- [ ] **ISC-A8:** Hurst exponent computation validated against known test cases (H=0.5 for random walk) | Verify: Test: synthetic random walk → H ∈ [0.45, 0.55]
- [ ] **ISC-A9:** Pairwise correlation between D, I, R axis scores < 0.7 (axes are not trivially correlated — features are actually distinguishing different dynamics) | Verify: Test: corr(D,I), corr(D,R), corr(I,R) all < 0.7

---

### Phase B: Regime Classifier (depends on Phase A pass)

**Package:** `src/classifier/`
**Dependencies:** Phase A (feature computation validated, K decision made)

**What to build:**
- `src/classifier/regime.py` — Regime classification:
  - `fit(vectors: np.ndarray) → centroids` — fit K-means (K=9 or K=3 depending on Phase A)
  - `classify(vector: np.ndarray) → RegimeResult` — nearest centroid, composition, confidence
  - `transition_score(history: list[RegimeResult]) → float` — transition detection
  - Centroid export to JSON (compatible with D/I/R engine manifest format for cross-domain comparison)
- `src/classifier/mapping.py` — Cluster → composition mapping:
  - Inspect centroid axis weights to assign compositions
  - Validate that all expected compositions are represented
  - Export mapping to JSON
- `notebooks/phase-b-regimes.ipynb` — Regime analysis notebook:
  - Label historical data with regimes
  - Visualize regime timeline overlaid on price chart
  - Analyze regime durations, transition frequencies
  - Check: do regime labels correspond to known market conditions?
  - Transition matrix: which regime → which regime transitions are most common?
  - Test adjacency prediction: do shared-operator transitions dominate?

**What NOT to build:**
- No Freqtrade integration (next phase)
- No live data fetching
- No strategy execution

**Gate criterion:** Regime labels must correlate with identifiable market conditions. Specifically:
- D-dominant regimes should coincide with visually identifiable trends
- I-dominant regimes should coincide with ranging/consolidation periods
- R-dominant regimes should coincide with sharp reversals or momentum cascades
- Regime duration median > 6 hours (regimes that flicker every bar are noise, not signal)

**ISC Exit Criteria:**

- [ ] **ISC-B1:** fit() produces K centroids with explained variance ratio > 0.3 | Verify: Test: sklearn metrics
- [ ] **ISC-B2:** classify() returns composition, confidence ∈ [0,1], and cluster_id for every input | Verify: Test: schema check on 100 vectors
- [ ] **ISC-B3:** Cluster → composition mapping covers all expected compositions | Verify: Test: set equality check
- [ ] **ISC-B4:** transition_score increases when regime is about to change (tested on known transitions) | Verify: Test: synthetic transition sequence
- [ ] **ISC-B5:** Centroid export produces valid JSON matching D/I/R engine manifest format | Verify: Test: schema validation
- [ ] **ISC-B6:** Regime timeline notebook shows non-degenerate distribution (no single regime > 60% of time) | Verify: Read: regime distribution in notebook
- [ ] **ISC-B7:** Median regime duration > 6 hours (regimes are stable, not flickering) | Verify: Test: duration statistics
- [ ] **ISC-B8:** Transition matrix shows shared-operator transitions more frequent than non-shared | Verify: Test: adjacency correlation > 0

---

### Phase C: Freqtrade Strategy + Backtesting (depends on Phase B pass)

**Package:** `src/strategy/` + `src/backtest/`
**Dependencies:** Phase B (regime labels validated as meaningful)

**What to build:**
- `src/strategy/dir_regime.py` — Freqtrade strategy class:
  - `DIRRegimeStrategy(IStrategy)` — main strategy
  - `populate_indicators()` — compute features, classify regime, compute confidence
  - `populate_entry_trend()` — regime-specific entry conditions:
    - D-dominant: enter long on breakout confirmation
    - I-dominant: enter on mean-reversion signal (RSI oversold at support)
    - R-dominant: reduce/flat (or short on confirmation)
  - `populate_exit_trend()` — regime transition exit:
    - Exit when regime changes OR confidence drops below threshold
    - Trailing stop calibrated by regime (wide for D, tight for I)
  - `custom_stake_amount()` — position sizing: `base × confidence × regime_multiplier`
- `config/freqtrade-backtest.json` — Backtest configuration:
  - BTC/USDT, 1h candles
  - ≥1 year data (2025-04 to 2026-04)
  - Paper trading mode
  - Risk management parameters
- `src/backtest/baselines.py` — Baseline strategies for comparison:
  - Buy-and-hold
  - Simple MA crossover (50/200)
  - Static strategy (always trend-follow, always mean-revert)
- `notebooks/phase-c-backtest.ipynb` — Backtest analysis:
  - Run DIR strategy vs all baselines
  - Sharpe ratio comparison
  - Drawdown comparison
  - Win rate by regime
  - Equity curves
  - Regime-to-performance correlation

**What NOT to build:**
- No multi-pair support (BTC only)
- No multi-timeframe (single 1h)
- No live exchange connection
- No 9-composition strategy refinement in first pass (use 3-regime strategies, expand to 9 if K=9 confirmed and 3-regime shows edge)

**Gate criterion:** Sharpe ratio (DIR strategy) > Sharpe ratio (best baseline) on out-of-sample test period (last 3 months held out). If the regime detector doesn't add value over buy-and-hold or MA crossover, the structural edge isn't there.

**ISC Exit Criteria:**

- [ ] **ISC-C1:** DIRRegimeStrategy runs in Freqtrade backtest without error | Verify: CLI: `freqtrade backtesting --strategy DIRRegimeStrategy`
- [ ] **ISC-C2:** Strategy produces ≥50 trades over 1-year backtest | Verify: CLI: trade count from backtest output
- [ ] **ISC-C3:** Sharpe ratio computed for DIR strategy and all baselines | Verify: Test: all Sharpe values are finite numbers
- [ ] **ISC-C4:** DIR strategy Sharpe > buy-and-hold Sharpe on out-of-sample period | Verify: Test: comparison assertion
- [ ] **ISC-C5:** Max drawdown (DIR) < max drawdown (buy-and-hold) | Verify: Test: comparison assertion
- [ ] **ISC-C6:** Win rate in D-dominant regime > win rate in I-dominant regime for trend-following trades | Verify: Test: per-regime win rate breakdown
- [ ] **ISC-C7:** Position sizing scales with confidence (higher confidence → larger positions) | Verify: Test: correlation(confidence, position_size) > 0
- [ ] **ISC-C8:** Backtest uses proper train/test split (first 9 months train, last 3 months test) | Verify: Read: config date ranges

---

### Phase D: Paper Trading (depends on Phase C pass)

**Package:** `config/` + `src/monitor/`
**Dependencies:** Phase C (backtest shows edge over baselines)

**What to build:**
- `config/freqtrade-paper.json` — Paper trading configuration:
  - Binance or Kraken sandbox/testnet
  - BTC/USDT, 1h candles
  - Paper trading mode (no real capital)
  - Telegram notifications for regime changes and trades
- `src/monitor/dashboard.py` — Simple monitoring:
  - Current regime + confidence
  - Regime history (last 7 days)
  - P&L tracking (paper)
  - Comparison to baseline (live buy-and-hold)
- `src/monitor/mcp_bridge.py` — MCP integration for analysis:
  - Send vectors to `dir_classify` for cross-domain comparison
  - Use `dir_compose` to analyze transition patterns
  - Use `dir_evaluate` to assess regime indicator quality
  - This is for development analysis, not the trading hot path

**What NOT to build:**
- No real capital deployment (paper only)
- No multi-pair (BTC only)
- No automated parameter optimization
- No web dashboard (terminal output + Telegram sufficient)

**Gate criterion:** Paper trading P&L > baseline P&L over ≥1 month continuous paper trading. If paper matches or underperforms, investigate overfitting before proceeding to live.

**ISC Exit Criteria:**

- [ ] **ISC-D1:** Freqtrade connects to exchange API in paper/sandbox mode | Verify: CLI: `freqtrade trade --dry-run` starts without error
- [ ] **ISC-D2:** Regime classification runs on live candles without error for ≥24 hours | Verify: CLI: check logs for 24h runtime
- [ ] **ISC-D3:** Telegram notifications sent on regime change | Verify: Test: manual regime change trigger → notification received
- [ ] **ISC-D4:** Dashboard reports current regime, confidence, and paper P&L | Verify: CLI: dashboard output shows all fields
- [ ] **ISC-D5:** MCP bridge successfully calls dir_classify with price-derived vector | Verify: CLI: bridge returns valid composition
- [ ] **ISC-D6:** MCP bridge successfully calls dir_compose for transition analysis | Verify: CLI: compose("D","I") returns valid result
- [ ] **ISC-D7:** Paper trading runs continuously for ≥7 days without crash | Verify: CLI: uptime check
- [ ] **ISC-D8:** Regime-strategy alignment: ≥70% of trades executed in their intended regime | Verify: Test: trade log analysis

---

## 4. DEPENDENCY GRAPH

```
Phase A (feasibility) ──[GATE: K=9?]──→ Phase B (classifier) ──[GATE: regimes meaningful?]──→ Phase C (backtest)
                                                                                                      │
                                                                                          [GATE: edge exists?]
                                                                                                      │
                                                                                               Phase D (paper)
                                                                                                      │
                                                                                          [GATE: paper profitable?]
                                                                                                      │
                                                                                              Live (future, not in PRD)
```

| Phase | Can Start After | Gate Decision |
|-------|----------------|---------------|
| A | Nothing (immediate) | K=9 silhouette ≥ K=3 AND > 0.15; else K=3 fallback or stop |
| B | Phase A pass | Regimes correlate with market conditions; median duration > 6h |
| C | Phase B pass | DIR Sharpe > baseline Sharpe on out-of-sample |
| D | Phase C pass | Paper P&L > baseline over ≥1 month |

**Each gate is a go/no-go decision. A failed gate means STOP, not "push through."**

Fallback at each gate:
- **A fails (K=9):** Try K=3 (3-regime). If K=3 silhouette < 0.1, project stops.
- **B fails (meaningless regimes):** Iterate feature engineering (different indicators, different window). Max 2 iterations, then stop.
- **C fails (no edge):** Analyze why. If regimes are correct but strategy is wrong → iterate strategy. If regimes don't predict performance → stop.
- **D fails (paper underperforms):** Investigate overfitting. If confirmed → stop.

---

## 5. PROJECT STRUCTURE

```
01-Projects/trading-system/
├── .prd/
│   └── PRD-20260403-btc-regime-detection.md     # This document
├── requirements.txt                              # Python dependencies
├── setup.py                                      # Package setup
├── src/
│   ├── features/
│   │   ├── indicators.py                         # Phase A: 12 feature functions
│   │   └── vectorizer.py                         # Phase A: 6D aggregation + normalization
│   ├── classifier/
│   │   ├── regime.py                             # Phase B: fit, classify, transition_score
│   │   └── mapping.py                            # Phase B: cluster → composition
│   ├── strategy/
│   │   └── dir_regime.py                         # Phase C: Freqtrade strategy class
│   ├── backtest/
│   │   └── baselines.py                          # Phase C: comparison strategies
│   └── monitor/
│       ├── dashboard.py                          # Phase D: terminal monitoring
│       └── mcp_bridge.py                         # Phase D: MCP integration for analysis
├── config/
│   ├── freqtrade-backtest.json                   # Phase C: backtest config
│   └── freqtrade-paper.json                      # Phase D: paper trading config
├── notebooks/
│   ├── phase-a-feasibility.ipynb                 # Phase A: K=9 validation
│   ├── phase-b-regimes.ipynb                     # Phase B: regime analysis
│   └── phase-c-backtest.ipynb                    # Phase C: backtest analysis
├── data/
│   ├── btc-1h-ohlcv.csv                          # Downloaded price data (gitignored)
│   ├── centroids.json                            # Fitted centroids (Phase B output)
│   └── regime-labels.csv                         # Historical regime labels
└── test/
    ├── test_features.py                          # Feature computation tests
    ├── test_classifier.py                        # Classification tests
    └── test_strategy.py                          # Strategy logic tests
```

**Location rationale:** Lives at `01-Projects/trading-system/` as an independent project. Consumes D/I/R engine via MCP for offline analysis but owns its own centroid data, feature pipeline, and execution stack.

---

## 6. CONFIGURATION

### 6.1 requirements.txt

```
numpy>=1.24
pandas>=2.0
scikit-learn>=1.3
scipy>=1.11
ccxt>=4.0
freqtrade>=2024.1
matplotlib>=3.7
arch>=6.0          # GARCH computation
```

### 6.2 Freqtrade Backtest Config (skeleton)

```json
{
  "stake_currency": "USDT",
  "stake_amount": "unlimited",
  "tradable_balance_ratio": 0.99,
  "dry_run": true,
  "trading_mode": "spot",
  "exchange": {
    "name": "binance",
    "pair_whitelist": ["BTC/USDT"]
  },
  "timeframe": "1h",
  "strategy": "DIRRegimeStrategy"
}
```

---

## 7. RISK REGISTER

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| D/I/R doesn't separate market dynamics (K=9 fails) | Medium | Fatal (project stops) | Phase A gate. This is the biggest risk. Half-day investment to find out. |
| Regime labels are noisy / flicker too fast | Medium | High (unusable signal) | Window size tuning. Minimum regime duration filter. Smoothing. |
| Backtest overfitting | High | High (paper trading fails) | Strict train/test split. Walk-forward validation. Conservative position sizing. |
| Hurst exponent computation unstable on short windows | Medium | Medium (R-axis unreliable) | Multiple R-axis features reduce dependency on any single metric. Validate Hurst on synthetic data (ISC-A8). |
| Feature normalization drift in live trading | Medium | Medium (classification shifts) | Rolling normalization window. Monitor feature distributions. |
| Regime transitions too slow to be actionable | Low | Medium (miss entries/exits) | Transition detection signal (Section 2.3). Position sizing by confidence reduces damage from late detection. |
| Exchange API downtime / data gaps | Low | Low (missed candles) | Freqtrade handles reconnection. Feature computation is window-based — survives gaps. |

---

## 8. SECURITY

Minimal security surface — this is a local Python service consuming public market data.

| Constraint | Enforcement |
|-----------|------------|
| No real capital in Phase D | `dry_run: true` in Freqtrade config. ISC-D1 verifies. |
| API keys not in git | `.gitignore` includes `config/*.json` with secrets. Freqtrade reads keys from env vars. |
| No external network calls from classification | Feature computation and classification are pure computation on local data. Only exchange API and MCP (localhost) are network calls. |
| OIL secret gate | Pre-commit hook validates no API keys/tokens in commits. |

---

## 9. RESOLVED QUESTIONS

All open questions resolved by Adam on 2026-04-03:

| # | Question | Resolution |
|---|----------|-----------|
| 1 | What rolling window size? | **Test all three (24h, 48h, 72h) in Phase A.** Pick by silhouette score. Costs nothing in Phase A, gives the right window before building downstream. |
| 2 | Feature normalization: global or rolling? | **Start global for backtest, switch to rolling for live.** Compare in Phase D. |
| 3 | 3-regime first or 9-composition from day one? | **3-regime first. Confirmed.** Build D=trend, I=revert, R=defensive. Expand to 9-composition ONLY if K=9 confirmed AND 3-regime shows edge. Jumping to 9 composition-specific strategies is premature optimisation with heavy overfitting risk on one year of data. |
| 4 | GARCH convergence failures? | **Build constraint, not optional.** GARCH(1,1) frequently fails on windows < 100 bars. Mandatory fallback to realised vol autocorrelation: corr(σ_t, σ_{t-1}). Promoted from open question to build constraint in Section 2.1 vol_clustering feature definition. |
| 5 | Where does the live capital gate sit? | **Explicitly NOT in this PRD.** Separate decision document after ≥1 month profitable paper trading. Adam decides, not Atlas. |

---

## 10. RELATIONSHIP TO D/I/R ENGINE

The trading system and D/I/R engine are **complementary but independent**:

| Aspect | Trading System | D/I/R Engine |
|--------|---------------|-------------|
| Language | Python (Freqtrade ecosystem) | TypeScript (MCP ecosystem) |
| Classification | In-process sklearn KMeans | dir_classify via MCP |
| Centroids | Price-specific (fit on BTC OHLCV) | Text-specific (fit on NLP pipeline) |
| Hot path | Every candle (in-process) | On-demand (MCP tool call) |
| Shared | Composition algebra concepts, 6D vector structure | dir_compose, dir_evaluate tools |

**Cross-domain validation:** If both systems independently produce K=9 clusters that map to the same 9 compositions, that's the strongest evidence for D/I/R universality. The compositions are the shared language — both domains produce structural labels from the same algebra, even though the feature spaces differ.

**MCP integration points (Phase D, offline analysis only):**
- `dir_classify`: Compare price-derived classification with what the text-trained engine would say (expect divergence — that's informative, not wrong)
- `dir_compose`: Analyze regime transitions using composition algebra (e.g., "D(I) → D(R): these share D, barrier should be low")
- `dir_evaluate`: Assess whether new price-derived indicator patterns satisfy c/i/d motif predicates

---

## LOG

### Iteration 0 — 2026-04-03 — DRAFT
- **Phase reached:** DRAFT
- **Criteria progress:** 0/40
- **Work done:** PRD authored after 3 full D/I/R cycles. Key design decisions: separate centroid space for price data (universality test), in-process classification (latency), sequential gating (fail fast), 12 features → 6D vector pipeline. The centroid space problem was the critical architectural insight — can't reuse text centroids for price data.
- **Failing criteria:** All (not yet built)
- **Context for next:** Adam reviews PRD. Key decision points: open questions 1-5, especially Q3 (3-regime first vs 9-composition).

### Iteration 1 — 2026-04-03 — DRAFT (reviewed)
- **Phase reached:** DRAFT → PLAN (Adam approved with amendments)
- **Criteria progress:** 0/41 (1 new ISC added)
- **Work done:** All 5 open questions resolved. Amendments applied:
  - Q1: Test all three windows (24, 48, 72h) in Phase A. Confirmed.
  - Q3: 3-regime first, confirmed. Expand to 9 only after edge proven + K=9 confirmed. Premature optimisation risk with 1yr data.
  - Q4: GARCH fallback promoted from open question to build constraint. Mandatory fallback to realised vol autocorrelation on convergence failure.
  - Q5: Live capital explicitly not in this PRD. Adam decides after ≥1 month paper trading.
  - ISC-A9 added: pairwise D/I/R axis correlation < 0.7 (axes must not be trivially correlated).
  - Phase B transition matrix adjacency test confirmed as strong falsifiable prediction from multi-well topology.
- **Failing criteria:** All (not yet built)
- **Context for next:** Begin Phase A. Download BTC 1h OHLCV, implement 12 features, run K=9 feasibility test.
- **Context for next:** Adam reviews PRD. Key decision points: open questions 1-5, especially Q3 (3-regime first vs 9-composition).
