---
name: "Trust-as-Curation"
tier: 1
status: provisional
confidence: 0.7
source: triangulated
domain_count: 8
promotion_ready: tier-2-candidate
derivative_order: "0-1"
primary_axis: integrate
created: 2026-03-03
updated: 2026-03-03
---

# Trust-as-Curation

## Structural Description

A system where trust vectors determine what enters and is retained, replacing traditional access control. Instead of binary in/out permissions, a continuous trust measure governs visibility, priority, and influence. High-trust elements are amplified; low-trust elements are attenuated but not necessarily excluded. Trust is earned through demonstrated reliability, not granted by authority.

## Domain-Independent Formulation

Trust vectors determine what enters the system and how prominently it features, replacing binary access control with continuous earned credibility.

## Instances

### Instance 1: Protocol Design (Observer Commons)
- **Domain:** Protocol Design
- **Expression:** Trust vectors in Observer Commons where Solution Records carry computed trust scores based on source reputation, documentation quality, maintenance signals, and community validation. High-trust records are surfaced prominently; low-trust records are available but deprioritised.
- **Discovery date:** 2026-03-02
- **Source:** top-down

### Instance 2: Software Architecture (OCP Scraper Trust Vectors)
- **Domain:** Software Architecture
- **Expression:** Multi-dimensional trust vectors (source reputation, documentation quality, maintenance signals, dependency health, community validation) computed for each Solution Record. Search results ranked by trust. Validation events adjust trust scores over time.
- **Discovery date:** 2026-03-03
- **Source:** top-down

### Instance 3: Industry/Policy (Mining Retraining Provider Trust)
- **Domain:** Industry/Policy
- **Expression:** Retraining provider credibility based on demonstrated outcomes rather than accreditation. Providers with strong employment outcomes earn higher trust; new providers start low and build credibility through results. Trust determines resource allocation priority.
- **Discovery date:** 2026-03-02
- **Source:** top-down

### Instance 4: Knowledge Architecture / Metacognition (Motif Confidence Scoring)
- **Domain:** Knowledge Architecture / Metacognition
- **Expression:** Motif confidence scoring where trust is earned through cross-domain confirmation, not granted by authority. High-confidence motifs participate in meta-analysis and inform future creative sessions; low-confidence motifs exist but are excluded from higher-tier operations. Triangulation (independent top-down and bottom-up confirmation) grants a +0.2 trust bonus. The library is curated by trust — not by access control — determining what knowledge enters higher cognitive operations.
- **Discovery date:** 2026-03-03
- **Source:** top-down

## Relationships

| Related Motif | Relationship | Description |
|---------------|-------------|-------------|
| Dual-Speed Governance | complement | Trust vectors operate at governance speed; operational access within trust boundaries is fast |
| Observer-Feedback Loop | composition | Trust scores are a form of observer feedback — validation events (observations) change trust (the frame) |

## Discovery Context

Identified in Observer Commons trust vector design, OCP scraper's trust computation pipeline, and mining retraining's outcome-based provider credibility system. The structural pattern — continuous earned trust replacing binary access — appeared independently in all three.

## Falsification Conditions

- If trust scores are static (set once, never updated), this is just "reputation" not a curative mechanism
- If the system works equally well with binary access control, the trust dimension adds no structural value
- If trust can be gamed easily without actual reliability, the curation function fails
