"""
Tests for D/I/R feature computation and vectorization.

Covers:
  - Each of the 12 feature functions on synthetic data
  - Hurst exponent validation (random walk -> H ~ 0.5)
  - Vectorizer: output is 6D, L2-normalized
  - Features produce values in [0, 1] after normalization
  - GARCH fallback triggers on short/degenerate data
"""

import numpy as np
import pandas as pd
import pytest

from src.features.indicators import (
    realized_vol, atr_ratio, new_extremes, range_expansion,
    mean_reversion, hurst_mr, vwap_proximity, band_compression,
    autocorr, hurst_persist, vol_clustering, momentum_persist,
    hurst_exponent, compute_all_features, ALL_FEATURES,
)
from src.features.vectorizer import (
    rolling_minmax_normalize, vectorize, vectorize_pipeline,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _make_ohlcv(n: int = 500, seed: int = 42, trend: float = 0.0) -> pd.DataFrame:
    """Generate synthetic OHLCV data."""
    rng = np.random.default_rng(seed)
    returns = rng.normal(trend, 0.01, n)
    close = 100.0 * np.exp(np.cumsum(returns))
    high = close * (1 + rng.uniform(0, 0.005, n))
    low = close * (1 - rng.uniform(0, 0.005, n))
    opn = close * (1 + rng.normal(0, 0.002, n))
    volume = rng.uniform(100, 10000, n)
    return pd.DataFrame({
        "open": opn,
        "high": high,
        "low": low,
        "close": close,
        "volume": volume,
    })


@pytest.fixture
def ohlcv():
    return _make_ohlcv(500)


@pytest.fixture
def ohlcv_trending():
    """Strong uptrend for testing D-axis features."""
    return _make_ohlcv(500, seed=99, trend=0.002)


@pytest.fixture
def window():
    return 48


# ---------------------------------------------------------------------------
# D-axis feature tests
# ---------------------------------------------------------------------------

class TestDAxisFeatures:

    def test_realized_vol_not_nan(self, ohlcv, window):
        result = realized_vol(ohlcv["close"], window)
        # After warmup period, no NaN
        valid = result.iloc[window:]
        assert valid.notna().all(), "realized_vol has NaN after warmup"
        assert (valid >= 0).all(), "realized_vol must be non-negative"

    def test_atr_ratio_computes(self, ohlcv, window):
        result = atr_ratio(ohlcv["high"], ohlcv["low"], ohlcv["close"], window)
        valid = result.iloc[3 * window:]
        assert valid.notna().all(), "atr_ratio has NaN after warmup"
        assert (valid > 0).all(), "atr_ratio must be positive"

    def test_new_extremes_range(self, ohlcv, window):
        result = new_extremes(ohlcv["high"], ohlcv["low"], window)
        valid = result.iloc[window:]
        assert (valid >= 0).all() and (valid <= 1).all(), "new_extremes out of [0,1]"

    def test_range_expansion_computes(self, ohlcv, window):
        result = range_expansion(ohlcv["high"], ohlcv["low"], window)
        valid = result.iloc[3 * window:]
        assert valid.notna().all(), "range_expansion has NaN"
        assert (valid > 0).all(), "range_expansion must be positive"


# ---------------------------------------------------------------------------
# I-axis feature tests
# ---------------------------------------------------------------------------

class TestIAxisFeatures:

    def test_mean_reversion_non_negative(self, ohlcv, window):
        result = mean_reversion(ohlcv["close"], window)
        valid = result.iloc[window:]
        assert (valid >= 0).all(), "mean_reversion must be >= 0 (clipped)"

    def test_hurst_mr_non_negative(self, ohlcv, window):
        result = hurst_mr(ohlcv["close"], window)
        valid = result.iloc[window:]
        assert (valid >= 0).all(), "hurst_mr must be >= 0"

    def test_vwap_proximity_range(self, ohlcv, window):
        result = vwap_proximity(
            ohlcv["close"], ohlcv["volume"],
            ohlcv["high"], ohlcv["low"], window
        )
        valid = result.iloc[window:]
        assert (valid >= 0).all() and (valid <= 1).all(), "vwap_proximity out of [0,1]"

    def test_band_compression_range(self, ohlcv, window):
        result = band_compression(ohlcv["close"], window)
        valid = result.iloc[3 * window:]
        assert (valid >= 0).all() and (valid <= 1).all(), "band_compression out of [0,1]"


# ---------------------------------------------------------------------------
# R-axis feature tests
# ---------------------------------------------------------------------------

class TestRAxisFeatures:

    def test_autocorr_non_negative(self, ohlcv, window):
        result = autocorr(ohlcv["close"], window)
        valid = result.iloc[window:]
        assert (valid >= 0).all(), "autocorr must be >= 0 (clipped)"

    def test_hurst_persist_non_negative(self, ohlcv, window):
        result = hurst_persist(ohlcv["close"], window)
        valid = result.iloc[window:]
        assert (valid >= 0).all(), "hurst_persist must be >= 0"

    def test_vol_clustering_range(self, ohlcv, window):
        result = vol_clustering(ohlcv["close"], window)
        valid = result.iloc[window:]
        assert (valid >= 0).all() and (valid <= 1).all(), "vol_clustering out of [0,1]"

    def test_momentum_persist_non_negative(self, ohlcv, window):
        result = momentum_persist(ohlcv["close"], window)
        valid = result.iloc[window:]
        assert (valid >= 0).all(), "momentum_persist must be >= 0"


# ---------------------------------------------------------------------------
# Hurst exponent validation (ISC-A8)
# ---------------------------------------------------------------------------

class TestHurstExponent:

    def test_random_walk_hurst(self):
        """
        IID noise fed into DFA should give H ~ 0.5.
        DFA on iid returns: the cumulative profile is a random walk,
        so the DFA exponent should be ~0.5.
        """
        h_values = []
        for seed in range(10):
            rng2 = np.random.default_rng(seed + 1000)
            # IID returns -> DFA profile is random walk -> H ~ 0.5
            returns = rng2.normal(0, 1, 2000)
            h = hurst_exponent(pd.Series(returns))
            h_values.append(h)
        h_mean = np.mean(h_values)
        assert 0.45 <= h_mean <= 0.55, (
            f"IID returns Hurst mean = {h_mean:.3f}, expected [0.45, 0.55]"
        )

    def test_persistent_series_high_hurst(self):
        """A series with positive autocorrelation should have H > 0.5."""
        # Generate fractionally integrated noise with persistence
        rng = np.random.default_rng(42)
        n = 2000
        # Create persistent returns via simple AR(1) with positive coeff
        returns = np.zeros(n)
        for i in range(1, n):
            returns[i] = 0.4 * returns[i - 1] + rng.normal(0, 1)
        h = hurst_exponent(pd.Series(returns))
        assert h > 0.5, f"Persistent series Hurst = {h:.3f}, expected > 0.5"

    def test_short_series_fallback(self):
        """Very short series should return 0.5 (default)."""
        h = hurst_exponent(pd.Series([1.0, 2.0, 3.0]))
        assert h == 0.5, "Short series should return default H=0.5"


# ---------------------------------------------------------------------------
# GARCH fallback (ISC constraint)
# ---------------------------------------------------------------------------

class TestGARCHFallback:

    def test_fallback_on_short_data(self):
        """GARCH should fall back gracefully on < 30 bars."""
        rng = np.random.default_rng(42)
        short_close = pd.Series(100 + np.cumsum(rng.normal(0, 1, 20)))
        result = vol_clustering(short_close, n=15)
        # Should not crash, should produce values
        assert result.notna().any() or (result == 0).all()

    def test_fallback_on_constant_data(self):
        """Constant data -> GARCH fails -> fallback should handle it."""
        constant = pd.Series([100.0] * 100)
        result = vol_clustering(constant, n=48)
        # Should not crash
        assert len(result) == 100


# ---------------------------------------------------------------------------
# Compute all 12 features
# ---------------------------------------------------------------------------

class TestComputeAllFeatures:

    def test_all_12_columns_present(self, ohlcv, window):
        features = compute_all_features(ohlcv, window)
        assert set(features.columns) == set(ALL_FEATURES), (
            f"Expected {ALL_FEATURES}, got {list(features.columns)}"
        )

    def test_no_inf(self, ohlcv, window):
        features = compute_all_features(ohlcv, window)
        warmup = 3 * window
        valid = features.iloc[warmup:]
        assert not np.isinf(valid.values).any(), "Features contain Inf"

    def test_features_normalized_in_0_1(self, ohlcv, window):
        """After rolling min-max normalization, all values in [0, 1]."""
        features = compute_all_features(ohlcv, window)
        normalized = rolling_minmax_normalize(features)
        warmup = 3 * window
        valid = normalized.iloc[warmup:].dropna()
        assert (valid >= 0).all().all(), "Normalized features have values < 0"
        assert (valid <= 1).all().all(), "Normalized features have values > 1"


# ---------------------------------------------------------------------------
# Vectorizer tests
# ---------------------------------------------------------------------------

class TestVectorizer:

    def test_output_6d(self, ohlcv, window):
        features = compute_all_features(ohlcv, window)
        vectors = vectorize_pipeline(features)
        assert vectors.shape[1] == 6, f"Expected 6D, got {vectors.shape[1]}D"
        assert list(vectors.columns) == ["D", "I", "R", "temporal", "density", "entropy"]

    def test_l2_normalized(self, ohlcv, window):
        """L2 magnitude should be ~1.0 for non-zero rows (ISC-A3)."""
        features = compute_all_features(ohlcv, window)
        vectors = vectorize_pipeline(features)
        warmup = 3 * window
        valid = vectors.iloc[warmup:]

        magnitudes = np.sqrt((valid ** 2).sum(axis=1))
        # Exclude zero vectors (from NaN rows)
        nonzero = magnitudes[magnitudes > 0.001]
        assert len(nonzero) > 0, "No non-zero vectors after warmup"
        assert ((nonzero >= 0.999) & (nonzero <= 1.001)).all(), (
            f"L2 magnitude range: [{nonzero.min():.4f}, {nonzero.max():.4f}], "
            f"expected [0.999, 1.001]"
        )

    def test_vectorize_deterministic(self, ohlcv, window):
        """Same input -> same output."""
        features = compute_all_features(ohlcv, window)
        v1 = vectorize_pipeline(features)
        v2 = vectorize_pipeline(features)
        pd.testing.assert_frame_equal(v1, v2)


# ---------------------------------------------------------------------------
# Integration: full pipeline
# ---------------------------------------------------------------------------

class TestFullPipeline:

    def test_end_to_end(self):
        """Full pipeline: OHLCV -> features -> vectors without error."""
        df = _make_ohlcv(300, seed=77)
        features = compute_all_features(df, n=24)
        vectors = vectorize_pipeline(features)
        assert vectors.shape == (300, 6)
        assert not np.isnan(vectors.values).all()
