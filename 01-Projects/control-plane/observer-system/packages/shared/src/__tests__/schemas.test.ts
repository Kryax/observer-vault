import { describe, it, expect } from "vitest";
import {
  SessionSchema,
  ThreadSchema,
  TurnSchema,
  AttachmentSchema,
  PolicyRequestSchema,
  PolicyDecisionSchema,
  PolicyRuleSchema,
  PolicyConditionSchema,
  ApprovalRequestParamsSchema,
  ApprovalResultSchema,
  PendingApprovalSchema,
  ApprovalDecisionSchema,
  AuditEventSchema,
  AuditFilterSchema,
  AuditQueryResultSchema,
  DispatchRequestSchema,
  DispatchResultSchema,
  BackendStatusSchema,
  HealthStatusSchema,
  HealthChangeSchema,
  ObserverErrorDataSchema,
  SessionResumeResultSchema,
  SessionCreateParamsSchema,
  SessionCloseParamsSchema,
  ThreadCreateParamsSchema,
  TurnSubmitParamsSchema,
  ApprovalRespondParamsSchema,
  ClientTypeSchema,
  ThreadStatusSchema,
  IntentTypeSchema,
  ApprovalTierSchema,
  AuditCategorySchema,
  TaskTypeSchema,
  ISCCriteriaSchema,
} from "../schemas.js";

// --- Enum/Union Schemas ---

describe("ClientTypeSchema", () => {
  it("accepts valid client types", () => {
    expect(ClientTypeSchema.parse("cli")).toBe("cli");
    expect(ClientTypeSchema.parse("telegram")).toBe("telegram");
    expect(ClientTypeSchema.parse("gui")).toBe("gui");
    expect(ClientTypeSchema.parse("internal")).toBe("internal");
  });

  it("rejects invalid client types", () => {
    expect(() => ClientTypeSchema.parse("slack")).toThrow();
    expect(() => ClientTypeSchema.parse("")).toThrow();
    expect(() => ClientTypeSchema.parse(42)).toThrow();
  });
});

describe("ThreadStatusSchema", () => {
  it("accepts all valid statuses", () => {
    const statuses = [
      "open",
      "processing",
      "awaiting_approval",
      "executing",
      "completed",
      "failed",
      "cancelled",
      "interrupted",
    ];
    for (const s of statuses) {
      expect(ThreadStatusSchema.parse(s)).toBe(s);
    }
  });

  it("rejects invalid statuses", () => {
    expect(() => ThreadStatusSchema.parse("running")).toThrow();
  });
});

// --- Core Data Structures ---

describe("SessionSchema", () => {
  const validSession = {
    id: "ses_a1b2c3d4e5f6",
    client_type: "cli",
    client_id: "adam-local",
    created_at: "2026-02-28T10:00:00Z",
    last_active_at: "2026-02-28T10:05:00Z",
    status: "active",
    thread_ids: ["thr_x1y2z3w4v5u6"],
  };

  it("accepts valid session", () => {
    const result = SessionSchema.parse(validSession);
    expect(result.id).toBe("ses_a1b2c3d4e5f6");
    expect(result.client_type).toBe("cli");
    expect(result.status).toBe("active");
  });

  it("rejects session with missing fields", () => {
    const { id, ...noId } = validSession;
    expect(() => SessionSchema.parse(noId)).toThrow();
  });

  it("rejects session with invalid client_type", () => {
    expect(() =>
      SessionSchema.parse({ ...validSession, client_type: "slack" }),
    ).toThrow();
  });

  it("rejects session with invalid status", () => {
    expect(() =>
      SessionSchema.parse({ ...validSession, status: "running" }),
    ).toThrow();
  });
});

describe("ThreadSchema", () => {
  const validThread = {
    id: "thr_x1y2z3w4v5u6",
    session_id: "ses_a1b2c3d4e5f6",
    intent: "Fix authentication bug",
    intent_type: "build",
    status: "open",
    created_at: "2026-02-28T10:00:00Z",
    updated_at: "2026-02-28T10:00:00Z",
    turn_ids: [],
    metadata: {},
  };

  it("accepts valid thread", () => {
    const result = ThreadSchema.parse(validThread);
    expect(result.intent_type).toBe("build");
  });

  it("rejects thread with invalid intent_type", () => {
    expect(() =>
      ThreadSchema.parse({ ...validThread, intent_type: "unknown" }),
    ).toThrow();
  });
});

describe("TurnSchema", () => {
  const validTurn = {
    id: "trn_m1n2o3p4q5r6",
    thread_id: "thr_x1y2z3w4v5u6",
    message: "Fix the login endpoint",
    attachments: [],
    status: "submitted",
    created_at: "2026-02-28T10:01:00Z",
    completed_at: null,
    item_ids: [],
  };

  it("accepts valid turn", () => {
    const result = TurnSchema.parse(validTurn);
    expect(result.completed_at).toBeNull();
  });

  it("rejects turn with invalid status", () => {
    expect(() =>
      TurnSchema.parse({ ...validTurn, status: "pending" }),
    ).toThrow();
  });
});

