/**
 * Gap-Directed Sampling Engine
 *
 * Scores dataset components against motif library gaps and produces a
 * processing priority queue. Drives shard selection so the processor
 * fills the biggest holes in the motif library first.
 */

import { Database } from 'bun:sqlite';
import { INDICATOR_SETS } from '../filter/indicator-sets';

// ── Public interfaces ────────────────────────────────────────────

/** Known dataset component from The Pile with domain affinity hints. */
export interface DatasetComponent {
  name: string;
  /** Affinity scores keyed by derivative-order label (d0-d3). */
  domainAffinity: Record<string, number>;
  estimatedDocCount: number;
}

/** Gap in the motif library that needs filling. */
export interface LibraryGap {
  type: 'axis-void' | 'domain-coverage' | 'relationship-density' | 'order-void';
  description: string;
  affectedMotifs: string[];
  severity: number; // 0.0-1.0
}

/** Scored dataset component with priority for processing. */
export interface ComponentPriority {
  component: string;
  score: number;
  gapContributions: Array<{ gap: LibraryGap; contribution: number }>;
}

/** Processing schedule entry. */
export interface ScheduleEntry {
  dataset: string;
  component: string;
  shardId: string;
  priority: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

// ── Pile component catalogue ─────────────────────────────────────

/** The 21 known components of The Pile with domain affinities per order. */
export const PILE_COMPONENTS: DatasetComponent[] = [
  { name: 'PhilPapers',       domainAffinity: { d3: 0.9, d2: 0.8, d1: 0.5, d0: 0.3 }, estimatedDocCount: 33_000 },
  { name: 'ArXiv',            domainAffinity: { d3: 0.7, d2: 0.6, d1: 0.8, d0: 0.5 }, estimatedDocCount: 1_500_000 },
  { name: 'Wikipedia',        domainAffinity: { d3: 0.4, d2: 0.5, d1: 0.7, d0: 0.8 }, estimatedDocCount: 6_000_000 },
  { name: 'StackExchange',    domainAffinity: { d3: 0.3, d2: 0.4, d1: 0.9, d0: 0.7 }, estimatedDocCount: 16_000_000 },
  { name: 'PubMed Central',   domainAffinity: { d3: 0.3, d2: 0.4, d1: 0.6, d0: 0.5 }, estimatedDocCount: 3_000_000 },
  { name: 'PubMed Abstracts', domainAffinity: { d3: 0.2, d2: 0.3, d1: 0.5, d0: 0.4 }, estimatedDocCount: 15_000_000 },
  { name: 'FreeLaw',          domainAffinity: { d3: 0.6, d2: 0.5, d1: 0.7, d0: 0.4 }, estimatedDocCount: 3_500_000 },
  { name: 'USPTO Backgrounds', domainAffinity: { d3: 0.4, d2: 0.3, d1: 0.7, d0: 0.5 }, estimatedDocCount: 5_000_000 },
  { name: 'Gutenberg (PG-19)', domainAffinity: { d3: 0.5, d2: 0.6, d1: 0.3, d0: 0.4 }, estimatedDocCount: 28_000 },
  { name: 'BookCorpus2',      domainAffinity: { d3: 0.3, d2: 0.4, d1: 0.3, d0: 0.5 }, estimatedDocCount: 17_000 },
  { name: 'HackerNews',       domainAffinity: { d3: 0.5, d2: 0.5, d1: 0.7, d0: 0.6 }, estimatedDocCount: 373_000 },
  { name: 'NIH ExPorter',     domainAffinity: { d3: 0.3, d2: 0.3, d1: 0.5, d0: 0.4 }, estimatedDocCount: 939_000 },
  { name: 'OpenWebText2',     domainAffinity: { d3: 0.4, d2: 0.4, d1: 0.5, d0: 0.6 }, estimatedDocCount: 17_000_000 },
  { name: 'Pile-CC',          domainAffinity: { d3: 0.3, d2: 0.3, d1: 0.4, d0: 0.5 }, estimatedDocCount: 50_000_000 },
  { name: 'DM Mathematics',   domainAffinity: { d3: 0.2, d2: 0.4, d1: 0.8, d0: 0.3 }, estimatedDocCount: 1_000_000 },
  { name: 'Ubuntu IRC',       domainAffinity: { d3: 0.2, d2: 0.3, d1: 0.6, d0: 0.5 }, estimatedDocCount: 62_000 },
  { name: 'EuroParl',         domainAffinity: { d3: 0.5, d2: 0.4, d1: 0.5, d0: 0.3 }, estimatedDocCount: 69_000 },
  { name: 'Github',           domainAffinity: { d3: 0.3, d2: 0.3, d1: 0.8, d0: 0.6 }, estimatedDocCount: 18_000_000 },
  { name: 'YoutubeSubtitles', domainAffinity: { d3: 0.3, d2: 0.3, d1: 0.3, d0: 0.5 }, estimatedDocCount: 173_000 },
  { name: 'OpenSubtitles',    domainAffinity: { d3: 0.2, d2: 0.3, d1: 0.2, d0: 0.5 }, estimatedDocCount: 450_000 },
  { name: 'Enron Emails',     domainAffinity: { d3: 0.3, d2: 0.3, d1: 0.4, d0: 0.4 }, estimatedDocCount: 517_000 },
];

// ── Axis/order label helpers ─────────────────────────────────────

const AXES = ['differentiate', 'integrate', 'recurse'] as const;

/** Map derivative order (numeric) to domain-affinity key. */
function orderToKey(order: number): string {
  if (order >= 2.5) return 'd3';
  if (order >= 1.5) return 'd2';
  if (order >= 0.5) return 'd1';
  return 'd0';
}

// ── GapScorer ────────────────────────────────────────────────────

export class GapScorer {
  /** Cached gap list, refreshed on demand. */
  private cachedGaps: LibraryGap[] | null = null;
  /** Cached priorities, refreshed on demand. */
  private cachedPriorities: ComponentPriority[] | null = null;

