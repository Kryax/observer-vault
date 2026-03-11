#!/usr/bin/env bun
/**
 * S1 -- Hook Adapter (CLI Bridge)
 *
 * The ONLY component that knows about Claude Code's specifics.
 * Translates CLI-native events into Observer's internal event types (S0).
 * Swapping to a different CLI means writing a new adapter -- nothing else changes.
 *
 * Based on: exit-011's OILEventBridge pattern -- Observer-owned hook file,
 * fail-silent, NDJSON event bus.
 *
 * Single file. No dependencies on S1+ components. No PAI imports.
 */

import { mkdirSync, appendFileSync } from "node:fs";

import type {
  ObserverEvent,
  ObserverSessionStart,
  ObserverPreToolUse,
  ObserverPostToolUse,
  ObserverSessionStop,
} from "../s0/index.ts";

// ---------------------------------------------------------------------------
// Adapter Interface Contract (PRD 3.1.2)
// Any CLI adapter must implement this interface.
// ---------------------------------------------------------------------------

export interface HookAdapter {
  /** Convert a CLI-native event to an Observer event type. */
  translateEvent(cliEvent: unknown): ObserverEvent;

  /** Register for all relevant lifecycle events via the CLI's config mechanism. */
  registerHooks(config: HookRegistrationConfig): void;

  /** Return the NDJSON file path where translated events are written. */
  getEventStream(): string;
}

export interface HookRegistrationConfig {
  /** The workspace root directory. */
  workspace: string;
  /** Optional custom path for the NDJSON event stream file. */
  eventStreamPath?: string;
}

// ---------------------------------------------------------------------------
// Claude Code Native Types (what the CLI sends us via stdin)
// See: https://github.com/anthropics/claude-code — hooks documentation
// ---------------------------------------------------------------------------

/** Common fields present on every hook stdin payload. */
interface ClaudeCodeCommonFields {
  session_id: string;
  hook_event_name?: string;
  type?: string;
  transcript_path?: string;
  cwd: string;
  permission_mode?: string;
  timestamp?: string;
}

interface ClaudeCodeSessionStartEvent extends ClaudeCodeCommonFields {
  hook_event_name: "SessionStart";
}

interface ClaudeCodePreToolUseEvent extends ClaudeCodeCommonFields {
  hook_event_name: "PreToolUse";
  tool_name: string;
  tool_input: Record<string, unknown>;
}

interface ClaudeCodePostToolUseEvent extends ClaudeCodeCommonFields {
  hook_event_name: "PostToolUse";
  tool_name: string;
  tool_input?: Record<string, unknown>;
  tool_result?: unknown;
  result?: unknown;
  duration_ms?: number;
}

interface ClaudeCodeStopEvent extends ClaudeCodeCommonFields {
  hook_event_name: "Stop";
  reason?: string;
  exit_reason?: string;
}

type ClaudeCodeEvent =
  | ClaudeCodeSessionStartEvent
  | ClaudeCodePreToolUseEvent
  | ClaudeCodePostToolUseEvent
  | ClaudeCodeStopEvent;

// ---------------------------------------------------------------------------
// Claude Code Adapter -- First Implementation (PRD 3.1.3)
// ---------------------------------------------------------------------------

const DEFAULT_EVENT_STREAM_SUBPATH = "tmp/events.ndjson";

export class ClaudeCodeAdapter implements HookAdapter {
  private eventStreamPath: string;

  constructor(config: HookRegistrationConfig) {
    this.eventStreamPath =
      config.eventStreamPath ??
      `${config.workspace}/${DEFAULT_EVENT_STREAM_SUBPATH}`;

    // Fail-silent: ensure the event stream directory exists
    try {
      this.ensureStreamDirectory();
    } catch {
      // Adapter errors NEVER break the underlying CLI session
    }
  }

  /**
   * Translate a Claude Code native event into an Observer event.
   * Wraps translation in try/catch -- adapter errors never propagate.
   */
  translateEvent(cliEvent: unknown): ObserverEvent {
    const event = cliEvent as ClaudeCodeEvent & { type?: string };
    const now = event.timestamp ?? new Date().toISOString();
    const eventName = event.hook_event_name ?? (cliEvent as { type?: string }).type;

    switch (eventName) {
      case "SessionStart":
        return this.translateSessionStart(event as ClaudeCodeSessionStartEvent, now);
      case "PreToolUse":
        return this.translatePreToolUse(event as ClaudeCodePreToolUseEvent, now);
      case "PostToolUse":
        return this.translatePostToolUse(event as ClaudeCodePostToolUseEvent, now);
      case "Stop":
        return this.translateStop(event as ClaudeCodeStopEvent, now);
      default:
        throw new Error(
          `Unknown Claude Code event type: ${eventName}`
        );
    }
  }

  /**
   * Register hooks for all four Claude Code lifecycle events.
   * This produces the settings.json hook entries that Claude Code requires.
   * NOTE: Actual registration into ~/.claude/settings.json requires Adam's
   * explicit approval per CLAUDE.md governance. This method returns the
   * registration payload for review.
   */
  registerHooks(config: HookRegistrationConfig): void {
    // Build the hook registration entries for all four event types.
    // These would be written to settings.json when Adam approves.
    const _registration = {
      hooks: [
        {
          event: "SessionStart",
          command: `${config.workspace}/src/s1/adapter.ts`,
        },
        {
          event: "PreToolUse",
          command: `${config.workspace}/src/s1/adapter.ts`,
        },
        {
          event: "PostToolUse",
          command: `${config.workspace}/src/s1/adapter.ts`,
        },
        {
          event: "Stop",
          command: `${config.workspace}/src/s1/adapter.ts`,
        },
      ],
    };
    // Registration payload prepared. Actual write to settings.json
    // is deferred until Adam explicitly approves (PAI safety boundary).
  }

