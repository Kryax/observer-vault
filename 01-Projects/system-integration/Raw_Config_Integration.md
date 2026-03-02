# Raw Configuration & Integration Layer — Observer Ecosystem

**Generated:** 2026-03-02
**Sub-Agent:** 3 (Configuration & Integration)
**Scope:** All configuration, hooks, integration points, and governance wiring

---

## 1. MCP Servers

### 1.1 Claude Code (CLI) MCP Configuration

**Source:** `~/.claude/settings.json`

Claude Code's settings file does not contain explicit `mcpServers` blocks in the traditional sense. Instead, it uses:

- `enableAllProjectMcpServers: true` — Automatically enables any MCP servers declared by projects
- `enabledMcpjsonServers: []` — Empty; no explicitly whitelisted JSON-based MCP servers
- **Plugins (effectively MCP-like):**
  | Plugin | Registry | Status |
  |--------|----------|--------|
  | `cowork-plugin-management` | `knowledge-work-plugins` | Enabled |
  | `claude-md-management` | `claude-plugins-official` | Enabled |
  | `context7` | `claude-plugins-official` | Enabled |
  | `security-guidance` | `claude-plugins-official` | Enabled |
  | `frontend-design` | `claude-plugins-official` | Enabled |
  | `skill-creator` | `claude-plugins-official` | Enabled |

**Connection Status:** Active — these are in-process plugins loaded by Claude Code at runtime, not external MCP servers.

### 1.2 Claude Desktop MCP Configuration

**Source:** `/home/adam/.config/Claude/claude_desktop_config.json`

```json
{
  "preferences": {
    "coworkScheduledTasksEnabled": true,
    "sidebarMode": "chat",
    "coworkWebSearchEnabled": true
  }
}
```

**No MCP servers configured in Claude Desktop.** The config is minimal — preferences only. No `mcpServers` block exists.

Additional Claude Desktop files at `/home/adam/.config/Claude/`:
- `config.json` — UI preferences, locale, theme, OAuth token cache
- `window-state.json` — Window positioning
- `extensions-blocklist.json` / `extensions-installations.json` — Extension management
- `git-worktrees.json` — Worktree tracking
- `logs/` — Includes `mcp-server-Filesystem.log` and `mcp.log` (evidence a Filesystem MCP server was used at some point)

**Integration Status:** Claude Desktop is installed and configured but has **no active MCP server integrations**. The presence of `mcp-server-Filesystem.log` suggests a Filesystem MCP server was previously connected but is not currently configured.

---

## 2. Environment Variables

### 2.1 Claude Code Environment (settings.json `env` block)

These are injected into every Claude Code session and available to all hooks/tools:

| Variable | Value | Purpose |
|----------|-------|---------|
| `PAI_DIR` | `/home/adam/.claude` | Root PAI installation directory |
| `PROJECTS_DIR` | `/home/adam` | Base directory for all projects |
| `CLAUDE_CODE_MAX_OUTPUT_TOKENS` | `80000` | Maximum response token count |
| `BASH_DEFAULT_TIMEOUT_MS` | `600000` | 10-minute bash timeout |
| `PAI_CONFIG_DIR` | `${PAI_DIR}/../.config/PAI` | PAI config directory (resolves to `/home/adam/.config/PAI` — **directory does not exist**) |
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | `1` | Enables experimental agent teams feature |

### 2.2 Shell Environment

**`/home/adam/.profile`:**
```
export ELEVENLABS_API_KEY="sk_e..." (redacted — ElevenLabs API key)
```
Note: This file contains a commented-out older key and then sets the variable twice — the last value wins. The key is exposed in plaintext.

**`/home/adam/.zshrc`:**
```
alias pai='bun ~/.claude/skills/PAI/Tools/pai.ts'
```
One PAI-relevant item: the `pai` CLI alias.

**`/home/adam/.bashrc`:** No Observer/PAI-related content. Standard defaults only.

**`/home/adam/.config/fish/config.fish`:** No Observer/PAI-related content. Just starship init.

**`/etc/environment`:** Empty (comments only).

### 2.3 Notification Environment Variables (Referenced in settings.json)

These are referenced in the notifications config but set via shell variable expansion:

| Variable | Where Referenced | Actual Value |
|----------|-----------------|--------------|
| `NTFY_TOPIC` | `settings.json` notifications.ntfy.topic | **Not found in any env file** — likely unset |
| `DISCORD_WEBHOOK` | `settings.json` notifications.discord.webhook | **Not found in any env file** — likely unset |
| `TWILIO_TO_NUMBER` | `settings.json` notifications.twilio.toNumber | **Not found in any env file** — likely unset |

**Integration Status:** Notification channels (Discord, Twilio) are **configured but non-functional** — the env vars they reference are not set anywhere discoverable. The ntfy channel may work if `NTFY_TOPIC` is set elsewhere (e.g., in a session or systemd environment).

### 2.4 .env Files

**None found** in any project directory under `/mnt/zfs-host/backup/projects/`.

### 2.5 Broken Reference: PAI_CONFIG_DIR

`PAI_CONFIG_DIR` is set to `${PAI_DIR}/../.config/PAI` which would resolve to `/home/adam/.config/PAI`. This directory **does not exist**. No files reference this variable in the hook codebase. **Status: configured but not used.**

---

## 3. Claude Code Settings (Full Breakdown)

**Source:** `/home/adam/.claude/settings.json` (938 lines)

### 3.1 Identity: `daidentity`

| Field | Value |
|-------|-------|
| Name | Atlas |
| Full Name | Atlas - Personal AI |
| Display Name | Atlas |
| Colour | `#3B82F6` (blue) |
| Voice ID | `aEO01A4wXwd1O8GPgGlF` (ElevenLabs) |
| Startup Catchphrase | "Atlas here, ready to go." |

**Voice Profiles:**
- `main` — Primary DA voice: stability 0.35, similarity_boost 0.8, style 0.9, speed 1x, volume 0.8
- `algorithm` — Algorithm phase announcer: stability 0.3, similarity_boost 0.75, style 0.8, speed 1.2x, volume 1.0

**Personality Traits (0-100):**
Precision (95), Curiosity (90), Expressiveness (85), Resilience (85), Energy (80), Directness (80), Enthusiasm (75), Optimism (75), Composure (70), Warmth (70), Playfulness (45), Formality (30)

### 3.2 Principal Configuration

| Field | Value |
|-------|-------|
| Name | Adam |
| Timezone | Australia/Sydney |
| Voice Clone | Provider: ElevenLabs, voiceId: empty (not configured) |

### 3.3 PAI System Reference

| Field | Value |
|-------|-------|
| Repo URL | github.com/danielmiessler/PAI |
| Version | 3.0 |

### 3.4 Permissions

**Allow (auto-approved):** Bash, Read, Write, Edit, MultiEdit, Glob, Grep, LS, WebFetch, WebSearch, NotebookRead, NotebookEdit, TodoWrite, ExitPlanMode, Task, Skill, `mcp__*` (all MCP tools)

**Ask (requires confirmation):**
- Destructive filesystem ops: `rm -rf /`, `rm -rf ~`, `rm -rf ~/.claude`
- Disk wiping: `diskutil eraseDisk/zeroDisk/partitionDisk`, `dd if=/dev/zero`, `mkfs`
- GitHub destructive: `gh repo delete`, `gh repo edit --visibility public`
- Git force push: all variants of `git push --force`
- Secret file access: `~/.ssh/id_*`, `~/.ssh/*.pem`, `~/.aws/credentials`, `~/.gnupg/private*`
- Settings modification: `Write/Edit(~/.claude/settings.json)`
- SSH modification: `Write/Edit(~/.ssh/*)`

**Deny:** Empty (nothing explicitly denied)

**Default Mode:** `default`

### 3.5 Context & Model Configuration

| Setting | Value |
|---------|-------|
| `max_tokens` | 16,000 |
| `contextDisplay.compactionThreshold` | 83 (autocompact buffer is 16.5% of context window) |
| `plansDirectory` | `~/.claude/Plans/` |
| `teammateMode` | `in-process` |
| `contextFiles` | `skills/PAI/SKILL.md`, `skills/PAI/AISTEERINGRULES.md`, `skills/PAI/USER/AISTEERINGRULES.md`, `skills/PAI/USER/DAIDENTITY.md` |

### 3.6 Tech Stack Preferences

| Setting | Value |
|---------|-------|
| Browser | Arc |
| Terminal | terminal |
| Package Manager | Bun |
| Python Package Manager | pip |
| Language | TypeScript |
| Dev Server Port | 5173 |

### 3.7 Notification Routing

