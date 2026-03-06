/**
 * S4 — Council Roles
 *
 * The five roles from the Council Redesign TDS that execute the
 * cognitive triad (Oscillate -> Converge -> Reflect) plus post-triad
 * execution (Builder).
 *
 * Roles:
 * 1. Perspective Agent — Oscillate phase, 2-4 in isolation
 * 2. Triangulator — Converge phase, single-thread synthesis
 * 3. Sentry — Converge phase, single-thread adversarial
 * 4. Reflector — Reflect phase, MANDATORY, observation only
 * 5. Builder — Post-triad execution, may fan out via S6
 */

// Types
export type {
  CouncilPhase,
  ProblemComplexity,
  PerspectiveLens,
  PerspectiveFraming,
  IndependenceCheckResult,
  OscillateOutput,
  KillListItem,
  TriangulatorOutput,
  SentryFlag,
  SentryOutput,
  ConvergeOutput,
  MotifCandidate,
  FrameworkDelta,
  ReflectorOutput,
  TriadReceipts,
  WorkPacket,
  BuilderResult,
  DeliberationStep,
  DeliberationRecord,
} from "./types.ts";

// Perspective Agent (Oscillate)
export {
  selectAgentCount,
  assignLenses,
  createPerspectiveFraming,
  checkIndependence,
  executeOscillate,
} from "./perspective-agent.ts";

// Triangulator (Converge)
export {
  validateKillList,
  executeTriangulation,
} from "./triangulator.ts";

// Sentry (Converge)
export { executeSentry } from "./sentry.ts";

// Reflector (Reflect — Mandatory)
export {
  validateOutputFloor,
  REFLECTOR_IS_MANDATORY,
  assertReflectorExecuted,
  REFLECTOR_AUTHORITY,
  createProcessEscalation,
  executeReflect,
} from "./reflector.ts";

// Builder (Post-Triad Execution)
export {
  assembleWorkPacket,
  validateWorkPacket,
  executeBuilder,
  createTaskFailureEscalation,
} from "./builder.ts";

// Deliberation Sequence
export { executeDeliberation } from "./deliberation.ts";
