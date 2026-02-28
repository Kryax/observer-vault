# Plan: Setup Infrastructure PRD

**Context:** Control plane is built and merged (8 slices, 427 tests, 16,754 lines). No path from `git clone` to running service exists. This PRD specifies it.

**Action:** Write one file — `architecture/setup-infrastructure-prd.md` — containing the PRD below. No code.

**Sources:** Sub-agents read CLAUDE.md, control-plane-prd.md, decisions/001, config-loader.ts, and schemas.ts to align config fields and architectural decisions.

---

## The PRD (will be saved to `architecture/setup-infrastructure-prd.md`):

---
meta_version: 1
kind: plan
status: draft
authority: low
domain: [control-plane]
source: atlas_write
confidence: provisional
mode: build
created: 2026-02-28
modified: 2026-02-28
cssclasses: [status-draft]
motifs: [observer-control-plane, setup, systemd, infrastructure]
refs:
  - 01-Projects/control-plane/architecture/control-plane-prd.md
  - 01-Projects/control-plane/decisions/001-tds-v2-open-questions.md
  - 01-Projects/control-plane/milestones/001-control-plane-build.md
---

# PRD: Observer Control Plane — Setup Infrastructure

**Purpose:** Everything a user needs to go from `git clone` to a running Observer control plane service. Interactive setup, documented configs, systemd integration, secrets bootstrap, and clean removal.

**Principle:** Reproducible by any competent sysadmin. Standard Node.js systemd patterns. No magic.

---

## 1. Scope

### 1.1 What This Covers

1. **Interactive first-run script** — checks prerequisites, creates configs, bootstraps secrets, installs systemd unit, runs smoke test.
2. **Documented example configs** — sensible defaults for control plane and execution backends.
3. **systemd service unit** — ExecStartPre secrets decryption, localhost binding, journal logging, restart on failure.
4. **Secrets lifecycle** — age-encrypted at rest, decrypted to tmpfs at startup, cleaned on stop.
5. **Clean removal** — uninstall script that reverses setup.sh.
6. **Step-by-step guide** — INSTALL.md for humans who prefer reading before running.
7. **Credential scanner** — pre-commit hook that catches secrets before they reach git.

### 1.2 What This Does NOT Cover

- Application code changes (control plane is built and tested).
- Two-VM deployment (single-host only per Q3).
- Bubblewrap sandboxing (Phase 2).
- TLS/mTLS (localhost only).
- Monitoring/alerting (health endpoint exists in the app).

### 1.3 Design Constraints

| Constraint | Enforcement | Reference |
|------------|-------------|-----------|
| Node.js 22 LTS only | setup.sh checks `node --version` | Q1 |
| npm workspaces | setup.sh runs `npm ci` from monorepo root | Q1 |
| 127.0.0.1 binding | systemd unit + config example | Build invariant |
| age for secrets | provision-secrets.sh | Q6 |
| Restart-to-reload | systemd unit has no ReloadExec | Q1 |
| Default-deny policy | example config ships with deny default | Build invariant |
| Single-host canonical | no cross-VM config in examples | Q3 |

---

## 2. Technology

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 22 LTS | Runtime |
| npm | 10+ | Package manager + workspaces |
| age | 1.x | Secret encryption |
| systemd | 250+ | Service management |
| bash | 5+ | Setup and operational scripts |
| git | 2.40+ | Pre-commit hooks |

---

## 3. Deliverable Slices

### S0: `control-plane.example.yaml`

Documented example configuration with sensible defaults. Users copy to `control-plane.yaml` and edit.

**Sections:**
- `server:` — host: 127.0.0.1, http_port: 9000, max_request_size_bytes: 1048576, shutdown_timeout_seconds: 30, log_level: info
- `sessions:` — idle_timeout_hours: 24, max_concurrent: 10, max_threads_per_session: 5
- `auth:` — token_dir: ./secrets/tokens
- `rate_limits:` — requests_per_minute: 60, turns_per_hour: 120
- `approvals:` — tiers with timeout_seconds, approval_channels
- `policies:` — default_action: deny, example rules demonstrating each condition type (method_match, client_type_match, intent_contains, rate_check, and/or/not)
- `dispatch:` — working_directory: ./workdir, allowed_base_dirs
- `health:` — backend_check_interval_seconds: 30, audit_check_interval_seconds: 60
- `audit:` — jsonl_dir: ./data/audit, jsonl_max_size_mb: 100, index_database_path: ./data/audit/index.db, sanitize_patterns

Every field has an inline YAML comment explaining purpose and valid values.

**ISC Exit Criteria:**
- ISC-S0-1: Example YAML parses without error via config-loader validation
- ISC-S0-2: Every field has an inline comment explaining its purpose
- ISC-S0-3: Default values match control-plane-prd.md Section 7 specifications
- ISC-S0-4: policies.default_action is "deny" in the example config
- ISC-S0-A1: No real credentials or tokens appear in example file

