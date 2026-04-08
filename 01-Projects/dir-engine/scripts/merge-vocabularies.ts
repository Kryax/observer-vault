#!/usr/bin/env bun
/**
 * Merge dataset-processor indicator sets into dir-engine vocabulary.json.
 *
 * Axis mapping: differentiate=0(D), integrate=1(I), recurse=2(R)
 *
 * Sources:
 * 1. dataset-processor indicator-sets.ts (22 motifs, ~260 indicators)
 * 2. dataset-processor structural-scorer.ts (operators, temporal markers)
 * 3. dataset-processor model-evaluator.ts (valid operators)
 */

import { resolve } from "node:path";

const DATA_DIR = resolve(import.meta.dir, "..", "data");
const VOCAB_PATH = resolve(DATA_DIR, "vocabulary.json");
const BACKUP_PATH = resolve(DATA_DIR, "vocabulary-v1-228.json");

// ── Load existing vocabulary ───────────────────────────────────────────────
const existing = JSON.parse(await Bun.file(VOCAB_PATH).text());
console.log(`\n=== Vocabulary Merge ===`);
console.log(`Existing indicators: ${existing.indicators.length}`);

// Index existing by term (lowercase) for dedup
const existingMap = new Map<string, { term: string; weight: number; axis: number }>();
for (const ind of existing.indicators) {
  existingMap.set(ind.term.toLowerCase(), ind);
}

// ── Axis mapping ───────────────────────────────────────────────────────────
const AXIS_MAP: Record<string, number> = {
  differentiate: 0,
  integrate: 1,
  recurse: 2,
};

