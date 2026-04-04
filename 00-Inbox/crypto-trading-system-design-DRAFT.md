---
status: draft
date: 2026-03-27
author: Atlas
method: D/I/R convergence (3 loops)
tags:
  - trading
  - architecture
  - freqtrade
  - llm-analysis
  - observer-integration
---

# Self-Hosted Crypto Trading System — Design Document

> Converged via D/I/R loops. All components defined, no gaps, pre-mortem passed.

## 1. Design Principles

| Principle | Expression |
|-----------|-----------|
| Capital preservation first | Max 2% per trade, 6% portfolio heat, 10% monthly drawdown circuit breaker |
| Sovereignty-first | Self-hosted on Proxmox, no cloud dependencies, all data on ZFS |
| AI articulates, human decides | LLM suggests regimes, bot executes rules, Adam sets parameters |
| Simple beats clever | One Freqtrade instance, one cron job, regime files as interface |
| Progressive trust | Backtest → walk-forward → paper (8 wk min) → micro-live → scale |

### Motif Mapping

Six structural motifs from the Observer motif library apply directly:

| Motif (Tier) | Application |
|-------------|-------------|
| **Dual-Speed Governance** (T2) | Fast loop: execution/stops (seconds). Slow loop: regime analysis/strategy selection (daily/weekly) |
| **Explicit State Machine Backbone** (T2) | Market regime as explicit state with gated transitions |
| **Bounded Buffer With Overflow Policy** (T2) | Position queue with max exposure caps |
| **Ratchet with Asymmetric Friction** (T2) | Easy to reduce risk (close positions), hard to increase (requires regime confirmation + confidence threshold) |
| **Observer-Feedback Loop** (T2) | Trade outcomes feed back into regime model refinement |
| **Progressive Formalization** (T2) | Paper → micro-live → scale is progressive formalization of trust in the system |

---

## 2. Architecture

### 2.1 Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Proxmox (Polaris)                         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              LXC: freqtrade-trading                  │    │
│  │                                                     │    │
│  │  ┌──────────┐  ┌───────────┐  ┌──────────────────┐ │    │
│  │  │Freqtrade │  │ Strategy  │  │  Risk Manager    │ │    │
│  │  │ Engine   │──│ Library   │──│  (circuit break)  │ │    │
│  │  └────┬─────┘  └─────┬─────┘  └──────────────────┘ │    │
│  │       │              │                               │    │
│  │       │        ┌─────┴─────┐                         │    │
│  │       │        │  Regime   │◄── reads regime files   │    │
│  │       │        │  Reader   │                         │    │
│  │       │        └───────────┘                         │    │
│  └───────┼──────────────────────────────────────────────┘    │
│          │                                                   │
│          ▼              ┌───────────────────────────────┐    │
│     ┌─────────┐        │     Cron: LLM Analyst         │    │
│     │ Kraken  │        │                               │    │
│     │  API    │        │  Phase 1: Describe (Claude)   │    │
│     └─────────┘        │  Phase 2: Interpret (GPT)     │    │
│                        │  Phase 3: Recommend (Claude)  │    │
│                        │  → writes regime JSON files   │    │
│                        └───────────────┬───────────────┘    │
│                                        │                     │
│  ┌─────────────────────────────────────┼──────────────────┐  │
│  │            Observer Ecosystem       │                  │  │
│  │                                     ▼                  │  │
│  │  ┌────────────┐  ┌──────────┐  ┌────────────┐        │  │
│  │  │   Vault    │  │   MCP    │  │  Motif     │        │  │
│  │  │  (ZFS)     │  │  Server  │  │  Library   │        │  │
│  │  └────────────┘  └──────────┘  └────────────┘        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Telegram Bot (Freqtrade native) → Adam's phone      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

```
Kraken API
    │
    ▼
Freqtrade (fetches OHLCV, computes indicators)
    │
    ├──▶ SQLite trade DB (on ZFS: /mnt/zfs-host/backup/trading/)
    │
    ▼
LLM Analyst (daily cron, reads latest candles + indicators)
    │
    ├──▶ Phase 1: Claude describes price structure
    ├──▶ Phase 2: GPT describes independently
    ├──▶ Phase 3: Claude triangulates both, produces regime tag
    │
    ▼
Regime JSON file (shared path)
    │
    ▼
Freqtrade Strategy (reads regime, selects sub-strategy, sizes position)
    │
    ├──▶ Orders → Kraken
    ├──▶ Trade log → Vault (via MCP)
    ├──▶ Tax export → Koinly-compatible CSV
    │
    ▼
Telegram notification → Adam's phone
```

