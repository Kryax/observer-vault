# System Integration — Observer Ecosystem Wiring

## Project Location
- Project directory: `/mnt/zfs-host/backup/projects/observer-vault/01-Projects/system-integration/`
- Input document: `System_Inventory_Complete.md` (from inventory sweep)
- Supporting documents: `Raw_Project_Inventory.md`, `Raw_Tools_Services.md`, `Raw_Config_Integration.md`

## Purpose
Wire the Observer ecosystem components together into a functioning, governed, integrated system. Close the gaps identified in the system inventory. Deploy the control plane. Connect OIL governance. Make the Vault queryable through the JSON-RPC boundary.

This is execution work, not research. Build, deploy, configure, test, verify.

## Workflow

### 1. PRD First
Before any execution, create a PRD from the inventory's four-phase integration sequence. The PRD must have explicit ISC (Integration, Security, Completion) criteria for every slice. Use fan-out loop mode for parallelisable slices.

### 2. Subagent Strategy
- Use subagents for parallel build slices where dependencies allow
- One slice per subagent for focused execution
- Each subagent verifies its own ISC criteria before reporting complete

### 3. Verification Before Done
- Every slice must have proof of work — tests passing, services running, configs validated
- Run OIL governance checks on all changes
- Security-related changes (secrets, hooks, credentials) get extra scrutiny
- Ask yourself: "Would Adam approve this?"

### 4. OIL Integration (META-GOAL)
This project has a meta-goal: by the end, OIL governance should be automatically enforced on future work. That means:
- Pre-commit hooks wired and active
- Secret scanning operational
- Event bridge capturing all relevant events
- Governance boundaries machine-enforced, not prompt-enforced

## Phase Scope

### Phase 1: Quick Wins
- Set notification env vars (NTFY_TOPIC, DISCORD_WEBHOOK)
- Wire OIL secret gate as git pre-commit hook
- Fix or remove dead PAI_CONFIG_DIR reference
- Archive pai-brain and legacy PAI installations
- Remove stale worktrees and orphaned directories
- Secure ElevenLabs API key (move from plaintext ~/.profile)
- Fix git credential helper (move from plaintext store)

### Phase 2: Control Plane Deployment
- Run setup.sh to create /opt/observer-system/ structure
- Provision age-encrypted secrets
- Create control-plane.yaml and execution-backends.yaml from examples
- Install and start systemd service
- Run smoke tests against live service (all 9 checks must pass)
- Test Claude Code as first backend (end-to-end verification)
- Expose control plane as local MCP server for Claude Code/Desktop

### Phase 3: Vault Integration & Multi-Engine
- Wire Obsidian governance plugin to JSON-RPC boundary
- Make Vault queryable through the control plane (project state, document status, pending reviews)
- Configure Gemini CLI as second backend (if API access available)
- Configure Ollama as local/offline backend
- Move Observer Commons to its own project directory
- Install OIL pre-commit hooks across all ecosystem repos
- Set up Twilio for mobile notifications (if account available)

### Phase 4: Advanced (OUT OF SCOPE for this PRD)
Phase 4 items (Telegram bot, cross-VM, bubblewrap, WebSocket, Observer Commons executable, Observer Council framework) are documented but not included in this project's PRD. They are future work.

## Governance Boundaries (NON-NEGOTIABLE)

1. **Security changes require extra care.** Moving secrets, changing credential stores, modifying hooks — double-check everything. If unsure, STOP and ask Adam.
2. **Do not break existing functionality.** PAI, OIL, and the governance plugin are operational. Integration must preserve current capabilities.
3. **Test before declaring done.** Every phase must have proof — services running, hooks triggering, tests passing.
4. **If OIL governance is wired, use it.** Once pre-commit hooks are active, all subsequent work must pass through them.
5. **Backup before modifying.** Before changing ~/.profile, settings.json, or any config that affects the running system, create a dated backup.
6. **When in doubt: STOP and ask Adam.**

## Key File Locations (from inventory)

| Component | Location |
|-----------|----------|
| PAI v3.0 | `/home/adam/.claude/` |
| PAI settings | `/home/adam/.claude/settings.json` (938 lines, 24.8KB — handle with care) |
| OIL | `/home/adam/vault/workspaces/observer/oil/` |
| Control Plane code | `01-Projects/control-plane/observer-system/` |
| Control Plane setup | `01-Projects/control-plane/observer-system/packages/setup/` |
| Governance Plugin | `01-Projects/governance-plugin/` |
| Observer Commons specs | `01-Projects/governance-plugin/observer-commons/` (to be moved) |
| Vault (primary) | `/mnt/zfs-host/backup/projects/observer-vault/` |
| Vault (local) | `/home/adam/vault/` |
| OIL event bridge | `/home/adam/.claude/hooks/oil-event-bridge.ts` |
| OIL secret gate scripts | `/home/adam/vault/workspaces/observer/oil/scripts/` |

## Core Principles
- **Human Sovereignty**: Adam decides. Atlas executes within boundaries.
- **Verify Everything**: Tests, smoke checks, proof of work. No "trust me, it's done."
- **Australian English**: Use Australian spelling in all outputs.
- **Backup First**: Before modifying configs, backup. Before moving files, backup.
