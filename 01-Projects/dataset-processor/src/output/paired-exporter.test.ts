/**
 * Tests for PairedExporter — paired (source, verb-record) JSONL export.
 *
 * ISC criteria:
 *   S6-1: Each JSONL line has {"source": <raw text>, "verb_record": <VerbRecord>}
 *   S6-2: Source text matches source.rawText field exactly
 *   S6-3: Content hash matches SHA-256 of source passage
 *   S6-4: Export filters by stage: typed only, crystallized only, or both
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { unlinkSync, existsSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { VerbRecordStore } from "../store/verb-record-store.ts";
import type { VerbRecord } from "../types/verb-record.ts";
import { PairedExporter } from "./paired-exporter.ts";
import type { PairedRecord } from "./paired-exporter.ts";

function computeHash(text: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(text);
  return hasher.digest("hex");
}

function makeRecord(overrides: Partial<VerbRecord> & { source?: Partial<VerbRecord["source"]> } = {}): VerbRecord {
  const rawText = overrides.source?.rawText ?? "The process differentiates along the temporal axis.";
  const id = overrides.id ?? computeHash(rawText + "test");
  return {
    id,
    stage: overrides.stage ?? "typed",
    process: {
      shape: "differentiate",
      operators: ["d/dt"],
      axis: "differentiate",
      derivativeOrder: 1,
    },
    source: {
      dataset: "the-pile",
      component: "pile-cc",
      documentId: "shard-001:42",
      charOffset: [0, 48],
      contentHash: computeHash(rawText),
      rawText,
      ...overrides.source,
    },
    quality: {
      tierAScore: 0.9,
      tierBScore: 0.7,
      extractionMethod: "primed",
    },
    domain: "physics",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    extractorVersion: "0.1.0",
    ...overrides,
    // Re-apply source after spread to avoid double-override issues
  } as VerbRecord;
}

const tmpDir = tmpdir();
let dbPath: string;
let outputPath: string;
let store: VerbRecordStore;

beforeEach(() => {
  const suffix = Math.random().toString(36).slice(2, 10);
  dbPath = join(tmpDir, `test-paired-${suffix}.db`);
  outputPath = join(tmpDir, `test-paired-${suffix}.jsonl`);
  store = new VerbRecordStore(dbPath);
});

afterEach(() => {
  store.close();
  for (const p of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`, outputPath]) {
    if (existsSync(p)) unlinkSync(p);
  }
});

describe("PairedExporter", () => {
  // S6-1: Each JSONL line has {"source": <raw text>, "verb_record": <VerbRecord>}
  test("S6-1: export produces JSONL with source and verb_record fields", async () => {
    const rec = makeRecord();
    store.insert(rec);

    const exporter = new PairedExporter(store);
    const count = await exporter.exportToFile(outputPath);

    expect(count).toBe(1);

    const lines = readFileSync(outputPath, "utf-8").trim().split("\n");
    expect(lines.length).toBe(1);

    const parsed = JSON.parse(lines[0]) as PairedRecord;
    expect(parsed).toHaveProperty("source");
    expect(parsed).toHaveProperty("verb_record");
    expect(typeof parsed.source).toBe("string");
    expect(typeof parsed.verb_record).toBe("object");
  });

  // S6-2: Source text matches source.rawText field exactly
  test("S6-2: source text matches verb_record.source.rawText byte-for-byte", async () => {
    const rawText = "Integration converges through recursive self-reference.\n\tWith special chars: \u00e9\u00e8\u00ea";
    const rec = makeRecord({
      source: {
        dataset: "the-pile",
        component: "pile-cc",
        documentId: "shard-002:99",
        charOffset: [0, rawText.length],
        contentHash: computeHash(rawText),
        rawText,
      },
    });
    store.insert(rec);

    const exporter = new PairedExporter(store);
    await exporter.exportToFile(outputPath);

    const lines = readFileSync(outputPath, "utf-8").trim().split("\n");
    const parsed = JSON.parse(lines[0]) as PairedRecord;

    expect(parsed.source).toBe(rawText);
    expect(parsed.source).toBe(parsed.verb_record.source.rawText);
  });

  // S6-3: Content hash matches SHA-256 of source passage
  test("S6-3: content hash matches SHA-256 of source passage", async () => {
    const rawText = "Recursive oscillation between states.";
    const rec = makeRecord({
      source: {
        dataset: "the-pile",
        component: "pile-cc",
        documentId: "shard-003:1",
        charOffset: [0, rawText.length],
        contentHash: computeHash(rawText),
        rawText,
      },
    });
    store.insert(rec);

    const exporter = new PairedExporter(store);
    await exporter.exportToFile(outputPath);

    // Verify via integrity check
    const result = await exporter.verifyIntegrity(outputPath);
    expect(result.total).toBe(1);
    expect(result.valid).toBe(1);
    expect(result.mismatched).toBe(0);
  });

  // S6-4: Export filters by stage
  test("S6-4: filters by typed stage only", async () => {
    const typedRec = makeRecord({ stage: "typed", source: { dataset: "the-pile", component: "pile-cc", documentId: "s:1", charOffset: [0, 10], contentHash: computeHash("typed text"), rawText: "typed text" } });
    const crystRec = makeRecord({ stage: "crystallized", id: "cryst-id", source: { dataset: "the-pile", component: "pile-cc", documentId: "s:2", charOffset: [0, 16], contentHash: computeHash("crystallized text"), rawText: "crystallized text" } });
    store.insert(typedRec);
    store.insert(crystRec);

    const exporter = new PairedExporter(store);
    const count = await exporter.exportToFile(outputPath, { stages: ["typed"] });

    expect(count).toBe(1);
    const lines = readFileSync(outputPath, "utf-8").trim().split("\n");
    const parsed = JSON.parse(lines[0]) as PairedRecord;
    expect(parsed.verb_record.stage).toBe("typed");
  });

  test("S6-4: filters by crystallized stage only", async () => {
    const typedRec = makeRecord({ stage: "typed", source: { dataset: "the-pile", component: "pile-cc", documentId: "s:1", charOffset: [0, 10], contentHash: computeHash("typed text"), rawText: "typed text" } });
    const crystRec = makeRecord({ stage: "crystallized", id: "cryst-id", source: { dataset: "the-pile", component: "pile-cc", documentId: "s:2", charOffset: [0, 16], contentHash: computeHash("crystallized text"), rawText: "crystallized text" } });
    store.insert(typedRec);
    store.insert(crystRec);

    const exporter = new PairedExporter(store);
    const count = await exporter.exportToFile(outputPath, { stages: ["crystallized"] });

    expect(count).toBe(1);
    const lines = readFileSync(outputPath, "utf-8").trim().split("\n");
    const parsed = JSON.parse(lines[0]) as PairedRecord;
    expect(parsed.verb_record.stage).toBe("crystallized");
  });

  test("S6-4: exports both stages when both specified", async () => {
    const typedRec = makeRecord({ stage: "typed", source: { dataset: "the-pile", component: "pile-cc", documentId: "s:1", charOffset: [0, 10], contentHash: computeHash("typed text"), rawText: "typed text" } });
    const crystRec = makeRecord({ stage: "crystallized", id: "cryst-id", source: { dataset: "the-pile", component: "pile-cc", documentId: "s:2", charOffset: [0, 16], contentHash: computeHash("crystallized text"), rawText: "crystallized text" } });
    store.insert(typedRec);
    store.insert(crystRec);

    const exporter = new PairedExporter(store);
    const count = await exporter.exportToFile(outputPath, { stages: ["typed", "crystallized"] });

    expect(count).toBe(2);
  });

  test("exports both typed and crystallized by default", async () => {
    const typedRec = makeRecord({ stage: "typed", source: { dataset: "the-pile", component: "pile-cc", documentId: "s:1", charOffset: [0, 10], contentHash: computeHash("typed text"), rawText: "typed text" } });
    const crystRec = makeRecord({ stage: "crystallized", id: "cryst-id", source: { dataset: "the-pile", component: "pile-cc", documentId: "s:2", charOffset: [0, 16], contentHash: computeHash("crystallized text"), rawText: "crystallized text" } });
    const amorphRec = makeRecord({ stage: "amorphous", id: "amorph-id", source: { dataset: "the-pile", component: "pile-cc", documentId: "s:3", charOffset: [0, 14], contentHash: computeHash("amorphous text"), rawText: "amorphous text" } });
    store.insert(typedRec);
    store.insert(crystRec);
    store.insert(amorphRec);

    const exporter = new PairedExporter(store);
    const count = await exporter.exportToFile(outputPath);

    // Default exports typed + crystallized, not amorphous
    expect(count).toBe(2);
  });

  test("stream() yields PairedRecord objects", async () => {
    const rec = makeRecord();
    store.insert(rec);

    const exporter = new PairedExporter(store);
    const records: PairedRecord[] = [];
    for await (const pair of exporter.stream()) {
      records.push(pair);
    }

    expect(records.length).toBe(1);
    expect(records[0].source).toBe(rec.source.rawText);
    expect(records[0].verb_record.id).toBe(rec.id);
  });

  test("limit option caps exported records", async () => {
    for (let i = 0; i < 5; i++) {
      const text = `Record number ${i}`;
      store.insert(makeRecord({
        id: `id-${i}`,
        stage: "typed",
        source: { dataset: "the-pile", component: "pile-cc", documentId: `s:${i}`, charOffset: [0, text.length], contentHash: computeHash(text), rawText: text },
      }));
    }

    const exporter = new PairedExporter(store);
    const count = await exporter.exportToFile(outputPath, { limit: 3 });

    expect(count).toBe(3);
  });

  test("motifId option filters by motif", async () => {
    const rec1 = makeRecord({
      id: "motif-a",
      stage: "typed",
      motifMatch: { motifId: "M-001", confidence: 0.9, matchEvidence: "test", isNovel: false },
      source: { dataset: "the-pile", component: "pile-cc", documentId: "s:1", charOffset: [0, 6], contentHash: computeHash("text a"), rawText: "text a" },
    });
    const rec2 = makeRecord({
      id: "motif-b",
      stage: "typed",
      motifMatch: { motifId: "M-002", confidence: 0.8, matchEvidence: "test", isNovel: false },
      source: { dataset: "the-pile", component: "pile-cc", documentId: "s:2", charOffset: [0, 6], contentHash: computeHash("text b"), rawText: "text b" },
    });
    store.insert(rec1);
    store.insert(rec2);

    const exporter = new PairedExporter(store);
    const count = await exporter.exportToFile(outputPath, { motifId: "M-001" });

    expect(count).toBe(1);
    const lines = readFileSync(outputPath, "utf-8").trim().split("\n");
    const parsed = JSON.parse(lines[0]) as PairedRecord;
    expect(parsed.verb_record.motifMatch?.motifId).toBe("M-001");
  });

  test("verifyIntegrity detects hash mismatch in corrupted file", async () => {
    const rec = makeRecord();
    store.insert(rec);

    const exporter = new PairedExporter(store);
    await exporter.exportToFile(outputPath);

    // Corrupt the file: change the source text but keep the hash
    const content = readFileSync(outputPath, "utf-8");
    const parsed = JSON.parse(content.trim()) as PairedRecord;
    parsed.source = "CORRUPTED TEXT";
    const corrupted = JSON.stringify(parsed) + "\n";
    await Bun.write(outputPath, corrupted);

    const result = await exporter.verifyIntegrity(outputPath);
    expect(result.total).toBe(1);
    expect(result.mismatched).toBe(1);
    expect(result.valid).toBe(0);
  });

  test("empty store exports zero records", async () => {
    const exporter = new PairedExporter(store);
    const count = await exporter.exportToFile(outputPath);
    expect(count).toBe(0);
  });
});
