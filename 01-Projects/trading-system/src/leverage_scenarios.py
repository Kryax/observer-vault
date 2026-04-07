"""
Leverage scenario modelling on v7.0-rc1 (MarkovRegime9v3 tuned).

Replays 101 trades under 5 leverage scenarios:
  1. Baseline (1.0x)
  2. Conservative (1.5x)
  3. Moderate (2.0x)
  4. Aggressive (3.0x)
  5. Smart leverage (variable based on sizing scalar)
"""

import json
import math
import zipfile
from collections import deque
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
BT_DIR = ROOT / "freqtrade" / "user_data" / "backtest_results"

# Strategy params for sizing scalar reconstruction
FLICKER_WINDOW = 12
PERSISTENCE_THRESHOLD = 3
FLICKER_DECAY_RATE = 0.5
SIZING_FLOOR = 0.1
SIZING_CEILING = 1.0
C1_DRAWDOWN_CAP = 0.15
BULLISH_BASINS = {0, 2, 8}
BEARISH_BASINS = {1, 4, 6, 7}
FORCE_FLAT_BASIN = 1
HEAT_PENALTY_RATE = 0.3
HEAT_PENALTY_FLOOR = 0.3
MOMENTUM_BONUS_RATE = 0.15
MOMENTUM_BONUS_CAP = 1.2

FEAT_COLS = ["atr_z", "bbw_z", "rsi_z", "vwap_dist_z", "adx_z", "obv_z"]
BASKET = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "ADA/USDT"]

STARTING_CAPITAL = 10000.0


def pair_to_token(pair):
    return pair.replace("/", "_")


def load_topology():
    with open(DATA_DIR / "normalisation_params.json") as f:
        norm_data = json.load(f)
    norm_params = norm_data["normalisation"]
    feature_order = norm_data["feature_order"]
    cd = norm_data["centroids"]
    centroids = np.zeros((len(cd), len(feature_order)))
    for cid, c in cd.items():
        for fi, feat in enumerate(feature_order):
            centroids[int(cid), fi] = c[feat]

    with open(DATA_DIR / "transition_matrix.json") as f:
        td = json.load(f)
    tm = np.zeros((len(cd), len(cd)))
    for key, val in td["probability_matrix"].items():
        i, j = key.split("->")
        tm[int(i), int(j)] = val

    return norm_params, centroids, tm


def compute_6d(df, pair, norm_params):
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
    vwap = (tp * v).rolling(24, min_periods=1).sum() / v.rolling(24, min_periods=1).sum()
    df["raw_vwap_dist"] = (c - vwap) / vwap * 100
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
        p = norm_params[token]
        for raw, key, z in [("raw_atr", "atr", "atr_z"), ("raw_bbw", "bbw", "bbw_z"),
                            ("raw_rsi", "rsi", "rsi_z"), ("raw_vwap_dist", "vwap_dist", "vwap_dist_z"),
                            ("raw_adx", "adx", "adx_z"), ("raw_obv", "obv", "obv_z")]:
            m, s = p[key]["mean"], p[key]["std"]
            df[z] = (df[raw] - m) / s if s > 0 else 0.0
    return df


def classify_basins(df, centroids):
    basin = pd.Series(-1, index=df.index, dtype=int)
    valid = df[FEAT_COLS].notna().all(axis=1)
    if valid.sum() == 0:
        return basin
    X = df.loc[valid, FEAT_COLS].values
    dists = np.linalg.norm(X[:, np.newaxis, :] - centroids[np.newaxis, :, :], axis=2)
    basin.loc[valid] = np.argmin(dists, axis=1)
    return basin


def compute_effective_sizing(basin, atr_z, rsi_z, trans_matrix, flicker=0):
    """Compute the v3 tuned effective sizing scalar for a single entry."""
    if basin < 0:
        return 1.0

    # Base Markov confidence
    row = trans_matrix[basin]
    opp = sum(row[b] for b in BULLISH_BASINS)
    crash = sum(row[b] for b in BEARISH_BASINS)
    total = opp + crash
    markov_conf = (opp / total) if total > 0 else 0.5

    flicker_penalty = math.exp(-FLICKER_DECAY_RATE * flicker)
    scalar = max(SIZING_FLOOR, min(SIZING_CEILING, markov_conf * flicker_penalty))

    if basin == FORCE_FLAT_BASIN:
        scalar = min(scalar, C1_DRAWDOWN_CAP)

    # Quiet grind filter
    heat = max(HEAT_PENALTY_FLOOR, 1.0 - HEAT_PENALTY_RATE * max(0, atr_z))
    momentum = min(MOMENTUM_BONUS_CAP, 1.0 + MOMENTUM_BONUS_RATE * max(0, rsi_z))
    kinematic = heat * momentum
    final = max(SIZING_FLOOR, min(SIZING_CEILING, scalar * kinematic))
    return final


