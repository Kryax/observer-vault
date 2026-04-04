#!/usr/bin/env python3
"""
Compute K=3 D/I/R transition matrices from walk-forward regime labels.

For each token:
  - Compute 6D vectors with W=168
  - Walk-forward fit PriceLandscape (K=3) on training windows
  - Classify test windows
  - Build 3x3 transition matrix P(regime_t -> regime_t+1)
  - Compute average regime durations
  - Identify whether D->I->D is the dominant cycle

Saves to data/transition_analysis_k3.json
"""

from __future__ import annotations

import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.features.indicators_fast import compute_all_features
from src.features.vectorizer import vectorize_pipeline
from src.classifier.price_landscape import PriceLandscape

DATA_DIR = PROJECT_ROOT / "data"
WINDOW = 168

TOKEN_FILES = {
    "BTC": DATA_DIR / "btc_ohlcv_1h_extended.csv",
    "ETH": DATA_DIR / "eth_ohlcv_1h.csv",
    "SOL": DATA_DIR / "sol_ohlcv_1h.csv",
    "BNB": DATA_DIR / "bnb_ohlcv_1h.csv",
    "ADA": DATA_DIR / "ada_ohlcv_1h.csv",
}

REGIMES = ["D", "I", "R"]


def load_data(filepath: Path) -> pd.DataFrame:
    df = pd.read_csv(filepath, parse_dates=["timestamp"], index_col="timestamp")
    df = df[~df.index.duplicated(keep="first")].sort_index()
    return df


def walk_forward_classify(
    data: pd.DataFrame, vectors: pd.DataFrame,
    train_bars: int = 2000, step_bars: int = 500,
) -> pd.Series:
    """Walk-forward classify and return regime labels for all test bars."""
    n = len(data)
    if n < train_bars + step_bars:
        train_bars = int(n * 0.6)
        step_bars = n - train_bars

    all_labels = {}
    start = 0
    while start + train_bars + step_bars <= n:
        train_end = start + train_bars
        test_end = min(train_end + step_bars, n)

        train_vecs = vectors.iloc[
            vectors.index.searchsorted(data.index[start]):
            vectors.index.searchsorted(data.index[train_end - 1]) + 1
        ]
        test_vecs = vectors.iloc[
            vectors.index.searchsorted(data.index[train_end]):
            vectors.index.searchsorted(data.index[test_end - 1]) + 1
        ]

        if len(train_vecs) < 200 or len(test_vecs) < 50:
            start += step_bars
            continue

        ls = PriceLandscape()
        ls.fit(train_vecs.values, k=3)

        for i in range(len(test_vecs)):
            vec = test_vecs.values[i]
            cls = ls.classify(vec)
            label = ls.get_regime_for_label(cls["label"])
            all_labels[test_vecs.index[i]] = label

        start += step_bars

    return pd.Series(all_labels, name="regime").sort_index()


