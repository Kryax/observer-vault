# TDS v2 Change Manifest

Instructions: Apply all changes below to Technical_Design_Specification_v1.md to produce Technical_Design_Specification_v2.md. Mark every change with `[v2: CHANGED]` inline. Preserve all original content not explicitly changed.

## Header Changes

- Version: 1.0 → 2.0
- Status: Add "v2 incorporates multi-agent review findings"
- Add a "v2 Changes" subsection after the Governance Notice listing all change categories

---

## Section 1: Technology Stack

### 1.2 Runtime (line ~58-76)
[v2: CHANGED] Add after "Node 22 with `tsx`" paragraph:
**Arch/CachyOS Note:** Arch Linux ships rolling-release Node.js via `pacman` (typically current, not LTS). Install Node 22 LTS via `fnm` or the `nodejs-lts-jod` AUR package. Update systemd `ExecStart` path accordingly. Verify with `node --version` before first build.

### 1.6 Key Dependencies (line ~117)
[v2: CHANGED] Add security note about better-sqlite3:
**Supply chain note (T17):** `better-sqlite3` compiles native C++ bindings at install time. Always install with `npm ci` (not `npm install`) to enforce lockfile integrity. Never run `npm install` as the service user — use a separate build step without access to `/run/secrets/`. See Section 5 T17.

---

## Section 3: Component Specifications

### 3a — JSON-RPC Server (line ~317)

**Gap 1 fix:** [v2: CHANGED] Add `Attachment` type definition to shared types:
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

**Gap 2 fix:** [v2: CHANGED] Add `ClientType` type alias:
```typescript
type ClientType = "cli" | "telegram" | "gui" | "internal";
```
Add policy rule for internal client type in config example.

**Gap 3 fix:** [v2: CHANGED] Remove `auth_token` from `session.create` params. Auth is via HTTP `Authorization: Bearer` header only. Update method table:
```
session.create: { client_type: ClientType, client_id: string }
```
Add development guideline: "No middleware or logging configuration shall log raw HTTP headers. The pino request serializer is the ONLY authorized request logging path."

**Gap 8 fix:** [v2: CHANGED] Add `ApprovalDecision` input type:
```typescript
interface ApprovalDecision {
  decision: "approved" | "denied";
  reason?: string;
}
```

**Gap 9 fix:** [v2: CHANGED] Add pagination to `AuditQueryResult`:
```typescript
interface AuditQueryResult {
  events: AuditEvent[];
  total_count: number;
  has_more: boolean;
  next_cursor?: string;
}
interface AuditFilter {
  // existing fields...
  cursor?: string;
}
```

**Gap 11 fix:** [v2: CHANGED] Define `SessionResumeResult`:
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

**Gap 12 fix:** [v2: CHANGED] Add `ObserverErrorData` discriminated union:
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

**SEC-3 fix:** [v2: CHANGED] Add to auth.ts specification: "All token comparisons MUST use `crypto.timingSafeEqual()`. Standard string equality (`===`) leaks timing information."

**SEC-5 fix:** [v2: CHANGED] Add authentication failure rate limiting to the server specification:
"Rate limit failed authentication attempts: 10 failures per minute per source IP, exponential backoff. Applied at HTTP handler layer BEFORE JSON-RPC routing. Lockout after 50 consecutive failures with audit trail entry."

**Token rotation — add `admin.revoke_token` to method table:** [v2: CHANGED] YES. Keep hot-revocation for tokens only (Operator conceded after rate limiter state argument). Add `admin.revoke_token` as a first-class JSON-RPC method:
- Scoped narrowly: only affects in-memory token revocation list, not general config hot-reload
- CLI-only authentication required (same pattern as `audit.query`)
- Revocation list is ephemeral (lost on restart — acceptable because restart loads new token from config)
- Document as surgical exception to no-hot-reload philosophy
```typescript
// admin.revoke_token: { token_hash: string }
// Returns: { revoked: boolean, active_tokens: number }
// Auth: CLI-only (admin methods require local CLI client)
```

### 3b — Session Manager

**Gap 4 fix:** [v2: CHANGED] Add `ThreadEvent` type with discriminated union (NOT `content: unknown`):
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
Add ordering invariant: "No ThreadEvent is emitted to clients until content has passed through the credential sanitizer."

**SEC-13 fix (new):** [v2: CHANGED] Add Session Store sanitization requirement:
"The Session Store MUST pass turn messages and attachment content through the credential sanitizer BEFORE persistence to SQLite. The Session Store is a persistence path separate from the audit trail and MUST NOT store unsanitized user-supplied content."

