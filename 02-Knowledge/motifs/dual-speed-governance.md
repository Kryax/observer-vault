---
name: "Dual-Speed Governance"
tier: 2
status: canonical
confidence: 1.0
source: "triangulated"
domain_count: 8
created: 2026-03-03
updated: 2026-03-03
promoted: 2026-03-03
promotion_justification: "Bottom-up triangulation from triad run across 112 repos. Pattern independently emerged in 4 domains: migration, auth, monitoring, CLI."
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

## Falsification Conditions

- If the two speeds are actually independent (no coupling between them), this is just "two separate systems" not a governance pattern
- If the slow cycle can be bypassed without consequences, the governance structure is illusory
- If the pattern reduces to "some things are fast and some are slow" without structural coupling, it's too vague to be a genuine motif
