---
meta_version: 1
kind: plan
status: draft
authority: low
domain: [vault, governance]
source: claude_conversation
confidence: provisional
mode: design
created: 2026-02-27T22:30:00+11:00
modified: 2026-02-27T22:30:00+11:00
cssclasses: [status-draft]
motifs:
  - glass-box
  - sovereignty
  - control-network
refs:
  - doc_ref: Observer_Vault_Ecosystem_Spec___DRAFT.md
---

# PRD: Observer Governance Plugin (`observer-governance`)

**Purpose:** The single custom Obsidian plugin for the Observer Vault. Handles document lifecycle management, frontmatter validation, promotion workflow, audit logging, and Atlas integration — the Observer-specific governance layer that no community plugin covers.

**Principle:** Community plugins handle ~80% (templating, querying, search, git). This plugin handles the remaining 20%: lifecycle enforcement, human-gated promotion, and the audit trail that makes the vault a governed knowledge system rather than just a folder of markdown files.

**Target:** Obsidian desktop plugin (TypeScript, Obsidian Plugin API). No mobile-specific features required.

---

## 1. Scope

### 1.1 What This Plugin Does

1. **Frontmatter validation** — On file save, validates that required fields are present and use the controlled vocabulary. Flags violations in a status bar indicator and optional notice.
2. **Promotion workflow** — Command palette actions to promote documents through the lifecycle (inbox → draft → review → canonical → archived). Human-gated transitions enforced.
3. **cssclasses auto-sync** — Automatically keeps `cssclasses` in frontmatter aligned with `status`, so the CSS colour coding always reflects current lifecycle state.
4. **Audit log** — Append-only JSONL file recording all status changes, promotions, validation failures, and Atlas writes. The vault's flight recorder.
5. **Atlas integration manifest** — A generated JSON file that Atlas reads to understand the vault's schema, templates, promotion rules, and write constraints.
6. **Priming refresh** — Command to regenerate `VAULT_PRIMING.md` from current canonical documents and active project state.

### 1.2 What This Plugin Does NOT Do

- **Templating** — Templater handles this. The governance plugin validates what Templater creates.
- **Querying/dashboards** — Dataview handles this. The governance plugin provides the frontmatter that Dataview queries.
- **Semantic search** — Smart Connections handles this.
- **Git backup** — Obsidian Git handles this.
- **File creation for external tools** — The VaultBridge pattern (Atlas dropping files into `00-Inbox/`) is a filesystem convention, not plugin logic. The plugin validates what arrives.
- **Auto-template trigger** — Templater's folder template feature handles this (or manual template selection).

### 1.3 Design Constraints

- **No daemon, no server.** The plugin runs inside Obsidian only. It has no network interface.
- **Filesystem is the contract.** Atlas and other tools interact with the vault via the filesystem. The plugin reads/writes markdown files and a JSONL audit log. No IPC, no sockets.
- **Human sovereignty.** The plugin never promotes to canonical without Adam's explicit action. It never modifies canonical documents without human initiation.
- **Fail open for validation.** Validation issues are flagged, not blocked. Adam can save a document with invalid frontmatter — the plugin warns but doesn't prevent. This avoids the plugin becoming a friction point during rapid capture.

---

## 2. Controlled Vocabulary (Schema v1)

The plugin validates frontmatter against this schema. All values defined here; anything else is flagged as invalid unless prefixed with `x_` (escape hatch).

### 2.1 Required Fields

| Field | Type | Values |
|---|---|---|
| `meta_version` | integer | `1` (current) |
| `kind` | enum | `brainstorm`, `ideas_packet`, `session`, `architecture`, `decision`, `plan`, `build_log`, `receipt`, `policy`, `philosophy`, `theory`, `exit_artifact`, `handoff`, `retrospective`, `pre_mortem`, `summary`, `priming` |
| `status` | enum | `inbox`, `draft`, `review`, `canonical`, `archived`, `superseded` |
| `authority` | enum | `none`, `low`, `medium`, `high`, `foundational` |
| `domain` | array (1-3) | `consciousness`, `governance`, `council`, `vault`, `infrastructure`, `oil`, `search`, `coordination`, `philosophy`, `gaming`, `personal`, `geopolitics`, `memory` |
| `source` | enum | `adam_decision`, `claude_conversation`, `gpt_build`, `atlas_write`, `vault_synthesis`, `external_research`, `mobile_capture` |

### 2.2 Optional Fields

