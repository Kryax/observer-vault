import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { generateFeed } from '../../src/federation/publisher';
import { loadFederationConfig, saveFederationConfig, addSubscription, getSubscription } from '../../src/federation/config';
import type { SolutionRecord } from '../../src/types/solution-record';
import type { FederationConfig, JSONFeed } from '../../src/federation/types';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TEST_DIR = join(import.meta.dir, '__test-federation__');

function makeRecord(overrides: Partial<{
  id: string;
  title: string;
  description: string;
  statement: string;
  dateCreated: string;
  dateModified: string;
  domains: string[];
  keywords: string[];
  repoUri: string;
}>): SolutionRecord {
  const o = {
    id: 'ocp:test-record',
    title: 'Test Record',
    description: 'A test record',
    statement: 'Solves a test problem',
    dateCreated: '2026-01-01T00:00:00Z',
    dateModified: '2026-02-01T00:00:00Z',
    domains: ['testing'],
    keywords: ['test', 'fixture'],
    repoUri: 'https://github.com/test/repo',
    ...overrides,
  };

  return {
    '@context': 'https://observercommons.org/ns/v1',
    '@type': 'SolutionRecord',
    '@id': o.id,
    meta: {
      title: o.title,
      description: o.description,
      version: '1.0.0',
      dateCreated: o.dateCreated,
      dateModified: o.dateModified,
      keywords: o.keywords,
    },
    problemSolved: {
      statement: o.statement,
      cynefinDomain: 'clear',
    },
    domains: o.domains,
    validation: {
      method: 'test-suite',
      evidence: [],
    },
    implementation: {
      type: 'library',
      refs: [
        { type: 'repository', uri: o.repoUri },
      ],
    },
    composability: {
      inputs: [],
      outputs: [],
      dependencies: [],
      composableWith: [],
    },
    provenance: {
      authors: [{ name: 'Test Author', type: 'human' }],
      sourceType: 'scraped',
    },
    trust: {
      vector: {
        competence: 0.7,
        integrity: 0.8,
        benevolence: 0.6,
        transparency: 0.9,
        reliability: 0.7,
      },
      confidence: 'tested',
      authority: 'medium',
      status: 'active',
    },
  };
}

