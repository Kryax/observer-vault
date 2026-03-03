import { parse as parseTOML } from 'smol-toml';
import type { DependencyRef } from '../types/solution-record';

/**
 * Dependency Analyzer
 * Parses package manifests from 4 formats:
 * - package.json (Node.js/JavaScript)
 * - Cargo.toml (Rust)
 * - go.mod (Go)
 * - pyproject.toml (Python)
 * Returns normalized DependencyRef arrays.
 */

/** Supported manifest file names */
export const MANIFEST_FILES = [
  'package.json',
  'Cargo.toml',
  'go.mod',
  'pyproject.toml',
] as const;

export type ManifestType = typeof MANIFEST_FILES[number];

/**
 * Detect which manifest type a filename represents.
 */
export function detectManifestType(filename: string): ManifestType | null {
  const base = filename.split('/').pop() || filename;
  if (MANIFEST_FILES.includes(base as ManifestType)) return base as ManifestType;
  return null;
}

/**
 * Parse package.json dependencies.
 */
export function parsePackageJson(content: string): DependencyRef[] {
  const deps: DependencyRef[] = [];

  try {
    const pkg = JSON.parse(content);

    // Runtime dependencies
    if (pkg.dependencies && typeof pkg.dependencies === 'object') {
      for (const [name, version] of Object.entries(pkg.dependencies)) {
        deps.push({
          name,
          version: String(version),
          type: 'runtime',
          uri: `https://www.npmjs.com/package/${name}`,
        });
      }
    }

    // Dev dependencies
    if (pkg.devDependencies && typeof pkg.devDependencies === 'object') {
      for (const [name, version] of Object.entries(pkg.devDependencies)) {
        deps.push({
          name,
          version: String(version),
          type: 'dev',
          uri: `https://www.npmjs.com/package/${name}`,
        });
      }
    }

    // Peer dependencies
    if (pkg.peerDependencies && typeof pkg.peerDependencies === 'object') {
      for (const [name, version] of Object.entries(pkg.peerDependencies)) {
        deps.push({
          name,
          version: String(version),
          type: 'peer',
          uri: `https://www.npmjs.com/package/${name}`,
        });
      }
    }

    // Optional dependencies
    if (pkg.optionalDependencies && typeof pkg.optionalDependencies === 'object') {
      for (const [name, version] of Object.entries(pkg.optionalDependencies)) {
        deps.push({
          name,
          version: String(version),
          type: 'optional',
          uri: `https://www.npmjs.com/package/${name}`,
        });
      }
    }
  } catch {
    // Invalid JSON — return empty
  }

  return deps;
}

/**
 * Parse Cargo.toml dependencies.
 */
export function parseCargoToml(content: string): DependencyRef[] {
  const deps: DependencyRef[] = [];

  try {
    const cargo = parseTOML(content) as Record<string, unknown>;

    // [dependencies]
    const runtimeDeps = cargo.dependencies as Record<string, unknown> | undefined;
    if (runtimeDeps && typeof runtimeDeps === 'object') {
      for (const [name, value] of Object.entries(runtimeDeps)) {
        const version = typeof value === 'string' ? value :
          (value && typeof value === 'object' && 'version' in value) ? String((value as Record<string, unknown>).version) : undefined;
        const optional = value && typeof value === 'object' && (value as Record<string, unknown>).optional === true;
        deps.push({
          name,
          version,
          type: optional ? 'optional' : 'runtime',
          uri: `https://crates.io/crates/${name}`,
        });
      }
    }

    // [dev-dependencies]
    const devDeps = (cargo['dev-dependencies'] || cargo.dev_dependencies) as Record<string, unknown> | undefined;
    if (devDeps && typeof devDeps === 'object') {
      for (const [name, value] of Object.entries(devDeps)) {
        const version = typeof value === 'string' ? value :
          (value && typeof value === 'object' && 'version' in value) ? String((value as Record<string, unknown>).version) : undefined;
        deps.push({
          name,
          version,
          type: 'dev',
          uri: `https://crates.io/crates/${name}`,
        });
      }
    }

    // [build-dependencies]
    const buildDeps = (cargo['build-dependencies'] || cargo.build_dependencies) as Record<string, unknown> | undefined;
    if (buildDeps && typeof buildDeps === 'object') {
      for (const [name, value] of Object.entries(buildDeps)) {
        const version = typeof value === 'string' ? value :
          (value && typeof value === 'object' && 'version' in value) ? String((value as Record<string, unknown>).version) : undefined;
        deps.push({
          name,
          version,
          type: 'dev',
          uri: `https://crates.io/crates/${name}`,
        });
      }
    }
  } catch {
    // Invalid TOML — return empty
  }

  return deps;
}

/**
 * Parse go.mod dependencies.
 */
