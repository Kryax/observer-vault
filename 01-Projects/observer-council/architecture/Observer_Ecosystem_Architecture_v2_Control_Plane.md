# Observer Ecosystem — Unified Architecture with JSON-RPC Control Plane

**Version:** 2.0 (Control Plane Integration)
**Date:** 2026-02-18
**Status:** Architectural Proposal — No Implementation Yet
**Evolves From:** Observer Relay IDEAS_PACKET v1.0
**Author:** Adam (Observer) + Claude (Opus 4.6)

---

## 1. Architectural Overview

The Observer ecosystem is restructured around a single integration principle: **all interaction flows through a JSON-RPC control plane**. No external surface — Telegram, GUI, CLI, or future interface — ever communicates directly with the headless core. The control plane is the session bus, the policy gate, and the audit spine.

This is not a redesign. The existing systems (Observer governance, OIL integration, Atlas builder) remain architecturally intact. What changes is how they are accessed, controlled, and observed from the outside.

### Design Maxim

> The control plane does not think. It routes, enforces, and records.
> The headless core does not listen. It receives structured instructions and emits structured events.
> Clients do not decide. They request, display, and relay human decisions.

---

## 2. Layered Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│                   (Interaction Surfaces)                          │
│                                                                   │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌─────────────┐  │
│  │ Telegram   │  │ CLI       │  │ Future    │  │ Future      │  │
│  │ Comms      │  │ Operator  │  │ GUI /     │  │ Mobile      │  │
│  │ Client     │  │ Client    │  │ Build UI  │  │ App         │  │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └──────┬──────┘  │
│        │               │               │               │         │
└────────┼───────────────┼───────────────┼───────────────┼─────────┘
         │               │               │               │
    JSON-RPC         JSON-RPC        JSON-RPC        JSON-RPC
         │               │               │               │
┌────────┴───────────────┴───────────────┴───────────────┴─────────┐
│                                                                   │
│                     CONTROL PLANE                                 │
│                  (JSON-RPC Session Bus)                           │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                   Session Manager                         │    │
│  │          (threads, turns, items, lifecycle)                │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐      │
│  │ Policy       │  │ Approval     │  │ Audit             │      │
│  │ Enforcement  │  │ Gateway      │  │ Event Stream      │      │
│  │              │  │ (HITL)       │  │                   │      │
│  └──────────────┘  └──────────────┘  └───────────────────┘      │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                   Router / Dispatcher                     │    │
│  │        (maps requests to headless core services)          │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
└──────────────────────────────┬────────────────────────────────────┘
                               │
                          Internal API
                        (structured commands
                         + lifecycle events)
                               │
┌──────────────────────────────┴────────────────────────────────────┐
│                                                                    │
│                       HEADLESS CORE                                │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │                    Observer Governance                      │   │
│  │         (constitutional constraints, sovereignty            │   │
│  │          checks, Cynefin gates, drift detection)            │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │                    OIL Integration Layer                    │   │
│  │         (pipeline orchestration, context injection,         │   │
│  │          structured reflection, pre-mortem analysis)        │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │                    Atlas Builder                            │   │
│  │         (PRD generation, job packets, execution,            │   │
│  │          PAI skills, agent delegation)                      │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │                    LLM Execution Engines                    │   │
│  │         (OpenCode/ChatGPT Plus, Claude Code,                │   │
│  │          Codex CLI, Ollama — swappable backends)             │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │                    Vault I/O                                │   │
│  │         (read/write artifacts, relay-inbox,                 │   │
│  │          session logs, audit records — ZFS-backed)          │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 3. Control Plane — Detailed Design

The control plane is the central nervous system. It is NOT a simple tool server. It manages the full lifecycle of interactions between clients and the headless core.

### 3.1 Core Abstractions

The control plane operates with four primitives, inspired by the Codex App Server model but adapted to Observer's governance philosophy:

**Session**
A persistent context boundary. Each client connection establishes a session. Sessions carry identity, permissions, and thread history.

**Thread**
A unit of work within a session. A Telegram conversation about "brainstorm Observer v2 architecture" is a thread. A CLI command to "run pre-mortem on the relay design" is a thread. Threads have state: `open`, `awaiting_approval`, `executing`, `completed`, `failed`.

**Turn**
A request-response cycle within a thread. The client submits a turn (user message, command, approval response). The core processes and emits lifecycle events. A thread may contain many turns.

**Item**
A discrete event within a turn — a tool call, a file write, an approval request, a status update, an error. Items are the granular units that clients render and that the audit stream records.

### 3.2 Control Plane Responsibilities

