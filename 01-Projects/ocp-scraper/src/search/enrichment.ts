/**
 * Graph Enrichment -- Phase 2b
 * Builds shared-domain and compatible-port edges between Solution Records.
 * Called after scraping/indexing to enrich the graph beyond dependency edges.
 */

import { SearchIndex } from '../store/index';
import { TemplateStore } from '../template/store';
import { matchTemplate } from '../template/matcher';
import type { SolutionRecord } from '../types/solution-record';

/**
 * Enrich the graph with domain and port edges for all indexed records.
 * Call this after a scrape session to build the enriched graph.
 */
export function enrichGraph(index: SearchIndex, baseDir: string): { domainEdges: number; portEdges: number } {
  const templateStore = new TemplateStore(baseDir);
  const templates = templateStore.loadApproved();
  const recordIds = index.getAllRecordIds();

  let domainEdges = 0;
  let portEdges = 0;

  for (const id of recordIds) {
    const record = index.getRecord(id);
    if (!record) continue;

    // Build domain edges from template classification
    // Use the record's existing domains to find matching template
    if (record.domains && record.domains.length > 0) {
      for (const domain of record.domains) {
        if (!domain.startsWith('lang:')) {
          index.addDomainEdges(id, domain);
          domainEdges++;
        }
      }
    }

    // Build port edges from dependency profiles
    const deps = record.composability?.dependencies || [];
    const depNames = deps.map(d => d.name);
    if (depNames.length > 0) {
      index.addPortEdges(id, depNames);
      portEdges++;
    }
  }

  return { domainEdges, portEdges };
}
