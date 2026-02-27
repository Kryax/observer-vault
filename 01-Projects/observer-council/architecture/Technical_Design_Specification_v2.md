# Technical Design Specification: Observer Control Plane & Multi-Engine Orchestration

**Version:** 2.0
**Date:** 2026-02-26
**Status:** DRAFT — Governance review pending (Observer Council); v2 incorporates multi-agent review findings
**Authors:** Atlas (Opus 4.6) — synthesized from multi-agent deliberation
**Human Authority:** Adam (Observer)

**Companion Documents:**
- Observer Ecosystem Architecture v2.0 (JSON-RPC Control Plane)
- Observer Ecosystem Multi-Engine Execution Orchestration v1.0
- Observer Security Governance Framework v1.1
- Atlas Deliberation Brief — Technical Design Specification

**Deliberation Participants:**
| Agent | Role | Key Contributions |
|-------|------|-------------------|
| Architect | Technical design lead | Full 9-section TDS draft, 28 TypeScript interfaces, credential isolation spec |
| Operator | Operational review | Monorepo decision, dir flattening, Node.js-only runtime, RUNBOOK requirement |
| Sentry | Adversarial review | 13 failure modes, process kill chain, orphan recovery, approval dedup |
| Security Auditor | Security review | 16 threats, 6 NNFs, blast radius analysis, governance invariant compliance |

**Governance Notice:** This document is DRAFT output from a multi-agent deliberation. All technical decisions, architecture choices, and implementation priorities require Adam's explicit review and approval before implementation begins. Per Observer Council governance: *"AI articulates, humans decide."*

<!-- [v2: CHANGED] Added v2 Changes summary section -->

### v2 Changes Summary

This version incorporates findings from a four-agent multi-agent review (Architect, Operator, Sentry, Security Auditor). Changes span all sections and fall into the following categories:

- **Section 1 (Technology Stack):** Arch/CachyOS Node.js installation note; better-sqlite3 supply chain warning
- **Section 3 (Component Specifications):** 14 interface contract gap fixes (Gaps 1-14); new subsection 3i (Cross-VM Internal Protocol); SEC fixes for timing-safe comparison, auth rate limiting, TOCTOU mitigation; audit logger async SQLite writes; health monitor standardization
- **Section 4 (Configuration Schemas):** Core timeout fix (300s to 1260s); sensitivity section optionality; prerequisite comments; approval_channels Phase 2 note
- **Section 5 (Security Architecture):** 3 new threats (T17-T19); 2 new NNFs (NNF-7, NNF-8); credential detection encoding passes; audit deadlock prevention; JSONL integrity protection; blast radius expansion; Telegram structural enforcement
- **Section 6 (Testing Strategy):** vitest replaces bun test; cross-VM sanitization test; Session Store persistence test
- **Section 7 (Deployment & Operations):** Node.js version management; provision-secrets.sh bash fix; systemd unit hardening; shutdown pending approval handling; cross-VM debugging; startup grace period; operational script fixes; token rotation rewrite
- **Section 8 (Slice Dependency Graph):** Timeline revised to 8-10 weeks; S2 critical path; config reload ISC criterion removed
- **Section 9 (Open Questions):** Q7 (single-VM collapse) and Q8 (cross-VM auth strategy) added

---


## 1. Technology Stack

### 1.1 Language: TypeScript (strict mode)

**Rationale:** TypeScript is the natural choice for three convergent reasons:

1. **Ecosystem alignment.** Every CLI tool in the execution backend ecosystem (Claude Code, Gemini CLI, Codex CLI) is an npm-based Node tool. The control plane orchestrates these tools. Writing it in the same runtime eliminates impedance mismatch -- child process management, IPC patterns, and error handling all follow Node conventions that are well-documented.

2. **Adam's trajectory.** PAI already uses TypeScript via Claude Code. OIL is shell scripts -- this project is the natural evolution point where structured TypeScript replaces shell orchestration. Adam has growing Node/TS experience; this project deepens it in a domain he controls.

3. **Type safety for interfaces.** The control plane is fundamentally about interface contracts -- JSON-RPC schemas, dispatch requests, session objects, approval payloads. TypeScript's type system turns these contracts into compile-time guarantees. A malformed dispatch request is caught before it reaches the router, not at runtime in a Python dict.

**Strict mode configuration:**
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "sourceMap": true
  }
}
```

### 1.2 Runtime: Node.js 22 LTS (exclusively)

**Rationale:** Node.js 22 LTS is the sole runtime for both development and production. No Bun split.

Node.js LTS offers:
- Battle-tested `child_process` and stream handling for CLI tool orchestration
- Mature signal handling for graceful shutdown
- Proven stability for long-running server processes
- Broader ecosystem compatibility with JSON-RPC libraries
- `node --inspect` and `journalctl` for production debugging at 2am
- Largest ecosystem of Stack Overflow answers and battle-tested patterns

**No Bun.** The original proposal suggested Bun for dev tooling and Node for production. This is rejected per Operator review: a split personality means Adam needs to know when to use `node` vs `bun`, which config files each respects, and what happens when they behave differently. For a solo operator building this system for the first time, one runtime for everything. Node 22 with `tsx` for development TypeScript execution is sufficient. If Adam later decides Bun is better, it is a swap, not a migration.

<!-- [v2: CHANGED] Added Arch/CachyOS Node.js installation note -->
**Arch/CachyOS Note:** Arch Linux ships rolling-release Node.js via `pacman` (typically current, not LTS). Install Node 22 LTS via `fnm` or the `nodejs-lts-jod` AUR package. Update systemd `ExecStart` path accordingly. Verify with `node --version` before first build.

**Development workflow:**
- `tsx` for running TypeScript directly during development
- `tsc` for compilation to JavaScript for production
- `node dist/server.js` for production execution
- Node's built-in test runner or `vitest` for testing

### 1.3 Package Manager: npm

**Rationale:** npm ships with Node.js. No additional installation. Workspaces support for the monorepo. Deterministic resolution via `package-lock.json`. One runtime, one package manager, one set of config files. `npm install` for dependencies, `npm test` for tests, `npm run build` for compilation.

**Dependency pinning:** All dependencies pinned to exact versions in `package-lock.json`. Run `npm audit` periodically. Pin exact versions in `package.json` (no `^` or `~` prefixes) for production dependencies.

### 1.4 JSON-RPC Library: jayson

**Rationale after evaluating options:**

| Library | Transport | Maturity | TypeScript | Verdict |
|---------|-----------|----------|------------|---------|
| `jayson` | HTTP, TCP, middleware | 10+ years, battle-tested | Good TS support | **Selected** |
| `json-rpc-2.0` | Transport-agnostic | Newer, clean API | Native TS | Runner-up |
| `vscode-jsonrpc` | Stream-based | VS Code proven | Excellent TS | Overkill for our use |
| Custom | Any | None | Full control | Unnecessary risk |

`jayson` is selected because:
- It provides its own HTTP server -- no Express, no Fastify, no framework overhead
- Middleware pattern allows inserting policy enforcement, auth, and audit logging as composable layers
- Proven at scale, actively maintained, minimal dependencies
- The server exposes an HTTP endpoint from a single process

**Alternative consideration:** `json-rpc-2.0` is transport-agnostic (you bring your own transport), which gives maximum flexibility. If during implementation jayson's transport coupling becomes limiting, this is the fallback. The component architecture isolates the transport layer so switching costs are contained.

### 1.5 Transport Mechanism: HTTP only (Phase 1)

**Design:**

- **HTTP (JSON-RPC over POST)** -- for all request-response methods: `session.create`, `thread.create`, `turn.submit`, `approval.respond`, `thread.status`, `session.close`, `health.status`, `audit.query`. CLI client uses this exclusively. Simple, stateless per-request, works perfectly over SSH/Tailscale. Debuggable with `curl` from a phone at 2am.

- **No WebSocket in Phase 1.** The original proposal included WebSocket for streaming events. Per Operator review, this is deferred. HTTP with polling (or SSE in a later phase) achieves the same result with less code. WebSocket adds connection state management, reconnection logic, and heartbeat handling. Add WebSocket when the Telegram client or GUI client actually needs real-time streaming. Phase 1 clients can poll `thread.status` and `audit.query` for updates.

- **Binding: localhost only (127.0.0.1).** The control plane never binds to an external interface. Clients on the same VM connect directly. Remote access comes through Tailscale (which presents as a local interface) or SSH port forwarding. This is a structural security boundary per Governance Framework Invariant 2.

- **Port: 9000.** Non-conflicting with common dev tool ports (3000, 8080, 8000, etc.).

**Why not Unix sockets?** They would work for same-VM communication and are slightly faster, but they complicate remote access patterns (SSH forwarding to Unix sockets requires `socat` wrapping). HTTP over localhost is simple, debuggable with `curl`, and works identically whether Adam is local or remote via Tailscale. The marginal performance gain of Unix sockets is irrelevant for the traffic volumes here.

### 1.6 Key Dependencies

| Package | Purpose | Version Strategy |
|---------|---------|-----------------|
| `jayson` | JSON-RPC server (includes HTTP server) | Pin exact |
| `zod` | Runtime schema validation + type inference | Pin exact |
| `better-sqlite3` | Audit log and session persistence | Pin exact |
| `pino` | Structured JSON logging | Pin exact |
| `yaml` | Config file parsing | Pin exact |
| `nanoid` | ID generation (session, thread, turn, item, dispatch) | Pin exact |
| `tsx` | TypeScript execution for development (dev dependency) | Pin exact |

<!-- [v2: CHANGED] Added supply chain note for better-sqlite3 (T17) -->
**Supply chain note (T17):** `better-sqlite3` compiles native C++ bindings at install time. Always install with `npm ci` (not `npm install`) to enforce lockfile integrity. Never run `npm install` as the service user -- use a separate build step without access to `/run/secrets/`. See Section 5 T17.

**Dependency philosophy:** Minimal dependencies. Each serves one purpose. No frameworks (no Express, no Fastify) -- jayson provides its own HTTP server. No ORMs -- SQLite queries are direct. The control plane is small enough that framework overhead is pure cost. Every dependency is a thing that can break at 3am and require Adam to read someone else's changelog.

**Operator endorsement:** "Strongly approved. jayson for JSON-RPC and Zod for validation are small, focused libraries. better-sqlite3 is a single file database with zero daemon overhead. This is the right instinct for a solo operator."

**Zod for validation:** Every JSON-RPC request is validated against a Zod schema at the boundary. This replaces hand-written validation and provides TypeScript type inference from the same schema definition. One source of truth for both runtime validation and compile-time types.

**Supply chain notes (from Security Auditor):**
- `jayson`: 300K+ weekly npm downloads, moderate risk, single author. Monitor for ownership transfers.
- `zod`: Very widely used, active maintenance. Low risk.
- `better-sqlite3`: Contains native C++ bindings compiled at install time. Highest supply chain risk of the group. Pin exact versions, run `npm audit` periodically. Consider `--ignore-scripts` and pre-building native addons in a controlled environment if risk tolerance tightens.

---

## 2. Project Directory Structure

### 2.1 Monorepo Layout

The Observer system is a single monorepo using npm workspaces:

```
observer-system/
  package.json                    # Workspace root (npm workspaces)
  tsconfig.base.json              # Shared TS config
  CLAUDE.md                       # Session context for Atlas/Claude Code
  RUNBOOK.md                      # Operational manual (2am reference)
  packages/
    control-plane/                # JSON-RPC control plane server
    dispatch/                     # Execution dispatch layer (standalone)
    shared/                       # Types and schemas used by both
  scripts/
    recent-activity.sh            # "What happened since I was last here?"
```

**Rationale (from Operator review):** The original proposal called for two separate git repositories (`control-plane/` and `dispatch/`). This is rejected. Adam is one person. Two repos means two sets of commits, two sets of branches, two places to run `git status`, two sets of version coordination. When the control plane interface changes, he needs to update both repos in lockstep. If he comes back after a week, he needs to remember "which repo was I working in?"

Single monorepo with workspace-style package layout. One git history. One branch. One place to look. Shared types (like dispatch request/result schemas) live in `packages/shared/` and are imported by both packages. One `git log` shows the full history.

### 2.2 Control Plane Package

```
packages/control-plane/
  package.json
  tsconfig.json
  config/
    control-plane.yaml              # Server settings, policy rules, approval tiers
    control-plane.example.yaml      # Documented example (committed to git)
  src/
    server/
      server.ts                     # Entry point -- starts HTTP, wires components
      shutdown.ts                   # Graceful shutdown handler
      http-handler.ts               # HTTP JSON-RPC request handling
      auth.ts                       # Client authentication middleware
    session/
      session-manager.ts            # Session CRUD, thread lifecycle, state machine
      session-store.ts              # SQLite-backed session persistence
    policy/
      policy-enforcer.ts            # Evaluates requests against governance rules
      policy-rules.ts               # Rule definitions loaded from config
      approval-gateway.ts           # HITL approval request/response lifecycle
      approval-store.ts             # Pending approval persistence
    audit/
      audit-logger.ts               # Event stream recording
      audit-store.ts                # JSONL primary + SQLite index storage
      audit-sanitizer.ts            # Dual-layer credential scrubbing
    types.ts                        # Re-exports from shared + control-plane-specific types
    schemas.ts                      # Zod schemas for all JSON-RPC methods + config
    router.ts                       # Maps validated requests to headless core
    health.ts                       # Backend and core availability tracking
    errors.ts                       # Structured error codes and messages
    ids.ts                          # ID generation (nanoid-based)
  test/
    unit/                           # Per-component unit tests
    integration/                    # Multi-component integration tests
    fixtures/                       # Test data and mock configs
  scripts/
    start.sh                        # Production start script
    health-check.sh                 # Quick health verification
    status.sh                       # System status dashboard
  data/
    .gitkeep                        # SQLite databases live here (gitignored)
```

**Flattened structure rationale (from Operator review):** The original proposal had ~25 source files across 8 directories (`types/`, `schemas/`, `session/`, `policy/`, `approval/`, `audit/`, `router/`, `transport/`, `health/`, `lib/`). That is too many context switches for a sleep-deprived solo operator navigating from a phone. The flattened layout has ~15 files across 4 directories (`server/`, `session/`, `policy/`, `audit/`) plus ~6 top-level files. Each directory maps to a concept Adam can name in one word. `ls src/` shows a scannable list.

Key merge decisions:
- `approval/` merged into `policy/` -- approvals are a consequence of policy decisions, same mental domain
- `transport/` and `server.ts` and `shutdown.ts` merged into `server/` -- all server lifecycle code
- `router.ts`, `health.ts`, `errors.ts`, `ids.ts` promoted to top-level `src/` files -- they are small, single-file concerns
- `types/` and `schemas/` collapsed to single files -- `types.ts` and `schemas.ts` at `src/` root
- `lib/` directory eliminated -- its contents (`id.ts`, `errors.ts`, `clock.ts`) either merged into `ids.ts`/`errors.ts` or inlined

### 2.3 Dispatch Package

```
packages/dispatch/
  package.json
  tsconfig.json
  config/
    execution-backends.yaml         # Backend registry and routing config
    execution-backends.example.yaml # Documented example (committed)
  src/
    dispatch.ts                     # Entry point -- standalone dispatch module
    backend-registry.ts             # Loads and manages backend profiles
    backend-executor.ts             # Shells out to CLI tools, captures output
    health-checker.ts               # Periodic backend health checks
    sensitivity-filter.ts           # Prevents sensitive tasks reaching untrusted backends
    output-parser.ts                # Parses structured output from backends
    cost-tracker.ts                 # Token usage and cost logging
    types.ts                        # Re-exports from shared + dispatch-specific types
    schemas.ts                      # Zod schemas for dispatch protocol + config
  test/
    unit/
    integration/
    fixtures/
  scripts/
    health-check.sh                 # Backend availability check
```

**~10 files, flat layout.** No subdirectories under `src/` -- the dispatch layer is simple enough that a flat list is immediately scannable.

### 2.4 Shared Package

```
packages/shared/
  package.json
  tsconfig.json
  src/
    types.ts                        # Session, Thread, Turn, Item, Dispatch types
    schemas.ts                      # Shared Zod schemas
    errors.ts                       # Shared error codes
    ids.ts                          # ID generation utilities
    clock.ts                        # Monotonic timestamp utility
  index.ts                          # Re-exports everything
```

**Purpose:** Types and utilities used by both `control-plane` and `dispatch`. Prevents duplication and ensures both packages agree on data structures. This is the "shared contract" that the original two-repo design would have required cross-repo coordination to maintain.

### 2.5 Root Files

```
observer-system/
  package.json                      # npm workspaces: ["packages/*"]
  tsconfig.base.json                # Shared compiler options (extended by each package)
  CLAUDE.md                         # Atlas session context
  RUNBOOK.md                        # Operational manual
  scripts/
    recent-activity.sh              # Query audit DB for recent activity
```

**RUNBOOK.md (from Operator review):** Adam needs a single file he can open at 2am that tells him:
- How to check if everything is running: exact commands
- How to restart a specific service: exact commands
- How to read recent logs: exact commands
- How to check what went wrong: exact commands
- How to manually submit a request: exact curl command
- How to check Tailscale connectivity: exact commands

This is the operational manual for the sleep-deprived solo operator. Not a README, not docs spread across directories -- one file.

**recent-activity.sh (from Operator review):** Adam comes back after days away. "What happened since Tuesday?"

```bash
./scripts/recent-activity.sh          # last 24 hours
./scripts/recent-activity.sh 3d       # last 3 days
```

Queries the audit SQLite index and summarizes recent activity.

### 2.6 What Lives Where (Two-VM Split)

| Component | VM | Rationale |
|-----------|-----|-----------|
| Control Plane server | Observer Relay VM (Proxmox) | Faces clients, enforces policy |
| Telegram client | Observer Relay VM (Proxmox) | Internet-facing, same VM as control plane |
| CLI client | Either VM (via Tailscale) | Adam connects from wherever |
| Dispatch Layer | CachyOS VM | Lives with Atlas and CLI backends |
| CLI backends (Claude Code, etc.) | CachyOS VM | Builder tools live with builder |
| Audit logs | Observer Relay VM | With control plane, ZFS-backed |
| Dispatch logs | CachyOS VM | With dispatch layer |

**Cross-VM communication:** The control plane's Router component communicates with the CachyOS headless core over HTTP via Tailscale internal network. This is the only cross-VM boundary. It uses the same JSON-RPC protocol but with a separate internal method namespace.

**Sentry note on cross-VM timeouts:** The cross-VM HTTP timeout must be >= the maximum dispatch timeout + validation overhead. If the control plane times out at 5 minutes while a 15-minute dispatch is running on CachyOS, the control plane reports failure while the backend continues. The next retry dispatches again and two backends work the same task.

**Operator note on Tailscale reliability:** Tailscale is generally reliable but is a network hop. Explicit connection health checking, timeout + retry with clear error messages ("dispatch backend unreachable" not cryptic ECONNREFUSED), and Tailscale status as part of health checks. Decision: dispatch down = system down (for Phase 1 simplicity).

---

## 3. Component Specifications

### 3a. JSON-RPC Server (Transport + Protocol Handling)

**Purpose:** Accept client connections over HTTP, deserialize JSON-RPC requests, dispatch to the appropriate handler, and return responses. This is the outer shell -- it handles bytes and connections, nothing more.

**Phase scope:** Phase 1 is HTTP-only. WebSocket transport is deferred until a client requires real-time streaming (Telegram relay or GUI).

**Public Interface:**

```typescript
// HTTP endpoint
POST /rpc HTTP/1.1
Content-Type: application/json

// JSON-RPC 2.0 request
{
  "jsonrpc": "2.0",
  "method": "session.create",
  "params": { ... },
  "id": 1
}
```

<!-- [v2: CHANGED] Added Attachment type definition (Gap 1 fix) -->
**Shared Type Definitions:**

```typescript
interface Attachment {
  id: string;
  type: "text" | "file_ref" | "voice_transcript" | "image_ref";
  filename?: string;
  mime_type?: string;
  content: string;
  size_bytes?: number;
  sanitized: boolean;  // Must be true before any persistence
  contains_sensitive: boolean;  // Pre-scanned for credential patterns
}
```

<!-- [v2: CHANGED] Added ClientType type alias (Gap 2 fix) -->
```typescript
type ClientType = "cli" | "telegram" | "gui" | "internal";
```

<!-- [v2: CHANGED] Added ApprovalDecision input type (Gap 8 fix) -->
```typescript
interface ApprovalDecision {
  decision: "approved" | "denied";
  reason?: string;
}
```

<!-- [v2: CHANGED] Added ObserverErrorData discriminated union (Gap 12 fix) -->
```typescript
type ObserverErrorData =
  | { type: "policy_denied"; rule_id: string; reason: string }
  | { type: "rate_limited"; retry_after_seconds: number }
  | { type: "backend_unavailable"; backend: string; health_state: BackendHealthState }
  | { type: "backend_auth_failure"; message: "Backend authentication failed — check backend credentials" }
  | { type: "approval_timeout"; approval_id: string; timeout_seconds: number }
  | { type: "validation_failed"; field: string; message: string }
  | { type: "session_not_found"; session_id: string }
  | { type: "thread_not_found"; thread_id: string };
```

Note: error `message` field MUST be hardcoded control-plane-generated strings or sanitized. Never raw backend output.

**JSON-RPC Methods (client-to-server):**

<!-- [v2: CHANGED] Removed auth_token from session.create params (Gap 3 fix). Auth is via HTTP Authorization: Bearer header only. -->

| Method | Params | Result | Auth Required |
|--------|--------|--------|---------------|
| `session.create` | `{ client_type: ClientType, client_id: string }` | `{ session_id, created_at }` | Yes |
| `session.close` | `{ session_id }` | `{ closed: true }` | Yes |
| `session.resume` | `{ session_id }` | `SessionResumeResult` | Yes |
| `thread.create` | `{ session_id, intent, context?, metadata? }` | `{ thread_id, status }` | Yes |
| `thread.status` | `{ thread_id }` | `{ thread_id, status, turns[], pending_approvals[] }` | Yes |
| `thread.cancel` | `{ thread_id }` | `{ cancelled: true }` | Yes |
| `turn.submit` | `{ thread_id, message, attachments? }` | `{ turn_id, status }` | Yes |
| `approval.respond` | `{ approval_id, decision: ApprovalDecision }` | `{ acknowledged: true }` | Yes |
| `health.status` | `{}` | `{ server, backends{}, uptime }` | No |
| `audit.query` | `AuditFilter` | `AuditQueryResult` | Yes |
| `admin.revoke_token` | `{ token_hash: string }` | `{ revoked: boolean, active_tokens: number }` | Yes (CLI-only) |

<!-- [v2: CHANGED] Added admin.revoke_token method for surgical token revocation (Operator cross-challenge resolution). Scoped to token state only — not general config hot-reload. CLI-only authentication required. Revocation list is ephemeral (lost on restart, which is acceptable since restart loads new token from config). -->

<!-- [v2: CHANGED] Added development guideline for logging (Gap 3 fix) -->
**Development Guideline:** No middleware or logging configuration shall log raw HTTP headers. The pino request serializer is the ONLY authorized request logging path.

<!-- [v2: CHANGED] Added SessionResumeResult type (Gap 11 fix) -->
```typescript
interface SessionResumeResult {
  session_id: string;
  threads: Array<{
    thread_id: string;
    intent: string;
    status: ThreadStatus;
    updated_at: string;
  }>;
  pending_approvals: PendingApproval[];
}
```

<!-- [v2: CHANGED] Added pagination to AuditQueryResult (Gap 9 fix) -->
```typescript
interface AuditQueryResult {
  events: AuditEvent[];
  total_count: number;
  has_more: boolean;
  next_cursor?: string;
}
interface AuditFilter {
  session_id?: string;
  thread_id?: string;
  category?: AuditCategory;
  since?: string;            // ISO 8601
  until?: string;            // ISO 8601
  limit?: number;            // Default 100, max 1000
  cursor?: string;
}
```

**Policy rule for internal client type:** The `internal` client type is used for cross-VM communication from the headless core. Policy rules should allow `internal` clients to access system methods but restrict them from user-facing operations.

**Key Data Structures:**

```typescript
// JSON-RPC Error Codes (extending standard -32000 range)
enum ObserverErrorCode {
  // Standard JSON-RPC
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,