describe("AttachmentSchema", () => {
  it("accepts valid attachment", () => {
    const result = AttachmentSchema.parse({
      id: "att_1",
      type: "text",
      content: "Some content",
      sanitized: true,
      contains_sensitive: false,
    });
    expect(result.type).toBe("text");
  });

  it("accepts attachment with optional fields", () => {
    const result = AttachmentSchema.parse({
      id: "att_2",
      type: "file_ref",
      filename: "patch.diff",
      mime_type: "text/plain",
      content: "diff content",
      size_bytes: 1024,
      sanitized: true,
      contains_sensitive: false,
    });
    expect(result.size_bytes).toBe(1024);
  });

  it("rejects attachment with invalid type", () => {
    expect(() =>
      AttachmentSchema.parse({
        id: "att_3",
        type: "binary",
        content: "",
        sanitized: true,
        contains_sensitive: false,
      }),
    ).toThrow();
  });
});

// --- Policy Types ---

describe("PolicyDecisionSchema", () => {
  it("accepts allow decision", () => {
    const result = PolicyDecisionSchema.parse({ action: "allow" });
    expect(result.action).toBe("allow");
  });

  it("accepts deny decision with required fields", () => {
    const result = PolicyDecisionSchema.parse({
      action: "deny",
      reason: "Not allowed",
      rule_id: "rule_1",
    });
    expect(result.action).toBe("deny");
  });

  it("accepts require_approval decision", () => {
    const result = PolicyDecisionSchema.parse({
      action: "require_approval",
      tier: "approve",
      description: "Needs human review",
      rule_id: "rule_2",
    });
    expect(result.action).toBe("require_approval");
  });

  it("rejects unknown action", () => {
    expect(() =>
      PolicyDecisionSchema.parse({ action: "maybe" }),
    ).toThrow();
  });
});

describe("PolicyConditionSchema", () => {
  it("accepts method_match condition", () => {
    const result = PolicyConditionSchema.parse({
      type: "method_match",
      methods: ["thread.create"],
    });
    expect(result.type).toBe("method_match");
  });

  it("accepts nested and/or/not conditions", () => {
    const result = PolicyConditionSchema.parse({
      type: "and",
      conditions: [
        { type: "method_match", methods: ["thread.create"] },
        {
          type: "not",
          condition: {
            type: "client_type_match",
            client_types: ["internal"],
          },
        },
      ],
    });
    expect(result.type).toBe("and");
  });
});

// --- Approval Types ---

describe("ApprovalRequestParamsSchema", () => {
  it("accepts valid approval request", () => {
    const result = ApprovalRequestParamsSchema.parse({
      thread_id: "thr_x1y2z3w4v5u6",
      description: "Deploy to production",
      risk_level: "high",
      tier: "escalate",
      timeout_seconds: 300,
      context: { environment: "prod" },
    });
    expect(result.tier).toBe("escalate");
  });

  it("rejects negative timeout", () => {
    expect(() =>
      ApprovalRequestParamsSchema.parse({
        thread_id: "thr_1",
        description: "test",
        risk_level: "low",
        tier: "approve",
        timeout_seconds: -1,
        context: {},
      }),
    ).toThrow();
  });
});

describe("PendingApprovalSchema", () => {
  it("accepts valid pending approval", () => {
    const result = PendingApprovalSchema.parse({
      approval_id: "apr_d1e2f3g4h5i6",
      thread_id: "thr_1",
      session_id: "ses_1",
      description: "Review code change",
      risk_level: "medium",
      tier: "approve",
      created_at: "2026-02-28T10:00:00Z",
      timeout_at: "2026-02-28T10:05:00Z",
      status: "pending",
    });
    expect(result.status).toBe("pending");
  });
});

// --- Audit Types ---

describe("AuditEventSchema", () => {
  const validEvent = {
    event_id: "evt_a1b2c3d4e5f6g7h8",
    timestamp: "2026-02-28T10:00:00.000Z",
    category: "session",
    action: "session.create",
    session_id: "ses_1",
    thread_id: null,
    turn_id: null,
    item_id: null,
    client_id: "adam-local",
    details: { client_type: "cli" },
    policy_rule_id: null,
    risk_level: null,
  };

  it("accepts valid audit event", () => {
    const result = AuditEventSchema.parse(validEvent);
    expect(result.category).toBe("session");
  });

  it("rejects event with invalid category", () => {
    expect(() =>
      AuditEventSchema.parse({ ...validEvent, category: "unknown" }),
    ).toThrow();
  });
});