// ── Dataset-processor indicator sets ───────────────────────────────────────
// Inline the indicators from indicator-sets.ts (already read, structured data)
const INDICATOR_SETS = [
  { motifId: "DSG", axis: "integrate", indicators: [
    { term: "framework", weight: 0.4 }, { term: "policy", weight: 0.4 },
    { term: "deliberate", weight: 0.4 }, { term: "autonomous", weight: 0.4 },
  ]},
  { motifId: "CPA", axis: "differentiate", indicators: [
    { term: "module", weight: 0.3 }, { term: "interface", weight: 0.3 },
    { term: "component", weight: 0.3 },
  ]},
  { motifId: "ESMB", axis: "differentiate", indicators: [
    { term: "enumerated states", weight: 0.9 }, { term: "transition", weight: 0.4 },
    { term: "lifecycle", weight: 0.4 },
  ]},
  { motifId: "BBWOP", axis: "differentiate", indicators: [
    { term: "buffer", weight: 0.4 }, { term: "queue", weight: 0.3 },
    { term: "capacity", weight: 0.4 }, { term: "spill", weight: 0.5 },
    { term: "drop", weight: 0.3 },
  ]},
  { motifId: "ISC", axis: "integrate", indicators: [
    { term: "drift", weight: 0.5 }, { term: "apply repeatedly", weight: 0.8 },
  ]},
  { motifId: "OFL", axis: "recurse", indicators: [
    { term: "observer", weight: 0.3 }, { term: "lens", weight: 0.3 },
  ]},
  { motifId: "RAF", axis: "recurse", indicators: [
    { term: "one-way", weight: 0.5 }, { term: "asymmetric", weight: 0.5 },
    { term: "accumulate", weight: 0.3 }, { term: "legacy", weight: 0.4 },
    { term: "sticky", weight: 0.4 },
  ]},
  { motifId: "PF", axis: "integrate", indicators: [
    { term: "progressive", weight: 0.4 }, { term: "mature", weight: 0.4 },
    { term: "refine", weight: 0.4 }, { term: "draft", weight: 0.3 },
    { term: "iterate", weight: 0.3 }, { term: "stages", weight: 0.3 },
    { term: "lifecycle", weight: 0.4 },
  ]},
  { motifId: "RB", axis: "differentiate", indicators: [
    { term: "compression", weight: 0.5 }, { term: "fidelity", weight: 0.5 },
    { term: "resolution", weight: 0.3 }, { term: "sampling", weight: 0.4 },
    { term: "boundary", weight: 0.3 },
  ]},
  { motifId: "TAC", axis: "integrate", indicators: [
    { term: "trust", weight: 0.5 }, { term: "reliability", weight: 0.4 },
    { term: "earned", weight: 0.3 }, { term: "merit", weight: 0.4 },
    { term: "ranking", weight: 0.4 }, { term: "score", weight: 0.3 },
  ]},
  { motifId: "RST", axis: "recurse", indicators: [
    { term: "reorganization", weight: 0.5 }, { term: "shedding", weight: 0.6 },
  ]},
  { motifId: "BD", axis: "differentiate", indicators: [
    { term: "erosion", weight: 0.5 }, { term: "blurring", weight: 0.6 },
    { term: "distinction", weight: 0.4 }, { term: "category", weight: 0.3 },
    { term: "classification", weight: 0.4 }, { term: "ambiguity", weight: 0.4 },
    { term: "boundary", weight: 0.3 }, { term: "drift", weight: 0.4 },
  ]},
  { motifId: "SCGS", axis: "integrate", indicators: [
    { term: "coupling", weight: 0.4 }, { term: "entanglement", weight: 0.6 },
    { term: "interoperability", weight: 0.5 }, { term: "dependency", weight: 0.3 },
  ]},
  { motifId: "SLD", axis: "differentiate", indicators: [
    { term: "invariant", weight: 0.5 }, { term: "guarantee", weight: 0.4 },
    { term: "correctness", weight: 0.4 }, { term: "availability", weight: 0.4 },
    { term: "consistency", weight: 0.3 }, { term: "progress", weight: 0.3 },
    { term: "safety", weight: 0.3 },
  ]},
  { motifId: "RG", axis: "recurse", indicators: [
    { term: "generative", weight: 0.6 }, { term: "emergent", weight: 0.5 },
    { term: "bootstrap", weight: 0.5 },
  ]},
  { motifId: "PSR", axis: "recurse", indicators: [
    { term: "self-aware", weight: 0.6 }, { term: "identity", weight: 0.3 },
  ]},
  { motifId: "TDC", axis: "differentiate", indicators: [
    { term: "template", weight: 0.5 }, { term: "schema", weight: 0.5 },
    { term: "labeling", weight: 0.5 }, { term: "tagging", weight: 0.5 },
  ]},
  { motifId: "SFA", axis: "differentiate", indicators: [
    { term: "prototype", weight: 0.5 }, { term: "foundation", weight: 0.4 },
    { term: "skeleton code", weight: 0.8 },
  ]},
  { motifId: "CDRI", axis: "integrate", indicators: [
    { term: "learning to learn", weight: 0.9 }, { term: "cross-domain recursion", weight: 1.0 },
    { term: "structural borrowing", weight: 0.8 }, { term: "recursive across levels", weight: 0.8 },
    { term: "recursive integration", weight: 0.9 }, { term: "recursive across domains", weight: 1.0 },
    { term: "self-similar across", weight: 0.8 }, { term: "homology", weight: 0.5 },
    { term: "co-homology", weight: 0.7 }, { term: "isomorphism", weight: 0.5 },
  ]},
  { motifId: "CU", axis: "integrate", indicators: [
    { term: "explanatory power", weight: 0.6 }, { term: "common structure", weight: 0.6 },
    { term: "unifying framework", weight: 0.7 },
  ]},
  { motifId: "PBR", axis: "differentiate", indicators: [
    { term: "categorisation", weight: 0.6 }, { term: "classification system", weight: 0.5 },
    { term: "reframe", weight: 0.5 },
  ]},
  { motifId: "TAM", axis: "integrate", indicators: [
    { term: "sympathetic", weight: 0.6 }, { term: "oscillation", weight: 0.4 },
    { term: "alternation", weight: 0.5 }, { term: "exploitation", weight: 0.4 },
    { term: "exploration", weight: 0.4 },
  ]},
  { motifId: "PEPS", axis: "recurse", indicators: [
    { term: "surprise", weight: 0.6 }, { term: "mismatch", weight: 0.5 },
    { term: "expectation", weight: 0.4 }, { term: "update", weight: 0.3 },
  ]},
  { motifId: "HSSFS", axis: "differentiate", indicators: [
    { term: "latent", weight: 0.5 }, { term: "phenotype", weight: 0.5 },
    { term: "genotype", weight: 0.5 }, { term: "manifest", weight: 0.4 },
    { term: "observable", weight: 0.3 },
  ]},
  { motifId: "ECS", axis: "differentiate", indicators: [
    { term: "observer pattern", weight: 0.8 }, { term: "estimator", weight: 0.6 },
    { term: "controller", weight: 0.4 }, { term: "hidden state", weight: 0.6 },
    { term: "infer", weight: 0.3 },
  ]},
  { motifId: "DTR", axis: "recurse", indicators: [
    { term: "regularization", weight: 0.6 }, { term: "simplification", weight: 0.5 },
    { term: "regularity", weight: 0.5 }, { term: "erosion", weight: 0.4 },
  ]},
  { motifId: "PC", axis: "recurse", indicators: [
    { term: "burst", weight: 0.5 }, { term: "discontinuous", weight: 0.5 },
    { term: "breakthrough", weight: 0.4 }, { term: "gestation", weight: 0.6 },
  ]},
  { motifId: "RRT", axis: "integrate", indicators: [
    { term: "redundancy", weight: 0.6 }, { term: "resilience", weight: 0.5 },
    { term: "overhead", weight: 0.4 }, { term: "parity", weight: 0.6 },
    { term: "checksum", weight: 0.7 },
  ]},
  { motifId: "NSSH", axis: "recurse", indicators: [
    { term: "hierarchical", weight: 0.4 }, { term: "nested", weight: 0.4 },
    { term: "levels of organization", weight: 0.7 },
  ]},
  { motifId: "PUE", axis: "integrate", indicators: [
    { term: "covariance", weight: 0.7 }, { term: "posterior", weight: 0.5 },
    { term: "tube", weight: 0.4 }, { term: "ensemble", weight: 0.5 },
  ]},
  { motifId: "KRHS", axis: "integrate", indicators: [
    { term: "candidate generation", weight: 0.7 }, { term: "survivor", weight: 0.5 },
    { term: "pruning", weight: 0.5 }, { term: "false positive", weight: 0.4 },
  ]},
  { motifId: "IBP", axis: "differentiate", indicators: [
    { term: "instrumentation", weight: 0.7 }, { term: "probe", weight: 0.5 },
    { term: "monitoring", weight: 0.4 }, { term: "visibility", weight: 0.4 },
    { term: "build the test harness first", weight: 0.9 }, { term: "sensor", weight: 0.4 },
  ]},
];

