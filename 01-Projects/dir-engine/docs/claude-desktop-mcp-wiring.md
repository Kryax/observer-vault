# Claude Desktop MCP Wiring — dir-engine

## The Bug

Claude Desktop (Electron app) silently overwrites `~/.config/Claude/claude_desktop_config.json` whenever it persists preferences. The overwrite replaces the entire file with only the `preferences` object, dropping all `mcpServers` entries. This happens at unpredictable times during a session (not just on startup/shutdown).

The built-in Filesystem MCP server is unaffected because it's loaded via the DXT extension system (`extensions-installations.json`), not via `claude_desktop_config.json`.

**Platform:** CachyOS (Arch-based), AUR package `claude-desktop-bin` (patrickjaja/claude-desktop-bin).  
**Confirmed:** 3 April 2026, observed in MCP logs — config written with mcpServers, then read back without them within seconds.

## Solution: MCP Config Guard (inotifywait + systemd)

A systemd user service watches the config file for writes. When `mcpServers` disappears, the guard re-injects them using `jq` within ~300ms.

### Components

| File | Purpose |
|------|---------|
| `scripts/claude-desktop-mcp-guard.sh` | Watcher script — inotifywait + jq |
| `~/.config/systemd/user/claude-mcp-guard.service` | systemd user service |

### Setup

```bash
# 1. Install dependency
sudo pacman -S inotify-tools

# 2. Enable and start the guard
systemctl --user daemon-reload
systemctl --user enable --now claude-mcp-guard.service

# 3. Verify it's running
systemctl --user status claude-mcp-guard.service
journalctl --user -u claude-mcp-guard.service -f
```

### Adding More MCP Servers

Edit the `MCP_SERVERS` variable in `scripts/claude-desktop-mcp-guard.sh`, then restart:

```bash
systemctl --user restart claude-mcp-guard.service
```

### How It Works

1. On startup, checks config and injects mcpServers if missing
2. Watches `~/.config/Claude/` directory for `close_write` and `moved_to` events on `claude_desktop_config.json`
3. When Claude Desktop overwrites the file, the guard detects the change within 300ms
4. Uses `jq` to merge mcpServers back into the existing file (preserving preferences)
5. Debounces to avoid fighting rapid-fire writes (2-second cooldown)

### Alternatives Considered

| Approach | Why Not |
|----------|---------|
| `chattr +i` (immutable) | Prevents Claude Desktop from saving preferences — breaks toggles |
| Wrapper script (pre-launch write) | Gets overwritten during session, not just on startup |
| Symlink to read-only file | Same problem as chattr — blocks preference writes |
| UI Settings > Developer > Edit Config | Same result — Electron overwrites it later |

### Verifying

```bash
# Check current config
cat ~/.config/Claude/claude_desktop_config.json | jq .

# Watch the guard in action
journalctl --user -u claude-mcp-guard.service -f

# Simulate the bug (nuke mcpServers)
echo '{"preferences":{"test":true}}' > ~/.config/Claude/claude_desktop_config.json
# Guard should restore within 1 second

# Check Claude Desktop MCP logs
tail -20 ~/.config/Claude/logs/mcp.log
```

### If It Breaks

```bash
# Check service status
systemctl --user status claude-mcp-guard.service

# Restart
systemctl --user restart claude-mcp-guard.service

# Manual restore
jq '.mcpServers = {"dir-engine":{"command":"/home/adam/.bun/bin/bun","args":["/mnt/zfs-host/backup/projects/observer-vault/01-Projects/dir-engine/src/mcp/server.ts"]}}' \
  ~/.config/Claude/claude_desktop_config.json > /tmp/cc.json && mv /tmp/cc.json ~/.config/Claude/claude_desktop_config.json
```

### AUR-Specific Notes

- The launcher at `/usr/bin/claude-desktop` is a bash wrapper — no config manipulation happens there
- The app uses system Electron (`electron` binary), not bundled
- Package updates will overwrite `/usr/bin/claude-desktop` but **not** our guard (it's in user space)
- The config path is hardcoded to `$XDG_CONFIG_HOME/Claude/claude_desktop_config.json`
