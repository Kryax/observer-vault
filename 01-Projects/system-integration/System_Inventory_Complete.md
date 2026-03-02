---
meta_version: 1
kind: inventory
status: draft
authority: low
domain: [system-inventory]
source: atlas_write
confidence: confirmed
mode: discovery
created: 2026-03-02T13:00:00+11:00
modified: 2026-03-02T13:00:00+11:00
cssclasses: [status-draft]
---

# Observer Ecosystem — Complete System Inventory

**Generated:** 2026-03-02
**Synthesised by:** Sub-Agent 4 (Synthesis)
**Source files:** Raw_Project_Inventory.md, Raw_Tools_Services.md, Raw_Config_Integration.md

---

## A. Executive Summary

The Observer ecosystem is a personal AI governance and execution platform built by Adam around Claude Code, Obsidian, and a set of custom infrastructure layers. At its core it is an attempt to solve a fundamental problem: how does a single human operator maintain sovereignty, auditability, and drift resistance over an increasingly autonomous AI stack? The answer, as built, is a layered architecture of governance boundaries, event capture, and structured memory — all coordinated through a monorepo Obsidian vault backed by Git.

The ecosystem is surprisingly mature in its operational layer. PAI v3.0 (the Personal AI Infrastructure wrapping Claude Code) is fully installed and actively used daily, with 21 lifecycle hooks, 37 skills, 14 agents, a unified memory system, voice synthesis via ElevenLabs, hardware integration through a mouse daemon, and deep Kitty terminal integration. The OIL (Observer Integration Layer) is complete at its MVI milestone — it captures tool-use events from PAI via a one-way NDJSON bridge and enforces tiered boundary rules. The governance plugin for Obsidian is built and installed, providing frontmatter validation, promotion workflows, and audit logging. These three components — PAI, OIL, and the governance plugin — form the working core of the system today.

The most significant gap is the Observer Control Plane. This is the intended central nervous system: a JSON-RPC server that would accept client connections, enforce governance policy, route work to multiple backend AI engines (Claude Code, Gemini CLI, Codex CLI, Ollama), manage approvals, and maintain audit trails. Phase 1 code is fully built (16,754 lines, 427 passing tests, merged to master), but it has never been deployed. It exists as source code in the vault monorepo with a systemd service template and setup infrastructure, waiting for infrastructure wiring — systemd deployment, Tailscale networking, and end-to-end testing with real backends. Until this is deployed, the ecosystem operates as a single-engine system (Claude Code only) with no formal multi-engine dispatch.

Secondary gaps include notification channels (ntfy, Discord, and Twilio are configured but their environment variables are unset), the OIL pre-commit secret gate (scripts exist but are not wired as actual git hooks), and the Observer Commons federation protocol (five substantial specification documents totalling ~257KB, but no executable code). There are also several legacy artefacts — three archived PAI installations, a superseded `pai-brain` repository, and duplicate copies of major documents across multiple locations — that could be cleaned up to reduce confusion.

Overall, the ecosystem demonstrates a clear architectural vision with strong governance thinking (the TDS v2 alone is 220KB). The operational layer works well for single-user, single-engine use. The path to a fully wired multi-engine system is well-documented but requires the control plane deployment, backend integration testing, and closing the notification/secret-scanning gaps.

---

## B. Component Registry

### B.1 Core Projects

| Component | Location | Type | State | Dependencies | Description |
|-----------|----------|------|-------|-------------|-------------|
| **observer-vault** | `/mnt/zfs-host/backup/projects/observer-vault/` | project | active | Git, Obsidian, ZFS/NFS | Monorepo Obsidian vault; the single source of truth for all Observer documentation, architecture, and project code |
| **PAI v3.0** | `/home/adam/.claude/` | project | active | Claude Code, Bun, Node.js, ElevenLabs API | Personal AI Infrastructure wrapping Claude Code with skills, hooks, agents, memory, voice, and custom tooling |
| **OIL (MVI)** | `/home/adam/vault/workspaces/observer/oil/` | project | built/active | Bash, PAI hooks | Observer Integration Layer — drift-resistant governance boundary between human and AI executor |
| **Control Plane** | `01-Projects/control-plane/observer-system/` | project | built (not deployed) | Node.js 22, Bun, better-sqlite3, age encryption | JSON-RPC multi-engine execution dispatch; Phase 1 complete, awaiting infrastructure wiring |
| **Governance Plugin** | `01-Projects/governance-plugin/` | plugin | built/installed | Obsidian, esbuild, TypeScript | Obsidian plugin for document lifecycle, frontmatter validation, promotion, audit logging |
| **Observer Council** | `01-Projects/observer-council/` | project | specified-only | None (documentation) | Multi-agent governance framework; produced TDS v1/v2; 41 architecture files |
| **Observer Commons** | `01-Projects/governance-plugin/observer-commons/` | project | specified-only | None (specifications) | Federation protocol for solution sharing; 5 spec docs (~257KB total) |
| **Vault (project)** | `01-Projects/vault/` | project | specified-only | None (documentation) | Architecture and specification for the vault knowledge management design |

