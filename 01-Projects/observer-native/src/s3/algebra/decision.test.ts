import { describe, expect, test } from "bun:test";

import { CANDIDATE_FIXTURE } from "./fixtures.ts";
import {
  ALGEBRA_DECISION_SET,
  resolveDecision,
  type DecisionResolverInput,
} from "./decision.ts";
import {
  assertAlgebraReviewGateResolved,
  createAlgebraReviewGateFromDecision,
} from "../../s7/algebra-review.ts";

function createInput(overrides: Partial<DecisionResolverInput> = {}): DecisionResolverInput {
  return {
    candidate: CANDIDATE_FIXTURE,
    targetTier: 1,
    stabilization: {
      c: {
        eligible: true,
        distinctDomainCount: 2,
        unrelatedDomainCount: 2,
        minimumDistinctDomains: 2,
        minimumUnrelatedDomains: 2,
      },
      i: {
        eligible: true,
        score: 0.86,
        threshold: 0.75,
      },
      d: {
        derivationConflict: false,
        strongestMatch: null,
        threshold: 0.9,
        notes: [],
      },
    },
    collapseSignals: [],
    ...overrides,
  };
}

describe("algebra decision resolver", () => {
  test("decision set stays inside the approved output vocabulary", () => {
    expect(ALGEBRA_DECISION_SET).toEqual([
      "reject",
      "hold_t0",
      "auto_promote_t1",
      "review_for_t2",
      "collapse_review",
    ]);
  });

  test("rejects candidates that lack structured evidence", () => {
    const candidate = {
      ...CANDIDATE_FIXTURE,
      instances: [],
    };

    const resolution = resolveDecision(createInput({ candidate }));

    expect(resolution.decision).toBe("reject");
    expect(ALGEBRA_DECISION_SET).toContain(resolution.decision);
  });

  test("auto-promotes to Tier 1 when stabilization passes without derivation conflict", () => {
    const resolution = resolveDecision(createInput());

    expect(resolution.decision).toBe("auto_promote_t1");
    expect(ALGEBRA_DECISION_SET).toContain(resolution.decision);
  });

  test("holds at Tier 0 when stabilization is insufficient", () => {
    const resolution = resolveDecision(
      createInput({
        stabilization: {
          c: {
            eligible: false,
            distinctDomainCount: 1,
            unrelatedDomainCount: 1,
            minimumDistinctDomains: 2,
            minimumUnrelatedDomains: 2,
          },
          i: {
            eligible: true,
            score: 0.86,
            threshold: 0.75,
          },
          d: {
            derivationConflict: false,
            strongestMatch: null,
            threshold: 0.9,
            notes: [],
          },
        },
      }),
    );

    expect(resolution.decision).toBe("hold_t0");
    expect(ALGEBRA_DECISION_SET).toContain(resolution.decision);
  });

  test("routes Tier 2 review through a blocked sovereignty gate with structured evidence", () => {
    const resolution = resolveDecision(createInput({ targetTier: 2 }));

    expect(resolution.decision).toBe("review_for_t2");

    const gate = createAlgebraReviewGateFromDecision(resolution);

    expect(gate.status).toBe("BLOCKED");
    expect(gate.payload.type).toBe("ALGEBRA_REVIEW");
    expect(gate.payload.evidence.candidate.name).toBe(CANDIDATE_FIXTURE.name);
    expect(gate.payload.evidence.evidenceRefs.length).toBeGreaterThan(0);
    expect(gate.payload.evidence.stabilization.i.score).toBe(0.86);
    expect(() => assertAlgebraReviewGateResolved(gate)).toThrow(/BLOCKED/);
  });

  test("emits collapse review when collapse signals are present", () => {
    const resolution = resolveDecision(
      createInput({
        collapseSignals: [
          {
            kind: "process_pathology",
            detail: "Falsifier handling degraded across the current comparison run.",
            evidence: ["candidate:constraint-field-reorganization"],
          },
        ],
      }),
    );

    expect(resolution.decision).toBe("collapse_review");
    expect(ALGEBRA_DECISION_SET).toContain(resolution.decision);
  });
});
