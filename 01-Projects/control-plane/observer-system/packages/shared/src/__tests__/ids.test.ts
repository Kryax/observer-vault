import { describe, it, expect } from "vitest";
import { generateId, ALPHABET } from "../ids.js";
import { ID_PREFIXES, ID_LENGTHS } from "../types.js";

describe("ALPHABET", () => {
  it("contains exactly 36 characters (0-9 a-z)", () => {
    expect(ALPHABET).toBe("0123456789abcdefghijklmnopqrstuvwxyz");
    expect(ALPHABET.length).toBe(36);
  });

  it("contains no uppercase characters", () => {
    expect(ALPHABET).toBe(ALPHABET.toLowerCase());
  });
});

describe("generateId", () => {
  it("generates session IDs with ses_ prefix and 12-char body", () => {
    const id = generateId("session");
    expect(id).toMatch(/^ses_[a-z0-9]{12}$/);
  });

  it("generates thread IDs with thr_ prefix and 12-char body", () => {
    const id = generateId("thread");
    expect(id).toMatch(/^thr_[a-z0-9]{12}$/);
  });

  it("generates turn IDs with trn_ prefix and 12-char body", () => {
    const id = generateId("turn");
    expect(id).toMatch(/^trn_[a-z0-9]{12}$/);
  });

  it("generates item IDs with itm_ prefix and 12-char body", () => {
    const id = generateId("item");
    expect(id).toMatch(/^itm_[a-z0-9]{12}$/);
  });

  it("generates audit event IDs with evt_ prefix and 16-char body", () => {
    const id = generateId("audit_event");
    expect(id).toMatch(/^evt_[a-z0-9]{16}$/);
  });

  it("generates dispatch IDs with dsp_ prefix and 12-char body", () => {
    const id = generateId("dispatch");
    expect(id).toMatch(/^dsp_[a-z0-9]{12}$/);
  });

  it("generates approval IDs with apr_ prefix and 12-char body", () => {
    const id = generateId("approval");
    expect(id).toMatch(/^apr_[a-z0-9]{12}$/);
  });

  it("generates unique IDs across calls", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId("session"));
    }
    expect(ids.size).toBe(100);
  });

  it("uses only lowercase alphanumeric characters in body", () => {
    for (let i = 0; i < 50; i++) {
      const id = generateId("session");
      const body = id.slice(4); // Remove "ses_" prefix
      expect(body).toMatch(/^[a-z0-9]+$/);
    }
  });
});

describe("ID_PREFIXES", () => {
  it("has correct prefixes for all entity types", () => {
    expect(ID_PREFIXES.session).toBe("ses_");
    expect(ID_PREFIXES.thread).toBe("thr_");
    expect(ID_PREFIXES.turn).toBe("trn_");
    expect(ID_PREFIXES.item).toBe("itm_");
    expect(ID_PREFIXES.audit_event).toBe("evt_");
    expect(ID_PREFIXES.dispatch).toBe("dsp_");
    expect(ID_PREFIXES.approval).toBe("apr_");
  });
});

describe("ID_LENGTHS", () => {
  it("has correct lengths for all entity types", () => {
    expect(ID_LENGTHS.session).toBe(12);
    expect(ID_LENGTHS.thread).toBe(12);
    expect(ID_LENGTHS.turn).toBe(12);
    expect(ID_LENGTHS.item).toBe(12);
    expect(ID_LENGTHS.audit_event).toBe(16);
    expect(ID_LENGTHS.dispatch).toBe(12);
    expect(ID_LENGTHS.approval).toBe(12);
  });
});