  // Observer-specific
  AuthRequired = -32000,
  AuthFailed = -32001,
  SessionNotFound = -32002,
  ThreadNotFound = -32003,
  PolicyDenied = -32004,
  ApprovalTimeout = -32005,
  BackendUnavailable = -32006,
  RateLimited = -32007,
  ValidationFailed = -32008,
  ApprovalAlreadyResolved = -32009,
  ConfigInvalid = -32010,
}
```

**Dependencies:** `jayson`, `zod`, auth module, all downstream components.

**Security Considerations:**
- HTTP server binds to `127.0.0.1` only -- never `0.0.0.0`. This is set in server configuration and verified at startup with an assertion. Defense-in-depth: OS-level firewall (iptables/nftables) rules blocking non-Tailscale inbound connections reinforce the application-level binding.
- All request params are validated against Zod schemas before any processing. Malformed requests are rejected with `InvalidParams`.
- Request size limit of 1MB to prevent memory exhaustion. Configurable but defaults conservative.
- Rate limiting per session: configurable requests/minute, default 60.
- Unicode normalization (NFC) applied to all string inputs to prevent homograph and encoding attacks.
- Config validated against Zod schema at startup. If validation fails, server refuses to start with a clear error message identifying the exact problem. A `--validate-config` CLI flag checks config without starting the server.

<!-- [v2: CHANGED] Added timing-safe token comparison requirement (SEC-3 fix) -->
**auth.ts specification:** All token comparisons MUST use `crypto.timingSafeEqual()`. Standard string equality (`===`) leaks timing information.

<!-- [v2: CHANGED] Added authentication failure rate limiting (SEC-5 fix) -->
**Authentication failure rate limiting:** Rate limit failed authentication attempts: 10 failures per minute per source IP, exponential backoff. Applied at HTTP handler layer BEFORE JSON-RPC routing. Lockout after 50 consecutive failures with audit trail entry.

**ISC Exit Criteria:**
- Server starts and binds to configured localhost port (9000)
- Startup assertion fails if bind address is not 127.0.0.1
- Accepts valid JSON-RPC requests and returns correct responses
- Rejects malformed requests with appropriate error codes
- Health endpoint responds without authentication
- Server shuts down gracefully on SIGTERM (completes in-flight requests, closes connections)
- Config validation rejects invalid YAML with clear error messages
- `--validate-config` flag works without starting the server

### 3b. Session Manager

**Purpose:** Manages the lifecycle of sessions, threads, turns, and items. Maintains the state machine that governs how work flows through the system. This is the core data model of the control plane.

**Phase scope:** Phase 1 implements Session + Thread + Turn. The Item type is defined in the shared types package for forward compatibility but is not actively managed in Phase 1. Items will be introduced when multi-step dispatch and streaming require granular sub-turn tracking.

**Public Interface:**

```typescript
interface SessionManager {
  // Session lifecycle
  createSession(clientType: ClientType, clientId: string): Promise<Session>;
  getSession(sessionId: string): Promise<Session | null>;
  resumeSession(sessionId: string): Promise<Session>;
  closeSession(sessionId: string): Promise<void>;

  // Thread lifecycle
  createThread(sessionId: string, intent: string, context?: Record<string, unknown>): Promise<Thread>;
  getThread(threadId: string): Promise<Thread | null>;
  updateThreadStatus(threadId: string, status: ThreadStatus): Promise<void>;
  cancelThread(threadId: string): Promise<void>;

  // Turn lifecycle
  createTurn(threadId: string, message: string, attachments?: Attachment[]): Promise<Turn>;
  completeTurn(turnId: string, summary: string): Promise<void>;

  // Item lifecycle (Phase 2+)
  createItem(turnId: string, type: ItemType, content: unknown): Promise<Item>;
  completeItem(itemId: string, result: unknown): Promise<void>;
}
```

**Key Data Structures (full model defined in shared types, Phase 1 active types noted):**

```typescript
// --- PHASE 1: Active ---

interface Session {
  id: string;              // "ses_" + nanoid(12)
  client_type: "cli" | "telegram" | "gui" | "internal";
  client_id: string;       // Client-provided identifier
  created_at: string;      // ISO 8601
  last_active_at: string;  // ISO 8601, updated on every turn
  status: "active" | "idle" | "closed";
  thread_ids: string[];
}

interface Thread {
  id: string;              // "thr_" + nanoid(12)
  session_id: string;
  intent: string;          // Human-readable description of what this thread is doing
  // [v2: CHANGED] Added intent_type field (Gap 5 fix)
  intent_type: IntentType;
  status: ThreadStatus;
  created_at: string;
  updated_at: string;
  turn_ids: string[];
  metadata: Record<string, unknown>;
}

type ThreadStatus =
  | "open"               // Created, awaiting first turn
  | "processing"         // Turn being processed by core
  | "awaiting_approval"  // Blocked on human decision
  | "executing"          // Core is executing work
  | "completed"          // All work done successfully
  | "failed"             // Terminal error
  | "cancelled"          // Cancelled by user
  | "interrupted";       // Server crashed mid-processing (Sentry addition)

interface Turn {
  id: string;              // "trn_" + nanoid(12)
  thread_id: string;
  message: string;
  attachments: Attachment[];
  status: "submitted" | "processing" | "completed" | "failed";
  created_at: string;
  completed_at: string | null;
  item_ids: string[];      // Empty in Phase 1
}

// --- PHASE 2+: Defined but not actively managed ---

interface Item {
  id: string;              // "itm_" + nanoid(12)
  turn_id: string;
  type: ItemType;
  content: unknown;        // Type-dependent payload
  result: unknown | null;
  status: "pending" | "active" | "completed" | "failed";
  created_at: string;
  completed_at: string | null;
}

type ItemType =
  | "message"            // Text response from core
  | "tool_call"          // Tool invocation
  | "file_write"         // File creation/modification
  | "approval_request"   // HITL approval needed
  | "dispatch"           // Sent to execution dispatch layer
  | "status_update"      // Progress information
  | "error";             // Error detail
```

<!-- [v2: CHANGED] Added ThreadEvent type with discriminated union (Gap 4 fix) -->
**Thread Events:**

```typescript
interface ThreadEvent {
  event_type: "thread.started" | "turn.processing" | "item.created" | "approval.request" | "item.completed" | "turn.completed" | "thread.completed" | "thread.error";
  timestamp: string;
  thread_id: string;
  turn_id?: string;
  item_id?: string;
  data: ThreadEventData;
}
type ThreadEventData =
  | { type: "status_change"; old_status: ThreadStatus; new_status: ThreadStatus }
  | { type: "turn_phase"; phase: "validating" | "routing" | "dispatching" | "completing" }
  | { type: "item"; item_type: ItemType; content_summary: string }
  | { type: "approval"; approval_id: string; description: string; risk_level: string; tier: ApprovalTier }
  | { type: "completion"; summary: string; artifacts?: Array<{ path: string; type: string }> }
  | { type: "error"; code: ObserverErrorCode; message: string };
```

**Ordering invariant:** No ThreadEvent is emitted to clients until content has passed through the credential sanitizer.

<!-- [v2: CHANGED] Added Session Store sanitization requirement (SEC-13 fix) -->
**Session Store sanitization requirement:** The Session Store MUST pass turn messages and attachment content through the credential sanitizer BEFORE persistence to SQLite. The Session Store is a persistence path separate from the audit trail and MUST NOT store unsanitized user-supplied content.

**Startup Recovery (Sentry requirement):**

On server startup, the Session Manager runs a recovery routine:
1. Scans all sessions in `processing` or `executing` state
2. Transitions them to `interrupted` status
3. Surfaces interrupted sessions to the human as requiring re-dispatch or manual resolution
4. Never silently retries interrupted work -- the human decides what to do

**Orphan Process Recovery (Sentry requirement):**

On startup, scans for orphaned child processes from a previous server instance:
1. Checks PID file or process name matching for previously-spawned CLI tool processes
2. Kills orphans (SIGTERM, then SIGKILL after grace period)
3. Logs all discovered and killed orphans to audit trail
4. Marks corresponding dispatch results as `interrupted`

**Dependencies:** session-store (SQLite persistence), id generator, clock utility.

**Security Considerations:**
- Session IDs are unguessable (nanoid with 12 chars = 64^12 entropy). Not sequential.
- Session-to-client binding: a session is locked to the client_id that created it. Other clients cannot access it.
- Idle session cleanup: sessions idle for longer than configured timeout are auto-closed (default **72 hours** -- Adam has multi-day gaps between sessions; 24 hours is too aggressive per Sentry review).
- Session cleanup checks for active work (in-flight dispatches, pending approvals) before closing. Uses `last_active_at` timestamp updated on every turn submission, not just session creation. This prevents the TOCTOU race where cleanup fires while Adam has just reconnected and submitted work.
- Thread metadata is stored but never evaluated as code -- it is opaque JSON preserved for client use.

**ISC Exit Criteria:**
- Create, retrieve, resume, and close sessions
- Create threads within sessions, with correct state machine transitions
- Create turns within threads, track completion
- SQLite persistence survives server restart (sessions resumable)
- Idle session cleanup works on configured schedule (72 hours default)
- Cleanup skips sessions with active work (in-flight dispatches, pending approvals)
- Invalid state transitions return errors (cannot submit turn to completed thread)
- Startup recovery transitions `processing`/`executing` sessions to `interrupted`
- `interrupted` status surfaces to human for manual resolution

### 3c. Policy Enforcer

**Purpose:** Evaluates every inbound request against governance rules before it reaches the router. This is the control plane's implementation of the pre-execution filter described in the architecture doc. Rules are loaded from configuration and evaluated as pure functions -- no side effects, no network calls.

**Public Interface:**

```typescript
interface PolicyEnforcer {
  evaluate(request: PolicyRequest): PolicyDecision;
  loadRules(configPath: string): void;
  getRules(): PolicyRule[];
}

interface PolicyRequest {
  method: string;            // JSON-RPC method name
  params: unknown;           // Method parameters
  session: Session;          // Current session context
  thread: Thread | null;     // Current thread if applicable
}

type PolicyDecision =
  | { action: "allow" }
  | { action: "deny"; reason: string; rule_id: string }
  | { action: "require_approval"; tier: ApprovalTier; description: string; rule_id: string }
  | { action: "rate_limit"; retry_after_seconds: number; rule_id: string };

interface PolicyRule {
  id: string;
  description: string;
  condition: PolicyCondition;
  action: PolicyAction;
  priority: number;          // Lower = evaluated first. First match wins.
}

// Condition types -- composable
type PolicyCondition =
  | { type: "method_match"; methods: string[] }
  | { type: "client_type_match"; client_types: ClientType[] }
  | { type: "intent_contains"; keywords: string[] }
  | { type: "rate_check"; max_per_minute: number }
  | { type: "and"; conditions: PolicyCondition[] }
  | { type: "or"; conditions: PolicyCondition[] }
  | { type: "not"; condition: PolicyCondition };
```

<!-- [v2: CHANGED] Added IntentType type (Gap 5 fix) -->
```typescript
type IntentType = "cognitive" | "build" | "query" | "system";
```

`intent_type` is CLIENT-DECLARED, not inferred from message content. Policy enforcement checks `client_type` x `intent_type` structurally.

**Policy Rules in Config:**

```yaml
# In control-plane.yaml
policies:
  default_action: "deny"       # If no rule matches, deny
  rules:
    - id: telegram-no-execution
      description: "Telegram clients cannot trigger code execution"
      condition:
        type: and
        conditions:
          - type: client_type_match
            client_types: [telegram]
          - type: method_match
            methods: [thread.create, turn.submit]
          - type: intent_contains
            keywords: [execute, build, deploy, install]
      action: deny
      priority: 10

    # [v2: CHANGED] Added policy rule for internal client type (Gap 2 fix)
    - id: internal-system-allow
      description: "Internal clients (cross-VM) allowed for system methods"
      condition:
        type: and
        conditions:
          - type: client_type_match
            client_types: [internal]
          - type: method_match
            methods: [thread.create, turn.submit, thread.status, thread.cancel]
      action: allow
      priority: 8

    - id: vault-write-approval
      description: "All Vault write operations require approval"
      condition:
        type: intent_contains
        keywords: [write, create, modify, delete]
      action: require_approval
      approval_tier: approve
      priority: 50

    - id: rate-limit-turns
      description: "Maximum 30 turns per minute per session"
      condition:
        type: rate_check
        max_per_minute: 30
      action: rate_limit
      priority: 5
```

**Config Validation (Sentry requirement):**

The policy config is validated against a Zod schema at startup. Validation checks:
- YAML is syntactically valid
- All required fields present for every rule (`id`, `description`, `condition`, `action`, `priority`)
- Condition types are recognized
- Referenced client types exist in the known set
- No duplicate rule IDs
- Priority values are numeric and unique

If validation fails, the server refuses to start and emits a clear error identifying the exact problem. This is a hard stop -- the server never falls back to "defaults" when config is broken.

**Dependencies:** Policy types, session manager (for session context), config schema.

**Security Considerations:**
- Policy rules are loaded from a config file that is human-edited only. There is no API to modify policy rules at runtime. This prevents an attacker who gains control plane access from weakening governance.
- Policy evaluation is synchronous and pure -- it cannot hang, loop, or make network calls.
- Default deny: if no rule matches, the default is `deny`. Explicit allow rules are required.
- Policy evaluation is logged to audit for every request, including the rule that matched and the decision.

**ISC Exit Criteria:**
- Loads policy rules from YAML config without error
- Config validation rejects invalid rules with clear error messages at startup
- Correctly evaluates all condition types (method_match, client_type_match, intent_contains, rate_check, and/or/not)
- First matching rule (by priority) determines decision
- Default deny when no rules match
- Invalid config produces clear error at startup, not silent misconfiguration
- All evaluations produce audit-ready decision records

### 3d. Approval Gateway

**Purpose:** Manages the lifecycle of human-in-the-loop approval requests. When the policy enforcer returns `require_approval`, this component creates an approval request, delivers it to the client (via the next `thread.status` poll or direct response), waits for a human decision, and returns the result. This is where "AI articulates, humans decide" becomes protocol.

**Phase scope:** Phase 1 uses HTTP polling -- clients discover pending approvals via `thread.status` responses. Real-time push via WebSocket is Phase 2+.

**Public Interface:**

```typescript
interface ApprovalGateway {
  // Create a new approval request (called by policy enforcer)
  requestApproval(params: ApprovalRequestParams): Promise<ApprovalResult>;

  // Submit human decision (called by JSON-RPC handler for approval.respond)
  submitDecision(approvalId: string, decision: ApprovalDecision): Promise<void>;

  // Get pending approvals for a session (for resume/reconnect/polling)
  getPendingApprovals(sessionId: string): Promise<PendingApproval[]>;

  // Get all pending approvals system-wide (for CLI dashboard)
  getAllPending(): Promise<PendingApproval[]>;
}

interface ApprovalRequestParams {
  thread_id: string;
  description: string;       // Human-readable description of what needs approval
  risk_level: "low" | "medium" | "high" | "critical";
  tier: ApprovalTier;
  timeout_seconds: number;   // From config, per-tier
  context: Record<string, unknown>;  // Additional info for the human
}

type ApprovalTier = "auto_approve" | "notify" | "approve" | "escalate" | "block";

interface ApprovalResult {
  approval_id: string;
  decision: "approved" | "denied" | "timeout";
  reason: string | null;
  decided_by: string;        // client_id of approver
  decided_at: string;
}

interface PendingApproval {
  approval_id: string;       // "apr_" + nanoid(12)
  thread_id: string;
  session_id: string;
  description: string;
  risk_level: string;
  tier: ApprovalTier;
  created_at: string;
  timeout_at: string;
  status: "pending" | "approved" | "denied" | "expired";
}
```

**Approval Response Deduplication (Sentry requirement):**

If Adam has both the CLI and Telegram connected, both may see the same pending approval. If he responds from both clients, the gateway handles this safely:

1. **First-response-wins with optimistic locking.** When the first response arrives, it is accepted and the approval is marked as resolved with a `decided_by` field.
2. **Late/duplicate responses receive `ApprovalAlreadyResolved` error** (-32009). The client is informed the approval was already handled.
3. **Both responses are logged in the audit trail** -- the winning response AND the late/conflicting response, for forensic purposes.
4. **No contradictory decisions possible.** Once resolved, the decision is final.

**Telegram Approval Restrictions (Security Auditor NNF-2):**

High-risk approvals are restricted by client type:
- **Tier `approve` and `escalate`**: CLI client ONLY. Telegram cannot respond to these.
- **Tier `notify` and `auto_approve`**: Any client (informational only, no decision needed).
- **Tier `block`**: Automatically denied, no client can override.

This prevents a compromised Telegram bot from approving dangerous operations. The most an attacker with Telegram access can do is submit `turn.submit` requests (constrained by policy rules) -- they cannot approve code execution, system modification, or external API calls.

**Timeout Handling:**
- Each approval tier has a configurable timeout (from control-plane.yaml)
- When timeout expires: decision = "denied" (fail safe, not fail open)
- The thread enters `awaiting_approval` state and stays there until timeout
- When a client reconnects or polls, pending (non-expired) approvals are returned
- `auto_approve` tier: automatically approved, no human interaction, but still logged
- `block` tier: automatically denied, no human can override via the approval gateway (requires config change and server restart)

**Dependencies:** Session manager (for thread context), audit logger (all approvals logged), approval store (SQLite persistence for pending approvals).

**Security Considerations:**
- Approval requests are scoped to sessions. A client from session A cannot respond to approvals from session B.
- The `decided_by` field creates an audit trail of which client approved which operation.
- Timeout denial is logged with reason "timeout" -- distinguishes from active denial.
- The `block` tier cannot be overridden at runtime -- it requires a config change and server restart. This prevents social engineering via the approval flow.
- Approval descriptions are generated by the system, not by user input, to prevent misleading approval prompts.
- **Approval fatigue mitigation (Sentry pre-mortem):** Start with more operations in `auto_approve` tier and fewer in `approve`. The system should not generate 30-50 approval prompts per session or Adam will rubber-stamp everything, defeating the governance purpose. Tier assignments should be calibrated iteratively.

**ISC Exit Criteria:**
- Creates approval requests and delivers them via `thread.status` polling
- Accepts decisions and unblocks waiting threads
- Handles timeout by denying (fail safe)
- Persists pending approvals across server restart
- Reconnected/polling client sees pending approvals
- Block tier rejects immediately without prompting
- Auto-approve tier logs but does not prompt
- First-response-wins deduplication works (second response gets error)
- Both responses logged in audit trail
- Telegram client cannot respond to `approve`/`escalate` tier approvals
- Audit record for every approval lifecycle event

### 3e. Audit Logger

**Purpose:** Records every significant event in the control plane to an append-only audit trail. This is the system's flight recorder -- it captures what happened, when, by whom, and why, even if clients disconnect or processes crash. The audit trail is the source of truth for forensic investigation.

**Dual-Layer Storage (Security Auditor NNF-4):**

The audit system uses two storage layers:
1. **Primary: JSONL append-only files** -- One line per event, appended with `fsync`. Structurally append-only by file system semantics (open with `O_APPEND`). This satisfies Governance Framework Invariant 2 (boundaries are structural). The process cannot delete or modify previous lines without OS-level file manipulation.
2. **Secondary: SQLite index** -- Queryable index rebuilt from JSONL files. Supports the `audit.query` RPC method. If corrupted, it can be rebuilt from the JSONL source of truth.

This addresses the Security Auditor's finding that application-enforced "append-only" in SQLite is not a structural guarantee. The JSONL files are the authoritative record; SQLite is the queryable convenience layer.

<!-- [v2: CHANGED] Made SQLite writes asynchronous per Sentry/Operator resolution -->
**Write Behavior:**
- JSONL write: synchronous and blocking (governance guarantee)
- SQLite insert: asynchronous, batched on 1-second timer or 100-event buffer
- If SQLite write fails: log warning but do not block. SQLite is convenience layer.
- Add rebuild mechanism: `scripts/rebuild-audit-index.sh`

<!-- [v2: CHANGED] Added JSONL integrity check on startup -->
**JSONL Integrity Check:** On startup, read last line of active JSONL file, verify valid JSON, truncate if corrupted, log warning.

<!-- [v2: CHANGED] Enforce max audit event size within PIPE_BUF -->
**Event Size Limit:** Enforce max audit event size within PIPE_BUF (4096 bytes). Truncate details payloads if necessary.

**Public Interface:**

```typescript
interface AuditLogger {
  // Log an event (synchronous JSONL write -- audit must not be lossy)
  log(event: AuditEvent): void;

  // Query events (for audit.query RPC method, uses SQLite index)
  query(filter: AuditFilter): AuditQueryResult;

  // Get recent events (for dashboards and quick checks)
  tail(count: number): AuditEvent[];
}

interface AuditEvent {
  event_id: string;          // "evt_" + nanoid(16)
  timestamp: string;         // ISO 8601 with milliseconds
  category: AuditCategory;
  action: string;            // e.g., "session.created", "policy.denied", "approval.requested"
  session_id: string | null;
  thread_id: string | null;
  turn_id: string | null;
  item_id: string | null;
  client_id: string | null;
  details: Record<string, unknown>;  // Action-specific payload (sanitized)
  policy_rule_id: string | null;     // Which policy rule was involved
  risk_level: string | null;
}

type AuditCategory =
  | "session"       // Session lifecycle
  | "thread"        // Thread lifecycle
  | "turn"          // Turn lifecycle
  | "policy"        // Policy evaluation decisions
  | "approval"      // Approval requests and decisions
  | "dispatch"      // Dispatch to headless core
  | "health"        // Health status changes
  | "security"      // Auth failures, rate limits, anomalies
  | "system";       // Server start/stop, config reload
```

<!-- [v2: CHANGED] Added abstract storage interfaces -->
```typescript
interface AuditStore {
  append(event: AuditEvent): void;
  index(event: AuditEvent): void;
  query(filter: AuditFilter): AuditQueryResult;
  rebuild(): void;
}
interface SessionStore {
  save(session: Session): Promise<void>;
  load(sessionId: string): Promise<Session | null>;
  listActive(): Promise<Session[]>;
  cleanup(olderThan: string): Promise<number>;
}
```

**SQLite Index Schema:**

```sql
CREATE TABLE audit_events (
  event_id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  category TEXT NOT NULL,
  action TEXT NOT NULL,
  session_id TEXT,
  thread_id TEXT,
  turn_id TEXT,
  item_id TEXT,
  client_id TEXT,
  details TEXT NOT NULL,     -- JSON, sanitized
  policy_rule_id TEXT,
  risk_level TEXT
);

