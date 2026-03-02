# DRAFT -- Observer Commons Protocol: Composition & Integration Specification

**Version:** 0.1.0-draft
**Status:** DRAFT -- Not ratified. Subject to change.
**Date:** 2026-03-01
**Author:** Sub-Agent 4 (Composition & Integration Analyst)
**ISC Criteria:** ISC-Comp-1 through ISC-Comp-6, ISC-A-Comp-1
**Boundary:** Composition protocol only. Assumes solution records, federation discovery, and trust layer exist as separate concerns.

---

## 1. Purpose & Scope

This document specifies how Observer Commons solutions declare composability, how compatibility is verified, how multi-solution assemblies are formed, and what role AI plays within governance boundaries.

The fundamental constraint: composition must work across domains -- code, knowledge, processes, governance frameworks -- not just software. A caching pattern in software engineering and a buffering pattern in manufacturing share structural isomorphism. The composition protocol must handle both explicit (declared) and discovered (AI-detected) compatibility without collapsing the distinction between the two.

**In scope:**
- Interface definitions for solution inputs and outputs
- Dependency graph format and resolution
- Compatibility checking mechanisms (static, dynamic, AI-assisted)
- Cross-domain composition model
- AI assembly suggestion boundaries
- Lessons from existing composition systems

**Out of scope:**
- Solution record format (defined in 01-solution-record-spec)
- Discovery and federation (defined in 02-federation-spec)
- Trust and quality signals (defined in 03-trust-spec)

---

## 2. Design Principles

### 2.1 Governing Principles

1. **AI Articulates, Humans Decide.** AI can suggest compositions, detect compatibility, and identify cross-domain patterns. Humans approve actual assemblies. This is not a guideline -- it is a structural requirement enforced by the protocol.

2. **Vendor Independence.** Core composition operations require no proprietary APIs. Any conformant implementation can perform compatibility checking and dependency resolution.

3. **Human Sovereignty.** Solution creators control how their work is composed. A solution author can declare their solution non-composable, restrict composition partners, or require approval for specific assembly types.

4. **Cross-Domain by Default.** The type system, interface definitions, and compatibility checks are designed for knowledge, process, and governance composition -- not retrofitted onto a code-first model.

5. **Mechanical Checking Without AI.** Basic compatibility checking (type matching, constraint satisfaction, conflict detection) must work without AI. AI adds value through pattern recognition, cross-domain bridging, and assembly suggestion -- it does not replace deterministic checking.

6. **Progressive Composition.** Simple compositions (two solutions, explicit interfaces) must be trivially easy. Complex compositions (multi-solution assemblies, cross-domain, AI-discovered compatibility) add complexity only when needed.

### 2.2 Structural Principle: The Port Model

Borrowing from hardware design and flow-based programming, every solution exposes **ports** -- typed connection points for inputs and outputs. Ports are the universal interface. This is the Observer Commons equivalent of Unix's stdin/stdout: a single abstraction that enables arbitrary composition.

Ports are **structural**, not nominal. Two ports are compatible if their shapes match, regardless of what they are named. This enables cross-domain composition: a "data stream" port in software and a "material flow" port in manufacturing can compose if their structural types align.

---

## 3. Interface Definitions (ISC-Comp-1)

### 3.1 Port Specification

Every solution declares zero or more **input ports** and **output ports**. A port is defined by:

```yaml
ports:
  inputs:
    - port_id: "user-credentials"
      label: "User Credentials"
      type:
        kind: "structured"
        schema:
          format: "json-schema"          # or "prose-contract" for non-code
          definition:
            type: "object"
            properties:
              username: { type: "string" }
              password: { type: "string", sensitive: true }
            required: ["username", "password"]
      required: true
      description: "Authentication credentials to validate"
      constraints:
        - "Must be transmitted over encrypted channel"
        - "Must not be logged or persisted in plaintext"

  outputs:
    - port_id: "auth-result"
      label: "Authentication Result"
      type:
        kind: "structured"
        schema:
          format: "json-schema"
          definition:
            type: "object"
            properties:
              authenticated: { type: "boolean" }
              session_token: { type: "string" }
              roles: { type: "array", items: { type: "string" } }
            required: ["authenticated"]
      guarantees:
        - "Session token is cryptographically random, minimum 256 bits"
        - "Roles array is non-empty if authenticated is true"
      description: "Result of authentication attempt"
```

### 3.2 Port Type System

The type system must handle both code and non-code solutions. It uses a layered approach:

**Layer 1 -- Type Kinds:**

| Kind | Use Case | Checking | Example |
|------|----------|----------|---------|
| `structured` | Code, data, APIs | Mechanical (schema validation) | JSON Schema, Protocol Buffers |
| `prose-contract` | Knowledge, process | Human + AI review | Natural language preconditions/postconditions |
| `hybrid` | Mixed domains | Mechanical + review | Structured data with prose constraints |
| `opaque` | Unknown/flexible | Human judgment only | "Any governance framework" |

**Layer 2 -- Type Shapes:**

For `structured` types, shape is defined by a schema (JSON Schema, or equivalent). Two ports are structurally compatible if the output port's schema is a **subtype** of the input port's schema -- the output provides at least what the input requires.

For `prose-contract` types, shape is defined by:

```yaml
type:
  kind: "prose-contract"
  contract:
    preconditions:
      - "Organization has defined roles and responsibilities"
      - "Decision-making authority is documented"
    postconditions:
      - "All decisions have documented rationale"
      - "Accountability chains are traceable"
    context_requirements:
      - domain: "organizational governance"
      - scale: "team to department"
```

**Layer 3 -- Constraints:**

Constraints are additional requirements beyond type shape. They are declared as natural language statements with optional machine-checkable annotations:

```yaml
constraints:
  - text: "Must complete within 30 seconds"
    checkable: true
    metric: "latency_p99"
    threshold: 30000
    unit: "milliseconds"
  - text: "Must not require internet connectivity"
    checkable: false
```

### 3.3 Port Granularity

Ports operate at the **solution level**, not method or module level. A solution is the atomic unit of composition. Internal structure is opaque to the composition protocol.

Rationale: Method-level interfaces create tight coupling and version fragility. Solution-level interfaces are stable contracts. This mirrors the lesson from microservices: compose at service boundaries, not class boundaries.

If a solution is too coarse-grained for useful composition, the answer is to split it into smaller solutions -- not to expose internal interfaces.

### 3.4 Interface Versioning

Port definitions are versioned alongside the solution. When a port's type shape changes:

- **Additive changes** (new optional output fields): Minor version bump. Backward compatible.
- **Breaking changes** (removed fields, type changes, new required inputs): Major version bump. Not backward compatible.
- **Constraint changes**: Evaluated case-by-case. Relaxing a constraint is additive; tightening is breaking.

```yaml
ports:
  inputs:
    - port_id: "config"
      since_version: "1.0.0"
      deprecated_in: null
      breaking_changes:
        - version: "2.0.0"
          description: "Changed config format from flat key-value to nested structure"
```

