/**
 * TemplateStore -- Git-backed file storage for Problem Templates.
 *
 * Templates are stored as JSON files in a templates/ directory.
 * File pattern: templates/<template-slug>.json
 *
 * Follows the same I/O patterns as VaultStore (src/store/vault.ts):
 * readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync.
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import type { ProblemTemplate } from './types';

export class TemplateStore {
  private templatesDir: string;

  constructor(baseDir: string) {
    this.templatesDir = join(baseDir, 'templates');
    mkdirSync(this.templatesDir, { recursive: true });
  }

  /**
   * Save a ProblemTemplate to disk.
   * Returns the file path where it was saved.
   * Idempotent: overwrites if template with same ID exists.
   */
  save(template: ProblemTemplate): string {
    const slug = this.idToSlug(template.id);
    const filePath = join(this.templatesDir, `${slug}.json`);
    const json = JSON.stringify(template, null, 2);
    writeFileSync(filePath, json, 'utf-8');
    return filePath;
  }

  /**
   * Load a ProblemTemplate by its ID.
   * Returns null if not found.
   */
  load(id: string): ProblemTemplate | null {
    const slug = this.idToSlug(id);
    const filePath = join(this.templatesDir, `${slug}.json`);

    if (!existsSync(filePath)) return null;

    try {
      const content = readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as ProblemTemplate;
    } catch {
      return null;
    }
  }

  /**
   * Load all ProblemTemplates from disk.
   */
  loadAll(): ProblemTemplate[] {
    const templates: ProblemTemplate[] = [];

    if (!existsSync(this.templatesDir)) return templates;

    const files = readdirSync(this.templatesDir)
      .filter(f => f.endsWith('.json'));

    for (const file of files) {
      try {
        const content = readFileSync(join(this.templatesDir, file), 'utf-8');
        templates.push(JSON.parse(content) as ProblemTemplate);
      } catch {
        // Skip corrupted files
      }
    }

    return templates;
  }

  /**
   * Load only approved templates.
   */
  loadApproved(): ProblemTemplate[] {
    return this.loadAll().filter(t => t.status === 'approved');
  }

  /**
   * Load only pending templates.
   */
  loadPending(): ProblemTemplate[] {
    return this.loadAll().filter(t => t.status === 'pending');
  }

  /**
   * Remove a template by its ID.
   * Returns true if the file existed and was deleted.
   */
  remove(id: string): boolean {
    const slug = this.idToSlug(id);
    const filePath = join(this.templatesDir, `${slug}.json`);

    if (!existsSync(filePath)) return false;

    unlinkSync(filePath);
    return true;
  }

  /**
   * Check if a template exists by its ID.
   */
  exists(id: string): boolean {
    const slug = this.idToSlug(id);
    const filePath = join(this.templatesDir, `${slug}.json`);
    return existsSync(filePath);
  }

  /**
   * Convert a template ID to a filesystem-safe slug.
   * Same pattern as VaultStore.idToSlug.
   */
  private idToSlug(id: string): string {
    return id
      .replace(/^template:/, '')
      .replace(/[/\\:*?"<>|]/g, '--')
      .toLowerCase();
  }
}
