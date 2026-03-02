---
meta_version: 1
kind: plan
status: draft
authority: low
domain: [system-inventory]
source: atlas_write
confidence: provisional
mode: discovery
created: 2026-03-02T12:30:00+11:00
modified: 2026-03-02T12:30:00+11:00
cssclasses: [status-draft]
---

# Raw Project Inventory — Observer Ecosystem

**Generated:** 2026-03-02
**Sub-Agent:** 1 (Project & Repository Discovery)
**Scope:** All project directories, git repositories, and related infrastructure across the system

---

## 1. Top-Level Repository

### observer-vault (THE GIT REPO)

| Field | Value |
|-------|-------|
| **Location** | `/mnt/zfs-host/backup/projects/observer-vault/` |
| **Git Remote** | `https://github.com/Kryax/observer-vault.git` |
| **Current Branch** | `master` |
| **Other Branches** | `claude/relaxed-ramanujan` (local + remote), `claude/zealous-satoshi` (remote, merged) |
| **Last Commit** | `2026-02-28 16:34:47 +1100` — "vault auto-backup: 2026-02-28 16:34:47" |
| **State** | **Built / Active** |
| **Description** | The Obsidian vault and monorepo for the entire Observer ecosystem. Contains all project documentation, architecture specs, build outputs, and vault knowledge management. Auto-backed up via obsidian-git plugin. |

**Key Files:**
- `.gitignore` — excludes `.smart-env`, swap files, disk images
- `.obsidian/` — Obsidian configuration (plugins, themes, graph settings)
- `.smart-env/` — Smart Connections embedding data (git-ignored)

**Vault Structure:**
```
observer-vault/
├── 00-Inbox/          — New items, active research, system-inventory
├── 01-Projects/       — Active projects (6 project subdirectories)
├── 02-Knowledge/      — Foundational principles, patterns, insights, theories
├── 03-Daily/          — Daily notes (one entry: 2026-02-27)
├── 04-Archive/        — Historical documents, intake system, pai-workspace
├── 05-Dashboards/     — Obsidian dashboard views (5 dashboards)
├── .obsidian/         — Obsidian config and plugins
└── .smart-env/        — Smart Connections AI embeddings
```

---

## 2. Projects Within the Vault (01-Projects/)

### 2.1 Control Plane

| Field | Value |
|-------|-------|
| **Location** | `/mnt/zfs-host/backup/projects/observer-vault/01-Projects/control-plane/` |
| **Git Remote** | Part of observer-vault repo |
| **State** | **Built — Phase 1 complete, awaiting infrastructure wiring** |
| **Description** | JSON-RPC control plane and multi-engine execution dispatch layer. Central nervous system of the Observer ecosystem — accepts client connections, enforces governance policy, routes work to backend CLI tools (Claude Code, Gemini CLI, Codex CLI, Ollama), manages approvals, and maintains audit trails. |

**Build Summary:**
- 64 files, 16,754 lines of code
- 427 tests passing, 9/9 smoke test checks
- 3 npm workspace packages: `shared`, `control-plane`, `dispatch`
- Built on branch `claude/zealous-satoshi`, merged to master at commit `e915fe2` (2026-02-28)
- Setup infrastructure added via branch `claude/relaxed-ramanujan`, also merged

**Key Files:**
- `CLAUDE.md` — 9.3KB project coordination file
- `PROJECT_STATE.md` — 4.2KB current state tracker
- `architecture/control-plane-prd.md` — 40.9KB PRD (8 build slices)
- `architecture/setup-infrastructure-prd.md` — 13.9KB setup PRD
- `decisions/001-tds-v2-open-questions.md` — All Q1-Q8 resolved
- `milestones/001-control-plane-build.md`, `001-phase1-build-complete.md`, `002-setup-infrastructure.md`

**Monorepo (`observer-system/`):**
```
observer-system/
├── packages/
│   ├── shared/           — S0: Types, Zod schemas, error codes, IDs (60 tests)
│   ├── control-plane/    — S1-S5,S7: Session, policy, audit, approval, server, health (305 tests)
│   └── dispatch/         — S6: Backend executor, env sanitisation (62 tests)
├── scripts/
│   ├── smoke-test.ts     — 9-check validation
│   ├── provision-secrets.sh — Age-encrypted secrets provisioning
│   └── uninstall.sh      — Clean removal script
├── control-plane.example.yaml — Configuration template
├── execution-backends.example.yaml — Backend config template
├── observer-control-plane.service — systemd unit file
├── setup.sh              — Deployment setup script (25KB)
└── INSTALL.md            — Installation documentation (15.9KB)
```

**Tech Stack:** TypeScript, Node.js 22 LTS, npm workspaces, jayson (JSON-RPC), Zod, better-sqlite3, pino, vitest

**Worktrees:**
- `.claude/worktrees/relaxed-ramanujan/` — Setup infrastructure worktree (still present)
- Historical worktrees referenced in Claude project configs: `heuristic-aryabhata`, `pensive-chaum`, `zealous-satoshi`

