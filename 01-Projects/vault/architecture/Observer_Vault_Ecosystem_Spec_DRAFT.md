---
meta_version: 1
kind: plan
status: draft
authority: low
phase: phase-2-vault
domain: [vault, governance, infrastructure]
mode: design
confidence: provisional
source: claude_conversation
refs:
  - doc_ref: vault-handoff-2026-02-24.md
  - doc_ref: ACTIVE-SESSION-TRACKER.md
---

# Observer Vault Ecosystem Spec — DRAFT

**Purpose:** Define the complete Vault infrastructure — community plugins, custom governance plugin, templating system, visual hierarchy, tagging schema, semantic search, data analysis, long-term memory architecture, and Atlas integration.

**Principle:** Community plugins solve ~80% of the work (templating, styling, dashboards, search). A custom governance plugin handles the Observer-specific lifecycle, promotion, and audit trail. Atlas reads the plugin configuration to know exactly how documents should be structured.

---

## 1. Vault Architecture Overview

### 1.1 Folder Structure (Current + Proposed)

```
/mnt/Backup/ObserverCouncil/
├── 00-Inbox/                        # Raw capture, auto-approved ingress
│   └── _templates/                  # Template files (Templater source)
│       ├── Vault_Safety_Header.md   # Existing safety header
│       ├── T_Brainstorm.md          # New
│       ├── T_Ideas_Packet.md        # New
│       ├── T_Architecture.md        # New
│       ├── T_Decision_Record.md     # New
│       ├── T_Session_Notes.md       # New
│       ├── T_Build_Log.md           # New
│       ├── T_Receipt.md             # New
│       ├── T_Policy.md              # New
│       ├── T_Philosophy.md          # New
│       ├── T_Summary.md             # New (memory system)
│       └── T_Exit_Artifact.md       # New
├── 01-Projects/
│   └── observer-council/
│       ├── Architecture/
│       ├── Milestones/
│       ├── Decisions/               # Promoted decision records
│       ├── ACTIVE-SESSION-TRACKER.md
│       ├── VAULT_PRIMING.md         # NEW — session priming context
│       └── SUMMARY.md               # NEW — project-level summary
├── 02-Knowledge/
│   ├── insights/
│   ├── theories/
│   ├── patterns/                    # Cross-domain pattern docs
│   └── FOUNDATIONAL_PRINCIPLES.md   # NEW — Level 3 wisdom
├── 03-Daily/
├── 04-Archive/
├── 05-Dashboards/                   # NEW — Dataview dashboards
│   ├── Vault_Home.md                # Main dashboard
│   ├── Status_Board.md              # Document lifecycle overview
│   ├── Motif_Tracker.md             # Pattern/motif analysis view
│   ├── Atlas_Activity.md            # Atlas write log dashboard
│   └── Memory_Health.md             # NEW — memory system health
└── .obsidian/
    ├── snippets/
    │   └── observer-vault.css       # Custom color coding + styling
    ├── plugins/
    │   ├── templater-obsidian/      # Community
    │   ├── dataview/                # Community
    │   ├── auto-template-trigger/   # Community
    │   ├── smart-connections/       # Community (semantic search)
    │   ├── obsidian-git/            # Community (backup)
    │   └── observer-governance/     # CUSTOM — lifecycle + promotion
    └── themes/
```

### 1.2 Authority Boundary (Unchanged)

The separation between Workspace and Vault remains absolute:

- **Workspace** (`/observer-workspace/`) — Executable truth. Code enforces governance. State questions go here.
- **Vault** (`/ObserverCouncil/`) — Narrative memory. Convention + human intent. Context and rationale live here.

Vault describes ABOUT workspace, not FOR it. Workspace does NOT derive from Vault.

---

## 2. Community Plugin Stack

These are mature, well-maintained plugins that solve the templating, querying, styling, and search problems without custom development.

### 2.1 Templater

**Purpose:** Dynamic template engine with folder-based auto-trigger.

**Why:** Templater supports JavaScript execution within templates, date/time insertion, cursor placement, and conditional logic. Combined with Auto Template Trigger, it auto-applies the correct template when a new file is created in a specific folder.

**Configuration:**
- Template folder: `00-Inbox/_templates/`
- Enable "Trigger Templater on new file creation"
- Folder-template mappings configured via Auto Template Trigger (see 2.2)

**What it gives us:**
- Auto-populated frontmatter with correct `kind`, default `status: draft`, `authority: low`
- Timestamp insertion (`created`, `modified`)
- Cursor placement at the content area so Adam can start writing immediately
- Conditional sections based on document type

### 2.2 Auto Template Trigger

**Purpose:** Automatically apply a specific Templater template when a file is created in a designated folder.

**Configuration mappings:**

| Folder Path | Template | Document Kind |
|---|---|---|
| `00-Inbox/` (root) | `T_Brainstorm.md` | brainstorm |
| `00-Inbox/sessions/` | `T_Session_Notes.md` | session |
| `00-Inbox/ideas/` | `T_Ideas_Packet.md` | ideas_packet |
| `01-Projects/*/Architecture/` | `T_Architecture.md` | architecture |
| `01-Projects/*/Decisions/` | `T_Decision_Record.md` | decision |
| `03-Daily/` | `T_Session_Notes.md` | session |

**Fallback:** If no specific folder match, `00-Inbox/` defaults to `T_Brainstorm.md` — the lowest-friction entry point. This is important because most of Adam's input will be raw brainstorms pasted from Claude or ChatGPT chats.

### 2.3 Dataview

**Purpose:** Live querying, dashboards, and status tracking across the entire Vault.

**Why:** Dataview reads YAML frontmatter and inline fields, then renders dynamic tables, lists, and views. It's the engine behind all dashboards and the visual status board.

**Key queries we'll build:**

**Vault Home Dashboard** (`05-Dashboards/Vault_Home.md`):
```dataview
TABLE status, authority, kind, dateformat(file.mtime, "yyyy-MM-dd") AS "Modified"
FROM ""
WHERE status != null
SORT file.mtime DESC
LIMIT 20
```

**Status Board** (`05-Dashboards/Status_Board.md`):
- Group by `status` (draft, review, canonical, archived)
- Show counts per tier
- Highlight documents awaiting promotion

