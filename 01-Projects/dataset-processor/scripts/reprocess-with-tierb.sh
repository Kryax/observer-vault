#!/usr/bin/env bash
# Reprocess Pile shards with Tier A (bun) + Tier B (pure Python enrichment).
# spaCy unavailable — uses enrich-tier-b.py for structural enrichment.
# Also applies schema migration for compositionExpression/space/idealParent.
#
# Usage: bash scripts/reprocess-with-tierb.sh [start_shard] [end_shard]
#   Default: process shards 10-29

set -euo pipefail

PILE_DIR="/mnt/zfs-host/backup/datasets/pile-uncopyrighted"
OUTPUT_DIR="$(cd "$(dirname "$0")/.." && pwd)/output"
MOTIFS_DIR="$(cd "$(dirname "$0")/../../.." && pwd)/02-Knowledge/motifs"
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENRICH_SCRIPT="$(cd "$(dirname "$0")" && pwd)/enrich-tier-b.py"

START=${1:-10}
END=${2:-29}

echo "[batch] Processing shards $(printf '%02d' $START)-$(printf '%02d' $END)"
echo "[batch] Output: $OUTPUT_DIR"
echo "[batch] Motifs: $MOTIFS_DIR"
echo "[batch] Tier B: $ENRICH_SCRIPT"
echo "[batch] Started: $(date -Iseconds)"
echo ""

cd "$SCRIPT_DIR"

for i in $(seq $START $END); do
  SHARD=$(printf '%02d' $i)
  SHARD_FILE="$PILE_DIR/$SHARD.jsonl.zst"
  DB_FILE="$OUTPUT_DIR/shard-$SHARD.db"

  if [ ! -f "$SHARD_FILE" ]; then
    echo "[batch] SKIP shard-$SHARD: source file not found"
    continue
  fi

  # Back up existing DB (if any)
  if [ -f "$DB_FILE" ]; then
    echo "[batch] Backing up existing shard-$SHARD.db"
    mv "$DB_FILE" "$DB_FILE.bak-pre-reprocess"
    rm -f "$DB_FILE-shm" "$DB_FILE-wal"
    [ -f "$DB_FILE.pipeline-state.json" ] && mv "$DB_FILE.pipeline-state.json" "$DB_FILE.pipeline-state.json.bak-pre-reprocess"
  fi

  echo "[batch] ═══════════════════════════════════════════"
  echo "[batch] Processing shard-$SHARD — Tier A ($(date -Iseconds))"
  echo "[batch] ═══════════════════════════════════════════"

  # Step 1: Tier A extraction (bun orchestrator)
  bun src/index.ts orchestrate \
    --shard "$SHARD_FILE" \
    --db "$DB_FILE" \
    --motifs "$MOTIFS_DIR" \
    --no-tier-b \
    --no-tier-c \
    --max-passes 1 \
    2>&1 | tee "$OUTPUT_DIR/shard-$SHARD.log"

  echo "[batch] shard-$SHARD Tier A complete ($(date -Iseconds))"

  # Step 2: Schema migration (idempotent — safe to re-run)
  echo "[batch] Applying schema migration for shard-$SHARD..."
  sqlite3 "$DB_FILE" "
    ALTER TABLE verb_records ADD COLUMN compositionExpression TEXT;
  " 2>/dev/null || true
  sqlite3 "$DB_FILE" "
    ALTER TABLE verb_records ADD COLUMN space TEXT;
  " 2>/dev/null || true
  sqlite3 "$DB_FILE" "
    ALTER TABLE verb_records ADD COLUMN idealParent TEXT;
  " 2>/dev/null || true
  sqlite3 "$DB_FILE" "
    CREATE INDEX IF NOT EXISTS idx_vr_composition ON verb_records(compositionExpression);
    CREATE INDEX IF NOT EXISTS idx_vr_space ON verb_records(space);
  " 2>/dev/null || true

  # Step 3: Tier B enrichment (pure Python)
  echo "[batch] Enriching shard-$SHARD — Tier B ($(date -Iseconds))"
  python3 "$ENRICH_SCRIPT" --db "$DB_FILE" 2>&1 | tail -5

  echo "[batch] shard-$SHARD complete ($(date -Iseconds))"
  echo ""
done

echo "[batch] ═══════════════════════════════════════════"
echo "[batch] All shards processed. Running governance..."
echo "[batch] ═══════════════════════════════════════════"

# Run governance on each shard
for i in $(seq $START $END); do
  SHARD=$(printf '%02d' $i)
  DB_FILE="$OUTPUT_DIR/shard-$SHARD.db"

  if [ ! -f "$DB_FILE" ]; then
    continue
  fi

  echo "[governance] shard-$SHARD"
  bun src/index.ts governance \
    --db "$DB_FILE" \
    --motifs "$MOTIFS_DIR" \
    --queue "$OUTPUT_DIR/promotion-queue-t2" \
    --digests "$OUTPUT_DIR/digests" \
    2>&1
  echo ""
done

echo "[batch] Complete: $(date -Iseconds)"