  constructor(private db: Database) {}

  // ── Gap analysis ─────────────────────────────────────────────

  /**
   * Analyse current motif library state and identify gaps.
   * Reads from verb_records and motif_graph_edges tables.
   */
  analyzeGaps(): LibraryGap[] {
    const gaps: LibraryGap[] = [];

    gaps.push(...this.findAxisVoids());
    gaps.push(...this.findOrderVoids());
    gaps.push(...this.findDomainCoverageGaps());
    gaps.push(...this.findRelationshipDensityGaps());

    this.cachedGaps = gaps;
    return gaps;
  }

  // ── Component scoring ────────────────────────────────────────

  /**
   * Score all Pile components against identified gaps.
   * Returns components ranked by priority (highest first).
   */
  scoreComponents(gaps?: LibraryGap[]): ComponentPriority[] {
    const activeGaps = gaps ?? this.cachedGaps ?? this.analyzeGaps();

    const priorities: ComponentPriority[] = PILE_COMPONENTS.map((comp) => {
      const contributions: ComponentPriority['gapContributions'] = [];
      let totalScore = 0;

      for (const gap of activeGaps) {
        const contribution = this.computeContribution(comp, gap);
        if (contribution > 0) {
          contributions.push({ gap, contribution });
          totalScore += contribution;
        }
      }

      return {
        component: comp.name,
        score: totalScore,
        gapContributions: contributions,
      };
    });

    // Sort descending by score
    priorities.sort((a, b) => b.score - a.score);

    this.cachedPriorities = priorities;
    return priorities;
  }

  // ── Shard scheduling ─────────────────────────────────────────

  /**
   * Get the next unprocessed shard from the highest-priority component.
   * Reads processing_state to skip completed shards.
   */
  getNextShard(
    availableShards: Array<{ dataset: string; component: string; shardId: string }>,
  ): ScheduleEntry | null {
    if (availableShards.length === 0) return null;

    const priorities = this.cachedPriorities ?? this.scoreComponents();

    // Build a component-to-priority lookup
    const priorityMap = new Map<string, number>();
    for (const p of priorities) {
      priorityMap.set(p.component, p.score);
    }

    // Fetch completed/running shards from processing_state
    const completedRows = this.db
      .prepare(
        "SELECT dataset, component, shard_id FROM processing_state WHERE status IN ('completed', 'running')",
      )
      .all() as Array<{ dataset: string; component: string; shard_id: string }>;

    const completedSet = new Set(
      completedRows.map((r) => `${r.dataset}|${r.component}|${r.shard_id}`),
    );

    // Filter to truly available shards, then pick the one with highest component priority
    let best: ScheduleEntry | null = null;

    for (const shard of availableShards) {
      const key = `${shard.dataset}|${shard.component}|${shard.shardId}`;
      if (completedSet.has(key)) continue;

      const priority = priorityMap.get(shard.component) ?? 0;

      if (best === null || priority > best.priority) {
        best = {
          dataset: shard.dataset,
          component: shard.component,
          shardId: shard.shardId,
          priority,
          status: 'pending',
        };
      }
    }

    return best;
  }

  // ── Refresh ──────────────────────────────────────────────────

  /**
   * Update priority scores when library state changes.
   * Call after new verb-records are added or motif instances updated.
   */
  refreshPriorities(): ComponentPriority[] {
    this.cachedGaps = null;
    this.cachedPriorities = null;
    return this.scoreComponents();
  }

  // ── Per-motif gap relevance ──────────────────────────────────