### B.2 Research & Inbox

| Component | Location | Type | State | Dependencies | Description |
|-----------|----------|------|-------|-------------|-------------|
| **Great Transition Research** | `00-Inbox/great-transition-research/` | project | complete | None | Four-stream research on AI/software/labour market transition; all deliverables complete |
| **System Inventory** | `00-Inbox/system-inventory/` | project | in-progress | None | This project — complete ecosystem mapping |

### B.3 Services

| Component | Location | Type | State | Dependencies | Description |
|-----------|----------|------|-------|-------------|-------------|
| **PAI Voice Server** | `/home/adam/.claude/VoiceServer/` | service | active (running) | Bun, ElevenLabs API, PipeWire | ElevenLabs TTS service on localhost:8888; systemd user service |
| **PAI Mouse Daemon** | `/home/adam/.claude/bin/pai-mouse-daemon` | service | active (running) | Python 3, evdev | Hardware mouse button integration for STT/voice toggles; systemd user service |
| **Claude Cowork** | `/usr/bin/cowork-svc-linux` | service | active (running) | Go runtime | Claude Cowork Service (native Linux backend); system-provided |
| **Claude Desktop** | `/usr/lib/claude-desktop-bin/app.asar` | service | active (running) | Electron 39 | Claude Desktop application (transient systemd unit) |
| **Context7 MCP** | npx-managed | service | active (running) | Node.js | MCP server for documentation context; loaded by Claude Code plugin |

### B.4 Tools & Runtimes

| Component | Location | Type | State | Dependencies | Description |
|-----------|----------|------|-------|-------------|-------------|
| **Claude Code** | `/home/adam/.npm-global/lib` | tool | installed/active | Node.js, npm | CLI AI assistant v2.1.63; the primary execution engine |
| **Node.js** | system (pacman) | runtime | installed | — | v25.6.1; used by Claude Code and control plane |
| **Bun** | system (pacman) | runtime | installed | — | v1.3.9; used by voice server, hooks, OIL |
| **Python** | system (pacman) | runtime | installed | — | v3.14.3; used by mouse daemon |
| **Go** | system (pacman) | runtime | installed | — | v1.26.0; used by cowork service binary |
| **Git** | system (pacman) | tool | installed | — | v2.53.0; vault version control |
| **Obsidian** | system (pacman) | tool | installed | Electron 39 | v1.11.7; knowledge management UI |
| **PAI CLI** | `/home/adam/.claude/skills/PAI/Tools/pai.ts` | tool | installed/active | Bun | CLI entry point; aliased as `pai` in zsh |

### B.5 Obsidian Plugins

| Component | Location | Type | State | Dependencies | Description |
|-----------|----------|------|-------|-------------|-------------|
| **observer-governance** | `.obsidian/plugins/observer-governance/` | plugin | installed/active | Obsidian | Custom — document lifecycle, frontmatter validation, promotion, audit |
| **obsidian-git** | `.obsidian/plugins/obsidian-git/` | plugin | installed/active | Git | Auto-backup vault to GitHub every 30 minutes |
| **smart-connections** | `.obsidian/plugins/smart-connections/` | plugin | installed/active | Ollama (optional) | AI semantic search using local embeddings (TaylorAI/bge-micro-v2) |
| **dataview** | `.obsidian/plugins/dataview/` | plugin | installed/active | Obsidian | Data query engine for vault content |
| **templater-obsidian** | `.obsidian/plugins/templater-obsidian/` | plugin | installed/active | Obsidian | Template engine (14 templates in `00-Inbox/_templates/`) |
| **auto-template-trigger** | `.obsidian/plugins/auto-template-trigger/` | plugin | installed/active | Obsidian | Automatic template application on file creation |

### B.6 Claude Code Plugins

| Component | Source | Type | State | Description |
|-----------|--------|------|-------|-------------|
| **cowork-plugin-management** | knowledge-work-plugins | plugin | installed | Cowork management |
| **claude-md-management** | claude-plugins-official | plugin | installed | CLAUDE.md file management |
| **context7** | claude-plugins-official | plugin | installed | Documentation context via MCP |
| **security-guidance** | claude-plugins-official | plugin | installed | Security best-practice guidance |
| **frontend-design** | claude-plugins-official | plugin | installed | Frontend design assistance |
| **skill-creator** | claude-plugins-official | plugin | installed | Skill creation tooling |

### B.7 PAI Hooks (21)

