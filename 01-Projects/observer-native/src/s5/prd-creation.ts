/**
 * S5 — PRD Creation (PRD 3.5.1)
 *
 * PRD creation follows a whole-to-parts process with human review gate.
 * PRDs are DRAFT until human approves.
 *
 * Flow: Problem arrives -> ISC creation -> PRD assembly -> Human review -> Approval
 */

import type { PRD, PRDStatus } from "../s0/prd.ts";
import type { ISC } from "../s0/isc.ts";
import type { ProblemInput, PRDCreationResult } from "./types.ts";
import { PRD_STATUS_TRANSITIONS } from "./types.ts";

/**
 * Create a PRD from a problem input.
 * PRD is always created as DRAFT — human review gate is mandatory.
 *
 * ISC Criterion 1: PRD creation follows whole-to-parts process with human review gate
 * ISC Criterion 8: PRD status progression follows defined lifecycle states from S0
 */
export function createPRD(
  id: string,
  problemInput: ProblemInput,
  criteria: ISC[],
  plan: string,
): PRDCreationResult {
  const now = new Date().toISOString().split("T")[0]!;

  const prd: PRD = {
    id,
    status: "DRAFT" as PRDStatus,
    effortLevel: "Standard",
    created: now,
    updated: now,
    iteration: 0,
    slices: [],
    iscCriteria: criteria,
    context: {
      problemSpace: problemInput.intent,
      keyFiles: {},
      constraints: problemInput.constraints,
      decisionsMade: [],
    },
    plan,
    log: [],
  };

  return {
    prd,
    requiresHumanReview: true,
  };
}

/**
 * Transition a PRD to a new status, enforcing the defined lifecycle.
 * Lifecycle: DRAFT -> CRITERIA_DEFINED -> PLANNED -> IN_PROGRESS -> VERIFYING -> COMPLETE/FAILED/BLOCKED
 *
 * ISC Criterion 8: PRD status progression follows defined lifecycle states from S0
 */
export function transitionPRDStatus(
  prd: PRD,
  newStatus: PRDStatus,
): PRD {
  const allowedTransitions = PRD_STATUS_TRANSITIONS[prd.status];
  if (!allowedTransitions.includes(newStatus)) {
    throw new Error(
      `Invalid PRD status transition: ${prd.status} -> ${newStatus}. ` +
      `Allowed: ${allowedTransitions.join(", ") || "none"}`,
    );
  }

  return {
    ...prd,
    status: newStatus,
    updated: new Date().toISOString().split("T")[0]!,
  };
}

/**
 * Check whether a PRD has passed the human review gate.
 * A PRD must not be DRAFT to proceed with build.
 */
export function hasPassedHumanReview(prd: PRD): boolean {
  return prd.status !== "DRAFT";
}