// ── Structural operators from structural-scorer.ts ─────────────────────────
// These are process verbs that appear in the corpus — add as low-weight indicators
const STRUCTURAL_OPERATORS: Array<{ term: string; weight: number; axis: number }> = [
  // D-axis operators (differentiate)
  { term: "bifurcate", weight: 0.5, axis: 0 },
  { term: "compose", weight: 0.4, axis: 0 },
  { term: "register", weight: 0.3, axis: 0 },
  { term: "dispatch", weight: 0.4, axis: 0 },
  { term: "extend", weight: 0.3, axis: 0 },
  { term: "guard", weight: 0.4, axis: 0 },
  { term: "enumerate", weight: 0.3, axis: 0 },
  { term: "validate", weight: 0.4, axis: 0 },
  { term: "compress", weight: 0.4, axis: 0 },
  { term: "reconstruct", weight: 0.5, axis: 0 },
  { term: "degrade", weight: 0.4, axis: 0 },
  { term: "classify", weight: 0.4, axis: 0 },
  { term: "decompose", weight: 0.5, axis: 0 },
  { term: "erode", weight: 0.4, axis: 0 },
  { term: "blur", weight: 0.3, axis: 0 },
  { term: "shift", weight: 0.3, axis: 0 },
  { term: "creep", weight: 0.3, axis: 0 },
  { term: "prototype", weight: 0.4, axis: 0 },
  // I-axis operators (integrate)
  { term: "oscillate", weight: 0.5, axis: 1 },
  { term: "delegate", weight: 0.4, axis: 1 },
  { term: "correct", weight: 0.4, axis: 1 },
  { term: "detect", weight: 0.3, axis: 1 },
  { term: "refine", weight: 0.4, axis: 1 },
  { term: "stage", weight: 0.3, axis: 1 },
  { term: "promote", weight: 0.4, axis: 1 },
  { term: "couple", weight: 0.4, axis: 1 },
  { term: "adapt", weight: 0.4, axis: 1 },
  { term: "constrain", weight: 0.4, axis: 1 },
  { term: "rank", weight: 0.3, axis: 1 },
  { term: "endorse", weight: 0.4, axis: 1 },
  { term: "filter", weight: 0.3, axis: 1 },
  { term: "integrate", weight: 0.4, axis: 1 },
  { term: "transfer", weight: 0.3, axis: 1 },
  { term: "borrow", weight: 0.3, axis: 1 },
  { term: "converge", weight: 0.5, axis: 1 },
  { term: "synthesize", weight: 0.5, axis: 1 },
  { term: "unify", weight: 0.4, axis: 1 },
  { term: "merge", weight: 0.3, axis: 1 },
  // R-axis operators (recurse)
  { term: "observe", weight: 0.3, axis: 2 },
  { term: "modify", weight: 0.3, axis: 2 },
  { term: "reflect", weight: 0.5, axis: 2 },
  { term: "recurse", weight: 0.6, axis: 2 },
  { term: "accumulate", weight: 0.4, axis: 2 },
  { term: "lock", weight: 0.3, axis: 2 },
  { term: "resist", weight: 0.3, axis: 2 },
  { term: "dissolve", weight: 0.4, axis: 2 },
  { term: "transform", weight: 0.4, axis: 2 },
  { term: "shed", weight: 0.3, axis: 2 },
  { term: "reorganize", weight: 0.4, axis: 2 },
  { term: "generate", weight: 0.4, axis: 2 },
  { term: "emerge", weight: 0.4, axis: 2 },
  { term: "bootstrap", weight: 0.4, axis: 2 },
  { term: "fixpoint", weight: 0.6, axis: 2 },
  { term: "introspect", weight: 0.5, axis: 2 },
  { term: "self-modify", weight: 0.7, axis: 2 },
  { term: "iterate", weight: 0.3, axis: 2 },
  { term: "feedback", weight: 0.5, axis: 2 },
  { term: "evolve", weight: 0.4, axis: 2 },
];