| Component | Event | Type | State | Description |
|-----------|-------|------|-------|-------------|
| **StartupGreeting** | SessionStart | hook | active | Displays PAI banner, persists Kitty session |
| **LoadContext** | SessionStart | hook | active | Injects SKILL.md + AI Steering Rules |
| **CheckVersion** | SessionStart | hook | active | Verifies PAI version |
| **RatingCapture** | UserPromptSubmit | hook | active | Captures explicit/implicit sentiment via Haiku |
| **AutoWorkCreation** | UserPromptSubmit | hook | active | Creates WORK/ directories for session tracking |
| **UpdateTabTitle** | UserPromptSubmit | hook | active | Updates Kitty terminal tab titles |
| **SessionAutoName** | UserPromptSubmit | hook | active | Auto-names sessions from prompt content |
| **VoiceGate** | PreToolUse (Bash) | hook | active | Blocks subagent voice flooding |
| **SecurityValidator** | PreToolUse (Bash/Edit/Write/Read) | hook | active | Validates commands against security patterns |
| **SetQuestionTab** | PreToolUse (AskUserQuestion) | hook | active | Sets Kitty tab state for questions |
| **AgentExecutionGuard** | PreToolUse (Task) | hook | active | Enforces background mode for agents |
| **SkillGuard** | PreToolUse (Skill) | hook | active | Blocks false-positive skill invocations |
| **AlgorithmTracker** | PostToolUse (Bash/Task*) | hook | active | Tracks algorithm phase transitions |
| **OILEventBridge** | PostToolUse (all tools) | hook | active | Captures events as NDJSON for OIL |
| **QuestionAnswered** | PostToolUse (AskUserQuestion) | hook | active | Question completion tracking |
| **StopOrchestrator** | Stop | hook | active | Distributes to 5 handlers: Voice, Tab, Rebuild, Algorithm, DocCrossRef |
| **WorkCompletionLearning** | SessionEnd | hook | active | Captures work learnings to MEMORY/ |
| **SessionSummary** | SessionEnd | hook | active | Marks work COMPLETED, clears state |
| **RelationshipMemory** | SessionEnd | hook | active | Extracts relationship notes |
| **UpdateCounts** | SessionEnd | hook | active | Refreshes system counts |
| **IntegrityCheck** | SessionEnd | hook | active | System integrity + doc cross-ref checks |

### B.8 PAI Skills (37)

| Skill | Size | Category |
|-------|------|----------|
| **PAI** (core) | 86KB | System (master documentation, 29 files) |
| PAIUpgrade | 19.5KB | System |
| CORE | (structured) | System (actions, pipelines) |
| Agents | 9.8KB | Execution |
| Council | 3.8KB | Governance |
| Recon | 15.2KB | Security |
| RedTeam | 3.4KB | Security |
| PromptInjection | 8.5KB | Security |
| WebAssessment | 7.2KB | Security |
| WorldThreatModelHarness | 3.7KB | Security |
| OSINT | 4.5KB | Intelligence |
| PrivateInvestigator | 7.9KB | Intelligence |
| Research | 6.5KB | Research |
| Science | 5.4KB | Research |
| FirstPrinciples | 9.0KB | Analysis |
| Telos | 12.3KB | Analysis |
| IterativeDepth | 1.9KB | Analysis |
| Evals | 7.4KB | Analysis |
| ExtractWisdom | 13.7KB | Knowledge |
| Fabric | 6.0KB | Knowledge |
| Aphorisms | 13.1KB | Knowledge |
| Documents | 12.9KB | Content |
| WriteStory | 4.9KB | Content |
| BeCreative | 4.6KB | Content |
| Art | 7.4KB | Content |
| Sales | 4.6KB | Content |
| AnnualReports | 4.4KB | Finance |
| SECUpdates | 8.0KB | Finance |
| USMetrics | 5.6KB | Finance |
| Prompting | 6.2KB | Tooling |
| CreateCLI | 10.3KB | Tooling |
| CreateSkill | 8.1KB | Tooling |
| Parser | 3.9KB | Tooling |
| Browser | 8.2KB | Integration |
| Apify | 13.2KB | Integration |
| BrightData | 6.6KB | Integration |
| Cloudflare | 3.4KB | Integration |
| Remotion | 2.2KB | Integration |

### B.9 Archived / Superseded

| Component | Location | Type | State | Description |
|-----------|----------|------|-------|-------------|
| **pai-brain** | `/mnt/zfs-host/backup/projects/pai-brain/` | project | abandoned | Early PAI brain; 3 policy files migrated to OIL/PAI |
| **PAI v2.5** | `/home/adam/.claude-v25/` | archive | archived | Previous PAI version |
| **PAI v3.0-pre** | `/home/adam/.claude-v3/` | archive | archived | Intermediate version before current v3.0 |
| **Pre-PAI backup** | `/home/adam/.claude.old-20260208-160837/` | archive | archived | Raw Claude Code config before PAI |
| **Constitutional Synthesis** | `~/vault/workspaces/observer/constitutional-synthesis-2026-02-10/` | project | complete/archived | Constitution research migrated to observer-council |
| **Local vault** | `/home/adam/vault/` | config | partially active | Original vault location; contains OIL repo and historical intake |