  /**
   * Get gap relevance score for a specific motif.
   * Used in priority buffer scoring -- motifs in under-covered areas
   * score higher.
   */
  getGapRelevance(motifId: string): number {
    const gaps = this.cachedGaps ?? this.analyzeGaps();
    let relevance = 0;

    for (const gap of gaps) {
      if (gap.affectedMotifs.includes(motifId)) {
        relevance += gap.severity;
      }
    }

    // Also check: does this motif itself have a relationship-density gap?
    const edgeCount = (
      this.db
        .prepare(
          'SELECT COUNT(*) as cnt FROM motif_graph_edges WHERE source_motif_id = ? OR target_motif_id = ?',
        )
        .get(motifId, motifId) as { cnt: number }
    ).cnt;

    if (edgeCount < 2) {
      relevance += 0.3; // bonus for isolated motifs
    }

    return Math.min(relevance, 1.0);
  }

  // ── Private: gap finders ─────────────────────────────────────

  private findAxisVoids(): LibraryGap[] {
    const gaps: LibraryGap[] = [];

    const total = (
      this.db.prepare('SELECT COUNT(*) as cnt FROM verb_records').get() as {
        cnt: number;
      }
    ).cnt;

    if (total === 0) {
      // Everything is a gap when the library is empty -- one gap per axis
      for (const axis of AXES) {
        const motifs = INDICATOR_SETS.filter((s) => s.axis === axis).map(
          (s) => s.motifId,
        );
        gaps.push({
          type: 'axis-void',
          description: `Axis '${axis}' has no verb-records`,
          affectedMotifs: motifs,
          severity: 1.0,
        });
      }
      return gaps;
    }

    const axisRows = this.db
      .prepare(
        'SELECT process_axis, COUNT(*) as cnt FROM verb_records WHERE process_axis IS NOT NULL GROUP BY process_axis',
      )
      .all() as Array<{ process_axis: string; cnt: number }>;

    const axisCounts = new Map<string, number>();
    for (const row of axisRows) {
      axisCounts.set(row.process_axis, row.cnt);
    }

    const targetProportion = 1 / AXES.length; // ~0.333

    for (const axis of AXES) {
      const count = axisCounts.get(axis) ?? 0;
      const proportion = count / total;
      if (proportion < 0.2) {
        const deficit = targetProportion - proportion;
        const motifs = INDICATOR_SETS.filter((s) => s.axis === axis).map(
          (s) => s.motifId,
        );
        gaps.push({
          type: 'axis-void',
          description: `Axis '${axis}' under-represented (${(proportion * 100).toFixed(1)}% of records, target >${20}%)`,
          affectedMotifs: motifs,
          severity: Math.min(deficit / targetProportion, 1.0),
        });
      }
    }

    return gaps;
  }

  private findOrderVoids(): LibraryGap[] {
    const gaps: LibraryGap[] = [];
    const orders = [0, 1, 2, 3] as const;

    const total = (
      this.db.prepare('SELECT COUNT(*) as cnt FROM verb_records').get() as {
        cnt: number;
      }
    ).cnt;

    if (total === 0) {
      for (const order of orders) {
        const motifs = INDICATOR_SETS.filter(
          (s) => Math.round(s.derivativeOrder) === order,
        ).map((s) => s.motifId);
        if (motifs.length > 0) {
          gaps.push({
            type: 'order-void',
            description: `Order d${order} has no verb-records`,
            affectedMotifs: motifs,
            severity: 1.0,
          });
        }
      }
      return gaps;
    }

    const orderRows = this.db
      .prepare(
        'SELECT process_derivative_order, COUNT(*) as cnt FROM verb_records WHERE process_derivative_order IS NOT NULL GROUP BY process_derivative_order',
      )
      .all() as Array<{ process_derivative_order: number; cnt: number }>;

    const orderCounts = new Map<number, number>();
    for (const row of orderRows) {
      orderCounts.set(row.process_derivative_order, row.cnt);
    }

    for (const order of orders) {
      const count = orderCounts.get(order) ?? 0;
      const proportion = count / total;
      if (proportion < 0.1) {
        const targetProportion = 0.25;
        const deficit = targetProportion - proportion;
        const motifs = INDICATOR_SETS.filter(
          (s) => Math.round(s.derivativeOrder) === order,
        ).map((s) => s.motifId);
        if (motifs.length > 0) {
          gaps.push({
            type: 'order-void',
            description: `Order d${order} under-represented (${(proportion * 100).toFixed(1)}% of records, target >${10}%)`,
            affectedMotifs: motifs,
            severity: Math.min(deficit / targetProportion, 1.0),
          });
        }
      }
    }

    return gaps;
  }

