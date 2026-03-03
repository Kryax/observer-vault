---
name: "Observer-Feedback Loop"
tier: 1
status: provisional
confidence: 0.4
source: "top-down"
domain_count: 3
created: 2026-03-03
updated: 2026-03-03
---

# Observer-Feedback Loop

## Structural Description

A system where the output of observation feeds back into the observer's frame of reference, causing the observation framework itself to evolve. The act of observing changes the lens through which future observations are made. This creates a co-evolutionary dynamic between the observer and the observed.

## Domain-Independent Formulation

The thing being observed feeds back into the observer's frame of reference, causing the observation framework to evolve.

## Instances

### Instance 1: Protocol Design (Observer Commons Identity Primitive)
- **Domain:** Protocol Design
- **Expression:** Witness attestation mechanism where peers validate each other's state changes. The act of witnessing updates the witness's own identity state, changing how future attestations are evaluated.
- **Discovery date:** 2026-03-02
- **Source:** top-down

### Instance 2: Industry/Policy (Mining Workforce Retraining)
- **Domain:** Industry/Policy
- **Expression:** Adaptive control function where retraining outcomes adjust the control parameters for future retraining programs. The system learns from its own outputs, modifying the criteria by which future interventions are designed.
- **Discovery date:** 2026-03-02
- **Source:** top-down

### Instance 3: Software Architecture (OCP Scraper Template Engine)
- **Domain:** Software Architecture
- **Expression:** Problem Template Engine where usage patterns reshape the classification ontology. Search queries and validation events feed back into how problems are categorised, causing the template system to evolve through use.
- **Discovery date:** 2026-03-03
- **Source:** top-down

## Relationships

| Related Motif | Relationship | Description |
|---------------|-------------|-------------|
| Dual-Speed Governance | complement | Observer-Feedback operates at fast speed; governance constrains how feedback changes the frame |
| Template-Driven Classification | composition | Templates are a specific instance of the observer's frame; feedback loop is the mechanism by which templates evolve |

## Discovery Context

First identified during the creative methodology test sessions (OscillateAndGenerate + ConvergeAndEvaluate) across three different domains: Observer Commons identity primitive, mining workforce retraining, and GitHub bootstrapping architecture. All three sessions independently produced systems where the observed output feeds back into the observer's frame of reference.

## Falsification Conditions

- If instances can only be described using the specific domain vocabulary (i.e., "witness attestation" is not structurally equivalent to "adaptive control function"), then this is not a genuine cross-domain pattern
- If the feedback loop in any instance is one-directional (output doesn't actually change the observation framework), then that instance should be retracted
- If the pattern is simply "systems that learn from data" (too broad to be structurally specific), then the formulation needs tightening or the motif is invalid