---

## C. Integration Map

### C.1 Active Connections (Working)

```
                                    +-----------------+
                                    |  ElevenLabs API |
                                    |  (HTTPS, TTS)   |
                                    +--------+--------+
                                             |
                                             v
+---------------+    HTTP :8888    +------------------+
| PAI Hooks     |<---------------->| Voice Server     |
| (StopOrch,    |                  | (systemd, Bun)   |
|  AlgTracker)  |                  +------------------+
+-------+-------+
        |                          +------------------+
        +---- Kitty Protocol ----->| Kitty Terminal   |
        |     (tab titles,         | (tab colours,    |
        |      colours, persist)   |  session state)  |
        |                          +------------------+
        |
        |     NDJSON append        +------------------+
        +------------------------->| OIL Event Bridge |
        |     (events.ndjson)      | (2,736 events)   |
        |                          +------------------+
        |
        |     Haiku API            +------------------+
        +------------------------->| Anthropic API    |
        |     (sentiment inference)| (Haiku model)    |
        |                          +------------------+
        |
        |     File writes          +------------------+     obsidian-git     +--------+
        +------------------------->| Observer Vault   |<------------------->| GitHub  |
              (00-Inbox/)          | (Obsidian + ZFS) |  (30min auto-save)  +--------+
                                   +-------+----------+
                                           |
                                   +-------+----------+
                                   | Obsidian Plugins |
                                   | - governance     |
                                   | - smart-connect  |
                                   | - dataview       |
                                   | - templater      |
                                   +------------------+

+------------------+    evdev      +------------------+
| Mouse Daemon     |<------------>| Logitech MX 3    |
| (systemd, Python)|              | (Button 276->STT)|
+------------------+              +------------------+

+------------------+    in-process +------------------+
| Claude Code      |<------------>| Context7 MCP     |
| (v2.1.63)        |              | (docs context)   |
+------------------+              +------------------+
```

**Data flow summary:**
1. User prompt enters Claude Code -> PAI hooks fire (RatingCapture, AutoWork, SessionAutoName, TabTitle)
2. During execution -> SecurityValidator gates dangerous ops; OILEventBridge captures all tool use
3. On response completion -> StopOrchestrator distributes to Voice (TTS), Tab (reset), Rebuild (SKILL.md), Algorithm (enrichment), DocCrossRef (integrity)
4. On session end -> Work learning, session summary, relationship memory, counts, integrity check all fire
5. Throughout -> Obsidian reads vault files PAI writes; obsidian-git auto-backs up to GitHub

### C.2 Configured but Untested/Broken

| Connection | Issue | Where Configured |
|------------|-------|-----------------|
| PAI -> ntfy.sh | `NTFY_TOPIC` env var not set in any discoverable location | `settings.json` notifications |
| PAI -> Discord | `DISCORD_WEBHOOK` env var not set | `settings.json` notifications |
| PAI -> Twilio | `TWILIO_TO_NUMBER` env var not set | `settings.json` notifications |
| OIL pre-commit gate | Scripts exist (`oil_secretgate_staged.sh`) but not wired as git hooks | OIL `scripts/` |
| PAI_CONFIG_DIR | Points to `/home/adam/.config/PAI` which does not exist | `settings.json` env |
| Principal voice clone | `voiceId` field is empty string | `settings.json` principal |
| Claude Desktop MCP | `mcp-server-Filesystem.log` exists but no MCP servers currently configured | `claude_desktop_config.json` |
| Obsidian Sync (core) | Core plugin enabled alongside git sync — unclear if actively used | `.obsidian/core-plugins.json` |

### C.3 Specified but Not Built

| Connection | Specification Location | Description |
|------------|----------------------|-------------|
| Control Plane -> Backend Dispatch | `control-plane-prd.md`, TDS v2 | Multi-engine routing to Claude Code, Gemini CLI, Codex CLI, Ollama |
| Control Plane -> Approval Gateway | TDS v2 S4 | Human approval flow for sensitive operations |
| Cross-VM Auth | TDS v2 | Tailscale + Bearer token for two-VM deployment |
| Telegram Bot | TDS v2 | Mobile approval interface |
| Bubblewrap Sandboxing | TDS v2 (Phase 2) | Process isolation for backend execution |
| TruffleHog Integration | Control plane security requirements | Deep secret scanning beyond regex |
| WebSocket Transport | TDS v2 (Phase 2) | Real-time control plane connections |
| Observer Commons Federation | `observer-commons/` specs | Cross-ecosystem solution sharing protocol |

---

## D. Gap Analysis

### D.1 Built but Not Deployed

