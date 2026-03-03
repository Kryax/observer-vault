import { Command } from 'commander';
import { createInterface } from 'readline';
import { SearchIndex } from '../store/index';

const BASE_DIR = process.cwd();
const DB_PATH = `${BASE_DIR}/.ocp/index.db`;

/**
 * Prompt the user for validation feedback via readline.
 * Returns the raw user input string, or null if cancelled (Ctrl+C / 'q').
 */
function promptValidation(): Promise<string | null> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.on('close', () => {
      // Ctrl+C or stream closed — skip validation
      resolve(null);
    });

    rl.question('  Did any result solve your problem? Enter result # or \'n\': ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export const searchCommand = new Command('search')
  .description('Search the local Solution Record index')
  .argument('<query>', 'Search query')
  .option('--limit <number>', 'Maximum results', '10')
  .option('--no-validate', 'Skip interactive validation prompt')
  .action(async (query: string, opts) => {
    const limit = parseInt(opts.limit, 10);
    const index = new SearchIndex(DB_PATH);

    try {
      const results = index.search(query, limit);

      // Log ALL queries with match count (Phase 2c feedback loop)
      index.logQuery(query, results.length);

      if (results.length === 0) {
        console.log(`\n  No results found for: "${query}"`);
        console.log('   Try broader terms or run "ocp scrape" to populate the index.\n');
        index.logZeroMatch(query);
        return;
      }

      console.log(`\n  Search results for: "${query}" (${results.length} matches)\n`);

      for (const [i, result] of results.entries()) {
        const domains = result.domains.filter(d => !d.startsWith('lang:')).join(', ');
        console.log(`  ${i + 1}. ${result.title}`);
        console.log(`     ${result.problemStatement?.slice(0, 100)}${(result.problemStatement?.length || 0) > 100 ? '...' : ''}`);
        console.log(`     Stars: ${result.stars} | Trust: ${result.trustScore.toFixed(3)} (${result.confidence}) | ${result.language || 'n/a'} | ${domains}`);
        console.log(`     ${result.sourceUrl}`);
        console.log(`     ID: ${result.id}\n`);

        // Show related records for the top result only
        if (i === 0) {
          const related = index.getRelatedRecords(result.id, 3);
          if (related.length > 0) {
            console.log('     Related Records:');
            for (const rel of related) {
              console.log(`        -> ${rel.title} (${rel.edge_type}) Trust: ${rel.weight.toFixed(3)}`);
            }
            console.log('');
          }
        }
      }

      // Validation prompt (ISC-Valid-1)
      if (opts.validate) {
        const answer = await promptValidation();

        if (answer === null || answer.toLowerCase() === 'q') {
          // User cancelled — skip validation logging
          return;
        }

        const num = parseInt(answer, 10);
        if (!isNaN(num) && num >= 1 && num <= results.length) {
          index.logValidation(query, results[num - 1].id, true);
          console.log(`  Logged: result #${num} solved the problem.\n`);
        } else {
          // 'n', empty string, or any non-numeric input = negative validation on top result
          index.logValidation(query, results[0].id, false);
          console.log('  Logged: no result solved the problem.\n');
        }
      }
    } finally {
      index.close();
    }
  });
