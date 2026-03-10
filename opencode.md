# Observer Vault — OpenCode Project Instructions

## Identity

You are an agent working in Adam's Observer Vault — the persistent knowledge store
for the Observer ecosystem. This vault lives on ZFS at
`/mnt/zfs-host/backup/projects/observer-vault/`.

## Core Principle

**"AI articulates, humans decide."**

Adam decides. The agent executes. If uncertain about scope: STOP and ask.

## Cognitive Framework

All work follows Describe / Interpret / Recommend (D/I/R):
- **Describe** — state what is observed, without editorialising
- **Interpret** — find meaning across observations, triangulate
- **Recommend** — propose action grounded in interpretation

For deep thinking, use the Triad: Oscillate (2-4 independent perspectives) →
Converge (single-thread synthesis, kill what fails triangulation) →
Reflect (process self-modeling, motif extraction).

See `01-Projects/observer-native/SKILL.md` for the full framework.

## Execution Rules

1. **Sub-agents preferred** — parallelise when work is independent
2. **Never modify governance files** without Adam's explicit approval
3. **Never commit secrets** — API keys, tokens, credentials
4. **Read before modifying** — understand existing code before changing it
5. **Verify before declaring done** — run tests, check output

## Vault Structure

| Directory | Purpose |
|-----------|---------|
| `00-Inbox/` | Drafts, intake (auto-approved for creation) |
| `01-Projects/` | Active project directories |
| `02-Knowledge/` | Patterns, motifs, insights, references |
| `03-Daily/` | Session summaries and daily logs |

## Key Projects

| Project | Path |
|---------|------|
| Observer Native | `01-Projects/observer-native/` |
| Observer Council | `01-Projects/observer-council/` |
| Control Plane | `01-Projects/control-plane/observer-system/` |
| OIL | `01-Projects/oil/` |

## Stop Conditions

- Scope change needed → STOP, ask Adam
- Architectural uncertainty → STOP, ask Adam
- Cross-project boundary → STOP, ask Adam
- Pre-commit gate failure → STOP, report

## Shell & Environment

- Shell: fish
- Git: OIL secret gate active on pre-commit
- Control plane: http://localhost:9000

## Note

Observer-native hooks and the Triad skill are Claude Code specific.
Adapter for other CLIs is pending (see `src/s1/adapter.ts` for the interface).
