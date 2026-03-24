/**
 * R6 — Cross-River Router
 *
 * Wires Intake, Processing, Reflection rivers and Pairing Service together.
 * ISC-R37 through ISC-R43.
 */

import type { PairedRecord, RiverName } from './types.ts';
import type { IntakeRiver } from './intake.ts';
import type { ProcessingRiver } from './processing.ts';
import type { ReflectionRiver } from './reflection.ts';
import type { PairingService } from './pairing.ts';
import { RecursionGuard } from './recursion-guard.ts';

// ---------------------------------------------------------------------------
// Routing Log
// ---------------------------------------------------------------------------

export interface RouteLogEntry {
  readonly recordId: string;
  readonly from: RiverName | 'pairing_service' | 'external';
  readonly to: RiverName | 'pairing_service' | 'store';
  readonly reason: string;
  readonly timestamp: string;
}

// ---------------------------------------------------------------------------
// Cross-River Router
// ---------------------------------------------------------------------------

export class CrossRiverRouter {
  private readonly intake: IntakeRiver;
  private readonly processing: ProcessingRiver;
  private readonly reflection: ReflectionRiver;
  private readonly pairingService: PairingService;
  private readonly recursionGuard: RecursionGuard;
  private readonly routeLog: RouteLogEntry[] = [];

  constructor(config: {
    intake: IntakeRiver;
    processing: ProcessingRiver;
    reflection: ReflectionRiver;
    pairingService: PairingService;
    maxRecursionDepth?: number;
  }) {
    this.intake = config.intake;
    this.processing = config.processing;
    this.reflection = config.reflection;
    this.pairingService = config.pairingService;
    this.recursionGuard = new RecursionGuard(config.maxRecursionDepth ?? 3);
  }

  /**
   * Ingest external material into the intake river.
   */
  ingest(record: PairedRecord): boolean {
    const accepted = this.intake.accept(record);
    if (accepted) {
      this.log(record.id, 'external', 'intake', 'External material ingested');
    }
    return accepted;
  }

  /**
   * Process the full pipeline: Intake → Pairing → Processing.
   * ISC-R37: Material flows from Intake to Processing via pairing service.
   */
  processIntake(): void {
    const results = this.intake.processBuffer();

    for (const { record, decision } of results) {
      if (decision.target === 'pairing_service') {
        // Route through pairing service
        const pairingResult = this.pairingService.pair(record);
        this.log(record.id, 'intake', 'pairing_service', decision.reason);

        if (pairingResult.paired) {
          // Paired record goes to processing
          this.processing.accept(pairingResult.record);
          this.log(pairingResult.record.id, 'pairing_service', 'processing', 'Paired and forwarded');
        }
      } else if (decision.target === 'processing') {
        this.processing.accept(record);
        this.log(record.id, 'intake', 'processing', decision.reason);
      }
    }
  }

  /**
   * Process the processing river and route anomalies to reflection.
   * ISC-R38: Anomalies in Processing generate Reflection entries.
   */
  processProcessing(): void {
    const results = this.processing.processBuffer();

    for (const { record, governanceRequired } of results) {
      if (governanceRequired) {
        // Anomaly: sovereignty-gated records generate reflection entries
        this.reflection.accept({
          ...record,
          position: {
            river: 'reflection',
            channel: 'slow',
            stage: 'anomaly_observation',
            enteredAt: new Date().toISOString(),
          },
        });
        this.log(record.id, 'processing', 'reflection', 'Governance-required record triggers reflection');
      }
    }
  }

  /**
   * Process reflection and route outputs back.
   * ISC-R39: Template updates → Intake.
   * ISC-R40: Config deltas → Processing.
   * ISC-R42: Bounded recursion.
   */
  processReflection(): void {
    const results = this.reflection.processBuffer();

    for (const { record, decision } of results) {
      if (decision.target === 'intake') {
        if (this.recursionGuard.recordCycle('reflection', 'intake')) {
          this.intake.accept(record);
          this.log(record.id, 'reflection', 'intake', 'Template update feedback');
        }
        // ISC-R42: If recursion bound exceeded, silently drop
      } else if (decision.target === 'processing') {
        if (this.recursionGuard.recordCycle('reflection', 'processing')) {
          this.processing.accept(record);
          this.log(record.id, 'reflection', 'processing', 'Config delta feedback');
        }
      }
    }
  }

  /**
   * Run one full cycle: intake → processing → reflection.
   */
  runCycle(): void {
    this.processIntake();
    this.processProcessing();
    this.processReflection();
  }

  /** ISC-R41: Get the routing log. */
  getRouteLog(): readonly RouteLogEntry[] {
    return this.routeLog;
  }

  /** ISC-R43: Total cross-river flow rate. */
  flowRate(): { total: number; byDirection: Record<string, number> } {
    const byDirection: Record<string, number> = {};
    for (const entry of this.routeLog) {
      const key = `${entry.from}→${entry.to}`;
      byDirection[key] = (byDirection[key] ?? 0) + 1;
    }
    return { total: this.routeLog.length, byDirection };
  }

  /** Get recursion guard (for testing). */
  getRecursionGuard(): RecursionGuard {
    return this.recursionGuard;
  }

  private log(recordId: string, from: RouteLogEntry['from'], to: RouteLogEntry['to'], reason: string): void {
    this.routeLog.push({
      recordId,
      from,
      to,
      reason,
      timestamp: new Date().toISOString(),
    });
  }
}
