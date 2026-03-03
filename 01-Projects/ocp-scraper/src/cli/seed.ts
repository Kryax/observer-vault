import { Command } from 'commander';
import { GitHubAdapter } from '../forge/github';
import { extractMetadata } from '../extract/metadata';
import { parseReadme } from '../extract/readme';
import { parseDependencies, MANIFEST_FILES } from '../extract/dependencies';
import { assembleSolutionRecord } from '../record/assembler';
import { VaultStore } from '../store/vault';
import { SearchIndex } from '../store/index';
import type { DependencyRef } from '../types/solution-record';

const BASE_DIR = process.cwd();
const DB_PATH = `${BASE_DIR}/.ocp/index.db`;

/**
 * Parse a GitHub URL into owner/repo.
 */
function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  // Handle: https://github.com/owner/repo, github.com/owner/repo, owner/repo
  const match = url.match(/(?:github\.com\/)?([^/]+)\/([^/\s]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}

export const seedCommand = new Command('seed')
  .description('Create a seed Solution Record from a single repository URL')
  .argument('<repo-url>', 'Repository URL (e.g., https://github.com/owner/repo or owner/repo)')
  .action(async (repoUrl: string) => {
    const parsed = parseRepoUrl(repoUrl);
    if (!parsed) {
      console.error(`\n❌ Could not parse repository URL: ${repoUrl}`);
      console.error('   Expected: https://github.com/owner/repo or owner/repo\n');
      process.exit(1);
    }

    const { owner, repo } = parsed;
    console.log(`\n🌱 Seeding Solution Record for: ${owner}/${repo}\n`);

    let forge: GitHubAdapter;
    try {
      forge = new GitHubAdapter();
    } catch {
      console.error('❌ GITHUB_TOKEN not set. Export it first:');
      console.error('   export GITHUB_TOKEN=ghp_...');
      process.exit(1);
    }

    const vault = new VaultStore(BASE_DIR);
    const index = new SearchIndex(DB_PATH);

    try {
      // Fetch repo data
      console.log('   📡 Fetching repository metadata...');
      const repoData = await forge.getRepo(owner, repo);

      console.log('   📖 Fetching README...');
      const readmeContent = await forge.getReadme(owner, repo);

      console.log('   👥 Fetching contributors...');
      const contributorsCount = await forge.getContributorsCount(owner, repo);

      // Extract
      const metadata = extractMetadata(repoData, contributorsCount);
      const parsedReadme = readmeContent ? parseReadme(readmeContent.content) : null;

      // Dependencies
      console.log('   📦 Checking manifests...');
      const deps: DependencyRef[] = [];
      for (const manifest of MANIFEST_FILES) {
        try {
          const file = await forge.getFile(owner, repo, manifest);
          if (file) {
            const parsed = parseDependencies(manifest, file.content);
            deps.push(...parsed);
            console.log(`      Found ${manifest}: ${parsed.length} dependencies`);
          }
        } catch {
          // Not found — normal
        }
      }

      // Assemble
      const record = assembleSolutionRecord({
        metadata,
        readme: parsedReadme,
        dependencies: deps,
        contributorsCount,
      });

      // Save
      const filePath = vault.save(record);
      index.index(record);

      console.log(`\n   ✅ Record created!`);
      console.log(`   📁 File: ${filePath.replace(BASE_DIR + '/', '')}`);
      console.log(`   🆔 ID:   ${record['@id']}`);
      console.log(`   🎯 Trust: ${record.trust.trustScore?.toFixed(3)} (${record.trust.confidence})`);
      console.log(`   📋 Domains: ${record.domains.join(', ')}`);
      console.log(`   📦 Dependencies: ${deps.length} total\n`);

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`\n❌ Failed to seed ${owner}/${repo}: ${msg}\n`);
      process.exit(1);
    } finally {
      index.close();
    }
  });
