"""
Expanded Roster Comparison — v6.2c vs Markov v3 across multiple token baskets.

Runs the custom Python backtester (DualMomentumAllocator) with and without
K=9 sizing modulator on multiple roster configurations for apples-to-apples
comparison.
"""

import json
import math
import sys
from collections import Counter, deque
from pathlib import Path

sys.stdout.reconfigure(line_buffering=True)

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))

from features.price_native import compute_price_native_features
from classifier.hmm_regime import HMMRegimeClassifier
from strategy.dual_momentum import DualMomentumAllocator

DATA_DIR = Path(__file__).parent.parent / "data"
RESULTS_PATH = DATA_DIR / "expanded_roster_comparison.json"

# ---------------------------------------------------------------------------
# Token universes
# ---------------------------------------------------------------------------

ALL_TOKEN_FILES = {
    "BTC": "btc_ohlcv_1h_extended.csv",
    "ETH": "eth_ohlcv_1h.csv",
    "SOL": "sol_ohlcv_1h.csv",
    "BNB": "bnb_ohlcv_1h.csv",
    "ADA": "ada_ohlcv_1h.csv",
    "DOGE": "doge_ohlcv_1h.csv",
    "XRP": "xrp_ohlcv_1h.csv",
    "LINK": "link_ohlcv_1h.csv",
    "AVAX": "avax_ohlcv_1h.csv",
    "DOT": "dot_ohlcv_1h.csv",
    "NEAR": "near_ohlcv_1h.csv",
    "SUI": "sui_ohlcv_1h.csv",
}

ROSTERS = {
    "original_5": ["BTC", "ETH", "SOL", "BNB", "ADA"],
    "purified_4": ["BTC", "BNB", "DOGE", "XRP"],
    "expanded_7": ["BTC", "BNB", "DOGE", "XRP", "LINK", "SOL", "AVAX"],
}

# ---------------------------------------------------------------------------
# HMM + backtest params (matching v6.2c exactly)
# ---------------------------------------------------------------------------

TRAIN_BARS = 365 * 24
TEST_BARS = 180 * 24
PERSISTENCE_THRESHOLDS = {"Kinetic": 3, "Quiet": 24}
DEADBAND = 0.02
MOMENTUM_WINDOW = 720

# ---------------------------------------------------------------------------
# K=9 topology + Markov v3 params
# ---------------------------------------------------------------------------

with open(DATA_DIR / "transition_matrix.json") as f:
    _trans_data = json.load(f)
TRANS_MATRIX = np.zeros((9, 9))
for key, val in _trans_data["probability_matrix"].items():
    i, j = key.split("->")
    TRANS_MATRIX[int(i), int(j)] = val

with open(DATA_DIR / "normalisation_params.json") as f:
    _norm_data = json.load(f)
NORM_PARAMS = _norm_data["normalisation"]
FEATURE_ORDER = _norm_data["feature_order"]
CENTROIDS = np.zeros((len(_norm_data["centroids"]), len(FEATURE_ORDER)))
for cid_str, centroid in _norm_data["centroids"].items():
    for fi, feat in enumerate(FEATURE_ORDER):
        CENTROIDS[int(cid_str), fi] = centroid[feat]

BULLISH_BASINS = {0, 2, 8}
BEARISH_BASINS = {1, 4, 6, 7}
BLACKLIST_BASINS = {3}
FORCE_FLAT_BASIN = 1
FLICKER_WINDOW = 12
PERSISTENCE_THRESHOLD = 3
FLICKER_DECAY_RATE = 0.5
SIZING_FLOOR = 0.1
SIZING_CEILING = 1.0
C1_DRAWDOWN_CAP = 0.15
HEAT_PENALTY_RATE = 0.3
HEAT_PENALTY_FLOOR = 0.3
MOMENTUM_BONUS_RATE = 0.15
MOMENTUM_BONUS_CAP = 1.2

# Basin-pair blacklist from affinity analysis
BASIN_PAIR_BLACKLIST = {
    6: {"AVAX"},  # AVAX in C6: -0.41% fwd
}