**Documents Awaiting Promotion:**
```dataview
TABLE kind, authority, confidence, source
FROM ""
WHERE status = "review"
SORT file.mtime ASC
```

**Atlas Activity Log:**
```dataview
TABLE kind, status, source, dateformat(file.ctime, "yyyy-MM-dd HH:mm") AS "Created"
FROM ""
WHERE source = "atlas_write" OR source = "gpt_build"
SORT file.ctime DESC
LIMIT 15
```

### 2.4 Smart Connections

**Purpose:** Semantic search — find documents by meaning, not keywords. Motif detection. Cross-domain pattern discovery.

**Why this over alternatives:** Smart Connections runs local-first by default with a built-in embedding model (no API key needed for basic functionality). For Adam's sovereignty requirements, this is critical — embeddings stay on-device. It also supports Ollama for local LLM-powered chat and custom embedding models, which pairs with Adam's existing local inference setup (RX 6900 XT, llama.cpp/ollama).

**Configuration:**
- Embedding model: Default local (bge-micro-v2) for zero-setup, or optionally `nomic-embed-text` via Ollama for higher quality
- No cloud API needed
- Index entire vault
- Exclusions: `_templates/`, `.obsidian/`

**What it enables:**
- "Find notes related to this concept" — semantic similarity, not keyword matching
- Motif detection — when Adam writes about a pattern in one context, Smart Connections surfaces related patterns from other domains (geopolitics, consciousness theory, governance design)
- The "defect search" Adam mentioned — searching by the meaning of content rather than specific words
- Chat with Vault — ask questions grounded in Vault content using local models

**Sovereignty alignment:** Everything stays local. No data leaves the machine. Embeddings are computed on Adam's hardware.

### 2.5 Obsidian Git

**Purpose:** Version-controlled backup of the entire Vault.

