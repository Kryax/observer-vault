---
meta_version: 1
kind: inventory
status: draft
authority: low
domain: [system-inventory]
source: atlas_write
confidence: confirmed
created: 2026-03-02T12:30:00+11:00
---

# Raw Tools, Services & Runtimes Inventory

**Generated:** 2026-03-02
**Sub-Agent:** 2 (Tools & Services)
**Method:** Read-only discovery commands — no state changes made

---

## 1. PAI / Claude Code

### Claude Code (CLI)

| Property | Value |
|----------|-------|
| Version | 2.1.63 |
| Package | `@anthropic-ai/claude-code@2.1.63` |
| Install method | npm global (`/home/adam/.npm-global/lib`) |
| Binary | `claude` (PID 27518 observed running) |
| Config root | `/home/adam/.claude/` |

### PAI System

| Property | Value |
|----------|-------|
| PAI Version | 3.0 |
| Algorithm Version | 1.4.0 |
| Model switch strategy | symlink |
| Install date | 2026-02-20 |
| Note from `.ACTIVE_VERSION` | "Fresh v3.0 install with settings merged from v2.5" |
| PAI Installer | `/home/adam/.claude/PAI-Install/` (contains `install.sh`, `main.ts`, CLI/electron/web/engine dirs) |
| DA Identity | Atlas (name), Atlas - Personal AI (fullName) |
| DA Voice | ElevenLabs voice ID `aEO01A4wXwd1O8GPgGlF` |
| Principal | Adam (timezone: Australia/Sydney) |

### Settings Overview (`/home/adam/.claude/settings.json`)

- **Size:** 24,834 bytes (substantial — this is the single source of truth for PAI)
- **Environment variables:**
  - `PAI_DIR=/home/adam/.claude`
  - `PROJECTS_DIR=/home/adam`
  - `CLAUDE_CODE_MAX_OUTPUT_TOKENS=80000`
  - `BASH_DEFAULT_TIMEOUT_MS=600000`
  - `PAI_CONFIG_DIR=${PAI_DIR}/../.config/PAI` (note: this directory does NOT exist on disk)
  - `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`
- **Permissions:** Broad allow list (Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch, Task, Skill, mcp__*); destructive commands on ask-list
- **Notifications:** ntfy (enabled), Discord (enabled), Twilio (enabled) — all via environment variable references
- **Status line:** Custom command script (`statusline-command.sh`, 70KB)
- **Teammate mode:** `in-process`
- **Plans directory:** `~/.claude/Plans/`
- **Context files loaded at startup:** `skills/PAI/SKILL.md`, `AISTEERINGRULES.md`, `USER/AISTEERINGRULES.md`, `USER/DAIDENTITY.md`
- **Max tokens:** 16,000
- **Autocompact threshold:** 83% (16.5% buffer)

### Installed Skills (37 total, at `/home/adam/.claude/skills/`)

| Skill | SKILL.md Size | Notes |
|-------|---------------|-------|
| Agents | 9,762 B | Agent management |
| AnnualReports | 4,387 B | Annual report analysis |
| Aphorisms | 13,053 B | Wisdom extraction |
| Apify | 13,196 B | Web scraping platform |
| Art | 7,374 B | Art generation |
| BeCreative | 4,613 B | Creative tasks |
| BrightData | 6,590 B | Web data platform |
| Browser | 8,244 B | Browser automation |
| Cloudflare | 3,433 B | Cloudflare integration |
| CORE | (no SKILL.md) | Contains ACTIONS/ and PIPELINES/ subdirs |
| Council | 3,801 B | Multi-agent deliberation |
| CreateCLI | 10,330 B | CLI tool creation |
| CreateSkill | 8,063 B | Skill creation |
| Documents | 12,917 B | Document processing |
| Evals | 7,400 B | Evaluation framework |
| ExtractWisdom | 13,744 B | Fabric-style wisdom extraction |
| Fabric | 6,001 B | Fabric patterns |
| FirstPrinciples | 9,042 B | First principles reasoning |
| IterativeDepth | 1,942 B | Iterative depth analysis |
| OSINT | 4,528 B | Open source intelligence |
| PAI | 86,057 B | **Core PAI system** (largest skill) |
| PAIUpgrade | 19,535 B | PAI upgrade procedures |
| Parser | 3,947 B | Text parsing |
| PrivateInvestigator | 7,905 B | Investigation skill |
| Prompting | 6,184 B | Prompt engineering |
| PromptInjection | 8,466 B | Prompt injection testing |
| Recon | 15,164 B | Reconnaissance |
| RedTeam | 3,369 B | Red team operations |
| Remotion | 2,153 B | Video creation |
| Research | 6,485 B | Research methodology |
| Sales | 4,600 B | Sales assistance |
| Science | 5,407 B | Scientific analysis |
| SECUpdates | 7,957 B | SEC filings monitoring |
| Telos | 12,287 B | Purpose/goal analysis |
| USMetrics | 5,594 B | US economic metrics |
| WebAssessment | 7,230 B | Web security assessment |
| WorldThreatModelHarness | 3,667 B | Threat modelling |
| WriteStory | 4,866 B | Story writing |

