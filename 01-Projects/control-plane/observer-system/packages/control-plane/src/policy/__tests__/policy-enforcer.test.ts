// S2: Policy Enforcer — Full test suite (TDD RED phase)
// Tests all 5 ISC criteria:
// 1. All 7 condition types evaluate correctly
// 2. First-match-wins with priority ordering
// 3. Default deny when no rules match
// 4. Startup validation rejects invalid config
// 5. All decisions include rule_id for audit logging

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import type {
  PolicyRequest,
  PolicyDecision,
  Session,
  Thread,
} from "@observer/shared";
import { PolicyEnforcerImpl } from "../policy-enforcer.js";

// --- Test Helpers ---

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "ses_test000001",
    client_type: "cli",
    client_id: "test-client",
    created_at: new Date().toISOString(),
    last_active_at: new Date().toISOString(),
    status: "active",
    thread_ids: [],
    ...overrides,
  };
}

function makeThread(overrides: Partial<Thread> = {}): Thread {
  return {
    id: "thr_test000001",
    session_id: "ses_test000001",
    intent: "Test intent",
    intent_type: "query",
    status: "open",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    turn_ids: [],
    metadata: {},
    ...overrides,
  };
}

function makeRequest(overrides: Partial<PolicyRequest> = {}): PolicyRequest {
  return {
    method: "thread.create",
    params: {},
    session: makeSession(),
    thread: null,
    ...overrides,
  };
}