CREATE INDEX idx_audit_session ON audit_events(session_id);
CREATE INDEX idx_audit_thread ON audit_events(thread_id);
CREATE INDEX idx_audit_timestamp ON audit_events(timestamp);
CREATE INDEX idx_audit_category ON audit_events(category);
```

**Dual-Layer Credential Detection (Security Auditor NNF-3):**

Before writing any event, the `audit-sanitizer` applies two independent detection layers:

1. **Real-time regex scan:** Scans the `details` payload for patterns matching known credential formats:
   - API keys: `sk-...`, `AIza...`, `ghp_...`, `gho_...`, `glpat-...`
   - Bearer tokens: `Bearer [A-Za-z0-9-._~+/]+=*`
   - Base64 strings of suspicious lengths (32-64 chars in contexts suggesting credentials)
   - File path references to known secret locations (`/run/secrets/`, `~/.config/*/credentials`)
   - Matches are replaced with `[REDACTED:key_type]`

2. **Structural content heuristic scan:** Scans for patterns that look credential-like but do not match known formats:
   - High-entropy strings (Shannon entropy > 4.5) in value positions of JSON objects
   - Strings matching `[A-Za-z0-9+/]{40,}={0,2}` (base64-like) in suspicious contexts
   - Key-value pairs where the key contains words like `secret`, `token`, `key`, `password`, `credential`, `auth`

These two layers address the Security Auditor's requirement that single-layer regex scanning violates Invariant 3 (security truth is triangulated). The regex scan catches known patterns; the heuristic scan catches unknown patterns. A third layer (periodic retrospective sweep using TruffleHog against stored JSONL files) is recommended for Phase 2.

**Audit Integrity (Operator concern: "If you cannot log it, do not do it"):**

If an audit write fails (disk full, I/O error), the control plane **blocks the request** rather than proceeding without logging. Audit is the governance backbone. This means:
- Audit write is synchronous and must succeed before the request proceeds
- Disk space monitoring alerts at 80% to prevent this scenario
- ZFS pool capacity is part of the health check

**Dependencies:** audit-store (JSONL files + SQLite index), audit-sanitizer, clock utility.

**Security Considerations:**
- **Structurally append-only:** JSONL files opened with `O_APPEND` flag. The primary audit trail cannot have entries deleted or modified through normal file operations.
- **File permissions:** JSONL files and SQLite index owned by the server process user with 0600 permissions. No other process should read or write them.
- **Separate storage:** The audit files are in a different directory from session state, so compromising session data does not expose audit history.
- **Log rotation:** When JSONL files exceed a configured size (default 100MB), the current file is closed (renamed with timestamp suffix), permissions changed to 0400 (read-only), and a new file is opened. The SQLite index covers all JSONL files.
- **SQLite index as secondary:** If the SQLite index is corrupted, it can be rebuilt from the JSONL source files. The JSONL files are the source of truth.
- **ANSI escape stripping:** All string content in audit events has ANSI escape sequences stripped before storage to prevent terminal exploitation in log viewers.

**ISC Exit Criteria:**
- Logs all event categories with correct structure to both JSONL and SQLite
- Dual-layer sanitizer catches common API key patterns (test with known formats)
- Heuristic scan catches high-entropy strings in value positions
- Query by session, thread, category, time range works correctly via SQLite index
- JSONL files are append-only (opened with O_APPEND)
- File permissions are 0600 (active) and 0400 (rotated archives)
- Log rotation works at configured threshold
- Events survive server restart (persisted to disk, not in-memory only)
- Tail function returns most recent N events ordered by timestamp
- Audit write failure blocks the triggering request
- SQLite index can be rebuilt from JSONL files

### 3f. Router/Core Client

**Purpose:** Maps validated, policy-approved requests to the headless core service on the CachyOS VM. This is the control plane's last stop before the request leaves the Observer Relay VM. The router translates client-facing JSON-RPC methods into internal-facing commands that the headless core understands.

**Public Interface:**

```typescript
interface Router {
  // Route a validated request to the headless core
  route(request: RoutableRequest): Promise<RouteResult>;

  // Check if the headless core is reachable
  isHealthy(): Promise<boolean>;
}

interface RoutableRequest {
  method: string;
  params: unknown;
  session: Session;
  thread: Thread;
  turn: Turn;
}

interface RouteResult {
  success: boolean;
  items: Item[];           // Items generated by the core's processing
  error?: {
    code: string;
    message: string;
  };
}
```

<!-- [v2: CHANGED] Router uses intent_type field (structural) for routing decisions, not keyword matching on intent string (Gap 5 routing update) -->
**Routing Table:**

| Client Method | Core Target | Core Endpoint | Routing Key |
|--------------|-------------|---------------|-------------|
| `turn.submit` (intent_type: "cognitive") | Atlas/OIL | `core.process_turn` | `intent_type` field |
| `turn.submit` (intent_type: "build") | Atlas Builder | `core.dispatch_build` | `intent_type` field |
| `turn.submit` (intent_type: "query") | Vault I/O | `core.query` | `intent_type` field |
| `thread.cancel` | Core lifecycle | `core.cancel_thread` | Method name |

**Cross-VM Communication:**

The router communicates with the CachyOS VM headless core over HTTP JSON-RPC via Tailscale. The core exposes its own internal JSON-RPC server (separate from the client-facing control plane).

```typescript
// Core client configuration
interface CoreClientConfig {
  url: string;              // e.g., "http://100.x.x.x:9100/rpc" (Tailscale IP)
  timeout_ms: number;       // Must be >= max dispatch timeout + validation overhead
  retry_count: number;      // Default 1
  retry_delay_ms: number;   // Default 5000
  auth_token: string;       // Shared secret for VM-to-VM auth (loaded from /run/secrets/)
}
```

**Timeout Alignment (Sentry requirement):**

The cross-VM timeout (`timeout_ms`) must be greater than or equal to the maximum backend dispatch timeout plus validation overhead. Example: if the longest backend timeout is 1200 seconds (20 minutes), the cross-VM timeout should be at least 1260 seconds (21 minutes). Otherwise the control plane times out and reports failure while the backend continues working, and a retry causes duplicate execution.

<!-- [v2: CHANGED] Updated error translation: error messages MUST be hardcoded control-plane-generated strings. Never include raw backend stderr in client-facing error messages. -->
**Error Translation:**

The router translates cross-VM errors into meaningful client-facing errors. Error messages MUST be hardcoded control-plane-generated strings. Never include raw backend stderr in client-facing error messages.
- `ECONNREFUSED` -> "Dispatch backend unreachable -- CachyOS VM may be down"
- `ETIMEDOUT` -> "Dispatch timeout -- backend execution exceeded time limit"
- `ENOTFOUND` -> "Tailscale DNS resolution failed -- check Tailscale connectivity"
- HTTP 429 from core -> "Dispatch layer rate-limited -- backing off" (distinct from backend unavailability)

**Dependencies:** Core client (HTTP), session manager (for context), audit logger (logs all routing decisions).

**Security Considerations:**
- Cross-VM auth: a shared secret token (loaded from `/run/secrets/`, not config file) authenticates the control plane to the headless core. The core rejects requests without this token.
- The core's internal JSON-RPC server also binds to Tailscale IP only -- not `0.0.0.0` or LAN interfaces.
- Request timeout prevents indefinite hangs when the core is unresponsive.
- The router logs the routing decision (which core service was targeted and why) to the audit trail, creating a complete trace from client request to core invocation.

**ISC Exit Criteria:**
- Routes `turn.submit` to correct core endpoint based on intent_type classification
- Cross-VM HTTP communication works over Tailscale
- Timeout handling returns human-readable error after configured period
- Timeout alignment: cross-VM timeout >= max dispatch timeout
- Retry logic works for transient failures (1 automatic retry)
- Health check correctly detects core availability
- Error messages are human-readable, not raw ECONNREFUSED
- Audit log contains routing decisions

### 3g. Execution Dispatch Layer

**Purpose:** Standalone module that accepts structured dispatch requests from Atlas and routes them to CLI execution backends. This is the "engine room" module described in the Multi-Engine Orchestration document. It lives on the CachyOS VM alongside the CLI tools and Atlas.

**Phase scope:** Phase 1 implements Mode 1 dispatch only (human specifies backend). Mode 2 (config-recommended) and Mode 3 (council) are deferred. This means the Phase 1 dispatch layer is: "receive a request with a target backend, shell out to the specified CLI tool, capture output, return it."

**Public Interface:**

```typescript
// This is a library interface, not a JSON-RPC server.
// Atlas imports and calls this directly.

interface ExecutionDispatcher {
  // Dispatch a slice to a backend
  dispatch(request: DispatchRequest): Promise<DispatchResult>;

  // Get backend registry status
  getBackends(): BackendStatus[];

  // Health check all backends
  checkHealth(): Promise<HealthReport>;

  // Reload config (e.g., after human edits execution-backends.yaml)
  reloadConfig(): void;
}

// [v2: CHANGED] Standardized dispatch request to TDS format (Gap 6 fix)
interface DispatchRequest {
  dispatch_id: string;       // "dsp_" + nanoid(12)
  mode: "specify";           // Phase 1: only "specify" mode
  slice: {
    id: string;
    description: string;
    type: TaskType;
    context_files: string[];
    working_directory: string;
    isc_criteria: ISCCriteria;
    sensitivity?: SensitivityLevel;
  };
  target_backend: string;    // Human-specified backend (required in Mode 1)
}

type SensitivityLevel = "public" | "internal" | "confidential";

interface ISCCriteria {
  tests_pass?: boolean;
  no_secrets?: boolean;
  lint_clean?: boolean;
  custom?: Record<string, unknown>;
}

// Full type for forward compatibility (Mode 2/3 fields defined but unused in Phase 1)
interface DispatchRequestFull extends DispatchRequest {
  mode: "specify" | "recommend" | "council";
  recommended_backend: string | null;   // Mode 2: config-recommended backend
  recommended_reason: string | null;
  council_backends?: string[];          // Mode 3: for council mode
}

type TaskType =
  | "code-generation"
  | "bug-fixing"
  | "complex-refactoring"
  | "architecture-review"
  | "code-review"
  | "security-audit"
  | "research"
  | "exploration"
  | "drafts"
  | "low-stakes-generation"
  | "summarisation";

interface DispatchResult {
  dispatch_id: string;
  backend_used: string;
  backend_version: string | null;  // CLI tool version for forensic correlation
  model_used: string | null;       // If determinable from backend output
  execution_time_seconds: number;
  tokens_used: number | null;      // If parseable from backend output
  cost_estimate: "free" | "subscription" | "per-token";
  // [v2: CHANGED] Added parse_error to status enum (Gap 7 fix)
  status: "completed" | "failed" | "timeout" | "parse_error";
  exit_code: number;
  artifacts: Array<{
    path: string;
    type: "code" | "document" | "config" | "other";
    hash: string;              // SHA-256 of file content
  }>;
  stdout_log: string;          // Captured stdout (sanitized, ANSI-stripped)
  stderr_log: string;          // Captured stderr (sanitized, ANSI-stripped)
  truncated: boolean;          // True if output exceeded cap
  validation_pending: boolean; // Always true -- OIL validates after
}

// [v2: CHANGED] Standardized health states (Gap 10 fix)
interface BackendStatus {
  name: string;
  command: string;
  enabled: boolean;
  health_state: BackendHealthState;
  last_check: string;
  last_used: string | null;
  total_dispatches: number;
  total_failures: number;
}
```

**Process Kill Chain (Sentry requirement):**

Backend CLI tools are killed with a defined escalation when they exceed their timeout:

1. **SIGTERM** sent to the process group (`process.kill(-pid, 'SIGTERM')`)
2. **10-second grace period** for clean shutdown
3. **SIGKILL** sent to the process group if still alive
4. Partial output captured and marked as `status: "timeout"` (distinct from `"failed"` -- different failure modes require different retry logic)
5. All spawned PIDs tracked in a cleanup registry; on server shutdown, the registry is walked and surviving children killed

Using process group kill (`-pid`) ensures child processes forked by the CLI tool are also terminated.

<!-- [v2: CHANGED] Orphan recovery must verify PID AND process start time (Risk 6 fix) -->
**Orphan Process Recovery:** Store PIDs with process start time (`/proc/[pid]/stat` field 22). On recovery, verify both PID AND start time match before killing. Consider using systemd slice for cgroup-based process scoping.

**Backend Invocation Pattern:**

Each CLI backend is invoked as a child process:

```typescript
// Pseudocode for backend execution
async function executeBackend(backend: BackendProfile, slice: Slice): Promise<RawResult> {
  const args = buildArgs(backend, slice);
  const proc = spawn(backend.command, args, {
    cwd: slice.working_directory,
    timeout: backend.timeout_ms,
    env: sanitizedEnv(),  // CRITICAL: stripped of all secrets
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Register PID in cleanup registry
  cleanupRegistry.add(proc.pid);

  // Stream stdout/stderr to log, capture for result
  // Enforce output size cap (10MB default, configurable per-backend)
  // Strip ANSI escape sequences from captured output
  // On timeout: SIGTERM -> 10s -> SIGKILL (process group)
  // Return exit code + captured output + truncation flag
}

function sanitizedEnv(): Record<string, string> {
  // Start with minimal env, NOT process.env
  // Include only: PATH, HOME, TERM, LANG, USER
  // NEVER include: ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.
  // Backend CLI tools authenticate via their own config files,
  // NOT via environment variables.
  return {
    PATH: process.env.PATH ?? '/usr/bin:/bin',
    HOME: process.env.HOME ?? '/home/adam',
    TERM: 'xterm-256color',
    LANG: 'en_AU.UTF-8',
    USER: 'adam',
  };
}
```

<!-- [v2: CHANGED] Added TOCTOU mitigation to path validation (SEC-2 fix) -->
**Path Validation (TOCTOU mitigation):** Resolve all symlinks with `fs.realpath()` AFTER allowlist validation. Re-check resolved path against allowlist. Use `O_NOFOLLOW` where possible. Document as accepted residual risk for Phase 1; Phase 2 bubblewrap provides structural fix.

**Output Handling (Sentry requirements):**

- **Size cap:** Default 10MB per backend, configurable per-backend in `execution-backends.yaml`. When exceeded, output is truncated and `truncated: true` is set in the result. Full output logged to a temporary file for manual inspection if needed. Warning surfaced to the human.
- **Version tracking:** CLI tool version (e.g., output of `claude --version`) is captured before dispatch and included in the `backend_version` field of every dispatch result. This enables forensic correlation when a version update breaks output parsing.
- **Output format validation:** After capture, output is validated against expected structure as the first step. If parsing fails, result is `status: "parse_error"` -- not `"failed"`. Parse errors do not retry (same CLI version produces the same output). Timeout errors may retry with longer timeout. Auth errors escalate immediately (never retry).
- **ANSI stripping:** All captured stdout/stderr has ANSI escape sequences removed before storage.

**Backend Health States (Sentry distinction):**

The dispatch layer distinguishes between health states:
- `healthy`: Backend responding normally
- `degraded`: Intermittent failures (e.g., occasional timeouts)
- `rate_limited`: Backend returned HTTP 429 or equivalent. Backoff timer active. No new dispatches until timer expires. This is distinct from `unavailable` -- the backend works, it just needs time.
- `unavailable`: Hard down (connection refused, process not found)

When a backend is `rate_limited`, the dispatch layer does not immediately escalate to human. Instead, work is queued with a `queued_until` timestamp. Only escalate if the queue exceeds a configurable threshold (e.g., 30+ minutes). Batch the notification into a single escalation, not N separate ones.

**Dependencies:** Config schema, backend registry, health checker, cost tracker, output parser. No dependency on PAI, control plane, or OIL.

**Security Considerations:**
- **Environment sanitization is the single most critical security feature.** Child processes receive a minimal, hand-curated environment. No `process.env` passthrough. This directly prevents the API key exposure incident from recurring. Backend CLI tools authenticate through their own credential files (e.g., `~/.config/claude`, `~/.config/gemini`), not through environment variables.
- **Output sanitization:** stdout/stderr from backend processes is scanned for credential patterns (same dual-layer sanitizer as the audit logger) before being stored in the dispatch result.
- **Sensitivity routing:** If a slice has `sensitivity: "confidential"`, the dispatch router only routes to backends in the allowed trust tier (Claude Code, Ollama). Routing to lower-trust backends is blocked, not just warned.
- **Working directory isolation:** Each dispatch specifies its working directory. The executor validates this is within the allowed workspace before spawning. Path traversal in `context_files` is validated against a strict allowlist of base directories.
- **Command injection prevention:** Backend arguments are passed as array elements to `spawn()`, never concatenated into a shell string. No `shell: true` option. This applies universally, including health check commands.
- **Backend output as untrusted content:** The dispatch layer generates the result envelope (dispatch_id, backend_used, status, etc.) -- backend stdout is treated as untrusted content within a trusted wrapper. A compromised CLI tool cannot inject false metadata into the dispatch result structure.
- **CLI tool version pinning (Sentry pre-mortem):** Backend CLI tool versions should be pinned. Do not use `@latest`. Specify exact versions in a lockfile or management script. A single `npm update -g` should not break the dispatch pipeline.

**ISC Exit Criteria:**
- Dispatches to at least two different backends (Claude Code + one other)
- Mode 1 (human specifies) works end-to-end
- Environment sanitization verified: child process env contains no API keys
- Output sanitization verified: known credential patterns are redacted
- Kill chain works: SIGTERM -> 10s grace -> SIGKILL (process group)
- Timeout status is `timeout`, not `failed` (distinct failure modes)
- Output cap enforced with truncation flag
- Backend version captured in every dispatch result
- Parse error status distinct from general failure
- Health states correctly distinguish healthy/degraded/rate_limited/unavailable
- Rate-limited backend triggers backoff, not immediate escalation
- Health check correctly identifies available/unavailable backends
- Sensitivity routing: confidential slice rejected for low-trust backend
- Context file paths validated against allowlist
<!-- [v2: CHANGED] Removed "Config reload works without server restart" from ISC exit criteria (Risk 14 fix). Both services require restart for config changes. Consistent policy. -->

### 3h. Health Monitor

**Purpose:** Tracks the availability and responsiveness of all system components: the headless core, each execution backend, and the control plane's own services. Provides the data for the `health.status` RPC method and triggers status change logging when transitions occur.

**Phase scope:** Phase 1 uses polling-based health checks. Status changes are logged to audit; real-time push to clients via events is Phase 2+.

**Public Interface:**

```typescript
interface HealthMonitor {
  // Get current health status
  getStatus(): HealthStatus;

  // Run health checks now (on-demand)
  checkNow(): Promise<HealthStatus>;

  // Register a listener for status changes (internal use)
  onStatusChange(callback: (change: HealthChange) => void): void;
}

// [v2: CHANGED] Standardized health states (Gap 10 fix)
type BackendHealthState = "healthy" | "degraded" | "rate_limited" | "unavailable" | "disabled";

interface HealthStatus {
  server: {
    status: "healthy" | "degraded" | "unhealthy";
    uptime_seconds: number;
    memory_usage_mb: number;
    active_sessions: number;
    active_threads: number;
    pending_approvals: number;
  };
  core: {
    status: "healthy" | "unreachable" | "error";
    last_check: string;
    response_time_ms: number | null;
    tailscale_connected: boolean;  // Operator requirement
  };
  backends: Record<string, {
    status: BackendHealthState;
    last_check: string;
    response_time_ms: number | null;
    uptime_ratio: number;    // Last 24h
    version: string | null;  // CLI tool version
  }>;
  audit: {
    status: "healthy" | "error";
    jsonl_size_mb: number;     // Current JSONL file size
    sqlite_size_mb: number;    // SQLite index size
    event_count: number;
  };
  storage: {
    disk_usage_percent: number;  // Sentry: ZFS pool capacity
    alert: boolean;              // True if > 80%
  };
  // [v2: CHANGED] Added health_monitor.last_heartbeat field (Risk 9 fix)
  health_monitor: {
    last_heartbeat: string;    // Updated on every polling cycle. If > 2x fastest interval, include staleness warning.
  };
}

interface HealthChange {
  component: string;
  old_status: string;
  new_status: string;
  timestamp: string;
  details: string;
}
```

<!-- [v2: CHANGED] Split health endpoint into public/authenticated views (SEC-4 fix) -->
**Health Endpoint Views:**
- **Unauthenticated (`health.status` without Bearer token):** Returns only `{ status, uptime_seconds }` (liveness probe)
- **Authenticated (`health.status` with valid Bearer token):** Returns full topology, backends, versions, metrics

**Health Check Intervals:**
- Backend health: every 5 minutes (configurable)
- Core health: every 30 seconds (faster -- this is the critical path)
- Audit health: every 1 minute
- Disk/ZFS capacity: every 5 minutes
- Tailscale connectivity: every 1 minute
- Server self-health: computed on-demand from in-memory metrics

**Tailscale Health (Operator requirement):**

The health monitor checks Tailscale connectivity as part of core health. Equivalent to `tailscale status | grep cachyos`. If Tailscale is down, core status is `unreachable` with `tailscale_connected: false`. This gives Adam immediate visibility into whether the cross-VM link is the problem.

**Disk Capacity Monitoring (Sentry requirement):**

ZFS pool capacity is monitored. Alert threshold at 80%. When storage is above threshold:
- `health.status` returns `storage.alert: true`
- Audit log receives a `health` category event
- This is surfaced before the pool fills and audit writes start failing

**Dependencies:** Backend registry (for health check commands), core client (for core reachability), audit store (for DB health).

**Security Considerations:**
- `health.status` unauthenticated view returns only liveness data (`status` and `uptime_seconds`). Full topology, backend details, and metrics require authentication.
- Health check commands for backends are defined in config (e.g., `claude --version`). These are invoked via the same `spawn()` array-args path as dispatches -- never through a shell. This ensures health checks cannot be a command injection vector.
- Health data is useful for debugging but could reveal system topology to an attacker with local access. Mitigated by the public/authenticated split.

**ISC Exit Criteria:**
- Reports correct health status for all components
- Detects core unreachability within 60 seconds
- Detects backend failures within 10 minutes
- Detects Tailscale connectivity loss
- Disk capacity alerts at configured threshold (80%)
- Status change events fire on transitions and are logged to audit
- Health data returned by `health.status` RPC method
- Health check commands use safe spawn path (no shell)
- Unauthenticated health view returns only liveness data

<!-- [v2: CHANGED] Added new subsection 3i -- Cross-VM Internal Protocol (Gap 13 fix) -->

### 3i. Cross-VM Internal Protocol

**Purpose:** Defines the internal JSON-RPC method namespace used for communication between the control plane (Observer Relay VM) and the headless core (CachyOS VM). These methods are not exposed to external clients.

**Internal Method Types:**

```typescript
interface CoreRequestEnvelope {
  request_id: string;
  timestamp: string;
}
interface CoreProcessTurnParams extends CoreRequestEnvelope {
  session_id: string;
  thread_id: string;
  turn_id: string;
  message: string;
  attachments?: Attachment[];
  intent_type: IntentType;
  contains_sensitive: boolean;
  sensitivity_markers?: string[];
  metadata: Record<string, unknown>;
}
interface CoreProcessTurnResult {
  items: Item[];
  summary: string;
  thread_status: ThreadStatus;
}
interface CoreDispatchBuildParams extends CoreRequestEnvelope {
  session_id: string;
  thread_id: string;
  turn_id: string;
  build_spec: {
    intent: string;
    context_files: string[];
    working_directory: string;
    target_backend?: string;
  };
}
interface CoreDispatchBuildResult {
  dispatch_id: string;
  status: "dispatched" | "queued" | "failed";
  estimated_duration_seconds?: number;
}
interface CoreQueryParams extends CoreRequestEnvelope {
  session_id: string;
  thread_id: string;
  query: string;
  scope?: "vault" | "session" | "system";
}
interface CoreCancelThreadParams extends CoreRequestEnvelope {
  thread_id: string;
  reason?: string;
}
```

**Auth Configuration (supporting evolution):**

```typescript
type CoreAuthConfig =
  | { strategy: "bearer_token"; token_path: string }
  | { strategy: "hmac_signed"; key_path: string; algorithm: "sha256" }
  | { strategy: "mtls"; cert_path: string; key_path: string; ca_path: string };
```

**Cross-VM Sanitization Requirement:** The control plane MUST scan cross-VM payloads for credential patterns before transmission. Set `contains_sensitive: true` when detected. Receiving components MUST NOT log raw message content without sanitizer pass.

---

## 4. Configuration Schemas

All configuration files are human-edited YAML, loaded at startup, and never modified by the system at runtime. Config changes require a service restart. This is deliberate: there is no ambiguity about whether the running config matches the file on disk.

Config files are committed to git as `.example.yaml` templates. Live config files are gitignored. The example files serve as documentation.

### 4.1 Control Plane Configuration (`control-plane.yaml`)

**Location:** `packages/control-plane/config/control-plane.yaml`
**Zod schema:** `packages/control-plane/src/schemas/config-schema.ts`

```yaml
# Observer Control Plane Configuration
# Location: packages/control-plane/config/control-plane.yaml
# Human-edited only. Never modified by the system.
# Restart server after changes: systemctl restart observer-control-plane
# [v2: CHANGED] Added prerequisite comment
# PREREQUISITE: Run scripts/provision-secrets.sh before starting. See RUNBOOK.md.

# --- Server Settings ---
server:
  host: "127.0.0.1"                    # NEVER change to 0.0.0.0
  http_port: 9000                       # JSON-RPC over HTTP (POST /rpc)
  max_request_size_bytes: 1048576       # 1MB
  shutdown_timeout_seconds: 30          # Grace period for in-flight requests on SIGTERM
  log_level: "info"                     # debug | info | warn | error

# --- Session Settings ---
sessions:
  idle_timeout_hours: 72                # Auto-close idle sessions (Adam may be away for days)
  max_concurrent: 10                    # Maximum active sessions
  max_threads_per_session: 50           # Maximum threads per session

# --- Core Connection (Headless Core on CachyOS VM) ---
core:
  url: "http://100.x.x.x:9100/rpc"    # Find with: tailscale ip -4 <cachyos-hostname>
  # [v2: CHANGED] Fixed core.timeout_ms: set to 1260000 (21 minutes) minimum, not 300000.
  # Zod validation rule: core.timeout_ms >= max(backends.*.timeout_seconds) * 1000 + 60000
  timeout_ms: 1260000                   # 21 minutes -- must exceed max backend timeout + 60s margin
  retry_count: 1
  retry_delay_ms: 5000
  auth_token_path: "/run/secrets/observer/core-auth-token"  # Path to token file, NOT the token

# --- Authentication ---
auth:
  # Pre-shared tokens for each client type
  # Stored in credential files, referenced by path here
  token_dir: "/run/secrets/observer/client-tokens/"
  # Expected files: cli.token, telegram.token, gui.token
  # Each file contains a single opaque random token (32+ bytes of cryptographic randomness)
  # Tokens are independently rotatable per client type

# --- Rate Limiting ---
rate_limits:
  requests_per_minute: 60              # Per session
  turns_per_hour: 120                  # Per session

# --- Approval Tiers ---
approvals:
  tiers:
    auto_approve:
      timeout_seconds: 0               # Instant, but logged
    notify:
      timeout_seconds: 0               # Instant, logged prominently
    approve:
      timeout_seconds: 300             # 5 minutes
    escalate:
      timeout_seconds: 600             # 10 minutes
    block:
      timeout_seconds: 0               # Instant deny, no override at runtime

  # Which client types may respond to approvals at each tier.
  # This restricts Telegram to low-risk tiers only (NNF-2).
  # [v2: CHANGED] Telegram and GUI channels are pre-configured for Phase 2.
  # Active enforcement begins when those clients are implemented.
  approval_channels:
    auto_approve:
      allowed_clients: [cli, telegram, gui]     # Informational only, no human action
    notify:
      allowed_clients: [cli, telegram, gui]     # Informational only, no human action
    approve:
      allowed_clients: [cli]                    # CLI only -- no Telegram approval
    escalate:
      allowed_clients: [cli]                    # CLI only -- highest risk decisions
    block:
      allowed_clients: []                       # No client can override block tier

# --- Policy Rules ---
policies:
  default_action: "deny"               # If no rule matches, deny
  rules:
    - id: health-check-allow
      description: "Health checks are always allowed"
      condition:
        type: method_match
        methods: [health.status]
      action: allow
      priority: 1

    - id: session-management-allow
      description: "Session create/close/resume always allowed for authenticated clients"
      condition:
        type: method_match
        methods: [session.create, session.close, session.resume]
      action: allow
      priority: 2

    - id: telegram-cognitive-only
      description: "Telegram clients can only do cognitive work (no builds, no execution)"
      condition:
        type: and
        conditions:
          - type: client_type_match
            client_types: [telegram]
          - type: method_match
            methods: [thread.create, turn.submit]
          - type: intent_contains
            keywords: [build, execute, deploy, install, delete, modify]
      action: deny
      priority: 10

    - id: thread-create-approve
      description: "Thread creation requires approval for non-CLI clients"
      condition:
        type: and
        conditions:
          - type: client_type_match
            client_types: [telegram, gui]
          - type: method_match
            methods: [thread.create]
      action: require_approval
      approval_tier: notify
      priority: 20

    - id: turn-submit-allow
      description: "Turn submission allowed for all authenticated clients"
      condition:
        type: method_match
        methods: [turn.submit]
      action: allow
      priority: 30

    - id: audit-query-allow
      description: "Audit queries allowed for CLI clients only"
      condition:
        type: and
        conditions:
          - type: client_type_match
            client_types: [cli]
          - type: method_match
            methods: [audit.query]
      action: allow
      priority: 40

    - id: audit-query-deny-others
      description: "Non-CLI clients cannot query audit logs"
      condition:
        type: method_match
        methods: [audit.query]
      action: deny
      priority: 41

# --- Health Monitoring ---
health:
  backend_check_interval_seconds: 300   # 5 minutes
  core_check_interval_seconds: 30       # Critical path, check frequently
  audit_check_interval_seconds: 60

# --- Audit Settings ---
audit:
  # Primary audit trail: append-only JSONL files (structurally immutable)
  jsonl_dir: "data/audit/"              # JSONL files written here
  jsonl_max_size_mb: 100                # Rotate at this size
  jsonl_archive_dir: "data/audit-archive/"

  # Queryable index: SQLite rebuilt from JSONL source
  index_database_path: "data/audit-index.db"

  # Credential sanitization patterns (applied before ANY write)
  sanitize_patterns:
    - "sk-[a-zA-Z0-9]{20,}"            # Anthropic API keys
    - "AIza[a-zA-Z0-9_-]{35}"          # Google API keys
    - "ghp_[a-zA-Z0-9]{36}"            # GitHub tokens
    - "sk-proj-[a-zA-Z0-9-_]{40,}"     # OpenAI project keys
    - "gho_[a-zA-Z0-9]{36}"            # GitHub OAuth tokens
    - "glpat-[a-zA-Z0-9_-]{20,}"       # GitLab tokens
    - "xoxb-[0-9]+-[a-zA-Z0-9]+"       # Slack bot tokens
```

**Validation rules (enforced by Zod schema at startup):**

| Field | Validation | On Failure |
|-------|-----------|------------|
| `server.host` | Must be `"127.0.0.1"` or `"::1"` | Hard fail: refuse to start |
| `server.http_port` | Integer 1024-65535 | Hard fail |
| `core.url` | Valid URL, must start with `http://100.` (Tailscale range) | Hard fail |
| `core.timeout_ms` | >= max(backends.*.timeout_seconds) * 1000 + 60000 | Hard fail |
| `core.auth_token_path` | File must exist and be readable | Hard fail |
| `auth.token_dir` | Directory must exist with at least `cli.token` | Hard fail |
| `approvals.tiers` | All five tiers present | Hard fail |
| `approval_channels.*` | Each tier's `allowed_clients` is a subset of `[cli, telegram, gui]` | Hard fail |
| `policies.rules[].id` | Unique across all rules | Hard fail |
| `policies.rules[].priority` | Unique across all rules | Hard fail |
| `audit.jsonl_dir` | Directory must exist and be writable | Hard fail |

A `--validate-config` CLI flag checks config without starting the server, printing all validation errors before exiting.

### 4.2 Execution Backends Configuration (`execution-backends.yaml`)

**Location:** `packages/dispatch/config/execution-backends.yaml`
**Zod schema:** `packages/dispatch/src/schemas/config-schema.ts`

```yaml
# Observer Ecosystem -- Execution Backend Routing Configuration
# Location: packages/dispatch/config/execution-backends.yaml
# Human-edited only. Atlas reads but NEVER writes this file.
# Restart required after changes.

# --- Global Settings ---
routing_mode: "specify"                 # Phase 1: human specifies backend only
                                        # Phase 2: "recommend" (config suggests, human approves)
                                        # Phase 3: "council" (multiple backends, never automatic)
default_backend: "claude-code"
cost_awareness: true                    # Log cost per dispatch

# --- Dispatch Settings ---
dispatch:
  default_timeout_seconds: 600          # 10 minutes per backend invocation
  max_retries: 1                        # Automatic retries before escalating to human
  retry_delay_seconds: 5
  output_max_bytes: 10485760            # 10MB max captured output per backend
  health_check_timeout_seconds: 15      # Timeout for backend health check commands

# --- Sensitivity Routing ---
# [v2: CHANGED] Made sensitivity section optional when routing_mode: "specify".
# Zod validation: required when routing_mode is "recommend" or "council".
sensitivity:
  public:                               # Any backend allowed
    allowed_backends: ["*"]
  internal:                             # Trusted backends only
    allowed_backends: [claude-code, codex-cli, ollama]
  confidential:                         # Highest trust only
    allowed_backends: [claude-code, ollama]

# --- Backend Profiles ---
backends:
  claude-code:
    command: "claude"
    args_template: ["--print", "--output-format", "json", "{prompt}"]
    enabled: true
    cost: "subscription"                # subscription | free | per-token
    trust_level: "high"                 # high | medium | low
    timeout_seconds: 900                # 15 min -- complex tasks need time
    pinned_version: "1.x"              # Expected major version; warn on mismatch
    strengths:
      - implementation
      - refactoring
      - deep-reasoning
      - multi-file-operations
    default_for:
      - code-generation
      - bug-fixing
      - complex-refactoring
    health_check:
      command: "claude"
      args: ["--version"]
      timeout_seconds: 10
    notes: "Primary backend. Claude Max subscription. Rate limits under heavy parallel use."

  gemini-cli:
    command: "gemini"
    args_template: ["{prompt}"]
    enabled: true
    cost: "free"
    trust_level: "medium"
    timeout_seconds: 600
    pinned_version: "1.x"
    strengths:
      - architecture-review
      - search-grounding
      - research
      - google-ecosystem
    default_for:
      - architecture-review
      - research
      - exploration
    health_check:
      command: "gemini"
      args: ["--version"]
      timeout_seconds: 10
    notes: "Free with Google account. 60 req/min, 1000/day. Good for search-grounded research."

  codex-cli:
    command: "codex"
    args_template: ["exec", "{prompt}"]
    enabled: true
    cost: "subscription"
    trust_level: "medium"
    timeout_seconds: 600
    pinned_version: "0.x"
    strengths:
      - code-quality
      - security-audit
      - sandboxed-execution
    default_for:
      - code-review
      - security-audit
    health_check:
      command: "codex"
      args: ["--version"]
      timeout_seconds: 10
    notes: "ChatGPT Plus/Pro. Bubblewrap sandbox isolation on Linux."

  ollama:
    command: "ollama"
    args_template: ["run", "{model}", "{prompt}"]
    model: "llama3.1:70b"
    enabled: true
    cost: "free"
    trust_level: "high"                 # Local execution = full sovereignty
    timeout_seconds: 1200               # Local can be slow on large models
    pinned_version: "0.x"
    strengths:
      - local-execution
      - privacy
      - zero-cost
    default_for:
      - drafts
      - low-stakes-generation
      - offline-fallback
    health_check:
      command: "ollama"
      args: ["list"]
      timeout_seconds: 10
    notes: "Local execution. Zero cost, full privacy. Hardware: Ryzen 9 5950X + RX 6900 XT."

  opencode-free:
    command: "opencode"
    args_template: ["{prompt}"]
    enabled: false                      # Enable when configured with current free models
    cost: "free"
    trust_level: "low"
    timeout_seconds: 300
    pinned_version: "0.x"
    strengths:
      - zero-cost
      - model-diversity
    default_for:
      - bulk-drafts
      - summarisation
    health_check:
      command: "opencode"
      args: ["--version"]
      timeout_seconds: 10
    notes: "Model availability rotates. Check current free models on OpenRouter before enabling."

# --- Task Type to Backend Mapping ---
# Used when routing_mode is "recommend" (Phase 2+).
# Ignored when routing_mode is "specify" (Phase 1).
routing_rules:
  code-generation: claude-code
  bug-fixing: claude-code
  complex-refactoring: claude-code
  architecture-review: gemini-cli
  code-review: codex-cli
  security-audit: codex-cli
  research: gemini-cli
  exploration: gemini-cli
  drafts: ollama
  low-stakes-generation: ollama
  summarisation: ollama
```

**Validation rules (enforced by Zod schema at startup):**

| Field | Validation | On Failure |
|-------|-----------|------------|
| `routing_mode` | Must be `"specify"` for Phase 1 | Hard fail |
| `default_backend` | Must reference an enabled backend | Hard fail |
| `backends.*.command` | Non-empty string | Hard fail |
| `backends.*.timeout_seconds` | Integer > 0, <= 3600 | Hard fail |
| `backends.*.trust_level` | One of `high`, `medium`, `low` | Hard fail |
| `backends.*.health_check.timeout_seconds` | Integer > 0, <= `dispatch.health_check_timeout_seconds` | Hard fail |
| `backends.*.pinned_version` | Semver range string | Hard fail |
| `sensitivity.confidential.allowed_backends` | Must NOT include any `trust_level: "low"` backend | Hard fail |
| `dispatch.output_max_bytes` | Integer > 0, <= 52428800 (50MB) | Hard fail |
| `sensitivity` | Required when routing_mode is "recommend" or "council"; optional when "specify" | Hard fail |

**Version pinning behavior:** At startup and during health checks, the dispatch layer runs each backend's health check command and compares the reported version against `pinned_version`. If the version does not satisfy the semver range, a warning is logged and the backend's health status is set to `degraded` (not `unhealthy`). The backend remains usable but Adam is alerted. This catches the scenario where `npm update -g` silently breaks output format compatibility.

---

## 5. Security Architecture

This section is the most critical in the specification. It integrates the Architect's foundational security design, all Non-Negotiable Findings (NNF-1 through NNF-8) from the Security Auditor, all identified threats (T1-T19), the Sentry's kill chain requirements, and the Operator's practical concerns about secrets bootstrap. Every security decision is traced back to one of the four Security Governance Framework invariants:

- **Invariant 1:** Secrets Are Scoped
- **Invariant 2:** Boundaries Are Structural
- **Invariant 3:** Security Truth Is Triangulated
- **Invariant 4:** Doubt Escalates to Human

### 5.1 Trust Boundaries and Separation of Concerns

The system has five distinct trust boundaries. Each boundary is a point where data crosses between trust domains and must be validated, sanitized, or gated.

```
INTERNET
    |
    | (HTTPS outbound only -- long polling, no inbound webhook)
    |
+---v-------------------------------------------+
| TRUST ZONE 1: Observer Relay VM                |
|                                                |
|  Telegram Client (outbound poll only)          |
|      |                                         |
|      v                                         |
|  [Boundary A: External Input -> Control Plane] |
|      |                                         |
|  Control Plane (127.0.0.1:9000)                |
|  - Policy Enforcer                             |
|  - Approval Gateway                            |
|  - Session Manager                             |
|  - Audit Logger (JSONL primary + SQLite index) |
|      |                                         |
|  [Boundary B: Cross-VM]                        |
+---|--------------------------------------------+
    | Tailscale (WireGuard encrypted)
    | HTTP JSON-RPC + Bearer token auth
+---v--------------------------------------------+
| TRUST ZONE 2: CachyOS VM                      |
|                                                |
|  Headless Core (100.x.x.x:9100)               |
|  Atlas (task decomposition)                    |
|  OIL Validation                                |
|      |                                         |
|  [Boundary C: Dispatch -> CLI Tools]           |
|      |                                         |
|  Dispatch Layer                                |
|  - sanitizedEnv() -- minimal curated env       |
|  - spawn() array args -- no shell              |
|      |                                         |
|  [Boundary D: CLI Output -> System]            |
|      |                                         |
|  CLI Backends (child processes)                |
|  - Claude Code, Gemini CLI, Codex CLI, Ollama  |
|  - Each reads own credentials from ~/.config/  |
|                                                |
+------------------------------------------------+
```

**Boundary A -- External Input to Control Plane:**
- Telegram messages are free-form text from the internet.
- All input is validated against Zod schemas at the JSON-RPC layer.
- Message content is wrapped as a `turn.submit` string payload. It is NEVER interpolated into method names, config lookups, file paths, or shell commands.
- Policy enforcer restricts Telegram clients to cognitive operations only.
- Unicode normalization (NFC) applied; null bytes rejected.
- Max message size: 4096 characters.

**Boundary B -- Cross-VM Communication:**
- HTTP JSON-RPC over Tailscale (WireGuard encrypted tunnel).
- Bearer token authentication on every request (token from `/run/secrets/`).
- Control plane initiates all connections to CachyOS VM. CachyOS never initiates connections to Relay VM.
- Zod validation on both ends.

**Boundary C -- Dispatch to CLI Tools:**
- Child processes receive `sanitizedEnv()` -- minimal curated environment, never `process.env`.
- Arguments passed as array to `spawn()`, never through a shell.
- Working directory validated to be within allowed workspace paths.
- Context file paths validated against a strict allowlist of base directories.

**Boundary D -- CLI Output to System:**
- All stdout/stderr treated as untrusted content.
- Dual-layer credential scanning before storage (regex + TruffleHog).
- ANSI escape sequences stripped.
- Output capped at configurable limit (default 10MB) with truncation flag.
- Output wrapped in a trusted dispatch result envelope generated by the dispatch layer itself.

### 5.2 Credential Management

This section directly responds to the February 2026 API key exposure incident (EX-6). Each of the three original exposure vectors -- environment variables, piped output, and log persistence -- has a structural prevention mechanism that operates at the runtime level, not the procedural level. The design follows Invariant 2: safe behavior is the path of least resistance, and unsafe behavior requires deliberate effort to achieve.

<!-- [v2: CHANGED] Added explicit Phase 1 credential isolation scope statement -->
**Phase 1 credential isolation is defense-in-depth against accidental leakage, NOT against a compromised dispatch process. Full isolation requires Phase 2 bubblewrap sandboxing.**

#### 5.2.1 Credential Storage Architecture

```
/run/secrets/observer/                       # tmpfs -- never persists to disk
  core-auth-token                            # Shared secret: control plane <-> core
  client-tokens/
    cli.token                                # CLI client auth token
    telegram.token                           # Telegram client auth token
    gui.token                                # GUI client auth token (future)
```

All tokens are opaque random strings (32+ bytes of cryptographic randomness generated via `crypto.randomBytes()`). Not JWTs, not UUIDs. Per-client tokens enable independent rotation: compromising the Telegram token does not affect CLI access.

**Backend API credentials are NOT managed by Observer.** Each CLI tool manages its own credentials through its native auth mechanism:

| Backend | Credential Location | Auth Method |
|---------|-------------------|-------------|
| Claude Code | `~/.config/claude/credentials` | OAuth via `claude auth login` |
| Gemini CLI | `~/.config/gemini/credentials` | Google OAuth via `gemini auth` |
| Codex CLI | `~/.config/codex/auth` | OpenAI OAuth via `codex auth` |
| Ollama | None (local) | No auth needed |
| OpenCode | `~/.config/opencode/config` | OpenRouter API key in config file |

The dispatch layer never reads, copies, or transmits these credential files. It invokes the CLI tool, the CLI tool reads its own credentials, and the dispatch layer never sees the key. This is the structural separation that prevents recurrence of the API key incident.

#### 5.2.2 Vector 1 Prevention: Environment Variables Never Contain API Keys

**The problem (from EX-6):** `ANTHROPIC_API_KEY` was exported as a shell environment variable. Every child process spawned in that terminal session inherited the key.

**The structural prevention:**

The Execution Dispatch Layer spawns backend CLI tools with a minimal, hand-curated environment constructed from scratch:

```typescript
function sanitizedEnv(): NodeJS.ProcessEnv {
  // Construct from scratch. NEVER spread process.env.
  // This is the ONLY place child process environment is defined.
  return {
    PATH: '/usr/local/bin:/usr/bin:/bin',
    HOME: '/home/adam',
    TERM: 'xterm-256color',
    LANG: 'en_AU.UTF-8',
    USER: 'adam',
    // XDG dirs so CLI tools find their own credential files
    XDG_CONFIG_HOME: '/home/adam/.config',
    XDG_DATA_HOME: '/home/adam/.local/share',
  };
  // EXPLICITLY ABSENT:
  // - ANTHROPIC_API_KEY
  // - OPENAI_API_KEY
  // - GOOGLE_API_KEY
  // - Any variable matching *_KEY, *_TOKEN, *_SECRET, *_CREDENTIAL
}
```

**Enforcement guarantee:** When the `env` option is provided to `child_process.spawn()`, Node.js does NOT inherit the parent's environment. The child sees only what is explicitly listed. This is a Node.js runtime guarantee, not a convention.

**Startup verification:** At dispatch layer initialization, the module asserts that its own `process.env` does not contain known credential variable names. If detected, they are stripped with a security warning:

```typescript
const FORBIDDEN_ENV_PATTERNS = [
  /^ANTHROPIC_/i,
  /^OPENAI_/i,
  /^GOOGLE_API/i,
  /^GEMINI_/i,
  /_API_KEY$/i,
  /_SECRET$/i,
  /_TOKEN$/i,
  /_CREDENTIAL$/i,
];

function auditParentEnvironment(): void {
  for (const key of Object.keys(process.env)) {
    if (FORBIDDEN_ENV_PATTERNS.some(p => p.test(key))) {
      logger.warn(
        `Security: stripping forbidden env var from parent process: ${key}`
      );
      delete process.env[key];
    }
  }
}
```

#### 5.2.3 Vector 2 Prevention: Credentials Never Appear in Arguments or Piped Output

**The problem (from EX-6):** The API key propagated through piped output between processes.

**The structural prevention:**

1. **No credentials in command-line arguments.** The `args_template` in `execution-backends.yaml` defines the argument structure. Before spawning, the dispatch layer validates that constructed arguments do not match credential patterns:

```typescript
function validateArgs(args: string[]): void {
  for (const arg of args) {
    if (FORBIDDEN_ENV_PATTERNS.some(p => p.test(arg))) {
      throw new SecurityError(
        `Credential pattern detected in CLI argument: ${arg.substring(0, 8)}...`
      );
    }
    if (arg.length > 30 && shannonEntropy(arg) > 4.5) {
      throw new SecurityError(
        'High-entropy string detected in CLI argument -- possible credential'
      );
    }
  }
}
```

2. **No shell interpolation.** All backend invocations use `spawn()` with an argument array, never `exec()` with a command string. The `shell: true` option is never used. Health check commands use the same `spawn()` array path as dispatch invocations (same code path, same safety guarantees).

3. **Output sanitization before storage.** All stdout and stderr captured from backend processes passes through dual-layer credential detection (see Section 5.4) before being stored in the dispatch result or forwarded to the audit logger.

4. **Stdio isolation.** Backend child processes have stdio configured as `['pipe', 'pipe', 'pipe']`. The backend's output never reaches the parent's terminal. There is no scenario where a credential printed by a backend CLI tool appears in Adam's terminal session.

#### 5.2.4 Vector 3 Prevention: Credentials Never Persist in Logs or Audit Records

**The problem (from EX-6):** The API key appeared in logs and persisted in terminal history.

**The structural prevention:**

1. **Audit sanitizer runs before write.** Every audit event passes through dual-layer credential detection before being written to the JSONL audit trail or SQLite index.

2. **Structured logging with pino.** Log schemas explicitly exclude credential fields:

```typescript
const pinoConfig = {
  serializers: {
    req: (req: any) => ({
      method: req.method,
      url: req.url,
      hasAuth: !!req.headers?.authorization,  // Presence, not value
    }),
    env: () => '[STRIPPED]',
    credentials: () => '[STRIPPED]',
    token: () => '[STRIPPED]',
  },
  redact: {
    paths: [
      'auth_token', 'token', 'secret',
      'password', 'api_key', 'credential'
    ],
    censor: '[REDACTED]',
  },
};
```

3. **Terminal history exclusion.** The control plane and dispatch layer are systemd services, not interactive terminal processes. The CLI client reads tokens from files and sends them as HTTP headers -- `Authorization: Bearer <token>` is constructed in code, never typed by Adam.

4. **No credentials in config files.** Config files contain paths to credential files (`auth_token_path`, `token_dir`), never the credentials themselves. Config files are safe to commit to git.

#### 5.2.5 Credential Isolation Between Backends (NNF-1)

**The problem:** All backend credential files (`~/.config/claude/`, `~/.config/gemini/`, etc.) are accessible under the same Unix user. A compromised process running as that user can access all API keys.

**Phase 1 mitigation (env sanitization + expanded output sanitizer):**

Phase 1 relies on the `sanitizedEnv()` mechanism described above, plus the dual-layer output sanitizer. The dispatch layer never reads credential files directly. Backend CLI tools are the only processes that read their own credentials. This provides strong isolation at the application layer, though not at the filesystem layer.

Additionally, the dispatch layer's output sanitizer is expanded to detect credential file path references in backend output. If stdout contains a string matching `/home/adam/.config/*/credentials` or similar patterns, the path itself is redacted:

```typescript
const SENSITIVE_PATH_PATTERNS = [
  /\/run\/secrets\/[^\s]+/g,
  /~\/\.config\/[^\s]*\/(credentials|auth|config\.json|\.token)/g,
  /\/home\/adam\/\.config\/[^\s]*\/(credentials|auth)/g,
];
```

**Phase 2 mitigation (separate Unix users via bubblewrap):**

Phase 2 adds bubblewrap-based sandboxing (see NNF-6 in Section 5.7). Each backend invocation runs in a restricted namespace with:
- Read-only bind mount of only the backend's own `~/.config/<tool>/` directory
- Read-write bind mount of only the specified working directory
- No visibility into other backends' credential directories
- No network access beyond the backend's own API endpoints

This makes credential isolation structural (Invariant 2) rather than application-enforced.

<!-- [v2: CHANGED] Added credential detection encoding passes -->
**Credential Detection Pre-processing:** Before regex scanning, apply: Base64 decoding pass, URL-decoding pass, JSON unicode-escape normalization. This prevents encoded credentials from bypassing pattern matching.

#### 5.2.6 Token Rotation Procedure

| Credential Type | Rotation Procedure | Service Impact |
|----------------|-------------------|----------------|
| Backend API keys | Use each tool's built-in auth rotation (`claude auth refresh`, etc.) | None -- dispatch layer never holds these |
| Client tokens | Generate new token, write to `/run/secrets/observer/client-tokens/<type>.token`, restart server | Affected client must update its token; other clients unaffected |
| Core auth token | Generate new token on both VMs, update files, restart both services | Brief interruption during coordinated restart |
| Compromised key emergency | Revoke immediately at provider, rotate all tokens on affected VM, audit trail review for exposure window | Full restart of affected services |

#### 5.2.7 Structural Guarantee Summary

| Exposure Vector (from EX-6) | Prevention Mechanism | Enforcement Type |
|-----------------------------|---------------------|-----------------|
| Environment variable inheritance | `sanitizedEnv()` constructs minimal env from scratch | Runtime (Node.js `spawn` with explicit `env`) |
| Parent env contamination | `auditParentEnvironment()` strips forbidden vars at startup | Runtime assertion |
| CLI argument exposure | `validateArgs()` rejects credential patterns before spawn | Runtime check |
| Shell interpolation | `spawn()` array form only, never `shell: true` | Code convention enforced by linting |
| Piped output propagation | stdio set to `['pipe', 'pipe', 'pipe']`, output captured by dispatch | Runtime (Node.js spawn options) |
| Log persistence | Dual-layer credential detection before every write | Runtime gatekeeper |
| Structured log leakage | Pino redaction paths strip sensitive fields | Configuration |
| Config file exposure | Paths to credentials, never credentials themselves | Design convention, git-committed safely |
| Terminal history | Services run as systemd, not interactive; CLI reads tokens from files | Architectural |
| Cross-backend credential access | Phase 1: env sanitization. Phase 2: bubblewrap namespace isolation | Phase-dependent |

### 5.3 Network Security

#### 5.3.1 Network Posture Diagram

```
+----------------------------------------------------------+
|                      INTERNET                             |
|                                                           |
|   Telegram API   Google APIs   OpenAI API   Anthropic API |
+----------|------------|-----------|-----------|----------+
           |            |           |           |
           | HTTPS      | HTTPS     | HTTPS     | HTTPS
           | (outbound  | (by CLI)  | (by CLI)  | (by CLI)
           |  poll only)|           |           |
