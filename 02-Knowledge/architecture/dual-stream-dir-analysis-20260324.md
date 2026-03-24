---
status: DRAFT
date: 2026-03-24
author: Atlas
type: architecture
authority: low
domain: [observer-native, dataset-processing, motif-library, model-training]
method: 3-pass D/I/R triad (slow mode — each pass transforms what came before)
mode: analysis
motifs: [dual-speed-governance, reconstruction-burden, observer-feedback-loop, progressive-formalization, hidden-structure-surface-form-separation]
refs:
  - 01-Projects/dataset-processor/docs/design-orientation-20260323.md
  - 01-Projects/dataset-processor/docs/PRD-dataset-processor-20260323.md
  - 01-Projects/observer-native/docs/observer-v3-dir-process-contract-20260319.md
  - 01-Projects/observer-native/docs/four_pillars_design_memo.md
  - 02-Knowledge/motifs/MOTIF_INDEX.md
  - 02-Knowledge/architecture/Theory_To_Architecture_20260305.md
provenance: >
  Three-pass D/I/R analysis performed by Atlas on 2026-03-24. Slow triad mode —
  each pass reads the output of the prior pass before running. Triggered by the
  architectural insight that the project has shifted from verb-first to dual-stream
  noun-verb architecture.
---

# Dual-Stream D/I/R Analysis

> What changed, what survived, and what shape the project is becoming.

---

# Pass 1 — DISTINGUISH

## What exactly changed with the dual-stream insight?

### The prior architecture was verb-first

The design orientation (2026-03-23) and PRD describe a system that produces **VerbRecords** — process-shaped extractions describing what things DO. The OCP scraper was already producing **SolutionRecords** — noun-shaped descriptions of what things ARE. These were treated as complementary but separate concerns: the scraper does nouns, the dataset processor does verbs, both feed the motif library.

The Observer v3.0 process contract (2026-03-19) reinforced this framing: "If rivers only carry summaries, notes, or documents, then Observer becomes a noun-passing system." The prescription was to make rivers carry **verb-typed process metadata** — what happened, how many cycles, what stabilized, what failed. The emphasis was overwhelmingly on verbs as the primary carrier of cognitive value.

### The shift: dual-stream means nouns and verbs are co-primary

The dual-stream insight reframes this. The system no longer treats nouns as the scraper's concern and verbs as the processor's concern. Instead, **every record is a noun-verb pair**. The PRD already contains this in embryonic form:

> "Noun stream: Raw source passages train text representation (what things ARE)"
> "Verb stream: Extracted verb-records train process representation (what things DO)"

But the design orientation treated this as a training data format decision. The dual-stream insight elevates it to an architectural principle: **the atomic unit of data is the paired noun-verb record, not the verb-record alone**.

### What this means concretely

1. **SolutionRecords and VerbRecords are not two record types for two tools.** They are two projections of the same underlying entity. A motif instance is simultaneously something (noun) and does something (verb). The scraper and processor are not producing different record types — they are producing different views of the same structural reality.

2. **Rivers change.** The v3.0 process contract prescribed verb-typed rivers. Dual-stream means rivers carry both noun and verb metadata in structural alignment. A river isn't "what happened" (verb-only). It's "what thing was observed doing what process" (noun-verb pair).

3. **Model training changes.** Instead of a single-stream model that learns text representations plus a separate verb-typed wrapper, a dual-stream architecture trains two coupled streams simultaneously — one for entity/state representation (noun), one for process/transformation representation (verb) — with a convergence layer that learns the mapping between them.

4. **The motif library's shape may change.** Currently motifs are classified on a single axis system (differentiate/integrate/recurse) with derivative order. This is verb-native — it describes process shape. A noun dimension would classify motifs by what structural entities they operate on, not just what they do.

### Where are the real boundaries between noun and verb?

The boundary is not between different record types or different tools. It is between two complementary representations of the same structural instance:

| Dimension | Noun Projection | Verb Projection |
|-----------|----------------|-----------------|
| **Question** | What is it? | What does it do? |
| **SolutionRecord field** | `summary`, `domain`, `tags` | (absent — SolutionRecords are noun-only) |
| **VerbRecord field** | `source.rawText`, `domain` | `process.shape`, `process.operators`, `process.axis` |
| **Motif library field** | structural description, instances | axis, derivative order, operator vocabulary |
| **River content** | entity, state, context | process, transition, stabilization |
| **Training signal** | representation learning | transformation learning |

