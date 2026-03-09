---
name: "Kill-Ratio as Health Signal"
tier: 0
status: draft
confidence: 0.1
source: bottom-up
domain_count: 1
derivative_order: 1
primary_axis: integrate
created: 2026-03-09
updated: 2026-03-09
cssclasses:
  - status-draft
---

# Kill-Ratio as Health Signal

## Structural Description

A system that generates more candidates than it keeps, and tracks the ratio explicitly, is healthier than one that keeps most of what it generates. The kill mechanism is not failure — it is the system's primary quality filter. High kill ratios correlate with high confidence in survivors. Systems that track kills explicitly (rather than quietly discarding) accumulate meta-knowledge about what kinds of candidates fail, improving future generation quality.

## Domain-Independent Formulation

The ratio of discarded candidates to retained candidates, when tracked explicitly, serves as a reliable health indicator — healthy systems kill more than they keep.

## Instances

### Instance 1: Observer Project Development
- **Domain:** Software Project Development / Epistemic Systems
- **Expression:** The motif tier system retains only 4 of 13 motifs at operational threshold (Tier 2), with 69% still below. The Fourth Iteration consciousness document classifies claims into GROUNDED, UNTESTED, OVER-ELABORATED, and KILLED — "KILLED" is an explicit category with named entries. The observer-native PRD has an explicit "What It Discards" table naming 5 PAI components deliberately left behind. Experiment 1 killed forced-divergence as a mechanism with HIGH confidence. In each case, the kill is tracked, named, and preserved as part of the system's record.
- **Discovery date:** 2026-03-09
- **Source:** bottom-up (archaeological analysis of development history decision patterns)

## Relationships

| Related Motif | Relationship | Description |
|---------------|-------------|-------------|
| trust-as-curation | composition | Curation IS the kill mechanism — trust-as-curation describes the mechanism by which items are retained or discarded; kill-ratio describes the health signal that the ratio produces |
| observer-feedback-loop | complement | The feedback loop generates candidates; kill-ratio measures whether the loop is discriminating enough — a feedback loop with a low kill ratio is amplifying noise |
| bounded-buffer-with-overflow-policy | tension | Buffer overflow policies are implicit kill mechanisms (drop oldest, drop newest); kill-ratio asks whether the system tracks what it drops and learns from the pattern |

## Discovery Context

Identified during an archaeological triad analysis of the Observer project's own development history on 9 March 2026. The Decision lens (one of three independent perspectives) observed that every major decision either killed an assumption or cut a dependency. The convergence phase identified this as part of the "system prunes itself" invariant — the project's health correlated with its willingness to explicitly discard.

## Falsification Conditions

- If systems with low kill ratios (keeping most of what they generate) achieve equivalent or better quality outcomes compared to high-kill-ratio systems, then the ratio is descriptive rather than diagnostic
- If tracking kills explicitly provides no advantage over quiet discarding (i.e., the meta-knowledge about failure patterns does not improve future generation), then the "explicit tracking" component of the motif is decorative
- If the pattern only applies to epistemic or creative systems and has no analog in engineering, biological, or economic systems, then it is domain-specific rather than structural