| Event Type | Channels |
|------------|----------|
| taskComplete | (none) |
| longTask (>5min) | ntfy |
| backgroundAgent | ntfy |
| error | ntfy, Discord |
| security | ntfy, Discord |

**Status:** Configured but likely **partially non-functional** — see env var analysis above. ntfy may work; Discord/Twilio likely broken due to missing env vars.

### 3.8 System Counts (as of 2026-03-02)

| Metric | Count |
|--------|-------|
| Skills | 37 |
| Workflows | 162 |
| Hooks | 21 |
| Signals | 215 |
| Files | 12 |
| Work sessions | 82 |
| Sessions | 22 |
| Research | 22 |
| Ratings | 215 |

### 3.9 Custom Spinner Verbs

783 custom spinner verbs configured, replacing defaults. Categories include: Kingkiller Chronicle, gaming, cyberpunk, Dune, Star Trek, Culture (Iain M. Banks), philosophy, stoicism, security/hacking, machine learning, coffee, typography, and many more. This is purely cosmetic but heavily personalised.

---

## 4. Hooks & Triggers

### 4.1 Hook Inventory

All hooks live at `/home/adam/.claude/hooks/` and are TypeScript files executed by Bun. There are **21 hook files** plus a `handlers/` subdirectory and a `lib/` subdirectory.

### 4.2 Hook Event Flow Map

#### SessionStart
| Hook | Purpose | Blocking? |
|------|---------|-----------|
| `StartupGreeting.hook.ts` | Displays PAI banner with system stats, persists Kitty terminal session | No |
| `LoadContext.hook.ts` | Injects SKILL.md + AI Steering Rules as `<system-reminder>` | Yes |
| `CheckVersion.hook.ts` | Checks PAI version | Unknown |

#### UserPromptSubmit
| Hook | Purpose | Blocking? |
|------|---------|-----------|
| `RatingCapture.hook.ts` | Captures explicit (1-10) and implicit (AI-inferred) sentiment from user prompts; also outputs Algorithm format reminder | Partially (AI inference ~1s) |
| `AutoWorkCreation.hook.ts` | Creates/manages WORK/ directory hierarchy for session tracking | No |
| `UpdateTabTitle.hook.ts` | Updates Kitty terminal tab title based on session activity | No |
| `SessionAutoName.hook.ts` | Auto-names sessions from prompt content | No |

#### PreToolUse — Bash
| Hook | Purpose | Blocking? |
|------|---------|-----------|
| `VoiceGate.hook.ts` | Blocks subagents from sending voice notifications (only main session can curl localhost:8888) | Yes (fast: <5ms) |
| `SecurityValidator.hook.ts` | Validates bash commands against security patterns (block/confirm/alert) | Yes (<10ms) |

#### PreToolUse — Edit, Write, Read
| Hook | Purpose | Blocking? |
|------|---------|-----------|
| `SecurityValidator.hook.ts` | Validates file path operations against security patterns | Yes (<10ms) |

#### PreToolUse — AskUserQuestion
| Hook | Purpose | Blocking? |
|------|---------|-----------|
| `SetQuestionTab.hook.ts` | Sets Kitty tab state when asking user a question | No |

#### PreToolUse — Task
| Hook | Purpose | Blocking? |
|------|---------|-----------|
| `AgentExecutionGuard.hook.ts` | Enforces `run_in_background: true` for non-fast agents (warning, not blocking) | No |

#### PreToolUse — Skill
| Hook | Purpose | Blocking? |
|------|---------|-----------|
| `SkillGuard.hook.ts` | Blocks false-positive `keybindings-help` invocations caused by list-position bias | Yes (<5ms) |

#### PostToolUse — Bash
| Hook | Purpose | Blocking? |
|------|---------|-----------|
| `AlgorithmTracker.hook.ts` | Detects phase transitions from voice curls, tracks criteria and agents | No (<3ms) |
| `OILEventBridge.hook.ts` | Captures tool-use events as NDJSON for Observer Integration Layer | No (<2ms) |

#### PostToolUse — TaskCreate, TaskUpdate, Task
| Hook | Purpose | Blocking? |
|------|---------|-----------|
| `AlgorithmTracker.hook.ts` | Tracks criteria creation/updates and agent spawns | No |
| `OILEventBridge.hook.ts` | Captures events for OIL | No |

