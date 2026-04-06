#!/usr/bin/env python3
"""
Tactical Overlay Pipeline: Dip-buying within confirmed D-regimes.

Reuses the SAME walk-forward classification from the regime allocator pipeline.
The macro regime classification is already computed — just pass it through.

Variants:
  T1: EMA pullback standard — buy at EMA - 0.5×ATR, sell at EMA + 1.0×ATR
  T2: EMA pullback tight   — buy at EMA - 0.3×ATR, sell at EMA + 0.5×ATR
  T3: EMA pullback wide    — buy at EMA - 1.0×ATR, sell at EMA + 1.5×ATR

Comparisons: buy-and-hold baseline + regime allocator v2 variant C (passive)
"""

from __future__ import annotations

import json
import sys
import warnings
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.features.indicators_fast import compute_all_features
from src.features.vectorizer import vectorize_pipeline
from src.classifier.price_landscape import PriceLandscape
from src.classifier.multi_timeframe import MultiTimeframeClassifier
from src.backtest.engine import BacktestEngine
from src.backtest.baselines import BuyAndHold
from src.strategy.regime_allocator import RegimeAllocator
from src.strategy.tactical_overlay import TacticalOverlay

DATA_DIR = PROJECT_ROOT / "data"
WINDOW = 168

TOKEN_FILES = {
    "BTC": DATA_DIR / "btc_ohlcv_1h_extended.csv",
    "ETH": DATA_DIR / "eth_ohlcv_1h.csv",
    "SOL": DATA_DIR / "sol_ohlcv_1h.csv",
    "BNB": DATA_DIR / "bnb_ohlcv_1h.csv",
    "ADA": DATA_DIR / "ada_ohlcv_1h.csv",
}

TACTICAL_VARIANTS = {
    "T1_standard": {
        "ema_period": 24,
        "entry_atr_mult": 0.5,
        "exit_atr_mult": 1.0,
        "stop_atr_mult": 2.0,
        "position_frac": 0.90,
        "persistence_bars": 72,
        "desc": "EMA pullback standard: entry 0.5×ATR, exit 1.0×ATR, stop 2.0×ATR",
    },
    "T2_tight": {
        "ema_period": 24,
        "entry_atr_mult": 0.3,
        "exit_atr_mult": 0.5,
        "stop_atr_mult": 2.0,
        "position_frac": 0.90,
        "persistence_bars": 72,
        "desc": "EMA pullback tight: entry 0.3×ATR, exit 0.5×ATR, stop 2.0×ATR",
    },
    "T3_wide": {
        "ema_period": 24,
        "entry_atr_mult": 1.0,
        "exit_atr_mult": 1.5,
        "stop_atr_mult": 2.0,
        "position_frac": 0.90,
        "persistence_bars": 72,
        "desc": "EMA pullback wide: entry 1.0×ATR, exit 1.5×ATR, stop 2.0×ATR",
    },
}

# Passive allocator C for comparison
ALLOCATOR_C = {
    "d_allocation": 1.0, "i_allocation": 0.5, "r_allocation": 0.0,
    "rebalance_mode": "hourly", "persistence_bars": 72,
}


# ============================================================================
# Data loading + features (shared with allocator pipeline)
# ============================================================================

def load_token_data(symbol: str, filepath: Path) -> pd.DataFrame:
    df = pd.read_csv(filepath, parse_dates=["timestamp"], index_col="timestamp")
    df = df[~df.index.duplicated(keep="first")].sort_index()
    return df


def compute_vectors(df: pd.DataFrame, window: int = WINDOW) -> pd.DataFrame:
    features = compute_all_features(df, window)
    vectors = vectorize_pipeline(features)
    return vectors.dropna()


# ============================================================================
# Walk-forward classification (same as allocator pipeline)
# ============================================================================