# Leverage thresholds
LEVERAGE_HIGH_THRESHOLD = 0.8
LEVERAGE_MED_THRESHOLD = 0.5
LEVERAGE_HIGH_MULT = 2.0
LEVERAGE_MED_MULT = 1.5
LEVERAGE_LOW_MULT = 1.0


# ---------------------------------------------------------------------------
# Data loading + HMM regime classification
# ---------------------------------------------------------------------------

def load_data(token: str) -> pd.DataFrame:
    path = DATA_DIR / ALL_TOKEN_FILES[token]
    df = pd.read_csv(path, parse_dates=["timestamp"])
    df = df.sort_values("timestamp").reset_index(drop=True)
    df.set_index("timestamp", inplace=True)
    return df


def walk_forward_classify(features: np.ndarray) -> list[str]:
    n = len(features)
    regimes = ["Quiet"] * n
    start = 0
    fold = 0
    while start + TRAIN_BARS < n:
        fold += 1
        train_end = start + TRAIN_BARS
        test_end = min(train_end + TEST_BARS, n)
        clf = HMMRegimeClassifier(n_states=2, n_iter=100)
        clf.fit(features[start:train_end])
        for j, label in enumerate(clf.predict(features[train_end:test_end])):
            regimes[train_end + j] = label
        start += TEST_BARS
    return regimes


def apply_persistence_filter(regimes: list[str]) -> list[str]:
    confirmed = list(regimes)
    current = regimes[0]
    pending = current
    pending_count = 0
    for i in range(len(regimes)):
        raw = regimes[i]
        if raw == current:
            confirmed[i] = current
            pending = current
            pending_count = 0
        elif raw == pending:
            pending_count += 1
            if pending_count >= PERSISTENCE_THRESHOLDS.get(raw, 24):
                current = pending
            confirmed[i] = current
        else:
            pending = raw
            pending_count = 1
            confirmed[i] = current
    return confirmed


# ---------------------------------------------------------------------------
# 6D features + basin classification for new tokens
# ---------------------------------------------------------------------------

def compute_6d_features_for_token(df: pd.DataFrame, token: str) -> pd.DataFrame:
    """Compute 6D features and Z-score. Uses existing norm params for original 5,
    computes per-token Z-scores for new tokens."""
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

    # Z-score normalization
    pair_key = f"{token}_USDT"
    raw_keys = [("raw_atr", "atr", "atr_z"), ("raw_bbw", "bbw", "bbw_z"),
                ("raw_rsi", "rsi", "rsi_z"), ("raw_vwap_dist", "vwap_dist", "vwap_dist_z"),
                ("raw_adx", "adx", "adx_z"), ("raw_obv", "obv", "obv_z")]

    if pair_key in NORM_PARAMS:
        # Use existing normalisation for original 5
        params = NORM_PARAMS[pair_key]
        for raw, key, z in raw_keys:
            m, s = params[key]["mean"], params[key]["std"]
            df[z] = (df[raw] - m) / s if s > 0 else 0.0
    else:
        # Per-token Z-score for new tokens
        for raw, key, z in raw_keys:
            m = df[raw].mean()
            s = df[raw].std()
            df[z] = (df[raw] - m) / s if s > 0 else 0.0

    return df


def classify_basins(df: pd.DataFrame) -> pd.Series:
    feat_cols = ["atr_z", "bbw_z", "rsi_z", "vwap_dist_z", "adx_z", "obv_z"]
    basin = pd.Series(-1, index=df.index, dtype=int)
    valid = df[feat_cols].notna().all(axis=1)
    if valid.sum() == 0:
        return basin
    X = df.loc[valid, feat_cols].values
    dists = np.linalg.norm(X[:, np.newaxis, :] - CENTROIDS[np.newaxis, :, :], axis=2)
    basin.loc[valid] = np.argmin(dists, axis=1)
    return basin


