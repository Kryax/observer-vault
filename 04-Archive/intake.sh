#!/usr/bin/env bash
# intake.sh — Create a new intake note in ~/vault/intake/
# Usage: ./intake.sh "topic slug"
#        echo "content" | ./intake.sh "topic slug"
set -euo pipefail

INTAKE_DIR="$(cd "$(dirname "$0")" && pwd)"
SEQ_FILE="$INTAKE_DIR/SEQUENCE"

if [ $# -lt 1 ]; then
    echo "Usage: $0 \"topic slug\" [source]"
    echo "  source: chatgpt, claude, telegram, obsidian (default: manual)"
    exit 1
fi

SLUG="$(echo "$1" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd 'a-z0-9-')"
SOURCE="${2:-manual}"
DATE="$(date +%Y-%m-%d)"

# Read and increment sequence
SEQ=$(cat "$SEQ_FILE")
PADDED=$(printf "%04d" "$SEQ")
echo $((SEQ + 1)) > "$SEQ_FILE"

FILENAME="${PADDED}-${DATE}-${SLUG}.md"
FILEPATH="$INTAKE_DIR/$FILENAME"

# Write frontmatter
cat > "$FILEPATH" <<EOF
# ${1}

**Status:** CANDIDATE
**Date extracted:** ${DATE}
**Source:** ${SOURCE}
**Notes:** Verbatim import; no summarization.

---

EOF

# If stdin is piped, append it
if [ ! -t 0 ]; then
    cat >> "$FILEPATH"
fi

echo "Created: $FILEPATH"

# Open in editor if stdin is a terminal
if [ -t 0 ] && [ -t 1 ] && [ -n "${EDITOR:-}" ]; then
    "$EDITOR" "$FILEPATH"
fi
