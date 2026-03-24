/**
 * P5 — Plugin Registry
 *
 * Lifecycle management: submit → validate → approve → enable → drain → remove.
 * ISC-P31, ISC-P32, ISC-P36, ISC-P37.
 */

import type {
  ObserverPlugin,
  ObserverPluginManifest,
  PluginHook,
} from './plugin-types.ts';
import { validateManifest } from './plugin-validator.ts';

// ---------------------------------------------------------------------------
// Plugin Lifecycle States
// ---------------------------------------------------------------------------

export type PluginLifecycleState =
  | 'SUBMITTED'
  | 'VALIDATED'
  | 'PENDING_APPROVAL'
  | 'ENABLED'
  | 'DRAINING'
  | 'REMOVED';

export interface PluginRegistration {
  readonly manifest: ObserverPluginManifest;
  readonly plugin: ObserverPlugin;
  state: PluginLifecycleState;
  registeredAt: string;
  enabledAt?: string;
  removedAt?: string;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export class PluginRegistry {
  private readonly plugins: Map<string, PluginRegistration> = new Map();

  /**
   * Submit a plugin for registration. ISC-P31.
   * Returns validation errors if manifest is invalid (ISC-P33 via validator).
   */
  submit(plugin: ObserverPlugin): { accepted: boolean; errors: string[] } {
    const validation = validateManifest(plugin.manifest);
    if (!validation.valid) {
      return { accepted: false, errors: [...validation.errors] };
    }

    if (this.plugins.has(plugin.manifest.id)) {
      return { accepted: false, errors: [`Plugin "${plugin.manifest.id}" already registered`] };
    }

    const registration: PluginRegistration = {
      manifest: plugin.manifest,
      plugin,
      state: 'PENDING_APPROVAL',
      registeredAt: new Date().toISOString(),
    };

    this.plugins.set(plugin.manifest.id, registration);
    return { accepted: true, errors: [] };
  }

  /**
   * Approve a pending plugin. Moves to ENABLED.
   * ISC-P32: Registration is SLOW_REQUIRED (enforced by caller via governance).
   */
  async approve(pluginId: string): Promise<boolean> {
    const reg = this.plugins.get(pluginId);
    if (!reg || reg.state !== 'PENDING_APPROVAL') return false;

    reg.state = 'ENABLED';
    reg.enabledAt = new Date().toISOString();

    // Call plugin setup
    const { createPluginContext } = await import('./plugin-contract.ts');
    const { context } = createPluginContext({
      sessionId: 'system',
      workUnitId: 'plugin-setup',
      state: 'IDLE',
      policyVersion: '',
      queueSnapshots: [],
      artifactDir: 'tmp/plugin-artifacts',
    });

    await reg.plugin.setup(context);
    return true;
  }

  /** Deny a pending plugin. Removes it. */
  deny(pluginId: string): boolean {
    const reg = this.plugins.get(pluginId);
    if (!reg || reg.state !== 'PENDING_APPROVAL') return false;
    this.plugins.delete(pluginId);
    return true;
  }

  /**
   * Begin drain lifecycle for removal. ISC-P36.
   * DRAINING → stop dispatch → flush → receipt → REMOVED.
   */
  async drain(pluginId: string): Promise<boolean> {
    const reg = this.plugins.get(pluginId);
    if (!reg || reg.state !== 'ENABLED') return false;

    // Step 1: Mark DRAINING — stops new hook dispatch
    reg.state = 'DRAINING';

    // Step 2: Call teardown to flush in-flight work
    const { createPluginContext } = await import('./plugin-contract.ts');
    const { context } = createPluginContext({
      sessionId: 'system',
      workUnitId: 'plugin-teardown',
      state: 'IDLE',
      policyVersion: '',
      queueSnapshots: [],
      artifactDir: 'tmp/plugin-artifacts',
    });

    await reg.plugin.teardown(context);

    // Step 3: Mark REMOVED
    reg.state = 'REMOVED';
    reg.removedAt = new Date().toISOString();

    return true;
  }

  /** Get all active (ENABLED) plugins. ISC-P37. */
  getActive(): readonly PluginRegistration[] {
    return [...this.plugins.values()].filter((r) => r.state === 'ENABLED');
  }

  /** Get all plugins with their manifests (for observability). ISC-P37. */
  getAll(): readonly PluginRegistration[] {
    return [...this.plugins.values()];
  }

  /** Get plugins registered for a specific hook. */
  getByHook(hook: PluginHook): readonly PluginRegistration[] {
    return this.getActive().filter(
      (r) => r.manifest.hooks.includes(hook),
    );
  }

  /** Get a specific plugin registration. */
  get(pluginId: string): PluginRegistration | undefined {
    return this.plugins.get(pluginId);
  }

  /** Check if a plugin is active. */
  isActive(pluginId: string): boolean {
    const reg = this.plugins.get(pluginId);
    return reg?.state === 'ENABLED';
  }
}
