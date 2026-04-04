# Atlas Prompt — Enneagram Narrative Sequence Test + Extended BTC Analysis

## Two parallel tasks. Use sub-agents.

### Task 1: Non-Equilibrium Enneagram Test

The 9×9 transition matrix from the equilibrium Pile data is nearly symmetric (max ratio 1.22×), which falsifies the strict Enneagram mapping. BUT — Gemini proposed that the Enneagram describes NON-equilibrium dynamics (directed trajectories through the landscape), not the static topology.

Test this by extracting NARRATIVE SEQUENCES from the shard data and computing their directed transition matrices.

Steps:
1. Read the enriched shard databases (00-09) at `/home/adam/dataset-processor/output/`
2. For each record, check if it has temporal/narrative markers — look for records where the `temporal_structure` or `process_richness` Tier B scores are high, OR where the text contains sequential markers ("first...then...finally", "began...led to...resulted in", "phase 1...phase 2...phase 3")
3. Extract ONLY these narrative-sequence records
4. Compute a 9×9 DIRECTED transition matrix from these sequences only
5. Check: does the asymmetry ratio increase? (Should be significantly > 1.22× if narratives have directional flow)
6. Check: do the dominant directed flows match ANY known Enneagram integration/disintegration pattern?
7. Compute the top 5 most asymmetric transitions — which compositions have the strongest directional preference in narrative contexts?

Save results to:
- `01-Projects/trading-system/data/narrative_transition_matrix.json`
- `01-Projects/trading-system/data/narrative_transition_analysis.json`
- `01-Projects/trading-system/data/narrative_vs_equilibrium_comparison.json`

### Task 2: Multi-Timeframe BTC Regime Analysis

We now have 8.5 years of BTC data (75,514 1h candles, 3,152 1d candles from 2017-08-17 to 2026-04-03).

Run the D/I/R regime classifier (same 12 features → 6D vector → K=3 pipeline from Phase A) on:
1. **Daily candles with 30-day window** — macro regime (monthly timescale)
2. **Daily candles with 7-day window** — meso regime (weekly timescale)  
3. **Hourly candles with 72h window** — micro regime (existing, but now across full 8.5 years)

For each timeframe:
- Fit K=3 centroids
- Label all candles with regime (D, I, R)
- Compute regime time distribution
- Compute transition matrix
- Produce regime-coloured price chart (save as PNG)

Then compute ALIGNMENT: for each hourly candle, check if all three timeframes agree (macro=D AND meso=D AND micro=D). Compute:
- % of time all three align on D (strongest bull signal)
- % of time all three align on I (strongest consolidation)
- % of time all three align on R (strongest defensive signal)
- Average return in the 24h following each alignment type

Save results to:
- `01-Projects/trading-system/data/btc_macro_regimes.json`
- `01-Projects/trading-system/data/btc_meso_regimes.json`
- `01-Projects/trading-system/data/btc_micro_regimes_full.json`
- `01-Projects/trading-system/data/btc_alignment_analysis.json`
- `01-Projects/trading-system/data/btc_macro_regime_chart.png`
- `01-Projects/trading-system/data/btc_alignment_chart.png`

The BTC data files are at:
- `01-Projects/trading-system/data/btc_1h_full.csv`
- `01-Projects/trading-system/data/btc_1d_full.csv`

The Phase A feature computation code is in `01-Projects/trading-system/src/`