**CORE Skill** (special structure, no SKILL.md):
- `ACTIONS/` — Contains `action-index.json`, `pai.ts`, plus subdirs: blog, extract, format, lib, parse, social, transform
- `PIPELINES/` — Contains 5 pipeline definitions: blog-draft, blog-publish, research, social-broadcast, youtube-knowledge (all YAML)

### Installed Agents (14 total, at `/home/adam/.claude/agents/`)

| Agent | Size | Notes |
|-------|------|-------|
| Algorithm.md | 10,285 B | Algorithm execution |
| Architect.md | 9,374 B | Architecture planning |
| Artist.md | 10,244 B | Visual design |
| ClaudeResearcher.md | 7,838 B | Claude-based research |
| CodexResearcher.md | 10,346 B | Codex-based research |
| Designer.md | 9,219 B | Design work |
| Engineer.md | 10,935 B | Engineering tasks |
| GeminiResearcher.md | 8,320 B | Gemini-based research |
| GrokResearcher.md | 8,331 B | Grok-based research |
| Intern.md | 7,951 B | Simple tasks |
| Pentester.md | 11,983 B | Penetration testing |
| PerplexityResearcher.md | 8,407 B | Perplexity-based research |
| QATester.md | 13,359 B | QA testing |

### Installed Hooks (21 hooks at `/home/adam/.claude/hooks/`)

#### PreToolUse Hooks

| Hook | Matcher(s) | Purpose |
|------|-----------|---------|
| VoiceGate.hook.ts (2,726 B) | Bash | Voice-gated commands |
| SecurityValidator.hook.ts (18,538 B) | Bash, Edit, Write, Read | Security validation for tool calls |
| SetQuestionTab.hook.ts (4,198 B) | AskUserQuestion | Tab state management |
| AgentExecutionGuard.hook.ts (4,265 B) | Task | Agent execution gating |
| SkillGuard.hook.ts (2,850 B) | Skill | Skill invocation gating |

#### PostToolUse Hooks

| Hook | Matcher(s) | Purpose |
|------|-----------|---------|
| AlgorithmTracker.hook.ts (10,012 B) | Bash, TaskCreate, TaskUpdate, Task | Algorithm phase tracking |
| OILEventBridge.hook.ts (2,772 B) | Bash, TaskCreate, TaskUpdate, Task, Read, Write, Edit, Grep, Glob, WebFetch, WebSearch | **OIL integration** — captures tool events as NDJSON |
| QuestionAnswered.hook.ts (2,604 B) | AskUserQuestion | Question completion tracking |

#### SessionEnd Hooks

| Hook | Purpose |
|------|---------|
| WorkCompletionLearning.hook.ts (9,801 B) | Learning from completed work |
| SessionSummary.hook.ts (4,872 B) | Session summary generation |
| RelationshipMemory.hook.ts (8,635 B) | Relationship memory updates |
| UpdateCounts.hook.ts (623 B) | Statistics counter update |
| IntegrityCheck.hook.ts (1,769 B) | Integrity verification |