### 3c — Policy Enforcer

**Gap 5 fix:** [v2: CHANGED] Add `IntentType` and update Thread interface:
```typescript
type IntentType = "cognitive" | "build" | "query" | "system";
```
`intent_type` is CLIENT-DECLARED, not inferred from message content. Policy enforcement checks `client_type` × `intent_type` structurally.

Update Thread:
```typescript
interface Thread {
  // existing fields...
  intent_type: IntentType;
}
```

### 3e — Audit Logger

[v2: CHANGED] Make SQLite writes asynchronous per Sentry↔Operator resolution:
- JSONL write: synchronous and blocking (governance guarantee)
- SQLite insert: asynchronous, batched on 1-second timer or 100-event buffer
- If SQLite write fails: log warning but do not block. SQLite is convenience layer.
- Add rebuild mechanism: `scripts/rebuild-audit-index.sh`

[v2: CHANGED] Add JSONL integrity check on startup: read last line, verify valid JSON, truncate if corrupted, log warning.

[v2: CHANGED] Enforce max audit event size within PIPE_BUF (4096 bytes). Truncate details payloads if necessary.

[v2: CHANGED] Add abstract storage interfaces:
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

### 3f — Router

**Gap 5 routing update:** [v2: CHANGED] Router uses `intent_type` field (structural) for routing decisions, not keyword matching on `intent` string.

[v2: CHANGED] Update error translation: error messages MUST be hardcoded control-plane-generated strings. Never include raw backend stderr in client-facing error messages.

### 3g — Execution Dispatch

**Gap 6 fix:** [v2: CHANGED] Standardize dispatch request to TDS format (TDS is canonical):
- ID prefix: `dsp_` + nanoid(12)
- `target_backend` (not `target_override`)
- Add `SensitivityLevel` and `ISCCriteria` types

**Gap 7 fix:** [v2: CHANGED] Add `parse_error` to Section 5.4.3 status enum:
```typescript
status: "completed" | "failed" | "timeout" | "parse_error";
```

**Risk 14 fix:** [v2: CHANGED] Remove "Config reload works without server restart" from dispatch ISC exit criteria. Both services require restart for config changes. Consistent policy.

**Risk 6 fix:** [v2: CHANGED] Orphan recovery must verify PID AND process start time:
"Store PIDs with process start time (`/proc/[pid]/stat` field 22). On recovery, verify both PID AND start time match before killing. Consider using systemd slice for cgroup-based process scoping."

**SEC-2 fix:** [v2: CHANGED] Add TOCTOU mitigation to path validation:
"Resolve all symlinks with `fs.realpath()` AFTER allowlist validation. Re-check resolved path against allowlist. Use `O_NOFOLLOW` where possible. Document as accepted residual risk for Phase 1; Phase 2 bubblewrap provides structural fix."

### 3h — Health Monitor

**Gap 10 fix:** [v2: CHANGED] Standardize health states:
```typescript
type BackendHealthState = "healthy" | "degraded" | "rate_limited" | "unavailable" | "disabled";
```
Remove redundant `healthy: boolean` from BackendStatus.

**Risk 9 fix:** [v2: CHANGED] Add `health_monitor.last_heartbeat` field. Health monitor updates on every polling cycle. If heartbeat > 2× fastest polling interval, response includes staleness warning.

**SEC-4 fix:** [v2: CHANGED] Split health endpoint into public/authenticated views:
- Unauthenticated: returns only `{ status, uptime_seconds }` (liveness probe)
- Authenticated: returns full topology, backends, versions, metrics

### Cross-VM Internal Methods (NEW SUBSECTION)

**Gap 13 fix:** [v2: CHANGED] Add new subsection "3i — Cross-VM Internal Protocol" defining:
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

Auth config supporting evolution:
```typescript
type CoreAuthConfig =
  | { strategy: "bearer_token"; token_path: string }
  | { strategy: "hmac_signed"; key_path: string; algorithm: "sha256" }
  | { strategy: "mtls"; cert_path: string; key_path: string; ca_path: string };
```

Add cross-VM sanitization requirement: "The control plane MUST scan cross-VM payloads for credential patterns before transmission. Set `contains_sensitive: true` when detected. Receiving components MUST NOT log raw message content without sanitizer pass."

---

## Section 4: Configuration Schemas

### 4.1 — control-plane.yaml

[v2: CHANGED] Fix `core.timeout_ms`: set to 1260000 (21 minutes) minimum, not 300000. Add Zod validation rule: `core.timeout_ms >= max(backends.*.timeout_seconds) * 1000 + 60000`.

