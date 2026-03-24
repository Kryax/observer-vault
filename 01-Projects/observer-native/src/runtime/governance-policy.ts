/**
 * P3 — Governance Policy Classifier
 *
 * Single point of speed classification: every action is FAST_ALLOWED,
 * SLOW_REQUIRED, or DISALLOWED. No module self-classifies.
 *
 * ISC-P16 through ISC-P22, ISC-P56, ISC-P57.
 */

import { createHash } from 'node:crypto';
import type {
  GovernanceSpeed,
  GovernanceActionClass,
  GovernanceDecision,
  GovernanceDecisionFast,
  GovernanceDecisionSlow,
  GovernanceDecisionDisallowed,
} from './governance-types.ts';
import type { RuntimeState, RuntimeEvent, TransitionGuardResult } from './state-types.ts';

// ---------------------------------------------------------------------------
// Policy Rules
// ---------------------------------------------------------------------------

export interface PolicyRule {
  readonly actionClass: GovernanceActionClass;
  readonly speed: GovernanceSpeed;
  readonly gateType?: string;
  readonly reason?: string;
}

/** Default policy rules. ISC-P16 through ISC-P18, ISC-P57. */
const DEFAULT_POLICY_RULES: readonly PolicyRule[] = [
  // FAST_ALLOWED (ISC-P17)
  { actionClass: 'SESSION_OPERATION', speed: 'FAST_ALLOWED' },
  { actionClass: 'TASK_EXECUTION', speed: 'FAST_ALLOWED' },
  { actionClass: 'BUFFER_MANAGEMENT', speed: 'FAST_ALLOWED' },
  { actionClass: 'RECEIPT_GENERATION', speed: 'FAST_ALLOWED' },

  // SLOW_REQUIRED (ISC-P18)
  { actionClass: 'PLUGIN_REGISTRATION', speed: 'SLOW_REQUIRED', gateType: 'plugin-registration' },
  { actionClass: 'HUMAN_GATE_RESOLUTION', speed: 'SLOW_REQUIRED', gateType: 'human-gate' },
  { actionClass: 'ARCHITECTURAL_CHANGE', speed: 'SLOW_REQUIRED', gateType: 'architectural-change' },
  { actionClass: 'SOVEREIGNTY_DECISION', speed: 'SLOW_REQUIRED', gateType: 'sovereignty-decision' },
  // ISC-P57: ALGEBRA_REVIEW with gateType "algebra-review"
  { actionClass: 'ALGEBRA_REVIEW', speed: 'SLOW_REQUIRED', gateType: 'algebra-review' },
];

// ---------------------------------------------------------------------------
// Policy Version (ISC-P56: content-hash)
// ---------------------------------------------------------------------------

function computePolicyVersion(rules: readonly PolicyRule[]): string {
  const sorted = [...rules].sort((a, b) =>
    a.actionClass.localeCompare(b.actionClass),
  );
  const hash = createHash('sha256')
    .update(JSON.stringify(sorted))
    .digest('hex');
  return hash.slice(0, 12);
}

// ---------------------------------------------------------------------------
// Governance Policy
// ---------------------------------------------------------------------------

export class GovernancePolicy {
  private readonly rules: Map<GovernanceActionClass, PolicyRule>;
  private readonly _policyVersion: string;

  constructor(rulesOverride?: readonly PolicyRule[]) {
    const activeRules = rulesOverride ?? DEFAULT_POLICY_RULES;
    this.rules = new Map(activeRules.map((r) => [r.actionClass, r]));
    this._policyVersion = computePolicyVersion(activeRules);
  }

  /** ISC-P19: Every decision includes policyVersion. */
  get policyVersion(): string {
    return this._policyVersion;
  }

  /**
   * Classify an action. ISC-P16.
   * Returns a discriminated GovernanceDecision.
   */
  classify(actionClass: GovernanceActionClass): GovernanceDecision {
    const rule = this.rules.get(actionClass);

    if (!rule) {
      // Unknown action class → DISALLOWED. ISC-P21.
      return {
        speed: 'DISALLOWED',
        actionClass,
        policyVersion: this._policyVersion,
        reason: `Unknown action class: ${actionClass}`,
      } satisfies GovernanceDecisionDisallowed;
    }

    switch (rule.speed) {
      case 'FAST_ALLOWED':
        return {
          speed: 'FAST_ALLOWED',
          actionClass,
          policyVersion: this._policyVersion,
        } satisfies GovernanceDecisionFast;

      case 'SLOW_REQUIRED':
        return {
          speed: 'SLOW_REQUIRED',
          actionClass,
          policyVersion: this._policyVersion,
          gateType: rule.gateType ?? 'unknown',
        } satisfies GovernanceDecisionSlow;

      case 'DISALLOWED':
        return {
          speed: 'DISALLOWED',
          actionClass,
          policyVersion: this._policyVersion,
          reason: rule.reason ?? `Action ${actionClass} is disallowed by policy`,
        } satisfies GovernanceDecisionDisallowed;
    }
  }

  /**
   * Create a transition guard that enforces governance. ISC-P22.
   * SLOW_REQUIRED blocks transition and requires HUMAN_REVIEW.
   */
  createTransitionGuard(
    actionClass: GovernanceActionClass,
  ): (current: RuntimeState, proposed: RuntimeState, event: RuntimeEvent) => TransitionGuardResult {
    return (_current, _proposed, _event) => {
      const decision = this.classify(actionClass);

      if (decision.speed === 'DISALLOWED') {
        return {
          allowed: false,
          guardId: `governance-${actionClass}`,
          reason: `DISALLOWED: ${(decision as GovernanceDecisionDisallowed).reason}`,
        };
      }

      if (decision.speed === 'SLOW_REQUIRED') {
        // SLOW_REQUIRED should trigger HUMAN_REVIEW transition
        // The guard blocks the original transition; the caller must redirect to HUMAN_REVIEW
        return {
          allowed: false,
          guardId: `governance-${actionClass}`,
          reason: `SLOW_REQUIRED: gate=${(decision as GovernanceDecisionSlow).gateType}`,
        };
      }

      return {
        allowed: true,
        guardId: `governance-${actionClass}`,
        reason: 'FAST_ALLOWED',
      };
    };
  }

  /** Get all rules (for observability). */
  getRules(): readonly PolicyRule[] {
    return [...this.rules.values()];
  }
}

export { DEFAULT_POLICY_RULES, computePolicyVersion };
