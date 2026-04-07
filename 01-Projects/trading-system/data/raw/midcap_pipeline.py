#!/usr/bin/env python3
"""
Mid-Cap Token Discovery Pipeline
Steps 2-10: Download, 6D features, K=9 classify, basin affinity, legibility, ranking.
"""

import os
import sys
import json
import time
import numpy as np
import pandas as pd
from datetime import datetime, timezone

# Paths
BASE = "/mnt/zfs-host/backup/projects/observer-vault/01-Projects/trading-system/data"
RAW_DIR = os.path.join(BASE, "raw")
os.makedirs(RAW_DIR, exist_ok=True)

# Token lists
EXISTING_12 = ['BTC', 'ETH', 'SOL', 'BNB', 'ADA', 'DOGE', 'XRP', 'LINK', 'AVAX', 'DOT', 'NEAR', 'SUI']
NEW_15 = ['PEPE', 'TRX', 'MATIC', 'FET', 'FTM', 'ENA', 'LTC', 'XLM', 'EOS', 'UNI', 'ALGO', 'AAVE', 'HBAR', 'BONK', 'SHIB']
ALL_TOKENS = EXISTING_12 + NEW_15

# ============================================================
# STEP 2: Download OHLCV data
# ============================================================

def ensure_raw_csv(token):
    """Ensure token has a CSV in raw/ dir. Copy from parent data/ if exists."""
    raw_path = os.path.join(RAW_DIR, f"{token.lower()}_ohlcv_1h.csv")
    if os.path.exists(raw_path):
        df = pd.read_csv(raw_path)
        if len(df) > 100:
            print(f"  {token}: already in raw/ ({len(df)} candles)")
            return raw_path

    # Check parent data dir for existing CSVs
    parent_csv = os.path.join(BASE, f"{token.lower()}_ohlcv_1h.csv")
    parent_ext = os.path.join(BASE, f"{token.lower()}_ohlcv_1h_extended.csv")

    for src in [parent_ext, parent_csv]:
        if os.path.exists(src):
            df = pd.read_csv(src)
            # Normalize columns
            cols = df.columns.tolist()
            if 'timestamp' in cols and 'open' in cols:
                df_out = df[['timestamp', 'open', 'high', 'low', 'close', 'volume']].copy()
                df_out.to_csv(raw_path, index=False)
                print(f"  {token}: copied from {os.path.basename(src)} ({len(df_out)} candles)")
                return raw_path

    # Not found locally — need to download
    return None


def download_token(token):
    """Download 1H OHLCV from Binance via ccxt."""
    import ccxt

    raw_path = os.path.join(RAW_DIR, f"{token.lower()}_ohlcv_1h.csv")
    exchange = ccxt.binance({'enableRateLimit': True})

    symbol = f"{token}/USDT"
    print(f"  {token}: downloading {symbol}...")

    all_candles = []
    since = 0  # from the beginning

    while True:
        try:
            candles = exchange.fetch_ohlcv(symbol, '1h', since=since, limit=1000)
        except Exception as e:
            print(f"    Error at since={since}: {e}")
            time.sleep(5)
            try:
                candles = exchange.fetch_ohlcv(symbol, '1h', since=since, limit=1000)
            except:
                break

        if not candles:
            break

        all_candles.extend(candles)
        since = candles[-1][0] + 1  # next ms after last candle

        if len(candles) < 1000:
            break

        if len(all_candles) % 10000 < 1000:
            print(f"    {len(all_candles)} candles so far...")

        time.sleep(0.05)

    if not all_candles:
        print(f"    {token}: no data!")
        return None

    # Deduplicate by timestamp
    seen = set()
    unique = []
    for c in all_candles:
        if c[0] not in seen:
            seen.add(c[0])
            unique.append(c)
    unique.sort(key=lambda x: x[0])

    # Convert to DataFrame
    df = pd.DataFrame(unique, columns=['timestamp_ms', 'open', 'high', 'low', 'close', 'volume'])
    df['timestamp'] = pd.to_datetime(df['timestamp_ms'], unit='ms', utc=True)
    df = df[['timestamp', 'open', 'high', 'low', 'close', 'volume']]
    df.to_csv(raw_path, index=False)

    first = df['timestamp'].iloc[0]
    last = df['timestamp'].iloc[-1]
    print(f"    {token}: {len(df)} candles, {first} to {last}")
    return raw_path


