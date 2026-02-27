// S3: Comprehensive test suite for the Audit Logger subsystem
// Covers: credential sanitizer, JSONL writer, SQLite index, audit logger, circuit breaker, rebuild

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, statSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AuditEvent } from "@observer/shared";
import { generateId } from "@observer/shared";

import {
  sanitizeString,
  sanitizeDetails,
  sanitizeEvent,
  shannonEntropy,
} from "../credential-sanitizer.js";
import { JsonlWriter } from "../jsonl-writer.js";
import { SqliteIndex } from "../sqlite-index.js";
import { AuditLoggerImpl } from "../audit-logger.js";

// --- Test Helpers ---

function makeEvent(overrides?: Partial<AuditEvent>): AuditEvent {
  return {
    event_id: generateId("audit_event"),
    timestamp: new Date().toISOString(),
    category: "session",
    action: "session.create",
    session_id: "ses_test123456",
    thread_id: null,
    turn_id: null,
    item_id: null,
    client_id: "cli_user1",
    details: {},
    policy_rule_id: null,
    risk_level: null,
    ...overrides,
  };
}

function makeEventWithTimestamp(ts: string, overrides?: Partial<AuditEvent>): AuditEvent {
  return makeEvent({ timestamp: ts, event_id: generateId("audit_event"), ...overrides });
}

// ============================================================
// Credential Sanitizer Tests
// ============================================================

