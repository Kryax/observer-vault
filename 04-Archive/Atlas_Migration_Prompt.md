# Atlas Task: Vault Migration

## Instructions

Read the migration brief at `/home/adam/vault/intake/Vault_Migration_Brief.md` for full context.

## Execution Strategy

Use sub-agents for this work. Do NOT read all the documents yourself — you'll destroy your context window.

### Phase 1: Build Migration Manifest
Spawn a sub-agent to:
1. Read every document listed in the migration brief (both source locations)
2. Confirm or adjust the suggested destination for each file
3. Check for duplicates between the two source locations
4. Produce a migration manifest as a markdown table: `| Source Path | Destination Path | Reason |`
5. Save the manifest to `/home/adam/vault/intake/MIGRATION_MANIFEST.md`

Wait for Adam to review and approve the manifest before proceeding.

### Phase 2: Execute Migration (ZFS in-place)
After approval, spawn a sub-agent to:
1. Move files from `docs/`, `intake/`, `receipts/`, and `workspaces/` on the ZFS vault into their new destinations per the approved manifest
2. Keep .meta files alongside their .md counterparts
3. Do NOT touch `00-Inbox/_templates/`, `05-Dashboards/`, or `.obsidian/`
4. Report results back

### Phase 3: Execute Migration (temp vault → ZFS)
Spawn a separate sub-agent to:
1. Copy files from `/home/adam/vault/intake/` to the ZFS vault per the approved manifest
2. Do NOT copy the OIL workspace (`/home/adam/vault/workspaces/observer/oil/`) — it has its own git repo
3. Check `/home/adam/vault/workspaces/observer/constitutional-synthesis-2026-02-10/` — read it, determine appropriate destination, include in migration
4. Report results back

### Phase 4: Cleanup
Spawn a sub-agent to:
1. Verify all files landed in their correct destinations
2. Remove empty old directories from ZFS vault root (`docs/`, `intake/`, `receipts/`, `workspaces/`)
3. Git commit with message: "vault: migrate to numbered folder structure"
4. Report final state

## Key Rules
- Plan first, execute after Adam approves
- Do not modify document content — move/copy only
- Preserve .meta files with their .md counterparts
- Do not copy OIL git repo into vault
- One sub-agent per phase to keep context clean

## File Locations
- Migration brief: `/home/adam/vault/intake/Vault_Migration_Brief.md`
- ZFS vault: `/mnt/zfs-host/backup/projects/observer-vault/`
- Temp vault: `/home/adam/vault/`
