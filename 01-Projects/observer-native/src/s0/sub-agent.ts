/**
 * S0 — Sub-Agent Task Schema (PRD 3.0.5)
 *
 * How work is packaged for fan-out. Each task carries its own ISC
 * exit criteria — the slice only closes when these pass.
 */

import type { ISC } from "./isc.ts";

export interface SubAgentTask {
  taskId: string;
  sliceId: string;
  description: string;
  context: string;
  iscCriteria: ISC[];
  dependencies: string[];
  timeout: number;
  retryBudget: number;
}

export type SubAgentResult = "PASSING" | "FAILING" | "TIMED_OUT";

export interface SubAgentOutput {
  taskId: string;
  result: SubAgentResult;
  iscResults: Array<{
    criterionId: string;
    passed: boolean;
    evidence?: string;
  }>;
  artifacts?: string[];
  error?: string;
}
