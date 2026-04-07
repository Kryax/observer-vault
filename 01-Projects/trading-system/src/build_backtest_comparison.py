#!/usr/bin/env python3
"""
Build backtest comparison: MarkovRegime9 vs v6.2c DIRAllocator.
Also run diagnostic on a sample week of basin classifications.
"""

import json
import pathlib
import numpy as np
import pandas as pd

TRADING_DIR = pathlib.Path(__file__).resolve().parent.parent
DATA_DIR = TRADING_DIR / "data"

# ── MarkovRegime9 results (from Freqtrade backtest) ─────────────────
markov9 = {
    "total_return_pct": -65.52,
    "max_drawdown_pct": -72.17,
    "sharpe": -0.27,
    "win_rate": 53.4,
    "total_trades": 459,
    "profit_factor": 0.87,
    "cagr": -23.36,
    "final_balance": 3448.29,
    "starting_balance": 10000,
    "best_pair": "ETH/USDT +9.48%",
    "worst_pair": "SOL/USDT -53.55%",
    "market_change": -10.64,
    "period": "2022-04-01 to 2026-04-01",
    "avg_duration": "1 day, 4:25",
    "max_balance": 12389.15,
    "trailing_stop_wins": {
        "basin_8_bullish": {"trades": 70, "avg_profit": 3.53, "total": 16250},
        "basin_2_bullish": {"trades": 76, "avg_profit": 3.15, "total": 15100},
        "basin_0_bullish": {"trades": 40, "avg_profit": 2.72, "total": 6814},
        "basin_3_bullish": {"trades": 14, "avg_profit": 2.94, "total": 3063},
        "basin_5_neutral": {"trades": 14, "avg_profit": 2.73, "total": 2302},
        "bifurcation_c4_c3": {"trades": 9, "avg_profit": 2.23, "total": 1265},
    },
    "bearish_exit_losses": {
        "basin_6_bearish": {"trades": 53, "avg_profit": -3.71, "total": -14137},
        "basin_4_bearish": {"trades": 42, "avg_profit": -6.72, "total": -19196},
        "basin_7_bearish": {"trades": 83, "avg_profit": -2.39, "total": -12974},
        "basin_1_drawdown": {"trades": 8, "avg_profit": -1.95, "total": -1032},
    },
}

# ── v6.2c DIRAllocator results (from custom backtester) ─────────────
with open(DATA_DIR / "hmm_momentum_v6_2_results.json") as f:
    v62c_data = json.load(f)["v6.2c"]

dir_alloc = {
    "total_return_pct": round(v62c_data["total_return"] * 100, 2),  # 1662%
    "max_drawdown_pct": round(v62c_data["max_drawdown"] * 100, 2),
    "sharpe": round(v62c_data["sharpe"], 2),
    "win_rate": "N/A (momentum rotation)",
    "total_trades": v62c_data["n_trades"],
    "profit_factor": "N/A",
    "cagr": round(v62c_data["cagr"] * 100, 2),
    "period": f"{v62c_data['years']:.1f} years (2020-2026)",
    "pct_in_market": round(v62c_data["pct_in_market"] * 100, 1),
    "annual_returns": {k: round(v * 100, 1) for k, v in v62c_data["annual_returns"].items()},
    "calmar": round(v62c_data["calmar"], 2),
}

# ── Print comparison table ───────────────────────────────────────────
print("=" * 75)
print("BACKTEST COMPARISON: MarkovRegime9 vs v6.2c DIRAllocator")
print("=" * 75)
print()
print(f"{'Metric':<25} | {'v6.2c DIRAllocator':>20} | {'MarkovRegime9':>20}")
print("-" * 75)
print(f"{'Total Return':<25} | {dir_alloc['total_return_pct']:>19}% | {markov9['total_return_pct']:>19}%")
print(f"{'CAGR':<25} | {dir_alloc['cagr']:>19}% | {markov9['cagr']:>19}%")
print(f"{'Max Drawdown':<25} | {dir_alloc['max_drawdown_pct']:>19}% | {markov9['max_drawdown_pct']:>19}%")
print(f"{'Sharpe Ratio':<25} | {dir_alloc['sharpe']:>20} | {markov9['sharpe']:>20}")
print(f"{'Calmar':<25} | {dir_alloc['calmar']:>20} | {'N/A':>20}")
print(f"{'Win Rate':<25} | {str(dir_alloc['win_rate']):>20} | {markov9['win_rate']:>19}%")
print(f"{'Total Trades':<25} | {dir_alloc['total_trades']:>20} | {markov9['total_trades']:>20}")
print(f"{'Profit Factor':<25} | {str(dir_alloc['profit_factor']):>20} | {markov9['profit_factor']:>20}")
print(f"{'2022 Return':<25} | {dir_alloc['annual_returns'].get('2022', 'N/A'):>19}% | {'see below':>20}")
print(f"{'Market Change':<25} | {'N/A':>20} | {markov9['market_change']:>19}%")