describe("CredentialSanitizer", () => {
  describe("Layer 1: Regex pattern matching", () => {
    it("should redact OpenAI API keys (sk-...)", () => {
      // Test fixture: obviously fake key that still matches sk-[a-zA-Z0-9]{20,}
      const input = "Using key sk-TESTFAKE00000000000000000000";
      const result = sanitizeString(input);
      expect(result).not.toContain("sk-TESTFAKE");
      expect(result).toContain("[REDACTED]");
    });

    it("should redact Google API keys (AIza...)", () => {
      const input = "Google key: AIzaSyTESTFAKE0000000000000000000000000";
      const result = sanitizeString(input);
      expect(result).not.toContain("AIzaSyTEST");
      expect(result).toContain("[REDACTED]");
    });

    it("should redact GitHub PATs (ghp_...)", () => {
      const input = "Token: ghp_TESTFAKE0000000000000000000000000000";
      const result = sanitizeString(input);
      expect(result).not.toContain("ghp_");
      expect(result).toContain("[REDACTED]");
    });

    it("should redact JWT tokens (eyJ...)", () => {
      const input =
        "Bearer eyJTESTFAKEabc123.TESTFAKEdef456789.TESTFAKE0ghi7890123";
      const result = sanitizeString(input);
      expect(result).not.toContain("eyJTESTFAKE");
      expect(result).toContain("[REDACTED]");
    });

    it("should redact sensitive file paths containing .env", () => {
      const input = "Loading config from /home/user/project/.env";
      const result = sanitizeString(input);
      expect(result).not.toContain("/home/user/project/.env");
      expect(result).toContain("[REDACTED]");
    });

    it("should redact sensitive file paths containing credentials.json", () => {
      const input = "Found /etc/app/credentials.json";
      const result = sanitizeString(input);
      expect(result).not.toContain("/etc/app/credentials.json");
      expect(result).toContain("[REDACTED]");
    });

    it("should redact sensitive file paths containing secrets.yml", () => {
      const input = "Reading /config/secrets.yml for database passwords";
      const result = sanitizeString(input);
      expect(result).not.toContain("/config/secrets.yml");
      expect(result).toContain("[REDACTED]");
    });

    it("should redact sensitive file paths containing tokens.json", () => {
      const input = "Loaded /var/run/tokens.json";
      const result = sanitizeString(input);
      expect(result).not.toContain("/var/run/tokens.json");
      expect(result).toContain("[REDACTED]");
    });

    it("should redact .env.production variant", () => {
      const input = "Deploying with /app/.env.production";
      const result = sanitizeString(input);
      expect(result).not.toContain("/app/.env.production");
      expect(result).toContain("[REDACTED]");
    });

    it("should NOT redact normal text", () => {
      const input = "Creating session for user adam with intent build";
      const result = sanitizeString(input);
      expect(result).toBe(input);
    });

    it("should NOT redact short strings that look like prefixes", () => {
      const input = "The sk- prefix is used for OpenAI keys";
      const result = sanitizeString(input);
      // sk- alone (without 20+ chars after) should not be redacted
      expect(result).toContain("sk-");
    });

    it("should handle multiple credentials in one string", () => {
      const input =
        "Keys: sk-TESTFAKE000000000000000 and ghp_TESTFAKE0000000000000000000000000000";
      const result = sanitizeString(input);
      expect(result).not.toContain("sk-TESTFAKE");
      expect(result).not.toContain("ghp_TESTFAKE");
      // Should have two [REDACTED] markers
      const count = (result.match(/\[REDACTED\]/g) ?? []).length;
      expect(count).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Layer 2: Entropy-based detection", () => {
    it("should have high entropy for random-looking strings", () => {
      const entropy = shannonEntropy("aB3xF7kM9pQ2wR5tY8uH1jN4vS6zC0e");
      expect(entropy).toBeGreaterThan(4.5);
    });

    it("should have low entropy for repeated strings", () => {
      const entropy = shannonEntropy("aaaaaaaabbbbbbbb");
      expect(entropy).toBeLessThan(2);
    });

    it("should redact high-entropy strings near context words", () => {
      const input =
        "api_key: aB3xF7kM9pQ2wR5tY8uH1jN4vS6zC0e";
      const result = sanitizeString(input);
      expect(result).toContain("[REDACTED]");
    });

    it("should NOT redact high-entropy strings far from context words", () => {
      // No context words nearby — just a random string in isolation
      const input = "The quick brown fox jumped over aB3xF7kM9pQ2wR5tY8uH1jN4vS6zC0e and landed safely";
      const result = sanitizeString(input);
      // Should NOT redact because no context words nearby
      expect(result).toBe(input);
    });
  });

  describe("sanitizeDetails", () => {
    it("should deep-sanitize all string values in a record", () => {
      const details = {
        api_key: "sk-TESTFAKE00000000000000000",
        message: "Normal text",
        nested: {
          token: "ghp_TESTFAKE0000000000000000000000000000",
        },
      };
      const result = sanitizeDetails(details);
      expect(result.api_key).toContain("[REDACTED]");
      expect(result.message).toBe("Normal text");
      expect((result.nested as Record<string, unknown>).token).toContain("[REDACTED]");
    });

    it("should not mutate the original object", () => {
      const original = { key: "sk-TESTFAKE00000000000000000" };
      sanitizeDetails(original);
      expect(original.key).toBe("sk-TESTFAKE00000000000000000");
    });
  });

  describe("sanitizeEvent", () => {
    it("should sanitize event details and preserve other fields", () => {
      const event = makeEvent({
        details: { api_key: "sk-TESTFAKE00000000000000000" },
      });
      const result = sanitizeEvent(event);
      expect(result.event_id).toBe(event.event_id);
      expect(result.timestamp).toBe(event.timestamp);
      expect(result.details.api_key).toContain("[REDACTED]");
    });
  });
});

// ============================================================
// JSONL Writer Tests
// ============================================================

describe("JsonlWriter", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "audit-jsonl-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should write events as JSONL lines with fsync", () => {
    const writer = new JsonlWriter({ filePath: join(tmpDir, "audit.jsonl") });
    const event = makeEvent();

    writer.append(event);
    writer.close();

    // Read back and verify
    const content = readFileSync(join(tmpDir, "audit.jsonl"), "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(1);

    const parsed = JSON.parse(lines[0]!) as AuditEvent;
    expect(parsed.event_id).toBe(event.event_id);
    expect(parsed.category).toBe(event.category);
  });

  it("should write multiple events as separate lines", () => {
    const writer = new JsonlWriter({ filePath: join(tmpDir, "audit.jsonl") });

    writer.append(makeEvent({ action: "one" }));
    writer.append(makeEvent({ action: "two" }));
    writer.append(makeEvent({ action: "three" }));
    writer.close();

    const content = readFileSync(join(tmpDir, "audit.jsonl"), "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(3);
  });

  it("should set file permissions to 0600", () => {
    const filePath = join(tmpDir, "audit.jsonl");
    const writer = new JsonlWriter({ filePath });
    writer.append(makeEvent());
    writer.close();

    const stat = statSync(filePath);
    // Check owner read/write only (0600 = 0o600 = 384 decimal)
    // Mask with 0o777 to get just permission bits
    const perms = stat.mode & 0o777;
    expect(perms).toBe(0o600);
  });

  it("should read back all events", () => {
    const writer = new JsonlWriter({ filePath: join(tmpDir, "audit.jsonl") });
    const events = [makeEvent({ action: "a" }), makeEvent({ action: "b" })];

    for (const e of events) writer.append(e);

    const readBack = writer.readAll();
    expect(readBack).toHaveLength(2);
    expect(readBack[0]!.action).toBe("a");
    expect(readBack[1]!.action).toBe("b");

    writer.close();
  });

  it("should return last N events with tail()", () => {
    const writer = new JsonlWriter({ filePath: join(tmpDir, "audit.jsonl") });

    for (let i = 0; i < 10; i++) {
      writer.append(makeEvent({ action: `action_${i}` }));
    }

    const last3 = writer.tail(3);
    expect(last3).toHaveLength(3);
    expect(last3[0]!.action).toBe("action_7");
    expect(last3[1]!.action).toBe("action_8");
    expect(last3[2]!.action).toBe("action_9");

    writer.close();
  });

  it("should rotate at configured size threshold", () => {
    const filePath = join(tmpDir, "audit.jsonl");
    // Set a very small max size to trigger rotation quickly
    const writer = new JsonlWriter({ filePath, maxSizeBytes: 200 });

    // Write enough events to exceed 200 bytes
    for (let i = 0; i < 10; i++) {
      writer.append(makeEvent({ action: `action_${i}` }));
    }
    writer.close();

    // Should have created at least one archived file
    const files = readdirSync(tmpDir).filter((f) => f.endsWith(".jsonl"));
    expect(files.length).toBeGreaterThan(1);
  });

  it("should set archived file permissions to 0400 (read-only)", () => {
    const filePath = join(tmpDir, "audit.jsonl");
    const writer = new JsonlWriter({ filePath, maxSizeBytes: 200 });

    for (let i = 0; i < 10; i++) {
      writer.append(makeEvent({ action: `action_${i}` }));
    }
    writer.close();

    const files = readdirSync(tmpDir).filter(
      (f) => f.endsWith(".jsonl") && f !== "audit.jsonl",
    );
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const stat = statSync(join(tmpDir, file));
      const perms = stat.mode & 0o777;
      expect(perms).toBe(0o400);
    }
  });

  it("should read events from all files (archived + current)", () => {
    const filePath = join(tmpDir, "audit.jsonl");
    const writer = new JsonlWriter({ filePath, maxSizeBytes: 200 });

    const events: AuditEvent[] = [];
    for (let i = 0; i < 10; i++) {
      const e = makeEvent({ action: `action_${i}` });
      events.push(e);
      writer.append(e);
    }

    const allEvents = writer.readAllFiles();
    // All events should be present across all files
    expect(allEvents).toHaveLength(10);

    writer.close();
  });
});

// ============================================================
// SQLite Index Tests
// ============================================================

describe("SqliteIndex", () => {
  let tmpDir: string;
  let index: SqliteIndex;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "audit-sqlite-"));
    index = new SqliteIndex({ dbPath: join(tmpDir, "audit-index.db") });
  });

  afterEach(() => {
    index.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should insert and query events by session_id", () => {
    const event1 = makeEvent({ session_id: "ses_aaaaaaaaaaaa" });
    const event2 = makeEvent({ session_id: "ses_bbbbbbbbbbbb" });
    const event3 = makeEvent({ session_id: "ses_aaaaaaaaaaaa" });

    index.insert(event1);
    index.insert(event2);
    index.insert(event3);

    const result = index.query({ session_id: "ses_aaaaaaaaaaaa" });
    expect(result.events).toHaveLength(2);
    expect(result.total_count).toBe(2);
    expect(result.events.every((e) => e.session_id === "ses_aaaaaaaaaaaa")).toBe(true);
  });

  it("should query events by thread_id", () => {
    const event1 = makeEvent({ thread_id: "thr_111111111111" });
    const event2 = makeEvent({ thread_id: "thr_222222222222" });

    index.insert(event1);
    index.insert(event2);

    const result = index.query({ thread_id: "thr_111111111111" });
    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.thread_id).toBe("thr_111111111111");
  });

  it("should query events by category", () => {
    const event1 = makeEvent({ category: "session" });
    const event2 = makeEvent({ category: "security" });
    const event3 = makeEvent({ category: "session" });

    index.insert(event1);
    index.insert(event2);
    index.insert(event3);

    const result = index.query({ category: "security" });
    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.category).toBe("security");
  });

  it("should query events by time range (since/until)", () => {
    const e1 = makeEventWithTimestamp("2026-01-01T00:00:00Z");
    const e2 = makeEventWithTimestamp("2026-02-01T00:00:00Z");
    const e3 = makeEventWithTimestamp("2026-03-01T00:00:00Z");

    index.insert(e1);
    index.insert(e2);
    index.insert(e3);

    const result = index.query({
      since: "2026-01-15T00:00:00Z",
      until: "2026-02-15T00:00:00Z",
    });
    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.timestamp).toBe("2026-02-01T00:00:00Z");
  });

  it("should respect limit parameter", () => {
    for (let i = 0; i < 10; i++) {
      index.insert(makeEventWithTimestamp(`2026-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`));
    }

    const result = index.query({ limit: 3 });
    expect(result.events).toHaveLength(3);
    expect(result.has_more).toBe(true);
    expect(result.total_count).toBe(10);
  });

  it("should support cursor-based pagination", () => {
    for (let i = 0; i < 5; i++) {
      index.insert(
        makeEventWithTimestamp(`2026-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`, {
          action: `action_${i}`,
        }),
      );
    }

    // First page
    const page1 = index.query({ limit: 2 });
    expect(page1.events).toHaveLength(2);
    expect(page1.has_more).toBe(true);
    expect(page1.next_cursor).toBeDefined();

    // Second page using cursor
    const page2 = index.query({ limit: 2, cursor: page1.next_cursor });
    expect(page2.events).toHaveLength(2);
    expect(page2.has_more).toBe(true);

    // Events should not overlap
    const page1Ids = new Set(page1.events.map((e) => e.event_id));
    for (const e of page2.events) {
      expect(page1Ids.has(e.event_id)).toBe(false);
    }

    // Third page
    const page3 = index.query({ limit: 2, cursor: page2.next_cursor });
    expect(page3.events).toHaveLength(1);
    expect(page3.has_more).toBe(false);
  });

  it("should handle INSERT OR IGNORE for duplicate event_ids", () => {
    const event = makeEvent();
    index.insert(event);
    index.insert(event); // Same event_id — should be ignored

    expect(index.getEventCount()).toBe(1);
  });

  it("should correctly store and retrieve JSON details", () => {
    const event = makeEvent({
      details: { key: "value", nested: { inner: 42 } },
    });
    index.insert(event);

    const result = index.query({});
    expect(result.events[0]!.details).toEqual({ key: "value", nested: { inner: 42 } });
  });

  it("should drop and recreate during rebuild prep", () => {
    index.insert(makeEvent());
    index.insert(makeEvent());
    expect(index.getEventCount()).toBe(2);

    index.dropAndRecreate();
    expect(index.getEventCount()).toBe(0);
  });

  it("should bulk insert events in a transaction", () => {
    const events = Array.from({ length: 50 }, () => makeEvent());
    index.bulkInsert(events);
    expect(index.getEventCount()).toBe(50);
  });

  it("should return has_more=false when all events fit in limit", () => {
    index.insert(makeEvent());
    index.insert(makeEvent());

    const result = index.query({ limit: 10 });
    expect(result.events).toHaveLength(2);
    expect(result.has_more).toBe(false);
    expect(result.next_cursor).toBeUndefined();
  });
});

