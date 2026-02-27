/**
 * Observer Governance Plugin — Atlas Integration Manifest Generator
 * PRD Section 6: Generates atlas-manifest.json from SCHEMA (single source of truth).
 * Atlas reads this manifest to understand vault structure, rules, and controlled vocabulary.
 */

import { App } from 'obsidian';
import { SCHEMA } from './schema';

/** PRD 6.3 — Atlas manifest structure */
export interface AtlasManifest {
  vault_version: string;
  generated_at: string;
  vault_path: string;
  schema: {
    meta_version: number;
    required_fields: readonly string[];
    enums: {
      kind: readonly string[];
      status: readonly string[];
      authority: readonly string[];
      source: readonly string[];
      confidence: readonly string[];
      mode: readonly string[];
      domain: readonly string[];
    };
    domain_max: number;
  };
  templates: Record<string, string>;
  promotion_rules: {
    human_gated: readonly string[];
    auto_allowed: readonly string[];
    demotion: string;
  };
  write_rules: {
    atlas_can_create_in: readonly string[];
    atlas_can_update_status: readonly string[];
    atlas_cannot_touch_status: readonly string[];
    atlas_default_source: string;
    atlas_default_authority: string;
  };
  memory: {
    priming_doc: string;
    foundational_principles: string;
    motif_registry: string;
  };
  folders: Record<string, string>;
}

/**
 * Derives auto-allowed transitions by excluding human-gated ones from all valid transitions.
 */
function deriveAutoAllowed(): string[] {
  const gatedSet = new Set<string>(SCHEMA.human_gated);
  const auto: string[] = [];

  for (const [from, targets] of Object.entries(SCHEMA.transitions)) {
    for (const to of targets) {
      const label = `${from}\u2192${to}`;
      if (!gatedSet.has(label)) {
        auto.push(label);
      }
    }
  }

  return auto;
}

/**
 * Generate the Atlas integration manifest from SCHEMA.
 * All enum values are read from SCHEMA — nothing is hardcoded here.
 */
export function generateManifest(app: App, vaultPath: string): AtlasManifest {
  return {
    vault_version: '1.0',
    generated_at: new Date().toISOString(),
    vault_path: vaultPath,

    schema: {
      meta_version: SCHEMA.meta_version,
      required_fields: SCHEMA.required,
      enums: {
        kind: SCHEMA.enums.kind,
        status: SCHEMA.enums.status,
        authority: SCHEMA.enums.authority,
        source: SCHEMA.enums.source,
        confidence: SCHEMA.enums.confidence,
        mode: SCHEMA.enums.mode,
        domain: SCHEMA.enums.domain,
      },
      domain_max: SCHEMA.domain_max,
    },

    templates: {
      brainstorm: '00-Inbox/_templates/T_Brainstorm.md',
      ideas_packet: '00-Inbox/_templates/T_Ideas_Packet.md',
      architecture: '00-Inbox/_templates/T_Architecture.md',
      decision: '00-Inbox/_templates/T_Decision_Record.md',
      session: '00-Inbox/_templates/T_Session_Notes.md',
      build_log: '00-Inbox/_templates/T_Build_Log.md',
      receipt: '00-Inbox/_templates/T_Receipt.md',
      policy: '00-Inbox/_templates/T_Policy.md',
      philosophy: '00-Inbox/_templates/T_Philosophy.md',
      summary: '00-Inbox/_templates/T_Summary.md',
      exit_artifact: '00-Inbox/_templates/T_Exit_Artifact.md',
    },

    promotion_rules: {
      human_gated: SCHEMA.human_gated,
      auto_allowed: deriveAutoAllowed(),
      demotion: 'any\u2192inbox (requires rationale)',
    },

    write_rules: {
      atlas_can_create_in: ['00-Inbox/'],
      atlas_can_update_status: ['inbox', 'draft'],
      atlas_cannot_touch_status: ['canonical', 'archived', 'superseded'],
      atlas_default_source: 'atlas_write',
      atlas_default_authority: 'low',
    },

    memory: {
      priming_doc: '01-Projects/observer-council/VAULT_PRIMING.md',
      foundational_principles: '02-Knowledge/FOUNDATIONAL_PRINCIPLES.md',
      motif_registry: '02-Knowledge/patterns/MOTIF_REGISTRY.md',
    },

    folders: {
      inbox: '00-Inbox/',
      projects: '01-Projects/',
      knowledge: '02-Knowledge/',
      daily: '03-Daily/',
      archive: '04-Archive/',
      dashboards: '05-Dashboards/',
    },
  };
}

/**
 * Write the manifest to the plugin's output directory.
 * Target: .obsidian/plugins/observer-governance/atlas-manifest.json
 */
export async function writeManifest(app: App, manifest: AtlasManifest): Promise<void> {
  const outputPath = '.obsidian/plugins/observer-governance/atlas-manifest.json';
  const json = JSON.stringify(manifest, null, 2);

  const adapter = app.vault.adapter;
  await adapter.write(outputPath, json);
}