[v2: CHANGED] Add prerequisite comment at top of config:
```yaml
# PREREQUISITE: Run scripts/provision-secrets.sh before starting. See RUNBOOK.md.
```

[v2: CHANGED] Add comment next to `core.url`:
```yaml
# Find with: tailscale ip -4 <cachyos-hostname>
```

[v2: CHANGED] Keep approval_channels matrix including Telegram/GUI entries (Sentry's verdict: security control, not feature). Add comment: "# Telegram and GUI channels are pre-configured for Phase 2. Active enforcement begins when those clients are implemented."

### 4.2 — execution-backends.yaml

[v2: CHANGED] Make `sensitivity` section optional when `routing_mode: "specify"`. Add Zod validation: required when routing_mode is "recommend" or "council".

---

## Section 5: Security Architecture

### New Threats

[v2: CHANGED] Add T17: "npm dependency supply chain compromise during installation"
- Mitigations: npm ci (not npm install), --ignore-scripts + pre-build native modules, separate build user without /run/secrets/ access, lockfile integrity verification

[v2: CHANGED] Add T18: "TOCTOU race on filesystem path validation"
- Mitigations: fs.realpath() after validation, O_NOFOLLOW, Phase 2 bubblewrap structural fix

[v2: CHANGED] Add T19: "Token rotation failure leaves stale credentials active"
- Mitigations: Coordinated rotation procedure, health check for cross-VM token sync, brief dual-token acceptance window

### New NNFs

[v2: CHANGED] Add NNF-7: "Authentication failure rate limiting" — IP-based rate limiting on failed auth attempts, 10 failures/min, exponential backoff

[v2: CHANGED] Add NNF-8: "Telegram messages MUST NOT reach file-access-capable backends" — structural enforcement via intent_type classification + policy rules, not keyword blocklist

### 5.2 — Credential Management

[v2: CHANGED] Add explicit statement: "Phase 1 credential isolation is defense-in-depth against accidental leakage, NOT against a compromised dispatch process. Full isolation requires Phase 2 bubblewrap sandboxing."

[v2: CHANGED] Add to credential detection: Base64 decoding pass, URL-decoding pass, JSON unicode-escape normalization before regex scanning.

### 5.4.3 — Dispatch Result Integrity

[v2: CHANGED] Update status enum to include `parse_error`: `"completed" | "failed" | "timeout" | "parse_error"`

### 5.5 — Audit Trail Integrity

[v2: CHANGED] Add: audit write deadlock prevention — exempt `health.status` and `session.close` from audit-write-must-succeed requirement. Add circuit breaker: 5 consecutive audit write failures → CRITICAL health status, degraded mode (reads allowed, writes return AuditFailure).

[v2: CHANGED] Add JSONL file integrity protection: per-entry HMAC using age-derived key. SHA-256 hash stored alongside archived JSONL files at rotation. Periodic integrity verification.

### 5.7 — Blast Radius Analysis

[v2: CHANGED] Expand Tailscale compromise blast radius: document that shared cross-VM token means one token from full compromise. Recommend asymmetric tokens (different token for each direction) or mTLS for Phase 2. Add Tailscale ACL recommendation: restrict CachyOS to accept connections only from Relay VM's Tailscale IP.

[v2: CHANGED] Add health endpoint to blast radius: unauthenticated health.status provides recon payload if Tailscale compromised. Mitigated by public/authenticated split.

### Telegram Security (SEC-7)

[v2: CHANGED] Replace keyword-based intent filtering with structural enforcement: Telegram clients can ONLY submit `intent_type: "cognitive"`. Policy enforcer checks `client_type × intent_type` — structural check, not keyword matching. Document residual risk: LLM prompt injection at headless core layer is out of scope for control plane enforcement.

---

## Section 6: Testing Strategy

### 6.1 — Testing Framework

**Gap 14 fix:** [v2: CHANGED] Replace "bun test" with vitest. Align with Section 1.2 "No Bun" decision:
"Framework: `vitest` (fast, ESM-native, TypeScript-first). Tests run on Node.js 22 LTS via tsx. One runtime for development, testing, and production, consistent with Section 1.2."

### 6.3 — Credential Isolation Tests

[v2: CHANGED] Add test: cross-VM request sanitization — capture HTTP request body sent to core, verify `contains_sensitive` flag when message contains credential patterns.

[v2: CHANGED] Add test: Session Store persistence — verify that turn messages and attachments are sanitized before SQLite persistence.

---

## Section 7: Deployment and Operations

### 7.1 — Prerequisites

[v2: CHANGED] Add Node.js version management note for Arch/CachyOS (see Section 1.2 change above).

### 7.3 — provision-secrets.sh

[v2: CHANGED] Fix bash globbing bug: add `shopt -s globstar` or replace `**/*.age` glob with `find "$ENCRYPTED_DIR" -name '*.age'`.

### 7.4 — systemd Units

[v2: CHANGED] Keep `User=observer` (Operator conceded after Sentry challenge). Add installation step: `useradd --system --no-create-home observer`.

[v2: CHANGED] Fix ExecStartPre: prefix with `+` for root execution: `ExecStartPre=+/path/to/provision-secrets.sh`.

[v2: CHANGED] Keep `ProtectHome=read-only` with `ReadWritePaths` (Operator partially conceded). Add:
- Minimum systemd version requirement: >= 249
- Verification step: `systemd-analyze security observer-control-plane`
- RUNBOOK troubleshooting: "If EACCES on data writes, add path to ReadWritePaths, daemon-reload, restart"

### 7.5 — Shutdown Sequence

[v2: CHANGED] Add pending approval handling: on SIGTERM, transition all pending approvals to `expired` with reason `server_shutdown`. Mark corresponding threads as `interrupted`. On restart, surface both for manual resolution.

### 7.6 — Phone Debugging

[v2: CHANGED] Add cross-VM SSH commands to RUNBOOK. Add `scripts/full-status.sh` on Relay VM that SSHes to CachyOS and aggregates both services' health.

[v2: CHANGED] Add trace_id / correlation_id: pass from control plane through cross-VM JSON-RPC call, log on both sides. Enables `journalctl | grep trace_id` across VMs.

[v2: CHANGED] Document Tailscale-is-down failure mode: what Adam sees, what he can do from each VM independently.

### 7.7 — Startup Sequence

[v2: CHANGED] Add startup grace period: 120 seconds after control plane boot during which dispatch unreachability is logged as `booting` rather than `unreachable`. After grace period, treated as genuine failure.

[v2: CHANGED] Add automated session DB rebuild: if integrity check fails, attempt rebuild from audit JSONL before exiting. Provide `scripts/rebuild-sessions.sh`.

[v2: CHANGED] Add startup rate limiter: 10 req/min for first 60 seconds after boot (prevents restart-loop amplification from flood attacks).

### 7.8 — Operational Scripts

[v2: CHANGED] Fix `recent-activity.sh`: rewrite to query actual `audit_events` table with actual column names (`timestamp`, `category`, `action`, `session_id`).

[v2: CHANGED] Add `scripts/rebuild-audit-index.sh` — rebuilds SQLite index from JSONL files.

[v2: CHANGED] Add JSONL file size to health check output.

### 7.9 — Token Rotation

[v2: CHANGED] Document `admin.revoke_token` as the immediate response mechanism. Rotation procedure:
"If a token is compromised: (1) immediately call `admin.revoke_token` via CLI to invalidate the old token (stops active abuse, preserves rate limiter state), (2) generate new token, (3) encrypt with age, (4) deploy to both VMs, (5) systemctl restart on both (loads new token, clears ephemeral revocation list — which is fine because the new token is now active)."

[v2: CHANGED] Add coordinated rotation procedure: validate both VMs accept new token before decommissioning old one. Health check verifies cross-VM auth token synchronization.

---

## Section 8: Slice Dependency Graph

[v2: CHANGED] Revise timeline: "5 weeks" → "8-10 weeks for solo development." State explicitly: "The parallel group (S1-S3, S6-S7) is listed as parallel for dependency purposes but will be built serially by a solo developer. The 5-week timeline assumes AI-assisted parallel development."

[v2: CHANGED] Add S2 (Policy Enforcer) as critical path item with 1-week buffer. Alternative: build S4 with mock policy enforcer to decouple.

[v2: CHANGED] Add dotted-line dependency note from S4 to S0's dispatch types.

[v2: CHANGED] Note: dispatch layer "config reload without restart" ISC criterion removed — both services require restart (consistent policy).

---

## Section 9: Open Questions

[v2: CHANGED] Add Q7: "Single-VM collapse: if Q3 is resolved by collapsing to one VM, the dedicated `observer` user must be reinstated OR bubblewrap sandboxing pulled forward to Phase 1. Two-VM architecture is what makes running as `adam` safe."

[v2: CHANGED] Add Q8: "Cross-VM auth strategy: Phase 1 uses shared Bearer token. Should Phase 2 move to asymmetric tokens or mTLS? The shared token means one compromised credential = full system access."
