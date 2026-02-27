/**
 * Observer Governance Plugin -- Priming Document Generator
 *
 * Regenerates VAULT_PRIMING.md -- a condensed context document that Atlas
 * reads at session start to understand the vault's current state.
 *
 * PRD Section 7: Priming Refresh
 */

import { App, TFile, TFolder } from 'obsidian';
import type { Status } from './schema';
import { SCHEMA } from './schema';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PrimingResult {
  canonicalCount: number;
  projectCount: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OUTPUT_PATH = '01-Projects/observer-council/VAULT_PRIMING.md';
const OUTPUT_DIR = '01-Projects/observer-council';
const PROJECTS_ROOT = '01-Projects';
const FOUNDATIONAL_PRINCIPLES_PATH = '02-Knowledge/FOUNDATIONAL_PRINCIPLES.md';
const RECENT_CANONICAL_LIMIT = 10;
const HOT_MOTIF_THRESHOLD = 3;
const HOT_MOTIF_DAYS = 30;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface DocMeta {
  file: TFile;
  title: string;
  status: Status | undefined;
  motifs: string[];
  modified: number;
}

/**
 * Extract metadata from a file's cached frontmatter.
 */
function extractMeta(app: App, file: TFile): DocMeta {
  const fm = app.metadataCache.getFileCache(file)?.frontmatter;
  return {
    file,
    title: fm?.title ?? file.basename,
    status: fm?.status as Status | undefined,
    motifs: Array.isArray(fm?.motifs) ? fm.motifs : [],
    modified: file.stat.mtime,
  };
}

/**
 * Format an epoch timestamp as YYYY-MM-DD.
 */
function fmtDate(epoch: number): string {
  return new Date(epoch).toISOString().slice(0, 10);
}

/**
 * Format the current instant as an ISO 8601 string (no millis).
 */
function nowISO(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

function buildActiveProjects(
  docs: DocMeta[],
  projectFolders: string[],
): string {
  const lines: string[] = ['## Active Projects', ''];

  if (projectFolders.length === 0) {
    lines.push('_No project folders found._', '');
    return lines.join('\n');
  }

  for (const folder of projectFolders.sort()) {
    const folderPrefix = `${PROJECTS_ROOT}/${folder}/`;
    const canonicalInProject = docs
      .filter(
        (d) =>
          d.status === 'canonical' &&
          d.file.path.startsWith(folderPrefix),
      )
      .sort((a, b) => b.modified - a.modified);

    const recent = canonicalInProject[0];
    if (recent) {
      lines.push(
        `- **${folder}** -- latest canonical: "${recent.title}" (${fmtDate(recent.modified)})`,
      );
    } else {
      lines.push(`- **${folder}** -- no canonical documents yet`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

function buildRecentCanonical(docs: DocMeta[]): string {
  const canonical = docs
    .filter((d) => d.status === 'canonical')
    .sort((a, b) => b.modified - a.modified)
    .slice(0, RECENT_CANONICAL_LIMIT);

  const lines: string[] = ['## Recent Canonical Promotions', ''];

  if (canonical.length === 0) {
    lines.push('_No canonical documents found._', '');
    return lines.join('\n');
  }

  for (const doc of canonical) {
    lines.push(`- "${doc.title}" -- ${fmtDate(doc.modified)}`);
  }

  lines.push('');
  return lines.join('\n');
}

function buildHotMotifs(docs: DocMeta[]): string {
  const cutoff = Date.now() - HOT_MOTIF_DAYS * 24 * 60 * 60 * 1000;
  const recentDocs = docs.filter((d) => d.modified >= cutoff);

  // Count documents per motif (not occurrences -- documents containing it)
  const motifDocCount = new Map<string, number>();
  for (const doc of recentDocs) {
    const seen = new Set<string>();
    for (const m of doc.motifs) {
      if (!seen.has(m)) {
        seen.add(m);
        motifDocCount.set(m, (motifDocCount.get(m) ?? 0) + 1);
      }
    }
  }

  // Filter to threshold and sort descending by count
  const hot = [...motifDocCount.entries()]
    .filter(([, count]) => count >= HOT_MOTIF_THRESHOLD)
    .sort((a, b) => b[1] - a[1]);

  const lines: string[] = ['## Hot Motifs', ''];

  if (hot.length === 0) {
    lines.push(
      `_No motifs appear in ${HOT_MOTIF_THRESHOLD}+ documents from the last ${HOT_MOTIF_DAYS} days._`,
      '',
    );
    return lines.join('\n');
  }

  for (const [motif, count] of hot) {
    lines.push(`- **${motif}** -- ${count} documents`);
  }

  lines.push('');
  return lines.join('\n');
}

function buildFoundationalPrinciples(): string {
  const lines: string[] = [
    '## Foundational Principles',
    '',
    `See [[${FOUNDATIONAL_PRINCIPLES_PATH}]] for the full document.`,
    '',
  ];
  return lines.join('\n');
}

function buildVaultStatistics(docs: DocMeta[]): string {
  const counts: Record<string, number> = {};
  for (const s of SCHEMA.enums.status) {
    counts[s] = 0;
  }
  let unknownCount = 0;

  for (const doc of docs) {
    if (doc.status && doc.status in counts) {
      counts[doc.status]++;
    } else {
      unknownCount++;
    }
  }

  const lastActivity =
    docs.length > 0
      ? fmtDate(Math.max(...docs.map((d) => d.modified)))
      : 'n/a';

  const lines: string[] = [
    '## Vault Statistics',
    '',
    `| Status | Count |`,
    `|--------|-------|`,
  ];

  for (const s of SCHEMA.enums.status) {
    lines.push(`| ${s} | ${counts[s]} |`);
  }
  if (unknownCount > 0) {
    lines.push(`| _(no status)_ | ${unknownCount} |`);
  }
  lines.push(`| **Total** | **${docs.length}** |`);
  lines.push('');
  lines.push(`Last activity: ${lastActivity}`);
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Frontmatter builder
// ---------------------------------------------------------------------------

function buildFrontmatter(existingCreated: string | null): string {
  const now = nowISO();
  const created = existingCreated ?? now;

  return [
    '---',
    'meta_version: 1',
    'kind: priming',
    'status: canonical',
    'authority: high',
    'domain: [vault, governance]',
    'source: vault_synthesis',
    `created: ${created}`,
    `modified: ${now}`,
    'cssclasses: [status-canonical]',
    '---',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Scan the vault and regenerate VAULT_PRIMING.md.
 *
 * Returns counts used by the audit log entry (PRD 5.2 priming_refresh).
 */
export async function refreshPriming(app: App): Promise<PrimingResult> {
  // ---- Collect all markdown files and their metadata -----------------------
  const allFiles = app.vault.getMarkdownFiles();
  const docs: DocMeta[] = allFiles.map((f) => extractMeta(app, f));

  // ---- Discover project folders --------------------------------------------
  const projectsFolder = app.vault.getAbstractFileByPath(PROJECTS_ROOT);
  const projectFolders: string[] = [];
  if (projectsFolder instanceof TFolder) {
    for (const child of projectsFolder.children) {
      if (child instanceof TFolder) {
        projectFolders.push(child.name);
      }
    }
  }

  // ---- Check for existing priming doc (preserve created date) --------------
  let existingCreated: string | null = null;
  const existingFile = app.vault.getAbstractFileByPath(OUTPUT_PATH);
  if (existingFile instanceof TFile) {
    const existingFm =
      app.metadataCache.getFileCache(existingFile)?.frontmatter;
    if (existingFm?.created) {
      existingCreated = String(existingFm.created);
    }
  }

  // ---- Assemble document ---------------------------------------------------
  const sections: string[] = [
    buildFrontmatter(existingCreated),
    '',
    '# Vault Priming Document',
    '',
    '_Auto-generated by Observer Governance Plugin. Do not edit manually._',
    '',
    buildActiveProjects(docs, projectFolders),
    buildRecentCanonical(docs),
    buildHotMotifs(docs),
    buildFoundationalPrinciples(),
    buildVaultStatistics(docs),
  ];

  const content = sections.join('\n');

  // ---- Ensure output directory exists --------------------------------------
  const dirExists = await app.vault.adapter.exists(OUTPUT_DIR);
  if (!dirExists) {
    await app.vault.createFolder(OUTPUT_DIR);
  }

  // ---- Write or update the file --------------------------------------------
  if (existingFile instanceof TFile) {
    await app.vault.modify(existingFile, content);
  } else {
    await app.vault.create(OUTPUT_PATH, content);
  }

  // ---- Build result --------------------------------------------------------
  const canonicalCount = docs.filter((d) => d.status === 'canonical').length;
  const projectCount = projectFolders.length;

  return { canonicalCount, projectCount };
}
