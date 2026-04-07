"""
MarkovRegime9v3 — v6.2c + K=9 Sizing + Entry Filtering.

Built on v2 (sizing modulator). Adds two evidence-based filters from
the Bayesian fingerprint analysis (commit 70f1d09):

  1. C3 Blacklist (hard gate): Basin C3 has 75% loss rate on 12 trades.
     Entries are blocked when current basin is C3.
  2. Quiet Grind Filter (soft modulation): Winners had lower ATR (-0.39),
     higher RSI (+0.36), lower ADX (-0.31) at entry. A kinematic quality
     multiplier rewards quiet momentum and penalises loud breakouts.

Architecture:
  Layer 1 (HMM):       Kinetic/Quiet -> Risk-On/Risk-Off (unchanged)
  Layer 2 (Gatekeeper): avg_momentum +/-2% deadband (unchanged)
  Layer 3 (Funnel):     100% into highest momentum token (unchanged)
  Layer 4 (v2):         K=9 basin -> sizing scalar (0.1 to 1.0)
  Layer 5 (NEW):        C3 blacklist + kinematic quality multiplier
"""

import json
import logging
import math
import pickle  # Required by user spec: HMM models (hmmlearn GaussianHMM) need pickle — not JSON-serializable
from collections import deque
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from freqtrade.strategy import IStrategy
from hmmlearn.hmm import GaussianHMM

logger = logging.getLogger(__name__)

# =============================================================================
# Paths
# =============================================================================

_STRATEGY_FILE = Path(__file__).resolve()
_TRADING_ROOT = _STRATEGY_FILE.parent.parent.parent.parent
_DATA_DIR = _TRADING_ROOT / "data"
_MODELS_DIR = _STRATEGY_FILE.parent.parent / "models"
_GATEKEEPER_STATE_PATH = _MODELS_DIR / "gatekeeper_state.json"
_HMM_STATE_PATH = _MODELS_DIR / "hmm_state.pkl"
_NORM_PARAMS_PATH = _DATA_DIR / "normalisation_params.json"
_TRANSITION_MATRIX_PATH = _DATA_DIR / "transition_matrix.json"

# =============================================================================
# v6.2c Parameters (UNCHANGED)
# =============================================================================

BASKET = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "ADA/USDT"]
MOMENTUM_WINDOW = 720
DEADBAND = 0.02
KINETIC_PERSISTENCE = 3
QUIET_PERSISTENCE = 24
HMM_TRAIN_BARS = 365 * 24
HMM_REFIT_INTERVAL = 24

# =============================================================================
# K=9 Sizing Modulator Parameters (NEW)
# =============================================================================

FLICKER_WINDOW = 12          # hours of basin history to track
PERSISTENCE_THRESHOLD = 3    # consecutive hours to confirm stable basin
FLICKER_DECAY_RATE = 0.5     # exponential decay constant
SIZING_FLOOR = 0.1           # minimum sizing scalar
SIZING_CEILING = 1.0         # maximum sizing scalar (normal)
C1_DRAWDOWN_CAP = 0.15       # max sizing when stable in C1 (Persistent Drawdown)

BULLISH_BASINS = {0, 2, 8}   # C3 removed — 75% loss rate (fingerprint analysis)
BEARISH_BASINS = {1, 4, 6, 7}
NEUTRAL_BASINS = {5}
BLACKLIST_BASINS = {3}        # C3: hard entry block, anti-edge
FORCE_FLAT_BASIN = 1          # C1 Persistent Drawdown

# ── Quiet Grind Filter (v3) ────────────────────────────────────────────
HEAT_PENALTY_RATE = 0.2       # ATR penalty slope
HEAT_PENALTY_FLOOR = 0.3      # minimum heat multiplier
MOMENTUM_BONUS_RATE = 0.15    # RSI bonus slope
MOMENTUM_BONUS_CAP = 1.3      # maximum momentum multiplier


def _load_json(path: Path) -> dict:
    with open(path) as f:
        return json.load(f)


