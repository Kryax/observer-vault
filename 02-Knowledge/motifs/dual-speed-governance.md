---
name: "Dual-Speed Governance"
tier: 2
status: canonical
confidence: 1.0
source: "triangulated"
domain_count: 12
created: 2026-03-03
updated: 2026-03-03
promoted: 2026-03-03
promotion_justification: "Bottom-up triangulation from triad run across 112 repos. Pattern independently emerged in 4 domains: migration, auth, monitoring, CLI."
derivative_order: 2
primary_axis: integrate
cssclasses:
  - status-canonical
---

# Dual-Speed Governance

## Structural Description

A system with two coupled operational cycles running at different speeds: a fast cycle for operational decisions and a slow cycle for constitutional/structural decisions. The slow cycle constrains the fast cycle but does not micromanage it. Changes to the governance frame happen slowly and deliberately, while operations within that frame can move quickly.

## Domain-Independent Formulation

Fast operational cycles governed by slow constitutional cycles, where the slow cycle constrains but does not control the fast cycle.

## Instances

### Instance 1: Protocol Design (Observer Commons)
- **Domain:** Protocol Design
- **Expression:** Observer Commons governance where OIL (slow constitutional layer) constrains operational decisions (fast layer). Constitutional changes require deliberate multi-stakeholder process; operational decisions within those constraints are autonomous.
- **Discovery date:** 2026-03-02
- **Source:** top-down

### Instance 2: Software Architecture (OCP Scraper Dual-Speed Cycle)
- **Domain:** Software Architecture
- **Expression:** Scraper's dual-speed feedback cycle: fast cycle (query→search→results) and slow cycle (feedback analysis→template proposals→governance approval→reclassification). Templates change slowly through governance; search operates quickly within the template frame.
- **Discovery date:** 2026-03-03
- **Source:** top-down

### Instance 3: Industry/Policy (Mining Retraining Governance)
- **Domain:** Industry/Policy
- **Expression:** Retraining program governance where individual program adjustments happen quickly (adaptive control function), but the overarching policy framework changes slowly through deliberate review cycles. Fast operational adaptation within slow policy evolution.
- **Discovery date:** 2026-03-02
- **Source:** top-down

### Instance 4: Knowledge Architecture / Metacognition (Motif Library Tier Governance)
- **Domain:** Knowledge Architecture / Metacognition
- **Expression:** The motif library's tier system embodies dual-speed governance. Fast cycle: Tier 0 and Tier 1 entries are auto-created at session speed — every reflection session can deposit new observations and auto-promote cross-domain patterns without friction. Slow cycle: Tier 2+ promotions require human review, validation protocol (5 conditions), and explicit approval. The governance frame (what counts as a structural operator) evolves slowly and deliberately; knowledge within that frame grows quickly through reflection.
- **Discovery date:** 2026-03-03
- **Source:** top-down

### Instance 5: Database Migration (Bottom-Up — Flyway, golang-migrate, dbmate)
- **Domain:** Database Migration
- **Expression:** Migration tools enforce dual-speed governance: schema changes (slow cycle) go through versioned, ordered, human-reviewed migration files that cannot be skipped or reordered; queries against the resulting schema (fast cycle) execute freely at application speed. The migration framework constrains the schema evolution speed while leaving runtime query execution unconstrained within the migrated schema.
- **Discovery date:** 2026-03-03
- **Source:** bottom-up (OCP scraper, 112-repo triad run — data-management category: flyway, golang-migrate, dbmate, goose, fluentmigrator, evolve, django-migration-linter, upscheme)

### Instance 6: Authentication & Authorization (Bottom-Up — Authelia, Casdoor, next-auth)
- **Domain:** Authentication & Authorization
- **Expression:** Auth systems separate slow policy authoring (access rules, role hierarchies, OIDC/SAML configuration) from fast enforcement (per-request token validation, session checks). Policy changes go through admin review, config reload, or governance approval cycles; enforcement of those policies happens at request speed with no deliberation. Authelia's access control rules vs. its per-request middleware exemplify this split.
- **Discovery date:** 2026-03-03
- **Source:** bottom-up (OCP scraper, 112-repo triad run — web-development category: authelia, casdoor, next-auth, hanko, cas)

### Instance 7: Monitoring & Observability (Bottom-Up — Grafana, Netdata, OpenObserve)
- **Domain:** Monitoring & Observability
- **Expression:** Monitoring platforms separate slow rule/dashboard authoring (alert definitions, recording rules, dashboard configuration) from fast metric evaluation (continuous scraping, real-time alerting, query execution). Grafana's alerting pipeline: slow governance cycle creates and reviews alert rules; fast evaluation cycle fires every scrape interval against those rules without human involvement. Rule changes are deliberate; evaluation is autonomous.
- **Discovery date:** 2026-03-03
- **Source:** bottom-up (OCP scraper, 112-repo triad run — data-management/devops: grafana, netdata, openobserve, hertzbeat, coroot, signoz, pyroscope)