---

## 4. Dependency Graph Format (ISC-Comp-2)

### 4.1 Dependency Declaration

Solutions declare dependencies on other solutions using a DAG (Directed Acyclic Graph) structure. Each dependency specifies:

```yaml
dependencies:
  required:
    - solution_id: "commons://auth/session-management"
      version_constraint: ">=2.0.0 <3.0.0"
      port_bindings:
        - from_output: "auth-result"       # this solution's output
          to_input: "session-identity"     # dependency's input
      reason: "Session management requires authenticated identity"

    - solution_id: "commons://logging/structured-audit"
      version_constraint: ">=1.0.0"
      port_bindings:
        - from_output: "auth-events"
          to_input: "event-stream"
      reason: "Compliance requires audit trail of authentication events"

  optional:
    - solution_id: "commons://auth/mfa-provider"
      version_constraint: ">=1.0.0"
      port_bindings:
        - from_output: "mfa-challenge"
          to_input: "challenge-request"
      reason: "Multi-factor authentication enhances security posture"
      default_behavior: "Falls back to single-factor authentication"

  suggests:
    - solution_id: "commons://monitoring/health-check"
      reason: "Health monitoring recommended for production deployments"
      affinity: 0.7    # 0.0-1.0 strength of suggestion
```

### 4.2 Relationship Types

| Relationship | Semantics | Assembly Behavior |
|-------------|-----------|-------------------|
| `required` | Must be present for solution to function | Assembly fails if unresolved |
| `optional` | Enhances solution but not necessary | Assembly succeeds without; solution degrades gracefully |
| `suggests` | Recommended companion | Surfaced to humans during assembly; never auto-included |
| `conflicts` | Cannot coexist | Assembly fails if both present |
| `supersedes` | Replaces another solution | Enables migration paths |

### 4.3 Version Constraints

For **code solutions**, use semantic versioning ranges (aligned with semver.org):

```
>=1.2.0 <2.0.0    # Compatible with 1.x from 1.2 onward
^1.2.0             # Shorthand for >=1.2.0 <2.0.0
~1.2.0             # >=1.2.0 <1.3.0
*                  # Any version
```

For **non-code solutions**, semantic versioning maps differently:

- **Major:** Fundamental approach or philosophy changed
- **Minor:** New steps, considerations, or optional elements added
- **Patch:** Clarifications, typo fixes, wording improvements

Non-code solutions MAY use a looser constraint system when semantic versioning does not apply:

```yaml
version_constraint: ">=1.0.0"
compatibility_note: "Any version of this governance framework; core principles stable since 1.0"
```

### 4.4 Circular Dependency Handling

Circular dependencies are **prohibited** at the required-dependency level. The dependency graph MUST be a DAG.

For `suggests` and `optional` relationships, mutual suggestion is permitted (A suggests B, B suggests A) because these do not create hard coupling.

Detection: Any tool producing or validating a dependency graph MUST perform cycle detection and reject graphs containing cycles in required dependencies. This is a mechanical check -- no AI required.

### 4.5 Diamond Dependency Resolution

When two solutions both depend on a third solution but require different versions, the resolution strategy is:

1. **Intersection:** If version ranges overlap, use the intersection. `>=1.2.0 <2.0.0` and `>=1.5.0 <2.0.0` resolves to `>=1.5.0 <2.0.0`.
2. **Conflict:** If ranges do not overlap, the assembly has a conflict. Report to the human assembler with both constraints and the solutions that imposed them.
3. **No silent resolution:** Unlike npm (which can install multiple versions), Observer Commons does NOT silently duplicate solutions. Conflicts are surfaced, not hidden. The human decides: upgrade a dependency, find an alternative, or accept the conflict with documented rationale.

Rationale: Silent duplication works for code packages but fails catastrophically for knowledge and governance solutions. You cannot have two conflicting governance frameworks operating simultaneously.

---

## 5. Compatibility Checking (ISC-Comp-3)

### 5.1 Checking Layers

Compatibility checking operates in three layers, from cheapest to most expensive:

```
Layer 1: Static Type Checking     (mechanical, instant, no AI)
Layer 2: Constraint Satisfaction   (mechanical + heuristic, fast, optional AI)
Layer 3: Semantic Compatibility    (AI-assisted, slower, human-verified)
```

Each layer is independently useful. A deployment with no AI capability can still perform Layer 1 and most of Layer 2.

### 5.2 Layer 1: Static Type Checking

Given two solutions A and B, where A's output port connects to B's input port:

**For structured types:**

```
COMPATIBLE if:
  output_schema is_subtype_of input_schema

is_subtype_of:
  - Every required property in input_schema exists in output_schema
  - Every shared property has compatible types (recursive check)
  - output_schema MAY have additional properties not in input_schema
```

**For prose-contract types:**

Static checking produces `INDETERMINATE` -- cannot mechanically verify natural language contracts. Escalate to Layer 2 or 3.

**For hybrid types:**

Check the structured portion mechanically. Flag the prose portion for review.

**Result codes:**

| Code | Meaning |
|------|---------|
| `COMPATIBLE` | Types match structurally |
| `INCOMPATIBLE` | Types conflict structurally |
| `INDETERMINATE` | Cannot determine mechanically |
| `PARTIAL` | Some ports compatible, others not |

### 5.3 Layer 2: Constraint Satisfaction

Evaluate whether the constraints of both solutions can be simultaneously satisfied:

```
For each constraint C_a in solution A:
  For each constraint C_b in solution B:
    Check: are C_a and C_b contradictory?

Example contradictions:
  C_a: "Must complete within 30 seconds"
  C_b: "Requires minimum 60-second processing window"
  Result: CONFLICT

Example non-contradictions:
  C_a: "Must not require internet connectivity"
  C_b: "Must run on Linux"
  Result: COMPATIBLE (independent constraints)
```

For machine-checkable constraints (those with `checkable: true` and metrics), this is mechanical. For natural language constraints, AI can assist by identifying likely contradictions, but the result is always `SUGGESTED` until human-verified.

### 5.4 Layer 3: Semantic Compatibility

AI-assisted analysis that goes beyond type and constraint checking:

- **Intent alignment:** Do these solutions serve complementary purposes?
- **Assumption compatibility:** Does solution A assume things that solution B violates?
- **Cross-domain pattern matching:** Is this knowledge solution structurally isomorphic to that code solution?
- **Gap detection:** What is missing between these two solutions that a third would fill?

Layer 3 results are ALWAYS advisory. They are suggestions for human review, never automatic decisions.

```yaml
# Layer 3 compatibility report (AI-generated, human-reviewed)
semantic_analysis:
  analyst: "ai"
  confidence: 0.78
  status: "SUGGESTED_COMPATIBLE"     # Never just "COMPATIBLE" from AI
  reasoning: |
    Solution A (authentication framework) and Solution B (session management)
    share complementary concerns. A produces identity assertions that B consumes.
    No assumption conflicts detected. Recommended composition order: A -> B.
  risks:
    - "Session timeout assumptions in B may conflict with A's token lifetime"
    - "B assumes single-session-per-user; A does not enforce this"
  human_review_required: true
  reviewed_by: null
  review_date: null
  review_verdict: null
```

