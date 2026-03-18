---
name: "Drift Toward Regularity Under Repeated Transmission"
tier: 0
status: draft
confidence: 0.1
source: top-down
domain_count: 1
derivative_order: 2
primary_axis: recurse
created: 2026-03-19
updated: 2026-03-19
cssclasses: [status-draft]
---

# Drift Toward Regularity Under Repeated Transmission

## Structural Description

When a complex system is repeatedly passed through a copy-transmit-receive cycle across many generations, irregular forms tend to erode and regular forms tend to dominate. Each transmission event introduces small losses or simplifications. Irregular elements, which must be memorized individually, are more vulnerable to these losses than regular elements, which can be reconstructed from rules. Over time, the system becomes more compressible — its description length shrinks — even though no single agent is deliberately simplifying it. The regularization is emergent, arising from the interaction of lossy transmission with the differential robustness of regular versus irregular forms.

## Domain-Independent Formulation

Iterated lossy transmission differentially erodes irregular forms, driving the system toward increasing regularity and compressibility without deliberate simplification.

## Instances

### Instance 1: Linguistics — Language Regularization Over Generations

- **Domain:** Linguistics / Historical Linguistics
- **Expression:** Irregular verb forms erode over generations. English once had far more strong verb conjugations (like "holp" for "helped"); most have regularized to the -ed pattern. Children over-regularize ("goed" for "went"), and over time these pressures reshape the language toward rule-governed forms. Sound changes apply regularly across the lexicon (Grimm's law, the Great Vowel Shift), sweeping exceptions into regular patterns.
- **Discovery date:** 2026-03-19
- **Source:** top-down

### Instance 2: Information Theory — Iterative Decoding Convergence

- **Domain:** Information Theory
- **Expression:** Turbo codes and LDPC codes approach channel capacity through iterated decoding passes. Each pass regularizes the soft estimates, driving the system toward the cleanest decodable structure. Irregular (ambiguous) bit estimates are resolved by repeated message-passing until the solution converges to a regular, unambiguous state.
- **Discovery date:** 2026-03-19
- **Source:** top-down

## Relationships

| Related Motif | Type | Description |
|---|---|---|
| Progressive Formalization | tension | PF describes deliberate progression from amorphous to crystalline; Drift Toward Regularity describes the same trajectory but arising emergently from iterated transmission rather than intentional design. They share a direction but differ in mechanism. |
| Idempotent State Convergence | complement | ISC describes systems that converge to a declared target state; Drift Toward Regularity describes systems that converge toward regularity without any declared target — the "target" is an emergent attractor. |
| Ratchet with Asymmetric Friction | complement | Regularization is itself a ratchet: once irregular forms are lost, they are not spontaneously regenerated, so the drift is irreversible. |

## Discovery Context

Discovered during a slow triad exploring information theory and linguistics. Language regularization over generations and iterative decoding convergence independently surfaced the same structural shape: iterated processing that erodes irregularity and drives toward compressibility.

## Falsification Conditions

- If iterated transmission could be shown to produce equal rates of regularization and irregularization (i.e., the drift is directionless), the motif would be wrong about the asymmetry.
- If irregular forms could be shown to be equally robust to transmission loss as regular forms (i.e., memorized exceptions survive copying as well as rule-generated forms), the mechanism would be absent and the observed regularity increase would need a different explanation.
