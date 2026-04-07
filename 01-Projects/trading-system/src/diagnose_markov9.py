#!/usr/bin/env python3
"""
Diagnose why MarkovRegime9 produces zero trades in backtest.
Simulate the strategy logic offline on the actual OHLCV data.
"""

import json
import pathlib
import numpy as np
import pandas as pd
from hmmlearn.hmm import GaussianHMM

TRADING_DIR = pathlib.Path(__file__).resolve().parent.parent
DATA_DIR = TRADING_DIR / "data"
OHLCV_DIR = DATA_DIR / "ohlcv_1h"

TOKENS = ["BTC_USDT", "ETH_USDT", "SOL_USDT", "BNB_USDT", "ADA_USDT"]
MOMENTUM_WINDOW = 720
DEADBAND = 0.02
KINETIC_PERSISTENCE = 3
QUIET_PERSISTENCE = 24
HMM_TRAIN_BARS = 365 * 24

BULLISH_BASINS = {0, 2, 3, 8}
BEARISH_BASINS = {1, 4, 6, 7}
NEUTRAL_BASINS = {5}

# Load topology
with open(DATA_DIR / "normalisation_params.json") as f:
    norm_data = json.load(f)
with open(DATA_DIR / "transition_matrix.json") as f:
    trans_data = json.load(f)

norm_params = norm_data["normalisation"]
feature_order = norm_data["feature_order"]
centroids = np.zeros((9, 6))
for cid_str, centroid in norm_data["centroids"].items():
    for fi, feat in enumerate(feature_order):
        centroids[int(cid_str), fi] = centroid[feat]

trans_matrix = np.zeros((9, 9))
for key, val in trans_data["probability_matrix"].items():
    i, j = key.split("->")
    trans_matrix[int(i), int(j)] = val


def compute_indicators(df, token):
    """Compute HMM features + 6D features + basin classification."""
    h, l, c, v = df["high"], df["low"], df["close"], df["volume"]

    # HMM features
    df["log_return_raw"] = np.log(c).diff()
    df["log_return"] = np.log(c).diff(24)
    df["realized_vol"] = df["log_return_raw"].rolling(24).std() * np.sqrt(24 * 365)
    df["momentum_30d"] = np.log(c / c.shift(MOMENTUM_WINDOW))

    # 6D features
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
    tp_vol = tp * v
    vwap_24h = tp_vol.rolling(24, min_periods=1).sum() / v.rolling(24, min_periods=1).sum()
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

    sign = np.sign(c.diff())
    df["raw_obv"] = (sign * v).cumsum()

    # Z-score
    params = norm_params[token]
    raw_to_z = [("raw_atr", "atr"), ("raw_bbw", "bbw"), ("raw_rsi", "rsi"),
                ("raw_vwap_dist", "vwap_dist"), ("raw_adx", "adx"), ("raw_obv", "obv")]
    for raw_col, param_key in raw_to_z:
        mean, std = params[param_key]["mean"], params[param_key]["std"]
        df[f"{param_key}_z"] = (df[raw_col] - mean) / std if std > 0 else 0.0

    # Basin classification
    feat_cols = ["atr_z", "bbw_z", "rsi_z", "vwap_dist_z", "adx_z", "obv_z"]
    valid = df[feat_cols].notna().all(axis=1)
    df["basin"] = -1
    if valid.sum() > 0:
        X = df.loc[valid, feat_cols].values
        dists = np.linalg.norm(X[:, np.newaxis, :] - centroids[np.newaxis, :, :], axis=2)
        df.loc[valid, "basin"] = np.argmin(dists, axis=1)

    return df


def classify_hmm(df):
    """Fit K=2 HMM and return regime labels."""
    features = df[["log_return", "realized_vol"]].dropna().values
    if len(features) < 500:
        df["hmm_regime"] = "Quiet"
        return df

    train_len = min(HMM_TRAIN_BARS, len(features))
    model = GaussianHMM(n_components=2, covariance_type="full", n_iter=100, random_state=42)
    model.fit(features[-train_len:])

    valid = df[["log_return", "realized_vol"]].notna().all(axis=1)
    regimes = ["Quiet"] * len(df)
    if valid.sum() > 0:
        raw_states = model.predict(df.loc[valid, ["log_return", "realized_vol"]].values)
        kinetic_state = int(np.argmax(model.means_[:, 1]))
        state_map = {kinetic_state: "Kinetic", 1 - kinetic_state: "Quiet"}
        labels = [state_map.get(int(s), "Quiet") for s in raw_states]
        j = 0
        for i in range(len(df)):
            if valid.iloc[i]:
                regimes[i] = labels[j]
                j += 1
    df["hmm_regime"] = regimes
    return df


def apply_persistence(regimes):
    thresholds = {"Kinetic": KINETIC_PERSISTENCE, "Quiet": QUIET_PERSISTENCE}
    confirmed = list(regimes)
    current = regimes[0]
    pending_label, pending_count = current, 0

    for i in range(len(regimes)):
        raw = regimes[i]
        if raw == current:
            confirmed[i] = current
            pending_label, pending_count = current, 0
        elif raw == pending_label:
            pending_count += 1
            if pending_count >= thresholds.get(raw, 24):
                current = pending_label
            confirmed[i] = current
        else:
            pending_label, pending_count = raw, 1
            confirmed[i] = current
    return confirmed


