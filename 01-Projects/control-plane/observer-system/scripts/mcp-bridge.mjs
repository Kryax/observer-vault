#!/usr/bin/env node
// =============================================================================
// Observer Control Plane — MCP Bridge
// =============================================================================
// Thin MCP server (stdio transport) that exposes the Observer Control Plane's
// JSON-RPC methods as MCP tools. Claude Code connects to this bridge, which
// forwards requests to the control plane HTTP server on localhost:9000.
// =============================================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFileSync } from "node:fs";
import { z } from "zod";

// --- Configuration ---
const CP_HOST = process.env.OBSERVER_CP_HOST || "127.0.0.1";
const CP_PORT = parseInt(process.env.OBSERVER_CP_PORT || "9000", 10);
const SECRETS_DIR = process.env.OBSERVER_SECRETS_DIR || "/run/observer-secrets";

// Load bearer token
let bearerToken = "";
try {
  const tokensRaw = readFileSync(`${SECRETS_DIR}/bearer-tokens.json`, "utf-8");
  const tokens = JSON.parse(tokensRaw);
  bearerToken = tokens.tokens?.[0]?.token || "";
} catch (err) {
  console.error(`[mcp-bridge] Warning: Could not load bearer token: ${err.message}`);
}

// --- JSON-RPC HTTP client ---
async function rpcCall(method, params) {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    method,
    params: params || {},
    id: Date.now(),
  });

  const res = await fetch(`http://${CP_HOST}:${CP_PORT}/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
    },
    body,
  });

  const json = await res.json();
  if (json.error) {
    throw new Error(`JSON-RPC error ${json.error.code}: ${json.error.message}`);
  }
  return json.result;
}

// --- MCP Server ---
const server = new McpServer({
  name: "observer-control-plane",
  version: "1.0.0",
});

// health.status — no auth needed
server.registerTool(
  "observer_health",
  {
    title: "Observer Health Status",
    description: "Get the health status of the Observer Control Plane, including server status, backend availability, and audit subsystem health.",
  },
  async () => {
    const result = await rpcCall("health.status", {});
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// session.create
server.registerTool(
  "observer_session_create",
  {
    title: "Create Observer Session",
    description: "Create a new session on the Observer Control Plane. Returns a session_id for subsequent operations.",
    inputSchema: z.object({
      client_type: z.string().describe("Client type: 'cli', 'plugin', or 'api'"),
      client_id: z.string().describe("Client identifier"),
    }),
  },
  async ({ client_type, client_id }) => {
    const result = await rpcCall("session.create", { client_type, client_id });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// session.close
server.registerTool(
  "observer_session_close",
  {
    title: "Close Observer Session",
    description: "Close an active session on the Observer Control Plane.",
    inputSchema: z.object({
      session_id: z.string().describe("Session ID to close"),
    }),
  },
  async ({ session_id }) => {
    const result = await rpcCall("session.close", { session_id });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// session.resume
server.registerTool(
  "observer_session_resume",
  {
    title: "Resume Observer Session",
    description: "Resume an existing session, returning its threads and pending approvals.",
    inputSchema: z.object({
      session_id: z.string().describe("Session ID to resume"),
    }),
  },
  async ({ session_id }) => {
    const result = await rpcCall("session.resume", { session_id });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// thread.create
server.registerTool(
  "observer_thread_create",
  {
    title: "Create Observer Thread",
    description: "Create a new thread within a session. Threads represent individual work units.",
    inputSchema: z.object({
      session_id: z.string().describe("Parent session ID"),
      intent: z.string().describe("What the thread aims to accomplish"),
      intent_type: z.string().describe("Thread type: 'build', 'review', 'explore', etc."),
    }),
  },
  async ({ session_id, intent, intent_type }) => {
    const result = await rpcCall("thread.create", { session_id, intent, intent_type });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// thread.status
server.registerTool(
  "observer_thread_status",
  {
    title: "Get Thread Status",
    description: "Get the current status of a thread, including pending approvals.",
    inputSchema: z.object({
      thread_id: z.string().describe("Thread ID to query"),
    }),
  },
  async ({ thread_id }) => {
    const result = await rpcCall("thread.status", { thread_id });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// thread.cancel
server.registerTool(
  "observer_thread_cancel",
  {
    title: "Cancel Observer Thread",
    description: "Cancel an active thread.",
    inputSchema: z.object({
      thread_id: z.string().describe("Thread ID to cancel"),
    }),
  },
  async ({ thread_id }) => {
    const result = await rpcCall("thread.cancel", { thread_id });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// turn.submit
server.registerTool(
  "observer_turn_submit",
  {
    title: "Submit Turn",
    description: "Submit a turn (message) to an active thread for processing.",
    inputSchema: z.object({
      thread_id: z.string().describe("Thread ID to submit to"),
      message: z.string().describe("The message/prompt to submit"),
    }),
  },
  async ({ thread_id, message }) => {
    const result = await rpcCall("turn.submit", { thread_id, message });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// audit.query
server.registerTool(
  "observer_audit_query",
  {
    title: "Query Audit Trail",
    description: "Query the Observer audit trail for events. Returns audit events matching the criteria.",
    inputSchema: z.object({
      limit: z.number().optional().describe("Maximum events to return (default 100)"),
      session_id: z.string().optional().describe("Filter by session ID"),
      action: z.string().optional().describe("Filter by action type"),
    }),
  },
  async (params) => {
    const result = await rpcCall("audit.query", params);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// approval.respond
server.registerTool(
  "observer_approval_respond",
  {
    title: "Respond to Approval",
    description: "Approve or deny a pending approval request.",
    inputSchema: z.object({
      approval_id: z.string().describe("Approval ID to respond to"),
      decision: z.object({
        decision: z.enum(["approved", "denied"]).describe("Approval decision"),
        reason: z.string().optional().describe("Reason for the decision"),
      }),
    }),
  },
  async ({ approval_id, decision }) => {
    const result = await rpcCall("approval.respond", { approval_id, decision });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// vault.query
server.registerTool(
  "observer_vault_query",
  {
    title: "Query Vault Documents",
    description: "Query the Obsidian vault for documents matching criteria. Returns document metadata (title, status, tags, path, size, modified date).",
    inputSchema: z.object({
      path_prefix: z.string().optional().describe("Filter documents by path prefix (e.g., '01-Projects/')"),
      status_filter: z.string().optional().describe("Filter by frontmatter status field"),
      limit: z.number().optional().describe("Maximum documents to return (default 100, max 500)"),
      offset: z.number().optional().describe("Pagination offset (default 0)"),
    }),
  },
  async (params) => {
    const result = await rpcCall("vault.query", params);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// vault.status
server.registerTool(
  "observer_vault_status",
  {
    title: "Vault Status",
    description: "Get a summary of the Obsidian vault: total documents, documents by status, by top-level directory, and last-modified timestamp.",
  },
  async () => {
    const result = await rpcCall("vault.status", {});
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// --- Start ---
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[mcp-bridge] Observer Control Plane MCP bridge running on stdio");
