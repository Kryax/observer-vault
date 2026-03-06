/**
 * Observer-Native Smoke Test
 *
 * Tests runtime behaviour across three critical components:
 * 1. S1 Hook Adapter — event translation and NDJSON emission
 * 2. S7 Sovereignty — assertGateResolved blocks BLOCKED gates
 * 3. S6 Dispatch — DEFAULT RULE rejects sequential parallelisable tasks
 *
 * Run: bun smoke-test.ts
 */

import { ClaudeCodeAdapter } from "./src/s1/adapter.ts";
import { assertGateResolved } from "./src/s7/sovereignty.ts";
import { dispatch } from "./src/s6/dispatch.ts";
import { readFileSync, existsSync, unlinkSync } from "node:fs";

const STREAM_PATH = "/tmp/observer-smoke-test-events.ndjson";
let passed = 0;
let failed = 0;

function pass(name: string) {
  console.log(`  ✅  ${name}`);
  passed++;
}

function fail(name: string, reason: string) {
  console.log(`  ❌  ${name}: ${reason}`);
  failed++;
}

// Clean up any prior test stream
if (existsSync(STREAM_PATH)) unlinkSync(STREAM_PATH);

console.log("\n━━━ Observer-Native Smoke Test ━━━\n");

// ─────────────────────────────────────────────
// S1 — Hook Adapter
// ─────────────────────────────────────────────
console.log("S1 — Hook Adapter\n");

const adapter = new ClaudeCodeAdapter({
  workspace: "/mnt/zfs-host/backup/projects/observer-vault/01-Projects/observer-native",
  eventStreamPath: STREAM_PATH,
});

// Test 1: SessionStart translation
try {
  const fakeSessionStart = {
    type: "SessionStart",
    session_id: "test-session-001",
    cwd: "/mnt/zfs-host/backup/projects/observer-vault",
    timestamp: "2026-03-06T10:00:00.000Z",
    git: { branch: "main", status: "clean" },
  };
  const translated = adapter.translateEvent(fakeSessionStart);
  if (
    translated.type === "ObserverSessionStart" &&
    "sessionId" in translated &&
    translated.sessionId === "test-session-001"
  ) {
    pass("SessionStart translates to ObserverSessionStart");
  } else {
    fail("SessionStart translation", `unexpected shape: ${JSON.stringify(translated)}`);
  }
} catch (e) {
  fail("SessionStart translation", String(e));
}

// Test 2: PostToolUse translation
try {
  const fakePostToolUse = {
    type: "PostToolUse",
    session_id: "test-session-001",
    tool_name: "Write",
    result: { success: true },
    duration_ms: 142,
    timestamp: "2026-03-06T10:00:01.000Z",
  };
  const translated = adapter.translateEvent(fakePostToolUse);
  if (
    translated.type === "ObserverPostToolUse" &&
    "toolName" in translated &&
    translated.toolName === "Write" &&
    "durationMs" in translated &&
    translated.durationMs === 142
  ) {
    pass("PostToolUse translates to ObserverPostToolUse with duration");
  } else {
    fail("PostToolUse translation", `unexpected shape: ${JSON.stringify(translated)}`);
  }
} catch (e) {
  fail("PostToolUse translation", String(e));
}

// Test 3: handleHookEvent emits to NDJSON stream
try {
  const fakeStop = {
    type: "Stop",
    session_id: "test-session-001",
    timestamp: "2026-03-06T10:05:00.000Z",
    summary: "Smoke test complete",
    exit_reason: "completed",
  };
  adapter.handleHookEvent(fakeStop);

  if (existsSync(STREAM_PATH)) {
    const content = readFileSync(STREAM_PATH, "utf-8").trim();
    const parsed = JSON.parse(content);
    if (parsed.type === "ObserverSessionStop") {
      pass("handleHookEvent emits ObserverSessionStop to NDJSON stream");
    } else {
      fail("NDJSON emission", `wrong event type in stream: ${parsed.type}`);
    }
  } else {
    fail("NDJSON emission", "stream file not created");
  }
} catch (e) {
  fail("NDJSON emission", String(e));
}

// Test 4: Fail-silent — bad event does not throw
try {
  adapter.handleHookEvent({ type: "UnknownEvent", garbage: true });
  pass("Fail-silent — bad event does not propagate");
} catch (e) {
  fail("Fail-silent", `exception escaped: ${String(e)}`);
}

// ─────────────────────────────────────────────
// S7 — Sovereignty Gate
// ─────────────────────────────────────────────
console.log("\nS7 — Sovereignty Gate\n");

