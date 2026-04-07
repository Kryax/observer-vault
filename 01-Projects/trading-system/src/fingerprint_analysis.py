"""
Winner vs Loser Fingerprint Analysis — Bayesian Edge Detection.

Extracts per-trade fingerprints from MarkovRegime9v2 backtest (105 trades),
computes basin/sizing/6D features at entry time, and finds the geometric
space where winners cluster and losers don't.

Steps:
  1. Extract full trade data with 6D features at entry
  2. Split winners/losers, compute distributions
  3. Find the edge (where winners are dense AND losers are sparse)
  4. Fit optimal sizing rules from hindsight
  5. Project returns under optimal sizing
  6. Save everything
"""

import json
import math
import sys
import zipfile
from collections import deque
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier, export_text

# ─── Paths ──────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
BT_DIR = ROOT / "freqtrade" / "user_data" / "backtest_results"
BT_ZIP = BT_DIR / "backtest-result-2026-04-07_11-10-22.zip"
NORM_PATH = DATA_DIR / "normalisation_params.json"
TRANS_PATH = DATA_DIR / "transition_matrix.json"

BASKET = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "ADA/USDT"]
FEAT_COLS = ["atr_z", "bbw_z", "rsi_z", "vwap_dist_z", "adx_z", "obv_z"]

BULLISH_BASINS = {0, 2, 3, 8}
BEARISH_BASINS = {1, 4, 6, 7}
FLICKER_WINDOW = 12
PERSISTENCE_THRESHOLD = 3
FLICKER_DECAY_RATE = 0.5
SIZING_FLOOR = 0.1
SIZING_CEILING = 1.0
C1_DRAWDOWN_CAP = 0.15
BIFURCATION_BONUS = 1.2
FORCE_FLAT_BASIN = 1
MOMENTUM_WINDOW = 720


def load_json(path):
    with open(path) as f:
        return json.load(f)


def pair_to_token(pair):
    return pair.replace("/", "_")


# ─── Load topology ──────────────────────────────────────────────────────
def load_topology():
    norm_data = load_json(NORM_PATH)
    norm_params = norm_data["normalisation"]
    feature_order = norm_data["feature_order"]
    centroids_dict = norm_data["centroids"]
    n_clusters = len(centroids_dict)
    centroids = np.zeros((n_clusters, len(feature_order)))
    for cid_str, centroid in centroids_dict.items():
        for fi, feat in enumerate(feature_order):
            centroids[int(cid_str), fi] = centroid[feat]

    trans_data = load_json(TRANS_PATH)
    trans_matrix = np.zeros((n_clusters, n_clusters))
    for key, val in trans_data["probability_matrix"].items():
        i, j = key.split("->")
        trans_matrix[int(i), int(j)] = val

    return norm_params, centroids, trans_matrix


# ─── Compute 6D features for a pair ─────────────────────────────────────
def compute_6d_features(df, pair, norm_params):
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

    # ADX
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


def classify_basins(df, centroids):
    basin = pd.Series(-1, index=df.index, dtype=int)
    valid = df[FEAT_COLS].notna().all(axis=1)
    if valid.sum() == 0:
        return basin
    X = df.loc[valid, FEAT_COLS].values
    dists = np.linalg.norm(X[:, np.newaxis, :] - centroids[np.newaxis, :, :], axis=2)
    basin.loc[valid] = np.argmin(dists, axis=1)
    return basin


def compute_sizing_at_bar(basin_history_list, basin, trans_matrix):
    """Compute sizing scalar, flicker count, stable basin for a single bar."""
    # Flicker count
    flicker = 0
    for j in range(1, len(basin_history_list)):
        if basin_history_list[j] != basin_history_list[j - 1]:
            flicker += 1

    # Stable basin
    stable = -1
    if len(basin_history_list) >= PERSISTENCE_THRESHOLD:
        run_len = 1
        for j in range(len(basin_history_list) - 2, -1, -1):
            if basin_history_list[j] == basin_history_list[-1]:
                run_len += 1
            else:
                break
        if run_len >= PERSISTENCE_THRESHOLD:
            stable = basin_history_list[-1]

    # Markov confidence
    row = trans_matrix[basin]
    opp = sum(row[b] for b in BULLISH_BASINS)
    crash = sum(row[b] for b in BEARISH_BASINS)
    total = opp + crash
    markov_conf = (opp / total) if total > 0 else 0.5

    # Flicker penalty
    flicker_penalty = math.exp(-FLICKER_DECAY_RATE * flicker)

    # Combined scalar
    scalar = markov_conf * flicker_penalty
    scalar = max(SIZING_FLOOR, min(SIZING_CEILING, scalar))

    # Basin overrides
    if stable == FORCE_FLAT_BASIN:
        scalar = min(scalar, C1_DRAWDOWN_CAP)
    if basin == 3 and len(basin_history_list) >= 2:
        if 4 in basin_history_list[:-1]:
            scalar = min(BIFURCATION_BONUS, scalar * 1.5)

    return round(scalar, 4), flicker, stable, round(markov_conf, 4)