The critical observation: **SolutionRecords have no verb dimension. VerbRecords have a noun dimension (source.rawText) but treat it as provenance, not as a first-class training signal.** Neither record type fully represents the pair.

### The atomic unit of data

**The paired noun-verb record** — not the VerbRecord alone — is the atomic unit. It consists of:

- **Noun component**: What structural entity exists, in what domain, with what properties
- **Verb component**: What transformation/process this entity enacts or undergoes, with what operators, on what axis, at what derivative order
- **Alignment**: The noun and verb refer to the same structural instance, linked by source provenance

The dataset processor's `paired-exporter.ts` already produces this: `{"source": <raw text>, "verb_record": <VerbRecord>}`. But this is an export format, not an architectural primitive. The distinction matters.

## What survives unchanged?

### Fully intact

1. **The motif library** — 34 motifs, 9 at Tier 2, the algebra, the gap engine, the validation protocol. These are process descriptions (verb-shaped) and remain correct. The dual-stream insight doesn't invalidate them — it adds a noun dimension that was previously implicit.

2. **The motif algebra** — c/i/d stabilisation, operator vocabulary, MotifRecord/InstanceRecord types. Pure verb-shaped. Survives as the verb-stream algebra. A noun-stream algebra would be a separate concern (entity classification, state typing).

3. **The four pillars** — DSG, ESMB, CPA, BBWOP. These are governance and runtime patterns. They describe how the system operates, not what data it processes. Dual-stream doesn't change governance.

4. **The dataset processor's three-tier architecture** — Tier A lexical filtering, Tier B spaCy structural parsing, Tier C model-assisted evaluation. The processing pipeline is intact. What changes is what comes out the other end.

5. **The OCP scraper** — Phase 3 complete (22/22 ISC). Produces SolutionRecords. These become the noun-side input to dual-stream alignment.

6. **Gap-directed sampling** — Still valid. Axis/order voids and domain coverage gaps still guide processing priority.

7. **The governance structure** — Sovereignty gates, OIL constraints, tier promotion protocol. Human sovereignty at crystallization. Unchanged.

### Needs reframing but not rebuilding

1. **The VerbRecord schema** — Correct for the verb stream. Needs a formal noun counterpart, or the paired record needs to be elevated from export format to first-class type.

2. **Rivers** — The v3.0 process contract's verb-typed rivers need expansion to carry noun-verb pairs. The subsystem metadata format changes, not the river infrastructure.

3. **Session traces** — Currently prescribed as D/I/R process traces (verb-shaped). Under dual-stream, a session trace also captures what entities were observed (noun-shaped), not just what processes were detected.

4. **The Motif Resonance Approximation Layer** — Currently searches for verb-shaped process signatures. Under dual-stream, it should also detect noun-shaped entity signatures. A passage about "homeostasis" (noun) and "negative feedback constraining deviation" (verb) should both trigger ISC-related resonance.

### Genuinely new

1. **A NounRecord type** (or equivalent) — SolutionRecords are close but lack structural typing. A true noun-stream record would classify entity shape, state space, boundary conditions.

2. **A convergence/alignment layer** — The mechanism that maps noun-verb pairs into a shared representation space. This is the core of dual-stream training architecture.

3. **Noun-side motif classification** — Motifs currently describe processes. What structural entities do they operate on? DSG operates on decision-making entities with two timescales. BBWOP operates on flow-channel entities with finite capacity. This dimension is implicit in structural descriptions but not formalized.

---

# Pass 2 — INTEGRATE

## How do noun and verb streams interact at every level?

### Level 1: Rivers

The v3.0 process contract says: "Rivers should carry process metadata in addition to outputs." Under dual-stream:

- **Noun channel**: What entity was observed, in what state, with what boundary conditions
- **Verb channel**: What process occurred, what operators were active, what stabilized, what failed
- **Alignment metadata**: How the noun and verb refer to the same structural instance

The "weak form" in the process contract was "Here is the scraper output." The "stronger form" was "The scraper performed a distinction pass on domain X..." The **dual-stream form** is: "The scraper observed entity-type Y in domain X (noun), undergoing process Z with operators {a, b} (verb), with alignment confidence C."

This is not just richer metadata — it changes what downstream systems can do. A verb-only river lets you track what happened. A noun-verb river lets you track what happened *to what*, which enables:
- Entity-level convergence detection (has this noun stabilized across verbs?)
- Process-level convergence detection (has this verb stabilized across nouns?)
- Cross-entity relationship discovery (do different nouns share the same verb pattern?)
- Cross-process relationship discovery (does the same noun undergo different verb patterns?)