### Instance 8: CLI Frameworks (Bottom-Up — Bubbletea, Bashly, CAC)
- **Domain:** CLI Frameworks
- **Expression:** CLI frameworks separate slow configuration/definition (command tree structure, flag schemas, help text, validation rules) from fast interactive execution (user input processing, keystroke handling, rendering). Bubbletea's model-update-view cycle operates at keystroke speed (fast), but the program's command structure and model shape are defined once at init time (slow). Bashly generates the entire command parser from a YAML spec (slow authoring) that then handles user input at runtime speed (fast execution).
- **Discovery date:** 2026-03-03
- **Source:** bottom-up (OCP scraper, 112-repo triad run — developer-tools: bubbletea, bashly, cac, picocli, vorpal, wp-cli)

### Instance 9: Game Engine Architecture (Bottom-Up — Bevy, Godot)
- **Domain:** Game Engine Architecture
- **Expression:** Game engines separate slow system configuration (plugin registration, resource setup, schedule definition at startup or editor time) from fast runtime execution (per-frame ECS system updates at 60+ fps). Bevy's `App::new().add_plugins()` defines the complete system topology at init time (slow, deliberate); the frame update loop executes systems autonomously within that topology (fast). Godot's editor/addon development cycle (slow: plugin development, asset store review) governs the runtime scene tree tick (fast: physics/render updates). You cannot add a new system during a frame tick — you must go through the slow configuration path.
- **Discovery date:** 2026-03-03
- **Source:** bottom-up (OCP scraper, alien domain triad run — game-development: bevyengine/bevy 45k★, godotengine/godot 107k★)

### Instance 10: Bioinformatics Pipeline Architecture (Bottom-Up — Nextflow, GATK)
- **Domain:** Bioinformatics / Computational Biology
- **Expression:** Bioinformatics pipeline frameworks separate slow workflow definition (writing DSL pipeline files, peer review, version control) from fast task execution (parallelized computation across HPC/cloud nodes). Nextflow's Groovy DSL defines the pipeline DAG at authoring time (slow, deliberate); task execution fans out across compute nodes autonomously within the DAG (fast). GATK's walker framework separates tool definition with formal interfaces (slow: development, validation against gold-standard datasets) from per-read/per-locus data traversal at genome scale (fast). The pipeline topology constrains what can execute; execution is autonomous within those constraints.
- **Discovery date:** 2026-03-03
- **Source:** bottom-up (OCP scraper, alien domain triad run — bioinformatics: nextflow-io/nextflow 3.3k★, broadinstitute/gatk 1.9k★)

### Instance 11: Spaced Repetition Scheduling (Bottom-Up — FSRS4Anki)
- **Domain:** Spaced Repetition / Cognitive Science
- **Expression:** FSRS4Anki separates slow algorithm parameter optimization (machine learning on accumulated review history, producing scheduling parameters) from fast per-review scheduling decisions (given current parameters, compute next review interval in milliseconds). The optimizer runs periodically as a deliberate analytical process (slow cycle) and produces parameters that constrain the scheduling function (fast cycle). The scheduling function executes autonomously within the parameter frame — it cannot modify the parameters, only consume them. Re-running the optimizer with more review data produces new parameters that change scheduling behavior. The slow cycle governs the fast cycle.
- **Discovery date:** 2026-03-03
- **Source:** bottom-up (OCP scraper, alien domain triad run — spaced-repetition: open-spaced-repetition/fsrs4anki 3.8k★)

### Instance 12: Music Production / Digital Audio Workstation (Bottom-Up — Zrythm)
- **Domain:** Music Production / Audio Engineering
- **Expression:** DAWs separate slow project configuration (signal routing, plugin chain setup, automation curve authoring at human speed) from fast real-time audio rendering (sample-accurate processing at 44.1kHz/48kHz). Zrythm's automation curves are literally slow governance of fast DSP — a curve authored at human speed controls a plugin parameter that changes at audio sample rate. Plugin chain ordering and signal routing are configured deliberately (slow); the audio engine renders autonomously within that routing (fast). Reconfiguring signal routing at sample rate would be impossible and meaningless — the slow cycle's deliberation is structurally essential.
- **Discovery date:** 2026-03-03
- **Source:** bottom-up (OCP scraper, alien domain triad run — music-production: zrythm/zrythm 2.9k★)

## Validation Protocol (Tier 2)

All five conditions satisfied:

1. **Domain-independent description:** YES — "Fast operational cycles governed by slow constitutional cycles" uses no domain-specific vocabulary.
2. **Cross-domain recurrence:** YES — 8 unrelated domains: Protocol Design, Software Architecture, Industry/Policy, Knowledge Architecture, Database Migration, Authentication, Monitoring, CLI Frameworks.
3. **Predictive power:** YES — Knowing this motif in a new domain immediately suggests: separate the config/governance authoring path from the operational execution path, make authoring deliberate and auditable, make execution autonomous within those constraints.
4. **Adversarial survival:** YES — This is not merely "some things are fast and some are slow." The structural coupling is essential: the slow cycle *constrains* the fast cycle. Removing the coupling (making them independent) eliminates the governance property.
5. **Clean failure:** YES — See Falsification Conditions section.

