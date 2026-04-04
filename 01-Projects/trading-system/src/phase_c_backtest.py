#!/usr/bin/env python3
"""
Phase C: Freqtrade-style Backtest — DIR Regime Strategy vs Baselines

Steps:
  C1: Load OHLCV + regime labels + confidence, merge into single DataFrame
  C2: Split into train (first 9 months) and test (last 3 months)
  C3: Run DIR strategy and all baselines on both periods
  C4: Compute metrics, compare Sharpe ratios
  C5: Evaluate ISC gates
  C6: Generate equity curve chart
  C7: Save results to data/phase_c_results.json

Usage:
    python src/phase_c_backtest.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.backtest.engine import BacktestEngine, BacktestResult
from src.strategy.dir_regime import DIRRegimeStrategy
from src.backtest.baselines import BuyAndHold, MACrossover, StaticTrendFollow, StaticMeanRevert

DATA_DIR = PROJECT_ROOT / "data"

# Train/test split: 9 months train, 3 months test
# Data: 2025-04-03 to 2026-04-03
TRAIN_END = "2026-01-03"  # first 9 months
TEST_START = "2026-01-03"  # last 3 months


def load_data() -> pd.DataFrame:
    """Load and merge OHLCV + regime labels + confidence."""
    ohlcv = pd.read_csv(DATA_DIR / "btc_1h_ohlcv.csv", index_col="timestamp", parse_dates=True)
    ohlcv = ohlcv.astype(float)

    labels = pd.read_csv(DATA_DIR / "btc_regime_labels.csv", index_col="timestamp", parse_dates=True)
    conf = pd.read_csv(DATA_DIR / "btc_confidence_entropy.csv", index_col="timestamp", parse_dates=True)

    # Merge on index (timestamp)
    merged = ohlcv.join(labels[["regime"]], how="inner")
    merged = merged.join(conf[["confidence", "entropy"]], how="inner")

    print(f"[DATA] Merged dataset: {len(merged)} bars "
          f"({merged.index[0]} to {merged.index[-1]})")
    print(f"[DATA] Regime distribution: {merged['regime'].value_counts().to_dict()}")
    return merged


def split_data(data: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Split into train and test periods."""
    train = data[data.index < TRAIN_END].copy()
    test = data[data.index >= TEST_START].copy()
    print(f"[SPLIT] Train: {len(train)} bars ({train.index[0]} to {train.index[-1]})")
    print(f"[SPLIT] Test:  {len(test)} bars ({test.index[0]} to {test.index[-1]})")
    return train, test


def run_strategy(engine: BacktestEngine, strategy, data: pd.DataFrame, label: str) -> BacktestResult:
    """Run a single strategy and print summary."""
    if hasattr(strategy, "precompute"):
        strategy.precompute(data)
    result = engine.run(strategy, data)
    m = result.metrics
    print(f"  [{label}] {result.strategy_name:25s} | "
          f"Sharpe={m['sharpe_ratio']:+.3f}  "
          f"Return={m['total_return']*100:+.1f}%  "
          f"MaxDD={m['max_drawdown']*100:.1f}%  "
          f"Trades={m['n_trades']:3d}  "
          f"WinRate={m['win_rate']*100:.0f}%")
    return result


def compute_regime_win_rates(result: BacktestResult) -> dict[str, float]:
    """Compute win rate broken down by regime at entry."""
    regime_trades: dict[str, list] = {"D": [], "I": [], "R": []}
    for t in result.trades:
        r = t.regime_at_entry
        if r in regime_trades:
            regime_trades[r].append(t.pnl > 0)

    rates = {}
    for r in ["D", "I", "R"]:
        trades = regime_trades[r]
        if trades:
            rates[r] = sum(trades) / len(trades)
        else:
            rates[r] = 0.0
    return rates


def compute_confidence_position_correlation(result: BacktestResult) -> float:
    """Check that higher confidence -> larger positions (ISC-C7)."""
    if len(result.trades) < 5:
        return 0.0
    confidences = [t.confidence_at_entry for t in result.trades]
    sizes = [t.size_usd for t in result.trades]
    if np.std(confidences) < 1e-10 or np.std(sizes) < 1e-10:
        return 0.0
    corr = np.corrcoef(confidences, sizes)[0, 1]
    return float(corr) if np.isfinite(corr) else 0.0


