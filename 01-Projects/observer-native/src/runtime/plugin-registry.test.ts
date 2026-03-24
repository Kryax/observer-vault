/**
 * P5 Tests — Plugin Contract + Registry + Validator
 * ISC-P31 through ISC-P38
 */

import { describe, test, expect } from 'bun:test';
import { PluginRegistry } from './plugin-registry.ts';
import { validateManifest } from './plugin-validator.ts';
import { enforceContract, createPluginContext } from './plugin-contract.ts';
import type {
  ObserverPlugin,
  ObserverPluginManifest,
  PluginHook,
  PluginContext,
  PluginResult,
} from './plugin-types.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeManifest(overrides: Partial<ObserverPluginManifest> = {}): ObserverPluginManifest {
  return {
    id: 'test-plugin',
    version: '1.0.0',
    hooks: ['onIntake'] as PluginHook[],
    capabilities: ['observe_events'],
    produces: ['observations'],
    requiresSlowPathApproval: true,
    description: 'Test plugin',
    ...overrides,
  };
}

function makePlugin(manifest?: ObserverPluginManifest): ObserverPlugin {
  const m = manifest ?? makeManifest();
  return {
    manifest: m,
    setup: async () => {},
    run: async (hook: PluginHook, _ctx: PluginContext): Promise<PluginResult> => ({
      pluginId: m.id,
      hook,
      artifacts: [],
      receipts: [],
    }),
    teardown: async () => {},
  };
}

// ---------------------------------------------------------------------------
// ISC-P31: Manifest declares required fields
// ---------------------------------------------------------------------------

describe('ISC-P31: Manifest fields', () => {
  test('valid manifest has all required fields', () => {
    const m = makeManifest();
    expect(m.id).toBeTruthy();
    expect(m.version).toBeTruthy();
    expect(m.hooks.length).toBeGreaterThan(0);
    expect(m.capabilities.length).toBeGreaterThan(0);
    expect(m.produces).toBeDefined();
    expect(typeof m.requiresSlowPathApproval).toBe('boolean');
  });
});

// ---------------------------------------------------------------------------
// ISC-P33: Validator rejects invalid manifests
// ---------------------------------------------------------------------------

