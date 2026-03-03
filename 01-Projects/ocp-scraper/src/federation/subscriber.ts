/**
 * Federation subscriber -- fetches JSON Feeds from remote vaults and imports
 * Solution Records with provenance tagging and trust discounting.
 *
 * Trust rules:
 *   - Foreign trust vectors are multiplied by the subscription's discount factor
 *   - Default discount is 0.5 (trust halved)
 *   - allow_trust_escalation defaults to false -- foreign trust can ONLY decrease
 *   - Local re-validation can increase trust asymptotically but never to 1.0
 */

import type { SolutionRecord } from '../types/solution-record';
import type { TrustVector } from '../types/trust-vector';
import type { JSONFeed, FederationSubscription, FederationConfig } from './types';
import { computeCTS } from '../record/trust';

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

/** Result of a subscription fetch + import cycle */
export interface SubscribeResult {
  source: string;
  recordsImported: number;
  recordsUpdated: number;
  recordsSkipped: number;
  errors: string[];
}

/** A record ready to be saved to the local vault */
export interface ImportedRecord {
  record: SolutionRecord;
  /** true when the record already exists locally from this same subscription source */
  isUpdate: boolean;
}

// ---------------------------------------------------------------------------
// Feed fetching
// ---------------------------------------------------------------------------

/**
 * Fetch a JSON Feed from a URL.
 * Supports conditional fetch via ETag for bandwidth efficiency.
 */
export async function fetchFeed(
  url: string,
  etag?: string,
): Promise<{ feed: JSONFeed | null; etag?: string; notModified: boolean }> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (etag) {
    headers['If-None-Match'] = etag;
  }

  const response = await fetch(url, { headers });

  // 304 Not Modified -- nothing new since last fetch
  if (response.status === 304) {
    return { feed: null, notModified: true };
  }

  if (!response.ok) {
    throw new Error(`Feed fetch failed: ${response.status} ${response.statusText}`);
  }

  const body = await response.json();
  const feed = body as JSONFeed;

  // Basic validation: must look like a JSON Feed
  if (!feed.version || !Array.isArray(feed.items)) {
    throw new Error('Invalid JSON Feed: missing version or items array');
  }

  const responseEtag = response.headers.get('etag') ?? undefined;

  return { feed, etag: responseEtag, notModified: false };
}

// ---------------------------------------------------------------------------
// Record import
// ---------------------------------------------------------------------------

/**
 * Import records from a JSON Feed into a format ready for vault storage.
 *
 * Key behaviours:
 *   1. Only items with _ocp_record are imported (others are metadata-only)
 *   2. Provenance is tagged with source vault identity
 *   3. Trust vectors are discounted by the subscription factor
 *   4. Duplicate detection uses @id + federation.originNode to identify
 *      records that came from the same source previously
 *
 * @param feed            - The fetched JSON Feed
 * @param subscription    - The subscription config for this source
 * @param config          - The local federation config
 * @param existingRecords - Local records to check for duplicates
 */
