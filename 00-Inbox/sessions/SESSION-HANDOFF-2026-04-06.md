# Session Handoff — Trading System Evolution (April 5-6, 2026)

## IMMEDIATE ACTION: Atlas has HMM v4 prompt ready

The prompt is saved at `/mnt/user-data/outputs/atlas-prompt-hmm-v4-forward-labels.md` on Claude's filesystem. Paste it into a fresh Atlas session. This is the critical next step.

**What v4 changes:**
1. Drop to 2 features (log returns + realized volatility only — Hurst and autocorrelation don't discriminate in crypto)
2. Label HMM states by empirical forward returns (state with worst forward returns = R, best = D)
3. Keep asymmetric persistence (D=24h, I=24h, R=3h)
4. Keep weekly rebalancing + 5% momentum switch threshold

**Why:** v3 proved the labels are inverted — HMM calls crash periods "D" and safe periods "R". Forward-return labelling mathematically guarantees correct labels.

---

## Who is Adam

Mining surveyor, NSW Australia, night shifts. Observer project sole architect. Deep Linux background since 90s. Thinks in fractals — whole-to-parts. Surveyor's methodology: triangulate across independent sources. Voice-to-text communication — interpret intent, not literal words. Values honest pushback. Anti-sycophancy.

Uses deliberate multi-agent triad: Claude (strategic/creative), Atlas/Claude Code (engineering execution), Gemini (mathematical/structural analysis). ChatGPT consulted for structured evaluation.

---

## Trading System — Complete Evolution Record

### Phase 1: Micro-trading (ALL FAILED — $12/year on $1,000)

| Version | Approach | Result |
|---------|----------|--------|
| v1 | Old RSI/trailing stops | -97.7% |
| v2 | Langevin-native continuous allocation | Flat (±2%) |
| v3-v3.1 | Markov + VPVR entries, 2% stops | Flat, W/L 1.34-2.88x |
| v4 | Dampened exits, forced scale-in | Worse |
| v5-v5.1b | Survival filter barbell entry | All 5 tokens slightly +EV |
| v5.2-v5.3 | Profit ratchet, multi-timeframe | BTC 47% WR, still ~flat returns |

**Diagnosis (triad convergence):** D/I/R signal is allocation tool, not trade trigger.

### Phase 2: Regime Allocator (PARTIALLY WORKED)

| Version | Result |
|---------|--------|
| Allocator v1 (hourly toggle) | -65% to -99% (friction death, 1,800 trades) |
| **Allocator v2 (72-bar persistence)** | **BTC +630%, ADA +345%, BNB +901% over 8 years** |
| Tactical overlay (dip-buying in D) | -32% to -98% (worse than doing nothing) |

**Key finding:** Signal has ALLOCATION value but NOT TIMING value. Passive allocator is the only micro-trading-era approach that works.

### Phase 3: HMM Rebuild (IN PROGRESS)

Gemini diagnosed: text-adapted Langevin features wrong for price data. Must use price-native features + HMM instead of K-means + Gaussian wells.

| Version | Return | MaxDD | Problem |
|---------|--------|-------|---------|
| HMM v1 (4 features, no persistence) | +16,084% | -74.8% | Noise-fitting: switching every 2.5 hours, Hurst stuck at 0.95 |
| HMM v2 (Hurst fixed, 72-bar symmetric persist) | +934% | -86.0% | Persistence too slow for crash exit, 2022: -77.6% |
| HMM v3 (asymmetric persist D=24/I=24/R=3) | +278-349% | -89-91% | **Labels inverted** — HMM calls crashes "D" and safe periods "R" |
| **HMM v4 (PENDING)** | — | — | 2-feature HMM + forward-return labelling |

---

## Key Files

All under `/mnt/zfs-host/backup/projects/observer-vault/01-Projects/trading-system/`:

### Strategy:
- `src/strategy/regime_allocator.py` — passive allocation (works)
- `src/strategy/dual_momentum.py` — HMM dual momentum (current, needs v4 fix)
- `src/strategy/tactical_overlay.py` — dip-buying (FAILED)

### Classifier/Features:
- `src/features/price_native.py` — 4 features (v4 will use only log_return + realized_vol)
- `src/classifier/hmm_regime.py` — 3-state HMM (**needs `_assign_labels` rewrite for v4**)

### Pipeline:
- `src/hmm_momentum_pipeline.py` — current pipeline (v3, needs v4 updates)

### Results:
- `data/hmm_momentum_results.json` (v1)
- `data/hmm_momentum_v2_results.json`
- `data/hmm_momentum_v3_results.json`
- `data/regime_allocator_v2_results.json`

### Venv:
- `.venv/` — Python 3.14 with hmmlearn, pandas, numpy, sklearn

---

## Triad Consultations Summary

### Gemini (mathematical/structural):
1. Text-adapted features wrong for price → HMM rebuild with price-native features
2. D-regime predicts variance expansion, not direction → pair with momentum for direction
3. Asymmetric persistence: D=24h, I=24h, R=3h
4. **Forward-return labelling + 2-feature simplification** (the v4 fix)
5. Dual momentum deployment: concentrate 100% in single strongest token

### ChatGPT (structured evaluation):
1. D/I/R framework: "nontrivial synthesis with pockets of originality built from mostly non-original components"
2. Trading: "system has a fear of success" / "stunned mullet"
3. State allocation > trade triggers
4. Baseline warfare, representation parity, separate claims
5. ChatGPT shows D/I collapse — can't acknowledge R-axis creative contributions

### Key architectural decisions locked:
- **Signal is allocator, not trade trigger** (triad convergence)
- **HMM replaces K-means + Gaussian Langevin for price data** (Gemini)
- **Dual momentum: 100% in single strongest token** (Gemini + ChatGPT)
- **Daily/weekly rebalance, not hourly** (all three)
- **No price stops — regime transition is the only exit** (all three)

---

## Philosophical Thread (for context, not action)

- Gigi Young lecture analysed through D/I/R lens (transcript at `/mnt/user-data/uploads/text.txt`)
- D/I/R describes HOW consciousness operates, not WHAT it IS
- Framework is compass/amplifier, not substitute for inner work
- R-axis suppression in society maps to power structures wanting D/I dominance
- ChatGPT reflects this — trained on D/I dominant corpus, struggles with R
- Steiner's warning about materialist R-suppression discussed but held lightly

---

## Token Universe Expansion (DEFERRED)

After strategy is proven, expand to volatile mid-caps for bigger oscillations:
- DOGE, XRP, AVAX, LINK, SUI, DOT, NEAR
- Smaller capital benefits from mid-cap volatility
- Freqtrade community strategies researched (RSI-based, EMA crossover, Bollinger bounce)

---

## What To Do Next (Priority Order)

1. **Run HMM v4** — paste Atlas prompt, get results
2. **If v4 works (2022 drawdown < -50%):** iterate on returns, expand token universe
3. **If v4 fails:** HMM isn't finding meaningful states; consider simpler vol-threshold approach or Gemini redesign
4. **Freqtrade paper trading** once strategy is proven
5. **Project alignment sweep** — bring all Observer components in line with HMM evolution
6. **Vault documentation** — capture trading system evolution narrative

---

## Adam's State

End of massive multi-day session. Night shift finishing. Frustrated by repeated failures but energised by the HMM direction. Wants to keep pushing. Values speed and honesty over caution.

## Git State

All committed and pushed to `github:Kryax/observer-vault` master branch through v3.
