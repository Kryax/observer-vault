/**
 * R1 Unit Tests — Degenerate form classifier, VerbRecord→PairedRecord,
 * SolutionRecord→PairedRecord construction.
 *
 * ISC-R03: Degenerate form classifier correctly identifies all four forms
 * ISC-R04: PairedRecord from VerbRecord (verb-only degenerate)
 * ISC-R05: PairedRecord from SolutionRecord (noun-only degenerate)
 */

import { describe, test, expect } from "bun:test";
import type { PairedRecord } from "./types.ts";
import {
  classifyDegenerateForm,
  pairedRecordFromVerbRecord,
  pairedRecordFromSolutionRecord,
} from "./degenerate.ts";
import type { VerbRecordInput, SolutionRecordInput } from "./degenerate.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRecord(overrides: Partial<PairedRecord>): PairedRecord {
  return {
    id: "test-001",
    sourceProvenance: "hash://abc123",
    timestamp: "2026-03-24T00:00:00Z",
    noun: {
      entityType: "finite-capacity-channel",
      domain: "network-engineering",
      description: "A bounded queue",
      rawContent: "Raw text here",
    },
    verb: {
      processShape: "negative feedback constraining deviation",
      operators: ["constrain", "buffer"],
      axis: "integrate",
      derivativeOrder: 1,
    },
    alignment: {
      confidence: 0.85,
      method: "structural",
    },
    position: {
      river: "intake",
      channel: "fast",
      stage: "initial",
      enteredAt: "2026-03-24T00:00:00Z",
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// ISC-R03: Degenerate Form Classifier
// ---------------------------------------------------------------------------

describe("classifyDegenerateForm", () => {
  test("full_pair: both noun and verb present with confidence > 0", () => {
    const record = makeRecord({});
    expect(classifyDegenerateForm(record)).toBe("full_pair");
  });

  test("full_pair: high confidence", () => {
    const record = makeRecord({
      alignment: { confidence: 1.0, method: "human-verified" },
    });
    expect(classifyDegenerateForm(record)).toBe("full_pair");
  });

  test("full_pair: low but nonzero confidence", () => {
    const record = makeRecord({
      alignment: { confidence: 0.01, method: "model-assigned" },
    });
    expect(classifyDegenerateForm(record)).toBe("full_pair");
  });

  test("full_pair: provenance alignment", () => {
    const record = makeRecord({
      alignment: { confidence: 0.5, method: "provenance" },
    });
    expect(classifyDegenerateForm(record)).toBe("full_pair");
  });

  test("noun_only: verb is null", () => {
    const record = makeRecord({ verb: null });
    expect(classifyDegenerateForm(record)).toBe("noun_only");
  });

  test("noun_only: verb null regardless of confidence", () => {
    const record = makeRecord({
      verb: null,
      alignment: { confidence: 0.9, method: "structural" },
    });
    expect(classifyDegenerateForm(record)).toBe("noun_only");
  });

  test("noun_only: verb null with zero confidence", () => {
    const record = makeRecord({
      verb: null,
      alignment: { confidence: 0, method: "provenance" },
    });
    expect(classifyDegenerateForm(record)).toBe("noun_only");
  });

  test("noun_only: different domains", () => {
    const record = makeRecord({
      verb: null,
      noun: {
        entityType: "solution",
        domain: "biology",
        description: "Enzyme regulation",
        rawContent: "text",
      },
    });
    expect(classifyDegenerateForm(record)).toBe("noun_only");
  });

  test("verb_only: noun is null", () => {
    const record = makeRecord({ noun: null });
    expect(classifyDegenerateForm(record)).toBe("verb_only");
  });

  test("verb_only: noun null regardless of confidence", () => {
    const record = makeRecord({
      noun: null,
      alignment: { confidence: 0.5, method: "model-assigned" },
    });
    expect(classifyDegenerateForm(record)).toBe("verb_only");
  });

  test("verb_only: noun null with zero confidence", () => {
    const record = makeRecord({
      noun: null,
      alignment: { confidence: 0, method: "provenance" },
    });
    expect(classifyDegenerateForm(record)).toBe("verb_only");
  });

  test("verb_only: different process shapes", () => {
    const record = makeRecord({
      noun: null,
      verb: {
        processShape: "cyclic accumulation",
        operators: ["accumulate", "gate"],
        axis: "recurse",
        derivativeOrder: 2,
      },
    });
    expect(classifyDegenerateForm(record)).toBe("verb_only");
  });

  test("unaligned_pair: both present but confidence === 0", () => {
    const record = makeRecord({
      alignment: { confidence: 0, method: "provenance" },
    });
    expect(classifyDegenerateForm(record)).toBe("unaligned_pair");
  });

  test("unaligned_pair: structural method with zero confidence", () => {
    const record = makeRecord({
      alignment: { confidence: 0, method: "structural" },
    });
    expect(classifyDegenerateForm(record)).toBe("unaligned_pair");
  });

  test("unaligned_pair: model-assigned with zero confidence", () => {
    const record = makeRecord({
      alignment: { confidence: 0, method: "model-assigned" },
    });
    expect(classifyDegenerateForm(record)).toBe("unaligned_pair");
  });

  test("unaligned_pair: both null (edge case)", () => {
    const record = makeRecord({
      noun: null,
      verb: null,
      alignment: { confidence: 0, method: "provenance" },
    });
    expect(classifyDegenerateForm(record)).toBe("unaligned_pair");
  });
});

// ---------------------------------------------------------------------------
// ISC-R04: VerbRecord → PairedRecord
// ---------------------------------------------------------------------------

describe("pairedRecordFromVerbRecord", () => {
  const verbInput: VerbRecordInput = {
    id: "vrec-001",
    process: {
      shape: "negative feedback constraining deviation",
      operators: ["constrain", "buffer", "gate"],
      axis: "integrate",
      derivativeOrder: 1,
    },
    source: {
      contentHash: "sha256:abc123def456",
      rawText: "The system constrains deviation via negative feedback",
    },
    domain: "control-theory",
    createdAt: "2026-03-24T10:00:00Z",
  };

  test("produces a verb-only degenerate (noun is null)", () => {
    const paired = pairedRecordFromVerbRecord(verbInput);
    expect(paired.noun).toBeNull();
    expect(paired.verb).not.toBeNull();
  });

  test("verb component maps correctly", () => {
    const paired = pairedRecordFromVerbRecord(verbInput);
    expect(paired.verb!.processShape).toBe(
      "negative feedback constraining deviation",
    );
    expect(paired.verb!.operators).toEqual(["constrain", "buffer", "gate"]);
    expect(paired.verb!.axis).toBe("integrate");
    expect(paired.verb!.derivativeOrder).toBe(1);
  });

  test("preserves id from VerbRecord", () => {
    const paired = pairedRecordFromVerbRecord(verbInput);
    expect(paired.id).toBe("vrec-001");
  });

  test("source provenance is contentHash", () => {
    const paired = pairedRecordFromVerbRecord(verbInput);
    expect(paired.sourceProvenance).toBe("sha256:abc123def456");
  });

  test("alignment confidence is 0 (no noun to align with)", () => {
    const paired = pairedRecordFromVerbRecord(verbInput);
    expect(paired.alignment.confidence).toBe(0);
    expect(paired.alignment.method).toBe("provenance");
  });

  test("position is intake/fast/pairing_pending", () => {
    const paired = pairedRecordFromVerbRecord(verbInput);
    expect(paired.position.river).toBe("intake");
    expect(paired.position.channel).toBe("fast");
    expect(paired.position.stage).toBe("pairing_pending");
  });

  test("classifies as verb_only", () => {
    const paired = pairedRecordFromVerbRecord(verbInput);
    expect(classifyDegenerateForm(paired)).toBe("verb_only");
  });

  test("timestamp preserved from VerbRecord", () => {
    const paired = pairedRecordFromVerbRecord(verbInput);
    expect(paired.timestamp).toBe("2026-03-24T10:00:00Z");
  });
});

// ---------------------------------------------------------------------------
// ISC-R05: SolutionRecord → PairedRecord
// ---------------------------------------------------------------------------

describe("pairedRecordFromSolutionRecord", () => {
  const solutionInput: SolutionRecordInput = {
    "@id": "urn:ocp:solution:redis-rate-limiting",
    meta: {
      title: "Redis Rate Limiting",
      description: "Token bucket rate limiting using Redis sorted sets",
      dateCreated: "2026-03-20T00:00:00Z",
    },
    domains: ["distributed-systems", "api-design"],
    problemSolved: {
      statement:
        "Distributed rate limiting with sub-millisecond p99 latency",
    },
  };

  test("produces a noun-only degenerate (verb is null)", () => {
    const paired = pairedRecordFromSolutionRecord(solutionInput);
    expect(paired.verb).toBeNull();
    expect(paired.noun).not.toBeNull();
  });

  test("noun component maps correctly", () => {
    const paired = pairedRecordFromSolutionRecord(solutionInput);
    expect(paired.noun!.entityType).toBe("solution");
    expect(paired.noun!.domain).toBe("distributed-systems");
    expect(paired.noun!.description).toBe(
      "Token bucket rate limiting using Redis sorted sets",
    );
    expect(paired.noun!.rawContent).toBe(
      "Distributed rate limiting with sub-millisecond p99 latency",
    );
  });

  test("preserves @id as both id and sourceProvenance", () => {
    const paired = pairedRecordFromSolutionRecord(solutionInput);
    expect(paired.id).toBe("urn:ocp:solution:redis-rate-limiting");
    expect(paired.sourceProvenance).toBe(
      "urn:ocp:solution:redis-rate-limiting",
    );
  });

  test("alignment confidence is 0 (no verb to align with)", () => {
    const paired = pairedRecordFromSolutionRecord(solutionInput);
    expect(paired.alignment.confidence).toBe(0);
    expect(paired.alignment.method).toBe("provenance");
  });

  test("position is intake/fast/pairing_pending", () => {
    const paired = pairedRecordFromSolutionRecord(solutionInput);
    expect(paired.position.river).toBe("intake");
    expect(paired.position.channel).toBe("fast");
    expect(paired.position.stage).toBe("pairing_pending");
  });

  test("classifies as noun_only", () => {
    const paired = pairedRecordFromSolutionRecord(solutionInput);
    expect(classifyDegenerateForm(paired)).toBe("noun_only");
  });

  test("timestamp from SolutionRecord dateCreated", () => {
    const paired = pairedRecordFromSolutionRecord(solutionInput);
    expect(paired.timestamp).toBe("2026-03-20T00:00:00Z");
  });

  test("handles single domain correctly", () => {
    const single = {
      ...solutionInput,
      domains: ["biology"] as const,
    };
    const paired = pairedRecordFromSolutionRecord(single);
    expect(paired.noun!.domain).toBe("biology");
  });
});