def replay_equity(trades, leverage_fn, starting=STARTING_CAPITAL):
    """Replay trades with a leverage function, return equity curve and stats."""
    equity = [starting]
    for t in trades:
        lev = leverage_fn(t)
        pnl = t["stake_amount"] * lev * t["profit_ratio"]
        equity.append(equity[-1] + pnl)
    equity = np.array(equity)

    total_return = (equity[-1] / equity[0] - 1) * 100
    peak = np.maximum.accumulate(equity)
    dd = (equity - peak) / peak
    max_dd = dd.min() * 100

    # Per-trade returns as fraction of equity at time of trade
    trade_returns = []
    for i, t in enumerate(trades):
        lev = leverage_fn(t)
        pnl = t["stake_amount"] * lev * t["profit_ratio"]
        ret = pnl / equity[i] if equity[i] > 0 else 0
        trade_returns.append(ret)
    trade_returns = np.array(trade_returns)

    # Sharpe (annualized from ~26 trades/year)
    trades_per_year = len(trades) / 4
    sharpe = (trade_returns.mean() / trade_returns.std() * np.sqrt(trades_per_year)
              if trade_returns.std() > 0 else 0)

    annual_return = total_return / 4
    calmar = abs(annual_return / max_dd) if max_dd != 0 else 0

    # Best/worst single trade
    trade_pnls = []
    for i, t in enumerate(trades):
        lev = leverage_fn(t)
        pnl_pct = t["stake_amount"] * lev * t["profit_ratio"] / equity[i] * 100 if equity[i] > 0 else 0
        trade_pnls.append({"pair": t["pair"], "pnl_pct": pnl_pct, "profit_ratio": t["profit_ratio"] * lev * 100})

    best = max(trade_pnls, key=lambda x: x["pnl_pct"])
    worst = min(trade_pnls, key=lambda x: x["pnl_pct"])

    # Danger count: trades where leveraged loss > 5% of equity
    danger = sum(1 for tp in trade_pnls if tp["pnl_pct"] < -5)

    return {
        "equity": equity,
        "total_return": round(total_return, 1),
        "max_dd": round(max_dd, 1),
        "calmar": round(calmar, 2),
        "sharpe": round(sharpe, 2),
        "best_trade": f"{best['pair']} +{best['pnl_pct']:.1f}%",
        "worst_trade": f"{worst['pair']} {worst['pnl_pct']:.1f}%",
        "danger_count": danger,
    }


def text_equity_chart(scenarios, width=70, height=18):
    """Render a simple ASCII equity chart."""
    # Find global min/max
    all_vals = []
    for name, s in scenarios.items():
        all_vals.extend(s["equity"].tolist())
    vmin, vmax = min(all_vals), max(all_vals)
    vrange = vmax - vmin if vmax > vmin else 1

    n_points = max(len(s["equity"]) for s in scenarios.values())
    symbols = {"Baseline (1.0x)": ".", "Conservative (1.5x)": "o",
               "Moderate (2.0x)": "+", "Aggressive (3.0x)": "x",
               "Smart Leverage": "*"}

    # Build grid
    grid = [[" " for _ in range(width)] for _ in range(height)]

    for name, s in scenarios.items():
        eq = s["equity"]
        sym = symbols.get(name, "#")
        for i in range(len(eq)):
            col = int(i / (len(eq) - 1) * (width - 1)) if len(eq) > 1 else 0
            row = height - 1 - int((eq[i] - vmin) / vrange * (height - 1))
            row = max(0, min(height - 1, row))
            if grid[row][col] == " " or sym in ("*", "x"):
                grid[row][col] = sym

    # Print
    print(f"\n{'EQUITY CURVES':^{width}}")
    print(f"  ${vmax:,.0f} ┤")
    for r, row in enumerate(grid):
        if r == 0 or r == height - 1:
            continue
        label = ""
        if r == height // 4:
            label = f"  ${vmin + vrange * (1 - r / (height-1)):,.0f}"
        elif r == height // 2:
            label = f"  ${vmin + vrange * 0.5:,.0f}"
        elif r == 3 * height // 4:
            label = f"  ${vmin + vrange * (1 - r / (height-1)):,.0f}"
        prefix = f"{label:>10s} │" if label else "           │"
        print(f"{prefix}{''.join(row)}")
    print(f"  ${vmin:,.0f} ┤{'─' * width}")
    print(f"           {'Trade 1':>{width // 4}}{'Trade 25':>{width // 4}}{'Trade 50':>{width // 4}}{'Trade 101':>{width // 4}}")

    # Legend
    print(f"\n  Legend: {'  '.join(f'{sym}={name}' for name, sym in symbols.items())}")