| Responsibility | Description |
|---------------|-------------|
| **Session management** | Create, maintain, resume, close sessions per client |
| **Request validation** | Verify requests conform to schema before forwarding to core |
| **Policy enforcement** | Check requests against governance rules before execution |
| **Approval gateway** | Intercept operations requiring human consent, emit `approval.request`, wait for `approval.response` |
| **Routing** | Map validated requests to the correct headless core service (Observer, OIL, Atlas, Vault) |
| **Event streaming** | Emit structured lifecycle events back to clients in real time |
| **Audit recording** | Log every request, response, approval, and error to persistent audit trail |
| **Rate limiting** | Prevent runaway loops or excessive resource consumption |

### 3.3 JSON-RPC Protocol Shape (Conceptual)

Requests flow client → control plane:

```
→ session.create          { client_type, auth_token }
→ thread.create           { session_id, intent, context }
→ turn.submit             { thread_id, message }
→ approval.response       { item_id, decision: allow|deny, reason }
→ thread.status           { thread_id }
→ session.close           { session_id }
```

Events flow control plane → client:

```
← thread.started          { thread_id, status }
← turn.processing         { turn_id, phase }
← item.created            { item_id, type, content }
← approval.request        { item_id, description, risk_level }
← item.completed          { item_id, result }
← turn.completed          { turn_id, summary }
← thread.completed        { thread_id, artifacts[] }
← error                   { code, message, thread_id }
```

Events also flow to the audit stream unconditionally — clients may disconnect, but the record persists.

---

## 4. Client Layer — Thin and Interchangeable

Each client is a lightweight adapter. It translates between a human-friendly interface and the JSON-RPC protocol. Clients contain no business logic, no governance, and no direct LLM access.

### 4.1 Telegram Comms Client

**Role:** Mobile cognitive capture, brainstorming, idea externalization.

**Capabilities:**
- Receives voice/text messages from Adam
- Submits as `turn.submit` to control plane
- Renders streamed `item.created` events as Telegram messages
- Handles `approval.request` by presenting inline buttons (Allow / Deny)
- Maintains themed chats mapped to threads
- Writes nothing to Vault directly — all output flows through the core

**What it replaces:** The OpenClaw-style autonomous agent. Same surface, fundamentally different authority model.

### 4.2 CLI Operator Client

**Role:** Advanced operator access for direct system interaction.

**Capabilities:**
- Full JSON-RPC access with no abstraction
- Session resume, thread inspection, manual policy override
- Direct audit log query
- System health and diagnostics
- Suitable for SSH + Tailscale remote access from Termux

**When used:** When Adam is at his workstation or connected remotely with full terminal access.

### 4.3 Future GUI / Build Interface

**Role:** Visual software development control panel.

**Capabilities:**
- Define build templates and PRD parameters
- Configure sub-agent counts and model selection
- Select and dispatch job packets
- Monitor parallel build threads with visual status
- Review and approve tool operations through UI

**Architectural note:** The GUI is NOT the core. It submits `thread.create` with structured build instructions. Atlas processes them behind the control plane. The GUI renders the lifecycle events as a visual dashboard.

### 4.4 Future Mobile App

**Role:** Lightweight on-the-go interface beyond Telegram.

**Capabilities:**
- Simplified idea capture
- Approval handling for time-sensitive requests
- Notification stream from active threads

---

## 5. Headless Core — Unchanged Internals, New Interface

The headless core retains its existing architecture. Observer governs. OIL integrates. Atlas builds. What changes is the boundary: the core no longer accepts ad-hoc input from terminals, chat apps, or direct LLM sessions. It speaks only structured JSON-RPC commands received from the control plane, and emits only structured lifecycle events in return.

### 5.1 Observer Governance (Unchanged)

- Constitutional constraints
- Sovereignty checks
- Cynefin gate classification
- Drift detection and adversarial resistance
- Pre-mortem analysis
- Structured reflection artifacts

Observer governance logic now also informs the control plane's policy enforcement layer. Governance rules are defined in the core but evaluated at the control plane boundary — requests that violate constitutional constraints are rejected before they ever reach the core.

### 5.2 OIL Integration Layer (Unchanged)

- Pipeline orchestration
- Context injection from Vault
- Multi-step workflow management
- Structured reflection and feedback loops

### 5.3 Atlas Builder (Unchanged)

- PRD generation from IDEAS_PACKETs
- Job packet creation and execution
- PAI skills, hooks, and agent delegation
- Model-agnostic execution (OpenCode, Claude Code, Codex, Ollama)