describe("AuditFilterSchema", () => {
  it("accepts empty filter", () => {
    const result = AuditFilterSchema.parse({});
    expect(result).toEqual({});
  });

  it("accepts filter with all fields", () => {
    const result = AuditFilterSchema.parse({
      session_id: "ses_1",
      category: "thread",
      since: "2026-01-01",
      until: "2026-12-31",
      limit: 50,
      cursor: "abc",
    });
    expect(result.limit).toBe(50);
  });

  it("rejects limit exceeding 1000", () => {
    expect(() => AuditFilterSchema.parse({ limit: 1001 })).toThrow();
  });

  it("rejects limit of 0", () => {
    expect(() => AuditFilterSchema.parse({ limit: 0 })).toThrow();
  });
});

// --- Dispatch Types ---

describe("DispatchRequestSchema", () => {
  it("accepts valid dispatch request", () => {
    const result = DispatchRequestSchema.parse({
      dispatch_id: "dsp_r1s2t3u4v5w6",
      mode: "specify",
      slice: {
        id: "slice-1",
        description: "Fix auth bug",
        type: "bug-fixing",
        context_files: ["src/auth.ts"],
        working_directory: "/project",
        isc_criteria: { tests_pass: true, no_secrets: true },
      },
      target_backend: "claude-code",
    });
    expect(result.mode).toBe("specify");
  });

  it("rejects invalid mode", () => {
    expect(() =>
      DispatchRequestSchema.parse({
        dispatch_id: "dsp_1",
        mode: "auto",
        slice: {
          id: "s1",
          description: "d",
          type: "bug-fixing",
          context_files: [],
          working_directory: "/",
          isc_criteria: {},
        },
        target_backend: "claude",
      }),
    ).toThrow();
  });
});

// --- Health Types ---

describe("HealthStatusSchema", () => {
  it("accepts valid health status", () => {
    const result = HealthStatusSchema.parse({
      server: {
        status: "healthy",
        uptime_seconds: 3600,
        memory_usage_mb: 256,
        active_sessions: 2,
        active_threads: 5,
        pending_approvals: 1,
      },
      backends: {
        "claude-code": {
          status: "healthy",
          last_check: "2026-02-28T10:00:00Z",
          response_time_ms: 150,
          uptime_ratio: 0.99,
          version: "1.0.0",
        },
      },
      audit: {
        status: "healthy",
        jsonl_size_mb: 10.5,
        sqlite_size_mb: 2.3,
        event_count: 15000,
      },
    });
    expect(result.server.status).toBe("healthy");
  });
});

// --- Error Data Schema ---

describe("ObserverErrorDataSchema", () => {
  it("accepts policy_denied error data", () => {
    const result = ObserverErrorDataSchema.parse({
      type: "policy_denied",
      rule_id: "rule_1",
      reason: "Client not authorized",
    });
    expect(result.type).toBe("policy_denied");
  });

  it("accepts rate_limited error data", () => {
    const result = ObserverErrorDataSchema.parse({
      type: "rate_limited",
      retry_after_seconds: 30,
    });
    expect(result.type).toBe("rate_limited");
  });

  it("rejects unknown error type", () => {
    expect(() =>
      ObserverErrorDataSchema.parse({
        type: "unknown_error",
        message: "bad",
      }),
    ).toThrow();
  });
});

// --- JSON-RPC Param Schemas ---

describe("SessionCreateParamsSchema", () => {
  it("accepts valid params", () => {
    const result = SessionCreateParamsSchema.parse({
      client_type: "cli",
      client_id: "adam-local",
    });
    expect(result.client_type).toBe("cli");
  });

  it("rejects missing client_id", () => {
    expect(() =>
      SessionCreateParamsSchema.parse({ client_type: "cli" }),
    ).toThrow();
  });
});

describe("ThreadCreateParamsSchema", () => {
  it("accepts params with optional fields", () => {
    const result = ThreadCreateParamsSchema.parse({
      session_id: "ses_1",
      intent: "Fix bug",
      intent_type: "build",
      metadata: { priority: "high" },
    });
    expect(result.intent_type).toBe("build");
  });
});

describe("TurnSubmitParamsSchema", () => {
  it("accepts params without attachments", () => {
    const result = TurnSubmitParamsSchema.parse({
      thread_id: "thr_1",
      message: "Please fix the login bug",
    });
    expect(result.message).toBe("Please fix the login bug");
  });
});

describe("ApprovalRespondParamsSchema", () => {
  it("accepts valid approval response", () => {
    const result = ApprovalRespondParamsSchema.parse({
      approval_id: "apr_1",
      decision: { decision: "approved", reason: "Looks good" },
    });
    expect(result.decision.decision).toBe("approved");
  });
});