def compute_transition_matrix(labels: pd.Series) -> dict:
    """Compute 3x3 transition matrix and regime statistics."""
    # Count transitions
    counts = defaultdict(lambda: defaultdict(int))
    for i in range(len(labels) - 1):
        from_r = labels.iloc[i]
        to_r = labels.iloc[i + 1]
        if from_r in REGIMES and to_r in REGIMES:
            counts[from_r][to_r] += 1

    # Build probability matrix
    matrix = {}
    for from_r in REGIMES:
        total = sum(counts[from_r][to_r] for to_r in REGIMES)
        row = {}
        for to_r in REGIMES:
            row[to_r] = counts[from_r][to_r] / total if total > 0 else 0.0
        matrix[from_r] = row

    # Average regime durations (consecutive bars in same regime)
    durations = defaultdict(list)
    current_regime = labels.iloc[0]
    current_duration = 1
    for i in range(1, len(labels)):
        if labels.iloc[i] == current_regime:
            current_duration += 1
        else:
            durations[current_regime].append(current_duration)
            current_regime = labels.iloc[i]
            current_duration = 1
    durations[current_regime].append(current_duration)

    avg_durations = {
        r: float(np.mean(durations[r])) if durations[r] else 0.0
        for r in REGIMES
    }
    median_durations = {
        r: float(np.median(durations[r])) if durations[r] else 0.0
        for r in REGIMES
    }

    # Regime distribution
    regime_counts = Counter(labels)
    total_bars = len(labels)
    distribution = {
        r: regime_counts.get(r, 0) / total_bars if total_bars > 0 else 0.0
        for r in REGIMES
    }

    # Key transition probabilities
    p_d_to_i = matrix.get("D", {}).get("I", 0.0)
    p_i_to_d = matrix.get("I", {}).get("D", 0.0)
    p_d_to_r = matrix.get("D", {}).get("R", 0.0)
    p_i_to_r = matrix.get("I", {}).get("R", 0.0)

    # D->I->D cycle dominance
    d_i_d_dominant = p_i_to_d > p_i_to_r

    return {
        "transition_matrix": matrix,
        "raw_counts": {
            from_r: dict(counts[from_r]) for from_r in REGIMES
        },
        "avg_duration_bars": avg_durations,
        "median_duration_bars": median_durations,
        "regime_distribution": distribution,
        "total_bars": total_bars,
        "key_probabilities": {
            "P(D->I)": p_d_to_i,
            "P(I->D)": p_i_to_d,
            "P(D->R)": p_d_to_r,
            "P(I->R)": p_i_to_r,
            "P(D->D)": matrix.get("D", {}).get("D", 0.0),
            "P(I->I)": matrix.get("I", {}).get("I", 0.0),
            "P(R->R)": matrix.get("R", {}).get("R", 0.0),
        },
        "d_i_d_macro_basin": d_i_d_dominant,
        "d_i_d_explanation": (
            f"P(I->D)={p_i_to_d:.3f} vs P(I->R)={p_i_to_r:.3f} → "
            f"{'D->I->D is dominant cycle' if d_i_d_dominant else 'I->R is more likely, no macro-basin'}"
        ),
    }


def main():
    print("=" * 60)
    print("K=3 TRANSITION MATRIX ANALYSIS")
    print(f"  Window: {WINDOW} bars")
    print(f"  Tokens: {list(TOKEN_FILES.keys())}")
    print("=" * 60, flush=True)

    results = {}

    for symbol, filepath in TOKEN_FILES.items():
        print(f"\n--- {symbol} ---", flush=True)

        # Load and compute vectors
        data = load_data(filepath)
        print(f"  Loaded {len(data)} bars")

        features = compute_all_features(data, WINDOW)
        vectors = vectorize_pipeline(features).dropna()
        print(f"  Computed {len(vectors)} vectors")

        # Walk-forward classify
        labels = walk_forward_classify(data, vectors)
        print(f"  Classified {len(labels)} bars")

        if len(labels) < 100:
            print(f"  SKIP: too few classified bars")
            continue

        # Compute transition matrix
        tm = compute_transition_matrix(labels)
        results[symbol] = tm

        # Print summary
        print(f"  Regime distribution: D={tm['regime_distribution']['D']:.1%}, "
              f"I={tm['regime_distribution']['I']:.1%}, R={tm['regime_distribution']['R']:.1%}")
        print(f"  Avg durations: D={tm['avg_duration_bars']['D']:.1f}, "
              f"I={tm['avg_duration_bars']['I']:.1f}, R={tm['avg_duration_bars']['R']:.1f}")
        print(f"  P(D->I)={tm['key_probabilities']['P(D->I)']:.3f}, "
              f"P(I->D)={tm['key_probabilities']['P(I->D)']:.3f}, "
              f"P(I->R)={tm['key_probabilities']['P(I->R)']:.3f}")
        print(f"  D->I->D macro-basin: {tm['d_i_d_macro_basin']}")

    # Save
    output_path = DATA_DIR / "transition_analysis_k3.json"
    with open(output_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nSaved to {output_path}")


if __name__ == "__main__":
    main()
