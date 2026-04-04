"""
Backtesting engine for DIR regime strategies.

Event-driven bar-by-bar backtester with:
- Long-only position management (no shorting for simplicity)
- Variable position sizing
- Commission modeling
- Equity curve tracking
- Performance metrics: Sharpe, max drawdown, win rate, trade count
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
    size: float = 1.0  # fraction of capital to deploy (0.0 to 1.0)
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


class BacktestEngine:
    """
    Bar-by-bar backtester.

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
        Optional columns: regime, confidence
        """
        capital = self.initial_capital
        position_btc = 0.0
        position_entry_price = 0.0
        highest_since_entry = 0.0
        trailing_stop_pct = None

        trades: list[Trade] = []
        current_trade: Optional[Trade] = None
        equity = []

        for i in range(len(data)):
            row = data.iloc[i]
            ts = data.index[i]
            price = row["close"]

            # Check trailing stop before strategy signal
            if current_trade is not None and trailing_stop_pct is not None:
                highest_since_entry = max(highest_since_entry, row["high"])
                stop_price = highest_since_entry * (1.0 - trailing_stop_pct)
                if row["low"] <= stop_price:
                    exit_price = stop_price * (1.0 - self.slippage_pct)
                    pnl = position_btc * (exit_price - current_trade.entry_price)
                    commission = position_btc * exit_price * self.commission_pct
                    pnl -= commission
                    capital += position_btc * exit_price - commission
                    current_trade.exit_time = ts
                    current_trade.exit_price = exit_price
                    current_trade.exit_reason = "trailing_stop"
                    current_trade.pnl = pnl
                    current_trade.pnl_pct = pnl / current_trade.size_usd if current_trade.size_usd > 0 else 0
                    trades.append(current_trade)
                    current_trade = None
                    position_btc = 0.0
                    trailing_stop_pct = None

            # Check stop loss
            if current_trade is not None and current_trade.exit_time is None:
                # Fixed stop loss check (stored in entry_price - would need separate field)
                pass

            # Get strategy signal
            signal = strategy.on_bar(i, row, data.iloc[max(0, i - 200):i + 1])

            if signal.action == "buy" and current_trade is None and capital > 100:
                # Enter position
                size_usd = capital * min(signal.size, 1.0)
                entry_price = price * (1.0 + self.slippage_pct)
                commission = size_usd * self.commission_pct
                btc_amount = (size_usd - commission) / entry_price
                capital -= size_usd
                position_btc = btc_amount
                position_entry_price = entry_price
                highest_since_entry = price
                trailing_stop_pct = signal.trailing_stop_pct

                current_trade = Trade(
                    entry_time=ts,
                    entry_price=entry_price,
                    size_usd=size_usd,
                    regime_at_entry=str(row.get("regime", "")),
                    confidence_at_entry=float(row.get("confidence", 0.0)),
                )

            elif signal.action == "sell" and current_trade is not None:
                # Exit position
                exit_price = price * (1.0 - self.slippage_pct)
                pnl = position_btc * (exit_price - current_trade.entry_price)
                commission = position_btc * exit_price * self.commission_pct
                pnl -= commission
                capital += position_btc * exit_price - commission
                current_trade.exit_time = ts
                current_trade.exit_price = exit_price
                current_trade.exit_reason = signal.reason
                current_trade.pnl = pnl
                current_trade.pnl_pct = pnl / current_trade.size_usd if current_trade.size_usd > 0 else 0
                trades.append(current_trade)
                current_trade = None
                position_btc = 0.0
                trailing_stop_pct = None

            # Mark to market
            mtm = capital + (position_btc * price if position_btc > 0 else 0.0)
            equity.append(mtm)

        # Close any open position at last bar
        if current_trade is not None:
            price = data.iloc[-1]["close"]
            exit_price = price * (1.0 - self.slippage_pct)
            pnl = position_btc * (exit_price - current_trade.entry_price)
            commission = position_btc * exit_price * self.commission_pct
            pnl -= commission
            capital += position_btc * exit_price - commission
            current_trade.exit_time = data.index[-1]
            current_trade.exit_price = exit_price
            current_trade.exit_reason = "end_of_data"
            current_trade.pnl = pnl
            current_trade.pnl_pct = pnl / current_trade.size_usd if current_trade.size_usd > 0 else 0
            trades.append(current_trade)

        equity_series = pd.Series(equity, index=data.index, name="equity")
        daily_returns = equity_series.pct_change().dropna()
        metrics = self._compute_metrics(equity_series, trades)

        return BacktestResult(
            strategy_name=strategy.name(),
            trades=trades,
            equity_curve=equity_series,
            daily_returns=daily_returns,
            metrics=metrics,
        )

    def _compute_metrics(self, equity: pd.Series, trades: list[Trade]) -> dict:
        """Compute performance metrics from equity curve and trades."""
        returns = equity.pct_change().dropna()

        # Sharpe ratio on DAILY returns (standard practice)
        # Resample hourly equity to daily (end-of-day), then compute daily returns
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
