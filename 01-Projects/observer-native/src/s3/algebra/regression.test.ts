import { describe, expect, test } from "bun:test";

import { evaluateCodexRegression } from "./regression.ts";

describe("codex regression fixture", () => {
  test("evaluates the three Codex motif candidates end-to-end", () => {
    const evaluations = evaluateCodexRegression();

    expect(evaluations).toHaveLength(3);

    const byName = new Map(evaluations.map((entry) => [entry.candidate.name, entry]));

    const constraintField = byName.get("Constraint-Field Reorganization");
    expect(constraintField).toBeDefined();
    expect(constraintField?.decision.decision).not.toBe("review_for_t2");
    expect(constraintField?.decision.decision).not.toBe("reject");

    const scaffolded = byName.get("Scaffolded Reconstitution Through Selective Loss");
    expect(scaffolded).toBeDefined();
    const scaffoldedDecision = scaffolded?.decision.decision;
    expect(scaffoldedDecision).toBeDefined();
    expect(["collapse_review", "review_for_t2", "hold_t0"]).toContain(
      scaffoldedDecision as string,
    );
    expect(
      scaffolded?.candidate.comparisonReport.derivationConflict ||
        scaffolded?.decision.decision === "collapse_review",
    ).toBe(true);

    const alignment = byName.get("Alignment by Compression");
    expect(alignment).toBeDefined();
    expect(alignment?.decision.decision).not.toBe("review_for_t2");
    expect(alignment?.decision.targetTier).toBe(1);
  });
});