#### UserPromptSubmit Hooks

| Hook | Purpose |
|------|---------|
| RatingCapture.hook.ts (18,143 B) | User rating/feedback capture |
| AutoWorkCreation.hook.ts (9,574 B) | Automatic work item creation |
| UpdateTabTitle.hook.ts (10,207 B) | Tab title management |
| SessionAutoName.hook.ts (14,909 B) | Automatic session naming |

#### SessionStart Hooks

| Hook | Purpose |
|------|---------|
| StartupGreeting.hook.ts (4,383 B) | DA greeting on session start |
| LoadContext.hook.ts (20,679 B) | Context loading at startup |
| CheckVersion.hook.ts (2,483 B) | Version verification |

#### Stop Hooks

| Hook | Purpose |
|------|---------|
| StopOrchestrator.hook.ts (4,219 B) | Orchestration on stop events |

#### Hook Support Libraries (`hooks/lib/`)

| Library | Size | Purpose |
|---------|------|---------|
| algorithm-state.ts | 20,504 B | Algorithm state management |
| change-detection.ts | 18,180 B | File/state change detection |
| identity.ts | 5,067 B | DA/principal identity resolution |
| learning-utils.ts | 2,480 B | Learning utilities |
| metadata-extraction.ts | 5,049 B | Metadata extraction |
| notifications.ts | 7,768 B | Notification dispatch (ntfy/Discord/Twilio) |
| output-validators.ts | 7,427 B | Output validation |
| paths.ts | 1,570 B | Path resolution |
| tab-constants.ts | 2,285 B | Tab state constants |
| tab-setter.ts | 12,635 B | Tab state management |
| time.ts | 4,637 B | Time utilities |

#### Hook Handlers (`hooks/handlers/`)

| Handler | Size | Purpose |
|---------|------|---------|
| AlgorithmEnrichment.ts | 7,751 B | Algorithm data enrichment |
| DocCrossRefIntegrity.ts | 32,781 B | Document cross-reference integrity |
| RebuildSkill.ts | 3,107 B | Skill rebuild handler |
| SystemIntegrity.ts | 5,913 B | System integrity checks |
| TabState.ts | 7,215 B | Tab state handler |
| UpdateCounts.ts | 8,370 B | Counter update handler |
| VoiceNotification.ts | 5,346 B | Voice notification handler |

### Memory System (`/home/adam/.claude/MEMORY/`)

```
MEMORY/
  README.md (4,203 B)
  LEARNING/
    README.md
    ALGORITHM/
      2026-02/ (hundreds of learning entries, sentiment ratings)
    FAILURES/
    REFLECTIONS/
    SIGNALS/
    SYSTEM/
  RELATIONSHIP/
  RESEARCH/
  SECURITY/
  STATE/
  VOICE/
  WORK/ (9,778 bytes dir — largest memory section, active work tracking)
  MEMORY.nested.20260220_172055/ (backup from v2.5 migration)
```

### Claude Code Plugins (6 enabled)

| Plugin | Source | Version | Installed |
|--------|--------|---------|-----------|
| cowork-plugin-management | knowledge-work-plugins | 0.2.2 | 2026-02-27 |
| claude-md-management | claude-plugins-official | 1.0.0 | 2026-02-27 |
| context7 | claude-plugins-official | 55b58ec | 2026-02-27 |
| security-guidance | claude-plugins-official | 55b58ec | 2026-02-27 |
| frontend-design | claude-plugins-official | 55b58ec | 2026-02-27 |
| skill-creator | claude-plugins-official | 55b58ec | 2026-02-27 |

### PAI Bin Utilities (`/home/adam/.claude/bin/`)

| Tool | Size | Purpose |
|------|------|---------|
| detect-mouse-buttons | 2,039 B | Mouse button detection |
| pai-mouse-daemon | 2,503 B | Mouse daemon (Python) |
| stt-toggle | 5,583 B | Speech-to-text toggle |
| voice-open | 750 B | Voice channel open |
| voice-replay | 1,148 B | Voice replay |
| voice-stop | 820 B | Voice channel stop |
| voice-toggle | 1,031 B | Voice toggle |
| vtt-toggle | 721 B | Voice-to-text toggle |

