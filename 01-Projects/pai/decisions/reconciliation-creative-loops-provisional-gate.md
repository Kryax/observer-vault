# Creative Loops Reconciliation: Provisional Gate Pattern

- **ID:** 20260210-reconciliation-creative-loops-provisional-gate
- **Created:** 2026-02-10
- **Status:** approved-awaiting-implementation
- **Decision Date:** 2026-02-10
- **Tags:** #principle #governance #reconciliation #creative-loops #provisional #promotion-gate
- **Reconciles:** [[20260206-0131-structural-disharmony-detection]], [[20260206-0134-creative-loops-unresolved-conflicts]]
- **Pattern:** Pattern 2 (Merged Principle)
- **Council Vote:** 2-1 (Architect + Engineer support, Governance dissent)

---

## Statement

**Unified Governance Principle:**

"Creative loops are always permitted, but their outputs enter PROVISIONAL status until structural integrity is verified at promotion time."

This reconciles two previously contradictory principles by separating the *generative phase* (where creative loops run freely) from the *canonicalization phase* (where structural integrity is enforced).

---

## Context

### The Contradiction

Two governance principles were captured on 2026-02-06 with incompatible requirements:

1. **Principle 1** (structural-disharmony-detection): "Structural disharmony should be detected BEFORE creative loops are allowed"
   - Purpose: Protect canonical integrity, prevent PAI from inventing non-canonical structure
   - Approach: Safety-first, block creative loops until governance is clear

2. **Principle 2** (creative-loops-unresolved-conflicts): "Creative loops should be allowed EVEN WHEN structural conflicts are unresolved"
   - Purpose: Preserve generative capacity, prevent paralysis from waiting for perfect structure
   - Approach: Exploration-first, allow creative work despite ambiguity

### Analysis Conducted

- **FirstPrinciples Analysis** revealed both principles protect valid concerns:
  - Principle 1: Prevents canonical contamination (real risk)
  - Principle 2: Preserves creative momentum (real value)
  - Neither is "wrong" - they serve different masters

- **Council Debate** (Architect, Engineer, Governance perspectives) evaluated three reconciliation patterns:
  1. Precedence Rule (output destination determines which principle applies)
  2. Merged Principle (always allow loops, promotion gate enforces integrity)
  3. Context-Switch (algorithm phase determines which principle applies)

- **Council Result:** 2-1 vote for Pattern 2 (Merged Principle)
  - Architect: Convinced by simplicity argument, filesystem boundaries as state machine
  - Engineer: Lowest maintenance burden, resilient to human error, single gate function
  - Governance: Dissent - preferred Pattern 3's explicit phase enforcement

### Decision

Adam selected **Pattern 2 (Merged Principle)** on 2026-02-10.

---

## Rationale

### Why Pattern 2 Was Chosen

1. **Preserves Both Values:**
   - Creative momentum: Never blocks loops during exploration
   - Canonical integrity: Gate ensures verification before promotion

2. **Leverages Existing Infrastructure:**
   - PAI already has `MEMORY/WORK/` for provisional work
   - Vault already has `workspaces/pai/inbox/` for staging
   - ISC TaskCreate/TaskUpdate already gates work completion

3. **Simplicity:**
   - Filesystem boundaries ARE the state machine (no dual state tracking)
   - Location signals state: `provisional/` vs `lib/`
   - Single gate function - one responsibility, easy to test

4. **Resilience to Human Error:**
   - System enforces integrity automatically
   - Forgetting to "switch modes" doesn't break governance
   - Provisional vs canonical provides visual distinction

5. **Proven Precedent:**
   - Git: working directory → staging → commit
   - Design tools: Figma layers/branches → publish
   - Compilers: intermediate representations → final output

### Trade-Off Acknowledged

Pattern 2 optimizes for **developer velocity and maintenance simplicity**.
Pattern 3 (Context-Switch) optimizes for **governance robustness and explicit enforcement**.

Both are valid. This choice prioritizes velocity with governance enforcement at the promotion boundary.

---

## Implementation Requirements

**Status:** NOT YET IMPLEMENTED - requirements documented for future work

### 1. OBSERVE Phase Addition

**File:** `~/.claude/skills/PAI/SYSTEM/CORE.md` or equivalent

**Add to OBSERVE phase:**
```markdown
🔍 **STRUCTURAL DISHARMONY DETECTION:**
- Check for governance conflicts, missing structure, incomplete policies
- Report conflicts clearly (escalate to DISHARMONY_DETECTED if needed)
- **DO NOT BLOCK CREATIVE LOOPS** - detection is informational, not blocking
- Tag outputs as PROVISIONAL if disharmony detected
```

**Rationale:** Principle 1's detection happens here, but doesn't gate creative loops (Principle 2 preserved).

---

### 2. MEMORY System Addition

**Path:** `~/.claude/MEMORY/WORK/.provisional/`

**Create PROVISIONAL namespace:**
- All creative loop outputs during disharmony go to `.provisional/` subdirectory
- Provisional artifacts cannot be imported/referenced by canonical systems
- Visual distinction: `WORK/session-name/` vs `WORK/session-name/.provisional/`

