import { describe, expect, test } from "bun:test";

import { CANDIDATE_FIXTURE, EXISTING_MOTIF_FIXTURE } from "./fixtures.ts";
import {
  evaluatePredicateC,
  evaluatePredicateD,
  evaluatePredicateI,
  evaluateStabilization,
} from "./stabilization.ts";
import type { CandidateRecord, MotifRecord } from "./types.ts";

describe("stabilization evaluator", () => {
  describe("predicate c", () => {
    test("marks two distinct domains as eligible by default", () => {
      const result = evaluatePredicateC(CANDIDATE_FIXTURE);

      expect(result.distinctDomainCount).toBe(2);
      expect(result.eligible).toBe(true);
    });

    test("marks three distinct domains as eligible", () => {
      const threeDomainCandidate: CandidateRecord = {
        ...CANDIDATE_FIXTURE,
        instances: [
          ...CANDIDATE_FIXTURE.instances,
          {
            ...CANDIDATE_FIXTURE.instances[0],
            id: "instance:constraint-field-reorganization:ecology",
            domain: "ecological-transition",
          },
        ],
      };

      const result = evaluatePredicateC(threeDomainCandidate);

      expect(result.distinctDomainCount).toBe(3);
      expect(result.eligible).toBe(true);
    });

    test("fails a single-domain candidate", () => {
      const singleDomainCandidate: CandidateRecord = {
        ...CANDIDATE_FIXTURE,
        instances: [CANDIDATE_FIXTURE.instances[0]],
      };

      const result = evaluatePredicateC(singleDomainCandidate);

      expect(result.distinctDomainCount).toBe(1);
      expect(result.eligible).toBe(false);
    });
  });

  describe("predicate i", () => {
    test("produces deterministic scores for identical fixture input", () => {
      const first = evaluatePredicateI(CANDIDATE_FIXTURE);
      const second = evaluatePredicateI(CANDIDATE_FIXTURE);

      expect(first).toEqual(second);
      expect(first.score).toBeGreaterThan(0);
    });

    test("passes when operator and invariant overlap stay aligned", () => {
      const alignedCandidate: CandidateRecord = {
        ...CANDIDATE_FIXTURE,
        instances: [
          {
            ...CANDIDATE_FIXTURE.instances[0],
            operatorTags: ["rewrite", "branch"],
            invariants: [
              "The allowable relations reorganize while higher-scale coherence persists.",
            ],
          },
          {
            ...CANDIDATE_FIXTURE.instances[1],
            operatorTags: ["rewrite", "branch"],
            invariants: [
              "Higher-scale coherence persists while allowable relations reorganize.",
            ],
          },
        ],
      };

      const result = evaluatePredicateI(alignedCandidate);

      expect(result.stable).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(result.threshold);
    });

    test("fails when instances diverge structurally", () => {
      const divergentCandidate: CandidateRecord = {
        ...CANDIDATE_FIXTURE,
        instances: [
          {
            ...CANDIDATE_FIXTURE.instances[0],
            operatorTags: ["rewrite"],
            invariants: ["Relations are rewritten under stable global coordination."],
          },
          {
            ...CANDIDATE_FIXTURE.instances[1],
            operatorTags: ["buffer"],
            invariants: ["A local queue absorbs pressure without changing relations."],
          },
        ],
      };

      const result = evaluatePredicateI(divergentCandidate);

      expect(result.stable).toBe(false);
      expect(result.score).toBeLessThan(result.threshold);
    });
  });

  describe("predicate d", () => {
    test("flags derivation conflict when similarity crosses threshold", () => {
      const overlappingCandidate: CandidateRecord = {
        ...CANDIDATE_FIXTURE,
        name: "Dual-Speed Governance Candidate",
        invariants: [...EXISTING_MOTIF_FIXTURE.invariants],
        relationships: [],
        instances: [
          {
            ...CANDIDATE_FIXTURE.instances[0],
            operatorTags: ["gate", "converge"],
            invariants: [...EXISTING_MOTIF_FIXTURE.instances[0]!.invariants],
          },
          {
            ...CANDIDATE_FIXTURE.instances[1],
            operatorTags: ["gate", "converge"],
            invariants: [...EXISTING_MOTIF_FIXTURE.instances[0]!.invariants],
          },
        ],
      };

      const result = evaluatePredicateD(overlappingCandidate, [EXISTING_MOTIF_FIXTURE]);

      expect(result.derivationConflict).toBe(true);
      expect(result.reviewRequired).toBe(true);
      expect(result.comparisonReport.strongestMatch?.motifId).toBe(EXISTING_MOTIF_FIXTURE.id);
    });

    test("does not flag conflict for a dissimilar motif", () => {
      const result = evaluatePredicateD(CANDIDATE_FIXTURE, [EXISTING_MOTIF_FIXTURE]);

      expect(result.derivationConflict).toBe(false);
      expect(result.strongestMatchScore).toBeLessThan(result.similarityThreshold);
    });

    test("keeps ambiguous candidates reviewable without forcing conflict", () => {
      const reviewMotif: MotifRecord = {
        ...EXISTING_MOTIF_FIXTURE,
        id: "motif:field-reorganization-neighbor",
        name: "Field Reorganization Neighbor",
        invariants: [
          "The field of allowed relations is rewritten.",
          "System coherence survives the restructuring.",
        ],
        instances: [
          {
            ...EXISTING_MOTIF_FIXTURE.instances[0],
            id: "instance:field-reorganization-neighbor",
            operatorTags: ["rewrite", "branch"],
            invariants: [
              "The field of allowed relations is rewritten while coherence survives.",
            ],
          },
        ],
      };

      const result = evaluatePredicateD(CANDIDATE_FIXTURE, [reviewMotif]);

      expect(result.derivationConflict).toBe(false);
      expect(result.reviewRequired).toBe(true);
      expect(result.strongestMatchScore).toBeGreaterThanOrEqual(result.reviewThreshold);
    });
  });

  test("aggregates c, i, and d into a structured evaluation", () => {
    const result = evaluateStabilization(CANDIDATE_FIXTURE, [EXISTING_MOTIF_FIXTURE]);

    expect(result.c.kind).toBe("c");
    expect(result.i.kind).toBe("i");
    expect(result.d.kind).toBe("d");
    expect(result.d.comparisonReport.comparedAgainst).toHaveLength(1);
  });
});
