// Vault Connector — Reads and queries the Obsidian vault filesystem
// Walks the vault directory, parses YAML frontmatter from markdown files,
// and provides structured query/status access via the VaultConnector interface.
//
// CONSTRAINTS:
// - No external dependencies for frontmatter parsing (regex only)
// - Skips .obsidian/, node_modules/, .git/ directories
// - Malformed frontmatter is skipped gracefully (never crashes)
// - All paths returned are relative to the vault root

import { readdir, stat, readFile } from "node:fs/promises";
import { join, relative, basename } from "node:path";
import type { Logger } from "pino";
import type {
  VaultConnector,
  VaultDocument,
  VaultQueryParams,
  VaultQueryResult,
  VaultStatusResult,
} from "@observer/shared";

// ---------------------------------------------------------------------------
// Frontmatter parsing (regex-based, no dependencies)
// ---------------------------------------------------------------------------

interface ParsedFrontmatter {
  status?: string;
  tags?: string[];
  title?: string;
  [key: string]: unknown;
}

/**
 * Parse YAML frontmatter from a markdown file's content.
 * Expects the standard `---\n...\n---` delimiters.
 * Returns an empty object if no frontmatter is found or parsing fails.
 */
function parseFrontmatter(content: string): ParsedFrontmatter {
  // Match frontmatter block: must start at the very beginning of the file
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  const block = match[1];
  const result: ParsedFrontmatter = {};

  try {
    // Parse simple key: value pairs line by line
    const lines = block.split(/\r?\n/);
    let currentKey: string | null = null;
    let currentList: string[] | null = null;

    for (const line of lines) {
      // Skip empty lines and comments
      if (line.trim() === "" || line.trim().startsWith("#")) continue;

      // Check for list item (continuation of previous key)
      const listMatch = line.match(/^\s+-\s+(.+)/);
      if (listMatch && currentKey && currentList) {
        currentList.push(listMatch[1].trim().replace(/^["']|["']$/g, ""));
        continue;
      }

      // Flush previous list if we're moving to a new key
      if (currentKey && currentList) {
        result[currentKey] = currentList;
        currentKey = null;
        currentList = null;
      }

      // Match key: value
      const kvMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_-]*)\s*:\s*(.*)/);
      if (!kvMatch) continue;

      const key = kvMatch[1].trim();
      const rawValue = kvMatch[2].trim();

      // If value is empty, it might be followed by a YAML list
      if (rawValue === "" || rawValue === "[]") {
        currentKey = key;
        currentList = [];
        continue;
      }

      // Inline list: [tag1, tag2, tag3]
      const inlineListMatch = rawValue.match(/^\[(.+)\]$/);
      if (inlineListMatch) {
        result[key] = inlineListMatch[1]
          .split(",")
          .map((s) => s.trim().replace(/^["']|["']$/g, ""));
        continue;
      }

      // Simple string value (strip quotes if present)
      result[key] = rawValue.replace(/^["']|["']$/g, "");
    }

    // Flush final list
    if (currentKey && currentList) {
      result[currentKey] = currentList;
    }
  } catch {
    // Malformed frontmatter -- return whatever we managed to parse
  }

  return result;
}

/**
 * Extract the first H1 heading from markdown content (after frontmatter).
 * Returns null if no H1 is found.
 */
function extractFirstH1(content: string): string | null {
  // Strip frontmatter first
  const withoutFm = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  const match = withoutFm.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

// ---------------------------------------------------------------------------
// Directories to skip during vault traversal
// ---------------------------------------------------------------------------

const SKIP_DIRS = new Set([".obsidian", "node_modules", ".git", ".trash"]);

// ---------------------------------------------------------------------------
// VaultConnector Implementation
// ---------------------------------------------------------------------------

export interface VaultConnectorConfig {
  vaultPath: string;
  logger: Logger;
}

export class VaultConnectorImpl implements VaultConnector {
  private readonly vaultPath: string;
  private readonly logger: Logger;
  private lastScanTime: string | undefined;

  constructor(config: VaultConnectorConfig) {
    this.vaultPath = config.vaultPath;
    this.logger = config.logger.child({ component: "vault-connector" });
  }

  /**
   * Recursively walk the vault and collect all markdown files.
   */
  private async walkDir(dir: string): Promise<string[]> {
    const results: string[] = [];

    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (err) {
      this.logger.warn({ dir, err }, "Failed to read directory during vault walk");
      return results;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const subResults = await this.walkDir(join(dir, entry.name));
        results.push(...subResults);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        results.push(join(dir, entry.name));
      }
    }

    return results;
  }

  /**
   * Parse a single markdown file into a VaultDocument.
   * Returns null if the file cannot be read or is malformed.
   */
  private async parseDocument(
    filePath: string,
  ): Promise<VaultDocument | null> {
    try {
      const [content, fileStat] = await Promise.all([
        readFile(filePath, "utf-8"),
        stat(filePath),
      ]);

      const relativePath = relative(this.vaultPath, filePath);
      const frontmatter = parseFrontmatter(content);

      // Title: frontmatter title > first H1 > filename (without .md)
      const title =
        (typeof frontmatter.title === "string" ? frontmatter.title : null) ??
        extractFirstH1(content) ??
        basename(filePath, ".md");

      // Tags: from frontmatter
      const tags = Array.isArray(frontmatter.tags)
        ? frontmatter.tags.map(String)
        : undefined;

      // Status: from frontmatter
      const status =
        typeof frontmatter.status === "string"
          ? frontmatter.status
          : undefined;

      return {
        path: relativePath,
        title,
        status,
        modified_at: fileStat.mtime.toISOString(),
        size_bytes: fileStat.size,
        tags: tags && tags.length > 0 ? tags : undefined,
      };
    } catch (err) {
      this.logger.debug(
        { filePath, err },
        "Failed to parse vault document, skipping",
      );
      return null;
    }
  }

  async query(params: VaultQueryParams): Promise<VaultQueryResult> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    this.logger.debug({ params }, "Vault query started");

    // Walk the vault
    const allFiles = await this.walkDir(this.vaultPath);
    this.lastScanTime = new Date().toISOString();

    // Parse all documents in parallel (bounded)
    const documents: VaultDocument[] = [];
    // Process in batches of 50 to avoid opening too many file handles
    const batchSize = 50;
    for (let i = 0; i < allFiles.length; i += batchSize) {
      const batch = allFiles.slice(i, i + batchSize);
      const parsed = await Promise.all(
        batch.map((f) => this.parseDocument(f)),
      );
      for (const doc of parsed) {
        if (doc) documents.push(doc);
      }
    }

    // Apply filters
    let filtered = documents;

    if (params.path_prefix) {
      const prefix = params.path_prefix;
      filtered = filtered.filter((d) => d.path.startsWith(prefix));
    }

    if (params.status_filter) {
      const statusFilter = params.status_filter;
      filtered = filtered.filter((d) => d.status === statusFilter);
    }

    // Sort by modification time (newest first)
    filtered.sort(
      (a, b) =>
        new Date(b.modified_at).getTime() - new Date(a.modified_at).getTime(),
    );

    const totalCount = filtered.length;

    // Apply pagination
    const paginated = filtered.slice(offset, offset + limit);

    return {
      total_count: totalCount,
      documents: paginated,
      has_more: offset + limit < totalCount,
    };
  }

  async getStatus(): Promise<VaultStatusResult> {
    try {
      const allFiles = await this.walkDir(this.vaultPath);
      this.lastScanTime = new Date().toISOString();

      return {
        healthy: true,
        document_count: allFiles.length,
        vault_path: this.vaultPath,
        last_scan: this.lastScanTime,
      };
    } catch (err) {
      this.logger.error({ err }, "Vault status check failed");
      return {
        healthy: false,
        document_count: 0,
        vault_path: this.vaultPath,
        last_scan: this.lastScanTime,
      };
    }
  }
}
