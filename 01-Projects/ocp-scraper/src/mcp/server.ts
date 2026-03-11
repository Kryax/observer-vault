#!/usr/bin/env bun
/**
 * OCP Scraper MCP Server — Exposes OCP index, search, scrape, and analysis
 * tools to Claude Code via the Model Context Protocol (stdio transport).
 *
 * Reuses existing modules: store/index, store/vault, template/store, cli/gaps.
 * No logic duplication — this is a thin MCP wrapper.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod/v4';

import { SearchIndex } from '../store/index';
import { VaultStore } from '../store/vault';
import { TemplateStore } from '../template/store';
import { clusterQueries } from '../cli/gaps';

// Forge adapters for scrape
import { GitHubAdapter } from '../forge/github';
import { ForgejoAdapter } from '../forge/forgejo';
import { ArxivAdapter } from '../forge/arxiv';
import { SepAdapter } from '../forge/sep';
import { coarseFilter } from '../filter/coarse';
import { fineFilter } from '../filter/fine';
import { extractMetadata } from '../extract/metadata';
import { parseReadme } from '../extract/readme';
import { parseDependencies, MANIFEST_FILES } from '../extract/dependencies';
import { assembleSolutionRecord } from '../record/assembler';
import { assembleArxivSolutionRecord } from '../record/arxiv';
import { assembleSepSolutionRecord } from '../record/sep';
import { enrichGraph } from '../search/enrichment';

import type { ForgeAdapter } from '../types/forge';
import type { DependencyRef } from '../types/solution-record';

import { readFileSync, existsSync } from 'fs';

// ---------------------------------------------------------------------------
// Paths — resolve relative to this file's project root
// ---------------------------------------------------------------------------

const BASE_DIR = new URL('../../', import.meta.url).pathname.replace(/\/$/, '');
const DB_PATH = `${BASE_DIR}/.ocp/index.db`;

// ---------------------------------------------------------------------------
// GITHUB_TOKEN — load from file if not in environment
// ---------------------------------------------------------------------------

if (!process.env.GITHUB_TOKEN) {
  const tokenFile = process.env.GITHUB_TOKEN_FILE || `${process.env.HOME}/.github_token`;
  if (existsSync(tokenFile)) {
    process.env.GITHUB_TOKEN = readFileSync(tokenFile, 'utf-8').trim();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Open SearchIndex, returning null if DB doesn't exist */
function openIndex(): SearchIndex | null {
  try {
    return new SearchIndex(DB_PATH);
  } catch {
    return null;
  }
}

/** Percentage helper */
function pct(num: number, den: number): string {
  if (den === 0) return '0.0%';
  return ((num / den) * 100).toFixed(1) + '%';
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: 'ocp-scraper',
  version: '0.1.0',
});

// ─── ocp_search ──────────────────────────────────────────────────────────────

server.registerTool(
  'ocp_search',
  {
    title: 'OCP Search',
    description: 'Search the OCP Solution Record index by problem description. Returns ranked results with trust scores.',
    inputSchema: z.object({
      query: z.string().describe('Search query (problem description, keywords, or technology)'),
      limit: z.number().optional().default(10).describe('Maximum results to return (default 10)'),
    }),
  },
  async ({ query, limit }) => {
    const index = openIndex();
    if (!index) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Index not found. Run "ocp scrape" first.' }) }],
        isError: true,
      };
    }

    try {
      const results = index.search(query, limit);
      index.logQuery(query, results.length);

      if (results.length === 0) {
        index.logZeroMatch(query);
      }

      // For top result, include related records
      let related: Array<{ id: string; title: string; edgeType: string; trustScore: number }> = [];
      if (results.length > 0) {
        related = index.getRelatedRecords(results[0].id, 3).map(r => ({
          id: r.id,
          title: r.title,
          edgeType: r.edge_type,
          trustScore: r.trust_score,
        }));
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            query,
            totalResults: results.length,
            results: results.map(r => ({
              id: r.id,
              title: r.title,
              description: r.description,
              problemStatement: r.problemStatement,
              domains: r.domains,
              language: r.language,
              implType: r.implType,
              stars: r.stars,
              trustScore: r.trustScore,
              confidence: r.confidence,
              sourceUrl: r.sourceUrl,
              license: r.license,
            })),
            relatedToTopResult: related,
          }, null, 2),
        }],
      };
    } finally {
      index.close();
    }
  },
);

