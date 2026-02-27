---
meta_version: 1
kind: plan
status: draft
authority: low
domain: [control-plane]
source: atlas_write
confidence: provisional
mode: build
created: 2026-02-28T18:00:00+11:00
modified: 2026-02-28T18:00:00+11:00
cssclasses: [status-draft]
motifs: [observer-control-plane, json-rpc, multi-engine-dispatch, governance]
refs:
  - 01-Projects/observer-council/architecture/Technical_Design_Specification_v2.md
  - 01-Projects/control-plane/decisions/001-tds-v2-open-questions.md
---

# PRD: Observer Control Plane

**Purpose:** JSON-RPC control plane and multi-engine dispatch for the Observer ecosystem. Accepts client connections, enforces governance policy, routes work to backend CLI tools, manages approvals, maintains append-only audit trail. Makes "AI articulates, humans decide" a protocol, not a suggestion.

**Principle:** Every operation flows through policy evaluation and audit logging. Dispatch is an imported library — not a separate service.

---

## 1. Scope

### 1.1 What This System Does (Phase 1)

1. **JSON-RPC server** on `127.0.0.1:9000` — accepts HTTP POST requests, validates against Zod schemas, routes to handlers.
2. **Session management** — create, resume, close sessions. Thread lifecycle within sessions. Turn submission and completion tracking.
3. **Policy enforcement** — evaluates every request against YAML-configured governance rules. Default deny. Pure-function evaluation, no side effects.
4. **Approval gateway** — human-in-the-loop approval requests. Timeout = denied (fail-safe). Polling-based discovery via `thread.status`.
5. **Audit trail** — structurally append-only JSONL primary + SQLite queryable index. Dual-layer credential sanitization before every write.
6. **Execution dispatch** — spawns backend CLI tools as child processes with `sanitizedEnv()`. Captures output, enforces timeouts, kill chain on timeout.
7. **Health monitoring** — periodic backend health checks, status aggregation, version verification.
8. **curl-based CLI interaction** — no TUI tool. Scripts for common operations.

### 1.2 What This System Does NOT Do (Phase 1)

- **No WebSocket transport** — HTTP polling only. Streaming is Phase 2.
- **No Telegram client** — Phase 2. Policy rules for Telegram are defined but the client doesn't exist yet.
- **No GUI client** — Phase 3.
- **No Mode 2/3 dispatch** — human specifies backend explicitly. Config-recommended and council modes are Phase 2/3.
- **No bubblewrap sandboxing** — late Phase 1 or early Phase 2. `sanitizedEnv()` provides Phase 1 credential isolation.
- **No cross-VM communication** — single-host deployment only. Two-VM is an optional hardening guide (Appendix A).
- **No hot-reload** — config changes require server restart.
- **No Item tracking** — Item type is defined for forward compatibility but not actively managed.

### 1.3 Design Constraints

These are non-negotiable. Violation of any constraint is a build failure.

| Constraint | Enforcement | Reference |
|-----------|------------|-----------|
| `sanitizedEnv()` is sacred | Child processes NEVER receive `process.env`. Env constructed from scratch. | NNF-1, EX-6 |
| No `shell: true` | All `spawn()` calls use array args. No exceptions. | T5 |
| Audit writes block requests | If audit can't write, the request doesn't proceed (except `health.status` and `session.close`) | NNF-4 |
| 127.0.0.1 binding asserted at startup | Never bind to 0.0.0.0. Startup assertion verifies. | Inv. 2 |
| Config is restart-to-reload | Running config always matches file on disk. No hot-reload. | Design |
| Default deny | If no policy rule matches, deny. Explicit allow required. | Inv. 4 |
| Fail safe, not fail open | Approval timeout = denied. Backend unavailable = error, not silent skip. | Inv. 4 |

---

## 2. Technology Stack

| Tool | Version | Purpose |
|------|---------|---------|
| TypeScript | 5.x (strict mode) | Language |
| Node.js | 22 LTS | Runtime (exclusively — no Bun) |
| npm | 10.x | Package manager with workspaces |
| jayson | latest | JSON-RPC server (HTTP transport) |
| Zod | latest | Runtime schema validation + type inference |
| better-sqlite3 | latest | Audit index, session store |
| pino | latest | Structured JSON logging |
| nanoid | latest | ID generation (prefixed, 12-char) |
| yaml | latest | Config file parsing |
| tsx | latest | TypeScript execution (dev + scripts) |
| vitest | latest | Test framework |
| age | system | Secrets encryption at rest |

---

## 3. Monorepo Structure

