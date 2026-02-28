// S2: YAML policy config loader with strict validation
// Validates at startup; fails hard on any invalid configuration.
// Config is restart-to-reload (no hot-reload per project rules).

import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { PolicyConditionSchema } from "@observer/shared";
import type { PolicyCondition } from "@observer/shared";

// --- Internal types for the raw YAML structure ---

/** Raw rule as it appears in the YAML file (before normalization). */
export interface RawPolicyRule {
  id: string;
  description: string;
  condition: PolicyCondition;
  action: string;
  priority: number;
  // Optional fields for specific action types
  tier?: string;
  approval_description?: string;
  deny_reason?: string;
  retry_after_seconds?: number;
}

/** The validated, normalized rule ready for the enforcer. */
export interface LoadedPolicyRule {
  id: string;
  description: string;
  condition: PolicyCondition;
  action: string;
  priority: number;
  // Action-specific metadata
  tier?: string;
  approval_description?: string;
  deny_reason?: string;
  retry_after_seconds?: number;
}

/** Root structure of the YAML policy config. */
interface RawPolicyConfig {
  policies: {
    default_action: string;
    rules: RawPolicyRule[];
  };
}

/**
 * Load and validate a YAML policy config file.
 * Throws on any validation failure (startup hard fail).
 *
 * @param path - Absolute path to the YAML policy file
 * @returns Array of validated, priority-sorted rules
 */
export function loadPolicyConfig(path: string): LoadedPolicyRule[] {
  // 1. Read the file
  let content: string;
  try {
    content = readFileSync(path, "utf-8");
  } catch (err) {
    throw new Error(
      `Policy config file not found or unreadable: ${path}`,
    );
  }

  // 2. Parse YAML
  let raw: unknown;
  try {
    raw = parse(content);
  } catch (err) {
    throw new Error(
      `Policy config contains invalid YAML: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // 3. Validate top-level structure
  if (
    raw === null ||
    raw === undefined ||
    typeof raw !== "object" ||
    !("policies" in raw)
  ) {
    throw new Error(
      "Policy config missing required 'policies' key at root level",
    );
  }

  const config = raw as RawPolicyConfig;
  const policies = config.policies;

  if (
    policies === null ||
    policies === undefined ||
    typeof policies !== "object"
  ) {
    throw new Error("Policy config 'policies' must be an object");
  }

  // 4. Validate default_action is "deny"
  if (policies.default_action !== "deny") {
    throw new Error(
      `Policy config default_action must be "deny", got "${String(policies.default_action)}"`,
    );
  }

  // 5. Validate rules array exists
  if (!Array.isArray(policies.rules)) {
    throw new Error("Policy config 'policies.rules' must be an array");
  }

  const rules = policies.rules as RawPolicyRule[];

  // 6. Validate each rule
  const seenIds = new Set<string>();
  const seenPriorities = new Set<number>();
  const validated: LoadedPolicyRule[] = [];

  for (const rule of rules) {
    // Check required fields
    if (typeof rule.id !== "string" || rule.id.length === 0) {
      throw new Error("Policy rule missing required 'id' field");
    }
    if (typeof rule.description !== "string") {
      throw new Error(`Policy rule '${rule.id}' missing required 'description' field`);
    }
    if (typeof rule.priority !== "number" || !Number.isInteger(rule.priority)) {
      throw new Error(`Policy rule '${rule.id}' has invalid priority (must be integer)`);
    }
    if (typeof rule.action !== "string") {
      throw new Error(`Policy rule '${rule.id}' missing required 'action' field`);
    }

    // Check for duplicate IDs
    if (seenIds.has(rule.id)) {
      throw new Error(`Duplicate rule id: '${rule.id}'`);
    }
    seenIds.add(rule.id);

    // Check for duplicate priorities
    if (seenPriorities.has(rule.priority)) {
      throw new Error(
        `Duplicate priority ${rule.priority} (rule '${rule.id}')`,
      );
    }
    seenPriorities.add(rule.priority);

    // Validate condition using Zod schema from shared
    const condResult = PolicyConditionSchema.safeParse(rule.condition);
    if (!condResult.success) {
      throw new Error(
        `Policy rule '${rule.id}' has invalid condition: ${condResult.error.message}`,
      );
    }

    // Validate action-specific fields
    const validActions = ["allow", "deny", "require_approval", "rate_limit"];
    if (!validActions.includes(rule.action)) {
      throw new Error(
        `Policy rule '${rule.id}' has unknown action '${rule.action}'`,
      );
    }

    validated.push({
      id: rule.id,
      description: rule.description,
      condition: condResult.data,
      action: rule.action,
      priority: rule.priority,
      tier: rule.tier,
      approval_description: rule.approval_description,
      deny_reason: rule.deny_reason,
      retry_after_seconds: rule.retry_after_seconds,
    });
  }

  // 7. Sort by priority (lower = evaluated first)
  validated.sort((a, b) => a.priority - b.priority);

  return validated;
}
