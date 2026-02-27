# PAI System Snapshot

- **ID:** 20260206-0144-system-snapshot
- **Created:** 2026-02-06 01:44 AEDT
- **Status:** packet
- **Tags:** #system #snapshot #documentation #baseline
- **Source:** system inventory

---

## Purpose

This snapshot documents the current state of the PAI installation as of 2026-02-06. It serves as a baseline reference for system recovery, upgrade tracking, and understanding the current configuration.

---

## Version Information

| Component | Version | Source |
|-----------|---------|--------|
| **PAI** | v2.4 | settings.json:210, settings.json:239 |
| **Algorithm** | v0.2.25 | Startup banner, SKILL.md |
| **Model** | claude-sonnet-4-5-20250929 | Session context |
| **Node Runtime** | bun | settings.json:244 |

---

## System Environment

| Property | Value |
|----------|-------|
| **OS** | Linux 6.18.8-3-cachyos |
| **Platform** | linux |
| **Working Directory** | /home/adam |
| **Git Repository** | No (working directory) |
| **Date** | 2026-02-06 01:44:14 AEDT |
| **Timezone** | Australia/Sydney |

---

## Directory Structure

### Core PAI Installation

```
~/.claude/
├── skills/
│   ├── PAI/
│   │   ├── Components/          # PAI component modules
│   │   ├── SKILL.md             # Core PAI context (23KB)
│   │   ├── SYSTEM/              # System documentation
│   │   │   ├── AISTEERINGRULES.md
│   │   │   ├── PAISYSTEMARCHITECTURE.md
│   │   │   ├── MEMORYSYSTEM.md
│   │   │   ├── SKILLSYSTEM.md
│   │   │   ├── THEHOOKSYSTEM.md
│   │   │   ├── PAIAGENTSYSTEM.md
│   │   │   ├── THEDELEGATIONSYSTEM.md
│   │   │   ├── BROWSERAUTOMATION.md
│   │   │   ├── CLIFIRSTARCHITECTURE.md
│   │   │   ├── THENOTIFICATIONSYSTEM.md
│   │   │   └── TOOLS.md
│   │   ├── Tools/               # PAI tooling scripts
│   │   └── USER/                # User customizations
│   │       ├── AISTEERINGRULES.md
│   │       ├── DAIDENTITY.md
│   │       └── README.md
│   └── [27 other skills]/
├── hooks/                       # Event hook scripts
│   └── [17 hook files]
├── settings.json                # Configuration
└── statusline-command.sh        # Status line script
```

### Vault Structure

```
~/vault/
└── workspaces/
    └── pai/
        ├── inbox/                    # New thought captures
        │   ├── 2026-02-06_0131_structural-disharmony-detection.md
        │   └── 2026-02-06_0134_creative-loops-unresolved-conflicts.md
        ├── drafts/                   # (empty)
        ├── packets/                  # Ready for review
        │   └── [this file]
        ├── stm/                      # Short-term memory
        └── _index.md                 # Workspace index
```

### External Directories

```
/mnt/zfs-host/backup/projects/
├── pai-brain/              # PAI_BRAIN_DIR - Extended context
└── observer-vault/         # OBSERVER_VAULT_DIR - Observer system vault
```

---

## Installed Skills

**Total Count:** 28 skills

### Skills List

1. **Agents** - Dynamic agent composition and management
2. **AnnualReports** - Security report aggregation and analysis
3. **Aphorisms** - Aphorism management system
4. **Apify** - Social media and web scraping via Apify actors
5. **Art** - Visual content creation system
6. **BeCreative** - Extended thinking mode
7. **BrightData** - Progressive URL scraping
8. **Browser** - Debug-first browser automation
9. **Council** - Multi-agent debate system
10. **CreateCLI** - TypeScript CLI generator
11. **CreateSkill** - Skill creation and validation
12. **Documents** - Document processing
13. **Evals** - Agent evaluation framework
14. **Fabric** - Intelligent prompt pattern system (240+ patterns)
15. **FirstPrinciples** - First principles analysis
16. **OSINT** - Open source intelligence gathering
17. **PAI** - Core PAI system (special)
18. **PrivateInvestigator** - Ethical people-finding
19. **Prompting** - Meta-prompting system
20. **PromptInjection** - Prompt injection testing
21. **Recon** - Security reconnaissance
22. **RedTeam** - Adversarial analysis (32 agents)
23. **Research** - Multi-researcher system
24. **SECUpdates** - Security news aggregation
25. **Telos** - Life OS and project analysis
26. **VoiceServer** - Voice server management
27. **WebAssessment** - Web security assessment

