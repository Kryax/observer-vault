/**
 * R9 — Session Trace
 *
 * Session-level river flow summary.
 * ISC-R56: Session handoffs include river state.
 * ISC-R58: Process traces are machine-readable D/I/R records.
 */

import type { RiverName } from './types.ts';
import type { IntakeRiver } from './intake.ts';
import type { ProcessingRiver } from './processing.ts';
import type { ReflectionRiver } from './reflection.ts';
import type { CrossRiverRouter } from './router.ts';
import type { ConvergenceDetector } from './convergence.ts';

// ---------------------------------------------------------------------------
// Session Trace
// ---------------------------------------------------------------------------

export interface RiverSessionTrace {
  readonly sessionId: string;
  readonly timestamp: string;
  readonly rivers: {
    readonly intake: RiverSnapshotData;
    readonly processing: RiverSnapshotData;
    readonly reflection: RiverSnapshotData;
  };
  readonly crossRiver: {
    readonly totalFlow: number;
    readonly flowByDirection: Record<string, number>;
    readonly recursionDepth: number;
  };
  readonly convergence: {
    readonly nounEvents: number;
    readonly verbEvents: number;
    readonly crossStreamEvents: number;
  };
  readonly dir: 'recurse';
}

export interface RiverSnapshotData {
  readonly bufferDepth: number;
  readonly bufferCapacity: number;
  readonly recordCount: number;
  readonly stageDistribution: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Trace Builder
// ---------------------------------------------------------------------------

export function buildSessionTrace(config: {
  sessionId: string;
  intake: IntakeRiver;
  processing: ProcessingRiver;
  reflection: ReflectionRiver;
  router: CrossRiverRouter;
  convergence: ConvergenceDetector;
}): RiverSessionTrace {
  const intakeState = config.intake.queryState();
  const processingState = config.processing.queryState();
  const reflectionState = config.reflection.queryState();
  const flow = config.router.flowRate();
  const convergenceEvents = config.convergence.getEvents();

  return {
    sessionId: config.sessionId,
    timestamp: new Date().toISOString(),
    rivers: {
      intake: {
        bufferDepth: intakeState.bufferDepth,
        bufferCapacity: intakeState.bufferCapacity,
        recordCount: intakeState.recordCount,
        stageDistribution: intakeState.stageDistribution as Record<string, number>,
      },
      processing: {
        bufferDepth: processingState.bufferDepth,
        bufferCapacity: processingState.bufferCapacity,
        recordCount: processingState.recordCount,
        stageDistribution: processingState.stageDistribution as Record<string, number>,
      },
      reflection: {
        bufferDepth: reflectionState.bufferDepth,
        bufferCapacity: reflectionState.bufferCapacity,
        recordCount: reflectionState.recordCount,
        stageDistribution: reflectionState.stageDistribution as Record<string, number>,
      },
    },
    crossRiver: {
      totalFlow: flow.total,
      flowByDirection: flow.byDirection,
      recursionDepth: config.router.getRecursionGuard().depth(),
    },
    convergence: {
      nounEvents: convergenceEvents.filter((e) => e.type === 'noun').length,
      verbEvents: convergenceEvents.filter((e) => e.type === 'verb').length,
      crossStreamEvents: convergenceEvents.filter((e) => e.type === 'cross_stream').length,
    },
    dir: 'recurse',
  };
}