+----------|------------|-----------|-----------|----------+
|          v            |           |           |          |
|  Observer Relay VM    |           |           |          |
|                       |           |           |          |
|  Telegram Client --+  |           |           |          |
|                    |  |           |           |          |
|                    v  |           |           |          |
|  Control Plane     |  |           |           |          |
|  127.0.0.1:9000    |  |           |           |          |
|                    |  |           |           |          |
|  Firewall:         |  |           |           |          |
|  INPUT: DROP       |  |           |           |          |
|    (except Tailscale, established)                       |
|  OUTPUT: ALLOW     |  |           |           |          |
|    (Tailscale, DNS, Telegram API only)                   |
|  FORWARD: DROP     |  |           |           |          |
+---------|--------------------------------------------+---+
          |  Tailscale (WireGuard)
          |  100.x.x.x:9100
+---------|--------------------------------------------+---+
|         v                                                |
|  CachyOS VM                                              |
|                                                          |
|  Headless Core (100.x.x.x:9100)                         |
|  Dispatch Layer --> CLI Backends (child processes)        |
|                          |           |           |       |
|                          +-----------+-----------+       |
|                          (outbound HTTPS to APIs)        |
|                                                          |
|  Ollama: 127.0.0.1:11434 only                           |
|                                                          |
|  Firewall:                                               |
|  INPUT: DROP (except Tailscale, established)             |
|  OUTPUT: ALLOW (Tailscale, DNS, API endpoints)           |
|  FORWARD: DROP                                           |
+----------------------------------------------------------+
```

#### 5.3.2 Key Network Decisions

| Decision | Rationale | Invariant |
|----------|-----------|-----------|
| **Telegram: outbound polling, no inbound webhook** | No internet-facing ports on Relay VM. Eliminates entire class of webhook attacks. | Inv. 2 |
| **Control plane: 127.0.0.1 only** | Startup assertion verifies bind address. Reinforced by iptables DROP on non-Tailscale inbound. | Inv. 2 |
| **Cross-VM: Tailscale only** | WireGuard encryption. Tailscale ACLs for device authorization. Control plane initiates all connections (unidirectional). | Inv. 2 |
| **Firewall: default DROP** | Both VMs use nftables with default DROP on INPUT and FORWARD. OUTPUT allows only documented destinations. | Inv. 2 |
| **Defense in depth on binding** | Application-level 127.0.0.1 assertion AND OS-level nftables rule blocking non-Tailscale inbound. Two independent layers. | Inv. 3 |
| **Outbound rules documented** | Relay VM: Telegram API, Tailscale. CachyOS VM: Anthropic, OpenAI, Google APIs, Tailscale. All others blocked. | Inv. 1 |

#### 5.3.3 Cross-VM Authentication

The control plane authenticates to the headless core via a shared Bearer token loaded from `/run/secrets/observer/core-auth-token`. The headless core rejects any request without this token. Communication direction is always Relay VM to CachyOS VM -- the CachyOS VM never initiates connections to the Relay VM.

mTLS for cross-VM communication is deferred to Phase 2. For Phase 1, the combination of Tailscale WireGuard encryption + Bearer token authentication is sufficient for a home server with a single operator.

### 5.4 Input Sanitization

#### 5.4.1 Dual-Layer Credential Detection (NNF-3)

The Security Auditor's NNF-3 requires at least two independent credential detection mechanisms to satisfy Invariant 3 (triangulation). The system implements:

**Layer 1 -- Regex Pattern Matching (real-time, at capture):**

Applied to all backend stdout/stderr, all audit event payloads, and all dispatch results before storage:

```typescript
const CREDENTIAL_PATTERNS = [
  { pattern: /sk-[a-zA-Z0-9]{20,}/g,              label: 'anthropic-key' },
  { pattern: /sk-proj-[a-zA-Z0-9_-]{40,}/g,       label: 'openai-project-key' },
  { pattern: /AIza[a-zA-Z0-9_-]{35}/g,            label: 'google-api-key' },
  { pattern: /ghp_[a-zA-Z0-9]{36}/g,              label: 'github-token' },
  { pattern: /gho_[a-zA-Z0-9]{36}/g,              label: 'github-oauth' },
  { pattern: /glpat-[a-zA-Z0-9_-]{20,}/g,         label: 'gitlab-token' },
  { pattern: /xoxb-[0-9]+-[a-zA-Z0-9]+/g,        label: 'slack-bot-token' },
  { pattern: /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\./g, label: 'jwt' },
];
```

Additionally, entropy-based detection flags high-entropy strings (Shannon entropy > 4.5) in credential-adjacent contexts (near words like "key", "token", "secret", "password", "auth"):

```typescript
function entropyRedact(text: string): string {
  // Find high-entropy strings near credential context words
  // Replace with [REDACTED:high-entropy]
}
```

Sensitive file path patterns are also detected and redacted (credential file paths are themselves sensitive disclosures even without the credential content).

**Layer 2 -- TruffleHog Scanning (during OIL validation):**

TruffleHog operates as an independent detection mechanism during the OIL validation pipeline, after dispatch results are captured but before they are committed to the workspace. TruffleHog uses a different detection approach (entropy analysis, known secret formats, verified credentials via API checks) providing independent triangulation.

TruffleHog timeout: 30 seconds per scan. If scanning times out on a large output (approaching 10MB), the result is escalated to Adam for manual review rather than blocking the pipeline.

**ANSI escape sequence stripping:** All captured CLI output has ANSI escape sequences removed before any credential scanning or storage. This prevents escape sequences from hiding credential patterns from regex detection.

#### 5.4.2 Input Validation Chain

| Boundary | Input Type | Sanitization Steps |
|----------|-----------|-------------------|
| Telegram -> Control Plane | Free-form text, voice-to-text | 1. Size limit (4096 chars) 2. Unicode NFC normalization 3. Null byte rejection 4. Zod schema validation 5. Wrap as `turn.submit` string payload 6. Policy evaluation |
| CLI Client -> Control Plane | Structured JSON-RPC | 1. Size limit (1MB) 2. Zod schema validation 3. Policy evaluation |
| Control Plane -> Core (cross-VM) | JSON-RPC over HTTP | 1. Bearer token auth 2. Zod schema validation on receiver |
| Dispatch -> CLI Tool | Args array, working dir | 1. `spawn()` array form (no shell) 2. `sanitizedEnv()` 3. Working directory validation 4. Context file path allowlist 5. Argument credential pattern check |
| CLI Output -> Dispatch Result | stdout/stderr streams | 1. ANSI stripping 2. Size cap (10MB) with truncation flag 3. Layer 1: regex credential scan 4. Layer 2: TruffleHog scan (during OIL validation) 5. Wrap in trusted dispatch result envelope |

#### 5.4.3 Dispatch Result Integrity

Backend CLI tool output is untrusted content. The dispatch layer itself generates the trusted result envelope:

```typescript
interface DispatchResult {
  // Trusted fields -- generated by dispatch layer
  dispatch_id: string;          // Generated by dispatch layer
  backend_used: string;         // From config, not from output
  backend_version: string;      // From health check, not from output
  execution_time_seconds: number;// Measured by dispatch layer
  // [v2: CHANGED] Updated status enum to include parse_error
  status: "completed" | "failed" | "timeout" | "parse_error";
  exit_code: number;            // From Node.js child_process

