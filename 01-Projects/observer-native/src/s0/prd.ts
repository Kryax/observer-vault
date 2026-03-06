/**
 * S0 — PRD Schema (PRD 3.0.3)
 *
 * The structure every PRD must conform to. Includes slice decomposition
 * for parallel build fan-out.
 */

import type { ISC } from "./isc.ts";

export type PRDStatus =
  | "DRAFT"
  | "CRITERIA_DEFINED"
  | "PLANNED"
  | "IN_PROGRESS"
  | "VERIFYING"
  | "COMPLETE"
  | "FAILED"
  | "BLOCKED";

export interface Slice {
  id: string;
  description: string;
  dependencies: string[];
  iscCriteria: ISC[];
  status: PRDStatus;
}

export interface PRDLogEntry {
  iteration: number;
  date: string;
  phaseReached: string;
  criteriaProgress: string;
  workDone: string;
  failingCriteria: string[];
  contextForNext: string;
}

export interface PRDContext {
  problemSpace: string;
  keyFiles: Record<string, string>;
  constraints: string[];
  decisionsMade: string[];
}

export interface PRD {
  id: string;
  status: PRDStatus;
  effortLevel: string;
  created: string;
  updated: string;
  iteration: number;
  slices: Slice[];
  iscCriteria: ISC[];
  context: PRDContext;
  plan: string;
  log: PRDLogEntry[];
}