### 5.5 Compatibility Matrix

For a given set of solutions, generate a compatibility matrix:

```
          | Auth | Session | Audit | MFA   |
Auth      |  --  |   C     |   C   |  C    |
Session   |  C   |   --    |   C   |  I    |
Audit     |  C   |   C     |   --  |  C    |
MFA       |  C   |   I     |   C   |  --   |

C = Compatible, I = Incompatible, P = Partial, ? = Indeterminate
```

This matrix is generated mechanically (Layer 1) and enriched by AI (Layer 3). The matrix format is intentionally simple -- it must be comprehensible by humans scanning for problems.

### 5.6 Human Override

Compatibility checking can be overridden by humans in both directions:

- **Force Compatible:** "These solutions work together despite type mismatch, because [documented rationale]."
- **Force Incompatible:** "These solutions must not be composed, because [documented rationale]."

Overrides are stored in the assembly record (Section 6) with full rationale, author attribution, and timestamp. They do not modify the solutions themselves.

---

## 6. Assembly Records

### 6.1 What is an Assembly?

An **assembly** is a documented composition of two or more solutions into a coherent whole. It records which solutions are included, how their ports are connected, what compatibility checks passed or were overridden, and who approved the composition.

```yaml
assembly:
  assembly_id: "commons://assemblies/complete-auth-system"
  version: "1.0.0"
  title: "Complete Authentication System"
  description: "Authentication, session management, and audit logging composed into a complete auth system"
  created_by: "human:adam"
  created_at: "2026-03-01T08:00:00Z"
  status: "approved"       # draft | proposed | approved | deprecated

  solutions:
    - solution_id: "commons://auth/credential-validator"
      version: "2.1.0"
      role: "primary"

    - solution_id: "commons://auth/session-management"
      version: "2.3.1"
      role: "required"

    - solution_id: "commons://logging/structured-audit"
      version: "1.4.0"
      role: "required"

  connections:
    - from:
        solution: "commons://auth/credential-validator"
        port: "auth-result"
      to:
        solution: "commons://auth/session-management"
        port: "session-identity"
      compatibility:
        layer1: "COMPATIBLE"
        layer2: "COMPATIBLE"
        layer3: "SUGGESTED_COMPATIBLE"
        verified_by: "human:adam"

    - from:
        solution: "commons://auth/credential-validator"
        port: "auth-events"
      to:
        solution: "commons://logging/structured-audit"
        port: "event-stream"
      compatibility:
        layer1: "COMPATIBLE"
        layer2: "COMPATIBLE"
        verified_by: "human:adam"

  overrides: []

  approval:
    approved_by: "human:adam"
    approved_at: "2026-03-01T08:30:00Z"
    rationale: "Composed for production authentication stack"
```

### 6.2 Assembly Lifecycle

```
[draft] --> [proposed] --> [approved] --> [deprecated]
                |
                v
           [rejected]
```

- **Draft:** Work in progress. Ports may be unconnected. Compatibility unchecked.
- **Proposed:** All connections declared. Compatibility checked (Layers 1-3 as available). Ready for human review.
- **Approved:** Human has reviewed and approved. Assembly is usable.
- **Deprecated:** Superseded or no longer recommended.
- **Rejected:** Proposed but not approved. Rationale documented.

Only humans can transition an assembly to `approved`. This is structurally enforced -- the `approved_by` field must reference a human identity, never an AI agent.

### 6.3 Assembly as Solution

An approved assembly can itself be published as a solution with its own ports (the unconnected ports of its constituent solutions). This enables hierarchical composition -- assemblies of assemblies.

The ports of an assembly are computed:

- **Exposed input ports:** Input ports of constituent solutions that are NOT connected to any internal output port.
- **Exposed output ports:** Output ports of constituent solutions that are NOT connected to any internal input port.

This is analogous to how electronic circuits expose pins: internal wiring is hidden; only unconnected pins appear on the package.

---

## 7. Cross-Domain Composition (ISC-Comp-4)

### 7.1 The Cross-Domain Challenge

Code composition has decades of tooling: type systems, package managers, build tools. Non-code composition has almost none. The Observer Commons must bridge this gap without reducing non-code solutions to second-class citizens.

The key insight: **all composition is about data flow and transformation**. Code transforms data structures. Processes transform states. Governance transforms authority. The port model abstracts over the specific domain.

### 7.2 Domain-Specific Port Patterns

**Code Domain:**

```yaml
# API Gateway solution
ports:
  inputs:
    - port_id: "http-request"
      type:
        kind: "structured"
        schema:
          format: "json-schema"
          definition:
            type: "object"
            properties:
              method: { type: "string", enum: ["GET","POST","PUT","DELETE"] }
              path: { type: "string" }
              headers: { type: "object" }
              body: { type: "object" }
  outputs:
    - port_id: "routed-request"
      type:
        kind: "structured"
        schema:
          format: "json-schema"
          definition:
            type: "object"
            properties:
              target_service: { type: "string" }
              authenticated: { type: "boolean" }
              request: { "$ref": "#/inputs/http-request" }
```

**Knowledge Domain:**

```yaml
# Decision-Making Framework solution
ports:
  inputs:
    - port_id: "decision-context"
      type:
        kind: "prose-contract"
        contract:
          preconditions:
            - "A decision requiring structured evaluation has been identified"
            - "Stakeholders affected by the decision are known"
            - "Available options have been enumerated (minimum 2)"
          context_requirements:
            - domain: "organizational decision-making"
            - participants: "decision-maker plus at least one advisor"
  outputs:
    - port_id: "decision-record"
      type:
        kind: "hybrid"
        structured_part:
          format: "json-schema"
          definition:
            type: "object"
            properties:
              decision: { type: "string" }
              date: { type: "string", format: "date" }
              status: { type: "string", enum: ["proposed","accepted","rejected"] }
              consequences: { type: "array", items: { type: "string" } }
            required: ["decision", "date", "status"]
        prose_part:
          postconditions:
            - "Decision rationale is documented and traceable"
            - "Dissenting views are recorded"
            - "Review date is established"
```

**Governance Domain:**

```yaml
# Open Source License Compliance solution
ports:
  inputs:
    - port_id: "project-inventory"
      type:
        kind: "hybrid"
        structured_part:
          format: "json-schema"
          definition:
            type: "object"
            properties:
              dependencies:
                type: "array"
                items:
                  type: "object"
                  properties:
                    name: { type: "string" }
                    license: { type: "string" }
                    version: { type: "string" }
        prose_part:
          preconditions:
            - "Project has a declared primary license"
            - "All direct dependencies are enumerated"
  outputs:
    - port_id: "compliance-report"
      type:
        kind: "prose-contract"
        contract:
          postconditions:
            - "All license incompatibilities are identified"
            - "Required attributions are listed"
            - "Recommended actions for non-compliance are provided"
```