### 5.4 LLM Execution Engines (Unchanged, Swappable)

LLM backends sit logically inside the headless core. The control plane never communicates with LLMs directly. Atlas or OIL invoke LLM calls as part of their internal workflows.

Current options:
- OpenCode `serve` (ChatGPT Plus subscription)
- Claude Code headless (Claude Max / API)
- Codex CLI `exec` (ChatGPT Plus subscription)
- Ollama (local, zero cost fallback)

The control plane is LLM-agnostic. It doesn't know or care which model is executing.

### 5.5 Vault I/O (Unchanged)

- ZFS-backed persistent storage
- Structured artifact output (IDEAS_PACKETs, research notes, digests)
- Session logs and audit records
- Relay-inbox for cross-system artifact transfer

---

## 6. Human-in-the-Loop via Approval Gateway

The approval gateway is where "AI articulates, humans decide" becomes a protocol-level guarantee rather than a philosophical aspiration.

### 6.1 How It Works

1. The headless core encounters an operation requiring human approval (defined by governance policy)
2. The core emits an `approval.request` event through the control plane
3. The control plane routes the request to the active client(s)
4. The client presents the approval prompt to the human (Telegram inline button, CLI prompt, GUI modal)
5. The human responds: `allow`, `deny`, or `deny_with_reason`
6. The client submits `approval.response` back through the control plane
7. The control plane forwards the decision to the core
8. The core proceeds or aborts accordingly
9. The entire exchange is recorded in the audit stream

### 6.2 Approval Tiers (Conceptual)

| Tier | Trigger | Example |
|------|---------|---------|
| **Auto-approve** | Read-only operations, status queries | "What's in my calendar?" |
| **Notify** | Low-risk writes, expected outputs | Writing an IDEAS_PACKET to Vault |
| **Approve** | Tool execution, external API calls | Sending an email, creating a calendar event |
| **Escalate** | System modification, multi-step chains | Installing a package, modifying a config file |
| **Block** | Governance violation, constitutional conflict | Attempting autonomous code execution without approval |

Tier definitions live in Observer governance. The control plane enforces them. Clients render them. The human decides.

### 6.3 Timeout Handling

If no human response arrives within a configurable window:
- Default action: **deny** (fail safe, not fail open)
- The thread enters `awaiting_approval` state indefinitely
- Client reconnection resurfaces pending approvals
- No operation proceeds without explicit human consent

---

## 7. Policy Enforcement Layer

Policy enforcement sits in the control plane, informed by Observer governance rules. It operates as a pre-execution filter.

### 7.1 Policy Check Flow

```
Client Request
     │
     ▼
┌──────────────┐
│ Schema       │──── Malformed? → reject with error
│ Validation   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Auth Check   │──── Unauthorized client? → reject
│              │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Policy       │──── Violates governance? → reject with reason
│ Evaluation   │──── Requires approval? → route to approval gateway
│              │──── Permitted? → forward to core
└──────┬───────┘
       │
       ▼
  Headless Core
```

### 7.2 Policy Examples

- **No code execution from Telegram client** — the comms layer is cognitive-only
- **No Vault writes without audit record** — every artifact must be logged
- **No external API calls without approval** — email, calendar, webhooks gated
- **No model switching without explicit request** — prevents unexpected cost
- **Rate limit on turns per hour** — prevents runaway agent loops
- **Thread timeout after inactivity** — prevents stale sessions consuming resources

---

## 8. Security Architecture

Security emerges from the layered separation, not from any single mechanism.

### 8.1 Separation of Concerns

| Layer | Trust Level | Can Do | Cannot Do |
|-------|------------|--------|-----------|
| **Client** | Untrusted | Submit requests, display responses, relay approvals | Execute tools, access Vault, invoke LLMs |
| **Control Plane** | Trusted boundary | Validate, route, enforce, audit | Think, generate, modify files |
| **Headless Core** | Trusted internal | Execute workflows, call LLMs, write artifacts | Listen to external networks, bypass policy |

### 8.2 Attack Surface Reduction

- Telegram client is internet-facing but has no authority — it can only submit JSON-RPC requests
- Control plane validates all inbound before forwarding — malformed or policy-violating requests never reach the core
- Headless core has no network listeners — it only processes commands from the control plane
- Prompt injection via Telegram is mitigated: user input is always wrapped as a `turn.submit` payload, never concatenated into system prompts at the control plane level
- Vault writes are mediated — no client can write directly to ZFS

### 8.3 VM Isolation (Unchanged)

