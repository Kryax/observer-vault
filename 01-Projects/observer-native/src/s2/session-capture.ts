/**
 * S2 — Session Capture (PRD 3.2.1)
 *
 * Records session metadata as JSONL entries in the vault's daily directory.
 * Each session entry captures: session ID, timestamps, working directory,
 * ISC outcomes (for hill-climbing visibility), and summary.
 *
 * Storage: 03-Daily/{YYYY-MM-DD}/sessions.jsonl
 */

import type { ISC } from "../s0/index.ts";
import { vaultAppend } from "./vault-writer.ts";

/**
 * A single session capture record. Written as one JSONL line per session.
 */
export interface SessionRecord {
  sessionId: string;
  startedAt: string;
  endedAt: string;
  workingDirectory: string;
  exitReason: "user_exit" | "timeout" | "error" | "completed";
  summary?: string;
  iscOutcomes: ISCOutcome[];
  reflectOutput?: ReflectSeed;
  motifCandidates?: MotifCandidate[];
}

/**
 * ISC outcome snapshot — captures criterion state at session end
 * for hill-climbing visibility across sessions (ISC criterion 8).
 */
export interface ISCOutcome {
  id: string;
  description: string;
  status: ISC["status"];
  evidence?: string;
}

/**
 * Reflect output preserved to seed the next session's Oscillate (ISC criterion 7).
 */
export interface ReflectSeed {
  transferFunctionSummary: string;
  independenceScore: number;
  axisBalanceReport: {
    differentiate: number;
    integrate: number;
    recurse: number;
  };
  newLenses: string[];
  shiftedAssumptions: string[];
}

/**
 * A motif candidate produced by Reflect, to be written to vault motifs directory (ISC criterion 6).
 */
export interface MotifCandidate {
  name: string;
  tier: 0;
  primaryAxis: "differentiate" | "integrate" | "recurse";
  derivativeOrder: number;
  generatingQuestion: string;
  description: string;
  sourceSession: string;
}

/**
 * Formats a Date as YYYY-MM-DD for vault daily directory paths.
 */
function formatDate(isoTimestamp: string): string {
  return isoTimestamp.slice(0, 10);
}

/**
 * Captures a session record as a JSONL entry in the vault daily directory.
 *
 * Path: 03-Daily/{YYYY-MM-DD}/sessions.jsonl
 *
 * Returns the vault write result.
 */
export function captureSession(record: SessionRecord) {
  const date = formatDate(record.endedAt);
  const relativePath = `03-Daily/${date}/sessions.jsonl`;
  const line = JSON.stringify(record);
  return vaultAppend(relativePath, line);
}

/**
 * Extracts ISC outcomes from a list of ISC criteria for session capture.
 * Maps full ISC objects to the lightweight ISCOutcome format.
 */
export function extractISCOutcomes(criteria: ISC[]): ISCOutcome[] {
  return criteria.map((c) => ({
    id: c.id,
    description: c.description,
    status: c.status,
    evidence: c.evidence,
  }));
}
