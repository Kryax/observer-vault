/**
 * R7 — Convergence Event Persistence
 */

import { mkdirSync, appendFileSync, readFileSync, existsSync } from 'node:fs';
import type { ConvergenceEvent } from './convergence-types.ts';

export class ConvergenceStore {
  private readonly storePath: string;

  constructor(storeDir: string) {
    this.storePath = `${storeDir}/convergence-events.jsonl`;
    mkdirSync(storeDir, { recursive: true });
  }

  write(event: ConvergenceEvent): void {
    appendFileSync(this.storePath, JSON.stringify(event) + '\n', 'utf-8');
  }

  readAll(): ConvergenceEvent[] {
    if (!existsSync(this.storePath)) return [];
    const raw = readFileSync(this.storePath, 'utf-8');
    const events: ConvergenceEvent[] = [];
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try { events.push(JSON.parse(line) as ConvergenceEvent); } catch {}
    }
    return events;
  }

  queryByType(type: ConvergenceEvent['type']): ConvergenceEvent[] {
    return this.readAll().filter((e) => e.type === type);
  }
}