  /** Return the NDJSON file path where translated events are written. */
  getEventStream(): string {
    return this.eventStreamPath;
  }

  // -------------------------------------------------------------------------
  // Event stream emission
  // -------------------------------------------------------------------------

  /**
   * Emit a translated Observer event to the NDJSON stream.
   * Fail-silent: errors are caught and swallowed.
   */
  emitEvent(event: ObserverEvent): void {
    try {
      const line = JSON.stringify(event) + "\n";
      this.appendToStream(line);
    } catch {
      // Fail-silent: adapter errors NEVER break the underlying CLI session
    }
  }

  /**
   * Full pipeline: translate a CLI event and emit it to the stream.
   * This is the primary entry point for hook invocations.
   * Entirely fail-silent.
   */
  handleHookEvent(cliEvent: unknown): void {
    try {
      const observerEvent = this.translateEvent(cliEvent);
      this.emitEvent(observerEvent);
    } catch {
      // Fail-silent: adapter errors NEVER break the underlying CLI session
    }
  }

  // -------------------------------------------------------------------------
  // Private translation methods
  // -------------------------------------------------------------------------

  private translateSessionStart(
    event: ClaudeCodeSessionStartEvent,
    fallbackTimestamp: string
  ): ObserverSessionStart {
    return {
      type: "ObserverSessionStart",
      sessionId: event.session_id,
      timestamp: fallbackTimestamp,
      workingDirectory: event.cwd,
      gitContext: (cliHasGitContext(event) ? event.git : undefined),
    };
  }

  private translatePreToolUse(
    event: ClaudeCodePreToolUseEvent,
    fallbackTimestamp: string
  ): ObserverPreToolUse {
    return {
      type: "ObserverPreToolUse",
      toolName: event.tool_name,
      parameters: event.tool_input ?? {},
      sessionContext: {
        sessionId: event.session_id,
        timestamp: fallbackTimestamp,
      },
    };
  }

  private translatePostToolUse(
    event: ClaudeCodePostToolUseEvent,
    fallbackTimestamp: string
  ): ObserverPostToolUse {
    return {
      type: "ObserverPostToolUse",
      toolName: event.tool_name,
      toolInput: event.tool_input ?? {},
      result: event.tool_result ?? event.result,
      durationMs: event.duration_ms,
      sessionContext: {
        sessionId: event.session_id,
        timestamp: fallbackTimestamp,
      },
    };
  }

  private translateStop(
    event: ClaudeCodeStopEvent,
    fallbackTimestamp: string
  ): ObserverSessionStop {
    // Map CC's free-form reason to Observer's exit reason enum
    const reasonMap: Record<string, ObserverSessionStop["exitReason"]> = {
      user_exit: "user_exit",
      timeout: "timeout",
      error: "error",
      completed: "completed",
    };
    const exitReasonKey = event.exit_reason ?? event.reason ?? "";
    return {
      type: "ObserverSessionStop",
      sessionId: event.session_id,
      timestamp: fallbackTimestamp,
      reason: event.reason,
      exitReason: reasonMap[exitReasonKey] ?? "unknown",
    };
  }

  // -------------------------------------------------------------------------
  // File system operations (fail-silent)
  // -------------------------------------------------------------------------

  private ensureStreamDirectory(): void {
    const dir = this.eventStreamPath.substring(
      0,
      this.eventStreamPath.lastIndexOf("/")
    );
    mkdirSync(dir, { recursive: true });
  }

  private appendToStream(line: string): void {
    appendFileSync(this.eventStreamPath, line, "utf-8");
  }
}

function cliHasGitContext(
  event: ClaudeCodeCommonFields,
): event is ClaudeCodeCommonFields & {
  git: { branch: string; status: string; recentCommits?: string[] };
} {
  return typeof (event as { git?: unknown }).git === "object" &&
    (event as { git?: unknown }).git !== null;
}

// ---------------------------------------------------------------------------
// Hook Entry Point
// Claude Code invokes this file directly, sending event JSON via stdin.
// Must output { continue: true } to stdout so the CLI proceeds.
// ---------------------------------------------------------------------------

const WORKSPACE = "/mnt/zfs-host/backup/projects/observer-vault/01-Projects/observer-native";

// Immediately tell Claude Code to continue — never block the tool pipeline.
console.log(JSON.stringify({ continue: true }));

try {
  const reader = Bun.stdin.stream().getReader();
  let raw = "";
  const read = (async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      raw += new TextDecoder().decode(value, { stream: true });
    }
  })();
  // 200ms timeout — if stdin doesn't arrive quickly, bail out.
  await Promise.race([read, new Promise<void>((r) => setTimeout(r, 200))]);
  if (raw.trim()) {
    const cliEvent = JSON.parse(raw.trim());
    const adapter = new ClaudeCodeAdapter({ workspace: WORKSPACE });
    adapter.handleHookEvent(cliEvent);
  }
} catch {
  // Fail-silent — never break the CLI session
}