def compute_sizing_series(basins: np.ndarray, atr_z: np.ndarray, rsi_z: np.ndarray) -> np.ndarray:
    """Compute Markov v3 sizing scalar series."""
    n = len(basins)
    scalars = np.ones(n)
    history = deque(maxlen=FLICKER_WINDOW)

    for i in range(n):
        basin = int(basins[i])
        history.append(basin)

        if basin < 0:
            scalars[i] = 1.0
            continue

        # Flicker count
        hist_list = list(history)
        flicker = sum(1 for j in range(1, len(hist_list)) if hist_list[j] != hist_list[j - 1])

        # Stable basin check
        stable = -1
        if len(hist_list) >= PERSISTENCE_THRESHOLD:
            run_len = 1
            for j in range(len(hist_list) - 2, -1, -1):
                if hist_list[j] == hist_list[-1]:
                    run_len += 1
                else:
                    break
            if run_len >= PERSISTENCE_THRESHOLD:
                stable = hist_list[-1]

        # Markov confidence
        row = TRANS_MATRIX[basin]
        opp = sum(row[b] for b in BULLISH_BASINS)
        crash = sum(row[b] for b in BEARISH_BASINS)
        total = opp + crash
        markov_conf = (opp / total) if total > 0 else 0.5

        # Flicker penalty
        flicker_penalty = math.exp(-FLICKER_DECAY_RATE * flicker)

        scalar = markov_conf * flicker_penalty
        scalar = max(SIZING_FLOOR, min(SIZING_CEILING, scalar))

        # C1 cap
        if stable == FORCE_FLAT_BASIN:
            scalar = min(scalar, C1_DRAWDOWN_CAP)

        # Quiet grind filter
        a = atr_z[i] if not np.isnan(atr_z[i]) else 0.0
        r = rsi_z[i] if not np.isnan(rsi_z[i]) else 0.0
        heat_penalty = max(HEAT_PENALTY_FLOOR, 1.0 - HEAT_PENALTY_RATE * max(0, a))
        momentum_bonus = min(MOMENTUM_BONUS_CAP, 1.0 + MOMENTUM_BONUS_RATE * max(0, r))
        kinematic = heat_penalty * momentum_bonus
        scalar = max(SIZING_FLOOR, min(SIZING_CEILING, scalar * kinematic))

        scalars[i] = scalar

    return scalars


# ---------------------------------------------------------------------------
# Modified DualMomentumAllocator with K=9 sizing
# ---------------------------------------------------------------------------

