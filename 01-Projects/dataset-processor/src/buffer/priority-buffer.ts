import { Database } from 'bun:sqlite';
import type { VerbRecord } from '../types/verb-record';

/** Buffer statistics shape. */
export interface BufferStats {
  count: number;
  minPriority: number;
  maxPriority: number;
  avgPriority: number;
  oldestAge: number; // seconds since oldest candidate was enqueued
}

/** A candidate stored in the priority buffer. */
export interface BufferCandidate {
  id: string;
  priorityScore: number;
  verbRecordJson: string;
  enqueuedAt: string;
  expiresAt: string;
}

/** Input for enqueuing a candidate into the priority buffer. */
export interface EnqueueInput {
  id: string;
  verbRecord: VerbRecord;
  tierBScore: number;
  gapRelevance: number;
  isBlindExtraction: boolean;
}

/**
 * PriorityBuffer -- SQLite-backed bounded priority queue.
 *
 * Sits between Tier B output and Tier C input. Enforces capacity via
 * BBWOP overflow policy: when full, lowest-priority candidate is evicted.
 *
 * Priority formula: tierBScore * gapRelevance * noveltyBonus
 *   where noveltyBonus = 1.5 for blind extractions, 1.0 for primed.
 */
export class PriorityBuffer {
  constructor(
    private db: Database,
    private capacity: number = 10_000,
    private expiryHours: number = 72,
  ) {}

  /** Enqueue a candidate. If buffer is at capacity, evict lowest-priority. */
  enqueue(input: EnqueueInput): void {
    const noveltyBonus = input.isBlindExtraction ? 1.5 : 1.0;
    const priorityScore = input.tierBScore * input.gapRelevance * noveltyBonus;
    const verbRecordJson = JSON.stringify(input.verbRecord);

    // If at capacity, check whether this candidate even beats the current minimum.
    const currentCount = this.count();
    if (currentCount >= this.capacity) {
      const minRow = this.db.prepare(
        'SELECT id, priority_score FROM priority_buffer ORDER BY priority_score ASC LIMIT 1',
      ).get() as { id: string; priority_score: number } | null;

      if (minRow) {
        if (priorityScore <= minRow.priority_score) {
          // New candidate doesn't beat the lowest -- discard it.
          return;
        }
        // Evict lowest to make room.
        this.db.prepare('DELETE FROM priority_buffer WHERE id = ?').run(minRow.id);
      }
    }

    this.db.prepare(`
      INSERT OR REPLACE INTO priority_buffer (id, priority_score, verb_record_json, enqueued_at, expires_at)
      VALUES (?, ?, ?, datetime('now'), datetime('now', '+${this.expiryHours} hours'))
    `).run(input.id, priorityScore, verbRecordJson);
  }

  /** Dequeue the N highest-priority candidates, removing them from the buffer. */
  dequeue(n: number): VerbRecord[] {
    const rows = this.db.prepare(
      'SELECT id, verb_record_json FROM priority_buffer ORDER BY priority_score DESC LIMIT ?',
    ).all(n) as { id: string; verb_record_json: string }[];

    if (rows.length === 0) return [];

    // Delete dequeued rows
    const ids = rows.map((r) => r.id);
    const placeholders = ids.map(() => '?').join(', ');
    this.db.prepare(`DELETE FROM priority_buffer WHERE id IN (${placeholders})`).run(...ids);

    return rows.map((r) => JSON.parse(r.verb_record_json) as VerbRecord);
  }

  /** Remove expired candidates (older than expiryHours). Returns count evicted. */
  maintenance(): number {
    const result = this.db.prepare(
      "DELETE FROM priority_buffer WHERE expires_at <= datetime('now')",
    ).run();
    return result.changes;
  }

  /** Get buffer statistics. */
  getStats(): BufferStats {
    const row = this.db.prepare(`
      SELECT
        COUNT(*) as count,
        COALESCE(MIN(priority_score), 0) as min_priority,
        COALESCE(MAX(priority_score), 0) as max_priority,
        COALESCE(AVG(priority_score), 0) as avg_priority,
        COALESCE(
          CAST((julianday('now') - julianday(MIN(enqueued_at))) * 86400 AS INTEGER),
          0
        ) as oldest_age
      FROM priority_buffer
    `).get() as {
      count: number;
      min_priority: number;
      max_priority: number;
      avg_priority: number;
      oldest_age: number;
    };

    return {
      count: row.count,
      minPriority: row.min_priority,
      maxPriority: row.max_priority,
      avgPriority: row.avg_priority,
      oldestAge: row.oldest_age,
    };
  }

  /** Get current buffer count. */
  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM priority_buffer').get() as { count: number };
    return row.count;
  }
}