export function parseGoMod(content: string): DependencyRef[] {
  const deps: DependencyRef[] = [];
  const lines = content.split('\n');
  let inRequireBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Single-line require
    const singleMatch = trimmed.match(/^require\s+(\S+)\s+(\S+)/);
    if (singleMatch) {
      deps.push({
        name: singleMatch[1],
        version: singleMatch[2],
        type: 'runtime',
        uri: `https://pkg.go.dev/${singleMatch[1]}`,
      });
      continue;
    }

    // Block require start
    if (trimmed === 'require (') {
      inRequireBlock = true;
      continue;
    }

    // Block require end
    if (inRequireBlock && trimmed === ')') {
      inRequireBlock = false;
      continue;
    }

    // Inside require block
    if (inRequireBlock) {
      // Skip comments and indirect markers
      const depMatch = trimmed.match(/^(\S+)\s+(\S+)/);
      if (depMatch) {
        const isIndirect = trimmed.includes('// indirect');
        deps.push({
          name: depMatch[1],
          version: depMatch[2],
          type: isIndirect ? 'optional' : 'runtime',
          uri: `https://pkg.go.dev/${depMatch[1]}`,
        });
      }
    }
  }

  return deps;
}

/**
 * Parse pyproject.toml dependencies.
 */
export function parsePyprojectToml(content: string): DependencyRef[] {
  const deps: DependencyRef[] = [];

  try {
    const pyproject = parseTOML(content) as Record<string, unknown>;
    const project = pyproject.project as Record<string, unknown> | undefined;

    // [project.dependencies]
    if (project?.dependencies && Array.isArray(project.dependencies)) {
      for (const dep of project.dependencies) {
        const depStr = String(dep);
        // Parse PEP 508 dependency specifier: name[extras]>=version
        const match = depStr.match(/^([a-zA-Z0-9_.-]+)(?:\[.*?\])?\s*(.*)?$/);
        if (match) {
          deps.push({
            name: match[1],
            version: match[2]?.trim() || undefined,
            type: 'runtime',
            uri: `https://pypi.org/project/${match[1]}/`,
          });
        }
      }
    }

    // [project.optional-dependencies]
    const optDeps = project?.['optional-dependencies'] as Record<string, unknown[]> | undefined;
    if (optDeps && typeof optDeps === 'object') {
      for (const [_group, groupDeps] of Object.entries(optDeps)) {
        if (Array.isArray(groupDeps)) {
          for (const dep of groupDeps) {
            const depStr = String(dep);
            const match = depStr.match(/^([a-zA-Z0-9_.-]+)(?:\[.*?\])?\s*(.*)?$/);
            if (match) {
              deps.push({
                name: match[1],
                version: match[2]?.trim() || undefined,
                type: 'optional',
                uri: `https://pypi.org/project/${match[1]}/`,
              });
            }
          }
        }
      }
    }

    // Also check [tool.poetry.dependencies] for Poetry projects
    const tool = pyproject.tool as Record<string, unknown> | undefined;
    const poetry = tool?.poetry as Record<string, unknown> | undefined;
    if (poetry?.dependencies && typeof poetry.dependencies === 'object') {
      for (const [name, value] of Object.entries(poetry.dependencies as Record<string, unknown>)) {
        if (name === 'python') continue; // Skip python version constraint
        const version = typeof value === 'string' ? value :
          (value && typeof value === 'object' && 'version' in value) ? String((value as Record<string, unknown>).version) : undefined;
        const optional = value && typeof value === 'object' && (value as Record<string, unknown>).optional === true;
        deps.push({
          name,
          version,
          type: optional ? 'optional' : 'runtime',
          uri: `https://pypi.org/project/${name}/`,
        });
      }
    }

    // [tool.poetry.dev-dependencies]
    if (poetry?.['dev-dependencies'] && typeof poetry['dev-dependencies'] === 'object') {
      for (const [name, value] of Object.entries(poetry['dev-dependencies'] as Record<string, unknown>)) {
        const version = typeof value === 'string' ? value :
          (value && typeof value === 'object' && 'version' in value) ? String((value as Record<string, unknown>).version) : undefined;
        deps.push({
          name,
          version,
          type: 'dev',
          uri: `https://pypi.org/project/${name}/`,
        });
      }
    }
  } catch {
    // Invalid TOML — return empty
  }

  return deps;
}

/**
 * Parse any supported manifest file.
 */
export function parseDependencies(filename: string, content: string): DependencyRef[] {
  const type = detectManifestType(filename);
  switch (type) {
    case 'package.json': return parsePackageJson(content);
    case 'Cargo.toml': return parseCargoToml(content);
    case 'go.mod': return parseGoMod(content);
    case 'pyproject.toml': return parsePyprojectToml(content);
    default: return [];
  }
}
