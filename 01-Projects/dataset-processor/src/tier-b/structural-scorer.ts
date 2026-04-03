/**
 * Structural Scorer — scores structural match of a parsed passage
 * against motif signatures.
 *
 * Takes SpacyParseResult + candidate passage info and evaluates:
 * 1. Process relationship density and quality
 * 2. Temporal structure (sequential, concurrent, cyclic, recursive)
 * 3. Governance relationship presence
 * 4. Operator matching against motif algebra
 *
 * Genuine process descriptions (with agent-action-patient structure,
 * temporal ordering, governance patterns) score higher than passages
 * with mere keyword co-occurrence.
 */

import type {
  SpacyParseResult,
  ProcessRelationship,
  GovernanceRelationship,
} from "./spacy-bridge.ts";
import { INDICATOR_SETS, type IndicatorSet } from "../filter/indicator-sets.ts";

// ── Public types ────────────────────────────────────────────────────────────

export interface StructuralScore {
  overallScore: number; // 0.0-1.0
  processRelationshipScore: number;
  temporalStructureScore: number;
  governanceScore: number;
  processDescription: string; // Extracted process shape description
  operators: string[]; // Matched algebra operators
  temporalStructure:
    | "sequential"
    | "concurrent"
    | "cyclic"
    | "recursive"
    | undefined;
}

// ── Motif-to-operator mapping ───────────────────────────────────────────────

/**
 * Maps motif IDs to expected structural operators.
 * These represent the "algebra" of each motif — what structural
 * patterns we expect to find in genuine instances.
 */
const MOTIF_OPERATORS: Record<string, string[]> = {
  // Tier 2
  DSG: ["bifurcate", "oscillate", "constrain", "delegate"],
  CPA: ["compose", "register", "dispatch", "extend"],
  ESMB: ["transition", "guard", "enumerate", "validate"],
  BBWOP: ["buffer", "overflow", "evict", "throttle"],
  ISC: ["converge", "reconcile", "detect", "correct"],
  OFL: ["observe", "modify", "reflect", "recurse"],
  RAF: ["accumulate", "lock", "constrain", "resist"],
  PF: ["refine", "stage", "crystallize", "promote"],
  RB: ["compress", "lose", "reconstruct", "degrade"],
  // Tier 1
  TAC: ["curate", "rank", "endorse", "filter"],
  RST: ["dissolve", "transform", "shed", "reorganize"],
  BD: ["erode", "blur", "shift", "creep"],
  SCGS: ["couple", "adapt", "entangle", "constrain"],
  SLD: ["guarantee", "deadlock", "starve", "invariant"],
  RG: ["generate", "bootstrap", "scaffold", "emerge"],
  PSR: ["refer", "describe", "fixpoint", "introspect"],
  TDC: ["classify", "template", "label", "categorize"],
  SFA: ["scaffold", "skeleton", "prototype", "bootstrap"],
  // Tier 1 compositions
  CDRI: ["integrate", "recurse", "transfer", "borrow"],
};

// ── Temporal structure detection ────────────────────────────────────────────

const SEQUENTIAL_MARKERS = new Set([
  "then", "next", "subsequently", "after", "before",
  "finally", "first", "second", "third", "lastly",
  "afterward", "following",
]);

const CONCURRENT_MARKERS = new Set([
  "while", "during", "meanwhile", "simultaneously",
  "concurrently", "parallel", "at the same time",
]);

const CYCLIC_MARKERS = new Set([
  "again", "repeatedly", "cycle", "loop", "iterate",
  "periodic", "recurring", "return", "repeat",
]);

const RECURSIVE_MARKERS = new Set([
  "self", "recursive", "meta", "nested", "self-referential",
  "reflexive", "introspect",
]);

/**
 * Detect the dominant temporal structure from connectors and tokens.
 */
