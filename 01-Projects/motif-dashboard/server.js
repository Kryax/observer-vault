#!/usr/bin/env node
/**
 * Motif Library Dashboard — Live Server
 *
 * Watches the vault motif directory, parses YAML frontmatter + markdown
 * sections, runs gap analysis, and serves the dashboard with SSE push
 * updates on file change.
 *
 * Usage:
 *   npm start                           # default vault path
 *   MOTIF_DIR=/path/to/motifs npm start # custom path
 *   npm start -- --port 3077            # custom port
 */

import { createServer } from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, extname, basename, resolve } from 'node:path';
import { watch } from 'chokidar';
import matter from 'gray-matter';

// ── CONFIG ──────────────────────────────────────────────────────────
const MOTIF_DIR = process.env.MOTIF_DIR ||
  '/mnt/zfs-host/backup/projects/observer-vault/02-Knowledge/motifs';
const META_DIR = join(MOTIF_DIR, 'meta');
const CANDIDATES_DIR = join(MOTIF_DIR, 'candidates');
const PORT = parseInt(process.env.PORT || '3077', 10);
const DEBOUNCE_MS = 300;

// ── STATE ───────────────────────────────────────────────────────────
let motifData = { motifs: [], gaps: {}, stats: {}, lastUpdated: null };
let sseClients = [];

// ── PARSER ──────────────────────────────────────────────────────────

/** Extract a markdown section by heading */
function extractSection(content, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Find the heading line
  const headingRe = new RegExp(`^##\\s+${escaped}\\s*$`, 'm');
  const headingMatch = headingRe.exec(content);
  if (!headingMatch) return '';
  const start = headingMatch.index + headingMatch[0].length;
  // Find the next ## heading
  const rest = content.slice(start);
  const nextHeading = rest.search(/\n## /);
  const section = nextHeading === -1 ? rest : rest.slice(0, nextHeading);
  return section.trim();
}

/** Parse instances from the Instances section */
function parseInstances(section) {
  if (!section) return [];
  const instances = [];
  const blocks = section.split(/^###\s+/m).filter(Boolean);
  for (const block of blocks) {
    const domain = block.match(/\*\*Domain:\*\*\s*(.+)/)?.[1]?.trim() || '';
    const expression = block.match(/\*\*Expression:\*\*\s*(.+)/)?.[1]?.trim() || '';
    const discoveryDate = block.match(/\*\*Discovery date:\*\*\s*(.+)/)?.[1]?.trim() || '';
    const source = block.match(/\*\*Source:\*\*\s*(.+)/)?.[1]?.trim() || '';
    // Normalize source to top-down / bottom-up / triangulated
    let srcNorm = 'top-down';
    if (source.startsWith('bottom-up')) srcNorm = 'bottom-up';
    else if (source.startsWith('triangulated')) srcNorm = 'triangulated';
    else if (source.startsWith('top-down')) srcNorm = 'top-down';
    if (domain) {
      instances.push({ domain, expression, discoveryDate, source: srcNorm });
    }
  }
  return instances;
}

/** Parse relationships table */
function parseRelationships(section) {
  if (!section) return [];
  const rels = [];
  const lines = section.split('\n').filter(l => l.trim().startsWith('|'));
  // Skip header rows
  for (const line of lines.slice(2)) {
    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length >= 3) {
      // First cell might be a [[link]] or plain text
      let motifRef = cells[0].replace(/\[\[|\]\]/g, '').trim();
      // Convert to kebab-case filename
      motifRef = motifRef.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const relType = cells[1].trim();
      const desc = cells[2].trim();
      rels.push({ related_motif: motifRef, type: relType, desc });
    }
  }
  return rels;
}

/** Parse a single motif file */
async function parseMotifFile(filepath) {
  try {
    const raw = await readFile(filepath, 'utf-8');
    const { data: fm, content } = matter(raw);

    // Filter: must have name, tier, primary_axis to be a motif entry
    if (fm.name == null || fm.tier == null || fm.primary_axis == null) return null;

    const filename = basename(filepath, '.md');
    const isMetaMotif = filepath.includes('/meta/');

    return {
      filename,
      name: fm.name,
      tier: Number(fm.tier),
      status: fm.status || 'draft',
      confidence: Number(fm.confidence) || 0.1,
      source: fm.source || 'top-down',
      domain_count: Number(fm.domain_count) || 0,
      created: fm.created ? String(fm.created).slice(0, 10) : null,
      updated: fm.updated ? String(fm.updated).slice(0, 10) : null,
      promoted: fm.promoted ? String(fm.promoted).slice(0, 10) : null,
      derivative_order: fm.derivative_order,
      primary_axis: fm.primary_axis,
      isMetaMotif,
      formulation: extractSection(content, 'Domain-Independent Formulation'),
      description: extractSection(content, 'Structural Description'),
      instances: parseInstances(extractSection(content, 'Instances')),
      relationships: parseRelationships(extractSection(content, 'Relationships')),
    };
  } catch (err) {
    console.error(`  [parse error] ${filepath}: ${err.message}`);
    return null;
  }
}

/** Scan all motif files in the directory tree */
async function scanAllMotifs() {
  const results = [];
  const dirs = [MOTIF_DIR];

  // Check for subdirectories
  for (const sub of [META_DIR, CANDIDATES_DIR]) {
    try {
      const s = await stat(sub);
      if (s.isDirectory()) dirs.push(sub);
    } catch {}
  }

  for (const dir of dirs) {
    const files = await readdir(dir);
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      if (file.startsWith('_')) continue; // _SCHEMA, _TEMPLATE
      if (file === 'MOTIF_INDEX.md') continue;
      const filepath = join(dir, file);
      const fstat = await stat(filepath);
      if (!fstat.isFile()) continue;
      const motif = await parseMotifFile(filepath);
      if (motif) results.push(motif);
    }
  }

  return results;
}

