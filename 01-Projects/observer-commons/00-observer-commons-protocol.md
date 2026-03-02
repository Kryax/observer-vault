---
meta_version: 1
kind: architecture
status: draft
authority: low
domain: [governance, infrastructure, coordination]
source: claude_conversation
confidence: speculative
mode: design
created: 2026-03-01
modified: 2026-03-01
cssclasses: [status-draft]
---

# DRAFT — Observer Commons Protocol v0.1.0

## Synthesis Document

**Status**: DRAFT — Not for implementation. Subject to change without notice.
**Version**: 0.1.0-draft
**Date**: 2026-03-01
**Author**: Atlas (PAI) — Synthesis of four parallel sub-agent deliverables
**Licence**: To be determined by Adam

---

## Executive Summary

The Observer Commons Protocol (OCP) is a federated, decentralized protocol for indexing, sharing, and composing solved problems across domains. It addresses a fundamental gap: **we don't know what's been solved.** GitHub indexes repositories. Stack Overflow indexes questions. Neither indexes *solved problems* as first-class entities.

The protocol consists of four interlocking layers:

1. **Schema Layer** — The Solution Record: a JSON-LD document describing a solved problem with seven required facets (problem, domains, validation, implementation, composability, provenance, trust)
2. **Federation Layer** — How vaults announce, discover, publish, subscribe, and query across the network using ActivityPub, JSON Feed, and JSON-RPC 2.0
3. **Trust Layer** — How trust scores are calculated from multiple independent validations using surveyor epistemology, with Cynefin-aware maturity classification
4. **Composition Layer** — How solutions declare composability through typed ports, how compatibility is checked, and how assemblies are formed

All layers are designed to be:
- **Incrementally adoptable** — Start local, grow to federation
- **AI-assistable but not AI-dependent** — Core operations work without LLMs
- **Human-sovereign** — AI articulates, humans decide; no automated promotion to canonical
- **Vendor-independent** — Works with Codeberg/Forgejo, no GitHub dependency
- **Standards-based** — JSON-LD, Schema.org, ActivityPub, JSON-RPC 2.0, DID:web

---