### Level 2: Observer cognition (D/I/R)

The triad maps naturally to dual-stream:

- **Distinguish (D)** operates on both streams simultaneously:
  - Noun-D: What entities are present? What are their boundaries? What is excluded?
  - Verb-D: What processes are occurring? What operators are active? What is rejected?
  - Cross-stream D: Is this a new noun doing a known verb? A known noun doing a new verb? Both new?

- **Integrate (I)** operates on alignments:
  - Noun-I: How do observed entities relate to each other? (dependency, containment, adjacency)
  - Verb-I: How do observed processes relate? (sequence, concurrence, governance)
  - Cross-stream I: **How do noun-relationships and verb-relationships correspond?** This is where motif instances emerge — when noun structure and verb structure rhyme.

- **Recurse (R)** operates on the observation itself:
  - Noun-R: What entities did the observation apparatus assume? What was the frame?
  - Verb-R: What processes did the observation enact? What was the transfer function?
  - Cross-stream R: **How did the dual-stream observation change the observer?** This is where the OFL feedback loop becomes dual — the observation modifies both what entities and what processes the system can see next time.

### Level 3: Model training

The PRD's "dual-stream training" concept was originally a training data format:

> "Noun stream: Raw source passages train text representation"
> "Verb stream: Extracted verb-records train process representation"

Under the dual-stream architectural insight, this becomes something deeper:

**The noun stream** learns to represent entities — their structural properties, state spaces, boundary conditions, relationships. This is roughly what language models already do (representation learning).

**The verb stream** learns to represent transformations — operators, axis dynamics, derivative orders, stabilization conditions. This is what current language models do implicitly but not structurally.

**The convergence layer** learns the mapping: given a noun representation, what verb patterns are structurally compatible? Given a verb representation, what noun structures can host it? This is where the model learns that "homeostatic system" (noun) structurally corresponds to "negative feedback constraining deviation" (verb), and that this correspondence IS the motif (Idempotent State Convergence).

**The D/I/R training implication**: A D/I/R-native model would have architecturally distinct streams for noun and verb processing, with a convergence mechanism that performs integration. This maps to the Theory-to-Architecture document's principle that convergence extracts the structural invariant across independent measurements (G1).

### Level 4: Motif library

**Does the motif library need a noun dimension?**

The current motif schema is verb-native:
- `primary_axis`: differentiate / integrate / recurse — describes what the motif DOES
- `derivative_order`: 0–3 — describes the abstraction level of the PROCESS
- `structural_description`: describes the process shape
- `instances`: describe the motif in action in specific domains

The noun dimension is implicitly present in instances. DSG instances always involve "a system with two decision-making timescales" (noun) that "governs fast-cycle operations via slow-cycle policy" (verb). BBWOP instances always involve "a channel with finite capacity" (noun) that "manages overflow through explicit policy" (verb).

**Recommendation: The motif library stays pure verb, but instances gain a formal noun component.**

The motif itself — the structural operator — is a verb. It describes a process shape. This is correct. But each motif instance is a noun-verb pair: a specific structural entity enacting a specific process. Formalizing the noun component of instances enables:
- Entity-type clustering across motifs (what kinds of nouns host multiple motifs?)
- Noun-verb compatibility detection (what noun shapes are structurally compatible with what verb patterns?)
- Cross-domain transfer prediction (if a noun-type in domain A hosts motif M, what noun-types in domain B might?)

This is a metadata enrichment, not a schema change. The motif files don't need restructuring. Instance records gain a `noun_type` or `entity_shape` field.

### Level 5: The four pillars

The four pillars are governance patterns — they describe how the system operates, not what data it processes. They are verb-shaped by nature (governance IS a process). Dual-stream doesn't change them, but they gain a noun referent:

| Pillar | Verb (unchanged) | Noun (new explicit) |
|--------|------------------|---------------------|
| DSG | Fast-path/slow-path governance cycle | The decision-making boundary (the entity being governed) |
| ESMB | State transition with guard evidence | The state space (the entity whose states are enumerated) |
| CPA | Plugin lifecycle: register, activate, drain, remove | The plugin (the entity with capabilities and contracts) |
| BBWOP | Overflow policy: summarize, defer, halt | The queue (the entity with bounded capacity) |

This is not architectural change — it's making implicit nouns explicit. The four pillars design memo already describes both, but the formal vocabulary is entirely verb-typed.