```
observer-system/
  packages/
    shared/                   # S0: Types, Zod schemas, error codes, ID generation
      src/
        types.ts              # All TypeScript interfaces and enums
        schemas.ts            # Zod runtime schemas
        errors.ts             # ObserverErrorCode enum + error factory
        ids.ts                # Prefixed nanoid generation
        index.ts              # Barrel export
      package.json
    control-plane/            # S1-S5, S7: JSON-RPC server + all control plane logic
      src/
        session/              # S1: Session manager + SQLite store
        policy/               # S2: Policy enforcer
        audit/                # S3: Audit logger (JSONL + SQLite)
        approval/             # S4: Approval gateway
        health/               # S7: Health monitor
        server.ts             # S5: jayson HTTP server setup
        router.ts             # S5: Method-to-handler routing
        auth.ts               # S5: Bearer token validation
        handlers/             # S5: Per-method handler functions
      config/
        control-plane.yaml    # Server configuration
      data/                   # Runtime data (audit logs, SQLite DBs)
      package.json
    dispatch/                 # S6: Backend executor (imported as library)
      src/
        executor.ts           # Child process spawning + kill chain
        sanitize.ts           # sanitizedEnv() + output sanitizer
        health-check.ts       # Backend health check runner
        config.ts             # Backend config loader
        index.ts              # Public API
      config/
        execution-backends.yaml
      package.json
  scripts/                    # Operational scripts
    health-check.sh
    smoke-test.sh
    recent-activity.sh
    rebuild-audit-index.sh
    provision-secrets.sh
  RUNBOOK.md
  package.json                # Root workspace config
  tsconfig.json               # Shared TypeScript config
```

---

## 4. Controlled Vocabulary (Shared Types)

All types defined once in `packages/shared/src/types.ts`. Every slice imports from `@observer/shared`. No type is defined in two places.

### 4.1 Enums and Union Types

```typescript
type ClientType = "cli" | "telegram" | "gui" | "internal";

type ThreadStatus =
  | "open"               // Created, awaiting first turn
  | "processing"         // Turn being processed
  | "awaiting_approval"  // Blocked on human decision
  | "executing"          // Backend is executing work
  | "completed"          // All work done successfully
  | "failed"             // Terminal error
  | "cancelled"          // Cancelled by user
  | "interrupted";       // Server crashed mid-processing

type IntentType = "cognitive" | "build" | "query" | "system";

type ItemType =
  | "message" | "tool_call" | "file_write"
  | "approval_request" | "dispatch" | "status_update" | "error";

type ApprovalTier = "auto_approve" | "notify" | "approve" | "escalate" | "block";

type AuditCategory =
  | "session" | "thread" | "turn" | "policy"
  | "approval" | "dispatch" | "health" | "security" | "system";

type TaskType =
  | "code-generation" | "bug-fixing" | "complex-refactoring"
  | "architecture-review" | "code-review" | "security-audit"
  | "research" | "exploration" | "drafts"
  | "low-stakes-generation" | "summarisation";

type SensitivityLevel = "public" | "internal" | "confidential";

type BackendHealthState = "healthy" | "degraded" | "rate_limited" | "unavailable" | "disabled";
```

### 4.2 Core Data Structures

```typescript
interface Session {
  id: string;              // "ses_" + nanoid(12)
  client_type: ClientType;
  client_id: string;
  created_at: string;      // ISO 8601
  last_active_at: string;
  status: "active" | "idle" | "closed";
  thread_ids: string[];
}

interface Thread {
  id: string;              // "thr_" + nanoid(12)
  session_id: string;
  intent: string;          // Human-readable description
  intent_type: IntentType;
  status: ThreadStatus;
  created_at: string;
  updated_at: string;
  turn_ids: string[];
  metadata: Record<string, unknown>;
}

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

interface Attachment {
  id: string;
  type: "text" | "file_ref" | "voice_transcript" | "image_ref";
  filename?: string;
  mime_type?: string;
  content: string;
  size_bytes?: number;
  sanitized: boolean;         // Must be true before any persistence
  contains_sensitive: boolean; // Pre-scanned for credential patterns
}

// Phase 2+: Item interface defined for forward compatibility but not actively managed in Phase 1.
// Shape: { id: "itm_" + nanoid(12), turn_id, type: ItemType, content, result, status, created_at, completed_at }
```

### 4.3 Policy Types

```typescript
interface PolicyRequest {
  method: string;
  params: unknown;
  session: Session;
  thread: Thread | null;
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
  action: string;          // "allow" | "deny" | "require_approval" | "rate_limit"
  priority: number;        // Lower = evaluated first. First match wins.
}

type PolicyCondition =
  | { type: "method_match"; methods: string[] }
  | { type: "client_type_match"; client_types: ClientType[] }
  | { type: "intent_contains"; keywords: string[] }
  | { type: "rate_check"; max_per_minute: number }
  | { type: "and"; conditions: PolicyCondition[] }
  | { type: "or"; conditions: PolicyCondition[] }
  | { type: "not"; condition: PolicyCondition };
```

### 4.4 Approval Types

```typescript
interface ApprovalRequestParams {
  thread_id: string;
  description: string;
  risk_level: "low" | "medium" | "high" | "critical";
  tier: ApprovalTier;
  timeout_seconds: number;
  context: Record<string, unknown>;
}

interface ApprovalResult {
  approval_id: string;
  decision: "approved" | "denied" | "timeout";
  reason: string | null;
  decided_by: string;
  decided_at: string;
}

interface PendingApproval {
  approval_id: string;     // "apr_" + nanoid(12)
  thread_id: string;
  session_id: string;
  description: string;
  risk_level: string;
  tier: ApprovalTier;
  created_at: string;
  timeout_at: string;
  status: "pending" | "approved" | "denied" | "expired";
}

interface ApprovalDecision {
  decision: "approved" | "denied";
  reason?: string;
}
```

