/**
 * Motif Template Generator — reads motif markdown files from the vault's
 * motif library and produces MotifTemplate objects with weighted lexical
 * indicators for use in Tier A filtering.
 *
 * Supports incremental refresh: only motifs whose source file content has
 * changed (by SHA-256 hash) are regenerated.
 *
 * Usage:
 *   import { generateTemplates, loadTemplateCache, saveTemplateCache } from './motif-template-generator.ts';
 *   const templates = await generateTemplates('/path/to/motifs');
 */

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { MotifTemplate, MotifTemplateCache } from '../types/motif-template.ts';

// ── Constants ────────────────────────────────────────────────────────

const CACHE_VERSION = 1;
const MIN_INDICATORS = 10;

/**
 * Axis values accepted in frontmatter. Anything else is treated as unknown
 * and the motif is skipped.
 */
const VALID_AXES = new Set(['differentiate', 'integrate', 'recurse']);

/**
 * Stopwords filtered from indicator extraction. Kept intentionally small —
 * we want structural vocabulary to survive.
 */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'must', 'need',
  'and', 'but', 'or', 'nor', 'not', 'no', 'so', 'yet', 'for',
  'in', 'on', 'at', 'to', 'of', 'by', 'with', 'from', 'as', 'into',
  'through', 'during', 'before', 'after', 'above', 'below', 'between',
  'out', 'off', 'up', 'down', 'over', 'under', 'about',
  'if', 'then', 'than', 'that', 'this', 'these', 'those',
  'it', 'its', 'they', 'them', 'their', 'he', 'she', 'we', 'you',
  'what', 'which', 'who', 'whom', 'where', 'when', 'how', 'why',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'some',
  'such', 'any', 'other', 'same', 'also', 'very', 'just', 'only',
  'own', 'too', 'here', 'there', 'again', 'once', 'because',
  'while', 'until', 'although', 'though', 'whether', 'either',
  'neither', 'rather', 'however', 'therefore', 'thus', 'hence',
  'i.e', 'e.g', 'etc', 'i', 'ii', 'iii',
]);

// ── Frontmatter Parsing ──────────────────────────────────────────────

interface MotifFrontmatter {
  name: string;
  tier: number;
  primary_axis: string;
  derivative_order: number;
}

/**
 * Parse YAML frontmatter from a markdown string. Handles the simple
 * key: value format used by motif files without requiring a YAML library.
 */
function parseFrontmatter(content: string): { frontmatter: Record<string, string>; body: string } {
  const frontmatter: Record<string, string> = {};

  if (!content.startsWith('---')) {
    return { frontmatter, body: content };
  }

  const endIndex = content.indexOf('\n---', 3);
  if (endIndex === -1) {
    return { frontmatter, body: content };
  }

  const fmBlock = content.slice(4, endIndex);
  const body = content.slice(endIndex + 4);

  for (const line of fmBlock.split('\n')) {
    const trimmed = line.trim();
    // Skip empty lines, comments, and array items (cssclasses etc.)
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) continue;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    let value = trimmed.slice(colonIdx + 1).trim();
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    frontmatter[key] = value;
  }

  return { frontmatter, body };
}

/**
 * Extract typed frontmatter fields from raw key-value map.
 * Returns null if required fields are missing or tier < 1.
 */
function extractMotifFrontmatter(raw: Record<string, string>): MotifFrontmatter | null {
  const name = raw['name'];
  const tierStr = raw['tier'];
  const axis = raw['primary_axis'];
  const derivStr = raw['derivative_order'];

  if (!name || !tierStr) return null;

  const tier = Number(tierStr);
  if (isNaN(tier) || tier < 1) return null;

  if (!axis || !VALID_AXES.has(axis)) return null;

  // derivative_order can be fractional (e.g., "1.5", "0-1")
  let derivativeOrder: number;
  if (derivStr && derivStr.includes('-')) {
    // Range like "0-1" or "1-2" — take the midpoint
    const parts = derivStr.split('-').map(Number);
    derivativeOrder = (parts[0]! + parts[1]!) / 2;
  } else {
    derivativeOrder = Number(derivStr) || 0;
  }

  return { name, tier, primary_axis: axis, derivative_order: derivativeOrder };
}