### 7.3 Cross-Domain Composition Example

Composing the Decision-Making Framework (knowledge domain) with the Open Source License Compliance (governance domain):

```yaml
# Cross-domain assembly: License Decision Process
assembly:
  title: "Open Source License Decision Process"
  description: "Combines structured decision-making with license compliance analysis"

  connections:
    - from:
        solution: "commons://governance/license-compliance"
        port: "compliance-report"
      to:
        solution: "commons://knowledge/decision-framework"
        port: "decision-context"
      compatibility:
        layer1: "INDETERMINATE"    # prose-contract to prose-contract
        layer2: "COMPATIBLE"       # no constraint conflicts
        layer3: "SUGGESTED_COMPATIBLE"
        layer3_reasoning: |
          The compliance report identifies license issues requiring decisions.
          The decision framework consumes situations requiring structured evaluation.
          The compliance report's output (identified issues, options) maps to the
          decision framework's input (decision context, enumerated options).
        verified_by: "human:adam"
        override_rationale: |
          Prose contracts are structurally compatible: compliance report output
          provides the decision context, enumerated options (compatible vs
          incompatible licenses), and stakeholder impact needed by the
          decision framework input.
```

This example demonstrates the critical pattern: cross-domain composition often requires Layer 3 (AI-assisted semantic analysis) and always requires human verification. The protocol supports this without blocking simpler within-domain compositions.

### 7.4 Impedance Mismatch Handling

When composing across domains, type mismatches are expected. The protocol provides **adapters** -- small solutions whose sole purpose is to bridge between domains:

```yaml
# Adapter solution: Compliance-to-Decision Bridge
solution:
  id: "commons://adapters/compliance-to-decision"
  type: "adapter"
  description: "Transforms license compliance reports into decision framework inputs"

  ports:
    inputs:
      - port_id: "compliance-input"
        type:
          kind: "prose-contract"
          contract:
            preconditions:
              - "A compliance report with identified issues exists"
    outputs:
      - port_id: "decision-output"
        type:
          kind: "prose-contract"
          contract:
            postconditions:
              - "Decision context is framed with compliance issues as options"
              - "Stakeholders are mapped from affected projects"
              - "Minimum two options are presented (comply, accept risk, find alternative)"

  transformation:
    description: |
      Maps compliance report fields to decision framework inputs:
      - Incompatibilities become "decisions requiring evaluation"
      - Affected projects become "stakeholders"
      - Resolution options become "available options"
```

Adapters are first-class solutions. They can be shared, versioned, and composed like any other solution. They make the impedance mismatch explicit rather than hiding it.

---

## 8. AI Assembly Suggestion Boundary (ISC-Comp-5)

### 8.1 The Boundary Principle

AI operates in an **advisory capacity** within the composition protocol. The boundary is structural, not policy-based -- meaning it is enforced by the data format and validation rules, not by asking AI to self-limit.

**What AI CAN do:**

| Action | Produces | Requires Human? |
|--------|----------|-----------------|
| Suggest compatible solutions | Suggestion list | Yes, to accept |
| Detect cross-domain patterns | Pattern report | Yes, to validate |
| Generate draft assemblies | Draft assembly record | Yes, to promote from draft |
| Identify gaps in assemblies | Gap analysis | Yes, to act on |
| Flag potential conflicts | Conflict report | Yes, to resolve |
| Rank solutions by fit | Ranked list with reasoning | Yes, to select |
| Propose adapter solutions | Adapter draft | Yes, to approve |

**What AI CANNOT do:**

| Action | Why Not |
|--------|---------|
| Approve an assembly | `approved_by` must be a human identity |
| Force-mark solutions as compatible | Override records require human identity |
| Remove solutions from an assembly | Structural changes require human action |
| Modify solution ports | Solution author controls their interfaces |
| Resolve version conflicts automatically | Silent resolution violates transparency |
| Execute composed solutions | Composition is descriptive, not executable |

### 8.2 Structural Enforcement

The boundary is enforced through identity typing:

```yaml
# Identity types
identity:
  human: "human:<username>"      # Can approve, override, modify
  ai: "ai:<agent-id>"           # Can suggest, analyze, draft
  system: "system:<service-id>"  # Can validate, check, report

# Approval fields MUST be human identity
approval:
  approved_by: "human:*"        # Pattern: only human identities accepted
  # approved_by: "ai:*"         # REJECTED by validation
```

Any tool implementing the composition protocol MUST validate that approval and override fields contain human identities. An assembly with `approved_by: "ai:gpt-4"` is structurally invalid.

### 8.3 AI Suggestion Format

When AI suggests an assembly, the output follows a standardized format:

```yaml
ai_suggestion:
  suggested_by: "ai:commons-assistant"
  suggested_at: "2026-03-01T10:00:00Z"
  suggestion_type: "assembly"
  confidence: 0.82

  rationale: |
    Based on the user's stated goal of "complete authentication system",
    these three solutions compose to cover credential validation, session
    management, and audit logging. Compatibility checking shows full
    Layer 1 compatibility on all connections.

  suggested_assembly:
    # ... draft assembly record ...
    status: "draft"                    # AI can only create drafts
    approval:
      approved_by: null                # Explicitly null -- awaiting human
      approved_at: null

  alternatives:
    - solution_id: "commons://auth/oauth-provider"
      reason: "Consider if third-party authentication is preferred"
    - solution_id: "commons://auth/passwordless"
      reason: "Emerging pattern; may be preferable for user experience"

  risks:
    - "Session management solution has not been updated in 8 months"
    - "Audit logging solution has low adoption (3 known users)"

  action_required: "Human review and approval needed to activate this assembly"
```

### 8.4 Discovery-Suggestion Pipeline

```
1. Human states goal
     |
2. AI searches commons (via federation) for relevant solutions
     |
3. AI runs Layer 1 + 2 compatibility checks (mechanical)
     |
4. AI runs Layer 3 semantic analysis (AI-assisted)
     |
5. AI generates suggestion with rationale and alternatives
     |
6. Human reviews suggestion
     |
7. Human modifies, approves, or rejects
     |
8. If approved: assembly record created with human identity
```

At no point does AI make binding decisions. Steps 2-5 are advisory. Steps 6-8 are sovereign.

---

## 9. Lessons from Existing Systems (ISC-Comp-6)

### 9.1 Package Managers (npm, cargo, pip)

**What transfers:**
- **Dependency declaration format.** The `dependencies` field in package.json is a proven pattern. Observer Commons adopts the same structure: solution ID + version constraint.
- **Semantic versioning.** Major/minor/patch communicates compatibility intent. Adopted for code solutions; adapted for non-code.
- **Version range syntax.** `>=1.2.0 <2.0.0` is well-understood. Adopted directly.
- **Lockfiles as assembly records.** A lockfile pins exact versions of all transitive dependencies. Assembly records serve the same function -- they are the "lockfile" of a composition.