#### PostToolUse — Read, Write, Edit, Grep, Glob, WebFetch, WebSearch
| Hook | Purpose | Blocking? |
|------|---------|-----------|
| `OILEventBridge.hook.ts` | Captures all tool-use events for OIL observability | No (<2ms) |

#### Stop
| Hook | Purpose | Blocking? |
|------|---------|-----------|
| `StopOrchestrator.hook.ts` | Single entry point — parses transcript once, distributes to handlers | No (<100ms) |

**StopOrchestrator Handlers** (`/home/adam/.claude/hooks/handlers/`):
- `VoiceNotification.ts` — Extracts voice line, sends to voice server at localhost:8888
- `TabState.ts` — Resets Kitty tab to default state
- `RebuildSkill.ts` — Auto-rebuilds SKILL.md from Components/ if modified
- `AlgorithmEnrichment.ts` — Enriches algorithm state post-response
- `DocCrossRefIntegrity.ts` — Checks system doc changes, updates cross-references

#### SessionEnd
| Hook | Purpose | Blocking? |
|------|---------|-----------|
| `WorkCompletionLearning.hook.ts` | Captures work learnings to MEMORY/LEARNING/ | No |
| `SessionSummary.hook.ts` | Marks work COMPLETED, clears state | No |
| `RelationshipMemory.hook.ts` | Extracts relationship notes (World/Biographical/Opinion) | No |
| `UpdateCounts.hook.ts` | Refreshes system counts in settings.json | No (~1-2s) |
| `IntegrityCheck.hook.ts` | System integrity + doc cross-ref checks | No (~50ms) |

### 4.3 Hook Library (`/home/adam/.claude/hooks/lib/`)

| Module | Purpose |
|--------|---------|
| `algorithm-state.ts` | Single source of truth for algorithm state read/write (per-session JSON) |
| `change-detection.ts` | Detects file changes for integrity checking |
| `identity.ts` | Central identity loader — reads `daidentity` and `principal` from settings.json |
| `learning-utils.ts` | Utilities for learning file creation |
| `metadata-extraction.ts` | Extracts metadata from transcripts |
| `notifications.ts` | ntfy push notification service (fire-and-forget) |
| `output-validators.ts` | Validates voice output format |
| `paths.ts` | Centralised path resolution with `$HOME`/`~` expansion |
| `tab-constants.ts` | Kitty tab colour/state constants |
| `tab-setter.ts` | Kitty terminal tab state management |
| `time.ts` | Timestamp utilities |

### 4.4 Git Hooks

No custom (non-sample) git hooks found in the observer-vault repository. OIL has pre-commit gate *scripts* (`oil_secretgate_staged.sh`) but these are **not installed as git hooks** — they exist as standalone scripts that would need manual or hook-based invocation.

### 4.5 Status Line

**Source:** `/home/adam/.claude/statusline-command.sh`

A Bash script providing responsive status display with 4 modes based on terminal width:
- nano (<35 cols), micro (35-54), mini (55-79), normal (80+)
- Shows: Greeting, model, Git status, learning stats, signals, context usage, quotes
- Reads from: `settings.json`, `ratings.jsonl`, `trending-cache.json`, `model-cache.txt`, `.quote-cache`

---

## 5. CLAUDE.md Files

### 5.1 Global

| Location | Size | Purpose | Type |
|----------|------|---------|------|
| `/home/adam/.claude/CLAUDE.md` | 4 lines | Points to PAI SKILL.md for system initiation | Global (all sessions) |

### 5.2 Project-Specific (Active)

| Location | Purpose | Status |
|----------|---------|--------|
| `/mnt/zfs-host/backup/projects/observer-vault/00-Inbox/system-inventory/CLAUDE.md` | System inventory project guidance | Active |
| `/mnt/zfs-host/backup/projects/observer-vault/00-Inbox/great-transition-research/CLAUDE.md` | Research project (4-stream opportunity analysis) | Active |
| `/mnt/zfs-host/backup/projects/observer-vault/01-Projects/control-plane/CLAUDE.md` | Observer control plane project (JSON-RPC, multi-engine dispatch) | Active (pre-build) |
| `/mnt/zfs-host/backup/projects/observer-vault/01-Projects/governance-plugin/CLAUDE.md` | Observer governance Obsidian plugin | Active |
| `/home/adam/vault/workspaces/observer/oil/CLAUDE.md` | OIL (Observer Integration Layer) — boundary enforcement, tier governance | Active |

