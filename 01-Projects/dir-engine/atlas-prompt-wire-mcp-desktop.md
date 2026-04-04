# Atlas Task: Wire D/I/R Engine MCP Server into Claude Desktop (Linux/AUR)

## Problem

Claude Desktop on Linux (AUR `claude-desktop-bin` package) has a **confirmed bug** where it silently overwrites `~/.config/Claude/claude_desktop_config.json` with a preferences-only stub, destroying all `mcpServers` entries. This has happened 3+ times already. See: https://github.com/anthropics/claude-code/issues/32345

The dir-engine MCP server is already wired into `.mcp.json` for Claude Code. It needs to ALSO work in Claude Desktop.

## Current State

**Working (Claude Code):** `.mcp.json` at vault root already has:
```json
{
  "mcpServers": {
    "dir-engine": {
      "type": "stdio",
      "command": "bun",
      "args": ["/mnt/zfs-host/backup/projects/observer-vault/01-Projects/dir-engine/src/mcp/server.ts"]
    }
  }
}
```

**NOT working (Claude Desktop):** `~/.config/Claude/claude_desktop_config.json` keeps getting overwritten back to:
```json
{
  "preferences": {
    "coworkScheduledTasksEnabled": true,
    "ccdScheduledTasksEnabled": true,
    "sidebarMode": "chat",
    "coworkWebSearchEnabled": true
  }
}
```

## What You Need To Do

### 1. Investigate the AUR package's config handling

Check:
- `pacman -Ql claude-desktop-bin | grep -i config` — what files does the package install?
- Whether the AUR package (`patrickjaja/claude-desktop-bin`) has any patches or workarounds for the config overwrite bug
- Read `/usr/bin/claude-desktop` or the launcher script to understand how it starts
- Check if there's a `--config` flag or environment variable
- Check the changelog: https://github.com/patrickjaja/claude-desktop-bin/blob/master/CHANGELOG.md — search for "config" or "mcpServers" or "overwrite"

### 2. Find a robust workaround

Options to evaluate (in order of preference):
1. **File watcher / restore script** — inotifywait watches the config file; if mcpServers disappears, restore from a template
2. **chattr +i** — make the config file immutable after writing (prevents any process from overwriting it). Risk: may break preferences updates
3. **Symlink trick** — symlink `claude_desktop_config.json` to a file Claude Desktop can't easily overwrite
4. **Wrapper script** — modify the launcher to write the config just before Claude Desktop starts
5. **Settings > Developer > Edit Config** — check if using the UI method to add the config is more persistent than file editing

### 3. Write the config

The target config should be:
```json
{
  "preferences": {
    "coworkScheduledTasksEnabled": true,
    "ccdScheduledTasksEnabled": true,
    "sidebarMode": "chat",
    "coworkWebSearchEnabled": true
  },
  "mcpServers": {
    "dir-engine": {
      "command": "/home/adam/.bun/bin/bun",
      "args": [
        "/mnt/zfs-host/backup/projects/observer-vault/01-Projects/dir-engine/src/mcp/server.ts"
      ]
    }
  }
}
```

Note: Use absolute path to bun (`/home/adam/.bun/bin/bun`) — Claude Desktop may not have `~/.bun/bin` in its PATH.

### 4. Verify it works

- Write the config
- Apply whatever persistence workaround you found
- Fully quit Claude Desktop: `pkill -f claude-desktop` or `killall claude-desktop`
- Restart it
- Check the logs at `~/.config/Claude/logs/mcp.log` for dir-engine connection
- Check if `~/.config/Claude/claude_desktop_config.json` still has `mcpServers` after restart
- If it got nuked again, the workaround failed — try the next option

### 5. Document the solution

Write a receipt to `01-Projects/dir-engine/docs/claude-desktop-mcp-wiring.md` with:
- What the bug is
- Which workaround works
- How to restore it if it breaks again
- Any AUR-specific considerations

## Constraints

- Do NOT modify the dir-engine source code — the server itself works fine
- Do NOT modify `.mcp.json` — that's for Claude Code, already working
- The Filesystem MCP server (built-in) is already connecting successfully per the logs — study how IT persists as a reference
- Adam is on CachyOS (Arch-based), AUR package `claude-desktop-bin`
- Bun is at `/home/adam/.bun/bin/bun`