### 4.5 Audit Types

```typescript
interface AuditEvent {
  event_id: string;          // "evt_" + nanoid(16)
  timestamp: string;         // ISO 8601 with milliseconds
  category: AuditCategory;
  action: string;
  session_id: string | null;
  thread_id: string | null;
  turn_id: string | null;
  item_id: string | null;
  client_id: string | null;
  details: Record<string, unknown>;  // Sanitized
  policy_rule_id: string | null;
  risk_level: string | null;
}

interface AuditFilter {
  session_id?: string;
  thread_id?: string;
  category?: AuditCategory;
  since?: string;
  until?: string;
  limit?: number;            // Default 100, max 1000
  cursor?: string;
}

interface AuditQueryResult {
  events: AuditEvent[];
  total_count: number;
  has_more: boolean;
  next_cursor?: string;
}
```

### 4.6 Dispatch Types

```typescript
interface DispatchRequest {
  dispatch_id: string;       // "dsp_" + nanoid(12)
  mode: "specify";           // Phase 1 only
  slice: {
    id: string;
    description: string;
    type: TaskType;
    context_files: string[];
    working_directory: string;
    isc_criteria: ISCCriteria;
    sensitivity?: SensitivityLevel;
  };
  target_backend: string;
}

interface ISCCriteria {
  tests_pass?: boolean;
  no_secrets?: boolean;
  lint_clean?: boolean;
  custom?: Record<string, unknown>;
}

interface DispatchResult {
  dispatch_id: string;
  backend_used: string;
  backend_version: string | null;
  model_used: string | null;
  execution_time_seconds: number;
  tokens_used: number | null;
  cost_estimate: "free" | "subscription" | "per-token";
  status: "completed" | "failed" | "timeout" | "parse_error";
  exit_code: number;
  artifacts: Array<{
    path: string;
    type: "code" | "document" | "config" | "other";
    hash: string;
  }>;
  stdout_log: string;        // Sanitized, ANSI-stripped
  stderr_log: string;
  truncated: boolean;
  validation_pending: boolean;
}

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

### 4.7 Health Types

```typescript
interface HealthStatus {
  server: {
    status: "healthy" | "degraded" | "unhealthy";
    uptime_seconds: number;
    memory_usage_mb: number;
    active_sessions: number;
    active_threads: number;
    pending_approvals: number;
  };
  backends: Record<string, {
    status: BackendHealthState;
    last_check: string;
    response_time_ms: number | null;
    uptime_ratio: number;
    version: string | null;
  }>;
  audit: {
    status: "healthy" | "error";
    jsonl_size_mb: number;
    sqlite_size_mb: number;
    event_count: number;
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

### 4.8 Error Types

```typescript
enum ObserverErrorCode {
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
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

type ObserverErrorData =
  | { type: "policy_denied"; rule_id: string; reason: string }
  | { type: "rate_limited"; retry_after_seconds: number }
  | { type: "backend_unavailable"; backend: string; health_state: BackendHealthState }
  | { type: "backend_auth_failure"; message: string }
  | { type: "approval_timeout"; approval_id: string; timeout_seconds: number }
  | { type: "validation_failed"; field: string; message: string }
  | { type: "session_not_found"; session_id: string }
  | { type: "thread_not_found"; thread_id: string };

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

### 4.9 ID Generation Convention

| Entity | Prefix | Length | Example |
|--------|--------|--------|---------|
| Session | `ses_` | 12 | `ses_a1b2c3d4e5f6` |
| Thread | `thr_` | 12 | `thr_x1y2z3w4v5u6` |
| Turn | `trn_` | 12 | `trn_m1n2o3p4q5r6` |
| Item | `itm_` | 12 | `itm_g1h2i3j4k5l6` |
| Audit Event | `evt_` | 16 | `evt_a1b2c3d4e5f6g7h8` |
| Dispatch | `dsp_` | 12 | `dsp_r1s2t3u4v5w6` |
| Approval | `apr_` | 12 | `apr_d1e2f3g4h5i6` |

All IDs generated with `nanoid`. Custom alphabet: `0123456789abcdefghijklmnopqrstuvwxyz`.

### 4.10 JSON-RPC Method Table

| Method | Params | Result | Auth |
|--------|--------|--------|------|
| `session.create` | `{ client_type, client_id }` | `{ session_id, created_at }` | Yes |
| `session.close` | `{ session_id }` | `{ closed: true }` | Yes |
| `session.resume` | `{ session_id }` | `SessionResumeResult` | Yes |
| `thread.create` | `{ session_id, intent, intent_type, context?, metadata? }` | `{ thread_id, status }` | Yes |
| `thread.status` | `{ thread_id }` | `{ thread_id, status, turns[], pending_approvals[] }` | Yes |
| `thread.cancel` | `{ thread_id }` | `{ cancelled: true }` | Yes |
| `turn.submit` | `{ thread_id, message, attachments? }` | `{ turn_id, status }` | Yes |
| `approval.respond` | `{ approval_id, decision: ApprovalDecision }` | `{ acknowledged: true }` | Yes |
| `health.status` | `{}` | `HealthStatus` (full if authed, liveness-only if not) | No* |
| `audit.query` | `AuditFilter` | `AuditQueryResult` | Yes |
| `admin.revoke_token` | `{ token_hash }` | `{ revoked, active_tokens }` | Yes (CLI-only) |

*`health.status` without auth returns only `{ status, uptime_seconds }`.

### 4.11 Service Interfaces (Signature Reference)

**SessionManager:** `createSession(clientType, clientId) → Session`, `getSession(id) → Session|null`, `resumeSession(id) → Session`, `closeSession(id) → void`, `createThread(sessionId, intent, context?) → Thread`, `getThread(id) → Thread|null`, `updateThreadStatus(id, status) → void`, `cancelThread(id) → void`, `createTurn(threadId, message, attachments?) → Turn`, `completeTurn(id, summary) → void`. All async.

**PolicyEnforcer:** `evaluate(req: PolicyRequest) → PolicyDecision` (sync), `loadRules(path) → void`, `getRules() → PolicyRule[]`.

**ApprovalGateway:** `requestApproval(params: ApprovalRequestParams) → ApprovalResult`, `submitDecision(id, decision) → void`, `getPendingApprovals(sessionId) → PendingApproval[]`, `getAllPending() → PendingApproval[]`. All async.

**AuditLogger:** `log(event) → void` (sync, blocking), `query(filter: AuditFilter) → AuditQueryResult`, `tail(count) → AuditEvent[]`.

**AuditStore:** `append(event) → void`, `query(filter) → AuditQueryResult`, `rebuild() → void`.

**SessionStore:** `save(session) → void`, `load(id) → Session|null`, `listActive() → Session[]`. All async.

**HealthMonitor:** `getStatus() → HealthStatus`, `checkBackend(name) → BackendHealthState`, `onStatusChange(cb) → void`.

---

## 5. Build Slices

### S0: Shared Types & Schemas

**Package:** `packages/shared/`
**Dependencies:** None
**Build group:** Foundation (must build first)

**What to build:**
- `src/types.ts` — All interfaces and type aliases from Section 4 above
- `src/schemas.ts` — Zod schemas matching every interface (used for runtime validation of JSON-RPC params/results and config)
- `src/errors.ts` — `ObserverErrorCode` enum, error factory function `createError(code, message, data?)`
- `src/ids.ts` — `generateId(prefix)` function using nanoid with custom alphabet
- `src/index.ts` — Barrel export of all types, schemas, errors, and ID utilities
- `package.json` — `@observer/shared`, exports configured for ESM

**What NOT to build:** No runtime logic beyond schemas/IDs. No service interface implementations. No cross-VM types.

**ISC Exit Criteria:**

MUST pass:
1. All TypeScript interfaces from Section 4 compile without errors under `strict: true`
2. Every interface has a corresponding Zod schema that validates correct data and rejects malformed data
3. `generateId("ses")` produces strings matching pattern `ses_[a-z0-9]{12}`
4. `createError(ObserverErrorCode.PolicyDenied, msg, data)` produces valid JSON-RPC error object
5. Package exports cleanly — `import { Session, SessionSchema } from "@observer/shared"` works

SHOULD verify:
1. Zod schemas infer to the same TypeScript types as the interfaces (`z.infer<typeof SessionSchema>` equals `Session`)

**Security:** No security-specific requirements for this slice (it's pure types).

**Tests:** Zod schema validation (valid + invalid per schema), ID generation format, error factory output.

---

### S1: Session Manager

**Package:** `packages/control-plane/src/session/`
**Dependencies:** S0
**Build group:** Parallel Group 1

**What to build:**
- `session-manager.ts` — Session/thread/turn CRUD. State machine enforcement.
- `session-store.ts` — SQLite persistence via better-sqlite3. Prepared statements.
- `state-machine.ts` — Thread status transition validation. Valid next states or throws.

**What NOT to build:** No Item lifecycle (Phase 2). No WebSocket events. No approval/policy logic (S4/S2). No multi-client sessions.

**ISC Exit Criteria:**

MUST pass:
1. `createSession()` returns a Session with valid `ses_` ID and `active` status
2. `createThread()` within a session returns Thread with valid `thr_` ID and `open` status
3. Invalid state transitions throw errors (e.g., cannot submit turn to `completed` thread)
4. SQLite persistence survives simulated restart — create session, recreate store from same DB file, session loads
5. Idle session cleanup closes sessions with `last_active_at` older than configured timeout (72h default)
6. Cleanup skips sessions with active work (in-flight threads in `processing`/`executing`/`awaiting_approval`)

SHOULD verify:
1. Startup recovery transitions threads in `processing`/`executing` state to `interrupted`
2. `interrupted` threads are surfaced via `session.resume`

**Security:**
- Session IDs are nanoid(12) — unguessable, not sequential (T7)
- Session bound to `client_id` at creation — other clients cannot access it
- Turn messages and attachment content pass through credential sanitizer before SQLite persistence (SEC-13)

**Tests:** State machine transitions (valid + invalid), session CRUD, SQLite round-trip, idle cleanup, startup recovery.

---

### S2: Policy Enforcer

**Package:** `packages/control-plane/src/policy/`
**Dependencies:** S0
**Build group:** Parallel Group 1

**What to build:**
- `policy-enforcer.ts` — Loads YAML rules, evaluates conditions, returns decisions.
- `condition-evaluator.ts` — Recursive `and`/`or`/`not` composition. Pure functions.
- `config-loader.ts` — Validates policy rules from `control-plane.yaml` against Zod schema.

**What NOT to build:** No runtime rule modification API. No approval logic (S4). No request routing (S5). In-memory sliding window for rate limits.

**ISC Exit Criteria:**

MUST pass:
1. Correctly evaluates all condition types: `method_match`, `client_type_match`, `intent_contains`, `rate_check`, `and`, `or`, `not`
2. First matching rule by priority determines decision (lower priority number = evaluated first)
3. Default deny when no rules match — returns `{ action: "deny", reason: "No matching policy rule", rule_id: "default" }`
4. Config validation rejects invalid rules with clear error messages at startup (duplicate IDs, duplicate priorities, unknown condition types)

SHOULD verify:
1. All evaluations produce audit-ready decision records (rule_id, action, reason)
2. `intent_contains` uses structural matching on `intent_type`, not keyword matching on message content (NNF-8)

**Security:**
- Policy rules loaded from human-edited config only. No API to modify rules at runtime. (Inv. 2)
- Policy evaluation is synchronous and pure — cannot hang, loop, or make network calls
- Default deny enforced structurally (Inv. 4)

**Tests:** Every condition type, composition nesting, priority ordering, default deny, config validation, rate check.

---

### S3: Audit Logger

**Package:** `packages/control-plane/src/audit/`
**Dependencies:** S0
**Build group:** Parallel Group 1

**What to build:**
- `audit-logger.ts` — Coordinates JSONL writes + SQLite indexing.
- `jsonl-writer.ts` — Append-only JSONL. `O_APPEND | O_WRONLY`, `fsync` per write, permissions `0600`.
- `sqlite-index.ts` — INSERT-only queryable index. WAL mode. Indexed on `session_id`, `thread_id`, `timestamp`, `category`.
- `credential-sanitizer.ts` — Layer 1: regex patterns. Layer 2: entropy-based (Shannon > 4.5 near credential context words). Path redaction.
- `rotation.ts` — JSONL rotation at configured size (100MB default). Archived files `0400`.

**What NOT to build:** No TruffleHog (Phase 2). No HMAC per-entry integrity (Phase 2). No log streaming or viewer UI.

**ISC Exit Criteria:**

MUST pass:
1. Events written to JSONL with `fsync` — file survives simulated crash (write, kill process, read back)
2. SQLite index matches JSONL content — query by `session_id` returns same events as JSONL grep
3. Credential sanitizer redacts known patterns: `sk-[a-zA-Z0-9]{20,}`, `AIza[a-zA-Z0-9_-]{35}`, `ghp_[a-zA-Z0-9]{36}`, JWTs, sensitive file paths
4. Rotation triggers at configured size threshold. Archived files have permissions `0400`
5. `rebuild()` recreates SQLite index from JSONL files (full rebuild script)
6. Audit write failure blocks the calling request (circuit breaker: 5 consecutive failures → CRITICAL health status)

SHOULD verify:
1. `health.status` and `session.close` are exempt from audit-write-must-succeed requirement
2. High-entropy strings (Shannon entropy > 4.5) near credential context words are flagged

**Security:**
- `O_APPEND` for OS-level append-only (NNF-4). All `details` sanitized before write (NNF-3, T3).
- Archived `0400`. PID lockfile prevents double-starts.

**Tests:** Sanitizer (credential formats, false positives, path redaction), JSONL round-trip, SQLite queries, rotation, rebuild, circuit breaker.

---

### S4: Approval Gateway

**Package:** `packages/control-plane/src/approval/`
**Dependencies:** S1, S2, S3
**Build group:** Sequential (after Parallel Group 1)

**What to build:**
- `approval-gateway.ts` — Approval lifecycle: create, respond, expire. Timeout = denied (fail-safe).
- `approval-store.ts` — SQLite persistence for pending approvals. Survives restart.
- `timeout-scheduler.ts` — Checks expiry, marks expired as denied.

**What NOT to build:** No WebSocket push (Phase 2). No Telegram response handling (Phase 2). No delegation or multi-approver flows.

**ISC Exit Criteria:**

MUST pass:
1. `requestApproval()` creates a PendingApproval with valid `apr_` ID and `pending` status
2. Timeout results in denial — expired approval returns `{ decision: "timeout" }` (fail-safe, Inv. 4)
3. First-response-wins — second response to same approval returns `ApprovalAlreadyResolved` error (HTTP 409)
4. `block` tier rejects immediately without creating a pending approval
5. Pending approvals persist across restart and resurface via `session.resume`

SHOULD verify:
1. `approval_channels` restricts which client types can respond to each tier (Telegram excluded from `approve`/`escalate`)
2. All approval decisions logged to audit trail with `category: "approval"`

**Security:**
- Timeout = denied (NNF-2, Inv. 4). Channel restrictions are structural — Telegram blocked from `approve`/`escalate` (NNF-2). Context never includes raw backend output.

**Tests:** Approval lifecycle (create, respond, timeout, duplicate), persistence, timeout scheduling, channel restrictions, `block` rejection.

---

### S5: JSON-RPC Server + Router

**Package:** `packages/control-plane/src/` (server.ts, router.ts, auth.ts, handlers/)
**Dependencies:** S1, S2, S3, S4, S6 (as library), S7
**Build group:** Sequential (last — integration layer)

**What to build:**
- `server.ts` — jayson HTTP server on `127.0.0.1:9000`. 1MB request limit. Graceful SIGTERM shutdown.
- `router.ts` — Method → handler routing. Pipeline: parse → auth → policy → route → respond.
- `auth.ts` — Bearer tokens from `/run/secrets/observer/client-tokens/`. `crypto.timingSafeEqual()`. Rate limit: 10/min per IP, lockout at 50.
- `handlers/` — One per JSON-RPC method. `turn.submit` calls `dispatch.execute()` directly (library import).
- `config-validator.ts` — Validates YAML against Zod. `--validate-config` CLI flag.
- `startup.ts` — Validate config → load secrets → init stores → start health monitor → bind → assert localhost.

**What NOT to build:** No WebSocket (Phase 2). No cross-VM client/router. No Tailscale. No real-time push.

**ISC Exit Criteria:**

MUST pass:
1. Server starts, binds to `127.0.0.1:9000`, rejects connection attempts to `0.0.0.0`
2. Startup assertion fails and server refuses to start if bind address is not `127.0.0.1`
3. All 11 JSON-RPC methods from Section 4.10 accept valid requests and return correct responses
4. Malformed requests return appropriate `ObserverErrorCode` responses
5. `health.status` responds without authentication (liveness data only); with auth returns full status
6. Server shuts down gracefully on SIGTERM — completes in-flight requests within 30s, flushes audit
7. `--validate-config` exits with code 0 for valid config, code 1 with clear error for invalid config

SHOULD verify:
1. Full happy-path integration: `session.create` → `thread.create` → `turn.submit` → dispatch → result → `session.close`
2. Auth failure returns `AuthRequired`/`AuthFailed` with rate limiting on repeated failures (NNF-7)
3. Unicode NFC normalization applied to all string inputs

**Security:**
- `127.0.0.1` binding assertion at startup (Inv. 2). `timingSafeEqual()` for tokens (SEC-3).
- Auth rate limit: 10/min per IP, lockout at 50 (NNF-7). Request size limit 1MB (T8).
- Raw headers never logged. Error messages are hardcoded strings — never raw backend output.

**Tests:** Full request pipeline integration, auth flow (valid/invalid/missing/rate-limited), config validation, graceful shutdown, localhost assertion, per-handler unit tests.

---

### S6: Execution Dispatch

**Package:** `packages/dispatch/`
**Dependencies:** S0
**Build group:** Parallel Group 1

**What to build:**
- `executor.ts` — `spawn()` with array args (never `shell: true`). SIGTERM → 10s → SIGKILL kill chain. Process group kill (`-pid`).
- `sanitize.ts` — `sanitizedEnv()`: minimal env from scratch (PATH, HOME, TERM, LANG, USER, XDG_*). `validateArgs()`: rejects credential patterns + high-entropy. `sanitizeOutput()`: regex detection on stdout/stderr.
- `health-check.ts` — Backend health commands, version vs `pinned_version` semver, `degraded` on mismatch.
- `config.ts` — Loads `execution-backends.yaml` against Zod schema.
- `index.ts` — Public API: `execute(DispatchRequest) → DispatchResult`, `checkHealth(name) → BackendStatus`.

**What NOT to build:** No Mode 2/3 dispatch. No bubblewrap (Phase 2). No cross-VM dispatch. No output streaming. No cost tracking beyond `cost_estimate`.

**ISC Exit Criteria:**

MUST pass:
1. `sanitizedEnv()` returns ONLY allowed env vars (PATH, HOME, TERM, LANG, USER, XDG_*) — never `process.env`, never any `*_KEY`, `*_TOKEN`, `*_SECRET` vars
2. End-to-end: dispatch to a test script that prints `env` — verify no credential variables in child process environment
3. All `spawn()` calls use array args — grep codebase for `shell: true` returns zero matches
4. Timeout triggers SIGTERM → 10s grace → SIGKILL. Partial output from killed process marked `status: "timeout"`
5. `validateArgs()` rejects strings containing credential patterns (`sk-`, `AIza`, `ghp_`) and high-entropy strings (Shannon entropy > 4.5)
6. `sanitizeOutput()` redacts known credential patterns from stdout/stderr before storage

SHOULD verify:
1. Process group kill (`-pid`) cleans up child processes spawned by the backend CLI tool
2. Version mismatch against `pinned_version` sets health to `degraded` (not `unhealthy`)

**Security:**
- `sanitizedEnv()` is the #1 security guarantee (NNF-1, T1). No `shell: true` anywhere (T5).
- `validateArgs()` blocks credential patterns (T2). `sanitizeOutput()` blocks persistence (T3).
- stdio `['pipe','pipe','pipe']`. Working dir validated against allowlist, symlinks resolved (T18).

**Tests:** `sanitizedEnv()` (allowed/excluded vars), `validateArgs()` (credentials rejected, normal allowed), `sanitizeOutput()` (patterns redacted). Integration: dispatch to test backend, verify env. Kill chain: timeout → SIGTERM → SIGKILL sequence.

---

### S7: Health Monitor

**Package:** `packages/control-plane/src/health/`
**Dependencies:** S0
**Build group:** Parallel Group 1

**What to build:**
- `health-monitor.ts` — Periodic health checks at configured intervals. Status aggregation.
- `status-aggregator.ts` — Overall health from component statuses. Detects transitions.

**What NOT to build:** No Tailscale/cross-VM health checks. No dashboard UI. No alerting.

**ISC Exit Criteria:**

MUST pass:
1. Reports correct health status for all configured backends (runs health check command, parses version output)
2. Detects status transitions (healthy → degraded) and emits `HealthChange` events
3. Version mismatch against `pinned_version` semver range sets backend to `degraded`
4. `health.status` unauthenticated returns only `{ status, uptime_seconds }` — no topology, no backend details

SHOULD verify:
1. Health check intervals are configurable per-component (backends: 300s, audit: 60s)
2. Failed health check does not crash the monitor — logs error and marks component accordingly

**Security:**
- Unauthenticated `health.status` returns only liveness data — prevents reconnaissance (SEC-4)
- Health check commands use same `spawn()` array args pattern as dispatch (no `shell: true`)

**Tests:** Status aggregation, transition detection, version comparison. Integration with mock backend.

---

## 6. Slice Dependency Graph

```
S0 (shared) ──┬── S1 (session) ──┐
              ├── S2 (policy)  ──┼── S4 (approval) ──┐
              ├── S3 (audit)   ──┘                    ├── S5 (server+router)
              ├── S6 (dispatch) ──────────────────────┤
              └── S7 (health)  ───────────────────────┘
```

### Parallelization Groups

| Group | Slices | Can Build After |
|-------|--------|-----------------|
| Foundation | S0 | Nothing (first) |
| Parallel 1 | S1, S2, S3, S6, S7 | S0 complete |
| Sequential 1 | S4 | S1 + S2 + S3 complete |
| Sequential 2 | S5 | S4 + S6 + S7 complete |

**Build order:** S0 → {S1,S2,S3,S6,S7} parallel → S4 → S5. Critical path: S0→S2→S4→S5.

---

## 7. Configuration Schemas

### 7.1 control-plane.yaml (Single-Host)

```yaml
# Observer Control Plane Configuration — Single-Host Deployment
# Human-edited only. Restart required after changes.
# PREREQUISITE: Run scripts/provision-secrets.sh before starting

server:
  host: "127.0.0.1"                    # NEVER change to 0.0.0.0
  http_port: 9000
  max_request_size_bytes: 1048576       # 1MB
  shutdown_timeout_seconds: 30
  log_level: "info"                     # debug | info | warn | error

sessions:
  idle_timeout_hours: 72
  max_concurrent: 10
  max_threads_per_session: 50

auth:
  token_dir: "/run/secrets/observer/client-tokens/"

rate_limits:
  requests_per_minute: 60
  turns_per_hour: 120

approvals:
  tiers: { auto_approve: 0, notify: 0, approve: 300, escalate: 600, block: 0 }  # timeout_seconds
  approval_channels:     # approve/escalate: cli only. block: none. auto_approve/notify: all.
    approve: { allowed_clients: [cli] }
    escalate: { allowed_clients: [cli] }

policies:
  default_action: "deny"
  rules:
    - id: health-check-allow
      condition: { type: method_match, methods: [health.status] }
      action: allow
      priority: 1
    - id: session-management-allow
      condition: { type: method_match, methods: [session.create, session.close, session.resume] }
      action: allow
      priority: 2
    # Additional rules follow same pattern: id, condition, action, priority
    # Full set: thread ops (priority 10-20), turn.submit (30), audit.query cli-only (40)

dispatch:
  working_directory: "/home/adam/workspace"
  allowed_base_dirs:
    - "/home/adam/workspace"
    - "/tmp/observer-work"

health:
  backend_check_interval_seconds: 300
  audit_check_interval_seconds: 60

audit:
  jsonl_dir: "data/audit/"
  jsonl_max_size_mb: 100
  jsonl_archive_dir: "data/audit-archive/"
  index_database_path: "data/audit-index.db"
  sanitize_patterns:
    - "sk-[a-zA-Z0-9]{20,}"
    - "AIza[a-zA-Z0-9_-]{35}"
    - "ghp_[a-zA-Z0-9]{36}"
    # Additional patterns: sk-proj-*, gho_*, glpat-*, xoxb-* (see S3 ISC criteria)
```

**Startup Validation Rules:**

| Field | Rule | On Failure |
|-------|------|-----------|
| `server.host` | Must be `"127.0.0.1"` or `"::1"` | Hard fail: refuse to start |
| `server.http_port` | Integer 1024-65535 | Hard fail |
| `auth.token_dir` | Directory must exist with at least `cli.token` | Hard fail |
| `approvals.tiers` | All five tiers present | Hard fail |
| `policies.rules[].id` | Unique across all rules | Hard fail |
| `policies.rules[].priority` | Unique across all rules | Hard fail |
| `audit.jsonl_dir` | Directory must exist and be writable | Hard fail |

### 7.2 execution-backends.yaml

```yaml
# Observer Execution Backend Configuration
# Human-edited only. Restart required after changes.

routing_mode: "specify"                 # Phase 1: human specifies backend
default_backend: "claude-code"

dispatch:
  default_timeout_seconds: 600
  max_retries: 1
  retry_delay_seconds: 5
  output_max_bytes: 10485760            # 10MB
  health_check_timeout_seconds: 15

backends:
  claude-code:
    command: "claude"
    args_template: ["--print", "--output-format", "json", "{prompt}"]
    enabled: true
    cost: "subscription"
    trust_level: "high"
    timeout_seconds: 900
    pinned_version: "1.x"
    health_check:
      command: "claude"
      args: ["--version"]
      timeout_seconds: 10

  # gemini-cli, codex-cli, ollama follow same schema: command, args_template,
  # enabled, cost, trust_level, timeout_seconds, pinned_version, health_check.

sensitivity:
  public: { allowed_backends: ["*"] }
  internal: { allowed_backends: [claude-code, codex-cli, ollama] }
  confidential: { allowed_backends: [claude-code, ollama] }
```

**Validation Rules:**

| Field | Rule | On Failure |
|-------|------|-----------|
| `routing_mode` | Must be `"specify"` for Phase 1 | Hard fail |
| `default_backend` | Must reference an enabled backend | Hard fail |
| `backends.*.command` | Non-empty string | Hard fail |
| `backends.*.timeout_seconds` | Integer > 0, <= 3600 | Hard fail |
| `backends.*.trust_level` | One of `high`, `medium`, `low` | Hard fail |
| `sensitivity.confidential.allowed_backends` | Must NOT include `trust_level: "low"` backends | Hard fail |

---

## 8. Operational Requirements

### 8.1 Scripts

| Script | Purpose |
|--------|---------|
| `health-check.sh` | Calls `health.status` (authed), formats output. Exit 0 if healthy, 1 if degraded, 2 if unhealthy. |
| `smoke-test.sh` | Post-deployment verification: health check → auth test → session lifecycle → thread creation → session close → audit check → credential leak check on audit JSONL. Exit 0 = all pass. |
| `recent-activity.sh` | Calls `audit.query` for last 24h, formats as human-readable table. |
| `rebuild-audit-index.sh` | Drops and rebuilds SQLite index from JSONL files. Used when SQLite is corrupted. |
| `provision-secrets.sh` | Decrypts age-encrypted secrets to `/run/secrets/observer/` tmpfs. Run as root before server start. |

### 8.2 RUNBOOK.md Requirements

Must document: start/stop (systemd), config changes (validate → restart), secret rotation (age), audit recovery (rebuild index), emergency procedures (token revocation, backend disable), health status interpretation, common failure modes.

---

## 9. Single-Host Simplifications

Single-host canonical deployment (Decision Q3). TDS v2 simplifications:

| TDS Section | Change | Rationale |
|------------|--------|-----------|
| 2.6 (Two-VM Split) | Removed from core build | Optional hardening only |
| 3f (Router/Core Client) | Router calls dispatch as imported library | No cross-VM HTTP client needed |
| 3i (Cross-VM Protocol) | Removed entirely | No inter-VM communication |
| 4.1 `core:` config section | Replaced with `dispatch:` section | No remote core URL needed |
| 5.3 (Network Security) | Simplified — no Tailscale requirement | Single-host, localhost only |
| 7.4 (Startup Sequence) | One service set, not two | Single systemd service |
| Cross-VM timeout alignment | Removed | No network timeouts to align |

**Replaces VM-boundary security:** `sanitizedEnv()` (Phase 1) + bubblewrap (Phase 2). See TDS v2 Section 5.

---

## Appendix A: Two-VM Hardening (Optional)

For Proxmox users wanting defense-in-depth: see TDS v2 Sections 2.6 (split architecture), 3i (cross-VM protocol), 5.3 (Tailscale), and Decision Q8 (Bearer tokens → mTLS). **Not required for Phase 1.**

---

*Build order: S0 → S1+S2+S3+S6+S7 (parallel) → S4 → S5. Full threat model in TDS v2.*
