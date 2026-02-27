# {PROJECT_NAME}

## Session Start
- Read `PROJECT_STATE.md` to understand current state
- Check `decisions/` for any recent architectural decisions
- If a status script exists, run it before starting work

## Project Overview
<!-- Fill in: 1-3 sentences describing what this project is and its current phase -->

**Status:** {active | paused | completed}
**Repo:** {repo path or URL if applicable}
**Vault home:** 01-Projects/{project-name}/

## Active Goals
<!-- Fill in: What's being worked on RIGHT NOW. Keep to 3-5 items max. -->
<!-- Update this every session end. -->

1. {Goal 1}
2. {Goal 2}
3. {Goal 3}

## Workflow

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan — don't keep pushing
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents to keep main context window clean
- One task per subagent for focused execution
- Offload research, exploration, and parallel work to subagents

### 3. Verification Before Done
- Never mark a task complete without proving it works
- Run any project-specific verification gates before declaring done
- Ask yourself: "Would Adam approve this?"

### 4. Context Budgeting
- Read this file first (Layer 1 — orientation)
- Read `architecture/` docs only when working on design tasks (Layer 2)
- Read `decisions/` only when you need historical rationale (Layer 2)
- Access `02-Knowledge/` and `04-Archive/` only for deep research (Layer 3)
- Do NOT load everything upfront — progressive disclosure saves context

## Key Files
<!-- Fill in: Project-specific governance and reference files -->
<!-- Format: path — what it tells you -->

- `PROJECT_STATE.md` — Current state, active work, blockers
- `SUMMARY.md` — Project overview and history
- `architecture/` — Design documents and technical specs
- `decisions/` — Decision records with rationale
- `milestones/` — Completed milestones and exit artifacts

## Boundary Enforcement (NON-NEGOTIABLE)

### Universal Rules
- **Human Sovereignty**: Adam decides. Atlas executes.
- **Authority Boundary**: The Vault describes ABOUT the workspace, not FOR it. Never derive executable decisions from Vault narrative.
- **No Drift**: Architecture changes only through documented decisions
- **Receipts Exist**: If it happened, document it
- **Boundaries Are Real**: Approved boundaries are walls, not suggestions

### Project-Specific Rules
<!-- Fill in: What can Atlas do in this project? What's off-limits? -->
<!-- Example: "Do not modify files in exits/ without Adam's instruction" -->

1. {Rule 1}
2. {Rule 2}

## Vault Write Rules
- Atlas creates new files in `00-Inbox/` only
- Atlas can update documents with status `inbox` or `draft`
- Atlas CANNOT modify `canonical` or `archived` documents
- All Atlas-created documents must include valid frontmatter per vault schema
- Source field must be set to `atlas_write` or `gpt_build`

## Stop Conditions (Always Apply)
- Boundary crossing without documented approval → STOP
- Uncertainty about scope or intent → STOP and ask Adam
- Modifying canonical documents → STOP
- Architecture changes without decision record → STOP
- Merge conflicts during parallel work → STOP
- Pre-commit or verification gate failure → STOP and report
- Do not build when asked to plan
- Do not execute when asked to record

## Session End Checklist
- [ ] Update `PROJECT_STATE.md` with current state
- [ ] Update Active Goals in this file if priorities changed
- [ ] Document any decisions made in `decisions/`
- [ ] Commit work with meaningful message
- [ ] Note any blockers or open questions for Adam