// ── General D/I/R indicators (broad coverage terms) ────────────────────────
// These are common terms that should help classify the 65% currently missed
const GENERAL_INDICATORS: Array<{ term: string; weight: number; axis: number }> = [
  // D-axis: describing, differentiating, structural
  { term: "define", weight: 0.3, axis: 0 },
  { term: "describe", weight: 0.3, axis: 0 },
  { term: "identify", weight: 0.3, axis: 0 },
  { term: "distinguish", weight: 0.4, axis: 0 },
  { term: "separate", weight: 0.4, axis: 0 },
  { term: "divide", weight: 0.3, axis: 0 },
  { term: "partition", weight: 0.5, axis: 0 },
  { term: "segment", weight: 0.4, axis: 0 },
  { term: "delineate", weight: 0.5, axis: 0 },
  { term: "differentiate", weight: 0.5, axis: 0 },
  { term: "analyze", weight: 0.3, axis: 0 },
  { term: "structure", weight: 0.3, axis: 0 },
  { term: "architecture", weight: 0.4, axis: 0 },
  { term: "pattern", weight: 0.3, axis: 0 },
  { term: "abstraction", weight: 0.4, axis: 0 },
  { term: "hierarchy", weight: 0.4, axis: 0 },
  { term: "layer", weight: 0.3, axis: 0 },
  { term: "encapsulate", weight: 0.5, axis: 0 },
  { term: "isolate", weight: 0.4, axis: 0 },
  { term: "decouple", weight: 0.5, axis: 0 },
  { term: "modularize", weight: 0.5, axis: 0 },
  { term: "specification", weight: 0.4, axis: 0 },
  { term: "schema", weight: 0.4, axis: 0 },
  { term: "formulation", weight: 0.4, axis: 0 },
  { term: "operationalize", weight: 0.5, axis: 0 },
  // I-axis: integrating, synthesizing, connecting
  { term: "combine", weight: 0.3, axis: 1 },
  { term: "aggregate", weight: 0.4, axis: 1 },
  { term: "coordinate", weight: 0.4, axis: 1 },
  { term: "orchestrate", weight: 0.5, axis: 1 },
  { term: "harmonize", weight: 0.5, axis: 1 },
  { term: "reconciliation", weight: 0.5, axis: 1 },
  { term: "alignment", weight: 0.3, axis: 1 },
  { term: "consensus", weight: 0.5, axis: 1 },
  { term: "consolidate", weight: 0.4, axis: 1 },
  { term: "normalize", weight: 0.4, axis: 1 },
  { term: "standardize", weight: 0.4, axis: 1 },
  { term: "calibrate", weight: 0.4, axis: 1 },
  { term: "regulate", weight: 0.4, axis: 1 },
  { term: "optimize", weight: 0.3, axis: 1 },
  { term: "balance", weight: 0.3, axis: 1 },
  { term: "trade-off", weight: 0.4, axis: 1 },
  { term: "tradeoff", weight: 0.4, axis: 1 },
  { term: "negotiate", weight: 0.4, axis: 1 },
  { term: "mediate", weight: 0.4, axis: 1 },
  { term: "bridge", weight: 0.3, axis: 1 },
  { term: "connect", weight: 0.3, axis: 1 },
  { term: "interplay", weight: 0.4, axis: 1 },
  { term: "interdependence", weight: 0.5, axis: 1 },
  { term: "mutual", weight: 0.3, axis: 1 },
  { term: "collective", weight: 0.3, axis: 1 },
  // R-axis: recursive, reflexive, meta
  { term: "recursive", weight: 0.5, axis: 2 },
  { term: "self-organize", weight: 0.6, axis: 2 },
  { term: "adaptation", weight: 0.4, axis: 2 },
  { term: "self-correct", weight: 0.6, axis: 2 },
  { term: "self-regulate", weight: 0.6, axis: 2 },
  { term: "emergence", weight: 0.5, axis: 2 },
  { term: "coevolution", weight: 0.6, axis: 2 },
  { term: "reflexivity", weight: 0.6, axis: 2 },
  { term: "meta-", weight: 0.3, axis: 2 },
  { term: "second-order", weight: 0.5, axis: 2 },
  { term: "third-order", weight: 0.6, axis: 2 },
  { term: "generative", weight: 0.4, axis: 2 },
  { term: "self-sustaining", weight: 0.5, axis: 2 },
  { term: "self-perpetuating", weight: 0.5, axis: 2 },
  { term: "reproduction", weight: 0.4, axis: 2 },
  { term: "replication", weight: 0.4, axis: 2 },
  { term: "propagation", weight: 0.4, axis: 2 },
  { term: "amplification", weight: 0.4, axis: 2 },
  { term: "damping", weight: 0.4, axis: 2 },
  { term: "attractor", weight: 0.6, axis: 2 },
  { term: "basin of attraction", weight: 0.7, axis: 2 },
  { term: "phase space", weight: 0.5, axis: 2 },
  { term: "equilibrium", weight: 0.4, axis: 2 },
  { term: "homeostasis", weight: 0.6, axis: 2 },
  { term: "cybernetic", weight: 0.6, axis: 2 },
];

