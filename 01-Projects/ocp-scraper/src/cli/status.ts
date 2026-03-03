import { Command } from 'commander';
import { existsSync } from 'fs';
import { SearchIndex } from '../store/index';
import { VaultStore } from '../store/vault';

const BASE_DIR = process.cwd();
const DB_PATH = `${BASE_DIR}/.ocp/index.db`;

export const statusCommand = new Command('status')
  .description('Show index statistics and vault status')
  .action(() => {
    console.log('\n📊 OCP Scraper Status\n');

    // Vault stats
    const vault = new VaultStore(BASE_DIR);
    const vaultStats = vault.getStats();
    console.log(`  📁 Vault Records: ${vaultStats.totalRecords}`);
    if (Object.keys(vaultStats.domains).length > 0) {
      console.log('     Domains:');
      for (const [domain, count] of Object.entries(vaultStats.domains).sort((a, b) => b[1] - a[1])) {
        console.log(`       ${domain}: ${count}`);
      }
    }

    // Index stats
    if (!existsSync(DB_PATH)) {
      console.log('\n  🗃️  Index: not initialized (run "ocp scrape" first)\n');
      return;
    }

    const index = new SearchIndex(DB_PATH);
    try {
      const stats = index.getStats();
      console.log(`\n  🗃️  Index Records: ${stats.totalRecords}`);
      console.log(`  🔗 Graph Edges: ${stats.totalEdges}`);

      if (Object.keys(stats.domains).length > 0) {
        console.log('     Domains:');
        for (const [domain, count] of Object.entries(stats.domains).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
          console.log(`       ${domain}: ${count}`);
        }
      }

      if (Object.keys(stats.languages).length > 0) {
        console.log('     Languages:');
        for (const [lang, count] of Object.entries(stats.languages).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
          console.log(`       ${lang}: ${count}`);
        }
      }
    } finally {
      index.close();
    }

    console.log('');
  });
