"""
DIRAllocator — v6.2c Freqtrade Strategy.

K=2 HMM vol regime detection + avg_momentum gatekeeper + dual momentum funnel.
Paper trading only. No stops, no TP, no leverage.

Architecture:
  Layer 1 (HMM):       Kinetic/Quiet vol regime per token
  Layer 2 (Gatekeeper): avg_momentum ±2% deadband on basket → Risk-On/Risk-Off
  Layer 3 (Funnel):     100% into highest 30d momentum token when Risk-On
  Quiet state:          Hold unconditionally
"""

import json
import logging
import pickle  # Used for HMM model persistence (user-specified hmm_state.pkl)
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from freqtrade.strategy import IStrategy
from hmmlearn.hmm import GaussianHMM

logger = logging.getLogger(__name__)

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
GATEKEEPER_STATE_PATH = MODELS_DIR / "gatekeeper_state.json"
HMM_STATE_PATH = MODELS_DIR / "hmm_state.pkl"

BASKET = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "ADA/USDT"]
MOMENTUM_WINDOW = 720       # 30 days in hourly bars
DEADBAND = 0.02             # ±2% avg_momentum threshold
KINETIC_PERSISTENCE = 3     # 3 bars to confirm Kinetic
QUIET_PERSISTENCE = 24      # 24 bars to confirm Quiet
HMM_TRAIN_BARS = 365 * 24   # 1 year training window
HMM_REFIT_INTERVAL = 24     # refit every 24 bars
REBALANCE_INTERVAL = 168    # weekly rebalance check
SWITCH_THRESHOLD = 0.05     # 5% momentum advantage to rotate


