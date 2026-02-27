// S6: Sanitization tests — HIGHEST PRIORITY
// These tests verify the #1 security guarantee: credential isolation.
// ISC criteria: sanitizedEnv returns ONLY allowed vars, never credentials.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  sanitizedEnv,
  validateArgs,
  sanitizeOutput,
  shannonEntropy,
  _testing,
} from "../sanitize.js";

// ---------------------------------------------------------------------------
// sanitizedEnv()
// ---------------------------------------------------------------------------
describe("sanitizedEnv", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    // Start with a clean, controlled process.env
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    // Restore original process.env
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, savedEnv);
  });

  it("returns only allowed exact-match vars from process.env", () => {
    process.env.PATH = "/usr/bin";
    process.env.HOME = "/home/user";
    process.env.TERM = "xterm-256color";
    process.env.LANG = "en_US.UTF-8";
    process.env.USER = "testuser";
    process.env.OPENAI_API_KEY = "sk-test123";
    process.env.AWS_SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG";

    const env = sanitizedEnv();

    expect(env.PATH).toBe("/usr/bin");
    expect(env.HOME).toBe("/home/user");
    expect(env.TERM).toBe("xterm-256color");
    expect(env.LANG).toBe("en_US.UTF-8");
    expect(env.USER).toBe("testuser");
    expect(Object.keys(env)).toHaveLength(5);
  });

  it("includes XDG_* variables", () => {
    process.env.XDG_CONFIG_HOME = "/home/user/.config";
    process.env.XDG_DATA_HOME = "/home/user/.local/share";
    process.env.XDG_RUNTIME_DIR = "/run/user/1000";

    const env = sanitizedEnv();

    expect(env.XDG_CONFIG_HOME).toBe("/home/user/.config");
    expect(env.XDG_DATA_HOME).toBe("/home/user/.local/share");
    expect(env.XDG_RUNTIME_DIR).toBe("/run/user/1000");
    expect(Object.keys(env)).toHaveLength(3);
  });

  it("NEVER includes *_KEY variables", () => {
    process.env.PATH = "/usr/bin";
    process.env.OPENAI_API_KEY = "sk-test123456789012345678";
    process.env.GOOGLE_API_KEY = "AIzaSyTest1234567890";
    process.env.SSH_KEY = "/path/to/key";
    process.env.ENCRYPTION_KEY = "supersecret";

    const env = sanitizedEnv();

    expect(env.OPENAI_API_KEY).toBeUndefined();
    expect(env.GOOGLE_API_KEY).toBeUndefined();
    expect(env.SSH_KEY).toBeUndefined();
    expect(env.ENCRYPTION_KEY).toBeUndefined();
    expect(Object.keys(env)).toEqual(["PATH"]);
  });

  it("NEVER includes *_TOKEN variables", () => {
    process.env.PATH = "/usr/bin";
    process.env.GITHUB_TOKEN = "ghp_test123456789";
    process.env.SLACK_TOKEN = "xoxb-test-token";
    process.env.AUTH_TOKEN = "bearer-abc123";

    const env = sanitizedEnv();

    expect(env.GITHUB_TOKEN).toBeUndefined();
    expect(env.SLACK_TOKEN).toBeUndefined();
    expect(env.AUTH_TOKEN).toBeUndefined();
    expect(Object.keys(env)).toEqual(["PATH"]);
  });

  it("NEVER includes *_SECRET variables", () => {
    process.env.PATH = "/usr/bin";
    process.env.AWS_SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG";
    process.env.CLIENT_SECRET = "secret123";
    process.env.JWT_SECRET = "my-jwt-secret";

    const env = sanitizedEnv();

    expect(env.AWS_SECRET_ACCESS_KEY).toBeUndefined();
    expect(env.CLIENT_SECRET).toBeUndefined();
    expect(env.JWT_SECRET).toBeUndefined();
    // Note: AWS_SECRET_ACCESS_KEY doesn't end in _KEY, it ends in _KEY but
    // the full var name is checked — it ends in _KEY so it would be blocked.
    // Actually it ends in "_KEY" so isCredentialVar catches it.
    expect(Object.keys(env)).toEqual(["PATH"]);
  });

  it("NEVER includes *_PASSWORD variables", () => {
    process.env.PATH = "/usr/bin";
    process.env.DB_PASSWORD = "postgres123";
    process.env.ADMIN_PASSWORD = "admin123";

    const env = sanitizedEnv();

    expect(env.DB_PASSWORD).toBeUndefined();
    expect(env.ADMIN_PASSWORD).toBeUndefined();
  });

  it("excludes random unknown env vars", () => {
    process.env.PATH = "/usr/bin";
    process.env.CUSTOM_VAR = "custom-value";
    process.env.MY_SETTING = "something";
    process.env.NODE_ENV = "production";
    process.env.DEBUG = "true";

    const env = sanitizedEnv();

    expect(env.CUSTOM_VAR).toBeUndefined();
    expect(env.MY_SETTING).toBeUndefined();
    expect(env.NODE_ENV).toBeUndefined();
    expect(env.DEBUG).toBeUndefined();
    expect(Object.keys(env)).toEqual(["PATH"]);
  });

  it("returns a NEW object, not a reference to process.env", () => {
    process.env.PATH = "/usr/bin";
    const env = sanitizedEnv();

    expect(env).not.toBe(process.env);

    // Mutating the result must not affect process.env
    env.PATH = "/modified";
    expect(process.env.PATH).toBe("/usr/bin");
  });

  it("merges extraVars into the result", () => {
    process.env.PATH = "/usr/bin";

    const env = sanitizedEnv({ BACKEND_SPECIFIC: "value123" });

    expect(env.PATH).toBe("/usr/bin");
    expect(env.BACKEND_SPECIFIC).toBe("value123");
  });

  it("blocks credential-named extraVars", () => {
    const env = sanitizedEnv({
      OPENAI_API_KEY: "sk-test",
      MY_TOKEN: "abc",
      NORMAL_VAR: "ok",
    });

    expect(env.OPENAI_API_KEY).toBeUndefined();
    expect(env.MY_TOKEN).toBeUndefined();
    expect(env.NORMAL_VAR).toBe("ok");
  });

  it("returns empty object when process.env has no allowed vars", () => {
    // process.env is empty from beforeEach
    const env = sanitizedEnv();
    expect(Object.keys(env)).toHaveLength(0);
  });

  it("is case-insensitive for credential suffix detection", () => {
    process.env.PATH = "/usr/bin";
    process.env.my_api_key = "test";
    process.env.some_Token = "test";

    const env = sanitizedEnv();

    expect(env.my_api_key).toBeUndefined();
    expect(env.some_Token).toBeUndefined();
    expect(Object.keys(env)).toEqual(["PATH"]);
  });
});

