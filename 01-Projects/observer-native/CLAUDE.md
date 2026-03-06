# Observer-Native — Workspace Governance

## What This Project Is

Observer-native is the CLI-agnostic cognitive infrastructure layer that replaces PAI as the
execution backbone for the Observer project. It is NOT a PAI fork. It is built from scratch,
informed by PAI's patterns, owned entirely by the Observer project.

Runs first on Claude Code. Designed from day one to be hot-swappable to any CLI tool via a
hook adapter interface.

## Working Directory

All work for this project lives at:
`/mnt/zfs-host/backup/projects/observer-vault/01-Projects/observer-native/`

This is the canonical location. The old `/home/adam/vault/workspaces/observer/observer-native/`
directory is DEPRECATED — do not use it.

## Session Start

1. Read `.prd/` — understand what has been specified and what has been built
2. Read `PROJECT_STATE.md` if it exists — understand current build state
3. Check `receipts/` for completed work
4. Never assume prior state — verify it

## Core Governance Principles

### Human Sovereignty
Adam decides. Atlas executes. If uncertain: STOP and ask.
"AI articulates, humans decide" is not a guideline — it is a hard stop.

### Sub-Agents Are the Default
If work can be parallelised, it MUST use sub-agents.
Sequential execution of parallelisable work is a policy violation.
The only valid reasons to NOT use sub-agents:
1. Task is strictly sequential (output of N required as input for N+1)
2. Task requires a single coherent reasoning thread (creative synthesis)
3. Context constraints make fan-out impractical (state this explicitly)

### PRD Is the Authority
The PRD in `.prd/` is the specification. Build what it says.
Do not add scope. Do not remove scope. If scope needs to change: STOP, create an exit artifact,
wait for Adam's approval.

### ISC Exit Criteria Are Non-Negotiable
A slice is not complete until its ISC criteria pass.
Do not mark work done without verification.
Do not bypass proof gates.

### Receipts for Everything
If it happened, there is a receipt in `receipts/`.
Receipts are the audit trail. They are not optional.

### PAI Safety
Do NOT modify any files under:
  ~/.claude/               (PAI — must remain untouched)
  ~/.claude/skills/        (PAI skills — copy FROM, never write TO)
  ~/.claude/settings.json  (hook registration — NOT until Adam explicitly approves)

PAI continues running in parallel. Observer-native and PAI coexist.
There is no cutover until Adam decides.

## Stop Conditions (Always Apply)

- PRD scope change needed → STOP, exit artifact, wait for approval
- ISC criteria failing after retry budget exhausted → STOP, escalate to Adam
- Merge conflict between sub-agent outputs → STOP, report to Adam
- Uncertainty about architectural intent → STOP and ask
- Any change to the hook adapter interface → STOP, this requires Adam's explicit approval
- Any temptation to write to ~/.claude/ → STOP, this requires Adam's explicit approval

## Key Reference Files (Outside This Workspace)

These are read-only references. Do not modify them.

```
# Prior architecture decisions:
/mnt/zfs-host/backup/projects/observer-vault/01-Projects/oil/exits/2026-02-24_exit-011_pai-decoupling-decision.md

# Cognitive framework and design principles:
/mnt/zfs-host/backup/projects/observer-vault/02-Knowledge/architecture/Theory_To_Architecture_20260305.md

# Council redesign TDS:
/mnt/zfs-host/backup/projects/observer-vault/01-Projects/observer-council/Council_Redesign_TDS_20260305.md

# Reflect Operation 8 proposal:
/mnt/zfs-host/backup/projects/observer-vault/01-Projects/observer-council/Reflect_Operation8_Proposal_20260305.md

# Control plane state (built, do not re-specify):
/mnt/zfs-host/backup/projects/observer-vault/01-Projects/control-plane/PROJECT_STATE.md

# PAI architecture (reference only):
/home/adam/.claude-v3/skills/PAI/PAISYSTEMARCHITECTURE.md
/home/adam/.claude-v3/skills/PAI/PAIAGENTSYSTEM.md
```

## Build Location

Source code lives here:
`/mnt/zfs-host/backup/projects/observer-vault/01-Projects/observer-native/src/`

The control plane lives separately at:
`/mnt/zfs-host/backup/projects/observer-vault/01-Projects/control-plane/observer-system/`
Do not modify it from this workspace.