def step2_download():
    """Ensure all tokens have raw CSVs."""
    print("\n" + "=" * 60)
    print("STEP 2: Download / verify OHLCV data")
    print("=" * 60)

    token_info = {}

    for token in ALL_TOKENS:
        path = ensure_raw_csv(token)
        if path is None:
            path = download_token(token)

        if path and os.path.exists(path):
            df = pd.read_csv(path)
            token_info[token] = {
                'path': path,
                'n_candles': len(df),
                'first_date': str(df['timestamp'].iloc[0]),
                'last_date': str(df['timestamp'].iloc[-1]),
            }
        else:
            print(f"  WARNING: {token} has no data!")

    return token_info


# ============================================================
# STEP 3: Compute 6D features
# ============================================================

def compute_atr(df, period=14):
    high = df['high'].values
    low = df['low'].values
    close = df['close'].values
    tr = np.maximum(high[1:] - low[1:],
                    np.maximum(np.abs(high[1:] - close[:-1]),
                               np.abs(low[1:] - close[:-1])))
    tr = np.concatenate([[high[0] - low[0]], tr])
    atr = pd.Series(tr).ewm(span=period, adjust=False).mean().values
    return atr


def compute_bbw(df, period=20, std_mult=2):
    close = df['close']
    sma = close.rolling(period).mean()
    std = close.rolling(period).std()
    upper = sma + std_mult * std
    lower = sma - std_mult * std
    bbw = ((upper - lower) / sma).values
    return bbw


def compute_rsi(df, period=14):
    delta = df['close'].diff()
    gain = delta.where(delta > 0, 0.0)
    loss = (-delta).where(delta < 0, 0.0)
    avg_gain = gain.ewm(span=period, adjust=False).mean()
    avg_loss = loss.ewm(span=period, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))
    return rsi.values


def compute_vwap_distance(df, window=24):
    """Rolling 24H VWAP distance."""
    typical_price = (df['high'] + df['low'] + df['close']) / 3
    vol = df['volume']
    tp_vol = typical_price * vol
    rolling_tp_vol = tp_vol.rolling(window).sum()
    rolling_vol = vol.rolling(window).sum()
    vwap = rolling_tp_vol / rolling_vol.replace(0, np.nan)
    dist = (df['close'] - vwap) / vwap
    return dist.values


def compute_adx(df, period=14):
    high = df['high'].values
    low = df['low'].values
    close = df['close'].values

    plus_dm = np.zeros(len(df))
    minus_dm = np.zeros(len(df))
    tr = np.zeros(len(df))

    for i in range(1, len(df)):
        up = high[i] - high[i-1]
        down = low[i-1] - low[i]
        plus_dm[i] = up if (up > down and up > 0) else 0
        minus_dm[i] = down if (down > up and down > 0) else 0
        tr[i] = max(high[i] - low[i], abs(high[i] - close[i-1]), abs(low[i] - close[i-1]))

    atr_s = pd.Series(tr).ewm(span=period, adjust=False).mean()
    plus_di = 100 * pd.Series(plus_dm).ewm(span=period, adjust=False).mean() / atr_s.replace(0, np.nan)
    minus_di = 100 * pd.Series(minus_dm).ewm(span=period, adjust=False).mean() / atr_s.replace(0, np.nan)
    dx = 100 * np.abs(plus_di - minus_di) / (plus_di + minus_di).replace(0, np.nan)
    adx = dx.ewm(span=period, adjust=False).mean()
    return adx.values