// ---------------------------------------------------------------------------
// validateArgs()
// ---------------------------------------------------------------------------
describe("validateArgs", () => {
  it("allows normal arguments", () => {
    expect(() =>
      validateArgs(["--prompt", "Hello world", "--model", "gpt-4"]),
    ).not.toThrow();
  });

  it("allows short strings even with high entropy", () => {
    // Short strings under 20 chars should not trigger entropy check
    expect(() => validateArgs(["a1b2c3d4e5f6g7h8"])).not.toThrow();
  });

  it("allows empty args array", () => {
    expect(() => validateArgs([])).not.toThrow();
  });

  it("allows file paths and normal values", () => {
    expect(() =>
      validateArgs([
        "/home/user/project/src/main.ts",
        "--output",
        "/tmp/result.json",
        "--verbose",
        "--timeout",
        "30",
      ]),
    ).not.toThrow();
  });

  // Credential pattern tests
  it("rejects OpenAI API keys (sk-...)", () => {
    expect(() =>
      validateArgs(["--key", "sk-abcdefghijklmnopqrstuvwxyz1234"]),
    ).toThrow(/credential pattern/i);
  });

  it("rejects Google API keys (AIza...)", () => {
    expect(() =>
      validateArgs([
        "--key",
        "AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ123456_",
      ]),
    ).toThrow(/credential pattern/i);
  });

  it("rejects GitHub personal access tokens (ghp_...)", () => {
    expect(() =>
      validateArgs([
        "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijkl",
      ]),
    ).toThrow(/credential pattern/i);
  });

  it("rejects GitHub OAuth tokens (gho_...)", () => {
    expect(() =>
      validateArgs([
        "gho_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijkl",
      ]),
    ).toThrow(/credential pattern/i);
  });

  it("rejects AWS access key IDs (AKIA...)", () => {
    expect(() => validateArgs(["AKIAIOSFODNN7EXAMPLE"])).toThrow(
      /credential pattern/i,
    );
  });

  it("rejects Slack tokens (xoxb-...)", () => {
    expect(() =>
      validateArgs(["xoxb-123456789012-1234567890123-abc"]),
    ).toThrow(/credential pattern/i);
  });

  it("rejects high-entropy strings longer than 20 chars", () => {
    // A base64 string with high entropy
    const highEntropy =
      "aB3dE5fG7hI9jK1lM3nO5pQ7rS9tU1vW3xY5zA7bC9dE1fG3";
    expect(shannonEntropy(highEntropy)).toBeGreaterThan(4.5);
    expect(highEntropy.length).toBeGreaterThan(20);

    expect(() => validateArgs([highEntropy])).toThrow(/high entropy/i);
  });

  it("allows low-entropy long strings", () => {
    // Repeated characters have low entropy
    const lowEntropy = "aaaaaaaaaaaaaaaaaaaaaaaaa";
    expect(shannonEntropy(lowEntropy)).toBeLessThan(4.5);
    expect(lowEntropy.length).toBeGreaterThan(20);

    expect(() => validateArgs([lowEntropy])).not.toThrow();
  });

  it("includes the argument index in the error message", () => {
    expect(() =>
      validateArgs([
        "safe",
        "also-safe",
        "sk-abcdefghijklmnopqrstuvwxyz1234",
      ]),
    ).toThrow(/index 2/);
  });

  it("rejects credentials embedded in longer strings", () => {
    expect(() =>
      validateArgs([
        "prefix_sk-abcdefghijklmnopqrstuvwxyz1234_suffix",
      ]),
    ).toThrow(/credential pattern/i);
  });
});

