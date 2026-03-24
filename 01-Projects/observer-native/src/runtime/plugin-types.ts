/**
 * Plugin Types — Pillar 3 (Composable Plugin Architecture)
 *
 * Defines the plugin capability model, hook points, manifest schema,
 * plugin context, and the Plugin interface. Plugins observe and propose
 * but never bypass governance or the state machine.
 */

import type { RuntimeState, TransitionReceipt, QueueSnapshot } from './state-types.ts';
import type { GovernanceDecision } from './governance-types.ts';

// ---------------------------------------------------------------------------
// Plugin Capabilities (bounded sandbox)
// ---------------------------------------------------------------------------

export type PluginCapability =
  | "observe_events"
  | "emit_receipts"
  | "propose_transition"
  | "read_queue_state"
  | "write_artifacts";

// ---------------------------------------------------------------------------
// Plugin Hook Points
// ---------------------------------------------------------------------------

export type PluginHook =
  | "onIntake"
  | "onSynthesis"
  | "onReflection"
  | "onTransition"
  | "onOverflow"
  | "onHalt"
  | "onSessionStart"
  | "onSessionEnd";

// ---------------------------------------------------------------------------
// Plugin Manifest
// ---------------------------------------------------------------------------

export interface ObserverPluginManifest {
  readonly id: string;
  readonly version: string;
  readonly hooks: readonly PluginHook[];
  readonly capabilities: readonly PluginCapability[];
  readonly produces: readonly string[];
  readonly requiresSlowPathApproval: boolean;
  readonly description: string;
}

// ---------------------------------------------------------------------------
// Plugin Context (provided to plugin on each hook dispatch)
// ---------------------------------------------------------------------------

export interface PluginContext {
  readonly sessionId: string;
  readonly workUnitId: string;
  readonly state: RuntimeState;
  readonly policyVersion: string;
  readonly queueSnapshots: readonly QueueSnapshot[];
  readonly emitReceipt: (receipt: TransitionReceipt) => void;
  readonly writeArtifact: (name: string, content: string) => string;
}

// ---------------------------------------------------------------------------
// Plugin Result
// ---------------------------------------------------------------------------

export interface PluginResult {
  readonly pluginId: string;
  readonly hook: PluginHook;
  readonly proposedTransition?: RuntimeState;
  readonly artifacts: readonly string[];
  readonly receipts: readonly TransitionReceipt[];
  readonly governanceDecision?: GovernanceDecision;
}

// ---------------------------------------------------------------------------
// ObserverPlugin — the contract plugins implement
// ---------------------------------------------------------------------------

export interface ObserverPlugin {
  readonly manifest: ObserverPluginManifest;

  /** Called once when the plugin is registered and approved. */
  setup(context: PluginContext): Promise<void>;

  /** Called on each matching hook dispatch. */
  run(hook: PluginHook, context: PluginContext): Promise<PluginResult>;

  /** Called during drain lifecycle before removal. */
  teardown(context: PluginContext): Promise<void>;
}