# ═════════════════════════════════════════════════════════════════════════
# MAIN
# ═════════════════════════════════════════════════════════════════════════

def main():
    print("=" * 70)
    print("FINGERPRINT ANALYSIS — MarkovRegime9v2 (105 trades)")
    print("=" * 70)

    # ── Load backtest trades ────────────────────────────────────────────
    with zipfile.ZipFile(BT_ZIP) as z:
        with z.open("backtest-result-2026-04-07_11-10-22.json") as f:
            bt_data = json.load(f)
    strat = bt_data["strategy"]["MarkovRegime9v2"]
    trades = strat["trades"]
    print(f"\nLoaded {len(trades)} trades from backtest")

    # ── Load topology ───────────────────────────────────────────────────
    norm_params, centroids, trans_matrix = load_topology()
    print(f"Loaded K=9 topology: {centroids.shape[0]} centroids, {trans_matrix.shape} transition matrix")

    # ── Load and compute features for all pairs ─────────────────────────
    pair_dfs = {}
    for pair in BASKET:
        token = pair_to_token(pair)
        feather_path = DATA_DIR / f"{token}-1h.feather"
        if feather_path.exists():
            df = pd.read_feather(feather_path)
            df = df.sort_values("date").reset_index(drop=True)
            df["date"] = pd.to_datetime(df["date"], utc=True)
            df = compute_6d_features(df, pair, norm_params)
            df["basin"] = classify_basins(df, centroids)

            # Compute per-bar sizing via rolling window (same as strategy)
            basins = df["basin"].values
            n = len(basins)
            sizing_arr = np.ones(n)
            flicker_arr = np.zeros(n, dtype=int)
            stable_arr = np.full(n, -1, dtype=int)
            markov_conf_arr = np.full(n, np.nan)
            history = deque(maxlen=FLICKER_WINDOW)

            for i in range(n):
                basin = int(basins[i])
                history.append(basin)
                if basin < 0:
                    continue
                hist_list = list(history)
                scalar, flicker, stable, mc = compute_sizing_at_bar(hist_list, basin, trans_matrix)
                sizing_arr[i] = scalar
                flicker_arr[i] = flicker
                stable_arr[i] = stable
                markov_conf_arr[i] = mc

            df["sizing_scalar"] = sizing_arr
            df["flicker_count"] = flicker_arr
            df["stable_basin"] = stable_arr
            df["markov_confidence"] = markov_conf_arr

            pair_dfs[pair] = df
            print(f"  {pair}: {len(df)} bars, date range {df['date'].iloc[0]} to {df['date'].iloc[-1]}")
        else:
            print(f"  WARNING: No feather data for {pair}")

    # ── Step 1: Extract per-trade fingerprints ──────────────────────────
    print("\n" + "=" * 70)
    print("STEP 1: Extract trade fingerprints")
    print("=" * 70)

    fingerprints = []
    for t in trades:
        pair = t["pair"]
        open_ts = pd.Timestamp(t["open_timestamp"], unit="ms", tz="UTC")
        close_ts = pd.Timestamp(t["close_timestamp"], unit="ms", tz="UTC")

        if pair not in pair_dfs:
            print(f"  SKIP: {pair} not in pair_dfs")
            continue

        df = pair_dfs[pair]
        # Find the entry bar (closest bar <= open_ts)
        entry_mask = df["date"] <= open_ts
        if entry_mask.sum() == 0:
            print(f"  SKIP: no data before {open_ts} for {pair}")
            continue
        entry_idx = df.loc[entry_mask].index[-1]

        # Find the exit bar
        exit_mask = df["date"] <= close_ts
        exit_idx = df.loc[exit_mask].index[-1] if exit_mask.sum() > 0 else entry_idx

        entry_row = df.iloc[entry_idx]

        fp = {
            "trade_num": len(fingerprints) + 1,
            "pair": pair,
            "open_date": str(open_ts),
            "close_date": str(close_ts),
            "open_rate": t["open_rate"],
            "close_rate": t["close_rate"],
            "profit_ratio": t["profit_ratio"],
            "profit_abs": t["profit_abs"],
            "stake_amount": t["stake_amount"],
            "trade_duration_hours": t["trade_duration"] / 60,
            "exit_reason": t["exit_reason"],
            "entry_basin": int(entry_row["basin"]),
            "exit_basin": int(df.iloc[exit_idx]["basin"]),
            "stable_basin": int(entry_row["stable_basin"]),
            "flicker_count": int(entry_row["flicker_count"]),
            "sizing_scalar": float(entry_row["sizing_scalar"]),
            "markov_confidence": float(entry_row["markov_confidence"]) if not np.isnan(entry_row["markov_confidence"]) else None,
            "atr_z": round(float(entry_row["atr_z"]), 4) if not np.isnan(entry_row["atr_z"]) else None,
            "bbw_z": round(float(entry_row["bbw_z"]), 4) if not np.isnan(entry_row["bbw_z"]) else None,
            "rsi_z": round(float(entry_row["rsi_z"]), 4) if not np.isnan(entry_row["rsi_z"]) else None,
            "vwap_dist_z": round(float(entry_row["vwap_dist_z"]), 4) if not np.isnan(entry_row["vwap_dist_z"]) else None,
            "adx_z": round(float(entry_row["adx_z"]), 4) if not np.isnan(entry_row["adx_z"]) else None,
            "obv_z": round(float(entry_row["obv_z"]), 4) if not np.isnan(entry_row["obv_z"]) else None,
        }
        fingerprints.append(fp)

    print(f"\nExtracted {len(fingerprints)} trade fingerprints")

    # Save as parquet and JSON
    fp_df = pd.DataFrame(fingerprints)
    fp_df.to_parquet(DATA_DIR / "trade_fingerprints.parquet", index=False)
    with open(DATA_DIR / "trade_fingerprints.json", "w") as f:
        json.dump(fingerprints, f, indent=2, default=str)
    print(f"Saved to data/trade_fingerprints.parquet and data/trade_fingerprints.json")

    # ── Step 2: Winner/Loser split ──────────────────────────────────────
    print("\n" + "=" * 70)
    print("STEP 2: Winner vs Loser fingerprints")
    print("=" * 70)

    winners = fp_df[fp_df["profit_ratio"] > 0].copy()
    losers = fp_df[fp_df["profit_ratio"] <= 0].copy()
    print(f"\nWinners: {len(winners)} ({len(winners)/len(fp_df)*100:.1f}%)")
    print(f"Losers:  {len(losers)} ({len(losers)/len(fp_df)*100:.1f}%)")

    z_cols = ["atr_z", "bbw_z", "rsi_z", "vwap_dist_z", "adx_z", "obv_z"]

    print("\n┌─────────────────────────────────────────────────────────────────────┐")
    print("│ FEATURE              │ WINNERS (mean±std) │ LOSERS (mean±std)  │ Δ  │")
    print("├─────────────────────────────────────────────────────────────────────┤")

    feature_deltas = {}
    for col in z_cols + ["flicker_count", "sizing_scalar", "markov_confidence"]:
        w_vals = winners[col].dropna()
        l_vals = losers[col].dropna()
        w_mean = w_vals.mean() if len(w_vals) > 0 else 0
        w_std = w_vals.std() if len(w_vals) > 1 else 0
        l_mean = l_vals.mean() if len(l_vals) > 0 else 0
        l_std = l_vals.std() if len(l_vals) > 1 else 0
        delta = w_mean - l_mean
        feature_deltas[col] = {"winner_mean": round(w_mean, 4), "winner_std": round(w_std, 4),
                               "loser_mean": round(l_mean, 4), "loser_std": round(l_std, 4),
                               "delta": round(delta, 4)}
        print(f"│ {col:20s} │ {w_mean:+7.3f} ± {w_std:5.3f}  │ {l_mean:+7.3f} ± {l_std:5.3f}  │ {delta:+.3f} │")

    print("└─────────────────────────────────────────────────────────────────────┘")

    # Basin distributions
    print("\n── Entry Basin Distribution ──")
    print(f"{'Basin':>6} │ {'Winners':>8} │ {'Losers':>8} │ {'Win Rate':>9}")
    print("─" * 42)
    basin_stats = {}
    for b in range(9):
        w_count = (winners["entry_basin"] == b).sum()
        l_count = (losers["entry_basin"] == b).sum()
        total = w_count + l_count
        wr = w_count / total * 100 if total > 0 else 0
        basin_stats[b] = {"winners": int(w_count), "losers": int(l_count),
                          "total": int(total), "win_rate": round(wr, 1)}
        marker = " ★" if wr > 60 else " ✗" if wr < 30 and total > 3 else ""
        print(f"  C{b}   │ {w_count:8d} │ {l_count:8d} │ {wr:7.1f}%{marker}")

    # Stable basin distribution
    print("\n── Stable Basin at Entry ──")
    print(f"{'Basin':>6} │ {'Winners':>8} │ {'Losers':>8} │ {'Win Rate':>9}")
    print("─" * 42)
    stable_stats = {}
    for b in list(range(9)) + [-1]:
        w_count = (winners["stable_basin"] == b).sum()
        l_count = (losers["stable_basin"] == b).sum()
        total = w_count + l_count
        wr = w_count / total * 100 if total > 0 else 0
        label = f"C{b}" if b >= 0 else "none"
        stable_stats[str(b)] = {"winners": int(w_count), "losers": int(l_count),
                                "total": int(total), "win_rate": round(wr, 1)}
        if total > 0:
            print(f"  {label:4s} │ {w_count:8d} │ {l_count:8d} │ {wr:7.1f}%")

    # Exit reason distribution
    print("\n── Exit Reason Distribution ──")
    print(f"{'Reason':>20} │ {'Winners':>8} │ {'Losers':>8}")
    print("─" * 42)
    exit_stats = {}
    for reason in fp_df["exit_reason"].unique():
        w_count = (winners["exit_reason"] == reason).sum()
        l_count = (losers["exit_reason"] == reason).sum()
        exit_stats[reason] = {"winners": int(w_count), "losers": int(l_count)}
        print(f"  {reason:18s} │ {w_count:8d} │ {l_count:8d}")

    # ── Step 3: Find the edge ───────────────────────────────────────────
    print("\n" + "=" * 70)
    print("STEP 3: Edge detection — where winners cluster, losers don't")
    print("=" * 70)

    # Basin win rates ranked
    print("\n── Basins Ranked by Win Rate ──")
    ranked = sorted(basin_stats.items(), key=lambda x: x[1]["win_rate"], reverse=True)
    for b, st in ranked:
        cat = "BULLISH" if b in BULLISH_BASINS else "BEARISH" if b in BEARISH_BASINS else "NEUTRAL"
        edge_type = ""
        if st["total"] >= 3:
            if st["win_rate"] > 55:
                edge_type = "TRUE EDGE"
            elif st["win_rate"] < 35:
                edge_type = "ANTI-EDGE"
            else:
                edge_type = "no edge"
        print(f"  C{b} ({cat:7s}): {st['win_rate']:5.1f}% win rate ({st['total']:3d} trades) — {edge_type}")

    # 6D centroid of winners vs losers
    w_valid = winners[z_cols].dropna()
    l_valid = losers[z_cols].dropna()

    if len(w_valid) > 0 and len(l_valid) > 0:
        w_centroid = w_valid.mean().values
        l_centroid = l_valid.mean().values
        edge_direction = w_centroid - l_centroid
        edge_magnitude = np.linalg.norm(edge_direction)
        edge_unit = edge_direction / edge_magnitude if edge_magnitude > 0 else edge_direction

        print(f"\n── Edge Direction Vector (Winner centroid - Loser centroid) ──")
        print(f"  Magnitude: {edge_magnitude:.4f}")
        for i, col in enumerate(z_cols):
            bar = "█" * int(abs(edge_direction[i]) * 10)
            sign = "+" if edge_direction[i] > 0 else "-"
            print(f"  {col:15s}: {edge_direction[i]:+.4f}  {sign}{bar}")

        print(f"\n  Interpretation:")
        top_features = sorted(zip(z_cols, edge_direction), key=lambda x: abs(x[1]), reverse=True)
        for feat, val in top_features[:3]:
            direction = "higher" if val > 0 else "lower"
            print(f"    Winners have {direction} {feat} at entry ({val:+.4f})")
    else:
        w_centroid = l_centroid = edge_direction = None
        edge_magnitude = 0

    # ── Step 4: Optimal sizing reconstruction ───────────────────────────
    print("\n" + "=" * 70)
    print("STEP 4: Optimal sizing reconstruction")
    print("=" * 70)

    # Create feature matrix
    feature_cols_model = z_cols + ["entry_basin", "flicker_count", "markov_confidence"]
    model_df = fp_df[feature_cols_model + ["profit_ratio"]].dropna().copy()
    model_df["is_winner"] = (model_df["profit_ratio"] > 0).astype(int)

    # Optimal sizing: winners get 1.0, losers get 0.1
    model_df["optimal_sizing"] = model_df["is_winner"].map({1: 1.0, 0: 0.1})

    X = model_df[feature_cols_model].values
    y = model_df["is_winner"].values

    print(f"\nModel data: {len(model_df)} trades with complete features")
    print(f"  Winners: {y.sum()}, Losers: {len(y) - y.sum()}")

    # Logistic regression for P(win | features)
    lr = LogisticRegression(max_iter=1000, random_state=42)
    lr.fit(X, y)
    lr_probs = lr.predict_proba(X)[:, 1]
    lr_accuracy = (lr.predict(X) == y).mean()
    print(f"\n── Logistic Regression ──")
    print(f"  Training accuracy: {lr_accuracy*100:.1f}%")
    print(f"  Coefficients:")
    for col, coef in zip(feature_cols_model, lr.coef_[0]):
        print(f"    {col:20s}: {coef:+.4f}")

    # Decision tree for interpretable rules
    dt = DecisionTreeClassifier(max_depth=4, min_samples_leaf=5, random_state=42)
    dt.fit(X, y)
    dt_accuracy = (dt.predict(X) == y).mean()
    print(f"\n── Decision Tree (depth=4) ──")
    print(f"  Training accuracy: {dt_accuracy*100:.1f}%")
    tree_rules = export_text(dt, feature_names=feature_cols_model)
    print(f"\n  Rules:")
    for line in tree_rules.split("\n"):
        print(f"    {line}")

    # Derive threshold-based sizing rules from the data
    print(f"\n── Derived Sizing Rules ──")
    rules = []

    # Rule 1: Basin-based win rates
    for b, st in basin_stats.items():
        if st["total"] >= 5:
            if st["win_rate"] > 55:
                sizing = round(min(1.0, st["win_rate"] / 100 + 0.3), 2)
                rules.append({"condition": f"entry_basin == C{b}", "sizing": sizing,
                              "win_rate": st["win_rate"], "n_trades": st["total"]})
            elif st["win_rate"] < 35:
                rules.append({"condition": f"entry_basin == C{b}", "sizing": 0.1,
                              "win_rate": st["win_rate"], "n_trades": st["total"]})

    # Rule 2: Markov confidence threshold
    mc_winner = winners["markov_confidence"].dropna()
    mc_loser = losers["markov_confidence"].dropna()
    if len(mc_winner) > 0 and len(mc_loser) > 0:
        mc_threshold = (mc_winner.mean() + mc_loser.mean()) / 2
        high_mc = fp_df[fp_df["markov_confidence"] >= mc_threshold]
        low_mc = fp_df[fp_df["markov_confidence"] < mc_threshold]
        if len(high_mc) > 0:
            high_wr = (high_mc["profit_ratio"] > 0).mean() * 100
            rules.append({"condition": f"markov_confidence >= {mc_threshold:.3f}",
                          "sizing": round(min(1.0, high_wr / 100 + 0.2), 2),
                          "win_rate": round(high_wr, 1), "n_trades": len(high_mc)})
        if len(low_mc) > 0:
            low_wr = (low_mc["profit_ratio"] > 0).mean() * 100
            rules.append({"condition": f"markov_confidence < {mc_threshold:.3f}",
                          "sizing": round(max(0.1, low_wr / 100 - 0.1), 2),
                          "win_rate": round(low_wr, 1), "n_trades": len(low_mc)})

    # Rule 3: Flicker threshold
    fc_winner = winners["flicker_count"].mean()
    fc_loser = losers["flicker_count"].mean()
    fc_threshold = (fc_winner + fc_loser) / 2
    low_flicker = fp_df[fp_df["flicker_count"] <= fc_threshold]
    if len(low_flicker) > 0:
        lf_wr = (low_flicker["profit_ratio"] > 0).mean() * 100
        rules.append({"condition": f"flicker_count <= {fc_threshold:.0f}",
                      "sizing": round(min(1.0, lf_wr / 100 + 0.2), 2),
                      "win_rate": round(lf_wr, 1), "n_trades": len(low_flicker)})

    # Rule 4: Stable basin specific
    for b_str, st in stable_stats.items():
        b = int(b_str)
        if b >= 0 and st["total"] >= 5 and st["win_rate"] > 55:
            sizing = round(min(1.0, st["win_rate"] / 100 + 0.25), 2)
            rules.append({"condition": f"stable_basin == C{b}", "sizing": sizing,
                          "win_rate": st["win_rate"], "n_trades": st["total"]})

    for r in rules:
        print(f"  IF {r['condition']:40s} → sizing = {r['sizing']:.2f}  (WR: {r['win_rate']:.1f}%, n={r['n_trades']})")

    # Composite sizing model using logistic regression probability
    # sizing = P(win) * 0.9 + 0.1 (maps 0→0.1, 1→1.0)
    composite_sizing = lr_probs * 0.9 + 0.1
    model_df["composite_sizing"] = composite_sizing

    # ── Step 5: Projected returns ───────────────────────────────────────
    print("\n" + "=" * 70)
    print("STEP 5: Projected returns under optimal sizing")
    print("=" * 70)

    # Map composite sizing back to all trades
    fp_df_model = fp_df.dropna(subset=feature_cols_model).copy()
    X_all = fp_df_model[feature_cols_model].values
    all_probs = lr.predict_proba(X_all)[:, 1]
    fp_df_model["lr_prob"] = all_probs
    fp_df_model["optimal_sizing_lr"] = all_probs * 0.9 + 0.1

    # v2 actual returns
    v2_returns = fp_df["profit_ratio"].values
    v2_stakes = fp_df["stake_amount"].values
    starting_capital = 10000.0

    # Replay with actual v2 sizing
    equity_v2 = [starting_capital]
    for i in range(len(v2_returns)):
        pnl = v2_stakes[i] * v2_returns[i]
        equity_v2.append(equity_v2[-1] + pnl)
    equity_v2 = np.array(equity_v2)

    v2_total_return = (equity_v2[-1] / equity_v2[0] - 1) * 100
    v2_peak = np.maximum.accumulate(equity_v2)
    v2_drawdown = (equity_v2 - v2_peak) / v2_peak
    v2_max_dd = v2_drawdown.min() * 100

    # Replay with optimal sizing (LR-based)
    equity_opt = [starting_capital]
    for _, row in fp_df_model.iterrows():
        # Scale stake by (optimal_sizing / original_sizing)
        original_sizing = row["sizing_scalar"]
        optimal_sizing = row["optimal_sizing_lr"]
        if original_sizing > 0:
            scale_factor = optimal_sizing / original_sizing
        else:
            scale_factor = 1.0
        adjusted_stake = row["stake_amount"] * scale_factor
        pnl = adjusted_stake * row["profit_ratio"]
        equity_opt.append(equity_opt[-1] + pnl)
    equity_opt = np.array(equity_opt)

    opt_total_return = (equity_opt[-1] / equity_opt[0] - 1) * 100
    opt_peak = np.maximum.accumulate(equity_opt)
    opt_drawdown = (equity_opt - opt_peak) / opt_peak
    opt_max_dd = opt_drawdown.min() * 100

    # Replay with hindsight-perfect sizing (1.0 for winners, 0.1 for losers)
    equity_perfect = [starting_capital]
    for _, row in fp_df.iterrows():
        original_sizing = row["sizing_scalar"]
        if row["profit_ratio"] > 0:
            perfect_sizing = 1.0
        else:
            perfect_sizing = 0.1
        if original_sizing > 0:
            scale_factor = perfect_sizing / original_sizing
        else:
            scale_factor = 1.0
        adjusted_stake = row["stake_amount"] * scale_factor
        pnl = adjusted_stake * row["profit_ratio"]
        equity_perfect.append(equity_perfect[-1] + pnl)
    equity_perfect = np.array(equity_perfect)

    perfect_total_return = (equity_perfect[-1] / equity_perfect[0] - 1) * 100
    perfect_peak = np.maximum.accumulate(equity_perfect)
    perfect_drawdown = (equity_perfect - perfect_peak) / perfect_peak
    perfect_max_dd = perfect_drawdown.min() * 100

    # Buy-and-hold BTC benchmark
    btc_df = pair_dfs.get("BTC/USDT")
    if btc_df is not None:
        bt_start = pd.Timestamp("2022-04-01", tz="UTC")
        bt_end = pd.Timestamp("2026-04-01", tz="UTC")
        btc_period = btc_df[(btc_df["date"] >= bt_start) & (btc_df["date"] <= bt_end)]
        if len(btc_period) > 0:
            btc_start_price = btc_period["close"].iloc[0]
            btc_end_price = btc_period["close"].iloc[-1]
            btc_return = (btc_end_price / btc_start_price - 1) * 100

            # BTC max drawdown
            btc_cum = btc_period["close"].values / btc_start_price
            btc_peak = np.maximum.accumulate(btc_cum)
            btc_dd = (btc_cum - btc_peak) / btc_peak
            btc_max_dd = btc_dd.min() * 100
        else:
            btc_return = btc_max_dd = 0
            btc_start_price = btc_end_price = 0
    else:
        btc_return = btc_max_dd = 0
        btc_start_price = btc_end_price = 0

    # Compute Sharpe approximation (annualized from trade returns)
    trade_returns = fp_df["profit_ratio"].values
    if len(trade_returns) > 1 and trade_returns.std() > 0:
        # Approximate: avg trades per year based on 4-year period
        trades_per_year = len(trade_returns) / 4
        v2_sharpe = (trade_returns.mean() / trade_returns.std()) * np.sqrt(trades_per_year)
    else:
        v2_sharpe = 0

    # Calmar = annual return / max drawdown
    v2_annual_return = v2_total_return / 4
    v2_calmar = abs(v2_annual_return / v2_max_dd) if v2_max_dd != 0 else 0

    opt_annual_return = opt_total_return / 4
    opt_calmar = abs(opt_annual_return / opt_max_dd) if opt_max_dd != 0 else 0

    # Optimal sizing sharpe
    opt_trade_returns = []
    for _, row in fp_df_model.iterrows():
        original_sizing = row["sizing_scalar"]
        optimal_sizing = row["optimal_sizing_lr"]
        scale_factor = optimal_sizing / original_sizing if original_sizing > 0 else 1.0
        opt_trade_returns.append(row["profit_ratio"] * scale_factor)
    opt_trade_returns = np.array(opt_trade_returns)
    if len(opt_trade_returns) > 1 and opt_trade_returns.std() > 0:
        trades_per_year = len(opt_trade_returns) / 4
        opt_sharpe = (opt_trade_returns.mean() / opt_trade_returns.std()) * np.sqrt(trades_per_year)
    else:
        opt_sharpe = 0

    print(f"\n┌────────────────────────────────────────────────────────────────┐")
    print(f"│ RETURNS COMPARISON (2022-04 to 2026-04, $10k starting)       │")
    print(f"├────────────────────────────────────────────────────────────────┤")
    print(f"│                    │ Return  │ Max DD  │ Sharpe │ Calmar     │")
    print(f"├────────────────────────────────────────────────────────────────┤")
    print(f"│ v2 Actual          │ {v2_total_return:+6.1f}% │ {v2_max_dd:6.1f}% │ {v2_sharpe:5.2f}  │ {v2_calmar:5.2f}      │")
    print(f"│ LR Optimal Sizing  │ {opt_total_return:+6.1f}% │ {opt_max_dd:6.1f}% │ {opt_sharpe:5.2f}  │ {opt_calmar:5.2f}      │")
    print(f"│ Perfect Hindsight  │ {perfect_total_return:+6.1f}% │ {perfect_max_dd:6.1f}% │   —    │   —        │")
    print(f"│ BTC Buy & Hold     │ {btc_return:+6.1f}% │ {btc_max_dd:6.1f}% │   —    │   —        │")
    print(f"└────────────────────────────────────────────────────────────────┘")
    print(f"\n  BTC: ${btc_start_price:,.0f} → ${btc_end_price:,.0f}")
    print(f"  v2 final equity: ${equity_v2[-1]:,.0f}")
    print(f"  LR optimal equity: ${equity_opt[-1]:,.0f}")
    print(f"  Perfect hindsight equity: ${equity_perfect[-1]:,.0f}")

    # ── Step 6: Save everything ─────────────────────────────────────────
    print("\n" + "=" * 70)
    print("STEP 6: Saving analysis")
    print("=" * 70)

    analysis = {
        "metadata": {
            "strategy": "MarkovRegime9v2",
            "period": "2022-04-01 to 2026-04-01",
            "total_trades": len(fp_df),
            "winners": int(len(winners)),
            "losers": int(len(losers)),
            "win_rate": round(len(winners) / len(fp_df) * 100, 1),
        },
        "feature_deltas": feature_deltas,
        "basin_win_rates": {f"C{k}": v for k, v in basin_stats.items()},
        "stable_basin_stats": {f"C{k}" if k != "-1" else "none": v for k, v in stable_stats.items()},
        "exit_reason_stats": exit_stats,
        "edge_direction": {
            "magnitude": round(float(edge_magnitude), 4),
            "vector": {col: round(float(v), 4) for col, v in zip(z_cols, edge_direction)} if edge_direction is not None else None,
            "winner_centroid": {col: round(float(v), 4) for col, v in zip(z_cols, w_centroid)} if w_centroid is not None else None,
            "loser_centroid": {col: round(float(v), 4) for col, v in zip(z_cols, l_centroid)} if l_centroid is not None else None,
        },
        "logistic_regression": {
            "accuracy": round(float(lr_accuracy) * 100, 1),
            "coefficients": {col: round(float(coef), 4) for col, coef in zip(feature_cols_model, lr.coef_[0])},
            "intercept": round(float(lr.intercept_[0]), 4),
        },
        "decision_tree": {
            "accuracy": round(float(dt_accuracy) * 100, 1),
            "rules": tree_rules,
        },
        "derived_sizing_rules": rules,
        "returns_comparison": {
            "v2_actual": {
                "total_return_pct": round(float(v2_total_return), 1),
                "max_drawdown_pct": round(float(v2_max_dd), 1),
                "sharpe": round(float(v2_sharpe), 2),
                "calmar": round(float(v2_calmar), 2),
                "final_equity": round(float(equity_v2[-1]), 0),
            },
            "lr_optimal_sizing": {
                "total_return_pct": round(float(opt_total_return), 1),
                "max_drawdown_pct": round(float(opt_max_dd), 1),
                "sharpe": round(float(opt_sharpe), 2),
                "calmar": round(float(opt_calmar), 2),
                "final_equity": round(float(equity_opt[-1]), 0),
            },
            "perfect_hindsight": {
                "total_return_pct": round(float(perfect_total_return), 1),
                "max_drawdown_pct": round(float(perfect_max_dd), 1),
                "final_equity": round(float(equity_perfect[-1]), 0),
            },
            "btc_buy_hold": {
                "total_return_pct": round(float(btc_return), 1),
                "max_drawdown_pct": round(float(btc_max_dd), 1),
                "start_price": round(float(btc_start_price), 2),
                "end_price": round(float(btc_end_price), 2),
            },
        },
    }

    with open(DATA_DIR / "fingerprint_analysis.json", "w") as f:
        json.dump(analysis, f, indent=2, default=str)
    print(f"Saved data/fingerprint_analysis.json")

    print("\n" + "=" * 70)
    print("DONE")
    print("=" * 70)


if __name__ == "__main__":
    main()