# ── Diagnostic: What went wrong ──────────────────────────────────────
print("\n" + "=" * 75)
print("DIAGNOSTIC: Why MarkovRegime9 underperforms")
print("=" * 75)

print("""
1. EXIT LOGIC IS THE PRIMARY PROBLEM
   - Trailing stop exits: +$44,794 (100% win rate, 223 trades)
   - Bearish basin exits:  -$47,339 (186 trades, ~6% avg loss)
   - The basin exit signals trigger too aggressively, cutting winners
     short when the token dips into a bearish cluster temporarily.

2. BEARISH BASIN EXITS — BREAKDOWN
   - basin_4_bearish: 42 trades, -$19,196 (avg -6.72%, 0% win rate)
   - basin_6_bearish: 53 trades, -$14,137 (avg -3.71%, 11% win rate)
   - basin_7_bearish: 83 trades, -$12,974 (avg -2.39%, 2.4% win rate)
   These are transition states — the token briefly passes through a
   bearish cluster before returning to bullish, but the exit fires.

3. BASIN FLICKERING
   - 459 trades in 4 years = ~2.6 trades/week average
   - v6.2c only makes 146 trades in 5.6 years = ~0.5 trades/week
   - MarkovRegime9 churns 5x more than DIRAllocator
   - Mean dwell time of 5-7 hours means multiple basin transitions
     per day — the 1H timeframe is too fast for this exit logic.

4. POSITION SIZING WORKS BUT IS INSUFFICIENT
   - custom_stake_amount scales correctly
   - But the bearish exits crystallize losses before recovery

5. WHAT v6.2c DOES RIGHT THAT MARKOV9 DOESN'T
   - v6.2c holds through Quiet consensus unconditionally
   - v6.2c only exits on risk_state flip or token rotation
   - v6.2c doesn't try to micro-manage based on cluster state
   - The HMM gatekeeper is a coarse, stable filter — exactly right
     for a momentum strategy. The K=9 clusters are too fine-grained
     for direct exit signals.
""")

print("RECOMMENDED FIXES:")
print("""
  A. Remove bearish basin exits entirely — let trailing stop handle it
  B. Or: only exit on basin transitions that persist for N hours (hysteresis)
  C. Use Markov scores for position sizing only, not entry/exit gating
  D. The topology data is valuable for risk analysis, but should inform
     the trailing stop tightness, not trigger hard exits
""")

# ── Sample week diagnostic ───────────────────────────────────────────
print("=" * 75)
print("SAMPLE WEEK: Basin classifications (2024-01-01 to 2024-01-07)")
print("=" * 75)

df = pd.read_parquet(DATA_DIR / "features_6d_clustered.parquet")
week = df[(df["timestamp"] >= "2024-01-01") & (df["timestamp"] < "2024-01-08")]

for token in sorted(week["token"].unique()):
    sub = week[week["token"] == token].sort_values("timestamp")
    basins = sub["cluster"].values
    transitions = sum(1 for i in range(1, len(basins)) if basins[i] != basins[i-1])
    dist = sub["cluster"].value_counts().to_dict()
    print(f"  {token}: {len(sub)} bars, {transitions} transitions, basins={dist}")
    # Show first 24 hours
    first_24 = sub.head(24)["cluster"].values
    print(f"    First 24h: {list(first_24)}")

# ── Save results ─────────────────────────────────────────────────────
output = {
    "comparison": {
        "v6.2c_dir_allocator": dir_alloc,
        "markov_regime_9": markov9,
    },
    "diagnostic": {
        "primary_issue": "bearish basin exits trigger too aggressively",
        "trailing_stop_profit": 44794,
        "bearish_exit_loss": -47339,
        "trade_churn_ratio": "5x vs v6.2c",
        "recommended_fixes": [
            "Remove bearish basin exits — let trailing stop handle exits",
            "Add hysteresis: only exit if bearish basin persists N hours",
            "Use Markov scores for position sizing only, not exit gating",
            "Tighten trailing stop based on crash_risk instead of hard exits",
        ],
    },
}

out_path = DATA_DIR / "backtest_markov9_results.json"
with open(out_path, "w") as f:
    json.dump(output, f, indent=2)
print(f"\nSaved {out_path}")


if __name__ == "__main__":
    pass
