import { Command } from 'commander';
import { existsSync } from 'fs';
import { SearchIndex } from '../store/index';
import { TemplateStore } from '../template/store';

const BASE_DIR = process.cwd();
const DB_PATH = `${BASE_DIR}/.ocp/index.db`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pad a string to a fixed width */
function pad(s: string, width: number): string {
  return s.length >= width ? s.slice(0, width) : s + ' '.repeat(width - s.length);
}

/** Format a percentage with one decimal place */
function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return '0.0%';
  return ((numerator / denominator) * 100).toFixed(1) + '%';
}

// ---------------------------------------------------------------------------
// Command: ocp coverage
// ---------------------------------------------------------------------------

export const coverageCommand = new Command('coverage')
  .description('Coverage dashboard — template hit rate, gap density, and query statistics')
  .action(() => {
    if (!existsSync(DB_PATH)) {
      console.log('\n  Index not found. Run "ocp scrape" first to populate the index.\n');
      return;
    }

    const index = new SearchIndex(DB_PATH);

    try {
      console.log('\n  Coverage Dashboard\n');

      // ---------------------------------------------------------------------
      // 1. Template Hit Rate (ISC-Coverage-1)
      // ---------------------------------------------------------------------
      const totalRecords = index.getTotalRecordCount();
      const recordCounts = index.getRecordCountByTemplate();

      // Classified = records matched by at least one template
      let classifiedCount = 0;
      for (const count of recordCounts.values()) {
        classifiedCount += count;
      }
      // Clamp: a record can be counted under multiple templates
      const effectiveClassified = Math.min(classifiedCount, totalRecords);
      const hitRate = pct(effectiveClassified, totalRecords);

      console.log('  Template Hit Rate');
      console.log('  ' + '-'.repeat(50));
      console.log(`  Records matched by template:  ${effectiveClassified} / ${totalRecords}  (${hitRate})`);
      console.log('');

      // ---------------------------------------------------------------------
      // 2. Gap Density by Category (ISC-Coverage-2)
      // ---------------------------------------------------------------------
      const templateStore = new TemplateStore(BASE_DIR);
      const templates = templateStore.loadApproved();

      console.log('  Gap Density by Category');
      console.log('  ' + '-'.repeat(50));

      if (templates.length === 0) {
        console.log('  No approved templates. Run "ocp template propose" and "ocp template approve" first.');
        console.log('');
      } else {
        // Group templates by category and sum record counts
        const categoryMap = new Map<string, { total: number; templateCount: number; gaps: number }>();

        for (const t of templates) {
          const count = recordCounts.get(t.id) || 0;
          const existing = categoryMap.get(t.category);
          if (existing) {
            existing.total += count;
            existing.templateCount += 1;
            if (count === 0) existing.gaps += 1;
          } else {
            categoryMap.set(t.category, {
              total: count,
              templateCount: 1,
              gaps: count === 0 ? 1 : 0,
            });
          }
        }

        // Table header
        const header = `  ${pad('Category', 30)} ${pad('Records', 10)} ${pad('Templates', 11)} ${pad('Gaps', 6)} ${'Status'}`;
        console.log(header);
        console.log('  ' + '-'.repeat(header.length - 2));

        // Sort: gaps first (descending), then by record count ascending
        const sorted = [...categoryMap.entries()].sort((a, b) => {
          if (b[1].gaps !== a[1].gaps) return b[1].gaps - a[1].gaps;
          return a[1].total - b[1].total;
        });

        let totalGaps = 0;
        for (const [category, data] of sorted) {
          totalGaps += data.gaps;
          const status = data.gaps > 0 ? 'GAP' : 'OK';
          const row = `  ${pad(category, 30)} ${pad(String(data.total), 10)} ${pad(String(data.templateCount), 11)} ${pad(String(data.gaps), 6)} ${status}`;
          console.log(row);
        }

        console.log('');
        console.log(`  Total categories: ${categoryMap.size}  |  Categories with gaps: ${[...categoryMap.values()].filter(d => d.gaps > 0).length}  |  Total gap templates: ${totalGaps}`);
        console.log('');
      }

      // ---------------------------------------------------------------------
      // 3. Unclassified Records (ISC-Coverage-3)
      // ---------------------------------------------------------------------
      const unclassified = totalRecords - effectiveClassified;

      console.log('  Unclassified Records');
      console.log('  ' + '-'.repeat(50));
      console.log(`  Total records:       ${totalRecords}`);
      console.log(`  Classified:          ${effectiveClassified}`);
      console.log(`  Unclassified:        ${unclassified}  (${pct(unclassified, totalRecords)})`);
      console.log('');

      // ---------------------------------------------------------------------
      // 4. Query Statistics
      // ---------------------------------------------------------------------
      const queryStats = index.getQueryStats();

      console.log('  Query Statistics');
      console.log('  ' + '-'.repeat(50));
      console.log(`  Total queries:       ${queryStats.totalQueries}`);
      console.log(`  Zero-match queries:  ${queryStats.zeroMatchQueries}  (${pct(queryStats.zeroMatchQueries, queryStats.totalQueries)})`);
      console.log(`  Avg matches/query:   ${queryStats.avgMatchCount.toFixed(1)}`);
      console.log('');

    } finally {
      index.close();
    }
  });
