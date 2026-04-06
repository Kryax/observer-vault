"""
Regime-Gated Dual Momentum Allocator — v6.1 (Fluid Dynamic State Machine).

Kinetic + momentum > +deadband  → Risk ON (top momentum token)
Kinetic + momentum < -deadband  → Risk OFF (cash)
Kinetic + momentum in deadband  → Hold current allocation
Quiet + holding token            → Hold position
Quiet + cash + momentum > quiet_threshold → Deploy (stealth trend)
Quiet + cash + momentum <= quiet_threshold → Hold cash
"""

import numpy as np
import pandas as pd


class DualMomentumAllocator:

    def __init__(
        self,
        momentum_window: int = 720,
        rebalance_bars: int = 168,
        switch_threshold: float = 0.05,
        deadband: float = 0.02,
        quiet_threshold: float = 0.10,
    ):
        self.momentum_window = momentum_window
        self.rebalance_bars = rebalance_bars
        self.switch_threshold = switch_threshold
        self.deadband = deadband
        self.quiet_threshold = quiet_threshold

    def run(
        self,
        token_data: dict[str, pd.DataFrame],
        token_regimes: dict[str, list[str]],
        initial_capital: float = 10_000.0,
    ) -> dict:
        tokens = sorted(token_data.keys())
        common_idx = token_data[tokens[0]].index
        for t in tokens[1:]:
            common_idx = common_idx.intersection(token_data[t].index)
        common_idx = common_idx.sort_values()

        n = len(common_idx)
        prices = {}
        regimes = {}
        for t in tokens:
            df = token_data[t].loc[common_idx]
            prices[t] = df["close"].values.astype(np.float64)
            full_regime = token_regimes[t]
            idx_map = {ts: i for i, ts in enumerate(token_data[t].index)}
            regimes[t] = [full_regime[idx_map[ts]] for ts in common_idx]

        equity = initial_capital
        equity_curve = np.zeros(n)
        held_token = None
        trades = []
        bars_in_market = 0

        # State time: kinetic_pos, kinetic_neg, quiet_hold, quiet_deployed
        state_time = {}

        for i in range(n):
            # Update equity
            if held_token is not None:
                ret = prices[held_token][i] / prices[held_token][i - 1] if i > 0 else 1.0
                equity *= ret
                bars_in_market += 1

            equity_curve[i] = equity

            ts = common_idx[i]
            year = str(ts.year) if hasattr(ts, 'year') else str(pd.Timestamp(ts).year)
            if year not in state_time:
                state_time[year] = {"kinetic_pos": 0, "kinetic_neg": 0,
                                    "quiet_hold": 0, "quiet_deployed": 0}

            # Consensus regime
            kinetic_count = sum(1 for t in tokens if regimes[t][i] == "Kinetic")
            is_kinetic = kinetic_count > len(tokens) // 2

            # Momenta
            if i >= self.momentum_window:
                momenta = {t: np.log(prices[t][i] / prices[t][i - self.momentum_window]) for t in tokens}
                best_token = max(momenta, key=momenta.get)
                best_momentum = momenta[best_token]
                avg_momentum = np.mean(list(momenta.values()))
            else:
                momenta = {t: 0.0 for t in tokens}
                best_token = tokens[0]
                best_momentum = 0.0
                avg_momentum = 0.0

            # === Fluid Dynamic State Machine ===

            if is_kinetic:
                if held_token is None:
                    # Currently cash: only enter if momentum clears positive deadband
                    if best_momentum > self.deadband:
                        state_time[year]["kinetic_pos"] += 1
                        if i >= self.momentum_window:
                            self._enter_position(i, common_idx, prices, momenta,
                                                 best_token, trades, equity, held_token)
                            held_token = best_token
                    else:
                        state_time[year]["kinetic_neg"] += 1
                else:
                    # Currently holding: only exit if momentum drops below negative deadband
                    if best_momentum < -self.deadband:
                        state_time[year]["kinetic_neg"] += 1
                        trades.append({
                            "bar": i, "timestamp": str(common_idx[i]),
                            "action": "sell", "token": held_token,
                            "reason": "kinetic_negative", "equity": equity,
                        })
                        held_token = None
                    else:
                        state_time[year]["kinetic_pos"] += 1
                        # Rebalance within kinetic+positive
                        if i >= self.momentum_window and (i % self.rebalance_bars == 0):
                            if best_token != held_token:
                                advantage = momenta[best_token] - momenta.get(held_token, 0)
                                if advantage >= self.switch_threshold:
                                    trades.append({
                                        "bar": i, "timestamp": str(common_idx[i]),
                                        "action": "sell", "token": held_token,
                                        "reason": "rotation", "equity": equity,
                                    })
                                    held_token = best_token
                                    trades.append({
                                        "bar": i, "timestamp": str(common_idx[i]),
                                        "action": "buy", "token": best_token,
                                        "price": float(prices[best_token][i]),
                                        "momentum": float(momenta[best_token]),
                                        "equity": equity,
                                    })
            else:
                # Quiet state
                if held_token is not None:
                    # Holding a token: hold it (original behaviour)
                    state_time[year]["quiet_hold"] += 1
                else:
                    # In cash: check permeability clause
                    if i >= self.momentum_window and best_momentum > self.quiet_threshold:
                        state_time[year]["quiet_deployed"] += 1
                        self._enter_position(i, common_idx, prices, momenta,
                                             best_token, trades, equity, held_token)
                        held_token = best_token
                    else:
                        state_time[year]["quiet_hold"] += 1

        # Metrics
        total_return = equity / initial_capital - 1.0
        years = n / (24 * 365)
        cagr = (equity / initial_capital) ** (1 / years) - 1.0 if years > 0 else 0.0

        running_max = np.maximum.accumulate(equity_curve)
        drawdowns = (equity_curve - running_max) / running_max
        max_dd = float(np.min(drawdowns))

        daily_eq = equity_curve[::24]
        daily_rets = np.diff(np.log(np.maximum(daily_eq, 1e-12)))
        sharpe = float(np.mean(daily_rets) / np.std(daily_rets) * np.sqrt(365)) if np.std(daily_rets) > 0 else 0.0
        calmar = cagr / abs(max_dd) if max_dd != 0 else 0.0
        pct_in_market = bars_in_market / n if n > 0 else 0.0

        annual_returns = {}
        timestamps = pd.DatetimeIndex(common_idx)
        for yr in range(timestamps[0].year, timestamps[-1].year + 1):
            mask = timestamps.year == yr
            if mask.sum() < 48:
                continue
            year_eq = equity_curve[mask]
            annual_returns[str(yr)] = float(year_eq[-1] / year_eq[0] - 1.0)

        bnh = {t: float(prices[t][-1] / prices[t][0] - 1.0) for t in tokens}
        basket_ret = np.mean([prices[t][-1] / prices[t][0] for t in tokens]) - 1.0

        # Normalize state_time
        for yr in state_time:
            total_bars = sum(state_time[yr].values())
            if total_bars > 0:
                for k in state_time[yr]:
                    state_time[yr][k] = round(state_time[yr][k] / total_bars * 100, 1)

        return {
            "total_return": total_return,
            "cagr": cagr,
            "max_drawdown": max_dd,
            "sharpe": sharpe,
            "calmar": calmar,
            "n_trades": len(trades),
            "n_token_switches": sum(1 for t in trades if t["action"] == "buy"),
            "pct_in_market": pct_in_market,
            "years": years,
            "final_equity": equity,
            "annual_returns": annual_returns,
            "buy_and_hold": bnh,
            "buy_and_hold_basket": float(basket_ret),
            "state_time_by_year": state_time,
            "trades": trades,
            "equity_curve": equity_curve.tolist(),
            "timestamps": [str(t) for t in common_idx],
        }

    def _enter_position(self, i, common_idx, prices, momenta, best_token, trades, equity, held_token):
        """Enter a position in best_token."""
        if held_token is not None and held_token != best_token:
            trades.append({
                "bar": i, "timestamp": str(common_idx[i]),
                "action": "sell", "token": held_token,
                "reason": "rotation", "equity": equity,
            })
        if best_token != held_token:
            trades.append({
                "bar": i, "timestamp": str(common_idx[i]),
                "action": "buy", "token": best_token,
                "price": float(prices[best_token][i]),
                "momentum": float(momenta[best_token]),
                "equity": equity,
            })
