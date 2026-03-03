---
name: "Dual-Speed Governance"
tier: 1
status: provisional
confidence: 0.3
source: "top-down"
domain_count: 3
created: 2026-03-03
updated: 2026-03-03
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

## Relationships

| Related Motif | Relationship | Description |
|---------------|-------------|-------------|
| Observer-Feedback Loop | complement | Feedback operates at fast speed; dual-speed governance constrains how feedback changes the system |
| Trust-as-Curation | complement | Trust vectors operate at governance speed; access within trust boundaries operates at operational speed |

## Discovery Context

Emerged across Observer Commons protocol design, OCP scraper architecture, and mining retraining policy design. All three independently produced systems with two coupled cycles running at different speeds. The pattern was most explicitly articulated in the OCP scraper's dual-speed cycle architecture.

## Falsification Conditions

- If the two speeds are actually independent (no coupling between them), this is just "two separate systems" not a governance pattern
- If the slow cycle can be bypassed without consequences, the governance structure is illusory
- If the pattern reduces to "some things are fast and some are slow" without structural coupling, it's too vague to be a genuine motif
