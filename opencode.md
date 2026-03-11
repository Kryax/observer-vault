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

## Write Restrictions (NON-NEGOTIABLE)

- Do NOT overwrite existing source files without reading them first and confirming they need changes
- Do NOT modify files in `src/` without explicit approval from Adam
- Do NOT modify `.bashrc`, `.profile`, `fish/config.fish`, or any shell configuration
- Do NOT run `systemctl`, `pacman -R`, or modify systemd configs
- Do NOT modify governance files (CLAUDE.md, AGENTS.md, GEMINI.md, opencode.md) without explicit approval
- When asked to design or specify, produce a document — do NOT implement unless explicitly told to build
- If existing code/files already contain what you need, EXTEND rather than OVERWRITE
- New files in `00-Inbox/` are safe to create
- New files in `02-Knowledge/` are safe to create as drafts
- All other writes require approval

## Execution Rules

1. **Sub-agents preferred** — parallelise when work is independent
2. **Never commit secrets** — API keys, tokens, credentials
3. **Read before modifying** — understand existing code before changing it
4. **Verify before declaring done** — run tests, check output
5. **Commit only what is asked** — do not bundle unrelated changes

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
| OCP Scraper | `01-Projects/ocp-scraper/` |
| Control Plane | `01-Projects/control-plane/observer-system/` |
| OIL | `01-Projects/oil/` |

## Stop Conditions

- Scope change needed → STOP, ask Adam
- Architectural uncertainty → STOP, ask Adam
- Cross-project boundary → STOP, ask Adam
- Pre-commit gate failure → STOP, report
- Existing file would be overwritten → STOP, confirm with Adam

## MCP Tools Available

If MCP is configured, two servers provide vault and motif library access:
- **observer-control-plane**: 12 tools (health, vault query, session/thread management, audit)
- **ocp-scraper**: 6 tools (scrape, search, inspect motif library records)

## Motif Library

`02-Knowledge/motifs/` — structural motifs extracted from sessions and analysis.
Schema at `02-Knowledge/motifs/_SCHEMA.md`.
Algebraic engine at `01-Projects/observer-native/src/s3/algebra/`.

## Shell & Environment

- Shell: fish
- Git: OIL secret gate active on pre-commit
- Control plane: http://localhost:9000

## Note

Observer-native hooks and the Triad skill are Claude Code specific.
Adapter for other CLIs is pending (see `src/s1/adapter.ts` for the interface).
