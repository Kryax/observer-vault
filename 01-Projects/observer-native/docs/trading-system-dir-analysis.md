---
⚠️ VAULT SAFETY HEADER
authority_boundary: This document is VAULT content (narrative/rationale/planning).
vault_rule: The Workspace does NOT derive from this document.
human_gate: Promotion to canonical requires Adam's explicit approval.
ai_rule: AI agents may READ this document. AI agents may CREATE new documents referencing this one. AI agents may NOT modify canonical vault documents.
---

---
status: DRAFT
date: 2026-03-29
author: Atlas
type: architecture + transition-plan
authority: low
domain: [trading-system, income-transition, d-i-r-model, freqtrade, sovereignty]
method: 4-pass D/I/R triad (slow mode — convergence-checked at each R-phase)
mode: deep-analysis
motifs: [dual-speed-governance, explicit-state-machine-backbone, ratchet-with-asymmetric-friction, progressive-formalization, observer-feedback-loop, bounded-buffer-with-overflow-policy, estimation-control-separation, reconstruction-burden, safety-liveness-duality, idempotent-state-convergence]
refs:
  - 00-Inbox/crypto-trading-system-design-DRAFT.md
  - 01-Projects/observer-native/docs/experimental-llm-architecture-dir-analysis.md
  - 02-Knowledge/motifs/MOTIF_INDEX.md
  - 01-Projects/observer-native/SKILL.md
provenance: >
  Four-pass D/I/R analysis performed by Atlas on 2026-03-29. Slow triad mode —
  each pass reads the output of the prior pass before running. Part 1 redesigns
  the trading system with the D/I/R model as reasoning engine. Part 2 analyzes
  the income transition path with conservative financial planning. Convergence
  evaluated at each R-phase using motif algebra stability criteria (c/i/d).
  Adam holds sovereignty over all design decisions. Financial projections
  provide conservative/moderate/pessimistic scenarios — the family's security
  depends on the pessimistic scenario being survivable.
---

# Trading System + Income Transition — Deep D/I/R Analysis

> Four passes through the design space. Two interlocking systems:
> the trading architecture (what to build) and the transition plan (when to leap).
> Every assumption named. Every optimism challenged.

---

# Pass 1 — DISTINGUISH

## 1.1 The Two Systems Are Coupled But Separable

The trading system and the income transition are often conflated. They are NOT the same thing.

| Dimension | Trading System | Income Transition |
|-----------|---------------|-------------------|
| Nature | Technical architecture | Life decision |
| Failure mode | Lost capital | Family financial stress |
| Reversibility | Recoverable (capital can be rebuilt) | Partially reversible (can return to employment, but gap in career) |
| Dependencies | Infrastructure, code, market access | Trading system working + savings buffer + family agreement |
| Timeline | Can start now (paper trading) | Cannot start until multiple gates pass |

**Critical distinction**: The trading system can exist without the income transition. The income transition cannot exist without the trading system. This means: build the trading system first. Treat the transition as a future gate, not a near-term plan.

## 1.2 What Has Changed Since the Original Design

The original `crypto-trading-system-design-DRAFT.md` was written before the D/I/R model architecture was specified. Three things have changed materially:

### Change 1: Regime tagging no longer requires cloud LLM triangulation

The original design uses Claude and GPT in a three-phase pipeline (describe → interpret → recommend). This costs ~$42/month and depends on two external API services.

The D/I/R model, once built, would perform regime analysis locally using structural reasoning. No API dependency. No recurring cost. But the model doesn't exist yet, and may take 6-12+ months to reach the level where it could replace LLM regime tagging.

**Implication**: The original LLM triangulation design is NOT obsolete — it's the stepping stone. It should be built first. The D/I/R model replaces it later, if and when the model proves capable.

### Change 2: The model could reason about market structure, not just price patterns

Statistical approaches (RSI, EMA, Bollinger bands) see price as a time series. The D/I/R model would see market structure:

- **Noun stream**: What IS the market state? (price levels, volume profile, order book shape, correlation matrix)
- **Verb stream**: What is the market DOING? (trending, mean-reverting, distributing, accumulating, regime-transitioning)

This is the Estimation-Control Separation motif (T2) applied to markets: the noun encoder estimates state, the verb encoder estimates dynamics, the convergence layer maps between them.

**Implication**: The model could potentially detect regime transitions before they show up in standard indicators — it would "see" that the market's structural verb has changed even if the price noun hasn't moved yet. But this is a hypothesis, not a fact.

### Change 3: Self-updating through trading history

The model's Observer-Feedback Loop means it could learn from its own trading outcomes. Each trade becomes a data point: "Given this structural reading, I recommended this action, and the outcome was X." Over time, the model refines its structural reading.

**Implication**: The system gets better the longer it runs. But this also creates overfitting risk — the model could learn to fit its own past trades rather than genuine market structure.

## 1.3 Independent Design Decisions (Trading System)

### TD1: Execution Engine

**Decision**: Freqtrade as the execution layer.

**Status**: Unchanged from original design. Freqtrade is mature, self-hosted, supports Kraken, handles order management, backtesting, and paper trading. No compelling reason to change this.

### TD2: Market Data Pipeline

**Decision**: What data flows into the reasoning engine?

**Original**: OHLCV candles + standard indicators (RSI, EMA, ATR, Bollinger, Volume MA).

**With D/I/R model**: The model needs data that maps to noun and verb streams:

| Stream | Market Data | Encoding |
|--------|------------|----------|
| Noun (what IS) | OHLCV, volume profile, order book depth, funding rates, on-chain metrics (for crypto), correlation with BTC/ETH/macro | Raw values + normalization |
| Verb (what DOES) | Price momentum, volatility regime (expanding/contracting/stable), volume trend, rate of change of key indicators, structural breaks in time series | Derived features + regime labels |

**Before model exists**: Standard OHLCV + indicators → LLM triangulation → regime JSON.
**After model exists**: Extended data suite → D/I/R model → structural regime analysis.

The data pipeline must be designed to support both modes with the same downstream interface (regime JSON files that Freqtrade reads).

### TD3: Regime Detection Architecture

**Decision**: How are market regimes identified?

**Three-era design**:

| Era | Method | When |
|-----|--------|------|
| Era 0 (now) | Rule-based + indicators | During backtest development |
| Era 1 (months 1-12) | LLM triangulation (Claude + GPT) | Paper trading through micro-live |
| Era 2 (post-model) | D/I/R model structural reasoning | After model passes capability gates |

Each era produces the same output format: regime JSON files. Freqtrade doesn't care which era produced them. This is the **Explicit State Machine Backbone** (T2) — the regime is an explicit state with gated transitions, regardless of what determines the state.

### TD4: Risk Management Architecture

**Decision**: How is risk constrained?

**Status**: The original design's risk framework is sound and does not change with the D/I/R model:
- 2% per trade, 6% portfolio heat, 10% monthly drawdown circuit breaker
- No leverage
- Stop loss on every trade
- Circuit breakers that fail to cash

**Enhancement with D/I/R model**: The model's c/i/d coherence scores could serve as an additional risk signal:
- Low completeness (c) → market state is ambiguous → reduce position size
- Low independence (i) → noun and verb are saying the same thing → less information than it seems → reduce confidence
- Low decidability (d) → can't classify the regime → default to cash

This maps the motif algebra directly to risk management. But it's an enhancement, not a replacement — the hard risk limits remain unchanged regardless of model confidence.

### TD5: Strategy Library

**Decision**: What strategies execute within each regime?

**Status**: Unchanged. Simple strategies (EMA trend follow, mean reversion, breakout, Bollinger squeeze, risk-off cash) remain the execution layer. The intelligence is in regime detection, not in the strategies themselves. This separation is the design's key strength.

