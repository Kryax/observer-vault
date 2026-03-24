/**
 * SpacyBridge — TypeScript-side manager for the spaCy Python subprocess.
 *
 * Launches spacy_worker.py as a long-lived subprocess, communicates via
 * stdin/stdout JSONL protocol, and handles crash recovery.
 *
 * Protocol:
 *   -> stdin:  {"texts": ["t1", "t2"]}   (batch request)
 *   <- stdout: {...SpacyParseResult}      (one per doc)
 *   <- stdout: {"batch_done": true, "count": N}  (end marker)
 *   -> stdin:  {"shutdown": true}         (clean shutdown)
 */

import { Subprocess } from "bun";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ── Public types ────────────────────────────────────────────────────────────

export interface SpacyToken {
  text: string;
  pos: string;
  dep: string;
  head: number;
}

export interface ProcessRelationship {
  agent: string;
  action: string;
  patient: string;
  type: "causal" | "temporal" | "governance" | "constraint";
}

export interface GovernanceRelationship {
  governor: string;
  governed: string;
  mechanism: string;
}

export interface SpacyParseResult {
  docIndex: number;
  tokens: SpacyToken[];
  processRelationships: ProcessRelationship[];
  temporalConnectors: string[];
  governanceRelationships: GovernanceRelationship[];
}

// ── Internal types ──────────────────────────────────────────────────────────

interface ReadyMessage {
  ready: true;
  model: string;
}

interface BatchDoneMessage {
  batch_done: true;
  count: number;
}

interface ErrorMessage {
  error: string;
}

type WorkerMessage = SpacyParseResult | BatchDoneMessage | ErrorMessage | ReadyMessage;

// ── Helpers ─────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = resolve(__dirname, "spacy_worker.py");

function isReadyMessage(msg: WorkerMessage): msg is ReadyMessage {
  return "ready" in msg && (msg as ReadyMessage).ready === true;
}

function isBatchDone(msg: WorkerMessage): msg is BatchDoneMessage {
  return "batch_done" in msg && (msg as BatchDoneMessage).batch_done === true;
}

function isErrorMessage(msg: WorkerMessage): msg is ErrorMessage {
  return "error" in msg;
}

function isParseResult(msg: WorkerMessage): msg is SpacyParseResult {
  return "docIndex" in msg;
}

// ── SpacyBridge ─────────────────────────────────────────────────────────────

export class SpacyBridge {
  private proc: Subprocess<"pipe", "pipe", "pipe"> | null = null;
  private alive: boolean = false;
  private starting: boolean = false;
  private buffer: string = "";
  private modelName: string;
  private pythonPath: string;
  private restartCount: number = 0;
  private maxRestarts: number = 5;
  private lastCrashTime: number = 0;

  constructor(
    modelName: string = "en_core_web_md",
    pythonPath: string = "python3",
  ) {
    this.modelName = modelName;
    this.pythonPath = pythonPath;
  }

  /**
   * Launch the spaCy subprocess and wait for the ready signal.
   */
  async start(): Promise<void> {
    if (this.alive) return;
    if (this.starting) return;
    this.starting = true;

    try {
      this.proc = Bun.spawn([this.pythonPath, WORKER_PATH, this.modelName], {
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
      });

      this.buffer = "";

      // Wait for ready signal with timeout
      const readyMsg = await this.readNextMessage(30_000); // 30s for model load
      if (!readyMsg || !isReadyMessage(readyMsg)) {
        const errText = readyMsg && isErrorMessage(readyMsg) ? readyMsg.error : "no ready signal received";
        throw new Error(`spaCy worker failed to start: ${errText}`);
      }

      this.alive = true;
      this.starting = false;
      this.monitorProcess();
    } catch (err) {
      this.starting = false;
      this.alive = false;
      this.cleanup();
      throw err;
    }
  }

  /**
   * Send a batch of texts and receive parsed results.
   * Automatically restarts the subprocess if it has crashed.
   */
  async processBatch(texts: string[]): Promise<SpacyParseResult[]> {
    if (!this.alive) {
      await this.attemptRestart();
    }

    if (!this.proc || !this.alive) {
      throw new Error("spaCy subprocess is not running");
    }

    // Send batch request
    const request = JSON.stringify({ texts }) + "\n";
    this.proc.stdin.write(request);
    await this.proc.stdin.flush();

    // Collect results until batch_done marker
    const results: SpacyParseResult[] = [];
    const expectedCount = texts.length;

    while (true) {
      const msg = await this.readNextMessage(60_000); // 60s timeout per batch

      if (!msg) {
        // Timeout or EOF — subprocess probably died
        this.alive = false;
        throw new Error("spaCy subprocess timed out or died during batch processing");
      }

      if (isErrorMessage(msg)) {
        throw new Error(`spaCy worker error: ${msg.error}`);
      }

      if (isBatchDone(msg)) {
        if (msg.count !== expectedCount) {
          console.warn(
            `spaCy batch count mismatch: expected ${expectedCount}, got ${msg.count}`,
          );
        }
        break;
      }

      if (isParseResult(msg)) {
        results.push(msg);
      }
    }

    return results;
  }

