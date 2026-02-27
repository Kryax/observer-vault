

Execution Orchestration

Companion to: Unified Architecture with JSON-RPC Control Plane (v2.0)

Version 1.0 (Initial Specification)

Date 2026-02-26

Status Architectural Proposal — No Implementation Yet

Companion To Observer Ecosystem — Unified Architecture with JSON-RPC Control Plane v2.0

Author Adam (Observer) + Claude (Opus 4.6)1. Purpose and Scope

The JSON-RPC Control Plane architecture (v2.0) defines how clients interact with the headless core

through a governed session bus. That document treats the headless core's internal execution as a

single box labelled "LLM Execution Engines" with a note that backends are swappable.

This companion document opens that box. It specifies how Atlas — the builder and orchestrator

within the headless core — dispatches work to multiple CLI-based execution backends, how routing

decisions are made, how results are validated regardless of source, and how this capability is

accessed through the existing control plane without any changes to the client layer or governance

model.

The two documents together form a complete specification: the control plane document describes

the boundary (how the outside talks to the inside), and this document describes the engine room

(how the inside actually gets work done).

Design Maxim

The orchestration layer does not think. It dispatches, collects, and returns. Atlas thinks — it

plans, decomposes, and validates. The control plane governs — it enforces policy and

records decisions. Each layer has one job.

2. Architectural Position

This layer sits entirely within the headless core, below Atlas and above the actual CLI tool

invocations. The control plane never interacts with it directly. Clients never know it exists. From the

control plane's perspective, Atlas received a request and returned results — the internal routing is

invisible.

■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■

■ HEADLESS CORE ■

■ ■

■ ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ ■

■ ■ Atlas Builder ■ ■

■ ■ (planning, decomposition, PRD, ISC criteria) ■ ■

■ ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ ■

■ ■ ■

■ dispatch request ■

■ (slice + target + criteria) ■

■ ■ ■

■ ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ ■

■ ■ Execution Dispatch Layer ■ ■

■ ■ (routing config, backend profiles, mode selection) ■ ■

■ ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ ■

■ ■ ■ ■ ■ ■ ■

■ ■■■■■■■■ ■■■■■■■■ ■■■■■■■■ ■■■■■■■■ ■■■■■■■■■■■■■■■■ ■

■ ■Claude■ ■Gemini■ ■Codex ■ ■Ollama■ ■OpenCode/ ■ ■

■ ■Code ■ ■CLI ■ ■CLI ■ ■ ■ ■Free Models ■ ■

■ ■■■■■■■■ ■■■■■■■■ ■■■■■■■■ ■■■■■■■■ ■■■■■■■■■■■■■■■■ ■

■ ■ ■ ■ ■ ■ ■

■ ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ ■

■ ■ ■

■ structured results ■

■ ■ ■

■ ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ ■

■ ■ OIL Validation Layer ■ ■

■ ■ (ISC checks, TruffleHog, governance validation, ■ ■■ ■ exit artifacts, receipts) ■ ■

■ ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ ■

■ ■

■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■

Key principle: nothing above the Execution Dispatch Layer changes. The control plane, client layer,

approval gateway, policy enforcement, and audit stream all operate exactly as specified in the v2.0

architecture document. Nothing below the OIL Validation Layer changes either — the backends are

standard CLI tools invoked with standard commands. This layer is pure insertion.

3. Execution Dispatch Layer — Detailed Design

The Execution Dispatch Layer is a standalone module that accepts structured dispatch requests

from Atlas and routes them to the appropriate CLI backend. It is not entangled with PAI internals. If

PAI is replaced by a future orchestrator, this layer survives — the interface is the contract, not the

caller.

3.1 Core Responsibilities

Responsibility Description

Backend registry Maintain a list of available execution backends with their capabilities, cost profiles, and Dispatch routing Accept a slice from Atlas with optional target preference and route it to the appropriate health status

backend based

Mode selection Determine whether routing is human-specified, config-recommended, or council-deliberated

Invocation Shell out to the target CLI tool with the structured slice payload, capture output

Result collection Receive structured results from the backend and return them to Atlas for OIL validation

Health monitoring Track backend availability, response times, and failure rates to inform routing decisions

Cost tracking Log token usage and cost per backend per dispatch for budget awareness

3.2 What This Layer Does NOT Do

• It does not validate results — OIL handles that

• It does not plan or decompose work — Atlas handles that

• It does not enforce governance policy — the control plane handles that

• It does not communicate with clients — the control plane handles that

• It does not make autonomous decisions about what to build — the human decides

This separation is critical. The dispatch layer is plumbing. It connects Atlas's intent to execution