### 2.3 Infrastructure Layout

| Component | Location | Notes |
|-----------|----------|-------|
| Freqtrade LXC | Proxmox on Polaris | Unprivileged container, pinned version |
| Trade database | `/mnt/zfs-host/backup/trading/freqtrade.db` | SQLite on ZFS, snapshotted |
| Strategy configs | `/mnt/zfs-host/backup/projects/observer-vault/01-Projects/crypto-trading/` | Git-tracked in vault |
| Regime files | `/mnt/zfs-host/backup/trading/regimes/` | JSON, written by cron, read by Freqtrade |
| LLM analyst | Cron job in Freqtrade LXC | Runs daily at 00:00 UTC (after weekly candle close) |
| API keys | `/etc/freqtrade/.env` (in LXC) | Outside vault, OIL gate protects |
| Backtest results | Vault `01-Projects/crypto-trading/backtests/` | Historical record |
| Trade journal | Vault `01-Projects/crypto-trading/journal/` | Written via MCP after each trade |

---

## 3. Strategy Library

### 3.1 Structure

```
strategies/
├── base/
│   ├── trend_following.py        # EMA crossover, breakout confirmation
│   ├── mean_reversion.py         # RSI oversold + Bollinger band bounce
│   └── volatility_breakout.py    # ATR-based breakout with volume confirm
├── regime/
│   ├── regime_selector.py        # Maps regime tags → strategy weights
│   └── regime_reader.py          # Reads regime JSON files
├── risk/
│   ├── position_sizer.py         # Kelly fraction capped at 2% risk
│   ├── circuit_breaker.py        # Drawdown monitor, kill switch
│   └── exposure_manager.py       # Portfolio heat tracker (max 6%)
└── config/
    ├── pairs.json                # BTC/AUD, ETH/AUD (Phase 1)
    ├── risk_params.json          # All risk limits in one place
    └── regime_thresholds.json    # Confidence thresholds per regime
```

### 3.2 Strategy Types

| Strategy | Regime | Entry Signal | Exit Signal | Typical Hold |
|----------|--------|-------------|-------------|-------------|
| **EMA Trend Follow** | trending-up | Price crosses above 21 EMA, confirmed by 50 EMA slope | Trail stop at 2x ATR below, or EMA cross back | 1-4 weeks |
| **Breakout Momentum** | trending-up, volatile | Weekly close above resistance with volume surge | 3x ATR trailing stop | 1-3 weeks |
| **RSI Mean Reversion** | ranging | Weekly RSI < 30 + price at support | RSI > 60 or 1.5x ATR target | 3-10 days |
| **Bollinger Squeeze** | ranging, low-vol | Bollinger bandwidth contracts then expands | Opposite Bollinger band or 2x ATR | 1-2 weeks |
| **Risk-Off / Cash** | trending-down, volatile-uncertain | N/A — no new entries | Close existing at trail stops | N/A |

### 3.3 Key Design Decision: Regime is the Brain, Strategies are Recipes

Strategies are deliberately simple and well-tested. They don't need to be smart. The LLM regime tagger is the intelligence layer — it decides *which* strategy to deploy. This separation means:

- Strategies can be backtested independently against regime-labeled data
- Regime accuracy can be measured independently of strategy performance
- Swapping strategies doesn't affect regime analysis and vice versa

---

## 4. LLM Analysis Pipeline

### 4.1 Three-Phase D/I/R Regime Tagging

**Schedule**: Daily at 00:00 UTC (covers weekly candle close on Sunday, daily candles Mon-Sat).

#### Phase 1 — Describe (Claude)

```
You are analyzing {pair} on the weekly and daily timeframes.

Weekly candles (last 26 weeks): {weekly_data}
Daily candles (last 30 days): {daily_data}
Indicators: RSI(14), EMA(21/50/200), ATR(14), Bollinger(20,2), Volume MA(20)

Describe what you observe. Focus on:
- Price structure: trend, range, breakout, or breakdown
- Volume patterns: confirming or diverging from price
- Key support and resistance levels
- Indicator readings and any divergences
- Volatility regime: expanding, contracting, or stable

Do not interpret or recommend. Only describe what the data shows.
```

#### Phase 1b — Describe (GPT, independent)

Same prompt, same data, different model. No access to Claude's output.

