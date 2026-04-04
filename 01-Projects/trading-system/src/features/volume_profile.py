"""
Volume Profile (VPVR) from OHLCV data.

Distributes each bar's volume across the high-low range into adaptive price bins.
Identifies High Volume Nodes (HVN) and Low Volume Nodes (LVN) as zones.

HVN = price levels in top 20th percentile by volume (liquidity concentration)
LVN = price levels in bottom 20th percentile by volume (air pockets)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np
import pandas as pd


@dataclass
class PriceLevel:
    price: float
    volume: float
    zone_low: float
    zone_high: float


@dataclass
class VolumeProfileResult:
    bin_prices: np.ndarray
    bin_volumes: np.ndarray
    bin_width: float
    hvn_levels: list[PriceLevel]
    lvn_levels: list[PriceLevel]
    poc: float  # Point of Control — single highest volume price


class VolumeProfile:
    """
    Compute VPVR from OHLCV data with adaptive bin sizing.

    Parameters
    ----------
    lookback : bars to include (500 = ~21 days at 1h)
    num_bins : target number of price bins (actual count adapts to range)
    hvn_percentile : top percentile threshold for HVN (default 80 = top 20%)
    lvn_percentile : bottom percentile threshold for LVN (default 20)
    zone_tolerance : HVN/LVN zone width as fraction of price (default 0.005 = 0.5%)
    """

    def __init__(
        self,
        lookback: int = 500,
        num_bins: int = 100,
        hvn_percentile: float = 80.0,
        lvn_percentile: float = 20.0,
        zone_tolerance: float = 0.005,
    ):
        self.lookback = lookback
        self.num_bins = num_bins
        self.hvn_percentile = hvn_percentile
        self.lvn_percentile = lvn_percentile
        self.zone_tolerance = zone_tolerance
        self._result: Optional[VolumeProfileResult] = None

    def compute(self, df: pd.DataFrame) -> VolumeProfileResult:
        """
        Build volume profile from recent OHLCV bars.

        Distributes each bar's volume uniformly across its high-low range
        into price bins.
        """
        window = df.iloc[-self.lookback:] if len(df) > self.lookback else df

        price_low = window["low"].min()
        price_high = window["high"].max()
        if price_high <= price_low:
            price_high = price_low + 1.0

        bin_width = (price_high - price_low) / self.num_bins
        bin_edges = np.linspace(price_low, price_high, self.num_bins + 1)
        bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2.0
        bin_volumes = np.zeros(self.num_bins)

        highs = window["high"].values
        lows = window["low"].values
        volumes = window["volume"].values

        for j in range(len(window)):
            bar_low = lows[j]
            bar_high = highs[j]
            bar_vol = volumes[j]
            if bar_high <= bar_low or bar_vol <= 0:
                continue

            low_bin = max(0, int((bar_low - price_low) / bin_width))
            high_bin = min(self.num_bins - 1, int((bar_high - price_low) / bin_width))
            n_bins_hit = high_bin - low_bin + 1
            if n_bins_hit > 0:
                vol_per_bin = bar_vol / n_bins_hit
                bin_volumes[low_bin:high_bin + 1] += vol_per_bin

        # Identify HVN and LVN
        hvn_threshold = np.percentile(bin_volumes, self.hvn_percentile)
        lvn_threshold = np.percentile(bin_volumes, self.lvn_percentile)

        hvn_levels = []
        lvn_levels = []

        for i in range(self.num_bins):
            price = bin_centers[i]
            vol = bin_volumes[i]
            zone_half = price * self.zone_tolerance
            level = PriceLevel(
                price=float(price),
                volume=float(vol),
                zone_low=float(price - zone_half),
                zone_high=float(price + zone_half),
            )
            if vol >= hvn_threshold:
                hvn_levels.append(level)
            elif vol <= lvn_threshold and vol > 0:
                lvn_levels.append(level)

        # Sort HVN by volume descending, LVN by volume ascending
        hvn_levels.sort(key=lambda x: -x.volume)
        lvn_levels.sort(key=lambda x: x.volume)

        poc = float(bin_centers[np.argmax(bin_volumes)])

        self._result = VolumeProfileResult(
            bin_prices=bin_centers,
            bin_volumes=bin_volumes,
            bin_width=float(bin_width),
            hvn_levels=hvn_levels,
            lvn_levels=lvn_levels,
            poc=poc,
        )
        return self._result

    def get_hvn_below(self, price: float, n: int = 3) -> list[PriceLevel]:
        """Top N high-volume nodes below given price."""
        if self._result is None:
            return []
        below = [h for h in self._result.hvn_levels if h.price < price]
        below.sort(key=lambda x: -x.price)  # nearest first
        return below[:n]

    def get_hvn_above(self, price: float, n: int = 3) -> list[PriceLevel]:
        """Top N high-volume nodes above given price (resistance)."""
        if self._result is None:
            return []
        above = [h for h in self._result.hvn_levels if h.price > price]
        above.sort(key=lambda x: x.price)  # nearest first
        return above[:n]

    def get_lvn_between(self, low: float, high: float) -> list[PriceLevel]:
        """Low-volume nodes between two prices (air pockets)."""
        if self._result is None:
            return []
        return [l for l in self._result.lvn_levels if low < l.price < high]
