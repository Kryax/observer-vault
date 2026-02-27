# Vault Migration Brief — For Atlas

## Objective

Migrate all documents from two source locations into the new Observer Vault folder structure on the ZFS drive. Produce a migration plan for Adam's approval before moving anything.

## Target Vault

`/mnt/zfs-host/backup/projects/observer-vault/`

### New folder structure (already created):

```
00-Inbox/                    # Raw capture, new documents
  _templates/                # 12 Templater templates (already in place, DO NOT TOUCH)
  sessions/
01-Projects/
  observer-council/          # The governance framework
    architecture/
    decisions/
    milestones/
  oil/                       # OIL — completed project
    architecture/
    decisions/
    milestones/
  pai/                       # PAI execution layer
    architecture/
    decisions/
    milestones/
  vault/                     # Vault ecosystem meta-project
    architecture/
    decisions/
    milestones/
02-Knowledge/
  insights/
  theories/
  patterns/                  # Contains MOTIF_REGISTRY.md
  FOUNDATIONAL_PRINCIPLES.md
03-Daily/                    # Contains 2026-02-27.md
04-Archive/
  intake-history/            # For historical intake handoffs
05-Dashboards/               # 5 dashboard files already in place, DO NOT TOUCH
.obsidian/                   # Plugin configs, DO NOT TOUCH
```

## Source 1: ZFS Vault — Old Structure (in-place migration)

These directories exist alongside the new structure and need their contents sorted into the new folders, then the old directories removed.

### `intake/` — 22 numbered session handoffs

```
0001-2026-02-03-pai-and-opencode-setup.md
0011-2026-01-27-observer-project-handoff.md
0015-2026-01-21-council-upgrades.md
0018-2026-01-19-orchestrator-v1-wp-linkage-17.md
0020-2026-01-17-v1-council-loop.md
0022-2026-01-18-codex-to-observer-mapping.md
0024-2026-01-15-mcp-and-observer-integration.md
0025-2026-01-14-codex-cli-vs-opencode.md
0026-2026-01-14-vault-context-rule.md
0027-2026-01-14-opencode-vs-claude-code.md
0033-2026-01-12-opencode-rollback-debug.md
0034-2026-01-11-receipt-chain-handoff.md
0036-2026-01-10-observer-workspace-handoff.md
0043-2026-01-06-receipt-check-implementation-plan.md
0045-2026-01-07-receipt-handoff-confirmation.md
0046-2026-01-06-receipt-gate-v1-stabilized.md
0048-2026-01-06-observer-workspace-handoff.md
0050-2026-01-06-observer-project-handoff.md
0052-2026-01-05-observer-project-handover.md
0061-2026-01-02-opencode-repair-handoff.md
0062-2025-12-31-observer-council-project-handoff.md
0067-2025-12-05-observer-project-analysis.md
0082-2025-11-11-mcp-clarification-request.md
```

**Suggested destination:** `04-Archive/intake-history/` — these are historical session handoffs, not active documents.

### `docs/` — Governance, execution, PAI contracts

```
docs/
├── INDEX.md
├── council_loops/           (empty)
├── execution/
│   ├── builder-receipt-pack.md (+.meta)
│   ├── operational-test-failure-run.md (+.meta)
│   ├── operational-test-micro-run.md (+.meta)
│   └── work-packet-template.md (+.meta)
├── governance/
│   ├── cognitive/
│   │   ├── creative-harmony-loop.md (+.meta)
│   │   ├── creative-loop-invocation.md (+.meta)
│   │   ├── disharmony-detection.md (+.meta)
│   │   ├── state-externalisation-rule.md (+.meta)
│   │   └── whole-part-ordering.md (+.meta)
│   ├── execution/
│   │   └── council-builder-escalation-loop.md (+.meta)
│   └── vault-context-rule.md (+.meta)
├── handoffs/                (empty)
├── pai/
│   ├── consumption-contract.md (+.meta)
│   ├── context-budgeting.md (+.meta)
│   └── retrieval-policy.md (+.meta)
├── receipts_protocol/
│   └── receipt-gate-v1-stabilized.md (+.meta)
├── testing/
│   └── loop-governance-adversarial-matrix.md (+.meta)
├── tooling/                 (empty)
└── work_packets/
    └── WP-20260203-002-meta-integrity-pass.md
```

**Suggested sorting:**
- `docs/governance/cognitive/*` → `01-Projects/observer-council/architecture/` (these are council design docs)
- `docs/governance/execution/*` → `01-Projects/observer-council/architecture/`
- `docs/governance/vault-context-rule.md` → `01-Projects/vault/architecture/`
- `docs/execution/*` → `01-Projects/observer-council/architecture/` (execution templates/patterns)
- `docs/pai/*` → `01-Projects/pai/architecture/`
- `docs/receipts_protocol/*` → `01-Projects/observer-council/architecture/`
- `docs/testing/*` → `01-Projects/observer-council/architecture/`
- `docs/work_packets/*` → `04-Archive/`
- `docs/INDEX.md` → `04-Archive/` (will be superseded by dashboards)
- Empty directories (`council_loops/`, `handoffs/`, `tooling/`) → delete

