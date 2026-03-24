/**
 * R6 — Recursion Guard
 *
 * Bounded recursion enforcement for the Reflection→Intake→Processing→Reflection cycle.
 * ISC-R42: Max depth enforced (default 3).
 */

// ---------------------------------------------------------------------------
// Recursion Guard
// ---------------------------------------------------------------------------

export class RecursionGuard {
  private readonly maxDepth: number;
  private currentDepth: number = 0;
  private readonly log: Array<{ from: string; to: string; depth: number; timestamp: string }> = [];

  constructor(maxDepth: number = 3) {
    this.maxDepth = maxDepth;
  }

  /** Check if another recursion cycle is allowed. */
  canRecurse(): boolean {
    return this.currentDepth < this.maxDepth;
  }

  /** Record a recursion cycle. Returns false if bound exceeded. ISC-R42. */
  recordCycle(from: string, to: string): boolean {
    if (!this.canRecurse()) return false;
    this.currentDepth++;
    this.log.push({
      from,
      to,
      depth: this.currentDepth,
      timestamp: new Date().toISOString(),
    });
    return true;
  }

  /** Current recursion depth. */
  depth(): number {
    return this.currentDepth;
  }

  /** Maximum allowed depth. */
  limit(): number {
    return this.maxDepth;
  }

  /** Reset for new session. */
  reset(): void {
    this.currentDepth = 0;
    this.log.length = 0;
  }

  /** Get recursion log. */
  getLog(): ReadonlyArray<{ from: string; to: string; depth: number; timestamp: string }> {
    return this.log;
  }
}
