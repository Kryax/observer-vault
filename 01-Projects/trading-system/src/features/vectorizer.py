"""
Vectorizer: aggregate 12 D/I/R features into 6D normalized vectors.

Pipeline:
  1. Rolling min-max normalize each of the 12 features to [0, 1]
  2. Sum 4 features per axis -> D, I, R raw scores
  3. Compute temporal persistence, density, entropy
  4. L2-normalize the full 6D vector
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .indicators import D_FEATURES, I_FEATURES, R_FEATURES, ALL_FEATURES


def rolling_minmax_normalize(features: pd.DataFrame,
                             lookback: int | None = None) -> pd.DataFrame:
    """
    Normalize each feature column to [0, 1] via rolling min-max.

    Parameters
    ----------
    features : DataFrame with 12 feature columns
    lookback : rolling window for min/max. None = expanding (use all history).

    Returns
    -------
    DataFrame with same columns, values in [0, 1].
    """
    normalized = pd.DataFrame(index=features.index)
    for col in features.columns:
        s = features[col]
        if lookback is not None:
            roll_min = s.rolling(lookback, min_periods=1).min()
            roll_max = s.rolling(lookback, min_periods=1).max()
        else:
            roll_min = s.expanding(min_periods=1).min()
            roll_max = s.expanding(min_periods=1).max()

        denom = (roll_max - roll_min).replace(0, np.nan)
        normalized[col] = ((s - roll_min) / denom).clip(0.0, 1.0).fillna(0.0)

    return normalized


def _dominant_axis(d: pd.Series, i: pd.Series, r: pd.Series) -> pd.Series:
    """Return which axis is dominant at each row."""
    combined = pd.concat([d.rename("D"), i.rename("I"), r.rename("R")], axis=1)
    return combined.idxmax(axis=1)


def compute_regime_persistence(dominant: pd.Series) -> pd.Series:
    """
    How many consecutive bars the current dominant axis has held.
    Returns persistence count at each row.
    """
    result = np.zeros(len(dominant))
    count = 1
    for idx in range(1, len(dominant)):
        if dominant.iloc[idx] == dominant.iloc[idx - 1]:
            count += 1
        else:
            count = 1
        result[idx] = count
    result[0] = 1
    return pd.Series(result, index=dominant.index)


def vectorize(features_normalized: pd.DataFrame,
              max_persistence: float | None = None,
              max_density: float | None = None) -> pd.DataFrame:
    """
    Aggregate 12 normalized features into 6D L2-normalized vectors.

    Parameters
    ----------
    features_normalized : DataFrame with 12 feature columns, each in [0, 1]
    max_persistence : normalizer for temporal dimension (auto-computed if None)
    max_density : normalizer for density dimension (auto-computed if None)

    Returns
    -------
    DataFrame with columns: D, I, R, temporal, density, entropy, plus
    the raw un-normalized versions prefixed with 'raw_'.
    """
    # Axis raw scores: sum of 4 features each (range [0, 4])
    d_raw = features_normalized[D_FEATURES].sum(axis=1)
    i_raw = features_normalized[I_FEATURES].sum(axis=1)
    r_raw = features_normalized[R_FEATURES].sum(axis=1)

    # Temporal: regime persistence / max_persistence
    dominant = _dominant_axis(d_raw, i_raw, r_raw)
    persistence = compute_regime_persistence(dominant)
    if max_persistence is None:
        max_persistence = max(persistence.max(), 1.0)
    temporal = persistence / max_persistence

    # Density: total signal strength
    density_raw = d_raw + i_raw + r_raw  # range [0, 12]
    if max_density is None:
        max_density = max(density_raw.max(), 1.0)
    density = density_raw / max_density

    # Entropy: -sum(p_i * log2(p_i)) where p_i = axis_i / sum(axes)
    axis_sum = d_raw + i_raw + r_raw
    axis_sum_safe = axis_sum.replace(0, np.nan)

    p_d = d_raw / axis_sum_safe
    p_i = i_raw / axis_sum_safe
    p_r = r_raw / axis_sum_safe

    def _entropy_term(p: pd.Series) -> pd.Series:
        # 0 * log(0) = 0 by convention
        safe_p = p.clip(lower=1e-12)
        return -safe_p * np.log2(safe_p)

    entropy = (_entropy_term(p_d) + _entropy_term(p_i) + _entropy_term(p_r)).fillna(0.0)

    # Assemble 6D vectors
    vectors = pd.DataFrame({
        "D": d_raw,
        "I": i_raw,
        "R": r_raw,
        "temporal": temporal,
        "density": density,
        "entropy": entropy,
    }, index=features_normalized.index)

    # L2 normalize
    magnitude = np.sqrt((vectors ** 2).sum(axis=1)).replace(0, np.nan)
    vectors_normalized = vectors.div(magnitude, axis=0).fillna(0.0)

    return vectors_normalized


def vectorize_pipeline(features_raw: pd.DataFrame,
                       normalize_lookback: int | None = None) -> pd.DataFrame:
    """
    Full pipeline: raw features -> normalized -> 6D L2-normalized vectors.

    Convenience function combining normalization and vectorization.
    """
    normalized = rolling_minmax_normalize(features_raw, lookback=normalize_lookback)
    return vectorize(normalized)