def compute_obv(df):
    close = df['close'].values
    volume = df['volume'].values
    obv = np.zeros(len(df))
    for i in range(1, len(df)):
        if close[i] > close[i-1]:
            obv[i] = obv[i-1] + volume[i]
        elif close[i] < close[i-1]:
            obv[i] = obv[i-1] - volume[i]
        else:
            obv[i] = obv[i-1]
    return obv


def compute_6d_features(token, path):
    """Compute 6D features for a single token, z-score normalized."""
    df = pd.read_csv(path)
    df['timestamp'] = pd.to_datetime(df['timestamp'])

    df['atr'] = compute_atr(df, 14)
    df['bbw'] = compute_bbw(df, 20, 2)
    df['rsi'] = compute_rsi(df, 14)
    df['vwap_dist'] = compute_vwap_distance(df, 24)
    df['adx'] = compute_adx(df, 14)
    df['obv'] = compute_obv(df)

    # Drop warmup period (first 24 rows)
    df = df.iloc[24:].copy()

    # Z-score normalize per token
    features = ['atr', 'bbw', 'rsi', 'vwap_dist', 'adx', 'obv']
    z_cols = []
    for f in features:
        col = f"{f}_z"
        mean = df[f].mean()
        std = df[f].std()
        if std == 0 or np.isnan(std):
            df[col] = 0.0
        else:
            df[col] = (df[f] - mean) / std
        z_cols.append(col)

    df['token'] = token
    return df[['timestamp', 'token'] + z_cols + ['open', 'high', 'low', 'close', 'volume']].dropna()


def step3_features(token_info):
    """Compute 6D features for all tokens."""
    print("\n" + "=" * 60)
    print("STEP 3: Compute 6D features for ALL tokens")
    print("=" * 60)

    all_dfs = []
    for token in ALL_TOKENS:
        if token not in token_info:
            print(f"  {token}: skipping (no data)")
            continue
        path = token_info[token]['path']
        df = compute_6d_features(token, path)
        all_dfs.append(df)
        print(f"  {token}: {len(df)} feature rows")

    combined = pd.concat(all_dfs, ignore_index=True)
    out_path = os.path.join(BASE, "features_6d_all_tokens.parquet")
    combined.to_parquet(out_path)
    print(f"\n  Saved: {out_path} ({len(combined)} total rows)")
    return combined


# ============================================================
# STEP 4: Classify against K=9 centroids
# ============================================================

def load_centroids():
    """Load K=9 centroids from topology file."""
    with open(os.path.join(BASE, "topology_9basin.json")) as f:
        topo = json.load(f)

    centroids = {}
    for cid, cdata in topo['clusters'].items():
        centroids[int(cid)] = np.array([
            cdata['centroid']['atr_z'],
            cdata['centroid']['bbw_z'],
            cdata['centroid']['rsi_z'],
            cdata['centroid']['vwap_dist_z'],
            cdata['centroid']['adx_z'],
            cdata['centroid']['obv_z'],
        ])
    return centroids, topo


def classify_candles(df, centroids):
    """Assign each candle to nearest centroid."""
    feature_cols = ['atr_z', 'bbw_z', 'rsi_z', 'vwap_dist_z', 'adx_z', 'obv_z']
    X = df[feature_cols].values

    centroid_ids = sorted(centroids.keys())
    centroid_matrix = np.array([centroids[cid] for cid in centroid_ids])

    # Euclidean distance to each centroid
    # X: (n, 6), centroid_matrix: (9, 6)
    dists = np.sqrt(((X[:, np.newaxis, :] - centroid_matrix[np.newaxis, :, :]) ** 2).sum(axis=2))
    nearest_idx = dists.argmin(axis=1)
    nearest_dist = dists.min(axis=1)

    df = df.copy()
    df['basin'] = [centroid_ids[i] for i in nearest_idx]
    df['basin_dist'] = nearest_dist
    return df


