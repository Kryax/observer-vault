// S2: Recursive condition evaluation for policy rules
// All evaluation is synchronous and pure (except rate_check which reads timestamps)
// NNF-8: intent_contains uses structural matching on intent_type enum, NOT keyword search

import type { PolicyCondition, PolicyRequest } from "@observer/shared";

/**
 * Sliding window rate tracker.
 * Key: `${session_id}:${method}` -> array of timestamps (ms since epoch).
 */
export type RateWindow = Map<string, number[]>;

/**
 * Evaluate a policy condition against a request.
 * Returns true if the condition matches the request.
 *
 * @param condition - The condition to evaluate (may be recursive)
 * @param req - The policy request to evaluate against
 * @param rateWindow - Shared mutable rate window for rate_check conditions
 * @param now - Current time in ms (injectable for testing)
 */
export function evaluateCondition(
  condition: PolicyCondition,
  req: PolicyRequest,
  rateWindow: RateWindow,
  now: number = Date.now(),
): boolean {
  switch (condition.type) {
    case "method_match":
      return condition.methods.includes(req.method);

    case "client_type_match":
      return condition.client_types.includes(req.session.client_type);

    case "intent_contains":
      // NNF-8: Structural matching on intent_type enum.
      // We compare req.thread.intent_type against the keywords array.
      // This is NOT a keyword search in the intent message string.
      if (req.thread === null) {
        return false;
      }
      return condition.keywords.includes(req.thread.intent_type);

    case "rate_check":
      return evaluateRateCheck(condition.max_per_minute, req, rateWindow, now);

    case "and":
      return condition.conditions.every((sub) =>
        evaluateCondition(sub, req, rateWindow, now),
      );

    case "or":
      return condition.conditions.some((sub) =>
        evaluateCondition(sub, req, rateWindow, now),
      );

    case "not":
      return !evaluateCondition(condition.condition, req, rateWindow, now);

    default: {
      // Exhaustiveness check — should never reach here if config validation is correct
      const _exhaustive: never = condition;
      return false;
    }
  }
}

/**
 * Evaluate a rate_check condition.
 * Returns true if the rate limit has been EXCEEDED (i.e., the condition "fires").
 *
 * Uses a sliding window: track timestamps of evaluations per session_id+method.
 * Prune entries older than 60 seconds before counting.
 */
function evaluateRateCheck(
  maxPerMinute: number,
  req: PolicyRequest,
  rateWindow: RateWindow,
  now: number,
): boolean {
  const key = `${req.session.id}:${req.method}`;
  const windowMs = 60_000; // 1 minute sliding window

  // Get or create the timestamp array
  let timestamps = rateWindow.get(key);
  if (timestamps === undefined) {
    timestamps = [];
    rateWindow.set(key, timestamps);
  }

  // Prune entries older than the window
  const cutoff = now - windowMs;
  const pruned = timestamps.filter((ts) => ts > cutoff);

  // Record this request's timestamp
  pruned.push(now);
  rateWindow.set(key, pruned);

  // If count exceeds max, rate limit is exceeded
  return pruned.length > maxPerMinute;
}
