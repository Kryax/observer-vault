// S2: Policy Enforcer — Main policy evaluator
// Implements the PolicyEnforcer interface from @observer/shared
// Synchronous, pure evaluation (except rate window state)
// Default deny when no rules match (Constitutional: fail safe, not fail open)

import type {
  PolicyEnforcer,
  PolicyRequest,
  PolicyDecision,
  PolicyRule,
  ApprovalTier,
} from "@observer/shared";

import { evaluateCondition, type RateWindow } from "./condition-evaluator.js";
import { loadPolicyConfig, type LoadedPolicyRule } from "./config-loader.js";

/**
 * Concrete implementation of the PolicyEnforcer interface.
 *
 * Evaluation logic:
 * 1. Rules sorted by priority (lower = evaluated first)
 * 2. First matching rule wins — return its decision immediately
 * 3. No match → default deny: { action: "deny", reason: "No matching policy rule", rule_id: "default" }
 */
export class PolicyEnforcerImpl implements PolicyEnforcer {
  private rules: LoadedPolicyRule[] = [];
  private rateWindow: RateWindow = new Map();

  /**
   * Load policy rules from a YAML config file.
   * Validates config at load time; throws on any invalid configuration.
   * Config is restart-to-reload (no hot-reload).
   */
  loadRules(path: string): void {
    this.rules = loadPolicyConfig(path);
    // Reset rate windows on reload (fresh start)
    this.rateWindow = new Map();
  }

  /**
   * Evaluate a policy request against loaded rules.
   * SYNCHRONOUS — returns immediately with a PolicyDecision.
   *
   * First matching rule wins (rules pre-sorted by priority).
   * Default deny if no rules match.
   */
  evaluate(req: PolicyRequest): PolicyDecision {
    const now = Date.now();

    for (const rule of this.rules) {
      const matches = evaluateCondition(
        rule.condition,
        req,
        this.rateWindow,
        now,
      );

      if (matches) {
        return this.buildDecision(rule);
      }
    }

    // No rules matched — default deny (Constitutional: fail safe)
    return {
      action: "deny",
      reason: "No matching policy rule",
      rule_id: "default",
    };
  }

  /**
   * Get a copy of the loaded rules in priority order.
   * Returns a shallow copy to prevent external mutation.
   */
  getRules(): PolicyRule[] {
    return this.rules.map((r) => ({
      id: r.id,
      description: r.description,
      condition: r.condition,
      action: r.action,
      priority: r.priority,
    }));
  }

  /**
   * Build a PolicyDecision from a matched rule.
   * Maps rule action + metadata to the correct discriminated union variant.
   */
  private buildDecision(rule: LoadedPolicyRule): PolicyDecision {
    switch (rule.action) {
      case "allow":
        return { action: "allow" };

      case "deny":
        return {
          action: "deny",
          reason: rule.deny_reason ?? rule.description,
          rule_id: rule.id,
        };

      case "require_approval":
        return {
          action: "require_approval",
          tier: (rule.tier ?? "approve") as ApprovalTier,
          description: rule.approval_description ?? rule.description,
          rule_id: rule.id,
        };

      case "rate_limit":
        return {
          action: "rate_limit",
          retry_after_seconds: rule.retry_after_seconds ?? 60,
          rule_id: rule.id,
        };

      default:
        // Should never happen if config validation is correct
        return {
          action: "deny",
          reason: `Unknown action '${rule.action}' in rule '${rule.id}'`,
          rule_id: rule.id,
        };
    }
  }
}