def step4_classify(features_df, centroids):
    """Classify all candles."""
    print("\n" + "=" * 60)
    print("STEP 4: Classify against K=9 centroids")
    print("=" * 60)

    df = classify_candles(features_df, centroids)
    print(f"  Classified {len(df)} candles across {df['token'].nunique()} tokens")

    # Print basin distribution
    dist = df['basin'].value_counts().sort_index()
    for basin, count in dist.items():
        pct = 100 * count / len(df)
        print(f"    C{basin}: {count:>8} ({pct:.1f}%)")

    return df


# ============================================================
# STEP 5: Basin affinity analysis
# ============================================================

def compute_forward_returns(df):
    """Compute 24H forward returns per token."""
    dfs = []
    for token, gdf in df.groupby('token'):
        g = gdf.sort_values('timestamp').copy()
        g['fwd_24h_return'] = g['close'].shift(-24) / g['close'] - 1
        dfs.append(g)
    return pd.concat(dfs, ignore_index=True)


def compute_dwell_times(basins):
    """Compute dwell times from a sequence of basin assignments."""
    if len(basins) == 0:
        return []
    dwells = []
    current = basins.iloc[0]
    count = 1
    for b in basins.iloc[1:]:
        if b == current:
            count += 1
        else:
            dwells.append((current, count))
            current = b
            count = 1
    dwells.append((current, count))
    return dwells


def basin_affinity(df, token):
    """Compute basin affinity stats for a single token."""
    tdf = df[df['token'] == token].sort_values('timestamp').copy()
    n = len(tdf)

    stats = {}
    for basin in sorted(tdf['basin'].unique()):
        bdf = tdf[tdf['basin'] == basin]
        count = len(bdf)
        occupancy = 100 * count / n

        # Forward returns
        valid_fwd = bdf['fwd_24h_return'].dropna()
        fwd_mean = valid_fwd.mean() * 100 if len(valid_fwd) > 0 else 0
        fwd_median = valid_fwd.median() * 100 if len(valid_fwd) > 0 else 0
        pos_rate = 100 * (valid_fwd > 0).mean() if len(valid_fwd) > 0 else 0

        # Dwell times
        dwells = compute_dwell_times(tdf['basin'])
        basin_dwells = [d for b, d in dwells if b == basin]
        mean_dwell = np.mean(basin_dwells) if basin_dwells else 0
        median_dwell = np.median(basin_dwells) if basin_dwells else 0
        n_visits = len(basin_dwells)

        stats[str(basin)] = {
            'count': int(count),
            'occupancy_pct': round(occupancy, 2),
            'mean_dwell': round(mean_dwell, 2),
            'median_dwell': round(float(median_dwell), 1),
            'n_visits': n_visits,
            'fwd_24h_mean_pct': round(fwd_mean, 4),
            'fwd_24h_median_pct': round(fwd_median, 4),
            'fwd_24h_positive_rate': round(pos_rate, 1),
        }

    return stats


def step5_affinity(df):
    """Basin affinity for all tokens."""
    print("\n" + "=" * 60)
    print("STEP 5: Basin affinity analysis")
    print("=" * 60)

    df = compute_forward_returns(df)

    affinity = {}
    for token in ALL_TOKENS:
        if token not in df['token'].values:
            continue
        stats = basin_affinity(df, token)
        affinity[token] = stats
        n_basins = len(stats)
        print(f"  {token}: {n_basins} basins occupied")

    return affinity, df


# ============================================================
# STEP 6: Thermodynamic legibility score
# ============================================================

def compute_silhouette_for_token(df, centroids, token):
    """Compute silhouette score for a single token against K=9."""
    tdf = df[df['token'] == token].copy()
    feature_cols = ['atr_z', 'bbw_z', 'rsi_z', 'vwap_dist_z', 'adx_z', 'obv_z']
    X = tdf[feature_cols].values
    labels = tdf['basin'].values

    if len(set(labels)) < 2:
        return 0.0

    # Sample for speed if large
    if len(X) > 20000:
        idx = np.random.choice(len(X), 20000, replace=False)
        X = X[idx]
        labels = labels[idx]

    from sklearn.metrics import silhouette_score
    return silhouette_score(X, labels, sample_size=min(10000, len(X)))


