import { Command } from 'commander';
import { existsSync } from 'fs';
import { SearchIndex } from '../store/index';
import { TemplateStore } from '../template/store';

const BASE_DIR = process.cwd();
const DB_PATH = `${BASE_DIR}/.ocp/index.db`;

// ---------------------------------------------------------------------------
// Jaccard Similarity Clustering
// ---------------------------------------------------------------------------

/** Tokenize a query into lowercase words, stripping punctuation. */
function tokenize(query: string): Set<string> {
  return new Set(
    query
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 1)
  );
}

/** Jaccard similarity between two token sets. */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

interface QueryEntry {
  query: string;
  timestamp: string;
  tokens: Set<string>;
}

export interface Cluster {
  keywords: string[];
  queries: { query: string; timestamp: string }[];
}

/**
 * Cluster zero-match queries by word overlap using single-linkage clustering.
 * Threshold controls minimum Jaccard similarity to merge into a cluster.
 */
export function clusterQueries(
  queries: { query: string; timestamp: string }[],
  threshold: number = 0.3
): Cluster[] {
  if (queries.length === 0) return [];

  const entries: QueryEntry[] = queries.map(q => ({
    query: q.query,
    timestamp: q.timestamp,
    tokens: tokenize(q.query),
  }));

  // Greedy single-pass clustering: assign each query to the first cluster
  // it shares sufficient overlap with, or create a new cluster.
  const clusters: { entries: QueryEntry[] }[] = [];

  for (const entry of entries) {
    let assigned = false;

    for (const cluster of clusters) {
      // Check similarity against any member of the cluster (single-linkage)
      for (const member of cluster.entries) {
        if (jaccardSimilarity(entry.tokens, member.tokens) >= threshold) {
          cluster.entries.push(entry);
          assigned = true;
          break;
        }
      }
      if (assigned) break;
    }

    if (!assigned) {
      clusters.push({ entries: [entry] });
    }
  }

  // Convert internal cluster format to output format
  return clusters
    .map(cluster => {
      // Compute representative keywords: tokens that appear in >50% of cluster queries
      const tokenFreq = new Map<string, number>();
      for (const entry of cluster.entries) {
        for (const token of entry.tokens) {
          tokenFreq.set(token, (tokenFreq.get(token) || 0) + 1);
        }
      }

      const halfCount = cluster.entries.length / 2;
      const keywords = [...tokenFreq.entries()]
        .filter(([, count]) => count > halfCount)
        .sort((a, b) => b[1] - a[1])
        .map(([token]) => token);

      // Fallback: if no keyword passes 50%, take the top 3 by frequency
      const effectiveKeywords = keywords.length > 0
        ? keywords.slice(0, 5)
        : [...tokenFreq.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([token]) => token);

      return {
        keywords: effectiveKeywords,
        queries: cluster.entries
          .map(e => ({ query: e.query, timestamp: e.timestamp }))
          .sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
      };
    })
    .sort((a, b) => b.queries.length - a.queries.length);
}

// ---------------------------------------------------------------------------
// Command: ocp gaps
// ---------------------------------------------------------------------------

export const gapsCommand = new Command('gaps')
  .description('Negative space analysis — show what is MISSING from the knowledge index')
  .option('--since <date>', 'Only show queries since date (ISO 8601)')
  .action((opts) => {
    if (!existsSync(DB_PATH)) {
      console.log('\n  Index not found. Run "ocp scrape" first to populate the index.\n');
      return;
    }

    const index = new SearchIndex(DB_PATH);

    try {
      console.log('\n\u{1F4CA} Knowledge Gap Analysis\n');

      // -----------------------------------------------------------------------
      // 1. Zero-match query clusters (ISC-NegSpace-2)
      // -----------------------------------------------------------------------
      const zeroQueries = index.getZeroMatchQueries(opts.since);

      if (zeroQueries.length === 0) {
        console.log('\u{1F50D} Zero-Match Query Clusters: none recorded');
        if (opts.since) {
          console.log(`   (filtered to queries since ${opts.since})`);
        }
        console.log('   Queries that return no results are logged automatically during search.\n');
      } else {
        const clusters = clusterQueries(
          zeroQueries.map(q => ({ query: q.query, timestamp: q.timestamp }))
        );

        console.log(`\u{1F50D} Zero-Match Query Clusters (${zeroQueries.length} unique queries):\n`);

        for (const [i, cluster] of clusters.entries()) {
          console.log(`  Cluster ${i + 1}: "${cluster.keywords.join(', ')}" (${cluster.queries.length} queries)`);
          for (const q of cluster.queries) {
            const date = q.timestamp.split('T')[0] || q.timestamp.slice(0, 10);
            console.log(`    - "${q.query}" (${date})`);
          }
          console.log('');
        }
      }

      // -----------------------------------------------------------------------
      // 2. Template coverage (ISC-NegSpace-3)
      // -----------------------------------------------------------------------
      const templateStore = new TemplateStore(BASE_DIR);
      const templates = templateStore.loadApproved();
      const recordCounts = index.getRecordCountByTemplate();

      console.log('\u{1F4CB} Template Coverage:\n');

      if (templates.length === 0) {
        console.log('  No approved templates found. Run "ocp template propose" and "ocp template approve" first.\n');
      } else {
        let gapCount = 0;
        const sortedTemplates = [...templates].sort((a, b) => {
          const aCount = recordCounts.get(a.id) || 0;
          const bCount = recordCounts.get(b.id) || 0;
          // Gaps first, then by count descending
          if (aCount === 0 && bCount > 0) return -1;
          if (aCount > 0 && bCount === 0) return 1;
          return bCount - aCount;
        });

        for (const template of sortedTemplates) {
          const count = recordCounts.get(template.id) || 0;
          if (count === 0) {
            gapCount++;
            console.log(`  \u274C ${template.category} \u2014 0 records (GAP)`);
          } else {
            console.log(`  \u2705 ${template.category} \u2014 ${count} records`);
          }
        }

        console.log('');
        if (gapCount > 0) {
          console.log(`  ${gapCount} template(s) with no matching records.\n`);
        }
      }

      // -----------------------------------------------------------------------
      // 3. Classification summary (ISC-NegSpace-4)
      // -----------------------------------------------------------------------
      const totalRecords = index.getTotalRecordCount();
      let classifiedCount = 0;
      for (const count of recordCounts.values()) {
        classifiedCount += count;
      }
      const unclassified = totalRecords - classifiedCount;
      const unclassifiedPct = totalRecords > 0
        ? ((unclassified / totalRecords) * 100).toFixed(1)
        : '0.0';

      console.log('\u{1F4C8} Classification Summary:');
      console.log(`  Total records: ${totalRecords}`);
      console.log(`  Classified: ${classifiedCount}`);
      console.log(`  Unclassified: ${unclassified} (${unclassifiedPct}%)`);
      console.log('');
    } finally {
      index.close();
    }
  });