  // Untrusted fields -- derived from backend output (sanitized)
  stdout_log: string;           // Sanitized captured stdout
  stderr_log: string;           // Sanitized captured stderr
  artifacts: Array<{            // Files detected in working directory diff
    path: string;
    type: string;
    hash: string;               // SHA-256 computed by dispatch layer
  }>;

  // Metadata
  model_used: string | null;    // If parseable from output
  tokens_used: number | null;   // If parseable from output
  cost_estimate: "free" | "subscription" | "per-token";
  truncated: boolean;           // True if output exceeded size cap
  validation_pending: boolean;  // Always true -- OIL validates after
}
```

The `dispatch_id`, `backend_used`, `exit_code`, and `execution_time_seconds` are authoritative because they are generated by the dispatch layer, not parsed from backend output. A compromised backend cannot forge these fields.

### 5.5 Audit Trail Integrity (NNF-4)

The Security Auditor's NNF-4 requires structurally append-only audit. SQLite alone is application-enforced append-only (the process with write access can execute DELETE/UPDATE). The solution uses a dual-layer architecture: JSONL as the primary audit trail with structural append-only guarantees, and SQLite as a queryable index that can be rebuilt from the JSONL source.

<!-- [v2: CHANGED] Added audit write deadlock prevention -->
**Audit Write Deadlock Prevention:** Exempt `health.status` and `session.close` from audit-write-must-succeed requirement. Add circuit breaker: 5 consecutive audit write failures -> CRITICAL health status, degraded mode (reads allowed, writes return AuditFailure).

<!-- [v2: CHANGED] Added JSONL file integrity protection -->
**JSONL File Integrity Protection:** Per-entry HMAC using age-derived key. SHA-256 hash stored alongside archived JSONL files at rotation. Periodic integrity verification.

#### 5.5.1 Architecture

```
Audit Event
    |
    v
[Credential Sanitizer]  -- dual-layer scan before ANY write
    |
    +---> JSONL file (primary trail)    -- append-only by design
    |       - One JSON object per line
    |       - fsync after each write
    |       - File opened O_APPEND | O_WRONLY
    |       - Permissions: 0600, owned by service user
    |       - Rotation at 100MB: rename with timestamp, chmod 0400
    |       - Archives are read-only (0400)
    |
    +---> SQLite index (queryable)      -- rebuilt from JSONL if needed
            - INSERT only (no DELETE/UPDATE in codebase)
            - WAL mode for crash safety
            - Indexes on session_id, thread_id, timestamp, category
            - Serves audit.query RPC method
```

**Why JSONL as primary:**
- File opened with `O_APPEND` flag provides OS-level append-only guarantee. Writes always append, even if the file handle is shared.
- Each line is a self-contained JSON object. Corruption of one line does not affect others.
- Human-readable with `tail -f` or `jq` from Adam's phone.
- Simple archival: rename file, chmod 0400, start new file.
- SQLite index can be rebuilt from JSONL source at any time via a rebuild script.

**Why SQLite as index:**
- Efficient querying by session_id, thread_id, time range, category.
- Serves the `audit.query` RPC method without parsing JSONL files.
- If SQLite is corrupted, it is expendable -- rebuild from JSONL.

#### 5.5.2 JSONL Event Format

```json
{"event_id":"evt_a1b2c3d4e5f6","ts":"2026-02-26T14:30:00.123Z","cat":"dispatch","act":"dispatch.completed","sid":"ses_x1y2z3","tid":"thr_a1b2c3","details":{"backend":"claude-code","status":"completed","duration_s":42},"rid":null,"risk":null}
```

Fields are abbreviated for storage efficiency:
- `event_id` -> unique event identifier
- `ts` -> ISO 8601 timestamp with milliseconds
- `cat` -> category (session, thread, turn, policy, approval, dispatch, health, security, system)
- `act` -> action string
- `sid` -> session_id (nullable)
- `tid` -> thread_id (nullable)
- `details` -> action-specific payload (sanitized)
- `rid` -> policy_rule_id (nullable)
- `risk` -> risk_level (nullable)

#### 5.5.3 SQLite Index Schema

```sql
CREATE TABLE audit_events (
  event_id   TEXT PRIMARY KEY,
  timestamp  TEXT NOT NULL,
  category   TEXT NOT NULL,
  action     TEXT NOT NULL,
  session_id TEXT,
  thread_id  TEXT,
  turn_id    TEXT,
  item_id    TEXT,
  client_id  TEXT,
  details    TEXT NOT NULL,          -- JSON, sanitized
  policy_rule_id TEXT,
  risk_level TEXT
);

CREATE INDEX idx_audit_session   ON audit_events(session_id);
CREATE INDEX idx_audit_thread    ON audit_events(thread_id);
CREATE INDEX idx_audit_timestamp ON audit_events(timestamp);
CREATE INDEX idx_audit_category  ON audit_events(category);
```

SQLite is opened in WAL mode with `busy_timeout` of 5000ms. The database file is opened by exactly one process. A PID lockfile prevents accidental double-starts.

#### 5.5.4 Rotation and Archival

1. When the active JSONL file exceeds 100MB, it is renamed with a timestamp suffix (e.g., `audit-2026-02-26T14:30:00.jsonl`).
2. The archived file permissions are changed to 0400 (read-only for owner).
3. A new JSONL file is opened for writing.
4. The SQLite index is NOT rotated -- it accumulates until manually purged or rebuilt.
5. Old JSONL archives accumulate in the archive directory. Adam manages retention manually. ZFS snapshots provide additional point-in-time recovery.

**If audit write fails (JSONL or SQLite):** The request that generated the audit event is BLOCKED. Audit is the governance backbone -- if the system cannot log an action, it must not perform the action. This is a hard requirement per the Security Governance Framework. Exception: `health.status` and `session.close` are exempt from this requirement per the deadlock prevention rule above.

### 5.6 Threat Model

All identified threats with severities, attack vectors, mitigations, and residual risk assessment.

#### 5.6.1 Threats T1-T8 (Architect's Initial Model)

| ID | Threat | Severity | Attack Vector | Mitigation | Residual Risk | Phase |
|----|--------|----------|---------------|------------|---------------|-------|
| T1 | API key in environment variable leaks to child process | **Critical** | Backend CLI tool logs env vars or reads `/proc/self/environ` | `sanitizedEnv()` constructs minimal env from scratch. `auditParentEnvironment()` strips forbidden vars at startup. Node.js `spawn` with explicit `env` option does not inherit parent env. | Negligible -- runtime guarantee from Node.js | 1 |
| T2 | API key in command-line argument visible in process list | **Critical** | `ps aux` reveals `--api-key sk-...` | Never pass credentials as CLI arguments. `validateArgs()` rejects credential patterns before spawn. Backends use config file auth. | Negligible -- structural prevention | 1 |
| T3 | Credentials in audit logs | **High** | Secret flows through system, gets logged before sanitization | Dual-layer credential detection (regex + TruffleHog) runs BEFORE any write to JSONL or SQLite. Pino serializers strip auth headers and sensitive fields. | Low -- novel credential formats may bypass regex; TruffleHog provides secondary catch | 1 |
| T4 | Prompt injection via Telegram | **High** | Attacker sends crafted message that overrides system prompts | All Telegram input wrapped as `turn.submit` string payload, never interpolated. Policy enforcer restricts Telegram to cognitive operations. | Medium -- control plane cannot prevent prompt injection at the LLM layer; this is a residual risk at the backend level | 1 |
| T5 | Command injection via CLI spawning | **Critical** | Malicious input in dispatch request arguments | `spawn()` with array args, never `shell: true`. Health checks use same safe spawn path. Context file paths validated against allowlist. | Negligible -- structural prevention | 1 |
| T6 | Rogue JSON-RPC client | **Medium** | Unauthorized process connects to localhost:9000 | Pre-shared Bearer token auth required for all methods except `health.status`. Tokens stored in `/run/secrets/` (tmpfs). Rate limiting per session. | Low -- requires localhost access AND token compromise | 1 |
| T7 | Session hijacking | **Medium** | Attacker obtains session ID | Session IDs are nanoid(12) = ~71 bits entropy. Sessions bound to `client_id`. Session resumption requires auth token. Session timeout at 72 hours. Session revocation via `session.close`. | Low -- requires both session ID and auth token | 1 |
| T8 | Denial of service via request flooding | **Medium** | Attacker or runaway script sends rapid requests | Rate limiting per session (60 req/min, 120 turns/hr). Max concurrent sessions (10). Max request size (1MB). Backend invocation timeouts. | Low -- effective for single-operator system | 1 |

#### 5.6.2 Threats T9-T12 (Infrastructure)

| ID | Threat | Severity | Attack Vector | Mitigation | Residual Risk | Phase |
|----|--------|----------|---------------|------------|---------------|-------|
| T9 | Backend CLI tool compromised (supply chain) | **High** | Malicious update to npm package replaces CLI binary | Pin CLI versions in `execution-backends.yaml`. Version check at startup (health check reports version, compared against `pinned_version`). `npm audit` before updates. Output sanitization catches credential exfiltration in stdout. | Medium -- sophisticated supply chain attack may evade version pinning. Phase 2 adds binary checksum verification. | 1 (partial), 2 (full) |
| T10 | Cross-VM boundary violation | **Medium** | CachyOS VM process probes Relay VM services | VMs isolated by Proxmox hypervisor. Cross-VM traffic only via Tailscale. Core server requires Bearer token auth. Control plane initiates all connections (unidirectional). | Low -- requires Tailscale compromise AND token compromise | 1 |
| T11 | Tailscale compromise | **Low** | Attacker compromises Tailscale control plane or device key | Shared secret auth token on top of Tailscale encryption. Tailscale device list monitoring. Health check includes Tailscale status. Phase 2 adds mTLS. | Low -- low probability event; Bearer token provides independent layer | 1 |
| T12 | Audit log tampering | **Medium** | Attacker with process access modifies audit trail | Primary audit trail is JSONL (append-only via `O_APPEND`). SQLite index is rebuildable. Archives are chmod 0400. ZFS snapshots provide point-in-time recovery. | Low -- `O_APPEND` is OS-enforced; attacker would need to truncate or replace the file, which ZFS snapshots can detect | 1 |

#### 5.6.3 Threats T13-T16 (Security Auditor Additions)

| ID | Threat | Severity | Attack Vector | Mitigation | Residual Risk | Phase |
|----|--------|----------|---------------|------------|---------------|-------|
| T13 | Secrets provisioning bootstrap | **High** | Age identity key on disk is only as secure as host OS | Age identity file stored at `/root/.config/age/key.txt`, mode 0400, owned by root. Full-disk encryption on host. `ExecStartPre` systemd directive decrypts secrets before service starts. Cold boot tested: services come up with secrets loaded without manual intervention. See Section 5.2.8. | Medium -- age key recoverable by anyone with root or physical access. Acceptable for home server with full-disk encryption. | 1 |
| T14 | CLI tool auto-update tampering | **High** | Attacker gains write access to global npm directory, replaces CLI binary | Version pinning in `execution-backends.yaml`. Health check compares actual version against `pinned_version` at startup. Phase 2 adds SHA-256 checksum verification of CLI binaries before invocation. | Medium -- Phase 1 detects version mismatch but not same-version binary replacement | 1 (detect), 2 (prevent) |
| T15 | Dispatch result injection | **Medium** | Compromised CLI tool outputs crafted JSON mimicking valid dispatch result | Dispatch layer generates the trusted result envelope (dispatch_id, backend_used, exit_code, timing). Backend stdout is untrusted content WITHIN the trusted wrapper. OIL validation treats the output as untrusted. | Low -- attacker cannot forge dispatch-layer-generated fields | 1 |
| T16 | Localhost port scanning by compromised Telegram client | **Medium** | Compromised Telegram bot scans localhost services on Relay VM | Relay VM runs minimal services (control plane + Telegram client only). Expected localhost listener inventory documented and verified periodically. `health.status` is the only unauthenticated endpoint and returns operational metrics only. | Low -- minimal attack surface on Relay VM | 1 |

<!-- [v2: CHANGED] Added threats T17-T19 -->
#### 5.6.4 Threats T17-T19 (v2 Additions)

| ID | Threat | Severity | Attack Vector | Mitigation | Residual Risk | Phase |
|----|--------|----------|---------------|------------|---------------|-------|
| T17 | npm dependency supply chain compromise during installation | **High** | Malicious package injected via `npm install` running install scripts | `npm ci` (not `npm install`) to enforce lockfile integrity. `--ignore-scripts` + pre-build native modules. Separate build user without `/run/secrets/` access. Lockfile integrity verification. | Medium -- sophisticated attack may compromise lockfile generation | 1 |
| T18 | TOCTOU race on filesystem path validation | **Medium** | Symlink swapped between validation and use of path | `fs.realpath()` after validation. `O_NOFOLLOW` where possible. Phase 2 bubblewrap provides structural fix. | Medium -- residual race window exists in Phase 1 | 1 (mitigate), 2 (structural fix) |
| T19 | Token rotation failure leaves stale credentials active | **Medium** | Rotation procedure fails midway, old token still accepted | Coordinated rotation procedure. Health check for cross-VM token sync. Brief dual-token acceptance window during rotation. | Low -- procedural risk, mitigated by health check | 1 |

### 5.7 Blast Radius Analysis

For each component, what happens if it is fully compromised by an attacker.

| Compromised Component | What Attacker Gains | What Attacker Cannot Do | Blast Radius | Key Limitation |
|-----------------------|--------------------|-----------------------|-------------|----------------|
| **Telegram client** | Submit cognitive requests as Adam. Read streamed `item.created` events. See approval notifications. | Cannot trigger builds/execution (policy enforcer blocks). Cannot approve high-risk operations (approval_channels restricts to CLI-only for approve/escalate tiers). Cannot read audit logs. Cannot access Vault. | **Medium** | Policy enforcement + approval channel restrictions (NNF-2) |
| **Control plane server** | Submit requests to core with valid auth. Read audit logs (JSONL + SQLite). Approve pending approvals. Forge audit records in SQLite index. | Cannot directly access Vault filesystem. Cannot modify CLI tool credentials (different VM). Cannot forge JSONL audit entries retroactively (append-only, ZFS snapshots). Cannot access backend credential files (different VM). | **High** | VM isolation. JSONL append-only integrity. Core has independent auth. |
| **Single CLI backend** | Access files in the working directory. Read its own credential file in `~/.config/<tool>/`. Return malicious output (code with backdoors). | Cannot access other backends' credentials (Phase 2: namespace isolation). Cannot communicate with control plane directly (no network access to Relay VM). Cannot modify audit trail. Cannot forge dispatch results (envelope generated by dispatch layer). | **Medium** (Phase 1), **Low** (Phase 2 with sandboxing) | Phase 1: env sanitization. Phase 2: bubblewrap namespace isolation. |
| **Dispatch layer** | Route work to arbitrary backends. Fabricate dispatch results. Access working directories. | Cannot directly reach clients. Cannot forge audit records on Relay VM. Cannot access control plane secrets (different VM). | **Medium** | VM isolation. Audit trail on separate VM. |
| **CachyOS VM (full)** | Full access to all backends, Atlas, dispatch layer, working directories, all credential files on that VM. | Cannot access control plane audit logs or client tokens (different VM). Cannot impersonate Adam to the control plane without the core auth token (which is in `/run/secrets/` on CachyOS -- attacker has it if they have full VM access). | **High** | Only VM isolation separates from total system compromise. Core auth token on CachyOS means attacker can impersonate the core to the control plane. |
<!-- [v2: CHANGED] Expanded Tailscale compromise blast radius -->
| **Tailscale device key** | Can connect to both VMs as authorized device. Can reach control plane on port 9000 and core on port 9100. Shared cross-VM token means one token from full compromise. | Still needs per-service auth tokens. Cannot access services without Bearer token. | **Low-Medium** | Per-service Bearer token auth provides independent authentication layer. **Recommendation:** asymmetric tokens (different token for each direction) or mTLS for Phase 2. **Tailscale ACL recommendation:** restrict CachyOS to accept connections only from Relay VM's Tailscale IP. |
| **Audit database (SQLite)** | Read: full operational history. Write: potential evidence destruction in index. | Cannot modify JSONL primary trail (append-only, archived files are 0400). Cannot modify ZFS snapshots of JSONL files. | **Low** (with JSONL primary) | JSONL + ZFS snapshots provide tamper-evident trail independent of SQLite. |
<!-- [v2: CHANGED] Added health endpoint to blast radius -->
| **Health endpoint (unauthenticated)** | Unauthenticated `health.status` provides only `{ status, uptime_seconds }` liveness data. | Cannot access topology, backend details, or metrics without authentication. | **Negligible** | Public/authenticated split mitigates recon risk if Tailscale compromised. |

### 5.8 Governance Framework Compliance

Assessment of the final design against each Security Governance Framework invariant.

#### Invariant 1 -- Secrets Are Scoped

| Requirement | Status | Evidence |
|------------|--------|----------|
| Backend API keys stay in each CLI tool's own credential store | **Compliant** | Dispatch layer never reads credential files. `sanitizedEnv()` excludes all key variables. |
| Client tokens scoped per client type | **Compliant** | Separate token files (cli.token, telegram.token, gui.token). Independently rotatable. |
| Observer system tokens in tmpfs only | **Compliant** | `/run/secrets/observer/` is tmpfs. Tokens vanish on reboot. Re-provisioned from age-encrypted source by `ExecStartPre`. |
| Backend credentials not ambient across tools | **Phase 1: Partial. Phase 2: Compliant.** | Phase 1: same Unix user, application-level isolation only. Phase 2: bubblewrap restricts filesystem visibility per invocation. |

#### Invariant 2 -- Boundaries Are Structural

| Requirement | Status | Evidence |
|------------|--------|----------|
| 127.0.0.1 binding | **Compliant** | Application assertion AND nftables rule. Two independent enforcement layers. |
| No shell in CLI invocation | **Compliant** | `spawn()` array args only. Linting rule enforces no `shell: true`. Health checks use same code path. |
| Append-only audit trail | **Compliant** | JSONL with `O_APPEND` provides OS-level structural guarantee. SQLite is secondary index. |
| Firewall default DROP | **Compliant** | nftables on both VMs. Documented allowed destinations. |
| Telegram approval scope restricted | **Compliant** | `approval_channels` config structurally restricts which client types can respond to each tier. |

#### Invariant 3 -- Security Truth Is Triangulated

| Requirement | Status | Evidence |
|------------|--------|----------|
| Credential detection: multiple independent layers | **Compliant** | Layer 1: regex pattern matching (real-time). Layer 2: TruffleHog scanning (OIL validation). Independent code paths, different detection methodologies. |
| Audit trail: independent observation | **Compliant** | JSONL primary trail + SQLite index written by same code path but different storage formats. JSONL can be independently verified against SQLite. ZFS snapshots provide third observation point. |
| Network binding: multiple enforcement layers | **Compliant** | Application assertion + nftables rule. |

#### Invariant 4 -- Doubt Escalates to Human

| Requirement | Status | Evidence |
|------------|--------|----------|
| Approval gateway defaults to DENY on timeout | **Compliant** | Fail-safe timeout behavior. |
| Pending approvals resurface on reconnect | **Compliant** | SQLite-persisted pending approvals resurfaced to reconnecting clients. |
| No operation proceeds without consent | **Compliant** | Policy default is deny. Explicit allow rules required. |
| Retry escalates to human | **Compliant** | One automatic retry, then human escalation. |
| Audit write failure blocks the request | **Compliant** | If audit cannot be written, the action is not performed (with health.status and session.close exemptions). |

<!-- [v2: CHANGED] Added NNF-7 and NNF-8 -->
### 5.8.0 Non-Negotiable Findings (NNF-7, NNF-8)

**NNF-7: Authentication failure rate limiting.** IP-based rate limiting on failed auth attempts: 10 failures per minute per source IP, exponential backoff. Lockout after 50 consecutive failures. See Section 3a SEC-5 fix.

**NNF-8: Telegram messages MUST NOT reach file-access-capable backends.** Structural enforcement via `intent_type` classification + policy rules, not keyword blocklist. Telegram clients can ONLY submit `intent_type: "cognitive"`. Policy enforcer checks `client_type` x `intent_type` -- structural check, not keyword matching. Document residual risk: LLM prompt injection at headless core layer is out of scope for control plane enforcement.

### 5.8.1 Secrets Bootstrap Documentation (NNF-5)

The age-encrypted secrets provisioning works as follows:

**Encrypted secrets storage:**
```
/etc/observer/secrets.age/
  core-auth-token.age             # Encrypted core auth token
  client-tokens/
    cli.token.age                 # Encrypted CLI client token
    telegram.token.age            # Encrypted Telegram client token
    gui.token.age                 # Encrypted GUI client token
