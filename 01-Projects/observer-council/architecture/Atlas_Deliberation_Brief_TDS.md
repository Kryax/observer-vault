
## Observer Ecosystem — Control Plane & Multi-Engine Orchestration

**Purpose:** This brief defines a multi-agent deliberation task for Atlas. Four specialised agents will collaborate to produce a Technical Design Specification document that bridges the existing architecture documents (vision-level) to a buildable PRD (implementation-level).

**Output:** A single Technical Design Specification document containing concrete stack decisions, project structure, component interfaces, data flow, security architecture, and testing strategy — sufficient for Atlas to generate a PRD with clean, parallelisable slices.

-----

## Context Documents

Atlas must ingest both of these documents before beginning deliberation:

1. **Observer Ecosystem — Unified Architecture with JSON-RPC Control Plane v2.0** (the control plane boundary architecture)
2. **Observer Ecosystem — Multi-Engine Execution Orchestration v1.0** (the dispatch layer and backend routing architecture)

These documents define WHAT is being built and WHY. This deliberation determines HOW it gets built.

-----

## Agent Roles

### Agent 1: Architect

**Role:** Propose concrete technical decisions that make the architecture implementable.

**Deliverables:**

- **Technology stack recommendation** — language, framework, JSON-RPC library, transport mechanism (HTTP, WebSocket, Unix socket, or combination). Consider that most CLI tools in the ecosystem are Node/npm-based. Consider Adam’s existing skills and the codebase context (OIL is shell scripts, PAI uses Claude Code/TypeScript).
- **Project structure** — directory layout, file organisation, where this lives relative to the existing workspace (`/mnt/Backup/ai-projects/code/observer-workspace/`) and Vault (`/mnt/Backup/ObserverCouncil/`).
- **Component breakdown** — each distinct module (session manager, policy enforcer, approval gateway, audit logger, router/dispatcher, execution dispatch layer, health monitor) with its file(s), entry point, and public interface.
- **Interface contracts** — the exact data structures passed between components. JSON schemas for: dispatch requests, dispatch results, session objects, thread objects, approval requests/responses, audit events. These must be concrete enough that two agents working on different components in parallel can integrate without rework.
- **Configuration file schemas** — the control plane config (server settings, policy rules, approval tiers) and the execution-backends.yaml (already sketched in the orchestration doc, needs finalising).
- **Dependency management** — what packages, what versions, how installed, how updated.
- **Entry points and lifecycle** — how the system starts, how it shuts down, how it recovers from crashes, how state is persisted or rebuilt.

**Constraints to respect:**

- PAI modularity — the dispatch layer must be a standalone module, not entangled with PAI internals
- The control plane is a separate service from Atlas — they communicate via defined interfaces
- Everything must be buildable in parallel slices with clear ISC exit criteria per slice
- Prefer simplicity over cleverness — Adam maintains this solo during night shifts

-----

### Agent 2: Operator

**Role:** Review all proposals from Adam’s operational perspective. Ensure everything works in his actual environment and daily workflow.

**Environment facts:**

- Arch Linux (Omarchy — Arch-based) as daily driver
- CachyOS VM on Proxmox for headless building (Atlas runs here)
- ZFS-backed storage for Vault
- Tailscale for remote access (no public ports)
- Access via SSH + Termux from phone during night shifts
- Claude Code Remote Control for approving prompts from mobile
- Night shift worker — needs things that are maintainable when returning after days away
- Solo developer — no team to hand off to or ask for help
- 64GB DDR4-3600 RAM, Ryzen 9 5950X, RX 6900 XT (plenty of local compute for Ollama)

**Review criteria:**

- Can Adam debug this at 2am on a phone via SSH?
- Can Adam understand what’s happening after a week away from the project?
- Is the cognitive load of operating this system reasonable for one person?
- Does the directory structure make intuitive sense?
- Are there too many moving parts? Can anything be simplified?
- Does the startup/shutdown process make sense for a home server that may reboot?
- Are the config files self-documenting enough to serve as operational manuals?
- Will log files and audit trails be useful or just noise?
- Does the technology choice fit Adam’s existing skill set (deep Linux/shell, growing Node/TS, strong Python)?

-----

### Agent 3: Sentry

**Role:** Adversarial architectural review. Find what breaks, what’s underspecified, what assumptions are unstated.

**Review criteria:**

- What happens when a backend CLI tool hangs and never returns? Is there a timeout?
- What happens when the JSON-RPC server crashes mid-session? Is state recoverable?
- What happens when Gemini CLI changes its output format between versions?
- What happens when two dispatch requests target the same file simultaneously?
- What happens when the routing config has an error? Does the system fail safe?
- What happens when all subscription backends are rate-limited? Does work queue or fail?
- What happens when Vault storage is full?
- What happens when a dispatch result is too large for the validation pipeline?
- Are there any circular dependencies between components?
- Are there any race conditions in the approval gateway (two clients responding to the same approval)?
- What single point of failure would take down the entire system?
- What assumptions about CLI tool behaviour are being made that aren’t guaranteed?
- Run a pre-mortem: “It’s 6 months from now and this project has failed. What went wrong?”

-----

### Agent 4: Security Auditor

