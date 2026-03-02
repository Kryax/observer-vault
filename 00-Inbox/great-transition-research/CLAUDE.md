# Great Transition Research — Observer Ecosystem Opportunity Analysis

## Project Location
- Research brief & outputs: `/mnt/zfs-host/backup/projects/observer-vault/00-Inbox/great-transition-research/`
- Seed document: `Atlas_Research_Brief_Great_Transition.md`

## Session Start
- Read `Atlas_Research_Brief_Great_Transition.md` to understand full scope
- Check for any existing stream outputs in the project directory
- Confirm which streams have been completed, are in progress, or haven't started

## Project Overview

This is a four-stream research and analysis project exploring where Adam's Observer ecosystem, skills, and vision align with the emerging "Great Transition" in AI, software, and labor markets. The goal is to identify concrete opportunity paths for income generation, community contribution, and system improvement.

The four streams are:
1. **Adoption Pattern Analysis** — Retrospective structural analysis of 15-20 successful software/open-source projects to identify repeatable motifs in adoption
2. **Landscape Mapping** — Current state of service directories, governance-as-a-service, ideal state tooling, and sovereignty frameworks
3. **Opportunity Synthesis** — Merge streams 1, 2, and 4 against Adam's profile to produce 3-5 ranked opportunity paths
4. **Open Source Energy Dynamics** — How open-source energy is amplified or captured, what infrastructure channels community creative surplus

**Execution order:** Streams 1, 2, and 4 run in parallel. Stream 3 is synthesis and depends on all three completing first.

## Workflow Orchestration

### 1. Subagent Strategy (CRITICAL)
- **Use subagents for each stream** to preserve main context window
- One stream per subagent — do NOT try to run all four in a single context
- Main agent orchestrates: assigns streams, collects outputs, manages synthesis
- If a stream is too large for a single subagent, break it into sub-tasks (e.g., Stream 1 could split into "analyse projects 1-10" and "analyse projects 11-20" then synthesise)

### 2. Context Protection
- This is a research-heavy project — context will fill fast
- Subagents should produce structured markdown outputs, not hold findings in memory
- Write stream outputs to the project directory as they complete
- Each stream output should be a standalone document that can be read independently

### 3. Research Approach
- Use web search extensively — this is about current landscape, not just existing knowledge
- For Stream 1 (adoption patterns): look for post-mortems, founder retrospectives, adoption curve analyses, not just Wikipedia summaries
- For Stream 2 (landscape): find actual projects, repos, companies — names, URLs, what they do, where the gaps are
- For Stream 4 (open source dynamics): look for academic research on open-source sustainability, governance models, network effects — not just opinion pieces
- Cite sources. Adam values independent verification.

### 4. Output Format
Each stream produces a markdown document saved to the project directory:
- `Stream1_Adoption_Patterns.md`
- `Stream2_Landscape_Map.md`
- `Stream3_Opportunity_Synthesis.md`
- `Stream4_OpenSource_Energy.md`

Each document should include:
- Clear findings with evidence
- Explicit uncertainty markers (what's well-supported vs. speculative)
- Actionable recommendations
- Cross-references to other streams where relevant

### 5. File Operations
- Write all outputs to: `/mnt/zfs-host/backup/projects/observer-vault/00-Inbox/great-transition-research/`
- **CHECK FILE OWNERSHIP** after writing — files must be owned by adam, not root
- If running in a container context, outputs may need ownership correction on the host

## Governance Boundaries (NON-NEGOTIABLE)

1. **This is research and analysis only.** Do not create repos, publish anything, register domains, or take any public action.
2. **Adam decides what to act on.** Present options with evidence. Do not assume any opportunity path is approved.
3. **Do not commit Adam's time, money, or public reputation.** All recommendations are proposals awaiting human approval.
4. **Do not build when asked to research.** If a finding suggests something should be built, document it as a recommendation — do not start building it.
5. **When in doubt: STOP and ask Adam.**

## Adam's Profile (Quick Reference)

**Strengths:**
- Cross-domain pattern recognition (surveying, mining, geopolitics, psychology, consciousness, software)
- Observer archetype: long integration periods → explosive insights
- Governance architecture: Observer Council with Cynefin gates, Pre-Mortem, sovereignty checks
- Surveyor methodology: multiple independent measurement sources for verification
- Technical: OIL (Tier-1 stable), JSON-RPC control plane, batch parallel execution, CachyOS/Hyprland stack
- Philosophical clarity: "AI articulates, humans decide" — anti-corporate, sovereignty-focused

**Constraints:**
- Full-time employment (mining/surveying) — project time is evenings/weekends
- No VC funding — must be bootstrappable or community-funded
- Anti-corporate stance — open-source or open-core minimum
- Based in rural NSW, Australia — no Silicon Valley networking, but global internet reach
- Single-person technical capacity augmented by AI tools

**Existing Assets:**
- Observer Council (multi-agent governance framework)
- OIL (Observer Integration Layer — governance for AI execution)
- JSON-RPC control plane (in development)
- Observer Commons concept (federated solution sharing protocol)
- Vault knowledge system (narrative memory, hierarchical summarisation)
- PAI operational playbooks and batch parallel execution patterns

## Core Principles
- **Human Sovereignty**: Adam decides. AI articulates options. Research informs.
- **Multiple Independent Sources**: Don't rely on one source for any finding. Triangulate.
- **Substance Over Hype**: Adam values depth. Don't pad findings with marketing language.
- **Australian English**: Use Australian spelling conventions in all outputs.

## Communication Style
- Direct, evidence-based, no fluff
- Show reasoning and sources
- Flag uncertainty explicitly rather than presenting speculation as fact
- If a stream produces surprising or counterintuitive findings, highlight them — don't bury them