// ── Section Extraction ───────────────────────────────────────────────

/**
 * Extract the text content under a given markdown heading (## level).
 * Returns everything between the heading and the next ## heading.
 */
function extractSection(body: string, headingPatterns: string[]): string {
  const lines = body.split('\n');
  let capturing = false;
  const captured: string[] = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (capturing) break; // hit next section
      const heading = line.slice(3).trim().toLowerCase();
      if (headingPatterns.some(p => heading.includes(p.toLowerCase()))) {
        capturing = true;
        continue;
      }
    }
    if (capturing) {
      captured.push(line);
    }
  }

  return captured.join('\n').trim();
}

/**
 * Extract instance descriptions from the Instances section.
 * Each instance is under a ### heading with an **Expression:** field.
 */
function extractInstances(body: string): string[] {
  const section = extractSection(body, ['instances', 'known instances', 'examples']);
  if (!section) return [];

  const instances: string[] = [];
  const expressionRegex = /\*\*Expression:\*\*\s*(.+?)(?=\n\s*\n|\n\s*-\s*\*\*|\n###|$)/gs;
  let match: RegExpExecArray | null;

  while ((match = expressionRegex.exec(section)) !== null) {
    const text = match[1]!.trim();
    if (text.length > 0) {
      instances.push(text);
    }
  }

  return instances;
}

// ── Indicator Generation ─────────────────────────────────────────────

/**
 * Normalize text for indicator extraction: lowercase, collapse whitespace,
 * strip markdown formatting.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\*\*([^*]+)\*\*/g, '$1')   // bold
    .replace(/\*([^*]+)\*/g, '$1')        // italic
    .replace(/`([^`]+)`/g, '$1')          // code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/[""'']/g, '')                // smart quotes
    .replace(/[()[\]{}<>]/g, ' ')          // brackets
    .replace(/[—–]/g, ' ')                 // dashes
    .replace(/[;:,]/g, ' ')               // punctuation that splits
    .replace(/\.\s/g, ' ')                // sentence-ending dots
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract unigram terms from text, filtering stopwords and short tokens.
 */
function extractUnigrams(text: string): string[] {
  const normalized = normalizeText(text);
  return normalized
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w))
    .map(w => w.replace(/[.,'"/\\]/g, ''));
}

/**
 * Extract bigrams and trigrams from text.
 */
function extractNgrams(text: string, n: 2 | 3): string[] {
  const normalized = normalizeText(text);
  const words = normalized.split(/\s+/).filter(w => w.length >= 2);
  const ngrams: string[] = [];

  for (let i = 0; i <= words.length - n; i++) {
    const gram = words.slice(i, i + n).join(' ');
    // At least one content word (non-stopword) must be present
    const contentWords = words.slice(i, i + n).filter(w => !STOPWORDS.has(w) && w.length >= 3);
    if (contentWords.length >= Math.ceil(n / 2)) {
      ngrams.push(gram);
    }
  }

  return ngrams;
}

/**
 * Count term frequencies across all provided text sources.
 */
function countTerms(texts: string[], extractFn: (t: string) => string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const text of texts) {
    for (const term of extractFn(text)) {
      counts.set(term, (counts.get(term) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * Derive a short motif ID from the motif name.
 * Takes uppercase initials of significant words (matching existing convention).
 */
function deriveMotifId(name: string): string {
  const skipWords = new Set(['a', 'an', 'the', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'and', 'or', 'as', 'by']);
  return name
    .split(/[\s-]+/)
    .filter(w => !skipWords.has(w.toLowerCase()))
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Generate weighted lexical indicators for a single motif.
 *
 * Weighting strategy:
 *   - Motif name words/phrases: 1.0 (most distinctive)
 *   - Multi-word phrases from structural description: 0.7-0.9
 *   - Unigrams from structural description: 0.5-0.7
 *   - Terms from domain-independent formulation: 0.6-0.8
 *   - Terms from instances (when not already covered): 0.3-0.5
 *
 * Longer phrases get higher weight (more specific).
 * Terms appearing in multiple sections get a boost.
 */
function generateIndicators(
  motifName: string,
  structuralDesc: string,
  domainIndependent: string,
  instances: string[],
): Array<{ term: string; weight: number }> {
  const seen = new Map<string, number>(); // term -> weight

  function addTerm(term: string, weight: number): void {
    const clean = term.trim().toLowerCase().replace(/[.]/g, '');
    if (clean.length < 3) return;
    const existing = seen.get(clean);
    if (existing !== undefined) {
      // Keep the higher weight, with a small boost for repeated appearance
      seen.set(clean, Math.min(1.0, Math.max(existing, weight) + 0.05));
    } else {
      seen.set(clean, weight);
    }
  }

  // 1. Motif name — highest weight
  const nameNormalized = normalizeText(motifName);
  addTerm(nameNormalized, 1.0);
  // Also add individual name words
  for (const word of extractUnigrams(motifName)) {
    addTerm(word, 0.6);
  }
  // Hyphenated compound from name (e.g., "dual-speed")
  const hyphenated = motifName.toLowerCase().match(/\b[\w]+-[\w]+(?:-[\w]+)?\b/g);
  if (hyphenated) {
    for (const h of hyphenated) {
      addTerm(h, 1.0);
    }
  }

  // 2. Structural description — core indicators
  if (structuralDesc) {
    // Trigrams: highest structural weight
    const trigramCounts = countTerms([structuralDesc], t => extractNgrams(t, 3));
    for (const [gram, count] of trigramCounts) {
      if (count >= 1) {
        addTerm(gram, Math.min(0.9, 0.7 + count * 0.05));
      }
    }

    // Bigrams: high structural weight
    const bigramCounts = countTerms([structuralDesc], t => extractNgrams(t, 2));
    for (const [gram, count] of bigramCounts) {
      if (count >= 1) {
        addTerm(gram, Math.min(0.85, 0.6 + count * 0.05));
      }
    }

    // Unigrams: moderate weight, boosted by frequency
    const unigramCounts = countTerms([structuralDesc], extractUnigrams);
    for (const [word, count] of unigramCounts) {
      addTerm(word, Math.min(0.7, 0.4 + count * 0.05));
    }
  }

  // 3. Domain-independent formulation — slightly lower than structural
  if (domainIndependent) {
    for (const gram of extractNgrams(domainIndependent, 2)) {
      addTerm(gram, 0.75);
    }
    for (const word of extractUnigrams(domainIndependent)) {
      addTerm(word, 0.55);
    }
  }

  // 4. Instance terms — lowest weight, breadth signal
  if (instances.length > 0) {
    const instanceUnigrams = countTerms(instances, extractUnigrams);
    // Terms appearing in multiple instances are more indicative
    for (const [word, count] of instanceUnigrams) {
      const weight = Math.min(0.5, 0.25 + (count / instances.length) * 0.15);
      addTerm(word, weight);
    }
    // Bigrams from instances
    const instanceBigrams = countTerms(instances, t => extractNgrams(t, 2));
    for (const [gram, count] of instanceBigrams) {
      if (count >= 2) {
        addTerm(gram, Math.min(0.5, 0.35 + count * 0.03));
      }
    }
  }

  // Sort by weight descending, then alphabetically for stability
  const sorted = [...seen.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([term, weight]) => ({ term, weight: Math.round(weight * 100) / 100 }));

  return sorted;
}

// ── SHA-256 Hashing ──────────────────────────────────────────────────

async function sha256(content: string): Promise<string> {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(content);
  return hasher.digest('hex');
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Generate a MotifTemplate from a single motif markdown file.
 * Returns null if the file is not a Tier 1+ motif or lacks required fields.
 */
export async function generateTemplateFromFile(
  filePath: string,
): Promise<MotifTemplate | null> {
  const content = await Bun.file(filePath).text();
  const { frontmatter, body } = parseFrontmatter(content);

  const fm = extractMotifFrontmatter(frontmatter);
  if (!fm) return null;

  const structuralDesc = extractSection(body, [
    'structural description',
    'structure',
    'description',
    'domain-independent formulation',
  ]);

  const domainIndependent = extractSection(body, [
    'domain-independent formulation',
    'domain independent',
  ]);

  const instances = extractInstances(body);

  const indicators = generateIndicators(
    fm.name,
    structuralDesc,
    domainIndependent,
    instances,
  );

  const contentHash = await sha256(content);

  return {
    motifId: deriveMotifId(fm.name),
    motifName: fm.name,
    tier: fm.tier,
    axis: fm.primary_axis as MotifTemplate['axis'],
    derivativeOrder: fm.derivative_order,
    indicators,
    structuralDescription: structuralDesc,
    instances,
    sourceFile: filePath,
    generatedAt: new Date().toISOString(),
    contentHash,
  };
}

/**
 * Generate templates for all Tier 1+ motifs in a directory.
 *
 * @param motifsDir - Absolute path to the motifs directory
 * @param existingCache - Optional existing cache for incremental refresh
 * @returns Array of MotifTemplate for all Tier 1+ motifs
 */
export async function generateTemplates(
  motifsDir: string,
  existingCache?: MotifTemplateCache,
): Promise<MotifTemplate[]> {
  const entries = await readdir(motifsDir);
  const mdFiles = entries
    .filter(f => f.endsWith('.md') && !f.startsWith('_') && !f.startsWith('.'))
    .map(f => join(motifsDir, f));

  // Build hash index from existing cache for incremental refresh
  const cacheIndex = new Map<string, MotifTemplate>();
  if (existingCache) {
    for (const t of existingCache.templates) {
      cacheIndex.set(t.sourceFile, t);
    }
  }

  const templates: MotifTemplate[] = [];

  for (const filePath of mdFiles) {
    // Check if we can skip this file (incremental refresh)
    if (cacheIndex.size > 0) {
      const cached = cacheIndex.get(filePath);
      if (cached) {
        const content = await Bun.file(filePath).text();
        const currentHash = await sha256(content);
        if (currentHash === cached.contentHash) {
          // File unchanged — reuse cached template
          templates.push(cached);
          continue;
        }
      }
    }

    const template = await generateTemplateFromFile(filePath);
    if (template) {
      templates.push(template);
    }
  }

  return templates;
}

/**
 * Load a MotifTemplateCache from a JSON file.
 * Returns null if the file doesn't exist or is invalid.
 */
export async function loadTemplateCache(
  cachePath: string,
): Promise<MotifTemplateCache | null> {
  const file = Bun.file(cachePath);
  if (!(await file.exists())) return null;

  try {
    const data = await file.json() as unknown;
    if (
      typeof data === 'object' && data !== null &&
      'version' in data && 'templates' in data &&
      Array.isArray((data as MotifTemplateCache).templates)
    ) {
      return data as MotifTemplateCache;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Save a MotifTemplateCache to a JSON file.
 */
export async function saveTemplateCache(
  cachePath: string,
  templates: MotifTemplate[],
): Promise<void> {
  const cache: MotifTemplateCache = {
    version: CACHE_VERSION,
    generatedAt: new Date().toISOString(),
    templates,
  };

  await Bun.write(cachePath, JSON.stringify(cache, null, 2));
}

/**
 * Full refresh-or-rebuild workflow:
 * 1. Load existing cache (if any)
 * 2. Generate templates incrementally
 * 3. Save updated cache
 *
 * @param motifsDir - Absolute path to motifs directory
 * @param cachePath - Absolute path to cache JSON file
 * @returns Generated templates
 */
export async function refreshTemplates(
  motifsDir: string,
  cachePath: string,
): Promise<MotifTemplate[]> {
  const existing = await loadTemplateCache(cachePath);
  const templates = await generateTemplates(motifsDir, existing ?? undefined);
  await saveTemplateCache(cachePath, templates);
  return templates;
}