function detectTemporalStructure(
  connectors: string[],
  tokenTexts: string[],
): "sequential" | "concurrent" | "cyclic" | "recursive" | undefined {
  const allTerms = new Set([
    ...connectors.map((c) => c.toLowerCase()),
    ...tokenTexts.map((t) => t.toLowerCase()),
  ]);

  // Score each temporal structure type
  let seqScore = 0;
  let concScore = 0;
  let cycScore = 0;
  let recScore = 0;

  for (const term of allTerms) {
    if (SEQUENTIAL_MARKERS.has(term)) seqScore++;
    if (CONCURRENT_MARKERS.has(term)) concScore++;
    if (CYCLIC_MARKERS.has(term)) cycScore++;
    if (RECURSIVE_MARKERS.has(term)) recScore++;
  }

  const maxScore = Math.max(seqScore, concScore, cycScore, recScore);
  if (maxScore === 0) return undefined;

  // Recursive > Cyclic > Concurrent > Sequential (specificity ordering)
  if (recScore === maxScore && recScore >= 2) return "recursive";
  if (cycScore === maxScore && cycScore >= 2) return "cyclic";
  if (concScore === maxScore && concScore >= 2) return "concurrent";
  if (seqScore === maxScore && seqScore >= 1) return "sequential";

  return undefined;
}

// ── Operator matching ───────────────────────────────────────────────────────

/**
 * Match operators from the parse against expected motif operators.
 * Looks at verb lemmas and relationship actions for matches.
 */
function matchOperators(
  parse: SpacyParseResult,
  motifId: string,
): string[] {
  const expectedOps = MOTIF_OPERATORS[motifId] ?? [];
  if (expectedOps.length === 0) return [];

  // Collect all verb-like tokens and relationship actions
  const verbActions = new Set<string>();
  for (const token of parse.tokens) {
    if (token.pos === "VERB") {
      verbActions.add(token.text.toLowerCase());
    }
  }
  for (const rel of parse.processRelationships) {
    verbActions.add(rel.action.toLowerCase());
  }
  for (const gov of parse.governanceRelationships) {
    verbActions.add(gov.mechanism.toLowerCase());
  }

  // Match against expected operators via prefix/stem matching
  const matched: string[] = [];
  for (const op of expectedOps) {
    for (const verb of verbActions) {
      // Match if the verb starts with the operator stem (e.g., "constrain" matches "constrains")
      if (verb.startsWith(op.slice(0, Math.min(op.length, 5))) || op.startsWith(verb.slice(0, Math.min(verb.length, 5)))) {
        matched.push(op);
        break;
      }
    }
  }

  return matched;
}

// ── Process description generation ──────────────────────────────────────────

/**
 * Generate a concise process shape description from extracted relationships.
 */
function describeProcessShape(
  relationships: ProcessRelationship[],
  governanceRels: GovernanceRelationship[],
  temporalStructure: string | undefined,
): string {
  const parts: string[] = [];

  if (relationships.length > 0) {
    // Take top 3 relationships for the description
    const topRels = relationships.slice(0, 3);
    const relDescriptions = topRels.map(
      (r) => `${r.agent} ${r.action} ${r.patient}`,
    );
    parts.push(`Process: ${relDescriptions.join("; ")}`);
  }

  if (governanceRels.length > 0) {
    const govDesc = governanceRels
      .slice(0, 2)
      .map((g) => `${g.governor} ${g.mechanism} ${g.governed}`);
    parts.push(`Governance: ${govDesc.join("; ")}`);
  }

  if (temporalStructure) {
    parts.push(`Temporal: ${temporalStructure}`);
  }

  if (parts.length === 0) {
    return "No structural process detected";
  }

  return parts.join(" | ");
}

// ── Scoring functions ───────────────────────────────────────────────────────

/**
 * Score process relationship density and quality.
 *
 * Higher scores for:
 * - More agent-action-patient triples
 * - Diverse relationship types
 * - Relationships that match motif patterns
 */
function scoreProcessRelationships(
  relationships: ProcessRelationship[],
  motifId: string,
): number {
  if (relationships.length === 0) return 0;

  // Density: more relationships = higher score, with diminishing returns
  const densityScore = Math.min(relationships.length / 5, 1.0);

  // Diversity: different relationship types = higher score
  const types = new Set(relationships.map((r) => r.type));
  const diversityScore = types.size / 4; // 4 possible types

  // Motif alignment: governance relationships boost governance motifs, etc.
  let alignmentBonus = 0;
  const indicator = INDICATOR_SETS.find((s) => s.motifId === motifId);
  if (indicator) {
    // Governance motifs (integrate axis) benefit from governance relationships
    if (indicator.axis === "integrate" && types.has("governance")) {
      alignmentBonus = 0.15;
    }
    // Recurse axis motifs benefit from causal chains
    if (indicator.axis === "recurse" && types.has("causal")) {
      alignmentBonus = 0.1;
    }
  }

  return Math.min(
    densityScore * 0.5 + diversityScore * 0.3 + alignmentBonus + 0.2 * Math.min(densityScore, 0.5),
    1.0,
  );
}