---

### 2.2 Governance Plugin

| Field | Value |
|-------|-------|
| **Location** | `/mnt/zfs-host/backup/projects/observer-vault/01-Projects/governance-plugin/` |
| **Git Remote** | Part of observer-vault repo |
| **State** | **Built — plugin source complete, installed in Obsidian** |
| **Description** | Custom Obsidian plugin for the Observer Vault. Handles document lifecycle management, frontmatter validation, promotion workflow, audit logging, cssclasses auto-sync, and Atlas integration manifest generation. |

**Key Files:**
- `CLAUDE.md` — 5.6KB project instructions
- `PROJECT_STATE.md` — 2.2KB (pre-build state, may not reflect current built state)
- `observer-governance-prd.md` — 22.5KB full PRD
- `ATLAS_BUILD_PROMPT.md` — 6.7KB build instructions
- `manifest.json`, `package.json`, `tsconfig.json`, `esbuild.config.mjs` — Build configuration
- `styles.css` — Plugin styles

**Source (`src/`):**
```
src/
├── main.ts           — 18.6KB plugin entry point
├── validator.ts      — 6.3KB frontmatter validation
├── promoter.ts       — 7.3KB promotion state machine
├── audit.ts          — 3.4KB JSONL audit log writer
├── manifest-gen.ts   — 4.6KB Atlas manifest generator
├── priming.ts        — 9.2KB priming document generator
├── cssync.ts         — 2.7KB cssclasses auto-sync
├── schema.ts         — 3.1KB controlled vocabulary (SINGLE SOURCE OF TRUTH)
└── settings.ts       — 4.2KB plugin settings tab
```

**Installed in Obsidian:** Yes — listed in `.obsidian/community-plugins.json` as `observer-governance` and present at `.obsidian/plugins/observer-governance/`

**Sub-project (`observer-commons/`):**
```
observer-commons/
├── 00-observer-commons-protocol.md   — 37.6KB
├── 01-schema-spec.md                 — 60.5KB
├── 02-federation-spec.md             — 50.2KB
├── 03-trust-spec.md                  — 45.5KB
└── 04-composition-spec.md            — 63.7KB
```
This appears to be a substantial protocol specification for federated solution sharing — created 2026-03-01.

---

### 2.3 Observer Council

| Field | Value |
|-------|-------|
| **Location** | `/mnt/zfs-host/backup/projects/observer-vault/01-Projects/observer-council/` |
| **Git Remote** | Part of observer-vault repo |
| **State** | **Specified — rich architecture documentation, no executable code** |
| **Description** | Multi-agent governance framework. The deliberative body that produced the Technical Design Specifications (TDS v1 and v2) for the control plane. Contains the constitutional and architectural thinking that drives the ecosystem. |

**Key Files (architecture/ — 41 files, very large):**
- `Technical_Design_Specification_v2.md` — **220.6KB** — the full TDS
- `Technical_Design_Specification_v1.md` — 195.4KB — earlier version
- `OBSERVER_CONSTITUTION_DRAFT.md` — 37.1KB
- `POST_CONSTITUTION_ARCHITECTURAL_RESEARCH.md` — 38.3KB
- `Observer_Ecosystem_Architecture_v2_Control_Plane.md` — 26.8KB
- `Observer_Ecosystem_Multi-Engine.md` — 27.1KB
- `Observer_Security_Governance_Framework.md` — 14.6KB
- `THE_OBSERVER_COMMONS.md` — 18.1KB
- `PRINCIPLE_EXTRACTION_LOG.tsv` — 23.2KB
- `AMBIGUITY_REGISTER.md` — 15.8KB
- `CONFLICT_REGISTER.md` — 11.3KB
- `IDEAS_PACKET_Observer_Relay.md` — 19.0KB
- Various operational patterns, loop definitions, and .meta files from earlier work

**Milestones:**
- `v2-change-manifest.md` — 21.2KB changes from v1 to v2
- `experiment-1/`, `experiment-3/` — Experimental council outputs

**Decisions:** Empty directory (decisions were captured in architecture docs and control-plane project)

---

### 2.4 OIL (Observer Integration Layer)

| Field | Value |
|-------|-------|
| **Location (vault docs)** | `/mnt/zfs-host/backup/projects/observer-vault/01-Projects/oil/` |
| **Location (codebase)** | `/home/adam/vault/workspaces/observer/oil/` |
| **Git Remote** | `git@github.com:Kryax/oil.git` |
| **Current Branch** | `main` |
| **Other Branches** | `claude/admiring-fermat`, `claude/agitated-feynman`, `claude/elastic-ride`, `claude/gallant-booth`, `claude/gracious-wilbur`, `claude/interesting-lichterman`, `claude/musing-galileo`, plus worktree agent branches |
| **Last Commit** | `2026-02-25 00:39:37 +1100` — "docs: update README to reflect OIL complete state" |
| **State** | **Built / Complete (MVI)** |
| **Description** | Drift-resistant governance layer between human operator (Adam) and AI executor (Atlas/PAI). Enforces tiered boundaries on what AI can read, invoke, and modify. |