def compute_dwell_consistency(affinity, token):
    """How consistent are dwell times? Low CV = consistent."""
    stats = affinity.get(token, {})
    dwells = [s['mean_dwell'] for s in stats.values() if s['occupancy_pct'] > 3]
    if len(dwells) < 2:
        return 1.0
    cv = np.std(dwells) / np.mean(dwells) if np.mean(dwells) > 0 else 999
    # Invert: lower CV = higher consistency score
    return 1.0 / (1.0 + cv)


def step6_legibility(df, affinity, centroids):
    """Compute legibility scores."""
    print("\n" + "=" * 60)
    print("STEP 6: Thermodynamic legibility score")
    print("=" * 60)

    legibility = {}
    for token in ALL_TOKENS:
        if token not in affinity:
            continue

        sil = compute_silhouette_for_token(df, centroids, token)
        dwell_cons = compute_dwell_consistency(affinity, token)
        # Combined: 60% silhouette, 40% dwell consistency (same as prior analysis)
        combined = 0.6 * sil + 0.4 * dwell_cons

        legibility[token] = {
            'silhouette': round(sil, 4),
            'dwell_consistency': round(dwell_cons, 4),
            'combined': round(combined, 4),
        }
        print(f"  {token}: sil={sil:.4f}, dwell_con={dwell_cons:.4f}, combined={combined:.4f}")

    return legibility


# ============================================================
# STEP 7: Sweet spots and danger zones
# ============================================================

def step7_sweet_danger(affinity):
    """Identify sweet spots and danger zones."""
    print("\n" + "=" * 60)
    print("STEP 7: Sweet spots and danger zones")
    print("=" * 60)

    # Compute cross-token average forward return per basin
    basin_returns = {}
    for token, stats in affinity.items():
        for basin, s in stats.items():
            if basin not in basin_returns:
                basin_returns[basin] = []
            basin_returns[basin].append(s['fwd_24h_mean_pct'])

    basin_avg = {b: np.mean(rs) for b, rs in basin_returns.items()}

    sweet_spots = {}
    danger_zones = {}

    for token, stats in affinity.items():
        sweets = []
        dangers = []

        for basin, s in stats.items():
            occ = s['occupancy_pct']
            fwd = s['fwd_24h_mean_pct']

            if occ < 5:
                continue

            avg = basin_avg.get(basin, 0)

            if fwd > 0 and fwd > avg:
                sweets.append({
                    'basin': basin,
                    'occupancy_pct': occ,
                    'fwd_24h_mean_pct': fwd,
                    'cross_token_avg': round(avg, 4),
                    'positive_rate': s['fwd_24h_positive_rate'],
                })

            if fwd < -0.05:  # significantly negative
                dangers.append({
                    'basin': basin,
                    'occupancy_pct': occ,
                    'fwd_24h_mean_pct': fwd,
                    'positive_rate': s['fwd_24h_positive_rate'],
                })

        sweet_spots[token] = sweets
        danger_zones[token] = dangers
        n_s = len(sweets)
        n_d = len(dangers)
        if n_s > 0 or n_d > 0:
            print(f"  {token}: {n_s} sweet spots, {n_d} danger zones")

    return sweet_spots, danger_zones, basin_avg


# ============================================================
# STEP 8: Ranking and recommendations
# ============================================================

