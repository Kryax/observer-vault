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
- [ ] **Promote Plugin/StateMachine/Buffer to Tier 2** — All three at 7 domains, 0.9 confidence, alien-domain triangulation confirmed. Awaiting human approval. Promoting all three opens Phase 5 gate with 4 Tier 2 motifs.
- [ ] **Verify 6 unverified repos** — A-Frame, GDevelop, libGDX, GATK, ColabFold, fastp cited in triad run without ocp_inspect verification. Quick check: do they exist in the 203-record corpus? If not, downgrade affected instances.
- [ ] **Phase 5 meta-analysis gate** — Requires 3 Tier 2 motifs. Currently 1. Three strong candidates ready (Plugin, StateMachine, Buffer). Promoting them opens gate with 4 Tier 2 motifs.
- [x] **Diversity scrape for triangulation** — DONE 2026-03-03. 91 repos scraped across bioinformatics, spaced repetition, game engines, legal tech, music production. 203 total in index.
- [ ] **Idempotent State Convergence definition tightening** — GPT flagged: distinguish between idempotent operations (apply config) and deterministic evaluation (same input → same decision). Scope motif to reconciliation/apply operations specifically.
- [ ] **Template-Driven Classification scope assessment** — No bottom-up confirmation. May be cognitive infrastructure motif, not universal. Assess whether it should be reclassified or left provisional.
- [ ] **Add counterexamples to all Tier 2 candidates** — Currently only Dual-Speed Governance has counterexamples. Add to Observer-Feedback Loop and Trust-as-Curation before promotion.

## Infrastructure

- [ ] **Test MCP tools from Atlas in real build context** — Verify Atlas naturally reaches for ocp_search/ocp_gaps during unprompted build tasks.
- [ ] **Scraper baseline receipt pattern** — Run ocp_status before and after each scrape for measurable delta. (Source: GPT advisory)
- [ ] **Fix grep/xargs missing in Atlas execution environment** — Verification step hit `command not found` for standard tools. Pipeline reliability issue.

## Strategic / Architecture

- [ ] **Motifs as design constraints for future builds** — The motif library should actively inform architecture decisions, not just catalogue patterns. Dual-Speed Governance → action layer should separate slow governance (human approval, policy authoring) from fast execution (agent runs, scraping). Composable Plugin Architecture → new capabilities should wire in via standard interfaces, not bespoke integration. Explicit State Machine Backbone → build pipelines should have named states with guarded transitions. Bounded Buffer → systems under load need explicit overflow policies. Every new PRD should reference applicable motifs as design constraints and explain how the design honours or deliberately departs from them. This is how motifs stop being academic and start producing operational advantage.

- [ ] **Motif Action Layer (future project)** — GPT proposed architecture: motif threshold events → Telegram notifications → human approval → PRD generation → execution loop. Components: event detector, event log, notifier, archive, PRD escalator. Staged rollout: Stage 0 manual, Stage 1 scheduled+notify, Stage 2 approval→PRD, Stage 3 inward audits. MVP = "Motif Promotion Notifier" — only triggers on tier changes and confidence threshold crossings. Not immediate — do after Tier 2 promotions and Phase 5 gate are resolved. (Source: GPT advisory, 2026-03-03)

- [ ] **Inward triad: point cognitive architecture at own pipeline** — GPT suggested running the triad against Observer's own build artifacts (PRDs, receipts, gate outputs, failure logs) to find where the pipeline breaks under load, creates hidden work, or drifts. The OIL pre-commit timeout is literally Bounded Buffer showing up in governance. Treat own pipeline as a domain in the motif library. (Source: GPT advisory, 2026-03-03)

## Creative Architecture

- [ ] **Problem-shaped vs engineer-shaped classification** — Emerged from alien-domain triad run. Motifs reflecting inherent problem structure (Dual-Speed Governance, Bounded Buffer) travel further across domains than motifs reflecting engineering preferences (Composable Plugin, Idempotent Convergence). Candidate meta-motif or classification axis. Needs formalisation after evidence-locked rerun confirms findings. (Source: triad run 2026-03-03)

- [ ] **Reflect skill: test with structurally diverse input** — Run /Reflect after a non-build session (creative exploration, philosophical discussion) to see if it handles non-mechanical input well.
- [ ] **Motif library as creative amplifier** — Test whether querying motif library during Oscillate phase produces measurably better creative output. This is the "does it move the car" test.
- [ ] **Multi-CLI parallel perspective engine** — GPT's architecture proposal: multiple CLIs as implicit perspectives feeding one Reflect session. Future build, not immediate.

## Documentation

- [ ] **Triangulation receipt for 2026-03-03 triad run** — Single artifact recording: input corpus, survivor patterns, confirmations, new candidates, repo evidence. Prevents retconning. (Source: GPT advisory)
- [ ] **Session handoff for 2026-03-03 evening** — Capture today's complete work in a handoff doc.
