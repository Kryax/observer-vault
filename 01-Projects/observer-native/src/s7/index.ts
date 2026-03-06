/**
 * S7 — Escalation Layer
 *
 * The sovereignty boundary — where AI stops and human decides.
 * Two independent escalation paths, both with blocking human gates.
 */

export {
  createTaskFailureEscalation,
  requestCouncilDiagnosis,
  createTaskFailureGate,
  resolveTaskFailureGate,
  executeTaskFailureLoop,
} from "./task-failure.ts";

export {
  createProcessQualityEscalation,
  createProcessQualityGate,
  resolveProcessQualityGate,
  checkProcessQualityTrigger,
} from "./process-quality.ts";

export {
  SOVEREIGNTY_PRINCIPLE,
  assertGateResolved,
  requiresHumanIntervention,
  validateResolution,
  createEscalationAuditRecord,
} from "./sovereignty.ts";

export type {
  TaskFailureResolution,
  ProcessQualityResolution,
  GateStatus,
  HumanGate,
  TaskFailureGate,
  ProcessQualityGate,
  CouncilDiagnosisRequest,
  CouncilDiagnosisResult,
  ProcessQualityEscalationSource,
} from "./types.ts";
