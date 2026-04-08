---
⚠️ VAULT SAFETY HEADER
authority_boundary: This document is VAULT content (narrative/rationale/planning).
vault_rule: The Workspace does NOT derive from this document.
human_gate: Promotion to canonical requires Adam's explicit approval.
ai_rule: AI agents may READ this document. AI agents may CREATE new documents referencing this one. AI agents may NOT modify canonical vault documents.
---

---
status: ACTIVE
date: 2026-03-25
author: Claude (advisory)
type: session-handoff
domain: [observer-native, dataset-processor, governance, architecture, experimental-llm]
---

# SESSION HANDOFF — March 24-25, 2026

## TWO-DAY SESSION SUMMARY

This was an extended session spanning Adam's drive to work, a full night shift with mobile access via Terminus, an evening build session at the desktop, a second morning of debugging, and a drive to the next night shift. The session covered dataset processing, architecture design, a major philosophical discussion about consciousness and the experimental LLM, a full build of the Observer runtime spine and rivers, and discovery and resolution of multiple pipeline bugs.

---

## ACTIVE RIGHT NOW

1. **Shard processing running on the PC.** Shard 01 is processing at 93% CPU. The fish loop will continue through shards 02-29 sequentially. All databases writing to LOCAL storage at `/home/adam/dataset-processor/output/` with verified copy to ZFS at `/mnt/zfs-host/backup/projects/observer-vault/01-Projects/dataset-processor/output/verified/` after each shard completes. Each shard takes approximately 3-6 hours. Estimated completion of all 29 shards: 4-7 days.

2. **Michelle is using the PC for work.** The processing runs in background. If machine feels sluggish: `renice 19 -p $(pgrep -f "bun src/index.ts orchestrate")` to deprioritise.

3. **Atlas is idle.** Last completed: governance debugging session (abbreviation fix, query performance fix, threshold diagnosis).

---

## WHAT WAS BUILT (March 24-25)

### Dataset Processor (complete, processing live)
- All 10 slices built, compiling clean
- Governance system with three-tier automation (T0→T1 auto, T1→T2 batch review, T2→T3 sovereignty)
- Indicator overlap fix (winner-take-all post-processing)
- Full orchestrate pipeline wired and tested
- Storage safety fixes: single DB connection, WAL checkpoint on shutdown, integrity check on startup, atomic state files
- Default database path changed to local storage (away from NFS)
- Evidence aggregator fixed to count source_component (Pile sub-components) as independent sources
- Conflicting evidence relaxed from hard block to informational warning
- Content hash index added for query performance
- Committed across multiple commits, latest at bd19afa, 623f965, 9330c9f

### Observer-Native Architecture (complete, 113 ISC criteria passing)
All five waves built in one session (20 minutes 52 seconds total):

**Runtime Spine (Four Pillars) — 59 ISC criteria:**
- P1 (465e3bc): Runtime type layer — state-types, governance-types, buffer-types, plugin-types
- P2 (e02eabd): State machine (24 transitions) + transition ledger with crash recovery
- P3 (50e30a7): Governance policy (9 action classes, DSG fast/slow classification)
- P4 (e02eabd): Bounded buffer (5 queue classes) + overflow policies
- P5 (50e30a7): Plugin contract + registry + validator (capability-bounded sandbox)
- P6 (687352f): Runtime orchestrator (cross-pillar reinforcement)
- P7 (c5772a5): Runtime bridge (module migration, wiring only, no domain logic changes)

**Rivers Architecture — 54 ISC criteria:**
- R1 (1c98233): PairedRecord types + River interface + degenerate form classifier (32 tests)
- R2 (e02eabd): Intake river (template matching, 10% blind extraction valve, BBWOP buffer)
- R3 (50e30a7): Processing river + record state machine (SQLite persistent, dual-speed channels)
- R4 (e02eabd): Reflection river (meta-observations, vault persistent, bounded recursion)
- R5 (687352f): Pairing service (matches noun-only + verb-only into PairedRecords)
- R6 (687352f): Cross-river wiring + recursion guard
- R7 (c5772a5): Convergence detection (noun-stream, verb-stream, cross-stream)
- R8 (c5772a5): Pipeline adapters (dataset-processor, scraper, governance) + governance unification adapter
- R9 (c5772a5): Vault integration + session traces

Total: 42 new files, 201/202 tests passing (1 pre-existing failure in s3/algebra)

