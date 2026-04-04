#!/usr/bin/env bash
# Reprocess all 30 Pile shards with the full 32-indicator set.
# Sequential processing to avoid NFS WAL contention.
# Each shard gets a fresh DB (old DBs backed up to .bak-pre-reprocess).
#
# Usage: bash scripts/reprocess-all-shards.sh [start_shard] [end_shard]
#   Default: process shards 01-29 (shard-00 already done)

set -euo pipefail

PILE_DIR="/mnt/zfs-host/backup/datasets/pile-uncopyrighted"
OUTPUT_DIR="$(cd "$(dirname "$0")/.." && pwd)/output"
MOTIFS_DIR="$(cd "$(dirname "$0")/../../.." && pwd)/02-Knowledge/motifs"
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

START=${1:-1}
END=${2:-29}

echo "[batch] Processing shards $(printf '%02d' $START)-$(printf '%02d' $END)"
echo "[batch] Output: $OUTPUT_DIR"
echo "[batch] Motifs: $MOTIFS_DIR"
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

  # Back up existing DB
  if [ -f "$DB_FILE" ]; then
    echo "[batch] Backing up existing shard-$SHARD.db"
    mv "$DB_FILE" "$DB_FILE.bak-pre-reprocess"
    rm -f "$DB_FILE-shm" "$DB_FILE-wal"
    [ -f "$DB_FILE.pipeline-state.json" ] && mv "$DB_FILE.pipeline-state.json" "$DB_FILE.pipeline-state.json.bak-pre-reprocess"
  fi

  echo "[batch] ═══════════════════════════════════════════"
  echo "[batch] Processing shard-$SHARD ($(date -Iseconds))"
  echo "[batch] ═══════════════════════════════════════════"

  bun src/index.ts orchestrate \
    --shard "$SHARD_FILE" \
    --db "$DB_FILE" \
    --motifs "$MOTIFS_DIR" \
    --no-tier-b \
    --no-tier-c \
    --max-passes 1 \
    2>&1 | tee "$OUTPUT_DIR/shard-$SHARD.log"

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