### S1: `execution-backends.example.yaml`

Backend configuration with common examples (Claude Code, Gemini CLI, Ollama).

**Sections:**
- `routing_mode:` — "specify" (Phase 1 only)
- `default_backend:` — "claude-code"
- `dispatch:` — default_timeout_seconds: 300, max_retries: 1, retry_delay_seconds: 5, output_max_bytes: 10485760, health_check_timeout_seconds: 10
- `backends:` — 3 example entries (claude-code, gemini-cli, ollama) with command, args_template, enabled, timeout_seconds, health_check
- `sensitivity:` — public/internal/confidential with allowed_backends

**ISC Exit Criteria:**
- ISC-S1-1: Example YAML parses without error
- ISC-S1-2: At least three backend examples included with inline comments
- ISC-S1-3: Each backend specifies command, args_template, enabled, timeout_seconds
- ISC-S1-4: Sensitivity tiers demonstrate the routing concept
- ISC-S1-A1: No real API keys or paths to user-specific binaries

### S2: `observer-control-plane.service`

systemd unit file for the control plane service.

**Specification:**
```ini
[Unit]
Description=Observer Control Plane
After=network.target

[Service]
Type=simple
User=observer
Group=observer
WorkingDirectory=/opt/observer-system
ExecStartPre=/opt/observer-system/scripts/provision-secrets.sh
ExecStart=/usr/bin/node packages/control-plane/src/server/server.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=observer-cp

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/observer-system/data /run/observer-secrets
PrivateTmp=true

# Environment
Environment=NODE_ENV=production
Environment=OBSERVER_CONFIG=/opt/observer-system/control-plane.yaml
Environment=OBSERVER_BACKENDS=/opt/observer-system/execution-backends.yaml
Environment=OBSERVER_SECRETS_DIR=/run/observer-secrets

[Install]
WantedBy=multi-user.target
```

**ISC Exit Criteria:**
- ISC-S2-1: Unit file passes `systemd-analyze verify`
- ISC-S2-2: ExecStartPre runs provision-secrets.sh before server start
- ISC-S2-3: Restart=on-failure with RestartSec present
- ISC-S2-4: Journal logging via StandardOutput and StandardError
- ISC-S2-5: NoNewPrivileges and ProtectSystem hardening directives present
- ISC-S2-6: ReadWritePaths limited to data dir and secrets tmpfs only
- ISC-S2-A1: Unit does not bind to 0.0.0.0 or expose any external port

### S3: `scripts/provision-secrets.sh`

Decrypts age-encrypted secrets to tmpfs at service startup.

**Behavior:**
1. Check age binary exists
2. Check encrypted secrets directory exists (`secrets/*.age`)
3. Create tmpfs mount at `/run/observer-secrets` if not exists
4. Decrypt each `.age` file to tmpfs using age identity
5. Set permissions 0600, owner observer:observer
6. Validate expected files are present (bearer tokens)
7. Exit 0 on success, non-zero on any failure (blocks service start via ExecStartPre)

**ISC Exit Criteria:**
- ISC-S3-1: Script exits non-zero if age binary is missing
- ISC-S3-2: Decrypted secrets land on tmpfs not persistent disk
- ISC-S3-3: File permissions set to 0600 after decryption
- ISC-S3-4: Script validates expected secret files exist before exiting zero
- ISC-S3-A1: Script never logs secret values to stdout or stderr

### S4: `.githooks/pre-commit`

Credential pattern scanner that runs before every commit.

**Behavior:**
1. Scan staged files for credential patterns (API keys, tokens, passwords, private keys)
2. Check for `shell: true` in TypeScript/JavaScript files
3. Check for hardcoded IP addresses other than 127.0.0.1
4. Exit 0 if clean, exit 1 with violation details if not

**Patterns:** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, key prefixes (`sk-`, `gsk_`, `AIza`), `-----BEGIN .* PRIVATE KEY-----`, `password\s*[:=]\s*["'][^"']+["']`, `shell:\s*true`

**ISC Exit Criteria:**
- ISC-S4-1: Hook detects at least five common credential patterns
- ISC-S4-2: Hook catches shell:true in staged TypeScript files
- ISC-S4-3: Hook passes on clean files with no false positives on TESTFAKE fixtures
- ISC-S4-4: Hook is executable and runs under git's hook mechanism
- ISC-S4-A1: Hook does not block commits containing TESTFAKE credential patterns

### S5: `scripts/uninstall.sh`

Clean removal script that reverses setup.sh.

**Behavior:**
1. Stop and disable systemd service
2. Remove systemd unit file, daemon-reload
3. Remove tmpfs secrets mount
4. Optionally remove data directory (with confirmation prompt)
5. Optionally remove service user (with confirmation prompt)
6. Remove git hooks
7. Print summary of what was removed