### 5.3 Skill-Specific

| Location | Purpose |
|----------|---------|
| `/home/adam/.claude/skills/Art/Tools/CLAUDE.md` | Art tool configuration |
| `/home/adam/.claude/skills/Prompting/Templates/Tools/CLAUDE.md` | Prompting template tools |

### 5.4 Legacy/Archived

| Location | Purpose |
|----------|---------|
| `/home/adam/.claude.old-20260208-160837/CLAUDE.md` | Backup from 2026-02-08 |
| `/home/adam/.claude-v3/CLAUDE.md` | Previous PAI v3 install (identical content to current global CLAUDE.md) |
| `/home/adam/.claude-v25/CLAUDE.md` | Even older PAI install |

---

## 6. Integration Points

### 6.1 PAI <-> Voice Server (localhost:8888)

**Type:** HTTP REST (localhost)
**Status: ACTIVE (running)**

- Voice server runs as systemd user service: `pai-voice-server.service`
- Binary: `/usr/bin/bun run /home/adam/.claude/VoiceServer/server.ts`
- Currently running (PID 1731, uptime 2h34m, 98.5MB memory)
- **Endpoint:** `POST http://localhost:8888/notify`
- **Payload:** `{ message: string, voice_id?: string, voice_settings?: {...}, volume?: number }`
- **Callers:** `VoiceNotification.ts` handler (via StopOrchestrator), `AlgorithmTracker.hook.ts` (rework notifications), and the Algorithm in SKILL.md mandates voice curls at phase transitions
- **Guard:** `VoiceGate.hook.ts` prevents subagents from flooding the voice server
- VoiceServer files: `server.ts`, `pronunciations.json`, `voices.json`, install/restart/status scripts
- **Connection:** Active and proven working

### 6.2 PAI <-> ElevenLabs API

**Type:** External HTTPS API
**Status: ACTIVE (via voice server)**

- Voice server uses ElevenLabs for TTS
- API key set in `~/.profile`: `ELEVENLABS_API_KEY="sk_e..."` (exposed in plaintext)
- Voice ID: `aEO01A4wXwd1O8GPgGlF` (Atlas Premium)
- **Connection:** Active (voice server is running and using it)

### 6.3 PAI <-> Kitty Terminal

**Type:** Kitty remote control protocol
**Status: ACTIVE**

- Tab title/colour management via `tab-setter.ts`, `tab-constants.ts`
- Session persistence via `persistKittySession()` in StartupGreeting
- Environment vars used: `KITTY_LISTEN_ON`, `KITTY_WINDOW_ID`
- State stored at: `MEMORY/STATE/kitty-sessions/`, `MEMORY/STATE/tab-title.json`
- Phase-specific tab colours change during algorithm execution
- **Connection:** Active — deeply integrated with PAI workflow

### 6.4 PAI <-> Mouse Daemon

**Type:** Python daemon (systemd user service)
**Status: ACTIVE (running)**

- Service: `pai-mouse-daemon.service`
- Binary: `/usr/bin/python3 /home/adam/.claude/bin/pai-mouse-daemon`
- Currently running (PID 1730, 14MB memory)
- Related binaries in `/home/adam/.claude/bin/`: `detect-mouse-buttons`, `stt-toggle`, `voice-toggle`, `vtt-toggle`, `voice-open`, `voice-replay`, `voice-stop`
- **Connection:** Active — provides hardware integration for voice/STT toggles

### 6.5 OIL <-> PAI (OILEventBridge)

**Type:** File-based (append-only NDJSON)
**Status: ACTIVE**

- Hook: `OILEventBridge.hook.ts` (owned by OIL, not PAI)
- Writes to: `/home/adam/vault/workspaces/observer/oil/tmp/events.ndjson`
- 2,736 events captured as of inventory time
- Each event: `{ts, tool_name, outcome}` — minimal, structured
- Design: Zero PAI imports, fail-silent, <2ms
- **Direction:** PAI -> OIL (one-way capture)
- **Connection:** Active — events flowing, file growing

### 6.6 OIL <-> Observer Vault

