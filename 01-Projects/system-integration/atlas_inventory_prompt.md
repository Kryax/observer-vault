Read the CLAUDE.md in the current directory first.

# System Inventory Sweep

## Objective

Produce a complete architecture map of Adam's Observer ecosystem — every project, repo, tool, config, script, and installation. The output is a single document that shows what exists, where it lives, what state it's in, and how components relate to each other.

This is the foundation for all integration work that follows. Nothing gets wired together until we know exactly what we're working with.

## What to Map

Use sub-agents to parallelise this work and preserve context.

### Sub-Agent 1: Project & Repo Inventory

Find and document every project directory and git repository related to the Observer ecosystem. For each:
- Location (full path)
- Git remote (if any)
- Current branch and last commit date
- Brief description of what it is
- State: built / installed / configured / specified-only / abandoned
- Key files (CLAUDE.md, PROJECT_STATE.md, README, config files)

Check at minimum:
- `/mnt/zfs-host/backup/projects/`
- `/home/adam/` and subdirectories
- `~/.claude/` 
- Any other project directories Adam has used

### Sub-Agent 2: Installed Tools & Services

Document every tool, service, and runtime that's part of the Observer ecosystem:
- PAI / Claude Code — version, config location, installed agents, installed skills
- OIL — installation state, scripts, hooks, what's active vs inactive
- JSON-RPC control plane — built? installed? running? where's the installation script?
- Obsidian — vault location, plugins installed, sync status
- Any systemd services, daemons, or background processes related to the project
- Node.js, Python, and other runtimes relevant to the project

### Sub-Agent 3: Configuration & Integration Map

Document how components currently connect (or don't):
- What MCP servers are configured in Claude Code/Desktop?
- What environment variables are set for the project?
- What hooks or triggers exist between components?
- What's in Claude Code's settings.json?
- What CLAUDE.md files exist and where?
- What governance is automated vs manual?

### Sub-Agent 4: Architecture Synthesis

After Sub-Agents 1-3 complete, synthesise into:
1. **Component registry** — table of every component with location, state, and dependencies
2. **Integration map** — what talks to what currently (and what should but doesn't)
3. **Gap analysis** — what's built but not installed, what's installed but not connected, what's specified but not built
4. **Dependency graph** — what depends on what, in what order would things need to be set up
5. **Recommended integration sequence** — given the current state, what's the most efficient path to a fully wired system

## Output

Save all outputs to: `/mnt/zfs-host/backup/projects/observer-vault/00-Inbox/system-inventory/`

Files:
- `System_Inventory_Complete.md` — the full architecture map (synthesis from Sub-Agent 4)
- `Raw_Project_Inventory.md` — detailed findings from Sub-Agent 1
- `Raw_Tools_Services.md` — detailed findings from Sub-Agent 2  
- `Raw_Config_Integration.md` — detailed findings from Sub-Agent 3

## Governance

This is discovery only. Do not modify, install, configure, or connect anything. Document what exists. Report what's missing. Recommend what to do next. Adam decides.

Go.
