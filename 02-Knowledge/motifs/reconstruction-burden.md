---
name: "Reconstruction Burden from Lossy Boundary Operations"
tier: 1
status: provisional
confidence: 0.8
source: triangulated
domain_count: 14
derivative_order: 1
primary_axis: differentiate
created: 2026-03-22
updated: 2026-03-22
cssclasses:
  - status-provisional
---

# Reconstruction Burden from Lossy Boundary Operations

## Structural Description

When information is lost at an interface boundary, downstream systems must be overprovisioned to compensate. The magnitude of the reconstruction burden is proportional to how much structure the boundary operation destroys relative to what downstream processing needs. The boundary operator is typically unaware of the cost it imposes — the cost flows one way with no feedback mechanism.

## Domain-Independent Formulation

A lossy boundary operation creates a downstream reconstruction burden proportional to the structure destroyed, and the boundary operator is blind to the cost it imposes.

## Instances

### Instance 1: NLP / Transformer Architecture
- **Domain:** Natural Language Processing
- **Expression:** BPE tokenisation destroys process/verb structure. The attention mechanism spends parameters reconstructing it. SSMs outperform transformers on byte-level sequences because their continuous compression handles lossy tokenisation better.
- **Discovery date:** 2026-03-22
- **Source:** top-down (D/I/R analysis of transformer architecture)

### Instance 2: Signal Processing
- **Domain:** Signal Processing
- **Expression:** Nyquist theorem — sample below the Nyquist rate and the original signal cannot be reconstructed. Downstream interpolation and filtering cannot compensate for aliasing.
- **Discovery date:** 2026-03-22
- **Source:** top-down

### Instance 3: Physics
- **Domain:** Thermodynamics / Information Theory
- **Expression:** Landauer's principle — erasing one bit of information dissipates at least kT ln 2 of energy. The most precisely quantified reconstruction burden in nature. Information destruction has an irreducible physical cost.
- **Discovery date:** 2026-03-22
- **Source:** bottom-up (OCP scraper, SEP)

### Instance 4: Governance / Law
- **Domain:** Statutory Interpretation
- **Expression:** Legislation compresses policy intent into text. Courts must reconstruct legislative intent — the entire field of statutory interpretation is a reconstruction burden imposed by the compression boundary.
- **Discovery date:** 2026-03-22
- **Source:** bottom-up (OCP scraper, SEP)

### Instance 5: Software Engineering
- **Domain:** API Design / Microservices
- **Expression:** Narrow APIs lose caller context. Consumers must make multiple calls to reconstruct what the boundary stripped. Microservice decomposition creates boundaries that force cross-service reconstruction of relationships.
- **Discovery date:** 2026-03-22
- **Source:** bottom-up (OCP scraper, GitHub)

### Instance 6: Audio/Video Engineering
- **Domain:** Codec Design
- **Expression:** Lossy codecs (MP3, H.264) destroy information at encoding. LaDiffCodec uses diffusion process specifically to undo quantisation loss — a system designed to be the reconstruction burden.
- **Discovery date:** 2026-03-22
- **Source:** bottom-up (OCP scraper, arXiv/GitHub)

### Instance 7: Economics
- **Domain:** Supply Chain / Information Asymmetry
- **Expression:** Beer Distribution Game / bullwhip effect. Each handoff between firms loses context. Demand signal distortion amplifies through the chain — reconstruction burden compounds at each boundary.
- **Discovery date:** 2026-03-22
- **Source:** bottom-up (OCP scraper)

## Relationships

| Related Motif | Relationship | Description |
|---------------|-------------|-------------|
| Bounded Buffer With Overflow Policy | sibling | BBWOP's overflow is a specific case where the boundary's capacity is exceeded — RB provides the cost function |
| Progressive Formalization | inverse | PF preserves content through formalisation stages — the anti-RB pattern |
| Ratchet with Asymmetric Friction | explained-by | RB provides the cost function that makes ratcheting asymmetric — reversal requires reconstruction |

## Discovery Context

Emerged from D/I/R analysis of transformer architecture (Claude advisory session, 2026-03-22). The observation that BPE tokenisation destroys process structure and attention must reconstruct it generalised to a cross-domain pattern. Validated across 14 domains through OCP scraper runs.

## Falsification Conditions

- A system where a lossy boundary operation does NOT create downstream overhead (the downstream system performs equally well regardless of what the boundary destroys)
- A system where the reconstruction burden is independent of how much structure was lost (flat cost regardless of destruction magnitude)
- Evidence that the boundary operator typically IS aware of and responsive to the cost it imposes (breaking the "blind boundary" invariant)