- Observer Relay VM on Proxmox (clients + control plane)
- CachyOS VM (headless core + Atlas)
- ZFS shared mount for Vault I/O (one-way where possible)
- Tailscale for remote access, no public ports

---

## 9. Why JSON-RPC Improves Portability and Security

### Portability

JSON-RPC as the integration protocol means any new interface — a desktop app, a voice assistant, a web dashboard, a watch notification — only needs to implement the JSON-RPC client contract. It doesn't need to understand Observer governance, OIL pipelines, or Atlas build workflows. It just sends requests and renders events.

This makes the entire ecosystem tool-agnostic. If Daniel Miessler makes PAI CLI-agnostic, you're already there — the control plane doesn't care what's behind it. If you switch from OpenCode to Claude Code to Codex to a future tool that doesn't exist yet, no client changes are needed. The control plane abstracts the backend completely.

It also means the architecture survives vendor disruption. If Anthropic suspends your account again, or OpenAI changes their subscription model, or a new CLI tool emerges — only the LLM execution engine swaps. Everything else remains stable.

### Security

JSON-RPC enforces structured communication. Clients can't send arbitrary shell commands, inject prompts, or bypass approval flows because the protocol only accepts defined request types. The control plane validates every message against a schema before processing.

This is fundamentally more secure than the OpenClaw model where a messaging app has broad, loosely-defined access to an autonomous agent. In the Observer model, the messaging app has precisely defined, schema-validated, policy-gated access to a governed system.

The audit trail is also protocol-native. Every JSON-RPC exchange is structured data that can be logged, queried, and analysed without parsing free-text chat logs.

---

## 10. How Human-in-the-Loop Fits Naturally

The JSON-RPC model makes human-in-the-loop a first-class protocol feature rather than an afterthought.

In traditional agent systems, human approval is bolted on — the agent runs and occasionally pauses to ask permission. The approval mechanism is tied to whatever interface the agent happens to be running in (a terminal prompt, a web popup).

In the Observer control plane model, approval is a protocol primitive: `approval.request` and `approval.response` are JSON-RPC events like any other. This means:

- **Any client can handle approvals.** If you're at your desk, the CLI presents the prompt. If you're driving, Telegram shows an inline button. If you're using the future GUI, a modal appears. The approval travels to wherever you are.

- **Approvals are auditable.** Every request, every decision, every reason is structured data in the audit stream. You can review what you approved, when, and why.

- **Approvals are resumable.** If you disconnect, pending approvals wait. When you reconnect from any client, they resurface. No operation proceeds without your explicit consent.

- **Approval policy is configurable.** Observer governance defines what needs approval. The control plane enforces it. You can tighten or loosen the gates without changing any client code.

This is the architectural expression of "AI articulates, humans decide." The AI does its work inside the headless core. When it reaches a decision point, the control plane surfaces it to the human through whatever client is active. The human decides. The system proceeds. The record persists.

---

## 11. Migration Path from Current State

This architecture doesn't require a big-bang rebuild. It can be adopted incrementally:

**Phase 1: Current State (Now)**
Atlas/PAI runs in CachyOS terminal. Adam interacts directly via CLI. Ideas captured through Claude.ai chat + Obsidian Sync. No control plane yet.

**Phase 2: Minimal Control Plane**
Implement a basic JSON-RPC server that wraps Atlas. CLI client talks to it instead of directly to the terminal. Approval flow added for tool operations. Audit logging begins.

**Phase 3: Telegram Client**
Add the Telegram comms client as a second interface to the same control plane. Mobile capture enabled. Ideas flow through the control plane to Vault.

**Phase 4: Policy Enforcement**
Observer governance rules codified as control plane policies. Pre-execution checks automated. Approval tiers implemented.

**Phase 5: GUI Client**
Build interface added as a third client. Visual build management, job packet configuration, parallel thread monitoring.

Each phase adds capability without disrupting what already works.

---

## 12. Relationship to Existing Documents

This architecture evolves but does not replace:

| Document | Relationship |
|----------|-------------|
| **Observer Relay IDEAS_PACKET v1.0** | The comms layer concept is now a client behind the control plane |
| **OpenClaw Handoff Document** | OpenClaw's service connectors become client-layer adapters |
| **Observer Council Architecture** | Governance remains in the headless core, unchanged |
| **PAI Integration** | Atlas/PAI remains the builder, now accessed via control plane |
| **Vault Safety Headers** | Vault I/O now mediated by control plane audit |

---

*END OF ARCHITECTURE DOCUMENT*

*This document is intended for ingestion by Atlas/PAI for PRD generation.*
*Implementation decisions remain with Adam under Observer Council governance.*