def _pair_to_token(pair: str) -> str:
    return pair.replace("/", "_")


class MarkovRegime9v3(IStrategy):
    """v6.2c + K=9 sizing modulator. Entry/exit identical to DIRAllocator."""

    INTERFACE_VERSION = 3
    timeframe = "1h"
    can_short = False
    stoploss = -0.99
    use_exit_signal = True
    exit_profit_only = False
    process_only_new_candles = True
    startup_candle_count = 999

    # ─── v6.2c internal state ───────────────────────────────────────
    _hmm_models: dict = {}
    _raw_regimes: dict = {}
    _confirmed_regimes: dict = {}
    _pending_regime: dict = {}
    _current_confirmed: dict = {}
    _risk_state: str = "risk_off"
    _last_refit_bar: dict = {}
    _bar_count: dict = {}

    # Cross-pair cache (backtest fix)
    _cached_momentum: dict = {}
    _cached_regimes: dict = {}

    # ─── K=9 sizing state ───────────────────────────────────────────
    _norm_params: dict = {}
    _centroids: np.ndarray = None
    _transition_matrix: np.ndarray = None
    _topology_loaded: bool = False

    _basin_history: dict = {}       # pair -> deque of last FLICKER_WINDOW basins
    _current_basin: dict = {}       # pair -> int
    _sizing_scalar: dict = {}       # pair -> float (last computed scalar)
    _last_atr_z: dict = {}          # pair -> float (for quiet grind filter)
    _last_rsi_z: dict = {}          # pair -> float (for quiet grind filter)

    # ================================================================
    # Lifecycle
    # ================================================================

    def bot_start(self, **kwargs) -> None:
        _MODELS_DIR.mkdir(parents=True, exist_ok=True)
        self._load_hmm_state()
        self._load_gatekeeper_state()
        self._load_topology()

    def bot_loop_start(self, current_time, **kwargs) -> None:
        """Cross-pair gatekeeper — identical to DIRAllocator."""
        if not hasattr(self, "dp") or self.dp is None:
            return

        individual_momentum = {}
        individual_regimes = {}

        for pair in BASKET:
            try:
                df = self.dp.ohlcv(pair, self.timeframe)
                if df is None or df.empty:
                    continue
                if len(df) >= MOMENTUM_WINDOW:
                    close = df["close"].values
                    mom = float(np.log(close[-1] / close[-MOMENTUM_WINDOW]))
                else:
                    mom = 0.0
                individual_momentum[pair] = mom
                individual_regimes[pair] = self._current_confirmed.get(pair, "Quiet")
            except Exception as e:
                logger.debug(f"bot_loop_start: {pair}: {e}")

        if len(individual_momentum) < 3:
            return

        avg_momentum = float(np.mean(list(individual_momentum.values())))
        kinetic_count = sum(1 for r in individual_regimes.values() if r == "Kinetic")
        hmm_consensus = "Kinetic" if kinetic_count > len(individual_regimes) // 2 else "Quiet"

        prev_state = self._risk_state
        if hmm_consensus == "Quiet":
            pass
        elif self._risk_state == "risk_off":
            if avg_momentum > DEADBAND:
                self._risk_state = "risk_on"
        else:
            if avg_momentum < -DEADBAND:
                self._risk_state = "risk_off"

        if self._risk_state != prev_state:
            logger.info(f"GATEKEEPER: {prev_state} -> {self._risk_state}")

        top_token = max(individual_momentum, key=individual_momentum.get)
        state = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "avg_momentum": avg_momentum,
            "risk_state": self._risk_state,
            "top_token": top_token,
            "hmm_consensus": hmm_consensus,
            "individual_momentum": individual_momentum,
            "individual_regimes": individual_regimes,
        }
        try:
            with open(_GATEKEEPER_STATE_PATH, "w") as f:
                json.dump(state, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to write gatekeeper state: {e}")

    def informative_pairs(self):
        return [(pair, self.timeframe) for pair in BASKET]

    # ================================================================
    # Indicators — v6.2c HMM + K=9 features (for sizing only)
    # ================================================================

    def populate_indicators(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        pair = metadata["pair"]

        # ── v6.2c HMM features (unchanged) ──────────────────────────
        dataframe["log_return_raw"] = np.log(dataframe["close"]).diff()
        dataframe["log_return"] = np.log(dataframe["close"]).diff(24)
        dataframe["realized_vol"] = (
            dataframe["log_return_raw"].rolling(24).std() * np.sqrt(24 * 365)
        )
        dataframe["momentum_30d"] = np.log(
            dataframe["close"] / dataframe["close"].shift(MOMENTUM_WINDOW)
        )
        dataframe["hmm_regime"] = self._classify_regime(dataframe, pair)
        confirmed = self._apply_persistence(dataframe["hmm_regime"].tolist(), pair)
        dataframe["confirmed_regime"] = confirmed

        # Cache for cross-pair gatekeeper
        self._cached_momentum[pair] = dataframe["momentum_30d"].values.copy()
        self._cached_regimes[pair] = list(dataframe["confirmed_regime"].values)

        # ── K=9 features (sizing + quiet grind filter) ───────────────
        dataframe = self._compute_6d_features(dataframe, pair)
        dataframe["basin"] = self._classify_basin_series(dataframe, pair)
        dataframe = self._compute_sizing_scalars(dataframe, pair)

        # Cache last valid z-scores for quiet grind filter in custom_stake_amount
        last_valid_atr = dataframe["atr_z"].dropna()
        last_valid_rsi = dataframe["rsi_z"].dropna()
        if len(last_valid_atr) > 0:
            self._last_atr_z[pair] = float(last_valid_atr.iloc[-1])
        if len(last_valid_rsi) > 0:
            self._last_rsi_z[pair] = float(last_valid_rsi.iloc[-1])

        return dataframe

    # ================================================================
    # Entry/Exit — v6.2c + C3 blacklist (v3)
    # ================================================================

    def populate_entry_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        pair = metadata["pair"]
        dataframe.loc[:, "enter_long"] = 0

        gk = self._compute_gatekeeper_inline(dataframe, pair)
        if gk is None:
            return dataframe

        basins = dataframe["basin"].values

        for idx in dataframe.index:
            row_gk = gk.get(idx)
            if row_gk and row_gk["top_token"] == pair and row_gk["risk_state"] == "risk_on":
                # C3 blacklist: hard gate — 75% loss rate from fingerprint analysis
                pos = dataframe.index.get_loc(idx)
                if int(basins[pos]) in BLACKLIST_BASINS:
                    continue
                dataframe.loc[idx, "enter_long"] = 1

        return dataframe

    def populate_exit_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        pair = metadata["pair"]
        dataframe.loc[:, "exit_long"] = 0

        gk = self._compute_gatekeeper_inline(dataframe, pair)
        if gk is None:
            return dataframe

        for idx in dataframe.index:
            row_gk = gk.get(idx)
            if row_gk is None:
                continue
            if row_gk["hmm_consensus"] == "Quiet":
                continue
            if row_gk["risk_state"] == "risk_off" or row_gk["top_token"] != pair:
                dataframe.loc[idx, "exit_long"] = 1

        return dataframe

    def confirm_trade_entry(self, pair, order_type, amount, rate, time_in_force,
                            current_time, entry_tag, side, **kwargs) -> bool:
        gk = self._read_gatekeeper_state()
        if gk is None:
            return True  # Backtest: trust populate_entry_trend
        return gk.get("top_token") == pair and gk.get("risk_state") == "risk_on"

    def confirm_trade_exit(self, pair, trade, order_type, amount, rate,
                           time_in_force, exit_reason, current_time, **kwargs) -> bool:
        gk = self._read_gatekeeper_state()
        if gk is None:
            return True
        if gk.get("hmm_consensus") == "Quiet":
            return False
        return True

    # ================================================================
    # K=9 Sizing Modulator + Quiet Grind Filter (v3)
    # ================================================================

    def custom_stake_amount(self, pair, current_time, current_rate, proposed_stake,
                            min_stake, max_stake, leverage, entry_tag, side, **kwargs) -> float:
        """Scale position size: K=9 basin stability * kinematic quality."""
        scalar = self._sizing_scalar.get(pair, 1.0)

        # Quiet grind filter: reward calm momentum, penalise loud breakouts
        atr_z = self._last_atr_z.get(pair, 0.0)
        rsi_z = self._last_rsi_z.get(pair, 0.0)
        heat_penalty = max(HEAT_PENALTY_FLOOR, 1.0 - HEAT_PENALTY_RATE * max(0, atr_z))
        momentum_bonus = min(MOMENTUM_BONUS_CAP, 1.0 + MOMENTUM_BONUS_RATE * max(0, rsi_z))
        kinematic_quality = heat_penalty * momentum_bonus

        final = scalar * kinematic_quality
        final = max(SIZING_FLOOR, min(SIZING_CEILING, final))
        scaled = proposed_stake * final
        return max(scaled, min_stake)

    def _compute_sizing_scalars(self, dataframe: pd.DataFrame, pair: str) -> pd.DataFrame:
        """Compute per-bar sizing scalar from basin + flicker + Markov."""
        dataframe["sizing_scalar"] = 1.0
        dataframe["flicker_count"] = 0
        dataframe["stable_basin"] = -1

        basins = dataframe["basin"].values
        n = len(basins)

        # Track basin history as rolling window
        history = deque(maxlen=FLICKER_WINDOW)

        for i in range(n):
            basin = int(basins[i])
            history.append(basin)

            if basin < 0 or self._transition_matrix is None:
                dataframe.iloc[i, dataframe.columns.get_loc("sizing_scalar")] = 1.0
                continue

            # Flicker count: number of basin changes in window
            flicker = 0
            hist_list = list(history)
            for j in range(1, len(hist_list)):
                if hist_list[j] != hist_list[j - 1]:
                    flicker += 1
            dataframe.iloc[i, dataframe.columns.get_loc("flicker_count")] = flicker

            # Stable basin: basin held for PERSISTENCE_THRESHOLD+ consecutive hours
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
            dataframe.iloc[i, dataframe.columns.get_loc("stable_basin")] = stable

            # Markov confidence
            row = self._transition_matrix[basin]
            opp = sum(row[b] for b in BULLISH_BASINS)
            crash = sum(row[b] for b in BEARISH_BASINS)
            total = opp + crash
            markov_conf = (opp / total) if total > 0 else 0.5

            # Flicker penalty
            flicker_penalty = math.exp(-FLICKER_DECAY_RATE * flicker)

            # Combined scalar
            scalar = markov_conf * flicker_penalty
            scalar = max(SIZING_FLOOR, min(SIZING_CEILING, scalar))

            # Basin-specific overrides
            if stable == FORCE_FLAT_BASIN:
                scalar = min(scalar, C1_DRAWDOWN_CAP)

            # Bifurcation bonus removed in v3 — C3 is blacklisted

            dataframe.iloc[i, dataframe.columns.get_loc("sizing_scalar")] = round(scalar, 4)

        # Cache the last scalar for custom_stake_amount
        last_valid = dataframe.loc[dataframe["basin"] >= 0, "sizing_scalar"]
        if len(last_valid) > 0:
            self._sizing_scalar[pair] = float(last_valid.iloc[-1])

        return dataframe

    # ================================================================
    # 6D Feature Computation + Basin Classification
    # ================================================================

    def _compute_6d_features(self, dataframe: pd.DataFrame, pair: str) -> pd.DataFrame:
        h, l, c, v = dataframe["high"], dataframe["low"], dataframe["close"], dataframe["volume"]

        tr = pd.concat([h - l, (h - c.shift(1)).abs(), (l - c.shift(1)).abs()], axis=1).max(axis=1)
        dataframe["raw_atr"] = tr.rolling(14).mean()

        sma20 = c.rolling(20).mean()
        std20 = c.rolling(20).std()
        dataframe["raw_bbw"] = ((sma20 + 2 * std20) - (sma20 - 2 * std20)) / sma20

        delta = c.diff()
        gain = delta.clip(lower=0).rolling(14).mean()
        loss = (-delta.clip(upper=0)).rolling(14).mean()
        rs = gain / loss.replace(0, np.nan)
        dataframe["raw_rsi"] = 100 - (100 / (1 + rs))

        tp = (h + l + c) / 3
        vwap_24h = (tp * v).rolling(24, min_periods=1).sum() / v.rolling(24, min_periods=1).sum()
        dataframe["raw_vwap_dist"] = (c - vwap_24h) / vwap_24h * 100

        dataframe["raw_adx"] = self._compute_adx(h, l, c, 14)

        dataframe["raw_obv"] = (np.sign(c.diff()) * v).cumsum()

        token = _pair_to_token(pair)
        if token in self._norm_params:
            params = self._norm_params[token]
            for raw, key, z in [("raw_atr", "atr", "atr_z"), ("raw_bbw", "bbw", "bbw_z"),
                                ("raw_rsi", "rsi", "rsi_z"), ("raw_vwap_dist", "vwap_dist", "vwap_dist_z"),
                                ("raw_adx", "adx", "adx_z"), ("raw_obv", "obv", "obv_z")]:
                m, s = params[key]["mean"], params[key]["std"]
                dataframe[z] = (dataframe[raw] - m) / s if s > 0 else 0.0
        else:
            for z in ["atr_z", "bbw_z", "rsi_z", "vwap_dist_z", "adx_z", "obv_z"]:
                dataframe[z] = np.nan

        return dataframe

    @staticmethod
    def _compute_adx(high, low, close, period=14):
        plus_dm = high.diff()
        minus_dm = -low.diff()
        plus_dm = plus_dm.where((plus_dm > minus_dm) & (plus_dm > 0), 0.0)
        minus_dm = minus_dm.where((minus_dm > plus_dm) & (minus_dm > 0), 0.0)
        tr = pd.concat([high - low, (high - close.shift(1)).abs(),
                        (low - close.shift(1)).abs()], axis=1).max(axis=1)
        atr = tr.rolling(period).mean()
        plus_di = 100 * (plus_dm.rolling(period).mean() / atr)
        minus_di = 100 * (minus_dm.rolling(period).mean() / atr)
        dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, np.nan)
        return dx.rolling(period).mean()

    def _classify_basin_series(self, dataframe: pd.DataFrame, pair: str) -> pd.Series:
        feat_cols = ["atr_z", "bbw_z", "rsi_z", "vwap_dist_z", "adx_z", "obv_z"]
        basin = pd.Series(-1, index=dataframe.index, dtype=int)
        if self._centroids is None:
            return basin
        valid = dataframe[feat_cols].notna().all(axis=1)
        if valid.sum() == 0:
            return basin
        X = dataframe.loc[valid, feat_cols].values
        dists = np.linalg.norm(X[:, np.newaxis, :] - self._centroids[np.newaxis, :, :], axis=2)
        basin.loc[valid] = np.argmin(dists, axis=1)

        last_valid = basin[basin >= 0]
        if len(last_valid) > 0:
            self._current_basin[pair] = int(last_valid.iloc[-1])
        return basin

    # ================================================================
    # Gatekeeper (with backtest cross-pair cache)
    # ================================================================

    def _compute_gatekeeper_inline(self, dataframe: pd.DataFrame, current_pair: str) -> dict | None:
        n = len(dataframe)
        all_momentum = {}
        all_regimes = {}

        for pair in BASKET:
            if pair == current_pair:
                if "momentum_30d" not in dataframe.columns:
                    return None
                all_momentum[pair] = dataframe["momentum_30d"].values
                all_regimes[pair] = (
                    dataframe["confirmed_regime"].values
                    if "confirmed_regime" in dataframe.columns
                    else ["Quiet"] * n
                )
            elif pair in self._cached_momentum:
                cached_mom = self._cached_momentum[pair]
                cached_reg = self._cached_regimes[pair]
                other_n = len(cached_mom)
                if other_n >= n:
                    all_momentum[pair] = cached_mom[-n:]
                    all_regimes[pair] = cached_reg[-n:]
                else:
                    padded = np.full(n, np.nan)
                    padded[n - other_n:] = cached_mom
                    all_momentum[pair] = padded
                    all_regimes[pair] = ["Quiet"] * (n - other_n) + cached_reg
            else:
                if hasattr(self, "dp") and self.dp is not None:
                    try:
                        other_df = self.dp.get_pair_dataframe(pair, self.timeframe)
                        if other_df is not None and not other_df.empty:
                            close = other_df["close"].values
                            other_n = len(close)
                            mom = np.full(other_n, np.nan)
                            for i in range(MOMENTUM_WINDOW, other_n):
                                mom[i] = np.log(close[i] / close[i - MOMENTUM_WINDOW])
                            if other_n >= n:
                                all_momentum[pair] = mom[-n:]
                            else:
                                padded = np.full(n, np.nan)
                                padded[n - other_n:] = mom
                                all_momentum[pair] = padded
                            all_regimes[pair] = ["Quiet"] * n
                    except Exception:
                        pass

        if len(all_momentum) < 1:
            return None

        result = {}
        risk_state = "risk_off"

        for i in range(n):
            momenta = {}
            for pair in all_momentum:
                m = all_momentum[pair]
                if i < len(m) and not np.isnan(m[i]):
                    momenta[pair] = float(m[i])

            if not momenta:
                result[dataframe.index[i]] = {
                    "risk_state": risk_state, "top_token": current_pair,
                    "hmm_consensus": "Quiet",
                }
                continue

            avg_mom = np.mean(list(momenta.values()))
            regimes_at_i = []
            for pair in all_regimes:
                r = all_regimes[pair]
                if i < len(r):
                    regimes_at_i.append(r[i])
            kinetic_count = sum(1 for r in regimes_at_i if r == "Kinetic")
            hmm_consensus = "Kinetic" if kinetic_count > len(regimes_at_i) // 2 else "Quiet"

            if hmm_consensus == "Quiet":
                pass
            elif risk_state == "risk_off":
                if avg_mom > DEADBAND:
                    risk_state = "risk_on"
            else:
                if avg_mom < -DEADBAND:
                    risk_state = "risk_off"

            top_token = max(momenta, key=momenta.get) if momenta else current_pair
            result[dataframe.index[i]] = {
                "risk_state": risk_state,
                "top_token": top_token,
                "hmm_consensus": hmm_consensus,
            }

        return result

    # ================================================================
    # HMM Classification (identical to DIRAllocator)
    # ================================================================

    def _classify_regime(self, dataframe: pd.DataFrame, pair: str) -> pd.Series:
        features = dataframe[["log_return", "realized_vol"]].dropna().values
        n = len(features)
        if n < 500:
            return pd.Series(["Quiet"] * len(dataframe), index=dataframe.index)

        bar_count = self._bar_count.get(pair, 0)
        last_refit = self._last_refit_bar.get(pair, 0)

        if pair not in self._hmm_models or (bar_count - last_refit) >= HMM_REFIT_INTERVAL:
            train_len = min(HMM_TRAIN_BARS, n)
            model = GaussianHMM(n_components=2, covariance_type="full",
                                n_iter=100, random_state=42)
            try:
                model.fit(features[-train_len:])
            except Exception as e:
                logger.warning(f"HMM fit failed for {pair}: {e}")
                return pd.Series(["Quiet"] * len(dataframe), index=dataframe.index)
            self._hmm_models[pair] = model
            self._last_refit_bar[pair] = bar_count
            self._save_hmm_state()

        model = self._hmm_models[pair]
        valid_mask = dataframe[["log_return", "realized_vol"]].notna().all(axis=1)
        regimes = ["Quiet"] * len(dataframe)

        if valid_mask.sum() > 0:
            raw_states = model.predict(
                dataframe.loc[valid_mask, ["log_return", "realized_vol"]].values
            )
            kinetic_state = int(np.argmax(model.means_[:, 1]))
            state_map = {kinetic_state: "Kinetic", 1 - kinetic_state: "Quiet"}
            labels = [state_map.get(int(s), "Quiet") for s in raw_states]
            j = 0
            for i in range(len(dataframe)):
                if valid_mask.iloc[i]:
                    regimes[i] = labels[j]
                    j += 1

        self._bar_count[pair] = bar_count + 1
        return pd.Series(regimes, index=dataframe.index)

    def _apply_persistence(self, regimes: list, pair: str) -> list:
        thresholds = {"Kinetic": KINETIC_PERSISTENCE, "Quiet": QUIET_PERSISTENCE}
        confirmed = list(regimes)
        current = self._current_confirmed.get(pair, regimes[0])
        pending_label, pending_count = self._pending_regime.get(pair, (current, 0))

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

        self._current_confirmed[pair] = current
        self._pending_regime[pair] = (pending_label, pending_count)
        return confirmed

    # ================================================================
    # Topology Loading
    # ================================================================

    def _load_topology(self) -> None:
        try:
            norm_data = _load_json(_NORM_PARAMS_PATH)
            self._norm_params = norm_data["normalisation"]
            feature_order = norm_data["feature_order"]
            centroids_dict = norm_data["centroids"]
            n_clusters = len(centroids_dict)
            self._centroids = np.zeros((n_clusters, len(feature_order)))
            for cid_str, centroid in centroids_dict.items():
                for fi, feat in enumerate(feature_order):
                    self._centroids[int(cid_str), fi] = centroid[feat]

            trans_data = _load_json(_TRANSITION_MATRIX_PATH)
            self._transition_matrix = np.zeros((n_clusters, n_clusters))
            for key, val in trans_data["probability_matrix"].items():
                i, j = key.split("->")
                self._transition_matrix[int(i), int(j)] = val

            self._topology_loaded = True
            logger.info(f"Loaded K=9 topology: {n_clusters} centroids")
        except FileNotFoundError as e:
            logger.error(f"Topology file not found: {e}")
        except Exception as e:
            logger.error(f"Failed to load topology: {e}")

    # ================================================================
    # State Persistence
    # ================================================================

    def _read_gatekeeper_state(self) -> dict | None:
        try:
            with open(_GATEKEEPER_STATE_PATH) as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return None

    def _save_hmm_state(self) -> None:
        # HMM models require pickle — hmmlearn objects aren't JSON-serializable.
        # Only written/read by this strategy from trusted local disk.
        state = {
            "models": self._hmm_models, "bar_count": self._bar_count,
            "last_refit_bar": self._last_refit_bar,
            "current_confirmed": self._current_confirmed,
            "pending_regime": self._pending_regime, "risk_state": self._risk_state,
        }
        try:
            with open(_HMM_STATE_PATH, "wb") as f:
                pickle.dump(state, f)
        except Exception as e:
            logger.error(f"Failed to save HMM state: {e}")

    def _load_hmm_state(self) -> None:
        if not _HMM_STATE_PATH.exists():
            logger.info("No persisted HMM state — starting fresh")
            return
        try:
            with open(_HMM_STATE_PATH, "rb") as f:
                state = pickle.load(f)  # noqa: S301 — trusted local file
            self._hmm_models = state.get("models", {})
            self._bar_count = state.get("bar_count", {})
            self._last_refit_bar = state.get("last_refit_bar", {})
            self._current_confirmed = state.get("current_confirmed", {})
            self._pending_regime = state.get("pending_regime", {})
            self._risk_state = state.get("risk_state", "risk_off")
            logger.info(f"Loaded HMM state: {len(self._hmm_models)} models")
        except Exception as e:
            logger.error(f"Failed to load HMM state: {e}")

    def _load_gatekeeper_state(self) -> None:
        gk = self._read_gatekeeper_state()
        if gk:
            self._risk_state = gk.get("risk_state", "risk_off")