**What does NOT transfer:**
- **Automatic transitive resolution.** npm resolves the entire dependency tree automatically. This works for code (where you can run tests to verify) but fails for knowledge and governance solutions where "resolution" requires human judgment. Observer Commons surfaces the tree but does not auto-resolve.
- **Multiple version installation.** npm can install multiple versions of the same package. This makes no sense for non-code solutions and creates hidden complexity even for code. Observer Commons rejects this pattern.
- **Centralized registry as authority.** npm's registry is a single point of failure and control. Observer Commons uses federated discovery (defined elsewhere).

### 9.2 Unix Pipes

**What transfers:**
- **Universal interface.** stdin/stdout as text streams enabled arbitrary composition. Observer Commons ports serve the same role -- a universal connection point.
- **Small, composable units.** Unix philosophy of small tools that do one thing well. Solutions should be similarly focused.
- **Composition by convention, not configuration.** `cat file | grep pattern | sort` requires no configuration file. Basic composition should be similarly lightweight.

**What does NOT transfer:**
- **Untyped streams.** Unix pipes are untyped byte streams. This simplicity enables composition but also enables errors (piping binary to a text tool). Observer Commons uses typed ports to catch mismatches early.
- **Linear pipelines only.** Unix pipes are strictly linear (A | B | C). Observer Commons supports arbitrary DAG topologies.
- **No metadata.** Unix pipes carry no metadata about what is flowing. Observer Commons ports carry type information, constraints, and provenance.

### 9.3 Terraform Modules

**What transfers:**
- **Input/output variables as interface.** Terraform modules declare `variable` (inputs) and `output` (outputs) blocks. This is directly analogous to ports.
- **Module composition via references.** `module.auth.session_token` references another module's output. Observer Commons connections serve the same purpose.
- **State management.** Terraform tracks what exists vs what is desired. Assembly records serve a similar function -- tracking what is composed vs what is planned.

**What does NOT transfer:**
- **Imperative state management.** Terraform's state file is complex and fragile. Observer Commons assemblies are declarative descriptions, not executable state.
- **Provider-specific resources.** Terraform modules often depend on specific cloud providers. Observer Commons is vendor-independent by design (ISC-A-Comp-1).

### 9.4 Kubernetes Operators

**What transfers:**
- **Custom Resource Definitions (CRDs) as interfaces.** CRDs define the shape of configuration that an operator accepts. This is similar to typed input ports.
- **Reconciliation loops.** Operators continuously reconcile desired state with actual state. While Observer Commons does not execute, the pattern of "declared composition vs verified composition" is analogous.

**What does NOT transfer:**
- **Complexity.** Kubernetes operator development is heavyweight. Observer Commons composition must be accessible to non-programmers.
- **Runtime coupling.** Operators run continuously in a cluster. Observer Commons compositions are descriptive, not runtime-dependent.

### 9.5 Excel/Zapier (Non-Programmer Composition)

**What transfers:**
- **Visual data flow.** Zapier's trigger-action model and Excel's cell references make composition visible and understandable. Observer Commons should support visual assembly tools (though this spec does not mandate a specific UI).
- **Template-based composition.** "Connect Gmail to Slack" is a pre-built composition. Observer Commons assemblies can serve as templates.
- **Accessibility.** Non-programmers successfully compose complex workflows in these tools. Observer Commons must achieve similar accessibility for non-code solutions.

**What does NOT transfer:**
- **Vendor lock-in.** Zapier compositions only work within Zapier. Violates ISC-A-Comp-1.
- **Brittle connections.** Zapier integrations break when APIs change. Observer Commons' typed ports and versioned interfaces provide more resilience.

### 9.6 Synthesis: What Observer Commons Takes Forward

| Pattern | Source | Adaptation |
|---------|--------|------------|
| Typed interfaces | All systems | Port model with kind-based type system |
| Version constraints | npm/cargo/pip | Semver for code; adapted semantics for non-code |
| Universal connection point | Unix pipes | Ports (typed, unlike pipes) |
| Input/output declarations | Terraform | Port definitions at solution level |
| No auto-resolution for complex cases | Lesson from npm's problems | Human-in-the-loop for conflicts |
| Accessible composition | Excel/Zapier | Cross-domain port model; adapters for bridging |
| Assembly as artifact | Lockfiles | Assembly records with approval chain |

---

## 10. Composition Operations

### 10.1 Core Operations

The protocol defines five core operations. All must be implementable without AI (though AI can enhance each):

**1. CHECK_COMPATIBILITY(solution_a, port_out, solution_b, port_in) -> CompatibilityResult**

Checks whether a specific output port of solution A can connect to a specific input port of solution B.

```
Input: Two solutions and the ports to connect
Output: CompatibilityResult { status, layer_results, conflicts, suggestions }
Requires AI: No (Layer 1 and checkable Layer 2)
Enhanced by AI: Yes (Layer 3 semantic analysis)
```

**2. VALIDATE_ASSEMBLY(assembly_record) -> ValidationResult**

Checks an entire assembly record for internal consistency: all connections valid, no cycles in required dependencies, no unresolved version conflicts, all required ports connected.

```
Input: Assembly record
Output: ValidationResult { valid, errors[], warnings[] }
Requires AI: No
Enhanced by AI: Yes (gap detection, optimization suggestions)
```

**3. RESOLVE_DEPENDENCIES(solution_id, available_solutions[]) -> DependencyTree**

Given a solution and a set of available solutions, resolve its dependency tree. Required dependencies must be satisfied; optional dependencies are included if available; version conflicts are reported.

```
Input: Root solution + available solution pool
Output: DependencyTree { resolved[], unresolved[], conflicts[] }
Requires AI: No
Enhanced by AI: Yes (suggesting alternatives for unresolved dependencies)
```

**4. COMPUTE_EXPOSED_PORTS(assembly_record) -> PortSet**

Given an assembly, compute which ports are exposed (unconnected internally) and thus form the assembly's external interface.

```
Input: Assembly record
Output: PortSet { inputs[], outputs[] }
Requires AI: No
Enhanced by AI: No (purely mechanical)
```

**5. SUGGEST_COMPOSITIONS(goal_description, available_solutions[]) -> Suggestion[]**

Given a human-stated goal and available solutions, suggest possible assemblies.

```
Input: Natural language goal + available solution pool
Output: Suggestion[] { assembly_draft, confidence, rationale, alternatives }
Requires AI: Yes (this is the AI-native operation)
Human required: Yes (to review and approve suggestions)
```

### 10.2 Operation Boundaries

Operations 1-4 are **deterministic** -- given the same inputs, they produce the same outputs. They can be implemented by any conformant tool without AI.

Operation 5 is **non-deterministic** -- it depends on AI interpretation of the goal. Its output is always advisory, never binding.

This separation ensures that the core composition protocol works without AI, while AI adds genuine value where human language and cross-domain reasoning are involved.

---

## 11. Error Handling & Edge Cases