// ── Merge logic ────────────────────────────────────────────────────────────
let added = 0;
let conflicts: Array<{ term: string; existingAxis: number; newAxis: number; source: string }> = [];

function tryAdd(term: string, weight: number, axis: number, source: string) {
  const key = term.toLowerCase();
  const ex = existingMap.get(key);
  if (ex) {
    // Check for conflict
    if (ex.axis !== axis) {
      conflicts.push({ term: key, existingAxis: ex.axis, newAxis: axis, source });
    }
    // Keep existing — don't overwrite
    return;
  }
  const entry = { term: key, weight, axis };
  existingMap.set(key, entry);
  existing.indicators.push(entry);
  added++;
}

// 1. Add missing indicators from dataset-processor motifs
for (const motif of INDICATOR_SETS) {
  const axis = AXIS_MAP[motif.axis];
  for (const ind of motif.indicators) {
    tryAdd(ind.term, ind.weight, axis, `motif:${motif.motifId}`);
  }
}

// 2. Add structural operators
for (const op of STRUCTURAL_OPERATORS) {
  tryAdd(op.term, op.weight, op.axis, "structural-operator");
}

// 3. Add general D/I/R indicators
for (const ind of GENERAL_INDICATORS) {
  tryAdd(ind.term, ind.weight, ind.axis, "general");
}

