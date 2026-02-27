# IDEAS_PACKET: Observer Relay — Sovereign Communications Layer

**Author:** Adam (Observer) + Claude (Opus 4.6)
**Date:** 2026-02-18
**Status:** Draft for Atlas/PAI ingestion
**Sprint Context:** Adjacent to P1-013 — extends Observer Council with external cognitive capture

---

## 1. Executive Summary

**Observer Relay** is a sovereign, self-hosted communications and cognitive capture layer that replaces OpenClaw with a purpose-built system designed around the Observer Council philosophy: *"AI articulates, humans decide."*

It uses **OpenCode `serve`** as the LLM gateway (authenticated with ChatGPT Plus subscription — zero API cost), wraps it in a modular orchestration framework with service connectors (Telegram, email, Google, etc.), and outputs structured artifacts to the Vault for Atlas ingestion.

### One-Line Design Principle

> Observer Relay captures and structures. Atlas plans and builds. Observer Council governs. The human decides.

---

## 2. Problem Statement

- Ideas happen during commute, daily life, downtime
- Thoughts never make it into Vault
- Communication with Atlas is terminal-bound (requires sitting at CachyOS workstation)
- No frictionless external thinking layer exists
- OpenClaw solves this but introduces: philosophical misalignment, vendor dependency, excessive autonomy, security concerns, API costs

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    PROXMOX HOST                          │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │           OBSERVER RELAY VM (Ubuntu LTS)          │   │
│  │                                                    │   │
│  │  ┌─────────────┐    ┌──────────────────────┐     │   │
│  │  │ Orchestrator │───▶│  OpenCode `serve`    │     │   │
│  │  │  (Python)    │    │  (ChatGPT Plus auth) │     │   │
│  │  └──────┬──────┘    └──────────────────────┘     │   │
│  │         │                                          │   │
│  │    ┌────┴─────────────────────┐                   │   │
│  │    │    Service Connectors    │                   │   │
│  │    ├──────────┬───────────────┤                   │   │
│  │    │Telegram  │ Email (IMAP)  │                   │   │
│  │    │Google Cal│ Google Drive  │                   │   │
│  │    │Proton    │ Webhook API   │                   │   │
│  │    └──────────┴───────────────┘                   │   │
│  │         │                                          │   │
│  │    ┌────┴──────────┐   ┌─────────────┐           │   │
│  │    │ Cron Scheduler│   │ Security    │           │   │
│  │    │ (systemd/cron)│   │ Membrane    │           │   │
│  │    └───────────────┘   └─────────────┘           │   │
│  │         │                                          │   │
│  │    ┌────┴──────────┐                              │   │
│  │    │  Output Layer  │                              │   │
│  │    │  (ZFS mount)   │                              │   │
│  │    └───────────────┘                              │   │
│  └──────────────────────────────────────────────────┘   │
│                         │                                │
│                    ZFS shared mount                       │
│                         │                                │
│  ┌──────────────────────┴───────────────────────────┐   │
│  │              CachyOS VM (Atlas/PAI)               │   │
│  │                                                    │   │
│  │  Vault/relay-inbox/    ◄── Atlas monitors this    │   │
│  │    ├── ideas/                                      │   │
│  │    ├── research/                                   │   │
│  │    ├── digests/                                    │   │
│  │    └── drafts/                                     │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Core Components

### 4.1 LLM Gateway: OpenCode `serve`

- Runs as persistent headless server on the Relay VM
- Authenticated with ChatGPT Plus (subscription, not API)
- Orchestrator calls via `opencode run --attach http://localhost:4096 "prompt"`
- Session persistence across messages where needed
- No cold boot per message — server stays warm

### 4.2 Orchestrator (Python)

The central message router. Receives inbound from service connectors, constructs prompts with appropriate context, sends to OpenCode, routes responses back.

Core responsibilities:
- Message routing (inbound service → LLM → outbound service/vault)
- Context injection (which Vault documents are relevant to this query)
- Output formatting (raw LLM response → structured markdown)
- Session management (per-channel conversation threads)
- Rate limiting and cost awareness
- Logging all interactions to audit trail