def step8_ranking(affinity, legibility, sweet_spots, danger_zones):
    """Master ranking of all tokens."""
    print("\n" + "=" * 60)
    print("STEP 8: Master ranking and recommendations")
    print("=" * 60)

    rankings = []
    for token in ALL_TOKENS:
        if token not in legibility:
            continue

        leg = legibility[token]['combined']
        n_sweet = len(sweet_spots.get(token, []))
        n_danger = len(danger_zones.get(token, []))

        # Weighted forward return across all basins
        total_weighted_return = 0
        stats = affinity.get(token, {})
        for basin, s in stats.items():
            total_weighted_return += s['occupancy_pct'] * s['fwd_24h_mean_pct'] / 100

        rankings.append({
            'token': token,
            'legibility': leg,
            'n_sweet_spots': n_sweet,
            'n_danger_zones': n_danger,
            'weighted_fwd_return': round(total_weighted_return, 4),
            'is_original_12': token in EXISTING_12,
        })

    # Sort by: legibility desc, n_sweet desc, weighted return desc
    rankings.sort(key=lambda x: (x['legibility'], x['n_sweet_spots'], x['weighted_fwd_return']), reverse=True)

    print(f"\n{'Rank':>4} {'Token':<8} {'Legibility':>10} {'Sweet':>5} {'Danger':>6} {'Wt.Return':>10} {'Group'}")
    print("-" * 60)
    for i, r in enumerate(rankings, 1):
        group = "ORIG" if r['is_original_12'] else "NEW"
        print(f"{i:>4} {r['token']:<8} {r['legibility']:>10.4f} {r['n_sweet_spots']:>5} {r['n_danger_zones']:>6} {r['weighted_fwd_return']:>10.4f} {group}")

    # Current roster
    current_best = ['BTC', 'BNB', 'DOGE', 'LINK', 'SOL']

    # Find DOGE-like (high legibility, retail momentum)
    doge_leg = legibility.get('DOGE', {}).get('combined', 0)
    doge_like = [r for r in rankings if r['token'] != 'DOGE' and r['token'] not in current_best
                 and r['legibility'] > doge_leg * 0.8 and r['n_sweet_spots'] >= 1]
    doge_like.sort(key=lambda x: x['legibility'], reverse=True)

    # Find LINK-like (broad performer, no danger zones)
    link_like = [r for r in rankings if r['token'] != 'LINK' and r['token'] not in current_best
                 and r['n_danger_zones'] == 0 and r['n_sweet_spots'] >= 2]
    link_like.sort(key=lambda x: x['weighted_fwd_return'], reverse=True)

    print(f"\nDOGE-like tokens (high legibility, retail momentum):")
    for r in doge_like[:5]:
        print(f"  {r['token']}: leg={r['legibility']:.4f}, sweet={r['n_sweet_spots']}, wt_ret={r['weighted_fwd_return']:.4f}")

    print(f"\nLINK-like tokens (broad performer, no danger zones):")
    for r in link_like[:5]:
        print(f"  {r['token']}: leg={r['legibility']:.4f}, sweet={r['n_sweet_spots']}, wt_ret={r['weighted_fwd_return']:.4f}")

    return rankings, doge_like, link_like


# ============================================================
# STEP 9: C4 capitulation check
# ============================================================