| Gap | Code Location | What Exists | What's Needed to Close |
|-----|---------------|-------------|----------------------|
| **Control Plane (Phase 1)** | `01-Projects/control-plane/observer-system/` | 64 files, 16,754 lines, 427 tests passing, systemd unit template, setup.sh, INSTALL.md, example configs | 1) Run setup.sh to deploy to `/opt/observer-system/` 2) Create `observer` user 3) Install systemd service 4) Provision age-encrypted secrets 5) Configure YAML from templates 6) Run smoke tests against live service |
| **OIL Secret Gate** | `/home/adam/vault/workspaces/observer/oil/scripts/oil_secretgate_staged.sh` | Pre-commit secret scanning script, pattern files in `gates/` | Wire as actual git pre-commit hook via `oil_hook_install.sh` or manual `.git/hooks/pre-commit` installation |

### D.2 Installed but Not Connected

| Gap | Location | What Exists | What's Needed to Close |
|-----|----------|-------------|----------------------|
| **ntfy Notifications** | `settings.json` notifications.ntfy | Full routing config (longTask, backgroundAgent, error, security) | Set `NTFY_TOPIC` environment variable in shell profile or systemd environment |
| **Discord Notifications** | `settings.json` notifications.discord | Webhook routing for error + security events | Set `DISCORD_WEBHOOK` environment variable |
| **Twilio Notifications** | `settings.json` notifications.twilio | Phone number routing | Set `TWILIO_TO_NUMBER` environment variable |
| **Agent Teams** | `settings.json` (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) | Feature flag enabled, `~/.claude/teams/` directory exists | Directory is empty — no teams defined; feature appears unused |
| **PAI_CONFIG_DIR** | `settings.json` env | Variable set to `/home/adam/.config/PAI` | Either create the directory with intended config, or remove the dead reference |
| **Smart Connections Chat** | `.smart-env/smart_env.json` | Ollama adapter configured, OpenRouter as alternative | Verify Ollama is running and accessible for Smart Connections chat features |
| **Claude Desktop MCP** | `/home/adam/.config/Claude/claude_desktop_config.json` | Config file exists, evidence of previous Filesystem MCP use | Add `mcpServers` block to config if MCP integration is desired |

### D.3 Specified but Not Built

| Gap | Specification Location | Size of Spec | Complexity | Description |
|-----|----------------------|-------------|------------|-------------|
| **Control Plane Phase 2** | TDS v2, `control-plane-prd.md` | 220KB + 41KB | Complex | Bubblewrap sandboxing, WebSocket transport, Telegram bot, TruffleHog, auth rate limiting |
| **Observer Commons** | `01-Projects/governance-plugin/observer-commons/` | ~257KB (5 docs) | Complex | Federation protocol, schema spec, trust spec, composition spec — substantial design, zero code |
| **Observer Council (executable)** | `01-Projects/observer-council/architecture/` | 41 files, hundreds of KB | Complex | The deliberative framework exists as documentation only; no executable multi-agent council code |
| **Vault Ecosystem (executable)** | `01-Projects/vault/architecture/` | 50.7KB spec | Moderate | Vault reconstruction/knowledge management automation beyond current Obsidian plugin |
| **Dual-Layer Credential Detection** | Control plane security requirements | Specified in TDS v2 | Moderate | Regex + TruffleHog secret scanning for control plane |
| **Cross-VM Deployment** | TDS v2 | Part of 220KB TDS | Complex | Two-VM architecture: Observer Relay + CachyOS, Tailscale networking |

---

## E. Dependency Graph

### E.1 Foundation Layer (no upstream dependencies within ecosystem)

```
[Git] [Node.js] [Bun] [Python] [Obsidian] [Kitty] [ElevenLabs API] [Anthropic API]
```

### E.2 Core Layer (depends on Foundation)

```
[Claude Code]         depends on: Node.js, Anthropic API
[Observer Vault]      depends on: Git, Obsidian, ZFS/NFS
[OIL Repository]      depends on: Git, Bash
```

### E.3 Platform Layer (depends on Core)

```
[PAI v3.0]            depends on: Claude Code, Bun (hooks), Observer Vault (file writes)
[Voice Server]        depends on: Bun, ElevenLabs API, PipeWire
[Mouse Daemon]        depends on: Python, evdev
[Governance Plugin]   depends on: Obsidian, Observer Vault
```

### E.4 Integration Layer (depends on Platform)

```
[OIL Event Bridge]    depends on: PAI hooks, OIL repository
[Smart Connections]   depends on: Obsidian, Ollama (optional)
[Context7 MCP]        depends on: Claude Code, Node.js
[PAI CLI]             depends on: Bun, PAI skills
```

### E.5 Orchestration Layer (depends on Integration — NOT YET DEPLOYED)

