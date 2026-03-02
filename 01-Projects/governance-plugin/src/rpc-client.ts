/**
 * Observer Governance Plugin -- JSON-RPC 2.0 Client
 *
 * Lightweight RPC client that uses Obsidian's requestUrl() for HTTP transport.
 * Communicates with the Observer Control Plane at a configurable endpoint.
 *
 * Design:
 * - Uses Obsidian's requestUrl (cross-platform, no node:http dependency)
 * - Bearer token authentication (configurable)
 * - Best-effort: failures log to console, never block the user
 * - Disabled by default via `enabled` flag
 */

import { requestUrl, type RequestUrlResponse } from 'obsidian';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A JSON-RPC 2.0 request object. */
interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

/** A JSON-RPC 2.0 response object. */
interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/** Configuration for the RPC client, drawn from plugin settings. */
export interface RpcClientConfig {
  endpoint: string;
  token: string;
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class ObserverRpcClient {
  private config: RpcClientConfig;
  private nextId: number = 1;

  constructor(config: RpcClientConfig) {
    this.config = config;
  }

  /** Update configuration (e.g. after settings change). */
  updateConfig(config: RpcClientConfig): void {
    this.config = config;
  }

  /** Whether the client is enabled and has a configured endpoint. */
  get enabled(): boolean {
    return this.config.enabled && this.config.endpoint.length > 0;
  }

  /**
   * Send a JSON-RPC 2.0 call to the control plane.
   *
   * Returns the `result` field on success, or null on any failure.
   * Never throws -- all errors are caught and logged to console.
   */
  async call(method: string, params?: Record<string, unknown>): Promise<unknown | null> {
    if (!this.enabled) {
      return null;
    }

    const id = this.nextId++;
    const body: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.token.length > 0) {
      headers['Authorization'] = `Bearer ${this.config.token}`;
    }

    let response: RequestUrlResponse;
    try {
      response = await requestUrl({
        url: this.config.endpoint,
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        throw: false,
      });
    } catch (err) {
      console.warn(
        `[OG-RPC] Connection failed for ${method}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }

    // Handle HTTP-level errors
    if (response.status < 200 || response.status >= 300) {
      if (response.status === 401 || response.status === 403) {
        console.warn(`[OG-RPC] Authentication failed (${response.status}) for ${method}`);
      } else {
        console.warn(`[OG-RPC] HTTP ${response.status} for ${method}`);
      }
      return null;
    }

    // Parse JSON-RPC response
    let rpcResponse: JsonRpcResponse;
    try {
      rpcResponse = response.json as JsonRpcResponse;
    } catch (err) {
      console.warn(`[OG-RPC] Invalid JSON response for ${method}`);
      return null;
    }

    if (rpcResponse.error) {
      console.warn(
        `[OG-RPC] RPC error for ${method}: [${rpcResponse.error.code}] ${rpcResponse.error.message}`,
      );
      return null;
    }

    return rpcResponse.result ?? null;
  }

  /**
   * Convenience: notify the control plane of a governance event.
   *
   * Creates a session, logs the event, and closes the session.
   * All best-effort -- failures are logged but never thrown.
   */
  async notifyPromotion(event: {
    file: string;
    from: string;
    to: string;
    by: string;
    rationale: string;
  }): Promise<void> {
    if (!this.enabled) return;

    try {
      // 1. Create a session
      const sessionResult = await this.call('session.create', {
        backend: 'obsidian-governance',
        description: `Document promotion: ${event.file} (${event.from} -> ${event.to})`,
      });

      const sessionId =
        sessionResult && typeof sessionResult === 'object' && 'id' in sessionResult
          ? (sessionResult as Record<string, unknown>).id
          : null;

      // 2. Log the audit event
      await this.call('audit.log', {
        session_id: sessionId,
        event_type: 'document.promote',
        source: 'obsidian-governance',
        payload: {
          file: event.file,
          from: event.from,
          to: event.to,
          by: event.by,
          rationale: event.rationale,
          timestamp: new Date().toISOString(),
        },
      });

      // 3. Close the session
      if (sessionId) {
        await this.call('session.close', {
          id: sessionId,
          status: 'completed',
        });
      }
    } catch (err) {
      // Best-effort -- swallow everything
      console.warn(
        `[OG-RPC] Failed to notify promotion: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Convenience: notify the control plane of a governance demotion event.
   */
  async notifyDemotion(event: {
    file: string;
    from: string;
    to: string;
    by: string;
    rationale: string;
  }): Promise<void> {
    if (!this.enabled) return;

    try {
      const sessionResult = await this.call('session.create', {
        backend: 'obsidian-governance',
        description: `Document demotion: ${event.file} (${event.from} -> ${event.to})`,
      });

      const sessionId =
        sessionResult && typeof sessionResult === 'object' && 'id' in sessionResult
          ? (sessionResult as Record<string, unknown>).id
          : null;

      await this.call('audit.log', {
        session_id: sessionId,
        event_type: 'document.demote',
        source: 'obsidian-governance',
        payload: {
          file: event.file,
          from: event.from,
          to: event.to,
          by: event.by,
          rationale: event.rationale,
          timestamp: new Date().toISOString(),
        },
      });

      if (sessionId) {
        await this.call('session.close', {
          id: sessionId,
          status: 'completed',
        });
      }
    } catch (err) {
      console.warn(
        `[OG-RPC] Failed to notify demotion: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
