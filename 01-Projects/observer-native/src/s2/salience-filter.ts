/**
 * S2 — Salience Filter (PRD-20260308-s2-salience-filter)
 *
 * A thin layer above S1 events that marks significant events as highlights.
 * Uses simple heuristics — no NLP, no LLM inference.
 * The adapter stays dumb. This layer gets selective.
 *
 * Four heuristics:
 *   1. Motif-touch — events referencing active motif topics
 *   2. Error/failure — events indicating something went wrong
 *   3. Novel tool — first appearance of a tool in the session
 *   4. Long duration — operations exceeding a time threshold
 */

import type {
  ObserverEvent,
  ObserverPreToolUse,
  ObserverPostToolUse,
  ObserverSessionStop,
} from "../s0/events.ts";
import type { MotifEntry } from "./context-hydration.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SalienceTrigger =
  | { type: "motif_touch"; motifName: string }
  | { type: "error_or_failure"; detail: string }
  | { type: "novel_tool"; toolName: string }
  | { type: "long_duration"; durationMs: number };

export interface Highlight {
  /** The source event that was marked as significant. */
  event: ObserverEvent;
  /** Salience score: 0.0 (routine) to 1.0 (critical). */
  salience: number;
  /** Which heuristic(s) triggered this highlight. */
  triggers: SalienceTrigger[];
  /** ISO timestamp of when the highlight was produced. */
  timestamp: string;
}

