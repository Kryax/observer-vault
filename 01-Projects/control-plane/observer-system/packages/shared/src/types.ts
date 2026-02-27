// S0: All TypeScript interfaces and type aliases from PRD Section 4
// Pure type definitions — no runtime logic

// --- 4.1 Enums and Union Types ---

export type ClientType = "cli" | "telegram" | "gui" | "internal";

export type ThreadStatus =
  | "open"
  | "processing"
  | "awaiting_approval"
  | "executing"
  | "completed"
  | "failed"
  | "cancelled"
  | "interrupted";

export type IntentType = "cognitive" | "build" | "query" | "system";

export type ItemType =
  | "message"
  | "tool_call"
  | "file_write"
  | "approval_request"
  | "dispatch"
  | "status_update"
  | "error";

export type ApprovalTier =
  | "auto_approve"
  | "notify"
  | "approve"
  | "escalate"
  | "block";

export type AuditCategory =
  | "session"
  | "thread"
  | "turn"
  | "policy"
  | "approval"
  | "dispatch"
  | "health"
  | "security"
  | "system";

export type TaskType =
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

export type SensitivityLevel = "public" | "internal" | "confidential";

export type BackendHealthState =
  | "healthy"
  | "degraded"
  | "rate_limited"
  | "unavailable"
  | "disabled";

// --- 4.2 Core Data Structures ---

export interface Session {
  id: string;
  client_type: ClientType;
  client_id: string;
  created_at: string;
  last_active_at: string;
  status: "active" | "idle" | "closed";
  thread_ids: string[];
}

export interface Thread {
  id: string;
  session_id: string;
  intent: string;
  intent_type: IntentType;
  status: ThreadStatus;
  created_at: string;
  updated_at: string;
  turn_ids: string[];
  metadata: Record<string, unknown>;
}

export interface Turn {
  id: string;
  thread_id: string;
  message: string;
  attachments: Attachment[];
  status: "submitted" | "processing" | "completed" | "failed";
  created_at: string;
  completed_at: string | null;
  item_ids: string[];
}

export interface Attachment {
  id: string;
  type: "text" | "file_ref" | "voice_transcript" | "image_ref";
  filename?: string;
  mime_type?: string;
  content: string;
  size_bytes?: number;
  sanitized: boolean;
  contains_sensitive: boolean;
}

// --- 4.3 Policy Types ---

export interface PolicyRequest {
  method: string;
  params: unknown;
  session: Session;
  thread: Thread | null;
}

export type PolicyDecision =
  | { action: "allow" }
  | { action: "deny"; reason: string; rule_id: string }
  | {
      action: "require_approval";
      tier: ApprovalTier;
      description: string;
      rule_id: string;
    }
  | { action: "rate_limit"; retry_after_seconds: number; rule_id: string };

export interface PolicyRule {
  id: string;
  description: string;
  condition: PolicyCondition;
  action: string;
  priority: number;
}

export type PolicyCondition =
  | { type: "method_match"; methods: string[] }
  | { type: "client_type_match"; client_types: ClientType[] }
  | { type: "intent_contains"; keywords: string[] }
  | { type: "rate_check"; max_per_minute: number }
  | { type: "and"; conditions: PolicyCondition[] }
  | { type: "or"; conditions: PolicyCondition[] }
  | { type: "not"; condition: PolicyCondition };

// --- 4.4 Approval Types ---

export interface ApprovalRequestParams {
  thread_id: string;
  description: string;
  risk_level: "low" | "medium" | "high" | "critical";
  tier: ApprovalTier;
  timeout_seconds: number;
  context: Record<string, unknown>;
}

export interface ApprovalResult {
  approval_id: string;
  decision: "approved" | "denied" | "timeout";
  reason: string | null;
  decided_by: string;
  decided_at: string;
}

export interface PendingApproval {
  approval_id: string;
  thread_id: string;
  session_id: string;
  description: string;
  risk_level: string;
  tier: ApprovalTier;
  created_at: string;
  timeout_at: string;
  status: "pending" | "approved" | "denied" | "expired";
}

export interface ApprovalDecision {
  decision: "approved" | "denied";
  reason?: string;
}

// --- 4.5 Audit Types ---

export interface AuditEvent {
  event_id: string;
  timestamp: string;
  category: AuditCategory;
  action: string;
  session_id: string | null;
  thread_id: string | null;
  turn_id: string | null;
  item_id: string | null;
  client_id: string | null;
  details: Record<string, unknown>;
  policy_rule_id: string | null;
  risk_level: string | null;
}

export interface AuditFilter {
  session_id?: string;
  thread_id?: string;
  category?: AuditCategory;
  since?: string;
  until?: string;
  limit?: number;
  cursor?: string;
}

export interface AuditQueryResult {
  events: AuditEvent[];
  total_count: number;
  has_more: boolean;
  next_cursor?: string;
}

// --- 4.6 Dispatch Types ---

export interface ISCCriteria {
  tests_pass?: boolean;
  no_secrets?: boolean;
  lint_clean?: boolean;
  custom?: Record<string, unknown>;
}

