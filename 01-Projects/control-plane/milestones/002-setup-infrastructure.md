---
meta_version: 1
kind: milestone
status: complete
authority: high
domain: [control-plane]
source: atlas_write
confidence: confirmed
created: 2026-02-28
modified: 2026-02-28
cssclasses: [status-complete]
motifs: [observer-control-plane, setup, infrastructure, systemd, secrets]
refs:
  - 01-Projects/control-plane/architecture/setup-infrastructure-prd.md
  - 01-Projects/control-plane/milestones/001-control-plane-build.md
---

# Milestone 002: Setup Infrastructure

**Status:** COMPLETE
**Date:** 2026-02-28
**PRD:** `architecture/setup-infrastructure-prd.md`
**Builds on:** Milestone 001 (Phase 1 control plane build)

## Summary

Everything a user needs to go from `git clone` to a running Observer control plane service. Interactive setup, documented configs, systemd integration, secrets bootstrap, and clean removal.

## Deliverables

| Slice | File | Description | Status |
|-------|------|-------------|--------|
| S0 | `control-plane.example.yaml` | Documented example config with sensible defaults | COMPLETE |
| S1 | `execution-backends.example.yaml` | Backend config (Claude Code, Gemini CLI, Ollama) | COMPLETE |
| S2 | `observer-control-plane.service` | systemd unit with security hardening | COMPLETE |
| S3 | `scripts/provision-secrets.sh` | age-encrypted secrets to tmpfs at startup | COMPLETE |
| S4 | `.githooks/pre-commit` | Credential pattern scanner (8 patterns) | COMPLETE |
| S5 | `scripts/uninstall.sh` | Clean removal with confirmation prompts | COMPLETE |
| S6 | `setup.sh` | Interactive first-run script (11 steps) | COMPLETE |
| S7 | `INSTALL.md` | Step-by-step guide with troubleshooting | COMPLETE |

## ISC Verification

**48 criteria verified, 48 passing (100%)**

### S0: Example Config (5/5)
- [x] ISC-S0-1: Example YAML parses without error
- [x] ISC-S0-2: Every field has inline comment
- [x] ISC-S0-3: Default values match PRD specifications
- [x] ISC-S0-4: policies.default_action is "deny"
- [x] ISC-S0-A1: No real credentials in example

### S1: Backends Config (5/5)
- [x] ISC-S1-1: YAML parses without error
- [x] ISC-S1-2: Three backend examples with comments
- [x] ISC-S1-3: Each backend has command, args_template, enabled, timeout
- [x] ISC-S1-4: Sensitivity tiers demonstrate routing
- [x] ISC-S1-A1: No real API keys or user-specific paths

### S2: systemd Unit (7/7)
- [x] ISC-S2-1: Passes systemd-analyze verify
- [x] ISC-S2-2: ExecStartPre runs provision-secrets.sh
- [x] ISC-S2-3: Restart=on-failure with RestartSec
- [x] ISC-S2-4: Journal logging configured
- [x] ISC-S2-5: NoNewPrivileges + ProtectSystem hardening
- [x] ISC-S2-6: ReadWritePaths limited to data + tmpfs
- [x] ISC-S2-A1: No 0.0.0.0 binding

### S3: Secrets Bootstrap (5/5)
- [x] ISC-S3-1: Exits non-zero if age missing
- [x] ISC-S3-2: Secrets land on tmpfs only
- [x] ISC-S3-3: Permissions set to 0600
- [x] ISC-S3-4: Validates expected files before exit
- [x] ISC-S3-A1: Never logs secret values

### S4: Pre-commit Hook (5/5)
- [x] ISC-S4-1: Detects 8 credential patterns (≥5 required)
- [x] ISC-S4-2: Catches shell:true in TypeScript files
- [x] ISC-S4-3: No false positives on clean files
- [x] ISC-S4-4: Executable with correct permissions
- [x] ISC-S4-A1: TESTFAKE patterns bypass detection

### S5: Uninstall (4/4)
- [x] ISC-S5-1: Stops service before removing files
- [x] ISC-S5-2: Data removal requires confirmation
- [x] ISC-S5-3: Idempotent (safe to run twice)
- [x] ISC-S5-A1: Never removes source code or git repo

### S6: Setup Script (8/8)
- [x] ISC-S6-1: Exits early on missing prerequisites
- [x] ISC-S6-2: Idempotent re-run safe
- [x] ISC-S6-3: Never overwrites existing configs
- [x] ISC-S6-4: Smoke test validates health endpoint
- [x] ISC-S6-5: Prints summary with paths
- [x] ISC-S6-6: Clear success/failure messages per step
- [x] ISC-S6-A1: No secrets in shell history
- [x] ISC-S6-A2: set -euo pipefail never disabled

### S7: Install Guide (6/6)
- [x] ISC-S7-1: Exact version requirements with check commands
- [x] ISC-S7-2: Quick Start ≤ 5 lines
- [x] ISC-S7-3: Every manual step has exact command
- [x] ISC-S7-4: 8 troubleshooting scenarios (≥5 required)
- [x] ISC-S7-5: Self-contained, no external links
- [x] ISC-S7-A1: No distro-specific paths

### Integration (3/3)
- [x] ISC-INT-1: All 8 files at PRD-specified paths
- [x] ISC-INT-2: Governance receipt written
- [x] ISC-INT-3: Committed and pushed

## Security Invariants Enforced

| # | Invariant | How |
|---|-----------|-----|
| 1 | No shell:true in spawn() | Pre-commit hook (S4) |
| 2 | 127.0.0.1 binding | Example config + systemd unit |
| 3 | Default-deny policy | Example config ships with deny |
| 4 | Secrets on tmpfs only | provision-secrets.sh + systemd ReadWritePaths |
| 5 | Credential redaction | Pre-commit hook + audit sanitize_patterns |
| 6 | No secrets in logs | provision-secrets.sh logs only status messages |
| 7 | Security hardening | NoNewPrivileges, ProtectSystem=strict, ProtectHome, PrivateTmp |

## Build Method

- PRD loop mode with parallel agents
- Dependency graph followed: Foundation (S0,S1,S3,S4) → Service (S2,S5) → Integration (S6) → Docs (S7)
- 4-way parallel for foundation, 2-way parallel for service, sequential for integration and docs
- Mechanical ISC verification by independent verification agents

## Next Steps

1. Deploy to Observer Relay VM and run `./setup.sh` for real
2. Test cross-VM dispatch setup when two-VM deployment begins
3. Add Phase 2 bubblewrap integration to setup.sh
4. Consider adding `setup.sh --upgrade` for version upgrades
