#!/usr/bin/env bun
/**
 * Export artifacts from the dataset processor pipeline and motif library
 * into the dir-engine's data/ directory.
 *
 * Produces:
 *   data/vocabulary.json   — indicator vocabulary + temporal markers
 *   data/centroids.json    — K=9 centroid manifest (fit on shard-00)
 *   data/motifs.json       — motif library snapshot with indicators
 *
 * Usage: bun scripts/export-artifacts.ts
 */

import { Database } from "bun:sqlite";
import { readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { CentroidManifestSchema, IndicatorVocabularySchema, MotifLibrarySchema } from "../src/data/schemas.js";

const PROJECT_ROOT = resolve(import.meta.dir, "..");
const VAULT_ROOT = resolve(PROJECT_ROOT, "../..");
const DATA_DIR = join(PROJECT_ROOT, "data");
const PIPELINE_DIR = join(VAULT_ROOT, "01-Projects/dataset-processor");
const MOTIF_DIR = join(VAULT_ROOT, "02-Knowledge/motifs");

// ─── Vocabulary Export ───────────────────────────────────────────────

const INDICATORS: Array<{ term: string; weight: number; axis: 0 | 1 | 2 }> = [
  // DSG — integrate
  { term: "dual-speed", weight: 1.0, axis: 1 }, { term: "two-speed", weight: 1.0, axis: 1 },
  { term: "operational cycle", weight: 0.9, axis: 1 }, { term: "constitutional", weight: 0.8, axis: 1 },
  { term: "governance", weight: 0.6, axis: 1 }, { term: "oversight", weight: 0.5, axis: 1 },
  { term: "regulate", weight: 0.5, axis: 1 }, { term: "constraint", weight: 0.4, axis: 1 },
  { term: "fast and slow", weight: 0.9, axis: 1 }, { term: "slow cycle", weight: 0.8, axis: 1 },
  { term: "fast cycle", weight: 0.8, axis: 1 },
  // CPA — differentiate
  { term: "composable", weight: 0.9, axis: 0 }, { term: "plugin", weight: 0.9, axis: 0 },
  { term: "extension point", weight: 0.9, axis: 0 }, { term: "middleware", weight: 0.8, axis: 0 },
  { term: "extensible", weight: 0.7, axis: 0 }, { term: "modular", weight: 0.6, axis: 0 },
  { term: "registry", weight: 0.6, axis: 0 }, { term: "hook", weight: 0.5, axis: 0 },
  { term: "add-on", weight: 0.8, axis: 0 }, { term: "loadable", weight: 0.7, axis: 0 },
  { term: "adapter", weight: 0.5, axis: 0 },
  // ESMB — differentiate
  { term: "state machine", weight: 1.0, axis: 0 }, { term: "finite state", weight: 1.0, axis: 0 },
  { term: "state transition", weight: 0.9, axis: 0 }, { term: "state diagram", weight: 0.9, axis: 0 },
  { term: "automaton", weight: 0.8, axis: 0 }, { term: "guard condition", weight: 0.8, axis: 0 },
  { term: "workflow state", weight: 0.7, axis: 0 }, { term: "fsm", weight: 0.9, axis: 0 },
  // BBWOP — differentiate
  { term: "backpressure", weight: 1.0, axis: 0 }, { term: "overflow", weight: 0.8, axis: 0 },
  { term: "bounded buffer", weight: 1.0, axis: 0 }, { term: "ring buffer", weight: 0.9, axis: 0 },
  { term: "circular buffer", weight: 0.9, axis: 0 }, { term: "evict", weight: 0.7, axis: 0 },
  { term: "rate limit", weight: 0.7, axis: 0 }, { term: "throttle", weight: 0.6, axis: 0 },
  { term: "congestion", weight: 0.6, axis: 0 },
  // ISC — integrate
  { term: "idempotent", weight: 1.0, axis: 1 }, { term: "convergence", weight: 0.7, axis: 1 },
  { term: "desired state", weight: 0.9, axis: 1 }, { term: "declarative", weight: 0.6, axis: 1 },
  { term: "reconcile", weight: 0.8, axis: 1 }, { term: "self-healing", weight: 0.9, axis: 1 },
  { term: "eventual consistency", weight: 0.9, axis: 1 }, { term: "drift detection", weight: 0.9, axis: 1 },
  { term: "converge", weight: 0.6, axis: 1 }, { term: "target state", weight: 0.7, axis: 1 },
  // OFL — recurse
  { term: "feedback loop", weight: 0.8, axis: 2 }, { term: "self-modifying", weight: 0.9, axis: 2 },
  { term: "co-evolution", weight: 0.8, axis: 2 }, { term: "reflexive", weight: 0.7, axis: 2 },
  { term: "frame of reference", weight: 0.7, axis: 2 }, { term: "hermeneutic", weight: 0.9, axis: 2 },
  { term: "recursive observation", weight: 1.0, axis: 2 }, { term: "meta-observation", weight: 1.0, axis: 2 },
  { term: "self-referential", weight: 0.7, axis: 2 },
  // RAF — recurse
  { term: "ratchet", weight: 1.0, axis: 2 }, { term: "irreversible", weight: 0.7, axis: 2 },
  { term: "path dependence", weight: 0.9, axis: 2 }, { term: "lock-in", weight: 0.8, axis: 2 },
  { term: "sunk cost", weight: 0.7, axis: 2 }, { term: "ossify", weight: 0.8, axis: 2 },
  { term: "hard to reverse", weight: 0.8, axis: 2 }, { term: "backward compatibility", weight: 0.7, axis: 2 },
  // PF — integrate
  { term: "formalize", weight: 0.8, axis: 1 }, { term: "crystallize", weight: 0.8, axis: 1 },
  { term: "solidify", weight: 0.6, axis: 1 }, { term: "provisional", weight: 0.6, axis: 1 },
  { term: "canonical", weight: 0.6, axis: 1 }, { term: "amorphous", weight: 0.7, axis: 1 },
  { term: "increasing structure", weight: 0.9, axis: 1 }, { term: "structural order", weight: 0.8, axis: 1 },
  // RB — differentiate
  { term: "reconstruction", weight: 0.9, axis: 0 }, { term: "lossy", weight: 0.8, axis: 0 },
  { term: "information loss", weight: 0.9, axis: 0 }, { term: "downstream cost", weight: 0.8, axis: 0 },
  { term: "abstraction leak", weight: 0.9, axis: 0 }, { term: "quantization", weight: 0.7, axis: 0 },
  // TAC — integrate
  { term: "reputation", weight: 0.7, axis: 1 }, { term: "credibility", weight: 0.7, axis: 1 },
  { term: "curate", weight: 0.7, axis: 1 }, { term: "quality signal", weight: 0.8, axis: 1 },
  { term: "endorsement", weight: 0.6, axis: 1 }, { term: "peer review", weight: 0.7, axis: 1 },
  // RST — recurse
  { term: "apoptosis", weight: 1.0, axis: 2 }, { term: "dissolution", weight: 0.7, axis: 2 },
  { term: "metamorphosis", weight: 0.8, axis: 2 }, { term: "phase transition", weight: 0.8, axis: 2 },
  { term: "structural transformation", weight: 0.8, axis: 2 },
  { term: "controlled demolition", weight: 0.9, axis: 2 },
  { term: "self-destruct", weight: 0.8, axis: 2 }, { term: "molt", weight: 0.8, axis: 2 },
  // BD — differentiate
  { term: "boundary drift", weight: 1.0, axis: 0 }, { term: "semantic shift", weight: 0.8, axis: 0 },
  { term: "scope creep", weight: 0.8, axis: 0 }, { term: "mission creep", weight: 0.8, axis: 0 },
  // SCGS — integrate
  { term: "structural coupling", weight: 1.0, axis: 1 }, { term: "mutual constraint", weight: 0.9, axis: 1 },
  { term: "co-adaptation", weight: 0.9, axis: 1 }, { term: "symbiosis", weight: 0.7, axis: 1 },
  // SLD — differentiate
  { term: "safety property", weight: 1.0, axis: 0 }, { term: "liveness property", weight: 1.0, axis: 0 },
  { term: "liveness", weight: 0.8, axis: 0 }, { term: "deadlock", weight: 0.7, axis: 0 },
  { term: "starvation", weight: 0.7, axis: 0 }, { term: "constraint satisfaction", weight: 0.7, axis: 0 },
  // RG — recurse
  { term: "recursive generativity", weight: 1.0, axis: 2 }, { term: "novel structure", weight: 0.8, axis: 2 },
  { term: "self-organizing", weight: 0.7, axis: 2 }, { term: "meta-level", weight: 0.6, axis: 2 },
  { term: "higher-order", weight: 0.5, axis: 2 }, { term: "autogenesis", weight: 1.0, axis: 2 },
  { term: "autopoiesis", weight: 0.9, axis: 2 },
  // PSR — recurse
  { term: "self-reference", weight: 0.9, axis: 2 }, { term: "quine", weight: 1.0, axis: 2 },
  { term: "fixed point", weight: 0.8, axis: 2 }, { term: "self-describing", weight: 0.9, axis: 2 },
  { term: "metacircular", weight: 1.0, axis: 2 }, { term: "introspection", weight: 0.6, axis: 2 },
  { term: "self-representation", weight: 0.8, axis: 2 },
  // TDC — differentiate
  { term: "taxonomy", weight: 0.8, axis: 0 }, { term: "ontology", weight: 0.8, axis: 0 },
  { term: "type system", weight: 0.7, axis: 0 }, { term: "categorize", weight: 0.6, axis: 0 },
  // SFA — differentiate
  { term: "scaffold", weight: 0.7, axis: 0 }, { term: "skeleton", weight: 0.6, axis: 0 },
  { term: "boilerplate", weight: 0.7, axis: 0 }, { term: "minimum viable", weight: 0.7, axis: 0 },
  { term: "infrastructure first", weight: 0.9, axis: 0 },
  { term: "structure before content", weight: 0.9, axis: 0 },
  // CU — integrate
  { term: "consilience", weight: 1.0, axis: 1 }, { term: "convergent evidence", weight: 0.9, axis: 1 },
  { term: "unification", weight: 0.6, axis: 1 }, { term: "disparate domains", weight: 0.8, axis: 1 },
  { term: "independent lines of evidence", weight: 0.9, axis: 1 },
  { term: "structural isomorphism", weight: 0.9, axis: 1 },
  { term: "cross-disciplinary", weight: 0.7, axis: 1 },
  // PBR — differentiate
  { term: "paradigm shift", weight: 0.9, axis: 0 }, { term: "boundary revision", weight: 1.0, axis: 0 },
  { term: "meta-framework", weight: 0.9, axis: 0 }, { term: "distinction apparatus", weight: 1.0, axis: 0 },
  { term: "reconceptualize", weight: 0.7, axis: 0 }, { term: "ontological shift", weight: 0.8, axis: 0 },
  { term: "category error", weight: 0.7, axis: 0 }, { term: "epistemic rupture", weight: 0.9, axis: 0 },
  // TAM — integrate
  { term: "antagonistic", weight: 0.8, axis: 1 }, { term: "mutual suppression", weight: 1.0, axis: 1 },
  { term: "parasympathetic", weight: 0.7, axis: 1 }, { term: "two modes", weight: 0.7, axis: 1 },
  { term: "mutually exclusive", weight: 0.7, axis: 1 }, { term: "mode switching", weight: 0.8, axis: 1 },
  { term: "bistable", weight: 0.9, axis: 1 },
  // PEPS — recurse
  { term: "prediction error", weight: 1.0, axis: 2 }, { term: "forward model", weight: 0.9, axis: 2 },
  { term: "predictive coding", weight: 1.0, axis: 2 }, { term: "free energy", weight: 0.8, axis: 2 },
  { term: "bayesian brain", weight: 0.9, axis: 2 }, { term: "error signal", weight: 0.7, axis: 2 },
  { term: "deviation from expectation", weight: 0.9, axis: 2 },
  // MS — recurse
  { term: "metacognition", weight: 0.9, axis: 2 }, { term: "learning priority", weight: 0.8, axis: 2 },
  { term: "gap awareness", weight: 0.9, axis: 2 }, { term: "self-directed learning", weight: 0.8, axis: 2 },
  { term: "meta-learning", weight: 0.9, axis: 2 }, { term: "active learning", weight: 0.7, axis: 2 },
  { term: "value of information", weight: 0.9, axis: 2 }, { term: "uncertainty reduction", weight: 0.7, axis: 2 },
  { term: "information gain", weight: 0.7, axis: 2 },
  // HSSFS — differentiate
  { term: "deep structure", weight: 0.9, axis: 0 }, { term: "surface structure", weight: 0.9, axis: 0 },
  { term: "surface form", weight: 0.8, axis: 0 }, { term: "generative grammar", weight: 0.9, axis: 0 },
  { term: "underlying representation", weight: 0.8, axis: 0 }, { term: "hidden variable", weight: 0.8, axis: 0 },
  // ECS — differentiate
  { term: "kalman filter", weight: 1.0, axis: 0 }, { term: "state estimation", weight: 0.9, axis: 0 },
  { term: "separation principle", weight: 1.0, axis: 0 }, { term: "state observer", weight: 0.9, axis: 0 },
  { term: "noisy observation", weight: 0.7, axis: 0 }, { term: "plant model", weight: 0.8, axis: 0 },
  // DTR — recurse
  { term: "iterated learning", weight: 1.0, axis: 2 }, { term: "compressibility", weight: 0.8, axis: 2 },
  { term: "repeated transmission", weight: 0.9, axis: 2 }, { term: "cultural transmission", weight: 0.8, axis: 2 },
  { term: "lossy copying", weight: 0.9, axis: 2 }, { term: "description length", weight: 0.8, axis: 2 },
  { term: "generational drift", weight: 0.9, axis: 2 },
  // PC — recurse
  { term: "incubation", weight: 0.7, axis: 2 }, { term: "crystallization", weight: 0.8, axis: 2 },
  { term: "punctuated equilibrium", weight: 0.9, axis: 2 }, { term: "accumulation phase", weight: 0.8, axis: 2 },
  { term: "silent period", weight: 0.7, axis: 2 }, { term: "sudden coherence", weight: 0.9, axis: 2 },
  // RRT — integrate
  { term: "error correction", weight: 0.8, axis: 1 }, { term: "fault tolerance", weight: 0.8, axis: 1 },
  { term: "coding theory", weight: 0.8, axis: 1 }, { term: "replication factor", weight: 0.8, axis: 1 },
  { term: "shannon", weight: 0.7, axis: 1 }, { term: "channel capacity", weight: 0.9, axis: 1 },
  // NSSH — recurse
  { term: "fractal", weight: 0.9, axis: 2 }, { term: "self-similar", weight: 1.0, axis: 2 },
  { term: "scale invariant", weight: 0.9, axis: 2 }, { term: "recursive structure", weight: 0.7, axis: 2 },
  { term: "power law", weight: 0.6, axis: 2 }, { term: "multi-scale", weight: 0.7, axis: 2 },
  { term: "holarchy", weight: 1.0, axis: 2 }, { term: "holon", weight: 0.9, axis: 2 },
  // PUE — integrate
  { term: "uncertainty propagation", weight: 1.0, axis: 1 },
  { term: "belief distribution", weight: 0.8, axis: 1 },
  { term: "confidence interval", weight: 0.6, axis: 1 }, { term: "error propagation", weight: 0.8, axis: 1 },
  { term: "monte carlo", weight: 0.6, axis: 1 }, { term: "particle filter", weight: 0.8, axis: 1 },
  { term: "credible interval", weight: 0.8, axis: 1 },
  // KRHS — integrate
  { term: "kill ratio", weight: 1.0, axis: 1 }, { term: "discard rate", weight: 0.9, axis: 1 },
  { term: "selectivity", weight: 0.6, axis: 1 }, { term: "triage", weight: 0.6, axis: 1 },
  { term: "quality filter", weight: 0.7, axis: 1 }, { term: "rejection rate", weight: 0.8, axis: 1 },
  { term: "culling", weight: 0.8, axis: 1 },
  // IBP — differentiate
  { term: "observability", weight: 0.7, axis: 0 }, { term: "measure first", weight: 0.9, axis: 0 },
  { term: "telemetry", weight: 0.6, axis: 0 }, { term: "diagnostic", weight: 0.5, axis: 0 },
  { term: "instrument before", weight: 1.0, axis: 0 },
];

const TEMPORAL_MARKERS = {
  sequential: ["then", "next", "subsequently", "afterward", "following", "finally"],
  concurrent: ["while", "during", "meanwhile", "simultaneously", "concurrently", "parallel"],
  cyclic: ["cycle", "loop", "iterate", "periodic", "recurring", "repeat"],
  recursive: ["recursive", "meta", "nested", "self-referential", "reflexive", "introspect"],
};

const CLUSTER_TO_COMPOSITION: Record<number, string> = {
  0: "I(D)", 1: "D(D)", 2: "R(R)", 3: "I(I)", 4: "R(I)",
  5: "R(D)", 6: "D(I)", 7: "D(R)", 8: "I(R)",
};

// ─── Vectorization (mirrors Python dir-vectorize-cluster.py) ─────────

function vectorizeText(text: string, indicators: typeof INDICATORS): number[] {
  const maxLen = 8000;
  const t = text.length > maxLen ? text.slice(0, maxLen) : text;
  const lower = t.toLowerCase();

  const scores = [0, 0, 0]; // D, I, R

  for (const ind of indicators) {
    const pattern = ind.term.includes(" ")
      ? new RegExp(ind.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")
      : new RegExp(`\\b${ind.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    const matches = lower.match(pattern);
    if (matches) {
      scores[ind.axis] += Math.log(1 + matches.length) * ind.weight;
    }
  }

  // Temporal
  let temporalCount = 0;
  for (const markers of Object.values(TEMPORAL_MARKERS)) {
    for (const m of markers) {
      const pat = new RegExp(`\\b${m}\\b`, "gi");
      const matches = lower.match(pat);
      if (matches) temporalCount += matches.length;
    }
  }
  const temporal = Math.log(1 + temporalCount);

  // Density
  let totalWeight = 0;
  for (const ind of indicators) {
    const pattern = ind.term.includes(" ")
      ? new RegExp(ind.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")
      : new RegExp(`\\b${ind.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    const matches = lower.match(pattern);
    if (matches) totalWeight += matches.length * ind.weight;
  }
  const density = t.length > 0 ? totalWeight / (t.length / 1000) : 0;

  // Entropy
  const total = scores[0] + scores[1] + scores[2];
  let entropy = 0;
  if (total > 0) {
    for (const s of scores) {
      const p = s / total;
      if (p > 0) entropy -= p * Math.log2(p);
    }
  }

  return [scores[0], scores[1], scores[2], temporal, density, entropy];
}

function l2Normalize(v: number[]): number[] {
  const mag = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  if (mag === 0) return v.map(() => 0);
  return v.map((x) => x / mag);
}

// ─── K-means (minimal, matches sklearn K=9 n_init=10) ───────────────

function kmeansInit(vectors: number[][], k: number): number[][] {
  // k-means++ initialization
  const centroids: number[][] = [];
  const n = vectors.length;
  const dim = vectors[0].length;

  // Pick first centroid randomly
  centroids.push([...vectors[Math.floor(Math.random() * n)]]);

  for (let c = 1; c < k; c++) {
    const distances = vectors.map((v) => {
      let minDist = Infinity;
      for (const cent of centroids) {
        let d = 0;
        for (let i = 0; i < dim; i++) d += (v[i] - cent[i]) ** 2;
        minDist = Math.min(minDist, d);
      }
      return minDist;
    });
    const totalDist = distances.reduce((a, b) => a + b, 0);
    let r = Math.random() * totalDist;
    for (let i = 0; i < n; i++) {
      r -= distances[i];
      if (r <= 0) {
        centroids.push([...vectors[i]]);
        break;
      }
    }
    if (centroids.length === c) centroids.push([...vectors[Math.floor(Math.random() * n)]]);
  }
  return centroids;
}

function kmeansRun(
  vectors: number[][],
  k: number,
  maxIter: number = 300,
  nInit: number = 10
): { centroids: number[][]; labels: number[]; inertia: number } {
  const n = vectors.length;
  const dim = vectors[0].length;
  let bestCentroids: number[][] = [];
  let bestLabels: number[] = [];
  let bestInertia = Infinity;

  for (let init = 0; init < nInit; init++) {
    let centroids = kmeansInit(vectors, k);
    let labels = new Array(n).fill(0);

    for (let iter = 0; iter < maxIter; iter++) {
      // Assign
      const newLabels = vectors.map((v) => {
        let minDist = Infinity;
        let minIdx = 0;
        for (let c = 0; c < k; c++) {
          let d = 0;
          for (let i = 0; i < dim; i++) d += (v[i] - centroids[c][i]) ** 2;
          if (d < minDist) { minDist = d; minIdx = c; }
        }
        return minIdx;
      });

      // Check convergence
      const changed = newLabels.some((l, i) => l !== labels[i]);
      labels = newLabels;
      if (!changed) break;

      // Update centroids
      centroids = Array.from({ length: k }, () => new Array(dim).fill(0));
      const counts = new Array(k).fill(0);
      for (let i = 0; i < n; i++) {
        counts[labels[i]]++;
        for (let d = 0; d < dim; d++) centroids[labels[i]][d] += vectors[i][d];
      }
      for (let c = 0; c < k; c++) {
        if (counts[c] > 0) {
          for (let d = 0; d < dim; d++) centroids[c][d] /= counts[c];
        }
      }
    }

    // Compute inertia
    let inertia = 0;
    for (let i = 0; i < n; i++) {
      for (let d = 0; d < dim; d++) {
        inertia += (vectors[i][d] - centroids[labels[i]][d]) ** 2;
      }
    }

    if (inertia < bestInertia) {
      bestInertia = inertia;
      bestCentroids = centroids;
      bestLabels = labels;
    }
  }

  return { centroids: bestCentroids, labels: bestLabels, inertia: bestInertia };
}

// ─── Motif Library Export ────────────────────────────────────────────

// Axis name mapping
const AXIS_MAP: Record<string, "differentiate" | "integrate" | "recurse"> = {
  differentiate: "differentiate", integrate: "integrate", recurse: "recurse",
  d: "differentiate", i: "integrate", r: "recurse",
};

// Composition mapping by motif id (known Tier 2 + Tier 1 with assigned compositions)
const MOTIF_COMPOSITIONS: Record<string, string> = {
  "dual-speed-governance": "I(D)",
  "composable-plugin-architecture": "D(I)",
  "explicit-state-machine-backbone": "D(D)",
  "bounded-buffer-with-overflow-policy": "D(R)",
  "idempotent-state-convergence": "R(I)",
  "observer-feedback-loop": "R(R)",
  "ratchet-with-asymmetric-friction": "R(D)",
  "progressive-formalization": "R(I(D))",
  "reconstruction-burden": "D(I)⁻¹",
  "cross-domain-recursive-integration": "I(R)",
  "structural-coupling-ground-state": "I(I)",
};

interface MotifFrontmatter {
  name?: string;
  tier?: number;
  primary_axis?: string;
  domain_count?: number;
  status?: string;
}

function parseFrontmatter(content: string): { frontmatter: MotifFrontmatter; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };

  const fm: MotifFrontmatter = {};
  for (const line of match[1].split("\n")) {
    const kv = line.match(/^(\w[\w_]*)\s*:\s*(.+)$/);
    if (!kv) continue;
    const [, key, val] = kv;
    const clean = val.replace(/^["']|["']$/g, "").trim();
    if (key === "name") fm.name = clean;
    else if (key === "tier") fm.tier = parseInt(clean, 10);
    else if (key === "primary_axis") fm.primary_axis = clean;
    else if (key === "domain_count") fm.domain_count = parseInt(clean, 10);
    else if (key === "status") fm.status = clean;
  }
  return { frontmatter: fm, body: match[2] };
}

function extractDomains(body: string): string[] {
  const domains = new Set<string>();
  // Look for instances section with domain markers
  const instanceSection = body.match(/## Instances([\s\S]*?)(?=\n## |\n---|\Z)/);
  if (instanceSection) {
    // Match domain labels in instance entries: "- **Domain:**" or "domain:" patterns
    const domainMatches = instanceSection[1].matchAll(
      /\*\*(?:Domain|domain)\s*:\s*\*\*\s*([^\n,|]+)/gi
    );
    for (const m of domainMatches) domains.add(m[1].trim().toLowerCase());

    // Also match "- domain:" at start of lines in instance lists
    const altMatches = instanceSection[1].matchAll(/^\s*-\s*\*\*([^*]+)\*\*/gm);
    for (const m of altMatches) {
      const d = m[1].trim().toLowerCase();
      if (d.length < 40 && !d.includes(":")) domains.add(d);
    }
  }
  return [...domains];
}

function extractIndicatorsForMotif(motifId: string): string[] {
  // Find indicators that belong to this motif's conceptual group
  const motifIndicatorGroups: Record<string, string[]> = {};
  // Build from the INDICATORS array — group by the comment labels
  // For now, return the terms that match the motif's primary concept
  const result: string[] = [];
  for (const ind of INDICATORS) {
    // Use a simple heuristic: include indicators whose terms appear related
    // This is approximate — the export is a snapshot, not a precise mapping
    result.push(ind.term);
  }
  // Return all — the motifs.json consumer will filter by relevance
  return [];
}

// ─── Main Export ─────────────────────────────────────────────────────

async function exportVocabulary(): Promise<void> {
  const vocab = {
    version: new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-001",
    indicators: INDICATORS,
    temporal_markers: TEMPORAL_MARKERS,
  };

  IndicatorVocabularySchema.parse(vocab);
  const path = join(DATA_DIR, "vocabulary.json");
  await Bun.write(path, JSON.stringify(vocab, null, 2));
  console.log(`[export] vocabulary.json: ${INDICATORS.length} indicators written to ${path}`);
}

async function exportCentroids(): Promise<void> {
  const shardPath = join(PIPELINE_DIR, "output/shard-00.db");
  const file = Bun.file(shardPath);
  if (!(await file.exists())) {
    console.error(`[export] ERROR: shard-00.db not found at ${shardPath}`);
    console.error(`[export] Cannot fit centroids without source data. Skipping centroid export.`);
    return;
  }

  console.log(`[export] Fitting K=9 centroids on shard-00...`);
  const db = new Database(shardPath, { readonly: true });

  const rows = db.query(
    "SELECT source_raw_text FROM verb_records WHERE source_raw_text IS NOT NULL AND length(source_raw_text) >= 50"
  ).all() as Array<{ source_raw_text: string }>;

  console.log(`[export] Vectorizing ${rows.length} records...`);
  const vectors: number[][] = [];
  for (const row of rows) {
    const raw = vectorizeText(row.source_raw_text, INDICATORS);
    const norm = l2Normalize(raw);
    // Skip zero vectors
    if (norm.some((x) => x !== 0)) vectors.push(norm);
  }
  console.log(`[export] ${vectors.length} non-zero vectors ready for clustering`);

  // Seed RNG for reproducibility
  const origRandom = Math.random;
  let seed = 42;
  Math.random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const { centroids } = kmeansRun(vectors, 9, 300, 10);
  Math.random = origRandom;

  const mapping: Record<string, string> = {};
  for (const [k, v] of Object.entries(CLUSTER_TO_COMPOSITION)) {
    mapping[k] = v;
  }

  const manifest = {
    version: new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-001",
    k: 9,
    dim: 6,
    dim_names: ["D", "I", "R", "temporal", "density", "entropy"],
    centroids,
    mapping,
  };

  CentroidManifestSchema.parse(manifest);
  const path = join(DATA_DIR, "centroids.json");
  await Bun.write(path, JSON.stringify(manifest, null, 2));
  console.log(`[export] centroids.json: ${centroids.length} centroids written to ${path}`);
  db.close();
}

async function exportMotifs(): Promise<void> {
  const entries = await readdir(MOTIF_DIR);
  const motifFiles = entries.filter(
    (f) => f.endsWith(".md") && !f.startsWith("_") && f !== "MOTIF_INDEX.md"
  );

  const motifs: Array<{
    id: string; name: string; composition: string; tier: number;
    domains: string[]; indicators: string[]; primary_axis: "differentiate" | "integrate" | "recurse";
  }> = [];

  for (const filename of motifFiles) {
    const content = await Bun.file(join(MOTIF_DIR, filename)).text();
    const { frontmatter, body } = parseFrontmatter(content);
    const id = filename.replace(/\.md$/, "");
    const name = frontmatter.name ?? id.replace(/-/g, " ");
    const tier = frontmatter.tier ?? 0;
    const axisRaw = frontmatter.primary_axis ?? "differentiate";
    const primary_axis = AXIS_MAP[axisRaw.toLowerCase()] ?? "differentiate";
    const composition = MOTIF_COMPOSITIONS[id] ?? "";
    const domains = extractDomains(body);

    // Build indicators from the vocabulary that relate to this motif's axis
    const relatedIndicators = INDICATORS
      .filter((ind) => {
        const axisNum = primary_axis === "differentiate" ? 0 : primary_axis === "integrate" ? 1 : 2;
        return ind.axis === axisNum && ind.weight >= 0.7;
      })
      .map((ind) => ind.term)
      .slice(0, 10);

    motifs.push({
      id, name, composition, tier, domains,
      indicators: relatedIndicators,
      primary_axis,
    });
  }

  const library = {
    version: new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-001",
    motifs,
  };

  MotifLibrarySchema.parse(library);
  const path = join(DATA_DIR, "motifs.json");
  await Bun.write(path, JSON.stringify(library, null, 2));
  console.log(`[export] motifs.json: ${motifs.length} motifs written to ${path}`);
}

// ─── Run ─────────────────────────────────────────────────────────────

async function main() {
  console.log("[export] D/I/R Engine artifact export");
  console.log(`[export] Data directory: ${DATA_DIR}`);
  console.log("");

  await exportVocabulary();
  console.log("");
  await exportCentroids();
  console.log("");
  await exportMotifs();
  console.log("");
  console.log("[export] Done. Validate with: bun test");
}

main().catch((e) => {
  console.error("[export] FATAL:", e);
  process.exit(1);
});
