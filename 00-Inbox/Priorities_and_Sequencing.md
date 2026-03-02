# Observer Ecosystem — Priorities & Sequencing

**Status:** DRAFT
**Date:** 2 March 2026
**Source:** Claude-Adam session discussion
**Purpose:** Single reference for all outstanding work, sequenced by dependency and impact

---

## Current State (Post-Inventory)

The system inventory (2 March 2026) mapped the full ecosystem: 15 projects, 100+ components, 5 running services. The operational core (PAI, OIL, governance plugin) works daily. The biggest gap is the control plane — fully built (16,754 LOC, 427 tests) but not deployed. Integration between components is partial: OIL doesn't trigger automatically, Vault isn't queryable through the boundary, and documents are scattered across multiple locations.

---

## Priority Sequence

### Priority 0: System Integration (IN PROGRESS)
**Status:** PRD and CLAUDE.md prepared, awaiting Atlas execution
**Location:** `01-Projects/system-integration/`
**What:** Deploy JSON-RPC control plane, wire OIL governance as automated hooks, secure exposed secrets, connect notification channels, expose control plane as local MCP server for Claude Code/Desktop.
**Why first:** Everything else depends on a wired system. Until the control plane runs and Vault is queryable through it, every session starts with manual context loading.
**Deliverables:**
- Control plane running on localhost:9000
- OIL pre-commit hooks active across all repos
- ElevenLabs key secured
- Notification channels operational
- Claude Code connecting to control plane via MCP
- Proof of work: tests passing, services running, hooks triggering

---

