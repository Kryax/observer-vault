// S4: Periodic timeout scheduler for overdue approvals
// Checks for expired approvals on a configurable interval
// SECURITY INVARIANT: timeout = denied (fail safe, NOT fail open)

import type { ApprovalStore } from "./approval-store.js";

export interface TimeoutSchedulerOptions {
  /** The approval store to check for expired approvals */
  store: ApprovalStore;
  /** Interval between expiry checks in milliseconds (default: 5000) */
  intervalMs?: number;
  /** Callback invoked when approvals are expired */
  onExpired?: (expiredIds: string[], count: number) => void;
}

export class TimeoutScheduler {
  private readonly store: ApprovalStore;
  private readonly intervalMs: number;
  private readonly onExpired: ((expiredIds: string[], count: number) => void) | undefined;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(options: TimeoutSchedulerOptions) {
    this.store = options.store;
    this.intervalMs = options.intervalMs ?? 5000;
    this.onExpired = options.onExpired;
  }

  /**
   * Start the periodic expiry check.
   * Safe to call multiple times -- will not create duplicate intervals.
   */
  start(): void {
    if (this.timer !== null) return;

    this.timer = setInterval(() => {
      this.tick();
    }, this.intervalMs);

    // Prevent the timer from keeping the process alive
    if (this.timer && typeof this.timer === "object" && "unref" in this.timer) {
      this.timer.unref();
    }
  }

  /**
   * Stop the periodic expiry check.
   */
  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Run a single expiry check. Exposed for testing without needing the timer.
   * Returns the number of approvals expired.
   */
  tick(): number {
    const now = new Date().toISOString();
    const expired = this.store.getExpiredPending(now);

    if (expired.length === 0) return 0;

    const ids = expired.map((row) => row.approval_id);
    const count = this.store.expireBatch(ids, now);

    if (this.onExpired && count > 0) {
      this.onExpired(ids, count);
    }

    return count;
  }

  /**
   * Whether the scheduler is currently running.
   */
  isRunning(): boolean {
    return this.timer !== null;
  }
}