export function importRecords(
  feed: JSONFeed,
  subscription: FederationSubscription,
  config: FederationConfig,
  existingRecords: SolutionRecord[],
): ImportedRecord[] {
  const results: ImportedRecord[] = [];

  // Index existing records by @id for O(1) lookup
  const existingById = new Map<string, SolutionRecord>();
  for (const r of existingRecords) {
    existingById.set(r['@id'], r);
  }

  // Source vault identity from the feed's _ocp extension
  const sourceVaultId = feed._ocp?.vault_id ?? 'unknown';
  const sourceVaultName = feed._ocp?.vault_name ?? subscription.name;

  // Effective discount: use per-subscription override, fall back to global default
  const discount = subscription.trust_discount ?? config.trust.default_discount;
  const allowEscalation = config.trust.allow_trust_escalation;

  for (const item of feed.items) {
    // Only import items that carry a full OCP record
    if (!item._ocp_record) continue;

    // Parse the embedded record
    let record: SolutionRecord;
    try {
      record = item._ocp_record as unknown as SolutionRecord;

      // Ensure required structure exists
      if (!record['@id'] || !record['@type'] || record['@type'] !== 'SolutionRecord') {
        continue;
      }
    } catch {
      continue;
    }

    // Check for duplicates: does a local record with this @id already exist?
    const existing = existingById.get(record['@id']);

    if (existing) {
      // If the existing record is a LOCAL record (no federation.originNode or
      // different origin), do NOT overwrite -- skip it
      const existingOrigin = existing.federation?.originNode;
      if (!existingOrigin || existingOrigin !== sourceVaultId) {
        // This is a local record or from a different source -- do not overwrite
        continue;
      }
      // Same source -- this is an update to a previously imported record
    }

    // 1. Tag provenance
    record = tagProvenance(record, sourceVaultId, sourceVaultName, subscription.url);

    // 2. Discount trust
    if (record.trust?.vector) {
      record = {
        ...record,
        trust: {
          ...record.trust,
          vector: discountTrust(record.trust.vector, discount, allowEscalation),
          trustScore: undefined, // Will be recomputed
        },
      };
      // Recompute CTS with discounted vector
      record.trust.trustScore = computeCTS(record.trust.vector);
    }

    const isUpdate = existing !== undefined && existing.federation?.originNode === sourceVaultId;

    results.push({ record, isUpdate });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Provenance tagging
// ---------------------------------------------------------------------------

/**
 * Apply provenance metadata to a foreign record.
 *
 * Sets:
 *   - federation.originNode   = source vault ID
 *   - federation.canonicalUri = feed URL
 *   - provenance.sourceType   = 'forked'
 *   - provenance.generatedBy  = updated with federation import note
 */
export function tagProvenance(
  record: SolutionRecord,
  sourceVaultId: string,
  sourceVaultName: string,
  feedUrl: string,
): SolutionRecord {
  return {
    ...record,
    federation: {
      ...record.federation,
      originNode: sourceVaultId,
      canonicalUri: feedUrl,
    },
    provenance: {
      ...record.provenance,
      sourceType: 'forked',
      generatedBy: `ocp-federation-import from ${sourceVaultName} (${sourceVaultId})`,
    },
  };
}

// ---------------------------------------------------------------------------
// Trust discounting
// ---------------------------------------------------------------------------

/**
 * Apply trust discount to a foreign record's trust vector.
 *
 * Each numeric dimension (0.0-1.0) is multiplied by discountFactor.
 * validation_count (which is an integer, not 0-1) is also scaled.
 *
 * When allowEscalation is false (default), the discount can only REDUCE
 * trust -- if discountFactor > 1.0 it's clamped to 1.0.
 *
 * @param vector          - The foreign trust vector to discount
 * @param discountFactor  - Multiplier (0.0-1.0). Default 0.5 = trust halved
 * @param allowEscalation - If false, discount can never increase any dimension
 */
export function discountTrust(
  vector: TrustVector,
  discountFactor: number,
  allowEscalation: boolean,
): TrustVector {
  // Clamp discount to valid range
  const factor = allowEscalation
    ? Math.max(0, discountFactor)
    : Math.max(0, Math.min(discountFactor, 1.0));

  const cap = (val: number, original: number): number => {
    const discounted = val * factor;
    // Cap at 1.0 for normalized dimensions
    const capped = Math.min(discounted, 1.0);
    // If escalation disallowed, never exceed original value
    if (!allowEscalation) {
      return Math.min(capped, original);
    }
    return capped;
  };

  return {
    validation_count: Math.round(vector.validation_count * factor),
    validation_diversity: cap(vector.validation_diversity, vector.validation_diversity),
    context_breadth: cap(vector.context_breadth, vector.context_breadth),
    temporal_stability: cap(vector.temporal_stability, vector.temporal_stability),
    test_coverage: cap(vector.test_coverage, vector.test_coverage),
    documentation_quality: cap(vector.documentation_quality, vector.documentation_quality),
    ...(vector.search_validation !== undefined
      ? { search_validation: cap(vector.search_validation, vector.search_validation) }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Foreign trust re-validation
// ---------------------------------------------------------------------------

/** Maximum trust level for foreign records when escalation is disallowed */
const FOREIGN_TRUST_CAP = 0.8;

/**
 * Re-validate a foreign record's trust using local validation events.
 *
 * Formula per dimension:
 *   new_trust = old_trust + (boost * (1 - old_trust))
 *
 * This asymptotically approaches 1.0 but never reaches it.
 * When allowEscalation is false, each dimension is capped at FOREIGN_TRUST_CAP.
 *
 * @param vector               - Current (discounted) trust vector
 * @param positiveValidations  - Number of positive local validation events
 * @param negativeValidations  - Number of negative local validation events
 * @param allowEscalation      - If false, cap at FOREIGN_TRUST_CAP
 */
export function revalidateForeignTrust(
  vector: TrustVector,
  positiveValidations: number,
  negativeValidations: number,
  allowEscalation: boolean,
): TrustVector {
  const total = positiveValidations + negativeValidations;
  if (total === 0) return { ...vector };

  // Compute boost from validation ratio with confidence weighting
  // Higher positive ratio = higher boost, more validations = more confidence
  const ratio = positiveValidations / total;
  const confidence = Math.min(Math.log10(total + 1) / 2, 1.0); // caps at ~100 validations
  const boost = ratio * confidence;

  // Negative validations can decrease trust
  const penalty = negativeValidations > positiveValidations
    ? (negativeValidations - positiveValidations) / total * confidence * 0.5
    : 0;

  const cap = allowEscalation ? 1.0 : FOREIGN_TRUST_CAP;

  const applyBoost = (current: number): number => {
    // Asymptotic increase: new = old + boost * (1 - old)
    let updated = current + (boost * (1 - current));
    // Apply penalty if negative validations dominate
    updated = Math.max(0, updated - penalty);
    return Math.min(Math.round(updated * 100) / 100, cap);
  };

  return {
    validation_count: vector.validation_count + positiveValidations,
    validation_diversity: applyBoost(vector.validation_diversity),
    context_breadth: applyBoost(vector.context_breadth),
    temporal_stability: applyBoost(vector.temporal_stability),
    test_coverage: applyBoost(vector.test_coverage),
    documentation_quality: applyBoost(vector.documentation_quality),
    ...(vector.search_validation !== undefined
      ? { search_validation: applyBoost(vector.search_validation) }
      : {}),
  };
}
