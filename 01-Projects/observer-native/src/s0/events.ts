/**
 * S0 — Hook Event Interface (PRD 3.0.1)
 *
 * Observer-owned event types. The adapter (S1) translates from the CLI's
 * native format into these types. All downstream consumers see only
 * Observer events.
 */

export interface ObserverSessionStart {
  type: "ObserverSessionStart";
  sessionId: string;
  timestamp: string;
  workingDirectory: string;
  gitContext?: {
    branch: string;
    status: string;
    recentCommits?: string[];
  };
}

export interface ObserverPreToolUse {
  type: "ObserverPreToolUse";
  toolName: string;
  parameters: Record<string, unknown>;
  sessionContext: {
    sessionId: string;
    timestamp: string;
  };
}

export interface ObserverPostToolUse {
  type: "ObserverPostToolUse";
  toolName: string;
  result: unknown;
  durationMs: number;
  sessionContext: {
    sessionId: string;
    timestamp: string;
  };
}

export interface ObserverSessionStop {
  type: "ObserverSessionStop";
  sessionId: string;
  timestamp: string;
  summary?: string;
  exitReason: "user_exit" | "timeout" | "error" | "completed";
}

export type ObserverEvent =
  | ObserverSessionStart
  | ObserverPreToolUse
  | ObserverPostToolUse
  | ObserverSessionStop;
