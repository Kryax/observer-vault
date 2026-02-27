# Work Packet Template

## Governance Role
procedure

## Purpose

Define the standard work packet format Council issues to Builder to ensure:

- scoped work
- explicit constraints
- deterministic receipts
- verifiable completion criteria
- safe escalation when blocked

---

## Work Packet Header

- id: WP-YYYYMMDD-XXX
- title:
- requested_by:
- issued_by:
- date_issued:
- status: draft | active | blocked | complete

---

## Scope

- In scope:
- Out of scope:
- Non-goals:

---

## Constraints (binding)

List constraints that must be obeyed.

Reference paths when possible (e.g., docs/governance/...).

---

## Inputs / Context

- Relevant files/paths:
- Environment assumptions:
- Prior decisions / related docs:

---

## Plan (high-level)

1.
2.
3.

---

## Acceptance Criteria (verifiable)

- [ ] Proof gates executed (list)
- [ ] Tests pass (list)
- [ ] Outputs produced (paths)
- [ ] No unrelated diffs
- [ ] Receipts attached

---

## Proof / Gate Commands

List exact commands Builder must run and capture output for.

---

## Receipt Pack Requirements

Builder must return:

- command log (commands + outputs)
- diff/patch summary
- proof gate outputs
- failure evidence (if any)
- final git status + recent log

---

## Retry Policy

- max_retries:
- allowed adjustments per retry:
- when to escalate to Council:

---

## Escalation Triggers

Builder must stop and escalate when:

- constraints conflict
- required info missing
- environment mismatch
- repeated failure without progress
- structural disharmony detected

Builder should include evidence and a short diagnosis.

