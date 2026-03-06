/**
 * S0 — Core Types & Interfaces
 *
 * The foundation. Every other component imports from here.
 * No component defines its own types for cross-component communication.
 */

export type {
  ObserverSessionStart,
  ObserverPreToolUse,
  ObserverPostToolUse,
  ObserverSessionStop,
  ObserverEvent,
} from "./events.ts";

export type {
  MotifAxis,
  MotifReference,
} from "./motif.ts";

export type {
  ISCStatus,
  VerificationMethod,
  ConfidenceTag,
  ISCPriority,
  ISC,
} from "./isc.ts";

export type {
  PRDStatus,
  Slice,
  PRDLogEntry,
  PRDContext,
  PRD,
} from "./prd.ts";

export type {
  StructuralDiagnosis,
  TaskFailureEscalation,
  ProcessQualityTrigger,
  ProcessQualityEscalation,
  EscalationEvent,
} from "./escalation.ts";

export type {
  SubAgentTask,
  SubAgentResult,
  SubAgentOutput,
} from "./sub-agent.ts";