```
[Control Plane]       depends on: Node.js/Bun, better-sqlite3, age encryption,
                                  systemd, Observer Vault (config), PAI (as backend)
[Approval Gateway]    depends on: Control Plane
[Backend Dispatch]    depends on: Control Plane, backend CLIs (Claude/Gemini/Codex/Ollama)
[Telegram Bot]        depends on: Control Plane, Telegram API
```

### E.6 Federation Layer (SPECIFIED ONLY)

```
[Observer Commons]    depends on: Control Plane, governance plugin, trust framework
```

### E.7 Key Dependency Chains

**To deploy the Control Plane:**
```
Node.js/Bun (installed) -> observer-system code (built) -> setup.sh (run)
  -> systemd service (install) -> age secrets (provision) -> YAML config (create)
    -> smoke test (verify) -> backend CLIs (test integration)
```

**To enable multi-engine dispatch:**
```
Control Plane (deployed) -> Backend CLIs installed (Claude Code exists; Gemini/Codex/Ollama need setup)
  -> execution-backends.yaml (configure) -> end-to-end test (verify)
```

**To enable notifications:**
```
ntfy: Set NTFY_TOPIC env var (simple)
Discord: Set DISCORD_WEBHOOK env var (simple)
Twilio: Set TWILIO_TO_NUMBER env var (simple)
```

### E.8 Circular Dependencies

**None detected.** The architecture is strictly layered:
- PAI writes to OIL (one-way via event bridge)
- OIL reads Observer governance docs (one-way)
- PAI writes to vault (one-way); Obsidian reads vault
- No component requires bidirectional runtime dependency with another Observer component

---

## F. Recommended Integration Sequence

### Phase 1: Quick Wins (close easy gaps)

| Step | Action | Complexity | Dependencies | Impact |
|------|--------|-----------|-------------|--------|
| 1.1 | Set `NTFY_TOPIC` env var in `~/.profile` or fish config | Simple | ntfy.sh account/topic | Enables push notifications for long tasks, errors, security events |
| 1.2 | Set `DISCORD_WEBHOOK` env var | Simple | Discord webhook URL | Enables error/security alerts to Discord |
| 1.3 | Wire OIL secret gate as git pre-commit hook in observer-vault | Simple | OIL scripts exist | Automated secret scanning on every commit |
| 1.4 | Remove or create `PAI_CONFIG_DIR` (`/home/adam/.config/PAI`) | Simple | None | Eliminates dead reference |
| 1.5 | Clean up `pai-brain` (archive or delete) | Simple | None | Reduces confusion — content fully superseded |
| 1.6 | Remove stale worktree `relaxed-ramanujan` from control-plane | Simple | None | Frees disk, reduces clutter |

### Phase 2: Control Plane Deployment

| Step | Action | Complexity | Dependencies | Impact |
|------|--------|-----------|-------------|--------|
| 2.1 | Review and run `setup.sh` from control-plane project | Moderate | Phase 1 complete (optional) | Creates `/opt/observer-system/`, observer user, directory structure |
| 2.2 | Provision age-encrypted secrets via `provision-secrets.sh` | Moderate | age tool installed, secret values chosen | Encrypted credential store for control plane |
| 2.3 | Create `control-plane.yaml` and `execution-backends.yaml` from examples | Moderate | Step 2.1 | Service configuration |
| 2.4 | Install and start systemd service | Moderate | Steps 2.1-2.3 | Control plane running on 127.0.0.1:9000 |
| 2.5 | Run smoke tests against live service | Moderate | Step 2.4 | Validate all 9 checks pass in deployed environment |
| 2.6 | Test Claude Code as first real backend | Moderate | Step 2.5 | End-to-end: client -> control plane -> Claude Code -> response |

### Phase 3: Multi-Engine & Extended Integration

| Step | Action | Complexity | Dependencies | Impact |
|------|--------|-----------|-------------|--------|
| 3.1 | Install Gemini CLI and configure as backend | Moderate | Phase 2 complete, Google API access | Second execution engine available |
| 3.2 | Install Codex CLI and configure as backend | Moderate | Phase 2 complete, OpenAI API access | Third execution engine |
| 3.3 | Configure Ollama as local backend | Moderate | Phase 2 complete, Ollama installed | Local/offline execution option |
| 3.4 | Set up Twilio for mobile notifications | Moderate | Twilio account, phone number | SMS alerts for critical events |
| 3.5 | Move Observer Commons to its own project directory | Simple | None | Proper project organisation for federation specs |
| 3.6 | Install OIL pre-commit hooks across all ecosystem git repos | Simple | Step 1.3 proven | Consistent secret scanning everywhere |

### Phase 4: Advanced Architecture