### TD6: Sovereignty Architecture

**Decision**: What external dependencies exist?

| Component | External Dependency | Sovereignty Status |
|-----------|-------------------|-------------------|
| Execution engine | Kraken exchange API | **Irreducible** — you need an exchange to trade |
| Market data | Kraken API (OHLCV) | **Irreducible** — you need price data |
| Era 1 regime tagging | Claude API + OpenAI API | **Temporary** — replaced by local model in Era 2 |
| Era 2 regime tagging | Local D/I/R model | **Sovereign** — runs on local hardware |
| Trade storage | SQLite on ZFS | **Sovereign** |
| Strategy execution | Freqtrade on Proxmox | **Sovereign** |
| Tax reporting | Koinly (external) | **Reducible** — could self-host, low priority |
| Notifications | Telegram API | **Convenient, not critical** — system works without it |

**Irreducible dependencies**: Exchange API and market data. These cannot be eliminated — trading requires a counterparty and price information. But they can be diversified:
- Multiple exchange support (Kraken primary, Binance backup)
- Multiple data sources (exchange API + CoinGecko/CoinCap as backup)
- All orders include exchange-side stop losses (survive API downtime)

### TD7: Observer Ecosystem Integration

**Decision**: How does the trading system feed back into the vault and motif library?

**Original design had this right**: Trading journal in vault, regime analyses archived, performance reports as vault documents, MCP tools for status queries.

**Enhancement**: Trading regime transitions are instances of **Explicit State Machine Backbone**. Circuit breaker activations are instances of **Ratchet with Asymmetric Friction**. The trading system becomes a live domain for motif library enrichment — the motifs don't just inform trading, trading informs the motifs.

## 1.4 Independent Design Decisions (Income Transition)

### IT1: Financial Runway Requirement

**Decision**: How many months of expenses must be saved before transitioning?

This is not a technical question. It depends on:
- Household monthly expenses (unknown to Atlas — Adam must provide)
- Michelle's income contribution (unknown)
- Risk tolerance as a family (unknown — this is a conversation, not a calculation)
- Superannuation implications (leaving employment stops employer contributions)

### IT2: Trading System Reliability Gate

**Decision**: How long must the system demonstrate consistent returns?

The original design has a five-gate pipeline. For income transition, additional gates are needed:
- Paper trading (8 weeks) → micro-live (4 weeks) → scale → **extended live track record → income transition gate**

The income transition gate requires performance data over *multiple market conditions*, not just a single bull run.

### IT3: Capital Requirement

**Decision**: How much capital must be deployed to generate income-replacement returns?

This is a mathematical relationship:
```
Required capital = Annual income needed / Annual return rate
```

**ASSUMPTION WARNING**: Any return rate assumption is speculative. Historical crypto returns vary wildly. See Section 6.1 for scenario analysis.

### IT4: Staged Transition vs. Full Leap

**Decision**: Go part-time first, or quit entirely?

This depends on mining industry employment norms (is part-time surveying possible on night shifts?) and Adam's contract terms.

### IT5: Fallback Architecture

**Decision**: What happens if the trading system stops working?

Must include: time-to-reemployment, financial bridge during the gap, skills currency (does surveying skill atrophy?), psychological impact of returning.

## 1.5 Tensions Discovered

**T1: The D/I/R model is the keystone but doesn't exist**

The trading system is designed with the model as the ultimate reasoning engine. But the model requires:
1. MVE-A success (data validation, 2-4 weeks)
2. MVE-B success (architecture validation, 2-3 months)
3. Full prototype with trading-specific training (additional months)
4. Capability demonstration on market data (additional time)

This is 6-18 months before the model could plausibly replace LLM triangulation for regime tagging. The trading system must work WITHOUT the model for this entire period.

**Resolution**: The three-era design. Era 0 and Era 1 are fully functional without the D/I/R model. The model is an upgrade path, not a prerequisite.

**T2: Conservative returns vs. income replacement math**

Conservative annual returns on crypto trading (after accounting for drawdowns, fees, taxes) might be 10-30% in a good year. To replace a mining surveyor salary (estimated $100K-150K AUD), you'd need $500K-1.5M in deployed capital at those returns.

ASSUMPTION: Mining surveyor night shift in NSW earns approximately $100K-150K AUD per year. This must be verified by Adam.

ASSUMPTION: Achievable conservative annual returns of 10-30%. This is speculative and depends on market regime distribution.

**What breaks if wrong**: If returns are lower (5-10%), the capital requirement doubles. If returns are negative in a given year, the system must survive on savings alone.

**T3: Sovereignty vs. exchange dependency**

The system cannot be fully sovereign — it must interact with centralized exchanges. Exchange risks include:
- API changes or deprecation
- Account restrictions or freezes
- Exchange insolvency (see: FTX)
- Regulatory changes affecting Australian users

