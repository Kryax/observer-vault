---
status: LIVING
created: 2026-03-03
updated: 2026-03-03
vault_safety: This is a living operational document. It tracks pending work items. It does NOT define architecture or grant authority to any workspace artifact.
---

# Observer Project Backlog

## Critical / Next Session

- [ ] **OCP search retrieval bug** — Scraped repos are not retrievable via ocp_search keyword queries. Atlas had to use ocp_inspect with known record IDs instead. Search index doesn't surface repos by domain concepts (e.g. searching "game engine" returns 0 results despite 20 game engine repos indexed). This caused evidence drift in the alien-domain triad run — Atlas cited repos from general knowledge instead of verified corpus records. Fix retrieval or the system will always tempt pattern-forcing. (Discovered: 2026-03-03)

- [ ] **Alien-domain triad run: evidence-locked rerun needed** — The 2026-03-03 evening triad run produced strong structural findings (Dual-Speed Governance in 4 alien domains, problem-shaped vs engineer-shaped distinction) but cited repos (GATK, ColabFold, A-Frame, GDevelop, libGDX, OpenRA) without verifying they exist in the 203-record corpus. Only 5 repos were actually ocp_inspected (Godot, Bevy, FSRS4Anki, Nextflow, Zrythm). Rerun with hard evidence contract: every instance must cite ocp:github/ record ID from inspected record. Raw findings saved in 00-Inbox/sessions/. (Source: GPT advisory, 2026-03-03)

- [ ] **Schema revision: confidence cap and durability factor** — Current _SCHEMA.md allows 1.0 from a single triangulation event. Introduce a durability factor requiring multiple independent runs across sessions before confidence can exceed 0.8. "Time-tested" bonus earned over time, not within one session. (Source: GPT advisory + Claude agreement, 2026-03-03)

- [ ] **OIL pre-commit hook timeout on large batches** — SECRET GATE + TruffleHog scan chokes on 90+ staged files, causing silent commit failure. Needs file-count threshold or parallel scanning. Workaround: `--no-verify`. (Discovered: 2026-03-03)

## Motif Library

- [ ] **Promote Observer-Feedback Loop to Tier 2** — 4 domains, 0.5 confidence, strongest remaining candidate. Needs validation protocol pass + human approval.
- [ ] **Promote Trust-as-Curation to Tier 2** — 4 domains, 0.4 confidence. Needs validation protocol pass + human approval.
- [ ] **Phase 5 meta-analysis gate** — Requires 3 Tier 2 motifs. Currently 1. Two promotions away.
- [x] **Diversity scrape for triangulation** — DONE 2026-03-03. 91 repos scraped across bioinformatics, spaced repetition, game engines, legal tech, music production. 203 total in index.
- [ ] **Idempotent State Convergence definition tightening** — GPT flagged: distinguish between idempotent operations (apply config) and deterministic evaluation (same input → same decision). Scope motif to reconciliation/apply operations specifically.
- [ ] **Template-Driven Classification scope assessment** — No bottom-up confirmation. May be cognitive infrastructure motif, not universal. Assess whether it should be reclassified or left provisional.
- [ ] **Add counterexamples to all Tier 2 candidates** — Currently only Dual-Speed Governance has counterexamples. Add to Observer-Feedback Loop and Trust-as-Curation before promotion.

## Infrastructure

- [ ] **Test MCP tools from Atlas in real build context** — Verify Atlas naturally reaches for ocp_search/ocp_gaps during unprompted build tasks.
- [ ] **Scraper baseline receipt pattern** — Run ocp_status before and after each scrape for measurable delta. (Source: GPT advisory)
- [ ] **Fix grep/xargs missing in Atlas execution environment** — Verification step hit `command not found` for standard tools. Pipeline reliability issue.

## Creative Architecture

- [ ] **Problem-shaped vs engineer-shaped classification** — Emerged from alien-domain triad run. Motifs reflecting inherent problem structure (Dual-Speed Governance, Bounded Buffer) travel further across domains than motifs reflecting engineering preferences (Composable Plugin, Idempotent Convergence). Candidate meta-motif or classification axis. Needs formalisation after evidence-locked rerun confirms findings. (Source: triad run 2026-03-03)

- [ ] **Reflect skill: test with structurally diverse input** — Run /Reflect after a non-build session (creative exploration, philosophical discussion) to see if it handles non-mechanical input well.
- [ ] **Motif library as creative amplifier** — Test whether querying motif library during Oscillate phase produces measurably better creative output. This is the "does it move the car" test.
- [ ] **Multi-CLI parallel perspective engine** — GPT's architecture proposal: multiple CLIs as implicit perspectives feeding one Reflect session. Future build, not immediate.

## Documentation

- [ ] **Triangulation receipt for 2026-03-03 triad run** — Single artifact recording: input corpus, survivor patterns, confirmations, new candidates, repo evidence. Prevents retconning. (Source: GPT advisory)
- [ ] **Session handoff for 2026-03-03 evening** — Capture today's complete work in a handoff doc.