export interface DispatchRequest {
  dispatch_id: string;
  mode: "specify";
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

export interface DispatchResult {
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
  stdout_log: string;
  stderr_log: string;
  truncated: boolean;
  validation_pending: boolean;
}

export interface BackendStatus {
  name: string;
  command: string;
  enabled: boolean;
  health_state: BackendHealthState;
  last_check: string;
  last_used: string | null;
  total_dispatches: number;
  total_failures: number;
}

// --- 4.7 Health Types ---

export interface HealthStatus {
  server: {
    status: "healthy" | "degraded" | "unhealthy";
    uptime_seconds: number;
    memory_usage_mb: number;
    active_sessions: number;
    active_threads: number;
    pending_approvals: number;
  };
  backends: Record<
    string,
    {
      status: BackendHealthState;
      last_check: string;
      response_time_ms: number | null;
      uptime_ratio: number;
      version: string | null;
    }
  >;
  audit: {
    status: "healthy" | "error";
    jsonl_size_mb: number;
    sqlite_size_mb: number;
    event_count: number;
  };
}

export interface HealthChange {
  component: string;
  old_status: string;
  new_status: string;
  timestamp: string;
  details: string;
}

// --- 4.8 Error Types ---

export enum ObserverErrorCode {
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

export type ObserverErrorData =
  | { type: "policy_denied"; rule_id: string; reason: string }
  | { type: "rate_limited"; retry_after_seconds: number }
  | {
      type: "backend_unavailable";
      backend: string;
      health_state: BackendHealthState;
    }
  | { type: "backend_auth_failure"; message: string }
  | {
      type: "approval_timeout";
      approval_id: string;
      timeout_seconds: number;
    }
  | { type: "validation_failed"; field: string; message: string }
  | { type: "session_not_found"; session_id: string }
  | { type: "thread_not_found"; thread_id: string };

// --- 4.9 Session Resume ---

export interface SessionResumeResult {
  session_id: string;
  threads: Array<{
    thread_id: string;
    intent: string;
    status: ThreadStatus;
    updated_at: string;
  }>;
  pending_approvals: PendingApproval[];
}

// --- 4.10 JSON-RPC Method Params/Results ---

export interface SessionCreateParams {
  client_type: ClientType;
  client_id: string;
}

export interface SessionCreateResult {
  session_id: string;
  created_at: string;
}

export interface SessionCloseParams {
  session_id: string;
}

export interface SessionCloseResult {
  closed: true;
}

export interface SessionResumeParams {
  session_id: string;
}

export interface ThreadCreateParams {
  session_id: string;
  intent: string;
  intent_type: IntentType;
  context?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface ThreadCreateResult {
  thread_id: string;
  status: ThreadStatus;
}

export interface ThreadStatusParams {
  thread_id: string;
}

export interface ThreadStatusResult {
  thread_id: string;
  status: ThreadStatus;
  turns: Turn[];
  pending_approvals: PendingApproval[];
}

export interface ThreadCancelParams {
  thread_id: string;
}

export interface ThreadCancelResult {
  cancelled: true;
}

export interface TurnSubmitParams {
  thread_id: string;
  message: string;
  attachments?: Attachment[];
}

export interface TurnSubmitResult {
  turn_id: string;
  status: "submitted" | "processing" | "completed" | "failed";
}

export interface ApprovalRespondParams {
  approval_id: string;
  decision: ApprovalDecision;
}

export interface ApprovalRespondResult {
  acknowledged: true;
}

export interface HealthStatusParams {
  // Empty — no params needed
}

export interface AuditQueryParams extends AuditFilter {}

export interface AdminRevokeTokenParams {
  token_hash: string;
}

export interface AdminRevokeTokenResult {
  revoked: boolean;
  active_tokens: number;
}

// --- 4.11 Service Interfaces (signatures only — no implementations) ---

export interface SessionManager {
  createSession(clientType: ClientType, clientId: string): Promise<Session>;
  getSession(id: string): Promise<Session | null>;
  resumeSession(id: string): Promise<Session>;
  closeSession(id: string): Promise<void>;
  createThread(
    sessionId: string,
    intent: string,
    intentType: IntentType,
    context?: Record<string, unknown>,
    metadata?: Record<string, unknown>,
  ): Promise<Thread>;
  getThread(id: string): Promise<Thread | null>;
  updateThreadStatus(id: string, status: ThreadStatus): Promise<void>;
  cancelThread(id: string): Promise<void>;
  createTurn(
    threadId: string,
    message: string,
    attachments?: Attachment[],
  ): Promise<Turn>;
  completeTurn(id: string, summary: string): Promise<void>;
}

export interface PolicyEnforcer {
  evaluate(req: PolicyRequest): PolicyDecision;
  loadRules(path: string): void;
  getRules(): PolicyRule[];
}

export interface ApprovalGateway {
  requestApproval(params: ApprovalRequestParams): Promise<ApprovalResult>;
  submitDecision(id: string, decision: ApprovalDecision): Promise<void>;
  getPendingApprovals(sessionId: string): Promise<PendingApproval[]>;
  getAllPending(): Promise<PendingApproval[]>;
}

export interface AuditLogger {
  log(event: AuditEvent): void;
  query(filter: AuditFilter): AuditQueryResult;
  tail(count: number): AuditEvent[];
}

export interface AuditStore {
  append(event: AuditEvent): void;
  query(filter: AuditFilter): AuditQueryResult;
  rebuild(): void;
}

export interface SessionStore {
  save(session: Session): Promise<void>;
  load(id: string): Promise<Session | null>;
  listActive(): Promise<Session[]>;
}

export interface HealthMonitor {
  getStatus(): HealthStatus;
  checkBackend(name: string): BackendHealthState;
  onStatusChange(cb: (change: HealthChange) => void): void;
}

// --- ID Prefix Constants ---

export const ID_PREFIXES = {
  session: "ses_",
  thread: "thr_",
  turn: "trn_",
  item: "itm_",
  audit_event: "evt_",
  dispatch: "dsp_",
  approval: "apr_",
} as const;

export const ID_LENGTHS: Record<keyof typeof ID_PREFIXES, number> = {
  session: 12,
  thread: 12,
  turn: 12,
  item: 12,
  audit_event: 16,
  dispatch: 12,
  approval: 12,
};