// ─── ocp_scrape ──────────────────────────────────────────────────────────────

server.registerTool(
  'ocp_scrape',
  {
    title: 'OCP Scrape',
    description: 'Scrape repositories by topic from a forge (GitHub, Codeberg, Forgejo) and create Solution Records.',
    inputSchema: z.object({
      topic: z.string().describe('Topic to search for'),
      source: z.enum(['github', 'codeberg', 'forgejo', 'arxiv', 'sep']).optional().default('github').describe('Forge source'),
      limit: z.number().optional().default(10).describe('Maximum repos to scrape'),
      minStars: z.number().optional().default(10).describe('Minimum stars filter'),
      forgeUrl: z.string().optional().describe('Base URL for self-hosted Forgejo instances'),
      keyword: z.string().optional().describe('arXiv keyword query'),
      author: z.string().optional().describe('arXiv author query'),
      dateFrom: z.string().optional().describe('arXiv lower date bound (YYYY-MM-DD or YYYYMMDD)'),
      dateTo: z.string().optional().describe('arXiv upper date bound (YYYY-MM-DD or YYYYMMDD)'),
    }),
  },
  async ({ topic, source, limit, minStars, forgeUrl, keyword, author, dateFrom, dateTo }) => {
    // Initialize forge adapter
    let forge: ForgeAdapter;
    try {
      if (source === 'github') {
        forge = new GitHubAdapter();
      } else if (source === 'codeberg') {
        forge = new ForgejoAdapter();
      } else if (source === 'forgejo') {
        if (!forgeUrl) {
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: '--forgeUrl is required when using source=forgejo' }) }],
            isError: true,
          };
        }
        forge = new ForgejoAdapter({ baseUrl: forgeUrl });
      } else if (source === 'arxiv') {
        forge = new ArxivAdapter();
      } else if (source === 'sep') {
        forge = new SepAdapter();
      } else {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: `Unknown source: ${source}` }) }],
          isError: true,
        };
      }
    } catch (e) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error: 'GITHUB_TOKEN not set. Export it first.' }) }],
        isError: true,
      };
    }

    const vault = new VaultStore(BASE_DIR);
    const index = new SearchIndex(DB_PATH);

    try {
      const searchResult = await forge.searchRepos({
        topic: source === 'arxiv'
          ? buildArxivTopicQuery(topic, keyword, author, dateFrom, dateTo)
          : topic,
        limit: limit * 2,
        minStars,
      });

      let processed = 0;
      let indexed = 0;
      let filtered = 0;
      let errors = 0;
      const records: Array<{ id: string; title: string; stars: number; trustScore: number }> = [];
      const errorDetails: Array<{ repo: string; error: string }> = [];

      for (const repo of searchResult.repos) {
        if (indexed >= limit) break;
        processed++;

        try {
          if (source === 'arxiv') {
            const arxiv = forge as ArxivAdapter;
            const paper = await arxiv.getPaper('arxiv', repo.id);
            const record = assembleArxivSolutionRecord(paper, {
              generatedBy: 'ocp-scraper/arxiv-adapter',
            });

            vault.save(record);
            index.index(record);
            indexed++;

            records.push({
              id: record['@id'],
              title: record.meta.title,
              stars: 0,
              trustScore: record.trust.trustScore || 0,
            });
            continue;
          }

          if (source === 'sep') {
            const sep = forge as SepAdapter;
            const entry = await sep.getEntry('sep', repo.id);
            const record = assembleSepSolutionRecord({
              slug: entry.slug,
              title: entry.title,
              preamble: entry.preamble,
              authors: entry.authors,
              relatedEntries: entry.relatedEntries,
              publishedAt: entry.publishedAt,
              revisedAt: entry.revisedAt,
              firstSectionTitle: entry.firstSectionTitle,
              firstSectionText: entry.firstSectionText,
              bibliographyCount: entry.bibliographyCount,
              bibliographyEntries: entry.bibliographyEntries,
              entryUrl: repo.url,
            }, {
              generatedBy: 'ocp-scraper/sep-adapter',
            });

            vault.save(record);
            index.index(record);
            indexed++;

            records.push({
              id: record['@id'],
              title: record.meta.title,
              stars: 0,
              trustScore: record.trust.trustScore || 0,
            });
            continue;
          }

          const coarseResult = coarseFilter(repo);
          if (!coarseResult.passed) {
            filtered++;
            continue;
          }

          const [owner, repoName] = repo.fullName.split('/');
          const readmeContent = await forge.getReadme(owner, repoName);

          if (readmeContent) {
            const fineResult = fineFilter(readmeContent.content);
            if (!fineResult.passed) {
              filtered++;
              continue;
            }
          }

          const contributorsCount = await forge.getContributorsCount(owner, repoName);
          const metadata = extractMetadata(repo, contributorsCount);
          const parsedReadme = readmeContent ? parseReadme(readmeContent.content) : null;

          const deps: DependencyRef[] = [];
          for (const manifest of MANIFEST_FILES) {
            try {
              const file = await forge.getFile(owner, repoName, manifest);
              if (file) {
                const parsed = parseDependencies(manifest, file.content);
                deps.push(...parsed);
              }
            } catch { /* manifest not found — normal */ }
          }

          const record = assembleSolutionRecord({
            metadata,
            readme: parsedReadme,
            dependencies: deps,
            contributorsCount,
            forgeName: forge.name,
          });

          vault.save(record);
          index.index(record);
          indexed++;

          records.push({
            id: record['@id'],
            title: record.meta.title,
            stars: repo.stars,
            trustScore: record.trust.trustScore || 0,
          });
        } catch (err) {
          errors++;
          errorDetails.push({
            repo: repo.fullName,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      // Enrich graph
      let graphEnrichment = { domainEdges: 0, portEdges: 0 };
      if (indexed > 0) {
        graphEnrichment = enrichGraph(index, BASE_DIR);
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            topic,
            source,
            summary: { processed, indexed, filtered, errors },
            graphEnrichment,
            records,
            errors: errorDetails.length > 0 ? errorDetails : undefined,
          }, null, 2),
        }],
      };
    } finally {
      index.close();
    }
  },
);