### PAI Statistics (from settings.json `counts`)

| Metric | Count |
|--------|-------|
| Skills | 37 |
| Workflows | 162 |
| Hooks | 21 |
| Signals | 215 |
| Files | 12 |
| Work items | 82 |
| Sessions | 22 |
| Research items | 22 |
| Ratings | 215 |
| Last updated | 2026-03-02T01:24:04Z |

---

## 2. OIL (Observer Integration Layer)

### Location & Status

| Property | Value |
|----------|-------|
| Path | `/home/adam/vault/workspaces/observer/oil/` |
| Has own git repo | Yes (`.git/` present) |
| Status | Active development (last modified 2026-02-25) |
| Has CLAUDE.md | Yes (project coordination file) |
| Config | `config.yml` — repo path declarations only (no secrets) |

### OIL Architecture

OIL serves as the **integration seam** between three repos:

1. **OIL itself** (`/home/adam/vault/workspaces/observer/oil`) — EXIT boundary artifacts, visibility contracts, plans
2. **Observer** (`/home/adam/vault/workspaces/observer`) — governance authority (read-only access)
3. **PAI/Pi** (`/home/adam/.claude/skills/PAI`) — execution engine (capture-only access)

### OIL Integration with PAI

- **OILEventBridge.hook.ts** — Registered as a PostToolUse hook on nearly ALL tool matchers (Bash, TaskCreate, TaskUpdate, Task, Read, Write, Edit, Grep, Glob, WebFetch, WebSearch)
- Captures tool events as NDJSON to `/home/adam/vault/workspaces/observer/oil/tmp/events.ndjson`
- Marked `@oil-owned` — explicitly NOT a PAI hook
- Fail-silent design, <2ms latency

### OIL Scripts (`scripts/`)

| Script | Size | Purpose |
|--------|------|---------|
| capture-summary.sh | 2,930 B | Summary capture |
| oil_events_rotate.sh | 6,250 B | Event log rotation |
| oil_hook_install.sh | 2,502 B | Hook installation |
| oil_hygiene.sh | 8,504 B | Hygiene checks |
| oil_index.sh | 3,403 B | Index generation |
| oil_isc_diff.sh | 5,583 B | ISC diff checking |
| oil_isc_latest.sh | 5,583 B | Latest ISC retrieval |
| oil_receipt_rotate.sh | 2,040 B | Receipt rotation |
| oil_review_brief.sh | 8,151 B | Review brief generation |
| oil_secretgate_staged.sh | 3,511 B | Pre-commit secret gate |
| oil_secretscan_check.sh | 698 B | Secret scanning |
| oil_status.sh | 7,772 B | Status dashboard |
| oil_t2_activityparser.sh | 5,495 B | Tier-2 activity parsing |
| oil_t2_extracttranscript.sh | 5,537 B | Tier-2 transcript extraction |
| oil_t2_harvester.sh | 7,187 B | Tier-2 session harvesting |
| oil_t2_inference.sh | 6,335 B | Tier-2 inference |
| oil_t2_learningpattern.sh | 5,579 B | Tier-2 learning patterns |
| oil_t2_secretscan.sh | 7,077 B | Tier-2 secret scanning |
| oil_t3_receipt_check.sh | 2,502 B | Tier-3 receipt validation |
| switch_verify.sh | 7,111 B | Switch verification |

### OIL Gates

- `gates/secret-allowlist.txt` (1,011 B)
- `gates/secret-patterns.txt` (918 B)

### OIL Exit Artifacts (11 exits documented)

Exits 001 through 011, covering: OIL scaffold, module map, category model, tier-2 wrapper hygiene, tier-3 governance design, session harvester Linux path fix, T3 receipt validation, retroactive receipts, PAI v3 migration, algorithm tracker NDJSON ignition, PAI decoupling decision.