  private findDomainCoverageGaps(): LibraryGap[] {
    const gaps: LibraryGap[] = [];

    const componentRows = this.db
      .prepare(
        'SELECT source_component, COUNT(*) as cnt FROM verb_records GROUP BY source_component',
      )
      .all() as Array<{ source_component: string; cnt: number }>;

    const coveredComponents = new Set(componentRows.map((r) => r.source_component));

    for (const comp of PILE_COMPONENTS) {
      if (!coveredComponents.has(comp.name)) {
        // Find motifs that this component would most likely contribute to,
        // based on its highest affinity order
        const bestOrder = this.bestOrderForComponent(comp);
        const motifs = INDICATOR_SETS.filter(
          (s) => orderToKey(s.derivativeOrder) === bestOrder,
        ).map((s) => s.motifId);

        gaps.push({
          type: 'domain-coverage',
          description: `Component '${comp.name}' has zero verb-records (unexplored domain)`,
          affectedMotifs: motifs,
          severity: 0.5, // moderate severity -- domain gaps are opportunities, not crises
        });
      }
    }

    return gaps;
  }

  private findRelationshipDensityGaps(): LibraryGap[] {
    const gaps: LibraryGap[] = [];

    // Get all known motif IDs from indicator sets
    const allMotifIds = INDICATOR_SETS.map((s) => s.motifId);

    // Count edges per motif
    const edgeRows = this.db
      .prepare(
        `SELECT motif_id, cnt FROM (
          SELECT source_motif_id AS motif_id, COUNT(*) AS cnt
          FROM motif_graph_edges GROUP BY source_motif_id
          UNION ALL
          SELECT target_motif_id AS motif_id, COUNT(*) AS cnt
          FROM motif_graph_edges GROUP BY target_motif_id
        ) GROUP BY motif_id`,
      )
      .all() as Array<{ motif_id: string; cnt: number }>;

    // The union-all can double-count; re-aggregate properly
    const edgeCounts = new Map<string, number>();
    for (const row of edgeRows) {
      edgeCounts.set(row.motif_id, (edgeCounts.get(row.motif_id) ?? 0) + row.cnt);
    }

    const isolated: string[] = [];
    for (const mid of allMotifIds) {
      const count = edgeCounts.get(mid) ?? 0;
      if (count < 2) {
        isolated.push(mid);
      }
    }

    if (isolated.length > 0) {
      const severity = Math.min(isolated.length / allMotifIds.length, 1.0);
      gaps.push({
        type: 'relationship-density',
        description: `${isolated.length} motif(s) have fewer than 2 graph edges: ${isolated.join(', ')}`,
        affectedMotifs: isolated,
        severity,
      });
    }

    return gaps;
  }

  // ── Private: contribution scoring ────────────────────────────

  /**
   * Compute how much a dataset component contributes to closing a gap.
   * Formula: gap.severity * component.domainAffinity[gap-related order]
   */
  private computeContribution(comp: DatasetComponent, gap: LibraryGap): number {
    switch (gap.type) {
      case 'axis-void': {
        // Map affected-motif axes to orders, pick highest affinity
        const relevantOrders = this.ordersForMotifs(gap.affectedMotifs);
        const maxAffinity = Math.max(
          ...relevantOrders.map((o) => comp.domainAffinity[o] ?? 0),
          0,
        );
        return gap.severity * maxAffinity;
      }

      case 'order-void': {
        const relevantOrders = this.ordersForMotifs(gap.affectedMotifs);
        const maxAffinity = Math.max(
          ...relevantOrders.map((o) => comp.domainAffinity[o] ?? 0),
          0,
        );
        return gap.severity * maxAffinity;
      }

      case 'domain-coverage': {
        // Domain coverage gaps: the component IS the gap target
        // Check if this component is the one that's missing
        if (gap.description.includes(comp.name)) {
          // This component fills its own domain gap perfectly
          return gap.severity * 1.0;
        }
        // Other components don't contribute to domain-specific gaps
        return 0;
      }

      case 'relationship-density': {
        // Relationship density: any component with high overall affinity
        // can help discover new edges
        const avgAffinity =
          Object.values(comp.domainAffinity).reduce((a, b) => a + b, 0) /
          Object.keys(comp.domainAffinity).length;
        return gap.severity * avgAffinity;
      }

      default:
        return 0;
    }
  }

  /** Get the unique order keys for a set of motif IDs. */
  private ordersForMotifs(motifIds: string[]): string[] {
    const orders = new Set<string>();
    for (const mid of motifIds) {
      const indicatorSet = INDICATOR_SETS.find((s) => s.motifId === mid);
      if (indicatorSet) {
        orders.add(orderToKey(indicatorSet.derivativeOrder));
      }
    }
    return [...orders];
  }

  /** Find the order key where a component has its highest affinity. */
  private bestOrderForComponent(comp: DatasetComponent): string {
    let best = 'd0';
    let bestVal = -1;
    for (const [key, val] of Object.entries(comp.domainAffinity)) {
      if (val > bestVal) {
        bestVal = val;
        best = key;
      }
    }
    return best;
  }
}
