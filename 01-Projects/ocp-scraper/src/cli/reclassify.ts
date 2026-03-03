import { Command } from 'commander';
import { TemplateStore } from '../template/store';
import { VaultStore } from '../store/vault';
import { SearchIndex } from '../store/index';
import { matchTemplate } from '../template/matcher';
import type { RepoMetadata } from '../extract/metadata';
import type { SolutionRecord, DependencyRef } from '../types/solution-record';

const BASE_DIR = process.cwd();
const DB_PATH = `${BASE_DIR}/.ocp/index.db`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Synthesize a full RepoMetadata from a SolutionRecord for template matching.
 * The matcher expects RepoMetadata input; we fill defaults for unavailable fields.
 */
function recordToMatchInput(record: SolutionRecord): RepoMetadata {
  const starsEvidence = record.validation.evidence.find(e => e.type === 'github-stars');
  const forksEvidence = record.validation.evidence.find(e => e.type === 'github-forks');
  const sourceUrl = record.implementation.refs.find(r => r.type === 'repository')?.uri || '';
  const fullName = record['@id'].replace(/^ocp:github\//, '').replace(/--/g, '/');

  return {
    id: record['@id'],
    name: record.meta.title,
    fullName,
    description: record.meta.description || '',
    url: sourceUrl,
    homepage: null,
    stars: parseInt(starsEvidence?.description?.match(/(\d+)/)?.[1] || '0'),
    forks: parseInt(forksEvidence?.description?.match(/(\d+)/)?.[1] || '0'),
    watchers: 0,
    openIssues: 0,
    contributorsCount: 0,
    size: 0,
    language: typeof record.implementation.language === 'string'
      ? record.implementation.language
      : Array.isArray(record.implementation.language)
        ? record.implementation.language[0] || null
        : null,
    languages: {},
    topics: record.meta.keywords || [],
    license: record.meta.license || null,
    createdAt: record.meta.dateCreated,
    updatedAt: record.meta.dateModified,
    pushedAt: record.meta.dateModified,
    ageInDays: 0,
    daysSinceLastPush: 0,
    isArchived: false,
    isFork: false,
    defaultBranch: 'main',
  };
}

/**
 * Extract dependency names from a SolutionRecord.
 */
function extractDependencies(record: SolutionRecord): DependencyRef[] {
  return record.composability?.dependencies || [];
}

// ---------------------------------------------------------------------------
// Command: ocp reclassify
// ---------------------------------------------------------------------------

export const reclassifyCommand = new Command('reclassify')
  .description('Re-run template matching on all existing records')
  .option('--dry-run', 'Show matches without updating records')
  .action(async (opts) => {
    const templateStore = new TemplateStore(BASE_DIR);
    const vault = new VaultStore(BASE_DIR);

    // 1. Load all approved templates
    const templates = templateStore.loadApproved();

    if (templates.length === 0) {
      console.log('\n  No approved templates found. Approve some templates first.');
      console.log('  Use `ocp template list --status pending` to see proposals.');
      console.log('  Use `ocp template approve <id>` to approve.\n');
      return;
    }

    console.log(`\n  Reclassifying records against ${templates.length} approved template(s)...`);
    if (opts.dryRun) {
      console.log('  (dry-run mode -- no records will be updated)\n');
    } else {
      console.log('');
    }

    // 2. Load all records
    const records = vault.loadAll();

    if (records.length === 0) {
      console.log('  No records found. Run `ocp scrape` first.\n');
      return;
    }

    // 3. Initialize index (only if not dry-run)
    let index: SearchIndex | null = null;
    if (!opts.dryRun) {
      index = new SearchIndex(DB_PATH);
    }

    let matched = 0;
    let unmatched = 0;
    let updated = 0;

    try {
      for (const record of records) {
        const metadata = recordToMatchInput(record);
        const deps = extractDependencies(record);
        const result = matchTemplate(metadata, deps, templates);

        const recordLabel = record.meta.title || record['@id'];

        if (result.template && result.score > 0) {
          matched++;
          const matchInfo = {
            templateId: result.template.id,
            templateName: result.template.name,
            score: result.score,
            matchedAt: new Date().toISOString(),
            matchedRules: result.matchedRules,
          };

          if (opts.dryRun) {
            console.log(`  + ${recordLabel}`);
            console.log(`    -> ${result.template.name} (score: ${result.score.toFixed(3)})`);
          } else {
            // Update the record's extensions with the template match
            if (!record.extensions) {
              record.extensions = {};
            }
            record.extensions.templateMatch = matchInfo;

            // Save back to vault and re-index
            vault.save(record);
            index!.index(record);
            updated++;

            console.log(`  + ${recordLabel} -> ${result.template.name} (score: ${result.score.toFixed(3)})`);
          }
        } else {
          unmatched++;
          if (opts.dryRun) {
            console.log(`  - ${recordLabel} (no match)`);
          }
        }
      }
    } finally {
      if (index) {
        index.close();
      }
    }

    // 4. Summary
    console.log(`\n  Summary:`);
    console.log(`    Records processed: ${records.length}`);
    console.log(`    Matched:           ${matched}`);
    console.log(`    No match:          ${unmatched}`);
    if (!opts.dryRun) {
      console.log(`    Updated:           ${updated}`);
    }
    console.log('');
  });