### 4.3 Service Connectors (Modular)

Each connector is an independent Python module with a standard interface:

```python
class ServiceConnector:
    async def poll(self) -> list[InboundMessage]
    async def send(self, message: OutboundMessage) -> bool
    async def setup(self) -> bool
    async def healthcheck(self) -> bool
```

### 4.4 Cron / Scheduler

- systemd timers or Python `schedule` library
- Proactive tasks: daily digests, inbox summaries, reminder checks
- Periodic health checks on all connectors
- Scheduled research tasks

### 4.5 Output Layer

- Writes structured artifacts to ZFS-mounted `relay-inbox/` directory
- Atlas/PAI monitors this directory for new artifacts
- Subdirectories: `ideas/`, `research/`, `digests/`, `drafts/`
- All output is markdown with YAML frontmatter
- No binary files, no executables — text only

---

## 5. Service Connector Roadmap

### Phase 1: Foundation (Start Here)

| Service | Purpose | Library | Difficulty |
|---------|---------|---------|------------|
| **Telegram** | Primary mobile capture, voice-to-text ideas, themed chats | `python-telegram-bot` | Low |
| **File Writer** | Write IDEAS_PACKETs directly to Vault relay-inbox | stdlib `pathlib` | Trivial |

### Phase 2: Communication

| Service | Purpose | Library | Difficulty |
|---------|---------|---------|------------|
| **Email (IMAP/SMTP)** | Send/receive email via dedicated Relay address | `imaplib` / `smtplib` or `imap-tools` | Medium |
| **Proton Mail** | Privacy-focused email (if API accessible) | `proton-bridge` + IMAP | Medium |
| **Google Calendar** | Read/create events, daily schedule digest | `google-api-python-client` | Medium |

### Phase 3: Research & Knowledge

| Service | Purpose | Library | Difficulty |
|---------|---------|---------|------------|
| **Google Drive** | Read/write documents to dedicated drive | `google-api-python-client` | Medium |
| **Web Search** | Research capability (SearXNG self-hosted) | `httpx` to local SearXNG | Medium |
| **RSS Feeds** | Monitor tech news, project-relevant feeds | `feedparser` | Low |

### Phase 4: Advanced

| Service | Purpose | Library | Difficulty |
|---------|---------|---------|------------|
| **Webhook API** | Inbound triggers from external services | `fastapi` or `flask` | Medium |
| **Matrix/Signal** | Alternative secure messaging | `matrix-nio` / `signal-cli` | High |
| **Document Gen** | Create formatted docs (PDF, DOCX) | `markdown` + `pandoc` | Medium |

---

## 6. Dedicated Accounts (Security by Isolation)

**Critical principle: NO personal accounts connected.**

Every service gets its own dedicated account owned by the Relay:

| Service | Account | Notes |
|---------|---------|-------|
| Telegram | New bot via @BotFather | Bot token only, no phone number needed |
| Email | `relay@yourdomain.com` or new Proton account | Dedicated mailbox |
| Google | New Google Workspace or free account | Dedicated Drive, Calendar |
| SearXNG | Self-hosted instance | No account needed |

The human (Adam) interacts with the Relay via these dedicated channels.
The Relay interacts with Atlas via the Vault relay-inbox only.

---

## 7. Security Architecture: The Membrane

### 7.1 Design Philosophy

Observer Relay is treated as a **semi-trusted agent exposed to the internet**.
It has more privilege than untrusted input, less privilege than Atlas.

### 7.2 Isolation Layers

**Layer 1: VM Isolation**
- Dedicated Proxmox VM, separate from CachyOS/Atlas
- Own network interface, own firewall rules
- Can be snapshot/rolled back/destroyed without affecting Atlas

**Layer 2: Network Isolation**
- No inbound ports (Telegram uses polling, not webhooks)
- Outbound restricted to: OpenCode serve (localhost), Telegram API, Google APIs, email servers
- Firewall denies all other outbound by default
- No SSH from Relay to Atlas VM