#### Phase 2 — Interpret (Triangulation)

```
Two independent analysts examined {pair}:

Analyst A: {claude_description}
Analyst B: {gpt_description}

Interpret what this means:
1. Where do the analysts agree? (high-confidence signals)
2. Where do they disagree? (uncertainty zones)
3. What market regime does this indicate?
   - trending-up: sustained directional move with momentum
   - trending-down: sustained decline with volume
   - ranging: bounded between support/resistance
   - volatile-uncertain: no clear structure, elevated risk
4. Confidence score (0.0 - 1.0)
5. Key risks to this interpretation
```

#### Phase 3 — Recommend (Action Bias)

```
Given this regime analysis:
  Regime: {regime}
  Confidence: {confidence}
  Agreement areas: {agreements}
  Disagreement areas: {disagreements}
  Risks: {risks}

Available strategies: {strategy_list_with_descriptions}

Recommend:
- Strategy to activate (or NONE if confidence < 0.6)
- Position size modifier: 0.5x (low conviction) or 1.0x (high conviction)
- Key price levels to watch
- Conditions that would invalidate this regime
- Suggested re-evaluation trigger
```

### 4.2 Output Format

Regime file written to `/mnt/zfs-host/backup/trading/regimes/{pair}_{date}.json`:

```json
{
  "pair": "BTC/AUD",
  "date": "2026-03-27",
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
  "analyst_agreement": 0.85,
  "risks": ["resistance cluster at 108k", "RSI approaching overbought"],
  "re_evaluate_if": "daily close below 95000",
  "claude_description_hash": "abc123",
  "gpt_description_hash": "def456",
  "cost_usd": 0.42
}
```

### 4.3 Cost Management

| Item | Estimated Daily Cost |
|------|---------------------|
| Claude Phase 1 (per pair) | ~$0.30 |
| GPT Phase 1b (per pair) | ~$0.15 |
| Claude Phase 2+3 (per pair) | ~$0.25 |
| **Total (2 pairs)** | **~$1.40/day** |
| **Monthly** | **~$42/month** |

Cache descriptions for unchanged weekly candles. Skip Phase 1b on days with no significant price movement (ATR filter).

---

## 5. Risk Management Framework

### 5.1 Position Sizing

```
Base risk per trade:     2% of total capital
Max portfolio heat:      6% (sum of all open position risk)
Position size formula:   (Capital × Risk%) / (Entry - Stop Loss)
Kelly fraction cap:      Never exceed half-Kelly
Position modifier:       0.5x or 1.0x based on regime confidence
```

### 5.2 Drawdown Limits & Circuit Breakers

| Trigger | Action | Reset Condition |
|---------|--------|-----------------|
| **5% weekly drawdown** | Reduce position sizes to 0.5x | Next positive week |
| **10% monthly drawdown** | Close all positions. Paper-only mode. | Adam manually reviews and re-enables |
| **3 consecutive losing trades** | Skip next signal, wait for regime re-confirmation | New regime analysis with confidence > 0.7 |
| **Regime confidence < 0.4** | No new entries, tighten existing stops | Confidence recovers above 0.6 |
| **LLM analyst failure** | No new entries (fail-safe to cash) | Analyst resumes successfully |

### 5.3 Invariants (Non-Negotiable Rules)

1. **No leverage** in any phase
2. **No new entries** without a valid regime file < 48 hours old
3. **Every trade has a stop loss** — no exceptions, set at entry time
4. **Max 3 concurrent positions** across all pairs
5. **BTC and ETH only** in Phase 1 (add alts only after 6 months live track record)
6. **No manual override of circuit breakers** without written journal entry explaining why

---

## 6. Testing Pipeline

### 6.1 Five-Gate Progression

```
Gate 1: Backtest          Gate 2: Walk-Forward       Gate 3: Paper Trade
(2+ years data)           (rolling windows)          (8 weeks minimum)
     │                         │                          │
     ▼                         ▼                          ▼
  Sharpe ≥ 1.2             Degradation < 25%         Results within 35%
  Max DD ≤ 20%             from backtest              of walk-forward
  Profit Factor ≥ 1.3      Still profitable           No circuit breaker
  > 200 trades             across all windows         triggers
     │                         │                          │
     ▼                         ▼                          ▼
Gate 4: Micro-Live         Gate 5: Scale
($500 max exposure)        (target allocation)
     │                         │
     ▼                         ▼
  4 weeks profitable       Gradual increase
  Execution within 15%     over 4+ weeks
  of paper results         Monthly review
  Slippage acceptable      cadence established
```

