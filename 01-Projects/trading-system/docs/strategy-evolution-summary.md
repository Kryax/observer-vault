# Strategy Evolution Summary — v5.1b → v5.2 → v5.3

## Version Descriptions

| Version | Description |
|---------|-------------|
| v5.1b | Barbell entry (25% probe / 75% conviction at bar 8 with dE/dt < 0 gate). All v3.1 exit parameters. |
| v5.2 | v5.1b + profit ratchet (+2%→+1%, +4%→+2%, +6%→+4%) + asymmetric destab (2x threshold when in profit) |
| v5.3 | v5.1b + multi-timeframe macro context (daily D/I/R gates hourly entries: D=full, I=50%, R=skip) |

## Results Comparison

### EV Per Trade ($)

| Token | v5.1b | v5.2 | v5.3 |
|-------|-------|------|------|
| BTC | +2.17 | +2.17 | **+3.52** |
| ETH | -1.15 | -0.53 | -1.08 |
| SOL | +0.57 | +0.60 | -0.23 |
| BNB | +1.62 | +1.62 | +0.35 |
| ADA | +2.04 | +2.03 | +2.01 |

### Win/Loss Ratio

| Token | v5.1b | v5.2 | v5.3 |
|-------|-------|------|------|
| BTC | 2.35x | 2.34x | **2.88x** |
| ETH | 1.34x | 1.55x | 1.19x |
| SOL | 1.85x | 1.85x | 1.64x |
| BNB | 2.18x | 2.18x | 1.76x |
| ADA | 2.37x | 2.36x | **2.41x** |

### Win Rate

| Token | v5.1b | v5.2 | v5.3 |
|-------|-------|------|------|
| BTC | 39.6% | 39.4% | **47.0%** |
| ETH | 36.3% | 36.5% | 37.4% |
| SOL | 37.8% | 37.8% | 36.5% |
| BNB | 39.4% | 39.4% | 38.7% |
| ADA | 39.6% | 39.6% | **41.9%** |

### Max Drawdown

| Token | v5.1b | v5.2 | v5.3 |
|-------|-------|------|------|
| BTC | -2.4% | -2.5% | -2.4% |
| ETH | -2.4% | -2.4% | **-2.0%** |
| SOL | -2.7% | -2.7% | -2.7% |
| BNB | -1.5% | -1.5% | **-0.9%** |
| ADA | -2.0% | -2.0% | **-1.6%** |

### Trade Count

| Token | v5.1b | v5.2 | v5.3 |
|-------|-------|------|------|
| BTC | 283 | 282 | 181 |
| ETH | 369 | 370 | 281 |
| SOL | 251 | 251 | 197 |
| BNB | 315 | 315 | 181 |
| ADA | 316 | 316 | 265 |

## Key Findings

### v5.2 (Profit Ratchet + Asymmetric Destab)

**Verdict: Near no-op.** The ratchet milestones (+2%/+4%/+6%) are too high for typical trade PnL. Most trades exit via spatial stop or probe abort before reaching +2% unrealised profit. The asymmetric destab barely changes outcomes because losing trades exit via the 2% stop, not destab. Only ADA showed meaningful ratchet activity (48/316 exits).

**Lesson:** The 2% spatial stop dominates exit behavior. Any exit innovation must work within the stop's constraint — most trades never reach +2% profit on a 35% max position.

### v5.3 (Multi-Timeframe Macro Context)

**Verdict: Strong signal for BTC and ADA, mixed for others.**

Wins:
- **BTC: 47.0% win rate** (from 39.6%), W/L 2.88x, EV $3.52/trade — best result across all versions
- **ADA: 41.9% win rate** (from 39.6%), first token above 40% target
- **BNB: MaxDD -0.9%** (from -1.5%), trade count cut 43% with maintained positive EV
- Trade count reduced 16-43% across all tokens — macro filter eliminates counter-trend entries

Losses:
- **ETH: W/L degraded to 1.19x** (from 1.34x) — macro filter removes some of the best trades
- **SOL: EV flipped negative** (-$0.23 from +$0.57) — SOL's daily regime may not align well with hourly

**Lesson:** Multi-timeframe gating works best for assets with strong macro trends (BTC, ADA). For assets with more mean-reverting daily behavior (ETH, SOL), the macro filter is too aggressive.

## Recommended Next Steps

1. **Token-adaptive macro gating** — enable macro filter only for BTC/ADA/BNB where it helps, disable for ETH/SOL
2. **Softer macro R gate** — instead of skip, reduce size to 25% (current is 0%). Some counter-trend entries are real signals.
3. **Lower ratchet milestones** — try +1%→lock+0.5%, +2%→lock+1% to match actual trade PnL distribution
4. **15-minute execution layer** (Layer 3) — use lower timeframe for entry precision within confirmed D-regimes, flagged for future work
