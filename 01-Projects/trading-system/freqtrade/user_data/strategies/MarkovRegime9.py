"""
MarkovRegime9 — K=9 Markov Regime Executor for Freqtrade.

Architecture:
  Layer 1 (HMM Gatekeeper):  K=2 HMM → Kinetic/Quiet → Risk-On/Risk-Off
  Layer 2 (K=9 Classifier):  6D feature vector → nearest centroid → basin 0-8
  Layer 3 (Markov Logic):    Transition probabilities → position sizing + entry/exit

Basin archetypes (from topology_9basin.json):
  C0: I(R)+  Equilibrium Drift (up)       14.1%  bullish
  C1: R(D)-  Persistent Drawdown           18.1%  bearish  (force flat)
  C2: I(R)+  Equilibrium Drift (strong up) 10.7%  bullish
  C3: D(R)+  Breakout Momentum              4.2%  bullish
  C4: I(D)-  Mean-Revert Volatile (bear)    3.0%  bearish
  C5: D(R)-  Quiet Contraction             21.6%  neutral
  C6: I(R)-  Equilibrium Drift (strong dn) 11.4%  bearish
  C7: I(R)-  Equilibrium Drift (down)      14.3%  bearish
  C8: I(D)+  Mean-Revert Volatile (bull)    2.7%  bullish
"""

import json
import logging
import pickle  # Required: HMM model state uses pickle (user-specified hmm_state.pkl format)
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

# When deployed to freqtrade/user_data/strategies/, resolve up to trading-system root
_STRATEGY_FILE = Path(__file__).resolve()
_TRADING_ROOT = _STRATEGY_FILE.parent.parent.parent.parent  # strategies -> user_data -> freqtrade -> trading-system
_DATA_DIR = _TRADING_ROOT / "data"
_MODELS_DIR = _STRATEGY_FILE.parent.parent / "models"  # freqtrade/user_data/models
_GATEKEEPER_STATE_PATH = _MODELS_DIR / "gatekeeper_state.json"
_HMM_STATE_PATH = _MODELS_DIR / "hmm_state.pkl"
_NORM_PARAMS_PATH = _DATA_DIR / "normalisation_params.json"
_TRANSITION_MATRIX_PATH = _DATA_DIR / "transition_matrix.json"
_TOPOLOGY_PATH = _DATA_DIR / "topology_9basin.json"

# =============================================================================
# Configurable Parameters
# =============================================================================

# Basket
BASKET = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "ADA/USDT"]

# HMM gatekeeper (Layer 1)
MOMENTUM_WINDOW = 720           # 30 days in hourly bars
DEADBAND = 0.02                 # ±2% avg_momentum threshold
KINETIC_PERSISTENCE = 3         # bars to confirm Kinetic
QUIET_PERSISTENCE = 24          # bars to confirm Quiet
HMM_TRAIN_BARS = 365 * 24      # 1 year training window
HMM_REFIT_INTERVAL = 24        # refit every 24 bars

# K=9 classifier (Layer 2)
INDICATOR_WARMUP = 30           # bars needed before indicators are valid

# Markov position logic (Layer 3)
BULLISH_BASINS = {0, 2, 3, 8}  # C0 I(R)+, C2 I(R)+, C3 D(R)+, C8 I(D)+
BEARISH_BASINS = {1, 4, 6, 7}  # C1 R(D)-, C4 I(D)-, C6 I(R)-, C7 I(R)-
NEUTRAL_BASINS = {5}           # C5 D(R)- Quiet Contraction
FORCE_FLAT_BASIN = 1           # C1 Persistent Drawdown — always flat
CRASH_RISK_THRESHOLD = 0.60    # if P(→bearish) > this, reduce to min or flat
BASE_POSITION_SIZE = 1.0       # 100% of available capital (Freqtrade manages sizing)
MIN_POSITION_FACTOR = 0.10     # 10% of base when crash risk is high

# Bifurcation detection (C4 → C3 aggressive entry)
BIFURCATION_FROM = 4           # I(D)- Mean-Revert Volatile (bear)
BIFURCATION_TO = 3             # D(R)+ Breakout Momentum
BIFURCATION_LOOKBACK = 3       # detect transition within last N bars

