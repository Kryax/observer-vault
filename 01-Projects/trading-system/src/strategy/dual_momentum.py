"""
Regime-Gated Dual Momentum Allocator.

Rules:
  1. If ALL tokens are in R-regime: 100% cash
  2. Rank non-R tokens by 30-day log return (720 hourly bars)
  3. Allocate 100% of equity to the strongest token
  4. Rebalance weekly (every 168 bars)
  5. Only switch tokens if momentum advantage > threshold (reduces churn)
  6. No stops — regime transition is the only exit
"""

import numpy as np
import pandas as pd


class DualMomentumAllocator:

    def __init__(
        self,
        momentum_window: int = 720,
        rebalance_bars: int = 168,
        switch_threshold: float = 0.05,
    ):
        self.momentum_window = momentum_window
        self.rebalance_bars = rebalance_bars
        self.switch_threshold = switch_threshold

    def run(
        self,
        token_data: dict[str, pd.DataFrame],
        token_regimes: dict[str, list[str]],
        initial_capital: float = 10_000.0,
    ) -> dict:
        """
        Run backtest across all tokens.

        Args:
            token_data: {token: DataFrame with 'close' column}
            token_regimes: {token: list of 'D'/'I'/'R' per bar}
            initial_capital: starting equity

        Returns:
            dict with equity_curve, trades, metrics
        """
        # Align all tokens to the same timestamp range
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
            # Map from full index to common index
            idx_map = {ts: i for i, ts in enumerate(token_data[t].index)}
            regimes[t] = [full_regime[idx_map[ts]] for ts in common_idx]

        equity = initial_capital
        equity_curve = np.zeros(n)
        held_token = None
        entry_price = 0.0
        trades = []
        bars_in_market = 0

        for i in range(n):
            # Update equity if holding
            if held_token is not None:
                ret = prices[held_token][i] / prices[held_token][i - 1] if i > 0 else 1.0
                equity *= ret
                bars_in_market += 1

            equity_curve[i] = equity

            # Rebalance check: every rebalance_bars, or if held token enters R
            should_rebalance = (i % self.rebalance_bars == 0) and (i >= self.momentum_window)
            if held_token is not None and regimes[held_token][i] == "R":
                should_rebalance = True

            if not should_rebalance:
                continue

            # Find non-R tokens
            eligible = [t for t in tokens if regimes[t][i] != "R"]

            if not eligible:
                # All R: go to cash
                if held_token is not None:
                    trades.append({
                        "bar": i,
                        "timestamp": str(common_idx[i]),
                        "action": "sell",
                        "token": held_token,
                        "reason": "all_R",
                        "equity": equity,
                    })
                    held_token = None
                continue

            # Rank by momentum (30-day log return)
            momenta = {}
            for t in eligible:
                if i >= self.momentum_window:
                    momenta[t] = np.log(prices[t][i] / prices[t][i - self.momentum_window])
                else:
                    momenta[t] = 0.0

            best = max(momenta, key=momenta.get)

            # Only switch if momentum advantage exceeds threshold
            should_switch = (best != held_token)
            if should_switch and held_token is not None and held_token in momenta:
                advantage = momenta[best] - momenta[held_token]
                if advantage < self.switch_threshold:
                    should_switch = False  # not enough edge to justify friction

            if should_switch:
                if held_token is not None:
                    trades.append({
                        "bar": i,
                        "timestamp": str(common_idx[i]),
                        "action": "sell",
                        "token": held_token,
                        "reason": "rotation",
                        "equity": equity,
                    })
                held_token = best
                entry_price = prices[best][i]
                trades.append({
                    "bar": i,
                    "timestamp": str(common_idx[i]),
                    "action": "buy",
                    "token": best,
                    "price": float(entry_price),
                    "momentum": float(momenta[best]),
                    "equity": equity,
                })

        # Compute metrics
        total_return = equity / initial_capital - 1.0
        years = n / (24 * 365)
        cagr = (equity / initial_capital) ** (1 / years) - 1.0 if years > 0 else 0.0

        # Max drawdown
        running_max = np.maximum.accumulate(equity_curve)
        drawdowns = (equity_curve - running_max) / running_max
        max_dd = float(np.min(drawdowns))

        # Sharpe (annualised from daily returns)
        daily_eq = equity_curve[::24]
        daily_rets = np.diff(np.log(np.maximum(daily_eq, 1e-12)))
        sharpe = float(np.mean(daily_rets) / np.std(daily_rets) * np.sqrt(365)) if np.std(daily_rets) > 0 else 0.0

        # Calmar
        calmar = cagr / abs(max_dd) if max_dd != 0 else 0.0

        # Time in market
        pct_in_market = bars_in_market / n if n > 0 else 0.0

        # Annual returns
        annual_returns = {}
        timestamps = pd.DatetimeIndex(common_idx)
        for year in range(timestamps[0].year, timestamps[-1].year + 1):
            mask = timestamps.year == year
            if mask.sum() < 48:
                continue
            year_eq = equity_curve[mask]
            annual_returns[str(year)] = float(year_eq[-1] / year_eq[0] - 1.0)

        # Buy-and-hold benchmarks
        bnh = {}
        for t in tokens:
            bnh[t] = float(prices[t][-1] / prices[t][0] - 1.0)
        # Equal-weight basket
        basket_ret = np.mean([prices[t][-1] / prices[t][0] for t in tokens]) - 1.0

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
            "trades": trades,
            "equity_curve": equity_curve.tolist(),
            "timestamps": [str(t) for t in common_idx],
        }