### 11.1 Common Composition Errors

| Error | Detection | Resolution |
|-------|-----------|------------|
| Type mismatch | Layer 1 static check | Use adapter solution or modify port definition |
| Version conflict | Dependency resolution | Human selects version; upgrade or find alternative |
| Circular dependency | Graph cycle detection | Restructure solutions to break cycle |
| Missing required dependency | Dependency resolution | Find solution in commons or create one |
| Constraint contradiction | Layer 2 constraint check | Relax constraint (if safe) or choose different solution |
| Orphaned port | Assembly validation | Connect port or document why it is intentionally unused |
| Deprecated solution in assembly | Version check against solution metadata | Migrate to replacement or accept with documented rationale |

### 11.2 Graceful Degradation

When composition checking cannot complete fully (e.g., AI unavailable for Layer 3, remote solution metadata unreachable):

- Report what was checked and what was not
- Never assume compatibility for unchecked dimensions
- Mark assembly status as `partial_check` with details of what remains unverified
- Allow human to override and approve despite incomplete checking

---

## 12. Pre-Mortem: What Could Go Wrong

### 12.1 Technical Risks

1. **Type system too complex.** The four-kind type system (structured, prose-contract, hybrid, opaque) may be over-engineered. Risk: solution authors avoid typing ports correctly because it is too much work. Mitigation: make `opaque` the default; let specificity grow organically.

2. **Cross-domain composition is illusory.** Structural isomorphism between domains may be rarer than assumed. A caching pattern and a buffering pattern may share structure but differ in semantics that matter. Risk: AI suggests compositions that look right but are meaningless. Mitigation: Layer 3 is always advisory; human review catches false positives.

3. **Adapter explosion.** If every cross-domain composition requires a custom adapter, the adapter count grows quadratically with domain count. Risk: adapter maintenance becomes a burden. Mitigation: identify common adapter patterns and standardize them; encourage domain-native port definitions that minimize bridging.

4. **Version constraint rigidity for non-code.** Semantic versioning may not map well to knowledge and governance solutions. What is a "breaking change" in a decision-making framework? Risk: version constraints are either too loose (useless) or too strict (block valid compositions). Mitigation: allow compatibility_note field for non-code version constraints; invest in good examples and guidance.

5. **Diamond dependency frequency.** In a rich commons, diamond dependencies may be common. Risk: humans are constantly resolving version conflicts. Mitigation: encourage broad version ranges for optional and suggests dependencies; reserve tight constraints for required dependencies only.

### 12.2 Social Risks

6. **Low adoption of port definitions.** Solution authors may not invest effort in defining ports, making composition mechanically impossible. Risk: the protocol exists but is not used. Mitigation: tooling should generate port definitions from solution content where possible; start with code solutions where types are extractable.

7. **AI suggestions create false confidence.** Users may trust AI assembly suggestions without adequate review. Risk: incompatible or inappropriate compositions are deployed. Mitigation: structural enforcement (AI cannot approve); prominent warnings on AI-suggested assemblies; require explicit human sign-off.

8. **Governance gaming.** Bad actors could create solutions with deliberately misleading port definitions to appear compatible with popular solutions. Risk: trojan compositions. Mitigation: trust layer (defined elsewhere) provides reputation signals; assembly reviews should verify actual compatibility, not just declared compatibility.

### 12.3 Accepted Risks

9. **Prose-contract compatibility is subjective.** Two humans may disagree about whether prose contracts are compatible. This is inherent in natural language and is accepted. The protocol does not try to make subjective judgments objective -- it surfaces them for human resolution.

10. **Assembly records grow stale.** As constituent solutions evolve, assemblies may become invalid. Periodic revalidation is recommended but not enforced by this specification. This is a tooling concern.

---

## 13. Sovereignty Check: Does This Preserve Human Control?

### 13.1 Verification

| Principle | Status | Evidence |
|-----------|--------|----------|
| AI cannot approve assemblies | PRESERVED | `approved_by` field requires human identity; structural validation rejects AI identities |
| Solution authors control composition | PRESERVED | Authors define ports and can mark solutions as non-composable; `composition_policy` field |
| Humans resolve conflicts | PRESERVED | Version conflicts and constraint contradictions are surfaced, never auto-resolved |
| AI suggestions are advisory | PRESERVED | AI output is always `SUGGESTED_*` status; `action_required` field mandates human action |
| Transparency over convenience | PRESERVED | No silent resolution; no hidden duplication; all decisions documented with rationale |
| Override capability | PRESERVED | Humans can force-compatible or force-incompatible with documented rationale |

### 13.2 Composition Policy

Solution authors can declare a composition policy:

```yaml
composition_policy:
  composable: true                     # false = solution cannot be composed
  restrictions:
    - type: "domain_restriction"
      allowed_domains: ["software", "devops"]
      reason: "This solution makes assumptions specific to software engineering"
    - type: "approval_required"
      contact: "human:author-name"
      reason: "Novel compositions should be reviewed by the author"
  ai_suggestion: "allowed"            # allowed | restricted | prohibited
```

When `ai_suggestion` is `prohibited`, AI must not include this solution in assembly suggestions. This is the author's sovereign right.

---

## 14. Simplicity Check: Is This the Simplest Version?

### 14.1 What Could Be Removed

| Component | Can It Be Deferred? | Rationale |
|-----------|---------------------|-----------|
| Layer 3 (AI semantic) | Yes | Core protocol works with Layer 1 + 2 only |
| Adapter solutions | Yes | Cross-domain composition works with human overrides |
| Assembly-as-solution | Yes | Hierarchical composition is advanced; not needed initially |
| Composition policy | Partially | `composable: true/false` is essential; fine-grained restrictions can wait |
| Compatibility matrix | Yes | Useful visualization but not required for core operations |
| `suggests` relationship | Yes | `required` and `optional` are sufficient initially |

### 14.2 Minimum Viable Composition

The simplest version that could work:

1. Solutions declare **input ports** and **output ports** with `structured` types only
2. **Layer 1** type checking verifies compatibility
3. **Assembly records** document which solutions are composed and how
4. **Humans approve** all assemblies
5. **Dependencies** use `required` and `optional` relationships with semver constraints

This covers code-domain composition fully. Non-code and cross-domain composition can be added by introducing `prose-contract` types, Layer 3 checking, and adapter solutions in subsequent iterations.

### 14.3 Recommended Implementation Phases

**Phase 1 -- Foundation (MVP):**
- Port definitions with `structured` type kind only
- Layer 1 type checking
- Required and optional dependencies with semver
- Assembly records with human approval
- Core operations 1-4 (no AI)

**Phase 2 -- Cross-Domain:**
- Add `prose-contract` and `hybrid` type kinds
- Layer 2 constraint satisfaction
- Adapter solution pattern
- Cross-domain composition examples and guidance

**Phase 3 -- AI-Enhanced:**
- Layer 3 semantic compatibility
- Operation 5 (SUGGEST_COMPOSITIONS)
- AI suggestion format and pipeline
- Composition policy for AI restrictions