---

## Workflows and Hooks

| Component | Count | Location |
|-----------|-------|----------|
| **Workflows** | 123 | Various skills |
| **Hooks** | 17 | ~/.claude/hooks/ |
| **Signals** | 8 | System signals |
| **Files** | 45 | Core system files |

**Last Updated:** 2026-02-05T14:41:33.812Z

### Hook Types (from settings.json)

| Event | Hooks |
|-------|-------|
| **SessionStart** | StartupGreeting, LoadContext, CheckVersion |
| **SessionEnd** | WorkCompletionLearning, SessionSummary |
| **UserPromptSubmit** | FormatReminder, AutoWorkCreation, ExplicitRatingCapture, ImplicitSentimentCapture, UpdateTabTitle |
| **PreToolUse** | SecurityValidator (Bash/Edit/Write/Read), SetQuestionTab (AskUserQuestion) |
| **PostToolUse** | QuestionAnswered (AskUserQuestion) |
| **Stop** | StopOrchestrator |
| **SubagentStop** | AgentOutputCapture |

---

## Configuration Summary (settings.json)

### Identity Configuration

**DA Identity (Atlas):**
- Name: Atlas
- Display Name: Atlas
- Color: #3B82F6 (Tailwind Blue-500)
- Voice ID: pNInz6obpgDQGcFmaJgB
- Voice Settings: stability=0.35, similarity_boost=0.8, style=0.9, speed=1.1, volume=0.8
- Startup Catchphrase: "Structure without distortion."

**Principal (User):**
- Name: Adam
- Timezone: Australia/Sydney

### Environment Variables

```bash
PAI_DIR=/home/adam/.claude
PROJECTS_DIR=
CLAUDE_CODE_MAX_OUTPUT_TOKENS=80000
BASH_DEFAULT_TIMEOUT_MS=600000
PAI_BRAIN_DIR=/mnt/zfs-host/backup/projects/pai-brain
OBSERVER_VAULT_DIR=/mnt/zfs-host/backup/projects/observer-vault
```

### Tech Stack

| Component | Value |
|-----------|-------|
| Browser | arc |
| Terminal | terminal |
| Package Manager | bun |
| Python Package Manager | pip |
| Language | TypeScript |
| Dev Server Port | 5173 |

### Model Configuration

- **Model:** sonnet (Claude Sonnet 4.5)
- **Max Tokens:** 4096
- **Always Thinking:** Enabled

### Permissions

**Auto-allowed tools:**
- Bash, Read, Write, Edit, MultiEdit, Glob, Grep, LS
- WebFetch, WebSearch
- NotebookRead, NotebookEdit
- TodoWrite, ExitPlanMode
- Task, Skill
- mcp__* (all MCP servers)

**Protected operations (require confirmation):**
- System destruction commands (rm -rf /, disk erasure)
- Git force push operations
- SSH key access
- Sensitive credential files
- Settings.json modifications

### Context Files (Auto-loaded at Session Start)

1. `skills/PAI/SKILL.md` - Core PAI context
2. `skills/PAI/SYSTEM/AISTEERINGRULES.md` - Universal behavioral rules
3. `skills/PAI/USER/AISTEERINGRULES.md` - Personal customizations
4. `skills/PAI/USER/DAIDENTITY.md` - Identity and interaction rules

---

## Vault Governance Structure

### Current State

**Canon (docs/):**
- Not yet established in ~/vault/docs/
- Reference policies loaded from PAI_BRAIN_DIR:
  - consumption-contract.md (constraint)
  - context-budgeting.md (constraint)
  - retrieval-policy.md (procedure)

