# Experiment 1 Result — Angular Separation Detection (E1)

**Date:** 2026-02-10
**Status:** LOCKED (final, do not relitigate)

## Setup
- Problem: CONF-01 (security boundaries vs human absolute authority) at exit boundaries
- Run A (Divergent): 3 teammates with structurally different analytical frames (verification doctrine, failure mode analysis, institutional design)
- Run B (Cosmetic): 3 teammates with different analyst names but same generic analytical approach (Analyst Alpha, Beta, Gamma)
- Both runs synthesized by a lead in identical format
- Presented blinded as Output X (Run B/Cosmetic) and Output Y (Run A/Divergent)

## Result
- **Selected output:** Output X (Run B — the Cosmetic condition)
- **Confidence:** HIGH
- **Rationale:** "Detection of structurally incompatible framings (monolithic security default vs tiered risk ontology) integrated under tension rather than cosmetic variation"
- **Actual condition:** Adam selected the Cosmetic run as containing more genuine diversity

## Interpretation
The human evaluator identified the cosmetic-condition output as more diverse with high confidence. The forced-divergent condition was NOT detected as more diverse.

This means:
1. Prompt-level structural divergence (forcing different analytical frames) did not reliably produce outputs that a human identifies as more genuinely diverse
2. The "cosmetic" condition independently generated structural divergence (Analyst Gamma's tiered risk model vs Alpha/Beta's flag-and-hold) without being prompted to do so
3. Angular separation detection at the synthesis level is unreliable — the evaluator's cited evidence ("structurally incompatible framings") was actually present in the condition NOT designed to produce it
4. The expected failure mode from the experiment plan materialized: "Both outputs look similarly diverse because the same underlying model produces plausible-sounding disagreements regardless of prompt structure" — but with the additional finding that the evaluator was confidently wrong, not merely uncertain

## What This Informs
Angular separation, as currently conceived, cannot reliably serve as an enforceable exit gate based on synthesis-level review. The invariant may be aspirational rather than functional at the synthesis layer.

Experiment 4 (raw perspective depth probe) was skipped. Whether detection improves with access to raw perspectives remains untested — this is addressed by Experiment 3's design (raw vs synthesis-only presentation).
