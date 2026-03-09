# Observer Vault

> The canonical knowledge store for the Observer ecosystem.

## Identity

This is Adam's Observer Vault — the persistent memory and knowledge base for the Observer Council, OIL, Control Plane, Observer Commons, and all related projects. It lives on ZFS (NFS-shared from Polaris proxmox) at `/mnt/zfs-host/backup/projects/observer-vault/`.

## Observer-Native Context

Read `01-Projects/observer-native/SKILL.md` — this is the primary cognitive context for vault sessions. It defines D/I/R as the operating primitive, the two-speed model, session memory, and sovereignty gate.

## Session Start

1. Check control plane status: `curl -s http://localhost:9000/health | python3 -m json.tool`
2. Review current project state: read `01-Projects/` for active work
3. Check git status: `git status --short` to see pending changes
4. Read the relevant project's state files before starting work

## Core Principle

**"AI articulates, humans decide."**

Adam decides. Atlas executes. OIL constrains.

## Workflow Orchestration

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan — don't keep pushing
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- One task per subagent for focused execution
- Offload research, exploration, and parallel work to subagents

### 3. Verification Before Done
- Never mark a task complete without proving it works
- Run pre-commit gates before declaring done
- Ask yourself: "Would Adam approve this?"

### 4. Boundary Enforcement (NON-NEGOTIABLE)
- If work crosses a project boundary: STOP. Ask Adam first.
- Never modify approved/canonical documents without explicit approval
- If pre-commit gates fail: STOP and report. Do not bypass.
- The OIL secret gate is active — no secrets in commits

### 5. When In Doubt
- STOP and ask Adam
- Do not assume approval
- Do not build when asked to plan

## Vault Structure

| Directory | Purpose |
|-----------|---------|
| `00-Inbox/` | New documents, drafts, intake. Auto-approved for creation. |
| `01-Projects/` | Active project directories |
| `02-Knowledge/` | Patterns, motifs, insights, references |
| `03-Daily/` | Session summaries and daily logs |

### Key Projects (in `01-Projects/`)

| Project | Path | Status |
|---------|------|--------|
| Observer Council | `observer-council/` | Active — architecture, constitution, experiments |
| Control Plane | `control-plane/observer-system/` | Deployed at localhost:9000 via systemd |
| OIL | Referenced at `/home/adam/vault/workspaces/observer/oil/` | Tier-1 stable, 3 exits approved |
| Observer Commons | `observer-commons/` | Protocol spec v0.1.0 |
| Governance Plugin | `governance-plugin/` | Wired to control plane |
| System Integration | `system-integration/` | Phase 1-3 complete, 38/38 ISC |

## MCP Tools Available

The observer-control-plane MCP bridge provides 12 tools:
- `observer_health` — control plane status
- `observer_vault_query` — search vault documents by metadata
- `observer_vault_status` — vault overview
- `observer_sessions` / `observer_threads` — session management
- `observer_audit` — audit log queries
- Plus additional session and thread management tools

## Commands

```bash
# Control plane
sudo systemctl status observer-control-plane
curl -s http://localhost:9000/health | python3 -m json.tool

# Vault query via JSON-RPC
curl -s -X POST http://localhost:9000/rpc -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"vault.query","params":{"status":"draft"},"id":1}'

# Git (OIL secret gate active on pre-commit)
git status --short
git add -p  # interactive staging preferred
```

## Safety Reminders

- **~/.claude is a symlink to ~/.claude-v3** — NEVER delete .claude-v3
- **Safety hook v1.2** is active — all destructive ops (rm -rf, rm -r) prompt for approval
- **OIL secret gate** validates pre-commit — no API keys, tokens, or secrets in commits
- **Vault documents**: create in `00-Inbox/` (auto-approved), mark DRAFT, propose promotion with rationale. Never promote to canonical without Adam's approval.

## Vault Workflow

1. **Create** → `00-Inbox/` with DRAFT status
2. **Review** → Adam approves or requests changes
3. **Promote** → Move to appropriate canonical location
4. **Tag** → Apply metadata tags per schema

## Key File Locations

| Item | Location |
|------|----------|
| Primary Vault | `/mnt/zfs-host/backup/projects/observer-vault/` |
| PAI v3.0 | `/home/adam/.claude/` (symlink to `.claude-v3`) |
| OIL | `/home/adam/vault/workspaces/observer/oil/` |
| Control Plane deployed | `/opt/observer-system/` |
| MCP Bridge | `/opt/observer-system/scripts/mcp-bridge.mjs` |
| Safety hook patterns | `~/.claude/skills/PAI/USER/PAISECURITYSYSTEM/patterns.yaml` v1.2 |
| Config backups | `~/.config-backups/20260302/` |

---

## Atlas-Managed State

<!-- 
  SELF-UPDATE RULES:
  Atlas MAY update everything below this line at session end or when significant changes occur.
  Atlas MUST NOT modify anything above this line without Adam's explicit approval.
  Updates should be factual (new files, paths, counts, status) not governance changes.
  If a governance/safety/boundary change is needed, propose it to Adam — don't just write it.
-->

### Last Updated
- **Session:** 2 March 2026
- **Control plane:** active, localhost:9000
- **Vault documents:** 137 total, 30 draft
- **MCP tools:** 12 via observer-control-plane bridge

### Project Directories
<!-- Atlas: update this when new project directories are created or moved -->
```
01-Projects/
├── control-plane/observer-system/    # Deployed to /opt/observer-system/
├── governance-plugin/
├── observer-commons/
├── observer-council/
│   ├── architecture/
│   ├── milestones/
│   └── experiments/
├── system-integration/
└── vault/
```

### Recent Changes
<!-- Atlas: append entries here as work happens. Keep last 10 entries. -->
- 2 Mar 2026: System integration phases 1-3 complete (38/38 ISC)
- 2 Mar 2026: MCP bridge created with 12 tools
- 2 Mar 2026: Control plane deployed as systemd service
- 2 Mar 2026: Safety hook v1.2 installed
- 2 Mar 2026: .mcp.json created at vault root for Claude Code MCP discovery
- 2 Mar 2026: CLAUDE.md created at vault root

### New/Moved Files
<!-- Atlas: log new files, directories, or path changes here -->

### Known Issues
<!-- Atlas: track active issues that affect work -->
- Gmail MCP: needs authentication
- Google Calendar MCP: needs authentication  
- Gemini CLI backend: no credentials configured
- Ollama backend: disabled
- `.claude-v25` directory still on disk (safe to delete, archive exists)
