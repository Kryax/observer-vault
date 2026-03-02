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

# DRAFT -- Observer Commons Protocol: Solution Record Schema Specification

**Version**: 0.1.0-draft
**Status**: DRAFT -- Not for implementation. Subject to change without notice.
**Author**: Schema Architect Sub-Agent (Observer Commons Working Group)
**Date**: 2026-03-01
**Scope**: Schema design only. Federation, discovery, trust, and composition layers are out of scope.

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [JSON-LD Context](#2-json-ld-context)
3. [Solution Record Schema](#3-solution-record-schema)
4. [Field Definitions](#4-field-definitions)
5. [Controlled Vocabularies](#5-controlled-vocabularies)
6. [Schema.org Alignment](#6-schemaorg-alignment)
7. [Example Records](#7-example-records)
8. [Extensibility Model](#8-extensibility-model)
9. [Versioning and Immutability](#9-versioning-and-immutability)
10. [Pre-Mortem](#10-pre-mortem)
11. [Sovereignty Check](#11-sovereignty-check)
12. [Simplicity Check](#12-simplicity-check)

---

## 1. Design Philosophy

### The Fundamental Constraint

The bottleneck in technical knowledge is no longer production -- it is discovery and composition. GitHub indexes files. Stack Overflow indexes questions. Neither indexes *solved problems* as first-class entities. A solution is not a file, not a question, not a repository. It is a claim that a specific problem has been addressed, with evidence, context, and composability metadata.

### Design Principles Applied

1. **Surveyor Epistemology**: The schema includes explicit trust indicators and validation fields because truth requires multiple independent measurements. A solution record is a *claim*, not a *fact*. The trust layer (designed separately) will aggregate independent validations.

2. **AI Articulates, Humans Decide**: The schema is designed so that AI agents can create, index, tag, and discover solution records -- but validation fields, authority levels, and promotion states require human action. No field implies automated trust.

3. **Protocol First**: The schema uses JSON-LD and standard vocabularies so that any compliant tool can read, write, and federate records. No proprietary format, no platform dependency.

4. **Federated Governance**: Solution records carry their own provenance. There is no central ID authority. Records use content-addressable identifiers or domain-scoped URIs.

5. **Human Sovereignty**: The `provenance` facet explicitly tracks authorship and ownership. The `governance` section tracks who approved what and when.

6. **Vendor Independence**: JSON-LD over HTTP. No platform-specific fields. No GitHub, no AWS, no vendor lock-in.

### Core Abstraction

A **Solution Record** is the atomic unit of the Observer Commons. It represents:

> "This problem was solved, here is evidence, here is how to compose it with other solutions."

Every Solution Record must address seven facets:

| # | Facet | Purpose |
|---|-------|---------|
| 1 | Problem Solved | What was the problem? |
| 2 | Domains | Where does this solution apply? |
| 3 | Validation | How do we know it works? |
| 4 | Implementation | Where does the solution live? |
| 5 | Composability | How does this connect to other solutions? |
| 6 | Provenance | Where did this come from? Who made it? |
| 7 | Trust Indicators | How much should you trust this? |

---

## 2. JSON-LD Context

The Observer Commons defines a JSON-LD context that maps short field names to fully qualified IRIs. This context extends Schema.org where alignment exists and defines custom terms under the `ocp:` namespace for protocol-specific concepts.

```json
{
  "@context": {
    "@version": 1.1,
    "schema": "https://schema.org/",
    "ocp": "https://observercommons.org/ns/v1#",
    "dcterms": "http://purl.org/dc/terms/",
    "skos": "http://www.w3.org/2004/02/skos/core#",

    "SolutionRecord": "ocp:SolutionRecord",

    "id": "@id",
    "type": "@type",

    "title": "schema:name",
    "description": "schema:description",
    "version": "schema:version",
    "dateCreated": "schema:dateCreated",
    "dateModified": "schema:dateModified",
    "datePublished": "schema:datePublished",
    "license": "schema:license",
    "keywords": "schema:keywords",
    "url": "schema:url",

    "problemSolved": "ocp:problemSolved",
    "problemStatement": "ocp:problemStatement",
    "problemContext": "ocp:problemContext",
    "cynefinDomain": "ocp:cynefinDomain",
    "solutionApproach": "ocp:solutionApproach",

    "domains": {
      "@id": "ocp:domains",
      "@type": "@id",
      "@container": "@set"
    },

    "validation": "ocp:validation",
    "validationMethod": "ocp:validationMethod",
    "validationEvidence": "ocp:validationEvidence",
    "validationDate": "ocp:validationDate",
    "validatedBy": "ocp:validatedBy",

    "implementation": "ocp:implementation",
    "implementationType": "ocp:implementationType",
    "implementationRefs": "ocp:implementationRefs",
    "language": "schema:programmingLanguage",
    "runtime": "ocp:runtime",

    "composability": "ocp:composability",
    "inputs": "ocp:inputs",
    "outputs": "ocp:outputs",
    "dependencies": "ocp:dependencies",
    "composableWith": "ocp:composableWith",
    "interfaceContract": "ocp:interfaceContract",

    "provenance": "ocp:provenance",
    "authors": {
      "@id": "schema:author",
      "@container": "@list"
    },
    "contributors": {
      "@id": "schema:contributor",
      "@container": "@list"
    },
    "sourceType": "ocp:sourceType",
    "derivedFrom": {
      "@id": "schema:isBasedOn",
      "@container": "@set"
    },
    "generatedBy": "ocp:generatedBy",

    "trust": "ocp:trust",
    "confidence": "ocp:confidence",
    "authority": "ocp:authority",
    "status": "ocp:status",
    "endorsements": "ocp:endorsements",
    "disputes": "ocp:disputes",
    "trustScore": "ocp:trustScore",

    "governance": "ocp:governance",
    "owner": "ocp:owner",
    "approvedBy": "ocp:approvedBy",
    "approvalDate": "ocp:approvalDate",

    "federation": "ocp:federation",
    "originNode": "ocp:originNode",
    "mirroredAt": "ocp:mirroredAt",
    "canonicalUri": "ocp:canonicalUri",

    "extensions": "ocp:extensions"
  }
}
```

**Hosted at**: `https://observercommons.org/ns/v1/context.jsonld` (future)

Implementations MAY reference the hosted context by URL or inline it. During the draft phase, inline the full context.

---

## 3. Solution Record Schema

### 3.1 Top-Level Structure

A Solution Record is a JSON-LD document with `@type: "SolutionRecord"`. It is organized into seven required facets plus optional metadata sections.

```
SolutionRecord
  +-- @context          (required, JSON-LD context)
  +-- @type             (required, "SolutionRecord")
  +-- @id               (required, unique URI)
  +-- meta              (required, record metadata)
  |     +-- title
  |     +-- description
  |     +-- version
  |     +-- dateCreated
  |     +-- dateModified
  |     +-- datePublished
  |     +-- keywords
  |     +-- license
  +-- problemSolved     (required, Facet 1)
  |     +-- statement
  |     +-- context
  |     +-- cynefinDomain
  |     +-- priorAttempts
  +-- domains           (required, Facet 2)
  +-- validation        (required, Facet 3)
  |     +-- method
  |     +-- evidence[]
  |     +-- reproducibility
  +-- implementation    (required, Facet 4)
  |     +-- type
  |     +-- refs[]
  |     +-- solutionApproach
  |     +-- language
  |     +-- runtime
  +-- composability     (required, Facet 5)
  |     +-- inputs[]
  |     +-- outputs[]
  |     +-- dependencies[]
  |     +-- composableWith[]
  |     +-- interfaceContract
  +-- provenance        (required, Facet 6)
  |     +-- authors[]
  |     +-- contributors[]
  |     +-- sourceType
  |     +-- derivedFrom[]
  |     +-- generatedBy
  +-- trust             (required, Facet 7)
  |     +-- confidence
  |     +-- authority
  |     +-- status
  |     +-- endorsements[]
  |     +-- disputes[]
  |     +-- trustScore
  +-- governance        (optional)
  |     +-- owner
  |     +-- approvedBy
  |     +-- approvalDate
  +-- federation        (optional)
  |     +-- originNode
  |     +-- mirroredAt[]
  |     +-- canonicalUri
  +-- extensions        (optional, vault-specific fields)
```

---

## 4. Field Definitions

### 4.1 Identity and Context

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `@context` | string or object | REQUIRED | JSON-LD context. Either the URL `https://observercommons.org/ns/v1/context.jsonld` or the full inline context object. |
| `@type` | string | REQUIRED | Must be `"SolutionRecord"`. |
| `@id` | string (URI) | REQUIRED | Globally unique identifier for this record. Format: `ocp:{node-id}/{record-uuid}` or any valid URI. Must be stable across time. |

### 4.2 Meta (Record Metadata)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `meta.title` | string | REQUIRED | Human-readable title of the solution. Should be concise and descriptive. Max 200 characters recommended. |
| `meta.description` | string | REQUIRED | One-paragraph summary of what this solution does and why it matters. |
| `meta.version` | string | REQUIRED | Semantic version of this record (not the solution itself). Format: `MAJOR.MINOR.PATCH`. |
| `meta.dateCreated` | string (ISO 8601) | REQUIRED | When the record was first created. |
| `meta.dateModified` | string (ISO 8601) | REQUIRED | When the record was last modified. |
| `meta.datePublished` | string (ISO 8601) | OPTIONAL | When the record was first published/federated. Null if unpublished. |
| `meta.keywords` | array of string | OPTIONAL | Free-form tags for discovery. Not constrained to controlled vocabulary. |
| `meta.license` | string (SPDX identifier or URL) | OPTIONAL | License governing reuse of this solution record. Defaults to the node's default license if unset. |

### 4.3 Facet 1: Problem Solved

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `problemSolved.statement` | string | REQUIRED | Clear, specific description of the problem. Should be understandable without domain expertise. One to three sentences. |
| `problemSolved.context` | string | OPTIONAL | Additional context: when does this problem arise? What assumptions are in play? What constraints apply? |
| `problemSolved.cynefinDomain` | enum | REQUIRED | Cynefin classification of the problem domain. See Section 5.1. Determines how trust and validation should be interpreted. |
| `problemSolved.priorAttempts` | array of string or URI | OPTIONAL | References to prior attempts to solve this problem, including failed approaches. Valuable for discovery. |

### 4.4 Facet 2: Domains

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `domains` | array of string | REQUIRED | One or more domain tags. Supports cross-domain tagging. Must contain at least one value. Uses the domain vocabulary (Section 5.3) but is extensible -- vaults may add custom domain tags prefixed with `x-`. |

### 4.5 Facet 3: Validation

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `validation.method` | enum | REQUIRED | How the solution was validated. See Section 5.5. |
| `validation.evidence` | array of object | REQUIRED | At least one piece of evidence. Each evidence object has `type` (string), `description` (string), and optional `uri` (string). |
| `validation.reproducibility` | enum | OPTIONAL | How reproducible is the validation? Values: `deterministic`, `statistical`, `contextual`, `unreproducible`. Default: `contextual`. |
| `validation.validatedBy` | array of object | OPTIONAL | Who or what performed the validation. Each entry has `name` (string), `type` (enum: `human`, `automated`, `ai-assisted`), and optional `uri` (string). |
| `validation.validationDate` | string (ISO 8601) | OPTIONAL | When validation was last performed. |

### 4.6 Facet 4: Implementation

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `implementation.type` | enum | REQUIRED | The kind of implementation. See Section 5.6. |
| `implementation.refs` | array of object | REQUIRED | At least one reference to where the implementation lives. Each ref has `type` (enum: `uri`, `file-path`, `inline`, `description`), `value` (string), and optional `label` (string). URIs are preferred for federation. File paths are local-only. |
| `implementation.solutionApproach` | string | OPTIONAL | Brief description of the approach/algorithm/pattern used. |
| `implementation.language` | string | OPTIONAL | Programming language, if applicable. Use standard names (e.g., `TypeScript`, `Python`, `Rust`). |
| `implementation.runtime` | string | OPTIONAL | Runtime environment, if applicable (e.g., `Node.js 20`, `Python 3.12`, `Browser`). |

### 4.7 Facet 5: Composability

This facet enables the composition layer to connect solutions together.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `composability.inputs` | array of object | REQUIRED | What this solution needs. Each input has `name` (string), `type` (string), `description` (string), and `required` (boolean). For non-code solutions, inputs may be conceptual (e.g., "team alignment on X"). |
| `composability.outputs` | array of object | REQUIRED | What this solution produces. Same structure as inputs. |
| `composability.dependencies` | array of object | OPTIONAL | Other solution records this depends on. Each has `recordId` (URI, referencing another Solution Record `@id`), `relationship` (enum: `requires`, `enhances`, `conflicts`, `supersedes`), and optional `description` (string). |
| `composability.composableWith` | array of string | OPTIONAL | Tags or record IDs indicating known-compatible solutions. Discovery hint, not a hard contract. |
| `composability.interfaceContract` | object | OPTIONAL | Machine-readable interface description. Structure is implementation-type-dependent. For code: may include function signatures, API schemas, etc. For non-code: may include preconditions/postconditions in natural language. Has `format` (string, e.g., `openapi`, `typescript`, `natural-language`) and `definition` (string or object). |

### 4.8 Facet 6: Provenance

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `provenance.authors` | array of object | REQUIRED | At least one author. Each has `name` (string), `type` (enum: `human`, `ai`, `organization`), and optional `uri` (string) and `role` (string). |
| `provenance.contributors` | array of object | OPTIONAL | Additional contributors. Same structure as authors. |
| `provenance.sourceType` | enum | REQUIRED | How this solution originated. See Section 5.7. Aligned with vault schema `source` values. |
| `provenance.derivedFrom` | array of string (URI) | OPTIONAL | URIs of prior works, solution records, papers, or resources this solution builds upon. |
| `provenance.generatedBy` | object | OPTIONAL | If AI was involved in creating this record. Has `model` (string), `provider` (string), `date` (ISO 8601), and `role` (enum: `author`, `co-author`, `indexer`, `editor`). |

### 4.9 Facet 7: Trust Indicators

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `trust.confidence` | enum | REQUIRED | Confidence level of the solution. See Section 5.2. Aligned with vault schema. |
| `trust.authority` | enum | REQUIRED | Authority level of the record. See Section 5.4. Aligned with vault schema. |
| `trust.status` | enum | REQUIRED | Lifecycle status of the record. See Section 5.8. Aligned with vault schema. |
| `trust.endorsements` | array of object | OPTIONAL | Independent endorsements from other nodes or humans. Each has `endorser` (string), `date` (ISO 8601), `uri` (optional string), and `comment` (optional string). Populated by the trust layer. |
| `trust.disputes` | array of object | OPTIONAL | Recorded disputes or contradictions. Each has `disputant` (string), `date` (ISO 8601), `claim` (string), and optional `evidence` (array of URI). Populated by the trust layer. |
| `trust.trustScore` | number or null | OPTIONAL | Computed trust score (0.0 to 1.0). Null if not yet computed. Calculated by the trust layer, not set by the record author. Read-only from the author's perspective. |

### 4.10 Governance (Optional)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `governance.owner` | string | OPTIONAL | URI or identifier of the entity responsible for this record. |
| `governance.approvedBy` | string | OPTIONAL | Identifier of the human who approved this record for publication. Enforces the "AI Articulates, Humans Decide" principle. |
| `governance.approvalDate` | string (ISO 8601) | OPTIONAL | When approval was granted. |

### 4.11 Federation (Optional)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `federation.originNode` | string (URI) | OPTIONAL | The node where this record was originally created. |
| `federation.mirroredAt` | array of string (URI) | OPTIONAL | Nodes that mirror this record. Populated by the federation layer. |
| `federation.canonicalUri` | string (URI) | OPTIONAL | The authoritative URI for this record. May differ from `@id` if the record was migrated. |

### 4.12 Extensions (Optional)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `extensions` | object | OPTIONAL | Vault-specific or domain-specific extensions. Keys should be namespaced (e.g., `observer-vault:mode`, `acme-corp:internalId`). Federation MUST preserve but MAY ignore extensions it does not understand. |

---

## 5. Controlled Vocabularies

All enums are lowercase strings. Vocabularies are aligned with the Observer Vault governance schema where overlap exists.

### 5.1 Cynefin Domain (`problemSolved.cynefinDomain`)

| Value | Description | Validation Implication |
|-------|-------------|----------------------|
| `simple` | Clear cause-effect. Best practice exists. | Validation should be deterministic. High reproducibility expected. |
| `complicated` | Cause-effect discoverable through analysis. Expert knowledge required. | Validation requires domain expertise. Evidence should reference expert analysis. |
| `complex` | Cause-effect only visible in retrospect. Emergent behavior. | Validation is contextual. Multiple independent observations increase trust. |
| `chaotic` | No discernible cause-effect. Novel/crisis response. | Validation is inherently limited. Timeliness matters more than certainty. |
| `disorder` | Classification is itself unclear. | Solution should clarify which domain applies. Low trust until reclassified. |

**Cynefin-Confidence Mapping**: The Cynefin domain constrains the *realistic maximum* confidence:

| Cynefin Domain | Maximum Realistic Confidence |
|----------------|------------------------------|
| `simple` | `foundational` |
| `complicated` | `proven` |
| `complex` | `tested` |
| `chaotic` | `provisional` |
| `disorder` | `speculative` |

Validators SHOULD warn (not reject) if `trust.confidence` exceeds the realistic maximum for the given Cynefin domain.

### 5.2 Confidence (`trust.confidence`)

Aligned with Observer Vault schema `confidence` enum.

| Value | Description |
|-------|-------------|
| `speculative` | Hypothesis or untested idea. |
| `provisional` | Initial evidence supports it, but limited validation. |
| `tested` | Validated in at least one real context. |
| `proven` | Validated across multiple independent contexts. |
| `foundational` | Bedrock knowledge -- widely accepted, extensively validated. |

### 5.3 Domains (`domains`)

Core domain vocabulary, aligned with Observer Vault schema `domain` enum. Extended for broader applicability.

**Core Domains** (from vault schema):
`consciousness`, `governance`, `council`, `vault`, `infrastructure`, `oil`, `search`, `coordination`, `philosophy`, `gaming`, `personal`, `geopolitics`, `memory`

**Extended Domains** (for cross-ecosystem use):
`software-engineering`, `data-science`, `security`, `devops`, `architecture`, `machine-learning`, `distributed-systems`, `databases`, `networking`, `economics`, `education`, `health`, `law`, `mathematics`, `physics`, `biology`, `chemistry`, `design`, `ux`, `product-management`, `operations`

**Custom Domains**: Vaults may add custom domains prefixed with `x-` (e.g., `x-internal-tooling`, `x-company-specific`). Custom domains are preserved during federation but not indexed by default.

### 5.4 Authority (`trust.authority`)

Aligned with Observer Vault schema `authority` enum.

| Value | Description |
|-------|-------------|
| `none` | No authority claim. Informational only. |
| `low` | Minor contribution. Limited scope. |
| `medium` | Solid contribution with evidence. |
| `high` | Significant, well-validated contribution. |
| `foundational` | Core knowledge. Widely relied upon. |

### 5.5 Validation Method (`validation.method`)

| Value | Description |
|-------|-------------|
| `automated-test` | Automated test suite passes. |
| `manual-test` | Human tested manually. |
| `peer-review` | Reviewed by qualified peer(s). |
| `formal-verification` | Mathematically or formally proven. |
| `production-use` | Used in production successfully. |
| `expert-assessment` | Domain expert assessed correctness. |
| `community-consensus` | Community agrees through discussion or voting. |
| `self-reported` | Author's own claim without independent verification. |
| `none` | No validation performed. |

### 5.6 Implementation Type (`implementation.type`)

| Value | Description |
|-------|-------------|
| `code-library` | Reusable code library or module. |
| `code-snippet` | Standalone code example or gist. |
| `code-application` | Complete application or service. |
| `algorithm` | Algorithm description (may include pseudocode). |
| `configuration` | Configuration, infrastructure-as-code, or deployment setup. |
| `pattern` | Design pattern, architectural pattern, or methodology. |
| `process` | Human process, workflow, or procedure. |
| `guide` | How-to guide, tutorial, or documentation. |
| `framework` | Conceptual or analytical framework. |
| `dataset` | Data resource or dataset. |
| `model` | Trained ML model or analytical model. |
| `other` | Does not fit other categories. |

### 5.7 Source Type (`provenance.sourceType`)

Aligned with Observer Vault schema `source` enum, extended for broader use.

| Value | Description |
|-------|-------------|
| `human_authored` | Entirely human-created. |
| `ai_generated` | Primarily AI-generated content. |
| `ai_assisted` | Human-authored with AI assistance. |
| `collaborative` | Multiple human and/or AI contributors. |
| `extracted` | Extracted or indexed from existing resources. |
| `vault_synthesis` | Synthesized from vault knowledge base. (Vault-aligned) |
| `external_research` | Derived from external research. (Vault-aligned) |
| `adam_decision` | Originated from principal decision. (Vault-specific) |

### 5.8 Status (`trust.status`)

Aligned with Observer Vault schema `status` enum.

| Value | Description |
|-------|-------------|
| `inbox` | Newly created, unreviewed. |
| `draft` | Work in progress. |
| `review` | Under review for promotion. |
| `canonical` | Approved, authoritative version. |
| `archived` | No longer active but preserved. |
| `superseded` | Replaced by a newer record. When set, `composability.dependencies` SHOULD contain a `supersedes` relationship pointing to the replacement. |

---

## 6. Schema.org Alignment

### 6.1 Direct Mappings

The following Solution Record fields map directly to Schema.org properties:

| Solution Record Field | Schema.org Property | Schema.org Type |
|----------------------|--------------------|-----------------------|
| `meta.title` | `schema:name` | `Text` |
| `meta.description` | `schema:description` | `Text` |
| `meta.version` | `schema:version` | `Text` |
| `meta.dateCreated` | `schema:dateCreated` | `Date` / `DateTime` |
| `meta.dateModified` | `schema:dateModified` | `Date` / `DateTime` |
| `meta.datePublished` | `schema:datePublished` | `Date` / `DateTime` |
| `meta.keywords` | `schema:keywords` | `Text` |
| `meta.license` | `schema:license` | `URL` / `CreativeWork` |
| `provenance.authors` | `schema:author` | `Person` / `Organization` |
| `provenance.contributors` | `schema:contributor` | `Person` / `Organization` |
| `provenance.derivedFrom` | `schema:isBasedOn` | `URL` / `CreativeWork` |
| `implementation.language` | `schema:programmingLanguage` | `Text` / `ComputerLanguage` |

### 6.2 Type Alignment

The `SolutionRecord` type is a custom type that draws from multiple Schema.org types:

| Schema.org Type | Relationship | Which Facets |
|-----------------|-------------|--------------|
| `schema:CreativeWork` | Parent type. Solution records are creative works with metadata, authors, and licenses. | Meta, Provenance |
| `schema:HowTo` | Partial alignment. Code and non-code solutions both describe "how to" solve problems. | ProblemSolved, Implementation |
| `schema:SoftwareSourceCode` | Partial alignment. Code solutions have language, runtime, dependencies. | Implementation (code types only) |
| `schema:TechArticle` | Partial alignment. Knowledge solutions resemble technical articles. | Implementation (non-code types) |
| `schema:Review` | Inspiration for trust facet. Reviews have ratings and endorsements. | Trust |
| `schema:Action` | Conceptual alignment for composability. Solutions have inputs and outputs like actions. | Composability |

### 6.3 Custom Extensions (ocp: namespace)

These fields have NO direct Schema.org equivalent and are defined in the `ocp:` namespace:

| Custom Field | Reason for Custom Definition |
|-------------|------------------------------|
| `ocp:problemSolved` | Schema.org has no "problem statement" type. `schema:HowTo` describes steps, not the problem itself. |
| `ocp:cynefinDomain` | Cynefin is a domain-specific classification with no Schema.org equivalent. |
| `ocp:composability` | Schema.org `Action` has inputs/outputs but no dependency graph or interface contracts. |
| `ocp:validation` | Schema.org `Review` covers opinions, not structured validation evidence. |
| `ocp:confidence` | Domain-specific maturity ladder with no Schema.org equivalent. |
| `ocp:authority` | Domain-specific authority level with no Schema.org equivalent. |
| `ocp:trustScore` | Computed federated trust has no Schema.org equivalent. |
| `ocp:federation` | Federation metadata is protocol-specific. |
| `ocp:endorsements` | More structured than `schema:Review` -- includes cryptographic identity (future). |
| `ocp:disputes` | No Schema.org equivalent for structured disagreement. |

### 6.4 Future Alignment

If Schema.org introduces types for "solved problems" or "knowledge claims," the `ocp:` context can add `@type` aliases to maintain backward compatibility while gaining Schema.org discoverability.

---

## 7. Example Records

### 7.1 Example 1: Code Solution

A TypeScript utility for debouncing async functions -- a concrete code solution.

```json
{
  "@context": "https://observercommons.org/ns/v1/context.jsonld",
  "@type": "SolutionRecord",
  "@id": "ocp:observer-vault/sr-2026-001",

  "meta": {
    "title": "Async-safe debounce with leading-edge support in TypeScript",
    "description": "A debounce implementation that correctly handles async functions by canceling pending promises on re-invocation, with optional leading-edge execution. Solves the common problem of race conditions in debounced API calls.",
    "version": "1.0.0",
    "dateCreated": "2026-02-15T10:00:00Z",
    "dateModified": "2026-02-20T14:30:00Z",
    "datePublished": null,
    "keywords": ["debounce", "async", "typescript", "race-condition", "utility"],
    "license": "MIT"
  },

  "problemSolved": {
    "statement": "Standard debounce implementations (e.g., lodash.debounce) do not handle async functions correctly -- they can cause race conditions where a stale promise resolves after a newer call, producing incorrect UI state.",
    "context": "Occurs in any frontend application making debounced API calls (search-as-you-type, auto-save). The problem is most visible when network latency varies, causing responses to arrive out of order.",
    "cynefinDomain": "complicated",
    "priorAttempts": [
      "lodash.debounce -- does not cancel promises",
      "AbortController wrapper -- requires manual plumbing per call site",
      "https://github.com/xnimorz/use-debounce -- React-specific, not framework-agnostic"
    ]
  },

  "domains": ["software-engineering", "infrastructure"],

  "validation": {
    "method": "automated-test",
    "evidence": [
      {
        "type": "test-suite",
        "description": "47 unit tests covering: basic debounce, leading-edge, trailing-edge, async cancellation, concurrent invocation, error propagation, and cleanup.",
        "uri": "ocp:observer-vault/sr-2026-001/tests"
      },
      {
        "type": "production-use",
        "description": "Used in Observer Vault search interface for 3 weeks without race condition reports."
      }
    ],
    "reproducibility": "deterministic",
    "validatedBy": [
      {"name": "Adam", "type": "human"},
      {"name": "Vitest test runner", "type": "automated"}
    ],
    "validationDate": "2026-02-20T14:30:00Z"
  },

  "implementation": {
    "type": "code-library",
    "refs": [
      {
        "type": "uri",
        "value": "ocp:observer-vault/sr-2026-001/src/async-debounce.ts",
        "label": "Source file"
      }
    ],
    "solutionApproach": "Wraps the target function in a closure that tracks an invocation counter. Each call increments the counter and captures its value. When the debounce timer fires, the function executes only if the counter still matches -- otherwise the invocation is stale. Pending promises from stale invocations are rejected with a CancelledError.",
    "language": "TypeScript",
    "runtime": "Node.js 20+ / Modern browsers"
  },

  "composability": {
    "inputs": [
      {
        "name": "fn",
        "type": "(...args: any[]) => Promise<T>",
        "description": "The async function to debounce.",
        "required": true
      },
      {
        "name": "delay",
        "type": "number",
        "description": "Debounce delay in milliseconds.",
        "required": true
      },
      {
        "name": "options",
        "type": "{ leading?: boolean }",
        "description": "Optional configuration. Leading-edge fires immediately on first call.",
        "required": false
      }
    ],
    "outputs": [
      {
        "name": "debouncedFn",
        "type": "(...args: any[]) => Promise<T>",
        "description": "The debounced function. Returns a promise that resolves with the result or rejects with CancelledError if superseded."
      },
      {
        "name": "cancel",
        "type": "() => void",
        "description": "Manually cancel any pending invocation."
      }
    ],
    "dependencies": [],
    "composableWith": ["search-input", "auto-save", "api-client"],
    "interfaceContract": {
      "format": "typescript",
      "definition": "export declare function asyncDebounce<T>(fn: (...args: any[]) => Promise<T>, delay: number, options?: { leading?: boolean }): { call: (...args: any[]) => Promise<T>; cancel: () => void; }"
    }
  },

  "provenance": {
    "authors": [
      {"name": "Adam", "type": "human", "role": "designer"},
      {"name": "Claude", "type": "ai", "role": "co-author"}
    ],
    "contributors": [],
    "sourceType": "ai_assisted",
    "derivedFrom": [
      "https://lodash.com/docs/4.17.15#debounce",
      "https://developer.mozilla.org/en-US/docs/Web/API/AbortController"
    ],
    "generatedBy": {
      "model": "claude-opus-4",
      "provider": "Anthropic",
      "date": "2026-02-15T10:00:00Z",
      "role": "co-author"
    }
  },

  "trust": {
    "confidence": "tested",
    "authority": "medium",
    "status": "draft",
    "endorsements": [],
    "disputes": [],
    "trustScore": null
  },

  "governance": {
    "owner": "ocp:observer-vault",
    "approvedBy": null,
    "approvalDate": null
  },

  "federation": {
    "originNode": "ocp:observer-vault",
    "mirroredAt": [],
    "canonicalUri": "ocp:observer-vault/sr-2026-001"
  },

  "extensions": {
    "observer-vault:mode": "build",
    "observer-vault:kind": "exit_artifact"
  }
}
```

### 7.2 Example 2: Non-Code Knowledge Solution

An organizational pattern for running effective architecture decision records (ADRs) in distributed teams.

```json
{
  "@context": "https://observercommons.org/ns/v1/context.jsonld",
  "@type": "SolutionRecord",
  "@id": "ocp:observer-vault/sr-2026-002",

  "meta": {
    "title": "Lightweight ADR process for distributed teams with async-first review",
    "description": "A process for creating, reviewing, and maintaining Architecture Decision Records in teams that work primarily asynchronously across time zones. Reduces decision latency from weeks to days by replacing synchronous review meetings with structured async review windows.",
    "version": "1.0.0",
    "dateCreated": "2026-01-10T08:00:00Z",
    "dateModified": "2026-02-28T12:00:00Z",
    "datePublished": null,
    "keywords": ["adr", "architecture-decisions", "async-work", "distributed-teams", "process", "documentation"],
    "license": "CC-BY-4.0"
  },

  "problemSolved": {
    "statement": "Distributed teams struggle to make and record architectural decisions because traditional ADR processes assume synchronous review meetings, which cause scheduling bottlenecks across time zones and lead to decision paralysis or undocumented decisions.",
    "context": "Most acute in teams spanning 3+ time zones where finding a common meeting slot costs days of latency per decision. The problem compounds: undocumented decisions lead to relitigated decisions, which further slows the team.",
    "cynefinDomain": "complex",
    "priorAttempts": [
      "Michael Nygard's original ADR format -- good structure but assumes collocated review",
      "MADR (Markdown ADR) -- improves format but does not address async review process",
      "RFC process (Rust, React) -- too heavyweight for most teams, requires dedicated reviewers"
    ]
  },

  "domains": ["software-engineering", "architecture", "coordination", "governance"],

  "validation": {
    "method": "production-use",
    "evidence": [
      {
        "type": "case-study",
        "description": "Used by a 12-person team across AU/EU/US time zones for 6 months. Reduced average decision time from 14 days to 3 days. 38 ADRs created, 2 superseded."
      },
      {
        "type": "retrospective",
        "description": "Team retrospective at 3-month mark identified the 48-hour review window and explicit 'silence is consent' rule as the key improvements over previous process."
      }
    ],
    "reproducibility": "contextual",
    "validatedBy": [
      {"name": "Adam", "type": "human"},
      {"name": "Engineering team (12 members)", "type": "human"}
    ],
    "validationDate": "2026-02-28T12:00:00Z"
  },

  "implementation": {
    "type": "process",
    "refs": [
      {
        "type": "description",
        "value": "The process consists of four phases: (1) Draft -- author writes ADR using template, tags relevant reviewers, sets 48-hour review window. (2) Review -- reviewers comment async within window. Silence after 48 hours = consent. (3) Decide -- author addresses comments, records decision and dissents. (4) Maintain -- superseded ADRs link to replacement. Quarterly audit ensures ADRs match reality.",
        "label": "Process description"
      },
      {
        "type": "uri",
        "value": "ocp:observer-vault/sr-2026-002/adr-template.md",
        "label": "ADR template"
      }
    ],
    "solutionApproach": "Replace synchronous review meetings with time-boxed async review windows. Use explicit consent rules (silence = consent after 48 hours) to prevent blocking. Structure the template to front-load context so reviewers can assess without a meeting."
  },

  "composability": {
    "inputs": [
      {
        "name": "team",
        "type": "human-group",
        "description": "A distributed team that needs to make and record architectural decisions.",
        "required": true
      },
      {
        "name": "communication-platform",
        "type": "tool",
        "description": "Any async communication tool that supports threading and mentions (Slack, Teams, Discord, email).",
        "required": true
      },
      {
        "name": "document-store",
        "type": "tool",
        "description": "A place to store ADR documents (git repo, wiki, vault).",
        "required": true
      }
    ],
    "outputs": [
      {
        "name": "documented-decisions",
        "type": "artifact-collection",
        "description": "A growing collection of numbered, linked ADRs that form an architectural decision log."
      },
      {
        "name": "reduced-decision-latency",
        "type": "outcome",
        "description": "Measurable reduction in time from 'decision needed' to 'decision recorded'."
      }
    ],
    "dependencies": [],
    "composableWith": ["team-onboarding", "architectural-review", "documentation-system"],
    "interfaceContract": {
      "format": "natural-language",
      "definition": "Preconditions: Team has a shared document store and async communication channel. Postconditions: Decisions are recorded with context, rationale, alternatives considered, and dissents noted. Invariant: No decision is made without at least one review window."
    }
  },

  "provenance": {
    "authors": [
      {"name": "Adam", "type": "human", "role": "process designer"}
    ],
    "contributors": [
      {"name": "Engineering team", "type": "organization", "role": "iteration feedback"}
    ],
    "sourceType": "human_authored",
    "derivedFrom": [
      "https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions",
      "https://adr.github.io/madr/"
    ]
  },

  "trust": {
    "confidence": "tested",
    "authority": "medium",
    "status": "review",
    "endorsements": [],
    "disputes": [],
    "trustScore": null
  },

  "governance": {
    "owner": "ocp:observer-vault",
    "approvedBy": null,
    "approvalDate": null
  },

  "federation": {
    "originNode": "ocp:observer-vault",
    "mirroredAt": [],
    "canonicalUri": "ocp:observer-vault/sr-2026-002"
  },

  "extensions": {
    "observer-vault:mode": "design",
    "observer-vault:kind": "architecture"
  }
}
```

---

## 8. Extensibility Model

### 8.1 Principles

1. **Open-world assumption**: Any field not in the schema MAY be present. Consumers MUST ignore fields they do not understand. Consumers MUST NOT reject records with unknown fields.

2. **Namespaced extensions**: Custom fields MUST be namespaced to avoid collisions. Use the `extensions` object with keys formatted as `{namespace}:{field}` (e.g., `observer-vault:mode`).

3. **Federation preservation**: Federation nodes MUST preserve the `extensions` object intact when mirroring records. They MAY choose not to index extension fields.

4. **Domain vocabulary extension**: Vaults may add custom domain tags prefixed with `x-`. Core domains (Section 5.3) are governed by the protocol. Custom domains are vault-local.

### 8.2 Extension Examples

```json
{
  "extensions": {
    "observer-vault:mode": "build",
    "observer-vault:kind": "exit_artifact",
    "observer-vault:cssclasses": ["status-draft"],
    "acme-corp:internal-ticket": "ARCH-1234",
    "acme-corp:team": "platform-engineering",
    "research-lab:doi": "10.1234/example.2026.001"
  }
}
```

### 8.3 Future Schema Evolution

New fields MAY be added to the core schema in minor versions. Existing fields MUST NOT be removed or have their semantics changed in minor versions. Breaking changes require a major version bump and a new `@context` URL.

**Version negotiation**: Records declare their context version via `@context`. Consumers check the context version to determine which fields to expect. Older consumers encountering newer records apply the open-world assumption (ignore unknown fields).

---

## 9. Versioning and Immutability

### 9.1 Record Versioning

Solution records use semantic versioning (`meta.version`):

- **PATCH** (1.0.0 -> 1.0.1): Typo fixes, metadata corrections. No semantic change.
- **MINOR** (1.0.0 -> 1.1.0): Additional evidence, new validation, improved description. Solution meaning is preserved.
- **MAJOR** (1.0.0 -> 2.0.0): Fundamental change to the solution approach, inputs/outputs, or problem statement.

### 9.2 Immutability Model

**Published records are append-versioned, not mutated.**

Once a record is published (`trust.status` is `canonical` and `meta.datePublished` is set):

1. The published version becomes immutable. Its `@id` permanently refers to that version.
2. New versions create new records with a new `@id` that includes a version suffix (e.g., `ocp:node/sr-001/v2`).
3. The new version's `composability.dependencies` SHOULD include a `supersedes` relationship pointing to the previous version.
4. The previous version's `trust.status` transitions to `superseded`.

**Draft and review records are mutable.** Records with `trust.status` of `inbox`, `draft`, or `review` MAY be modified in place. The `meta.dateModified` and `meta.version` fields MUST be updated on each change.

### 9.3 Rationale

Immutability of published records is essential for federation trust. If Node A endorses a record and Node B later modifies that record, the endorsement becomes invalid. Append-versioning preserves the endorsement chain while allowing knowledge to evolve.

---

## 10. Pre-Mortem

*"What could go wrong with this schema design?"*

### 10.1 Schema Too Complex for Adoption

**Risk**: The seven required facets with their sub-fields create a high barrier to entry. Authors may skip optional fields, producing records that are technically valid but practically useless.

**Mitigation**: Define "minimum viable record" profiles. A record with `statement`, `domains`, `validation.method` = `self-reported`, `implementation.type`, one `implementation.ref`, one `provenance.author`, and `trust.confidence` = `speculative` is valid. Tooling should make this easy.

### 10.2 Controlled Vocabularies Become Stale

**Risk**: The enumerated values (domains, implementation types, validation methods) may not cover emerging fields or use cases.

**Mitigation**: The `x-` prefix convention for domains and the `other` fallback for implementation types provide escape hatches. The protocol governance process (out of scope for this document) must define how new values are proposed and adopted.

### 10.3 Cynefin Classification is Subjective

**Risk**: Two independent authors may classify the same problem differently (e.g., `complicated` vs. `complex`), leading to inconsistent trust interpretations.

**Mitigation**: This is a feature, not a bug. Surveyor epistemology expects disagreement. The trust layer should treat Cynefin disagreement as a signal, not an error. Records with disputed classifications are candidates for deeper analysis.

### 10.4 JSON-LD Complexity Alienates Developers

**Risk**: JSON-LD is powerful but unfamiliar to many developers. The `@context`, `@type`, `@id` ceremony may feel heavy.

**Mitigation**: Provide "plain JSON" mode where context is assumed from the protocol version. Tooling converts between plain JSON and full JSON-LD. JSON-LD is the canonical wire format; developers never need to write it by hand.

### 10.5 Trust Score Gaming

**Risk**: Bad actors create self-endorsing records or collude across nodes to inflate trust scores.

**Mitigation**: This is a trust layer problem, not a schema problem. The schema provides the *fields* for trust but does not compute trust. The trust layer (designed separately) must implement sybil resistance, independent verification requirements, and reputation decay.

### 10.6 Composability Interfaces Are Too Loose

**Risk**: The `composability.interfaceContract` field supports multiple formats (`openapi`, `typescript`, `natural-language`), making automated composition difficult.

**Mitigation**: Start loose, tighten over time. The composition layer can define "composition profiles" that require specific interface formats for automated composition. Natural-language contracts are valid for discovery; machine-readable contracts are required for automated composition.

### 10.7 Record Size Growth

**Risk**: As endorsements and disputes accumulate, records grow unbounded.

**Mitigation**: Define a maximum inline endorsement/dispute count (e.g., 50). Beyond that threshold, use a `moreAt` URI pointing to the full list. Federation nodes may choose their own storage policies.

---

## 11. Sovereignty Check

*"Does this schema design preserve human control?"*

### 11.1 Authorship

The `provenance.authors` field distinguishes `human`, `ai`, and `organization` types. AI contributions are always explicitly marked. The `provenance.generatedBy` field records the specific model and its role.

**Verdict**: Human authorship is visible and distinguishable. PASS.

### 11.2 Approval

The `governance.approvedBy` field exists specifically to record human approval. The promotion from `draft` to `canonical` status is a governance action, not an automated one.

**Verdict**: Publication requires explicit human approval. PASS.

### 11.3 Trust

The `trust.trustScore` is read-only from the author's perspective. Authors cannot set their own trust score. Endorsements and disputes require independent actors.

**Verdict**: Trust is earned through independent validation, not self-declared. PASS.

### 11.4 Ownership

The `governance.owner` field establishes who controls a record. The federation model preserves the `originNode`, ensuring that mirrored copies can always be traced to their source.

**Verdict**: Ownership is explicit and preserved across federation. PASS.

### 11.5 Modification Control

Published records are immutable. Only draft records can be modified, and only by the owning node. Federation mirrors are read-only copies.

**Verdict**: Authors retain control over their records. PASS.

### 11.6 Opt-Out

The schema does not mandate federation. Records can exist purely locally with no `federation` section. Publication is an explicit choice (`meta.datePublished`).

**Verdict**: Participation in federation is opt-in. PASS.

### Overall Sovereignty Assessment: PASS

The schema preserves human sovereignty at every decision point. AI can create, index, tag, and discover records -- but publishing, endorsing, and governing records requires human action.

---

## 12. Simplicity Check

*"Is this the simplest schema version that could work?"*

### 12.1 What Could Be Removed?

| Field / Section | Remove? | Rationale |
|----------------|---------|-----------|
| `governance` section | NO | Without it, human approval has no place to live. Sovereignty requirement. |
| `federation` section | MAYBE | Could be added in v0.2. But federation nodes need it from day one to route records. Keep as optional. |
| `composability.interfaceContract` | MAYBE | Could defer machine-readable contracts to v0.2. But without it, automated composition is impossible. Keep as optional. |
| `problemSolved.priorAttempts` | YES-ISH | Nice to have for discovery but not essential. Keep as optional -- does not add required complexity. |
| `validation.reproducibility` | YES-ISH | Useful nuance but `validation.method` carries most information. Keep as optional. |
| `trust.trustScore` | NO | The trust layer needs this field to exist, even if null. |
| `extensions` | NO | Essential for extensibility without breaking federation. |

### 12.2 What Is The Minimum Viable Record?

A valid Solution Record requires exactly these fields:

```json
{
  "@context": "https://observercommons.org/ns/v1/context.jsonld",
  "@type": "SolutionRecord",
  "@id": "ocp:my-node/sr-001",
  "meta": {
    "title": "My Solution",
    "description": "What it does.",
    "version": "0.1.0",
    "dateCreated": "2026-03-01",
    "dateModified": "2026-03-01"
  },
  "problemSolved": {
    "statement": "The problem I solved.",
    "cynefinDomain": "simple"
  },
  "domains": ["software-engineering"],
  "validation": {
    "method": "self-reported",
    "evidence": [{"type": "claim", "description": "I tested it and it works."}]
  },
  "implementation": {
    "type": "code-snippet",
    "refs": [{"type": "description", "value": "A function that does X."}]
  },
  "composability": {
    "inputs": [{"name": "data", "type": "any", "description": "Input data.", "required": true}],
    "outputs": [{"name": "result", "type": "any", "description": "Output result."}]
  },
  "provenance": {
    "authors": [{"name": "Me", "type": "human"}],
    "sourceType": "human_authored"
  },
  "trust": {
    "confidence": "speculative",
    "authority": "none",
    "status": "draft"
  }
}
```

This minimum record is approximately 40 lines of JSON. All seven facets are represented. It can be created by hand in under 5 minutes or auto-generated by tooling in seconds.

### 12.3 Simplicity Verdict

The schema has **7 required facets** and **3 optional sections**. The required facets each serve a distinct purpose that cannot be covered by another facet. The optional sections (governance, federation, extensions) are genuinely optional -- a local-only record does not need them.

**Could this be simpler?** Not without losing a required capability. Each facet was included because another layer of the protocol (trust, discovery, composition, federation) depends on it. Removing any facet would break a downstream dependency.

**Verdict**: This is the simplest schema that satisfies the seven-facet requirement while supporting federation, trust, and composition. PASS.

---

## Appendix A: JSON Schema (for validation tooling)

A formal JSON Schema for automated validation of Solution Records. This is informative, not normative -- the JSON-LD context definition in Section 2 is the canonical schema.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://observercommons.org/ns/v1/solution-record.schema.json",
  "title": "Observer Commons Solution Record",
  "description": "DRAFT -- Schema for validating Solution Record documents",
  "type": "object",
  "required": ["@context", "@type", "@id", "meta", "problemSolved", "domains", "validation", "implementation", "composability", "provenance", "trust"],
  "properties": {
    "@context": {
      "description": "JSON-LD context URL or inline object"
    },
    "@type": {
      "const": "SolutionRecord"
    },
    "@id": {
      "type": "string",
      "format": "uri-reference"
    },
    "meta": {
      "type": "object",
      "required": ["title", "description", "version", "dateCreated", "dateModified"],
      "properties": {
        "title": {"type": "string", "maxLength": 200},
        "description": {"type": "string"},
        "version": {"type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+"},
        "dateCreated": {"type": "string", "format": "date-time"},
        "dateModified": {"type": "string", "format": "date-time"},
        "datePublished": {"type": ["string", "null"], "format": "date-time"},
        "keywords": {"type": "array", "items": {"type": "string"}},
        "license": {"type": "string"}
      }
    },
    "problemSolved": {
      "type": "object",
      "required": ["statement", "cynefinDomain"],
      "properties": {
        "statement": {"type": "string"},
        "context": {"type": "string"},
        "cynefinDomain": {"enum": ["simple", "complicated", "complex", "chaotic", "disorder"]},
        "priorAttempts": {"type": "array", "items": {"type": "string"}}
      }
    },
    "domains": {
      "type": "array",
      "minItems": 1,
      "items": {"type": "string"}
    },
    "validation": {
      "type": "object",
      "required": ["method", "evidence"],
      "properties": {
        "method": {"enum": ["automated-test", "manual-test", "peer-review", "formal-verification", "production-use", "expert-assessment", "community-consensus", "self-reported", "none"]},
        "evidence": {
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "object",
            "required": ["type", "description"],
            "properties": {
              "type": {"type": "string"},
              "description": {"type": "string"},
              "uri": {"type": "string"}
            }
          }
        },
        "reproducibility": {"enum": ["deterministic", "statistical", "contextual", "unreproducible"]},
        "validatedBy": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["name", "type"],
            "properties": {
              "name": {"type": "string"},
              "type": {"enum": ["human", "automated", "ai-assisted"]},
              "uri": {"type": "string"}
            }
          }
        },
        "validationDate": {"type": "string", "format": "date-time"}
      }
    },
    "implementation": {
      "type": "object",
      "required": ["type", "refs"],
      "properties": {
        "type": {"enum": ["code-library", "code-snippet", "code-application", "algorithm", "configuration", "pattern", "process", "guide", "framework", "dataset", "model", "other"]},
        "refs": {
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "object",
            "required": ["type", "value"],
            "properties": {
              "type": {"enum": ["uri", "file-path", "inline", "description"]},
              "value": {"type": "string"},
              "label": {"type": "string"}
            }
          }
        },
        "solutionApproach": {"type": "string"},
        "language": {"type": "string"},
        "runtime": {"type": "string"}
      }
    },
    "composability": {
      "type": "object",
      "required": ["inputs", "outputs"],
      "properties": {
        "inputs": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["name", "type", "description"],
            "properties": {
              "name": {"type": "string"},
              "type": {"type": "string"},
              "description": {"type": "string"},
              "required": {"type": "boolean"}
            }
          }
        },
        "outputs": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["name", "type", "description"],
            "properties": {
              "name": {"type": "string"},
              "type": {"type": "string"},
              "description": {"type": "string"}
            }
          }
        },
        "dependencies": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["recordId", "relationship"],
            "properties": {
              "recordId": {"type": "string"},
              "relationship": {"enum": ["requires", "enhances", "conflicts", "supersedes"]},
              "description": {"type": "string"}
            }
          }
        },
        "composableWith": {"type": "array", "items": {"type": "string"}},
        "interfaceContract": {
          "type": "object",
          "required": ["format", "definition"],
          "properties": {
            "format": {"type": "string"},
            "definition": {}
          }
        }
      }
    },
    "provenance": {
      "type": "object",
      "required": ["authors", "sourceType"],
      "properties": {
        "authors": {
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "object",
            "required": ["name", "type"],
            "properties": {
              "name": {"type": "string"},
              "type": {"enum": ["human", "ai", "organization"]},
              "uri": {"type": "string"},
              "role": {"type": "string"}
            }
          }
        },
        "contributors": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["name", "type"],
            "properties": {
              "name": {"type": "string"},
              "type": {"enum": ["human", "ai", "organization"]},
              "uri": {"type": "string"},
              "role": {"type": "string"}
            }
          }
        },
        "sourceType": {"enum": ["human_authored", "ai_generated", "ai_assisted", "collaborative", "extracted", "vault_synthesis", "external_research", "adam_decision"]},
        "derivedFrom": {"type": "array", "items": {"type": "string"}},
        "generatedBy": {
          "type": "object",
          "required": ["model", "provider", "date", "role"],
          "properties": {
            "model": {"type": "string"},
            "provider": {"type": "string"},
            "date": {"type": "string", "format": "date-time"},
            "role": {"enum": ["author", "co-author", "indexer", "editor"]}
          }
        }
      }
    },
    "trust": {
      "type": "object",
      "required": ["confidence", "authority", "status"],
      "properties": {
        "confidence": {"enum": ["speculative", "provisional", "tested", "proven", "foundational"]},
        "authority": {"enum": ["none", "low", "medium", "high", "foundational"]},
        "status": {"enum": ["inbox", "draft", "review", "canonical", "archived", "superseded"]},
        "endorsements": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["endorser", "date"],
            "properties": {
              "endorser": {"type": "string"},
              "date": {"type": "string", "format": "date-time"},
              "uri": {"type": "string"},
              "comment": {"type": "string"}
            }
          }
        },
        "disputes": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["disputant", "date", "claim"],
            "properties": {
              "disputant": {"type": "string"},
              "date": {"type": "string", "format": "date-time"},
              "claim": {"type": "string"},
              "evidence": {"type": "array", "items": {"type": "string"}}
            }
          }
        },
        "trustScore": {"type": ["number", "null"], "minimum": 0, "maximum": 1}
      }
    },
    "governance": {
      "type": "object",
      "properties": {
        "owner": {"type": "string"},
        "approvedBy": {"type": ["string", "null"]},
        "approvalDate": {"type": ["string", "null"], "format": "date-time"}
      }
    },
    "federation": {
      "type": "object",
      "properties": {
        "originNode": {"type": "string"},
        "mirroredAt": {"type": "array", "items": {"type": "string"}},
        "canonicalUri": {"type": "string"}
      }
    },
    "extensions": {
      "type": "object",
      "additionalProperties": true
    }
  }
}
```

---

## Appendix B: ISC Traceability Matrix

| ISC Criterion | Section | Status |
|---------------|---------|--------|
| ISC-Schema-1: JSON-LD format | Section 2, 3 | SATISFIED -- Full JSON-LD context with @context, @type, @id |
| ISC-Schema-2: Seven required facets | Section 3, 4 | SATISFIED -- All seven facets defined with required/optional fields |
| ISC-Schema-3: Explicit field definitions | Section 4 | SATISFIED -- Every field has type, required/optional, description |
| ISC-Schema-4: Two example records | Section 7 | SATISFIED -- Code solution (async debounce) and non-code solution (ADR process) |
| ISC-Schema-5: Vault schema alignment | Section 5 | SATISFIED -- confidence, authority, status, domain, source vocabularies aligned |
| ISC-Schema-6: Schema.org alignment | Section 6 | SATISFIED -- Direct mappings, type alignment, and custom extension documentation |
| ISC-Schema-7: Cynefin classification | Section 4.3, 5.1 | SATISFIED -- cynefinDomain field with five values and confidence mapping |
| ISC-A-Schema-1: No GitHub dependency | All | SATISFIED -- No GitHub-specific fields anywhere in schema |

---

*End of DRAFT specification. This document is subject to revision as the Observer Commons protocol develops.*