  /**
   * Cleanly shut down the subprocess.
   */
  async shutdown(): Promise<void> {
    if (!this.proc) return;

    try {
      if (this.alive) {
        this.proc.stdin.write(JSON.stringify({ shutdown: true }) + "\n");
        await this.proc.stdin.flush();
        this.proc.stdin.end();

        // Wait up to 5 seconds for clean exit
        const exitPromise = this.proc.exited;
        const timeout = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), 5_000),
        );
        const result = await Promise.race([exitPromise, timeout]);

        if (result === null) {
          // Force kill if didn't exit cleanly
          this.proc.kill("SIGKILL");
        }
      }
    } catch {
      // Ignore errors during shutdown
    } finally {
      this.alive = false;
      this.cleanup();
    }
  }

  /**
   * Check if the subprocess is alive.
   */
  isAlive(): boolean {
    return this.alive;
  }

  // ── Private methods ─────────────────────────────────────────────────────

  /**
   * Read the next JSON message from stdout.
   * Buffers partial lines and parses complete JSONL lines.
   */
  private async readNextMessage(timeoutMs: number): Promise<WorkerMessage | null> {
    const deadline = Date.now() + timeoutMs;
    const reader = this.proc?.stdout?.getReader();
    if (!reader) return null;

    const decoder = new TextDecoder();

    try {
      while (Date.now() < deadline) {
        // Check if we already have a complete line in the buffer
        const newlineIdx = this.buffer.indexOf("\n");
        if (newlineIdx !== -1) {
          const line = this.buffer.slice(0, newlineIdx).trim();
          this.buffer = this.buffer.slice(newlineIdx + 1);
          if (line) {
            try {
              return JSON.parse(line) as WorkerMessage;
            } catch {
              // Skip malformed lines
              continue;
            }
          }
          continue;
        }

        // Read more data from stdout with timeout
        const remaining = deadline - Date.now();
        if (remaining <= 0) break;

        const readPromise = reader.read();
        const timeoutPromise = new Promise<{ done: true; value: undefined }>(
          (resolve) => setTimeout(() => resolve({ done: true, value: undefined }), remaining),
        );

        const { done, value } = await Promise.race([readPromise, timeoutPromise]);

        if (done && !value) {
          // Stream ended or timeout
          break;
        }

        if (value) {
          this.buffer += decoder.decode(value, { stream: true });
        }
      }
    } finally {
      reader.releaseLock();
    }

    return null;
  }

  /**
   * Monitor subprocess for crashes and set alive=false on exit.
   */
  private monitorProcess(): void {
    if (!this.proc) return;

    this.proc.exited.then((code) => {
      if (this.alive) {
        // Unexpected exit
        this.alive = false;
        this.lastCrashTime = Date.now();
        console.error(`spaCy subprocess exited unexpectedly with code ${code}`);
      }
    });
  }

  /**
   * Attempt to restart a crashed subprocess.
   * Respects max restart count and cooldown.
   */
  private async attemptRestart(): Promise<void> {
    if (this.restartCount >= this.maxRestarts) {
      throw new Error(
        `spaCy subprocess exceeded max restart count (${this.maxRestarts})`,
      );
    }

    // Brief cooldown to avoid tight restart loops
    const timeSinceCrash = Date.now() - this.lastCrashTime;
    if (timeSinceCrash < 1_000 && this.lastCrashTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1_000 - timeSinceCrash));
    }

    this.restartCount++;
    this.cleanup();
    console.warn(
      `Restarting spaCy subprocess (attempt ${this.restartCount}/${this.maxRestarts})...`,
    );
    await this.start();
  }

  /**
   * Clean up subprocess references.
   */
  private cleanup(): void {
    if (this.proc) {
      try {
        this.proc.kill("SIGKILL");
      } catch {
        // Process may already be dead
      }
      this.proc = null;
    }
    this.buffer = "";
  }
}
