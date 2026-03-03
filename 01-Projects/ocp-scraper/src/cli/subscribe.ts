/**
 * CLI command: ocp subscribe
 * Subscribes to a remote vault's JSON Feed and imports Solution Records
 * with provenance tagging and trust discounting.
 */

import { Command } from 'commander';
import {
  loadFederationConfig,
  saveFederationConfig,
  addSubscription,
  getSubscription,
} from '../federation/config';
import { fetchFeed, importRecords } from '../federation/subscriber';
import type { SubscribeResult } from '../federation/subscriber';
import { VaultStore } from '../store/vault';
import { SearchIndex } from '../store/index';

const BASE_DIR = process.cwd();
const DB_PATH = `${BASE_DIR}/.ocp/index.db`;

export const subscribeCommand = new Command('subscribe')
  .description('Subscribe to a remote vault feed and import records')
  .argument('<url>', 'Feed URL to subscribe to')
  .option('--name <name>', 'Name for this subscription')
  .option('--trust-discount <factor>', 'Trust discount factor (0.0-1.0)', '0.5')
  .option('--refresh', 'Refresh an existing subscription (re-fetch and update)')
  .action(async (url: string, opts: {
    name?: string;
    trustDiscount?: string;
    refresh?: boolean;
  }) => {
    const discount = parseFloat(opts.trustDiscount ?? '0.5');

    if (isNaN(discount) || discount < 0 || discount > 1) {
      console.error('\n  Error: --trust-discount must be a number between 0.0 and 1.0\n');
      process.exit(1);
    }

    // Load federation config
    let config = loadFederationConfig(BASE_DIR);
    let existing = getSubscription(config, url);

    if (existing && !opts.refresh) {
      console.log(`\n  Already subscribed to ${url}`);
      console.log(`  Name: ${existing.name}`);
      console.log(`  Trust discount: ${existing.trust_discount}`);
      console.log(`  Last fetched: ${existing.last_fetched ?? 'never'}`);
      console.log(`\n  Use --refresh to re-fetch and update records.\n`);
      return;
    }

    // Add new subscription if not already present
    if (!existing) {
      const name = opts.name ?? new URL(url).hostname;
      config = addSubscription(config, {
        url,
        name,
        trust_discount: discount,
      });
      existing = getSubscription(config, url)!;
      console.log(`\n  New subscription: ${name} (${url})`);
      console.log(`  Trust discount: ${discount}`);
    } else {
      console.log(`\n  Refreshing subscription: ${existing.name} (${url})`);
    }

    // Fetch the feed
    console.log('  Fetching feed...');

    let feed;
    try {
      const result = await fetchFeed(url, existing.etag);

      if (result.notModified) {
        console.log('  Feed not modified since last fetch. Nothing to import.\n');
        return;
      }

      feed = result.feed;

      // Update etag for next conditional fetch
      if (result.etag) {
        existing.etag = result.etag;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`\n  Error fetching feed: ${msg}\n`);
      process.exit(1);
    }

    if (!feed) {
      console.log('  No feed data received.\n');
      return;
    }

    // Show feed info
    if (feed._ocp) {
      console.log(`  Source vault: ${feed._ocp.vault_name} (${feed._ocp.vault_id})`);
      console.log(`  Published: ${feed._ocp.published_at}`);
    }
    console.log(`  Feed items: ${feed.items.length}`);

    // Load existing records for duplicate detection
    const vault = new VaultStore(BASE_DIR);
    const existingRecords = vault.loadAll();

    // Import with provenance and trust discounting
    const imported = importRecords(feed, existing, config, existingRecords);

    if (imported.length === 0) {
      console.log('  No new records to import (all skipped or already local).\n');

      // Still update last_fetched
      existing.last_fetched = new Date().toISOString();
      saveFederationConfig(BASE_DIR, config);
      return;
    }

    // Save to vault and index
    const index = new SearchIndex(DB_PATH);
    const result: SubscribeResult = {
      source: url,
      recordsImported: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      errors: [],
    };

    for (const { record, isUpdate } of imported) {
      try {
        vault.save(record);
        index.index(record);

        if (isUpdate) {
          result.recordsUpdated++;
        } else {
          result.recordsImported++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`${record['@id']}: ${msg}`);
      }
    }

    index.close();

    // Update subscription metadata
    existing.last_fetched = new Date().toISOString();
    saveFederationConfig(BASE_DIR, config);

    // Print summary
    console.log(`\n  Import complete:`);
    console.log(`    New records:     ${result.recordsImported}`);
    console.log(`    Updated records: ${result.recordsUpdated}`);
    if (result.errors.length > 0) {
      console.log(`    Errors:          ${result.errors.length}`);
      for (const e of result.errors) {
        console.log(`      - ${e}`);
      }
    }
    console.log('');
  });
