#!/usr/bin/env bash
# Batch Tier B enrichment for shards 01-09
# Backs up each shard before enriching.
set -euo pipefail

cd "$(dirname "$0")/.."

START=${1:-1}
END=${2:-9}

echo "[enrich] Batch Tier B enrichment: shards $(printf '%02d' $START)-$(printf '%02d' $END)"
echo "[enrich] Started: $(date -Iseconds)"
echo ""

for i in $(seq $START $END); do
  SHARD=$(printf '%02d' $i)
  DB="output/shard-$SHARD.db"

  if [ ! -f "$DB" ]; then
    echo "[enrich] SKIP shard-$SHARD: DB not found"
    continue
  fi

  # Backup
  if [ ! -f "$DB.bak-pre-enrich" ]; then
    echo "[enrich] Backing up shard-$SHARD.db"
    cp "$DB" "$DB.bak-pre-enrich"
  fi

  echo "[enrich] ═══ shard-$SHARD ($(date -Iseconds)) ═══"
  python3 scripts/enrich-tier-b.py --db "$DB" 2>&1
  echo ""
done

echo "[enrich] Complete: $(date -Iseconds)"