**Completion Status:**
- MVI (Minimum Viable Integration): Complete (5/5 stages)
- Tier-1 (Read-Only): 4 scripts operational
- Tier-2 (Invoke with Wrappers): 6/6 approved tools wrapped
- Tier-3 (Governed Modifications): Active governance via exit artifacts (11 exits processed)
- Event Capture: OILEventBridge hook operational
- Pre-Commit Gates: Secret scan + T3 receipt validation + auto-indexing

**Key Files:**
- `CLAUDE.md` — Session context instructions
- `README.md` — Project overview and current state
- `config.yml` — Repo path declarations (no secrets)
- `BOUNDARY_RULES.md`, `CATEGORIES.md`, `CATEGORY_FLOW.md`, `MODULE_MAP.md`

**Scripts (21 operational scripts):**
- `oil_status.sh`, `oil_review_brief.sh`, `oil_index.sh`, `oil_hygiene.sh`
- Tier-2 wrappers: `oil_t2_inference.sh`, `oil_t2_secretscan.sh`, `oil_t2_harvester.sh`, `oil_t2_activityparser.sh`, `oil_t2_extracttranscript.sh`, `oil_t2_learningpattern.sh`
- `oil_events_rotate.sh`, `oil_receipt_rotate.sh`, `oil_secretgate_staged.sh`, `capture-summary.sh`
- `switch_verify.sh`, `oil_hook_install.sh`, `oil_isc_latest.sh`, `oil_isc_diff.sh`
- `oil_t3_receipt_check.sh`

**Governance Docs (docs/ — 19 files):**
- `TIER_BOUNDARIES.md`, `TIER2_INVOCATION_CONTRACT.md`, `TIER3_MODIFICATION_CONTRACT.md`
- `OIL_USAGE_GUIDE.md`, `ATLAS_SECRETS_CONTRACT.md`, `SECRETS_POLICY.md`
- `SESSION_IDENTITY_POLICY.md`, `EVENTS_RETENTION_POLICY.md`, `RECEIPT_POLICY.md`
- `INDEX.md` — Auto-generated docs index

**Exit Artifacts (11):**
- exit-001 through exit-011 covering OIL scaffold, module map, category model, tier-2 wrapper hygiene, tier-3 governance, various fixes, PAI v3 migration, algorithm tracker, PAI decoupling

**Receipts:** 16+ receipt files documenting build milestones

**Vault-side (`01-Projects/oil/`):** Contains only `architecture/` and `decisions/` directories, both empty. The project lives in its own git repo, not in the vault.

---

### 2.5 PAI (Personal AI Infrastructure)

| Field | Value |
|-------|-------|
| **Location (vault docs)** | `/mnt/zfs-host/backup/projects/observer-vault/01-Projects/pai/` |
| **Location (installation)** | `/home/adam/.claude/` |
| **Git Remote** | Upstream: `github.com/danielmiessler/PAI` (source) — installed locally, not a git clone |
| **State** | **Built / Installed / Active — PAI v3.0** |
| **Description** | Personal AI Infrastructure — the operational framework that wraps Claude Code with skills, hooks, agents, memory system, voice server, and custom tooling. The execution engine of the Observer ecosystem. |

**Version Info (from `.ACTIVE_VERSION`):**
```
PAI_VERSION=3.0
ALGORITHM_VERSION=1.4.0
SWITCH_MODEL=symlink
CREATED=2026-02-20T00:00:00+11:00
NOTE=Fresh v3.0 install with settings merged from v2.5.
```

**Vault-side (`01-Projects/pai/`):**
- `architecture/` — 10 files including consumption-contract, context-budgeting, retrieval-policy, pai-workspace-index, pai-workspace-rules (and .meta files)
- `decisions/` — 3 files: creative-loops-unresolved-conflicts, reconciliation-creative-loops, structural-disharmony-detection
- `milestones/` — empty

See Section 3 below for full PAI installation inventory.

---

### 2.6 Vault (Project)

| Field | Value |
|-------|-------|
| **Location** | `/mnt/zfs-host/backup/projects/observer-vault/01-Projects/vault/` |
| **State** | **Specified — architecture documentation, no executable code** |
| **Description** | Documentation and architecture for the Observer Vault itself — the Obsidian knowledge management system design and specification. |

**Key Files:**
- `architecture/Observer_Vault_Ecosystem_Spec_DRAFT.md` — 50.7KB — the vault ecosystem specification
- `architecture/vault-context-rule.md` + `.meta`
- `architecture/Vault_Reconstruction_Keyword_Index.md` — 8.4KB keyword index
- `decisions/` — empty
- `milestones/` — empty

---

## 3. PAI Installation (`~/.claude/`)

