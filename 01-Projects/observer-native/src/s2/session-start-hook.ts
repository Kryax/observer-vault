#!/usr/bin/env bun
/**
 * S2 — Session-Start Hook (Context Loader)
 *
 * Invoked at session start. Calls hydrateContext() to load recent sessions,
 * motifs, framework deltas, and prior ReflectSeed, then formats the result
 * as concise priming text for the new session.
 *
 * Output budget: stays under ~2KB to respect the 10% context init budget.
 * Fail-silent: errors never propagate to the CLI.
 */

import { hydrateContext } from "./context-hydration.ts";
import type { HydratedContext } from "./context-hydration.ts";
import type { SessionRecord } from "./session-capture.ts";

const PROJECT_ROOT =
  "/mnt/zfs-host/backup/projects/observer-vault/01-Projects/observer-native";

/** Maximum characters for the priming context output. */
const MAX_CONTEXT_CHARS = 2000;

/**
 * Formats a single session record as a concise one-line summary.
 */
function formatSession(session: SessionRecord): string {
  const date = session.startedAt.slice(0, 10);
  const parts: string[] = [`Session ${date}`];

  if (session.summary) {
    parts.push(session.summary);
  }

  if (session.tensions && session.tensions.length > 0) {
    const openTensions = session.tensions
      .filter((t) => t.status === "open")
      .map((t) => t.description)
      .slice(0, 3);
    if (openTensions.length > 0) {
      parts.push(`Tensions: ${openTensions.join("; ")}`);
    }
  }

  if (session.reflectOutput?.newLenses && session.reflectOutput.newLenses.length > 0) {
    parts.push(`Lenses: ${session.reflectOutput.newLenses.slice(0, 3).join("; ")}`);
  }

  return parts.join(". ") + ".";
}

/**
 * Formats the full HydratedContext as priming text.
 * Aggressively summarizes to stay within MAX_CONTEXT_CHARS.
 */
function formatPrimingContext(ctx: HydratedContext): string {
  const sections: string[] = [];

  // Recent sessions
  if (ctx.recentSessions.length > 0) {
    const sessionLines = ctx.recentSessions.map(formatSession);
    sections.push("Recent sessions:\n" + sessionLines.join("\n"));
  }

  // Prior ReflectSeed
  if (ctx.priorReflectOutput) {
    sections.push(
      `Last reflect: ${ctx.priorReflectOutput.transferFunctionSummary}`,
    );
  }

  // Active motifs (names only, not full content)
  if (ctx.activeMotifs.length > 0) {
    const motifNames = ctx.activeMotifs
      .map((m) => m.filename.replace(/\.(md|json)$/, ""))
      .slice(0, 10);
    sections.push(`Active motifs: ${motifNames.join(", ")}`);
  }

  // Framework delta
  if (ctx.frameworkDelta) {
    sections.push(
      `Framework delta: ${ctx.frameworkDelta.transferFunctionSummary}`,
    );
  }

  let output = sections.join("\n\n");

  // Truncate to budget
  if (output.length > MAX_CONTEXT_CHARS) {
    output = output.slice(0, MAX_CONTEXT_CHARS - 3) + "...";
  }

  return output;
}

/**
 * Main: hydrate context and output priming text.
 */
function main() {
  const ctx = hydrateContext(PROJECT_ROOT);
  const priming = formatPrimingContext(ctx);

  if (priming.trim().length === 0) return;

  // Output as a system reminder that Claude Code will include in context
  console.log(priming);
}

// Hook entry point — read stdin (required by Claude Code), then hydrate
try {
  // Consume stdin (Claude Code sends session event data)
  const reader = Bun.stdin.stream().getReader();
  const read = (async () => {
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }
  })();
  await Promise.race([read, new Promise<void>((r) => setTimeout(r, 200))]);
} catch {
  // Fail-silent
}

try {
  main();
} catch {
  // Fail-silent: never break the CLI session
}
