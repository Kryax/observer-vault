## Observer Governance Plugin — Build Kickoff

You are starting a new project: the `observer-governance` Obsidian plugin.

### Step 1: Orientation

1. Read `CLAUDE.md` in this directory first — it has your project rules and context budgeting
2. Read `PROJECT_STATE.md` for current state
3. Read `observer-governance-prd.md` — this is **THE SPEC**. It defines everything: schema, state machine, audit format, manifest, UI, commands, and file structure

### Step 2: Create PAI PRD

Before doing ANY implementation, create a PAI PRD to track this build:

```bash
bun ~/.claude/skills/PAI/Tools/algorithm.ts new -t "Observer Governance Plugin" -e Advanced -p ./01-Projects/governance-plugin/.prd/
```

Use the ISC criteria listed below in this prompt as the basis for the PRD's criteria. These are pre-written — transfer them into the PAI PRD so the Algorithm can track and verify them in loop mode.

### Step 3: Execute

Once the PRD is registered, run in loop mode with parallel agents:

```bash
bun ~/.claude/skills/PAI/Tools/algorithm.ts -m loop -p <PRD-ID> -n 20 -a 4
```

### What You're Building

A custom Obsidian desktop plugin (TypeScript, esbuild) that handles:
- Frontmatter validation against a controlled vocabulary
- Document promotion workflow with human-gated transitions
- cssclasses auto-sync (so CSS colour coding stays current)
- Append-only JSONL audit log
- Atlas integration manifest (JSON file Atlas reads to understand the vault)
- Priming document refresh command

### Execution Strategy

**Use sub-agents.** This is a fan-out build — the modules are largely independent:

**Group 1 — Foundation (build first, others depend on it):**
- `src/schema.ts` — Controlled vocabulary as TypeScript const object. This is the single source of truth that everything else imports.

**Group 2 — Independent modules (fan-out parallel after Group 1):**
- `src/validator.ts` — Frontmatter validation logic (imports schema)
- `src/cssync.ts` — cssclasses auto-sync on file save (imports schema)
- `src/audit.ts` — JSONL audit log writer (standalone)
- `src/manifest-gen.ts` — Atlas manifest JSON generator (imports schema)
- `src/promoter.ts` — Promotion state machine with Obsidian Modal UI (imports schema, audit)
- `src/priming.ts` — VAULT_PRIMING.md regenerator (imports schema)
- `src/settings.ts` — Plugin settings tab

**Group 3 — Integration (after Group 2):**
- `src/main.ts` — Wire everything together, register commands and events
- `esbuild.config.mjs` — Build configuration
- `manifest.json` — Obsidian plugin manifest
- `styles.css` — Plugin-specific styles

**Build output** goes to: `/mnt/zfs-host/backup/projects/observer-vault/.obsidian/plugins/observer-governance/`

### ISC Criteria (Binary, Testable, Specific)

**Schema:**
- [ ] File `src/schema.ts` exports a `SCHEMA` const with all enum values matching PRD Section 2
- [ ] `SCHEMA.required` lists exactly: `meta_version`, `kind`, `status`, `authority`, `domain`, `source`
- [ ] `SCHEMA.enums.kind` contains exactly 17 values matching PRD Section 2.1
- [ ] `SCHEMA.enums.status` contains exactly 6 values: `inbox`, `draft`, `review`, `canonical`, `archived`, `superseded`
- [ ] `SCHEMA.transitions` defines valid next states per PRD Section 3.1
- [ ] `SCHEMA.human_gated` lists exactly: `review→canonical`, `canonical→archived`, `canonical→superseded`

**Validator:**
- [ ] `src/validator.ts` exports a `validateFrontmatter()` function that returns `{errors: [], warnings: []}`
- [ ] Missing required fields produce errors
- [ ] Invalid enum values produce errors
- [ ] `domain` array with >3 entries produces an error
- [ ] Fields prefixed with `x_` are ignored (no error, no warning)
- [ ] Extra fields not in schema and not prefixed `x_` produce warnings (not errors)

**cssclasses Sync:**
- [ ] `src/cssync.ts` exports a function that checks if `cssclasses` contains `status-{current_status}`
- [ ] If mismatch, it returns the corrected cssclasses array

**Audit:**
- [ ] `src/audit.ts` exports an `appendAuditEntry()` function that writes a JSON line to the audit file
- [ ] Each entry includes `ts`, `action`, and action-specific fields per PRD Section 5.2
- [ ] File is opened in append mode (not read-modify-write)

**Promoter:**
- [ ] `src/promoter.ts` implements the state machine from PRD Section 3.1
- [ ] `getNextStatus()` returns the valid next status for any given current status
- [ ] Human-gated transitions are identified correctly
- [ ] Authority auto-adjustment follows PRD Section 3.4 table
- [ ] Promotion modal extends Obsidian's `Modal` class with rationale text field

**Manifest Generator:**
- [ ] `src/manifest-gen.ts` generates JSON matching PRD Section 6.3 schema exactly
- [ ] Generated manifest includes all enum values from `schema.ts`
- [ ] Generated manifest includes template paths, promotion rules, write rules, memory paths, and folder paths

**Priming:**
- [ ] `src/priming.ts` can scan the vault for canonical documents and generate a priming summary
- [ ] Output targets `01-Projects/observer-council/VAULT_PRIMING.md`

**Settings:**
- [ ] `src/settings.ts` implements Obsidian `PluginSettingTab` with all settings from PRD Section 8
- [ ] Default values match PRD Section 8 table

**Integration:**
- [ ] `src/main.ts` registers all 7 commands from PRD Section 9
- [ ] Plugin hooks file save events for validation and cssclasses sync
- [ ] Status bar item shows validation state (✓, ⚠, ✗)
- [ ] Plugin loads and unloads cleanly in Obsidian

**Build:**
- [ ] `esbuild.config.mjs` produces a single `main.js` bundle
- [ ] `manifest.json` is valid Obsidian plugin manifest with id `observer-governance`
- [ ] Built plugin files copied to `.obsidian/plugins/observer-governance/` include: `manifest.json`, `main.js`, `styles.css`
- [ ] Plugin appears in Obsidian's Community Plugins list when vault is opened

### Files Off-Limits (Do Not Touch)
- Anything in `00-Inbox/_templates/` — templates are already built
- Anything in `05-Dashboards/` — dashboards are already built
- `.obsidian/snippets/observer-vault.css` — CSS is already built
- Any file with `status: canonical` in frontmatter

### Stop Conditions
- If you need external npm dependencies beyond Obsidian API → STOP and justify
- If the Obsidian Plugin API doesn't support something in the PRD → STOP and document the gap
- If you're unsure about any of the 6 open questions in PRD Section 13 → use the defaults noted in PROJECT_STATE.md or STOP and ask
- Do not modify any existing vault documents

### Receipts
- Write a receipt when each module is complete
- Update `PROJECT_STATE.md` at session end
- Document any design decisions in `decisions/`
