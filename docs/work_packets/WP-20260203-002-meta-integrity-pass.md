# Work Packet: Meta Integrity Pass v0

id: WP-20260203-002
title: "Replace <INTAKE_SHA> placeholders in .meta files (or mark unknown)"
requested_by: Kryax
issued_by: Council
date_issued: 2026-02-03
status: active

## Scope
In scope:
- Find all .meta files containing `<INTAKE_SHA>`
- For each, resolve the correct sha256 for its `source.intake_path` using the authoritative manifest (if present)
- Replace `<INTAKE_SHA>` with the real sha256
- If sha cannot be resolved, set `intake_sha256: "unknown"` and add a short note explaining why

Out of scope:
- Rewriting doc contents
- Reorganizing folder structure
- Reclassifying governance roles

## Constraints (binding)
- No invented sha256 values
- Use only authoritative receipts/manifests already in repo
- If source cannot be proven, mark unknown + note

## Proof / Gates (required receipts)
- `git status --porcelain`
- `grep -R "<INTAKE_SHA>" -n docs/`
- show the manifest header/first lines if found
- `git diff`
- final `git status`
- final `git log --oneline -5`

## Retry Policy
max_retries: 2
Escalate if:
- manifest not found
- intake_path cannot be resolved for multiple files
