---
meta_version: 1
kind: plan
status: approved
authority: high
domain: [trading, dir-engine]
source: atlas_write
confidence: validated
mode: build
created: 2026-04-05T12:00:00+11:00
modified: 2026-04-05T12:00:00+11:00
iteration: 3
maxIterations: 128
loopStatus: converged
last_phase: REFLECT
failing_criteria: []
verification_summary: "0/14"
cssclasses: [status-approved]
motifs: [regime-detection, composition-trading, langevin-dynamics, orthogonal-signals]
refs:
  - 01-Projects/trading-system/.prd/PRD-20260403-btc-regime-detection.md
  - 01-Projects/trading-system/src/classifier/price_landscape.py
  - 01-Projects/dir-engine/src/energy-core.ts
---

# D/I/R Composition-Aware Trading Strategy with Orthogonal Signal Integration

> Landscape-native strategy using D/I/R thermodynamic state as primary signal,
> Volume Profile spatial geometry as entry/exit structure, and CVD as confidence
> modifier. Three D/I/R cycles converged this design.

---

## STATUS

| What | State |
|------|-------|
| Progress | 0/14 ISC criteria |
| Phase | APPROVED — ready to build |
| D/I/R cycles | 3 (converged — no substantive changes between C2 and C3) |

---

## 1. CONTEXT

### 1.1 What Exists

- **PriceLandscape** (`src/classifier/price_landscape.py`): K=3 classifier with Gaussian wells, barrier computation, transition scores, gradients. Fitted from OHLCV-derived 6D vectors.
- **12 fast features** (`src/features/indicators_fast.py`): 4 D-axis, 4 I-axis, 4 R-axis, rolling window.
- **6D vectorizer** (`src/features/vectorizer.py`): D/I/R/temporal/density/entropy, L2-normalized.
- **Backtest engine** (`src/backtest/engine.py`): bar-by-bar, long-only, market orders only, trailing stop.
- **5 tokens**: BTC (75k bars), ETH (75k), SOL (49k), BNB (73k), ADA (69k) — all 1h OHLCV.
- **K=3 confirmed** across all 5 tokens with consistent basin structure.

### 1.2 What Failed and Why

All previous strategies used D/I/R regime as a simple trade filter with momentum/oscillator indicators (RSI, MACD, moving averages). These indicators are **redundant** with D/I/R — they measure lagged versions of the same thermodynamic state the regime detector already captures. Result: regime strategies lost money while buy-and-hold returned 1,234%.

### 1.3 Key Insight

D/I/R measures *what the market is doing* (thermodynamic state). The **orthogonal complement** is *where transactions occurred* (spatial geometry). Volume Profile and order flow measure the spatial dimension that D/I/R doesn't capture.

---

## 2. SIGNAL HIERARCHY

Three layers, strict priority:

| Layer | Signal | Role | Source |
|-------|--------|------|--------|
| Primary | D/I/R energy landscape | Trade/don't trade, which template, regime stability | `PriceLandscape.classify()` + `.transition()` |
| Secondary | Volume Profile (VPVR) | Where to enter, where to stop, where to target | New: `src/features/volume_profile.py` |
| Tertiary | CVD | Confidence modifier (±20%) | New: `src/features/cvd.py` |

### 2.1 BANNED Indicators

**Do NOT use anywhere in the strategy** — these are lagged versions of the regime signal:

RSI, MACD, Moving Average crossovers, Bollinger Band signals, Stochastic oscillator.

**Explicitly ALLOWED as scaling functions** (not signal generators):

ATR — used as price-space bridge to translate feature-space magnitudes into price distances.

---

## 3. ARCHETYPE TEMPLATES

Each K=3 basin gets a strategy template instantiated with token-specific parameters at runtime. Basin identity is determined by centroid feature profile (D-axis dominant, I-axis dominant, R-axis dominant), not by label string.

### 3.1 D-regime (trending/breakout)

- **Entry**: Limit buy at HVN zone on pullback (default)
- **Momentum bypass**: If `transition_score < 0.15` AND `basin_depth > 1.5`, market entry at 50% computed size. Stop at 1.5×ATR below entry (tighter for riskier entry type).
- **Target**: `entry + base_atr * (1 + 3 * normalised_barrier)` — continuous [1×ATR, 4×ATR]
- **Stop**: Barrier-aware (see Section 5.3)
- **Sizing**: Full allocation scaled by score (see Section 5.4)
- **Character**: Patient entry, let winners run, structural exit

### 3.2 I-regime (consolidation/mean-reversion)

- **Entry**: DO NOT TRADE in most cases.
- **Exception**: If barrier to D-basin is very low (`barrier_height_to_D < 0.2`), pre-position with 25% size at range low (bottom HVN). This captures imminent breakout setups.
- **Character**: Wait regime. Capital preservation.

### 3.3 R-regime (reflexive/feedback)

- **Entry**: DO NOT TRADE. This is the danger regime.
- **If holding from D-regime**: Exit gates should already have fired.
- **Character**: Market feeding back on itself — bubbles and crashes. Stay out.

---

## 4. ENTRY PROTOCOL