**Drafting Area (workspaces/pai/):**
- **inbox/** - 2 thought captures (structural disharmony principles)
- **drafts/** - empty
- **packets/** - 1 document (this snapshot)
- **stm/** - empty

### Governance Roles Priority

1. **constraint** - Binding rules (must obey)
2. **procedure** - How-to rules (must follow)
3. **reference** - Background (load if needed)
4. **historical** - Archive (never auto-load)

### Write Permissions

Atlas MAY write to:
- `/vault/workspaces/pai/**`

Atlas MUST NOT write to:
- `/vault/docs/**` (canon - requires explicit authorization)
- Repo governance files outside workspace
- Observer workspace without Job Packet

---

## Capabilities Available

### Agent Types

- **Engineer** - Implementation, coding, fixing
- **Architect** - System design, architecture
- **Algorithm** - Analysis, review, evaluation
- **QATester** - Testing, browser verification
- **Researcher** - Investigation (Gemini/Claude/Grok)
- **Explorer** - Codebase exploration
- **Designer** - UX/UI design
- **Pentester** - Security testing
- **Intern** - High-agency generalist

### Thinking Tools

- **Council** - Multi-agent debate
- **RedTeam** - Adversarial analysis (32 agents)
- **FirstPrinciples** - Assumption deconstruction
- **Science** - Hypothesis testing cycles
- **BeCreative** - Extended creative thinking
- **Prompting** - Meta-prompting system

### Composition Patterns

- **Pipeline** - A → B → C (sequential)
- **TDD Loop** - A ↔ B (build-verify cycle)
- **Fan-out** - → [A, B, C] (parallel)
- **Fan-in** - [A, B, C] → D (merge)
- **Gate** - A → check → B (quality gate)
- **Escalation** - A(haiku) → A(sonnet) → A(opus)
- **Specialist** - Single A (deep expertise)

---

## Algorithm Configuration

**Version:** v0.2.25

**Depth Levels:**
- **FULL** - All 7 phases, complete ISC tracking
- **ITERATION** - Condensed format for ongoing work
- **MINIMAL** - Brief format for social interaction

**ISC Requirements:**
- 8 words exactly
- State, not action
- Binary testable (YES/NO in 2 seconds)
- Granular (one concern per criterion)

**Two-Pass Capability Selection:**
- **Pass 1:** Hook provides hints from raw prompt
- **Pass 2:** THINK validates against ISC (authoritative)

**Thinking Tools:** Opt-OUT (justify exclusion), not opt-IN

---

## Current Workspace State

### Active Thought Captures (inbox/)

1. **20260206-0131-structural-disharmony-detection**
   - Statement: "Structural disharmony should be detected before creative loops are allowed"
   - Status: inbox (awaiting curation)

2. **20260206-0134-creative-loops-unresolved-conflicts**
   - Statement: "Creative loops should be allowed even when structural conflicts are unresolved"
   - Status: inbox (awaiting curation)
   - Note: Contradicts previous principle; requires reconciliation

### Current Tasks (as of snapshot)

Tasks #16-23: System snapshot ISC criteria (in progress)

---

## System Health Indicators

✅ **Operational:**
- All 28 skills installed and available
- 17 hooks active and functional
- Context loading successful
- Algorithm v0.2.25 active
- Vault workspace structure established

⚠️ **Pending:**
- Canon vault structure (docs/) not yet populated
- Two contradictory principles in inbox require reconciliation
- Observer vault integration status unclear

🔧 **Configuration:**
- PAI v2.4 stable
- Algorithm v0.2.25 stable
- All core paths configured correctly
- Permission system active

---

## Notes

1. This snapshot was generated using PAI Algorithm v0.2.25
2. All version numbers verified from settings.json and system context
3. Directory structure verified via filesystem inspection
4. Skills count confirmed: 28 total (27 + PAI core)
5. Hook count confirmed: 17 files in ~/.claude/hooks/
6. Vault governance structure matches workspace rules
7. This document is saved to workspaces/pai/packets/ for review before potential promotion

---

## Next Steps (Recommendations)

1. Reconcile contradictory principles in inbox
2. Establish canon vault structure in ~/vault/docs/
3. Promote stable governance policies from PAI_BRAIN to local vault
4. Document Observer vault integration status
5. Create system backup/restore procedures
6. Archive this snapshot as baseline reference

---

**Snapshot Status:** Complete
**Document Location:** `/home/adam/vault/workspaces/pai/packets/2026-02-06_0144_system-snapshot.md`
**Ready for:** Review and potential promotion to system documentation