**Vault equivalent:**
- `vault/workspaces/pai/inbox/` already serves this role
- Continue using inbox → drafts → canonical promotion flow

**Rationale:** Spatial separation (filesystem boundaries) prevents accidental use of unverified work.

---

### 3. VERIFY Phase Gate

**File:** Algorithm implementation or steering rules

**Add promotion gate logic:**
```markdown
━━━ ✅ VERIFY ━━━ 6/7

**Before promoting PROVISIONAL artifacts to canonical:**

1. Check ISC task completion (TaskList - all tasks must be completed)
2. Run structural disharmony detection (must pass or have explicit override)
3. If conflicts exist:
   - Block promotion
   - Artifact remains in PROVISIONAL namespace
   - Report blocking criteria to user
4. If clear:
   - Promote to canonical (move from .provisional/ to parent directory)
   - Update vault (inbox → drafts or docs/)
   - Mark as verified in audit trail
```

**Rationale:** This is where Principle 1's integrity enforcement happens - at the promotion boundary, not during creative loops.

---

### 4. Steering Rules Addition

**File:** `~/.claude/skills/PAI/USER/AISTEERINGRULES.md`

**Add rules:**

#### Provisional Artifacts Require Promotion Gate
**Statement:** Never promote PROVISIONAL artifacts to canonical vault or config without ISC verification and structural disharmony check.

**Bad:** Creative loop generates governance document during conflict → immediately promoted to vault docs/ → canonical contamination.

**Correct:** Creative loop generates governance document → stored in inbox/ → ISC tasks created → VERIFY phase checks integrity → promoted only after passing gate.

#### Disharmony Detection Is Informational During Creative Loops
**Statement:** Structural disharmony detection runs during OBSERVE phase but does not block creative loops. It informs tagging (PROVISIONAL) but does not prevent generation.

**Bad:** OBSERVE detects governance conflict → blocks THINK/PLAN phases → paralysis, no progress.

**Correct:** OBSERVE detects governance conflict → tags session outputs as PROVISIONAL → creative loops proceed → promotion blocked at VERIFY gate.

---

### 5. Audit Trail Enhancement (Optional)

**Add to PROVISIONAL artifacts metadata:**
- Timestamp of creation
- ISC criteria blocking promotion
- Promotion attempt history (if gate was tried and failed)
- Disharmony detection report from OBSERVE phase

**Rationale:** Enables debugging why certain work remains provisional, tracks governance evolution.

---

### 6. Automated Monitoring (Optional)

**Add warning system for stale provisional work:**
- Alert if PROVISIONAL artifacts older than N days (configurable, e.g., 7 days)
- Remind to reconcile or explicitly defer
- Prevents indefinite provisional accumulation (Governance analyst's concern)

---

## Resolution of Original Principles

### Principle 1 (Structural Disharmony Detection)
**Status:** Honored at promotion gate
**How:** Disharmony detection runs in VERIFY phase before canonicalization
**Scope:** Applies to all canonical promotions (vault docs/, config/, governance)

### Principle 2 (Creative Loops with Unresolved Conflicts)
**Status:** Honored during generative phases
**How:** Creative loops never blocked, outputs tagged PROVISIONAL
**Scope:** Applies to OBSERVE → THINK → PLAN → BUILD → EXECUTE phases

**Reconciliation:** Both principles are correct within their scopes. Principle 2 governs *generation*. Principle 1 governs *canonicalization*. No actual contradiction exists when phases are distinguished.

---

## Next Steps

1. **Review this document** - Confirm Pattern 2 specification is complete
2. **Implement Phase 1** - Add OBSERVE phase disharmony detection (informational, non-blocking)
3. **Implement Phase 2** - Create PROVISIONAL namespace in MEMORY system
4. **Implement Phase 3** - Add VERIFY phase promotion gate logic
5. **Implement Phase 4** - Add steering rules to USER/AISTEERINGRULES.md
6. **Test** - Verify provisional → canonical flow with ISC tasks
7. **Promote to Canon** - Move this document to observer-vault docs/policies/ when implemented

---

## References

- **Original Contradiction:**
  - `/home/adam/vault/workspaces/pai/inbox/2026-02-06_0131_structural-disharmony-detection.md`
  - `/home/adam/vault/workspaces/pai/inbox/2026-02-06_0134_creative-loops-unresolved-conflicts.md`

- **Analysis:**
  - FirstPrinciples analysis conducted 2026-02-10
  - Council debate (Architect, Engineer, Governance) conducted 2026-02-10
  - Systematic reconciliation patterns evaluated (Precedence, Merged, Context-Switch)

- **Precedent:**
  - Git: working directory → staging → commit model
  - Design tools: Figma layers → publish, CAD branches → release
  - Compilers: IR passes → final codegen with increasing semantic rigor

---

**Document Authority:** Approved governance awaiting implementation
**Approved By:** Adam (2026-02-10)
**Implementation Status:** Not yet implemented - requirements documented above
**Version:** 1.0