**Role:** Dedicated security review of all attack surfaces, credential management, network exposure, and trust boundaries. This is NOT the same as the Sentry — the Sentry asks “what if this fails?” The Security Auditor asks “what if someone deliberately exploits this?”

**Critical context — lessons learned:**

- An API key was exposed in a terminal session during the OIL project. The key had to be burned and the voice server shut down. This MUST NOT happen again.
- The OpenClaw project (predecessor) gave a Telegram bot broad, loosely-defined access to an autonomous agent. The Observer architecture deliberately constrains this, but the control plane is still network-facing.
- Multiple external services will connect through the control plane: Telegram (internet-facing), potentially Discord, potentially email/Google Workspace.
- Adam accesses the system remotely via SSH + Tailscale from his phone. Remote access is a feature, not a bug, but it’s also an attack vector.

**Review criteria:**

- **Credential management:** How are API keys stored for each backend (Claude, OpenAI, Google, Ollama)? Where do they live on disk? Are they in environment variables, config files, a secrets manager? How are they rotated? What happens if one is compromised?
- **Network exposure:** What ports does the JSON-RPC server listen on? Is it localhost-only or network-accessible? How does Telegram connect — does the control plane expose a webhook (inbound from internet) or does it poll (outbound only)? What’s the firewall posture?
- **Authentication and authorisation:** How does a client prove it’s legitimate? API keys? Mutual TLS? Session tokens? What prevents a rogue client from connecting to the JSON-RPC server?
- **Input sanitisation:** Every message from Telegram is user input that could contain prompt injection, SQL injection, path traversal, or command injection. How is this sanitised at the control plane boundary? The architecture doc says “user input is always wrapped as a turn.submit payload, never concatenated into system prompts at the control plane level” — how is this enforced technically?
- **Transport security:** Is JSON-RPC traffic encrypted? Between which components? Is it necessary for localhost communication? What about Tailscale tunnels?
- **Secret leakage prevention:** How do we prevent backend CLI tools from logging API keys, tokens, or sensitive output to stdout/stderr that ends up in audit logs? How do we prevent dispatch results from containing credentials found in code?
- **Session security:** Can sessions be hijacked? Can a client impersonate another client? What’s the session token lifecycle?
- **Blast radius:** If the Telegram client is compromised, what’s the worst an attacker can do? If the control plane is compromised? If a backend CLI tool is compromised? Map the blast radius for each component.
- **Dependency supply chain:** Are there risks in the JSON-RPC library, transport layer, or other dependencies? How are dependencies audited?
- **Audit trail integrity:** Can audit logs be tampered with? Are they append-only? Are they stored separately from the components that generate them?
- **VM boundary enforcement:** The architecture specifies Observer Relay VM (clients + control plane) and CachyOS VM (headless core + Atlas). How is the boundary between these VMs enforced? What crosses it and how?

**Output format:** A threat model with identified risks, severity ratings, and concrete mitigations that the Architect must incorporate into the design.

-----

## Deliberation Workflow

1. **Architect** produces the initial Technical Design Specification draft
2. **Operator**, **Sentry**, and **Security Auditor** review in parallel, each producing their findings
3. **Architect** incorporates all feedback into a revised specification
4. **Atlas** produces a final synthesis document that includes:
- The revised Technical Design Specification
- An appendix with unresolved concerns or trade-offs requiring Adam’s decision
- A recommended slice breakdown for PRD generation (which components can be built in parallel, which have dependencies)

-----

## Output Format Requirements

The final document should include:

1. **Technology Stack** — language, framework, libraries, with rationale
2. **Project Structure** — directory tree with descriptions
3. **Component Specifications** — one section per component with:
- Purpose
- Public interface (function signatures or JSON-RPC methods)
- Data structures (JSON schemas)
- Dependencies on other components
- ISC exit criteria (what “done” looks like for this component)
1. **Configuration Schemas** — complete YAML schemas for all config files
2. **Security Architecture** — threat model, credential management, network posture, input sanitisation, blast radius analysis
3. **Testing Strategy** — unit test approach, integration test approach, smoke test script specification
4. **Deployment and Operations** — how to start, stop, monitor, debug, recover
5. **Slice Dependency Graph** — which components can be built in parallel, which must be sequential
6. **Open Questions** — decisions that require Adam’s input before implementation

-----

## Governance Reminders

- This deliberation operates under Observer Council governance
- All output is DRAFT until Adam reviews and approves
- No implementation decisions are final without human authority
- The principle “AI articulates, humans decide” applies — agents propose, Adam disposes
- Constitutional constraints from the Observer governance model apply to all recommendations
- The Security Auditor’s findings carry elevated weight — security mitigations are non-negotiable, not nice-to-haves

-----

## Success Criteria

The deliberation is successful if the output document is sufficient for Atlas to generate a PRD with:

- Clean, parallelisable slices (at least 4-5 that can run simultaneously)
- Clear ISC exit criteria per slice
- No ambiguous interface contracts between components
- No unstated assumptions about technology, environment, or behaviour
- Security mitigations baked into every component spec, not treated as a separate phase
- A realistic build estimate that Adam can plan around

-----

*This brief is authored by Adam (Observer) + Claude (Opus 4.6) on 2026-02-26 and is intended for Atlas/PAI ingestion alongside the two companion architecture documents.*