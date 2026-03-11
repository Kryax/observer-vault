import { describe, expect, test } from "bun:test";

import {
  ALGEBRA_OPERATORS,
  CANDIDATE_FIXTURE,
  EXISTING_MOTIF_FIXTURE,
} from "./index.ts";

describe("algebra foundation types", () => {
  test("operator vocabulary v0 is exact and ordered", () => {
    expect(ALGEBRA_OPERATORS).toEqual([
      "rewrite",
      "align",
      "compress",
      "dissolve",
      "scaffold",
      "reconstitute",
      "branch",
      "gate",
      "buffer",
      "converge",
    ]);
  });

  test("existing motif fixture is representable without ad hoc fields", () => {
    expect(EXISTING_MOTIF_FIXTURE.name).toBe("Dual-Speed Governance");
    expect(EXISTING_MOTIF_FIXTURE.instances.length).toBeGreaterThan(0);
    expect(EXISTING_MOTIF_FIXTURE.relationships[0]?.kind).toBe("composition");
  });

  test("candidate fixture includes comparison report and warnings", () => {
    expect(CANDIDATE_FIXTURE.name).toBe("Constraint-Field Reorganization");
    expect(CANDIDATE_FIXTURE.comparisonReport.strongestMatch).toBeNull();
    expect(CANDIDATE_FIXTURE.normalizationWarnings).toEqual([]);
  });
});