// Test 5: BLOCKED gate throws
try {
  const blockedGate = {
    id: "gate-001",
    status: "BLOCKED" as const,
    payload: {
      type: "TASK_FAILURE" as const,
      source: "s3-agent",
      failureEvidence: "ISC failing",
      retryCount: 3,
      structuralDiagnosis: "missing_info" as const,
      impact: "S3 build blocked",
    },
    blockedAt: new Date().toISOString(),
  };
  assertGateResolved(blockedGate);
  fail("BLOCKED gate throws", "should have thrown but did not");
} catch (e) {
  if (String(e).includes("BLOCKED")) {
    pass("BLOCKED gate throws sovereignty violation");
  } else {
    fail("BLOCKED gate throws", `wrong error: ${String(e)}`);
  }
}

// Test 6: RESOLVED gate passes
try {
  const resolvedGate = {
    id: "gate-002",
    status: "RESOLVED" as const,
    payload: {
      type: "TASK_FAILURE" as const,
      source: "s3-agent",
      failureEvidence: "ISC failing",
      retryCount: 1,
      structuralDiagnosis: "missing_info" as const,
      impact: "S3 build blocked",
    },
    blockedAt: new Date().toISOString(),
    resolvedAt: new Date().toISOString(),
    resolution: "human_provided_info",
    humanResponse: "Use the existing skill files as reference",
  };
  assertGateResolved(resolvedGate);
  pass("RESOLVED gate passes without throwing");
} catch (e) {
  fail("RESOLVED gate passes", `unexpected throw: ${String(e)}`);
}

// ─────────────────────────────────────────────
// S6 — Sub-Agent Dispatch DEFAULT RULE
// ─────────────────────────────────────────────
console.log("\nS6 — Sub-Agent Dispatch\n");

const makeTasks = (ids: string[], deps: Record<string, string[]> = {}) =>
  ids.map((id) => ({
    taskId: id,
    sliceId: "test-slice",
    description: `Task ${id}`,
    context: "test context",
    iscCriteria: [],
    dependencies: deps[id] ?? [],
    timeoutSeconds: 60,
    retryBudget: 3,
  }));

// Test 7: Parallel tasks submitted as sequential → REJECTED
try {
  const tasks = makeTasks(["task-a", "task-b", "task-c"]); // no dependencies
  const result = dispatch("batch-001", tasks, "sequential");
  if ("rejected" in result) {
    pass("Parallel tasks submitted as sequential → REJECTED with explanation");
  } else {
    fail("DEFAULT RULE rejection", "should have rejected but accepted");
  }
} catch (e) {
  fail("DEFAULT RULE rejection", String(e));
}

// Test 8: Parallel tasks submitted as parallel → ACCEPTED
try {
  const tasks = makeTasks(["task-a", "task-b", "task-c"]);
  const result = dispatch("batch-002", tasks, "parallel");
  if ("batch" in result) {
    pass("Parallel tasks submitted as parallel → ACCEPTED");
  } else {
    fail("Parallel acceptance", "should have accepted but rejected");
  }
} catch (e) {
  fail("Parallel acceptance", String(e));
}

// Test 9: Sequential tasks (chained deps) submitted as sequential → ACCEPTED
try {
  const tasks = makeTasks(
    ["task-a", "task-b", "task-c"],
    { "task-b": ["task-a"], "task-c": ["task-b"] }
  );
  const result = dispatch("batch-003", tasks, "sequential");
  if ("batch" in result) {
    pass("Sequential chain submitted as sequential → ACCEPTED");
  } else {
    fail("Sequential chain acceptance", `unexpectedly rejected: ${JSON.stringify(result)}`);
  }
} catch (e) {
  fail("Sequential chain acceptance", String(e));
}

// Test 10: Rejection message contains policy language
try {
  const tasks = makeTasks(["task-x", "task-y"]);
  const result = dispatch("batch-004", tasks, "sequential");
  if (
    "rejected" in result &&
    result.rejected.reason.includes("policy violation")
  ) {
    pass("Rejection message contains policy language");
  } else {
    fail("Rejection message", `unexpected result: ${JSON.stringify(result)}`);
  }
} catch (e) {
  fail("Rejection message", String(e));
}

// ─────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────
console.log(`\n━━━ Results: ${passed} passed, ${failed} failed ━━━\n`);
if (failed === 0) {
  console.log("✅  All smoke tests passing. Observer-native runtime is functional.\n");
  process.exit(0);
} else {
  console.log("❌  Some tests failed. See above for details.\n");
  process.exit(1);
}