```
IF token classified as D-regime
   AND confidence > threshold (default 0.5)
   AND transition_score < 0.3 (deep in basin, stable)
THEN:
   IF transition_score < 0.15 AND basin_depth > 1.5:
      # Momentum bypass — regime is extremely stable
      MARKET BUY at 50% of computed position size
      stop = entry - 1.5 * base_atr
   ELSE:
      # Default — patient limit entry
      Identify nearest HVN zone below current price
      LIMIT BUY at HVN zone center (±0.5% tolerance)
      Order lives for minimum 12 bars
      If not filled after 12 bars AND regime still D: may reposition
      If not filled and regime changes: cancel, 6-bar cooldown
```

---

## 5. EXIT PROTOCOL

### 5.1 Pre-Gate — Gradient Early Warning (25% trim)

```
gradient = landscape.energy(vector)["gradient"]
gradient_magnitude = norm(gradient)
gradient_direction = dot(gradient, current_centroid - vector)

IF gradient_magnitude > gradient_threshold
   AND gradient_direction < 0 (pointing AWAY from basin center)
THEN:
   SELL 25% of position (trim)
   Log: "pre-gate gradient warning"
```

This fires 5-15 bars earlier than Gate 1, limiting drawdown during fast transitions.

### 5.2 Gate 1 — Structural Failure (immediate full exit)

```
IF transition_score > 0.8
THEN:
   MARKET SELL ALL remaining position immediately
   Regime integrity has decayed.
   Fires regardless of profit/loss or price level.
```

### 5.3 Gate 2 — Spatial Target (50% scale-out)

```
target = entry + base_atr * (1 + 3 * normalised_barrier)

IF price >= target OR price hits major VPVR resistance (top HVN above)
THEN:
   SELL 50% of position (take profit)
   Remaining rides until Pre-Gate trim or Gate 1 fires.
```

### 5.4 Stop Loss — Barrier-Aware

```
IF barrier_height > 0.7 (stable regime):
   stop = below second HVN down from entry (wide — let it breathe)

IF barrier_height <= 0.7 AND barrier_height > 0.4 (moderate):
   stop = below nearest HVN from entry

IF barrier_height <= 0.4 (shallow regime):
   stop = just below nearest HVN (tight — cut quickly)

FLOOR: stop distance >= 1 * base_atr (prevents micro-stops)

For momentum bypass entries: stop = entry - 1.5 * base_atr (override)
```

---

## 6. POSITION SIZING

### 6.1 Per-Token Sizing

```python
base_allocation = available_capital / max(num_qualifying_tokens, 1)

position_size = base_allocation * (basin_depth * barrier_height) / distance_to_stop

# Safety rails
distance_to_stop = max(distance_to_stop, base_atr)  # floor
position_size = min(position_size, 0.30 * total_capital)  # 30% cap per token
```

### 6.2 CVD Confidence Modifier

```python
if cvd_rising and regime == "D":
    confidence_modifier = 1.15  # +15% (buyers driving the move)
elif cvd_falling and regime == "D":
    confidence_modifier = 0.85  # -15% (move not supported)
else:
    confidence_modifier = 1.0

position_size *= confidence_modifier
```

### 6.3 Multi-Token Allocation

```python
FOR each token in watchlist:
    IF in D-regime AND confidence > threshold AND transition_score < 0.3:
        score = (basin_depth * barrier_height) / distance_to_stop

Sort tokens by score descending.
Allocate capital top-down: best score gets largest allocation.
IF 0 tokens qualify: 100% cash (flat).

# Correlation guard
corr_matrix = rolling_30d_correlation(qualifying_tokens)
IF any pair has correlation > 0.8:
    Treat correlated group as single position
    Combined allocation = single token allocation
    Split within group by relative score

# Diversification check
weights = [allocation_i / total_deployed for each token]
effective_positions = 1 / sum(w**2 for w in weights)
IF effective_positions < 1.5 AND num_tokens > 1:
    Cap total deployment at 60% of capital
```

---

## 7. TECHNICAL SPECIFICATIONS

### 7.1 Volume Profile Module (`src/features/volume_profile.py`)

```python
class VolumeProfile:
    def __init__(self, lookback: int = 500, num_bins: int = 100):
        """
        lookback: bars to include (500 = ~21 days at 1h)
        num_bins: price bins for volume distribution
        """

    def compute(self, df: pd.DataFrame) -> VolumeProfileResult:
        """
        Distribute each bar's volume across high-low range.
        Bin size adapts to ATR(14)/20 for resolution scaling.
        Returns HVN/LVN levels with volumes.
        """

    def get_hvn_below(self, price: float, n: int = 3) -> list[PriceLevel]:
        """Top N high-volume nodes below given price."""

    def get_hvn_above(self, price: float, n: int = 3) -> list[PriceLevel]:
        """Top N high-volume nodes above given price (resistance)."""

    def get_lvn_between(self, low: float, high: float) -> list[PriceLevel]:
        """Low-volume nodes between two prices (air pockets)."""
```

