"""
Four-way comparison: v6.2c vs MarkovRegime9 v1 vs v2 vs v3.
Also prints v3-specific diagnostics: C3 blocks, basin win rates, sizing stats.
"""

import json
import math
import zipfile
from collections import deque
from pathlib import Path

import numpy as np
import pandas as pd

TRADING_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = TRADING_DIR / "data"
BT_DIR = TRADING_DIR / "freqtrade" / "user_data" / "backtest_results"

# K=9 params (v3)
FLICKER_WINDOW = 12
PERSISTENCE_THRESHOLD = 3
FLICKER_DECAY_RATE = 0.5
SIZING_FLOOR = 0.1
SIZING_CEILING = 1.0
C1_DRAWDOWN_CAP = 0.15
BULLISH_BASINS_V2 = {0, 2, 3, 8}
BULLISH_BASINS_V3 = {0, 2, 8}
BEARISH_BASINS = {1, 4, 6, 7}
BLACKLIST_BASINS = {3}
FORCE_FLAT_BASIN = 1
HEAT_PENALTY_RATE = 0.2
HEAT_PENALTY_FLOOR = 0.3
MOMENTUM_BONUS_RATE = 0.15
MOMENTUM_BONUS_CAP = 1.3

# Load topology
with open(DATA_DIR / "transition_matrix.json") as f:
    trans_data = json.load(f)
trans_matrix = np.zeros((9, 9))
for key, val in trans_data["probability_matrix"].items():
    i, j = key.split("->")
    trans_matrix[int(i), int(j)] = val

with open(DATA_DIR / "normalisation_params.json") as f:
    norm_data = json.load(f)
norm_params = norm_data["normalisation"]
feature_order = norm_data["feature_order"]
centroids_dict = norm_data["centroids"]
centroids = np.zeros((len(centroids_dict), len(feature_order)))
for cid_str, centroid in centroids_dict.items():
    for fi, feat in enumerate(feature_order):
        centroids[int(cid_str), fi] = centroid[feat]

FEAT_COLS = ["atr_z", "bbw_z", "rsi_z", "vwap_dist_z", "adx_z", "obv_z"]
BASKET = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "ADA/USDT"]


def pair_to_token(pair):
    return pair.replace("/", "_")


def compute_6d_features(df, pair):
    h, l, c, v = df["high"], df["low"], df["close"], df["volume"]
    tr = pd.concat([h - l, (h - c.shift(1)).abs(), (l - c.shift(1)).abs()], axis=1).max(axis=1)
    df["raw_atr"] = tr.rolling(14).mean()
    sma20 = c.rolling(20).mean()
    std20 = c.rolling(20).std()
    df["raw_bbw"] = ((sma20 + 2 * std20) - (sma20 - 2 * std20)) / sma20
    delta = c.diff()
    gain = delta.clip(lower=0).rolling(14).mean()
    loss = (-delta.clip(upper=0)).rolling(14).mean()
    rs = gain / loss.replace(0, np.nan)
    df["raw_rsi"] = 100 - (100 / (1 + rs))
    tp = (h + l + c) / 3
    vwap_24h = (tp * v).rolling(24, min_periods=1).sum() / v.rolling(24, min_periods=1).sum()
    df["raw_vwap_dist"] = (c - vwap_24h) / vwap_24h * 100
    plus_dm = h.diff()
    minus_dm = -l.diff()
    plus_dm = plus_dm.where((plus_dm > minus_dm) & (plus_dm > 0), 0.0)
    minus_dm = minus_dm.where((minus_dm > plus_dm) & (minus_dm > 0), 0.0)
    atr14 = tr.rolling(14).mean()
    plus_di = 100 * (plus_dm.rolling(14).mean() / atr14)
    minus_di = 100 * (minus_dm.rolling(14).mean() / atr14)
    dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, np.nan)
    df["raw_adx"] = dx.rolling(14).mean()
    df["raw_obv"] = (np.sign(c.diff()) * v).cumsum()

    token = pair_to_token(pair)
    if token in norm_params:
        params = norm_params[token]
        for raw, key, z in [("raw_atr", "atr", "atr_z"), ("raw_bbw", "bbw", "bbw_z"),
                            ("raw_rsi", "rsi", "rsi_z"), ("raw_vwap_dist", "vwap_dist", "vwap_dist_z"),
                            ("raw_adx", "adx", "adx_z"), ("raw_obv", "obv", "obv_z")]:
            m, s = params[key]["mean"], params[key]["std"]
            df[z] = (df[raw] - m) / s if s > 0 else 0.0
    return df