### `receipts/` — Build receipts

```
receipts/
├── WP-20260203-002/         (8 receipt files)
└── intake_2026-02-03_sha256.txt
```

**Suggested destination:** `04-Archive/receipts/`

### `workspaces/pai/` — PAI workspace

```
workspaces/pai/
├── _index.md
├── _rules.md
├── drafts/          (empty)
├── inbox/
│   └── 2026-02-06_0129_hook-test.md
├── packets/         (empty)
└── stm/             (empty)
```

**Suggested sorting:**
- `_index.md` and `_rules.md` → `01-Projects/pai/architecture/`
- `inbox/2026-02-06_0129_hook-test.md` → `04-Archive/`
- Empty directories → delete

## Source 2: Temp Vault (`/home/adam/vault/`)

### `intake/` — 14 documents + templates + script

```
0083-2026-02-18-intake-smoke-test.md
Atlas Deliberation Brief -Technical Design Specification.md
IDEAS_PACKET_Observer_Relay.md
Observer Ecosystem — Multi-Engine.md
Observer Security Governance Framework.md
Observer Vault Ecosystem Spec — DRAFT.md
Observer_Ecosystem_Architecture_v2_Control_Plane.md
README.md
SEQUENCE
THE OBSERVER COMMONS.md
T_Project_CLAUDE.md
Technical_Design_Specification_v1.md
Technical_Design_Specification_v2.md
Vault_Reconstruction_Keyword_Index.md
intake.sh
v2-change-manifest.md
templates/
  intake-template.md
```

**Suggested sorting:**
- `Observer Vault Ecosystem Spec — DRAFT.md` → `01-Projects/vault/architecture/`
- `Atlas Deliberation Brief*.md` → `01-Projects/observer-council/architecture/`
- `Technical_Design_Specification_v1.md` → `01-Projects/observer-council/architecture/`
- `Technical_Design_Specification_v2.md` → `01-Projects/observer-council/architecture/`
- `Observer_Ecosystem_Architecture_v2_Control_Plane.md` → `01-Projects/observer-council/architecture/`
- `Observer Ecosystem — Multi-Engine.md` → `01-Projects/observer-council/architecture/`
- `Observer Security Governance Framework.md` → `01-Projects/observer-council/architecture/`
- `THE OBSERVER COMMONS.md` → `01-Projects/observer-council/architecture/`
- `IDEAS_PACKET_Observer_Relay.md` → `01-Projects/observer-council/architecture/`
- `T_Project_CLAUDE.md` → `00-Inbox/_templates/` (project CLAUDE.md template)
- `Vault_Reconstruction_Keyword_Index.md` → `01-Projects/vault/architecture/`
- `v2-change-manifest.md` → `01-Projects/observer-council/milestones/`
- `0083-2026-02-18-intake-smoke-test.md` → `04-Archive/`
- `README.md` → review, likely `04-Archive/`
- `SEQUENCE` → review, likely `04-Archive/`
- `intake.sh` → `04-Archive/` (old intake script)
- `templates/intake-template.md` → `04-Archive/` (superseded by new templates)

### `workspaces/observer/` — Constitutional synthesis + OIL

- `constitutional-synthesis-2026-02-10/` → Atlas should read and determine destination
- `oil/` → This is the full OIL workspace with its own git repo. **Do NOT copy into vault.** The vault references OIL, it doesn't contain it. If any OIL docs are worth preserving as vault narrative (like summaries or lessons learned), extract those specifically into `01-Projects/oil/`.

### `retrieval-policy.md` (vault root)

**Suggested destination:** `01-Projects/pai/architecture/` (likely duplicate of `docs/pai/retrieval-policy.md`)

## Rules for Atlas

1. **Plan first.** Read every document, produce a migration manifest (source → destination), and present it for Adam's approval before moving anything.
2. **Do not modify document content during migration.** Move files as-is. Frontmatter cleanup is a separate pass.
3. **Do not touch `00-Inbox/_templates/`, `05-Dashboards/`, or `.obsidian/`.** These are already configured.
4. **Check for duplicates.** If the same document exists in both source locations, keep the newer version.
5. **Preserve .meta files.** If a .md file has a corresponding .meta file, move both together.
6. **Do not copy the OIL git repo into the vault.** Reference only.
7. **After migration is approved and complete**, the old directories (`docs/`, `intake/`, `receipts/`, `workspaces/`) should be removed from the ZFS vault root to leave only the new numbered structure.
8. **Git commit after migration** with message: "vault: migrate to numbered folder structure"
