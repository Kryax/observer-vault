/**
 * Ecosyste.ms API client -- supplemental package metadata.
 * Used to enrich Solution Records with download counts,
 * dependent package counts, and ecosystem data.
 *
 * This is SUPPLEMENTARY data -- it adds to, never replaces,
 * the primary metadata from the forge adapter (GitHub/Codeberg).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Ecosyste.ms package metadata (subset we care about) */
export interface EcosystemsPackage {
  name: string;
  ecosystem: string; // 'npm', 'pypi', etc.
  description?: string;
  downloads: number;
  downloads_period?: string;
  dependent_packages_count: number;
  dependent_repos_count: number;
  latest_release_number?: string;
  latest_stable_release_number?: string;
  repository_url?: string;
  homepage?: string;
  licenses?: string;
  maintainers_count?: number;
  first_release_published_at?: string;
  latest_release_published_at?: string;
  keywords?: string[];
  status?: string;
}

/** Batch result */
export interface EcosystemsBatchResult {
  found: Map<string, EcosystemsPackage>;
  notFound: string[];
  errors: string[];
}

/** Client configuration */
export interface EcosystemsClientOptions {
  baseUrl?: string;
  batchDelay?: number; // ms between batch requests
}

// ---------------------------------------------------------------------------
// Registry mapping
// ---------------------------------------------------------------------------

/** Ecosystem shorthand -> ecosyste.ms registry name */
const ECOSYSTEM_MAP: Record<string, string> = {
  npm: 'npmjs.org',
  pypi: 'pypi.org',
  cargo: 'crates.io',
  gem: 'rubygems.org',
  go: 'proxy.golang.org',
  hex: 'hex.pm',
  nuget: 'nuget.org',
  maven: 'repo1.maven.org',
};

/** Manifest filename -> ecosyste.ms registry name */
const MANIFEST_MAP: Record<string, string> = {
  'package.json': 'npmjs.org',
  'package-lock.json': 'npmjs.org',
  'yarn.lock': 'npmjs.org',
  'bun.lockb': 'npmjs.org',
  'requirements.txt': 'pypi.org',
  'setup.py': 'pypi.org',
  'setup.cfg': 'pypi.org',
  'pyproject.toml': 'pypi.org',
  'Pipfile': 'pypi.org',
  'Cargo.toml': 'crates.io',
  'Cargo.lock': 'crates.io',
  'Gemfile': 'rubygems.org',
  'Gemfile.lock': 'rubygems.org',
  'go.mod': 'proxy.golang.org',
  'go.sum': 'proxy.golang.org',
  'mix.exs': 'hex.pm',
  'mix.lock': 'hex.pm',
};

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class EcosystemsClient {
  private baseUrl: string;
  private batchDelay: number;

  constructor(options?: EcosystemsClientOptions) {
    this.baseUrl = options?.baseUrl ?? 'https://packages.ecosyste.ms/api/v1';
    this.batchDelay = options?.batchDelay ?? 100;
  }

  /**
   * Fetch a single package's metadata.
   * Returns null on 404 or network error (graceful failure).
   */
  async getPackage(ecosystem: string, name: string): Promise<EcosystemsPackage | null> {
    try {
      return await this.fetchPackageOrThrow(ecosystem, name);
    } catch {
      // Network error, timeout, etc. -- graceful failure
      return null;
    }
  }

  /**
   * Internal: fetch a package, returning null on 404 but THROWING on network errors.
   * This lets batchFetch distinguish "not found" from "network failure".
   */
  private async fetchPackageOrThrow(
    ecosystem: string,
    name: string,
  ): Promise<EcosystemsPackage | null> {
    const registry = EcosystemsClient.resolveRegistry(ecosystem);
    const encodedName = encodeURIComponent(name);
    const url = `${this.baseUrl}/registries/${registry}/packages/${encodedName}`;

    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as EcosystemsPackage;
  }

  /**
   * Batch fetch packages by ecosystem.
   * Fetches up to `limit` packages, with delays between requests.
   */
  async batchFetch(
    ecosystem: string,
    names: string[],
    limit?: number,
  ): Promise<EcosystemsBatchResult> {
    const found = new Map<string, EcosystemsPackage>();
    const notFound: string[] = [];
    const errors: string[] = [];

    const toFetch = limit ? names.slice(0, limit) : names;

    for (let i = 0; i < toFetch.length; i++) {
      const name = toFetch[i];

      try {
        const pkg = await this.fetchPackageOrThrow(ecosystem, name);
        if (pkg) {
          found.set(name, pkg);
        } else {
          notFound.push(name);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${name}: ${msg}`);
      }

      // Rate-limit delay between requests (skip after last)
      if (this.batchDelay > 0 && i < toFetch.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, this.batchDelay));
      }
    }

    return { found, notFound, errors };
  }

  /**
   * Infer the ecosyste.ms registry name from a manifest file or ecosystem shorthand.
   * Returns null if no mapping is found.
   */
  static inferRegistry(input: string): string | null {
    // Check ecosystem shorthand first (npm, pypi, cargo, etc.)
    if (ECOSYSTEM_MAP[input]) {
      return ECOSYSTEM_MAP[input];
    }

    // Check manifest filename
    if (MANIFEST_MAP[input]) {
      return MANIFEST_MAP[input];
    }

    return null;
  }

  /**
   * Resolve an ecosystem name or shorthand to the ecosyste.ms registry name.
   * Falls back to the input if no mapping is found (pass-through for
   * already-correct registry names like 'npmjs.org').
   */
  private static resolveRegistry(ecosystem: string): string {
    return ECOSYSTEM_MAP[ecosystem] ?? ecosystem;
  }
}
