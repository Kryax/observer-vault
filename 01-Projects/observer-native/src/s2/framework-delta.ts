/**
 * S2 — Framework Delta Mechanism (PRD 3.2.4)
 *
 * Stores and retrieves observation frame changes from Reflect Operation 8.
 * Each session produces a delta that adjusts the next session's starting
 * observation frame.
 *
 * Storage: 02-Knowledge/framework/deltas/{YYYY-MM-DD}_{sessionId}.json
 */

import { vaultWrite, vaultRead, VAULT_ROOT } from "./vault-writer.ts";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * A framework delta record — output of Reflect Operation 8.
 * Captures how the session's convergence filter shaped the observation frame.
 */
export interface FrameworkDelta {
  sessionId: string;
  timestamp: string;
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

const DELTA_DIR = "02-Knowledge/framework/deltas";

/**
 * Stores a framework delta in the vault.
 *
 * Path: 02-Knowledge/framework/deltas/{YYYY-MM-DD}_{sessionId}.json
 */
export function storeFrameworkDelta(delta: FrameworkDelta) {
  const date = delta.timestamp.slice(0, 10);
  const safeName = delta.sessionId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const relativePath = `${DELTA_DIR}/${date}_${safeName}.json`;
  const content = JSON.stringify(delta, null, 2);
  return vaultWrite(relativePath, content);
}

/**
 * Retrieves the most recent framework delta from the vault.
 * Scans the deltas directory and returns the latest by filename sort order.
 *
 * Returns null if no deltas exist.
 */
export function retrieveLatestDelta(): FrameworkDelta | null {
  const absDir = join(VAULT_ROOT, DELTA_DIR);
  if (!existsSync(absDir)) return null;

  const files = readdirSync(absDir)
    .filter((f) => f.endsWith(".json"))
    .sort();

  if (files.length === 0) return null;

  const latestFile = files[files.length - 1]!;
  const relativePath = `${DELTA_DIR}/${latestFile}`;
  const raw = vaultRead(relativePath);
  if (!raw) return null;

  return JSON.parse(raw) as FrameworkDelta;
}

/**
 * Retrieves all framework deltas, ordered oldest to newest.
 */
export function retrieveAllDeltas(): FrameworkDelta[] {
  const absDir = join(VAULT_ROOT, DELTA_DIR);
  if (!existsSync(absDir)) return [];

  const files = readdirSync(absDir)
    .filter((f) => f.endsWith(".json"))
    .sort();

  return files
    .map((f) => {
      const raw = vaultRead(`${DELTA_DIR}/${f}`);
      return raw ? (JSON.parse(raw) as FrameworkDelta) : null;
    })
    .filter((d): d is FrameworkDelta => d !== null);
}