class MarkovV3Allocator:
    """v6.2c allocator + K=9 sizing modulator + C3 blacklist + basin-pair blacklist."""

    def __init__(self, deadband=0.02, momentum_window=720,
                 rebalance_bars=168, switch_threshold=0.05,
                 use_leverage=False, use_basin_pair_blacklist=False):
        self.deadband = deadband
        self.momentum_window = momentum_window
        self.rebalance_bars = rebalance_bars
        self.switch_threshold = switch_threshold
        self.use_leverage = use_leverage
        self.use_basin_pair_blacklist = use_basin_pair_blacklist

    def run(self, token_data, token_regimes, token_basins, token_scalars,
            initial_capital=10_000.0):
        tokens = sorted(token_data.keys())
        common_idx = token_data[tokens[0]].index
        for t in tokens[1:]:
            common_idx = common_idx.intersection(token_data[t].index)
        common_idx = common_idx.sort_values()
        n = len(common_idx)

        prices = {}
        regimes = {}
        basins = {}
        scalars = {}
        for t in tokens:
            df = token_data[t].loc[common_idx]
            prices[t] = df["close"].values.astype(np.float64)
            full_regime = token_regimes[t]
            idx_map = {ts: i for i, ts in enumerate(token_data[t].index)}
            regimes[t] = [full_regime[idx_map[ts]] for ts in common_idx]
            # Map basins and scalars to common index
            full_basins = token_basins[t]
            full_scalars = token_scalars[t]
            basins[t] = np.array([int(full_basins.iloc[idx_map[ts]]) if ts in idx_map else -1
                                  for ts in common_idx])
            scalars[t] = np.array([float(full_scalars[idx_map[ts]]) if ts in idx_map else 1.0
                                   for ts in common_idx])

        equity = initial_capital
        equity_curve = np.zeros(n)
        held_token = None
        held_scalar = 1.0
        cash_fraction = 0.0  # fraction held in cash when sizing < 1.0
        trades = []
        bars_in_market = 0
        risk_state = "risk_off"

        # Per-token P&L tracking
        token_pnl = {t: 0.0 for t in tokens}
        entry_equity = 0.0

        for i in range(n):
            # Update equity
            if held_token is not None:
                if i > 0:
                    ret = prices[held_token][i] / prices[held_token][i - 1]
                    invested_fraction = held_scalar
                    new_equity = equity * (cash_fraction + invested_fraction * ret)
                    # Prevent numerical explosion
                    if np.isfinite(new_equity) and new_equity > 0:
                        equity = new_equity
                    else:
                        equity = max(equity * 0.01, 1.0)  # floor at near-zero
                bars_in_market += 1

            equity_curve[i] = equity

            # Consensus regime
            kinetic_count = sum(1 for t in tokens if regimes[t][i] == "Kinetic")
            is_kinetic = kinetic_count > len(tokens) // 2

            # Momenta
            if i >= self.momentum_window:
                momenta = {t: np.log(prices[t][i] / prices[t][i - self.momentum_window]) for t in tokens}
                avg_momentum = np.mean(list(momenta.values()))
            else:
                momenta = {t: 0.0 for t in tokens}
                avg_momentum = 0.0

            # Gatekeeper
            if not is_kinetic:
                continue

            prev_risk_state = risk_state
            if risk_state == "risk_off":
                if avg_momentum > self.deadband:
                    risk_state = "risk_on"
            else:
                if avg_momentum < -self.deadband:
                    risk_state = "risk_off"

            if risk_state == "risk_off":
                if held_token is not None:
                    pnl = equity - entry_equity
                    token_pnl[held_token] += pnl
                    trades.append({
                        "bar": i, "timestamp": str(common_idx[i]),
                        "action": "sell", "token": held_token,
                        "reason": "gate_closed", "equity": equity,
                        "pnl": pnl,
                    })
                    held_token = None
                    held_scalar = 1.0
                    cash_fraction = 0.0
                continue

            # Layer 2: Funnel
            if i < self.momentum_window:
                continue

            best = max(momenta, key=momenta.get)

            # C3 blacklist
            if int(basins[best][i]) in BLACKLIST_BASINS:
                # Find next best not in blacklist
                sorted_mom = sorted(momenta.items(), key=lambda x: -x[1])
                best = None
                for t, m in sorted_mom:
                    if int(basins[t][i]) not in BLACKLIST_BASINS:
                        best = t
                        break
                if best is None:
                    continue

            # Basin-pair blacklist
            if self.use_basin_pair_blacklist:
                basin_val = int(basins[best][i])
                if basin_val in BASIN_PAIR_BLACKLIST and best in BASIN_PAIR_BLACKLIST[basin_val]:
                    sorted_mom = sorted(momenta.items(), key=lambda x: -x[1])
                    for t, m in sorted_mom:
                        b = int(basins[t][i])
                        if b not in BLACKLIST_BASINS:
                            if b not in BASIN_PAIR_BLACKLIST or t not in BASIN_PAIR_BLACKLIST[b]:
                                best = t
                                break

            should_rebalance = (i % self.rebalance_bars == 0) or held_token is None

            if not should_rebalance:
                # Still update sizing scalar for held token
                if held_token is not None:
                    new_scalar = float(scalars[held_token][i])
                    new_scalar = max(SIZING_FLOOR, min(SIZING_CEILING, new_scalar))
                    if self.use_leverage:
                        if new_scalar >= LEVERAGE_HIGH_THRESHOLD:
                            new_scalar *= LEVERAGE_HIGH_MULT
                        elif new_scalar >= LEVERAGE_MED_THRESHOLD:
                            new_scalar *= LEVERAGE_MED_MULT
                    held_scalar = min(new_scalar, SIZING_CEILING if not self.use_leverage else 2.0)
                    cash_fraction = max(0, 1.0 - held_scalar)
                continue

            should_switch = (best != held_token)
            if should_switch and held_token is not None and held_token in momenta:
                advantage = momenta[best] - momenta[held_token]
                if advantage < self.switch_threshold:
                    should_switch = False

            if should_switch:
                if held_token is not None:
                    pnl = equity - entry_equity
                    token_pnl[held_token] += pnl
                    trades.append({
                        "bar": i, "timestamp": str(common_idx[i]),
                        "action": "sell", "token": held_token,
                        "reason": "rotation", "equity": equity,
                        "pnl": pnl,
                    })

                # Compute sizing scalar for new position
                scalar = float(scalars[best][i])
                scalar = max(SIZING_FLOOR, min(SIZING_CEILING, scalar))

                if self.use_leverage:
                    if scalar >= LEVERAGE_HIGH_THRESHOLD:
                        scalar *= LEVERAGE_HIGH_MULT
                    elif scalar >= LEVERAGE_MED_THRESHOLD:
                        scalar *= LEVERAGE_MED_MULT

                held_token = best
                held_scalar = min(scalar, SIZING_CEILING if not self.use_leverage else 2.0)
                cash_fraction = max(0, 1.0 - held_scalar)
                entry_equity = equity

                trades.append({
                    "bar": i, "timestamp": str(common_idx[i]),
                    "action": "buy", "token": best,
                    "basin": int(basins[best][i]),
                    "sizing_scalar": round(held_scalar, 4),
                    "price": float(prices[best][i]),
                    "momentum": float(momenta[best]),
                    "equity": equity,
                })

        # Final close
        if held_token is not None:
            pnl = equity - entry_equity
            token_pnl[held_token] += pnl

        # Metrics
        total_return = equity / initial_capital - 1.0
        years = n / (24 * 365)
        cagr = (equity / initial_capital) ** (1 / years) - 1.0 if years > 0 else 0.0

        running_max = np.maximum.accumulate(equity_curve)
        drawdowns = (equity_curve - running_max) / running_max
        max_dd = float(np.min(drawdowns))

        daily_eq = equity_curve[::24]
        daily_rets = np.diff(np.log(np.maximum(daily_eq, 1e-12)))
        sharpe = float(np.mean(daily_rets) / np.std(daily_rets) * np.sqrt(365)) if np.std(daily_rets) > 0 else 0.0
        calmar = cagr / abs(max_dd) if max_dd != 0 else 0.0
        pct_in_market = bars_in_market / n if n > 0 else 0.0

        # Win rate
        buy_trades = [t for t in trades if t["action"] == "buy"]
        sell_trades = [t for t in trades if t["action"] == "sell"]
        wins = sum(1 for t in sell_trades if t.get("pnl", 0) > 0)
        win_rate = wins / len(sell_trades) * 100 if sell_trades else 0

        annual_returns = {}
        timestamps = pd.DatetimeIndex(common_idx)
        for yr in range(timestamps[0].year, timestamps[-1].year + 1):
            mask = timestamps.year == yr
            if mask.sum() < 48:
                continue
            year_eq = equity_curve[mask]
            annual_returns[str(yr)] = float(year_eq[-1] / year_eq[0] - 1.0)

        bnh = {t: float(prices[t][-1] / prices[t][0] - 1.0) for t in tokens}
        # BTC B&H
        btc_bnh = float(prices["BTC"][-1] / prices["BTC"][0] - 1.0) if "BTC" in prices else 0

        return {
            "total_return": total_return,
            "cagr": cagr,
            "max_drawdown": max_dd,
            "sharpe": sharpe,
            "calmar": calmar,
            "n_trades": len(buy_trades),
            "win_rate": round(win_rate, 1),
            "pct_in_market": pct_in_market,
            "years": years,
            "final_equity": equity,
            "annual_returns": annual_returns,
            "buy_and_hold": bnh,
            "btc_buy_hold": btc_bnh,
            "token_pnl": {t: round(v, 2) for t, v in token_pnl.items()},
            "trades": trades,
            "equity_curve": equity_curve.tolist(),
            "period": f"{common_idx[0]} to {common_idx[-1]}",
            "n_bars": n,
        }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("=" * 80)
    print("EXPANDED ROSTER COMPARISON — v6.2c vs Markov v3")
    print("=" * 80)

    # Step 1: Load all token data and classify HMM regimes
    all_data = {}
    all_regimes = {}
    all_basins = {}
    all_scalars = {}

    tokens_needed = set()
    for roster in ROSTERS.values():
        tokens_needed.update(roster)

    for token in sorted(tokens_needed):
        print(f"\n>>> Loading {token}...")
        data = load_data(token)
        all_data[token] = data
        print(f"    {len(data)} bars: {data.index[0]} to {data.index[-1]}")

        # HMM regime classification
        features = compute_price_native_features(data)
        feat_arr = features[["log_return", "realized_vol"]].values
        raw_regimes = walk_forward_classify(feat_arr)
        regimes = apply_persistence_filter(raw_regimes)
        all_regimes[token] = regimes

        counts = Counter(regimes)
        total = len(regimes)
        print(f"    Kinetic: {counts.get('Kinetic',0)/total*100:.1f}%  "
              f"Quiet: {counts.get('Quiet',0)/total*100:.1f}%")

        # 6D features + basin classification
        data_feat = compute_6d_features_for_token(data.copy(), token)
        basin_series = classify_basins(data_feat)
        all_basins[token] = basin_series

        atr_z = data_feat["atr_z"].values
        rsi_z = data_feat["rsi_z"].values
        sizing = compute_sizing_series(basin_series.values, atr_z, rsi_z)
        all_scalars[token] = sizing

        basin_counts = basin_series[basin_series >= 0].value_counts().sort_index()
        total_valid = basin_counts.sum()
        top3 = basin_counts.nlargest(3)
        print(f"    Top basins: " + ", ".join(f"C{b}={c/total_valid*100:.1f}%" for b, c in top3.items()))

    # Step 2: Run configurations
    results = {
        "metadata": {
            "analysis": "Expanded Roster Comparison — v6.2c vs Markov v3",
            "date": "2026-04-07",
            "rosters": {k: v for k, v in ROSTERS.items()},
        },
        "configurations": {},
    }

    configs = []
    for roster_name, tokens in ROSTERS.items():
        # Find common date ranges
        common_idx_full = all_data[tokens[0]].index
        for t in tokens[1:]:
            common_idx_full = common_idx_full.intersection(all_data[t].index)
        common_idx_full = common_idx_full.sort_values()

        full_start = common_idx_full[0]
        full_end = common_idx_full[-1]

        # 2022-04 start
        start_2022 = pd.Timestamp("2022-04-01", tz="UTC")
        end_2026 = pd.Timestamp("2026-04-01", tz="UTC")

        configs.append((roster_name, "full", tokens, None, None))
        configs.append((roster_name, "2022-2026", tokens, start_2022, end_2026))

    for roster_name, period_label, tokens, start_ts, end_ts in configs:
        config_key = f"{roster_name}_{period_label}"
        print(f"\n{'='*80}")
        print(f"CONFIG: {roster_name} / {period_label} — tokens: {tokens}")
        print(f"{'='*80}")

        # Subset data to period
        subset_data = {}
        subset_regimes = {}
        subset_basins = {}
        subset_scalars = {}

        for t in tokens:
            d = all_data[t]
            if start_ts is not None:
                d = d[d.index >= start_ts]
            if end_ts is not None:
                d = d[d.index <= end_ts]
            subset_data[t] = d

            # Regimes need to be mapped to the subset
            full_idx = all_data[t].index
            idx_map = {ts: i for i, ts in enumerate(full_idx)}
            subset_regimes[t] = [all_regimes[t][idx_map[ts]] for ts in d.index if ts in idx_map]

            # Basins and scalars
            subset_basins[t] = all_basins[t].loc[d.index]
            full_scalars = all_scalars[t]
            subset_scalars[t] = np.array([full_scalars[idx_map[ts]] if ts in idx_map else 1.0
                                          for ts in d.index])

        # --- v6.2c run ---
        print(f"  Running v6.2c...")
        v62c_allocator = DualMomentumAllocator(
            momentum_window=MOMENTUM_WINDOW, rebalance_bars=168,
            switch_threshold=0.05, deadband=DEADBAND,
        )
        v62c_result = v62c_allocator.run(subset_data, subset_regimes, initial_capital=10_000.0)

        # --- Markov v3 run ---
        print(f"  Running Markov v3...")
        v3_allocator = MarkovV3Allocator(
            deadband=DEADBAND, momentum_window=MOMENTUM_WINDOW,
            rebalance_bars=168, switch_threshold=0.05,
            use_leverage=False, use_basin_pair_blacklist=(roster_name == "expanded_7"),
        )
        v3_result = v3_allocator.run(
            subset_data, subset_regimes, subset_basins, subset_scalars,
            initial_capital=10_000.0,
        )

        # --- Markov v3 + leverage run ---
        print(f"  Running Markov v3 + leverage...")
        v3_lev_allocator = MarkovV3Allocator(
            deadband=DEADBAND, momentum_window=MOMENTUM_WINDOW,
            rebalance_bars=168, switch_threshold=0.05,
            use_leverage=True, use_basin_pair_blacklist=(roster_name == "expanded_7"),
        )
        v3_lev_result = v3_lev_allocator.run(
            subset_data, subset_regimes, subset_basins, subset_scalars,
            initial_capital=10_000.0,
        )

        # Compute BTC B&H for this period
        btc_prices = subset_data["BTC"]["close"]
        btc_bh = float(btc_prices.iloc[-1] / btc_prices.iloc[0] - 1.0)

        # Derive period from common index
        common_idx_for_config = subset_data[tokens[0]].index
        for t in tokens[1:]:
            common_idx_for_config = common_idx_for_config.intersection(subset_data[t].index)
        common_idx_for_config = common_idx_for_config.sort_values()
        period_str = f"{common_idx_for_config[0]} to {common_idx_for_config[-1]}"

        config_result = {
            "roster": tokens,
            "period": period_str,
            "years": round(v62c_result["years"], 2),
            "v62c": {
                "total_return_pct": round(v62c_result["total_return"] * 100, 1),
                "max_drawdown_pct": round(v62c_result["max_drawdown"] * 100, 1),
                "sharpe": round(v62c_result["sharpe"], 3),
                "calmar": round(v62c_result["calmar"], 3),
                "cagr_pct": round(v62c_result["cagr"] * 100, 1),
                "n_trades": v62c_result["n_trades"],
                "final_equity": round(v62c_result["final_equity"], 0),
                "annual_returns": {k: round(v * 100, 1) for k, v in v62c_result["annual_returns"].items()},
            },
            "markov_v3": {
                "total_return_pct": round(v3_result["total_return"] * 100, 1),
                "max_drawdown_pct": round(v3_result["max_drawdown"] * 100, 1),
                "sharpe": round(v3_result["sharpe"], 3),
                "calmar": round(v3_result["calmar"], 3),
                "cagr_pct": round(v3_result["cagr"] * 100, 1),
                "n_trades": v3_result["n_trades"],
                "win_rate": v3_result["win_rate"],
                "final_equity": round(v3_result["final_equity"], 0),
                "token_pnl": v3_result["token_pnl"],
                "annual_returns": {k: round(v * 100, 1) for k, v in v3_result["annual_returns"].items()},
            },
            "markov_v3_leveraged": {
                "total_return_pct": round(v3_lev_result["total_return"] * 100, 1),
                "max_drawdown_pct": round(v3_lev_result["max_drawdown"] * 100, 1),
                "sharpe": round(v3_lev_result["sharpe"], 3),
                "calmar": round(v3_lev_result["calmar"], 3),
                "cagr_pct": round(v3_lev_result["cagr"] * 100, 1),
                "n_trades": v3_lev_result["n_trades"],
                "final_equity": round(v3_lev_result["final_equity"], 0),
                "annual_returns": {k: round(v * 100, 1) for k, v in v3_lev_result["annual_returns"].items()},
            },
            "btc_buy_hold_pct": round(btc_bh * 100, 1),
        }

        results["configurations"][config_key] = config_result

        # Print summary
        print(f"\n  {'Metric':<20s} | {'v6.2c':>12s} | {'Markov v3':>12s} | {'v3+Lev':>12s} | {'BTC B&H':>12s}")
        print(f"  {'-'*75}")
        print(f"  {'Return':.<20s} | {config_result['v62c']['total_return_pct']:>+11.1f}% | {config_result['markov_v3']['total_return_pct']:>+11.1f}% | {config_result['markov_v3_leveraged']['total_return_pct']:>+11.1f}% | {config_result['btc_buy_hold_pct']:>+11.1f}%")
        print(f"  {'Max DD':.<20s} | {config_result['v62c']['max_drawdown_pct']:>11.1f}% | {config_result['markov_v3']['max_drawdown_pct']:>11.1f}% | {config_result['markov_v3_leveraged']['max_drawdown_pct']:>11.1f}% |")
        print(f"  {'Sharpe':.<20s} | {config_result['v62c']['sharpe']:>12.3f} | {config_result['markov_v3']['sharpe']:>12.3f} | {config_result['markov_v3_leveraged']['sharpe']:>12.3f} |")
        print(f"  {'Calmar':.<20s} | {config_result['v62c']['calmar']:>12.3f} | {config_result['markov_v3']['calmar']:>12.3f} | {config_result['markov_v3_leveraged']['calmar']:>12.3f} |")
        print(f"  {'CAGR':.<20s} | {config_result['v62c']['cagr_pct']:>+11.1f}% | {config_result['markov_v3']['cagr_pct']:>+11.1f}% | {config_result['markov_v3_leveraged']['cagr_pct']:>+11.1f}% |")
        print(f"  {'Trades':.<20s} | {config_result['v62c']['n_trades']:>12d} | {config_result['markov_v3']['n_trades']:>12d} | {config_result['markov_v3_leveraged']['n_trades']:>12d} |")

    # Step 3: Per-token contribution for expanded_7
    print(f"\n{'='*80}")
    print("PER-TOKEN P&L CONTRIBUTION — Expanded 7 / 2022-2026")
    print(f"{'='*80}")

    exp7_key = "expanded_7_2022-2026"
    if exp7_key in results["configurations"]:
        pnl = results["configurations"][exp7_key]["markov_v3"]["token_pnl"]
        total_pnl = sum(pnl.values())
        sorted_pnl = sorted(pnl.items(), key=lambda x: -x[1])
        for token, p in sorted_pnl:
            pct = p / abs(total_pnl) * 100 if total_pnl != 0 else 0
            bar = "+" * int(abs(pct) / 5) if p > 0 else "-" * int(abs(pct) / 5)
            print(f"  {token:>5s}: ${p:>+10.2f}  ({pct:>+6.1f}%)  {bar}")

    # Step 4: Grand comparison table
    print(f"\n{'='*100}")
    print("GRAND COMPARISON TABLE")
    print(f"{'='*100}")
    print(f"  {'Config':<25s} | {'Period':>9s} | {'v6.2c Ret':>10s} | {'v6.2c DD':>9s} | {'v3 Ret':>10s} | {'v3 DD':>9s} | {'v3 Calmar':>9s} | {'v3+Lev Ret':>10s} | {'BTC B&H':>9s}")
    print(f"  {'-'*107}")

    for config_key in sorted(results["configurations"].keys()):
        c = results["configurations"][config_key]
        parts = config_key.split("_", 2)
        name = "_".join(parts[:-1])
        period = parts[-1]
        print(f"  {name:<25s} | {period:>9s} | {c['v62c']['total_return_pct']:>+9.1f}% | {c['v62c']['max_drawdown_pct']:>8.1f}% | {c['markov_v3']['total_return_pct']:>+9.1f}% | {c['markov_v3']['max_drawdown_pct']:>8.1f}% | {c['markov_v3']['calmar']:>9.3f} | {c['markov_v3_leveraged']['total_return_pct']:>+9.1f}% | {c['btc_buy_hold_pct']:>+8.1f}%")

    # Save (strip equity curves and trades to keep file reasonable)
    save_results = json.loads(json.dumps(results, default=str))
    with open(RESULTS_PATH, "w") as f:
        json.dump(save_results, f, indent=2)
    print(f"\nSaved to {RESULTS_PATH}")


if __name__ == "__main__":
    main()
