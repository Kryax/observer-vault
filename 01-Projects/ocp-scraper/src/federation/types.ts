/**
 * Federation type definitions for OCP JSON Feed publishing and subscription.
 * Follows JSON Feed spec v1.1: https://jsonfeed.org/version/1.1
 */

/** JSON Feed 1.1 top-level structure */
export interface JSONFeed {
  version: string; // "https://jsonfeed.org/version/1.1"
  title: string;
  home_page_url?: string;
  feed_url?: string;
  description?: string;
  items: JSONFeedItem[];
  /** OCP extension — vault identity and publish metadata */
  _ocp?: {
    vault_id: string;
    vault_name: string;
    published_at: string;
    record_count: number;
  };
}

/** JSON Feed item -- one per Solution Record */
export interface JSONFeedItem {
  id: string; // The record @id
  title: string;
  content_text?: string; // problem statement
  summary?: string; // description
  url?: string; // source URL (e.g., GitHub repo)
  date_published?: string;
  date_modified?: string;
  tags?: string[]; // domains + keywords
  /** Attachments per JSON Feed spec */
  attachments?: Array<{
    url: string;
    mime_type: string;
    title?: string;
  }>;
  /** OCP extension: full record inline */
  _ocp_record?: Record<string, unknown>;
}

/** Federation subscription configuration */
export interface FederationSubscription {
  url: string; // Feed URL
  name: string; // Human-readable name for this source
  trust_discount: number; // 0.0-1.0, applied to imported trust vectors
  last_fetched?: string; // ISO timestamp
  etag?: string; // For conditional fetch
  enabled: boolean;
}

/** Federation configuration stored in .ocp/federation.json */
export interface FederationConfig {
  vault_id: string; // Unique ID for this vault
  vault_name: string; // Human-readable name
  publish: {
    enabled: boolean;
    output_path: string; // Default: "feed.json"
    include_full_records: boolean; // Whether to embed full records in feed
  };
  subscriptions: FederationSubscription[];
  trust: {
    default_discount: number; // Default: 0.5
    allow_trust_escalation: boolean; // Default: false -- foreign trust can never exceed local
  };
}