```

**Age identity key:**
- Stored at `/root/.config/age/key.txt`
- File permissions: 0400, owned by root
- Protected by host full-disk encryption (LUKS or ZFS native encryption)
- Backup: paper copy or USB stick stored separately from the server

**Boot-time provisioning sequence:**
1. VM boots. Full-disk encryption unlocked (passphrase at boot or TPM).
2. systemd starts `observer-secrets.service` (oneshot, before control plane).
3. `provision-secrets.sh` runs as root:
   - Creates `/run/secrets/observer/` tmpfs mount (if not already mounted).
   - Decrypts each `.age` file using the identity key at `/root/.config/age/key.txt`.
   - Writes decrypted content to `/run/secrets/observer/` with 0400 permissions owned by the service user.
4. Control plane service starts, reads tokens from `/run/secrets/observer/`.

**Cold boot test:** Power cycle the VM. Verify:
- Services come up automatically without manual intervention.
- `/run/secrets/observer/` is populated with decrypted tokens.
- Control plane accepts authenticated requests.
- No secrets persist on disk outside the age-encrypted files.

**Key rotation:**
1. Generate new random token: `openssl rand -hex 32 > /tmp/new-token.txt`
2. Encrypt with age: `age -e -i /root/.config/age/key.txt -o /etc/observer/secrets.age/client-tokens/cli.token.age /tmp/new-token.txt`
3. Shred plaintext: `shred -u /tmp/new-token.txt`
4. Restart service: `systemctl restart observer-control-plane`
5. Update the CLI client's stored token to match.

### 5.8.2 Backend Invocation Sandboxing (NNF-6) -- Phase 2

Phase 2 adds bubblewrap-based sandboxing for backend CLI invocations. This section documents the target design; implementation is deferred.

**Bubblewrap sandbox profile per backend:**

```bash
bwrap \
  --ro-bind /usr /usr \
  --ro-bind /bin /bin \
  --ro-bind /lib /lib \
  --ro-bind /lib64 /lib64 \
  --ro-bind /etc/resolv.conf /etc/resolv.conf \
  --ro-bind /etc/ssl /etc/ssl \
  --ro-bind "$HOME/.config/claude" "$HOME/.config/claude" \  # Only THIS backend's creds
  --bind "$WORKING_DIR" "$WORKING_DIR" \                      # Read-write working dir
  --tmpfs /tmp \
  --proc /proc \
  --dev /dev \
  --unshare-all \
  --share-net \                                                # Needs network for API calls
  --die-with-parent \
  -- \
  claude --print --output-format json "$PROMPT"
```

Each backend profile allows read access to only its own `~/.config/<tool>/` directory. No backend can read another backend's credentials. Working directory is the only read-write mount. This makes credential isolation structural (Invariant 2).

<!-- [v2: CHANGED] Replaced keyword-based Telegram intent filtering with structural enforcement (SEC-7) -->
### 5.8.3 Telegram Security (Structural Enforcement)

Telegram clients can ONLY submit `intent_type: "cognitive"`. Policy enforcer checks `client_type` x `intent_type` -- structural check, not keyword matching. This replaces the previous keyword-based intent filtering approach.

**Residual risk:** LLM prompt injection at the headless core layer is out of scope for control plane enforcement. The control plane structurally prevents Telegram from reaching file-access-capable backends, but cannot prevent a cognitive backend from being tricked by adversarial prompts.

---

## 6. Testing Strategy

### 6.1 Testing Framework and Principles

<!-- [v2: CHANGED] Replaced "bun test" with vitest (Gap 14 fix) -->
**Framework:** `vitest` (fast, ESM-native, TypeScript-first). Tests run on Node.js 22 LTS via tsx. One runtime for development, testing, and production, consistent with Section 1.2.

**Core principles:**
1. Security-critical components (policy enforcer, audit sanitizer, credential isolation) get the most exhaustive tests.
2. Integration tests use real SQLite databases (in-memory mode) and real HTTP servers (in-process). No mocks for security boundaries.
3. Every credential isolation mechanism has a dedicated verification test.
4. Phase 1 required tests must pass before deployment. Phase 2 tests are documented but not blocking.

### 6.2 Unit Tests

| Component | Test Focus | Key Test Cases | Phase |
|-----------|-----------|---------------|-------|
| **Policy Enforcer** | Rule evaluation, condition matching, default deny | All condition types (method_match, client_type_match, intent_contains, rate_check, and/or/not). First-match-by-priority. Default deny when no rules match. Invalid config produces clear error. | 1 (required) |
| **Audit Sanitizer** | Credential pattern detection, entropy detection, path redaction | Known credential formats (sk-..., AIza..., ghp_..., etc.). High-entropy strings near credential context words. Sensitive file path patterns. False positive rate on normal text. | 1 (required) |
| **Session Manager** | State machine transitions, lifecycle | Create/retrieve/resume/close sessions. Valid and invalid state transitions (cannot submit turn to completed thread). Idle timeout at 72 hours. SQLite persistence across simulated restart. | 1 (required) |
| **Approval Gateway** | Timeout handling, decision routing, tier behavior, channel restrictions | Timeout results in denial (fail-safe). First-response-wins for dual responses (409 on second). `approval_channels` restricts Telegram from approve/escalate tiers. Block tier rejects immediately. Pending approvals persist and resurface. | 1 (required) |
| **Audit Logger** | JSONL write correctness, SQLite index, rotation | Events written to JSONL with fsync. SQLite index matches JSONL content. Rotation at configured size threshold. Archives set to 0400. Rebuild script recreates SQLite from JSONL. | 1 (required) |
| **Router** | Routing table, timeout handling | Routes to correct core endpoint based on intent_type. Timeout returns error after configured period. Retry logic for transient failures. Health check detects core unavailability. | 1 (required) |
| **Dispatch Router** | Config-driven routing, sensitivity filtering | Mode 1 (specify) routes to human-specified backend. Sensitivity routing blocks confidential slices from low-trust backends. Invalid config produces clear error at load time. | 1 (required) |
| **Backend Executor** | Process spawning, env sanitization, timeout, kill chain | See Section 6.3 (dedicated credential isolation tests). Timeout triggers SIGTERM -> 10s grace -> SIGKILL. Process group kill (`-pid`). Partial output from killed process marked `status: timeout`. | 1 (required) |
| **Health Monitor** | Status computation, transition detection, version checks | Reports correct health for all components. Detects status transitions. Version mismatch against `pinned_version` sets `degraded` status. | 1 (required) |
| **Config Validator** | Schema validation, startup failure modes | See Section 6.4 (dedicated config validation tests). | 1 (required) |

### 6.3 Credential Isolation Tests (Security-Critical)

These tests directly verify the mechanisms described in Section 5.2 and the EX-6 response. They are the highest-priority tests in the system.

```typescript
describe('Credential Isolation (EX-6 Prevention)', () => {

  describe('sanitizedEnv()', () => {
    it('returns only the allowed environment variables', () => {
      const env = sanitizedEnv();
      const allowedKeys = [
        'PATH', 'HOME', 'TERM', 'LANG', 'USER',
        'XDG_CONFIG_HOME', 'XDG_DATA_HOME'
      ];
      expect(Object.keys(env).sort()).toEqual(allowedKeys.sort());
    });

    it('does not include any credential-like variables', () => {
      const env = sanitizedEnv();
      for (const key of Object.keys(env)) {
        expect(key).not.toMatch(/_API_KEY$/i);
        expect(key).not.toMatch(/_SECRET$/i);
        expect(key).not.toMatch(/_TOKEN$/i);
        expect(key).not.toMatch(/^ANTHROPIC_/i);
        expect(key).not.toMatch(/^OPENAI_/i);
        expect(key).not.toMatch(/^GOOGLE_API/i);
      }
    });

    it('does not spread process.env', () => {
      // Set a canary env var and verify it does NOT appear
      process.env.__TEST_CANARY_SECRET__ = 'should-not-appear';
      const env = sanitizedEnv();
      expect(env.__TEST_CANARY_SECRET__).toBeUndefined();
      delete process.env.__TEST_CANARY_SECRET__;
    });
  });

  describe('auditParentEnvironment()', () => {
    it('strips forbidden env vars from process.env', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.OPENAI_API_KEY = 'test-key';
      process.env.GOOGLE_API_KEY = 'test-key';
      process.env.MY_SECRET = 'test-secret';

      auditParentEnvironment();

      expect(process.env.ANTHROPIC_API_KEY).toBeUndefined();
      expect(process.env.OPENAI_API_KEY).toBeUndefined();
      expect(process.env.GOOGLE_API_KEY).toBeUndefined();
      expect(process.env.MY_SECRET).toBeUndefined();
    });

    it('preserves non-credential env vars', () => {
      process.env.SAFE_VARIABLE = 'keep-this';
      auditParentEnvironment();
      expect(process.env.SAFE_VARIABLE).toBe('keep-this');
      delete process.env.SAFE_VARIABLE;
    });
  });

  describe('validateArgs()', () => {
    it('rejects arguments containing credential patterns', () => {
      expect(() => validateArgs(['--key', 'sk-abc123def456ghi789jkl'])).toThrow(
        /Credential pattern detected/
      );
    });

    it('rejects high-entropy strings', () => {
      const highEntropyString = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8';
      expect(() => validateArgs([highEntropyString])).toThrow(
        /High-entropy string detected/
      );
    });

    it('allows normal task descriptions', () => {
      expect(() =>
        validateArgs(['--print', 'Refactor the login module to use async/await'])
      ).not.toThrow();
    });
  });

  describe('sanitizeOutput()', () => {
    it('redacts Anthropic API keys', () => {
      const output = 'Found key: sk-ant-api03-abcdefghijklmnop';
      expect(sanitizeOutput(output)).toContain('[REDACTED:anthropic-key]');
      expect(sanitizeOutput(output)).not.toContain('sk-ant-api03');
    });

    it('redacts Google API keys', () => {
      const output = 'Key is AIzaSyA12345678901234567890123456789012';
      expect(sanitizeOutput(output)).toContain('[REDACTED:google-api-key]');
    });

    it('redacts GitHub tokens', () => {
      const output = 'Token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij';
      expect(sanitizeOutput(output)).toContain('[REDACTED:github-token]');
    });

    it('redacts JWTs', () => {
      const jwt =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      expect(sanitizeOutput(jwt)).toContain('[REDACTED:jwt]');
    });

    it('redacts sensitive file paths', () => {
      const output = 'Config at /home/adam/.config/claude/credentials';
      expect(sanitizeOutput(output)).toContain('[REDACTED:');
    });

    it('preserves normal output', () => {
      const output = 'Successfully refactored 12 files in src/';
      expect(sanitizeOutput(output)).toBe(output);
    });
  });

  describe('end-to-end: child process receives no credentials', () => {
    it('dispatched process env contains no API keys', async () => {
      // Dispatch a test slice that runs: env > /tmp/test-child-env.txt
      // Then read the file and verify no credential patterns
      const result = await dispatch({
        dispatch_id: 'dsp_test_env_check',
        mode: 'specify',
        slice: {
          id: 'test-slice',
          description: 'Print environment variables',
          type: 'exploration',
          context_files: [],
          working_directory: '/tmp/test-workspace',
        },
        target_backend: 'env-printer-test-backend',
      });

      // Verify no credential patterns in captured env
      expect(result.stdout_log).not.toMatch(/sk-/);
      expect(result.stdout_log).not.toMatch(/AIza/);
      expect(result.stdout_log).not.toMatch(/ANTHROPIC/i);
      expect(result.stdout_log).not.toMatch(/OPENAI/i);
      expect(result.stdout_log).not.toMatch(/_API_KEY=/i);
      expect(result.stdout_log).not.toMatch(/_SECRET=/i);
      expect(result.stdout_log).not.toMatch(/_TOKEN=/i);
    });
  });

  describe('audit trail contains no credentials', () => {
    it('audit events have sanitized details', async () => {
      // Submit a turn whose output contains a known credential
      // Verify the credential does NOT appear in any audit event
      const events = await auditLogger.query({ limit: 100 });
      for (const event of events) {
        const details = JSON.stringify(event.details);
        expect(details).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
        expect(details).not.toMatch(/AIza[a-zA-Z0-9_-]{35}/);
        expect(details).not.toMatch(/ghp_[a-zA-Z0-9]{36}/);
      }
    });
  });
});
```

<!-- [v2: CHANGED] Added cross-VM request sanitization test -->
### 6.3.1 Cross-VM Sanitization Tests

```typescript
describe('Cross-VM Request Sanitization', () => {
  it('captures HTTP request body sent to core and verifies contains_sensitive flag', async () => {
    // Submit a turn with message containing credential patterns
    // Capture the HTTP request body sent to the core
    // Verify contains_sensitive is set to true
  });
});
```

<!-- [v2: CHANGED] Added Session Store persistence sanitization test -->
### 6.3.2 Session Store Persistence Tests

```typescript
describe('Session Store Persistence', () => {
  it('verifies turn messages and attachments are sanitized before SQLite persistence', async () => {
    // Submit a turn with message containing known credential pattern
    // Query session store directly
    // Verify credential is redacted in stored content
  });
});
```

### 6.4 Config Validation Tests

```typescript
describe('Config Validation', () => {
  describe('control-plane.yaml', () => {
    it('rejects host other than 127.0.0.1', () => {
      const config = loadConfig({ server: { host: '0.0.0.0' } });
      expect(config.success).toBe(false);
      expect(config.error).toContain('host');
    });

    it('rejects missing auth token directory', () => {
      const config = loadConfig({ auth: { token_dir: '/nonexistent/' } });
      expect(config.success).toBe(false);
    });

    it('rejects duplicate policy rule IDs', () => {
      const config = loadConfig({
        policies: {
          rules: [
            { id: 'rule-1', priority: 1 },
            { id: 'rule-1', priority: 2 },  // Duplicate
          ],
        },
      });
      expect(config.success).toBe(false);
    });

    it('rejects duplicate policy rule priorities', () => {
      const config = loadConfig({
        policies: {
          rules: [
            { id: 'rule-1', priority: 1 },
            { id: 'rule-2', priority: 1 },  // Duplicate priority
          ],
        },
      });
      expect(config.success).toBe(false);
    });

    it('validates approval_channels restrict Telegram from approve/escalate', () => {
      // This is a warning, not a hard failure -- but should be tested
      const config = loadConfig({
        approvals: {
          approval_channels: {
            approve: { allowed_clients: ['cli', 'telegram'] },  // Telegram in approve!
          },
        },
      });
      // Should either fail or produce a prominent warning
    });
  });

  describe('execution-backends.yaml', () => {
    it('rejects routing_mode other than specify for Phase 1', () => {
      const config = loadBackendConfig({ routing_mode: 'council' });
      expect(config.success).toBe(false);
    });

    it('rejects default_backend referencing disabled backend', () => {
      const config = loadBackendConfig({
        default_backend: 'opencode-free',
        backends: { 'opencode-free': { enabled: false } },
      });
      expect(config.success).toBe(false);
    });

    it('rejects confidential sensitivity allowing low-trust backend', () => {
      const config = loadBackendConfig({
        sensitivity: {
          confidential: { allowed_backends: ['opencode-free'] },
        },
        backends: { 'opencode-free': { trust_level: 'low' } },
      });
      expect(config.success).toBe(false);
    });

    it('validates --validate-config flag exits with code 0 for valid config', () => {
      // Run the server with --validate-config and a known-good config
      // Assert exit code 0
    });

    it('validates --validate-config flag exits with code 1 and clear error for invalid config', () => {
      // Run the server with --validate-config and a known-bad config
      // Assert exit code 1 and error message identifying the problem
    });
  });
});
```

### 6.5 Kill Chain and Timeout Tests

These tests verify the Sentry's requirement for explicit process kill semantics.

```typescript
describe('Backend Kill Chain', () => {
  it('sends SIGTERM first, then SIGKILL after grace period', async () => {
    // Spawn a backend that ignores SIGTERM (sleep loop)
    // Verify SIGTERM is sent at timeout
    // Verify SIGKILL is sent 10 seconds later
    // Verify process is dead
  });

  it('uses process group kill to clean up child processes', async () => {
    // Spawn a backend that forks its own children
    // Trigger timeout
    // Verify process.kill(-pid) is called (process group kill)
    // Verify all children are dead
  });

  it('captures partial output from killed process', async () => {
    // Spawn a backend that produces output then hangs
    // Trigger timeout
    // Verify partial output is captured
    // Verify result has status: timeout (not status: failed)
  });

  it('orphaned process cleanup on server restart', async () => {
    // Simulate: start dispatch, record PID, simulate crash
    // On restart: verify cleanup routine finds and kills orphaned PID
    // Verify sessions with in-flight dispatches transition to "interrupted"
  });

  it('cross-VM timeout exceeds dispatch timeout', () => {
    // Verify: core.timeout_ms >= max(backend.timeout_seconds * 1000) + margin
    const config = loadConfig();
    const backendConfig = loadBackendConfig();
    const maxBackendTimeout = Math.max(
      ...Object.values(backendConfig.backends)
        .filter((b: any) => b.enabled)
        .map((b: any) => b.timeout_seconds * 1000)
    );
    expect(config.core.timeout_ms).toBeGreaterThanOrEqual(
      maxBackendTimeout + 30000  // 30s margin for validation overhead
    );
  });
});
```

### 6.6 Integration Tests

**Approach:** Spin up a real control plane server (in-process) with an in-memory SQLite database, connected to a mock headless core (HTTP server returning canned responses). Test end-to-end flows.

| Test | Description | Phase |
|------|-------------|-------|
| **Happy path** | `session.create` -> `thread.create` -> `turn.submit` -> events returned -> `turn.completed` -> `session.close` | 1 (required) |
| **Policy denial** | Telegram client submits a build request -> policy denies -> appropriate error returned | 1 (required) |
| **Approval flow** | Request triggers approval -> `approval.requested` event -> `approval.respond` -> request proceeds | 1 (required) |
| **Approval timeout** | Request triggers approval -> no response -> timeout -> denial (fail-safe) | 1 (required) |
| **Approval channel restriction** | Telegram client attempts to respond to approve-tier approval -> rejected with error | 1 (required) |
| **Dual approval response** | Two clients respond to same approval -> first wins, second gets 409 | 1 (required) |
| **Session resume** | Create session -> simulate disconnect -> resume -> pending approvals resurfaced | 1 (required) |
| **Session idle timeout** | Create session -> wait beyond idle timeout -> session auto-closed | 1 (required) |
| **Rate limiting** | Exceed configured rate -> rate_limit error returned with retry_after | 1 (required) |
| **Auth failure** | Request without Bearer token -> AuthRequired error. Request with wrong token -> AuthFailed error. | 1 (required) |
| **Audit integrity** | Perform several operations -> verify JSONL file contains all events -> verify SQLite index matches -> verify no credentials in either | 1 (required) |
| **Config validation failure** | Start server with invalid config -> verify clear error message and exit code 1 | 1 (required) |
| **Backend dispatch with env check** | Dispatch to a test backend that prints env -> verify no credential variables in output | 1 (required) |
| **Backend version mismatch** | Configure backend with wrong `pinned_version` -> verify health status is `degraded` | 1 (required) |
| **Graceful shutdown** | Submit request, send SIGTERM, verify in-flight request completes, verify audit flushed | 1 (required) |
| **Startup recovery** | Simulate crash with sessions in `processing` state -> restart -> verify sessions transition to `interrupted` | 2 |
| **Bubblewrap sandbox** | Dispatch to sandboxed backend -> verify it cannot read other backends' credentials | 2 |
| **Cross-VM communication** | Full end-to-end with real Tailscale connection between test VMs | 2 |

### 6.7 Smoke Test Script

A deployment verification script that runs after every deployment to verify basic functionality.

```bash
#!/bin/bash
# scripts/smoke-test.sh
# Run after deployment to verify basic functionality.
# Exit code 0 = all checks passed. Non-zero = failure.

set -euo pipefail

BASE_URL="http://127.0.0.1:9000/rpc"
TOKEN=$(cat /run/secrets/observer/client-tokens/cli.token)
PASS=0
FAIL=0

rpc() {
  local method="$1"
  local params="$2"
  local id="$3"
  local auth="${4:-}"

  local headers="-H 'Content-Type: application/json'"
  if [ -n "$auth" ]; then
    headers="$headers -H 'Authorization: Bearer $auth'"
  fi

  eval curl -s -X POST "$BASE_URL" $headers \
    -d "{\"jsonrpc\":\"2.0\",\"method\":\"$method\",\"params\":$params,\"id\":$id}"
}