| Step | Action | Complexity | Dependencies | Impact |
|------|--------|-----------|-------------|--------|
| 4.1 | Implement Telegram approval bot | Complex | Phase 2 complete, Telegram bot token | Mobile approval interface for sensitive operations |
| 4.2 | Deploy cross-VM architecture (Tailscale) | Complex | Phase 2 complete, second VM, Tailscale | Distributed deployment with network-level isolation |
| 4.3 | Implement bubblewrap sandboxing for backends | Complex | Phase 2 complete | Process-level isolation for backend execution |
| 4.4 | Build Observer Commons executable layer | Complex | Phases 2-3 complete, federation design finalised | Cross-ecosystem solution sharing |
| 4.5 | Implement WebSocket transport for control plane | Complex | Phase 2 complete | Real-time bidirectional control plane connections |
| 4.6 | Build executable Observer Council framework | Complex | Phase 2 complete | Multi-agent deliberation with live governance |

---

## G. Observations & Flags

### G.1 Security Concerns

1. **ElevenLabs API key exposed in plaintext** in `/home/adam/.profile`. This is the most immediate security concern. The key is set as a plain `export` statement. Recommendation: Move to a secrets manager, age-encrypted file, or at minimum a more restricted file with `600` permissions.

2. **Git credential helper is `store`** (plaintext). Global git config uses `credential.helper=store`, which stores credentials in plaintext at `~/.git-credentials`. Consider switching to a keyring-based helper.

3. **OIL secret gate scripts not wired as hooks.** The secret-scanning infrastructure exists (`oil_secretgate_staged.sh`, `secret-patterns.txt`, `secret-allowlist.txt`) but is not installed as an actual git pre-commit hook. Staged secrets could be committed without detection.

4. **Broad tool permissions in PAI.** The `allow` list in `settings.json` auto-approves Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch, Task, Skill, and all MCP tools. The `deny` list is empty. While the SecurityValidator hook provides a secondary gate, the permissions model is permissive by design.

5. **`.credentials.json` and `.env` at PAI root.** These files exist at `/home/adam/.claude/` and are marked "DO NOT READ" in project documentation. They are not git-tracked (good) but their presence should be noted.

### G.2 Abandoned/Orphaned Components

1. **`pai-brain`** (`/mnt/zfs-host/backup/projects/pai-brain/`) — Fully superseded. Only 3 policy files with content, all migrated to OIL and PAI. Four empty directories. Candidate for deletion or explicit archival.

2. **PAI v2.5, v3.0-pre, and pre-PAI backup** — Three archived PAI installations remain on disk at `~/.claude-v25/`, `~/.claude-v3/`, and `~/.claude.old-20260208-160837/`. These consume disk space and could cause confusion. Consider compressing to a single archive tarball.

3. **Stray `~/` directory inside OIL** — `/home/adam/vault/workspaces/observer/oil/~/` contains an empty `.claude/Plans/` directory. This is a path-handling artefact that should be deleted.

4. **Control plane worktree residue** — `.claude/worktrees/relaxed-ramanujan/` still exists in the observer-vault after the branch was merged. Contains a full copy of governance-plugin and control-plane source.

5. **OIL stale branches** — 7 feature branches plus 4 worktree agent branches remain after MVI completion. Candidate for branch cleanup.

6. **Control plane empty `src/`** — `01-Projects/control-plane/src/` is empty; all code lives in `observer-system/packages/`. The empty directory is misleading.

### G.3 Inconsistencies Between Configuration and Reality

