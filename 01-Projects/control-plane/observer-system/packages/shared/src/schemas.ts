// S0: Zod schemas matching every interface in types.ts
// Each schema validates correct data and rejects malformed data

import { z } from "zod";
import type {
  Session,
  Thread,
  Turn,
  Attachment,
  PolicyRequest,
  PolicyDecision,
  PolicyRule,
  PolicyCondition,
  ApprovalRequestParams,
  ApprovalResult,
  PendingApproval,
  ApprovalDecision,
  AuditEvent,
  AuditFilter,
  AuditQueryResult,
  ISCCriteria,
  DispatchRequest,
  DispatchResult,
  BackendStatus,
  HealthStatus,
  HealthChange,
  SessionResumeResult,
  SessionCreateParams,
  SessionCreateResult,
  SessionCloseParams,
  SessionCloseResult,
  SessionResumeParams,
  ThreadCreateParams,
  ThreadCreateResult,
  ThreadStatusParams,
  ThreadStatusResult,
  ThreadCancelParams,
  ThreadCancelResult,
  TurnSubmitParams,
  TurnSubmitResult,
  ApprovalRespondParams,
  ApprovalRespondResult,
  AuditQueryParams,
  AdminRevokeTokenParams,
  AdminRevokeTokenResult,
} from "./types.js";

// --- 4.1 Enum Schemas ---

export const ClientTypeSchema = z.enum([
  "cli",
  "telegram",
  "gui",
  "internal",
]);

export const ThreadStatusSchema = z.enum([
  "open",
  "processing",
  "awaiting_approval",
  "executing",
  "completed",
  "failed",
  "cancelled",
  "interrupted",
]);

export const IntentTypeSchema = z.enum([
  "cognitive",
  "build",
  "query",
  "system",
]);

export const ItemTypeSchema = z.enum([
  "message",
  "tool_call",
  "file_write",
  "approval_request",
  "dispatch",
  "status_update",
  "error",
]);

export const ApprovalTierSchema = z.enum([
  "auto_approve",
  "notify",
  "approve",
  "escalate",
  "block",
]);

export const AuditCategorySchema = z.enum([
  "session",
  "thread",
  "turn",
  "policy",
  "approval",
  "dispatch",
  "health",
  "security",
  "system",
]);

export const TaskTypeSchema = z.enum([
  "code-generation",
  "bug-fixing",
  "complex-refactoring",
  "architecture-review",
  "code-review",
  "security-audit",
  "research",
  "exploration",
  "drafts",
  "low-stakes-generation",
  "summarisation",
]);

export const SensitivityLevelSchema = z.enum([
  "public",
  "internal",
  "confidential",
]);

export const BackendHealthStateSchema = z.enum([
  "healthy",
  "degraded",
  "rate_limited",
  "unavailable",
  "disabled",
]);

// --- 4.2 Core Data Structure Schemas ---

export const AttachmentSchema = z.object({
  id: z.string(),
  type: z.enum(["text", "file_ref", "voice_transcript", "image_ref"]),
  filename: z.string().optional(),
  mime_type: z.string().optional(),
  content: z.string(),
  size_bytes: z.number().int().nonnegative().optional(),
  sanitized: z.boolean(),
  contains_sensitive: z.boolean(),
}) satisfies z.ZodType<Attachment>;

export const SessionSchema = z.object({
  id: z.string(),
  client_type: ClientTypeSchema,
  client_id: z.string(),
  created_at: z.string(),
  last_active_at: z.string(),
  status: z.enum(["active", "idle", "closed"]),
  thread_ids: z.array(z.string()),
}) satisfies z.ZodType<Session>;

export const ThreadSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  intent: z.string(),
  intent_type: IntentTypeSchema,
  status: ThreadStatusSchema,
  created_at: z.string(),
  updated_at: z.string(),
  turn_ids: z.array(z.string()),
  metadata: z.record(z.unknown()),
}) satisfies z.ZodType<Thread>;

export const TurnSchema = z.object({
  id: z.string(),
  thread_id: z.string(),
  message: z.string(),
  attachments: z.array(AttachmentSchema),
  status: z.enum(["submitted", "processing", "completed", "failed"]),
  created_at: z.string(),
  completed_at: z.string().nullable(),
  item_ids: z.array(z.string()),
}) satisfies z.ZodType<Turn>;

