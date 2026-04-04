#!/usr/bin/env python3
"""
Phase A Feasibility Validation — BTC Regime Detection via D/I/R

Downloads 1 year BTC/USDT 1h OHLCV, computes 6D D/I/R vectors,
runs K-means for K in {3,5,7,9,12}, evaluates silhouette scores,
checks axis correlations, and prints a gate decision.

Usage:
    python src/phase_a_validate.py [--synthetic] [--plot]

ISC Exit Criteria verified:
    A1: 12 features compute without error
    A2: Features in [0,1] after normalization
    A3: 6D vectors L2-normalized
    A4: K-means runs for all K values
    A5: Silhouette scores computed
    A6: Script runs end-to-end
    A7: Gate decision documented
    A8: Hurst validated (in test suite)
    A9: Pairwise D/I/R correlation < 0.7
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.features.indicators import compute_all_features, hurst_exponent
from src.features.vectorizer import (
    rolling_minmax_normalize,
    vectorize_pipeline,
)


# ---------------------------------------------------------------------------
# Data acquisition
# ---------------------------------------------------------------------------

def download_btc_ohlcv(days: int = 365) -> pd.DataFrame | None:
    """
    Download BTC/USDT 1h OHLCV from Binance via ccxt.
    Returns DataFrame or None on failure.
    """
    try:
        import ccxt
        print("[DATA] Downloading BTC/USDT 1h from Binance via ccxt...")
        exchange = ccxt.binance({"enableRateLimit": True})

        since = exchange.parse8601(
            (datetime.utcnow() - timedelta(days=days)).isoformat()
        )

        all_ohlcv = []
        limit = 1000
        fetch_since = since

        while True:
            ohlcv = exchange.fetch_ohlcv(
                "BTC/USDT", "1h", since=fetch_since, limit=limit
            )
            if not ohlcv:
                break
            all_ohlcv.extend(ohlcv)
            fetch_since = ohlcv[-1][0] + 1  # next ms after last candle
            print(f"  fetched {len(all_ohlcv)} candles so far...")
            if len(ohlcv) < limit:
                break
            time.sleep(0.5)  # rate limit

        if not all_ohlcv:
            return None

        df = pd.DataFrame(
            all_ohlcv, columns=["timestamp", "open", "high", "low", "close", "volume"]
        )
        df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms")
        df = df.set_index("timestamp")
        df = df.astype(float)

        print(f"[DATA] Downloaded {len(df)} candles ({df.index[0]} to {df.index[-1]})")
        return df

    except Exception as e:
        print(f"[DATA] ccxt download failed: {e}")
        return None


def generate_synthetic_ohlcv(n_bars: int = 8760, seed: int = 42) -> pd.DataFrame:
    """
    Generate synthetic BTC-like OHLCV data for pipeline testing.

    Creates three distinct regime blocks:
      - Trending (D-dominant): first third with drift
      - Ranging (I-dominant): middle third, mean-reverting
      - Volatile (R-dominant): last third, high vol clustering
    """
    print("[DATA] Generating synthetic OHLCV (three-regime structure)...")
    rng = np.random.default_rng(seed)
    n_each = n_bars // 3

    # Trending regime
    trend_returns = rng.normal(0.0005, 0.008, n_each)  # positive drift, moderate vol
    # Ranging regime (mean-reverting via Ornstein-Uhlenbeck process)
    ou_returns = np.zeros(n_each)
    for i in range(1, n_each):
        ou_returns[i] = -0.1 * ou_returns[i - 1] + rng.normal(0, 0.006)
    # Volatile regime (GARCH-like clustering)
    vol_returns = np.zeros(n_bars - 2 * n_each)
    sigma = 0.01
    for i in range(1, len(vol_returns)):
        sigma = np.sqrt(0.00001 + 0.15 * vol_returns[i - 1] ** 2 + 0.8 * sigma ** 2)
        vol_returns[i] = rng.normal(0, sigma)

    all_returns = np.concatenate([trend_returns, ou_returns, vol_returns])
    close = 40000.0 * np.exp(np.cumsum(all_returns))
    high = close * (1 + rng.uniform(0, 0.003, n_bars))
    low = close * (1 - rng.uniform(0, 0.003, n_bars))
    opn = close * (1 + rng.normal(0, 0.001, n_bars))
    volume = rng.uniform(50, 5000, n_bars) * (1 + np.abs(all_returns) * 100)

    idx = pd.date_range("2025-04-01", periods=n_bars, freq="1h")
    df = pd.DataFrame({
        "open": opn, "high": high, "low": low, "close": close, "volume": volume
    }, index=idx)

    print(f"[DATA] Generated {len(df)} synthetic candles (trend/range/volatile blocks)")
    return df


# ---------------------------------------------------------------------------
# Validation logic
# ---------------------------------------------------------------------------

def run_validation(df: pd.DataFrame, windows: list[int],
                   k_values: list[int], data_source: str,
                   output_dir: Path, do_plot: bool = False) -> dict:
    """
    Run the full Phase A feasibility validation.

    Returns a results dict with all ISC criteria outcomes.
    """
    results = {
        "data_source": data_source,
        "n_candles": len(df),
        "windows": {},
        "isc_criteria": {},
    }

    all_isc_pass = True

    for n in windows:
        print(f"\n{'='*60}")
        print(f"  Window N={n} bars")
        print(f"{'='*60}")

        # --- ISC-A1: Compute 12 features ---
        print(f"\n[A1] Computing 12 features (window={n})...")
        features = compute_all_features(df, n)
        warmup = 3 * n
        features_valid = features.iloc[warmup:]

        nan_count = features_valid.isna().sum()
        inf_count = np.isinf(features_valid.values).sum()
        print(f"  NaN count per feature:\n{nan_count.to_string()}")
        print(f"  Inf count: {inf_count}")

        a1_pass = inf_count == 0
        if nan_count.sum() > 0:
            print(f"  [WARN] {nan_count.sum()} NaN values total — filling with 0")
            features = features.fillna(0.0)
            features_valid = features.iloc[warmup:]

        print(f"  ISC-A1: {'PASS' if a1_pass else 'FAIL'}")

        # --- ISC-A2: Normalized features in [0, 1] ---
        print(f"\n[A2] Normalizing features (rolling min-max)...")
        normalized = rolling_minmax_normalize(features)
        norm_valid = normalized.iloc[warmup:]
        a2_min = norm_valid.min().min()
        a2_max = norm_valid.max().max()
        a2_pass = a2_min >= -0.001 and a2_max <= 1.001
        print(f"  Normalized range: [{a2_min:.4f}, {a2_max:.4f}]")
        print(f"  ISC-A2: {'PASS' if a2_pass else 'FAIL'}")

        # --- ISC-A3: 6D vectors L2-normalized ---
        print(f"\n[A3] Computing 6D vectors...")
        vectors = vectorize_pipeline(features)
        vec_valid = vectors.iloc[warmup:]

        magnitudes = np.sqrt((vec_valid ** 2).sum(axis=1))
        nonzero_mag = magnitudes[magnitudes > 0.001]
        if len(nonzero_mag) > 0:
            mag_min, mag_max = nonzero_mag.min(), nonzero_mag.max()
            a3_pass = mag_min >= 0.999 and mag_max <= 1.001
        else:
            mag_min, mag_max = 0, 0
            a3_pass = False
        print(f"  L2 magnitude range: [{mag_min:.6f}, {mag_max:.6f}]")
        print(f"  Non-zero vectors: {len(nonzero_mag)}/{len(vec_valid)}")
        print(f"  ISC-A3: {'PASS' if a3_pass else 'FAIL'}")

        # Drop rows with zero vectors for clustering
        vec_clean = vec_valid[magnitudes > 0.001].values
        print(f"  Vectors for clustering: {len(vec_clean)}")

        # --- ISC-A4 & A5: K-means + silhouette ---
        print(f"\n[A4/A5] Running K-means clustering...")
        silhouette_results = {}
        cluster_results = {}

        for k in k_values:
            try:
                km = KMeans(n_clusters=k, n_init=10, random_state=42, max_iter=300)
                labels = km.fit_predict(vec_clean)
                sil = silhouette_score(vec_clean, labels)
                silhouette_results[k] = float(sil)
                cluster_results[k] = {
                    "labels": labels.tolist(),
                    "centroids": km.cluster_centers_.tolist(),
                    "inertia": float(km.inertia_),
                }
                print(f"  K={k:2d}: silhouette={sil:.4f}  inertia={km.inertia_:.2f}")
            except Exception as e:
                print(f"  K={k}: FAILED — {e}")
                silhouette_results[k] = None
                all_isc_pass = False

        a4_pass = all(v is not None for v in silhouette_results.values())
        a5_pass = a4_pass and len(silhouette_results) == len(k_values)
        print(f"\n  ISC-A4 (K-means runs): {'PASS' if a4_pass else 'FAIL'}")
        print(f"  ISC-A5 (silhouette computed): {'PASS' if a5_pass else 'FAIL'}")

        # --- ISC-A9: Pairwise D/I/R correlation ---
        print(f"\n[A9] Checking pairwise D/I/R correlations...")

        # Use pre-normalization axis scores for correlation check
        norm_valid_filled = normalized.iloc[warmup:].fillna(0)
        from src.features.indicators import D_FEATURES, I_FEATURES, R_FEATURES
        d_score = norm_valid_filled[D_FEATURES].sum(axis=1)
        i_score = norm_valid_filled[I_FEATURES].sum(axis=1)
        r_score = norm_valid_filled[R_FEATURES].sum(axis=1)

        corr_di = d_score.corr(i_score)
        corr_dr = d_score.corr(r_score)
        corr_ir = i_score.corr(r_score)

        a9_pass = all(abs(c) < 0.7 for c in [corr_di, corr_dr, corr_ir] if np.isfinite(c))
        print(f"  corr(D,I) = {corr_di:.4f}")
        print(f"  corr(D,R) = {corr_dr:.4f}")
        print(f"  corr(I,R) = {corr_ir:.4f}")
        print(f"  ISC-A9: {'PASS' if a9_pass else 'FAIL'}")

        # Store results for this window
        window_result = {
            "a1_pass": a1_pass,
            "a2_pass": a2_pass,
            "a3_pass": a3_pass,
            "a4_pass": a4_pass,
            "a5_pass": a5_pass,
            "a9_pass": a9_pass,
            "silhouette_scores": silhouette_results,
            "correlations": {
                "D_I": float(corr_di) if np.isfinite(corr_di) else None,
                "D_R": float(corr_dr) if np.isfinite(corr_dr) else None,
                "I_R": float(corr_ir) if np.isfinite(corr_ir) else None,
            },
            "n_vectors": len(vec_clean),
        }
        results["windows"][n] = window_result

        if not all([a1_pass, a2_pass, a3_pass, a4_pass, a5_pass, a9_pass]):
            all_isc_pass = False

        # Save cluster data
        for k, cr in cluster_results.items():
            fname = output_dir / f"clusters_w{n}_k{k}.json"
            with open(fname, "w") as f:
                json.dump(cr, f, indent=2)

        # Optional plot
        if do_plot and len(vec_clean) > 0:
            _plot_clusters(vec_clean, cluster_results, n, output_dir)

    # --- Gate Decision (ISC-A7) ---
    print(f"\n{'='*60}")
    print(f"  GATE DECISION")
    print(f"{'='*60}")

    # Find best window
    best_window = None
    best_k9_sil = -1
    for n, wr in results["windows"].items():
        sil9 = wr["silhouette_scores"].get(9)
        if sil9 is not None and sil9 > best_k9_sil:
            best_k9_sil = sil9
            best_window = n

    if best_window is not None:
        wr = results["windows"][best_window]
        sil3 = wr["silhouette_scores"].get(3, 0)
        sil9 = wr["silhouette_scores"].get(9, 0)

        print(f"\n  Best window: N={best_window}")
        print(f"  K=9 silhouette: {sil9:.4f}")
        print(f"  K=3 silhouette: {sil3:.4f}")

        # Silhouette table
        print(f"\n  Silhouette scores by K (window={best_window}):")
        print(f"  {'K':>4}  {'Silhouette':>12}")
        print(f"  {'-'*4}  {'-'*12}")
        for k in sorted(wr["silhouette_scores"]):
            s = wr["silhouette_scores"][k]
            marker = " <-- " if k == 9 else ""
            print(f"  {k:4d}  {s:12.4f}{marker}")

        # Gate: K=9 sil >= K=3 sil AND K=9 sil > 0.15
        k9_viable = sil9 >= sil3 and sil9 > 0.15
        k3_fallback = not k9_viable and sil3 > 0.1
        project_stop = not k9_viable and not k3_fallback

        if k9_viable:
            gate = "PASS: K=9 confirmed"
            gate_detail = (
                f"K=9 silhouette ({sil9:.4f}) >= K=3 ({sil3:.4f}) "
                f"and > 0.15. Nine-composition regime model is viable."
            )
        elif k3_fallback:
            gate = "CONDITIONAL: Fallback to K=3"
            gate_detail = (
                f"K=9 ({sil9:.4f}) did not meet gate (need >= K=3 AND > 0.15). "
                f"K=3 ({sil3:.4f}) > 0.1 — 3-regime D/I/R dominant model viable."
            )
        else:
            gate = "FAIL: Project stop"
            gate_detail = (
                f"Neither K=9 ({sil9:.4f}) nor K=3 ({sil3:.4f}) produce "
                f"meaningful clustering. D/I/R does not separate market dynamics."
            )

        print(f"\n  GATE: {gate}")
        print(f"  {gate_detail}")

        results["gate"] = {
            "decision": gate,
            "detail": gate_detail,
            "k9_silhouette": sil9,
            "k3_silhouette": sil3,
            "best_window": best_window,
        }
    else:
        print("\n  GATE: FAIL — no valid results")
        results["gate"] = {"decision": "FAIL", "detail": "No valid clustering results"}

    # ISC summary
    print(f"\n  ISC CRITERIA SUMMARY:")
    print(f"  A1 (features compute):     {_check_all(results, 'a1_pass')}")
    print(f"  A2 (values in [0,1]):      {_check_all(results, 'a2_pass')}")
    print(f"  A3 (L2 normalized):        {_check_all(results, 'a3_pass')}")
    print(f"  A4 (K-means runs):         {_check_all(results, 'a4_pass')}")
    print(f"  A5 (silhouette computed):   {_check_all(results, 'a5_pass')}")
    print(f"  A6 (end-to-end):           PASS (you're reading this)")
    print(f"  A7 (gate decision):        PASS (documented above)")
    print(f"  A8 (Hurst validation):     (validated in test suite)")
    print(f"  A9 (axis correlation):     {_check_all(results, 'a9_pass')}")

    if data_source == "synthetic":
        print(f"\n  [NOTE] Results based on SYNTHETIC data.")
        print(f"  Re-run without --synthetic when exchange access is available.")

    return results


def _check_all(results: dict, key: str) -> str:
    passes = [wr[key] for wr in results["windows"].values()]
    if all(passes):
        return "PASS"
    elif any(passes):
        return "PARTIAL"
    return "FAIL"


def _plot_clusters(vec_clean: np.ndarray, cluster_results: dict,
                   n: int, output_dir: Path):
    """Generate 3D scatter plot colored by cluster assignment."""
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        # Use K=9 if available, else best K
        k_to_plot = 9 if 9 in cluster_results else max(cluster_results.keys())
        labels = np.array(cluster_results[k_to_plot]["labels"])

        fig = plt.figure(figsize=(12, 8))
        ax = fig.add_subplot(111, projection="3d")

        # D, I, R are first 3 dimensions of the 6D vector
        scatter = ax.scatter(
            vec_clean[:, 0], vec_clean[:, 1], vec_clean[:, 2],
            c=labels, cmap="tab10", alpha=0.5, s=10,
        )
        ax.set_xlabel("D (Distinction)")
        ax.set_ylabel("I (Integration)")
        ax.set_zlabel("R (Recursion)")
        ax.set_title(f"D/I/R Cluster Scatter — Window={n}, K={k_to_plot}")
        plt.colorbar(scatter, label="Cluster")

        plot_path = output_dir / f"cluster_scatter_w{n}_k{k_to_plot}.png"
        plt.savefig(plot_path, dpi=150, bbox_inches="tight")
        plt.close()
        print(f"  [PLOT] Saved: {plot_path}")
    except Exception as e:
        print(f"  [PLOT] Failed: {e}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Phase A Feasibility Validation — BTC D/I/R Regime Detection"
    )
    parser.add_argument(
        "--synthetic", action="store_true",
        help="Use synthetic data instead of downloading from exchange",
    )
    parser.add_argument(
        "--plot", action="store_true",
        help="Generate 3D cluster scatter plots",
    )
    parser.add_argument(
        "--windows", type=str, default="24,48,72",
        help="Comma-separated rolling window sizes (default: 24,48,72)",
    )
    args = parser.parse_args()

    windows = [int(w) for w in args.windows.split(",")]
    k_values = [3, 5, 7, 9, 12]
    output_dir = PROJECT_ROOT / "data"
    output_dir.mkdir(exist_ok=True)

    print("=" * 60)
    print("  PHASE A: D/I/R Regime Detection Feasibility Validation")
    print("=" * 60)
    print(f"  Windows: {windows}")
    print(f"  K values: {k_values}")
    print(f"  Output: {output_dir}")

    # Acquire data
    if args.synthetic:
        df = generate_synthetic_ohlcv()
        data_source = "synthetic"
    else:
        df = download_btc_ohlcv()
        if df is None:
            print("[DATA] Falling back to synthetic data...")
            df = generate_synthetic_ohlcv()
            data_source = "synthetic (fallback)"
        else:
            data_source = "binance"
            # Cache for re-runs
            cache_path = output_dir / "btc_1h_ohlcv.csv"
            df.to_csv(cache_path)
            print(f"[DATA] Cached to {cache_path}")

    # Run validation
    results = run_validation(df, windows, k_values, data_source, output_dir, do_plot=args.plot)

    # Save full results
    results_path = output_dir / "phase_a_results.json"
    # Convert non-serializable types
    serializable = json.loads(json.dumps(results, default=str))
    with open(results_path, "w") as f:
        json.dump(serializable, f, indent=2)
    print(f"\n[OUTPUT] Results saved to {results_path}")


if __name__ == "__main__":
    main()
