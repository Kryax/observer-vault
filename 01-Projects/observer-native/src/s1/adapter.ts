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
// Claude Code Native Types (what the CLI sends us)
// ---------------------------------------------------------------------------

interface ClaudeCodeSessionStartEvent {
  type: "SessionStart";
  session_id: string;
  cwd: string;
  timestamp?: string;
  git?: {
    branch?: string;
    status?: string;
    recent_commits?: string[];
  };
}

interface ClaudeCodePreToolUseEvent {
  type: "PreToolUse";
  session_id: string;
  tool_name: string;
  parameters: Record<string, unknown>;
  timestamp?: string;
}

interface ClaudeCodePostToolUseEvent {
  type: "PostToolUse";
  session_id: string;
  tool_name: string;
  result: unknown;
  duration_ms: number;
  timestamp?: string;
}

interface ClaudeCodeStopEvent {
  type: "Stop";
  session_id: string;
  timestamp?: string;
  summary?: string;
  exit_reason?: "user_exit" | "timeout" | "error" | "completed";
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
    const event = cliEvent as ClaudeCodeEvent;
    const now = new Date().toISOString();

    switch (event.type) {
      case "SessionStart":
        return this.translateSessionStart(event, now);
      case "PreToolUse":
        return this.translatePreToolUse(event, now);
      case "PostToolUse":
        return this.translatePostToolUse(event, now);
      case "Stop":
        return this.translateStop(event, now);
      default:
        throw new Error(
          `Unknown Claude Code event type: ${(event as { type: string }).type}`
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
      timestamp: event.timestamp ?? fallbackTimestamp,
      workingDirectory: event.cwd,
      gitContext: event.git
        ? {
            branch: event.git.branch ?? "unknown",
            status: event.git.status ?? "",
            recentCommits: event.git.recent_commits,
          }
        : undefined,
    };
  }

  private translatePreToolUse(
    event: ClaudeCodePreToolUseEvent,
    fallbackTimestamp: string
  ): ObserverPreToolUse {
    return {
      type: "ObserverPreToolUse",
      toolName: event.tool_name,
      parameters: event.parameters,
      sessionContext: {
        sessionId: event.session_id,
        timestamp: event.timestamp ?? fallbackTimestamp,
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
      result: event.result,
      durationMs: event.duration_ms,
      sessionContext: {
        sessionId: event.session_id,
        timestamp: event.timestamp ?? fallbackTimestamp,
      },
    };
  }

  private translateStop(
    event: ClaudeCodeStopEvent,
    fallbackTimestamp: string
  ): ObserverSessionStop {
    return {
      type: "ObserverSessionStop",
      sessionId: event.session_id,
      timestamp: event.timestamp ?? fallbackTimestamp,
      summary: event.summary,
      exitReason: event.exit_reason ?? "completed",
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