| Config Says | Reality | Severity |
|-------------|---------|----------|
| `PAI_CONFIG_DIR=/home/adam/.config/PAI` | Directory does not exist | Low (unused reference) |
| Notifications configured for ntfy, Discord, Twilio | Env vars not set; channels non-functional | Medium |
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` | Teams directory empty; feature unused | Low |
| Obsidian Sync core plugin enabled | Git sync also active; unclear if both used | Low |
| Control plane `CLAUDE.md`: "active — pre-build" | Code is fully built (427 tests) but CLAUDE.md not updated | Low (stale doc) |
| `principal.voiceClone.voiceId`: empty | Adam's voice clone not configured | Low |
| Control plane service targets `/opt/observer-system/` | Directory does not exist; code at `01-Projects/control-plane/observer-system/` | Expected (pre-deployment) |
| Voice server systemd unit uses `StartLimitIntervalSec` in `[Service]` | Should be in `[Unit]` section; generates warning | Low |

### G.4 Duplicate Functionality / Content

1. **TDS v1 and v2 exist in 3+ locations:** Observer Council (`01-Projects/observer-council/architecture/`), vault intake (`~/vault/intake/`), and constitutional synthesis workspace. The vault copies are canonical.

2. **Constitutional documents duplicated:** `OBSERVER_CONSTITUTION_DRAFT.md`, `POST_CONSTITUTION_ARCHITECTURAL_RESEARCH.md`, `PRINCIPLE_EXTRACTION_LOG.tsv`, `AMBIGUITY_REGISTER.md`, `CONFLICT_REGISTER.md` — all exist in both the constitutional synthesis workspace and observer-council. The observer-council versions should be canonical.

3. **Two Obsidian vaults:** `/home/adam/vault/` (local, original) and `/mnt/zfs-host/backup/projects/observer-vault/` (NFS, git-tracked, primary). The local vault still holds the OIL repo and historical intake documents. This split is intentional but worth documenting.

4. **Intake systems:** Archive intake at `04-Archive/intake.sh` and local vault intake at `~/vault/intake/intake.sh`. The relationship between these is unclear.

### G.5 Architecture Observations

1. **Single point of failure: `settings.json`.** At 938 lines and 24.8KB, this single file is the source of truth for PAI identity, permissions, environment, notifications, counts, context files, and spinner verbs. Corruption or accidental modification would be significant.

2. **File-based integration is both strength and limitation.** The NDJSON event bridge, JSONL audit logs, and filesystem-mediated vault integration are simple and robust. However, they provide no real-time feedback loop — OIL captures events but cannot influence PAI behaviour in real-time. The control plane would add this capability.

3. **Observer Commons is misplaced.** Five substantial specification documents (~257KB) are nested under `01-Projects/governance-plugin/observer-commons/`. This is a federation protocol that deserves its own project directory, not a subdirectory of the governance plugin.

4. **The MEMORY system is substantial.** 82 work sessions, 215 ratings, monthly relationship and research captures, per-session algorithm state — this is active and growing. Consider periodic archival of older WORK/ entries.

5. **Hook architecture is well-designed.** The separation of concerns (lib/ for utilities, handlers/ for StopOrchestrator sub-tasks, clear lifecycle event mapping) is clean. The fail-silent design for OILEventBridge (<2ms, no PAI imports) is particularly well-considered.

6. **No databases in the current system.** Everything is file-based (JSON, JSONL, NDJSON, YAML, Markdown). The control plane introduces the first database (better-sqlite3 for audit trails). This is a deliberate architectural choice that keeps the system simple but limits query capabilities.

### G.6 Recommendations for Adam

1. **Deploy the control plane.** This is the highest-impact next step. The code is built and tested. The setup infrastructure (setup.sh, INSTALL.md, example configs, systemd unit) is ready. This unlocks multi-engine dispatch, formal audit trails, and the approval gateway.

2. **Fix the notification plumbing.** Setting three environment variables (NTFY_TOPIC, DISCORD_WEBHOOK, TWILIO_TO_NUMBER) would activate the full notification pipeline. This is 10 minutes of work for significant operational visibility.

3. **Wire the OIL secret gate.** Running `oil_hook_install.sh` or manually installing the pre-commit hook would close a real security gap with minimal effort.

4. **Secure the ElevenLabs key.** Move from plaintext in `~/.profile` to an age-encrypted file, secrets manager, or at minimum a file with restricted permissions sourced at login.

5. **Archive legacy PAI installations.** Compress `~/.claude-v25/`, `~/.claude-v3/`, and `~/.claude.old-*` into a single dated tarball and remove the originals. Same for `pai-brain`.

6. **Promote Observer Commons to its own project.** Move from `governance-plugin/observer-commons/` to `01-Projects/observer-commons/`.

7. **Establish a document deduplication policy.** With TDS, constitution, and architecture docs in 3+ locations, define which copy is canonical and add references (not copies) in other locations.

---

## H. System Statistics Summary

| Category | Count |
|----------|-------|
| **Total components catalogued** | 100+ |
| **Active projects** | 5 (PAI, OIL, vault, governance plugin, system inventory) |
| **Built projects** | 7 (including control plane, Great Transition Research) |
| **Specified-only projects** | 4 (Observer Council, Observer Commons, Vault project, control plane Phase 2) |
| **Archived/abandoned** | 5 (pai-brain, 3 PAI versions, constitutional synthesis) |
| **Running services** | 5 (Claude Cowork, Voice Server, Mouse Daemon, Claude Desktop, Context7 MCP) |
| **PAI hooks** | 21 |
| **PAI skills** | 37 |
| **PAI agents** | 14 |
| **Claude Code plugins** | 6 |
| **Obsidian plugins** | 6 (including custom governance) |
| **OIL scripts** | 20 |
| **Templates** | 14 |
| **Dashboards** | 5 |
| **Active integrations** | 10 |
| **Configured but broken integrations** | 8 |
| **Specified but unbuilt integrations** | 8 |
| **Total lines of code (control plane)** | 16,754 |
| **Total passing tests (control plane)** | 427 |
| **Work sessions tracked** | 82 |
| **Ratings captured** | 215 |
| **OIL events captured** | 2,736 |
| **Runtimes installed** | 4 (Node.js, Bun, Python, Go) |
| **Databases** | 0 (all file-based; SQLite planned for control plane) |

---

*End of Complete System Inventory — Sub-Agent 4 (Synthesis)*
*Cross-referenced from: Raw_Project_Inventory.md, Raw_Tools_Services.md, Raw_Config_Integration.md*