describe('ISC-P33: Validator', () => {
  test('rejects unknown hook names', () => {
    const result = validateManifest(makeManifest({
      hooks: ['onIntake', 'onFakeHook' as PluginHook],
    }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Unknown hook'))).toBe(true);
  });

  test('rejects unknown capabilities', () => {
    const result = validateManifest(makeManifest({
      capabilities: ['observe_events', 'fly_to_moon' as any],
    }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Unknown capability'))).toBe(true);
  });

  test('rejects empty hooks', () => {
    const result = validateManifest(makeManifest({ hooks: [] }));
    expect(result.valid).toBe(false);
  });

  test('rejects empty id', () => {
    const result = validateManifest(makeManifest({ id: '' }));
    expect(result.valid).toBe(false);
  });

  test('accepts valid manifest', () => {
    const result = validateManifest(makeManifest());
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// ISC-P34: propose_transition capability
// ---------------------------------------------------------------------------

describe('ISC-P34: Propose transition', () => {
  test('plugin with capability can propose (result recorded)', () => {
    const manifest = makeManifest({ capabilities: ['propose_transition'] });
    const result: PluginResult = {
      pluginId: 'test',
      hook: 'onIntake',
      proposedTransition: 'SYNTHESIS',
      artifacts: [],
      receipts: [],
    };
    const { valid } = enforceContract(manifest, result);
    expect(valid).toBe(true);
  });

  test('plugin without capability cannot propose', () => {
    const manifest = makeManifest({ capabilities: ['observe_events'] });
    const result: PluginResult = {
      pluginId: 'test',
      hook: 'onIntake',
      proposedTransition: 'SYNTHESIS',
      artifacts: [],
      receipts: [],
    };
    const { valid, violations } = enforceContract(manifest, result);
    expect(valid).toBe(false);
    expect(violations[0]).toContain('propose_transition');
  });
});

// ---------------------------------------------------------------------------
// ISC-P35: Plugin prohibitions
// ---------------------------------------------------------------------------

describe('ISC-P35: Plugin prohibitions', () => {
  test('cannot emit receipts without capability', () => {
    const manifest = makeManifest({ capabilities: ['observe_events'] });
    const result: PluginResult = {
      pluginId: 'test',
      hook: 'onIntake',
      artifacts: [],
      receipts: [{
        id: 'r-1', priorState: 'IDLE', nextState: 'INTAKE',
        actor: 'plugin', timestamp: '', guardResults: [],
        policyVersion: '', queueSnapshot: [],
        event: { type: 'test', actor: 'test', timestamp: '', payload: {} },
      }],
    };
    const { valid } = enforceContract(manifest, result);
    expect(valid).toBe(false);
  });

  test('cannot write artifacts without capability', () => {
    const manifest = makeManifest({ capabilities: ['observe_events'] });
    const result: PluginResult = {
      pluginId: 'test',
      hook: 'onIntake',
      artifacts: ['file.txt'],
      receipts: [],
    };
    const { valid } = enforceContract(manifest, result);
    expect(valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ISC-P36: Drain lifecycle
// ---------------------------------------------------------------------------

describe('ISC-P36: Drain lifecycle', () => {
  test('full lifecycle: submit → approve → drain', async () => {
    const registry = new PluginRegistry();
    const plugin = makePlugin();

    const { accepted } = registry.submit(plugin);
    expect(accepted).toBe(true);

    const reg = registry.get('test-plugin');
    expect(reg?.state).toBe('PENDING_APPROVAL');

    await registry.approve('test-plugin');
    expect(registry.get('test-plugin')?.state).toBe('ENABLED');

    await registry.drain('test-plugin');
    expect(registry.get('test-plugin')?.state).toBe('REMOVED');
  });
});

// ---------------------------------------------------------------------------
// ISC-P37: List active plugins
// ---------------------------------------------------------------------------

describe('ISC-P37: Active plugin listing', () => {
  test('getActive returns only ENABLED plugins', async () => {
    const registry = new PluginRegistry();
    const p1 = makePlugin(makeManifest({ id: 'p1' }));
    const p2 = makePlugin(makeManifest({ id: 'p2' }));

    registry.submit(p1);
    registry.submit(p2);
    await registry.approve('p1');

    const active = registry.getActive();
    expect(active.length).toBe(1);
    expect(active[0].manifest.id).toBe('p1');
  });
});

// ---------------------------------------------------------------------------
// ISC-P38: PluginContext fields
// ---------------------------------------------------------------------------

describe('ISC-P38: PluginContext', () => {
  test('context provides all required fields', () => {
    const { context } = createPluginContext({
      sessionId: 'sess-001',
      workUnitId: 'wu-001',
      state: 'INTAKE',
      policyVersion: 'abc123',
      queueSnapshots: [{ name: 'ingestion', depth: 5, capacity: 128, softThreshold: 96, hardThreshold: 128 }],
      artifactDir: 'tmp/artifacts',
    });

    expect(context.sessionId).toBe('sess-001');
    expect(context.workUnitId).toBe('wu-001');
    expect(context.state).toBe('INTAKE');
    expect(context.policyVersion).toBe('abc123');
    expect(context.queueSnapshots.length).toBe(1);
    expect(typeof context.emitReceipt).toBe('function');
    expect(typeof context.writeArtifact).toBe('function');
  });

  test('emitReceipt collects receipts', () => {
    const { context, collectedReceipts } = createPluginContext({
      sessionId: 'sess', workUnitId: 'wu', state: 'IDLE',
      policyVersion: '', queueSnapshots: [], artifactDir: 'tmp',
    });
    context.emitReceipt({
      id: 'r-1', priorState: 'IDLE', nextState: 'INTAKE', actor: 'test',
      timestamp: '', guardResults: [], policyVersion: '', queueSnapshot: [],
      event: { type: 'test', actor: 'test', timestamp: '', payload: {} },
    });
    expect(collectedReceipts.length).toBe(1);
  });

  test('writeArtifact collects artifacts', () => {
    const { context, collectedArtifacts } = createPluginContext({
      sessionId: 'sess', workUnitId: 'wu', state: 'IDLE',
      policyVersion: '', queueSnapshots: [], artifactDir: 'tmp/art',
    });
    const path = context.writeArtifact('report.json', '{}');
    expect(path).toBe('tmp/art/report.json');
    expect(collectedArtifacts.length).toBe(1);
  });
});
