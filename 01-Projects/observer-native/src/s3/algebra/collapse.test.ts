import { describe, expect, test } from "bun:test";

import { CANDIDATE_FIXTURE } from "./fixtures.ts";
import {
  DEFAULT_PROCESS_PATHOLOGY_THRESHOLD,
  detectCollapseReview,
} from "./collapse.ts";
import type { CandidateRecord } from "./types.ts";

function makeCandidate(overrides?: Partial<CandidateRecord>): CandidateRecord {
  return {
    ...structuredClone(CANDIDATE_FIXTURE),
    ...overrides,
    comparisonReport: {
      ...structuredClone(CANDIDATE_FIXTURE.comparisonReport),
      ...overrides?.comparisonReport,
    },
  };
}

describe("collapse review detection", () => {
  test("emits collapse_review for derivation conflicts", () => {
    const candidate = makeCandidate({
      comparisonReport: {
        ...CANDIDATE_FIXTURE.comparisonReport,
        derivationConflict: true,
      },
    });

    const result = detectCollapseReview({ candidate });

    expect(result).toMatchObject({
      decision: "collapse_review",
      triggered: true,
      reasons: ["derivation_conflict"],
    });
  });

  test("emits collapse_review for failed falsification signals", () => {
    const result = detectCollapseReview({
      candidate: makeCandidate(),
      failedFalsificationSignals: ["counterexample persisted"],
    });

    expect(result).toMatchObject({
      decision: "collapse_review",
      triggered: true,
      reasons: ["failed_falsification"],
    });
  });

  test("emits collapse_review when process pathology indicators meet threshold", () => {
    const result = detectCollapseReview({
      candidate: makeCandidate(),
      processPathologyIndicators: ["goal drift", "evidence laundering"],
    });

    expect(result).toMatchObject({
      decision: "collapse_review",
      triggered: true,
      reasons: ["process_pathology"],
    });
    expect(DEFAULT_PROCESS_PATHOLOGY_THRESHOLD).toBe(2);
  });

  test("does not trigger collapse_review for routine ambiguity alone", () => {
    const result = detectCollapseReview({
      candidate: makeCandidate(),
      routineAmbiguitySignals: ["boundary still unclear", "naming remains rough"],
      processPathologyIndicators: ["single rough edge"],
    });

    expect(result).toMatchObject({
      decision: null,
      triggered: false,
      reasons: [],
    });
    expect(result.notes[0]).toContain("Routine ambiguity observed");
  });

  test("combines multiple collapse reasons without mutating the candidate", () => {
    const candidate = makeCandidate({
      comparisonReport: {
        ...CANDIDATE_FIXTURE.comparisonReport,
        derivationConflict: true,
      },
    });
    const before = structuredClone(candidate);

    const result = detectCollapseReview({
      candidate,
      failedFalsificationSignals: ["counterexample persisted", "counterexample persisted"],
      processPathologyIndicators: ["goal drift", "evidence laundering", "goal drift"],
    });

    expect(result).toMatchObject({
      decision: "collapse_review",
      triggered: true,
      reasons: [
        "derivation_conflict",
        "failed_falsification",
        "process_pathology",
      ],
    });
    expect(candidate).toEqual(before);
  });
});