// ── GAP DETECTION ENGINE ────────────────────────────────────────────

function detectGaps(motifs) {
  const gaps = {
    axisOrderVoids: [],       // Empty cells in axis × derivative_order matrix
    triangulationGaps: [],    // Motifs with only one source type
    domainCoverage: [],       // Domains with sparse motif presence
    tierCandidates: [],       // Motifs near promotion thresholds
    topologyIsolates: [],     // Motifs with zero or one relationship
    axisImbalance: {},        // Per-axis counts showing imbalance
    orderDistribution: {},    // Per-order counts
    sourceDistribution: {},   // Triangulation coverage
  };

  // 1. Axis × Derivative Order matrix voids
  const axes = ['differentiate', 'integrate', 'recurse'];
  const orders = [0, 1, 2, 3];
  const axisOrderOccupied = {};
  motifs.forEach(m => {
    const dOrder = typeof m.derivative_order === 'string'
      ? parseFloat(m.derivative_order) : Number(m.derivative_order);
    const key = `${m.primary_axis}|${Math.round(dOrder)}`;
    if (!axisOrderOccupied[key]) axisOrderOccupied[key] = [];
    axisOrderOccupied[key].push(m.name);
  });

  for (const axis of axes) {
    for (const order of orders) {
      const key = `${axis}|${order}`;
      const occupants = axisOrderOccupied[key] || [];
      if (occupants.length === 0) {
        gaps.axisOrderVoids.push({
          axis, order,
          severity: order <= 2 ? 'high' : 'medium',
          note: `No motifs at ${axis}/d${order} — potential discovery target`
        });
      } else if (occupants.length === 1) {
        gaps.axisOrderVoids.push({
          axis, order,
          severity: 'low',
          note: `Single motif at ${axis}/d${order}: ${occupants[0]}`,
          occupants
        });
      }
    }
  }

  // 2. Triangulation gaps — motifs with domain_count >= 2 but only one source type
  motifs.forEach(m => {
    if (m.instances.length < 2) return; // Not enough instances to judge
    const sources = new Set(m.instances.map(i => i.source));
    if (sources.size === 1 && m.source !== 'triangulated') {
      gaps.triangulationGaps.push({
        motif: m.name,
        filename: m.filename,
        currentSource: m.source,
        domains: m.domain_count,
        severity: m.tier >= 1 ? 'high' : 'medium',
        note: `${m.name} has ${m.domain_count} domains but only ${m.source} source — triangulation needed`
      });
    }
  });

  // 3. Domain coverage — which domains appear only once
  const domainMotifCount = {};
  motifs.forEach(m => {
    m.instances.forEach(inst => {
      if (!domainMotifCount[inst.domain]) domainMotifCount[inst.domain] = [];
      domainMotifCount[inst.domain].push(m.name);
    });
  });
  Object.entries(domainMotifCount).forEach(([domain, ms]) => {
    if (ms.length === 1) {
      gaps.domainCoverage.push({
        domain, motifCount: 1,
        motifs: ms,
        severity: 'low',
        note: `Domain "${domain}" has only 1 motif — potential for cross-pollination`
      });
    }
  });

  // 4. Tier promotion candidates
  motifs.forEach(m => {
    if (m.tier === 0 && m.domain_count >= 2) {
      gaps.tierCandidates.push({
        motif: m.name, filename: m.filename,
        currentTier: 0, targetTier: 1,
        domains: m.domain_count,
        severity: 'high',
        note: `${m.name} has ${m.domain_count} domains — should auto-promote to Tier 1`
      });
    }
    if (m.tier === 1 && m.domain_count >= 3) {
      gaps.tierCandidates.push({
        motif: m.name, filename: m.filename,
        currentTier: 1, targetTier: 2,
        domains: m.domain_count,
        severity: 'high',
        note: `${m.name} has ${m.domain_count} domains — Tier 2 candidate (needs validation protocol)`
      });
    }
    // Tier 0 with 7 domains is suspicious
    if (m.tier === 0 && m.domain_count >= 4) {
      gaps.tierCandidates.push({
        motif: m.name, filename: m.filename,
        currentTier: 0, targetTier: 2,
        domains: m.domain_count,
        severity: 'critical',
        note: `${m.name} has ${m.domain_count} domains but is still Tier 0 — tier-suppressed?`
      });
    }
  });

  // 5. Topology isolates
  const relCounts = {};
  motifs.forEach(m => {
    relCounts[m.filename] = (relCounts[m.filename] || 0) + m.relationships.length;
    m.relationships.forEach(r => {
      relCounts[r.related_motif] = (relCounts[r.related_motif] || 0) + 1;
    });
  });
  motifs.forEach(m => {
    const count = relCounts[m.filename] || 0;
    if (count === 0) {
      gaps.topologyIsolates.push({
        motif: m.name, filename: m.filename,
        severity: 'medium',
        note: `${m.name} has no documented relationships — topology isolate`
      });
    }
  });

  // 6. Aggregate distributions
  const axisCounts = { differentiate: 0, integrate: 0, recurse: 0 };
  const orderCounts = { 0: 0, 1: 0, 2: 0, 3: 0 };
  const sourceCounts = { 'top-down': 0, 'bottom-up': 0, 'triangulated': 0 };
  motifs.forEach(m => {
    axisCounts[m.primary_axis] = (axisCounts[m.primary_axis] || 0) + 1;
    const dOrder = Math.round(typeof m.derivative_order === 'string'
      ? parseFloat(m.derivative_order) : Number(m.derivative_order));
    orderCounts[dOrder] = (orderCounts[dOrder] || 0) + 1;
    sourceCounts[m.source] = (sourceCounts[m.source] || 0) + 1;
  });
  gaps.axisImbalance = axisCounts;
  gaps.orderDistribution = orderCounts;
  gaps.sourceDistribution = sourceCounts;

  return gaps;
}