**ISC Exit Criteria:**
- ISC-S5-1: Script stops running service before removing files
- ISC-S5-2: Data directory removal requires explicit user confirmation
- ISC-S5-3: Script is idempotent — safe to run if partially uninstalled
- ISC-S5-A1: Script never removes the source code or git repository

### S6: `setup.sh`

Interactive first-run script. The primary entry point for new users.

**Steps (in order):**
1. **Check prerequisites** — node (22+), npm (10+), age, systemd, git
2. **Create service user** — `observer` user/group if not exists (optional, with prompt)
3. **Install dependencies** — `npm ci` from monorepo root
4. **Generate configs** — copy example YAMLs to active configs if not present
5. **Bootstrap secrets** — generate age keypair if none exists, create encrypted token files
6. **Create data directories** — audit JSONL dir, SQLite path, working directory
7. **Install systemd unit** — copy service file, daemon-reload, enable
8. **Install git hooks** — copy pre-commit hook, make executable
9. **Validate config** — dry-run config parse to verify YAML loads
10. **Run smoke test** — start service, hit health endpoint, stop service
11. **Print summary** — show service status, config paths, next steps

**ISC Exit Criteria:**
- ISC-S6-1: Script exits early with clear message if any prerequisite is missing
- ISC-S6-2: Script is idempotent — re-run safe without destroying existing config
- ISC-S6-3: Config generation never overwrites existing user-edited config files
- ISC-S6-4: Smoke test validates service starts and health endpoint responds
- ISC-S6-5: Script prints summary with all relevant paths and next steps
- ISC-S6-6: Every step has a clear success or failure message
- ISC-S6-A1: Script never stores passwords or tokens in shell history
- ISC-S6-A2: Script never runs with set -e disabled in critical sections

### S7: `INSTALL.md`

Step-by-step guide for humans who prefer reading before running.

**Sections:**
1. **Prerequisites** — Node.js 22 LTS, npm 10+, age, systemd, Linux
2. **Quick Start** — `git clone && ./setup.sh` (3 lines)
3. **Manual Setup** — each step from setup.sh with exact commands
4. **Configuration Reference** — key fields from example YAMLs explained
5. **Secrets Management** — age keypair generation, encrypting tokens, tmpfs lifecycle
6. **Service Management** — start, stop, status, logs, restart commands
7. **Verification** — health check, audit trail check, smoke test
8. **Troubleshooting** — common errors and fixes (port in use, permissions, missing deps)
9. **Uninstall** — reference to uninstall.sh

**ISC Exit Criteria:**
- ISC-S7-1: Prerequisites section lists exact version requirements with check commands
- ISC-S7-2: Quick Start section is five lines or fewer
- ISC-S7-3: Every manual step includes the exact command to run
- ISC-S7-4: Troubleshooting covers at least five common failure scenarios
- ISC-S7-5: Document is self-contained with no required external links
- ISC-S7-A1: No distro-specific paths that break on different Linux distributions

---

## 4. Slice Dependency Graph

```
S0 (example config) ──────┐
S1 (example backends) ─────┼── S2 (systemd unit) ──┐
S3 (provision-secrets) ────┤                        ├── S6 (setup.sh) ── S7 (INSTALL.md)
S4 (pre-commit hook) ──────┘                        │
                           S5 (uninstall) ──────────┘
```

| Group | Slices | Can Build After |
|-------|--------|-----------------|
| Foundation | S0, S1, S3, S4 | Nothing (independent) |
| Service | S2 | S0 + S1 (references config paths) |
| Removal | S5 | S2 (reverses its setup) |
| Integration | S6 | S0 + S1 + S2 + S3 (orchestrates all) |
| Documentation | S7 | All slices (documents everything) |

**Critical path:** S0 → S2 → S6 → S7
**Parallelization:** S0, S1, S3, S4 are fully independent. S2 and S5 can build in parallel once foundation completes.

---

## 5. File Locations

All deliverables within the existing monorepo:

```
observer-system/
  control-plane.example.yaml      # S0
  execution-backends.example.yaml  # S1
  observer-control-plane.service   # S2
  scripts/
    provision-secrets.sh           # S3
    uninstall.sh                   # S5
  setup.sh                         # S6
  INSTALL.md                       # S7
  .githooks/
    pre-commit                     # S4
```

---

## 6. Security Invariants

| # | Invariant | Enforced By |
|---|-----------|-------------|
| 1 | sanitizedEnv() for child processes | Application code (not setup) |
| 2 | No shell:true in spawn() | Pre-commit hook (S4) |
| 3 | 127.0.0.1 binding | Example config default + systemd unit |
| 4 | Audit writes block requests | Example config enables by default |
| 5 | Default-deny policy | Example config ships with deny default |
| 6 | Approval timeout = denied | Example config timeout values |
| 7 | Credential redaction | Pre-commit hook (S4) + audit sanitize_patterns |
| 8 | Secrets on tmpfs only | provision-secrets.sh (S3) + systemd ReadWritePaths |