function buildArxivTopicQuery(
  topic: string,
  keyword?: string,
  author?: string,
  dateFrom?: string,
  dateTo?: string,
): string {
  const parts = [`category:${topic}`];
  if (keyword) parts.push(`keyword:${keyword}`);
  if (author) parts.push(`author:${author}`);
  if (dateFrom) parts.push(`from:${dateFrom}`);
  if (dateTo) parts.push(`to:${dateTo}`);
  return parts.join('; ');
}

// ─── ocp_status ──────────────────────────────────────────────────────────────

server.registerTool(
  'ocp_status',
  {
    title: 'OCP Status',
    description: 'Get OCP index statistics: record counts, domains, languages, graph edges.',
    inputSchema: z.object({}),
  },
  async () => {
    const vault = new VaultStore(BASE_DIR);
    const vaultStats = vault.getStats();

    const index = openIndex();
    if (!index) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            vault: vaultStats,
            index: null,
            message: 'Index not initialized. Run ocp_scrape first.',
          }, null, 2),
        }],
      };
    }

    try {
      const indexStats = index.getStats();
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            vault: vaultStats,
            index: indexStats,
          }, null, 2),
        }],
      };
    } finally {
      index.close();
    }
  },
);

// ─── ocp_gaps ────────────────────────────────────────────────────────────────

server.registerTool(
  'ocp_gaps',
  {
    title: 'OCP Gaps',
    description: 'Negative space analysis — show what is MISSING from the knowledge index: zero-match query clusters, template coverage gaps, classification summary.',
    inputSchema: z.object({
      since: z.string().optional().describe('Only show queries since date (ISO 8601)'),
    }),
  },
  async ({ since }) => {
    const index = openIndex();
    if (!index) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Index not found. Run ocp_scrape first.' }) }],
        isError: true,
      };
    }

    try {
      // Zero-match clusters
      const zeroQueries = index.getZeroMatchQueries(since);
      const clusters = clusterQueries(
        zeroQueries.map(q => ({ query: q.query, timestamp: q.timestamp })),
      );

      // Template coverage
      const templateStore = new TemplateStore(BASE_DIR);
      const templates = templateStore.loadApproved();
      const recordCounts = index.getRecordCountByTemplate();

      const templateCoverage = templates.map(t => ({
        id: t.id,
        category: t.category,
        recordCount: recordCounts.get(t.id) || 0,
        isGap: (recordCounts.get(t.id) || 0) === 0,
      }));

      // Classification summary
      const totalRecords = index.getTotalRecordCount();
      let classifiedCount = 0;
      for (const count of recordCounts.values()) {
        classifiedCount += count;
      }
      const unclassified = totalRecords - classifiedCount;

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            zeroMatchClusters: {
              totalQueries: zeroQueries.length,
              clusters: clusters.map(c => ({
                keywords: c.keywords,
                queryCount: c.queries.length,
                queries: c.queries,
              })),
            },
            templateCoverage,
            classification: {
              totalRecords,
              classified: classifiedCount,
              unclassified,
              unclassifiedPct: pct(unclassified, totalRecords),
            },
          }, null, 2),
        }],
      };
    } finally {
      index.close();
    }
  },
);