check() {
  local name="$1"
  local condition="$2"
  if eval "$condition"; then
    echo "  PASS: $name"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $name"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Observer Control Plane Smoke Test ==="
echo ""

# 1. Health check (no auth)
echo "1. Health Check"
HEALTH=$(rpc "health.status" "{}" 1)
check "Server healthy" "echo '$HEALTH' | jq -e '.result.server.status == \"healthy\"' > /dev/null 2>&1"

# 2. Auth required
echo "2. Authentication"
NOAUTH=$(rpc "session.create" '{"client_type":"cli","client_id":"smoke"}' 2)
check "Rejects unauthenticated request" "echo '$NOAUTH' | jq -e '.error.code == -32000' > /dev/null 2>&1"

# 3. Session lifecycle
echo "3. Session Lifecycle"
SESSION=$(rpc "session.create" '{"client_type":"cli","client_id":"smoke-test"}' 3 "$TOKEN")
SESSION_ID=$(echo "$SESSION" | jq -r '.result.session_id')
check "Session created" "[ '$SESSION_ID' != 'null' ] && [ -n '$SESSION_ID' ]"

# 4. Thread creation
echo "4. Thread Creation"
THREAD=$(rpc "thread.create" "{\"session_id\":\"$SESSION_ID\",\"intent\":\"smoke test\"}" 4 "$TOKEN")
THREAD_ID=$(echo "$THREAD" | jq -r '.result.thread_id')
check "Thread created" "[ '$THREAD_ID' != 'null' ] && [ -n '$THREAD_ID' ]"

# 5. Session close
echo "5. Session Close"
CLOSE=$(rpc "session.close" "{\"session_id\":\"$SESSION_ID\"}" 5 "$TOKEN")
check "Session closed" "echo '$CLOSE' | jq -e '.result.closed == true' > /dev/null 2>&1"

# 6. Audit trail
echo "6. Audit Trail"
SESSION2=$(rpc "session.create" '{"client_type":"cli","client_id":"smoke-audit"}' 6 "$TOKEN")
AUDIT=$(rpc "audit.query" '{"limit":10}' 7 "$TOKEN")
EVENT_COUNT=$(echo "$AUDIT" | jq '.result.events | length')
check "Audit events recorded" "[ '$EVENT_COUNT' -gt 0 ]"

# 7. Verify no credentials in audit
echo "7. Credential Leak Check"
AUDIT_DETAILS=$(echo "$AUDIT" | jq -r '.result.events[].details' 2>/dev/null || echo "")
check "No credential patterns in audit" "! echo '$AUDIT_DETAILS' | grep -qiE 'sk-|AIza|ghp_|Bearer [A-Za-z0-9]'"

# 8. Verify JSONL audit file exists and is non-empty
echo "8. JSONL Audit File"
check "JSONL audit file exists" "[ -s data/audit/current.jsonl ]"

# Cleanup
rpc "session.close" "{\"session_id\":$(echo "$SESSION2" | jq '.result.session_id')}" 8 "$TOKEN" > /dev/null 2>&1

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
```

### 6.8 Verification Procedures

Manual verification steps to run periodically (monthly or after significant changes).

```bash
# 1. Verify child process environment contains no credentials
# Dispatch a test slice, capture the child's env
# Assert: no lines matching *KEY*, *TOKEN*, *SECRET*, *CREDENTIAL*

# 2. Verify JSONL audit log contains no credentials
grep -rE 'sk-|AIza|ghp_|gho_|glpat-|xoxb-|Bearer [A-Za-z0-9]' data/audit/*.jsonl
# Expected: zero matches

# 3. Verify pino logs contain no credentials
journalctl -u observer-control-plane --output=cat --since "1 week ago" \
  | grep -iE 'sk-|AIza|ghp_|Bearer [A-Za-z0-9]'
# Expected: zero matches

# 4. Verify config files contain no credentials
grep -rE 'sk-|AIza|ghp_|Bearer' packages/*/config/
# Expected: zero matches (only paths, never values)

# 5. Verify JSONL and SQLite are consistent
# Run rebuild script, compare event counts
node scripts/rebuild-audit-index.js
sqlite3 data/audit-index.db "SELECT COUNT(*) FROM audit_events"
wc -l data/audit/current.jsonl data/audit-archive/*.jsonl
# Counts should match (within recent write buffer)

# 6. Verify localhost binding
ss -tlnp | grep 9000
# Expected: only 127.0.0.1:9000, never 0.0.0.0:9000

# 7. Verify firewall rules
sudo nft list ruleset | grep -A5 "input"
# Expected: default policy drop, Tailscale allowed

# 8. Verify /run/secrets permissions
ls -la /run/secrets/observer/
ls -la /run/secrets/observer/client-tokens/
# Expected: 0400 permissions, correct owner
```

### 6.9 "Done" Criteria Per Component

| Component | Done When | Phase |
|-----------|-----------|-------|
| JSON-RPC Server | Handles all 10 methods. Rejects malformed requests. Binds localhost only (assertion verified). Shuts down gracefully on SIGTERM. Port 9000. | 1 |
| Session Manager | Full CRUD. State machine enforced (invalid transitions return errors). SQLite persistence survives restart. 72-hour idle timeout. Cleanup checks for active work before deleting (no TOCTOU race). | 1 |
| Policy Enforcer | All condition types work. Default deny. Config load with validation. Decision audit trail. `approval_channels` enforcement. | 1 |
| Approval Gateway | Create/respond/timeout all work. First-response-wins with 409 on duplicates. Persistence across restart. Resurfacing on reconnect. Block tier rejects immediately. Approval channel restrictions enforced per tier. | 1 |
| Audit Logger | JSONL primary trail with fsync. SQLite index matches. Dual-layer credential sanitization catches known key formats. Rotation works at 100MB. Archives set to 0400. Rebuild script works. Audit write failure blocks the request. | 1 |
| Router | Routes to correct core endpoints. Timeout/retry works. Cross-VM HTTP with Bearer auth. Health check detects core unavailability within 60 seconds. | 1 |
| Execution Dispatch | Dispatches to 2+ backends. `sanitizedEnv()` verified: no API keys in child env. Output sanitization verified: known patterns redacted. Timeout enforced with kill chain (SIGTERM -> grace -> SIGKILL). Sensitivity routing blocks confidential slices from low-trust backends. Version check against `pinned_version`. | 1 |
| Health Monitor | All components checked at configured intervals. Status transitions detected. `health.status` RPC returns correct data. Backend version mismatch reports `degraded`. | 1 |
| Config Validator | Both config files validated against Zod schemas. `--validate-config` flag works. Clear error messages for every validation failure. | 1 |
| Credential Isolation | All EX-6 prevention tests pass. Smoke test credential leak check passes. Verification procedures documented and executable. | 1 |
| Backend Sandboxing (bubblewrap) | Each backend runs in restricted namespace. Cannot read other backends' credentials. Working directory is only read-write mount. | 2 |
| Cross-VM mTLS | Application-layer mutual authentication on top of Tailscale. Certificate rotation documented. | 2 |
| Binary Integrity | SHA-256 checksum verification of CLI tool binaries before invocation. | 2 |

---

## 7. Deployment and Operations

This section specifies the complete operational lifecycle: how to install, start, stop, monitor, debug, back up, and maintain the Observer system. Every procedure is designed for a solo operator working via SSH from a phone at 2am. If a command requires a GUI, it is wrong.

### 7.1 System Requirements

**Observer Relay VM (Control Plane):**

| Requirement | Specification |
|---|---|
| OS | Debian/Ubuntu LTS or equivalent |
| Runtime | Node.js 22 LTS |
| Package Manager | npm (bun for dev tooling only if desired) |
| Memory | 512MB minimum, 1GB recommended |
| Disk | 5GB for application + audit data |
| Network | Tailscale installed and authenticated |
| Filesystem | ZFS-backed storage for `/home/adam/vault/` |
| Services | systemd |

**CachyOS VM (Dispatch):**

| Requirement | Specification |
|---|---|
| OS | CachyOS (Arch-based) |
| Runtime | Node.js 22 LTS |
| Package Manager | npm |
| Memory | 2GB minimum (CLI backends are memory-hungry) |
| Disk | 20GB for workspaces + backend tooling |
| Network | Tailscale installed and authenticated |
| Filesystem | ZFS-backed storage for `/home/adam/vault/` |
| Services | systemd, Ollama (for local LLM backend) |
| CLI Backends | Claude Code, Gemini CLI, Codex CLI (version-pinned) |

<!-- [v2: CHANGED] Added Node.js version management note for Arch/CachyOS -->
**CachyOS Node.js Note:** Arch Linux ships rolling-release Node.js via `pacman` (typically current, not LTS). Install Node 22 LTS via `fnm` or the `nodejs-lts-jod` AUR package. Update systemd `ExecStart` path accordingly. Verify with `node --version` before first build. See Section 1.2.

**Both VMs:**

- Firewall: default DROP on INPUT/OUTPUT/FORWARD, Tailscale interface allowed
- Time sync: systemd-timesyncd or chrony (clock skew breaks HMAC request signing)
- `age` binary installed for secrets provisioning
- `curl`, `jq`, `sqlite3` available for operational scripts

### 7.2 Installation

**Monorepo setup:**

```bash
# Clone the monorepo (single repo for all Observer components)
cd /home/adam/vault/workspaces/observer
git clone <repo-url> observer-system
cd observer-system

# Install all workspace dependencies
npm install

# Build all packages (TypeScript compilation)
npm run build --workspaces

# Verify the build
node packages/control-plane/dist/server.js --validate-config
node packages/dispatch/dist/dispatch.js --validate-config
```

**Monorepo structure:**

```
observer-system/
  package.json              # Workspace root (npm workspaces)
  tsconfig.base.json        # Shared TypeScript config
  RUNBOOK.md                # Operational quick reference (Section 7.8)
  packages/
    shared/                 # Types, schemas, config loaders
      package.json
      src/
      dist/
    control-plane/          # JSON-RPC server (deploys to Relay VM)
      package.json
      config/
      src/
      dist/
      data/                 # SQLite databases (gitignored)
      scripts/
    dispatch/               # Execution dispatch (deploys to CachyOS VM)
      package.json
      config/
      src/
      dist/
      data/
      scripts/
  scripts/                  # Repo-wide operational scripts
    health-check.sh
    recent-activity.sh
    status.sh
    rotate-token.sh
    provision-secrets.sh
    audit-scan.sh
```

**systemd service installation:**

```bash
# On Relay VM:
sudo cp deploy/observer-control-plane.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable observer-control-plane

# On CachyOS VM:
sudo cp deploy/observer-dispatch.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable observer-dispatch
```

<!-- [v2: CHANGED] Added installation step for observer user -->
**Create service user:** `useradd --system --no-create-home observer`

### 7.3 Configuration

**Configuration files:**

| File | Location | Purpose |
|---|---|---|
| `control-plane.yaml` | `packages/control-plane/config/` | Server settings, policy rules, approval tiers |
| `execution-backends.yaml` | `packages/dispatch/config/` | Backend definitions, routing, timeouts |
| `control-plane.example.yaml` | Same directory | Documented template (committed to git) |
| `execution-backends.example.yaml` | Same directory | Documented template (committed to git) |

All configuration is human-edited YAML loaded at startup. No hot-reload. Changes require `systemctl restart`. This is deliberate: Adam always knows the running config matches the file on disk.

Config files include inline comments documenting every field. The `.example.yaml` files are the reference documentation.

**Config validation:** Both services support a `--validate-config` flag that checks config against Zod schemas without starting the server. If validation fails, the error message identifies the exact field and constraint that failed.

**Secrets provisioning with age (NNF-5):**

Secrets are encrypted at rest using `age` and decrypted to tmpfs at service startup. This section documents the complete bootstrap chain per the Security Auditor's NNF-5 requirement.

**Age identity key location:**

```
/root/.config/age/key.txt     # Mode 0400, owned by root
```

This file is the age identity key used to decrypt all Observer secrets. It is protected by:
1. Filesystem permissions (0400, root-only)
2. Full-disk encryption on the VM's underlying storage (ZFS encryption or LUKS)
3. Proxmox VM isolation (only accessible from within the VM)

Adam must decide and document which of these layers he relies on. The age identity key must be backed up offline (paper printout, USB stick in a secure location, or equivalent). If this key is lost, all encrypted secrets must be regenerated from source (API provider dashboards, token regeneration).

**Encrypted secrets layout (committed to git, safe to store):**

```
secrets/
  control-plane/
    core-auth-token.age          # Cross-VM authentication
    client-tokens/
      cli.token.age              # CLI client auth
      telegram.token.age         # Telegram client auth
      gui.token.age              # Future GUI client auth
  dispatch/
    # Backend CLI tools use their own credential stores
    # No dispatch-specific secrets in Phase 1
  telegram/
    bot-token.age                # Telegram Bot API token
```

**Runtime secrets layout (tmpfs, never persisted):**

```
/run/secrets/observer/
  core-auth-token                # Plaintext, mode 0400
  telegram-bot-token             # Plaintext, mode 0400
  client-tokens/
    cli.token                    # Plaintext, mode 0400
    telegram.token               # Plaintext, mode 0400
    gui.token                    # Plaintext, mode 0400
```

<!-- [v2: CHANGED] Fixed bash globbing bug in provision-secrets.sh -->
**Provisioning script (`scripts/provision-secrets.sh`):**

```bash
#!/bin/bash
set -euo pipefail

AGE_KEY="/root/.config/age/key.txt"
SECRETS_DIR="/run/secrets/observer"
ENCRYPTED_DIR="$(dirname "$0")/../secrets"

# Verify age key exists
if [[ ! -f "$AGE_KEY" ]]; then
  echo "FATAL: Age identity key not found at $AGE_KEY" >&2
  exit 78  # EX_CONFIG
fi

# Create tmpfs mount if not present
if ! mountpoint -q "$SECRETS_DIR"; then
  mkdir -p "$SECRETS_DIR"
  mount -t tmpfs -o size=1M,mode=0700 tmpfs "$SECRETS_DIR"
fi

# Decrypt each secret
# [v2: CHANGED] Fixed bash globbing: replaced **/*.age with find command
mkdir -p "$SECRETS_DIR/client-tokens"

find "$ENCRYPTED_DIR" -name '*.age' | while read -r encrypted_file; do
  relative="${encrypted_file#$ENCRYPTED_DIR/}"
  plaintext="${relative%.age}"
  target="$SECRETS_DIR/$plaintext"

  mkdir -p "$(dirname "$target")"
  age -d -i "$AGE_KEY" "$encrypted_file" > "$target"
  chmod 0400 "$target"
done

# Verify all required files exist and are non-empty
for required in core-auth-token client-tokens/cli.token; do
  if [[ ! -s "$SECRETS_DIR/$required" ]]; then
    echo "FATAL: Required secret missing or empty: $required" >&2
    exit 78
  fi
done

echo "Secrets provisioned successfully to $SECRETS_DIR"
```

### 7.4 Startup Sequence

The startup sequence is defined precisely. Each step must succeed before the next begins. Failure at any step prevents the service from accepting connections.

<!-- [v2: CHANGED] Fixed ExecStartPre: prefix with + for root execution. Keep User=observer. -->
**systemd service unit (Relay VM -- control plane):**

```ini
[Unit]
Description=Observer Control Plane (JSON-RPC)
After=network-online.target tailscaled.service
Wants=network-online.target

[Service]
Type=simple
User=observer
WorkingDirectory=/home/adam/vault/workspaces/observer/observer-system/packages/control-plane
ExecStartPre=+/home/adam/vault/workspaces/observer/observer-system/scripts/provision-secrets.sh
ExecStart=/usr/bin/node dist/server.js
Restart=on-failure
RestartSec=5
RestartPreventExitStatus=78
StandardOutput=journal
StandardError=journal

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/home/adam/vault/workspaces/observer/observer-system/packages/control-plane/data
PrivateTmp=true

# Resource limits
MemoryMax=512M
TasksMax=64

[Install]
WantedBy=multi-user.target
```

<!-- [v2: CHANGED] Added systemd hardening notes -->
**systemd Hardening Notes:**
- Minimum systemd version requirement: >= 249
- Verification step: `systemd-analyze security observer-control-plane`
- RUNBOOK troubleshooting: "If EACCES on data writes, add path to ReadWritePaths, daemon-reload, restart"

**systemd service unit (CachyOS VM -- dispatch):**

```ini
[Unit]
Description=Observer Dispatch Layer
After=network-online.target tailscaled.service ollama.service
Wants=network-online.target

[Service]
Type=simple
User=adam
WorkingDirectory=/home/adam/vault/workspaces/observer/observer-system/packages/dispatch
ExecStartPre=+/home/adam/vault/workspaces/observer/observer-system/scripts/provision-secrets.sh
ExecStart=/usr/bin/node dist/dispatch.js
Restart=on-failure
RestartSec=5
RestartPreventExitStatus=78
StandardOutput=journal
StandardError=journal

NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/home/adam/vault/workspaces/observer/observer-system/packages/dispatch/data
ReadWritePaths=/home/adam/vault/workspaces
PrivateTmp=true

MemoryMax=2G
TasksMax=128

[Install]
WantedBy=multi-user.target
```

**Application startup routine (both services):**

The `server.ts` / `dispatch.ts` entry point executes the following steps in order:

```
Step 1: ExecStartPre -- Secrets provisioning
  - provision-secrets.sh decrypts age files to /run/secrets/observer/
  - If decryption fails, exits 78 (prevents service start)

Step 2: Config validation
  - Load YAML config file
  - Validate against Zod schema
  - If invalid, log specific field error, exit 78

Step 3: Credential verification
  - Verify all required credential files exist in /run/secrets/observer/
  - Verify files are non-empty
  - Verify file permissions are 0400 (no group/other access)
  - If any check fails, log which file failed, exit 78

Step 4: Orphan process cleanup
  - Scan for child processes from a previous instance
  - Check PID file (data/server.pid) for stale PID
  - If stale PID exists and process is running, send SIGTERM
  - Wait up to 5 seconds, then SIGKILL if still running
  - Clean up PID file

Step 5: Database integrity check
  - Open SQLite databases in WAL mode
  - Run PRAGMA integrity_check on each database
  - If integrity check fails, attempt rebuild from audit JSONL before exiting (see Step 5a)
  - Walk sessions in 'processing' or 'executing' state
  - Transition interrupted sessions to 'interrupted' status
  - Surface interrupted sessions for human review on next client connect

Step 5a: Automated session DB rebuild (v2 addition)
  - If integrity check fails, attempt rebuild from audit JSONL
  - Provide scripts/rebuild-sessions.sh
  - If rebuild fails, log error and exit 1

Step 6: Bind listeners
  - Start HTTP server on 127.0.0.1:<configured_port>
  - Verify binding succeeded (fail if port already in use)
  - Write PID file to data/server.pid
  - Log "Observer Control Plane started on 127.0.0.1:<port>"
  - Begin accepting connections
```

<!-- [v2: CHANGED] Added startup grace period -->
**Startup Grace Period:** 120 seconds after control plane boot during which dispatch unreachability is logged as `booting` rather than `unreachable`. After grace period, treated as genuine failure.

<!-- [v2: CHANGED] Added startup rate limiter -->
**Startup Rate Limiter:** 10 req/min for first 60 seconds after boot (prevents restart-loop amplification from flood attacks).

**Boot order across VMs:**

1. Both VMs auto-start via Proxmox
2. Tailscale connects on both VMs (systemd dependency)
3. CachyOS dispatch service starts first (it is the dependency)
4. Relay control plane starts, performs health check against dispatch
5. If dispatch is unreachable, control plane starts in degraded mode (accepts connections but returns `BackendUnavailable` for dispatch requests)

### 7.5 Shutdown Sequence

Shutdown is triggered by SIGTERM (from `systemctl stop` or system shutdown). The sequence drains work cleanly before exiting.

**Control plane shutdown:**

```
Step 1: Receive SIGTERM
  - Stop accepting new connections
  - Stop accepting new JSON-RPC requests on existing connections
  - Log "Shutdown initiated, draining in-flight requests"

Step 2: Drain in-flight requests (up to shutdown_timeout_seconds, default 30)
  - Wait for pending JSON-RPC responses to complete
  - Broadcast thread.failed for any active threads that cannot complete
  - Broadcast server.shutting_down event to connected WebSocket clients

Step 2a: Handle pending approvals (v2 addition)
  - Transition all pending approvals to expired with reason server_shutdown
  - Mark corresponding threads as interrupted
  - On restart, surface both for manual resolution

Step 3: Kill child processes
  - Walk the child process registry
  - Send SIGTERM to each process group (process.kill(-pid, 'SIGTERM'))
  - Wait 10 seconds grace period
  - Send SIGKILL to any surviving process groups
  - Log each killed process with PID, backend name, and runtime

Step 4: Flush and close databases
  - Flush pending audit writes
  - Run PRAGMA wal_checkpoint(TRUNCATE) on each database
  - Close all SQLite connections
  - Remove PID file

Step 5: Exit
  - Exit 0 (clean shutdown)
  - If drain timeout exceeded, exit 1 (forced shutdown)
```

**Dispatch layer shutdown follows the same pattern.** The kill chain for backend CLI processes is the critical path:

```
SIGTERM to process group  -->  10 second grace  -->  SIGKILL to process group
```

Process group kill (`kill(-pid)`) is mandatory. CLI backends like Claude Code may spawn their own child processes. Killing only the parent PID leaves orphaned grandchildren. Process group kill terminates the entire tree.

**Partial output from killed processes** is captured and stored with `status: timeout` in the dispatch result. This is distinct from `status: failed` (which indicates the process ran to completion but returned a non-zero exit code). The distinction matters for retry logic: timeouts may succeed on retry, failures may not.

### 7.6 Monitoring and Debugging

**Design principle:** Everything is debuggable with `curl`, `jq`, `journalctl`, and `sqlite3`. These tools are available on every machine Adam uses, including Termux on his phone. No web dashboards. No Grafana. No Prometheus.

**Quick health check:**

```bash
# Control plane health (unauthenticated -- returns liveness data only)
curl -s http://127.0.0.1:9000/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"health.status","params":{},"id":1}' | jq .
```

The `health.status` response includes:

```json
{
  "server": { "status": "healthy", "uptime_seconds": 86400, "memory_mb": 128 },
  "core": { "status": "healthy", "last_check": "2026-02-26T02:15:00Z", "response_time_ms": 45 },
  "backends": {
    "claude-code": { "status": "healthy", "last_check": "..." },
    "gemini-cli": { "status": "unhealthy", "last_check": "..." }
  },
  "audit": { "status": "healthy", "database_size_mb": 12, "event_count": 4521 },
  "pending_approvals": 0,
  "active_sessions": 1
}
```

**Service logs:**

```bash
# Follow control plane logs
journalctl -u observer-control-plane -f

# Recent errors only
journalctl -u observer-control-plane --since "1 hour ago" -p err

# Dispatch layer logs (SSH to CachyOS VM first)
journalctl -u observer-dispatch -f
```

**Audit database queries:**

```bash
# Last 20 audit events
# [v2: CHANGED] Fixed to use actual audit_events table with actual column names
sqlite3 data/audit-index.db "SELECT timestamp, action, session_id FROM audit_events ORDER BY timestamp DESC LIMIT 20"

# Events for a specific session
sqlite3 data/audit-index.db "SELECT * FROM audit_events WHERE session_id='ses_abc123' ORDER BY timestamp"

# Failed dispatches in the last 24 hours
sqlite3 data/audit-index.db "SELECT * FROM audit_events WHERE category='dispatch' AND action LIKE '%failed%' AND timestamp > datetime('now', '-24 hours')"
```

**Phone debugging workflow (SSH via Tailscale from Termux):**

1. `systemctl status observer-control-plane` -- is it running?
2. `curl -s localhost:9000/rpc ... health.status | jq .` -- what does it think its state is?
3. `journalctl -u observer-control-plane --since "1 hour ago" -p err` -- what went wrong?
4. `scripts/status.sh` -- combined dashboard view
5. `scripts/recent-activity.sh` -- what happened while I was away?
6. If needed: `sudo systemctl restart observer-control-plane`

<!-- [v2: CHANGED] Added cross-VM SSH commands to RUNBOOK -->
**Cross-VM Debugging:**
- Add `scripts/full-status.sh` on Relay VM that SSHes to CachyOS and aggregates both services' health.
- Add trace_id / correlation_id: pass from control plane through cross-VM JSON-RPC call, log on both sides. Enables `journalctl | grep trace_id` across VMs.

<!-- [v2: CHANGED] Document Tailscale-is-down failure mode -->
**Tailscale-is-down Failure Mode:**
- What Adam sees: `health.status` returns `core.status: "unreachable"`, `core.tailscale_connected: false`. All `turn.submit` requests return `BackendUnavailable` error.
- What Adam can do from Relay VM: check `tailscale status`, restart Tailscale with `sudo systemctl restart tailscaled`, check network connectivity.
- What Adam can do from CachyOS VM: check `tailscale status`, verify dispatch service is running with `systemctl status observer-dispatch`, submit requests directly to dispatch layer's local endpoint for testing.

### 7.7 Backup and Recovery

**What is backed up and how:**

| Data | Location | Backup Method | Recovery |
|---|---|---|---|
| Source code | `observer-system/` git repo | Git (push to remote) | `git clone` |
| Configuration | `config/*.yaml` (committed) | Git | `git checkout` |
| Encrypted secrets | `secrets/*.age` (committed) | Git | `git checkout` + age identity key |
| Audit database | `data/audit.db` | ZFS snapshots (hourly) | `zfs rollback` or `.backup` |
| Session database | `data/sessions.db` | ZFS snapshots (hourly) | Reconstructible from audit log |
| Age identity key | `/root/.config/age/key.txt` | Offline backup (paper/USB) | Manual restore |

**ZFS snapshot schedule:**

```bash
# Recommended: hourly snapshots with 7-day retention
# Configure via systemd timer or zfs-auto-snapshot
zfs set com.sun:auto-snapshot=true tank/vault
```

**SQLite backup (in addition to ZFS snapshots):**

```bash
# Safe online backup (does not lock the database)
sqlite3 data/audit.db ".backup data/audit-backup.db"
```

This can be run from a cron job or a systemd timer. The `.backup` command uses SQLite's online backup API, which is safe to run while the server is writing.

**What is reconstructible:**

- Session state can be rebuilt from the audit log (every state transition is an audit event)
- Backend health history is ephemeral and not backed up (recomputed from live checks)
- In-flight dispatch results that were not yet persisted are lost on crash. This is acceptable: the human is notified that the dispatch was interrupted and can re-dispatch.

**What is NOT reconstructible:**

- The age identity key. If lost, all encrypted secrets must be regenerated from source providers.
- Audit data older than the oldest ZFS snapshot. If snapshots are pruned and the DB is corrupted, that data is gone.

**Recovery procedure after total loss:**

1. Restore VM from Proxmox backup (or provision new VM)
2. `git clone` the monorepo
3. Restore age identity key from offline backup
4. `npm install && npm run build --workspaces`
5. Install systemd services
6. `sudo systemctl start observer-control-plane`
7. Verify with `scripts/health-check.sh`

### 7.8 Operational Scripts

A `RUNBOOK.md` is required in the monorepo root. This is the single file Adam opens at 2am when something is wrong. It contains exact commands, not explanations.

**RUNBOOK.md contents (required sections):**

```markdown
# Observer Runbook

## Is everything running?
<exact systemctl commands for both VMs>

## Something is broken -- what is it?
<exact health check and log commands>

## How do I restart?
<exact restart commands for each service>

## How do I check recent activity?
<exact recent-activity.sh usage>

## How do I manually submit a request?
<exact curl command with example payload>

## How do I check Tailscale connectivity?
<exact tailscale status commands>

## How do I rotate a compromised secret?
<exact rotation procedure, step by step>

## How do I check disk usage?
<exact ZFS and du commands>

## How do I read the audit log?
<exact sqlite3 queries>
```

**Required operational scripts:**

**`scripts/health-check.sh`:**

Performs a comprehensive health check across both VMs. Returns exit 0 if healthy, exit 1 if degraded, exit 2 if critical. Output is human-readable and terse enough for a phone screen.

```bash
#!/bin/bash
# Usage: ./scripts/health-check.sh
# Checks: control plane health, dispatch health, Tailscale, disk space, DB integrity

echo "=== Observer Health Check ==="

# Control plane
CP_STATUS=$(curl -sf http://127.0.0.1:9000/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"health.status","params":{},"id":1}' 2>/dev/null)

if [ $? -eq 0 ]; then
  echo "Control Plane: $(echo "$CP_STATUS" | jq -r '.result.server.status')"
  echo "  Uptime: $(echo "$CP_STATUS" | jq -r '.result.server.uptime_seconds')s"
  echo "  Pending approvals: $(echo "$CP_STATUS" | jq -r '.result.pending_approvals')"
else
  echo "Control Plane: UNREACHABLE"
fi

# Tailscale
echo "Tailscale: $(tailscale status --json | jq -r '.Self.Online')"

# Disk
echo "Disk: $(df -h /home/adam/vault | tail -1 | awk '{print $5 " used"}')"

# ZFS
echo "ZFS: $(zpool status -x 2>/dev/null || echo 'N/A')"
```

<!-- [v2: CHANGED] Fixed recent-activity.sh to query actual audit_events table with actual column names -->
**`scripts/recent-activity.sh`:**

Summarizes what the system has done since Adam last looked. This is the "what happened while I was away?" script.

```bash
#!/bin/bash
# Usage: ./scripts/recent-activity.sh [duration]
# Examples: ./scripts/recent-activity.sh        # last 24 hours
#           ./scripts/recent-activity.sh 3d     # last 3 days
#           ./scripts/recent-activity.sh 6h     # last 6 hours

DURATION="${1:-24h}"

# Convert duration to SQLite datetime modifier
case "$DURATION" in
  *h) MODIFIER="-${DURATION%h} hours" ;;
  *d) MODIFIER="-${DURATION%d} days" ;;
  *)  MODIFIER="-24 hours" ;;
esac

DB="packages/control-plane/data/audit-index.db"

echo "=== Observer Activity (last $DURATION) ==="
echo ""

echo "--- Sessions ---"
sqlite3 "$DB" "SELECT session_id, action, timestamp FROM audit_events WHERE category='session' AND timestamp > datetime('now', '$MODIFIER') ORDER BY timestamp DESC"

echo ""
echo "--- Dispatches ---"
sqlite3 "$DB" "SELECT session_id, action, timestamp FROM audit_events WHERE category='dispatch' AND timestamp > datetime('now', '$MODIFIER') ORDER BY timestamp DESC"

echo ""
echo "--- Approvals ---"
sqlite3 "$DB" "SELECT session_id, action, timestamp FROM audit_events WHERE category='approval' AND timestamp > datetime('now', '$MODIFIER') ORDER BY timestamp DESC"

echo ""
echo "--- Errors ---"
sqlite3 "$DB" "SELECT timestamp, category, action FROM audit_events WHERE category='security' AND timestamp > datetime('now', '$MODIFIER') ORDER BY timestamp DESC LIMIT 20"
```

<!-- [v2: CHANGED] Added scripts/rebuild-audit-index.sh -->
**`scripts/rebuild-audit-index.sh`:** Rebuilds SQLite index from JSONL files. Reads all JSONL files in `data/audit/` and `data/audit-archive/`, parses each line, and inserts into a fresh SQLite database.

<!-- [v2: CHANGED] Added JSONL file size to health check output -->
**Health check output:** Include JSONL file size in health check output for monitoring audit growth.

**`scripts/status.sh`:**

Combined dashboard showing server health, active sessions, pending approvals, and backend status. Designed to fit on a phone screen.

### 7.9 Secrets Rotation Procedure

Per NNF-5 and the February 2026 incident lessons, every secret in the system has a documented rotation procedure.

**Client token rotation:**

```bash
# 1. Generate new token
NEW_TOKEN=$(head -c 32 /dev/urandom | base64)

# 2. Encrypt and store
echo "$NEW_TOKEN" | age -r "$(cat /root/.config/age/key.txt | grep 'public key' | awk '{print $NF}')" > secrets/control-plane/client-tokens/cli.token.age

# 3. Deploy to tmpfs
echo "$NEW_TOKEN" > /run/secrets/observer/client-tokens/cli.token
chmod 0400 /run/secrets/observer/client-tokens/cli.token

# [v2: CHANGED] Token rotation uses admin.revoke_token for immediate revocation,
# followed by token replacement and restart. The revoke-first approach preserves
# rate limiter state during active compromise (Operator cross-challenge resolution).
# 4. Immediately revoke old token (preserves rate limiter state, stops active abuse):
curl -s -X POST http://127.0.0.1:9000/rpc \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CURRENT_TOKEN" \
  -d '{"jsonrpc":"2.0","method":"admin.revoke_token","params":{"token_hash":"OLD_TOKEN_HASH"},"id":1}'
# 5. Restart server to load new token from config (clears ephemeral revocation list):
sudo systemctl restart observer-control-plane

# 6. Update client configuration to use the new token
```

The `scripts/rotate-token.sh` script automates steps 1-5. The exposure window is the time between compromise detection and running the script.

<!-- [v2: CHANGED] Updated token rotation with coordinated procedure — revoke-first per Operator cross-challenge resolution -->
**If a token is compromised:** (1) immediately call `admin.revoke_token` via CLI to invalidate the old token (stops active abuse, preserves rate limiter state), (2) generate new token, (3) encrypt with age, (4) deploy to both VMs, (5) systemctl restart on both (loads new token, clears ephemeral revocation list — which is fine because the new token is now active).

**Coordinated rotation procedure:** Validate both VMs accept new token before decommissioning old one. Health check verifies cross-VM auth token synchronization.

**Core auth token rotation:**

Same procedure as client tokens, but requires restart of both services (the core auth token is loaded at startup on both VMs). Procedure:

1. Generate new token
2. Encrypt and store in `secrets/control-plane/core-auth-token.age`
3. Deploy to tmpfs on both VMs
4. Restart dispatch service first (CachyOS VM)
5. Restart control plane service (Relay VM)
6. Verify cross-VM health check passes

**Backend credential rotation:**

Backend CLI tools manage their own credentials. Rotation is tool-specific:

| Backend | Credential | Rotation Method |
|---|---|---|
| Claude Code | Anthropic API key or OAuth | `claude auth logout && claude auth login` |
| Gemini CLI | Google OAuth token | `gemini auth revoke && gemini auth login` |
| Codex CLI | OpenAI API key | Regenerate in OpenAI dashboard, update config |
| Ollama | None (local) | N/A |

After rotating any backend credential, run `scripts/health-check.sh` to verify the backend is healthy with the new credential.

**Telegram bot token rotation:**

1. Message @BotFather on Telegram: `/revoke` to invalidate the current token
2. @BotFather issues a new token
3. Encrypt: `echo "$NEW_TOKEN" | age -e -r <public_key> > secrets/telegram/bot-token.age`
4. Deploy to tmpfs: write to `/run/secrets/observer/telegram-bot-token`
5. Restart Telegram client service

### 7.10 Incident Response for Credential Exposure

This procedure is derived from the February 2026 API key exposure incident. When a credential is suspected compromised, speed matters more than elegance.

**Immediate steps (do these first, investigate later):**

```
1. IDENTIFY which credential is exposed
   - Backend API key? Client token? Core auth token? Bot token?

2. REVOKE immediately
   - API key: rotate at the provider (Anthropic dashboard, Google console, etc.)
   - Client token: scripts/rotate-token.sh <client-name>
   - Core auth token: generate new, restart both services
   - Bot token: /revoke via @BotFather

3. VERIFY revocation
   - Old credential no longer works (test with curl)
   - New credential works (test with health-check.sh)

4. AUDIT exposure scope
   - scripts/audit-scan.sh -- retrospective scan for the compromised credential
   - Check: did the credential appear in any audit logs?
   - Check: did the credential appear in any dispatch results?
   - Check: did the credential leave the system (git commits, external APIs)?

5. DOCUMENT
   - What was exposed, when, how
   - What was the exposure window (time between leak and revocation)
   - What remediation was performed
   - What structural change prevents recurrence
```

**If the age identity key is compromised:**

This is the worst case. All encrypted secrets are exposed.

1. Generate a new age identity key on both VMs
2. Re-encrypt all secrets with the new key
3. Rotate every secret in the system (all client tokens, core auth token, bot token)
4. Rotate all backend credentials
5. Deploy new secrets to tmpfs
6. Restart all services
7. Destroy the old identity key backup

---

## 8. Slice Dependency Graph

### 8.1 Dependency Map

All slices live within the `observer-system/` monorepo. Package references use npm workspace imports (`@observer/shared`, `@observer/control-plane`, `@observer/dispatch`).

```
                    +-------------------+
                    |   S0: Shared      |
                    |   Types & Schemas |
                    |   packages/shared/|
                    +---------+---------+
                              |
               +--------------+---------------+
               |              |               |
               v              v               v
    +----------+---+ +-------+------+ +------+-------+
    | S1: Session  | | S2: Policy   | | S3: Audit    |
    | Manager      | | Enforcer     | | Logger       |
    +---------+----+ +------+-------+ +------+-------+
              |             |                |
              +-------+-----+----------------+
                      |
                      v
           +----------+----------+
           | S4: Approval        |
           | Gateway             |
           | (needs S1, S2, S3)  |
           +----------+----------+
                      |
                      v
           +----------+----------+
           | S5: JSON-RPC Server |
           | + Router            |
           | (wires all slices)  |
           +---------------------+


    +-------------------+     +-------------------+
    | S6: Execution     |     | S7: Health        |
    | Dispatch          |     | Monitor           |
    | packages/dispatch/|     | (reads status     |
    | INDEPENDENT       |     |  from others)     |
    +-------------------+     +-------------------+
```

<!-- [v2: CHANGED] Added dotted-line dependency note from S4 to S0's dispatch types -->
**Note:** S4 (Approval Gateway) has a dotted-line dependency on S0's dispatch types for approval context.

### 8.2 Parallelization Groups

**S0: Foundation (must be first)**

| Slice | Package | Contents |
|---|---|---|
| S0 | `packages/shared/` | TypeScript interfaces, Zod schemas, error codes, ID generation, config types |

S0 produces the type contracts that all other slices depend on. It has no runtime logic beyond schema definitions and utility functions.

**Parallel Group 1 (all depend only on S0, can be built simultaneously):**

| Slice | Package | Description | Phase 1 Critical |
|---|---|---|---|
| S1 | `packages/control-plane/src/session/` | Session CRUD, thread lifecycle, SQLite persistence, state machine | Yes |
| S2 | `packages/control-plane/src/policy/` | Pure-function rule evaluation, approval tier determination | Yes |
| S3 | `packages/control-plane/src/audit/` | Append-only JSONL primary + SQLite index, sanitizer | Yes |
| S6 | `packages/dispatch/` | Backend executor, child process management, output capture | Yes |
| S7 | `packages/control-plane/src/health/` | Backend and core availability tracking, status aggregation | Yes |

All five slices in this group can be developed and tested independently. Each has its own test suite validating against the S0 type contracts.

<!-- [v2: CHANGED] Added S2 (Policy Enforcer) as critical path item with 1-week buffer -->
**Critical Path Note:** S2 (Policy Enforcer) is on the critical path because S4 depends on it directly. Alternative: build S4 with a mock policy enforcer to decouple, adding 1-week buffer.

**Sequential Group (depends on Parallel Group 1):**

| Slice | Package | Depends On | Phase 1 Critical |
|---|---|---|---|
| S4 | `packages/control-plane/src/approval/` | S1, S2, S3 | Yes |
| S5 | `packages/control-plane/src/` (server.ts, router, transport) | S1, S2, S3, S4, S7 | Yes |

S4 (Approval Gateway) needs session state (S1) to know which session owns the approval, policy rules (S2) to determine the approval tier, and audit logging (S3) to record the decision. It cannot be built until those three are testable.

S5 (JSON-RPC Server + Router) is the integration layer that wires everything together. It is the last piece. It depends on all other control plane slices.

### 8.3 Build Order Summary

<!-- [v2: CHANGED] Revised timeline: "5 weeks" to "8-10 weeks for solo development." -->
```
Week 1-2:  S0 (shared types and schemas)
Week 3-5:  S1 + S2 + S3 + S6 + S7 (parallel group -- built serially by solo developer)
Week 6-7:  S4 (approval gateway, depends on S1/S2/S3)
Week 8-9:  S5 (server + router, integration layer)
Week 10:   Cross-VM integration testing, systemd setup, operational scripts
```

The parallel group (S1-S3, S6-S7) is listed as parallel for dependency purposes but will be built serially by a solo developer. The 5-week timeline from v1 assumes AI-assisted parallel development. The 8-10 week timeline is realistic for solo development.

<!-- [v2: CHANGED] Note: dispatch layer "config reload without restart" ISC criterion removed -->
**Note:** Both services require restart for config changes. Consistent policy. The dispatch layer's "config reload without restart" ISC criterion has been removed.

### 8.4 Phase 1 vs Phase 2 Scope

**Phase 1 (minimal viable system -- Operator's 7-point recommendation):**

1. Single monorepo (not two repos)
2. HTTP-only transport (no WebSocket)
3. Mode 1 dispatch only (human specifies backend)
4. Flat directory structure (4-5 directories per package, not 8)
5. curl scripts for CLI interaction (no TUI tool)
6. Node.js 22 LTS only (no Bun runtime split)
7. Thread model only (defer full Session > Thread > Turn > Item hierarchy until multi-client)

All 8 slices (S0-S7) are Phase 1 critical, but each is built in its simplest form. Phase 1 success criteria: Adam can `curl` the control plane, have it route to Claude Code on CachyOS via Tailscale, get a result back, and see it in the audit log.

**Phase 2 (after Phase 1 is operational):**

- WebSocket transport for streaming events
- Telegram client integration
- Mode 2 dispatch (config-recommended backend)
- Credential isolation via separate Unix users or bubblewrap sandboxing (NNF-1, NNF-6)
- Mutual TLS for cross-VM communication
- Full Session > Thread > Turn > Item hierarchy
- Approval tier calibration based on Phase 1 usage data

**Phase 3 (future):**

- Council mode dispatch (Mode 3)
- Cost tracking and optimization
- GUI client
- CLI TUI tool

---

## 9. Open Questions (Require Adam's Decision)

Each question is formatted with the context needed to decide, recommendations from the deliberation agents, and a default if Adam does not weigh in. Adam retains final authority on all decisions.

### Q1: Phase 1 Scope -- Accept Operator's 7-Point Minimal Increment?

**Context:** The Operator recommends building the smallest possible increment that proves the architecture works (Section 8.4 above). The Sentry's pre-mortem Scenario 2 warns that aggregate complexity may exceed solo maintainability.

**Architect recommendation:** Build all slices but accept the Operator's scope reduction (HTTP-only, Mode 1 dispatch, curl scripts, no WebSocket).

**Operator recommendation:** Strongly in favor. "The system Adam will actually maintain is the simplest system that works."

**Sentry input:** Supports minimal scope. Scenario 2 ("complexity exceeds solo capacity") is the most likely failure mode.

**Default if Adam does not weigh in:** Accept the 7-point minimal scope. This is the consensus recommendation from three of four agents.

---

### Q2: Credential Isolation Approach -- Phase 1 Environment Sanitization, Phase 2 Separate Users?

**Context:** The Security Auditor's NNF-1 identifies that all backend credentials under `~/.config/` for a single Unix user means any compromised process can access all API keys. The Architect acknowledges this is architecturally correct but argues separate Unix users add operational complexity for a solo developer.

**Architect recommendation:** Phase 1 uses environment sanitization + expanded output sanitizer + debug flag prohibition. Phase 2 adds user isolation.

**Security Auditor finding:** NNF-1 (Critical). Shared user context violates Invariant 1 and Invariant 2.

**Operator input:** Agrees with phasing. "Creating and maintaining a separate system user, managing its home directory, configuring each CLI tool's auth under that user, and debugging permission issues at 2am adds real cognitive load."

**Sentry input:** Accepts the risk for Phase 1 given the minimal scope.

**Default if Adam does not weigh in:** Phase 1 environment sanitization, Phase 2 separate users. The risk is accepted and documented.

---

### Q3: Cross-VM Architecture -- Single VM or Two VMs?

**Context:** The architecture maps the control plane to the Observer Relay VM and dispatch to the CachyOS VM, matching existing infrastructure. The Sentry's pre-mortem Scenario 5 warns this split adds latency, debugging complexity, and fragility that may not be justified for a single-user system.

**Architect recommendation:** Two VMs. Matches existing infrastructure, provides isolation between internet-facing components (Telegram on Relay VM) and code execution (backends on CachyOS VM).

**Sentry concern:** "Premature distribution. The two-VM split was architecturally elegant but operationally unnecessary for a single-user system." Cross-VM latency (200-500ms per dispatch), Tailscale tunnel drops, and dual-VM debugging overhead may outweigh isolation benefits.

**Operator input:** "Two-VM split matching existing infrastructure" is approved as a starting point, but the Sentry's concern is valid.

**Security Auditor input:** Two-VM split provides meaningful isolation. The Relay VM processes internet-facing Telegram traffic. Keeping code execution on a separate VM limits blast radius if the Relay VM is compromised.

**Default if Adam does not weigh in:** Two VMs. The infrastructure already exists, and the security isolation is meaningful. The cross-VM timeout must be configured to exceed max dispatch timeout + validation overhead (see Section 7.4 service units). If Adam finds the operational cost too high during Phase 1, collapsing to one VM is a simplification, not a re-architecture.

---

### Q4: Backend Sandboxing Timing -- Phase 2 Bubblewrap?

**Context:** NNF-6 identifies that backend CLI tools run with full user privileges. Bubblewrap or Linux namespaces can restrict filesystem visibility per backend invocation.

**Architect recommendation:** Phase 2. Phase 1 relies on environment sanitization and the trust assumption that CLI tools from major vendors (Anthropic, Google, OpenAI) are not actively malicious.

**Security Auditor finding:** NNF-6 (Medium-High). Backend invocations should be sandboxed. At minimum, document expected filesystem access per backend.

**Operator input:** Bubblewrap adds another tool Adam must understand and debug. Phase 2 is appropriate.

**Default if Adam does not weigh in:** Phase 2. Phase 1 documents expected filesystem access per backend. Phase 2 adds bubblewrap sandboxing.

---

### Q5: Approval Tier Assignments -- How Conservative?

**Context:** The Sentry's pre-mortem Scenario 3 warns about approval fatigue: if too many operations require manual approval, Adam will rubber-stamp everything, defeating the purpose of human oversight.

**Architect recommendation:** Start with four tiers (auto-approve, notify, approve, block). Tier assignments are configurable in `control-plane.yaml`.

**Sentry concern:** "The tier system was well-designed in theory but the tier ASSIGNMENTS were too conservative, putting too many operations in the 'approve' tier." Recommends starting with more auto-approve and fewer manual approve.

**Operator input:** Agrees with the Sentry. "30-50 approval prompts per session makes meaningful review impossible."

**Security Auditor input:** High-risk approvals (code execution, external API calls, system modification) must require manual approval. Low-risk operations (read-only queries, status checks, non-destructive analysis) should auto-approve.

**Default if Adam does not weigh in:** Start permissive. Auto-approve read-only and analysis operations. Require approval only for code execution, file modification, and external API calls. Adam can tighten tiers after observing real usage patterns. It is easier to add gates than to remove fatigue.

---

### Q6: Secret Management Tool -- age vs Alternatives?

**Context:** The Architect and Operator both recommend `age`. The Security Auditor accepts it.

**Architect recommendation:** `age`. Simple, auditable, single binary, no daemon.

**Operator recommendation:** `age`. "pass requires GPG which is a complexity tarpit. sops is designed for team workflows. age is one tool, one key, done."

**Alternatives considered:**

| Tool | Pros | Cons |
|---|---|---|
| `age` | Simple, single binary, no daemon | No built-in key rotation |
| `pass` | Full password manager | Requires GPG, complex key management |
| `sops` | YAML/JSON-native encryption | Designed for team/cloud workflows |
| `systemd-creds` | Native systemd integration | Tied to specific machine TPM |

**Default if Adam does not weigh in:** `age`. It is the simplest tool that meets the requirements.

---

<!-- [v2: CHANGED] Added Q7: Single-VM collapse -->
### Q7: Single-VM Collapse

**Context:** If Q3 is resolved by collapsing to one VM, the dedicated `observer` user must be reinstated OR bubblewrap sandboxing pulled forward to Phase 1. Two-VM architecture is what makes running as `adam` safe.

**Default if Adam does not weigh in:** Keep two VMs. If collapsing, ensure credential isolation is addressed before removing VM boundary.

---

<!-- [v2: CHANGED] Added Q8: Cross-VM auth strategy -->
### Q8: Cross-VM Auth Strategy

**Context:** Phase 1 uses shared Bearer token for cross-VM auth. The shared token means one compromised credential = full system access (bidirectional impersonation).

**Options for Phase 2:**
- **Asymmetric tokens:** Different token for each direction (control plane -> core, core -> control plane). Compromising one direction does not grant the other.
- **mTLS:** Mutual TLS with client certificates. Strongest isolation but more complex to manage.

**Default if Adam does not weigh in:** Phase 1 shared Bearer token. Phase 2 evaluates asymmetric tokens vs mTLS based on operational experience.

---

## Appendix A: Deliberation Record

This appendix summarizes the role and key contributions of each deliberation agent per the ISC-Delib-1 process.

### Architect (Agent 1)

**Role:** Produced the initial 9-section TDS draft with 28 TypeScript interfaces, configuration schemas, dependency graph, and security posture specification.

**Key contributions:**
- Technology stack selection (TypeScript, Node.js 22 LTS, jayson, Zod, better-sqlite3)
- Component architecture with public interface contracts for all 8 slices
- Credential isolation specification (environment sanitization, sanitized env for child processes)
- Configuration schemas for control plane and dispatch layer
- Startup credential verification (EX_CONFIG exit on missing secrets)
- HMAC request signing for cross-VM communication
- Token revocation RPC method and rotation scripts
- Entropy-based credential detection as defense-in-depth layer
- Response to 6 Security Auditor challenges, resulting in 6 concrete design changes

### Operator (Agent 2)

**Role:** Reviewed all proposals through the lens of a solo night-shift operator who SSHs from a phone and returns after days away.

**Key contributions:**
- Monorepo recommendation (single repo vs two separate repos)
- Directory flattening (4-5 directories, not 8)
- Phase 1 minimal scope: 7-point reduction (HTTP-only, Mode 1 dispatch, curl scripts, no WebSocket, Node-only, flat structure, simplified session model)
- RUNBOOK.md requirement (single-file operational reference)
- `recent-activity.sh` requirement ("what happened while I was away?")
- Restart-to-reload config validation (no hot-reload)
- Operational gap identification: log rotation, backup strategy, degradation modes
- Explicit opinion on every open question, always favoring operational simplicity

### Sentry (Agent 3)

**Role:** Adversarial stress-testing of every architectural proposal. Assumed everything will fail and asked how.

**Key contributions:**
- 13 failure mode analyses with specific remediation recommendations
- 7 unstated assumptions identified (CLI output parsability, SQLite concurrency, Tailscale reliability, session cleanup timing, WebSocket persistence, output size limits, retry appropriateness)
- 6 race conditions documented (dual approval response, server restart during dispatch, config reload during dispatch, session cleanup vs active work, cross-VM timeout asymmetry, audit rotation during write)
- 4 single points of failure identified (SQLite DB, Node.js process, Tailscale tunnel, ZFS pool)
- 5 pre-mortem scenarios ("it is 6 months from now and this project has failed")
- Process kill chain specification: SIGTERM to process group, 10s grace, SIGKILL
- Cross-VM timeout must exceed max dispatch timeout + validation overhead
- Orphan process recovery on server restart

### Security Auditor (Agent 4)

**Role:** Evaluated all proposals against the four Security Governance Framework invariants and the historical context of the February 2026 API key exposure.

**Key contributions:**
- 16 threats identified and assessed (T1-T16), including 4 missing from the Architect's initial analysis
- 6 non-negotiable findings (NNFs): credential isolation, Telegram approval scope, triangulated credential detection, structurally append-only audit, secrets bootstrap documentation, backend sandboxing
- 23 ranked recommendations from Critical to Nice-to-Have
- Governance framework compliance assessment across all 4 invariants
- Blast radius analysis for 4 compromise scenarios (Telegram, control plane, backend CLI, dispatch layer)
- Identification that Invariant 3 (triangulation) is the weakest compliance area
- Challenge/response on credential management resulting in 6 design strengthening changes

---

## Appendix B: Unresolved Concerns

These concerns were raised during deliberation, acknowledged by the team, but not fully resolved. They are recorded here for ongoing awareness.

### B.1: Sentry Scenario 2 -- Complexity May Exceed Solo Capacity

**Source:** Sentry pre-mortem Scenario 2.

**Concern:** The full system (5 backends, routing config, policy engine, approval gateway, audit logging, health monitoring, cross-VM communication) may exceed what one night-shift worker can maintain. Adam returns after days away, finds multiple things broken, spends the entire evening restoring operational state, never does productive work, and eventually shelves the project.

**Status:** Acknowledged. Mitigated by Phase 1 minimal scope (Operator's 7-point recommendation). Phase 1 has one dispatch mode, HTTP-only transport, curl scripts, and no Telegram integration. This dramatically reduces the operational surface area. The risk resurfaces as Phase 2 features are added. Each Phase 2 addition should be evaluated against this scenario: does adding this feature increase operational burden more than it increases value?

### B.2: Sentry Scenario 5 -- Cross-VM Split May Not Be Worth It

**Source:** Sentry pre-mortem Scenario 5.

**Concern:** Two-VM architecture adds latency, debugging complexity, and Tailscale dependency. A solo developer debugging cross-VM communication failures may spend more time on infrastructure than on the system's actual purpose.

**Status:** Acknowledged. Adam decides. The two-VM split matches existing infrastructure and provides security isolation (internet-facing Telegram on Relay VM, code execution on CachyOS VM). If operational cost proves too high, collapsing to a single VM is a simplification that does not require re-architecture -- the HTTP JSON-RPC interface between components works identically over localhost.

### B.3: Security Auditor Invariant 3 -- Triangulation Is Weakest Compliance Area

**Source:** Security Auditor governance compliance assessment.

**Concern:** The Security Governance Framework requires that "security truth is triangulated" -- multiple independent observation points. The current design has:

- Credential leakage detection: regex scan + entropy detection + TruffleHog (three layers -- adequate)
- Audit trail integrity: JSONL primary + SQLite index (two independent formats -- adequate)
- Runtime behavior observation: single process, single log stream (one layer -- insufficient)

The runtime observation gap means that if the control plane process is compromised, the attacker controls the only observation point. There is no independent process cross-referencing runtime behavior against audit records.

**Status:** Partially addressed by the JSONL + SQLite dual audit approach. A separate monitoring process that reads the JSONL file independently and cross-references with system-level telemetry (process list, network connections, file access) would satisfy Invariant 3 fully. This is Phase 2+ scope.

### B.4: Sentry Scenario 3 -- Approval Fatigue Risk

**Source:** Sentry pre-mortem Scenario 3.

**Concern:** If approval tier assignments are too conservative, Adam will be prompted for 30-50 approvals per session, leading to rubber-stamping. Auto-approval of everything defeats the purpose of human oversight and could re-enable the exact credential exposure scenario the system is designed to prevent.

**Status:** Mitigated by the recommended default (Q5): start permissive, auto-approve read-only operations, require approval only for write operations and external API calls. Tier assignments are configurable and should be calibrated based on real Phase 1 usage data. The Security Auditor's NNF-2 (Telegram approval scope restriction) provides an additional structural safeguard: even if approval fatigue occurs, high-risk approvals are restricted to the CLI client where Adam is more likely to read them carefully.

---

*END OF SECTIONS 7-9 AND APPENDICES*

*This document synthesizes the Architect's initial draft with review findings from the Operator, Sentry, and Security Auditor. All synthesis decisions are documented in the section headers and Appendix A. v2 incorporates multi-agent review findings including 14 interface contract gap fixes, 3 new threats, 2 new NNFs, and cross-functional challenge resolutions. Adam retains final authority on all open questions in Section 9.*
