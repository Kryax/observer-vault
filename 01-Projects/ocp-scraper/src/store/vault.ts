import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import type { SolutionRecord } from '../types/solution-record';
import { getPrimaryDomain } from '../record/assembler';

/**
 * Vault Store — Git-backed file storage for Solution Records.
 * Records are saved as .jsonld files in records/<domain>/<slug>.jsonld
 */
export class VaultStore {
  private recordsDir: string;

  constructor(baseDir: string) {
    this.recordsDir = join(baseDir, 'records');
    mkdirSync(this.recordsDir, { recursive: true });
  }

  /**
   * Save a Solution Record to disk.
   * Returns the file path where it was saved.
   * Idempotent: overwrites if record with same ID exists.
   */
  save(record: SolutionRecord): string {
    const domain = getPrimaryDomain(record.domains);
    const slug = this.idToSlug(record['@id']);
    const domainDir = join(this.recordsDir, domain);
    mkdirSync(domainDir, { recursive: true });

    const filePath = join(domainDir, `${slug}.jsonld`);
    const json = JSON.stringify(record, null, 2);
    writeFileSync(filePath, json, 'utf-8');

    return filePath;
  }

  /**
   * Load a Solution Record by its @id.
   * Searches all domain directories.
   */
  load(id: string): SolutionRecord | null {
    const slug = this.idToSlug(id);

    // Search all domain directories
    if (!existsSync(this.recordsDir)) return null;

    const domains = readdirSync(this.recordsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const domain of domains) {
      const filePath = join(this.recordsDir, domain, `${slug}.jsonld`);
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, 'utf-8');
        return JSON.parse(content) as SolutionRecord;
      }
    }

    return null;
  }

  /**
   * Check if a record exists by its @id.
   */
  exists(id: string): boolean {
    return this.load(id) !== null;
  }

  /**
   * Load all Solution Records from disk.
   */
  loadAll(): SolutionRecord[] {
    const records: SolutionRecord[] = [];

    if (!existsSync(this.recordsDir)) return records;

    const domains = readdirSync(this.recordsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const domain of domains) {
      const domainDir = join(this.recordsDir, domain);
      const files = readdirSync(domainDir)
        .filter(f => f.endsWith('.jsonld'));

      for (const file of files) {
        try {
          const content = readFileSync(join(domainDir, file), 'utf-8');
          records.push(JSON.parse(content) as SolutionRecord);
        } catch {
          // Skip corrupted files
        }
      }
    }

    return records;
  }

  /**
   * List all record IDs.
   */
  listIds(): string[] {
    return this.loadAll().map(r => r['@id']);
  }

  /**
   * Get stats about stored records.
   */
  getStats(): { totalRecords: number; domains: Record<string, number> } {
    const domains: Record<string, number> = {};
    let totalRecords = 0;

    if (!existsSync(this.recordsDir)) return { totalRecords, domains };

    const domainDirs = readdirSync(this.recordsDir, { withFileTypes: true })
      .filter(d => d.isDirectory());

    for (const dir of domainDirs) {
      const count = readdirSync(join(this.recordsDir, dir.name))
        .filter(f => f.endsWith('.jsonld')).length;
      if (count > 0) {
        domains[dir.name] = count;
        totalRecords += count;
      }
    }

    return { totalRecords, domains };
  }

  /**
   * Convert a record @id to a filesystem-safe slug.
   */
  private idToSlug(id: string): string {
    return id
      .replace(/^ocp:/, '')
      .replace(/[/\\:*?"<>|]/g, '--')
      .toLowerCase();
  }
}
