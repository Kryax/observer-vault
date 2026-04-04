# BTC Trading System — Atlas PRD Prompt

## For Atlas — D/I/R Exploration → PRD

**Project:** D/I/R Composition-Based Regime Detection for Crypto Trading

**Context:** This is Task 8 in the strategic plan (`01-Projects/observer-native/strategic-plan-bootstrap-to-sovereignty.md`). It depends on the D/I/R engine (Task 3, currently building) and serves two purposes: (1) fund Observer research without commercialising the core framework, and (2) validate D/I/R on non-text data — proving the operators work on price series, not just NLP.

Read: strategic plan Task 8 section, the D/I/R engine PRD (`01-Projects/dir-engine/.prd/PRD-20260403-dir-structural-engine.md` — especially Section 2.4 on the vector input path and Section 2.7 on the Langevin model), and the QHO falsification document (`00-Inbox/qho-falsification-langevin-reframing-20260403-DRAFT.md`).

**The key theoretical context (new since strategic plan was written):**

The QHO wave equation was falsified and replaced by a Langevin/multi-well dissipative model:

```
∂x/∂t = −∇E(x) + √(2T)η(t)
```

The D/I/R space has 9 empirical basins (confirmed K=9 clustering). The centre is a saddle point — stable states require symmetry breaking into axis-dominant compositions. Market regimes map to this topology:

- **D-dominant regimes** (trending, breakout, new boundaries): price action creates new distinctions between levels. Volatility structure is the D-axis signal.
- **I-dominant regimes** (ranging, mean-reverting, consolidation): price action converges toward equilibrium. Correlation and mean-reversion metrics are the I-axis signal.
- **R-dominant regimes** (reflexive, feedback-driven, bubble/crash): price action feeds back on itself. Autocorrelation, Hurst exponent, and reflexivity measures are the R-axis signal.

Regime transitions are barrier crossings in the multi-well landscape. Adjacent basins (sharing an operator) have lower barriers — transitions between them are more common.

**The D/I/R engine provides `dir_classify` with a vector input path.** The trading system computes a 6D vector from price data and passes it to the engine for composition assignment. No text involved — this is text-free D/I/R.

**Directional questions:**

1. How do you compute D, I, R from OHLCV price data? What specific metrics map to each axis, and what goes in the temporal/density/entropy dimensions? The mapping must be principled, not forced — if D/I/R doesn't naturally separate market dynamics, that's a valid negative result.

2. What's the right granularity? Per-candle classification? Rolling window? Multi-timeframe? The Langevin dynamics suggest a rolling window where the system state evolves continuously, not discrete per-bar classification.

3. How does regime classification drive strategy selection? The strategic plan says "trend-following in D-regimes, mean-reversion in I-regimes, defensive in R-regimes." Is this the right mapping? What about the 9 specific compositions — does D(I) vs D(D) vs D(R) suggest different trend-following variants?

4. What does the architecture look like? Freqtrade as execution engine is already decided. Where does the D/I/R engine sit in the pipeline? How does the regime signal reach the strategy selector?

5. What's the minimum viable validation? The strategic plan says backtest on ≥1 year BTC data. What specific metrics prove the regime detector adds value over baseline?

6. How do composition transitions map to trade signals? The strategic plan says "D→I = trend exhaustion, I→R = volatility expansion, R→D = new trend beginning." Under the multi-well model, these are barrier crossings. Can you detect a transition in progress (particle climbing the ridge) before it completes?

**Constraints:**
- Paper trading only until regime detection is validated on historical data
- Freqtrade as execution engine (Python, existing ecosystem)
- D/I/R engine consumed via MCP (dir_classify with vector input)
- No live capital until backtested on ≥1 year data with documented edge
- BTC first, expand to ETH/SOL only after BTC validation
- This funds Observer — it's a pragmatic tool, not a research project. Ship fast, validate fast.

**Existing patterns to study:**
- D/I/R engine PRD for the MCP interface pattern
- Strategic plan Task 8 for the original architecture sketch
- The Langevin reframing document for the multi-well topology that regime transitions map to

**Process:** Minimum 3 full D/I/R cycles on PRD creation. Use sub-agents for parallel investigation where the reads are independent. The D-phase should question whether the D/I/R-to-price-data mapping is even valid before committing to an architecture — this is the biggest risk in the entire project (D/I/R may be text-specific).