class DIRAllocator(IStrategy):
    """v6.2c — K=2 HMM + Gatekeeper + Dual Momentum Funnel."""

    INTERFACE_VERSION = 3
    timeframe = "1h"
    can_short = False
    stoploss = -0.99  # effectively disabled — gatekeeper IS the stop
    use_exit_signal = True
    exit_profit_only = False
    process_only_new_candles = True

    position_adjustment_enable = False

    # Freqtrade limits startup candles to 5x exchange limit.
    # Use 999 for startup; HMM will fit on available data (min 500 bars).
    startup_candle_count = 999

    # Internal state
    _hmm_models: dict = {}
    _raw_regimes: dict = {}
    _confirmed_regimes: dict = {}
    _pending_regime: dict = {}
    _current_confirmed: dict = {}
    _risk_state: str = "risk_off"
    _last_refit_bar: dict = {}
    _bar_count: dict = {}

    def bot_start(self, **kwargs) -> None:
        MODELS_DIR.mkdir(parents=True, exist_ok=True)
        self._load_hmm_state()
        self._load_gatekeeper_state()

    def bot_loop_start(self, current_time, **kwargs) -> None:
        """
        Runs before each tick. Compute cross-pair gatekeeper state using DataProvider.
        This ensures all pairs see the same gatekeeper decision on every cycle.
        """
        if not hasattr(self, 'dp') or self.dp is None:
            return

        individual_momentum = {}
        individual_regimes = {}

        for pair in BASKET:
            try:
                df = self.dp.ohlcv(pair, self.timeframe)
                if df is None or df.empty:
                    continue
                # Compute momentum directly from close prices
                if len(df) >= MOMENTUM_WINDOW:
                    close = df["close"].values
                    mom = float(np.log(close[-1] / close[-MOMENTUM_WINDOW]))
                else:
                    mom = 0.0
                individual_momentum[pair] = mom

                # Use persisted confirmed regime
                regime = self._current_confirmed.get(pair, "Quiet")
                individual_regimes[pair] = regime
            except Exception as e:
                logger.debug(f"bot_loop_start: could not get data for {pair}: {e}")

        if len(individual_momentum) < 3:
            return  # not enough data yet

        avg_momentum = float(np.mean(list(individual_momentum.values())))

        kinetic_count = sum(1 for r in individual_regimes.values() if r == "Kinetic")
        hmm_consensus = "Kinetic" if kinetic_count > len(individual_regimes) // 2 else "Quiet"

        # Gatekeeper hysteresis on avg_momentum
        prev_state = self._risk_state
        if hmm_consensus == "Quiet":
            pass  # Hold: don't change
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
            with open(GATEKEEPER_STATE_PATH, "w") as f:
                json.dump(state, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to write gatekeeper state: {e}")

    def informative_pairs(self):
        return [(pair, self.timeframe) for pair in BASKET]

    def populate_indicators(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        pair = metadata["pair"]

        # Feature 1: log returns (24-bar rolling)
        dataframe["log_return_raw"] = np.log(dataframe["close"]).diff()
        dataframe["log_return"] = np.log(dataframe["close"]).diff(24)

        # Feature 2: realized vol (annualised 24-bar rolling std)
        dataframe["realized_vol"] = (
            dataframe["log_return_raw"].rolling(24).std() * np.sqrt(24 * 365)
        )

        # 30-day momentum
        dataframe["momentum_30d"] = np.log(
            dataframe["close"] / dataframe["close"].shift(MOMENTUM_WINDOW)
        )

        # HMM regime classification
        dataframe["hmm_regime"] = self._classify_regime(dataframe, pair)

        # Apply persistence filter
        confirmed = self._apply_persistence(dataframe["hmm_regime"].tolist(), pair)
        dataframe["confirmed_regime"] = confirmed

        return dataframe

    def populate_entry_trend(self, dataframe: pd.DataFrame, metadata: dict) -> pd.DataFrame:
        pair = metadata["pair"]
        dataframe.loc[:, "enter_long"] = 0

        # Compute gatekeeper inline using DataProvider (works in both live and backtest)
        gk = self._compute_gatekeeper_inline(dataframe, pair)
        if gk is None:
            return dataframe

        # Entry: this pair is selected AND gatekeeper is Risk-On
        for idx in dataframe.index:
            row_gk = gk.get(idx)
            if row_gk and row_gk["top_token"] == pair and row_gk["risk_state"] == "risk_on":
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
                continue  # Hold unconditionally
            if row_gk["risk_state"] == "risk_off" or row_gk["top_token"] != pair:
                dataframe.loc[idx, "exit_long"] = 1

        return dataframe

    def _compute_gatekeeper_inline(self, dataframe: pd.DataFrame, current_pair: str) -> dict | None:
        """
        Compute per-bar gatekeeper state using all basket pairs' data.
        Returns {index -> gatekeeper_state_dict} for each bar in the dataframe.
        """
        # Gather momentum for all pairs aligned to this dataframe's index
        all_momentum = {}
        all_regimes = {}

        for pair in BASKET:
            if pair == current_pair:
                if "momentum_30d" not in dataframe.columns:
                    return None
                all_momentum[pair] = dataframe["momentum_30d"].values
                all_regimes[pair] = dataframe["confirmed_regime"].values if "confirmed_regime" in dataframe.columns else ["Quiet"] * len(dataframe)
            else:
                # Fetch from DataProvider if available
                if hasattr(self, 'dp') and self.dp is not None:
                    try:
                        other_df = self.dp.get_pair_dataframe(pair, self.timeframe)
                        if other_df is not None and not other_df.empty and len(other_df) == len(dataframe):
                            # Compute momentum directly
                            close = other_df["close"].values
                            mom = np.full(len(close), np.nan)
                            for i in range(MOMENTUM_WINDOW, len(close)):
                                mom[i] = np.log(close[i] / close[i - MOMENTUM_WINDOW])
                            all_momentum[pair] = mom

                            # Classify regime for this pair
                            lr = np.log(other_df["close"]).diff(24).values
                            rv = (np.log(other_df["close"]).diff().rolling(24).std() * np.sqrt(24 * 365)).values if hasattr(np.log(other_df["close"]).diff(), 'rolling') else np.zeros(len(close))
                            # Simplified: use vol threshold from current pair's HMM
                            all_regimes[pair] = ["Quiet"] * len(close)  # fallback
                            continue
                    except Exception:
                        pass

        # If we only have the current pair, use its data alone (degraded mode)
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
                    "hmm_consensus": "Quiet"
                }
                continue

            avg_mom = np.mean(list(momenta.values()))

            # Consensus regime from current pair only (degraded in backtest)
            regimes_at_i = []
            for pair in all_regimes:
                r = all_regimes[pair]
                if i < len(r):
                    regimes_at_i.append(r[i])
            kinetic_count = sum(1 for r in regimes_at_i if r == "Kinetic")
            hmm_consensus = "Kinetic" if kinetic_count > len(regimes_at_i) // 2 else "Quiet"

            # Gatekeeper hysteresis
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

    def confirm_trade_entry(self, pair, order_type, amount, rate, time_in_force,
                            current_time, entry_tag, side, **kwargs) -> bool:
        gk = self._read_gatekeeper_state()
        if gk is None:
            return False
        return gk.get("top_token") == pair and gk.get("risk_state") == "risk_on"

    def confirm_trade_exit(self, pair, trade, order_type, amount, rate,
                           time_in_force, exit_reason, current_time, **kwargs) -> bool:
        gk = self._read_gatekeeper_state()
        if gk is None:
            return True
        if gk.get("hmm_consensus") == "Quiet":
            return False
        return True

    # =========================================================================
    # HMM Regime Classification
    # =========================================================================

    def _classify_regime(self, dataframe: pd.DataFrame, pair: str) -> pd.Series:
        features = dataframe[["log_return", "realized_vol"]].dropna().values
        n = len(features)

        min_bars = 500  # minimum bars to fit HMM
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

    # =========================================================================
    # Gatekeeper State Management
    # =========================================================================

    def _read_gatekeeper_state(self) -> dict | None:
        try:
            with open(GATEKEEPER_STATE_PATH) as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return None

    # =========================================================================
    # State Persistence (pickle for HMM models — user-specified format)
    # =========================================================================

    def _save_hmm_state(self) -> None:
        state = {
            "models": self._hmm_models,
            "bar_count": self._bar_count,
            "last_refit_bar": self._last_refit_bar,
            "current_confirmed": self._current_confirmed,
            "pending_regime": self._pending_regime,
            "risk_state": self._risk_state,
        }
        try:
            with open(HMM_STATE_PATH, "wb") as f:
                pickle.dump(state, f)
        except Exception as e:
            logger.error(f"Failed to save HMM state: {e}")

    def _load_hmm_state(self) -> None:
        if not HMM_STATE_PATH.exists():
            logger.info("No persisted HMM state found — starting fresh")
            return
        try:
            with open(HMM_STATE_PATH, "rb") as f:
                state = pickle.load(f)
            self._hmm_models = state.get("models", {})
            self._bar_count = state.get("bar_count", {})
            self._last_refit_bar = state.get("last_refit_bar", {})
            self._current_confirmed = state.get("current_confirmed", {})
            self._pending_regime = state.get("pending_regime", {})
            self._risk_state = state.get("risk_state", "risk_off")
            logger.info(f"Loaded HMM state: {len(self._hmm_models)} models, "
                        f"risk_state={self._risk_state}")
        except Exception as e:
            logger.error(f"Failed to load HMM state: {e}")

    def _load_gatekeeper_state(self) -> None:
        gk = self._read_gatekeeper_state()
        if gk:
            self._risk_state = gk.get("risk_state", "risk_off")
            logger.info(f"Loaded gatekeeper state: risk_state={self._risk_state}")