def step9_c4_check(affinity):
    """Check C4 (capitulation basin) universality."""
    print("\n" + "=" * 60)
    print("STEP 9: C4 capitulation check")
    print("=" * 60)

    c4_results = {}
    print(f"\n{'Token':<8} {'C4 Fwd 24H %':>12} {'C4 Pos Rate':>11} {'C4 Occupancy':>12}")
    print("-" * 50)

    for token in ALL_TOKENS:
        stats = affinity.get(token, {})
        c4 = stats.get('4', None)
        if c4:
            c4_results[token] = {
                'fwd_24h_mean_pct': c4['fwd_24h_mean_pct'],
                'positive_rate': c4['fwd_24h_positive_rate'],
                'occupancy_pct': c4['occupancy_pct'],
            }
            print(f"{token:<8} {c4['fwd_24h_mean_pct']:>12.4f} {c4['fwd_24h_positive_rate']:>10.1f}% {c4['occupancy_pct']:>11.2f}%")
        else:
            c4_results[token] = {'fwd_24h_mean_pct': None, 'positive_rate': None, 'occupancy_pct': 0}
            print(f"{token:<8} {'N/A':>12} {'N/A':>11} {'0.00':>12}%")

    # Summary
    positive_c4 = [t for t, r in c4_results.items() if r['fwd_24h_mean_pct'] is not None and r['fwd_24h_mean_pct'] > 0]
    total_with_c4 = [t for t, r in c4_results.items() if r['fwd_24h_mean_pct'] is not None]
    print(f"\n  C4 positive forward return: {len(positive_c4)}/{len(total_with_c4)} tokens")
    print(f"  Universal alpha {'CONFIRMED' if len(positive_c4) / max(len(total_with_c4), 1) > 0.7 else 'NOT confirmed'}")

    return c4_results


# ============================================================
# STEP 10: Save everything
# ============================================================

def step10_save(token_info, affinity, legibility, sweet_spots, danger_zones,
                rankings, c4_results, basin_avg, doge_like, link_like):
    """Save full results to JSON."""
    print("\n" + "=" * 60)
    print("STEP 10: Save results")
    print("=" * 60)

    # Build roster recommendation
    current = ['BTC', 'BNB', 'DOGE', 'LINK', 'SOL']
    # Top tokens by legibility not in current
    new_candidates = [r for r in rankings if r['token'] not in current][:5]

    result = {
        'metadata': {
            'analysis': 'Mid-Cap Token Discovery — Expanded Universe Basin Affinity',
            'date': '2026-04-07',
            'existing_12': EXISTING_12,
            'new_15': NEW_15,
            'all_tokens': ALL_TOKENS,
            'centroids_source': 'topology_9basin.json (KMeans K=9)',
            'normalization': 'per-token z-score',
        },
        'token_data_ranges': {t: {
            'n_candles': info['n_candles'],
            'first_date': info['first_date'],
            'last_date': info['last_date'],
        } for t, info in token_info.items()},
        'legibility_scores': legibility,
        'basin_affinity': affinity,
        'basin_cross_token_averages': {k: round(v, 4) for k, v in basin_avg.items()},
        'sweet_spots': sweet_spots,
        'danger_zones': danger_zones,
        'master_ranking': rankings,
        'c4_universality': c4_results,
        'roster_recommendations': {
            'current_best_5': current,
            'top_new_candidates': [r['token'] for r in new_candidates],
            'doge_like': [r['token'] for r in doge_like[:5]],
            'link_like': [r['token'] for r in link_like[:5]],
        },
    }

    out_path = os.path.join(BASE, "midcap_discovery_analysis.json")
    with open(out_path, 'w') as f:
        json.dump(result, f, indent=2, default=str)
    print(f"  Saved: {out_path}")

    return result


# ============================================================
# MAIN
# ============================================================

if __name__ == '__main__':
    # Step 2
    token_info = step2_download()

    # Step 3
    features_df = step3_features(token_info)

    # Step 4
    centroids, topo = load_centroids()
    classified_df = step4_classify(features_df, centroids)

    # Step 5
    affinity, df_with_fwd = step5_affinity(classified_df)

    # Step 6
    legibility = step6_legibility(df_with_fwd, affinity, centroids)

    # Step 7
    sweet_spots, danger_zones, basin_avg = step7_sweet_danger(affinity)

    # Step 8
    rankings, doge_like, link_like = step8_ranking(affinity, legibility, sweet_spots, danger_zones)

    # Step 9
    c4_results = step9_c4_check(affinity)

    # Step 10
    step10_save(token_info, affinity, legibility, sweet_spots, danger_zones,
                rankings, c4_results, basin_avg, doge_like, link_like)

    print("\n" + "=" * 60)
    print("PIPELINE COMPLETE")
    print("=" * 60)