**Mitigation**: Multiple exchanges, withdrawal policies (don't keep more than needed on exchange), cold storage for capital not actively trading.

**T4: Time constraint is the bottleneck, but the solution takes time to build**

Adam's night shifts limit development time. The trading system itself takes months to build, test, and validate. The D/I/R model takes additional months. The income transition requires extended track record. The total timeline could be 2-3+ years.

**This is not a reason to delay starting** — it's a reason to start immediately with the simplest viable components (Era 0 and Era 1) while the model development proceeds in parallel.

**T5: Overfitting to past market conditions**

Crypto markets have existed in a specific macroeconomic context (low-rate expansion, crypto-specific narratives). Strategies backtested on 2020-2025 data may not generalize to different macroeconomic regimes. Walk-forward validation helps but cannot eliminate this risk.

**T6: Family financial security vs. ambition**

The transition must be survivable in the pessimistic scenario. This means the pessimistic scenario must be explicitly modeled and the family must have an agreed-upon abort condition. Optimism is the enemy — the system must be designed for the failure case, not the success case.

## 1.6 Assumptions Register

| # | Assumption | Basis | Risk | What Breaks If Wrong |
|---|-----------|-------|------|---------------------|
| A1 | Mining surveyor salary ~$100-150K AUD/year | Industry average for night shift NSW | Medium | Capital requirements change proportionally |
| A2 | Conservative annual crypto trading returns: 10-30% in good years | Historical performance of systematic strategies, NOT buy-and-hold | High | Income replacement requires much more capital |
| A3 | The D/I/R model can be built to the point of market regime detection in 6-18 months | Based on MVE timeline from architecture doc | High | Era 2 is delayed; system runs on Era 1 longer |
| A4 | Freqtrade remains maintained and Kraken remains accessible to Australian users | Current status | Low | Need to migrate execution engine or exchange |
| A5 | Australian CGT treatment of crypto trading income remains broadly stable | Current ATO guidance | Medium | Tax liability could change significantly |
| A6 | Crypto markets continue to have tradeable regime structure | Historical observation | Medium | If markets become purely random, systematic trading fails |
| A7 | LLM API costs remain affordable (~$42/month for Era 1) | Current pricing | Low | Can optimize with caching; eventual replacement by local model |
| A8 | Hardware (M5 Max + Proxmox) can run the D/I/R model at inference speed sufficient for daily regime analysis | Model spec says ~5M params fits easily | Very Low | Can optimize model or upgrade hardware |
| A9 | Michelle supports the transition plan | Unknown — must be discussed | Critical | No transition without family agreement |
| A10 | Night shift employment is available to return to within 3-6 months if needed | Mining industry labor market in NSW | Medium | Fallback plan weakened; longer savings buffer needed |
| A11 | No catastrophic exchange event during critical transition period | Historical risk (FTX collapsed in 2022) | Medium | Capital loss if concentrated on one exchange |
| A12 | Paper trading performance translates to live trading within 35% degradation | Freqtrade community benchmarks | Medium | Gate 3→4 transition produces worse results than expected |
| A13 | Portfolio heat limits (6%) and circuit breakers (10% monthly) are sufficient to prevent catastrophic loss | Standard risk management practice | Low | Even with limits, rapid market moves can gap through stops |
| A14 | The 50% CGT discount will not apply (holding periods under 12 months for active trading) | ATO rules | Very Low | Tax calculation is conservative by assumption |
| A15 | Drawdowns will occur and may last months | Universal trading experience | Certain | If the savings buffer doesn't account for this, transition fails |

---

# Pass 2 — INTEGRATE

## 2.1 The Unified Architecture: Three Eras

```
ERA 0: Foundation + Backtest (Now → Month 3)
├── Build Freqtrade infrastructure (original design Phase 0)
├── Implement base strategies (original design Phase 1)
├── Rule-based regime detection (indicators only)
├── Backtest against 2+ years historical data
├── Walk-forward validation
├── Concurrent: D/I/R model MVE-A (data validation)
└── Gate: five-gate pipeline Gates 1-2 pass

ERA 1: LLM-Assisted Live Trading (Month 3 → Month 12+)
├── Claude + GPT triangulation for regime tagging (original design)
├── Paper trading (8 weeks minimum)
├── Micro-live ($500 AUD max)
├── Scale to target allocation
├── Weekly D/I/R reviews in vault journal
├── Concurrent: D/I/R model MVE-B (architecture validation)
├── Concurrent: If MVE-B succeeds, train prototype on market data
├── Monthly performance reviews
└── Gate: 12+ months live track record with positive expectancy

ERA 2: D/I/R Model Integration (Month 12+ → Ongoing)
├── D/I/R model replaces LLM triangulation
├── Structural regime analysis (noun/verb streams for market data)
├── c/i/d coherence scores as risk modifiers
├── Model learns from trading history (Observer-Feedback Loop)
├── Sovereignty achieved — no external API dependency for decisions
├── Motif library enriched by trading domain instances
└── Gate: model demonstrates equal or better regime accuracy than LLM
         triangulation over 3+ months of parallel operation

INCOME TRANSITION GATES (separate track — see Section 5)
├── Gate T1: Trading system passes all five gates + 12 months live
├── Gate T2: Sufficient capital deployed for income replacement
├── Gate T3: Savings buffer of 12+ months expenses
├── Gate T4: Michelle's explicit agreement
├── Gate T5: Fallback plan documented and viable
└── Gate T6: Tax and superannuation strategy confirmed with accountant
```

## 2.2 Data Flow: Market Data → Trading Decision

### Era 1 (LLM triangulation — this is what gets built first)

```
Kraken API (OHLCV, 1h/4h/1d/1w candles)
    │
    ▼
Freqtrade data handler (fetches, stores, computes indicators)
    │
    ├── RSI(14), EMA(21/50/200), ATR(14), Bollinger(20,2), Volume MA(20)
    │
    ▼
LLM Analyst Cron Job (daily at 00:00 UTC)
    │
    ├── Phase D: Claude describes price structure (independent)
    ├── Phase D: GPT describes price structure (independent)
    ├── Phase I: Claude triangulates both descriptions
    ├── Phase R: Claude recommends regime + strategy + position modifier
    │
    ▼
Regime JSON file → shared path
    │
    ▼
Freqtrade Strategy (reads regime, selects sub-strategy, sizes position)
    │
    ├── Orders → Kraken (with exchange-side stop loss)
    ├── Trade log → Vault (via MCP)
    ├── Tax export → CSV (Koinly-compatible)
    │
    ▼
Telegram → Adam's phone
    ▼
Weekly D/I/R review → Vault journal
```

### Era 2 (D/I/R model — future state)

```
Kraken API + supplementary data sources
    │
    ├── OHLCV (multi-timeframe)
    ├── Volume profile
    ├── Funding rates
    ├── On-chain metrics (optional)
    │
    ▼
Feature Engineering Pipeline
    │
    ├── Noun features: state snapshot (what IS)
    │   ├── Normalized price levels relative to key MAs
    │   ├── Volume profile shape (accumulation/distribution)
    │   ├── Volatility regime (ATR percentile)
    │   ├── Cross-asset correlation state
    │   └── Serialized as structured text → noun encoder
    │
    ├── Verb features: dynamics snapshot (what DOES)
    │   ├── Momentum (ROC of price, volume, indicators)
    │   ├── Volatility direction (expanding/contracting/stable)
    │   ├── Structural break detection (regime transition signals)
    │   ├── axis: trending (differentiate) / mean-reverting (integrate) / transitioning (recurse)
    │   ├── derivativeOrder: price(0) / momentum(1) / acceleration(2) / jerk(3)
    │   ├── stabilisation: stable / unstable / converging / diverging
    │   └── Encoded via hybrid embedding → verb encoder
    │
    ▼
D/I/R Model (local inference on M5 Max or Proxmox GPU)
    │
    ├── D-phase: Separate noun (state) and verb (dynamics) representations
    ├── I-phase: Convergence layer maps between state and dynamics
    ├── R-phase: Reflect — iterate until c/i/d converge
    │   ├── c (completeness): both state and dynamics contribute
    │   ├── i (independence): state and dynamics encode different information
    │   ├── d (decidability): regime is classifiable
    │
    ├── Output: structural regime analysis
    │   ├── regime: trending-up / trending-down / ranging / volatile-uncertain
    │   ├── confidence: from convergence layer
    │   ├── c/i/d scores: structural quality metrics
    │   ├── reasoning_depth: how many R iterations needed (uncertainty proxy)
    │   └── structural_pattern: matched motif from library (if any)
    │
    ▼
Regime JSON file (same format as Era 1 — Freqtrade doesn't change)
    │
    ▼
[Same Freqtrade execution pipeline as Era 1]
```

### The Critical Interface: Regime JSON

The regime JSON file is the clean boundary between reasoning and execution. It's the same in both eras. This is **Estimation-Control Separation** (T2): the estimation side (how regimes are detected) can change independently of the control side (how trades are executed).

```json
{
  "pair": "BTC/AUD",
  "date": "2026-03-29",
  "timeframe": "weekly",
  "regime": "trending-up",
  "confidence": 0.78,
  "strategy": "ema_trend_follow",
  "position_modifier": 1.0,
  "key_levels": {
    "support": 95000,
    "resistance": 108000,
    "invalidation": 89000
  },
  "risks": ["resistance cluster at 108k"],
  "re_evaluate_if": "daily close below 95000",
  "source": "llm-triangulation",
  "source_version": "era1-v1",
  "structural_scores": {
    "completeness": null,
    "independence": null,
    "decidability": null,
    "reasoning_depth": null
  }
}
```

Era 1 leaves `structural_scores` null. Era 2 populates them. Freqtrade reads the same format either way.

## 2.3 Noun-Verb Mapping for Market Data

This is the specification for how market data maps to the D/I/R model's dual-stream input.

### Noun Stream: What IS the Market?

The noun stream captures the current state — a frozen snapshot of market structure.

| Noun Feature | Source | Encoding | D/I/R Model Field |
|-------------|--------|----------|-------------------|
| Price relative to key MAs | OHLCV + EMA(21/50/200) | Normalized ratios: price/EMA21, price/EMA50, price/EMA200 | `stateDescription` |
| Volume profile | Volume data over N periods | Distribution shape: accumulation (increasing volume at support) vs distribution (increasing volume at resistance) | `stateDescription` |
| Volatility state | ATR(14) percentile over 52 weeks | Percentile rank: 0.0 (historic low vol) to 1.0 (historic high vol) | `boundaries` |
| Support/Resistance levels | Pivot points, volume nodes | Key price levels as boundary list | `boundaries` |
| Cross-asset correlation | BTC/ETH correlation, BTC/SPX correlation | Correlation coefficients (rolling 30-day) | `stateDescription` |
| Funding rate state | Exchange funding rate data (crypto-specific) | Current rate + 7-day average + sign | `stateDescription` |
| Market cap dominance | BTC dominance percentage | Current + 30-day trend | `entityType` descriptor |

### Verb Stream: What is the Market DOING?

The verb stream captures dynamics — how the market is changing.

| Verb Feature | Source | Encoding | D/I/R Model Field |
|-------------|--------|----------|-------------------|
| Price momentum | ROC(14), ROC(30) | Rate of change at two timescales | `processShape` |
| Volatility direction | ATR(14) slope over 5 periods | Expanding (+), contracting (-), stable (flat) | `stabilisation` |
| Volume trend | Volume MA(20) slope | Increasing/decreasing/stable | `processShape` |
| Regime transition signal | Bollinger bandwidth change + ADX change | Combined signal for regime shift | `operators` |
| Structural axis | Derived from momentum + vol direction | `differentiate` (trending), `integrate` (ranging), `recurse` (transitioning) | `axis` |
| Derivative order | Which derivative of price is the dominant signal | 0 (price level), 1 (momentum), 2 (acceleration), 3 (jerk/whipsaw) | `derivativeOrder` |

### The Key Insight: Markets Have Structural Motifs

Market regimes are NOT random walks through state space. They exhibit structural patterns that recur across assets and timeframes:

| Market Pattern | Structural Motif | Description |
|---------------|-----------------|-------------|
| Bull trend → consolidation → breakout | **Progressive Formalization** | Amorphous (volatile) → structured (consolidation) → crystallized (breakout) |
| Range-bound market with narrowing bands | **Bounded Buffer With Overflow Policy** | Price bounces in a range; when buffer overflows (Bollinger squeeze), breakout follows |
| Trend that resists pullbacks | **Ratchet with Asymmetric Friction** | Easy to move in trend direction, hard to reverse |
| Correlated selloff across assets | **Structural Coupling as Ground State** | Coupling tightens under stress; assets that seemed independent become correlated |
| Mean reversion after extreme move | **Idempotent State Convergence** | Market converges back to structural attractor (mean) |
| Regime change (bull → bear) | **Explicit State Machine Backbone** | Named state transition with conditions |
| Volatility expansion → contraction cycle | **Dual-Speed Governance** | Fast cycle (daily volatility), slow cycle (regime volatility) |

This mapping is the D/I/R model's value proposition: by encoding market states and dynamics in the same structural vocabulary as the motif library, the model can detect regime patterns using structural reasoning, not just statistical indicators.

**ASSUMPTION A16**: Market structural patterns genuinely recur and are detectable by structural reasoning. This is a hypothesis, not a proven fact. Standard technical analysis makes a similar assumption (patterns repeat), but D/I/R-based structural reasoning has never been tested on market data.

## 2.4 Risk Management Architecture

### Layered Defense Model

```
Layer 0: Hard Limits (unchangeable except by Adam)
├── Max 2% risk per trade
├── Max 6% portfolio heat
├── Max 3 concurrent positions
├── No leverage — ever
├── Stop loss on every trade at entry time
└── BTC + ETH only in Phase 1

Layer 1: Circuit Breakers (automatic)
├── 5% weekly drawdown → reduce to 0.5x position size
├── 10% monthly drawdown → close all, paper-only mode
├── 3 consecutive losses → skip next signal
├── LLM/model failure → default to cash (no new entries)
└── Regime confidence < 0.4 → no new entries

Layer 2: Structural Quality Gates (Era 2 only)
├── c-score < 0.3 → market state ambiguous → reduce to 0.5x
├── i-score < 0.3 → noun/verb redundant → confidence overstated → reduce to 0.5x
├── d-score < 0.3 → regime unclassifiable → no entry
├── reasoning_depth > 3 → high uncertainty → reduce to 0.5x
└── All scores serve as position size modifiers, not override signals

Layer 3: Human Oversight
├── Weekly D/I/R review (Describe performance, Interpret patterns, Recommend adjustments)
├── Monthly formal review with performance report
├── Circuit breaker reset requires Adam's manual review
├── Any parameter change requires written journal entry
└── Adam can override any automatic action
```

**Motif mapping**:
- Layer 0 = **Bounded Buffer With Overflow Policy** — hard caps on exposure
- Layer 1 = **Ratchet with Asymmetric Friction** — easy to reduce risk, hard to increase
- Layer 2 = **Estimation-Control Separation** — structural quality informs but doesn't control
- Layer 3 = **Observer-Feedback Loop** — human review modifies the system

### Position Sizing Formula (Conservative)

```
risk_per_trade = 0.02  # 2% of capital
regime_modifier = 1.0 if confidence >= 0.7 else 0.5  # from regime analysis
structural_modifier = min(c_score, d_score)  # Era 2 only; Era 1 = 1.0
circuit_breaker_modifier = 0.5 if weekly_drawdown > 0.05 else 1.0

effective_risk = risk_per_trade * regime_modifier * structural_modifier * circuit_breaker_modifier

position_size = (capital * effective_risk) / (entry_price - stop_loss_price)

# Verify portfolio heat doesn't exceed 6%
if current_heat + effective_risk > 0.06:
    position_size = 0  # don't enter
```

### What About Black Swan Events?

Stops can be gapped in extreme moves (flash crash, exchange halt, liquidity crisis). The hard limits mitigate this:
- 2% per trade means even a total loss on one position costs 2%
- 6% portfolio heat means total simultaneous loss of all positions costs 6%
- No leverage means position value can't go negative

In a true black swan (exchange insolvency), the mitigation is: don't keep more capital on exchange than you're willing to lose. The rest lives in cold storage or AUD bank accounts.

**ASSUMPTION A17**: Exchange-side stop losses execute even during high volatility. In practice, stops may be slipped. The 35% degradation tolerance (from Gate 3) accounts for this.

## 2.5 Stepping Stone Path: What Runs Before the D/I/R Model

This is the practical implementation sequence — what to build right now.

### Immediate (Week 1-2)
1. Provision Freqtrade LXC on Proxmox
2. Configure Kraken API (read-only)
3. Set up ZFS paths: `/mnt/zfs-host/backup/trading/`
4. Create vault project: `01-Projects/crypto-trading/`
5. Download 2+ years of BTC/AUD and ETH/AUD OHLCV data

### Short-Term (Week 3-8)
1. Implement base strategies (EMA trend follow, mean reversion, volatility breakout)
2. Implement rule-based regime detection (indicator thresholds — no LLM yet)
3. Run backtests with rule-based regimes
4. Walk-forward validation
5. Iterate: does any strategy pass Gate 1 (Sharpe ≥ 1.2, max DD ≤ 20%, PF ≥ 1.3)?

### Medium-Term (Month 3-6)
1. Build LLM analyst cron job (Claude + GPT triangulation)
2. Generate historical regime labels for backtest data (retroactive LLM analysis)
3. Re-run backtests with LLM regime labels
4. Compare: do LLM-detected regimes improve strategy performance vs rule-based?
5. If yes → begin paper trading. If no → iterate on LLM prompts or strategy logic.
6. Wire Telegram notifications
7. Begin daily journal entries in vault

### Long-Term (Month 6-12+)
1. Complete paper trading (8 weeks minimum)
2. If paper trading passes Gate 3 → micro-live ($500 AUD max)
3. If micro-live passes Gate 4 → gradual scale
4. Concurrent: D/I/R model development (MVE-A → MVE-B → prototype)
5. When model ready: run in parallel with LLM triangulation for 3+ months
6. If model matches or exceeds LLM accuracy → switch to Era 2

## 2.6 Integration with Observer Ecosystem

```
Trading System                    Observer Ecosystem
─────────────                    ──────────────────
Trade outcomes ──────────────────► Vault journal (01-Projects/crypto-trading/journal/)
Regime analyses ─────────────────► Vault archive (01-Projects/crypto-trading/regimes/)
Performance reports ─────────────► Vault documents (01-Projects/crypto-trading/performance/)
Tax records ─────────────────────► Vault (01-Projects/crypto-trading/tax/)

Regime transitions ──────────────► Motif library instances (Explicit State Machine Backbone)
Circuit breaker events ──────────► Motif library instances (Ratchet with Asymmetric Friction)
Structural regime patterns ──────► Motif library instances (various)

D/I/R model predictions ─────────► Dataset processor (future: trading domain PairedRecords)
Model self-evaluation ───────────► Observer-Feedback Loop (motif library enrichment)

MCP tools (observer-control-plane):
├── trading_status → current positions, P&L, regime, portfolio heat
├── trading_regime → latest regime analysis for each pair
├── trading_journal_write → write journal entry to vault
├── trading_performance → performance metrics over period
├── trading_circuit_breaker_status → breaker state
└── trading_tax_export → Koinly-compatible CSV
```

---

# Pass 3 — REFLECT (Part 1: Trading System)

## 3.1 Coherence Assessment

**Completeness (c)**: The architecture covers: data pipeline (two eras), regime detection (three eras), strategy execution, risk management (four layers), sovereignty analysis, Observer integration, stepping stone path. **c = HIGH**.

**Independence (i)**: The seven design decisions (TD1-TD7) are genuinely separable. The three eras can be implemented sequentially. The risk layers are independent. **i = HIGH**.

**Decidability (d)**: Each era has a clear entry/exit condition. The stepping stone path is actionable now. The regime JSON interface decouples reasoning from execution. **d = HIGH**.

**Assessment**: Converged for Part 1 architecture. Proceeding to Part 2.

## 3.2 What the Architecture Gets Right

1. **The era model solves the "model doesn't exist yet" problem.** You don't wait for the D/I/R model. You build the infrastructure now with LLM triangulation. The model slots in later. Same interface, different backend.

2. **The regime JSON is a brilliant interface.** It decouples estimation from control completely. Freqtrade doesn't know or care whether a human, an LLM, or a D/I/R model produced the regime file. This is the **Estimation-Control Separation** motif in action.

3. **The risk management is conservative enough for income replacement.** Four layers, automatic circuit breakers, human oversight, no leverage. This is not a get-rich-quick system — it's designed to preserve capital first and generate income second.

## 3.3 What the Architecture Might Get Wrong

1. **The noun-verb mapping for market data is speculative.** We're assuming market state/dynamics maps cleanly to the noun/verb dual-stream architecture. The model was designed for general structural reasoning on text, not specifically for time-series financial data. Market data might be better handled by specialized time-series models (temporal CNNs, LSTMs, or time-series transformers).

2. **Regime detection accuracy is the single point of failure.** If regimes are mislabeled, the wrong strategy executes. The risk management limits the damage, but persistent mislabeling would produce death-by-a-thousand-cuts losses.

3. **The $42/month LLM cost is low, but API dependency during critical trading periods is a risk.** If Claude's API goes down during a volatile period, the system defaults to cash — which is safe but means missed opportunities. This is the safety-liveness duality: the fail-safe mode (cash) is safe but not live.

---

# PART 2: INCOME TRANSITION — D/I/R ANALYSIS

---

# Pass 1 — DISTINGUISH (Transition)

## 4.1 What This Decision Actually Is

This is not a trading decision. This is a life architecture decision. It involves:

- A family's financial security (Adam, Michelle, Oliver)
- A career transition with partial reversibility
- Long-term superannuation and insurance implications
- Psychological load of depending on a trading system
- Relationship dynamics (shared financial decision-making)

**The D/I/R model, the trading system, the Observer project — these are tools.** The decision is about whether the tools are reliable enough to support a family.

## 4.2 Financial Variables (Must Be Provided by Adam)

Atlas cannot make this analysis concrete without the following data. These are listed as unknowns:

| Variable | Needed For | Status |
|----------|-----------|--------|
| Current annual income (gross and net) | Capital requirement calculation | UNKNOWN — Adam to provide |
| Michelle's income (if any) | Household dependency on trading income | UNKNOWN |
| Monthly household expenses | Savings buffer calculation | UNKNOWN |
| Current savings | Starting position assessment | UNKNOWN |
| Current superannuation balance | Long-term impact assessment | UNKNOWN |
| Mortgage or rent payment | Fixed cost assessment | UNKNOWN |
| Property expenses (six-acre property) | Ongoing cost structure | UNKNOWN |
| Desired income from trading (minimum viable) | Capital requirement calculation | UNKNOWN |
| Risk tolerance as a family | Gate calibration | UNKNOWN — requires conversation |

**Without these numbers, the transition plan is abstract. The framework below is the structure; Adam fills in the numbers.**

## 4.3 The Staged Transition Path

### Stage 0: Build and Validate (Current → Month 12+)

**Gate 0 — Entry**: Decision to start. Adam approves the trading system design.

**Activities**:
- Build Freqtrade infrastructure
- Develop and backtest strategies
- Paper trade for 8+ weeks
- Micro-live trading ($500 AUD)
- Begin tracking performance

**Financial commitment**: Minimal — $500 AUD micro-live capital + ~$42/month LLM API cost + infrastructure (already owned).

**No lifestyle changes.** Full employment continues. This stage costs almost nothing and risks nothing material.

### Stage 1: Scale and Track Record (Month 12 → Month 24+)

**Gate 1 — Entry requires ALL of**:
- Paper trading passed Gate 3 (results within 35% of walk-forward)
- Micro-live passed Gate 4 (4 weeks profitable, execution within 15% of paper)
- No circuit breaker triggers during micro-live
- System has been running with minimal manual intervention for 4+ weeks

**Activities**:
- Gradually increase capital (from $500 to target allocation)
- Track monthly returns, drawdowns, Sharpe ratio
- Maintain trading journal
- Build 12+ month track record
- Continue full employment

**Financial commitment**: Deploying real capital (amount depends on Stage 2 calculations).

**Still no lifestyle changes.** Capital deployed should be money Adam can afford to lose entirely without affecting family finances.

### Stage 2: Financial Preparation (Month 18 → Month 30+)

**Gate 2 — Entry requires ALL of**:
- 12+ months of live trading track record
- Positive expectancy confirmed across multiple market conditions
- At least one significant drawdown survived and recovered
- System has survived at least one "regime shift" (e.g., a 30%+ BTC correction)
- Compound annual return is calculable and realistic

**Activities**:
- Calculate required capital for income replacement (see Section 5.2)
- Build savings buffer to 12+ months of household expenses
- Consult accountant on tax strategy for trading income
- Research superannuation options for self-employed Australians
- Research private health insurance options
- Have the family conversation — Michelle must see the data and agree

**Financial commitment**: Savings accumulation mode. Every dollar above household expenses goes to either trading capital or savings buffer.

### Stage 3: Staged Transition (Month 24 → Month 36+)

**Gate 3 — Entry requires ALL of**:
- Trading system meets income generation targets for 6+ consecutive months
- Savings buffer of 12+ months expenses is fully funded
- Trading capital is sufficient for income replacement at conservative return rate
- Accountant has confirmed tax and super strategy
- Insurance arrangements are in place
- Michelle has explicitly agreed (documented)
- Fallback plan is documented and viable (see Section 5.5)
- Adam has discussed transition timing with employer (notice period, leave balance)

**Activities**:
- Transition to part-time employment if possible
- If part-time not available: continue full-time while monitoring system
- Use part-time period to verify that trading income + part-time income ≥ household needs
- If part-time works for 6+ months → consider full transition

**Financial commitment**: Part-time income reduction offset by trading income. Savings buffer remains untouched (it's the emergency reserve, not operating capital).

### Stage 4: Full Transition (Month 30 → Month 42+)

**Gate 4 — Entry requires ALL of**:
- Part-time + trading has been sustainable for 6+ months (if part-time is available)
  OR trading income alone has exceeded minimum viable income for 12+ months
- Savings buffer still intact (not drawn down during the part-time period)
- No circuit breaker events in the past 6 months
- System has operated largely autonomously (not requiring daily intervention)
- Family remains comfortable with the arrangement
- Annual tax return has been filed and reviewed with accountant

**Activities**:
- Leave employment (with appropriate notice)
- Full-time focus on trading system maintenance + Observer development
- Monthly financial review: is income on track? Is savings buffer intact?
- Quarterly review: should we go back to employment?

**Abort conditions** (any one triggers re-evaluation):
- Trading income falls below minimum for 2 consecutive months
- Savings buffer drops below 6 months of expenses
- Circuit breaker triggers twice in 3 months
- Michelle requests re-evaluation
- Market conditions change fundamentally (e.g., crypto regulation effectively bans trading in Australia)

## 5.1 Timeline Scenarios

**CRITICAL NOTE**: These timelines are estimates, not commitments. Markets are unpredictable. Model development timelines are uncertain. Family circumstances change.

| Scenario | Stage 0 | Stage 1 | Stage 2 | Stage 3 | Stage 4 | Total |
|----------|---------|---------|---------|---------|---------|-------|
| **Optimistic** | 6 months | 6 months | 6 months | 6 months | — | ~24 months |
| **Moderate** | 9 months | 12 months | 9 months | 9 months | — | ~39 months |
| **Pessimistic** | 12 months | 18 months | 12 months | 12 months | — | ~54 months |

**The pessimistic scenario is 4.5 years.** This is the timeline to plan for. If things go faster, great. If they go slower, the system is designed for patience — full employment continues throughout.

**ASSUMPTION A18**: The transition is even possible. If the trading system never achieves consistent profitability, or if capital requirements are unreachable, the honest answer is: "This path doesn't work. Find another funding mechanism for Observer development." The analysis must include this possibility.

## 5.2 Capital Requirement Calculation

**Formula**:
```
Required capital = (Annual income needed - Michelle's income) / Conservative annual return rate
```

**Scenario analysis** (placeholder — Adam must provide actual income figures):

Assume:
- Annual household expenses: $X (Adam to provide)
- Michelle's annual income: $Y (Adam to provide)
- Income gap to cover: $X - $Y = $G

| Annual Return Scenario | Return Rate | Capital Needed for $50K/yr gap | Capital Needed for $100K/yr gap |
|----------------------|------------|-------------------------------|--------------------------------|
| **Pessimistic** | 5% | $1,000,000 | $2,000,000 |
| **Conservative** | 10% | $500,000 | $1,000,000 |
| **Moderate** | 15% | $333,333 | $666,667 |
| **Optimistic** | 25% | $200,000 | $400,000 |

**ASSUMPTION A2 revisited**: These return rates are BEFORE tax. Australian CGT on short-term trading income (held < 12 months) is taxed at marginal rate. For a sole income of $100K from trading, after CGT you might keep 60-70% depending on deductions.

**After-tax capital requirement** (rough estimate):
```
After-tax capital needed = Pre-tax capital needed / 0.65
```

This means the pessimistic scenario for a $100K income gap requires ~$3M in capital. This is... a lot. Even the moderate scenario requires ~$1M.

**ASSUMPTION A19**: This capital does not need to be accumulated from zero through trading profits. The capital accumulation path might include: savings from employment, property equity, superannuation access (limited before preservation age), or a smaller initial target with growth over time.

**The honest assessment**: If the income gap is large (>$80K) and the capital must be accumulated purely from employment savings + trading profits, the timeline extends significantly. The system must compound returns for years before income replacement becomes viable. **This is the most important calculation Adam needs to run with real numbers.**

## 5.3 Risk Assessment — What Can Go Wrong

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Prolonged bear market during capital accumulation | Medium | Returns negative, timeline extends | Savings buffer; strategies include ranging/risk-off modes; employment continues |
| Exchange insolvency (FTX-style event) | Low | Capital loss up to exchange balance | Limit exchange exposure; distribute across exchanges; regular withdrawal to cold storage |
| Regulatory change (Australia restricts crypto trading) | Low-Medium | System becomes unviable | Diversify to traditional markets (equities, forex); the architecture transfers |
| Strategy stops working (regime detection fails) | Medium | Persistent losses until detected | Circuit breakers auto-trigger; weekly review catches drift; monthly formal review |
| D/I/R model never achieves market capability | Medium-High | Stuck on Era 1 (LLM triangulation) | Era 1 is self-sufficient; higher ongoing API cost but functional |
| Health event affecting Adam's ability to maintain system | Low | System runs unattended; may need shutdown | System is designed for low maintenance; Telegram alerts; circuit breakers; Michelle trained to emergency-stop |
| Relationship stress from financial risk | Medium | Quality of life impact | Transparent communication; agreed abort conditions; savings buffer provides security |
| Tax audit on trading income | Low | Compliance cost + potential penalties | Clean records (vault audit trail); accountant-prepared returns; Koinly for CGT calculations |
| Flash crash / gap through stop losses | Low | Larger-than-expected single loss | Hard limit of 2% per trade + 6% heat; even worst-case gap is bounded |
| Over-optimization / overfitting to historical data | Medium | Paper results don't translate to live | Walk-forward validation; out-of-sample testing; 35% degradation tolerance |

## 5.4 Australian-Specific Considerations

### Tax

- Crypto trading income is assessable under standard income tax rules (ATO guidance updated 2023)
- Active trading = ordinary income (not CGT discount eligible if trading is a business activity)
- If classified as a trading business: income taxed at marginal rates
- If classified as investment: CGT events, with 50% discount for holdings > 12 months
- **Most likely classification for systematic daily/weekly trading**: Trading business = ordinary income = full marginal tax rate
- GST: not applicable to financial supplies (crypto trading is GST-free)
- ABN: may be required if operating as a trading business
- **Action**: Consult accountant before scaling beyond micro-live to confirm classification

ASSUMPTION A20: Trading will be classified as business income by ATO, not investment. Conservative assumption — means higher tax rate but lower compliance risk.

### Superannuation

- Employer super contributions (currently 11.5% of salary, rising to 12% by July 2027) STOP when employment ends
- Self-employed have no mandatory super contribution, but can make voluntary contributions
- Voluntary contributions are tax-deductible up to the concessional cap ($30K/year in 2025-26)
- **Risk**: Years without super contributions compound to significant retirement shortfall
- **Mitigation**: Budget for voluntary super contributions as a fixed cost in the trading income calculation
- **Action**: Factor super contributions into the "minimum viable income" calculation

### Insurance

- **Workers' compensation**: Lost when leaving employment. Not replaced — trading is not an insured occupation.
- **Income protection insurance**: Can be obtained privately but premiums are higher for self-employed. May be difficult to insure "trading income."
- **Health insurance**: Not affected by employment status in Australia (Medicare continues). Private health insurance premiums unchanged.
- **Public liability**: Not required for trading from home.
- **Professional indemnity**: Not required.
- **Action**: Investigate income protection insurance options before transition. Accept that full income protection may not be available for trading income.

### Employment Return Path

- Mining surveyors are in demand in NSW (coal + infrastructure projects)
- Night shift roles are harder to fill → favourable labour market for return
- Adam's existing qualifications and experience retain value
- **Estimated time to re-employment**: 1-3 months (assumption A10)
- **Risk**: Extended time away from the profession could reduce currency of certifications or industry connections
- **Mitigation**: Maintain survey registration and professional development during transition

## 5.5 Fallback Plan

### Trigger Conditions (any one activates)

1. Trading income below minimum viable for 3 consecutive months
2. Savings buffer drops below 6 months expenses
3. Total drawdown exceeds 25% of trading capital
4. Michelle invokes the agreed abort clause
5. Health or family circumstance requires stable income

### Fallback Sequence

1. **Immediate**: Trading system switches to capital-preservation mode (risk-off, no new entries)
2. **Week 1**: Adam begins job search (update CV, contact previous employers/agencies)
3. **Week 1-4**: Apply for positions; mining survey night shift roles
4. **Week 4-12**: Secure employment (estimated 1-3 months based on market conditions)
5. **During gap**: Living expenses covered by savings buffer
6. **After re-employment**: Trading system continues running at reduced scale (no longer income-dependent)

### Financial Bridge

```
Time to re-employment: 3 months (conservative estimate)
Monthly expenses: $X (Adam to provide)
Required bridge: 3 × $X
Available from: savings buffer (minimum 12 months × $X)
Safety margin: 12 - 3 = 9 months buffer remaining after bridge
```

The savings buffer is sized for 12 months specifically because the fallback requires 3 months and a substantial safety margin.

## 5.6 Family Decision Framework

**What Michelle needs to see before this is responsible:**

1. **Written plan** — this document, with real numbers filled in
2. **Track record** — 12+ months of live trading performance data, including drawdowns
3. **Risk limits** — clear, automatic, non-overridable (circuit breakers + savings buffer)
4. **Abort conditions** — agreed jointly, documented, with Michelle having veto power
5. **Savings buffer** — fully funded before any lifestyle change
6. **Accountant confirmation** — tax strategy and super contributions planned
7. **Fallback viability** — evidence that re-employment is achievable (market research on surveying demand)
8. **Emotional check-in** — both partners comfortable, not just one convinced and one acquiescing

**ASSUMPTION A9 restated**: This is the most important assumption. If Michelle is not fully on board — not "reluctantly agrees" but genuinely sees the data and agrees it's the right path — the transition should not proceed. Financial stress amplifies relationship stress. A unilateral decision here is irresponsible.

---

# Pass 4 — CONVERGENCE CHECK AND SYNTHESIS

## 6.1 Stability Evaluation (Both Parts)

**Completeness (c)**:
- Part 1 (Trading): Architecture fully specified across three eras. Data flow, risk management, stepping stone path, Observer integration — all present. **c = HIGH**.
- Part 2 (Transition): Framework complete with six stages, gates at each stage, Australian considerations, fallback plan, family framework. Financial calculations are structurally complete but lack Adam's actual numbers. **c = MEDIUM-HIGH** (HIGH when numbers are filled in).

**Independence (i)**:
- The trading system and transition plan are properly decoupled. Trading system development proceeds regardless of transition decision. Transition gates are independent of each other. **i = HIGH**.

**Decidability (d)**:
- For the trading system: clear next actions (build Freqtrade, backtest, paper trade). **d = HIGH**.
- For the transition: gates are specific and measurable. The family conversation is the softest gate but is framed as a hard requirement. **d = HIGH**.

**Assessment: converged.** The analysis holds together. Proceeding to synthesis.

## 6.2 The Honest Summary

### Trading System Viability: HIGH

The trading system architecture is sound. It builds on proven components (Freqtrade, standard risk management, regime-based strategy selection). The three-era design means it works before the D/I/R model exists. The risk management is conservative enough for income dependency. The sovereignty path is clear.

**The system can be started building today.** Era 0 and Era 1 require no novel technology — just engineering and discipline.

### D/I/R Model for Trading: SPECULATIVE

Using the D/I/R model for market regime detection is a hypothesis. It might work better than LLM triangulation (the model could detect structural patterns that LLMs miss). It might work worse (markets might not have the kind of structural regularity that the model is designed to find). It might be irrelevant (LLM triangulation might be sufficient).

**The correct approach**: Build Era 1 first. Develop the D/I/R model in parallel. When the model is ready, run it alongside LLM triangulation. Compare. Let the data decide. Don't wait for the model to start trading.

### Income Transition Viability: UNCERTAIN — DEPENDS ON NUMBERS

The framework is solid, but the viability depends entirely on:
1. The income gap (how much trading needs to replace)
2. Achievable returns (which won't be known until the system has a track record)
3. Capital availability (how much can be accumulated)

**The capital requirement math is sobering.** At conservative return rates, income replacement may require $500K-2M+ in deployed capital depending on the income gap. Accumulating this from employment savings takes years. The trading system's own returns help compound, but the timeline is measured in years, not months.

**This might not work as a complete income replacement.** A more realistic near-term goal might be: trading provides supplementary income ($20-50K/year), reducing the dependency on employment. This might enable part-time work or a less demanding role, which provides more time for Observer development without the full risk of complete income replacement.

### Honest Probability Estimates

| Outcome | Estimated Probability | Basis |
|---------|---------------------|-------|
| Trading system is buildable and runs reliably | 90% | Engineering, not science |
| System achieves positive expectancy in paper trading | 60% | Regime-based strategies have mixed empirical evidence |
| System achieves positive expectancy in live trading | 45% | Paper-to-live degradation is common |
| System generates consistent 10%+ annual returns | 30% | Very few systematic crypto strategies achieve this consistently |
| System generates enough returns to replace employment income | 15% | Requires everything to go right plus sufficient capital |
| D/I/R model improves regime detection vs LLMs | 35% | Novel, untested approach to market analysis |
| Full income transition within 3 years | 10% | Requires capital accumulation + consistent returns + model success |
| Full income transition within 5 years | 25% | More realistic but still requires many things to go right |

**ASSUMPTION A21**: These probabilities are gut estimates by Atlas, not empirically derived. They are deliberately conservative but could be wrong in either direction. The purpose is not precision — it's calibration against optimism.

## 6.3 Open Questions Requiring Further Research

### Must Resolve Before Building

1. **Adam's actual financial numbers** — Income, expenses, savings, mortgage, Michelle's income. Without these, the transition plan is abstract.
2. **ATO classification** — Is systematic crypto trading a business or investment activity? Consult accountant.
3. **Kraken AUD pairs availability and liquidity** — Verify that BTC/AUD and ETH/AUD have sufficient liquidity for the intended trade sizes.
4. **Part-time mining surveying viability** — Can Adam work part-time on night shifts, or is it all-or-nothing?

### Should Resolve Through Experimentation

5. **Do LLM-detected regimes actually improve strategy performance?** — Run backtests with and without regime labels.
6. **What's the realistic paper-to-live degradation for this system?** — Measure during Gate 3→4 transition.
7. **Does the D/I/R model's structural reasoning apply to market data?** — Only answerable after MVE-A and MVE-B succeed AND market-specific training.

### Deferred

8. **Expansion beyond crypto** — Can the architecture generalize to equities, forex? Relevant if crypto regulation changes.
9. **Other income streams from Observer** — Is consulting, tools, or software licensing viable as supplementary income?
10. **Cooperative model** — Could the Observer ecosystem's tools generate value for others (e.g., motif-based analysis as a service)?

## 6.4 Dependencies Map

```
START
  │
  ▼
[Freqtrade infrastructure] ← depends on: Proxmox (exists), Kraken API access
  │
  ▼
[Base strategies + backtests] ← depends on: Freqtrade, historical data (downloadable)
  │
  ├──► [Rule-based regime detection] ← depends on: indicator implementations (standard)
  │        │
  │        ▼
  │    [Walk-forward validation] ← depends on: backtests passing Gate 1
  │
  ▼
[LLM analyst pipeline] ← depends on: Claude API key, OpenAI API key, ~$42/month
  │
  ├──► [Historical regime labels] ← depends on: LLM pipeline + historical data
  │        │
  │        ▼
  │    [LLM-enhanced backtests] ← depends on: historical labels
  │
  ▼
[Paper trading] ← depends on: strategy passing Gate 2 + Freqtrade dry-run mode
  │
  ▼
[Micro-live] ← depends on: paper trading passing Gate 3 + Kraken trade permissions + $500
  │
  ▼
[Scale] ← depends on: micro-live passing Gate 4 + capital allocation decision
  │
  │  (PARALLEL TRACK)
  │
  ├──► [D/I/R model MVE-A] ← depends on: dataset processor output, M5 Max or fine-tuning API
  │        │
  │        ▼
  │    [D/I/R model MVE-B] ← depends on: MVE-A success
  │        │
  │        ▼
  │    [D/I/R model market training] ← depends on: MVE-B success + market data pipeline
  │        │
  │        ▼
  │    [D/I/R model parallel evaluation] ← depends on: trained model + running Era 1 system
  │        │
  │        ▼
  │    [Era 2 switchover] ← depends on: model matching LLM accuracy over 3+ months
  │
  │  (TRANSITION TRACK — separate from above)
  │
  ├──► [Financial data gathering] ← depends on: Adam providing numbers
  │        │
  │        ▼
  │    [Accountant consultation] ← depends on: financial data
  │        │
  │        ▼
  │    [Family conversation] ← depends on: 12+ month track record + financial plan
  │        │
  │        ▼
  │    [Savings buffer accumulation] ← depends on: income + time
  │        │
  │        ▼
  │    [Transition decision] ← depends on: ALL gates passing
  │
  ▼
END (or: loop back to employment if transition fails)
```

## 6.5 Complete Assumptions List (Consolidated)

| # | Assumption | Risk Rating | What Breaks If Wrong |
|---|-----------|-------------|---------------------|
| A1 | Mining surveyor salary ~$100-150K AUD/year | Medium | Capital requirements change |
| A2 | Conservative annual crypto returns: 10-30% in good years | **HIGH** | Income replacement may be unachievable |
| A3 | D/I/R model buildable for market regime detection in 6-18 months | **HIGH** | Era 2 delayed indefinitely |
| A4 | Freqtrade and Kraken remain accessible | Low | Migration needed |
| A5 | Australian CGT treatment broadly stable | Medium | Tax liability could change |
| A6 | Crypto markets have tradeable regime structure | Medium | Systematic trading fails entirely |
| A7 | LLM API costs remain affordable | Low | Can optimize or replace |
| A8 | Local hardware sufficient for model inference | Very Low | Hardware is overpowered for this |
| A9 | Michelle supports the transition | **CRITICAL** | No transition without family agreement |
| A10 | Mining employment available for fallback within 3 months | Medium | Fallback plan weakened |
| A11 | No catastrophic exchange event | Medium | Capital loss |
| A12 | Paper → live degradation within 35% | Medium | Strategy performance worse than expected |
| A13 | Risk limits sufficient for capital preservation | Low | Even worst case is bounded |
| A14 | Short-term trading = no CGT discount | Very Low | Conservative assumption |
| A15 | Drawdowns will occur and may last months | **CERTAIN** | Savings buffer too small |
| A16 | Market structural patterns are detectable by D/I/R reasoning | Medium-High | D/I/R model adds no value for trading |
| A17 | Stop losses execute during high volatility | Medium | Larger-than-expected losses |
| A18 | The transition is even possible | Medium | Path doesn't work; find alternative |
| A19 | Capital can come from multiple sources | Medium | If only from savings, timeline extends dramatically |
| A20 | Trading classified as business income by ATO | Low | This is the conservative assumption |
| A21 | Atlas's probability estimates are calibrated | Unknown | Could be too optimistic or pessimistic |

---

# OUTPUT SUMMARY

## Part 1 — Trading System Architecture

1. **Three-era design**: Rule-based → LLM triangulation → D/I/R model. Each era produces the same regime JSON. Freqtrade executes regardless of which era produced the regime.
2. **Data flow**: Market OHLCV → features → regime analysis → JSON file → Freqtrade → exchange.
3. **Noun-verb mapping**: Noun = what IS (price levels, volume profile, volatility state). Verb = what DOES (momentum, volatility direction, structural transitions, axis/order/stabilisation).
4. **Motif-based regime detection**: Seven market patterns mapped to existing motifs (Progressive Formalization, BBWOP, Ratchet, etc.). Model detects these structural patterns in market data.
5. **Risk management**: Four layers (hard limits → circuit breakers → structural quality gates → human oversight). Conservative — designed for income dependency.
6. **Sovereignty**: Irreducible dependencies (exchange, data) can be diversified. LLM dependency is temporary (Era 1 → Era 2). Everything else is self-hosted.
7. **Stepping stone**: Build Freqtrade now → rule-based backtests → LLM regime tagging → paper trade → micro-live → scale. The D/I/R model slots in when ready.
8. **Observer integration**: Trade outcomes → vault journal. Regime transitions → motif library instances. MCP tools for status queries.

## Part 2 — Transition Plan

1. **Five stages**: Build (now) → Scale + Track Record → Financial Prep → Staged Transition → Full Transition. Each gated.
2. **Financial requirements**: Depends on income gap. At conservative 10% returns, $100K income gap requires ~$1M+ capital (before tax adjustment). Savings buffer of 12+ months expenses required independently.
3. **Risk assessment**: 10 identified risks with mitigations. Biggest risks: achieving consistent returns (inherently uncertain) and capital requirements (may be very large).
4. **Timeline**: Pessimistic scenario is 4.5 years. Moderate is 3.3 years. Optimistic is 2 years. Plan for pessimistic.
5. **Fallback**: Switch to capital preservation → job search → re-employment within 1-3 months → savings buffer covers the gap.
6. **Australian specifics**: Trading income likely taxed at marginal rate (business income). Super contributions stop (budget for voluntary). Workers' comp lost. Income protection insurance may be hard to obtain.
7. **Family framework**: Michelle must see written plan, 12+ months data, risk limits, abort conditions, savings buffer, accountant confirmation, and be genuinely comfortable. Veto power is non-negotiable.

## What to Do Next

1. **Immediate**: Adam reviews this document. Provides actual financial numbers (income, expenses, savings, Michelle's income).
2. **This week**: Begin Freqtrade LXC provisioning on Proxmox if Adam approves the architecture.
3. **This month**: Download historical data, implement base strategies, run first backtests.
4. **Ongoing**: D/I/R model development proceeds in parallel on its own timeline.
5. **Not yet**: Any lifestyle changes, capital deployment beyond micro-live, or transition conversations with employer.

**The system is designed for patience.** Employment continues until the data says it's safe to transition. The data, not optimism, drives the decision.

---

*Convergence check: 4 passes, c/i/d = HIGH/HIGH/HIGH. All assumptions listed. Pessimistic scenarios modeled. The architecture is buildable. The transition is possible but uncertain and long-timeline. Adam decides.*