### OIL Documentation (`docs/`)

Comprehensive governance documentation including:
- Architecture docs, Atlas secrets contract, events retention policy
- Integration tier 1 ISC, usage guide, receipt policy, secrets policy
- Session identity policy, tier boundaries, tier-2/tier-3 contracts
- Upstream context, transition docs

### OIL Worktrees

- Active worktree: `agent-a2f87b0d` (at `.claude/worktrees/agent-a2f87b0d`)

---

## 3. JSON-RPC Control Plane

### Location & Status

| Property | Value |
|----------|-------|
| Planning docs | `/mnt/zfs-host/backup/projects/observer-vault/01-Projects/control-plane/` |
| Monorepo code | `/mnt/zfs-host/backup/projects/observer-vault/01-Projects/control-plane/observer-system/` |
| Status | **Built, merged to master, awaiting infrastructure wiring** |
| Build commit | `f046dac` |
| Merge commit | `e915fe2` |
| Branch | `claude/zealous-satoshi` (merged to master) |
| Files | 64 |
| Lines of code | 16,754 |
| Tests passing | 427 |
| Smoke test | 9/9 |
| Installed as service? | **No** — service unit file exists at `observer-system/observer-control-plane.service` but is NOT deployed |
| Currently running? | **No** — no process found |

### Monorepo Structure (as built)

```
observer-system/
  packages/
    shared/             # S0: Types, Zod schemas, error codes, IDs (60 tests)
    control-plane/      # S1-S5, S7: Core control plane (305 tests)
      src/
        session/        # S1: Session state machine + store
        policy/         # S2: Policy engine + YAML config
        audit/          # S3: Audit logger + sanitizer + circuit breaker
        approval/       # S4: Approval gateway + timeout
        server/         # S5: JSON-RPC server + auth + handlers
        health/         # S7: Health monitor + status aggregator
    dispatch/           # S6: Backend executor + env sanitisation (62 tests)
  scripts/
    smoke-test.ts       # 9-check validation script
  setup.sh              # 25,350 B installation script
  INSTALL.md            # 15,897 B installation guide
  observer-control-plane.service  # 833 B systemd unit file (not deployed)
  control-plane.example.yaml      # 13,474 B config example
  execution-backends.example.yaml # 7,589 B backend config example
```

### Technology Stack

- Language: TypeScript (strict mode)
- Runtime: Bun
- Transport: JSON-RPC over HTTP (Phase 1)
- Binding: 127.0.0.1 only
- Package manager: npm workspaces

### Architecture Documents

| Document | Size |
|----------|------|
| control-plane-prd.md | 40,921 B |
| atlas-prd-generation-prompt.md | 7,661 B |
| setup-infrastructure-prd.md | 13,896 B |

### Next Steps (per PROJECT_STATE.md)

1. Infrastructure wiring (systemd units, Tailscale networking, deployment scripts)
2. End-to-end integration testing
3. Real backend testing (Claude Code, Gemini CLI)
4. Phase 2 planning (bubblewrap, WebSocket, Telegram, TruffleHog)

---

## 4. Obsidian

### Installation

| Property | Value |
|----------|-------|
| Package | `obsidian 1.11.7-1` (pacman) |
| Electron | `electron39 39.5.2-1` |
| Currently running | **No** (not found in process list) |

### Vault

| Property | Value |
|----------|-------|
| Location | `/mnt/zfs-host/backup/projects/observer-vault/` |
| Filesystem | ZFS (NFS share, group `nfs-share`) |
| Structure | `00-Inbox/`, `01-Projects/`, `02-Knowledge/`, `03-Daily/`, `04-Archive/`, `05-Dashboards/` |

### Git Sync

| Property | Value |
|----------|-------|
| Plugin | obsidian-git |
| Remote | `https://github.com/Kryax/observer-vault.git` |
| Branch | master |
| User | Kryax / admthompson@gmail.com |
| Auto-commit message | `vault auto-backup: {{date}}` |
| Auto-save interval | 30 minutes |
| Auto-push interval | 0 (manual) |
| Sync method | merge |
| Pull before push | true |

