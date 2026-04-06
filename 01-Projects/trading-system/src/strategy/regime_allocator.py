"""
Model 1 v2: Dynamic Regime Allocator with Persistence Filter + Daily Mode

Two approaches to fix the hourly noise problem (1,800+ trades → -99% returns):

  1. Daily-only mode: use only daily macro regime, rebalance once per day max
  2. Persistence filter: require N consecutive bars in new regime before switching

  D-regime → be long (configurable %, default 100%)
  I-regime → configurable (hold or reduce, default 50%)
  R-regime → be cash (0%)

No price stops. No profit targets. Regime transition is the only exit.
"""

from __future__ import annotations

import pandas as pd

from src.backtest.engine import Signal


class RegimeAllocator:
    """
    Dynamic beta allocation based on D/I/R regime.

    Parameters
    ----------
    d_allocation : target allocation when regime = D
    i_allocation : target allocation when regime = I
    r_allocation : target allocation when regime = R
    rebalance_mode : "hourly" uses row["regime"], "daily" uses row["macro_regime"]
    persistence_bars : consecutive bars required in new regime before switching (0=disabled)
    min_confidence : minimum classifier confidence to act on D regime
    warmup_bars : bars to skip at start
    rebalance_threshold : minimum allocation delta to trigger rebalance
    """

    def __init__(
        self,
        d_allocation: float = 1.0,
        i_allocation: float = 0.5,
        r_allocation: float = 0.0,
        rebalance_mode: str = "hourly",
        persistence_bars: int = 0,
        min_confidence: float = 0.3,
        warmup_bars: int = 100,
        rebalance_threshold: float = 0.05,
    ):
        self.d_allocation = d_allocation
        self.i_allocation = i_allocation
        self.r_allocation = r_allocation
        self.rebalance_mode = rebalance_mode
        self.persistence_bars = persistence_bars
        self.min_confidence = min_confidence
        self.warmup_bars = warmup_bars
        self.rebalance_threshold = rebalance_threshold

        # Internal state
        self._current_alloc = 0.0
        self._confirmed_regime = "I"  # regime we're currently acting on
        self._pending_regime = "I"    # regime being tracked for persistence
        self._pending_count = 0       # consecutive bars in pending regime
        self._last_rebalance_day = None  # for daily mode: only act once per day
        self._variant_name = ""

        # Diagnostics
        self.transition_log: list[dict] = []

    def name(self) -> str:
        return self._variant_name or "RegimeAllocator"

    def set_variant_name(self, name: str) -> None:
        self._variant_name = name

    def precompute(self, data: pd.DataFrame) -> None:
        pass

    def _read_regime(self, row: pd.Series) -> str:
        """Read the appropriate regime based on rebalance_mode."""
        if self.rebalance_mode == "daily":
            return str(row.get("macro_regime", "I"))
        return str(row.get("regime", "I"))

    def _target_for_regime(self, regime: str, confidence: float) -> float:
        """Map regime to target allocation."""
        if regime == "D" and confidence >= self.min_confidence:
            return self.d_allocation
        elif regime == "I":
            return self.i_allocation
        elif regime == "R":
            return self.r_allocation
        return 0.0

    def on_bar(self, idx: int, row: pd.Series, history: pd.DataFrame) -> Signal:
        if idx < self.warmup_bars:
            return Signal(action="hold", reason="warmup")

        raw_regime = self._read_regime(row)
        confidence = float(row.get("confidence", 0.5))
        ts = row.name if hasattr(row, "name") else None

        # --- Daily mode gate: only evaluate once per calendar day ---
        if self.rebalance_mode == "daily" and ts is not None:
            try:
                day = ts.date() if hasattr(ts, "date") else None
            except Exception:
                day = None
            if day is not None and day == self._last_rebalance_day:
                return Signal(action="hold", reason=f"daily_wait_{self._confirmed_regime}")
            if day is not None:
                self._last_rebalance_day = day

        # --- Persistence filter ---
        if self.persistence_bars > 0:
            if raw_regime == self._pending_regime:
                self._pending_count += 1
            else:
                self._pending_regime = raw_regime
                self._pending_count = 1

            if self._pending_count >= self.persistence_bars and raw_regime != self._confirmed_regime:
                old = self._confirmed_regime
                self._confirmed_regime = raw_regime
                self.transition_log.append({
                    "idx": idx, "from": old, "to": raw_regime,
                    "after_bars": self._pending_count,
                })
            active_regime = self._confirmed_regime
        else:
            # No persistence filter — use raw regime directly
            if raw_regime != self._confirmed_regime:
                old = self._confirmed_regime
                self._confirmed_regime = raw_regime
                self.transition_log.append({
                    "idx": idx, "from": old, "to": raw_regime,
                })
            active_regime = raw_regime

        # --- Compute target allocation ---
        target = self._target_for_regime(active_regime, confidence)

        # --- Rebalance if needed ---
        delta = target - self._current_alloc

        if delta > self.rebalance_threshold:
            buy_frac = min(0.95, max(0.5, target))
            self._current_alloc = target
            return Signal(
                action="buy",
                size=buy_frac,
                reason=f"alloc_{active_regime}_{target:.0%}",
            )

        elif delta < -self.rebalance_threshold:
            if target <= self.rebalance_threshold:
                sell_frac = 1.0
            else:
                sell_frac = min(1.0, (self._current_alloc - target) / self._current_alloc)
            self._current_alloc = target
            return Signal(
                action="sell",
                size=sell_frac,
                reason=f"dealloc_{active_regime}_{target:.0%}",
            )

        return Signal(action="hold", reason=f"hold_{active_regime}_{self._current_alloc:.0%}")