### What's the convergence layer?

At every level, the convergence layer is the mechanism that maps between noun and verb representations to find structural correspondence. Different levels have different convergence mechanisms:

| Level | Convergence Mechanism |
|-------|----------------------|
| Rivers | Alignment metadata linking entity observation to process observation |
| D/I/R cognition | Cross-stream integration: noun-relationships ↔ verb-relationships |
| Model training | Learned mapping between noun representation space and verb representation space |
| Motif library | Instance records linking entity-shape to process-shape |
| Four pillars | Governance applying process discipline to structural entities |

The convergence layer IS the integrate axis of D/I/R — the mechanism that finds what holds across independently generated perspectives. In dual-stream, the two perspectives are noun and verb. Integration discovers that they describe the same structural reality from complementary angles.

---

# Pass 3 — RECURSE

## What new shape emerged?

### The dual-stream insight is an instance of a known motif

**Hidden Structure / Surface Form Separation** (Tier 0, differentiate axis):

> Different surface representations can encode the same deep structure.

The noun and verb streams are two surface forms of the same hidden structure — the structural motif instance. The convergence layer recovers the hidden structure from the two surface forms.

This is also an instance of **Reconstruction Burden** (Tier 2, differentiate axis):

> Every abstraction destroys information. The cost of recovering the original determines the abstraction's value.

A noun-only representation (SolutionRecord) destroys verb information. A verb-only representation (VerbRecord) destroys noun information. The paired noun-verb record minimizes reconstruction burden because neither component alone can reconstruct the motif instance — you need both.

And it is an instance of **Observer-Feedback Loop** (Tier 2, recurse axis):

> Observation modifies the observer's frame.

Under dual-stream, the observation loop is dual: verb-stream observation modifies what processes the system can detect; noun-stream observation modifies what entities the system can recognize. The two feedback loops interact — recognizing a new entity type enables detecting new process patterns, and detecting a new process pattern enables recognizing the entity types that host it.

### The project's shape is a two-axis coordinate system

Before the dual-stream insight, the project's intellectual architecture was one-dimensional: everything was verb-typed. Motifs described processes. Rivers carried process metadata. The dataset processor extracted processes. The algebra evaluated process stabilization.

After the dual-stream insight, the architecture becomes two-dimensional:

```
                    Noun (what it IS)
                         ↑
                         │
         entity shape    │    convergence
         state space     │    (motif instance)
         boundaries      │
                         │
 ─────────────────────── ┼ ──────────────────────→ Verb (what it DOES)
                         │
         (unknown:       │    process shape
          what noun      │    operators
          w/o verb?)     │    axis / order
                         │
```

- **Verb-only** (the prior architecture): rich process description, entities as incidental provenance
- **Noun-only** (SolutionRecords): rich entity description, processes absent
- **Convergence quadrant** (dual-stream): noun-verb pair as motif instance — the full structural picture
- **Lower-left quadrant** (neither): the gap — what does it mean to have a noun without a verb? A structural entity that doesn't do anything? This might be the "positional" derivative-order-0 layer — pure description before process is detected.

### What this tells us about the next phase

**Priority 1: Formalize the paired record as an architectural primitive.**

The `paired-exporter.ts` output format (`{"source": ..., "verb_record": ...}`) is the embryo. It needs to become a first-class type — not an export format but the system's atomic unit. Call it `DualRecord`, `MotifInstance`, or `PairedRecord`. It carries both noun and verb components with explicit alignment.

**Priority 2: Enrich SolutionRecords with a verb dimension.**

The OCP scraper's SolutionRecords describe what projects ARE. They need a companion field: what structural process does this project enact? This doesn't require rebuilding the scraper — it's a post-processing enrichment step where verb-records from the dataset processor are linked to existing SolutionRecords. Some SolutionRecords will have multiple verb-record links (one entity, multiple processes).

**Priority 3: Enrich VerbRecord instances with an entity-type classification.**

The dataset processor's VerbRecords describe processes. Each instance implicitly involves an entity. Formalizing this — "this DSG instance operates on a policy-execution boundary entity" — enables the noun-side clustering that makes dual-stream training meaningful.

**Priority 4: Design the convergence layer for model training.**

The dataset processor produces aligned pairs. The training pipeline needs an architecture that learns from both sides simultaneously. This is the open research question — not the wrapper/process architecture, but the model internals. The v3.0 process contract was correct to defer this. But the data format decisions happening now determine what training architectures are possible later.