| Field | Type | Values |
|---|---|---|
| `confidence` | enum | `speculative`, `provisional`, `tested`, `proven`, `foundational` |
| `mode` | enum | `explore`, `design`, `build`, `review`, `decide`, `reflect` |
| `phase` | string | Freeform project phase identifier |
| `motifs` | array | Freeform slugs (e.g., `control-network`, `sovereignty`) |
| `refs` | array | Document references |
| `created` | datetime | ISO 8601 |
| `modified` | datetime | ISO 8601 |
| `promoted_from` | string | Previous file path before promotion |
| `promoted_date` | datetime | When promoted |
| `promoted_by` | enum | `adam`, `atlas` |
| `cssclasses` | array | Auto-managed by plugin, not manually edited |

### 2.3 Validation Rules

- All required fields must be present
- All enum fields must use defined values only
- `domain` must have 1-3 entries
- `meta_version` must be numeric
- Fields prefixed with `x_` are allowed and skipped during validation
- Missing optional fields are not flagged
- Extra fields not in schema and not prefixed `x_` trigger a warning (not error)

---

## 3. Promotion State Machine

### 3.1 Transitions

```
inbox → draft         : Auto-allowed (author marks as processed)
draft → review        : Auto-allowed (author marks as ready)
review → canonical    : HUMAN-GATED (Adam only)
canonical → archived  : HUMAN-GATED (Adam only)
canonical → superseded: HUMAN-GATED (requires link to replacement doc)
any → inbox           : DEMOTION (requires rationale)
```

### 3.2 Promotion Command Behaviour

When Adam invokes "Promote Document" from the command palette:

1. **Read current status** from frontmatter
2. **Determine next valid status** (inbox→draft, draft→review, review→canonical)
3. **Validate frontmatter** — all required fields must be present and valid before promotion. If validation fails, show errors and abort promotion.
4. **Check gate** — if the transition is human-gated (review→canonical, canonical→archived), show a confirmation modal:
   - Display document title, current status, target status
   - Show a text field for rationale (required for canonical promotions)
   - Confirm/Cancel buttons
5. **Apply changes:**
   - Update `status` to new value
   - Update `cssclasses` to match new status
   - Set `promoted_date` to current timestamp
   - Set `promoted_by` to `adam`
   - Set `promoted_from` to current file path (if file will move)
   - Update `modified` timestamp
   - If promoting to canonical: set `authority` to `high` (if currently lower)
6. **Move file** to appropriate folder if needed:
   - `review → canonical`: Move from current location to the appropriate project or knowledge folder (prompt Adam for destination if ambiguous)
   - Other transitions: file stays in place
7. **Write audit log entry**
8. **Trigger priming refresh** if promotion is to canonical (optional, configurable)

### 3.3 Demote Command

"Demote Document" moves any document back to `inbox` status:
- Requires rationale (text input modal)
- Sets `status: inbox`, `authority: none`
- Updates `cssclasses`
- Writes audit log entry
- Does NOT move the file (stays in current folder)

### 3.4 Authority Auto-Adjustment

When status changes, authority adjusts if the current value is inconsistent:

| New Status | Authority Minimum | Auto-adjust |
|---|---|---|
| `inbox` | `none` | Set to `none` if higher |
| `draft` | `low` | Set to `low` if `none` |
| `review` | `medium` | Set to `medium` if lower |
| `canonical` | `high` | Set to `high` if lower |
| `archived` | unchanged | Keep current authority |
| `superseded` | unchanged | Keep current authority |

---

## 4. Frontmatter Validation

### 4.1 When Validation Runs

- **On file save** — validates the saved file's frontmatter. Non-blocking (warns, doesn't prevent save).
- **On promotion** — validates before applying promotion. Blocking (must pass to promote).
- **On demand** — "Validate Document" command palette action. Shows full validation report.
- **On vault open** — optional batch validation of all documents with frontmatter (configurable, off by default to avoid slow startup).

### 4.2 Validation Output

**Status bar indicator:**
- ✓ (green) — frontmatter valid
- ⚠ (amber) — warnings (extra fields, missing optional fields)
- ✗ (red) — errors (missing required fields, invalid enum values)

**Notice on save** (configurable):
- If errors: show Obsidian notice with count of issues
- If warnings only: no notice (silent, check status bar)

**Validation report** (on-demand command):
- Modal showing all issues grouped by severity
- Each issue shows: field name, expected values, actual value

### 4.3 cssclasses Auto-Sync

On every file save, the plugin checks if `cssclasses` matches the current `status`:

- Expected: `cssclasses: [status-{current_status}]`
- If mismatch: silently update `cssclasses` to match
- This ensures the CSS colour coding always reflects the actual status, even if someone manually edits the status field

---

## 5. Audit Log

### 5.1 Format

Append-only JSONL file at `.obsidian/plugins/observer-governance/audit.jsonl`.

Each line is a self-contained JSON object:

```json
{"ts":"2026-02-27T22:30:00+11:00","action":"promote","file":"01-Projects/vault/architecture/vault-spec.md","from":"draft","to":"review","by":"adam","rationale":"Ready for review after migration complete"}
```

### 5.2 Events Logged

| Action | When | Fields |
|---|---|---|
| `promote` | Status transition | `file`, `from`, `to`, `by`, `rationale` |
| `demote` | Demotion to inbox | `file`, `from`, `to`, `by`, `rationale` |
| `validate_fail` | Validation errors on save | `file`, `errors[]` |
| `frontmatter_fix` | cssclasses auto-sync | `file`, `field`, `old`, `new` |
| `manifest_gen` | Manifest regenerated | `version`, `doc_count` |
| `priming_refresh` | Priming doc regenerated | `canonical_count`, `project_count` |

### 5.3 Audit Log Management

- File grows indefinitely (it's text, vault is on ZFS with snapshots)
- No rotation needed for Phase 1 — revisit if file exceeds 10MB
- Git tracks the file via Obsidian Git's auto-commit
- "View Audit Log" command opens the file in Obsidian (it's just markdown-compatible JSONL)

---

## 6. Atlas Integration Manifest

### 6.1 Purpose

A JSON file that Atlas reads (via filesystem) to understand the vault's expectations. Atlas doesn't need to parse the plugin code — it reads this manifest and knows exactly what frontmatter to use, what templates exist, and what the write rules are.

### 6.2 Location

`.obsidian/plugins/observer-governance/manifest.json`

Regenerated via "Regenerate Manifest" command or automatically on plugin settings change.

### 6.3 Schema

```json
{
  "vault_version": "1.0",
  "generated_at": "2026-02-27T22:30:00+11:00",
  "vault_path": "/mnt/zfs-host/backup/projects/observer-vault/",
  "schema": {
    "meta_version": 1,
    "required_fields": ["meta_version", "kind", "status", "authority", "domain", "source"],
    "enums": {
      "kind": ["brainstorm", "ideas_packet", "session", "architecture", "decision", "plan", "build_log", "receipt", "policy", "philosophy", "theory", "exit_artifact", "handoff", "retrospective", "pre_mortem", "summary", "priming"],
      "status": ["inbox", "draft", "review", "canonical", "archived", "superseded"],
      "authority": ["none", "low", "medium", "high", "foundational"],
      "source": ["adam_decision", "claude_conversation", "gpt_build", "atlas_write", "vault_synthesis", "external_research", "mobile_capture"],
      "confidence": ["speculative", "provisional", "tested", "proven", "foundational"],
      "mode": ["explore", "design", "build", "review", "decide", "reflect"],
      "domain": ["consciousness", "governance", "council", "vault", "infrastructure", "oil", "search", "coordination", "philosophy", "gaming", "personal", "geopolitics", "memory"]
    },
    "domain_max": 3
  },
  "templates": {
    "brainstorm": "00-Inbox/_templates/T_Brainstorm.md",
    "ideas_packet": "00-Inbox/_templates/T_Ideas_Packet.md",
    "architecture": "00-Inbox/_templates/T_Architecture.md",
    "decision": "00-Inbox/_templates/T_Decision_Record.md",
    "session": "00-Inbox/_templates/T_Session_Notes.md",
    "build_log": "00-Inbox/_templates/T_Build_Log.md",
    "receipt": "00-Inbox/_templates/T_Receipt.md",
    "policy": "00-Inbox/_templates/T_Policy.md",
    "philosophy": "00-Inbox/_templates/T_Philosophy.md",
    "summary": "00-Inbox/_templates/T_Summary.md",
    "exit_artifact": "00-Inbox/_templates/T_Exit_Artifact.md"
  },
  "promotion_rules": {
    "human_gated": ["review→canonical", "canonical→archived", "canonical→superseded"],
    "auto_allowed": ["inbox→draft", "draft→review"],
    "demotion": "any→inbox (requires rationale)"
  },
  "write_rules": {
    "atlas_can_create_in": ["00-Inbox/"],
    "atlas_can_update_status": ["inbox", "draft"],
    "atlas_cannot_touch_status": ["canonical", "archived", "superseded"],
    "atlas_default_source": "atlas_write",
    "atlas_default_authority": "low"
  },
  "memory": {
    "priming_doc": "01-Projects/observer-council/VAULT_PRIMING.md",
    "foundational_principles": "02-Knowledge/FOUNDATIONAL_PRINCIPLES.md",
    "motif_registry": "02-Knowledge/patterns/MOTIF_REGISTRY.md"
  },
  "folders": {
    "inbox": "00-Inbox/",
    "projects": "01-Projects/",
    "knowledge": "02-Knowledge/",
    "daily": "03-Daily/",
    "archive": "04-Archive/",
    "dashboards": "05-Dashboards/"
  }
}
```

### 6.4 Atlas Write Protocol

When Atlas creates a document in the vault:

1. Write file to `00-Inbox/` with valid frontmatter per the manifest schema
2. Set `source: atlas_write`
3. Set `status: inbox` or `status: draft`
4. Set `authority: low`
5. The governance plugin validates on next Obsidian file-watch event
6. Adam reviews, refines, promotes through the lifecycle

Atlas NEVER writes to any folder other than `00-Inbox/`. Atlas NEVER sets `status: canonical` or higher. Atlas NEVER modifies files with `status: canonical`, `archived`, or `superseded`. These constraints are documented in the manifest and enforced by convention (the plugin flags violations in the audit log but can't prevent filesystem writes from external tools).

---

## 7. Priming Refresh

### 7.1 Purpose

Regenerates `VAULT_PRIMING.md` — a condensed context document that Atlas reads at session start to understand the vault's current state.

### 7.2 Trigger

- Manual: "Refresh Priming Document" command
- Automatic: optionally after any promotion to canonical (configurable, default off)

### 7.3 Content Generation

The priming document is assembled from:

1. **Active projects** — list each project in `01-Projects/` with its most recent canonical document title and date
2. **Recent canonical promotions** — last 10 documents promoted to canonical, with title and date
3. **Hot motifs** — motifs appearing in 3+ documents modified in the last 30 days
4. **Foundational principles** — summary from `02-Knowledge/FOUNDATIONAL_PRINCIPLES.md`
5. **Vault statistics** — document counts by status, total documents, last activity

### 7.4 Output Location

`01-Projects/observer-council/VAULT_PRIMING.md` with `kind: priming`, `status: canonical`, `authority: high`, `source: vault_synthesis`.

---

## 8. Plugin Settings

Configurable via Obsidian Settings → Observer Governance:

| Setting | Default | Description |
|---|---|---|
| Validate on save | `true` | Run validation when a file is saved |
| Show notice on validation error | `true` | Display Obsidian notice for errors |
| Auto-sync cssclasses | `true` | Keep cssclasses aligned with status |
| Auto-refresh priming on promotion | `false` | Regenerate priming doc after canonical promotions |
| Audit log path | `audit.jsonl` | Relative to plugin folder |
| Excluded folders | `_templates, .obsidian` | Skip validation for these paths |

---

## 9. Command Palette Actions

| Command | Description |
|---|---|
| `Observer: Promote Document` | Advance document to next lifecycle stage |
| `Observer: Demote Document` | Return document to inbox status |
| `Observer: Validate Document` | Show full validation report for current file |
| `Observer: Validate All Documents` | Batch validation across entire vault |
| `Observer: Refresh Priming Document` | Regenerate VAULT_PRIMING.md |
| `Observer: Regenerate Manifest` | Rebuild the Atlas integration manifest |
| `Observer: View Audit Log` | Open the audit JSONL file |

---

## 10. UI Elements

### 10.1 Status Bar

Left side of Obsidian's status bar:
- Shows: `OG: ✓` (valid), `OG: ⚠ 2` (2 warnings), `OG: ✗ 3` (3 errors)
- Click opens validation report modal

### 10.2 Ribbon Icon

Optional ribbon icon (sidebar) — a shield icon that opens the governance quick menu:
- Promote
- Demote
- Validate
- View Audit

### 10.3 Promotion Modal

When promoting to a human-gated status:
- Title: "Promote to Canonical"
- Shows: document name, current status → target status
- Rationale text field (required for canonical)
- Frontmatter validation summary
- Confirm / Cancel buttons

---

## 11. Technical Implementation

### 11.1 Stack

- **Language:** TypeScript (Obsidian Plugin API)
- **Build:** esbuild (standard Obsidian plugin build)
- **Dependencies:** Obsidian API only — no external packages. Frontmatter parsing via Obsidian's built-in `processFrontMatter()`.

### 11.2 File Structure

```
observer-governance/
├── manifest.json          # Obsidian plugin manifest (not the Atlas manifest)
├── main.ts                # Plugin entry point
├── src/
│   ├── validator.ts       # Frontmatter validation logic
│   ├── promoter.ts        # Promotion state machine and file moves
│   ├── audit.ts           # JSONL audit log writer
│   ├── manifest-gen.ts    # Atlas manifest generator
│   ├── priming.ts         # Priming document generator
│   ├── cssync.ts          # cssclasses auto-sync
│   ├── schema.ts          # Controlled vocabulary definitions
│   └── settings.ts        # Plugin settings tab
├── styles.css             # Plugin-specific styles (status bar, modals)
└── esbuild.config.mjs     # Build configuration
```

### 11.3 Key Implementation Notes

- Use `this.registerEvent(this.app.vault.on('modify', ...))` to hook file saves
- Use `this.app.fileManager.processFrontMatter()` for safe frontmatter read/write
- Audit log: simple `fs.appendFileSync` (via Obsidian's adapter) to JSONL file
- Atlas manifest: write via `this.app.vault.adapter.write()` to plugin data folder
- Promotion modals: use Obsidian's `Modal` class
- Status bar: use `this.addStatusBarItem()`
- Commands: use `this.addCommand()` for command palette registration

### 11.4 Schema as Code

The controlled vocabulary (Section 2) should be defined as a TypeScript const object in `schema.ts`. This is the single source of truth that:
- The validator checks against
- The manifest generator exports from
- The promotion rules reference

```typescript
export const SCHEMA = {
  meta_version: 1,
  required: ['meta_version', 'kind', 'status', 'authority', 'domain', 'source'] as const,
  enums: {
    kind: ['brainstorm', 'ideas_packet', 'session', ...] as const,
    status: ['inbox', 'draft', 'review', 'canonical', 'archived', 'superseded'] as const,
    // ... etc
  },
  domain_max: 3,
  transitions: {
    inbox: ['draft'],
    draft: ['review'],
    review: ['canonical'],       // human-gated
    canonical: ['archived', 'superseded'],  // human-gated
    archived: [],
    superseded: [],
  },
  human_gated: ['review→canonical', 'canonical→archived', 'canonical→superseded'],
} as const;
```

---

## 12. Build & Deployment

### 12.1 Atlas Build Instructions

1. Scaffold the plugin using the Obsidian sample plugin template
2. Implement each module per the file structure in 11.2
3. Build with esbuild to produce `main.js`
4. Output goes to: `/mnt/zfs-host/backup/projects/observer-vault/.obsidian/plugins/observer-governance/`
5. Files required in the plugin folder: `manifest.json` (Obsidian), `main.js`, `styles.css`

### 12.2 Testing

- Unit test the validator against known-good and known-bad frontmatter
- Unit test the promotion state machine transitions
- Test cssclasses sync with mock frontmatter
- Manual test: create document in Inbox, promote through full lifecycle, verify audit log entries

### 12.3 Versioning

Plugin version tracks the schema version. When the controlled vocabulary changes (new `kind` values, new domains), bump both `meta_version` in the schema and the plugin version.

---

## 13. Open Questions for Adam

1. **File moves on promotion:** Should the plugin offer to move files when promoting to canonical (e.g., from `00-Inbox/` to `01-Projects/council/architecture/`)? Or should file location be managed manually?

2. **Batch validation on startup:** Should the plugin validate all documents when Obsidian opens the vault? This could be slow with 100+ documents. Alternative: validate on-demand only.

3. **Priming refresh scope:** Should priming include only canonical documents, or also include high-confidence drafts? More inclusive = richer context but less reliable.

4. **Audit log location:** `.obsidian/plugins/observer-governance/audit.jsonl` (inside plugin folder, backed up by git) or a top-level `_audit/` folder in the vault root?

5. **Superseded linking:** When marking a document as superseded, should the plugin require a link to the replacement document?

6. **Notification style:** Obsidian notice (toast popup) vs. status bar only for validation issues?

---

*This PRD defines the complete scope, behaviour, and technical approach for the observer-governance Obsidian plugin. It is designed for Atlas to build in 2-3 focused sessions. The plugin completes the vault's governance layer, bridging the gap between community plugin functionality and Observer-specific lifecycle management.*
