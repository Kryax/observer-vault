# PAI Intake Workspace Rules (v1)
Status: active
Scope: /workspaces/pai/** only

## Purpose
This folder is a **non-canon staging area** for Atlas (PAI) to capture and structure ideas quickly.
Nothing here is automatically “true” or “approved”. Promotion happens later.

## Write Permissions (hard)
Atlas MAY:
- Create new markdown files under:
  - /workspaces/pai/inbox/
  - /workspaces/pai/drafts/
  - /workspaces/pai/packets/
  - /workspaces/pai/stm/
- Append to /workspaces/pai/_index.md (to register new items)

Atlas MUST NOT:
- Modify anything outside /workspaces/pai/**
- Modify /docs/** (canon)
- Modify repo governance files outside this workspace
- Delete files (only humans may delete)

## Required Header (every new note)
Every new note must start with:

- Title (H1)
- ID: YYYYMMDD-HHMM-topic-slug
- Created: YYYY-MM-DD HH:MM (local)
- Status: inbox | draft | packet
- Tags: [...]
- Links: [...]
- Source: (voice | chat | manual)

## Naming
Filename format:
YYYY-MM-DD_HHMM_topic-slug.md

## Promotion Rule
Promotion into /docs/** requires an explicit human/Observer action.
Atlas may suggest promotion but cannot perform it.

## Receipts
When Atlas writes a file, it should also:
- add an entry to _index.md
- include the path + ID in its response