### Design Documents Produced
- **Dual-stream D/I/R analysis** (Atlas, 342 lines): 02-Knowledge/architecture/dual-stream-dir-analysis-20260324.md
- **Rivers PRD** (Atlas, 710 lines, 54 ISC): 01-Projects/observer-native/docs/PRD-rivers-20260324.md
- **Four Pillars PRD** (Atlas, 59 ISC): 01-Projects/observer-native/docs/PRD-four-pillars-20260324.md
- **Unified build plan** (Atlas): 01-Projects/observer-native/docs/build-plan-pillars-rivers-20260324.md
- **Experimental LLM design context** (Claude): 02-Knowledge/architecture/experimental-llm-design-context-20260324.md
- **Experimental LLM D/I/R analysis** (Atlas, 402 lines, 4 passes): 02-Knowledge/architecture/experimental-llm-dir-analysis-20260324.md
- **Governance D/I/R analysis** (Atlas): 01-Projects/dataset-processor/docs/governance-dir-analysis-20260325.md
- **Storage safety D/I/R analysis** (Atlas): 01-Projects/dataset-processor/docs/storage-safety-dir-analysis-20260325.md
- **Claude's rivers design brief** (input for Atlas): 01-Projects/observer-native/docs/PRD-rivers-dual-stream-20260324.md

### Processing Results
- **Shard 00**: 606,608 candidates, 9,922 verb-records, 2 passes, healthy (on NFS, pre-fix)
- **Shard 01**: CORRUPT (deleted, being re-processed to local storage)
- **Shard 02**: 46,283 candidates, 10,000 verb-records, healthy (on NFS, pre-fix but survived)
- **Shard 03**: Partially processed before kill, cleaned up
- **Shards 04-06**: Barely started before kill, cleaned up
- **Shards 01-29**: Currently processing via fish loop to local storage

---

## CRITICAL PENDING DECISIONS

### 1. Governance Threshold Calibration
**Status: Blocked on Adam's decision**

The T1→T2 confidence threshold (0.7) was designed for Tier C model-evaluated confidence. Tier A lexical matching maxes out around 0.42. All 18 motifs with pipeline data are already at Tier 1 or 2 in the library (promoted via OCP scraper work). Zero motifs are at Tier 0, so T0→T1 auto-promotion has nothing to promote.

**Options:**
- Lower T1→T2 confidence threshold to match Tier A reality (~0.35)
- Wait for Tier C (Claude API evaluation) to produce proper confidence scores
- Create separate threshold scales for Tier A vs Tier C evidence
- Align OCP scraper governance and pipeline governance to use the same scale

**Adam's position:** The scales should match between OCP scraper and pipeline unless there's a specific reason to diverge. Pragmatic approach: align them.

### 2. Governance Sandbox Before Production
**Status: Adam's decision — validate before trusting**

Adam wants governance to run in sandbox mode first:
- Export promotion proposals to a separate directory, not the motif library
- Atlas reviews lower-tier proposals
- Adam reviews higher-tier proposals manually
- Calibrate until the system's judgment matches human judgment
- Only then open the gate for automated promotion into the canonical library

### 3. Git Tag / Restore Point
**Status: Needs doing before any automated promotions**

Tag the current motif library state so it can be restored if automated governance produces bad promotions. Simple: `git tag motif-library-pre-automation-20260325`

---

## BUGS FOUND AND FIXED

1. **SQLite WAL corruption on NFS** — Root cause: WAL mode uses mmap for -shm file coordination, NFS doesn't support POSIX mmap coherence. Fix: single DB connection (VerbRecordStore accepts external Database instance), WAL checkpoint on shutdown (TRUNCATE mode), default output to local storage. Storage safety D/I/R analysis documented.

2. **Motif ID abbreviation mismatch** — Pipeline writes abbreviations (TAC, DSG, RB) to DB. Governance reads filename-derived IDs (trust-as-curation, dual-speed-governance). Fix: motif-library-reader builds NAME_TO_ABBREVIATION map from INDICATOR_SETS, tier-promoter uses motif.abbreviation when querying evidence.

3. **Source type counting** — Evidence aggregator counted extraction methods (primed/blind) as "source types" instead of actual independent data sources. Fix: count distinct source_component values (Pile sub-components). Conflicting evidence relaxed from hard block to informational.

4. **O(n²) conflict detection query** — Self-join on source_content_hash without index caused governance to hang on ~10K records. Fix: added idx_vr_content_hash index, rewrote query to use EXISTS with LIMIT 1 short-circuit.

5. **Pipeline state race** — Two DB connections (pipeline + store) with WAL isolation meant state file never saw store's writes. Fix: single connection (root cause), plus WAL checkpoint before state save, atomic state file writes (write-to-tmp + rename).

6. **Git "unstable object source data"** — NFS/ZFS write ordering issue when git reads objects during concurrent pipeline writes. Fix: commit only source code, not volatile DB files. DB files should be in .gitignore (still needs doing).