**Priority 5: Update river metadata to carry noun-verb pairs.**

The v3.0 process contract's Phase 3 ("Rivers with process metadata") should carry dual-stream metadata. Each river packet includes what entity was observed alongside what process was detected.

### What motifs predict or describe this shift?

| Motif | How it describes this shift |
|-------|-----------------------------|
| **Reconstruction Burden** (T2) | The shift from verb-only to noun-verb is driven by RB: verb-only representation destroys entity information that is unrecoverable without the source. Dual-stream minimizes RB by preserving both projections. |
| **Observer-Feedback Loop** (T2) | The dual-stream insight is itself an observation that modifies the observer's frame. Having articulated the noun-verb distinction, the system can now see noun-shaped patterns it previously collapsed into provenance metadata. |
| **Progressive Formalization** (T2) | The paired export format is "structured" stage. Elevating it to a first-class type is "typed" stage. Training a model on it is "crystallized." The formalization trajectory of the dual-stream concept follows PF's lifecycle. |
| **Hidden Structure / Surface Form Separation** (T0) | Noun and verb are two surface forms. The motif instance is the hidden structure. This T0 motif should be evaluated for promotion — the dual-stream architecture IS this motif made operational. |
| **Structural Coupling as Ground State** (T1) | Noun and verb are structurally coupled — you cannot fully specify one without the other. The "ground state" of a motif instance is the coupled noun-verb pair, not either projection alone. |
| **Two Antagonistic Modes** (T0) | Noun-like representation (static, state-space, entity) and verb-like representation (dynamic, process, transformation) are antagonistic modes that must be held simultaneously. Neither collapses into the other. |

### The revised priority ordering

1. **Complete dataset processor pipeline** — already at slice 10, processing live. The dual-stream insight doesn't block current work. Verb-records continue to be produced.
2. **Formalize PairedRecord type** — small schema change, high architectural leverage. Makes the dual-stream concept concrete in code.
3. **Noun-type enrichment for VerbRecord instances** — metadata enrichment, not schema change. Can be done incrementally as Tier C evaluates candidates.
4. **SolutionRecord ↔ VerbRecord linking** — cross-tool integration between scraper and processor. Requires shared entity identifiers.
5. **River metadata expansion** — v3.0 Phase 3, updated for dual-stream. Depends on PairedRecord type being defined.
6. **Convergence layer design** — open research. Training architecture for coupled noun-verb representation learning. Deferred until paired data accumulation reaches critical mass (~10K+ paired records).
7. **Motif library noun-type formalization** — instance records gain entity-shape metadata. Low urgency — the verb-native motif schema is correct and complete for the verb stream.

### What's the meta-observation?

The dual-stream insight emerged from the dataset processor's design work — specifically from Decision 5 ("VerbRecord as the new primitive, not SolutionRecord") and the paired output format (Slice 6). The system was already producing noun-verb pairs as a training data format. The architectural insight is that this isn't a format decision — it's a structural discovery about the nature of the data.

This is OFL in action: the observation (designing the processor) modified the observer's frame (how we understand the whole architecture). The processor was supposed to produce verb-records for the motif library. Instead, the process of designing it revealed that the motif library's structural instances are inherently dual — noun and verb are co-primary, and neither alone captures the full structural reality.

The recursion axis produced the insight. It came not from building (verb) or describing (noun) but from reflecting on the relationship between what was built and what it revealed.

---

## Summary

| Question | Answer |
|----------|--------|
| What changed? | From verb-first to noun-verb co-primary. The paired record is the atomic unit, not the VerbRecord alone. |
| What survives unchanged? | Motif library, algebra, four pillars, governance, dataset processor pipeline, three-tier architecture, gap-directed sampling. |
| What needs reframing? | VerbRecord schema (needs noun counterpart), rivers (need dual-stream metadata), session traces (need entity observations), motif instances (need entity-type classification). |
| What's genuinely new? | PairedRecord as first-class type, convergence layer design, noun-type motif instance enrichment, SolutionRecord ↔ VerbRecord cross-linking. |
| What's the revised priority? | Complete processor → formalize PairedRecord → noun-type enrichment → cross-tool linking → river expansion → convergence layer → motif noun-type formalization. |
| What motif describes this shift? | Reconstruction Burden (T2) — dual-stream minimizes information loss. Hidden Structure / Surface Form Separation (T0) — noun and verb are surface forms of the motif instance. Observer-Feedback Loop (T2) — the design process revealed the architectural insight. |
