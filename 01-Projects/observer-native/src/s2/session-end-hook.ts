#!/usr/bin/env bun
/**
 * S2 — Session-End Hook (thin shell)
 *
 * Delegates all processing to the S8 Stop Orchestrator.
 * Outputs { continue: true } immediately so Claude Code is never blocked.
 * Fail-silent: errors never propagate to the CLI.
 */

import { runStopOrchestrator } from "../s8/stop-orchestrator.ts";

// Immediately signal continue — never block the CLI
console.log(JSON.stringify({ continue: true }));

try {
  await runStopOrchestrator();
} catch {
  // Fail-silent: never break the CLI session
}