### Community Plugins (5 installed)

| Plugin | Location | Notes |
|--------|----------|-------|
| **observer-governance** | `.obsidian/plugins/observer-governance/` | **Observer-specific** — v1.0.0, document lifecycle management, frontmatter validation, promotion workflow, audit logging, Atlas integration. Has `audit.jsonl` (28KB). Desktop only. |
| obsidian-git | `.obsidian/plugins/obsidian-git/` | Vault git sync (auto-backup) |
| smart-connections | `.obsidian/plugins/smart-connections/` | AI-powered semantic search |
| dataview | `.obsidian/plugins/dataview/` | Data query engine |
| templater-obsidian | `.obsidian/plugins/templater-obsidian/` | Template engine |
| auto-template-trigger | `.obsidian/plugins/auto-template-trigger/` | Auto template application |

### Core Plugins (enabled)

file-explorer, global-search, switcher, graph, backlink, canvas, outgoing-link, tag-pane, properties, page-preview, daily-notes, templates, note-composer, command-palette, editor-status, bookmarks, outline, word-count, file-recovery, sync, bases

### Smart Connections (`.smart-env/`)

| Property | Value |
|----------|-------|
| Embedding model | TaylorAI/bge-micro-v2 (local transformers) |
| Chat model | Ollama (adapter configured) |
| Alt chat platform | OpenRouter |
| Embedding directory | `.smart-env/multi/` (175 files) |
| Config | `.smart-env/smart_env.json` |

### Observer-Specific Plugin Detail: observer-governance

- **main.js:** 40,503 B
- **styles.css:** 1,643 B
- **manifest.json:** 318 B
- **audit.jsonl:** 28,419 B (active audit logging)
- **Source project:** `/mnt/zfs-host/backup/projects/observer-vault/01-Projects/governance-plugin/` (contains `src/`, `esbuild.config.mjs`, `package.json`, `tsconfig.json`, `observer-governance-prd.md`)

---

## 5. System Services

### Active User Services (systemd --user)

| Service | Status | PID | Description | Unit Location |
|---------|--------|-----|-------------|---------------|
| claude-cowork.service | **active (running)** | 1733 | Claude Cowork Service (native Linux backend) | `/usr/lib/systemd/user/` (system-provided) |
| pai-voice-server.service | **active (running)** | 1731 | PAI Voice Server (ElevenLabs TTS) | `/home/adam/.config/systemd/user/` |
| pai-mouse-daemon.service | **active (running)** | 1730 | PAI Mouse Button Daemon | `/home/adam/.config/systemd/user/` |
| app-claude-desktop@*.service | **active (running)** | 2402 | Claude Desktop (transient) | transient unit |

### Service Details

#### claude-cowork.service

| Property | Value |
|----------|-------|
| Binary | `/usr/bin/cowork-svc-linux` |
| Version | 1.0.9 |
| Socket | `/run/user/1000/cowork-vm-service.sock` |
| Memory | 16.2M |
| Restart | on-failure (5s delay) |
| Enabled | Yes (preset: enabled) |
| Up since | 2026-03-02 09:55:37 AEDT |

#### pai-voice-server.service

| Property | Value |
|----------|-------|
| ExecStart | `/usr/bin/bun run /home/adam/.claude/VoiceServer/server.ts` |
| Server code | `/home/adam/.claude/VoiceServer/server.ts` (26,052 B) |
| Dependencies | network-online.target, pipewire.service |
| Memory | 97.7M |
| Restart | always (3s delay) |
| Enabled | Yes |
| Supporting files | `pronunciations.json`, `voices.json`, `install.sh`, `start.sh`, `stop.sh`, `restart.sh`, `uninstall.sh`, `status.sh`, menubar/ |

#### pai-mouse-daemon.service

| Property | Value |
|----------|-------|
| ExecStart | `/usr/bin/python3 /home/adam/.claude/bin/pai-mouse-daemon` |
| Device | Logitech MX Master 3 (`/dev/input/event12`) |
| Button mapping | Button 276 -> STT Toggle |
| Memory | 14M |
| Restart | on-failure (5s delay) |
| Enabled | Yes |