def plot_equity_curves(results: dict[str, BacktestResult], period: str,
                       output_path: Path) -> None:
    """Plot equity curves for all strategies."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import matplotlib.dates as mdates

    fig, ax = plt.subplots(1, 1, figsize=(16, 8))

    colors = {
        "DIR-Regime": "#e74c3c",
        "Buy-and-Hold": "#2c3e50",
        "MA-Crossover-50/200": "#3498db",
        "Static-Trend-Follow": "#f39c12",
        "Static-Mean-Revert": "#27ae60",
    }

    for name, result in results.items():
        color = colors.get(name, "#7f8c8d")
        # Normalize to starting capital = 1.0
        normalized = result.equity_curve / result.equity_curve.iloc[0]
        ax.plot(normalized.index, normalized.values, label=name,
                color=color, linewidth=2.0 if name == "DIR-Regime" else 1.2,
                alpha=1.0 if name == "DIR-Regime" else 0.7)

    ax.set_ylabel("Normalized Equity", fontsize=12)
    ax.set_xlabel("Date", fontsize=12)
    ax.set_title(f"Phase C Backtest — Equity Curves ({period})", fontsize=14, fontweight="bold")
    ax.legend(loc="best", fontsize=10)
    ax.grid(True, alpha=0.3)
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%m-%d"))
    ax.xaxis.set_major_locator(mdates.MonthLocator())
    plt.xticks(rotation=30)

    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"[CHART] Equity curves saved to {output_path}")


def evaluate_isc(dir_test: BacktestResult, bh_test: BacktestResult,
                 all_test: dict[str, BacktestResult],
                 dir_train: BacktestResult,
                 regime_wr: dict[str, float],
                 conf_corr: float) -> dict:
    """Evaluate all ISC exit criteria for Phase C."""
    isc = {}

    # C1: Strategy runs without error (if we got here, it ran)
    isc["C1"] = True

    # C2: >= 50 trades over full backtest period
    total_trades_train = dir_train.metrics["n_trades"]
    total_trades_test = dir_test.metrics["n_trades"]
    total_trades = total_trades_train + total_trades_test
    isc["C2"] = total_trades >= 50

    # C3: Sharpe computed for all
    all_sharpes_finite = all(
        np.isfinite(r.metrics["sharpe_ratio"]) for r in all_test.values()
    )
    isc["C3"] = all_sharpes_finite

    # C4: DIR Sharpe > buy-and-hold Sharpe on OOS
    dir_sharpe = dir_test.metrics["sharpe_ratio"]
    bh_sharpe = bh_test.metrics["sharpe_ratio"]
    isc["C4"] = dir_sharpe > bh_sharpe

    # C5: Max drawdown (DIR) < max drawdown (buy-and-hold)
    dir_dd = abs(dir_test.metrics["max_drawdown"])
    bh_dd = abs(bh_test.metrics["max_drawdown"])
    isc["C5"] = dir_dd < bh_dd

    # C6: Win rate in D-regime > win rate in I-regime for trend-following trades
    isc["C6"] = regime_wr.get("D", 0) > regime_wr.get("I", 0)

    # C7: Position sizing scales with confidence
    isc["C7"] = conf_corr > 0

    # C8: Proper train/test split
    isc["C8"] = True  # Enforced by our split logic

    return isc


def run_phase_c() -> dict:
    """Execute Phase C and return results."""
    print("=" * 70)
    print("  PHASE C: DIR Regime Strategy Backtest")
    print("=" * 70)

    # Load and split data
    data = load_data()
    train, test = split_data(data)

    engine = BacktestEngine(initial_capital=10_000.0, commission_pct=0.001, slippage_pct=0.0005)

    # --- Run on TRAIN period ---
    print(f"\n{'='*70}")
    print(f"  TRAIN PERIOD ({train.index[0].date()} to {train.index[-1].date()})")
    print(f"{'='*70}")

    strategies_train = {
        "DIR-Regime": DIRRegimeStrategy(),
        "Buy-and-Hold": BuyAndHold(),
        "MA-Crossover-50/200": MACrossover(50, 200),
        "Static-Trend-Follow": StaticTrendFollow(),
        "Static-Mean-Revert": StaticMeanRevert(),
    }
    train_results = {}
    for sname, strat in strategies_train.items():
        train_results[sname] = run_strategy(engine, strat, train, "TRAIN")

    # --- Run on TEST period (out-of-sample) ---
    print(f"\n{'='*70}")
    print(f"  TEST PERIOD — OUT-OF-SAMPLE ({test.index[0].date()} to {test.index[-1].date()})")
    print(f"{'='*70}")

    strategies_test = {
        "DIR-Regime": DIRRegimeStrategy(),
        "Buy-and-Hold": BuyAndHold(),
        "MA-Crossover-50/200": MACrossover(50, 200),
        "Static-Trend-Follow": StaticTrendFollow(),
        "Static-Mean-Revert": StaticMeanRevert(),
    }
    test_results = {}
    for sname, strat in strategies_test.items():
        test_results[sname] = run_strategy(engine, strat, test, "TEST ")

    # --- Analysis ---
    print(f"\n{'='*70}")
    print("  ANALYSIS")
    print(f"{'='*70}")

    dir_test = test_results["DIR-Regime"]
    bh_test = test_results["Buy-and-Hold"]

    # Regime win rates (from test period)
    regime_wr = compute_regime_win_rates(dir_test)
    print(f"\n[REGIME WIN RATES] (OOS)")
    for r in ["D", "I", "R"]:
        regime_trades = [t for t in dir_test.trades if t.regime_at_entry == r]
        print(f"  {r}: {regime_wr[r]*100:.0f}% ({len(regime_trades)} trades)")

    # Confidence-position correlation (from all DIR trades)
    all_dir_trades = train_results["DIR-Regime"].trades + dir_test.trades
    if len(all_dir_trades) > 5:
        confidences = [t.confidence_at_entry for t in all_dir_trades]
        sizes = [t.size_usd for t in all_dir_trades]
        conf_corr = float(np.corrcoef(confidences, sizes)[0, 1])
        if not np.isfinite(conf_corr):
            conf_corr = 0.0
    else:
        conf_corr = 0.0
    print(f"\n[CONFIDENCE-SIZE CORRELATION] r = {conf_corr:.3f}")

    # Best baseline Sharpe on OOS
    baseline_sharpes = {k: v.metrics["sharpe_ratio"] for k, v in test_results.items() if k != "DIR-Regime"}
    best_baseline_name = max(baseline_sharpes, key=baseline_sharpes.get)
    best_baseline_sharpe = baseline_sharpes[best_baseline_name]
    dir_sharpe = dir_test.metrics["sharpe_ratio"]

    print(f"\n[SHARPE COMPARISON — OOS]")
    print(f"  DIR-Regime:       {dir_sharpe:+.4f}")
    print(f"  Best baseline:    {best_baseline_sharpe:+.4f} ({best_baseline_name})")
    print(f"  DIR > baseline:   {'YES' if dir_sharpe > best_baseline_sharpe else 'NO'}")

    # --- ISC Evaluation ---
    print(f"\n{'='*70}")
    print("  PHASE C: ISC SUMMARY")
    print(f"{'='*70}")

    isc = evaluate_isc(
        dir_test=dir_test,
        bh_test=bh_test,
        all_test=test_results,
        dir_train=train_results["DIR-Regime"],
        regime_wr=regime_wr,
        conf_corr=conf_corr,
    )

    isc_labels = {
        "C1": "Strategy runs without error",
        "C2": f">=50 trades total ({train_results['DIR-Regime'].metrics['n_trades']}+{dir_test.metrics['n_trades']})",
        "C3": "Sharpe computed for all strategies",
        "C4": f"DIR Sharpe ({dir_sharpe:+.3f}) > BH Sharpe ({bh_test.metrics['sharpe_ratio']:+.3f}) on OOS",
        "C5": f"DIR MaxDD ({abs(dir_test.metrics['max_drawdown'])*100:.1f}%) < BH MaxDD ({abs(bh_test.metrics['max_drawdown'])*100:.1f}%)",
        "C6": f"D-regime WR ({regime_wr.get('D',0)*100:.0f}%) > I-regime WR ({regime_wr.get('I',0)*100:.0f}%)",
        "C7": f"Confidence-size correlation ({conf_corr:.3f}) > 0",
        "C8": "Train/test split: 9mo/3mo",
    }

    all_pass = True
    for key in sorted(isc_labels):
        status = isc.get(key, False)
        mark = "PASS" if status else "FAIL"
        if not status:
            all_pass = False
        print(f"  ISC-{key}: {mark} — {isc_labels[key]}")

    gate_decision = "PASS — proceed to Phase D" if all_pass else "CONDITIONAL — review failures"
    print(f"\n  GATE: {gate_decision}")

    # --- Charts ---
    try:
        plot_equity_curves(test_results, "Out-of-Sample", DATA_DIR / "phase_c_equity_oos.png")
        plot_equity_curves(train_results, "Train", DATA_DIR / "phase_c_equity_train.png")
    except Exception as e:
        print(f"[CHART] Warning: could not generate charts: {e}")

    # --- Save results ---
    results = {
        "phase": "C",
        "train_period": {"start": str(train.index[0]), "end": str(train.index[-1]), "bars": len(train)},
        "test_period": {"start": str(test.index[0]), "end": str(test.index[-1]), "bars": len(test)},
        "train_metrics": {k: v.metrics for k, v in train_results.items()},
        "test_metrics": {k: v.metrics for k, v in test_results.items()},
        "regime_win_rates_oos": regime_wr,
        "regime_trade_counts_oos": {
            r: len([t for t in dir_test.trades if t.regime_at_entry == r])
            for r in ["D", "I", "R"]
        },
        "confidence_size_correlation": conf_corr,
        "sharpe_comparison_oos": {
            "dir_sharpe": dir_sharpe,
            "best_baseline_name": best_baseline_name,
            "best_baseline_sharpe": best_baseline_sharpe,
            "dir_beats_best_baseline": dir_sharpe > best_baseline_sharpe,
        },
        "isc": isc,
        "gate": {
            "all_pass": all_pass,
            "decision": gate_decision,
        },
    }

    results_path = DATA_DIR / "phase_c_results.json"
    with open(results_path, "w") as f:
        json.dump(results, f, indent=2, default=str)
    print(f"\n[OUTPUT] Phase C results saved to {results_path}")

    return results


if __name__ == "__main__":
    run_phase_c()