def classify_basins(df):
    basin = pd.Series(-1, index=df.index, dtype=int)
    valid = df[FEAT_COLS].notna().all(axis=1)
    if valid.sum() == 0:
        return basin
    X = df.loc[valid, FEAT_COLS].values
    dists = np.linalg.norm(X[:, np.newaxis, :] - centroids[np.newaxis, :, :], axis=2)
    basin.loc[valid] = np.argmin(dists, axis=1)
    return basin


def load_backtest(zip_name):
    zip_path = BT_DIR / zip_name
    with zipfile.ZipFile(zip_path) as z:
        json_name = [n for n in z.namelist() if n.endswith(".json") and not n.endswith("_config.json")][0]
        with z.open(json_name) as f:
            return json.load(f)


def main():
    # ── Load v3 results ─────────────────────────────────────────────
    v3_data = load_backtest("backtest-result-2026-04-07_12-50-43.zip")
    v3_strat_key = [k for k in v3_data["strategy"].keys() if k != "TOTAL"][0]
    v3 = v3_data["strategy"][v3_strat_key]
    v3_trades = v3["trades"]

    # ── Load v2 results ─────────────────────────────────────────────
    v2_data = load_backtest("backtest-result-2026-04-07_11-10-22.zip")
    v2_strat_key = [k for k in v2_data["strategy"].keys() if k != "TOTAL"][0]
    v2 = v2_data["strategy"][v2_strat_key]
    v2_trades = v2["trades"]

    # ── Load OHLCV and compute features for basin analysis ──────────
    pair_dfs = {}
    for pair in BASKET:
        token = pair_to_token(pair)
        path = DATA_DIR / f"{token}-1h.feather"
        if path.exists():
            df = pd.read_feather(path).sort_values("date").reset_index(drop=True)
            df["date"] = pd.to_datetime(df["date"], utc=True)
            df = compute_6d_features(df, pair)
            df["basin"] = classify_basins(df)
            pair_dfs[pair] = df

    # ── Annotate v2 and v3 trades with basin at entry ───────────────
    def annotate_trades(trades):
        for t in trades:
            pair = t["pair"]
            if pair not in pair_dfs:
                t["entry_basin"] = -1
                t["atr_z"] = 0.0
                t["rsi_z"] = 0.0
                continue
            df = pair_dfs[pair]
            open_ts = pd.Timestamp(t["open_timestamp"], unit="ms", tz="UTC")
            mask = df["date"] <= open_ts
            if mask.sum() == 0:
                t["entry_basin"] = -1
                t["atr_z"] = 0.0
                t["rsi_z"] = 0.0
                continue
            idx = df.loc[mask].index[-1]
            row = df.iloc[idx]
            t["entry_basin"] = int(row["basin"])
            t["atr_z"] = float(row["atr_z"]) if not np.isnan(row["atr_z"]) else 0.0
            t["rsi_z"] = float(row["rsi_z"]) if not np.isnan(row["rsi_z"]) else 0.0

    annotate_trades(v2_trades)
    annotate_trades(v3_trades)

    # ── Count C3 entries blocked ────────────────────────────────────
    v2_c3_entries = sum(1 for t in v2_trades if t["entry_basin"] == 3)
    v3_c3_entries = sum(1 for t in v3_trades if t["entry_basin"] == 3)
    c3_blocked = v2_c3_entries - v3_c3_entries

    # ── Compute v2 sizing scalar stats (from fingerprint data) ──────
    fp_path = DATA_DIR / "trade_fingerprints.json"
    if fp_path.exists():
        with open(fp_path) as f:
            fingerprints = json.load(f)
        v2_sizing_mean = np.mean([fp["sizing_scalar"] for fp in fingerprints])
    else:
        v2_sizing_mean = 0.358  # from fingerprint analysis

    # ── Compute v3 sizing scalars ───────────────────────────────────
    v3_scalars = []
    for t in v3_trades:
        # Base Markov sizing (same as v2 minus bifurcation bonus)
        basin = t["entry_basin"]
        if basin < 0:
            base_scalar = 1.0
        else:
            row = trans_matrix[basin]
            opp = sum(row[b] for b in BULLISH_BASINS_V3)
            crash = sum(row[b] for b in BEARISH_BASINS)
            total = opp + crash
            markov_conf = (opp / total) if total > 0 else 0.5
            base_scalar = max(SIZING_FLOOR, min(SIZING_CEILING, markov_conf))

        # Quiet grind filter
        atr_z = t["atr_z"]
        rsi_z = t["rsi_z"]
        heat_penalty = max(HEAT_PENALTY_FLOOR, 1.0 - HEAT_PENALTY_RATE * max(0, atr_z))
        momentum_bonus = min(MOMENTUM_BONUS_CAP, 1.0 + MOMENTUM_BONUS_RATE * max(0, rsi_z))
        kinematic = heat_penalty * momentum_bonus
        final = max(SIZING_FLOOR, min(SIZING_CEILING, base_scalar * kinematic))
        v3_scalars.append(final)

    v3_sizing_mean = np.mean(v3_scalars) if v3_scalars else 0

    # ── Four-way comparison ─────────────────────────────────────────
    # v6.2c and v1 from hardcoded historical results (different backtester/period)
    print("=" * 95)
    print("FOUR-WAY COMPARISON: v6.2c vs MarkovRegime9 v1 vs v2 vs v3")
    print("=" * 95)
    print()
    print(f"{'Metric':<25} | {'v6.2c (custom BT)':>18} | {'Markov v1 (FT)':>18} | {'Markov v2 (FT)':>18} | {'Markov v3 (FT)':>18}")
    print("-" * 95)

    v3_wr = len([t for t in v3_trades if t["profit_ratio"] > 0]) / len(v3_trades) * 100
    v3_pf = v3["exit_reason_summary"][0]["profit_factor"]
    v3_sharpe = v3["exit_reason_summary"][0]["sharpe"]
    v3_calmar = v3["exit_reason_summary"][0]["calmar"]
    v3_sortino = v3["exit_reason_summary"][0]["sortino"]
    v3_max_dd = v3["exit_reason_summary"][0]["max_drawdown_account"] * 100
    v3_return = v3["profit_total"] * 100
    v3_avg_stake = sum(t["stake_amount"] for t in v3_trades) / len(v3_trades)

    rows = [
        ("Total Return", "1662.3%", "-65.5%", "+30.1%", f"+{v3_return:.1f}%"),
        ("Max Drawdown", "-66.6%", "-72.2%", "-14.9%", f"-{v3_max_dd:.1f}%"),
        ("Sharpe Ratio", "0.68", "-0.27", "0.13", f"{v3_sharpe:.2f}"),
        ("Calmar", "0.99", "N/A", "2.65", f"{v3_calmar:.2f}"),
        ("Sortino", "N/A", "N/A", "0.21", f"{v3_sortino:.2f}"),
        ("Total Trades", "146", "459", "105", f"{len(v3_trades)}"),
        ("Win Rate", "N/A", "53.4%", "44.8%", f"{v3_wr:.1f}%"),
        ("Profit Factor", "N/A", "0.87", "1.50", f"{v3_pf:.2f}"),
        ("Avg Stake", "N/A", "$6,415", "$3,146", f"${v3_avg_stake:,.0f}"),
        ("Avg Duration", "N/A", "28h", "6d 11h", v3["exit_reason_summary"][0]["duration_avg"]),
        ("BTC Buy&Hold", "N/A", "+50.0%", "+50.0%", "+50.0%"),
    ]
    for label, v62c, v1, v2_val, v3_val in rows:
        print(f"{label:<25} | {v62c:>18} | {v1:>18} | {v2_val:>18} | {v3_val:>18}")

    # ── v3-specific diagnostics ─────────────────────────────────────
    print()
    print("=" * 95)
    print("v3-SPECIFIC DIAGNOSTICS")
    print("=" * 95)

    print(f"\n  C3 entries in v2: {v2_c3_entries}")
    print(f"  C3 entries in v3: {v3_c3_entries}  (blocked: {c3_blocked})")
    print(f"  Trades removed:  {len(v2_trades) - len(v3_trades)} (v2: {len(v2_trades)}, v3: {len(v3_trades)})")

    print(f"\n  Mean sizing scalar: v2 = {v2_sizing_mean:.3f}, v3 = {v3_sizing_mean:.3f}")

    # ── Basin win rates for v3 ──────────────────────────────────────
    print(f"\n  Basin win rates (v3):")
    print(f"  {'Basin':>6} | {'Wins':>5} | {'Losses':>6} | {'Total':>5} | {'WR':>6}")
    print(f"  " + "-" * 40)
    basin_stats_v3 = {}
    for b in range(9):
        basin_trades = [t for t in v3_trades if t["entry_basin"] == b]
        wins = sum(1 for t in basin_trades if t["profit_ratio"] > 0)
        losses = len(basin_trades) - wins
        total = len(basin_trades)
        wr = wins / total * 100 if total > 0 else 0
        basin_stats_v3[f"C{b}"] = {"wins": wins, "losses": losses, "total": total, "win_rate": round(wr, 1)}
        if total > 0:
            marker = " <-- BLOCKED" if b in BLACKLIST_BASINS else ""
            print(f"    C{b}  | {wins:>5} | {losses:>6} | {total:>5} | {wr:>5.1f}%{marker}")

    # ── v2 vs v3 trade-level diff ───────────────────────────────────
    print(f"\n  Trade-level impact:")
    v2_c3_trades = [t for t in v2_trades if t["entry_basin"] == 3]
    v2_c3_pnl = sum(t["profit_abs"] for t in v2_c3_trades)
    v2_c3_winners = sum(1 for t in v2_c3_trades if t["profit_ratio"] > 0)
    print(f"    v2 C3 trades: {len(v2_c3_trades)} (W:{v2_c3_winners} L:{len(v2_c3_trades)-v2_c3_winners}), P&L: ${v2_c3_pnl:.2f}")
    print(f"    Removing C3 saves: ${-v2_c3_pnl:.2f}" if v2_c3_pnl < 0 else f"    Removing C3 costs: ${v2_c3_pnl:.2f}")

    # ── KEY OBSERVATIONS ────────────────────────────────────────────
    delta_return = v3_return - 30.1
    delta_dd = v3_max_dd - 14.9
    print(f"""
{'='*95}
KEY OBSERVATIONS
{'='*95}

  1. Return: v2 +30.1% -> v3 +{v3_return:.1f}% (delta: {delta_return:+.1f}%)
  2. Max DD: v2 -14.9% -> v3 -{v3_max_dd:.1f}% (delta: {delta_dd:+.1f}%)
  3. Calmar: v2 2.65 -> v3 {v3_calmar:.2f}
  4. Trades: v2 105 -> v3 {len(v3_trades)} ({len(v2_trades)-len(v3_trades)} trades removed by C3 blacklist)
  5. Win rate: v2 44.8% -> v3 {v3_wr:.1f}%
  6. Mean sizing: v2 {v2_sizing_mean:.3f} -> v3 {v3_sizing_mean:.3f} (quiet grind filter effect)
""")

    # ── Save comparison ─────────────────────────────────────────────
    output = {
        "v3_results": {
            "total_return_pct": round(v3_return, 2),
            "max_drawdown_pct": round(-v3_max_dd, 2),
            "sharpe": round(v3_sharpe, 4),
            "calmar": round(v3_calmar, 4),
            "sortino": round(v3_sortino, 4),
            "total_trades": len(v3_trades),
            "win_rate": round(v3_wr, 1),
            "profit_factor": round(v3_pf, 4),
            "avg_stake": round(v3_avg_stake, 0),
            "avg_duration": v3["exit_reason_summary"][0]["duration_avg"],
            "period": "2022-04-01 to 2026-04-01",
        },
        "v2_v3_comparison": {
            "return_delta": round(delta_return, 2),
            "dd_delta": round(delta_dd, 2),
            "trades_removed": len(v2_trades) - len(v3_trades),
            "c3_blocked": c3_blocked,
            "v2_c3_pnl": round(v2_c3_pnl, 2),
            "v2_sizing_mean": round(v2_sizing_mean, 3),
            "v3_sizing_mean": round(v3_sizing_mean, 3),
        },
        "basin_win_rates_v3": basin_stats_v3,
        "four_way": {
            "v6.2c": {"return": "1662.3%", "max_dd": "-66.6%", "sharpe": 0.68, "calmar": 0.99, "trades": 146, "note": "custom backtester, 2020-2026"},
            "v1": {"return": "-65.5%", "max_dd": "-72.2%", "sharpe": -0.27, "trades": 459, "win_rate": 53.4, "profit_factor": 0.87},
            "v2": {"return": "+30.1%", "max_dd": "-14.9%", "sharpe": 0.13, "calmar": 2.65, "trades": 105, "win_rate": 44.8, "profit_factor": 1.50},
            "v3": {"return": f"+{v3_return:.1f}%", "max_dd": f"-{v3_max_dd:.1f}%", "sharpe": round(v3_sharpe, 2), "calmar": round(v3_calmar, 2), "trades": len(v3_trades), "win_rate": round(v3_wr, 1), "profit_factor": round(v3_pf, 2)},
            "btc_buy_hold": "+50.0% (2022-04 to 2026-04)",
        },
    }

    out_path = DATA_DIR / "backtest_v3_comparison.json"
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"  Saved {out_path}")


if __name__ == "__main__":
    main()
