/**
 * Motif Library Reader — parses motif .md files from the vault.
 *
 * Extracts YAML frontmatter to produce MotifFrontmatter objects
 * for use by the promotion governance engine.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import type { MotifFrontmatter } from './types.ts';
import { INDICATOR_SETS } from '../filter/indicator-sets.ts';

/**
 * Build a name→abbreviation lookup from INDICATOR_SETS.
 * Names are normalised to lowercase for case-insensitive matching.
 */
const NAME_TO_ABBREVIATION: Map<string, string> = new Map(
  INDICATOR_SETS.map(s => [s.motifName.toLowerCase(), s.motifId]),
);

/**
 * Parse YAML frontmatter from a markdown file.
 * Minimal parser — handles the subset of YAML used in motif files.
 */
function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match?.[1]) return {};

  const result: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    // Skip empty lines, comments, and array items (cssclasses etc.)
    if (!line.trim() || line.trim().startsWith('#') || line.trim().startsWith('-')) continue;
    const colonIdx = line.indexOf(':');
    if (colonIdx < 0) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

/**
 * Read all motif frontmatter from the library directory.
 * Skips files starting with _ (schema, template) and the meta/ subdirectory.
 */
export function readMotifLibrary(libraryPath: string): MotifFrontmatter[] {
  const motifs: MotifFrontmatter[] = [];
  const entries = readdirSync(libraryPath, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.md')) continue;
    if (entry.name.startsWith('_')) continue;
    if (entry.name === 'MOTIF_INDEX.md') continue;

    const filePath = join(libraryPath, entry.name);
    const content = readFileSync(filePath, 'utf-8');
    const fm = parseFrontmatter(content);

    if (!fm['name'] || fm['tier'] === undefined) continue;

    const abbreviation = NAME_TO_ABBREVIATION.get(fm['name'].toLowerCase());

    motifs.push({
      name: fm['name'],
      tier: parseInt(fm['tier'], 10),
      status: fm['status'] ?? 'draft',
      confidence: parseFloat(fm['confidence'] ?? '0.1'),
      source: fm['source'] ?? 'bottom-up',
      domain_count: parseInt(fm['domain_count'] ?? '1', 10),
      created: fm['created'] ?? '',
      updated: fm['updated'] ?? '',
      promoted: fm['promoted'],
      promotion_justification: fm['promotion_justification'],
      derivative_order: fm['derivative_order'] ?? '0',
      primary_axis: (fm['primary_axis'] ?? 'differentiate') as MotifFrontmatter['primary_axis'],
      fileName: entry.name,
      abbreviation,
    });
  }

  return motifs;
}

/**
 * Generate a motif ID from the filename (kebab-case without .md extension).
 */
export function motifIdFromFileName(fileName: string): string {
  return basename(fileName, '.md');
}
