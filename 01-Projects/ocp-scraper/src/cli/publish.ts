/**
 * CLI command: ocp publish
 * Publishes vault Solution Records as a JSON Feed for federation.
 */

import { Command } from 'commander';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { VaultStore } from '../store/vault';
import { generateFeed } from '../federation/publisher';
import { loadFederationConfig, saveFederationConfig } from '../federation/config';

const BASE_DIR = process.cwd();

export const publishCommand = new Command('publish')
  .description('Publish vault records as a JSON Feed for federation')
  .option('--output <path>', 'Output file path (default: from config or feed.json)')
  .option('--name <name>', 'Vault name for feed metadata')
  .action(async (opts: { output?: string; name?: string }) => {
    // Load federation config (initializes if first time)
    const config = loadFederationConfig(BASE_DIR);

    // Apply CLI overrides
    if (opts.name) {
      config.vault_name = opts.name;
    }

    const outputPath = opts.output ?? config.publish.output_path ?? 'feed.json';
    config.publish.output_path = outputPath;
    config.publish.enabled = true;

    // Persist updated config
    saveFederationConfig(BASE_DIR, config);

    // Load all records from vault
    const vault = new VaultStore(BASE_DIR);
    const records = vault.loadAll();

    if (records.length === 0) {
      console.log('\n  No records in vault. Scrape some repos first: ocp scrape --topic <topic>\n');
      return;
    }

    // Generate JSON Feed
    const feed = generateFeed(records, config);

    // Write to output path
    const fullPath = join(BASE_DIR, outputPath);
    writeFileSync(fullPath, JSON.stringify(feed, null, 2), 'utf-8');

    // Print summary
    console.log(`\n  Published ${feed.items.length} records to ${outputPath}`);
    console.log(`  Vault: ${config.vault_name} (${config.vault_id})`);
    console.log(`  Feed version: ${feed.version}`);
    if (feed._ocp) {
      console.log(`  Published at: ${feed._ocp.published_at}`);
    }
    console.log('');
  });
