/**
 * P5 — Plugin Contract Enforcement
 *
 * Capability-bounded sandbox. Plugins observe and propose but never bypass.
 * ISC-P34: propose_transition can propose but not commit.
 * ISC-P35: Plugin prohibitions enforced.
 * ISC-P38: PluginContext provides required fields.
 */

import type {
  ObserverPlugin,
  ObserverPluginManifest,
  PluginHook,
  PluginContext,
  PluginResult,
  PluginCapability,
} from './plugin-types.ts';
import type { RuntimeState, TransitionReceipt, QueueSnapshot } from './state-types.ts';

// ---------------------------------------------------------------------------
// Sandboxed Plugin Context Factory
// ---------------------------------------------------------------------------

export interface PluginContextConfig {
  sessionId: string;
  workUnitId: string;
  state: RuntimeState;
  policyVersion: string;
  queueSnapshots: readonly QueueSnapshot[];
  artifactDir: string;
}

/**
 * Create a sandboxed PluginContext. ISC-P38.
 * Receipts and artifacts are collected, not directly committed.
 */
export function createPluginContext(config: PluginContextConfig): {
  context: PluginContext;
  collectedReceipts: TransitionReceipt[];
  collectedArtifacts: Array<{ name: string; content: string; path: string }>;
} {
  const collectedReceipts: TransitionReceipt[] = [];
  const collectedArtifacts: Array<{ name: string; content: string; path: string }> = [];

  const context: PluginContext = {
    sessionId: config.sessionId,
    workUnitId: config.workUnitId,
    state: config.state,
    policyVersion: config.policyVersion,
    queueSnapshots: config.queueSnapshots,
    emitReceipt: (receipt: TransitionReceipt) => {
      collectedReceipts.push(receipt);
    },
    writeArtifact: (name: string, content: string) => {
      const path = `${config.artifactDir}/${name}`;
      collectedArtifacts.push({ name, content, path });
      return path;
    },
  };

  return { context, collectedReceipts, collectedArtifacts };
}

// ---------------------------------------------------------------------------
// Contract Enforcement
// ---------------------------------------------------------------------------

/**
 * Validate a plugin result against the manifest's declared capabilities.
 * ISC-P34: Proposed transitions are recorded but NOT committed.
 * ISC-P35: Enforce prohibitions.
 */
export function enforceContract(
  manifest: ObserverPluginManifest,
  result: PluginResult,
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  const capabilities = new Set(manifest.capabilities);

  // ISC-P34: propose_transition capability check
  if (result.proposedTransition !== undefined) {
    if (!capabilities.has('propose_transition')) {
      violations.push(
        `Plugin "${manifest.id}" proposed transition without propose_transition capability`,
      );
    }
    // Even with the capability, proposals are never auto-committed
  }

  // Check receipt emission capability
  if (result.receipts.length > 0 && !capabilities.has('emit_receipts')) {
    violations.push(
      `Plugin "${manifest.id}" emitted receipts without emit_receipts capability`,
    );
  }

  // Check artifact writing capability
  if (result.artifacts.length > 0 && !capabilities.has('write_artifacts')) {
    violations.push(
      `Plugin "${manifest.id}" wrote artifacts without write_artifacts capability`,
    );
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Dispatch a hook to a plugin within the sandbox. ISC-P35.
 * Returns the result only if the contract is not violated.
 */
export async function dispatchHook(
  plugin: ObserverPlugin,
  hook: PluginHook,
  contextConfig: PluginContextConfig,
): Promise<{
  result: PluginResult;
  valid: boolean;
  violations: string[];
  collectedReceipts: TransitionReceipt[];
  collectedArtifacts: Array<{ name: string; content: string; path: string }>;
}> {
  // Verify hook is declared in manifest
  if (!plugin.manifest.hooks.includes(hook)) {
    return {
      result: {
        pluginId: plugin.manifest.id,
        hook,
        artifacts: [],
        receipts: [],
      },
      valid: false,
      violations: [`Plugin "${plugin.manifest.id}" not registered for hook "${hook}"`],
      collectedReceipts: [],
      collectedArtifacts: [],
    };
  }

  const { context, collectedReceipts, collectedArtifacts } = createPluginContext(contextConfig);
  const result = await plugin.run(hook, context);

  const { valid, violations } = enforceContract(plugin.manifest, result);

  return { result, valid, violations, collectedReceipts, collectedArtifacts };
}