export interface SalienceContext {
  /** Active motifs from the vault, used by motif-touch heuristic. */
  activeMotifs: MotifEntry[];
  /** Duration threshold in milliseconds for long-duration detection. */
  longDurationThresholdMs?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default threshold for long-duration detection (10 seconds). */
const DEFAULT_LONG_DURATION_MS = 10_000;

/** Salience contribution per heuristic. */
const SALIENCE_MOTIF = 0.3;
const SALIENCE_ERROR = 0.8;
const SALIENCE_NOVEL = 0.2;
const SALIENCE_LONG_DURATION = 0.4;

/** Tools that appear in nearly every session — excluded from novelty detection. */
const COMMON_TOOLS: ReadonlySet<string> = new Set([
  "Read",
  "Grep",
  "Glob",
  "Edit",
  "Write",
  "Bash",
]);

// ---------------------------------------------------------------------------
// Heuristic 1: Motif-touch
// ---------------------------------------------------------------------------

/**
 * Compares event content against active motif names and keywords.
 * An event "touches" a motif when its tool name, parameters, or file paths
 * reference concepts a motif describes.
 */
function checkMotifTouch(
  event: ObserverEvent,
  motifs: MotifEntry[],
): SalienceTrigger[] {
  if (motifs.length === 0) return [];

  const triggers: SalienceTrigger[] = [];
  const eventText = extractEventText(event).toLowerCase();

  for (const motif of motifs) {
    // Use the motif filename (minus extension) as the keyword to match
    const motifName = motif.filename.replace(/\.(md|json)$/, "");
    const keywords = motifName
      .split(/[-_]/)
      .filter((k) => k.length > 2)
      .map((k) => k.toLowerCase());

    const touched = keywords.some((kw) => eventText.includes(kw));
    if (touched) {
      triggers.push({ type: "motif_touch", motifName });
    }
  }

  return triggers;
}

/**
 * Extracts searchable text from an event for motif matching.
 */
function extractEventText(event: ObserverEvent): string {
  switch (event.type) {
    case "ObserverPreToolUse":
      return `${event.toolName} ${JSON.stringify(event.parameters)}`;
    case "ObserverPostToolUse":
      return `${event.toolName} ${JSON.stringify(event.toolInput)} ${JSON.stringify(event.result)}`;
    case "ObserverSessionStart":
      return event.workingDirectory;
    case "ObserverSessionStop":
      return event.reason ?? "";
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// Heuristic 2: Error and failure
// ---------------------------------------------------------------------------

/**
 * Detects events indicating something went wrong.
 * For PostToolUse: checks for error indicators in result.
 * For SessionStop: checks exitReason === "error".
 */
function checkErrorOrFailure(
  event: ObserverEvent,
): SalienceTrigger | null {
  if (event.type === "ObserverPostToolUse") {
    const detail = detectErrorInResult(event);
    if (detail) return { type: "error_or_failure", detail };
  }

  if (event.type === "ObserverSessionStop" && event.exitReason === "error") {
    return {
      type: "error_or_failure",
      detail: `Session stopped with error: ${event.reason ?? "unknown"}`,
    };
  }

  return null;
}

/**
 * Inspects a PostToolUse result for error indicators.
 * Checks for: error fields, non-zero exit codes, exception patterns.
 */
function detectErrorInResult(event: ObserverPostToolUse): string | null {
  const result = event.result;
  if (result == null) return null;

  if (typeof result === "string") {
    if (/error|exception|failed|ENOENT|EACCES|exit code [1-9]/i.test(result)) {
      return `${event.toolName}: error in output`;
    }
    return null;
  }

  if (typeof result === "object") {
    const obj = result as Record<string, unknown>;
    if (obj.error || obj.stderr) {
      return `${event.toolName}: ${String(obj.error ?? obj.stderr).slice(0, 80)}`;
    }
    if (typeof obj.exitCode === "number" && obj.exitCode !== 0) {
      return `${event.toolName}: exit code ${obj.exitCode}`;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Heuristic 3: Novel tool
// ---------------------------------------------------------------------------

/**
 * Tracks which tools have been used in the session so far.
 * Marks first appearances of non-common tools as novel.
 */
function checkNovelTool(
  event: ObserverEvent,
  toolsSeen: Set<string>,
): SalienceTrigger | null {
  if (event.type !== "ObserverPreToolUse") return null;

  const toolName = event.toolName;

  // Common tools are excluded from novelty detection
  if (COMMON_TOOLS.has(toolName)) {
    toolsSeen.add(toolName);
    return null;
  }

  if (!toolsSeen.has(toolName)) {
    toolsSeen.add(toolName);
    return { type: "novel_tool", toolName };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Heuristic 4: Long duration
// ---------------------------------------------------------------------------

/**
 * Detects slow operations by checking durationMs on PostToolUse events
 * or by matching PreToolUse→PostToolUse timestamp pairs.
 */
function checkLongDuration(
  event: ObserverEvent,
  thresholdMs: number,
  preToolTimestamps: Map<string, string>,
): SalienceTrigger | null {
  if (event.type === "ObserverPreToolUse") {
    // Store the pre-tool timestamp keyed by tool+session for pairing
    const key = `${event.toolName}:${event.sessionContext.timestamp}`;
    preToolTimestamps.set(key, event.sessionContext.timestamp);
    return null;
  }

  if (event.type === "ObserverPostToolUse") {
    // Prefer the explicit durationMs field if available
    if (event.durationMs != null && event.durationMs >= thresholdMs) {
      return { type: "long_duration", durationMs: event.durationMs };
    }

    // Fall back to timestamp differencing from pre/post pairs
    // Find the most recent pre-tool event for this tool name
    for (const [key, preTs] of preToolTimestamps) {
      if (key.startsWith(event.toolName + ":")) {
        const preTime = new Date(preTs).getTime();
        const postTime = new Date(event.sessionContext.timestamp).getTime();
        const elapsed = postTime - preTime;
        preToolTimestamps.delete(key);
        if (elapsed >= thresholdMs) {
          return { type: "long_duration", durationMs: elapsed };
        }
        break;
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main filter function
// ---------------------------------------------------------------------------

/**
 * Filters a stream of session events through salience heuristics.
 * Returns only events that trigger at least one heuristic.
 * Events are returned in original order with salience metadata attached.
 */
export function filterForSalience(
  events: ObserverEvent[],
  context: SalienceContext,
): Highlight[] {
  const thresholdMs = context.longDurationThresholdMs ?? DEFAULT_LONG_DURATION_MS;
  const toolsSeen = new Set<string>();
  const preToolTimestamps = new Map<string, string>();
  const highlights: Highlight[] = [];

  for (const event of events) {
    const triggers: SalienceTrigger[] = [];

    // Run all four heuristics
    const motifTriggers = checkMotifTouch(event, context.activeMotifs);
    triggers.push(...motifTriggers);

    const errorTrigger = checkErrorOrFailure(event);
    if (errorTrigger) triggers.push(errorTrigger);

    const novelTrigger = checkNovelTool(event, toolsSeen);
    if (novelTrigger) triggers.push(novelTrigger);

    const durationTrigger = checkLongDuration(event, thresholdMs, preToolTimestamps);
    if (durationTrigger) triggers.push(durationTrigger);

    // Only create a highlight if at least one heuristic triggered
    if (triggers.length > 0) {
      // Compute composite salience score — additive, capped at 1.0
      let salience = 0;
      for (const t of triggers) {
        switch (t.type) {
          case "motif_touch":
            salience += SALIENCE_MOTIF;
            break;
          case "error_or_failure":
            salience += SALIENCE_ERROR;
            break;
          case "novel_tool":
            salience += SALIENCE_NOVEL;
            break;
          case "long_duration":
            salience += SALIENCE_LONG_DURATION;
            break;
        }
      }
      salience = Math.min(salience, 1.0);

      highlights.push({
        event,
        salience,
        triggers,
        timestamp: extractTimestamp(event),
      });
    }
  }

  return highlights;
}

/**
 * Extracts the timestamp from any ObserverEvent.
 */
function extractTimestamp(event: ObserverEvent): string {
  switch (event.type) {
    case "ObserverSessionStart":
    case "ObserverSessionStop":
      return event.timestamp;
    case "ObserverPreToolUse":
    case "ObserverPostToolUse":
      return event.sessionContext.timestamp;
  }
}

// ---------------------------------------------------------------------------
// Summary formatting (for session-end hook integration)
// ---------------------------------------------------------------------------

/**
 * Formats highlights as a concise suffix for the session summary.
 * Returns empty string if no highlights.
 */
export function formatHighlightSummary(highlights: Highlight[]): string {
  if (highlights.length === 0) return "";

  const sorted = [...highlights].sort((a, b) => b.salience - a.salience);
  const top = sorted.slice(0, 3);

  const parts = top.map((h) => {
    const triggerDescs = h.triggers.map(describeTrigger);
    return triggerDescs.join(", ");
  });

  return `Highlights: ${highlights.length}. ${parts.join(". ")}.`;
}

function describeTrigger(t: SalienceTrigger): string {
  switch (t.type) {
    case "motif_touch":
      return `Motif: ${t.motifName}`;
    case "error_or_failure":
      return t.detail;
    case "novel_tool":
      return `Novel: ${t.toolName}`;
    case "long_duration":
      return `Slow op: ${Math.round(t.durationMs / 1000)}s`;
  }
}
