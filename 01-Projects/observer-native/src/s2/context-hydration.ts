/**
 * S2 — Context Hydration (PRD 3.2.3)
 *
 * Reads project state, recent sessions, framework deltas, active motifs,
 * and prior Reflect output at session startup. Provides the incoming context
 * that informs the current session.
 *
 * Does NOT reference or use PAI's MEMORY/ directory.
 */

import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { vaultRead, vaultExists, VAULT_ROOT } from "./vault-writer.ts";
import { retrieveLatestDelta } from "./framework-delta.ts";
import type { FrameworkDelta } from "./framework-delta.ts";
import type { SessionRecord, ReflectSeed, TensionGap } from "./session-capture.ts";
import { readOpenTensions } from "./tension-tracker.ts";

/**
 * The hydrated context available to a new session at startup.
 */
export interface HydratedContext {
  /** Active PRD files found in the project's .prd/ directory */
  projectState: ProjectState;
  /** Last N session records from 03-Daily/ */
  recentSessions: SessionRecord[];
  /** Most recent framework delta from Reflect Op8 */
  frameworkDelta: FrameworkDelta | null;
  /** Active motif entries from 02-Knowledge/motifs/ */
  activeMotifs: MotifEntry[];
  /** Prior Reflect output to seed this session's Oscillate */
  priorReflectOutput: ReflectSeed | null;
  /** Open tensions from the accumulated backlog, sorted by recurrence */
  tensionBacklog: TensionGap[];
}

export interface ProjectState {
  /** Raw content of PROJECT_STATE.md if it exists */
  projectStateMd: string | null;
  /** List of PRD filenames found in .prd/ */
  prdFiles: string[];
}

export interface MotifEntry {
  filename: string;
  content: string;
}

const MOTIFS_DIR = "02-Knowledge/motifs";
const DAILY_DIR = "03-Daily";

/**
 * Hydrates context for a new session.
 *
 * Steps (per PRD 3.2.3):
 * 1. Read project state — .prd/ directory and PROJECT_STATE.md
 * 2. Read recent sessions — last 3 entries from 03-Daily/
 * 3. Read framework deltas — most recent delta from 02-Knowledge/framework/deltas/
 * 4. Read active motifs — current motif library from 02-Knowledge/motifs/
 * 5. Load prior Reflect output — from the most recent session that includes one
 *
 * @param projectRoot Absolute path to the project directory (e.g. the observer-native dir)
 */
export function hydrateContext(projectRoot: string): HydratedContext {
  const projectState = readProjectState(projectRoot);
  const recentSessions = readRecentSessions(3);
  const frameworkDelta = retrieveLatestDelta();
  const activeMotifs = readActiveMotifs();
  const priorReflectOutput = extractPriorReflectOutput(recentSessions);
  const tensionBacklog = readOpenTensions(5);

  return {
    projectState,
    recentSessions,
    frameworkDelta,
    activeMotifs,
    priorReflectOutput,
    tensionBacklog,
  };
}

/**
 * Reads project state from the project's .prd/ directory and PROJECT_STATE.md.
 */
function readProjectState(projectRoot: string): ProjectState {
  const prdDir = join(projectRoot, ".prd");
  let prdFiles: string[] = [];
  if (existsSync(prdDir)) {
    prdFiles = readdirSync(prdDir).filter((f) => f.endsWith(".md"));
  }

  const stateFile = join(projectRoot, "PROJECT_STATE.md");
  const projectStateMd = existsSync(stateFile)
    ? (vaultRead(
        stateFile.replace(VAULT_ROOT + "/", ""),
      ) ?? null)
    : null;

  return { projectStateMd, prdFiles };
}

/**
 * Reads the N most recent session records from 03-Daily/.
 * Scans date directories in reverse order and parses JSONL entries.
 */
function readRecentSessions(count: number): SessionRecord[] {
  const absDaily = join(VAULT_ROOT, DAILY_DIR);
  if (!existsSync(absDaily)) return [];

  // Get date directories sorted newest first
  const dateDirs = readdirSync(absDaily)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
    .reverse();

  const sessions: SessionRecord[] = [];

  for (const dateDir of dateDirs) {
    if (sessions.length >= count) break;

    const sessionsPath = `${DAILY_DIR}/${dateDir}/sessions.jsonl`;
    const raw = vaultRead(sessionsPath);
    if (!raw) continue;

    const lines = raw
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .reverse(); // newest entries last in file, we want newest first

    for (const line of lines) {
      if (sessions.length >= count) break;
      try {
        sessions.push(JSON.parse(line) as SessionRecord);
      } catch {
        // Skip malformed lines
      }
    }
  }

  return sessions;
}

/**
 * Reads active motif entries from 02-Knowledge/motifs/.
 */
export function readActiveMotifs(): MotifEntry[] {
  const absMotifs = join(VAULT_ROOT, MOTIFS_DIR);
  if (!existsSync(absMotifs)) return [];

  const files = readdirSync(absMotifs).filter(
    (f) => f.endsWith(".md") || f.endsWith(".json"),
  );

  return files
    .map((filename) => {
      const content = vaultRead(`${MOTIFS_DIR}/${filename}`);
      return content ? { filename, content } : null;
    })
    .filter((e): e is MotifEntry => e !== null);
}

/**
 * Extracts prior Reflect output from the most recent session that includes one.
 * This seeds the next session's Oscillate phase (ISC criterion 7).
 */
function extractPriorReflectOutput(
  sessions: SessionRecord[],
): ReflectSeed | null {
  for (const session of sessions) {
    if (session.reflectOutput) {
      return session.reflectOutput;
    }
  }
  return null;
}