## 1. Protocol Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   CONSUMER                          │
│   (Human, AI Agent, Tool, Dashboard)                │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │COMPOSITION│  │  TRUST   │  │   DISCOVERY /    │  │
│  │  LAYER   │  │  LAYER   │  │   QUERY          │  │
│  │          │  │          │  │                   │  │
│  │ Ports    │  │ Surveyor │  │  JSON-RPC 2.0    │  │
│  │ Deps     │  │ Scores   │  │  Full-text       │  │
│  │ Compat   │  │ Cynefin  │  │  Domain filter   │  │
│  │ Assembly │  │ Provenance│ │  Faceted search   │  │
│  └────┬─────┘  └────┬─────┘  └────┬──────────────┘ │
│       │              │              │               │
│  ┌────┴──────────────┴──────────────┴────────────┐  │
│  │            FEDERATION LAYER                    │  │
│  │                                                │  │
│  │  Vault Identity (DID:web)                     │  │
│  │  Pub/Sub (JSON Feed pull + ActivityPub push)  │  │
│  │  Cross-Vault Query (JSON-RPC 2.0)             │  │
│  │  Selective Sharing (4 visibility levels)       │  │
│  └────────────────────┬──────────────────────────┘  │
│                       │                             │
│  ┌────────────────────┴──────────────────────────┐  │
│  │            SCHEMA LAYER                        │  │
│  │                                                │  │
│  │  Solution Record (JSON-LD)                    │  │
│  │  7 Required Facets + Extensions               │  │
│  │  Controlled Vocabularies + Cynefin             │  │
│  │  Immutable-once-published versioning           │  │
│  └────────────────────────────────────────────────┘  │
│                                                     │
├─────────────────────────────────────────────────────┤
│                    VAULT                            │
│   (Local knowledge store with governance)           │
└─────────────────────────────────────────────────────┘
```

---

## 2. Layer Summaries

### 2.1 Schema Layer — The Solution Record

**Full specification**: `01-schema-spec.md`

The Solution Record is the atomic unit of exchange — a JSON-LD document with `@type: "SolutionRecord"` that describes a solved problem through seven required facets:

| # | Facet | Purpose | Key Fields |
|---|-------|---------|------------|
| 1 | **Problem Solved** | What was the problem? | `statement`, `context`, `cynefinDomain`, `priorAttempts` |
| 2 | **Domains** | Where does it apply? | Array of domain tags (extensible with `x-` prefix) |
| 3 | **Validation** | How do we know it works? | `method`, `evidence[]`, `reproducibility`, `validatedBy` |
| 4 | **Implementation** | Where does the solution live? | `type`, `refs[]`, `solutionApproach`, `language`, `runtime` |
| 5 | **Composability** | How does it connect? | `inputs[]`, `outputs[]`, `dependencies[]`, `interfaceContract` |
| 6 | **Provenance** | Where did it come from? | `authors[]`, `sourceType`, `derivedFrom[]`, `generatedBy` |
| 7 | **Trust Indicators** | How much to trust it? | `confidence`, `authority`, `status`, `endorsements[]`, `disputes[]` |

**Key design decisions:**
- **JSON-LD with `ocp:` namespace** — 12 fields map to Schema.org, 10 use custom `ocp:` terms
- **Cynefin-to-confidence mapping** — Problem domain caps realistic confidence (e.g., `complex` problems cap at `tested`)
- **Immutable-once-published** — Published records get new versions rather than mutations, preserving endorsement chains
- **Extensibility via `extensions` object** — Namespaced keys (`vault-name:field`) allow vault-specific fields without breaking federation
- **Minimum viable record is ~40 lines of JSON** — All seven facets represented, achievable by hand in under 5 minutes

### 2.2 Federation Layer — Connecting Vaults

**Full specification**: `02-federation-spec.md`

The federation protocol defines how vaults announce themselves, publish and subscribe to solution records, query across the network, and handle conflicts.

**Core mechanisms:**

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Vault Identity** | DID:web | Self-hosted, W3C standard, Codeberg-compatible via path-based resolution |
| **Pub/Sub (Phase 1)** | JSON Feed | Pull-based, zero infrastructure, static files in git repos |
| **Pub/Sub (Phase 2)** | ActivityPub | Push-based, real-time, aligns with Forgejo federation |
| **Cross-Vault Query** | JSON-RPC 2.0 | Simple, well-specified, implementations everywhere |
| **Network Topology** | Federated Mesh | No central authority; bootstrap registries are curated lists, not gatekeepers |
| **Record Integrity** | Content Identifiers (CIDs) | IPFS-compatible hashes without requiring IPFS infrastructure |

**Key design decisions:**
- **Phase 1 requires zero infrastructure** — A vault publishes solution records as a JSON Feed file in a git repository. Other vaults poll the feed. This is the RSS model for solutions.
- **ActivityPub for Phase 2 push** — Actor model maps cleanly to vaults. Follow/Accept for subscriptions. Aligns with Forgejo/Codeberg federation direction.
- **Selective sharing with 4 visibility levels** — `public`, `federation` (peers only), `authenticated` (approved requestors), `private` (local only)
- **Conflict resolution = present, don't resolve** — Multiple solutions to the same problem coexist. The trust layer ranks them. No central authority picks a winner.
- **Codeberg/Forgejo first-class** — Vault profiles hosted as repository files, feeds as JSON files in repos, API queries via Forgejo REST API

### 2.3 Trust Layer — Surveyor Epistemology Applied

**Full specification**: `03-trust-spec.md`

Trust is established through multiple independent validations, not single authority or popularity.

**Core axiom:**

> Trust = f(independent_validation_count, validation_diversity, context_coverage, time_stability)
>
> Trust is NOT f(total_endorsements) and NOT f(authority_of_endorser).

**Trust model:**

| Component | Design | Rationale |
|-----------|--------|-----------|
| **Trust representation** | 6-dimensional vector | Single scores destroy information. Vectors preserve signal across validation count, diversity, testing, documentation, production use, and community engagement |
| **Composite score** | Geometric mean (0.0–1.0) | Zero in any dimension drags entire score down. Prevents single-axis gaming. |
| **Independence weighting** | 4 levels (full/partial/minimal/none) | Same-org validations count at 0.2x, cross-org at 1.0x. Independence is the strongest trust signal. |
| **Cynefin gates** | Domain-adjusted trust + decay rates | Simple domain solutions decay over 2 years. Chaotic domain solutions decay over 90 days. Matches real-world knowledge stability. |
| **Provenance chain** | Hash-linked, signed, append-only events | Tamper evidence without blockchain consensus overhead |
| **Anti-gaming** | Layered defence (Sybil, collusion, decay, rate limiting) | Advisory, not punitive — flags go to humans, not automated punishment |

**AI boundary (non-negotiable):**

| AI CAN | AI CANNOT |
|--------|-----------|
| Index and tag solution records | Validate solutions as trustworthy |
| Suggest relevant validations | Promote solutions to canonical status |
| Flag anomalies in trust scores | Override human trust decisions |
| Detect potential Sybil patterns | Auto-reject or auto-approve endorsements |
| Summarise validation evidence | Compute final trust scores without human review of methodology |

**GitHub attention model mapping:**
- Stars → Independent endorsements (mapped to validation count, weighted by source independence)
- Forks → Independent adaptations (stronger signal — implies deep engagement)
- PRs → Direct improvements (strongest signal — peer contribution)
- Issues → Community engagement dimension
- What GitHub lacks: independence measurement, Cynefin classification, provenance chain, decay, anti-gaming

### 2.4 Composition Layer — Solutions as Lego

**Full specification**: `04-composition-spec.md`

How solutions plug together, whether code or knowledge.

**Core model — Typed Ports:**

Solutions expose typed input and output ports (analogous to Unix stdin/stdout but typed). The composition layer provides structural typing for compatibility checking.

| Component | Design | Rationale |
|-----------|--------|-----------|
| **Interface definitions** | Typed ports with 4 type kinds | `structured` (JSON Schema), `prose-contract` (natural language), `hybrid`, `opaque` (human judgment). Handles code AND knowledge domains. |
| **Dependency graphs** | DAG with semantic version constraints | `requires`, `enhances`, `conflicts`, `supersedes` relationships. No circular dependencies allowed. |
| **Compatibility checking** | 3-layer system | Layer 1: static type checking (no AI). Layer 2: constraint satisfaction (mostly mechanical). Layer 3: semantic analysis (AI-assisted, always advisory). |
| **Assembly records** | Documented compositions | Explicit human approval via `approved_by` field. An assembly can itself become a solution (hierarchical). |
| **AI boundary** | Structural enforcement | AI produces `SUGGESTED_*` statuses, never `COMPATIBLE` directly. The `approved_by` field requires a human identity pattern — validated mechanically, not by asking AI to self-limit. |

**Cross-domain composition example:**
A caching pattern in software (code solution) + a queue management process in operations (non-code solution) can compose if their port types are compatible. The composition layer provides "adapters" for translating between `structured` and `prose-contract` type kinds.

**Lessons from existing systems:**
- **npm/cargo/pip**: Version resolution algorithms transfer; "no silent resolution" principle adopted (unlike npm, conflicts go to humans)
- **Unix pipes**: stdin/stdout as universal interface → solution ports are the equivalent; but solutions have typed ports, not just text streams
- **Terraform modules**: Input/output variable pattern maps well to solution ports
- **Zapier**: Non-programmer composition through data flow connections → relevant for non-code domain

---

## 3. Cross-Layer Integration Points

The four sub-agent deliverables were designed independently. This section identifies where they interact and resolves alignment issues.

### 3.1 Schema ↔ Federation

| Integration Point | Status | Notes |
|---|---|---|
| Schema `federation` section (originNode, mirroredAt, canonicalUri) | **Aligned** | Schema defines the fields; federation layer populates them |
| Record integrity via CIDs | **Aligned** | Federation uses content-addressed hashes; schema supports `@id` as URI which can be a CID |
| JSON Feed as transport format | **Aligned** | Feed entries contain Solution Records as JSON-LD payloads |
| DID:web as vault identity | **Compatible** | Schema `@id` uses `ocp:{node-id}/{record-uuid}` where node-id can resolve via DID:web |

### 3.2 Schema ↔ Trust

| Integration Point | Status | Notes |
|---|---|---|
| Trust vector dimensions vs schema trust fields | **Minor tension** | Schema defines `trust.trustScore` as a single number (0.0–1.0). Trust layer defines a 6-dimensional vector. **Resolution**: `trustScore` is the geometric mean composite. The vector lives in the trust layer's endorsement records, not in the solution record itself. |
| Cynefin-confidence mapping | **Aligned** | Both layers agree on the mapping (simple→foundational max, chaotic→provisional max). Validators warn but don't reject. |
| Endorsement structure | **Aligned** | Schema defines `trust.endorsements[]` as objects with endorser, date, URI, comment. Trust layer extends this with independence classification and weighting in its own data structures. |

### 3.3 Schema ↔ Composition

| Integration Point | Status | Notes |
|---|---|---|
| Composability facet vs port model | **Minor tension** | Schema defines `composability.inputs/outputs` with `name`, `type`, `description`, `required`. Composition layer defines a richer port model with `portType`, `typeKind`, `schema`. **Resolution**: Schema's structure is the minimum viable port definition. Composition layer's richer model extends it via `composability.interfaceContract`. Both are valid — simple records use the basic fields, sophisticated records add the contract. |
| Dependency relationships | **Aligned** | Schema defines `composability.dependencies[].relationship` with `requires`, `enhances`, `conflicts`, `supersedes`. Composition layer uses the same vocabulary. |

### 3.4 Federation ↔ Trust

| Integration Point | Status | Notes |
|---|---|---|
| Endorsement propagation | **Aligned** | Federation distributes endorsement events via ActivityPub activities. Trust layer processes them. |
| Sybil resistance across federation | **Attention needed** | Trust layer defines anti-gaming measures but assumes federation provides vault identity verification. Federation uses DID:web which is self-asserted. **Gap**: Need a vault reputation/age signal to weight new vault endorsements lower. |

### 3.5 Federation ↔ Composition

| Integration Point | Status | Notes |
|---|---|---|
| Cross-vault dependency resolution | **Aligned** | Composition layer references dependencies by `@id` (URI). Federation layer resolves URIs to records via cross-vault query. |
| Assembly record distribution | **Attention needed** | Composition layer defines assembly records but does not specify how they are federated. **Resolution**: Assembly records are Solution Records with `implementation.type: "assembly"` — they federate via the same mechanism. |

### 3.6 Trust ↔ Composition

| Integration Point | Status | Notes |
|---|---|---|
| Trust-gated composition | **Aligned** | Composition Layer 2 (constraint satisfaction) can check trust scores as composition prerequisites. A composition can require minimum trust thresholds for its dependencies. |

---

## 4. Conflicts Identified and Resolutions

### 4.1 Trust Score Representation (Schema vs Trust Layer)

**Conflict**: Schema defines `trust.trustScore` as a single number (0.0–1.0). Trust layer defines trust as a 6-dimensional vector with geometric mean composite.

**Resolution**: The single number IS the geometric mean composite. The full vector is stored in the trust layer's endorsement and validation data structures, not in the solution record itself. The solution record carries the composite for quick reference; consumers who need the full picture query the trust layer.

**Decision**: Schema keeps `trustScore` as `number | null`. Trust layer documentation should explicitly state that `trustScore` = geometric mean of the 6-dimension vector.

### 4.2 Port Model Granularity (Schema vs Composition)

**Conflict**: Schema's `composability.inputs/outputs` are simple objects (`name`, `type`, `description`, `required`). Composition layer defines a richer port model with `portType`, `typeKind` (structured/prose-contract/hybrid/opaque), and JSON Schema definitions.

**Resolution**: The schema's simple format is the minimum viable port definition — sufficient for discovery and human-readable composition. The composition layer's rich model is expressed via `composability.interfaceContract`, which already exists in the schema as an optional field with format-dependent structure.

**Decision**: No schema change needed. Composition layer documents that `interfaceContract` with format `"ocp-ports"` carries the rich port model.

### 4.3 Assembly Record Type (Composition Layer)

**Conflict**: Composition layer defines "assembly records" as a new entity type. The schema does not have an explicit assembly type.

**Resolution**: Assembly records ARE Solution Records where `implementation.type: "assembly"` and the implementation references the component solutions. No new schema type needed — the existing `implementation.type` vocabulary just needs `assembly` added.

**Decision**: Add `assembly` to the `implementation.type` controlled vocabulary in `01-schema-spec.md`.

---

## 5. Implementation Roadmap

### Phase 1: MVP — Local Indexing + Static Federation (Months 1-3)

**Goal**: A single vault can create, validate, and publish Solution Records. Two vaults can discover each other's solutions.

**Deliverables:**
- [ ] Solution Record JSON Schema validator (validates structure against `01-schema-spec.md`)
- [ ] CLI tool: `ocp init` — initialise a vault as an OCP node
- [ ] CLI tool: `ocp create` — interactive Solution Record creation with template
- [ ] CLI tool: `ocp validate` — validate a Solution Record against the schema
- [ ] CLI tool: `ocp feed generate` — generate a JSON Feed from local Solution Records
- [ ] CLI tool: `ocp feed poll <url>` — poll a remote vault's JSON Feed and import records
- [ ] Vault profile file (`ocp-profile.json`) with vault metadata and feed URL
- [ ] Basic search: grep-based local search across imported records
- [ ] Codeberg/Forgejo integration: host profile + feed as repository files
- [ ] Trust MVP: 3-dimension trust vector (validation count, diversity, testing), binary independence

**Phase 1 deliberately excludes:**
- Real-time push (Phase 2)
- AI-assisted discovery (Phase 3)
- Anti-gaming sophistication (Phase 4)
- Rich composition checking (Phase 3)

**Exit criteria:**
- Two vaults on Codeberg can publish and discover each other's Solution Records via JSON Feed polling
- Records validate against the schema
- Basic trust scores are computed from local validation events

### Phase 2: Federation + Cross-Vault Query (Months 4-8)

**Goal**: Vaults form a real federation. Real-time push, structured queries, selective sharing.

**Deliverables:**
- [ ] ActivityPub integration: vault-as-actor, Follow/Accept, real-time record push
- [ ] JSON-RPC 2.0 query endpoint: domain filtering, keyword search, cursor pagination
- [ ] DID:web vault identity with key management
- [ ] Selective sharing: 4 visibility levels (public, federation, authenticated, private)
- [ ] Content addressing (CIDs) for record integrity and deduplication
- [ ] Bootstrap registry: curated vault directory (OPML-style list, not central authority)
- [ ] Cross-vault endorsement protocol: structured endorsement events via ActivityPub
- [ ] Trust enhancement: full 6-dimension vector, weighted independence scoring

**Phase 2 deliberately excludes:**
- AI-assisted pattern matching (Phase 3)
- Sophisticated anti-gaming (Phase 4)
- Automated composition checking (Phase 3)

**Exit criteria:**
- 5+ vaults can federate via ActivityPub
- Cross-vault queries return relevant results within 2 seconds
- Endorsements propagate across federation
- Selective sharing correctly restricts access

### Phase 3: AI-Assisted Discovery + Composition Engine (Months 9-14)

**Goal**: AI enhances discovery and composition without becoming a dependency.

**Deliverables:**
- [ ] Embedding-based semantic search across federated records
- [ ] Cross-domain pattern matching: detect structurally isomorphic solutions across domains
- [ ] AI-suggested tags and domain classifications (advisory only, human-approved)
- [ ] Composition Layer 1: static type checking for port compatibility
- [ ] Composition Layer 2: constraint satisfaction checking
- [ ] Composition Layer 3: AI-suggested assemblies (advisory, human-approved)
- [ ] Assembly record support: create, validate, and publish composed solutions
- [ ] Dependency graph visualisation tool
- [ ] Enhanced search: faceted search with Cynefin filtering, trust thresholds

**Phase 3 AI boundary rules:**
- All AI suggestions marked as `SUGGESTED_*` status
- No AI output enters the trust computation directly
- Humans approve all compositions and classifications
- Core protocol operations continue to work without AI

**Exit criteria:**
- AI suggestions improve discovery relevance (measured by user acceptance rate)
- Composition checking catches incompatible port types before human review
- Cross-domain pattern matching surfaces non-obvious solution connections

### Phase 4: Trust at Scale + Governance (Months 15-24)

**Goal**: The protocol is robust against adversarial behaviour at scale.

**Deliverables:**
- [ ] Full anti-gaming suite: Sybil resistance, collusion detection, rate limiting
- [ ] Trust decay with Cynefin-adjusted half-lives
- [ ] Vault reputation scoring (age, consistency, endorsement quality)
- [ ] Governance voting protocol for controlled vocabulary changes
- [ ] Domain vocabulary governance: proposal → review → adoption pipeline
- [ ] Hierarchical composition: assemblies that contain assemblies
- [ ] Encrypted selective sharing for sensitive solution records
- [ ] IPFS pinning for high-value records (optional, not required)
- [ ] Protocol compliance test suite
- [ ] Federation health monitoring dashboard

**Exit criteria:**
- Known gaming attacks (documented in trust layer anti-gaming section) are detected and flagged
- Governance process can add new domain vocabulary terms without protocol update
- 50+ vaults federated with robust trust scoring

---

## 6. Gap Analysis

### 6.1 Missing or Underspecified Areas

| # | Gap | Severity | Description | Recommendation |
|---|-----|----------|-------------|----------------|
| G1 | **Domain vocabulary governance** | High | Who decides when a new domain tag is added to the core vocabulary? The protocol defines extensibility (`x-` prefix) but not how `x-` tags graduate to core status. | Define a governance RFC process in Phase 4. For now, `x-` tags and the core list in `01-schema-spec.md` are sufficient. |
| G2 | **Vault reputation bootstrap** | High | New vaults have no reputation. Their endorsements should count less, but the trust layer doesn't specify how vault age/reputation feeds into endorsement weighting. | Add a vault reputation dimension (age, consistency, endorsement quality) to the trust vector. This is noted as a Phase 4 deliverable. |
| G3 | **Record migration** | Medium | What happens when a vault moves to a new domain or hosting provider? DID:web is tied to the domain name. | DID:web supports key rotation but not domain migration natively. Need a "vault redirect" mechanism or a migration event in the provenance chain. |
| G4 | **Offline/local-first operation** | Medium | The protocol assumes network access for federation. How does it work for air-gapped or intermittently connected vaults? | Phase 1's JSON Feed model works offline — feeds are static files. Phase 2+ needs a sync protocol for offline-first operation (CRDTs or event log merge). |
| G5 | **Internationalisation** | Medium | All examples and controlled vocabularies are in English. How does the protocol handle non-English solution records? | Solution Records can be in any language. `meta.keywords` supports any Unicode. A `meta.language` field (ISO 639-1) should be added to the schema for discovery filtering. |
| G6 | **Search ranking algorithm** | Medium | Cross-vault query protocol defines message formats but not how results are ranked. | Ranking is implementation-specific, not protocol-level. But the protocol should define which fields are searchable and how trust scores influence ranking. |
| G7 | **Record deletion/retraction** | Medium | The schema defines `archived` and `superseded` but not outright deletion. What if a record must be retracted (e.g., found to be plagiarised or harmful)? | Add a `retracted` status with mandatory retraction reason. Federated nodes should propagate retraction events. |
| G8 | **Privacy / GDPR compliance** | Medium | Solution records may contain personal data in `provenance.authors`. How does deletion-right (Article 17) interact with immutable-once-published records? | Authors can request pseudonymisation of their `provenance` data. Vault operators are data controllers. Full deletion of federated records is architecturally hard — this is a known tension with immutable systems. |
| G9 | **Rate limiting / abuse prevention at protocol level** | Low | Individual vaults can rate-limit, but there's no protocol-level mechanism to protect against flood attacks. | Phase 4 rate limiting. For now, vaults manage their own abuse prevention. |
| G10 | **Formal specification format** | Low | The protocol is specified in Markdown prose, not a formal specification language. | Consider OpenAPI for the JSON-RPC endpoints and JSON Schema for the solution record (already in Appendix A of `01-schema-spec.md`). Full formal spec can wait for v1.0. |

### 6.2 Assumptions That Need Testing

| # | Assumption | Risk | How to Test |
|---|-----------|------|------------|
| A1 | JSON-LD complexity won't deter adoption | Medium | Build a "plain JSON" mode where context is assumed. Measure friction in user testing. If JSON-LD is too heavy, the protocol can fall back to plain JSON with a version header. |
| A2 | ActivityPub is the right federation substrate | Medium | Build Phase 1 without ActivityPub (JSON Feed only). Evaluate whether ActivityPub's complexity is justified by Phase 2 requirements. AT Protocol's Lexicon approach may be simpler. |
| A3 | Geometric mean is the right trust composite function | High | Run simulations with real endorsement data. Compare geometric mean vs weighted average vs Bayesian scoring for gaming resistance and signal preservation. |
| A4 | Cross-domain pattern matching is tractable | High | This is the most ambitious claim — that AI can detect isomorphic solutions across domains (e.g., caching in software ↔ buffering in manufacturing). Needs prototype evaluation. |
| A5 | Seven required facets is the right granularity | Medium | May be too many for simple solutions or too few for complex ones. The "minimum viable record" profile mitigates this, but user testing will determine if the facet count is right. |
| A6 | DID:web is sufficiently decentralised | Medium | DID:web ties identity to domain control. If a hosting provider deplatforms a vault, the identity is lost. Consider supporting DID:key or DID:plc as alternatives. |
| A7 | Cynefin classification adds value | Low | Cynefin is established in management theory but less known in software engineering. Test whether users find the classification useful for trust interpretation or just confusing. |

### 6.3 Existing Standards and Protocols to Align With

| Standard | Relevance | Current Status | Action |
|----------|-----------|---------------|--------|
| **JSON-LD** (W3C) | Core format for Solution Records | Adopted in `01-schema-spec.md` | Maintain alignment |
| **Schema.org** | Linked data vocabulary | 12 fields mapped, 10 custom in `ocp:` namespace | Monitor for new types that could replace custom fields |
| **ActivityPub** (W3C) | Federation substrate for Phase 2 | Adopted in `02-federation-spec.md` | Evaluate Forgejo's ActivityPub implementation for compatibility |
| **JSON-RPC 2.0** | Cross-vault query protocol | Adopted in `02-federation-spec.md` | Standard is stable — no alignment risk |
| **DID:web** (W3C) | Vault identity | Adopted in `02-federation-spec.md` | Monitor DID specification evolution |
| **AT Protocol** (Bluesky) | Alternative federation model | Evaluated, partially borrowed (Lexicon concept) | Watch for maturation; may replace ActivityPub if it proves simpler |
| **IPFS/CIDs** | Content addressing for integrity | CIDs adopted; full IPFS deferred to Phase 4 | Use CID format without requiring IPFS infrastructure |
| **ForgeFed** | Git forge federation | Evaluated for Codeberg alignment | Track ForgeFed progress for deeper integration |
| **JSON Feed** | Solution record distribution (Phase 1) | Adopted for Phase 1 pub/sub | Simple, stable — minimal alignment risk |
| **Dublin Core** (`dcterms:`) | Metadata vocabulary | Referenced in JSON-LD context | Stable standard — no action needed |
| **SPDX** | License identifiers | Used for `meta.license` field | Stable standard — no action needed |
| **Semantic Versioning** | Record versioning | Adopted for `meta.version` | Stable standard — no action needed |
| **SKOS** (W3C) | Vocabulary management | Referenced for future domain taxonomy work | Consider for Phase 4 vocabulary governance |

---

## 7. Sovereignty Concerns

This section flags anywhere the protocol design could compromise human control or create vendor lock-in.

### 7.1 Human Control Risks

| # | Concern | Severity | Analysis |
|---|---------|----------|----------|
| S1 | **AI trust scoring** | Critical — mitigated | The trust layer explicitly prohibits AI from computing trust scores or promoting solutions. But if the trust computation formula is complex, humans may not understand why a score is what it is. **Mitigation**: Trust vector dimensions are individually interpretable. The composite is a transparent geometric mean. |
| S2 | **AI composition suggestions** | Critical — mitigated | Composition Layer 3 (AI-assisted) produces `SUGGESTED_*` statuses that require human promotion to `COMPATIBLE`. The `approved_by` field is mechanically validated to contain a human identity pattern. |
| S3 | **Federation dynamics** | Medium | In practice, a few large vaults may dominate the federation through attention concentration (the same way a few GitHub accounts dominate stars). **Mitigation**: Independence weighting — a solution endorsed by 5 small independent vaults scores higher than one endorsed 50 times by one large vault. |
| S4 | **Schema evolution** | Medium | If the protocol gains adoption, who controls the schema? A governance body could become a central authority. **Mitigation**: The schema uses semantic versioning with backward compatibility rules. Changes require community RFC process (Phase 4). |
| S5 | **Bootstrap registry** | Low | While the bootstrap registry is described as a curated list (not a gatekeeper), in practice whoever maintains the list has influence. **Mitigation**: Multiple independent bootstrap registries. Discovery also works via direct vault-to-vault URLs. |

### 7.2 Vendor Lock-In Risks

| # | Concern | Severity | Analysis |
|---|---------|----------|----------|
| V1 | **Codeberg/Forgejo** | Low | While the protocol is designed for Codeberg/Forgejo, it doesn't REQUIRE them. Vault profiles and feeds are standard JSON files servable from any HTTP endpoint. |
| V2 | **ActivityPub** | Medium | Phase 2 adopts ActivityPub as the push federation protocol. If ActivityPub proves inadequate, switching to AT Protocol or a custom protocol would require non-trivial migration. **Mitigation**: Phase 1 works without ActivityPub. The pull model (JSON Feed) remains as fallback. |
| V3 | **JSON-LD** | Low | JSON-LD is a W3C standard with multiple implementations. No vendor dependency. The "plain JSON" fallback mode further reduces risk. |
| V4 | **DID:web** | Low-Medium | DID:web ties identity to domain names (DNS dependency). **Mitigation**: Support DID:key as an alternative for users who don't control a domain. Consider DID:plc for portability. |

### 7.3 Overall Sovereignty Assessment

The protocol design preserves human sovereignty at every layer:
- **Schema**: No field implies automated trust. Publication requires explicit human approval.
- **Federation**: No central authority. Vaults control their own data and sharing policies.
- **Trust**: Independent validation, not popularity. Anti-gaming is advisory, not punitive.
- **Composition**: AI suggests, humans approve. Structural enforcement via `approved_by` field.

The primary residual risk is **de facto centralisation** through attention concentration — the same dynamic that makes GitHub's trending page a king-maker despite the platform being technically decentralised. The independence-weighted trust model is the primary mitigation, but this assumption needs real-world testing (see A3 in Gap Analysis).

---

## 8. Detailed Specification References

| Document | Location | Lines | Scope |
|----------|----------|-------|-------|
| Solution Record Schema | `01-schema-spec.md` | ~1,378 | JSON-LD context, field definitions, controlled vocabularies, Schema.org alignment, 2 example records, extensibility model, versioning |
| Federation & Discovery | `02-federation-spec.md` | ~1,195 | Vault identity (DID:web), announcement, pub/sub (JSON Feed + ActivityPub), cross-vault query (JSON-RPC), topology, selective sharing, Codeberg integration, protocol evaluation |
| Trust & Governance | `03-trust-spec.md` | ~827 | Trust vector model (6 dimensions), independence weighting, provenance chain, Cynefin gates, anti-gaming, AI boundary, GitHub attention mapping |
| Composition & Integration | `04-composition-spec.md` | ~1,521 | Port model, type system (4 kinds), dependency graphs, 3-layer compatibility checking, cross-domain composition, AI assembly boundary, package manager lessons |

---

## 9. Next Steps for Adam

1. **Review this synthesis document** — Are the cross-layer integration resolutions acceptable? Any sovereignty concerns that need different treatment?

2. **Review individual spec documents** — Each is independently readable with its own Pre-Mortem, Sovereignty Check, and Simplicity Check. Start with `01-schema-spec.md` as it's the foundation everything else builds on.

3. **Decide on unresolved gaps** — Particularly G1 (domain vocabulary governance), G5 (internationalisation — add `meta.language` field?), and G7 (record retraction).

4. **Test assumptions** — A1 (JSON-LD friction) and A3 (trust scoring formula) are the highest-risk assumptions. Consider building a small prototype with 2 vaults to validate Phase 1 before committing to the full roadmap.

5. **Name and host the protocol** — The documents assume `observercommons.org` as the namespace. Need to decide on actual domain and hosting for the JSON-LD context file.

6. **Decide relationship to OIL** — The Observer Integration Layer (OIL) repository is referenced in the context brief but not addressed in this protocol. How does OCP relate to OIL? Is OIL the implementation of OCP, or a separate concern?

---

*This document was co-produced by Atlas (PAI) from four parallel sub-agent analyses. All content is DRAFT status. Nothing is canonical until Adam reviews and approves.*
