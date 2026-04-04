#!/usr/bin/env python3
"""
Multi-Timeframe D/I/R Regime Analysis — BTC

Runs D/I/R regime classifier across three timeframes:
  1. Macro  (daily, 30-day window)
  2. Meso   (daily, 7-day window)
  3. Micro  (hourly, 72h window)

Then computes cross-timeframe alignment signals and forward returns.

Reuses existing pipeline: indicators.py, vectorizer.py, phase_b logic.
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans

# Project imports
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.features.indicators import (
    compute_all_features, D_FEATURES, I_FEATURES, R_FEATURES,
    realized_vol, atr_ratio, new_extremes, range_expansion,
    mean_reversion, vwap_proximity, band_compression,
    autocorr, momentum_persist,
)
from src.features.vectorizer import vectorize_pipeline

DATA_DIR = PROJECT_ROOT / "data"

REGIME_COLORS = {"D": "#e74c3c", "I": "#3498db", "R": "#f39c12"}
REGIME_NAMES = {
    "D": "Trending/Breakout",
    "I": "Mean-Reverting/Consolidation",
    "R": "Reflexive/Volatile",
}


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

def load_daily() -> pd.DataFrame:
    path = DATA_DIR / "btc_1d_full.csv"
    df = pd.read_csv(path)
    df["timestamp"] = pd.to_datetime(df["open_time"])
    df = df.set_index("timestamp")
    df = df[["open", "high", "low", "close", "volume"]].astype(float)
    print(f"[DATA] Loaded {len(df)} daily candles ({df.index[0]} to {df.index[-1]})")
    return df


def load_hourly() -> pd.DataFrame:
    path = DATA_DIR / "btc_1h_full.csv"
    df = pd.read_csv(path)
    df["timestamp"] = pd.to_datetime(df["open_time"])
    df = df.set_index("timestamp")
    df = df[["open", "high", "low", "close", "volume"]].astype(float)
    print(f"[DATA] Loaded {len(df)} hourly candles ({df.index[0]} to {df.index[-1]})")
    return df


# ---------------------------------------------------------------------------
# Fast feature computation (skip GARCH and Hurst for speed on large datasets)
# ---------------------------------------------------------------------------

def compute_features_fast(df: pd.DataFrame, n: int) -> pd.DataFrame:
    """
    Compute 12 D/I/R features with speed-optimized substitutions.

    For hurst_mr and hurst_persist: use autocorrelation proxy.
    For vol_clustering: always use vol_autocorr fallback instead of GARCH.
    All min_periods capped to window size for small windows (n=7).
    """
    o, h, l, c, v = df["open"], df["high"], df["low"], df["close"], df["volume"]
    features = pd.DataFrame(index=df.index)
    lr = np.log(c / c.shift(1))
    mp = min(n, max(2, n // 2))  # safe min_periods

    # D-axis (all fast, min_periods already safe in these functions)
    features["realized_vol"] = realized_vol(c, n)
    features["atr_ratio"] = atr_ratio(h, l, c, n)
    features["new_extremes"] = new_extremes(h, l, n)
    features["range_expansion"] = range_expansion(h, l, n)

    # I-axis — reimplemented inline for safe min_periods
    # mean_reversion: -autocorr(lag=1), clipped >= 0
    ac = lr.rolling(n, min_periods=mp).apply(
        lambda x: pd.Series(x).autocorr(lag=1) if len(x) > 1 else 0.0,
        raw=False,
    )
    features["mean_reversion"] = (-ac).clip(lower=0.0)

    features["hurst_mr"] = lr.rolling(n, min_periods=mp).apply(
        _fast_hurst_mr, raw=True
    ).fillna(0.0)

    features["vwap_proximity"] = vwap_proximity(c, v, h, l, n)
    features["band_compression"] = band_compression(c, n)

    # R-axis — reimplemented inline for safe min_periods
    features["autocorr"] = ac.clip(lower=0.0)

    features["hurst_persist"] = lr.rolling(n, min_periods=mp).apply(
        _fast_hurst_persist, raw=True
    ).fillna(0.0)

    features["vol_clustering"] = lr.rolling(n, min_periods=mp).apply(
        _vol_autocorr_fallback, raw=True
    ).fillna(0.0)

    # momentum_persist: serial return correlation, clipped >= 0
    features["momentum_persist"] = lr.rolling(n, min_periods=mp).apply(
        lambda x: max(0.0, np.corrcoef(x[:-1], x[1:])[0, 1]) if len(x) >= 5 and np.isfinite(np.corrcoef(x[:-1], x[1:])[0, 1]) else 0.0,
        raw=True,
    ).fillna(0.0)

    return features


def _fast_hurst_mr(x: np.ndarray) -> float:
    """Fast anti-persistence proxy using lag-1 autocorrelation."""
    x = np.asarray(x, dtype=float)
    x = x[np.isfinite(x)]
    if len(x) < 10:
        return 0.0
    corr = np.corrcoef(x[:-1], x[1:])[0, 1]
    if np.isfinite(corr) and corr < 0:
        return float(min(-corr, 0.5))
    return 0.0


def _fast_hurst_persist(x: np.ndarray) -> float:
    """Fast persistence proxy using lag-1 autocorrelation."""
    x = np.asarray(x, dtype=float)
    x = x[np.isfinite(x)]
    if len(x) < 10:
        return 0.0
    corr = np.corrcoef(x[:-1], x[1:])[0, 1]
    if np.isfinite(corr) and corr > 0:
        return float(min(corr, 0.5))
    return 0.0


def _vol_autocorr_fallback(x: np.ndarray) -> float:
    """corr(|ret_t|, |ret_{t-1}|) as vol clustering proxy."""
    x = np.asarray(x, dtype=float)
    x = x[np.isfinite(x)]
    if len(x) < 10:
        return 0.0
    abs_ret = np.abs(x)
    corr = np.corrcoef(abs_ret[:-1], abs_ret[1:])[0, 1]
    if np.isfinite(corr):
        return float(np.clip(corr, 0.0, 1.0))
    return 0.0


# ---------------------------------------------------------------------------
# Regime classification pipeline
# ---------------------------------------------------------------------------

def classify_timeframe(
    df: pd.DataFrame,
    window: int,
    min_duration: int,
    label: str,
    use_fast: bool = False,
) -> dict:
    """
    Run full D/I/R regime classification on a single timeframe.

    Returns dict with: labels, stats, centroids, km model, vectors.
    """
    print(f"\n{'='*60}")
    print(f"  {label} TIMEFRAME — window={window}, min_duration={min_duration}")
    print(f"{'='*60}")

    warmup = 3 * window

    # 1. Compute features
    t0 = time.time()
    if use_fast:
        print(f"[{label}] Computing features (FAST mode)...")
        features = compute_features_fast(df, window)
    else:
        print(f"[{label}] Computing features (standard mode)...")
        features = compute_all_features(df, window)
    features = features.fillna(0.0)
    print(f"[{label}] Features computed in {time.time()-t0:.1f}s")

    # 2. Vectorize
    t0 = time.time()
    vectors = vectorize_pipeline(features)
    print(f"[{label}] Vectorized in {time.time()-t0:.1f}s")

    # 3. Fit K=3
    vec_valid = vectors.iloc[warmup:]
    magnitudes = np.sqrt((vec_valid ** 2).sum(axis=1))
    mask = magnitudes > 0.001
    vec_clean = vec_valid[mask]
    X = vec_clean.values

    print(f"[{label}] Fitting K=3 on {len(X)} vectors...")
    km = KMeans(n_clusters=3, n_init=20, random_state=42, max_iter=500)
    km.fit(X)

    # 4. Map clusters to D/I/R
    cluster_to_regime = _map_clusters(km)
    print(f"[{label}] Cluster mapping: {cluster_to_regime}")

    # 5. Label all bars
    labels = pd.Series("I", index=vec_valid.index)
    cluster_labels = km.predict(vec_valid[mask].values)
    regime_labels = np.array([cluster_to_regime[cl] for cl in cluster_labels])
    labels.loc[mask] = regime_labels

    # 6. Smooth
    labels_smoothed = _smooth(labels, min_duration)

    # 7. Stats
    stats = _compute_stats(labels_smoothed, label)

    # 8. Centroid info
    centroids_info = {}
    for ci, regime in cluster_to_regime.items():
        c = km.cluster_centers_[ci]
        centroids_info[regime] = {
            "D": float(c[0]), "I": float(c[1]), "R": float(c[2]),
            "temporal": float(c[3]), "density": float(c[4]), "entropy": float(c[5]),
        }

    # 9. Transition matrix
    transitions = {}
    for a in "DIR":
        for b in "DIR":
            transitions[f"{a}->{b}"] = 0
    for i in range(1, len(labels_smoothed)):
        prev = labels_smoothed.iloc[i - 1]
        curr = labels_smoothed.iloc[i]
        if prev != curr:
            transitions[f"{prev}->{curr}"] += 1

    return {
        "label": label,
        "window": window,
        "min_duration": min_duration,
        "n_bars": len(df),
        "n_labelled": len(labels_smoothed),
        "labels": labels_smoothed,
        "stats": stats,
        "centroids": centroids_info,
        "transitions": transitions,
        "km": km,
        "cluster_to_regime": cluster_to_regime,
        "df": df,
    }


def _map_clusters(km: KMeans) -> dict:
    centroids = km.cluster_centers_
    scores = np.column_stack([centroids[:, 0], centroids[:, 1], centroids[:, 2]])
    axes = ["D", "I", "R"]
    mapping = {}
    used = set()
    assignments = []
    for ci in range(3):
        for ai in range(3):
            assignments.append((scores[ci, ai], ci, axes[ai]))
    assignments.sort(reverse=True)
    for _, ci, axis in assignments:
        if ci not in mapping and axis not in used:
            mapping[ci] = axis
            used.add(axis)
        if len(mapping) == 3:
            break
    return mapping


def _smooth(labels: pd.Series, min_duration: int) -> pd.Series:
    smoothed = labels.copy()
    values = smoothed.values.copy()
    for _ in range(20):
        episodes = []
        start = 0
        for i in range(1, len(values)):
            if values[i] != values[start]:
                episodes.append((start, i, values[start]))
                start = i
        episodes.append((start, len(values), values[start]))

        changed = False
        for idx_e, (s, e, regime) in enumerate(episodes):
            duration = e - s
            if duration < min_duration and len(episodes) > 1:
                if idx_e == 0:
                    neighbor = episodes[idx_e + 1][2]
                elif idx_e == len(episodes) - 1:
                    neighbor = episodes[idx_e - 1][2]
                else:
                    prev_dur = episodes[idx_e - 1][1] - episodes[idx_e - 1][0]
                    next_dur = episodes[idx_e + 1][1] - episodes[idx_e + 1][0]
                    neighbor = episodes[idx_e - 1][2] if prev_dur >= next_dur else episodes[idx_e + 1][2]
                values[s:e] = neighbor
                changed = True
        if not changed:
            break

    smoothed[:] = values
    return smoothed


def _compute_stats(labels: pd.Series, tf_label: str) -> dict:
    counts = labels.value_counts()
    total = len(labels)
    dist = {r: float(counts.get(r, 0) / total) for r in "DIR"}
    print(f"[{tf_label}] Time distribution: D={dist['D']*100:.1f}%, I={dist['I']*100:.1f}%, R={dist['R']*100:.1f}%")

    # Durations
    durations = {"D": [], "I": [], "R": []}
    current = labels.iloc[0]
    dur = 1
    for i in range(1, len(labels)):
        if labels.iloc[i] == current:
            dur += 1
        else:
            durations[current].append(dur)
            current = labels.iloc[i]
            dur = 1
    durations[current].append(dur)

    dur_stats = {}
    for r in "DIR":
        d = durations[r]
        if d:
            dur_stats[r] = {
                "median": float(np.median(d)),
                "mean": float(np.mean(d)),
                "max": int(np.max(d)),
                "episodes": len(d),
            }
        else:
            dur_stats[r] = {"median": 0, "mean": 0, "max": 0, "episodes": 0}
        print(f"[{tf_label}]   {r}: median={dur_stats[r]['median']:.0f}, mean={dur_stats[r]['mean']:.1f}, max={dur_stats[r]['max']}, episodes={dur_stats[r]['episodes']}")

    return {
        "time_distribution": dist,
        "durations": dur_stats,
    }


# ---------------------------------------------------------------------------
# Chart generation
# ---------------------------------------------------------------------------

def plot_regime_chart(df: pd.DataFrame, labels: pd.Series, stats: dict,
                      title: str, output_path: Path) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import matplotlib.dates as mdates
    from matplotlib.patches import Patch

    price = df.loc[labels.index, "close"]

    fig, axes = plt.subplots(2, 1, figsize=(20, 10), height_ratios=[4, 1],
                              gridspec_kw={"hspace": 0.12})

    ax = axes[0]
    ax.plot(price.index, price.values, color="black", linewidth=0.5, alpha=0.8)
    for i in range(len(labels) - 1):
        regime = labels.iloc[i]
        ax.axvspan(labels.index[i], labels.index[i + 1],
                   alpha=0.15, color=REGIME_COLORS[regime], linewidth=0)

    ax.set_ylabel("BTC/USDT Price", fontsize=12)
    ax.set_title(title, fontsize=14, fontweight="bold")
    ax.set_yscale("log")
    ax.grid(True, alpha=0.3)

    dist = stats["time_distribution"]
    legend_elements = [
        Patch(facecolor=REGIME_COLORS[r], alpha=0.4,
              label=f"{r} -- {REGIME_NAMES[r]} ({dist.get(r,0)*100:.0f}%)")
        for r in "DIR"
    ]
    ax.legend(handles=legend_elements, loc="upper left", fontsize=10)

    # Regime strip
    ax2 = axes[1]
    for i in range(len(labels) - 1):
        regime = labels.iloc[i]
        ax2.axvspan(labels.index[i], labels.index[i + 1],
                    alpha=0.7, color=REGIME_COLORS[regime], linewidth=0)
    ax2.set_yticks([])
    ax2.set_ylabel("Regime", fontsize=10)

    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"[CHART] Saved {output_path}")


def plot_alignment_chart(hourly_df: pd.DataFrame, alignment: pd.Series,
                         output_path: Path) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import matplotlib.dates as mdates
    from matplotlib.patches import Patch

    price = hourly_df.loc[alignment.index, "close"]

    align_colors = {
        "D-aligned": "#e74c3c",
        "I-aligned": "#3498db",
        "R-aligned": "#f39c12",
        "mixed": "#95a5a6",
    }

    fig, axes = plt.subplots(2, 1, figsize=(20, 10), height_ratios=[4, 1],
                              gridspec_kw={"hspace": 0.12})

    ax = axes[0]
    ax.plot(price.index, price.values, color="black", linewidth=0.3, alpha=0.7)
    for i in range(len(alignment) - 1):
        state = alignment.iloc[i]
        color = align_colors.get(state, "#cccccc")
        ax.axvspan(alignment.index[i], alignment.index[i + 1],
                   alpha=0.15, color=color, linewidth=0)

    ax.set_ylabel("BTC/USDT", fontsize=12)
    ax.set_title("BTC Cross-Timeframe D/I/R Alignment (Macro + Meso + Micro)", fontsize=14, fontweight="bold")
    ax.set_yscale("log")
    ax.grid(True, alpha=0.3)

    legend_elements = [
        Patch(facecolor=align_colors[k], alpha=0.4, label=k)
        for k in ["D-aligned", "I-aligned", "R-aligned", "mixed"]
    ]
    ax.legend(handles=legend_elements, loc="upper left", fontsize=10)

    # Alignment strip
    ax2 = axes[1]
    for i in range(len(alignment) - 1):
        state = alignment.iloc[i]
        color = align_colors.get(state, "#cccccc")
        ax2.axvspan(alignment.index[i], alignment.index[i + 1],
                    alpha=0.7, color=color, linewidth=0)
    ax2.set_yticks([])
    ax2.set_ylabel("Alignment", fontsize=10)

    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"[CHART] Saved {output_path}")


# ---------------------------------------------------------------------------
# Cross-timeframe alignment
# ---------------------------------------------------------------------------

def compute_alignment(
    macro_result: dict,
    meso_result: dict,
    micro_result: dict,
    hourly_df: pd.DataFrame,
) -> dict:
    """
    For each hourly candle, find the macro & meso daily regime,
    then compute alignment statistics and forward returns.
    """
    print(f"\n{'='*60}")
    print(f"  CROSS-TIMEFRAME ALIGNMENT ANALYSIS")
    print(f"{'='*60}")

    macro_labels = macro_result["labels"]
    meso_labels = meso_result["labels"]
    micro_labels = micro_result["labels"]

    # Build daily regime lookup: date -> regime
    macro_lookup = macro_labels.copy()
    macro_lookup.index = macro_lookup.index.normalize()
    meso_lookup = meso_labels.copy()
    meso_lookup.index = meso_lookup.index.normalize()

    # For each hourly bar in micro_labels, find macro and meso regime
    micro_idx = micro_labels.index
    alignment = pd.Series(index=micro_idx, dtype=str)

    macro_regimes = pd.Series(index=micro_idx, dtype=str)
    meso_regimes = pd.Series(index=micro_idx, dtype=str)

    for ts in micro_idx:
        day = ts.normalize()
        macro_regimes[ts] = macro_lookup.get(day, "?")
        meso_regimes[ts] = meso_lookup.get(day, "?")

    # Determine alignment state
    for ts in micro_idx:
        ma = macro_regimes[ts]
        me = meso_regimes[ts]
        mi = micro_labels[ts]

        if ma == me == mi and ma in "DIR":
            alignment[ts] = f"{ma}-aligned"
        else:
            alignment[ts] = "mixed"

    # Filter out bars where macro/meso was unknown
    valid_mask = (macro_regimes != "?") & (meso_regimes != "?")
    alignment_valid = alignment[valid_mask]
    micro_valid = micro_labels[valid_mask]
    print(f"[ALIGN] {valid_mask.sum()} hourly bars with valid macro+meso lookup "
          f"(out of {len(micro_idx)} micro bars)")

    # Compute percentages
    total_valid = len(alignment_valid)
    pcts = {}
    for state in ["D-aligned", "I-aligned", "R-aligned", "mixed"]:
        count = (alignment_valid == state).sum()
        pcts[state] = float(count / total_valid) if total_valid > 0 else 0.0
        print(f"[ALIGN] {state}: {count} bars ({pcts[state]*100:.1f}%)")

    # Forward returns (24h)
    close = hourly_df.loc[alignment_valid.index, "close"]
    fwd_close = close.shift(-24)
    fwd_return = (fwd_close / close) - 1.0

    returns_by_state = {}
    for state in ["D-aligned", "I-aligned", "R-aligned", "mixed"]:
        mask = alignment_valid == state
        rets = fwd_return[mask].dropna()
        if len(rets) > 0:
            returns_by_state[state] = {
                "mean_24h_return": float(rets.mean()),
                "median_24h_return": float(rets.median()),
                "std_24h_return": float(rets.std()),
                "sharpe_24h": float(rets.mean() / rets.std()) if rets.std() > 0 else 0.0,
                "n_observations": int(len(rets)),
                "win_rate": float((rets > 0).mean()),
            }
        else:
            returns_by_state[state] = {
                "mean_24h_return": 0.0, "median_24h_return": 0.0,
                "std_24h_return": 0.0, "sharpe_24h": 0.0,
                "n_observations": 0, "win_rate": 0.0,
            }
        r = returns_by_state[state]
        print(f"[ALIGN] {state} 24h fwd return: "
              f"mean={r['mean_24h_return']*100:.4f}%, "
              f"median={r['median_24h_return']*100:.4f}%, "
              f"sharpe={r['sharpe_24h']:.3f}, "
              f"win_rate={r['win_rate']*100:.1f}%, "
              f"n={r['n_observations']}")

    return {
        "alignment_percentages": pcts,
        "forward_returns_24h": returns_by_state,
        "total_aligned_bars": total_valid,
        "alignment_series": alignment_valid,
    }


# ---------------------------------------------------------------------------
# JSON serializer
# ---------------------------------------------------------------------------

def build_result_json(result: dict) -> dict:
    """Build JSON-serializable result dict for a single timeframe."""
    return {
        "timeframe": result["label"],
        "window": result["window"],
        "min_duration": result["min_duration"],
        "n_bars_total": result["n_bars"],
        "n_bars_labelled": result["n_labelled"],
        "centroids": result["centroids"],
        "time_distribution": result["stats"]["time_distribution"],
        "durations": result["stats"]["durations"],
        "transition_matrix": result["transitions"],
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    t_start = time.time()

    # Load data
    daily_df = load_daily()
    hourly_df = load_hourly()

    # 1. Macro: daily, 30-day window
    macro = classify_timeframe(daily_df, window=30, min_duration=3, label="MACRO", use_fast=True)
    macro_json = build_result_json(macro)
    with open(DATA_DIR / "btc_macro_regimes.json", "w") as f:
        json.dump(macro_json, f, indent=2)
    print(f"[SAVE] btc_macro_regimes.json")

    # Plot macro
    plot_regime_chart(
        daily_df, macro["labels"], macro["stats"],
        "BTC Daily -- MACRO D/I/R Regimes (30-day window)",
        DATA_DIR / "btc_macro_regime_chart.png",
    )

    # 2. Meso: daily, 7-day window (must use fast mode — window too small for standard Hurst/GARCH)
    meso = classify_timeframe(daily_df, window=7, min_duration=3, label="MESO", use_fast=True)
    meso_json = build_result_json(meso)
    with open(DATA_DIR / "btc_meso_regimes.json", "w") as f:
        json.dump(meso_json, f, indent=2)
    print(f"[SAVE] btc_meso_regimes.json")

    # Plot meso
    plot_regime_chart(
        daily_df, meso["labels"], meso["stats"],
        "BTC Daily -- MESO D/I/R Regimes (7-day window)",
        DATA_DIR / "btc_meso_regime_chart.png",
    )

    # 3. Micro: hourly, 72h window (FAST mode for speed on 75k bars)
    micro = classify_timeframe(hourly_df, window=72, min_duration=6, label="MICRO", use_fast=True)
    micro_json = build_result_json(micro)
    with open(DATA_DIR / "btc_micro_regimes_full.json", "w") as f:
        json.dump(micro_json, f, indent=2)
    print(f"[SAVE] btc_micro_regimes_full.json")

    # Plot micro (too many bars for axvspan -- sample for chart)
    plot_regime_chart(
        hourly_df, micro["labels"], micro["stats"],
        "BTC 1H -- MICRO D/I/R Regimes (72h window, full 8.5yr)",
        DATA_DIR / "btc_micro_regime_chart.png",
    )

    # 4. Cross-timeframe alignment
    align_result = compute_alignment(macro, meso, micro, hourly_df)

    align_json = {
        "alignment_percentages": align_result["alignment_percentages"],
        "forward_returns_24h": align_result["forward_returns_24h"],
        "total_aligned_bars": align_result["total_aligned_bars"],
    }
    with open(DATA_DIR / "btc_alignment_analysis.json", "w") as f:
        json.dump(align_json, f, indent=2)
    print(f"[SAVE] btc_alignment_analysis.json")

    # Alignment chart
    plot_alignment_chart(hourly_df, align_result["alignment_series"],
                         DATA_DIR / "btc_alignment_chart.png")

    elapsed = time.time() - t_start
    print(f"\n{'='*60}")
    print(f"  COMPLETE — total runtime: {elapsed:.1f}s")
    print(f"{'='*60}")

    # Summary
    print(f"\n--- SUMMARY ---")
    for tf_name, tf_data in [("MACRO", macro_json), ("MESO", meso_json), ("MICRO", micro_json)]:
        d = tf_data["time_distribution"]
        print(f"\n{tf_name} (window={tf_data['window']}, {tf_data['n_bars_labelled']} bars):")
        print(f"  D={d['D']*100:.1f}%  I={d['I']*100:.1f}%  R={d['R']*100:.1f}%")

    print(f"\nALIGNMENT:")
    for state, pct in align_result["alignment_percentages"].items():
        r = align_result["forward_returns_24h"][state]
        print(f"  {state}: {pct*100:.1f}% of time | 24h fwd: {r['mean_24h_return']*100:.4f}% mean, sharpe={r['sharpe_24h']:.3f}")


if __name__ == "__main__":
    main()