### Priority 1: Vault Consolidation
**Status:** Not started
**Location:** Work happens across filesystem; output is unified vault
**What:** Get everything into the primary vault at `/mnt/zfs-host/backup/projects/observer-vault/`. Specifically:
- Move OIL from old vault (`/home/adam/vault/workspaces/observer/oil/`) into primary vault or create proper reference
- Move stray documents from `~/vault/intake/` into primary vault with proper metadata
- Document PAI repo location (`~/.claude/`) and create upgrade runbook (pull Daniel's updates, apply, test)
- Move Observer Commons specs from `01-Projects/governance-plugin/observer-commons/` to `01-Projects/observer-commons/`
- Archive or remove true duplicates (TDS in 3+ locations, constitutional docs in 2 locations)
- Archive legacy PAI installations (`~/.claude-v25/`, `~/.claude-v3/`, `~/.claude.old-*`) into dated tarball
- Archive or delete `pai-brain` repo
- Remove stale worktrees and orphaned directories
- Clean up OIL's 7 stale feature branches

**Why second:** The vault is the brain. Every subsequent priority produces documents, specs, or code that need a governed home. If the vault is scattered, every task starts with "where does this go?" — which is friction that compounds.

**Deliverables:**
- Single vault with all projects, research, specs, and procedures
- No stray documents outside the vault (except code repos that reference back)
- PAI upgrade runbook documented and findable
- Legacy artefacts archived
- Obsidian picks up everything; governance plugin manages lifecycle

**Approach:** Atlas consolidation sweep as follow-up to integration project. The inventory document provides the complete map of what's where.

---

### Priority 2: Creative Methodology Skill
**Status:** Specified (`Creative_Methodology_Skill_Spec.md`)
**Location:** `00-Inbox/great-transition-research/Creative_Methodology_Skill_Spec.md` (move to `01-Projects/` when vault consolidates)
**What:** Have Atlas build the skill from the spec. Two complementary skills:
- Skill 1: "Oscillate and Generate" — scale oscillation + perspective generation (divergent operations)
- Skill 2: "Converge and Evaluate" — convergence detection + evaluative interrogation (convergent operations)

**Testing:**
1. Take a real unsolved problem
2. Give to Atlas WITH skill loaded
3. Give same problem WITHOUT skill
4. Compare outputs qualitatively
5. Observe which evaluative questions surface
6. Refine skill based on observations

**Self-improvement governance:** Improvements proposed by the skill, human approves changes. No auto-modification.

**Why third:** Bounded, testable, produces a concrete deliverable. Demonstrates the cognitive methodology as something reproducible. Also serves as a test case for skill creation workflow.

---

### Priority 3: Observer Commons Gap Plugging
**Status:** Gaps identified in `Observer_Commons_Strategic_Design_Notes.md`
**Location:** `01-Projects/observer-commons/`
**What:** Update the five protocol spec documents to address seven identified gaps:

| Gap | Action | Complexity |
|-----|--------|-----------|
| 1. Entry experience / hook | Add section to synthesis doc defining first-interaction design | Moderate |
| 2. Triangulation as fundamental primitive | Reframe composition spec's conceptual foundation | Moderate |
| 3. Creative methodology integration | Reference skill spec as companion for solution record creation | Simple |
| 4. Community energy amplification | Add incentive design section to synthesis doc | Moderate |
| 5. Vault governance in protocol | Create companion Vault Governance Spec or add section | Moderate |
| 6. Dashboard / monitoring interface | Add human interface layer requirements to synthesis doc | Simple |
| 7. Fractal simplicity as design principle | Add to design principles in all five docs | Simple |

**Why fourth:** The spec is solid — gaps are additive. Better to get the system wired and the vault consolidated first so these updates land in the right place with proper governance.

---

### Priority 4: GitHub Scraping Adapter (Reverse Protocol Bootstrap)
**Status:** Conceptual — documented in Strategic Design Notes
**Location:** Will need its own project in `01-Projects/`
**What:** Build an inward-facing tool that indexes GitHub repositories as Observer Commons solution records. The bootstrapping strategy for the protocol — pull knowledge in before pushing it out.

**Approach:**
1. Pick a constrained domain to start (e.g., Rust crates, Python data tools, or a specific problem space)
2. Build adapter that reads GitHub API (repos, READMEs, issues, contributor data)
3. Transform into solution records conforming to the Observer Commons schema
4. Populate trust vectors from GitHub's existing signals (stars, forks, contributor count, issue resolution rate)
5. Make searchable — query by problem structure, not keywords
6. This becomes the hook / entry experience

**Energy efficiency constraint:** Must be worthwhile within LLM monthly plan. Batch processing, intelligent filtering, focus on high-signal repos first.

**Key insight:** The value isn't in code stitching (LLMs will write code). The value is in *solved problem discovery* — knowing what's been solved, how, and whether it's trustworthy. Index solutions, not code.

**Why fifth:** Requires the protocol spec to be gap-plugged (Priority 3) and the system to be wired (Priority 0) so solution records land in a governed vault. Also needs more design thinking before building.

---

### Priority 5: Additional Skill Development
**Status:** Conceptual
**What:** Identify and build additional cognitive skills for Atlas beyond the creative methodology:
- Research brief process (define streams, fan out sub-agents, synthesise) as reusable skill
- PRD-to-build pipeline as formalised skill
- Vault query patterns as skill (how to find and use existing knowledge)
- Potentially the creative methodology skill's self-improvement as a governed process

**Why last in near-term:** Depends on Priority 2 proving the skill creation workflow works. Also lower urgency than system wiring and vault consolidation.

---

## Distributed Network Vision (DEFERRED — Document Only)

The Bitcoin-like distributed network where every node contributes to collective intelligence through participation is documented in `Observer_Commons_Strategic_Design_Notes.md`. This is Phase 5+ thinking. The concept is:
- Each vault indexes its own area of interest (specialisation, not replication)
- Solutions propagate peer-to-peer as discovered and validated
- Trust aggregates across independent copies
- No central server infrastructure required
- May require novel protocol design for routing and trust aggregation

**Decision:** Defer implementation. Build single-vault scraping tool first. The distributed network comes when there's demand. The federation spec already supports basic patterns.

---

## Compilation & Packaging Vision

**Goal state:** The Observer ecosystem installs in one hit. Control plane, OIL, governance plugin, Vault templates, PAI integration — all deployable as a unified package.

**Path to get there:**
1. **Priority 0 (Integration)** proves the components work together on Adam's machine
2. **Priority 1 (Consolidation)** gets everything into one governed location
3. After both: document the full installation procedure end-to-end
4. Then: create a setup script that replicates the full installation on a clean machine
5. Then: package for distribution (likely as a Git repo with setup automation)
6. Eventually: the reference implementation that demonstrates the Observer Commons Protocol

**Key principle:** Don't package prematurely. Get it working for Adam first. Document how it works. Then automate the setup. Then package for others. Each step validates the previous one.

---

## Open Questions

- [ ] Where exactly does the PAI repo live and what's the current upgrade process?
- [ ] Should OIL move into the primary vault as a subdirectory, or remain a separate repo with a reference?
- [ ] Is the two-vault setup (primary on NFS/ZFS, local at ~/vault/) still needed, or can we consolidate to one?
- [ ] What's the right project structure for the GitHub scraping adapter?
- [ ] Should Observer Commons get its own Git repo eventually, separate from the vault monorepo?
- [ ] Claude Desktop AUR package version lag — is there a better package source?

---

*"AI articulates, humans decide." — This is a proposed sequence. Adam reviews, adjusts, and decides what gets executed and when.*