// ---------------------------------------------------------------------------
// sanitizeOutput()
// ---------------------------------------------------------------------------
describe("sanitizeOutput", () => {
  it("strips ANSI escape sequences", () => {
    const colored = "\x1b[31mError\x1b[0m: something failed";
    const result = sanitizeOutput(colored);
    expect(result.text).toBe("Error: something failed");
    expect(result.truncated).toBe(false);
  });

  it("strips complex ANSI sequences (cursor movement, etc.)", () => {
    const ansi = "\x1b[2J\x1b[H\x1b[1;32mGreen\x1b[0m text";
    const result = sanitizeOutput(ansi);
    expect(result.text).toBe("Green text");
  });

  it("redacts OpenAI API keys in output", () => {
    const output =
      "Using key sk-abcdefghijklmnopqrstuvwxyz1234 for authentication";
    const result = sanitizeOutput(output);
    expect(result.text).toContain("[REDACTED]");
    expect(result.text).not.toContain("sk-abcdef");
  });

  it("redacts GitHub tokens in output", () => {
    const output =
      "Token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijkl";
    const result = sanitizeOutput(output);
    expect(result.text).toContain("[REDACTED]");
    expect(result.text).not.toContain("ghp_");
  });

  it("redacts Google API keys in output", () => {
    const output =
      "key=AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ123456_";
    const result = sanitizeOutput(output);
    expect(result.text).toContain("[REDACTED]");
    expect(result.text).not.toContain("AIzaSy");
  });

  it("redacts AWS access key IDs in output", () => {
    const output = "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE";
    const result = sanitizeOutput(output);
    expect(result.text).toContain("[REDACTED]");
    expect(result.text).not.toContain("AKIAIOSFODNN7EXAMPLE");
  });

  it("redacts multiple credentials in the same output", () => {
    const output = [
      "Key1: sk-abcdefghijklmnopqrstuvwxyz1234",
      "Key2: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijkl",
      "Normal: just regular text",
    ].join("\n");

    const result = sanitizeOutput(output);
    expect(result.text).not.toContain("sk-abcdef");
    expect(result.text).not.toContain("ghp_");
    expect(result.text).toContain("Normal: just regular text");
  });

  it("truncates output exceeding maxBytes", () => {
    const large = "x".repeat(100);
    const result = sanitizeOutput(large, 50);
    expect(result.truncated).toBe(true);
    expect(Buffer.byteLength(result.text, "utf-8")).toBeLessThanOrEqual(50);
  });

  it("does not truncate output within maxBytes", () => {
    const small = "Hello, world!";
    const result = sanitizeOutput(small);
    expect(result.text).toBe(small);
    expect(result.truncated).toBe(false);
  });

  it("handles empty output", () => {
    const result = sanitizeOutput("");
    expect(result.text).toBe("");
    expect(result.truncated).toBe(false);
  });

  it("handles output with only ANSI codes", () => {
    const result = sanitizeOutput("\x1b[31m\x1b[0m");
    expect(result.text).toBe("");
    expect(result.truncated).toBe(false);
  });

  it("both strips ANSI and redacts credentials", () => {
    const output =
      "\x1b[33mWarning:\x1b[0m Using key sk-abcdefghijklmnopqrstuvwxyz1234";
    const result = sanitizeOutput(output);
    expect(result.text).not.toContain("\x1b");
    expect(result.text).not.toContain("sk-abcdef");
    expect(result.text).toContain("Warning:");
    expect(result.text).toContain("[REDACTED]");
  });
});

// ---------------------------------------------------------------------------
// shannonEntropy()
// ---------------------------------------------------------------------------
describe("shannonEntropy", () => {
  it("returns 0 for empty string", () => {
    expect(shannonEntropy("")).toBe(0);
  });

  it("returns 0 for single-character string", () => {
    expect(shannonEntropy("aaaa")).toBe(0);
  });

  it("returns 1.0 for two equally distributed characters", () => {
    const entropy = shannonEntropy("aabb");
    expect(entropy).toBeCloseTo(1.0, 5);
  });

  it("returns high entropy for random-looking strings", () => {
    // Mixed case, digits, special chars = high entropy
    const entropy = shannonEntropy(
      "aB3dE5fG7hI9jK1lM3nO5pQ7rS9tU1vW3xY5z",
    );
    expect(entropy).toBeGreaterThan(4.5);
  });

  it("returns low entropy for repetitive strings", () => {
    const entropy = shannonEntropy("aaaaaabbbbbb");
    expect(entropy).toBeLessThan(2);
  });
});
