/**
 * Observer Governance Plugin — Controlled Vocabulary (Schema v1)
 * SINGLE SOURCE OF TRUTH for all enum values, validation rules, and transitions.
 * The validator checks AGAINST this. The manifest generator exports FROM this.
 */

export const SCHEMA = {
  meta_version: 1,

  required: ['meta_version', 'kind', 'status', 'authority', 'domain', 'source'] as const,

  enums: {
    kind: [
      'brainstorm',
      'ideas_packet',
      'session',
      'architecture',
      'decision',
      'plan',
      'build_log',
      'receipt',
      'policy',
      'philosophy',
      'theory',
      'exit_artifact',
      'handoff',
      'retrospective',
      'pre_mortem',
      'summary',
      'priming',
    ] as const,

    status: [
      'inbox',
      'draft',
      'review',
      'canonical',
      'archived',
      'superseded',
    ] as const,

    authority: [
      'none',
      'low',
      'medium',
      'high',
      'foundational',
    ] as const,

    domain: [
      'consciousness',
      'governance',
      'council',
      'vault',
      'infrastructure',
      'oil',
      'search',
      'coordination',
      'philosophy',
      'gaming',
      'personal',
      'geopolitics',
      'memory',
    ] as const,

    source: [
      'adam_decision',
      'claude_conversation',
      'gpt_build',
      'atlas_write',
      'vault_synthesis',
      'external_research',
      'mobile_capture',
    ] as const,

    confidence: [
      'speculative',
      'provisional',
      'tested',
      'proven',
      'foundational',
    ] as const,

    mode: [
      'explore',
      'design',
      'build',
      'review',
      'decide',
      'reflect',
    ] as const,

    promoted_by: [
      'adam',
      'atlas',
    ] as const,
  },

  domain_max: 3,

  transitions: {
    inbox: ['draft'],
    draft: ['review'],
    review: ['canonical'],
    canonical: ['archived', 'superseded'],
    archived: [] as readonly string[],
    superseded: [] as readonly string[],
  } as const,

  human_gated: [
    'review\u2192canonical',
    'canonical\u2192archived',
    'canonical\u2192superseded',
  ] as const,

  /** PRD 3.4: Authority minimum per status */
  authority_floor: {
    inbox: 'none',
    draft: 'low',
    review: 'medium',
    canonical: 'high',
    archived: null,    // unchanged
    superseded: null,  // unchanged
  } as const,

  /** Optional fields that are known but not required */
  optional_fields: [
    'confidence',
    'mode',
    'phase',
    'motifs',
    'refs',
    'created',
    'modified',
    'promoted_from',
    'promoted_date',
    'promoted_by',
    'cssclasses',
  ] as const,
} as const;

/** Type helpers */
export type Kind = typeof SCHEMA.enums.kind[number];
export type Status = typeof SCHEMA.enums.status[number];
export type Authority = typeof SCHEMA.enums.authority[number];
export type Domain = typeof SCHEMA.enums.domain[number];
export type Source = typeof SCHEMA.enums.source[number];
export type Confidence = typeof SCHEMA.enums.confidence[number];
export type Mode = typeof SCHEMA.enums.mode[number];