## Relationships

| Related Motif | Relationship | Description |
|---------------|-------------|-------------|
| Observer-Feedback Loop | complement | Feedback operates at fast speed; dual-speed governance constrains how feedback changes the system |
| Trust-as-Curation | complement | Trust vectors operate at governance speed; access within trust boundaries operates at operational speed |

## Discovery Context

**Top-down (2026-03-02/03):** Emerged across Observer Commons protocol design, OCP scraper architecture, mining retraining policy, and motif library tier governance. All four independently produced systems with two coupled cycles running at different speeds.

**Bottom-up (2026-03-03):** Triad run across 112 repos in the OCP scraper corpus independently surfaced the same structural pattern in 4 additional domains: database migration (slow schema/fast queries), authentication (slow policy/fast enforcement), monitoring (slow rule authoring/fast evaluation), and CLI frameworks (slow config/fast interaction). The pattern was found without prompting for it — corpus analysis converged on dual-speed coupling as a recurrent architectural choice.

**Triangulation confirmed:** Top-down creative reflection and bottom-up corpus analysis independently identified the same structural motif, meeting the triangulation criterion defined in _SCHEMA.md.

## Confidence Score Arithmetic

Per `_SCHEMA.md` confidence rules:

| Step | Event | Change | Running Total |
|------|-------|--------|---------------|
| 1 | Motif created with Instance 1 (Protocol Design) | Start at 0.1 | 0.1 |
| 2 | Instance 2 added (Software Architecture) | +0.1 | 0.2 |
| 3 | Instance 3 added (Industry/Policy) | +0.1 | 0.3 |
| 4 | Instance 4 added (Knowledge Architecture) | +0.1 | 0.4 |
| 5 | Instance 5 added (Database Migration, bottom-up) | +0.1 | 0.5 |
| 6 | Instance 6 added (Auth, bottom-up) | +0.1 | 0.6 |
| 7 | Instance 7 added (Monitoring, bottom-up) | +0.1 | 0.7 |
| 8 | Instance 8 added (CLI, bottom-up) | +0.1 | 0.8 |
| 9 | Triangulation confirmed (top-down + bottom-up) | +0.2 | 1.0 |

**Final: 1.0** (at maximum). 8 domain instances (0.1 start + 7 × 0.1 = 0.8) + triangulation bonus (0.2) = 1.0.

## Counterexamples / Non-instances

Systems or domains where dual-speed governance plausibly *could* apply but structurally does not:

### Non-instance 1: Pure Streaming / Dataflow Systems (e.g., Apache Kafka topic partitions)

Kafka topics operate at a single speed: messages flow through partitions at a rate determined by producers and consumers. Topic configuration (partition count, retention policy, replication factor) *looks* like a slow governance layer, but structurally the configuration is not a "governance cycle" — it's a one-time setup with infrequent changes, not a continuously operating slow cycle that constrains a fast cycle. The configuration doesn't "run" — it just *is*. There's no deliberative slow process that repeatedly evaluates and adjusts constraints on the fast flow. This distinguishes dual-speed governance (two *active* coupled cycles) from simple "configuration + runtime" (a static setting + a dynamic process).

### Non-instance 2: Peer-to-Peer Networks Without Central Governance (e.g., BitTorrent DHT)

BitTorrent's DHT operates entirely at one speed: every node makes autonomous routing and sharing decisions at network speed. There is no slow constitutional cycle constraining the fast operational cycle — the protocol rules are baked into the software, not governed by a deliberative process that can evolve independently. Changing the protocol requires a new software release adopted by the swarm, which is more akin to a version upgrade than a governance cycle. The absence of a *running* slow cycle that can independently constrain the fast cycle means this is a single-speed system with a static ruleset, not dual-speed governance.

### Non-instance 3: Real-Time Game Physics Engines

Game physics simulations run at a fixed timestep (e.g., 60Hz) with no governance layer. The rules of physics (gravity, collision response, friction) are constants compiled into the engine, not a slow cycle that evaluates and adjusts constraints. There's no deliberative process that can change *which* physics rules apply at governance speed — they're static for the lifetime of the simulation. "Fast simulation governed by immutable rules" is not dual-speed governance; it's "fast simulation with constants."

## Falsification Conditions

- If the two speeds are actually independent (no coupling between them), this is just "two separate systems" not a governance pattern
- If the slow cycle can be bypassed without consequences, the governance structure is illusory
- If the pattern reduces to "some things are fast and some are slow" without structural coupling, it's too vague to be a genuine motif
