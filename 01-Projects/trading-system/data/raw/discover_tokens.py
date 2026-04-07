#!/usr/bin/env python3
"""Step 1: Discover mid-cap token candidates from Binance."""

import ccxt
import time
from datetime import datetime, timezone

exchange = ccxt.binance({'enableRateLimit': True})
exchange.load_markets()

# Candidates to check
CANDIDATES = [
    'MATIC', 'POL', 'FIL', 'ATOM', 'ALGO', 'VET', 'FTM', 'SAND', 'MANA',
    'HBAR', 'ICP', 'APT', 'ARB', 'OP', 'INJ', 'TIA', 'SEI', 'RENDER',
    'FET', 'WIF', 'PEPE', 'SHIB', 'FLOKI', 'BONK',
    # Additional mid-caps
    'LTC', 'UNI', 'AAVE', 'GRT', 'THETA', 'EOS', 'XLM', 'TRX',
    'CRV', 'SNX', 'COMP', 'MKR', 'RUNE', 'ENJ', 'CHZ', 'AXS',
    'GALA', 'IMX', 'LDO', 'STX', 'CFX', 'EGLD', 'KAVA', 'ZIL',
    'ONE', 'ROSE', 'JASMY', 'DYDX', 'GMX', 'PENDLE', 'JUP',
    'W', 'STRK', 'PYTH', 'JTO', 'ONDO', 'ENA',
]

ALREADY_HAVE = {'BTC', 'ETH', 'SOL', 'BNB', 'ADA', 'DOGE', 'XRP', 'LINK', 'AVAX', 'DOT', 'NEAR', 'SUI'}

# Stablecoins and wrapped/leveraged to exclude
EXCLUDE_PATTERNS = {'USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'FDUSD', 'WBTC', 'WETH', 'UP', 'DOWN', 'BULL', 'BEAR'}

cutoff = datetime(2024, 4, 7, tzinfo=timezone.utc)  # 2 years ago from today (2026-04-07)
cutoff_ms = int(cutoff.timestamp() * 1000)

results = []

for token in CANDIDATES:
    if token in ALREADY_HAVE:
        continue

    symbol = f"{token}/USDT"
    if symbol not in exchange.markets:
        # Try alternate symbols
        if f"{token}/USDT:USDT" in exchange.markets:
            continue  # futures only
        print(f"  {symbol} — not found on Binance spot")
        continue

    market = exchange.markets[symbol]

    # Check it's a spot market
    if market.get('type') != 'spot':
        print(f"  {symbol} — not spot")
        continue

    # Try to fetch the earliest candle
    try:
        earliest = exchange.fetch_ohlcv(symbol, '1h', limit=1, since=0)
        if not earliest:
            print(f"  {symbol} — no data")
            continue
        first_ts = earliest[0][0]
        first_date = datetime.fromtimestamp(first_ts / 1000, tz=timezone.utc)

        # Check if at least 2 years of data
        if first_ts > cutoff_ms:
            print(f"  {symbol} — too recent (first: {first_date.strftime('%Y-%m-%d')})")
            continue

        # Get recent 24h volume (fetch last 24 candles)
        recent = exchange.fetch_ohlcv(symbol, '1h', limit=24)
        if recent:
            daily_volume_usd = sum(c[4] * c[5] for c in recent)  # close * volume approximation
            # Actually volume is in base, need quote volume. Use close*volume as proxy
            daily_volume_usd = sum(c[4] * c[5] for c in recent)
        else:
            daily_volume_usd = 0

        # Get latest candle for latest date
        latest = exchange.fetch_ohlcv(symbol, '1h', limit=1)
        last_date = datetime.fromtimestamp(latest[-1][0] / 1000, tz=timezone.utc) if latest else None

        years_of_data = (last_date - first_date).days / 365.25 if last_date else 0

        results.append({
            'token': token,
            'symbol': symbol,
            'first_date': first_date.strftime('%Y-%m-%d'),
            'last_date': last_date.strftime('%Y-%m-%d') if last_date else 'N/A',
            'years': round(years_of_data, 2),
            'daily_vol_usd': round(daily_volume_usd),
        })
        print(f"  {symbol} — OK: {first_date.strftime('%Y-%m-%d')} to {last_date.strftime('%Y-%m-%d') if last_date else 'N/A'}, {years_of_data:.1f}y, vol=${daily_volume_usd:,.0f}")

        time.sleep(0.1)  # rate limit courtesy

    except Exception as e:
        print(f"  {symbol} — error: {e}")
        continue

# Sort by daily volume descending
results.sort(key=lambda x: x['daily_vol_usd'], reverse=True)

print("\n" + "=" * 80)
print("CANDIDATE RANKING (by 24H volume)")
print("=" * 80)
print(f"{'Rank':>4} {'Token':<8} {'First Date':<12} {'Years':>6} {'24H Vol USD':>15}")
print("-" * 55)
for i, r in enumerate(results, 1):
    print(f"{i:>4} {r['token']:<8} {r['first_date']:<12} {r['years']:>6.1f} ${r['daily_vol_usd']:>13,}")

# Filter: volume > $10M and years > 2
qualified = [r for r in results if r['daily_vol_usd'] > 10_000_000 and r['years'] >= 2.0]
print(f"\n\nQUALIFIED (>$10M daily vol, >2yr history): {len(qualified)}")
for i, r in enumerate(qualified, 1):
    print(f"  {i:>2}. {r['token']:<8} — {r['first_date']} ({r['years']:.1f}y), vol=${r['daily_vol_usd']:,}")

# Top 15
top15 = qualified[:15]
print(f"\n\nTOP 15 SELECTED:")
for r in top15:
    print(f"  {r['token']}")
