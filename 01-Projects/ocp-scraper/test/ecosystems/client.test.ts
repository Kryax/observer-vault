/**
 * Ecosyste.ms client tests — TDD Red phase.
 * Tests: registry mapping, single fetch, batch fetch, graceful failure.
 */
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { EcosystemsClient, type EcosystemsPackage } from '../../src/ecosystems/client';

// ---------------------------------------------------------------------------
// Registry inference
// ---------------------------------------------------------------------------

describe('EcosystemsClient.inferRegistry', () => {
  test('package.json maps to npmjs.org', () => {
    expect(EcosystemsClient.inferRegistry('package.json')).toBe('npmjs.org');
  });

  test('requirements.txt maps to pypi.org', () => {
    expect(EcosystemsClient.inferRegistry('requirements.txt')).toBe('pypi.org');
  });

  test('setup.py maps to pypi.org', () => {
    expect(EcosystemsClient.inferRegistry('setup.py')).toBe('pypi.org');
  });

  test('pyproject.toml maps to pypi.org', () => {
    expect(EcosystemsClient.inferRegistry('pyproject.toml')).toBe('pypi.org');
  });

  test('Cargo.toml maps to crates.io', () => {
    expect(EcosystemsClient.inferRegistry('Cargo.toml')).toBe('crates.io');
  });

  test('Gemfile maps to rubygems.org', () => {
    expect(EcosystemsClient.inferRegistry('Gemfile')).toBe('rubygems.org');
  });

  test('go.mod maps to proxy.golang.org', () => {
    expect(EcosystemsClient.inferRegistry('go.mod')).toBe('proxy.golang.org');
  });

  test('mix.exs maps to hex.pm', () => {
    expect(EcosystemsClient.inferRegistry('mix.exs')).toBe('hex.pm');
  });

  test('unknown manifest returns null', () => {
    expect(EcosystemsClient.inferRegistry('Makefile')).toBeNull();
  });

  test('ecosystem shorthand works (npm -> npmjs.org)', () => {
    expect(EcosystemsClient.inferRegistry('npm')).toBe('npmjs.org');
  });

  test('ecosystem shorthand works (pypi -> pypi.org)', () => {
    expect(EcosystemsClient.inferRegistry('pypi')).toBe('pypi.org');
  });

  test('ecosystem shorthand works (cargo -> crates.io)', () => {
    expect(EcosystemsClient.inferRegistry('cargo')).toBe('crates.io');
  });
});

// ---------------------------------------------------------------------------
// Client fetch (mocked)
// ---------------------------------------------------------------------------

const MOCK_PACKAGE: EcosystemsPackage = {
  name: 'express',
  ecosystem: 'npm',
  description: 'Fast, unopinionated, minimalist web framework for Node.js',
  downloads: 50_000_000,
  downloads_period: 'last-month',
  dependent_packages_count: 75_000,
  dependent_repos_count: 2_500_000,
  latest_release_number: '4.21.0',
  latest_stable_release_number: '4.21.0',
  repository_url: 'https://github.com/expressjs/express',
  homepage: 'https://expressjs.com',
  licenses: 'MIT',
  maintainers_count: 12,
  first_release_published_at: '2010-12-29T00:00:00Z',
  latest_release_published_at: '2024-10-01T00:00:00Z',
  keywords: ['web', 'framework', 'http', 'rest', 'api'],
  status: 'active',
};

describe('EcosystemsClient.getPackage', () => {
  let client: EcosystemsClient;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    client = new EcosystemsClient();
  });

  test('returns package data on 200', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify(MOCK_PACKAGE), { status: 200 })),
    ) as any;

    const result = await client.getPackage('npm', 'express');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('express');
    expect(result!.downloads).toBe(50_000_000);
    expect(result!.dependent_packages_count).toBe(75_000);

    globalThis.fetch = originalFetch;
  });

  test('returns null on 404', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response('Not Found', { status: 404 })),
    ) as any;

    const result = await client.getPackage('npm', 'nonexistent-pkg-xyz');
    expect(result).toBeNull();

    globalThis.fetch = originalFetch;
  });

  test('returns null on network error (graceful failure)', async () => {
    globalThis.fetch = mock(() =>
      Promise.reject(new Error('Network unreachable')),
    ) as any;

    const result = await client.getPackage('npm', 'express');
    expect(result).toBeNull();

    globalThis.fetch = originalFetch;
  });

  test('constructs correct URL with registry mapping', async () => {
    let capturedUrl = '';
    globalThis.fetch = mock((url: string) => {
      capturedUrl = url;
      return Promise.resolve(new Response(JSON.stringify(MOCK_PACKAGE), { status: 200 }));
    }) as any;

    await client.getPackage('npm', 'express');
    expect(capturedUrl).toBe(
      'https://packages.ecosyste.ms/api/v1/registries/npmjs.org/packages/express',
    );

    globalThis.fetch = originalFetch;
  });

  test('URL-encodes scoped package names', async () => {
    let capturedUrl = '';
    globalThis.fetch = mock((url: string) => {
      capturedUrl = url;
      return Promise.resolve(new Response(JSON.stringify(MOCK_PACKAGE), { status: 200 }));
    }) as any;

    await client.getPackage('npm', '@types/node');
    expect(capturedUrl).toContain(encodeURIComponent('@types/node'));

    globalThis.fetch = originalFetch;
  });
});

// ---------------------------------------------------------------------------
// Batch fetch
// ---------------------------------------------------------------------------

describe('EcosystemsClient.batchFetch', () => {
  let client: EcosystemsClient;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    client = new EcosystemsClient({ batchDelay: 0 }); // no delay in tests
  });

  test('categorizes found and not-found packages', async () => {
    let callCount = 0;
    globalThis.fetch = mock(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(
          new Response(JSON.stringify({ ...MOCK_PACKAGE, name: 'express' }), { status: 200 }),
        );
      }
      return Promise.resolve(new Response('Not Found', { status: 404 }));
    }) as any;

    const result = await client.batchFetch('npm', ['express', 'nonexistent-pkg']);
    expect(result.found.size).toBe(1);
    expect(result.found.has('express')).toBe(true);
    expect(result.notFound).toContain('nonexistent-pkg');
    expect(result.errors.length).toBe(0);

    globalThis.fetch = originalFetch;
  });

  test('respects limit parameter', async () => {
    let fetchCount = 0;
    globalThis.fetch = mock(() => {
      fetchCount++;
      return Promise.resolve(
        new Response(JSON.stringify(MOCK_PACKAGE), { status: 200 }),
      );
    }) as any;

    await client.batchFetch('npm', ['a', 'b', 'c', 'd', 'e'], 2);
    expect(fetchCount).toBe(2);

    globalThis.fetch = originalFetch;
  });

  test('records errors without crashing', async () => {
    globalThis.fetch = mock(() =>
      Promise.reject(new Error('Connection refused')),
    ) as any;

    const result = await client.batchFetch('npm', ['express']);
    expect(result.found.size).toBe(0);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toContain('express');

    globalThis.fetch = originalFetch;
  });
});
