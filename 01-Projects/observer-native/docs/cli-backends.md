# CLI Backends — Observer Multi-CLI Setup

Observer-native is designed to be CLI-agnostic. The S1 adapter interface
(`src/s1/adapter.ts`) defines the contract any CLI backend must implement.

## Available CLI Backends

| CLI | Version | Package | Project Instructions | Auth |
|-----|---------|---------|---------------------|------|
| Claude Code | latest | `npm i -g @anthropic-ai/claude-code` | `CLAUDE.md` | `claude login` (browser) |
| Codex CLI | 0.113.0 | `npm i -g @openai/codex` | `AGENTS.md` | `codex login` (ChatGPT browser) or `OPENAI_API_KEY` |
| OpenCode | 1.2.24 | `npm i -g opencode-ai` | `opencode.md` | Provider-specific (API keys) |
| Gemini CLI | 0.32.1 | `npm i -g @google/gemini-cli` | `GEMINI.md` | `gemini` → Google OAuth, or `GEMINI_API_KEY` |

## Install Commands

### Claude Code
```bash
npm i -g @anthropic-ai/claude-code
claude login  # browser OAuth
```

### Codex CLI
```bash
npm i -g @openai/codex
codex login  # ChatGPT browser OAuth
# OR: printenv OPENAI_API_KEY | codex login --with-api-key
```

### OpenCode
```bash
npm i -g opencode-ai
# Package: opencode-ai (NOT opencode — that's the archived Go project)
```

### Gemini CLI
```bash
npm i -g @google/gemini-cli
gemini  # first run prompts for Google OAuth
# OR: export GEMINI_API_KEY=...
```

## Project Instruction Files

Each CLI reads its own project instruction file from the vault root:

| File | CLI | Format |
|------|-----|--------|
| `CLAUDE.md` | Claude Code | Markdown — full governance, safety hooks, MCP config |
| `AGENTS.md` | Codex CLI | Markdown — governance subset, D/I/R framework reference |
| `opencode.md` | OpenCode | Markdown — governance subset, D/I/R framework reference |
| `GEMINI.md` | Gemini CLI | Markdown — governance subset, supports `@./file.md` imports |

All project instruction files share the same Observer governance core:
- Human sovereignty: Adam decides, agent executes
- D/I/R as the cognitive primitive
- Triad reference for deep thinking
- Stop conditions for scope/boundary violations

## Fish Shell Invocation

```fish
# Claude Code (primary)
claude

# Codex CLI
codex "your prompt here"
codex --full-auto "your prompt here"  # sandboxed auto-execution

# OpenCode
opencode                              # interactive TUI
opencode -p "your prompt here"        # non-interactive

# Gemini CLI
gemini                                # interactive
gemini -p "your prompt here"          # non-interactive (if supported)
```

## Auth Methods

| CLI | Method | Env Var | Notes |
|-----|--------|---------|-------|
| Claude Code | Browser OAuth | `ANTHROPIC_API_KEY` | Full Opus access |
| Codex CLI | ChatGPT OAuth or API key | `OPENAI_API_KEY` | Requires ChatGPT Plus/Pro/Team |
| OpenCode | Provider-dependent | varies | Supports multiple LLM providers |
| Gemini CLI | Google OAuth or API key | `GEMINI_API_KEY` | Free tier: 60 req/min, 1000/day |

## Observer Integration Status

### Claude Code — Full Integration
- **Hooks**: SessionStart + Stop hooks wired (`src/s2/`)
- **Adapter**: `src/s1/adapter.ts` (ClaudeCodeAdapter)
- **Skills**: Triad skill at `~/.claude/skills/Triad/SKILL.md`
- **MCP**: observer-control-plane + ocp-scraper via `.mcp.json` at vault root
- **Session memory**: S2 subsystems active (capture, motif priming, salience, tensions)