backends and returns results. Every other concern belongs to another layer.

4. Execution Backends — Profiles

Each backend is a CLI tool that can receive a task description and return code, analysis, or artifacts.

Backends are not just different models — they are different capability ecosystems. Each brings its

own plugin systems, integrations, and operational characteristics.4.1 Claude Code

Property Detail

Command claude

Models Claude Opus 4.6, Claude Sonnet 4.5

Subscription Claude Max ($100-200/month)

Strengths Deep code reasoning, MCP server integration, Remote Control, multi-file refactoring, strong architectural un

Ecosystem MCP servers, PAI skills/hooks, VS Code extension, headless mode, git worktree awareness

Best for Complex implementation, large-scale refactoring, architectural decisions, code review requiring deep contex

Limitations Subscription cost, rate limits under heavy parallel use

4.2 Gemini CLI

Property Detail

Command gemini

Models Gemini 3 Pro, Gemini 3 Flash

Subscription Free with Google account (60 req/min, 1000/day)

Strengths Google Search grounding, Google Drive access, multimodal input, free tier, agent skills system

Ecosystem IDE integration (Antigravity, VS Code), Gemini CLI Companion extension, Google Workspace access

Best for Research and search-grounded tasks, architecture review, Google ecosystem integration, low-cost explorat

Limitations Less proven for complex multi-file code generation, Google ecosystem dependency

4.3 Codex CLI

Property Detail

Command codex

Models GPT-5.3-Codex, GPT-5.3-Codex-Spark

Subscription ChatGPT Plus/Pro

Strengths Code quality focus, bubblewrap sandbox isolation on Linux, multi-agent collaboration, web search, code rev

Ecosystem MCP servers, agent skills, Codex Cloud (async web tasks), VS Code extension, configurable approval mode

Best for Code review, security audit, sandboxed execution, tasks requiring strict isolation

Limitations Desktop app macOS-only (no Linux yet), newer tool with less community maturity

4.4 Ollama (Local)Property Detail

Command ollama run <model>

Models Llama, Mistral, CodeLlama, Qwen, DeepSeek, community models

Subscription Free — runs locally, zero cost

Strengths Complete privacy, no network dependency, zero token cost, full sovereignty

Ecosystem OpenAI-compatible API, broad model library, community quantisations

Best for Drafts, low-stakes generation, privacy-sensitive tasks, offline fallback, experimentation

Limitations Limited by local hardware (CPU/GPU), smaller context windows, lower quality than frontier models

4.5 OpenCode / Free Model Gateway

Property Detail

Command opencode (via OpenRouter or direct)

Models GLM-5, Qwen, Mistral, and whatever is free on OpenRouter at any given time

Subscription Free (model availability rotates)

Strengths Zero cost, access to diverse model families, good for comparative testing

Ecosystem OpenRouter API, model switching, community integrations

Best for Bulk low-stakes work, initial drafts, summarisation, tasks where cost matters more than peak quality

Limitations Model availability changes, quality varies, rate limits on free tiers, no guaranteed consistency

The backend registry is designed to grow. Future CLI tools — whether from existing vendors or new

entrants — slot in by adding a profile to the routing config. No code changes required in Atlas, the

dispatch layer, or the control plane.

5. Dispatch Modes

The dispatch layer supports three modes of operation. These are not competing approaches — they

serve different purposes and will be built in phases, each independently useful.

5.1 Mode 1 — Human Specifies (Direct Dispatch)

Adam explicitly tells Atlas which backend to use for a given slice or task. Atlas presents the

decomposed slices, Adam annotates each with a target backend, and the dispatch layer routes

accordingly.

Interaction pattern (CLI):

Atlas: Decomposed into 4 slices:

[1] Frontmatter validator [2] Folder-tier checker [3] Promotion workflow modal [4] Archival read-only guard → target? claude-code

→ target? claude-code

→ target? gemini

→ target? codexAdam: Confirmed. Dispatch.

Atlas: Dispatching 4 slices to 3 backends...

This mode is essential during the early phase when Adam is building intuition about what each

backend actually delivers. The surveyor takes his own measurements before trusting the map. This

mode is always available as an override regardless of what other modes exist.

5.2 Mode 2 — Atlas Recommends (Config-Driven Dispatch)

Atlas reads a routing configuration file that maps task types to preferred backends. When

decomposing work, Atlas pre-fills backend assignments based on config rules and presents the plan

to Adam for approval. Adam can approve the batch or override specific assignments.

Interaction pattern (CLI):

Atlas: Decomposed into 4 slices (config-recommended targets):

[1] Frontmatter validator → claude-code (implementation)