### 6.2 Backtest Requirements

- **Data**: Minimum 2 years of OHLCV data per pair
- **Regime labels**: Retroactively generated using LLM pipeline on historical data
- **Walk-forward windows**: 6-month train, 2-month test, rolling monthly
- **Metrics tracked**: Sharpe ratio, Sortino ratio, max drawdown, profit factor, win rate, average trade duration, total trades
- **Overfitting guards**: No more than 5 optimizable parameters per strategy. Hyperopt limited to 500 iterations.

### 6.3 Paper Trading Protocol

- Use Freqtrade `dry_run: true` mode
- Real market data, simulated execution
- Daily journal entries in vault: what happened, what the regime said, what the bot did
- Weekly D/I/R review: Describe performance, Interpret patterns, Recommend adjustments
- After 8 weeks: formal go/no-go decision documented in vault

---

## 7. Observer Integration

### 7.1 Vault Storage

```
01-Projects/crypto-trading/
├── README.md                          # This design doc (promoted)
├── config/
│   ├── freqtrade-config.json          # Main Freqtrade config (sanitised, no secrets)
│   ├── pairs.json
│   ├── risk_params.json
│   └── regime_thresholds.json
├── strategies/                        # Strategy source code
├── backtests/
│   └── {strategy}_{date}.json         # Backtest result snapshots
├── journal/
│   ├── daily/
│   │   └── {date}.md                  # Daily trade journal
│   └── weekly/
│       └── {week}.md                  # Weekly D/I/R review
├── regimes/
│   └── archive/                       # Historical regime analyses
├── tax/
│   └── FY{year}_trades.csv            # Koinly-compatible export
└── performance/
    └── monthly_{date}.md              # Monthly performance report
```

### 7.2 MCP Tools (New)

Add to `observer-control-plane` as a trading module:

| Tool | Purpose |
|------|---------|
| `trading_status` | Current positions, P&L, regime, portfolio heat |
| `trading_regime` | Latest regime analysis for each pair |
| `trading_journal_write` | Write daily/weekly journal entry to vault |
| `trading_performance` | Performance metrics over configurable period |
| `trading_circuit_breaker_status` | Current circuit breaker state |
| `trading_tax_export` | Generate Koinly-compatible CSV for date range |

### 7.3 Motif Library Integration

Trade outcomes and regime analysis feed the motif library:

- **Regime transitions** become instances of **Explicit State Machine Backbone**
- **Circuit breaker activations** are instances of **Ratchet with Asymmetric Friction**
- **Strategy performance decay** feeds **Observer-Feedback Loop** (the system learns when regimes are misidentified)
- **Testing pipeline gates** are **Progressive Formalization** in action

### 7.4 Leaderboard Scraper (OCP Source Adapter)

New OCP source adapter: `ocp-scraper-leaderboards`

**Sources**:
1. Freqtrade Strategies GitHub — public strategy repos, extract entry/exit logic
2. TradingView Community — top-rated Pine scripts for weekly timeframes
3. Crypto signal leaderboards — track verified signal providers' accuracy

**Pipeline**:
```
Scrape → Extract strategy logic → D/I/R analysis:
  Describe: What does this strategy do?
  Interpret: What market regime does it target? What are its assumptions?
  Recommend: Is it worth backtesting? Does it complement our existing library?
```

This becomes the fourth OCP source alongside the existing three.

---

## 8. Tax Management (Australian CGT)

### 8.1 Requirements

- Every trade is a CGT event under ATO rules
- Cost basis tracking per lot (FIFO method)
- 50% CGT discount if held > 12 months (unlikely for weekly strategies)
- Report on annual tax return via myTax or accountant

### 8.2 Implementation

- Freqtrade logs every trade with timestamp, pair, amount, price, fees
- Daily export script generates Koinly-compatible CSV
- Koinly (or CryptoTaxCalculator) handles CGT calculations
- Quarterly spot-checks: manual verification of 5 random trades
- End-of-year: generate tax report, review with accountant

### 8.3 Record Keeping

ATO requires 5-year retention. All trade records stored on ZFS (snapshotted, backed up). Vault stores the summaries; raw trade database stored separately.

---

## 9. Alerting & Monitoring

### 9.1 Telegram Notifications (Night-Shift Friendly)