### 3.1 Overview

| Field | Value |
|-------|-------|
| **Location** | `/home/adam/.claude/` |
| **Version** | PAI v3.0, Algorithm v1.4.0 |
| **Previous Versions** | v2.5 at `~/.claude-v25/`, v3.0-pre at `~/.claude-v3/`, pre-PAI at `~/.claude.old-20260208-160837/` |
| **State** | **Installed / Active** |
| **Description** | Complete PAI infrastructure installation with skills, hooks, agents, memory, voice server, plugins, and extensive configuration. |

### 3.2 Directory Structure

```
~/.claude/
├── .ACTIVE_VERSION          — PAI + Algorithm version tracking
├── CLAUDE.md                — Root instruction (redirects to skills/PAI/SKILL.md)
├── README.md                — PAI overview and install instructions
├── install.sh               — PAI installer script
├── settings.json            — 24.8KB, 938 lines — Claude Code configuration
├── statusline-command.sh    — 70KB statusline rendering script
├── .credentials.json        — Credentials (DO NOT READ)
├── .env                     — Environment vars (DO NOT READ)
├── history.jsonl            — Session history
├── mcp-needs-auth-cache.json — MCP auth cache
├── security_warnings_state_*.json — Security warning state
│
├── agents/                  — 13 named agent configurations
│   ├── Algorithm.md, Architect.md, Artist.md
│   ├── ClaudeResearcher.md, CodexResearcher.md
│   ├── Designer.md, Engineer.md
│   ├── GeminiResearcher.md, GrokResearcher.md
│   ├── Intern.md, Pentester.md
│   ├── PerplexityResearcher.md, QATester.md
│
├── bin/                     — 9 custom CLI tools
│   ├── detect-mouse-buttons, pai-mouse-daemon
│   ├── stt-toggle, voice-open, voice-replay
│   ├── voice-stop, voice-toggle, vtt-toggle
│
├── hooks/                   — 21 lifecycle event hooks
│   ├── AgentExecutionGuard.hook.ts
│   ├── AlgorithmTracker.hook.ts
│   ├── AutoWorkCreation.hook.ts
│   ├── CheckVersion.hook.ts
│   ├── IntegrityCheck.hook.ts
│   ├── LoadContext.hook.ts
│   ├── OILEventBridge.hook.ts
│   ├── QuestionAnswered.hook.ts
│   ├── RatingCapture.hook.ts
│   ├── RelationshipMemory.hook.ts
│   ├── SecurityValidator.hook.ts
│   ├── SessionAutoName.hook.ts
│   ├── SessionSummary.hook.ts
│   ├── SetQuestionTab.hook.ts
│   ├── SkillGuard.hook.ts
│   ├── StartupGreeting.hook.ts
│   ├── StopOrchestrator.hook.ts
│   ├── UpdateCounts.hook.ts
│   ├── UpdateTabTitle.hook.ts
│   ├── VoiceGate.hook.ts
│   ├── WorkCompletionLearning.hook.ts
│   ├── handlers/          — 7 handler modules
│   │   ├── AlgorithmEnrichment.ts, DocCrossRefIntegrity.ts
│   │   ├── RebuildSkill.ts, SystemIntegrity.ts
│   │   ├── TabState.ts, UpdateCounts.ts, VoiceNotification.ts
│   └── lib/               — 11 shared libraries
│       ├── algorithm-state.ts, change-detection.ts
│       ├── identity.ts, learning-utils.ts
│       ├── metadata-extraction.ts, notifications.ts
│       ├── output-validators.ts, paths.ts
│       ├── tab-constants.ts, tab-setter.ts, time.ts
│
├── skills/                  — 40 skill directories
│   ├── Agents, AnnualReports, Aphorisms, Apify, Art
│   ├── BeCreative, BrightData, Browser, Cloudflare, CORE
│   ├── Council, CreateCLI, CreateSkill, Documents, Evals
│   ├── ExtractWisdom, Fabric, FirstPrinciples, IterativeDepth
│   ├── OSINT, PAI (core — 29 files, 908 bytes dir entry)
│   ├── PAIUpgrade, Parser, PrivateInvestigator, Prompting
│   ├── PromptInjection, Recon, RedTeam, Remotion, Research
│   ├── Sales, Science, SECUpdates, Telos, USMetrics
│   ├── WebAssessment, WorldThreatModelHarness, WriteStory
│
├── PAI-Install/             — Installation engine
│   ├── cli/, electron/, engine/, web/, public/
│   ├── main.ts, generate-welcome.ts, install.sh
│   ├── README.md, .gitignore
│
├── MEMORY/                  — Unified Memory System (v7.0)
│   ├── README.md            — Memory architecture documentation
│   ├── STATE/               — Runtime state (caches, current work, algorithm states)
│   │   ├── algorithms/      — 4 algorithm state JSON files
│   │   ├── current-work.json, model-cache.txt, session-names.json
│   │   ├── git-cache_*.sh   — Git state caches for known repos
│   │   └── (15+ state files)
│   ├── WORK/                — Work tracking (40+ work directories)
│   ├── LEARNING/            — Derived insights
│   │   ├── ALGORITHM/, FAILURES/, REFLECTIONS/, SIGNALS/, SYSTEM/
│   ├── RELATIONSHIP/        — Relationship memory (monthly dirs)
│   ├── RESEARCH/            — Agent output captures (monthly dirs)
│   ├── SECURITY/            — Security audit events
│   └── VOICE/               — Voice event log (34KB JSONL)
│
├── VoiceServer/             — ElevenLabs TTS service
│   ├── server.ts            — 26KB voice server implementation
│   ├── voices.json, pronunciations.json
│   ├── install.sh, start.sh, stop.sh, restart.sh, status.sh, uninstall.sh
│   └── menubar/             — System tray integration
│
├── plugins/                 — Claude Code plugin system
│   ├── installed_plugins.json — 6 plugins installed
│   ├── blocklist.json, known_marketplaces.json
│   ├── cache/, .install-manifests/, marketplaces/
│
├── voice/                   — Voice recording storage (monthly dirs + dev/)
├── projects/                — Claude Code per-project configs (20+ project dirs)
├── tasks/                   — Task tracking (17 task session dirs)
├── todos/                   — Todo items (1000+ agent todo files)
├── teams/                   — Agent teams (empty — experimental feature enabled)
├── session-env/             — Session environment snapshots
├── shell-snapshots/         — Shell state captures
├── paste-cache/             — Clipboard paste history
├── debug/                   — Debug logs
├── backups/                 — Configuration backups
├── file-history/            — File change tracking
├── cache/                   — General cache
└── lib/migration/           — Version migration scripts
```