[2] Folder-tier checker → claude-code (implementation)

[3] Architecture review → gemini (architecture-review)

[4] Security audit → codex (security-audit)

Override any? [y/N]: N

Atlas: Dispatching with recommended targets...

The routing config is a YAML file — the single source of truth for backend preferences. It is

human-readable, version-controlled, and editable. When Adam returns to the project after time

away, the config file immediately shows: here are my tools, here is what they are good at, here is

how they are being used.

This mode integrates naturally with the control plane's existing approval gateway. Backend

recommendations are presented as a lightweight approval — no new mechanism required.

5.3 Mode 3 — Council Deliberation (Multi-Dispatch)

The same prompt is sent to multiple backends simultaneously. Results are collected and presented

together for synthesis. This mode is explicitly invoked by Adam — it is never automatic, because it is

expensive (tokens, time, complexity) and only justified for high-stakes decisions.

Interaction pattern (CLI):

Adam: Council review this architecture approach.

Atlas: Dispatching to 3 backends for council deliberation...

[Claude Code] responding... done (42s)

[Gemini CLI] responding... done (38s)

[Codex CLI] responding... done (55s)

Atlas: Three perspectives received.

[1] View Claude Code response

[2] View Gemini CLI response

[3] View Codex CLI response

[4] View Atlas synthesis

[5] Approve synthesis / Override

Synthesis can be human-led (Adam reads all three and decides) or Atlas-drafted (Atlas produces a

synthesis document that Adam approves or rejects). The council pattern implements the "multiple

independent measurement sources" methodology — the same approach Adam applies as a

surveyor, now applied to AI-generated analysis.Council use cases:

• Foundational architecture decisions where perspective diversity matters

• Risk assessment where different models may identify different failure modes

• PRD review where multiple viewpoints improve completeness

• Dispute resolution when a single model's output seems uncertain

6. Routing Configuration

The routing config is a YAML file that defines available backends, their capabilities, cost profiles,

and default routing rules. It is read by the dispatch layer at invocation time. It is the operational

documentation for the multi-engine setup — when Adam needs to remember what tools are

available and how they are configured, this file is the answer.

6.1 Configuration Schema

# execution-backends.yaml

# Observer Ecosystem — Execution Backend Routing Configuration

# Read by: Execution Dispatch Layer

# Edited by: Adam (human authority)

routing_mode: recommend council_quorum: 3 default_backend: claude-code

cost_awareness: true # specify | recommend | council

# backends required for council mode

# log cost per dispatch

backends:

claude-code:

command: claude

enabled: true

cost: subscription strengths:

- implementation

- refactoring

- deep-reasoning

- multi-file-operations

default_for:

- code-generation

- bug-fixing

- complex-refactoring

health_check: claude --version

# subscription | free | per-token

gemini-cli:

command: gemini

enabled: true

cost: free

strengths:

- architecture-review

- search-grounding

- research

- google-ecosystem

default_for:

- architecture-review

- research

- exploration

health_check: gemini --versioncodex-cli:

command: codex

enabled: true

cost: subscription

strengths:

- code-quality

- security-audit

- sandboxed-execution

default_for:

- code-review

- security-audit

health_check: codex --version

ollama:

command: ollama run

enabled: true

cost: free

model: llama3.1:70b

strengths:

- local-execution

- privacy

- zero-cost

default_for:

- drafts

- low-stakes-generation

- offline-fallback

health_check: ollama list

opencode-free:

command: opencode

enabled: true

cost: free

strengths:

- zero-cost

- model-diversity

default_for:

- bulk-drafts

- summarisation

health_check: opencode --version

notes: Model availability rotates. Check current free models.

6.2 Configuration Principles

• Human-edited only. Atlas reads this file but never writes to it. Routing preferences are a

human decision, not an AI optimisation target.

• Version-controlled. Changes to routing config are tracked in git. You can see when and why

a backend was added, removed, or re-prioritised.

• Self-documenting. The config file is the operational manual. No separate documentation

needed to understand what backends are available.

• Fail-safe defaults. If a preferred backend is unavailable, the dispatch layer falls back to the

default_backend, never silently drops the task.

7. Dispatch Request Protocol

Atlas communicates with the dispatch layer through structured dispatch requests. These are internal

to the headless core — they never cross the control plane boundary.7.1 Dispatch Request Shape

{

"dispatch_id": "d-20260226-001",

"mode": "recommend",

"slice": {

"id": "slice-03",

"description": "Implement frontmatter validation for Vault documents",

"type": "code-generation",

"context_files": ["vault-governance.yaml", "SKILL.md"],

"isc_criteria": {

"tests_pass": true,

"no_secrets": true,

"lint_clean": true

}

},

"target_override": null,

"recommended_backend": "claude-code",

"recommended_reason": "code-generation maps to claude-code in config"

}