# Trailing stop
TRAILING_STOP_PCT = 0.05       # 5% trailing stop as fallback


def _load_json(path: Path) -> dict:
    with open(path) as f:
        return json.load(f)


def _pair_to_token(pair: str) -> str:
    """BTC/USDT → BTC_USDT"""
    return pair.replace("/", "_")


class MarkovRegime9(IStrategy):
    """K=9 Markov Regime Executor — HMM gated, topology driven."""

    INTERFACE_VERSION = 3
    timeframe = "1h"
    can_short = False
    stoploss = -0.99                    # gatekeeper is the stop
    trailing_stop = True
    trailing_stop_positive = 0.01       # activate at +1%
    trailing_stop_positive_offset = 0.03  # trail from +3%
    trailing_only_offset_is_reached = True
    use_exit_signal = True
    exit_profit_only = False
    process_only_new_candles = True
    startup_candle_count = 999

    # ─── Internal state ─────────────────────────────────────────────
    _hmm_models: dict = {}
    _raw_regimes: dict = {}
    _confirmed_regimes: dict = {}
    _pending_regime: dict = {}
    _current_confirmed: dict = {}
    _risk_state: str = "risk_off"
    _last_refit_bar: dict = {}
    _bar_count: dict = {}

    # K=9 topology state (loaded once)
    _norm_params: dict = {}
    _centroids: np.ndarray = None       # (9, 6) array
    _transition_matrix: np.ndarray = None  # (9, 9) array
    _topology_loaded: bool = False

    # Per-pair basin tracking
    _current_basin: dict = {}           # pair → int
    _prev_basin: dict = {}              # pair → int (previous candle)

    # Cached indicator arrays for cross-pair gatekeeper (backtest mode)
    _cached_momentum: dict = {}         # pair → np.ndarray
    _cached_regimes: dict = {}          # pair → list

    # ================================================================
    # Lifecycle
    # ================================================================

    def bot_start(self, **kwargs) -> None:
        _MODELS_DIR.mkdir(parents=True, exist_ok=True)
        self._load_hmm_state()
        self._load_gatekeeper_state()
        self._load_topology()

    def bot_loop_start(self, current_time, **kwargs) -> None:
        """Cross-pair gatekeeper computation (identical to DIRAllocator)."""
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
            logger.info(f"GATEKEEPER: {prev_state} -> {self._risk_state} "
                        f"(avg_mom={avg_momentum:.4f}, consensus={hmm_consensus})")

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
    # Layer 1: HMM indicators (same as DIRAllocator)
    # ================================================================

    def populate_indicators(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        pair = metadata["pair"]

        # ── HMM features ────────────────────────────────────────────
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

        # ── 6D feature indicators (Layer 2) ─────────────────────────
        dataframe = self._compute_6d_features(dataframe, pair)

        # ── Basin classification ────────────────────────────────────
        dataframe["basin"] = self._classify_basin(dataframe, pair)

        # ── Markov scores (Layer 3) ─────────────────────────────────
        dataframe = self._compute_markov_scores(dataframe)

        # Cache for cross-pair gatekeeper (needed in backtest mode)
        self._cached_momentum[pair] = dataframe["momentum_30d"].values.copy()
        self._cached_regimes[pair] = list(dataframe["confirmed_regime"].values)

        return dataframe

    # ================================================================
    # Layer 2: 6D Feature Computation + Basin Classification
    # ================================================================

    def _compute_6d_features(self, dataframe: pd.DataFrame, pair: str) -> pd.DataFrame:
        """Compute ATR, BBW, RSI, VWAP_dist, ADX, OBV then Z-score normalise."""
        h = dataframe["high"]
        l = dataframe["low"]
        c = dataframe["close"]
        v = dataframe["volume"]

        # ATR(14)
        tr = pd.concat([
            h - l,
            (h - c.shift(1)).abs(),
            (l - c.shift(1)).abs(),
        ], axis=1).max(axis=1)
        dataframe["raw_atr"] = tr.rolling(14).mean()

        # BBW(20, 2)
        sma20 = c.rolling(20).mean()
        std20 = c.rolling(20).std()
        bbu = sma20 + 2 * std20
        bbl = sma20 - 2 * std20
        dataframe["raw_bbw"] = (bbu - bbl) / sma20

        # RSI(14)
        delta = c.diff()
        gain = delta.clip(lower=0).rolling(14).mean()
        loss = (-delta.clip(upper=0)).rolling(14).mean()
        rs = gain / loss.replace(0, np.nan)
        dataframe["raw_rsi"] = 100 - (100 / (1 + rs))

        # VWAP distance (24H rolling)
        tp = (h + l + c) / 3
        tp_vol = tp * v
        rolling_tpv = tp_vol.rolling(24, min_periods=1).sum()
        rolling_vol = v.rolling(24, min_periods=1).sum()
        vwap_24h = rolling_tpv / rolling_vol
        dataframe["raw_vwap_dist"] = (c - vwap_24h) / vwap_24h * 100

        # ADX(14)
        dataframe["raw_adx"] = self._compute_adx(h, l, c, period=14)

        # OBV
        sign = np.sign(c.diff())
        dataframe["raw_obv"] = (sign * v).cumsum()

        # Z-score normalise using training params
        token = _pair_to_token(pair)
        if token in self._norm_params:
            params = self._norm_params[token]
            raw_to_z = [
                ("raw_atr", "atr", "atr_z"),
                ("raw_bbw", "bbw", "bbw_z"),
                ("raw_rsi", "rsi", "rsi_z"),
                ("raw_vwap_dist", "vwap_dist", "vwap_dist_z"),
                ("raw_adx", "adx", "adx_z"),
                ("raw_obv", "obv", "obv_z"),
            ]
            for raw_col, param_key, z_col in raw_to_z:
                mean = params[param_key]["mean"]
                std = params[param_key]["std"]
                if std > 0:
                    dataframe[z_col] = (dataframe[raw_col] - mean) / std
                else:
                    dataframe[z_col] = 0.0
        else:
            logger.warning(f"No normalisation params for {token} — basin will be -1")
            for col in ["atr_z", "bbw_z", "rsi_z", "vwap_dist_z", "adx_z", "obv_z"]:
                dataframe[col] = np.nan

        return dataframe

    @staticmethod
    def _compute_adx(high, low, close, period=14):
        """Compute ADX without pandas_ta dependency."""
        plus_dm = high.diff()
        minus_dm = -low.diff()
        plus_dm = plus_dm.where((plus_dm > minus_dm) & (plus_dm > 0), 0.0)
        minus_dm = minus_dm.where((minus_dm > plus_dm) & (minus_dm > 0), 0.0)

        tr = pd.concat([
            high - low,
            (high - close.shift(1)).abs(),
            (low - close.shift(1)).abs(),
        ], axis=1).max(axis=1)

        atr = tr.rolling(period).mean()
        plus_di = 100 * (plus_dm.rolling(period).mean() / atr)
        minus_di = 100 * (minus_dm.rolling(period).mean() / atr)
        dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, np.nan)
        adx = dx.rolling(period).mean()
        return adx

    def _classify_basin(self, dataframe: pd.DataFrame, pair: str) -> pd.Series:
        """Find nearest centroid for each row → basin ID (0-8), or -1 if invalid."""
        feature_cols = ["atr_z", "bbw_z", "rsi_z", "vwap_dist_z", "adx_z", "obv_z"]

        basin = pd.Series(-1, index=dataframe.index, dtype=int)

        if self._centroids is None:
            return basin

        valid = dataframe[feature_cols].notna().all(axis=1)
        if valid.sum() == 0:
            return basin

        X = dataframe.loc[valid, feature_cols].values          # (n, 6)
        C = self._centroids                                     # (9, 6)
        dists = np.linalg.norm(X[:, np.newaxis, :] - C[np.newaxis, :, :], axis=2)  # (n, 9)
        nearest = np.argmin(dists, axis=1)
        basin.loc[valid] = nearest

        # Track current basin for this pair
        last_valid = basin[basin >= 0]
        if len(last_valid) > 0:
            self._prev_basin[pair] = self._current_basin.get(pair, -1)
            self._current_basin[pair] = int(last_valid.iloc[-1])

        return basin

    # ================================================================
    # Layer 3: Markov Position Logic
    # ================================================================

    def _compute_markov_scores(self, dataframe: pd.DataFrame) -> pd.DataFrame:
        """For each row, compute crash_risk, opportunity, and position_factor."""
        dataframe["crash_risk"] = 0.0
        dataframe["opportunity"] = 0.0
        dataframe["position_factor"] = 0.0
        dataframe["bifurcation_signal"] = 0

        if self._transition_matrix is None:
            return dataframe

        T = self._transition_matrix  # (9, 9)

        for idx in dataframe.index:
            basin = dataframe.loc[idx, "basin"]
            if basin < 0:
                continue

            row = T[basin]

            # Sum transition probabilities to bearish/bullish basins
            crash = sum(row[b] for b in BEARISH_BASINS if b != basin)
            opp = sum(row[b] for b in BULLISH_BASINS if b != basin)
            # Include self-transition if current basin is bullish/bearish
            if basin in BULLISH_BASINS:
                opp += row[basin]
            elif basin in BEARISH_BASINS:
                crash += row[basin]
            else:
                # Neutral — split self-transition evenly
                opp += row[basin] * 0.5
                crash += row[basin] * 0.5

            total = opp + crash
            if total > 0:
                pos_factor = BASE_POSITION_SIZE * (opp / total)
            else:
                pos_factor = 0.0

            # Force flat for persistent drawdown
            if basin == FORCE_FLAT_BASIN:
                pos_factor = 0.0

            # Crash risk override
            if crash > CRASH_RISK_THRESHOLD:
                pos_factor = min(pos_factor, MIN_POSITION_FACTOR)

            dataframe.loc[idx, "crash_risk"] = crash
            dataframe.loc[idx, "opportunity"] = opp
            dataframe.loc[idx, "position_factor"] = pos_factor

        # Bifurcation detection: C4 → C3 within lookback
        basins = dataframe["basin"].values
        for i in range(BIFURCATION_LOOKBACK, len(basins)):
            if basins[i] == BIFURCATION_TO:
                lookback_slice = basins[max(0, i - BIFURCATION_LOOKBACK):i]
                if BIFURCATION_FROM in lookback_slice:
                    dataframe.iloc[i, dataframe.columns.get_loc("bifurcation_signal")] = 1

        return dataframe

    # ================================================================
    # Entry / Exit
    # ================================================================

    def populate_entry_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        pair = metadata["pair"]
        dataframe.loc[:, "enter_long"] = 0
        dataframe.loc[:, "enter_tag"] = ""

        gk = self._compute_gatekeeper_inline(dataframe, pair)
        if gk is None:
            return dataframe
        for idx in dataframe.index:
            row_gk = gk.get(idx)
            if not row_gk:
                continue

            # Layer 1: HMM gatekeeper must say trade
            if row_gk["risk_state"] != "risk_on":
                continue
            if row_gk["top_token"] != pair:
                continue

            basin = dataframe.loc[idx, "basin"]
            pos_factor = dataframe.loc[idx, "position_factor"]
            bifurc = dataframe.loc[idx, "bifurcation_signal"]

            # Layer 2+3: Basin must be bullish or neutral with positive opportunity
            if basin in BEARISH_BASINS:
                continue
            if basin == FORCE_FLAT_BASIN:
                continue
            if pos_factor <= MIN_POSITION_FACTOR:
                continue

            # Standard entry
            if basin in BULLISH_BASINS:
                dataframe.loc[idx, "enter_long"] = 1
                dataframe.loc[idx, "enter_tag"] = f"basin_{basin}_bullish"
            elif basin in NEUTRAL_BASINS and pos_factor > 0.3:
                dataframe.loc[idx, "enter_long"] = 1
                dataframe.loc[idx, "enter_tag"] = f"basin_{basin}_neutral"

            # Bifurcation bonus: C4→C3 snap
            if bifurc == 1:
                dataframe.loc[idx, "enter_long"] = 1
                dataframe.loc[idx, "enter_tag"] = "bifurcation_c4_c3"

        return dataframe

    def populate_exit_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        pair = metadata["pair"]
        dataframe.loc[:, "exit_long"] = 0
        dataframe.loc[:, "exit_tag"] = ""

        gk = self._compute_gatekeeper_inline(dataframe, pair)
        if gk is None:
            return dataframe

        basins = dataframe["basin"].values

        for idx_pos, idx in enumerate(dataframe.index):
            row_gk = gk.get(idx)
            if not row_gk:
                continue

            # Quiet consensus: hold unconditionally (same as DIRAllocator)
            if row_gk["hmm_consensus"] == "Quiet":
                continue

            basin = basins[idx_pos]

            # Immediate exit: entered C1 Persistent Drawdown
            if basin == FORCE_FLAT_BASIN:
                dataframe.loc[idx, "exit_long"] = 1
                dataframe.loc[idx, "exit_tag"] = "basin_1_drawdown"
                continue

            # Tighten: transitioned to any bearish basin
            if basin in BEARISH_BASINS:
                dataframe.loc[idx, "exit_long"] = 1
                dataframe.loc[idx, "exit_tag"] = f"basin_{basin}_bearish"
                continue

            # Risk-off from gatekeeper
            if row_gk["risk_state"] == "risk_off":
                dataframe.loc[idx, "exit_long"] = 1
                dataframe.loc[idx, "exit_tag"] = "gatekeeper_risk_off"
                continue

            # Not top token anymore → rotate out
            if row_gk["top_token"] != pair:
                dataframe.loc[idx, "exit_long"] = 1
                dataframe.loc[idx, "exit_tag"] = "rotation_out"

        return dataframe

    def confirm_trade_entry(self, pair, order_type, amount, rate, time_in_force,
                            current_time, entry_tag, side, **kwargs) -> bool:
        # In backtest mode, gatekeeper state file may not exist.
        # Entry signals are already gated in populate_entry_trend, so allow through.
        gk = self._read_gatekeeper_state()
        if gk is None:
            return True  # Trust populate_entry_trend's filtering in backtest
        if gk.get("risk_state") != "risk_on":
            return False
        if gk.get("top_token") != pair:
            return False
        basin = self._current_basin.get(pair, -1)
        if basin == FORCE_FLAT_BASIN or basin in BEARISH_BASINS:
            return False
        return True

    def confirm_trade_exit(self, pair, trade, order_type, amount, rate,
                           time_in_force, exit_reason, current_time, **kwargs) -> bool:
        gk = self._read_gatekeeper_state()
        if gk is None:
            return True  # Trust populate_exit_trend's filtering in backtest
        if gk.get("hmm_consensus") == "Quiet":
            return False
        return True

    def custom_stake_amount(self, pair, current_time, current_rate, proposed_stake,
                            min_stake, max_stake, leverage, entry_tag, side, **kwargs) -> float:
        """Scale position by Markov opportunity/crash ratio."""
        basin = self._current_basin.get(pair, -1)
        if basin < 0 or self._transition_matrix is None:
            return proposed_stake

        row = self._transition_matrix[basin]
        crash = sum(row[b] for b in BEARISH_BASINS if b != basin)
        opp = sum(row[b] for b in BULLISH_BASINS if b != basin)
        if basin in BULLISH_BASINS:
            opp += row[basin]
        elif basin in BEARISH_BASINS:
            crash += row[basin]

        total = opp + crash
        factor = (opp / total) if total > 0 else 0.5

        if basin == FORCE_FLAT_BASIN:
            factor = 0.0
        if crash > CRASH_RISK_THRESHOLD:
            factor = min(factor, MIN_POSITION_FACTOR)

        scaled = proposed_stake * factor
        return max(scaled, min_stake) if factor > 0 else 0.0

    # ================================================================
    # Gatekeeper (inline, same logic as DIRAllocator)
    # ================================================================

    def _compute_gatekeeper_inline(self, dataframe: pd.DataFrame, current_pair: str) -> dict | None:
        n = len(dataframe)
        all_momentum = {}
        all_regimes = {}

        # Use cached data from populate_indicators (works in both backtest and live)
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
                # Use cached arrays from this pair's populate_indicators call
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
                # Fallback: try DataProvider (live mode)
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
                                all_regimes[pair] = ["Quiet"] * n
                            else:
                                padded = np.full(n, np.nan)
                                padded[n - other_n:] = mom
                                all_momentum[pair] = padded
                                all_regimes[pair] = ["Quiet"] * n
                    except Exception:
                        pass

        if len(all_momentum) < 1:
            return None

        n = len(dataframe)
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
        min_bars = 500

        if n < min_bars:
            return pd.Series(["Quiet"] * len(dataframe), index=dataframe.index)

        bar_count = self._bar_count.get(pair, 0)
        last_refit = self._last_refit_bar.get(pair, 0)

        if pair not in self._hmm_models or (bar_count - last_refit) >= HMM_REFIT_INTERVAL:
            train_len = min(HMM_TRAIN_BARS, n)
            train_data = features[-train_len:]
            model = GaussianHMM(n_components=2, covariance_type="full",
                                n_iter=100, random_state=42)
            try:
                model.fit(train_data)
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
            valid_features = dataframe.loc[valid_mask, ["log_return", "realized_vol"]].values
            raw_states = model.predict(valid_features)
            kinetic_state = int(np.argmax(model.means_[:, 1]))
            quiet_state = 1 - kinetic_state
            state_map = {kinetic_state: "Kinetic", quiet_state: "Quiet"}
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
                pending_label = current
                pending_count = 0
            elif raw == pending_label:
                pending_count += 1
                if pending_count >= thresholds.get(raw, 24):
                    current = pending_label
                confirmed[i] = current
            else:
                pending_label = raw
                pending_count = 1
                confirmed[i] = current

        self._current_confirmed[pair] = current
        self._pending_regime[pair] = (pending_label, pending_count)
        return confirmed

    # ================================================================
    # Topology / State Loading
    # ================================================================

    def _load_topology(self) -> None:
        """Load normalisation params, centroids, and transition matrix."""
        try:
            norm_data = _load_json(_NORM_PARAMS_PATH)
            self._norm_params = norm_data["normalisation"]

            # Build centroid array in feature order
            centroids_dict = norm_data["centroids"]
            feature_order = norm_data["feature_order"]
            n_clusters = len(centroids_dict)
            self._centroids = np.zeros((n_clusters, len(feature_order)))
            for cid_str, centroid in centroids_dict.items():
                cid = int(cid_str)
                for fi, feat in enumerate(feature_order):
                    self._centroids[cid, fi] = centroid[feat]

            # Build transition matrix
            trans_data = _load_json(_TRANSITION_MATRIX_PATH)
            prob_matrix = trans_data["probability_matrix"]
            self._transition_matrix = np.zeros((n_clusters, n_clusters))
            for key, val in prob_matrix.items():
                i, j = key.split("->")
                self._transition_matrix[int(i), int(j)] = val

            self._topology_loaded = True
            logger.info(f"Loaded K=9 topology: {n_clusters} centroids, "
                        f"{len(self._norm_params)} token normalisations")
        except FileNotFoundError as e:
            logger.error(f"Topology file not found: {e}")
        except Exception as e:
            logger.error(f"Failed to load topology: {e}")

    # ================================================================
    # Gatekeeper State Persistence
    # ================================================================

    def _read_gatekeeper_state(self) -> dict | None:
        try:
            with open(_GATEKEEPER_STATE_PATH) as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return None

    def _save_hmm_state(self) -> None:
        # HMM models require pickle — hmmlearn GaussianHMM is not JSON-serializable.
        # This file is only written/read by this strategy; never from untrusted sources.
        state = {
            "models": self._hmm_models,
            "bar_count": self._bar_count,
            "last_refit_bar": self._last_refit_bar,
            "current_confirmed": self._current_confirmed,
            "pending_regime": self._pending_regime,
            "risk_state": self._risk_state,
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
                state = pickle.load(f)  # noqa: S301 — trusted local file only
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