### Codex CLI — Project Instructions + MCP
- **Project file**: `AGENTS.md` at vault root
- **MCP**: observer-control-plane + ocp-scraper via `~/.codex/config.toml`
- **Hooks**: None (adapter pending)
- **Skills**: None (Codex has no skill system)
- **Status**: Can read vault, follows governance, MCP tools available, no lifecycle integration

### OpenCode — Project Instructions + MCP
- **Project file**: `opencode.md` at vault root
- **MCP**: observer-control-plane + ocp-scraper via `opencode.json` at vault root
- **Hooks**: None (adapter pending)
- **Skills**: None
- **Status**: Can read vault, follows governance, MCP tools available, no lifecycle integration

### Gemini CLI — Project Instructions + MCP
- **Project file**: `GEMINI.md` at vault root
- **MCP**: observer-control-plane + ocp-scraper via `gemini mcp add` (project-level `.gemini/`)
- **Hooks**: None (adapter pending)
- **Skills**: None (Gemini has custom commands but no skill equivalent)
- **Status**: Can read vault, follows governance, MCP tools available, no lifecycle integration

## MCP Server Configuration

All CLIs are wired to the same two MCP servers:

| Server | Command | Purpose |
|--------|---------|---------|
| `observer-control-plane` | `node /opt/observer-system/scripts/mcp-bridge.mjs` | 12 tools: session/thread management, vault query, audit |
| `ocp-scraper` | `bun .../ocp-scraper/src/mcp/server.ts` | Scrape, search, inspect motif library records |

### Config Locations

| CLI | Config File | Format |
|-----|-------------|--------|
| Claude Code | `.mcp.json` (vault root) | JSON `mcpServers` object |
| Codex CLI | `~/.codex/config.toml` | TOML `[mcp_servers.*]` sections |
| OpenCode | `opencode.json` (vault root) | JSON `mcp` object with `"type": "local"` |
| Gemini CLI | `.gemini/settings.json` (project) | Added via `gemini mcp add` CLI command |

## S1 Adapter Interface Contract

The adapter interface at `src/s1/adapter.ts` defines what any CLI backend
must implement to get full Observer integration:

```typescript
interface HookAdapter {
  /** Convert a CLI-native event to an Observer event type. */
  translateEvent(cliEvent: unknown): ObserverEvent;

  /** Register for all relevant lifecycle events via the CLI's config mechanism. */
  registerHooks(config: HookRegistrationConfig): void;

  /** Return the NDJSON file path where translated events are written. */
  getEventStream(): string;
}
```

### Event Types to Translate

| Observer Event | Description |
|---------------|-------------|
| `ObserverSessionStart` | Session begins — triggers motif priming, context loading |
| `ObserverPreToolUse` | Before a tool executes — enables intervention |
| `ObserverPostToolUse` | After a tool executes — enables logging, salience marking |
| `ObserverSessionStop` | Session ends — triggers capture, summary, tension update |

### What a New Adapter Would Need

To build a Codex, OpenCode, or Gemini adapter:

1. **Map CLI lifecycle events** to the four Observer event types above
2. **Implement `translateEvent()`** — convert CLI-native JSON to `ObserverEvent`
3. **Implement `registerHooks()`** — register the adapter script in the CLI's config
4. **Write to NDJSON stream** — all translated events append to `tmp/events.ndjson`
5. **Fail-silent** — adapter errors must never break the underlying CLI session

The adapter is the ONLY component that knows about CLI specifics. Everything
above S1 (S2 session memory, S3 triad, S4 council) is CLI-agnostic.

### CLI Hook Mechanisms

| CLI | Hook System | Registration |
|-----|-------------|-------------|
| Claude Code | `settings.json` hooks array | JSON config at `~/.claude/settings.json` |
| Codex CLI | No native hooks | Would need wrapper script or plugin |
| OpenCode | TBD | Investigate plugin/extension API |
| Gemini CLI | Custom commands (`.gemini/commands/`) | Shell scripts in commands dir |