7.2 Dispatch Result Shape

{

"dispatch_id": "d-20260226-001",

"backend_used": "claude-code",

"model_used": "claude-opus-4-6",

"execution_time_seconds": 47,

"tokens_used": 12840,

"cost_estimate": "subscription",

"status": "completed",

"artifacts": [

{

"path": "src/frontmatter-validator.ts",

"type": "code",

"hash": "sha256:abc123..."

}

],

"stdout_log": "...",

"validation_pending": true

}

The result is handed to OIL for validation. The dispatch layer does not assess quality. It reports what

happened and what was produced. OIL determines whether the output meets ISC criteria.

8. Validation Flow — Backend-Agnostic Governance

Every dispatch result passes through the same OIL validation pipeline regardless of which backend

produced it. This is the architectural guarantee that governance is not bypassed by backend

selection. A slice processed by Gemini CLI receives the same scrutiny as one processed by Claude

Code.

8.1 Validation Pipeline

Dispatch Result

■

▼

■■■■■■■■■■■■■■■■■ ISC Check ■ (per-slice) ■

■■■■■■■■■■■■■■■■

■■■ Criteria not met? → reject, log, optionally retry

■

▼

■■■■■■■■■■■■■■■■

■ TruffleHog ■■■ Secrets detected? → reject, alert

■ Scan ■

■■■■■■■■■■■■■■■■

■

▼

■■■■■■■■■■■■■■■■

■ Governance ■■■ Constitutional violation? → reject with reason

■ Validation ■

■■■■■■■■■■■■■■■■

■

▼

■■■■■■■■■■■■■■■■

■ Exit ■■■ Generate exit artifact with backend attribution

■ Artifact ■

■■■■■■■■■■■■■■■■

■

▼

■■■■■■■■■■■■■■■■

■ Receipt ■■■ Record dispatch_id, backend, model, cost, result

■ Generation ■

■■■■■■■■■■■■■■■■

8.2 Retry on Failure

When validation fails, Atlas has several options — all requiring human awareness:

• Retry same backend: Resubmit the slice with additional context about the failure. Useful

when the failure was a near-miss (e.g., lint issues, minor test failures).

• Retry different backend: Route the failed slice to an alternative backend. Useful when the

failure suggests the backend is unsuitable for the task type.

• Escalate to human: Present the failure to Adam for manual intervention. Default for

governance violations or repeated failures.

• Abort: Cancel the slice and record the failure. The thread continues with remaining slices.

Retry policy is configurable per-backend and per-task-type in the routing config. The default is: one

automatic retry on the same backend, then escalate to human.

9. PAI Modularity Guarantee

The OIL integration was built with Option B — PAI as the current execution engine, but designed so

PAI can be swapped out. The Execution Dispatch Layer extends this same principle.

The dispatch layer is a standalone module. It accepts structured dispatch requests and returns

structured results. PAI calls it today. A future orchestrator calls it tomorrow. The interface contract

does not reference PAI internals, PAI configuration, or PAI-specific concepts.

Concretely, this means:

• The dispatch layer is a separate script or service, not embedded in PAI's codebase• It reads its own configuration file (execution-backends.yaml), not PAI's config

• Its input/output format is a defined JSON schema, not PAI function signatures

• It has no import dependencies on PAI libraries or modules

• If PAI is replaced, only the caller changes — the dispatch layer, routing config, backend

profiles, and validation pipeline all survive intact

Modularity Principle

The dispatch layer knows how to reach backends. Atlas knows what to ask them. OIL

knows how to validate their output. None of these components know about each other's

internals. They communicate through defined interfaces.

10. Cost Optimisation Through Routing

A significant practical benefit of multi-engine dispatch is the ability to route work based on cost-value

tradeoffs. Not every task requires a frontier model. The routing config enables a deliberate strategy

where subscription tokens are preserved for high-value work and free models absorb the bulk of

routine tasks.

10.1 Cost Tiers

Tier Backends Use For

Free Gemini CLI, Ollama, OpenCode/free models (GLM, Qwen, etc.) Drafts, exploration, summarisation, research, bulk generation, expe

Subscription Claude Code, Codex CLI Complex implementation, security-critical code, deep reasoning, fin