- HVN = price levels in top 20th percentile of volume
- LVN = price levels in bottom 20th percentile
- HVN is a **zone** (±0.5% of level center), not a point

### 7.2 CVD Module (`src/features/cvd.py`)

```python
def compute_cvd(df: pd.DataFrame) -> pd.Series:
    """
    Cumulative Volume Delta from OHLCV.
    close > open: bar volume counted as buy
    close < open: bar volume counted as sell
    close == open: split 50/50
    Returns cumulative sum.
    """

def cvd_trend(cvd: pd.Series, window: int = 24) -> pd.Series:
    """
    Rolling slope of CVD over window.
    Positive = rising (buying pressure).
    Negative = falling (selling pressure).
    """
```

### 7.3 Strategy Engine (`src/strategy/landscape_strategy.py`)

Replaces `src/strategy/dir_regime.py`. Consumes:
- PriceLandscape outputs (basin, energy, transition_score, barrier_heights, gradient)
- Volume Profile (HVN levels for entry/stop)
- CVD (confidence modifier)

Implements:
- Archetype templates (D/I/R)
- Entry protocol with momentum bypass
- Two-stage exit (pre-gate + Gate 1 + Gate 2)
- Barrier-aware stops
- Barrier-scaled position sizing with safety rails
- Per-trade logging with full context

### 7.4 Backtest Engine Updates (`src/backtest/engine.py`)

Extensions required:
- **Limit orders**: Order book with pending orders, fill when price reaches level
- **Order lifecycle**: 12-bar minimum life, 6-bar cooldown after cancel
- **Partial exits**: 50% scale-out at target, 25% trim at pre-gate
- **Position tracking**: Support multiple partial fills and exits per trade
- **Per-trade logging**: regime, barrier, transition_score, HVN level, CVD state, gradient magnitude

### 7.5 Walk-Forward Configuration

```
train_window = 2000 bars (~83 days)
step_size = 500 bars (~21 days)
warmup = 100 bars (features stabilize, no trading)
refit: PriceLandscape.fit() on each new window
```

---

## 8. BUILD SEQUENCE

1. Volume Profile module (`src/features/volume_profile.py`)
2. CVD module (`src/features/cvd.py`)
3. Strategy engine (`src/strategy/landscape_strategy.py`)
4. Backtest engine updates (limit orders, partial exits, logging)
5. Integration pipeline script
6. Run backtest on all 5 tokens with walk-forward validation
7. Run multi-token portfolio simulation
8. Generate comparison: old strategy vs new strategy vs buy-and-hold

---

## 9. ISC EXIT CRITERIA

| # | Criterion | Testable? |
|---|-----------|-----------|
| 1 | Volume Profile produces valid HVN/LVN levels for all 5 tokens across all walk-forward windows | Y |
| 2 | CVD computation runs without error on all 5 tokens | Y |
| 3 | Strategy engine uses ONLY landscape + VPVR + CVD — no banned indicators present in code | Y (grep) |
| 4 | Default entries are limit orders at HVN levels | Y |
| 5 | Momentum bypass fires only when transition_score < 0.15 AND basin_depth > 1.5 | Y |
| 6 | Pre-gate gradient warning fires and trims 25% before Gate 1 threshold | Y |
| 7 | Gate 1 exits all remaining when transition_score > 0.8 | Y |
| 8 | Gate 2 scales out 50% at ATR-derived target | Y |
| 9 | Position sizing uses barrier-scaled formula with floor (1×ATR) and cap (30%) | Y |
| 10 | Stop loss width correlates with barrier height (wide for deep basins, tight for shallow) | Y |
| 11 | Multi-token allocation ranks by score function and enforces correlation guard | Y |
| 12 | Backtest supports limit orders with 12-bar minimum life and 6-bar cooldown | Y |
| 13 | Walk-forward runs on all 5 tokens (2000-bar train, 500-bar step, 100-bar warmup) | Y |
| 14 | All trades logged with: regime, barrier_height, transition_score, HVN_level, CVD_state, gradient_mag | Y |

---

## 10. D/I/R CYCLE LOG

### Cycle 1 — DIVERGE
Questioned 10 assumptions: VPVR quality at 1h granularity, CVD approximation weakness, ATR-barrier mapping arbitrariness, Gate 1 latency in fast transitions, limit order opportunity cost in strong trends, K=3 label drift, position sizing blow-up risk, ATR in banned spirit, token correlation, order churn.

### Cycle 2 — CONVERGE
Resolved all 10: adaptive VPVR bins + 500-bar lookback, CVD downgraded to ±20% modifier, continuous barrier-to-ATR mapping, two-stage exit (gradient pre-gate + Gate 1), momentum bypass for extreme stability, centroid-character labeling, sizing floor+cap, ATR explicitly allowed as bridge, correlation guard, 12-bar order life + 6-bar cooldown.

### Cycle 3 — REFLECT
Walked through complete trade lifecycle — all pieces connect. One friction found (momentum bypass stop distance) — resolved with 1.5×ATR override. Added walk-forward specification (2000/500/100). Stripped trailing stop (subsumed by two-stage exit). Architecture stable — no substantive changes. **Converged.**
