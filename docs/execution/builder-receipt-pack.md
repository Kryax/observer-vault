# Builder Receipt Pack

## Governance Role
procedure

## Purpose

Define the minimum evidence Builder must return for auditability and verification.

This is the payload Council uses to assess completion or diagnose failure.

---

## Required Contents (minimum)

### A) Execution Log
- commands executed (verbatim)
- outputs (verbatim where possible)
- timestamps (if available)

### B) Change Evidence
- `git status --porcelain`
- `git diff` (or patch file)
- summary of files changed and why

### C) Proof Gates
- commands run (tests, verify scripts, linters)
- outputs and exit status

### D) Failure Evidence (if applicable)
- error messages
- logs
- reproduction steps
- what changed between attempts

### E) Final State
- final `git status`
- final `git log --oneline -5`
- any push/pull results if remote used

---

## Bounded Retry Expectation

Retries must be:

- capped (default 2–3)
- accompanied by new evidence
- stopped if failure repeats without progress

When stuck, Builder escalates to Council with evidence.