### 3.3 Installed Plugins

| Plugin | Source | Version | Installed |
|--------|--------|---------|-----------|
| cowork-plugin-management | knowledge-work-plugins | 0.2.2 | 2026-02-27 |
| claude-md-management | claude-plugins-official | 1.0.0 | 2026-02-27 |
| context7 | claude-plugins-official | 55b58ec | 2026-02-27 |
| security-guidance | claude-plugins-official | 55b58ec | 2026-02-27 |
| frontend-design | claude-plugins-official | 55b58ec | 2026-02-27 |
| skill-creator | claude-plugins-official | 55b58ec | 2026-02-27 |

### 3.4 PAI Core Skill (`skills/PAI/`)

The PAI core skill is the largest and most important skill module — 29 files documenting the entire system:

| File | Size | Purpose |
|------|------|---------|
| `SKILL.md` | 86KB | Master system documentation |
| `SKILLSYSTEM.md` | 35KB | Skill system architecture |
| `PAISYSTEMARCHITECTURE.md` | 20KB | PAI system architecture |
| `MEMORYSYSTEM.md` | 17KB | Memory system documentation |
| `DEPLOYMENT.md` | 28KB | Deployment documentation |
| `CLIFIRSTARCHITECTURE.md` | 19KB | CLI-first design principles |
| `FEEDSYSTEM.md` | 14KB | Feed system (data ingestion) |
| `CLI.md` | 14KB | CLI documentation |
| `PIPELINES.md` | 14KB | Pipeline architecture |
| `FLOWS.md` | 13KB | Flow system |
| `ACTIONS.md` | 11KB | Action system |
| `PAIAGENTSYSTEM.md` | 7KB | Agent system |
| `ARBOLSYSTEM.md` | 7KB | Arbol system |
| `THEDELEGATIONSYSTEM.md` | 6KB | Delegation patterns |
| `TERMINALTABS.md` | 6KB | Terminal tab management |
| `SYSTEM_USER_EXTENDABILITY.md` | 8KB | Extensibility docs |
| `DOCUMENTATIONINDEX.md` | 6KB | Documentation index |
| `AISTEERINGRULES.md` | 5KB | AI steering rules |
| `BROWSERAUTOMATION.md` | 2KB | Browser automation |
| `THEFABRICSYSTEM.md` | 3KB | Fabric integration |
| Plus: Components/, ACTIONS/, FLOWS/, PIPELINES/, PAISECURITYSYSTEM/ subdirs |

---

## 4. Inbox Projects (00-Inbox/)

### 4.1 Great Transition Research

| Field | Value |
|-------|-------|
| **Location** | `/mnt/zfs-host/backup/projects/observer-vault/00-Inbox/great-transition-research/` |
| **State** | **Built / Complete — all 4 streams delivered** |
| **Description** | Four-stream research and analysis project exploring where Adam's Observer ecosystem aligns with the emerging "Great Transition" in AI, software, and labour markets. |