**Configuration:**
- Auto-commit interval: every 30 minutes (or on file change)
- Push to private Codeberg/Gitea repository (not GitHub, per Adam's anti-corporate values)
- Exclude: `.obsidian/workspace.json`, `.obsidian/workspace-mobile.json`

**Pre-mortem consideration:** Set a recurring reminder to verify push success monthly. The "silent death" failure mode (expired tokens, broken auth) is the most likely issue.

---

## 3. Tagging Schema (Frontmatter)

This schema was co-developed in a previous session and defines the constrained vocabulary for all Vault documents. All metadata lives in YAML frontmatter — never inline hashtags as primary metadata.

### 3.1 Required Fields

Every Vault document MUST have these fields:

| Field | Type | Purpose |
|---|---|---|
| `meta_version` | integer | Schema version (currently `1`) |
| `kind` | enum | Document type |
| `status` | enum | Lifecycle stage |
| `authority` | enum | Governance trust level |
| `domain` | array (1-3) | Subject areas |
| `source` | enum | Provenance tracking |

### 3.2 Optional Fields

| Field | Type | Purpose |
|---|---|---|
| `phase` | enum | Project phase |
| `mode` | enum | Cognitive mode |
| `confidence` | enum | Epistemic certainty |
| `refs` | array | Links to related items |
| `motifs` | array | Pattern/theme tags (see §6) |
| `created` | datetime | Auto-populated by Templater |
| `modified` | datetime | Auto-updated |
| `promoted_from` | string | Source path before promotion |
| `promoted_date` | datetime | When promoted |
| `promoted_by` | enum | Who approved promotion |

### 3.3 Controlled Vocabularies

**`kind`** — Document type:
```yaml
kind:
  - brainstorm        # Raw capture, unstructured thinking
  - ideas_packet      # Condensed session output (from "packet it up")
  - session           # Session notes / daily log
  - architecture      # System design documents
  - decision          # Decision records (ADR-style)
  - plan              # Project plans, roadmaps
  - build_log         # Build session logs
  - receipt           # Work receipts from Atlas/PAI
  - policy            # Governance policies
  - philosophy        # Foundational thinking, theories
  - theory            # Consciousness, coordination, patterns
  - exit_artifact     # Completed deliverables
  - handoff           # Session handoff documents
  - retrospective     # Post-implementation review
  - pre_mortem        # Risk analysis (Sentry output)
  - summary           # Hierarchical summary (memory system)
  - priming           # Session priming context (auto-generated)
```

**`status`** — Document lifecycle:
```yaml
status:
  - inbox             # Just arrived, unprocessed
  - draft             # Structured but mutable
  - review            # Ready for promotion consideration
  - canonical         # Accepted truth (human-approved)
  - archived          # Historical, frozen
  - superseded        # Replaced by newer version
```

**`authority`** — Governance trust level:
```yaml
authority:
  - none              # Raw capture, no trust
  - low               # Draft, AI-generated, unreviewed
  - medium            # Reviewed, partially validated
  - high              # Canonical, human-approved
  - foundational      # Core truth, constitutional level
```

**`domain`** — Subject area (max 3 per document):
```yaml
domain:
  - consciousness     # Theory of mind, derivatives insight
  - governance        # Rules, policies, authority
  - council           # Observer Council system
  - vault             # Vault infrastructure
  - infrastructure    # Technical systems, NixOS, networking
  - oil               # Observer Integration Layer
  - search            # Semantic search, pattern finding
  - coordination      # Multi-agent, multi-system coordination
  - philosophy        # Foundational principles
  - gaming            # Gaming config, optimization
  - personal          # Life, family, property
  - geopolitics       # Brzezinski, power structures, analysis
  - memory            # Long-term memory, summarization, priming
```

**`source`** — Provenance:
```yaml
source:
  - adam_decision      # Human authority
  - claude_conversation # Claude dialogue/extraction
  - gpt_build          # GPT/Atlas implementation
  - atlas_write        # Atlas automated write to Vault
  - vault_synthesis    # Vault organization work
  - external_research  # Outside sources
  - mobile_capture     # Phone/Obsidian Sync capture
```

**`confidence`** — Epistemic certainty:
```yaml
confidence:
  - speculative        # Early thinking, high uncertainty
  - provisional        # Working hypothesis
  - tested             # Validated locally
  - proven             # Battle-tested, reliable
  - foundational       # Core truth, immutable
```

**`mode`** — Cognitive mode:
```yaml
mode:
  - explore            # Divergent, brainstorming
  - design             # Convergent, structuring
  - build              # Implementation
  - review             # Assessment, critique
  - decide             # Judgment, selection
  - reflect            # Retrospective, integration
```

### 3.4 Validation Rules

**Now (manual):** Claude and Atlas follow schema when creating docs. Human review ensures compliance.

**Future (automated):** The governance plugin validates frontmatter on save and flags non-conforming documents in a dashboard.

Rules:
- All enum fields must use defined values only
- Maximum 3 domains per document
- Single value for `kind`, `status`, `authority`, `source`, `confidence`, `mode`
- No freeform values except under `x_*` namespace (escape hatch for experimentation)
- `meta_version` must be present and numeric

---

## 4. Template Definitions

Each template auto-populates frontmatter and provides a consistent structure. Templates live in `00-Inbox/_templates/` and are applied via Auto Template Trigger + Templater.

### 4.1 T_Brainstorm.md (Default Inbox Template)

```markdown
---
meta_version: 1
kind: brainstorm
status: inbox
authority: none
domain: []
source: <% tp.system.suggester(["adam_decision", "claude_conversation", "gpt_build", "mobile_capture", "external_research"], ["adam_decision", "claude_conversation", "gpt_build", "mobile_capture", "external_research"]) %>
confidence: speculative
mode: explore
created: <% tp.date.now("YYYY-MM-DDTHH:mm:ssZ") %>
modified: <% tp.date.now("YYYY-MM-DDTHH:mm:ssZ") %>
motifs: []
refs: []
---

# <% tp.file.title %>

## Context
<!-- Where did this come from? What triggered this thinking? -->
<% tp.file.cursor() %>

## Raw Content
<!-- Paste or write the brainstorm content here -->

## Initial Observations
<!-- What patterns or connections do you notice? -->

## Next Actions
<!-- What should happen with this? Who processes it? -->
- [ ] Process and assign `kind`
- [ ] Tag domains
- [ ] Identify motifs
```

### 4.2 T_Ideas_Packet.md

```markdown
---
meta_version: 1
kind: ideas_packet
status: inbox
authority: low
domain: []
source: claude_conversation
confidence: provisional
mode: explore
created: <% tp.date.now("YYYY-MM-DDTHH:mm:ssZ") %>
modified: <% tp.date.now("YYYY-MM-DDTHH:mm:ssZ") %>
session_date: <% tp.date.now("YYYY-MM-DD") %>
motifs: []
refs: []
---

# Ideas Packet — <% tp.date.now("YYYY-MM-DD") %>

## Session Summary
<!-- High-level: what was discussed, what was decided -->
<% tp.file.cursor() %>

## Key Insights
<!-- The valuable extractions from the conversation -->

## Decisions Made
<!-- Anything that was decided during this session -->

## Open Questions
<!-- Unresolved threads to pick up later -->

## Connections
<!-- Links to existing Vault docs or concepts -->

## Action Items
- [ ] 
```

### 4.3 T_Architecture.md

```markdown
---
meta_version: 1
kind: architecture
status: draft
authority: low
domain: []
source: <% tp.system.suggester(["adam_decision", "claude_conversation", "gpt_build"], ["adam_decision", "claude_conversation", "gpt_build"]) %>
confidence: provisional
mode: design
created: <% tp.date.now("YYYY-MM-DDTHH:mm:ssZ") %>
modified: <% tp.date.now("YYYY-MM-DDTHH:mm:ssZ") %>
motifs: []
refs: []
---

# <% tp.file.title %>

## Problem Statement
<!-- What problem does this architecture solve? -->
<% tp.file.cursor() %>

## Design Constraints
<!-- What must be true? What are the non-negotiables? -->

## Proposed Architecture
<!-- Diagrams, descriptions, component breakdown -->

## Trade-offs
<!-- What are we gaining? What are we giving up? -->

## Integration Points
<!-- How does this connect to existing systems? -->

## Success Criteria
<!-- How do we know this is working? -->
```

### 4.4 T_Decision_Record.md

```markdown
---
meta_version: 1
kind: decision
status: draft
authority: low
domain: []
source: adam_decision
confidence: provisional
mode: decide
created: <% tp.date.now("YYYY-MM-DDTHH:mm:ssZ") %>
modified: <% tp.date.now("YYYY-MM-DDTHH:mm:ssZ") %>
motifs: []
refs: []
---

# Decision: <% tp.file.title %>

## Context
<!-- What situation prompted this decision? -->
<% tp.file.cursor() %>

## Options Considered
<!-- What alternatives were evaluated? -->

## Decision
<!-- What was decided and why? -->

## Consequences
<!-- What follows from this decision? -->

## Review Date
<!-- When should this decision be revisited? -->
```

### 4.5 T_Receipt.md

```markdown
---
meta_version: 1
kind: receipt
status: draft
authority: medium
domain: [council]
source: atlas_write
confidence: proven
mode: build
created: <% tp.date.now("YYYY-MM-DDTHH:mm:ssZ") %>
modified: <% tp.date.now("YYYY-MM-DDTHH:mm:ssZ") %>
work_ref: 
git_head: 
motifs: []
refs: []
---

# Work Receipt — <% tp.date.now("YYYY-MM-DD HH:mm") %>

## Task
<!-- What was executed? -->
<% tp.file.cursor() %>

## Outcome
<!-- What was the result? -->

## Verification
<!-- How was correctness verified? -->

## Artifacts Produced
<!-- Files created/modified, commits made -->

## Motif Observations
<!-- Any patterns observed during execution? -->
```

### 4.6 T_Summary.md (Memory System)

```markdown
---
meta_version: 1
kind: summary
status: draft
authority: low
domain: []
source: vault_synthesis
confidence: provisional
mode: reflect
created: <% tp.date.now("YYYY-MM-DDTHH:mm:ssZ") %>
modified: <% tp.date.now("YYYY-MM-DDTHH:mm:ssZ") %>
summarizes: []
summary_level: 1
period_start: 
period_end: 
motifs: []
refs: []
---

# Summary: <% tp.file.title %>

## Scope
<!-- What documents/period does this summary cover? -->
<% tp.file.cursor() %>

## Key Outcomes
<!-- What was achieved, decided, or learned? -->

## Patterns Observed
<!-- What motifs or recurring themes emerged? -->

## State at Close
<!-- Where do things stand now? -->

## Implications for Future Work
<!-- What should be carried forward? -->
```

### 4.7 Additional Templates (Brief)

The following templates follow the same frontmatter pattern with kind-specific sections:

- **T_Session_Notes.md** — `kind: session`, sections: Agenda, Discussion, Decisions, Action Items
- **T_Build_Log.md** — `kind: build_log`, sections: Objective, Steps Taken, Results, Issues Encountered, Next Steps
- **T_Policy.md** — `kind: policy`, sections: Scope, Policy Statement, Rationale, Enforcement, Exceptions
- **T_Philosophy.md** — `kind: philosophy`, sections: Thesis, Supporting Arguments, Counterarguments, Implications
- **T_Exit_Artifact.md** — `kind: exit_artifact`, sections: Deliverable Summary, Acceptance Criteria Met, Artifacts, Sign-off

---

## 5. Visual Hierarchy — CSS Color Coding

All visual styling is implemented through a single CSS snippet (`observer-vault.css`) placed in `.obsidian/snippets/`. This uses Obsidian's `cssclasses` frontmatter property combined with tag-based and folder-based selectors.

### 5.1 Color Palette

The palette uses a dark theme foundation (matching Adam's Hyprland/terminal aesthetic) with distinct colors for each tier and document kind.

**Tier Colors (Status):**

| Status | Color | Hex | Meaning |
|---|---|---|---|
| `inbox` | Slate grey | `#94A3B8` | Raw, unprocessed, neutral |
| `draft` | Amber | `#F59E0B` | Work in progress, caution |
| `review` | Blue | `#3B82F6` | Awaiting attention, ready |
| `canonical` | Emerald | `#10B981` | Trusted, approved, solid |
| `archived` | Muted purple | `#8B5CF6` | Historical, frozen |
| `superseded` | Dim red | `#EF4444` | Replaced, outdated |

**Kind Colors (Document Type) — Applied as sidebar accent or tag badge:**

| Kind | Color | Hex |
|---|---|---|
| `brainstorm` | Warm orange | `#FB923C` |
| `ideas_packet` | Cyan | `#22D3EE` |
| `architecture` | Steel blue | `#60A5FA` |
| `decision` | Gold | `#FBBF24` |
| `receipt` | Lime | `#84CC16` |
| `philosophy` / `theory` | Violet | `#A78BFA` |
| `policy` | Teal | `#14B8A6` |
| `summary` / `priming` | Warm white | `#F5F5F4` |
| `session` / `build_log` | Neutral warm | `#D4D4D4` |

**Authority Indicators:**

| Authority | Visual Treatment |
|---|---|
| `none` | No indicator |
| `low` | Single dot ● |
| `medium` | Double dot ●● |
| `high` | Triple dot ●●● |
| `foundational` | Shield icon or solid bar |

### 5.2 CSS Implementation

The CSS snippet applies styles based on `cssclasses` in frontmatter. The governance plugin (or Templater) automatically sets the appropriate `cssclasses` value based on `status`.

```css
/* === Observer Vault Styles === */

/* Status-based note backgrounds — subtle tinted left border */
.status-inbox { border-left: 4px solid #94A3B8; }
.status-draft { border-left: 4px solid #F59E0B; }
.status-review { border-left: 4px solid #3B82F6; }
.status-canonical { border-left: 4px solid #10B981; }
.status-archived { border-left: 4px solid #8B5CF6; }
.status-superseded { border-left: 4px solid #EF4444; }

/* Tag color overrides */
.tag[href="#status/inbox"] { background: #94A3B820; color: #94A3B8; }
.tag[href="#status/draft"] { background: #F59E0B20; color: #F59E0B; }
.tag[href="#status/review"] { background: #3B82F620; color: #3B82F6; }
.tag[href="#status/canonical"] { background: #10B98120; color: #10B981; }
.tag[href="#status/archived"] { background: #8B5CF620; color: #8B5CF6; }

/* Kind tag badges */
.tag[href="#kind/brainstorm"] { background: #FB923C20; color: #FB923C; }
.tag[href="#kind/architecture"] { background: #60A5FA20; color: #60A5FA; }
.tag[href="#kind/decision"] { background: #FBBF2420; color: #FBBF24; }
.tag[href="#kind/receipt"] { background: #84CC1620; color: #84CC16; }
.tag[href="#kind/philosophy"] { background: #A78BFA20; color: #A78BFA; }
.tag[href="#kind/summary"] { background: #F5F5F420; color: #F5F5F4; }

/* Folder coloring in file explorer */
.nav-folder-title[data-path="00-Inbox"] { color: #94A3B8; }
.nav-folder-title[data-path="01-Projects"] { color: #3B82F6; }
.nav-folder-title[data-path="02-Knowledge"] { color: #A78BFA; }
.nav-folder-title[data-path="03-Daily"] { color: #D4D4D4; }
.nav-folder-title[data-path="04-Archive"] { color: #8B5CF6; }
.nav-folder-title[data-path="05-Dashboards"] { color: #10B981; }
```

**Note:** The exact CSS selectors will need testing against the chosen Obsidian theme. The `cssclasses` approach is the most reliable method — the governance plugin or Templater sets `cssclasses: [status-draft]` in frontmatter, and the CSS targets `.status-draft` on the note container.

### 5.3 Theme Recommendation

**Minimal Theme** by @kepano — clean, highly customizable, widely supported by CSS snippets, dark mode native. Pairs well with custom CSS overrides and doesn't fight with the Observer color palette.

---

## 6. Motif System — Pattern Tracking & Data Analysis

This is the data analysis layer that connects disparate ideas across the Vault. Motifs are recurring patterns, themes, or conceptual threads that appear across different documents and domains.

### 6.1 What Motifs Are

A motif is a tagged pattern that appears across multiple documents, potentially spanning different domains. The motif system lets Adam (and Atlas) track when the same underlying pattern surfaces in different contexts.

Examples:
- `motif/control-network` — The surveyor principle: "if your control network is wrong, every measurement downstream is wrong." Appears in: governance design, consciousness theory, project management.
- `motif/receiver-not-brain` — AI as receiver, not decision-maker. Appears in: philosophy, council architecture, tool design.
- `motif/derivatives-through-semantic-space` — Feelings as derivatives. Appears in: consciousness theory, resonance engine, coordination.
- `motif/glass-box` — Transparency principle. Appears in: governance, council design, audit systems.
- `motif/sovereignty` — Human authority and independence. Appears in: governance, infrastructure, anti-corporate values.

### 6.2 How Motifs Are Tagged

In frontmatter:
```yaml
motifs:
  - control-network
  - sovereignty
```

Motifs can also appear inline using Obsidian's tag syntax for visibility:
```markdown
This connects to the #motif/control-network principle — if the governance
layer is compromised, everything downstream is untrustworthy.
```

### 6.3 Motif Registry

Maintained as a canonical document in `02-Knowledge/patterns/MOTIF_REGISTRY.md`:

```markdown
# Motif Registry

| Motif ID | Description | Domains | First Seen |
|---|---|---|---|
| control-network | Upstream accuracy determines downstream validity | governance, consciousness, surveying | 2024-12 |
| receiver-not-brain | AI adapts to human, not reverse | philosophy, council | 2024-11 |
| derivatives-through-semantic-space | Emotions as mathematical derivatives | consciousness, resonance | 2024-12 |
| glass-box | All operations visible and auditable | governance, council | 2024-12 |
| sovereignty | Human authority is non-negotiable | governance, infrastructure | 2024-11 |
| explosive-integration | Long quiet periods followed by sudden insight | consciousness, personal | 2025-01 |
| fractal-resonance | Patterns repeat at different scales | consciousness, coordination | 2024-12 |
```

### 6.4 Motif Dashboard

`05-Dashboards/Motif_Tracker.md` uses Dataview to surface cross-domain connections:

```dataview
TABLE kind, domain, confidence, file.mtime AS "Modified"
FROM ""
WHERE contains(motifs, "control-network")
SORT file.mtime DESC
```

**Cross-domain motif density** — DataviewJS can compute which motifs span the most domains, surfacing the most integrative patterns:

```dataviewjs
// Count unique domains per motif across all documents
const pages = dv.pages().where(p => p.motifs && p.motifs.length > 0);
// ... aggregate and display as table
```

### 6.5 Smart Connections + Motifs

Smart Connections provides the *semantic* layer that complements the *explicit* motif tagging:

- **Explicit motifs** (frontmatter tags) = human-identified patterns, deliberate connections
- **Semantic similarity** (Smart Connections embeddings) = machine-discovered relationships, the "I didn't know these were connected" moments

The combination is powerful: Adam tags known motifs, and Smart Connections surfaces connections he hasn't explicitly tagged yet. These discoveries become candidates for new motif entries.

### 6.6 Receipt Motif Association

When Atlas generates work receipts, it can associate observed motifs with the receipt itself. This builds a picture over time of which patterns keep appearing in execution work:

```yaml
# In a receipt document
motifs:
  - control-network
  - glass-box
refs:
  - receipt_ref: 2026-02-24-143022.tsv
  - work_ref: P2-003
```

Over time, this creates a searchable record: "Show me all receipts where the sovereignty motif appeared" — reveals which implementation work touches foundational principles.

---

## 7. Custom Governance Plugin — `observer-governance`

This is the only custom-built component. Everything else uses community plugins.

### 7.1 What It Does

The governance plugin handles the Observer-specific lifecycle that no community plugin covers:

1. **Document lifecycle enforcement** — tracks status transitions, validates that promotion rules are followed
2. **Promotion workflow** — human-gated approval for status changes (especially draft → canonical)
3. **Audit trail** — logs all status changes, promotions, and Atlas writes
4. **Frontmatter validation** — checks that required fields are present and use controlled vocabulary
5. **Atlas integration manifest** — exposes document types, templates, and governance rules so Atlas knows the Vault's expectations
6. **cssclasses auto-sync** — automatically sets `cssclasses` based on `status` field so color coding stays current
7. **Priming refresh** — regenerates `VAULT_PRIMING.md` on demand or on promotion events

### 7.2 Promotion Rules

```
inbox → draft         : Automatic when document is processed/structured
draft → review        : Author (Adam or Atlas) marks as ready
review → canonical    : REQUIRES human approval (Adam only)
canonical → archived  : REQUIRES human approval
canonical → superseded: When replacement doc reaches canonical
any → inbox           : Demotion (requires rationale)
```

**Human-gated transitions:** `review → canonical` and `canonical → archived/superseded` always require Adam's explicit approval. The plugin provides a command palette action: "Promote Document" which:
1. Checks current status
2. Validates frontmatter completeness
3. Prompts for rationale
4. Records promotion in audit log
5. Updates status, `promoted_date`, `promoted_by`
6. Moves file to appropriate folder if needed
7. Updates `cssclasses` for visual feedback
8. Triggers priming refresh if promotion is to canonical

### 7.3 Atlas Integration Manifest

The plugin exposes a JSON manifest that Atlas can read (via filesystem or MCP) to understand Vault expectations:

```json
{
  "vault_version": "1.0",
  "schema": {
    "required_fields": ["meta_version", "kind", "status", "authority", "domain", "source"],
    "enums": {
      "kind": ["brainstorm", "ideas_packet", "session", "architecture", "decision", "plan", "build_log", "receipt", "policy", "philosophy", "theory", "exit_artifact", "handoff", "retrospective", "pre_mortem", "summary", "priming"],
      "status": ["inbox", "draft", "review", "canonical", "archived", "superseded"],
      "authority": ["none", "low", "medium", "high", "foundational"],
      "source": ["adam_decision", "claude_conversation", "gpt_build", "atlas_write", "vault_synthesis", "external_research", "mobile_capture"]
    }
  },
  "templates": {
    "brainstorm": "00-Inbox/_templates/T_Brainstorm.md",
    "ideas_packet": "00-Inbox/_templates/T_Ideas_Packet.md",
    "architecture": "00-Inbox/_templates/T_Architecture.md",
    "decision": "00-Inbox/_templates/T_Decision_Record.md",
    "receipt": "00-Inbox/_templates/T_Receipt.md",
    "summary": "00-Inbox/_templates/T_Summary.md"
  },
  "promotion_rules": {
    "human_gated": ["review→canonical", "canonical→archived", "canonical→superseded"],
    "auto_allowed": ["inbox→draft", "draft→review"]
  },
  "write_rules": {
    "atlas_can_create_in": ["00-Inbox/"],
    "atlas_can_update": ["status:inbox", "status:draft"],
    "atlas_cannot_touch": ["status:canonical", "status:archived"]
  },
  "memory": {
    "priming_doc": "01-Projects/observer-council/VAULT_PRIMING.md",
    "foundational_principles": "02-Knowledge/FOUNDATIONAL_PRINCIPLES.md",
    "motif_registry": "02-Knowledge/patterns/MOTIF_REGISTRY.md"
  }
}
```

When Atlas writes to Vault, it reads this manifest and:
- Knows which template structure to use for each `kind`
- Knows which fields are required
- Knows which enum values are valid
- Knows where it can and cannot write
- Knows where to find memory context
- Applies the correct frontmatter automatically

### 7.4 Sidebar Panel (Optional Enhancement)

A sidebar panel showing the current document's governance status:
- Status badge (color-coded)
- Authority level
- Available actions ("Promote to Review", "Request Canonical Approval")
- Audit history for this document
- Related documents by motif

This could be implemented as a custom Obsidian view or potentially achieved through a combination of Dataview inline queries and CSS.

### 7.5 Plugin Technology

- **Language:** TypeScript (standard Obsidian plugin)
- **Build:** esbuild (standard Obsidian plugin toolchain)
- **Size:** Relatively small — primarily frontmatter manipulation, file operations, and a settings panel
- **Estimated effort:** Medium — the logic is straightforward, the Obsidian plugin API is well-documented

---

## 8. Atlas Integration

### 8.1 Atlas Write Path

When Atlas writes to Vault (currently via MCP/vault-bridge, future via JSON-RPC):

1. Atlas reads the governance manifest (§7.3)
2. Atlas determines document `kind` based on content/intent
3. Atlas applies the correct template structure
4. Atlas populates frontmatter with appropriate values (`source: atlas_write`, correct `kind`, etc.)
5. Atlas writes to `00-Inbox/` (the only auto-approved ingress point)
6. Auto Template Trigger may also fire if the document is a new file creation
7. The governance plugin validates frontmatter on save
8. Document appears on the Status Board as `status: inbox`

### 8.2 Atlas Read Path

Atlas reads from Vault to understand context:
- `PROJECT_STATE.md` in workspace for current state (unchanged — workspace is source of truth for state)
- `VAULT_PRIMING.md` for narrative context and recent memory (§10.3)
- Vault documents for rationale, history, and planning context
- Motif registry for pattern awareness
- Dashboards for project health overview

### 8.3 Atlas Processing Workflow

When Adam says "process and format this document from inbox":

1. Atlas reads the raw document from `00-Inbox/`
2. Atlas analyses content to determine appropriate `kind`
3. Atlas restructures content to match the template for that `kind`
4. Atlas populates/corrects frontmatter (domains, motifs, confidence)
5. Atlas sets `status: draft`, `authority: low`
6. Atlas updates `cssclasses` accordingly
7. Atlas can propose a target folder for promotion (but doesn't move without approval)

### 8.4 Future: JSON-RPC Integration

When the JSON-RPC boundary layer is built, Vault operations become part of the same protocol:

```
Atlas → JSON-RPC → Vault Bridge → Obsidian Filesystem
                                 → Governance Plugin Validation
                                 → Audit Log
```

The governance manifest becomes queryable via JSON-RPC, so any CLI tool (Claude Code, Codex, Gemini CLI, future Observer Council) can understand Vault expectations.

---

## 9. Mobile Workflow

### 9.1 Capture Flow

1. Adam chats with Claude on phone during commute
2. Trigger: "packet it up"
3. Claude produces IDEAS_PACKET markdown with correct frontmatter
4. Adam copies markdown, opens Obsidian mobile
5. Creates new note in `00-Inbox/ideas/`
6. Auto Template Trigger fires (but content already has frontmatter — template should detect and skip, or Adam pastes into content area)
7. Obsidian Sync pushes to desktop when machine wakes
8. Document appears on Status Board

### 9.2 Mobile Considerations

- Templates with `tp.system.suggester()` may not work perfectly on mobile — provide sensible defaults
- Frontmatter should be pre-populated in the IDEAS_PACKET so mobile capture requires minimal editing
- Obsidian Sync handles the transport layer

---

## 10. Vault as Long-Term Memory

The Vault is already a knowledge store — but it's not yet a *memory system*. The difference is retrieval. A filing cabinet holds documents; a memory retrieves the right knowledge at the right time without being asked the exact right question. This section defines how the Vault becomes sovereign long-term memory for the entire Observer ecosystem.

### 10.1 Why Vault Memory, Not Tool Memory

Atlas (PAI/Claude Code) has session memory and some built-in persistence. Claude has its memory system. ChatGPT has its memory. But all of these are:

- **Vendor-locked** — if you switch tools, the memory doesn't come with you
- **Opaque** — you can't inspect, edit, or audit what's stored
- **Non-sovereign** — the vendor controls retention, format, and access
- **Siloed** — Claude's memory doesn't inform Atlas, Atlas's memory doesn't inform ChatGPT

Vault memory is the opposite: sovereign, transparent, portable, auditable, and tool-agnostic. Any CLI tool in the Observer ecosystem (Claude Code, Codex, Gemini CLI, future tools) reads from the same Vault. The AI is the receiver — the Vault is the persistent brain. This maps directly to the "receiver not brain" principle.

### 10.2 The Four Memory Layers

Memory in the Vault operates at four levels, from fast/shallow to slow/deep:

```
Layer 4: Distilled Wisdom     (foundational principles, core truths)
    ↑ periodic summarization
Layer 3: Motif Network         (cross-domain pattern associations)
    ↑ tagging + semantic discovery
Layer 2: On-Demand Retrieval   (semantic search + structured queries)
    ↑ Smart Connections + Dataview
Layer 1: Session Priming       (compressed context for session start)
    ↑ auto-generated from recent activity
Layer 0: Raw Documents         (everything in the Vault)
```

Each layer compresses the one below it. An AI session doesn't need to read hundreds of documents — it reads the priming layer, queries Layer 2 when it needs specifics, follows motif threads in Layer 3, and defers to Layer 4 for foundational truths.

### 10.3 Layer 1 — Session Priming

**What:** An auto-generated context document that any AI session reads at startup.

**Document:** `01-Projects/observer-council/VAULT_PRIMING.md`

**Contents:**
- Recent decisions (last 5-10 canonical decision records, summarized)
- Active threads (documents in `status: draft` or `status: review`)
- Recent session summaries (last 3-5 sessions, condensed)
- Active motifs (which patterns are currently recurring)
- Current project phase and priorities
- Any blockers or open questions

**Generation:** The governance plugin (or a scheduled script) regenerates this document:
- On demand (Atlas command: "refresh priming context")
- On promotion events (when a document goes canonical, priming updates)
- On session close (session summary feeds into next priming)

**Format:**
```yaml
---
meta_version: 1
kind: priming
status: canonical
authority: medium
domain: [vault, governance]
source: vault_synthesis
confidence: proven
auto_generated: true
last_refreshed: 2026-02-27T08:00:00Z
---

# Vault Priming Context

## Current State
<!-- Auto-summarized from recent canonical docs and PROJECT_STATE.md -->

## Recent Decisions
<!-- Last 5-10 decision records, one-line summaries with links -->

## Active Threads
<!-- Documents in draft/review that represent ongoing work -->

## Hot Motifs
<!-- Motifs that appeared in 3+ documents in the last 30 days -->

## Open Questions
<!-- Unresolved items from recent sessions -->
```

**Atlas protocol:** At session start, Atlas reads `VAULT_PRIMING.md` *after* `PROJECT_STATE.md`. State comes from workspace (execution truth), context comes from Vault (narrative memory).

### 10.4 Layer 2 — On-Demand Retrieval

**What:** When an AI session needs specific historical context, it queries the Vault rather than relying on its own training or assumptions.

**Retrieval protocol for Atlas:**

1. **Before making assumptions about prior decisions**, Atlas searches Vault for `kind: decision` documents in the relevant domain
2. **Before proposing architecture**, Atlas checks for existing `kind: architecture` documents
3. **Before starting work in a new area**, Atlas queries Smart Connections semantically for related content
4. **When encountering a familiar pattern**, Atlas checks the Motif Registry for existing analysis

**Query methods:**

- **Structured query (Dataview):** When Atlas knows what it's looking for — "find all decision records about governance" → filter by `kind` and `domain` in frontmatter
- **Semantic query (Smart Connections):** When Atlas is exploring — "what has Adam written about the relationship between measurement and trust?" → embedding similarity search
- **Combined:** Structured filter first (narrow to relevant `kind` and `domain`), then semantic ranking within those results

**MCP/JSON-RPC interface:** The retrieval protocol needs to be accessible programmatically. This means either:
- The existing vault-bridge MCP server gains search capabilities (list by frontmatter fields, semantic search passthrough)
- Or the JSON-RPC boundary layer includes Vault query endpoints

**Retrieval rules:**
- Atlas MUST search Vault before claiming "no prior context exists"
- Atlas SHOULD cite Vault documents when building on prior work
- Atlas MUST NOT modify canonical documents based on retrieval — read-only for canonical tier
- Atlas CAN update draft documents if the retrieved context reveals needed corrections

### 10.5 Layer 3 — Motif Network as Associative Memory

**What:** The motif system (§6) functions as the associative layer — connecting ideas across domains the way human memory connects experiences by pattern rather than category.

**How it serves as memory:**

Human long-term memory is associative, not hierarchical. You don't remember things by filing location — you remember them by connection to other experiences. The motif network replicates this:

- Adam writes about governance authority levels → tagged `motif/control-network`
- Months later, Adam writes about consciousness measurement → also tagged `motif/control-network`
- Atlas (or Adam) pulls the motif thread and finds the surveying insight, the governance design, and the consciousness theory all linked by the same underlying pattern

This is *memory through meaning*, not memory through location.

**Automated motif discovery:**

Smart Connections can surface documents that are semantically similar but haven't been explicitly tagged with the same motif. This creates a discovery pipeline:

```
Smart Connections finds similarity
    → Adam (or Atlas) reviews the connection
    → If valid, new motif tag is added (or existing motif is applied)
    → Motif Registry updated
    → Next retrieval benefits from the explicit link
```

Over time, the motif network becomes increasingly connected, and retrieval quality improves because there are more explicit threads to follow.

**Motif decay and relevance:**

Not all motifs stay active forever. The priming layer (10.3) tracks "hot motifs" — those appearing frequently in recent documents. Older motifs don't disappear, but they naturally recede from the priming context until they become relevant again.

### 10.6 Layer 4 — Hierarchical Summarization (Wisdom Distillation)

**What:** Periodic compression of accumulated knowledge into higher-level summary documents, creating a pyramid from raw notes to distilled principles.

**The hierarchy:**

```
Level 0: Individual documents     (hundreds, growing)
Level 1: Project summaries        (one per project area, updated quarterly)
Level 2: Cross-project insights   (patterns across projects, updated bi-annually)
Level 3: Foundational principles  (core truths, rarely changed)
```

**Level 1 — Project Summaries:**
- One summary document per major project area (Observer Council, OIL, Vault, Infrastructure)
- Covers: what was built, what was decided, what was learned, current state
- Updated when a project hits a milestone or phase boundary
- Lives in `01-Projects/[project]/SUMMARY.md`
- `kind: summary`, `authority: high`

**Level 2 — Cross-Project Insights:**
- Documents that synthesize patterns observed across multiple projects
- "What does the OIL experience teach us about governance design?"
- "How do the consciousness theories inform the coordination architecture?"
- Lives in `02-Knowledge/insights/`
- `kind: theory` or `kind: philosophy`, `authority: high`

**Level 3 — Foundational Principles:**
- The constitutional layer — core truths that don't change
- "Human sovereignty is non-negotiable"
- "If your control network is wrong, every measurement downstream is wrong"
- "AI articulates, humans decide"
- Lives in `02-Knowledge/FOUNDATIONAL_PRINCIPLES.md`
- `kind: philosophy`, `authority: foundational`, `confidence: foundational`

**Summarization schedule:**

| Level | Trigger | Who |
|---|---|---|
| Level 1 (Project) | Milestone completion, phase boundary | Atlas drafts, Adam approves |
| Level 2 (Cross-project) | Quarterly, or when motif density spikes | Adam + Claude conversation, Atlas writes |
| Level 3 (Foundational) | Rare — only when genuine new principle emerges | Adam decides, Claude/Atlas documents |

**Summarization protocol:**
1. Atlas reads all documents at the level below
2. Atlas produces a compressed summary draft
3. Draft goes to `00-Inbox/` as `status: draft`
4. Adam reviews, refines, promotes to canonical
5. The summary document becomes part of the priming layer

This creates a living wisdom base that gets sharper over time without requiring anyone to read every document.

### 10.7 Memory Sovereignty Guarantees

The Vault memory system must maintain these guarantees:

1. **All memory is inspectable** — Adam can read any memory document, see what's stored, understand why
2. **All memory is editable** — Adam can correct, delete, or amend any memory. No "you can't change what the AI remembers"
3. **All memory is portable** — it's markdown files on a ZFS drive. No vendor lock-in
4. **AI tools are readers, not owners** — Atlas queries Vault memory, it doesn't own it. Switch tools, keep memory
5. **Summarization is human-gated** — distilled wisdom (Levels 2-3) requires human approval. AI proposes summaries, human validates
6. **No silent memory modification** — any change to canonical memory documents is audited by the governance plugin

### 10.8 Memory Health Dashboard

`05-Dashboards/Memory_Health.md` — tracks the health of the memory system:

```dataview
TABLE summary_level, dateformat(file.mtime, "yyyy-MM-dd") AS "Last Updated"
FROM ""
WHERE kind = "summary"
SORT summary_level ASC
```

Additional panels:
- Documents with no motifs tagged (memory gaps)
- Documents older than 90 days with `status: draft` (stale drafts)
- Motifs with only 1 document (isolated threads — potential connections missing)
- Time since last priming refresh
- Summary coverage (which project areas have current summaries vs overdue)

---

## 11. Implementation Roadmap

### Phase 1: Foundation (Do First)

1. Install community plugins: Templater, Auto Template Trigger, Dataview
2. Create all template files in `00-Inbox/_templates/`
3. Configure folder-template mappings
4. Create CSS snippet (`observer-vault.css`)
5. Set up `05-Dashboards/` with initial Dataview queries
6. Choose and apply Minimal Theme

**Effort:** ~1 session to configure. Templates are the bulk of the work and are defined above.

### Phase 2: Governance Plugin (Build)

1. Scaffold Obsidian plugin (`observer-governance`)
2. Implement frontmatter validation
3. Implement promotion workflow (command palette actions)
4. Implement audit logging
5. Implement `cssclasses` auto-sync
6. Generate Atlas integration manifest
7. Test promotion flow end-to-end

**Effort:** ~2-3 sessions for Atlas to build. The plugin logic is straightforward.

### Phase 3: Semantic Search & Motifs

1. Install and configure Smart Connections
2. Choose embedding model (local default or Ollama)
3. Let it index the vault
4. Create Motif Registry document
5. Build Motif Tracker dashboard
6. Test semantic search quality

**Effort:** ~1 session to install and configure. Indexing runs in background.

### Phase 4: Atlas Integration

1. Update Atlas/PAI prompts with governance manifest awareness
2. Test Atlas write path (create document in Inbox, validate frontmatter)
3. Test Atlas processing workflow (raw brainstorm → structured draft)
4. Integrate with existing MCP/vault-bridge
5. Plan JSON-RPC bridge when boundary layer is ready

**Effort:** ~1-2 sessions. Mostly prompt engineering for Atlas + testing.

### Phase 5: Long-Term Memory System

1. Create `VAULT_PRIMING.md` template and initial priming document
2. Define Atlas retrieval protocol (when to search, how to query)
3. Build priming refresh mechanism (governance plugin command or script)
4. Create `T_Summary.md` template
5. Build Memory Health dashboard
6. Write first Level 1 project summaries (Observer Council, OIL, Vault)
7. Draft `FOUNDATIONAL_PRINCIPLES.md` (Level 3)

**Effort:** ~2 sessions. The priming doc and retrieval protocol are the priority. Summarization is ongoing.

### Phase 6: Polish & Data Analysis

1. Install Obsidian Git, configure backup to Codeberg
2. Build advanced Dataview dashboards (motif density, cross-domain analysis)
3. Build DataviewJS visualizations for pattern tracking
4. Refine CSS styling based on actual usage
5. Iterate on template structures based on what Adam actually writes

**Effort:** Ongoing refinement.

---

## 12. Open Questions for Adam

1. **Theme preference:** Minimal Theme recommended — does that work, or do you have a preferred dark theme?
2. **Motif naming convention:** Free-form slugs (like `control-network`) or structured IDs (like `M-001`)?
3. **Obsidian Git target:** Codeberg? Self-hosted Gitea? Or accept GitHub for this specific use?
4. **Smart Connections model:** Start with built-in local model, or configure Ollama from day one?
5. **Governance plugin priority:** Build it before or after the JSON-RPC boundary layer? (They're independent but the boundary layer would make Atlas integration cleaner)
6. **Dashboard location:** `05-Dashboards/` as proposed, or prefer them embedded in existing folders?
7. **Receipt motif workflow:** Should Atlas auto-suggest motifs based on content, or should motif tagging always be human?
8. **Priming refresh frequency:** Auto-refresh on every promotion event, or manual refresh on demand?
9. **Summarization cadence:** Quarterly project summaries, or tied to milestone completions?
10. **Memory query interface:** Should Vault retrieval go through the existing MCP vault-bridge, or wait for JSON-RPC boundary layer?
11. **Foundational principles:** Start by documenting the principles you've already articulated (receiver-not-brain, control network, sovereignty), or let them emerge organically from the summarization process?

---

*This document captures the complete Vault ecosystem design including governance, templating, visual hierarchy, semantic search, data analysis, and long-term memory architecture as discussed across sessions in February 2026. It is a DRAFT in `00-Inbox/` awaiting Adam's review and refinement before any implementation begins.*