// ─── ocp_coverage ────────────────────────────────────────────────────────────

server.registerTool(
  'ocp_coverage',
  {
    title: 'OCP Coverage',
    description: 'Coverage dashboard — template hit rate, gap density by category, unclassified records, and query statistics.',
    inputSchema: z.object({}),
  },
  async () => {
    const index = openIndex();
    if (!index) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Index not found. Run ocp_scrape first.' }) }],
        isError: true,
      };
    }

    try {
      const totalRecords = index.getTotalRecordCount();
      const recordCounts = index.getRecordCountByTemplate();

      let classifiedCount = 0;
      for (const count of recordCounts.values()) {
        classifiedCount += count;
      }
      const effectiveClassified = Math.min(classifiedCount, totalRecords);
      const unclassified = totalRecords - effectiveClassified;

      // Gap density by category
      const templateStore = new TemplateStore(BASE_DIR);
      const templates = templateStore.loadApproved();

      const categoryMap = new Map<string, { records: number; templates: number; gaps: number }>();
      for (const t of templates) {
        const count = recordCounts.get(t.id) || 0;
        const existing = categoryMap.get(t.category);
        if (existing) {
          existing.records += count;
          existing.templates += 1;
          if (count === 0) existing.gaps += 1;
        } else {
          categoryMap.set(t.category, {
            records: count,
            templates: 1,
            gaps: count === 0 ? 1 : 0,
          });
        }
      }

      // Query statistics
      const queryStats = index.getQueryStats();

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            templateHitRate: {
              matched: effectiveClassified,
              total: totalRecords,
              rate: pct(effectiveClassified, totalRecords),
            },
            gapDensity: Object.fromEntries(
              [...categoryMap.entries()].sort((a, b) => b[1].gaps - a[1].gaps),
            ),
            unclassified: {
              total: totalRecords,
              classified: effectiveClassified,
              unclassified,
              rate: pct(unclassified, totalRecords),
            },
            queryStats: {
              totalQueries: queryStats.totalQueries,
              zeroMatchQueries: queryStats.zeroMatchQueries,
              zeroMatchRate: pct(queryStats.zeroMatchQueries, queryStats.totalQueries),
              avgMatchCount: Math.round(queryStats.avgMatchCount * 10) / 10,
            },
          }, null, 2),
        }],
      };
    } finally {
      index.close();
    }
  },
);

// ─── ocp_inspect ─────────────────────────────────────────────────────────────

server.registerTool(
  'ocp_inspect',
  {
    title: 'OCP Inspect',
    description: 'Inspect a specific Solution Record by its ID. Returns the full JSON-LD record.',
    inputSchema: z.object({
      recordId: z.string().describe('Record ID (e.g., ocp:github/owner--repo)'),
    }),
  },
  async ({ recordId }) => {
    // Try index first, fall back to vault
    const index = openIndex();
    let record = index?.getRecord(recordId) ?? null;
    index?.close();

    if (!record) {
      const vault = new VaultStore(BASE_DIR);
      record = vault.load(recordId);
    }

    if (!record) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error: `Record not found: ${recordId}` }) }],
        isError: true,
      };
    }

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(record, null, 2),
      }],
    };
  },
);

// ─── ocp_template_list ───────────────────────────────────────────────────────

server.registerTool(
  'ocp_template_list',
  {
    title: 'OCP Template List',
    description: 'List all approved problem templates in the OCP knowledge base.',
    inputSchema: z.object({}),
  },
  async () => {
    const templateStore = new TemplateStore(BASE_DIR);
    const templates = templateStore.loadApproved();

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          count: templates.length,
          templates: templates.map(t => ({
            id: t.id,
            name: t.name,
            category: t.category,
            description: t.description,
            cynefinDomain: t.cynefinDomain,
            version: t.version,
            status: t.status,
          })),
        }, null, 2),
      }],
    };
  },
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('OCP Scraper MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