// --- 4.3 Policy Schemas ---

// PolicyCondition is recursive — use z.lazy
const basePolicyCondition = z.discriminatedUnion("type", [
  z.object({ type: z.literal("method_match"), methods: z.array(z.string()) }),
  z.object({
    type: z.literal("client_type_match"),
    client_types: z.array(ClientTypeSchema),
  }),
  z.object({
    type: z.literal("intent_contains"),
    keywords: z.array(z.string()),
  }),
  z.object({
    type: z.literal("rate_check"),
    max_per_minute: z.number().int().positive(),
  }),
]);

export const PolicyConditionSchema: z.ZodType<PolicyCondition> = z.union([
  basePolicyCondition,
  z.object({
    type: z.literal("and"),
    conditions: z.lazy(() => z.array(PolicyConditionSchema)),
  }),
  z.object({
    type: z.literal("or"),
    conditions: z.lazy(() => z.array(PolicyConditionSchema)),
  }),
  z.object({
    type: z.literal("not"),
    condition: z.lazy(() => PolicyConditionSchema),
  }),
]);

// Note: Cannot use satisfies here — z.unknown() makes params optional in
// Zod's inferred type, but PolicyRequest.params is required. Runtime behavior
// is correct: the schema accepts any value for params including undefined.
export const PolicyRequestSchema = z.object({
  method: z.string(),
  params: z.unknown(),
  session: SessionSchema,
  thread: ThreadSchema.nullable(),
});

export const PolicyDecisionSchema: z.ZodType<PolicyDecision> =
  z.discriminatedUnion("action", [
    z.object({ action: z.literal("allow") }),
    z.object({
      action: z.literal("deny"),
      reason: z.string(),
      rule_id: z.string(),
    }),
    z.object({
      action: z.literal("require_approval"),
      tier: ApprovalTierSchema,
      description: z.string(),
      rule_id: z.string(),
    }),
    z.object({
      action: z.literal("rate_limit"),
      retry_after_seconds: z.number(),
      rule_id: z.string(),
    }),
  ]);

export const PolicyRuleSchema = z.object({
  id: z.string(),
  description: z.string(),
  condition: PolicyConditionSchema,
  action: z.string(),
  priority: z.number().int(),
}) satisfies z.ZodType<PolicyRule>;

// --- 4.4 Approval Schemas ---

export const ApprovalRequestParamsSchema = z.object({
  thread_id: z.string(),
  description: z.string(),
  risk_level: z.enum(["low", "medium", "high", "critical"]),
  tier: ApprovalTierSchema,
  timeout_seconds: z.number().int().positive(),
  context: z.record(z.unknown()),
}) satisfies z.ZodType<ApprovalRequestParams>;

export const ApprovalResultSchema = z.object({
  approval_id: z.string(),
  decision: z.enum(["approved", "denied", "timeout"]),
  reason: z.string().nullable(),
  decided_by: z.string(),
  decided_at: z.string(),
}) satisfies z.ZodType<ApprovalResult>;

export const PendingApprovalSchema = z.object({
  approval_id: z.string(),
  thread_id: z.string(),
  session_id: z.string(),
  description: z.string(),
  risk_level: z.string(),
  tier: ApprovalTierSchema,
  created_at: z.string(),
  timeout_at: z.string(),
  status: z.enum(["pending", "approved", "denied", "expired"]),
}) satisfies z.ZodType<PendingApproval>;

export const ApprovalDecisionSchema = z.object({
  decision: z.enum(["approved", "denied"]),
  reason: z.string().optional(),
}) satisfies z.ZodType<ApprovalDecision>;

// --- 4.5 Audit Schemas ---

export const AuditEventSchema = z.object({
  event_id: z.string(),
  timestamp: z.string(),
  category: AuditCategorySchema,
  action: z.string(),
  session_id: z.string().nullable(),
  thread_id: z.string().nullable(),
  turn_id: z.string().nullable(),
  item_id: z.string().nullable(),
  client_id: z.string().nullable(),
  details: z.record(z.unknown()),
  policy_rule_id: z.string().nullable(),
  risk_level: z.string().nullable(),
}) satisfies z.ZodType<AuditEvent>;