def main():
    # ── Load trades ─────────────────────────────────────────────────
    bt_zip = BT_DIR / "backtest-result-2026-04-07_12-58-03.zip"
    with zipfile.ZipFile(bt_zip) as z:
        json_name = [n for n in z.namelist() if n.endswith(".json") and not n.endswith("_config.json")][0]
        with z.open(json_name) as f:
            bt = json.load(f)
    trades = bt["strategy"]["MarkovRegime9v3"]["trades"]
    print(f"Loaded {len(trades)} trades from v7.0-rc1 backtest")

    # ── Load OHLCV + topology for sizing scalar reconstruction ──────
    norm_params, centroids, trans_matrix = load_topology()
    pair_dfs = {}
    for pair in BASKET:
        token = pair_to_token(pair)
        path = DATA_DIR / f"{token}-1h.feather"
        if path.exists():
            df = pd.read_feather(path).sort_values("date").reset_index(drop=True)
            df["date"] = pd.to_datetime(df["date"], utc=True)
            df = compute_6d(df, pair, norm_params)
            df["basin"] = classify_basins(df, centroids)
            pair_dfs[pair] = df

    # ── Annotate trades with sizing scalar ──────────────────────────
    for t in trades:
        pair = t["pair"]
        if pair not in pair_dfs:
            t["sizing_scalar"] = 0.5
            t["entry_basin"] = -1
            continue
        df = pair_dfs[pair]
        open_ts = pd.Timestamp(t["open_timestamp"], unit="ms", tz="UTC")
        mask = df["date"] <= open_ts
        if mask.sum() == 0:
            t["sizing_scalar"] = 0.5
            t["entry_basin"] = -1
            continue
        idx = df.loc[mask].index[-1]
        row = df.iloc[idx]
        basin = int(row["basin"])
        atr_z = float(row["atr_z"]) if not np.isnan(row["atr_z"]) else 0.0
        rsi_z = float(row["rsi_z"]) if not np.isnan(row["rsi_z"]) else 0.0
        t["entry_basin"] = basin
        t["sizing_scalar"] = compute_effective_sizing(basin, atr_z, rsi_z, trans_matrix)

    scalars = [t["sizing_scalar"] for t in trades]
    print(f"Sizing scalars: min={min(scalars):.3f}, max={max(scalars):.3f}, mean={np.mean(scalars):.3f}")

    # ── Define scenarios ────────────────────────────────────────────
    def baseline(t):
        return 1.0

    def conservative(t):
        return 1.5

    def moderate(t):
        return 2.0

    def aggressive(t):
        return 3.0

    def smart(t):
        s = t["sizing_scalar"]
        if s >= 0.8:
            return 2.0
        elif s >= 0.5:
            return 1.5
        else:
            return 1.0

    scenario_fns = [
        ("Baseline (1.0x)", baseline),
        ("Conservative (1.5x)", conservative),
        ("Moderate (2.0x)", moderate),
        ("Aggressive (3.0x)", aggressive),
        ("Smart Leverage", smart),
    ]

    # ── Run scenarios ───────────────────────────────────────────────
    results = {}
    for name, fn in scenario_fns:
        results[name] = replay_equity(trades, fn)

    # ── Print comparison table ──────────────────────────────────────
    print("\n" + "=" * 110)
    print("LEVERAGE SCENARIO MODELLING — v7.0-rc1 (101 trades, 2022-04 to 2026-04)")
    print("=" * 110)

    header = f"{'Metric':<22}"
    for name in results:
        header += f" | {name:>17}"
    header += f" | {'BTC Buy&Hold':>17}"
    print(header)
    print("-" * 110)

    metrics = [
        ("Total Return", "total_return", "%"),
        ("Max Drawdown", "max_dd", "%"),
        ("Calmar Ratio", "calmar", ""),
        ("Sharpe Ratio", "sharpe", ""),
        ("Best Trade", "best_trade", ""),
        ("Worst Trade", "worst_trade", ""),
        ("Danger Count (>5%)", "danger_count", ""),
    ]

    btc_vals = {
        "Total Return": "+50.0%",
        "Max Drawdown": "-66.7%",
        "Calmar Ratio": "0.19",
        "Sharpe Ratio": "—",
        "Best Trade": "—",
        "Worst Trade": "—",
        "Danger Count (>5%)": "—",
    }

    for label, key, suffix in metrics:
        row = f"{label:<22}"
        for name, r in results.items():
            val = r[key]
            if isinstance(val, str):
                row += f" | {val:>17}"
            elif suffix == "%":
                row += f" | {val:>+16.1f}%"
            else:
                row += f" | {val:>17}"
        row += f" | {btc_vals[label]:>17}"
        print(row)

    # Final equity row
    row = f"{'Final Equity ($10k)':<22}"
    for name, r in results.items():
        row += f" | ${r['equity'][-1]:>14,.0f}"
    row += f" | {'$15,000':>17}"
    print(row)

    # ── Smart leverage breakdown ────────────────────────────────────
    print(f"\n{'─'*60}")
    print("SMART LEVERAGE BREAKDOWN")
    print(f"{'─'*60}")

    high_conv = [t for t in trades if t["sizing_scalar"] >= 0.8]
    med_conv = [t for t in trades if 0.5 <= t["sizing_scalar"] < 0.8]
    low_conv = [t for t in trades if t["sizing_scalar"] < 0.5]

    for label, group, lev in [("High conviction (>=0.8)", high_conv, "2.0x"),
                               ("Medium conviction (0.5-0.8)", med_conv, "1.5x"),
                               ("Low conviction (<0.5)", low_conv, "1.0x")]:
        n = len(group)
        if n == 0:
            print(f"  {label}: 0 trades")
            continue
        wins = sum(1 for t in group if t["profit_ratio"] > 0)
        avg_ret = np.mean([t["profit_ratio"] for t in group]) * 100
        total_pnl = sum(t["profit_abs"] for t in group)
        wr = wins / n * 100
        print(f"  {label}: {n} trades, WR {wr:.0f}%, avg ret {avg_ret:+.2f}%, P&L ${total_pnl:+,.0f}, leverage {lev}")

    # ── Text equity chart ───────────────────────────────────────────
    text_equity_chart(results)

    # ── Save ────────────────────────────────────────────────────────
    output = {}
    for name, r in results.items():
        output[name] = {k: v for k, v in r.items() if k != "equity"}
        output[name]["final_equity"] = round(float(r["equity"][-1]), 0)
        # Equity curve sampled at 10 points for JSON
        eq = r["equity"]
        indices = np.linspace(0, len(eq) - 1, 11, dtype=int)
        output[name]["equity_sample"] = [round(float(eq[i]), 0) for i in indices]

    output["btc_buy_hold"] = {"total_return": 50.0, "max_dd": -66.7, "calmar": 0.19}
    output["metadata"] = {
        "strategy": "MarkovRegime9v3 (v7.0-rc1 tuned)",
        "trades": len(trades),
        "period": "2022-04-01 to 2026-04-01",
        "starting_capital": STARTING_CAPITAL,
        "smart_leverage_thresholds": {"high": 0.8, "medium": 0.5},
        "smart_leverage_multipliers": {"high": 2.0, "medium": 1.5, "low": 1.0},
    }

    out_path = DATA_DIR / "leverage_scenarios.json"
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2, default=str)
    print(f"\nSaved {out_path}")


if __name__ == "__main__":
    main()