// ============================================================
// AuditLogger Integration Tests
// ============================================================

describe("AuditLoggerImpl", () => {
  let tmpDir: string;
  let logger: AuditLoggerImpl;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "audit-logger-"));
    logger = new AuditLoggerImpl({ dataDir: tmpDir });
  });

  afterEach(() => {
    logger.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should log events to both JSONL and SQLite", () => {
    const event = makeEvent();
    logger.log(event);

    // Verify SQLite query returns the event
    const result = logger.query({ session_id: event.session_id! });
    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.event_id).toBe(event.event_id);

    // Verify JSONL file exists and contains the event
    const jsonlPath = join(tmpDir, "audit.jsonl");
    expect(existsSync(jsonlPath)).toBe(true);
    const content = readFileSync(jsonlPath, "utf-8");
    expect(content.trim()).not.toBe("");
  });

  it("should sanitize credentials before writing", () => {
    const event = makeEvent({
      details: {
        api_key: "sk-TESTFAKE00000000000000000",
        message: "Normal text",
      },
    });
    logger.log(event);

    // Query from SQLite — should be sanitized
    const result = logger.query({});
    expect(result.events[0]!.details.api_key).toContain("[REDACTED]");
    expect(result.events[0]!.details.message).toBe("Normal text");

    // Read from JSONL — should also be sanitized
    const tail = logger.tail(1);
    expect(tail[0]!.details.api_key).toContain("[REDACTED]");
  });

  it("should support tail() for last N events", () => {
    for (let i = 0; i < 5; i++) {
      logger.log(makeEvent({ action: `action_${i}` }));
    }

    const tail = logger.tail(2);
    expect(tail).toHaveLength(2);
    expect(tail[0]!.action).toBe("action_3");
    expect(tail[1]!.action).toBe("action_4");
  });

  it("should track event count", () => {
    expect(logger.getEventCount()).toBe(0);
    logger.log(makeEvent());
    logger.log(makeEvent());
    expect(logger.getEventCount()).toBe(2);
  });

  describe("Circuit breaker", () => {
    it("should start with no failures", () => {
      expect(logger.getConsecutiveFailures()).toBe(0);
      expect(logger.isCritical()).toBe(false);
    });

    it("should trip after 5 consecutive failures", () => {
      // Close the logger to force write failures
      logger.close();

      for (let i = 0; i < 5; i++) {
        try {
          logger.log(makeEvent());
        } catch {
          // Expected — writes fail after close
        }
      }

      expect(logger.getConsecutiveFailures()).toBe(5);
      expect(logger.isCritical()).toBe(true);
    });

    it("should reset on successful write", () => {
      // Create a fresh logger for this test
      const freshDir = mkdtempSync(join(tmpdir(), "audit-cb-"));
      const freshLogger = new AuditLoggerImpl({ dataDir: freshDir });

      // Log successfully
      freshLogger.log(makeEvent());
      expect(freshLogger.getConsecutiveFailures()).toBe(0);

      freshLogger.close();
      rmSync(freshDir, { recursive: true, force: true });
    });

    it("should support manual reset", () => {
      // Close to force failures
      logger.close();

      for (let i = 0; i < 5; i++) {
        try {
          logger.log(makeEvent());
        } catch {
          // Expected
        }
      }

      expect(logger.isCritical()).toBe(true);
      logger.resetCircuitBreaker();
      expect(logger.isCritical()).toBe(false);
      expect(logger.getConsecutiveFailures()).toBe(0);
    });
  });

  describe("rebuild()", () => {
    it("should recreate SQLite index from JSONL files", () => {
      // Log some events
      const events: AuditEvent[] = [];
      for (let i = 0; i < 5; i++) {
        const e = makeEvent({ action: `action_${i}`, session_id: "ses_rebuildtest1" });
        events.push(e);
        logger.log(e);
      }

      // Verify initial state
      expect(logger.getEventCount()).toBe(5);

      // Rebuild from JSONL
      logger.rebuild();

      // Verify rebuilt state
      expect(logger.getEventCount()).toBe(5);

      // Verify queries still work
      const result = logger.query({ session_id: "ses_rebuildtest1" });
      expect(result.events).toHaveLength(5);
    });

    it("should handle rebuild with rotated files", () => {
      // Use very small rotation size
      const rotDir = mkdtempSync(join(tmpdir(), "audit-rot-"));
      const rotLogger = new AuditLoggerImpl({
        dataDir: rotDir,
        maxFileSizeBytes: 200,
      });

      // Write enough to trigger rotation
      for (let i = 0; i < 10; i++) {
        rotLogger.log(makeEvent({ action: `rot_${i}` }));
      }

      // Rebuild
      rotLogger.rebuild();

      // All events should still be in the index
      expect(rotLogger.getEventCount()).toBe(10);

      rotLogger.close();
      rmSync(rotDir, { recursive: true, force: true });
    });
  });

  describe("append() (AuditStore interface)", () => {
    it("should work identically to log()", () => {
      const event = makeEvent();
      logger.append(event);

      const result = logger.query({});
      expect(result.events).toHaveLength(1);
      expect(result.events[0]!.event_id).toBe(event.event_id);
    });
  });

  describe("Health reporting", () => {
    it("should report JSONL size", () => {
      logger.log(makeEvent());
      expect(logger.getJsonlSizeBytes()).toBeGreaterThan(0);
    });

    it("should report SQLite size", () => {
      logger.log(makeEvent());
      expect(logger.getSqliteSizeBytes()).toBeGreaterThan(0);
    });
  });
});