// ── DATA REFRESH ────────────────────────────────────────────────────

async function refreshData() {
  const t0 = Date.now();
  const motifs = await scanAllMotifs();

  // Compute stats
  const tierCounts = [0, 0, 0, 0];
  motifs.forEach(m => { tierCounts[m.tier] = (tierCounts[m.tier] || 0) + 1; });
  const allDomains = [...new Set(motifs.flatMap(m => m.instances.map(i => i.domain)))];

  // Deduplicated link count
  const linkKeys = new Set();
  motifs.forEach(m => {
    m.relationships.forEach(r => {
      const key = [m.filename, r.related_motif].sort().join('|') + '|' + r.type;
      linkKeys.add(key);
    });
  });

  const gaps = detectGaps(motifs);

  motifData = {
    motifs,
    gaps,
    stats: {
      total: motifs.length,
      tiers: tierCounts,
      domains: allDomains.length,
      domainList: allDomains.sort(),
      relationships: linkKeys.size,
      triangulated: motifs.filter(m => m.source === 'triangulated').length,
    },
    lastUpdated: new Date().toISOString(),
    parseTimeMs: Date.now() - t0,
  };

  console.log(`  [refresh] ${motifs.length} motifs, ${allDomains.length} domains, ${linkKeys.size} links, ${gaps.axisOrderVoids.length} voids — ${motifData.parseTimeMs}ms`);
  broadcast();
}

// ── SSE ─────────────────────────────────────────────────────────────

function broadcast() {
  const payload = `data: ${JSON.stringify({ type: 'update', timestamp: motifData.lastUpdated })}\n\n`;
  sseClients = sseClients.filter(res => {
    try { res.write(payload); return true; }
    catch { return false; }
  });
}

// ── HTTP SERVER ─────────────────────────────────────────────────────

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
};

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // API: full data payload
  if (url.pathname === '/api/motifs') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(motifData));
    return;
  }

  // SSE: live update stream
  if (url.pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
    sseClients.push(res);
    req.on('close', () => {
      sseClients = sseClients.filter(c => c !== res);
    });
    return;
  }

  // Static files from public/
  let filepath = url.pathname === '/' ? '/index.html' : url.pathname;
  const fullpath = join(resolve('./public'), filepath);

  try {
    const content = await readFile(fullpath);
    const ext = extname(filepath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

// ── FILE WATCHER ────────────────────────────────────────────────────

let debounceTimer = null;

function setupWatcher() {
  const watcher = watch([
    join(MOTIF_DIR, '*.md'),
    join(META_DIR, '*.md'),
    join(CANDIDATES_DIR, '*.md'),
  ], {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200 },
  });

  watcher.on('all', (event, path) => {
    console.log(`  [watch] ${event}: ${basename(path)}`);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => refreshData(), DEBOUNCE_MS);
  });

  console.log(`  [watch] Watching ${MOTIF_DIR}`);
}

// ── MAIN ────────────────────────────────────────────────────────────

async function main() {
  console.log('Motif Library Dashboard');
  console.log(`  Source: ${MOTIF_DIR}`);

  await refreshData();
  setupWatcher();

  const server = createServer(handleRequest);
  server.listen(PORT, () => {
    console.log(`  [server] http://localhost:${PORT}`);
  });
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
