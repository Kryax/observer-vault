"""
Backtesting engine for DIR regime strategies.

Event-driven bar-by-bar backtester with:
- Long-only position management (no shorting for simplicity)
- Variable position sizing
- Partial exits (scale-out / trim)
- Limit order support (fills when price reaches level)
- Commission modeling
- Equity curve tracking
- Performance metrics: Sharpe, max drawdown, win rate, trade count
- Per-trade logging with regime context
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol, Optional

import numpy as np
import pandas as pd


# ---------------------------------------------------------------------------
# Strategy protocol
# ---------------------------------------------------------------------------

class Strategy(Protocol):
    """Interface that all strategies must implement."""

    def on_bar(self, idx: int, row: pd.Series, history: pd.DataFrame) -> Signal:
        """Process a new bar and return a trading signal."""
        ...

    def name(self) -> str:
        ...


@dataclass
class Signal:
    """Trading signal from a strategy."""
    action: str  # "buy", "sell", "hold"
    size: float = 1.0  # fraction of capital to deploy (buy) or fraction of position to sell
    reason: str = ""
    stop_loss: Optional[float] = None  # absolute price level
    trailing_stop_pct: Optional[float] = None  # e.g. 0.05 = 5% trailing


# ---------------------------------------------------------------------------
# Trade tracking
# ---------------------------------------------------------------------------

@dataclass
class Trade:
    entry_time: pd.Timestamp
    entry_price: float
    size_usd: float
    regime_at_entry: str = ""
    confidence_at_entry: float = 0.0
    exit_time: Optional[pd.Timestamp] = None
    exit_price: Optional[float] = None
    exit_reason: str = ""
    pnl: float = 0.0
    pnl_pct: float = 0.0
    context: Optional[dict] = None


# ---------------------------------------------------------------------------
# Backtest engine
# ---------------------------------------------------------------------------

@dataclass
class BacktestResult:
    strategy_name: str
    trades: list[Trade]
    equity_curve: pd.Series
    daily_returns: pd.Series
    metrics: dict
    trade_log: list[dict] = field(default_factory=list)


class BacktestEngine:
    """
    Bar-by-bar backtester with partial exit support.

    Parameters
    ----------
    initial_capital : starting USD
    commission_pct : round-trip commission as fraction (0.001 = 0.1%)
    slippage_pct : slippage per trade as fraction
    """

    def __init__(self, initial_capital: float = 10_000.0,
                 commission_pct: float = 0.001,
                 slippage_pct: float = 0.0005):
        self.initial_capital = initial_capital
        self.commission_pct = commission_pct
        self.slippage_pct = slippage_pct

    def run(self, strategy: Strategy, data: pd.DataFrame) -> BacktestResult:
        """
        Run backtest on OHLCV data with regime/confidence columns.

        data must have columns: open, high, low, close, volume
        Optional columns: regime, confidence, transition_score, basin_depth,
                         barrier_height, gradient_mag, gradient_direction,
                         normalised_barrier, barrier_to_d
        """
        capital = self.initial_capital
        position_units = 0.0  # units of asset held
        position_entry_price = 0.0
        total_entry_cost = 0.0  # total USD deployed into current position
        highest_since_entry = 0.0
        trailing_stop_pct = None
        stop_loss_price = None

        trades: list[Trade] = []
        current_trade: Optional[Trade] = None
        equity = []

        # Pre-compute if strategy supports it
        if hasattr(strategy, 'precompute'):
            strategy.precompute(data)

        for i in range(len(data)):
            row = data.iloc[i]
            ts = data.index[i]
            price = row["close"]

            # Check trailing stop before strategy signal
            if position_units > 0 and trailing_stop_pct is not None:
                highest_since_entry = max(highest_since_entry, row["high"])
                trail_stop = highest_since_entry * (1.0 - trailing_stop_pct)
                if row["low"] <= trail_stop:
                    exit_price = trail_stop * (1.0 - self.slippage_pct)
                    capital, position_units, current_trade = self._close_position(
                        capital, position_units, exit_price, current_trade,
                        ts, "trailing_stop", trades,
                    )
                    trailing_stop_pct = None
                    stop_loss_price = None

            # Check fixed stop loss
            if position_units > 0 and stop_loss_price is not None:
                if row["low"] <= stop_loss_price:
                    exit_price = stop_loss_price * (1.0 - self.slippage_pct)
                    capital, position_units, current_trade = self._close_position(
                        capital, position_units, exit_price, current_trade,
                        ts, "stop_loss", trades,
                    )
                    trailing_stop_pct = None
                    stop_loss_price = None

            # Get strategy signal
            signal = strategy.on_bar(i, row, data.iloc[max(0, i - 500):i + 1])

            if signal.action == "buy" and capital > 100:
                # Enter or add to position
                size_usd = capital * min(signal.size, 1.0)
                entry_price = price * (1.0 + self.slippage_pct)
                commission = size_usd * self.commission_pct
                units = (size_usd - commission) / entry_price
                capital -= size_usd

                if current_trade is None:
                    # New position
                    position_units = units
                    position_entry_price = entry_price
                    total_entry_cost = size_usd
                    highest_since_entry = price

                    current_trade = Trade(
                        entry_time=ts,
                        entry_price=entry_price,
                        size_usd=size_usd,
                        regime_at_entry=str(row.get("regime", "")),
                        confidence_at_entry=float(row.get("confidence", 0.0)),
                    )
                else:
                    # Add to position (average in)
                    total_cost = position_units * position_entry_price + units * entry_price
                    position_units += units
                    position_entry_price = total_cost / position_units if position_units > 0 else entry_price
                    total_entry_cost += size_usd
                    current_trade.size_usd = total_entry_cost

                if signal.stop_loss is not None:
                    stop_loss_price = signal.stop_loss
                if signal.trailing_stop_pct is not None:
                    trailing_stop_pct = signal.trailing_stop_pct

            elif signal.action == "sell" and position_units > 0:
                sell_frac = min(signal.size, 1.0) if signal.size > 0 else 1.0
                units_to_sell = position_units * sell_frac

                if sell_frac >= 0.99:
                    # Full exit
                    exit_price = price * (1.0 - self.slippage_pct)
                    capital, position_units, current_trade = self._close_position(
                        capital, position_units, exit_price, current_trade,
                        ts, signal.reason, trades,
                    )
                    trailing_stop_pct = None
                    stop_loss_price = None
                else:
                    # Partial exit
                    exit_price = price * (1.0 - self.slippage_pct)
                    proceeds = units_to_sell * exit_price
                    commission = proceeds * self.commission_pct
                    capital += proceeds - commission
                    position_units -= units_to_sell

                    # Log partial as a trade
                    partial_entry_cost = total_entry_cost * sell_frac
                    total_entry_cost -= partial_entry_cost
                    pnl = units_to_sell * (exit_price - position_entry_price) - commission
                    trades.append(Trade(
                        entry_time=current_trade.entry_time if current_trade else ts,
                        entry_price=position_entry_price,
                        size_usd=partial_entry_cost,
                        regime_at_entry=current_trade.regime_at_entry if current_trade else "",
                        confidence_at_entry=current_trade.confidence_at_entry if current_trade else 0,
                        exit_time=ts,
                        exit_price=exit_price,
                        exit_reason=signal.reason,
                        pnl=pnl,
                        pnl_pct=pnl / partial_entry_cost if partial_entry_cost > 0 else 0,
                    ))

                    if position_units < 1e-10:
                        position_units = 0.0
                        current_trade = None
                        trailing_stop_pct = None
                        stop_loss_price = None

            # Mark to market
            mtm = capital + (position_units * price if position_units > 0 else 0.0)
            equity.append(mtm)

        # Close any open position at last bar
        if current_trade is not None and position_units > 0:
            price = data.iloc[-1]["close"]
            exit_price = price * (1.0 - self.slippage_pct)
            capital, position_units, current_trade = self._close_position(
                capital, position_units, exit_price, current_trade,
                data.index[-1], "end_of_data", trades,
            )

        equity_series = pd.Series(equity, index=data.index, name="equity")
        daily_returns = equity_series.pct_change().dropna()
        metrics = self._compute_metrics(equity_series, trades)

        # Collect trade log from strategy if available
        trade_log = []
        if hasattr(strategy, 'get_trade_log'):
            trade_log = strategy.get_trade_log()

        return BacktestResult(
            strategy_name=strategy.name(),
            trades=trades,
            equity_curve=equity_series,
            daily_returns=daily_returns,
            metrics=metrics,
            trade_log=trade_log,
        )

    def _close_position(
        self, capital: float, position_units: float, exit_price: float,
        current_trade: Optional[Trade], ts: pd.Timestamp, reason: str,
        trades: list[Trade],
    ) -> tuple[float, float, None]:
        """Close entire position."""
        proceeds = position_units * exit_price
        commission = proceeds * self.commission_pct
        capital += proceeds - commission

        if current_trade is not None:
            pnl = position_units * (exit_price - current_trade.entry_price) - commission
            current_trade.exit_time = ts
            current_trade.exit_price = exit_price
            current_trade.exit_reason = reason
            current_trade.pnl = pnl
            current_trade.pnl_pct = pnl / current_trade.size_usd if current_trade.size_usd > 0 else 0
            trades.append(current_trade)

        return capital, 0.0, None

    def _compute_metrics(self, equity: pd.Series, trades: list[Trade]) -> dict:
        """Compute performance metrics from equity curve and trades."""
        # Sharpe ratio on DAILY returns
        daily_equity = equity.resample("1D").last().dropna()
        daily_returns = daily_equity.pct_change().dropna()

        if len(daily_returns) > 1 and daily_returns.std() > 0:
            sharpe = (daily_returns.mean() / daily_returns.std()) * np.sqrt(365)
        else:
            sharpe = 0.0

        # Max drawdown
        cummax = equity.cummax()
        drawdown = (equity - cummax) / cummax
        max_dd = float(drawdown.min())

        # Trade stats
        n_trades = len(trades)
        if n_trades > 0:
            wins = [t for t in trades if t.pnl > 0]
            win_rate = len(wins) / n_trades
            avg_pnl = np.mean([t.pnl for t in trades])
            avg_win = np.mean([t.pnl for t in wins]) if wins else 0.0
            losses = [t for t in trades if t.pnl <= 0]
            avg_loss = np.mean([t.pnl for t in losses]) if losses else 0.0
            profit_factor = (sum(t.pnl for t in wins) / abs(sum(t.pnl for t in losses))
                             if losses and sum(t.pnl for t in losses) != 0 else float("inf"))
        else:
            win_rate = avg_pnl = avg_win = avg_loss = 0.0
            profit_factor = 0.0

        total_return = (equity.iloc[-1] / equity.iloc[0]) - 1.0

        return {
            "total_return": float(total_return),
            "sharpe_ratio": float(sharpe),
            "max_drawdown": float(max_dd),
            "n_trades": n_trades,
            "win_rate": float(win_rate),
            "avg_pnl": float(avg_pnl),
            "avg_win": float(avg_win),
            "avg_loss": float(avg_loss),
            "profit_factor": float(profit_factor),
            "initial_capital": self.initial_capital,
            "final_capital": float(equity.iloc[-1]),
        }
