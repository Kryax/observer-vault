// S0: Error codes and factory for JSON-RPC error objects

import { ObserverErrorCode } from "./types.js";
import type { ObserverErrorData } from "./types.js";

export interface JsonRpcError {
  code: number;
  message: string;
  data?: ObserverErrorData;
}

/**
 * Create a JSON-RPC compliant error object.
 *
 * @example
 *   createError(ObserverErrorCode.PolicyDenied, "Access denied", {
 *     type: "policy_denied",
 *     rule_id: "rule_1",
 *     reason: "Client type not allowed"
 *   })
 */
export function createError(
  code: ObserverErrorCode,
  message: string,
  data?: ObserverErrorData,
): JsonRpcError {
  const error: JsonRpcError = { code, message };
  if (data !== undefined) {
    error.data = data;
  }
  return error;
}

/**
 * Human-readable label for an error code.
 */
export function errorCodeName(code: ObserverErrorCode): string {
  return ObserverErrorCode[code] ?? "UnknownError";
}
