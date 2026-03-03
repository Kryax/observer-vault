/**
 * JSON Feed publisher -- generates a JSON Feed 1.1 from vault Solution Records.
 * https://jsonfeed.org/version/1.1
 */

import type { SolutionRecord } from '../types/solution-record';
import type { JSONFeed, JSONFeedItem, FederationConfig } from './types';

/**
 * Generate a JSON Feed from vault records.
 * Follows JSON Feed spec v1.1: https://jsonfeed.org/version/1.1
 */
export function generateFeed(
  records: SolutionRecord[],
  config: FederationConfig,
): JSONFeed {
  const items = records
    .map((r) => recordToFeedItem(r, config.publish.include_full_records))
    .sort((a, b) => {
      const dateA = a.date_modified ?? a.date_published ?? '';
      const dateB = b.date_modified ?? b.date_published ?? '';
      return dateB.localeCompare(dateA); // descending — newest first
    });

  return {
    version: 'https://jsonfeed.org/version/1.1',
    title: config.vault_name,
    description: `OCP Solution Records published by ${config.vault_name}`,
    items,
    _ocp: {
      vault_id: config.vault_id,
      vault_name: config.vault_name,
      published_at: new Date().toISOString(),
      record_count: items.length,
    },
  };
}

/**
 * Convert a SolutionRecord to a JSON Feed item.
 */
function recordToFeedItem(
  record: SolutionRecord,
  includeFullRecord: boolean,
): JSONFeedItem {
  // Find first repository-type implementation ref for the item URL
  const repoRef = record.implementation.refs.find((r) => r.type === 'repository');

  // Merge domains and keywords for tags
  const tags = [
    ...record.domains,
    ...(record.meta.keywords ?? []),
  ];

  const item: JSONFeedItem = {
    id: record['@id'],
    title: record.meta.title,
    content_text: record.problemSolved.statement,
    summary: record.meta.description,
    url: repoRef?.uri,
    date_published: record.meta.dateCreated,
    date_modified: record.meta.dateModified,
    tags: tags.length > 0 ? tags : undefined,
  };

  if (includeFullRecord) {
    item._ocp_record = record as unknown as Record<string, unknown>;
  }

  return item;
}