| Event | Priority | Message |
|-------|----------|---------|
| Trade executed | Normal | Pair, direction, size, entry price |
| Stop loss hit | Normal | Pair, loss amount, remaining capital |
| Circuit breaker triggered | **High** | Which breaker, action taken, human review needed |
| Regime change | Low | New regime, confidence, strategy switch |
| Daily summary | Low | P&L, open positions, portfolio heat |
| LLM analyst failure | **High** | Which phase failed, system defaulting to no-trade |
| Weekly review due | Low | Reminder to write journal entry |

### 9.2 Dashboard (Optional, Phase 2)

Lightweight read-only web dashboard on local network:
- Current positions and P&L
- Regime status per pair
- Circuit breaker status
- Performance charts

Not critical for Phase 1. Telegram covers the essentials.

---

## 10. Implementation Sequence

### Phase 0: Foundation (Week 1-2)
- [ ] Create Freqtrade LXC on Proxmox
- [ ] Install Freqtrade, pin version
- [ ] Configure Kraken API (read-only first, trade permissions later)
- [ ] Set up ZFS paths for trade data
- [ ] Create vault project directory structure

### Phase 1: Strategy Development (Week 3-6)
- [ ] Implement base strategies (trend follow, mean reversion, volatility breakout)
- [ ] Implement regime reader and selector
- [ ] Build LLM analyst pipeline (cron job)
- [ ] Generate historical regime labels for backtest data
- [ ] Run backtests, iterate on parameters

### Phase 2: Walk-Forward Validation (Week 7-8)
- [ ] Run walk-forward tests on all strategies
- [ ] Evaluate degradation from backtest
- [ ] Tune regime confidence thresholds
- [ ] Document results in vault

### Phase 3: Paper Trading (Week 9-16, 8 weeks)
- [ ] Enable Freqtrade dry-run mode
- [ ] Wire Telegram notifications
- [ ] Begin daily journal entries
- [ ] Weekly D/I/R reviews
- [ ] Wire MCP tools for trading status
- [ ] Formal go/no-go review at week 16

### Phase 4: Micro-Live (Week 17-20)
- [ ] Enable trade permissions on Kraken API
- [ ] Fund with $500 AUD maximum
- [ ] Monitor execution quality vs paper
- [ ] Track slippage and fees

### Phase 5: Scale (Week 21+)
- [ ] Gradual position size increase over 4+ weeks
- [ ] Monthly performance reviews
- [ ] Consider adding pairs (after 6 months)
- [ ] Wire leaderboard scraper as OCP source

---

## 11. Pre-Mortem

| Failure Mode | Mitigation | Severity |
|-------------|-----------|----------|
| LLM gives bad regime tag | Confidence threshold + triangulation + fail-safe to cash | Medium — contained by risk limits |
| Exchange API down during night shift | Freqtrade retry logic + existing stops on exchange | Low — orders already placed |
| Drawdown exceeds limits while sleeping | Automated circuit breaker closes positions | Low — no human required |
| Strategy overfits in backtest | Walk-forward validation + small parameter space | Medium — caught before paper |
| API keys compromised | Trade-only permissions (no withdrawal) + exchange alerts | Medium — limited blast radius |
| ZFS pool failure | ZFS redundancy + offsite backup | Very Low — existing infra |
| Tax calculation error | Quarterly spot-checks + professional review at EOFY | Low — caught before filing |
| LLM cost spike | Daily cost tracking + hard budget cap in cron job | Low — $50/month cap |
| Freqtrade version breaks strategies | Pinned version, test upgrades in separate container | Low — controlled rollout |

All failure modes are survivable. No single failure leads to catastrophic capital loss.

---

## 12. Convergence Statement

This design was reached through 3 D/I/R loops:

1. **Loop 1** — Structural decomposition: identified two-speed architecture, six motif mappings
2. **Loop 2** — Simplification: collapsed from 10 components to 3 (Freqtrade + cron + Observer integration)
3. **Loop 3** — Gap analysis and pre-mortem: all gaps resolved, all failure modes survivable

**Coherence check**:
- All components defined without gaps: **Yes**
- Connections flow without friction: **Yes** — regime files are the clean interface
- Nothing to add: **Yes** — resisted dashboard, ML models, on-chain analysis, alt coins
- Nothing to strip: **Yes** — every component is load-bearing
- Survives pre-mortem: **Yes** — all 9 failure modes mitigated

**Next action**: Adam reviews this document, approves or revises, then Phase 0 begins.