def walk_forward_classify(
    data: pd.DataFrame,
    vectors: pd.DataFrame,
    mtf: MultiTimeframeClassifier,
    train_bars: int = 2000,
    step_bars: int = 500,
) -> pd.DataFrame:
    n = len(data)
    if n < train_bars + step_bars:
        train_bars = int(n * 0.6)
        step_bars = n - train_bars

    all_clf = []
    all_macro = []

    start = 0
    while start + train_bars < n:
        train_end = start + train_bars
        test_end = min(train_end + step_bars, n)

        train_data = data.iloc[start:train_end]
        test_data = data.iloc[train_end:test_end]
        train_vecs = vectors.loc[vectors.index.isin(train_data.index)]
        test_vecs = vectors.loc[vectors.index.isin(test_data.index)]

        if len(train_vecs) < 200 or len(test_vecs) < 10:
            start += step_bars
            continue

        ls = PriceLandscape()
        ls.fit(train_vecs.values, k=3)

        X = test_vecs.values
        results = []
        for i in range(len(X)):
            vec = X[i]
            er = ls._compute_energy(vec)
            cls = ls.classify(vec)
            regime = ls.get_regime_for_label(er["nearest_basin"])
            results.append({"regime": regime, "confidence": cls["confidence"]})

        clf_df = pd.DataFrame(results, index=test_vecs.index)
        all_clf.append(clf_df)

        macro = mtf.compute_macro_regimes(data, start, train_end, test_end)
        all_macro.append(macro)

        start += step_bars

    if not all_clf:
        return pd.DataFrame(columns=["regime", "confidence", "macro_regime"])

    combined = pd.concat(all_clf)
    combined = combined[~combined.index.duplicated(keep="first")].sort_index()
    combined = combined.reindex(data.index).ffill()

    macro_combined = pd.concat(all_macro)
    macro_combined = macro_combined[~macro_combined.index.duplicated(keep="first")].sort_index()
    combined["macro_regime"] = macro_combined.reindex(data.index, method="ffill")
    combined["macro_regime"] = combined["macro_regime"].fillna("I")

    return combined


# ============================================================================
# Run tactical variant
# ============================================================================

def run_tactical(
    data: pd.DataFrame,
    clf: pd.DataFrame,
    variant_key: str,
    variant_cfg: dict,
) -> dict:
    """Run a tactical overlay backtest on pre-classified data."""
    enriched = data.copy()
    for col in clf.columns:
        enriched[col] = clf[col]
    enriched = enriched.ffill().fillna(0)

    first_valid = clf["regime"].first_valid_index()
    if first_valid is not None:
        enriched = enriched.loc[first_valid:]

    strat = TacticalOverlay(
        persistence_bars=variant_cfg["persistence_bars"],
        ema_period=variant_cfg["ema_period"],
        entry_atr_mult=variant_cfg["entry_atr_mult"],
        exit_atr_mult=variant_cfg["exit_atr_mult"],
        stop_atr_mult=variant_cfg["stop_atr_mult"],
        position_frac=variant_cfg["position_frac"],
        warmup_bars=100,
    )
    strat.set_variant_name(f"Tactical-{variant_key}")

    engine = BacktestEngine(initial_capital=10_000)
    result = engine.run(strat, enriched)
    m = result.metrics

    # CAGR
    hours = (result.equity_curve.index[-1] - result.equity_curve.index[0]).total_seconds() / 3600
    years = hours / 8760 if hours > 0 else 1
    if years > 0 and m["final_capital"] > 0:
        cagr = (m["final_capital"] / m["initial_capital"]) ** (1 / years) - 1
    else:
        cagr = 0.0
    calmar = abs(cagr / m["max_drawdown"]) if m["max_drawdown"] < -0.001 else 0.0

    # Time in market: approximate from trades
    total_bars = len(enriched)
    bars_in_market = 0
    for t in result.trades:
        if t.entry_time is not None and t.exit_time is not None:
            entry_idx = enriched.index.get_indexer([t.entry_time], method="nearest")[0]
            exit_idx = enriched.index.get_indexer([t.exit_time], method="nearest")[0]
            bars_in_market += max(0, exit_idx - entry_idx)
    time_in_market = bars_in_market / total_bars if total_bars > 0 else 0

    # Average trades per D-regime period
    d_periods = _count_d_periods(enriched, strat)

    # Per-trade stats
    trade_pnls = [t.pnl_pct for t in result.trades if t.exit_time is not None]
    avg_trade_pct = np.mean(trade_pnls) if trade_pnls else 0.0
    median_trade_pct = np.median(trade_pnls) if trade_pnls else 0.0

    # Annual returns
    annual = _compute_annual_returns(result.equity_curve)

    m.update({
        "cagr": float(cagr),
        "calmar_ratio": float(calmar),
        "years": float(years),
        "time_in_market": float(time_in_market),
        "avg_trade_pct": float(avg_trade_pct),
        "median_trade_pct": float(median_trade_pct),
        "d_regime_periods": d_periods,
        "avg_trades_per_d_period": m["n_trades"] / d_periods if d_periods > 0 else 0,
    })

    return {
        "variant": variant_key,
        "metrics": m,
        "transitions": _analyze_transitions(strat.transition_log, len(enriched)),
        "annual_returns": annual,
    }


