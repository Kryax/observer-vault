import { Command } from 'commander';
import { GitHubAdapter } from '../forge/github';
import { ForgejoAdapter } from '../forge/forgejo';
import { ArxivAdapter } from '../forge/arxiv';
import { coarseFilter, DEFAULT_COARSE_CONFIG } from '../filter/coarse';
import { fineFilter } from '../filter/fine';
import { extractMetadata } from '../extract/metadata';
import { parseReadme } from '../extract/readme';
import { parseDependencies, MANIFEST_FILES } from '../extract/dependencies';
import { assembleSolutionRecord } from '../record/assembler';
import { assembleArxivSolutionRecord } from '../record/arxiv';
import { VaultStore } from '../store/vault';
import { SearchIndex } from '../store/index';
import type { ForgeAdapter } from '../types/forge';
import type { DependencyRef } from '../types/solution-record';
import { enrichGraph } from '../search/enrichment';

const BASE_DIR = process.cwd();
const DB_PATH = `${BASE_DIR}/.ocp/index.db`;

export const scrapeCommand = new Command('scrape')
  .description('Scrape repositories by topic and create Solution Records')
  .requiredOption('--topic <topic>', 'Topic to search for')
  .option('--source <source>', 'Forge source (github, codeberg, forgejo, arxiv)', 'github')
  .option('--limit <number>', 'Maximum repos to scrape', '10')
  .option('--min-stars <number>', 'Minimum stars filter', '10')
  .option('--forge-url <url>', 'Base URL for self-hosted Forgejo instances')
  .option('--keyword <keyword>', 'arXiv keyword query')
  .option('--author <author>', 'arXiv author query')
  .option('--date-from <date>', 'arXiv lower date bound (YYYY-MM-DD or YYYYMMDD)')
  .option('--date-to <date>', 'arXiv upper date bound (YYYY-MM-DD or YYYYMMDD)')
  .action(async (opts) => {
    const limit = parseInt(opts.limit, 10);
    const minStars = parseInt(opts.minStars, 10);
    const source = opts.source as string;
    const topic = opts.topic as string;

    console.log(`\n🔍 Scraping ${source} for topic: "${topic}" (limit: ${limit})\n`);

    // Initialize forge adapter
    let forge: ForgeAdapter;
    if (source === 'github') {
      try {
        forge = new GitHubAdapter();
      } catch (e) {
        console.error('❌ GITHUB_TOKEN not set. Export it first:');
        console.error('   export GITHUB_TOKEN=ghp_...');
        process.exit(1);
      }
    } else if (source === 'codeberg') {
      forge = new ForgejoAdapter(); // defaults to https://codeberg.org
    } else if (source === 'forgejo') {
      const forgeUrl = opts.forgeUrl as string | undefined;
      if (!forgeUrl) {
        console.error('❌ --forge-url is required when using --source forgejo');
        console.error('   Example: ocp scrape --source forgejo --forge-url https://my-forgejo.example.com --topic ...');
        process.exit(1);
      }
      forge = new ForgejoAdapter({ baseUrl: forgeUrl });
    } else if (source === 'arxiv') {
      forge = new ArxivAdapter();
    } else {
      console.error(`❌ Unknown source: ${source}. Supported: github, codeberg, forgejo, arxiv`);
      process.exit(1);
    }

    // Initialize storage
    const vault = new VaultStore(BASE_DIR);
    const index = new SearchIndex(DB_PATH);

    try {
      // Search repositories
      console.log(`📡 Searching ${source} for topic "${topic}"...`);
      const searchResult = await forge.searchRepos({
        topic: source === 'arxiv'
          ? buildArxivTopicQuery(topic, opts.keyword as string | undefined, opts.author as string | undefined, opts.dateFrom as string | undefined, opts.dateTo as string | undefined)
          : topic,
        limit: limit * 2, // Fetch more to account for filtering
        minStars,
      });
      console.log(`   Found ${searchResult.totalCount} total, fetched ${searchResult.repos.length}\n`);

      let processed = 0;
      let indexed = 0;
      let filtered = 0;
      let errors = 0;

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

            const filePath = vault.save(record);
            index.index(record);
            indexed++;

            const trustScore = record.trust.trustScore?.toFixed(3) || '0.000';
            console.log(`   ✅ arxiv/${paper.id} — trust:${trustScore} | ${paper.categories.join(', ')} → ${filePath.replace(BASE_DIR + '/', '')}`);
            continue;
          }

          // Stage 1: Coarse filter (pass CLI min-stars through)
          const coarseResult = coarseFilter(repo, {
            ...DEFAULT_COARSE_CONFIG,
            minStars: minStars,
            minForks: minStars === 0 ? 0 : DEFAULT_COARSE_CONFIG.minForks,
          });
          if (!coarseResult.passed) {
            filtered++;
            console.log(`   ⏭️  ${repo.fullName} — filtered: ${coarseResult.reasons.join(', ')}`);
            continue;
          }

          // Parse owner/repo from fullName
          const [owner, repoName] = repo.fullName.split('/');

          // Fetch README
          console.log(`   📖 ${repo.fullName} — fetching README...`);
          const readmeContent = await forge.getReadme(owner, repoName);

          // Stage 2: Fine filter (if README exists)
          if (readmeContent) {
            const fineResult = fineFilter(readmeContent.content);
            if (!fineResult.passed) {
              filtered++;
              console.log(`   ⏭️  ${repo.fullName} — README quality too low: ${fineResult.reasons.join(', ')}`);
              continue;
            }
          }

          // Get contributors count
          const contributorsCount = await forge.getContributorsCount(owner, repoName);

          // Extract metadata
          const metadata = extractMetadata(repo, contributorsCount);

          // Parse README
          const parsedReadme = readmeContent ? parseReadme(readmeContent.content) : null;

          // Extract dependencies from manifest files
          const deps: DependencyRef[] = [];
          for (const manifest of MANIFEST_FILES) {
            try {
              const file = await forge.getFile(owner, repoName, manifest);
              if (file) {
                const parsed = parseDependencies(manifest, file.content);
                deps.push(...parsed);
              }
            } catch {
              // Manifest not found — normal
            }
          }

          // Assemble Solution Record
          const record = assembleSolutionRecord({
            metadata,
            readme: parsedReadme,
            dependencies: deps,
            contributorsCount,
            forgeName: forge.name,
          });

          // Save to vault and index
          const filePath = vault.save(record);
          index.index(record);
          indexed++;

          const trustScore = record.trust.trustScore?.toFixed(3) || '0.000';
          console.log(`   ✅ ${repo.fullName} — ⭐${repo.stars} | trust:${trustScore} | ${deps.length} deps → ${filePath.replace(BASE_DIR + '/', '')}`);

        } catch (err) {
          errors++;
          const msg = err instanceof Error ? err.message : String(err);
          console.log(`   ❌ ${repo.fullName} — error: ${msg}`);
          // Continue to next repo — graceful failure
        }
      }

      // Enrich graph with domain and port edges (Phase 2b)
      if (indexed > 0) {
        console.log(`\n🔗 Enriching knowledge graph...`);
        const enrichResult = enrichGraph(index, BASE_DIR);
        console.log(`   Domain edges: ${enrichResult.domainEdges}`);
        console.log(`   Port edges:   ${enrichResult.portEdges}`);
      }

      console.log(`\n📊 Summary:`);
      console.log(`   Processed: ${processed}`);
      console.log(`   Indexed:   ${indexed}`);
      console.log(`   Filtered:  ${filtered}`);
      console.log(`   Errors:    ${errors}`);

    } finally {
      index.close();
    }
  });

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