**Key Files:**
- `CLAUDE.md` — 6.3KB research project instructions
- `Atlas_Research_Brief_Great_Transition.md` — 14KB seed document
- `Stream1_Adoption_Patterns.md` — 111.5KB (retrospective analysis of 15-20 successful projects)
- `Stream2_Landscape_Map.md` — 53.3KB (current state of service directories and governance tools)
- `Stream3_Opportunity_Synthesis.md` — 69.6KB (merged opportunity analysis)
- `Stream4_OpenSource_Energy.md` — 79.8KB (open-source energy dynamics)
- `Creative_Methodology_Skill_Spec.md` — 13.2KB (derived skill specification)

---

### 4.2 System Inventory (This Project)

| Field | Value |
|-------|-------|
| **Location** | `/mnt/zfs-host/backup/projects/observer-vault/00-Inbox/system-inventory/` |
| **State** | **In Progress** |
| **Description** | Complete mapping of the Observer ecosystem — every project, tool, config, and integration point. Discovery only. |

**Key Files:**
- `CLAUDE.md` — Project instructions
- `atlas_inventory_prompt.md` — Orchestration prompt
- `files.zip` — Supporting files

---

## 5. External Git Repositories

### 5.1 OIL (Separate Repo)

Covered in Section 2.4 above. Lives at `/home/adam/vault/workspaces/observer/oil/` with its own git repo at `git@github.com:Kryax/oil.git`.

### 5.2 pai-brain

| Field | Value |
|-------|-------|
| **Location** | `/mnt/zfs-host/backup/projects/pai-brain/` |
| **Git Remote** | None detected (no `.git` directory found — not a git repo) |
| **State** | **Abandoned / Superseded** |
| **Description** | Early PAI brain architecture — identity, policies, receipts, spec, templates. Only the `policies/` directory has content (3 files: consumption-contract, context-budgeting, retrieval-policy). All other directories are empty. These policies were later migrated to the Observer Vault's PAI project and OIL governance docs. |

**Key Files:**
- `policies/consumption-contract.md` — 2.1KB
- `policies/context-budgeting.md` — 850B
- `policies/retrieval-policy.md` — 1.1KB
- `identity/`, `receipts/`, `spec/`, `templates/` — all empty

---

## 6. Local Vault Workspaces (`~/vault/`)

### 6.1 Overview

| Field | Value |
|-------|-------|
| **Location** | `/home/adam/vault/` |
| **State** | **Active working area — contains OIL repo and historical workspaces** |
| **Description** | Local vault with Obsidian configuration, intake system, and workspace directories. Appears to be the original vault location before the NFS-backed observer-vault was established. |

**Structure:**
```
~/vault/
├── .obsidian/         — Separate Obsidian config (not the same vault)
├── intake/            — Document intake system (18 files, including migration manifest)
├── retrieval-policy.md — Empty file
└── workspaces/
    ├── observer/
    │   ├── constitutional-synthesis-2026-02-10/ — Constitutional research workspace
    │   └── oil/                                 — OIL git repository (see Section 2.4)
    └── pai/
        ├── drafts/
        ├── inbox/
        ├── _index.md
        └── packets/
```

### 6.2 Constitutional Synthesis Workspace

| Field | Value |
|-------|-------|
| **Location** | `/home/adam/vault/workspaces/observer/constitutional-synthesis-2026-02-10/` |
| **State** | **Complete / Historical** |
| **Description** | Output of the constitutional synthesis experiment (2026-02-10). Contains principle extraction, ambiguity/conflict registers, constitution draft, and experiments. This content was later migrated to the Observer Vault's observer-council project. |

**Key Files:**
- `OBSERVER_CONSTITUTION_DRAFT.md` — 37.1KB
- `POST_CONSTITUTION_ARCHITECTURAL_RESEARCH.md` — 38.3KB
- `PRINCIPLE_EXTRACTION_LOG.tsv` — 23.2KB
- `AMBIGUITY_REGISTER.md` — 15.8KB
- `CONFLICT_REGISTER.md` — 11.3KB
- `EXPERIMENT_PLAN.md` — 10.4KB
- `SYNTHESIS_RECEIPT.md` — 9.1KB
- `experiment-1/`, `experiment-3/` — Experimental outputs

### 6.3 Vault Intake System

| Field | Value |
|-------|-------|
| **Location** | `/home/adam/vault/intake/` |
| **State** | **Active — document intake pipeline** |
| **Description** | Intake system for processing documents into the vault. Contains migrated architecture docs, TDS versions, and a migration manifest. |

**Notable Contents (19 files):**
- `MIGRATION_MANIFEST.md` — 27.4KB migration tracking
- `Technical_Design_Specification_v1.md` — 195.4KB
- `Technical_Design_Specification_v2.md` — 220.6KB
- `Observer Vault Ecosystem Spec — DRAFT.md` — 50.7KB
- `Observer_Ecosystem_Architecture_v2_Control_Plane.md` — 26.8KB
- `intake.sh` — Intake processing script
- `T_Project_CLAUDE.md` — Template for project CLAUDE.md files
- `Atlas_Migration_Prompt.md` — Migration instructions

---

## 7. Previous PAI Versions