**Layer 3: Filesystem Isolation**
- Relay VM has WRITE access to `relay-inbox/` only
- Relay VM has NO access to Vault proper, Observer workspace, or repos
- Atlas has READ access to `relay-inbox/`
- One-way data flow: Relay → inbox → Atlas

**Layer 4: Account Isolation**
- All service accounts are throwaway/dedicated
- No personal credentials on Relay VM
- No SSH keys to other systems
- ChatGPT Plus auth is the only "real" credential (revokable)

**Layer 5: Content Sanitisation**
- All inbound messages logged before processing
- Output artifacts are text-only markdown (no executable content)
- System prompt instructs LLM: no code execution, no shell commands, no file modification outside relay-inbox
- Relay has no `sudo`, no package install capability (immutable after setup)

### 7.3 Prompt Injection Mitigation

- Inbound messages from Telegram/email are wrapped in clear delimiters
- System prompt explicitly warns about injection attempts
- LLM output is validated: must conform to expected markdown structure
- Any output containing shell commands, URLs to unknown domains, or executable patterns is flagged and quarantined

### 7.4 Audit Trail

- Every interaction logged to `relay-inbox/audit/` with timestamp, source, prompt, response
- Daily digest of all Relay activity sent to Adam via Telegram
- Atlas can review audit logs during planning phase

---

## 8. Output Artifact Schema

### IDEAS_PACKET.md

```yaml
---
type: ideas_packet
source: relay/telegram
channel: observer-architecture    # which Telegram chat
timestamp: 2026-02-18T07:30:00+11:00
tags: [observer-council, architecture, v2-improvements]
priority: medium
status: raw                       # raw | expanded | reviewed
session_id: relay-sess-20260218-001
---

# Ideas Packet: [Title]

## Raw Capture
[Original voice-to-text or message content]

## Structured Summary
[LLM-structured version of the idea]

## Related Context
[Any research or connections the LLM identified]

## Suggested Actions
[What Atlas might do with this — suggestions only, not instructions]

## Open Questions
[Things that need human decision before proceeding]
```

### RESEARCH_NOTE.md

```yaml
---
type: research_note
source: relay/cron
trigger: scheduled_research
timestamp: 2026-02-18T08:00:00+11:00
tags: [research, tooling]
---

# Research: [Topic]

## Summary
## Key Findings
## Relevance to Observer Project
## Sources
```

### DAILY_DIGEST.md

```yaml
---
type: daily_digest
source: relay/cron
timestamp: 2026-02-18T20:00:00+11:00
---

# Daily Digest: 2026-02-18

## Relay Activity Summary
## Ideas Captured Today
## Pending Items Requiring Human Decision
## Calendar Tomorrow
## Inbox Summary
```

---

## 9. What Observer Relay Must NEVER Do

Inherited from OpenClaw handoff document, reinforced:

- **Never** execute code or shell commands
- **Never** modify files outside `relay-inbox/`
- **Never** access Atlas workspace, repos, or Vault directly
- **Never** install packages or modify its own system
- **Never** make autonomous decisions — only suggest
- **Never** send messages to anyone other than Adam's dedicated channels
- **Never** store credentials in plain text
- **Never** create PRDs or job packets (that's Atlas's job)

---

## 10. Comparison: Observer Relay vs OpenClaw

| Aspect | OpenClaw | Observer Relay |
|--------|----------|----------------|
| Philosophy | "No limits, no gatekeepers" | "AI articulates, humans decide" |
| LLM Backend | API keys ($$) | ChatGPT Plus subscription ($0 extra) |
| Autonomy | Full autonomous agent | Constrained cognitive assistant |
| Code Execution | Yes | Never |
| Service Integration | Built-in, broad | Modular, add-as-needed |
| Security Model | Trust-the-user | Trust boundaries enforced |
| Output | Direct actions | Structured artifacts to inbox |
| Governance | None built-in | Observer Council principles |
| Vendor Lock-in | OpenClaw framework | Your code, your rules |

---

## 11. Suggested Initial Test Services

For the first working prototype, these three services give the LLM enough capability to be genuinely useful while keeping scope manageable:

### 1. Telegram (Primary Interface)
- Voice-to-text capture during commute
- Multiple themed chats (architecture, ideas, research, personal)
- Quick commands: `/capture`, `/research`, `/digest`
- The LLM's "face" — this is how Adam talks to the Relay

### 2. Email (Outbound Only Initially)
- Relay can send formatted summaries to Adam's personal email
- Daily digest delivery
- Later: inbound email processing for forwarded articles/notes

### 3. File Writer (Vault Inbox)
- Every meaningful interaction writes to `relay-inbox/`
- IDEAS_PACKETs, research notes, digests
- This is the actual production output — everything else is interface

These three give you: mobile capture (Telegram), async delivery (email), and persistent output (files). That's a complete cognitive capture loop.

---

## 12. Implementation Approach

### Skeleton First

Build the framework/skeleton with clean interfaces before any service implementation:

```
observer-relay/
├── relay.py                  # Main entry point / daemon
├── config.yaml               # All configuration
├── orchestrator/
│   ├── __init__.py
│   ├── router.py             # Message routing logic
│   ├── context.py            # Context injection for prompts
│   └── session.py            # Conversation session management
├── connectors/
│   ├── __init__.py
│   ├── base.py               # ServiceConnector abstract class
│   ├── telegram_connector.py
│   ├── email_connector.py
│   └── file_writer.py
├── security/
│   ├── __init__.py
│   ├── membrane.py           # Input sanitisation
│   ├── audit.py              # Logging and audit trail
│   └── validator.py          # Output validation
├── scheduler/
│   ├── __init__.py
│   └── cron.py               # Scheduled tasks
├── templates/
│   ├── ideas_packet.md
│   ├── research_note.md
│   └── daily_digest.md
└── tests/
    └── ...
```

### Build Order

1. **Skeleton + Config** — project structure, config loading, logging
2. **OpenCode Gateway** — connect to `opencode serve`, send/receive
3. **File Writer Connector** — output to relay-inbox (proves the pipeline)
4. **Telegram Connector** — mobile capture (proves the interface)
5. **Security Membrane** — input sanitisation, output validation, audit
6. **Scheduler** — cron jobs, daily digests
7. **Email Connector** — async delivery
8. **Additional services** — as needed

---

## 13. Open Questions for Human Decision

1. **Naming:** Is "Observer Relay" the right name, or something else?
2. **VM Resources:** How much RAM/CPU to allocate on Proxmox?
3. **OpenCode vs Claude Code:** Final decision on which CLI backend? (Recommendation: OpenCode for ChatGPT Plus, but worth testing both)
4. **Local model fallback:** Should Relay fall back to Ollama if OpenCode/ChatGPT is unavailable?
5. **Vault inbox location:** Exact ZFS path for `relay-inbox/`?
6. **Telegram bot personality:** Should the Relay have a name/persona, or be neutral?
7. **Atlas monitoring:** How should Atlas discover new items in relay-inbox? Poll? inotify? Manual trigger?

---

## 14. Relationship to Observer Council

Observer Relay operates OUTSIDE the Observer Council governance boundary.
It is a **peripheral input device**, not a governed agent.

```
                    ┌──────────────────────┐
                    │   Observer Council    │
                    │   (Governance)        │
  ┌──────────┐     │                       │
  │ Observer  │────▶│  Atlas    Builder    │
  │ Relay     │     │  (PAI)   (Executor)  │
  │ (Outside) │     │                       │
  └──────────┘     └──────────────────────┘
       │                      ▲
       └── relay-inbox/ ──────┘
           (text artifacts only)
```

The Relay feeds Atlas. It does not instruct Atlas.
Atlas decides what to do with Relay output.
Observer Council governs Atlas, not the Relay.

The Relay is governed by its own simpler constraints:
- VM isolation
- Security membrane
- Output-only filesystem access
- No execution capability

---

*END OF IDEAS_PACKET*

*This document is intended for ingestion by Atlas/PAI as planning context.*
*PRD generation and implementation decisions remain with Atlas under Observer Council governance.*