#### Claude Desktop

| Property | Value |
|----------|-------|
| Binary | `/usr/lib/electron39/electron /usr/lib/claude-desktop-bin/app.asar` |
| Config | `/home/adam/.config/Claude/claude_desktop_config.json` |
| Desktop features | Cowork scheduled tasks, web search, chat sidebar |
| MCP config | Minimal (preferences-only config observed) |
| Extensions | Claude Extensions + Settings directories present |
| Worktrees | `git-worktrees.json` exists |

### No Matching Services Found

- No system-level (root) Observer-related services
- No systemd timers (user or system) related to Observer
- No crontab entries
- No `/etc/cron.d/` entries related to Observer

---

## 6. Runtimes & Package Managers

### Node.js

| Property | Value |
|----------|-------|
| Version | v25.6.1 |
| Package | `nodejs 25.6.1-2.1` (pacman) |
| npm | 11.10.1 (`npm 11.10.1-1` via pacman) |
| Global packages | `@anthropic-ai/claude-code@2.1.63` only |
| node-gyp | 12.2.0-1 (pacman) |

### Bun

| Property | Value |
|----------|-------|
| Version | 1.3.9 |
| Package | `bun 1.3.9-2.1` (pacman) |
| Global packages | None found |
| Usage | PAI Voice Server, OIL hooks, various `.hook.ts` files |

### Python

| Property | Value |
|----------|-------|
| Version | 3.14.3 |
| Package | `python 3.14.3-2` (pacman) |
| Relevant pip packages | None detected (no anthropic, claude, mcp, oil, observer packages) |
| Usage | PAI mouse daemon |

### Go

| Property | Value |
|----------|-------|
| Version | go1.26.0-X:nodwarf5 linux/amd64 |
| Package | `go 2:1.26.0-3` (pacman) |
| Usage | claude-cowork service binary is compiled Go |

### Not Installed

- **Rust/cargo:** Not found
- **Docker:** Not available or not running

### Package Manager: pacman (Arch/CachyOS)

Key Observer-relevant packages installed:
- `obsidian 1.11.7-1`
- `electron39 39.5.2-1`
- `nodejs 25.6.1-2.1`
- `npm 11.10.1-1`
- `bun 1.3.9-2.1`
- `python 3.14.3-2`
- `git 2.53.0-1.1`
- `go 2:1.26.0-3`

---

## 7. MCP Servers

### Active MCP Processes

| Process | PID | Details |
|---------|-----|---------|
| context7-mcp | 27778 | `node /home/adam/.npm/_npx/eea2bd7412d4593b/node_modules/.bin/context7-mcp` |
| @upstash/context7-mcp | 27555 | npm exec wrapper |

### MCP Configuration

- **Claude Code plugin:** context7 enabled in settings.json
- **Claude Desktop logs:** `mcp-server-Filesystem.log` and `mcp.log` present in `/home/adam/.config/Claude/logs/`
- **No globally installed MCP npm packages**
- **Legacy cache:** `/home/adam/.claude-v3/mcp-needs-auth-cache.json` (suggests previous Claude v3 installation existed)
- **Current cache:** `/home/adam/.claude/mcp-needs-auth-cache.json`

---

## 8. Git Configuration

### Global Git Config

| Property | Value |
|----------|-------|
| Default branch | main |
| Safe directory | /mnt/zfs-host/backup/projects/observer-vault |
| Credential helper | store |

### Observer Vault Git Config

| Property | Value |
|----------|-------|
| User | Kryax / admthompson@gmail.com |
| Remote | https://github.com/Kryax/observer-vault.git |
| Branch | master (tracks origin/master) |

### OIL Git Repo

- Separate git repo at `/home/adam/vault/workspaces/observer/oil/.git/`
- Has active worktree at `.claude/worktrees/agent-a2f87b0d`

---

## 9. Other Observer Ecosystem Projects

### pai-brain (`/mnt/zfs-host/backup/projects/pai-brain/`)

