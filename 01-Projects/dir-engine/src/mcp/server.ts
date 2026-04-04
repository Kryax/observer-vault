#!/usr/bin/env bun
/**
 * D/I/R Structural Engine — MCP Server
 *
 * Exposes 5 tools: dir_classify, dir_compose, dir_evaluate, dir_status, dir_energy
 * Runs on stdio transport for Claude Code / CLI backend integration.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { resolve } from "node:path";
import { Engine } from "./engine.js";

const PROJECT_ROOT = resolve(import.meta.dir, "../..");
const DATA_DIR = resolve(PROJECT_ROOT, "data");

const engine = new Engine();

const server = new McpServer({
  name: "dir-engine",
  version: "0.1.0",
});

// ─── dir_classify ────────────────────────────────────────────────────

server.tool(
  "dir_classify",
  "Classify text or a pre-computed 6D vector into a D/I/R composition. " +
    "Provide exactly one of 'text' or 'vector'. Returns composition, confidence, axis, and space.",
  {
    text: z.string().optional().describe("Text to classify (vectorized internally)"),
    vector: z.array(z.number()).length(6).optional().describe("Pre-computed 6D vector [D, I, R, temporal, density, entropy]"),
    space: z.enum(["ideal", "applied", "auto"]).optional().describe("Space classification override (default: auto for text, ideal for vector)"),
  },
  async (args) => {
    try {
      const result = engine.doClassify({
        text: args.text,
        vector: args.vector,
        space: args.space,
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: (e as Error).message }) }],
        isError: true,
      };
    }
  },
);

// ─── dir_compose ─────────────────────────────────────────────────────

server.tool(
  "dir_compose",
  "Compose two D/I/R operators or compositions. Returns the resulting composition, " +
    "stability assessment, volume, and known motif mapping if available.",
  {
    a: z.string().describe("First operator or composition (e.g. 'D', 'R(I)')"),
    b: z.string().describe("Second operator or composition (e.g. 'I', 'D')"),
    operation: z.enum(["apply", "commutator", "inverse"]).optional().describe("Operation: apply (default) = a(b), commutator = [a,b], inverse = a(b)⁻¹"),
  },
  async (args) => {
    try {
      const result = engine.doCompose(args.a, args.b, args.operation);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: (e as Error).message }) }],
        isError: true,
      };
    }
  },
);

// ─── dir_evaluate ────────────────────────────────────────────────────

server.tool(
  "dir_evaluate",
  "Evaluate a candidate against the motif library using c/i/d predicates and stability checks. " +
    "Provide at least one of text, composition, or motif_id.",
  {
    text: z.string().optional().describe("Candidate text to evaluate"),
    composition: z.string().optional().describe("Composition to check stability (e.g. 'R(I)')"),
    motif_id: z.string().optional().describe("Motif ID to evaluate against library"),
    thresholds: z.object({
      c: z.number().optional().describe("Cross-domain threshold (default: 3 domains)"),
      i: z.number().optional().describe("Structural invariance Jaccard threshold (default: 0.6)"),
      d: z.number().optional().describe("Non-derivability Jaccard max threshold (default: 0.8)"),
    }).optional().describe("Override default predicate thresholds"),
  },
  async (args) => {
    try {
      const result = engine.doEvaluate({
        text: args.text,
        composition: args.composition,
        motif_id: args.motif_id,
        thresholds: args.thresholds,
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: (e as Error).message }) }],
        isError: true,
      };
    }
  },
);

// ─── dir_status ──────────────────────────────────────────────────────

server.tool(
  "dir_status",
  "Report engine status: loaded artifacts, vocabulary size, composition coverage, and uptime.",
  {},
  async () => {
    const status = engine.getStatus();
    return { content: [{ type: "text" as const, text: JSON.stringify(status, null, 2) }] };
  },
);

// ─── dir_energy (gated stub) ─────────────────────────────────────────

server.tool(
  "dir_energy",
  "Compute QHO-derived energy metric for a record or motif. " +
    "Currently gated — returns stub response until wave equation falsification (Task 5) warrants activation.",
  {
    text: z.string().optional().describe("Text to compute energy for"),
    composition: z.string().optional().describe("Composition to compute energy for"),
  },
  async () => {
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          gated: true,
          reason: "Awaiting wave equation falsification (Task 5). " +
            "Ungating requires >= 3/5 Langevin multi-well tests passing. " +
            "Test 5 (K=9 clustering) already passed. Need >= 2 more of: " +
            "ground state, energy-tier correlation, degeneracy, selection rules.",
        }, null, 2),
      }],
    };
  },
);

// ─── Start ───────────────────────────────────────────────────────────

async function main() {
  try {
    await engine.init(DATA_DIR);
    console.error("[dir-engine] Artifacts loaded successfully");
    console.error(`[dir-engine] ${engine.getStatus().vocabulary_size} indicators, ${engine.getStatus().compositions_covered} compositions, ${engine.getStatus().motifs_loaded} motifs`);
  } catch (e) {
    console.error("[dir-engine] WARNING: Failed to load artifacts:", (e as Error).message);
    console.error("[dir-engine] Engine will start but classification/evaluation tools will fail.");
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[dir-engine] MCP server running on stdio");
}

main().catch((e) => {
  console.error("[dir-engine] FATAL:", e);
  process.exit(1);
});
