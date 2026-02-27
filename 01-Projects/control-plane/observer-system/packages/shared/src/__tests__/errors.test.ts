import { describe, it, expect } from "vitest";
import { createError, errorCodeName } from "../errors.js";
import { ObserverErrorCode } from "../types.js";

describe("ObserverErrorCode", () => {
  it("has exact numeric values from spec", () => {
    expect(ObserverErrorCode.ParseError).toBe(-32700);
    expect(ObserverErrorCode.InvalidRequest).toBe(-32600);
    expect(ObserverErrorCode.MethodNotFound).toBe(-32601);
    expect(ObserverErrorCode.InvalidParams).toBe(-32602);
    expect(ObserverErrorCode.InternalError).toBe(-32603);
    expect(ObserverErrorCode.AuthRequired).toBe(-32000);
    expect(ObserverErrorCode.AuthFailed).toBe(-32001);
    expect(ObserverErrorCode.SessionNotFound).toBe(-32002);
    expect(ObserverErrorCode.ThreadNotFound).toBe(-32003);
    expect(ObserverErrorCode.PolicyDenied).toBe(-32004);
    expect(ObserverErrorCode.ApprovalTimeout).toBe(-32005);
    expect(ObserverErrorCode.BackendUnavailable).toBe(-32006);
    expect(ObserverErrorCode.RateLimited).toBe(-32007);
    expect(ObserverErrorCode.ValidationFailed).toBe(-32008);
    expect(ObserverErrorCode.ApprovalAlreadyResolved).toBe(-32009);
    expect(ObserverErrorCode.ConfigInvalid).toBe(-32010);
  });
});

describe("createError", () => {
  it("creates a JSON-RPC error object with code and message", () => {
    const error = createError(
      ObserverErrorCode.PolicyDenied,
      "Access denied",
    );
    expect(error).toEqual({
      code: -32004,
      message: "Access denied",
    });
  });

  it("includes data when provided", () => {
    const error = createError(
      ObserverErrorCode.PolicyDenied,
      "Access denied",
      {
        type: "policy_denied",
        rule_id: "rule_1",
        reason: "Client type not allowed",
      },
    );
    expect(error).toEqual({
      code: -32004,
      message: "Access denied",
      data: {
        type: "policy_denied",
        rule_id: "rule_1",
        reason: "Client type not allowed",
      },
    });
  });

  it("omits data key when data is undefined", () => {
    const error = createError(
      ObserverErrorCode.InternalError,
      "Something went wrong",
    );
    expect("data" in error).toBe(false);
  });

  it("produces valid JSON-RPC error structure", () => {
    const error = createError(
      ObserverErrorCode.RateLimited,
      "Too many requests",
      { type: "rate_limited", retry_after_seconds: 30 },
    );
    // JSON-RPC error requires code (integer) and message (string)
    expect(typeof error.code).toBe("number");
    expect(Number.isInteger(error.code)).toBe(true);
    expect(typeof error.message).toBe("string");
  });
});

describe("errorCodeName", () => {
  it("returns human-readable name for known codes", () => {
    expect(errorCodeName(ObserverErrorCode.PolicyDenied)).toBe("PolicyDenied");
    expect(errorCodeName(ObserverErrorCode.ParseError)).toBe("ParseError");
    expect(errorCodeName(ObserverErrorCode.AuthFailed)).toBe("AuthFailed");
  });
});