function writeTempConfig(content: string): string {
  const dir = join(tmpdir(), `policy-test-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "policy.yaml");
  writeFileSync(path, content, "utf-8");
  return path;
}

// --- Condition Type Tests (ISC-1) ---

describe("PolicyEnforcer: Condition Types", () => {
  let enforcer: PolicyEnforcerImpl;

  describe("method_match", () => {
    beforeEach(() => {
      const path = writeTempConfig(`
policies:
  default_action: "deny"
  rules:
    - id: "allow-health"
      description: "Allow health checks"
      priority: 1
      action: "allow"
      condition:
        type: "method_match"
        methods:
          - "health.status"
          - "session.create"
`);
      enforcer = new PolicyEnforcerImpl();
      enforcer.loadRules(path);
    });

    it("matches when method is in the list", () => {
      const req = makeRequest({ method: "health.status" });
      const decision = enforcer.evaluate(req);
      expect(decision.action).toBe("allow");
    });

    it("matches second method in list", () => {
      const req = makeRequest({ method: "session.create" });
      const decision = enforcer.evaluate(req);
      expect(decision.action).toBe("allow");
    });

    it("does not match when method is not in the list", () => {
      const req = makeRequest({ method: "thread.create" });
      const decision = enforcer.evaluate(req);
      expect(decision.action).toBe("deny");
    });
  });

  describe("client_type_match", () => {
    beforeEach(() => {
      const path = writeTempConfig(`
policies:
  default_action: "deny"
  rules:
    - id: "allow-cli"
      description: "Allow CLI clients"
      priority: 1
      action: "allow"
      condition:
        type: "client_type_match"
        client_types:
          - "cli"
          - "gui"
`);
      enforcer = new PolicyEnforcerImpl();
      enforcer.loadRules(path);
    });

    it("matches when client_type is in the list", () => {
      const req = makeRequest({
        session: makeSession({ client_type: "cli" }),
      });
      const decision = enforcer.evaluate(req);
      expect(decision.action).toBe("allow");
    });

    it("matches second client_type in list", () => {
      const req = makeRequest({
        session: makeSession({ client_type: "gui" }),
      });
      const decision = enforcer.evaluate(req);
      expect(decision.action).toBe("allow");
    });

    it("does not match when client_type is not in the list", () => {
      const req = makeRequest({
        session: makeSession({ client_type: "telegram" }),
      });
      const decision = enforcer.evaluate(req);
      expect(decision.action).toBe("deny");
    });
  });

  describe("intent_contains (NNF-8: structural matching)", () => {
    beforeEach(() => {
      const path = writeTempConfig(`
policies:
  default_action: "deny"
  rules:
    - id: "approve-build"
      description: "Build intents require approval"
      priority: 1
      action: "require_approval"
      tier: "approve"
      approval_description: "Build intent requires human approval"
      condition:
        type: "intent_contains"
        keywords:
          - "build"
          - "system"
`);
      enforcer = new PolicyEnforcerImpl();
      enforcer.loadRules(path);
    });

    it("matches when intent_type matches a keyword (structural match)", () => {
      const req = makeRequest({
        thread: makeThread({ intent_type: "build" }),
      });
      const decision = enforcer.evaluate(req);
      expect(decision.action).toBe("require_approval");
    });

    it("matches second keyword", () => {
      const req = makeRequest({
        thread: makeThread({ intent_type: "system" }),
      });
      const decision = enforcer.evaluate(req);
      expect(decision.action).toBe("require_approval");
    });

    it("does NOT match on intent_type not in keywords", () => {
      const req = makeRequest({
        thread: makeThread({ intent_type: "query" }),
      });
      const decision = enforcer.evaluate(req);
      expect(decision.action).toBe("deny");
    });

    it("does NOT match when thread is null", () => {
      const req = makeRequest({ thread: null });
      const decision = enforcer.evaluate(req);
      expect(decision.action).toBe("deny");
    });

    it("does NOT keyword-search in intent message string (NNF-8)", () => {
      // Even though intent contains "build" as a substring, intent_type is "query"
      // NNF-8 mandates structural matching on enum, not keyword search
      const req = makeRequest({
        thread: makeThread({
          intent: "Please build me something",
          intent_type: "query",
        }),
      });
      const decision = enforcer.evaluate(req);
      expect(decision.action).toBe("deny");
    });
  });

  describe("rate_check", () => {
    beforeEach(() => {
      const path = writeTempConfig(`
policies:
  default_action: "deny"
  rules:
    - id: "rate-limit-turns"
      description: "Rate limit turn submissions"
      priority: 1
      action: "rate_limit"
      retry_after_seconds: 30
      condition:
        type: "rate_check"
        max_per_minute: 5
    - id: "allow-all"
      description: "Allow everything else"
      priority: 100
      action: "allow"
      condition:
        type: "method_match"
        methods:
          - "turn.submit"
          - "thread.create"
          - "session.create"
          - "health.status"
`);
      enforcer = new PolicyEnforcerImpl();
      enforcer.loadRules(path);
    });

    it("allows requests below rate limit", () => {
      const req = makeRequest({ method: "turn.submit" });
      // First request should be under limit
      const decision = enforcer.evaluate(req);
      // rate_check returns true when limit IS exceeded
      // Under limit means rate_check condition is false, so rule doesn't match
      // Falls through to allow-all rule
      expect(decision.action).toBe("allow");
    });

    it("triggers rate_limit when max_per_minute exceeded", () => {
      const req = makeRequest({ method: "turn.submit" });
      // Fire 5 requests (under limit)
      for (let i = 0; i < 5; i++) {
        enforcer.evaluate(req);
      }
      // 6th request should trigger rate limit
      const decision = enforcer.evaluate(req);
      expect(decision.action).toBe("rate_limit");
      if (decision.action === "rate_limit") {
        expect(decision.retry_after_seconds).toBe(30);
        expect(decision.rule_id).toBe("rate-limit-turns");
      }
    });

    it("rate limit is per session_id+method", () => {
      const req1 = makeRequest({ method: "turn.submit" });
      const req2 = makeRequest({
        method: "turn.submit",
        session: makeSession({ id: "ses_other00001" }),
      });

      // Exhaust rate limit for session 1
      for (let i = 0; i < 6; i++) {
        enforcer.evaluate(req1);
      }

      // Session 2 should still be under limit
      const decision = enforcer.evaluate(req2);
      expect(decision.action).toBe("allow");
    });

    it("sliding window resets after time passes", () => {
      vi.useFakeTimers();
      try {
        const req = makeRequest({ method: "turn.submit" });

        // Exhaust rate limit
        for (let i = 0; i < 6; i++) {
          enforcer.evaluate(req);
        }

        // Advance time by 61 seconds (past the 1-minute window)
        vi.advanceTimersByTime(61_000);

        // Should be allowed again
        const decision = enforcer.evaluate(req);
        expect(decision.action).toBe("allow");
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("and (composite)", () => {
    beforeEach(() => {
      const path = writeTempConfig(`
policies:
  default_action: "deny"
  rules:
    - id: "cli-health"
      description: "Allow CLI health checks"
      priority: 1
      action: "allow"
      condition:
        type: "and"
        conditions:
          - type: "method_match"
            methods: ["health.status"]
          - type: "client_type_match"
            client_types: ["cli"]
`);
      enforcer = new PolicyEnforcerImpl();
      enforcer.loadRules(path);
    });

    it("matches when ALL sub-conditions are true", () => {
      const req = makeRequest({
        method: "health.status",
        session: makeSession({ client_type: "cli" }),
      });
      const decision = enforcer.evaluate(req);
      expect(decision.action).toBe("allow");
    });

    it("does not match when any sub-condition is false", () => {
      const req = makeRequest({
        method: "health.status",
        session: makeSession({ client_type: "telegram" }),
      });
      const decision = enforcer.evaluate(req);
      expect(decision.action).toBe("deny");
    });

    it("does not match when first sub-condition is false", () => {
      const req = makeRequest({
        method: "thread.create",
        session: makeSession({ client_type: "cli" }),
      });
      const decision = enforcer.evaluate(req);
      expect(decision.action).toBe("deny");
    });
  });

  describe("or (composite)", () => {
    beforeEach(() => {
      const path = writeTempConfig(`
policies:
  default_action: "deny"
  rules:
    - id: "health-or-cli"
      description: "Allow health or CLI"
      priority: 1
      action: "allow"
      condition:
        type: "or"
        conditions:
          - type: "method_match"
            methods: ["health.status"]
          - type: "client_type_match"
            client_types: ["cli"]
`);
      enforcer = new PolicyEnforcerImpl();
      enforcer.loadRules(path);
    });

    it("matches when first sub-condition is true", () => {
      const req = makeRequest({
        method: "health.status",
        session: makeSession({ client_type: "telegram" }),
      });
      const decision = enforcer.evaluate(req);
      expect(decision.action).toBe("allow");
    });

    it("matches when second sub-condition is true", () => {
      const req = makeRequest({
        method: "thread.create",
        session: makeSession({ client_type: "cli" }),
      });
      const decision = enforcer.evaluate(req);
      expect(decision.action).toBe("allow");
    });

    it("does not match when no sub-conditions are true", () => {
      const req = makeRequest({
        method: "thread.create",
        session: makeSession({ client_type: "telegram" }),
      });
      const decision = enforcer.evaluate(req);
      expect(decision.action).toBe("deny");
    });

    it("short-circuits: does not evaluate further after first match", () => {
      // This test verifies or-semantics. If first is true, result is true
      // regardless of second condition
      const req = makeRequest({
        method: "health.status",
        session: makeSession({ client_type: "telegram" }),
      });
      const decision = enforcer.evaluate(req);
      expect(decision.action).toBe("allow");
    });
  });

  describe("not (negation)", () => {
    beforeEach(() => {
      const path = writeTempConfig(`
policies:
  default_action: "deny"
  rules:
    - id: "not-telegram"
      description: "Allow non-telegram clients"
      priority: 1
      action: "allow"
      condition:
        type: "not"
        condition:
          type: "client_type_match"
          client_types: ["telegram"]
`);
      enforcer = new PolicyEnforcerImpl();
      enforcer.loadRules(path);
    });

    it("matches when inner condition is false (negation)", () => {
      const req = makeRequest({
        session: makeSession({ client_type: "cli" }),
      });
      const decision = enforcer.evaluate(req);
      expect(decision.action).toBe("allow");
    });

    it("does not match when inner condition is true", () => {
      const req = makeRequest({
        session: makeSession({ client_type: "telegram" }),
      });
      const decision = enforcer.evaluate(req);
      expect(decision.action).toBe("deny");
    });
  });
});

// --- Priority Ordering & First-Match-Wins (ISC-2) ---

describe("PolicyEnforcer: Priority Ordering", () => {
  it("evaluates rules in priority order (lower number first)", () => {
    const path = writeTempConfig(`
policies:
  default_action: "deny"
  rules:
    - id: "high-priority-deny"
      description: "Deny health (high priority)"
      priority: 1
      action: "deny"
      deny_reason: "Explicitly denied by high-priority rule"
      condition:
        type: "method_match"
        methods: ["health.status"]
    - id: "low-priority-allow"
      description: "Allow health (low priority)"
      priority: 10
      action: "allow"
      condition:
        type: "method_match"
        methods: ["health.status"]
`);
    const enforcer = new PolicyEnforcerImpl();
    enforcer.loadRules(path);

    const req = makeRequest({ method: "health.status" });
    const decision = enforcer.evaluate(req);
    expect(decision.action).toBe("deny");
    if (decision.action === "deny") {
      expect(decision.rule_id).toBe("high-priority-deny");
    }
  });

  it("first matching rule wins — subsequent matches ignored", () => {
    const path = writeTempConfig(`
policies:
  default_action: "deny"
  rules:
    - id: "rule-allow"
      description: "Allow CLI"
      priority: 5
      action: "allow"
      condition:
        type: "client_type_match"
        client_types: ["cli"]
    - id: "rule-approval"
      description: "Require approval for CLI"
      priority: 10
      action: "require_approval"
      tier: "approve"
      approval_description: "Needs approval"
      condition:
        type: "client_type_match"
        client_types: ["cli"]
`);
    const enforcer = new PolicyEnforcerImpl();
    enforcer.loadRules(path);

    const req = makeRequest({
      session: makeSession({ client_type: "cli" }),
    });
    const decision = enforcer.evaluate(req);
    expect(decision.action).toBe("allow");
  });

  it("rules defined out of order in YAML are still sorted by priority", () => {
    const path = writeTempConfig(`
policies:
  default_action: "deny"
  rules:
    - id: "low-priority"
      description: "Low priority allow"
      priority: 100
      action: "allow"
      condition:
        type: "method_match"
        methods: ["health.status"]
    - id: "high-priority"
      description: "High priority deny"
      priority: 1
      action: "deny"
      deny_reason: "Blocked by priority"
      condition:
        type: "method_match"
        methods: ["health.status"]
`);
    const enforcer = new PolicyEnforcerImpl();
    enforcer.loadRules(path);

    const req = makeRequest({ method: "health.status" });
    const decision = enforcer.evaluate(req);
    expect(decision.action).toBe("deny");
    if (decision.action === "deny") {
      expect(decision.rule_id).toBe("high-priority");
    }
  });

  it("getRules returns rules sorted by priority", () => {
    const path = writeTempConfig(`
policies:
  default_action: "deny"
  rules:
    - id: "c"
      description: "Third"
      priority: 30
      action: "allow"
      condition:
        type: "method_match"
        methods: ["c"]
    - id: "a"
      description: "First"
      priority: 10
      action: "allow"
      condition:
        type: "method_match"
        methods: ["a"]
    - id: "b"
      description: "Second"
      priority: 20
      action: "allow"
      condition:
        type: "method_match"
        methods: ["b"]
`);
    const enforcer = new PolicyEnforcerImpl();
    enforcer.loadRules(path);

    const rules = enforcer.getRules();
    expect(rules).toHaveLength(3);
    expect(rules[0].id).toBe("a");
    expect(rules[1].id).toBe("b");
    expect(rules[2].id).toBe("c");
    expect(rules[0].priority).toBe(10);
    expect(rules[1].priority).toBe(20);
    expect(rules[2].priority).toBe(30);
  });
});

// --- Default Deny (ISC-3) ---

describe("PolicyEnforcer: Default Deny", () => {
  it("returns deny with default rule_id when no rules match", () => {
    const path = writeTempConfig(`
policies:
  default_action: "deny"
  rules:
    - id: "allow-health"
      description: "Allow health checks only"
      priority: 1
      action: "allow"
      condition:
        type: "method_match"
        methods: ["health.status"]
`);
    const enforcer = new PolicyEnforcerImpl();
    enforcer.loadRules(path);

    const req = makeRequest({ method: "thread.create" });
    const decision = enforcer.evaluate(req);
    expect(decision.action).toBe("deny");
    if (decision.action === "deny") {
      expect(decision.reason).toBe("No matching policy rule");
      expect(decision.rule_id).toBe("default");
    }
  });

  it("returns deny when rules list is empty", () => {
    const path = writeTempConfig(`
policies:
  default_action: "deny"
  rules: []
`);
    const enforcer = new PolicyEnforcerImpl();
    enforcer.loadRules(path);

    const req = makeRequest();
    const decision = enforcer.evaluate(req);
    expect(decision.action).toBe("deny");
    if (decision.action === "deny") {
      expect(decision.reason).toBe("No matching policy rule");
      expect(decision.rule_id).toBe("default");
    }
  });

  it("returns deny before loadRules is called (empty rules)", () => {
    const enforcer = new PolicyEnforcerImpl();

    const req = makeRequest();
    const decision = enforcer.evaluate(req);
    expect(decision.action).toBe("deny");
    if (decision.action === "deny") {
      expect(decision.reason).toBe("No matching policy rule");
      expect(decision.rule_id).toBe("default");
    }
  });
});

// --- Config Validation (ISC-4) ---

describe("PolicyEnforcer: Config Validation", () => {
  it("rejects config with default_action != deny", () => {
    const path = writeTempConfig(`
policies:
  default_action: "allow"
  rules: []
`);
    const enforcer = new PolicyEnforcerImpl();
    expect(() => enforcer.loadRules(path)).toThrow(/default_action/i);
  });

  it("rejects config with duplicate rule IDs", () => {
    const path = writeTempConfig(`
policies:
  default_action: "deny"
  rules:
    - id: "same-id"
      description: "First rule"
      priority: 1
      action: "allow"
      condition:
        type: "method_match"
        methods: ["a"]
    - id: "same-id"
      description: "Second rule"
      priority: 2
      action: "allow"
      condition:
        type: "method_match"
        methods: ["b"]
`);
    const enforcer = new PolicyEnforcerImpl();
    expect(() => enforcer.loadRules(path)).toThrow(/duplicate.*id/i);
  });

  it("rejects config with duplicate priorities", () => {
    const path = writeTempConfig(`
policies:
  default_action: "deny"
  rules:
    - id: "rule-a"
      description: "First rule"
      priority: 1
      action: "allow"
      condition:
        type: "method_match"
        methods: ["a"]
    - id: "rule-b"
      description: "Second rule"
      priority: 1
      action: "allow"
      condition:
        type: "method_match"
        methods: ["b"]
`);
    const enforcer = new PolicyEnforcerImpl();
    expect(() => enforcer.loadRules(path)).toThrow(/duplicate.*priorit/i);
  });

  it("rejects config with unknown condition types", () => {
    const path = writeTempConfig(`
policies:
  default_action: "deny"
  rules:
    - id: "bad-condition"
      description: "Uses unknown condition"
      priority: 1
      action: "allow"
      condition:
        type: "magic_match"
        values: ["abc"]
`);
    const enforcer = new PolicyEnforcerImpl();
    expect(() => enforcer.loadRules(path)).toThrow();
  });

  it("rejects invalid YAML structure (missing policies key)", () => {
    const path = writeTempConfig(`
rules:
  - id: "no-policies"
    description: "Missing policies key"
    priority: 1
    action: "allow"
    condition:
      type: "method_match"
      methods: ["a"]
`);
    const enforcer = new PolicyEnforcerImpl();
    expect(() => enforcer.loadRules(path)).toThrow();
  });

  it("rejects invalid YAML structure (missing rules key)", () => {
    const path = writeTempConfig(`
policies:
  default_action: "deny"
`);
    const enforcer = new PolicyEnforcerImpl();
    expect(() => enforcer.loadRules(path)).toThrow();
  });

  it("rejects file that does not exist", () => {
    const enforcer = new PolicyEnforcerImpl();
    expect(() => enforcer.loadRules("/nonexistent/path/policy.yaml")).toThrow();
  });

  it("rejects invalid YAML syntax", () => {
    const path = writeTempConfig(`
policies:
  default_action: "deny"
  rules:
    - id: "bad"
      description: "Bad YAML
      priority: not-a-number
`);
    const enforcer = new PolicyEnforcerImpl();
    expect(() => enforcer.loadRules(path)).toThrow();
  });

  it("accepts valid minimal config", () => {
    const path = writeTempConfig(`
policies:
  default_action: "deny"
  rules: []
`);
    const enforcer = new PolicyEnforcerImpl();
    expect(() => enforcer.loadRules(path)).not.toThrow();
  });
});

// --- Decision Audit Fields (ISC-5) ---

describe("PolicyEnforcer: Audit Fields", () => {
  let enforcer: PolicyEnforcerImpl;

  beforeEach(() => {
    const path = writeTempConfig(`
policies:
  default_action: "deny"
  rules:
    - id: "rule-allow-health"
      description: "Allow health checks"
      priority: 1
      action: "allow"
      condition:
        type: "method_match"
        methods: ["health.status"]
    - id: "rule-deny-telegram"
      description: "Deny telegram clients"
      priority: 2
      action: "deny"
      deny_reason: "Telegram not allowed"
      condition:
        type: "client_type_match"
        client_types: ["telegram"]
    - id: "rule-require-approval"
      description: "Build needs approval"
      priority: 3
      action: "require_approval"
      tier: "approve"
      approval_description: "Build work requires human approval"
      condition:
        type: "intent_contains"
        keywords: ["build"]
    - id: "rule-rate-limit"
      description: "Rate limit turns"
      priority: 4
      action: "rate_limit"
      retry_after_seconds: 60
      condition:
        type: "rate_check"
        max_per_minute: 2
`);
    enforcer = new PolicyEnforcerImpl();
    enforcer.loadRules(path);
  });

  it("allow decision does not include rule_id (no audit trail needed for allows)", () => {
    const req = makeRequest({ method: "health.status" });
    const decision = enforcer.evaluate(req);
    expect(decision.action).toBe("allow");
    // Allow decisions are simple: { action: "allow" }
    // No rule_id needed per PolicyDecision type
  });

  it("deny decision includes rule_id and reason", () => {
    const req = makeRequest({
      session: makeSession({ client_type: "telegram" }),
    });
    const decision = enforcer.evaluate(req);
    expect(decision.action).toBe("deny");
    if (decision.action === "deny") {
      expect(decision.rule_id).toBe("rule-deny-telegram");
      expect(decision.reason).toBe("Telegram not allowed");
    }
  });

  it("require_approval decision includes rule_id, tier, and description", () => {
    const req = makeRequest({
      thread: makeThread({ intent_type: "build" }),
    });
    const decision = enforcer.evaluate(req);
    expect(decision.action).toBe("require_approval");
    if (decision.action === "require_approval") {
      expect(decision.rule_id).toBe("rule-require-approval");
      expect(decision.tier).toBe("approve");
      expect(decision.description).toBe(
        "Build work requires human approval",
      );
    }
  });

  it("rate_limit decision includes rule_id and retry_after_seconds", () => {
    const req = makeRequest({ method: "turn.submit" });
    // Exhaust rate limit (max 2 per minute)
    enforcer.evaluate(req);
    enforcer.evaluate(req);
    // Third triggers rate limit
    const decision = enforcer.evaluate(req);
    expect(decision.action).toBe("rate_limit");
    if (decision.action === "rate_limit") {
      expect(decision.rule_id).toBe("rule-rate-limit");
      expect(decision.retry_after_seconds).toBe(60);
    }
  });

  it("default deny includes rule_id 'default'", () => {
    const req = makeRequest({
      method: "admin.revoke_token",
      session: makeSession({ client_type: "cli" }),
    });
    const decision = enforcer.evaluate(req);
    expect(decision.action).toBe("deny");
    if (decision.action === "deny") {
      expect(decision.rule_id).toBe("default");
    }
  });
});

// --- Recursive/Nested Conditions ---

describe("PolicyEnforcer: Recursive Conditions", () => {
  it("evaluates deeply nested and/or/not combinations", () => {
    const path = writeTempConfig(`
policies:
  default_action: "deny"
  rules:
    - id: "complex-rule"
      description: "Complex nested conditions"
      priority: 1
      action: "allow"
      condition:
        type: "and"
        conditions:
          - type: "or"
            conditions:
              - type: "method_match"
                methods: ["thread.create"]
              - type: "method_match"
                methods: ["turn.submit"]
          - type: "not"
            condition:
              type: "client_type_match"
              client_types: ["telegram"]
`);
    const enforcer = new PolicyEnforcerImpl();
    enforcer.loadRules(path);

    // thread.create + cli -> (or: true) AND (not telegram: true) -> allow
    expect(
      enforcer.evaluate(
        makeRequest({
          method: "thread.create",
          session: makeSession({ client_type: "cli" }),
        }),
      ).action,
    ).toBe("allow");

    // turn.submit + gui -> (or: true) AND (not telegram: true) -> allow
    expect(
      enforcer.evaluate(
        makeRequest({
          method: "turn.submit",
          session: makeSession({ client_type: "gui" }),
        }),
      ).action,
    ).toBe("allow");

    // thread.create + telegram -> (or: true) AND (not telegram: false) -> deny
    expect(
      enforcer.evaluate(
        makeRequest({
          method: "thread.create",
          session: makeSession({ client_type: "telegram" }),
        }),
      ).action,
    ).toBe("deny");

    // health.status + cli -> (or: false) AND (...) -> deny
    expect(
      enforcer.evaluate(
        makeRequest({
          method: "health.status",
          session: makeSession({ client_type: "cli" }),
        }),
      ).action,
    ).toBe("deny");
  });

  it("handles not(not(condition)) — double negation", () => {
    const path = writeTempConfig(`
policies:
  default_action: "deny"
  rules:
    - id: "double-not"
      description: "Double negation"
      priority: 1
      action: "allow"
      condition:
        type: "not"
        condition:
          type: "not"
          condition:
            type: "client_type_match"
            client_types: ["cli"]
`);
    const enforcer = new PolicyEnforcerImpl();
    enforcer.loadRules(path);

    // not(not(cli)) = cli -> allow
    expect(
      enforcer.evaluate(
        makeRequest({
          session: makeSession({ client_type: "cli" }),
        }),
      ).action,
    ).toBe("allow");

    // not(not(telegram matches [cli])) = not(not(false)) = not(true) = false -> deny
    expect(
      enforcer.evaluate(
        makeRequest({
          session: makeSession({ client_type: "telegram" }),
        }),
      ).action,
    ).toBe("deny");
  });

  it("handles or with empty conditions (should not match)", () => {
    const path = writeTempConfig(`
policies:
  default_action: "deny"
  rules:
    - id: "empty-or"
      description: "Or with no conditions"
      priority: 1
      action: "allow"
      condition:
        type: "or"
        conditions: []
`);
    const enforcer = new PolicyEnforcerImpl();
    enforcer.loadRules(path);

    const decision = enforcer.evaluate(makeRequest());
    // Empty OR => no conditions true => false
    expect(decision.action).toBe("deny");
  });

  it("handles and with empty conditions (should match — vacuous truth)", () => {
    const path = writeTempConfig(`
policies:
  default_action: "deny"
  rules:
    - id: "empty-and"
      description: "And with no conditions"
      priority: 1
      action: "allow"
      condition:
        type: "and"
        conditions: []
`);
    const enforcer = new PolicyEnforcerImpl();
    enforcer.loadRules(path);

    const decision = enforcer.evaluate(makeRequest());
    // Empty AND => vacuous truth => true
    expect(decision.action).toBe("allow");
  });
});

// --- PolicyEnforcer Interface Contract ---

describe("PolicyEnforcer: Interface Contract", () => {
  it("implements PolicyEnforcer interface", () => {
    const enforcer = new PolicyEnforcerImpl();
    expect(typeof enforcer.evaluate).toBe("function");
    expect(typeof enforcer.loadRules).toBe("function");
    expect(typeof enforcer.getRules).toBe("function");
  });

  it("getRules returns empty array before loadRules", () => {
    const enforcer = new PolicyEnforcerImpl();
    expect(enforcer.getRules()).toEqual([]);
  });

  it("getRules returns a copy (not internal reference)", () => {
    const path = writeTempConfig(`
policies:
  default_action: "deny"
  rules:
    - id: "rule-1"
      description: "Test rule"
      priority: 1
      action: "allow"
      condition:
        type: "method_match"
        methods: ["health.status"]
`);
    const enforcer = new PolicyEnforcerImpl();
    enforcer.loadRules(path);

    const rules1 = enforcer.getRules();
    const rules2 = enforcer.getRules();
    expect(rules1).not.toBe(rules2); // Different array instances
    expect(rules1).toEqual(rules2); // Same content
  });

  it("evaluate is synchronous (returns immediately)", () => {
    const enforcer = new PolicyEnforcerImpl();
    const result = enforcer.evaluate(makeRequest());
    // Should not be a promise
    expect(result).not.toBeInstanceOf(Promise);
    expect(result.action).toBeDefined();
  });
});
