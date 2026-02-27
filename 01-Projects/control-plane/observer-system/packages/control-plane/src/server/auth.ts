// S5: Bearer token authentication for JSON-RPC server
// Extracts and validates Bearer tokens from Authorization headers.
// Every method except health.status requires a valid token.
//
// Phase 1: Simple token list (loaded from config at startup).
// Phase 2: Will add token rotation, scoping, and rate limiting per NNF-7.
//
// SECURITY: Auth failure rate limiting stub (NNF-7) is a Phase 2 concern.
// For now, we reject invalid tokens immediately with AuthRequired/AuthFailed.

import { createError, ObserverErrorCode } from "@observer/shared";
import type { JsonRpcError } from "@observer/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TokenEntry {
  /** The raw bearer token string */
  token: string;
  /** Human label for audit logging (e.g. "cli-adam", "telegram-bot") */
  label: string;
  /** Scope restrictions -- Phase 1 ignores this, Phase 2 enforces */
  scopes?: string[];
}

export interface AuthResult {
  authenticated: true;
  token_label: string;
}

export interface AuthFailure {
  authenticated: false;
  error: JsonRpcError;
}

export type AuthOutcome = AuthResult | AuthFailure;

// Methods that do NOT require authentication
const PUBLIC_METHODS = new Set<string>([
  "health.status",
]);

// ---------------------------------------------------------------------------
// Token Authenticator
// ---------------------------------------------------------------------------

export class TokenAuthenticator {
  /** Map of token -> label for O(1) lookup */
  private readonly tokenMap: Map<string, TokenEntry>;

  constructor(tokens: TokenEntry[]) {
    this.tokenMap = new Map();
    for (const entry of tokens) {
      if (entry.token.length < 16) {
        throw new Error(
          `Token for "${entry.label}" is too short (minimum 16 characters)`,
        );
      }
      this.tokenMap.set(entry.token, entry);
    }
  }

  /**
   * Check if a method requires authentication.
   */
  requiresAuth(method: string): boolean {
    return !PUBLIC_METHODS.has(method);
  }

  /**
   * Validate a bearer token from the Authorization header.
   * Returns AuthResult on success, AuthFailure on failure.
   *
   * @param authHeader The raw Authorization header value (e.g. "Bearer abc123...")
   */
  authenticate(authHeader: string | undefined): AuthOutcome {
    if (!authHeader) {
      return {
        authenticated: false,
        error: createError(
          ObserverErrorCode.AuthRequired,
          "Authorization header required",
        ),
      };
    }

    // Must be "Bearer <token>" format
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return {
        authenticated: false,
        error: createError(
          ObserverErrorCode.AuthFailed,
          "Invalid Authorization header format (expected: Bearer <token>)",
        ),
      };
    }

    const token = parts[1];
    const entry = this.tokenMap.get(token);

    if (!entry) {
      return {
        authenticated: false,
        error: createError(
          ObserverErrorCode.AuthFailed,
          "Invalid or expired token",
        ),
      };
    }

    return {
      authenticated: true,
      token_label: entry.label,
    };
  }

  /**
   * Revoke a token by its value. Returns true if the token existed and was removed.
   */
  revokeToken(token: string): boolean {
    return this.tokenMap.delete(token);
  }

  /**
   * Get the count of active tokens.
   */
  activeTokenCount(): number {
    return this.tokenMap.size;
  }
}