**Phase 4 -- Advanced:**
- Assembly-as-solution (hierarchical composition)
- Compatibility matrix generation
- `suggests` and `supersedes` relationships
- Automated port definition generation from solution content

---

## 15. Glossary

| Term | Definition |
|------|------------|
| **Port** | A typed connection point on a solution -- either an input (consumes) or an output (produces) |
| **Assembly** | A documented composition of two or more solutions with defined connections between ports |
| **Adapter** | A solution whose purpose is to bridge type mismatches between ports in different domains |
| **Compatibility** | The property of two ports being connectable -- verified through type checking, constraint satisfaction, and semantic analysis |
| **Layer 1** | Static type checking -- mechanical, deterministic, no AI required |
| **Layer 2** | Constraint satisfaction -- mechanical for checkable constraints, heuristic for prose constraints |
| **Layer 3** | Semantic compatibility -- AI-assisted, always advisory, requires human verification |
| **Structural typing** | Compatibility determined by shape (what fields exist and their types) rather than name |
| **Diamond dependency** | When two solutions depend on different versions of the same third solution |
| **Composition policy** | Author-declared rules governing how their solution may be composed |
| **Exposed port** | A port on a constituent solution that is not connected to any other port within the assembly, and thus becomes part of the assembly's external interface |

---

## 16. Open Questions

These questions are recorded for future resolution. They do not block the current draft.

1. **Port discovery from content.** Can tooling automatically extract port definitions from existing solutions (e.g., parse API documentation, extract function signatures)? How accurate would this be for non-code solutions?

2. **Composition testing.** Should the protocol define a standard for composition tests -- verifying that an assembly actually works, not just that types align? What does "works" mean for a governance composition?

3. **Composition analytics.** Should the protocol track which compositions are most popular, most successful, or most brittle? How would this data feed back into solution improvement?

4. **Real-time compatibility.** Should compatibility checking happen in real-time as users browse the commons (like IDE autocomplete), or is it a batch operation? What are the performance implications?

5. **Composition licensing.** When solutions with different licenses are composed, what license applies to the assembly? This is a legal question, not a technical one, but the protocol may need to surface it.

6. **Non-DAG compositions.** Are there legitimate cases for circular composition (feedback loops)? If so, how would the protocol handle them without violating the DAG constraint on required dependencies?

---

## Appendix A: Complete Code-Domain Example

### Goal: Compose a REST API Authentication System

**Available Solutions:**

```yaml
# Solution 1: JWT Token Generator
solution_id: "commons://auth/jwt-generator"
version: "2.0.1"
ports:
  inputs:
    - port_id: "user-claims"
      type:
        kind: "structured"
        schema:
          format: "json-schema"
          definition:
            type: "object"
            properties:
              user_id: { type: "string" }
              roles: { type: "array", items: { type: "string" } }
              expiry_minutes: { type: "integer", default: 60 }
            required: ["user_id", "roles"]
  outputs:
    - port_id: "signed-token"
      type:
        kind: "structured"
        schema:
          format: "json-schema"
          definition:
            type: "object"
            properties:
              token: { type: "string" }
              expires_at: { type: "string", format: "date-time" }
            required: ["token", "expires_at"]

# Solution 2: Token Validation Middleware
solution_id: "commons://auth/token-validator"
version: "1.3.0"
ports:
  inputs:
    - port_id: "bearer-token"
      type:
        kind: "structured"
        schema:
          format: "json-schema"
          definition:
            type: "object"
            properties:
              token: { type: "string" }
            required: ["token"]
  outputs:
    - port_id: "validated-identity"
      type:
        kind: "structured"
        schema:
          format: "json-schema"
          definition:
            type: "object"
            properties:
              user_id: { type: "string" }
              roles: { type: "array", items: { type: "string" } }
              valid: { type: "boolean" }
            required: ["user_id", "valid"]

# Solution 3: Role-Based Access Control
solution_id: "commons://auth/rbac"
version: "3.1.0"
ports:
  inputs:
    - port_id: "access-request"
      type:
        kind: "structured"
        schema:
          format: "json-schema"
          definition:
            type: "object"
            properties:
              user_id: { type: "string" }
              roles: { type: "array", items: { type: "string" } }
              resource: { type: "string" }
              action: { type: "string", enum: ["read","write","delete","admin"] }
            required: ["user_id", "roles", "resource", "action"]
  outputs:
    - port_id: "access-decision"
      type:
        kind: "structured"
        schema:
          format: "json-schema"
          definition:
            type: "object"
            properties:
              allowed: { type: "boolean" }
              reason: { type: "string" }
            required: ["allowed"]
```

**Compatibility Check:**

```
jwt-generator.signed-token -> token-validator.bearer-token
  Layer 1: COMPATIBLE
    - token-validator requires {token: string}
    - jwt-generator provides {token: string, expires_at: string}
    - Subtype check passes (output has superset of required fields)

token-validator.validated-identity -> rbac.access-request
  Layer 1: PARTIAL
    - rbac requires {user_id, roles, resource, action}
    - token-validator provides {user_id, roles, valid}
    - Missing: resource, action
    - These must come from elsewhere (the HTTP request context)
    - Note: This partial compatibility is expected -- RBAC needs
      request context in addition to identity
```

**Assembly:**

```yaml
assembly:
  assembly_id: "commons://assemblies/rest-api-auth"
  title: "REST API Authentication & Authorization"
  status: "approved"

  solutions:
    - solution_id: "commons://auth/jwt-generator"
      version: "2.0.1"
    - solution_id: "commons://auth/token-validator"
      version: "1.3.0"
    - solution_id: "commons://auth/rbac"
      version: "3.1.0"

  connections:
    - from: { solution: "jwt-generator", port: "signed-token" }
      to: { solution: "token-validator", port: "bearer-token" }
      compatibility: { layer1: "COMPATIBLE" }

    - from: { solution: "token-validator", port: "validated-identity" }
      to: { solution: "rbac", port: "access-request" }
      compatibility: { layer1: "PARTIAL" }
      note: "resource and action fields must be supplied by request context"

  # Exposed ports (computed):
  # Inputs: jwt-generator.user-claims, rbac.access-request (resource + action fields)
  # Outputs: rbac.access-decision

  approval:
    approved_by: "human:adam"
    approved_at: "2026-03-01T09:00:00Z"
```

---

## Appendix B: Complete Non-Code Example

### Goal: Compose a Project Governance System

**Available Solutions:**