/**
 * Score temporal structure match against what the motif expects.
 */
function scoreTemporalStructure(
  connectors: string[],
  tokenTexts: string[],
  motifId: string,
): { score: number; structure: "sequential" | "concurrent" | "cyclic" | "recursive" | undefined } {
  const structure = detectTemporalStructure(connectors, tokenTexts);

  if (!structure) {
    return { score: 0, structure: undefined };
  }

  // Base score from having any temporal structure
  let score = 0.3;

  // Connector density bonus
  const connectorDensity = Math.min(connectors.length / 4, 1.0);
  score += connectorDensity * 0.3;

  // Motif alignment bonus
  const indicator = INDICATOR_SETS.find((s) => s.motifId === motifId);
  if (indicator) {
    // Higher derivative orders expect more complex temporal structures
    if (indicator.derivativeOrder >= 2 && (structure === "cyclic" || structure === "recursive")) {
      score += 0.2;
    }
    if (indicator.axis === "recurse" && structure === "recursive") {
      score += 0.2;
    }
    if (indicator.axis === "integrate" && (structure === "sequential" || structure === "cyclic")) {
      score += 0.1;
    }
  }

  return { score: Math.min(score, 1.0), structure };
}

/**
 * Score governance relationship presence and quality.
 */
function scoreGovernance(
  governanceRels: GovernanceRelationship[],
  motifId: string,
): number {
  if (governanceRels.length === 0) return 0;

  // Base score from having governance relationships
  let score = 0.3;

  // More governance relationships = higher score (with diminishing returns)
  score += Math.min(governanceRels.length / 3, 0.4);

  // Motif alignment: governance-heavy motifs (DSG, ISC) get bonus
  const governanceMotifs = new Set(["DSG", "ISC", "SLD", "SCGS", "TAC"]);
  if (governanceMotifs.has(motifId)) {
    score += 0.3;
  }

  return Math.min(score, 1.0);
}

// ── Main scoring function ───────────────────────────────────────────────────

/**
 * Score the structural match of a parsed passage against a motif.
 *
 * This is the Tier B scoring function. It evaluates whether the passage
 * contains genuine process structure (agent-action-patient relationships,
 * temporal ordering, governance patterns) that aligns with the motif's
 * expected shape — rather than just keyword co-occurrence (Tier A).
 */
export function scoreStructuralMatch(
  parse: SpacyParseResult,
  motifId: string,
  _candidateText: string,
): StructuralScore {
  const tokenTexts = parse.tokens.map((t) => t.text);

  // Score components
  const processRelationshipScore = scoreProcessRelationships(
    parse.processRelationships,
    motifId,
  );

  const { score: temporalStructureScore, structure: temporalStructure } =
    scoreTemporalStructure(parse.temporalConnectors, tokenTexts, motifId);

  const governanceScore = scoreGovernance(
    parse.governanceRelationships,
    motifId,
  );

  // Match operators
  const operators = matchOperators(parse, motifId);

  // Operator match bonus
  const expectedOps = MOTIF_OPERATORS[motifId] ?? [];
  const operatorScore =
    expectedOps.length > 0 ? operators.length / expectedOps.length : 0;

  // Generate process description
  const processDescription = describeProcessShape(
    parse.processRelationships,
    parse.governanceRelationships,
    temporalStructure,
  );

  // Overall score: weighted combination
  // Process relationships are the strongest signal (they distinguish
  // genuine process descriptions from keyword co-occurrence)
  const overallScore = Math.min(
    processRelationshipScore * 0.35 +
      temporalStructureScore * 0.20 +
      governanceScore * 0.20 +
      operatorScore * 0.25,
    1.0,
  );

  return {
    overallScore,
    processRelationshipScore,
    temporalStructureScore,
    governanceScore,
    processDescription,
    operators,
    temporalStructure,
  };
}
