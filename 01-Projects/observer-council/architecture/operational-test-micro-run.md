# Operational Test — Micro Run (Council ⇄ Builder ⇄ Human)

## Governance Role
reference

## Purpose

Demonstrate the end-to-end execution loop using a small, low-risk task.

This example shows:
- Work Packet creation
- Builder receipts
- Council validation
- Escalation triggers (if needed)

---

## Scenario

Task: Add a small documentation artifact and wire it into INDEX with clean diff hygiene.

---

## Work Packet (example)

id: WP-20260203-001
title: "Add execution templates and update INDEX"
status: complete

Scope:
- Add docs/execution/work-packet-template.md (+ meta)
- Add docs/execution/builder-receipt-pack.md (+ meta)
- Update docs/INDEX.md

Proof / Gates:
- `git status`
- `ls` verification
- `tail` INDEX verification

Receipt Pack:
- `git status --porcelain`
- `git diff`
- `git log --oneline -5`
- commit + push outputs

---

## Builder Output (example receipts)

- Verified files exist via `ls`
- Verified INDEX updated via `tail`
- Confirmed working tree changes via `git status`
- Staged, committed, pushed
- Confirmed clean state after push

---

## Council Validation

Council checks:
- Scope matches packet
- No mixed diffs
- INDEX matches added docs
- Receipts present
- Repo clean after push

Result: PASS