def _count_d_periods(enriched: pd.DataFrame, strat: TacticalOverlay) -> int:
    """Count distinct D-regime periods from transition log."""
    count = 0
    for t in strat.transition_log:
        if t["to"] == "D":
            count += 1
    # If we started in D, count that too
    if strat.transition_log and strat.transition_log[0].get("from") == "D":
        count += 1
    return max(count, 1)


def _compute_annual_returns(equity: pd.Series) -> dict:
    """Compute return for each calendar year."""
    annual = {}
    years = sorted(set(equity.index.year))
    for year in years:
        mask = equity.index.year == year
        year_eq = equity[mask]
        if len(year_eq) < 2:
            continue
        ret = (year_eq.iloc[-1] / year_eq.iloc[0]) - 1
        annual[str(year)] = float(ret)
    return annual


def _analyze_transitions(transition_log: list[dict], total_bars: int) -> dict:
    n = len(transition_log)
    if n < 2:
        return {"total_transitions": n, "avg_days_between": 0}

    gaps = [transition_log[i]["idx"] - transition_log[i - 1]["idx"]
            for i in range(1, n)]
    avg_days = np.mean(gaps) / 24 if gaps else 0

    longest = {"D": 0, "I": 0, "R": 0}
    for i in range(len(transition_log)):
        regime = transition_log[i]["to"]
        if i + 1 < len(transition_log):
            stretch = transition_log[i + 1]["idx"] - transition_log[i]["idx"]
        else:
            stretch = total_bars - transition_log[i]["idx"]
        if regime in longest and stretch > longest[regime]:
            longest[regime] = stretch

    return {
        "total_transitions": n,
        "avg_days_between": float(avg_days),
        "longest_D_days": longest["D"] / 24,
        "longest_I_days": longest["I"] / 24,
        "longest_R_days": longest["R"] / 24,
    }


# ============================================================================
# Run passive allocator C for comparison
# ============================================================================

def run_allocator_c(data: pd.DataFrame, clf: pd.DataFrame) -> dict:
    """Run regime allocator variant C (passive) for comparison."""
    enriched = data.copy()
    for col in clf.columns:
        enriched[col] = clf[col]
    enriched = enriched.ffill().fillna(0)

    first_valid = clf["regime"].first_valid_index()
    if first_valid is not None:
        enriched = enriched.loc[first_valid:]

    strat = RegimeAllocator(
        d_allocation=1.0, i_allocation=0.5, r_allocation=0.0,
        rebalance_mode="hourly", persistence_bars=72,
        warmup_bars=50,
    )
    strat.set_variant_name("Allocator-C_persist72")

    engine = BacktestEngine(initial_capital=10_000)
    result = engine.run(strat, enriched)
    m = result.metrics

    hours = (result.equity_curve.index[-1] - result.equity_curve.index[0]).total_seconds() / 3600
    years = hours / 8760 if hours > 0 else 1
    if years > 0 and m["final_capital"] > 0:
        cagr = (m["final_capital"] / m["initial_capital"]) ** (1 / years) - 1
    else:
        cagr = 0.0
    calmar = abs(cagr / m["max_drawdown"]) if m["max_drawdown"] < -0.001 else 0.0

    annual = _compute_annual_returns(result.equity_curve)

    m.update({
        "cagr": float(cagr),
        "calmar_ratio": float(calmar),
        "years": float(years),
    })

    return {"metrics": m, "annual_returns": annual}


def run_baseline(data: pd.DataFrame) -> dict:
    engine = BacktestEngine(initial_capital=10_000)
    strat = BuyAndHold()
    strat.precompute(data)
    result = engine.run(strat, data)
    m = result.metrics

    hours = (result.equity_curve.index[-1] - result.equity_curve.index[0]).total_seconds() / 3600
    years = hours / 8760 if hours > 0 else 1
    if years > 0 and m["final_capital"] > 0:
        cagr = (m["final_capital"] / m["initial_capital"]) ** (1 / years) - 1
    else:
        cagr = 0.0
    calmar = abs(cagr / m["max_drawdown"]) if m["max_drawdown"] < -0.001 else 0.0

    annual = _compute_annual_returns(result.equity_curve)

    m.update({
        "cagr": float(cagr),
        "calmar_ratio": float(calmar),
        "years": float(years),
        "time_in_market": 1.0,
    })
    return {"metrics": m, "annual_returns": annual}


