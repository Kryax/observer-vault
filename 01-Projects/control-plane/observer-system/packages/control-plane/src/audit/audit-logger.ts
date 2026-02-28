// S3: AuditLogger — coordinates JSONL writes + SQLite indexing
// Implements the AuditLogger and AuditStore interfaces from @observer/shared
// Synchronous, blocking writes — if audit can't write, the request doesn't proceed
// Circuit breaker: 5 consecutive failures sets CRITICAL health flag

import { join } from "node:path";
import type {
  AuditLogger as IAuditLogger,
  AuditStore as IAuditStore,
  AuditEvent,
  AuditFilter,
  AuditQueryResult,
} from "@observer/shared";
import { JsonlWriter } from "./jsonl-writer.js";
import { SqliteIndex } from "./sqlite-index.js";
import { sanitizeEvent } from "./credential-sanitizer.js";

const CIRCUIT_BREAKER_THRESHOLD = 5;

export interface AuditLoggerOptions {
  /** Directory for audit data files */
  dataDir: string;
  /** Max JSONL file size before rotation (bytes). Default: 100MB */
  maxFileSizeBytes?: number;
  /** JSONL filename. Default: "audit.jsonl" */
  jsonlFilename?: string;
  /** SQLite filename. Default: "audit-index.db" */
  sqliteFilename?: string;
}

export class AuditLoggerImpl implements IAuditLogger, IAuditStore {
  private readonly jsonlWriter: JsonlWriter;
  private readonly sqliteIndex: SqliteIndex;

  // Circuit breaker state
  private consecutiveFailures = 0;
  private criticalFlag = false;

  constructor(options: AuditLoggerOptions) {
    const jsonlPath = join(options.dataDir, options.jsonlFilename ?? "audit.jsonl");
    const sqlitePath = join(options.dataDir, options.sqliteFilename ?? "audit-index.db");

    this.jsonlWriter = new JsonlWriter({
      filePath: jsonlPath,
      maxSizeBytes: options.maxFileSizeBytes,
    });

    this.sqliteIndex = new SqliteIndex({
      dbPath: sqlitePath,
    });
  }

  // --- AuditLogger interface ---

  /**
   * Log an audit event. SYNCHRONOUS AND BLOCKING.
   * 1. Sanitize credentials from event details
   * 2. Write to JSONL with fsync
   * 3. Insert into SQLite index
   * 4. Track failures for circuit breaker
   *
   * Throws on write failure — caller decides whether to proceed.
   */
  log(event: AuditEvent): void {
    // Sanitize credentials before persisting
    const sanitized = sanitizeEvent(event);

    try {
      // Primary store: JSONL (source of truth)
      this.jsonlWriter.append(sanitized);

      // Secondary store: SQLite index (queryable)
      this.sqliteIndex.insert(sanitized);

      // Reset circuit breaker on success
      this.consecutiveFailures = 0;
    } catch (error) {
      this.consecutiveFailures++;

      if (this.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
        this.criticalFlag = true;
      }

      throw error;
    }
  }

  /**
   * Query audit events via the SQLite index.
   */
  query(filter: AuditFilter): AuditQueryResult {
    return this.sqliteIndex.query(filter);
  }

  /**
   * Return the last N events from the JSONL file.
   */
  tail(count: number): AuditEvent[] {
    return this.jsonlWriter.tail(count);
  }

  // --- AuditStore interface ---

  /**
   * Append is an alias for log — same write path.
   */
  append(event: AuditEvent): void {
    this.log(event);
  }

  /**
   * Rebuild SQLite index from all JSONL files.
   * 1. Read all events from JSONL (archived + current)
   * 2. Drop and recreate SQLite table
   * 3. Bulk insert all events
   */
  rebuild(): void {
    const allEvents = this.jsonlWriter.readAllFiles();
    this.sqliteIndex.dropAndRecreate();
    this.sqliteIndex.bulkInsert(allEvents);
  }

  // --- Health and status ---

  /**
   * Check if the circuit breaker has tripped (5+ consecutive failures).
   * Used by the health monitor to report CRITICAL status.
   */
  isCritical(): boolean {
    return this.criticalFlag;
  }

  /**
   * Get the current consecutive failure count.
   */
  getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  /**
   * Reset the circuit breaker (after manual intervention).
   */
  resetCircuitBreaker(): void {
    this.consecutiveFailures = 0;
    this.criticalFlag = false;
  }

  /**
   * Get the JSONL file size in bytes.
   */
  getJsonlSizeBytes(): number {
    return this.jsonlWriter.getSize();
  }

  /**
   * Get the SQLite database size in bytes.
   */
  getSqliteSizeBytes(): number {
    return this.sqliteIndex.getDbSizeBytes();
  }

  /**
   * Get total event count from the SQLite index.
   */
  getEventCount(): number {
    return this.sqliteIndex.getEventCount();
  }

  /**
   * Graceful shutdown — close all file handles and database connections.
   */
  close(): void {
    this.jsonlWriter.close();
    this.sqliteIndex.close();
  }
}
