import { Command } from 'commander';
import { TemplateStore } from '../template/store';
import { VaultStore } from '../store/vault';
import { batchGenerateTemplates } from '../template/generator';
import type { ProblemTemplate, TemplateProposal } from '../template/types';
import type { GeneratorInput } from '../template/generator';
import type { SolutionRecord, DependencyRef } from '../types/solution-record';
import type { RepoMetadata } from '../extract/metadata';

const BASE_DIR = process.cwd();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a slug-safe template ID from a name */
function nameToId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `template:${slug}`;
}

/** Format a date string for display */
function shortDate(iso: string): string {
  return iso.slice(0, 10);
}

/** Pad a string to a fixed width */
function pad(s: string, width: number): string {
  return s.length >= width ? s.slice(0, width) : s + ' '.repeat(width - s.length);
}

/** Convert a SolutionRecord to a GeneratorInput for batch generation */
function recordToGeneratorInput(record: SolutionRecord): GeneratorInput {
  return {
    metadata: recordToSyntheticMetadata(record),
    dependencies: record.composability?.dependencies || [],
  };
}

/** Synthesize a RepoMetadata from a SolutionRecord (fills defaults for unavailable fields) */
function recordToSyntheticMetadata(record: SolutionRecord): RepoMetadata {
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

/** Convert a TemplateProposal to a pending ProblemTemplate */
function proposalToTemplate(proposal: TemplateProposal): ProblemTemplate {
  const now = new Date().toISOString();
  return {
    id: nameToId(proposal.name),
    name: proposal.name,
    description: proposal.description,
    category: proposal.category,
    cynefinDomain: proposal.cynefinDomain,
    version: '0.1.0',
    patterns: proposal.patterns,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    proposedBy: 'batch-generator',
    reviewedBy: null,
    rejectionReason: null,
  };
}

// ---------------------------------------------------------------------------
// Command: ocp template
// ---------------------------------------------------------------------------

export const templateCommand = new Command('template')
  .description('Manage problem templates (propose, approve, reject, list)');

// ---------------------------------------------------------------------------
// Subcommand: ocp template list
// ---------------------------------------------------------------------------

templateCommand
  .command('list')
  .description('List all problem templates')
  .option('--status <status>', 'Filter by status (pending, approved, rejected)')
  .option('--verbose', 'Show full template details')
  .action(async (opts) => {
    const store = new TemplateStore(BASE_DIR);
    let templates = store.loadAll();

    if (opts.status) {
      const filter = opts.status as string;
      templates = templates.filter(t => t.status === filter);
    }

    if (templates.length === 0) {
      console.log('\n  No templates found.\n');
      return;
    }

    console.log(`\n  Problem Templates (${templates.length} total)\n`);

    if (opts.verbose) {
      for (const t of templates) {
        console.log(`  --- ${t.id} ---`);
        console.log(`  Name:        ${t.name}`);
        console.log(`  Category:    ${t.category}`);
        console.log(`  Description: ${t.description}`);
        console.log(`  Cynefin:     ${t.cynefinDomain}`);
        console.log(`  Version:     ${t.version}`);
        console.log(`  Status:      ${t.status}`);
        console.log(`  Proposed by: ${t.proposedBy}`);
        console.log(`  Reviewed by: ${t.reviewedBy || '-'}`);
        console.log(`  Created:     ${shortDate(t.createdAt)}`);
        console.log(`  Updated:     ${shortDate(t.updatedAt)}`);
        console.log(`  Topics:      ${t.patterns.topicPatterns.join(', ') || '-'}`);
        console.log(`  Deps:        ${t.patterns.dependencyPatterns.join(', ') || '-'}`);
        console.log(`  MinScore:    ${t.patterns.minScore}`);
        if (t.rejectionReason) {
          console.log(`  Rejection:   ${t.rejectionReason}`);
        }
        console.log('');
      }
    } else {
      // Table format
      const header = `  ${pad('ID', 35)} ${pad('Name', 28)} ${pad('Category', 24)} ${pad('Status', 10)} ${pad('Ver', 6)} ${pad('Cynefin', 12)}`;
      console.log(header);
      console.log('  ' + '-'.repeat(header.length - 2));

      for (const t of templates) {
        const row = `  ${pad(t.id, 35)} ${pad(t.name, 28)} ${pad(t.category, 24)} ${pad(t.status, 10)} ${pad(t.version, 6)} ${pad(t.cynefinDomain, 12)}`;
        console.log(row);
      }
      console.log('');
    }
  });

// ---------------------------------------------------------------------------
// Subcommand: ocp template propose
// ---------------------------------------------------------------------------

templateCommand
  .command('propose')
  .description('Generate template proposals from existing scraped records or a JSON file')
  .option('--from-repos', 'Batch generate proposals from all scraped records')
  .option('--from-file <path>', 'Load proposal(s) from a JSON file')
  .action(async (opts) => {
    const templateStore = new TemplateStore(BASE_DIR);

    if (opts.fromFile) {
      // Load proposals from a JSON file
      const filePath = opts.fromFile as string;
      console.log(`\n  Loading proposals from ${filePath}...\n`);

      let proposals: TemplateProposal[];
      try {
        const content = await Bun.file(filePath).text();
        const parsed = JSON.parse(content);
        proposals = Array.isArray(parsed) ? parsed : [parsed];
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  Could not load file: ${msg}`);
        process.exit(1);
      }

      let created = 0;
      let skipped = 0;
      for (const proposal of proposals) {
        const template = proposalToTemplate(proposal);
        if (templateStore.exists(template.id)) {
          console.log(`  -- Skipped "${template.name}" (already exists as ${template.id})`);
          skipped++;
          continue;
        }
        const path = templateStore.save(template);
        created++;
        console.log(`  + Created "${template.name}" -> ${template.id}`);
      }

      console.log(`\n  Summary: ${created} created, ${skipped} skipped\n`);
      return;
    }

    if (opts.fromRepos) {
      // Batch generate from existing scraped records
      console.log('\n  Generating template proposals from scraped records...\n');

      const vault = new VaultStore(BASE_DIR);
      const records = vault.loadAll();

      if (records.length === 0) {
        console.log('  No scraped records found. Run `ocp scrape` first.\n');
        return;
      }

      console.log(`  Found ${records.length} scraped records.`);
      console.log('  Running batch template generation...\n');

      const inputs: GeneratorInput[] = records.map(recordToGeneratorInput);
      const proposals = await batchGenerateTemplates(inputs);

      if (proposals.length === 0) {
        console.log('  No proposals generated. Records may not have enough signal.\n');
        return;
      }

      let created = 0;
      let skipped = 0;
      for (const proposal of proposals) {
        const template = proposalToTemplate(proposal);
        if (templateStore.exists(template.id)) {
          console.log(`  -- Skipped "${template.name}" (already exists as ${template.id})`);
          skipped++;
          continue;
        }
        templateStore.save(template);
        created++;
        console.log(`  + Proposed "${template.name}" [${template.category}] (confidence: ${proposal.confidence.toFixed(2)})`);
      }

      console.log(`\n  Summary: ${created} proposals created, ${skipped} skipped`);
      console.log('  Use `ocp template list --status pending` to review.');
      console.log('  Use `ocp template approve <id>` to approve.\n');
      return;
    }

    // No option specified
    console.error('  Specify --from-repos or --from-file <path>');
    process.exit(1);
  });

// ---------------------------------------------------------------------------
// Subcommand: ocp template approve <template-id>
// ---------------------------------------------------------------------------

templateCommand
  .command('approve <template-id>')
  .description('Approve a pending template')
  .action(async (templateId: string) => {
    const store = new TemplateStore(BASE_DIR);
    const template = store.load(templateId);

    if (!template) {
      console.error(`\n  Template not found: ${templateId}\n`);
      process.exit(1);
    }

    if (template.status !== 'pending') {
      console.error(`\n  Template "${templateId}" is already ${template.status}. Only pending templates can be approved.\n`);
      process.exit(1);
    }

    template.status = 'approved';
    template.reviewedBy = 'cli-user';
    template.updatedAt = new Date().toISOString();

    store.save(template);

    console.log(`\n  Approved: ${template.name} (${templateId})`);
    console.log(`  Category: ${template.category}`);
    console.log(`  Cynefin:  ${template.cynefinDomain}`);
    console.log(`  Version:  ${template.version}\n`);
  });

// ---------------------------------------------------------------------------
// Subcommand: ocp template reject <template-id>
// ---------------------------------------------------------------------------

templateCommand
  .command('reject <template-id>')
  .description('Reject and remove a pending template')
  .requiredOption('--reason <reason>', 'Reason for rejection')
  .action(async (templateId: string, opts: { reason: string }) => {
    const store = new TemplateStore(BASE_DIR);
    const template = store.load(templateId);

    if (!template) {
      console.error(`\n  Template not found: ${templateId}\n`);
      process.exit(1);
    }

    if (template.status !== 'pending') {
      console.error(`\n  Template "${templateId}" is already ${template.status}. Only pending templates can be rejected.\n`);
      process.exit(1);
    }

    // Remove the rejected template file -- rejected templates don't persist
    store.remove(templateId);

    console.log(`\n  Rejected: ${template.name} (${templateId})`);
    console.log(`  Reason:   ${opts.reason}`);
    console.log(`  Template file removed.\n`);
  });
