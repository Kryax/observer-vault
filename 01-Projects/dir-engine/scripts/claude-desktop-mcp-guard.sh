#!/usr/bin/env bash
# claude-desktop-mcp-guard.sh
#
# Watches ~/.config/Claude/claude_desktop_config.json for overwrites by
# Claude Desktop's Electron app, which silently drops mcpServers entries.
# When mcpServers disappear, this script re-injects them from a template.
#
# Designed to run as a systemd user service.
# Requires: inotify-tools, jq

set -euo pipefail

CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/Claude"
CONFIG_FILE="$CONFIG_DIR/claude_desktop_config.json"

# MCP servers to ensure are always present.
# Edit this JSON object to add/remove servers.
read -r -d '' MCP_SERVERS << 'SERVERS_EOF' || true
{
  "dir-engine": {
    "command": "/home/adam/.bun/bin/bun",
    "args": [
      "/mnt/zfs-host/backup/projects/observer-vault/01-Projects/dir-engine/src/mcp/server.ts"
    ]
  }
}
SERVERS_EOF

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [mcp-guard] $1"
}

ensure_mcp_servers() {
    if [[ ! -f "$CONFIG_FILE" ]]; then
        log "Config file missing, creating with mcpServers"
        echo '{}' | jq --argjson servers "$MCP_SERVERS" '. + {mcpServers: $servers}' > "$CONFIG_FILE"
        return
    fi

    # Check if mcpServers key exists and has our servers
    local has_dir_engine
    has_dir_engine=$(jq -r '.mcpServers["dir-engine"] // empty' "$CONFIG_FILE" 2>/dev/null)

    if [[ -z "$has_dir_engine" ]]; then
        log "mcpServers missing or incomplete — re-injecting"
        local tmp
        tmp=$(mktemp "$CONFIG_DIR/.config-guard.XXXXXX")
        jq --argjson servers "$MCP_SERVERS" '.mcpServers = ((.mcpServers // {}) + $servers)' "$CONFIG_FILE" > "$tmp"
        mv "$tmp" "$CONFIG_FILE"
        log "mcpServers restored"
    fi
}

# Initial check on startup
log "Starting MCP guard for $CONFIG_FILE"
ensure_mcp_servers

# Watch for close_write events on the config file.
# inotifywait -m streams events; we debounce with a 1-second cooldown.
last_run=0
# Watch the directory (not the file) because Electron may replace via mv.
# Filter to only our config filename.
inotifywait -m -e close_write,moved_to --format '%f' "$CONFIG_DIR" 2>/dev/null | while read -r filename; do
    [[ "$filename" == "claude_desktop_config.json" ]] || continue

    now=$(date +%s)
    if (( now - last_run < 2 )); then
        continue  # debounce
    fi
    last_run=$now

    sleep 0.3
    ensure_mcp_servers
done