# ============================================================================
# Main
# ============================================================================

def main():
    print("=" * 90)
    print("TACTICAL OVERLAY: DIP-BUYING WITHIN CONFIRMED D-REGIMES")
    print(f"  Macro layer: 72-bar persistence regime filter (walk-forward)")
    print(f"  Tactical layer: EMA pullback entry, ATR-based exit/stop")
    print(f"  Tokens: {list(TOKEN_FILES.keys())}")
    print(f"  Variants: {list(TACTICAL_VARIANTS.keys())}")
    print("=" * 90, flush=True)

    # Load data + compute features
    all_data = {}
    all_vectors = {}
    all_mtf = {}

    for symbol, filepath in TOKEN_FILES.items():
        print(f"\nLoading {symbol}...", end=" ", flush=True)
        df = load_token_data(symbol, filepath)
        all_data[symbol] = df
        print(f"{len(df)} bars", end=" ", flush=True)

        vecs = compute_vectors(df, window=WINDOW)
        all_vectors[symbol] = vecs
        print(f"-> {len(vecs)} vectors", end=" ", flush=True)

        mtf = MultiTimeframeClassifier(macro_window=30, k=3)
        mtf.precompute(df)
        all_mtf[symbol] = mtf
        print("done", flush=True)

    # Walk-forward classify
    print("\n" + "-" * 90)
    print("WALK-FORWARD CLASSIFICATION")
    print("-" * 90)
    all_clf = {}
    for symbol in TOKEN_FILES:
        print(f"  {symbol}...", end=" ", flush=True)
        clf = walk_forward_classify(
            all_data[symbol], all_vectors[symbol], all_mtf[symbol],
        )
        all_clf[symbol] = clf

        h_valid = clf["regime"].dropna()
        h_dist = Counter(str(r) for r in h_valid)
        h_total = sum(h_dist.values())
        m_valid = clf["macro_regime"].dropna()
        m_dist = Counter(str(r) for r in m_valid)
        m_total = sum(m_dist.values())
        print(f"hourly: {_pct_dict(h_dist, h_total)}  "
              f"daily: {_pct_dict(m_dist, m_total)}", flush=True)

    # ========================================================================
    # Baselines
    # ========================================================================
    print("\n" + "-" * 90)
    print("BASELINES")
    print("-" * 90)

    baselines = {}
    allocator_c = {}

    for symbol in TOKEN_FILES:
        bh = run_baseline(all_data[symbol])
        baselines[symbol] = bh
        m = bh["metrics"]
        print(f"  {symbol} B&H:        return={m['total_return']:.1%}, "
              f"CAGR={m['cagr']:.1%}, maxDD={m['max_drawdown']:.1%}")

        ac = run_allocator_c(all_data[symbol], all_clf[symbol])
        allocator_c[symbol] = ac
        m2 = ac["metrics"]
        print(f"  {symbol} Alloc-C:    return={m2['total_return']:.1%}, "
              f"CAGR={m2['cagr']:.1%}, maxDD={m2['max_drawdown']:.1%}, "
              f"trades={m2['n_trades']}")

    # ========================================================================
    # Tactical variants
    # ========================================================================
    results = {}
    for vk, vcfg in TACTICAL_VARIANTS.items():
        print(f"\n{'=' * 90}")
        print(f"VARIANT {vk}: {vcfg['desc']}")
        print(f"{'=' * 90}", flush=True)
        results[vk] = {}

        for symbol in TOKEN_FILES:
            print(f"  {symbol}...", end=" ", flush=True)
            r = run_tactical(all_data[symbol], all_clf[symbol], vk, vcfg)
            m = r["metrics"]
            print(f"return={m['total_return']:.1%}, CAGR={m['cagr']:.1%}, "
                  f"sharpe={m['sharpe_ratio']:.2f}, maxDD={m['max_drawdown']:.1%}, "
                  f"trades={m['n_trades']}, win={m['win_rate']:.0%}, "
                  f"avg_trade={m['avg_trade_pct']:.2%}")
            results[vk][symbol] = r

    # ========================================================================
    # Summary table
    # ========================================================================
    print("\n" + "=" * 130)
    print("PERFORMANCE SUMMARY")
    print("=" * 130)
    header = (f"{'Strategy':<22} {'Token':<6} {'Return':>10} {'CAGR':>8} "
              f"{'Sharpe':>8} {'MaxDD':>8} {'Calmar':>8} {'Trades':>7} "
              f"{'WinRate':>8} {'AvgTrade':>9} {'TimeInMkt':>10}")
    print(header)
    print("-" * 130)

    # Buy and hold
    for sym in TOKEN_FILES:
        m = baselines[sym]["metrics"]
        print(f"{'Buy&Hold':<22} {sym:<6} {m['total_return']:>9.1%} "
              f"{m['cagr']:>7.1%} {m['sharpe_ratio']:>7.2f} "
              f"{m['max_drawdown']:>7.1%} {m['calmar_ratio']:>7.2f} "
              f"{'1':>7} {'—':>8} {'—':>9} {'100%':>10}")
    print("-" * 130)

    # Allocator C
    for sym in TOKEN_FILES:
        m = allocator_c[sym]["metrics"]
        print(f"{'Allocator-C':<22} {sym:<6} {m['total_return']:>9.1%} "
              f"{m['cagr']:>7.1%} {m['sharpe_ratio']:>7.2f} "
              f"{m['max_drawdown']:>7.1%} {m['calmar_ratio']:>7.2f} "
              f"{m['n_trades']:>7} {m['win_rate']:>7.0%} "
              f"{'—':>9} {'—':>10}")
    print("-" * 130)

    # Tactical variants
    for vk in TACTICAL_VARIANTS:
        for sym in TOKEN_FILES:
            m = results[vk][sym]["metrics"]
            print(f"{vk:<22} {sym:<6} {m['total_return']:>9.1%} "
                  f"{m['cagr']:>7.1%} {m['sharpe_ratio']:>7.2f} "
                  f"{m['max_drawdown']:>7.1%} {m['calmar_ratio']:>7.2f} "
                  f"{m['n_trades']:>7} {m['win_rate']:>7.0%} "
                  f"{m['avg_trade_pct']:>8.2%} "
                  f"{m['time_in_market']:>9.0%}")
        print("-" * 130)

    # ========================================================================
    # Annual returns breakdown
    # ========================================================================
    print("\n" + "=" * 130)
    print("ANNUAL RETURNS BREAKDOWN")
    print("=" * 130)

    # Collect all years
    all_years = set()
    for sym in TOKEN_FILES:
        all_years |= set(baselines[sym]["annual_returns"].keys())
        for vk in TACTICAL_VARIANTS:
            all_years |= set(results[vk][sym]["annual_returns"].keys())
    all_years = sorted(all_years)

    for sym in TOKEN_FILES:
        print(f"\n  {sym}:")
        yr_header = f"    {'Strategy':<22}" + "".join(f"{y:>10}" for y in all_years)
        print(yr_header)
        print("    " + "-" * (22 + 10 * len(all_years)))

        # B&H
        row = f"    {'Buy&Hold':<22}"
        for y in all_years:
            v = baselines[sym]["annual_returns"].get(y, None)
            row += f"{v:>9.1%} " if v is not None else f"{'—':>10}"
        print(row)

        # Allocator C
        row = f"    {'Allocator-C':<22}"
        for y in all_years:
            v = allocator_c[sym]["annual_returns"].get(y, None)
            row += f"{v:>9.1%} " if v is not None else f"{'—':>10}"
        print(row)

        # Tactical
        for vk in TACTICAL_VARIANTS:
            row = f"    {vk:<22}"
            for y in all_years:
                v = results[vk][sym]["annual_returns"].get(y, None)
                row += f"{v:>9.1%} " if v is not None else f"{'—':>10}"
            print(row)

    # ========================================================================
    # Trade activity per D-regime
    # ========================================================================
    print("\n" + "=" * 130)
    print("TRADE ACTIVITY")
    print("=" * 130)
    header3 = (f"{'Variant':<22} {'Token':<6} {'Trades':>8} {'D-Periods':>10} "
               f"{'Trades/D':>10} {'AvgTrade%':>10} {'MedianTrade%':>13}")
    print(header3)
    print("-" * 130)

    for vk in TACTICAL_VARIANTS:
        for sym in TOKEN_FILES:
            m = results[vk][sym]["metrics"]
            print(f"{vk:<22} {sym:<6} {m['n_trades']:>8} "
                  f"{m['d_regime_periods']:>10} "
                  f"{m['avg_trades_per_d_period']:>9.1f} "
                  f"{m['avg_trade_pct']:>9.2%} "
                  f"{m['median_trade_pct']:>12.2%}")
        print("-" * 130)

    # ========================================================================
    # Verdict
    # ========================================================================
    print("\n" + "=" * 130)
    print("VERDICT: TACTICAL vs PASSIVE vs BUY-AND-HOLD")
    print("=" * 130)

    for sym in TOKEN_FILES:
        bh_ret = baselines[sym]["metrics"]["total_return"]
        ac_ret = allocator_c[sym]["metrics"]["total_return"]
        bh_dd = baselines[sym]["metrics"]["max_drawdown"]

        best_vk = None
        best_ret = -999
        for vk in TACTICAL_VARIANTS:
            r = results[vk][sym]["metrics"]["total_return"]
            if r > best_ret:
                best_ret = r
                best_vk = vk

        if best_vk is None:
            best_vk = list(TACTICAL_VARIANTS.keys())[0]
        tm = results[best_vk][sym]["metrics"]

        print(f"\n  {sym}:")
        print(f"    Buy-and-hold:    {bh_ret:>10.1%} return, {bh_dd:.1%} DD")
        print(f"    Allocator-C:     {ac_ret:>10.1%} return, "
              f"{allocator_c[sym]['metrics']['max_drawdown']:.1%} DD, "
              f"{allocator_c[sym]['metrics']['n_trades']} trades")
        print(f"    Best tactical:   {best_vk}")
        print(f"      Return:        {tm['total_return']:>10.1%}")
        print(f"      CAGR:          {tm['cagr']:>10.1%}")
        print(f"      MaxDD:         {tm['max_drawdown']:>10.1%}")
        print(f"      Trades:        {tm['n_trades']:>10}")
        print(f"      Win rate:      {tm['win_rate']:>10.0%}")
        print(f"      Avg trade:     {tm['avg_trade_pct']:>10.2%}")
        print(f"      Time in mkt:   {tm['time_in_market']:>10.0%}")

        # Did tactical beat both?
        if tm["total_return"] > bh_ret:
            print(f"      >> BEATS BUY-AND-HOLD by {tm['total_return'] - bh_ret:.1%}")
        else:
            print(f"      >> LAGS BUY-AND-HOLD by {bh_ret - tm['total_return']:.1%}")

        if tm["total_return"] > ac_ret:
            print(f"      >> BEATS ALLOCATOR-C by {tm['total_return'] - ac_ret:.1%}")
        else:
            print(f"      >> LAGS ALLOCATOR-C by {ac_ret - tm['total_return']:.1%}")

    # ========================================================================
    # Save results
    # ========================================================================
    output = {
        "run_date": datetime.now(timezone.utc).isoformat(),
        "architecture": "walk-forward classify -> tactical overlay (dip-buy in D-regimes)",
        "window": WINDOW,
        "baselines": {s: baselines[s] for s in TOKEN_FILES},
        "allocator_c": {s: allocator_c[s] for s in TOKEN_FILES},
        "tactical_variants": {},
    }
    for vk in TACTICAL_VARIANTS:
        output["tactical_variants"][vk] = {
            "config": {k: v for k, v in TACTICAL_VARIANTS[vk].items() if k != "desc"},
            "description": TACTICAL_VARIANTS[vk]["desc"],
            "results": {
                sym: {
                    "metrics": results[vk][sym]["metrics"],
                    "transitions": results[vk][sym]["transitions"],
                    "annual_returns": results[vk][sym]["annual_returns"],
                }
                for sym in TOKEN_FILES
            },
        }

    output_path = DATA_DIR / "tactical_overlay_results.json"
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2, default=str)
    print(f"\nResults saved to {output_path}")


def _pct_dict(counter: Counter, total: int) -> str:
    return " ".join(f"{k}={v/total:.0%}" for k, v in sorted(counter.items()))


if __name__ == "__main__":
    main()
