/**
 * S0 — ISC Schema (PRD 3.0.2)
 *
 * Typed structure for Ideal State Criteria. Each criterion is binary
 * testable, 8-12 words, state not action.
 */

import type { MotifReference } from "./motif.ts";

export type ISCStatus = "pending" | "in_progress" | "passing" | "failing";

export type VerificationMethod =
  | "CLI"
  | "Test"
  | "Static"
  | "Browser"
  | "Grep"
  | "Read"
  | "Custom";

export type ConfidenceTag = "E" | "I" | "R";

export type ISCPriority = "CRITICAL" | "IMPORTANT" | "NICE";

export interface ISC {
  id: string;
  description: string;
  status: ISCStatus;
  verificationMethod: VerificationMethod;
  verificationCommand: string;
  confidenceTag: ConfidenceTag;
  priority: ISCPriority;
  motifSource?: MotifReference;
  evidence?: string;
}