export const AuditFilterSchema = z.object({
  session_id: z.string().optional(),
  thread_id: z.string().optional(),
  category: AuditCategorySchema.optional(),
  since: z.string().optional(),
  until: z.string().optional(),
  limit: z.number().int().positive().max(1000).optional(),
  cursor: z.string().optional(),
}) satisfies z.ZodType<AuditFilter>;

export const AuditQueryResultSchema = z.object({
  events: z.array(AuditEventSchema),
  total_count: z.number().int().nonnegative(),
  has_more: z.boolean(),
  next_cursor: z.string().optional(),
}) satisfies z.ZodType<AuditQueryResult>;

// --- 4.6 Dispatch Schemas ---

export const ISCCriteriaSchema = z.object({
  tests_pass: z.boolean().optional(),
  no_secrets: z.boolean().optional(),
  lint_clean: z.boolean().optional(),
  custom: z.record(z.unknown()).optional(),
}) satisfies z.ZodType<ISCCriteria>;

export const DispatchRequestSchema = z.object({
  dispatch_id: z.string(),
  mode: z.literal("specify"),
  slice: z.object({
    id: z.string(),
    description: z.string(),
    type: TaskTypeSchema,
    context_files: z.array(z.string()),
    working_directory: z.string(),
    isc_criteria: ISCCriteriaSchema,
    sensitivity: SensitivityLevelSchema.optional(),
  }),
  target_backend: z.string(),
}) satisfies z.ZodType<DispatchRequest>;

export const DispatchResultSchema = z.object({
  dispatch_id: z.string(),
  backend_used: z.string(),
  backend_version: z.string().nullable(),
  model_used: z.string().nullable(),
  execution_time_seconds: z.number().nonnegative(),
  tokens_used: z.number().int().nonnegative().nullable(),
  cost_estimate: z.enum(["free", "subscription", "per-token"]),
  status: z.enum(["completed", "failed", "timeout", "parse_error"]),
  exit_code: z.number().int(),
  artifacts: z.array(
    z.object({
      path: z.string(),
      type: z.enum(["code", "document", "config", "other"]),
      hash: z.string(),
    }),
  ),
  stdout_log: z.string(),
  stderr_log: z.string(),
  truncated: z.boolean(),
  validation_pending: z.boolean(),
}) satisfies z.ZodType<DispatchResult>;

export const BackendStatusSchema = z.object({
  name: z.string(),
  command: z.string(),
  enabled: z.boolean(),
  health_state: BackendHealthStateSchema,
  last_check: z.string(),
  last_used: z.string().nullable(),
  total_dispatches: z.number().int().nonnegative(),
  total_failures: z.number().int().nonnegative(),
}) satisfies z.ZodType<BackendStatus>;

// --- 4.7 Health Schemas ---

export const HealthStatusSchema = z.object({
  server: z.object({
    status: z.enum(["healthy", "degraded", "unhealthy"]),
    uptime_seconds: z.number().nonnegative(),
    memory_usage_mb: z.number().nonnegative(),
    active_sessions: z.number().int().nonnegative(),
    active_threads: z.number().int().nonnegative(),
    pending_approvals: z.number().int().nonnegative(),
  }),
  backends: z.record(
    z.object({
      status: BackendHealthStateSchema,
      last_check: z.string(),
      response_time_ms: z.number().nonnegative().nullable(),
      uptime_ratio: z.number().min(0).max(1),
      version: z.string().nullable(),
    }),
  ),
  audit: z.object({
    status: z.enum(["healthy", "error"]),
    jsonl_size_mb: z.number().nonnegative(),
    sqlite_size_mb: z.number().nonnegative(),
    event_count: z.number().int().nonnegative(),
  }),
}) satisfies z.ZodType<HealthStatus>;

export const HealthChangeSchema = z.object({
  component: z.string(),
  old_status: z.string(),
  new_status: z.string(),
  timestamp: z.string(),
  details: z.string(),
}) satisfies z.ZodType<HealthChange>;

// --- 4.8 Error Data Schema ---

export const ObserverErrorDataSchema: z.ZodType<
  import("./types.js").ObserverErrorData
> = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("policy_denied"),
    rule_id: z.string(),
    reason: z.string(),
  }),
  z.object({
    type: z.literal("rate_limited"),
    retry_after_seconds: z.number(),
  }),
  z.object({
    type: z.literal("backend_unavailable"),
    backend: z.string(),
    health_state: BackendHealthStateSchema,
  }),
  z.object({
    type: z.literal("backend_auth_failure"),
    message: z.string(),
  }),
  z.object({
    type: z.literal("approval_timeout"),
    approval_id: z.string(),
    timeout_seconds: z.number(),
  }),
  z.object({
    type: z.literal("validation_failed"),
    field: z.string(),
    message: z.string(),
  }),
  z.object({
    type: z.literal("session_not_found"),
    session_id: z.string(),
  }),
  z.object({
    type: z.literal("thread_not_found"),
    thread_id: z.string(),
  }),
]);

// --- Session Resume Schema ---

export const SessionResumeResultSchema = z.object({
  session_id: z.string(),
  threads: z.array(
    z.object({
      thread_id: z.string(),
      intent: z.string(),
      status: ThreadStatusSchema,
      updated_at: z.string(),
    }),
  ),
  pending_approvals: z.array(PendingApprovalSchema),
}) satisfies z.ZodType<SessionResumeResult>;

// --- JSON-RPC Method Param/Result Schemas ---

export const SessionCreateParamsSchema = z.object({
  client_type: ClientTypeSchema,
  client_id: z.string(),
}) satisfies z.ZodType<SessionCreateParams>;

export const SessionCreateResultSchema = z.object({
  session_id: z.string(),
  created_at: z.string(),
}) satisfies z.ZodType<SessionCreateResult>;

export const SessionCloseParamsSchema = z.object({
  session_id: z.string(),
}) satisfies z.ZodType<SessionCloseParams>;

export const SessionCloseResultSchema = z.object({
  closed: z.literal(true),
}) satisfies z.ZodType<SessionCloseResult>;

export const SessionResumeParamsSchema = z.object({
  session_id: z.string(),
}) satisfies z.ZodType<SessionResumeParams>;

export const ThreadCreateParamsSchema = z.object({
  session_id: z.string(),
  intent: z.string(),
  intent_type: IntentTypeSchema,
  context: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
}) satisfies z.ZodType<ThreadCreateParams>;

export const ThreadCreateResultSchema = z.object({
  thread_id: z.string(),
  status: ThreadStatusSchema,
}) satisfies z.ZodType<ThreadCreateResult>;

export const ThreadStatusParamsSchema = z.object({
  thread_id: z.string(),
}) satisfies z.ZodType<ThreadStatusParams>;

export const ThreadStatusResultSchema = z.object({
  thread_id: z.string(),
  status: ThreadStatusSchema,
  turns: z.array(TurnSchema),
  pending_approvals: z.array(PendingApprovalSchema),
}) satisfies z.ZodType<ThreadStatusResult>;

export const ThreadCancelParamsSchema = z.object({
  thread_id: z.string(),
}) satisfies z.ZodType<ThreadCancelParams>;

export const ThreadCancelResultSchema = z.object({
  cancelled: z.literal(true),
}) satisfies z.ZodType<ThreadCancelResult>;

export const TurnSubmitParamsSchema = z.object({
  thread_id: z.string(),
  message: z.string(),
  attachments: z.array(AttachmentSchema).optional(),
}) satisfies z.ZodType<TurnSubmitParams>;

export const TurnSubmitResultSchema = z.object({
  turn_id: z.string(),
  status: z.enum(["submitted", "processing", "completed", "failed"]),
}) satisfies z.ZodType<TurnSubmitResult>;

export const ApprovalRespondParamsSchema = z.object({
  approval_id: z.string(),
  decision: ApprovalDecisionSchema,
}) satisfies z.ZodType<ApprovalRespondParams>;

export const ApprovalRespondResultSchema = z.object({
  acknowledged: z.literal(true),
}) satisfies z.ZodType<ApprovalRespondResult>;

export const AuditQueryParamsSchema =
  AuditFilterSchema satisfies z.ZodType<AuditQueryParams>;

export const AdminRevokeTokenParamsSchema = z.object({
  token_hash: z.string(),
}) satisfies z.ZodType<AdminRevokeTokenParams>;

export const AdminRevokeTokenResultSchema = z.object({
  revoked: z.boolean(),
  active_tokens: z.number().int().nonnegative(),
}) satisfies z.ZodType<AdminRevokeTokenResult>;