### 7.1 PAI v2.5

| Field | Value |
|-------|-------|
| **Location** | `/home/adam/.claude-v25/` |
| **State** | **Archived — superseded by v3.0** |
| **Description** | Previous PAI version. Contains project configs referencing the OIL workspace. |

### 7.2 PAI v3.0-pre (intermediate)

| Field | Value |
|-------|-------|
| **Location** | `/home/adam/.claude-v3/` |
| **State** | **Archived — intermediate version before current v3.0** |
| **Description** | Intermediate PAI version with full directory structure similar to current. Contains agents, hooks, skills, memory, voice, plugins, and extensive project configs for OIL worktrees. |

### 7.3 Pre-PAI Backup

| Field | Value |
|-------|-------|
| **Location** | `/home/adam/.claude.old-20260208-160837/` |
| **State** | **Archived — earliest backup** |
| **Description** | Backup taken on 2026-02-08 before PAI installation. Contains agents, hooks, file-history, debug logs. Represents the raw Claude Code configuration before PAI was installed. |

---

## 8. Obsidian Plugins (Vault)

Installed in `/mnt/zfs-host/backup/projects/observer-vault/.obsidian/plugins/`:

| Plugin | Purpose |
|--------|---------|
| `observer-governance` | Custom plugin — document lifecycle, frontmatter validation, promotion (built in this ecosystem) |
| `obsidian-git` | Auto-backup to git (the auto-backup commits in git log) |
| `smart-connections` | AI-powered semantic search and connections |
| `templater-obsidian` | Template engine |
| `dataview` | Data queries and views |
| `auto-template-trigger` | Automatic template application |

**CSS Snippet:** `observer-vault.css` — 1.7KB custom styling

**Templates (14):** Located at `00-Inbox/_templates/`:
- `T_Architecture.md`, `T_Brainstorm.md`, `T_Build_Log.md`
- `T_Decision_Record.md`, `T_Exit_Artifact.md`, `T_Ideas_Packet.md`
- `T_Philosophy.md`, `T_Plan.md`, `T_Policy.md`
- `T_Project_CLAUDE.md`, `T_Receipt.md`, `T_Session_Notes.md`
- `T_Summary.md`, `Vault_Safety_Header.md`

---

## 9. Non-Observer Repos (Context Only)

These are AUR package caches and a yay build, not Observer ecosystem projects. Documented for completeness:

| Repo | Location | Purpose |
|------|----------|---------|
| `yay` | `/home/adam/yay/` | AUR helper build (v12.5.7, from aur.archlinux.org) |
| `claude-desktop-bin` | `~/.cache/yay/claude-desktop-bin/` | AUR package for Claude Desktop (v1.1.4498) |
| `claude-cowork-service` | `~/.cache/yay/claude-cowork-service/` | AUR package for Claude Cowork Service (v1.0.9) |
| `electron25` | `~/.cache/yay/electron25/` | AUR Electron build |
| `nodejs-lts-hydrogen` | `~/.cache/yay/nodejs-lts-hydrogen/` | AUR Node.js LTS build |
| `input-remapper` | `~/.cache/yay/input-remapper/` | AUR input remapper build |

**Note:** The `claude-cowork-service` and `claude-desktop-bin` packages indicate Claude Desktop and Cowork are installed on this CachyOS system.

---

## 10. Vault Knowledge & Archive

### 10.1 Knowledge Base (`02-Knowledge/`)

```
02-Knowledge/
├── FOUNDATIONAL_PRINCIPLES.md   — 559B foundational principles
├── insights/                     — Empty
├── patterns/
│   └── MOTIF_REGISTRY.md        — 1.1KB motif definitions
└── theories/                     — Empty
```

**State:** Scaffolded — minimal content so far.

### 10.2 Dashboards (`05-Dashboards/`)

| File | Size |
|------|------|
| `Atlas_Activity.md` | 485B |
| `Memory_Health.md` | 587B |
| `Motif_Tracker.md` | 797B |
| `Status_Board.md` | 979B |
| `Vault_Home.md` | 563B |

### 10.3 Archive (`04-Archive/`)

```
04-Archive/
├── Atlas_Migration_Prompt.md        — 2.3KB
├── docs-INDEX.md                    — 986B
├── intake-history/                  — Historical intake logs
├── intake-README.md                 — 2.4KB
├── intake-SEQUENCE                  — 3B sequence counter
├── intake.sh                        — 1.1KB intake script
├── intake-template.md               — 205B
├── pai-workspace/                   — PAI workspace archive
├── receipts/                        — Historical receipts
└── WP-20260203-002-meta-integrity-pass.md — 1.1KB
```

---

## 11. Cross-Reference: Integration Points

The Observer ecosystem connects through several key integration seams:

| Integration | From | To | Mechanism |
|-------------|------|----|-----------|
| OIL Event Bridge | PAI hooks (`OILEventBridge.hook.ts`) | OIL event capture | NDJSON event stream |
| Vault Auto-Backup | Obsidian (`obsidian-git` plugin) | GitHub (`Kryax/observer-vault.git`) | Periodic git commits |
| Governance Plugin | Obsidian (`observer-governance` plugin) | Vault frontmatter | Runtime validation + promotion |
| PAI Skills → Claude Code | `~/.claude/skills/PAI/SKILL.md` | Claude Code sessions | CLAUDE.md → skill loading |
| OIL Config → Repos | `config.yml` | `~/vault/workspaces/observer/`, `~/.claude/skills/PAI/` | Path declarations |
| Control Plane → Dispatch | `observer-system/packages/control-plane/` | `observer-system/packages/dispatch/` | npm workspace imports |
| Vault Templates | `00-Inbox/_templates/` | Document creation | Templater plugin |
| Smart Connections | `.smart-env/` | Vault content | Embedding-based search |
| Claude Code Projects | `~/.claude/projects/` | Per-directory configs | Automatic context loading |

---

## 12. State Summary

| Project | Location | State | Last Activity |
|---------|----------|-------|---------------|
| **observer-vault** | `/mnt/zfs-host/backup/projects/observer-vault/` | Active (git repo) | 2026-02-28 |
| **Control Plane** | `01-Projects/control-plane/` | Built (Phase 1 complete) | 2026-02-28 |
| **Governance Plugin** | `01-Projects/governance-plugin/` | Built + Installed | 2026-02-28 |
| **Observer Council** | `01-Projects/observer-council/` | Specified (docs only) | 2026-02-27 |
| **OIL** | `/home/adam/vault/workspaces/observer/oil/` | Built / Complete (MVI) | 2026-02-25 |
| **PAI** | `/home/adam/.claude/` | Installed / Active (v3.0) | 2026-03-02 (daily use) |
| **Vault (project)** | `01-Projects/vault/` | Specified (docs only) | 2026-02-27 |
| **Great Transition Research** | `00-Inbox/great-transition-research/` | Complete | 2026-03-02 |
| **System Inventory** | `00-Inbox/system-inventory/` | In Progress | 2026-03-02 |
| **Observer Commons** | `01-Projects/governance-plugin/observer-commons/` | Specified (5 spec docs) | 2026-03-01 |
| **pai-brain** | `/mnt/zfs-host/backup/projects/pai-brain/` | Abandoned / Superseded | 2026-02-05 |
| **Constitutional Synthesis** | `~/vault/workspaces/observer/constitutional-synthesis-2026-02-10/` | Complete / Archived | 2026-02-10 |
| **PAI v2.5** | `/home/adam/.claude-v25/` | Archived | 2026-02-20 |
| **PAI v3.0-pre** | `/home/adam/.claude-v3/` | Archived | 2026-02-20 |
| **Pre-PAI backup** | `/home/adam/.claude.old-20260208-160837/` | Archived | 2026-02-08 |

---

## 13. Observations & Flags

1. **Worktree residue in control-plane:** The `relaxed-ramanujan` worktree at `.claude/worktrees/relaxed-ramanujan/` still exists after merge. Contains a full copy of `01-Projects/governance-plugin/` and `01-Projects/control-plane/`. Could be cleaned up.

2. **OIL has many stale branches:** 7 feature branches plus 4 worktree agent branches remain after MVI completion. Consider branch cleanup.

3. **Duplicate document copies:** TDS v1, TDS v2, and several architecture documents exist in at least 3 locations: observer-council, vault intake, and constitutional-synthesis workspace. The vault copies are the canonical ones.

4. **pai-brain appears fully superseded:** Only 3 policy files with content, all of which exist in newer form within OIL and the PAI project. Candidate for removal or explicit archiving.

5. **Empty project directories:** `01-Projects/oil/architecture/`, `01-Projects/oil/decisions/`, `01-Projects/vault/decisions/`, `01-Projects/vault/milestones/`, `02-Knowledge/insights/`, `02-Knowledge/theories/` are all empty. These may be scaffolded for future use or may represent incomplete migration.

6. **Local vault (`~/vault/`) vs NFS vault:** Two separate Obsidian vaults exist — one at `/home/adam/vault/` and one at `/mnt/zfs-host/backup/projects/observer-vault/`. The NFS vault is the primary/git-tracked one. The local vault contains the working OIL repo and historical intake documents.

7. **Observer Commons is substantial but unconnected:** 5 spec documents totalling ~257KB in `governance-plugin/observer-commons/`. These appear to be a federation protocol specification that may deserve its own project directory rather than being nested under the governance plugin.

8. **No `/opt/` or `/usr/local/` Observer components found.** All Observer ecosystem software lives in user space.

9. **Teams directory is empty** despite `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` being enabled in settings. The feature appears enabled but unused.

10. **Daily notes sparse:** Only one daily note exists (2026-02-27). The vault is documentation-heavy but light on daily journalling.

---

*End of Raw Project Inventory — Sub-Agent 1*