function makeConfig(overrides: Partial<FederationConfig> = {}): FederationConfig {
  return {
    vault_id: 'test-vault-id',
    vault_name: 'Test Vault',
    publish: {
      enabled: true,
      output_path: 'feed.json',
      include_full_records: true,
    },
    subscriptions: [],
    trust: {
      default_discount: 0.5,
      allow_trust_escalation: false,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Publisher tests
// ---------------------------------------------------------------------------

describe('generateFeed', () => {
  it('returns a valid JSON Feed 1.1 structure', () => {
    const records = [makeRecord({})];
    const config = makeConfig();
    const feed = generateFeed(records, config);

    expect(feed.version).toBe('https://jsonfeed.org/version/1.1');
    expect(feed.title).toBe('Test Vault');
    expect(feed.items).toHaveLength(1);
  });

  it('includes _ocp extension with vault metadata', () => {
    const records = [makeRecord({})];
    const config = makeConfig();
    const feed = generateFeed(records, config);

    expect(feed._ocp).toBeDefined();
    expect(feed._ocp!.vault_id).toBe('test-vault-id');
    expect(feed._ocp!.vault_name).toBe('Test Vault');
    expect(feed._ocp!.record_count).toBe(1);
    expect(feed._ocp!.published_at).toBeDefined();
  });

  it('maps record fields to feed item fields correctly', () => {
    const records = [makeRecord({
      id: 'ocp:my-solution',
      title: 'My Solution',
      description: 'Great solution',
      statement: 'Problem statement here',
      repoUri: 'https://github.com/example/repo',
      dateCreated: '2026-01-15T00:00:00Z',
      dateModified: '2026-02-20T00:00:00Z',
      domains: ['devops', 'ci-cd'],
      keywords: ['automation', 'pipeline'],
    })];
    const config = makeConfig();
    const feed = generateFeed(records, config);
    const item = feed.items[0];

    expect(item.id).toBe('ocp:my-solution');
    expect(item.title).toBe('My Solution');
    expect(item.content_text).toBe('Problem statement here');
    expect(item.summary).toBe('Great solution');
    expect(item.url).toBe('https://github.com/example/repo');
    expect(item.date_published).toBe('2026-01-15T00:00:00Z');
    expect(item.date_modified).toBe('2026-02-20T00:00:00Z');
    expect(item.tags).toEqual(['devops', 'ci-cd', 'automation', 'pipeline']);
  });

  it('embeds full record when include_full_records is true', () => {
    const record = makeRecord({});
    const config = makeConfig({ publish: { enabled: true, output_path: 'feed.json', include_full_records: true } });
    const feed = generateFeed([record], config);

    expect(feed.items[0]._ocp_record).toBeDefined();
    expect((feed.items[0]._ocp_record as Record<string, unknown>)['@id']).toBe('ocp:test-record');
  });

  it('omits full record when include_full_records is false', () => {
    const record = makeRecord({});
    const config = makeConfig({ publish: { enabled: true, output_path: 'feed.json', include_full_records: false } });
    const feed = generateFeed([record], config);

    expect(feed.items[0]._ocp_record).toBeUndefined();
  });

  it('sorts items by dateModified descending (newest first)', () => {
    const records = [
      makeRecord({ id: 'ocp:old', dateModified: '2026-01-01T00:00:00Z' }),
      makeRecord({ id: 'ocp:new', dateModified: '2026-03-01T00:00:00Z' }),
      makeRecord({ id: 'ocp:mid', dateModified: '2026-02-01T00:00:00Z' }),
    ];
    const config = makeConfig();
    const feed = generateFeed(records, config);

    expect(feed.items[0].id).toBe('ocp:new');
    expect(feed.items[1].id).toBe('ocp:mid');
    expect(feed.items[2].id).toBe('ocp:old');
  });

  it('handles empty records array', () => {
    const feed = generateFeed([], makeConfig());

    expect(feed.items).toHaveLength(0);
    expect(feed._ocp!.record_count).toBe(0);
  });

  it('handles record with no repository ref gracefully', () => {
    const record = makeRecord({});
    // Remove the repository ref
    record.implementation.refs = [{ type: 'documentation', uri: 'https://docs.example.com' }];
    const feed = generateFeed([record], makeConfig());

    expect(feed.items[0].url).toBeUndefined();
  });

  it('handles record with no keywords gracefully', () => {
    const record = makeRecord({ domains: ['testing'] });
    record.meta.keywords = undefined;
    const feed = generateFeed([record], makeConfig());

    expect(feed.items[0].tags).toEqual(['testing']);
  });
});

// ---------------------------------------------------------------------------
// Config tests
// ---------------------------------------------------------------------------

describe('federation config', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('initializes a new config with a generated vault_id', () => {
    const config = loadFederationConfig(TEST_DIR);

    expect(config.vault_id).toBeTruthy();
    expect(config.vault_id.length).toBeGreaterThan(0);
    expect(config.vault_name).toBe('My OCP Vault');
    expect(config.publish.enabled).toBe(false);
    expect(config.subscriptions).toEqual([]);
    expect(config.trust.default_discount).toBe(0.5);
  });

  it('persists config to .ocp/federation.json', () => {
    const config = loadFederationConfig(TEST_DIR);
    saveFederationConfig(TEST_DIR, config);

    const filePath = join(TEST_DIR, '.ocp', 'federation.json');
    expect(existsSync(filePath)).toBe(true);

    const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
    expect(raw.vault_id).toBe(config.vault_id);
  });

  it('loads existing config from disk', () => {
    // Write a config first
    const original = makeConfig({ vault_id: 'persistent-id', vault_name: 'Saved Vault' });
    saveFederationConfig(TEST_DIR, original);

    // Load it back
    const loaded = loadFederationConfig(TEST_DIR);
    expect(loaded.vault_id).toBe('persistent-id');
    expect(loaded.vault_name).toBe('Saved Vault');
  });

  it('addSubscription adds a subscription with enabled=true', () => {
    const config = makeConfig();
    const updated = addSubscription(config, {
      url: 'https://example.com/feed.json',
      name: 'Example Vault',
      trust_discount: 0.7,
    });

    expect(updated.subscriptions).toHaveLength(1);
    expect(updated.subscriptions[0].enabled).toBe(true);
    expect(updated.subscriptions[0].url).toBe('https://example.com/feed.json');
    expect(updated.subscriptions[0].name).toBe('Example Vault');
    expect(updated.subscriptions[0].trust_discount).toBe(0.7);
  });

  it('getSubscription finds by URL', () => {
    const config = makeConfig({
      subscriptions: [
        { url: 'https://a.com/feed.json', name: 'A', trust_discount: 0.5, enabled: true },
        { url: 'https://b.com/feed.json', name: 'B', trust_discount: 0.5, enabled: true },
      ],
    });

    const sub = getSubscription(config, 'https://b.com/feed.json');
    expect(sub).toBeDefined();
    expect(sub!.name).toBe('B');
  });

  it('getSubscription finds by name', () => {
    const config = makeConfig({
      subscriptions: [
        { url: 'https://a.com/feed.json', name: 'Alpha', trust_discount: 0.5, enabled: true },
      ],
    });

    const sub = getSubscription(config, 'Alpha');
    expect(sub).toBeDefined();
    expect(sub!.url).toBe('https://a.com/feed.json');
  });

  it('getSubscription returns undefined for non-existent', () => {
    const config = makeConfig();
    expect(getSubscription(config, 'nope')).toBeUndefined();
  });
});
