/**
 * P3 Tests — Governance Policy
 * ISC-P16 through ISC-P22, ISC-P56, ISC-P57
 */

import { describe, test, expect } from 'bun:test';
import { GovernancePolicy, computePolicyVersion, DEFAULT_POLICY_RULES } from './governance-policy.ts';
import type { GovernanceActionClass, GovernanceDecisionSlow, GovernanceDecisionDisallowed } from './governance-types.ts';

// ---------------------------------------------------------------------------
// ISC-P16: All 9 action classes classified
// ---------------------------------------------------------------------------

describe('ISC-P16: All action classes classified', () => {
  const policy = new GovernancePolicy();
  const allClasses: GovernanceActionClass[] = [
    'SESSION_OPERATION', 'TASK_EXECUTION', 'BUFFER_MANAGEMENT', 'RECEIPT_GENERATION',
    'PLUGIN_REGISTRATION', 'HUMAN_GATE_RESOLUTION', 'ARCHITECTURAL_CHANGE',
    'SOVEREIGNTY_DECISION', 'ALGEBRA_REVIEW',
  ];

  for (const ac of allClasses) {
    test(`${ac} is classified`, () => {
      const decision = policy.classify(ac);
      expect(decision.speed).toBeDefined();
      expect(decision.policyVersion).toBe(policy.policyVersion);
    });
  }
});

// ---------------------------------------------------------------------------
// ISC-P17: FAST_ALLOWED classifications
// ---------------------------------------------------------------------------

describe('ISC-P17: FAST_ALLOWED', () => {
  const policy = new GovernancePolicy();

  test('SESSION_OPERATION is FAST_ALLOWED', () => {
    expect(policy.classify('SESSION_OPERATION').speed).toBe('FAST_ALLOWED');
  });

  test('TASK_EXECUTION is FAST_ALLOWED', () => {
    expect(policy.classify('TASK_EXECUTION').speed).toBe('FAST_ALLOWED');
  });
});

// ---------------------------------------------------------------------------
// ISC-P18: SLOW_REQUIRED classifications
// ---------------------------------------------------------------------------

describe('ISC-P18: SLOW_REQUIRED', () => {
  const policy = new GovernancePolicy();

  test('HUMAN_GATE_RESOLUTION is SLOW_REQUIRED', () => {
    expect(policy.classify('HUMAN_GATE_RESOLUTION').speed).toBe('SLOW_REQUIRED');
  });

  test('ARCHITECTURAL_CHANGE is SLOW_REQUIRED', () => {
    expect(policy.classify('ARCHITECTURAL_CHANGE').speed).toBe('SLOW_REQUIRED');
  });

  test('ALGEBRA_REVIEW is SLOW_REQUIRED', () => {
    expect(policy.classify('ALGEBRA_REVIEW').speed).toBe('SLOW_REQUIRED');
  });
});

// ---------------------------------------------------------------------------
// ISC-P19: Every decision includes policyVersion
// ---------------------------------------------------------------------------

describe('ISC-P19: policyVersion', () => {
  const policy = new GovernancePolicy();

  test('all decisions include policyVersion', () => {
    const decision = policy.classify('SESSION_OPERATION');
    expect(decision.policyVersion).toBeTruthy();
    expect(typeof decision.policyVersion).toBe('string');
    expect(decision.policyVersion.length).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// ISC-P20: SLOW_REQUIRED includes gateType
// ---------------------------------------------------------------------------

describe('ISC-P20: gateType', () => {
  const policy = new GovernancePolicy();

  test('SLOW_REQUIRED decisions include gateType', () => {
    const decision = policy.classify('PLUGIN_REGISTRATION');
    expect(decision.speed).toBe('SLOW_REQUIRED');
    expect((decision as GovernanceDecisionSlow).gateType).toBe('plugin-registration');
  });
});

// ---------------------------------------------------------------------------
// ISC-P21: DISALLOWED includes reason
// ---------------------------------------------------------------------------

describe('ISC-P21: DISALLOWED reason', () => {
  const policy = new GovernancePolicy();

  test('unknown action class gets DISALLOWED with reason', () => {
    const decision = policy.classify('NONEXISTENT' as GovernanceActionClass);
    expect(decision.speed).toBe('DISALLOWED');
    expect((decision as GovernanceDecisionDisallowed).reason).toContain('Unknown action class');
  });
});

// ---------------------------------------------------------------------------
// ISC-P22: Governance as transition guard
// ---------------------------------------------------------------------------

describe('ISC-P22: Transition guard integration', () => {
  const policy = new GovernancePolicy();

  test('FAST_ALLOWED guard allows transition', () => {
    const guard = policy.createTransitionGuard('SESSION_OPERATION');
    const result = guard('IDLE', 'INTAKE', {
      type: 'test', actor: 'test', timestamp: '', payload: {},
    });
    expect(result.allowed).toBe(true);
  });

  test('SLOW_REQUIRED guard blocks transition', () => {
    const guard = policy.createTransitionGuard('PLUGIN_REGISTRATION');
    const result = guard('IDLE', 'INTAKE', {
      type: 'test', actor: 'test', timestamp: '', payload: {},
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('SLOW_REQUIRED');
  });
});

// ---------------------------------------------------------------------------
// ISC-P56: Deterministic content-hash
// ---------------------------------------------------------------------------

describe('ISC-P56: Hash stability', () => {
  test('same rules produce same policyVersion', () => {
    const v1 = computePolicyVersion(DEFAULT_POLICY_RULES);
    const v2 = computePolicyVersion(DEFAULT_POLICY_RULES);
    expect(v1).toBe(v2);
  });

  test('different rules produce different policyVersion', () => {
    const v1 = computePolicyVersion(DEFAULT_POLICY_RULES);
    const modified = [...DEFAULT_POLICY_RULES, {
      actionClass: 'SESSION_OPERATION' as const,
      speed: 'SLOW_REQUIRED' as const,
      gateType: 'custom',
    }];
    const v2 = computePolicyVersion(modified);
    expect(v1).not.toBe(v2);
  });
});

// ---------------------------------------------------------------------------
// ISC-P57: ALGEBRA_REVIEW gate type
// ---------------------------------------------------------------------------

describe('ISC-P57: ALGEBRA_REVIEW', () => {
  const policy = new GovernancePolicy();

  test('ALGEBRA_REVIEW produces SLOW_REQUIRED with algebra-review gate', () => {
    const decision = policy.classify('ALGEBRA_REVIEW');
    expect(decision.speed).toBe('SLOW_REQUIRED');
    expect((decision as GovernanceDecisionSlow).gateType).toBe('algebra-review');
  });
});