// ── Merge temporal markers ─────────────────────────────────────────────────
// Add markers from structural-scorer.ts that aren't in the vocabulary
const extraTemporal: Record<string, string[]> = {
  sequential: ["after", "before", "first", "second", "third", "lastly", "afterward", "following"],
  concurrent: ["at the same time"],
  cyclic: ["again", "repeatedly", "return", "repeat"],
  recursive: ["self", "self-referential", "introspect"],
};

let temporalAdded = 0;
for (const [group, markers] of Object.entries(extraTemporal)) {
  const existing_markers = new Set(existing.temporal_markers[group] ?? []);
  for (const m of markers) {
    if (!existing_markers.has(m)) {
      existing.temporal_markers[group].push(m);
      temporalAdded++;
    }
  }
}

// ── Update version and save ────────────────────────────────────────────────
existing.version = "20260408-v3-merged";

// Back up old vocabulary
await Bun.write(BACKUP_PATH, JSON.stringify(JSON.parse(await Bun.file(VOCAB_PATH).text()), null, 2));
console.log(`Backed up old vocabulary to: ${BACKUP_PATH}`);

// Write merged vocabulary
await Bun.write(VOCAB_PATH, JSON.stringify(existing, null, 2));

// ── Report ─────────────────────────────────────────────────────────────────
console.log(`\n=== Merge Results ===`);
console.log(`Indicators before: 228`);
console.log(`New indicators added: ${added}`);
console.log(`Total after merge: ${existing.indicators.length}`);
console.log(`Temporal markers added: ${temporalAdded}`);
console.log(`\nConflicts found: ${conflicts.length}`);
if (conflicts.length > 0) {
  for (const c of conflicts) {
    const axisNames = ["D", "I", "R"];
    console.log(`  "${c.term}": existing=${axisNames[c.existingAxis]}, new=${axisNames[c.newAxis]} (from ${c.source})`);
  }
}

// Axis distribution
const axisCounts = [0, 0, 0];
for (const ind of existing.indicators) {
  axisCounts[ind.axis]++;
}
console.log(`\nAxis distribution:`);
console.log(`  D (differentiate): ${axisCounts[0]}`);
console.log(`  I (integrate): ${axisCounts[1]}`);
console.log(`  R (recurse): ${axisCounts[2]}`);