Multi (Council) Any combination High-stakes architecture decisions, foundational design choices (us

10.2 Free Model Rotation Strategy

OpenRouter and similar platforms regularly rotate which models are available at no cost. GLM-5,

Qwen variants, Mistral models, and others cycle through free availability. The routing config

accommodates this with the opencode-free backend profile and a notes field reminding the operator

to check current availability.

This is not a reliability concern — free models are used for tasks where quality variation is

acceptable. If a free model produces subpar output, OIL validation catches it and the slice is retried

on a more capable backend. The cost savings on successful free-model dispatches fund the

occasional retry on a subscription model.

11. Security Considerations

Multi-engine dispatch introduces new trust boundaries that must be explicitly addressed.

11.1 Backend Trust Model

Backend Trust Level Data Exposure Mitigation

Claude Code High (Anthropic) Code sent to Anthropic API Existing relationship, Max subscriptionBackend Trust Level Data Exposure Mitigation

Gemini CLI Medium (Google)Code sent to Google API Review what is sent, avoid sensitive IP in research tasks

Codex CLI Medium (OpenAI)Code sent to OpenAI API Sandbox isolation, review dispatched content

Ollama Full (local) Nothing leaves the machineNone required — fully sovereign

OpenCode/free Variable Code sent to third-party APIs Use only for non-sensitive tasks, never for proprietary code

11.2 Sensitive Task Routing Policy

The routing config should include a sensitivity field that prevents certain task types from being

dispatched to lower-trust backends. For example:

• Proprietary business logic → Claude Code or Ollama only

• Security-critical authentication code → Claude Code or Codex only

• Public-facing documentation → any backend

• Internal architecture discussions → Claude Code or Ollama only

This is a governance concern that Observer's constitutional constraints can enforce. The dispatch

layer checks the sensitivity classification before routing.

12. Phased Implementation

Each phase is independently useful. No phase depends on future phases to deliver value.

Phase Delivers Prerequisites Complexity

Phase 1:

Atlas shells out to a specified CLI backend on Adam's instruction. Manual backend selection per slice. CLI tools installed (Claude Code, Gemini CLI, Codex CLI). Basic Direct Dispatch

(Mode 1)

dispatch script. Low — wrapper script that invokes CLI tools with

Phase 2:

execution-backends.yaml created. Atlas reads config and recommends backends. Approval integration for batch d Phase 1 complete. Config file schema defined. Medium — config parser, recommendation logic

Routing Config

(Mode 2)

Phase 3:

Parallel dispatch to multiple backends. Result collection and side-by-side presentation. Optional Atlas synthesis. Phase 2 complete. Parallel execution capability. Higher — parallel invocation, result aggregation,

Council Mode

(Mode 3)

Phase 4:

Cost & Health

Tracking

Token usage logging per dispatch. Backend health monitoring. Cost-per-task reporting. Phase 2 complete. Medium — logging infrastructure, health check in

Phase 5:

Sensitivity classification in config. Automatic enforcement of trust-based routing restrictions. Phase 2 complete. Sensitivity policy defined. Low-Medium — policy check added to dispatch l

Sensitivity

Routing

13. Relationship to Existing Documents

This document is a companion to, not a replacement for, the existing architecture specifications.Document Relationship

Observer Ecosystem — JSON-RPC OIL Integration Layer Observer Council Architecture PAI Integration Vault Safety Headers Control Plane v2.0 Parent document. Defines the boundary this document operates within. The "LLM Execution En

OIL validates all dispatch results. This document's validation pipeline (Section 8) feeds directly

Governance constraints inform the policy evaluation that occurs before dispatch and the validat

PAI/Atlas is the current caller of the dispatch layer. The modularity guarantee (Section 9) ensur

The dispatch lay

Dispatch results that produce Vault artifacts still require proper safety headers. 14. Installation Reference

For convenience, the installation commands for each execution backend on Arch Linux (Adam's

primary environment):

14.1 Claude Code

npm install -g @anthropic-ai/claude-code

claude # authenticate with Claude Max account

14.2 Gemini CLI

npm install -g @google/gemini-cli

gemini # authenticate with Google account

14.3 Codex CLI

npm install -g @openai/codex

codex # authenticate with ChatGPT account

14.4 Ollama

# Available in official Arch repos or AUR

pacman -S ollama

# or

yay -S ollama-bin

ollama pull llama3.1:70b # or preferred model

14.5 Google Antigravity IDE (Optional GUI)

# AUR package

yay -S antigravity

# Wayland fix if needed:

antigravity --ozone-platform-hint=auto

14.6 OpenCode

# Check current installation method at opencode.ai

# Model availability on OpenRouter rotates — verify free models before routingEND OF ARCHITECTURE DOCUMENT

This document is intended for ingestion by Atlas/PAI for implementation planning. Implementation decisions

remain with Adam under Observer Council governance.