```yaml
# Solution 1: RACI Matrix Framework
solution_id: "commons://governance/raci-matrix"
version: "1.2.0"
ports:
  inputs:
    - port_id: "project-roles"
      type:
        kind: "prose-contract"
        contract:
          preconditions:
            - "Project team members are identified"
            - "Key deliverables or work packages are defined"
          context_requirements:
            - domain: "project management"
  outputs:
    - port_id: "responsibility-assignments"
      type:
        kind: "hybrid"
        structured_part:
          format: "json-schema"
          definition:
            type: "object"
            properties:
              assignments:
                type: "array"
                items:
                  type: "object"
                  properties:
                    task: { type: "string" }
                    responsible: { type: "string" }
                    accountable: { type: "string" }
                    consulted: { type: "array", items: { type: "string" } }
                    informed: { type: "array", items: { type: "string" } }
        prose_part:
          postconditions:
            - "Every task has exactly one accountable person"
            - "Responsible and accountable may be the same person"

# Solution 2: Decision Record Template (ADR-style)
solution_id: "commons://governance/decision-records"
version: "2.0.0"
ports:
  inputs:
    - port_id: "decision-trigger"
      type:
        kind: "prose-contract"
        contract:
          preconditions:
            - "A decision with lasting impact has been identified"
            - "The decision-maker (accountable person) is known"
            - "At least two options have been considered"
  outputs:
    - port_id: "documented-decision"
      type:
        kind: "hybrid"
        structured_part:
          format: "json-schema"
          definition:
            type: "object"
            properties:
              id: { type: "string" }
              title: { type: "string" }
              status: { type: "string", enum: ["proposed","accepted","deprecated","superseded"] }
              date: { type: "string", format: "date" }
              decision: { type: "string" }
        prose_part:
          postconditions:
            - "Context and problem statement are documented"
            - "Considered options are listed with pros and cons"
            - "Decision rationale explains why this option was chosen"

# Solution 3: Retrospective Process
solution_id: "commons://governance/retrospective"
version: "1.0.0"
ports:
  inputs:
    - port_id: "review-period"
      type:
        kind: "prose-contract"
        contract:
          preconditions:
            - "A defined work period has completed (sprint, quarter, project phase)"
            - "Participants who experienced the period are available"
            - "Decisions made during the period are accessible"
  outputs:
    - port_id: "improvement-actions"
      type:
        kind: "prose-contract"
        contract:
          postconditions:
            - "What went well is documented"
            - "What could improve is documented"
            - "Concrete action items with owners are defined"
            - "Previous action items are reviewed for completion"
```

**Cross-Solution Composition:**

```
raci-matrix.responsibility-assignments -> decision-records.decision-trigger
  Layer 1: INDETERMINATE (prose-contract input)
  Layer 2: COMPATIBLE (no constraint conflicts)
  Layer 3: SUGGESTED_COMPATIBLE
    Reasoning: RACI identifies who is accountable for decisions.
    Decision records require knowing the accountable person.
    The RACI output provides the decision-maker identity
    that the decision record process needs.

decision-records.documented-decision -> retrospective.review-period
  Layer 1: INDETERMINATE (prose-contract input)
  Layer 2: COMPATIBLE
  Layer 3: SUGGESTED_COMPATIBLE
    Reasoning: Decision records produced during a work period
    become input for retrospective review. The retrospective
    process requires access to decisions made -- the decision
    record output provides exactly this.
```

This example demonstrates that non-code composition follows the same structural pattern as code composition, with the key difference that compatibility checking relies more heavily on Layer 2 and Layer 3 analysis rather than Layer 1 type checking.

---

## Appendix C: Cross-Domain Composition Example

### Goal: Connect Software Caching Pattern to Manufacturing Buffer Strategy

**Software Solution:**

```yaml
solution_id: "commons://patterns/cache-aside"
version: "1.0.0"
domain: "software-engineering"
ports:
  inputs:
    - port_id: "data-access-pattern"
      type:
        kind: "structured"
        schema:
          format: "json-schema"
          definition:
            type: "object"
            properties:
              read_write_ratio: { type: "number", description: "reads per write" }
              latency_requirement_ms: { type: "integer" }
              data_staleness_tolerance_seconds: { type: "integer" }
  outputs:
    - port_id: "caching-strategy"
      type:
        kind: "hybrid"
        structured_part:
          format: "json-schema"
          definition:
            type: "object"
            properties:
              cache_type: { type: "string", enum: ["read-through","write-through","write-behind","cache-aside"] }
              ttl_seconds: { type: "integer" }
              eviction_policy: { type: "string" }
        prose_part:
          postconditions:
            - "Cache invalidation strategy is defined"
            - "Cold-start behavior is documented"
            - "Consistency guarantees are explicit"
```

**Manufacturing Solution:**

```yaml
solution_id: "commons://manufacturing/buffer-sizing"
version: "2.1.0"
domain: "manufacturing"
ports:
  inputs:
    - port_id: "production-flow"
      type:
        kind: "structured"
        schema:
          format: "json-schema"
          definition:
            type: "object"
            properties:
              throughput_ratio: { type: "number", description: "consumption per production cycle" }
              max_wait_time_minutes: { type: "integer" }
              acceptable_stockout_rate: { type: "number" }
  outputs:
    - port_id: "buffer-strategy"
      type:
        kind: "hybrid"
        structured_part:
          format: "json-schema"
          definition:
            type: "object"
            properties:
              buffer_type: { type: "string" }
              capacity_units: { type: "integer" }
              replenishment_policy: { type: "string" }
        prose_part:
          postconditions:
            - "Buffer depletion response is defined"
            - "Initial fill strategy is documented"
            - "Quality vs throughput tradeoffs are explicit"
```

**AI-Detected Structural Isomorphism:**

```yaml
ai_pattern_analysis:
  analyst: "ai:commons-pattern-detector"
  confidence: 0.71
  pattern: "temporal-buffer"
  mapping:
    - software: "read_write_ratio"
      manufacturing: "throughput_ratio"
      semantic: "Both express demand-to-supply ratio"
    - software: "latency_requirement_ms"
      manufacturing: "max_wait_time_minutes"
      semantic: "Both express maximum acceptable delay (different units)"
    - software: "data_staleness_tolerance_seconds"
      manufacturing: "acceptable_stockout_rate"
      semantic: "Partial match -- both express tolerance for degraded state, but measured differently"
    - software: "cache_type"
      manufacturing: "buffer_type"
      semantic: "Both classify buffering strategy"
    - software: "ttl_seconds"
      manufacturing: "capacity_units"
      semantic: "Weak match -- both bound the buffer, but in different dimensions (time vs space)"
    - software: "eviction_policy"
      manufacturing: "replenishment_policy"
      semantic: "Inverse operations on the same concept -- how buffer contents change"

  conclusion: |
    These solutions share structural isomorphism around the "temporal buffer"
    pattern. They are not directly composable (different domains, different
    units) but knowledge from one informs the other. An adapter could translate
    between domains if a cross-domain team wants to apply software caching
    insights to manufacturing buffer design or vice versa.

  action_required: "Human review needed to determine if cross-domain insight is valuable"
```

This example illustrates the most speculative form of composition: AI-detected patterns across domains. It is explicitly the furthest thing from automatic -- it is a suggestion for human consideration, documented with confidence levels and semantic mappings that a human can evaluate.

---

*End of DRAFT specification. This document requires review, iteration, and ratification before implementation.*