---

## KEY THEORETICAL DEVELOPMENTS

### Dual-Stream Noun-Verb Architecture
The project shifted from verb-first to noun-verb co-primary. The insight: replacing nouns with verbs makes the same mistake as nouns-only — it's incomplete. The model needs both streams co-developing from the start, connected through a convergence layer analogous to the corpus callosum. Three motifs predicted this: Estimation-Control Separation, Dual-Speed Governance, Two Antagonistic Modes.

### The PairedRecord as Atomic Unit
Atlas's dual-stream analysis identified the PairedRecord (noun + verb + alignment) as the fundamental unit of the system. Now implemented as a TypeScript type in the rivers architecture. The dataset processor produces VerbRecords; the rivers' pairing service will match these with SolutionRecords to produce full PairedRecords. This is the bridge between current pipeline output and eventual model training input.

### Experimental LLM Vision
Extended discussion on the drive about:
- **First-principles reasoning over encyclopaedic knowledge** — a model that reasons deeply but starts knowing little
- **The family model** — local, sovereign, growing with its users over time, becoming part of the household
- **Moral reasoning from structural understanding** — not rules imposed from outside but understanding of how actions propagate through interconnected systems
- **Feelings as derivatives through semantic space** — requires persistence (local, always-on model) as a structural precondition
- **Abstraction layers** — physics → chemistry → biology → mind → information process, each emerging through D/I/R
- **The resonant cavity metaphor** (from Atlas's analysis) — the model as a tuned cavity resonating with structural depth, not a flat mirror reflecting everything equally

### Minimum Viable Experiment (from Atlas's analysis)
10K PairedRecords, two fine-tuned models (control on raw text vs experimental on paired noun-verb data), structural recognition + cross-domain transfer evaluation. Five levels of falsification defined. Buildable with existing data once governance is validated.

---

## INFRASTRUCTURE ISSUES (FLAGGED, NOT URGENT)

### Proxmox Server
- Install needs finishing — incomplete from QVO drive data loss and migration
- Backup service needs reviewing/removing
- Backup process needs proper design
- Kingston 4TB drive at 93% — unknown what's consuming space
- General architectural review needed
- **Adam's position:** Defer until processing pipeline is validated, but flag as technical debt that gets riskier over time

### Other Infrastructure Backlog
- 1Password CLI for secure API key management
- Claude Desktop MCP wiring (enables Cowork mobile dispatch)
- OILEventBridge hardcoded vault path fix
- arXiv adapter diagnostic and fix
- KDE settings reconfiguration
- Voice server replacement (Whisper/Faster-Whisper)
- spaCy installation on CachyOS VM (Tier B currently skipped)
- Add output/*.db, *.db-wal, *.db-shm to .gitignore

---

## PERSONAL CONTEXT

- Oliver's ADHD — meeting with teacher at 8:30-9:00am after night shift. Adam wants research on pharmaceutical vs natural/learning strategy approaches, Australian context (NSW), evidence base for each. Help with this when requested.
- Michelle is working on the PC during the day
- Adam on two night shifts starting tonight
- Annual leave cashout still pending
- MacBook Pro M5 Max purchase deferred (after fuel clarity)

---

## WHAT TO DO NEXT (in priority order)

### When back at PC:
1. **Git tag the motif library** as restore point: `git tag motif-library-pre-automation-20260325`
2. **Check shard processing progress** — how many shards completed, verify integrity of completed databases
3. **Align governance thresholds** — match OCP scraper and pipeline scales
4. **Run governance in sandbox mode** — proposals to separate directory, review before promoting
5. **Start processing the shard data through governance validation cycle**

### Ongoing (background):
- Shard processing continues (01-29)
- Data accumulates for MVE when ready

### Deferred:
- Proxmox infrastructure review
- Rivers running with real data (after governance validation)
- Tier C (Claude API) evaluation setup
- MVE experiment (after sufficient PairedRecords accumulated)
- Sovereignty gate promotions from the extended OCP session (Reconstruction Burden → T2, five T2 candidates, ten T0→T1)

---

## SESSION STATISTICS

- Duration: ~30 hours across two days
- Atlas build time: ~45 minutes total for 42 files, 113 ISC criteria
- Documents produced: 9 major architecture/analysis documents
- Bugs found and fixed: 6
- Shards processed: 2 complete (00, 02), 1 in progress (01 re-run), 27 queued
- Verb records accumulated: ~20,000 across shards 00 and 02
- Theoretical ground covered: consciousness, abstraction layers, moral reasoning, feelings as derivatives, the nature of life, recursive generativity at the project level
