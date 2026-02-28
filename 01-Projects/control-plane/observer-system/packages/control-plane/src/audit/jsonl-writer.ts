// S3: Append-only JSONL writer
// O_APPEND | O_WRONLY | O_CREAT with mode 0o600
// fsync after every write — data persists immediately
// Rotation at configured size threshold
// Archived files get permissions 0o400 (read-only)

import {
  openSync,
  writeSync,
  fsyncSync,
  closeSync,
  statSync,
  chmodSync,
  renameSync,
  readdirSync,
  readFileSync,
  existsSync,
  mkdirSync,
  constants,
} from "node:fs";
import { join, dirname, basename } from "node:path";
import type { AuditEvent } from "@observer/shared";

const DEFAULT_MAX_SIZE_BYTES = 100 * 1024 * 1024; // 100MB
const FILE_MODE = 0o600; // Owner read/write only
const ARCHIVE_MODE = 0o400; // Owner read-only
let rotationCounter = 0;

export interface JsonlWriterOptions {
  filePath: string;
  maxSizeBytes?: number;
}

export class JsonlWriter {
  private readonly filePath: string;
  private readonly maxSizeBytes: number;
  private fd: number;
  private currentSize: number;

  constructor(options: JsonlWriterOptions) {
    this.filePath = options.filePath;
    this.maxSizeBytes = options.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;

    // Ensure directory exists
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Open with O_APPEND | O_WRONLY | O_CREAT
    this.fd = openSync(
      this.filePath,
      constants.O_APPEND | constants.O_WRONLY | constants.O_CREAT,
      FILE_MODE,
    );

    // Track current file size for rotation
    try {
      const stat = statSync(this.filePath);
      this.currentSize = stat.size;
    } catch {
      this.currentSize = 0;
    }
  }

  /**
   * Append an event as a single JSONL line.
   * Each write is followed by fsync — data is on disk after return.
   * Throws on write failure (caller handles circuit breaking).
   */
  append(event: AuditEvent): void {
    const line = JSON.stringify(event) + "\n";
    const buf = Buffer.from(line, "utf-8");

    writeSync(this.fd, buf);
    fsyncSync(this.fd);

    this.currentSize += buf.length;

    // Check rotation threshold
    if (this.currentSize >= this.maxSizeBytes) {
      this.rotate();
    }
  }

  /**
   * Rotate the current file:
   * 1. Close current fd
   * 2. Rename current file with timestamp suffix
   * 3. Set archived file to read-only (0o400)
   * 4. Open new file with same path
   */
  private rotate(): void {
    closeSync(this.fd);

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const seq = String(rotationCounter++).padStart(4, "0");
    const dir = dirname(this.filePath);
    const base = basename(this.filePath, ".jsonl");
    const archivePath = join(dir, `${base}.${timestamp}.${seq}.jsonl`);

    renameSync(this.filePath, archivePath);
    chmodSync(archivePath, ARCHIVE_MODE);

    // Open fresh file
    this.fd = openSync(
      this.filePath,
      constants.O_APPEND | constants.O_WRONLY | constants.O_CREAT,
      FILE_MODE,
    );
    this.currentSize = 0;
  }

  /**
   * Read all events from the current JSONL file.
   * Used for rebuild operations.
   */
  readAll(): AuditEvent[] {
    // Flush first
    fsyncSync(this.fd);

    if (!existsSync(this.filePath)) return [];

    const content = readFileSync(this.filePath, "utf-8");
    return content
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as AuditEvent);
  }

  /**
   * Read events from all JSONL files (archived + current) in chronological order.
   * Used for full rebuild of the SQLite index.
   */
  readAllFiles(): AuditEvent[] {
    // Flush current file
    fsyncSync(this.fd);

    const dir = dirname(this.filePath);
    const base = basename(this.filePath, ".jsonl");

    // Find archived files
    const allFiles: string[] = [];

    if (existsSync(dir)) {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        if (entry.startsWith(base) && entry.endsWith(".jsonl") && entry !== basename(this.filePath)) {
          allFiles.push(join(dir, entry));
        }
      }
    }

    // Sort archived files by name (timestamp-based, so chronological)
    allFiles.sort();

    // Current file goes last
    if (existsSync(this.filePath)) {
      allFiles.push(this.filePath);
    }

    const events: AuditEvent[] = [];
    for (const file of allFiles) {
      const content = readFileSync(file, "utf-8");
      const fileEvents = content
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line) as AuditEvent);
      events.push(...fileEvents);
    }

    return events;
  }

  /**
   * Read the last N events from the current file (for tail operation).
   */
  tail(count: number): AuditEvent[] {
    const events = this.readAll();
    return events.slice(-count);
  }

  /**
   * Get the current file size in bytes.
   */
  getSize(): number {
    return this.currentSize;
  }

  /**
   * Close the file descriptor. Must be called during shutdown.
   */
  close(): void {
    try {
      fsyncSync(this.fd);
      closeSync(this.fd);
    } catch {
      // Already closed — ignore
    }
  }
}
