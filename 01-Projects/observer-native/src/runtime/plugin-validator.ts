/**
 * P5 — Plugin Validator
 *
 * Validates plugin manifests against the contract.
 * ISC-P33: Rejects unknown hook names or capability values.
 */

import type {
  ObserverPluginManifest,
  PluginHook,
  PluginCapability,
} from './plugin-types.ts';

// ---------------------------------------------------------------------------
// Valid values
// ---------------------------------------------------------------------------

const VALID_HOOKS: ReadonlySet<PluginHook> = new Set([
  'onIntake', 'onSynthesis', 'onReflection', 'onTransition',
  'onOverflow', 'onHalt', 'onSessionStart', 'onSessionEnd',
]);

const VALID_CAPABILITIES: ReadonlySet<PluginCapability> = new Set([
  'observe_events', 'emit_receipts', 'propose_transition',
  'read_queue_state', 'write_artifacts',
]);

// ---------------------------------------------------------------------------
// Validation Result
// ---------------------------------------------------------------------------

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

export function validateManifest(manifest: ObserverPluginManifest): ValidationResult {
  const errors: string[] = [];

  // Required fields
  if (!manifest.id || manifest.id.trim() === '') {
    errors.push('Manifest must have a non-empty id');
  }
  if (!manifest.version || manifest.version.trim() === '') {
    errors.push('Manifest must have a non-empty version');
  }

  // ISC-P33: Reject unknown hooks
  for (const hook of manifest.hooks) {
    if (!VALID_HOOKS.has(hook)) {
      errors.push(`Unknown hook: "${hook}". Valid hooks: ${[...VALID_HOOKS].join(', ')}`);
    }
  }

  // ISC-P33: Reject unknown capabilities
  for (const cap of manifest.capabilities) {
    if (!VALID_CAPABILITIES.has(cap)) {
      errors.push(`Unknown capability: "${cap}". Valid capabilities: ${[...VALID_CAPABILITIES].join(', ')}`);
    }
  }

  // At least one hook required
  if (manifest.hooks.length === 0) {
    errors.push('Manifest must declare at least one hook');
  }

  // At least one capability required
  if (manifest.capabilities.length === 0) {
    errors.push('Manifest must declare at least one capability');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export { VALID_HOOKS, VALID_CAPABILITIES };
