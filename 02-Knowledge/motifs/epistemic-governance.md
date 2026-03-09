---
name: "Epistemic Governance"
tier: 0
status: draft
confidence: 0.1
source: bottom-up
domain_count: 1
derivative_order: 1
primary_axis: differentiate
created: 2026-03-09
updated: 2026-03-09
cssclasses:
  - status-draft
---

# Epistemic Governance

## Structural Description

A governance system can operate at two distinct levels: functional (does the action stay within boundaries?) and epistemic (does the actor's understanding of the task match reality?). Functional governance checks constraints — file paths, scope boundaries, retry limits. Epistemic governance checks comprehension — is the direction correct, is the framing accurate, are the assumptions valid? The two levels have asymmetric cost profiles: functional violations are locally expensive but recoverable, while epistemic violations (pursuing the wrong direction) are globally expensive and compound silently.

## Domain-Independent Formulation

Governance that checks the quality of an actor's understanding produces asymmetrically higher returns than governance that checks only the boundaries of an actor's actions.

## Instances

### Instance 1: Human-AI Interaction Quality (Epistemic Protocols)
- **Domain:** AI Tool Design / Epistemology
- **Expression:** Epistemic Protocols for Claude Code structure interaction quality at every decision point. The system catches direction errors at the plan level, not the code level — intervening on understanding (are we solving the right problem?) rather than execution (are we writing to the right file?). The framing: "Fix the direction, not the implementation."
- **Discovery date:** 2026-03-09
- **Source:** bottom-up (OCP scraper: github/jongwony--epistemic-protocols)

## Relationships

| Related Motif | Relationship | Description |
|---------------|-------------|-------------|
| sovereignty | complement | Sovereignty defines WHO decides; Epistemic Governance defines WHAT is checked — whether the agent's understanding (not just its actions) is correct |
| observer-feedback-loop | composition | Epistemic checks are a specific observation target — the observer examines its own understanding, feeding comprehension quality back into the governance frame |
| dual-speed-governance | complement | Epistemic checks operate at slow speed (strategic direction) while functional checks operate at fast speed (boundary enforcement) |

## Discovery Context

Identified during OCP scrape of metacognition topic on 2026-03-09. Epistemic Protocols (jongwony/epistemic-protocols) surfaced from the metacognition topic, not the agent-framework topic. The pattern crystallised when comparing Observer-native's three governance candidates (Boundary Guardian, Scope Drift Detector, Retry-to-Gate Bridge) — all three are functional governance. None check whether the agent's understanding of the task is correct. The external data revealed this gap: the most costly errors in AI-assisted work are direction errors, not boundary violations.

## Falsification Conditions

- If epistemic governance does not produce measurably better outcomes than functional governance alone (i.e., the cost of direction errors is not significantly higher than the cost of boundary errors), then the asymmetric cost claim is wrong and the motif reduces to "more governance is better"
- If epistemic quality cannot be assessed without domain expertise equal to the actor's (i.e., you need to understand the problem as deeply as the agent to check its understanding), then epistemic governance is impractical as a structural pattern and reduces to "have a smarter supervisor"
- If the functional/epistemic distinction is not domain-independent — if it only applies to human-AI interaction and not to, e.g., organisational governance, legal systems, or engineering review processes — then the formulation is too narrow