def main():
    # Load and process all tokens
    all_dfs = {}
    for token in TOKENS:
        df = pd.read_parquet(OHLCV_DIR / f"{token}.parquet")
        df = compute_indicators(df, token)
        df = classify_hmm(df)
        df["confirmed_regime"] = apply_persistence(df["hmm_regime"].tolist())
        all_dfs[token] = df
        print(f"{token}: {len(df)} rows, basins: {df['basin'].value_counts().to_dict()}")

    # Align all tokens by timestamp
    min_len = min(len(d) for d in all_dfs.values())
    for t in TOKENS:
        all_dfs[t] = all_dfs[t].iloc[-min_len:].reset_index(drop=True)

    # Simulate gatekeeper + entry logic
    n = min_len
    risk_state = "risk_off"
    entry_count = 0
    gk_risk_on_count = 0
    basin_bullish_count = 0
    top_token_match_count = 0

    # Track per-bar state
    sample_rows = []

    for i in range(MOMENTUM_WINDOW, n):
        # Momentum per token
        momenta = {}
        regimes = {}
        basins = {}
        for token in TOKENS:
            d = all_dfs[token]
            mom = d["momentum_30d"].iloc[i]
            if not np.isnan(mom):
                momenta[token.replace("_", "/")] = mom
            regimes[token] = d["confirmed_regime"].iloc[i]
            basins[token] = int(d["basin"].iloc[i])

        if len(momenta) < 3:
            continue

        avg_mom = np.mean(list(momenta.values()))
        kinetic_count = sum(1 for r in regimes.values() if r == "Kinetic")
        hmm_consensus = "Kinetic" if kinetic_count > len(regimes) // 2 else "Quiet"

        # Gatekeeper hysteresis
        if hmm_consensus == "Quiet":
            pass
        elif risk_state == "risk_off":
            if avg_mom > DEADBAND:
                risk_state = "risk_on"
        else:
            if avg_mom < -DEADBAND:
                risk_state = "risk_off"

        if risk_state == "risk_on":
            gk_risk_on_count += 1

        top_token = max(momenta, key=momenta.get)

        # Check entry for each token
        for token in TOKENS:
            pair = token.replace("_", "/")
            basin = basins[token]

            is_top = (top_token == pair)
            is_risk_on = (risk_state == "risk_on")
            is_bullish = basin in BULLISH_BASINS
            is_neutral = basin in NEUTRAL_BASINS

            if is_top:
                top_token_match_count += 1
            if is_bullish or is_neutral:
                basin_bullish_count += 1

            if is_risk_on and is_top and (is_bullish or is_neutral):
                entry_count += 1

        # Sample a few rows for diagnosis
        if i % 5000 == 0:
            sample_rows.append({
                "idx": i,
                "timestamp": str(all_dfs["BTC_USDT"]["timestamp"].iloc[i]),
                "risk_state": risk_state,
                "hmm_consensus": hmm_consensus,
                "avg_momentum": round(avg_mom, 4),
                "top_token": top_token,
                "basins": basins,
                "regimes": {k: v for k, v in regimes.items()},
            })

    total_bars = n - MOMENTUM_WINDOW
    print(f"\n{'='*60}")
    print(f"DIAGNOSTIC SUMMARY ({total_bars} bars)")
    print(f"{'='*60}")
    print(f"  Gatekeeper Risk-On bars:       {gk_risk_on_count:>7} ({gk_risk_on_count/total_bars*100:.1f}%)")
    print(f"  Top-token match bars:          {top_token_match_count:>7} ({top_token_match_count/total_bars*100:.1f}%)")
    print(f"  Bullish/neutral basin bars:    {basin_bullish_count:>7} ({basin_bullish_count/total_bars*100:.1f}%)")
    print(f"  All conditions met (entries):  {entry_count:>7} ({entry_count/total_bars*100:.1f}%)")

    # HMM regime distribution
    print(f"\n  HMM regime distribution (BTC):")
    btc = all_dfs["BTC_USDT"]
    for regime in ["Kinetic", "Quiet"]:
        count = (btc["confirmed_regime"] == regime).sum()
        print(f"    {regime}: {count} ({count/len(btc)*100:.1f}%)")

    # Basin distribution
    print(f"\n  Basin distribution (all tokens combined):")
    all_basins = pd.concat([d["basin"] for d in all_dfs.values()])
    for basin_id in sorted(all_basins.unique()):
        count = (all_basins == basin_id).sum()
        label = "bullish" if basin_id in BULLISH_BASINS else "bearish" if basin_id in BEARISH_BASINS else "neutral"
        print(f"    C{basin_id} ({label}): {count:>8} ({count/len(all_basins)*100:.1f}%)")

    print(f"\n  Sample rows:")
    for row in sample_rows:
        print(f"    {row['timestamp']}: risk={row['risk_state']}, hmm={row['hmm_consensus']}, "
              f"avg_mom={row['avg_momentum']}, top={row['top_token']}, "
              f"basins={row['basins']}")


if __name__ == "__main__":
    main()