**Type:** File-based (read-only from OIL's perspective)
**Status: CONFIGURED, limited activity**

- OIL `config.yml` declares Observer path: `/home/adam/vault/workspaces/observer`
- Access level: `read-only`
- Role: `governance-authority`
- Observer contains: constitution draft, synthesis artifacts, experimental conclusions
- **Connection:** Configured — OIL can read Observer governance documents

### 6.7 OIL <-> PAI Skills (config.yml)

**Type:** File-based reference
**Status: CONFIGURED**

- OIL `config.yml` declares PAI path: `/home/adam/.claude/skills/PAI`
- Access level: `capture-only`
- Role: `execution-engine`
- OIL cannot modify PAI source files outside governed hook paths
- **Connection:** Configured — access-level constraints in place

### 6.8 PAI <-> Obsidian Vault (Observer)

**Type:** File-system (shared directories)
**Status: ACTIVE but indirect**

- PAI writes to the vault via `00-Inbox/` (inbox rule in CLAUDE.md files)
- Obsidian reads the same filesystem
- Observer governance plugin (`observer-governance`) is built and installed at `/mnt/zfs-host/backup/projects/observer-vault/.obsidian/plugins/observer-governance/`
- Plugin provides: frontmatter validation, promotion workflow, audit logging, Atlas manifest generation
- Plugin audit log: `audit.jsonl` exists in plugin directory
- **No direct API connection** between PAI and Obsidian — purely file-system mediated
- **Connection:** Active — PAI writes files that Obsidian displays/manages

### 6.9 Obsidian Plugins (Installed)

| Plugin | Status |
|--------|--------|
| `auto-template-trigger` | Installed |
| `dataview` | Installed |
| `observer-governance` | Installed (custom-built) |
| `obsidian-git` | Installed |
| `smart-connections` | Installed |
| `templater-obsidian` | Installed |

### 6.10 PAI <-> Anthropic API (Haiku inference)

**Type:** External HTTPS API
**Status: ACTIVE**

- `RatingCapture.hook.ts` calls Haiku for implicit sentiment inference (~1s)
- `UpdateCounts.hook.ts` refreshes usage cache from Anthropic API
- Authentication: Via Claude Code's built-in auth (no separate API key in env)
- **Connection:** Active

### 6.11 PAI <-> ntfy.sh

**Type:** External HTTPS push notification
**Status: CONFIGURED but likely non-functional**

- Server: `ntfy.sh`
- Topic: `${NTFY_TOPIC}` — env var not found in any discoverable env file
- Routing: longTask, backgroundAgent, error, security events
- **Connection:** Configured but untested — depends on missing env var

### 6.12 Observer Control Plane

**Type:** Node.js JSON-RPC server (systemd service)
**Status: SPECIFIED but not built**

- Service file exists: `/mnt/zfs-host/backup/projects/observer-vault/01-Projects/control-plane/observer-system/observer-control-plane.service`
- Would run at: `/opt/observer-system/` as user `observer`
- Would bind to `127.0.0.1:9000`
- Would use: age-encrypted secrets, SQLite audit, YAML config
- Target deployment: Two-VM (Observer Relay + CachyOS)
- CLAUDE.md status: "active — pre-build (awaiting PRD generation from TDS v2)"
- **Connection:** Specified but not built — service file is a template, no built code exists at `/opt/observer-system/`

### 6.13 PAI CLI (`pai` command)

**Type:** CLI tool (Bun)
**Status: ACTIVE**

- Alias in `.zshrc`: `pai='bun ~/.claude/skills/PAI/Tools/pai.ts'`
- Entry point: `/home/adam/.claude/skills/PAI/Tools/pai.ts`
- **Connection:** Active — available as shell command

### 6.14 Cross-References: Configs Referencing Non-Existent Things

| Config | References | Exists? |
|--------|-----------|---------|
| `PAI_CONFIG_DIR` | `/home/adam/.config/PAI` | **No** — directory does not exist |
| `notifications.discord.webhook` | `${DISCORD_WEBHOOK}` | **No** — env var not set |
| `notifications.twilio.toNumber` | `${TWILIO_TO_NUMBER}` | **No** — env var not set |
| `principal.voiceClone.voiceId` | Empty string | **Not configured** — Adam's voice clone not set up |
| Control plane service | `/opt/observer-system/` | **No** — not built yet |

---

## 7. Governance Configuration

### 7.1 Automated Governance (Active)

| Mechanism | Type | What It Enforces |
|-----------|------|-----------------|
| `SecurityValidator.hook.ts` | PreToolUse hook | Blocks catastrophic bash commands, confirms dangerous ones, validates file path access against patterns.yaml |
| `VoiceGate.hook.ts` | PreToolUse hook | Prevents subagent voice flooding — only main session can send voice notifications |
| `AgentExecutionGuard.hook.ts` | PreToolUse hook | Enforces `run_in_background: true` for non-fast agents (warning, not blocking) |
| `SkillGuard.hook.ts` | PreToolUse hook | Blocks false-positive keybindings-help invocations |
| `IntegrityCheck.hook.ts` | SessionEnd hook | Detects PAI system file changes, triggers maintenance; checks doc cross-references |
| OIL secret gate scripts | Manual/CI scripts | `oil_secretgate_staged.sh`, `oil_secretscan_check.sh` — secret detection for staged commits |
| OIL tier boundaries | Documented rules | T1 (read-only), T2 (invoke wrappers), T3 (modify with receipts) |
| Permissions ask-list | Settings config | Destructive ops require human confirmation |
| Security patterns.yaml | YAML config | 216-line pattern file defining blocked/confirm/alert patterns |

### 7.2 Manual Governance (Human-Gated)

| Mechanism | Description |
|-----------|-------------|
| CLAUDE.md boundary rules | Every project CLAUDE.md contains "NON-NEGOTIABLE" boundary enforcement sections |
| OIL exit artifacts | Architecture changes require exit artifacts in `exits/` directory — must be approved by Adam |
| OIL tier elevation | Cannot elevate `config.yml` `pi.access` beyond `capture-only` without T3 contract protocol |
| Obsidian governance plugin | Promotion to `canonical` status requires human action — sovereignty is non-negotiable |
| Vault write rules | Atlas can only write to `00-Inbox/`, can update `inbox`/`draft` status docs, cannot modify `canonical`/`archived` |
| Stop conditions | Multiple explicit "STOP and ask Adam" triggers across all project CLAUDE.md files |

### 7.3 Specified but Not Yet Implemented

| Governance Item | Status |
|----------------|--------|
| Control plane approval gateway | Specified in TDS v2, not built |
| Dual-layer credential detection (regex + TruffleHog) | Specified in control plane security non-negotiables |
| Backend sandboxing (bubblewrap) | Specified for Phase 2 |
| Telegram approval scope restriction | Specified, not built |
| Auth failure rate limiting | Specified, not built |
| OIL pre-commit gate as actual git hook | Scripts exist but not wired as git hooks |
| Cross-VM auth (Tailscale + Bearer token) | Specified for two-VM deployment, not built |

---

## 8. Memory & State Architecture

### 8.1 MEMORY Directory Tree (`/home/adam/.claude/MEMORY/`)

```
MEMORY/
├── LEARNING/
│   ├── ALGORITHM/        # Algorithm process learnings
│   ├── FAILURES/         # Failure capture files
│   ├── REFLECTIONS/      # Reflection notes
│   ├── SIGNALS/          # ratings.jsonl (215 entries), trending data
│   └── SYSTEM/           # System-level learnings
├── RELATIONSHIP/
│   ├── 2026-02/          # February relationship notes
│   └── 2026-03/          # March relationship notes
├── RESEARCH/
│   └── 2026-02/          # Research outputs
├── SECURITY/
│   └── 2026/             # Security event logs (YYYY/MM/file pattern)
├── STATE/
│   ├── algorithms/       # Per-session algorithm state JSON files
│   ├── current-work.json # Active session tracking
│   ├── session-names.json
│   ├── model-cache.txt
│   ├── tab-title.json
│   ├── git-cache_*.sh    # Git status cache files
│   └── *.json            # Various state caches
├── VOICE/                # Voice-related logs
├── WORK/                 # 82 work session directories (timestamped)
└── MEMORY.nested.20260220_172055/  # Backup from v2.5->v3.0 migration
```

### 8.2 State Flow

```
User Prompt
  → UserPromptSubmit hooks:
      → RatingCapture → MEMORY/LEARNING/SIGNALS/ratings.jsonl
      → AutoWorkCreation → MEMORY/WORK/<session>/ + MEMORY/STATE/current-work.json
      → SessionAutoName → MEMORY/STATE/session-names.json
  → PreToolUse hooks:
      → SecurityValidator → MEMORY/SECURITY/<year>/<month>/security-*.jsonl
  → PostToolUse hooks:
      → AlgorithmTracker → MEMORY/STATE/algorithms/<sessionId>.json
      → OILEventBridge → ~/vault/workspaces/observer/oil/tmp/events.ndjson
  → Stop hooks:
      → StopOrchestrator → Voice server, Tab state, SKILL.md rebuild
  → SessionEnd hooks:
      → WorkCompletionLearning → MEMORY/LEARNING/<category>/
      → SessionSummary → MEMORY/WORK/ (marks COMPLETED) + clears current-work.json
      → RelationshipMemory → MEMORY/RELATIONSHIP/<year-month>/
      → UpdateCounts → settings.json counts
      → IntegrityCheck → maintenance tasks
```

---

## 9. Integration Status Summary

| Integration | Type | Status |
|------------|------|--------|
| PAI <-> Voice Server (localhost:8888) | HTTP REST | **Active** |
| PAI <-> ElevenLabs API | HTTPS | **Active** (via voice server) |
| PAI <-> Kitty Terminal | Remote control protocol | **Active** |
| PAI <-> Mouse Daemon | Systemd service | **Active** |
| PAI <-> Anthropic Haiku | HTTPS | **Active** (sentiment inference) |
| OIL <-> PAI (event bridge) | File (NDJSON) | **Active** (2,736 events) |
| PAI <-> Obsidian (file system) | Shared filesystem | **Active** (indirect) |
| Observer governance plugin | Obsidian plugin | **Active** (installed, has audit log) |
| PAI CLI | Shell alias | **Active** |
| PAI <-> ntfy.sh | HTTPS push | **Configured but untested** (missing env var) |
| PAI <-> Discord | Webhook | **Configured but broken** (missing env var) |
| PAI <-> Twilio | API | **Configured but broken** (missing env var) |
| OIL <-> Observer governance docs | File read | **Configured, limited activity** |
| OIL secret gate (pre-commit) | Script | **Configured but not wired as git hook** |
| Observer Control Plane | JSON-RPC service | **Specified but not built** |
| Cross-VM deployment | Tailscale + HTTP | **Specified but not built** |
| Backend sandboxing (bubblewrap) | Process isolation | **Specified but not built** (Phase 2) |
| Telegram approval interface | Bot | **Specified but not built** |
| PAI_CONFIG_DIR | Directory reference | **Configured but non-existent** |
| Principal voice clone | ElevenLabs | **Configured but empty** |

---

## 10. Key Observations

1. **PAI is the central nervous system.** Nearly everything runs through `~/.claude/settings.json` and the hooks at `~/.claude/hooks/`. The hook architecture is sophisticated — 21 hooks covering 6 lifecycle events with a well-designed library layer.

2. **OIL is a governance seam, not an execution engine.** It observes PAI through the OILEventBridge hook (file-based, one-way) and maintains boundary artifacts. It explicitly constrains itself to `capture-only` access to PAI.

3. **The voice pipeline is the most mature integration.** Voice server (systemd), ElevenLabs API, Kitty terminal integration, mouse daemon for hardware triggers — all actively running and deeply wired.

4. **Notification channels are partially broken.** ntfy, Discord, and Twilio are configured in settings.json but the environment variables they reference (`NTFY_TOPIC`, `DISCORD_WEBHOOK`, `TWILIO_TO_NUMBER`) are not set in any discoverable location.

5. **Security is layered but not complete.** The SecurityValidator + patterns.yaml + permissions ask-list provide good automated protection. OIL's secret gate scripts exist but are not installed as git hooks. The control plane's security architecture (credential isolation, bubblewrap) is specified but unbuilt.

6. **The control plane is the biggest gap.** It has a full TDS (220KB), a service file template, and detailed CLAUDE.md guidance, but no built code. This is the intended "central nervous system" for multi-engine dispatch.

7. **File-based integration dominates.** PAI writes to the vault filesystem, Obsidian reads it. OIL captures events via NDJSON files. Algorithm state is per-session JSON. There are no message queues, no databases (except the planned SQLite in the control plane), and no inter-process communication beyond HTTP to localhost:8888.

8. **ElevenLabs API key is exposed in plaintext** in `~/.profile`. This is a security concern worth flagging.

9. **Legacy PAI installations exist.** Both `~/.claude-v3/` and `~/.claude.old-20260208-160837/` and `~/.claude-v25/` are present — remnants of previous versions.

10. **The `PAI_CONFIG_DIR` reference points to a non-existent directory** (`/home/adam/.config/PAI`). This appears to be a vestigial configuration from the PAI upstream that was never populated.