| Property | Value |
|----------|-------|
| Structure | identity/, policies/, receipts/, spec/, templates/ |
| Policies | consumption-contract.md, context-budgeting.md, retrieval-policy.md |
| Status | Appears to be a governance/policy repo for PAI brain behaviour |

### Observer Vault Sub-Projects (`01-Projects/`)

| Project | Path | Status |
|---------|------|--------|
| control-plane | `01-Projects/control-plane/` | Built, merged, awaiting infra wiring |
| governance-plugin | `01-Projects/governance-plugin/` | Built, deployed to Obsidian |
| observer-council | `01-Projects/observer-council/` | Multi-agent deliberation (source of TDS v2) |
| oil | `01-Projects/oil/` | OIL project reference |
| pai | `01-Projects/pai/` | PAI project reference |
| vault | `01-Projects/vault/` | Vault project reference |

### Observer Vault Inbox Items

- `00-Inbox/system-inventory/` — This inventory project
- `00-Inbox/great-transition-research/` — Research project (untracked)

---

## 10. Databases

### Observer-Relevant Databases

- **No dedicated databases found** — no PostgreSQL, Redis, or custom SQLite databases
- The audit trail for observer-governance is `audit.jsonl` (NDJSON, not SQLite)
- OIL events are `events.ndjson` (NDJSON, not a database)
- Smart Connections uses its own embedding store in `.smart-env/multi/`

### System SQLite Files (non-Observer)

- `/home/adam/.local/share/klipper/history3.sqlite` (clipboard manager)
- Various Chromium/browser databases (not Observer-related)

---

## 11. Docker

**Not available.** Docker is not installed or not running on this system.

---

## 12. Potentially Abandoned or Incomplete Items

| Item | Location | Observation |
|------|----------|-------------|
| `~/.config/PAI/` | Referenced in settings.json as `PAI_CONFIG_DIR` | **Does not exist on disk** — env var points to non-existent directory |
| `~/.claude-v3/` | `/home/adam/.claude-v3/` | Legacy Claude v3 installation remnant — contains `mcp-needs-auth-cache.json` |
| `OIL ~/` directory | `/home/adam/vault/workspaces/observer/oil/~/` | Stray home directory reference created inside OIL repo (contains empty `.claude/Plans/`) |
| `pai-brain spec/` | `/mnt/zfs-host/backup/projects/pai-brain/spec/` | Empty directory |
| `pai-brain identity/` | `/mnt/zfs-host/backup/projects/pai-brain/identity/` | Empty directory |
| `pai-brain receipts/` | `/mnt/zfs-host/backup/projects/pai-brain/receipts/` | Empty directory |
| `pai-brain templates/` | `/mnt/zfs-host/backup/projects/pai-brain/templates/` | Empty directory |
| control-plane `src/` | `01-Projects/control-plane/src/` | **Empty** — all code lives in `observer-system/packages/` instead |
| Obsidian sync (core) | Core plugin `sync: true` | Obsidian Sync core plugin enabled but unclear if actively used alongside git sync |
| Claude Desktop MCP | Filesystem MCP server logs exist | MCP Filesystem server has been run but may not be currently active |
| `pai-voice-server` warning | systemd log | `Unknown key 'StartLimitIntervalSec' in section [Service]` — key in wrong section (should be in `[Unit]`) |

---

## Summary Statistics

| Category | Count |
|----------|-------|
| Active user services | 4 (cowork, voice server, mouse daemon, Claude Desktop) |
| PAI skills | 37 |
| PAI agents | 14 |
| PAI hooks | 21 |
| Claude Code plugins | 6 |
| Obsidian community plugins | 5 (including observer-governance) |
| OIL scripts | 20 |
| OIL exit artifacts | 11 |
| Control plane test count | 427 |
| Runtimes | 4 (Node.js, Bun, Python, Go) |
| Active MCP servers | 1 (context7) |
| Databases | 0 (NDJSON files used instead) |
| Docker containers | 0 |
| Cron/timer jobs | 0 |
