/**
 * S3 Algebra Engine — Slice 1 fixtures
 *
 * Example records proving the entity model can represent both existing
 * library motifs and session-derived candidates.
 */

import type { CandidateRecord, MotifRecord } from "./types.ts";

export const EXISTING_MOTIF_FIXTURE: MotifRecord = {
  id: "motif:dual-speed-governance",
  name: "Dual-Speed Governance",
  tier: 2,
  axisVector: {
    differentiate: 0.2,
    integrate: 0.7,
    recurse: 0.1,
  },
  derivativeOrder: 2,
  sourceType: "triangulated",
  confidence: 1.0,
  instances: [
    {
      id: "instance:dual-speed-governance:cli",
      domain: "cli-governance",
      sourceType: "triangulated",
      evidenceRefs: [
        {
          filePath: "02-Knowledge/motifs/MOTIF_INDEX.md",
          section: "Tier 2 Promoted",
          note: "Promoted with 12 domains and full validation protocol.",
        },
      ],
      operatorTags: ["gate", "converge"],
      structuralClaims: [
        "Fast and slow loops are coupled into a coherent governance regime.",
      ],
      invariants: [
        "A fast path handles execution pressure while a slower path preserves coherence.",
      ],
      falsifiers: [
        "If no meaningful separation exists between rapid execution and slow governance, the motif does not apply.",
      ],
      primaryAxis: "integrate",
    },
  ],
  invariants: [
    "Two tempos remain distinct while coordinated.",
    "The slower loop constrains the faster loop without eliminating it.",
  ],
  falsifiers: [
    "A single undifferentiated control loop explains the system equally well.",
  ],
  relationships: [
    {
      kind: "composition",
      targetMotif: "Observer-Feedback Loop",
      note: "Governance often composes with recurse-axis oversight.",
    },
  ],
};

export const CANDIDATE_FIXTURE: CandidateRecord = {
  id: "candidate:constraint-field-reorganization",
  name: "Constraint-Field Reorganization",
  tier: 0,
  axisVector: {
    differentiate: 0.2,
    integrate: 0.5,
    recurse: 0.3,
  },
  derivativeOrder: 2,
  sourceType: "session-derived",
  confidence: 0.2,
  instances: [
    {
      id: "instance:constraint-field-reorganization:biology",
      domain: "biological-metamorphosis",
      sourceType: "bottom-up",
      evidenceRefs: [
        {
          filePath: "02-Knowledge/motifs/codex-dir-metamorphosis-language-20260311.md",
          section: "D - Biological Metamorphosis",
          note: "Cell-fate transitions reshape reachable futures.",
        },
      ],
      operatorTags: ["rewrite", "branch"],
      structuralClaims: [
        "The allowable relations and trajectories are reorganized.",
      ],
      invariants: [
        "Some old configurations become unreachable while new ones become possible.",
      ],
      falsifiers: [
        "Component replacement explains the shift while constraints stay fixed.",
      ],
      primaryAxis: "recurse",
    },
    {
      id: "instance:constraint-field-reorganization:language",
      domain: "language-evolution",
      sourceType: "bottom-up",
      evidenceRefs: [
        {
          filePath: "02-Knowledge/motifs/codex-dir-metamorphosis-language-20260311.md",
          section: "D - Language Evolution",
          note: "Grammar architecture and phonological contrasts are reorganized.",
        },
      ],
      operatorTags: ["rewrite", "converge"],
      structuralClaims: [
        "The grammar of interaction changes while communicability persists.",
      ],
      invariants: [
        "The organizing field changes more than the local units alone.",
      ],
      falsifiers: [
        "Parameter drift explains the shift without changing allowable relations.",
      ],
      primaryAxis: "recurse",
    },
  ],
  invariants: [
    "The field of allowed relations is rewritten.",
    "Higher-scale coherence persists across restructuring.",
  ],
  falsifiers: [
    "The system can be explained entirely by stable relations plus local state updates.",
  ],
  relationships: [
    {
      kind: "possible_derivation",
      targetMotif: "Reflexive Structural Transition",
      note: "Requires non-derivability comparison before promotion.",
    },
  ],
  comparisonReport: {
    comparedAgainst: [],
    strongestMatch: null,
    derivationConflict: false,
    reviewRequired: false,
    notes: ["Slice 1 fixture only; no computed comparison report yet."],
  },
  normalizationWarnings: [],
};
